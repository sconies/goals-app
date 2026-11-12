/* Reads (docs/design/architecture.md, 4.4: AR4): the one place that turns the loaded workspace into what each rule
   reads. New rules in src/domain take only these rows, never the whole workspace (the layers lint checks it), so the
   internal app can hand them the same shapes from its query port instead of a loaded workspace. */
import type { GoalRows, PersonRows, TeamRows } from '../domain/find';
import { creatorOf, type DayOneRows } from '../domain/dayOne';
import { summariseAll } from '../domain/summary';
import { scopeToCycle, wrapUpCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import type { Cycle, Person, Snapshot } from '../domain/types';
import type { ScopeFacts } from '../domain/goalsPage';
import { agendaOf, nextSessionWeek, reviewSession, sessionDate, sessionPlan, sessionState, walkOrder, watchedGoals } from '../domain/review';
import type { HomeFacts, HomeSession } from '../domain/home';
import { onTimeStreak, reviewDate, weekProgress } from '../domain/progress';
import { hasEnded } from '../domain/plan';
import { beforeStart, cycleDates, wrapUpOpenOn } from '../domain/cycle';
import { openForPerson } from '../domain/asks';
import type { QueryContext } from '../domain/query';
import type { LocalRows } from '../adapters/localSearch';

const live = <T extends { removedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.removedAt);

/** Every goal's summary row, with what the Goals filters need beyond it. */
export function goalRows(s: Snapshot, cycle: Cycle, today: Date, week: number, columns?: QueryContext['columns']): GoalRows {
  const goals = live(s.goals).filter((g) => !g.stoppedAt);
  return { kind: 'goal', summaries: summariseAll(goals, s, cycle, today, week), ctx: { goals, cycle, week, ...(columns ? { columns } : {}) } };
}

export function personRows(s: Snapshot): PersonRows {
  const teams = new Map(s.teams.map((t) => [t.id, t]));
  return { kind: 'person', people: live(s.people), teamName: (id) => teams.get(id)?.name ?? '', teamLead: (id) => teams.get(id)?.leadId ?? null };
}

export function teamRows(s: Snapshot): TeamRows {
  return { kind: 'team', teams: s.teams, people: live(s.people) };
}

/** The rows the browser's Search answers from, each made once per workspace as loaded and only when first asked. */
export function searchRows(s: Snapshot, cycle: Cycle, today: Date, week: number, columns?: QueryContext['columns']): LocalRows {
  const once = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); };
  return { goal: once(() => goalRows(s, cycle, today, week, columns)), person: once(() => personRows(s)), team: once(() => teamRows(s)) };
}

/** What the Goals scopes read (goals spec, rule 1) for one person: the running cycle's goals (not stopped), their team
    and the teams they lead, and the goals they watch. Goals' screen and find_goals read the same facts. */
export function scopeFacts(s: Snapshot, viewer: Pick<Person, 'id' | 'teamId'>): ScopeFacts {
  return {
    goals: live(s.goals).filter((g) => !g.stoppedAt).map((g) => ({ id: g.id, ownerId: g.ownerId, teamId: g.teamId })),
    viewerId: viewer.id,
    teams: s.teams.filter((t) => t.id === viewer.teamId || t.leadId === viewer.id).map((t) => ({ id: t.id, name: t.name })),
    watched: new Set(watchedGoals(viewer.id, s).map((g) => g.id)),
  };
}

/** What Home's "Getting started" reads (domain/dayOne.ts): who set it up, people, goals, which goals have a check-in
    and who watches anything. */
export function dayOneRows(s: Pick<Snapshot, 'people' | 'goals' | 'checkIns' | 'watches' | 'changes'>): DayOneRows {
  return {
    creatorId: creatorOf(s.changes, s.people),
    people: s.people,
    goals: s.goals,
    checkedIn: new Set(live(s.checkIns).map((c) => c.goalId)),
    watchers: new Set(live(s.watches ?? []).map((w) => w.personId)),
  };
}

/**
 * Home's facts (docs/design/home/spec.md rule 1): what the lead and the quiet line read, from the rules that already
 * say each thing (weekProgress, onTimeStreak, reviewSession, the wrap-up's dates). `draft` says a check-in draft is kept.
 */
