/* Where markups go and how builders reach them, in the browser.
   - With a database (the real app, and the demo, whose markups are kept too, marked demo): a markup is added with the
     app's public key, under an id the database issues, and its pictures uploaded to the private "markups" bucket. The
     public key can't read them back. Builders sign in to the inbox with an email link (Supabase Auth), and read and
     triage markups as themselves; the rest of the app has no sign-in.
   - Without one (local development, the evals' build, ?store=browser): markups are kept in this browser (IndexedDB),
     and the inbox shows them without signing in.
   Either way, the markups a person sent from this browser are remembered (ids only), so What's new can say "You raised
   this"; in the real app the database also says which of theirs were fixed. Feedback says it too: the app already has
   the feedback a person sent, and the database (or, with none, this browser's inbox) says which was fixed where. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { WHATS_NEW } from '../help/whatsNew';
import type { Pictures } from './ink';
import { MARKUP_REPO, markupFromRow, markupToRow, type Markup, type MarkupRow, type Raised } from './model';
import { markupOps, type MarkupOps, type MarkupStore } from './ops';
import { signedInMarkups, tokenMarkups } from './stores';
import { feedbackOps, keptFixes, localFeedback, signedInFeedback, tokenFeedback, type FeedbackOps } from './feedback';
import { hashToken } from '../mcp/token';

const env = import.meta.env;
const DB = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_KEY && /^https?:\/\//.test(env.VITE_SUPABASE_URL) ? { url: env.VITE_SUPABASE_URL as string, key: env.VITE_SUPABASE_KEY as string } : null;

/** Whether markups go to the database: the demo, and the real app on the shared database. Not a copy in this browser. */
export function markupsShared(): boolean {
  if (!DB || typeof location === 'undefined') return false;
  const demo = location.pathname === '/demo' || location.pathname.startsWith('/demo/');
  return demo || new URLSearchParams(location.search).get('store') !== 'browser';
}

let anon: Promise<SupabaseClient> | null = null;
/** The public key's client, for sending. It never signs in or reads a sign-in from the address. */
const anonClient = () => (anon ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(DB!.url, DB!.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })));

/* ---------- sending ---------- */

