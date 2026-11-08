import { fixed } from '../domain/numbers';
import { isShare } from '../domain/checkin';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { planAt, planEnd, type Point, type Projection } from '../domain/plan';
import type { MilestoneAssessment, StageState } from '../domain/status';
import { fmt } from '../domain/format';
import type { MetricGoal, RangeGoal } from '../domain/types';
import type { ChartMarks } from '../domain/scorecard';
import { StatusShape } from './bits';
import { lower, STAGE } from '../domain/vocabulary';

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
  <text className="c-target-t" x={left ? f.padL + 4 : f.W - f.padR} y={targetLabelY(y)} textAnchor={left ? 'start' : 'end'}>{children}</text>
);
const targetLabelY = (y: number) => Math.max(12, y - 6);

/**
 * Which way is good, in the plot's top-left corner (Lane, 5 Nov: "show on the chart if up or down is better"): an arrow
 * and the words, so nobody has to work out from the target whether a falling line is good news.
 */
export const betterUp = (goal: MetricGoal | RangeGoal) => (goal.kind === 'metric' ? goal.plan.target >= goal.plan.start : goal.range.bound === 'atLeast');
const Better = ({ up, x }: { up: boolean; x: number }) => (
  <g className="c-better" data-better={up ? 'up' : 'down'}>
    <path className="c-better-arrow" d={up ? `M${x + 4} 15V4M${x} 8l4-4 4 4` : `M${x + 4} 4v11M${x} 11l4 4 4-4`} aria-hidden="true" />
    <text className="c-better-t" x={x + 13} y={13}>{up ? 'Higher is better' : 'Lower is better'}</text>
  </g>
);

interface KeyItem { k: 'plan' | 'act' | 'fc' | 'orig' | 'ptg'; label: string }

/**
 * Reading any week off a chart (the flagship goal page, 5 Nov): drag or point along it, or use the arrow keys once it
 * has focus. `read` says the week in words; the line and the words go when the pointer leaves or Escape is pressed.
 */
export interface Scrub { read: (week: number) => string | null; hint?: string }

function useScrub(weeks: number, x0: number, toWeek: (x: number) => number, scrub: Scrub | undefined, now: number) {
  const [at, setAt] = useState<number | null>(null);
  const down = useRef(false);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.max(x0, Math.min(weeks, Math.round(toWeek(e.clientX - r.left)))));
  };
  if (!scrub) return { at: null, svg: {}, wrap: {}, readout: null };
  return {
    at,
    svg: {
      onPointerDown: (e: PointerEvent<SVGSVGElement>) => { down.current = true; pick(e); },
      onPointerMove: (e: PointerEvent<SVGSVGElement>) => { if (down.current || e.pointerType === 'mouse') pick(e); },
      onPointerUp: () => { down.current = false; },
      onPointerLeave: () => { down.current = false; setAt(null); },
      onPointerCancel: () => { down.current = false; setAt(null); },
    },
    wrap: {
      tabIndex: 0,
      role: 'group',
      'aria-label': 'Week by week: press the left and right arrow keys to read each week',
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setAt((w) => Math.max(x0, Math.min(weeks, (w ?? now) + (e.key === 'ArrowLeft' ? -1 : 1)))); }
        else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setAt(e.key === 'Home' ? x0 : weeks); }
        else if (e.key === 'Escape') setAt(null);
      },
      onBlur: () => setAt(null),
    },
    readout: <p className={'chart-read' + (at == null ? ' hint' : '')} aria-live="polite">{at == null ? scrub.hint ?? 'Drag along the chart to read any week.' : scrub.read(at) ?? `Week ${at}: nothing reported.`}</p>,
  };
}
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
  /** The projection as a range (plan.ts): drawn as a widening band from the latest number, with its likeliest line. */
  projection?: Projection | null;
  /** Read any week by dragging along the chart or with the arrow keys. */
  scrub?: Scrub;
  /** Draw itself in turn: the plan, then the actual, then the projection and path to green; "now" pulses once. */
  draw?: boolean;
  /** The latest point has just been posted: it drops onto the line. */
  landed?: boolean;
  /** The target has been reached: its line lights. */
  hit?: boolean;
  /** The scorecard's numbers, marked where they are: the gap to plan at now, the likely end, and the gap from it to the target. */
  marks?: ChartMarks | null;
}

