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
  // Checked in this week, but after the review: the streak is broken, whatever came before.
  if (goals.every((g) => s.checkIns.some((c) => c.goalId === g.id && c.week === week)) && !onTime(week)) return 0;
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

/**
 * Goals that have never had a check-in, and their owners: while a portfolio is starting up, "nothing needs attention"
 * can just mean nobody has reported. Shown as "2 of 4 first check-ins in" until every goal has one (product review, 3 Nov).
 */
export function firstReports(s: Snapshot, cycle: Cycle, week: number): { total: number; reported: number; waiting: { ownerId: string; goals: number }[]; due: string } | null {
  const live = s.goals.filter((g) => (g.kind !== 'metric' || (g.plan.fromWeek ?? 0) < Math.max(1, week)));
  const silent = live.filter((g) => !s.checkIns.some((c) => c.goalId === g.id));
  if (week < 1 || !live.length || !silent.length) return null;
  const by = new Map<string, number>();
  for (const g of silent) by.set(g.ownerId, (by.get(g.ownerId) ?? 0) + 1);
  return { total: live.length, reported: live.length - silent.length, waiting: [...by].map(([ownerId, goals]) => ({ ownerId, goals })), due: reviewDate(cycle, week) };
}
