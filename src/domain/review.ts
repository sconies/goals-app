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
  const handled = new Set(s.decisions.filter((d) => d.week === week).map((d) => d.goalId));
  const done = items.filter((a) => handled.has(a.goal.id)).length;
  return { items, handled, done, total: items.length };
}

/** How a decision reads in the change log, after the person's name. */
export const DECISION_LOG: Record<Decision['kind'], string> = {
  'approve-target': 'Approved the target change',
  'decline-target': 'Kept the current target',
  acknowledge: 'Reviewed it: no action needed',
  ask: 'Asked the owner a question',
};

export const DECISION_LABEL: Record<Decision['kind'], string> = {
  'approve-target': 'Approved the target change',
  'decline-target': 'Kept the current target',
  acknowledge: 'Seen, no action needed',
  ask: 'Asked the owner a question',
};

/** Approving a proposed target re-baselines the plan, keeping the first plan as the original. */
export function withApprovedTarget(goal: MetricGoal, target: number, week: number): MetricGoal {
  return { ...goal, originalPlan: goal.originalPlan ?? goal.plan, rebaselinedWeek: week, plan: { ...goal.plan, target } };
}

export const isMetric = (g: Goal): g is MetricGoal => g.kind === 'metric';
