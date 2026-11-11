/* Telemetry in the browser: one trace per thing a person does. A named action (a click or submit that reaches AppState)
   starts a trace; the save it makes is a CLIENT span inside it, timed from here; the page that shows the result, and
   any step it takes in a named flow, join the same trace. A page someone opens starts its own trace. Errors, failed
   saves and flow stops are logs in the trace they happened in; load timings are metrics.

   Recording is cheap on purpose: building a row and pushing it to a list. The exporter sends in batches, later.
   The last few steps of this tab's session, and its errors and failed saves, are kept in memory (recentSteps,
   recentProblems), never sent by themselves: a markup attaches them when its sender says so (src/markup). */
import { appRouteFor } from '../help/lookup';
import { redact, type Attrs } from './attributes';
import { errorType, exceptionType, saveOutcome } from './errors';
import { Exporter } from './exporter';
import { FlowTracker, type FlowEvent } from './flows';
import { newSpanId, newTraceId, type SpanContext } from './ids';
import { logRow, metricRow, spanRow, type Severity, type SpanKind, type StatusCode } from './model';

export interface ActiveSpan extends SpanContext {
  name: string;
  kind: SpanKind;
  parentSpanId: string | null;
  startMs: number;
  attributes: Record<string, unknown>;
  ended: boolean;
  end(o?: { status?: StatusCode; statusMessage?: string; attributes?: Record<string, unknown>; endMs?: number }): void;
}

/** One step of this tab's session, newest last: what a markup would say led up to it. */
export interface Step {
  at: string;
  kind: 'page' | 'action' | 'mark' | 'flow' | 'error';
  name: string;
  route?: string;
  ok?: boolean;
  flow?: string;
  step?: string;
}

/** An error or a save that didn't get through, on this visit: what a markup carries about what went wrong. */
export interface Problem {
  at: string;
  kind: 'exception' | 'save';
  /** The error's class (TypeError) or the save's failure (network, not_allowed, stale…). */
  type: string;
  route?: string;
  action?: string;
  /** An exception's message, with anything quoted or numeric taken out. */
  message?: string;
}

export interface TelemetryOptions {
  exporter?: Exporter;
  resource?: Record<string, unknown>;
  sessionId: string;
  now?: () => number;
  flows?: FlowTracker;
  /** Runs `fn` once the next frame has painted. */
  afterPaint?: (fn: () => void) => void;
}

const STEPS = 20;
const PROBLEMS = 25;
/** A page that opens this soon after an action ends is that action's result. */
const RESULT_MS = 1500;
const MAX_EXCEPTIONS = 25;

const clock = () => (typeof performance !== 'undefined' && performance.timeOrigin ? performance.timeOrigin + performance.now() : Date.now());
const paint = (fn: () => void) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 16);
};

export class Telemetry {
  readonly exporter: Exporter;
  readonly sessionId: string;
  private readonly resource: Record<string, unknown>;
  private readonly now: () => number;
  private readonly flows: FlowTracker;
  private readonly afterPaint: (fn: () => void) => void;
  private ctx: { workspaceId: string | null; userId: string | null; store: string | null } = { workspaceId: null, userId: null, store: null };
  /** Spans running synchronously right now (an action while its code runs, before its first await). */
  private stack: ActiveSpan[] = [];
  /** Actions still waiting for their save. */
  private open: ActiveSpan[] = [];
  private lastAction: { span: ActiveSpan; endedAt: number } | null = null;
  private lastPage: ActiveSpan | null = null;
  private route = '';
  private pageOf = new Set<string>();
  private steps: Step[] = [];
  private problems: Problem[] = [];
  private exceptions = 0;
  private lastException = '';

  constructor(o: TelemetryOptions) {
    this.exporter = o.exporter ?? new Exporter(null);
    this.sessionId = o.sessionId;
    this.resource = o.resource ?? {};
    this.now = o.now ?? clock;
    this.flows = o.flows ?? new FlowTracker();
    this.afterPaint = o.afterPaint ?? paint;
  }

  /** Who is using the app, in which workspace, and whether that workspace records (null: not known yet). */
  setContext(c: { workspaceId?: string | null; userId?: string | null; store?: string | null; recording?: boolean | null }) {
    if (c.workspaceId !== undefined) this.ctx.workspaceId = c.workspaceId;
    if (c.userId !== undefined) this.ctx.userId = c.userId;
    if (c.store !== undefined) this.ctx.store = c.store;
    if (c.recording !== undefined) this.exporter.setRecording(c.recording);
  }

