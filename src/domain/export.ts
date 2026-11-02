/* Exports: the same goals as a workbook (for Excel), CSV, JSON (for scripts and AIs) and a short brief in
   Markdown (to paste into any AI chat). Pure functions; the app turns them into files.
   The Goals, Plan and Check-ins sheets use the import's column names, so an export can be edited and loaded back. */
import { causeLabel } from './checkin';
import { LEVEL_LABEL } from './format';
import { planAt, planCheckpoints, planEnd, weekDate } from './plan';
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

export const GOAL_EXPORT_COLUMNS = ['ID', 'Goal', 'Level', 'Team', 'Owner', 'Type', 'Unit', 'Decimals', 'Start', 'Target', 'Plan', 'Plan from week', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages', 'Feeds into', 'Feeds into ID', 'Why it helps', 'Effect', 'Source', 'Definition'] as const;
export const GOAL_DERIVED_COLUMNS = ['Status', 'Now', 'Plan this week', 'Gap', 'Last check-in week', 'Forecast'] as const;
export const CHECKIN_EXPORT_COLUMNS = ['Goal ID', 'Goal', 'Week', 'Week starting', 'Value', 'Stages', 'Call', 'Calculated', 'Plan that week', 'Cause', 'Why', 'Why greener', 'Path to green', 'Recovery', 'Back on plan by week', 'Needs', 'Next step', 'Posted at', 'Posted by', 'Backfilled'] as const;

function goalRow(s: GoalSummary, all: Goal[]): Cell[] {
  const g = s.goal;
  const parent = g.parentId ? all.find((x) => x.id === g.parentId) : null;
  const m = g.kind === 'metric' ? g : null, r = g.kind === 'range' ? g : null;
  return [
    g.id, g.title, levelWord[g.level], s.team, s.owner, kindWord[g.kind],
    g.kind === 'milestone' ? null : g.unit, g.kind === 'milestone' ? null : g.decimals,
    m ? m.plan.start : null, m ? m.plan.target : null, m ? shapeWord[m.plan.shape] : null, m ? m.plan.fromWeek ?? 0 : null, m ? m.plan.endWeek ?? null : null,
    r ? r.range.limit : null, r ? (r.range.bound === 'atMost' ? 'at most' : 'at least') : null, r ? r.range.margin : null,
    g.kind === 'milestone' ? g.stages.map((x) => `${x.name}@${x.dueWeek}`).join('; ') : null,
    parent?.title ?? null, parent?.id ?? null, g.whyHelps || null, g.effect, g.source || null, g.definition || null,
    s.statusLabel, s.now, s.planNow != null ? s.planNowText : null, s.gap, s.lastWeek, s.forecast,
  ];
}

function checkInRows(x: ExportInput, sums: GoalSummary[], name: (id: string) => string): Cell[][] {
  const rows: Cell[][] = [];
  for (const s of sums) {
    const g = s.goal;
    for (const c of s.checkIns) {
      const ptg = c.pathToGreen;
      rows.push([
        g.id, g.title, c.week, weekDate(x.cycle, c.week), c.value, stagesText(g, c) || null,
        LABEL[c.status], LABEL[c.calculated], g.kind === 'metric' ? Number(planAt(g.plan, c.week, x.cycle.weeks).toFixed(g.decimals)) : null,
        c.cause ? causeLabel(c.cause) : null, c.why || null, c.greenerWhy || null,
        ptg?.what || null, ptg ? RECOVERY[ptg.state ?? 'plan'] : null, ptg?.byWeek ?? null, ptg?.needs || null,
        c.next || null, c.postedAt, name(c.authorId) || null, c.backfilled ? 'yes' : null,
      ]);
    }
  }
  return rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])) || Number(a[2]) - Number(b[2]));
}

