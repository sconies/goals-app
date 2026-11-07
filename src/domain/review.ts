/* Goal reviews and watching: which goals a review walks or a person watches, when a review is held,
   and what has been covered in a review's session. */
import { attentionFor, needsAttention, type GoalAttention } from './attention';
import { ASK_KIND, ASK_STATUS, SESSION } from './vocabulary';
import { daysSince, weekDate } from './plan';
import { checkInsFor, RANK } from './status';
import { asksOf, isResolved } from './asks';
import type { Ask, Cycle, Decision, Goal, Level, Review, Snapshot, Watch } from './types';

/** A goal and every goal feeding it, at any depth. */
export function treeOf(rootId: string, goals: Goal[]): Goal[] {
  const out: Goal[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g || seen.has(id)) return;
    seen.add(id);
    out.push(g);
    for (const c of goals.filter((x) => x.parentId === id)) walk(c.id);
  };
  walk(rootId);
  return out;
}

/** The goals a set of picks covers: single goals, whole trees and whole levels, each once. */
export function goalsIn(scope: { goals: string[]; trees: string[]; levels: Level[] }, goals: Goal[]): Goal[] {
  const ids = new Set<string>([...scope.goals, ...scope.trees.flatMap((t) => treeOf(t, goals).map((g) => g.id))]);
  for (const g of goals) if (scope.levels.includes(g.level)) ids.add(g.id);
  return goals.filter((g) => ids.has(g.id));
}

/** What a person watches, as the same kind of scope a review uses. */
export function watchScope(personId: string, watches: Watch[]) {
  const mine = watches.filter((w) => w.personId === personId);
  return {
    goals: mine.filter((w) => w.kind === 'goal').map((w) => w.ref),
    trees: mine.filter((w) => w.kind === 'tree').map((w) => w.ref),
    levels: mine.filter((w) => w.kind === 'level').map((w) => w.ref as Level),
  };
}

export function watchedGoals(personId: string, s: Snapshot): Goal[] {
  return goalsIn(watchScope(personId, s.watches), s.goals);
}

/** How a person is watching a goal, if they are: directly, through a tree, or through its level. */
export function watchOf(personId: string, goal: Goal, s: Snapshot): Watch | 'via' | null {
  const mine = s.watches.filter((w) => w.personId === personId);
  const direct = mine.find((w) => (w.kind === 'goal' || w.kind === 'tree') && w.ref === goal.id);
  if (direct) return direct;
  return goalsIn(watchScope(personId, s.watches), s.goals).some((g) => g.id === goal.id) ? 'via' : null;
}

/** The week of a review's current session: this week if it's held this week, otherwise the next week it is. */
export function sessionWeek(r: Review, week: number): number {
  const n = Math.max(1, r.everyWeeks);
  const w = Math.max(1, week);
  return w % n === 0 ? w : w + (n - (w % n));
}

/** The date of a review's session in a given week, as yyyy-mm-dd. */
export function sessionDate(r: Review, cycle: Cycle, week: number): string {
  const d = new Date(weekDate(cycle, week) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + r.weekday);
  return d.toISOString().slice(0, 10);
}

/**
 * A goal the review can take as read: it doesn't need attention (domain/attention.ts, the one rule Home, Watching and
 * the Goals filter use) and isn't behind and being handled. Reviews walk the rest one at a time and acknowledge these
 * together (Senior UX review, 2 Nov).
 */
export const isHealthy = (a: GoalAttention) => !needsAttention(a) && !a.handled;

/**
 * What a session still has to do: goals to discuss one at a time, and goals on track to cover together. Discuss keeps
 * every goal that isn't healthy, the ones with new information first; `handled` names the ones in it that are already
 * being handled (someone looked since the latest check-in), so an agenda can group them under "Being handled".
 */
export function agendaOf(s: ReviewSession): { discuss: GoalAttention[]; healthy: GoalAttention[]; handled: GoalAttention[] } {
  const left = s.items.filter((a) => !s.covered.has(a.goal.id));
  const discuss = left.filter((a) => !isHealthy(a));
  return { discuss, healthy: left.filter(isHealthy), handled: discuss.filter((a) => !!a.handled) };
}

export interface ReviewSession {
  review: Review;
  week: number;
  date: string;
  /** New information, then what's being handled, then the healthy goals; each worst first, then the longest since a check-in. */
  items: GoalAttention[];
  covered: Set<string>;
  done: number;
  total: number;
  /** What was said in this session. */
  said: Said[];
}

/** Agenda order: new information, then what's being handled, then the healthy goals. */
const tier = (a: GoalAttention) => (a.handled ? 1 : isHealthy(a) ? 2 : 0);

export function reviewSession(r: Review, s: Snapshot, cycle: Cycle, today: Date, week: number): ReviewSession {
  const w = sessionWeek(r, week);
  const lastCheckIn = (g: Goal) => { const own = checkInsFor(g, s.checkIns); const last = own[own.length - 1]; return last ? daysSince(last.postedAt, today) : 999; };
  const items = goalsIn(r.scope, s.goals)
    .map((g) => attentionFor(g, s, cycle, today))
    .sort((a, b) => tier(a) - tier(b) || b.weight - a.weight || RANK[b.status.status] - RANK[a.status.status] || lastCheckIn(b.goal) - lastCheckIn(a.goal) || a.goal.title.localeCompare(b.goal.title));
  const said = saidIn(s).filter((d) => d.reviewId === r.id && d.week === w);
  // Only an explicit "reviewed" counts; a note, question or action can come before the assessment is finished.
  const covered = new Set(said.filter((d) => d.kind === 'acknowledge').map((d) => d.goalId));
  const done = items.filter((a) => covered.has(a.goal.id)).length;
  return { review: r, week: w, date: sessionDate(r, cycle, w), items, covered, done, total: items.length, said };
}

