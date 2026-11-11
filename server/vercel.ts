/* The Vercel function at /api/mcp. Built into api/mcp.js by `npm run build:mcp` (one self-contained file).
   What it reads and writes comes from its adapters: Supabase's today (src/adapters/supabase/server.ts). */
import { serve } from './mcp';
import { logFailure } from './log';
import { supabaseDeps } from '../src/adapters/supabase/server';

const handler = async (req: Request) => {
  try { return await serve(req, supabaseDeps(new URL(req.url).origin)); } catch (e) {
    const reference = logFailure('The MCP endpoint', e);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e instanceof Error ? e.message : String(e), data: { reference } } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
export const POST = handler;
export const GET = handler;
export const OPTIONS = handler;
export const DELETE = handler;
