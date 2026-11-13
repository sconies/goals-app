// @vitest-environment node
/* The metric library's rules (src/modules/metrics/rules.ts): what a metric needs, who may add, change, remove, link and unlink, what the
   change log says, and that removing and unlinking come back with Undo or from Recently removed. Worked examples use the
   Platform Engineering demo, whose library has 13 metrics, 12 of them measuring a goal. */
import { buildPlatformOrg } from '../../data/platformOrg';
import { applyCommit, type Commit } from '../../data/store';
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { currentCycle, scopeToCycle as scope } from '../../domain/cycle';
import { currentWeek } from '../../domain/plan';
import * as R from '../../domain/removal';
import type { Goal, Snapshot } from '../../domain/types';
import * as M from './rules';
import { linkGoalMetric } from './rulesLink';
import RECORDS from './records';

/** This module's records, as the registry gives them to the core. */
const MINE = [{ ...RECORDS, module: M.MODULE }];
const scopeToCycle = (s: Snapshot, c: Parameters<typeof scope>[1]) => scope(s, c, MINE);

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_m${++n}`;

function world() {
  let full: Snapshot = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const week = currentWeek(cycle, today);
  let clock = Date.parse('2026-11-05T13:00:00Z');
  const x = (who: string): ActionContext => ({ snapshot: scopeToCycle(full, cycle), cycle, week, actor: full.people.find((p) => p.id === who)!, now: new Date(clock += 60_000).toISOString(), newId, allGoals: full.goals, full });
  return {
    x,
    get full() { return full; },
    get scoped() { return scopeToCycle(full, cycle); },
    goal: (id: string) => full.goals.find((g) => g.id === id)!,
    apply(c: Commit | null) { if (c) full = applyCommit(full, c); return c; },
  };
}
const refused = (f: () => unknown, msg: RegExp) => { expect(f).toThrow(NotAllowed); expect(f).toThrow(msg); };

describe('the demo’s library', () => {
  const w = world();
  it('has 13 metrics, 12 of them measuring a goal, and every link passes the rules', () => {
    expect(M.liveMetrics(w.scoped)).toHaveLength(13);
    expect(M.linksOf(w.scoped)).toHaveLength(12);
    for (const l of M.linksOf(w.scoped)) {
      const g = w.goal(l.goalId);
      const m = M.findMetric(w.scoped, l.metricId)!;
      expect(M.linkProblems(g, m)).toEqual({ errors: [], warnings: [] });
    }
  });
  it('says what a goal is measured by, for which slice, with the goal’s own target', () => {
    // Lead time: a north star, the whole company's number, target 24 hours (its plan's target).
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))).toMatchObject({ metric: { name: 'Lead time for changes', unit: 'hours' }, slice: M.COMPANY, target: { value: 24, kind: 'target' } });
    // Flaky tests: CI/CD's slice of a range goal, at most 2%.
    expect(M.measureOf(w.scoped, w.goal('lead-flaky'))).toMatchObject({ metric: { name: 'Flaky test rate' }, slice: 'CI/CD', target: { value: 2, kind: 'at most' }, targetText: 'At most 2.0%' });
    // A goal with no metric.
    expect(M.measureOf(w.scoped, w.goal('lead-mq'))).toBeNull();
    // What the core's goal entry reads of it, for the wrong-side question at every door (domain/records goalMeasureOf).
    expect(RECORDS.measures!(w.scoped, 'ns-lead')).toEqual({ name: 'Lead time for changes', direction: 'lower' });
    expect(RECORDS.measures!(w.scoped, 'lead-mq')).toBeNull();
  });
  it('one metric can sit in the library measuring nothing yet', () => {
    expect(M.goalsMeasuredBy(w.scoped, w.scoped.goals, 'metric_ci-cost')).toEqual([]);
    expect(M.goalsMeasuredBy(w.scoped, w.scoped.goals, 'metric_flaky-rate').map((g) => g.id)).toEqual(['lead-flaky']);
  });
});

describe('what a metric needs', () => {
  const w = world();
  const x = w.x('oskar');
  const base: M.MetricInput = { name: 'Build time', unit: 'min', direction: 'lower' };
  it('a name, a unit and a direction; everything else is optional', () => {
    const m = M.metricFrom(base, null, x);
    expect(M.metricProblems(m, x.snapshot)).toEqual([]);
    expect(m).toMatchObject({ meaning: '', decimals: 0, source: '', sourceOwner: '', refresh: null, ownerId: 'oskar', caveats: '' });
    expect(M.metricProblems(M.metricFrom({}, null, x), x.snapshot)).toEqual(['Give the metric a name.', 'Say its unit: %, min, hours, USD, deploys…', 'Say which way is better: higher or lower.']);
  });
  it('a name no other metric here has, any case', () => {
    expect(M.metricProblems(M.metricFrom({ ...base, name: 'flaky TEST rate' }, null, x), x.snapshot)).toEqual(['There’s already a metric called Flaky test rate. Use it, or give this one a different name.']);
  });
  it('decimals 0 to 4, a known refresh, an owner in the workspace, text in bounds', () => {
    const bad = M.metricFrom({ ...base, decimals: 5, refresh: 'yearly' as never, ownerId: 'nobody', caveats: 'x'.repeat(2001) }, null, x);
    expect(M.metricProblems(bad, x.snapshot)).toEqual([
      'Decimals is a whole number from 0 to 4.', 'Refresh is one of live, hourly, daily, weekly, monthly, quarterly, or left empty.',
      'The metric’s owner isn’t in this workspace.', 'Keep the caveats to 2,000 characters or fewer.',
    ]);
  });
  it('trims what it keeps', () => {
    expect(M.metricFrom({ ...base, name: '  Build   time ', unit: ' min ' }, null, x)).toMatchObject({ name: 'Build time', unit: 'min' });
  });
});

describe('adding and changing a metric', () => {
  it('anyone adds one, owns it, and it’s logged field by field', () => {
    const w = world();
    const { commit, metric } = M.saveMetric(w.x('oskar'), { name: 'Build time', unit: 'min', direction: 'lower', source: 'CI analytics' });
    expect(metric.ownerId).toBe('oskar');
    expect(commit!.changes[0]).toMatchObject({ entity: 'metric', entityId: metric.id, action: 'created', summary: 'Added the metric “Build time”', goalId: null });
    expect(commit!.changes[0]!.diffs.map((d) => d.field)).toEqual(['Name', 'Unit', 'Decimals', 'Direction', 'Source', 'Owner']);
    w.apply(commit);
    expect(M.findMetric(w.scoped, 'build time')!.id).toBe(metric.id);
  });
  it('its owner or an admin changes it; anyone else is told who can', () => {
    const w = world();
    refused(() => M.saveMetric(w.x('oskar'), { id: 'metric_flaky-rate', caveats: 'New' }), /Only Rhea Kapoor or an admin can change this metric/);
    const own = M.saveMetric(w.x('rhea'), { id: 'metric_flaky-rate', decimals: 2 });
    expect(own.commit!.changes[0]).toMatchObject({ action: 'edited', summary: 'Changed the metric “Flaky test rate”', diffs: [{ field: 'Decimals', from: '1', to: '2' }] });
    const admin = M.saveMetric(w.x('grace'), { id: 'metric_flaky-rate', name: 'Flaky test rate (main)' });
    expect(admin.commit!.changes[0]!.summary).toBe('Renamed the metric “Flaky test rate” to “Flaky test rate (main)”');
  });
  it('the owner can hand it on; saving it unchanged saves nothing', () => {
    const w = world();
    const out = M.saveMetric(w.x('rhea'), { id: 'metric_flaky-rate', ownerId: 'sana' });
    expect(out.commit!.changes[0]!.diffs).toEqual([{ field: 'Owner', from: 'Rhea Kapoor', to: expect.any(String) }]);
    expect(M.saveMetric(w.x('rhea'), { id: 'metric_flaky-rate', unit: '%' }).commit).toBeNull();
  });
});

describe('linking a goal to a metric', () => {
  it('the goal’s owner or an admin, for the company or a team', () => {
    const w = world();
    const g = w.goal('lead-quarantine');
    refused(() => linkGoalMetric(w.x('oskar'), g, 'metric_cache-hit'), /Only the goal’s owner or an admin/);
    const c = linkGoalMetric(w.x(g.ownerId), g, 'metric_cache-hit', 'cicd')!;
    expect(M.linksOf(c)[0]).toMatchObject({ id: g.id, goalId: g.id, metricId: 'metric_cache-hit', teamId: 'cicd' });
    expect(c.changes[0]).toMatchObject({ entity: 'metric', goalId: g.id, action: 'linked', summary: 'Measured by “Remote build cache hit rate” for CI/CD', diffs: [{ field: 'Measured by', from: '—', to: 'Remote build cache hit rate' }, { field: 'Slice', from: '—', to: 'CI/CD' }] });
  });
  it('the same metric and slice again changes nothing; another slice is a logged edit', () => {
    const w = world();
    const g = w.goal('ns-lead');
    expect(linkGoalMetric(w.x('rhea'), g, 'metric_lead-time', null)).toBeNull();
    refused(() => linkGoalMetric(w.x('rhea'), g, 'metric_lead-time', 'cicd'), /Say why this goal is measured differently now/);
    const c = linkGoalMetric(w.x('rhea'), g, 'metric_lead-time', 'cicd', '', 'CI/CD owns the number now')!;
    expect(c.changes[0]).toMatchObject({ action: 'edited', summary: 'Measured by “Lead time for changes” for CI/CD: CI/CD owns the number now', diffs: [{ field: 'Slice', from: M.COMPANY, to: 'CI/CD' }] });
  });
  it('refuses a milestone goal, a different unit, a team that isn’t here and a removed metric', () => {
    const w = world();
    const milestone = w.goal('lead-mq');
    refused(() => linkGoalMetric(w.x('grace'), milestone, 'metric_lead-time'), /dated stages has no number/);
    refused(() => linkGoalMetric(w.x('grace'), w.goal('ns-ci'), 'metric_lead-time'), /The goal is in min and the metric is in hours/);
    refused(() => linkGoalMetric(w.x('grace'), w.goal('ns-lead'), 'metric_lead-time', 'nope'), /no team with that ID/);
    w.apply(M.removeMetric(w.x('grace'), 'metric_ci-cost'));
    refused(() => linkGoalMetric(w.x('grace'), w.goal('ns-cost'), 'metric_ci-cost'), /no metric with that ID/);
  });
  it('warns, without refusing, when the goal aims the other way from the metric', () => {
    const up = { ...w0().goal('lead-cache') } as Goal;
    expect(M.linkProblems(up, { ...M.findMetric(w0().scoped, 'metric_flaky-rate')!, unit: '%' })).toEqual({ errors: [], warnings: ['The goal aims up, but for Flaky test rate lower is better. Check it’s meant.'] });
  });
  it('warns when the goal keeps more decimal places than the metric (one number, two precisions)', () => {
    const w = world();
    const g = { ...w.goal('ns-lead'), decimals: 1 } as Goal;
    expect(M.linkProblems(g, M.findMetric(w.scoped, 'metric_lead-time')!).warnings).toEqual(['The goal keeps 1 decimal place and Lead time for changes whole numbers. Check which is meant.']);
  });
  it('unlinking keeps the row, logs it, and Undo puts it back', () => {
    const w = world();
    const before = w.full;
    const c = M.unlinkGoalMetric(w.x('rhea'), w.goal('ns-lead'))!;
    expect(c.changes[0]).toMatchObject({ action: 'removed', goalId: 'ns-lead', summary: 'No longer measured by “Lead time for changes”' });
    w.apply(c);
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))).toBeNull();
    expect(M.unlinkGoalMetric(w.x('rhea'), w.goal('ns-lead'))).toBeNull();
    w.apply(R.undoRemoval(w.x('rhea'), c, before));
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))!.metric.id).toBe('metric_lead-time');
  });
});

describe('removing a metric', () => {
  it('its owner or an admin; it unlinks its goals, and Undo brings both back', () => {
    const w = world();
    refused(() => M.removeMetric(w.x('oskar'), 'metric_lead-time'), /Only Rhea Kapoor or an admin can remove/);
    const before = w.full;
    const c = M.removeMetric(w.x('rhea'), 'metric_lead-time');
    expect(c.changes.map((v) => v.summary)).toEqual(['Removed the metric “Lead time for changes”, unlinking 1 goal', 'No longer measured by “Lead time for changes”, as the metric was removed']);
    w.apply(c);
    expect(M.findMetric(w.scoped, 'metric_lead-time')).toBeUndefined();
    expect(M.metricsOf(w.full).find((m) => m.id === 'metric_lead-time')!.removedAt).toBeTruthy();
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))).toBeNull();
    w.apply(R.undoRemoval(w.x('rhea'), c, before));
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))!.metric.name).toBe('Lead time for changes');
  });
  it('is on Recently removed, and restoring brings the metric back with the links it had (spec 2.2)', () => {
    const w = world();
    w.apply(M.removeMetric(w.x('rhea'), 'metric_lead-time'));
    const item = R.recentlyRemoved(w.full, today, undefined, MINE).find((r) => r.kind === 'metric')!;
    expect(item).toMatchObject({ id: 'metric_lead-time', label: 'Metric', name: 'Lead time for changes', by: 'rhea' });
    w.apply(R.restoreRemoved(w.x('rhea'), 'metric', item.id, MINE));
    expect(M.findMetric(w.scoped, 'metric_lead-time')).toBeTruthy();
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))!.metric.name).toBe('Lead time for changes');
  });
  it('restoring leaves out a link whose goal was measured by another metric since', () => {
    const w = world();
    w.apply(M.removeMetric(w.x('rhea'), 'metric_lead-time'));
    w.apply(M.saveMetric(w.x('grace'), { name: 'Lead time, merge to production', unit: 'hours', direction: 'lower' }).commit);
    const other = M.metricsOf(w.full).find((m) => m.name === 'Lead time, merge to production')!;
    w.apply(linkGoalMetric(w.x('grace'), w.goal('ns-lead'), other.id, null));
    const item = R.recentlyRemoved(w.full, today, undefined, MINE).find((r) => r.kind === 'metric')!;
    w.apply(R.restoreRemoved(w.x('rhea'), 'metric', item.id, MINE));
    expect(M.measureOf(w.scoped, w.goal('ns-lead'))!.metric.name).toBe('Lead time, merge to production');
  });
  it('can’t come back under a name another metric took since', () => {
    const w = world();
    w.apply(M.removeMetric(w.x('rhea'), 'metric_lead-time'));
    w.apply(M.saveMetric(w.x('oskar'), { name: 'Lead time for changes', unit: 'hours', direction: 'lower' }).commit);
    refused(() => R.restoreRemoved(w.x('grace'), 'metric', 'metric_lead-time', MINE), /There’s a metric called Lead time for changes again/);
  });
});

describe('one form, one save', () => {
  it('mergeCommits puts a goal’s save and its link together, in order', () => {
    const a: Commit = { goals: [], changes: [{ id: 'c1' } as never] };
    const b: Commit = { ...M.metricRows({ metricLinks: [{ id: 'g' } as never] }), changes: [{ id: 'c2' } as never] };
    expect(M.mergeCommits(a, null, b)).toEqual({ goals: [], modules: { metrics: { metricLinks: [{ id: 'g' }] } }, changes: [{ id: 'c1' }, { id: 'c2' }] });
    expect(M.mergeCommits(null, undefined)).toBeNull();
  });
});

describe('the build review’s findings on ML2 and ML3 (11 Nov)', () => {
  it('a goal being made for someone else can be measured in the same save, by whoever makes it', () => {
    const w = world();
    const x = w.x('rhea');
    const g = { ...w.goal('ns-lead'), id: 'goal_new', key: undefined, ownerId: 'oskar' } as Goal;
    refused(() => linkGoalMetric(x, { ...w.goal('ns-lead'), ownerId: 'oskar' } as Goal, 'metric_lead-time'), /Only the goal’s owner or an admin/);
    const c = linkGoalMetric({ ...x, snapshot: { ...x.snapshot, goals: [...x.snapshot.goals, g] } }, g, 'metric_lead-time', null);
    expect(c!.changes[0]!.summary).toBe('Measured by “Lead time for changes” for the whole company');
  });
  it('changing a unit goals use is asked at every door: refused without confirm, saved with it', () => {
    const w = world();
    const m = M.metricsOf(w.full).find((v) => v.id === 'metric_lead-time')!;
    const q = M.metricChangeQuestion(m, { ...m, unit: 'days' }, w.full.goals, M.linksOf(w.full));
    expect(q).toMatchObject({ changing: ['unit'], goals: 1, apart: 1 });
    expect(q!.text).toBe('1 goal is measured by this metric. Changing its unit doesn’t change their numbers or plans; 1 of them will show a warning that they differ. Change it?');
    refused(() => M.saveMetric(w.x('rhea'), { id: m.id, unit: 'days' }), /Ask first, then save it again with confirm/);
    expect(M.saveMetric(w.x('rhea'), { id: m.id, unit: 'days', confirm: true }).commit).not.toBeNull();
    // Other fields, or a metric no goal uses, ask nothing.
    expect(M.metricChangeQuestion(m, { ...m, caveats: 'x' }, w.full.goals, M.linksOf(w.full))).toBeNull();
  });
  it('removing a metric unlinks a stopped goal too, and putting it back links it again', () => {
    const w = world();
    w.apply(R.stopGoal(w.x('rhea'), 'ns-lead', 'Folded into the delivery north star for the rest of the year.'));
    expect(w.goal('ns-lead').stoppedAt).toBeTruthy();
    w.apply(M.removeMetric(w.x('rhea'), 'metric_lead-time'));
    expect(M.linksOf(w.full).find((l) => l.goalId === 'ns-lead')!.removedAt).toBeTruthy();
    w.apply(R.restoreRemoved(w.x('rhea'), 'metric', 'metric_lead-time', MINE));
    expect(M.linksOf(w.full).find((l) => l.goalId === 'ns-lead')!.removedAt).toBeNull();
  });
});

function w0() { return world(); }
