/* The metric library's records (backlog 0b), owned by the module since AS part 2: a metric, and a goal's link to the
   metric that measures it. They live in the workspace under `modules.metrics` (domain/records): `metrics` and
   `metricLinks`, as records.ts declares them. Stored in okr_metrics and okr_goal_metrics (migration 0033). */
import type { Id } from '../../domain/types';

/** Whether a bigger number is better (deploys a day) or a smaller one (build time). */
export type MetricDirection = 'higher' | 'lower';
/** How often a metric's source refreshes its number. */
export type MetricRefresh = 'live' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

/**
 * A metric in the library (backlog 0b): one definition of a number, shared by every goal it measures, so two goals
 * about "build time" mean the same build time. The rules are in rules.ts: a name, a unit and a direction are
 * required; the rest is optional. Anyone can add one; its owner or an admin changes or removes it. Stored in okr_metrics.
 */
export interface Metric {
  id: Id;
  name: string;
  /** What it means and how it's calculated, in words: what's counted, over what, and what's left out. */
  meaning: string;
  unit: string;
  /** Places after the decimal point it's shown with. */
  decimals: number;
  direction: MetricDirection;
  /** Where the number comes from (a dashboard, a tool, a query) and who owns that source (a team or a person, as text). */
  source: string;
  sourceOwner: string;
  /** How often the source refreshes; null when nobody has said. */
  refresh: MetricRefresh | null;
  /** The person who answers for the definition: whoever added it, unless they hand it on. */
  ownerId: Id;
  /** What to watch out for when reading it (a known gap, a change of method). */
  caveats: string;
  createdBy: Id;
  createdAt: string;
  updatedAt: string;
  /** Removed: kept, out of every list, restorable (domain/removal). */
  removedAt?: string | null;
  removedBy?: Id | null;
  /** Retired (MT3): out of the pickers and the library's list, its links kept and its goals still measured by it; brought
      back by clearing these. Absent on a metric never retired; null and '' once brought back. */
  retiredAt?: string | null;
  retiredBy?: Id | null;
  retiredWhy?: string;
  /** The metric its goals' owners are offered in its place (same unit), when the person retiring it named one. */
  replacedBy?: Id | null;
  /** Changes of meaning or direction its goals show on their chart and History (rule 4), oldest first. */
  marks?: MetricMark[];
}

/** A change to a metric its goals must show (MT3 rule 4): what it meant, or which way was better, from a week on. */
export interface MetricMark {
  /** The cycle week it was made in, and when. */
  week: number;
  at: string;
  by: Id;
  kind: 'definition' | 'direction';
  why: string;
  /** The two texts (meaning) or directions, before and after. */
  was: string;
  now: string;
}

/**
 * A goal measured by a metric, for one slice: a team's number (teamId), or the whole company's (null). One per goal:
 * its id is the goal's id. The goal's own target (its plan's target, or its range's limit) is the target in that
 * metric; nothing is copied. Unlinking sets removedAt, so it can be undone. Stored in okr_goal_metrics.
 */
export interface MetricLink {
  /** The goal's id: one link per goal. */
  id: Id;
  goalId: Id;
  metricId: Id;
  teamId: Id | null;
  /** Which part of the team's or the company's number (“tier-1 services”, a region); empty or absent for all of it (MT2).
      Absent on a link that never had one, so its row doesn't name the column; '' when a part was cleared. */
  part?: string;
  linkedBy: Id;
  linkedAt: string;
  removedAt?: string | null;
  removedBy?: Id | null;
}
