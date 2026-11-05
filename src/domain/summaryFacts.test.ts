// @vitest-environment node
import { seed } from '../data/seed';
import { yearWeekOf } from '../data/yearStory';
import { currentWeek } from './plan';
import { goalStatus } from './status';
import { summaryFacts } from './summaryFacts';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const toYear = yearWeekOf(week);
const facts = (id: string) => {
  const g = s.goals.find((x) => x.id === id)!;
  return summaryFacts(g, cycle, s.checkIns, week, goalStatus(g, cycle, s.checkIns, today).status === 'stale');
};
const val = (id: string) => facts(id).facts.map((f) => f.value);

describe('the four facts on the example goals', () => {
  it('every goal with a check-in leads with the same four, in the same order', () => {
    for (const g of s.goals) {
      const f = summaryFacts(g, cycle, s.checkIns, week);
      if (!f.source) continue;
      expect(f.facts.map((x) => x.key)).toEqual(['plan', 'trend', 'since', 'projection']);
    }
  });
  it('a number goal falling behind says so in every fact', () => {
    const [plan, trend, since, proj] = val('alerts');
    expect(plan).toMatch(/pts behind plan$/);
    expect(trend).toMatch(/^(\d+ → \d+ → \d+ pts behind plan|.+ → .+ → \d+ pts (behind|ahead of) plan)$/);
    expect(since).toMatch(/^Down \d+ pts$/);
    expect(proj).toMatch(new RegExp(`by week ${cycle.weeks}$`));
    expect(facts('alerts').facts.every((f) => f.tone === 'bad')).toBe(true);
  });
  it('the repo-access stages: late, slipping, and when they now land', () => {
    const [plan, , since, proj] = val('access');
    expect(plan).toBe('2 stages late');
    expect(since).toMatch(/^Access controls built slipped \d+ weeks?$/);
    expect(proj).toBe(`Finishes week ${toYear(9)}, 3 weeks late`);
  });
  it('a goal gone quiet projects nothing', () => {
    expect(val('env')[3]).toBe('Not projected');
  });
  it('a range is read against its limit', () => {
    expect(facts('cfr').facts[0]!.label).toBe('Against the limit');
    expect(val('cfr')[0]).toMatch(/over the limit$/);
  });
});
