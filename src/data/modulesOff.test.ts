// @vitest-environment node
/* The database checks a workspace's switches itself (migration 0058; backlog, bugs found by the drill): a token isn't
   made while AI access is off, and a save that writes a switched-off module's own records is refused, as the app's
   and the MCP server's rules refuse it, while what a save only carries along still runs. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../domain/importer';
import type { Change, Decision, Snapshot, Watch } from '../domain/types';
import { MODULE_RECORDS } from '../core/records';
import { commitPayload, teamToRow, workspaceToRow } from './rows';
import type { Commit } from './store';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const now = new Date('2026-11-16T12:00:00Z').toISOString();
const ws = 'ws_off';

describe('the database refuses what a switched-off module writes (0058)', () => {
  let db: PGlite;
  let snap: Snapshot;
  const asAnon = async <T,>(q: string, params: unknown[]) => {
    await db.exec('set role anon');
    try { return await db.query<T>(q, params); } finally { await db.exec('reset role'); }
  };
  const commit = (c: Commit) => asAnon('select okr_commit($1, $2::jsonb)', [ws, JSON.stringify(commitPayload(ws, c, MODULE_RECORDS))]);
  const count = async (table: string, where: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table} where workspace_id = '${ws}' and ${where}`)).rows[0]!.n;
  const switches = (off: string[]) => commit({ modulesOff: off, changes: [] });
  const admin = () => snap.people.find((p) => p.admin)!;
  const log = (id: string, entity: Change['entity'], entityId: string): Change => ({ id, at: now, actorId: admin().id, goalId: null, entity, entityId, action: 'edited', summary: 'x', diffs: [] });

  beforeAll(async () => {
    db = new PGlite();
    await db.exec('create role anon nologin;');
    await db.exec(sql);
    const built = buildWorkspace({ name: 'Platform', startDate: '2026-10-05', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: new Date(now), idSuffix: 'off1' });
    snap = built.snapshot;
    const payload = { ...commitPayload(ws, { ...snap, changes: [] }), teams: snap.teams.map((t) => teamToRow(ws, t)), expect: null };
    await asAnon('select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify(workspaceToRow({ id: ws, name: 'Platform', kind: 'own', createdAt: now })), JSON.stringify(payload)]);
  }, 30_000);

  it('makes no token while AI access is off, and makes one once it is back on', async () => {
    const make = (id: string) => asAnon('select okr_token_create($1, $2)', [ws, JSON.stringify({ id, person_id: admin().id, name: 'Claude on my laptop', created_by: admin().id })]);
    await switches(['ai-access']);
    await expect(make('tok_off1')).rejects.toThrow('AI access is off in Platform.');
    expect(await count('okr_api_tokens', `id = 'tok_off1'`)).toBe(0);
    await switches([]);
    await make('tok_off2');
    expect(await count('okr_api_tokens', `id = 'tok_off2'`)).toBe(1);
  });

  it('refuses a note, and a change logged to a review, while Reviews is off, and writes none of the save', async () => {
    const g = snap.goals[0]!;
    const note: Decision = { id: 'dec_off1', goalId: g.id, checkInId: null, reviewId: null, week: 3, kind: 'note', byId: admin().id, at: now, note: 'Said in the room.' };
    await switches(['reviews']);
    await expect(commit({ decisions: [note], changes: [log('chg_off1', 'decision', note.id)] })).rejects.toThrow('Reviews is switched off in Platform. An admin can switch it on in Workspace, Features.');
    await expect(commit({ decisions: [note], changes: [] })).rejects.toThrow(/Reviews is switched off/);
    await expect(commit({ goals: [{ ...g, title: 'Renamed' }], changes: [log('chg_off2', 'review', 'rev_x')] })).rejects.toThrow(/Reviews is switched off/);
    expect(await count('okr_decisions', `id = 'dec_off1'`)).toBe(0);
    expect(await count('okr_goals', `title = 'Renamed'`)).toBe(0);
    // A goal proposed in a review, and an ask raised in one, are Reviews' too.
    await expect(commit({ goals: [{ ...g, proposedIn: 'rev_x' }], changes: [] })).rejects.toThrow(/Reviews is switched off/);
    // Switched back on in the same save, the note is kept.
    await commit({ modulesOff: [], decisions: [note], changes: [log('chg_off3', 'decision', note.id)] });
    expect(await count('okr_decisions', `id = 'dec_off1'`)).toBe(1);
  });

  it('refuses a metric’s or a field’s own change while its module is off, but keeps an edit that changes neither', async () => {
    const g = snap.goals[1]!;
    await switches(['metrics', 'tags']);
    await expect(commit({ changes: [log('chg_off4', 'metric', 'met_x')] })).rejects.toThrow('Metric library is switched off in Platform.');
    await expect(commit({ changes: [log('chg_off5', 'field', 'fld_x')] })).rejects.toThrow('Fields is switched off in Platform.');
    await commit({ goals: [{ ...g, title: 'Kept while off' }], changes: [log('chg_off6', 'goal', g.id)] });
    expect(await count('okr_goals', `title = 'Kept while off'`)).toBe(1);
    await switches([]);
  });

  it('refuses watching a goal while Watching is off, but carries watches along with the goals a save is about', async () => {
    const g = snap.goals[2]!;
    const w: Watch = { id: 'wat_off1', personId: admin().id, kind: 'goal', ref: g.id };
    await switches(['watching']);
    await expect(commit({ watches: [w], changes: [] })).rejects.toThrow('Watching is switched off in Platform.');
    await expect(commit({ unwatch: ['wat_any'], changes: [] })).rejects.toThrow(/Watching is switched off/);
    expect(await count('okr_watches', `id = 'wat_off1'`)).toBe(0);
    await commit({ goals: [{ ...g, title: 'Carried' }], watches: [w], changes: [log('chg_off7', 'goal', g.id)] });
    expect(await count('okr_watches', `id = 'wat_off1'`)).toBe(1);
    await switches([]);
  });
});