/** An id for a new markup: issued by the database (the folder its pictures go in must be named by one), or made here. */
export async function newMarkupId(): Promise<string> {
  if (!markupsShared()) {
    const b = crypto.getRandomValues(new Uint8Array(8));
    return 'mk_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  const { data, error } = await (await anonClient()).rpc('okr_markup_new_id');
  if (error || typeof data !== 'string') throw new Error('The markup couldn’t be sent: ' + (error?.message ?? 'no id came back') + '.');
  return data;
}

/** Sends a markup: its pictures first, then the markup, so a markup never points at pictures that aren't there. */
export async function sendMarkup(m: Markup, pictures: Pictures): Promise<void> {
  if (!markupsShared()) {
    await local.put(m, pictures);
  } else {
    const db = await anonClient();
    for (const name of m.pictures) {
      const file = pictures[name as keyof Pictures];
      const { error } = await db.storage.from('markups').upload(`${m.id}/${name}`, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('The picture couldn’t be sent: ' + error.message + '.');
    }
    const { error } = await db.from('okr_markups').insert(markupToRow(m));
    if (error) throw new Error('The markup couldn’t be sent: ' + error.message + '.');
  }
  remember({ id: m.id, personId: m.personId, workspaceId: m.workspaceId });
}

/* ---------- "You raised this" ---------- */

const RAISED = 'faro-raised';
interface Mine { id: string; personId: string; workspaceId: string }
const readMine = (): Mine[] => { try { return JSON.parse(localStorage.getItem(RAISED) || '[]') as Mine[]; } catch { return []; } };
function remember(x: Mine) {
  try { localStorage.setItem(RAISED, JSON.stringify([...readMine().filter((y) => y.id !== x.id), x].slice(-200))); } catch { /* storage blocked: the database still knows */ }
}

/**
 * What this person raised, so What's new can say "You raised this": the markups they sent (remembered in this browser)
 * and the feedback they sent (`feedback`, as the app has it), each with where it was fixed: in the real app, as the
 * database says (okr_markups_raised, okr_feedback_raised); with no database, as this browser's inbox marked it. An
 * entry's `fixes` naming an id counts either way.
 */
export async function raisedBy(workspaceId: string, personId: string, demo: boolean, feedback: readonly { id: string; personId: string }[] = []): Promise<Raised[]> {
  const mine: Raised[] = readMine().filter((x) => x.workspaceId === workspaceId && x.personId === personId).map((x) => ({ id: x.id, personId: x.personId, kind: 'markup' }));
  const said: Raised[] = feedback.filter((f) => f.personId === personId).map((f) => ({ id: f.id, personId, kind: 'feedback' }));
  if (demo || !markupsShared()) {
    if (!markupsShared()) {
      for (const r of mine) { const m = await local.get(r.id).catch(() => null); if (m?.markup.fixedIn) r.fixedIn = m.markup.fixedIn; }
      const fixes = keptFixes();
      for (const r of said) if (fixes[r.id]) r.fixedIn = fixes[r.id];
    }
    return [...mine, ...said];
  }
  const db = await anonClient();
  const known = async (fn: string, kind: Raised['kind']): Promise<Raised[]> => {
    try {
      const { data, error } = await db.rpc(fn, { ws: workspaceId, person: personId });
      return error ? [] : ((data ?? []) as { id: string; fixed_in: string | null }[]).map((r) => ({ id: r.id, personId, fixedIn: r.fixed_in, kind }));
    } catch { return []; }
  };
  const [markups, fixedFeedback] = await Promise.all([known('okr_markups_raised', 'markup'), known('okr_feedback_raised', 'feedback')]);
  const all = [...markups, ...fixedFeedback];
  return [...all, ...[...mine, ...said].filter((x) => !all.some((k) => k.id === x.id))];
}

/* ---------- builders: signing in to the inbox ---------- */

let auth: Promise<SupabaseClient> | null = null;
/** The inbox's own client: it keeps a builder's sign-in in this browser, and finishes one arriving from the email link. */
export const builderClient = () => (auth ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(DB!.url, DB!.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'faro-builder-auth' },
})));

/** Where the email link brings a builder back to: the inbox, on this page's Workspace (the demo's or the app's). */
export function inboxAddress(id?: string): string {
  const base = location.pathname.startsWith('/demo') ? '/demo' : '';
  return `${location.origin}${base}/workspace?inbox=1${id ? `&markup=${id}` : ''}`;
}

export interface BuilderSession { email: string; builder: boolean }

/** Who is signed in to the inbox in this browser, and whether they're a builder. Null: nobody. */
export async function builderSession(): Promise<BuilderSession | null> {
  const db = await builderClient();
  const { data } = await db.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return null;
  const { data: ok, error } = await db.rpc('okr_is_builder');
  return { email, builder: !error && ok === true };
}

export async function sendSignInLink(email: string): Promise<void> {
  const db = await builderClient();
  const { error } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: inboxAddress() } });
  if (error) throw new Error(error.message);
}

export async function signOutBuilder(): Promise<void> { await (await builderClient()).auth.signOut(); }

/** A builder token for this builder's AI assistant, acting as a person in a workspace (the MCP markup tools need one). */
export async function makeBuilderToken(workspaceId: string, personId: string, name: string): Promise<string> {
  const { data, error } = await (await builderClient()).rpc('okr_builder_token_create', { ws: workspaceId, person: personId, token_name: name });
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
  return data as string;
}

/* ---------- Connect Claude: builder tokens, and reading the inbox with one ---------- */

/** The MCP server's address, here. */
export const mcpAddress = () => `${location.origin}/api/mcp`;

