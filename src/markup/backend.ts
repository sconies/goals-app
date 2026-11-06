/* Where markups go and how builders reach them, in the browser.
   - With a database (the real app, and the demo, whose markups are kept too, marked demo): a markup is added with the
     app's public key, under an id the database issues, and its pictures uploaded to the private "markups" bucket. The
     public key can't read them back. Builders sign in to the inbox with an email link (Supabase Auth), and read and
     triage markups as themselves; the rest of the app has no sign-in.
   - Without one (local development, the evals' build, ?store=browser): markups are kept in this browser (IndexedDB),
     and the inbox shows them without signing in.
   Either way, the markups a person sent from this browser are remembered (ids only), so What's new can say "You raised
   this"; in the real app the database also says which of theirs were fixed. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { WHATS_NEW } from '../help/whatsNew';
import type { Pictures } from './ink';
import { MARKUP_REPO, markupFromRow, markupToRow, type Markup, type MarkupRow, type Raised } from './model';
import { markupOps, type MarkupOps, type MarkupStore } from './ops';
import { signedInMarkups } from './stores';
import { feedbackOps, localFeedback, signedInFeedback, type FeedbackOps } from './feedback';

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

/** The markups this person sent: remembered in this browser, and (in the real app) where the database says each one is. */
export async function raisedBy(workspaceId: string, personId: string, demo: boolean): Promise<Raised[]> {
  const mine: Raised[] = readMine().filter((x) => x.workspaceId === workspaceId && x.personId === personId).map((x) => ({ id: x.id, personId: x.personId }));
  if (demo || !markupsShared()) {
    if (!markupsShared()) for (const r of mine) { const m = await local.get(r.id).catch(() => null); if (m?.markup.fixedIn) r.fixedIn = m.markup.fixedIn; }
    return mine;
  }
  try {
    const { data } = await (await anonClient()).rpc('okr_markups_raised', { ws: workspaceId, person: personId });
    const known = ((data ?? []) as { id: string; fixed_in: string | null }[]).map((r) => ({ id: r.id, personId, fixedIn: r.fixed_in }));
    return [...known, ...mine.filter((x) => !known.some((k) => k.id === x.id))];
  } catch { return mine; }
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
