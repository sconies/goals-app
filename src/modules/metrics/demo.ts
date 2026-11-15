/* The Platform Engineering example's metric library (backlog 0b): the numbers its goals are measured by, each defined
   once, and which goals each one measures, for which slice. Linking a goal changes nothing about it (its numbers,
   status and dates stay as they are), so the conformance rows don't move. One metric (CI compute cost) measures no
   goal yet: a library holds numbers before anyone sets a goal on them.

   The demo's builder (src/data/platformOrg/generate.ts) calls addDemoMetrics through records.ts once the year has been
   played, so a build without this module has a demo with no metric library and nothing else changed. */
import type { DemoBuild } from '../../domain/records';
import { saveMetric, type MetricInput } from './rules';
import { linkGoalMetric } from './rulesLink';
import { saveBaselines, verifyMetric } from './rulesVerify';
import type { MetricCalc, MetricPart, MetricWindow } from './types';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface MetricSpec extends MetricInput {
  /** A short, fixed id: metric_<slug>. */
  slug: string;
  ownerId: string;
  /** The goals it measures, each for the whole company (null) or a team's slice, and optionally one part of it (MT2). */
  measures: [goalId: string, teamId: string | null, part?: string][];
}

/* MQ2: the demo's stages, as the sketches draw them (docs/design/mq2 sketch 1). Verified: change failure rate,
   production deploys and time to restore; Defined: lead time, CI pipeline time, queue wait, first review and cloud
   cost; Draft: flaky tests (no link), cache hit rate (no window, no exclusions), time to detect (no type), CI compute
   cost (no link) and developer satisfaction (no link). A baseline and a verifier's figure where the sketches give one. */
