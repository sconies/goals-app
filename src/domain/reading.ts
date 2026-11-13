/* A check-in's reading in words (NR, docs/design/round-4/readings/spec.md 2.2 and 2.3): why an owner's number differs
   from what the metric's source said, when the source measured it ("9:02 today"), and the check-in's read-back line.
   The record itself is the core's `CheckIn.reading` (rule 2); which goals have a source, and what it says, is the metric
   module's. Rule 3, what a reading needs before it is recorded, is `readingProblem`: the engine (changeset.ts) asks it of
   every door, the form, the table and the AI tools alike. Nothing here judges a goal. */
import { MIN_CORRECT_REASON } from './checkin';
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

/**
 * Rule 3: what a reading needs before a check-in records it, the same at every door. The owner's number is always the
 * check-in's; a reading whose number differs from it needs a reason (one of 2.2's four), and "Something else" needs at
 * least MIN_CORRECT_REASON characters of the owner's words. Null when it can be recorded.
 */
export function readingProblem(r: CheckInReading, value: number | null, decimals: number): string | null {
  if (value == null || sameAtPlaces(value, r.value, decimals)) return null;
  if (!r.why || !READING_WHY.some(([k]) => k === r.why!.kind)) return `${r.source} said ${r.value}. Say why your number is different.`;
  if (r.why.kind === 'else' && (r.why.text ?? '').trim().length < MIN_CORRECT_REASON) return `Say more about why your number is different from ${r.source}’s, in at least ${MIN_CORRECT_REASON} characters.`;
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
