/* The habit moment (docs/design/round-4/habit/spec.md; HB1–HB3). Core, not a module: rules over check-ins, read by the
   check-in's receipt, a goal's History, a review and Home. Its words follow the reviews switch through a flag, as
   readBack.ts takes `reviewsOn`; nothing here imports a review module or names a person.

   Its own file so it loads with the screens that read it: Home is in the first download and must not import it (spec 9).
   The run and the receipt's sentences are progress.ts's (`onTimeStreak`, `forgivenIn`, `receiptText`). */
import { fmt } from './format';
import type { CheckIn, Goal } from './types';

/** A moment a check-in can make (rule 3): the goal reached its target, or it is back on track after two weeks or more behind. */
export interface Moment {
  kind: 'reached' | 'back';
  /** `back`: how many weeks in a row it had been behind plan before this check-in. */
  behind: number;
}

/** How many weeks behind a goal must have been for "back on track" to be said (rule 3). */
export const BACK_AFTER = 2;

/** Whether a value meets a metric goal's target in its direction (up when the target is above the start). */
function meets(goal: Goal, v: number): boolean {
  if (goal.kind !== 'metric' || goal.plan.target === goal.plan.start) return false;
  return goal.plan.target > goal.plan.start ? v >= goal.plan.target : v <= goal.plan.target;
}

/**
 * Rule 3: what a check-in makes, from the goal's earlier check-ins (any order) and this one. `reached` wins over `back`.
 * Neither fires on a backfilled week; callers leave out corrections and imports, which never reach the receipt and are
 * marked on History's row as corrected (`fresh: false`).
 */
export function moment(earlier: readonly CheckIn[], after: CheckIn, goal: Goal, fresh = true): Moment | null {
  if (!fresh || after.backfilled || after.removedAt) return null;
  // The week before's word on the goal: each earlier week's last check-in, newest first.
  const byWeek = new Map<number, CheckIn>();
  for (const c of [...earlier].sort((a, b) => a.week - b.week || a.postedAt.localeCompare(b.postedAt))) if (c.week < after.week && !c.removedAt) byWeek.set(c.week, c);
  const prior = [...byWeek.values()].sort((a, b) => b.week - a.week);
  const before = prior[0];
  if (after.value != null && meets(goal, after.value) && !(before?.value != null && meets(goal, before.value))) return { kind: 'reached', behind: 0 };
  if (after.status !== 'on' || !before || (before.status !== 'risk' && before.status !== 'off')) return null;
  let behind = 0;
  for (const c of prior) { if (c.status !== 'risk' && c.status !== 'off') break; behind++; }
  return behind >= BACK_AFTER ? { kind: 'back', behind } : null;
}

/** The receipt's panel for a moment (spec 2.2): its heading and line. */
export function momentText(m: Moment, goal: Goal, c: CheckIn, weeks: number): { heading: string; line: string } {
  const v = c.value == null || goal.kind === 'milestone' ? '' : fmt(c.value, goal);
  if (m.kind === 'reached' && goal.kind === 'metric') {
    return { heading: `${goal.title} reached its target`, line: `${v}, against a target of ${fmt(goal.plan.target, goal)}, in week ${c.week} of ${weeks}. It started the year at ${fmt(goal.plan.start, goal)}.` };
  }
  return { heading: `${goal.title} is back on track`, line: `${v ? `${v}, after` : 'After'} ${m.behind} weeks behind plan.` };
}

/** History's result on the check-in's row, in small capitals (spec 2.2). */
export const MOMENT_RESULT: Record<Moment['kind'], string> = { reached: 'Reached its target', back: 'Back on track' };
