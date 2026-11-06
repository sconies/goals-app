/* Remove, archive and undo (release 1b, Lane's decisions of 6 Nov): every kind of record that can be made can be
   removed, archived or undone, with one pattern; removed records leave every list in one place and can be restored for
   30 days. On the Platform Engineering example, Thursday 5 November (week 45). */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../src/data/platformOrg';
import { applyCommit, type Commit } from '../src/data/store';
import * as A from '../src/domain/actions';
import { asksOf } from '../src/domain/asks';
import { attentionList } from '../src/domain/attention';
import { planChanges } from '../src/domain/changeset';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { toJson, workbook } from '../src/domain/export';
import { dashboard } from '../src/domain/home';
import { currentWeek } from '../src/domain/plan';
import * as R from '../src/domain/removal';
import { reviewSession, watchedGoals } from '../src/domain/review';
import { goalScorecard } from '../src/domain/scorecard';
import { checkInsFor } from '../src/domain/status';
import { LEFT, STOPPED } from '../src/domain/words';
import type { Snapshot } from '../src/domain/types';

const Q = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_r${++n}`;
/** The clock moves on a minute with each action, from the example’s Thursday. */
let tick = 0;

function workspace() {
  let full: Snapshot = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const week = currentWeek(cycle, today);
  return {
    cycle, week,
    get full() { return full; },
    get s() { return scopeToCycle(full, cycle); },
    x(who: string): A.ActionContext { const s = scopeToCycle(full, cycle); return { snapshot: s, cycle, week, actor: full.people.find((p) => p.id === who)!, now: new Date(today.getTime() + ++tick * 60_000).toISOString(), newId, allGoals: full.goals, full }; },
    save(c: Commit | null) { if (c) full = applyCommit(full, c); return c!; },
  };
}

describe('Remove, archive and undo', () => {
  it(Q('REMOVE-ANYTHING', 'every kind of record can be removed, archived or ended, by the people the rules allow, and each removal is logged'), () => {
    const w = workspace();
    const goal = w.s.goals.find((g) => g.ownerId === 'rhea' && checkInsFor(g, w.s.checkIns).length)!;
    const ci = checkInsFor(goal, w.s.checkIns).at(-1)!;
    const note = w.save(A.addNote(w.x('rhea'), goal, 'A comment'));
    const watch = w.s.watches.find((v) => v.personId === 'rhea')!;
    const view = A.saveView(w.x('rhea'), { name: 'Mine', params: 'show=mine' });
    w.save(view.commit);
    const removals: Commit[] = [
      w.save(R.deleteCheckIn(w.x(ci.authorId), ci.id)),
      w.save(R.deleteComment(w.x('rhea'), note.changes[0]!.entityId)),
      w.save(A.unwatch(w.x('rhea'), watch.id)),
      w.save(A.deleteView(w.x('rhea'), view.id)),
      w.save(R.stopGoal(w.x('rhea'), goal.id, 'Taken over by the platform team.')),
      w.save(R.markPersonLeft(w.x('amara'), 'mateo', { goalsTo: 'marisol', asksTo: 'marisol' })),
      w.save(R.endReview(w.x('amara'), w.s.reviews.find((r) => R.reviewHeld(w.full, r.id))!.id).commit),
    ];
    // Logged, every one of them, unwatching and deleting a personal view included.
    for (const c of removals) expect(c.changes.length).toBeGreaterThan(0);
    expect(removals.map((c) => c.changes[0]!.action)).toEqual(['removed', 'removed', 'removed', 'removed', 'stopped', 'left', 'ended']);
    // Who may: not someone else's goal, comment or check-in.
    expect(() => R.stopGoal(w.x('tariq'), w.s.goals.find((g) => g.ownerId === 'rhea')!.id, 'Not mine to stop.')).toThrow(A.NotAllowed);
    expect(() => R.markPersonLeft(w.x('tariq'), 'rhea', { goalsTo: 'tariq', asksTo: 'tariq' })).toThrow(A.NotAllowed);
    // Nothing is erased: every removed row is still there.
    expect(w.full.checkIns.find((c) => c.id === ci.id)?.removedAt).toBeTruthy();
    expect(w.full.goals.find((g) => g.id === goal.id)?.stoppedAt).toBeTruthy();
  });

  it(Q('REMOVE-ANYTHING', 'removed and archived records leave every list, count, picker, attention list, review and Home in one place (the scoped snapshot)'), () => {
    const w = workspace();
    const goal = w.s.goals.find((g) => g.ownerId === 'tariq' && checkInsFor(g, w.s.checkIns).length)!;
    w.save(R.stopGoal(w.x('tariq'), goal.id, 'Merged into the review-time goal.'));
    w.save(R.markPersonLeft(w.x('amara'), 'mateo', { goalsTo: 'marisol', asksTo: 'marisol' }));
    const s = w.s;
    expect(s.goals.some((g) => g.id === goal.id)).toBe(false);
    expect(s.people.some((p) => p.id === 'mateo')).toBe(false);
    expect(attentionList(s, w.cycle, today).some((a) => a.goal.id === goal.id)).toBe(false);
    expect(dashboard('tariq', s, w.cycle, w.week, today).total).toBe(s.goals.filter((g) => g.ownerId === 'tariq').length);
    for (const r of s.reviews) expect(reviewSession(r, s, w.cycle, today, w.week).items.some((a) => a.goal.id === goal.id)).toBe(false);
    for (const p of s.people) expect(watchedGoals(p.id, s).some((g) => g.id === goal.id)).toBe(false);
  });

  it(Q('UNDO-REMOVE', 'a removal is undone straight away exactly, and an admin restores anything removed in the last 30 days from one list'), () => {
    const w = workspace();
    const before = w.full;
    const goal = w.s.goals.find((g) => g.ownerId === 'rhea' && checkInsFor(g, w.s.checkIns).length)!;
    const c = w.save(R.stopGoal(w.x('rhea'), goal.id, 'Taken over by the platform team.'));
    w.save(R.undoRemoval(w.x('rhea'), c, before));
    expect(w.full.goals.find((g) => g.id === goal.id)!.stoppedAt).toBeFalsy();
    expect(w.full.changes.at(-1)).toMatchObject({ action: 'restored', summary: expect.stringMatching(/^Undid: stopped/) });
    w.save(R.deleteCheckIn(w.x(checkInsFor(goal, w.s.checkIns).at(-1)!.authorId), checkInsFor(goal, w.s.checkIns).at(-1)!.id));
    const list = R.recentlyRemoved(w.full, today);
    expect(list[0]).toMatchObject({ kind: 'check-in', by: expect.any(String) });
    // After 30 days it drops off the list; the row stays.
    expect(R.recentlyRemoved(w.full, new Date(today.getTime() + 31 * 86_400_000))).toEqual([]);
    w.save(R.restoreRemoved(w.x('amara'), list[0]!.kind, list[0]!.id));
    expect(R.recentlyRemoved(w.full, today)).toEqual([]);
  });

  it(Q('PERSON-LEFT', 'marking someone as left hands over their goals and open asks first; history keeps their name as "Name (left)"; someone with no history is deleted outright'), () => {
    const w = workspace();
    const owned = w.s.goals.filter((g) => g.ownerId === 'mateo').map((g) => g.id);
    const asks = asksOf(w.s).filter((r) => r.status === 'open' && (r.askedBy === 'mateo' || r.recipientId === 'mateo')).map((r) => r.id);
    expect(owned.length).toBeGreaterThan(0);
    expect(() => R.markPersonLeft(w.x('amara'), 'mateo', {})).toThrow(/choose who takes them over/);
    w.save(R.markPersonLeft(w.x('amara'), 'mateo', { goalsTo: 'marisol', asksTo: 'pavel' }));
    const s = w.s;
    expect(owned.every((id) => s.goals.find((g) => g.id === id)!.ownerId === 'marisol')).toBe(true);
    for (const id of asks) { const r = asksOf(s).find((v) => v.id === id); if (r) expect([r.askedBy, r.recipientId]).not.toContain('mateo'); }
    expect(s.archive!.people.find((p) => p.id === 'mateo')).toBeTruthy();
    expect(LEFT).toBe('Left');
    // An export names them in history as "Name (left)".
    expect(JSON.stringify(toJson({ ws: { id: 'w', name: 'W' }, snapshot: s, cycle: w.cycle, week: w.week, today }))).toContain('Mateo Fernández (left)');
    w.save({ people: [{ id: 'p_blank', name: 'Blank Slate', role: '', initials: 'BS', teamId: 'sre', admin: false }], changes: [] });
    expect(() => R.markPersonLeft(w.x('amara'), 'p_blank', {})).not.toThrow();
    const del = w.save(R.deletePerson(w.x('amara'), 'p_blank'));
    expect(del.changes[0]).toMatchObject({ action: 'removed', entity: 'person' });
  });

  it(Q('GOAL-STOP', 'a goal with check-ins is stopped with a reason (what fed it moves up, open asks are withdrawn) and stays in its page, history and exports; one with none is deleted'), () => {
    const w = workspace();
    const g = w.s.goals.find((v) => w.s.goals.some((c) => c.parentId === v.id) && checkInsFor(v, w.s.checkIns).length)!;
    const kids = w.s.goals.filter((c) => c.parentId === g.id).map((c) => c.id);
    expect(() => R.stopGoal(w.x(g.ownerId), g.id, '')).toThrow(/a sentence/);
    w.save(R.stopGoal(w.x(g.ownerId), g.id, 'Replaced by a better measure.'));
    const s = w.s;
    expect(kids.every((id) => s.goals.find((v) => v.id === id)!.parentId === g.parentId)).toBe(true);
    expect(asksOf(w.full).some((r) => r.status === 'open' && r.goalIds.includes(g.id))).toBe(false);
    expect(s.archive!.checkIns.some((c) => c.goalId === g.id)).toBe(true);
    // Its page shows it as it stood, with no forecast: no "will it hit?" and no likely end on the chart.
    const stopped = s.archive!.goals.find((v) => v.id === g.id)!;
    const card = goalScorecard(stopped, w.cycle, s.archive!.checkIns, w.week, false);
    expect(card.cells.some((c) => c.key === 'hit' || c.likelihood)).toBe(false);
    expect(card.marks?.end ?? null).toBeNull();
    const goals = workbook({ ws: { id: 'w', name: 'W' }, snapshot: s, cycle: w.cycle, week: w.week, today })[0]!.rows;
    const status = goals[0]!.indexOf('Status');
    expect(goals.find((r) => r[1] === g.id)?.[status]).toBe(STOPPED);
    // Loaded back, its rows are left as they are.
    const cs = planChanges({ tables: { goals: [{ __row: '2', id: g.id, goal: g.title }] }, snapshot: s, cycle: w.cycle, week: w.week, actor: s.people.find((p) => p.id === 'amara')!, now: today.toISOString(), newId, via: 'spreadsheet' });
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const blank = { ...g, id: 'g_blank', key: 'G-997', title: 'Set up by mistake', parentId: null };
    w.save({ goals: [blank], changes: [] });
    expect(() => R.stopGoal(w.x(g.ownerId), blank.id, 'No history to keep here.')).toThrow(/delete it instead/);
    expect(w.save(R.deleteGoal(w.x(g.ownerId), blank.id)).changes[0]).toMatchObject({ action: 'removed' });
  });

  it(Q('IMPORT-UNDO', 'every change an import or bulk edit makes carries its import id; undoing it puts every row back, skipping and listing rows changed since'), () => {
    const w = workspace();
    const s = w.s;
    const g = s.goals.find((v) => v.ownerId === 'rhea' && v.kind === 'metric' && !checkInsFor(v, s.checkIns).some((c) => c.week === w.week))!;
    const value = String(g.kind === 'metric' ? g.plan.target : 0);
    const cs = planChanges({ tables: { checkIns: [{ __row: '2', 'goal id': g.id, week: String(w.week), value, why: 'Landed early this week.', cause: 'Change landed early' }] }, snapshot: s, cycle: w.cycle, week: w.week, actor: s.people.find((p) => p.id === 'rhea')!, now: today.toISOString(), newId, via: 'bulk' });
    expect(cs.commit).not.toBeNull();
    w.save(cs.commit);
    const entry = cs.commit!.changes.at(-1)!;
    expect(cs.commit!.changes.every((c) => c.importId === entry.entityId)).toBe(true);
    expect(R.canUndoImport(w.full, entry, w.s.people.find((p) => p.id === 'tariq')!)).toBe(false);
    const out = R.undoImport(w.x('rhea'), entry.entityId);
    w.save(out.commit);
    expect(out.restored).toBe(1);
    expect(checkInsFor(g, w.s.checkIns).some((c) => c.week === w.week)).toBe(false);
    expect(R.importUndone(w.full, entry.entityId)).toBe(true);
  });
});
