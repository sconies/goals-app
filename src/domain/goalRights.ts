/* Who may add a goal, and who may change one (goal entry, rule 7; R1's access table). Stated once: the form's save
   (goalEntry planGoal), the change engine (changeset planChanges: a Goals row, a bulk edit, the AI tools) and the
   removals all ask these, so every door gives the same answer. Pure. */
import type { Goal, Person } from './types';
import type { Via } from './via';

type Actor = Pick<Person, 'id' | 'admin'>;

/**
 * Whether `actor` may add a goal owned by `ownerId`. Always (Lane, 11 Nov): anyone may add a goal for anyone, at any
 * level, at every door. It exists so the rule is stated in one place, and the doors agree by sharing it.
 */
export function mayAddGoal(_actor: Actor, _ownerId: string): boolean {
  return true;
}

/**
 * Whether `actor` may change a goal (its name, plan, owner, unit or decimals): its owner, or an admin; and, while a goal
 * is proposed (domain/proposed isProposed: proposed, not removed or stopped), whoever proposed it (GE10, rule 14).
 */
export function mayChangeGoal(actor: Actor, goal: Pick<Goal, 'ownerId'> & Partial<Pick<Goal, 'proposedAt' | 'proposedBy' | 'removedAt' | 'stoppedAt'>>): boolean {
  if (!!actor.admin || goal.ownerId === actor.id) return true;
  // isProposed, stated here without importing domain/proposed (which reads this file).
  return !!goal.proposedAt && !goal.removedAt && !goal.stoppedAt && goal.proposedBy === actor.id;
}

/**
 * Whether `actor` may post or correct a check-in on `goal` (Lane, 12 Nov: check-ins are the owner's). Only its owner
 * at the check-in screens, the one-table check-in and through the AI tools. Two exceptions, both kept by Lane (12 Nov),
 * both for an admin: loading a workbook (a spreadsheet import, or setting up from an export) brings in everyone's
 * history, and Data's tables let an admin correct a past check-in. Each records the admin as author and actor, with
 * the door as its Via (postCheckIn.test).
 */
export function mayPostCheckIn(actor: Actor, goal: Pick<Goal, 'ownerId'>, via: Via): boolean {
  if (goal.ownerId === actor.id) return true;
  return !!actor.admin && ADMIN_CHECK_IN_DOORS.includes(via);
}
/** The only two exceptions to owner-only check-ins (Lane, 12 Nov): where an admin may bring in or correct someone else's. */
export const ADMIN_CHECK_IN_DOORS: readonly Via[] = ['spreadsheet', 'setup', 'table'];
