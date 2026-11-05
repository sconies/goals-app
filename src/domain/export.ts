/* Exports: the same goals as a workbook (for Excel), CSV, JSON (for scripts and AIs) and a short brief in
   Markdown (to paste into any AI chat). Pure functions; the app turns them into files.
   The Goals, Plan and Check-ins sheets use the import's column names, so an export can be edited and loaded back. */
import { planHistoryOf } from './goal';
import { requestsOf } from './requests';
import { causeLabel } from './checkin';
import { LEVEL_LABEL } from './format';
import { planAsOf, planAt, planCheckpoints, planEnd, weekDate, weekDates } from './plan';
import { MEANING, RESULT_MEANING, RESULT_TEXT } from './story';
import { isYear, periodLabel, quarterOf, quarters } from './year';
import { answerOf } from './review';
import { assessMilestone, LABEL } from './status';
import { summariseAll, type GoalSummary } from './summary';
import type { CheckIn, Cycle, Goal, Snapshot, Workspace } from './types';

export type Cell = string | number | null;
export interface Table { name: string; rows: Cell[][] }

export interface ExportInput {
  ws: Pick<Workspace, 'id' | 'name'>;
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  today: Date;
  /** Only these goals (the current view); every goal in the cycle when left out. */
  goals?: Goal[];
}

export const EXPORT_FORMAT = 'goals-app.export';
export const EXPORT_VERSION = 1;

const levelWord = { 'north-star': 'north star', svp: 'svp', team: 'team' } as const;
const shapeWord = { straight: 'straight', back: 'back-loaded', stepped: 'stepped' } as const;
const kindWord = { metric: 'metric', range: 'range', milestone: 'milestone' } as const;
const RECOVERY = { plan: 'Plan', investigating: 'Still investigating', help: 'Needs a decision or help', target: 'Target should change' } as const;

function prepare(x: ExportInput) {
  const goals = x.goals ?? x.snapshot.goals;
  const sums = summariseAll(goals, x.snapshot, x.cycle, x.today, x.week);
  const name = (id: string) => x.snapshot.people.find((p) => p.id === id)?.name ?? '';
  return { goals, sums, name };
}

function stagesText(g: Goal, c: CheckIn): string {
  if (g.kind !== 'milestone' || !c.stages) return '';
  return assessMilestone(g, c.week, c.stages).stages.map((s) => `${s.name}: ${s.kind === 'done' ? 'done week ' + s.doneWeek : s.weeksLate > 0 ? 'expected week ' + s.expectedWeek : 'due week ' + s.dueWeek}`).join('; ');
}

/* ---------- workbook ---------- */

