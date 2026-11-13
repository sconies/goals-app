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

describe('Home with Reviews switched off (FT2)', () => {
  const week = currentWeek(cycle, today);
  it('answers whether Reviews is on in one place', async () => {
    const { reviewsOn, reviewsOffWords } = await import('./reads');
    expect(reviewsOn(new Set(['reviews', 'metrics']))).toBe(true);
    expect(reviewsOn(new Set(['metrics']))).toBe(false);
    expect(reviewsOffWords('Platform Engineering')).toBe('Reviews is off in Platform Engineering.');
  });
  it('has no next review and none missed', () => {
    const d = dashboard(who, s, cycle, week, today, { reviews: false });
    expect(d.next).toBeNull();
    expect(d.upcoming).toEqual([]);
    expect(d.missed).toEqual([]);
  });
  it('has no session, and no ask names a review or waits for a session', () => {
    const on = homeFacts(who, s, cycle, week, today, { workspace: 'Platform', draft: false });
    const off = homeFacts(who, s, cycle, week, today, { workspace: 'Platform', draft: false, reviews: false });
    expect(off.sessions).toEqual([]);
    expect(off.asks.length).toBe(on.asks.length);
    for (const a of off.asks) { expect(a.where).toBeNull(); expect(a.due?.why).not.toBe('session'); expect(a.line).not.toMatch(/session/); }
  });
  it('leads someone who owns no goal to the goals they watch that need attention, and never with Reviews on', async () => {
    const { homeLead } = await import('../domain/home');
    const leader = s.people.find((p) => !s.goals.some((g) => g.ownerId === p.id) && s.watches.some((w) => w.personId === p.id))!;
    const off = homeFacts(leader.id, s, cycle, week, today, { workspace: 'Platform', draft: false, reviews: false });
    expect(off.watchNeeds).toBeGreaterThan(0);
    const lead = homeLead({ ...off, asks: [], proposals: [] })!;
    expect(lead).toMatchObject({ kind: 'watching', eyebrow: 'Goals you watch', title: `${off.watchNeeds} need${off.watchNeeds === 1 ? 's' : ''} attention`, action: { label: 'See them', to: '/goals?scope=watching&attention=1' } });
    expect(homeFacts(leader.id, s, cycle, week, today, { workspace: 'Platform', draft: false }).watchNeeds).toBeUndefined();
    // Watching nothing: no lead of that kind.
    const none = homeFacts(leader.id, { ...s, watches: [] }, cycle, week, today, { workspace: 'Platform', draft: false, reviews: false });
    expect(homeLead({ ...none, asks: [], proposals: [] })?.kind).not.toBe('watching');
  });
});

describe('Reviews back on (FT2)', () => {
  it('finds the day it was last switched back on from the change log, or none', async () => {
    const { reviewsBackOn } = await import('./reads');
    const on = (at: string, to: string) => ({ entity: 'workspace', at, diffs: [{ field: 'Reviews', to }] });
    expect(reviewsBackOn([])).toBeNull();
    expect(reviewsBackOn([on('2026-11-02T09:00:00Z', 'Off')])).toBeNull();
    expect(reviewsBackOn([on('2026-11-02T09:00:00Z', 'Off'), on('2026-11-04T10:00:00Z', 'On'), on('2026-11-03T10:00:00Z', 'On')])).toBe('2026-11-04');
  });
  it('a session whose date passed while it was off is not missed, nor a lead', () => {
    const week = currentWeek(cycle, today);
    // The day after the demo's Thursday: this week's session is past its date and not held.
    const later = new Date(Date.parse(today.toISOString()) + 86_400_000);
    const lw = currentWeek(cycle, later);
    expect(dashboard(who, s, cycle, lw, later).missed.length).toBeGreaterThan(0);
    const back = { entity: 'workspace', entityId: 'platform-org', action: 'edited', summary: 'Switched on Reviews', at: later.toISOString(), actorId: 'amara', diffs: [{ field: 'Reviews', from: 'Off', to: 'On' }] } as unknown as (typeof s.changes)[number];
    const t = { ...s, changes: [...s.changes, back] };
    expect(dashboard(who, t, cycle, lw, later, { reviews: true, backOn: later.toISOString().slice(0, 10) }).missed).toEqual([]);
    expect(homeFacts(who, t, cycle, lw, later, { workspace: 'Platform', draft: false }).sessions.filter((x) => x.date < later.toISOString().slice(0, 10) && !x.held)).toEqual([]);
    expect(week).toBeGreaterThan(0);
  });
});
