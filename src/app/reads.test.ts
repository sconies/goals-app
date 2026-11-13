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
  const sw = (at: string, to: 'On' | 'Off') => ({ entity: 'workspace', entityId: 'platform-org', action: 'edited', summary: `Switched ${to === 'On' ? 'on' : 'off'} Reviews`, at, actorId: 'amara', diffs: [{ field: 'Reviews', from: to === 'On' ? 'Off' : 'On', to }] }) as unknown as (typeof s.changes)[number];
  it('finds the days it was last off, from the change log, or none while it hasn’t come back on', async () => {
    const { offSpell } = await import('../domain/review');
    expect(offSpell([])).toBeNull();
    expect(offSpell([sw('2026-11-02T09:00:00Z', 'Off')])).toBeNull();
    expect(offSpell([sw('2026-10-20T09:00:00Z', 'Off'), sw('2026-10-21T09:00:00Z', 'On'), sw('2026-11-02T09:00:00Z', 'Off'), sw('2026-11-04T10:00:00Z', 'On')])).toEqual({ from: '2026-11-02', to: '2026-11-04' });
  });
  it('a session whose date passed while it was off is not outstanding, nor missed, nor a lead: the next date is the session', async () => {
    const { reviewSession } = await import('../domain/review');
    // The day after the demo's Thursday: this week's session is past its date and not held.
    const later = new Date(Date.parse(today.toISOString()) + 86_400_000);
    const lw = currentWeek(cycle, later);
    const before = reviewSession(review, s, cycle, later, lw);
    expect(before.week).toBe(lw);
    expect(dashboard(who, s, cycle, lw, later).missed.length).toBeGreaterThan(0);
    // Switched off the day before the session, and back on the day after it.
    const off = new Date(Date.parse(before.date + 'T09:00:00Z') - 86_400_000).toISOString();
    const t = { ...s, changes: [...s.changes, sw(off, 'Off'), sw(later.toISOString(), 'On')] };
    const after = reviewSession(review, t, cycle, later, lw);
    expect(after.week).toBeGreaterThan(lw);
    expect(after.date > before.date).toBe(true);
    expect(dashboard(who, t, cycle, lw, later).missed).toEqual([]);
    expect(homeFacts(who, t, cycle, lw, later, { workspace: 'Platform', draft: false }).sessions.filter((x) => !x.held && x.date < later.toISOString().slice(0, 10))).toEqual([]);
    // Switched off only after the session's date had passed: it was outstanding already, and still is.
    const late = { ...s, changes: [...s.changes, sw(later.toISOString(), 'Off'), sw(new Date(Date.parse(later.toISOString()) + 3_600_000).toISOString(), 'On')] };
    expect(reviewSession(review, late, cycle, later, lw).week).toBe(lw);
  });
});
