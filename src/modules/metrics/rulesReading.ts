/* A reading in a check-in (NR rule 1, docs/design/round-4/readings/spec.md; replaces MT4's rule 7): which state the
   number step is in, from what the metric's source said, what the goal's latest check-in recorded, and what the owner
   typed. The step's block (NR2) draws each state; nothing here posts anything. The record itself (rule 2) is the core's
   `CheckIn.reading`, which no rule that judges a goal reads. */
import { RULES } from '../../domain/thresholds';
import type { CheckInReading } from '../../domain/types';
import type { NumberSource, Reading, Slice, SourcedMetric } from './source';

export type ReadingState = 'no-slice' | 'unreachable' | 'missing' | 'old' | 'same' | 'jump' | 'changed' | 'fresh';

/** What asking a metric's sources gave: a reading (or none yet), a source that reads the metric but not this slice, or
    one that couldn't be reached. `source` is the source's name; null when no source reads the metric at all. */
export type Asked = { source: string; reading: Reading | null } | { source: string; reading: 'no-slice' | 'unreachable' } | { source: null; reading: null };

/** Ask the source that reads `metric` for the link's slice, once (the step opens). A source that reads the metric but not
    this slice is `no-slice`, and is never asked for another slice's number: a company-wide number is never a team's. */
export async function askSource(sources: readonly NumberSource[], metric: SourcedMetric, slice: Slice, now: Date): Promise<Asked> {
  const forSlice = sources.find((s) => s.reads(metric, slice));
  if (!forSlice) {
    const any = sources.find((s) => s.reads(metric));
    return any ? { source: any.name, reading: 'no-slice' } : { source: null, reading: null };
  }
  try {
    return { source: forSlice.name, reading: await forSlice.read(metric, now, slice) };
  } catch {
    return { source: forSlice.name, reading: 'unreachable' };
  }
}

const atDecimals = (v: number, decimals: number) => Number(v.toFixed(Math.max(0, decimals)));

/** Whether `a` and `b` are one number at the metric's decimals (12 and 12.0 are; 12 and 14 aren't). */
export const sameAt = (a: number, b: number, decimals: number) => atDecimals(a, decimals) === atDecimals(b, decimals);

/** Whether a reading is ten times or a tenth of the last number, by size (MT4's Check, kept by NR). */
export function isJump(value: number, lastValue: number | null): boolean {
  if (lastValue == null) return false;
  if (lastValue === 0) return Math.abs(value) >= 10;
  const r = Math.abs(value) / Math.abs(lastValue);
  return r >= 10 || r <= 0.1;
}

/**
 * Rule 1: the first state that applies. `reading` is what asking gave (`Asked.reading`); `lastReading` what the goal's
 * latest check-in recorded (or null); `lastValue` that check-in's number; `typed` the owner's number in the field, if
 * they typed one; `decimals` the metric's. `old` comes before `same`, so a reading recorded last week and now ten days old
 * reads as too old, not as "no new reading".
 */
export function readingState(reading: Reading | null | 'no-slice' | 'unreachable', lastReading: Pick<CheckInReading, 'at'> | null, lastValue: number | null, now: Date, typed: number | null, decimals: number): ReadingState {
  if (reading === 'no-slice') return 'no-slice';
  if (reading === 'unreachable') return 'unreachable';
  if (reading == null) return 'missing';
  if (now.getTime() - Date.parse(reading.at) > RULES.readingMaxDays * 86_400_000) return 'old';
  if (lastReading && Date.parse(reading.at) <= Date.parse(lastReading.at)) return 'same';
  if (isJump(reading.value, lastValue)) return 'jump';
  if (typed != null && !sameAt(typed, reading.value, decimals)) return 'changed';
  return 'fresh';
}

/** MT4's `revised`: asked again for the moment the last check-in's reading was measured, the source now gives another
    number at the metric's decimals. The later answer is the true one. */
export function readingRevised(lastReading: Pick<CheckInReading, 'value'> | null, again: Reading | null, decimals: number): boolean {
  return !!lastReading && !!again && !sameAt(lastReading.value, again.value, decimals);
}

/** What a check-in records (rule 2): the source, its value and when it measured it, and the reason only when the owner's
    number differs. Null when nothing was read. */
export function recordReading(source: string | null, reading: Reading | null, value: number | null, decimals: number, why?: CheckInReading['why']): CheckInReading | null {
  if (!source || !reading) return null;
  const differs = value != null && !sameAt(value, reading.value, decimals);
  return { source, value: reading.value, at: reading.at, ...(differs && why ? { why } : {}) };
}
