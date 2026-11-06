/* The MCP endpoint: checks the personal token, loads that person's workspace and runs the tools as them.
   Data access is passed in, so the same code runs on Vercel (Supabase) and in tests (in memory).
   Each tool call is recorded as a SERVER span (src/telemetry/server.ts), joined to the caller's trace when the request
   carries a W3C traceparent header, with CLIENT spans for the database work inside it. They're sent at the end of the
   request, only when the workspace records, and a failure to send never changes the answer. */
import type { Commit } from '../src/data/store';
import { applyCommit, EXAMPLE, newId, withExpectations } from '../src/data/store';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { currentWeek } from '../src/domain/plan';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { handleBody, hashToken, newToken, type TraceTool } from '../src/mcp/protocol';
import { errorType } from '../src/telemetry/errors';
import { parseTraceparent, type SpanContext } from '../src/telemetry/ids';
import type { SpanRow } from '../src/telemetry/model';
import { SpanCollector } from '../src/telemetry/server';
import type { McpContext } from '../src/mcp/tools';
import type { MarkupOps } from '../src/markup/ops';

export interface Deps {
  /** The live (not revoked) token with this hash, its workspace, and whether it's a builder token (migration 0024). */
  findToken(hash: string): Promise<{ token: ApiToken; workspaceId: string; builder?: boolean } | null>;
  workspaceName(id: string): Promise<string>;
  load(workspaceId: string): Promise<Snapshot>;
  commit(workspaceId: string, c: Commit): Promise<void>;
  touch(tokenId: string, at: string): Promise<void>;
  /** Saves a new token and returns its secret, made and hashed by the database (migration 0024). Without it, the
      secret is made here and the token saved, with its hash, like any other change. */
  issueToken?(workspaceId: string, c: Commit): Promise<string>;
  /** Deletes a workspace and everything in it (an admin's delete_workspace). */
  deleteWorkspace?(workspaceId: string): Promise<void>;
  /** Whether the workspace records how it is used (migration 0022). Unknown counts as on. */
  recording?(workspaceId: string): Promise<boolean>;
  /** The builder inbox (src/markup/ops.ts) for a builder token, given its hash. Only builder tokens get it. */
  markups?(tokenHash: string): MarkupOps;
  /** Where the server's own spans go. Without it, nothing is recorded. */
  telemetry?(spans: SpanRow[]): Promise<void>;
  now?: () => Date;
}

/** The longest the end of a request waits for its spans to be stored. */
const TELEMETRY_WAIT_MS = 1500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, traceparent, tracestate',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra } });
const rpcError = (status: number, message: string, extra: Record<string, string> = {}) => json({ jsonrpc: '2.0', id: null, error: { code: -32001, message } }, status, extra);

export async function serve(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return rpcError(405, 'This MCP server answers POST requests only (no event stream).', { Allow: 'POST, OPTIONS' });

  // The token: an Authorization header, or ?token= for assistants that only take a URL.
  const auth = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1] ?? new URL(req.url).searchParams.get('token') ?? '';
  if (!token) return rpcError(401, 'Add your personal token: Authorization: Bearer gk_… An admin makes one under Workspace → AI assistants.', { 'WWW-Authenticate': 'Bearer' });
  const hash = await hashToken(token);
  const found = await deps.findToken(hash);
  if (!found) return rpcError(401, 'That token isn’t valid or has been revoked. Ask an admin for a new one.', { 'WWW-Authenticate': 'Bearer error="invalid_token"' });

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
  const context = async (): Promise<McpContext> => {
    if (ctx) return ctx;
    const [loaded, name, recording] = await Promise.all([
      db('select', () => deps.load(found.workspaceId)), deps.workspaceName(found.workspaceId),
      deps.recording ? deps.recording(found.workspaceId).catch(() => true) : Promise.resolve(true),
    ]);
    let all = loaded;
    const cycle = currentCycle(all.cycles, now);
    if (!cycle) throw new Error('This workspace has no cycle yet.');
    const actor = all.people.find((p) => p.id === found.token.personId);
    if (!actor) throw new Error('The person this token belongs to is no longer in the workspace.');
    ctx = {
      ws: { id: found.workspaceId, name, kind: found.workspaceId === EXAMPLE.id ? 'example' : 'own', ...(recording === false ? { recording: false } : {}) }, snapshot: scopeToCycle(all, cycle), cycle, week: currentWeek(cycle, now), today: now, actor,
      now: now.toISOString(), newId, allGoals: all.goals,
      // Each save says what it was based on, and the context moves on with it, so later calls see it.
      save: async (c) => {
        await db('okr_commit', () => deps.commit(found.workspaceId, withExpectations(c, all)));
        all = applyCommit(all, c);
        ctx!.snapshot = scopeToCycle(all, cycle);
        ctx!.allGoals = all.goals;
        if (c.workspace) ctx!.ws = { ...ctx!.ws, name: c.workspace.name };
        if (c.recording !== undefined) ctx!.ws = { ...ctx!.ws, recording: c.recording };
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
        ctx!.snapshot = scopeToCycle(all, cycle);
        return secret;
      },
      ...(deps.deleteWorkspace ? { deleteWorkspace: () => deps.deleteWorkspace!(found.workspaceId) } : {}),
      // The markup tools work only with a builder token, which only a builder signed in to the inbox can make.
      ...(deps.markups && found.builder ? { markups: deps.markups(hash) } : {}),
    };
    return ctx;
  };

  let res: Response;
  try {
    const out = await handleBody(body, context, traceTool);
    await deps.touch(found.token.id, now.toISOString()).catch(() => undefined);
    res = out ? json(out) : new Response(null, { status: 202, headers: CORS });
  } catch (e) {
    res = json({ jsonrpc: '2.0', id: (body as { id?: unknown })?.id ?? null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }, 500);
  }
  await sendSpans(deps, spans.rows, found.workspaceId, ctx);
  return res;
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
