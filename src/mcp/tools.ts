/* The MCP tools: what an AI assistant can read and change, acting as one person through their personal token.
   Every write goes through the bulk-change engine, so it meets the same rules as the app (owners change their own
   goals, admins any; reasons when behind; a reason for plan changes) and is logged as that person, via MCP. */
import { LEVEL_WORDS, levelIds } from '../domain/levels';
import { addNote, NotAllowed } from '../domain/actions';
import { EMPTY_QUERY, parseQuery, queryEntries, type GoalQuery } from '../domain/query';
import { scopeFacts, searchRows } from '../app/reads';
import { scopesFor, SCOPES, type Scope } from '../domain/goalsPage';
import { localSearch } from '../adapters/localSearch';
import type { FoundRow, Search, SearchAsk } from '../ports/search';
import type { Commit } from '../data/store';
import { describe, examplesLine, planChanges, VIA_MCP, type Answers, type ChangeSet, type Rec, type Tables } from '../domain/changeset';
import { aiBrief, toJson } from '../domain/export';
import { GOAL_ACTION_WORDS, PERSON_ACTION_WORDS } from '../domain/columns';
import { goalScorecard } from '../domain/scorecard';
import { goalStatus } from '../domain/status';
import { attentionGroup, needsAttention } from '../domain/attention';
import { ATTENTION, choices, codeFrom, COMMENT_REMOVED, FLAG, LABEL, QUARTER, RESULT, STATUS, withCode } from '../domain/vocabulary';
import { NEED_OPTIONS } from '../domain/query';
import { WORK_TOOLS } from './workTools';
import { MARKUP_TOOLS } from './markupTools';
import type { MarkupOps } from '../markup/ops';
import { FEEDBACK_TOOLS } from './feedbackTools';
import type { FeedbackOps } from '../markup/feedback';
import { REMOVE_TOOLS } from './removeTools';
import MODULE_TOOLS from 'virtual:faro-modules/tools';
import { isModuleOn, moduleById } from '../core/registry';
import { commentsOf } from '../domain/removal';
import { findGoal, isKey } from '../domain/goalKey';
import { isTableView } from '../domain/tableLayout';
import type { Cycle, DisplayStatus, Level, Person, Snapshot } from '../domain/types';

export interface McpContext {
  /** The workspace; `recording` is its recording switch (on unless false); `modulesOff`, the feature modules an admin
      has switched off there (docs/architecture.md). */
  ws: { id: string; name: string; kind?: 'own' | 'example'; recording?: boolean; modulesOff?: string[] };
  /** The current cycle only. */
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  today: Date;
  actor: Person;
  now: string;
  newId: (prefix: string) => string;
  save(c: Commit): Promise<void>;
  /** Saves a new token (createToken's commit) and returns its secret, made where it's kept; only the hash is stored. */
  issueToken(c: Commit): Promise<string>;
  /** Every goal in the workspace, in every cycle, when the server has them (removing a team reaches past this cycle). */
  allGoals?: Snapshot['goals'];
  /** The whole workspace, unscoped, with every removed record: for restoring and Recently removed (domain/removal). */
  full?: Snapshot;
  /** Deletes the whole workspace (admins, confirmed by name); not every server can. */
  deleteWorkspace?: () => Promise<void>;
  /** The open inbox's markups (src/markup/ops.ts): with any token, when the server has an inbox. */
  markups?: MarkupOps;
  /** The open inbox's feedback triage (src/markup/feedback.ts): with any token, as for markups. */
  feedback?: FeedbackOps;
}

/** A picture a tool sends back, as MCP image content: base64 bytes and their type. */
export interface ToolImage { data: string; mimeType: string }
/** `cause`: what a failed tool threw, for the server's own telemetry (its class only); never sent to the assistant.
    `images`: pictures sent after the text, so the assistant sees them without opening anything (backlog -2). */
