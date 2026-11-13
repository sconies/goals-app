/* The metric library's outside part (backlog 8c; module map F9): where a metric's numbers come from (a dashboard, a
   warehouse, a monitoring tool), so a check-in can open with the latest reading (NR). It is the module's, not the core's:
   the core's ports never name a metric. The demo's source is ./numbers.ts; real ones are the internal team's, each
   passing `numberSourceContract` (./source.contract.ts). */

/** One reading of a metric, from where its numbers come from. */
export interface Reading {
  value: number;
  /** When the source measured it (an ISO time). */
  at: string;
}

/** What a number source reads of a metric: which one, and where its numbers come from. The metric library's records
    (src/modules/metrics) are a module's, not the core's, so the port names only what it reads. */
export interface SourcedMetric {
  id: string;
  /** Where its number comes from: a number source of this name reads it. */
  source: string;
  removedAt?: string | null;
}

/** Whose number, and which part of it: a link's slice (MT4 5.1; NR). `teamId` null is the whole company; `part` '' is
    all of it. */
export interface Slice {
  teamId: string | null;
  part: string;
}

/** Where a metric's numbers come from (a dashboard, a warehouse, a monitoring tool), so it can fill itself in. */
export interface NumberSource {
  /** Its name as a metric's `source` names it (e.g. "CI analytics"). */
  readonly name: string;
  /** Whether it can read this metric; given a slice, whether it reads that slice (left out: any slice). A company-wide
      number is never a team's: a source that reads only the whole company says false for a team's slice. */
  reads(metric: SourcedMetric, slice?: Slice): boolean;
  /** The latest reading at or before `at` (of the slice, when given); null when it has none yet. Throws only when it
      can't be reached: "no number" is null. */
  read(metric: SourcedMetric, at: Date, slice?: Slice): Promise<Reading | null>;
}

/** The slice of a link: its team, or the whole company, and its part ('' for all of it). */
export const sliceOf = (l: { teamId: string | null; part?: string }): Slice => ({ teamId: l.teamId, part: l.part ?? '' });
