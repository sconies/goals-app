/* Small, honest progress signals: this week's check-ins and the on-time streak.
   They count only what the owner did themselves, as the research recommends. */
import { firstWeekFrom, hasEnded, weekDate } from './plan';
import { goalStatus } from './status';
import type { CheckIn, Cycle, Goal, Snapshot } from './types';

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
 * The confirmation's sentence, from weekCompletion: all of them in, what's still due, or what isn't due yet. Once all are
 * in the check-in shows the receipt instead (receiptText), which says when against the deadline in dueWords' words.
 */
export function weekDoneText(p: WeekProgress, week: number): string {
  const w = weekCompletion(p);
  if (w.complete) return `${w.total === 1 ? 'Your goal is' : w.total === 2 ? 'Both your goals are' : `All ${w.total} of your goals are`} checked in for week ${week}.`;
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
 * The on-time run (CF4, forgiving; HB1): weeks in a row, counting back from the latest finished one, in which every goal
 * the person owns was checked in by the owner on or before the review day. One late week is forgiven when each of the
 * four weeks before it in which the person had something due was on time: it isn't counted, and the walk goes on. A late
 * week that isn't forgiven ends the run. "Checked in this week, but late" is a late week like any other.
 *
 * CF2's migration (the cycle's `streak` setting) isn't on main yet, so the forgiving run is the only one: when it lands,
 * 'on' skips the forgiving step and 'off' returns null (docs/design/workspace-settings/spec.md 2.5).
 */
export function onTimeStreak(personId: string, s: Snapshot, cycle: Cycle, week: number): number {
  return onTimeRun(personId, s.goals, s.checkIns, cycle, week).weeks;
}

/** The forgiven week inside the current run, so the receipt can say it once (habit spec, rule 5); null when none. */
export function forgivenIn(personId: string, goals: readonly Goal[], checkIns: readonly CheckIn[], cycle: Cycle, week: number): number | null {
  return onTimeRun(personId, goals, checkIns, cycle, week).forgiven[0]?.week ?? null;
}

/** The forgiven week inside the current run, and whether it was missed (nothing of theirs posted in it) or late. */
export function forgivenWeek(personId: string, goals: readonly Goal[], checkIns: readonly CheckIn[], cycle: Cycle, week: number): { week: number; missed: boolean } | null {
  return onTimeRun(personId, goals, checkIns, cycle, week).forgiven[0] ?? null;
}

/** How many weeks before a late one must be on time for it to be forgiven (CF4). */
export const FORGIVE_AFTER = 4;

/** The day a check-in was posted, on the clock of whoever reads it: the same clock Home's "today" is read on (the app's
    `today` is the device's own date and time), so Home's "due today", the receipt and the run name one due day for the
    same person (#410 review, medium 1). On the server, whose clock is UTC, it is the UTC day. */
export const postedDay = (iso: string): string => { const n = new Date(iso); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10); };

/** Whether a check-in came in by its week's due day (`postedDay` on or before it), and was posted in its week rather than
    added later: a backfilled week is never on time (#410 review, medium 3). */
export function inByDueDay(c: Pick<CheckIn, 'postedAt' | 'backfilled'>, cycle: Cycle, week: number): boolean {
  return !c.backfilled && postedDay(c.postedAt) <= reviewDate(cycle, week);
}

/** The first week a goal counts for its present owner in the run: its first due week, or, when someone else checked it in
    later (it was theirs, or handed over), the week after the last of those, so taking over a goal never costs the new
    owner the weeks before it was theirs (#410 review, medium 4). */
function ownedFrom(g: Goal, personId: string, checkIns: readonly CheckIn[], cycle: Cycle): number {
  const others = checkIns.filter((c) => c.goalId === g.id && c.authorId !== personId).map((c) => c.week);
  return Math.max(firstDueWeek(g, cycle), others.length ? Math.max(...others) + 1 : 0);
}

/** The week a goal was closed as Done, if it was (its first check-in with the status Done): it isn't due after that week,
    as weekProgress leaves Done goals out (#410 review, medium 2). */
function doneWeek(g: Goal, checkIns: readonly CheckIn[]): number {
  const w = checkIns.filter((c) => c.goalId === g.id && c.status === 'done').map((c) => c.week);
  return w.length ? Math.min(...w) : Infinity;
}

