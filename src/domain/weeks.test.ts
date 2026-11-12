/* Years and weeks (goal entry, rule 13; GE9): every worked example. The cycle is the demo's 2026: it starts on Monday
   22 December 2025 (week 0) and has 53 weeks; today is Wednesday 11 November 2026, week 46. */
import { describe, expect, it } from 'vitest';
import { cycleWeek, readWeekCode, weekCode, weekSays, weeksProblem, yearWeek } from './weeks';
import { readWeek, spanSays, weekChoices, weekIs } from './weekChoices';
import { goalYear } from './year';

const y26 = { startDate: '2025-12-22', weeks: 53 };

describe('a cycle week as a goal year and its week (rule 13)', () => {
  it('reads weeks inside, after and before the cycle’s own year', () => {
    const at = (n: number) => { const y = yearWeek(y26, n); return `${y.year} W${y.week} ${y.monday}`; };
    expect(at(46)).toBe('2026 W46 2026-11-09');
    expect(at(53)).toBe('2026 W53 2026-12-28');
    expect(at(54)).toBe('2027 W1 2027-01-04');
    expect(at(66)).toBe('2027 W13 2027-03-29');
    expect(at(105)).toBe('2027 W52 2027-12-27');
    expect(at(1)).toBe('2026 W1 2025-12-29');
    expect(at(0)).toBe('2025 W52 2025-12-22');
    expect(at(-12)).toBe('2025 W40 2025-09-29');
  });
  it('says each week with its dates and their year', () => {
    expect(weekSays(y26, 46, 'field')).toBe('Week 46 · 9–15 Nov 2026');
    expect(weekSays(y26, 53, 'field')).toBe('Week 53 · 28 Dec 2026–3 Jan 2027');
    expect(weekSays(y26, 54, 'field')).toBe('Week 1 · 4–10 Jan 2027');
    expect(weekSays(y26, 66, 'sentence')).toBe('week 13 of 2027 (29 Mar–4 Apr 2027)');
    expect(weekSays(y26, 46, 'sentence')).toBe('week 46 (9–15 Nov 2026)');
    expect(weekSays(y26, 1, 'field')).toBe('Week 1 · 29 Dec 2025–4 Jan 2026');
    expect(weekSays(y26, 0, 'sentence')).toBe('week 52 of 2025 (22–28 Dec 2025)');
    expect(weekSays(y26, -12, 'sentence')).toBe('week 40 of 2025 (29 Sep–5 Oct 2025)');
    expect(weekSays(y26, 66, 'row')).toBe('Week 13 · 29 Mar–4 Apr');
  });
  it('writes a file’s weeks as 2026-W46', () => {
    expect([46, 53, 54, 0].map((n) => weekCode(y26, n))).toEqual(['2026-W46', '2026-W53', '2027-W01', '2025-W52']);
  });
  it('turns a year and a week back into the cycle’s week, and refuses one that doesn’t exist', () => {
    expect(cycleWeek(y26, { year: 2027, week: 13 })).toBe(66);
    expect(cycleWeek(y26, { year: 2027, week: 53 })).toBeNull();
    expect(cycleWeek(y26, { year: 2025, week: 40 })).toBe(-12);
    expect(readWeekCode(y26, '2027-W53')).toEqual({ problem: 'week-unknown', text: '2027 has 52 weeks. Use 2027-W52, or 2028-W01.' });
  });
  it('reads a file’s week: 2026-W46, 46 and W46 are week 46; 2027-W01 is week 54', () => {
    for (const raw of ['2026-W46', '46', 'W46', '2026W46', '2026-46']) expect(readWeekCode(y26, raw)).toEqual({ n: 46 });
    expect(readWeekCode(y26, '2027-W01')).toEqual({ n: 54 });
    expect(readWeekCode(y26, 'soon')).toEqual({ problem: 'week-unknown' });
  });
  it('reads what is typed in the picker: a week of the year shown, a day, or a year and a week', () => {
    expect(readWeek(y26, 46, '14 Dec', 2026)).toBe(51);
    expect(readWeek(y26, 46, '3 Jan', 2026)).toBe(53);
    expect(readWeek(y26, 46, '5', 2027)).toBe(58);
    expect(readWeek(y26, 46, '50', 2026)).toBe(50);
    expect(readWeek(y26, 46, '2027 5', 2026)).toBe(58);
    expect(readWeek(y26, 46, '14/12', 2026)).toBe(51);
    expect(readWeek(y26, 46, '14 December 2026', 2026)).toBe(51);
    expect(readWeek(y26, 46, 'next spring', 2026)).toBeNull();
  });
  it('counts a goal year that starts in April from that April', () => {
    const april = goalYear(2026, 3);
    const n = 40;
    expect(yearWeek(april, n).year).toBe(2026);
    expect(yearWeek(april, n).week).toBe(40);
    expect(weekCode(april, n)).toBe('2026-W40');
  });
});

