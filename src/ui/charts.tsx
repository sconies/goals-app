import { isShare } from '../domain/checkin';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { planAt, planEnd, type Point } from '../domain/plan';
import type { MilestoneAssessment, StageState } from '../domain/status';
import { fmt } from '../domain/format';
import type { MetricGoal, RangeGoal } from '../domain/types';
import { StatusShape } from './bits';

/** Measures its own width so charts draw at real size: text stays 12px at any width. Grows to fit a key under the plot. */
function Sized({ height, children }: { height: number; children: (w: number) => ReactNode }) {
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
  return <div ref={ref} className="chart-box" style={{ minHeight: height, width: '100%' }}>{w > 0 && children(w)}</div>;
}

interface Frame { W: number; H: number; padL: number; padR: number; padT: number; padB: number }

/** Round ticks, 1, 2 or 5 × 10ⁿ apart, covering lo..hi in at most `steps` steps. */
export function niceTicks(lo: number, hi: number, steps: number): number[] {
  if (!(hi - lo > 1e-9)) { const d = Math.abs(hi) * 0.1 || 1; lo -= d; hi += d; }
  const mag = 10 ** Math.floor(Math.log10((hi - lo) / steps));
  for (const m of [1, 2, 5, 10, 20, 50]) {
    const step = m * mag;
    const a = Math.floor(lo / step + 1e-9), b = Math.ceil(hi / step - 1e-9);
    if (b - a <= steps) return Array.from({ length: b - a + 1 }, (_, i) => Number(((a + i) * step).toPrecision(12)));
  }
  return [lo, hi];
}

function scales(f: Frame, weeks: number, lo: number, hi: number) {
  const X = (w: number) => f.padL + w * ((f.W - f.padL - f.padR) / weeks);
  const Y = (v: number) => f.padT + ((f.H - f.padT - f.padB) * (hi - v)) / (hi - lo || 1);
  return { X, Y };
}
/** The plain scale the sparklines and the range chart use: a little room above and below the values, no axis. */
function looseScales(f: Frame, weeks: number, values: number[]) {
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  lo -= pad; hi += pad;
  return scales(f, weeks, lo, hi);
}

const line = (pts: [number, number][]) => pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
/** Week ticks: in a goal year, the start of each quarter and now (Q1, Q3 and now on a phone); otherwise thirds and now. */
const ticksFor = (weeks: number, today: number, wide: boolean) => {
  const year = weeks >= 48;
  const base = year ? (wide ? [0, 13, 26, 39, weeks] : [0, 26, weeks]) : wide ? [0, Math.round(weeks / 3), Math.round((2 * weeks) / 3), weeks] : [0, weeks];
  const near = year ? 4 : 0;
  return [...new Set([...base.filter((w) => Math.abs(w - today) > near || w === today), today])].filter((w) => w >= 0 && w <= weeks).sort((a, b) => a - b);
};
/** A tick for each week from the first to the last, or every other week (or more) when a week is under 44px; the last always. */
const weekTicks = (from: number, to: number, perWeek: number) => {
  const step = Math.max(1, Math.ceil(44 / Math.max(1, perWeek)));
  const out: number[] = [];
  for (let w = from; w < to; w += step) if (to - w >= step || w === from) out.push(w);
  return [...out, to];
};
const tickLabel = (w: number, week: number, weeks: number) => (w === week ? 'Now' : weeks >= 48 ? (w === 0 ? 'Q1' : w === 13 ? 'Q2' : w === 26 ? 'Q3' : w === 39 ? 'Q4' : 'Wk ' + w) : 'Wk ' + w);
/** About how wide a 12px label is. */
const textW = (t: string) => t.length * 6.8;

/** The week labels under the plot: the first starts at the axis, the last ends at the plot's edge, and any that would
 *  come within 12px (16px on a phone) of another are left out, Now first. */
