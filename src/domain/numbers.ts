/* Numbers as people type them and as Faro shows them (backlog N, 8 Nov). One rule for every way in: the check-in, New goal,
   goal edit, the spreadsheet import and the AI tools. A number is never rounded quietly: one typed with more decimal places
   than its goal keeps is refused with the reason, so what is saved is what is shown. */

/**
 * A number as people type it: "29.4", "29,4" (a decimal comma), "1,250" (thousands), "62%", "29.4 days".
 * Anything else (hex, exponents, words) is not a number. Where the goal's unit is known, `numberAsTyped` also says
 * whether the words after the number are its unit.
 */
export function parseNumber(s: string): number | null {
  return readDigits(splitTyped(s).digits);
}

/** A typed value as its digits and the words after them: "12 days" is "12" and "days"; "62%" is "62" and "%". */
function splitTyped(s: string): { digits: string; words: string } {
  const t = s.trim();
  const m = /\s*(%|[a-z]+(\s[a-z]+)*)$/i.exec(t);
  return m ? { digits: t.slice(0, m.index), words: m[0].trim() } : { digits: t, words: '' };
}

/** The digits of a typed number: a decimal comma, grouping commas and spaces read; anything else is not a number. */
function readDigits(raw: string): number | null {
  let t = raw.replace(/\s/g, '');
  if (!t) return null;
  if (/^[-+]?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) < 1e12 ? n : null;
}

/** A unit as it is compared: lower case, one space, and the usual short and plural forms the same ("mins" is "min"). */
const UNIT_SAME: Record<string, string> = { minute: 'min', minutes: 'min', mins: 'min', min: 'min', day: 'day', days: 'day', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour', h: 'hour' };
export function unitKey(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  return UNIT_SAME[u] ?? u.replace(/s$/, '');
}

/**
 * Rule 12 (goal entry, section 3's table). A number typed into a goal with `unit`: the number; or `has-words` when the
 * words after it aren't the goal's unit ("12 days" in a % goal, "12%" in a days goal, any words with no unit); or
 * `not-number`. "12%" in a % goal and "12 days" in a days goal are the number.
 */
export function numberAsTyped(raw: string, unit: string): { n: number } | { problem: 'has-words' | 'not-number'; n?: number } {
  const { digits, words } = splitTyped(raw);
  const n = readDigits(digits);
  if (n == null) return { problem: 'not-number' };
  if (!words) return { n };
  if (unit.trim() && unitKey(words) === unitKey(unit)) return { n };
  return { problem: 'has-words', n };
}

/** How many decimal places a typed number has: "12.5" 1, "1,250" 0, "29,4" (a decimal comma) 1. */
export function typedDecimals(raw: string): number {
  let t = raw.trim().replace(/\s*(%|[a-z]+(\s[a-z]+)*)$/i, '').replace(/\s/g, '');
  if (/^[-+]?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  const frac = /\.(\d*)$/.exec(t)?.[1] ?? '';
  return frac.replace(/0+$/, '').length;
}

const PLACES = ['whole numbers', '1 decimal place', '2 decimal places', '3 decimal places'];
/** "whole numbers", "1 decimal place", "2 decimal places". */
export const placesText = (d: number) => PLACES[d] ?? `${d} decimal places`;

/**
 * Why a typed number can't be kept as typed in a goal with `decimals` places, or null. Faro shows every number at its goal's
 * decimals, so 12.5 in a whole-number goal would read 13 everywhere: it is refused, with the two ways forward.
 */
export function precisionProblem(raw: string, n: number | null, decimals: number): string | null {
  if (n == null || !Number.isInteger(decimals) || decimals < 0) return null;
  const has = typedDecimals(raw);
  if (has <= decimals) return null;
  const shown = groupDigits(n.toFixed(decimals));
  return `${raw.trim()} has ${placesText(has)}, but this goal keeps ${placesText(decimals)}, so it would show as ${shown}. Type ${shown}, or set the goal’s Decimals to ${Math.min(3, has)}.`;
}

/**
 * The decimal places a refused number needs, so the place it's refused can offer to keep them for its goal in one step
 * ("Keep 1 decimal place for this goal": deep review U3, where the first check-in dead-ended on a setting set-up never
 * showed). Null when the number is fine as it is. At most 3, the most a goal keeps.
 */
export function placesToKeep(raw: string, n: number | null, decimals: number): number | null {
  return precisionProblem(raw, n, decimals) ? Math.min(3, typedDecimals(raw)) : null;
}

/** An example number at a goal's decimal places: "29" for whole numbers, "29.4" for one place (the default with no goal). */
export const exampleNumber = (decimals = 1) => (decimals > 0 ? '29.' + '4567'.slice(0, Math.min(decimals, 3)) : '29');

/** The one message for letters (or anything else) where a number should be: the same on every screen, sheet and tool. Its
    example is at the goal's decimal places, so a whole-number goal isn't shown a decimal (deep review U10). */
export const notNumberText = (raw: string, decimals?: number) => `“${raw.trim()}” isn’t a number. Type digits only, like ${exampleNumber(decimals)}.`;

/** Digits in groups of three, as every number on screen is shown: "1250.5" → "1,250.5", "-12000" → "-12,000". */
export function groupDigits(s: string): string {
  return s.replace(/^([-+]?)(\d{4,})/, (_, sign: string, int: string) => sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}

/** A number as an export writes it at a goal's decimal places: 0.405 at 2 is 0.41. */
export const asWritten = (v: number, decimals: number) => Number(v.toFixed(decimals));

/**
 * Whether a typed cell says what the export wrote (import spec rule 9, IM0): the same text after trimming, or the same
 * number at the column's written precision. An unedited export is never read as a change, however a plan's numbers
 * fall between two decimal places: 0.405 at 2 places was written 0.41, and 0.41 typed back is no change.
 */
export function sameAsWritten(cell: string | number, written: number | null | undefined, decimals: number): boolean {
  if (written == null) return false;
  // An empty cell says nothing, never a 0 (Number('') is 0): beside a written number it is a change.
  if (String(cell).trim() === '') return false;
  if (String(cell).trim() === String(asWritten(written, decimals))) return true;
  const n = typeof cell === 'number' ? cell : Number(String(cell).trim().replace(/,/g, ''));
  return Number.isFinite(n) && asWritten(n, decimals) === asWritten(written, decimals);
}

/** A number at a fixed number of decimal places, its digits grouped: the form every rendered number takes. */
export const fixed = (v: number, decimals: number) => groupDigits(v.toFixed(decimals));

/** Units whose numbers are usually zero or more: a percentage, a time, money. */
export const usuallyPositive = (unit: string) => unit.trim() === '%' || /day|hour|min|week|usd|gbp|eur|\$|£|€/i.test(unit);

/** How far outside a plan's own range a number can sit before it is questioned: this many times the plan's width. */
export const FAR_OUTSIDE = 2;
/** A set-up number this many times the other end of the plan (or more) is questioned. */
export const FAR_RATIO = 100;

/**
 * A check worth making on a number far outside its plan, or null. Never refused: real numbers can be odd (backlog N).
 * `lo` and `hi` are the plan's two ends.
 */
export function farOutside(n: number, lo: number, hi: number): boolean {
  const width = Math.abs(hi - lo);
  if (!width) return false;
  return n < Math.min(lo, hi) - FAR_OUTSIDE * width || n > Math.max(lo, hi) + FAR_OUTSIDE * width;
}