export interface ToolResult { text: string; data?: unknown; isError?: boolean; cause?: unknown; images?: ToolImage[] }
type Schema = { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema;
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: boolean };
  run(args: Record<string, unknown>, ctx: McpContext): Promise<ToolResult>;
}

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const num = (description: string) => ({ type: 'number', description });
const int = (description: string) => ({ type: 'integer', description });
const bool = (description: string) => ({ type: 'boolean', description });
const STATUSES: DisplayStatus[] = ['off', 'risk', 'stale', 'none', 'on', 'done', 'planned'];
const CALLS = ['on', 'risk', 'off', 'done'] as const;
/** The words a tool says for a status, with the code beside them for anything that reads it: "Off track (off)". */
export const statusWords = (k: DisplayStatus) => withCode(STATUS[k]);
/** A status the assistant gave: the code or the words, any case ("off", "Off track", "Off track (off)"). */
function statusIn(v: unknown, only: readonly DisplayStatus[] = STATUSES): DisplayStatus {
  const k = codeFrom(STATUS, v);
  if (!k || !only.includes(k)) throw new Error(`“${String(v)}” isn’t a status here. Use one of: ${choices(STATUS, only)}.`);
  return k;
}
const LEVELS: Level[] = levelIds(null);
const DRY = bool('Check the change without saving it. Use it to see what would change, or what is missing.');

/** Tool arguments → a spreadsheet-style row (the same column names as the export). */
function row(args: Record<string, unknown>, map: Record<string, string>): Rec {
  const r: Rec = { __row: '1' };
  for (const [k, col] of Object.entries(map)) {
    const v = args[k];
    if (v === undefined || v === null) continue;
    r[col] = Array.isArray(v) ? v.join('; ') : String(v);
  }
  return r;
}
/** Rows given as objects with column names, any case, spaces or underscores. */
function rows(list: unknown, sheet: string): Rec[] {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new Error(`${sheet} should be a list of rows.`);
  return list.map((o, i) => {
    const r: Rec = { __row: String(i + 1) };
    for (const [k, v] of Object.entries((o ?? {}) as Record<string, unknown>)) if (v != null) r[k.replace(/_/g, ' ').trim().toLowerCase()] = String(v);
    return r;
  });
}

/** Yes to a plan question (a target that flips which way is better, a number far outside the old plan). */
const CONFIRM = bool('True once the person has said a plan change that was questioned (it flips which way is better, or a number is far outside the old plan) is right.');

/** Answers to the questions a change asked, by group id: "use", or { "choice": "choose", "value": "Platform" }. */
const ANSWERS_ARG = { type: 'object', additionalProperties: { anyOf: [{ type: 'string' }, { type: 'object', properties: { choice: { type: 'string' }, value: { type: 'string' } }, required: ['choice'] }] }, description: 'Answers to the questions (Check) a dry run asked, by the group id it gave: {"<id>": "<choice>"} or {"<id>": {"choice": "choose", "value": "Platform"}}. One answer covers every row in its group. Ask the person; never answer for them.' };
/** The answers argument, as the engine takes them. */
const answersOf = (a: unknown): Answers => Object.fromEntries(Object.entries((a ?? {}) as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? { choice: v } : { choice: String((v as { choice?: unknown }).choice ?? ''), ...((v as { value?: unknown }).value != null ? { value: String((v as { value: unknown }).value) } : {}) }]));

