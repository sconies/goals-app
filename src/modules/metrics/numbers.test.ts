// @vitest-environment node
/* The demo's number source passes the port's contract (src/ports/contracts/parts.ts), as any real source must. */
import { buildExample } from '../../data/examples';
import { numberSourceContract } from '../../ports/contracts/parts';
import { DEMO_SOURCE, demoNumbers } from './numbers';
import { metricsOf } from './rules';

numberSourceContract('the demo’s CI analytics', async () => {
  const s = await buildExample(new Date('2026-11-05T12:00:00Z'));
  const metric = metricsOf(s).find((m) => m.source === DEMO_SOURCE)!;
  return { source: demoNumbers(() => s), metric, before: new Date('2025-01-01T00:00:00Z'), after: new Date('2026-11-05T12:00:00Z') };
});
