/* The MCP tools: what an AI assistant can read and change, acting as one person through their personal token.
   Every write goes through the bulk-change engine, so it meets the same rules as the app (owners change their own
   goals, admins any; reasons when behind; a reason for plan changes) and is logged as that person, via MCP. */
import { moduleOffSentence } from './moduleOff';
import type { HistoryAsk, HistoryPage } from '../ports/store';
import { LEVEL_WORDS, levelIds } from '../domain/levels';
import { addNote, NotAllowed } from '../domain/actions';
import { EMPTY_QUERY, parseQuery, queryEntries, type GoalQuery } from '../domain/query';
import { reviewsOn, reviewWriteRows, scopeFacts, searchRows, watchingOn } from '../app/reads';
import { scopesFor, SCOPES, type Scope } from '../domain/goalsPage';
import { localSearch } from '../adapters/localSearch';
import type { FoundRow, Search, SearchAsk } from '../ports/search';
import type { Commit } from '../data/store';
import { describe, examplesLine, GOAL_QUESTION, MIN_CORRECT_REASON, planChanges, VIA_MCP, type Answers, type ChangeInput, type ChangeSet, type Rec, type Tables } from '../domain/changeset';
import { tooLarge, tooManyChanges } from '../domain/importLimits';
import { aiBrief, toJson } from '../domain/export';
import { GOAL_ACTION_WORDS, PERSON_ACTION_WORDS } from '../domain/columns';
import { goalScorecard } from '../domain/scorecard';
import { goalStatus } from '../domain/status';
import { attentionGroup, needsAttention } from '../domain/attention';
import { ATTENTION, choices, codeFrom, COMMENT_REMOVED, FLAG, QUARTER, RESULT, STATUS, STOPPED, withCode } from '../domain/vocabulary';
import { watchedGoals } from '../domain/review';
import { NEED_OPTIONS } from '../domain/query';
import { WORK_TOOLS } from './workTools';
import { listed } from './listed';
import type { MarkupOps } from '../markup/ops';
import type { FeedbackOps } from '../markup/feedback';
import { REMOVE_TOOLS } from './removeTools';
import MODULE_TOOLS from 'virtual:faro-modules/tools';
import { isModuleOn, moduleById, modulesOn } from '../core/registry';
import { writesReviews } from '../domain/reviewWrites';
import { MODULE_GOAL_COLUMNS, recordsOn } from '../core/records';
import { addColumnParams } from '../domain/query';
import { commentsOf } from '../domain/removal';
import { findGoal, isKey } from '../domain/goalKey';
import { isProposed, withProposed } from '../domain/proposed';
import { activate, backToProposed } from '../domain/proposedActions';
import { proposedSummary } from '../domain/proposedSummary';
import { activeReadBack } from '../domain/readBack';
import { readWeekCode } from '../domain/weeks';
import { isTableView } from '../domain/tableLayout';
import { moment, momentText } from '../domain/habit';
import type { Cycle, DisplayStatus, Goal, Level, Person, ReadingWhyKind, Snapshot } from '../domain/types';
import { checkInReaders } from './checkInReaders';

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
  /** Older change-log entries a page at a time, newest first (Store.history). Without it, get_activity reads the snapshot. */
  history?(ask: HistoryAsk): Promise<HistoryPage>;
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
/** A range between two numbers as the Goals sheet says it: both in Limit (99.5–99.95), the same rule as an import. A
    lower bound given alone keeps the goal's own upper one. */
function withLower(a: Record<string, unknown>, was?: Goal): Record<string, unknown> {
  if (a.lower == null) return a;
  const upper = a.limit ?? (was?.kind === 'range' ? was.range.limit : undefined);
  if (upper == null) throw new Error('A range between two numbers needs limit, the upper number, as well as lower.');
  return { ...a, limit: `${a.lower}–${upper}`, must_stay: 'between' };
}

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
const CONFIRM = bool('True once the person has said yes to every question a goal was asked (Check: a number that looks unlikely, no unit, a link to a lower level, a plan change that flips which way is better or is far outside the old plan).');


/** Answers to the questions a change asked, by group id: "use", or { "choice": "choose", "value": "Platform" }. */
const ANSWERS_ARG = { type: 'object', additionalProperties: { anyOf: [{ type: 'string' }, { type: 'object', properties: { choice: { type: 'string' }, value: { type: 'string' } }, required: ['choice'] }] }, description: 'Answers to the questions (Check) a dry run asked, by the group id it gave: {"<id>": "<choice>"} or {"<id>": {"choice": "choose", "value": "Platform"}}. One answer covers every row in its group. Ask the person; never answer for them.' };
/** The answers argument, as the engine takes them. */
const answersOf = (a: unknown): Answers => Object.fromEntries(Object.entries((a ?? {}) as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? { choice: v } : { choice: String((v as { choice?: unknown }).choice ?? ''), ...((v as { value?: unknown }).value != null ? { value: String((v as { value: unknown }).value) } : {}) }]));

/** find_goals' page: how many goals it lists unless asked, and the most it lists at once. */
const FIND_PAGE = 50, FIND_MAX = 200;