export function MetricChart(p: MetricProps) {
  return <Sized height={p.height ?? 220}>{(w) => <MetricSvg {...p} W={w} H={p.height ?? 220} />}</Sized>;
}

function MetricSvg({ goal, weeks: cycleWeeks, week, series: allSeries, forecast: fcValue, ptgBy, showKey = true, fromWeek, projection, scrub, draw, landed, hit, marks, W, H }: MetricProps & { W: number; H: number }) {
  // The projection's likeliest value is its line; without one, a plain forecast (the plan preview has neither).
  const forecast = projection ? projection.value : fcValue;
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
  const clampV = (v: number) => (share ? Math.min(100, Math.max(0, v)) : v);
  if (projection) vals.push(clampV(projection.low), clampV(projection.high));
  // Round ticks that take in the target: five on a desktop, three or four on a phone.
  let ticks = niceTicks(Math.min(...vals), Math.max(...vals), compact ? 3 : 4);
  if (share) ticks = ticks.filter((t) => t >= 0 && t <= 100);
  const lo = ticks[0]!, hi = ticks[ticks.length - 1]!;
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  const dec = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
  const tickText = ticks.map((v) => fixed(v, dec));
  const padL = Math.max(28, Math.ceil(Math.max(...tickText.map(textW))) + 8);
  // 20px under the plot is kept for the week labels.
  // With a tick each week (the plan preview), the last label is centred on the end, so it needs room to the right.
  // A bracket from the likely end to the target sits just past the plot's right edge.
  const f: Frame = { W, H, padL, padR: fromWeek != null ? 20 : marks?.end ? 16 : 12, padT: 24, padB: 20 };
  const { X: X0, Y } = scales(f, weeks - x0, lo, hi);
  const X = (w: number) => X0(w - x0);
  const planPts = (pl: MetricGoal['plan']) => Array.from({ length: weeks - x0 + 1 }, (_, i) => [X(x0 + i), Y(planAt(pl, x0 + i, weeks))] as [number, number]);
  const last = series[series.length - 1];
  const up = betterUp(goal);
  const label = `${goal.title}: ${last ? 'latest ' + fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, plan for week ${week} ${fmt(planAt(plan, week, weeks), goal)}, target ${fmt(plan.target, goal)}, ${up ? 'higher' : 'lower'} is better`;
  // The trend if nothing changes. On a share it stops where it would reach 100% (or 0%); a stub too short to read is left out.
  // The range: a band widening from the latest number to the low and high ends at the due week.
  const band = (() => {
    if (!last || !projection || Math.abs(projection.high - projection.low) < 1e-9) return null;
    const end = projection.week;
    return line([[X(last.week), Y(last.value)], [X(end), Y(clampV(projection.high))], [X(end), Y(clampV(projection.low))]]);
  })();
  const sc = useScrub(weeks, x0, (px) => x0 + ((px - f.padL) * (weeks - x0)) / (W - f.padL - f.padR), scrub, week);
  const atPoint = sc.at != null ? allSeries.find((p) => p.week === sc.at) : undefined;
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
  if (fc) items.push({ k: 'fc', label: band ? 'Projection, with its range' : 'Projection' });
  if (originalPlan) items.push({ k: 'orig', label: 'Original plan' });
  if (ptg) items.push({ k: 'ptg', label: 'Path to green' });
  const svg = (
      <svg className={'chart' + (draw ? ' draw' : '') + (scrub ? ' scrubbable' : '') + (hit ? ' hit' : '')} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...sc.svg}>
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
        {band && <polygon className="c-band" points={band} />}
        {fc && <polyline className="c-fc" points={line(fc)} />}
        {last && ptg && (
          <>
            <polyline className="c-ptg" points={line([[X(last.week), Y(last.value)], [X(ptgBy!), Y(planAt(plan, ptgBy!, weeks))]])} />
            <circle className="c-ptg-dot" cx={X(ptgBy!)} cy={Y(planAt(plan, ptgBy!, weeks))} r={5} />
          </>
        )}
        {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
        {last && draw && <circle className="c-dot-ring" cx={X(last.week)} cy={Y(last.value)} r={4.5} aria-hidden="true" />}
        {last && <circle className={'c-dot c-last' + (landed ? ' landed' : '')} cx={X(last.week)} cy={Y(last.value)} r={4.5} />}
        {/* With the end marked, the target's label moves to the left, clear of the brackets at the right. */}
        <TargetLabel f={f} y={Y(plan.target)} left={plan.target < plan.start || !!marks?.end}>Target {fmt(plan.target, goal)}</TargetLabel>
        <Better up={up} x={f.padL} />
        {marks && last && <Marks marks={marks} f={f} X={X} Y={Y} clampV={clampV} target={{ y: Y(plan.target), left: plan.target < plan.start || !!marks.end, text: `Target ${fmt(plan.target, goal)}` }} />}
        {sc.at != null && (
          <g className="c-scrub" aria-hidden="true">
            <line x1={X(sc.at)} x2={X(sc.at)} y1={f.padT - 6} y2={H - f.padB} />
            <circle className="c-scrub-plan" cx={X(sc.at)} cy={Y(planAt(plan, sc.at, weeks))} r={3.5} />
            {atPoint && <circle className="c-scrub-dot" cx={X(atPoint.week)} cy={Y(atPoint.value)} r={5} />}
          </g>
        )}
      </svg>
  );
  return (
    <>
      {scrub ? <div className="chart-scrub" {...sc.wrap}>{svg}</div> : svg}
      {sc.readout}
      {showKey && <ChartKey items={items} padL={f.padL} />}
    </>
  );
}

