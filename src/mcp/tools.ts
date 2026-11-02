/* The MCP tools: what an AI assistant can read and change, acting as one person through their personal token.
   Every write goes through the bulk-change engine, so it meets the same rules as the app (owners change their own
   goals, admins any; reasons when behind; a reason for plan changes) and is logged as that person, via MCP. */
import { applyQuery, parseQuery } from '../domain/query';
import type { Commit } from '../data/store';
import { describe, planChanges, type ChangeSet, type Rec, type Tables } from '../domain/changeset';
import { aiBrief, toCsv, toJson, workbook } from '../domain/export';
import { summariseAll } from '../domain/summary';
import type { Cycle, DisplayStatus, Level, Person, Snapshot } from '../domain/types';

export interface McpContext {
  ws: { id: string; name: string };
  /** The current cycle only. */
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  today: Date;
  actor: Person;
  now: string;
  newId: (prefix: string) => string;
  save(c: Commit): Promise<void>;
}

export interface ToolResult { text: string; data?: unknown; isError?: boolean }
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
const LEVELS: Level[] = ['north-star', 'svp', 'team'];
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

async function change(ctx: McpContext, tables: Tables, opts: { dry?: boolean; reason?: string }): Promise<ToolResult> {
  const cs: ChangeSet = planChanges({ tables, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, via: 'mcp', reason: opts.reason });
  const errors = cs.issues.filter((x) => x.severity === 'error');
  const warnings = cs.issues.filter((x) => x.severity === 'warning');
  const data = {
    saved: false,
    summary: describe(cs),
    changes: cs.items.map((x) => ({ goalId: x.goalId, goal: x.goal, kind: x.kind, summary: x.summary, fields: x.diffs.filter((d) => d.field !== 'Via').map((d) => ({ field: d.field, from: d.from, to: d.to })), pastWeek: !!x.backfilled })),
    unchanged: cs.unchanged,
    problems: errors.map((x) => ({ sheet: x.sheet, row: x.row, goal: x.goal, message: x.message })),
    warnings: warnings.map((x) => ({ goal: x.goal, message: x.message })),
    needsReason: cs.needsReason,
  };
  const lines = (l: { goal: string; message: string }[]) => l.map((x) => `- ${x.goal ? x.goal + ': ' : ''}${x.message}`).join('\n');
  if (errors.length) return { isError: true, data, text: `Not saved. Fix these and try again:\n${lines(errors)}` };
  if (cs.needsReason) return { isError: true, data, text: 'Not saved: check-ins have started on this goal, so a plan change needs a reason. Ask the person why, then call again with "reason".' };
  if (!cs.items.length) return { data, text: 'Nothing to change: it already says that.' };
  const what = `${describe(cs)}.${warnings.length ? `\nNote:\n${lines(warnings)}` : ''}`;
  if (opts.dry || !cs.commit) return { data, text: `Checked, not saved (dry run). Would save: ${what}` };
  await ctx.save(cs.commit);
  return { data: { ...data, saved: true }, text: `Saved as ${ctx.actor.name}: ${what}` };
}

const goalRef = (ctx: McpContext, id: unknown) => {
  const g = ctx.snapshot.goals.find((x) => x.id === id);
  if (!g) throw new Error(`There's no goal with ID ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs.`);
  return g;
};

const GOAL_FIELDS = {
  title: str('The goal’s name.'),
  owner: str('The owner’s full name, as in the workspace.'),
  team: str('The team’s name.'),
  level: str('How important it is for reporting.', { enum: ['north star', 'svp', 'team'] }),
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
  feeds_into_id: str('The ID of the goal this one feeds. Empty string to unlink.'),
  why_it_helps: str('Why we expect it to help the goal it feeds.'),
  source: str('Where the number comes from.'),
  definition: str('Exactly what is counted.'),
};
const GOAL_COLS: Record<string, string> = { title: 'goal', owner: 'owner', team: 'team', level: 'level', unit: 'unit', decimals: 'decimals', start: 'start', target: 'target', plan_shape: 'plan', due_week: 'due week', limit: 'limit', must_stay: 'must stay', margin: 'margin', stages: 'stages', feeds_into_id: 'feeds into id', why_it_helps: 'why it helps', source: 'source', definition: 'definition' };

