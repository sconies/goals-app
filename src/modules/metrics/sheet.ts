/* The metric library's sheet in the workbook (domain/export, through records.ts): Metrics, after the core's sheets and
   before the README. For reading: metrics are added and changed in the app, so loading it back reads nothing. */
import { cellOr, moduleColumn, oneOf, type Ctx } from '../../domain/columns';
import type { ModuleSheet } from '../../domain/records';
import type { Goal } from '../../domain/types';
import { DIRECTION_LABEL, liveMetrics, linksOf, REFRESH_LABEL, sliceName } from './rules';
import type { Metric } from './types';

/** A metric in the library, and the exported goals it measures, each with its slice. */
export interface MetricRow { c: Ctx; m: Metric; measures: { g: Goal; slice: string }[] }

const { match: m, shown: sh } = moduleColumn;
const or = cellOr;

export const METRICS_SHEET: ModuleSheet<MetricRow> = {
  spec: {
    kind: 'metrics', name: 'Metrics', rowIs: 'metric in the library', loaded: false,
    about: 'The metric library: every number goals are measured by, defined once, and the exported goals each one measures. Metrics are added and changed in the app.',
    columns: [
      m<MetricRow>('ID', 'The metric’s identity.', (r) => r.m.id),
      sh<MetricRow>('Metric', 'Its name.', (r) => r.m.name),
      sh<MetricRow>('Meaning', 'What it means and how it’s calculated.', (r) => or(r.m.meaning)),
      sh<MetricRow>('Unit', 'Its unit.', (r) => r.m.unit),
      sh<MetricRow>('Decimals', 'Places after the decimal point it’s shown with.', (r) => r.m.decimals),
      sh<MetricRow>('Direction', `${oneOf(Object.values(DIRECTION_LABEL))}.`, (r) => DIRECTION_LABEL[r.m.direction]),
      sh<MetricRow>('Source', 'Where the number comes from.', (r) => or(r.m.source)),
      sh<MetricRow>('Source owner', 'Who owns that source.', (r) => or(r.m.sourceOwner)),
      sh<MetricRow>('Refresh', `How often the source refreshes: ${oneOf(Object.values(REFRESH_LABEL))}, or empty when nobody has said.`, (r) => (r.m.refresh ? REFRESH_LABEL[r.m.refresh] : null)),
      sh<MetricRow>('Owner', 'Who answers for the definition.', (r) => or(r.c.name(r.m.ownerId))),
      sh<MetricRow>('Owner email', 'Who answers for it, by email.', (r) => r.c.email(r.m.ownerId)),
      sh<MetricRow>('Caveats', 'What to watch out for when reading it.', (r) => or(r.m.caveats)),
      sh<MetricRow>('Measures', 'The goals it measures, each with its slice: a team, or the whole company.', (r) => or(r.measures.map((x) => `${x.g.title} (${x.slice})`).join('; '))),
      sh<MetricRow>('Goal keys', 'Their keys.', (r) => or(r.measures.map((x) => x.g.key ?? '').filter(Boolean).join('; '))),
    ],
  },
  keys: ['ID'],
  // Every metric in use, with the goals among those exported it measures (and for which slice).
  rows: (x, c, ids) => {
    const s = x.snapshot;
    return liveMetrics(s).map((mt) => ({
      c, m: mt,
      measures: linksOf(s).filter((l) => l.metricId === mt.id && !l.removedAt && ids.has(l.goalId)).flatMap((l) => { const g = s.goals.find((v) => v.id === l.goalId); return g ? [{ g, slice: sliceName(s, l.teamId) }] : []; }),
    }));
  },
};