describe('what a week is, and what the picker offers (rule 13)', () => {
  it('says what a week is', () => {
    expect(weekIs(y26, 46, 46)).toBe('This week');
    expect(weekIs(y26, 47, 46)).toBe('Next week');
    expect(weekIs(y26, 53, 46)).toBe('The end of 2026');
    expect(weekIs(y26, 66, 46)).toBe('The end of Q1 2027');
    expect(weekIs(y26, 40, 46)).toBe('6 weeks ago');
    expect(weekIs(y26, 1, 46)).toBe('The start of 2026');
    expect(weekIs(y26, 50, 46)).toBe('In 4 weeks');
  });
  it('offers To from the week after From to the end of next year', () => {
    const to = weekChoices(y26, 46, 'to', 46);
    expect(to.named).toEqual([{ name: 'The end of 2026', n: 53 }, { name: 'The end of Q1 2027', n: 66 }, { name: 'The end of 2027', n: 105 }]);
    expect(to.years.map((y) => `${y.year}: ${y.weeks[0]} to ${y.weeks.at(-1)}`)).toEqual(['2026: 47 to 53', '2027: 54 to 105']);
    expect(to.says).toBe('“To” comes after “From”: 2026 lists weeks 47 to 53.');
    expect(weekChoices(y26, 30, 'to', 30).named).toEqual([{ name: 'The end of this quarter', n: 39 }, { name: 'The end of 2026', n: 53 }, { name: 'The end of Q1 2027', n: 66 }]);
  });
  it('offers From from the first week of last year', () => {
    const from = weekChoices(y26, 46, 'from');
    expect(from.named).toEqual([{ name: 'This week', n: 46 }, { name: 'The start of this quarter', n: 40 }, { name: 'The start of 2026', n: 1 }]);
    expect(from.years.map((y) => `${y.year}: ${y.weeks[0]} to ${y.weeks.at(-1)}`)).toEqual(['2025: -51 to 0', '2026: 1 to 53', '2027: 54 to 105']);
  });
  it('offers a stage’s Due within this goal year', () => {
    const st = weekChoices(y26, 46, 'stage');
    expect(st.years.map((y) => y.year)).toEqual([2026]);
    expect(st.says).toBe('A stage is due within 2026.');
  });
});

describe('the span, and what a file can’t say (rule 13)', () => {
  it('says how long, past the year’s end, and when it starts', () => {
    expect(spanSays(y26, 46, 66, 46)).toBe('20 weeks. It runs past the end of 2026 and carries into 2027 with this plan.');
    expect(spanSays(y26, 50, 53, 46)).toBe('3 weeks. It starts in week 50 (7–13 Dec 2026). Until then nothing is due, and it reads “No check-in yet · starts week 50”.');
  });
  it('refuses To before From, and weeks beyond next year', () => {
    expect(weeksProblem(y26, 46, 40)?.text).toBe('To (week 40, 28 Sep–4 Oct 2026) isn’t after From (week 46, 9–15 Nov 2026). The plan has to run forwards.');
    expect(weeksProblem(y26, 46, 106)?.text).toBe('To can be as late as week 52 of 2027 (27 Dec 2027–2 Jan 2028), the end of next year.');
    expect(weeksProblem(y26, -52, 53)?.text).toBe('From can be as early as week 1 of 2025.');
    expect(weeksProblem(y26, 46, 105)).toBeNull();
  });
});
