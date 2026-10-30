import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { planAt, type Point } from '../domain/plan';
import type { MilestoneAssessment, StageState } from '../domain/status';
import { fmt } from '../domain/format';
import type { MetricGoal, RangeGoal } from '../domain/types';
import { Chip, Dot } from './bits';

/** Measures its own width so charts draw at real size: text stays 11px at any width. */
function Sized({ height, children, className }: { height: number; children: (w: number) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className={className} style={{ height, width: '100%' }}>{w > 0 && children(w)}</div>;
}

interface Frame { W: number; H: number; padL: number; padR: number; padT: number; padB: number }

function scales(f: Frame, weeks: number, values: number[]) {
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  lo -= pad; hi += pad;
  const X = (w: number) => f.padL + w * ((f.W - f.padL - f.padR) / weeks);
  const Y = (v: number) => f.padT + ((f.H - f.padT - f.padB) * (hi - v)) / (hi - lo || 1);
  return { lo, hi, X, Y };
}

const line = (pts: [number, number][]) => pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
const ticksFor = (weeks: number, today: number, wide: boolean) =>
  [...new Set(wide ? [0, Math.round(weeks / 3), Math.round((2 * weeks) / 3), weeks, today] : [0, today, weeks])].sort((a, b) => a - b);

interface MetricProps { goal: MetricGoal; weeks: number; week: number; series: Point[]; forecast: number | null; ptgBy?: number | null; height?: number }

export function MetricChart(p: MetricProps) {
  return <Sized height={p.height ?? 220}>{(w) => <MetricSvg {...p} W={w} H={p.height ?? 220} />}</Sized>;
}

function MetricSvg({ goal, weeks, week, series, forecast, ptgBy, W, H }: MetricProps & { W: number; H: number }) {
  const compact = W < 420;
  const f: Frame = { W, H, padL: compact ? 34 : 44, padR: 12, padT: 24, padB: 22 };
  const { plan, originalPlan } = goal;
  const vals = [plan.start, plan.target, ...series.map((p) => p.value)];
  if (originalPlan) vals.push(originalPlan.target);
  if (forecast != null) vals.push(forecast);
  const { lo, hi, X, Y } = scales(f, weeks, vals);
  const planPts = (pl: MetricGoal['plan']) => Array.from({ length: weeks + 1 }, (_, w) => [X(w), Y(planAt(pl, w, weeks))] as [number, number]);
  const last = series[series.length - 1];
  const label = `${goal.title}: ${last ? 'latest ' + fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, plan for week ${week} ${fmt(planAt(plan, week, weeks), goal)}, target ${fmt(plan.target, goal)}`;
  const ticks = compact ? [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1] : [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  return (
    <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line className="c-grid" x1={f.padL} x2={W - f.padR} y1={Y(v)} y2={Y(v)} />
          <text className="c-axis" x={f.padL - 6} y={Y(v) + 4} textAnchor="end">{v.toFixed(goal.decimals === 0 ? 0 : 1)}</text>
        </g>
      ))}
      {ticksFor(weeks, week, !compact).map((w) => <text key={w} className="c-axis" x={X(w)} y={H - 6} textAnchor="middle">{w === week ? 'Now' : 'Wk ' + w}</text>)}
      <line className="c-today" x1={X(week)} x2={X(week)} y1={f.padT - 6} y2={H - f.padB} />
      <line className="c-target" x1={f.padL} x2={W - f.padR} y1={Y(plan.target)} y2={Y(plan.target)} />
      <text className="c-target-t" x={f.padL + 4} y={Y(plan.target) + (plan.target < plan.start ? 14 : -6)}>Target {fmt(plan.target, goal)}</text>
      {originalPlan && <polyline className="c-orig" points={line(planPts(originalPlan))} />}
      <polyline className="c-plan" points={line(planPts(plan))} />
      {last && forecast != null && <polyline className="c-fc" points={line([[X(last.week), Y(last.value)], [X(weeks), Y(forecast)]])} />}
      {last && ptgBy != null && ptgBy > last.week && (
        <>
          <polyline className="c-ptg" points={line([[X(last.week), Y(last.value)], [X(ptgBy), Y(planAt(plan, ptgBy, weeks))]])} />
          <circle className="c-ptg-dot" cx={X(ptgBy)} cy={Y(planAt(plan, ptgBy, weeks))} r={5} />
        </>
      )}
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {last && <circle className="c-dot" cx={X(last.week)} cy={Y(last.value)} r={4.5} />}
    </svg>
  );
}

