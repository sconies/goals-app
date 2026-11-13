/* The habit moment (docs/design/round-4/habit/spec.md; HB1–HB3). Core, not a module: rules over check-ins, read by the
   check-in's receipt, a goal's History, a review and Home. Its words follow the reviews switch through a flag, as
   readBack.ts takes `reviewsOn`; nothing here imports a review module or names a person.

   Its own file so it loads with the screens that read it: Home is in the first download and must not import it (spec 9).
   The run and the receipt's sentences are progress.ts's (`onTimeStreak`, `forgivenIn`, `receiptText`). */
import { fmt } from './format';
import { checkInStanding, dueIn, type HabitRows, type Standing } from './standing';
import { reviewDate } from './progress';
import type { CheckIn, Cycle, Goal } from './types';

export { checkInStanding, dueIn, type HabitRows, type Standing };

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
  // Never on a second check-in in the same week: the rule's, not only the screen's (#410 review).
  if (earlier.some((c) => c.id !== after.id && c.goalId === after.goalId && c.week === after.week && !c.removedAt)) return null;
  // The week before's word on the goal: each earlier week's last check-in, newest first.
  const byWeek = new Map<number, CheckIn>();
  for (const c of [...earlier].sort((a, b) => a.week - b.week || a.postedAt.localeCompare(b.postedAt))) if (c.week < after.week && !c.removedAt) byWeek.set(c.week, c);
  const prior = [...byWeek.values()].sort((a, b) => b.week - a.week);
  const before = prior[0];
  if (after.value != null && meets(goal, after.value) && !(before?.value != null && meets(goal, before.value))) return { kind: 'reached', behind: 0 };
  if (after.status !== 'on' || !before || (before.status !== 'risk' && before.status !== 'off')) return null;
  // Weeks behind, not check-ins: from the first week of the unbroken behind stretch to this one (#410 review).
  let from = after.week;
  for (const c of prior) { if (c.status !== 'risk' && c.status !== 'off') break; from = c.week; }
  const behind = after.week - from;
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

/* ---------- rules 1, 2 and 4: the measure (HB2) ---------- */

/** Rule 2's counts for a set of goals in a week. */
export interface HabitCounts { due: number; inTime: number; unasked: number; asked: number; after: number; none: number }

/**
 * Rule 2: rule 1 over the goals due that week. `inTime = unasked + asked`; the measure is `unasked / due`. `isDue` is the
 * caller's (live, not proposed, first due by then), so a rule here never decides who is due.
 */
export function habit(goals: readonly Goal[], week: number, rows: HabitRows, dueDay: string, isDue: (g: Goal, week: number) => boolean): HabitCounts & { goals: Record<Standing, string[]> } {
  const out = { due: 0, inTime: 0, unasked: 0, asked: 0, after: 0, none: 0, goals: { unasked: [], asked: [], after: [], none: [] } as Record<Standing, string[]> };
  for (const g of goals) {
    if (!isDue(g, week)) continue;
    const st = checkInStanding(g, week, rows, dueDay);
    out.due++;
    out[st]++;
    out.goals[st].push(g.id);
  }
  out.inTime = out.unasked + out.asked;
  return out;
}

/** One week in the row of weeks (spec 2.3): `all` in by the due day, `some` (and how many weren't), `none`, or nothing due. */
export interface HabitWeek { week: number; mark: 'all' | 'some' | 'none' | 'nothing-due'; late: number }

/** Rule 2's row of weeks: the `n` weeks up to `to`, oldest first. `dueDay(w)` is the week's review day. */
export function habitWeeks(goals: readonly Goal[], to: number, rows: HabitRows, dueDay: (w: number) => string, isDue: (g: Goal, week: number) => boolean, n = 8): HabitWeek[] {
  const out: HabitWeek[] = [];
  for (let w = Math.max(1, to - n + 1); w <= to; w++) {
    const h = habit(goals, w, rows, dueDay(w), isDue);
    const late = h.after + h.none;
    out.push({ week: w, late, mark: !h.due ? 'nothing-due' : !late ? 'all' : h.inTime ? 'some' : 'none' });
  }
  return out;
}

/** The words beside each mark in the row of weeks. */
export function weekWords(x: HabitWeek): string {
  return x.mark === 'all' ? 'All in' : x.mark === 'some' ? `${x.late} after` : x.mark === 'none' ? 'None in' : 'Nothing due';
}

/** Fewer owners than this and a set's measure is never shown (rule 4). */
export const MIN_OWNERS = 3;

/** Rule 4, never a person: false when the set's goals have fewer than three owners, unless the viewer owns all of them. */
export function habitShown(goals: readonly Pick<Goal, 'ownerId'>[], viewerId: string): boolean {
  const owners = new Set(goals.map((g) => g.ownerId));
  if (!owners.size) return false;
  return owners.size >= MIN_OWNERS || (owners.size === 1 && owners.has(viewerId));
}

/** Rule 2's sentences for "Before this review" (spec 2.3): the heading, in the past once the due day has passed. With
    Reviews off (`reviews` false, the flag readBack.ts takes) the due day is a deadline, so the words are RS1's "on
    time, without being asked". */
export function beforeReviewText(h: HabitCounts, past: boolean, reviews = true): string {
  const by = reviews ? 'before it' : 'on time';
  if (!past) return `${h.inTime} of ${h.due} ${h.due === 1 ? 'goal is' : 'goals are'} checked in so far.`;
  if (!h.inTime) return h.due === 1 ? `Its one goal wasn’t checked in ${by}.` : `None of the ${h.due} goals was checked in ${by}.`;
  if (h.inTime === h.due && h.unasked === h.due) return h.due === 1 ? `Its one goal was checked in ${by}, without anyone asking.` : `All ${h.due} goals were checked in ${by}, without anyone asking.`;
  return `${h.inTime} of ${h.due} goals were checked in ${by}, ${h.unasked === h.inTime ? 'all without being asked' : `${h.unasked} without being asked`}.`;
}

/** What "Before this review" says for a set of goals in a week (spec 2.3), as the review's page, a team's page and
    `get_review` all read it; null when rule 4 hides it or nothing was due. `past`: the due day has gone by. */
export interface BeforeReview { counts: HabitCounts; past: boolean; says: string; weeks: HabitWeek[] }

export function beforeReview(goals: readonly Goal[], week: number, rows: HabitRows, cycle: Cycle, today: Date, viewerId: string, reviews = true): BeforeReview | null {
  if (week < 1 || !habitShown(goals, viewerId)) return null;
  const isDue = dueIn(cycle, rows.checkIns);
  const dueDay = reviewDate(cycle, week);
  const h = habit(goals, week, rows, dueDay, isDue);
  if (!h.due) return null;
  const past = today.toISOString().slice(0, 10) > dueDay;
  const { goals: _ids, ...counts } = h;
  return { counts, past, says: beforeReviewText(h, past, reviews), weeks: habitWeeks(goals, past ? week : week - 1, rows, (w) => reviewDate(cycle, w), isDue) };
}
