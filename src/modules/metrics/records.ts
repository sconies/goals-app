/* The metric library's own records (AS part 2, the records extension point; domain/records): the worked example of a
   module with records of its own. The core keeps, saves, scopes, removes and restores them without knowing what they are.

     metric       a metric in the library (okr_metrics), under modules.metrics.metrics; removable, and restorable from
                  Recently removed (kind "metric") with the links it had to goals still there
     metric link  a goal's link to the metric that measures it (okr_goal_metrics), under modules.metrics.metricLinks;
                  one per goal (its id is the goal's), unlinked with removedAt and back with Undo

   What a new cycle carries: every metric not removed (the library spans cycles), and the links in force to the cycle's
   live goals whose metric is in use. Removing a goal or a person changes no row here: a removed or stopped goal's link
   is out of the cycle with it and back with it; a metric whose owner leaves keeps them as owner, as a goal does until
   handed over. Both tables come from migration 0033 and are on okr_write's allowed list (migration 0039). */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import type { DbRow, ModuleRecords, RecordDef } from '../../domain/records';
import { LINKS_KEY, linkOf, linksOf, metricRows, metricsOf, METRICS_KEY } from './rules';
import { METRICS_SHEET } from './sheet';
import type { Metric, MetricLink } from './types';

/* ---------- rows each way (the Supabase and Postgres adapters write and read these) ---------- */

/** Written only when there is one (a restore writes null), so rows never removed look exactly as before. */
const set = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const iso = (v: unknown) => new Date(String(v)).toISOString();
const when = (k: string, v: unknown) => (v ? { [k]: iso(v) } : {});
const who = (k: string, v: unknown) => (v ? { [k]: String(v) } : {});

export const metricToRow = (ws: string, m: Metric): DbRow => ({
  workspace_id: ws, id: m.id, name: m.name, meaning: m.meaning, unit: m.unit, decimals: m.decimals, direction: m.direction, source: m.source, source_owner: m.sourceOwner,
  refresh: m.refresh, owner_id: m.ownerId, caveats: m.caveats, created_by: m.createdBy, created_at: m.createdAt, updated_at: m.updatedAt, ...set({ removed_at: m.removedAt, removed_by: m.removedBy }),
});
export const metricFromRow = (r: DbRow): Metric => ({
  id: r.id, name: String(r.name), meaning: String(r.meaning ?? ''), unit: String(r.unit), decimals: Number(r.decimals ?? 0), direction: r.direction as Metric['direction'],
  source: String(r.source ?? ''), sourceOwner: String(r.source_owner ?? ''), refresh: (r.refresh ?? null) as Metric['refresh'], ownerId: String(r.owner_id), caveats: String(r.caveats ?? ''),
  createdBy: String(r.created_by), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by),
});
export const metricLinkToRow = (ws: string, l: MetricLink): DbRow => ({ workspace_id: ws, id: l.id, goal_id: l.goalId, metric_id: l.metricId, team_id: l.teamId, linked_by: l.linkedBy, linked_at: l.linkedAt, ...set({ removed_at: l.removedAt, removed_by: l.removedBy }) });
export const metricLinkFromRow = (r: DbRow): MetricLink => ({
  id: r.id, goalId: String(r.goal_id), metricId: String(r.metric_id), teamId: (r.team_id ?? null) as string | null, linkedBy: String(r.linked_by), linkedAt: iso(r.linked_at),
  ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by),
});

/* ---------- the records ---------- */

const metric: RecordDef<Metric> = {
  name: 'metric',
  key: METRICS_KEY,
  table: 'okr_metrics',
  removable: true,
  toRow: metricToRow,
  fromRow: metricFromRow,
  order: (a, b) => a.createdAt.localeCompare(b.createdAt),
  // The library spans cycles: every metric not removed.
  carry: (rows) => rows.filter((m) => !m.removedAt),
  removed: {
    label: 'Metric',
    name: (m) => m.name,
    // The links it had come back with it (spec 2.2): those removed in the same save, to a goal still there that
    // nothing else measures since (a link's id is its goal's, so one linked again no longer carries that moment).
    restore(x: ActionContext, m: Metric): Commit {
      const same = metricsOf(x.full ?? x.snapshot).find((v) => v.id !== m.id && !v.removedAt && v.name.trim().toLowerCase() === m.name.trim().toLowerCase());
      if (same) throw new NotAllowed(`There’s a metric called ${same.name} again. Rename it first.`);
      const goals = new Set(x.snapshot.goals.filter((g) => !g.removedAt).map((g) => g.id));
      const back = m.removedAt ? linksOf(x.full ?? x.snapshot).filter((l) => l.metricId === m.id && l.removedAt === m.removedAt && goals.has(l.goalId)) : [];
      return {
        ...metricRows({ metrics: [{ ...m, removedAt: null, removedBy: null, updatedAt: x.now }], ...(back.length ? { metricLinks: back.map((l) => ({ ...l, removedAt: null, removedBy: null })) } : {}) }),
        changes: [{ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: null, entity: 'metric', entityId: m.id, action: 'restored', summary: `Restored the metric “${m.name}”${back.length ? `, measuring ${back.length} ${back.length === 1 ? 'goal' : 'goals'} again` : ''}`, diffs: [{ field: 'Metric', from: '—', to: m.name }] }],
      };
    },
  },
};

const goalMetric: RecordDef<MetricLink> = {
  name: 'metric link',
  key: LINKS_KEY,
  table: 'okr_goal_metrics',
  removable: false,
  toRow: metricLinkToRow,
  fromRow: metricLinkFromRow,
  // Links in force to the cycle's live goals, whose metric is in use. A removed or stopped goal's link comes back with it.
  carry: (rows, scope) => {
    const live = new Set(metricsOf(scope).filter((m) => !m.removedAt).map((m) => m.id));
    return rows.filter((l) => !l.removedAt && scope.goalIds.has(l.goalId) && live.has(l.metricId));
  },
  // A goal carried into the next year keeps its metric (cycle-end rule 6): the same metric and team, linked by the same
  // person. A link's id is its goal's.
  follow: (rows, copies) => rows.filter((l) => copies.has(l.goalId)).map((l) => ({ ...l, id: copies.get(l.goalId)!, goalId: copies.get(l.goalId)!, removedAt: null, removedBy: null })),
  goalOf: (l) => l.goalId,
};

const records: Omit<ModuleRecords, 'module'> = {
  records: [metric, goalMetric],
  sheets: [METRICS_SHEET],
  // The metric a goal is linked to, for goal entry's wrong-side question at every door (a file and the AI tools too).
  measures: (s, goalId) => {
    const l = linkOf(s, goalId);
    const m = l ? metricsOf(s).find((x) => x.id === l.metricId) : undefined;
    return m ? { name: m.name, direction: m.direction } : null;
  },
};
export default records;
