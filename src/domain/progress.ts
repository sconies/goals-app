/* Small, honest progress signals: this week's check-ins and the on-time streak.
   They count only what the owner did themselves, as the research recommends. */
import { firstWeekFrom, hasEnded, weekDate } from './plan';
import { goalStatus } from './status';
import { rhythmOf } from './thresholds';
import type { CheckIn, Cycle, Goal, Review, Snapshot } from './types';

export interface WeekProgress {
  goals: Goal[];
  done: Goal[];
  due: Goal[];
  /** Set up after this week's review day: their first check-in is due next week (firstDueWeek). */
  upcoming: Goal[];
}

/** The first week a goal's check-in is due: the week it was set up in, or the next one when it was set up after that week's review day; never before its plan's From. */
export const firstDueWeek = (g: Pick<Goal, 'createdAt'> & Partial<Pick<Goal, 'kind'>> & { plan?: { fromWeek?: number } }, cycle: Cycle) => {
  // With no set rhythm nothing is ever due (FT1): callers don't ask, and the answer is "never".
  const rhythm = rhythmOf(cycle);
  if (!rhythm) return Infinity;
  // A plan whose From is still to come is first due in that week (goal entry, rule 13: notStarted); nothing is due
  // before the present rhythm began (`rhythmFrom`).
  return Math.max(firstWeekFrom(cycle, g.createdAt, rhythm.dueDay), g.kind === 'metric' ? g.plan?.fromWeek ?? 0 : 0, cycle.rhythmFrom ? firstWeekFrom(cycle, rhythm.from, rhythm.dueDay) : 0);
};

/** The person's goals this week: which are checked in and which are still due. */
export function weekProgress(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): WeekProgress {
  const goals = s.goals.filter((g) => g.ownerId === personId && goalStatus(g, cycle, s.checkIns, today).status !== 'done');
  const done = goals.filter((g) => s.checkIns.some((c) => c.goalId === g.id && c.week === week));
  // Week 0 is the baseline week: the first check-ins are due in week 1, and a goal set up after this week's review starts next week.
  // With no set rhythm nothing is due or upcoming (FT1).
  if (!rhythmOf(cycle)) return { goals, done, upcoming: [], due: [] };
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

/** The confirmation's sentence, from weekCompletion: all of them in, what's still due, or what isn't due yet. */
export function weekDoneText(p: WeekProgress, week: number, late = false, cycle?: Cycle): string {
  const w = weekCompletion(p);
  const rhythm = cycle ? rhythmOf(cycle) : { weeks: 1, dueDay: 3, from: '' };
  // With no set rhythm nothing is owed: say what is in, and nothing about what is still due (FT1).
  if (!rhythm) return `${w.done} of ${w.total} have a check-in for week ${week}.`;
  const after = cycle ? `, after ${WEEKDAY[rhythm.dueDay]}` : ', after the due day';
  if (w.complete) return `${w.total === 1 ? 'Your goal is' : w.total === 2 ? 'Both your goals are' : `All ${w.total} of your goals are`} checked in for week ${week}${late ? after : ''}.`;
  if (p.due.length) return `${w.done} of ${w.total} checked in for week ${week}. Still due this week: ${p.due.map((g) => g.title).join(', ')}.`;
  const rest = w.total - w.done;
  return `${w.done} of ${w.total} checked in for week ${week}. ${rest === 1 ? 'The other one isn’t' : `The other ${rest} aren’t`} due until next week.`;
}

/** The day a week's check-ins are due by, as an ISO date. Check-ins posted by the end of it count as on time. Callers
    that may have no set rhythm ask `dueDate`, which says null then. */
export function reviewDate(cycle: Cycle, week: number): string {
  const d = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + cycle.reviewDay);
  return d.toISOString().slice(0, 10);
}

/** The day a week's check-ins are due by (ISO), or null with no set rhythm (FT1). */
export const dueDate = (cycle: Cycle, week: number): string | null => (rhythmOf(cycle) ? reviewDate(cycle, week) : null);

/** The review a goal set up today first reports to: its week, and its date as an ISO date ("first check-ins are due before Thursday 12 Nov"). */
export function firstReview(cycle: Cycle, today: Date): { week: number; date: string } {
  const week = firstWeekFrom(cycle, today.toISOString(), cycle.reviewDay);
  return { week, date: reviewDate(cycle, week) };
}

/**
 * The on-time run (CF4, forgiving; HB1): weeks in a row, counting back from the latest finished one, in which every goal
 * the person owns was checked in by the owner on or before the review day. One late week is forgiven when each of the
 * four weeks before it in which the person had something due was on time: it isn't counted, and the walk goes on. A late
 * week that isn't forgiven ends the run. "Checked in this week, but late" is a late week like any other.
 *
 * CF2's migration (the cycle's `streak` setting) isn't on main yet, so the forgiving run is the only one: when it lands,
 * 'on' skips the forgiving step and 'off' returns null (docs/design/workspace-settings/spec.md 2.5).
 */
