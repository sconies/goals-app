import type { CheckIn, Cycle, MetricPlan, PlanShape } from './types';

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

/** Days since an ISO timestamp. */
export function daysSince(iso: string, today: Date): number {
  return daysBetween(iso, today);
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

/**
 * Where the metric lands at the end of the cycle if the last three weeks' trend holds.
 * Needs a value at least three weeks before the latest one.
 */
export function forecast(series: Point[], weeks: number): number | null {
  const last = series[series.length - 1];
  if (!last) return null;
  const earlier = [...series].reverse().find((p) => p.week <= last.week - 3);
  if (!earlier) return null;
  const slope = (last.value - earlier.value) / (last.week - earlier.week);
  return last.value + slope * (weeks - last.week);
}

/** "2–8 Nov" (or "28 Oct–3 Nov"): the calendar days of a cycle week, Monday to Sunday. */
export function weekDates(cycle: Cycle, week: number): string {
  const a = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  const b = new Date(a.getTime() + 6 * 86_400_000);
  const d = (x: Date, month: boolean) => x.toLocaleDateString('en-GB', { day: 'numeric', ...(month ? { month: 'short' } : {}), timeZone: 'UTC' });
  const range = a.getUTCMonth() === b.getUTCMonth() ? `${d(a, false)}–${d(b, true)}` : `${d(a, true)}–${d(b, true)}`;
  // A week in another calendar year than the cycle's start says which: "28 Dec–3 Jan 2027".
  return b.getUTCFullYear() !== Number(cycle.startDate.slice(0, 4)) ? `${range} ${b.getUTCFullYear()}` : range;
}