/** The plan as numbers, one row per number goal and one column per week (every week to its due week). */
function planRows(x: ExportInput, sums: GoalSummary[]): Cell[][] {
  const metric = sums.map((s) => s.goal).filter((g): g is Extract<Goal, { kind: 'metric' }> => g.kind === 'metric');
  const last = Math.max(x.cycle.weeks, ...metric.map((g) => planEnd(g.plan, x.cycle.weeks)));
  const weeks = Array.from({ length: last }, (_, i) => i + 1);
  return [
    ['ID', 'Goal', 'Unit', 'Start', ...weeks.map((w) => `Week ${w}`)],
    ...metric.map((g) => {
      const end = planEnd(g.plan, x.cycle.weeks);
      const from = g.plan.fromWeek ?? 0;
      return [g.id, g.title, g.unit, g.plan.start, ...weeks.map((w) => (w <= from || w > end ? null : Number(planAt(g.plan, w, x.cycle.weeks).toFixed(g.decimals))))];
    }),
  ];
}

const README: Cell[][] = [
  ['Sheet', 'Column', 'What it means', 'When loaded back'],
  ['Goals', 'ID', 'The goal’s identity. Keep it to update the goal; leave it empty for a new goal.', 'Matches the goal'],
  ['Goals', 'Level', 'north star, svp or team', 'Changes the level'],
  ['Goals', 'Type', 'metric (move a number), range (keep a number in range) or milestone (hit dated stages)', 'Can’t change on an existing goal'],
  ['Goals', 'Start, Target, Plan, Due week', 'Number goals: where it starts, the target, the plan’s shape (straight, back-loaded, stepped) and the week the target is due', 'Changes the plan; needs a reason once check-ins have started'],
  ['Goals', 'Limit, Must stay, Margin', 'Range goals: the limit, at most or at least, and how close counts as at risk', 'Changes the range'],
  ['Goals', 'Stages', 'Milestone goals: Name@week, separated by semicolons', 'Changes the stages'],
  ['Goals', 'Status, Now, Plan this week, Gap, Last check-in week, Forecast', 'Worked out by the app when exported', 'Ignored'],
  ['Plan', 'Week N', 'The planned number each week. Type over any week to set the plan by hand', 'Sets the plan numbers'],
  ['Check-ins', 'Goal ID, Week, Value or Stages', 'One row per goal per week', 'Adds or replaces that week’s check-in'],
  ['Check-ins', 'Call', 'The owner’s status call: On track, At risk, Off track or Done. Empty: the rules decide', 'Used as the call; a call greener than the numbers needs Why greener'],
  ['Check-ins', 'Cause, Why, Path to green, Back on plan by week, Needs', 'Why it’s ahead or behind, and how it gets back', 'Required when behind, as in the app'],
  ['Check-ins', 'Calculated, Plan that week, Posted at, Posted by, Backfilled', 'Recorded by the app', 'Ignored'],
  ['People', 'Name, Job title, Team, Admin, Team objective', 'Who’s who', 'Not loaded back yet'],
];