  private common(): Record<string, unknown> {
    return { 'session.id': this.sessionId, ...(this.ctx.userId ? { 'user.id': this.ctx.userId } : {}), ...(this.ctx.workspaceId ? { 'app.workspace.id': this.ctx.workspaceId } : {}), ...(this.ctx.store ? { 'app.store': this.ctx.store } : {}) };
  }

  private remember(s: Omit<Step, 'at'>) {
    this.steps.push({ at: new Date(this.now()).toISOString(), ...s });
    if (this.steps.length > STEPS) this.steps.splice(0, this.steps.length - STEPS);
  }

  /** The last steps of this tab's session (at most 20), oldest first. In memory only. */
  recentSteps(): Step[] { return this.steps.map((s) => ({ ...s })); }

  private problem(p: Omit<Problem, 'at'>) {
    this.problems.push({ at: new Date(this.now()).toISOString(), ...p });
    if (this.problems.length > PROBLEMS) this.problems.splice(0, this.problems.length - PROBLEMS);
  }

  /** This visit's errors and failed saves (at most 25), oldest first. In memory only. */
  recentProblems(): Problem[] { return this.problems.map((p) => ({ ...p })); }

  /** Where flows are now: "check-in, step 2 of 3". */
  flowsNow() { return this.flows.current(); }

  /** The span new work belongs under: running code, an action still saving, an action that just ended, or the page. */
  parent(): SpanContext | null {
    const recent = this.lastAction && this.now() - this.lastAction.endedAt < RESULT_MS ? this.lastAction.span : null;
    return this.stack.at(-1) ?? this.open.at(-1) ?? recent ?? this.lastPage;
  }

  /** Starts a span. With no parent it starts a new trace. */
  span(name: string, o: { kind?: SpanKind; parent?: SpanContext | null; attributes?: Record<string, unknown>; startMs?: number } = {}): ActiveSpan {
    const parent = o.parent ?? null;
    const self = this;
    const s: ActiveSpan = {
      traceId: parent?.traceId ?? newTraceId(), spanId: newSpanId(), parentSpanId: parent?.spanId ?? null,
      name, kind: o.kind ?? 'INTERNAL', startMs: o.startMs ?? this.now(), attributes: { ...o.attributes }, ended: false,
      end(e = {}) {
        if (s.ended) return;
        s.ended = true;
        if (!self.exporter.enabled) return;
        self.exporter.push('spans', spanRow({
          traceId: s.traceId, spanId: s.spanId, parentSpanId: s.parentSpanId, name: s.name, kind: s.kind, startMs: s.startMs, endMs: e.endMs ?? self.now(),
          status: e.status, statusMessage: e.statusMessage, attributes: { ...self.common(), ...s.attributes, ...e.attributes }, resource: self.resource,
        }));
      },
    };
    return s;
  }

  /** Runs a named action (an AppState method) as the root of its own trace, and records how it went. */
  action<T>(name: string, fn: () => T): T {
    const span = this.span(name, { parent: this.stack.at(-1) ?? null, attributes: { 'app.action.name': name, 'app.via': 'app', ...(this.route ? { 'http.route': this.route } : {}) } });
    this.flows.actionStarted();
    this.open.push(span);
    this.stack.push(span);
    let out: T;
    try {
      out = fn();
    } catch (e) {
      this.stack.pop();
      this.endAction(span, e, false);
      throw e;
    }
    this.stack.pop();
    if (out && typeof (out as { then?: unknown }).then === 'function') {
      return (out as unknown as Promise<unknown>).then(
        (v) => { this.endAction(span, null, true); return v; },
        (e: unknown) => { this.endAction(span, e, true); throw e; },
      ) as T;
    }
    this.endAction(span, null, false);
    return out;
  }

  private endAction(span: ActiveSpan, err: unknown, async: boolean) {
    this.open = this.open.filter((x) => x !== span);
    const ok = !err;
    if (err) {
      const t = errorType(err);
      this.problem({ kind: 'save', type: t, action: span.name, ...(this.route ? { route: this.route } : {}) });
      span.end({ status: 'ERROR', statusMessage: t, attributes: { 'error.type': t, 'app.save.outcome': saveOutcome(t) } });
      this.log(t === 'not_allowed' || t === 'stale' ? 'WARN' : 'ERROR', t === 'not_allowed' ? 'save.refused' : t === 'stale' ? 'save.stale' : 'save.failed',
        { 'error.type': t, 'app.action.name': span.name, 'app.error.source': 'save', 'app.save.outcome': saveOutcome(t) }, span);
    } else {
      span.end({ status: 'OK' });
    }
    this.lastAction = { span, endedAt: this.now() };
    this.remember({ kind: 'action', name: span.name, ok, route: this.route });
    this.flowEvents(this.flows.actionEnded(span.name, ok), span);
    // The page showing the result joins the trace: a page it opened already did; otherwise the redraw of this one.
    if (async && this.route) {
      const endedAt = this.now();
      this.afterPaint(() => {
        if (this.pageOf.has(span.spanId)) return;
        this.span(`page ${this.route}`, { parent: span, startMs: endedAt, attributes: { 'http.route': this.route, 'app.navigation.type': 'result' } }).end();
      });
    }
  }

