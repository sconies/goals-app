/* Years and weeks (goal entry, rule 13; GE9). The data is unchanged: `MetricPlan.fromWeek`, `MetricPlan.endWeek` and
   `Stage.dueWeek` stay whole numbers counted from the cycle's start (week 0 is the week before week 1). People see a goal
   year and its week, always with the dates and their year. This is the one place that converts each way: every screen,
   the sheet and the AI tools ask here, and nothing else turns a cycle's week into a year's.

   A goal year is a run of weeks from its week 1 (the week holding the first Thursday of the month the year starts in) to
   the week before the next one's week 1: 52 or 53 weeks (year.ts goalYear). In a goal year that starts in January its
   year and week are the ISO week date. The cycle's own goal year holds weeks 1 to `cycle.weeks`; week n of the cycle
   beyond that is in the next goal year, and week 0 and below in the previous one. A cycle shorter than a goal year (under
   48 weeks) names its weeks by their dates alone: the ISO week date, whatever its length (GE9 review).

   Reads a cycle's `startDate` and `weeks` and nothing else. Pure. */
import { goalYear, startMonth, yearWeeks } from './year';
import type { Cycle } from './types';

export type C = Pick<Cycle, 'startDate' | 'weeks'>;
export const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The Monday of a cycle week, as a time. */
export const mondayOf = (c: C, n: number) => Date.parse(c.startDate + 'T00:00:00Z') + n * 7 * DAY;
/** The cycle's own goal year: the calendar year of its week 1's Thursday. */
export const cycleYear = (c: C) => new Date(Date.parse(c.startDate + 'T00:00:00Z') + 10 * DAY).getUTCFullYear();

/** The goal years around a cycle: each with its year, its length and the cycle week its week 1 is. */
export interface Span { year: number; weeks: number; first: number }
/** The goal year a cycle week is in: its year, its length and the cycle week its week 1 is. */
export function spanOf(c: C, n: number): Span {
  if (c.weeks < 48) {
    // A shorter cycle: the calendar's own year of that week (the ISO week date), from the week's Thursday.
    const year = new Date(mondayOf(c, n) + 3 * DAY).getUTCFullYear(), gy = goalYear(year, 0);
    return { year, weeks: gy.weeks, first: Math.round((Date.parse(gy.startDate + 'T00:00:00Z') - mondayOf(c, 0)) / (7 * DAY)) + 1 };
  }
  let s: Span = { year: cycleYear(c), weeks: c.weeks, first: 1 };
  // Later years: each starts the week after the one before ends, with its own length.
  while (n >= s.first + s.weeks) {
    const start = new Date(mondayOf(c, s.first + s.weeks - 1)).toISOString().slice(0, 10);
    s = { year: s.year + 1, weeks: yearWeeks(start), first: s.first + s.weeks };
  }
  // Earlier years: the previous goal year starting in the same month.
  while (n < s.first) {
    const p = goalYear(s.year - 1, startMonth(c)).weeks;
    s = { year: s.year - 1, weeks: p, first: s.first - p };
  }
  return s;
}

export interface YearWeek { year: number; week: number; monday: string }

/** Rule 13. A cycle week as a goal year and its week: 46 is 2026 week 46; 54 is 2027 week 1; 0 is 2025 week 52. */
export function yearWeek(c: C, n: number): YearWeek {
  const s = spanOf(c, n);
  return { year: s.year, week: n - s.first + 1, monday: new Date(mondayOf(c, n)).toISOString().slice(0, 10) };
}

/** A goal year seen from this cycle: its length and the cycle week its week 1 is. */
function spanOfYear(c: C, year: number): Span {
  let s = spanOf(c, 1);
  while (s.year < year) s = spanOf(c, s.first + s.weeks);
  while (s.year > year) s = spanOf(c, s.first - 1);
  return s;
}



/** Rule 13. The inverse of `yearWeek`: the cycle week of a goal year's week, or null when that year has no such week. */
export function cycleWeek(c: C, at: { year: number; week: number }): number | null {
  if (!Number.isInteger(at.year) || at.year < 1900 || at.year > 2200) return null;
  const s = spanOfYear(c, at.year);
  if (!Number.isInteger(at.week) || at.week < 1 || at.week > s.weeks) return null;
  return s.first + at.week - 1;
}

/** Rule 13. A week as a file writes it: "2026-W46". */
export function weekCode(c: C, n: number): string {
  const y = yearWeek(c, n);
  return `${y.year}-W${String(y.week).padStart(2, '0')}`;
}

/** The words for a week that doesn't exist: "2027 has 52 weeks. Use 2027-W52, or 2028-W01." */
export const noSuchWeek = (year: number, weeks: number) => `${year} has ${weeks} weeks. Use ${year}-W${weeks}, or ${year + 1}-W01.`;

/**
 * Rule 13. A week as a file or a tool may give it: "2026-W46", "2026W46", "2026-46" (a goal year and its week), or "W46"
 * and "46" (the cycle's week, as today's numbers are). A week a year doesn't have is `week-unknown` with its own words.
 */