/** The goal's readable key comes first (G-12); its ID, the identity the app keeps, next. Either matches it on the way back. */
export const GOAL_EXPORT_COLUMNS = ['Key', 'ID', 'Goal', 'Level', 'Team', 'Owner', 'Type', 'Unit', 'Decimals', 'Start', 'Target', 'Plan', 'Plan from week', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages', 'Feeds into', 'Feeds into ID', 'Why it helps', 'Effect', 'Source', 'Definition'] as const;
export const GOAL_DERIVED_COLUMNS = ['Status', 'Result', 'Since', 'Now', 'Plan this week', 'Gap', 'Last check-in week', 'Forecast', 'Why it’s off', 'Recovery plan', 'By when', 'Needs', 'Next step', 'Warnings', 'Q1', 'Q2', 'Q3', 'Q4'] as const;
export const CHECKIN_EXPORT_COLUMNS = ['ID', 'Goal key', 'Goal ID', 'Goal', 'Week', 'Week starting', 'Value', 'Stages', 'Call', 'Calculated', 'Plan that week', 'Cause', 'Why', 'Why greener', 'Path to green', 'Recovery', 'Back on plan by week', 'Needs', 'Next step', 'Posted at', 'Posted by', 'Backfilled'] as const;

function goalRow(s: GoalSummary, all: Goal[]): Cell[] {
  const g = s.goal;
  const parent = g.parentId ? all.find((x) => x.id === g.parentId) : null;
  const m = g.kind === 'metric' ? g : null, r = g.kind === 'range' ? g : null;
  return [
    g.key ?? null, g.id, g.title, levelWord[g.level], s.team, s.owner, kindWord[g.kind],
    g.kind === 'milestone' ? null : g.unit, g.kind === 'milestone' ? null : g.decimals,
    m ? m.plan.start : null, m ? m.plan.target : null, m ? shapeWord[m.plan.shape] : null, m ? m.plan.fromWeek ?? 0 : null, m ? m.plan.endWeek ?? null : null,
    r ? r.range.limit : null, r ? (r.range.bound === 'atMost' ? 'at most' : 'at least') : null, r ? r.range.margin : null,
    g.kind === 'milestone' ? g.stages.map((x) => `${x.name}@${x.dueWeek}`).join('; ') : null,
    parent?.title ?? null, parent?.id ?? null, g.whyHelps || null, g.effect, g.source || null, g.definition || null,
    s.statusLabel, s.story.result?.text ?? null, s.story.since, s.now, s.planNow != null ? s.planNowText : null, s.gap, s.lastWeek, s.forecast,
    s.story.why, s.story.doing, s.story.byWhen, s.story.needs, s.story.next, s.story.warnings.join(' ') || null,
    ...[1, 2, 3, 4].map((n) => { const q = s.story.quarters.find((y) => y.quarter.n === n); return !q || q.kind === 'none' ? null : `${q.kind === 'met' ? 'Met' : q.kind === 'missed' ? 'Missed' : 'Open'}: ${q.text.replace(/^Q\d: /, '')}`; }),
  ];
}

function checkInRows(x: ExportInput, sums: GoalSummary[], name: (id: string) => string): Cell[][] {
  const rows: Cell[][] = [];
  for (const s of sums) {
    const g = s.goal;
    for (const c of s.checkIns) {
      const ptg = c.pathToGreen;
      rows.push([
        c.id, g.key ?? null, g.id, g.title, c.week, weekDate(x.cycle, c.week), c.value, stagesText(g, c) || null,
        LABEL[c.status], LABEL[c.calculated], g.kind === 'metric' ? Number(planAt(planAsOf(g, c.week), c.week, x.cycle.weeks).toFixed(g.decimals)) : null,
        c.cause ? causeLabel(c.cause) : null, c.why || null, c.greenerWhy || null,
        ptg?.what || null, ptg ? RECOVERY[ptg.state ?? 'plan'] : null, ptg?.byWeek ?? null, ptg?.needs || null,
        c.next || null, c.postedAt, name(c.authorId) || null, c.backfilled ? 'yes' : null,
      ]);
    }
  }
  // By goal, then week, then when it was posted.
  const [gi, wi, pi] = (['Goal', 'Week', 'Posted at'] as const).map((c) => CHECKIN_EXPORT_COLUMNS.indexOf(c)) as [number, number, number];
  return rows.sort((a, b) => String(a[gi]).localeCompare(String(b[gi])) || Number(a[wi]) - Number(b[wi]) || String(a[pi]).localeCompare(String(b[pi])));
}

/** The plan as numbers, one row per number goal and one column per week (every week to its due week). */
function planRows(x: ExportInput, sums: GoalSummary[]): Cell[][] {
  const metric = sums.map((s) => s.goal).filter((g): g is Extract<Goal, { kind: 'metric' }> => g.kind === 'metric');
  const last = Math.max(x.cycle.weeks, ...metric.map((g) => planEnd(g.plan, x.cycle.weeks)));
  const weeks = Array.from({ length: last }, (_, i) => i + 1);
  return [
    ['Key', 'ID', 'Goal', 'Unit', 'Start', ...weeks.map((w) => `Week ${w}`)],
    ...metric.map((g) => {
      const end = planEnd(g.plan, x.cycle.weeks);
      const from = g.plan.fromWeek ?? 0;
      return [g.key ?? null, g.id, g.title, g.unit, g.plan.start, ...weeks.map((w) => (w <= from || w > end ? null : Number(planAt(g.plan, w, x.cycle.weeks).toFixed(g.decimals))))];
    }),
  ];
}

const README: Cell[][] = [
  ['Sheet', 'Column', 'What it means', 'When loaded back'],
  ['Goals', 'Key', 'The goal’s short key in this workspace (G-12). It never changes, and a goal carried into the next cycle keeps it. Leave it empty for a new goal: it gets the next one.', 'Matches the goal, like ID'],
  ['Goals', 'ID', 'The goal’s identity. Keep it to update the goal; leave it empty for a new goal.', 'Matches the goal'],
  ['Goals', 'Level', 'north star, svp or team', 'Changes the level'],
  ['Goals', 'Type', 'metric (move a number), range (keep a number in range) or milestone (hit dated stages)', 'Can’t change on an existing goal'],
  ['Goals', 'Start, Target, Plan, Due week', 'Number goals: where it starts, the target, the plan’s shape (straight, back-loaded, stepped) and the week the target is due', 'Changes the plan; needs a reason once check-ins have started'],
  ['Goals', 'Limit, Must stay, Margin', 'Range goals: the limit, at most or at least, and how close counts as at risk', 'Changes the range'],
  ['Goals', 'Stages', 'Milestone goals: Name@week, separated by semicolons', 'Changes the stages'],
  ['Goals', 'Status', 'On track: will hit the target if it carries on (95%+ of planned progress). At risk: could miss without a change (80–95%, or near a limit); the owner has said how it gets back. Off track: will miss without intervention (under 80%, a stage over two weeks late, or over a limit two weeks running). No recent update: no check-in for two weeks or more.', 'Ignored'],
  ['Goals', 'Result', 'Completed: hit the target by its due date. Completed late: hit it after the due date. Did not meet: the due date passed without hitting it.', 'Ignored'],
  ['Goals', 'Why it’s off, Recovery plan, By when, Needs, Next step, Warnings', 'The owner’s latest account when a goal is behind, and anything the numbers would hide (a date that slipped, no recovery plan, a call greener than the numbers)', 'Ignored'],
  ['Goals', 'Since, Now, Plan this week, Gap, Last check-in week, Forecast', 'Worked out by the app when exported', 'Ignored'],
  ['Goals', 'Q1, Q2, Q3, Q4', 'Each quarter against the owner’s plan: Met, Missed, or Open while it runs. A quarter’s target is the plan’s number at its end.', 'Ignored'],
  ['Plan', 'Week N', 'The current plan for each week. If the plan changed, earlier check-ins were judged against the plan of their day: see Plan that week on Check-ins. Type over any week to set the plan by hand', 'Sets the plan numbers'],
  ['Check-ins', 'ID', 'The check-in’s own identity. It never changes. Keep it to correct that check-in; leave it empty to add one.', 'Matches the check-in'],
  ['Check-ins', 'Goal key or Goal ID, Week, Value or Stages', 'One row per check-in: a goal and week, and what was reported', 'Adds a check-in, or corrects the one with that ID (or that week’s latest when there’s no ID)'],
  ['Check-ins', 'Call', 'The owner’s status call: On track, At risk, Off track or Done. Empty: the rules decide', 'Used as the call; a call greener than the numbers needs Why greener'],
  ['Check-ins', 'Cause, Why, Path to green, Back on plan by week, Needs', 'Why it’s ahead or behind, and how it gets back', 'Required when behind, as in the app'],
  ['Check-ins', 'Calculated, Plan that week, Posted at, Posted by, Backfilled', 'Recorded by the app', 'Ignored'],
  ['Requests', 'All columns', 'Requests for a decision or help: who asked whom, for which goals, and whether it was answered', 'Not loaded back; requests are raised in check-ins'],
  ['People', 'ID', 'The person’s own identity. It never changes.', 'Matches the person (in the data tables)'],
  ['People', 'Name, Job title, Team, Admin, Team objective', 'Who’s who', 'Changed in the data tables; not loaded back from a file yet'],
];

/** Requests for a decision or help on the exported goals: open, answered or withdrawn, with every goal waiting on each. */
function requestRows(x: ExportInput, ids: Set<string>, name: (id: string) => string): Cell[][] {
  const title = (id: string) => x.snapshot.goals.find((g) => g.id === id)?.title ?? id;
  const list = requestsOf(x.snapshot).filter((r) => r.goalIds.some((id) => ids.has(id)));
  return [
    ['ID', 'Goals', 'Goal keys', 'Goal IDs', 'Asked by', 'Asked of', 'Request', 'Status', 'Asked at', 'Answer', 'Answered by', 'Answered at'],
    ...list.map((r) => [r.id, r.goalIds.map(title).join('; '), r.goalIds.map((id) => x.snapshot.goals.find((g) => g.id === id)?.key ?? '').filter(Boolean).join('; ') || null, r.goalIds.join('; '), name(r.askedBy) || null, r.recipientId ? name(r.recipientId) || null : 'Anyone', r.ask, r.status === 'open' ? 'Open' : r.status === 'answered' ? 'Answered' : 'Withdrawn', r.createdAt, r.answer, r.answeredBy ? name(r.answeredBy) || null : null, r.answeredAt]),
  ];
}

export function workbook(x: ExportInput): Table[] {
  const { goals, sums, name } = prepare(x);
  const ids = new Set(goals.map((g) => g.id));
  const notes = x.snapshot.decisions.filter((d) => ids.has(d.goalId) && ['note', 'ask', 'action'].includes(d.kind));
  const goalTitle = (id: string) => goals.find((g) => g.id === id)?.title ?? '';
  return [
    { name: 'Goals', rows: [[...GOAL_EXPORT_COLUMNS, ...GOAL_DERIVED_COLUMNS], ...sums.map((s) => goalRow(s, x.snapshot.goals))] },
    { name: 'Plan', rows: planRows(x, sums) },
    { name: 'Check-ins', rows: [[...CHECKIN_EXPORT_COLUMNS], ...checkInRows(x, sums, name)] },
    { name: 'Notes and actions', rows: [['Goal key', 'Goal ID', 'Goal', 'Week', 'Kind', 'Said by', 'Text', 'Who', 'Due week', 'Review', 'Answer', 'At'], ...notes.map((d) => [goals.find((g) => g.id === d.goalId)?.key ?? null, d.goalId, goalTitle(d.goalId), d.week, d.kind === 'ask' ? 'Question' : d.kind === 'action' ? 'Action' : 'Note', name(d.byId), d.note, d.kind === 'action' ? name(d.assigneeId ?? '') || null : null, d.dueWeek ?? null, x.snapshot.reviews.find((r) => r.id === d.reviewId)?.name ?? null, d.kind === 'ask' ? answerOf(d, x.snapshot)?.text ?? null : null, d.at])] },
    { name: 'Requests', rows: requestRows(x, ids, name) },
    { name: 'People', rows: [['ID', 'Name', 'Job title', 'Team', 'Admin', 'Team objective'], ...x.snapshot.people.map((p) => { const t = x.snapshot.teams.find((t) => t.id === p.teamId); return [p.id, p.name, p.role || null, t?.name ?? null, p.admin ? 'yes' : null, t && t.leadId === p.id ? t.objective || null : null]; })] },
    { name: 'README', rows: [[`${x.ws.name}, ${x.cycle.name}. Exported ${x.today.toISOString().slice(0, 10)}, week ${x.week} of ${x.cycle.weeks}. Week 0 starts ${x.cycle.startDate}.`], [], ...README] },
  ];
}

/* ---------- CSV ---------- */

/** RFC 4180 CSV. A leading =, +, - or @ is quoted with an apostrophe so a spreadsheet won't run it as a formula. */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v == null) return '';
    let t = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/* ---------- JSON ---------- */

