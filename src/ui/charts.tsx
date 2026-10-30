import { planAt, type Point } from '../domain/plan';
import type { MilestoneAssessment, StageState } from '../domain/status';
import { fmt } from '../domain/format';
import type { MetricGoal, RangeGoal } from '../domain/types';
import { Chip, Dot } from './bits';

interface Frame { W: number; H: number; padL: number; padR: number; padT: number; padB: number }
const FULL: Frame = { W: 760, H: 240, padL: 48, padR: 20, padT: 22, padB: 28 };
const MINI: Frame = { W: 240, H: 64, padL: 4, padR: 4, padT: 6, padB: 6 };

function scales(f: Frame, weeks: number, values: number[]) {
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  lo -= pad; hi += pad;
  const X = (w: number) => f.padL + w * ((f.W - f.padL - f.padR) / weeks);
  const Y = (v: number) => f.padT + ((f.H - f.padT - f.padB) * (hi - v)) / (hi - lo || 1);
  return { lo, hi, X, Y };
}

const line = (pts: [number, number][]) => pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
const ticksFor = (weeks: number, today: number) =>
  [...new Set([0, Math.round(weeks / 3), Math.round((2 * weeks) / 3), weeks, today])].sort((a, b) => a - b);

export function MetricChart({ goal, weeks, week, series, forecast, ptgBy, height = 240, mini = false }: {
  goal: MetricGoal; weeks: number; week: number; series: Point[]; forecast: number | null; ptgBy?: number | null; height?: number; mini?: boolean;
}) {
  const f = mini ? MINI : { ...FULL, H: height };
  const { plan, originalPlan } = goal;
  const vals = [plan.start, plan.target, ...series.map((p) => p.value)];
  if (originalPlan) vals.push(originalPlan.target);
  if (forecast != null && !mini) vals.push(forecast);
  const { lo, hi, X, Y } = scales(f, weeks, vals);
  const planPts = (p: MetricGoal['plan']) => Array.from({ length: weeks + 1 }, (_, w) => [X(w), Y(planAt(p, w, weeks))] as [number, number]);
  const last = series[series.length - 1];
  const label = `${goal.title}: ${last ? 'latest ' + fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, plan for week ${week} ${fmt(planAt(plan, week, weeks), goal)}, target ${fmt(plan.target, goal)}`;
  return (
    <svg className="chart" viewBox={`0 0 ${f.W} ${f.H}`} role="img" aria-label={label}>
      {!mini && (
        <>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = lo + ((hi - lo) * i) / 4;
            return (
              <g key={i}>
                <line className="c-grid" x1={f.padL} x2={f.W - f.padR} y1={Y(v)} y2={Y(v)} />
                <text className="c-axis" x={f.padL - 8} y={Y(v) + 4} textAnchor="end">{v.toFixed(goal.decimals === 0 ? 0 : 1)}</text>
              </g>
            );
          })}
          {ticksFor(weeks, week).map((w) => (
            <text key={w} className="c-axis" x={X(w)} y={f.H - 8} textAnchor="middle">Wk {w}</text>
          ))}
          <line className="c-today" x1={X(week)} x2={X(week)} y1={f.padT} y2={f.H - f.padB} />
          <text className="c-today-t" x={X(week)} y={14} textAnchor="middle">Today · week {week}</text>
        </>
      )}
      <line className="c-target" x1={f.padL} x2={f.W - f.padR} y1={Y(plan.target)} y2={Y(plan.target)} />
      {!mini && <text className="c-target-t" x={f.W - f.padR} y={Y(plan.target) - 6} textAnchor="end">Target {fmt(plan.target, goal)}</text>}
      {originalPlan && !mini && <polyline className="c-orig" points={line(planPts(originalPlan))} />}
      <polyline className={mini ? 'c-plan-faint' : 'c-plan'} points={line(planPts(plan))} />
      {last && forecast != null && !mini && <polyline className="c-fc" points={line([[X(last.week), Y(last.value)], [X(weeks), Y(forecast)]])} />}
      {last && ptgBy != null && ptgBy > last.week && !mini && (
        <>
          <polyline className="c-ptg" points={line([[X(last.week), Y(last.value)], [X(ptgBy), Y(planAt(plan, ptgBy, weeks))]])} />
          <circle className="c-ptg-dot" cx={X(ptgBy)} cy={Y(planAt(plan, ptgBy, weeks))} r={5} />
        </>
      )}
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {last && <circle className="c-dot" cx={X(last.week)} cy={Y(last.value)} r={mini ? 3 : 4.5} />}
    </svg>
  );
}

