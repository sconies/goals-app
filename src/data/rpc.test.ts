// @vitest-environment node
/* The database's save functions, run as the app's public user (anon) against the real schema:
   a save is one transaction, a stale save is refused, and a workspace is created or deleted whole. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../domain/importer';
import { emptyDraft, toCheckIn } from '../domain/checkin';
import { planAt } from '../domain/plan';
import type { Snapshot } from '../domain/types';
import { commitPayload, teamToRow, workspaceToRow } from './rows';
import { withExpectations, type Commit } from './store';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const now = new Date('2026-10-30T12:00:00Z');

describe('database save functions, as the public user', () => {
  let db: PGlite;
  let snap: Snapshot;
  const ws = 'ws_rpc';
  const asAnon = async <T,>(q: string, params: unknown[]) => {
    await db.exec('set role anon');
    try { return await db.query<T>(q, params); } finally { await db.exec('reset role'); }
  };
  const commit = (c: Commit) => asAnon('select okr_commit($1, $2::jsonb)', [ws, JSON.stringify(commitPayload(ws, c))]);
  const count = async (table: string, where = `workspace_id = '${ws}'`) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`)).rows[0]!.n;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec('create role anon nologin;');
    await db.exec(sql);
    const built = buildWorkspace({ name: 'Platform', startDate: '2025-12-29', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now, idSuffix: 'rpc1' });
    expect(built.issues).toEqual([]);
    snap = built.snapshot;
    const payload = { ...commitPayload(ws, { ...snap, changes: [] }), teams: snap.teams.map((t) => teamToRow(ws, t)), expect: null };
    await asAnon('select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify(workspaceToRow({ id: ws, name: 'Platform', kind: 'own', createdAt: now.toISOString() })), JSON.stringify(payload)]);
  }, 30_000);

  it('creates a workspace and everything in it', async () => {
    expect(await count('okr_goals')).toBe(snap.goals.length);
    expect(await count('okr_people')).toBe(snap.people.length);
    expect(await count('okr_stages')).toBeGreaterThan(0);
  });

  it('creates nothing at all when any part of a new workspace is wrong', async () => {
    // Everything valid except one goal of a kind that doesn't exist.
    const good = commitPayload('ws_bad', { ...snap, goals: [], checkIns: [], changes: [] });
    const g = commitPayload('ws_bad', { goals: [snap.goals[0]!], changes: [] }).goals[0]!;
    const bad = { ...good, teams: [], people: [], cycles: [{ ...good.cycles[0]!, id: 'cycle_bad' }], goals: [{ ...g, id: 'g_bad', cycle_id: 'cycle_bad', kind: 'nope' }], expect: null };
    await expect(asAnon('select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify({ id: 'ws_bad', name: 'Bad', kind: 'own', created_at: now.toISOString() }), JSON.stringify(bad)])).rejects.toThrow();
    expect(await count('okr_workspaces', `id = 'ws_bad'`)).toBe(0);
    expect(await count('okr_cycles', `workspace_id = 'ws_bad'`)).toBe(0);
  });

  it('saves a check-in and its change-log entry together, and bumps the goal’s version', async () => {
    const g = snap.goals.find((x) => x.kind === 'metric')!;
    const c = toCheckIn(g, snap.cycles[0]!, 43, { ...emptyDraft(g, null), value: g.kind === 'metric' ? planAt(g.plan, 43, 52).toFixed(3) : '0', why: 'On plan.' }, [], g.ownerId, now, 'ci_rpc_1');
    await commit(withExpectations({ checkIns: [c], changes: [{ id: 'chg_rpc_1', at: now.toISOString(), actorId: g.ownerId, goalId: g.id, entity: 'check-in', entityId: c.id, action: 'posted', summary: 'x', diffs: [] }] }, snap));
    expect(await count('okr_check_ins')).toBe(1);
    expect(await count('okr_changes')).toBe(1);
    await commit(withExpectations({ goals: [{ ...g, title: g.title + ' (renamed)' }], changes: [] }, snap));
    expect((await db.query<{ version: number }>(`select version from okr_goals where id = $1`, [g.id])).rows[0]!.version).toBe(1);
  });

  it('refuses a save based on an old version, and writes none of it', async () => {
    const g = snap.goals.find((x) => x.kind === 'metric')!;
    // snap still has version 0; the database is on 1 after the rename above.
    const stale = withExpectations({ goals: [{ ...g, title: 'Someone else’s title' }], changes: [{ id: 'chg_rpc_stale', at: now.toISOString(), actorId: g.ownerId, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary: 'x', diffs: [] }] }, snap);
    await expect(commit(stale)).rejects.toThrow(/stale: goal/);
    expect(await count('okr_changes', `id = 'chg_rpc_stale'`)).toBe(0);
    expect((await db.query<{ title: string }>(`select title from okr_goals where id = $1`, [g.id])).rows[0]!.title).toMatch(/renamed/);
  });

  it('refuses a check-in for a week someone else has just posted', async () => {
    const g = snap.goals.find((x) => x.kind === 'metric')!;
    const mine = toCheckIn(g, snap.cycles[0]!, 43, { ...emptyDraft(g, null), value: g.kind === 'metric' ? planAt(g.plan, 43, 52).toFixed(3) : '0', why: 'On plan.' }, [], g.ownerId, now, 'ci_rpc_2');
    // Based on a snapshot with no check-in that week; the database has ci_rpc_1.
    await expect(commit(withExpectations({ checkIns: [mine], changes: [] }, snap))).rejects.toThrow(/stale: check-in/);
  });

  it('logs a retried save only once', async () => {
    const entry = { id: 'chg_rpc_retry', at: now.toISOString(), actorId: snap.people[0]!.id, goalId: null, entity: 'note' as const, entityId: 'n1', action: 'noted' as const, summary: 'Commented', diffs: [] };
    await commit({ changes: [entry] });
    await commit({ changes: [entry] });
    expect(await count('okr_changes', `id = 'chg_rpc_retry'`)).toBe(1);
  });

  it('refuses rows that belong to another workspace', async () => {
    const p = commitPayload(ws, { changes: [] });
    await expect(asAnon('select okr_commit($1, $2::jsonb)', [ws, JSON.stringify({ ...p, changes: [{ id: 'x', workspace_id: 'other', at: now.toISOString(), actor_id: 'a', goal_id: null, entity: 'note', entity_id: 'n', action: 'noted', summary: 's', diffs: [] }] })])).rejects.toThrow(/another workspace/);
  });

  it('won’t start the same year twice', async () => {
    const c = { ...snap.cycles[0]!, id: 'cycle_dup' };
    await expect(commit({ cycles: [c], changes: [] })).rejects.toThrow();
  });

  it('deletes a workspace and everything in it, as the public user', async () => {
    await asAnon('select okr_delete_workspace($1)', [ws]);
    for (const t of ['okr_goals', 'okr_people', 'okr_check_ins', 'okr_changes', 'okr_stages', 'okr_cycles', 'okr_teams']) expect(await count(t)).toBe(0);
    expect(await count('okr_workspaces', `id = '${ws}'`)).toBe(0);
  });
});
