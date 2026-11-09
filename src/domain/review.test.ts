// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { dayText, daysPast, isHealthy, pastText, lastHeld, nextSessionDate, nextSessionWeek, nextWhen, openActions, reviewSession, sessionDate, sessionState, sessionStateText, sessionWeek, sessionWhen, upcomingSessionWeek } from './review';
import { storyOf } from './story';
import type { Ask, Decision, Snapshot } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s = buildPlatformOrg(today);
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
    const st = storyOf(s.goals.find((g) => g.id === 'ns-lead')!, s, cycle, week, today);
    expect(st.needs).toMatch(/^Amara Nwosu: /);
    expect(st.needs).not.toMatch(/^Amara Nwosu: Amara/);
  });
});

describe('where a review session stands (Lane, 5 Nov)', () => {
  const review = s.reviews.find((r) => r.id === 'weekly')!;
  const base = reviewSession(review, s, cycle, today, week);
  const ack = (goalId: string, at: string, w = base.week): Decision => ({ id: 'a_' + goalId + w, goalId, checkInId: null, reviewId: 'weekly', week: w, kind: 'acknowledge', byId: 'amara', at, note: '' });
  const act = (id: string, dueWeek: number | null, w = base.week, reviewId = 'weekly', status: Ask['status'] = 'open'): Ask => ({ id, kind: 'action', goalIds: ['ns-lead'], askedBy: 'amara', recipientId: 'rhea', ask: 'Do it', status, dueWeek, reviewId, week: w, checkInId: null, createdAt: '2026-10-29T10:00:00Z', updatedAt: '2026-10-29T10:00:00Z', answer: null, answeredBy: null, answeredAt: null });
  const withD = (extra: Decision[]): Snapshot => ({ ...s, decisions: [...s.decisions, ...extra] });
  const withA = (extra: Ask[]): Snapshot => ({ ...s, requests: [...(s.requests ?? []), ...extra] });

  it('[REVIEW-LIST-STATE] says how many days a session not yet held is past its date (demo review, 8 Nov)', () => {
    const at = (iso: string) => new Date(iso + 'T12:00:00Z');
    expect(daysPast(base, at(base.date.slice(0, 10)))).toBe(0);
    const later = new Date(Date.parse(base.date.slice(0, 10) + 'T12:00:00Z') + 3 * 86_400_000);
    expect(daysPast(base, later)).toBe(3);
    expect(pastText(3)).toBe('3 days past');
    expect(pastText(1)).toBe('1 day past');
    const held = reviewSession(review, withD(base.items.map((a) => ack(a.goal.id, '2026-10-29T10:00:00Z'))), cycle, today, week);
    expect(daysPast(held, later)).toBe(0);
  });
  it('[REVIEW-LIST-STATE] has not started when nothing has been said in this session', () => {
    expect(sessionState(base)).toEqual({ kind: 'not-started' });
    expect(sessionStateText(sessionState(base))).toBe('Not started');
  });
  it('[REVIEW-LIST-STATE] is in progress, with how many reviewed, once something is said or reviewed', () => {
    const one = reviewSession(review, withD([ack(base.items[0]!.goal.id, '2026-10-29T10:00:00Z')]), cycle, today, week);
    expect(sessionState(one)).toEqual({ kind: 'in-progress', done: 1, total: base.total });
    expect(sessionStateText(sessionState(one))).toBe(`In progress · 1 of ${base.total} reviewed`);
    // A note alone starts the session without reviewing anything.
    const noted = reviewSession(review, withD([{ ...ack('ns-lead', '2026-10-29T10:00:00Z'), id: 'n1', kind: 'note', note: 'Hm' }]), cycle, today, week);
    expect(sessionState(noted)).toEqual({ kind: 'in-progress', done: 0, total: base.total });
    // So does a question or an action raised in it: they're part of the session's record.
    const asked = reviewSession(review, withA([act('q1', null)]), cycle, today, week);
    expect(sessionState(asked)).toEqual({ kind: 'in-progress', done: 0, total: base.total });
    expect(asked.said.find((d) => d.id === 'q1')).toMatchObject({ kind: 'action', ask: { status: 'open' } });
  });
  it('[REVIEW-LIST-STATE] is held, on the day the last goal was reviewed, once every goal is', () => {
    const all = base.items.map((a, i) => ack(a.goal.id, i === 0 ? '2026-10-30T09:00:00Z' : '2026-10-29T10:00:00Z'));
    const held = reviewSession(review, withD(all), cycle, today, week);
    expect(sessionState(held)).toEqual({ kind: 'held', on: '2026-10-30' });
    expect(sessionStateText(sessionState(held))).toBe('Held Fri 30 Oct');
  });
  it('[REVIEW-LIST-STATE] was last held in the latest earlier session where anything was said', () => {
    // The example's weekly was held last week.
    const last = lastHeld(review, s, base.week)!;
    expect(last.week).toBe(base.week - 1);
    const older = withD([ack('ns-lead', '2026-10-15T10:00:00Z', base.week - 2), ack('ns-lead', '2026-10-29T10:00:00Z')]);
    expect(lastHeld(review, older, base.week)).toEqual(last);
    // Nothing said before this session: never held.
    expect(lastHeld(review, { ...s, decisions: [], requests: [] }, base.week)).toBeNull();
  });
  it('[REVIEW-LIST-STATE] counts open actions: agreed in this review, until done or withdrawn, overdue ones too', () => {
    const x = withA([act('due-now', week), act('later', week + 2), act('no-date', null), act('past', week - 1, week - 1), act('done', week, week, 'weekly', 'done'), act('gone', week, week, 'weekly', 'withdrawn'), act('other', null, base.week, 'security')]);
    const mine = new Set(['due-now', 'later', 'no-date', 'past', 'done', 'gone', 'other']);
    expect(openActions(review, x).map((d) => d.id).filter((id) => mine.has(id)).sort()).toEqual(['due-now', 'later', 'no-date', 'past']);
  });
  it('[REVIEW-LIST-STATE] dates a session, and knows the next one', () => {
    expect(dayText(base.date)).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
    expect(dayText('2026-11-05T10:00:00Z')).toBe('Thu 5 Nov');
    expect(nextSessionWeek(review, base.week)).toBe(base.week + 1);
    const monthly = s.reviews.find((r) => r.id === 'security')!;
    expect(nextSessionWeek(monthly, sessionWeek(monthly, week))).toBe(sessionWeek(monthly, week) + 4);
  });
});

