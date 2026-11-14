/* The check-in rhythm in words (FT1, docs/design/feature-toggles/spec.md 4.1–4.3): the Features row, the line on
   Cycles, the Change sheet's read-back and the toast. Pure. Its rules (rhythmReadBack, checkInList) live here, not in status.ts and progress.ts, so the first download
   doesn't carry them: only Features, Check-in and the AI tools use them. */
import { dayText } from './format';
import { firstWeekFrom } from './plan';
import { reviewDate, WEEKDAY } from './progress';
import { goalStatus } from './status';
import { NotAllowed, type ActionContext } from './actions';
import { cycleState } from './cycle';
import type { Commit } from './commit';
import { rhythmOf, staleAfterDays } from './thresholds';
import type { CheckIn, Cycle, DisplayStatus, Goal, Person } from './types';
import { LABEL, STATUS } from './vocabulary';
import { STATUS_OPTIONS, type QStatus } from './query';

/** A rhythm to choose: every week by a weekday, or none. */
export interface RhythmChoice { weeks: number; dueDay: number }

export const rhythmChoiceOf = (cycle: Cycle): RhythmChoice => ({ weeks: rhythmOf(cycle) ? 1 : 0, dueDay: cycle.reviewDay });

/** Features' row (4.1). */
export function rhythmLine(cycle: Cycle): string {
  const r = rhythmOf(cycle);
  if (!r) return 'No set rhythm. Owners check in when there’s news; nothing is due or late for want of a check-in.';
  return `Every week, due by ${WEEKDAY[r.dueDay]}. A goal with no check-in for ${staleAfterDays(cycle)} days reads “${STATUS.stale.label}”.`;
}

/** The running cycle's line on Cycles (4.3), and the fact line for everyone (1.3). */
export function rhythmFact(cycle: Cycle): string {
  const r = rhythmOf(cycle);
  return r ? `Check-ins: every week, due by ${WEEKDAY[r.dueDay]}.` : 'Check-ins: no set rhythm.';
}

/** About's fact line starts with it (4.1): "Check-ins every week, due by Thursday." */
export function rhythmAbout(cycle: Cycle): string {
  const r = rhythmOf(cycle);
  return r ? `Check-ins every week, due by ${WEEKDAY[r.dueDay]}.` : 'Check-ins have no set rhythm.';
}

/** A read-back line: a strong start and the rest. */
export interface ReadBackLine { strong: string; rest: string }

const listStatuses = (by: Partial<Record<DisplayStatus, number>>) =>
  (['on', 'risk', 'off', 'none'] as DisplayStatus[]).filter((k) => by[k]).map((k) => (k === 'none' ? `${by[k]} with no check-in yet` : `${by[k]} ${LABEL[k].toLowerCase()}`)).join(', ');

/** What changes for everyone (4.2), once the choice differs from what is saved; [] when it doesn't. */
export function rhythmReadBackLines(cycle: Cycle, to: RhythmChoice, counts: RhythmReadBack, today: Date): ReadBackLine[] {
  const was = rhythmChoiceOf(cycle);
  if (was.weeks === to.weeks && (to.weeks === 0 || was.dueDay === to.dueDay)) return [];
  const day = WEEKDAY[to.dueDay]!;
  if (to.weeks === 0) {
    const n = counts.live;
    return [
      { strong: `${n} ${n === 1 ? 'goal has' : 'goals have'} nothing due.`, rest: ' Home and Check-in stop counting what’s due, and on-time streaks stop.' },
      ...(counts.unstale ? [{ strong: `${counts.unstale} ${counts.unstale === 1 ? 'goal stops' : 'goals stop'} reading “${STATUS.stale.label}”.`, rest: ` Each shows its last check-in’s status and the week it is from: ${listStatuses(counts.unstaleBy)}.` }] : []),
      { strong: 'Nothing is flagged for going quiet.', rest: ' Goals’ “Last check-in” filter still finds them.' },
      { strong: '', rest: 'Dates people chose stay: stage dates, next steps’ weeks and “back on plan by”.' },
      { strong: '', rest: 'Every check-in already posted stays as it is.' },
    ];
  }
  if (was.weeks === 0) {
    const after: Cycle = { ...cycle, checkInWeeks: 1, reviewDay: to.dueDay };
    const first = reviewDate(after, firstWeekFrom(after, today.toISOString(), to.dueDay));
    return [
      { strong: `Check-ins are due by ${day}`, rest: `, the first by ${dayText(first)}.` },
      { strong: 'Nothing is late today.', rest: ` A goal reads “${STATUS.stale.label}” after ${staleAfterDays(after)} days without a check-in, counted from today.` },
      { strong: '', rest: 'Streaks start from this week.' },
    ];
  }
  return [{ strong: '', rest: `Check-ins are due by ${day} from this week. Streaks count the new day from this week.` }];
}

/** The toast after saving (4.2). */
export function rhythmToast(cycle: Cycle, to: RhythmChoice): string {
  if (to.weeks === 0) return 'Check-ins have no set rhythm now.';
  return rhythmOf(cycle) ? `Check-ins are due by ${WEEKDAY[to.dueDay]} now.` : `Check-ins are due every week, by ${WEEKDAY[to.dueDay]}.`;
}

/** What changing the check-in rhythm would do, counted (FT1, spec 4.2's read-back): the live goals (not done, stopped,
    removed or proposed), how many read No recent update now and would not after (`unstale`, by the status each would
    show then: `none` is "no check-in yet"), and how many would read it after that don't now (`stale`, 0 when a rhythm is
    switched on: it counts from today). */
