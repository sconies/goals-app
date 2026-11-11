/* Closing a cycle: which cycle is current, the retro on each goal, and starting the next cycle
   with the goals that carry on. */
import { labels, OWNER_VIEW } from './vocabulary';
import { lastKey } from './goalKey';
import { requestsFromCheckIns } from './asks';
import { isYear, periodLabel, quarterOf, yearWeeks } from './year';
import { currentWeek, hasEnded } from './plan';
import { RULES } from './thresholds';
import { carries, carryKind } from './carry';
import { yearName } from './yearName';
import { assessMilestone, checkInsFor, goalStatus } from './status';
import type { CheckIn, Cycle, Goal, Retro, Snapshot } from './types';

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

/**
 * The cycle the app shows (cycle-end rule 3): of the cycles not removed, the latest whose week 1 has begun; if none has,
 * the earliest. So a next year set up during the wrap-up opens for everyone on its week 1's Monday, never earlier, and
 * a year nobody follows with another stays current after it ends. A new workspace's only cycle is current from day one,
 * in its week 0.
 */
export function currentCycle(cycles: Cycle[], today: Date): Cycle | undefined {
  const day = today.toISOString().slice(0, 10);
  // A deleted cycle is never current (domain/removal); one that's all there is still opens, rather than nothing.
  const kept = cycles.filter((c) => !c.removedAt);
  const sorted = [...(kept.length ? kept : cycles)].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return [...sorted].reverse().find((c) => addDays(c.startDate, 7) <= day) ?? sorted[0];
}

/** The cycle after this one, if one has been started (not removed). */
export const laterCycle = (cycles: Cycle[], c: Cycle) => cycles.filter((v) => !v.removedAt && v.startDate > c.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

/**
 * Only what belongs to one cycle, and only what's live: the one place removed and archived records leave the lists,
 * stats, pickers, attention lists and reviews (domain/removal says what each removal does). Deleted records (goals,
 * check-ins, notes, reviews, cycles, watches, views, people with no history) are left out altogether. Stopped goals,
 * with their check-ins and notes, people who left and ended reviews move to `archive`, so a goal's page, its history,
 * the exports and Activity can still show them.
 */
export function scopeToCycle(s: Snapshot, cycle: Cycle): Snapshot {
  const inCycle = s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt);
  const goals = inCycle.filter((g) => !g.stoppedAt);
  const stopped = inCycle.filter((g) => g.stoppedAt);
  const ids = new Set(goals.map((g) => g.id));
  const stoppedIds = new Set(stopped.map((g) => g.id));
  const checkIns = s.checkIns.filter((c) => !c.removedAt);
  const decisions = s.decisions.filter((d) => !d.removedAt);
  const people = s.people.filter((p) => !p.leftAt && !p.removedAt);
  const here = new Set(people.map((p) => p.id));
  const reviews = (s.reviews ?? []).filter((r) => !r.removedAt);
  return {
    ...s,
    people,
    cycles: s.cycles.filter((c) => !c.removedAt),
    goals,
    keysIssued: lastKey(s.goals, s.keysIssued),
    checkIns: checkIns.filter((c) => ids.has(c.goalId)),
    decisions: decisions.filter((d) => ids.has(d.goalId)),
    reviews: reviews.filter((r) => !r.endedAt),
    watches: (s.watches ?? []).filter((w) => !w.removedAt && here.has(w.personId)),
    views: (s.views ?? []).filter((v) => !v.deletedAt),
    // The metric library spans cycles: removed metrics leave it, and so do links to goals outside this cycle.
    ...(s.metrics ? { metrics: s.metrics.filter((m) => !m.removedAt) } : {}),
    ...(s.metricLinks ? { metricLinks: s.metricLinks.filter((l) => !l.removedAt && ids.has(l.goalId) && (s.metrics ?? []).some((m) => m.id === l.metricId && !m.removedAt)) } : {}),
    retros: (s.retros ?? []).filter((r) => r.cycleId === cycle.id),
    // Data from before requests existed: each goal's open request is read from its latest check-in.
    requests: (s.requests ?? requestsFromCheckIns({ ...s, goals }, (g) => checkInsFor(g, s.checkIns).at(-1) ?? null)).filter((r) => r.goalIds.some((id) => ids.has(id))),
    archive: {
      goals: stopped,
      checkIns: checkIns.filter((c) => stoppedIds.has(c.goalId)),
      decisions: decisions.filter((d) => stoppedIds.has(d.goalId)),
      people: s.people.filter((p) => p.leftAt && !p.removedAt),
      reviews: reviews.filter((r) => r.endedAt),
    },
  };
}

