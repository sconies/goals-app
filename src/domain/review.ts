/* Goal reviews and watching: which goals a review walks or a person watches, when a review is held,
   and what has been covered in a review's session. */
import { attentionFor, needsAttention, type GoalAttention } from './attention';
import { ASK_KIND, ASK_STATUS, SESSION } from './vocabulary';
import { daysSince, firstWeekFrom, weekDate } from './plan';
import { checkInsFor, RANK } from './status';
import { asksOf, isResolved } from './asks';
import type { Ask, Cycle, Decision, Goal, Person, Review, Snapshot } from './types';
import { goalsIn } from './watch';
// Watching's rules moved to watch.ts and "Thu 5 Nov" to format.ts (FT2); they are said here too for one release.
export { coveringWatches, goalsIn, treeOf, watchedGoals, watchOf, watchScope } from './watch';
import { dayText } from './format';
export { dayText };

/** The week of a review's current session: this week if it's held this week, otherwise the next week it is. */
export function sessionWeek(r: Review, week: number, cycle?: Cycle): number {
  const n = Math.max(1, r.everyWeeks);
  // A review's first session is the first one on or after the day it was set up, never one already past.
  const w = Math.max(1, week, cycle ? firstWeekFrom(cycle, r.createdAt, r.weekday) : 1);
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

/** A review's goals in agenda order: new information, then what's being handled, then the healthy goals. */
function agendaItems(r: Review, s: Snapshot, cycle: Cycle, today: Date): GoalAttention[] {
  const lastCheckIn = (g: Goal) => { const own = checkInsFor(g, s.checkIns); const last = own[own.length - 1]; return last ? daysSince(last.postedAt, today) : 999; };
  return goalsIn(r.scope, s.goals)
    .map((g) => attentionFor(g, s, cycle, today))
    .sort((a, b) => tier(a) - tier(b) || b.weight - a.weight || RANK[b.status.status] - RANK[a.status.status] || lastCheckIn(b.goal) - lastCheckIn(a.goal) || a.goal.title.localeCompare(b.goal.title));
}

export function reviewSession(r: Review, s: Snapshot, cycle: Cycle, today: Date, week: number): ReviewSession {
  const w = sessionWeek(r, week, cycle);
  const items = agendaItems(r, s, cycle, today);
  const said = saidIn(s).filter((d) => d.reviewId === r.id && d.week === w);
  // Only an explicit "reviewed" counts; a note, question or action can come before the assessment is finished.
  const covered = new Set(said.filter((d) => d.kind === 'acknowledge').map((d) => d.goalId));
  const done = items.filter((a) => covered.has(a.goal.id)).length;
  return { review: r, week: w, date: sessionDate(r, cycle, w), items, covered, done, total: items.length, said };
}

/**
 * A session's agenda as it stood when the session started (deep review T3, 10 Nov): the order, and which goals are to
 * discuss and which have nothing flagged, worked out with everything said in this session set aside. So reviewing a
 * goal, or saving a note or an action on it, never reshuffles the walk or moves a goal between the groups while the
 * session runs: "Goal k of N" stays true, Continue picks up where it was, and a walk opened from a goal's own address
 * keeps the agenda's order. `discuss` and `healthy` are the live entries (today's status), in that fixed order.
 */
export function sessionPlan(ss: ReviewSession, s: Snapshot, cycle: Cycle, today: Date): { discuss: GoalAttention[]; healthy: GoalAttention[]; all: GoalAttention[] } {
  const mine = (d: { reviewId?: string | null; week?: number | null }) => d.reviewId === ss.review.id && d.week === ss.week;
  const before: Snapshot = { ...s, decisions: s.decisions.filter((d) => !mine(d)), ...(s.requests ? { requests: s.requests.filter((a) => !mine(a)) } : {}) };
  const start = agendaItems(ss.review, before, cycle, today);
  const live = new Map(ss.items.map((a) => [a.goal.id, a]));
  const pick = (list: GoalAttention[]) => list.map((a) => live.get(a.goal.id)).filter((a): a is GoalAttention => !!a);
  const discuss = pick(start.filter((a) => !isHealthy(a)));
  const healthy = pick(start.filter(isHealthy));
  return { discuss, healthy, all: [...discuss, ...healthy] };
}

/** The goals a session walks one at a time, in its fixed order: the ones to discuss, or every goal when there are none. */
export function walkOrder(plan: ReturnType<typeof sessionPlan>, everything = false): string[] {
  return (everything || !plan.discuss.length ? plan.all : plan.discuss).map((a) => a.goal.id);
}

/**
 * Whether a person's review session is something to do this week (deep review U6): it is this week's, not held, and
 * there is something to review, either its day has come or a goal in it has been checked in on. So a workspace set up
 * this morning doesn't say "Reviews 1 to do" before any check-in is in or the review's day arrives.
 */
export function sessionToDo(ss: ReviewSession, s: Pick<Snapshot, 'checkIns'>, week: number, today: Date): boolean {
  if (ss.week !== Math.max(1, week) || ss.done >= ss.total) return false;
  if (ss.date <= today.toISOString().slice(0, 10)) return true;
  const ids = new Set(ss.items.map((a) => a.goal.id));
  return s.checkIns.some((c) => ids.has(c.goalId) && !c.removedAt);
}


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

/**
 * How many days a session not yet held is past its date (demo review, 8 Nov, item 9): 0 on the day or before it.
 * `today` is the viewer's day, as the rest of the app counts it.
 */
export function daysPast(s: ReviewSession, today: Date): number {
  if (sessionState(s).kind === 'held') return 0;
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const due = Date.parse(s.date.slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.round((day - due) / 86_400_000));
}

/** "3 days past": a session not held after its date, said plainly. */
export const pastText = (days: number) => (days === 1 ? '1 day past' : `${days} days past`);

/** How far a session has got, in the words every view uses: Home's ring, the Reviews list, the review's page and its
    walkthrough all read these from the same reviewSession (backlog T, 8 Nov: they once disagreed). */
export const reviewedText = (s: Pick<ReviewSession, 'done' | 'total'>) => `${s.done} of ${s.total} reviewed`;
/** The same, for a progress ring's label: "2 of 56 goals reviewed", and the review's name where it isn't on screen. */
export const reviewedLabel = (s: Pick<ReviewSession, 'done' | 'total'>, name?: string) => `${s.done} of ${s.total} goals reviewed${name ? ` in ${name}` : ''}`;

/** The words for a session's state: "Not started", "In progress · 3 of 7 reviewed", "Held Thu 5 Nov". */
export function sessionStateText(st: SessionState): string {
  if (st.kind === 'held') return `${SESSION.held.label} ${dayText(st.on)}`;
  if (st.kind === 'in-progress') return `${SESSION['in-progress'].label} · ${reviewedText(st)}`;
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

/** The week of a review's next session on or after today: this week's, or the one after once its date has gone. Home's
    "Next review" and the review page's "Next" both use it, so they name the same day (review F07, 9 Nov). */
export function upcomingSessionWeek(r: Review, cycle: Cycle, week: number, today: Date): number {
  const day = today.toISOString().slice(0, 10);
  const w = sessionWeek(r, week, cycle);
  return sessionDate(r, cycle, w) < day ? sessionWeek(r, w + 1, cycle) : w;
}

/**
 * The words for which session a review is on, in the order people need them (review F07): a session past its date and
 * not held is "Outstanding from Thu 5 Nov (4 days past)", so the next one can't be mistaken for it; otherwise its date.
 */
export function sessionWhen(s: ReviewSession, today: Date): string {
  const past = daysPast(s, today);
  return past ? `Outstanding from ${dayText(s.date)} (${pastText(past)})` : dayText(s.date);
}

/** The date of the next session when it is a different one from the session shown (that one is held, or outstanding). */
export function nextSessionDate(s: ReviewSession, cycle: Cycle, week: number, today: Date): string | null {
  const next = Math.max(upcomingSessionWeek(s.review, cycle, week, today), sessionState(s).kind === 'held' ? nextSessionWeek(s.review, s.week) : 0);
  return next !== s.week && next <= cycle.weeks ? sessionDate(s.review, cycle, next) : null;
}

/** "Next Thu 12 Nov", for the line under a review's name. */
export function nextWhen(s: ReviewSession, cycle: Cycle, week: number, today: Date): string | null {
  const d = nextSessionDate(s, cycle, week, today);
  return d ? `Next ${dayText(d)}` : null;
}

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

/* ---------- Who may speak for a review (RV7: docs/design/reviews/spec.md section 3, Lane's decision 1) ---------- */

/**
 * "Reviewed", a note, the review accepting a risk, and a next step or question raised in it speak for the group: only
 * someone in the review, or an admin, may say them. Everyone may read a review, and anyone may still agree a next step
 * or ask a question on a goal's own page.
 */
export const canSpeakFor = (r: Pick<Review, 'people'>, p: Pick<Person, 'id' | 'admin'>): boolean => p.admin || r.people.includes(p.id);

/** The refusal, in words a person (or their assistant) can act on. */
export const speakRefusal = (r: Pick<Review, 'name'>) => `Only people in ${r.name}, or an admin, can speak for it.`;

/**
 * The line a review's page shows someone not in it, who can't speak for it: who can add them (its people and whoever
 * set it up, by name, up to six, then "and {n} more"), or an admin. "You’re not in this review. Rhea Kapoor or an admin can add you."
 */
export function joinLine(r: Pick<Review, 'people' | 'createdBy'>, nameOf: (id: string) => string | null): string {
  const names = [...new Set([...r.people, r.createdBy])].map(nameOf).filter((n): n is string => !!n);
  const shown = names.slice(0, 6);
  const who = !shown.length ? 'An admin' : `${shown.join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''} or an admin`;
  return `You’re not in this review. ${who} can add you.`;
}
