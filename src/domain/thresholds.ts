/* The numbers the rules turn on, as the spec states them. Kept apart from the rules themselves so the vocabulary
   (domain/vocabulary.ts) can say them in its meanings without importing the rules that use its words. */

/** Status thresholds. */
export const RULES = {
  onTrack: 0.95,
  atRisk: 0.8,
  wellAhead: 1.2,
  staleDays: 14,
  /** A milestone stage more than this many weeks late is off track. */
  lateWeeksOff: 2,
} as const;

/** How many check-ins the trend looks back over: the latest and the two before it. */
export const TREND_SPAN = 3;

/** How long a removed record is listed under Recently removed, in days. The row itself stays for good. */
export const RESTORE_DAYS = 30;
/** How long a removal's Undo stays on screen, in milliseconds. */
export const UNDO_MS = 10_000;
/** A stopped goal's reason is at least a short sentence. */
export const MIN_STOP_REASON = 10;

/** The shortest name a workspace or a goal can have, in characters (setup review, 8 Nov): one rule for both. */
export const MIN_NAME = 3;
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
/** What's wrong with a workspace's or a goal's name, or null: empty, or shorter than MIN_NAME. */
export function nameProblem(name: string, thing: 'workspace' | 'goal' | 'outcome'): string | null {
  const t = name.trim();
  if (!t) return `Give the ${thing} a name.`;
  if (t.length < MIN_NAME) return `Give the ${thing} a name of at least ${NUMBER_WORDS[MIN_NAME] ?? MIN_NAME} characters.`;
  return null;
}
