/* Guardrails on a goal (backlog GR; docs/architecture/module-map.md, the GR row). A goal can name the goals that guard
   it: goals kept in a range (a number with a limit, e.g. change failure rate at most 12%), so that meeting it by making
   something else worse shows on the goal itself. The rule lives here once: the check-in, the engine (a sheet, the AI
   tools) and the goal page all read it.

   The rule. A guard past its limit makes the goal it guards at least as bad as the guard's own range rule says: past
   the limit at its latest number, At risk; past it two weeks running, Off track. A guard near its limit but inside it
   changes nothing. The goal's own number is judged as before; the worse of the two is the calculated status, and the
   words say which guard, its number and how far past its limit it is. */
import { assessPosted, checkInsFor, type RangeAssessment } from './status';
import { rangeSide } from './range';
import { fmt, fmtDiff } from './format';
import type { CheckIn, Cycle, Goal, Id, RangeGoal, Status } from './types';

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

/** Why a goal can't guard `goal`, in words; null when it can. */
export function guardRefusal(goal: Pick<Goal, 'id' | 'cycleId'>, other: Goal): string | null {
  if (other.id === goal.id) return 'A goal can’t guard itself';
  if (other.kind !== 'range') return 'Only a goal kept in a range can guard';
  if (other.removedAt || other.stoppedAt) return 'It’s no longer running';
  if (other.cycleId !== goal.cycleId) return 'It’s in another year';
  return null;
}

/** The guards as they are kept: known range goals, each once, never the goal itself, at most MAX_GUARDS. */
export function cleanGuards(goal: Pick<Goal, 'id' | 'cycleId'>, ids: readonly Id[], goals: readonly Goal[]): GoalGuard[] {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const out: GoalGuard[] = [];
  for (const id of ids) {
    const g = byId.get(id);
    if (!g || guardRefusal(goal, g) || out.some((x) => x.goal === id)) continue;
    out.push({ goal: id });
  }
  return out.slice(0, MAX_GUARDS);
}

/** The guards past their limit as of `week`, worst first (then in the order named). */
export function guardBreaches(goal: Goal, goals: readonly Goal[], cycle: Cycle, checkIns: CheckIn[], week: number): GuardBreach[] {
  const ids = guardIds(goal);
  if (!ids.length) return [];
  const out: GuardBreach[] = [];
  for (const id of ids) {
    const g = goals.find((x) => x.id === id);
    if (!g || !canGuard(g) || !checkInsFor(g, checkIns).some((c) => c.week <= week && c.value != null)) continue;
    const a = assessPosted(g, cycle, checkIns, week) as RangeAssessment;
    if (!a.out || a.actual == null) continue;
    const side = rangeSide(g.range, a.actual);
    out.push({ guard: g, value: a.actual, week: a.week, limit: side.limit, bound: side.bound, by: Math.abs(a.actual - side.limit), status: a.calc === 'off' ? 'off' : 'risk' });
  }
  return out.sort((x, y) => (x.status === y.status ? 0 : x.status === 'off' ? -1 : 1));
}

const RANKED: Record<Status, number> = { done: 0, on: 1, risk: 2, off: 3 };

/** A calculated status with the guards applied: the worse of the goal's own and its worst breach's. */
export function guardedCalc(calc: Status, breaches: readonly GuardBreach[]): Status {
  const worst = breaches[0]?.status;
  return worst && RANKED[worst] > RANKED[calc] ? worst : calc;
}

/** One breach in words: “Guardrail “Change failure rate” (G-41) is over its 12.0% limit: 14.0% in week 44, 2.0 pts over,
    2 weeks running.” */
export function breachWords(b: GuardBreach): string {
  const name = `“${b.guard.title}”${b.guard.key ? ` (${b.guard.key})` : ''}`;
  const side = b.bound === 'atMost' ? 'over' : 'under';
  const running = b.status === 'off' ? ', 2 weeks running' : '';
  return `Guardrail ${name} is ${side} its ${fmt(b.limit, b.guard)} limit: ${fmt(b.value, b.guard)} in week ${b.week}, ${fmtDiff(b.by, b.guard)} ${side}${running}.`;
}
