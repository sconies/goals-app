/* The status rules. Pure functions: same inputs, same answer, on every screen. */
import { daysSince, currentWeek, weekDate, goalAsOf, hasEnded, planAt, projectionFor, type Point, type Projection, planEnd } from './plan';
import type { CheckIn, Cycle, DisplayStatus, Goal, MetricGoal, MilestoneGoal, RangeGoal, StageUpdate, Status } from './types';
import { RULES, rhythmOf, staleAfterDays } from './thresholds';
import { rangeNear, rangeOut } from './range';
import { LABEL, STATUS_ORDER } from './vocabulary';

/* What each status is called and means lives in the vocabulary (domain/vocabulary.ts); the thresholds in thresholds.ts. */
export { LABEL, RULES };

export const RANK: Record<DisplayStatus, number> = { done: 0, planned: 0, none: 0, on: 1, risk: 2, stale: 2, off: 3 };

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
  /** The likeliest value by the due week if the recent trend holds (the projection's middle). */
  forecast: number | null;
  /** The projection to the due week, as a range: plan.ts works it out. */
  projection: Projection | null;
  /** The likeliest value falls short of the target. */
  forecastMisses: boolean;
  ahead: boolean;
  behind: boolean;
  /**
   * Set when the number is on plan only as written at the goal's decimals (the plan moved less than they can show):
   * the share of the planned move it is, unrounded (0.75 for 0.41 against 0.4067).
   */
  asWritten?: number;
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
  const pr = projectionFor(goal, series, planEnd(goal.plan, weeks));
  const fc = pr?.value ?? null;
  const dir = Math.sign(target - start);
  const base = { kind: 'metric' as const, week, plan, target, actual, forecast: fc, projection: pr, forecastMisses: fc != null && (fc - target) * dir < 0 };
  if (week === 0) return { ...base, calc: 'planned', ratio: null, ahead: false, behind: false };
  if (actual == null) return { ...base, calc: 'none', ratio: null, ahead: false, behind: false };
  const planned = plan - start;
  if (Math.abs(planned) < 1e-9) {
    // Nothing planned yet (a stepped plan before its first step): fine unless it went backwards.
    const backwards = (actual - start) * dir < 0;
    return { ...base, calc: backwards ? 'risk' : 'on', ratio: null, ahead: false, behind: backwards };
  }
  // Rounded, so 95% of the plan is 95%, not 94.99999…% from floating point.
  const ratioOf = (v: number) => Math.round(((v - start) / planned) * 1e9) / 1e9;
  // A number is typed to the goal's decimals. When the plan has moved less than they can show (a new goal's first
  // week: 0.42 to 0.4067 USD, with two decimals), no number they can write is on track: 0.41 reads as behind, 0.40 as
  // well ahead. Then the plan as written at those decimals (0.41) is on plan, as the gap beside it already says.
  if (Math.abs(actual - Number(plan.toFixed(goal.decimals ?? 0))) < 1e-9 && !onTrackTypeable(start, planned, goal.decimals ?? 0, ratioOf)) {
    return { ...base, calc: 'on', ratio: 1, ahead: false, behind: false, asWritten: ratioOf(actual) };
  }
  const ratio = ratioOf(actual);
  const calc: Status = ratio >= RULES.onTrack ? 'on' : ratio >= RULES.atRisk ? 'risk' : 'off';
  return { ...base, calc, ratio, ahead: ratio >= RULES.wellAhead, behind: ratio < RULES.onTrack };
}

/** Can any number written to `decimals` places be on track (95% of the planned move or more, short of well ahead)? */
function onTrackTypeable(start: number, planned: number, decimals: number, ratioOf: (v: number) => number): boolean {
  const step = 10 ** -decimals;
  const a = start + planned * RULES.onTrack, b = start + planned * RULES.wellAhead;
  // A band as wide as one step always holds a number; only a narrower one needs looking at, a step or two.
  if (Math.abs(b - a) >= step) return true;
  for (let k = Math.floor(Math.min(a, b) / step) - 1, end = Math.ceil(Math.max(a, b) / step) + 1; k <= end; k++) {
    const r = ratioOf(Number((k * step).toFixed(decimals)));
    if (r >= RULES.onTrack && r < RULES.wellAhead) return true;
  }
  return false;
}

