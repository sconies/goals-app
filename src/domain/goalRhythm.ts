/* A goal's own check-in rhythm (MQ2 part 3; docs/architecture.md, "A goal's rhythm"): a core rule over a core field.

   The cycle sets the workspace's rhythm (FT1: every week, due by a weekday, or no set rhythm). Some goals are measured
   by a number that only changes monthly or quarterly: asking for a check-in every week would ask for the same number
   four times. Such a goal checks in once a month (or quarter) instead: due by the last due day of each calendar month
   (or quarter), so the month's new figure is in before it, and never "No recent update" in between.

   The field is the goal's own (`Goal.checkInRhythm`). Whatever measures the goal sets and clears it, the way it does
   `unmeasuredSince`: the metric library fills it in from its metric's refresh when it links the goal and when that
   refresh changes, and clears it when it is switched off. These rules read the goal alone, never a module's records,
   so they hold with every module switched off; and an empty field means the cycle's rhythm, as before.

   With no set rhythm on the cycle nothing is due, whatever a goal says: the cycle's choice wins.

   Pure: no screens, storage or network. */
import { weekDate } from './plan';
import { RULES, rhythmOf, staleAfterDays } from './thresholds';
import type { CheckIn, Change, Cycle, Goal } from './types';

/** A goal's own rhythm: monthly or quarterly. Absent or null: the cycle's. */
export type GoalRhythm = 'monthly' | 'quarterly';
export const GOAL_RHYTHMS: readonly GoalRhythm[] = ['monthly', 'quarterly'];

/** The rhythm a goal checks in on: its own when it has one and the cycle has a set rhythm, 'weekly' when it follows the
    cycle, null with no set rhythm (then nothing is due). */
export function goalRhythmOf(goal: Pick<Goal, 'checkInRhythm'>, cycle: Pick<Cycle, 'checkInWeeks' | 'reviewDay' | 'rhythmFrom' | 'startDate'>): GoalRhythm | 'weekly' | null {
  if (!rhythmOf(cycle)) return null;
  return goal.checkInRhythm === 'monthly' || goal.checkInRhythm === 'quarterly' ? goal.checkInRhythm : 'weekly';
}

/** Whether a goal checks in less often than its cycle: monthly or quarterly, with a set rhythm on the cycle. */
export const periodic = (goal: Pick<Goal, 'checkInRhythm'>, cycle: Cycle): goal is Goal & { checkInRhythm: GoalRhythm } => {
  const r = goalRhythmOf(goal, cycle);
  return r === 'monthly' || r === 'quarterly';
};

/** The day a week's check-ins are due by (yyyy-mm-dd): progress.reviewDate, worked out here so progress can import this. */
const dueDay = (cycle: Cycle, week: number): string => {
  const d = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + cycle.reviewDay);
  return d.toISOString().slice(0, 10);
};

/** The period a day falls in: "2026-11" monthly, "2026-Q4" quarterly. */
export const periodKey = (rhythm: GoalRhythm, day: string): string =>
  rhythm === 'monthly' ? day.slice(0, 7) : `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;

/** The cycle's weeks (1 to its last) whose due day falls in the same period as week `week`'s. */
export function periodWeeks(rhythm: GoalRhythm, cycle: Cycle, week: number): number[] {
  const key = periodKey(rhythm, dueDay(cycle, week));
  const out: number[] = [];
  for (let w = 1; w <= cycle.weeks; w++) if (periodKey(rhythm, dueDay(cycle, w)) === key) out.push(w);
  return out.length ? out : [week];
}

/** Whether `week` is the week a periodic goal's check-in is due in: its period's last week in the cycle. A weekly goal's
    is every week. */
export function isDueWeek(goal: Pick<Goal, 'checkInRhythm'>, cycle: Cycle, week: number): boolean {
  const r = goalRhythmOf(goal, cycle);
  if (r !== 'monthly' && r !== 'quarterly') return true;
  const weeks = periodWeeks(r, cycle, week);
  return weeks[weeks.length - 1] === week;
}

/** The weeks whose check-ins count for week `week`: that week alone for a weekly goal; every week of its period, up to
    and including `week`, for a periodic one (a check-in early in the month counts for the month). */
export function weeksCounting(goal: Pick<Goal, 'checkInRhythm'>, cycle: Cycle, week: number): number[] {
  const r = goalRhythmOf(goal, cycle);
  if (r !== 'monthly' && r !== 'quarterly') return [week];
  return periodWeeks(r, cycle, week).filter((w) => w <= week);
}

/** Whether a goal has a check-in that counts for week `week` (removed ones never do). */
export function checkedInFor(goal: Pick<Goal, 'id' | 'checkInRhythm'>, cycle: Cycle, checkIns: readonly CheckIn[], week: number): boolean {
  if (!goal.checkInRhythm) return checkIns.some((c) => c.goalId === goal.id && !c.removedAt && c.week === week);
  const weeks = new Set(weeksCounting(goal, cycle, week));
  return checkIns.some((c) => c.goalId === goal.id && !c.removedAt && weeks.has(c.week));
}

/** The longest a month and a quarter can be, in days: two of them without a check-in is "No recent update". */
const PERIOD_DAYS: Record<GoalRhythm, number> = { monthly: 31, quarterly: 92 };

/** Days without a check-in before a goal has no recent update: two check-ins' time in its own rhythm (62 days monthly,
    184 quarterly; the cycle's staleAfterDays otherwise). Null with no set rhythm. */
export function staleAfterDaysFor(goal: Pick<Goal, 'checkInRhythm'>, cycle: Cycle): number | null {
  const r = goalRhythmOf(goal, cycle);
  if (r === 'monthly' || r === 'quarterly') return RULES.staleCheckIns * PERIOD_DAYS[r];
  return staleAfterDays(cycle);
}


/** A goal's rhythm as the History's diff says it. */
const said = (r: GoalRhythm | null | undefined) => (r === 'monthly' ? 'Monthly' : r === 'quarterly' ? 'Quarterly' : 'The cycle’s');

/** The goal with its own rhythm set (`null`: back to the cycle's), unchanged when it already is. */
export function withRhythm<G extends Goal>(g: G, rhythm: GoalRhythm | null): G {
  if ((g.checkInRhythm ?? null) === rhythm) return g;
  return { ...g, checkInRhythm: rhythm };
}

/**
 * What a module that measures goals hands back when a goal's rhythm should change (the seam's one entry point): the goal
 * with its new rhythm and its History line, `why` naming the cause ("as “Cloud cost” refreshes monthly"). Null when the
 * goal already has it. Milestone goals have no number to wait for, so they keep the cycle's rhythm.
 */
export function rhythmChange(x: { actor: { id: string }; now: string; newId: (prefix: string) => string }, g: Goal, rhythm: GoalRhythm | null, why: string): { goal: Goal; change: Change } | null {
  const to = g.kind === 'milestone' ? null : rhythm;
  if ((g.checkInRhythm ?? null) === to) return null;
  const summary = to ? `Checks in ${to === 'monthly' ? 'monthly' : 'quarterly'}, ${why}` : `Checks in on the cycle’s rhythm again, ${why}`;
  return {
    goal: withRhythm(g, to),
    change: { id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary, diffs: [{ field: 'Check-in rhythm', from: said(g.checkInRhythm), to: said(to) }] },
  };
}

