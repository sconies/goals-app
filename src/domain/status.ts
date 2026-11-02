/* The status rules. Pure functions: same inputs, same answer, on every screen. */
import { daysSince, currentWeek, forecast, planAt, type Point, planEnd } from './plan';
import type { CheckIn, Cycle, DisplayStatus, Goal, MetricGoal, MilestoneGoal, RangeGoal, StageUpdate, Status } from './types';

export const RANK: Record<DisplayStatus, number> = { done: 0, planned: 0, none: 0, on: 1, risk: 2, stale: 2, off: 3 };
export const LABEL: Record<DisplayStatus, string> = {
  on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done', stale: 'Stale', planned: 'Not started', none: 'No check-in',
};

/** Thresholds, as the spec states them. */
export const RULES = {
  onTrack: 0.95,
  atRisk: 0.8,
  wellAhead: 1.2,
  staleDays: 14,
  /** A milestone stage more than this many weeks late is off track. */
  lateWeeksOff: 2,
} as const;

export type Calc = Status | 'planned' | 'none';

export interface MetricAssessment {
  kind: 'metric';
  week: number;
  calc: Calc;
  actual: number | null;
  plan: number;
  target: number;
  /** Share of the planned change achieved so far; null before a plan has moved. */
  ratio: number | null;
  forecast: number | null;
  forecastMisses: boolean;
  ahead: boolean;
  behind: boolean;
}

export interface RangeAssessment {
  kind: 'range';
  week: number;
  calc: Calc;
  actual: number | null;
  previous: number | null;
  out: boolean;
  previousOut: boolean;
  near: boolean;
}

export type StageKind = 'done' | 'planned' | 'risk' | 'off';
export interface StageState {
  id: string;
  name: string;
  dueWeek: number;
  kind: StageKind;
  doneWeek: number | null;
  /** When it is now expected, if not done. */
  expectedWeek: number;
  weeksLate: number;
}

export interface MilestoneAssessment {
  kind: 'milestone';
  week: number;
  calc: Calc;
  stages: StageState[];
  doneCount: number;
  dueCount: number;
  late: StageState[];
}

export type Assessment = MetricAssessment | RangeAssessment | MilestoneAssessment;

export function assessMetric(goal: MetricGoal, weeks: number, week: number, actual: number | null, history: Point[]): MetricAssessment {
  const { start, target } = goal.plan;
  const plan = planAt(goal.plan, week, weeks);
  const series = actual == null ? history : [...history.filter((p) => p.week < week), { week, value: actual }];
  // Project to when the target is due: the cycle's end, or later for a goal that runs to the end of the year.
  const fc = forecast(series, planEnd(goal.plan, weeks));
  const dir = Math.sign(target - start);
  const base = { kind: 'metric' as const, week, plan, target, actual, forecast: fc, forecastMisses: fc != null && (fc - target) * dir < 0 };
  if (week === 0) return { ...base, calc: 'planned', ratio: null, ahead: false, behind: false };
  if (actual == null) return { ...base, calc: 'none', ratio: null, ahead: false, behind: false };
  const planned = plan - start;
  if (Math.abs(planned) < 1e-9) {
    // Nothing planned yet (a stepped plan before its first step): fine unless it went backwards.
    const backwards = (actual - start) * dir < 0;
    return { ...base, calc: backwards ? 'risk' : 'on', ratio: null, ahead: false, behind: backwards };
  }
  // Rounded, so 95% of the plan is 95%, not 94.99999…% from floating point.
  const ratio = Math.round(((actual - start) / planned) * 1e9) / 1e9;
  const calc: Status = ratio >= RULES.onTrack ? 'on' : ratio >= RULES.atRisk ? 'risk' : 'off';
  return { ...base, calc, ratio, ahead: ratio >= RULES.wellAhead, behind: ratio < RULES.onTrack };
}

export function assessRange(goal: RangeGoal, week: number, actual: number | null, previous: number | null): RangeAssessment {
  const { bound, limit, margin } = goal.range;
  const isOut = (v: number | null) => v != null && (bound === 'atMost' ? v > limit : v < limit);
  const isNear = (v: number | null) => v != null && (bound === 'atMost' ? v > limit - margin : v < limit + margin);
  const out = isOut(actual), previousOut = isOut(previous), near = isNear(actual);
  let calc: Calc;
  if (week === 0) calc = 'planned';
  else if (actual == null) calc = 'none';
  else if (out && previousOut) calc = 'off';
  else if (out || previousOut || near) calc = 'risk';
  else calc = 'on';
  return { kind: 'range', week, calc, actual, previous, out, previousOut, near };
}

