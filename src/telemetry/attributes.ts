/* What a span, log or metric may carry: an allow-list, not a deny-list. Every attribute is checked against it when a
   record is built, and anything not on it is dropped, so nothing a person types (a note, a goal's title, a number they
   enter, a search) can reach the telemetry tables, even by mistake. Names follow OpenTelemetry's semantic conventions
   where one exists (http.route, url.path, error.type, session.id, user.id, service.name, db.system…); the app's own
   are under `app.`. */

export type AttrValue = string | number | boolean;
export type Attrs = Record<string, AttrValue>;

/** A name the code chose: an action, a route's parts, an error class. Letters, digits and a few separators. */
const NAME = /^[A-Za-z][\w.:/-]{0,79}$/;
/** An id the app generated (a person, a workspace, a goal). */
const ID = /^[\w.:-]{1,80}$/;
/** A route as App.tsx writes it, e.g. /goals/:goalId. */
const ROUTE = /^\/[\w\-/:*]{0,120}$/;
/** A path in the app, without its query or hash. */
const PATH = /^\/[\w\-./:~%]{0,200}$/;

type Rule = 'number' | 'boolean' | 'text' | 'stack' | RegExp | readonly string[];

export const ATTRIBUTES: Record<string, Rule> = {
  // Where it ran (the resource).
  'service.name': /^goals-[a-z]+$/,
  'service.version': ID,
  'deployment.environment': ['demo', 'live', 'test'],
  'telemetry.sdk.name': ['goals-telemetry'],
  'telemetry.sdk.language': ['webjs', 'nodejs'],
  'user_agent.original': /^[\w ./;:,()+\-_]{1,300}$/,
  // Who and where: ids the app made, never names.
  'session.id': /^[0-9a-f]{32}$/,
  'user.id': ID,
  'app.workspace.id': ID,
  'app.store': ['browser', 'supabase', 'postgres'],
  'app.viewport.width': 'number',
  'http.route': ROUTE,
  'url.path': PATH,
  'app.navigation.type': ['load', 'push', 'pop', 'replace', 'result'],
  // What happened.
  'app.action.name': NAME,
  'app.mark.name': NAME,
  'app.via': ['app', 'mcp'],
  'app.count': 'number',
  'app.save.outcome': ['saved', 'refused', 'stale', 'failed'],
  'app.slow': 'boolean',
  // Where people are in a flow (src/help/flows.ts).
  'app.flow.name': NAME,
  'app.flow.event': ['start', 'step', 'finish', 'stop'],
  'app.flow.step': NAME,
  'app.flow.step.index': 'number',
  'app.flow.step.count': 'number',
  'app.flow.duration_ms': 'number',
  'app.flow.stop.reason': ['left', 'closed'],
  // The database, timed from the client.
  'db.system': ['postgresql', 'browser'],
  'db.operation': NAME,
  // Errors: their class, and a message with anything quoted or numeric taken out.
  'error.type': NAME,
  'exception.type': NAME,
  'exception.message': 'text',
  'exception.stacktrace': 'stack',
  'app.error.source': ['window', 'promise', 'react', 'save'],
  // The MCP server.
  'mcp.method.name': NAME,
  'gen_ai.tool.name': NAME,
  'rpc.system': ['jsonrpc'],
  'http.request.method': ['GET', 'POST', 'OPTIONS', 'DELETE'],
  'http.response.status_code': 'number',
};

/** The most one record's attributes may weigh, as JSON; the database refuses more (migration 0022). */
export const MAX_ATTR_BYTES = 4096;

/**
 * Free text the code produced (an error's message) with anything that could be a person's own words or numbers taken
 * out: whatever is in quotes, and every number. What's left says what kind of thing went wrong.
 */
export function redact(text: string, max = 300): string {
  return text
    .replace(/“[^”]*”|"[^"]*"|‘[^’]*’|'[^']*'|`[^`]*`/g, '…')
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, max);
}

/** A stack trace as its frames only (functions, files, lines), redacted like a message. */
export function stackOf(stack: string, max = 1500): string {
  const frames = stack.split('\n').map((l) => l.trim()).filter((l) => /^at |@/.test(l)).slice(0, 12);
  return frames.map((f) => f.replace(/[?#].*?(?=:\d+:\d+\)?$)/, '').replace(/“[^”]*”|"[^"]*"|'[^']*'/g, '…')).join('\n').slice(0, max);
}

function clean(rule: Rule, v: unknown, key: string): AttrValue | undefined {
  if (rule === 'number') return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : undefined;
  if (rule === 'boolean') return typeof v === 'boolean' ? v : undefined;
  if (typeof v !== 'string') return undefined;
  if (rule === 'text') return redact(v);
  if (rule === 'stack') return stackOf(v);
  if (Array.isArray(rule)) return rule.includes(v) ? v : undefined;
  // A path keeps no query or hash: those can carry a search someone typed.
  const s = key === 'url.path' ? v.split(/[?#]/)[0]! : v;
  return (rule as RegExp).test(s) ? s : undefined;
}

/** Only the allowed attributes, each of the right type and shape. Everything else is dropped. */
export function sanitise(attrs: Record<string, unknown> | undefined): Attrs {
  const out: Attrs = {};
  if (!attrs) return out;
  let size = 2;
  for (const [k, v] of Object.entries(attrs)) {
    const rule = ATTRIBUTES[k];
    if (!rule) continue;
    const c = clean(rule, v, k);
    if (c === undefined) continue;
    const add = JSON.stringify(k).length + JSON.stringify(c).length + 2;
    if (size + add > MAX_ATTR_BYTES) continue;
    size += add;
    out[k] = c;
  }
  return out;
}
