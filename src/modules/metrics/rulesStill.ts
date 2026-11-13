/* Rule 1's line (docs/design/metrics-2/spec.md): what a metric still needs to say, in words, never a score. Apart from
   the rest of rule 1 (rulesDefine.ts, which re-exports it) so the workbook's Metrics sheet (sheet.ts) writes its Still to
   say column without the questions' code on the first download. Pure. */
import type { Metric } from './types';

/** The four things that make a metric fully defined beyond its name, unit and direction, in the order they are said. */
export const STILL_TO_SAY = [
  ['what it means', 'meaning'],
  ['where the number comes from', 'source'],
  ['who owns that source', 'sourceOwner'],
  ['how often it refreshes', 'refresh'],
] as const;
export type StillItem = (typeof STILL_TO_SAY)[number][0];
/** The form field each missing item opens (`/metrics/<id>/edit?field=…`). */
export const STILL_FIELD: Record<StillItem, string> = Object.fromEntries(STILL_TO_SAY) as Record<StillItem, string>;
export const FULLY_DEFINED = 'Fully defined';
export const OWNER_LEFT = 'Its owner has left.';

export interface StillToSay { usable: true; full: boolean; missing: StillItem[]; ownerLeft: boolean; line: string }

/**
 * Rule 1. What a metric still needs to say. A metric with a name, a unit and a direction is usable; `missing` lists, in
 * order, what it means (meaning empty), where the number comes from (source empty), who owns that source (empty) and how
 * often it refreshes (not said). The line is “Fully defined” when nothing is missing and its owner is here; “Its owner
 * has left.” alone when only that; otherwise “Still to say: {missing, commas}.”, with “ Its owner has left.” after it.
 */
export function stillToSay(m: Pick<Metric, 'meaning' | 'source' | 'sourceOwner' | 'refresh'>, ownerIsHere: boolean): StillToSay {
  const empty = (k: (typeof STILL_TO_SAY)[number][1]) => (k === 'refresh' ? m.refresh == null : !(m[k] ?? '').trim());
  const missing = STILL_TO_SAY.filter(([, k]) => empty(k)).map(([w]) => w);
  const left = !ownerIsHere;
  const said = missing.length ? `Still to say: ${missing.join(', ')}.` : '';
  const line = !missing.length && !left ? FULLY_DEFINED : [said, left ? OWNER_LEFT : ''].filter(Boolean).join(' ');
  return { usable: true, full: !missing.length && !left, missing, ownerLeft: left, line };
}
