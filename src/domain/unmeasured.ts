/* A goal held to no number (backlog MS; docs/architecture/module-map.md, the MS row: a core rule over a core field).

   Some numbers can't be measured yet: nobody collects them, or not in full. A goal measured by one is still a real goal,
   with an owner and a page, but it is held to no number until it can be: the status rules give it no status from its
   plan, nothing on it goes late or quiet, and it projects nothing. It says "Not measured yet", a shape and a word.

   The field is the goal's own (`Goal.unmeasuredSince`). Whatever measures the goal sets and clears it: the metric
   library does, when the goal is linked to a metric with a gap and when that metric is measured. The rules here read
   the goal alone, never the library's records, so they hold with every module switched off.

   Pure: no screens, storage or network. */
import type { Goal } from './types';

/* Its word and meaning, Not measured yet, live once in the vocabulary (STATUS.unmeasured): a status of its own (Lane, 14 Nov). */

/** Whether a goal is held to no number: set, and the goal neither removed nor stopped. */
export const isUnmeasured = (g: Pick<Goal, 'unmeasuredSince' | 'removedAt' | 'stoppedAt'>): boolean => !!g.unmeasuredSince && !g.removedAt && !g.stoppedAt;

/** The goal held to no number from `now`, or held to its plan again (`null`); unchanged when it already is. */
export function heldToNoNumber<G extends Goal>(g: G, held: boolean, now: string): G {
  if (held === !!g.unmeasuredSince) return g;
  return { ...g, unmeasuredSince: held ? now : null };
}