/** One of the signed-in builder's live builder tokens (migration 0029); never its secret or hash. */
export interface BuilderTokenRow { id: string; workspaceId: string; workspaceName: string; personId: string; personName: string; name: string; createdAt: string; lastUsedAt: string | null }

export async function builderTokens(): Promise<BuilderTokenRow[]> {
  const { data, error } = await (await builderClient()).rpc('okr_builder_tokens');
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
  return ((data ?? []) as Record<string, string | null>[]).map((r) => ({ id: r.id!, workspaceId: r.workspace_id!, workspaceName: r.workspace_name ?? '', personId: r.person_id!, personName: r.person_name ?? '', name: r.name ?? '', createdAt: r.created_at!, lastUsedAt: r.last_used_at ?? null }));
}

export async function revokeBuilderToken(id: string): Promise<boolean> {
  const { data, error } = await (await builderClient()).rpc('okr_builder_token_revoke', { token_id: id });
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
  return data === true;
}

/** What the MCP server here can do (GET /api/mcp?check): null when there's no server to ask (a laptop, the evals). */
export async function serverCheck(): Promise<{ ok: boolean; database: boolean; pictures: boolean; problems: string[] } | null> {
  try {
    const r = await fetch(`${mcpAddress()}?check`, { headers: { Accept: 'application/json' } });
    if (!(r.headers.get('content-type') ?? '').includes('json')) return null;
    const body = await r.json() as { ok?: unknown; pictures?: unknown };
    return typeof body.ok === 'boolean' && typeof body.pictures === 'boolean' ? body as Awaited<ReturnType<typeof serverCheck>> : null;
  } catch { return null; }
}

/** The builder token this browser reads the inbox with, without the email sign-in (kept until forgotten). */
const TOKEN = 'faro-builder-token';
export function savedBuilderToken(): string | null { try { return localStorage.getItem(TOKEN); } catch { return null; } }
export function forgetBuilderToken() { try { localStorage.removeItem(TOKEN); } catch { /* nothing kept */ } }

/** Checks a pasted builder token with the database, and keeps it in this browser. Throws, in words, when it isn't one. */
export async function keepBuilderToken(token: string): Promise<void> {
  const t = token.trim().replace(/^Bearer\s+/i, '');
  if (!/^gk_[A-Za-z0-9]{20,}$/.test(t)) throw new Error('That isn’t a token: it starts gk_.');
  const { data, error } = await (await anonClient()).rpc('okr_token_find', { hash: await hashToken(t) });
  if (error) throw new Error('The goals database didn’t answer. Try again in a moment.');
  const row = ((data ?? []) as { builder?: boolean }[])[0];
  if (!row) throw new Error('That token isn’t valid or has been revoked.');
  if (!row.builder) throw new Error('That’s an ordinary token. Reading the inbox needs a builder token, made under Connect Claude.');
  try { localStorage.setItem(TOKEN, t); } catch { /* kept for this visit only */ }
}

