/* Who may add a goal, and who may change one (goal entry, rule 7; R1's access table). Stated once: the form's save
   (goalEntry planGoal), the change engine (changeset planChanges: a Goals row, a bulk edit, the AI tools) and the
   removals all ask these, so every door gives the same answer. Pure. */
import type { Goal, Person } from './types';

type Actor = Pick<Person, 'id' | 'admin'>;

/**
 * Whether `actor` may add a goal owned by `ownerId`. Always (Lane, 11 Nov): anyone may add a goal for anyone, at any
 * level, at every door. It exists so the rule is stated in one place, and the doors agree by sharing it.
 */
export function mayAddGoal(_actor: Actor, _ownerId: string): boolean {
  return true;
}

/** Whether `actor` may change a goal (its name, plan, owner, unit or decimals): its owner, or an admin. */
export function mayChangeGoal(actor: Actor, goal: Pick<Goal, 'ownerId'>): boolean {
  return !!actor.admin || goal.ownerId === actor.id;
}
