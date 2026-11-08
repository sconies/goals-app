/* Goals are set for the year; quarters are a way of looking at it. A cycle of 48 weeks or more is a goal year,
   split into four quarters of 13 weeks from the month it starts. Its weeks follow the calendar: week 1 is the week with
   the first Thursday of the month it starts in, so in a January year week n is ISO week n, and the year runs to the
   week before the next one's week 1 (52 or 53 weeks). Week 0 is the week before, for setting starting numbers. Quarter targets aren't entered separately:
   they're read off the owner's own plan, so any week in between has a target too. */
import { fmt, fmtDiff } from './format';
import { goalAsOf } from './goal';
import { planAt, planEnd } from './plan';
import { checkInsFor } from './status';
import { shortWord } from './vocabulary';
import type { CheckIn, Cycle, Goal } from './types';

export const isYear = (c: Cycle) => c.weeks >= 48;
const DAY = 86_400_000;

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
/** The month the year starts in: the month of week 1's Thursday. */
export function startMonth(c: Pick<Cycle, 'startDate'>): number {
  return new Date(Date.parse(c.startDate + 'T00:00:00Z') + 10 * DAY).getUTCMonth();
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

/** "Week 45 of 53 · Q4 (Oct–Dec) · 2026", or "Week 7 of 13 · Platform cycle" for a shorter cycle. */
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
    // A closed quarter is judged against the plan that applied at its end, not one set later.
    const p = ended ? goalAsOf(g, q.to) : g;
    if ((p.plan.fromWeek ?? 0) >= q.to || planEnd(p.plan, c.weeks) < q.from) return r('none', 'nothing planned');
    const t = targetAt(p, c, q.to)!;
    if (!ended) return r('open', `plan ${fmt(t, g)} by week ${Math.min(q.to, planEnd(p.plan, c.weeks))}`);
    const v = last?.value;
    if (v == null) return r('missed', `no number reported against a plan of ${fmt(t, g)}`);
    const better = p.plan.target >= p.plan.start ? 1 : -1;
    // Compared as shown, at the goal's decimals: 0.68 against a plan shown as 0.68 is met (demo review, 8 Nov).
    const diff = Number(((Number(v.toFixed(g.decimals)) - Number(t.toFixed(g.decimals))) * better).toFixed(g.decimals));
    const met = diff >= 0;
    return r(met ? 'met' : 'missed', `${fmt(v, g)} against a plan of ${fmt(t, g)}${met ? '' : `, ${fmtDiff(diff, g)} ${shortWord(better)}`}`);
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

/** "Week 45 · Q4" in a goal year; "Week 7 of 13" in a shorter cycle. */
export function shortPeriod(c: Cycle, week: number): string {
  return isYear(c) ? `Week ${Math.max(0, week)} · ${quarterOf(c, week).label}` : `Week ${Math.max(0, week)} of ${c.weeks}`;
}

/** The Monday of week 1 of a goal year starting in a month (0 = January): the week with that month's first Thursday. */
export function weekOneOf(year: number, month: number): number {
  const first = Date.UTC(year, month, 1);
  const dow = (new Date(first).getUTCDay() + 6) % 7; // Monday = 0
  return first + ((10 - dow) % 7) * DAY - 3 * DAY;
}

export interface GoalYear { startDate: string; weeks: number }
/** A goal year: week 0 is the week before week 1, and it runs until the next year's week 1. */
export function goalYear(year: number, month: number): GoalYear {
  const a = weekOneOf(year, month), b = weekOneOf(year + 1, month);
  return { startDate: new Date(a - 7 * DAY).toISOString().slice(0, 10), weeks: Math.round((b - a) / (7 * DAY)) };
}
/** The goal year starting in a month that today is in, counting its week 0: set up in the last days of December, that's next year. */
export function goalYearFor(today: Date, month: number): GoalYear {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let y = today.getUTCFullYear() + 1;
  while (weekOneOf(y, month) - 7 * DAY > t) y--;
  return goalYear(y, month);
}
export const yearStartFor = (today: Date, month: number) => goalYearFor(today, month).startDate;
/** How many weeks the goal year starting on this date has: 52, or 53 in a long calendar year. */
export function yearWeeks(startDate: string): number {
  const thu = new Date(Date.parse(startDate + 'T00:00:00Z') + 10 * DAY);
  return goalYear(thu.getUTCFullYear(), thu.getUTCMonth()).weeks;
}
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
