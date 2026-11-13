/* The number source's contract (F9: moved here from src/ports/contracts/parts.ts with the port): any source a metric
   names must pass it. */
import { describe, expect, it } from 'vitest';
import type { NumberSource, Slice, SourcedMetric } from './source';

/** `metric` is one the source reads; `before` a moment before its first reading. `slices`, when the source reads slices:
    two it reads (they may give different numbers) and one it doesn't (MT4 5.1, NR). */
export function numberSourceContract(name: string, make: () => Promise<{ source: NumberSource; metric: SourcedMetric; before: Date; after: Date; slices?: { read: [Slice, Slice]; unread: Slice } }>) {
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

    it('gives the same reading when asked twice for the same moment, never one measured after it, and only finite numbers', async () => {
      const { source, metric, after } = await make();
      const a = await source.read(metric, after);
      const b = await source.read(metric, after);
      expect(b).toEqual(a);
      for (const days of [0, 3, 10, 30]) {
        const at = new Date(after.getTime() - days * 86_400_000);
        const r = await source.read(metric, at);
        if (r) { expect(Date.parse(r.at)).toBeLessThanOrEqual(at.getTime()); expect(Number.isFinite(r.value)).toBe(true); }
      }
    });

    it('reads a slice it reads for that slice’s own number, and nothing for a slice it doesn’t', async () => {
      const { source, metric, after, slices } = await make();
      if (!slices) return;
      for (const sl of slices.read) {
        expect(source.reads(metric, sl)).toBe(true);
        const r = await source.read(metric, after, sl);
        if (r) expect(Number.isFinite(r.value)).toBe(true);
      }
      expect(source.reads(metric, slices.unread)).toBe(false);
      expect(await source.read(metric, after, slices.unread)).toBeNull();
    });
  });
}
