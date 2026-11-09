/* The metric on a goal's page (the goal.sections place): what the goal is measured by, what that means, for which
   slice, and the goal's target in it. Nothing when the goal isn't measured by a metric. */
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { DIRECTION_LABEL, measureOf } from '../../domain/metrics';

export function GoalMetric({ goal }: PlaceProps['goal.sections']) {
  const app = useApp();
  const m = measureOf(app.snapshot, goal);
  if (!m) return null;
  return (
    <section className="block goal-metric" aria-labelledby="g-metric" data-part="Measured by">
      <h2 className="block-title" id="g-metric">Measured by</h2>
      <p><Link className="strong" to={'/data/metrics?m=' + encodeURIComponent(m.metric.id)}>{m.metric.name}</Link>
        <span className="muted"> · {m.slice} · {m.metric.unit} · {DIRECTION_LABEL[m.metric.direction]}{m.targetText ? ` · ${m.targetText}` : ''}</span></p>
      <p className="small">{m.metric.meaning || 'Its meaning isn’t written down yet.'}</p>
    </section>
  );
}
