// @vitest-environment node
/* Goal entry, rules 1, 2, 4, 7 and 12 (docs/design/goal-entry/spec.md, section 6; GE1): every worked example, and the
   saveGoal action, which the form saves through. */
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed, type ActionContext } from './actions';
import { currentCycle, scopeToCycle } from './cycle';
import { blankGoal, decimalsFor, type GoalDraft } from './goal';
import { checksContext, formNeed, goalChecks, goalMustFix, openLine, planGoal, planSpanOf, REASON_EMPTY, stepSays, stepFields, stepState, unanswered, type ChecksContext, type GoalCheck, type MustFixContext, sameNamedIn } from './goalEntry';
import { mayAddGoal, mayChangeGoal } from './goalRights';
import { numberAsTyped } from './numbers';
import { currentWeek } from './plan';
import type { Goal, MetricGoal } from './types';
import type { ModuleRecords } from './records';

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
    expect(stepState(2, fix)).toEqual({ go: false, focus: 'start', check: null, says: '2 things to fix above: Baseline and Target.' });
    expect(stepState(2, [{ field: 'start', id: 'start-empty', text: '' }, { field: 'target', id: 'target-empty', text: '' }, { field: 'limit', id: 'limit-empty', text: '' }, { field: 'margin', id: 'margin-negative', text: '' }]).says).toBe('4 things to fix above: Baseline, Target and 2 more.');
    expect(stepState(2, [])).toEqual({ go: true, focus: null, check: null, says: '' });
    // A fault on another step doesn't hold this one.
    expect(stepState(0, fix).go).toBe(true);
  });
});

