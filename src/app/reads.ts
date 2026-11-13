/* Reads (docs/design/architecture.md, 4.4: AR4): the one place that turns the loaded workspace into what each rule
   reads. New rules in src/domain take only these rows, never the whole workspace (the layers lint checks it), so the
   internal app can hand them the same shapes from its query port instead of a loaded workspace. */
import type { GoalRows, PersonRows, TeamRows } from '../domain/find';
import { creatorOf, type DayOneRows } from '../domain/dayOne';
import { summariseAll } from '../domain/summary';
import { proposedSummary } from '../domain/proposedSummary';
import { proposalAsks, withProposed } from '../domain/proposed';
import { scopeToCycle, wrapUpCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import type { Ask, Cycle, Goal, Person, Snapshot } from '../domain/types';
import { checkInStanding, dueIn } from '../domain/standing';
import type { ScopeFacts } from '../domain/goalsPage';
import { agendaOf, goalsIn, heldOnDueDay, nextSessionWeek, upcomingSessionWeek, reviewSession, sessionDate, sessionPlan, sessionState, walkOrder, watchedGoals } from '../domain/review';
import { waiting, waitingOrder, type AskFacts, type HomeFacts, type HomeSession, type Waiting } from '../domain/home';
import { handedFrom } from '../domain/askHandover';
import { dueWords, inByDueDay, onTimeStreak, postedDay, receiptFacts, reviewDate, weekProgress, type DueWords } from '../domain/progress';
import { hasEnded, weekDate, weekDates } from '../domain/plan';
import { beforeStart, cycleDates, wrapUpOpenOn } from '../domain/cycle';
import { asksOf, openForPerson } from '../domain/asks';
import { attentionFor, needsAttention } from '../domain/attention';
import type { QueryContext } from '../domain/query';
import type { LocalRows } from '../adapters/localSearch';

const live = <T extends { removedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.removedAt);

/**
 * Whether Reviews is on (FT2): the one place that names the reviews module. Screens pass `useModules().on`, the MCP
 * server and the dispatcher `modulesOn(ws).on`; the rules in src/domain take the answer as `reviews: boolean`. A build
 * without the module (FARO_WITHOUT=reviews) answers false. FT3 moves Reviews' code into its folder and retires this.
 */
export const reviewsOn = (on: ReadonlySet<string>): boolean => on.has('reviews');

/** What an action of a switched-off module says (docs/architecture/module-map.md, "An action, refused"): one sentence. */
export const switchedOffWords = (module: string, workspace: string) => `${module} is switched off in ${workspace}. An admin can switch it on in Workspace, under Features.`;
/** What domain/reviewWrites reads of a workspace as loaded: its goals (proposed ones too), reviews and asks. */
export const reviewWriteRows = (s: Snapshot) => ({ goals: [...s.goals, ...(s.proposed ?? [])], reviews: s.reviews, asks: asksOf(s) });
/** What a save of Reviews' records says while Reviews is off (FT2): the switched-off module's sentence (build review of #371). */
export const reviewsOffWords = (workspace: string) => switchedOffWords('Reviews', workspace);

/**
 * This week's deadline in dueWords' words (RS1), from what the rule reads: whether Reviews is on, and whether a review is
 * held on the due day (with `personId`, one that person is in: deep review T4). The check-in's receipt, Home and the AI's
 * get_my_work say it; no screen writes "review" in a deadline itself.
 */
export const dueWordsHere = (reviews: boolean, s: Pick<Snapshot, 'reviews'>, cycle: Cycle, week: number, personId?: string): DueWords =>
  dueWords(reviews, cycle, week, reviews && heldOnDueDay(s.reviews, cycle, week, personId));

/** Every goal's summary row, with what the Goals filters need beyond it. */
export function goalRows(s: Snapshot, cycle: Cycle, today: Date, week: number, columns?: QueryContext['columns']): GoalRows {
  const goals = live(s.goals).filter((g) => !g.stoppedAt);
  // This week's standing (habit rule 1) for `checkedin=`, and a review's goals for `inreview=` (HB2).
  const due = dueIn(cycle, s.checkIns), dueDay = reviewDate(cycle, week);
  const rows = { checkIns: s.checkIns, asks: s.requests ?? [] };
  const standing = (g: Goal) => (week >= 1 && due(g, week) ? checkInStanding(g, week, rows, dueDay) : null);
  const inReview = (id: string) => { const r = s.reviews.find((x) => x.id === id && !x.removedAt); return r ? new Set(goalsIn(r.scope, goals).map((g) => g.id)) : null; };
  return { kind: 'goal', summaries: summariseAll(goals, s, cycle, today, week), ctx: { goals, cycle, week, standing, inReview, ...(columns ? { columns } : {}) } };
}

export function personRows(s: Snapshot): PersonRows {
  const teams = new Map(s.teams.map((t) => [t.id, t]));
  // People who have left are in the cycle's archive (scopeToCycle): the search keeps them, for Find's "(left)" (FS1 review).
  const here = new Set(s.people.map((p) => p.id));
  const people = live([...s.people, ...(s.archive?.people ?? []).filter((p) => !here.has(p.id))]);
  return { kind: 'person', people, teamName: (id) => teams.get(id)?.name ?? '', teamLead: (id) => teams.get(id)?.leadId ?? null };
}

export function teamRows(s: Snapshot): TeamRows {
  return { kind: 'team', teams: s.teams, people: live(s.people) };
}

/** The rows the browser's Search answers from, each made once per workspace as loaded and only when first asked. */
export function searchRows(s: Snapshot, cycle: Cycle, today: Date, week: number, columns?: QueryContext['columns']): LocalRows {
  const once = <T,>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); };
  // Find and find-and-pick list proposed goals too, each with the word where a status would be (GE10).
  const goals = () => { const r = goalRows(s, cycle, today, week, columns); return s.proposed?.length ? { ...r, summaries: [...r.summaries, ...s.proposed.map((g) => proposedSummary(g, s, cycle, week))] } : r; };
  return { goal: once(goals), person: once(() => personRows(s)), team: once(() => teamRows(s)) };
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
/** A review's name, for " in {review}" (GE10): null when it isn't in the workspace to name. */
export const reviewName = (s: Pick<Snapshot, 'reviews'>, id: string | null | undefined): string | null => (id ? s.reviews.find((r) => r.id === id)?.name ?? null : null);

