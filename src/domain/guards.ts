/* Guardrails on a goal (backlog GR; docs/architecture/module-map.md, the GR row). A goal can name the goals that guard
   it: goals kept in a range (a number with a limit, e.g. change failure rate at most 12%), so that meeting it by making
   something else worse shows on the goal itself. The rule lives here once: the check-in, the engine (a sheet, the AI
   tools) and the goal page all read it.

   The rule. A guard past its limit makes the goal it guards at least as bad as the guard's own range rule says: past
   the limit at its latest number, At risk; past it two weeks running, Off track. A guard near its limit but inside it
   changes nothing. The goal's own number is judged as before; the worse of the two is the calculated status, and the
   words say which guard, its number and how far past its limit it is. */
import { assessPosted, RANK, type RangeAssessment } from './status';
import { rangeSide } from './range';
import type { CheckIn, Cycle, Goal, Id, RangeGoal, Status } from './types';
/* What only the screens need (the words, and why a goal can't guard) is in guardWords.ts, so the first download stays small. */

/** The most guards a goal names (okr_goals_guards_shape). */
export const MAX_GUARDS = 5;

/** A guard as stored on the goal: the range goal that guards it. */
export interface GoalGuard { goal: Id }

/** A guard past its limit, as of a week. */
export interface GuardBreach {
  guard: RangeGoal;
  /** Its latest number, and the week it is from. */
  value: number;
  week: number;
  /** The limit it is past, and which way. */
  limit: number;
  bound: 'atMost' | 'atLeast';
  /** How far past the limit, in the guard's unit (always positive). */
  by: number;
  /** Past it two weeks running: the guarded goal is off track; otherwise at risk. */
  status: Extract<Status, 'risk' | 'off'>;
}

/** Whether a goal can guard others: one kept in a range, still live (not removed or stopped). */
export const canGuard = (g: Goal): g is RangeGoal => g.kind === 'range' && !g.removedAt && !g.stoppedAt;

/** The goal ids a goal is guarded by, in the order named. */
export const guardIds = (goal: Pick<Goal, 'guards'>): Id[] => (goal.guards ?? []).map((x) => x.goal);

/** The guards past their limit as of `week`, worst first (then in the order named). */
export function guardBreaches(goal: Goal, goals: readonly Goal[], cycle: Cycle, checkIns: CheckIn[], week: number): GuardBreach[] {
  const out: GuardBreach[] = [];
  for (const { goal: id } of goal.guards ?? []) {
    const g = goals.find((x) => x.id === id);
    if (!g || !canGuard(g)) continue;
    const a = assessPosted(g, cycle, checkIns, week) as RangeAssessment;
    if (!a.out || a.actual == null) continue;
    const side = rangeSide(g.range, a.actual);
    out.push({ guard: g, value: a.actual, week: a.week, limit: side.limit, bound: side.bound, by: Math.abs(a.actual - side.limit), status: a.calc === 'off' ? 'off' : 'risk' });
  }
  return out.sort((x, y) => RANK[y.status] - RANK[x.status]);
}

/** A calculated status with the guards applied: the worse of the goal's own and its worst breach's. */
export function guardedCalc(calc: Status, breaches: readonly GuardBreach[]): Status {
  const worst = breaches[0]?.status;
  return worst && RANK[worst] > RANK[calc] ? worst : calc;
}

