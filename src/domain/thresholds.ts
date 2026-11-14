/* The numbers the rules turn on, as the spec states them. Kept apart from the rules themselves so the vocabulary
   (domain/vocabulary.ts) can say them in its meanings without importing the rules that use its words. */
import type { Cycle } from './types';

/** Status thresholds. */
export const RULES = {
  onTrack: 0.95,
  atRisk: 0.8,
  wellAhead: 1.2,
  /** Missed check-ins before a goal has no recent update: two check-ins' time, counted in the cycle's rhythm (staleAfterDays). */
  staleCheckIns: 2,
  /** @deprecated staleAfterDays(cycle) for a weekly cycle (14 days); kept until the vocabulary and the spec pages say the helper. */
  staleDays: 14,
  /** A milestone stage more than this many weeks late is off track. */
  lateWeeksOff: 2,
  /** The wrap-up opens this many weeks before a cycle's last day (its last two weeks). */
  wrapUpWeeksBefore: 2,
  /** …and stays open this many weeks after it, for the last numbers and the owners' words. */
  wrapUpWeeksAfter: 4,
  /** A metric's reading older than this many days is never filled into a check-in (NR rule 1; Lane, 13 Nov). */
  readingMaxDays: 7,
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
/** The longest name a workspace can have, in characters: said under the field while typing, never cut silently (backlog WS). */
export const MAX_WORKSPACE_NAME = 80;
/** What's wrong with a workspace's or a goal's name, or null: empty, shorter than MIN_NAME, or (a workspace) longer than MAX_WORKSPACE_NAME. */
export function nameProblem(name: string, thing: 'workspace' | 'goal' | 'outcome'): string | null {
  const t = name.trim().replace(/\s+/g, ' ');
  if (!t) return `Give the ${thing} a name.`;
  if (t.length < MIN_NAME) return `Give the ${thing} a name of at least ${NUMBER_WORDS[MIN_NAME] ?? MIN_NAME} characters.`;
  if (thing === 'workspace' && t.length > MAX_WORKSPACE_NAME) return `Keep the name to ${MAX_WORKSPACE_NAME} characters or fewer: it has ${t.length}.`;
  return null;
}

/** What a workspace name's field says while it's typed: how many characters of the limit it uses, once it's near (null before). */
export function nameLength(name: string): string | null {
  const n = name.trim().replace(/\s+/g, ' ').length;
  return n >= MAX_WORKSPACE_NAME - 20 ? `${n} of ${MAX_WORKSPACE_NAME} characters` : null;
}

/** A cycle's check-in rhythm (FT1): every `weeks` weeks, due by `dueDay` (0 = Monday), counted from `from` (yyyy-mm-dd).
    Null when there is no set rhythm. */
export type Rhythm = { weeks: number; dueDay: number; from: string } | null;

/** The cycle's rhythm, or null with no set rhythm (`checkInWeeks` 0). Every week from the cycle's start when unset. */
export function rhythmOf(cycle: Pick<Cycle, 'checkInWeeks' | 'reviewDay' | 'rhythmFrom' | 'startDate'>): Rhythm {
  const weeks = cycle.checkInWeeks ?? 1;
  if (weeks === 0) return null;
  const from = cycle.rhythmFrom && cycle.rhythmFrom > cycle.startDate ? cycle.rhythmFrom : cycle.startDate;
  return { weeks, dueDay: cycle.reviewDay, from };
}

/** Days without a check-in before a goal has no recent update: RULES.staleCheckIns × 7 × the cycle's check-in weeks
    (14 every week). Null with no set rhythm: then nothing goes quiet. */
export function staleAfterDays(cycle: Pick<Cycle, 'checkInWeeks' | 'reviewDay' | 'rhythmFrom' | 'startDate'>): number | null {
  const r = rhythmOf(cycle);
  return r ? RULES.staleCheckIns * 7 * r.weeks : null;
}
