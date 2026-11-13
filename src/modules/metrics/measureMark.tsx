/* A metric's measurement status (MS; rulesMeasured.ts), always a shape and a word together (design rules). Its shapes
   are squares, its own, so a status shape still only ever means a status: filled (Measured), half filled (Partly), a
   broken outline (Gap), as a goal held to no number shows a broken ring. */
import { MEASUREMENT_LABEL } from './rulesMeasured';
import type { MetricMeasurement } from './types';

export function MeasureShape({ k }: { k: MetricMeasurement }) {
  return (
    <svg className="measure-shape" viewBox="0 0 16 16" aria-hidden="true">
      {k === 'measured' && <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />}
      {k === 'partly' && <><rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3.8 12.2 12.2 3.8V12.2Z" fill="currentColor" /></>}
      {k === 'gap' && <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2" />}
    </svg>
  );
}

/** The shape and its word: "Gap". */
export function MeasureMark({ k, className }: { k: MetricMeasurement; className?: string }) {
  return <span className={'measure-mark measure-' + k + (className ? ' ' + className : '')}><MeasureShape k={k} />{MEASUREMENT_LABEL[k]}</span>;
}
