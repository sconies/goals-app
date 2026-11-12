/* Numbers as people type them and as Faro shows them (backlog N, 8 Nov). One rule for every way in: the check-in, New goal,
   goal edit, the spreadsheet import and the AI tools. A number is never rounded quietly: one typed with more decimal places
   than its goal keeps is refused with the reason, so what is saved is what is shown. */

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

/** A plan's start and target (or a range's limit) worth questioning as typed, or null. Asked, never refused. */
export function setupProblem(unit: string, start: number | null, target: number | null): string | null {
  const nums = [start, target].filter((x): x is number => x != null);
  if (nums.some((x) => x < 0) && usuallyPositive(unit)) return `Below zero${unit.trim() ? ' ' + unit.trim() : ''}. Fine for a change or a balance; otherwise check the sign.`;
  if (start != null && target != null && start !== 0 && target !== 0 && Math.sign(start) === Math.sign(target)) {
    const r = Math.abs(target / start);
    if (r >= FAR_RATIO || r <= 1 / FAR_RATIO) return `The target is ${r >= 1 ? 'over ' + FAR_RATIO + ' times' : 'under a ' + FAR_RATIO + 'th of'} the start (${groupDigits(String(start))} to ${groupDigits(String(target))}). Is that right?`;
  }
  if (nums.some((x) => Math.abs(x) >= 1e9)) return 'That’s a billion or more. Is it right?';
  return null;
}