async function change(ctx: McpContext, tables: Tables, opts: { dry?: boolean; reason?: string; confirm?: boolean; answers?: unknown }): Promise<ToolResult> {
  const cs: ChangeSet = planChanges({ tables, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, via: 'mcp', reason: opts.reason, confirm: opts.confirm, answers: answersOf(opts.answers) });
  // Every problem has a kind and a level (domain/problemLevels): Must fix, Check (a question), or how a row was read.
  const errors = cs.issues.filter((x) => x.level === 'must');
  const checks = cs.groups.filter((g) => g.level === 'check' && g.kind !== 'plan-question');
  const notes = cs.issues.filter((x) => x.level === 'note');
  const group = (g: ChangeSet['groups'][number]) => ({ id: g.id, kind: g.kind, sheet: g.sheet, column: g.column ?? null, found: g.found ?? null, rows: g.count, firstRows: g.rows.slice(0, 20), sentence: g.title, example: g.example, answers: g.answers.map((a) => ({ choice: a.choice, label: a.label, ...(a.needsValue ? { needsValue: true } : {}), ...(a.options ? { options: a.options } : {}) })) });
  const data = {
    saved: false,
    summary: describe(cs),
    changes: cs.items.map((x) => ({ goalId: x.goalId, goal: x.goal, kind: x.kind, summary: x.summary, fields: x.diffs.filter((d) => d.field !== 'Via').map((d) => ({ field: d.field, from: d.from, to: d.to })), pastWeek: !!x.backfilled })),
    unchanged: cs.unchanged,
    examples: cs.examples,
    problems: errors.map((x) => ({ sheet: x.sheet, row: x.row, goal: x.name, kind: x.kind, message: x.message })),
    must_fix: cs.groups.filter((g) => g.level === 'must').map(group),
    check: checks.map(group),
    notes: notes.map((x) => ({ goal: x.name, message: x.message })),
    leftOut: cs.leftOut,
    needsReason: cs.needsReason,
    questions: cs.items.filter((x) => x.question).map((x) => ({ goalId: x.goalId, goal: x.goal, question: x.question!.text })),
    needsConfirm: cs.needsConfirm,
  };
  const lines = (l: { goal: string; message: string }[]) => l.map((x) => `- ${x.goal ? x.goal + ': ' : ''}${x.message}`).join('\n');
  if (errors.length) return { isError: true, data, text: `Not saved. Fix these and try again:\n${lines(errors.map((x) => ({ goal: x.name, message: x.message })))}` };
  if (cs.needsReason) return { isError: true, data, text: 'Not saved: check-ins have started on this goal, so a plan change needs a reason. Ask the person why, then call again with "reason".' };
  if (cs.needsConfirm) return { isError: true, data, text: `Not saved: check this with the person first.\n${lines(data.questions.map((x) => ({ goal: x.goal, message: x.question })))}\nIf they say it's right, call again with "confirm": true.` };
  if (checks.length) return { isError: true, data, text: `Not saved: answer ${checks.length === 1 ? 'this question' : `these ${checks.length} questions`} with the person first, then call again with "answers" ({"<id>": "<choice>"}). One answer covers every row it names.\n${checks.map((g) => `- ${g.title} (${g.where}) [id ${g.id}]: ${g.answers.map((a) => `"${a.choice}"${a.needsValue ? ' with a value' : ''} = ${a.label}`).join('; ')}`).join('\n')}` };
  // Example rows (Action says Example) are said wherever a file comes in, not only on Import (review of #130).
  const examples = cs.examples ? ` ${examplesLine(cs.examples)}` : '';
  if (!cs.items.length) return { data, text: `Nothing to change: it already says that.${examples}` };
  const what = `${describe(cs)}.${notes.length ? `\nRead as:\n${lines(notes.map((x) => ({ goal: x.name, message: x.message })))}` : ''}${cs.leftOut.length ? `\nLeft out at the person's answer: ${cs.leftOut.length} row(s).` : ''}${examples ? `\n${examples.trim()}` : ''}`;
  if (opts.dry || !cs.commit) return { data, text: `Checked, not saved (dry run). Would save: ${what}` };
  await ctx.save(cs.commit);
  return { data: { ...data, saved: true }, text: `Saved as ${ctx.actor.name}: ${what}` };
}

/** A goal by its ID or its key (G-12). */
const goalRef = (ctx: McpContext, id: unknown) => {
  const g = findGoal(ctx.snapshot.goals, String(id ?? ''));
  if (!g) throw new Error(`There's no goal with ${isKey(String(id ?? '')) ? 'key' : 'ID'} ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs and keys.`);
  return g;
};

/** Every page of a search's answer, in order. A near miss isn't what was asked for, so it finds nothing here. */
async function allPages(search: Search, kind: string, ask: SearchAsk): Promise<FoundRow[]> {
  const out: FoundRow[] = [];
  let after: string | null = null;
  do { const a = await search.search(kind, { ...ask, size: 200, after }); if (a.near) return []; out.push(...a.rows); after = a.next; } while (after);
  return out;
}