export function homeFacts(viewerId: string, s: Snapshot, cycle: Cycle, week: number, today: Date, opts: { workspace: string; draft: boolean; wrap?: { cycle: Cycle; snapshot: Snapshot } }): HomeFacts {
  const day = today.toISOString().slice(0, 10);
  const p = weekProgress(viewerId, s, cycle, week, today);
  const mine = s.goals.filter((g) => g.ownerId === viewerId);
  const ended = hasEnded(cycle, today);
  const start = beforeStart(cycle, today);
  const thisWeek = s.checkIns.filter((c) => c.week === week && p.goals.some((g) => g.id === c.goalId));
  const allIn = p.goals.length > 0 && p.done.length >= p.goals.length;
  const dueDate = reviewDate(cycle, Math.max(1, week));
  const sessions: HomeSession[] = s.reviews.filter((r) => r.people.includes(viewerId)).map((r) => reviewSession(r, s, cycle, today, week))
    .filter((x) => x.week === Math.max(1, week) && x.week <= cycle.weeks).map((x) => {
      const { discuss, healthy } = agendaOf(x);
      const order = walkOrder(sessionPlan(x, s, cycle, today));
      const nextId = order.find((id) => !x.covered.has(id));
      const next = x.items.find((a) => a.goal.id === nextId) ?? discuss[0] ?? healthy[0];
      const nw = nextSessionWeek(x.review, x.week);
      return { id: x.review.id, name: x.review.name, date: x.date, held: sessionState(x).kind === 'held', discuss: discuss.length, healthy: healthy.length, done: x.done, total: x.total,
        started: x.done > 0 && discuss.length > 0, nextGoal: next ? { id: next.goal.id, title: next.goal.title } : null, nextDate: nw <= cycle.weeks ? sessionDate(x.review, cycle, nw) : null };
    });
  const wrapOpen = wrapUpOpenOn(cycle, today);
  // The wrap-up is this year's, or last year's while it stays open after the next year is current (cycle-end rule 3, `wrapUpScope`).
  const wc = opts.wrap?.cycle ?? cycle;
  const ws = opts.wrap?.snapshot ?? s;
  const wrapMine = ws.goals.filter((g) => g.ownerId === viewerId);
  return {
    today: day, week, lastWeek: cycle.weeks, cycleName: cycle.name, workspace: opts.workspace,
    starts: start ? { on: start.firstDay, firstDue: start.firstDue } : null, ended: ended && !(wrapOpen && mine.some((g) => !s.retros.some((r) => r.goalId === g.id))),
    rhythm: { dueDate, nextDueDate: week < cycle.weeks ? reviewDate(cycle, Math.max(1, week) + 1) : null },
    checkIns: {
      total: p.goals.length, done: p.done.length,
      due: p.due.map((g) => ({ id: g.id, title: g.title, number: g.kind !== 'milestone' })), draft: opts.draft,
      allInOnTimeToday: allIn && thisWeek.some((c) => c.postedAt.slice(0, 10) === day) && thisWeek.every((c) => c.postedAt.slice(0, 10) <= dueDate),
      streak: mine.length ? onTimeStreak(viewerId, s, cycle, week) : null,
    },
    wrap: wrapUpOpenOn(wc, today) ? { name: wc.name, ends: cycleDates(wc).lastDay, ended: hasEnded(wc, today), left: wrapMine.filter((g) => !ws.retros.some((r) => r.goalId === g.id)).map((g) => ({ id: g.id, title: g.title })), total: wrapMine.length } : null,
    sessions,
    owns: mine.length,
    watches: watchedGoals(viewerId, s).filter((g) => g.ownerId !== viewerId).length,
    asks: openForPerson(viewerId, s).length,
  };
/** The year a wrap-up page is for (cycle-end rule 3): the current one; or, once the next year is current, the year
    before while its wrap-up is still open, so it can be finished until the day it closes. */
export function wrapUpScope(full: Snapshot, cycle: Cycle, snapshot: Snapshot, week: number, today: Date): { cycle: Cycle; snapshot: Snapshot; week: number; earlier: boolean } {
  const w = wrapUpCycle(full.cycles, today);
  if (!w || w.id === cycle.id) return { cycle, snapshot, week, earlier: false };
  return { cycle: w, snapshot: scopeToCycle(full, w), week: currentWeek(w, today), earlier: true };
}
