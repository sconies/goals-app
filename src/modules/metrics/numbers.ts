/* The demo's number sources (backlog 8c; NR1, docs/design/round-4/readings/spec.md section 5, and MT4's 5.2): "CI
   analytics" reads CI pipeline time on main (p90) for the whole company, and "CI runner metrics" reads Pipeline queue
   wait (p90) for two slices of CI/CD's and Build & Release's pipelines. Each is a seeded series by week, fixed when the
   source is made from the example as it was seeded (never the live check-ins, so a check-in can't fill in its own
   number): the example's own numbers for the goal the slice measures, continued one week past its last check-in, each
   measured at 09:00 UTC on the week's review day. One slice has no reading in the last week. `behindWeeks` drops the
   last weeks of every series (the eval fixture "two weeks behind"). Real sources (a warehouse, a dashboard's API, a
   monitoring tool) are the internal team's: each is a NumberSource that passes ./source.contract.ts. It is the metric
   module's (AS part 2): only a module with metrics has a source for them. */
import { reviewDate } from '../../domain/progress';
import type { Cycle, Snapshot } from '../../domain/types';
import type { NumberSource, Reading, Slice } from './source';
import type { Metric } from './types';

export const DEMO_SOURCE = 'CI analytics';
export const DEMO_RUNNER_SOURCE = 'CI runner metrics';

/** One seeded series: whose number it is, the goal whose numbers it carries, and how it differs from them. */
export interface SeriesDef {
  source: string;
  metric: string;
  slice: Slice;
  /** The goal whose seeded check-ins are its numbers. */
  from: string;
  /** Added to each number (another slice of the same pipelines). */
  add?: number;
  /** Weeks left out at its end: a slice with no reading this week. */
  short?: number;
}

export const DEMO_SERIES: readonly SeriesDef[] = [
  { source: DEMO_SOURCE, metric: 'metric_ci-time', slice: { teamId: null, part: '' }, from: 'ns-ci' },
  { source: DEMO_RUNNER_SOURCE, metric: 'metric_queue-wait', slice: { teamId: 'cicd', part: 'main branch pipelines' }, from: 'lead-ci-time' },
  { source: DEMO_RUNNER_SOURCE, metric: 'metric_queue-wait', slice: { teamId: 'build', part: 'release pipelines' }, from: 'lead-ci-time', add: 3, short: 1 },
];

const key = (p: string) => p.trim().toLowerCase();
const sameSlice = (a: Slice, b: Slice) => a.teamId === b.teamId && key(a.part) === key(b.part);

/** A series' readings, oldest first: the goal's latest check-in of each week, then one more week, continued by the mean
    step of its last four numbers (rounded to whole numbers), each measured at 09:00 UTC on its week's review day. */
export function seededSeries(d: SeriesDef, seed: Pick<Snapshot, 'checkIns'>, cycle: Cycle, behindWeeks = 0): Reading[] {
  const byWeek = new Map<number, number>();
  for (const c of seed.checkIns.filter((x) => x.goalId === d.from && x.value != null && !x.removedAt).sort((a, b) => a.week - b.week || a.postedAt.localeCompare(b.postedAt))) byWeek.set(c.week, c.value!);
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  if (!weeks.length) return [];
  const last = weeks.at(-1)!;
  const tail = weeks.slice(-4).map((w) => byWeek.get(w)!);
  const step = tail.length > 1 ? (tail.at(-1)! - tail[0]!) / (tail.length - 1) : 0;
  if (last < cycle.weeks) byWeek.set(last + 1, Math.round(byWeek.get(last)! + step));
  const all = [...byWeek.keys()].sort((a, b) => a - b);
  const keep = all.slice(0, Math.max(0, all.length - (d.short ?? 0) - behindWeeks));
  return keep.map((w) => ({ value: byWeek.get(w)! + (d.add ?? 0), at: `${reviewDate(cycle, w)}T09:00:00.000Z` }));
}

/** What the demo's sources say for a metric's slice at `at`, without asking (the conformance rows read it): the latest
    reading, null when none yet, 'no-slice' when they read the metric but not this slice; undefined when no demo source
    reads the metric. */
export function demoReadingAt(seed: Pick<Snapshot, 'checkIns'>, cycle: Cycle, metric: Pick<Metric, 'id' | 'source'>, slice: Slice, at: Date): Reading | null | 'no-slice' | undefined {
  const defs = DEMO_SERIES.filter((d) => d.metric === metric.id && d.source === metric.source);
  if (!defs.length) return undefined;
  const d = defs.find((x) => sameSlice(x.slice, slice));
  if (!d) return 'no-slice';
  return seededSeries(d, seed, cycle).filter((r) => Date.parse(r.at) <= at.getTime()).at(-1) ?? null;
}

/** The demo's two sources, their series made once from the seeded example (`seed`). */
export function demoSources(seed: Pick<Snapshot, 'checkIns'>, cycle: Cycle, opts: { behindWeeks?: number } = {}): NumberSource[] {
  const series = DEMO_SERIES.map((d) => ({ d, readings: seededSeries(d, seed, cycle, opts.behindWeeks ?? 0) }));
  return [DEMO_SOURCE, DEMO_RUNNER_SOURCE].map((name): NumberSource => {
    const mine = (m: Pick<Metric, 'id' | 'source' | 'removedAt'>, slice?: Slice) =>
      m.source === name && !m.removedAt ? series.filter((x) => x.d.source === name && x.d.metric === m.id && (!slice || sameSlice(x.d.slice, slice))) : [];
    return {
      name,
      reads: (m, slice) => mine(m, slice).length > 0,
      async read(m, at, slice) {
        // Left out, the slice is any: the first this source reads (the whole company's, where it has one).
        const s = mine(m, slice)[0];
        if (!s) return null;
        return s.readings.filter((r) => Date.parse(r.at) <= at.getTime()).at(-1) ?? null;
      },
    };
  });
}
