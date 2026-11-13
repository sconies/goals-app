/* Small, honest progress signals: this week's check-ins and the on-time streak.
   They count only what the owner did themselves, as the research recommends. */
import { firstWeekFrom, hasEnded, weekDate } from './plan';
import { goalStatus } from './status';
import type { Cycle, Goal, Snapshot } from './types';

export interface WeekProgress {
  goals: Goal[];
  done: Goal[];
  due: Goal[];
  /** Set up after this week's review day: their first check-in is due next week (firstDueWeek). */
  upcoming: Goal[];
}

/** The first week a goal's check-in is due: the week it was set up in, or the next one when it was set up after that week's review day; never before its plan's From. */
export const firstDueWeek = (g: Pick<Goal, 'createdAt'> & Partial<Pick<Goal, 'kind'>> & { plan?: { fromWeek?: number } }, cycle: Cycle) =>
  // A plan whose From is still to come is first due in that week (goal entry, rule 13: notStarted).
  Math.max(firstWeekFrom(cycle, g.createdAt, cycle.reviewDay), g.kind === 'metric' ? g.plan?.fromWeek ?? 0 : 0);

/** The person's goals this week: which are checked in and which are still due. */
export function weekProgress(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): WeekProgress {
  const goals = s.goals.filter((g) => g.ownerId === personId && goalStatus(g, cycle, s.checkIns, today).status !== 'done');
  const done = goals.filter((g) => s.checkIns.some((c) => c.goalId === g.id && c.week === week));
  // Week 0 is the baseline week: the first check-ins are due in week 1, and a goal set up after this week's review starts next week.
  const upcoming = goals.filter((g) => !done.includes(g) && firstDueWeek(g, cycle) > week);
  // Once the cycle's last day is past, nothing in it is due (cycle-end rule 2).
  return { goals, done, upcoming, due: week < 1 || hasEnded(cycle, today) ? [] : goals.filter((g) => !done.includes(g) && !upcoming.includes(g)) };
}

/**
 * Where the person's week stands, the one reading Home's ring, the check-in's confirmation and its done screen all use
 * (backlog T, 8 Nov: a confirmation once said all four goals were checked in after one, because the other three weren't
 * due yet). Complete only when every goal counted is checked in this week.
 */
export function weekCompletion(p: WeekProgress): { done: number; total: number; complete: boolean } {
  return { done: p.done.length, total: p.goals.length, complete: p.goals.length > 0 && p.done.length >= p.goals.length };
}

/** What dueWords says about one week's deadline. */
export interface DueWords {
  /** By the deadline: "before Thursday’s review", or "by Thursday" (the receipt; the habit measure's "under the row"). */
  by: string;
  /** Past it: "after Thursday’s review", or "after Thursday". */
  after: string;
  /** In time, as a label or a heading says it: "before the review", or "on time" (the habit measure's panel and cell). */
  onTime: string;
  /** The due day's name: "Thursday". */
  day: string;
  /** The due date, named in full as a deadline: "Thursday 12 Nov" (Home names the deadline as a deadline, never a review). */
  date: string;
  /** The `due` flag's sentence: "Due by Thu 12 Nov.", with Reviews on or off. */
  flag: string;
}

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Rule RS1 (docs/design/round-4/reviews-switch/spec.md 4): one phrase for the clock. The day check-ins are due
 * (`Cycle.reviewDay`) never needed a review, so a screen never writes "review" in a deadline itself: it asks here.
 * With Reviews on and a review held on the due day (`held`, from review.ts heldOnDueDay) the deadline is "before
 * Thursday’s review"; with no review set up on that day, or Reviews off, it is "by Thursday". The `due` flag says
 * "Due by Thu 12 Nov." either way.
 */
export function dueWords(reviewsOn: boolean, cycle: Cycle, week: number, held = false): DueWords {
  return dueWordsOn(reviewsOn, reviewDate(cycle, Math.max(1, week)), held);
}

