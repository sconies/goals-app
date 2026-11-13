/* A reading in a check-in (NR rule 1, docs/design/round-4/readings/spec.md; replaces MT4's rule 7): which state the
   number step is in, from what the metric's source said, what the goal's latest check-in recorded, and what the owner
   typed. The step's block (NR2) draws each state; nothing here posts anything. The record itself (rule 2) is the core's
   `CheckIn.reading`, which no rule that judges a goal reads. */
import { sameAtPlaces } from '../../domain/reading';
import { RULES } from '../../domain/thresholds';
import type { CheckIn, CheckInReading } from '../../domain/types';
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

/** Whether `a` and `b` are one number at the metric's decimals (12 and 12.0 are; 12 and 14 aren't): the core's, so the
    engine's rule 3 and this rule compare one way. */
export const sameAt = sameAtPlaces;

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

/* ---------- rule 4: where a reading shows on the metric's page (NR3, spec 2.4) ---------- */

/** Whether a goal's check-in is filled in from a source: a source reads the metric for the goal's slice; one reads the
    metric but not this slice (a company-wide number is never a team's); or no source reads it. `lastAt` is when the
    goal's latest recorded reading was measured, null when none has been recorded yet. */
export type FillsIn = { kind: 'filled'; source: string; lastAt: string | null } | { kind: 'no-slice'; source: string } | { kind: 'none' };

/** Rule 4a: how a goal's check-in gets its number, from the sources that are registered, without asking any of them. */
export function fillsIn(sources: readonly NumberSource[], metric: SourcedMetric, slice: Slice, checkIns: readonly Pick<CheckIn, 'reading' | 'removedAt'>[]): FillsIn {
  const forSlice = sources.find((s) => s.reads(metric, slice));
  if (forSlice) {
    const read = checkIns.filter((c) => !c.removedAt && c.reading?.source === forSlice.name).map((c) => c.reading!.at).sort();
    return { kind: 'filled', source: forSlice.name, lastAt: read.at(-1) ?? null };
  }
  const any = sources.find((s) => s.reads(metric));
  return any ? { kind: 'no-slice', source: any.name } : { kind: 'none' };
}

/** Rule 4a's words, in the table's "In its check-in" column. `when` says a time as the check-in does ("9:02 today"). */
export function fillsInWords(f: FillsIn, when: (at: string) => string): string {
  if (f.kind === 'filled') return `Filled in from ${f.source}${f.lastAt ? ` · last read ${when(f.lastAt)}` : ''}`;
  if (f.kind === 'no-slice') return `Typed by hand: ${f.source} has no number per team`;
  return 'Typed by hand: no source can be read';
}

/** How many weeks back rule 4b counts. */
export const READING_WEEKS = 8;

/** Rule 4b for one source: of the check-ins filled in from it (`n`), how many used a different number (`k`), and which
    goals and weeks those were, newest first. Goals and weeks, never people. */
export interface DifferentNumbers { source: string; n: number; k: number; weeks: { goalId: string; week: number }[] }

/**
 * Rule 4b: across a metric's goals (`decimals` by goal id), the check-ins of the last READING_WEEKS weeks up to `week`
 * that recorded a reading, by source; a check-in "used a different number" when its own number isn't the source's at the
 * goal's decimals. Removed check-ins don't count. A source no check-in was filled in from isn't listed.
 */
export function differentNumbers(checkIns: readonly Pick<CheckIn, 'goalId' | 'week' | 'value' | 'reading' | 'removedAt'>[], decimals: ReadonlyMap<string, number>, week: number): DifferentNumbers[] {
  const by = new Map<string, DifferentNumbers>();
  for (const c of checkIns) {
    const d = decimals.get(c.goalId);
    if (d == null || c.removedAt || !c.reading || c.value == null || c.week > week || c.week <= week - READING_WEEKS) continue;
    const row = by.get(c.reading.source) ?? { source: c.reading.source, n: 0, k: 0, weeks: [] };
    row.n++;
    if (!sameAt(c.value, c.reading.value, d)) { row.k++; row.weeks.push({ goalId: c.goalId, week: c.week }); }
    by.set(row.source, row);
  }
  for (const r of by.values()) r.weeks.sort((a, b) => b.week - a.week || a.goalId.localeCompare(b.goalId));
  return [...by.values()].sort((a, b) => a.source.localeCompare(b.source));
}

/** Rule 4b's line under the table. */
export const differentWords = (d: Pick<DifferentNumbers, 'source' | 'n' | 'k'>): string =>
  `In the last ${READING_WEEKS} weeks, ${d.k} of ${d.n} ${d.n === 1 ? 'check-in' : 'check-ins'} filled in from ${d.source} used a different number.`;
