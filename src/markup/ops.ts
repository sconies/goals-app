/* What builders do with markups: list them, open one, change its status, open its GitHub issue and keep the issue's
   address. Written once and used by the inbox (a builder signed in with Supabase Auth, or markups kept in this
   browser when no database is set up) and by the MCP server's markup tools (with a builder token). Where the markups
   are kept is passed in (src/markup/stores.ts). No secrets: an issue is opened by the builder, on GitHub, from a
   pre-filled link. */
import { ISSUE_URL, MarkupError, newIssueLink, statusPatch, type Markup, type MarkupStatus, type StatusChange } from './model';

/** Where markups are kept, and their pictures. */
export interface MarkupStore {
  list(o: { workspaceId?: string; status?: MarkupStatus; limit: number }): Promise<Markup[]>;
  get(id: string): Promise<Markup | null>;
  update(id: string, patch: Partial<Pick<Markup, 'status' | 'fixedIn' | 'wontFixReason' | 'statusBy' | 'statusAt' | 'issueUrl'>>): Promise<Markup | null>;
  /** A link to one of a markup's pictures (markups/<id>/<name>) that stops working after `seconds`; null when there's no way to make one. */
  pictureUrl(id: string, name: string, seconds: number): Promise<string | null>;
  /** The picture itself, for an assistant to see without opening a link (backlog -2). Absent when this store can't
      read pictures (the MCP server without the service role key): see PICTURES_NEED_KEY. */
  pictureBytes?(id: string, name: string): Promise<Uint8Array | null>;
}

/** What to say, plainly, when the server can't read markups' pictures: what to add, and where. */
export const PICTURES_NEED_KEY = 'The server can’t read markup pictures: it has no SUPABASE_SERVICE_ROLE_KEY. To fix it, add it in Vercel (the goals-app project, Settings, Environment Variables, for Production and Preview), with the service_role key from Supabase (Project Settings, API Keys), then redeploy.';

/** The pictures a markup can have (src/markup/ink.ts makePictures). */
export const PICTURE_FILES = ['screen.png', 'ink.png', 'marked.jpg', 'thumb.jpg'];

/** A picture's type, from its name. */
export const pictureType = (name: string) => (name.endsWith('.png') ? 'image/png' : 'image/jpeg');

/** Bytes as base64, the same in the browser and on the server. */
export function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A picture as an assistant receives it: base64 bytes and their type. */
export interface MarkupPicture { name: string; data: string; mimeType: string; bytes: number }

export interface MarkupOpsOptions {
  store: MarkupStore;
  /** The What's new ids a fix can name. */
  entries: string[];
  /** The repository the pre-filled issue link opens in. */
  repo: string;
  /** The address of a markup in Faro's inbox, for the issue's text. */
  inboxLink?: (id: string) => string;
  now?: () => Date;
}

/** A markup in a list: with a thumbnail link that works for a few minutes. */
export interface ListedMarkup extends Markup { thumbUrl: string | null }
/** A markup opened: with links to its pictures that work for a few minutes. */
export interface OpenedMarkup extends Markup { urls: { screen: string | null; ink: string | null; marked: string | null } }

/** How long the links to pictures work. */
export const SHORT_LINK_SECONDS = 10 * 60;

export function markupOps(o: MarkupOpsOptions) {
  const now = () => (o.now?.() ?? new Date()).toISOString();
  const must = async (id: string) => {
    const m = await o.store.get(id);
    if (!m) throw new MarkupError(`There’s no markup ${id}.`);
    return m;
  };
  const pic = (m: Markup, name: string) => (m.pictures.includes(name) ? o.store.pictureUrl(m.id, name, SHORT_LINK_SECONDS).catch(() => null) : Promise.resolve(null));
  return {
    async list(q: { workspaceId?: string; status?: MarkupStatus; limit?: number } = {}): Promise<ListedMarkup[]> {
      const list = await o.store.list({ ...q, limit: Math.min(Math.max(q.limit ?? 200, 1), 500) });
      return Promise.all(list.map(async (m) => ({ ...m, thumbUrl: await pic(m, 'thumb.jpg') })));
    },

    /** One picture's bytes, by markup id and picture name (for the inbox opened with a builder token). Null when the
        markup has no picture by that name; throws PICTURES_NEED_KEY when pictures can't be read here. */
    async pictureFile(id: string, name: string): Promise<Uint8Array | null> {
      if (!PICTURE_FILES.includes(name)) throw new MarkupError(`A markup’s pictures are ${PICTURE_FILES.join(', ')}.`);
      const m = await must(id);
      if (!o.store.pictureBytes) throw new MarkupError(PICTURES_NEED_KEY);
      return m.pictures.includes(name) ? o.store.pictureBytes(id, name) : null;
    },

    /** Whether pictures can be read here (for an assistant), or why not. */
    picturesReady: () => !!o.store.pictureBytes,

    /** One of a markup's pictures, for an assistant: the first of `names` the markup has. Null when it has none of
        them; throws PICTURES_NEED_KEY when pictures can't be read here. */
    async picture(m: Pick<Markup, 'id' | 'pictures'>, names: string[] = ['marked.jpg', 'screen.png']): Promise<MarkupPicture | null> {
      if (!o.store.pictureBytes) throw new MarkupError(PICTURES_NEED_KEY);
      for (const name of names) {
        if (!m.pictures.includes(name)) continue;
        const b = await o.store.pictureBytes(m.id, name);
        if (b) return { name, data: base64(b), mimeType: pictureType(name), bytes: b.length };
      }
      return null;
    },

    async open(id: string): Promise<OpenedMarkup> {
      const m = await must(id);
      const [screen, ink, marked] = await Promise.all(['screen.png', 'ink.png', 'marked.jpg'].map((n) => pic(m, n)));
      return { ...m, urls: { screen: screen ?? null, ink: ink ?? null, marked: marked ?? null } };
    },

    async setStatus(id: string, c: StatusChange): Promise<Markup> {
      await must(id);
      const m = await o.store.update(id, statusPatch(c, now(), o.entries));
      if (!m) throw new MarkupError(`There’s no markup ${id}.`);
      return m;
    },

    /** Keeps the address of the issue the builder opened. */
    async setIssueUrl(id: string, url: string): Promise<Markup> {
      const u = url.trim().replace(/[?#].*$/, '');
      if (!ISSUE_URL.test(u)) throw new MarkupError('Paste the issue’s address: https://github.com/owner/repo/issues/123.');
      await must(id);
      const m = await o.store.update(id, { issueUrl: u });
      if (!m) throw new MarkupError(`There’s no markup ${id}.`);
      return m;
    },

    /** The pre-filled new-issue link: title, line, page, parts, steps and a link back to the markup in the inbox. The
        builder presses Submit on GitHub, then pastes the issue's address back. */
    async issueLink(id: string): Promise<string> {
      const m = await must(id);
      return newIssueLink(o.repo, m, { inboxUrl: o.inboxLink?.(m.id) ?? null });
    },
  };
}

export type MarkupOps = ReturnType<typeof markupOps>;
