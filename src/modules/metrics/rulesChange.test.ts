// @vitest-environment node
/* MT3 (docs/design/metrics-2/spec.md, rules 3 to 5): what kind of change a save is, the marks a change of meaning or
   direction leaves on its goals, and retiring, bringing back and merging. The worked examples are the spec's, on the
   Platform Engineering demo. */
import { buildPlatformOrg } from '../../data/platformOrg';
import { applyCommit, type Commit } from '../../data/store';
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { currentCycle, scopeToCycle as scope } from '../../domain/cycle';
import { currentWeek } from '../../domain/plan';
import type { Snapshot } from '../../domain/types';
import * as M from './rules';
import { linkGoalMetric } from './rulesLink';
import * as C from './rulesChange';
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

const lead = (w: ReturnType<typeof world>) => M.metricsOf(w.full).find((m) => m.id === 'metric_lead-time')!;

describe('rule 3: what kind of change', () => {
  const g = (decimals = 0, aimsUp: boolean | null = false): C.LinkedGoal => ({ id: 'g', title: 'G', unit: 'hours', decimals, aimsUp, ownerId: 'p' });
  it('follows the spec’s table', () => {
    const w = world();
    const m = lead(w);
    expect(C.changeKinds(m, m, [g()])).toEqual(['none']);
    expect(C.changeKinds(m, { ...m, caveats: 'x' }, [g(), g(), g()])).toEqual(['words']);
    expect(C.changeKinds(m, { ...m, name: 'Lead time' }, [g()])).toEqual(['words']);
    expect(C.changeKinds(m, { ...m, meaning: 'Other' }, [])).toEqual(['words']);
    expect(C.changeKinds(m, { ...m, meaning: 'Other' }, [g()])).toEqual(['meaning']);
    expect(C.changeKinds(m, { ...m, unit: 'hrs' }, [g()], { relabel: true })).toEqual(['relabel']);
    expect(C.changeKinds(m, { ...m, unit: 'min' }, [g()])).toEqual(['scale']);
    expect(C.changeKinds(m, { ...m, direction: 'higher' }, [g(), g(), g(0, true), g(0, true)])).toEqual(['direction']);
    expect(C.aimingWrong([g(), g(), g(0, true), g(0, true)], 'higher')).toHaveLength(2);
    expect(C.changeKinds({ ...m, decimals: 1 }, { ...m, decimals: 0 }, [g(1)])).toEqual(['decimals']);
  });
  it('a change of meaning asks whether it is the same number, and a reason when it isn’t; it marks the goal (rule 4)', () => {
    const w = world();
    refused(() => C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', meaning: 'Merge to production, p50.' }), /Say whether it is still the same number/);
    refused(() => C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', meaning: 'Merge to production, p50.', comparable: false }), /Say why, in a line/);
    const same = C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', meaning: 'Merge to production, p50.', comparable: true });
    expect(same.metric.marks ?? []).toEqual([]);
    const c = C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', meaning: 'Merge to production, p50.', comparable: false, reason: 'The DORA dashboard counts from merge now.' });
    w.apply(c.commit);
    const m = lead(w);
    expect(m.marks).toMatchObject([{ kind: 'definition', why: 'The DORA dashboard counts from merge now.', now: 'Merge to production, p50.' }]);
    const link = M.linksOf(w.full).find((l) => l.goalId === 'ns-lead')!;
    expect(C.marksFor(m, link).map(C.markLabel)).toEqual([`Definition changed, week ${m.marks![0]!.week}`]);
    expect(c.commit!.changes.find((v) => v.goalId === 'ns-lead')!.summary).toMatch(/^Definition changed: what “Lead time for changes” means, from week \d+: The DORA dashboard/);
    // A goal linked after the change was never measured the old way.
    expect(C.marksFor(m, { linkedAt: '2099-01-01T00:00:00Z' })).toEqual([]);
  });
  it('a change of direction needs a reason; a new unit is a label or refused; a relabel changes the goals’ unit too', () => {
    const w = world();
    refused(() => C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', direction: 'higher' }), /Say why the direction changes/);
    refused(() => C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', unit: 'min' }), /A metric in min is a different number/);
    const c = C.saveMetricChange(w.x('rhea'), { id: 'metric_lead-time', unit: 'hrs', relabel: true });
    expect(c.commit!.goals!.map((v) => [v.id, (v as { unit: string }).unit])).toEqual([['ns-lead', 'hrs']]);
    expect(c.commit!.changes[0]!.summary).toBe('Changed the unit of “Lead time for changes” from “hours” to “hrs” on it and its 1 goal');
  });
});

describe('rule 5: retiring, bringing back, merging', () => {
  it('retires a metric with a goal: the link stays, the pickers leave it out, a new goal can’t use it, and it comes back', () => {
    const w = world();
    refused(() => C.retireMetric(w.x('oskar'), 'metric_flaky-rate', 'x'), /Only Rhea Kapoor or an admin/);
    refused(() => C.retireMetric(w.x('rhea'), 'metric_flaky-rate', ' '), /Say why it is retired/);
    refused(() => C.retireMetric(w.x('rhea'), 'metric_flaky-rate', 'Gone', 'metric_lead-time'), /replaced by a metric in the same unit/);
    const c = C.retireMetric(w.x('rhea'), 'metric_flaky-rate', 'The test platform reports it now.');
    expect(c.changes[0]!.summary).toBe('Retired the metric “Flaky test rate”: The test platform reports it now.');
    w.apply(c);
    expect(M.liveMetrics(w.scoped).some((m) => m.id === 'metric_flaky-rate')).toBe(false);
    expect(M.findMetric(w.scoped, 'Flaky test rate')!.id).toBe('metric_flaky-rate');
    const linked = M.linksOf(w.full).find((l) => l.metricId === 'metric_flaky-rate' && !l.removedAt)!;
    expect(M.measureOf(w.scoped, w.goal(linked.goalId))!.retired).toMatchObject({ why: 'The test platform reports it now.' });
    const other = w.full.goals.find((g) => g.kind === 'metric' && g.unit === '%' && !M.linksOf(w.full).some((l) => l.goalId === g.id && !l.removedAt));
    if (other) refused(() => linkGoalMetric(w.x('amara'), other, 'metric_flaky-rate'), /“Flaky test rate” was retired on \d+ \w+\. Choose another, or bring it back\./);
    w.apply(C.unretireMetric(w.x('rhea'), 'metric_flaky-rate'));
    expect(M.liveMetrics(w.scoped).some((m) => m.id === 'metric_flaky-rate')).toBe(true);
  });
  it('a never-used metric is deleted, a used one refused', () => {
    const w = world();
    expect(M.everUsed('metric_ci-cost', M.linksOf(w.full))).toBe(false);
    expect(M.everUsed('metric_lead-time', M.linksOf(w.full))).toBe(true);
    refused(() => M.removeMetric(w.x('rhea'), 'metric_lead-time'), /Retire it instead/);
  });
  it('merges in the same unit, for admins: the goals move and the old one is retired pointing to the new', () => {
    const w = world();
    refused(() => C.mergeMetrics(w.x('rhea'), 'metric_flaky-rate', 'metric_cache-hit'), /Only admins can merge metrics: it changes what other people’s goals are measured by\./);
    refused(() => C.mergeMetrics(w.x('amara'), 'metric_lead-time', 'metric_ci-time'), /Only metrics in the same unit can be merged/);
    const before = M.linksOf(w.full).filter((l) => !l.removedAt && (l.metricId === 'metric_lead-time' || l.metricId === 'metric_first-review')).length;
    w.apply(C.mergeMetrics(w.x('amara'), 'metric_lead-time', 'metric_first-review'));
    expect(M.linksOf(w.full).filter((l) => !l.removedAt && l.metricId === 'metric_first-review')).toHaveLength(before);
    expect(lead(w)).toMatchObject({ replacedBy: 'metric_first-review', retiredWhy: 'The same number as Time to first review.' });
  });
});