describe('what is asked (rule 3)', () => {
  const cctx = (o: Partial<ChecksContext> = {}): ChecksContext => ({ week: 45, cycleWeeks: 53, existing: null, door: 'form', ...o });
  const asked = (d: Partial<GoalDraft>, o: Partial<ChecksContext> = {}) => goalChecks(draft(d), cctx(o)).map((c) => c.id);
  const words = (d: Partial<GoalDraft>, o: Partial<ChecksContext> = {}) => goalChecks(draft(d), cctx(o)).map((c) => c.question);
  it('asks about unlikely numbers, each that applies, in section 4’s order', () => {
    expect(asked({ start: '-5', target: '5' })).toEqual(['below-zero']);
    expect(words({ start: '-5', target: '5' })).toEqual(['-5% is below zero. That’s fine for a change or a balance. Is it right here?']);
    expect(asked({ start: '10', target: '1500' })).toEqual(['over-100', 'hundredfold']);
    expect(words({ start: '10', target: '1500' })[1]).toBe('The target (1,500%) is over 100 times where it starts (10%). Is that right?');
    expect(asked({ unit: 'days', start: '5', target: '2' })).toEqual([]);
    expect(asked({ unit: 'requests', start: '1', target: '2000000000' })).toEqual(['hundredfold', 'billion']);
  });
  it('keys an answer on the values it was about: changing them asks again', () => {
    const at = (t: string) => goalChecks(draft({ start: '50', target: t }), cctx());
    const answers = { 'over-100': at('150')[0]!.key };
    expect(unanswered(at('150'), answers)).toEqual([]);
    expect(unanswered(at('160'), answers).map((c) => c.id)).toEqual(['over-100']);
  });
  it('asks about no unit once, and not of a goal already saved without one', () => {
    expect(asked({ unit: '', start: '1', target: '5' })).toEqual(['no-unit']);
    expect(words({ unit: '', start: '1', target: '5' })).toEqual(['This number has no unit. Is it a plain count?']);
    const saved = { id: 'g', kind: 'metric', title: 'Signed artifacts', teamId: 'cicd', ownerId: 'tunde', io: 'input', level: 'team', guardrail: false, parentId: null, effect: null, source: '', definition: '', unit: '', decimals: 0, plan: { start: 1, target: 5, shape: 'straight' } } as unknown as MetricGoal;
    expect(goalChecks({ ...draft({ unit: '', start: '1', target: '6' }) }, cctx({ existing: saved })).map((c) => c.id)).toEqual([]);
  });
  it('asks about a target on the worse side of the start for the metric that measures it', () => {
    const metric = { name: 'Pipeline queue wait', direction: 'lower' as const };
    expect(words({ unit: 'min', start: '7', target: '9' }, { metric })).toEqual(['“Pipeline queue wait” is better lower, but the target (9 min) is above today (7 min). Is that the plan?']);
    expect(asked({ unit: 'min', start: '9', target: '7' }, { metric })).toEqual([]);
  });
  it('asks about a warning margin as wide as the limit', () => {
    expect(asked({ kind: 'range', limit: '12', margin: '20' })).toEqual(['margin-wide']);
    expect(asked({ kind: 'range', limit: '12', margin: '1' })).toEqual([]);
  });
  it('asks about a link to a lower level, an owner in another team and the same name in the same team', () => {
    const parent = { id: 'p', title: 'Flaky test rate', level: 'team' as const };
    expect(asked({ level: 'north-star', parentId: 'p' }, { parent })).toEqual(['feeds-lower']);
    expect(words({ level: 'north-star', parentId: 'p' }, { parent })).toEqual(['A north star usually feeds nothing, and “Flaky test rate” is a Team goal. Is this link right?']);
    expect(words({ level: 'svp', parentId: 'p' }, { parent })).toEqual(['An SVP goal usually feeds a north star, and “Flaky test rate” is a Team goal. Is this link right?']);
    expect(asked({ level: 'svp', parentId: 'p' }, { parent: { ...parent, level: 'svp' } })).toEqual([]);
    const other = goalChecks(draft({ ownerId: 'amara' }), cctx({ owner: { name: 'Amara Nwosu', teamId: 'vp', teamName: 'Office of the VP' }, team: { id: 'cicd', name: 'Build & Release' } }));
    expect(other.map((c) => [c.question, c.yes, c.no])).toEqual([['Amara is in Office of the VP, not Build & Release. Which team is this goal for?', 'Keep it in Build & Release', 'Move it to Office of the VP']]);
    expect(other[0]!.noDoes).toEqual({ teamId: 'vp' });
    const twin = { id: 'g73', key: 'G-73', title: 'Signed artifacts', ownerName: 'Rhea Kapoor' };
    expect(words({}, { team: { id: 'cicd', name: 'Build & Release' }, sameNamed: [twin] })).toEqual(['Build & Release already has a goal called “Signed artifacts” (G-73, owned by Rhea Kapoor). Is this a different goal?']);
  });
  it('never counts a goal as its own twin: not the goal being changed, nor the new goal a draft was just saved as', () => {
    const mine = { id: 'g73', key: 'G-73', title: 'Signed artifacts', teamId: 'cicd', ownerId: 'rhea' } as unknown as Goal;
    const d = draft({ teamId: 'cicd', ownerId: 'rhea', title: 'Signed ARTIFACTS ' });
    const look = { person: (id: string) => (id === 'rhea' ? { name: 'Rhea Kapoor', teamId: 'cicd' } : undefined), team: (id: string) => (id === 'cicd' ? { id, name: 'Build & Release' } : undefined), goal: () => undefined, sameNamed: sameNamedIn([mine]) };
    const base = { week: 45, cycleWeeks: 52, door: 'form' as const };
    const ids = (ctx: ChecksContext) => goalChecks(d, ctx).map((c) => c.id).filter((id) => id === 'same-name');
    // Before saving, a goal of the same team with the same name is asked about.
    expect(ids(checksContext(d, look, { ...base, existing: null }))).toEqual(['same-name']);
    // Once this draft is saved as that goal (New goal, while the goal's page opens), it isn't asked about itself.
    expect(ids(checksContext(d, look, { ...base, existing: null, savedAs: mine.id }))).toEqual([]);
    // Nor is a goal being changed.
    expect(ids(checksContext(d, look, { ...base, existing: mine }))).toEqual([]);
  });
  it('asks about a hand-set plan that leaves most of the change to the end; a chosen shape never', () => {
    const points = Object.fromEntries([10, 10, 10, 10, 9, 8].map((v, i) => [String(i + 1), String(v)]));
    expect(words({ unit: 'days', start: '10', target: '5', endWeek: '7', fromWeek: '0', points })).toEqual(['This plan leaves 80% of the change to the last 2 of 7 weeks. Is that the plan?']);
    expect(asked({ unit: 'days', start: '10', target: '5', endWeek: '7', fromWeek: '0', shape: 'back' })).toEqual([]);
  });
  it('asks whether a stage already past is done; either answer is an answer', () => {
    const c: GoalCheck[] = goalChecks(draft({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '43' }, { id: 'b', name: 'Build', dueWeek: '50' }] }), cctx());
    expect(c.map((x) => [x.slot, x.question, x.yes, x.no])).toEqual([['stage-past:a', 'Week 43 was 2 weeks ago. Is this stage already done?', 'Yes, done in week 43', 'No, it’s overdue']]);
    expect(c[0]!.noAnswers).toBe(true);
  });
  it('asks nothing about a field with a Must fix', () => {
    const d = draft({ start: '-5', target: '5' });
    expect(goalChecks(d, cctx({ mustFix: [{ field: 'start', id: 'not-number', text: '' }] })).map((x) => x.id)).toEqual([]);
  });
  it('holds a step until its questions are answered, after its Must fix (rule 4)', () => {
    const checks = goalChecks(draft({ start: '50', target: '150' }), cctx());
    expect(stepState(2, [], checks).says).toBe('Answer the question above, under Target.');
    expect(stepState(2, [], [...checks, ...goalChecks(draft({ start: '-5', target: '5' }), cctx())]).says).toBe('Answer the 2 questions above.');
    expect(stepState(2, [], checks, { 'over-100': checks[0]!.key }).go).toBe(true);
    // The edit page's line above Save is the same line (GE2 review): one rule says it.
    expect(openLine(checks)).toBe('Answer the question above, under Target.');
    expect(openLine([])).toBe('');
    expect(stepState(2, [{ field: 'unit', id: 'decimals-range', text: '' }], checks).says).toBe('1 thing to fix above: Unit.');
  });
});

