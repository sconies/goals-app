// @vitest-environment node
/* A baseline as a field of its own (BL, domain/baseline): rules 1 to 3, every door that writes it, and the rows. */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit } from '../data/store';
import { goalFromRows, goalToRows } from '../data/rows';
import { loadEngine, loadGoalEntry, perform, type RunContext } from '../app/actions';
import { baselineOf, baselineShown, baselineWords, periodProblem, startsFromProvisional } from './baseline';
import { planChanges } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { nowText } from './format';
import { blankGoal, buildGoal, draftOf, planChanged, type GoalDraft } from './goal';
import { goalMustFix } from './goalEntry';
import { barFigures } from './goalPage';
import { currentWeek } from './plan';
import { assessPosted } from './status';
import type { Goal, MetricGoal } from './types';
import type { Commit } from './commit';

const DAY = (d: string) => new Date(d + 'T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_bl${++n}`;
const full0 = buildPlatformOrg(DAY('2026-11-11'));
const today = DAY('2026-11-11');
const cycle = currentCycle(full0.cycles, today)!;
const week = currentWeek(cycle, today);
const ctx = (who: string, full = full0): RunContext => ({ snapshot: scopeToCycle(full, cycle), cycle, week, actor: full.people.find((p) => p.id === who)!, now: today.toISOString(), newId, allGoals: full.goals, full, workspace: { id: 'ws', name: 'Platform' }, modules: [] });
const ciCost = () => full0.goals.find((g) => g.id === 'ci-cost') as MetricGoal;
beforeAll(async () => { await loadGoalEntry(); await loadEngine(); });
const withBase = (provisional = true): MetricGoal => ({ ...ciCost(), baseline: { value: ciCost().plan.start, period: 'June to September 2026', provisional } });

describe('rule 1: a goal has a baseline of its own when its period is given', () => {
  it('a period makes one from the start; none, or no start, makes none', () => {
    expect(baselineOf(41.5, ' June to September 2026 ', true)).toEqual({ value: 41.5, period: 'June to September 2026', provisional: true });
    expect(baselineOf(41.5, '', true)).toBeNull();
    expect(baselineOf(null, 'Q3', false)).toBeNull();
  });
  it('New goal and Change a goal keep it, follow the start, and drop it when the period is cleared', () => {
    const d: GoalDraft = { ...draftOf(ciCost()), baselinePeriod: 'Q3 2026', baselineProvisional: true };
    const g = buildGoal(d, cycle, { id: 'ci-cost', createdAt: ciCost().createdAt }, ciCost(), false, week) as MetricGoal;
    expect(g.baseline).toEqual({ value: ciCost().plan.start, period: 'Q3 2026', provisional: true });
    // A draft that doesn't say (a sheet row without the column) keeps it, at the new start.
    const { baselinePeriod: _p, baselineProvisional: _f, ...silent } = { ...draftOf(g), start: '3' };
    expect((buildGoal(silent as GoalDraft, cycle, { id: g.id, createdAt: g.createdAt }, g, false, week) as MetricGoal).baseline).toEqual({ value: 3, period: 'Q3 2026', provisional: true });
    expect((buildGoal({ ...draftOf(g), baselinePeriod: '' }, cycle, { id: g.id, createdAt: g.createdAt }, g, false, week) as MetricGoal).baseline).toBeUndefined();
    expect(draftOf(g)).toMatchObject({ baselinePeriod: 'Q3 2026', baselineProvisional: true });
  });
  it('a period over 60 characters is a Must fix at Baseline', () => {
    expect(periodProblem('x'.repeat(60))).toBeNull();
    const fixes = goalMustFix({ ...blankGoal('build', 'tunde', ''), title: 'Cost per run', unit: 'USD', start: '4', target: '2', baselinePeriod: 'x'.repeat(61) }, { week, cycleWeeks: cycle.weeks, existing: null } as never);
    expect(fixes.map((f) => [f.field, f.id])).toContainEqual(['start', 'baseline-period-long']);
  });
});

describe('rule 2: shown as the number until the first check-in', () => {
  it('lists say “(baseline)” and the page says what it is; status is untouched', () => {
    const g = withBase();
    const a = assessPosted(g, cycle, [], week);
    expect(nowText(g, a)).toBe(`${nowText(g, { ...a, actual: g.plan.start } as typeof a)} (baseline)`);
    expect(nowText(ciCost(), a)).toBe('No value yet');
    const s = { ...scopeToCycle(full0, cycle), goals: [g] };
    const bar = barFigures(g, s, cycle, week, false);
    expect(bar).toMatchObject({ nowValue: g.plan.start, baseline: 'Baseline, June to September 2026, provisional' });
    expect(baselineWords({ value: 1, period: 'Q3', provisional: false })).toBe('Baseline, Q3');
  });
  it('from the first check-in on, the check-in’s number is shown', () => {
    expect(baselineShown(withBase(), true)).toBeNull();
    expect(baselineShown(withBase(), false)).not.toBeNull();
  });
});

describe('rule 3: firming up a provisional baseline is not a plan change', () => {
  it('moving only the start of a provisional baseline is not; a firm one, or anything else moving, is', () => {
    const g = withBase(true);
    expect(startsFromProvisional(g)).toBe(true);
    expect(planChanged(g, { ...g, plan: { ...g.plan, start: g.plan.start + 1 } })).toBe(false);
    expect(planChanged(g, { ...g, plan: { ...g.plan, start: g.plan.start + 1, target: g.plan.target + 1 } })).toBe(true);
    const firm = withBase(false);
    expect(planChanged(firm, { ...firm, plan: { ...firm.plan, start: firm.plan.start + 1 } })).toBe(true);
  });
  it('a save after check-ins asks no reason and keeps no earlier plan', () => {
    const started = { ...full0, goals: full0.goals.map((g) => (g.id === 'ci-cost' ? withBase(true) : g)) };
    const out = perform(ctx('rhea', started), 'saveGoal', { draft: { ...draftOf(withBase(true)), start: String(ciCost().plan.start + 1) }, goalId: 'ci-cost' }) as { commit: Commit; goal: Goal };
    const saved = applyCommit(started, out.commit).goals.find((g) => g.id === 'ci-cost') as MetricGoal;
    expect(saved.plan.start).toBe(ciCost().plan.start + 1);
    expect(saved.baseline).toMatchObject({ value: ciCost().plan.start + 1, provisional: true });
    expect(saved.originalPlan).toBeNull();
  });
});

describe('the Goals sheet and the tools', () => {
  const run = (row: Record<string, string>) => planChanges({ tables: { goals: [{ __row: '2', ...row }] }, snapshot: scopeToCycle(full0, cycle), cycle, week, actor: full0.people.find((p) => p.id === 'rhea')!, now: today.toISOString(), newId, via: 'spreadsheet', full: full0 });
  it('Baseline period and Baseline is set it, none removes it, an unknown word is a Must fix', () => {
    const key = ciCost().key!;
    const set = run({ key, 'baseline period': 'June to September 2026', 'baseline is': 'provisional' });
    expect(set.issues.map((i) => `${i.level}: ${i.message}`)).toEqual([]);
    const after = applyCommit(full0, set.commit!).goals.find((g) => g.id === 'ci-cost') as MetricGoal;
    expect(after.baseline).toEqual({ value: ciCost().plan.start, period: 'June to September 2026', provisional: true });
    const firmed = planChanges({ tables: { goals: [{ __row: '2', key, 'baseline is': 'firm' }] }, snapshot: scopeToCycle({ ...full0, goals: full0.goals.map((g) => (g.id === 'ci-cost' ? after : g)) }, cycle), cycle, week, actor: full0.people.find((p) => p.id === 'rhea')!, now: today.toISOString(), newId, via: 'spreadsheet', full: { ...full0, goals: full0.goals.map((g) => (g.id === 'ci-cost' ? after : g)) } });
    expect((applyCommit(full0, firmed.commit!).goals.find((g) => g.id === 'ci-cost') as MetricGoal).baseline).toMatchObject({ period: 'June to September 2026', provisional: false });
    expect(run({ key, 'baseline period': 'Q3', 'baseline is': 'maybe' }).issues.some((i) => i.kind === 'unknown-word')).toBe(true);
  });
});

describe('the rows (migration 0049)', () => {
  it('every goal row carries the three columns, null without a baseline, and reads back', () => {
    const plain = goalToRows('ws', ciCost()).goal;
    expect(plain).toMatchObject({ baseline_value: null, baseline_period: null, baseline_provisional: null });
    const row = goalToRows('ws', withBase()).goal;
    expect(row).toMatchObject({ baseline_value: ciCost().plan.start, baseline_period: 'June to September 2026', baseline_provisional: true });
    expect((goalFromRows(row, []) as MetricGoal).baseline).toEqual(withBase().baseline);
    expect((goalFromRows(plain, []) as MetricGoal).baseline).toBeUndefined();
  });
});
