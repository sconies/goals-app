/* Reads (docs/design/architecture.md, 4.4: AR4): the one place that turns the loaded workspace into what each rule
   reads. New rules in src/domain take only these rows, never the whole workspace (the layers lint checks it), so the
   internal app can hand them the same shapes from its query port instead of a loaded workspace. */
import type { GoalRows, PersonRows, TeamRows } from '../domain/find';
import { creatorOf, type DayOneRows } from '../domain/dayOne';
import { summariseAll } from '../domain/summary';
import type { Cycle, Person, Snapshot } from '../domain/types';
import type { ScopeFacts } from '../domain/goalsPage';
import { agendaOf, nextSessionWeek, upcomingSessionWeek, reviewSession, sessionDate, sessionPlan, sessionState, walkOrder, watchedGoals } from '../domain/review';
import { waiting, waitingOrder, type AskFacts, type HomeFacts, type HomeSession, type Waiting } from '../domain/home';
import { onTimeStreak, reviewDate, weekProgress } from '../domain/progress';
import { hasEnded, weekDate, weekDates } from '../domain/plan';
import { beforeStart, cycleDates, wrapUpOpenOn } from '../domain/cycle';
import { openForPerson } from '../domain/asks';
import type { LocalRows } from '../adapters/localSearch';

const live = <T extends { removedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.removedAt);

/** Every goal's summary row, with what the Goals filters need beyond it. */
export function goalRows(s: Snapshot, cycle: Cycle, today: Date, week: number): GoalRows {
  const goals = live(s.goals).filter((g) => !g.stoppedAt);
  return { kind: 'goal', summaries: summariseAll(goals, s, cycle, today, week), ctx: { goals, cycle, week } };
}

export function personRows(s: Snapshot): PersonRows {
  const teams = new Map(s.teams.map((t) => [t.id, t]));
  return { kind: 'person', people: live(s.people), teamName: (id) => teams.get(id)?.name ?? '', teamLead: (id) => teams.get(id)?.leadId ?? null };
}

export function teamRows(s: Snapshot): TeamRows {
  return { kind: 'team', teams: s.teams, people: live(s.people) };
}

/** The rows the browser's Search answers from, each made once per workspace as loaded and only when first asked. */
export function searchRows(s: Snapshot, cycle: Cycle, today: Date, week: number): LocalRows {
  const once = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); };
  return { goal: once(() => goalRows(s, cycle, today, week)), person: once(() => personRows(s)), team: once(() => teamRows(s)) };
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
export function homeFacts(viewerId: string, s: Snapshot, cycle: Cycle, week: number, today: Date, opts: { workspace: string; draft: boolean }): HomeFacts {
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
    wrap: wrapOpen ? { ends: cycleDates(cycle).lastDay, ended, left: mine.filter((g) => !s.retros.some((r) => r.goalId === g.id)).map((g) => ({ id: g.id, title: g.title })), total: mine.length } : null,
    sessions,
    owns: mine.length,
    watches: watchedGoals(viewerId, s).filter((g) => g.ownerId !== viewerId).length,
    asks: homeAsks(viewerId, s, cycle, week, today),
  };
}

/**
 * Rule 3's facts for each open ask waiting on the viewer, in its order. A question raised in a review is due before the
 * first session after the one it was raised in, fixed when asked: it doesn't move on when that session passes.
 */
export function homeAsks(viewerId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): Waiting[] {
  const day = today.toISOString().slice(0, 10);
  const first = (id: string) => s.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  return openForPerson(viewerId, s).flatMap((r) => {
    const goals = r.goalIds.map((id) => s.goals.find((g) => g.id === id)).filter((g) => !!g).map((g) => ({ id: g!.id, title: g!.title }));
    if (!goals.length) return [];
    const rv = r.reviewId ? s.reviews.find((v) => v.id === r.reviewId) : undefined;
    let session: AskFacts['session'] = null;
    if (r.dueWeek == null && r.kind === 'question' && rv) {
      const w = r.week != null ? nextSessionWeek(rv, r.week) : upcomingSessionWeek(rv, cycle, week, today);
      if (w <= cycle.weeks) session = { name: rv.name, date: sessionDate(rv, cycle, w) };
    }
    const sunday = (w: number) => new Date(Date.parse(weekDate(cycle, w) + 'T00:00:00Z') + 6 * 86_400_000).toISOString().slice(0, 10);
    const facts: AskFacts = {
      id: r.id, kind: r.kind, by: r.askedBy === viewerId ? null : first(r.askedBy), goals, said: r.ask, askedOn: r.createdAt.slice(0, 10),
      dueWeek: r.dueWeek != null ? { week: r.dueWeek, sunday: sunday(r.dueWeek), dates: weekDates(cycle, r.dueWeek) } : null, session, where: rv?.name ?? null,
    };
    return [waiting(facts, day)];
  }).sort(waitingOrder);
}
