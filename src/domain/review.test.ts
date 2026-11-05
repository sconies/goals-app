// @vitest-environment node
import { seed } from '../data/seed';
import { currentWeek } from './plan';
import { dayText, isHealthy, lastHeld, nextSessionWeek, openActions, reviewSession, sessionState, sessionStateText, sessionWeek } from './review';
import { storyOf } from './story';
import type { Decision, Snapshot } from './types';

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

describe('where a review session stands (Lane, 5 Nov)', () => {
  const review = s.reviews.find((r) => r.id === 'weekly')!;
  const base = reviewSession(review, s, cycle, today, week);
  const ack = (goalId: string, at: string, w = base.week): Decision => ({ id: 'a_' + goalId + w, goalId, checkInId: null, reviewId: 'weekly', week: w, kind: 'acknowledge', byId: 'elena', at, note: '' });
  const act = (id: string, dueWeek: number | null, w = base.week, reviewId = 'weekly'): Decision => ({ id, goalId: 'head', checkInId: null, reviewId, week: w, kind: 'action', byId: 'elena', at: '2026-10-29T10:00:00Z', note: 'Do it', assigneeId: 'maya', dueWeek });
  const withD = (extra: Decision[]): Snapshot => ({ ...s, decisions: [...s.decisions, ...extra] });

  it('[REVIEW-LIST-STATE] has not started when nothing has been said in this session', () => {
    expect(sessionState(base)).toEqual({ kind: 'not-started' });
    expect(sessionStateText(sessionState(base))).toBe('Not started');
  });
  it('[REVIEW-LIST-STATE] is in progress, with how many reviewed, once something is said or reviewed', () => {
    const one = reviewSession(review, withD([ack(base.items[0]!.goal.id, '2026-10-29T10:00:00Z')]), cycle, today, week);
    expect(sessionState(one)).toEqual({ kind: 'in-progress', done: 1, total: base.total });
    expect(sessionStateText(sessionState(one))).toBe(`In progress · 1 of ${base.total} reviewed`);
    // A note alone starts the session without reviewing anything.
    const noted = reviewSession(review, withD([{ ...ack('head', '2026-10-29T10:00:00Z'), id: 'n1', kind: 'note', note: 'Hm' }]), cycle, today, week);
    expect(sessionState(noted)).toEqual({ kind: 'in-progress', done: 0, total: base.total });
  });
  it('[REVIEW-LIST-STATE] is held, on the day the last goal was reviewed, once every goal is', () => {
    const all = base.items.map((a, i) => ack(a.goal.id, i === 0 ? '2026-10-30T09:00:00Z' : '2026-10-29T10:00:00Z'));
    const held = reviewSession(review, withD(all), cycle, today, week);
    expect(sessionState(held)).toEqual({ kind: 'held', on: '2026-10-30' });
    expect(sessionStateText(sessionState(held))).toBe('Held Fri 30 Oct');
  });
  it('[REVIEW-LIST-STATE] was last held in the latest earlier session where anything was said', () => {
    // The seed has a note in last week's session.
    expect(lastHeld(review, s, base.week)?.week).toBe(base.week - 1);
    const older = withD([ack('head', '2026-10-15T10:00:00Z', base.week - 2), ack('head', '2026-10-29T10:00:00Z')]);
    expect(lastHeld(review, older, base.week)).toEqual({ week: base.week - 1, on: s.decisions[0]!.at.slice(0, 10) });
    // Nothing said before this session: never held.
    expect(lastHeld(review, { ...s, decisions: [] }, base.week)).toBeNull();
  });
  it('[REVIEW-LIST-STATE] counts open actions: agreed in this review, not yet past their due week', () => {
    const x = withD([act('due-now', week), act('later', week + 2), act('no-date', null), act('past', week - 1, week - 1), act('other', null, base.week, 'security')]);
    expect(openActions(review, x, week).map((d) => d.id).sort()).toEqual(['due-now', 'later', 'no-date']);
  });
  it('[REVIEW-LIST-STATE] dates a session, and knows the next one', () => {
    expect(dayText(base.date)).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
    expect(dayText('2026-11-05T10:00:00Z')).toBe('Thu 5 Nov');
    expect(nextSessionWeek(review, base.week)).toBe(base.week + 1);
    const monthly = s.reviews.find((r) => r.id === 'security')!;
    expect(nextSessionWeek(monthly, sessionWeek(monthly, week))).toBe(sessionWeek(monthly, week) + 4);
  });
});
