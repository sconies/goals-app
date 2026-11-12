/* The metric library's Help articles (src/help/guide.ts places them after People). */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'metrics',
    title: 'Metrics: what each number means',
    summary: 'The metric library: each number goals are measured by, defined once, with its page saying what it means and every goal measured by it, side by side.',
    group: 'you',
    after: 'people',
    sections: [
      { heading: 'What it’s for', text: ['A metric says exactly what a number means (what is counted, over what, its unit and which way is better), so two teams’ “build time” mean the same thing. Metrics is in the menu after People (on a phone, under More), for everyone.'] },
      { heading: 'How to use it', list: [
        'The library lists every metric A to Z, 50 a page. Each row says its unit, which way is better and who owns it, and its goals by status, worst first, or “No goals yet”.',
        'Find a metric by its name, unit, owner or meaning: “min lower” finds those in minutes where lower is better. Unit and Used by narrow the list beside the search; Filters has Owner, Which way is better, No goals use it and Something to sort out. Sort by A to Z, Most goals first or Changed lately. The filter line says what is on, each with Remove.',
        'A search that finds nothing offers to add it as a new metric.',
        'Open a metric to see what it means and how it’s calculated, then every goal measured by it as a table: its status as a shape and a word, the goal, who it is for (a team, or the whole company), the latest number, the target with its week, and where it stands against plan (for a goal kept in range, its room to the limit). When two or more goals have a number, a line says the lowest and highest now.',
        'Below them: where the number comes from, who owns that source, how often it refreshes, any caveats, and who added and last changed it. With one goal, See its goal opens it.',
        'On a goal measured by a metric, its summary says “Measured by …”, and its page has a block with the metric’s meaning and a link to the other goals measured by it. A person’s page lists the metrics they own, and a team’s the metrics its goals use.',
        'Old links to Metrics under Data still work: they open the library, a metric, or the form.',
      ] },
      { heading: 'Who can', list: [
        'Anyone reads the library and every metric, and anyone adds a metric.',
        'A metric’s owner and admins change or remove it. They also see what it still needs (an owner, a meaning, a source, a goal that uses it) on its page, under To sort out, and as a warning on its row in the library. Everyone else sees who can change it.',
      ] },
    ],
    routes: ['/metrics', '/metrics/:metricId', '/data/metrics'],
    screens: ['Metrics', 'MetricPlaces'],
    reqs: ['METRICS-LIBRARY'],
    keywords: ['metric', 'metrics', 'library', 'measure', 'measured by', 'unit', 'definition', 'meaning', 'source', 'kpi', 'number'],
    related: ['metric-add', 'people', 'goal-page'],
  },
  {
    id: 'metric-add',
    title: 'Adding or changing a metric',
    summary: 'Add a metric with a name, a unit and which way is better, and say what it means, where the number comes from and who owns it.',
    group: 'you',
    after: 'metrics',
    sections: [
      { heading: 'How to use it', list: [
        'In Metrics, choose Add a metric. Name, Unit and Which way is better are needed; the rest is optional and can be added later.',
        'Name: what people call it, 3 to 120 characters. No two metrics share a name, whatever the case.',
        'What it means and how it’s calculated: what is counted, from when to when, and what is left out. This is what makes two goals about the same number agree.',
        'Unit: as it follows a number (hours, %, USD, deploys). A goal measured by it must use the same unit. Decimal places: 0 to 4.',
        'Where the number comes from and who owns that source: a dashboard, a query or a report, and the team or person who looks after it. How often it refreshes, if known.',
        'Owner: who answers for the definition, you to start with. Caveats: anything to watch out for when reading it.',
        'Opened from a metric’s To sort out, the form opens at the field that needs filling.',
        'On a metric’s page, its owner and admins choose Change this metric, or Remove this metric. Removing one stops its goals being measured by it (they keep their numbers and plans); Undo, or Recently removed for 30 days, puts it back.',
      ] },
    ],
    routes: ['/metrics/new', '/metrics/:metricId/edit'],
    screens: [],
    reqs: [],
    keywords: ['add metric', 'new metric', 'change metric', 'edit metric', 'remove metric', 'unit', 'decimals', 'owner', 'caveats'],
    related: ['metrics', 'removing'],
  },
  {
    id: 'metric-measured-by',
    title: 'Measured by: choosing a goal’s metric',
    summary: 'In New goal and when changing a goal, say which metric measures it by typing to find one, or add one there.',
    group: 'you',
    after: 'metric-add',
    sections: [
      { heading: 'How to use it', list: [
        'In New goal, “Measured by” is the first field on the step about numbers; when changing a goal, it is under its name. Type part of a metric’s name, unit or owner to find it. Metrics already in the goal’s unit are offered first.',
        'Choosing one shows what it means, with Read more for its page. On a new goal whose unit nobody has typed, it fills in the unit, the decimal places and which way is better, said in one line; Use different ones shows the fields again.',
        'For: the goal’s team, or the whole company. With no team chosen yet, only the whole company is offered.',
        'A goal in another unit can’t be measured by the metric: it says so, and the goal can’t be saved until the units agree or No metric is chosen.',
        'No metric means the goal says in its own words how it’s measured. A goal with dated stages has no number, so it has no “Measured by”.',
        'Nothing fits? Choose Add “…” as a new metric: give it a name, a unit and which way is better, and it is chosen. You own it; say more about it on its page later.',
        'Check reads it back (“Measured by …, for …”). On Goals, Filters has Measured by, and a metric’s page has See its goals.',
      ] },
    ],
    routes: [],
    screens: ['MeasuredBy'],
    reqs: ['METRICS-MEASURED-BY'],
    keywords: ['measured by', 'metric', 'choose metric', 'link metric', 'no metric', 'for'],
    related: ['metrics', 'metric-add', 'new-goal'],
  },
];

export default help;
