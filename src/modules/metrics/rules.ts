/* The metric library (backlog 0b): every number a goal is measured by, defined once. A metric says what the number
   means and how it's worked out, its unit, which way is better, where it comes from and who owns that source, how often
   it refreshes, who answers for the definition, and what to watch out for. A goal links to one metric for one slice: a
   team's number, or the whole company's. The goal's own target is the target in that metric.

   These are the only rules for it: what a metric needs, who may add, change, remove, link and unlink, and what the
   change log says. The app, the AI assistants' MCP server (src/modules/metrics/tools.ts) and the demo data all call
   these. Removing a metric is never final: it keeps its row (removedAt), unlinks the goals it measured, and comes back
   with Undo or from Recently removed (domain/removal, through records.ts).

   The module's rules (AS part 2): as pure as src/domain, and the layers lint holds them to it. They import only
   src/domain and this folder, read no clock, browser or network, and take only what they read. The records live in the
   workspace under `modules.metrics` (domain/records); `metricsOf` and `linksOf` read them. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { diffFields } from '../../domain/changes';
import type { Commit } from '../../domain/commit';
import { fmt } from '../../domain/format';
import { placesText } from '../../domain/numbers';
import { mergeModuleRows, moduleRows, withModuleRows, type ModuleRows } from '../../domain/records';
import type { Change, Goal, Person, Team } from '../../domain/types';
import type { Metric, MetricDirection, MetricLink, MetricRefresh } from './types';

export type { Metric, MetricDirection, MetricLink, MetricMark, MetricRefresh } from './types';

/** The module's id, and the keys its records are filed under (records.ts). */
export const MODULE = 'metrics';
export const METRICS_KEY = 'metrics';
export const LINKS_KEY = 'metricLinks';

/** What the rules read of a workspace: the feature modules' rows. */
type Rows = { modules?: ModuleRows };
/** Every metric in a workspace (or a commit), removed ones included. */
export const metricsOf = (s: Rows | null | undefined): Metric[] => moduleRows<Metric>(s, MODULE, METRICS_KEY);
/** Every goal's link to a metric in a workspace (or a commit), unlinked ones included. */
export const linksOf = (s: Rows | null | undefined): MetricLink[] => moduleRows<MetricLink>(s, MODULE, LINKS_KEY);
/** A commit's part for metrics and links: `{ modules: { metrics: { … } } }`. */
export const metricRows = (rows: { metrics?: Metric[]; metricLinks?: MetricLink[] }): Pick<Commit, 'modules'> => withModuleRows(MODULE, { [METRICS_KEY]: rows.metrics, [LINKS_KEY]: rows.metricLinks });

export const no = (msg: string): never => { throw new NotAllowed(msg); };

/* ---------- words ---------- */