export function onTimeStreak(personId: string, s: Snapshot, cycle: Cycle, week: number): number | null {
  // No set rhythm, no streak (FT1). With one, firstDueWeek never counts a week before the rhythm began.
  if (!rhythmOf(cycle)) return null;
  return onTimeRun(personId, s.goals, s.checkIns, cycle, week).weeks;
}

/** The forgiven week inside the current run, so the receipt can say it once (habit spec, rule 5); null when none. */
export function forgivenIn(personId: string, goals: readonly Goal[], checkIns: readonly CheckIn[], cycle: Cycle, week: number): number | null {
  return onTimeRun(personId, goals, checkIns, cycle, week).forgiven[0] ?? null;
}

/** How many weeks before a late one must be on time for it to be forgiven (CF4). */
export const FORGIVE_AFTER = 4;

function onTimeRun(personId: string, all: readonly Goal[], checkIns: readonly CheckIn[], cycle: Cycle, week: number): { weeks: number; forgiven: number[] } {
  const goals = all.filter((g) => g.ownerId === personId);
  const s = { checkIns };
  if (!goals.length || !rhythmOf(cycle)) return { weeks: 0, forgiven: [] };
  const due = (w: number) => goals.some((g) => firstDueWeek(g, cycle) <= w);
  const onTime = (w: number) =>
    due(w) && goals.every((g) => firstDueWeek(g, cycle) > w || s.checkIns.some((c) => c.goalId === g.id && c.week === w && c.authorId === personId && c.postedAt.slice(0, 10) <= reviewDate(cycle, w)));
  const forgiven = (w: number) => {
    let seen = 0;
    for (let v = w - 1; v >= 1 && seen < FORGIVE_AFTER; v--) {
      if (!due(v)) continue;
      if (!onTime(v)) return false;
      seen++;
    }
    return seen === FORGIVE_AFTER;
  };
  // This week counts once every goal is checked in; otherwise start from last week.
  const complete = goals.every((g) => firstDueWeek(g, cycle) > week || s.checkIns.some((c) => c.goalId === g.id && c.week === week));
  const out = { weeks: 0, forgiven: [] as number[] };
  for (let w = complete && due(week) ? week : week - 1; w >= 1 && due(w); w--) {
    if (onTime(w)) out.weeks++;
    else if (forgiven(w)) out.forgiven.push(w);
    else break;
  }
  return out;
}

/** What the week's receipt reads (habit spec 2.1): the person's goals this week, how many of their first check-ins came
    after the due day, the due day's weekday, whether to name it as a review (`review`: the person is in a review held
    that day; otherwise it is the workspace's deadline, deep review T4), the run and its forgiven week, and the next due
    day already in words ("Thursday 19 Nov"; null in the year's last week). */
export interface ReceiptFacts {
  total: number;
  after: number;
  week: number;
  dueDay: string;
  review: boolean;
  run: number;
  forgiven: number | null;
  nextDue: string | null;
}

/**
 * The receipt's facts for a person's week (habit spec 2.1), from the rules that already say each: weekProgress (`p`) for
 * their goals, reviewDate for the due day, the run. A goal's week counts as after when its first check-in that week
 * (theirs, or someone's checking in for them) was posted after the due day. `review` is `reviewOnDueDay`'s.
 * `nextDue` is the next due day as an ISO date: the caller says it in words before `receiptText`.
 */
export function receiptFacts(p: WeekProgress, personId: string, s: { goals: readonly Goal[]; checkIns: readonly CheckIn[] }, cycle: Cycle, week: number, review: boolean): ReceiptFacts {
  const due = reviewDate(cycle, week);
  const after = p.goals.filter((g) => {
    const first = s.checkIns.filter((c) => c.goalId === g.id && c.week === week && !c.removedAt).map((c) => c.postedAt).sort()[0];
    return first != null && first.slice(0, 10) > due;
  }).length;
  const run = onTimeRun(personId, s.goals, s.checkIns, cycle, week);
  return { total: p.goals.length, after, week, dueDay: WEEKDAY[cycle.reviewDay]!, review, run: run.weeks, forgiven: run.forgiven[0] ?? null, nextDue: week < cycle.weeks ? reviewDate(cycle, week + 1) : null };
}

/**
 * The receipt's two sentences, once every check-in of the week is in (habit spec 2.1; HB1). Read by the check-in's last
 * screen and by Home's quiet line on the day the week is completed. A late week is never called lost or broken, and no run
 * is mentioned beside one. The due day is a review only for someone in a review held that day (T4).
 */
