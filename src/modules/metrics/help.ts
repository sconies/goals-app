/* The metrics module's Help article (src/help/guide.ts places it after Data). */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'metrics',
    title: 'Metrics',
    summary: 'Define each number goals are measured by once, then say which metric measures a goal, for its team or the whole company.',
    group: 'data',
    after: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'On Data, choose Metrics. Every metric is listed with its unit, which way is better, its owner, how many goals it measures and which teams use it. Search by name.',
        'Add a metric: give it a name, a unit and which way is better; everything else is optional (what it means and how it’s calculated, decimals, the source and who owns it, how often it refreshes, its owner and caveats).',
        'Open a metric to see its definition and the goals it measures. Its owner or an admin can edit or remove it; removing unlinks its goals, with Undo, and it can be restored later from Workspace, Recently removed.',
        'On New goal and when editing a goal, Measured by picks a metric from the library (those in the goal’s unit first) or creates one there and then. Choose whether it’s the team’s number or the whole company’s.',
        'The goal must be in the metric’s unit, and a goal with dated stages can’t be measured by one. A goal aiming the other way from the metric’s better direction is allowed, with a warning.',
        'A goal’s page shows the metric it’s measured by, what it means, for which team, and the goal’s target in it.',
        'A goal can change its metric at any time, even after check-ins; the change is in its history.',
      ] },
      { heading: 'Who can', text: ['Anyone adds a metric and owns it unless they name another owner. Its owner or an admin changes or removes it. A goal’s owner or an admin chooses what measures it.'] },
    ],
    routes: ['/data/metrics'],
    screens: ['Metrics', 'MetricsLink', 'MeasuredBy', 'GoalMetric'],
    reqs: ['METRICS-PAGE', 'MEASURED-BY'],
    keywords: ['metric', 'metrics', 'library', 'definition', 'measured by', 'unit', 'direction', 'source', 'owner', 'kpi', 'team'],
    related: ['data', 'export'],
  },
];

export default help;
