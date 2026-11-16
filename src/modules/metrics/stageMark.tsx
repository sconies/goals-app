/* A metric's stage (MQ2): its own shape, three steps, filled one, two or three, always with its word. Never a status
   shape (circles) or a measurement mark (squares). Loaded only with the metric screens. */
import type { MetricStage } from './rulesQuality';

const WORD: Record<MetricStage, string> = { draft: 'Draft', defined: 'Defined', verified: 'Verified' };
const FILLED: Record<MetricStage, number> = { draft: 1, defined: 2, verified: 3 };
const STEPS = [{ x: 1.5, y: 10, h: 4.5 }, { x: 6.25, y: 6.5, h: 8 }, { x: 11, y: 2.5, h: 12 }];

export function StageShape({ k }: { k: MetricStage }) {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" className="stage-shape">
      {STEPS.map((s, i) => i < FILLED[k]
        ? <rect key={i} x={s.x} y={s.y} width={3.5} height={s.h} rx={1} fill="currentColor" />
        : <rect key={i} x={s.x + 0.6} y={s.y + 0.6} width={2.3} height={s.h - 1.2} rx={0.8} fill="none" stroke="currentColor" strokeWidth={1.2} />)}
    </svg>
  );
}

/** The shape and the word together, as a stage is always shown. */
export function StageMark({ k }: { k: MetricStage }) {
  return <span className={`stage-mark stage-${k}`}><StageShape k={k} />{WORD[k]}</span>;
}
