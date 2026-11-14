/* The small charts a goal row draws (Spark, StageSpark) and the scale they share with the full charts. Apart from
   charts.tsx so a first visit's Home rows don't download the goal page's charts (backlog FD). */
import { planAt, type Point } from '../domain/plan';
import type { MilestoneAssessment } from '../domain/status';
import type { MetricGoal, RangeGoal } from '../domain/types';

export interface Frame { W: number; H: number; padL: number; padR: number; padT: number; padB: number }

export function scales(f: Frame, weeks: number, lo: number, hi: number) {
  const X = (w: number) => f.padL + w * ((f.W - f.padL - f.padR) / weeks);
  const Y = (v: number) => f.padT + ((f.H - f.padT - f.padB) * (hi - v)) / (hi - lo || 1);
  return { X, Y };
}
/** The plain scale the sparklines and the range chart use: a little room above and below the values, no axis. */
export function looseScales(f: Frame, weeks: number, values: number[]) {
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  lo -= pad; hi += pad;
  return scales(f, weeks, lo, hi);
}

export const line = (pts: [number, number][]) => pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');

/** A goal row's sparkline: the plan (or the range's limits) faint, the readings over it. */
export function Spark({ goal, weeks, series }: { goal: MetricGoal | RangeGoal; weeks: number; series: Point[] }) {
  const W = 96, H = 32;
  const f: Frame = { W, H, padL: 2, padR: 2, padT: 4, padB: 4 };
  const ref = goal.kind === 'metric' ? [goal.plan.start, goal.plan.target] : [goal.range.limit, ...(goal.range.bound === 'between' ? [goal.range.lower!] : [])];
  const { X, Y } = looseScales(f, weeks, [...ref, ...series.map((p) => p.value)]);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="spark">
      {goal.kind === 'metric'
        ? <polyline className="c-plan-faint" points={line(Array.from({ length: weeks + 1 }, (_, w) => [X(w), Y(planAt(goal.plan, w, weeks))]))} />
        : ref.map((v) => <line key={v} className="c-target" x1={2} x2={W - 2} y1={Y(v)} y2={Y(v)} />)}
      {series.length > 1 && <polyline className="c-act thin" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.length > 0 && <circle className="c-dot" cx={X(series[series.length - 1]!.week)} cy={Y(series[series.length - 1]!.value)} r={2.5} />}
    </svg>
  );
}

export function StageSpark({ a, width = 96 }: { a: MilestoneAssessment; width?: number }) {
  const n = a.stages.length || 1, gap = 3, bw = (width - (n - 1) * gap) / n;
  return (
    <svg width={width} height={32} viewBox={`0 0 ${width} 32`} aria-hidden="true" className="spark">
      {a.stages.map((s, i) => (
        <rect key={s.id} x={i * (bw + gap)} y={12} width={bw} height={8} rx={3} fill={`var(--${s.kind === 'done' ? 'done' : s.kind === 'planned' ? 'stale' : s.kind}-mark)`} />
      ))}
    </svg>
  );
}
