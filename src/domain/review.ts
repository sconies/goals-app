/* Goal reviews and watching: which goals a review walks or a person watches, when a review is held,
   and what has been covered in a review's session. */
import { attentionFor, type GoalAttention } from './attention';
import { daysSince, weekDate } from './plan';
import { checkInsFor, RANK } from './status';
import type { Cycle, Decision, Goal, Level, Review, Snapshot, Watch } from './types';

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

export interface ReviewSession {
  review: Review;
  week: number;
  date: string;
  /** Worst first, then the longest since a check-in. */
  items: GoalAttention[];
  covered: Set<string>;
  done: number;
  total: number;
  /** What was said in this session. */
  said: Decision[];
}

export function reviewSession(r: Review, s: Snapshot, cycle: Cycle, today: Date, week: number): ReviewSession {
  const w = sessionWeek(r, week);
  const lastCheckIn = (g: Goal) => { const own = checkInsFor(g, s.checkIns); const last = own[own.length - 1]; return last ? daysSince(last.postedAt, today) : 999; };
  const items = goalsIn(r.scope, s.goals)
    .map((g) => attentionFor(g, s, cycle, today))
    .sort((a, b) => b.weight - a.weight || RANK[b.status.status] - RANK[a.status.status] || lastCheckIn(b.goal) - lastCheckIn(a.goal) || a.goal.title.localeCompare(b.goal.title));
  const said = s.decisions.filter((d) => d.reviewId === r.id && d.week === w);
  const covered = new Set(said.map((d) => d.goalId));
  const done = items.filter((a) => covered.has(a.goal.id)).length;
  return { review: r, week: w, date: sessionDate(r, cycle, w), items, covered, done, total: items.length, said };
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
  action: 'Action',
};
