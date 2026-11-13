// @vitest-environment node
/* A goal with a baseline and nothing else yet (backlog GB, domain/proposed targetNotSet): a proposed number goal may save
   with its start (the baseline) and unit and no target; it says "Target not set", is judged nowhere, and is made active
   only once a target is set. Every door: the form's rule, the save, the Goals sheet, the read-back, the rows. */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit } from '../data/store';
import { goalFromRows, goalToRows } from '../data/rows';
import { loadEngine, loadGoalEntry, perform, type RunContext } from '../app/actions';
import { planChanges } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { targetText } from './format';
import { blankGoal, draftOf, type GoalDraft } from './goal';
import { goalMustFix, proposedMustFix } from './goalEntry';
import { currentWeek } from './plan';
import { baselineOnly, isProposed, targetNotSet, TARGET_NOT_SET } from './proposed';
import { readyToActivate } from './proposedActions';
import { proposedSummary } from './proposedSummary';
import { readBack } from './readBack';
import type { Commit } from './commit';
import type { Goal, MetricGoal } from './types';

const DAY = (d: string) => new Date(d + 'T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_gb${++n}`;
const full0 = buildPlatformOrg(DAY('2026-11-11'));
const today = DAY('2026-11-11');
const cycle = currentCycle(full0.cycles, today)!;
const week = currentWeek(cycle, today);
const ctx = (who: string, full = full0): RunContext => ({ snapshot: scopeToCycle(full, cycle), cycle, week, actor: full.people.find((p) => p.id === who)!, now: today.toISOString(), newId, allGoals: full.goals, full, workspace: { id: 'ws', name: 'Platform' }, modules: [] });
const fixCtx = { cycleWeeks: cycle.weeks, week, existing: null, door: 'form' as const, startDate: cycle.startDate };
const rhea = full0.people.find((p) => p.id === 'rhea')!;
const team = rhea.teamId!;
const owner = rhea.id;
const draft = (o: Partial<GoalDraft> = {}): GoalDraft => ({ ...blankGoal(team, owner, ''), title: 'Cost per pipeline run', unit: 'USD', decimals: '2', start: '0.42', target: '', ...o });
beforeAll(async () => { await loadGoalEntry(); await loadEngine(); });

const propose = (d: GoalDraft, full = full0) => {
  const out = perform(ctx('rhea', full), 'saveGoal', { draft: d, state: 'proposed' } as never) as unknown as { commit: Commit; goal: Goal };
  return { full: applyCommit(full, out.commit), goal: out.goal };
};

describe('saving: a proposed number goal may leave its target unset', () => {
  it('a baseline and no target is no Must fix while proposed; an active goal still needs its target', () => {
    expect(baselineOnly(draft())).toBe(true);
    expect(proposedMustFix(draft(), fixCtx).map((f) => f.id)).toEqual([]);
    expect(goalMustFix(draft(), fixCtx).map((f) => f.id)).toContain('target-empty');
    // A target and no baseline is still judged in full: the baseline is what this goal is.
    expect(proposedMustFix(draft({ start: '', target: '0.3' }), fixCtx).map((f) => f.id)).toContain('start-empty');
  });
  it('it saves as a number goal with its start, unit and baseline, and says "Target not set"', () => {
    const { goal } = propose(draft({ baselinePeriod: 'June to September 2026', baselineProvisional: true }));
    const g = goal as MetricGoal;
    expect(isProposed(g)).toBe(true);
    expect(g.kind).toBe('metric');
    expect(targetNotSet(g)).toBe(true);
    expect([g.unit, g.plan.start]).toEqual(['USD', 0.42]);
    expect(g.baseline).toMatchObject({ value: 0.42, period: 'June to September 2026', provisional: true });
    expect(targetText(g)).toBe(TARGET_NOT_SET);
    expect(draftOf(g).target).toBe('');
  });
  it('an active goal can’t save with no target', () => {
    expect(() => perform(ctx('rhea'), 'saveGoal', { draft: draft() } as never)).toThrow();
  });
  it('the read-back says where it is and that no target is set', () => {
    const rb = readBack(draft(), { cycle, week, today, level: 'team', owner: { name: rhea.name, isViewer: true }, teamName: 'CI/CD', parent: null, alsoHelps: [], metric: null, answers: [], rhythm: 'weekly', reviewsOn: true, reviewsJoined: [], wsName: 'Platform', state: 'proposed' });
    expect(rb.rows[0]!.text).toBe('A number at 0.42 USD now. No target is set yet: set one before it is made active.');
  });
});

describe('judged nowhere, and made active only once a target is set', () => {
  it('its line has no status and its target says "Target not set"', () => {
    const { full, goal } = propose(draft());
    const s = proposedSummary(goal, scopeToCycle(full, cycle), cycle, week);
    expect([s.status, s.target]).toEqual(['none', TARGET_NOT_SET]);
  });
  it('making it active asks for the target; once set, it may be made active', () => {
    const { full, goal } = propose(draft());
    expect(readyToActivate(goal, { cycleWeeks: cycle.weeks, week, startDate: cycle.startDate }).map((f) => f.id)).toEqual(['target-empty']);
    expect(() => perform(ctx('rhea', full), 'activate', { goalId: goal.id } as never)).toThrow(/target/i);
    const set = perform(ctx('rhea', full), 'saveGoal', { goalId: goal.id, draft: { ...draftOf(goal), target: '0.3' } } as never) as unknown as { commit: Commit; goal: Goal };
    const after = set.goal as MetricGoal;
    expect(targetNotSet(after)).toBe(false);
    expect(after.plan.target).toBe(0.3);
    expect(readyToActivate(after, { cycleWeeks: cycle.weeks, week, startDate: cycle.startDate })).toEqual([]);
  });
});

describe('the Goals sheet', () => {
  it('a proposed row with a Start and no Target loads with no Must fix', () => {
    const out = planChanges({ tables: { goals: [{ __row: '2', goal: 'Cost per pipeline run', type: 'metric', owner: rhea.name, team: full0.teams.find((t) => t.id === team)!.name, unit: 'USD', start: '0.42', state: 'proposed' }] }, snapshot: scopeToCycle(full0, cycle), cycle, week, actor: full0.people.find((p) => p.id === 'rhea')!, now: today.toISOString(), newId, via: 'spreadsheet', full: full0 });
    expect(out.issues.filter((i) => i.level === 'must').map((i) => i.message)).toEqual([]);
    const made = applyCommit(full0, out.commit!).goals.find((g) => g.title === 'Cost per pipeline run') as MetricGoal;
    expect(targetNotSet(made)).toBe(true);
  });
});

describe('the rows (migration 0050)', () => {
  it('an unset target is written as null and reads back unset; a set one as before', () => {
    const { goal } = propose(draft());
    const row = goalToRows('ws', goal).goal;
    expect(row).toMatchObject({ plan_start: 0.42, plan_target: null });
    const back = goalFromRows(row, []) as MetricGoal;
    expect([targetNotSet(back), back.plan.start, targetText(back)]).toEqual([true, 0.42, TARGET_NOT_SET]);
    const ci = full0.goals.find((g) => g.id === 'ci-cost') as MetricGoal;
    expect(targetNotSet(goalFromRows(goalToRows('ws', ci).goal, []))).toBe(false);
  });
});
