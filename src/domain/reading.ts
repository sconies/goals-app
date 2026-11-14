/* A check-in's reading in words (NR, docs/design/round-4/readings/spec.md 2.2 and 2.3): why an owner's number differs
   from what the metric's source said, when the source measured it ("9:02 today"), and the check-in's read-back line.
   The record itself is the core's `CheckIn.reading` (rule 2); which goals have a source, and what it says, is the metric
   module's. Rule 3, what a reading needs before it is recorded, is `readingProblem`: the engine (changeset.ts) asks it of
   every door, the form, the table and the AI tools alike. Nothing here judges a goal. */
import { MIN_CORRECT_REASON } from './checkin';
import { MAX_CORRECT_REASON } from './correctReason';
import { RULES } from './thresholds';
import { fmt } from './format';
import type { CheckInReading, MetricGoal, RangeGoal, ReadingWhyKind } from './types';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;

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

/** A source's number as a check-in's field holds it: at the goal's decimals (20.4567 fills a whole-minutes goal as "20"). */
export const filledAt = (v: number, decimals: number) => String(Number(v.toFixed(Math.max(0, decimals))));

/**
 * Rule 3: what a reading needs before a check-in records it, the same at every door (the engine asks it of the form, the
 * one table, the AI tools and a file alike). The reading is the source's: a finite number, measured at a time that parses,
 * not more than a day after `now` and not more than RULES.readingMaxDays days before it. The owner's number is always the check-in's; a
 * reading whose number differs from it needs a reason, one of 2.2's four; "Something else" needs at least
 * MIN_CORRECT_REASON characters of the owner's words, and no reason's words may run past MAX_CORRECT_REASON. Null when it
 * can be recorded.
 */
export function readingProblem(r: CheckInReading, value: number | null, decimals: number, now: string | Date): string | null {
  const source = typeof r?.source === 'string' && r.source.trim() ? r.source.trim() : 'The source';
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

const parts = (d: Date, timeZone?: string) => {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, time: `${Number(o.hour)}:${o.minute}`, long: `${o.weekday} ${o.day} ${o.month}` };
};

/**
 * When a source measured a number, in the viewer's zone (2.1): "9:02 today", "16:40 yesterday", otherwise
 * "9:00 on Thu 5 Nov". `today` is the app's today; `timeZone` is left out for the viewer's own.
 */
export function readWhen(at: string, today: Date, timeZone?: string): string {
  const a = parts(new Date(at), timeZone);
  if (a.day === parts(today, timeZone).day) return `${a.time} today`;
  if (a.day === parts(new Date(today.getTime() - 86_400_000), timeZone).day) return `${a.time} yesterday`;
  return `${a.time} on ${a.long}`;
}

/** The reason in the read-back: the owner's words for "Something else", otherwise the choice, in lower case. */
const reasonWords = (w: NonNullable<CheckInReading['why']>) => {
  const t = w.kind === 'else' && w.text?.trim() ? w.text.trim() : readingWhyLabel(w.kind);
  return t.charAt(0).toLowerCase() + t.slice(1);
};

/**
 * The check-in's read-back line (2.3): "12 min, from CI analytics, read 9:02 today. Confirmed by you." or
 * "14 min, typed. CI analytics said 12 min: the source is behind: I have a newer number." Null when nothing was read.
 */
export function readingLine(c: { value: number | null; reading?: CheckInReading | null }, g: Numeric, today: Date, timeZone?: string): string | null {
  const r = c.reading;
  if (!r || c.value == null) return null;
  if (sameAtPlaces(c.value, r.value, g.decimals)) return `${fmt(r.value, g)}, from ${r.source}, read ${readWhen(r.at, today, timeZone)}. Confirmed by you.`;
  return `${fmt(c.value, g)}, typed. ${r.source} said ${fmt(r.value, g)}${r.why ? `: ${reasonWords(r.why).replace(/\.$/, '')}` : ''}.`;
}

/* ---------- where a reading's source shows elsewhere (NR3, spec 2.4) ---------- */

type Read = { value: number | null; reading?: CheckInReading | null };

/** Whether a check-in used its source's number (confirmed it), rather than typing another. False when nothing was read. */
export const readingConfirmed = (c: Read, decimals: number): boolean => !!c.reading && c.value != null && sameAtPlaces(c.value, c.reading.value, decimals);

/** The reason in a sentence: "The source counts something else: “It leaves out…”", or the choice alone, ending in a stop. */
export function readingReason(w: NonNullable<CheckInReading['why']>): string {
  const words = w.text?.trim();
  return words ? `${readingWhyLabel(w.kind)}: “${words}”` : `${readingWhyLabel(w.kind).replace(/\.$/, '')}.`;
}

/**
 * A goal's "This week’s number" under Measured by (2.4): what its latest check-in recorded. "12 min, from CI analytics,
 * read 9:02 today. Confirmed by Rhea Kapoor." or "14 min, typed by Rhea Kapoor. CI analytics said 12 min." Null when
 * that check-in recorded no reading: Faro keeps no series of readings.
 */
export function readingThisWeek(c: Read | null | undefined, g: Numeric, name: string, today: Date, timeZone?: string): string | null {
  const r = c?.reading;
  if (!c || !r || c.value == null) return null;
  if (readingConfirmed(c, g.decimals)) return `${fmt(r.value, g)}, from ${r.source}, read ${readWhen(r.at, today, timeZone)}. Confirmed by ${name}.`;
  return `${fmt(c.value, g)}, typed by ${name}. ${r.source} said ${fmt(r.value, g)}.`;
}

/**
 * A History row's second line for a check-in (2.4, MT4 5.3 with the reason): "From CI analytics, read 9:02 on Thu 12 Nov.
 * Rhea Kapoor checked in." or "Typed by Rhea Kapoor. CI analytics said 13 min. The source counts something else: “…”".
 * A check-in with no reading says "Typed by {name}." only beside one that has (`nearSourced`); otherwise null.
 */
export function readingHistoryLine(c: Read, g: Numeric, name: string, today: Date, opts: { nearSourced?: boolean; timeZone?: string } = {}): string | null {
  const r = c.reading;
  if (!r || c.value == null) return opts.nearSourced && c.value != null ? `Typed by ${name}.` : null;
  if (readingConfirmed(c, g.decimals)) return `From ${r.source}, read ${readWhen(r.at, today, opts.timeZone)}. ${name} checked in.`;
  return `Typed by ${name}. ${r.source} said ${fmt(r.value, g)}.${r.why ? ` ${readingReason(r.why)}` : ''}`;
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
