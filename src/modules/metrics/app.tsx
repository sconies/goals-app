/* The metric library on screen (src/core/app.tsx, ML1): its own place at /metrics with a page per metric, an item in the
   menu's "Look up" group after People (More on a phone), a line and a block on a goal's page, and the metrics a person
   owns or a team's goals use on their pages. Its facts are in module.json. */
import { lazy, Suspense, type ComponentType } from 'react';
import type { AppModule } from '../../core/app';
import { measuredByFilter, metricFinder, metricsToSortOut } from './finder';

/* The library's screens, and its bits on other pages, load when first shown (the bundle budget, scripts/check-bundle.mjs). */
const MetricsLibrary = lazy(() => import('./Metrics').then((m) => ({ default: m.MetricsLibrary })));
const MetricPage = lazy(() => import('./Metrics').then((m) => ({ default: m.MetricPage })));
const MetricForm = lazy(() => import('./Metrics').then((m) => ({ default: m.MetricForm })));

type Places = typeof import('./MetricPlaces');
function later<K extends keyof Places>(name: K): Places[K] {
  const Lazy = lazy(() => import('./MetricPlaces').then((m) => ({ default: m[name] as ComponentType<object> })));
  return ((props: object) => <Suspense fallback={null}><Lazy {...props} /></Suspense>) as unknown as Places[K];
}
const GoalMeasuredBy = later('GoalMeasuredBy');
// "Measured by" in the goal forms (ML2): loaded when a form first shows it.
const LazyMeasuredBy = lazy(() => import('./MeasuredBy').then((m) => ({ default: m.MeasuredBy as ComponentType<object> })));
const MeasuredBy = ((props: object) => <Suspense fallback={null}><LazyMeasuredBy {...props} /></Suspense>) as unknown as typeof import('./MeasuredBy').MeasuredBy;
const GoalMetric = later('GoalMetric');
const PersonMetrics = later('PersonMetrics');
const TeamMetrics = later('TeamMetrics');

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
    'goal.measure': MeasuredBy,
    'goal.sections': GoalMetric,
    'people.person': PersonMetrics,
    'people.team': TeamMetrics,
  },
  finders: [metricFinder],
  filters: [measuredByFilter],
  toSortOut: metricsToSortOut,
};

export default metrics;