const GOAL_FIELDS = {
  title: str('The goal’s name.'),
  owner: str('The owner’s full name, as in the workspace (when only one person has it; owner_email is exact).'),
  owner_email: str('The owner’s email: exact, even where two people share a name.'),
  team: str('The team’s name.'),
  level: str('How important it is for reporting.', { enum: LEVELS.map((l) => LEVEL_WORDS.word[l] ?? l) }),
  unit: str('Number goals: the unit, e.g. "%", "days", "USD".'),
  decimals: int('Number goals: decimal places, 0 to 3.'),
  start: num('Move-a-number goals: where it starts.'),
  target: num('Move-a-number goals: the target.'),
  plan_shape: str('Move-a-number goals: how the plan moves from start to target.', { enum: ['straight', 'back-loaded', 'stepped'] }),
  due_week: int('Move-a-number goals: the week the target is due, from the cycle start (weeks beyond the cycle run into the next one, up to 104).'),
  limit: num('Keep-in-range goals: the limit.'),
  must_stay: str('Keep-in-range goals: which side of the limit is good.', { enum: ['at most', 'at least'] }),
  margin: num('Keep-in-range goals: how close to the limit counts as at risk.'),
  stages: { type: 'array', items: { type: 'string' }, description: 'Milestone goals: each stage as "Name@week", e.g. "Pilot@6".' },
  feeds_into_id: str('The ID or key (G-12) of the goal this one feeds. Empty string to unlink.'),
  why_it_helps: str('Why we expect it to help the goal it feeds.'),
  source: str('Where the number comes from.'),
  definition: str('Exactly what is counted.'),
};
const GOAL_COLS: Record<string, string> = { title: 'goal', owner: 'owner', owner_email: 'owner email', team: 'team', level: 'level', unit: 'unit', decimals: 'decimals', start: 'start', target: 'target', plan_shape: 'plan', due_week: 'due week', limit: 'limit', must_stay: 'must stay', margin: 'margin', stages: 'stages', feeds_into_id: 'feeds into id', why_it_helps: 'why it helps', source: 'source', definition: 'definition' };