const part = (counts: string, filters: string, excludes: string, name?: string): MetricPart => ({ ...(name ? { name } : {}), counts, filters, excludes });
const roll = (days: number): MetricWindow => ({ kind: 'rolling', days });
interface QualitySpec { calculation?: MetricCalc; window?: MetricWindow; sourceLink?: string; baseline?: [value: number, period: string, how: string]; verified?: [by: string, figure: number, note: string] }
const QUALITY: Record<string, QualitySpec> = {
  cfr: {
    calculation: { measure: 'ratio', aggregate: null, numerator: part('Production deploys tied to an incident, a rollback or a hotfix', 'Every deployable service; P1–P3 incidents', 'Incidents with no deploy in the 24 hours before', 'Failed changes'), denominator: part('Successful production deploys', 'Every deployable service', 'Rollbacks (a rollback is not a deploy)', 'Production deploys') },
    window: roll(28), sourceLink: 'https://four-keys.example.com/change-failure-rate?services=all',
    baseline: [11.8, 'Jul–Sep 2026', 'Four Keys query, all services'],
    verified: ['amara', 11.8, 'Checked against the September incident list with Lucía. Two hotfixes had been counted twice; Four Keys fixed that on 30 Oct.'],
  },
  deploys: {
    calculation: { measure: 'count', aggregate: 'mean', per: 'day', part: part('Successful production deploys on a working day', 'Every deployable service', 'Rollbacks; weekends') },
    window: roll(28), sourceLink: 'https://four-keys.example.com/deployment-frequency?services=all',
    baseline: [96, 'Jul–Sep 2026', 'Four Keys query, all services'], verified: ['amara', 96, 'Matches the deploy log for September.'],
  },
  mttr: {
    calculation: { measure: 'duration', aggregate: 'mean', part: part('Minutes from a P1 or P2 incident opening to service restored', 'P1 and P2 incidents', 'Incidents closed as duplicates') },
    window: roll(28), sourceLink: 'https://incidents.example.com/reports/time-to-restore?sev=1,2',
    baseline: [62, 'Jul–Sep 2026', 'Incident tracker report, P1 and P2'], verified: ['grace', 62, 'Two September incidents were closed late; the report already leaves them as they were.'],
  },
  'lead-time': { calculation: { measure: 'duration', aggregate: 'median', part: part('Hours from a change’s first commit to running in production', 'Every deployable service', 'None: reverts count as changes') }, window: roll(28), sourceLink: 'https://four-keys.example.com/lead-time?services=all', baseline: [31, 'Jul–Sep 2026', 'Four Keys query, all services'] },
  'ci-time': { calculation: { measure: 'duration', aggregate: 'percentile', percentile: 90, part: part('Wall-clock minutes from push to a finished pipeline on main', 'Branch is main; queue time included', 'Cancelled runs') }, window: roll(7), sourceLink: 'https://ci.example.com/pipelines/main/duration-p90?window=7d', baseline: [22, 'Aug–Oct 2026', 'CI analytics, p90 over the three months'] },
  'queue-wait': { calculation: { measure: 'duration', aggregate: 'percentile', percentile: 90, part: part('Minutes a pipeline job waits for a runner', 'Every runner pool', 'Jobs cancelled before they start') }, window: roll(7), sourceLink: 'https://ci.example.com/runners/queue-wait-p90?window=7d' },
  'first-review': { calculation: { measure: 'duration', aggregate: 'median', part: part('Working hours from a pull request opening to its first review', 'Every repository', 'Draft pull requests; bots') }, window: roll(28), sourceLink: 'https://git.example.com/insights/time-to-first-review' },
  'cost-per-request': { calculation: { measure: 'ratio', aggregate: null, numerator: part('Cloud spend, USD', 'Production accounts', 'Credits and refunds', 'Cloud spend'), denominator: part('Requests served, in thousands', 'Production edge', 'Health checks', 'Requests (thousands)') }, window: { kind: 'period', period: 'month' }, sourceLink: 'https://finops.example.com/unit-costs/per-1000-requests' },
  'flaky-rate': { calculation: { measure: 'ratio', aggregate: null, numerator: part('Test runs on main that fail, then pass on a retry of the same commit', 'Branch is main; CI runs only', 'Quarantined tests'), denominator: part('Test runs on main', 'Branch is main; CI runs only', 'Quarantined tests; cancelled runs') }, window: roll(7) },
  'cache-hit': { calculation: { measure: 'ratio', aggregate: null, numerator: part('Remote cache hits', 'Every build on CI', ''), denominator: part('Remote cache lookups', 'Every build on CI', '') } },
  'ci-cost': { calculation: { measure: 'ratio', aggregate: null, numerator: part('CI compute spend, USD', 'CI accounts', 'Credits'), denominator: part('Pipeline runs', 'Every pipeline', 'Cancelled runs') }, window: { kind: 'period', period: 'month' } },
  devsat: { calculation: { measure: 'value', aggregate: 'mean', part: part('Pulse survey score, 0 to 100', 'Engineers who answered', 'Answers with no score') }, window: { kind: 'period', period: 'quarter' } },
};

