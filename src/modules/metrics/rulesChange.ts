/* MT3: a metric that changes tells its goals (rules 3, 4 and 5 of docs/design/metrics-2/spec.md). What kind of change a
   save is (`changeKinds`), the marks a change of meaning or direction leaves on its goals (`marksFor`), and retiring,
   bringing back and merging. Loaded with linking and saving (actions.ts), not with the first download. As pure as
   src/domain: no clock, browser or network, and each rule takes only what it reads. */
import type { ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import type { Goal } from '../../domain/types';
import { heldBy } from './rulesMeasured';
import { canEditMetric, DIRECTION_LABEL, linksOf, liveMetrics, log, metricRows, metricsOf, no, saveMetric, type Metric, type MetricInput, type MetricLink, type MetricMark } from './rules';

/** Rule 3's kinds, in the order the read-back shows them. `words` saves at once; `scale` is refused. */
export type ChangeKind = 'none' | 'scale' | 'relabel' | 'direction' | 'meaning' | 'decimals' | 'words';
/** What rule 3 reads of a goal the metric measures. */
export type LinkedGoal = Pick<Goal, 'id' | 'title'> & { unit: string; decimals: number; aimsUp: boolean | null; ownerId: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const onDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const goalsWord = (n: number) => `${n} ${n === 1 ? 'goal' : 'goals'}`;

/**
 * What kind of change a save is (rule 3): every kind that applies, in the read-back's order; ['none'] when nothing
 * differs, ['words'] when nothing a goal shows changes (or no goal is linked). A unit change on a linked metric is
 * `relabel` when the person said it is a new label (`relabel: true`), else `scale`.
 */
export function changeKinds(before: Metric, after: Metric, linked: readonly LinkedGoal[], o: { relabel?: boolean } = {}): ChangeKind[] {
  const fields = ['name', 'meaning', 'unit', 'decimals', 'direction', 'source', 'sourceOwner', 'refresh', 'ownerId', 'caveats'] as const;
  if (fields.every((f) => before[f] === after[f])) return ['none'];
  if (!linked.length) return ['words'];
  const out: ChangeKind[] = [];
  if (!same(before.unit, after.unit)) out.push(o.relabel ? 'relabel' : 'scale');
  if (before.direction !== after.direction) out.push('direction');
  if (before.meaning.trim() !== after.meaning.trim() || before.source.trim() !== after.source.trim()) out.push('meaning');
  if (after.decimals < before.decimals && linked.some((g) => g.decimals > after.decimals)) out.push('decimals');
  return out.length ? out : ['words'];
}

/** The live goals a metric measures now (links in force, the goal neither removed nor stopped), as rule 3 reads them. */
export function linkedGoals(s: Pick<ActionContext['snapshot'], 'goals'> & { modules?: ActionContext['snapshot']['modules'] }, metricId: string): LinkedGoal[] {
  const ids = new Set(linksOf(s).filter((l) => l.metricId === metricId && !l.removedAt).map((l) => l.goalId));
  return s.goals.filter((g) => ids.has(g.id) && !g.removedAt && !g.stoppedAt).map((g) => ({
    id: g.id, title: g.title, unit: g.kind === 'milestone' ? '' : g.unit, decimals: g.kind === 'milestone' ? 0 : g.decimals, ownerId: g.ownerId,
    aimsUp: g.kind === 'metric' ? (g.plan.target === g.plan.start ? null : g.plan.target > g.plan.start) : g.kind === 'range' ? (g.range.bound === 'between' ? null : g.range.bound === 'atLeast') : null,
  }));
}

/** The goals that would aim the wrong way under a direction (the read-back's "For {k} of its {n} goals…"). */
export const aimingWrong = (linked: readonly LinkedGoal[], direction: Metric['direction']) => linked.filter((g) => g.aimsUp != null && (g.aimsUp ? 'higher' : 'lower') !== direction);

export type ChangeInput = MetricInput & { id?: string; confirm?: boolean; comparable?: boolean; reason?: string; relabel?: boolean };

/**
 * Save a metric with rule 3 asked: `scale` is refused; a change of meaning or source needs `comparable` (is it still the
 * same number?) and, when it isn't, a reason; a change of direction needs a reason. A mark (rule 4) is kept on the metric
 * for each change of meaning that changes the number and for each change of direction, and each linked goal's History
 * says so. A relabel changes every linked goal's unit in the same save, so one Undo takes it all back.
 */
export function saveMetricChange(x: ActionContext, input: ChangeInput): { commit: Commit | null; metric: Metric } {
  const { comparable, reason, relabel, ...rest } = input;
  const before = rest.id ? metricsOf(x.snapshot).find((m) => m.id === rest.id && !m.removedAt) : undefined;
  if (!before) return saveMetric(x, rest);
  // The rights and the fields first, in saveMetric's own words; nothing is saved by this dry run.
  const dry = saveMetric(x, { ...rest, confirm: true });
  if (!dry.commit) return dry;
  const after = dry.metric;
  const linked = linkedGoals(x.full ?? x.snapshot, before.id);
  const kinds = changeKinds(before, after, linked, { relabel });
  const why = (reason ?? '').trim();
  const n = linked.length;
  if (kinds.includes('scale')) no(`${goalsWord(n)} ${n === 1 ? 'is' : 'are'} measured by ${before.name} in ${before.unit}. A metric in ${after.unit} is a different number: add it as a new metric and move goals to it, or retire this one. If “${after.unit}” is only a new label for the same numbers, say so (relabel).`);
  if (kinds.includes('meaning') && comparable === undefined) no('Say whether it is still the same number.');
  const marked: MetricMark['kind'][] = [...(kinds.includes('meaning') && comparable === false ? ['definition' as const] : []), ...(kinds.includes('direction') ? ['direction' as const] : [])];
  if (marked.length && !why) no(marked.includes('direction') ? 'Say why the direction changes, in a line. Every goal measured by it will show this.' : 'Say why, in a line. Every goal measured by it will show this.');
  if (why.length > 300) no('Keep the reason to 300 characters or fewer.');
  const marks: MetricMark[] = marked.map((kind) => ({ week: x.week, at: x.now, by: x.actor.id, kind, why, was: kind === 'direction' ? DIRECTION_LABEL[before.direction] : before.meaning || before.source, now: kind === 'direction' ? DIRECTION_LABEL[after.direction] : after.meaning || after.source }));
  const metric: Metric = marks.length ? { ...after, marks: [...(before.marks ?? []), ...marks] } : after;
  const goals = kinds.includes('relabel') ? (x.full ?? x.snapshot).goals.filter((g) => linked.some((l) => l.id === g.id)).map((g) => (g.kind === 'milestone' ? g : { ...g, unit: after.unit })) : [];
  const head = dry.commit.changes[0]!;
  const said = marks.length ? `${head.summary}${why ? `: ${why}` : ''}` : kinds.includes('relabel') ? `Changed the unit of “${after.name}” from “${before.unit}” to “${after.unit}” on it and its ${goalsWord(n)}` : head.summary;
  const perGoal = marks.length || goals.length ? linked.map((g) => log(x, {
    entityId: after.id, goalId: g.id, action: 'edited',
    summary: marks.some((m) => m.kind === 'definition') ? `Definition changed: what “${after.name}” means, from week ${x.week}: ${why} Weeks before ${x.week} were measured the old way.`
      : marks.length ? `Direction changed: for “${after.name}” ${DIRECTION_LABEL[after.direction].toLowerCase()}, from week ${x.week}: ${why}`
      : `Its unit changed from “${before.unit}” to “${after.unit}”, as “${after.name}” did`,
    diffs: goals.length ? [{ field: 'Unit', from: before.unit, to: after.unit }] : [],
  })) : [];
  // MS: a gap opened or closed holds its goals to no number, or to their plans again, in the same save (one Undo).
  const relabelled = new Map(goals.map((g) => [g.id, g]));
  const hold = heldBy(x, metric, (x.full ?? x.snapshot).goals.map((g) => relabelled.get(g.id) ?? g), linksOf(x.full ?? x.snapshot));
  for (const g of hold.goals) relabelled.set(g.id, g);
  const written = [...relabelled.values()];
  return { metric, commit: { ...metricRows({ metrics: [metric] }), ...(written.length ? { goals: written } : {}), changes: [{ ...head, summary: said }, ...perGoal, ...hold.changes] } };
}

/** Rule 4's reading lives with the records (rules.ts), as the goal's chart reads it on the first download. */
export { markLabel, marksFor } from './rules';

const metricOf = (x: ActionContext, id: string): Metric => {
  const m = metricsOf(x.snapshot).find((v) => v.id === id && !v.removedAt);
  if (!m) no('There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.');
  return m!;
};
const mayChange = (x: ActionContext, m: Metric) => { if (!canEditMetric(x.actor, m)) no(`Only ${x.snapshot.people.find((p) => p.id === m.ownerId)?.name ?? 'the metric’s owner'} or an admin can retire or bring back this metric.`); };

/**
 * Retire a metric (rule 5): its owner or an admin, with a reason. It leaves the pickers and the library's list; its links
 * stay, so its goals keep their numbers and say it was retired. `replacedBy` names a live metric in the same unit that
 * its goals' owners are offered.
 */
export function retireMetric(x: ActionContext, id: string, why: string, replacedBy: string | null = null): Commit {
  const m = metricOf(x, id);
  mayChange(x, m);
  if (m.retiredAt) no(`“${m.name}” is already retired.`);
  const w = why.trim();
  if (!w) no('Say why it is retired, in a line. Its goals will show this.');
  if (w.length > 300) no('Keep the reason to 300 characters or fewer.');
  const other = replacedBy ? liveMetrics(x.snapshot).find((v) => v.id === replacedBy) : null;
  if (replacedBy && (!other || other.id === m.id)) no('The metric it is replaced by must be one in use.');
  if (other && !same(other.unit, m.unit)) no(`${m.name} is in ${m.unit} and ${other.name} is in ${other.unit}. It can only be replaced by a metric in the same unit.`);
  const linked = linkedGoals(x.full ?? x.snapshot, m.id);
  const next: Metric = { ...m, retiredAt: x.now, retiredBy: x.actor.id, retiredWhy: w, replacedBy: other?.id ?? null, updatedAt: x.now };
  return {
    ...metricRows({ metrics: [next] }),
    changes: [
      log(x, { entityId: m.id, action: 'stopped', summary: `Retired the metric “${m.name}”: ${w}`, diffs: [{ field: 'Retired', from: '—', to: w }] }),
      ...linked.map((g) => log(x, { entityId: m.id, goalId: g.id, action: 'edited', summary: `Its metric “${m.name}” was retired: ${w}`, diffs: [] })),
    ],
  };
}

/** Bring a retired metric back (rule 5): the same people. It is as it was before it was retired. */
export function unretireMetric(x: ActionContext, id: string): Commit {
  const m = metricOf(x, id);
  mayChange(x, m);
  if (!m.retiredAt) no(`“${m.name}” isn’t retired.`);
  return {
    ...metricRows({ metrics: [{ ...m, retiredAt: null, retiredBy: null, retiredWhy: '', replacedBy: null, updatedAt: x.now }] }),
    changes: [log(x, { entityId: m.id, action: 'restored', summary: `Brought back the metric “${m.name}”`, diffs: [{ field: 'Retired', from: m.retiredWhy || 'Yes', to: '—' }] })],
  };
}

/**
 * Merge one metric into another (rule 5): admins only. The two must be in the same unit, and `into` in use. Every live
 * link of `from` moves to `into` (same slice and part), and `from` is retired pointing to it; all in one save.
 */
export function mergeMetrics(x: ActionContext, fromId: string, intoId: string, why = ''): Commit {
  if (!x.actor.admin) no('Only admins can merge metrics: it changes what other people’s goals are measured by.');
  const from = metricOf(x, fromId);
  const into = metricOf(x, intoId);
  if (from.id === into.id) no('Choose another metric to merge it into.');
  if (into.retiredAt) no(`“${into.name}” is retired. Bring it back first, or merge into another.`);
  if (from.retiredAt) no(`“${from.name}” is already retired.`);
  if (!same(from.unit, into.unit)) no(`${from.name} is in ${from.unit} and ${into.name} is in ${into.unit}. Only metrics in the same unit can be merged.`);
  const w = (why.trim() || `The same number as ${into.name}.`);
  if (w.length > 300) no('Keep the reason to 300 characters or fewer.');
  const moving = linksOf(x.full ?? x.snapshot).filter((l) => l.metricId === from.id && !l.removedAt);
  const moved: MetricLink[] = moving.map((l) => ({ ...l, metricId: into.id, linkedBy: x.actor.id, linkedAt: x.now }));
  return {
    ...metricRows({ metrics: [{ ...from, retiredAt: x.now, retiredBy: x.actor.id, retiredWhy: w, replacedBy: into.id, updatedAt: x.now }], metricLinks: moved }),
    changes: [
      log(x, { entityId: into.id, action: 'edited', summary: `Merged “${from.name}” into “${into.name}”, moving ${goalsWord(moved.length)}: ${w}`, diffs: [{ field: 'Merged in', from: '—', to: from.name }] }),
      log(x, { entityId: from.id, action: 'stopped', summary: `Retired the metric “${from.name}”: merged into “${into.name}”`, diffs: [{ field: 'Retired', from: '—', to: w }] }),
      ...moved.map((l) => log(x, { entityId: into.id, goalId: l.goalId, action: 'edited', summary: `Measured by “${into.name}” in place of “${from.name}”, which was merged into it`, diffs: [{ field: 'Measured by', from: from.name, to: into.name }] })),
    ],
  };
}

/** Linking a goal to a retired metric is refused, in these words (rule 5). */
export const retiredWords = (m: Pick<Metric, 'name' | 'retiredAt'>) => `“${m.name}” was retired on ${onDay(m.retiredAt!)}. Choose another, or bring it back.`;
export { onDay };
