/* The MCP server's own spans: one SERVER span per tool call, joined to the caller's trace when the request carries a
   W3C traceparent header, with CLIENT spans inside it for the database reads and saves it makes. Collected while the
   request runs, then sent in one insert at the end, only when the workspace records. Same shape and allow-list as the
   browser's (model.ts, attributes.ts). */
import { WHATS_NEW } from '../help/whatsNew';
import { errorType } from './errors';
import { newSpanId, newTraceId, type SpanContext } from './ids';
import { spanRow, type SpanKind, type SpanRow, type StatusCode } from './model';

export const SERVER_RESOURCE = {
  'service.name': 'goals-mcp',
  'service.version': WHATS_NEW[0]?.id ?? 'unknown',
  'deployment.environment': 'live',
  'telemetry.sdk.name': 'goals-telemetry',
  'telemetry.sdk.language': 'nodejs',
} as const;

export interface ServerSpan extends SpanContext { end(o?: { status?: StatusCode; statusMessage?: string; attributes?: Record<string, unknown> }): void }

export class SpanCollector {
  readonly rows: SpanRow[] = [];
  constructor(private readonly common: Record<string, unknown> = {}, private readonly now: () => number = () => Date.now()) {}

  start(name: string, o: { kind?: SpanKind; parent?: SpanContext | null; attributes?: Record<string, unknown> } = {}): ServerSpan {
    const startMs = this.now();
    const traceId = o.parent?.traceId ?? newTraceId();
    const spanId = newSpanId();
    let ended = false;
    return {
      traceId, spanId,
      end: (e = {}) => {
        if (ended) return;
        ended = true;
        this.rows.push(spanRow({
          traceId, spanId, parentSpanId: o.parent?.spanId ?? null, name, kind: o.kind ?? 'INTERNAL', startMs, endMs: this.now(),
          status: e.status, statusMessage: e.statusMessage, attributes: { ...this.common, ...o.attributes, ...e.attributes }, resource: SERVER_RESOURCE,
        }));
      },
    };
  }

  /** Times a piece of work as a child span; a failure ends it with the failure's class, never its message. */
  async child<T>(name: string, parent: SpanContext | null, attributes: Record<string, unknown>, run: () => Promise<T>, kind: SpanKind = 'CLIENT'): Promise<T> {
    const s = this.start(name, { kind, parent, attributes });
    try {
      const v = await run();
      s.end({ status: 'OK' });
      return v;
    } catch (e) {
      const t = errorType(e);
      s.end({ status: 'ERROR', statusMessage: t, attributes: { 'error.type': t } });
      throw e;
    }
  }
}
