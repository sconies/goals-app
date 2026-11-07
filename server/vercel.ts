/* The Vercel function at /api/mcp. Built into api/mcp.js by `npm run build:mcp` (one self-contained file).
   It reads and writes Supabase with SUPABASE_SERVICE_ROLE_KEY when set, otherwise the app's public key (then markup
   pictures can't be read, and the tools and GET /api/mcp?check say so), and records a
   span per tool call in the telemetry tables (migration 0022) when the workspace records. Tokens are found, noted as
   used and made through the database's functions (migration 0024), which work with either key. */
import { createClient } from '@supabase/supabase-js';
import { SupabaseStore } from '../src/data/supabaseStore';
import { tokenFromRow, type TokenRow } from '../src/data/rows';
import { serve, type Deps } from './mcp';
import { WHATS_NEW } from '../src/help/whatsNew';
import { MARKUP_REPO } from '../src/markup/model';
import { markupOps, PICTURES_NEED_KEY } from '../src/markup/ops';
import { tokenMarkups } from '../src/markup/stores';
import { feedbackOps, tokenFeedback } from '../src/markup/feedback';

function deps(origin: string): Deps {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = service ?? process.env.VITE_SUPABASE_KEY;
  if (!url || !key) throw new Error('The server has no database settings (SUPABASE_URL and a key).');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const store = new SupabaseStore(url, key, db);
  // The hash of the token this request came with, to note when it was used.
  let seen: string | null = null;
  return {
    // Through okr_token_find (migration 0024), which works with either key; before it, from the table.
    async findToken(hash) {
      let { data, error } = await db.rpc('okr_token_find', { hash });
      if (error && /okr_token_find|PGRST202|Could not find the function/.test(`${error.code} ${error.message}`)) {
        ({ data, error } = await db.from('okr_api_tokens').select('*').eq('token_hash', hash).is('revoked_at', null));
      }
      // A database fault is not a bad token: say so, rather than telling the person their token is wrong.
      if (error) throw new Error('The goals database didn’t answer. Try again in a moment.');
      const row = ((data ?? []) as TokenRow[])[0];
      if (!row) return null;
      seen = hash;
      return { token: tokenFromRow(row), workspaceId: row.workspace_id, builder: !!(row as TokenRow & { builder?: boolean }).builder };
    },
    async workspaceName(id) {
      const { data } = await db.from('okr_workspaces').select('name').eq('id', id).maybeSingle();
      return (data as { name?: string } | null)?.name ?? 'Workspace';
    },
    load: (ws) => store.load(ws),
    commit: (ws, c) => store.commit(ws, c),
    async touch(id, at) {
      const { error } = seen ? await db.rpc('okr_token_touch', { hash: seen }) : { error: { message: 'no hash' } };
      if (error) await db.from('okr_api_tokens').update({ last_used_at: at }).eq('id', id);
    },
    issueToken: (ws, c) => store.issueToken(ws, c),
    // The markup tools, for a builder token, through the database's functions for it (no new secret). Pictures need
    // Storage's own access, so they come only when the service role key is set; without it the tools say so plainly.
    markups: (hash) => markupOps({
      store: tokenMarkups(db, hash, service ? db : null), entries: WHATS_NEW.map((e) => e.id), repo: MARKUP_REPO,
      inboxLink: (id) => `${origin}/workspace?markup=${id}`,
    }),
    // Feedback's triage, for a builder token, the same way (migration 0028).
    feedback: (hash) => feedbackOps({ store: tokenFeedback(db, hash), entries: WHATS_NEW.map((e) => e.id) }),
    deleteWorkspace: (ws) => store.deleteWorkspace(ws),
    // The check after each deploy (GET /api/mcp?check): the database answers, and pictures can be read.
    async check() {
      const problems: string[] = [];
      const { error } = await db.rpc('okr_token_find', { hash: '0'.repeat(64) });
      const database = !error;
      if (error) problems.push(`The server can’t reach the goals database: ${error.message}`);
      let pictures = false;
      if (!service) problems.push(PICTURES_NEED_KEY);
      else {
        const { error: refused } = await db.storage.from('markups').list('', { limit: 1 });
        pictures = !refused;
        if (refused) problems.push(`SUPABASE_SERVICE_ROLE_KEY is set, but Storage refused it (${refused.message}). Check it is the service_role key of this Supabase project, then redeploy.`);
      }
      return { ok: database && pictures, database, pictures, problems };
    },
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
  try { return await serve(req, deps(new URL(req.url).origin)); } catch (e) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
export const POST = handler;
export const GET = handler;
export const OPTIONS = handler;
export const DELETE = handler;