/** dueWords for a due date already worked out (yyyy-mm-dd), as Home's facts carry it. */
export function dueWordsOn(reviewsOn: boolean, iso: string, held = false): DueWords {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  const day = WEEKDAY[(d.getUTCDay() + 6) % 7] ?? '';
  const review = reviewsOn && held;
  return {
    by: review ? `before ${day}’s review` : `by ${day}`,
    after: review ? `after ${day}’s review` : `after ${day}`,
    onTime: review ? 'before the review' : 'on time',
    day,
    date: `${day} ${d.getUTCDate()} ${SHORT_MONTH[d.getUTCMonth()]}`,
    flag: `Due by ${day.slice(0, 3)} ${d.getUTCDate()} ${SHORT_MONTH[d.getUTCMonth()]}.`,
  };
}

/**
 * The confirmation's sentence, from weekCompletion: all of them in, what's still due, or what isn't due yet. All in, it
 * says when against the deadline in dueWords' words (`clock`): "…checked in for week 46, by Thursday." or "…, after
 * Thursday’s review."
 */
export function weekDoneText(p: WeekProgress, week: number, clock?: { late: boolean; words: DueWords }): string {
  const w = weekCompletion(p);
  if (w.complete) return `${w.total === 1 ? 'Your goal is' : w.total === 2 ? 'Both your goals are' : `All ${w.total} of your goals are`} checked in for week ${week}${clock ? `, ${clock.late ? clock.words.after : clock.words.by}` : ''}.`;
  if (p.due.length) return `${w.done} of ${w.total} checked in for week ${week}. Still due this week: ${p.due.map((g) => g.title).join(', ')}.`;
  const rest = w.total - w.done;
  return `${w.done} of ${w.total} checked in for week ${week}. ${rest === 1 ? 'The other one isn’t' : `The other ${rest} aren’t`} due until next week.`;
}

/** The day of a week's review, as an ISO date. Check-ins posted by the end of it count as on time. */
export function reviewDate(cycle: Cycle, week: number): string {
  const d = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + cycle.reviewDay);
  return d.toISOString().slice(0, 10);
}

/** The review a goal set up today first reports to: its week, and its date as an ISO date ("first check-ins are due before Thursday 12 Nov"). */
export function firstReview(cycle: Cycle, today: Date): { week: number; date: string } {
  const week = firstWeekFrom(cycle, today.toISOString(), cycle.reviewDay);
  return { week, date: reviewDate(cycle, week) };
}

/**
 * Consecutive weeks, counting back from the latest finished one, in which every goal the
 * person owns was checked in by the owner on or before the review day.
 */
export function onTimeStreak(personId: string, s: Snapshot, cycle: Cycle, week: number): number {
  const goals = s.goals.filter((g) => g.ownerId === personId);
  if (!goals.length) return 0;
  const onTime = (w: number) =>
    goals.some((g) => firstDueWeek(g, cycle) <= w) && goals.every((g) => firstDueWeek(g, cycle) > w || s.checkIns.some((c) => c.goalId === g.id && c.week === w && c.authorId === personId && c.postedAt.slice(0, 10) <= reviewDate(cycle, w)));
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
export function firstReports(s: Snapshot, cycle: Cycle, week: number): { total: number; reported: number; waiting: { ownerId: string; goals: number }[]; silent: string[]; due: string } | null {
  // A goal counts once its first check-in is due. A plan that starts this week (every goal set up today) is due too, so it
  // counts: day one once said "0 of 2" beside "3 goals" (deep review U6). Only a plan that starts in a later week waits.
  const live = s.goals.filter((g) => firstDueWeek(g, cycle) <= week && (g.kind !== 'metric' || (g.plan.fromWeek ?? 0) <= week));
  const silent = live.filter((g) => !s.checkIns.some((c) => c.goalId === g.id));
  if (week < 1 || !live.length || !silent.length) return null;
  const by = new Map<string, number>();
  for (const g of silent) by.set(g.ownerId, (by.get(g.ownerId) ?? 0) + 1);
  return { total: live.length, reported: live.length - silent.length, waiting: [...by].map(([ownerId, goals]) => ({ ownerId, goals })), silent: silent.map((g) => g.id), due: reviewDate(cycle, week) };
}
