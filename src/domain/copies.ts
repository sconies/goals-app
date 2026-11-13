/* Whether a carried copy has been used (cycle-end rule 6): the two tests the start, its Undo and the wrap-up need at
   once, apart from recarry itself (domain/recarry), which loads only when a workspace has a next year. Pure. */
import { changesLeftOut, type LoadHistory } from './leftOut';
import type { Change, CheckIn, Goal } from './types';

/** A change recarry made on its own (not a person's), so it doesn't count as using the copy. */
export const byRecarry = (summary: string) => /now starts from where it ended in |now starts from .*’s final number$|carries on into |, so it left /.test(summary);

/** Whether a carried copy is as the start made it: no check-in in it and no change to it by a person since. A copy made
    before a windowed load's start counts as used: a person's change to it may be among the entries left out. */
export function copyUntouched(copy: Goal, full: { checkIns: Pick<CheckIn, 'goalId' | 'removedAt'>[]; changes: Pick<Change, 'goalId' | 'at' | 'summary'>[]; history?: LoadHistory }): boolean {
  if (changesLeftOut(full, copy.createdAt)) return false;
  if (full.checkIns.some((c) => c.goalId === copy.id && !c.removedAt)) return false;
  return !full.changes.some((c) => c.goalId === copy.id && c.at > copy.createdAt && !byRecarry(c.summary));
}
