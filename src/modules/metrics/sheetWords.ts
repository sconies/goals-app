/* The words the Metrics sheet's word columns take (MI; docs/design/metrics-2/spec.md 3.1), with the other ways people
   write them: written by the export (sheet.ts), read back by the reader (sheetRead.ts) through the change engine's own
   word reading (a word one letter out is asked about, one it doesn't know is Must fix). Tiny: it rides with the sheet. */
import type { Words } from '../../domain/columns';
import { DIRECTION_LABEL, REFRESH_LABEL } from './rules';
import type { MetricDirection, MetricRefresh } from './types';

export const DIRECTION_WORDS: Words<MetricDirection> = {
  what: 'Direction',
  word: DIRECTION_LABEL,
  also: { higher: ['higher', 'up', 'more is better', 'higher better'], lower: ['lower', 'down', 'less is better', 'lower better'] },
};

export const REFRESH_WORDS: Words<MetricRefresh> = {
  what: 'Refresh',
  word: REFRESH_LABEL,
  also: { live: ['real time', 'realtime'], hourly: ['every hour'], daily: ['every day', 'day'], weekly: ['every week', 'week'], monthly: ['every month', 'month'], quarterly: ['every quarter', 'quarter'] },
};

/** A row's Action: retire the metric, bring a retired one back, or (the template's) an example never loaded. */
export type MetricAction = 'retire' | 'back' | 'example';
export const METRIC_ACTION_WORDS: Words<MetricAction> = {
  what: 'Action',
  word: { retire: 'Retire', back: 'Bring back', example: 'Example' },
  also: { retire: ['retired'], back: ['bring it back', 'unretire', 'restore'] },
};

/** Other names the sheet's columns are read by (3.1, "How a row finds its metric"): lower case, to the column's own. */
export const METRIC_HEADER_ALSO: Record<string, string> = {
  name: 'metric',
  'metric name': 'metric',
  description: 'meaning',
  definition: 'meaning',
  better: 'direction',
  'owner e-mail': 'owner email',
  'owner email address': 'owner email',
};
