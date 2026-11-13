/* The metric library's sheet in the workbook (domain/export, through records.ts): Metrics, after the core's sheets and
   before the README. It loads back (MI, round 2's MT6; docs/design/metrics-2/spec.md 3.1): the sheet and its reader are
   the module's, declared through the `sheets` point (domain/records ModuleSheet), and the change engine reads it with
   the module's own rules (sheetRead.ts, loaded with the import), so a file of metrics gets the same preview, questions
   and Undo as a file of goals. With the module switched off, the workbook neither writes nor reads it. */
import { cellOr, moduleColumn, oneOf, type Ctx, type Field } from '../../domain/columns';
import type { ModuleSheet, SheetCounts } from '../../domain/records';
import type { Goal } from '../../domain/types';
import { DIRECTION_LABEL, linksOf, liveMetrics, METRIC_LIMITS, ownerName, REFRESH_LABEL, sliceName } from './rules';
import { stillToSay } from './rulesStill';
import { METRIC_ACTION_WORDS, METRIC_HEADER_ALSO } from './sheetWords';
import type { Metric } from './types';

/** A metric in the library, and the exported goals it measures, each with its slice. */
export interface MetricRow { c: Ctx; m: Metric; measures: { g: Goal; slice: string }[] }

const { match: m, edit: ed, action: act, worked: wk, shown: sh } = moduleColumn;
const or = cellOr;
const LONG = METRIC_LIMITS.text.toLocaleString('en-GB');

/** Each column a person fills in, as the field table says it (3.1): Start here, Help and the template read these. */
const FIELDS: Record<string, Field> = {
  ID: { required: 'leave-empty', format: 'Text, as exported', example: 'metric_deploys', empty: 'Found by Metric instead, or added as a new metric' },
  Metric: { required: 'required', format: `Text, 3 to ${METRIC_LIMITS.name} characters; used by one metric (any case)`, example: 'Deploy frequency', empty: 'Must fix: a new metric needs a name', also: ['name', 'metric name'] },
  Action: { required: { optional: 'none' }, format: oneOf([METRIC_ACTION_WORDS.word.retire, METRIC_ACTION_WORDS.word.back]), example: METRIC_ACTION_WORDS.word.retire, empty: 'The row adds or changes the metric' },
  Meaning: { required: { optional: 'not said yet' }, format: `Text, up to ${LONG} characters: what is counted, out of what or over what period, what is left out`, example: 'Production deploys finished, per day, averaged over the last 7 days. Rollbacks are left out.', empty: 'Not said yet', clears: true, also: ['description', 'definition'] },
  Unit: { required: 'required', format: `Text, up to ${METRIC_LIMITS.unit} characters, as it follows a number`, example: 'deploys', empty: 'Must fix: a new metric needs a unit' },
  Decimals: { required: { optional: '0' }, format: `A whole number, 0 to ${METRIC_LIMITS.decimals}`, example: '1', empty: '0 on a new metric; on one already here, it keeps its own' },
  Direction: { required: 'required', format: `${oneOf(Object.values(DIRECTION_LABEL))} (also higher, lower, up, down)`, example: DIRECTION_LABEL.higher, empty: 'Must fix: a new metric needs a direction', also: ['better'] },
  Source: { required: { optional: 'not said' }, format: `Text, up to ${LONG} characters: a dashboard, a query, a report`, example: 'DORA dashboard (Four Keys)', empty: 'Not said', clears: true },
  'Source owner': { required: { optional: 'not said' }, format: 'Text: a team or a person', example: 'Site Reliability Engineering', empty: 'Not said', clears: true },
  Refresh: { required: { optional: 'not said' }, format: oneOf(Object.values(REFRESH_LABEL)), example: REFRESH_LABEL.daily, empty: 'Not said', clears: true },
  Owner: { required: { optional: 'Owner email says who' }, oneOf: 'owner', format: 'A name only one person has', example: 'Daniel Okafor', empty: 'Owner email says who' },
  'Owner email': { required: { optional: 'whoever loads it' }, oneOf: 'owner', format: 'An email of someone in the workspace', example: 'daniel.okafor@example.com', empty: 'Whoever loads the file owns a new metric; one already here keeps its owner', also: ['owner e-mail', 'owner email address'] },
  Caveats: { required: { optional: 'none' }, format: `Text, up to ${LONG} characters`, example: 'Deploys by the release train count once per service.', empty: 'None', clears: true },
  Reason: { required: { when: 'when the row changes the meaning, source or direction of a metric goals use, and the number changes' }, format: 'Text, up to 300 characters', example: 'Commit time was unreliable for squashed merges.', empty: 'The preview asks for it where it is needed' },
};

/** The preview's count line (2.9): "2 new metrics · 3 change a metric that exists · 1 retired · 40 unchanged, left alone". */
const countLine = (c: SheetCounts) => [
  c.added && `${c.added} new ${c.added === 1 ? 'metric' : 'metrics'}`,
  c.changed && `${c.changed} change${c.changed === 1 ? 's' : ''} a metric that exists`,
  c.retired && `${c.retired} retired`,
  c.back && `${c.back} brought back`,
  c.unchanged && `${c.unchanged} unchanged, left alone`,
].filter(Boolean).join(' · ');