export const DIRECTION_LABEL: Record<MetricDirection, string> = { higher: 'Higher is better', lower: 'Lower is better' };
export const REFRESHES: readonly MetricRefresh[] = ['live', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly'];
export const REFRESH_LABEL: Record<MetricRefresh, string> = { live: 'Live', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };
/** How a slice reads: a team's name, or the whole company. */
export const COMPANY = 'The whole company';

/** A metric's owner's name; null when it has none or they have left. */
export const ownerName = (people: readonly Pick<Person, 'id' | 'name' | 'leftAt'>[], m: Pick<Metric, 'ownerId'>) => { const p = people.find((x) => x.id === m.ownerId); return p && !p.leftAt ? p.name : null; };
/** Live metrics with no owner, or an owner who has left: Workspace → About's "{n} metrics have no owner", for admins (spec 2.8). */
export const ownerlessMetrics = (r: { metrics: readonly Metric[]; people: readonly Pick<Person, 'id' | 'name' | 'leftAt'>[] }): Metric[] => r.metrics.filter((m) => !m.removedAt && !ownerName(r.people, m));

/** The limits a metric's fields keep to: what the form, the tools and the database all check. */
export const METRIC_LIMITS = { name: 120, unit: 20, text: 2000, decimals: 4 } as const;
/** The fields a metric must have, and the ones it may leave empty. */
export const REQUIRED_FIELDS = ['name', 'unit', 'direction'] as const;
export const OPTIONAL_FIELDS = ['meaning', 'decimals', 'source', 'sourceOwner', 'refresh', 'ownerId', 'caveats'] as const;

/** What someone gives to add or change a metric: everything but the bookkeeping. Left out, a field keeps its value
    (a new metric: empty text, 0 decimals, no refresh, owned by whoever adds it). */
export type MetricInput = Partial<Pick<Metric, 'name' | 'meaning' | 'unit' | 'decimals' | 'direction' | 'source' | 'sourceOwner' | 'refresh' | 'ownerId' | 'caveats'>>;

/* ---------- reading ---------- */

/** The metrics in use: not removed, by name. A retired one (MT3) is left out of pickers and lists unless asked for. */
export const liveMetrics = (s: Rows, o: { retired?: boolean } = {}): Metric[] => metricsOf(s).filter((m) => !m.removedAt && (o.retired || !m.retiredAt)).sort((a, b) => a.name.localeCompare(b.name));
/** The marks a goal shows (MT3 rule 4): its metric's marks made at or after the goal was linked to it, and since `since`
    (the cycle's start), oldest first. A goal linked after a change was never measured the old way. */
export function marksFor(metric: Pick<Metric, 'marks'>, link: Pick<MetricLink, 'linkedAt'>, since?: string): NonNullable<Metric['marks']> {
  return (metric.marks ?? []).filter((m) => m.at >= link.linkedAt && (!since || m.at >= since));
}
/** A chart's label for a mark (spec 2.7). */
export const markLabel = (m: { kind: 'definition' | 'direction'; week: number }) => `${m.kind === 'direction' ? 'Direction' : 'Definition'} changed, week ${m.week}`;
/** Whether any goal has ever been measured by a metric, in force or not (rule 5): such a metric is retired, not deleted. */
export const everUsed = (metricId: string, links: readonly Pick<MetricLink, 'metricId'>[]) => links.some((l) => l.metricId === metricId);
/** A live metric by id, or by name (any case). */
export function findMetric(s: Rows, ref: string): Metric | undefined {
  const t = ref.trim().toLowerCase();
  const live = liveMetrics(s, { retired: true });
  return live.find((m) => m.id === ref) ?? live.find((m) => m.name.trim().toLowerCase() === t);
}
/** A goal's link to a metric, if it has one that's in force (the metric not removed either). */
export function linkOf(s: Rows, goalId: string): MetricLink | undefined {
  const l = linksOf(s).find((v) => v.goalId === goalId && !v.removedAt);
  return l && liveMetrics(s, { retired: true }).some((m) => m.id === l.metricId) ? l : undefined;
}
/** The goals a metric measures now: links in force, to the goals given (the cycle's, say). */
export function goalsMeasuredBy(s: Rows, goals: readonly Goal[], metricId: string): Goal[] {
  const ids = new Set(linksOf(s).filter((l) => l.metricId === metricId && !l.removedAt).map((l) => l.goalId));
  return goals.filter((g) => ids.has(g.id));
}

/** A goal's target in its metric: a metric goal's plan target, or a range goal's limit (between two numbers: the upper,
    with the lower beside it). Milestones have none. */
export function goalTarget(g: Goal): { value: number; kind: 'target' | 'at most' | 'at least' | 'between'; lower?: number } | null {
  if (g.kind === 'metric') return g.targetUnset ? null : { value: g.plan.target, kind: 'target' };
  if (g.kind === 'range') return g.range.bound === 'between' ? { value: g.range.limit, kind: 'between', lower: g.range.lower! } : { value: g.range.limit, kind: g.range.bound === 'atMost' ? 'at most' : 'at least' };
  return null;
}

/** What a goal is measured by, ready to show: the metric, the slice in words, and the goal's target in it, as a number
    and as every screen writes it (domain/numbers: at the goal's decimals, digits grouped, with its unit: "At most 2.0%"). */
export interface Measure { link: MetricLink; metric: Metric; slice: string; part: string; target: ReturnType<typeof goalTarget>; targetText: string | null; retired: { at: string; by: string | null; why: string; replacedBy: string | null } | null }
export function measureOf(s: Rows & { teams: Team[] }, goal: Goal): Measure | null {
  const link = linkOf(s, goal.id);
  if (!link) return null;
  const metric = liveMetrics(s, { retired: true }).find((m) => m.id === link.metricId)!;
  const target = goalTarget(goal);
  const targetText = target && goal.kind !== 'milestone' ? `${target.kind === 'target' ? 'Target' : target.kind === 'at most' ? 'At most' : target.kind === 'at least' ? 'At least' : `Between ${fmt(target.lower!, goal)} and`} ${fmt(target.value, goal)}` : null;
  return { link, metric, slice: sliceName(s, link.teamId), part: (link.part ?? '').trim(), target, targetText, retired: metric.retiredAt ? { at: metric.retiredAt, by: metric.retiredBy ?? null, why: metric.retiredWhy ?? '', replacedBy: metric.replacedBy ?? null } : null };
}
/** A slice in words: the team's name (or "a removed team"), or the whole company. */
export const sliceName = (s: { teams: Team[] }, teamId: string | null) => (teamId == null ? COMPANY : s.teams.find((t) => t.id === teamId)?.name ?? 'A removed team');

/* ---------- what a metric needs ---------- */

const clean = (v: string | undefined | null) => (v ?? '').trim().replace(/[ \t]+/g, ' ');

/** The metric as it would be saved: text trimmed, defaults filled in. Throws nothing; metricProblems says what's wrong. */
export function metricFrom(input: MetricInput, before: Metric | null, x: Pick<ActionContext, 'actor' | 'now' | 'newId'>): Metric {
  const pick = <K extends keyof MetricInput>(k: K, fallback: NonNullable<Metric[K]> | null) => (input[k] !== undefined ? input[k] : before ? before[k as keyof Metric] : fallback) as Metric[K];
  return {
    id: before?.id ?? x.newId('metric'),
    name: clean(pick('name', '')),
    meaning: (pick('meaning', '') ?? '').trim(),
    unit: clean(pick('unit', '')),
    decimals: pick('decimals', 0) ?? 0,
    direction: pick('direction', null as never),
    source: clean(pick('source', '')),
    sourceOwner: clean(pick('sourceOwner', '')),
    refresh: pick('refresh', null) ?? null,
    ownerId: pick('ownerId', x.actor.id) || x.actor.id,
    caveats: (pick('caveats', '') ?? '').trim(),
    createdBy: before?.createdBy ?? x.actor.id,
    createdAt: before?.createdAt ?? x.now,
    updatedAt: x.now,
    ...(before?.removedAt ? { removedAt: before.removedAt, removedBy: before.removedBy ?? null } : {}),
    ...(before?.retiredAt !== undefined ? { retiredAt: before.retiredAt, retiredBy: before.retiredBy ?? null, retiredWhy: before.retiredWhy ?? '', replacedBy: before.replacedBy ?? null } : {}),
    ...(before?.marks ? { marks: before.marks } : {}),
  };
}

/**
 * What's wrong with a metric, in words someone can act on; empty when it can be saved. Required: a name (3 to 120
 * characters, not one another metric here uses, accents and case aside), a unit (up to 20 characters) and a direction (higher or lower is
 * better). Optional: the meaning, decimals (0 to 4), source and its owner, refresh (one of REFRESHES), owner (someone in
 * the workspace) and caveats, each text up to 2,000 characters.
 */
export function metricProblems(m: Metric, s: Rows & { people: Person[] }): string[] {
  const out: string[] = [];
  if (!m.name) out.push('Give the metric a name.');
  else if (m.name.length < 3) out.push('Give the metric a name of at least three characters.');
  else if (m.name.length > METRIC_LIMITS.name) out.push(`Keep the name to ${METRIC_LIMITS.name} characters or fewer.`);
  else {
    const same = liveMetrics(s, { retired: true }).find((v) => v.id !== m.id && !v.name.localeCompare(m.name, 'en', { sensitivity: 'base' }));
    if (same) out.push(`There’s already a metric called ${same.name}. Use it, or give this one a different name.`);
  }
  if (!m.unit) out.push('Say its unit: %, min, hours, USD, deploys…');
  else if (m.unit.length > METRIC_LIMITS.unit) out.push(`Keep the unit to ${METRIC_LIMITS.unit} characters or fewer.`);
  if (m.direction !== 'higher' && m.direction !== 'lower') out.push('Say which way is better: higher or lower.');
  if (!Number.isInteger(m.decimals) || m.decimals < 0 || m.decimals > METRIC_LIMITS.decimals) out.push(`Decimals is a whole number from 0 to ${METRIC_LIMITS.decimals}.`);
  if (m.refresh != null && !REFRESHES.includes(m.refresh)) out.push(`Refresh is one of ${REFRESHES.join(', ')}, or left empty.`);
  if (!s.people.some((p) => p.id === m.ownerId)) out.push('The metric’s owner isn’t in this workspace.');
  for (const [k, label] of [['meaning', 'meaning'], ['source', 'source'], ['sourceOwner', 'source’s owner'], ['caveats', 'caveats']] as const) {
    if (m[k].length > METRIC_LIMITS.text) out.push(`Keep the ${label} to ${METRIC_LIMITS.text.toLocaleString('en-GB')} characters or fewer.`);
  }
  return out;
}

/* ---------- the change log ---------- */

/** A metric's fields as the change log reads them. */
export function metricFields(m: Metric, s: { people: Person[] }): Record<string, string> {
  return {
    Name: m.name,
    Meaning: m.meaning || '—',
    Unit: m.unit || '—',
    Decimals: String(m.decimals),
    Direction: DIRECTION_LABEL[m.direction] ?? '—',
    Source: m.source || '—',
    'Source owner': m.sourceOwner || '—',
    Refresh: m.refresh ? REFRESH_LABEL[m.refresh] : '—',
    Owner: s.people.find((p) => p.id === m.ownerId)?.name ?? '—',
    Caveats: m.caveats || '—',
  };
}

export const log = (x: ActionContext, v: Pick<Change, 'entityId' | 'action' | 'summary'> & Partial<Change>): Change => ({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'metric', diffs: [], ...v });
export const live = (x: ActionContext, id: string) => {
  const m = metricsOf(x.snapshot).find((v) => v.id === id);
  if (!m || m.removedAt) no('There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.');
  return m!;
};
const ownsOrAdmin = (x: ActionContext, m: Metric) => x.actor.admin || m.ownerId === x.actor.id;
/** Who may change or remove a metric: its owner, or an admin. Anyone may add one. */
export const canEditMetric = (actor: ActionContext['actor'], m: Metric) => actor.admin || m.ownerId === actor.id;
/** Who may link a goal to a metric, or unlink it: the goal's owner, or an admin (whoever owns the metric). */
export const canLinkGoal = (actor: ActionContext['actor'], g: Goal) => actor.admin || g.ownerId === actor.id;

/* ---------- the actions ---------- */

/**
 * Changing the unit or which way is better of a metric that live goals use is asked first, at every door (the form's
 * confirm, save_metric's confirm): their numbers and plans don't change, and those that now differ show a warning
 * (linkProblems). Null when nothing needs asking.
 */
export function metricChangeQuestion(before: Metric, next: Metric, goals: readonly Goal[], links: readonly MetricLink[]): { changing: ('unit' | 'direction')[]; goals: number; apart: number; text: string } | null {
  const linked = links.filter((l) => l.metricId === before.id && !l.removedAt).map((l) => goals.find((g) => g.id === l.goalId)).filter((g): g is Goal => !!g && !g.removedAt && !g.stoppedAt);
  const changing = linked.length ? [...(next.unit.trim().toLowerCase() !== before.unit.trim().toLowerCase() ? ['unit' as const] : []), ...(next.direction !== before.direction ? ['direction' as const] : [])] : [];
  if (!changing.length) return null;
  const apart = linked.filter((g) => { const p = linkProblems(g, next); return p.errors.length + p.warnings.length > 0; }).length;
  const n = linked.length;
  return { changing, goals: n, apart, text: `${n} ${n === 1 ? 'goal is' : 'goals are'} measured by this metric. Changing its ${changing.join(' and ')} doesn’t change their numbers or plans; ${apart} of them will show a warning that they differ. Change it?` };
}

/**
 * Add a metric (anyone; they own it unless they name someone else), or change one (its owner or an admin). `id` names
 * the metric to change; left out, it's a new one. Returns the commit and the metric as saved; the commit is null when
 * nothing changed.
 */
export function saveMetric(x: ActionContext, input: MetricInput & { id?: string; confirm?: boolean }): { commit: Commit | null; metric: Metric } {
  const before = input.id ? live(x, input.id) : null;
  if (before && !ownsOrAdmin(x, before)) no(`Only ${x.snapshot.people.find((p) => p.id === before.ownerId)?.name ?? 'the metric’s owner'} or an admin can change this metric.`);
  if (before?.retiredAt) no(`“${before.name}” is retired. Bring it back before changing it.`);
  const m = metricFrom(input, before, x);
  const problems = metricProblems(m, x.snapshot);
  if (problems.length) no(problems.join(' '));
  const ask = before ? metricChangeQuestion(before, m, (x.full ?? x.snapshot).goals, linksOf(x.full ?? x.snapshot)) : null;
  if (ask && !input.confirm) no(ask.text.replace(/ Change it\?$/, ' Ask first, then save it again with confirm.'));
  const diffs = diffFields(before ? metricFields(before, x.snapshot) : null, metricFields(m, x.snapshot));
  if (before && !diffs.length) return { commit: null, metric: before };
  const summary = before ? (before.name !== m.name ? `Renamed the metric “${before.name}” to “${m.name}”` : `Changed the metric “${m.name}”`) : `Added the metric “${m.name}”`;
  return { metric: m, commit: { ...metricRows({ metrics: [m] }), changes: [log(x, { entityId: m.id, action: before ? 'edited' : 'created', summary, diffs })] } };
}

/**
 * Delete (remove) a metric no goal has ever been measured by: its owner or an admin. One that has is retired instead
 * (rule 5, rulesChange.ts). It keeps its row and comes back with Undo or from Recently removed.
 */
export function removeMetric(x: ActionContext, id: string): Commit {
  const m = live(x, id);
  if (!ownsOrAdmin(x, m)) no(`Only ${x.snapshot.people.find((p) => p.id === m.ownerId)?.name ?? 'the metric’s owner'} or an admin can remove this metric.`);
  // Rule 5: a metric that has measured a goal keeps its history; it is retired, not deleted.
  if (everUsed(m.id, linksOf(x.full ?? x.snapshot))) no(`${m.name} has measured goals, so it can’t be deleted. Retire it instead.`);
  const links = linksOf(x.full ?? x.snapshot).filter((l) => l.metricId === id && !l.removedAt);
  const n = links.length;
  return {
    ...metricRows({ metrics: [{ ...m, removedAt: x.now, removedBy: x.actor.id, updatedAt: x.now }], metricLinks: links.map((l) => ({ ...l, removedAt: x.now, removedBy: x.actor.id })) }),
    changes: [
      log(x, { entityId: m.id, action: 'removed', summary: `Removed the metric “${m.name}”${n ? `, unlinking ${n} ${n === 1 ? 'goal' : 'goals'}` : ''}`, diffs: [{ field: 'Metric', from: m.name, to: '—' }] }),
      ...links.map((l) => log(x, { entityId: m.id, goalId: l.goalId, action: 'edited', summary: `No longer measured by “${m.name}”, as the metric was removed`, diffs: [{ field: 'Measured by', from: m.name, to: '—' }] })),
    ],
  };
}

/**
 * What's wrong with measuring a goal by a metric: errors stop the link, warnings are said but allowed. A milestone goal
 * has stages, not a number, so it can't be measured by one. The goal's unit must be the metric's (a goal in hours
 * measured by a metric in minutes would read wrong). A goal whose plan moves the other way from the metric's better
 * direction (a lower-is-better metric planned to go up) is a warning: it may be a guardrail's allowance, or a mistake.
 */
export function linkProblems(goal: Goal, m: Metric): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (goal.kind === 'milestone') errors.push('A goal with dated stages has no number, so a metric can’t measure it.');
  else {
    if (goal.unit.trim().toLowerCase() !== m.unit.trim().toLowerCase()) errors.push(`The goal is in ${goal.unit || 'no unit'} and the metric is in ${m.unit}. Use the same unit for both.`);
    const up = goal.kind === 'metric' ? goal.plan.target > goal.plan.start : goal.range.bound === 'atLeast';
    // A range between two numbers aims neither way, as a flat plan doesn't.
    const flat = goal.kind === 'metric' ? goal.plan.target === goal.plan.start : goal.range.bound === 'between';
    // One number, two precisions would read differently on the goal and in the library (domain/numbers).
    if (goal.decimals > m.decimals) warnings.push(`The goal keeps ${placesText(goal.decimals)} and ${m.name} ${placesText(m.decimals)}. Check which is meant.`);
    if (!flat && (up ? 'higher' : 'lower') !== m.direction) warnings.push(`The goal aims ${up ? 'up' : 'down'}, but for ${m.name} ${DIRECTION_LABEL[m.direction].toLowerCase()}. Check it’s meant.`);
  }
  return { errors, warnings };
}

