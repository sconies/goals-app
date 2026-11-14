/* The metric library's sheet in the workbook (domain/export, through records.ts): Metrics, after the core's sheets and
   before the README. It loads back (MI, round 2's MT6): ./sheetPlan.ts reads each row through the library's own rules,
   in the same preview, questions and Undo as any import. Retired metrics are written too, with the day they were
   retired, so an export loaded back changes nothing. */
import { cellOr, moduleColumn, oneOf, type Ctx } from '../../domain/columns';
import type { ModuleSheet } from '../../domain/records';
import type { Goal } from '../../domain/types';
import { DIRECTION_LABEL, liveMetrics, linksOf, REFRESH_LABEL, sliceName } from './rules';
import { stillToSay } from './rulesDefine';
import { isMetricsHeader, planMetricsSheet } from './sheetPlan';
import type { Metric } from './types';

/** A metric in the library, and the exported goals it measures, each with its slice. */
export interface MetricRow { c: Ctx; m: Metric; measures: { g: Goal; slice: string }[] }

const { match: m, edit: e, worked: w, shown: sh, action: act } = moduleColumn;
const or = cellOr;

export const METRICS_SHEET: ModuleSheet<MetricRow> = {
  spec: {
    kind: 'metrics', name: 'Metrics', rowIs: 'metric in the library', loaded: true,
    about: 'The metric library: every number goals are measured by, defined once, and the exported goals each one measures. Load it back to add or change many metrics at once: by ID, or by name for a new one; an empty ID adds it. Action retires one or brings it back.',
    columns: [
      m<MetricRow>('ID', 'The metric’s identity. Empty for a new metric.', (r) => r.m.id),
      e<MetricRow>('Metric', 'Its name: 3 to 120 characters, used by one metric.', (r) => r.m.name),
      act<MetricRow>('Action', 'Retire or Bring back; empty for none. Retiring needs a Reason.', () => null),
      e<MetricRow>('Meaning', 'What it means and how it’s calculated: what is counted, out of what or over what period, what is left out.', (r) => or(r.m.meaning)),
      e<MetricRow>('Unit', 'Its unit, as it follows a number (%, min, deploys). A file can’t change the unit of a metric goals use.', (r) => r.m.unit),
      e<MetricRow>('Decimals', 'Places after the decimal point it’s shown with: 0 to 4.', (r) => r.m.decimals),
      e<MetricRow>('Direction', `${oneOf(Object.values(DIRECTION_LABEL))}.`, (r) => DIRECTION_LABEL[r.m.direction]),
      e<MetricRow>('Source', 'Where the number comes from: a dashboard, a query, a report.', (r) => or(r.m.source)),
      e<MetricRow>('Source owner', 'Who owns that source: a team or a person.', (r) => or(r.m.sourceOwner)),
      e<MetricRow>('Refresh', `How often the source refreshes: ${oneOf(Object.values(REFRESH_LABEL))}, or empty when nobody has said.`, (r) => (r.m.refresh ? REFRESH_LABEL[r.m.refresh] : null)),
      e<MetricRow>('Owner', 'Who answers for the definition, by name (Owner email wins when both are given).', (r) => or(r.c.name(r.m.ownerId))),
      e<MetricRow>('Owner email', 'Who answers for it, by email; empty on a new metric: whoever loads the file.', (r) => r.c.email(r.m.ownerId)),
      e<MetricRow>('Caveats', 'What to watch out for when reading it.', (r) => or(r.m.caveats)),
      e<MetricRow>('Reason', 'Why: needed to retire it, or when a change to its meaning or direction changes the number its goals show.', () => null),
      w<MetricRow>('Still to say', 'Fully defined, or what it still needs to say.', (r) => stillToSay(r.m, !!r.c.email(r.m.ownerId)).line),
      w<MetricRow>('Retired on', 'The day it was retired; empty while it is in use.', (r) => (r.m.retiredAt ? r.m.retiredAt.slice(0, 10) : null)),
      sh<MetricRow>('Measures', 'The goals it measures, each with its slice: a team, or the whole company.', (r) => or(r.measures.map((x) => `${x.g.title} (${x.slice})`).join('; '))),
      sh<MetricRow>('Goal keys', 'Their keys.', (r) => or(r.measures.map((x) => x.g.key ?? '').filter(Boolean).join('; '))),
    ],
  },
  keys: ['ID'],
  plan: planMetricsSheet,
  has: isMetricsHeader,
  // Every metric, retired ones too (with the day), with the goals among those exported it measures (and for which slice).
  rows: (x, c, ids) => {
    const s = x.snapshot;
    return liveMetrics(s, { retired: true }).map((mt) => ({
      c, m: mt,
      measures: linksOf(s).filter((l) => l.metricId === mt.id && !l.removedAt && ids.has(l.goalId)).flatMap((l) => { const g = s.goals.find((v) => v.id === l.goalId); return g ? [{ g, slice: sliceName(s, l.teamId) }] : []; }),
    }));
  },
};