describe('an outstanding session and the next one, named apart (review F07)', () => {
  const review = s.reviews.find((r) => r.id === 'weekly')!;
  const w = sessionWeek(review, week, cycle);
  const date = sessionDate(review, cycle, w);
  const after = new Date(Date.parse(date + 'T12:00:00Z') + 4 * 86_400_000);
  const quiet = { ...s, decisions: s.decisions.filter((d) => d.reviewId !== review.id) };
  it('a session past its date and not held is "Outstanding from …", and the next is named beside it', () => {
    const sx = reviewSession(review, quiet, cycle, after, week);
    expect(sx.week).toBe(w);
    expect(sessionWhen(sx, after)).toBe(`Outstanding from ${dayText(date)} (4 days past)`);
    const next = sessionDate(review, cycle, upcomingSessionWeek(review, cycle, week, after));
    expect(next > date).toBe(true);
    expect(nextSessionDate(sx, cycle, week, after)).toBe(next);
    expect(nextWhen(sx, cycle, week, after)).toBe(`Next ${dayText(next)}`);
  });
  it('on the day itself, the session is just its date, with no separate next', () => {
    const on = new Date(date + 'T09:00:00Z');
    const sx = reviewSession(review, quiet, cycle, on, week);
    expect(sessionWhen(sx, on)).toBe(dayText(date));
    expect(nextWhen(sx, cycle, week, on)).toBeNull();
  });
});