export function toJson(x: ExportInput) {
  const { sums, name } = prepare(x);
  const team = (id: string | null) => x.snapshot.teams.find((t) => t.id === id)?.name ?? null;
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: x.today.toISOString(),
    about: 'Goals, their status and the owner’s account of it, plans and weekly check-ins. "status" is the owner’s latest call, or stale after 14 days without a check-in; statusMeaning says what it means. "story" says why a goal is off, what the owner will do and by when. "result" is set once a goal is due: completed, late or missed. Weeks count from the cycle start (week 0).',
    workspace: { id: x.ws.id, name: x.ws.name },
    cycle: { id: x.cycle.id, name: x.cycle.name, startDate: x.cycle.startDate, weeks: x.cycle.weeks, currentWeek: x.week, ...(isYear(x.cycle) ? { quarter: quarterOf(x.cycle, x.week).label, quarters: quarters(x.cycle).map((q) => ({ label: q.label, months: q.months, from: q.from, to: q.to })) } : {}) },
    people: x.snapshot.people.map((p) => ({ id: p.id, name: p.name, jobTitle: p.role || null, team: team(p.teamId), admin: p.admin })),
    teams: x.snapshot.teams.map((t) => ({ id: t.id, name: t.name, objective: t.objective || null })),
    goals: sums.map((s) => {
      const g = s.goal;
      return {
        id: g.id, key: g.key ?? null, title: g.title, level: g.level, type: g.kind, team: s.team, owner: s.owner, ownerId: g.ownerId,
        feedsIntoId: g.parentId, whyItHelps: g.whyHelps || null, source: g.source || null, definition: g.definition || null,
        ...(g.kind === 'metric' ? {
          unit: g.unit, decimals: g.decimals,
          plan: { start: g.plan.start, target: g.plan.target, shape: g.plan.shape, fromWeek: g.plan.fromWeek ?? 0, dueWeek: planEnd(g.plan, x.cycle.weeks), setByHand: !!g.plan.points?.length,
            byWeek: planCheckpoints(g.plan.fromWeek ?? 0, planEnd(g.plan, x.cycle.weeks)).map((w) => ({ week: w, value: Number(planAt(g.plan, w, x.cycle.weeks).toFixed(g.decimals)) })) },
          earlierPlans: planHistoryOf(g).map((v) => ({ untilWeek: v.untilWeek, start: v.plan.start, target: v.plan.target, shape: v.plan.shape })),
        } : {}),
        ...(g.kind === 'range' ? { unit: g.unit, decimals: g.decimals, range: { mustStay: g.range.bound === 'atMost' ? 'atMost' : 'atLeast', limit: g.range.limit, margin: g.range.margin } } : {}),
        ...(g.kind === 'milestone' ? { stages: g.stages.map((st) => ({ id: st.id, name: st.name, dueWeek: st.dueWeek })) } : {}),
        now: { status: s.status, statusLabel: s.statusLabel, statusMeaning: MEANING[s.status], value: s.nowValue, text: s.now, planThisWeek: s.planNow, gap: s.gap, lastCheckInWeek: s.lastWeek, forecast: s.forecast },
        story: { since: s.story.since, where: s.story.where, outlook: s.story.outlook, whyItsOff: s.story.why, recoveryPlan: s.story.doing, byWhen: s.story.byWhen, needs: s.story.needs, nextStep: s.story.next, warnings: s.story.warnings, feeds: s.story.feeds },
        quarters: s.story.quarters.filter((q) => q.kind !== 'none').map((q) => ({ quarter: q.quarter.label, months: q.quarter.months, weeks: [q.quarter.from, q.quarter.to], result: q.kind, text: q.text })),
        result: s.story.result ? { kind: s.story.result.kind, label: RESULT_TEXT[s.story.result.kind], dueWeek: s.story.result.dueWeek, week: s.story.result.week } : null,
        checkIns: s.checkIns.map((c) => ({
          id: c.id, week: c.week, weekStarting: weekDate(x.cycle, c.week), value: c.value, stages: c.stages,
          planThatWeek: g.kind === 'metric' ? Number(planAt(planAsOf(g, c.week), c.week, x.cycle.weeks).toFixed(g.decimals)) : null,
          call: c.status, calculated: c.calculated, cause: c.cause, why: c.why || null, whyGreener: c.greenerWhy || null,
          pathToGreen: c.pathToGreen ? { what: c.pathToGreen.what, byWeek: c.pathToGreen.byWeek, needs: c.pathToGreen.needs || null, state: c.pathToGreen.state ?? 'plan' } : null,
          next: c.next || null, postedAt: c.postedAt, postedBy: name(c.authorId) || null, backfilled: !!c.backfilled,
        })),
      };
    }),
    notes: x.snapshot.decisions.filter((d) => sums.some((s) => s.goal.id === d.goalId) && ['note', 'ask', 'action'].includes(d.kind)).map((d) => ({
      goalId: d.goalId, goalKey: sums.find((s) => s.goal.id === d.goalId)?.goal.key ?? null, week: d.week, kind: d.kind === 'ask' ? 'question' : d.kind, by: name(d.byId), text: d.note,
      ...(d.kind === 'action' ? { who: name(d.assigneeId ?? '') || null, dueWeek: d.dueWeek ?? null } : {}),
      ...(d.kind === 'ask' ? { answer: answerOf(d, x.snapshot)?.text ?? null } : {}),
      at: d.at,
    })),
  };
}