export const METRICS: MetricSpec[] = [
  {
    slug: 'lead-time', name: 'Lead time for changes', unit: 'hours', decimals: 0, direction: 'lower', ownerId: 'rhea', refresh: 'daily',
    meaning: 'Median hours from a change’s first commit to running in production, over the last 28 days. Counts every change to a deployable service; reverts count as changes.',
    source: 'DORA dashboard (Four Keys)', sourceOwner: 'CI/CD team',
    caveats: 'Changes to libraries only count once a service that uses them deploys.',
    measures: [['ns-lead', null]],
  },
  {
    slug: 'ci-time', name: 'CI pipeline time on main (p90)', unit: 'min', decimals: 0, direction: 'lower', ownerId: 'daniel', refresh: 'hourly',
    meaning: '90th percentile of wall-clock minutes from push to a finished pipeline on main, over the last 7 days. Queue time included; cancelled runs left out.',
    source: 'CI analytics', sourceOwner: 'Developer Experience',
    caveats: 'Monorepo and service repositories are pooled; a slow monorepo week moves the whole number.',
    measures: [['ns-ci', null]],
  },
  {
    slug: 'queue-wait', name: 'Pipeline queue wait (p90)', unit: 'min', decimals: 0, direction: 'lower', ownerId: 'rhea', refresh: 'hourly',
    meaning: '90th percentile of minutes a pipeline job waits for a runner, over the last 7 days.',
    source: 'CI runner metrics', sourceOwner: 'CI/CD team',
    caveats: '',
    measures: [['lead-ci-time', 'cicd', 'main branch pipelines']],
  },
  {
    slug: 'flaky-rate', name: 'Flaky test rate', unit: '%', decimals: 1, direction: 'lower', ownerId: 'rhea', refresh: 'daily',
    meaning: 'Share of test runs on main that fail and then pass on a retry of the same commit, over the last 7 days.',
    source: 'CI test analytics', sourceOwner: 'CI/CD team',
    caveats: 'Quarantined tests are left out, so quarantining lowers the number without fixing the test.',
    measures: [['lead-flaky', 'cicd', 'main pipelines']],
  },
  {
    slug: 'cache-hit', name: 'Remote build cache hit rate', unit: '%', decimals: 0, direction: 'higher', ownerId: 'rhea', refresh: 'daily',
    meaning: 'Share of build actions served from the remote cache instead of run again, across CI and laptops.',
    source: 'Bazel remote cache metrics', sourceOwner: 'CI/CD team',
    caveats: 'Only Bazel builds report it; Gradle builds aren’t counted yet.',
    measures: [['lead-cache', 'cicd']],
  },
  {
    slug: 'first-review', name: 'Time to first review', unit: 'hours', decimals: 1, direction: 'lower', ownerId: 'tariq', refresh: 'daily',
    meaning: 'Median working hours from a pull request being opened (or leaving draft) to its first human review.',
    source: 'GitHub pull request data', sourceOwner: 'Developer Experience',
    caveats: 'Bot reviews don’t count as a first review.',
    measures: [['lead-review', 'devex']],
  },
  {
    slug: 'deploys', name: 'Production deploys per day', unit: 'deploys', decimals: 0, direction: 'higher', ownerId: 'pavel', refresh: 'daily',
    meaning: 'Successful production deploys on a working day, averaged over the last 28 days. A rollback is not a deploy.',
    source: 'DORA dashboard (Four Keys)', sourceOwner: 'Build & Release',
    caveats: '',
    measures: [['ns-deploy', null]],
  },
  {
    slug: 'cfr', name: 'Change failure rate', unit: '%', decimals: 1, direction: 'lower', ownerId: 'marisol', refresh: 'weekly',
    meaning: 'Share of production deploys that led to an incident, a rollback or a hotfix, over the last 28 days.',
    source: 'DORA dashboard (Four Keys)', sourceOwner: 'Site Reliability Engineering',
    caveats: 'An incident is tied to a deploy by hand in the incident tracker, so the last week’s number can still rise.',
    measures: [['ns-cfr', null]],
  },
  {
    slug: 'mttr', name: 'Mean time to restore (P1 and P2)', unit: 'min', decimals: 0, direction: 'lower', ownerId: 'mateo', refresh: 'weekly',
    meaning: 'Mean minutes from an incident being declared to service restored, for P1 and P2 incidents closed in the last 28 days.',
    source: 'Incident tracker', sourceOwner: 'Site Reliability Engineering',
    caveats: 'A few long incidents move the mean a lot; the median is on the same dashboard.',
    measures: [['ns-mttr', null]],
  },
  {
    slug: 'mttd', name: 'Mean time to detect', unit: 'min', decimals: 1, direction: 'lower', ownerId: 'yuki', refresh: 'weekly',
    meaning: 'Mean minutes from an incident’s start (its first bad data point) to the first alert or report.',
    source: 'Incident tracker', sourceOwner: 'Observability',
    caveats: '',
    measures: [['mttr-detect', 'obs']],
  },
  {
    slug: 'cost-per-request', name: 'Cloud cost per 1,000 requests', unit: 'USD', decimals: 2, direction: 'lower', ownerId: 'bjorn', refresh: 'monthly',
    meaning: 'The month’s cloud bill for production, after discounts, divided by thousands of requests served at the edge.',
    source: 'FinOps dashboard', sourceOwner: 'Cloud Cost (FinOps)',
    caveats: 'Committed-use discounts land at the start of the month they’re bought, so a purchase month looks cheap.',
    measures: [['ns-cost', null]],
  },
  {
    slug: 'ci-cost', name: 'CI compute cost per pipeline run', unit: 'USD', decimals: 2, direction: 'lower', ownerId: 'ethan', refresh: 'monthly',
    meaning: 'The month’s spend on CI runners and their storage, divided by pipeline runs finished that month.',
    source: 'Cloud billing export', sourceOwner: 'Cloud Cost (FinOps)',
    caveats: 'Laptops’ remote cache use is billed to CI too.',
    measures: [],
  },
  {
    slug: 'devsat', name: 'Developer satisfaction (pulse)', unit: 'pts', decimals: 0, direction: 'higher', ownerId: 'ingrid', refresh: 'monthly',
    meaning: 'The rolling three-month score, 0 to 100, from the monthly developer pulse survey’s five core questions.',
    source: 'Developer pulse survey', sourceOwner: 'Developer Portal, Golden Paths & Self-Service Environments',
    caveats: 'About a third of engineers answer each month; the score is noisy month to month.',
    measures: [['ns-devsat', null]],
  },
];