/* Deep review T3 (10 Nov): the walk keeps the order it started with, and marking the goals with nothing flagged can be
   taken back. Daniel runs the Developer Productivity fortnightly on the talk's day, Wednesday 11 November. */
import { sessionPlan, walkOrder } from './review';
import { markReviewed, reviewCall, type ActionContext } from './actions';
import { unmarkReviewed } from './removal';
import { currentCycle, scopeToCycle } from './cycle';
import { applyCommit } from '../data/store';

describe('a review session keeps its order while it runs (deep review T3)', () => {
  const day = new Date('2026-11-11T12:00:00Z');
  const full = buildPlatformOrg(day);
  const c = currentCycle(full.cycles, day)!;
  const wk = currentWeek(c, day);
  let clock = Date.parse('2026-11-11T09:00:00Z');
  let n = 0;
  const x = (snap: Snapshot): ActionContext => ({ snapshot: snap, cycle: c, week: wk, actor: full.people.find((p) => p.id === 'daniel')!, now: new Date(clock += 60_000).toISOString(), newId: (p: string) => `${p}-t3-${++n}`, allGoals: snap.goals, full: snap });
  const review = full.reviews.find((r) => r.id === 'devprod')!;
  const live = (snap: Snapshot) => scopeToCycle(snap, c);
  const sess = (snap: Snapshot) => reviewSession(review, live(snap), c, day, wk);

  it('numbers the walk once: reviewing goals, and saving an action on one, never moves a goal or skips one', () => {
    let snap = full;
    const start = walkOrder(sessionPlan(sess(snap), live(snap), c, day));
    expect(start.length).toBeGreaterThan(3);
    // Review the first two, then save an action on the third (which makes it "being handled" under today's rule).
    for (const id of start.slice(0, 2)) snap = applyCommit(snap, reviewCall(x(live(snap)), live(snap).goals.find((g) => g.id === id)!, review, 'acknowledge', '', { week: sess(snap).week }));
    const third = live(snap).goals.find((g) => g.id === start[2])!;
    snap = applyCommit(snap, reviewCall(x(live(snap)), third, review, 'action', 'Agree the runner budget with Amara', { week: sess(snap).week, assigneeId: 'daniel' }));
    const after = walkOrder(sessionPlan(sess(snap), live(snap), c, day));
    expect(after).toEqual(start);
    // Continue picks up at the third goal: "Goal 3 of N".
    expect(after.findIndex((id) => !sess(snap).covered.has(id)) + 1).toBe(3);
  });

  it('marks the goals with nothing flagged together, and Undo puts every one back on the agenda', () => {
    let snap = full;
    const s0 = sess(snap);
    const healthy = sessionPlan(s0, live(snap), c, day).healthy.map((a) => a.goal);
    expect(healthy.length).toBeGreaterThan(0);
    const marked = markReviewed(x(live(snap)), healthy, review, s0.week);
    expect(marked.decisions!.length).toBe(healthy.length);
    expect(marked.changes.length).toBe(healthy.length);
    snap = applyCommit(snap, marked);
    expect(sess(snap).done).toBe(s0.done + healthy.length);
    const undo = unmarkReviewed(x(live(snap)), marked.decisions!);
    expect(undo.changes.every((ch) => ch.action === 'undone')).toBe(true);
    snap = applyCommit(snap, undo);
    expect(sess(snap).done).toBe(s0.done);
    // Someone else can't take back Daniel's marks.
    const other: ActionContext = { ...x(live(snap)), actor: full.people.find((p) => p.id === 'rhea' && !p.admin) ?? full.people.find((p) => !p.admin && p.id !== 'daniel')! };
    expect(() => unmarkReviewed(other, marked.decisions!)).toThrow(/Only whoever marked them/);
  });
});