interface Box { l: number; r: number; t: number; b: number }
const overlaps = (a: Box, b: Box) => a.l < b.r + 3 && b.l < a.r + 3 && a.t < b.b + 2 && b.t < a.b + 2;
/** A 12px label's box, its baseline at y, anchored at its end (or start). */
const labelBox = (x: number, y: number, text: string, anchor: 'end' | 'start' = 'end'): Box => {
  const w = textW(text);
  return anchor === 'end' ? { l: x - w, r: x, t: y - 11, b: y + 3 } : { l: x, r: x + w, t: y - 11, b: y + 3 };
};

/**
 * The scorecard's numbers, where they are on the chart (Lane, 5 Nov): at now, a bracket between the latest number and
 * the plan with the gap ("9 behind"); at the end, the likely value ("likely 37") and a bracket from it to the target
 * with what's left ("13 short", or "on course"). Each label takes the first place it fits, clear of the others, the
 * target's label and the "which way is better" corner; a short bracket puts its words beside it instead.
 */
function Marks({ marks, f, X, Y, clampV, target }: { marks: ChartMarks; f: Frame; X: (w: number) => number; Y: (v: number) => number; clampV: (v: number) => number; target: { y: number; left: boolean; text: string } }) {
  const top = f.padT - 4, bottom = f.H - f.padB - 2, right = f.W - f.padR, left = f.padL;
  const taken: Box[] = [
    { l: left, r: left + 13 + textW('Higher is better'), t: 0, b: 17 },
    labelBox(target.left ? left + 4 : right, targetLabelY(target.y), target.text, target.left ? 'start' : 'end'),
    // The target line itself: words never sit on it.
    { l: left, r: right, t: target.y - 3, b: target.y + 3 },
  ];
  const inside = (b: Box) => b.t >= top - 14 && b.b <= bottom && b.l >= left && b.r <= f.W;
  const free = (text: string, [x, y]: [number, number]) => { const b = labelBox(x, y, text); return inside(b) && !taken.some((t) => overlaps(t, b)); };
  /** The first spot where the label fits; the first of all when none does. */
  const place = (text: string, spots: [number, number][]) => {
    const fits = spots.find((xy) => free(text, xy)) ?? spots[0]!;
    taken.push(labelBox(fits[0], fits[1], text));
    return fits;
  };
  const out: ReactNode[] = [];
  const n = marks.now;
  if (n) {
    const x = X(n.week), ya = Y(n.actual), yp = Y(n.plan);
    const hi = Math.min(ya, yp), lo = Math.max(ya, yp), bx = x - 7;
    const long = lo - hi >= 14;
    const [tx, ty] = place(n.text, long
      ? [[bx - 4, (hi + lo) / 2 + 4], [x - 8, hi - 8], [x - 8, lo + 16]]
      : [[x - 8, hi - 8], [x - 8, lo + 16], [x - 8, hi - 22]]);
    // Its bracket is in the way too: the end's words keep off it.
    if (long) taken.push({ l: bx - 1, r: bx + 5, t: hi, b: lo });
    // And the latest point, so nothing sits on it.
    taken.push({ l: x - 6, r: x + 6, t: ya - 6, b: ya + 6 });
    out.push(
      <g key="now" className={'c-gap-plan tone-' + n.tone}>
        {long && <path className="c-bracket" d={`M${bx + 4} ${ya}H${bx}V${yp}H${bx + 4}`} />}
        <text className="c-note" x={tx} y={ty} textAnchor="end">{n.text}</text>
      </g>,
    );
  }
  const e = marks.end;
  if (e) {
    const ex = X(e.week), yl = Y(clampV(e.likely)), yt = Y(e.target), bx = ex + 6;
    const towardsUp = yt < yl; // the target is above the likely end on screen
    const hi = Math.min(yl, yt), lo = Math.max(yl, yt);
    // The likely value on the side away from the target, clear of the projection's band.
    const likelySpots: [number, number][] = towardsUp ? [[ex - 4, yl + 16], [ex - 4, yl + 28], [ex - 4, yl - 8]] : [[ex - 4, yl - 8], [ex - 4, yl - 20], [ex - 4, yl + 16]];
    const long = lo - hi >= 16;
    const along = (k: number): [number, number] => [bx - 6, hi + (lo - hi) * k + 4];
    const beyond: [number, number] = [bx - 6, towardsUp ? yt - 8 : yt + 16];
    // With no room for a bracket (the likely end is near the target), its words join the likely value's, below.
    const gapSpots: [number, number][] = long ? [along(0.5), along(0.35), along(0.65), along(0.2), along(0.8), beyond] : [];
    const before = taken.length;
    const [lx, ly] = place(e.likelyText, likelySpots);
    const gap = gapSpots.find((xy) => free(e.gapText, xy));
    const bracket = long && <path className="c-bracket" d={`M${bx - 4} ${yl}H${bx}V${yt}H${bx - 4}`} />;
    if (gap) {
      taken.push(labelBox(gap[0], gap[1], e.gapText));
      out.push(
        <g key="likely" className="c-likely"><text className="c-note" x={lx} y={ly} textAnchor="end">{e.likelyText}</text></g>,
        <g key="target" className={'c-gap-target tone-' + e.tone}>{bracket}<text className="c-note" x={gap[0]} y={gap[1]} textAnchor="end">{e.gapText}</text></g>,
      );
    } else {
      // On a narrow chart, now and the end are close and the bracket has no room for words: both go on one line at the
      // end, "likely 37 · 13 short", where the bracket starts.
      taken.length = before;
      const both = `${e.likelyText} · ${e.gapText}`;
      const [cx, cy] = place(both, likelySpots);
      out.push(
        <g key="target" className={'c-gap-target tone-' + e.tone}>{bracket}</g>,
        <text key="both" className="c-note c-end-note" x={cx} y={cy} textAnchor="end">
          <tspan className="c-likely">{e.likelyText}</tspan><tspan className={'c-gap-target tone-' + e.tone}> · {e.gapText}</tspan>
        </text>,
      );
    }
  }
  return <g className="c-marks">{out}</g>;
}

