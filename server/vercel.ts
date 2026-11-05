/* The Vercel function at /api/mcp. Built into api/mcp.js by `npm run build:mcp` (one self-contained file).
   It reads and writes Supabase with SUPABASE_SERVICE_ROLE_KEY when set, otherwise the app's public key, and records a
   span per tool call in the telemetry tables (migration 0022) when the workspace records. */
import { createClient } from '@supabase/supabase-js';
import { SupabaseStore } from '../src/data/supabaseStore';
import { tokenFromRow, type TokenRow } from '../src/data/rows';
import { serve, type Deps } from './mcp';

function deps(): Deps {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_KEY;
  if (!url || !key) throw new Error('The server has no database settings (SUPABASE_URL and a key).');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const store = new SupabaseStore(url, key, db);
  return {
    async findToken(hash) {
      const { data, error } = await db.from('okr_api_tokens').select('*').eq('token_hash', hash).is('revoked_at', null).maybeSingle();
      // A database fault is not a bad token: say so, rather than telling the person their token is wrong.
      if (error) throw new Error('The goals database didn’t answer. Try again in a moment.');
      if (!data) return null;
      const row = data as TokenRow;
      return { token: tokenFromRow(row), workspaceId: row.workspace_id };
    },
    async workspaceName(id) {
      const { data } = await db.from('okr_workspaces').select('name').eq('id', id).maybeSingle();
      return (data as { name?: string } | null)?.name ?? 'Workspace';
    },
    load: (ws) => store.load(ws),
    commit: (ws, c) => store.commit(ws, c),
    async touch(id, at) { await db.from('okr_api_tokens').update({ last_used_at: at }).eq('id', id); },
    deleteWorkspace: (ws) => store.deleteWorkspace(ws),
    // Recording (migration 0022): on unless the workspace has turned it off; before the migration there's no switch.
    async recording(id) {
      const { data, error } = await db.from('okr_workspaces').select('recording').eq('id', id).maybeSingle();
      return error ? true : (data as { recording?: boolean | null } | null)?.recording !== false;
    },
    // The server's own spans, with the service role key when it's set (otherwise the public key, which can add rows
    // but not read them). A missing table or a refusal is ignored: telemetry never changes an answer.
    async telemetry(spans) { await db.from('okr_telemetry_spans').insert(spans); },
  };
}

const handler = async (req: Request) => {
  try { return await serve(req, deps()); } catch (e) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
export const POST = handler;
export const GET = handler;
export const OPTIONS = handler;
export const DELETE = handler;
