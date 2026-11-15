// Number sources (NR): the module's port, and the demo's seeded sources. A source reads a metric for a slice
// ({ teamId, part }) and gives the latest reading measured at or before `at`, or null; it throws only when unreachable.
// DEMO_SERIES is not in the kit (src/modules/metrics/numbers.ts can't be followed): which goal each slice follows,
// `add` and `short` are guesses, written down as gaps.
import { partKey } from './rules.mjs';

const DAY = 86400000;
export const DEMO_SERIES = [
  { source: 'CI analytics', metricId: 'metric_ci-time', teamId: null, part: '', follows: 'ns-ci', add: 0, short: 0 },
  { source: 'CI runner metrics', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'main branch pipelines', follows: 'lead-ci-time', add: 0, short: 0 },
  { source: 'CI runner metrics', metricId: 'metric_queue-wait', teamId: 'build', part: 'release pipelines', follows: null, add: 0, short: 1 },
];
const sameSlice = (a, b) => (a.teamId ?? null) === (b.teamId ?? null) && partKey(a.part || '') === partKey(b.part || '');

export function seededSeries(W, spec, behind = 0) {
  if (!spec.follows) return [];
  const c = W.cycle; const start = Date.parse(`${c.startDate}T00:00:00Z`);
  const byWeek = new Map();
  for (const ck of (W.checkIns || []).filter((x) => x.goalId === spec.follows && !x.removedAt && x.value !== null && x.value !== undefined && x.postedAt <= W.builtFor)) {
    const cur = byWeek.get(ck.week);
    if (!cur || ck.postedAt >= cur.postedAt) byWeek.set(ck.week, ck);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const pts = weeks.map((w) => ({ week: w, value: byWeek.get(w).value }));
  if (pts.length) {
    const last4 = pts.slice(-4);
    const steps = last4.slice(1).map((p, i) => p.value - last4[i].value);
    const step = steps.length ? Math.round(steps.reduce((s, x) => s + x, 0) / steps.length) : 0;
    pts.push({ week: pts[pts.length - 1].week + 1, value: pts[pts.length - 1].value + step });
  }
  const cut = pts.slice(0, Math.max(0, pts.length - (spec.short || 0) - behind));
  return cut.map((p) => ({ value: p.value + (spec.add || 0), at: new Date(start + (7 * p.week + c.reviewDay) * DAY + 9 * 3600000).toISOString() }));
}
/** The demo's sources, as NumberSource objects: { name, reads(metricId, slice) -> 'yes' | 'no-slice' | 'no', read(metricId, at, slice) }. */
export function demoSources(W, { behind = 0 } = {}) {
  const byName = new Map();
  for (const s of DEMO_SERIES) { if (!byName.has(s.source)) byName.set(s.source, []); byName.get(s.source).push(s); }
  return [...byName.entries()].map(([name, specs]) => ({
    name,
    reads(metricId, slice) {
      const mine = specs.filter((s) => s.metricId === metricId);
      if (!mine.length) return 'no';
      return mine.some((s) => sameSlice(s, slice)) ? 'yes' : 'no-slice';
    },
    read(metricId, at, slice) {
      const s = specs.find((x) => x.metricId === metricId && sameSlice(x, slice));
      if (!s) return null;
      const ser = seededSeries(W, s, behind).filter((p) => Date.parse(p.at) <= Date.parse(at));
      return ser.length ? ser[ser.length - 1] : null;
    },
  }));
}
/** The source that reads a metric (for a slice, or only the whole company), or null. */
export function sourceFor(sources, metricId, slice) {
  for (const s of sources) { const r = s.reads(metricId, slice); if (r !== 'no') return { source: s, readsSlice: r === 'yes' }; }
  return null;
}