interface RangeProps { goal: RangeGoal; weeks: number; week: number; series: Point[]; height?: number; scrub?: Scrub; draw?: boolean; landed?: boolean }

export function RangeChart(p: RangeProps) {
  return <Sized height={p.height ?? 200}>{(w) => <RangeSvg {...p} W={w} H={p.height ?? 200} />}</Sized>;
}

function RangeSvg({ goal, weeks, week, series, scrub, draw, landed, W, H }: RangeProps & { W: number; H: number }) {
  const compact = W < 420;
  const f: Frame = { W, H, padL: compact ? 34 : 44, padR: 12, padT: 24, padB: 20 };
  const { bound, limit, margin } = goal.range;
  const inner = bound === 'atMost' ? limit - margin : limit + margin;
  const m = Math.max(margin, 1);
  const { X, Y } = looseScales(f, weeks, [...series.map((p) => p.value), limit + (bound === 'atMost' ? 1.5 : -1.5) * m, limit - (bound === 'atMost' ? 3 : -3) * m]);
  const out = (v: number) => (bound === 'atMost' ? v > limit : v < limit);
  const last = series[series.length - 1];
  const sc = useScrub(weeks, 0, (px) => (px - f.padL) * weeks / (W - f.padL - f.padR), scrub, week);
  const atPoint = sc.at != null ? series.find((p) => p.week === sc.at) : undefined;
  const svg = (
    <svg className={'chart' + (draw ? ' draw' : '') + (scrub ? ' scrubbable' : '')} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${goal.title}: ${last ? fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, limit ${fmt(limit, goal)}, ${bound === 'atMost' ? 'lower' : 'higher'} is better`} {...sc.svg}>
      <rect className="c-area" x={f.padL} y={Math.min(Y(limit), Y(inner))} width={W - f.padL - f.padR} height={Math.abs(Y(inner) - Y(limit))} />
      <line className="c-target" x1={f.padL} x2={W - f.padR} y1={Y(limit)} y2={Y(limit)} />
      <WeekLabels f={f} weeks={weeks} week={week} X={X} wide={!compact} />
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.map((p) => <circle key={p.week} cx={X(p.week)} cy={Y(p.value)} r={out(p.value) ? 5 : 3} className={(out(p.value) ? 'c-breach' : 'c-dot') + (p === last ? ' c-last' : '') + (landed && p === last ? ' landed' : '')} />)}
      {draw && last && <circle className="c-dot-ring" cx={X(last.week)} cy={Y(last.value)} r={4} aria-hidden="true" />}
      <TargetLabel f={f} y={Y(limit)}>Limit {fmt(limit, goal)}{compact ? '' : ' · shaded: warning margin'}</TargetLabel>
      <Better up={bound === 'atLeast'} x={f.padL} />
      {sc.at != null && (
        <g className="c-scrub" aria-hidden="true">
          <line x1={X(sc.at)} x2={X(sc.at)} y1={f.padT - 6} y2={H - f.padB} />
          {atPoint && <circle className="c-scrub-dot" cx={X(atPoint.week)} cy={Y(atPoint.value)} r={5} />}
        </g>
      )}
    </svg>
  );
  return scrub ? <><div className="chart-scrub" {...sc.wrap}>{svg}</div>{sc.readout}</> : svg;
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
const weeks = (n: number) => (n === 1 ? '1 week' : n + ' weeks');
/**
 * "Expected week 45 · 3 weeks late, due week 42": what's behind, by how much, and against which date. The words beside
 * the stage's shape say its state (STAGE): a stage up to two weeks behind is slipping, not late, and one not due yet is
 * on schedule.
 */
export const stageTag = (s: StageState) =>
  s.kind === 'done' ? `${STAGE.done.label} week ${s.doneWeek}` + (s.weeksLate ? ` · ${weeks(s.weeksLate)} ${lower(STAGE.off)}, due week ${s.dueWeek}` : '')
    : s.kind === 'off' ? `Expected week ${s.expectedWeek} · ${weeks(s.weeksLate)} ${lower(STAGE.off)}, due week ${s.dueWeek}`
      : s.kind === 'risk' ? `Expected week ${s.expectedWeek} · ${lower(STAGE.risk)} ${weeks(s.weeksLate)}, due week ${s.dueWeek}`
        : `Due week ${s.dueWeek} · ${lower(STAGE.planned)}`;

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
  // Short, for a table cell or paper: the number and its plan or limit; Met or Missed beside it says how it came out.
  if (short) t = t.replace(/ against a plan of /, ' · plan ').replace(/, [\d.,]+ [^,]* (?:short|over)$/, '').replace(/ at the end, (?:inside|outside) the (.+) limit$/, ' · limit $1');
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
