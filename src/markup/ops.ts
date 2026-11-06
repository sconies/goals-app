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
}

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
