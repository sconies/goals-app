/* The orders goals are listed in. "Worst first" is the default wherever goals are listed. */
import { RANK } from './status';
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