function WeekLabels({ f, weeks, week, X, wide }: { f: Frame; weeks: number; week: number; X: (w: number) => number; wide: boolean }) {
  const gap = wide ? 12 : 16;
  const all = ticksFor(weeks, week, wide).map((w) => {
    const text = tickLabel(w, week, weeks), x = X(w), tw = textW(text);
    const anchor: 'start' | 'end' | 'middle' = w === 0 ? 'start' : w === weeks ? 'end' : 'middle';
    const left = Math.max(f.padL, anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2);
    return { w, text, x, anchor, left, right: left + tw };
  });
  const kept: typeof all = [];
  for (const t of [...all].sort((a, b) => Number(b.w === week) - Number(a.w === week) || a.w - b.w)) {
    if (kept.every((k) => t.right + gap <= k.left || t.left >= k.right + gap)) kept.push(t);
  }
  return <>{kept.map((t) => <text key={t.w} className="c-axis" x={t.anchor === 'middle' ? t.x : t.anchor === 'end' ? t.x : t.left} y={f.H - 5} textAnchor={t.anchor}>{t.text}</text>)}</>;
}

/**
 * The target (or limit): a label 4px clear above its line, with a halo so lines don't cross it. It sits at the right end of
 * the plot, unless the plan comes down onto the target there: then the left end, which the lines are far from.
 */
const TargetLabel = ({ f, y, left, children }: { f: Frame; y: number; left?: boolean; children: ReactNode }) => (
  <text className="c-target-t" x={left ? f.padL + 4 : f.W - f.padR} y={Math.max(12, y - 6)} textAnchor={left ? 'start' : 'end'}>{children}</text>
);

interface KeyItem { k: 'plan' | 'act' | 'fc' | 'orig' | 'ptg'; label: string }
/** One line of key under the plot, starting where the plot does: a sample of each line and its word. */
const ChartKey = ({ items, padL }: { items: KeyItem[]; padL: number }) =>
  items.length < 2 ? null : (
    <div className="chart-key" style={{ paddingLeft: padL }}>
      {items.map((it) => <span key={it.k}><i className={'l-' + it.k} aria-hidden="true" />{it.label}</span>)}
    </div>
  );

interface MetricProps { goal: MetricGoal; weeks: number; week: number; series: Point[]; forecast: number | null; ptgBy?: number | null; height?: number; showKey?: boolean;
  /** Draw only from this week to the plan's end, with a tick for each week (every other one when narrow): the plan preview. */
  fromWeek?: number;
}

export function MetricChart(p: MetricProps) {
  return <Sized height={p.height ?? 220}>{(w) => <MetricSvg {...p} W={w} H={p.height ?? 220} />}</Sized>;
}

