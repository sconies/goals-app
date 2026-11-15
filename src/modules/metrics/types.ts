/* The metric library's records (backlog 0b), owned by the module since AS part 2: a metric, and a goal's link to the
   metric that measures it. They live in the workspace under `modules.metrics` (domain/records): `metrics` and
   `metricLinks`, as records.ts declares them. Stored in okr_metrics and okr_goal_metrics (migration 0033). */
import type { Id } from '../../domain/types';

/** Whether a bigger number is better (deploys a day) or a smaller one (build time). */
export type MetricDirection = 'higher' | 'lower';
/** How often a metric's source refreshes its number. */
export type MetricRefresh = 'live' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
/** Whether the number is measured today (MS): in full, in part (some of it, or not every period), or not yet (a gap). */
export type MetricMeasurement = 'measured' | 'partly' | 'gap';

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
  /** Whether it is measured today (MS; rulesMeasured.ts): absent on one never said otherwise, which is measured. Goals
      measured by a metric with a gap are held to no number (domain/unmeasured) until it is measured. */
  measurement?: MetricMeasurement;
  /** What's missing from the measurement, and who is sorting it out ('' or absent when measured). */
  measurementNote?: string;
  /** Structure (MQ; rulesStructure.ts): how it relates to its parent metric (absent: not said). */
  level?: import('./rulesStructure').MetricLevel;
  /** The metric it is a component, driver, control or breakdown of (absent: none). */
  parentId?: Id;
  /** How far its number can be trusted (absent: not said). */
  confidence?: import('./rulesStructure').MetricConfidence;
  /** How the number could be gamed, in words (absent: not said). */
  gaming?: string;
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
  /** Changes of meaning, direction or source its goals show on their chart and History (rule 4), oldest first. */
  marks?: MetricMark[];
  /* ---- Metric quality (MQ2; rulesQuality.ts). Each absent until said; the stage is worked out from them, never stored. ---- */
  /** What is measured and how it is aggregated, with a ratio's numerator and denominator. */
  calculation?: MetricCalc | null;
  /** The window the number is taken over. */
  window?: MetricWindow | null;
  /** A link to the exact report or query; without one a metric is not Defined. */
  sourceLink?: string;
  /** The query text, optional. */
  sourceQuery?: string;
  /** The team or person (id) who owns the source, when it is one of the workspace's; their people may verify it. */
  sourceOwnerId?: string | null;
  /** When in the period it refreshes ("Mondays"). */
  refreshNote?: string;
  /** Who last changed its calculation, window or source, and when: they may not verify it. */
  calcChangedBy?: Id | null;
  calcChangedAt?: string | null;
  /** Baselines per slice, old ones kept with why they were replaced (History). */
  baselines?: MetricBaseline[];
  /** The standing verification; absent or null when it isn't (or is no longer) verified. */
  verification?: MetricVerification | null;
  /** "Couldn't reproduce" attempts, oldest first (at most 20 kept). */
  verifyAttempts?: MetricVerification[];
  /** Why it is no longer Verified, when a change lapsed it. Cleared by the next verification. */
  lapse?: MetricLapse | null;
  /** People an admin named to verify it. */
  verifiers?: Id[];
  /** Passed to a new owner who hasn't confirmed yet (their old owner left). */
  handover?: MetricHandover | null;
  /** A reworded filter or exclusion the last verifier is asked to confirm. */
  toConfirm?: MetricToConfirm | null;
}

/** What is measured (MQ2): a count, sum, value, duration, ratio, or other (a formula in words). */
export type MetricMeasure = 'count' | 'sum' | 'value' | 'duration' | 'ratio' | 'other';
/** How it is aggregated over the window. `percentile` takes `percentile` (1 to 99). */
export type MetricAggregate = 'total' | 'mean' | 'median' | 'percentile' | 'latest';
/** One counted thing: what it counts, its filters and what it leaves out. A ratio has two (numerator, denominator). */
export interface MetricPart { name?: string; counts: string; filters: string; excludes: string }
/** The calculation (MQ2): two fields plus the parts. A ratio has a numerator and a denominator; other has a formula. */
export interface MetricCalc {
  measure: MetricMeasure;
  aggregate: MetricAggregate | null;
  /** For a percentile: 50, 90, 95, 99… */
  percentile?: number;
  /** For a mean of a count: per what ("day"). */
  per?: string;
  /** What it counts, its filters and what it leaves out (every measure but ratio and other). */
  part?: MetricPart;
  numerator?: MetricPart;
  denominator?: MetricPart;
  /** For other or composite: the formula in words. */
  formula?: string;
}
/** The window (MQ2): a point in time, rolling N days, per period, or cumulative since a date. */
export type MetricWindow =
  | { kind: 'point' }
  | { kind: 'rolling'; days: number }
  | { kind: 'period'; period: 'week' | 'month' | 'quarter' }
  | { kind: 'cumulative'; since: string };
/** A baseline for a slice (MQ2; one baseline concept with BL): the figure, the period it covers, when and how taken. */
export interface MetricBaseline {
  id: Id;
  /** The slice: a team, or the whole company (null), and an optional part (MT2). */
  teamId: Id | null;
  part?: string;
  value: number;
  /** The period it covers, in words ("Jul–Sep 2026"). */
  period: string;
  /** The day it was taken (yyyy-mm-dd), and how. */
  takenOn: string;
  how: string;
  by: Id;
  at: string;
  /** Taken from a source the metric no longer uses: to retake. */
  oldSource?: boolean;
  /** Replaced (in History): when, by whom and why. */
  replacedAt?: string | null;
  replacedBy?: Id | null;
  replacedWhy?: string;
}
/** A verification or a "Couldn't reproduce" attempt (MQ2): who, when, the period, the figure they got from the link and
    the figure Faro had for it (null when it had none), and their note. */
export interface MetricVerification {
  outcome: 'verified' | 'couldnt_reproduce';
  by: Id;
  at: string;
  period: string;
  figure: number;
  stored: number | null;
  /** Where the stored figure came from: a baseline, the latest reading, or nothing. */
  storedFrom: 'baseline' | 'reading' | null;
  note: string;
  /** For a "Couldn't reproduce": answered (the definition was edited, or the owner replied). */
  answered?: { by: Id; at: string; note: string } | null;
}
/** Why a metric lapsed from Verified (MQ2): what changed, who, when, their reason, and the verification it replaced. */
export interface MetricLapse {
  at: string;
  by: Id | null;
  /** 'change' (a calculation part, the window, the source link or the direction changed) or 'age' (12 months). */
  kind: 'change' | 'age';
  what: string[];
  why: string;
  was: { by: Id; at: string };
}
/** A metric passed to a new owner (MQ2): from whom, when and why; cleared when the new owner confirms. */
export interface MetricHandover { from: Id; at: string; why: string }
/** A rewording the last verifier is asked to confirm (MQ2): what was reworded, by whom and when. */
export interface MetricToConfirm { verifier: Id; by: Id; at: string; what: string[] }

/** A change to a metric its goals must show (MT3 rule 4): what it meant, or which way was better, from a week on. */
export interface MetricMark {
  /** The cycle week it was made in, and when. */
  week: number;
  at: string;
  by: Id;
  kind: 'definition' | 'direction' | 'source';
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
