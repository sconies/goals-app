// @vitest-environment node
/* Product review (3 Nov): honest empty states, a critical path only through known status, reasons for threats,
   and one agenda for Home and the review. */
import { buildPlatformOrg } from '../data/platformOrg';
import { attentionFor } from './attention';
import { gapText } from './format';
import { criticalPath, threatReason } from './map';
import { currentWeek } from './plan';
import { firstReports } from './progress';
import { agendaOf, isHealthy, reviewSession } from './review';
import { assessPosted, goalStatus } from './status';
import type { Snapshot } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const fresh: Snapshot = { ...s, checkIns: [], changes: [], decisions: [], requests: [] };

describe('a portfolio before anyone has reported', () => {
  it('says how many goals have had a first check-in, and who it’s waiting on', () => {
    const f = firstReports(fresh, cycle, week)!;
    expect(f.reported).toBe(0);
    expect(f.total).toBeGreaterThan(5);
    expect(f.waiting.map((w) => w.ownerId)).toContain('rhea');
    // A year under way: only the goals set up lately are still waiting for a first check-in.
    const under = firstReports(s, cycle, week)!;
    expect(under.total - under.reported).toBeLessThanOrEqual(2);
    expect(under.waiting.every((w) => s.goals.some((g) => g.ownerId === w.ownerId && Date.parse(g.createdAt) > Date.parse('2026-09-01')))).toBe(true);
    expect(firstReports({ ...s, goals: s.goals.filter((g) => s.checkIns.some((c) => c.goalId === g.id)) }, cycle, week)).toBeNull();
  });
  it('doesn’t call a milestone with no check-in “on schedule”', () => {
    const brain = s.goals.find((g) => g.id === 'fresh-lakehouse')!;
    expect(gapText(brain, assessPosted(brain, cycle, [], 2)).short).toBe('No check-in yet');
  });
  it('draws no critical path through goals whose status is unknown', () => {
    // A workspace just set up: its goals are new and nobody has reported yet.
    const goals = s.goals.map((g) => ({ ...g, createdAt: today.toISOString() }));
    expect(goals.every((g) => goalStatus(g, cycle, [], today).status === 'none' || goalStatus(g, cycle, [], today).status === 'planned')).toBe(true);
    expect(criticalPath(goals, (g) => goalStatus(g, cycle, [], today).status).size).toBe(0);
    expect(criticalPath(s.goals, (g) => goalStatus(g, cycle, s.checkIns, today).status).size).toBeGreaterThan(1);
  });
});

describe('why a contributing goal is a threat', () => {
  it('says a quiet goal’s result is unknown, and a late one what’s late', () => {
    const env = attentionFor(s.goals.find((g) => g.id === 'env-search')!, s, cycle, today);
    expect(threatReason(env, false)).toMatch(/^Last result unknown: no check-in for \d+ days/);
    const access = attentionFor(s.goals.find((g) => g.id === 'lead-mq')!, s, cycle, today);
    expect(threatReason(access, true)).toMatch(/^On the critical path\. Off track: /);
  });
});

describe('one agenda for Home and the review', () => {
  it('splits what’s left into goals to discuss and goals on track', () => {
    const r = reviewSession(s.reviews.find((x) => x.id === 'weekly')!, s, cycle, today, week);
    const { discuss, healthy } = agendaOf(r);
    expect(discuss.length + healthy.length).toBe(r.total - r.done);
    expect(discuss.every((a) => !isHealthy(a))).toBe(true);
    expect(healthy.every(isHealthy)).toBe(true);
  });
});