async function change(ctx: McpContext, tables: Tables, opts: { dry?: boolean; reason?: string; confirm?: boolean; answers?: unknown; readings?: ChangeInput['readings']; saved?: (cs: ChangeSet, before: McpContext['snapshot']) => { data: Record<string, unknown>; text: string } | null }): Promise<ToolResult> {
  // The size limits every door keeps (domain/importLimits): rows read in one call, then changes saved at once.
  const big = tooLarge('This call', { rows: (tables.goals?.length ?? 0) + (tables.plan?.length ?? 0) + (tables.checkIns?.length ?? 0) + (tables.people?.length ?? 0) }, 'call');
  if (big) return { isError: true, text: `Not checked. ${big}` };
  // A goal's key: as saved once it is, as the change gives it before (a dry run's key is the one it would get).
  const keyOf = (id: string): string | null => (ctx.snapshot.goals.find((g) => g.id === id) ?? cs.commit?.goals?.find((g) => g.id === id))?.key ?? null;
  const cs: ChangeSet = planChanges({ tables, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, via: 'mcp', reason: opts.reason, confirm: opts.confirm, answers: answersOf(opts.answers), records: recordsOn(ctx.ws), ...(opts.readings?.length ? { readings: opts.readings } : {}) });
  // Every problem has a kind and a level (domain/problemLevels): Must fix, Check (a question), or how a row was read.
  const errors = cs.issues.filter((x) => x.level === 'must');
  // Goal entry's questions (rule 3) are listed goal by goal and answered by "confirm"; the import's other questions by
  // "answers", one per group.
  const checks = cs.groups.filter((g) => g.level === 'check' && !(GOAL_QUESTION.includes(g.kind) && g.sheet !== 'Check-ins'));
  const notes = cs.issues.filter((x) => x.level === 'note');
  const group = (g: ChangeSet['groups'][number]) => ({ id: g.id, kind: g.kind, sheet: g.sheet, column: g.column ?? null, found: g.found ?? null, rows: g.count, firstRows: g.rows.slice(0, 20), sentence: g.title, example: g.example, answers: g.answers.map((a) => ({ choice: a.choice, label: a.label, ...(a.needsValue ? { needsValue: true } : {}), ...(a.options ? { options: a.options } : {}) })) });
  const data = {
    saved: false,
    summary: describe(cs),
    // Every goal a change is to, by its ID and key: a new goal's key is the one it is given (MCP load, 12 Nov).
    changes: cs.items.map((x) => ({ goalId: x.goalId as string | null, ...(x.goalId ? { key: keyOf(x.goalId) } : {}), goal: x.goal, kind: x.kind, summary: x.summary, fields: x.diffs.filter((d) => d.field !== 'Via').map((d) => ({ field: d.field, from: d.from, to: d.to })), pastWeek: !!x.backfilled })),
    unchanged: cs.unchanged,
    examples: cs.examples,
    problems: errors.map((x) => ({ sheet: x.sheet, row: x.row, goal: x.name, kind: x.kind, message: x.message })),
    must_fix: cs.groups.filter((g) => g.level === 'must').map(group),
    check: checks.map(group),
    notes: notes.map((x) => ({ goal: x.name, message: x.message })),
    leftOut: cs.leftOut,
    needsReason: cs.needsReason,
    questions: cs.items.flatMap((x) => (x.questions ?? []).map((q) => ({ goalId: x.goalId, goal: x.goal, id: q.id, field: q.field, question: q.text }))),
    needsConfirm: cs.needsConfirm,
    /** The goals the change adds: each one's ID and key, to use straight away (feeds_into_id, post_check_in, Goal key).
        Saved: as stored. A dry run: the key each would be given and no ID yet (the save makes the IDs). Refused: none. */
    created: [] as { id: string | null; key: string | null; title: string }[],
  };
  const added = cs.items.filter((x) => x.kind === 'new goal');
  const createdLine = () => (data.created.length ? `\nNew ${data.created.length === 1 ? 'goal' : 'goals'}: ${data.created.map((x) => [x.key ?? '—', x.id, x.title].filter(Boolean).join(' · ')).join('; ')}.${data.saved ? '' : ' Each gets its ID when it is saved; a key is kept unless another goal takes it first.'}` : '');
  const lines = (l: { goal: string; message: string }[]) => l.map((x) => `- ${x.goal ? x.goal + ': ' : ''}${x.message}`).join('\n');
  if (errors.length) return { isError: true, data, text: `Not saved. Must fix:\n${lines(errors.map((x) => ({ goal: x.name, message: x.message })))}` };
  if (cs.needsReason) {
    // A plan change once check-ins have started, or a week's check-in replaced (a correction, as on screen): each says why.
    const why = [cs.items.some((x) => x.needsReason && x.kind !== 'replaces check-in') && 'check-ins have started, so a plan change needs a reason', cs.items.some((x) => x.needsReason && x.kind === 'replaces check-in') && `changing a week’s check-in corrects it, which needs a reason of at least ${MIN_CORRECT_REASON} characters`].filter(Boolean).join('; and ');
    return { isError: true, data, text: `Not saved: ${why}. Ask the person why, then call again with "reason".` };
  }
  // Questions the person must answer: goal entry's, then any of the import's, each with how to answer it.
  const asked = data.questions.length ? `Not saved. Check with the person first:\n${lines(data.questions.map((x) => ({ goal: x.goal, message: x.question })))}\nIf they say yes to each, call again with "confirm": true.` : '';
  if (asked && !checks.length) return { isError: true, data, text: asked };
  if (checks.length) return { isError: true, data, text: `${asked ? asked + '\n' : ''}Not saved: answer ${checks.length === 1 ? 'this question' : `these ${checks.length} questions`} with the person first, then call again with "answers" ({"<id>": "<choice>"}). One answer covers every row it names.\n${checks.map((g) => `- ${g.title} (${g.where}) [id ${g.id}]: ${g.answers.map((a) => `"${a.choice}"${a.needsValue ? ' with a value' : ''} = ${a.label}`).join('; ')}`).join('\n')}` };
  // Example rows (Action says Example) are said wherever a file comes in, not only on Import (review of #130).
  const examples = cs.examples ? ` ${examplesLine(cs.examples)}` : '';
  if (!cs.items.length) return { data, text: `Nothing to change: it already says that.${examples}` };
  const what = `${describe(cs)}.${notes.length ? `\nRead as:\n${lines(notes.map((x) => ({ goal: x.name, message: x.message })))}` : ''}${cs.leftOut.length ? `\nLeft out at the person's answer: ${cs.leftOut.length} row(s).` : ''}${examples ? `\n${examples.trim()}` : ''}`;
  const tooMany = tooManyChanges(cs.items.length);
  if (tooMany && !opts.dry) return { isError: true, data, text: `Not saved. ${tooMany} Send the rows in parts, a goal's plan and check-ins with it.` };
  if (opts.dry || !cs.commit) {
    data.created = added.map((x) => ({ id: null, key: keyOf(x.goalId), title: x.goal }));
    // A dry run's IDs are not the ones a save makes, so no new goal's ID is given before it exists (#242's review).
    data.changes = data.changes.map((x) => (added.some((a) => a.goalId === x.goalId) ? { ...x, goalId: null } : x));
    return { data, text: `Checked, not saved (dry run). Would save: ${what}${createdLine()}` };
  }
  const before = ctx.snapshot;
  await ctx.save(cs.commit);
  const extra = opts.saved?.(cs, before) ?? null;
  // Read back as saved: the server reads each new goal's key from the database after the save (Deps.goalKeys), so two
  // people adding goals at once never share one and the answer names the key the goal holds.
  data.saved = true;
  data.created = added.map((x) => ({ id: x.goalId, key: keyOf(x.goalId), title: x.goal }));
  data.changes = data.changes.map((x) => (x.goalId ? { ...x, key: keyOf(x.goalId) } : x));
  return { data: extra ? { ...data, ...extra.data } : data, text: `Saved as ${ctx.actor.name}: ${what}${createdLine()}${extra ? `\n${extra.text}` : ''}` };
}