export function workbook(x: ExportInput): Table[] {
  const { goals, sums, name } = prepare(x);
  const ids = new Set(goals.map((g) => g.id));
  const notes = x.snapshot.decisions.filter((d) => ids.has(d.goalId) && ['note', 'ask', 'action'].includes(d.kind));
  const goalTitle = (id: string) => goals.find((g) => g.id === id)?.title ?? '';
  return [
    { name: 'Goals', rows: [[...GOAL_EXPORT_COLUMNS, ...GOAL_DERIVED_COLUMNS], ...sums.map((s) => goalRow(s, x.snapshot.goals))] },
    { name: 'Plan', rows: planRows(x, sums) },
    { name: 'Check-ins', rows: [[...CHECKIN_EXPORT_COLUMNS], ...checkInRows(x, sums, name)] },
    { name: 'Notes and actions', rows: [['Goal ID', 'Goal', 'Week', 'Kind', 'Said by', 'Text', 'Who', 'Due week', 'Review', 'Answer', 'At'], ...notes.map((d) => [d.goalId, goalTitle(d.goalId), d.week, d.kind === 'ask' ? 'Question' : d.kind === 'action' ? 'Action' : 'Note', name(d.byId), d.note, d.kind === 'action' ? name(d.assigneeId ?? '') || null : null, d.dueWeek ?? null, x.snapshot.reviews.find((r) => r.id === d.reviewId)?.name ?? null, d.kind === 'ask' ? answerOf(d, x.snapshot)?.text ?? null : null, d.at])] },
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
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t) && !/^-?\d/.test(t)) t = "'" + t;
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
    about: 'Goals, their plans and weekly check-ins. "status" is the owner’s latest call, or stale after 14 days without a check-in. Weeks count from the cycle start (week 0).',
    workspace: { id: x.ws.id, name: x.ws.name },
    cycle: { id: x.cycle.id, name: x.cycle.name, startDate: x.cycle.startDate, weeks: x.cycle.weeks, currentWeek: x.week },
    people: x.snapshot.people.map((p) => ({ id: p.id, name: p.name, jobTitle: p.role || null, team: team(p.teamId), admin: p.admin })),
    teams: x.snapshot.teams.map((t) => ({ id: t.id, name: t.name, objective: t.objective || null })),
    goals: sums.map((s) => {
      const g = s.goal;
      return {
        id: g.id, title: g.title, level: g.level, type: g.kind, team: s.team, owner: s.owner, ownerId: g.ownerId,
        feedsIntoId: g.parentId, whyItHelps: g.whyHelps || null, source: g.source || null, definition: g.definition || null,
        ...(g.kind === 'metric' ? {
          unit: g.unit, decimals: g.decimals,
          plan: { start: g.plan.start, target: g.plan.target, shape: g.plan.shape, fromWeek: g.plan.fromWeek ?? 0, dueWeek: planEnd(g.plan, x.cycle.weeks), setByHand: !!g.plan.points?.length,
            byWeek: planCheckpoints(g.plan.fromWeek ?? 0, planEnd(g.plan, x.cycle.weeks)).map((w) => ({ week: w, value: Number(planAt(g.plan, w, x.cycle.weeks).toFixed(g.decimals)) })) },
        } : {}),
        ...(g.kind === 'range' ? { unit: g.unit, decimals: g.decimals, range: { mustStay: g.range.bound === 'atMost' ? 'atMost' : 'atLeast', limit: g.range.limit, margin: g.range.margin } } : {}),
        ...(g.kind === 'milestone' ? { stages: g.stages.map((st) => ({ id: st.id, name: st.name, dueWeek: st.dueWeek })) } : {}),
        now: { status: s.status, statusLabel: s.statusLabel, value: s.nowValue, text: s.now, planThisWeek: s.planNow, gap: s.gap, lastCheckInWeek: s.lastWeek, forecast: s.forecast, why: s.why || null, pathToGreen: s.pathToGreen || null, needs: s.needs || null },
        checkIns: s.checkIns.map((c) => ({
          week: c.week, weekStarting: weekDate(x.cycle, c.week), value: c.value, stages: c.stages,
          call: c.status, calculated: c.calculated, cause: c.cause, why: c.why || null, whyGreener: c.greenerWhy || null,
          pathToGreen: c.pathToGreen ? { what: c.pathToGreen.what, byWeek: c.pathToGreen.byWeek, needs: c.pathToGreen.needs || null, state: c.pathToGreen.state ?? 'plan' } : null,
          next: c.next || null, postedAt: c.postedAt, postedBy: name(c.authorId) || null, backfilled: !!c.backfilled,
        })),
      };
    }),
    notes: x.snapshot.decisions.filter((d) => sums.some((s) => s.goal.id === d.goalId) && ['note', 'ask', 'action'].includes(d.kind)).map((d) => ({
      goalId: d.goalId, week: d.week, kind: d.kind === 'ask' ? 'question' : d.kind, by: name(d.byId), text: d.note,
      ...(d.kind === 'action' ? { who: name(d.assigneeId ?? '') || null, dueWeek: d.dueWeek ?? null } : {}),
      ...(d.kind === 'ask' ? { answer: answerOf(d, x.snapshot)?.text ?? null } : {}),
      at: d.at,
    })),
  };
}