/**
 * The library, set up the week before the year starts, each goal linked as it's created, by the people the app would
 * (the metric's owner adds it; the goal's owner links it). Fixed ids of their own, so nothing else's id moves; linking
 * changes no goal, so no number, status or date moves.
 */
export function addDemoMetrics(b: DemoBuild) {
  const startMs = b.start.getTime();
  METRICS.forEach((m, i) => {
    let k = 0;
    const mid = (p: string) => (p === 'metric' ? `metric_${m.slug}` : `${p}_metric_${m.slug}_${++k}`);
    const when = new Date(startMs - 3 * DAY + i * HOUR);
    b.save(saveMetric(b.act(m.ownerId, when, mid), m).commit!);
    // MQ2: its structured definition, its company baseline, and its verification, in that order, as people would.
    const q = QUALITY[m.slug];
    if (q) {
      const id = `metric_${m.slug}`;
      const at = (h: number) => new Date(when.getTime() + h * HOUR);
      const def = saveMetric(b.act(m.ownerId, at(1), mid), { id, ...(q.calculation ? { calculation: q.calculation } : {}), ...(q.window ? { timeWindow: q.window } : {}), ...(q.sourceLink ? { sourceLink: q.sourceLink } : {}) } as Parameters<typeof saveMetric>[1]).commit;
      if (def) b.save(def);
      if (q.baseline) b.save(saveBaselines(b.act(m.ownerId, at(2), mid), id, [{ teamId: null, value: q.baseline[0], period: q.baseline[1], takenOn: at(2).toISOString().slice(0, 10), how: q.baseline[2] }]).commit);
      if (q.verified && q.baseline) b.save(verifyMetric(b.act(q.verified[0], at(3), mid), id, { period: q.baseline[1], figure: q.verified[1], note: q.verified[2], openedLink: true, outcome: 'verified' }).commit);
    }
    for (const [goalId, teamId, part] of m.measures) {
      const { goal, createdAt } = b.goal(goalId);
      const linkedAt = new Date(Math.max(when.getTime(), Date.parse(createdAt)) + HOUR);
      b.save(linkGoalMetric(b.act(goal.ownerId, linkedAt, mid), goal, `metric_${m.slug}`, teamId, part ?? '')!);
    }
  });
}

/** The demo builder's part of this module (virtual:faro-modules/demo), kept out of records.ts so a first visit doesn't load it. */
export default addDemoMetrics;