function MetricSvg({ goal, weeks: cycleWeeks, week, series: allSeries, forecast, ptgBy, showKey = true, fromWeek, W, H }: MetricProps & { W: number; H: number }) {
  // A goal that runs past the cycle (to the end of the year) is drawn to its own end.
  const weeks = Math.max(cycleWeeks, planEnd(goal.plan, cycleWeeks));
  const x0 = fromWeek != null ? Math.max(0, Math.min(fromWeek, weeks - 1)) : 0;
  const series = x0 ? allSeries.filter((p) => p.week >= x0) : allSeries;
  const compact = W < 420;
  const { plan, originalPlan } = goal;
  const share = isShare(goal);
  const vals = [plan.start, plan.target, ...series.map((p) => p.value)];
  if (originalPlan) vals.push(originalPlan.target);
  if (forecast != null) vals.push(share ? Math.min(100, Math.max(0, forecast)) : forecast);
  // Round ticks that take in the target: five on a desktop, three or four on a phone.
  let ticks = niceTicks(Math.min(...vals), Math.max(...vals), compact ? 3 : 4);
  if (share) ticks = ticks.filter((t) => t >= 0 && t <= 100);
  const lo = ticks[0]!, hi = ticks[ticks.length - 1]!;
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  const dec = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
  const tickText = ticks.map((v) => v.toFixed(dec));
  const padL = Math.max(28, Math.ceil(Math.max(...tickText.map(textW))) + 8);
  // 20px under the plot is kept for the week labels.
  // With a tick each week (the plan preview), the last label is centred on the end, so it needs room to the right.
  const f: Frame = { W, H, padL, padR: fromWeek != null ? 20 : 12, padT: 24, padB: 20 };
  const { X: X0, Y } = scales(f, weeks - x0, lo, hi);
  const X = (w: number) => X0(w - x0);
  const planPts = (pl: MetricGoal['plan']) => Array.from({ length: weeks - x0 + 1 }, (_, i) => [X(x0 + i), Y(planAt(pl, x0 + i, weeks))] as [number, number]);
  const last = series[series.length - 1];
  const label = `${goal.title}: ${last ? 'latest ' + fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, plan for week ${week} ${fmt(planAt(plan, week, weeks), goal)}, target ${fmt(plan.target, goal)}`;
  // The trend if nothing changes. On a share it stops where it would reach 100% (or 0%); a stub too short to read is left out.
  const fc = (() => {
    if (!last || forecast == null) return null;
    const edge = share ? (forecast > 100 ? 100 : forecast < 0 ? 0 : null) : null;
    const endWeek = edge == null || forecast === last.value ? weeks : last.week + ((weeks - last.week) * (edge - last.value)) / (forecast - last.value);
    const pts: [number, number][] = [[X(last.week), Y(last.value)], [X(endWeek), Y(edge ?? forecast)]];
    const [[ax, ay], [bx, by]] = [pts[0]!, pts[1]!];
    return Math.hypot(bx - ax, by - ay) < 16 ? null : pts;
  })();
  const ptg = !!last && ptgBy != null && ptgBy > last.week;
  const items: KeyItem[] = [{ k: 'plan', label: 'Plan' }];
  if (series.length) items.push({ k: 'act', label: 'Actual' });
  if (fc) items.push({ k: 'fc', label: 'Projection' });
  if (originalPlan) items.push({ k: 'orig', label: 'Original plan' });
  if (ptg) items.push({ k: 'ptg', label: 'Path to green' });
  return (
    <>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line className="c-grid" x1={f.padL} x2={W - f.padR} y1={Y(v)} y2={Y(v)} />
            <text className="c-axis" x={f.padL - 8} y={Y(v) + 4} textAnchor="end">{tickText[i]}</text>
          </g>
        ))}
        {fromWeek != null
          ? weekTicks(x0, weeks, (W - f.padL - f.padR) / (weeks - x0)).map((w) => <text key={w} className="c-axis" x={X(w)} y={H - 5} textAnchor={w === x0 ? 'start' : 'middle'}>{w === week ? 'Now' : 'Wk ' + w}</text>)
          : <WeekLabels f={f} weeks={weeks} week={week} X={X} wide={!compact} />}
        <line className="c-today" x1={X(week)} x2={X(week)} y1={f.padT - 6} y2={H - f.padB} />
        <line className="c-target" x1={f.padL} x2={W - f.padR} y1={Y(plan.target)} y2={Y(plan.target)} />
        {originalPlan && <polyline className="c-orig" points={line(planPts(originalPlan))} />}
        <polyline className="c-plan" points={line(planPts(plan))} />
        {fc && <polyline className="c-fc" points={line(fc)} />}
        {last && ptg && (
          <>
            <polyline className="c-ptg" points={line([[X(last.week), Y(last.value)], [X(ptgBy!), Y(planAt(plan, ptgBy!, weeks))]])} />
            <circle className="c-ptg-dot" cx={X(ptgBy!)} cy={Y(planAt(plan, ptgBy!, weeks))} r={5} />
          </>
        )}
        {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
        {last && <circle className="c-dot" cx={X(last.week)} cy={Y(last.value)} r={4.5} />}
        <TargetLabel f={f} y={Y(plan.target)} left={plan.target < plan.start}>Target {fmt(plan.target, goal)}</TargetLabel>
      </svg>
      {showKey && <ChartKey items={items} padL={f.padL} />}
    </>
  );
}

interface RangeProps { goal: RangeGoal; weeks: number; week: number; series: Point[]; height?: number }

export function RangeChart(p: RangeProps) {
  return <Sized height={p.height ?? 200}>{(w) => <RangeSvg {...p} W={w} H={p.height ?? 200} />}</Sized>;
}

