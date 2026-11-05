/* The Platform Engineering example's goals: 12 north stars, the SVP-level goals feeding them and the team goals
   feeding those, each with the story of its year. Weeks are written for a demo sitting in week 45 of the year; the
   generator moves every week from 20 on with the real current week, so the story always ends today.

   An arc is the goal's year in phases. For a number to move, `r` is how much of the planned change it has made by the
   end of the phase (1 is on plan, 0.8 at risk, below that off track, 1.2 and over well ahead), moving in a straight line
   from the phase before. For a number to keep in range, `r` is how close it runs to the limit (0 comfortably inside,
   0.7 near the limit, over 1 outside it). Dated stages follow their stages; their arc only gives the reasons. */
import type { Level, PlanShape, RecoveryState } from '../../domain/types';
import type { Theme } from './stories';

export interface PathSpec {
  what: string;
  /** Weeks until it's back on plan (default 4). */
  in?: number;
  state?: RecoveryState;
  /** "Name Surname: the ask", or just the ask for anyone. Raises a request from the first week it's said. */
  needs?: string;
  /** The person asked answers in this week; the owner stops asking after it. */
  answer?: { week: number; by: string; text: string };
}
export interface Phase { to: number; r: number; theme?: Theme; why?: string[]; path?: PathSpec }
/** A stage: name, due week, the week it was done (or null), and when it was forecast, from which week. */
export type StageSpec = [name: string, due: number, done: number | null, slips?: [from: number, forecast: number][]];

export interface GoalSpec {
  id: string; parent?: string; level?: Level; team: string; owner: string; title: string; source: string; definition?: string;
  whyHelps?: string; also?: string[]; guardrail?: boolean; effect?: number;
  metric?: [unit: string, decimals: number, start: number, target: number, shape?: PlanShape];
  range?: [unit: string, decimals: number, bound: 'atMost' | 'atLeast', limit: number, margin: number];
  stages?: StageSpec[];
  arc: Phase[];
  /** Words for the reasons: what the work is, who it depends on, and the vendor if there is one. */
  thing: string; dep?: string; vendor?: string;
  /** Set up in this week (default: before the year starts). */
  created?: number;
  /** The last week checked in: a goal that went quiet. */
  last?: number;
  /** A number goal whose owner called it done in this week, and why. */
  done?: { week: number; why: string };
  /** Share of weeks the owner misses (default a little). */
  skip?: number;
  /** Week-to-week noise in `r` (default 0.025). */
  noise?: number;
  /** The plan changed after check-ins began. */
  replan?: { week: number; by: string; target: number; why: string };
  /** The goal moved to a new owner. */
  reowner?: { week: number; to: string; by: string };
  /** The owner's own call differs from the rules for these weeks. */
  call?: { from: number; to: number; status: 'on' | 'risk'; why: string };
  /** The owner loaded weeks 1 to this from a spreadsheet the week after. */
  imported?: number;
  /** Waits on the request raised on another goal, from this week. */
  link?: { goal: string; week: number };
}

const steady = (r = 1.02): Phase[] => [{ to: 53, r }];

