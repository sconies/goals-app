import type { CheckIn, Cycle, Goal, MetricGoal, MetricPlan, PlanShape, PlanVersion } from './types';

const DAY = 86_400_000;

/** Days between two ISO dates or timestamps, by calendar date in UTC. */
function daysBetween(fromIso: string, to: Date): number {
  const from = Date.parse(fromIso.slice(0, 10) + 'T00:00:00Z');
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toDay - from) / DAY);
}

/** The cycle's week today: 0 in the first seven days, capped at the last checkpoint. */
export function currentWeek(cycle: Cycle, today: Date): number {
  const d = daysBetween(cycle.startDate, today);
  if (d < 0) return 0;
  return Math.min(cycle.weeks, Math.floor(d / 7));
}

/**
 * The week results are judged at (cycle-end spec, rule 2): the current week, or `weeks + 1` once the cycle's last day
 * is past, so a goal due in the last week gets its result, and the last quarter closes, without anyone pressing a
 * button. `currentWeek` stops at `weeks` (a check-in given after the end is dated the last week); only results, the
 * quarters and the end of "due" read this.
 */
export function resultWeek(cycle: Pick<Cycle, 'startDate' | 'weeks'>, today: Date): number {
  return Math.max(0, Math.min(cycle.weeks + 1, Math.floor(daysBetween(cycle.startDate, today) / 7)));
}

/** Whether the cycle's last day is past: nothing in it is due, late or out of date from then on. */
export const hasEnded = (cycle: Pick<Cycle, 'startDate' | 'weeks'>, today: Date) => resultWeek(cycle, today) > cycle.weeks;

/** Days since an ISO timestamp. */
export function daysSince(iso: string, today: Date): number {
  return daysBetween(iso, today);
}

/**
 * The first week whose given weekday (0 = Monday) falls on or after a date: the week a goal's first check-in is due,
 * and the week of a review's first session, when either is set up part way through a week (setup review, 8 Nov). Set up
 * on Sunday, after Thursday's review, both start the next week, so nothing is late on day one. Week 1 at the earliest.
 */
export function firstWeekFrom(cycle: Cycle, iso: string | undefined, weekday: number): number {
  const day = (iso ?? '').slice(0, 10);
  if (!day || day <= cycle.startDate) return 1;
  const w = currentWeek(cycle, new Date(day + 'T12:00:00Z'));
  const due = new Date(Date.parse(weekDate(cycle, w) + 'T00:00:00Z') + weekday * DAY).toISOString().slice(0, 10);
  return Math.max(1, due < day ? w + 1 : w);
}

/** The ISO date of a week's checkpoint. */
export function weekDate(cycle: Cycle, week: number): string {
  const t = Date.parse(cycle.startDate + 'T00:00:00Z') + week * 7 * DAY;
  return new Date(t).toISOString().slice(0, 10);
}

/** Share of the change planned by a week, 0..1. */
export function shapeProgress(shape: PlanShape, week: number, weeks: number): number {
  const w = Math.max(0, Math.min(weeks, week));
  if (shape === 'back') return Math.pow(w / weeks, 1.5);
  if (shape === 'stepped') {
    // Three equal steps, landing just after each third of the cycle and at the end.
    const s1 = Math.floor(weeks / 3) + 1;
    const s2 = Math.floor((2 * weeks) / 3) + 1;
    return ((w >= s1 ? 1 : 0) + (w >= s2 ? 1 : 0) + (w >= weeks ? 1 : 0)) / 3;
  }
  return w / weeks;
}

/** The week a plan's target is due: its own end week, or the cycle's end. */
export const planEnd = (plan: MetricPlan, weeks: number) => plan.endWeek ?? weeks;

/**
 * Goal entry, rule 12: the share of a plan's whole change that falls in its last quarter of weeks (rounded up), from 0
 * to 1, with `k` that many weeks of `n`. A steady plan of 7 weeks leaves about 0.29 to its last 2; from 10, the weeks
 * 10, 10, 10, 10, 9, 8 and then 5 leave 0.8. Zero for a plan with no change.
 */
export function lateShare(plan: MetricPlan, weeks: number): { share: number; k: number; n: number } {
  const end = planEnd(plan, weeks);
  const from = Math.min(plan.fromWeek ?? 0, end - 1);
  const n = end - from;
  const k = Math.max(1, Math.ceil(n / 4));
  const whole = plan.target - plan.start;
  if (!whole) return { share: 0, k, n };
  return { share: Math.max(0, Math.min(1, (plan.target - planAt(plan, end - k, weeks)) / whole)), k, n };
}