export function MetricLegend({ goal, forecast, ptg }: { goal: MetricGoal; forecast: boolean; ptg: boolean }) {
  return (
    <figcaption className="legend">
      <span><i className="l-act" />Actual</span>
      <span><i className="l-plan" />Plan</span>
      {goal.originalPlan && <span><i className="l-orig" />Original plan</span>}
      {forecast && <span><i className="l-fc" />Forecast if nothing changes</span>}
      {ptg && <span><i className="l-ptg" />Path to green</span>}
      <span><i className="l-target" />Target</span>
    </figcaption>
  );
}

export function RangeChart({ goal, weeks, week, series, height = 220, mini = false }: {
  goal: RangeGoal; weeks: number; week: number; series: Point[]; height?: number; mini?: boolean;
}) {
  const f = mini ? MINI : { ...FULL, H: height };
  const { bound, limit, margin } = goal.range;
  const inner = bound === 'atMost' ? limit - margin : limit + margin;
  const { X, Y } = scales(f, weeks, [...series.map((p) => p.value), limit + (bound === 'atMost' ? 1.5 : -1.5) * Math.max(margin, 1), limit - (bound === 'atMost' ? 3 : -3) * Math.max(margin, 1)]);
  const out = (v: number) => (bound === 'atMost' ? v > limit : v < limit);
  const last = series[series.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${f.W} ${f.H}`} role="img" aria-label={`${goal.title}: ${last ? fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, limit ${fmt(limit, goal)}`}>
      <rect className="c-area" x={f.padL} y={Math.min(Y(limit), Y(inner))} width={f.W - f.padL - f.padR} height={Math.abs(Y(inner) - Y(limit))} />
      <line className="c-target" x1={f.padL} x2={f.W - f.padR} y1={Y(limit)} y2={Y(limit)} />
      {!mini && (
        <>
          <text className="c-target-t" x={f.W - f.padR} y={Y(limit) - 6} textAnchor="end">Limit {fmt(limit, goal)} · shaded: warning margin</text>
          {ticksFor(weeks, week).map((w) => <text key={w} className="c-axis" x={X(w)} y={f.H - 8} textAnchor="middle">Wk {w}</text>)}
        </>
      )}
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.filter((p) => out(p.value)).map((p) => <circle key={p.week} cx={X(p.week)} cy={Y(p.value)} r={mini ? 3 : 4.5} fill="var(--off-mark)" />)}
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
    <div className="stack" style={{ gap: 0 }}>
      {a.stages.map((s, i) => (
        <div key={s.id} className="row" style={{ padding: '8px 4px', borderTop: i ? '1px solid var(--line-2)' : 0 }}>
          <Dot k={stageKind(s)} />
          <span style={{ flex: '1 1 180px' }} className="strong">{s.name}</span>
          <span className="small muted">Due week {s.dueWeek}</span>
          <Chip k={stageKind(s)} label={stageTag(s)} />
        </div>
      ))}
    </div>
  );
}

export function StageSpark({ a, width = 120 }: { a: MilestoneAssessment; width?: number }) {
  const n = a.stages.length || 1, gap = 4, bw = (width - (n - 1) * gap) / n;
  return (
    <svg width={width} height={32} viewBox={`0 0 ${width} 32`} role="img" aria-label={`${a.doneCount} of ${a.stages.length} stages done`}>
      {a.stages.map((s, i) => (
        <rect key={s.id} x={i * (bw + gap)} y={11} width={bw} height={10} rx={3} fill={`var(--${s.kind === 'done' ? 'done' : s.kind === 'planned' ? 'stale' : s.kind}-mark)`} />
      ))}
    </svg>
  );
}