export const TOOLS: ToolDef[] = [
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
    description: 'List goals in the current cycle with their status, latest number, this week’s plan, target and gap. Filter by words in the name, owner, status or level, or just your own; or pass the query of a shared Goals link, or the name of a saved view, for every filter and sort the Goals screen has.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      text: str('Words in the goal’s name.'),
      owner: str('Part of the owner’s name.'),
      status: str('Only goals with this status.', { enum: STATUSES }),
      level: str('Only goals at this level.', { enum: LEVELS }),
      mine: bool('Only goals you own.'),
      query: str('A Goals link’s query string, e.g. "status=off,risk&needs=decision,slipped&due=quarter&sort=gap". Keys: q, status (off, risk, stale, on, done, planned), level (north-star, svp, team), team and owner (IDs), kind (metric, range, milestone), needs (decision, no-recovery, slipped, missed-date, greener), due (quarter or a week), quiet (weeks), qtr (met, missed), result (completed, late, missed, open), feeds (a goal ID: its tree), helps (1), sort (worst, title, owner, team, level, gap, last, due; add .desc to reverse).'),
      view: str('The name of a saved view: one of yours, or one pinned for everyone.'),
    } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      const has = (s: string, q: unknown) => !q || s.toLowerCase().includes(String(q).toLowerCase());
      let query = a.query ? parseQuery(new URLSearchParams(String(a.query).replace(/^.*\?/, ''))) : null;
      if (a.view) {
        const v = (ctx.snapshot.views ?? []).find((x) => !x.deletedAt && (x.pinned || x.personId === ctx.actor.id) && x.name.toLowerCase() === String(a.view).toLowerCase());
        if (!v) throw new Error(`There’s no saved view called “${String(a.view)}” that you can see.`);
        query = parseQuery(new URLSearchParams(v.params));
      }
      let list = summariseAll(ctx.snapshot.goals, ctx.snapshot, ctx.cycle, ctx.today, ctx.week)
        .filter((s) => has(s.goal.title, a.text) && has(s.owner, a.owner) && (!a.status || s.status === a.status) && (!a.level || s.goal.level === a.level) && (!a.mine || s.goal.ownerId === ctx.actor.id));
      // The same search, filters and sort as the Goals screen (domain/query.ts).
      if (query) list = applyQuery(list, query, { goals: ctx.snapshot.goals, cycle: ctx.cycle, week: ctx.week });
      const data = list.map((s) => ({ id: s.goal.id, title: s.goal.title, type: s.goal.kind, level: s.goal.level, owner: s.owner, team: s.team, status: s.status, now: s.now, planThisWeek: s.planNow != null ? s.planNowText : null, target: s.target, gap: s.gap, lastCheckInWeek: s.lastWeek, feedsInto: s.feedsInto, youCanChange: ctx.actor.admin || s.goal.ownerId === ctx.actor.id }));
      return { data: { week: ctx.week, weeks: ctx.cycle.weeks, goals: data }, text: data.length ? data.map((g) => `${g.id} · ${g.title} · ${g.owner} · ${g.status} · now ${g.now}${g.planThisWeek ? `, plan ${g.planThisWeek}` : ''} · ${g.gap}`).join('\n') : 'No goals match.' };
    },
  },
  {
    name: 'get_goal',
    title: 'One goal in full',
    description: 'Everything about one goal: its plan by week, every check-in with the owner’s reasons, and notes, questions and actions from reviews.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID, from find_goals.') } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      const j = toJson({ ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today, goals: [g] });
      const data = { cycle: j.cycle, goal: j.goals[0], notes: j.notes };
      return { data, text: JSON.stringify(data, null, 2) };
    },
  },
  {
    name: 'post_check_in',
    title: 'Post a check-in',
    description: 'Post the number (or stages) for one goal for a week: this week by default, or an earlier week to fill in history. The same rules as the app apply: behind or ahead of plan needs a cause and a why; at risk or off track needs a path to green. Only the goal’s owner or an admin can post. Check in as often as you like: every check-in is kept, and the latest in a week is that week’s status.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: {
      goal_id: str('The goal’s ID.'),
      week: int('The week, counted from the cycle start. Defaults to this week. Earlier weeks are marked as loaded later.'),
      value: num('Number goals: the value for the week.'),
      stages: str('Milestone goals: e.g. "Pilot: done week 6; Rollout: expected week 9".'),
      call: str('The owner’s status call. Leave out to let the rules decide.', { enum: ['On track', 'At risk', 'Off track', 'Done'] }),
      cause: str('Why it’s behind or ahead.', { enum: ['Plan too aggressive', 'Delivery slower', 'Blocked by a dependency', 'External factor', 'Data problem', 'Plan too cautious', 'Change landed early', 'One-off, won’t last'] }),
      why: str('In a sentence (10 characters or more).'),
      why_greener: str('If the call is greener than the numbers: why.'),
      path_to_green: str('How it gets back on plan.'),
      recovery: str('Where the owner is with recovery.', { enum: ['Plan', 'Still investigating', 'Needs a decision or help', 'Target should change'] }),
      back_on_plan_by_week: int('With a plan: the week it is back on plan by.'),
      needs: str('A decision or help needed, and from whom.'),
      next_step: str('The next step.'),
      dry_run: DRY,
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      goalRef(ctx, a.goal_id);
      const r = row({ ...a, week: a.week ?? ctx.week }, { goal_id: 'goal id', week: 'week', value: 'value', stages: 'stages', call: 'call', cause: 'cause', why: 'why', why_greener: 'why greener', path_to_green: 'path to green', recovery: 'recovery', back_on_plan_by_week: 'back on plan by week', needs: 'needs', next_step: 'next step' });
      return change(ctx, { checkIns: [r] }, { dry: !!a.dry_run });
    },
  },
  {
    name: 'update_goal',
    title: 'Change a goal',
    description: 'Change a goal’s details or plan. Only the fields you give change. A plan change (start, target, shape, due week, limit, stages) after check-ins have started needs a reason, which is logged with the old and new plan.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID.'), ...GOAL_FIELDS, reason: str('Why the plan is changing.'), dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      goalRef(ctx, a.goal_id);
      return change(ctx, { goals: [row(a, { goal_id: 'id', ...GOAL_COLS })] }, { dry: !!a.dry_run, reason: a.reason as string | undefined });
    },
  },
  {
    name: 'create_goal',
    title: 'Add a goal',
    description: 'Add a goal to the current cycle. Type "metric" moves a number from start to target; "range" keeps a number inside a limit; "milestone" hits dated stages. You can add goals you own; admins can add goals for anyone.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['title', 'type'], properties: { type: str('What kind of goal.', { enum: ['metric', 'range', 'milestone'] }), ...GOAL_FIELDS, dry_run: DRY } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      return change(ctx, { goals: [row({ owner: ctx.actor.name, ...a }, { type: 'type', ...GOAL_COLS })] }, { dry: !!a.dry_run });
    },
  },
  {
    name: 'set_plan_numbers',
    title: 'Set plan numbers by hand',
    description: 'Set a number goal’s planned value for particular weeks; the plan then runs straight between them. Setting the due week’s number changes the target. Needs a reason once check-ins have started.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'numbers'], properties: {
      goal_id: str('The goal’s ID.'),
      numbers: { type: 'array', description: 'Planned values by week.', items: { type: 'object', required: ['week', 'value'], properties: { week: int('Week from the cycle start.'), value: num('Planned value.') } } },
      reason: str('Why the plan is changing.'), dry_run: DRY,
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      goalRef(ctx, a.goal_id);
      const r: Rec = { __row: '1', id: String(a.goal_id) };
      for (const p of (a.numbers as { week: number; value: number }[]) ?? []) r[`week ${p.week}`] = String(p.value);
      return change(ctx, { plan: [r] }, { dry: !!a.dry_run, reason: a.reason as string | undefined });
    },
  },
  {
    name: 'add_comment',
    title: 'Comment on a goal',
    description: 'Add a comment to a goal’s history. Anyone can comment; it doesn’t change the status.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'text'], properties: { goal_id: str('The goal’s ID.'), text: str('The comment.') } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      const g = goalRef(ctx, a.goal_id);
      const t = String(a.text ?? '').trim();
      if (t.length < 2) return { isError: true, text: 'Write the comment in "text".' };
      await ctx.save({ changes: [{ id: ctx.newId('chg'), at: ctx.now, actorId: ctx.actor.id, goalId: g.id, entity: 'note', entityId: ctx.newId('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: t }, { field: 'Via', from: '—', to: 'AI assistant (MCP)' }] }] });
      return { text: `Comment added to ${g.title} as ${ctx.actor.name}.` };
    },
  },
  {
    name: 'bulk_change',
    title: 'Change many goals at once',
    description: 'Add or change many goals, plan numbers and check-ins in one go, using the same columns as the spreadsheet export (e.g. goals: [{"ID": "...", "Target": 90}], check_ins: [{"Goal ID": "...", "Week": 3, "Value": 41}], plan: [{"ID": "...", "Week 5": 45}]). Checks every row and returns what would change; nothing is saved unless "apply" is true and every row is valid.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      goals: { type: 'array', items: { type: 'object' }, description: 'Rows for the Goals sheet. ID to change a goal; no ID to add one.' },
      plan: { type: 'array', items: { type: 'object' }, description: 'Rows for the Plan sheet: ID and "Week N" columns.' },
      check_ins: { type: 'array', items: { type: 'object' }, description: 'Rows for the Check-ins sheet: Goal ID, Week, Value or Stages, Call, Cause, Why, Path to green, Back on plan by week, Needs, Next step.' },
      reason: str('Why plans are changing, for any plan change that needs one.'),
      apply: bool('Save the changes. Leave out first to check them.'),
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      return change(ctx, { goals: rows(a.goals, 'goals'), plan: rows(a.plan, 'plan'), checkIns: rows(a.check_ins, 'check_ins') }, { dry: !a.apply, reason: a.reason as string | undefined });
    },
  },
  {
    name: 'export',
    title: 'Export the goals',
    description: 'Every goal in the current cycle as JSON (each goal with its plan by week and check-ins), a Markdown brief, or CSV of the goals or the check-ins.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['format'], properties: { format: str('Which export.', { enum: ['json', 'brief', 'goals_csv', 'check_ins_csv'] }) } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      const x = { ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today };
      if (a.format === 'json') { const j = toJson(x); return { data: j, text: JSON.stringify(j) }; }
      if (a.format === 'brief') return { text: aiBrief(x) };
      const wb = workbook(x);
      if (a.format === 'goals_csv') return { text: toCsv(wb[0]!.rows) };
      if (a.format === 'check_ins_csv') return { text: toCsv(wb[2]!.rows) };
      return { isError: true, text: 'format should be json, brief, goals_csv or check_ins_csv.' };
    },
  },
];

/** Runs a tool by name. Errors in the arguments come back as a tool error the assistant can read and fix. */
export async function callTool(name: string, args: Record<string, unknown>, ctx: McpContext): Promise<ToolResult> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { isError: true, text: `There's no tool called ${name}.` };
  try {
    return await t.run(args ?? {}, ctx);
  } catch (e) {
    return { isError: true, text: e instanceof Error ? e.message : String(e) };
  }
}
