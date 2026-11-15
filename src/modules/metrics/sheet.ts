/* The metric library's sheet in the workbook (domain/export, through records.ts): Metrics, after the core's sheets and
   before the README. It loads back (MI, round 2's MT6): ./sheetPlan.ts reads each row through the library's own rules,
   in the same preview, questions and Undo as any import. Retired metrics are written too, with the day they were
   retired, so an export loaded back changes nothing. */
import { cellOr, moduleColumn, oneOf, type Ctx } from '../../domain/columns';
import { coreGoalsColumn } from '../../domain/sheets';
import type { ModuleSheet } from '../../domain/records';
import type { Goal } from '../../domain/types';
import { DIRECTION_LABEL, liveMetrics, linksOf, metricsOf, REFRESH_LABEL, sliceName } from './rules';
import { stillToSay } from './rulesStill';
import { CONFIDENCE_WORDS, CONFIDENCES, GAMING_MAX, LEVEL_WORDS, LEVELS } from './rulesStructure';
import { AGGREGATE_LABEL, MEASURE_LABEL, stageOf, STAGE_LABEL } from './rulesQuality';
import type { Metric, MetricAggregate, MetricCalc, MetricMeasure, MetricWindow } from './types';

const MEASURES = Object.keys(MEASURE_LABEL) as MetricMeasure[];
const AGGREGATES = Object.keys(AGGREGATE_LABEL) as MetricAggregate[];

/** How aggregated, as the sheet writes it and reads it back: "p90", "mean per day", "median". */
export function aggregateCell(c: MetricCalc | null | undefined): string | null {
  if (!c?.aggregate || c.measure === 'ratio' || c.measure === 'other') return null;
  if (c.aggregate === 'percentile') return c.percentile ? `p${c.percentile}` : 'percentile';
  return c.aggregate === 'mean' && c.per ? `mean per ${c.per}` : AGGREGATE_LABEL[c.aggregate];
}

/** The window as the sheet writes it, in words windowFrom reads back (a cumulative window by its ISO day). */
export function windowCell(w: MetricWindow | null | undefined): string | null {
  if (!w) return null;
  if (w.kind === 'point') return 'Point in time';
  if (w.kind === 'rolling') return `Rolling ${w.days} days`;
  if (w.kind === 'period') return `Per ${w.period}`;
  return `Cumulative since ${w.since}`;
}

