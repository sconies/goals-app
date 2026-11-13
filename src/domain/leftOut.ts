/* What a windowed load (AX5 part 2b, Snapshot.history) left out, for the rules that must not guess about it: removal,
   Undo and recarry (domain/recarry, domain/copies). Pure. */
import { cycleDates } from './cycle';
import type { Cycle, Snapshot } from './types';

/** What a windowed load left out (Snapshot.history), for a rule that takes only its own rows. */
export type LoadHistory = NonNullable<Pick<Snapshot, 'history'>['history']>;

/** How many of the newest cycles a window always keeps, whatever their age: the year on screen, and the one in its
    wrap-up. So a year nobody follows with a next one never falls out of the window while it is still the one in use. */
export const NEWEST_KEPT = 2;

/**
 * The cycles whose check-ins a windowed load keeps (AX5 part 2b; ports/window.ts and every store use this rule): each
 * whose last day (domain/cycle cycleDates) is on or after the window's first day (yyyy-mm-dd, UTC), and the
 * NEWEST_KEPT newest cycles not removed, by start date, however old.
 */
export function keptCycles(cycles: Pick<Cycle, 'id' | 'startDate' | 'weeks' | 'removedAt'>[], fromDay: string): Set<string> {
  const newest = cycles.filter((c) => !c.removedAt).sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0)).slice(0, NEWEST_KEPT);
  return new Set([...cycles.filter((c) => cycleDates(c).lastDay >= fromDay), ...newest].map((c) => c.id));
}

/** Whether a windowed load (Snapshot.history) left a cycle's check-ins out: it has some, and the window didn't keep it. */
export function checkInsLeftOut(s: Pick<Snapshot, 'cycles' | 'history'>, cycleId: string): boolean {
  const h = s.history;
  if (!h || !h.checkInCycles.includes(cycleId)) return false;
  return !keptCycles(s.cycles, h.from.slice(0, 10)).has(cycleId);
}
/** Whether a windowed load left change-log entries from before this time out (anchors stay whatever their age). */
export const changesLeftOut = (s: Pick<Snapshot, 'history'>, at: string) => !!s.history && Date.parse(at) < Date.parse(s.history.from);