/* ---------- AI brief ---------- */

/** A short, readable brief to paste into an AI chat: what's off and why, then every goal by tree, then the weekly numbers. */
export function aiBrief(x: ExportInput): string {
  const { goals, sums } = prepare(x);
  const by = new Map(sums.map((s) => [s.goal.id, s]));
  const count = (k: string) => sums.filter((s) => s.status === k).length;
  const out: string[] = [];
  out.push(`# Goals: ${x.ws.name}, ${x.cycle.name}`);
  out.push('');
  out.push(`Week ${x.week} of ${x.cycle.weeks}. Exported ${x.today.toISOString().slice(0, 10)}. The status is the owner’s latest call; “stale” means no check-in for two weeks or more. Gaps compare the latest number with that week’s plan.`);
  out.push('');
  const parts = (['off', 'risk', 'stale', 'none', 'on', 'done', 'planned'] as const).map((k) => [k, count(k)] as const).filter(([, n]) => n).map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`);
  out.push(`**${sums.length} goals:** ${parts.join(', ') || 'none'}.`);
  out.push('');

  const bad = sums.filter((s) => ['off', 'risk', 'stale'].includes(s.status));
  if (bad.length) {
    out.push('## Needs attention');
    for (const s of bad) {
      out.push(`- **${s.goal.title}** (${s.owner}, ${s.team}): ${s.statusLabel}. Now ${s.now}${s.planNow != null ? `, plan ${s.planNowText}` : ''}; ${s.gap}.`);
      if (s.why) out.push(`  - Why: ${s.why}`);
      if (s.pathToGreen) out.push(`  - Path to green: ${s.pathToGreen}`);
      if (s.needs) out.push(`  - Needs: ${s.needs}`);
    }
    out.push('');
  }

  out.push('## Every goal, by what it feeds');
  const line = (s: GoalSummary, depth: number) => {
    const lvl = s.goal.level !== 'team' ? ` [${LEVEL_LABEL[s.goal.level]}]` : '';
    out.push(`${'  '.repeat(depth)}- **${s.goal.title}**${lvl}: ${s.statusLabel}. Now ${s.now}, target ${s.target}${s.dueWeek !== x.cycle.weeks ? ` by week ${s.dueWeek}` : ''}; ${s.gap}. Owner ${s.owner}.${s.forecast ? ' ' + s.forecast : ''}`);
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
    out.push('## Open questions and actions');
    const name = (id: string) => x.snapshot.people.find((p) => p.id === id)?.name ?? 'someone';
    for (const d of open) {
      const g = goals.find((y) => y.id === d.goalId)!;
      out.push(d.kind === 'ask'
        ? `- Question for ${name(g.ownerId)} on ${g.title} (week ${d.week}): ${d.note}`
        : `- Action for ${name(d.assigneeId ?? g.ownerId)}${d.dueWeek ? ` by week ${d.dueWeek}` : ''} on ${g.title}: ${d.note}`);
    }
    out.push('');
  }

  const withHistory = sums.filter((s) => s.checkIns.length);
  if (withHistory.length) {
    out.push('## Weekly history');
    out.push('Week: number (owner’s call). Plan in brackets for number goals.');
    for (const s of withHistory) {
      const g = s.goal;
      const cells = s.checkIns.map((c) => {
        const v = g.kind === 'milestone' ? `${(c.stages ?? []).filter((u) => u.doneWeek != null).length}/${g.stages.length} stages` : c.value == null ? '—' : String(c.value);
        const plan = g.kind === 'metric' ? ` [${Number(planAt(g.plan, c.week, x.cycle.weeks).toFixed(g.decimals))}]` : '';
        return `w${c.week} ${v}${plan} (${LABEL[c.status].toLowerCase()})`;
      });
      out.push(`- ${g.title}${g.kind !== 'milestone' && g.unit ? ` (${g.unit})` : ''}: ${cells.join('; ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}
