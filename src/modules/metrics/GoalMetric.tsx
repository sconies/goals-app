/* The metric on a goal's page (the goal.sections place, backlog 0b): what measures the goal, what that means, the slice
   and the goal's target in it. Nothing when the goal isn't measured by a metric. */
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { DIRECTION_LABEL, measureOf } from '../../domain/metrics';

export function GoalMetric({ goal }: PlaceProps['goal.sections']) {
  const app = useApp();
  const m = measureOf(app.snapshot, goal);
  if (!m) return null;
  return (
    <section className="goal-metric" aria-label="Measured by">
      <h2 className="small strong">Measured by</h2>
      <p><Link className="strong" to={`/data/metrics?m=${m.metric.id}`}>{m.metric.name}</Link><span className="muted"> · {m.slice} · {DIRECTION_LABEL[m.metric.direction]}</span></p>
      <p>{m.metric.meaning || 'No meaning written yet.'}</p>
      {m.targetText && <p className="small muted">{m.targetText}, in {m.metric.unit}{m.metric.caveats ? `. Watch out: ${m.metric.caveats}` : ''}</p>}
    </section>
  );
}
