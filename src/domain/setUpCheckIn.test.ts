// @vitest-environment node
/* Check-ins are the owner's (R1; goalRights mayPostCheckIn), at set-up too: a goal created for someone else with stages
   already done is published without the set-up check-in, at every door (the form, a sheet, MCP, recordStagesDone), and
   the stage question says the owner marks them at the first check-in. Deleting a check-in and undoing an import ask the
   same rule. (#227's build review, the high and medium 4.) */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit } from '../data/store';
import { NotAllowed, recordStagesDone, type ActionContext } from './actions';
import { planChanges, postCheckIn, type Rec, type Via } from './changeset';
import { emptyDraft } from './checkin';
import { currentCycle, scopeToCycle } from './cycle';
import { blankGoal, type GoalDraft } from './goal';
import { checksContext, goalChecks, planGoal, sameNamedIn } from './goalEntry';
import { currentWeek, planAt } from './plan';
import { canDeleteCheckIn, deleteCheckIn, undoImport, undoPreview } from './removal';
import { checkInsFor } from './status';
import type { Goal, MetricGoal, MilestoneGoal, Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const snapshot = scopeToCycle(full, cycle);
const week = currentWeek(cycle, today);
const person = (id: string) => full.people.find((p) => p.id === id)!;
let n = 0;
const newId = (p: string) => `${p}_s${++n}`;
const as = (who: string, snap: Snapshot = snapshot, now = today.toISOString()): ActionContext => ({ snapshot: snap, full: snap, cycle, week, actor: person(who), now, newId });
const mateo = person('mateo');

/** New goal: one stage past, said done; owner Mateo. */
const draft = (): GoalDraft => ({ ...blankGoal(mateo.teamId!, 'mateo', ''), title: 'Move the runners', kind: 'milestone', unit: '', start: '', target: '', stages: [{ id: 'st-a', name: 'Pilot', dueWeek: String(week - 2), done: 'yes' }, { id: 'st-b', name: 'Rollout', dueWeek: String(week + 4), done: '' }] });
const answers = { 'stage-past:st-a': String(week - 2) };
const goalRow = (row = 2): Rec => ({ __row: String(row), goal: 'Move the runners', owner: mateo.name, team: full.teams.find((t) => t.id === mateo.teamId)!.name, type: 'milestone', stages: `Pilot@${week - 2}; Rollout@${week + 4}` });
const sheet = (who: string, via: Via) => planChanges({ tables: { goals: [goalRow()] }, snapshot, cycle, week, actor: person(who), now: today.toISOString(), newId, via, answers: { 'past-stage:goals:stages:': { choice: 'done' } } });

describe('a set-up check-in is the owner’s too', () => {
  it('the form: Oskar creates Mateo’s goal with a stage done; it is published with no check-in on it', () => {
    const out = planGoal(as('oskar'), { draft: draft(), answers });
    expect(out.commit?.goals?.[0]?.ownerId).toBe('mateo');
    expect(out.commit?.checkIns ?? []).toEqual([]);
    expect(out.commit?.changes.map((c) => c.entity)).toEqual(['goal']);
  });

  it('the form: an admin creating it is the same (not one of the two admin doors)', () => {
    expect(planGoal(as('amara'), { draft: draft(), answers }).commit?.checkIns ?? []).toEqual([]);
  });

  it('the form: Mateo creating his own records it, with him as author', () => {
    const ci = planGoal(as('mateo'), { draft: draft(), answers }).commit?.checkIns?.[0];
    expect(ci).toMatchObject({ authorId: 'mateo', week: week - 2 });
  });

  it('the stage question says who marks it, when the person entering isn’t the owner', () => {
    const look = { person: (id: string) => full.people.find((p) => p.id === id), team: (id: string) => full.teams.find((t) => t.id === id), goal: (id: string) => snapshot.goals.find((g) => g.id === id), sameNamed: sameNamedIn(snapshot.goals) };
    const base = { week, cycleWeeks: cycle.weeks, existing: null, door: 'form' as const };
    const q = (who: string) => goalChecks(draft(), checksContext(draft(), look, { ...base, actor: person(who) })).find((c) => c.id === 'stage-past')!;
    expect(q('oskar').question).toMatch(/Is this stage already done\? Mateo .* marks done stages at the first check-in\.$/);
    expect(q('oskar').readBack).toBe(`${mateo.name} marks done stages at the first check-in.`);
    expect(q('mateo').question).toMatch(/Is this stage already done\?$/);
  });

  it('a sheet, a bulk change and MCP: the row’s “They’re done” records nothing for someone else, and the question says so', () => {
    for (const via of ['spreadsheet', 'bulk', 'mcp'] as Via[]) {
      const cs = sheet('oskar', via);
      expect(cs.commit, via).not.toBeNull();
      expect(cs.commit!.checkIns ?? [], via).toEqual([]);
      expect(cs.items.some((i) => i.kind === 'check-in'), via).toBe(false);
    }
    const asked = planChanges({ tables: { goals: [goalRow()] }, snapshot, cycle, week, actor: person('oskar'), now: today.toISOString(), newId, via: 'mcp' });
    expect(asked.issues.find((i) => i.kind === 'past-stage')!.message).toMatch(/Mateo .* marks done stages at the first check-in\.$/);
    // The owner's own row records it.
    expect(sheet('mateo', 'mcp').commit!.checkIns).toHaveLength(1);
  });

  it('a workbook an admin loads still brings stages done in (one of the two admin doors)', () => {
    expect(sheet('amara', 'spreadsheet').commit!.checkIns).toHaveLength(1);
  });

  it('recordStagesDone: only the owner (no admin exception)', () => {
    const goal = planGoal(as('oskar'), { draft: draft(), answers }).goal as MilestoneGoal;
    const snap = { ...snapshot, goals: [...snapshot.goals, goal] };
    expect(() => recordStagesDone(as('oskar', snap), goal, ['st-a'])).toThrow(new NotAllowed(`Only ${mateo.name} (its owner) can say which stages are done.`));
    expect(() => recordStagesDone(as('amara', snap), goal, ['st-a'])).toThrow(NotAllowed);
    expect(recordStagesDone(as('mateo', snap), goal, ['st-a'])!.checkIns![0]!.authorId).toBe('mateo');
  });
});

describe('deleting a check-in and undoing an import ask the same rule', () => {
  const goal = snapshot.goals.find((g) => g.id === 'mttr-pir') as MetricGoal;
  const fresh: Snapshot = { ...snapshot, checkIns: snapshot.checkIns.filter((c) => !(c.goalId === goal.id && c.week === week)) };
  const later = new Date(today.getTime() + 3_600_000).toISOString();
  const onPlan = String(Math.round(planAt(goal.plan, week, cycle.weeks)));

  it('the owner deletes their latest check-in; an admin can’t', () => {
    const after = applyCommit(fresh, postCheckIn(as('mateo', fresh), { goalId: goal.id, week, draft: { ...emptyDraft(goal, null), value: onPlan }, mode: 'new' }).commit);
    const c = checkInsFor(goal, after.checkIns).at(-1)!;
    expect(canDeleteCheckIn(after, goal, c, person('amara'))).toBe(false);
    expect(() => deleteCheckIn(as('amara', after), c.id)).toThrow(new NotAllowed(`Only ${mateo.name} (its owner) can delete its check-ins.`));
    expect(canDeleteCheckIn(after, goal, c, mateo)).toBe(true);
    expect(deleteCheckIn(as('mateo', after), c.id).checkIns![0]!.removedBy).toBe('mateo');
  });

  it('the owner deletes one an admin loaded onto their goal; a previous owner can’t delete theirs', () => {
    const row: Rec = { __row: '2', 'goal id': goal.id, week: String(week), value: onPlan };
    const cs = planChanges({ tables: { checkIns: [row] }, snapshot: fresh, cycle, week, actor: person('amara'), now: today.toISOString(), newId, via: 'spreadsheet' });
    const after = applyCommit(fresh, cs.commit!);
    const c = checkInsFor(goal, after.checkIns).at(-1)!;
    expect(c.authorId).toBe('amara');
    expect(canDeleteCheckIn(after, goal, c, mateo)).toBe(true);
    // Mateo hands the goal to Rhea: his own check-in is now Rhea's goal's.
    const mine = applyCommit(fresh, postCheckIn(as('mateo', fresh), { goalId: goal.id, week, draft: { ...emptyDraft(goal, null), value: onPlan }, mode: 'new' }).commit);
    const handed: Snapshot = { ...mine, goals: mine.goals.map((g) => (g.id === goal.id ? ({ ...g, ownerId: 'rhea' } as Goal) : g)) };
    const own = checkInsFor(goal, handed.checkIns).at(-1)!;
    expect(canDeleteCheckIn(handed, { ...goal, ownerId: 'rhea' }, own, mateo)).toBe(false);
    expect(() => deleteCheckIn(as('mateo', handed), own.id)).toThrow(NotAllowed);
    expect(canDeleteCheckIn(handed, { ...goal, ownerId: 'rhea' }, own, person('rhea'))).toBe(true);
  });

  it('an admin can’t undo the owner’s correction of a check-in; the owner can', () => {
    const past = checkInsFor(goal, snapshot.checkIns).filter((c) => c.week < week).pop()!;
    const draft = { ...emptyDraft(goal, null), value: String(past.value! + 1), cause: past.cause, why: past.why, ptgWhat: past.pathToGreen?.what ?? '', ptgBy: past.pathToGreen?.byWeek ?? null, ptgState: past.pathToGreen?.state ?? 'plan', needs: past.pathToGreen?.needs ?? '', next: past.next };
    const out = postCheckIn(as('mateo'), { goalId: goal.id, week: past.week, draft, mode: 'correct', reason: 'The export was a day late' });
    const after = applyCommit(snapshot, out.commit);
    const imp = out.commit.changes.find((c) => c.action === 'imported')!.entityId;
    const admin = undoPreview(as('amara', after, later), imp);
    expect(admin.restores).toBe(0);
    expect(admin.skipped.map((k) => k.reason)).toEqual([`Only ${mateo.name} (its owner) can change its check-ins.`]);
    expect(() => undoImport(as('amara', after, later), imp)).toThrow(NotAllowed);
    expect(undoImport(as('mateo', after, later), imp).restored).toBe(1);
  });

  it('an admin still undoes a workbook they loaded (the workbook door)', () => {
    const row: Rec = { __row: '2', 'goal id': goal.id, week: String(week), value: onPlan };
    const cs = planChanges({ tables: { checkIns: [row] }, snapshot: fresh, cycle, week, actor: person('amara'), now: today.toISOString(), newId, via: 'spreadsheet' });
    const after = applyCommit(fresh, cs.commit!);
    const imp = cs.commit!.changes.find((c) => c.action === 'imported')!.entityId;
    expect(undoImport(as('amara', after, later), imp).restored).toBe(1);
  });
});
