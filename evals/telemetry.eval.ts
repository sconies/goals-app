/* Spec scenarios for observability, release 1 (Lane's grill, 5 Nov): traces, logs and metrics in OpenTelemetry's shape
   in the app's own database; one trace per action reaching the save's RPC; the MCP server's own spans joined to the
   caller's trace; nothing anyone types, ever; named flows with their steps, finishes and stops; 90 days then daily
   totals; and an admin's switch that stops everything for a workspace. The browser end is checked by N8. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit, BrowserStore, newId } from '../src/data/store';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import * as A from '../src/domain/actions';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { FLOWS } from '../src/help/flows';
import { articleById } from '../src/help/guide';
import { hashToken, newToken } from '../src/mcp/protocol';
import { Telemetry } from '../src/telemetry/client';
import { Exporter } from '../src/telemetry/exporter';
import { FlowTracker } from '../src/telemetry/flows';
import { newSpanId, newTraceId, traceparent } from '../src/telemetry/ids';
import { logProblems, metricRow, spanProblems, type LogRow, type SpanRow } from '../src/telemetry/model';
import { tracedStore } from '../src/telemetry/store';

const OCT = new Date('2026-11-05T12:00:00Z');
const SECRET = 'Zebra-pancake 7319 do not record';
const ctx = (personId: string, s: Snapshot = seed(OCT)): A.ActionContext => {
  const cycle = currentCycle(s.cycles, OCT)!;
  return { snapshot: scopeToCycle(s, cycle), cycle, week: 45, actor: s.people.find((p) => p.id === personId)!, now: OCT.toISOString(), newId, allGoals: s.goals };
};

/** The browser's telemetry with a fake network that keeps every request body. */
function browser(status = 201, recording: boolean | null = true) {
  const bodies: { url: string; body: string }[] = [];
  const fetch = (async (url: string, init: RequestInit) => { bodies.push({ url, body: String(init.body) }); if (status === 0) throw new TypeError('Failed to fetch'); return new Response(null, { status }); }) as unknown as typeof globalThis.fetch;
  const exporter = new Exporter({ url: 'https://db.example', key: 'k' }, { fetch, setTimer: () => 1, clearTimer: () => undefined });
  const paints: (() => void)[] = [];
  const tel = new Telemetry({ sessionId: 'b'.repeat(32), exporter, resource: { 'service.name': 'goals-app', 'service.version': 'eval', 'deployment.environment': 'demo' }, afterPaint: (f) => paints.push(f), flows: new FlowTracker() });
  tel.setContext({ workspaceId: 'platform-org', userId: 'rhea', store: 'browser', recording });
  const store = tracedStore(new BrowserStore(() => OCT), tel);
  const rows = <T,>(table: string) => bodies.filter((b) => b.url.endsWith(table)).flatMap((b) => JSON.parse(b.body) as T[]);
  return { tel, exporter, store, bodies, paint: () => paints.splice(0).forEach((f) => f()), spans: () => rows<SpanRow>('okr_telemetry_spans'), logs: () => rows<LogRow>('okr_telemetry_logs') };
}

/** The MCP server for one person, with a telemetry sink that keeps what it would store. */
async function assistant(personId: string, sinkFails = false) {
  let data: Snapshot = seed(OCT);
  let recording = true;
  const stored: SpanRow[] = [];
  const token = newToken();
  const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: OCT.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [t] };
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'acme' } : null),
    workspaceName: async () => 'Acme',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); if (c.recording !== undefined) recording = c.recording; },
    touch: async () => undefined,
    recording: async () => recording,
    telemetry: async (spans) => { if (sinkFails) throw new Error('relation "okr_telemetry_spans" does not exist'); stored.push(...spans); },
    now: () => OCT,
  };
  let n = 0;
  const call = async (tool: string, args: object = {}, headers: Record<string, string> = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name: tool, arguments: args } }) }), deps);
    const body = await res.json() as { result?: { content: { text: string }[]; structuredContent?: Record<string, unknown>; isError: boolean } };
    return { text: body.result!.content[0]!.text, data: body.result!.structuredContent, error: body.result!.isError };
  };
  return { call, stored, data: () => data, recording: () => recording };
}

