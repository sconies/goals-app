/* The AI tools' endpoint on Supabase (backlog 8c: Supabase only in its adapters): everything server/mcp.ts needs from
   the outside world (its Deps), from Supabase. It reads and writes with SUPABASE_SERVICE_ROLE_KEY when set, otherwise
   the app's public key (either works: markup pictures are in a public-read bucket since migration 0031, read by their
   address), and records a span per tool call in the telemetry tables (migration 0022) when the workspace records.
   Tokens are found, noted as used and made through the database's functions (migration 0024), which work with either
   key. To run the endpoint on another platform, write the same Deps from your own adapters. */
import { createClient } from '@supabase/supabase-js';
import { SupabaseStore } from './goalsStore';
import { tokenFromRow, type TokenRow } from '../../data/rows';
import type { Deps } from '../../../server/mcp';
import { WHATS_NEW } from '../../help/whatsNew';
import { MARKUP_REPO } from '../../markup/model';
import { markupOps, PICTURES_UNREADABLE } from '../../markup/ops';
import { tokenMarkups } from './markups';
import { feedbackOps } from '../../markup/feedback';
import { tokenFeedback } from './feedback';

export function supabaseDeps(origin: string, env: Record<string, string | undefined> = process.env): Deps {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const key = service ?? env.VITE_SUPABASE_KEY;
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
      return { token: tokenFromRow(row), workspaceId: row.workspace_id };
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
    // The inbox's tools, for any token, through the database's functions for it (no new secret). Pictures are read by
    // their public address (migration 0031), with either key.
    markups: (hash) => markupOps({
      store: tokenMarkups(db, hash), entries: WHATS_NEW.map((e) => e.id), repo: MARKUP_REPO,
      inboxLink: (id) => `${origin}/feedback?markup=${id}`,
    }),
    // Feedback's triage, for any token, the same way (migrations 0028 and 0031).
    feedback: (hash) => feedbackOps({ store: tokenFeedback(db, hash), entries: WHATS_NEW.map((e) => e.id) }),
    deleteWorkspace: (ws) => store.deleteWorkspace(ws),
    // The check after each deploy (GET /api/mcp?check): the database answers, and pictures can be read.
    async check() {
      const problems: string[] = [];
      const { error } = await db.rpc('okr_token_find', { hash: '0'.repeat(64) });
      const database = !error;
      if (error) problems.push(`The server can’t reach the goals database: ${error.message}`);
      // Pictures: the markups bucket is open to read (migration 0031); the database says so.
      const { data: open, error: unknown } = await db.rpc('okr_markup_pictures_open');
      const pictures = !unknown && open === true;
      if (!pictures) problems.push(PICTURES_UNREADABLE);
      return { ok: database && pictures, database, pictures, problems };
    },
    // Recording (migration 0022): on unless the workspace has turned it off; before the migration there's no switch.
    async recording(id) {
      const { data, error } = await db.from('okr_workspaces').select('recording').eq('id', id).maybeSingle();
      return error ? true : (data as { recording?: boolean | null } | null)?.recording !== false;
    },
    // Feature modules switched off (migration 0030): none before the migration, or if the row can't be read.
    async modulesOff(id) {
      const { data, error } = await db.from('okr_workspaces').select('modules_off').eq('id', id).maybeSingle();
      const off = error ? null : (data as { modules_off?: string[] | null } | null)?.modules_off;
      return Array.isArray(off) ? off : [];
    },
    // The server's own spans, with the service role key when it's set (otherwise the public key, which can add rows
    // but not read them). A missing table or a refusal is ignored: telemetry never changes an answer.
    async telemetry(spans) { await db.from('okr_telemetry_spans').insert(spans); },
  };
}

