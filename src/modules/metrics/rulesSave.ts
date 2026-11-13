/* Saving a metric through any door (the form, a goal's Measured by, save_metric): rule 1's Checks are asked before
   anything is saved, so no door can skip them (#281's build review). Loads with the first save, not the first download. */
import type { ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { checkReads } from './reads';
import { live, metricFrom, metricProblems, no, ownerOnly, saveMetric, type Metric, type MetricInput } from './rules';
import { metricChecks, unansweredChecks, unitChecks, type CheckField, type MetricCheck } from './rulesDefine';

export type SaveMetricInput = MetricInput & { id?: string; confirm?: boolean; answers?: Partial<Record<CheckField, string>> };

/**
 * The Checks the metric as typed still raises once the answers are counted, after the rights (someone who may not change
 * the metric is refused before being asked anything). A unit answered “use” takes the spelling in use.
 */
export function openChecks(x: ActionContext, input: SaveMetricInput): { input: SaveMetricInput; open: MetricCheck[] } {
  const before = input.id ? live(x, input.id) : null;
  if (before) ownerOnly(x, before, 'change');
  const answers = input.answers ?? {};
  const r = checkReads(x.snapshot);
  let next = input;
  if (answers.unit === 'use' && input.unit !== undefined) {
    const u = unitChecks(input.unit, [...new Set(r.metrics.filter((m) => m.id !== before?.id).map((m) => m.unit))]);
    if (u) next = { ...input, unit: u.use };
  }
  const typed = metricFrom(next, before, x);
  if (metricProblems(typed, x.snapshot).length) return { input: next, open: [] };
  return { input: next, open: unansweredChecks(metricChecks(typed, before, r), answers) };
}

/** Add or change a metric once every Check is answered; refused, with the questions in words, while one is open. */
export function saveMetricAsked(x: ActionContext, input: SaveMetricInput): { commit: Commit | null; metric: Metric } {
  if (input.answers?.name?.startsWith('use:')) no('Nothing saved: use that metric instead.');
  const { input: next, open } = openChecks(x, input);
  if (open.length) no(`Answer ${open.length === 1 ? 'this question' : 'these questions'} first: ${open.map((c) => c.words).join(' ')}`);
  const { answers: _, ...rest } = next;
  return saveMetric(x, rest);
}