/** A goal by its ID or its key (G-12). */
const goalRef = (ctx: McpContext, id: unknown) => {
  const g = findGoal(withProposed(ctx.snapshot), String(id ?? ''));
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
  from: str('Move-a-number goals: the week the baseline (start) was true and the plan starts, as a year and a week, e.g. "2026-W46". Left out: this week for a new goal.'),
  to: str('Move-a-number goals: the week the target is due, as a year and a week, e.g. "2027-W13": up to the last week of next year. Left out: the end of this goal year.'),
  due_week: int('Move-a-number goals: the week the target is due, counted from the cycle start (the older form of to; weeks beyond the cycle run into the next goal year).'),
  limit: num('Keep-in-range goals: the limit; for a range between two numbers, the upper one.'),
  lower: num('Keep-in-range goals between two numbers ("keep it between 99.5 and 99.95"): the lower one, below limit. Giving it makes must_stay "between".'),
  must_stay: str('Keep-in-range goals: which side of the limit is good, or between lower and limit.', { enum: ['at most', 'at least', 'between'] }),
  margin: num('Keep-in-range goals: how close to the limit counts as at risk.'),
  stages: { type: 'array', items: { type: 'string' }, description: 'Milestone goals: each stage as "Name@week", e.g. "Pilot@6".' },
  feeds_into_id: str('The ID or key (G-12) of the goal this one feeds. Empty string to unlink.'),
  why_it_helps: str('Why we expect it to help the goal it feeds.'),
  source: str('Where the number comes from.'),
  definition: str('Exactly what is counted.'),
  state: str('active (the default for a new goal) or proposed: a proposed goal is visible to everyone, has no status and nothing due, and needs no plan yet; its owner or an admin makes it active (make_goal_active). A goal with check-ins can’t go back to proposed.', { enum: ['active', 'proposed'] }),
};
const GOAL_COLS: Record<string, string> = { title: 'goal', owner: 'owner', owner_email: 'owner email', team: 'team', level: 'level', unit: 'unit', decimals: 'decimals', start: 'start', target: 'target', plan_shape: 'plan', from: 'from', to: 'to', due_week: 'due week', limit: 'limit', must_stay: 'must stay', margin: 'margin', stages: 'stages', feeds_into_id: 'feeds into id', why_it_helps: 'why it helps', source: 'source', definition: 'definition', state: 'state' };


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
    description: `List goals in the current cycle with their key (G-12), ID, status (the words people see, with the code: “${statusWords('off')}”), latest number, this week’s plan, target and gap. Filter by whose goals they are (scope: mine, team, watching or all, as the Goals screen’s tabs), words in the name or a key, owner, status or level, or only the goals on the ${ATTENTION.needs.label} list (${ATTENTION.needs.meaning.replace(/\.$/, '').toLowerCase()}, then those ${ATTENTION.handled.label.toLowerCase()} below them, marked: the same rule as Home, Watching and reviews); or pass the query of a shared Goals link, or the name of a saved view, for every filter and sort the Goals screen has. A goal’s key and its ID both work wherever a tool asks for a goal. Answers as JSON, the same keys every time: week, weeks, total (how many match), offset, goals (at most limit of them, 50 unless asked), more (how to ask for the next page, or null) and why (why nothing matches, or null).`,
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      text: str('Words on the goal’s row (its name, key, owner, team, level, status, reason or definition), each the start of a word; or its key (G-12).'),
      owner: str('Part of the owner’s name.'),
      status: str(`Only goals with this status: the words or the code, any of ${choices(STATUS, STATUSES)}.`),
      needs_attention: bool(`Only the goals on the ${ATTENTION.needs.label} list: those that need attention first, then those ${ATTENTION.handled.label.toLowerCase()} (beingHandled says how), as the Goals screen lists them. ${ATTENTION.needs.long}`),
      level: str('Only goals at this level.', { enum: LEVELS }),
      mine: bool('Only goals you own (the same as scope "mine").'),
      scope: str('Whose goals, as the Goals screen’s tabs have them: mine (goals you own), team (your team’s and the teams you lead), watching (goals you watch, directly or through a tree or a level) or all (the default). A scope you don’t have (team when you’re in no team and lead none, mine when you own none) finds no goals and says why.', { enum: SCOPES }),
      query: str(`A Goals link’s query string, e.g. "scope=mine&status=off,risk&attention=1&needs=decision&due=quarter&sort=gap". Keys: scope (as the scope argument, which wins if both are given), q, status (${choices(STATUS, STATUSES)}), level (north-star, svp, team), team and owner (IDs), kind (metric, range, milestone), attention (1: the ${ATTENTION.needs.label} list, those ${ATTENTION.handled.label.toLowerCase()} below the rest), needs (because: ${NEED_OPTIONS.map(([k, l]) => `${l} (${k})`).join(', ')}), due (quarter or a week), quiet (no update for this many weeks), qtr (${choices(QUARTER, ['met', 'missed'])}), result (${choices(RESULT)}), feeds (a goal ID: its tree), helps (1), checkedin (no: due this week with no check-in yet; asked: checked in after an ask for an update), inreview (a review’s ID: the goals it walks), sort (worst, title, owner, team, level, gap, last, due; add .desc to reverse).`),
      view: str('The name of a saved view: one of yours, or one pinned for everyone.'),
      state: str('active (the default), proposed or stopped: proposed goals have no status and are listed only when asked for; stopped lists the goals stopped this year, most recently stopped first, with who stopped each, when and why (the Goals screen’s State filter).', { enum: ['active', 'proposed', 'stopped'] }),
      limit: { type: 'integer', minimum: 1, maximum: FIND_MAX, description: `How many goals to list, from offset: ${FIND_PAGE} unless asked, at most ${FIND_MAX}.` },
      offset: { type: 'integer', minimum: 0, description: 'How many matching goals to skip, for the next page (as “more” says).' },
    } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      /** One page of what matched, in the one shape find_goals always answers in (#249's review: 126 goals were 81k
          characters, with no paging). */
      const goalPage = <T,>(all: T[], args: Record<string, unknown>, none: string) => {
        const limit = Math.min(FIND_MAX, Math.max(1, Math.floor(Number(args.limit) || FIND_PAGE)));
        const offset = Math.max(0, Math.floor(Number(args.offset) || 0));
        const goals = all.slice(offset, offset + limit);
        const next = offset + goals.length;
        return {
          week: ctx.week, weeks: ctx.cycle.weeks, total: all.length, offset, goals,
          more: next < all.length ? `${all.length - next} more: call again with offset ${next}${args.limit ? ` and limit ${limit}` : ''}.` : null,
          why: all.length ? null : none,
        };
      };
      const link = a.query ? new URLSearchParams(String(a.query).replace(/^.*\?/, '')) : null;
      let query = link ? parseQuery(link) : EMPTY_QUERY;
      // A Goals link (or a saved view) says whose goals with scope=, as the screen's address does (build review of #116).
      let linkScope = link?.get('scope') ?? null;
      if (a.view) {
        const v = (ctx.snapshot.views ?? []).find((x) => !x.deletedAt && !isTableView(x) && (x.pinned || x.personId === ctx.actor.id) && x.name.toLowerCase() === String(a.view).toLowerCase());
        if (!v) throw new Error(`There’s no saved view called “${String(a.view)}” that you can see.`);
        query = parseQuery(new URLSearchParams(v.params));
        linkScope = new URLSearchParams(v.params).get('scope');
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
      if ((status && !asked.status.length) || (a.level && !asked.level.length)) return listed(goalPage([], a, 'No goal can match both the filters asked for and the link’s.'));
      // Whose goals (goals spec, rule 1): the scope's goals, from the same rule as the Goals screen's tabs.
      // The scope argument wins over the link's.
      const scope = a.scope ? String(a.scope) as Scope : linkScope ? linkScope as Scope : null;
      if (scope && !SCOPES.includes(scope)) throw new Error(`There’s no scope “${scope}”: use mine, team, watching or all.`);
      const watchingHere = watchingOn(modulesOn(ctx.ws).on);
      const scoped = scope && scope !== 'all' ? scopesFor(scopeFacts(ctx.snapshot, ctx.actor), null, { watching: watchingHere }).tabs.find((t) => t.id === scope) : null;
      if (scope && scope !== 'all' && !scoped) return listed(goalPage([], a, scope === 'team' ? 'You’re in no team and lead none.' : scope === 'watching' ? `Watching is switched off in ${ctx.ws.name}. Leave the scope out to see every goal.` : 'You own no goals this year.'));
      const inScope = scoped ? new Set(scoped.ids) : null;
      const words = [String(a.text ?? ''), query.q].filter((x) => x.trim()).join(' ');
      const rows = searchRows(ctx.snapshot, ctx.cycle, ctx.today, ctx.week);
      const found = await allPages(localSearch(rows), 'goal', { q: words, filters: Object.fromEntries(queryEntries({ ...asked, sort: null })), sort: asked.sort ? asked.sort + (asked.dir === -1 ? '.desc' : '') : null });
      const byId = new Map(rows.goal!().summaries.map((s) => [s.goal.id, s]));
      // A module's column in the link (?metric=, Measured by): matched as Goals matches it (core/records goalColumns), and
      // like Goals, a switched-off module's column is no filter at all (module map F4).
      const cols = Object.entries(asked.cols ?? {}).flatMap(([k, v]) => { const c = MODULE_GOAL_COLUMNS.find((x) => x.param === k && isModuleOn(ctx.ws, x.module)); return c && v ? [{ fill: c.fill(ctx.full ?? ctx.snapshot), v }] : []; });
      // Proposed goals (GE10) are left out unless asked for, and then only they are listed; their scope is worked out as the
      // Goals screen's count line does, by owner or team.
      // Stopped goals (GE10's State filter): this year's, most recently stopped first, in the same scope.
      if (a.state === 'stopped') {
        const facts = scopeFacts(ctx.snapshot, ctx.actor);
        const stopped = (ctx.snapshot.archive?.goals ?? []).filter((g) => (scope === 'mine' ? g.ownerId === ctx.actor.id : scope === 'team' ? facts.teams.some((t) => t.id === g.teamId) : scope === 'watching' ? watchedGoals(ctx.actor.id, { ...ctx.snapshot, goals: [...ctx.snapshot.goals, g] }).some((w) => w.id === g.id) : true)
          && (!words.trim() || words.toLowerCase().split(/\s+/).every((w) => `${g.title} ${g.key ?? ''}`.toLowerCase().includes(w))))
          .sort((x, y) => (y.stoppedAt ?? '').localeCompare(x.stoppedAt ?? ''));
        const who = (id: string | null | undefined) => ctx.snapshot.people.find((p) => p.id === id)?.name ?? null;
        return listed(goalPage(stopped.map((g) => ({ key: g.key ?? null, id: g.id, title: g.title, type: g.kind, level: g.level, owner: who(g.ownerId), team: ctx.snapshot.teams.find((t) => t.id === g.teamId)?.name ?? null, status: null, statusLabel: STOPPED, state: 'stopped', stoppedAt: g.stoppedAt ?? null, stoppedBy: who(g.stoppedBy), stopReason: g.stopReason ?? null })), a, 'No stopped goals here.'));
      }
      const proposedOnly = a.state === 'proposed';
      const inScopeOf = (g: Goal) => (!inScope ? true : !isProposed(g) ? inScope.has(g.id) : scope === 'mine' ? g.ownerId === ctx.actor.id : scope === 'team' ? scopeFacts(ctx.snapshot, ctx.actor).teams.some((t) => t.id === g.teamId) : false);
      const wordsOf = (g: Goal) => `${g.title} ${g.key ?? ''}`.toLowerCase();
      let list = proposedOnly
        ? (ctx.snapshot.proposed ?? []).filter((g) => inScopeOf(g) && (!words.trim() || words.toLowerCase().split(/\s+/).every((w) => wordsOf(g).includes(w)))).map((g) => proposedSummary(g, ctx.snapshot, ctx.cycle, ctx.week))
        : found.map((r) => byId.get(r.id)!).filter((x) => x && !isProposed(x.goal) && inScopeOf(x.goal) && cols.every((c) => c.fill(x.goal) === c.v));
      // The list, as the screen has it (Lane, 9 Nov): those that need attention, then those being handled.
      if (asked.attention || asked.needs.length) list = [...list.filter((s) => attentionGroup(s.attention) !== 'handled'), ...list.filter((s) => attentionGroup(s.attention) === 'handled')];
      const data = list.map((s) => ({ key: s.goal.key ?? null, id: s.goal.id, title: s.goal.title, type: s.goal.kind, level: s.goal.level, owner: s.owner, team: s.team, status: s.state === 'proposed' ? null : s.status, statusLabel: s.statusLabel, state: s.state ?? 'active', needsAttention: needsAttention(s.attention), beingHandled: s.attention.handled?.text ?? null, lookedAt: s.attention.lookedAt?.text ?? null, because: s.attention.flags.filter((f) => f.kind !== 'due').map((f) => withCode({ label: f.label, code: f.kind })), now: s.now, planThisWeek: s.planNow != null ? s.planNowText : null, target: s.target, gap: s.gap, lastCheckInWeek: s.lastWeek, feedsInto: s.feedsInto, youCanChange: ctx.actor.admin || s.goal.ownerId === ctx.actor.id }));
      // The same shape every time, filtered or not (MCP load, 12 Nov): the list as JSON, as structured content and as text.
      return listed(goalPage(data, a, 'No goal matches. Try fewer or plainer words, or another scope or status.'));
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
      const j = toJson({ ws: ctx.ws, snapshot: isProposed(g) ? { ...ctx.snapshot, goals: [...ctx.snapshot.goals, g] } : ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today, goals: [g] });
      // A proposed goal is never judged (GE10): no scorecard, no status.
      if (isProposed(g)) { const data = { cycle: j.cycle, goal: j.goals[0], state: 'proposed', notes: j.notes }; return { data, text: JSON.stringify(data, null, 2) }; }
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
    description: 'Post the number (or stages) for one goal for a week: this week by default, or an earlier week to fill in history. The same rules as the app apply: behind or ahead of plan needs a cause and a why; at risk or off track needs a path to green. Only the goal’s owner can post: not an admin, and not anyone else (an admin brings others’ check-ins in only by loading a workbook, or corrects a past one in Data’s tables). Posting again for the same week corrects that week’s check-in (the log keeps both).',
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
      reason: str(`If the week already has a check-in, this corrects it: why, in a sentence (${MIN_CORRECT_REASON} to 500 characters), kept as “Why corrected”.`),
      reading_confirmed: bool('True when the owner has confirmed the number their goal’s metric source reads now (get_goal’s metric names the source): it is read again here and recorded with the check-in, and `value` may be left out to post it. Left out: nothing is read or recorded.'),
      different_because: { type: 'object', additionalProperties: false, required: ['kind'], description: `When the owner’s value differs from what the source reads now, why: the reading and the reason are recorded beside their number (never a flag). kind: behind (the source is behind: they have a newer number), other-count (it counts something else), wrong (it is wrong this week) or else (something else, with text of at least ${MIN_CORRECT_REASON} characters).`, properties: { kind: str('Why it differs.', { enum: ['behind', 'other-count', 'wrong', 'else'] }), text: str('In the owner’s words; needed for else.') } },
      answers: ANSWERS_ARG,
      dry_run: DRY,
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      // NR rule 3: the goal's source is read only when the call says the owner confirmed it or why theirs differs.
      const diff = a.different_because as { kind: ReadingWhyKind; text?: string } | undefined;
      const asksReading = a.reading_confirmed === true || !!diff;
      let readings: ChangeInput['readings'];
      let readSays = '';
      if (asksReading) {
        const reader = checkInReaders()[0];
        if (reader && !isModuleOn(ctx.ws, reader.module)) return { isError: true, text: moduleOffSentence(moduleById(reader.module)?.name ?? reader.module, ctx.ws.name, 'post_check_in with reading_confirmed or different_because') };
        const got = reader ? await reader.read(ctx, g, { value: typeof a.value === 'number' ? a.value : null, confirmed: a.reading_confirmed === true, ...(diff ? { why: diff } : {}) }) : { reading: null, says: 'No number source can be read here, so no reading was recorded.' };
        if (got.reading) {
          readings = [{ goalId: g.id, week: (a.week as number | undefined) ?? ctx.week, reading: got.reading }];
          if (a.value == null && a.reading_confirmed === true) a = { ...a, value: got.reading.value };
        }
        readSays = got.says ?? '';
      }
      const r = row({ ...a, goal_id: g.id, week: a.week ?? ctx.week, call: a.call == null || a.call === '' ? undefined : statusIn(a.call, CALLS) }, { goal_id: 'goal id', week: 'week', value: 'value', stages: 'stages', call: 'call', cause: 'cause', why: 'why', why_greener: 'why greener', path_to_green: 'path to green', recovery: 'recovery', back_on_plan_by_week: 'back on plan by week', needs: 'needs', next_step: 'next step' });
      // A target reached, or back on track (habit rule 3), said as the receipt says it. Never on a correction.
      const saved = (cs: ChangeSet, before: McpContext['snapshot']) => {
        if (cs.items.some((x) => x.kind === 'replaces check-in')) return null;
        const c = cs.commit?.checkIns?.find((x) => x.goalId === g.id);
        const m = c && moment(before.checkIns.filter((x) => x.goalId === g.id), c, g);
        if (!c || !m) return null;
        const t = momentText(m, g, c, ctx.cycle.weeks);
        return { data: { moment: { kind: m.kind, heading: t.heading, line: t.line } }, text: `${t.heading}. ${t.line}` };
      };
      const out = await change(ctx, { checkIns: [r] }, { dry: !!a.dry_run, reason: a.reason as string | undefined, answers: a.answers, readings, saved });
      return readSays && !out.isError ? { ...out, text: `${out.text}\n${readSays}` } : out;
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
      return change(ctx, { goals: [row(withLower({ ...a, goal_id: g.id }, g), { goal_id: 'id', ...GOAL_COLS })] }, { dry: !!a.dry_run, reason: a.reason as string | undefined, confirm: a.confirm === true, answers: a.answers });
    },
  },
  {
    name: 'make_goal_active',
    title: 'Make a proposed goal active',
    description: 'Its owner or an admin: make a proposed goal active. A number goal’s plan runs from this week, or from the week given. From then it is judged against its plan and check-ins are due. Use dry_run first to read back the dates and when the first check-in is due, and say it to the person.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.'), from: str('Number goals: the week its plan runs from, as a year and a week (2026-W48) or the week’s number. Left out: this week.'), confirm: bool('True once the person has said the goal has been running since an earlier From (the question comes back otherwise).'), dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      let fromWeek: number | undefined;
      if (a.from != null && a.from !== '') { const r = readWeekCode(ctx.cycle, String(a.from)); if (!('n' in r)) throw new Error(r.text ?? `From says “${String(a.from)}”. Write a year and a week, like 2026-W48.`); fromWeek = r.n; }
      let out;
      try { out = activate(ctx, { goalId: g.id, fromWeek, confirm: a.confirm === true }); } catch (e) { if (e instanceof NotAllowed) return { isError: true, text: e.message }; throw e; }
      const says = activeReadBack(g, { cycle: ctx.cycle, week: ctx.week, today: ctx.today, rhythm: 'weekly', fromWeek: fromWeek ?? Math.max(0, ctx.week) });
      if (a.dry_run) return { data: { saved: false, readBack: says }, text: `Checked, not saved (dry run). ${says}` };
      await ctx.save({ ...out.commit, changes: out.commit.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA_MCP] })) });
      return { data: { saved: true, readBack: says }, text: `“${g.title}” is active (as ${ctx.actor.name}). ${says}` };
    },
  },
  {
    name: 'make_goal_proposed',
    title: 'Make an active goal proposed again',
    description: 'Its owner or an admin: make an active goal with no check-ins proposed again (GE10). It then has no status and nothing due until it is made active (make_goal_active). A goal with check-ins can’t go back: stop it instead (stop_goal). Use dry_run first and say the change to the person.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.'), dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      let out;
      try { out = backToProposed(ctx, { goalId: g.id }); } catch (e) { if (e instanceof NotAllowed) return { isError: true, text: e.message }; throw e; }
      if (a.dry_run) return { data: { saved: false }, text: `Checked, not saved (dry run). “${g.title}” would be proposed again: no status and nothing due until it is made active.` };
      await ctx.save({ ...out.commit, changes: out.commit.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA_MCP] })) });
      return { data: { saved: true }, text: `“${g.title}” is proposed again (as ${ctx.actor.name}). It has no status and nothing due until it is made active.` };
    },
  },
  {
    name: 'create_goal',
    title: 'Add a goal',
    description: 'Add a goal to the current cycle. Type "metric" moves a number from start to target; "range" keeps a number inside a limit; "milestone" hits dated stages. Anyone may add a goal for anyone, at any level; only its owner or an admin can change it afterwards. A goal for someone else with no state is asked about once (start it active, or proposed): ask the person, or give state. Give a unit for a number. What is possible but unlikely (no unit, over 100%, a target a hundred times the start, a link to a lower level) is a question: ask the person, then call again with "confirm": true (a name another goal in its team has is asked through "answers").',
    inputSchema: { type: 'object', additionalProperties: false, required: ['title', 'type'], properties: { type: str('What kind of goal.', { enum: ['metric', 'range', 'milestone'] }), ...GOAL_FIELDS, confirm: CONFIRM, answers: ANSWERS_ARG, dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      return change(ctx, { goals: [row(withLower({ owner: ctx.actor.name, ...a }), { type: 'type', ...GOAL_COLS })] }, { dry: !!a.dry_run, confirm: a.confirm === true, answers: a.answers });
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
    description: `Add or change many people, goals, plan numbers and check-ins in one go, using the same columns as the spreadsheet export and export_table (e.g. goals: [{"Key": "G-12", "Target": 90}], check_ins: [{"Goal key": "G-12", "Week": 3, "Value": 41}], plan: [{"Key": "G-12", "Week 5": 45}], people: [{"Email": "ana@example.com", "Job title": "Staff engineer"}]). A goal is found by its Key, then its ID (a key works wherever an ID does: Goal key, Feeds into key, Feeds into ID); a goal this same call adds, by its row's Ref: give each new goal a "Ref" of your own and name it in "Feeds into ref" or a check-in's "Goal ref", so one dry run builds a whole tree with its first numbers (goals: [{"Ref": "top", "Goal": "…"}, {"Ref": "a", "Goal": "…", "Feeds into ref": "top"}], check_ins: [{"Goal ref": "a", "Week": 46, "Value": 12}]); a person by Email, then a name only one person has (Owner email is exact). Columns a row leaves out stay as they are; worked-out columns (Status, Calculated…) are ignored. An Action column does what the app does: ${GOAL_ACTION_WORDS.word.stop} (with a Reason) or ${GOAL_ACTION_WORDS.word.delete} on a goal, ${PERSON_ACTION_WORDS.word.left} (with Takes over, by email) on a person. Checks every row and returns what would change, and every problem by kind: must_fix (fix the rows) and check (questions: ask the person, then call again with "answers" by group id; one answer covers every row in its group); nothing is saved unless "apply" is true and every row is valid, and it can be undone (undo_import).`,
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
/** The feature module a tool belongs to, if it isn't the core's. */
export const toolModule = (name: string): string | undefined => TOOL_MODULE.get(name);

/** Everything a person can do in the app, their assistant can do here: reading, check-ins, goals and plans above;
    requests, reviews, watching, people, wrap-ups, views, tokens and feedback in workTools.ts; then each feature
    module's own (the spreadsheets module's export and export_table). */
// The modules' Goals columns are read from a link here as in the app (core/app registers them for the screens).
addColumnParams(MODULE_GOAL_COLUMNS.map((c) => c.param));

export const TOOLS: ToolDef[] = [...CORE_TOOLS, ...WORK_TOOLS, ...REMOVE_TOOLS, ...MODULE_TOOLS.flatMap((m) => m.part)];

/** Runs a tool by name. Errors in the arguments come back as a tool error the assistant can read and fix. A module's
    tool in a workspace that has switched that module off says so, and does nothing. */
export async function callTool(name: string, args: Record<string, unknown>, ctx: McpContext): Promise<ToolResult> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { isError: true, text: `There's no tool called ${name}.` };
  const from = TOOL_MODULE.get(name);
  if (from && !isModuleOn(ctx.ws, from)) return { isError: true, text: moduleOffSentence(moduleById(from)?.name ?? from, ctx.ws.name, name) };
  try {
    return await t.run(args ?? {}, reviewsOn(modulesOn(ctx.ws).on) ? ctx : reviewsGuarded(ctx, name));
  } catch (e) {
    if (e instanceof ReviewsOff) return { isError: true, text: e.message };
    const text = e instanceof Error ? e.message : String(e);
    // A refusal says who the token acts as, so an assistant (and the person reading) can tell "the rule says no" from "this
    // token is someone else's" (backlog N: a token made for a non-admin was taken for an admin's).
    return { isError: true, text: e instanceof NotAllowed ? `${text} ${actingAs(ctx.actor)}` : text, cause: e };
  }
}

/** A save refused because it writes Reviews' records while Reviews is off: said as the switched-off sentence alone. */
class ReviewsOff extends Error {}

/**
 * The context a tool runs with while Reviews is off: the same, except that a save writing Reviews' records (a review, a
 * note said in one, an ask raised in one, a goal proposed in one: domain/reviewWrites) is refused and saves nothing, in
 * the switched-off sentence, whichever tool made it (build review of #371: edit_comment and delete_comment on a review
 * note, create_goal proposed in a review, restore_removed reopening an ended review). Everything else reads and writes
 * through to the context itself, which a save moves on.
 */
function reviewsGuarded(ctx: McpContext, tool: string): McpContext {
  const save = async (c: Commit) => {
    if (writesReviews(c, reviewWriteRows(ctx.full ?? ctx.snapshot))) throw new ReviewsOff(moduleOffSentence('Reviews', ctx.ws.name, tool));
    return ctx.save(c);
  };
  return new Proxy(ctx, { get: (t, k, r) => (k === 'save' ? save : Reflect.get(t, k, r)) });
}

/** Who a token acts as, in a sentence: said with every refusal. */
export const actingAs = (p: { name: string; admin: boolean }) => `This token acts as ${p.name}, who ${p.admin ? 'is an admin' : 'isn’t an admin'}.`;