export function receiptText(r: ReceiptFacts): { first: string; second: string | null } {
  const yours = r.total === 1 ? 'Your check-in is' : r.total === 2 ? 'Both of your check-ins are' : `All ${r.total} of your check-ins are`;
  const next = r.nextDue ? `The next ${r.total === 1 ? 'is' : 'are'} due by ${r.nextDue}.` : null;
  if (r.after > 0) {
    const who = r.total === 1 ? 'It' : r.after === r.total ? (r.total === 2 ? 'Both' : 'All of them') : r.after === 1 ? 'One' : String(r.after);
    return { first: `${yours} in. ${who} came ${r.review ? `after ${r.dueDay}’s review` : `in after ${r.dueDay}’s deadline`}.`, second: next };
  }
  const first = r.review ? `${yours} in before ${r.dueDay}’s review.` : `${yours} in for week ${r.week}, before ${r.dueDay}’s deadline.`;
  const run = r.run >= 2 ? `That is ${r.run} weeks in a row.` : null;
  // Said once: on the first receipt after the forgiven week.
  const kept = r.forgiven != null && r.forgiven === r.week - 1 && r.run >= 2 ? `Week ${r.forgiven} came in late; one late week doesn’t break a run.` : null;
  return { first, second: [run, kept].filter(Boolean).join(' ') || null };
}

/** Whether the person is in a review held on the workspace's due day (live, not ended): only then is the due day said
    as a review (deep review T4). `reviewsOn` is the reviews switch's flag (FT2), as readBack.ts takes it. */
export function reviewOnDueDay(reviews: readonly Pick<Review, 'people' | 'weekday' | 'removedAt' | 'endedAt'>[], personId: string, cycle: Cycle, reviewsOn: boolean): boolean {
  return reviewsOn && reviews.some((r) => !r.removedAt && !r.endedAt && r.weekday === cycle.reviewDay && r.people.includes(personId));
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
export function firstReports(s: Snapshot, cycle: Cycle, week: number): { total: number; reported: number; waiting: { ownerId: string; goals: number }[]; silent: string[]; due: string | null } | null {
  // A goal counts once its first check-in is due. A plan that starts this week (every goal set up today) is due too, so it
  // counts: day one once said "0 of 2" beside "3 goals" (deep review U6). Only a plan that starts in a later week waits.
  // With no set rhythm nothing is due: a goal counts once it has begun, and `due` is null (FT1).
  const rhythm = rhythmOf(cycle);
  const begun = (g: Goal) => (rhythm ? firstDueWeek(g, cycle) : firstWeekFrom(cycle, g.createdAt, cycle.reviewDay)) <= week;
  const live = s.goals.filter((g) => begun(g) && (g.kind !== 'metric' || (g.plan.fromWeek ?? 0) <= week));
  const silent = live.filter((g) => !s.checkIns.some((c) => c.goalId === g.id));
  if (week < 1 || !live.length || !silent.length) return null;
  const by = new Map<string, number>();
  for (const g of silent) by.set(g.ownerId, (by.get(g.ownerId) ?? 0) + 1);
  return { total: live.length, reported: live.length - silent.length, waiting: [...by].map(([ownerId, goals]) => ({ ownerId, goals })), silent: silent.map((g) => g.id), due: dueDate(cycle, week) };
}

/** A row of the check-in list (FT1, NV3): a goal, and the week and time of its latest check-in (null: none yet). */
export interface CheckInRow {
  goalId: string;
  lastWeek: number | null;
  lastPostedAt: string | null;
}

/**
 * The person's live goals for checking in with no set rhythm (FT1, spec 2.3): those with no check-in this week
 * (`waiting`: never-checked-in goals first, then oldest first) and those that have one (`thisWeek`). Done and stopped goals
 * are left out. A done goal is one whose latest check-in says so.
 */
export function checkInList(personId: string, goals: readonly Goal[], checkIns: readonly CheckIn[], week: number): { waiting: CheckInRow[]; thisWeek: CheckInRow[] } {
  const rows = goals
    .filter((g) => g.ownerId === personId && !g.stoppedAt && !g.removedAt && !g.proposedAt)
    .map((g) => {
      const own = checkIns.filter((c) => c.goalId === g.id && !c.removedAt);
      const latest = own.length ? own.reduce((a, b) => (b.postedAt > a.postedAt ? b : a)) : null;
      return { row: { goalId: g.id, lastWeek: latest?.week ?? null, lastPostedAt: latest?.postedAt ?? null }, done: latest?.status === 'done', now: own.some((c) => c.week === week) };
    })
    .filter((r) => !r.done);
  const waiting = rows.filter((r) => !r.now).map((r) => r.row).sort((a, b) => (a.lastPostedAt ?? '').localeCompare(b.lastPostedAt ?? ''));
  return { waiting, thisWeek: rows.filter((r) => r.now).map((r) => r.row) };
}
