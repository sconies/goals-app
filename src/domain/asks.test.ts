// @vitest-environment node
/* One way to ask (consolidation 4, 5 Nov): a decision or help, an update, a question and an action are one record,
   open until explicitly answered (an action: done) or withdrawn, with the rules for who may do what in one place. */
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import * as A from './actions';
import { askedOf, actionList } from './goalPage';
import { answeredSince, asksOf, canAnswer, linkRequest, liveNotes, openAsksFor, openFor, openForPerson, openUpdateAsk, parseAsk, requestsAfterCheckIn, upgradeAsks } from './asks';
import { planChanges, type Rec } from './changeset';
import { currentWeek } from './plan';
import { openActions, saidIn } from './review';
import { storyOf } from './story';
import type { CheckIn, Decision, Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s0 = buildPlatformOrg(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;
const now = today.toISOString();
const person = (s: Snapshot, id: string) => s.people.find((p) => p.id === id)!;
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
const latest = (s: Snapshot, id: string) => s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.week - b.week || a.postedAt.localeCompare(b.postedAt)).at(-1)!;
const ctx = (s: Snapshot, who: string): A.ActionContext => ({ snapshot: s, cycle, week, actor: person(s, who), now, newId });
const run = (s: Snapshot, c: ReturnType<typeof A.askQuestion> | null) => (c ? applyCommit(s, c) : s);
const withNeeds = (c: CheckIn, needs: string): CheckIn => ({ ...c, id: `ci_test_${++n}`, week, postedAt: now, pathToGreen: { what: c.pathToGreen?.what ?? 'Interim scope', byWeek: null, state: 'help', needs } });

describe('decisions or help (requests)', () => {
  it('start from the asks in check-ins, addressed to the person named', () => {
    const open = openFor('ns-lead', s0);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ kind: 'decision', recipientId: 'amara', askedBy: 'rhea' });
    expect(open[0]!.ask).not.toMatch(/^Amara/);
    expect(openForPerson('amara', s0).some((r) => r.id === open[0]!.id)).toBe(true);
    expect(parseAsk('Nobody Known: do a thing', s0.people)).toEqual({ recipientId: null, ask: 'Nobody Known: do a thing' });
  });
  it('carry on from check-in to check-in, and are withdrawn when the ask is dropped', () => {
    const r0 = openFor('ns-lead', s0)[0]!;
    expect(requestsAfterCheckIn(goal(s0, 'ns-lead'), withNeeds(latest(s0, 'ns-lead'), `Amara Nwosu: ${r0.ask}`), s0, 'rhea', now, newId).requests).toEqual([]);
    const reworded = requestsAfterCheckIn(goal(s0, 'ns-lead'), withNeeds(latest(s0, 'ns-lead'), 'Amara Nwosu: approve half the runner budget now'), s0, 'rhea', now, newId);
    expect(reworded.requests[0]).toMatchObject({ id: r0.id, ask: 'approve half the runner budget now', status: 'open' });
    const dropped = requestsAfterCheckIn(goal(s0, 'ns-lead'), withNeeds(latest(s0, 'ns-lead'), ''), s0, 'rhea', now, newId);
    expect(dropped.requests[0]).toMatchObject({ id: r0.id, status: 'withdrawn' });
    expect(dropped.changes[0]!.action).toBe('withdrawn');
  });
  it('are answered once for every linked goal, and the next review sees it was answered', () => {
    const r = openFor('ns-lead', s0)[0]!;
    const link = linkRequest(r, goal(s0, 'lead-merge'), s0, 'pavel', now, newId);
    let s = applyCommit(s0, { requests: link.requests, changes: link.changes });
    expect(asksOf(s).find((x) => x.id === r.id)!.goalIds).toEqual([...r.goalIds, 'lead-merge']);
    expect(canAnswer(r, person(s, 'amara'))).toBe(true);
    expect(canAnswer(r, person(s, 'oskar'))).toBe(false);
    expect(() => A.answerRequest(ctx(s, 'oskar'), r, 'Yes')).toThrow(/Amara Nwosu or an admin/);
    s = run(s, A.answerRequest(ctx(s, 'amara'), asksOf(s).find((x) => x.id === r.id)!, 'Approved for Q4.'));
    expect(openFor('ns-lead', s)).toEqual([]);
    expect(openFor('lead-merge', s)).toEqual([]);
    expect(answeredSince('lead-merge', latest(s, 'lead-merge').postedAt, s)?.answer).toBe('Approved for Q4.');
    expect(storyOf(goal(s, 'ns-lead'), s, cycle, week, today).answered?.answer).toBe('Approved for Q4.');
  });
  it('are raised from imported check-ins by the same rules', () => {
    const c = latest(s0, 'mttr-pir');
    const rec: Rec = { __row: '2', 'goal id': 'mttr-pir', week: String(week), value: String(c.value), call: 'At risk', cause: 'Blocked by a dependency', why: 'Waiting on the incident tool vendor for the export.', 'path to green': 'Close the actions by hand meanwhile.', recovery: 'Needs a decision or help', needs: 'Amara Nwosu: fund a contractor for two weeks' };
    const cs = planChanges({ tables: { checkIns: [rec] }, snapshot: s0, cycle, week, actor: person(s0, 'mateo'), now, newId, via: 'spreadsheet' });
    expect(cs.issues.filter((i) => i.severity === 'error').map((i) => i.message)).toEqual([]);
    expect(cs.commit!.requests?.find((r) => r.ask === 'fund a contractor for two weeks')).toMatchObject({ kind: 'decision', recipientId: 'amara', status: 'open', goalIds: ['mttr-pir'] });
  });
});

