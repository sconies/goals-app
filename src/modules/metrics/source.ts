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

/** Where a metric's numbers come from (a dashboard, a warehouse, a monitoring tool), so it can fill itself in. */
export interface NumberSource {
  /** Its name as a metric's `source` names it (e.g. "CI analytics"). */
  readonly name: string;
  /** Whether it can read this metric. */
  reads(metric: SourcedMetric): boolean;
  /** The latest reading at or before `at`; null when it has none yet. */
  read(metric: SourcedMetric, at: Date): Promise<Reading | null>;
}