export function assessRange(goal: RangeGoal, week: number, actual: number | null, previous: number | null): RangeAssessment {
  const isOut = (v: number | null) => v != null && rangeOut(goal.range, v);
  const isNear = (v: number | null) => v != null && rangeNear(goal.range, v);
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
    // The latest number is judged against the plan that applied in its week, not one set since.
    return assessMetric(goalAsOf(goal, at), cycle.weeks, at, latest?.value ?? null, series.filter((p) => p.week < at));
  }
  if (goal.kind === 'range') {
    const prev = own.filter((c) => c.week < at && c.value != null).pop();
    return assessRange(goal, at, latest?.value ?? null, prev?.value ?? null);
  }
  // Nothing reported yet and nothing due: that's no evidence, not "on schedule" (product review, 3 Nov). A stage
  // that's already late is late whether or not anyone has checked in.
  const m = assessMilestone(goal, week, latest?.stages ?? null);
  return !latest && m.calc === 'on' ? { ...m, calc: 'none' } : m;
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
  /** The latest check-in's week when it isn't this week's, else null (FT1). Worked out whatever the rhythm; screens say
      "as of week {n}" only with no set rhythm (with one, No recent update does that job). */
  asOfWeek: number | null;
}

export function goalStatus(goal: Goal, cycle: Cycle, checkIns: CheckIn[], today: Date): GoalStatus {
  const week = currentWeek(cycle, today);
  const own = checkInsFor(goal, checkIns);
  const latest = own.length ? own.reduce((a, b) => (b.postedAt > a.postedAt ? b : a)) : null;
  const calc = assessPosted(goal, cycle, checkIns, week).calc;
  const days = latest ? daysSince(latest.postedAt, today) : null;
  const quiet = daysWithoutUpdate(goal, cycle, latest, today);
  let status: DisplayStatus;
  if (latest?.status === 'done') status = 'done';
  else if (week === 0) status = 'planned';
  // Once the cycle's last day is past nothing in it is out of date: a goal keeps the last status given (cycle-end rule 2).
  else if (hasEnded(cycle, today)) status = latest ? latest.status : 'none';
  else {
    // With no set rhythm nothing goes quiet: a goal is what it last said (FT1).
    const after = staleAfterDays(cycle);
    status = after == null || quiet < after ? (latest ? latest.status : 'none') : 'stale';
  }
  const greener = latest != null && RANK[latest.status] < RANK[latest.calculated];
  const asOfWeek = latest && latest.week !== week ? latest.week : null;
  return { status, calc, latest, greener, daysSinceCheckIn: days, week, asOfWeek };
}

/**
 * The check-in that closed a goal: its latest (as of `week`, when given), if the owner called it done. A done goal shows
 * its final result: no forecast, no projection, and no quarter after it still running (backlog 9 Nov, item 2).
 */
export function doneCheckIn(goal: Goal, checkIns: CheckIn[], week?: number): CheckIn | null {
  const own = checkInsFor(goal, checkIns).filter((c) => week == null || c.week <= week);
  const latest = own.length ? own.reduce((a, b) => (b.postedAt > a.postedAt ? b : a)) : null;
  return latest?.status === 'done' ? latest : null;
}

/** Whether a goal projects where it will end: not when its last check-in is too old, once it's done, or once it's stopped. */
export const projects = (goal: Goal, status: DisplayStatus) => status !== 'stale' && status !== 'done' && !goal.stoppedAt;

/**
 * Days since a goal's latest check-in was posted, or, with none, since it began (the cycle's start, or when it was
 * added if later), and never from before the present check-in rhythm began (`rhythmFrom`, FT1). The one rule for "no
 * recent update": stale at staleAfterDays(cycle), and the Goals filter "Last check-in N weeks ago or more" counts the
 * same days in weeks.
 */
export function daysWithoutUpdate(goal: Goal, cycle: Cycle, latest: CheckIn | null, today: Date): number {
  // Nothing is late for a time before the present rhythm began (FT1): a rhythm switched on today counts from today.
  const rhythm = cycle.rhythmFrom ? rhythmOf(cycle)?.from ?? '' : '';
  if (latest) return daysSince(rhythm > latest.postedAt.slice(0, 10) ? rhythm : latest.postedAt, today);
  // A plan that starts later (its From still to come, goal entry rule 13) begins then: nothing is late before it.
  const from = goal.kind === 'metric' && (goal.plan.fromWeek ?? 0) > 0 ? weekDate(cycle, goal.plan.fromWeek!) : '';
  const began = [cycle.startDate, goal.createdAt ? goal.createdAt.slice(0, 10) : '', from, rhythm].reduce((a, b) => (b > a ? b : a));
  return daysSince(began, today);
}

/**
 * A group's status: the worst real status in it, never one it doesn't have. A group with a goal that has no recent
 * update and none worse says No recent update, not At risk. Every goal done is done; otherwise on track beats a goal
 * merely not started or without a check-in yet, as it always has.
 */
export function worst(statuses: DisplayStatus[]): DisplayStatus {
  if (!statuses.length) return 'none';
  if (statuses.every((s) => s === 'done')) return 'done';
  const r = Math.max(...statuses.map((s) => RANK[s]));
  if (r === 1) return 'on';
  return STATUS_ORDER.find((k) => RANK[k] === r && statuses.includes(k)) ?? statuses[0]!;
}

