// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { buildGoal, draftOf, goalAsOf, planHistoryOf } from './goal';
import { currentWeek, weekDate, weekDates } from './plan';
import { assessPosted } from './status';
import { storyOf } from './story';
import type { Cycle, MetricGoal } from './types';
import { dueOptions, goalYear, goalYearFor, periodLabel, quarterOf, quarterResult, quarterResults, quarters, shortPeriod, startMonth, targetAt, yearStartFor, yearWeeks } from './year';
import { yearName } from './yearName';
import { stagesFromNow } from './templates';

const today = new Date('2026-10-30T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;

describe('the goal year', () => {
  it('follows the calendar: week n is ISO week n, in four quarters of 13, and 2026 has 53 weeks', () => {
    expect(quarters(cycle).map((q) => [q.label, q.months, q.from, q.to])).toEqual([['Q1', 'Jan–Mar', 1, 13], ['Q2', 'Apr–Jun', 14, 26], ['Q3', 'Jul–Sep', 27, 39], ['Q4', 'Oct–Dec', 40, 53]]);
    expect(quarterOf(cycle, week).label).toBe('Q4');
    // Friday 30 October 2026 is in ISO week 44.
    expect(periodLabel(cycle, week)).toBe('Week 44 of 53 · Q4 (Oct–Dec) · 2026');
    expect(shortPeriod(cycle, week)).toBe('Week 44 · Q4');
    // Week 1 is ISO week 1 (29 Dec–4 Jan); week 0, the week before, is for starting numbers; the year ends 3 January 2027.
    expect(weekDate(cycle, 1)).toBe('2025-12-29');
    expect(weekDate(cycle, 0)).toBe('2025-12-22');
    expect(weekDate(cycle, 53)).toBe('2026-12-28');
    expect(weekDate(cycle, 13)).toBe('2026-03-23');
    // Dates in the year's own calendar year don't repeat it; the week before, and the last week, say which year.
    expect(weekDates(cycle, 44)).toBe('26 Oct–1 Nov');
    expect(weekDates(cycle, 0)).toBe('22–28 Dec 2025');
    expect(weekDates(cycle, 53)).toBe('28 Dec–3 Jan 2027');
  });
  it('is 52 or 53 weeks, like the ISO calendar, and a set-up in the last days of December is for next year', () => {
    expect(goalYear(2027, 0)).toEqual({ startDate: '2026-12-28', weeks: 52 });
    expect(goalYear(2020, 0)).toEqual({ startDate: '2019-12-23', weeks: 53 });
    expect(goalYearFor(new Date('2026-12-29T09:00:00Z'), 0).startDate).toBe('2026-12-28');
    expect(goalYearFor(new Date('2026-12-27T09:00:00Z'), 0).startDate).toBe('2025-12-22');
    expect(yearWeeks('2025-12-22')).toBe(53);
    // A year stored before calendar weeks (week 0 held 1 January) still reads as a January year.
    expect(startMonth({ startDate: '2025-12-29' })).toBe(0);
    expect(yearName('2025-12-29', 52)).toBe('2026');
  });
  it('can start in any month, as a financial year', () => {
    // 1 April 2026 is a Wednesday, so week 1 starts on Monday 30 March and week 0 a week before.
    const start = yearStartFor(new Date('2026-10-30T00:00:00Z'), 3);
    expect(start).toBe('2026-03-23');
    const fy: Cycle = { id: 'fy', name: yearName(start, yearWeeks(start)), startDate: start, weeks: yearWeeks(start), reviewDay: 3 };
    expect(fy.weeks).toBe(52);
    expect(fy.name).toBe('Apr 2026–Mar 2027');
    expect(startMonth(fy)).toBe(3);
    expect(quarters(fy)[0]!.months).toBe('Apr–Jun');
    expect(yearStartFor(new Date('2026-02-10T00:00:00Z'), 3)).toBe('2025-03-24');
  });
  it('keeps a shorter cycle as one period', () => {
    const short: Cycle = { id: 'c', name: 'Platform cycle', startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
    expect(quarters(short)).toHaveLength(1);
    expect(periodLabel(short, 7)).toBe('Week 7 of 13 · Platform cycle');
    expect(dueOptions(short, 7, 16).map(([, l]) => l)).toEqual(['End of the cycle', 'End of the year']);
  });
});

describe('quarters read off the owner’s plan', () => {
  it('a quarter’s target is the plan’s number at its end, and any week in between has one too', () => {
    const g = goal('mttr-pir') as MetricGoal;
    expect(targetAt(g, cycle, 13)).toBeCloseTo(40 + (45 * 13) / 53, 5);
    expect(targetAt(g, cycle, 53)).toBe(85);
  });
  it('says whether each ended quarter was met, and keeps the rest open', () => {
    const rs = quarterResults(goal('ns-slo'), cycle, s.checkIns, week);
    expect(rs.map((r) => r.kind)).toEqual(['met', 'met', 'met', 'open']);
    expect(rs[0]!.text).toMatch(/^Q1: [\d.]+% within (at least|at most) [\d.]+%$|^Q1: /);
  });
  it('a missed quarter is said plainly, and the story flags it', () => {
    const g = goal('mttr-pir') as MetricGoal;
    const q3 = quarters(cycle)[2]!;
    const low = s.checkIns.map((c) => (c.goalId === 'mttr-pir' && c.week === q3.to ? { ...c, value: 10 } : c));
    const r = quarterResult(g, cycle, low, q3, week);
    expect(r.kind).toBe('missed');
    expect(r.text).toMatch(/^Q3: 10% against a plan of \d+%, \d+ pts short$/);
    expect(storyOf(g, { ...s, checkIns: low }, cycle, week, today).warnings.join(' ')).toMatch(/Last quarter not met\. Q3: 10%/);
  });
  it('says "over" when lower is better, and counts a number shown equal to its plan as met (demo review, 8 Nov)', () => {
    const g = s.goals.find((x): x is MetricGoal => x.kind === 'metric' && x.plan.target < x.plan.start && (x.plan.fromWeek ?? 0) < 27 && !!x.unit && x.unit !== '%')!;
    const q3 = quarters(cycle)[2]!;
    const t = targetAt(goalAsOf(g, q3.to), cycle, q3.to)!;
    const at = (v: number) => quarterResult(g, cycle, s.checkIns.map((c) => (c.goalId === g.id && c.week <= q3.to && c.week >= q3.to - 1 ? { ...c, value: v } : c)), q3, week);
    const over = at(t + 1);
    expect(over.kind).toBe('missed');
    expect(over.text).toMatch(/, 1(\.0+)? \S+ over$/);
    expect(over.text).not.toMatch(/short/);
    // Worse than the plan by less than the goal's last decimal place: shown the same, so met.
    const step = 10 ** -g.decimals;
    expect(at(Number(t.toFixed(g.decimals)) + 0.4 * step).kind).toBe('met');
    expect(at(Number(t.toFixed(g.decimals)) + step).kind).toBe('missed');
  });
  it('milestone quarters count the stages due in them', () => {
    const r = quarterResult(goal('cfr-halt'), cycle, s.checkIns, quarters(cycle)[3]!, week);
    expect(r.kind).toBe('open');
    const q3 = quarterResult(goal('cfr-halt'), cycle, s.checkIns, quarters(cycle)[2]!, week);
    expect([q3.kind, q3.text]).toEqual(['met', 'Q3: 1 of 1 stage due was done']);
    const missed = quarterResult(goal('lead-mq'), cycle, s.checkIns, quarters(cycle)[2]!, week);
    expect([missed.kind, missed.text]).toEqual(['missed', 'Q3: 0 of 2 stages due were done']);
  });
  it('offers the end of the year, or a quarter still to come, as a due date', () => {
    expect(dueOptions(cycle, 10, 53)).toEqual([[53, 'Year end'], [13, 'End of Q1'], [26, 'End of Q2'], [39, 'End of Q3']]);
    expect(dueOptions(cycle, week, 53)).toEqual([[53, 'Year end']]);
  });
  it('sets the example in the real year, up to today', () => {
    expect(Math.max(...s.checkIns.map((c) => c.week))).toBe(week);
  });

  it('keeps closed quarters judged against the plan of their day when the target changes again (research round 1)', () => {
    // AI-assisted review's target went 60 → 80 in week 19; raising it to 90 now mustn't change Q1–Q3.
    const before = goal('ns-ai') as MetricGoal;
    const after = buildGoal({ ...draftOf(before), target: '90' }, cycle, { id: before.id, createdAt: before.createdAt }, before, true, week) as MetricGoal;
    const closed = (g: MetricGoal) => quarterResults(g, cycle, s.checkIns, week).slice(0, 3).map((r) => r.text);
    expect(closed(after)).toEqual(closed(before));
    // Both earlier plans are kept, each with the week it stopped applying.
    expect(planHistoryOf(after).map((v) => [v.untilWeek, v.plan.target])).toEqual([[19, 60], [week, 80]]);
    expect(goalAsOf(after, week - 1).plan.target).toBe(80);
    expect(goalAsOf(after, 18).plan.target).toBe(60);
    expect(goalAsOf(after, week).plan.target).toBe(90);
    // A second change in the same week keeps the plan from before the first.
    const again = buildGoal({ ...draftOf(after), target: '95' }, cycle, { id: before.id, createdAt: before.createdAt }, after, true, week) as MetricGoal;
    expect(planHistoryOf(again).map((v) => v.plan.target)).toEqual([60, 80]);
  });

  it('counts a template’s stage weeks from now, within the year (research round 1)', () => {
    expect(stagesFromNow('Design@3; Pilot with one team@7; All teams@12', 0)).toBe('Design@3; Pilot with one team@7; All teams@12');
    expect(stagesFromNow('Design@3; Pilot with one team@7; All teams@12', 20)).toBe('Design@23; Pilot with one team@27; All teams@32');
    // Week 43: nine weeks left, so the stages spread over them and the last lands at the year's end.
    expect(stagesFromNow('Design@3; Pilot with one team@7; All teams@12', 43)).toBe('Design@45; Pilot with one team@48; All teams@52');
  });

  it('keeps the latest number judged against the plan of its own week after a later re-plan (research round 2)', () => {
    const before = goal('ns-ai') as MetricGoal;
    // Re-planned next week: this week's number, the latest, is still judged against the plan it was posted under.
    const after = buildGoal({ ...draftOf(before), target: '90' }, cycle, { id: before.id, createdAt: before.createdAt }, before, true, week + 1) as MetricGoal;
    const gap = (g: MetricGoal) => { const a = assessPosted(g, cycle, s.checkIns, week + 1); return a.kind === 'metric' ? [a.week, a.plan] : null; };
    expect(gap(after)).toEqual(gap(before));
  });
});

describe('a quarter that ended before the goal was set up (MCP load, 12 Nov)', () => {
  // Goals loaded in week 46 showed Q1 to Q3 as Not met, and every one was flagged "Last quarter not met".
  const born = '2026-11-12T10:00:00Z';
  const range = { ...goal(s.goals.find((g) => g.kind === 'range')!.id), id: 'new-range', createdAt: born };
  const metric = { ...(s.goals.find((g) => g.kind === 'metric') as MetricGoal), id: 'new-metric', createdAt: born };
  const early = { ...metric, id: 'new-early', plan: { ...metric.plan, fromWeek: 23 } };
  const on = new Date('2026-11-12T12:00:00Z');

  it('is never judged, whatever week the baseline is from, and says why', () => {
    for (const g of [range, metric, early]) {
      const rs = quarterResults(g, cycle, s.checkIns, 46);
      expect(rs.map((q) => q.kind)).toEqual(['none', 'none', 'none', 'open']);
      expect(rs[2]!.text).toBe('Q3: before the goal was set up in week 46');
    }
  });

  it('even with numbers loaded for those weeks', () => {
    const cis = [3, 20, 35].map((w) => ({ ...s.checkIns.find((c) => c.goalId === range.id && c.value != null)!, id: `x${w}`, goalId: range.id, week: w, value: 999 }));
    expect(quarterResults(range, cycle, cis, 46).map((q) => q.kind)).toEqual(['none', 'none', 'none', 'open']);
  });

  it('raises no “Last quarter not met” on its story', () => {
    const snap = { ...s, goals: [...s.goals, range, early] };
    for (const g of [range, early]) expect(storyOf(g, snap, cycle, 46, on).flags).not.toContain('missed-quarter');
  });

  it('a goal set up during a quarter is still judged on it', () => {
    const mid = { ...range, createdAt: '2026-08-05T10:00:00Z' };
    expect(quarterResults(mid, cycle, [], 46).map((q) => q.kind)).toEqual(['none', 'none', 'missed', 'open']);
  });
});
