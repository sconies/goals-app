// @vitest-environment node
/* Home's facts and week at a glance after the build review of HM1: no review session once the year has ended, and two
   reviews on one day both reach Home. */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { dashboard } from '../domain/home';
import { currentWeek } from '../domain/plan';
import { homeFacts } from './reads';

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
