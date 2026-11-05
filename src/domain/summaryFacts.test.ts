// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { goalStatus } from './status';
import { summaryFacts } from './summaryFacts';

const today = new Date('2026-10-30T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
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
    const [plan, trend, since, proj] = val('fresh-streaming');
    expect(plan).toMatch(/pts behind plan$/);
    expect(trend).toMatch(/^(\d+ → \d+ → \d+ pts behind plan|.+ → .+ → \d+ pts (behind|ahead of) plan)$/);
    expect(since).toMatch(/^Down \d+ pts?$/);
    expect(proj).toMatch(new RegExp(`by week ${cycle.weeks}$`));
    expect(facts('fresh-streaming').facts.every((f) => f.tone === 'bad')).toBe(true);
  });
  it('the Kafka stages: late, slipping, and when they now land', () => {
    const [plan, , since, proj] = val('fresh-kafka');
    expect(plan).toBe('2 stages late');
    expect(since).toMatch(/^Producers dual-writing slipped \d+ weeks?$/);
    expect(proj).toBe('Finishes week 50, 11 weeks late');
  });
  it('a goal gone quiet projects nothing', () => {
    expect(val('env-search')[3]).toBe('Not projected');
  });
  it('a range is read against its limit', () => {
    expect(facts('ns-cfr').facts[0]!.label).toBe('Against the limit');
    expect(val('ns-cfr')[0]).toMatch(/inside the limit$/);
  });
});
