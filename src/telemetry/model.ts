/* Spans, logs and metrics as rows for the app's own tables (migration 0022), in OpenTelemetry's shape so they can be
   forwarded to a company's tool (Datadog, Grafana) later without rework: ids, parent, kind, start and end, status,
   attributes and resource for a span; timestamp, severity, body, attributes and the trace it belongs to for a log. */
import { sanitise, type Attrs } from './attributes';
import { SPAN_ID, TRACE_ID } from './ids';

export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
export type StatusCode = 'UNSET' | 'OK' | 'ERROR';
/** OpenTelemetry's severity numbers: the first of each band. */
export const SEVERITY = { DEBUG: 5, INFO: 9, WARN: 13, ERROR: 17, FATAL: 21 } as const;
export type Severity = keyof typeof SEVERITY;

export interface SpanRow {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  kind: SpanKind;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status_code: StatusCode;
  status_message: string | null;
  attributes: Attrs;
  resource: Attrs;
  workspace_id: string | null;
  session_id: string | null;
}

export interface LogRow {
  timestamp: string;
  observed_timestamp: string;
  severity_number: number;
  severity_text: Severity;
  body: string;
  attributes: Attrs;
  resource: Attrs;
  trace_id: string | null;
  span_id: string | null;
  workspace_id: string | null;
  session_id: string | null;
}

export interface MetricRow {
  timestamp: string;
  name: string;
  kind: 'gauge' | 'sum' | 'histogram';
  unit: string;
  value: number;
  attributes: Attrs;
  resource: Attrs;
  trace_id: string | null;
  span_id: string | null;
  workspace_id: string | null;
  session_id: string | null;
}

/** A name the code chose (a span's, a log's body, a metric's): never free text. */
export const RECORD_NAME = /^[A-Za-z][\w .:/*-]{0,119}$/;
const safeName = (n: string) => (RECORD_NAME.test(n) ? n : 'unnamed');
const iso = (ms: number) => new Date(ms).toISOString();
const ctx = (a: Attrs) => ({ workspace_id: typeof a['app.workspace.id'] === 'string' ? a['app.workspace.id'] : null, session_id: typeof a['session.id'] === 'string' ? a['session.id'] : null });

export function spanRow(s: {
  traceId: string; spanId: string; parentSpanId?: string | null; name: string; kind?: SpanKind; startMs: number; endMs: number;
  status?: StatusCode; statusMessage?: string | null; attributes?: Record<string, unknown>; resource?: Record<string, unknown>;
}): SpanRow {
  const attributes = sanitise(s.attributes);
  const end = Math.max(s.endMs, s.startMs);
  return {
    trace_id: s.traceId, span_id: s.spanId, parent_span_id: s.parentSpanId ?? null, name: safeName(s.name), kind: s.kind ?? 'INTERNAL',
    start_time: iso(s.startMs), end_time: iso(end), duration_ms: Math.round((end - s.startMs) * 1000) / 1000,
    status_code: s.status ?? 'UNSET', status_message: s.statusMessage && RECORD_NAME.test(s.statusMessage) ? s.statusMessage : null,
    attributes, resource: sanitise(s.resource), ...ctx(attributes),
  };
}

export function logRow(l: { atMs: number; severity: Severity; body: string; attributes?: Record<string, unknown>; resource?: Record<string, unknown>; traceId?: string | null; spanId?: string | null }): LogRow {
  const attributes = sanitise(l.attributes);
  return {
    timestamp: iso(l.atMs), observed_timestamp: iso(l.atMs), severity_number: SEVERITY[l.severity], severity_text: l.severity, body: safeName(l.body),
    attributes, resource: sanitise(l.resource), trace_id: l.traceId ?? null, span_id: l.spanId ?? null, ...ctx(attributes),
  };
}

export function metricRow(m: { atMs: number; name: string; kind?: MetricRow['kind']; unit?: string; value: number; attributes?: Record<string, unknown>; resource?: Record<string, unknown>; traceId?: string | null; spanId?: string | null }): MetricRow {
  const attributes = sanitise(m.attributes);
  return {
    timestamp: iso(m.atMs), name: safeName(m.name), kind: m.kind ?? 'gauge', unit: /^[\w/%{}.]{0,16}$/.test(m.unit ?? 'ms') ? m.unit ?? 'ms' : 'ms',
    value: Math.round(m.value * 1000) / 1000, attributes, resource: sanitise(m.resource), trace_id: m.traceId ?? null, span_id: m.spanId ?? null, ...ctx(attributes),
  };
}

/** What's wrong with a span row against OpenTelemetry's shape (empty: nothing). For the tests and evals. */
export function spanProblems(r: SpanRow): string[] {
  const p: string[] = [];
  if (!TRACE_ID.test(r.trace_id)) p.push('trace_id is not 32 hex');
  if (!SPAN_ID.test(r.span_id)) p.push('span_id is not 16 hex');
  if (r.parent_span_id !== null && !SPAN_ID.test(r.parent_span_id)) p.push('parent_span_id is not 16 hex');
  if (r.parent_span_id === r.span_id) p.push('a span is its own parent');
  if (!RECORD_NAME.test(r.name)) p.push('name');
  if (!['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'].includes(r.kind)) p.push('kind');
  if (!['UNSET', 'OK', 'ERROR'].includes(r.status_code)) p.push('status_code');
  if (Number.isNaN(Date.parse(r.start_time)) || Number.isNaN(Date.parse(r.end_time)) || r.end_time < r.start_time) p.push('times');
  if (!(r.duration_ms >= 0)) p.push('duration');
  if (typeof r.attributes !== 'object' || typeof r.resource !== 'object') p.push('attributes');
  if (!r.resource['service.name']) p.push('resource has no service.name');
  return p;
}

export function logProblems(r: LogRow): string[] {
  const p: string[] = [];
  if (!(r.severity_number >= 1 && r.severity_number <= 24)) p.push('severity_number');
  if (SEVERITY[r.severity_text] === undefined) p.push('severity_text');
  if (!RECORD_NAME.test(r.body)) p.push('body');
  if (r.trace_id !== null && !TRACE_ID.test(r.trace_id)) p.push('trace_id');
  if (r.span_id !== null && !SPAN_ID.test(r.span_id)) p.push('span_id');
  if (Number.isNaN(Date.parse(r.timestamp))) p.push('timestamp');
  if (!r.resource['service.name']) p.push('resource has no service.name');
  return p;
}
