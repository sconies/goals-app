// @vitest-environment node
/* The telemetry tables (migration 0022), run against the real schema: the public key can add rows the app builds but
   never read them back; rows are checked for OpenTelemetry's shape and their size; a workspace that has turned
   recording off (saved by okr_commit) gets no rows; and the nightly job rolls days up before it prunes them. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logRow, metricRow, spanRow } from '../telemetry/model';
import { commitPayload, workspaceFromRow, workspaceToRow, type WorkspaceRow } from './rows';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const now = new Date('2026-10-30T12:00:00Z');
const SESSION = 'a'.repeat(32);
const RES = { 'service.name': 'goals-app', 'deployment.environment': 'live' };

describe('telemetry tables (0022)', () => {
  let db: PGlite;
  const asAnon = async <T,>(q: string, params: unknown[] = []) => {
    await db.exec('set role anon');
    try { return await db.query<T>(q, params); } finally { await db.exec('reset role'); }
  };
  /** Adds a row as the REST API would: only the columns it carries, so the id and received_at come from the database. */
  const insert = (table: string, row: object, anon = true) => {
    const cols = Object.keys(row).map((k) => `"${k}"`).join(', ');
    const q = `insert into ${table} (${cols}) select ${cols} from jsonb_populate_record(null::${table}, $1::jsonb)`;
    return anon ? asAnon(q, [JSON.stringify(row)]) : db.query(q, [JSON.stringify(row)]);
  };
  const count = async (q: string) => (await db.query<{ n: number }>(q)).rows[0]!.n;
  const span = (o: Partial<Parameters<typeof spanRow>[0]> = {}) => spanRow({
    traceId: '1'.repeat(32), spanId: Math.random().toString(16).slice(2, 10).padEnd(16, '0'), name: 'postCheckIn', startMs: now.getTime(), endMs: now.getTime() + 120,
    status: 'OK', attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'http.route': '/check-in/:goalId' }, resource: RES, ...o,
  });

  beforeAll(async () => {
    db = new PGlite();
    await db.exec('create role anon nologin;');
    await db.exec(sql);
    await db.query('insert into okr_workspaces (id, name, kind) values ($1, $2, $3), ($4, $5, $6)', ['ws_t', 'Telemetry', 'own', 'ws_off', 'Quiet', 'own']);
  }, 30_000);

  it('lets the public key add spans, logs and metrics the app builds, and not read them back', async () => {
    await insert('okr_telemetry_spans', span());
    await insert('okr_telemetry_logs', logRow({ atMs: now.getTime(), severity: 'ERROR', body: 'save.failed', attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'error.type': 'network' }, resource: RES }));
    await insert('okr_telemetry_metrics', metricRow({ atMs: now.getTime(), name: 'browser.lcp', value: 812, attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t' }, resource: RES }));
    for (const t of ['okr_telemetry_spans', 'okr_telemetry_logs', 'okr_telemetry_metrics', 'okr_telemetry_daily']) {
      await expect(asAnon(`select * from ${t}`)).rejects.toThrow(/permission denied/);
      await expect(asAnon(`delete from ${t}`)).rejects.toThrow(/permission denied/);
    }
    expect(await count(`select count(*)::int as n from okr_telemetry_spans where workspace_id = 'ws_t'`)).toBe(1);
  });

  it('refuses rows that aren’t OpenTelemetry’s shape, or carry too much', async () => {
    await expect(insert('okr_telemetry_spans', { ...span(), trace_id: 'abc' })).rejects.toThrow();
    await expect(insert('okr_telemetry_spans', { ...span(), trace_id: '0'.repeat(32) })).rejects.toThrow();
    await expect(insert('okr_telemetry_spans', { ...span(), span_id: 'XYZ' })).rejects.toThrow();
    await expect(insert('okr_telemetry_spans', { ...span(), kind: 'BROWSER' })).rejects.toThrow();
    await expect(insert('okr_telemetry_spans', { ...span(), attributes: { big: 'x'.repeat(9000) } })).rejects.toThrow();
    await expect(insert('okr_telemetry_logs', { ...logRow({ atMs: now.getTime(), severity: 'INFO', body: 'x', resource: RES }), severity_number: 40 })).rejects.toThrow();
  });

  it('saves the recording switch with okr_commit, and then takes no rows for that workspace', async () => {
    const at = now.toISOString();
    const c = { recording: false, changes: [{ id: 'chg_rec', at, actorId: 'p', goalId: null, entity: 'workspace' as const, entityId: 'ws_off', action: 'edited' as const, summary: 'Turned recording off', diffs: [] }] };
    await asAnon('select okr_commit($1, $2::jsonb)', ['ws_off', JSON.stringify(commitPayload('ws_off', c))]);
    expect((await db.query<{ recording: boolean }>(`select recording from okr_workspaces where id = 'ws_off'`)).rows[0]!.recording).toBe(false);
    const off = span({ attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_off' } });
    await expect(insert('okr_telemetry_spans', off)).rejects.toThrow(/row-level security/);
    // A workspace that records, and setting one up (no workspace yet), still can.
    await insert('okr_telemetry_spans', span());
    await insert('okr_telemetry_spans', span({ attributes: { 'session.id': SESSION } }));
    // Back on.
    await asAnon('select okr_commit($1, $2::jsonb)', ['ws_off', JSON.stringify(commitPayload('ws_off', { ...c, recording: true, changes: [{ ...c.changes[0]!, id: 'chg_rec2' }] }))]);
    await insert('okr_telemetry_spans', off);
  });

  it('saves the feature modules switched off with okr_commit (0030), and reads them back with the workspace', async () => {
    const at = now.toISOString();
    const c = { modulesOff: ['spreadsheets'], changes: [{ id: 'chg_mod', at, actorId: 'p', goalId: null, entity: 'workspace' as const, entityId: 'ws_off', action: 'edited' as const, summary: 'Switched off Spreadsheets', diffs: [] }] };
    await asAnon('select okr_commit($1, $2::jsonb)', ['ws_off', JSON.stringify(commitPayload('ws_off', c))]);
    const row = (await db.query<WorkspaceRow>(`select * from okr_workspaces where id = 'ws_off'`)).rows[0]!;
    expect(workspaceFromRow(row).modulesOff).toEqual(['spreadsheets']);
    // Back on: an empty list.
    await asAnon('select okr_commit($1, $2::jsonb)', ['ws_off', JSON.stringify(commitPayload('ws_off', { ...c, modulesOff: [], changes: [{ ...c.changes[0]!, id: 'chg_mod2' }] }))]);
    expect(workspaceFromRow((await db.query<WorkspaceRow>(`select * from okr_workspaces where id = 'ws_off'`)).rows[0]!).modulesOff).toBeUndefined();
    // A save that doesn't say leaves it alone.
    await asAnon('select okr_commit($1, $2::jsonb)', ['ws_off', JSON.stringify(commitPayload('ws_off', { modulesOff: ['spreadsheets'], changes: [] }))]);
    await asAnon('select okr_commit($1, $2::jsonb)', ['ws_off', JSON.stringify(commitPayload('ws_off', { changes: [] }))]);
    expect(workspaceFromRow((await db.query<WorkspaceRow>(`select * from okr_workspaces where id = 'ws_off'`)).rows[0]!).modulesOff).toEqual(['spreadsheets']);
  });

  it('treats a workspace created without saying as recording', async () => {
    await asAnon('select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify(workspaceToRow({ id: 'ws_new', name: 'New', kind: 'own', createdAt: now.toISOString() })), JSON.stringify({ ...commitPayload('ws_new', { changes: [] }), expect: null })]);
    await insert('okr_telemetry_spans', span({ attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_new' } }));
  });

  it('rolls a day up into daily totals: counts, errors, p50 and p95, and flow starts, finishes and stops by step', async () => {
    const day = Date.parse('2026-09-01T10:00:00Z');
    const rows = [
      ...[100, 200, 300, 400, 1000].map((ms, i) => span({ name: 'page /goals', startMs: day + i * 1000, endMs: day + i * 1000 + ms, status: i === 4 ? 'ERROR' : 'OK', attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'http.route': '/goals' } })),
      span({ name: 'flow.start', startMs: day, endMs: day, attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'app.flow.name': 'check-in', 'app.flow.event': 'start', 'app.flow.step': 'open' } }),
      span({ name: 'flow.start', startMs: day, endMs: day, attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'app.flow.name': 'check-in', 'app.flow.event': 'start', 'app.flow.step': 'open' } }),
      span({ name: 'flow.finish', startMs: day + 5000, endMs: day + 5000, attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'app.flow.name': 'check-in', 'app.flow.event': 'finish', 'app.flow.step': 'post', 'app.flow.duration_ms': 5000 } }),
      span({ name: 'flow.stop', startMs: day + 6000, endMs: day + 6000, attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t', 'app.flow.name': 'check-in', 'app.flow.event': 'stop', 'app.flow.step': 'explain', 'app.flow.duration_ms': 3000 } }),
    ];
    for (const r of rows) await insert('okr_telemetry_spans', r, false);
    await insert('okr_telemetry_logs', logRow({ atMs: day, severity: 'WARN', body: 'save.refused', attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t' }, resource: RES }), false);
    await insert('okr_telemetry_metrics', metricRow({ atMs: day, name: 'browser.lcp', value: 900, attributes: { 'session.id': SESSION, 'app.workspace.id': 'ws_t' }, resource: RES }), false);
    await db.query(`select okr_telemetry_rollup('2026-09-01')`);
    await db.query(`select okr_telemetry_rollup('2026-09-01')`);
    type D = { signal: string; name: string; route: string; step: string; count: number; error_count: number; p50_ms: number | null; p95_ms: number | null; flow_starts: number; flow_finishes: number; flow_stops: number };
    const daily = (await db.query<D>(`select signal, name, route, step, count::int, error_count::int, p50_ms, p95_ms, flow_starts::int, flow_finishes::int, flow_stops::int from okr_telemetry_daily where day = '2026-09-01' order by signal, name, step`)).rows;
    const page = daily.find((d) => d.signal === 'span' && d.name === 'page /goals')!;
    expect(page).toMatchObject({ route: '/goals', count: 5, error_count: 1, p50_ms: 300 });
    expect(page.p95_ms).toBeGreaterThan(800);
    const flows = daily.filter((d) => d.signal === 'flow');
    expect(flows.map((f) => [f.step, f.flow_starts, f.flow_finishes, f.flow_stops])).toEqual([['explain', 0, 0, 1], ['open', 2, 0, 0], ['post', 0, 1, 0]]);
    expect(daily.some((d) => d.signal === 'span' && d.name.startsWith('flow.'))).toBe(false);
    expect(daily.find((d) => d.signal === 'log')).toMatchObject({ name: 'save.refused', step: 'WARN', count: 1, error_count: 0 });
    expect(daily.find((d) => d.signal === 'metric')).toMatchObject({ name: 'browser.lcp', count: 1, p50_ms: 900 });
  });

  it('prunes raw rows after 90 days, rolling their days up first, and keeps the totals', async () => {
    const old = new Date(Date.now() - 100 * 86_400_000);
    old.setUTCHours(9, 0, 0, 0);
    const oldDay = old.toISOString().slice(0, 10);
    await insert('okr_telemetry_spans', span({ name: 'page /activity', startMs: old.getTime(), endMs: old.getTime() + 50 }), false);
    await insert('okr_telemetry_logs', logRow({ atMs: old.getTime(), severity: 'ERROR', body: 'exception', attributes: { 'session.id': SESSION }, resource: RES }), false);
    await insert('okr_telemetry_metrics', metricRow({ atMs: old.getTime(), name: 'browser.lcp', value: 700, resource: RES }), false);
    const recent = await count(`select count(*)::int as n from okr_telemetry_spans where start_time > now() - interval '90 days'`);
    await db.query('select okr_telemetry_nightly()');
    expect(await count(`select count(*)::int as n from okr_telemetry_spans where start_time < now() - interval '90 days'`)).toBe(0);
    expect(await count(`select count(*)::int as n from okr_telemetry_logs where "timestamp" < now() - interval '90 days'`)).toBe(0);
    expect(await count(`select count(*)::int as n from okr_telemetry_metrics where "timestamp" < now() - interval '90 days'`)).toBe(0);
    expect(await count(`select count(*)::int as n from okr_telemetry_spans where start_time > now() - interval '90 days'`)).toBe(recent);
    expect(await count(`select count(*)::int as n from okr_telemetry_daily where day = '${oldDay}' and name = 'page /activity' and count = 1`)).toBe(1);
    expect(await count(`select count(*)::int as n from okr_telemetry_daily where day = '${oldDay}' and signal = 'log' and error_count = 1`)).toBe(1);
    // The September day rolled up earlier is past 90 days too: its totals are still there.
    expect(await count(`select count(*)::int as n from okr_telemetry_daily where day = '2026-09-01'`)).toBeGreaterThan(0);
  });

  it('keeps the roll-up and prune away from the public key', async () => {
    await expect(asAnon(`select okr_telemetry_prune(0)`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(`select okr_telemetry_rollup('2026-09-01')`)).rejects.toThrow(/permission denied/);
  });
});
