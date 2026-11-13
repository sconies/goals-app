/* "Measured by", found by typing (ML2, docs/design/metrics/spec.md 2.4 and rule 5): what a chosen metric sets on a goal
   form, what is wrong with it as typed, and the rows the metric finder gives find-and-pick and Find (find spec, 2.3).

   Pure, as src/domain is: each takes only the rows it reads, never the whole workspace. Rule 1 (findMetrics) does the
   finding; this only words its rows. Which goals may be linked, and the unit and direction checks a save makes, are
   rules.ts's (canLinkGoal, linkProblems): the form's words below say the same thing before the goal exists. */
import type { FoundRow, Recent, SearchAnswer, SearchAsk } from '../../domain/find';
import { placesText } from '../../domain/numbers';
import type { GoalKind } from '../../domain/types';
import { decimalsWords, directionWords, findMetrics, liveLinks, ownerName, type LibraryReads } from './rulesLibrary';
import type { Metric } from './types';

/* ---------- rule 5: what a chosen metric sets on a goal form ---------- */

/** The goal form as rule 5 reads it: a new goal or not, whether its unit and decimals are still the form's own, and what they hold. */
export interface MeasureForm { isNew: boolean; untouched: boolean; unit: string; decimals: number }

/** What choosing sets: the unit and decimals, and the one line said instead of their fields; null for each when nothing is set. */
export interface MeasureDefaults { set: { unit: string; decimals: number } | null; line: string | null }

/** "min, whole numbers, lower is better: from the metric." */
export const fromTheMetric = (m: Pick<Metric, 'unit' | 'decimals' | 'direction'>) => `${m.unit}, ${decimalsWords(m.decimals)}, ${directionWords(m.direction)}: from the metric.`;

/**
 * Rule 5. A new goal whose unit and decimals nobody has typed takes the metric's, said in one line. A field the person
 * typed is kept (and the form's problems say if it differs); an existing goal is never changed by choosing.
 */
export function measureDefaults(m: Pick<Metric, 'unit' | 'decimals' | 'direction'>, f: MeasureForm): MeasureDefaults {
  if (!f.isNew || !f.untouched) return { set: null, line: null };
  return { set: { unit: m.unit, decimals: m.decimals }, line: fromTheMetric(m) };
}

/**
 * What's wrong with measuring the goal as typed by the metric: the same checks as linking (rules.ts, linkProblems), in
 * the form's words. A unit that differs stops the save; more decimals than the metric keeps is a warning. Which way the
 * target lies is judged once there are numbers, by linking.
 */
export function measureFormProblems(m: Pick<Metric, 'name' | 'unit' | 'decimals'>, f: { kind: GoalKind; unit: string; decimals: number }): { errors: string[]; warnings: string[] } {
  if (f.kind === 'milestone') return { errors: ['A goal with dated stages has no number, so a metric can’t measure it.'], warnings: [] };
  const errors: string[] = [], warnings: string[] = [];
  if (f.unit.trim().toLowerCase() !== m.unit.trim().toLowerCase()) errors.push(`This metric is in ${m.unit}; this goal is in ${f.unit.trim() || 'no unit'}.`);
  if (f.decimals > m.decimals) warnings.push(`The goal keeps ${placesText(f.decimals)} and ${m.name} ${placesText(m.decimals)}. Check which is meant.`);
  return { errors, warnings };
}

/** Check's row and the save's words: "Measured by Lead time for changes, for CI/CD." / "…, for CI/CD · release builds." */
export const measuredBySays = (m: Pick<Metric, 'name'>, slice: string | null, part = '') => `Measured by ${m.name}, for ${slice ?? 'the whole company'}${part.trim() ? ` · ${part.trim()}` : ''}.`;

/**
 * What a goal takes from its metric (MT2, spec 2.6): "min, whole numbers, lower is better." and, when the metric says
 * them, " From CI runner metrics, refreshed hourly." The goal's own start, target and dates are not the metric's.
 */
export function fromMetricWords(m: Pick<Metric, 'unit' | 'decimals' | 'direction' | 'source' | 'refresh'>): string {
  const where = m.source.trim() ? ` From ${m.source.trim()}${m.refresh ? `, refreshed ${m.refresh}` : ''}.` : '';
  return `${m.unit}, ${decimalsWords(m.decimals)}, ${directionWords(m.direction)}.${where}`;
}
/** Said under it: why the unit and direction aren't the goal's to choose while it is measured by a metric. */
export const FROM_METRIC_NOTE = 'A goal measured by a metric uses its unit and its direction. To use others, choose another metric or “No metric”.';

/* ---------- the metric finder ---------- */

/** A metric's row in find-and-pick and Find: its name, then "{unit} · {direction} · {owner}". */
export function metricRow(r: Pick<LibraryReads, 'people'>, m: Metric): FoundRow {
  return { kind: 'metric', id: m.id, name: m.name, detail: [m.unit, directionWords(m.direction), ownerName(r.people, m) ?? 'no owner'].join(' · ') };
}

/** The metrics a search finds (rule 1's words), a page at a time: `after` is where the last page ended. */
export function searchMetrics(r: LibraryReads, ask: SearchAsk): SearchAnswer {
  const size = Math.min(200, Math.max(1, ask.size ?? 50));
  const all = findMetrics(r, { q: ask.q, size: Number.MAX_SAFE_INTEGER });
  const from = Math.max(0, Number(ask.after ?? 0) || 0);
  const rows = all.rows.slice(from, from + size).map((x) => metricRow(r, x.metric));
  return { total: all.total, rows, next: from + size < all.total ? String(from + size) : null };
}

/**
 * Before anything is typed (find spec, rule 6), up to six: the metrics chosen lately, then those the viewer's team's
 * goals are measured by, then the most used.
 */
export function suggestMetrics(r: LibraryReads, recents: readonly Recent[], teamId: string | null): FoundRow[] {
  const live = r.metrics.filter((m) => !m.removedAt);
  const byId = new Map(live.map((m) => [m.id, m]));
  const out: Metric[] = [];
  const add = (m: Metric | undefined) => { if (m && !out.includes(m)) out.push(m); };
  for (const x of recents) if (x.kind === 'metric') add(byId.get(x.id));
  if (teamId) for (const m of live) if (liveLinks(r, m.id).some((l) => l.teamId === teamId)) add(m);
  for (const row of findMetrics(r, { sort: 'goals', size: 6 }).rows) add(row.metric);
  return out.slice(0, 6).map((m) => metricRow(r, m));
}

/** Rows for metrics already chosen, in the order asked; a removed one still shows (a choice already made). */
export const metricRowsByIds = (r: LibraryReads, ids: readonly string[]): FoundRow[] =>
  ids.map((id) => r.metrics.find((m) => m.id === id)).filter((m): m is Metric => !!m).map((m) => metricRow(r, m));