/** "Thu 5 Nov", from yyyy-mm-dd or a full timestamp. */
export const dayText = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Where a review's current session stands. Held means every goal in it has been marked reviewed; it is held on the
 * day the last one was. In progress means something has been said or reviewed, but not every goal. Otherwise it
 * hasn't started.
 */
export type SessionState =
  | { kind: 'not-started' }
  | { kind: 'in-progress'; done: number; total: number }
  | { kind: 'held'; on: string };

export function sessionState(s: ReviewSession): SessionState {
  if (s.total > 0 && s.done >= s.total) {
    const last = s.said.filter((d) => d.kind === 'acknowledge').map((d) => d.at).sort().at(-1);
    return { kind: 'held', on: (last ?? s.date).slice(0, 10) };
  }
  if (s.done > 0 || s.said.length > 0) return { kind: 'in-progress', done: s.done, total: s.total };
  return { kind: 'not-started' };
}

/** The words for a session's state: "Not started", "In progress · 3 of 7 reviewed", "Held Thu 5 Nov". */
export function sessionStateText(st: SessionState): string {
  if (st.kind === 'held') return `${SESSION.held.label} ${dayText(st.on)}`;
  if (st.kind === 'in-progress') return `${SESSION['in-progress'].label} · ${st.done} of ${st.total} reviewed`;
  return SESSION['not-started'].label;
}

/**
 * When a review was last held before its current session: the latest earlier session in which anything was said
 * (a goal reviewed, a note, a question or an action), dated by the last thing said in it. Null if it never has been.
 */
export function lastHeld(r: Review, s: Snapshot, sessionWk: number): { week: number; on: string } | null {
  const past = saidIn(s).filter((d) => d.reviewId === r.id && d.week < sessionWk);
  if (!past.length) return null;
  const week = Math.max(...past.map((d) => d.week));
  const on = past.filter((d) => d.week === week).map((d) => d.at).sort().at(-1)!;
  return { week, on: on.slice(0, 10) };
}

/** A review's open actions: every action agreed in it, in any session, not yet marked done or withdrawn (overdue ones included). */
export function openActions(r: Review, s: Snapshot): Ask[] {
  return asksOf(s).filter((a) => a.reviewId === r.id && a.kind === 'action' && a.status === 'open');
}

/**
 * One thing said about a goal in a review session: seen or a note (a decision), or a question or an action (an ask
 * raised in the session, carrying its own state). One record of the session for the review, the goal page and exports.
 */
export interface Said extends Decision { ask: Ask | null }

/** Everything said in reviews: the notes, and the questions and actions raised in them (not ones taken back). */
export function saidIn(s: Pick<Snapshot, 'decisions' | 'requests'> & Partial<Snapshot>): Said[] {
  return [
    ...s.decisions.map((d) => ({ ...d, ask: null })),
    ...asksOf(s).filter((a) => a.reviewId && (a.kind === 'question' || a.kind === 'action') && a.status !== 'withdrawn').map((a): Said => ({
      id: a.id, goalId: a.goalIds[0]!, checkInId: null, reviewId: a.reviewId, week: a.week ?? 0, kind: a.kind === 'question' ? 'ask' : 'action',
      byId: a.askedBy, at: a.createdAt, note: a.ask, assigneeId: a.recipientId, dueWeek: a.dueWeek, ask: a,
    })),
  ];
}

/** The week of the session after this one. */
export const nextSessionWeek = (r: Review, sessionWk: number) => sessionWeek(r, sessionWk + 1);

/** How a call reads in the change log, after the person's name. */
export const DECISION_LOG: Record<Decision['kind'], string> = {
  'approve-target': 'Approved the target change',
  'decline-target': 'Kept the current target',
  'approve-change': 'Approved the plan change',
  'decline-change': 'Kept the current plan',
  acknowledge: 'Looked at it: nothing to add',
  ask: 'Asked the owner a question',
  note: 'Added a note',
  action: 'Agreed an action',
};

export const DECISION_LABEL: Record<Decision['kind'], string> = {
  'approve-target': 'Approved the target change',
  'decline-target': 'Kept the current target',
  'approve-change': 'Approved the plan change',
  'decline-change': 'Kept the current plan',
  acknowledge: 'Seen, nothing to add',
  ask: 'Question for the owner',
  note: 'Note',
  action: ASK_KIND.action.label,
};

/**
 * The answer to a question or action said in a review: the ask's own answer (or the note it was marked done with),
 * once it has one. A comment never answers it. Null while it's open.
 */
export function answerOf(d: Said): { text: string; at: string; byId: string } | null {
  const a = d.ask;
  if (!a || !isResolved(a)) return null;
  return { text: a.answer || (a.status === 'done' ? ASK_STATUS.done.label : ''), at: a.answeredAt ?? a.updatedAt, byId: a.answeredBy ?? '' };
}

/** The tree and level watches that cover a goal for a person, not counting a watch on the goal itself. */
export function coveringWatches(personId: string, goal: Goal, s: Snapshot): Watch[] {
  return s.watches.filter((w) => w.personId === personId && (
    (w.kind === 'level' && w.ref === goal.level) ||
    (w.kind === 'tree' && w.ref !== goal.id && treeOf(w.ref, s.goals).some((g) => g.id === goal.id))));
}
