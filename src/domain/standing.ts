/* Rule 1 of the habit moment (docs/design/round-4/habit/spec.md 4): a goal's standing in a week, and who is due. Its own
   small file because Goals' `checkedin=` filter reads it through src/app/reads.ts, which Home's first download carries:
   Home must not import habit.ts (spec 9). habit.ts builds the measure (rules 2 and 4) on it. */
import { firstDueWeek } from './progress';
import type { Ask, CheckIn, Cycle, Goal } from './types';

/** What the measure reads for each goal: its check-ins and the asks for an update on it. Rows, never the workspace. */
export interface HabitRows {
  checkIns: readonly CheckIn[];
  asks: readonly Pick<Ask, 'kind' | 'goalIds' | 'createdAt' | 'answeredAt' | 'status' | 'updatedAt'>[];
}

/** A goal's standing in a week (rule 1). */
export type Standing = 'unasked' | 'asked' | 'after' | 'none';

/**
 * Rule 1: a live goal due that week (`dueWeek(goal) <= week`, the caller's FT1 rhythm). `none`: no check-in counts for the
 * week; `after`: the first was posted after the end of the due day; `asked`: it was in by the due day and answered an
 * ask for an update that was open when it was posted; `unasked` otherwise. A question, a comment or a review's carried
 * action is not a nudge, and a correction doesn't change a week's standing (it keeps the first check-in's time).
 */
export function checkInStanding(goal: Goal, week: number, rows: HabitRows, dueDay: string): Standing {
  const first = rows.checkIns.filter((c) => c.goalId === goal.id && c.week === week && !c.removedAt).map((c) => c.postedAt).sort()[0];
  if (!first) return 'none';
  if (first.slice(0, 10) > dueDay) return 'after';
  const asked = rows.asks.some((a) => a.kind === 'update' && a.goalIds.includes(goal.id) && a.createdAt <= first
    && (a.answeredAt ? a.answeredAt >= first : a.status === 'open' || (a.status === 'withdrawn' && a.updatedAt >= first)));
  return asked ? 'asked' : 'unasked';
}

/**
 * Who is due in a week, as the check-in counts it: a goal neither stopped nor proposed, first due by then (its set-up
 * day and its plan's From, `firstDueWeek`), and not already done before that week. The default `isDue` for rule 2.
 */
export function dueIn(cycle: Cycle, checkIns: readonly CheckIn[]): (g: Goal, week: number) => boolean {
  return (g, week) => !g.stoppedAt && !g.removedAt && !g.proposedAt && firstDueWeek(g, cycle) <= week
    && !checkIns.some((c) => c.goalId === g.id && c.week < week && c.status === 'done' && !c.removedAt);
}
