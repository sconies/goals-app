/* A number kept in range, charted: its bound or bounds (a range between two numbers has both, upper and lower), each
   with its shaded warning margin, and the numbers so far. Apart from charts.tsx so it loads with the screens that show it
   (a goal, a check-in, print), not in the first download. */
import type { Point } from '../domain/plan';
import { fmt, staysText } from '../domain/format';
import { rangeOut, type RangeSide } from '../domain/range';
import type { RangeGoal } from '../domain/types';
import { Better, line, looseScales, Sized, TargetLabel, useScrub, WeekLabels, type Frame, type Scrub } from './charts';

export interface RangeProps { goal: RangeGoal; weeks: number; week: number; series: Point[]; height?: number; scrub?: Scrub; draw?: boolean; landed?: boolean }

export function RangeChart(p: RangeProps) {
  return <Sized height={p.height ?? 200}>{(w) => <RangeSvg {...p} W={w} H={p.height ?? 200} />}</Sized>;
}

function RangeSvg({ goal, weeks, week, series, scrub, draw, landed, W, H }: RangeProps & { W: number; H: number }) {
  const compact = W < 420;
  const f: Frame = { W, H, padL: compact ? 34 : 44, padR: 12, padT: 24, padB: 20 };
  const r = goal.range, { bound, limit, margin } = r, two = bound === 'between';
  // Each bound with its shaded warning margin: one, or the upper and lower of a range between two numbers.
  const sides: RangeSide[] = two ? [{ bound: 'atMost', limit }, { bound: 'atLeast', limit: r.lower! }] : [r as RangeSide];
  const k = (s: RangeSide) => (s.bound === 'atMost' ? 1 : -1);
  const m = Math.max(margin, 1);
  const { X, Y } = looseScales(f, weeks, [...series.map((p) => p.value), ...sides.flatMap((s) => [s.limit + 1.5 * k(s) * m, ...(two ? [] : [s.limit - 3 * k(s) * m])])]);
  const out = (v: number) => rangeOut(r, v);
  const last = series[series.length - 1];
  const sc = useScrub(weeks, 0, (px) => (px - f.padL) * weeks / (W - f.padL - f.padR), scrub, week);
  const atPoint = sc.at != null ? series.find((p) => p.week === sc.at) : undefined;
  const svg = (
    <svg className={'chart' + (draw ? ' draw' : '') + (scrub ? ' scrubbable' : '')} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${goal.title}: ${last ? fmt(last.value, goal) + ' in week ' + last.week : 'no values yet'}, ${two ? `must stay ${staysText(goal)}` : `limit ${fmt(limit, goal)}, ${bound === 'atMost' ? 'lower' : 'higher'} is better`}`} {...sc.svg}>
      {sides.map((s) => { const y = Y(s.limit), inner = Y(s.limit - k(s) * margin); return <g key={s.bound}><rect className="c-area" x={f.padL} y={Math.min(y, inner)} width={W - f.padL - f.padR} height={Math.abs(inner - y)} /><line className="c-target" x1={f.padL} x2={W - f.padR} y1={y} y2={y} /></g>; })}
      <WeekLabels f={f} weeks={weeks} week={week} X={X} wide={!compact} />
      {series.length > 0 && <polyline className="c-act" points={line(series.map((p) => [X(p.week), Y(p.value)]))} />}
      {series.map((p) => <circle key={p.week} cx={X(p.week)} cy={Y(p.value)} r={out(p.value) ? 5 : 3} className={(out(p.value) ? 'c-breach' : 'c-dot') + (p === last ? ' c-last' : '') + (landed && p === last ? ' landed' : '')} />)}
      {draw && last && <circle className="c-dot-ring" cx={X(last.week)} cy={Y(last.value)} r={4} aria-hidden="true" />}
      {sides.map((s, i) => <TargetLabel key={s.bound} f={f} y={Y(s.limit)}>{two ? (i ? 'Lower ' : 'Upper ') : 'Limit '}{fmt(s.limit, goal)}{compact || i ? '' : ' · shaded: warning margin'}</TargetLabel>)}
      {!two && <Better up={bound === 'atLeast'} x={f.padL} />}
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