describe('Signals: traces, logs and metrics in OpenTelemetry’s shape', () => {
  it('[TELEMETRY-SIGNALS] an action is one trace: the action, its save timed as a CLIENT span, its flow step and the page showing the result, all valid OpenTelemetry', async () => {
    const b = browser();
    b.tel.page('/check-in/mttr-pir', '', 'push').end();
    const goal = ctx('mateo').snapshot.goals.find((g) => g.id === 'mttr-pir')!;
    await b.tel.action('postCheckIn', async () => { await b.store.commit('platform-org', A.addNote(ctx('mateo'), goal, 'On plan this week.')); });
    b.paint();
    b.tel.metric('browser.lcp', 812);
    await b.exporter.flush();
    const spans = b.spans();
    expect(spans.flatMap((s) => spanProblems(s).map((p) => `${s.name}: ${p}`))).toEqual([]);
    const action = spans.find((s) => s.name === 'postCheckIn')!;
    const trace = spans.filter((s) => s.trace_id === action.trace_id);
    const rpc = trace.find((s) => s.kind === 'CLIENT')!;
    expect(rpc).toMatchObject({ parent_span_id: action.span_id, attributes: { 'db.system': 'browser', 'db.operation': 'commit' } });
    expect(trace.some((s) => s.name === 'flow.finish' && s.parent_span_id === action.span_id)).toBe(true);
    expect(trace.some((s) => s.name === 'page /check-in/:goalId' && s.parent_span_id === action.span_id)).toBe(true);
    expect(action.resource).toMatchObject({ 'service.name': 'goals-app', 'deployment.environment': 'demo' });
    expect(action.attributes).toMatchObject({ 'session.id': 'b'.repeat(32), 'user.id': 'rhea', 'app.workspace.id': 'platform-org', 'http.route': '/check-in/:goalId' });
    const m = b.bodies.find((x) => x.url.endsWith('okr_telemetry_metrics'));
    expect(JSON.parse(m!.body)[0]).toMatchObject({ name: 'browser.lcp', value: 812, unit: 'ms' });
    expect(metricRow({ atMs: 0, name: 'x', value: 1 }).kind).toBe('gauge');
  });

  it('[TELEMETRY-SIGNALS] a failed save is a log in its trace that tells a rule saying no from a network or database fault', async () => {
    const b = browser();
    const refused = () => b.tel.action('saveTeam', () => A.saveTeam(ctx('rhea'), { name: 'Data' }));
    expect(refused).toThrow(A.NotAllowed);
    const broken = { ...b.store, commit: async () => { throw new TypeError('Failed to fetch'); } };
    await expect(b.tel.action('addNote', () => tracedStore(broken, b.tel).commit('platform-org', { changes: [] }))).rejects.toThrow();
    await b.exporter.flush();
    const logs = b.logs();
    expect(logs.flatMap(logProblems)).toEqual([]);
    expect(logs.map((l) => [l.body, l.severity_text, l.attributes['error.type']])).toEqual([['save.refused', 'WARN', 'not_allowed'], ['save.failed', 'ERROR', 'network']]);
    const failed = b.spans().find((s) => s.name === 'addNote')!;
    expect(logs[1]!.trace_id).toBe(failed.trace_id);
    expect(b.spans().find((s) => s.kind === 'CLIENT')).toMatchObject({ status_code: 'ERROR', attributes: { 'error.type': 'network' } });
  });

  it('[TELEMETRY-SIGNALS] the MCP server records a SERVER span per tool call in the caller’s trace, with its save as a CLIENT span inside', async () => {
    const as = await assistant('mateo');
    const caller = { traceId: newTraceId(), spanId: newSpanId() };
    const r = await as.call('add_comment', { goal_id: 'mttr-pir', text: 'Looks fine.' }, { traceparent: traceparent(caller) });
    expect(r.error).toBe(false);
    expect(as.stored.flatMap((s) => spanProblems(s))).toEqual([]);
    const server = as.stored.find((s) => s.kind === 'SERVER')!;
    expect(server).toMatchObject({ name: 'tools/call add_comment', trace_id: caller.traceId, parent_span_id: caller.spanId, status_code: 'OK',
      attributes: { 'mcp.method.name': 'tools/call', 'gen_ai.tool.name': 'add_comment', 'user.id': 'mateo', 'app.workspace.id': 'acme', 'app.via': 'mcp' }, resource: { 'service.name': 'goals-mcp' } });
    const db = as.stored.filter((s) => s.kind === 'CLIENT');
    expect(db.map((s) => s.attributes['db.operation']).sort()).toEqual(['okr_commit', 'select']);
    expect(db.every((s) => s.trace_id === caller.traceId && s.parent_span_id === server.span_id && s.attributes['db.system'] === 'postgresql')).toBe(true);
    // Without a traceparent, each call starts its own trace; a refused call is an error with its class.
    await as.call('rename_workspace', { name: 'Mine' });
    const refused = as.stored.at(-1)!;
    expect(refused).toMatchObject({ kind: 'SERVER', parent_span_id: null, status_code: 'ERROR', attributes: { 'error.type': 'not_allowed' } });
    expect(refused.trace_id).not.toBe(caller.traceId);
  });

  it('[TELEMETRY-SIGNALS] the app carries on exactly as before when telemetry can’t be stored: no database, missing tables, or a dead network', async () => {
    for (const status of [404, 0, 500]) {
      const b = browser(status);
      for (let i = 0; i < 5; i++) {
        b.tel.page('/', '', 'push').end();
        await expect(b.tel.action('watch', async () => { await b.store.commit('platform-org', { changes: [] }); return 'ok'; })).resolves.toBe('ok');
        await b.exporter.flush();
      }
      // One refusal stops it; a network or server fault backs off: never a request per record.
      expect(b.bodies.length, `status ${status}`).toBeLessThanOrEqual(2);
    }
    const none = new Telemetry({ sessionId: 'b'.repeat(32), exporter: new Exporter(null) });
    none.setContext({ recording: true });
    expect(none.action('setViewer', () => 'still works')).toBe('still works');
    // The MCP server answers the same when its telemetry table isn't there.
    const as = await assistant('mateo', true);
    expect((await as.call('get_goal', { goal_id: 'mttr-pir' })).error).toBe(false);
    const posted = await as.call('add_comment', { goal_id: 'mttr-pir', text: 'Still fine.' });
    expect(posted.error).toBe(false);
    expect(as.data().changes.at(-1)!.summary).toBe('Commented');
  });
});

