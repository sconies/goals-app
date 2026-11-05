/* Under a goal's chart: where it stands and where it's heading as a few short rows and one small picture, not a
   paragraph (Lane, 5 Nov). The rows come from domain/chartStory.ts. The bar shows where the goal will likely end: the
   range as a band, the likeliest value as a dot, and the target (or limit) as a mark. */
import type { StoryFacts } from '../domain/chartStory';

export function ChartFacts({ facts, say }: { facts: StoryFacts; say: (v: number) => string }) {
  if (!facts.rows.length) return null;
  return (
    <div className="chart-facts chart-say">
      <dl className="cf-rows">
        {facts.rows.map((r) => (
          <div key={r.label} className="cf-row">
            <dt>{r.label}</dt>
            <dd><span className="cf-value">{r.value}</span>{r.note && <span className={'cf-note' + (r.tone ? ' tone-' + r.tone : '')}>{r.note}</span>}</dd>
          </div>
        ))}
      </dl>
      {facts.end && <EndBarSvg end={facts.end} say={say} />}
      {facts.footnote && <p className="cf-foot">{facts.footnote}</p>}
    </div>
  );
}

function EndBarSvg({ end, say }: { end: NonNullable<StoryFacts['end']>; say: (v: number) => string }) {
  const W = 320, H = 54, padX = 12;
  const lo = Math.min(end.low, end.mark, end.likely), hi = Math.max(end.high, end.mark, end.likely);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  const x = (v: number) => padX + ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (W - 2 * padX);
  const y = 30;
  return (
    <svg className={'cf-end tone-' + end.tone} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`Likely end ${say(end.likely)}, between ${say(end.low)} and ${say(end.high)}; ${end.markLabel}`}>
      <line className="cf-axis" x1={padX} x2={W - padX} y1={y} y2={y} />
      <rect className="cf-band" x={x(end.low)} y={y - 5} width={Math.max(2, x(end.high) - x(end.low))} height={10} rx={5} />
      <line className="cf-mark" x1={x(end.mark)} x2={x(end.mark)} y1={y - 12} y2={y + 12} />
      <text className="cf-mark-label" x={x(end.mark)} y={10} textAnchor={x(end.mark) > W * 0.75 ? 'end' : x(end.mark) < W * 0.25 ? 'start' : 'middle'}>{end.markLabel}</text>
      <circle className="cf-dot" cx={x(end.likely)} cy={y} r={5.5} />
      <text className="cf-range" x={x(end.low)} y={H - 2} textAnchor="start">{say(end.low)}</text>
      <text className="cf-range" x={x(end.high)} y={H - 2} textAnchor="end">{say(end.high)}</text>
    </svg>
  );
}
