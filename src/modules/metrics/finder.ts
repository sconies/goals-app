/* The metric library in find-and-pick, Find and Goals' filters (ML2): the kind `metric` (find spec, rule 7) and the
   Goals filter "Measured by" (?metric=), declared as data (docs/design/architecture.md, 4.2). Kept small: it is in the
   first download, so the finder loads its rules only when someone searches, and the filter reads the rows directly. */
import type { ModuleFilter, ModuleFinder } from '../../core/app';
import type { WorkspaceNeed } from '../../domain/workspaceAttention';
import type { Person } from '../../domain/types';
import { ownerlessMetrics } from './rules';
import type { Finder } from '../../adapters/localSearch';
import { moduleRows } from '../../domain/records';
import type { Snapshot } from '../../domain/types';
import type { Metric, MetricLink } from './types';

const rows = (s: Snapshot) => ({ metrics: moduleRows<Metric>(s, 'metrics', 'metrics'), links: moduleRows<MetricLink>(s, 'metrics', 'metricLinks') });

/** A metric's address part: its slug where it has one (the demo's), else its id (rulesLibrary.metricSlug). */
const slug = (id: string) => id.replace(/^metric_/, '');

export const metricFinder: ModuleFinder = {
  kind: 'metric',
  things: { thing: 'metric', things: 'metrics' },
  open: (id) => `/metrics/${encodeURIComponent(slug(id))}`,
  search(s, viewer, today) {
    const load = async () => {
      const [{ libraryReads }, rules] = await Promise.all([import('./reads'), import('./rulesMeasure')]);
      return { r: libraryReads(s, today.toISOString()), rules };
    };
    const f: Finder = async (ask) => { const { r, rules } = await load(); return rules.searchMetrics(r, ask); };
    f.suggest = async (_viewerId, recents) => { const { r, rules } = await load(); return rules.suggestMetrics(r, recents, viewer.teamId ?? null); };
    f.byIds = async (ids) => { const { r, rules } = await load(); return rules.metricRowsByIds(r, ids); };
    return f;
  },
};

/** Goals' "Measured by": a goal's column is the metric its live link names. */
export const measuredByFilter: ModuleFilter = {
  list: 'goals', id: 'metric', label: 'Measured by', param: 'metric', column: 'metricId', pick: 'metric',
  fill(s) {
    const by = new Map(rows(s).links.filter((l) => !l.removedAt).map((l) => [l.goalId, l.metricId]));
    return (g) => by.get(g.id) ?? null;
  },
  says(s, value) {
    const m = rows(s).metrics.find((x) => x.id === value || slug(x.id) === value);
    return m?.name ?? null;
  },
};

/** Workspace → About, for admins (spec 2.8): live metrics with no owner, or one who has left. */
export function metricsToSortOut(s: Snapshot, viewer: Person): WorkspaceNeed[] {
  if (!viewer.admin) return [];
  const n = ownerlessMetrics({ metrics: rows(s).metrics, people: s.people }).length;
  return n ? [{ id: 'metric-no-owner', says: `${n} ${n === 1 ? 'metric has' : 'metrics have'} no owner`, why: 'An owner keeps a metric’s meaning true.', action: 'See them', to: '/metrics?sortout=1' }] : [];
}
