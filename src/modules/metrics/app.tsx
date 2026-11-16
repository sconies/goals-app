/* The metric library on screen (src/core/app.tsx, ML1): its own place at /metrics with a page per metric, an item in the
   menu's "Look up" group after People (More on a phone), a line and a block on a goal's page, and the metrics a person
   owns or a team's goals use on their pages. Its facts are in module.json. */
import { lazy, Suspense, type ComponentType } from 'react';
import type { AppModule } from '../../core/app';
import { useApp } from '../../app/state';
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
const ReviewRowMetric = later('ReviewRowMetric');
// "Measured by" in the goal forms (ML2): loaded when a form first shows it.
const LazyMeasuredBy = lazy(() => import('./MeasuredBy').then((m) => ({ default: m.MeasuredBy as ComponentType<object> })));
const MeasuredBy = ((props: object) => <Suspense fallback={null}><LazyMeasuredBy {...props} /></Suspense>) as unknown as typeof import('./MeasuredBy').MeasuredBy;
// The check-in's number filled in from its source (NR2): loaded when the number step first shows it, never on Home.
const LazyCheckInNumber = lazy(() => import('./CheckInNumber').then((m) => ({ default: m.CheckInNumber as ComponentType<object> })));
const CheckInNumber = ((props: object) => <Suspense fallback={null}><LazyCheckInNumber {...props} /></Suspense>) as unknown as typeof import('./CheckInNumber').CheckInNumber;
const LazyTableReadings = lazy(() => import('./CheckInNumber').then((m) => ({ default: m.CheckInTableReadings as ComponentType<object> })));
const CheckInTableReadings = ((props: object) => <Suspense fallback={null}><LazyTableReadings {...props} /></Suspense>) as unknown as typeof import('./CheckInNumber').CheckInTableReadings;
const GoalMetric = later('GoalMetric');
// MQ2's baseline screens (sketches 4 and 9), and Home's line in a quarter's first week: loaded only when shown.
const AddBaseline = lazy(() => import('./BaselineForms').then((m) => ({ default: m.AddBaseline })));
const TakeBaselines = lazy(() => import('./BaselineForms').then((m) => ({ default: m.TakeBaselines })));
const VerifyForm = lazy(() => import('./VerifyForm').then((m) => ({ default: m.VerifyForm })));
const LazyHomeBaselines = lazy(() => import('./BaselineForms').then((m) => ({ default: m.HomeBaselines })));
/** Home asks for this quarter's baselines only in its first week, and only of someone who owns a metric. */
function HomeBaselines() {
  const app = useApp();
  const d = new Date(app.stamp());
  const firstWeek = d.getUTCMonth() % 3 === 0 && d.getUTCDate() <= 7;
  const owns = ((app.snapshot.modules?.metrics?.metrics ?? []) as { ownerId: string; removedAt?: string | null }[]).some((m) => m.ownerId === app.viewer.id && !m.removedAt);
  return firstWeek && owns ? <Suspense fallback={null}><LazyHomeBaselines /></Suspense> : null;
}
// A verifier's "n metrics to verify" (journey 3): loaded only when the library has a metric someone could verify.
const LazyHomeVerify = lazy(() => import('./HomeVerify').then((m) => ({ default: m.HomeVerify })));
function HomeVerify() {
  const app = useApp();
  const any = ((app.snapshot.modules?.metrics?.metrics ?? []) as { ownerId: string; removedAt?: string | null; retiredAt?: string | null }[]).some((m) => m.ownerId !== app.viewer.id && !m.removedAt && !m.retiredAt);
  return any ? <Suspense fallback={null}><LazyHomeVerify /></Suspense> : null;
}
/** The library's blocks on Home: this quarter's baselines, then the metrics to verify. */
const HomeMetrics = () => <><HomeBaselines /><HomeVerify /></>;
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
    { path: '/metrics/baselines', element: <TakeBaselines />, focus: true, title: 'Take this quarter’s baselines' },
    { path: '/metrics/:metricId', element: <MetricPage />, title: 'Metrics' },
    { path: '/metrics/:metricId/baseline', element: <AddBaseline />, focus: true, title: 'Add a baseline' },
    { path: '/metrics/:metricId/verify', element: <VerifyForm />, focus: true, title: 'Verify a metric' },
    { path: '/metrics/:metricId/edit', element: <MetricForm />, focus: true, title: 'Change a metric' },
  ],
  navigation: [{ id: 'metrics', to: '/metrics', label: 'Metrics', icon, group: 'lookup' }],
  places: {
    'home.blocks': HomeMetrics,
    'goal.facts': GoalMeasuredBy,
    'goal.measure': MeasuredBy,
    'goal.sections': GoalMetric,
    'review.row': ReviewRowMetric,
    'people.person': PersonMetrics,
    'people.team': TeamMetrics,
    'checkin.number': CheckInNumber,
    'checkin.table': CheckInTableReadings,
  },
  finders: [metricFinder],
  filters: [measuredByFilter],
  toSortOut: metricsToSortOut,
};

export default metrics;