/* ---------- the brief ---------- */

/** One goal's story, given room: why it's off, the recovery plan, by when, what's needed. */
function storyBlock(sm: GoalSummary, cycleWeeks: number): string[] {
  const st = sm.story;
  const g = sm.goal;
  const out: string[] = [];
  const tags = [st.since, st.result ? st.result.text : null].filter(Boolean).join(' · ');
  out.push(`### ${g.title}${g.key ? ` (${g.key})` : ''}`);
  out.push(`**${LABEL[sm.status]}**${tags ? ` · ${tags}` : ''} · ${sm.owner}, ${sm.team}${st.feeds ? ` · ${st.feeds}` : ''}`);
  out.push('');
  out.push(`- **Where it is:** ${st.where}`);
  if (st.outlook) out.push(`- **Where it’s heading:** ${st.outlook}`);
  if (sm.status === 'stale') {
    out.push(`- **What we know:** nothing new. ${st.warnings.join(' ')}`);
    return [...out, ''];
  }
  out.push(`- **Why it’s ${sm.status === 'off' ? 'off track' : 'at risk'}:** ${st.why ?? 'Not given.'}`);
  out.push(`- **Recovery plan:** ${st.doing ?? 'Not given.'}`);
  out.push(`- **Owner’s date:** ${st.byWhen?.replace(/^Owner’s date: b/, 'B') ?? 'No date given.'}`);
  if (st.needs) out.push(`- **Needs:** ${st.needs}`);
  if (st.next) out.push(`- **Next step:** ${st.next}`);
  for (const w of st.warnings) out.push(`- **Watch out:** ${w}`);
  void cycleWeeks;
  return [...out, ''];
}

