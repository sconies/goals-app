/* The MCP endpoint: checks the personal token, loads that person's workspace and runs the tools as them.
   Data access is passed in, so the same code runs on Vercel (Supabase) and in tests (in memory).
   Each tool call is recorded as a SERVER span (src/telemetry/server.ts), joined to the caller's trace when the request
   carries a W3C traceparent header, with CLIENT spans for the database work inside it. They're sent at the end of the
   request, only when the workspace records, and a failure to send never changes the answer. */
import type { HistoryAsk, HistoryPage } from '../src/ports/store';
import { logFailure } from './log';
import type { Commit } from '../src/data/store';
import { applyCommit, EXAMPLE, newId, withExpectations } from '../src/data/store';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { withRecarry } from '../src/domain/recarry';
import { MODULE_RECORDS } from '../src/core/records';
import { currentWeek } from '../src/domain/plan';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { handleBody, hashToken, newToken, type TraceTool } from '../src/mcp/protocol';
import { errorType } from '../src/telemetry/errors';
import { parseTraceparent, type SpanContext } from '../src/telemetry/ids';
import type { SpanRow } from '../src/telemetry/model';
import { SpanCollector } from '../src/telemetry/server';
import type { McpContext } from '../src/mcp/tools';
import { PICTURES_UNREADABLE, pictureType, type MarkupOps } from '../src/markup/ops';
import type { FeedbackOps } from '../src/markup/feedback';

export interface Deps {
  /** The live (not revoked) token with this hash, and its workspace. */
  findToken(hash: string): Promise<{ token: ApiToken; workspaceId: string } | null>;
  workspaceName(id: string): Promise<string>;
  load(workspaceId: string): Promise<Snapshot>;
  commit(workspaceId: string, c: Commit): Promise<void>;
  /** Older change-log entries a page at a time, newest first (Store.history): get_activity pages with it. */
  history?(workspaceId: string, ask: HistoryAsk): Promise<HistoryPage>;
  /** The keys the database settled for these goals (migration 0021 gives a new goal the next free key when the one the
      save asked for was taken at the same moment). Read after a save, so an answer names the key the goal holds (#242's
      review). Without it, the key the save asked for stands. */
  goalKeys?(workspaceId: string, goalIds: string[]): Promise<Record<string, string>>;
  touch(tokenId: string, at: string): Promise<void>;
  /** Saves a new token and returns its secret, made and hashed by the database (migration 0024). Without it, the
      secret is made here and the token saved, with its hash, like any other change. */
  issueToken?(workspaceId: string, c: Commit): Promise<string>;
  /** Deletes a workspace and everything in it (an admin's delete_workspace). */
  deleteWorkspace?(workspaceId: string): Promise<void>;
  /** Whether the workspace records how it is used (migration 0022). Unknown counts as on. */
  recording?(workspaceId: string): Promise<boolean>;
  /** The feature modules switched off in the workspace (migration 0030). Unknown counts as none. */
  modulesOff?(workspaceId: string): Promise<string[]>;
  /** The open inbox's markups (src/markup/ops.ts) for a token, given its hash. Any live token gets it (backlog O). */
  markups?(tokenHash: string): MarkupOps;
  /** The open inbox's feedback triage (src/markup/feedback.ts) for a token, given its hash. Any live token gets it. */
  feedback?(tokenHash: string): FeedbackOps;
  /** What the server can do, for the check after each deploy (GET /api/mcp?check): whether it reaches the database,
      and whether markup pictures can be read (the markups bucket is open to read, migration 0031). */
  check?(): Promise<ServerCheck>;
  /** Where the server's own spans go. Without it, nothing is recorded. */
  telemetry?(spans: SpanRow[]): Promise<void>;
  now?: () => Date;
}

/** What GET /api/mcp?check answers: ok only when everything works. `problems` says, plainly, what to fix where. */
export interface ServerCheck { ok: boolean; database: boolean; pictures: boolean; problems: string[] }

/** The longest the end of a request waits for its spans to be stored. */
const TELEMETRY_WAIT_MS = 1500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, traceparent, tracestate',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra } });
const rpcError = (status: number, message: string, extra: Record<string, string> = {}) => json({ jsonrpc: '2.0', id: null, error: { code: -32001, message } }, status, extra);

