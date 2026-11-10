// @vitest-environment node
/* Deciding in a review (deep review P2, 10 Nov): a goal behind leaves the walk with a next step or an accepted risk,
   the next session opens with what the last one agreed, and Finish says what was decided. */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit } from '../data/store';
import { acceptRisk, reviewCall, type ActionContext } from './actions';
import { attentionFor } from './attention';
import { currentCycle, scopeToCycle } from './cycle';
import { acceptedReason, decisionFor, lastTime, needsDecision, sessionDecisions } from './decide';
import { currentWeek } from './plan';
import { reviewSession, sessionToDo } from './review';
import type { Snapshot } from './types';

const day = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(day);
const c = currentCycle(full.cycles, day)!;
const wk = currentWeek(c, day);
let clock = Date.parse('2026-11-11T09:00:00Z');
let n = 0;
const live = (snap: Snapshot) => scopeToCycle(snap, c);
const x = (snap: Snapshot, who = 'daniel'): ActionContext => ({ snapshot: live(snap), cycle: c, week: wk, actor: full.people.find((p) => p.id === who)!, now: new Date(clock += 60_000).toISOString(), newId: (p: string) => `${p}-dec-${++n}`, allGoals: snap.goals, full: snap });
const review = full.reviews.find((r) => r.id === 'devprod')!;
const sess = (snap: Snapshot) => reviewSession(review, live(snap), c, day, wk);
/** A goal in the review that is behind and has nothing decided yet. */
const behind = (snap: Snapshot) => sess(snap).items.find((a) => needsDecision(a.status.status) && !decisionFor(a.goal, sess(snap), live(snap), c, wk, day))!.goal;

describe('deciding in a review (deep review P2)', () => {
  it('asks for a decision on goals off track or at risk, and only those', () => {
    expect(needsDecision('off')).toBe(true);
    expect(needsDecision('risk')).toBe(true);
    for (const k of ['on', 'done', 'stale', 'planned', 'none']) expect(needsDecision(k)).toBe(false);
  });

  it('counts a next step only with an owner and a week; a note or an undated action is not a decision', () => {
    let snap = full;
    const g = behind(snap);
    snap = applyCommit(snap, reviewCall(x(snap), g, review, 'note', 'Talked it through', { week: sess(snap).week }));
    snap = applyCommit(snap, reviewCall(x(snap), g, review, 'action', 'Find out what blocks it', { week: sess(snap).week, assigneeId: 'rhea' }));
    expect(decisionFor(g, sess(snap), live(snap), c, wk, day)).toBeNull();
    snap = applyCommit(snap, reviewCall(x(snap), g, review, 'action', 'Agree the runner budget with Amara', { week: sess(snap).week, assigneeId: 'rhea', dueWeek: wk + 1 }));
    expect(decisionFor(g, sess(snap), live(snap), c, wk, day)).toMatchObject({ kind: 'next-step', who: 'rhea', dueWeek: wk + 1, inSession: true });
  });

  it('accepts the risk only with a reason, and reads it back as the decision', () => {
    let snap = full;
    const g = behind(snap);
    expect(() => acceptRisk(x(snap), g, review, 'ok', sess(snap).week)).toThrow(/Say why/);
    snap = applyCommit(snap, acceptRisk(x(snap), g, review, 'The vendor fix lands next release; nothing we can do sooner.', sess(snap).week));
    const d = decisionFor(g, sess(snap), live(snap), c, wk, day);
    expect(d).toMatchObject({ kind: 'accept-risk', reason: 'The vendor fix lands next release; nothing we can do sooner.' });
    expect(acceptedReason('Just a note')).toBeNull();
    // Accepting the risk doesn't put it in hand: the goal still needs attention.
    expect(attentionFor(g, live(snap), c, day).handled?.kind).not.toBe('action');
  });

  it('a next step agreed on the goal page since the latest check-in counts, until its week passes', () => {
    let snap = full;
    const g = behind(snap);
    snap = applyCommit(snap, reviewCall(x(snap), g, { ...review, id: 'elsewhere' } as typeof review, 'action', 'Pair with SRE on the alerts', { week: sess(snap).week, assigneeId: 'rhea', dueWeek: wk }));
    expect(decisionFor(g, sess(snap), live(snap), c, wk, day)).toMatchObject({ kind: 'next-step', inSession: false });
    expect(decisionFor(g, sess(snap), live(snap), c, wk + 1, day)).toBeNull();
  });

  it('opens the next session with what the last one agreed, open ones first, and Finish groups it by owner', () => {
    let snap = full;
    const s0 = sess(snap);
    const [g1, g2] = s0.items.filter((a) => needsDecision(a.status.status)).map((a) => a.goal);
    snap = applyCommit(snap, reviewCall(x(snap), g1!, review, 'action', 'Ship the batching workaround', { week: s0.week, assigneeId: 'rhea', dueWeek: s0.week + 1 }));
    snap = applyCommit(snap, acceptRisk(x(snap), g2!, review, 'Waiting on the Q4 budget, decided above us.', s0.week));
    const sum = sessionDecisions(sess(snap));
    expect(sum.byOwner.find((o) => o.who === 'rhea')?.steps.map((d) => d.note)).toContain('Ship the batching workaround');
    expect(sum.accepted).toEqual([{ goalId: g2!.id, reason: 'Waiting on the Q4 budget, decided above us.' }]);
    // The next session (two weeks on) opens with that action.
    const next = s0.week + review.everyWeeks;
    const last = lastTime(review, live(snap), next, next);
    expect(last?.week).toBe(s0.week);
    expect(last?.actions.find((a) => a.ask.ask === 'Ship the batching workaround')).toMatchObject({ who: 'rhea', state: 'overdue' });
  });
});

describe('a review is to do only once there is something to review (deep review U6)', () => {
  it('is not to do on day one, before any check-in and before its day', () => {
    const mon = new Date('2026-11-09T09:00:00Z');
    const snap = live(full);
    const ss = reviewSession(review, { ...snap, checkIns: [] }, c, mon, currentWeek(c, mon));
    expect(sessionToDo(ss, { checkIns: [] }, currentWeek(c, mon), mon)).toBe(ss.date <= '2026-11-09');
    // With the example's check-ins it is to do whenever it is this week's and not held.
    const real = reviewSession(review, snap, c, mon, currentWeek(c, mon));
    if (real.week === Math.max(1, currentWeek(c, mon)) && real.done < real.total) expect(sessionToDo(real, snap, currentWeek(c, mon), mon)).toBe(true);
  });
});
