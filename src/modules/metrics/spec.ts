/* The metric library's rule, in plain words with worked examples, for its section of the spec
   (spec/modules/metrics/rules.md). The spec's generator reads it through the module registry (src/spec/rules.ts), and
   every example runs against the module's own rules (rules.ts) in the demo workspace, so it can't drift from the code. */
import { exampleKit, type Rule } from '../../spec/rules';
import * as MET from './rules';
import * as LIB from './rulesLibrary';
import * as MEAS from './rulesMeasure';
import { goalsOfMetric, libraryReads } from './reads';
import { CHECK_IN_MOMENT } from '../../spec/conformance';
import { currentWeek } from '../../domain/plan';
import { LABEL } from '../../domain/vocabulary';

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
  {
  id: 'metric-library-place',
  title: 'The library as a place',
  summary: 'Which metrics the library lists for a search and its filters, in what order (rule 1); a metric’s goals side by side (rule 2); and what a metric still needs (rule 3).',
  code: [{ file: 'src/modules/metrics/rulesLibrary.ts', names: ['findMetrics', 'liveLinks', 'metricGoals', 'summaryLine', 'goalsByStatus', 'metricNeeds', 'needsLine', 'movedMetrics', 'metricSlug', 'metricAt', 'decimalsWords'] }, { file: 'src/modules/metrics/reads.ts', names: ['libraryReads', 'goalsOfMetric'] }],
  tests: ['src/modules/metrics/rulesLibrary.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: ['METRICS-LIBRARY'],
  body: `
Each rule takes plain rows: every metric, every goal’s link, the ids of the running cycle’s **live goals** (not removed, not stopped), the people, and the moment it is judged at. A **link in force** is one not unlinked, to a live goal. Removed metrics are never listed.

**Rule 1. Finding metrics** (\`findMetrics\`). A search matches when every word typed starts a word of the metric’s name, unit, “lower is better” or “higher is better”, its owner’s name, its meaning or its source, ignoring case and accents ([finding things](../../core/rules/finding.md), rule 1). Filters, each optional: a **unit** (the same, any case); a **team** (a link in force whose slice is that team) or \`company\` (a link in force for the whole company); an **owner**; a **direction**; **unused** (no link in force); **sort out** (rule 3 says it needs something, whoever is looking). Order: **A to Z** by name, ignoring case and accents (the default); **most goals first** (links in force), then A to Z; **changed lately** (\`updatedAt\`, latest first), then A to Z. Fifty a page; a page past the last shows the last.

**Rule 2. A metric’s goals** (\`metricGoals\`). One row per link in force to a live goal: its status, its slice in words (the team’s name, “The whole company”, or “A removed team”), its latest number as the goal shows it (“No value yet”), its target with its week (“24 hours by year end”), where it stands against plan as the scorecard says it (“9 hours behind plan”; a goal kept in range says its room to the limit, “Near the 2.0% limit”) and its owner: each from the goal’s own summary, never worked out again. Worst status first (on track, then at risk and no recent update, then off track, by the status rank), then by slice name, then title. Under them, \`summaryLine\`: when two or more rows have a number and every one of them is in the same unit with the same decimals, “Lowest now: {slice}, {now}. Highest: {slice}, {now}.” (the lowest number, then the highest; ties by slice name); otherwise nothing.

**Rule 3. What a metric needs** (\`metricNeeds\`), in this order: **no-owner** (“It has no owner” when its owner is no one in the workspace; “Its owner has left” when they have left), **no-meaning** (“No meaning yet”), **no-source** (“No source named”), **unused** (“No goal uses it”: no link in force, and it was added more than ${LIB.UNUSED_GRACE_DAYS} days before the moment). Each has one button: “Choose an owner”, “Say what it means”, “Say where the number comes from” (each opens the metric’s form at that field), or “See goals in {unit}” (Goals, every goal, searched for its unit). A library row says the first, with “and {k} more” after it; only the metric’s owner and admins see them.

**Addresses.** A metric’s page is \`/metrics/<slug>\`, its slug being its id without \`metric_\`. Wednesday’s addresses under Data lead on (\`movedMetrics\`): \`/data/metrics\` to \`/metrics\`, \`?m=<id>\` to the metric, \`?m=<id>&edit\` to its form, \`?new\` to a new one, keeping the rest of the query. Its rows are scored in [the conformance data](../../conformance/README.md) (\`metrics.csv\`).`,
  examples: [
    { given: 'The library, nothing asked.', then: '13 metrics; the first is Change failure rate', run: () => { const f = LIB.findMetrics(reads()); return `${f.total} metrics; the first is ${f.rows[0]!.metric.name}`; } },
    { given: 'Search “min lower”.', then: 'CI pipeline time on main (p90), Mean time to detect, Mean time to restore (P1 and P2), Pipeline queue wait (p90)', run: () => names({ q: 'min lower' }) },
    { given: 'Search “rhea”.', then: 'Flaky test rate, Lead time for changes, Pipeline queue wait (p90), Remote build cache hit rate', run: () => names({ q: 'rhea' }) },
    { given: 'Unit “%”.', then: 'Change failure rate, Flaky test rate, Remote build cache hit rate', run: () => names({ unit: '%' }) },
    { given: 'Used by CI/CD.', then: 'Flaky test rate, Pipeline queue wait (p90), Remote build cache hit rate', run: () => names({ teamId: 'cicd' }) },
    { given: 'Used by the whole company.', then: '7 metrics', run: () => `${LIB.findMetrics(reads(), { teamId: 'company' }).total} metrics` },
    { given: 'No goals use it.', then: 'CI compute cost per pipeline run', run: () => names({ unused: true }) },
    { given: 'Most goals first.', then: 'the last is CI compute cost per pipeline run', run: () => `the last is ${LIB.findMetrics(reads(), { sort: 'goals' }).rows.at(-1)!.metric.name}` },
    { given: 'Lead time for changes’ goals.', then: 'Off track · Lead time for changes · The whole company · 37 hours · 24 hours by year end · 9 hours behind plan · Rhea Kapoor; no summary line', run: () => { const rows = goalsOf('metric_lead-time'); return rows.map((r) => [LABEL[r.status], r.goal.title, r.slice, r.now, r.target, r.vsPlan, r.owner].join(' · ')).join(' / ') + (LIB.summaryLine(rows) ? `; ${LIB.summaryLine(rows)}` : '; no summary line'); } },
    { given: 'Flaky test rate’s goal, kept at most 2.0%.', then: 'At risk · CI/CD · ≤ 2.0% by year end · Near the 2.0% limit', run: () => goalsOf('metric_flaky-rate').map((r) => [LABEL[r.status], r.slice, r.target, r.vsPlan].join(' · ')).join(' / ') },
    { given: 'CI compute cost per pipeline run’s goals.', then: 'none', run: () => String(goalsOf('metric_ci-cost').length || 'none') },
    { given: 'What Lead time for changes needs (owner, meaning, source, one goal).', then: 'nothing', run: () => needs('metric_lead-time') },
    { given: 'What CI compute cost per pipeline run needs: added before the year, complete, no goal.', then: 'unused: No goal uses it → See goals in USD', run: () => needs('metric_ci-cost') },
    { given: 'A metric added today in a goal form with only a name, unit and direction, linked; then its owner marked as left.', then: 'no-meaning, no-source; then no-owner, no-meaning, no-source', run: () => {
      const m = { ...LIB_METRIC('metric_lead-time'), id: 'metric_runner-wait', meaning: '', source: '', createdAt: CHECK_IN_MOMENT };
      const r = { ...reads(), links: [...reads().links, { id: 'ci-shard', goalId: 'ci-shard', metricId: m.id, teamId: 'cicd', linkedBy: 'rhea', linkedAt: CHECK_IN_MOMENT }] };
      const left = { ...r, people: r.people.map((p) => (p.id === m.ownerId ? { ...p, leftAt: CHECK_IN_MOMENT } : p)) };
      return `${LIB.metricNeeds(m, r).map((n) => n.id).join(', ')}; then ${LIB.metricNeeds(m, left).map((n) => n.id).join(', ')}`;
    } },
    { given: 'A metric added yesterday, not yet linked, with a meaning and a source.', then: 'nothing (14 days’ grace)', run: () => { const m = { ...LIB_METRIC('metric_ci-cost'), createdAt: new Date(Date.parse(CHECK_IN_MOMENT) - 86_400_000).toISOString() }; return LIB.metricNeeds(m, reads()).map((n) => n.id).join(', ') || 'nothing (14 days’ grace)'; } },
    { given: 'Old addresses: /data/metrics?m=metric_lead-time&edit, and /data/metrics?new.', then: '/metrics/lead-time/edit, /metrics/new', run: () => `${LIB.movedMetrics('/data/metrics', '?m=metric_lead-time&edit')}, ${LIB.movedMetrics('/data/metrics', '?new')}` },
  ],
  unclear: ['“Changed lately” orders by the metric’s own `updatedAt`, which a link or an unlink doesn’t move.', 'A row with no value yet is left out of the summary line, so one goal with a number and one without says no line.'],
},
];

