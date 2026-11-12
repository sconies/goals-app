// @vitest-environment node
/* Goal entry, rules 1, 2, 4, 7 and 12 (docs/design/goal-entry/spec.md, section 6; GE1): every worked example, and the
   saveGoal action, which the form saves through. */
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed, type ActionContext } from './actions';
import { currentCycle, scopeToCycle } from './cycle';
import { blankGoal, decimalsFor, type GoalDraft } from './goal';
import { formNeed, goalMustFix, planGoal, REASON_EMPTY, stepSays, stepFields, stepState, type MustFixContext } from './goalEntry';
import { mayAddGoal, mayChangeGoal } from './goalRights';
import { numberAsTyped } from './numbers';
import { currentWeek } from './plan';
import type { MetricGoal } from './types';

const ctx = (o: Partial<MustFixContext> = {}): MustFixContext => ({ cycleWeeks: 53, week: 45, existing: null, door: 'form', ...o });
const draft = (o: Partial<GoalDraft> = {}): GoalDraft => ({ ...blankGoal('cicd', 'tunde', ''), title: 'Signed artifacts', start: '40', target: '90', unit: '%', ...o });
const ids = (d: GoalDraft, o: Partial<MustFixContext> = {}) => goalMustFix(d, ctx(o)).map((f) => f.id);
const said = (d: GoalDraft, o: Partial<MustFixContext> = {}) => goalMustFix(d, ctx(o)).map((f) => f.text);

describe('what a field needs (rule 1)', () => {
  it('reads the field table: Unit optional for a number, not asked for stages; Margin optional for a range', () => {
    expect(formNeed('unit', 'metric')).toBe('optional');
    expect(formNeed('unit', 'milestone')).toBe('not-asked');
    expect(formNeed('margin', 'range')).toBe('optional');
    expect(formNeed('start', 'metric')).toBe('required');
    expect(formNeed('teamId', 'metric')).toBe('required');
  });
  it('says “Everything here is needed unless it says optional.” on step 3 of a number, not on step 1', () => {
    expect(stepSays(stepFields(2, 'metric'), 'metric')).toBe(true);
    expect(stepSays(stepFields(0, 'metric'), 'metric')).toBe(false);
    // Stages: one required field (the stages); the rest optional.
    expect(stepSays(stepFields(2, 'milestone'), 'milestone')).toBe(false);
  });
  it('starts a new goal with no unit, no decimals chosen and no warning margin', () => {
    const b = blankGoal('t', 'p', '');
    expect([b.unit, b.decimals, b.margin]).toEqual(['', '', '']);
  });
});

describe('a number as typed (rule 12)', () => {
  it.each([
    ['12', '', { n: 12 }], ['12.5', '%', { n: 12.5 }], ['-3', '', { n: -3 }], ['+3', '', { n: 3 }], ['.5', '', { n: 0.5 }],
    ['1,250', '', { n: 1250 }], ['1,250.5', '', { n: 1250.5 }], ['1,5', '', { n: 1.5 }], ['29,4', '', { n: 29.4 }],
    ['12%', '%', { n: 12 }], ['12 %', '%', { n: 12 }], ['12 days', 'days', { n: 12 }], ['12days', 'Days', { n: 12 }], ['12 mins', 'min', { n: 12 }], ['3 hrs', 'hours', { n: 3 }],
  ])('reads “%s” in a goal counting “%s”', (raw, unit, want) => expect(numberAsTyped(raw, unit)).toEqual(want));
  it.each([['12 days', '%'], ['12 days', ''], ['12%', 'days']])('says “%s” has words in a goal counting “%s”', (raw, unit) => expect(numberAsTyped(raw, unit)).toMatchObject({ problem: 'has-words', n: 12 }));
  it.each(['abc', '1.2.3', '12-'])('says “%s” is not a number', (raw) => expect(numberAsTyped(raw, '')).toEqual({ problem: 'not-number' }));
});