describe('asks for an update', () => {
  const quiet = 'env-search';
  it('open on the owner’s Home, once, until the owner checks in', () => {
    const owner = goal(s0, quiet).ownerId;
    let s = run(s0, A.askForUpdate(ctx(s0, 'rhea'), goal(s0, quiet)));
    const ask = openUpdateAsk(quiet, s)!;
    expect(ask).toMatchObject({ kind: 'update', askedBy: 'rhea', recipientId: owner, status: 'open' });
    expect(openForPerson(owner, s).map((r) => r.id)).toContain(ask.id);
    expect(A.askForUpdate(ctx(s, 'oskar'), goal(s, quiet))).toBeNull();
    // A check-in answers it: that's what was asked.
    const c = { ...latest(s, quiet), id: 'ci_new', week, postedAt: now };
    const after = requestsAfterCheckIn(goal(s, quiet), c, s, owner, now, newId);
    s = applyCommit(s, { checkIns: [c], requests: after.requests, changes: after.changes });
    expect(asksOf(s).find((r) => r.id === ask.id)).toMatchObject({ status: 'answered', answer: `Checked in for week ${week}`, answeredBy: owner });
    expect(openUpdateAsk(quiet, s)).toBeNull();
  });
  it('are withdrawn by whoever asked (or an admin), and the log keeps both', () => {
    let s = run(s0, A.askForUpdate(ctx(s0, 'rhea'), goal(s0, quiet)));
    expect(() => A.undoUpdateAsk(ctx(s, 'oskar'), goal(s, quiet))).toThrow(/whoever asked/);
    s = run(s, A.undoUpdateAsk(ctx(s, 'rhea'), goal(s, quiet)));
    expect(openUpdateAsk(quiet, s)).toBeNull();
    expect(s.changes.filter((c) => c.entity === 'request' && c.goalId === quiet).map((c) => c.action).slice(-2)).toEqual(['asked', 'withdrawn']);
  });
  it('can’t be asked of yourself', () => {
    expect(() => A.askForUpdate(ctx(s0, 'kojo'), goal(s0, quiet))).toThrow(/your own goal/);
  });
});

