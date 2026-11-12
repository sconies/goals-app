/* The week picker's side of years and weeks (goal entry, rule 13; GE9): what is typed into it, what a week is, what it
   offers for a field, and the line under a plan's weeks. Beside domain/weeks, which converts and says weeks for every
   screen, the sheet and the AI tools; this part is only needed by New goal and the edit page, which load when opened.
   Pure. */
import { cycleWeek, cycleYear, datesOf, DAY, firstWeekOffered, lastWeekOffered, mondayOf, spanOf, weekSays, yearWeek, type C } from './weeks';
import { LABEL } from './vocabulary';

const MONTH_WORDS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * Rule 13. What is typed in the week picker's text field, as a cycle week: a number is that week of the year shown;
 * "14 Dec", "14/12" or "14 December 2026" the week holding that day (with no year, the next such day from this week);
 * "2027 5" week 5 of 2027. Null when it can't be read.
 */
export function readWeek(c: C, week: number, raw: string, shownYear: number): number | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return null;
  const yw = /^(\d{4})[ -]w?(\d{1,2})$/.exec(v);
  if (yw) return cycleWeek(c, { year: Number(yw[1]), week: Number(yw[2]) });
  const num = /^w?(\d{1,2})$/.exec(v);
  if (num) return cycleWeek(c, { year: shownYear, week: Number(num[1]) });
  let day: number, month: number, year: number | null = null;
  const words = /^(\d{1,2}) ([a-z]+)\.?(?: (\d{4}))?$/.exec(v);
  const slash = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?$/.exec(v);
  if (words) {
    month = MONTH_WORDS.findIndex((m) => words[2]!.length >= 3 && m.startsWith(words[2]!));
    if (month < 0) return null;
    day = Number(words[1]); year = words[3] ? Number(words[3]) : null;
  } else if (slash) {
    day = Number(slash[1]); month = Number(slash[2]) - 1; year = slash[3] ? Number(slash[3]) : null;
    if (month < 0 || month > 11) return null;
  } else return null;
  const from = mondayOf(c, week);
  const at = (y: number) => Date.UTC(y, month, day);
  let t: number;
  if (year != null) t = at(year);
  else { const y0 = new Date(from).getUTCFullYear(); t = at(y0) >= from ? at(y0) : at(y0 + 1); }
  if (new Date(t).getUTCDate() !== day) return null;
  return Math.floor((t - Date.parse(c.startDate + 'T00:00:00Z')) / (7 * DAY));
}

/** The quarter a week of its goal year closes, when it closes one: Q1 to Q4, 13 weeks each, Q4 to the year's end. */
function quarterEnd(c: C, n: number): number | null {
  const s = spanOf(c, n), w = n - s.first + 1;
  if (w === s.weeks) return 4;
  return w === 13 ? 1 : w === 26 ? 2 : w === 39 ? 3 : null;
}

/**
 * Rule 13. What a week is, in one line under the picker: "This week", "Next week", "The end of 2026", "The start of 2026",
 * "The end of Q3" (with the year when it isn't this goal year's: "The end of Q1 2027"), "6 weeks ago", "In 3 weeks".
 */
export function weekIs(c: C, n: number, week: number): string {
  if (n === week) return 'This week';
  if (n === week + 1) return 'Next week';
  const y = yearWeek(c, n), s = spanOf(c, n);
  if (y.week === s.weeks) return `The end of ${y.year}`;
  if (y.week === 1) return `The start of ${y.year}`;
  const q = quarterEnd(c, n);
  if (q) return `The end of Q${q}${y.year === cycleYear(c) ? '' : ' ' + y.year}`;
  return n < week ? `${week - n} week${week - n === 1 ? '' : 's'} ago` : `In ${n - week} weeks`;
}

export type WeekField = 'from' | 'to' | 'stage' | 'setUpBy';
export interface WeekChoices {
  /** Up to three named weeks: "The end of 2026", week 53. */
  named: { name: string; n: number }[];
  /** The goal years offered, each with the cycle weeks it lists. */
  years: { year: number; weeks: number[] }[];
  /** What the list leaves out and why. */
  says: string;
  /** The earliest and latest week it offers. */
  min: number;
  max: number;
}

/**
 * Rule 13. What the week picker offers for a field (2.13): the named weeks, then the goal years and their weeks. From runs
 * from the first week of the previous goal year to the last of the next; To from the week after From to the same end; a
 * stage's Due within this goal year (decision 11); Set up by from this week to this goal year's end.
 */
