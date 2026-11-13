/* The metric library's rule, in plain words with worked examples, for its section of the spec
   (spec/modules/metrics/rules.md). The spec's generator reads it through the module registry (src/spec/rules.ts), and
   every example runs against the module's own rules (rules.ts) in the demo workspace, so it can't drift from the code. */
import { exampleKit, type Rule } from '../../spec/rules';
import * as MET from './rules';
import * as LINK from './rulesLink';
import * as LIB from './rulesLibrary';
import * as MEAS from './rulesMeasure';
import * as DEF from './rulesDefine';
import * as PARTS from './rulesParts';
import * as CHG from './rulesChange';
import { checkReads, lineOf } from './reads';
import * as SAVE from './rulesSave';
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
  code: [{ file: 'src/modules/metrics/rules.ts', names: ['metricProblems', 'metricChangeQuestion', 'saveMetric', 'removeMetric', 'linkProblems', 'unlinkGoalMetric', 'measureOf', 'goalTarget'] }, { file: 'src/domain/removal.ts', names: ['undoRemoval', 'restoreRemoved'] }, { file: 'src/modules/metrics/records.ts', names: ['metricToRow', 'metricFromRow'] }],
  tests: ['src/modules/metrics/rules.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: [],
  body: `
A **metric** is one number defined once per workspace, so every goal about it means the same thing. It has a **name**, a **unit** and a **direction** (higher or lower is better): those three are required. Everything else is optional: what it **means and how it’s calculated**, **decimals** (0 to ${MET.METRIC_LIMITS.decimals}; 0 when not said), its **source** and who owns that source (text), how often the source **refreshes** (${MET.REFRESHES.join(', ')}, or not said), its **owner** (a person in the workspace: whoever added it, unless they hand it on) and **caveats**. A name is 3 to ${MET.METRIC_LIMITS.name} characters and no other metric in use shares it, whatever the case; a unit is up to ${MET.METRIC_LIMITS.unit} characters; each text up to ${MET.METRIC_LIMITS.text.toLocaleString('en-GB')}. Text is trimmed before it’s checked.

**Who may.** Anyone adds a metric. Only its owner or an admin changes or removes it. Only a goal’s owner or an admin says which metric measures the goal, or stops it being measured by one, whoever owns the metric.

**Measuring a goal.** A goal is measured by at most one metric, for one **slice**: a team’s number, or the whole company’s. The goal’s own target is the target in that metric (a number to move: its plan’s target; a number to keep in range: its limit); nothing is copied. A goal with dated stages has no number, so no metric measures it. The goal and the metric must have the same unit, any case. A goal aiming the other way from the metric’s better direction (planned to go up when lower is better, or kept at least a level when lower is better) is linked with a warning, since a guardrail may mean it. So is a goal that keeps more decimal places than its metric. The goal's target in the metric is shown as every number is ([numbers and names](../../core/rules/numbers-and-names.md)): at the goal's decimals, digits grouped, with its unit. Linking again with the same metric and slice changes nothing; another metric or slice is a change.

**Logged, never lost.** Every change is in the change log as a metric change (adding, changing field by field, removing, restoring; linking and unlinking on the goal it measures). Only a metric no goal has ever been measured by can be removed (deleted); one that has is retired instead (MT3, rule 10). Removing keeps its row; Undo straight after puts it back, and so does restoring it later from Recently removed. Unlinking keeps the link’s row too, and Undo puts it back.`,
  examples: [
    { given: 'Oskar adds a metric named “Build time” with no unit or direction.', then: 'refused: Say its unit: %, min, hours, USD, deploys… Say which way is better: higher or lower.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Build time' }).commit)) },
    { given: 'Oskar adds “Build time”, in min, lower is better.', then: 'Added the metric “Build time”', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Build time', unit: 'min', direction: 'lower' }).commit)) },
    { given: 'Oskar adds “flaky TEST rate”, in %, lower is better, when “Flaky test rate” is already in the library.', then: 'refused: There’s already a metric called Flaky test rate. Use it, or give this one a different name.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'flaky TEST rate', unit: '%', direction: 'lower' }).commit)) },
    { given: 'Oskar adds “Fláky test rate”, in %, lower is better, when “Flaky test rate” is already in the library.', then: 'refused: There’s already a metric called Flaky test rate. Use it, or give this one a different name.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Fláky test rate', unit: '%', direction: 'lower' }).commit)) },
    { given: 'Oskar changes the caveats of Flaky test rate, which Rhea owns.', then: 'refused: Only Rhea Kapoor or an admin can change this metric.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { id: 'metric_flaky-rate', caveats: 'Retries hide some.' }).commit)) },
    { given: 'Rhea changes Flaky test rate to 2 decimals.', then: 'Changed the metric “Flaky test rate”', run: () => summaryOf(asPerson('rhea', (x) => MET.saveMetric(x, { id: 'metric_flaky-rate', decimals: 2 }).commit)) },
    { given: 'What measures the lead time north star (ns-lead), and its target in it.', then: 'Lead time for changes, The whole company, target 24', run: () => { const m = MET.measureOf(demo(), goalIn('ns-lead'))!; return `${m.metric.name}, ${m.slice}, ${m.target!.kind} ${m.target!.value}`; } },
    { given: 'What measures the flaky test goal (lead-flaky, keep it at most 2%).', then: 'Flaky test rate, CI/CD, at most 2', run: () => { const m = MET.measureOf(demo(), goalIn('lead-flaky'))!; return `${m.metric.name}, ${m.slice}, ${m.target!.kind} ${m.target!.value}`; } },
    { given: 'Rhea measures her test-sharding goal (ci-shard, in %, planned 20 to 90) by Remote build cache hit rate (%, higher is better) for CI/CD.', then: 'Measured by “Remote build cache hit rate” for CI/CD', run: () => summaryOf(asPerson('rhea', (x) => LINK.linkGoalMetric(x, goalIn('ci-shard'), 'metric_cache-hit', 'cicd'))) },
    { given: 'Rhea measures ci-shard (planned to go up) by Flaky test rate (lower is better).', then: 'error: none; warning: The goal aims up, but for Flaky test rate lower is better. Check it’s meant.', run: () => { const p = MET.linkProblems(goalIn('ci-shard'), MET.metricsOf(demo()).find((m) => m.id === 'metric_flaky-rate')!); return `error: ${p.errors.join(' ') || 'none'}; warning: ${p.warnings.join(' ') || 'none'}`; } },
    { given: 'Grace (an admin) measures the CI pipeline time north star (ns-ci, in min) by Lead time for changes (in hours).', then: 'refused: The goal is in min and the metric is in hours. Use the same unit for both.', run: () => summaryOf(asPerson('grace', (x) => LINK.linkGoalMetric(x, goalIn('ns-ci'), 'metric_lead-time'))) },
    { given: 'Grace measures the merge queue goal (lead-mq, dated stages) by Lead time for changes.', then: 'refused: A goal with dated stages has no number, so a metric can’t measure it.', run: () => summaryOf(asPerson('grace', (x) => LINK.linkGoalMetric(x, goalIn('lead-mq'), 'metric_lead-time'))) },
    { given: 'Oskar measures ns-ci, which Daniel owns, by CI pipeline time on main (p90).', then: 'refused: Only the goal’s owner or an admin can choose what measures it.', run: () => summaryOf(asPerson('oskar', (x) => LINK.linkGoalMetric(x, goalIn('ns-ci'), 'metric_ci-time'))) },
    { given: 'Rhea measures ns-lead by Lead time for changes for the whole company, as it already is.', then: 'nothing to save', run: () => summaryOf(asPerson('rhea', (x) => LINK.linkGoalMetric(x, goalIn('ns-lead'), 'metric_lead-time', null))) },
    { given: 'Rhea removes Lead time for changes, which measures one goal.', then: 'refused: Lead time for changes has measured goals, so it can’t be deleted. Retire it instead.', run: () => summaryOf(asPerson('rhea', (x) => MET.removeMetric(x, 'metric_lead-time'))) },
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
    { given: 'Flaky test rate’s goal, kept at most 2.0%.', then: 'At risk · CI/CD · main pipelines · ≤ 2.0% by year end · Near the 2.0% limit', run: () => goalsOf('metric_flaky-rate').map((r) => [LABEL[r.status], r.slice, r.target, r.vsPlan].join(' · ')).join(' / ') },
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

rules.push({
  id: 'metric-care',
  title: 'Looking after metrics',
  summary: 'A name close to one already in the library (rule 4), and what an admin is told on Workspace → About.',
  code: [{ file: 'src/modules/metrics/names.ts', names: ['closeNames', 'nameWords'] }, { file: 'src/modules/metrics/rulesLibrary.ts', names: ['closeNameWords'] }, { file: 'src/modules/metrics/rules.ts', names: ['ownerName', 'ownerlessMetrics'] }, { file: 'src/modules/metrics/finder.ts', names: ['metricsToSortOut'] }],
  tests: ['src/modules/metrics/rulesCare.test.ts'],
  reqs: ['METRICS-CARE'],
  body: `
**Rule 4. A close name** (\`closeNames\`). While a metric is added, a name of four characters or more is compared with every metric in use as sets of words: lower case, without accents and punctuation, leaving out anything in brackets and the words “the”, “of”, “per”, “for”, “in”, “a”, “rate” and “time”. Two names are close when one set contains the other, or when they share at least two words and differ by at most one. Up to two are named, closest first (fewest words apart, then A to Z). An exact match, any case, is not close: it is refused as a name already taken. The question is said, never an error, and never stops the save: “This looks like “{other}” ({unit}, {direction}, owned by {name}). Use that one, or carry on if yours is different.”

**Changing what goals rely on.** When goals in force are measured by a metric and its unit or direction is changed, the form asks first: how many goals, and how many of them will then show a warning that they differ (linking's checks). Their numbers and plans don't change.

**Workspace → About** tells admins how many metrics in use have no owner, or an owner who has left: “{n} metrics have no owner”, because an owner keeps a metric's meaning true, with See them (the library's Something to sort out).`,
  examples: [
    ...([['CI cost per pipeline run', 'CI compute cost per pipeline run', 'close'], ['Queue wait', 'Pipeline queue wait (p90)', 'close'], ['Lead time', 'Lead time for changes', 'close'], ['Deploys per day', 'Production deploys per day', 'close'], ['Change failure rate', 'Flaky test rate', 'not close'], ['Build time', 'Base image build time', 'close'], ['MTTR', 'Mean time to restore (P1 and P2)', 'not close']] as const).map(([typed, existing, then]) => ({
      given: `“${typed}” typed, “${existing}” in the library.`, then,
      run: () => (LIB.closeNames(typed, [{ ...LIB_METRIC('metric_lead-time'), id: 'x', name: existing }]).length ? 'close' : 'not close'),
    })),
    { given: 'Rhea’s metrics when she is marked as left: how many About counts.', then: '4', run: () => String(MET.ownerlessMetrics({ metrics: MET.metricsOf(demo()), people: demo().people.map((p) => (p.id === 'rhea' ? { ...p, leftAt: CHECK_IN_MOMENT } : p)) }).length) },
  ],
});

rules.push({
  id: 'metric-defined',
  title: 'Defining a metric well',
  summary: 'What a metric still needs to say, in words and never as a score (rule 6), and the three questions adding or changing one may ask before it is saved: a close name, a unit spelt another way, a percentage that doesn’t say out of what.',
  code: [{ file: 'src/modules/metrics/edits.ts', names: ['editsBetween'] }, { file: 'src/modules/metrics/rulesStill.ts', names: ['stillToSay'] }, { file: 'src/modules/metrics/rulesDefine.ts', names: ['nameChecks', 'formerNames', 'unitChecks', 'meaningChecks', 'metricChecks', 'unansweredChecks', 'answersFrom', 'countLine'] }, { file: 'src/modules/metrics/reads.ts', names: ['lineOf'] }, { file: 'src/modules/metrics/checkReads.ts', names: ['checkReads'] }, { file: 'src/modules/metrics/rulesSave.ts', names: ['openChecks', 'saveMetricAsked'] }],
  tests: ['src/modules/metrics/rulesDefine.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: ['METRIC-DEFINED'],
  body: `
A metric is **usable** with three things: a name, a unit and which way is better. The rest can be said later, and what is still missing is said in words.

**Rule 6. What a metric still needs** (\`stillToSay\`). In this order: “what it means” (no meaning), “where the number comes from” (no source), “who owns that source” (not said) and “how often it refreshes” (not said). The line is “${DEF.FULLY_DEFINED}” when nothing is missing and its owner is someone here who hasn't left; “${DEF.OWNER_LEFT}” alone when only that; otherwise “Still to say: {what is missing, with commas}.”, followed by “ ${DEF.OWNER_LEFT}” when so. It is words, never a number, a percentage or a bar, and nothing sorts by it. It shows under a metric's title (for its owner and admins each item opens the form at its field), at the foot of the form, in \`get_metric\` (\`stillToSay\`) and after \`save_metric\` saves.

**The questions (Checks).** A Check is a question answered once, never a refusal: the metric can be saved once it is answered. Adding a metric asks all three; changing one asks only about a field that changed.
- **A close name** (\`nameChecks\`), up to two, closest first. *Former*: the name is one a metric in use used to have (a rename in the change log): ““{typed}” is now called “{other}”.”, answered “Use {other}” or “Add “{typed}” as a new metric”. *Letters*: lower case, without accents and punctuation, the names differ by one edit when the longer is up to 12 characters and two when longer, and aren't equal; names of 4 characters or fewer never are (“MTTR” and “MTTD”): “This is one letter from “{other}” ({unit}, {direction}, owned by {owner}, {n} goals).” *Words*: the library's rule 4: “This looks like “{other}” (…).” Both answered “Use that one” (which opens it; the draft is kept) or “Mine is different: keep it”. The same name in any case is a Must fix, not this.
- **A unit spelt another way** (\`unitChecks\`): lower case and without a trailing “s” or “.”, it equals a unit in use, or it is a known spelling of one in use (percent, pct, per cent → %; mins, minutes, minute → min; hrs, hr, hour → hours; secs, seconds, sec → s; dollars, $ → USD), and isn't already identical: “Other metrics here use “{u}”. Use “{u}”, or keep “{typed}”?”
- **A share that doesn't say out of what** (\`meaningChecks\`): the unit is %, or the name has “rate”, “share” or “ratio” and the unit is neither a time nor a count per time; the meaning is said; and it has none of “out of”, “share of”, “of all”, “of every”, “divided by”, “per ”, “÷”, “/”, “percentage of”, “proportion of”, “fraction of”. Answered “It’s right as written”. An empty meaning is never this: it is still to say.

**On the form** a Must fix shows under its field, outlined on every side and washed, with the warning mark and “Must fix”; a Check under its field, in a quiet outlined block with the warning mark, “Check” and its answers as plain buttons. Neither uses a status shape. Both show once the field is left, or on the first try to save. The foot says “{a} to fix, {b} to check.” (\`countLine\`; a part at zero is left out) and the completeness line. Saving is refused while a Must fix stands; with a Check unanswered, the first try scrolls to it and says “Answer the question above first.” under the button. An answered Check closes to one line with Change (“You said: mine is different.”); changing the field asks again.

**Through the AI tools**, \`save_metric\` returns \`checks\` (each with its question and answers) and saves nothing while one is unanswered; it takes \`answers\`: \`name\` “keep” or “use:<id>” (nothing is saved; the result names the metric to use), \`unit\` “keep” or “use”, \`meaning\` “as-written”.`,
  examples: [
    { given: 'Lead time for changes: everything said, Rhea is here.', then: 'Fully defined', run: () => lineOf(demo(), LIB_METRIC('metric_lead-time')).line },
    { given: 'A metric added in a goal form: a name, a unit and a direction only.', then: 'Still to say: what it means, where the number comes from, who owns that source, how often it refreshes.', run: () => DEF.stillToSay({ meaning: '', source: '', sourceOwner: '', refresh: null }, true).line },
    { given: 'Its meaning and source said; who owns the source and its refresh not.', then: 'Still to say: who owns that source, how often it refreshes.', run: () => DEF.stillToSay({ ...LIB_METRIC('metric_lead-time'), sourceOwner: '', refresh: null }, true).line },
    { given: 'Lead time for changes when Rhea, its owner, is marked as left.', then: 'Its owner has left.', run: () => lineOf({ people: demo().people.map((p) => (p.id === 'rhea' ? { ...p, leftAt: CHECK_IN_MOMENT } : p)) }, LIB_METRIC('metric_lead-time')).line },
    { given: 'CI compute cost per pipeline run: complete, measuring no goal.', then: 'Fully defined', run: () => lineOf(demo(), LIB_METRIC('metric_ci-cost')).line },
    ...([['Flaky tests rate', 'letters: Flaky test rate'], ['Remote build cache hit rates', 'letters: Remote build cache hit rate'], ['CI cost per pipeline run', 'words: CI compute cost per pipeline run'], ['MTTR', 'nothing'], ['Change failure rate', 'nothing (the same name is a Must fix)']] as const).map(([typed, then]) => ({
      given: `Adding “${typed}” to the demo library.`, then,
      run: () => { const c = DEF.nameChecks(typed, checkReads(demo()).metrics)[0]; return c ? `${c.kind}: ${c.other.name}` : typed === 'Change failure rate' ? 'nothing (the same name is a Must fix)' : 'nothing'; },
    })),
    { given: '“Deploy frequency” typed, when Production deploys per day was once called that.', then: 'former: Production deploys per day', run: () => { const c = DEF.nameChecks('Deploy frequency', checkReads(demo()).metrics, [{ id: 'metric_deploys', name: 'Deploy frequency' }])[0]!; return `${c.kind}: ${c.other.name}`; } },
    ...([['mins', 'Use “min”'], ['percent', 'Use “%”'], ['min', 'nothing'], ['deploys', 'nothing'], ['ms', 'nothing']] as const).map(([typed, then]) => ({
      given: `A unit typed as “${typed}”, with the demo’s units in use (hours, min, %, deploys, USD, pts).`, then,
      run: () => { const u = DEF.unitChecks(typed, checkReads(demo()).metrics.map((m) => m.unit)); return u ? `Use “${u.use}”` : 'nothing'; },
    })),
    { given: 'Change failure rate, in %: “Share of production deploys that led to an incident…”.', then: 'nothing', run: () => DEF.meaningChecks({ name: 'Change failure rate', unit: '%', meaning: 'Share of production deploys that led to an incident.' }) ?? 'nothing' },
    { given: '“Deploy success rate”, in %: “Deploys that worked.”', then: 'out-of-what', run: () => DEF.meaningChecks({ name: 'Deploy success rate', unit: '%', meaning: 'Deploys that worked.' }) ?? 'nothing' },
    { given: 'Any metric in % with no meaning.', then: 'nothing', run: () => DEF.meaningChecks({ name: 'Anything', unit: '%', meaning: '' }) ?? 'nothing' },
    { given: 'Rhea adds “Flaky tests rate”, %, no direction, meaning “Flakes seen.”: the foot of the form.', then: '1 to fix, 2 to check.', run: () => { const next = { id: '', name: 'Flaky tests rate', unit: '%', meaning: 'Flakes seen.' }; return DEF.countLine(1, DEF.metricChecks(next, null, checkReads(demo())).length); } },
    { given: 'Oskar adds “Flaky tests rate”, %, lower is better, meaning “Flakes seen.”, from a goal’s Measured by, answering nothing.', then: 'refused: Answer these questions first: This is one letter from “Flaky test rate” (%, lower is better, owned by Rhea Kapoor, 1 goal). This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”.', run: () => summaryOf(asPerson('oskar', (x) => SAVE.saveMetricAsked(x, { name: 'Flaky tests rate', unit: '%', direction: 'lower', meaning: 'Flakes seen.' }).commit)) },
  ],
  unclear: ['Two close names are both found, but the form and save_metric ask about the closest one only.', 'The weekly rhythm is assumed for the form’s refresh hint until a workspace can choose its rhythm (FT1).'],
});

rules.push({
  id: 'metric-parts',
  title: 'For, which part, and what a goal takes from its metric',
  summary: 'Which part of a team’s or the company’s number a goal is measured by (rule 7), the parts other goals on the metric use, what linking asks, and why a goal with check-ins says why it is measured differently.',
  code: [{ file: 'src/modules/metrics/rulesParts.ts', names: ['partKey', 'partsOf', 'closePart', 'linkChecks', 'linkChanges', 'forWords', 'PART_MAX', 'LINK_REASON_MAX'] }, { file: 'src/modules/metrics/rulesLink.ts', names: ['linkGoalMetric', 'linkReads'] }, { file: 'src/modules/metrics/rulesMeasure.ts', names: ['fromMetricWords', 'FROM_METRIC_NOTE'] }],
  tests: ['src/modules/metrics/rulesParts.test.ts', 'src/modules/metrics/rules.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: ['METRIC-PARTS'],
  body: `
A goal measured by a metric takes two things from it: its **unit** and **which way is better** (“From the metric”: “{unit}, {decimals in words}, {lower|higher} is better.”, then “ From {source}, refreshed {refresh}.” when the metric says them). Its start, target, plan and due week stay the goal's own. A link says whose number: **For** a team or the whole company, and optionally **Which part** of it (“tier-1 services”, a region, “release builds”; at most ${PARTS.PART_MAX} characters; empty for all of it).

**Rule 7. Parts** (\`partKey\`, \`partsOf\`, \`closePart\`). Two parts are one when they match lower case, without accents and punctuation, with spaces collapsed and a trailing “s” dropped from each word. \`partsOf\` lists the distinct parts a metric's live links use, most used first, each in its most used spelling; the form offers up to five under the field (“Parts other goals on this metric use: …”, each filling the field). \`closePart\` finds a part in use that a typed one probably means: the same part spelt differently, or one edit away (never for parts of two characters or fewer).

**What linking asks** (\`linkChecks\`, in \`linkGoalMetric\` and \`link_goal_metric\`). Must fix, which refuses the link: what the library already refuses (dated stages; a different unit), a part over ${PARTS.PART_MAX} characters, and, on a goal with check-ins whose metric, team or part changes, an empty **Why** (“Say why this goal is measured differently now. It shows in its History.”; at most ${PARTS.LINK_REASON_MAX} characters). Checks, each answered once: another live goal on the same metric, team and part (“Another goal already measures this for {slice}: “{goal}” ({key}, {owner}). Two goals on one number is unusual.” → Carry on), and, when there is none, a part spelt like one in use (“{metric} already has a part called “{other}”.” → Use “{other}” / Keep “{typed}”). Aim and decimals stay warnings, as before. The History entry says “Measured by “{metric}” for {slice} · {part}: {why}”, with a row for each of Measured by, Slice and Which part that changed.

**Shown** on a goal's About as “Measured by {metric}”, a list: For ({slice}{ · part}), What it means, From the metric, Where the number comes from (“{source} ({source owner}), refreshed {refresh}”, parts left out when empty), Caveats, This goal's own (its target), and For this goal (its own definition, only when it differs from the metric's meaning). On a metric's page each goal's For reads “{slice} · {part}”. Through the AI tools, \`link_goal_metric\` takes \`part\` and \`reason\`, returns \`checks\` and saves nothing until it gets \`answers\` (\`part\`: “keep” or “use:{part}”; \`others\`: “carry-on”).`,
  examples: [
    { given: 'Parts “Tier 1 service” and “tier-1 services”.', then: 'the same part', run: () => (PARTS.partKey('Tier 1 service') === PARTS.partKey('tier-1 services') ? 'the same part' : 'different') },
    { given: 'Part “EU” when the parts in use are “US” and “APAC”.', then: 'nothing', run: () => PARTS.closePart('EU', ['US', 'APAC']) ?? 'nothing' },
    { given: 'Part “release bilds” when “release builds” is in use.', then: 'release builds', run: () => PARTS.closePart('release bilds', ['release builds']) ?? 'nothing' },
    { given: 'Pipeline queue wait (p90): what a goal takes from it.', then: 'min, whole numbers, lower is better. From CI runner metrics, refreshed hourly.', run: () => MEAS.fromMetricWords(queue()) },
    { given: 'Rhea measures Base image build time (ci-docker, in min, 43 check-ins) by Pipeline queue wait (p90) for CI/CD, part “main branch pipelines”, as Pipeline queue wait already is.', then: 'Check: Another goal already measures this for CI/CD, main branch pipelines: “Pipeline queue wait (p90)” (G-14, Rhea Kapoor). Two goals on one number is unusual.', run: () => {
      const x = { snapshot: demo(), full: demo() } as Parameters<typeof LINK.linkReads>[0];
      const g = demo().goals.find((v) => v.id === 'ci-docker')!;
      return PARTS.linkChecks(g, queue(), { teamId: 'cicd', part: 'main branch pipelines' }, MET.linkProblems(g, queue()), LINK.linkReads(x, g, queue().id), '').map((c) => `${c.kind === 'fix' ? 'Must fix' : 'Check'}: ${c.words}`).join(' ') || 'nothing';
    } },
    { given: 'Rhea moves Pipeline queue wait (p90) (lead-ci-time, with check-ins) to the part “release builds” and gives no reason.', then: 'refused: Say why this goal is measured differently now. It shows in its History.', run: () => summaryOf(asPerson('rhea', (x) => LINK.linkGoalMetric(x, goalIn('lead-ci-time'), 'metric_queue-wait', 'cicd', 'release builds'))) },
    { given: 'The same, with the reason “Release builds queue apart from main now”.', then: 'Measured by “Pipeline queue wait (p90)” for CI/CD · release builds: Release builds queue apart from main now', run: () => summaryOf(asPerson('rhea', (x) => LINK.linkGoalMetric(x, goalIn('lead-ci-time'), 'metric_queue-wait', 'cicd', 'release builds', 'Release builds queue apart from main now'))) },
  ],
  unclear: ['The demo has no metric measuring several goals yet: its two parts are on existing links (Pipeline queue wait for CI/CD · main branch pipelines; Flaky test rate for CI/CD · main pipelines). MT5’s comparison adds goals that share a metric.', '“Use different ones” (round 1) is kept on a new goal: the spec drops it, but taking it out changes round 1’s journeys; MT3 or MT7 can.'],
});

rules.push({
  id: 'metric-change',
  title: 'Changing, retiring and merging a metric',
  summary: 'What kind of change a save is (rule 8), the marks a change of meaning or direction leaves on its goals (rule 9), and retiring, bringing back and merging (rule 10): a metric that changes tells its goals.',
  code: [{ file: 'src/modules/metrics/rulesChange.ts', names: ['changeKinds', 'linkedGoals', 'aimingWrong', 'saveMetricChange', 'retireMetric', 'unretireMetric', 'mergeMetrics', 'retiredWords'] }, { file: 'src/modules/metrics/rules.ts', names: ['everUsed', 'marksFor', 'markLabel', 'liveMetrics', 'removeMetric'] }],
  tests: ['src/modules/metrics/rulesChange.test.ts', 'src/modules/metrics/rules.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: ['METRIC-CHANGE'],
  body: `
**Rule 8. What kind of change** (\`changeKinds(before, after, linkedGoals, { relabel })\`). Every kind that applies, in this order: \`scale\` (the unit differs, goals are linked, and it isn't said to be a new label: refused), \`relabel\` (the same, said to be a new label: every linked goal's unit changes in the same save), \`direction\` (needs a reason), \`meaning\` (the meaning or the source differs: asks whether it is still the same number, \`comparable\`; when it isn't, a reason), \`decimals\` (fewer places than a linked goal shows: named, nothing asked). Anything else, or any change to a metric no live goal uses, is \`words\` and saves at once; nothing different is \`none\`. A reason is at most 300 characters. The form reads the change back before saving (title, Was and Will be, the goals named, the six first then “and {k} more”); \`save_metric\` takes \`comparable\`, \`reason\` and \`relabel\`.

**Rule 9. Marks** (\`marksFor(metric, link, since)\`). A save with the number changed (\`comparable: false\`) or a new direction keeps a mark on the metric: \`{ week, at, by, kind: definition | direction, why, was, now }\`, oldest first. A goal shows the marks made at or after it was linked, and since its cycle began: on its chart a dashed hairline at the week labelled beside it (“Definition changed, week {w}”, “Direction changed, week {w}”, through the core's \`goal.marks\` point), in its History the entry with the reason, and under About the line with “See both definitions”. Undo takes the mark back with the change.

**Rule 10. Retire, bring back, merge** (\`retireMetric\`, \`unretireMetric\`, \`mergeMetrics\`, \`everUsed\`). A metric that has ever measured a goal (\`everUsed\`) can't be deleted: “{name} has measured goals, so it can’t be deleted. Retire it instead.” Its owner or an admin retires it with a reason (and optionally a live metric in the same unit that replaces it): its links stay, its goals keep their numbers and say “Measured by {metric}, retired {date}”, it leaves \`liveMetrics\` (the pickers and the library's list) but \`measureOf\` and \`findMetric\` still find it, and no new goal can be linked to it. Bring it back clears the four fields. Admins merge a live metric into another live one in the same unit: every live link moves (same slice and part), the first is retired pointing to the second, and each moved goal's History says so. Each is one save with one Undo.`,
  examples: [
    { given: 'Lead time for changes (1 goal): its caveats reworded.', then: 'words', run: () => CHG.changeKinds(LIB_METRIC('metric_lead-time'), { ...LIB_METRIC('metric_lead-time'), caveats: 'Counts only services on the paved road.' }, CHG.linkedGoals(demo(), 'metric_lead-time')).join(', ') },
    { given: 'Lead time for changes: its meaning changed.', then: 'meaning', run: () => CHG.changeKinds(LIB_METRIC('metric_lead-time'), { ...LIB_METRIC('metric_lead-time'), meaning: 'From merge to production, p50.' }, CHG.linkedGoals(demo(), 'metric_lead-time')).join(', ') },
    { given: 'Lead time for changes: hours to min, not said to be a label.', then: 'scale', run: () => CHG.changeKinds(LIB_METRIC('metric_lead-time'), { ...LIB_METRIC('metric_lead-time'), unit: 'min' }, CHG.linkedGoals(demo(), 'metric_lead-time')).join(', ') },
    { given: 'Rhea changes what Lead time for changes means and says the number itself changes, with no reason.', then: 'refused: Say why, in a line. Every goal measured by it will show this.', run: () => summaryOf(asPerson('rhea', (x) => CHG.saveMetricChange(x, { id: 'metric_lead-time', meaning: 'From merge to production, p50.', comparable: false }).commit)) },
    { given: 'Rhea deletes Lead time for changes, which measures a goal.', then: 'refused: Lead time for changes has measured goals, so it can’t be deleted. Retire it instead.', run: () => summaryOf(asPerson('rhea', (x) => MET.removeMetric(x, 'metric_lead-time'))) },
    { given: 'Rhea retires Flaky test rate: “The test platform reports it now.”', then: 'Retired the metric “Flaky test rate”: The test platform reports it now. / Its metric “Flaky test rate” was retired: The test platform reports it now.', run: () => summaryOf(asPerson('rhea', (x) => CHG.retireMetric(x, 'metric_flaky-rate', 'The test platform reports it now.'))) },
    { given: 'Rhea, not an admin, merges Flaky test rate into Remote build cache hit rate.', then: 'refused: Only admins can merge metrics: it changes what other people’s goals are measured by.', run: () => summaryOf(asPerson('rhea', (x) => CHG.mergeMetrics(x, 'metric_flaky-rate', 'metric_cache-hit'))) },
  ],
  unclear: ['The mark’s week is the cycle week the change is saved in; a change saved between cycles marks week 0 of the next.', 'Merging two metrics in different directions is a Check on the form (“Merge anyway”), not a rule: the rule merges either way.', 'The library lists retired metrics only through list_metrics (retired: true) and a metric’s own page; a Retired filter on the page itself is left for MT5 or later.'],
});

const LIB_METRIC = (id: string) => MET.metricsOf(demo()).find((m) => m.id === id)!;
const goalsOf = (id: string) => { const s = demo(); const cycle = s.cycles[0]!; const today = new Date(CHECK_IN_MOMENT); return goalsOfMetric(s, cycle, today, currentWeek(cycle, today), id); };
const needs = (id: string) => LIB.metricNeeds(LIB_METRIC(id), reads()).map((n) => `${n.id}: ${n.sentence} → ${n.button}`).join('; ') || 'nothing';
export default rules;
