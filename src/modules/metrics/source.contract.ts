/* The number source's contract (F9: moved here from src/ports/contracts/parts.ts with the port): any source a metric
   names must pass it. */
import { describe, expect, it } from 'vitest';
import type { NumberSource, SourcedMetric } from './source';

/** `metric` is one the source reads; `before` a moment before its first reading. */
export function numberSourceContract(name: string, make: () => Promise<{ source: NumberSource; metric: SourcedMetric; before: Date; after: Date }>) {
  describe(`the number source contract: ${name}`, () => {
    it('reads its own metrics: a number measured at or before the moment asked, and none before its first', async () => {
      const { source, metric, before, after } = await make();
      expect(source.reads(metric)).toBe(true);
      const r = await source.read(metric, after);
      expect(r).not.toBeNull();
      expect(Number.isFinite(r!.value)).toBe(true);
      expect(Date.parse(r!.at)).toBeLessThanOrEqual(after.getTime());
      expect(await source.read(metric, before)).toBeNull();
    });

    it('doesn’t read a metric from somewhere else', async () => {
      const { source, metric, after } = await make();
      const other = { ...metric, id: 'm_elsewhere', source: 'Somewhere else' };
      expect(source.reads(other)).toBe(false);
      expect(await source.read(other, after)).toBeNull();
    });
  });
}
