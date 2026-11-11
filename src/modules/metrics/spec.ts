/* The metric library's rule, in plain words with worked examples, for its section of the spec
   (spec/modules/metrics/rules.md). The spec's generator reads it through the module registry (src/spec/rules.ts), and
   every example runs against the module's own rules (rules.ts) in the demo workspace, so it can't drift from the code. */
import { exampleKit, type Rule } from '../../spec/rules';
import * as MET from './rules';

// Read when an example runs, never before: the kit's demo workspace is built first (src/spec/rules prepareExamples).
const demo = () => exampleKit.demo();
const asPerson: typeof exampleKit.asPerson = (who, run) => exampleKit.asPerson(who, run);
const goalIn = (id: string) => exampleKit.goalIn(id);
const summaryOf = (c: Parameters<typeof exampleKit.summaryOf>[0]) => exampleKit.summaryOf(c);

const rules: Rule[] = [
  {
  id: 'metrics',
  title: 'The metric library',
  summary: 'What a metric must say, who may add, change, remove, link and unlink one, and which metric measures a goal, for which slice.',
  code: [{ file: 'src/modules/metrics/rules.ts', names: ['metricProblems', 'saveMetric', 'removeMetric', 'linkProblems', 'linkGoalMetric', 'unlinkGoalMetric', 'measureOf', 'goalTarget'] }, { file: 'src/domain/removal.ts', names: ['undoRemoval', 'restoreRemoved'] }, { file: 'src/modules/metrics/records.ts', names: ['metricToRow', 'metricFromRow'] }],
  tests: ['src/modules/metrics/rules.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: [],
  body: `
A **metric** is one number defined once per workspace, so every goal about it means the same thing. It has a **name**, a **unit** and a **direction** (higher or lower is better): those three are required. Everything else is optional: what it **means and how it’s calculated**, **decimals** (0 to ${MET.METRIC_LIMITS.decimals}; 0 when not said), its **source** and who owns that source (text), how often the source **refreshes** (${MET.REFRESHES.join(', ')}, or not said), its **owner** (a person in the workspace: whoever added it, unless they hand it on) and **caveats**. A name is 3 to ${MET.METRIC_LIMITS.name} characters and no other metric in use shares it, whatever the case; a unit is up to ${MET.METRIC_LIMITS.unit} characters; each text up to ${MET.METRIC_LIMITS.text.toLocaleString('en-GB')}. Text is trimmed before it’s checked.

**Who may.** Anyone adds a metric. Only its owner or an admin changes or removes it. Only a goal’s owner or an admin says which metric measures the goal, or stops it being measured by one, whoever owns the metric.

**Measuring a goal.** A goal is measured by at most one metric, for one **slice**: a team’s number, or the whole company’s. The goal’s own target is the target in that metric (a number to move: its plan’s target; a number to keep in range: its limit); nothing is copied. A goal with dated stages has no number, so no metric measures it. The goal and the metric must have the same unit, any case. A goal aiming the other way from the metric’s better direction (planned to go up when lower is better, or kept at least a level when lower is better) is linked with a warning, since a guardrail may mean it. So is a goal that keeps more decimal places than its metric. The goal's target in the metric is shown as every number is ([numbers and names](../../core/rules/numbers-and-names.md)): at the goal's decimals, digits grouped, with its unit. Linking again with the same metric and slice changes nothing; another metric or slice is a change.

**Logged, never lost.** Every change is in the change log as a metric change (adding, changing field by field, removing, restoring; linking and unlinking on the goal it measures). Removing a metric keeps its row, unlinks every goal it measured in the same save, and leaves the goals as they were. Undo straight after puts the metric and its links back; restoring it later from Recently removed brings the metric back without its old links. Unlinking keeps the link’s row too, and Undo puts it back.`,
  examples: [
    { given: 'Oskar adds a metric named “Build time” with no unit or direction.', then: 'refused: Say its unit: %, min, hours, USD, deploys… Say which way is better: higher or lower.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Build time' }).commit)) },
    { given: 'Oskar adds “Build time”, in min, lower is better.', then: 'Added the metric “Build time”', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Build time', unit: 'min', direction: 'lower' }).commit)) },
    { given: 'Oskar adds “flaky TEST rate”, in %, lower is better, when “Flaky test rate” is already in the library.', then: 'refused: There’s already a metric called Flaky test rate. Use it, or give this one a different name.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'flaky TEST rate', unit: '%', direction: 'lower' }).commit)) },
    { given: 'Oskar changes the caveats of Flaky test rate, which Rhea owns.', then: 'refused: Only Rhea Kapoor or an admin can change this metric.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { id: 'metric_flaky-rate', caveats: 'Retries hide some.' }).commit)) },
    { given: 'Rhea changes Flaky test rate to 2 decimals.', then: 'Changed the metric “Flaky test rate”', run: () => summaryOf(asPerson('rhea', (x) => MET.saveMetric(x, { id: 'metric_flaky-rate', decimals: 2 }).commit)) },
    { given: 'What measures the lead time north star (ns-lead), and its target in it.', then: 'Lead time for changes, The whole company, target 24', run: () => { const m = MET.measureOf(demo(), goalIn('ns-lead'))!; return `${m.metric.name}, ${m.slice}, ${m.target!.kind} ${m.target!.value}`; } },
    { given: 'What measures the flaky test goal (lead-flaky, keep it at most 2%).', then: 'Flaky test rate, CI/CD, at most 2', run: () => { const m = MET.measureOf(demo(), goalIn('lead-flaky'))!; return `${m.metric.name}, ${m.slice}, ${m.target!.kind} ${m.target!.value}`; } },
    { given: 'Rhea measures her test-sharding goal (ci-shard, in %, planned 20 to 90) by Remote build cache hit rate (%, higher is better) for CI/CD.', then: 'Measured by “Remote build cache hit rate” for CI/CD', run: () => summaryOf(asPerson('rhea', (x) => MET.linkGoalMetric(x, goalIn('ci-shard'), 'metric_cache-hit', 'cicd'))) },
    { given: 'Rhea measures ci-shard (planned to go up) by Flaky test rate (lower is better).', then: 'error: none; warning: The goal aims up, but for Flaky test rate lower is better. Check it’s meant.', run: () => { const p = MET.linkProblems(goalIn('ci-shard'), MET.metricsOf(demo()).find((m) => m.id === 'metric_flaky-rate')!); return `error: ${p.errors.join(' ') || 'none'}; warning: ${p.warnings.join(' ') || 'none'}`; } },
    { given: 'Grace (an admin) measures the CI pipeline time north star (ns-ci, in min) by Lead time for changes (in hours).', then: 'refused: The goal is in min and the metric is in hours. Use the same unit for both.', run: () => summaryOf(asPerson('grace', (x) => MET.linkGoalMetric(x, goalIn('ns-ci'), 'metric_lead-time'))) },
    { given: 'Grace measures the merge queue goal (lead-mq, dated stages) by Lead time for changes.', then: 'refused: A goal with dated stages has no number, so a metric can’t measure it.', run: () => summaryOf(asPerson('grace', (x) => MET.linkGoalMetric(x, goalIn('lead-mq'), 'metric_lead-time'))) },
    { given: 'Oskar measures ns-ci, which Daniel owns, by CI pipeline time on main (p90).', then: 'refused: Only the goal’s owner or an admin can choose what measures it.', run: () => summaryOf(asPerson('oskar', (x) => MET.linkGoalMetric(x, goalIn('ns-ci'), 'metric_ci-time'))) },
    { given: 'Rhea measures ns-lead by Lead time for changes for the whole company, as it already is.', then: 'nothing to save', run: () => summaryOf(asPerson('rhea', (x) => MET.linkGoalMetric(x, goalIn('ns-lead'), 'metric_lead-time', null))) },
    { given: 'Rhea removes Lead time for changes, which measures one goal.', then: 'Removed the metric “Lead time for changes”, unlinking 1 goal / No longer measured by “Lead time for changes”, as the metric was removed', run: () => summaryOf(asPerson('rhea', (x) => MET.removeMetric(x, 'metric_lead-time'))) },
  ],
  unclear: ['Two people changing the same metric at once: the later save wins (metrics carry no version yet, unlike goals and reviews).', 'The words for a slice are the team’s name, or “The whole company”; the change log says “for the whole company” or “for <team>”.'],
},
];
export default rules;
