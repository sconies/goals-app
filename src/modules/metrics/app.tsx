/* The metrics module on screen (src/core/app.tsx): the Metrics page at /data/metrics with its way in from Data, "Measured
   by" in New goal and goal edit, and the metric on a goal's page. Its facts are in module.json. */
import type { AppModule } from '../../core/app';
import { GoalMetric } from './GoalMetric';
import { MeasuredBy } from './MeasuredBy';
import { Metrics } from './Metrics';
import { MetricsLink } from './MetricsLink';

const metrics: AppModule = {
  routes: [{ path: '/data/metrics', element: <Metrics />, title: 'Metrics' }],
  places: {
    'data.tools': MetricsLink,
    'goal.measure': MeasuredBy,
    'goal.sections': GoalMetric,
  },
};

export default metrics;
