// @vitest-environment node
/* Looking after metrics (ML3, docs/design/metrics/spec.md rule 4 and 2.8): every worked example of a close name, and
   what Workspace → About counts. */
import { buildPlatformOrg } from '../../data/platformOrg';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import RECORDS from './records';
import { MODULE } from './rules';
import { libraryReads } from './reads';
import { closeNames, closeNameWords, ownerlessMetrics } from './rulesLibrary';
import type { Metric } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle, [{ ...RECORDS, module: MODULE }]);
const r = libraryReads(s, today.toISOString());
const one = (name: string): Metric => ({ ...r.metrics[0]!, id: `x_${name}`, name, removedAt: null });

describe('rule 4: a close name', () => {
  const cases: [string, string, boolean][] = [
    ['CI cost per pipeline run', 'CI compute cost per pipeline run', true],
    ['Queue wait', 'Pipeline queue wait (p90)', true],
    ['Lead time', 'Lead time for changes', true],
    ['Deploys per day', 'Production deploys per day', true],
    ['Change failure rate', 'Flaky test rate', false],
    ['Build time', 'Base image build time', true],
    ['MTTR', 'Mean time to restore (P1 and P2)', false],
  ];
  for (const [typed, existing, close] of cases) {
    it(`“${typed}” beside “${existing}”: ${close ? 'close' : 'not close'}`, () => {
      expect(closeNames(typed, [one(existing)]).map((m) => m.name)).toEqual(close ? [existing] : []);
    });
  }
  it('names two at most, closest first, never the same name or one removed', () => {
    const got = closeNames('Build time', [one('Base image build time'), one('Build time p50'), one('Docker build time'), one('build TIME'), { ...one('Build'), removedAt: '2026-11-01' }]);
    expect(got).toHaveLength(2);
    expect(got[0]!.name).toBe('Build time p50');
  });
  it('in the demo, “CI cost per pipeline run” asks about CI compute cost per pipeline run, in words', () => {
    const got = closeNames('CI cost per pipeline run', r.metrics);
    expect(got[0]!.name).toBe('CI compute cost per pipeline run');
    expect(closeNameWords(got[0]!, r.people)).toMatch(/^“CI compute cost per pipeline run” \(USD, lower is better, owned by .+\)$/);
  });
});

describe('2.8: metrics with no owner', () => {
  it('none in the demo; one when its owner is marked as left', () => {
    expect(ownerlessMetrics(r)).toEqual([]);
    const people = r.people.map((p) => (p.id === 'rhea' ? { ...p, leftAt: '2026-11-04' } : p));
    expect(ownerlessMetrics({ ...r, people }).map((m) => m.ownerId)).toEqual(r.metrics.filter((m) => m.ownerId === 'rhea').map(() => 'rhea'));
  });
});
