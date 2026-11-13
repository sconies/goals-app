/* What a windowed load (AX5 part 2b, Snapshot.history) left out, for the rules that must not guess about it: removal,
   Undo and recarry (domain/recarry, domain/copies). Pure. */
import { cycleDates } from './cycle';
import type { Snapshot } from './types';

/** What a windowed load left out (Snapshot.history), for a rule that takes only its own rows. */
export type LoadHistory = NonNullable<Pick<Snapshot, 'history'>['history']>;

/** Whether a windowed load (Snapshot.history) left a cycle's check-ins out: it has some, and it ended before the window. */
export function checkInsLeftOut(s: Pick<Snapshot, 'cycles' | 'history'>, cycleId: string): boolean {
  const h = s.history;
  if (!h || !h.checkInCycles.includes(cycleId)) return false;
  const c = s.cycles.find((v) => v.id === cycleId);
  return !c || cycleDates(c).lastDay < h.from.slice(0, 10);
}
/** Whether a windowed load left change-log entries from before this time out (anchors stay whatever their age). */
export const changesLeftOut = (s: Pick<Snapshot, 'history'>, at: string) => !!s.history && Date.parse(at) < Date.parse(s.history.from);
