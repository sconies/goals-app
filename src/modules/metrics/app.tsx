/* The metric library on screen (src/core/app.tsx, ML1): its own place at /metrics with a page per metric, an item in the
   menu's "Look up" group after People (More on a phone), a line and a block on a goal's page, and the metrics a person
   owns or a team's goals use on their pages. Its facts are in module.json. */
import type { AppModule } from '../../core/app';
import { MetricForm, MetricPage, MetricsLibrary } from './Metrics';
import { GoalMeasuredBy, GoalMetric, PersonMetrics, TeamMetrics } from './MetricPlaces';

const icon = (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="M2.5 13.5h11" /><path d="M4.5 13.5V9M8 13.5V4.5M11.5 13.5V7" />
  </svg>
);

const metrics: AppModule = {
  routes: [
    { path: '/metrics', element: <MetricsLibrary />, title: 'Metrics' },
    { path: '/metrics/new', element: <MetricForm />, focus: true, title: 'Add a metric' },
    { path: '/metrics/:metricId', element: <MetricPage />, title: 'Metrics' },
    { path: '/metrics/:metricId/edit', element: <MetricForm />, focus: true, title: 'Change a metric' },
  ],
  navigation: [{ id: 'metrics', to: '/metrics', label: 'Metrics', icon, group: 'lookup' }],
  places: {
    'goal.facts': GoalMeasuredBy,
    'goal.sections': GoalMetric,
    'people.person': PersonMetrics,
    'people.team': TeamMetrics,
  },
};

export default metrics;
