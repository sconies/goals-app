/* The light side of Help: what every page needs from the guide and What's new without their text (backlog AX4, the
   first download). Article titles and routes, for the Help link at the foot of every page, page names and telemetry's
   routes; and the newest release's id, date and title, for the unread dot and the line on Home. Only the newest: a
   new release replaces it, so What's new never grows the first download (lookup.test.ts checks it). Every release's
   title is in src/help/newsIndex.ts, for the screens that list them. The build reads them from
   src/help/guide.ts and src/help/whatsNew.ts (vite.helpIndex.ts), which stay the only source; the Help screens load
   the full text when opened. */
import INDEX from 'virtual:faro-help-index';
import { closestRoute, routePaths } from './match';

export type ArticleRef = (typeof INDEX.articles)[number];
export type NewsRef = NonNullable<typeof INDEX.latest>;

const BY_ID = new Map(INDEX.articles.map((a) => [a.id, a]));

/** An article's id, title and routes, following a renamed article's old id (as src/help/guide.ts articleById does). */
export const articleRef = (id: string): ArticleRef | undefined => BY_ID.get(id) ?? BY_ID.get(INDEX.moved[id] ?? '');

/** The article for a page: the one whose route matches the address most closely (as guide.ts articleForPath). */
export const articleForPath = (pathname: string, search = ''): ArticleRef | undefined => closestRoute(INDEX.articles, (a) => a.routes, pathname, search)?.item;

const APP_ROUTES = routePaths(INDEX.articles);
/** The App.tsx route an address is on, e.g. /goals/:goalId for /goals/G-12: what telemetry records instead of ids. */
export const appRouteFor = (pathname: string): string | undefined => closestRoute(APP_ROUTES, (r) => [r], pathname)?.route;

/** The newest release: id, date and title. */
export const latestNews = (): NewsRef | undefined => INDEX.latest ?? undefined;

/** The newest release's id: the app's version, for telemetry and markups. */
export const latestNewsId = (): string | undefined => INDEX.latest?.id;

/**
 * Whether anything is new since the release with this id: the newest release when it isn't the one seen (and when
 * nothing has been seen), else nothing. What the dot and the line on Home need; the full list is What's new's.
 */
export const unreadSince = (seenId: string | null): NewsRef[] => (INDEX.latest && INDEX.latest.id !== seenId ? [INDEX.latest] : []);
