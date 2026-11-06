// @vitest-environment node
/* Removing, archiving and undoing (domain/removal): who may, what happens to what depended on it, and a round trip for
   every kind of record: removed (then undone at once, or restored later) without anything left orphaned or lost. */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit, type Commit } from '../data/store';
import { NotAllowed, addNote, reviewCall, saveView, unwatch, deleteView, newReview, saveReview, type ActionContext } from './actions';
import { asksOf } from './asks';
import { planChanges } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { currentWeek } from './plan';
import * as R from './removal';
import { checkInsFor } from './status';
import type { Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;

/** A workspace that changes as commits are applied, and an action context for anyone in it. */
function world() {
  let full: Snapshot = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const week = currentWeek(cycle, today);
  let clock = Date.parse('2026-11-05T13:00:00Z');
  const x = (who: string): ActionContext => {
    const snapshot = scopeToCycle(full, currentCycle(full.cycles, today)!);
    return { snapshot, cycle, week, actor: full.people.find((p) => p.id === who)!, now: new Date(clock += 60_000).toISOString(), newId, allGoals: full.goals, full };
  };
  return {
    x, cycle, week,
    get full() { return full; },
    apply(c: Commit | null) { if (c) full = applyCommit(full, c); return c; },
  };
}

/** Nothing points at something that isn't there: every live record's references are to live records. */
function orphans(s: Snapshot): string[] {
  const out: string[] = [];
  const goals = new Map(s.goals.filter((g) => !g.removedAt).map((g) => [g.id, g]));
  const live = new Set(s.goals.filter((g) => !g.removedAt && !g.stoppedAt).map((g) => g.id));
  const people = new Set(s.people.filter((p) => !p.leftAt && !p.removedAt).map((p) => p.id));
  const everyone = new Set(s.people.map((p) => p.id));
  for (const g of goals.values()) {
    if (g.stoppedAt) continue;
    if (g.parentId && !live.has(g.parentId) && s.goals.find((v) => v.id === g.parentId)?.cycleId === g.cycleId) out.push(`goal ${g.id} feeds ${g.parentId}, which is gone`);
    if (!everyone.has(g.ownerId)) out.push(`goal ${g.id} is owned by no one`);
    if (!people.has(g.ownerId) && s.cycles.find((c) => c.id === g.cycleId && !c.removedAt)) out.push(`goal ${g.id} is owned by ${g.ownerId}, who has gone`);
  }
  for (const c of s.checkIns.filter((v) => !v.removedAt)) if (!s.goals.some((g) => g.id === c.goalId)) out.push(`check-in ${c.id} has no goal`);
  for (const r of asksOf(s).filter((v) => v.status === 'open')) {
    if (!r.goalIds.every((id) => live.has(id))) out.push(`open ask ${r.id} is on a goal that isn't live`);
    if (!people.has(r.askedBy) || (r.recipientId && !people.has(r.recipientId))) out.push(`open ask ${r.id} is between people who have gone`);
  }
  for (const r of (s.reviews ?? []).filter((v) => !v.removedAt && !v.endedAt)) if (!r.people.every((id) => people.has(id))) out.push(`review ${r.id} has people who have gone`);
  return out;
}

/** A record without the bookkeeping a save or a removal adds, to compare before and after. */
const plain = <T extends object>(r: T | undefined) => {
  if (!r) return r;
  const o = { ...r } as Record<string, unknown>;
  for (const k of ['version', 'updatedAt', 'removedAt', 'removedBy', 'leftAt', 'leftBy', 'stoppedAt', 'stoppedBy', 'stopReason', 'endedAt', 'endedBy', 'deletedAt', 'deletedBy']) if (o[k] == null || k === 'version' || k === 'updatedAt') delete o[k];
  return o;
};

describe('removing, archiving and undoing', () => {
  it('marks someone as left: their goals and open asks are handed over first, and they leave every list', () => {
    const w = world();
    const before = w.full;
    const goals = w.x('amara').snapshot.goals.filter((g) => g.ownerId === 'rhea');
    expect(goals.length).toBeGreaterThan(0);
    expect(() => R.markPersonLeft(w.x('amara'), 'rhea', {})).toThrow(/choose who takes them over/);
    expect(() => R.markPersonLeft(w.x('rhea'), 'tariq', { goalsTo: 'amara', asksTo: 'amara' })).toThrow(NotAllowed);
    expect(() => R.markPersonLeft(w.x('amara'), 'amara', { goalsTo: 'grace', asksTo: 'grace' })).toThrow(/yourself/);
    const c = w.apply(R.markPersonLeft(w.x('amara'), 'rhea', { goalsTo: 'tariq', asksTo: 'tariq' }))!;
    const s = w.x('amara').snapshot;
    expect(s.people.some((p) => p.id === 'rhea')).toBe(false);
    expect(s.archive!.people.map((p) => p.id)).toContain('rhea');
    expect(goals.every((g) => s.goals.find((v) => v.id === g.id)!.ownerId === 'tariq')).toBe(true);
    expect(asksOf(s).filter((r) => r.status === 'open' && (r.askedBy === 'rhea' || r.recipientId === 'rhea'))).toEqual([]);
    expect(s.reviews.some((r) => r.people.includes('rhea'))).toBe(false);
    expect(s.watches.some((v) => v.personId === 'rhea')).toBe(false);
    // History keeps them: their check-ins are still theirs.
    expect(s.checkIns.some((v) => v.authorId === 'rhea')).toBe(true);
    expect(c.changes[0]).toMatchObject({ entity: 'person', action: 'left', entityId: 'rhea' });
    expect(orphans(w.full)).toEqual([]);
    // Undo puts every one of those records back exactly.
    w.apply(R.undoRemoval(w.x('amara'), c, before));
    for (const g of goals) expect(plain(w.full.goals.find((v) => v.id === g.id))).toEqual(plain(before.goals.find((v) => v.id === g.id)));
    expect(plain(w.full.people.find((p) => p.id === 'rhea'))).toEqual(plain(before.people.find((p) => p.id === 'rhea')));
    expect(w.x('amara').snapshot.reviews.filter((r) => r.people.includes('rhea')).length).toBe(before.reviews.filter((r) => r.people.includes('rhea')).length);
  });

  it('deletes someone with no history outright, and refuses anyone with history', () => {
    const w = world();
    const p = { id: 'p_new', name: 'Sam New', role: '', initials: 'SN', teamId: 'cicd', admin: false };
    w.apply({ people: [p], changes: [] });
    expect(R.hasHistory(R.personHistory(w.full, 'p_new'))).toBe(false);
    expect(() => R.deletePerson(w.x('amara'), 'rhea')).toThrow(/mark them as left/);
    w.apply(R.deletePerson(w.x('amara'), 'p_new'));
    expect(w.x('amara').snapshot.people.some((x) => x.id === 'p_new')).toBe(false);
    expect(w.x('amara').snapshot.archive!.people.some((x) => x.id === 'p_new')).toBe(false);
    expect(R.recentlyRemoved(w.full, today).find((r) => r.id === 'p_new')?.kind).toBe('person');
  });

  it('stops a goal with history: what fed it moves up, its open asks are withdrawn, and it leaves every list but keeps its page', () => {
    const w = world();
    const s0 = w.x('amara').snapshot;
    const g = s0.goals.find((v) => s0.goals.some((c) => c.parentId === v.id) && v.parentId && checkInsFor(v, s0.checkIns).length)!;
    const kids = s0.goals.filter((c) => c.parentId === g.id).map((c) => c.id);
    expect(() => R.stopGoal(w.x(g.ownerId), g.id, 'short')).toThrow(/a sentence/);
    expect(() => R.deleteGoal(w.x(g.ownerId), g.id)).toThrow(/stop it instead/);
    const before = w.full;
    const c = w.apply(R.stopGoal(w.x(g.ownerId), g.id, 'Merged into the platform team’s roadmap.'))!;
    const s = w.x('amara').snapshot;
    expect(s.goals.some((v) => v.id === g.id)).toBe(false);
    expect(s.archive!.goals.find((v) => v.id === g.id)?.stopReason).toBe('Merged into the platform team’s roadmap.');
    expect(s.archive!.checkIns.filter((v) => v.goalId === g.id).length).toBeGreaterThan(0);
    expect(kids.every((id) => s.goals.find((v) => v.id === id)!.parentId === g.parentId)).toBe(true);
    expect(asksOf(w.full).filter((r) => r.status === 'open' && r.goalIds.includes(g.id))).toEqual([]);
    expect(orphans(w.full)).toEqual([]);
    w.apply(R.undoRemoval(w.x(g.ownerId), c, before));
    expect(kids.every((id) => w.full.goals.find((v) => v.id === id)!.parentId === g.id)).toBe(true);
    expect(plain(w.full.goals.find((v) => v.id === g.id))).toEqual(plain(before.goals.find((v) => v.id === g.id)));
  });

  it('deletes a goal with no check-ins, and an admin restores it later', () => {
    const w = world();
    const parent = w.x('amara').snapshot.goals.find((g) => g.ownerId === 'rhea')!;
    const g = { ...parent, id: 'g_new', key: 'G-999', title: 'A goal set up by mistake', parentId: parent.id, version: 0 };
    w.apply({ goals: [g], changes: [] });
    expect(() => R.deleteGoal(w.x('tariq'), g.id)).toThrow(NotAllowed);
    w.apply(R.deleteGoal(w.x('rhea'), g.id));
    expect(w.x('rhea').snapshot.goals.some((v) => v.id === g.id)).toBe(false);
    const item = R.recentlyRemoved(w.full, today).find((r) => r.id === g.id)!;
    expect(item).toMatchObject({ kind: 'goal', name: 'A goal set up by mistake', by: 'rhea' });
    expect(() => R.restoreRemoved(w.x('tariq'), 'goal', g.id)).toThrow(NotAllowed);
    w.apply(R.restoreRemoved(w.x('amara'), 'goal', g.id));
    expect(w.x('rhea').snapshot.goals.find((v) => v.id === g.id)?.parentId).toBe(parent.id);
    expect(orphans(w.full)).toEqual([]);
  });

  it('deletes a check-in only while it is the latest; the status falls back to the one before', () => {
    const w = world();
    const s = w.x('rhea').snapshot;
    const g = s.goals.find((v) => v.ownerId === 'rhea' && checkInsFor(v, s.checkIns).length >= 2)!;
    const [older, latest] = checkInsFor(g, s.checkIns).slice(-2);
    expect(() => R.deleteCheckIn(w.x('rhea'), older!.id)).toThrow(/only be corrected/);
    expect(() => R.deleteCheckIn(w.x('tariq'), latest!.id)).toThrow(NotAllowed);
    w.apply(R.deleteCheckIn(w.x(latest!.authorId), latest!.id));
    expect(checkInsFor(g, w.x('rhea').snapshot.checkIns).at(-1)?.id).toBe(older!.id);
    w.apply(R.restoreRemoved(w.x('amara'), 'check-in', latest!.id));
    expect(checkInsFor(g, w.x('rhea').snapshot.checkIns).at(-1)?.id).toBe(latest!.id);
  });

  it('ends a review that was held, deletes one that never was, and edits and removes comments and notes', () => {
    const w = world();
    const held = w.x('amara').snapshot.reviews.find((r) => R.reviewHeld(w.full, r.id))!;
    const owner = held.createdBy;
    const out = R.endReview(w.x(owner), held.id);
    expect(out.deleted).toBe(false);
    w.apply(out.commit);
    expect(w.x('amara').snapshot.reviews.some((r) => r.id === held.id)).toBe(false);
    expect(w.x('amara').snapshot.archive!.reviews.some((r) => r.id === held.id)).toBe(true);
    const fresh = newReview(w.x('rhea'), { name: 'A new one', everyWeeks: 1, weekday: 3, goals: [w.x('rhea').snapshot.goals[0]!.id] });
    w.apply(saveReview(w.x('rhea'), fresh, null));
    expect(() => R.deleteReview(w.x('tariq'), fresh.id)).toThrow(NotAllowed);
    expect(R.endReview(w.x('rhea'), fresh.id).deleted).toBe(true);
    // A comment: edited by its author only, removed by its author or an admin.
    const goal = w.x('rhea').snapshot.goals[0]!;
    const note = w.apply(addNote(w.x('rhea'), goal, 'First words'))!;
    const id = note.changes[0]!.entityId;
    expect(() => R.editComment(w.x('amara'), id, 'Not mine')).toThrow(/Only whoever wrote/);
    w.apply(R.editComment(w.x('rhea'), id, 'Better words'));
    expect(R.commentsOf(w.full.changes).get(id)).toMatchObject({ text: 'Better words' });
    expect(R.commentsOf(w.full.changes).get(id)!.editedAt).not.toBeNull();
    w.apply(R.deleteComment(w.x('amara'), id));
    expect(R.commentText(R.commentsOf(w.full.changes).get(id), '')).toBe('Comment removed');
    w.apply(R.restoreRemoved(w.x('amara'), 'comment', id));
    expect(R.commentText(R.commentsOf(w.full.changes).get(id), '')).toBe('Better words');
    // A review note.
    const review = w.x('rhea').snapshot.reviews[0]!;
    const said = w.apply(reviewCall(w.x('rhea'), goal, review, 'note', 'Worth a look next week'))!;
    w.apply(R.deleteNote(w.x('amara'), said.decisions![0]!.id));
    expect(w.x('rhea').snapshot.decisions.some((d) => d.id === said.decisions![0]!.id)).toBe(false);
  });

  it('undoes an import: every row back as it was, rows changed since skipped and listed', () => {
    const w = world();
    const s = w.x('rhea').snapshot;
    const [a, b] = s.goals.filter((g) => g.ownerId === 'rhea' && g.kind !== 'milestone');
    const cs = planChanges({ tables: { goals: [{ __row: '2', id: a!.id, goal: a!.title + ' (renamed)' }, { __row: '3', id: b!.id, goal: b!.title + ' (renamed)' }, { __row: '4', goal: 'Imported goal', owner: 'Rhea Kapoor', type: 'milestone', stages: 'Pilot@50' }] }, snapshot: s, cycle: w.cycle, week: w.week, actor: s.people.find((p) => p.id === 'rhea')!, now: w.x('rhea').now, newId, via: 'spreadsheet' });
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    w.apply(cs.commit);
    const entry = cs.commit!.changes.at(-1)!;
    expect(entry).toMatchObject({ action: 'imported', importId: entry.entityId });
    expect(entry.undo!.goals.map((u) => u.before?.title ?? null)).toEqual([a!.title, b!.title, null]);
    expect(w.full.changes.filter((c) => c.importId === entry.entityId).length).toBe(cs.items.length + 1);
    // Someone changes one of the rows afterwards: it's skipped.
    const later = { ...w.x('rhea').snapshot.goals.find((g) => g.id === b!.id)!, title: 'Changed since' };
    w.apply({ goals: [later], changes: [{ id: 'chg_later', at: w.x('rhea').now, actorId: 'rhea', goalId: b!.id, entity: 'goal', entityId: b!.id, action: 'edited', summary: 'x', diffs: [] }] });
    expect(() => R.undoImport(w.x('tariq'), entry.entityId)).toThrow(NotAllowed);
    const out = R.undoImport(w.x('rhea'), entry.entityId);
    w.apply(out.commit);
    expect(out.skipped).toEqual(['Changed since: changed since']);
    const now = w.x('rhea').snapshot;
    expect(now.goals.find((g) => g.id === a!.id)!.title).toBe(a!.title);
    expect(now.goals.some((g) => g.title === 'Imported goal')).toBe(false);
    expect(R.importUndone(w.full, entry.entityId)).toBe(true);
    expect(() => R.undoImport(w.x('rhea'), entry.entityId)).toThrow(/already been undone/);
  });

  it('round trip: removes and restores every kind of record, leaving nothing orphaned or lost', () => {
    const w = world();
    const start = w.full;
    const x = w.x;
    // Things to remove that don't exist in the example yet.
    w.apply({ people: [{ id: 'p_rt', name: 'Round Trip', role: '', initials: 'RT', teamId: 'cicd', admin: false }], changes: [] });
    const goal0 = x('rhea').snapshot.goals.find((g) => g.ownerId === 'rhea')!;
    w.apply({ goals: [{ ...goal0, id: 'g_rt', key: 'G-998', title: 'Round trip goal', parentId: goal0.id, version: 0 }], changes: [] });
    const note = w.apply(addNote(x('rhea'), goal0, 'A comment to remove'))!;
    const review = x('rhea').snapshot.reviews[0]!;
    const said = w.apply(reviewCall(x('rhea'), goal0, review, 'note', 'A note to remove'))!;
    const view = saveView(x('rhea'), { name: 'Mine', params: 'show=mine' });
    w.apply(view.commit);
    const watch = x('rhea').snapshot.watches.find((v) => v.personId === 'rhea')!;
    const fresh = newReview(x('rhea'), { name: 'Never held', everyWeeks: 1, weekday: 3, goals: [goal0.id] });
    w.apply(saveReview(x('rhea'), fresh, null));
    w.apply({ cycles: [{ ...w.cycle, id: 'cycle_rt', name: 'Next year', startDate: '2027-12-27' }], changes: [] });
    const stopped = x('amara').snapshot.goals.find((g) => g.ownerId === 'tariq' && checkInsFor(g, x('amara').snapshot.checkIns).length)!;
    const ci = (() => { const s = x('rhea').snapshot; const g = s.goals.find((v) => v.ownerId === 'rhea' && checkInsFor(v, s.checkIns).length)!; return checkInsFor(g, s.checkIns).at(-1)!; })();
    const held = x('amara').snapshot.reviews.find((r) => r.id !== review.id && R.reviewHeld(w.full, r.id))!;
    const snapshotBefore = w.full;

    const removals: [R.RemovedKind, string, Commit][] = [
      ['left', 'mateo', R.markPersonLeft(x('amara'), 'mateo', { goalsTo: 'marisol', asksTo: 'marisol' })],
      ['person', 'p_rt', R.deletePerson(x('amara'), 'p_rt')],
      ['goal', 'g_rt', R.deleteGoal(x('rhea'), 'g_rt')],
      ['stopped', stopped.id, R.stopGoal(x('tariq'), stopped.id, 'Folded into another goal this quarter.')],
      ['check-in', ci.id, R.deleteCheckIn(x(ci.authorId), ci.id)],
      ['ended', held.id, R.endReview(x('amara'), held.id).commit],
      ['review', fresh.id, R.deleteReview(x('rhea'), fresh.id)],
      ['comment', note.changes[0]!.entityId, R.deleteComment(x('rhea'), note.changes[0]!.entityId)],
      ['note', said.decisions![0]!.id, R.deleteNote(x('rhea'), said.decisions![0]!.id)],
      ['view', view.id, deleteView(x('rhea'), view.id)!],
      ['watch', watch.id, unwatch(x('rhea'), watch.id)],
      ['cycle', 'cycle_rt', R.deleteCycle(x('amara'), 'cycle_rt')],
    ];
    // Each is computed against the same workspace, then applied one after another (they touch different records).
    for (const [, , c] of removals) w.apply(c);
    const listed = R.recentlyRemoved(w.full, today);
    for (const [kind, id] of removals) expect(listed.some((r) => r.kind === kind && r.id === id), `${kind} ${id} listed`).toBe(true);
    expect(orphans(w.full)).toEqual([]);
    for (const [kind, id] of removals) w.apply(R.restoreRemoved(x('amara'), kind, id));
    expect(R.recentlyRemoved(w.full, today)).toEqual([]);
    expect(orphans(w.full)).toEqual([]);
    // Nothing lost: every record that was there is there again, live, with what it said.
    const live = scopeToCycle(w.full, w.cycle);
    const was = scopeToCycle(snapshotBefore, w.cycle);
    expect(live.people.map((p) => p.id).sort()).toEqual(was.people.map((p) => p.id).sort());
    expect(live.goals.map((g) => g.id).sort()).toEqual(was.goals.map((g) => g.id).sort());
    expect(live.checkIns.map((c) => c.id).sort()).toEqual(was.checkIns.map((c) => c.id).sort());
    expect(live.decisions.map((d) => d.id).sort()).toEqual(was.decisions.map((d) => d.id).sort());
    expect(live.reviews.map((r) => r.id).sort()).toEqual(was.reviews.map((r) => r.id).sort());
    expect(live.views!.map((v) => v.id).sort()).toEqual(was.views!.map((v) => v.id).sort());
    expect(live.watches.map((v) => v.id).sort()).toEqual(was.watches.map((v) => v.id).sort());
    expect(live.cycles.map((c) => c.id).sort()).toEqual(was.cycles.map((c) => c.id).sort());
    expect(R.commentsOf(w.full.changes).get(note.changes[0]!.entityId)?.removedAt).toBeNull();
    for (const c of was.checkIns) expect(plain(live.checkIns.find((v) => v.id === c.id))).toEqual(plain(c));
    // …and every removal and restore is in the change log.
    expect(w.full.changes.length - start.changes.length).toBeGreaterThanOrEqual(removals.length * 2);
  });
});
