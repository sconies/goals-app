// @vitest-environment node
/* A build without a module (FARO_WITHOUT, AS part 2): a workspace that holds the metric library's rows loads and saves
   with a build that declares no metric records, and none of those rows is changed or deleted; with the module back,
   they are all there. A build without a module declares none of its records, which is what `records: []` is here. CI's
   "Core journeys without metrics" job runs the app itself that way. */
import { MODULE_RECORDS } from '../core/records';
import { BrowserStore } from '../data/store';
import { scopeToCycle } from '../domain/cycle';
import { recentlyRemoved, restoreRemoved } from '../domain/removal';
import type { ActionContext } from '../domain/actions';
import type { Snapshot } from '../domain/types';
import { linksOf, metricRows, metricsOf } from '../modules/metrics/rules';
import type { Metric, MetricLink } from '../modules/metrics/types';
import { contractWorkspace } from '../ports/contracts/store';
import { PostgresStore } from './postgres/goalsStore';
import { freshPostgres } from './postgres/testDb';

const NOW = '2026-10-30T12:00:00.000Z';

/** A small workspace with one metric (removed and restorable) and one goal measured by another. */
function withMetrics(suffix: string): Snapshot {
  const s = contractWorkspace(suffix);
  const by = s.people[0]!.id;
  const g = s.goals.find((x) => x.kind === 'metric')!;
  const metric = (id: string, name: string, extra: Partial<Metric> = {}): Metric => ({ id, name, meaning: '', unit: g.unit, decimals: 0, direction: 'higher', source: '', sourceOwner: '', refresh: null, ownerId: by, caveats: '', createdBy: by, createdAt: NOW, updatedAt: NOW, ...extra });
  const link: MetricLink = { id: g.id, goalId: g.id, metricId: `m_${suffix}_1`, teamId: null, linkedBy: by, linkedAt: NOW };
  return { ...s, ...metricRows({ metrics: [metric(`m_${suffix}_1`, 'Kept'), metric(`m_${suffix}_2`, 'Removed', { removedAt: NOW, removedBy: by })], metricLinks: [link] }) };
}
const note = (s: Snapshot, text: string) => ({ changes: [{ id: `chg_${text.length}_${Math.random().toString(36).slice(2, 8)}`, at: NOW, actorId: s.people[0]!.id, goalId: s.goals[0]!.id, entity: 'note' as const, entityId: 'note_x', action: 'noted' as const, summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: text }] }] });

describe('a build without the metric library, on a workspace that has its rows', () => {
  it('loads and saves on a database, and changes or deletes none of its rows', async () => {
    const db = await freshPostgres();
    const withModule = new PostgresStore(db, MODULE_RECORDS);
    const without = new PostgresStore(db, []);
    const start = withMetrics('pg');
    await withModule.createWorkspace({ id: 'ws_without', name: 'Without', kind: 'own', createdAt: NOW }, start);
    const before = await withModule.load('ws_without');
    expect(metricsOf(before)).toHaveLength(2);

    // The build without the module: everything else loads, and nothing of the module's is read.
    const loaded = await without.load('ws_without');
    expect(loaded.modules).toBeUndefined();
    expect(loaded.goals.map((g) => g.id).sort()).toEqual(before.goals.map((g) => g.id).sort());
    // It saves: a comment, and the goal the module's link points to, renamed.
    const g = loaded.goals.find((x) => x.id === linksOf(before)[0]!.goalId)!;
    await without.commit('ws_without', { goals: [{ ...g, title: `${g.title} (renamed)` }], ...note(loaded, 'Saved without the module') });

    // With the module back, every row of it is as it was.
    const after = await withModule.load('ws_without');
    expect(after.modules).toEqual(before.modules);
    expect(after.goals.find((x) => x.id === g.id)!.title).toBe(`${g.title} (renamed)`);
  }, 60_000);

  it('keeps them in the browser, through saves, scoping and Recently removed', async () => {
    const store = new BrowserStore(() => new Date(NOW), { storage: null, example: false, key: 'without' });
    const start = withMetrics('br');
    await store.createWorkspace({ id: 'ws_b', name: 'Without', kind: 'own', createdAt: NOW }, start);
    await store.commit('ws_b', note(start, 'Saved without the module'));
    const after = await store.load('ws_b');
    expect(after.modules).toEqual(start.modules);
    // Scoped by a build with no records for them, they pass through as they are, removed one included.
    expect(scopeToCycle(after, after.cycles[0]!, []).modules).toEqual(start.modules);
    // Recently removed doesn't list what no module in the build can bring back, and restoring it is refused.
    expect(recentlyRemoved(after, new Date(NOW), Number.POSITIVE_INFINITY, []).some((r) => r.kind === 'metric')).toBe(false);
    const x = { snapshot: after, full: after, cycle: after.cycles[0]!, week: 1, actor: { ...after.people[0]!, admin: true }, now: NOW, newId: (p: string) => `${p}_1` } as ActionContext;
    expect(() => restoreRemoved(x, 'metric', 'm_br_2', [])).toThrow(/nothing removed with that ID/);
    // With the module, it's listed and comes back.
    expect(recentlyRemoved(after, new Date(NOW), Number.POSITIVE_INFINITY, MODULE_RECORDS).find((r) => r.kind === 'metric')).toMatchObject({ id: 'm_br_2', label: 'Metric', name: 'Removed' });
    expect(metricsOf(restoreRemoved(x, 'metric', 'm_br_2', MODULE_RECORDS))[0]).toMatchObject({ id: 'm_br_2', removedAt: null });
  });
});
