/* The metric library's Help article (src/help/guide.ts places it after Data). */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'metrics',
    title: 'Metrics',
    summary: 'The metric library: each number goals are measured by, defined once, with what it means, its unit, which way is better and who owns it.',
    group: 'data',
    after: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'On Data, choose Metrics. Every metric in use is listed by name, with its unit, which way is better, its owner, how many goals it measures and which teams use it. Search finds one by name.',
        'Add a metric: a name, a unit and which way is better are enough to start. What it means and how it’s worked out, decimals, the source and who owns it, how often it refreshes, its owner and caveats can be added now or later.',
        'Open a metric to read its definition and the goals it measures, each with its slice: a team, or the whole company.',
        'On New goal and Edit, Measured by picks the metric that measures a goal, or adds a new one in place. The goal’s own target is its target in that metric.',
        'Once a goal has check-ins, changing or removing its metric asks why, as a plan change does. The reason goes in the goal’s activity.',
        'Removing a metric stops it measuring its goals; Undo puts it all back, and Workspace → Recently removed brings the metric back later.',
      ] },
      { heading: 'Who can', text: ['Anyone adds a metric. Its owner or an admin changes or removes it. A goal’s owner or an admin chooses what measures the goal.'] },
    ],
    routes: ['/data/metrics'],
    screens: ['Metrics', 'MetricForm', 'MetricsLink', 'MeasuredBy', 'GoalMetric'],
    reqs: ['METRIC-LIBRARY', 'MEASURED-BY'],
    keywords: ['metric', 'metrics', 'library', 'measured by', 'definition', 'unit', 'direction', 'source', 'owner', 'slice'],
    related: ['data', 'new-goal', 'edit-goal'],
  },
];

export default help;