/** The whole workspace without deleted check-ins, notes, reviews or people: for the rules that read across cycles. */
export function withoutRemoved(s: Snapshot): Snapshot {
  return { ...s, checkIns: s.checkIns.filter((c) => !c.removedAt), decisions: s.decisions.filter((d) => !d.removedAt), reviews: (s.reviews ?? []).filter((r) => !r.removedAt && !r.endedAt), people: s.people.filter((p) => !p.removedAt) };
}

/**
 * A snapshot with one stopped goal put back among the live ones, with its check-ins and notes: what its own page and
 * print view read, so a stopped goal shows as it stood (marked Stopped) without coming back into any list.
 */
export function withArchivedGoal(s: Snapshot, goalId: string): Snapshot {
  const a = s.archive;
  const g = a?.goals.find((x) => x.id === goalId);
  if (!a || !g) return s;
  return { ...s, goals: [...s.goals, g], checkIns: [...s.checkIns, ...a.checkIns.filter((c) => c.goalId === goalId)], decisions: [...s.decisions, ...a.decisions.filter((d) => d.goalId === goalId)] };
}

/** A cycle's days, as ISO dates (cycle-end spec, rule 1). */
export interface CycleDates {
  /** Week 1's Monday: the first day anything is due. */
  firstDay: string;
  /** The last week's Sunday: the day the cycle ends, whether or not the next one is started. */
  lastDay: string;
  /** The Monday of the first week of the wrap-up (RULES.wrapUpWeeksBefore weeks before the end). */
  wrapUpOpens: string;
  /** The wrap-up's last day (RULES.wrapUpWeeksAfter weeks after the end). */
  wrapUpCloses: string;
}

/**
 * A cycle's real first and last days. Week 0 is the week before week 1 (for starting numbers); week n runs Monday to
 * Sunday from `startDate` + 7n days, so the last week ends `(weeks + 1) × 7 − 1` days after `startDate`. In the demo's
 * 2026 (from 22 Dec 2025, 53 weeks) that is Mon 29 Dec 2025 to Sun 3 Jan 2027.
 */
export function cycleDates(c: Pick<Cycle, 'startDate' | 'weeks'>): CycleDates {
  const lastDay = addDays(c.startDate, (c.weeks + 1) * 7 - 1);
  return {
    firstDay: addDays(c.startDate, 7),
    lastDay,
    wrapUpOpens: addDays(c.startDate, (c.weeks - RULES.wrapUpWeeksBefore + 1) * 7),
    wrapUpCloses: addDays(lastDay, RULES.wrapUpWeeksAfter * 7),
  };
}

/** Where a cycle stands on a day: not begun, running, in its wrap-up weeks, ended (the wrap-up still open) or closed. */
export type CycleState = 'before' | 'running' | 'ending' | 'ended' | 'closed';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Where a cycle stands today (rule 1): the clock, not a button, ends a cycle. Week 0 is still `before`. */
export function cycleState(c: Pick<Cycle, 'startDate' | 'weeks'>, today: Date): CycleState {
  const t = isoDay(today), d = cycleDates(c);
  if (t < d.firstDay) return 'before';
  if (t < d.wrapUpOpens) return 'running';
  if (t <= d.lastDay) return 'ending';
  if (t <= d.wrapUpCloses) return 'ended';
  return 'closed';
}

/** The wrap-up is open from the day it opens until the day it closes, four weeks after the cycle ends. */
export const wrapUpOpenOn = (c: Pick<Cycle, 'startDate' | 'weeks'>, today: Date) => ['ending', 'ended'].includes(cycleState(c, today));