describe('Privacy: nothing anyone types', () => {
  it('[TELEMETRY-PRIVACY] a comment, a team name and a number someone typed never reach a request, from the app or the MCP server', async () => {
    const b = browser();
    const goal = ctx('rhea').snapshot.goals.find((g) => g.id === 'ns-lead')!;
    b.tel.page('/goals/ns-lead', `?q=${encodeURIComponent(SECRET)}`, 'push').end();
    await b.tel.action('addNote', async () => { await b.store.commit('platform-org', A.addNote(ctx('rhea'), goal, SECRET)); });
    expect(() => b.tel.action('saveTeam', () => A.saveTeam(ctx('grace'), { name: 'Developer Experience' }))).toThrow();
    b.tel.exception(new Error(`Could not parse “${SECRET}” as 7319`), 'window');
    b.paint();
    await b.exporter.flush();
    expect(b.bodies.length).toBeGreaterThan(0);
    const all = b.bodies.map((x) => x.body).join('\n');
    expect(all).not.toContain('Zebra');
    // The number on its own: random trace and span ids are hex, and one of them can hold these four digits.
    expect(all).not.toMatch(/(?<![0-9a-f])7319(?![0-9a-f])/i);
    expect(all).not.toContain('DevEx');
    const as = await assistant('rhea');
    await as.call('add_comment', { goal_id: 'ns-lead', text: SECRET });
    await as.call('save_team', { name: SECRET });
    expect(as.stored.length).toBeGreaterThan(1);
    expect(JSON.stringify(as.stored)).not.toContain('Zebra');
  });

  it('[TELEMETRY-PRIVACY] the guide and Workspace, Privacy say what is and isn’t recorded, for how long and who can see it; Settings leads there', () => {
    const a = articleById('recording')!;
    const text = a.sections.flatMap((s) => s.list ?? s.text ?? []).join(' ');
    expect(text).toMatch(/Anything you type/);
    expect(text).toMatch(/90 days/);
    expect(text).toMatch(/Only the people who build and run the app/);
    // Settings is about you (WR3): one line on recording, leading to Privacy, which says it all for everyone.
    const settings = readFileSync(join(__dirname, '../src/screens/Settings.tsx'), 'utf8');
    expect(settings).toContain('/workspace/privacy');
    const privacy = readFileSync(join(__dirname, '../src/screens/Workspace.tsx'), 'utf8');
    for (const words of ['Never anything anyone types', 'Kept 90 days', 'Only the people who build Faro can read it']) expect(privacy).toContain(words);
  });
});

