/* Where markups are kept, for markupOps (ops.ts), in Supabase. No secrets in either:
   - signedInMarkups: the inbox, as a builder signed in with Supabase Auth. The database lets builders read and triage
     markups (migration 0024, okr_is_builder) and read the pictures, through links signed for them.
   - tokenMarkups: the MCP server, with a builder token, through the database's functions for it (okr_markups_for_token
     and the others), on whatever key the server has. Picture links need Storage's own access: only a server holding
     the service role key can sign them, so without it they're null and the tools point to the inbox instead. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { markupFromRow, type MarkupRow } from './model';
import type { MarkupStore } from './ops';

const COLUMN: Record<string, string> = { status: 'status', fixedIn: 'fixed_in', wontFixReason: 'wont_fix_reason', statusBy: 'status_by', statusAt: 'status_at', issueUrl: 'issue_url' };
const toRow = (patch: object) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [COLUMN[k] ?? k, v]));
const rows = (data: unknown) => ((data ?? []) as MarkupRow[]).map(markupFromRow);

export function signedInMarkups(db: SupabaseClient): MarkupStore {
  return {
    async list(o) {
      let q = db.from('okr_markups').select('*').order('created_at', { ascending: false }).limit(o.limit);
      if (o.workspaceId) q = q.eq('workspace_id', o.workspaceId).eq('demo', false);
      if (o.status) q = q.eq('status', o.status);
      const { data, error } = await q;
      if (error) throw new Error('Markups: ' + error.message);
      return rows(data);
    },
    async get(id) {
      const { data, error } = await db.from('okr_markups').select('*').eq('id', id);
      if (error) throw new Error('Markups: ' + error.message);
      return rows(data)[0] ?? null;
    },
    async update(id, patch) {
      const { data, error } = await db.from('okr_markups').update(toRow(patch)).eq('id', id).select('*');
      if (error) throw new Error('Saving the markup: ' + error.message);
      return rows(data)[0] ?? null;
    },
    async pictureUrl(id, name, seconds) {
      const { data, error } = await db.storage.from('markups').createSignedUrl(`${id}/${name}`, seconds);
      return error ? null : data?.signedUrl ?? null;
    },
  };
}

export function tokenMarkups(db: SupabaseClient, hash: string, signer?: SupabaseClient | null): MarkupStore {
  const call = async (fn: string, args: Record<string, unknown>, what: string) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`${what}: ${error.message}`);
    return rows(data);
  };
  return {
    list: (o) => call('okr_markups_for_token', { hash, ws: o.workspaceId ?? null, st: o.status ?? null, lim: o.limit }, 'Markups'),
    get: async (id) => (await call('okr_markup_for_token', { hash, mid: id }, 'Markups'))[0] ?? null,
    update: async (id, patch) => (await call('okr_markup_triage_for_token', { hash, mid: id, patch: toRow(patch) }, 'Saving the markup'))[0] ?? null,
    async pictureUrl(id, name, seconds) {
      if (!signer) return null;
      const { data, error } = await signer.storage.from('markups').createSignedUrl(`${id}/${name}`, seconds);
      return error ? null : data?.signedUrl ?? null;
    },
  };
}
