/* Closing a cycle: which cycle is current, the retro on each goal, and starting the next cycle
   with the goals that carry on. */
import { lastKey } from './goalKey';
import { requestsFromCheckIns } from './asks';
import { isYear, yearWeeks } from './year';
import { yearName } from './yearName';
import { assessMilestone, checkInsFor, goalStatus } from './status';
import type { CheckIn, Cycle, Goal, Retro, Snapshot } from './types';

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

/**
 * The cycle the app shows: the latest one that has started, or starts within the week
 * (so a cycle set up at the end of the last one opens straight away, in its baseline week).
 */
export function currentCycle(cycles: Cycle[], today: Date): Cycle | undefined {
  const soon = new Date(today.getTime() + 7 * DAY).toISOString().slice(0, 10);
  // A deleted cycle is never current (domain/removal); one that's all there is still opens, rather than nothing.
  const kept = cycles.filter((c) => !c.removedAt);
  const sorted = [...(kept.length ? kept : cycles)].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return [...sorted].reverse().find((c) => c.startDate <= soon) ?? sorted[0];
}

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

/** From the last two weeks of a cycle, owners wrap up their goals. */
export const wrapUpOpen = (cycle: Cycle, week: number) => week >= cycle.weeks - 1;

/** A first guess at how a goal landed, from its status at the end. The owner confirms or changes it. */
export function suggestedResult(goal: Goal, cycle: Cycle, checkIns: CheckIn[], today: Date): Retro['result'] {
  const st = goalStatus(goal, cycle, checkIns, today).status;
  if (st === 'done' || st === 'on') return 'hit';
  if (st === 'risk') return 'partly';
  return 'missed';
}

export const RESULT_LABEL: Record<Retro['result'], string> = { hit: 'Hit it', partly: 'Partly', missed: 'Missed' };

/** "Jan–Mar 2027" for a cycle starting on a date and running some weeks. */
export function cycleName(startDate: string, weeks: number): string {
  const a = new Date(startDate + 'T00:00:00Z');
  const b = new Date(Date.parse(startDate + 'T00:00:00Z') + (weeks * 7 - 1) * DAY);
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const y = (d: Date) => d.getUTCFullYear();
  return y(a) === y(b) ? `${m(a)}–${m(b)} ${y(b)}` : `${m(a)} ${y(a)}–${m(b)} ${y(b)}`;
}

/**
 * The next cycle, straight after this one, and copies of the goals that carry on. A carried metric
 * starts from its last number; a carried milestone keeps the stages not yet done, spread over the
 * new cycle. Links between carried goals are kept; a link to a goal that stops is dropped.
 */
export function nextCycle(old: Cycle, goals: Goal[], checkIns: CheckIn[], retros: Retro[], ids: { cycle: string; goal: (old: Goal) => string }, now: string): { cycle: Cycle; goals: Goal[] } {
  // The next goal year's week 0 is this year's last week; its own length (52 or 53 weeks) follows the calendar.
  const startDate = addDays(old.startDate, old.weeks * 7);
  const weeks = isYear(old) ? yearWeeks(startDate) : old.weeks;
  const cycle: Cycle = { ...old, id: ids.cycle, startDate, weeks, name: isYear(old) ? yearName(startDate, weeks) : cycleName(startDate, weeks) };
  const carried = goals.filter((g) => g.cycleId === old.id && (retros.find((r) => r.goalId === g.id)?.next ?? 'carry') === 'carry');
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