const CORE_TOOLS: ToolDef[] = [
  {
    name: 'get_overview',
    title: 'Overview of the goals',
    description: 'A short brief of every goal in the current cycle: what needs attention and why, every goal by what it feeds, open questions and actions, and each goal’s weekly numbers. Start here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(_a, ctx) {
      const who = `You are acting as ${ctx.actor.name}${ctx.actor.admin ? ' (an admin: can change any goal)' : ' (can change the goals they own)'} in ${ctx.ws.name}.`;
      return { text: who + '\n\n' + aiBrief({ ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today }) };
    },
  },
  {
    name: 'find_goals',
    title: 'Find goals',
    description: `List goals in the current cycle with their key (G-12), ID, status (the words people see, with the code: “${statusWords('off')}”), latest number, this week’s plan, target and gap. Filter by whose goals they are (scope: mine, team, watching or all, as the Goals screen’s tabs), words in the name or a key, owner, status or level, or only the goals on the ${ATTENTION.needs.label} list (${ATTENTION.needs.meaning.replace(/\.$/, '').toLowerCase()}, then those ${ATTENTION.handled.label.toLowerCase()} below them, marked: the same rule as Home, Watching and reviews); or pass the query of a shared Goals link, or the name of a saved view, for every filter and sort the Goals screen has. A goal’s key and its ID both work wherever a tool asks for a goal.`,
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      text: str('Words on the goal’s row (its name, key, owner, team, level, status, reason or definition), each the start of a word; or its key (G-12).'),
      owner: str('Part of the owner’s name.'),
      status: str(`Only goals with this status: the words or the code, any of ${choices(STATUS, STATUSES)}.`),
      needs_attention: bool(`Only the goals on the ${ATTENTION.needs.label} list: those that need attention first, then those ${ATTENTION.handled.label.toLowerCase()} (beingHandled says how), as the Goals screen lists them. ${ATTENTION.needs.long}`),
      level: str('Only goals at this level.', { enum: LEVELS }),
      mine: bool('Only goals you own (the same as scope "mine").'),
      scope: str('Whose goals, as the Goals screen’s tabs have them: mine (goals you own), team (your team’s and the teams you lead), watching (goals you watch, directly or through a tree or a level) or all (the default). A scope you don’t have (team when you’re in no team and lead none, mine when you own none) finds no goals and says why.', { enum: SCOPES }),
      query: str(`A Goals link’s query string, e.g. "status=off,risk&attention=1&needs=decision&due=quarter&sort=gap". Keys: q, status (${choices(STATUS, STATUSES)}), level (north-star, svp, team), team and owner (IDs), kind (metric, range, milestone), attention (1: the ${ATTENTION.needs.label} list, those ${ATTENTION.handled.label.toLowerCase()} below the rest), needs (because: ${NEED_OPTIONS.map(([k, l]) => `${l} (${k})`).join(', ')}), due (quarter or a week), quiet (no update for this many weeks), qtr (${choices(QUARTER, ['met', 'missed'])}), result (${choices(RESULT)}), feeds (a goal ID: its tree), helps (1), sort (worst, title, owner, team, level, gap, last, due; add .desc to reverse).`),
      view: str('The name of a saved view: one of yours, or one pinned for everyone.'),
    } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      let query = a.query ? parseQuery(new URLSearchParams(String(a.query).replace(/^.*\?/, ''))) : EMPTY_QUERY;
      if (a.view) {
        const v = (ctx.snapshot.views ?? []).find((x) => !x.deletedAt && !isTableView(x) && (x.pinned || x.personId === ctx.actor.id) && x.name.toLowerCase() === String(a.view).toLowerCase());
        if (!v) throw new Error(`There’s no saved view called “${String(a.view)}” that you can see.`);
        query = parseQuery(new URLSearchParams(v.params));
      }
      // Every argument becomes the Goals link it means, and the goals are found through the Search port, as the
      // screens find them (docs/design/architecture.md, 1.1): one search, one set of filters.
      const status = a.status ? statusIn(a.status) : null;
      const named = a.owner ? ctx.snapshot.people.filter((p) => p.name.toLowerCase().includes(String(a.owner).toLowerCase())).map((p) => p.id) : null;
      const owners = [query.owner.length ? query.owner : null, named, a.mine ? [ctx.actor.id] : null].filter((x): x is string[] => !!x)
        .reduce<string[] | null>((acc, x) => (acc ? acc.filter((id) => x.includes(id)) : x), null);
      const asked: GoalQuery = {
        ...query,
        q: '',
        status: status ? (query.status.length ? query.status.filter((x) => x === status) : [status]) : query.status,
        level: a.level ? (query.level.length ? query.level.filter((x) => x === a.level) : [a.level as Level]) : query.level,
        owner: owners ? (owners.length ? owners : ['nobody']) : [],
        attention: query.attention || !!a.needs_attention,
      };
      // An argument narrows the link: where the two don't overlap, no goal can match (an empty list would mean "any").
      if ((status && !asked.status.length) || (a.level && !asked.level.length)) return { data: { week: ctx.week, weeks: ctx.cycle.weeks, goals: [] }, text: 'No goals match.' };
      // Whose goals (goals spec, rule 1): the scope's goals, from the same rule as the Goals screen's tabs.
      const scope = a.scope ? String(a.scope) as Scope : null;
      if (scope && !SCOPES.includes(scope)) throw new Error(`There’s no scope “${scope}”: use mine, team, watching or all.`);
      const scoped = scope && scope !== 'all' ? scopesFor(scopeFacts(ctx.snapshot, ctx.actor), null).tabs.find((t) => t.id === scope) : null;
      if (scope && scope !== 'all' && !scoped) return { data: { week: ctx.week, weeks: ctx.cycle.weeks, goals: [] }, text: scope === 'team' ? 'No goals match: you’re in no team and lead none.' : 'No goals match: you own no goals this year.' };
      const inScope = scoped ? new Set(scoped.ids) : null;
      const words = [String(a.text ?? ''), query.q].filter((x) => x.trim()).join(' ');
      const rows = searchRows(ctx.snapshot, ctx.cycle, ctx.today, ctx.week);
      const found = await allPages(localSearch(rows), 'goal', { q: words, filters: Object.fromEntries(queryEntries({ ...asked, sort: null })), sort: asked.sort ? asked.sort + (asked.dir === -1 ? '.desc' : '') : null });
      const byId = new Map(rows.goal!().summaries.map((s) => [s.goal.id, s]));
      let list = found.map((r) => byId.get(r.id)!).filter((x) => x && (!inScope || inScope.has(x.goal.id)));
      // The list, as the screen has it (Lane, 9 Nov): those that need attention, then those being handled.
      if (asked.attention || asked.needs.length) list = [...list.filter((s) => attentionGroup(s.attention) !== 'handled'), ...list.filter((s) => attentionGroup(s.attention) === 'handled')];
      const data = list.map((s) => ({ key: s.goal.key ?? null, id: s.goal.id, title: s.goal.title, type: s.goal.kind, level: s.goal.level, owner: s.owner, team: s.team, status: s.status, statusLabel: LABEL[s.status], needsAttention: needsAttention(s.attention), beingHandled: s.attention.handled?.text ?? null, lookedAt: s.attention.lookedAt?.text ?? null, because: s.attention.flags.filter((f) => f.kind !== 'due').map((f) => withCode({ label: f.label, code: f.kind })), now: s.now, planThisWeek: s.planNow != null ? s.planNowText : null, target: s.target, gap: s.gap, lastCheckInWeek: s.lastWeek, feedsInto: s.feedsInto, youCanChange: ctx.actor.admin || s.goal.ownerId === ctx.actor.id }));
      return { data: { week: ctx.week, weeks: ctx.cycle.weeks, goals: data }, text: data.length ? data.map((g) => `${g.key ? g.key + ' · ' : ''}${g.id} · ${g.title} · ${g.owner} · ${statusWords(g.status)} · now ${g.now}${g.planThisWeek ? `, plan ${g.planThisWeek}` : ''} · ${g.gap}${g.needsAttention ? ` · ${ATTENTION.needs.label.toLowerCase()}: ${g.because.join(', ')}` : g.beingHandled ? ` · ${ATTENTION.handled.label.toLowerCase()}: ${g.beingHandled}` : ''}`).join('\n') : 'No goals match.' };
    },
  },
  {
    name: 'get_goal',
    title: 'One goal in full',
    description: 'Everything about one goal: its scorecard as the goal’s page shows it (vs plan, vs last week, to target, and whether it will hit the target), its plan by week, every check-in with the owner’s reasons, notes, questions and actions from reviews, and its comments (with their IDs, for edit_comment and delete_comment).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key (e.g. G-12), from find_goals.') } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      const j = toJson({ ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today, goals: [g] });
      // The goal page's scorecard, in its words: vs plan, vs last week, to target and will it hit (domain/scorecard).
      const stale = goalStatus(g, ctx.cycle, ctx.snapshot.checkIns, ctx.today).status === 'stale';
      const scorecard = goalScorecard(g, ctx.cycle, ctx.snapshot.checkIns, ctx.week, stale).cells.map((c) => ({ label: c.label, value: c.value, detail: c.sub }));
      // Comments as they read now: edited ones say so, and a removed one is only its place in the thread.
      const comments = [...commentsOf(ctx.snapshot.changes).values()].filter((k) => k.goalId === g.id).map((k) => ({ id: k.id, by: ctx.snapshot.people.find((p) => p.id === k.authorId)?.name ?? (ctx.full ?? ctx.snapshot).people.find((p) => p.id === k.authorId)?.name ?? '—', at: k.at, text: k.removedAt ? COMMENT_REMOVED : k.text, edited: !!k.editedAt, removed: !!k.removedAt }));
      const data = { cycle: j.cycle, goal: j.goals[0], scorecard, notes: j.notes, comments };
      return { data, text: JSON.stringify(data, null, 2) };
    },
  },
  {
    name: 'post_check_in',
    title: 'Post a check-in',
    description: 'Post the number (or stages) for one goal for a week: this week by default, or an earlier week to fill in history. The same rules as the app apply: behind or ahead of plan needs a cause and a why; at risk or off track needs a path to green. Only the goal’s owner or an admin can post. Posting again for the same week corrects that week’s check-in (the log keeps both).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: {
      goal_id: str('The goal’s ID or its key, e.g. G-12.'),
      week: int('The week, counted from the cycle start. Defaults to this week. Earlier weeks are marked as loaded later.'),
      value: num('Number goals: the value for the week.'),
      stages: str('Milestone goals: e.g. "Pilot: done week 6; Rollout: expected week 9".'),
      call: str(`The owner’s status call, in the words or the code: ${choices(STATUS, CALLS)}. Leave out to let the rules decide.`),
      cause: str('Why it’s behind or ahead.', { enum: ['Plan too aggressive', 'Delivery slower', 'Blocked by a dependency', 'External factor', 'Data problem', 'Plan too cautious', 'Change landed early', 'One-off, won’t last'] }),
      why: str('In a sentence (10 characters or more).'),
      why_greener: str(`If the call is ${FLAG.greener.label.toLowerCase()}: why.`),
      path_to_green: str('How it gets back on plan.'),
      recovery: str('Where the owner is with recovery.', { enum: ['Plan', 'Still investigating', 'Needs a decision or help', 'Target should change'] }),
      back_on_plan_by_week: int('With a plan: the week it is back on plan by.'),
      needs: str('A decision or help needed, and from whom.'),
      next_step: str('The next step.'),
      answers: ANSWERS_ARG,
      dry_run: DRY,
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      const r = row({ ...a, goal_id: g.id, week: a.week ?? ctx.week, call: a.call == null || a.call === '' ? undefined : statusIn(a.call, CALLS) }, { goal_id: 'goal id', week: 'week', value: 'value', stages: 'stages', call: 'call', cause: 'cause', why: 'why', why_greener: 'why greener', path_to_green: 'path to green', recovery: 'recovery', back_on_plan_by_week: 'back on plan by week', needs: 'needs', next_step: 'next step' });
      return change(ctx, { checkIns: [r] }, { dry: !!a.dry_run, answers: a.answers });
    },
  },
  {
    name: 'update_goal',
    title: 'Change a goal',
    description: 'Change a goal’s details or plan. Only the fields you give change. A plan change (start, target, shape, due week, limit, stages) after check-ins have started needs a reason, which is logged with the old and new plan. One that flips which way is better, or puts a number far outside the old plan, is checked with the person first (confirm: true).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.'), ...GOAL_FIELDS, reason: str('Why the plan is changing.'), confirm: CONFIRM, answers: ANSWERS_ARG, dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      return change(ctx, { goals: [row({ ...a, goal_id: g.id }, { goal_id: 'id', ...GOAL_COLS })] }, { dry: !!a.dry_run, reason: a.reason as string | undefined, confirm: a.confirm === true, answers: a.answers });
    },
  },
  {
    name: 'create_goal',
    title: 'Add a goal',
    description: 'Add a goal to the current cycle. Type "metric" moves a number from start to target; "range" keeps a number inside a limit; "milestone" hits dated stages. You can add goals you own; admins can add goals for anyone. Give a unit for a number (none is asked about, as is a name another goal in its team has).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['title', 'type'], properties: { type: str('What kind of goal.', { enum: ['metric', 'range', 'milestone'] }), ...GOAL_FIELDS, answers: ANSWERS_ARG, dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      return change(ctx, { goals: [row({ owner: ctx.actor.name, ...a }, { type: 'type', ...GOAL_COLS })] }, { dry: !!a.dry_run, answers: a.answers });
    },
  },
  {
    name: 'set_plan_numbers',
    title: 'Set plan numbers by hand',
    description: 'Set a number goal’s planned value for particular weeks; the plan then runs straight between them. Setting the due week’s number changes the target. Needs a reason once check-ins have started, and confirm: true when a number is far outside the old plan or flips which way is better.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'numbers'], properties: {
      goal_id: str('The goal’s ID or its key, e.g. G-12.'),
      numbers: { type: 'array', description: 'Planned values by week.', items: { type: 'object', required: ['week', 'value'], properties: { week: int('Week from the cycle start.'), value: num('Planned value.') } } },
      reason: str('Why the plan is changing.'), confirm: CONFIRM, dry_run: DRY,
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const r: Rec = { __row: '1', id: goalRef(ctx, a.goal_id).id };
      for (const p of (a.numbers as { week: number; value: number }[]) ?? []) r[`week ${p.week}`] = String(p.value);
      return change(ctx, { plan: [r] }, { dry: !!a.dry_run, reason: a.reason as string | undefined, confirm: a.confirm === true });
    },
  },
  {
    name: 'add_comment',
    title: 'Comment on a goal',
    description: 'Add a comment to a goal’s history. Anyone can comment; it doesn’t change the status.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'text'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.'), text: str('The comment.') } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      const c = addNote({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId }, g, String(a.text ?? ''));
      await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA_MCP] })) });
      return { text: `Comment added to ${g.title} as ${ctx.actor.name}.` };
    },
  },
  {
    name: 'bulk_change',
    title: 'Change many goals at once',
    description: `Add or change many people, goals, plan numbers and check-ins in one go, using the same columns as the spreadsheet export and export_table (e.g. goals: [{"Key": "G-12", "Target": 90}], check_ins: [{"Goal key": "G-12", "Week": 3, "Value": 41}], plan: [{"Key": "G-12", "Week 5": 45}], people: [{"Email": "ana@example.com", "Job title": "Staff engineer"}]). A goal is found by its Key, then its ID (a key works wherever an ID does: Goal key, Feeds into key, Feeds into ID); a person by Email, then a name only one person has (Owner email is exact). Columns a row leaves out stay as they are; worked-out columns (Status, Calculated…) are ignored. An Action column does what the app does: ${GOAL_ACTION_WORDS.word.stop} (with a Reason) or ${GOAL_ACTION_WORDS.word.delete} on a goal, ${PERSON_ACTION_WORDS.word.left} (with Takes over, by email) on a person. Checks every row and returns what would change, and every problem by kind: must_fix (fix the rows) and check (questions: ask the person, then call again with "answers" by group id; one answer covers every row in its group); nothing is saved unless "apply" is true and every row is valid, and it can be undone (undo_import).`,
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      goals: { type: 'array', items: { type: 'object' }, description: 'Rows for the Goals sheet. Key (or ID) to change a goal; neither to add one.' },
      plan: { type: 'array', items: { type: 'object' }, description: 'Rows for the Plan sheet: Key (or ID), Start and "Week N" columns.' },
      check_ins: { type: 'array', items: { type: 'object' }, description: 'Rows for the Check-ins sheet: Goal key (or Goal ID), Week, Value or Stages, Call, Cause, Why, Why greener, Path to green, Recovery, Back on plan by week, Needs, Next step; ID to correct one check-in.' },
      people: { type: 'array', items: { type: 'object' }, description: 'Rows for the People sheet (admins): Email (or ID) to change someone; a new Email, Name and Team to add someone; Action and Takes over to mark someone as left.' },
      reason: str('Why plans are changing, for any plan change that needs one.'),
      confirm: CONFIRM,
      answers: ANSWERS_ARG,
      apply: bool('Save the changes. Leave out first to check them.'),
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      return change(ctx, { goals: rows(a.goals, 'goals'), plan: rows(a.plan, 'plan'), checkIns: rows(a.check_ins, 'check_ins'), people: rows(a.people, 'people') }, { dry: !a.apply, reason: a.reason as string | undefined, confirm: a.confirm === true, answers: a.answers });
    },
  },
];