export function planAt(plan: MetricPlan, week: number, weeks: number): number {
  const end = planEnd(plan, weeks);
  const from = Math.min(plan.fromWeek ?? 0, end - 1);
  if (week <= from) return plan.start;
  if (week >= end) return plan.target;
  if (plan.points?.length) {
    // Numbers set by hand: straight lines between the start, each checkpoint and the target.
    const pts = [{ week: from, value: plan.start }, ...plan.points.filter((p) => p.week > from && p.week < end).sort((a, b) => a.week - b.week), { week: end, value: plan.target }];
    const i = pts.findIndex((p) => p.week >= week);
    const a = pts[i - 1]!, b = pts[i]!;
    return a.value + (b.value - a.value) * ((week - a.week) / (b.week - a.week));
  }
  return plan.start + (plan.target - plan.start) * shapeProgress(plan.shape, week - from, end - from);
}

/** The checkpoints a plan table shows: every week for a short plan; every four weeks and each quarter's end for a longer one; and the end. */
export function planCheckpoints(from: number, end: number): number[] {
  const step = end - from > 16 ? 4 : 1;
  const out = new Set<number>();
  for (let w = from + step; w < end; w += step) out.add(w);
  // A plan longer than a quarter always shows each quarter's end (weeks 13, 26, 39), so quarter targets are in the table.
  if (step > 1) for (let w = 13; w < end; w += 13) if (w > from) out.add(w);
  out.add(end);
  return [...out].sort((a, b) => a - b);
}

/** The week of 31 December in the year a cycle starts, counted from the cycle's start (at least 1). */
export function yearEndWeek(cycle: Cycle): number {
  const start = Date.parse(cycle.startDate + 'T00:00:00Z');
  const dec31 = Date.UTC(new Date(start).getUTCFullYear(), 11, 31);
  return Math.max(1, Math.floor((dec31 - start) / (7 * 86_400_000)));
}

export interface Point {
  week: number;
  value: number;
}

/** One value per week from the check-ins: the latest posted that week wins. */
export function valueSeries(checkIns: CheckIn[]): Point[] {
  const byWeek = new Map<number, CheckIn>();
  for (const c of checkIns) {
    if (c.value == null) continue;
    const prev = byWeek.get(c.week);
    if (!prev || prev.postedAt <= c.postedAt) byWeek.set(c.week, c);
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week).map((c) => ({ week: c.week, value: c.value as number }));
}

/** How many recent weeks of numbers a projection is fitted to. */
export const PROJECTION_WEEKS = 8;

/** Where the recent trend takes a number by a week: the likeliest value and a range around it. */
export interface Projection {
  /** The fitted line's value at `week`. */
  value: number;
  /** The range: about two chances in three that the number lands inside it if nothing changes. */
  low: number;
  high: number;
  /** The week projected to. */
  week: number;
  /** The first and last weeks of numbers the fit used. */
  from: number;
  to: number;
  /** The fitted change per week. */
  slope: number;
}

/**
 * Where the number lands by `toWeek` if the recent trend holds (approved by Lane, 5 Nov). A least-squares line through
 * the numbers of the last eight weeks, not a slope between two points, so one noisy week can't swing it; and a range,
 * not a single number: the spread of the numbers around the line, widening the further it reaches. A clean trend has
 * no spread, so its range is the line itself. Needs a number at least three weeks before the latest one (the window
 * reaches back to it when the recent weeks are sparse). The app, the import, the reviews and the AI assistant all ask here.
 */
export function projection(series: Point[], toWeek: number): Projection | null {
  const last = series[series.length - 1];
  if (!last) return null;
  let pts = series.filter((p) => p.week > last.week - PROJECTION_WEEKS);
  if (last.week - pts[0]!.week < 3) {
    const earlier = [...series].reverse().find((p) => p.week <= last.week - 3);
    if (!earlier) return null;
    pts = [earlier, ...pts.filter((p) => p.week > earlier.week)];
  }
  const n = pts.length;
  const xm = pts.reduce((s, p) => s + p.week, 0) / n;
  const ym = pts.reduce((s, p) => s + p.value, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.week - xm) ** 2, 0);
  const slope = pts.reduce((s, p) => s + (p.week - xm) * (p.value - ym), 0) / sxx;
  const at = (w: number) => ym + slope * (w - xm);
  const sse = pts.reduce((s, p) => s + (p.value - at(p.week)) ** 2, 0);
  const spread = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  // A slope the numbers barely support counts for little: on a number that swings week to week, the line leans only as
  // far as the evidence for it (t² / (1 + t²), t the slope over its standard error). A clean trend keeps its full slope.
  const se = spread / Math.sqrt(sxx);
  const t = se > 1e-12 ? slope / se : Infinity;
  const lean = Number.isFinite(t) ? (t * t) / (1 + t * t) : 1;
  const value = ym + lean * slope * (toWeek - xm);
  // The range: where the trend line itself could be, from the spread around it, wider the further it reaches.
  const half = spread * Math.sqrt(1 / n + (toWeek - xm) ** 2 / sxx);
  const tidy = (v: number) => Math.round(v * 1e9) / 1e9;
  return { value: tidy(value), low: tidy(value - half), high: tidy(value + half), week: toWeek, from: pts[0]!.week, to: last.week, slope: tidy(lean * slope) };
}