/** The cycle whose wrap-up is open today (the later, if two), or nothing. */
export function wrapUpCycle(cycles: Cycle[], today: Date): Cycle | undefined {
  return cycles.filter((c) => !c.removedAt && wrapUpOpenOn(c, today)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/**
 * From the last two weeks of a cycle (RULES.wrapUpWeeksBefore), owners wrap up their goals: the week it opens, for
 * screens that count in weeks. Past the last week (`resultWeek` beyond `weeks`), it stays open; `wrapUpOpenOn` says
 * when it closes.
 */
export const wrapUpOpen = (cycle: Pick<Cycle, 'weeks'>, week: number) => week >= cycle.weeks - RULES.wrapUpWeeksBefore + 1;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sun 3 Jan 2027": a day with its weekday and year, as the year's end is said. */
export function dayWithYear(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The long place line (Goals, the wrap-up, Print): "Week 45 of 53 · Q4 (Oct–Dec) · 2026", or "2026 ended on Sun 3 Jan 2027" once its last day is past. */
export function periodNow(c: Cycle, today: Date): string {
  return hasEnded(c, today) ? `${c.name} ended on ${dayWithYear(cycleDates(c).lastDay)}` : periodLabel(c, currentWeek(c, today));
}

/**
 * The frame's place line (rule 1): "2026 · week 46 · Q4" while it runs; "2026 · week 53, the last week"; "2026 has
 * ended" once its last day is past and no later cycle has begun; "2027 starts Mon 4 Jan 2027" before its week 1. A
 * shorter cycle says "week 7 of 13" in place of the quarter.
 */
export function placeLine(c: Cycle, today: Date): string {
  const state = cycleState(c, today);
  if (state === 'before') return `${c.name} starts ${dayWithYear(cycleDates(c).firstDay)}`;
  if (state === 'ended' || state === 'closed') return `${c.name} has ended`;
  const w = Math.max(1, Math.min(c.weeks, Math.floor((Date.parse(isoDay(today) + 'T00:00:00Z') - Date.parse(c.startDate + 'T00:00:00Z')) / (7 * DAY))));
  if (w === c.weeks) return `${c.name} · week ${w}, the last week`;
  return isYear(c) ? `${c.name} · week ${w} · ${quarterOf(c, w).label}` : `${c.name} · week ${w} of ${c.weeks}`;
}

/**
 * Before a cycle's first week (cycle-end rule 4): its first day, how many days until it, and the first check-in's due
 * date (week 1's review day). Nothing otherwise. While it gives something, nothing is due and the screens say when the
 * cycle starts.
 */
export function beforeStart(c: Pick<Cycle, 'startDate' | 'weeks' | 'reviewDay'>, today: Date): { firstDay: string; days: number; firstDue: string } | null {
  const { firstDay } = cycleDates(c);
  const t = isoDay(today);
  if (t >= firstDay) return null;
  const days = Math.round((Date.parse(firstDay + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / DAY);
  return { firstDay, days, firstDue: addDays(firstDay, c.reviewDay) };
}

/** "2027 starts on Mon 4 Jan 2027, in 2 weeks. Nothing is due until then." (cycle-end 2.10), with the first check-ins' date when asked. */
export function beforeStartLine(c: Cycle, today: Date, withDue = false): string | null {
  const b = beforeStart(c, today);
  if (!b) return null;
  const when = b.days < 7 ? 'on Monday' : b.days < 14 ? 'next week' : `in ${Math.floor(b.days / 7)} weeks`;
  return `${c.name} starts on ${dayWithYear(b.firstDay)}, ${when}. Nothing is due until then.${withDue ? ` Your first check-ins are due ${dayWithYear(b.firstDue)}.` : ''}`;
}

/** A first guess at how a goal landed, from its status at the end. The owner confirms or changes it. */
export function suggestedResult(goal: Goal, cycle: Cycle, checkIns: CheckIn[], today: Date): Retro['result'] {
  const st = goalStatus(goal, cycle, checkIns, today).status;
  if (st === 'done' || st === 'on') return 'hit';
  if (st === 'risk') return 'partly';
  return 'missed';
}

/** The owner's own words at the wrap-up (the vocabulary's OWNER_VIEW): shown as their view, never as the result. */
export const RESULT_LABEL: Record<Retro['result'], string> = labels(OWNER_VIEW);

/** "Jan–Mar 2027" for a cycle starting on a date and running some weeks. */
export function cycleName(startDate: string, weeks: number): string {
  const a = new Date(startDate + 'T00:00:00Z');
  const b = new Date(Date.parse(startDate + 'T00:00:00Z') + (weeks * 7 - 1) * DAY);
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const y = (d: Date) => d.getUTCFullYear();
  return y(a) === y(b) ? `${m(a)}–${m(b)} ${y(b)}` : `${m(a)} ${y(a)}–${m(b)} ${y(b)}`;
}

/** The next cycle's start, length and name: its week 0 is this one's last week; a goal year's length (52 or 53 weeks) follows the calendar. */
export function nextCycleShape(old: Pick<Cycle, 'startDate' | 'weeks'>): { startDate: string; weeks: number; name: string } {
  const startDate = addDays(old.startDate, old.weeks * 7);
  const weeks = isYear(old as Cycle) ? yearWeeks(startDate) : old.weeks;
  return { startDate, weeks, name: isYear(old as Cycle) ? yearName(startDate, weeks) : cycleName(startDate, weeks) };
}

/**
 * The next cycle, straight after this one, and copies of the goals that carry on. A carried metric
 * starts from its last number; a carried milestone keeps the stages not yet done, spread over the
 * new cycle. Links between carried goals are kept; a link to a goal that stops is dropped.
 */
export function nextCycle(old: Cycle, goals: Goal[], checkIns: CheckIn[], retros: Retro[], ids: { cycle: string; goal: (old: Goal) => string }, now: string): { cycle: Cycle; goals: Goal[] } {
  const cycle: Cycle = { ...old, id: ids.cycle, ...nextCycleShape(old) };
  // Which goals go on is one rule (domain/carry carryKind): carry on or keep their plan; a goal that met its target
  // finishes, and one its owner stopped at the wrap-up stops. The read-back before starting counts the same.
  const carried = goals.filter((g) => g.cycleId === old.id && carries(carryKind(g, { cycle: old, checkIns, retro: retros.find((r) => r.goalId === g.id && r.cycleId === old.id) ?? null }).kind));
  const map = new Map(carried.map((g) => [g.id, ids.goal(g)]));
  const out = carried.map((g): Goal => {
    const base = { ...g, id: map.get(g.id)!, cycleId: cycle.id, parentId: g.parentId ? map.get(g.parentId) ?? null : null, createdAt: now, pending: null };
    if (!base.parentId) base.effect = null;
    if (g.kind === 'metric' && (g.plan.endWeek ?? 0) > old.weeks) {
      // A goal that runs past this cycle keeps its plan; its weeks are now counted from the new cycle's start.
      const shift = (w: number) => w - old.weeks;
      const plan = { ...g.plan, fromWeek: shift(g.plan.fromWeek ?? 0), endWeek: shift(g.plan.endWeek!), ...(g.plan.points ? { points: g.plan.points.map((p) => ({ ...p, week: shift(p.week) })) } : {}) };
      return { ...base, kind: 'metric', plan, originalPlan: null, rebaselinedWeek: null } as Goal;
    }
    if (g.kind === 'metric') {
      const own = checkInsFor(g, checkIns).filter((c) => c.value != null);
      const last = own[own.length - 1]?.value ?? g.plan.start;
      return { ...base, kind: 'metric', plan: { ...g.plan, start: last }, originalPlan: null, rebaselinedWeek: null } as Goal;
    }
    if (g.kind === 'milestone') {
      const own = checkInsFor(g, checkIns).filter((c) => c.stages);
      const last = own[own.length - 1];
      const a = assessMilestone(g, old.weeks, last?.stages ?? null);
      const left = g.stages.filter((_, i) => a.stages[i]?.kind !== 'done');
      const stages = (left.length ? left : g.stages).map((st, i, arr) => ({ ...st, id: st.id + '-' + cycle.id, dueWeek: Math.max(1, Math.round(((i + 1) * old.weeks) / arr.length)) }));
      return { ...base, kind: 'milestone', stages } as Goal;
    }
    return base as Goal;
  });
  return { cycle, goals: out };
}