describe('questions', () => {
  it('stay open on the owner’s Home and the goal page until the owner answers: a comment doesn’t answer one', () => {
    let s = run(s0, A.askQuestion(ctx(s0, 'oskar'), goal(s0, 'lead-review'), 'Which repositories are slowest?'));
    const q = asksOf(s).find((r) => r.kind === 'question' && r.ask === 'Which repositories are slowest?')!;
    expect(q).toMatchObject({ recipientId: 'tariq', status: 'open' });
    s = run(s, A.addNote(ctx(s, 'tariq'), goal(s, 'lead-review'), 'Looking into it.'));
    expect(asksOf(s).find((r) => r.id === q.id)!.status).toBe('open');
    expect(askedOf(goal(s, 'lead-review'), s, person(s, 'tariq'), null).map((x) => x.id)).toContain(q.id);
    s = run(s, A.answerRequest(ctx(s, 'tariq'), q, 'The twelve with a single code owner.'));
    expect(asksOf(s).find((r) => r.id === q.id)).toMatchObject({ status: 'answered', answer: 'The twelve with a single code owner.', answeredBy: 'tariq' });
    expect(openForPerson('tariq', s).map((r) => r.id)).not.toContain(q.id);
    expect(actionList(goal(s, 'lead-review'), s, week, 'on', latest(s, 'lead-review'), cycle).find((x) => x.id === q.id)!.state).toBe('done');
  });
  it('raised in a review are part of its session, with their state', () => {
    const review = s0.reviews.find((r) => r.id === 'weekly')!;
    const s = run(s0, A.reviewCall(ctx(s0, 'amara'), goal(s0, 'ns-cost'), review, 'ask', 'Is the GPU line still growing?', { week }));
    const said = saidIn(s).find((d) => d.note === 'Is the GPU line still growing?')!;
    expect(said).toMatchObject({ kind: 'ask', reviewId: 'weekly', week });
    expect(said.ask).toMatchObject({ kind: 'question', recipientId: 'bjorn', status: 'open' });
    expect(() => A.reviewCall(ctx(s0, 'bjorn'), goal(s0, 'ns-cost'), review, 'ask', 'Me?', { week })).toThrow(/own goal/);
  });
});

describe('actions', () => {
  const review = s0.reviews.find((r) => r.id === 'weekly')!;
  it('stay open past their week (overdue) until marked done: they no longer drop off', () => {
    let s = run(s0, A.reviewCall(ctx(s0, 'amara'), goal(s0, 'ns-env'), review, 'action', 'Split the data-backed environments goal', { week: week - 3, assigneeId: 'camille', dueWeek: week - 1 }));
    const a = asksOf(s).find((r) => r.ask === 'Split the data-backed environments goal')!;
    expect(a).toMatchObject({ kind: 'action', recipientId: 'camille', dueWeek: week - 1, status: 'open', reviewId: 'weekly' });
    expect(openForPerson('camille', s).map((r) => r.id)).toContain(a.id);
    expect(openActions(review, s).map((r) => r.id)).toContain(a.id);
    expect(actionList(goal(s, 'ns-env'), s, week, 'off', latest(s, 'ns-env'), cycle).find((x) => x.id === a.id)!.state).toBe('overdue');
    expect(() => A.answerRequest(ctx(s, 'camille'), a, 'Done')).toThrow(/marked done/);
    expect(() => A.markActionDone(ctx(s, 'oskar'), a)).toThrow(/Camille Laurent, whoever asked for it, or an admin/);
    s = run(s, A.markActionDone(ctx(s, 'camille'), a, 'Split: data-backed environments have their own goal.'));
    expect(asksOf(s).find((r) => r.id === a.id)).toMatchObject({ status: 'done', answeredBy: 'camille' });
    expect(openActions(review, s).map((r) => r.id)).not.toContain(a.id);
    expect(actionList(goal(s, 'ns-env'), s, week, 'off', latest(s, 'ns-env'), cycle).find((x) => x.id === a.id)!.state).toBe('done');
    expect(s.changes.at(-1)).toMatchObject({ entity: 'request', action: 'done' });
  });
  it('can be marked done by whoever agreed them, and withdrawn by them, but not answered', () => {
    let s = run(s0, A.reviewCall(ctx(s0, 'amara'), goal(s0, 'ns-cost'), review, 'action', 'Cost the second region', { week, assigneeId: 'ethan', dueWeek: week + 2 }));
    const a = asksOf(s).find((r) => r.ask === 'Cost the second region')!;
    expect(() => A.withdrawRequest(ctx(s, 'ethan'), a)).toThrow(/whoever asked/);
    s = run(s, A.withdrawRequest(ctx(s, 'amara'), a));
    expect(asksOf(s).find((r) => r.id === a.id)!.status).toBe('withdrawn');
    expect(saidIn(s).some((d) => d.id === a.id)).toBe(false);
  });
  it('keep a goal behind plan in hand until their week passes', () => {
    const s = run(s0, A.reviewCall(ctx(s0, 'amara'), goal(s0, 'ns-lead'), review, 'action', 'Ask finance for an early decision', { week, assigneeId: 'amara', dueWeek: week + 1 }));
    const g = goal(s, 'ns-lead');
    expect(actionList(g, s, week, 'off', latest(s, 'ns-lead'), cycle).some((x) => x.what === 'Ask finance for an early decision' && x.state === 'open')).toBe(true);
  });
});

