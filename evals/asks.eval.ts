/* One way to ask (consolidation 4, approved 5 Nov): a decision or help, an update, a question and an action are one
   record. Each opens, is answered (an action: done) or withdrawn, explicitly, and appears once on Home (Needs your
   response) and once on the goal page (Asked of you for whoever must respond; the action list for everyone). A comment
   never closes one. On the Platform Engineering example, Thursday 5 November (week 45). */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../src/data/platformOrg';
import { applyCommit } from '../src/data/store';
import * as A from '../src/domain/actions';
import { asksOf, openForPerson, requestsAfterCheckIn } from '../src/domain/asks';
import { actionList, askedOf } from '../src/domain/goalPage';
import { currentWeek } from '../src/domain/plan';
import { saidIn } from '../src/domain/review';
import type { Ask, AskKind, Snapshot } from '../src/domain/types';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-11-05T12:00:00Z');
const s0 = buildPlatformOrg(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const newId = (p: string) => `${p}_e${++n}`;
const person = (s: Snapshot, id: string) => s.people.find((p) => p.id === id)!;
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
const x = (s: Snapshot, who: string): A.ActionContext => ({ snapshot: s, cycle, week, actor: person(s, who), now: today.toISOString(), newId });
const save = (s: Snapshot, c: Parameters<typeof applyCommit>[1] | null) => (c ? applyCommit(s, c) : s);
const review = s0.reviews.find((r) => r.id === 'weekly')!;
const latest = (s: Snapshot, id: string) => s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;

/** Opens one ask of each kind on lead-review (Tariq's), from the people who'd ask it. */
function openOneOfEach(): { s: Snapshot; ids: Record<AskKind, string> } {
  let s = s0;
  const before = new Set(asksOf(s).map((r) => r.id));
  const fresh = () => asksOf(s).filter((r) => !before.has(r.id)).at(-1)!;
  s = save(s, A.reviewCall(x(s, 'amara'), goal(s, 'lead-review'), review, 'ask', 'Which repositories wait longest for a first review?', { week }));
  const question = fresh().id; before.add(question);
  s = save(s, A.reviewCall(x(s, 'amara'), goal(s, 'lead-review'), review, 'action', 'Name a second code owner for the twelve single-owner repositories', { week, assigneeId: 'tariq', dueWeek: week + 2 }));
  const action = fresh().id; before.add(action);
  // An update, on a goal gone quiet; a decision, raised in its owner's check-in.
  s = save(s, A.askForUpdate(x(s, 'rhea'), goal(s, 'env-search')));
  const update = fresh().id; before.add(update);
  const c = { ...latest(s, 'lead-review'), id: 'ci_eval', week, postedAt: today.toISOString(), pathToGreen: { what: 'Pair on reviews', byWeek: week + 3, needs: 'Daniel Okafor: lend two reviewers for a fortnight' } };
  const r = requestsAfterCheckIn(goal(s, 'lead-review'), c, s, 'tariq', today.toISOString(), newId);
  s = applyCommit(s, { checkIns: [c], requests: r.requests, changes: r.changes });
  const decision = fresh().id;
  return { s, ids: { question, action, update, decision } };
}

describe('one way to ask', () => {
  const { s, ids } = openOneOfEach();
  const ask = (snap: Snapshot, id: string) => asksOf(snap).find((r) => r.id === id)!;

  it(R('ONE-ASK', 'every kind is one record: who asked, who must respond, by when, the goals, open'), () => {
    expect(ask(s, ids.question)).toMatchObject({ kind: 'question', askedBy: 'amara', recipientId: 'tariq', status: 'open', reviewId: 'weekly', week });
    expect(ask(s, ids.action)).toMatchObject({ kind: 'action', askedBy: 'amara', recipientId: 'tariq', status: 'open', dueWeek: week + 2 });
    expect(ask(s, ids.update)).toMatchObject({ kind: 'update', askedBy: 'rhea', recipientId: 'kojo', status: 'open' });
    expect(ask(s, ids.decision)).toMatchObject({ kind: 'decision', askedBy: 'tariq', recipientId: 'daniel', status: 'open', goalIds: ['lead-review'] });
    for (const id of Object.values(ids)) expect(s.changes.some((c) => c.entity === 'request' && c.entityId === id && c.action === 'asked')).toBe(true);
  });

  it(R('ONE-ASK', 'each appears once on the Home of whoever must respond'), () => {
    const once = (who: string, id: string) => openForPerson(who, s).filter((r) => r.id === id).length;
    expect(once('tariq', ids.question)).toBe(1);
    expect(once('tariq', ids.action)).toBe(1);
    expect(once('kojo', ids.update)).toBe(1);
    expect(once('daniel', ids.decision)).toBe(1);
    expect(once('amara', ids.question)).toBe(0);
  });

  it(R('ONE-ASK', 'each appears once on the goal page: in Asked of you for whoever must respond, in the action list for everyone'), () => {
    const tariq = person(s, 'tariq');
    const asked = askedOf(goal(s, 'lead-review'), s, tariq, null).map((a) => a.id);
    expect(asked.filter((id) => id === ids.question)).toHaveLength(1);
    expect(asked.filter((id) => id === ids.action)).toHaveLength(1);
    expect(asked).not.toContain(ids.decision);
    const list = actionList(goal(s, 'lead-review'), s, week, 'risk', latest(s, 'lead-review'), cycle);
    for (const id of [ids.question, ids.action, ids.decision]) expect(list.filter((a) => a.id === id)).toHaveLength(1);
    expect(list.find((a) => a.id === ids.action)).toMatchObject({ state: 'open', due: week + 2, who: 'tariq' });
    expect(askedOf(goal(s, 'lead-review'), s, person(s, 'daniel'), null).map((a) => a.id)).toEqual([ids.decision]);
  });

  it(R('ONE-ASK', 'a comment closes nothing: a question stays open until it’s answered'), () => {
    const commented = save(s, A.addNote(x(s, 'tariq'), goal(s, 'lead-review'), 'Looking into it this week.'));
    expect(ask(commented, ids.question).status).toBe('open');
    const answered = save(commented, A.answerRequest(x(commented, 'tariq'), ask(commented, ids.question), 'The twelve with a single code owner.'));
    expect(ask(answered, ids.question)).toMatchObject({ status: 'answered', answer: 'The twelve with a single code owner.', answeredBy: 'tariq' });
    expect(openForPerson('tariq', answered).map((r) => r.id)).not.toContain(ids.question);
    expect(saidIn(answered).find((d) => d.id === ids.question)?.ask?.status).toBe('answered');
  });

  it(R('ONE-ASK', 'an action is marked done, never answered, and stays open (overdue) past its week until it is'), () => {
    expect(() => A.answerRequest(x(s, 'tariq'), ask(s, ids.action), 'Done')).toThrow(/marked done/);
    const later = actionList(goal(s, 'lead-review'), s, week + 3, 'risk', latest(s, 'lead-review'), cycle).find((a) => a.id === ids.action);
    expect(later?.state).toBe('overdue');
    const done = save(s, A.markActionDone(x(s, 'tariq'), ask(s, ids.action), 'Kwame and Mei are second owners now.'));
    expect(ask(done, ids.action)).toMatchObject({ status: 'done', answeredBy: 'tariq' });
    expect(actionList(goal(done, 'lead-review'), done, week + 3, 'risk', latest(done, 'lead-review'), cycle).find((a) => a.id === ids.action)?.state).toBe('done');
    expect(done.changes.at(-1)).toMatchObject({ entity: 'request', action: 'done' });
  });

  it(R('ONE-ASK', 'an update is answered by the owner’s check-in, or withdrawn by whoever asked'), () => {
    const c = { ...latest(s, 'env-search'), id: 'ci_kojo', week, postedAt: today.toISOString() };
    const r = requestsAfterCheckIn(goal(s, 'env-search'), c, s, 'kojo', today.toISOString(), newId);
    const checked = applyCommit(s, { checkIns: [c], requests: r.requests, changes: r.changes });
    expect(ask(checked, ids.update)).toMatchObject({ status: 'answered', answer: `Checked in for week ${week}` });
    expect(() => A.undoUpdateAsk(x(s, 'oskar'), goal(s, 'env-search'))).toThrow(/whoever asked/);
    const withdrawn = save(s, A.undoUpdateAsk(x(s, 'rhea'), goal(s, 'env-search')));
    expect(ask(withdrawn, ids.update).status).toBe('withdrawn');
    expect(openForPerson('kojo', withdrawn).map((q) => q.id)).not.toContain(ids.update);
  });

  it(R('ONE-ASK', 'who may answer, mark done and withdraw is one set of rules'), () => {
    expect(() => A.answerRequest(x(s, 'oskar'), ask(s, ids.decision), 'Yes')).toThrow(/Only Daniel Okafor or an admin/);
    expect(() => A.markActionDone(x(s, 'oskar'), ask(s, ids.action))).toThrow(/Only Tariq Haddad, whoever asked for it, or an admin/);
    // Whoever agreed an action may mark it done; an admin may answer anything.
    expect(() => A.markActionDone(x(s, 'amara'), ask(s, ids.action))).not.toThrow();
    expect(() => A.answerRequest(x(s, 'grace'), ask(s, ids.decision), 'Approved by ops')).not.toThrow();
    // The owner of the goal a decision was raised on may withdraw it; nobody else (but an admin).
    expect(() => A.withdrawRequest(x(s, 'oskar'), ask(s, ids.decision))).toThrow();
    expect(ask(save(s, A.withdrawRequest(x(s, 'tariq'), ask(s, ids.decision))), ids.decision).status).toBe('withdrawn');
    // Nothing closed opens again.
    const done = save(s, A.markActionDone(x(s, 'tariq'), ask(s, ids.action)));
    expect(() => A.markActionDone(x(done, 'tariq'), ask(done, ids.action))).toThrow(/isn’t open/);
  });

  it(R('ONE-ASK', 'the example carries every kind in every state, and no question or action as a decision any more'), () => {
    const states = new Set(asksOf(s0).map((r: Ask) => `${r.kind}:${r.status}`));
    for (const k of ['decision:open', 'decision:answered', 'update:open', 'update:answered', 'update:withdrawn', 'question:open', 'question:answered', 'action:open', 'action:done']) expect(states.has(k), k).toBe(true);
    expect(s0.decisions.some((d) => d.kind === 'ask' || d.kind === 'action')).toBe(false);
  });
});
