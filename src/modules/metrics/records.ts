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
import { CONFIDENCES, LEVELS, structured, type MetricConfidence, type MetricLevel } from './rulesStructure';
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import type { DbRow, ModuleRecords, RecordDef } from '../../domain/records';
import { heldOnSwitch } from './rulesMeasured';
import { LINKS_KEY, linkOf, linksOf, log, markLabel, marksFor, metricRows, metricsOf, METRICS_KEY } from './rules';
import { metricsSheetRef } from './sheetRef';
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
  // MT3 (migration 0043): always written, so a batch mixing retired and live metrics never leaves a key out (okr_upsert
  // takes the union of a batch's keys, and a key left out is written null). The NOT NULL columns get '' and [].
  // MS (migration 0046): always written, as the NOT NULL columns are, for the same reason.
  measurement: m.measurement ?? 'measured', measurement_note: m.measurement && m.measurement !== 'measured' ? m.measurementNote ?? '' : '',
  retired_at: m.retiredAt ?? null, retired_by: m.retiredBy ?? null, retired_why: m.retiredWhy ?? '', replaced_by: m.replacedBy ?? null, marks: m.marks ?? [],
  // MQ (migration 0055): always written, null when not said, so a mixed batch never leaves a key out.
  level: m.level ?? null, parent_id: m.parentId ?? null, confidence: m.confidence ?? null, gaming: m.gaming || null,
  // MQ2 (migration 0056): always written, null when not said, so a mixed batch never leaves a key out.
  calculation: m.calculation ?? null, time_window: m.timeWindow ?? null, source_link: m.sourceLink || null, source_query: m.sourceQuery || null,
  source_owner_id: m.sourceOwnerId ?? null, refresh_note: m.refreshNote || null, calc_changed_by: m.calcChangedBy ?? null, calc_changed_at: m.calcChangedAt ?? null,
  baselines: m.baselines?.length ? m.baselines : null, verification: m.verification ?? null, verify_attempts: m.verifyAttempts?.length ? m.verifyAttempts : null,
  lapse: m.lapse ?? null, verifiers: m.verifiers?.length ? m.verifiers : null, handover: m.handover ?? null, to_confirm: m.toConfirm ?? null,
});
const obj = <T,>(v: unknown): T | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : undefined);
const list = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) && v.length ? (v as T[]) : undefined);
/** MQ2's fields, each only when said, so a metric that never had them reads exactly as before. */
const quality = (r: DbRow): Partial<Metric> => {
  const q: Partial<Metric> = {};
  const c = obj<Metric['calculation']>(r.calculation); if (c) q.calculation = c;
  const w = obj<NonNullable<Metric['timeWindow']>>(r.time_window); if (w) q.timeWindow = w;
  if (r.source_link) q.sourceLink = String(r.source_link);
  if (r.source_query) q.sourceQuery = String(r.source_query);
  if (r.source_owner_id) q.sourceOwnerId = String(r.source_owner_id);
  if (r.refresh_note) q.refreshNote = String(r.refresh_note);
  if (r.calc_changed_by) { q.calcChangedBy = String(r.calc_changed_by); q.calcChangedAt = r.calc_changed_at ? iso(r.calc_changed_at) : null; }
  const b = list<NonNullable<Metric['baselines']>[number]>(r.baselines); if (b) q.baselines = b;
  const v = obj<NonNullable<Metric['verification']>>(r.verification); if (v) q.verification = v;
  const a = list<NonNullable<Metric['verifyAttempts']>[number]>(r.verify_attempts); if (a) q.verifyAttempts = a;
  const l = obj<NonNullable<Metric['lapse']>>(r.lapse); if (l) q.lapse = l;
  const vs = list<string>(r.verifiers); if (vs) q.verifiers = vs.map(String);
  const h = obj<NonNullable<Metric['handover']>>(r.handover); if (h) q.handover = h;
  const tc = obj<NonNullable<Metric['toConfirm']>>(r.to_confirm); if (tc) q.toConfirm = tc;
  return q;
};
export const metricFromRow = (r: DbRow): Metric => ({
  id: r.id, name: String(r.name), meaning: String(r.meaning ?? ''), unit: String(r.unit), decimals: Number(r.decimals ?? 0), direction: r.direction as Metric['direction'],
  source: String(r.source ?? ''), sourceOwner: String(r.source_owner ?? ''), refresh: (r.refresh ?? null) as Metric['refresh'], ownerId: String(r.owner_id), caveats: String(r.caveats ?? ''),
  createdBy: String(r.created_by), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by),
  ...(r.retired_at ? { retiredAt: iso(r.retired_at), retiredBy: r.retired_by ? String(r.retired_by) : null, retiredWhy: String(r.retired_why ?? ''), replacedBy: r.replaced_by ? String(r.replaced_by) : null } : {}),
  ...(Array.isArray(r.marks) && r.marks.length ? { marks: r.marks as Metric['marks'] } : {}),
  ...(r.measurement === 'partly' || r.measurement === 'gap' ? { measurement: r.measurement, measurementNote: String(r.measurement_note ?? '') } : {}),
  ...structured(LEVELS.includes(r.level as MetricLevel) ? (r.level as MetricLevel) : null, r.parent_id ? String(r.parent_id) : null, CONFIDENCES.includes(r.confidence as MetricConfidence) ? (r.confidence as MetricConfidence) : null, r.gaming ? String(r.gaming) : null),
  ...quality(r),
});
export const metricLinkToRow = (ws: string, l: MetricLink): DbRow => ({ workspace_id: ws, id: l.id, goal_id: l.goalId, metric_id: l.metricId, team_id: l.teamId, part: String(l.part ?? '').trim(), linked_by: l.linkedBy, linked_at: l.linkedAt, ...set({ removed_at: l.removedAt, removed_by: l.removedBy }) });
export const metricLinkFromRow = (r: DbRow): MetricLink => ({
  id: r.id, goalId: String(r.goal_id), metricId: String(r.metric_id), teamId: (r.team_id ?? null) as string | null, ...(r.part ? { part: String(r.part) } : {}), linkedBy: String(r.linked_by), linkedAt: iso(r.linked_at),
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
      // Any goal of the workspace still there, a stopped one or one in another cycle included, as removeMetric unlinked them all.
      const goals = new Set((x.full ?? x.snapshot).goals.filter((g) => !g.removedAt).map((g) => g.id));
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
  sheets: [metricsSheetRef()],
  // The metric a goal is linked to, for goal entry's wrong-side question at every door (a file and the AI tools too).
  measures: (s, goalId) => {
    const l = linkOf(s, goalId);
    const m = l ? metricsOf(s).find((x) => x.id === l.metricId) : undefined;
    return m ? { name: m.name, direction: m.direction } : null;
  },
  // Goals' "Measured by" (?metric=): a goal's column is the metric its live link names. The app's filter (finder.ts)
  // and find_goals both read it.
  // MT3's `goal.marks`: a change of meaning or direction since the goal was linked, on its chart (rule 4).
  goalMarks: (s, goalId, since, until) => {
    const l = linkOf(s, goalId);
    const m = l ? metricsOf(s).find((x) => x.id === l.metricId) : undefined;
    return m && l ? marksFor(m, l, since, until).map((k) => ({ week: k.week, label: markLabel(k) })) : [];
  },
  // MS: switched off, the library lets go of the goals it held to no number; switched on, it holds them again.
  switched: (x, on) => { const s = x.full ?? x.snapshot; return heldOnSwitch(x, on, metricsOf(s), linksOf(s)); },
  // MQ2: someone leaving passes the metrics they own to their lead, each to confirm under "To sort out"; the stage
  // doesn't change (a handover isn't an edit of the calculation).
  personLeft: (x, personId, toId) => {
    const s = x.full ?? x.snapshot;
    const mine = metricsOf(s).filter((m) => m.ownerId === personId && !m.removedAt);
    if (!mine.length) return null;
    const name = (id: string) => s.people.find((p) => p.id === id)?.name ?? 'someone';
    const moved: Metric[] = mine.map((m) => ({ ...m, ownerId: toId, handover: { from: personId, at: x.now, why: `${name(personId)} left` }, updatedAt: x.now }));
    return {
      ...metricRows({ metrics: moved }),
      changes: moved.map((m) => log(x, { entityId: m.id, action: 'edited', summary: `Passed “${m.name}” to ${name(toId)} to confirm, as ${name(personId)} left`, diffs: [{ field: 'Owner', from: name(personId), to: `${name(toId)} (to confirm)` }] })),
      lines: moved.map((m) => `The metric “${m.name}” passes to ${name(toId)}, to confirm.`),
    };
  },
  goalColumns: [{ param: 'metric', fill: (s) => { const by = new Map(linksOf(s).filter((l) => !l.removedAt).map((l) => [l.goalId, l.metricId])); return (g) => by.get(g.id) ?? null; } }],
};
export default records;
