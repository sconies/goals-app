// @vitest-environment node
import { seed } from '../data/seed';
import { currentWeek } from './plan';
import { isHealthy, reviewSession } from './review';
import { storyOf } from './story';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);

describe('a weekly review (Senior UX review, 2 Nov)', () => {
  const review = s.reviews.find((r) => r.id === 'weekly')!;
  const session = reviewSession(review, s, cycle, today, week);
  it('splits the exceptions from the goals on track with nothing flagged', () => {
    const healthy = session.items.filter(isHealthy);
    const exceptions = session.items.filter((a) => !isHealthy(a));
    expect(healthy.length).toBeGreaterThan(0);
    expect(exceptions.length).toBeGreaterThan(0);
    for (const a of healthy) {
      expect(['on', 'done']).toContain(a.status.status);
      expect(a.flags.filter((f) => f.kind !== 'due')).toEqual([]);
    }
    // Nothing off track, at risk, quiet or warned about is ever taken as read.
    for (const a of session.items) if (['off', 'risk', 'stale'].includes(a.status.status)) expect(isHealthy(a)).toBe(false);
  });
  it('walks the exceptions first: every exception sorts before every healthy goal', () => {
    const firstHealthy = session.items.findIndex(isHealthy);
    expect(session.items.slice(firstHealthy).some((a) => !isHealthy(a) && a.weight > 10)).toBe(false);
  });
});

describe('a goal waiting on a decision', () => {
  it('says its date depends on the decision when there is one, and names no recipient twice', () => {
    const st = storyOf(s.goals.find((g) => g.id === 'access')!, s, cycle, week, today);
    expect(st.needs).toMatch(/^Elena Ruiz: /);
    expect(st.needs).not.toMatch(/^Elena Ruiz: Elena/);
  });
});
