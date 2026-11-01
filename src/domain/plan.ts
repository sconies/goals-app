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

export function planAt(plan: MetricPlan, week: number, weeks: number): number {
  const from = Math.min(plan.fromWeek ?? 0, weeks - 1);
  if (week <= from) return plan.start;
  return plan.start + (plan.target - plan.start) * shapeProgress(plan.shape, week - from, weeks - from);
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