  /** The page changed. Returns its span, which the caller ends once the page has painted. */
  page(pathname: string, search: string, navType: 'load' | 'push' | 'pop' | 'replace', startMs?: number): ActiveSpan {
    const route = appRouteFor(pathname) ?? '/*';
    this.route = route;
    const recent = this.lastAction && this.now() - this.lastAction.endedAt < RESULT_MS ? this.lastAction.span : null;
    const cause = this.open.at(-1) ?? recent;
    if (cause) this.pageOf.add(cause.spanId);
    const span = this.span(`page ${route}`, {
      parent: cause, startMs,
      attributes: { 'http.route': route, 'url.path': pathname, 'app.navigation.type': navType, ...(typeof innerWidth === 'number' ? { 'app.viewport.width': innerWidth } : {}) },
    });
    this.lastPage = span;
    this.remember({ kind: 'page', name: route, route });
    this.flowEvents(this.flows.route(pathname, search), span);
    return span;
  }

  /** A screen moved to a step of its own (src/help/flows.ts MARKS). */
  mark(name: string) {
    this.remember({ kind: 'mark', name, route: this.route });
    const ev = this.flows.mark(name);
    if (ev.length) this.flowEvents(ev, this.parent());
  }

  /** The page is closing: flows still open stop where they got to, and what's waiting is sent. */
  leave() {
    this.flowEvents(this.flows.leave(), this.parent());
    void this.exporter.flush(true);
  }

  private flowEvents(events: FlowEvent[], parent: SpanContext | null) {
    for (const e of events) {
      this.remember({ kind: 'flow', name: e.event, flow: e.flow, step: e.step, route: this.route });
      this.span(`flow.${e.event}`, {
        parent,
        attributes: {
          'app.flow.name': e.flow, 'app.flow.event': e.event, 'app.flow.step': e.step, 'app.flow.step.index': e.index, 'app.flow.step.count': e.count,
          ...(e.event === 'finish' || e.event === 'stop' ? { 'app.flow.duration_ms': e.durationMs } : {}), ...(e.reason ? { 'app.flow.stop.reason': e.reason } : {}),
          ...(this.route ? { 'http.route': this.route } : {}),
        },
      }).end();
    }
  }

  log(severity: Severity, body: string, attributes: Record<string, unknown> = {}, span: SpanContext | null = this.parent()) {
    if (!this.exporter.enabled) return;
    this.exporter.push('logs', logRow({ atMs: this.now(), severity, body, attributes: { ...this.common(), ...(this.route ? { 'http.route': this.route } : {}), ...attributes }, resource: this.resource, traceId: span?.traceId, spanId: span?.spanId }));
  }

  /** An error nobody caught. Its class and where it was; the message only with anything quoted or numeric taken out. */
  exception(e: unknown, source: 'window' | 'promise' | 'react') {
    const type = exceptionType(e);
    const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
    const key = type + message;
    if (this.exceptions >= MAX_EXCEPTIONS || key === this.lastException) return;
    this.exceptions++;
    this.lastException = key;
    this.remember({ kind: 'error', name: type, route: this.route });
    this.problem({ kind: 'exception', type, ...(this.route ? { route: this.route } : {}), ...(message ? { message: redact(message, 200) } : {}) });
    this.log('ERROR', 'exception', { 'exception.type': type, 'exception.message': message, ...(e instanceof Error && e.stack ? { 'exception.stacktrace': e.stack } : {}), 'error.type': type, 'app.error.source': source });
  }

  metric(name: string, value: number, unit = 'ms', attributes: Record<string, unknown> = {}) {
    if (!this.exporter.enabled || !Number.isFinite(value)) return;
    const p = this.parent();
    this.exporter.push('metrics', metricRow({ atMs: this.now(), name, unit, value, attributes: { ...this.common(), ...(this.route ? { 'http.route': this.route } : {}), ...attributes }, resource: this.resource, traceId: p?.traceId, spanId: p?.spanId }));
  }

  flush(final = false) { return this.exporter.flush(final); }

  /** For the tests. */
  get attrs(): Attrs { return this.common() as Attrs; }
}
