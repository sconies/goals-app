// @vitest-environment node
import { seed } from '../data/seed';
import { toYear } from '../data/yearStory';
import { currentWeek } from './plan';
import { storyOf } from './story';
import type { Cycle, MetricGoal } from './types';
import { dueOptions, periodLabel, quarterOf, quarterResult, quarterResults, quarters, shortPeriod, startMonth, targetAt, yearStartFor } from './year';
import { yearName } from './yearName';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;

describe('the goal year', () => {
  it('is 52 weeks in four quarters of 13, named from the month it starts', () => {
    expect(quarters(cycle).map((q) => [q.label, q.months, q.from, q.to])).toEqual([['Q1', 'Jan–Mar', 1, 13], ['Q2', 'Apr–Jun', 14, 26], ['Q3', 'Jul–Sep', 27, 39], ['Q4', 'Oct–Dec', 40, 52]]);
    expect(quarterOf(cycle, week).label).toBe('Q4');
    expect(periodLabel(cycle, week)).toBe('Week 43 of 52 · Q4 (Oct–Dec) · 2026');
    expect(shortPeriod(cycle, week)).toBe('Week 43 · Q4');
  });
  it('can start in any month, as a financial year', () => {
    const start = yearStartFor(new Date('2026-10-30T00:00:00Z'), 3);
    expect(start).toBe('2026-03-30');
    const fy: Cycle = { id: 'fy', name: yearName(start, 52), startDate: start, weeks: 52, reviewDay: 3 };
    expect(fy.name).toBe('Apr 2026–Mar 2027');
    expect(startMonth(fy)).toBe(3);
    expect(quarters(fy)[0]!.months).toBe('Apr–Jun');
    expect(yearStartFor(new Date('2026-02-10T00:00:00Z'), 3)).toBe('2025-03-31');
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
    const g = goal('triage') as MetricGoal;
    expect(targetAt(g, cycle, 13)).toBeCloseTo(40 + (45 * 13) / 52, 5);
    expect(targetAt(g, cycle, 52)).toBe(85);
  });
  it('says whether each ended quarter was met, and keeps the rest open', () => {
    const rs = quarterResults(goal('scan'), cycle, s.checkIns, week);
    expect(rs.map((r) => r.kind)).toEqual(['met', 'met', 'met', 'open']);
    expect(rs[0]!.text).toMatch(/^Q1: \d+% against a plan of \d+%$/);
  });
  it('a missed quarter is said plainly, and the story flags it', () => {
    const g = goal('alerts') as MetricGoal;
    const q3 = quarters(cycle)[2]!;
    const low = s.checkIns.map((c) => (c.goalId === 'alerts' && c.week === q3.to ? { ...c, value: 10 } : c));
    const r = quarterResult(g, cycle, low, q3, week);
    expect(r.kind).toBe('missed');
    expect(r.text).toMatch(/^Q3: 10% against a plan of \d+%, \d+ pts short$/);
    expect(storyOf(g, { ...s, checkIns: low }, cycle, week, today).warnings.join(' ')).toMatch(/Missed its Q3 plan: 10%/);
  });
  it('milestone quarters count the stages due in them', () => {
    const r = quarterResult(goal('access'), cycle, s.checkIns, quarters(cycle)[3]!, week);
    expect(r.kind).toBe('open');
    const q3 = quarterResult(goal('access'), cycle, s.checkIns, quarters(cycle)[2]!, week);
    expect([q3.kind, q3.text]).toEqual(['met', 'Q3: 1 of 1 stage due was done']);
  });
  it('offers the end of the year, or a quarter still to come, as a due date', () => {
    expect(dueOptions(cycle, 10, 52)).toEqual([[52, 'Year end'], [13, 'End of Q1'], [26, 'End of Q2'], [39, 'End of Q3']]);
    expect(dueOptions(cycle, week, 52)).toEqual([[52, 'Year end']]);
  });
  it('places the story at the end of the year', () => {
    expect(toYear(7)).toBe(week);
  });
});