export async function serve(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const params = new URL(req.url).searchParams;
  // The check after each deploy: no token needed, and it says only what works, never a secret.
  if (req.method === 'GET' && params.has('check')) {
    const c = deps.check ? await deps.check().catch((e: unknown): ServerCheck => ({ ok: false, database: false, pictures: false, problems: [e instanceof Error ? e.message : String(e)] })) : { ok: false, database: false, pictures: false, problems: ['This server can’t check itself.'] };
    return json(c, c.ok ? 200 : 503);
  }
  const picture = req.method === 'GET' ? params.get('picture') : null;
  if (req.method !== 'POST' && picture === null) return rpcError(405, 'This MCP server answers POST requests only (no event stream).', { Allow: 'GET, POST, OPTIONS' });

  // The token: an Authorization header, or ?token= for assistants that only take a URL.
  const auth = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1] ?? params.get('token') ?? '';
  if (!token) return rpcError(401, 'Add your personal token: Authorization: Bearer gk_… An admin makes one under Workspace → Access → MCP access.', { 'WWW-Authenticate': 'Bearer' });
  const hash = await hashToken(token);
  const found = await deps.findToken(hash);
  if (!found) return rpcError(401, 'That token isn’t valid or has been revoked. Ask an admin for a new one.', { 'WWW-Authenticate': 'Bearer error="invalid_token"' });
  if (picture !== null) return pictureResponse(picture, deps.markups?.(hash));

  let body: unknown;
  try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }

  const now = deps.now?.() ?? new Date();
  // The caller's trace, when it sent one; otherwise each tool call starts its own.
  const incoming = parseTraceparent(req.headers.get('traceparent'));
  const spans = new SpanCollector({ 'user.id': found.token.personId, 'app.workspace.id': found.workspaceId, 'app.via': 'mcp' });
  let current: SpanContext | null = null;
  const traceTool: TraceTool = async (tool, run) => {
    const span = spans.start(`tools/call ${tool}`, { kind: 'SERVER', parent: incoming, attributes: { 'mcp.method.name': 'tools/call', 'gen_ai.tool.name': tool, 'rpc.system': 'jsonrpc', 'http.request.method': 'POST' } });
    current = span;
    try {
      const r = await run();
      const t = r.isError ? (r.cause !== undefined ? errorType(r.cause) : 'tool_error') : null;
      span.end(t ? { status: 'ERROR', statusMessage: t, attributes: { 'error.type': t } } : { status: 'OK' });
      return r;
    } catch (e) {
      const t = errorType(e);
      span.end({ status: 'ERROR', statusMessage: t, attributes: { 'error.type': t } });
      throw e;
    } finally {
      current = null;
    }
  };
  const db = <T,>(op: string, run: () => Promise<T>) => spans.child(op, current, { 'db.system': 'postgresql', 'db.operation': op }, run);

  let ctx: McpContext | null = null;
  /** A commit with each new goal's key as the database stored it, so the context, and every answer read from it, holds
      the stored key, not the one the request asked for. */
  const settledKeys = async (c: Commit, before: Snapshot): Promise<Commit> => {
    const known = new Set(before.goals.map((g) => g.id));
    const added = (c.goals ?? []).filter((g) => !known.has(g.id)).map((g) => g.id);
    if (!added.length || !deps.goalKeys) return c;
    const keys = await db('select', () => deps.goalKeys!(found.workspaceId, added));
    return { ...c, goals: c.goals!.map((g) => (keys[g.id] && keys[g.id] !== g.key ? { ...g, key: keys[g.id]! } : g)) };
  };
  const context = async (): Promise<McpContext> => {
    if (ctx) return ctx;
    const [loaded, name, recording, modulesOff] = await Promise.all([
      db('select', () => deps.load(found.workspaceId)), deps.workspaceName(found.workspaceId),
      deps.recording ? deps.recording(found.workspaceId).catch(() => true) : Promise.resolve(true),
      deps.modulesOff ? deps.modulesOff(found.workspaceId).catch(() => []) : Promise.resolve([] as string[]),
    ]);
    let all = loaded;
    const cycle = currentCycle(all.cycles, now);
    if (!cycle) throw new Error('This workspace has no cycle yet.');
    const actor = all.people.find((p) => p.id === found.token.personId);
    // Someone marked as left (or deleted) no longer acts in the workspace, through the app or an assistant.
    if (!actor || actor.leftAt || actor.removedAt) throw new Error('The person this token belongs to is no longer in the workspace.');
    ctx = {
      ws: { id: found.workspaceId, name, kind: found.workspaceId === EXAMPLE.id ? 'example' : 'own', ...(recording === false ? { recording: false } : {}), ...(modulesOff.length ? { modulesOff } : {}) }, snapshot: scopeToCycle(all, cycle, MODULE_RECORDS), cycle, week: currentWeek(cycle, now), today: now, actor,
      now: now.toISOString(), newId, allGoals: all.goals, full: all,
      // Each save says what it was based on, and the context moves on with it, so later calls see it.
      save: async (given) => {
        // Every save keeps a carried copy in the next year true while nobody has used it (cycle-end rule 6).
        const c = withRecarry(all, given, { now: given.changes[0]?.at ?? new Date().toISOString(), actorId: given.changes[0]?.actorId ?? '', newId, records: MODULE_RECORDS });
        await db('okr_commit', () => deps.commit(found.workspaceId, withExpectations(c, all)));
        all = applyCommit(all, await settledKeys(c, all));
        ctx!.snapshot = scopeToCycle(all, cycle, MODULE_RECORDS);
        ctx!.allGoals = all.goals;
        ctx!.full = all;
        if (c.workspace) ctx!.ws = { ...ctx!.ws, name: c.workspace.name };
        if (c.recording !== undefined) ctx!.ws = { ...ctx!.ws, recording: c.recording };
        if (c.modulesOff !== undefined) ctx!.ws = { ...ctx!.ws, modulesOff: c.modulesOff };
      },
      issueToken: async (c) => {
        let saved = c;
        let secret: string;
        if (deps.issueToken) secret = await db('okr_token_create', () => deps.issueToken!(found.workspaceId, c));
        else {
          secret = newToken();
          const tokenHash = await hashToken(secret);
          saved = { ...c, tokens: (c.tokens ?? []).map((t) => ({ ...t, tokenHash })) };
          await db('okr_commit', () => deps.commit(found.workspaceId, saved));
        }
        all = applyCommit(all, saved);
        ctx!.snapshot = scopeToCycle(all, cycle, MODULE_RECORDS);
        ctx!.full = all;
        return secret;
      },
      ...(deps.history ? { history: (ask: HistoryAsk) => db('select', () => deps.history!(found.workspaceId, ask)) } : {}),
      ...(deps.deleteWorkspace ? { deleteWorkspace: () => deps.deleteWorkspace!(found.workspaceId) } : {}),
      // The inbox's tools work with any token: Faro's inbox is open on purpose (backlog O, migration 0031).
      ...(deps.markups ? { markups: deps.markups(hash) } : {}),
      ...(deps.feedback ? { feedback: deps.feedback(hash) } : {}),
    };
    return ctx;
  };

  let res: Response;
  try {
    const out = await handleBody(body, context, traceTool);
    await deps.touch(found.token.id, now.toISOString()).catch(() => undefined);
    res = out ? json(out) : new Response(null, { status: 202, headers: CORS });
  } catch (e) {
    const reference = logFailure('A request', e);
    res = json({ jsonrpc: '2.0', id: (body as { id?: unknown })?.id ?? null, error: { code: -32603, message: e instanceof Error ? e.message : String(e), data: { reference } } }, 500);
  }
  await sendSpans(deps, spans.rows, found.workspaceId, ctx);
  return res;
}

