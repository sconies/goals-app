/* Small, honest progress signals: this week's check-ins and the on-time streak.
   They count only what the owner did themselves, as the research recommends. */
import { weekDate } from './plan';
import { goalStatus } from './status';
import type { Cycle, Goal, Snapshot } from './types';

export interface WeekProgress {
  goals: Goal[];
  done: Goal[];
  due: Goal[];
}

/** The person's goals this week: which are checked in and which are still due. */
export function weekProgress(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): WeekProgress {
  const goals = s.goals.filter((g) => g.ownerId === personId && goalStatus(g, cycle, s.checkIns, today).status !== 'done');
  const done = goals.filter((g) => s.checkIns.some((c) => c.goalId === g.id && c.week === week));
  // Week 0 is the baseline week: the first check-ins are due in week 1.
  return { goals, done, due: week < 1 ? [] : goals.filter((g) => !done.includes(g)) };
}

/** The day of a week's review, as an ISO date. Check-ins posted by the end of it count as on time. */
export function reviewDate(cycle: Cycle, week: number): string {
  const d = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + cycle.reviewDay);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive weeks, counting back from the latest finished one, in which every goal the
 * person owns was checked in by the owner on or before the review day.
 */
export function onTimeStreak(personId: string, s: Snapshot, cycle: Cycle, week: number): number {
  const goals = s.goals.filter((g) => g.ownerId === personId);
  if (!goals.length) return 0;
  const onTime = (w: number) =>
    goals.every((g) => s.checkIns.some((c) => c.goalId === g.id && c.week === w && c.authorId === personId && c.postedAt.slice(0, 10) <= reviewDate(cycle, w)));
  let streak = 0;
  // This week counts once it is complete; otherwise start from last week.
  for (let w = onTime(week) ? week : week - 1; w >= 1 && onTime(w); w--) streak++;
  return streak;
}

/** Days until this week's review (0 on the day, negative once it has passed). */
export function daysToReview(cycle: Cycle, week: number, today: Date): number {
  const r = Date.parse(reviewDate(cycle, week) + 'T00:00:00Z');
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((r - t) / 86_400_000);
}

export const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
