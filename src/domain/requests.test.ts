// @vitest-environment node
/* Requests for a decision or help as records (product review, 3 Nov): raised in a check-in, carried while open,
   answered once for every goal waiting on it, withdrawn when not needed, and linked across goals by their owners. */
import { applyCommit } from '../data/store';
import { seed } from '../data/seed';
import { planChanges, type Rec } from './changeset';
import { currentWeek } from './plan';
import { answerRequest, answeredSince, canAnswer, linkRequest, openFor, openForPerson, parseAsk, requestsAfterCheckIn } from './requests';
import { storyOf } from './story';
import type { CheckIn, Snapshot } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s0 = seed(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const newId = (p: string) => `${p}_r${++n}`;
const now = today.toISOString();
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
const latest = (s: Snapshot, id: string) => s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.week - b.week).at(-1)!;
const withNeeds = (c: CheckIn, needs: string): CheckIn => ({ ...c, id: `ci_test_${++n}`, week, postedAt: now, pathToGreen: { what: c.pathToGreen?.what ?? 'Interim scope', byWeek: null, state: 'help', needs } });

describe('requests for a decision or help', () => {
  it('starts from the open asks in the latest check-ins, addressed to the person named', () => {
    const open = openFor('head', s0);
    expect(open).toHaveLength(1);
    expect(open[0]!.recipientId).toBe('elena');
    expect(open[0]!.ask).not.toMatch(/^Elena/);
    expect(openForPerson('elena', s0).length).toBeGreaterThanOrEqual(2);
    expect(parseAsk('Nobody Known: do a thing', s0.people)).toEqual({ recipientId: null, ask: 'Nobody Known: do a thing' });
  });
  it('carries an open request from check-in to check-in, and withdraws it when the ask is dropped', () => {
    const r0 = openFor('head', s0)[0]!;
    const same = requestsAfterCheckIn(goal(s0, 'head'), withNeeds(latest(s0, 'head'), `Elena Ruiz: ${r0.ask}`), s0, 'maya', now, newId);
    expect(same.requests).toEqual([]);
    const reworded = requestsAfterCheckIn(goal(s0, 'head'), withNeeds(latest(s0, 'head'), 'Elena Ruiz: approve read-only scope by Friday'), s0, 'maya', now, newId);
    expect(reworded.requests[0]).toMatchObject({ id: r0.id, ask: 'approve read-only scope by Friday', status: 'open' });
    const dropped = requestsAfterCheckIn(goal(s0, 'head'), withNeeds(latest(s0, 'head'), ''), s0, 'maya', now, newId);
    expect(dropped.requests[0]).toMatchObject({ id: r0.id, status: 'withdrawn' });
    expect(dropped.changes[0]!.action).toBe('withdrawn');
  });
  it('answers once for every linked goal, and the next review sees it was answered', () => {
    const own = openFor('access', s0).find((r) => r.goalIds[0] === 'access')!;
    const r = openFor('head', s0)[0]!;
    const link = linkRequest(r, goal(s0, 'access'), s0, 'aisha', now, newId);
    expect(link.requests[0]!.goalIds).toEqual(['head', 'access']);
    expect(link.requests.find((x) => x.id === own.id)?.status).toBe('withdrawn');
    let s = applyCommit(s0, { requests: link.requests, changes: link.changes });
    expect(openForPerson('elena', s).filter((x) => x.goalIds.includes('access'))).toHaveLength(1);
    expect(canAnswer(r, s.people.find((p) => p.id === 'elena')!)).toBe(true);
    expect(canAnswer(r, s.people.find((p) => p.id === 'tom')!)).toBe(false);
    const ans = answerRequest(s.requests!.find((x) => x.id === r.id)!, 'Approved until the vendor fix lands.', 'elena', now, newId);
    expect(ans.changes.map((c) => c.goalId)).toEqual(['head', 'access']);
    s = applyCommit(s, { requests: [ans.request], changes: ans.changes });
    expect(openFor('head', s)).toEqual([]);
    expect(openFor('access', s)).toEqual([]);
    expect(answeredSince('access', latest(s, 'access').postedAt, s)?.answer).toBe('Approved until the vendor fix lands.');
    expect(storyOf(goal(s, 'head'), s, cycle, week, today).answered?.answer).toBe('Approved until the vendor fix lands.');
    expect(storyOf(goal(s, 'head'), s, cycle, week, today).needs).toBeNull();
  });
  it('raises requests from imported check-ins with the same rules', () => {
    const c = latest(s0, 'alerts');
    const rec: Rec = { __row: '2', 'goal id': 'alerts', week: String(week), value: String(c.value), call: 'At risk', cause: 'Blocked by a dependency', why: 'Waiting on labelled data from the triage vendor.', 'path to green': 'Label two weeks of alerts by hand.', recovery: 'Needs a decision or help', needs: 'Elena Ruiz: fund two weeks of labelling' };
    const cs = planChanges({ tables: { checkIns: [rec] }, snapshot: s0, cycle, week, actor: s0.people.find((p) => p.id === 'kofi')!, now, newId, via: 'spreadsheet' });
    expect(cs.issues.filter((i) => i.severity === 'error').map((i) => i.message)).toEqual([]);
    expect(cs.commit!.requests?.find((r) => r.ask === 'fund two weeks of labelling')).toMatchObject({ recipientId: 'elena', status: 'open', goalIds: ['alerts'] });
  });
});