describe('Named flows', () => {
  it('[TELEMETRY-FLOWS] each flow has its guide article, and a check-in is recorded as started, step 2 of 3, finished', async () => {
    for (const f of FLOWS) expect(articleById(f.article), f.id).toBeDefined();
    const b = browser();
    b.tel.page('/check-in/mttr-pir', '', 'push').end();
    b.tel.mark('checkIn.account');
    expect(b.tel.flowsNow()).toEqual([{ flow: 'check-in', step: 'explain', index: 2, count: 3 }]);
    await b.tel.action('postCheckIn', async () => undefined);
    await b.exporter.flush();
    const flow = b.spans().filter((s) => s.attributes['app.flow.name'] === 'check-in').map((s) => [s.attributes['app.flow.event'], s.attributes['app.flow.step'], s.attributes['app.flow.step.index']]);
    expect(flow).toEqual([['start', 'open', 1], ['step', 'explain', 2], ['finish', 'post', 3]]);
  });

  it('[TELEMETRY-FLOWS] leaving a flow part-way is recorded as a stop at the step reached, and the session’s last steps stay in memory', async () => {
    const b = browser();
    b.tel.page('/goals/new', '', 'push').end();
    b.tel.mark('newGoal.step-2');
    b.tel.page('/help', '', 'push').end();
    await b.exporter.flush();
    const stop = b.spans().find((s) => s.attributes['app.flow.event'] === 'stop')!;
    expect(stop.attributes).toMatchObject({ 'app.flow.name': 'new-goal', 'app.flow.step': 'measure', 'app.flow.step.index': 2, 'app.flow.step.count': 5, 'app.flow.stop.reason': 'left' });
    expect(b.tel.recentSteps().map((s) => `${s.kind} ${s.name}`)).toEqual(['page /goals/new', 'flow start', 'mark newGoal.step-2', 'flow step', 'page /help', 'flow stop']);
  });
});

