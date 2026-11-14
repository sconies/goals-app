/* A check-in's reading in words (NR, docs/design/round-4/readings/spec.md 2.2 and 2.3): why an owner's number differs
   from what the metric's source said, when the source measured it ("9:02 today"), and the check-in's read-back line.
   The record itself is the core's `CheckIn.reading` (rule 2); which goals have a source, and what it says, is the metric
   module's. Rule 3, what a reading needs before it is recorded, is `readingProblem`: the engine (changeset.ts) asks it of
   every door, the form, the table and the AI tools alike. Nothing here judges a goal. */
import { MIN_CORRECT_REASON } from './checkin';
import { MAX_CORRECT_REASON } from './correctReason';
import { RULES } from './thresholds';
import type { CheckInReading, MetricGoal, RangeGoal, ReadingWhyKind } from './types';

export type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;

/** Why the owner's number differs (2.2), in the order they are offered. */
export const READING_WHY: readonly (readonly [ReadingWhyKind, string])[] = [
  ['behind', 'The source is behind: I have a newer number'],
  ['other-count', 'The source counts something else'],
  ['wrong', 'The source is wrong this week'],
  ['else', 'Something else'],
];

/** The words of one reason. */
export const readingWhyLabel = (k: ReadingWhyKind) => READING_WHY.find(([x]) => x === k)?.[1] ?? 'Something else';

/** Whether two numbers are one at the goal's decimals (12 and 12.0 are; 12 and 14 aren't). */
export const sameAtPlaces = (a: number, b: number, decimals: number) => {
  const p = Math.max(0, decimals);
  return Number(a.toFixed(p)) === Number(b.toFixed(p));
};

/**
 * Rule 3: what a reading needs before a check-in records it, the same at every door (the engine asks it of the form, the
 * one table, the AI tools and a file alike). The reading is the source's: a finite number, measured at a time that parses,
 * not more than a day after `now` and not more than RULES.readingMaxDays days before it. The owner's number is always the check-in's; a
 * reading whose number differs from it needs a reason, one of 2.2's four; "Something else" needs at least
 * MIN_CORRECT_REASON characters of the owner's words, and no reason's words may run past MAX_CORRECT_REASON. Null when it
 * can be recorded.
 */
export function readingProblem(r: CheckInReading, value: number | null, decimals: number, now: string | Date): string | null {
  if (typeof r?.source !== 'string' || !r.source.trim()) return 'A reading needs the name of the source that read it, so it can’t be recorded.';
  const source = r.source.trim();
  if (typeof r?.value !== 'number' || !Number.isFinite(r.value)) return `${source}’s number can’t be read, so it can’t be recorded.`;
  const at = typeof r.at === 'string' ? Date.parse(r.at) : NaN;
  const t = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (!Number.isFinite(at)) return `When ${source} measured its number can’t be read, so it can’t be recorded.`;
  // A day's grace: a source's clock, a time zone, or a demo whose today is pinned while its time of day is the clock's
  // (a post at 01:00 against a reading at 09:00 the same day) may put a true reading a few hours ahead.
  if (at > t + 86_400_000) return `${source}’s number is dated after now, so it can’t be recorded.`;
  if (t - at > RULES.readingMaxDays * 86_400_000) return `${source}’s number is more than ${RULES.readingMaxDays} days old, so it can’t be recorded.`;
  if ((r.why?.text ?? '').trim().length > MAX_CORRECT_REASON) return `Say why your number is different in at most ${MAX_CORRECT_REASON} characters.`;
  if (value == null || sameAtPlaces(value, r.value, decimals)) return null;
  if (!r.why || !READING_WHY.some(([k]) => k === r.why!.kind)) return `${r.source} said ${r.value}. Say why your number is different.`;
  if (r.why.kind === 'else' && (r.why.text ?? '').trim().length < MIN_CORRECT_REASON) return `Say more about why your number is different from what ${r.source} said, in at least ${MIN_CORRECT_REASON} characters.`;
  return null;
}

/** What a check-in keeps of a reading: the reason only when the numbers differ, its words trimmed. */
export function keptReading(r: CheckInReading, value: number | null, decimals: number): CheckInReading {
  const differs = value != null && !sameAtPlaces(value, r.value, decimals);
  const why = differs && r.why ? { kind: r.why.kind, ...(r.why.text?.trim() ? { text: r.why.text.trim() } : {}) } : undefined;
  return { source: r.source, value: r.value, at: r.at, ...(why ? { why } : {}) };
}

/* ---------- where a reading's source shows elsewhere (NR3, spec 2.4) ---------- */

export type Read = { value: number | null; reading?: CheckInReading | null };

/** Whether a check-in used its source's number (confirmed it), rather than typing another. False when nothing was read. */
export const readingConfirmed = (c: Read, decimals: number): boolean => !!c.reading && c.value != null && sameAtPlaces(c.value, c.reading.value, decimals);

/** The reason in a sentence: "The source counts something else: “It leaves out…”", or the choice alone, ending in a stop. */
export function readingReason(w: NonNullable<CheckInReading['why']>): string {
  const words = w.text?.trim();
  return words ? `${readingWhyLabel(w.kind)}: “${words}”` : `${readingWhyLabel(w.kind).replace(/\.$/, '')}.`;
}

/** A review's agenda row (2.4): the source a confirmed number came from, said after the number in the quiet ink; null for
    a typed number, which says nothing (answer d). */
export const readingFrom = (c: Read | null | undefined, decimals: number): string | null => (c && readingConfirmed(c, decimals) ? c.reading!.source : null);

/** The Check-ins sheet's columns for a check-in's reading (MT4 3.3, NR 2.4), worked out and never loaded back: Number
    from ("Typed", or the source's name), Source’s number, Measured at (ISO, UTC) and Reason for a different number.
    All empty when nothing was read. */
export function readingCells(c: Read, decimals: number): { from: string | null; value: number | null; at: string | null; reason: string | null } {
  const r = c.reading;
  if (!r) return { from: null, value: null, at: null, reason: null };
  return { from: readingConfirmed(c, decimals) ? r.source : 'Typed', value: r.value, at: new Date(r.at).toISOString(), reason: r.why ? readingReason(r.why) : null };
}