/** Stop measuring a goal by its metric: the goal's owner or an admin. Kept, so it can be undone. Null when it has none. */
export function unlinkGoalMetric(x: ActionContext, goal: Goal): Commit | null {
  if (!canLinkGoal(x.actor, goal)) no('Only the goal’s owner or an admin can choose what measures it.');
  const l = linksOf(x.snapshot).find((v) => v.goalId === goal.id && !v.removedAt);
  if (!l) return null;
  const name = metricsOf(x.full ?? x.snapshot).find((v) => v.id === l.metricId)?.name ?? 'its metric';
  return { ...metricRows({ metricLinks: [{ ...l, removedAt: x.now, removedBy: x.actor.id }] }), changes: [log(x, { entityId: l.metricId, goalId: goal.id, action: 'removed', summary: `No longer measured by “${name}”`, diffs: [{ field: 'Measured by', from: name, to: '—' }] })] };
}

/** Two saves as one (a new goal and its link, made in one form): records and change-log entries together, in order. */
export function mergeCommits(...cs: (Commit | null | undefined)[]): Commit | null {
  const list = cs.filter((c): c is Commit => !!c);
  if (!list.length) return null;
  const out: Commit = { changes: [] };
  for (const c of list) {
    for (const [k, v] of Object.entries(c) as [keyof Commit, unknown][]) {
      if (k === 'changes') out.changes.push(...c.changes);
      else if (k === 'modules') out.modules = mergeModuleRows(out.modules, c.modules);
      else if (Array.isArray(v)) (out as unknown as Record<string, unknown[]>)[k] = [...(((out as unknown as Record<string, unknown[]>)[k]) ?? []), ...v];
      else if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
