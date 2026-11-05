/* Trace and span ids in OpenTelemetry's shape (W3C Trace Context): a trace id is 32 lowercase hex characters, a span
   id 16, and neither may be all zeros. `traceparent` carries both between the browser and the MCP server. */

export const TRACE_ID = /^(?!0{32})[0-9a-f]{32}$/;
export const SPAN_ID = /^(?!0{16})[0-9a-f]{16}$/;

function hex(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  // All zeros is invalid; the odds are tiny, but never send one.
  return /^0+$/.test(s) ? hex(bytes) : s;
}

export const newTraceId = () => hex(16);
export const newSpanId = () => hex(8);

export interface SpanContext { traceId: string; spanId: string }

/** A W3C `traceparent` header (version 00), or null when it's missing or malformed. */
export function parseTraceparent(header: string | null | undefined): SpanContext | null {
  const m = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec((header ?? '').trim().toLowerCase());
  if (!m || m[1] === 'ff') return null;
  const [, , traceId, spanId] = m;
  return TRACE_ID.test(traceId!) && SPAN_ID.test(spanId!) ? { traceId: traceId!, spanId: spanId! } : null;
}

/** The `traceparent` header for a span: version 00, sampled. */
export const traceparent = (c: SpanContext) => `00-${c.traceId}-${c.spanId}-01`;

/** This tab's session: the same id until the tab closes, a new one in a new tab. */
export function tabSessionId(): string {
  const KEY = 'goals-telemetry-session';
  try {
    const had = sessionStorage.getItem(KEY);
    if (had && /^[0-9a-f]{32}$/.test(had)) return had;
    const id = hex(16);
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return hex(16);
  }
}