describe('what can’t be saved (rule 2)', () => {
  it('gives each of the worked examples', () => {
    expect(ids(draft({ title: 'ab' }))).toEqual(['name-short']);
    expect(said(draft({ start: '12 days', target: '30' }))).toEqual(['“12 days” has words in it. Type the number only, like 12; this goal counts %.']);
    expect(ids(draft({ unit: 'days', start: '12 days', target: '5' }))).toEqual([]);
    expect(ids(draft({ start: '1,5', target: '3' }))).toEqual([]);
    expect(decimalsFor(draft({ start: '1,5', target: '3' }))).toBe(1);
    expect(goalMustFix(draft({ start: '1,5', target: '3', decimals: '0' }), ctx())).toMatchObject([{ field: 'start', id: 'too-precise', keep: 1 }]);
    expect(said(draft({ start: 'abc', decimals: '0' }))).toEqual(['“abc” isn’t a number. Type digits only, like 29.']);
    expect(goalMustFix(draft({ start: '10', target: '10' }), ctx())).toMatchObject([{ field: 'target', id: 'same-as-start', hold: 10, text: 'The target is the same as today (10%). To hold a number where it is, make this a number to keep in range.' }]);
    expect(goalMustFix(draft({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '48' }, { id: 'b', name: 'design ', dueWeek: '50' }] }), ctx())).toMatchObject([{ id: 'stage-twice', row: 1 }]);
    expect(said(draft({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '60' }] }), { door: 'table' })).toEqual(['“Design” needs a due week between 1 and 53: it says “60”.']);
    expect(said(draft({ teamId: '', ownerId: 'amara' }), { owner: { name: 'Amara', teamId: null } })).toEqual(['Amara isn’t in a team. Choose the team this goal is for.']);
    expect(ids(draft())).toEqual([]);
  });
  it('allows a goal for someone else at any level: rights are rule 7’s, and they allow it', () => {
    expect(ids(draft({ ownerId: 'amara', level: 'north' }))).toEqual([]);
    expect(mayAddGoal({ id: 'tunde', admin: false }, 'amara')).toBe(true);
  });
  it('says each stage row’s own fault under it', () => {
    const fix = goalMustFix(draft({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '48' }, { id: 'b', name: 'Design', dueWeek: '49' }, { id: 'c', name: 'Pilot', dueWeek: '' }] }), ctx());
    expect(fix.map((f) => [f.id, f.row])).toEqual([['stage-twice', 1], ['stage-week', 2]]);
    expect(fix[1]!.text).toBe('Choose the week “Pilot” is due.');
  });
  it('refuses fewer decimal places than check-ins already have', () => {
    const g = { kind: 'metric', id: 'g', decimals: 1, plan: { start: 10, target: 5, shape: 'straight' } } as unknown as MetricGoal;
    const checkIns = [{ goalId: 'g', week: 44, value: 7.5 }] as never;
    expect(goalMustFix(draft({ start: '10', target: '5', decimals: '0' }), ctx({ existing: g, checkIns }))).toMatchObject([{ id: 'decimals-lose', text: '1 check-in has more decimal places than whole numbers (week 44). Keep 1 decimal place, or correct those check-ins first.' }]);
  });
  it('treats an empty margin as none, and a negative one as a Must fix', () => {
    expect(ids(draft({ kind: 'range', limit: '12', margin: '' }))).toEqual([]);
    expect(ids(draft({ kind: 'range', limit: '12', margin: '-1' }))).toEqual(['margin-negative']);
  });
});

describe('whether a step goes on (rule 4)', () => {
  it('counts each field with a Must fix, in the form’s order, and names the first to focus', () => {
    const fix = goalMustFix(draft({ start: '', target: '30 mins' }), ctx());
    expect(stepState(2, fix)).toEqual({ go: false, focus: 'start', says: '2 things to fix above: Today and Target.' });
    expect(stepState(2, [{ field: 'start', id: 'start-empty', text: '' }, { field: 'target', id: 'target-empty', text: '' }, { field: 'limit', id: 'limit-empty', text: '' }, { field: 'margin', id: 'margin-negative', text: '' }]).says).toBe('4 things to fix above: Today, Target and 2 more.');
    expect(stepState(2, [])).toEqual({ go: true, focus: null, says: '' });
    // A fault on another step doesn't hold this one.
    expect(stepState(0, fix).go).toBe(true);
  });
});

describe('saving (rule 7)', () => {
  const today = new Date('2026-11-05T12:00:00Z');
  const full = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const snapshot = scopeToCycle(full, cycle);
  let n = 0;
  const as = (who: string): ActionContext => ({ snapshot, cycle, week: currentWeek(cycle, today), actor: full.people.find((p) => p.id === who)!, now: today.toISOString(), newId: (p) => `${p}_t${++n}` });

  it('saves a north star Tunde adds for Amara, with the next key and its History entry', () => {
    const out = planGoal(as('tunde'), { draft: draft({ ownerId: 'amara', level: 'north' }) });
    expect(out.goal).toMatchObject({ ownerId: 'amara', level: 'north', unit: '%', decimals: 0 });
    expect(out.goal.key).toMatch(/^G-\d+$/);
    expect(out.commit?.changes[0]?.actorId).toBe('tunde');
  });
  it('refuses what must be fixed, in its words', () => {
    expect(() => planGoal(as('tunde'), { draft: draft({ start: '12 days' }) })).toThrow(/has words in it/);
  });
  it('lets only the owner or an admin change a goal', () => {
    const theirs = snapshot.goals.find((g) => g.ownerId !== 'tunde')!;
    expect(mayChangeGoal({ id: 'tunde', admin: false }, theirs)).toBe(false);
    expect(() => planGoal(as('tunde'), { draft: { ...draft(), title: 'Renamed' }, goalId: theirs.id })).toThrow(NotAllowed);
  });
  it('asks for a reason when the plan changes after check-ins have started, and keeps it as Why', async () => {
    const { draftOf } = await import('./goal');
    const g = snapshot.goals.find((x): x is MetricGoal => x.kind === 'metric' && snapshot.checkIns.some((c) => c.goalId === x.id) && !x.plan.points?.length)!;
    const owner = full.people.find((p) => p.id === g.ownerId)!;
    const d = { ...draftOf(g), target: String(g.plan.target + (g.plan.target > g.plan.start ? 1 : -1)) };
    expect(() => planGoal(as(owner.id), { draft: d, goalId: g.id, confirm: true })).toThrow(REASON_EMPTY);
    const out = planGoal(as(owner.id), { draft: d, goalId: g.id, reason: 'Agreed at the review on Monday', confirm: true });
    expect(out.commit?.changes[0]?.diffs.find((x) => x.field === 'Why')?.to).toBe('Agreed at the review on Monday');
  });
  it('gives back no commit when nothing changed', async () => {
    const { draftFor } = await import('./goal');
    const g = snapshot.goals.find((x) => x.ownerId === 'tunde' && x.kind === 'metric')!;
    expect(planGoal(as('tunde'), { draft: draftFor(g), goalId: g.id }).commit).toBeNull();
  });
});