/** A picture through the MCP server, which reads it with the service role key; as an address this page can show. */
async function pictureThroughServer(token: string, id: string, name: string): Promise<string | null> {
  const r = await fetch(`${mcpAddress()}?picture=${encodeURIComponent(id)}/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 503) throw new Error((await r.json().catch(() => null) as { error?: { message?: string } } | null)?.error?.message ?? 'The server can’t read pictures.');
  if (!r.ok) return null;
  // A data address, to show it on the page (nothing is saved as a file).
  const b = await r.blob();
  return new Promise<string>((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.onerror = () => rej(f.error); f.readAsDataURL(b); });
}

/** The inbox's operations with a builder token: markups through the database's functions for it (as the MCP tools
    use them), pictures through the MCP server. Reads the demo's and preview builds' markups with no email sign-in. */
export async function tokenInbox(token: string): Promise<{ ops: MarkupOps; feedback: FeedbackOps; pictures: () => string | null }> {
  const db = await anonClient();
  const hash = await hashToken(token);
  let missing: string | null = null;
  const urls = new Map<string, string | null>();
  const base = tokenMarkups(db, hash);
  const store: MarkupStore = {
    ...base,
    async pictureUrl(id, name) {
      // No thumbnails in the list: each would be a request to the server. Opening a markup shows its picture.
      if (name === 'thumb.jpg') return null;
      const key = `${id}/${name}`;
      if (urls.has(key)) return urls.get(key)!;
      try { const u = await pictureThroughServer(token, id, name); urls.set(key, u); return u; } catch (e) { missing = e instanceof Error ? e.message : String(e); return null; }
    },
  };
  return {
    ops: markupOps({ store, entries: WHATS_NEW.map((e) => e.id), repo: MARKUP_REPO, inboxLink: (id) => inboxAddress(id) }),
    feedback: feedbackOps({ store: tokenFeedback(db, hash), entries: WHATS_NEW.map((e) => e.id) }),
    pictures: () => missing,
  };
}

/** The inbox's operations: as the signed-in builder, or on this browser's markups. */
export async function inboxOps(): Promise<MarkupOps> {
  const store: MarkupStore = markupsShared() ? signedInMarkups(await builderClient()) : local.store;
  return markupOps({ store, entries: WHATS_NEW.map((e) => e.id), repo: MARKUP_REPO, inboxLink: (id) => inboxAddress(id) });
}

/** Feedback in the inbox, triaged like markups: every workspace's for the signed-in builder, or (with no database)
    this workspace's, as the app has it. */
export async function inboxFeedback(here: Parameters<typeof localFeedback>[0]): Promise<FeedbackOps> {
  const store = markupsShared() ? signedInFeedback(await builderClient()) : localFeedback(here);
  return feedbackOps({ store, entries: WHATS_NEW.map((e) => e.id) });
}

/* ---------- kept in this browser, when there's no database ---------- */

interface Kept { markup: Markup; pictures: Record<string, Blob> }

const local = (() => {
  const open = () => new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open('faro-markups', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('markups', { keyPath: 'markup.id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('This browser won’t keep markups.'));
  });
  const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((res, rej) => {
      const req = fn(db.transaction('markups', mode).objectStore('markups'));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }).finally(() => db.close());
  };
  const get = (id: string) => run<Kept | undefined>('readonly', (s) => s.get(id));
  const all = () => run<Kept[]>('readonly', (s) => s.getAll());
  const urls = new Map<string, string>();
  const store: MarkupStore = {
    async list(o) {
      return (await all()).map((k) => k.markup).filter((m) => (!o.workspaceId || (m.workspaceId === o.workspaceId && !m.demo)) && (!o.status || m.status === o.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, o.limit);
    },
    async get(id) { return (await get(id))?.markup ?? null; },
    async update(id, patch) {
      const k = await get(id);
      if (!k) return null;
      const next = { ...k, markup: { ...k.markup, ...patch } };
      await run('readwrite', (s) => s.put(next));
      return next.markup;
    },
    async pictureUrl(id, name) {
      // No thumbnails in the list: each would be a request to the server. Opening a markup shows its picture.
      if (name === 'thumb.jpg') return null;
      const key = `${id}/${name}`;
      if (urls.has(key)) return urls.get(key)!;
      const b = (await get(id))?.pictures[name];
      if (!b) return null;
      // A data address, to show it on the page (nothing is saved as a file).
      const u = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
      urls.set(key, u);
      return u;
    },
  };
  return {
    store, get,
    async put(m: Markup, p: Pictures) {
      // A round trip through the stored shape, so what's kept here is what the database would keep.
      const row = { ...markupToRow(m), status: 'new', issue_url: null, fixed_in: null, wont_fix_reason: null, status_by: null, status_at: null, created_at: m.createdAt } as MarkupRow;
      await run('readwrite', (s) => s.put({ markup: markupFromRow(row), pictures: { ...p } } satisfies Kept));
    },
  };
})();
