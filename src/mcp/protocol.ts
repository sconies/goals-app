/* The Model Context Protocol over HTTP, stateless: each POST carries JSON-RPC messages and gets JSON back.
   Implements what a tools-only server needs: initialize, ping, tools/list and tools/call. */
import { callTool, TOOLS, type McpContext, type ToolResult } from './tools';

/** Wraps each tool call, for the server's own telemetry: the context loading and the tool itself, in one span. */
export type TraceTool = (tool: string, run: () => Promise<ToolResult>) => Promise<ToolResult>;

/** The name stays 'goals' (assistants already have it saved); the title is the product's. */
export const SERVER_INFO = { name: 'goals', title: 'Faro', version: '1.0.0' };
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'Faro: goals and weekly check-ins for one workspace, acting as the person whose token this is. Start with get_overview or find_goals. Writes follow the app’s rules and are logged as that person; use dry_run (or bulk_change without apply) to check first. Weeks count from the cycle start.';

interface Rpc { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }
type Reply = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: Rpc['id'], result: unknown): Reply => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Rpc['id'], code: number, message: string): Reply => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message. Notifications (no id) get no reply. The context loads only when a tool runs. */
export async function handle(msg: unknown, context: () => Promise<McpContext>, trace?: TraceTool): Promise<Reply | null> {
  const m = msg as Rpc;
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return fail((m as Rpc)?.id ?? null, -32600, 'Invalid request');
  const isNote = m.id === undefined;
  switch (m.method) {
    case 'initialize': {
      const asked = String(m.params?.protocolVersion ?? '');
      return ok(m.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return isNote ? null : ok(m.id, {});
    case 'tools/list':
      return ok(m.id, { tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } })) });
    case 'tools/call': {
      const name = String(m.params?.name ?? '');
      if (!TOOLS.some((t) => t.name === name)) return fail(m.id, -32602, `Unknown tool: ${name}`);
      const run = async () => callTool(name, (m.params?.arguments ?? {}) as Record<string, unknown>, await context());
      const r = trace ? await trace(name, run) : await run();
      return ok(m.id, {
        content: [{ type: 'text', text: r.text }],
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
export async function handleBody(body: unknown, context: () => Promise<McpContext>, trace?: TraceTool): Promise<Reply | Reply[] | null> {
  if (Array.isArray(body)) {
    // One at a time, in order: a later call in the batch sees what an earlier one saved.
    const out: Reply[] = [];
    for (const m of body) { const r = await handle(m, context, trace); if (r) out.push(r); }
    return out.length ? out : null;
  }
  return handle(body, context, trace);
}

export { hashToken, newToken } from './token';
