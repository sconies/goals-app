/* MQ2's words that load with the library's records (the Metrics sheet's columns, a goal's rhythm on link and save), kept
   apart from rulesQuality.ts so the first download doesn't carry the quality rules (qualityHooks.ts installs those). */
import type { GoalRhythm } from '../../domain/goalRhythm';
import type { MetricAggregate, MetricMeasure, MetricRefresh } from './types';

export const MEASURES: readonly MetricMeasure[] = ['count', 'sum', 'value', 'duration', 'ratio', 'other'];
export const MEASURE_LABEL: Record<MetricMeasure, string> = { count: 'Count', sum: 'Sum', value: 'Value', duration: 'Duration', ratio: 'Ratio', other: 'Other or composite' };
export const AGGREGATES: readonly MetricAggregate[] = ['total', 'mean', 'median', 'percentile', 'latest'];
export const AGGREGATE_LABEL: Record<MetricAggregate, string> = { total: 'total', mean: 'mean', median: 'median', percentile: 'percentile', latest: 'latest' };

/** A goal measured by a metric refreshed monthly is due monthly, quarterly quarterly; anything faster keeps the cycle's
    rhythm (null). */
export const rhythmFor = (refresh: MetricRefresh | null | undefined): GoalRhythm | null => (refresh === 'monthly' || refresh === 'quarterly' ? refresh : null);
