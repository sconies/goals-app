/* The orders goals are listed in. "Worst first" is the default wherever goals are listed. */
import { RANK } from './status';
import { STATUS_ORDER } from './vocabulary';
import type { DisplayStatus, Goal } from './types';

/** What an order needs to know about each goal: how much it needs attention, and its status. The app's state has both. */
export interface Judged {
  attentionOf: (g: Goal) => { weight: number };
  statusOf: (g: Goal) => { status: DisplayStatus };
}

/** Worst first: what needs attention, then the status, then the name. */
export function worstFirst(by: Judged) {
  return (x: Goal, y: Goal) => by.attentionOf(y).weight - by.attentionOf(x).weight || RANK[by.statusOf(y).status] - RANK[by.statusOf(x).status] || x.title.localeCompare(y.title);
}

/** How many goals have each status, worst first, only the statuses that have any: "11 off track, 23 at risk …". */
export function statusCounts(statuses: DisplayStatus[]): { status: DisplayStatus; n: number }[] {
  const by = new Map<DisplayStatus, number>();
  for (const k of statuses) by.set(k, (by.get(k) ?? 0) + 1);
  return STATUS_ORDER.filter((k) => by.get(k)).map((k) => ({ status: k, n: by.get(k)! }));
}

/** The statuses a group of goals is judged by, worst first: off track, at risk, no recent update, no check-in yet. */
const TROUBLE: DisplayStatus[] = ['off', 'risk', 'stale', 'none'];

/**
 * Groups of goals (teams, say) worst first (U24): the most goals off track first, then the most at risk, then the
 * most with no recent update, then the most with no check-in yet; ties by name. A healthy group's size doesn't count.
 */
export function worstGroupsFirst<T>(groups: T[], statusesOf: (g: T) => DisplayStatus[], nameOf: (g: T) => string): T[] {
  const tally = new Map(groups.map((g) => { const s = statusesOf(g); return [g, TROUBLE.map((k) => s.filter((x) => x === k).length)] as const; }));
  return [...groups].sort((a, b) => {
    const x = tally.get(a)!, y = tally.get(b)!;
    for (let i = 0; i < TROUBLE.length; i++) if (y[i] !== x[i]) return y[i]! - x[i]!;
    return nameOf(a).localeCompare(nameOf(b));
  });
}