export function weekChoices(c: C, week: number, field: WeekField, from?: number): WeekChoices {
  const end = lastWeekOffered(c);
  const own = cycleYear(c);
  const q = Math.min(4, Math.floor((Math.max(1, Math.min(week, c.weeks)) - 1) / 13) + 1);
  const quarterLast = q === 4 ? c.weeks : q * 13, quarterFirst = (q - 1) * 13 + 1;
  const next = own + 1, nextQ1 = c.weeks + 13;
  let min: number, max: number, named: { name: string; n: number }[], says: string;
  if (field === 'from') {
    min = firstWeekOffered(c); max = end;
    named = [{ name: 'This week', n: week }, { name: 'The start of this quarter', n: quarterFirst }, { name: `The start of ${own}`, n: 1 }];
    says = `“From” can be as early as week 1 of ${own - 1}.`;
  } else if (field === 'to') {
    const after = from ?? week;
    min = after + 1; max = end;
    const all = [
      ...(quarterLast !== c.weeks ? [{ name: 'The end of this quarter', n: quarterLast }] : []),
      { name: `The end of ${own}`, n: c.weeks }, { name: `The end of Q1 ${next}`, n: nextQ1 }, { name: `The end of ${next}`, n: end },
    ].filter((x) => x.n >= min && x.n <= max);
    named = all.slice(0, 3);
    const y = yearWeek(c, Math.max(min, 1));
    says = min > end ? 'Nothing after “From” can be chosen.' : `“To” comes after “From”: ${y.year} lists weeks ${y.week} to ${spanOf(c, Math.max(min, 1)).weeks}.`;
  } else if (field === 'stage') {
    min = 1; max = c.weeks;
    named = [{ name: 'This week', n: Math.max(1, Math.min(week, c.weeks)) }, ...(quarterLast !== c.weeks ? [{ name: 'The end of this quarter', n: quarterLast }] : []), { name: `The end of ${own}`, n: c.weeks }];
    says = `A stage is due within ${own}.`;
  } else {
    min = Math.max(1, week); max = c.weeks;
    named = [{ name: 'This week', n: min }, ...(quarterLast !== c.weeks && quarterLast >= min ? [{ name: 'The end of this quarter', n: quarterLast }] : []), { name: `The end of ${own}`, n: c.weeks }];
    says = `It can be set up by the end of ${own}.`;
  }
  named = named.filter((x, i, all) => x.n >= min && x.n <= max && all.findIndex((y) => y.n === x.n) === i);
  const years: WeekChoices['years'] = [];
  for (let n = min; n <= max;) {
    const s = spanOf(c, n), last = Math.min(max, s.first + s.weeks - 1);
    years.push({ year: s.year, weeks: Array.from({ length: last - n + 1 }, (_, i) => n + i) });
    n = last + 1;
  }
  return { named, years, says, min, max };
}

/**
 * Rule 13. The line under Baseline and Target (2.4): "20 weeks. It runs past the end of 2026 and carries into 2027 with
 * this plan." and, for a plan whose From is still to come, "It starts in week 50 (7–13 Dec 2026). Until then nothing is
 * due, and it reads “No check-in yet · starts week 50”."
 */
export function spanSays(c: C, from: number, to: number, week: number): string {
  const n = to - from;
  const out = [`${n} week${n === 1 ? '' : 's'}.`];
  if (to > c.weeks) { const own = cycleYear(c); out.push(`It runs past the end of ${own} and carries into ${yearWeek(c, to).year} with this plan.`); }
  if (from > week) out.push(`It starts in ${weekSays(c, from, 'sentence')}. Until then nothing is due, and it reads “${LABEL.none} · starts ${weekSays(c, from, 'short')}”.`);
  return out.join(' ');
}

/** A range's dates, said not chosen (decision 12): "It applies from the week it is published (week 46, 9–15 Nov 2026) to the end of 2026." */
export const rangeSays = (c: C, week: number) => `It applies from the week it is published (${weekSays(c, Math.max(0, week), 'short')}, ${datesOf(c, Math.max(0, week))}) to the end of ${cycleYear(c)}.`;

/**
 * A number goal's plan in one sentence, the same on the read-back, the goal page and the AI tools (rule 13): "from 42 min
 * in week 46 (9–15 Nov 2026) to 30 min by week 13 of 2027 (29 Mar–4 Apr 2027)". `start` and `target` come formatted.
 */
export const planSays = (c: C, from: number, to: number, start: string, target: string) =>
  `from ${start} in ${weekSays(c, from, 'sentence')} to ${target} by ${weekSays(c, to, 'sentence')}`;
