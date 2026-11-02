/* Goals are set for the year; quarters are a way of looking at it. A cycle of 48 weeks or more is a goal year,
   split into four quarters of 13 weeks from the month it starts. Quarter targets aren't entered separately:
   they're read off the owner's own plan, so any week in between has a target too. */
import { fmt, fmtDiff } from './format';
import { planAt, planEnd } from './plan';
import { checkInsFor } from './status';
import type { CheckIn, Cycle, Goal } from './types';

export const isYear = (c: Cycle) => c.weeks >= 48;

export interface Quarter {
  n: number;
  /** "Q1", or the cycle's name when the cycle isn't a year. */
  label: string;
  /** "Jan–Mar". */
  months: string;
  from: number;
  to: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The month the year starts in: the month of its first Thursday, so a year starting 29 Dec is a January year. */
export function startMonth(c: Cycle): number {
  return new Date(Date.parse(c.startDate + 'T00:00:00Z') + 3 * 86_400_000).getUTCMonth();
}

export function quarters(c: Cycle): Quarter[] {
  if (!isYear(c)) return [{ n: 1, label: c.name, months: '', from: 1, to: c.weeks }];
  const m0 = startMonth(c);
  return [1, 2, 3, 4].map((n) => ({
    n, label: `Q${n}`,
    months: `${MONTHS[(m0 + 3 * (n - 1)) % 12]}–${MONTHS[(m0 + 3 * (n - 1) + 2) % 12]}`,
    from: (n - 1) * 13 + 1,
    to: n === 4 ? c.weeks : n * 13,
  }));
}

export function quarterOf(c: Cycle, week: number): Quarter {
  const qs = quarters(c);
  return qs.find((q) => week >= q.from && week <= q.to) ?? (week < 1 ? qs[0]! : qs[qs.length - 1]!);
}

/** "Week 43 of 52 · Q4 (Oct–Dec) · 2026", or "Week 7 of 13 · Platform cycle" for a shorter cycle. */
export function periodLabel(c: Cycle, week: number): string {
  if (!isYear(c)) return `Week ${Math.max(0, week)} of ${c.weeks} · ${c.name}`;
  const q = quarterOf(c, week);
  return `Week ${Math.max(0, week)} of ${c.weeks} · ${q.label} (${q.months}) · ${c.name}`;
}

/** The plan's number at the end of a quarter (or the week given), for a number goal. */
export function targetAt(g: Goal, c: Cycle, week: number): number | null {
  if (g.kind !== 'metric') return null;
  return planAt(g.plan, Math.min(week, planEnd(g.plan, c.weeks)), c.weeks);
}

export interface QuarterResult {
  quarter: Quarter;
  kind: 'met' | 'missed' | 'open' | 'none';
  /** "Q3: 63% against a plan of 64%, 1 pt short." */
  text: string;
}

/** How a goal did against its plan in one quarter. Open while the quarter runs; none when there was nothing due. */
export function quarterResult(g: Goal, c: Cycle, checkIns: CheckIn[], q: Quarter, week: number): QuarterResult {
  const own = checkInsFor(g, checkIns).filter((x) => x.week <= q.to);
  const last = own[own.length - 1];
  const ended = week > q.to;
  const r = (kind: QuarterResult['kind'], text: string): QuarterResult => ({ quarter: q, kind, text: `${q.label}: ${text}` });
  if (g.kind === 'metric') {
    if ((g.plan.fromWeek ?? 0) >= q.to || planEnd(g.plan, c.weeks) < q.from) return r('none', 'nothing planned');
    const t = targetAt(g, c, q.to)!;
    if (!ended) return r('open', `plan ${fmt(t, g)} by week ${Math.min(q.to, planEnd(g.plan, c.weeks))}`);
    const v = last?.value;
    if (v == null) return r('missed', `no number reported against a plan of ${fmt(t, g)}`);
    const up = g.plan.target >= g.plan.start;
    const diff = Number((v - t).toFixed(g.decimals));
    const met = up ? v >= t - 1e-9 : v <= t + 1e-9;
    return r(met ? 'met' : 'missed', `${fmt(v, g)} against a plan of ${fmt(t, g)}${met ? '' : `, ${fmtDiff(diff, g)} short`}`);
  }
  if (g.kind === 'milestone') {
    const due = g.stages.filter((s) => s.dueWeek >= q.from && s.dueWeek <= q.to);
    if (!due.length) return r('none', 'no stages due');
    if (!ended) return r('open', `${due.length} ${due.length === 1 ? 'stage' : 'stages'} due`);
    const done = due.filter((s) => last?.stages?.some((u) => u.stageId === s.id && u.doneWeek != null && u.doneWeek <= q.to));
    return r(done.length === due.length ? 'met' : 'missed', `${done.length} of ${due.length} ${due.length === 1 ? 'stage' : 'stages'} due ${done.length === 1 ? 'was' : 'were'} done`);
  }
  if (!ended) return r('open', `must stay ${g.range.bound === 'atMost' ? 'at most' : 'at least'} ${fmt(g.range.limit, g)}`);
  const v = last?.value;
  if (v == null) return r('missed', 'no number reported');
  const out = g.range.bound === 'atMost' ? v > g.range.limit : v < g.range.limit;
  return r(out ? 'missed' : 'met', `${fmt(v, g)} at the end, ${out ? 'outside' : 'inside'} the ${fmt(g.range.limit, g)} limit`);
}

export function quarterResults(g: Goal, c: Cycle, checkIns: CheckIn[], week: number): QuarterResult[] {
  if (!isYear(c)) return [];
  return quarters(c).map((q) => quarterResult(g, c, checkIns, q, week));
}

/** When a number goal's target can be due: the end of the year, or the end of a quarter still to come. A shorter cycle offers its end and the year's. */
export function dueOptions(c: Cycle, week: number, yearEnd: number): [number, string][] {
  if (!isYear(c)) return [[c.weeks, 'End of the cycle'], yearEnd > c.weeks ? [yearEnd, 'End of the year'] : [52, 'A year from now']];
  return [[c.weeks, 'Year end'], ...quarters(c).filter((q) => q.to < c.weeks && q.to > week).map((q): [number, string] => [q.to, `End of ${q.label}`])];
}

/** "year" for a goal year, "cycle" for a shorter cycle: for wording. */
export const periodWord = (c: Cycle) => (isYear(c) ? 'year' : 'cycle');

/** "Week 43 · Q4" in a goal year; "Week 7 of 13" in a shorter cycle. */
export function shortPeriod(c: Cycle, week: number): string {
  return isYear(c) ? `Week ${Math.max(0, week)} · ${quarterOf(c, week).label}` : `Week ${Math.max(0, week)} of ${c.weeks}`;
}

/** The goal year that contains today, starting in the given month (0 = January): week 0 is the Monday on or before the 1st. */
export function yearStartFor(today: Date, month: number): string {
  const y = today.getUTCMonth() >= month ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const first = new Date(Date.UTC(y, month, 1));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  return first.toISOString().slice(0, 10);
}
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