export const GOALS: GoalSpec[] = [
  /* ---------- 1. Lead time for changes: off track, because the merge queue is late ---------- */
  {
    id: 'ns-lead', level: 'north-star', team: 'cicd', owner: 'rhea', title: 'Lead time for changes', source: 'DORA dashboard (Four Keys)',
    definition: 'Median hours from a change’s first commit to it running in production, across every deployable service',
    metric: ['hours', 0, 52, 24], thing: 'the merge queue rollout', dep: 'Build & Release', vendor: 'MergeFlow',
    arc: [
      { to: 22, r: 1.03 },
      { to: 30, r: 0.9, theme: 'vendor', why: ['The merge queue is three weeks late: MergeFlow’s monorepo support slipped, and review wait time is flat.', 'Review wait and merge-to-deploy are both behind. The merge queue is the biggest single lever and it hasn’t landed.'] },
      { to: 38, r: 0.78, theme: 'blocked', why: ['Merge-to-deploy is stuck at nine hours while every deploy waits for the shared runners. The runner budget is the blocker now.', 'Three of the four inputs are behind. The merge queue and the runner pools are both on the critical path, and both are waiting on someone outside the team.'], path: { what: 'Merge queue on the web monorepo by week 41 and autoscaling runners as soon as the budget is approved.', in: 6, needs: 'Amara Nwosu: approve the extra CI runner budget for Q4' } },
      { to: 53, r: 0.64, theme: 'blocked', why: [
        'Lead time is well above plan and the gap grew again this week. The merge queue rollout to the web monorepo slipped again (MergeFlow have moved the fix to batch merges with required checks to their next release), the autoscaling runner pools are still waiting on the Q4 budget decision, and the flaky-test rate went back over 2% after the Java 21 upgrade. Review wait time is the one input moving in the right direction. Until the runner budget is approved, every merge waits a median of 14 minutes for a runner, and that alone is about six hours of the gap.',
        'Still off track. The critical path is the merge queue, then runners. Both have owners and dates; neither is in our hands this week.',
        'Worse again: the payments team’s release train added two days of batching. Talking to them about moving to the merge queue first.',
      ], path: { what: 'Merge queue on every monorepo by week 49, runners autoscaling within two weeks of the budget, flaky tests quarantined within a day.', in: 6, state: 'help', needs: 'Amara Nwosu: approve the extra CI runner budget for Q4' } },
    ],
  },
  {
    id: 'lead-review', parent: 'ns-lead', level: 'svp', team: 'devex', owner: 'tariq', title: 'Time from pull request opened to first review', source: 'GitHub pull request data',
    definition: 'Median business hours from a pull request being opened (not draft) to its first human or AI review comment', effect: 8,
    whyHelps: 'Most of a change’s lead time is waiting for review, so the first review is where the hours are.',
    metric: ['hours', 1, 20, 6], thing: 'the review rota', dep: 'CI/CD',
    arc: [{ to: 24, r: 1.02 }, { to: 34, r: 0.86, theme: 'hiring', path: { what: 'Add the platform teams to the review rota so no repo waits for one person.', in: 5 } }, { to: 53, r: 0.97, theme: 'recovery' }],
  },
  {
    id: 'lead-review-bot', parent: 'lead-review', team: 'devex', owner: 'ravi', title: 'AI first-pass review on every pull request in tier-1 repositories', source: 'Review bot telemetry',
    metric: ['%', 0, 10, 90], thing: 'the review bot', arc: [{ to: 18, r: 1.0 }, { to: 30, r: 1.26, theme: 'early' }, { to: 53, r: 1.08 }],
  },
  {
    id: 'lead-review-rota', parent: 'lead-review', team: 'devex', owner: 'kwame', title: 'Repositories covered by a named review rota', source: 'CODEOWNERS audit',
    metric: ['%', 0, 40, 95], thing: 'the rota rollout', dep: 'Developer Experience', arc: [{ to: 20, r: 1.0 }, { to: 34, r: 0.83, theme: 'hiring' }, { to: 53, r: 0.92, theme: 'recovery' }],
  },
  {
    id: 'lead-review-small', parent: 'lead-review', team: 'devex', owner: 'hannah', title: 'Pull requests under 400 changed lines', source: 'GitHub pull request data',
    metric: ['%', 0, 55, 75], thing: 'the small-changes guidance', arc: steady(1.01),
  },
  {
    id: 'lead-merge', parent: 'ns-lead', level: 'svp', team: 'build', owner: 'pavel', title: 'Merge-to-deploy time (median)', source: 'Deploy pipeline events',
    definition: 'Median hours from a pull request merging to the change running in production', effect: 12,
    whyHelps: 'Merged code that waits for a release train is lead time nobody is working on.',
    metric: ['hours', 1, 9, 2], thing: 'the merge queue', dep: 'CI/CD', vendor: 'MergeFlow',
    arc: [{ to: 22, r: 1.0 }, { to: 32, r: 0.8, theme: 'vendor' }, { to: 53, r: 0.55, theme: 'blocked', path: { what: 'Move the payments monorepo to the merge queue first; it holds most of the waiting changes.', in: 6 } }],
  },
  {
    id: 'lead-mq', parent: 'lead-merge', team: 'cicd', owner: 'diego', title: 'Merge queue live for every monorepo', source: 'Jira CICD-412',
    stages: [['Vendor contract signed', 8, 8], ['Pilot on the payments monorepo', 18, 21, [[17, 21]]], ['Web monorepo on the merge queue', 30, null, [[28, 36], [35, 41], [41, 46]]], ['All monorepos on the merge queue', 40, null, [[32, 44], [40, 49]]]],
    thing: 'the merge queue', vendor: 'MergeFlow', dep: 'Build & Release',
    arc: [{ to: 20, r: 1, theme: 'vendor' }, { to: 34, r: 1, theme: 'vendor', path: { what: 'Pilot fixes in, then the web monorepo; MergeFlow have committed engineers to it.', in: 6 } }, { to: 53, r: 1, theme: 'vendor', why: ['MergeFlow’s fix for batch merges with required checks slipped to their next release. The web monorepo can’t move without it.', 'The web monorepo slipped again. All monorepos now look like December at the earliest.'], path: { what: 'Run the web monorepo on the queue without batching until MergeFlow ship the fix.', in: 5, needs: 'Daniel Okafor: agree to run without batching on the web monorepo for a month' } }],
  },
  {
    id: 'lead-canary', parent: 'lead-merge', team: 'build', owner: 'olivia', title: 'Tier-1 services with automated canary analysis', source: 'Spinnaker pipelines',
    metric: ['%', 0, 20, 90], thing: 'the canary analysis rollout', dep: 'Observability', arc: [{ to: 26, r: 1.0 }, { to: 36, r: 0.85, theme: 'migration' }, { to: 53, r: 0.96, theme: 'recovery' }],
  },
  {
    id: 'lead-batch', parent: 'lead-merge', team: 'build', owner: 'elif', title: 'Deploys with five or fewer changes', source: 'Deploy pipeline events',
    metric: ['%', 0, 40, 85], thing: 'smaller batches', arc: steady(1.03),
  },
  {
    id: 'lead-rollback', parent: 'lead-merge', team: 'build', owner: 'tunde', title: 'One-click rollback for every deployable service', source: 'Jira BR-77',
    stages: [['Design agreed', 6, 6], ['Tier-1 services', 22, 21], ['Tier-2 services', 36, 35], ['Every deployable service', 48, null]],
    thing: 'one-click rollback', arc: steady(1),
  },
  {
    id: 'lead-flaky', parent: 'ns-lead', level: 'svp', team: 'cicd', owner: 'rhea', title: 'Flaky test rate in the main pipelines', source: 'CI test analytics',
    definition: 'Share of test runs on main that fail and then pass on retry with no code change, rolling 7 days', guardrail: true,
    whyHelps: 'Every flaky failure is a retry, and every retry is twenty minutes of somebody’s lead time.',
    range: ['%', 1, 'atMost', 2, 0.4], thing: 'the flaky-test clean-up', dep: 'the Java 21 upgrade',
    arc: [{ to: 30, r: 0.35 }, { to: 38, r: 0.7, theme: 'migration' }, { to: 41, r: 1.12, theme: 'migration', path: { what: 'Quarantine the new flaky suites and fix the two shared fixtures behind most of them.', in: 3 } }, { to: 53, r: 0.75, theme: 'recovery' }],
    noise: 0.06,
  },
  {
    id: 'lead-quarantine', parent: 'lead-flaky', team: 'cicd', owner: 'aiko', title: 'Flaky tests quarantined within 24 hours', source: 'CI test analytics',
    metric: ['%', 0, 30, 90], thing: 'automatic quarantine', arc: [{ to: 28, r: 1.0 }, { to: 36, r: 0.78, theme: 'slower' }, { to: 53, r: 0.95, theme: 'recovery' }],
  },
  {
    id: 'lead-testown', parent: 'lead-flaky', team: 'cicd', owner: 'femi', title: 'Test suites with a named owning team', source: 'Test ownership manifest',
    metric: ['%', 0, 45, 100], thing: 'test ownership', arc: [{ to: 16, r: 1.0 }, { to: 53, r: 1.24, theme: 'cautious' }],
  },
  {
    id: 'lead-ci-time', parent: 'ns-lead', level: 'svp', team: 'cicd', owner: 'rhea', title: 'Pipeline queue wait (p90)', source: 'CI runner metrics',
    definition: 'Ninetieth percentile minutes a pipeline job waits for a runner, working hours', effect: 6,
    metric: ['min', 0, 14, 3], thing: 'the runner pools', dep: 'Infrastructure & Compute',
    arc: [{ to: 18, r: 1.0 }, { to: 21, r: 0.7, theme: 'incident' }, { to: 26, r: 1.0, theme: 'recovery' }, { to: 36, r: 0.88, theme: 'blocked' }, { to: 53, r: 0.7, theme: 'blocked', path: { what: 'Autoscaling runner pools as soon as the Q4 budget is approved.', in: 5, state: 'help', needs: 'Amara Nwosu: approve the extra CI runner budget for Q4' } }],
    link: { goal: 'ns-lead', week: 41 },
  },
  {
    id: 'lead-runners', parent: 'lead-ci-time', team: 'cicd', owner: 'johanna', title: 'Autoscaling CI runner pools', source: 'Jira CICD-388',
    stages: [['Design and cost model', 14, 13], ['Pilot pool for the web monorepo', 26, 27], ['Budget approved for Q4', 38, null, [[37, 46]]], ['Autoscaling on every pool', 44, null, [[37, 50]]]],
    thing: 'the runner pools', dep: 'Cloud Cost (FinOps)',
    arc: [{ to: 30, r: 1, theme: 'slower' }, { to: 53, r: 1, theme: 'blocked', why: ['The pilot pool works; the rollout waits on the Q4 budget decision.', 'No budget decision yet, so autoscaling on every pool now looks like week 50.'], path: { what: 'Roll out to every pool within two weeks of the budget decision.', in: 6, state: 'help', needs: 'Amara Nwosu: approve the extra CI runner budget for Q4' } }],
    link: { goal: 'ns-lead', week: 42 },
  },
  {
    id: 'lead-arm', parent: 'lead-ci-time', team: 'cicd', owner: 'marcus', title: 'CI jobs running on ARM runners', source: 'CI runner metrics',
    metric: ['%', 0, 0, 60], thing: 'the ARM runner migration', arc: [{ to: 30, r: 1.0 }, { to: 34, r: 0.84, theme: 'holiday' }, { to: 53, r: 1.0, theme: 'recovery' }],
  },
  {
    id: 'lead-cache', parent: 'lead-ci-time', team: 'cicd', owner: 'sana', title: 'Remote build cache hit rate', source: 'Bazel remote cache metrics',
    metric: ['%', 0, 45, 80], thing: 'the remote cache', also: ['ns-ci'], arc: steady(1.02),
  },

  /* ---------- 2. CI pipeline time: on track after a migration dip ---------- */
  {
    id: 'ns-ci', level: 'north-star', team: 'devex', owner: 'daniel', title: 'CI pipeline time on main (p90)', source: 'CI analytics',
    definition: 'Ninetieth percentile minutes from push to a green pipeline on the main branch, all repositories', metric: ['min', 0, 38, 15, 'back'],
    thing: 'pipeline time', arc: [{ to: 24, r: 1.03 }, { to: 32, r: 0.9, theme: 'migration' }, { to: 53, r: 1.02, theme: 'recovery' }],
  },
  {
    id: 'ci-shard', parent: 'ns-ci', level: 'svp', team: 'cicd', owner: 'rhea', title: 'Test suites split into parallel shards', source: 'CI test analytics', effect: 9,
    metric: ['%', 0, 20, 90], thing: 'test sharding', arc: steady(1.01),
  },
  {
    id: 'ci-shard-java', parent: 'ci-shard', team: 'cicd', owner: 'diego', title: 'Java suites on the parallel runner', source: 'Jira CICD-301',
    stages: [['Runner supports JUnit 5', 10, 10], ['Payments and ledger suites', 20, 19], ['All Java suites', 34, 33]], thing: 'Java sharding', arc: steady(1),
  },
  {
    id: 'ci-shard-js', parent: 'ci-shard', team: 'cicd', owner: 'femi', title: 'JavaScript suites on the parallel runner', source: 'CI test analytics',
    metric: ['%', 0, 10, 85], thing: 'JavaScript sharding', arc: [{ to: 26, r: 1.0 }, { to: 34, r: 0.8, theme: 'blocked' }, { to: 53, r: 0.98, theme: 'recovery' }], dep: 'the web platform team',
  },
  {
    id: 'ci-dedupe', parent: 'ns-ci', level: 'svp', team: 'cicd', owner: 'rhea', title: 'Superseded pipeline runs cancelled automatically', source: 'CI analytics', effect: 4,
    metric: ['%', 0, 30, 95], thing: 'automatic cancellation', arc: [{ to: 10, r: 1.0 }, { to: 30, r: 1.35, theme: 'early' }, { to: 53, r: 1.3, theme: 'cautious' }],
    done: { week: 37, why: 'Reached 95% in week 35 and held it for two weeks. The rule is on for every repository, so there is nothing left to roll out.' },
  },
  {
    id: 'ci-docker', parent: 'ns-ci', level: 'svp', team: 'cicd', owner: 'rhea', title: 'Base image build time', source: 'Image build pipeline', effect: 6,
    metric: ['min', 0, 22, 8], thing: 'the base image rebuild', dep: 'Security Engineering',
    arc: [{ to: 18, r: 1.0 }, { to: 28, r: 0.78, theme: 'migration', path: { what: 'Switch the remaining images to the slim base once Security signs it off.', in: 5, needs: 'Farah Siddiqui: sign off the slim base image for tier-1 services', answer: { week: 27, by: 'farah', text: 'Signed off for tier-1, with the CVE scan as a required step. Tier-2 next month.' } } }, { to: 53, r: 1.0, theme: 'recovery' }],
  },
  {
    id: 'ci-docker-slim', parent: 'ci-docker', team: 'cicd', owner: 'johanna', title: 'Services on slim base images', source: 'Image registry metadata',
    metric: ['%', 0, 15, 80], thing: 'the slim images', arc: steady(1.02),
  },
  {
    id: 'ci-docker-registry', parent: 'ci-docker', team: 'cicd', owner: 'marcus', title: 'Pull-through registry cache in every region', source: 'Jira CICD-350',
    stages: [['EU West', 16, 14], ['US East', 26, 22], ['AP South', 36, 31], ['Every region', 44, 38]], thing: 'the registry cache', arc: steady(1),
  },

  /* ---------- 3. Deployment frequency: ahead ---------- */
  {
    id: 'ns-deploy', level: 'north-star', team: 'build', owner: 'pavel', title: 'Production deploys per day', source: 'DORA dashboard (Four Keys)',
    definition: 'Production deployments per working day across every deployable service, rolling 4 weeks', metric: ['deploys', 0, 42, 120, 'back'],
    thing: 'the standard pipeline', arc: [{ to: 20, r: 1.02 }, { to: 53, r: 1.12, theme: 'cautious' }], noise: 0.04,
  },
  {
    id: 'dep-selfserve', parent: 'ns-deploy', level: 'svp', team: 'build', owner: 'pavel', title: 'Services deploying through the standard pipeline', source: 'Service catalogue',
    whyHelps: 'Teams on the standard pipeline deploy three times as often as those on their own scripts.', metric: ['%', 0, 58, 95], thing: 'the standard pipeline', arc: steady(1.03),
  },
  {
    id: 'dep-jenkins', parent: 'dep-selfserve', team: 'build', owner: 'chen', title: 'Jenkins jobs still running', source: 'Jenkins inventory',
    metric: ['jobs', 0, 340, 0], thing: 'the Jenkins retirement', dep: 'the payments team',
    arc: [{ to: 20, r: 1.0 }, { to: 36, r: 0.84, theme: 'migration' }, { to: 53, r: 0.9, theme: 'migration' }],
  },
  {
    id: 'dep-templates', parent: 'dep-selfserve', team: 'build', owner: 'olivia', title: 'Pipeline templates adopted by service teams', source: 'Pipeline template registry',
    metric: ['%', 0, 30, 85], thing: 'the templates', arc: steady(1.02),
  },
  {
    id: 'dep-freeze', parent: 'ns-deploy', level: 'svp', team: 'build', owner: 'pavel', title: 'Release freeze days per quarter', source: 'Change calendar',
    range: ['days', 0, 'atMost', 6, 2], thing: 'release freezes', arc: [{ to: 53, r: 0.35 }], noise: 0.1,
  },
  {
    id: 'dep-gates', parent: 'ns-deploy', level: 'svp', team: 'build', owner: 'marcus', title: 'Manual release sign-offs replaced by automated quality gates', source: 'Change calendar + pipeline gates',
    metric: ['%', 0, 25, 90], thing: 'the quality gates', dep: 'Security Engineering',
    arc: [{ to: 22, r: 1.0 }, { to: 32, r: 0.82, theme: 'hiring', path: { what: 'Hand the gates over to Rhea’s team, who already run the pipelines.', in: 6 } }, { to: 53, r: 0.96, theme: 'recovery' }],
    reowner: { week: 30, to: 'rhea', by: 'daniel' },
  },
  {
    id: 'dep-gates-sec', parent: 'dep-gates', team: 'sec', owner: 'ben', title: 'Security gate in every deploy pipeline', source: 'Pipeline gates',
    metric: ['%', 0, 40, 100], thing: 'the security gate', arc: steady(1.02),
  },
  {
    id: 'dep-gates-perf', parent: 'dep-gates', team: 'build', owner: 'patrick', title: 'Performance budget gate on web services', source: 'Jira BR-102',
    stages: [['Budgets agreed with web teams', 12, 12], ['Gate in report-only mode', 24, 24], ['Gate blocking on tier-1 web', 40, 41], ['Gate blocking everywhere', 50, null]], thing: 'the performance gate', arc: steady(1),
  },
  {
    id: 'dep-flags', parent: 'ns-deploy', level: 'svp', team: 'build', owner: 'maximilian', title: 'Releases behind a feature flag', source: 'Feature flag service',
    metric: ['%', 0, 35, 80], thing: 'feature flags', arc: [{ to: 12, r: 1.0 }, { to: 53, r: 1.22, theme: 'tailwind' }], dep: 'the mobile teams',
  },

  /* ---------- 4. Change failure rate: at risk after a breach ---------- */
  {
    id: 'ns-cfr', level: 'north-star', team: 'sre', owner: 'marisol', title: 'Change failure rate', source: 'DORA dashboard (Four Keys)', guardrail: true,
    definition: 'Share of production deploys that cause an incident, a rollback or a hotfix, rolling 4 weeks',
    range: ['%', 1, 'atMost', 15, 2], thing: 'change safety', dep: 'Build & Release',
    arc: [{ to: 30, r: 0.4 }, { to: 37, r: 0.8, theme: 'aggressive' }, { to: 39, r: 1.12, theme: 'incident', why: ['Two bad config pushes and a database migration in one week took the rate over 15%. All three were rolled back within the hour.', 'Over the limit for a second week. The deploy count went up faster than the canary coverage did.'], path: { what: 'Canary analysis on the remaining tier-1 services, and config changes through the pipeline, not the console.', in: 4 } }, { to: 53, r: 0.78, theme: 'recovery' }],
    noise: 0.05,
  },
  {
    id: 'cfr-tests', parent: 'ns-cfr', level: 'svp', team: 'build', owner: 'chen', title: 'Changes shipped with automated integration tests', source: 'Pipeline test reports',
    metric: ['%', 0, 60, 90], thing: 'integration test coverage', arc: steady(1.01),
  },
  {
    id: 'cfr-contract', parent: 'cfr-tests', team: 'build', owner: 'tunde', title: 'Contract tests between the top 40 service pairs', source: 'Pact broker',
    metric: ['pairs', 0, 4, 40], thing: 'contract testing', dep: 'the service teams', arc: [{ to: 20, r: 1.0 }, { to: 53, r: 0.84, theme: 'slower' }],
  },
  {
    id: 'cfr-progressive', parent: 'ns-cfr', level: 'svp', team: 'build', owner: 'elif', title: 'Tier-1 deploys using progressive delivery', source: 'Spinnaker pipelines',
    metric: ['%', 0, 20, 85], thing: 'progressive delivery', dep: 'Observability',
    arc: [{ to: 25, r: 1.0 }, { to: 28, r: 0.76, theme: 'incident' }, { to: 36, r: 0.97, theme: 'recovery' }, { to: 53, r: 1.02 }],
  },
  {
    id: 'cfr-halt', parent: 'cfr-progressive', team: 'build', owner: 'olivia', title: 'Automatic halt when a canary burns its error budget', source: 'Jira BR-88',
    stages: [['Burn-rate signal from Observability', 18, 20], ['Halt in report-only mode', 30, 33], ['Halt on for tier-1', 42, null, [[38, 45]]]],
    thing: 'the automatic halt', dep: 'Observability', arc: [{ to: 53, r: 1, theme: 'blocked' }],
  },
  {
    id: 'cfr-postmortem', parent: 'ns-cfr', level: 'svp', team: 'sre', owner: 'connor', title: 'Failed changes reviewed within five working days', source: 'Incident tracker',
    metric: ['%', 0, 50, 95], thing: 'change reviews', arc: steady(1.02),
  },

  /* ---------- 5. MTTR: recovering; Mateo loaded his early weeks from a spreadsheet ---------- */
  {
    id: 'ns-mttr', level: 'north-star', team: 'sre', owner: 'mateo', title: 'Mean time to restore service (P1 and P2)', source: 'Incident tracker',
    definition: 'Mean minutes from an incident being declared to service restored, P1 and P2 incidents, rolling 8 weeks',
    metric: ['min', 0, 95, 40], thing: 'restore times', dep: 'Observability',
    arc: [{ to: 26, r: 1.01 }, { to: 30, r: 0.82, theme: 'incident', why: ['The storage outage on 14 July took four hours to restore and dominates the eight-week average.', 'Still carrying the July storage outage in the rolling average. It drops out in three weeks.'] }, { to: 40, r: 0.9, theme: 'recovery' }, { to: 53, r: 0.99, theme: 'recovery' }],
    imported: 9,
  },
  {
    id: 'mttr-detect', parent: 'ns-mttr', level: 'svp', team: 'obs', owner: 'yuki', title: 'Mean time to detect', source: 'Incident tracker', effect: 15,
    whyHelps: 'A quarter of restore time is the time before anyone knows something is wrong.', metric: ['min', 1, 18, 5], thing: 'detection', arc: steady(1.02),
  },
  {
    id: 'mttr-slo-alerts', parent: 'mttr-detect', team: 'obs', owner: 'thandiwe', title: 'Services alerting on SLO burn rate instead of thresholds', source: 'Alertmanager rules',
    metric: ['%', 0, 15, 80], thing: 'burn-rate alerting', arc: [{ to: 14, r: 1.0 }, { to: 53, r: 1.25, theme: 'cautious' }],
  },
  {
    id: 'mttr-noise', parent: 'mttr-detect', team: 'obs', owner: 'nikolai', title: 'Pages that needed no action', source: 'PagerDuty analytics',
    range: ['%', 0, 'atMost', 25, 5], thing: 'alert noise', arc: [{ to: 30, r: 0.4 }, { to: 53, r: 0.78, theme: 'slower', path: { what: 'Delete or downgrade the twenty noisiest alerts, one team at a time.', in: 4 } }], noise: 0.06,
  },
  {
    id: 'mttr-traces', parent: 'mttr-detect', team: 'obs', owner: 'grete', title: 'Tier-1 requests with an end-to-end trace', source: 'Tracing backend',
    metric: ['%', 0, 30, 90], thing: 'tracing coverage', arc: [{ to: 30, r: 1.0 }, { to: 34, r: 0.86, theme: 'holiday' }, { to: 53, r: 1.0, theme: 'recovery' }],
  },
  {
    id: 'mttr-runbooks', parent: 'ns-mttr', level: 'svp', team: 'sre', owner: 'chioma', title: 'Alerts linked to a tested runbook', source: 'Runbook registry', effect: 20,
    metric: ['%', 0, 35, 90], thing: 'runbook coverage', dep: 'SRE',
    arc: [{ to: 20, r: 1.0 }, { to: 34, r: 0.8, theme: 'hiring', path: { what: 'Each team writes the runbooks for its own top five alerts; SRE reviews them.', in: 6 } }, { to: 53, r: 0.88, theme: 'recovery' }],
  },
  {
    id: 'mttr-gamedays', parent: 'mttr-runbooks', team: 'sre', owner: 'beatriz', title: 'Runbooks exercised in a game day this quarter', source: 'Game day log',
    metric: ['runbooks', 0, 0, 60], thing: 'game days', arc: [{ to: 24, r: 1.0 }, { to: 53, r: 0.83, theme: 'slower' }],
  },
  {
    id: 'mttr-oncall', parent: 'ns-mttr', team: 'sre', owner: 'samir', title: 'On-call engineers across all twelve rotations who had fewer than two out-of-hours pages in the week, not counting planned maintenance windows', source: 'PagerDuty analytics',
    range: ['%', 0, 'atLeast', 85, 3], thing: 'on-call load', arc: [{ to: 53, r: 0.3 }], noise: 0.08,
  },
  {
    id: 'mttr-aiops', parent: 'ns-mttr', level: 'svp', team: 'sre', owner: 'rafael', title: 'Incidents with an AI-drafted timeline within 15 minutes', source: 'Incident tracker',
    metric: ['%', 0, 0, 70], thing: 'AI timelines', created: 12, arc: [{ to: 20, r: 1.0 }, { to: 53, r: 1.24, theme: 'early' }],
  },
  {
    id: 'mttr-pir', parent: 'ns-mttr', team: 'sre', owner: 'mateo', title: 'Post-incident actions closed within 30 days', source: 'Incident tracker',
    metric: ['%', 0, 40, 85], thing: 'post-incident actions', arc: [{ to: 30, r: 1.0 }, { to: 38, r: 0.84, theme: 'incident' }, { to: 53, r: 0.95, theme: 'recovery' }], imported: 9,
  },

  /* ---------- 6. Availability: on track, one incident ---------- */
  {
    id: 'ns-slo', level: 'north-star', team: 'sre', owner: 'marisol', title: 'Customer-facing availability, tier-1 services', source: 'SLO dashboard',
    definition: 'Share of good requests across tier-1 customer-facing services, rolling 28 days', range: ['%', 2, 'atLeast', 99.9, 0.03],
    thing: 'availability', dep: 'the cloud provider', arc: [{ to: 28, r: 0.3 }, { to: 29, r: 0.85, theme: 'incident', why: ['The 14 July storage outage cost about 40 minutes of tier-1 availability; the 28-day number takes a month to recover.'], path: { what: 'Storage failover drill and the second-region work for the two services that went down.', in: 4 } }, { to: 34, r: 0.6, theme: 'recovery' }, { to: 53, r: 0.3 }],
    noise: 0.07,
  },
  {
    id: 'slo-coverage', parent: 'ns-slo', level: 'svp', team: 'obs', owner: 'yuki', title: 'Tier-1 services with an agreed SLO', source: 'Service catalogue', metric: ['%', 0, 55, 100], thing: 'SLO coverage', arc: steady(1.02),
  },
  {
    id: 'slo-catalogue', parent: 'slo-coverage', team: 'obs', owner: 'adaeze', title: 'SLOs published in the service catalogue', source: 'Service catalogue', metric: ['%', 0, 40, 100], thing: 'SLO publishing', arc: steady(1.01),
  },
  {
    id: 'slo-multiregion', parent: 'ns-slo', level: 'svp', team: 'infra', owner: 'akosua', title: 'Tier-1 services running active-active in two regions', source: 'Service catalogue',
    metric: ['%', 0, 30, 75], thing: 'the second region', vendor: 'The cloud provider', dep: 'Data Platform',
    arc: [{ to: 22, r: 1.0 }, { to: 32, r: 0.85, theme: 'vendor', path: { what: 'Reserve capacity in the second region for tier-1 only, and move the rest next year.', in: 6, needs: 'Björn Halvorsen: approve the second-region capacity reservation', answer: { week: 31, by: 'bjorn', text: 'Approved for tier-1 only. Put the tier-2 case in next year’s plan.' } } }, { to: 53, r: 0.7, theme: 'blocked', path: { what: 'Move the four services whose databases can already replicate; the rest wait for Data Platform’s replication work.', in: 7 } }],
  },
  {
    id: 'slo-failover', parent: 'slo-multiregion', team: 'infra', owner: 'anya', title: 'Database failover tested every quarter', source: 'Jira INF-211',
    stages: [['Q1 failover test', 12, 12], ['Q2 failover test', 25, 26], ['Q3 failover test', 38, 43, [[36, 43]]], ['Q4 failover test', 50, null]], thing: 'failover testing', dep: 'Data Platform', arc: [{ to: 53, r: 1, theme: 'blocked' }],
  },
  {
    id: 'slo-gtm', parent: 'slo-multiregion', team: 'net', owner: 'katarina', title: 'Global traffic manager in front of tier-1 domains', source: 'Jira NET-64',
    stages: [['Vendor chosen', 8, 7], ['Staging domains', 20, 20], ['Tier-1 domains', 40, 39]], thing: 'the traffic manager', arc: steady(1),
  },
  {
    id: 'slo-capacity', parent: 'ns-slo', level: 'svp', team: 'infra', owner: 'sipho', title: 'Clusters above 75% CPU at peak', source: 'Cluster metrics',
    range: ['%', 0, 'atMost', 10, 3], thing: 'cluster headroom', arc: [{ to: 53, r: 0.35 }], noise: 0.08,
  },
  {
    id: 'slo-edge', parent: 'ns-slo', level: 'svp', team: 'net', owner: 'mohammed', title: 'Public endpoints behind edge protection', source: 'Edge config inventory', metric: ['%', 0, 60, 100], thing: 'edge protection', arc: steady(1.02),
  },
  {
    id: 'slo-latency', parent: 'slo-edge', team: 'net', owner: 'zainab', title: 'Cross-region p99 latency', source: 'Network telemetry',
    range: ['ms', 0, 'atMost', 120, 10], thing: 'cross-region latency', arc: [{ to: 40, r: 0.4 }, { to: 53, r: 0.75, theme: 'blocked' }], dep: 'the cloud provider', noise: 0.06,
  },

  /* ---------- 7. Cloud cost per request: re-planned in week 27 ---------- */
  {
    id: 'ns-cost', level: 'north-star', team: 'infra', owner: 'bjorn', title: 'Cloud cost per 1,000 requests', source: 'FinOps dashboard',
    definition: 'Total cloud bill for production, divided by thousands of customer requests served, monthly', metric: ['USD', 2, 0.84, 0.58],
    thing: 'cost per request', dep: 'ML Platform',
    arc: [{ to: 16, r: 1.0 }, { to: 26, r: 0.84, theme: 'aggressive', why: ['The GPU training fleet for ML Platform added 9% to the bill and wasn’t in the plan when we set the target.', 'Still behind: GPU spend is flat, everything else is on plan.'], path: { what: 'Re-plan the target with the GPU fleet in it, and rightsize the training clusters.', in: 5, state: 'target' } }, { to: 27, r: 0.98, theme: 'recovery' }, { to: 53, r: 1.01 }],
    replan: { week: 27, by: 'bjorn', target: 0.62, why: 'The GPU training fleet ML Platform needs for the assistant wasn’t in the plan. 0.62 keeps everything else to the original pace.' },
  },
  {
    id: 'cost-rightsize', parent: 'ns-cost', level: 'svp', team: 'finops', owner: 'ethan', title: 'Compute rightsized against 30 days of usage', source: 'FinOps dashboard', metric: ['%', 0, 35, 85], thing: 'rightsizing', arc: steady(1.02),
  },
  {
    id: 'cost-idle', parent: 'cost-rightsize', team: 'finops', owner: 'kenji', title: 'Idle non-production environments shut down overnight', source: 'Platform API', also: ['ns-env'],
    metric: ['%', 0, 30, 95], thing: 'overnight shutdown', arc: [{ to: 16, r: 1.0 }, { to: 53, r: 1.22, theme: 'early' }],
  },
  {
    id: 'cost-spot', parent: 'cost-rightsize', team: 'infra', owner: 'luca', title: 'Batch workloads on spot capacity', source: 'Cluster metrics',
    metric: ['%', 0, 20, 70], thing: 'the spot migration', dep: 'Data Platform', arc: [{ to: 24, r: 1.0 }, { to: 33, r: 0.75, theme: 'migration' }, { to: 53, r: 0.97, theme: 'recovery' }],
  },
  {
    id: 'cost-commit', parent: 'ns-cost', level: 'svp', team: 'finops', owner: 'valentina', title: 'Committed-use discount coverage', source: 'Cloud billing export', metric: ['%', 0, 55, 80], thing: 'commitments', arc: steady(1.01),
  },
  {
    id: 'cost-showback', parent: 'ns-cost', level: 'svp', team: 'finops', owner: 'amelia', title: 'Teams that opened their monthly cost report', source: 'FinOps dashboard analytics',
    metric: ['%', 0, 10, 90], thing: 'cost reports', arc: [{ to: 12, r: 1.0 }, { to: 53, r: 1.23, theme: 'cautious' }],
  },
  {
    id: 'cost-storage', parent: 'ns-cost', level: 'svp', team: 'infra', owner: 'jonah', title: 'Object storage on the right lifecycle tier', source: 'Storage inventory',
    metric: ['%', 0, 25, 80], thing: 'storage lifecycle rules', arc: [{ to: 30, r: 1.0 }, { to: 53, r: 0.86, theme: 'slower' }], last: 40,
  },
  {
    id: 'cost-logs', parent: 'cost-storage', team: 'obs', owner: 'felix', title: 'Log volume retained beyond 30 days', source: 'Logging platform',
    range: ['TB', 0, 'atMost', 220, 30], thing: 'log retention', arc: [{ to: 53, r: 0.45 }], noise: 0.08,
  },

  /* ---------- 8. Developer satisfaction: at risk ---------- */
  {
    id: 'ns-devsat', level: 'north-star', team: 'portal', owner: 'ingrid', title: 'Developer satisfaction, rolling pulse score', source: 'Developer pulse survey',
    definition: 'Average score out of 100 from the fortnightly developer pulse survey, rolling four weeks', metric: ['pts', 0, 62, 75],
    thing: 'developer satisfaction', dep: 'Developer Experience',
    arc: [{ to: 20, r: 1.02 }, { to: 32, r: 0.86, theme: 'slower', why: ['Build times and flaky tests are the top two complaints again. Both are on the CI/CD plan, and neither has landed yet.', 'Scores dipped in the teams on the old monorepo, where CI is slowest.'] }, { to: 53, r: 0.84, theme: 'blocked', path: { what: 'Close the top five survey actions, starting with local dev in one command.', in: 6, needs: 'Daniel Okafor: put one-command local dev on every team’s Q4 plan' } }],
    noise: 0.04,
  },
  {
    id: 'devsat-onboard', parent: 'ns-devsat', level: 'svp', team: 'portal', owner: 'julia', title: 'Days for a new engineer to merge a first change', source: 'HR start dates + GitHub', metric: ['days', 1, 9, 3], thing: 'onboarding', arc: steady(1.02),
  },
  {
    id: 'devsat-docs', parent: 'devsat-onboard', team: 'devex', owner: 'hannah', title: 'Platform docs pages reviewed in the last six months', source: 'Docs site analytics',
    metric: ['%', 0, 30, 90], thing: 'the docs review', arc: [{ to: 20, r: 1.0 }, { to: 53, r: 0.82, theme: 'slower' }], skip: 0.12,
  },
  {
    id: 'devsat-toil', parent: 'ns-devsat', level: 'svp', team: 'devex', owner: 'tariq', title: 'Hours a week developers lose to tooling friction', source: 'Developer pulse survey',
    metric: ['hours', 1, 6.5, 3.5], thing: 'tooling friction', arc: [{ to: 24, r: 1.0 }, { to: 53, r: 0.86, theme: 'slower', path: { what: 'Local dev in one command for the ten busiest services before the next survey.', in: 6 } }],
  },
  {
    id: 'devsat-localdev', parent: 'devsat-toil', team: 'devex', owner: 'isabel', title: 'Services that start locally with one command', source: 'Dev container manifests',
    metric: ['%', 0, 25, 80], thing: 'one-command local dev', arc: [{ to: 22, r: 1.0 }, { to: 30, r: 0.74, theme: 'blocked' }, { to: 53, r: 0.96, theme: 'recovery' }], dep: 'Data Platform',
  },
  {
    id: 'devsat-devcontainers', parent: 'devsat-toil', team: 'devex', owner: 'mei', title: 'Dev container images rebuilt nightly', source: 'Jira DX-140',
    stages: [['Nightly build for the monorepo', 10, 9], ['Every repository with a dev container', 30, 30], ['Pre-warmed on new laptops', 46, null]], thing: 'dev containers', arc: steady(1),
  },
  {
    id: 'devsat-support', parent: 'ns-devsat', level: 'svp', team: 'portal', owner: 'kojo', title: 'Platform support questions answered within four working hours', source: 'Support channel analytics',
    metric: ['%', 0, 60, 90], thing: 'support response', arc: [{ to: 30, r: 1.0 }, { to: 34, r: 0.82, theme: 'holiday' }, { to: 53, r: 1.0, theme: 'recovery' }],
  },
  {
    id: 'devsat-actions', parent: 'ns-devsat', level: 'svp', team: 'portal', owner: 'ingrid', title: 'Spring survey actions closed', source: 'Survey action tracker',
    metric: ['actions', 0, 0, 24], thing: 'survey actions', arc: steady(1.0),
  },

  /* ---------- 9. Vulnerabilities fixed within SLA: at risk ---------- */
  {
    id: 'ns-vuln', level: 'north-star', team: 'sec', owner: 'farah', title: 'Critical and high vulnerabilities fixed within SLA', source: 'Vulnerability management platform',
    definition: 'Share of critical (7 days) and high (30 days) findings closed within their SLA, rolling 90 days', metric: ['%', 0, 71, 95],
    thing: 'vulnerability fixes', dep: 'CI/CD',
    arc: [{ to: 24, r: 1.01 }, { to: 36, r: 0.88, theme: 'blocked', why: ['Container findings are the gap: images aren’t rebuilt when the base image is fixed, so the same CVE stays open on forty services.'] }, { to: 53, r: 0.83, theme: 'blocked', path: { what: 'Rebuild trigger in CI for base image fixes, then a fix-it week for the oldest container findings.', in: 6 } }],
  },
  {
    id: 'vuln-sca', parent: 'ns-vuln', level: 'svp', team: 'sec', owner: 'omar', title: 'Repositories with dependency scanning on every pull request', source: 'Code scanning', metric: ['%', 0, 50, 100], thing: 'dependency scanning', arc: steady(1.02),
  },
  {
    id: 'vuln-autofix', parent: 'vuln-sca', team: 'sec', owner: 'ben', title: 'Automated dependency upgrades merged within a week', source: 'Dependency bot analytics',
    metric: ['%', 0, 20, 60], thing: 'automated upgrades', arc: [{ to: 20, r: 1.0 }, { to: 53, r: 0.83, theme: 'slower' }],
  },
  {
    id: 'vuln-sbom', parent: 'vuln-sca', team: 'sec', owner: 'siobhan', title: 'Services publishing an SBOM at build', source: 'Artifact registry', metric: ['%', 0, 10, 90], thing: 'SBOMs', arc: [{ to: 14, r: 1.0 }, { to: 53, r: 1.22, theme: 'early' }],
  },
  {
    id: 'vuln-containers', parent: 'ns-vuln', level: 'svp', team: 'sec', owner: 'yasmin', title: 'Container images rebuilt within 7 days of a base image fix', source: 'Image registry metadata', also: ['ci-docker'],
    metric: ['%', 0, 40, 90], thing: 'image rebuilds', dep: 'CI/CD',
    arc: [{ to: 24, r: 1.0 }, { to: 36, r: 0.8, theme: 'blocked', path: { what: 'A rebuild trigger in CI for every base image fix.', in: 6, needs: 'Rhea Kapoor: prioritise the base image rebuild trigger in CI', answer: { week: 37, by: 'rhea', text: 'Yes. Johanna picks it up in week 38; it should be live by week 41.' } } }, { to: 53, r: 0.68, theme: 'slower', path: { what: 'The rebuild trigger goes live in week 41; then a fix-it week for the backlog.', in: 5 } }],
  },
  {
    id: 'vuln-distroless', parent: 'vuln-containers', team: 'sec', owner: 'dmitri', title: 'Tier-1 services on distroless images', source: 'Image registry metadata',
    metric: ['%', 0, 15, 70], thing: 'distroless images', vendor: 'The image vendor', arc: [{ to: 26, r: 1.0 }, { to: 53, r: 0.84, theme: 'vendor' }],
  },
  {
    id: 'vuln-secrets', parent: 'ns-vuln', level: 'svp', team: 'sec', owner: 'laila', title: 'Valid secrets found in code', source: 'Secret scanning', guardrail: true,
    range: ['secrets', 0, 'atMost', 5, 2], thing: 'secret scanning', dep: 'the mobile teams',
    arc: [{ to: 36, r: 0.3 }, { to: 38, r: 1.6, theme: 'incident', why: ['Nine valid cloud keys found in an old mobile repository during the audit. All rotated within a day.', 'Still over: the mobile repository backlog isn’t fully rotated yet.'], path: { what: 'Rotate the remaining keys and turn on push protection for the mobile org.', in: 3 } }, { to: 53, r: 0.35, theme: 'recovery' }],
    noise: 0.08,
  },
  {
    id: 'vuln-vault', parent: 'vuln-secrets', team: 'sec', owner: 'kaito', title: 'Services reading secrets from Vault at runtime', source: 'Vault audit log', metric: ['%', 0, 45, 95], thing: 'Vault adoption', arc: steady(1.02),
  },
  {
    id: 'vuln-pentest', parent: 'ns-vuln', team: 'sec', owner: 'farah', title: 'External penetration test findings closed', source: 'Pen test report tracker',
    stages: [['Scope agreed', 6, 6], ['Test complete', 16, 17], ['Critical and high findings fixed', 30, 32], ['Retest passed', 40, 40]], thing: 'the pen test', arc: steady(1),
  },
  {
    id: 'iam-jit', parent: 'ns-vuln', level: 'svp', team: 'iam', owner: 'leilani', title: 'Production access granted just in time, not standing', source: 'Access broker logs',
    metric: ['%', 0, 20, 85], thing: 'just-in-time access', dep: 'SRE',
    arc: [{ to: 24, r: 1.0 }, { to: 36, r: 0.84, theme: 'migration', path: { what: 'Move the SRE break-glass accounts first; they are most of the standing access.', in: 5, needs: 'Marisol Duarte: agree that SRE break-glass accounts move to just-in-time access', answer: { week: 33, by: 'marisol', text: 'Agreed, as long as the broker has a 99.95% SLO and a tested fallback.' } } }, { to: 53, r: 0.96, theme: 'recovery' }],
  },
  {
    id: 'iam-sso', parent: 'iam-jit', team: 'iam', owner: 'amir', title: 'Internal tools behind single sign-on', source: 'Identity provider', metric: ['%', 0, 70, 100], thing: 'SSO coverage', arc: steady(1.02),
  },
  {
    id: 'iam-keys', parent: 'iam-jit', team: 'iam', owner: 'malik', title: 'Long-lived cloud access keys', source: 'Cloud IAM inventory', metric: ['keys', 0, 420, 50], thing: 'key removal', arc: [{ to: 14, r: 1.0 }, { to: 53, r: 1.21, theme: 'early' }],
  },
  {
    id: 'iam-review', parent: 'iam-jit', team: 'iam', owner: 'freya', title: 'Quarterly access review completed on time', source: 'Access review tool',
    stages: [['Q1 review', 13, 13], ['Q2 review', 26, 27], ['Q3 review', 39, 39], ['Q4 review', 52, null]], thing: 'access reviews', arc: steady(1),
  },
  {
    id: 'net-mtls', parent: 'ns-vuln', team: 'net', owner: 'tobias', title: 'Service-to-service traffic on mutual TLS', source: 'Service mesh telemetry',
    metric: ['%', 0, 40, 95], thing: 'mutual TLS', arc: [{ to: 30, r: 1.0 }, { to: 53, r: 0.9, theme: 'migration' }],
  },

  /* ---------- 10. AI-assisted review: ahead, so Tariq raised the target ---------- */
  {
    id: 'ns-ai', level: 'north-star', team: 'devex', owner: 'tariq', title: 'Pull requests with AI-assisted review', source: 'GitHub pull request data',
    definition: 'Share of merged pull requests that had at least one AI review comment the author responded to', metric: ['%', 0, 18, 60],
    thing: 'the AI reviewer', dep: 'Security Engineering',
    arc: [{ to: 8, r: 1.0 }, { to: 19, r: 1.32, theme: 'cautious', why: ['The AI reviewer became the default for new repositories and teams kept it on. 60% looks too easy now.', 'Well ahead again. I’ll raise the target at the next plan review.'] }, { to: 21, r: 1.05 }, { to: 53, r: 1.03 }],
    replan: { week: 20, by: 'tariq', target: 80, why: 'The AI reviewer is on by default for every new repository and teams are keeping it, so 60% was too easy.' },
  },
  {
    id: 'ai-default', parent: 'ns-ai', level: 'svp', team: 'devex', owner: 'mei', title: 'Repositories with the AI reviewer on by default', source: 'Review bot telemetry', metric: ['%', 0, 10, 95], thing: 'the default setting', arc: [{ to: 10, r: 1.0 }, { to: 53, r: 1.2, theme: 'early' }],
  },
  {
    id: 'ai-approval', parent: 'ai-default', team: 'sec', owner: 'yasmin', title: 'Security approval for the AI reviewer on regulated repositories', source: 'Jira SEC-140',
    stages: [['Data handling review', 10, 10], ['Vendor DPA signed', 18, 27, [[16, 24], [23, 27]]], ['Approved for regulated repos', 26, 33, [[16, 30], [23, 33]]]],
    thing: 'the AI reviewer approval', vendor: 'The AI review vendor', arc: [{ to: 53, r: 1, theme: 'vendor' }],
  },
  {
    id: 'ai-useful', parent: 'ns-ai', level: 'svp', team: 'devex', owner: 'ravi', title: 'AI review comments marked useful by the author', source: 'Review bot telemetry', metric: ['%', 0, 35, 60], thing: 'review quality', arc: steady(1.01),
  },
  {
    id: 'ai-assist', parent: 'ns-ai', level: 'svp', team: 'devex', owner: 'kwame', title: 'Engineers using an AI coding assistant every week', source: 'Assistant licence telemetry', metric: ['%', 0, 25, 70], thing: 'assistant adoption', arc: [{ to: 12, r: 1.0 }, { to: 53, r: 1.21, theme: 'tailwind' }], dep: 'the new laptop rollout',
  },
  {
    id: 'ai-workshop', parent: 'ai-assist', team: 'devex', owner: 'hannah', title: 'Engineers through the AI pairing workshop', source: 'Workshop sign-ups', metric: ['engineers', 0, 0, 300], thing: 'the workshops', arc: [{ to: 30, r: 1.0 }, { to: 34, r: 0.85, theme: 'holiday' }, { to: 53, r: 0.98, theme: 'recovery' }],
  },

  /* ---------- 11. Self-service environments: at risk, with goals gone quiet ---------- */
  {
    id: 'ns-env', level: 'north-star', team: 'portal', owner: 'camille', title: 'Self-service environments ready in under 15 minutes', source: 'Platform API',
    definition: 'Share of environment requests (preview, test and sandbox) that are usable within 15 minutes, with no ticket', metric: ['%', 0, 30, 85],
    thing: 'environment provisioning', dep: 'Infrastructure & Compute',
    arc: [{ to: 22, r: 1.0 }, { to: 36, r: 0.86, theme: 'slower', why: ['Preview environments are fast now; data-backed test environments still take an hour because the snapshot restore is slow.'] }, { to: 53, r: 0.84, theme: 'blocked', path: { what: 'Pre-warmed database snapshots for the five most-requested test environments.', in: 5 } }],
  },
  {
    id: 'env-templates', parent: 'ns-env', level: 'svp', team: 'portal', owner: 'noor', title: 'Golden path templates for the top ten service types', source: 'Template catalogue',
    metric: ['templates', 0, 2, 10], thing: 'the templates', dep: 'Data Platform', arc: [{ to: 20, r: 1.0 }, { to: 53, r: 0.85, theme: 'slower' }],
  },
  {
    id: 'env-tpl-java', parent: 'env-templates', team: 'portal', owner: 'gabriel', title: 'Java service template with paved-road defaults', source: 'Jira DP-31',
    stages: [['Template in beta', 12, 12], ['Used by three teams', 22, 21], ['Default in the portal', 32, 31]], thing: 'the Java template', arc: steady(1),
  },
  {
    id: 'env-tpl-data', parent: 'env-templates', team: 'portal', owner: 'arnav', title: 'Data pipeline template on the portal', source: 'Jira DP-44',
    stages: [['Template design with Data Platform', 18, 20], ['Template in beta', 30, null, [[28, 36], [35, 42], [41, 47]]], ['Default in the portal', 42, null, [[35, 48], [41, 51]]]],
    thing: 'the data pipeline template', dep: 'Data Platform',
    arc: [{ to: 34, r: 1, theme: 'hiring' }, { to: 53, r: 1, theme: 'blocked', path: { what: 'Borrow a data engineer for two weeks to finish the template’s storage step.', in: 5, state: 'help', needs: 'Lend us a data engineer for two weeks to finish the storage step' } }],
  },
  {
    id: 'env-provision', parent: 'ns-env', level: 'svp', team: 'infra', owner: 'priyam', title: 'Median time to provision a preview environment', source: 'Platform API',
    metric: ['min', 0, 45, 12], thing: 'preview provisioning', dep: 'Networking & Edge', arc: [{ to: 20, r: 1.0 }, { to: 28, r: 0.78, theme: 'blocked' }, { to: 40, r: 1.0, theme: 'recovery' }, { to: 53, r: 1.04 }],
  },
  {
    id: 'env-gpu', parent: 'env-provision', team: 'infra', owner: 'astrid', title: 'GPU preview environments on request', source: 'Platform API', metric: ['%', 0, 0, 60], thing: 'GPU previews', created: 44, arc: steady(1),
  },
  {
    id: 'env-portal', parent: 'ns-env', level: 'svp', team: 'portal', owner: 'julia', title: 'Teams using the developer portal every week', source: 'Portal analytics', metric: ['%', 0, 30, 80], thing: 'portal adoption', arc: steady(1.02),
  },
  {
    id: 'env-scorecards', parent: 'env-portal', team: 'portal', owner: 'emma', title: 'Service scorecards in the portal', source: 'Jira DP-52',
    stages: [['Scorecard design tested with five teams', 14, 14], ['Scorecards for tier-1 services', 30, 30], ['Scorecards for every service', 46, null]], thing: 'scorecards', arc: steady(1),
  },
  {
    id: 'env-search', parent: 'env-portal', team: 'portal', owner: 'kojo', title: 'Portal searches that find the right page first time', source: 'Portal analytics',
    metric: ['%', 0, 40, 75], thing: 'portal search', arc: [{ to: 26, r: 1.0 }, { to: 53, r: 0.85, theme: 'slower' }], last: 39,
  },
  {
    id: 'env-tickets', parent: 'ns-env', level: 'svp', team: 'portal', owner: 'camille', title: 'Environment requests that still need a ticket', source: 'Service desk',
    range: ['%', 0, 'atMost', 10, 3], thing: 'ticketed requests', arc: [{ to: 53, r: 0.4 }], noise: 0.08,
  },

  /* ---------- 12. Data freshness: on track, with a data quality incident ---------- */
  {
    id: 'ns-fresh', level: 'north-star', team: 'data', owner: 'jun', title: 'Tier-1 tables fresh within their SLA', source: 'Data observability platform',
    definition: 'Share of hourly checks in which every tier-1 table met its freshness SLA, rolling 4 weeks', metric: ['%', 1, 78, 97],
    thing: 'table freshness', dep: 'the orders database team',
    arc: [{ to: 32, r: 1.02 }, { to: 35, r: 0.82, theme: 'incident', why: ['A schema change on the orders database broke CDC for two days; eleven tier-1 tables were stale.'] }, { to: 53, r: 1.0, theme: 'recovery' }],
  },
  {
    id: 'fresh-streaming', parent: 'ns-fresh', level: 'svp', team: 'data', owner: 'arjun', title: 'Tier-1 pipelines moved from nightly batch to streaming', source: 'Pipeline inventory',
    metric: ['%', 0, 10, 60], thing: 'the streaming migration', dep: 'the Kafka upgrade', arc: [{ to: 22, r: 1.0 }, { to: 53, r: 0.84, theme: 'migration' }],
  },
  {
    id: 'fresh-kafka', parent: 'fresh-streaming', team: 'data', owner: 'santiago', title: 'Kafka moved to the managed service', source: 'Jira DATA-220',
    stages: [['Managed cluster in staging', 14, 15], ['Producers dual-writing', 28, null, [[24, 32], [30, 38], [37, 44]]], ['Consumers cut over', 40, null, [[30, 46], [37, 51]]]],
    thing: 'the Kafka move', vendor: 'The managed Kafka vendor',
    arc: [{ to: 53, r: 1, theme: 'vendor', path: { what: 'Decide between the vendor’s December date and self-hosting the connector.', in: 5, state: 'help', needs: 'Jun Watanabe: decide whether to accept the vendor’s December date or self-host the connector' } }],
  },
  {
    id: 'fresh-cdc', parent: 'fresh-streaming', team: 'data', owner: 'erik', title: 'Change data capture on the orders and billing databases', source: 'Jira DATA-231',
    stages: [['Orders database', 20, 20], ['Billing database', 36, 37], ['Schema-change alerts', 44, 44]], thing: 'CDC', arc: steady(1),
  },
  {
    id: 'fresh-contracts', parent: 'ns-fresh', level: 'svp', team: 'data', owner: 'ayesha', title: 'Tier-1 tables with a data contract', source: 'Data catalogue', metric: ['%', 0, 20, 90], thing: 'data contracts', arc: steady(1.02),
  },
  {
    id: 'fresh-catalogue', parent: 'fresh-contracts', team: 'data', owner: 'rosa', title: 'Tables documented in the data catalogue', source: 'Data catalogue', metric: ['%', 0, 40, 85], thing: 'catalogue docs', arc: [{ to: 30, r: 1.0 }, { to: 34, r: 0.84, theme: 'holiday' }, { to: 53, r: 1.0, theme: 'recovery' }],
  },
  {
    id: 'fresh-quality', parent: 'ns-fresh', team: 'data', owner: 'tomasz', title: 'Data quality checks failing for more than a day', source: 'Data observability platform',
    range: ['checks', 0, 'atMost', 8, 3], thing: 'data quality', arc: [{ to: 32, r: 0.35 }, { to: 34, r: 1.4, theme: 'incident' }, { to: 53, r: 0.4, theme: 'recovery' }], noise: 0.08,
  },
  {
    id: 'fresh-ml', parent: 'ns-fresh', level: 'svp', team: 'ml', owner: 'zara', title: 'Feature store features refreshed within an hour', source: 'Feature store metrics', metric: ['%', 0, 50, 95], thing: 'feature freshness', arc: steady(1.01),
  },
  {
    id: 'ml-registry', parent: 'fresh-ml', team: 'ml', owner: 'vikram', title: 'Models served from the shared model registry', source: 'Model registry', metric: ['%', 0, 20, 80], thing: 'the registry', arc: [{ to: 14, r: 1.0 }, { to: 53, r: 1.22, theme: 'cautious' }],
  },
  {
    id: 'ml-eval', parent: 'fresh-ml', team: 'ml', owner: 'claire', title: 'Model releases with an offline evaluation run first', source: 'ML pipeline metadata', metric: ['%', 0, 30, 90], thing: 'offline evaluation', arc: [{ to: 26, r: 1.0 }, { to: 53, r: 0.82, theme: 'aggressive' }],
  },
  {
    id: 'ml-gpu', parent: 'fresh-ml', team: 'ml', owner: 'obinna', title: 'GPU utilisation across the training fleet', source: 'Cluster metrics', also: ['ns-cost'],
    metric: ['%', 0, 35, 70], thing: 'GPU scheduling', arc: [{ to: 30, r: 1.0 }, { to: 53, r: 0.72, theme: 'slower', path: { what: 'Queue-based scheduling for training jobs instead of reserved nodes per team.', in: 6, needs: 'Björn Halvorsen: agree to pool the reserved GPU nodes across teams', answer: { week: 43, by: 'bjorn', text: 'Agreed, from the start of December. Keep one reserved pool for the assistant team’s release weeks.' } } }],
  },
  {
    id: 'fresh-lakehouse', parent: 'ns-fresh', level: 'svp', team: 'data', owner: 'jun', title: 'Lakehouse platform generally available', source: 'Jira DATA epics',
    stages: [['Data model v1', 10, 10], ['Private preview with three teams', 24, 26], ['Top 50 tables migrated', 44, null, [[40, 46]]], ['Generally available', 48, null, [[40, 50]]]],
    thing: 'the lakehouse', dep: 'the Kafka move', arc: [{ to: 53, r: 1, theme: 'blocked', path: { what: 'Migrate the batch tables first; the streaming ones follow the Kafka move.', in: 5 } }],
  },

  /* ---------- More team goals ---------- */
  {
    id: 'net-ipv6', parent: 'slo-edge', team: 'net', owner: 'hiroshi', title: 'Internal services reachable over IPv6', source: 'Network telemetry', metric: ['%', 0, 20, 70], thing: 'IPv6 rollout', arc: steady(1.01),
  },
  {
    id: 'obs-dashboards', parent: 'slo-coverage', team: 'obs', owner: 'hyunwoo', title: 'Tier-1 services with a standard golden-signals dashboard', source: 'Dashboard inventory', metric: ['%', 0, 50, 100], thing: 'standard dashboards', arc: steady(1.02),
  },
  {
    id: 'devex-remote', parent: 'devsat-toil', team: 'devex', owner: 'isabel', title: 'Engineers using a remote dev environment every week', source: 'Remote dev telemetry', metric: ['%', 0, 5, 40], thing: 'remote dev environments', arc: [{ to: 20, r: 1.0 }, { to: 53, r: 1.1, theme: 'tailwind' }], dep: 'the new laptop rollout',
  },
  {
    id: 'build-sign', parent: 'dep-gates', team: 'build', owner: 'patrick', title: 'Release artifacts signed and verified at deploy', source: 'Artifact registry', metric: ['%', 0, 30, 100], thing: 'artifact signing', arc: steady(1.02),
  },
  {
    id: 'iam-groups', parent: 'iam-jit', team: 'iam', owner: 'lena', title: 'Access granted through groups, not to individuals', source: 'Cloud IAM inventory', metric: ['%', 0, 55, 90], thing: 'group-based access', arc: steady(1.01),
  },
  {
    id: 'ml-serving', parent: 'fresh-ml', team: 'ml', owner: 'sakura', title: 'Models served on the shared inference platform', source: 'Inference platform metrics', metric: ['%', 0, 25, 75], thing: 'the inference platform', arc: [{ to: 16, r: 1.0 }, { to: 53, r: 1.21, theme: 'early' }],
  },
  {
    id: 'cost-requests', parent: 'cost-rightsize', team: 'infra', owner: 'astrid', title: 'Kubernetes requests within 20% of actual usage', source: 'Cluster metrics', metric: ['%', 0, 40, 80], thing: 'request tuning', arc: [{ to: 28, r: 1.0 }, { to: 53, r: 0.97 }],
  },

  /* ---------- Goals that don't feed anything yet ---------- */
  {
    id: 'laptops', team: 'office', owner: 'hamid', title: 'Engineering laptops on a supported operating system', source: 'Device management', metric: ['%', 0, 70, 98], thing: 'the laptop refresh', arc: steady(1.02),
  },
  {
    id: 'ci-cost', team: 'cicd', owner: 'rhea', title: 'CI cost per pipeline run', source: 'FinOps dashboard', metric: ['USD', 2, 0.42, 0.3], thing: 'CI cost', created: 44, arc: steady(1),
  },
];