const draftAt = (o: Partial<GoalDraft>) => draft(o);
describe('saving (rule 7)', () => {
  const today = new Date('2026-11-05T12:00:00Z');
  const full = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const snapshot = scopeToCycle(full, cycle);
  let n = 0;
  const as = (who: string): ActionContext => ({ snapshot, cycle, week: currentWeek(cycle, today), actor: full.people.find((p) => p.id === who)!, now: today.toISOString(), newId: (p) => `${p}_t${++n}` });

  it('saves a north star Tunde adds for Amara, with the next key and its History entry', () => {
    // Amara is in another team than CI/CD: asked first, and the answer is kept in History as "Checked".
    expect(() => planGoal(as('tunde'), { draft: draft({ ownerId: 'amara', level: 'north' }) })).toThrow(/Check with the person first: Amara is in .*, not CI\/CD\. Which team is this goal for\?/);
    const out = planGoal(as('tunde'), { draft: draft({ ownerId: 'amara', level: 'north' }), answers: { 'owner-other-team': 'amara|cicd' } });
    expect(out.goal).toMatchObject({ ownerId: 'amara', level: 'north', unit: '%', decimals: 0 });
    expect(out.goal.key).toMatch(/^G-\d+$/);
    expect(out.commit?.changes[0]?.actorId).toBe('tunde');
    expect(out.commit?.changes[0]?.diffs).toContainEqual({ field: 'Checked', from: expect.stringMatching(/^Amara is in /), to: 'Keep it in CI/CD' });
  });
  it('refuses a question not yet answered, in its words; confirm answers them all', () => {
    const team = full.people.find((p) => p.id === 'tunde')!.teamId!;
    const draft = (o: Partial<GoalDraft>) => draftAt({ teamId: team, ...o });
    expect(() => planGoal(as('tunde'), { draft: draft({ start: '50', target: '150' }) })).toThrow(/The target is over 100%\. .* Is 150% right\?/);
    expect(() => planGoal(as('tunde'), { draft: draft({ start: '50', target: '150' }), answers: { 'over-100': '50|150' } })).not.toThrow();
    expect(() => planGoal(as('tunde'), { draft: draft({ start: '50', target: '160' }), answers: { 'over-100': '50|150' } })).toThrow(/Is 160% right\?/);
    expect(() => planGoal(as('tunde'), { draft: draft({ start: '50', target: '160' }), confirm: true })).not.toThrow();
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
  it('asks whether a target on the worse side of its metric is meant, and keeps the answer as Checked (wrong-side)', () => {
    const team = full.people.find((p) => p.id === 'tunde')!.teamId!;
    const metric = { name: 'Lead time', direction: 'lower' as const };
    const d = draftAt({ teamId: team, unit: 'hours', start: '10', target: '20' });
    expect(() => planGoal(as('tunde'), { draft: d, metric })).toThrow(/“Lead time” is better lower, but the target \(20 hours\) is above today \(10 hours\)\. Is that the plan\?/);
    const out = planGoal(as('tunde'), { draft: d, metric, answers: { 'wrong-side': 'Lead time|10|20' } });
    expect(out.commit?.changes[0]?.diffs).toContainEqual({ field: 'Checked', from: expect.stringMatching(/^“Lead time” is better lower/), to: 'Yes, this goal lets it rise to 20 hours' });
  });
  it('asks it of a goal being changed from what measures it now, when the form says nothing (a module’s records)', async () => {
    const { draftOf } = await import('./goal');
    const g = snapshot.goals.find((x): x is MetricGoal => x.kind === 'metric' && x.plan.target > x.plan.start && !x.plan.points?.length)!;
    const owner = g.ownerId;
    const d = { ...draftOf(g), target: String(g.plan.target + 1) };
    const records: ModuleRecords[] = [{ module: 'test', records: [], measures: (_s, id) => (id === g.id ? { name: 'Cost', direction: 'lower' } : null) }];
    const reason = 'Agreed at the review on Monday';
    expect(() => planGoal(as(owner), { draft: d, goalId: g.id, reason })).not.toThrow();
    expect(() => planGoal({ ...as(owner), records }, { draft: d, goalId: g.id, reason })).toThrow(/“Cost” is better lower, but the target .* is above today/);
    // The form's own choice wins: "No metric" (null) asks nothing.
    expect(() => planGoal({ ...as(owner), records }, { draft: d, goalId: g.id, reason, metric: null })).not.toThrow();
  });
  it('records only stages already past as done at set-up, whatever the draft says', () => {
    const team = full.people.find((p) => p.id === 'tunde')!.teamId!;
    const wk = currentWeek(cycle, today);
    const d = draftAt({ teamId: team, kind: 'milestone', unit: '', start: '', target: '', stages: [{ id: 'st-a', name: 'Pilot', dueWeek: String(wk - 2), done: 'yes' }, { id: 'st-b', name: 'Rollout', dueWeek: String(wk + 3), done: 'yes' }] });
    const out = planGoal(as('tunde'), { draft: d, answers: { 'stage-past:st-a': String(wk - 2) } });
    const ci = out.commit?.checkIns?.[0];
    expect(ci?.week).toBe(wk - 2);
    expect(ci?.stages?.filter((u) => u.doneWeek != null).map((u) => u.stageId)).toEqual(['st-a']);
  });
  it('gives back no commit when nothing changed', async () => {
    const { draftFor } = await import('./goal');
    const g = snapshot.goals.find((x) => x.ownerId === 'tunde' && x.kind === 'metric')!;
    expect(planGoal(as('tunde'), { draft: draftFor(g), goalId: g.id }).commit).toBeNull();
  });
});

describe('a number goal’s From and To (rules 2, 3 and 13; GE9)', () => {
  const at46 = { week: 46, cycleWeeks: 53, existing: null, door: 'form' as const, startDate: '2025-12-22' };
  const min = (o: Partial<GoalDraft>) => draft({ unit: 'min', start: '42', target: '30', ...o });
  it('asks whether a plan from week 40 has been running since, and “No” starts it this week', () => {
    const c = goalChecks(min({ fromWeek: '40', endWeek: '66' }), at46).find((x) => x.id === 'from-past')!;
    expect(c.question).toBe('Week 40 was 6 weeks ago. Has this been running since then? The plan would expect 39 min by this week.');
    expect(c.yes).toBe('Yes, it was 42 min in week 40');
    expect(c.noDoes).toEqual({ fromWeek: '46' });
    expect(c.readBack).toBe('You said it has been running since week 40 (28 Sep–4 Oct 2026).');
  });
  it('says the year of a From in last year', () => {
    expect(goalChecks(min({ fromWeek: '-12', endWeek: '53' }), at46).find((x) => x.id === 'from-past')?.question).toMatch(/^Week 40 of 2025 was 58 weeks ago\./);
  });
  it('asks about a To already past, and a plan longer than a year', () => {
    expect(goalChecks(min({ fromWeek: '30', endWeek: '44' }), at46).find((x) => x.id === 'to-past')?.question).toBe('Week 44 has already passed. Was the target due then?');
    expect(goalChecks(min({ fromWeek: '30', endWeek: '93' }), at46).find((x) => x.id === 'long-plan')?.question).toBe('This plan runs 63 weeks, to week 40 of 2027. Is that right?');
  });
  it('asks nothing of the defaults: this week to the end of the year', () => {
    expect(goalChecks(min({}), at46).map((x) => x.id)).toEqual([]);
  });
  it('refuses To before From, and a week that isn’t one', () => {
    expect(goalMustFix(min({ fromWeek: '46', endWeek: '40' }), ctx({ week: 46, startDate: '2025-12-22' })).map((f) => f.id)).toEqual(['to-before-from']);
    expect(goalMustFix(min({ endWeek: 'soon' }), ctx({ week: 46, startDate: '2025-12-22' })).map((f) => f.id)).toEqual(['week-unknown']);
    expect(goalMustFix(min({ endWeek: '106' }), ctx({ week: 46, startDate: '2025-12-22' })).map((f) => f.id)).toEqual(['week-beyond']);
  });
  it('in the year’s last week, a new goal’s untouched From and To run to the end of next year (GE9 review)', () => {
    const at53 = { week: 53, cycleWeeks: 53, existing: null, door: 'form' as const, startDate: '2025-12-22' };
    expect(goalMustFix(min({}), at53).map((f) => f.id)).toEqual([]);
    expect(planSpanOf(min({}), at53)).toEqual({ from: 53, to: 105 });
  });
  it('gives a week that isn’t one an example from this week, not a fixed one', () => {
    expect(goalMustFix(min({ endWeek: 'soon' }), ctx({ week: 12, startDate: '2025-12-22' }))[0]!.text).toBe('To says “soon”. Write a year and a week, like 2026-W12, or the week’s number.');
  });
  it('doesn’t ask again of a goal whose From and To didn’t change', () => {
    const existing = { ...({} as MetricGoal), id: 'g', kind: 'metric', title: 'Signed artifacts', teamId: 'cicd', ownerId: 'tunde', unit: 'min', decimals: 0, level: 'team', plan: { start: 42, target: 30, shape: 'straight', fromWeek: 40, endWeek: 66 } } as MetricGoal;
    expect(goalChecks(min({ fromWeek: '40', endWeek: '66' }), { ...at46, existing }).filter((x) => x.id === 'from-past')).toEqual([]);
  });
});