/** A metric in the library, and the exported goals it measures, each with its slice. */
export interface MetricRow { c: Ctx; m: Metric; measures: { g: Goal; slice: string }[]; parent: string | null; /** The export's moment, for the stage. */ now: string }

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
      // MQ2 (rulesQuality.ts): the calculation in two fields and its parts, the window and the source link.
      e<MetricRow>('What is measured', `${oneOf(MEASURES.map((k) => MEASURE_LABEL[k]))}; empty when not said.`, (r) => (r.m.calculation?.measure ? MEASURE_LABEL[r.m.calculation.measure] ?? null : null)),
      e<MetricRow>('How aggregated', `Over the window: ${oneOf(AGGREGATES.filter((k) => k !== 'percentile').map((k) => AGGREGATE_LABEL[k]))}, or p50, p90, p95…; “mean per day” for a mean of a count. Not for a ratio or other.`, (r) => aggregateCell(r.m.calculation)),
      e<MetricRow>('Counts', 'What it counts (not a ratio).', (r) => or(r.m.calculation?.part?.counts)),
      e<MetricRow>('Filters', 'Which of those it counts.', (r) => or(r.m.calculation?.part?.filters)),
      e<MetricRow>('Leaves out', 'What it leaves out.', (r) => or(r.m.calculation?.part?.excludes)),
      e<MetricRow>('Numerator', 'A ratio’s top: what it counts.', (r) => or(r.m.calculation?.numerator?.counts)),
      e<MetricRow>('Numerator filters', 'Which of those.', (r) => or(r.m.calculation?.numerator?.filters)),
      e<MetricRow>('Numerator leaves out', 'What it leaves out.', (r) => or(r.m.calculation?.numerator?.excludes)),
      e<MetricRow>('Denominator', 'A ratio’s bottom: what it counts.', (r) => or(r.m.calculation?.denominator?.counts)),
      e<MetricRow>('Denominator filters', 'Which of those.', (r) => or(r.m.calculation?.denominator?.filters)),
      e<MetricRow>('Denominator leaves out', 'What it leaves out.', (r) => or(r.m.calculation?.denominator?.excludes)),
      e<MetricRow>('Formula', 'For other or composite: the formula in words.', (r) => or(r.m.calculation?.formula)),
      e<MetricRow>('Window', 'What each figure covers: Point in time, Rolling 28 days, Per week, Per month, Per quarter, or Cumulative since 2026-01-01.', (r) => windowCell(r.m.timeWindow)),
      e<MetricRow>('Source', 'Where the number comes from: a dashboard, a query, a report.', (r) => or(r.m.source)),
      e<MetricRow>('Source link', 'A link to the report or query that gives the figure (https://…).', (r) => or(r.m.sourceLink)),
      e<MetricRow>('Source owner', 'Who owns that source: a team or a person.', (r) => or(r.m.sourceOwner)),
      e<MetricRow>('Refresh', `How often the source refreshes: ${oneOf(Object.values(REFRESH_LABEL))}, or empty when nobody has said.`, (r) => (r.m.refresh ? REFRESH_LABEL[r.m.refresh] : null)),
      e<MetricRow>('Owner', 'Who answers for the definition, by name (Owner email wins when both are given).', (r) => or(r.c.name(r.m.ownerId))),
      e<MetricRow>('Owner email', 'Who answers for it, by email; empty on a new metric: whoever loads the file.', (r) => r.c.email(r.m.ownerId)),
      e<MetricRow>('Caveats', 'What to watch out for when reading it.', (r) => or(r.m.caveats)),
      // MQ (rulesStructure.ts): where it sits, how far to trust it and how it could be gamed.
      e<MetricRow>('Part of', 'The metric it sits under, by name or ID: a metric in the library or on an earlier row. Empty for none.', (r) => r.parent),
      e<MetricRow>('How it relates', `How it relates to the metric it is part of: ${oneOf(LEVELS.map((k) => LEVEL_WORDS[k].label))}. Needs Part of; empty when not said.`, (r) => (r.m.level ? LEVEL_WORDS[r.m.level].label : null)),
      e<MetricRow>('Confidence', `How far its number can be trusted: ${oneOf(CONFIDENCES.map((k) => CONFIDENCE_WORDS[k].label))}; empty when not said.`, (r) => (r.m.confidence ? CONFIDENCE_WORDS[r.m.confidence].label : null)),
      e<MetricRow>('How it could be gamed', `In words, up to ${GAMING_MAX} characters; empty when not said.`, (r) => or(r.m.gaming)),
      e<MetricRow>('Reason', 'Why: needed to retire it, or when a change to its meaning or direction changes the number its goals show.', () => null),
      w<MetricRow>('Still to say', 'Fully defined, or what it still needs to say.', (r) => stillToSay(r.m, !!r.c.email(r.m.ownerId)).line),
      w<MetricRow>('Stage', 'Draft, Defined or Verified, worked out from what it says and who verified it.', (r) => STAGE_LABEL[stageOf(r.m, { now: r.now, ownerIsHere: !!r.c.email(r.m.ownerId) }).stage]),
      w<MetricRow>('Retired on', 'The day it was retired; empty while it is in use.', (r) => (r.m.retiredAt ? r.m.retiredAt.slice(0, 10) : null)),
      sh<MetricRow>('Measures', 'The goals it measures, each with its slice: a team, or the whole company.', (r) => or(r.measures.map((x) => `${x.g.title} (${x.slice})`).join('; '))),
      sh<MetricRow>('Goal keys', 'Their keys.', (r) => or(r.measures.map((x) => x.g.key ?? '').filter(Boolean).join('; '))),
    ],
  },
  keys: ['ID'],
  loadPlan: () => import('./sheetPlan').then((m) => m.planMetricsSheet),
  has: isMetricsHeader,
  // Every metric, retired ones too (with the day), with the goals among those exported it measures (and for which slice).
  rows: (x, c, ids) => {
    const s = x.snapshot;
    return liveMetrics(s, { retired: true }).map((mt) => ({
      c, m: mt, now: x.today.toISOString(),
      parent: mt.parentId ? (metricsOf(s).find((v) => v.id === mt.parentId)?.name ?? null) : null,
      measures: linksOf(s).filter((l) => l.metricId === mt.id && !l.removedAt && ids.has(l.goalId)).flatMap((l) => { const g = s.goals.find((v) => v.id === l.goalId); return g ? [{ g, slice: sliceName(s, l.teamId) }] : []; }),
    }));
  },
};

/** A header row made by hand that is the Metrics sheet (3.1): Metric (or Name with Unit and Direction), and Unit,
    Direction or Measures; never one with a column the Goals sheet reads as Goal or Key (its own name or another the
    field table gives it: Title, Goal name, Objective…), which is a Goals sheet. */
export function isMetricsHeader(h: ReadonlySet<string>): boolean {
  // A Goals sheet made by hand may have a Metric column too: one with a Goal or Key column, under any name the core's
  // header reading gives them, is goals (#520 and #534 reviews).
  for (const x of h) { const c = coreGoalsColumn(x); if (c === 'Goal' || c === 'Key') return false; }
  return (h.has('metric') && (h.has('unit') || h.has('direction') || h.has('measures'))) || (h.has('name') && h.has('unit') && h.has('direction'));
}