export function homeFacts(viewerId: string, s: Snapshot, cycle: Cycle, week: number, today: Date, opts: { workspace: string; draft: boolean; wrap?: { cycle: Cycle; snapshot: Snapshot }; opened?: ReadonlySet<string>; putOff?: ReadonlyMap<string, string>; reviews?: boolean }): HomeFacts {
  // Reviews switched off (FT2): no session leads or names a day, and no ask names a review.
  const reviews = opts.reviews !== false;
  const day = today.toISOString().slice(0, 10);
  const p = weekProgress(viewerId, s, cycle, week, today);
  const mine = s.goals.filter((g) => g.ownerId === viewerId);
  const ended = hasEnded(cycle, today);
  const start = beforeStart(cycle, today);
  const thisWeek = s.checkIns.filter((c) => c.week === week && p.goals.some((g) => g.id === c.goalId));
  const allIn = p.goals.length > 0 && p.done.length >= p.goals.length;
  // The receipt names the due day as a review only for someone in a review held that day, while Reviews is on (T4, FT2):
  // dueWords' words (RS1), the same the check-in's receipt says.
  const words = dueWordsHere(reviews, s, cycle, week, viewerId);
  const receipt = allIn ? receiptFacts(p, viewerId, s, cycle, week, words) : { after: 0, forgiven: null, forgivenMissed: false };
  const dueDate = reviewDate(cycle, Math.max(1, week));
  // Once the year has ended no session is held in it: a "Not held yet" lead would never go (HM1 review).
  const sessions: HomeSession[] = ended || !reviews ? [] : s.reviews.filter((r) => r.people.includes(viewerId)).map((r) => reviewSession(r, s, cycle, today, week))
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
      allInOnTimeToday: allIn && thisWeek.some((c) => localDay(c.postedAt) === day) && thisWeek.every((c) => inByDueDay(c, cycle, Math.max(1, week))),
      streak: mine.length ? onTimeStreak(viewerId, s, cycle, week) : null,
      completedToday: allIn && thisWeek.some((c) => localDay(c.postedAt) === day),
      after: receipt.after, forgiven: receipt.forgiven, forgivenMissed: !!receipt.forgivenMissed, words: { by: words.by, after: words.after },
    },
    wrap: wrapUpOpenOn(wc, today) ? { name: wc.name, ends: cycleDates(wc).lastDay, ended: hasEnded(wc, today), left: wrapMine.filter((g) => !ws.retros.some((r) => r.goalId === g.id)).map((g) => ({ id: g.id, title: g.title })), total: wrapMine.length } : null,
    sessions,
    owns: mine.length,
    watches: watchedGoals(viewerId, s).filter((g) => g.ownerId !== viewerId).length,
    ...(!reviews && !mine.length ? { watchNeeds: watchedGoals(viewerId, s).filter((g) => needsAttention(attentionFor(g, s, cycle, today))).length } : {}),
    asks: homeAsks(viewerId, s, cycle, week, today, reviews),
    // Goal entry rule 14: proposed for the viewer by someone else and not yet opened (what was opened is the Prefs port's).
    // Every row under "Proposed goals" (both kinds), so the quiet line never says nothing is asked beside them (#319's review).
    proposalRows: proposalAsks(s.proposed ?? [], { id: viewerId, admin: false }, today, { opened: opts.opened ?? new Set(), putOff: opts.putOff ?? new Map() }).length,
    proposals: proposalAsks(s.proposed ?? [], { id: viewerId, admin: false }, today, { opened: opts.opened ?? new Set(), putOff: new Map() }, (id) => s.people.find((p) => p.id === id)?.name ?? 'Someone')
      .filter((a) => a.kind === 'for-you').map((a) => ({ id: a.goal.id, title: a.goal.title, by: s.people.find((p) => p.id === a.goal.proposedBy)?.name.split(' ')[0] ?? 'Someone', proposedOn: a.goal.proposedAt!.slice(0, 10), in: reviews ? reviewName(s, a.goal.proposedIn) : null })),
  };
}