/* ---------- the library's examples: the demo as built for the conformance moment ---------- */
const reads = () => libraryReads(demo(), CHECK_IN_MOMENT);
const names = (a: LIB.LibraryAsk) => LIB.findMetrics(reads(), a).rows.map((r) => r.metric.name).join(', ');
const queue = () => LIB_METRIC('metric_queue-wait');

rules.push({
  id: 'metric-measured-by',
  title: '“Measured by”, found by typing',
  summary: 'What choosing a metric in a goal form fills in (rule 5), what stops the goal being saved with it, and the words the metric finder gives each metric.',
  code: [{ file: 'src/modules/metrics/rulesMeasure.ts', names: ['measureDefaults', 'measureFormProblems', 'measuredBySays', 'fromTheMetric', 'metricRow', 'searchMetrics', 'suggestMetrics', 'metricRowsByIds'] }, { file: 'src/modules/metrics/finder.ts', names: ['metricFinder', 'measuredByFilter'] }],
  tests: ['src/modules/metrics/rulesMeasure.test.ts', 'src/domain/query.test.ts'],
  reqs: ['METRICS-MEASURED-BY'],
  body: `
A goal's metric is chosen where the goal is made or changed, by typing part of its name, unit, direction, owner, meaning or source (rule 1's words). Each metric reads as two lines: its name, then “{unit} · {lower|higher} is better · {owner}” (“no owner” when it has none, or they have left). Before anything is typed, up to six are offered: those chosen lately, then those the viewer's team's goals are measured by, then the most used. A metric removed since it was chosen still reads by its name.

**Rule 5. What a chosen metric sets on the form** (\`measureDefaults\`). On a **new** goal whose unit and decimal places are still the form's own (nobody typed them), choosing a metric sets both from it, and the form says so in one line instead of the two fields: “{unit}, {decimals in words}, {lower|higher} is better: from the metric.” “Use different ones” shows the fields again, filled from the metric. Choosing “No metric” afterwards gives them back what they held. A field the person typed is kept. On a goal that already exists nothing is set.

**What stops it** (\`measureFormProblems\`). A unit that differs from the metric's, any case, stops the goal being saved with that metric: “This metric is in {unit}; this goal is in {unit}.” More decimal places than the metric keeps is a warning, as linking says. A goal with dated stages has no number, so it has no “Measured by”. Which way the target lies from the start is judged when the link is saved (the metric library, above).

**For.** The goal's team (chosen at first), or the whole company; with no team chosen yet, only the whole company. Check says “Measured by {metric}, for {team | the whole company}.”

**Goals, filtered by a metric.** Goals' address takes \`?metric=<id>\`: the goals a metric measures now (a link in force). The filter line says “Measured by {metric}”. It is declared as data (a column of each goal's summary, the metric its link names), so a server compares the column itself.`,
  examples: [
    { given: 'A new goal, nothing typed; Rhea chooses Pipeline queue wait (p90) (min, 0 decimals, lower is better).', then: 'min, 0: min, whole numbers, lower is better: from the metric.', run: () => { const d = MEAS.measureDefaults(queue(), { isNew: true, untouched: true, unit: '%', decimals: 0 }); return `${d.set!.unit}, ${d.set!.decimals}: ${d.line}`; } },
    { given: 'A new goal with its unit typed as hours; the same metric chosen.', then: 'nothing set; This metric is in min; this goal is in hours.', run: () => { const d = MEAS.measureDefaults(queue(), { isNew: true, untouched: false, unit: 'hours', decimals: 0 }); return `${d.set ? 'set' : 'nothing set'}; ${MEAS.measureFormProblems(queue(), { kind: 'metric', unit: 'hours', decimals: 0 }).errors.join(' ')}`; } },
    { given: 'Changing a goal that keeps 1 decimal place; a metric with 0 chosen.', then: 'nothing set; The goal keeps 1 decimal place and Pipeline queue wait (p90) whole numbers. Check which is meant.', run: () => { const d = MEAS.measureDefaults(queue(), { isNew: false, untouched: true, unit: 'min', decimals: 1 }); return `${d.set ? 'set' : 'nothing set'}; ${MEAS.measureFormProblems(queue(), { kind: 'metric', unit: 'min', decimals: 1 }).warnings.join(' ')}`; } },
    { given: 'Check, measured for CI/CD.', then: 'Measured by Pipeline queue wait (p90), for CI/CD.', run: () => MEAS.measuredBySays(queue(), 'CI/CD') },
    { given: 'The finder, “queue” typed.', then: 'CI pipeline time on main (p90) | Pipeline queue wait (p90): min · lower is better · Rhea Kapoor', run: () => { const a = MEAS.searchMetrics(reads(), { q: 'queue' }); return `${a.rows.map((r) => r.name).join(' | ')}: ${a.rows[1]!.detail}`; } },
  ],
});

const LIB_METRIC = (id: string) => MET.metricsOf(demo()).find((m) => m.id === id)!;
const goalsOf = (id: string) => { const s = demo(); const cycle = s.cycles[0]!; const today = new Date(CHECK_IN_MOMENT); return goalsOfMetric(s, cycle, today, currentWeek(cycle, today), id); };
const needs = (id: string) => LIB.metricNeeds(LIB_METRIC(id), reads()).map((n) => `${n.id}: ${n.sentence} → ${n.button}`).join('; ') || 'nothing';
export default rules;
