/* Where markups go and how the inbox reads them, in the browser.
   - With a database (the real app, and the demo, whose markups are kept too, marked demo): a markup is added with the
     app's public key, under an id the database issues, and its pictures uploaded to the "markups" bucket. The inbox
     is open to anyone, with no sign-in (backlog O, migration 0031: Faro never holds real data): it reads every markup
     and piece of feedback on the same public key, opens pictures by their public address, and changes a status
     through the inbox's rule, recorded as the person using the app.
   - Without one (local development, the evals' build, ?store=browser): markups are kept in this browser (IndexedDB),
     and the inbox shows them.
   Either way, the markups a person sent from this browser are remembered (ids only), so What's new can say "You raised
   this"; in the real app the database also says which of theirs were fixed. Feedback says it too: the app already has
   the feedback a person sent, and the database (or, with none, this browser's inbox) says which was fixed where. */
import { WHATS_NEW } from '../help/whatsNew';
import type { Pictures } from './ink';
import { MARKUP_REPO, markupFromRow, markupToRow, type Markup, type MarkupRow, type Raised } from './model';
import { markupOps, type MarkupOps, type MarkupStore } from './ops';
import { feedbackOps, keptFixes, localFeedback, type FeedbackOps } from './feedback';

const env = import.meta.env;
const DB = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_KEY && /^https?:\/\//.test(env.VITE_SUPABASE_URL) ? { url: env.VITE_SUPABASE_URL as string, key: env.VITE_SUPABASE_KEY as string } : null;

/** Whether markups go to the database: the demo, and the real app on the shared database. Not a copy in this browser. */
export function markupsShared(): boolean {
  if (!DB || typeof location === 'undefined') return false;
  const demo = location.pathname === '/demo' || location.pathname.startsWith('/demo/');
  return demo || new URLSearchParams(location.search).get('store') !== 'browser';
}

type Shared = ReturnType<typeof import('../adapters/supabase/browser').supabaseMarkups>;
let shared: Promise<Shared> | null = null;
/** The database's side (src/adapters/supabase/browser.ts), on the public key. It never signs in or reads a sign-in from
    the address. Loaded only when it is used. */
const database = () => (shared ??= import('../adapters/supabase/browser').then(({ supabaseMarkups }) => supabaseMarkups(DB!.url, DB!.key)));

/* ---------- sending ---------- */

/** An id for a new markup: issued by the database (the folder its pictures go in must be named by one), or made here. */
export async function newMarkupId(): Promise<string> {
  if (!markupsShared()) {
    const b = crypto.getRandomValues(new Uint8Array(8));
    return 'mk_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  return (await database()).newId();
}

/** Sends a markup: its pictures first, then the markup, so a markup never points at pictures that aren't there. */
export async function sendMarkup(m: Markup, pictures: Pictures): Promise<void> {
  if (!markupsShared()) {
    await local.put(m, pictures);
  } else {
    await (await database()).send(m, pictures);
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
  const all = await (await database()).raised(workspaceId, personId);
  return [...all, ...[...mine, ...said].filter((x) => !all.some((k) => k.id === x.id))];
}

/* ---------- the inbox ---------- */

/** The inbox's address on this page's Workspace (the demo's or the app's), for a GitHub issue's link back. Older
    issues link to /workspace?inbox=1&markup=… and later /workspace/inbox?markup=…, which lead here too. */
export function inboxAddress(id?: string): string {
  const base = location.pathname.startsWith('/demo') ? '/demo' : '';
  return `${location.origin}${base}/feedback${id ? `?markup=${id}` : ''}`;
}

/* ---------- Connect Claude ---------- */

/** The MCP server's address, here. */
export const mcpAddress = () => `${location.origin}/api/mcp`;

/** What the MCP server here can do (GET /api/mcp?check): null when there's no server to ask (a laptop, the evals). */
export async function serverCheck(): Promise<{ ok: boolean; database: boolean; pictures: boolean; problems: string[] } | null> {
  try {
    const r = await fetch(`${mcpAddress()}?check`, { headers: { Accept: 'application/json' } });
    if (!(r.headers.get('content-type') ?? '').includes('json')) return null;
    const body = await r.json() as { ok?: unknown; pictures?: unknown };
    return typeof body.ok === 'boolean' && typeof body.pictures === 'boolean' ? body as Awaited<ReturnType<typeof serverCheck>> : null;
  } catch { return null; }
}

/** The inbox's operations: on the shared database (anyone, no sign-in), or on this browser's markups. */
export async function inboxOps(): Promise<MarkupOps> {
  const store: MarkupStore = markupsShared() ? (await database()).inbox() : local.store;
  return markupOps({ store, entries: WHATS_NEW.map((e) => e.id), repo: MARKUP_REPO, inboxLink: (id) => inboxAddress(id) });
}

/** Feedback in the inbox, triaged like markups: every workspace's, for anyone, or (with no database) this
    workspace's, as the app has it. */
export async function inboxFeedback(here: Parameters<typeof localFeedback>[0]): Promise<FeedbackOps> {
  const store = markupsShared() ? (await database()).feedback() : localFeedback(here);
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
