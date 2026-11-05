/* Goal trees: each goal with nothing above it, and the goals that feed it, at any depth. */
import { checkInsFor, RANK } from './status';
import { isShare } from './checkin';
import { fmt, rangeText } from './format';
import type { Assessment } from './status';
import type { CheckIn, Goal, Status } from './types';

export interface TreeNode { goal: Goal; children: TreeNode[] }

/** Every tree: goals with nothing above them, each with what feeds it. Siblings are ordered by `order`.
    `loose` are goals with nothing above and nothing feeding them: not linked to anything.
    Goals caught in a loop (which saving prevents, but old data might hold) are shown as trees of their own. */
export function outcomeTrees(goals: Goal[], order: (a: Goal, b: Goal) => number): { trees: TreeNode[]; loose: Goal[] } {
  const byParent = new Map<string, Goal[]>();
  for (const g of goals) if (g.parentId) byParent.set(g.parentId, [...(byParent.get(g.parentId) ?? []), g]);
  const seen = new Set<string>();
  const grow = (g: Goal): TreeNode => {
    seen.add(g.id);
    return { goal: g, children: (byParent.get(g.id) ?? []).filter((c) => !seen.has(c.id)).sort(order).map(grow) };
  };
  const ids = new Set(goals.map((g) => g.id));
  const tops = goals.filter((g) => !g.parentId || !ids.has(g.parentId)).sort(order);
  const isLoose = (g: Goal) => !byParent.has(g.id);
  const trees = tops.filter((g) => !isLoose(g)).map(grow);
  for (const g of tops) seen.add(g.id);
  for (const g of goals) if (!seen.has(g.id)) trees.push(grow(g));
  return { trees, loose: tops.filter(isLoose) };
}

/** Whether making `goal` feed `parentId` would make a loop: the parent is the goal or feeds into it. */
export function makesLoop(goalId: string, parentId: string | null, goals: Goal[]): boolean {
  let p = parentId;
  const seen = new Set<string>();
  while (p && !seen.has(p)) {
    if (p === goalId) return true;
    seen.add(p);
    p = goals.find((g) => g.id === p)?.parentId ?? null;
  }
  return false;
}

export function descendants(n: TreeNode): Goal[] {
  return n.children.flatMap((c) => [c.goal, ...descendants(c)]);
}

/** The goals above a goal, nearest last: for breadcrumbs. */
export function ancestors(goal: Goal, goals: Goal[]): Goal[] {
  const out: Goal[] = [];
  let p = goal.parentId ? goals.find((g) => g.id === goal.parentId) : undefined;
  while (p && !out.includes(p)) { out.unshift(p); p = p.parentId ? goals.find((g) => g.id === p!.parentId) : undefined; }
  return out;
}

/** How the owner's call moved at the latest check-in, if it did. */
export function statusChange(goal: Goal, checkIns: CheckIn[]): { from: Status; week: number; worse: boolean } | null {
  const own = checkInsFor(goal, checkIns);
  const last = own[own.length - 1], prev = own[own.length - 2];
  if (!last || !prev || last.status === prev.status) return null;
  return { from: prev.status, week: prev.week, worse: RANK[last.status] > RANK[prev.status] };
}

/**
 * Where the recent trend takes a number goal by its due week, as a range (plan.ts works it out), against the target.
 * `warn` when the likeliest value falls short.
 */
export function forecastText(goal: Goal, a: Assessment, weeks: number): { text: string; warn: boolean } | null {
  if (a.kind !== 'metric' || goal.kind !== 'metric' || a.forecast == null || !a.projection) return null;
  const due = goal.plan.endWeek ?? weeks;
  const range = rangeText(a.projection, goal, isShare(goal));
  // "Above" and "below" rather than "short of", which reads wrong for a lower-is-better number.
  const above = a.forecast > goal.plan.target;
  return a.forecastMisses
    ? { text: `Heading for ${range} by week ${due}, ${above ? 'above' : 'below'} the ${fmt(goal.plan.target, goal)} target. Projected by the app from the recent trend, not the owner’s date.`, warn: true }
    : { text: `Projected by the app to reach the ${fmt(goal.plan.target, goal)} target by week ${due} on the recent trend (heading for ${range}).`, warn: false };
}
