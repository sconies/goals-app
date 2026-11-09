/* Where markups are kept, for markupOps (ops.ts), in Supabase. No secrets in either, and no sign-in: Faro's inbox is
   open to anyone on purpose (backlog O, migration 0031; the internal app keeps its own restricted, spec R1 rule 6).
   - openMarkups: the inbox, on the app's public key, which reads every markup and changes its triage columns.
   - tokenMarkups: the MCP server, with any live token, through the database's functions for it
     (okr_markups_for_token and the others), on whatever key the server has.
   Pictures are in the public-read bucket "markups": each is opened by its address, which anyone can make from the
   markup's id; nobody can list the bucket. So neither needs the service role key to show or read one. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MarkupError, markupFromRow, type MarkupRow } from '../../markup/model';
import { PICTURES_UNREADABLE, type MarkupStore } from '../../markup/ops';

/** A picture's address in the public-read bucket. */
const publicUrl = (db: SupabaseClient, id: string, name: string) => db.storage.from('markups').getPublicUrl(`${id}/${name}`).data.publicUrl;

/** One picture's bytes, read from its address (null when it isn't there, or the bucket isn't open yet). */
async function download(db: SupabaseClient, id: string, name: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(publicUrl(db, id, name));
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch { return null; }
}

/** Pictures by their public address. Reading the bytes first asks the database, once, whether the bucket is open
    (okr_markup_pictures_open, migration 0031), so an assistant is told why there's no picture rather than "none". */
function pictures(db: SupabaseClient): Pick<MarkupStore, 'pictureUrl' | 'pictureBytes'> {
  let open: Promise<boolean> | null = null;
  const isOpen = () => (open ??= Promise.resolve(db.rpc('okr_markup_pictures_open')).then(({ data, error }) => !error && data === true, () => false));
  return {
    pictureUrl: async (id, name) => publicUrl(db, id, name),
    async pictureBytes(id, name) {
      if (!(await isOpen())) throw new MarkupError(PICTURES_UNREADABLE);
      return download(db, id, name);
    },
  };
}

const COLUMN: Record<string, string> = { status: 'status', fixedIn: 'fixed_in', wontFixReason: 'wont_fix_reason', statusBy: 'status_by', statusAt: 'status_at', issueUrl: 'issue_url' };
const toRow = (patch: object) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [COLUMN[k] ?? k, v]));
const rows = (data: unknown) => ((data ?? []) as MarkupRow[]).map(markupFromRow);

export function openMarkups(db: SupabaseClient): MarkupStore {
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
    ...pictures(db),
  };
}

export function tokenMarkups(db: SupabaseClient, hash: string): MarkupStore {
  const call = async (fn: string, args: Record<string, unknown>, what: string) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`${what}: ${error.message}`);
    return rows(data);
  };
  return {
    list: (o) => call('okr_markups_for_token', { hash, ws: o.workspaceId ?? null, st: o.status ?? null, lim: o.limit }, 'Markups'),
    get: async (id) => (await call('okr_markup_for_token', { hash, mid: id }, 'Markups'))[0] ?? null,
    update: async (id, patch) => (await call('okr_markup_triage_for_token', { hash, mid: id, patch: toRow(patch) }, 'Saving the markup'))[0] ?? null,
    ...pictures(db),
  };
}