describe('Retention', () => {
  it('[TELEMETRY-RETENTION] raw rows go after 90 days, rolled up first into daily totals kept for good, nightly on pg_cron', async () => {
    const dir = join(__dirname, '../supabase/migrations');
    const mig = readFileSync(join(dir, '0022_telemetry.sql'), 'utf8');
    expect(mig).toMatch(/cron\.schedule\('okr-telemetry-nightly', '17 3 \* \* \*', 'select okr_telemetry_nightly\(\)'\)/);
    const db = new PGlite();
    await db.exec('create role anon nologin;');
    await db.exec(readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n'));
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    for (const [d, ms] of [[100, 40], [100, 60], [100, 900], [3, 50]] as const) {
      await db.query(`insert into okr_telemetry_spans (trace_id, span_id, name, kind, start_time, end_time, duration_ms, attributes, resource) values ($1, $2, 'page /goals', 'INTERNAL', $3, $3, $4, '{"http.route":"/goals"}', '{"service.name":"goals-app"}')`, [newTraceId(), newSpanId(), at(d), ms]);
    }
    await db.query('select okr_telemetry_nightly()');
    const raw = (await db.query<{ n: number }>('select count(*)::int as n from okr_telemetry_spans')).rows[0]!.n;
    const daily = (await db.query<{ count: number; p50_ms: number }>(`select count::int, p50_ms from okr_telemetry_daily where signal = 'span' and name = 'page /goals' and day = $1::date`, [at(100).slice(0, 10)])).rows;
    expect(raw).toBe(1);
    expect(daily).toEqual([{ count: 3, p50_ms: 60 }]);
    await db.close();
  });
});

describe('The recording switch', () => {
  it('[TELEMETRY-SWITCH] only an admin turns recording off; it is logged, and then nothing is sent for the workspace', async () => {
    expect(() => A.setRecording(ctx('rhea'), { id: 'platform-org' }, false)).toThrow(/Only admins/);
    expect(A.setRecording(ctx('grace'), { id: 'platform-org' }, true)).toBeNull();
    const c = A.setRecording(ctx('grace'), { id: 'platform-org' }, false)!;
    expect(c.recording).toBe(false);
    expect(c.changes[0]).toMatchObject({ entity: 'workspace', action: 'edited', actorId: 'grace', summary: 'Turned recording off', diffs: [{ field: 'Recording', from: 'On', to: 'Off' }] });
    // The browser store keeps the switch with the workspace.
    const store = new BrowserStore(() => OCT);
    await store.commit('platform-org', c);
    expect((await store.workspaces()).find((w) => w.id === 'platform-org')!.recording).toBe(false);
    // Off: nothing is sent, whatever happens next.
    const b = browser();
    b.tel.page('/', '', 'push').end();
    b.tel.setContext({ recording: false });
    b.tel.page('/check-in/mttr-pir', '', 'push').end();
    await b.tel.action('postCheckIn', async () => undefined);
    b.tel.exception(new Error('x'), 'window');
    await b.exporter.flush(true);
    expect(b.bodies).toEqual([]);
    // Loading a workspace that is off sends nothing either: records wait until the switch is known.
    const w = browser(201, null);
    w.tel.page('/', '', 'load').end();
    w.tel.metric('browser.navigation.ttfb', 80);
    await w.exporter.flush();
    w.tel.setContext({ recording: false });
    await w.exporter.flush(true);
    expect(w.bodies).toEqual([]);
  });

  it('[TELEMETRY-SWITCH] an admin’s assistant can turn it off with set_recording: that call and every later one store nothing', async () => {
    const rhea = await assistant('rhea');
    expect((await rhea.call('set_recording', { on: false })).error).toBe(true);
    const as = await assistant('grace');
    await as.call('get_goal', { goal_id: 'ns-lead' });
    const before = as.stored.length;
    expect(before).toBeGreaterThan(0);
    const r = await as.call('set_recording', { on: false });
    expect(r).toMatchObject({ error: false, data: { recording: false } });
    expect(as.recording()).toBe(false);
    expect(as.data().changes.at(-1)).toMatchObject({ summary: 'Turned recording off', diffs: [{ field: 'Recording', from: 'On', to: 'Off' }, { field: 'Via', to: 'MCP' }] });
    await as.call('get_goal', { goal_id: 'ns-lead' });
    expect(as.stored.length).toBe(before);
    expect((await as.call('set_recording', { on: false })).text).toMatch(/already off/);
    await as.call('set_recording', { on: true });
    await as.call('get_goal', { goal_id: 'ns-lead' });
    expect(as.stored.length).toBeGreaterThan(before);
  });
});
