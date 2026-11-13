// @vitest-environment node
/* Home's facts and week at a glance after the build review of HM1: no review session once the year has ended, and two
   reviews on one day both reach Home. */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { dashboard } from '../domain/home';
import { currentWeek } from '../domain/plan';
import { askWaiting, homeFacts } from './reads';
import { asksOf } from '../domain/asks';
import type { Ask } from '../domain/types';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle);
const review = s.reviews.find((r) => r.people.length)!;
const who = review.people[0]!;

describe('Home’s facts', () => {
  it('after the year has ended, no session is “not held yet”', () => {
    const after = new Date('2027-01-20T12:00:00Z');
    const f = homeFacts(who, s, cycle, cycle.weeks, after, { workspace: 'Platform', draft: false });
    expect(f.sessions).toEqual([]);
  });
  it('a question past its review session is late (the one lateness rule list_requests reads, review of #369, medium 5)', () => {
    // A review whose session week has passed, and an open question on it with no due week: isOverdue (dueWeek < week)
    // would call it on time; askWaiting calls it late, because its session has gone.
    const rv = review;
    const owner = s.goals.find((g) => g.ownerId)!.ownerId;
    const base = asksOf(s).find((r) => r.kind === 'question') ?? asksOf(s)[0]!;
    const q: Ask = { ...base, id: 'q_session', kind: 'question', status: 'open', goalIds: [s.goals[0]!.id], recipientId: owner, dueWeek: null, reviewId: rv.id, week: 2, createdAt: '2026-11-01T09:00:00Z' };
    const withQ = { ...s, asks: [...asksOf(s), q] };
    const w = askWaiting(q, owner, withQ, cycle, currentWeek(cycle, today), today);
    expect(w?.late).toBe(true);
    expect(w?.due?.why).toBe('session');
  });

  it('two reviews on one day are both in the week at a glance', () => {
    const twin = { ...review, id: review.id + '_twin', name: 'A second review' };
    const two = { ...s, reviews: [...s.reviews, twin] };
    const d = dashboard(who, two, cycle, currentWeek(cycle, today), today);
    const ids = d.upcoming.map((r) => r.id);
    expect(ids).toContain(review.id);
    expect(ids).toContain(twin.id);
    expect(d.next).toEqual(d.upcoming[0]);
  });
});
