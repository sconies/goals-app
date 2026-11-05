// @vitest-environment node
import { NotAllowed } from '../domain/actions';
import { BrowserStore } from '../data/store';
import { redact, sanitise, stackOf } from './attributes';
import { Telemetry } from './client';
import { errorType } from './errors';
import { Exporter, supabaseTarget } from './exporter';
import { newSpanId, newTraceId, parseTraceparent, traceparent } from './ids';
import { logProblems, spanProblems, type LogRow, type SpanRow } from './model';
import { tracedStore } from './store';

const TARGET = { url: 'https://db.example', key: 'sb_publishable_x' };
type Sent = { url: string; body: unknown[]; keepalive: boolean; headers: Record<string, string> };

function fakeFetch(status = 201) {
  const sent: Sent[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)), keepalive: !!init.keepalive, headers: init.headers as Record<string, string> });
    return new Response(null, { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}
/** Telemetry with a fake network and manual timers: `flush()` sends now. */
function setup(status = 201) {
  const net = fakeFetch(status);
  const exporter = new Exporter(TARGET, { fetch: net.fetch, setTimer: () => 1, clearTimer: () => undefined });
  const paints: (() => void)[] = [];
  const tel = new Telemetry({ sessionId: 'c'.repeat(32), exporter, resource: { 'service.name': 'goals-app', 'deployment.environment': 'test' }, afterPaint: (fn) => paints.push(fn) });
  const spans = () => net.sent.filter((s) => s.url.endsWith('okr_telemetry_spans')).flatMap((s) => s.body as SpanRow[]);
  const logs = () => net.sent.filter((s) => s.url.endsWith('okr_telemetry_logs')).flatMap((s) => s.body as LogRow[]);
  return { tel, exporter, net, spans, logs, paint: () => paints.splice(0).forEach((f) => f()) };
}

describe('ids', () => {
  it('makes OpenTelemetry ids and reads and writes W3C traceparent', () => {
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/);
    const c = { traceId: newTraceId(), spanId: newSpanId() };
    expect(parseTraceparent(traceparent(c))).toEqual(c);
    expect(parseTraceparent('00-' + '0'.repeat(32) + '-' + c.spanId + '-01')).toBeNull();
    expect(parseTraceparent('ff-' + c.traceId + '-' + c.spanId + '-01')).toBeNull();
    expect(parseTraceparent('nonsense')).toBeNull();
    expect(parseTraceparent(null)).toBeNull();
  });
});

describe('the allow-list', () => {
  it('keeps only allowed attributes of the right shape, and never what someone typed', () => {
    const out = sanitise({
      'http.route': '/goals/:goalId', 'url.path': '/goals?q=my secret plan', 'user.id': 'maya', 'app.count': 3.14159,
      'note.text': 'Signed off by legal', value: 42, 'goal.title': 'Cut triage time', 'app.action.name': 'Cut triage time!!', 'error.type': 'There’s already a team called Data',
      'db.system': 'mysql', 'app.slow': 'yes',
    });
    expect(out).toEqual({ 'http.route': '/goals/:goalId', 'url.path': '/goals', 'user.id': 'maya', 'app.count': 3.142 });
  });

  it('takes quoted words and numbers out of error messages and stacks', () => {
    expect(redact('Cannot parse “Signed off by legal” as 42.5 or \'x\'')).toBe('Cannot parse … as # or …');
    expect(stackOf('Error: "secret"\n    at post (https://app/assets/index-abc.js?v=1:12:34)\n    at go (https://app/assets/x.js:1:2)')).toBe('at post (https://app/assets/index-abc.js:12:34)\nat go (https://app/assets/x.js:1:2)');
  });

  it('caps how much one record carries', () => {
    const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [['exception.message', 'exception.stacktrace', 'url.path'][i % 3]!, 'x'.repeat(300)]));
    expect(JSON.stringify(sanitise(many)).length).toBeLessThanOrEqual(4096);
  });
});

