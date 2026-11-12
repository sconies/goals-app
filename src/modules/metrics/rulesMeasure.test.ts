// @vitest-environment node
/* "Measured by", found by typing (ML2, docs/design/metrics/spec.md 2.4 and rule 5): rule 5's worked examples, the form's
   problems, and the metric finder's rows, in the Platform Engineering demo as built for 5 Nov 2026. */
import { buildPlatformOrg } from '../../data/platformOrg';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import RECORDS from './records';
import { MODULE } from './rules';
import { libraryReads } from './reads';
import * as M from './rulesMeasure';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle, [{ ...RECORDS, module: MODULE }]);
const r = libraryReads(s, today.toISOString());
const metric = (id: string) => r.metrics.find((m) => m.id === `metric_${id}`)!;
const queue = metric('queue-wait');

describe('rule 5: what a chosen metric sets on a goal form', () => {
  it('a new goal with nothing typed takes the metric’s unit and decimals, said in one line', () => {
    const d = M.measureDefaults(queue, { isNew: true, untouched: true, unit: '%', decimals: 0 });
    expect(d.set).toEqual({ unit: 'min', decimals: 0 });
    expect(d.line).toBe('min, whole numbers, lower is better: from the metric.');
  });
  it('a new goal with its unit typed as hours keeps it, and the form says the units differ', () => {
    expect(M.measureDefaults(queue, { isNew: true, untouched: false, unit: 'hours', decimals: 0 })).toEqual({ set: null, line: null });
    expect(M.measureFormProblems(queue, { kind: 'metric', unit: 'hours', decimals: 0 }).errors).toEqual(['This metric is in min; this goal is in hours.']);
  });
  it('changing a goal sets nothing; more decimals than the metric keeps is a warning, as today', () => {
    expect(M.measureDefaults(queue, { isNew: false, untouched: true, unit: 'min', decimals: 1 })).toEqual({ set: null, line: null });
    const p = M.measureFormProblems(queue, { kind: 'metric', unit: 'min', decimals: 1 });
    expect(p.errors).toEqual([]);
    expect(p.warnings).toEqual(['The goal keeps 1 decimal place and Pipeline queue wait (p90) whole numbers. Check which is meant.']);
  });
  it('a goal with dated stages can’t be measured', () => {
    expect(M.measureFormProblems(queue, { kind: 'milestone', unit: '', decimals: 0 }).errors).toHaveLength(1);
  });
  it('Check says what measures it, and for whom', () => {
    expect(M.measuredBySays(queue, 'CI/CD')).toBe('Measured by Pipeline queue wait (p90), for CI/CD.');
    expect(M.measuredBySays(queue, null)).toBe('Measured by Pipeline queue wait (p90), for the whole company.');
  });
});

describe('the metric finder', () => {
  it('finds by typing, in rule 1’s words, with unit, direction and owner on the second line', () => {
    const a = M.searchMetrics(r, { q: 'queue' });
    // CI pipeline time's meaning says "Queue time included", so it is found too (rule 1 searches the meaning).
    expect(a.rows.map((x) => x.name)).toEqual(['CI pipeline time on main (p90)', 'Pipeline queue wait (p90)']);
    expect(a.rows[1]!.detail).toBe('min · lower is better · Rhea Kapoor');
    expect(a.next).toBeNull();
  });
  it('pages by key', () => {
    const one = M.searchMetrics(r, { q: '', size: 5 });
    expect(one.total).toBe(13);
    const two = M.searchMetrics(r, { q: '', size: 5, after: one.next });
    expect(two.rows[0]!.name).not.toBe(one.rows[0]!.name);
  });
  it('suggests what was chosen lately, then the viewer’s team’s metrics, six at most', () => {
    const rows = M.suggestMetrics(r, [{ kind: 'metric', id: 'metric_ci-time' }], 'cicd');
    expect(rows[0]!.name).toBe('CI pipeline time on main (p90)');
    expect(rows.slice(1, 4).map((x) => x.name)).toEqual(expect.arrayContaining(['Pipeline queue wait (p90)', 'Flaky test rate']));
    expect(rows.length).toBeLessThanOrEqual(6);
  });
  it('words a chosen metric by id, even once removed', () => {
    expect(M.metricRowsByIds(r, ['metric_queue-wait', 'nope']).map((x) => x.name)).toEqual(['Pipeline queue wait (p90)']);
  });
});