/** GET /api/mcp?picture=<markup id>/<picture name>, with any token: the picture itself, for an assistant that only
    fetches addresses. Plain words when the server has no inbox or pictures can't be read. */
async function pictureResponse(path: string, ops: MarkupOps | undefined): Promise<Response> {
  if (!ops) return rpcError(503, 'This server has no inbox to read pictures from.');
  const [id = '', name = ''] = path.split('/');
  try {
    const bytes = await ops.pictureFile(id, name);
    if (!bytes) return rpcError(404, `Markup ${id} has no picture ${name}.`);
    return new Response(bytes as BodyInit, { status: 200, headers: { 'Content-Type': pictureType(name), 'Cache-Control': 'private, max-age=600', ...CORS } });
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    return rpcError(text === PICTURES_UNREADABLE ? 503 : 404, text);
  }
}

/** Stores the request's spans when the workspace records (as it was at the end of the request: a call that turned
    recording off sends nothing). Never fails the request, and never holds it up for long. */
async function sendSpans(deps: Deps, rows: SpanRow[], workspaceId: string, ctx: McpContext | null) {
  if (!rows.length || !deps.telemetry) return;
  try {
    const on = ctx ? ctx.ws.recording !== false : deps.recording ? await deps.recording(workspaceId).catch(() => true) : true;
    if (!on) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([deps.telemetry(rows).catch(() => undefined), new Promise<void>((r) => { timer = setTimeout(r, TELEMETRY_WAIT_MS); })]);
    clearTimeout(timer);
  } catch { /* telemetry never changes the answer */ }
}