describe('errors', () => {
  it('tells a rule saying no from a save that didn’t get through, without using the message', () => {
    expect(errorType(new NotAllowed('There’s already a team called Data.'))).toBe('not_allowed');
    expect(errorType(new Error('stale: goal g1'))).toBe('stale');
    expect(errorType(new DOMException('The database did not answer in time.', 'AbortError'))).toBe('timeout');
    expect(errorType(new TypeError('Failed to fetch'))).toBe('network');
    expect(errorType(new Error('Saving: violates check constraint'))).toBe('database');
  });
});

describe('the exporter', () => {
  it('holds records until the workspace’s switch is known, then sends them in one batch per table', async () => {
    const { tel, exporter, net } = setup();
    tel.span('page /', {}).end();
    tel.log('INFO', 'hello');
    await exporter.flush();
    expect(net.sent).toEqual([]);
    exporter.setRecording(true);
    await exporter.flush();
    expect(net.sent.map((s) => [s.url, s.body.length])).toEqual([['https://db.example/rest/v1/okr_telemetry_spans', 1], ['https://db.example/rest/v1/okr_telemetry_logs', 1]]);
    expect(net.sent[0]!.headers).toMatchObject({ apikey: 'sb_publishable_x', Prefer: 'return=minimal' });
    expect(net.sent[0]!.headers.Authorization).toBeUndefined();
  });

  it('sends nothing at all once recording is off, and drops what was waiting', async () => {
    const { tel, exporter, net } = setup();
    tel.span('page /', {}).end();
    exporter.setRecording(false);
    tel.span('page /goals', {}).end();
    await exporter.flush(true);
    expect(net.sent).toEqual([]);
    expect(exporter.pending).toBe(0);
  });

  it('stops for the visit after a refusal (the tables aren’t there), without retrying', async () => {
    const { tel, exporter, net } = setup(404);
    exporter.setRecording(true);
    tel.span('a', {}).end();
    await exporter.flush();
    tel.span('b', {}).end();
    await exporter.flush();
    expect(net.sent.length).toBe(1);
    expect(exporter.enabled).toBe(false);
  });

  it('backs off after a network fault and gives up after three', async () => {
    let t = 0;
    let calls = 0;
    const exporter = new Exporter(TARGET, { fetch: (async () => { calls++; throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch, now: () => t, setTimer: () => 1, clearTimer: () => undefined });
    const tel = new Telemetry({ sessionId: 'c'.repeat(32), exporter, resource: { 'service.name': 'goals-app' } });
    exporter.setRecording(true);
    for (let i = 0; i < 10; i++) { tel.span('x', {}).end(); await exporter.flush(); t += 1000; }
    expect(calls).toBe(1);
    for (let i = 0; i < 10; i++) { t += 10 * 60_000; tel.span('x', {}).end(); await exporter.flush(); }
    expect(calls).toBe(3);
    expect(exporter.enabled).toBe(false);
  });

  it('uses keepalive and stays under its budget when the page is closing', async () => {
    const { tel, exporter, net } = setup();
    exporter.setRecording(true);
    for (let i = 0; i < 400; i++) tel.span('page /goals/:goalId', { attributes: { 'url.path': '/goals/' + 'g'.repeat(150) } }).end();
    await exporter.flush(true);
    expect(net.sent[0]!.keepalive).toBe(true);
    expect(JSON.stringify(net.sent[0]!.body).length).toBeLessThanOrEqual(60_000);
  });

  it('has no target without a database', () => {
    expect(supabaseTarget(undefined, 'k')).toBeNull();
    expect(supabaseTarget('https://x.supabase.co/', 'k')).toEqual({ url: 'https://x.supabase.co', key: 'k' });
    const e = new Exporter(null);
    expect(e.enabled).toBe(false);
  });
});

describe('traces', () => {
  it('makes one trace per action: the action, its save as a CLIENT span, its flow step and the page showing the result', async () => {
    const { tel, exporter, spans, paint } = setup();
    tel.setContext({ workspaceId: 'example', userId: 'maya', store: 'supabase', recording: true });
    const store = tracedStore(Object.assign(new BrowserStore(() => new Date('2026-10-30T12:00:00Z')), { kind: 'supabase' as const }), tel);
    tel.page('/check-in/alerts', '', 'push').end();
    tel.mark('checkIn.account');
    await tel.action('postCheckIn', async () => { await store.commit('platform-org', { changes: [] }); });
    paint();
    await exporter.flush();
    const all = spans();
    for (const s of all) expect(spanProblems(s), s.name).toEqual([]);
    const action = all.find((s) => s.name === 'postCheckIn')!;
    expect(action).toMatchObject({ parent_span_id: null, status_code: 'OK', workspace_id: 'example', session_id: 'c'.repeat(32) });
    const trace = all.filter((s) => s.trace_id === action.trace_id);
    expect(trace.map((s) => s.name).sort()).toEqual(['flow.finish', 'okr_commit', 'page /check-in/:goalId', 'postCheckIn']);
    const rpc = trace.find((s) => s.name === 'okr_commit')!;
    expect(rpc).toMatchObject({ kind: 'CLIENT', parent_span_id: action.span_id, attributes: { 'db.system': 'postgresql', 'db.operation': 'okr_commit' } });
    expect(trace.find((s) => s.name === 'flow.finish')!.attributes).toMatchObject({ 'app.flow.name': 'check-in', 'app.flow.step': 'post', 'app.flow.step.index': 3, 'app.flow.step.count': 3 });
    expect(trace.find((s) => s.name.startsWith('page'))!.attributes['app.navigation.type']).toBe('result');
    // The page opened earlier is its own trace, with the flow's start and step in it.
    const page = all.find((s) => s.name === 'page /check-in/:goalId' && s.attributes['app.navigation.type'] === 'push')!;
    expect(page.trace_id).not.toBe(action.trace_id);
    expect(all.filter((s) => s.trace_id === page.trace_id).map((s) => s.name).sort()).toEqual(['flow.start', 'flow.step', 'page /check-in/:goalId']);
  });

  it('records a refused save as a warning and a failed one as an error, with only the class of failure', async () => {
    const { tel, exporter, logs, spans } = setup();
    exporter.setRecording(true);
    expect(() => tel.action('saveTeam', () => { throw new NotAllowed('There’s already a team called Data.'); })).toThrow();
    await expect(tel.action('addNote', async () => { throw new TypeError('Failed to fetch'); })).rejects.toThrow();
    await exporter.flush();
    const l = logs();
    for (const x of l) expect(logProblems(x)).toEqual([]);
    expect(l.map((x) => [x.body, x.severity_text, x.attributes['error.type']])).toEqual([['save.refused', 'WARN', 'not_allowed'], ['save.failed', 'ERROR', 'network']]);
    expect(JSON.stringify([l, spans()])).not.toContain('Data');
    expect(spans().find((s) => s.name === 'saveTeam')).toMatchObject({ status_code: 'ERROR', status_message: 'not_allowed' });
  });

  it('records an uncaught error by class, with its message redacted, once', async () => {
    const { tel, exporter, logs } = setup();
    exporter.setRecording(true);
    const e = new TypeError('Cannot read “Q3 launch plan” of 1234');
    tel.exception(e, 'window');
    tel.exception(e, 'window');
    await exporter.flush();
    expect(logs()).toHaveLength(1);
    expect(logs()[0]!.attributes).toMatchObject({ 'exception.type': 'TypeError', 'exception.message': 'Cannot read … of #', 'app.error.source': 'window' });
  });

  it('keeps the last 20 steps of the session in memory', () => {
    const { tel } = setup();
    for (let i = 0; i < 30; i++) tel.page(i % 2 ? '/goals' : '/', '', 'push').end();
    tel.mark('respond.open');
    const steps = tel.recentSteps();
    expect(steps).toHaveLength(20);
    expect(steps.at(-1)).toMatchObject({ kind: 'flow', name: 'start', flow: 'answer-request' });
  });

  it('builds nothing to send when there is nowhere to send it', () => {
    const exporter = new Exporter(null);
    const tel = new Telemetry({ sessionId: 'c'.repeat(32), exporter });
    tel.setContext({ recording: true });
    expect(tel.action('setViewer', () => 1)).toBe(1);
    expect(exporter.pending).toBe(0);
  });
});
