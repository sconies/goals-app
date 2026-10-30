/* The sponsor's weekly review: what is in the queue, what has been handled, and what a decision does. */
import { attentionList, type GoalAttention } from './attention';
import type { Cycle, Decision, Goal, MetricGoal, Snapshot } from './types';

export interface ReviewQueue {
  items: GoalAttention[];
  handled: Set<string>;
  done: number;
  total: number;
}

/** Goals the sponsor should look at this week: anything flagged except a check-in that is merely due. */
export function reviewQueue(s: Snapshot, cycle: Cycle, today: Date, week: number): ReviewQueue {
  const items = attentionList(s, cycle, today).filter((a) => a.flags.some((f) => f.kind !== 'due' && f.kind !== 'greener') || a.flags.length > 1);
  // A proposed plan change reopens a goal until the sponsor answers it.
  const handled = new Set(s.decisions.filter((d) => {
    if (d.week !== week) return false;
    const g = s.goals.find((x) => x.id === d.goalId);
    return !g?.pending || d.at >= g.pending.at;
  }).map((d) => d.goalId));
  const done = items.filter((a) => handled.has(a.goal.id)).length;
  return { items, handled, done, total: items.length };
}

/** How a decision reads in the change log, after the person's name. */
export const DECISION_LOG: Record<Decision['kind'], string> = {
  'approve-target': 'Approved the target change',
  'decline-target': 'Kept the current target',
  'approve-change': 'Approved the plan change',
  'decline-change': 'Kept the current plan',
  acknowledge: 'Reviewed it: no action needed',
  ask: 'Asked the owner a question',
};

export const DECISION_LABEL: Record<Decision['kind'], string> = {
  'approve-target': 'Approved the target change',
  'decline-target': 'Kept the current target',
  'approve-change': 'Approved the plan change',
  'decline-change': 'Kept the current plan',
  acknowledge: 'Seen, no action needed',
  ask: 'Asked the owner a question',
};

/** Approving a proposed target re-baselines the plan, keeping the first plan as the original. */
export function withApprovedTarget(goal: MetricGoal, target: number, week: number): MetricGoal {
  return { ...goal, originalPlan: goal.originalPlan ?? goal.plan, rebaselinedWeek: week, plan: { ...goal.plan, target } };
}

export const isMetric = (g: Goal): g is MetricGoal => g.kind === 'metric';

/** Approving a pending change: the proposed plan replaces the current one; a metric keeps its first plan as the original. */
export function withApprovedChange(goal: Goal, week: number): Goal {
  const p = goal.pending?.proposed;
  if (!p) return goal;
  if (goal.kind === 'metric' && p.kind === 'metric') {
    return { ...goal, plan: p.plan, originalPlan: goal.originalPlan ?? goal.plan, rebaselinedWeek: week, pending: null };
  }
  if (goal.kind === 'range' && p.kind === 'range') return { ...goal, range: p.range, pending: null };
  if (goal.kind === 'milestone' && p.kind === 'milestone') return { ...goal, stages: p.stages, pending: null };
  return { ...goal, pending: null };
}