/** Which feature module each module tool is from (src/modules/<id>/tools.ts). */
const TOOL_MODULE = new Map(MODULE_TOOLS.flatMap((m) => m.part.map((t) => [t.name, m.id] as const)));

/** Everything a person can do in the app, their assistant can do here: reading, check-ins, goals and plans above;
    requests, reviews, watching, people, wrap-ups, views, tokens and feedback in workTools.ts; then each feature
    module's own (the spreadsheets module's export and export_table). */
export const TOOLS: ToolDef[] = [...CORE_TOOLS, ...WORK_TOOLS, ...REMOVE_TOOLS, ...MARKUP_TOOLS, ...FEEDBACK_TOOLS, ...MODULE_TOOLS.flatMap((m) => m.part)];

/** Runs a tool by name. Errors in the arguments come back as a tool error the assistant can read and fix. A module's
    tool in a workspace that has switched that module off says so, and does nothing. */
export async function callTool(name: string, args: Record<string, unknown>, ctx: McpContext): Promise<ToolResult> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { isError: true, text: `There's no tool called ${name}.` };
  const from = TOOL_MODULE.get(name);
  if (from && !isModuleOn(ctx.ws, from)) return { isError: true, text: `${moduleById(from)?.name ?? from} is switched off in ${ctx.ws.name}, so ${name} can't be used there. An admin can switch it on in Workspace, under Features.` };
  try {
    return await t.run(args ?? {}, ctx);
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    // A refusal says who the token acts as, so an assistant (and the person reading) can tell "the rule says no" from "this
    // token is someone else's" (backlog N: a token made for a non-admin was taken for an admin's).
    return { isError: true, text: e instanceof NotAllowed ? `${text} ${actingAs(ctx.actor)}` : text, cause: e };
  }
}

/** Who a token acts as, in a sentence: said with every refusal. */
export const actingAs = (p: { name: string; admin: boolean }) => `This token acts as ${p.name}, who ${p.admin ? 'is an admin' : 'isn’t an admin'}.`;
