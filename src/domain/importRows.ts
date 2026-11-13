/* How many rows an import wrote (rule 9), apart from domain/removal so the first download doesn't carry it: only
   Imported reads it. */
import type { Change } from './types';

/** The rows an import wrote, counted as Undo counts what it puts back: Imported's "Saved {n} rows" and the Undo sheet's
    "{n} rows go back" say one number (IM4 review). */
export function importRows(entry: Change): number {
  const u = entry.undo;
  if (!u) return 0;
  return u.goals.length + u.checkIns.length + u.people.length + u.requests.length + (u.reviews ?? []).filter((r) => r.before).length + (u.teams ?? []).length;
}