describe('the example’s asks', () => {
  it('has every kind in every state, each open one waiting on someone', () => {
    const kinds = new Set(asksOf(s0).map((r) => `${r.kind}:${r.status}`));
    for (const k of ['decision:open', 'decision:answered', 'decision:withdrawn', 'update:open', 'update:answered', 'update:withdrawn', 'question:open', 'question:answered', 'action:open', 'action:done']) expect(kinds.has(k), k).toBe(true);
    for (const r of asksOf(s0).filter((x) => x.status === 'open' && x.kind !== 'decision')) expect(r.recipientId, r.id).toBeTruthy();
    // Questions and actions said in reviews are asks now, never decisions.
    expect(s0.decisions.some((d) => d.kind === 'ask' || d.kind === 'action')).toBe(false);
    expect(openAsksFor('ns-lead', s0).length).toBeGreaterThan(0);
  });
});

describe('data from before one ask model', () => {
  it('reads a review’s questions and actions and the asks for an update (comments) as asks', () => {
    const g = goal(s0, 'cost-storage');
    const old: Decision[] = [
      { id: 'd_q', goalId: g.id, checkInId: null, reviewId: 'weekly', week: week - 1, kind: 'ask', byId: 'amara', at: '2026-10-29T10:00:00Z', note: 'Is it still on?' },
      { id: 'd_a', goalId: g.id, checkInId: null, reviewId: 'weekly', week: week - 1, kind: 'action', byId: 'amara', at: '2026-10-29T10:05:00Z', note: 'Update the lifecycle rules', assigneeId: 'jonah', dueWeek: week + 1 },
    ];
    const note = { id: 'chg_u', at: '2026-10-30T09:00:00Z', actorId: 'amara', goalId: g.id, entity: 'note' as const, entityId: 'note_u', action: 'noted' as const, summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: 'Jonah, could you post an update? The last check-in was week 40.' }] };
    const legacy: Snapshot = { ...s0, requests: undefined, decisions: [...s0.decisions, ...old], changes: [...s0.changes, note] };
    const s = upgradeAsks(legacy);
    expect(asksOf(s).find((r) => r.id === 'd_q')).toMatchObject({ kind: 'question', recipientId: 'jonah', status: 'open', reviewId: 'weekly' });
    expect(asksOf(s).find((r) => r.id === 'd_a')).toMatchObject({ kind: 'action', recipientId: 'jonah', dueWeek: week + 1, status: 'open' });
    expect(asksOf(s).find((r) => r.id === 'note_u')).toMatchObject({ kind: 'update', recipientId: 'jonah', status: 'open' });
    expect(s.decisions.some((d) => d.id === 'd_q' || d.id === 'd_a')).toBe(false);
    expect(liveNotes(s.changes).some((c) => c.id === 'chg_u')).toBe(false);
    expect(s.changes.find((c) => c.id === 'chg_u')).toMatchObject({ entity: 'request', action: 'asked' });
    // Data already in the new shape comes back as it is.
    expect(upgradeAsks(s0)).toBe(s0);
  });
});
