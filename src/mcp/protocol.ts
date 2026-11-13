/* The Model Context Protocol over HTTP, stateless: each POST carries JSON-RPC messages and gets JSON back.
   Implements initialize, ping, tools/list and tools/call, and one prompt (prompts/list, prompts/get): review_inbox,
   which an assistant such as Claude Code offers as a command, for anyone to triage the inbox in one step. */
import { callTool, TOOLS, type McpContext, type ToolResult } from './tools';
import { isStale, STALE_RERUNS } from '../ports/store';

/** The context a tool runs in. `fresh` loads the workspace again, as it is now: after a save refused as stale (AX6). */
export type McpContextOf = (fresh?: boolean) => Promise<McpContext>;
/** A tool whose save is refused as stale every time it runs again: said plainly, not as the store's error. */
export const STALE_TOOL = 'Someone else changed this a moment ago, so it wasn’t saved. Read it again (get_goal or get_review) and try again.';

/** Wraps each tool call, for the server's own telemetry: the context loading and the tool itself, in one span. */
export type TraceTool = (tool: string, run: () => Promise<ToolResult>) => Promise<ToolResult>;

/** The name stays 'goals' (assistants already have it saved); the title is the product's. */
export const SERVER_INFO = { name: 'goals', title: 'Faro', version: '1.0.0' };
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'Faro: goals and weekly check-ins for one workspace, acting as the person whose token this is. Start with get_overview or find_goals. Writes follow the app’s rules and are logged as that person, marked via MCP; use dry_run (or bulk_change without apply) to check first. Weeks count from the cycle start.';

/** The prompts: a ready-made request a person picks in their assistant. */
export const PROMPTS = [{
  name: 'review_inbox',
  title: 'Review Faro’s inbox',
  description: 'Look at everything new in the inbox (markups with their pictures, and feedback), grouped by screen part, and propose what to do with each.',
  text: 'Call the review_inbox tool. For each group of markups, look at its picture and say in a line what the person wants changed and where, then propose one of: in hand (and what to build), won’t fix (with the reason), or a duplicate of another. Do the same for the feedback. List your proposals as one batch and ask me before changing any status with update_markup or update_feedback.',
}];

interface Rpc { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }
type Reply = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: Rpc['id'], result: unknown): Reply => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Rpc['id'], code: number, message: string): Reply => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message. Notifications (no id) get no reply. The context loads only when a tool runs. */
export async function handle(msg: unknown, context: McpContextOf, trace?: TraceTool): Promise<Reply | null> {
  const m = msg as Rpc;
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return fail((m as Rpc)?.id ?? null, -32600, 'Invalid request');
  const isNote = m.id === undefined;
  switch (m.method) {
    case 'initialize': {
      const asked = String(m.params?.protocolVersion ?? '');
      return ok(m.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return isNote ? null : ok(m.id, {});
    case 'tools/list':
      return ok(m.id, { tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } })) });
    case 'prompts/list':
      return ok(m.id, { prompts: PROMPTS.map(({ name, title, description }) => ({ name, title, description, arguments: [] })) });
    case 'prompts/get': {
      const p = PROMPTS.find((x) => x.name === String(m.params?.name ?? ''));
      if (!p) return fail(m.id, -32602, `Unknown prompt: ${String(m.params?.name ?? '')}`);
      return ok(m.id, { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text } }] });
    }
    case 'tools/call': {
      const name = String(m.params?.name ?? '');
      if (!TOOLS.some((t) => t.name === name)) return fail(m.id, -32602, `Unknown tool: ${name}`);
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
      // A save refused as stale (someone else changed the same goal or review since this request loaded it) runs the tool
      // again on the workspace as it is now, as the app's dispatcher does (AX6): each tool is one action and one save,
      // and a refused save saved nothing. Only if every run is refused is the assistant told.
      const run = async () => {
        let r = await callTool(name, args, await context());
        for (let n = 0; n < STALE_RERUNS && r.isError && isStale(r.cause); n++) r = await callTool(name, args, await context(true));
        return r.isError && isStale(r.cause) ? { ...r, text: STALE_TOOL } : r;
      };
      const r = trace ? await trace(name, run) : await run();
      return ok(m.id, {
        content: [{ type: 'text', text: r.text }, ...(r.images ?? []).map((i) => ({ type: 'image', data: i.data, mimeType: i.mimeType }))],
        ...(r.data !== undefined && r.data !== null && typeof r.data === 'object' && !Array.isArray(r.data) ? { structuredContent: r.data } : {}),
        isError: !!r.isError,
      });
    }
    default:
      if (isNote || m.method.startsWith('notifications/')) return null;
      return fail(m.id, -32601, `Method not found: ${m.method}`);
  }
}

/** A POST body: one message or a batch. Returns the replies to send (null when there are none: answer 202). */
export async function handleBody(body: unknown, context: McpContextOf, trace?: TraceTool): Promise<Reply | Reply[] | null> {
  if (Array.isArray(body)) {
    // One at a time, in order: a later call in the batch sees what an earlier one saved.
    const out: Reply[] = [];
    for (const m of body) { const r = await handle(m, context, trace); if (r) out.push(r); }
    return out.length ? out : null;
  }
  return handle(body, context, trace);
}

export { hashToken, newToken } from './token';
