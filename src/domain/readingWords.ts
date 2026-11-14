/* A check-in's reading in words, for the screens that show one (NR, docs/design/round-4/readings/spec.md 2.1 to 2.4):
   when a source measured it, the check-in's read-back, a goal's "This week's number" and a History row's line. Apart
   from reading.ts, whose rule the engine loads with the first download: only screens opened later need these. */
import { fmt } from './format';
import { readingConfirmed, readingReason, readingWhyLabel, sameAtPlaces, type Numeric, type Read } from './reading';
import type { CheckInReading } from './types';

/** A source's number as a check-in's field holds it: at the goal's decimals (20.4567 fills a whole-minutes goal as "20"). */
export const filledAt = (v: number, decimals: number) => String(Number(v.toFixed(Math.max(0, decimals))));

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