export interface RhythmReadBack {
  live: number;
  unstale: number;
  unstaleBy: Partial<Record<DisplayStatus, number>>;
  stale: number;
}

export function rhythmReadBack(goals: readonly Goal[], checkIns: CheckIn[], cycle: Cycle, to: { weeks: number; dueDay?: number }, today: Date): RhythmReadBack {
  const after: Cycle = { ...cycle, checkInWeeks: to.weeks, reviewDay: to.weeks > 0 ? to.dueDay ?? cycle.reviewDay : cycle.reviewDay,
    ...((cycle.checkInWeeks ?? 1) === 0 && to.weeks > 0 ? { rhythmFrom: today.toISOString().slice(0, 10) } : {}) };
  const out: RhythmReadBack = { live: 0, unstale: 0, unstaleBy: {}, stale: 0 };
  for (const g of goals) {
    if (g.stoppedAt || g.removedAt || g.proposedAt) continue;
    const now = goalStatus(g, cycle, checkIns, today).status;
    if (now === 'done') continue;
    out.live++;
    const then = goalStatus(g, after, checkIns, today).status;
    if (now === 'stale' && then !== 'stale') { out.unstale++; out.unstaleBy[then] = (out.unstaleBy[then] ?? 0) + 1; }
    if (now !== 'stale' && then === 'stale') out.stale++;
  }
  return out;
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

/** The check-in rhythm in words, as the change log and the read-back say it: "every week" or "no set rhythm" (FT1). */
export const rhythmWords = (c: Pick<Cycle, 'checkInWeeks'>) => ((c.checkInWeeks ?? 1) === 0 ? 'no set rhythm' : 'every week');

/**
 * Admins: the workspace's check-in rhythm (FT1, spec 1.1): every week, due by a weekday, or no set rhythm. Kept on the
 * running cycle. Going from none to some starts the rhythm today (`rhythmFrom`), so nothing is late on the day it is
 * switched on; changing only the due day doesn't restart it. Null when nothing changed.
 */
const no = (msg: string): never => { throw new NotAllowed(msg); };

export function setRhythm(x: ActionContext, cycle: Cycle, to: { weeks: number; dueDay?: number; /** Undo only: the rhythm's start as it was (null: the cycle's). */ from?: string | null }): Commit | null {
  if (!x.actor.admin) no('Only admins can change the check-in rhythm.');
  if (to.weeks !== 0 && to.weeks !== 1) no('Faro checks in every week, or on no set rhythm.');
  if (to.weeks > 0 && to.dueDay != null && !(Number.isInteger(to.dueDay) && to.dueDay >= 0 && to.dueDay <= 6)) no('Choose a day of the week.');
  if (cycleState(cycle, new Date(x.now)) !== 'running' && cycleState(cycle, new Date(x.now)) !== 'ending') no('That year is over; its rhythm can’t change.');
  const was = cycle.checkInWeeks ?? 1;
  const dueDay = to.weeks > 0 ? to.dueDay ?? cycle.reviewDay : cycle.reviewDay;
  if (was === to.weeks && dueDay === cycle.reviewDay) return null;
  // The rhythm is carried explicitly, so the saved row says it (data/rows.ts writes both columns then).
  const after: Cycle = { ...cycle, reviewDay: dueDay, checkInWeeks: to.weeks };
  if (to.from !== undefined) {
    if (to.from) after.rhythmFrom = to.from;
    else delete after.rhythmFrom;
  } else if (was === 0 && to.weeks > 0) after.rhythmFrom = x.now.slice(0, 10);
  const day = (d: number) => WEEKDAY[d]!;
  const said = (c: Cycle) => ((c.checkInWeeks ?? 1) === 0 ? 'no set rhythm' : `every week, due by ${day(c.reviewDay)}`);
  const summary = was === to.weeks
    ? `Changed the day check-ins are due by from ${day(cycle.reviewDay)} to ${day(dueDay)}`
    : to.weeks === 0 ? 'Changed the check-in rhythm from every week to no set rhythm' : `Changed the check-in rhythm from no set rhythm to every week, due by ${day(dueDay)}`;
  return {
    cycles: [after],
    changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'workspace', entityId: cycle.id, action: 'edited', summary,
      diffs: [{ field: 'Check-in rhythm', from: said(cycle), to: said(after) }] }],
  };
}

/** The statuses a cycle's goals can have, to filter by: without No recent update when there is no set rhythm (FT1). */
export const statusOptions = (cycle: Cycle): [QStatus, string][] => (rhythmOf(cycle) ? STATUS_OPTIONS : STATUS_OPTIONS.filter(([k]) => k !== 'stale'));
/** What the filter line says when a link asks for No recent update and there is no set rhythm (FT1, spec 2.6). */
export const NO_STALE_HERE = `${STATUS.stale.label} isn’t used here: there is no set check-in rhythm.`;

/**
 * Whether the viewer may ask the owner for an update (FT1, spec 2.5): not the owner, the goal live, its latest check-in
 * not this week's, and no update ask open. With a rhythm the page offers it as the primary action once the goal has no
 * recent update; with no set rhythm, as an ordinary button whenever this says yes. Here, not in goalPage.ts, so the
 * first download doesn't carry it.
 */
export function canAskUpdate(o: { goal: Goal; viewer: Pick<Person, 'id'>; status: DisplayStatus; latestWeek: number | null; week: number; updateAsked: boolean }): boolean {
  return o.viewer.id !== o.goal.ownerId && !o.goal.stoppedAt && !o.goal.proposedAt && o.status !== 'done' && o.latestWeek !== o.week && !o.updateAsked;
}