/** The year a wrap-up page is for (cycle-end rule 3): the current one; or, once the next year is current, the year
    before while its wrap-up is still open, so it can be finished until the day it closes. */
export function wrapUpScope(full: Snapshot, cycle: Cycle, snapshot: Snapshot, week: number, today: Date): { cycle: Cycle; snapshot: Snapshot; week: number; earlier: boolean } {
  const w = wrapUpCycle(full.cycles, today);
  if (!w || w.id === cycle.id) return { cycle, snapshot, week, earlier: false };
  return { cycle: w, snapshot: scopeToCycle(full, w), week: currentWeek(w, today), earlier: true };
}

/**
 * Rule 3's facts for each open ask waiting on the viewer, in its order. A question raised in a review is due before the
 * first session after the one it was raised in, fixed when asked: it doesn't move on when that session passes.
 */
/**
 * The day a stamp falls on where the person is: today is their wall-clock day (app/state), so the day an ask was made is
 * read on the same clock, not in UTC (build review of #310: "Asked yesterday" for an ask made half an hour ago at UTC+10).
 * On a server, whose zone is UTC, it is the stamp's UTC day.
 */
const localDay = postedDay;

export function homeAsks(viewerId: string, s: Snapshot, cycle: Cycle, week: number, today: Date, reviews = true): Waiting[] {
  return openForPerson(viewerId, s).flatMap((r) => { const w = askWaiting(r, viewerId, s, cycle, week, today, reviews); return w ? [w] : []; }).sort(waitingOrder);
}

/**
 * One ask as Home reads it for a viewer: its line, its due day and whether it is late. The one lateness rule: Home,
 * `get_my_work` and `list_requests` all read `late` from here (build review of #369, medium 5). Null when none of its
 * goals is in the workspace.
 */
export function askWaiting(r: Ask, viewerId: string, s: Snapshot, cycle: Cycle, week: number, today: Date, reviews = true): Waiting | null {
  const day = today.toISOString().slice(0, 10);
  const me = s.people.find((p) => p.id === viewerId)?.name ?? '';
  const first = (id: string) => s.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  const all = withProposed(s);
  // A proposed goal's asks stay on Home (build review of #349): asked while proposed, or before it went back to proposed.
  const goals = r.goalIds.map((id) => all.find((g) => g.id === id)).filter((g) => !!g).map((g) => ({ id: g!.id, title: g!.title }));
  if (!goals.length) return null;
  // With Reviews off an ask is late by its own age, waits for no session and names no review (FT2 4.4, RS 2).
  const rv = r.reviewId && reviews ? s.reviews.find((v) => v.id === r.reviewId) : undefined;
  let session: AskFacts['session'] = null;
  if (r.dueWeek == null && r.kind === 'question' && rv) {
    const w = r.week != null ? nextSessionWeek(rv, r.week) : upcomingSessionWeek(rv, cycle, week, today);
    if (w <= cycle.weeks) session = { name: rv.name, date: sessionDate(rv, cycle, w) };
  }
  const sunday = (w: number) => new Date(Date.parse(weekDate(cycle, w) + 'T00:00:00Z') + 6 * 86_400_000).toISOString().slice(0, 10);
  const facts: AskFacts = {
    id: r.id, kind: r.kind, by: r.askedBy === viewerId ? null : first(r.askedBy), goals, said: r.ask, askedOn: localDay(r.createdAt), was: handedFrom(r.id, me, s.changes ?? []),
    dueWeek: r.dueWeek != null ? { week: r.dueWeek, sunday: sunday(r.dueWeek), dates: weekDates(cycle, r.dueWeek) } : null, session, where: rv?.name ?? null,
  };
  return waiting(facts, day);
}