export function MetricLegend({ goal, forecast, ptg }: { goal: MetricGoal; forecast: boolean; ptg: boolean }) {
  return (
    <figcaption className="legend">
      <span><i className="l-act" />Actual</span>
      <span><i className="l-plan" />Plan</span>
      {goal.originalPlan && <span><i className="l-orig" />Original plan</span>}
      {forecast && <span><i className="l-fc" />If nothing changes</span>}
      {ptg && <span><i className="l-ptg" />Path to green</span>}
    </figcaption>
  );
}

interface RangeProps { goal: RangeGoal; weeks: number; week: number; series: Point[]; height?: number }

export function RangeChart(p: RangeProps) {
  return <Sized height={p.height ?? 200}>{(w) => <RangeSvg {...p} W={w} H={p.height ?? 200} />}</Sized>;
}

function RangeSvg({ goal, weeks, week, series, W, H }: RangeProps & { W: number; H: number }) {
  const compact = W < 420;
  const f: Frame = { W, H, padL: compact ? 34 : 44, padR: 12, padT: 24, padB: 22 };
  const { bound, limit, margin } = goal.range;
  const inner = bound === 'atMost' ? limit - margin : limit + margin;
  const m = Math.max(margin, 1);
  const { X, Y } = scales(f, weeks, [...series.map((p) => p.value), limit + (bound === 'atMost' ? 1.5 : -1.5) * m, limit - (bound === 'atMost' ? 3 : -3) * m]);
  const out = (v: number) => (bound === 'atMost' ? v > limit : v < limit);
  const last = series[series.length - 1];
  return (
    <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${goal.title}: ${last ? fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, limit ${fmt(limit, goal)}`}>
      <rect className="c-area" x={f.padL} y={Math.min(Y(limit), Y(inner))} width={W - f.padL - f.padR} height={Math.abs(Y(inner) - Y(limit))} />
      <line className="c-target" x1={f.padL} x2={W - f.padR} y1={Y(limit)} y2={Y(limit)} />
      <text className="c-target-t" x={f.padL + 4} y={Y(limit) - 6}>Limit {fmt(limit, goal)}{compact ? '' : ' · shaded: warning margin'}</text>
      {ticksFor(weeks, week, !compact).map((w) => <text key={w} className="c-axis" x={X(w)} y={H - 6} textAnchor="middle">{w === week ? 'Now' : 'Wk ' + w}</text>)}
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.map((p) => <circle key={p.week} cx={X(p.week)} cy={Y(p.value)} r={out(p.value) ? 5 : 3} className={out(p.value) ? 'c-breach' : 'c-dot'} />)}
    </svg>
  );
}

/** A tiny trend line for lists: actuals against plan, no axes. */
export function Spark({ goal, weeks, series }: { goal: MetricGoal | RangeGoal; weeks: number; series: Point[] }) {
  const W = 96, H = 32;
  const f: Frame = { W, H, padL: 2, padR: 2, padT: 4, padB: 4 };
  const ref = goal.kind === 'metric' ? [goal.plan.start, goal.plan.target] : [goal.range.limit];
  const { X, Y } = scales(f, weeks, [...ref, ...series.map((p) => p.value)]);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="spark">
      {goal.kind === 'metric'
        ? <polyline className="c-plan-faint" points={line(Array.from({ length: weeks + 1 }, (_, w) => [X(w), Y(planAt(goal.plan, w, weeks))]))} />
        : <line className="c-target" x1={2} x2={W - 2} y1={Y(goal.range.limit)} y2={Y(goal.range.limit)} />}
      {series.length > 1 && <polyline className="c-act thin" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.length > 0 && <circle className="c-dot" cx={X(series[series.length - 1]!.week)} cy={Y(series[series.length - 1]!.value)} r={2.5} />}
    </svg>
  );
}

const stageKind = (s: StageState) => (s.kind === 'planned' ? 'planned' : s.kind);
export const stageTag = (s: StageState) =>
  s.kind === 'done' ? 'Done week ' + s.doneWeek + (s.weeksLate ? ' · ' + s.weeksLate + ' late' : '')
    : s.weeksLate > 0 ? 'Expected week ' + s.expectedWeek + ' · ' + s.weeksLate + ' late'
      : 'Due week ' + s.dueWeek;

export function StageList({ a }: { a: MilestoneAssessment }) {
  return (
    <ol className="stagelist">
      {a.stages.map((s) => (
        <li key={s.id}>
          <Dot k={stageKind(s)} />
          <span className="strong" style={{ flex: '1 1 160px' }}>{s.name}</span>
          <Chip k={stageKind(s)} label={stageTag(s)} />
        </li>
      ))}
    </ol>
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