/** The run's walk, and the weeks inside it that were forgiven, each as late (checked in after the due day) or missed. */
function onTimeRun(personId: string, all: readonly Goal[], allCheckIns: readonly CheckIn[], cycle: Cycle, week: number): { weeks: number; forgiven: { week: number; missed: boolean }[] } {
  const checkIns = allCheckIns.filter((c) => !c.removedAt);
  const goals = all.filter((g) => g.ownerId === personId).map((g) => ({ g, from: ownedFrom(g, personId, checkIns, cycle), to: doneWeek(g, checkIns) }));
  if (!goals.length) return { weeks: 0, forgiven: [] };
  const dueIn = (w: number) => goals.filter((x) => x.from <= w && w <= x.to);
  const due = (w: number) => dueIn(w).length > 0;
  const mine = (gid: string, w: number) => checkIns.filter((c) => c.goalId === gid && c.week === w && c.authorId === personId);
  const onTime = (w: number) => due(w) && dueIn(w).every((x) => mine(x.g.id, w).some((c) => inByDueDay(c, cycle, w)));
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
  const complete = dueIn(week).every((x) => checkIns.some((c) => c.goalId === x.g.id && c.week === week));
  const out = { weeks: 0, forgiven: [] as { week: number; missed: boolean }[] };
  for (let w = complete && due(week) ? week : week - 1; w >= 1 && due(w); w--) {
    if (onTime(w)) out.weeks++;
    // Missed: some goal due that week has no check-in of theirs posted in its week at all.
    else if (forgiven(w)) out.forgiven.push({ week: w, missed: dueIn(w).some((x) => !mine(x.g.id, w).some((c) => !c.backfilled)) });
    else break;
  }
  return out;
}

/** What the week's receipt reads (habit spec 2.1): the person's goals this week, how many of their first check-ins came
    after the due day, the deadline in dueWords' words (`words`: "before Thursday’s review" only for someone in a review
    held that day with Reviews on, deep review T4; otherwise "by Thursday", Reviews switch spec 2.1), the run and its
    forgiven week, and the next due day already in words ("Thursday 19 Nov"; null in the year's last week). */
export interface ReceiptFacts {
  total: number;
  after: number;
  week: number;
  words: Pick<DueWords, 'by' | 'after'>;
  run: number;
  forgiven: number | null;
  /** The forgiven week had no check-in of theirs in it at all (missed), rather than one after the due day (late). */
  forgivenMissed?: boolean;
  nextDue: string | null;
}

/**
 * The receipt's facts for a person's week (habit spec 2.1), from the rules that already say each: weekProgress (`p`) for
 * their goals, reviewDate for the due day, the run. A goal's week counts as after when its first check-in that week
 * (theirs, or someone's checking in for them) was posted after the due day. `words` is dueWords' for the person and
 * week (app/reads dueWordsHere): the habit never reads a review itself (Reviews switch spec 4).
 * `nextDue` is the next due day as an ISO date: the caller says it in words before `receiptText`.
 */
export function receiptFacts(p: WeekProgress, personId: string, s: { goals: readonly Goal[]; checkIns: readonly CheckIn[] }, cycle: Cycle, week: number, words: Pick<DueWords, 'by' | 'after'>): ReceiptFacts {
  const after = p.goals.filter((g) => {
    const first = s.checkIns.filter((c) => c.goalId === g.id && c.week === week && !c.removedAt).map((c) => c.postedAt).sort()[0];
    return first != null && !inByDueDay({ postedAt: first }, cycle, week);
  }).length;
  const run = onTimeRun(personId, s.goals, s.checkIns, cycle, week);
  return { total: p.goals.length, after, week, words: { by: words.by, after: words.after }, run: run.weeks, forgiven: run.forgiven[0]?.week ?? null, forgivenMissed: run.forgiven[0]?.missed ?? false, nextDue: week < cycle.weeks ? reviewDate(cycle, week + 1) : null };
}

/**
 * The receipt's two sentences, once every check-in of the week is in (habit spec 2.1; HB1). Read by the check-in's last
 * screen and by Home's quiet line on the day the week is completed. A late week is never called lost or broken, and no run
 * is mentioned beside one. The deadline is dueWords' (rule RS1): "in before Thursday’s review" / "in by Thursday", and
 * "came after Thursday’s review" / "came after Thursday" (Reviews switch spec 2.1).
 */
export function receiptText(r: ReceiptFacts): { first: string; second: string | null } {
  const yours = r.total === 1 ? 'Your check-in is' : r.total === 2 ? 'Both of your check-ins are' : `All ${r.total} of your check-ins are`;
  const next = r.nextDue ? `The next ${r.total === 1 ? 'is' : 'are'} due by ${r.nextDue}.` : null;
  if (r.after > 0) {
    const who = r.total === 1 ? 'It' : r.after === r.total ? (r.total === 2 ? 'Both' : 'All of them') : r.after === 1 ? 'One' : String(r.after);
    return { first: `${yours} in. ${who} came ${r.words.after}.`, second: next };
  }
  const first = `${yours} in ${r.words.by}.`;
  const run = r.run >= 2 ? `That is ${r.run} weeks in a row.` : null;
  // Said once: on the first receipt after the forgiven week.
  const kept = r.forgiven != null && r.forgiven === r.week - 1 && r.run >= 2 ? (r.forgivenMissed ? `Week ${r.forgiven} was missed; one missed week doesn’t break a run.` : `Week ${r.forgiven} came in late; one late week doesn’t break a run.`) : null;
  return { first, second: [run, kept].filter(Boolean).join(' ') || null };
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