export const METRICS_SHEET: ModuleSheet<MetricRow> = {
  spec: {
    kind: 'metrics', name: 'Metrics', rowIs: 'metric in the library', loaded: true,
    about: 'The metric library: every number goals are measured by, defined once, and the exported goals each one measures. Add or change metrics here and load the file back; a row finds its metric by ID, else by its name.',
    columns: [
      m<MetricRow>('ID', 'The metric’s identity: leave it empty on a new metric.', (r) => r.m.id),
      ed<MetricRow>('Metric', 'Its name.', (r) => r.m.name),
      act<MetricRow>('Action', `${METRIC_ACTION_WORDS.word.retire} or ${METRIC_ACTION_WORDS.word.back}, or empty to add or change it.`, () => null),
      ed<MetricRow>('Meaning', 'What it means and how it’s calculated.', (r) => or(r.m.meaning)),
      ed<MetricRow>('Unit', 'Its unit. A file can’t change the unit of a metric goals use.', (r) => r.m.unit),
      ed<MetricRow>('Decimals', 'Places after the decimal point it’s shown with.', (r) => r.m.decimals),
      ed<MetricRow>('Direction', `${oneOf(Object.values(DIRECTION_LABEL))}.`, (r) => DIRECTION_LABEL[r.m.direction]),
      ed<MetricRow>('Source', 'Where the number comes from.', (r) => or(r.m.source)),
      ed<MetricRow>('Source owner', 'Who owns that source.', (r) => or(r.m.sourceOwner)),
      ed<MetricRow>('Refresh', `How often the source refreshes: ${oneOf(Object.values(REFRESH_LABEL))}, or empty when nobody has said.`, (r) => (r.m.refresh ? REFRESH_LABEL[r.m.refresh] : null)),
      ed<MetricRow>('Owner', 'Who answers for the definition, by name: read when Owner email is empty.', (r) => or(r.c.name(r.m.ownerId))),
      ed<MetricRow>('Owner email', 'Who answers for it, by email.', (r) => r.c.email(r.m.ownerId)),
      ed<MetricRow>('Caveats', 'What to watch out for when reading it.', (r) => or(r.m.caveats)),
      ed<MetricRow>('Reason', 'Why its meaning, source or direction changes, when goals use it and the number changes: they show it.', () => null),
      wk<MetricRow>('Still to say', '“Fully defined”, or what it still needs to say.', (r) => stillToSay(r.m, ownerName(r.c.x.snapshot.people, r.m) != null).line),
      wk<MetricRow>('Retired on', 'When it was retired; empty while it is in use.', (r) => (r.m.retiredAt ? r.m.retiredAt.slice(0, 10) : null)),
      sh<MetricRow>('Measures', 'The goals it measures, each with its slice: a team, or the whole company.', (r) => or(r.measures.map((x) => `${x.g.title} (${x.slice})`).join('; '))),
      sh<MetricRow>('Goal keys', 'Their keys.', (r) => or(r.measures.map((x) => x.g.key ?? '').filter(Boolean).join('; '))),
    ],
  },
  keys: ['ID'],
  // Every metric not removed, retired ones too (3.4), with the goals among those exported it measures (and for which slice).
  rows: (x, c, ids) => {
    const s = x.snapshot;
    return liveMetrics(s, { retired: true }).map((mt) => ({
      c, m: mt,
      measures: linksOf(s).filter((l) => l.metricId === mt.id && !l.removedAt && ids.has(l.goalId)).flatMap((l) => { const g = s.goals.find((v) => v.id === l.goalId); return g ? [{ g, slice: sliceName(s, l.teamId) }] : []; }),
    }));
  },
  also: METRIC_HEADER_ALSO,
  // A header row is the Metrics sheet when it has Metric (or Name, with Unit and Direction) and one of Unit, Direction and
  // Measures (3.1). Name alone is People's.
  is: (h) => (h.has('metric') || false) && (h.has('unit') || h.has('direction') || h.has('measures')),
  fields: FIELDS,
  example: { Metric: 'Deploy frequency', Action: METRIC_ACTION_WORDS.word.example, Meaning: 'Production deploys finished, per day, averaged over the last 7 days. Rollbacks are left out.', Unit: 'deploys', Decimals: '1', Direction: DIRECTION_LABEL.higher, Source: 'DORA dashboard (Four Keys)', 'Source owner': 'Site Reliability Engineering', Refresh: REFRESH_LABEL.daily, 'Owner email': 'daniel.okafor@example.com', Caveats: 'Deploys by the release train count once per service.' },
  reader: async () => (await import('./sheetRead')).default,
  countLine,
  toolHelp: 'Rows for the Metrics sheet (the metric library): ID or Metric (its name) to change a metric, neither ID nor a name in use to add one; Meaning, Unit, Decimals, Direction (Higher is better or Lower is better), Source, Source owner, Refresh, Owner email, Caveats; Action Retire (with a Reason) or Bring back; Reason when a change of meaning, source or direction changes the number goals show.',
};
