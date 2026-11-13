// @vitest-environment node
/* The demo's number sources pass the module's source contract (./source.contract.ts), as any real source must, and give
   the seeded series NR's spec describes (section 5). */
import { describe, expect, it } from 'vitest';
import { buildExample } from '../../data/examples';
import { numberSourceContract } from './source.contract';
import { DEMO_RUNNER_SOURCE, DEMO_SOURCE, demoSources } from './numbers';
import { metricsOf } from './rules';
import type { Cycle } from '../../domain/types';

const AT = new Date('2026-11-05T12:00:00Z');
const example = async () => {
  const s = await buildExample(AT);
  return { s, cycle: { id: 'c', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 } as Cycle };
};

numberSourceContract('the demo’s CI analytics', async () => {
  const { s, cycle } = await example();
  const metric = metricsOf(s).find((m) => m.source === DEMO_SOURCE)!;
  return { source: demoSources(s, cycle).find((x) => x.name === DEMO_SOURCE)!, metric, before: new Date('2025-01-01T00:00:00Z'), after: AT, slices: { read: [{ teamId: null, part: '' }, { teamId: null, part: '' }], unread: { teamId: 'devex', part: '' } } };
});

numberSourceContract('the demo’s CI runner metrics', async () => {
  const { s, cycle } = await example();
  const metric = metricsOf(s).find((m) => m.source === DEMO_RUNNER_SOURCE)!;
  return { source: demoSources(s, cycle).find((x) => x.name === DEMO_RUNNER_SOURCE)!, metric, before: new Date('2025-01-01T00:00:00Z'), after: AT, slices: { read: [{ teamId: 'cicd', part: 'Main branch pipelines' }, { teamId: 'build', part: 'release pipelines' }], unread: { teamId: null, part: '' } } };
});

describe('the demo’s seeded series (NR section 5)', () => {
  it('reads CI pipeline time for the whole company only, measured at 09:00 on the review day', async () => {
    const { s, cycle } = await example();
    const [ci] = demoSources(s, cycle);
    const m = metricsOf(s).find((x) => x.id === 'metric_ci-time')!;
    expect(ci!.reads(m, { teamId: 'devex', part: '' })).toBe(false);
    const r = await ci!.read(m, AT, { teamId: null, part: '' });
    expect(r!.at).toBe('2026-11-05T09:00:00.000Z');
  });
  it('doesn’t change when a check-in is posted later: its numbers are the seeded example’s', async () => {
    const { s, cycle } = await example();
    const src = demoSources(s, cycle)[0]!;
    const m = metricsOf(s).find((x) => x.id === 'metric_ci-time')!;
    const before = await src.read(m, new Date('2026-11-20T12:00:00Z'));
    s.checkIns.push({ ...s.checkIns.find((c) => c.goalId === 'ns-ci')!, id: 'later', week: 47, value: 999, postedAt: '2026-11-19T10:00:00Z' });
    expect(await src.read(m, new Date('2026-11-20T12:00:00Z'))).toEqual(before);
  });
  it('gives two slices of queue wait different numbers, one with no reading in the last week, and a series two weeks behind', async () => {
    const { s, cycle } = await example();
    const runner = demoSources(s, cycle)[1]!;
    const m = metricsOf(s).find((x) => x.id === 'metric_queue-wait')!;
    const later = new Date('2026-11-13T12:00:00Z');
    const main = await runner.read(m, later, { teamId: 'cicd', part: 'main branch pipelines' });
    const rel = await runner.read(m, later, { teamId: 'build', part: 'release pipelines' });
    expect(main!.at).toBe('2026-11-12T09:00:00.000Z');
    expect(rel!.at).toBe('2026-11-05T09:00:00.000Z');
    expect(rel!.value).not.toBe(main!.value);
    const behind = demoSources(s, cycle, { behindWeeks: 2 })[1]!;
    expect((await behind.read(m, later, { teamId: 'cicd', part: 'main branch pipelines' }))!.at).toBe('2026-10-29T09:00:00.000Z');
  });
});
