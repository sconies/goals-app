import { beforeAll, describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit, type Commit } from '../data/store';
import { homeAsks } from '../app/reads';
import { loadEngine, loadGoalEntry, perform, type RunContext } from '../app/actions';
import { asksFollowOwner, handedFrom } from './askHandover';
import { asksOf } from './asks';
import { planChanges } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { draftOf } from './goal';
import { currentWeek } from './plan';
import type { Goal, Snapshot } from './types';

const TODAY = new Date('2026-11-11T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_ah${++n}`;

function world(full = buildPlatformOrg(TODAY)) {
  const cycle = currentCycle(full.cycles, TODAY)!;
  return { full, cycle, week: currentWeek(cycle, TODAY) };
}
type World = ReturnType<typeof world>;
const x = (w: World, who: string): RunContext => ({ snapshot: scopeToCycle(w.full, w.cycle), cycle: w.cycle, week: w.week, actor: w.full.people.find((p) => p.id === who)!, now: TODAY.toISOString(), newId, allGoals: w.full.goals, full: w.full, workspace: { id: 'ws', name: 'Platform' }, modules: [] });
const run = (w: World, who: string, name: string, input: unknown) => {
  const out = perform(x(w, who), name as never, input as never) as Commit | { commit: Commit };
  const commit = 'commit' in out ? out.commit : out;
  return { ...w, full: applyCommit(w.full, commit), commit };
};

/** Tunde's goal, with Rhea's open question on it and an older question Tunde has answered. */
function asked() {
  let w = world();
  const s = scopeToCycle(w.full, w.cycle);
  const goal = s.goals.find((g) => g.ownerId === 'tunde')!;
  w = run(w, 'rhea', 'askQuestion', { goalId: goal.id, text: 'Is the cache warm before the nightly build?' });
  const open = asksOf(w.full as Snapshot).at(-1)!;
  w = run(w, 'amara', 'askQuestion', { goalId: goal.id, text: 'Which runners does it cover?' });
  const done = asksOf(w.full as Snapshot).at(-1)!;
  w = run(w, 'tunde', 'answerRequest', { askId: done.id, answer: 'Every Linux runner.' });
  const to = w.full.people.find((p) => p.id !== 'tunde' && p.id !== 'rhea' && p.id !== 'amara' && !p.leftAt && !p.removedAt)!;
  return { w, goal, open, done, to };
}

beforeAll(async () => { await loadGoalEntry(); await loadEngine(); });

describe('asks follow a goal’s new owner (Lane, 13 Nov)', () => {
  it('goal edit: the open question goes to the new owner, logged on the ask and on the goal; the answered one stays', () => {
    const { w, goal, open, done, to } = asked();
    const g = scopeToCycle(w.full, w.cycle).goals.find((v) => v.id === goal.id)!;
    const after = run(w, 'tunde', 'saveGoal', { goalId: g.id, draft: { ...draftOf(g), ownerId: to.id }, confirm: true });
    const moved = after.commit.requests ?? [];
    expect(moved.map((r) => [r.id, r.recipientId])).toEqual([[open.id, to.id]]);
    expect(asksOf(after.full as Snapshot).find((r) => r.id === done.id)!.recipientId).toBe('tunde');
    const onAsk = after.commit.changes.find((c) => c.entity === 'request' && c.entityId === open.id)!;
    expect(onAsk.diffs).toEqual([{ field: 'Asked of', from: 'Tunde Bakare', to: to.name }]);
    expect(onAsk.summary).toBe(`Moved Rhea Kapoor’s ask to ${to.name}, who owns ${g.title} now`);
    expect(after.commit.changes.find((c) => c.entity === 'goal')!.diffs).toContainEqual({ field: 'Open asks (1)', from: 'Tunde Bakare', to: to.name });
    // Home: the new owner sees it as "Asked of Tunde, now yours"; Tunde no longer sees it.
    const s = scopeToCycle(after.full, after.cycle);
    expect(homeAsks(to.id, s, after.cycle, after.week, TODAY).find((a) => a.askId === open.id)?.was).toBe('Tunde Bakare');
    expect(homeAsks('tunde', s, after.cycle, after.week, TODAY).some((a) => a.askId === open.id)).toBe(false);
  });

  it('the change engine (Import, Data, bulk edit and MCP): the same rule, said on the goal’s row before saving', () => {
    const { w, goal, open, to } = asked();
    const s = scopeToCycle(w.full, w.cycle);
    const cs = planChanges({ tables: { goals: [{ __row: '2', key: goal.key!, owner: to.name }] }, snapshot: s, cycle: w.cycle, week: w.week, actor: w.full.people.find((p) => p.id === 'tunde')!, now: TODAY.toISOString(), newId, via: 'mcp', full: w.full });
    expect(cs.items.find((i) => i.goalId === goal.id)!.diffs).toContainEqual({ field: 'Open asks (1)', from: 'Tunde Bakare', to: to.name });
    expect(cs.commit!.requests!.find((r) => r.id === open.id)!.recipientId).toBe(to.id);
    // Undo this import puts it back.
    expect(cs.commit!.changes.find((c) => c.action === 'imported')!.undo!.requests).toContainEqual({ id: open.id, before: expect.objectContaining({ recipientId: 'tunde' }) });
  });

  it('an ask the old owner must still answer about another goal they keep stays with them', () => {
    const { w, goal } = asked();
    const s = scopeToCycle(w.full, w.cycle);
    const other = s.goals.find((g) => g.ownerId === 'tunde' && g.id !== goal.id)!;
    const both = { ...asksOf(s).at(-1)!, id: 'ask_both', status: 'open' as const, goalIds: [goal.id, other.id], recipientId: 'tunde' };
    const moved = asksFollowOwner({ goals: s.goals, people: s.people, asks: [...asksOf(s), both] }, [{ ...goal, ownerId: 'rhea' } as Goal], { actorId: 'amara', now: TODAY.toISOString(), newId });
    expect(moved.requests.some((r) => r.id === 'ask_both')).toBe(false);
  });

  it('only asks put to the owner by role move; one asked of a person by name stays; one the new owner asked closes (Lane, 13 Nov)', () => {
    const { w, goal, open } = asked();
    const s = scopeToCycle(w.full, w.cycle);
    const ask = (id: string, kind: 'update' | 'question' | 'action' | 'decision', askedBy = 'amara') => ({ ...open, id, kind, askedBy, recipientId: 'tunde', status: 'open' as const, goalIds: [goal.id] });
    const asks = [ask('a_update', 'update'), ask('a_question', 'question'), ask('a_action', 'action'), ask('a_decision', 'decision'), ask('a_rheas', 'question', 'rhea')];
    const out = asksFollowOwner({ goals: s.goals, people: s.people, asks }, [{ ...goal, ownerId: 'rhea' } as Goal], { actorId: 'amara', now: TODAY.toISOString(), newId });
    const by = new Map(out.requests.map((r) => [r.id, r]));
    // An update and a question go with the goal; a next step and a decision stay with the person they were asked of.
    expect(by.get('a_update')!.recipientId).toBe('rhea');
    expect(by.get('a_question')!.recipientId).toBe('rhea');
    expect(by.has('a_action')).toBe(false);
    expect(by.has('a_decision')).toBe(false);
    // Rhea asked it and owns the goal now: nobody answers their own ask, so it closes.
    expect(by.get('a_rheas')).toMatchObject({ status: 'withdrawn', recipientId: 'tunde' });
    const closed = out.changes.find((c) => c.entityId === 'a_rheas')!;
    expect(closed.summary).toBe(`Closed Rhea Kapoor’s ask, since Rhea Kapoor owns ${goal.title} now`);
    expect(closed.diffs[0]).toEqual({ field: 'Asked of', from: 'Tunde Bakare', to: '—' });
    expect(out.moved.get(goal.id)).toBe(3);
  });

  it('a proposed goal that changes owner takes its asks too (review of #369, medium 2)', () => {
    const { w, goal, open } = asked();
    const s = scopeToCycle(w.full, w.cycle);
    const proposed = { ...goal, id: 'g_proposed', state: 'proposed' } as unknown as Goal;
    const q = { ...open, id: 'a_prop', goalIds: [proposed.id], recipientId: proposed.ownerId, status: 'open' as const };
    const out = asksFollowOwner({ goals: [...s.goals, proposed], people: s.people, asks: [q] }, [{ ...proposed, ownerId: 'amara' } as Goal], { actorId: 'amara', now: TODAY.toISOString(), newId });
    expect(out.requests.map((r) => [r.id, r.recipientId])).toEqual([['a_prop', 'amara']]);
  });

  it('goal edit on a proposed goal: its open question goes to the new owner (review of #369, medium 2)', () => {
    let w = world();
    const made = perform(x(w, 'tunde'), 'saveGoal', { draft: { ...draftOf(scopeToCycle(w.full, w.cycle).goals.find((g) => g.ownerId === 'tunde')!), title: 'Signed artifacts in staging', key: null }, state: 'proposed' } as never) as unknown as { commit: Commit; goal: Goal };
    w = { ...w, full: applyCommit(w.full, made.commit) };
    w = run(w, 'rhea', 'askQuestion', { goalId: made.goal.id, text: 'Which registries does it cover?' });
    const q = asksOf(w.full as Snapshot).at(-1)!;
    expect(q.goalIds).toEqual([made.goal.id]);
    const p = scopeToCycle(w.full, w.cycle).proposed!.find((g) => g.id === made.goal.id)!;
    const after = run(w, 'tunde', 'saveGoal', { goalId: p.id, draft: { ...draftOf(p), ownerId: 'amara' }, state: 'proposed', confirm: true });
    expect((after.commit.requests ?? []).map((r) => [r.id, r.recipientId])).toEqual([[q.id, 'amara']]);
  });

  it('says who it was asked of only while it is still with the person it came to', () => {
    const c = (to: string, at: string) => ({ id: at, at, actorId: 'a', goalId: 'g', entity: 'request' as const, entityId: 'r1', action: 'edited' as const, summary: '', diffs: [{ field: 'Asked of', from: 'Tunde Bakare', to }] });
    expect(handedFrom('r1', 'Sam Patel', [c('Sam Patel', '2026-11-10')])).toBe('Tunde Bakare');
    expect(handedFrom('r1', 'Sam Patel', [c('Sam Patel', '2026-11-10'), c('Kofi Boateng', '2026-11-11')])).toBe(null);
    expect(handedFrom('r2', 'Sam Patel', [c('Sam Patel', '2026-11-10')])).toBe(null);
  });
});
