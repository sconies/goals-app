/* The MCP endpoint: checks the personal token, loads that person's workspace and runs the tools as them.
   Data access is passed in, so the same code runs on Vercel (Supabase) and in tests (in memory). */
import type { Commit } from '../src/data/store';
import { newId } from '../src/data/store';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { currentWeek } from '../src/domain/plan';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { handleBody, hashToken } from '../src/mcp/protocol';
import type { McpContext } from '../src/mcp/tools';

export interface Deps {
  /** The live (not revoked) token with this hash, and its workspace. */
  findToken(hash: string): Promise<{ token: ApiToken; workspaceId: string } | null>;
  workspaceName(id: string): Promise<string>;
  load(workspaceId: string): Promise<Snapshot>;
  commit(workspaceId: string, c: Commit): Promise<void>;
  touch(tokenId: string, at: string): Promise<void>;
  now?: () => Date;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version',
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
  const found = await deps.findToken(await hashToken(token));
  if (!found) return rpcError(401, 'That token isn’t valid or has been revoked. Ask an admin for a new one.', { 'WWW-Authenticate': 'Bearer error="invalid_token"' });

  let body: unknown;
  try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }

  const now = deps.now?.() ?? new Date();
  let ctx: McpContext | null = null;
  const context = async (): Promise<McpContext> => {
    if (ctx) return ctx;
    const [all, name] = await Promise.all([deps.load(found.workspaceId), deps.workspaceName(found.workspaceId)]);
    const cycle = currentCycle(all.cycles, now);
    if (!cycle) throw new Error('This workspace has no cycle yet.');
    const actor = all.people.find((p) => p.id === found.token.personId);
    if (!actor) throw new Error('The person this token belongs to is no longer in the workspace.');
    ctx = {
      ws: { id: found.workspaceId, name }, snapshot: scopeToCycle(all, cycle), cycle, week: currentWeek(cycle, now), today: now, actor,
      now: now.toISOString(), newId,
      save: (c) => deps.commit(found.workspaceId, c),
    };
    return ctx;
  };

  try {
    const out = await handleBody(body, context);
    await deps.touch(found.token.id, now.toISOString()).catch(() => undefined);
    return out ? json(out) : new Response(null, { status: 202, headers: CORS });
  } catch (e) {
    return json({ jsonrpc: '2.0', id: (body as { id?: unknown })?.id ?? null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }, 500);
  }
}
