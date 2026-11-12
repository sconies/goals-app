/* The Platform Engineering example's metric library (backlog 0b): the numbers its goals are measured by, each defined
   once, and which goals each one measures, for which slice. Linking a goal changes nothing about it (its numbers,
   status and dates stay as they are), so the conformance rows don't move. One metric (CI compute cost) measures no
   goal yet: a library holds numbers before anyone sets a goal on them.

   The demo's builder (src/data/platformOrg/generate.ts) calls addDemoMetrics through records.ts once the year has been
   played, so a build without this module has a demo with no metric library and nothing else changed. */
import type { DemoBuild } from '../../domain/records';
import { linkGoalMetric, saveMetric, type MetricInput } from './rules';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface MetricSpec extends MetricInput {
  /** A short, fixed id: metric_<slug>. */
  slug: string;
  ownerId: string;
  /** The goals it measures, each for the whole company (null) or a team's slice, and optionally one part of it (MT2). */
  measures: [goalId: string, teamId: string | null, part?: string][];
}

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
    for (const [goalId, teamId, part] of m.measures) {
      const { goal, createdAt } = b.goal(goalId);
      const linkedAt = new Date(Math.max(when.getTime(), Date.parse(createdAt)) + HOUR);
      b.save(linkGoalMetric(b.act(goal.ownerId, linkedAt, mid), goal, `metric_${m.slug}`, teamId, part ?? '')!);
    }
  });
}

/** The demo builder's part of this module (virtual:faro-modules/demo), kept out of records.ts so a first visit doesn't load it. */
export default addDemoMetrics;
