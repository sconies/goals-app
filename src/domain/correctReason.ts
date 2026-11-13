/* A correction's reason (review of #225, lows): its own module, so the first download (src/app/actions.ts, which imports
   checkin.ts) doesn't carry it; only the check-in form and the change engine, both loaded when needed, ask. */
import { MIN_CORRECT_REASON } from './checkin';

/** A correction's reason, at most this long: a sentence or two, never a pasted document (review of #225, lows). */
export const MAX_CORRECT_REASON = 500;
/** Whether a correction's reason says something: long enough, not too long, and words, not ten full stops. */
export const correctReasonOk = (text: string): boolean => {
  const t = text.trim();
  return t.length >= MIN_CORRECT_REASON && t.length <= MAX_CORRECT_REASON && (t.match(/\p{L}/gu) ?? []).length >= 3;
};
/** What a correction's reason needs, in a sentence (the form and the engine say the same). */
export const correctReasonAsk = (week: number) => `Say why, in a sentence of at least ${MIN_CORRECT_REASON} characters (at most ${MAX_CORRECT_REASON}), so anyone reading week ${week} later knows.`;