function RangeSvg({ goal, weeks, week, series, W, H }: RangeProps & { W: number; H: number }) {
  const compact = W < 420;
  const f: Frame = { W, H, padL: compact ? 34 : 44, padR: 12, padT: 24, padB: 20 };
  const { bound, limit, margin } = goal.range;
  const inner = bound === 'atMost' ? limit - margin : limit + margin;
  const m = Math.max(margin, 1);
  const { X, Y } = looseScales(f, weeks, [...series.map((p) => p.value), limit + (bound === 'atMost' ? 1.5 : -1.5) * m, limit - (bound === 'atMost' ? 3 : -3) * m]);
  const out = (v: number) => (bound === 'atMost' ? v > limit : v < limit);
  const last = series[series.length - 1];
  return (
    <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${goal.title}: ${last ? fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, limit ${fmt(limit, goal)}`}>
      <rect className="c-area" x={f.padL} y={Math.min(Y(limit), Y(inner))} width={W - f.padL - f.padR} height={Math.abs(Y(inner) - Y(limit))} />
      <line className="c-target" x1={f.padL} x2={W - f.padR} y1={Y(limit)} y2={Y(limit)} />
      <WeekLabels f={f} weeks={weeks} week={week} X={X} wide={!compact} />
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.map((p) => <circle key={p.week} cx={X(p.week)} cy={Y(p.value)} r={out(p.value) ? 5 : 3} className={out(p.value) ? 'c-breach' : 'c-dot'} />)}
      <TargetLabel f={f} y={Y(limit)}>Limit {fmt(limit, goal)}{compact ? '' : ' · shaded: warning margin'}</TargetLabel>
    </svg>
  );
}

/** A tiny trend line for lists: actuals against plan, no axes. */
export function Spark({ goal, weeks, series }: { goal: MetricGoal | RangeGoal; weeks: number; series: Point[] }) {
  const W = 96, H = 32;
  const f: Frame = { W, H, padL: 2, padR: 2, padT: 4, padB: 4 };
  const ref = goal.kind === 'metric' ? [goal.plan.start, goal.plan.target] : [goal.range.limit];
  const { X, Y } = looseScales(f, weeks, [...ref, ...series.map((p) => p.value)]);
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
const weeksLate = (n: number) => (n === 1 ? '1 week' : n + ' weeks') + ' late';
/** "Expected week 45 · 3 weeks late, due week 42": what's late, by how much, and against which date. */
export const stageTag = (s: StageState) =>
  s.kind === 'done' ? 'Done week ' + s.doneWeek + (s.weeksLate ? ' · ' + weeksLate(s.weeksLate) + ', due week ' + s.dueWeek : '')
    : s.weeksLate > 0 ? 'Expected week ' + s.expectedWeek + ' · ' + weeksLate(s.weeksLate) + ', due week ' + s.dueWeek
      : 'Due week ' + s.dueWeek;

/** Stages as rows: the name, then the stage's state as a shape and its words. On a narrow screen, how late goes on its own line. */
export function StageList({ a }: { a: MilestoneAssessment }) {
  return (
    <ol className="stagelist">
      {a.stages.map((s) => {
        const [when, late] = stageTag(s).split(' · ');
        return (
          <li key={s.id}>
            <span className="strong stage-name">{s.name}</span>
            <span className={'chip stage-tag ' + stageKind(s)}>
              <StatusShape k={stageKind(s)} />
              <span><span className="stage-when">{when}</span>{late && <span className="stage-late"><span className="stage-sep"> · </span>{late}</span>}</span>
            </span>
          </li>
        );
      })}
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

/** A quarter's result in words, each number kept on one line with its unit; `short` for a table cell: "47% · plan 46%". */
export const quarterWords = (text: string, short = false) => {
  let t = text.replace(/^Q\d: /, '');
  if (short) t = t.replace(/ against a plan of /, ' · plan ');
  return t.replace(/(\d) (?=[A-Za-z%])/g, '$1 ').replace(/\b(plan|of) (?=[\d-])/g, '$1 ');
};

/**
 * How a quarter came out, as a mark and a word: Met and Missed use the status shapes for on and off track. The other two
 * are not statuses, so they get marks of their own: a quarter under way is a ring filling as its weeks pass (a dashed
 * ring would read as No recent update), and a quarter with nothing due is a short grey dash.
 */
export function QuarterMark({ kind, done = 0 }: { kind: 'met' | 'missed' | 'open' | 'none'; done?: number }) {
  if (kind === 'met') return <StatusShape k="on" />;
  if (kind === 'missed') return <StatusShape k="off" />;
  if (kind === 'none') return <svg className="q-mark q-dash" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  const r = 5, c = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, done));
  return (
    <svg className="q-mark q-ring" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r={r} fill="none" stroke="var(--track)" strokeWidth="2" />
      {frac > 0 && <circle cx="6" cy="6" r={r} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 6 6)" />}
    </svg>
  );
}