export function readWeekCode(c: C, raw: string): { n: number } | { problem: 'week-unknown'; text?: string } {
  const v = raw.trim();
  const coded = /^(\d{4})\s*-?\s*W?\s*(\d{1,2})$/i.exec(v);
  if (coded) {
    const year = Number(coded[1]), week = Number(coded[2]);
    const n = cycleWeek(c, { year, week });
    return n == null ? { problem: 'week-unknown', text: noSuchWeek(year, spanOfYear(c, year).weeks) } : { n };
  }
  const plain = /^W?\s*(-?\d{1,3})$/i.exec(v);
  if (plain) return { n: Number(plain[1]) };
  return { problem: 'week-unknown' };
}

/** "{Field} says “{raw}”. Write a year and a week, like 2026-W46 (this week), or the week’s number." (section 4, week-unknown) */
export const weekUnknownText = (c: C, field: string, raw: string, now = 46) => `${field} says “${raw.trim()}”. Write a year and a week, like ${weekCode(c, Math.max(now, 1))}, or the week’s number.`;

/** "9–15 Nov 2026", "28 Sep–4 Oct 2026", "28 Dec 2026–3 Jan 2027"; without the year: "9–15 Nov", "28 Dec–3 Jan". */
export function datesOf(c: C, n: number, withYear = true): string {
  const a = new Date(mondayOf(c, n)), b = new Date(mondayOf(c, n) + 6 * DAY);
  const dm = (x: Date) => `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
  if (!withYear) return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${dm(b)}` : `${dm(a)}–${dm(b)}`;
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${dm(a)} ${a.getUTCFullYear()}–${dm(b)} ${b.getUTCFullYear()}`;
  return (a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${dm(b)}` : `${dm(a)}–${dm(b)}`) + ' ' + b.getUTCFullYear();
}

/**
 * Rule 13. A week in words, never without its dates and their year:
 * - `field` "Week 46 · 9–15 Nov 2026" (another goal year's: "Week 13 · 29 Mar–4 Apr 2027");
 * - `row` "Week 46 · 9–15 Nov" (in a list under its year);
 * - `sentence` "week 46 (9–15 Nov 2026)" in the cycle's own goal year, "week 13 of 2027 (29 Mar–4 Apr 2027)" in another;
 * - `short` "week 46", "week 13 of 2027".
 */
export function weekSays(c: C, n: number, form: 'field' | 'row' | 'sentence' | 'short'): string {
  const y = yearWeek(c, n);
  const of = y.year === cycleYear(c) ? '' : ` of ${y.year}`;
  if (form === 'field') return `Week ${y.week} · ${datesOf(c, n)}`;
  if (form === 'row') return `Week ${y.week} · ${datesOf(c, n, false)}`;
  if (form === 'short') return `week ${y.week}${of}`;
  return `week ${y.week}${of} (${datesOf(c, n)})`;
}

/** Rule 13. The latest week anything can be: the last week of the next goal year (105 in the demo's 2026). */
export const lastWeekOffered = (c: C) => { const own = spanOf(c, 1), next = spanOf(c, own.first + own.weeks); return next.first + next.weeks - 1; };
/** The earliest week From can be: the first week of the previous goal year (−51 in the demo's 2026). */
export const firstWeekOffered = (c: C) => spanOf(c, spanOf(c, 1).first - 1).first;
/** Rule 13. To when nothing says it: the cycle's end, or, for a From at or past it, the end of next year (GE9 review). */
export const defaultTo = (c: C, from: number) => (from < c.weeks ? c.weeks : lastWeekOffered(c));

/** "· starts week 50": the summary line's end for a goal not started yet (plan.ts notStarted). */
export const startsSays = (c: C, from: number) => `starts ${weekSays(c, from, 'short')}`;

/**
 * Must fix for a plan's two weeks, as cycle weeks (section 4): `to-before-from` and `week-beyond`. Null when both are
 * fine. The picker can't make either; a file or a tool can.
 */
export function weeksProblem(c: C, from: number, to: number): { id: 'to-before-from' | 'week-beyond'; field: 'from' | 'to'; text: string } | null {
  const end = lastWeekOffered(c), first = firstWeekOffered(c);
  const own = cycleYear(c);
  if (to > end) return { id: 'week-beyond', field: 'to', text: `To can be as late as ${weekSays(c, end, 'short')} (${datesOf(c, end)}), the end of next year.` };
  if (from > end) return { id: 'week-beyond', field: 'from', text: `From can be as late as ${weekSays(c, end, 'short')} (${datesOf(c, end)}), the end of next year.` };
  if (from < first) return { id: 'week-beyond', field: 'from', text: `From can be as early as week 1 of ${own - 1}.` };
  if (to <= from) return { id: 'to-before-from', field: 'to', text: `To (${weekSays(c, to, 'short')}, ${datesOf(c, to)}) isn’t after From (${weekSays(c, from, 'short')}, ${datesOf(c, from)}). The plan has to run forwards.` };
  return null;
}