/** A report a leader can read top to bottom: the decisions waiting on people, then every goal that's off, at risk or quiet told in full, results, then the rest. */
export function aiBrief(x: ExportInput): string {
  const { goals, sums } = prepare(x);
  const by = new Map(sums.map((s) => [s.goal.id, s]));
  const count = (k: string) => sums.filter((s) => s.status === k).length;
  const out: string[] = [];
  const off = sums.filter((s) => s.status === 'off'), risk = sums.filter((s) => s.status === 'risk'), quiet = sums.filter((s) => s.status === 'stale');
  const results = sums.filter((s) => s.story.result);
  const asks = sums.filter((s) => s.story.needs && ['off', 'risk'].includes(s.status));
  const flagged = sums.filter((s) => s.story.warnings.length && s.status !== 'stale');

  out.push(`# Goals: ${x.ws.name}`);
  out.push('');
  out.push(`${periodLabel(x.cycle, x.week)} (${weekDates(x.cycle, x.week)}). Exported ${x.today.toISOString().slice(0, 10)}.`);
  out.push('');
  const lead = [
    `${sums.length} goals`,
    off.length ? `${off.length} off track` : '', risk.length ? `${risk.length} at risk` : '', quiet.length ? `${quiet.length} with no recent update` : '',
    count('on') ? `${count('on')} on track` : '', count('done') ? `${count('done')} done` : '',
  ].filter(Boolean);
  out.push(`**${lead.join(', ')}.**${asks.length ? ` ${asks.length} ${asks.length === 1 ? 'owner needs' : 'owners need'} a decision or help.` : ''}${flagged.length ? ` ${flagged.length} ${flagged.length === 1 ? 'goal has' : 'goals have'} a warning below.` : ''}`);
  out.push('');

  out.push('## How to read the status');
  out.push('The status is the owner’s call each week, checked against the numbers; if the call is greener than the numbers, it says so.');
  for (const k of ['on', 'risk', 'off', 'stale'] as const) out.push(`- **${LABEL[k]}:** ${MEANING[k]}`);
  for (const k of ['completed', 'late', 'missed'] as const) out.push(`- **${RESULT_TEXT[k]}:** ${RESULT_MEANING[k]}`);
  out.push('');

  if (asks.length) {
    out.push('## Decisions and help needed');
    for (const s of asks) out.push(`- **${s.story.needs}** · for ${s.goal.title} (${s.owner}, ${LABEL[s.status].toLowerCase()})`);
    out.push('');
  }
  if (off.length) {
    out.push('## Off track: will miss without intervention');
    out.push('');
    for (const s of off) out.push(...storyBlock(s, x.cycle.weeks));
  }
  if (risk.length) {
    out.push('## At risk: could miss without a change');
    out.push('');
    for (const s of risk) out.push(...storyBlock(s, x.cycle.weeks));
  }
  if (quiet.length) {
    out.push('## No recent update: no check-in for two weeks or more');
    out.push('');
    for (const s of quiet) out.push(...storyBlock(s, x.cycle.weeks));
  }
  const otherWarnings = sums.filter((s) => ['on', 'done', 'none'].includes(s.status) && s.story.warnings.length);
  if (otherWarnings.length) {
    out.push('## Worth a look');
    for (const s of otherWarnings) out.push(`- **${s.goal.title}** (${s.owner}): ${s.story.warnings.join(' ')}`);
    out.push('');
  }
  if (results.length) {
    out.push('## Results');
    for (const k of ['missed', 'late', 'completed'] as const) {
      const list = results.filter((s) => s.story.result!.kind === k);
      if (!list.length) continue;
      out.push(`**${RESULT_TEXT[k]}** (${list.length})`);
      for (const s of list) out.push(`- ${s.goal.title} (${s.owner}): ${s.story.result!.text}. ${s.story.where}`);
    }
    out.push('');
  }

  if (isYear(x.cycle)) {
    const ended = quarters(x.cycle).filter((q) => x.week > q.to);
    if (ended.length) {
      out.push('## Quarters so far');
      out.push('Each quarter’s target is read off the owner’s own plan: where the plan said the goal would be at the quarter’s end.');
      for (const q of ended) {
        const rs = sums.map((s) => ({ s, r: s.story.quarters.find((y) => y.quarter.n === q.n)! })).filter((y) => y.r && (y.r.kind === 'met' || y.r.kind === 'missed'));
        const missed = rs.filter((y) => y.r.kind === 'missed');
        out.push(`- **${q.label} (${q.months}):** ${rs.length - missed.length} of ${rs.length} met their plan.${missed.length ? ` Missed: ${missed.map((y) => `${y.s.goal.title} (${y.r.text.replace(/^Q\d: /, '')})`).join('; ')}.` : ''}`);
      }
      const now = quarterOf(x.cycle, x.week);
      out.push(`- **${now.label} (${now.months}):** in progress, week ${x.week - now.from + 1} of ${now.to - now.from + 1}.`);
      out.push('');
    }
  }

  out.push('## Every goal, by what it feeds');
  const line = (s: GoalSummary, depth: number) => {
    const lvl = s.goal.level !== 'team' ? ` [${LEVEL_LABEL[s.goal.level]}]` : '';
    out.push(`${'  '.repeat(depth)}- **${s.goal.title}**${s.goal.key ? ` (${s.goal.key})` : ''}${lvl}: ${s.story.label}. Now ${s.now}, target ${s.target}${s.dueWeek !== x.cycle.weeks && !/by week \d+$/.test(s.target) ? ` by week ${s.dueWeek}` : ''}; ${s.gap}. Owner ${s.owner}.${s.forecast ? ' ' + s.forecast : ''}`);
  };
  const seen = new Set<string>();
  const walk = (g: Goal, depth: number) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    line(by.get(g.id)!, depth);
    goals.filter((c) => c.parentId === g.id).forEach((c) => walk(c, depth + 1));
  };
  goals.filter((g) => !g.parentId || !by.has(g.parentId)).forEach((g) => walk(g, 0));
  goals.forEach((g) => walk(g, 0)); // anything left in a loop
  out.push('');

  const ids = new Set(goals.map((g) => g.id));
  const open = x.snapshot.decisions.filter((d) => ids.has(d.goalId) && (d.kind === 'action' || (d.kind === 'ask' && !answerOf(d, x.snapshot))));
  if (open.length) {
    out.push('## Open questions and actions from reviews');
    const name = (id: string) => x.snapshot.people.find((p) => p.id === id)?.name ?? 'someone';
    for (const d of open) {
      const g = goals.find((y) => y.id === d.goalId)!;
      out.push(d.kind === 'ask'
        ? `- Question for ${name(g.ownerId)} on ${g.title} (week ${d.week}), not answered yet: ${d.note}`
        : `- Action for ${name(d.assigneeId ?? g.ownerId)}${d.dueWeek ? ` by week ${d.dueWeek}` : ''} on ${g.title}: ${d.note}`);
    }
    out.push('');
  }

  const withHistory = sums.filter((s) => s.checkIns.length);
  if (withHistory.length) {
    out.push('## Weekly history');
    out.push('Week: number [plan that week] (owner’s call), and the reason when it was behind.');
    for (const s of withHistory) {
      const g = s.goal;
      out.push(`- **${g.title}**${g.kind !== 'milestone' && g.unit ? ` (${g.unit})` : ''}`);
      for (const c of s.checkIns) {
        const v = g.kind === 'milestone' ? `${(c.stages ?? []).filter((u) => u.doneWeek != null).length}/${g.stages.length} stages` : c.value == null ? '—' : String(c.value);
        // The plan that applied in that week, as the goal page and quarter results judge it, not today's plan.
        const plan = g.kind === 'metric' ? ` [${Number(planAt(planAsOf(g, c.week), c.week, x.cycle.weeks).toFixed(g.decimals))}]` : '';
        const said = ['off', 'risk'].includes(c.status) && c.why && c.why !== 'On plan.' ? `: ${c.why}` : '';
        out.push(`  - w${c.week} ${v}${plan} (${LABEL[c.status].toLowerCase()})${said}${c.backfilled ? ' (loaded later)' : ''}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}