export function assessMilestone(goal: MilestoneGoal, week: number, updates: StageUpdate[] | null): MilestoneAssessment {
  const stages: StageState[] = goal.stages.map((s) => {
    const u = updates?.find((x) => x.stageId === s.id);
    if (u?.doneWeek != null) {
      return { id: s.id, name: s.name, dueWeek: s.dueWeek, kind: 'done', doneWeek: u.doneWeek, expectedWeek: u.doneWeek, weeksLate: Math.max(0, u.doneWeek - s.dueWeek) };
    }
    // Not done: expected when the owner says, and never earlier than this week once it is overdue.
    let expected = Math.max(u?.forecastWeek ?? s.dueWeek, s.dueWeek);
    if (s.dueWeek < week) expected = Math.max(expected, week);
    const late = expected - s.dueWeek;
    const kind: StageKind = late > RULES.lateWeeksOff ? 'off' : late > 0 ? 'risk' : 'planned';
    return { id: s.id, name: s.name, dueWeek: s.dueWeek, kind, doneWeek: null, expectedWeek: expected, weeksLate: late };
  });
  const doneCount = stages.filter((s) => s.kind === 'done').length;
  const dueCount = goal.stages.filter((s) => s.dueWeek <= week).length;
  const late = stages.filter((s) => s.kind === 'off' || s.kind === 'risk');
  let calc: Calc;
  if (stages.length > 0 && doneCount === stages.length) calc = 'done';
  else if (week === 0) calc = 'planned';
  else if (late.some((s) => s.kind === 'off')) calc = 'off';
  else if (late.length) calc = 'risk';
  else calc = 'on';
  return { kind: 'milestone', week, calc, stages, doneCount, dueCount, late };
}

const byGoalCache = new WeakMap<CheckIn[], { n: number; last: CheckIn | undefined; index: Map<string, CheckIn[]> }>();
/** The goal's own check-ins, oldest first. Indexed once per list of check-ins (and again if the list grows), so asking for every goal stays cheap. */
export function checkInsFor(goal: Goal, all: CheckIn[]): CheckIn[] {
  let hit = byGoalCache.get(all);
  if (!hit || hit.n !== all.length || hit.last !== all[all.length - 1]) {
    const index = new Map<string, CheckIn[]>();
    for (const c of all) { const l = index.get(c.goalId); if (l) l.push(c); else index.set(c.goalId, [c]); }
    for (const l of index.values()) l.sort((a, b) => a.week - b.week || a.postedAt.localeCompare(b.postedAt));
    hit = { n: all.length, last: all[all.length - 1], index };
    byGoalCache.set(all, hit);
  }
  const index = hit.index;
  return [...(index.get(goal.id) ?? [])];
}

/** Assess a goal from what has been posted: the latest check-in's numbers at its week. */
export function assessPosted(goal: Goal, cycle: Cycle, checkIns: CheckIn[], week: number): Assessment {
  const own = checkInsFor(goal, checkIns).filter((c) => c.week <= week);
  const latest = own[own.length - 1] ?? null;
  const at = latest ? latest.week : week;
  if (goal.kind === 'metric') {
    const series = own.filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value as number }));
    return assessMetric(goal, cycle.weeks, at, latest?.value ?? null, series.filter((p) => p.week < at));
  }
  if (goal.kind === 'range') {
    const prev = own.filter((c) => c.week < at && c.value != null).pop();
    return assessRange(goal, at, latest?.value ?? null, prev?.value ?? null);
  }
  return assessMilestone(goal, week, latest?.stages ?? null);
}

export interface GoalStatus {
  /** The official status: the owner's latest call, unless it has gone stale. */
  status: DisplayStatus;
  calc: Calc;
  latest: CheckIn | null;
  /** The owner's call is greener than the calculation. */
  greener: boolean;
  daysSinceCheckIn: number | null;
  week: number;
}

export function goalStatus(goal: Goal, cycle: Cycle, checkIns: CheckIn[], today: Date): GoalStatus {
  const week = currentWeek(cycle, today);
  const own = checkInsFor(goal, checkIns);
  const latest = own.length ? own.reduce((a, b) => (b.postedAt > a.postedAt ? b : a)) : null;
  const calc = assessPosted(goal, cycle, checkIns, week).calc;
  const days = latest ? daysSince(latest.postedAt, today) : null;
  let status: DisplayStatus;
  if (latest?.status === 'done') status = 'done';
  else if (week === 0) status = 'planned';
  else if (latest && days != null && days < RULES.staleDays) status = latest.status;
  else if (!latest && daysSince(goal.createdAt && goal.createdAt.slice(0, 10) > cycle.startDate ? goal.createdAt : cycle.startDate, today) < RULES.staleDays) status = 'none';
  else status = 'stale';
  const greener = latest != null && RANK[latest.status] < RANK[latest.calculated];
  return { status, calc, latest, greener, daysSinceCheckIn: days, week };
}

/** Roll a set of statuses up to the worst one, counting stale as at risk. */
export function worst(statuses: DisplayStatus[]): DisplayStatus {
  if (!statuses.length) return 'none';
  if (statuses.every((s) => s === 'done')) return 'done';
  const r = Math.max(...statuses.map((s) => RANK[s]));
  return r >= 3 ? 'off' : r === 2 ? 'risk' : statuses.some((s) => s === 'on' || s === 'done') ? 'on' : statuses[0] ?? 'none';
}
