/* The outcome tree: each headline goal with the goals that feed it, and what a leader reads off it. */
import { checkInsFor, RANK } from './status';
import { fmt } from './format';
import type { Assessment } from './status';
import type { CheckIn, Goal, Status } from './types';

export interface TreeNode { goal: Goal; children: TreeNode[] }

/** Every headline goal as a tree, plus goals that don't lead to one. Siblings are ordered by `order`. */
export function outcomeTrees(goals: Goal[], order: (a: Goal, b: Goal) => number): { trees: TreeNode[]; loose: Goal[] } {
  const byParent = new Map<string, Goal[]>();
  for (const g of goals) if (g.parentId) byParent.set(g.parentId, [...(byParent.get(g.parentId) ?? []), g]);
  const seen = new Set<string>();
  const grow = (g: Goal): TreeNode => {
    seen.add(g.id);
    return { goal: g, children: (byParent.get(g.id) ?? []).filter((c) => !seen.has(c.id)).sort(order).map(grow) };
  };
  const trees = goals.filter((g) => g.headline).map(grow);
  return { trees, loose: goals.filter((g) => !seen.has(g.id)).sort(order) };
}

export function descendants(n: TreeNode): Goal[] {
  return n.children.flatMap((c) => [c.goal, ...descendants(c)]);
}

/** The headline goals above a goal, nearest last: for breadcrumbs. */
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

/** Where the trend lands by the end of the cycle, for a number goal with enough data. */
export function forecastText(goal: Goal, a: Assessment, weeks: number): { text: string; warn: boolean } | null {
  if (a.kind !== 'metric' || goal.kind !== 'metric' || a.forecast == null) return null;
  return a.forecastMisses
    ? { text: `At this pace it ends near ${fmt(a.forecast, goal)} in week ${weeks}, short of the ${fmt(goal.plan.target, goal)} target.`, warn: true }
    : { text: `At this pace it reaches the ${fmt(goal.plan.target, goal)} target by week ${weeks}.`, warn: false };
}