/** Does a percentage goal measure a share (its whole plan within 0–100%), so a value over 100% can't be real? */
export function isShare(goal?: Goal): boolean {
  return !!goal && goal.kind !== 'milestone' && goal.unit.trim() === '%' && planValues(goal).every((v) => v >= 0 && v <= 100);
}

/** Units that are a time, money, points or a score, so never a count (trimmed, lower case): the whole unit is one of the
    words, or it has a currency code or sign, or a degree sign, anywhere in it. */
export const NOT_A_COUNT = /^(days?|hours?|hrs?|mins?|minutes?|weeks?|secs?|seconds?|ms|pts?|points?|score|nps)$|usd|gbp|eur|\$|£|€|°/;

/**
 * Does a number goal count things (deploys, templates, runbooks, incidents)? Whole numbers, a plan that never goes
 * below zero, and a unit that isn't a share, a time, money or a score (a score can go below zero).
 */
export function isCount(goal?: Goal): boolean {
  if (!goal || goal.kind === 'milestone' || goal.decimals !== 0) return false;
  const unit = goal.unit.trim().toLowerCase();
  if (unit === '%' || NOT_A_COUNT.test(unit)) return false;
  return planValues(goal).every((v) => v >= 0 && Number.isInteger(v));
}
function planValues(goal: Goal): number[] {
  if (goal.kind === 'metric') return [goal.plan.start, goal.plan.target, ...(goal.plan.points ?? []).map((p) => p.value)];
  if (goal.kind === 'range') return [goal.range.limit];
  return [];
}

/**
 * A goal's projection, held to the values its number can take: a count's range stops at zero, a share's stays within
 * 0–100%. Every projection of a goal's own numbers comes from here (the status rules, the scorecard, the summary facts
 * and the path-to-green check), so a count is never projected below zero anywhere.
 */
export function projectionFor(goal: Goal, series: Point[], toWeek: number): Projection | null {
  const p = projection(series, toWeek);
  if (!p) return null;
  const share = isShare(goal);
  if (!share && !isCount(goal)) return p;
  const hold = (v: number) => Math.max(0, share ? Math.min(100, v) : v);
  return { ...p, value: hold(p.value), low: hold(p.low), high: hold(p.high) };
}

/** The likeliest value of the projection: where the number lands by `weeks` if the recent trend holds. */
export function forecast(series: Point[], weeks: number): number | null {
  return projection(series, weeks)?.value ?? null;
}

// Made once: a formatter is slow to make, and every goal's summary asks for a week's dates (AX4).
const DAY_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "2–8 Nov" (or "28 Oct–3 Nov"): the calendar days of a cycle week, Monday to Sunday. */
export function weekDates(cycle: Cycle, week: number): string {
  const a = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  const b = new Date(a.getTime() + 6 * 86_400_000);
  const d = (x: Date, month: boolean) => (month ? DAY_MONTH : DAY_ONLY).format(x);
  const range = a.getUTCMonth() === b.getUTCMonth() ? `${d(a, false)}–${d(b, true)}` : `${d(a, true)}–${d(b, true)}`;
  // A week in another calendar year than the cycle's own says which: "28 Dec–3 Jan 2027". The cycle's year is week 1's
  // (its start can be the week before, in the previous December).
  const own = new Date(Date.parse(cycle.startDate + 'T00:00:00Z') + 10 * 86_400_000).getUTCFullYear();
  return b.getUTCFullYear() !== own || a.getUTCFullYear() !== own ? `${range} ${b.getUTCFullYear()}` : range;
}

/** The earlier plans of a number goal, oldest first, including one kept only as the original plan (before the history existed). */
export function planHistoryOf(g: MetricGoal): PlanVersion[] {
  if (g.planHistory?.length) return g.planHistory;
  return g.originalPlan && g.rebaselinedWeek != null ? [{ untilWeek: g.rebaselinedWeek, plan: g.originalPlan }] : [];
}

/** The plan that applied in a given week. */
export function planAsOf(g: MetricGoal, week: number): MetricPlan {
  return planHistoryOf(g).find((v) => week < v.untilWeek)?.plan ?? g.plan;
}

/** The goal as it was planned in a given week: number goals take the plan that applied then; others are unchanged. */
export function goalAsOf<G extends Goal>(g: G, week: number): G {
  if (g.kind !== 'metric') return g;
  const plan = planAsOf(g, week);
  return plan === g.plan ? g : { ...g, plan };
}
