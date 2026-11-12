/* The light side of Help: what every page needs from the guide and What's new without their text (backlog AX4, the
   first download). Article titles and routes, for the Help link at the foot of every page, page names and telemetry's
   routes; and the releases' ids, dates and titles, for the unread dot and the line on Home. The build reads them from
   src/help/guide.ts and src/help/whatsNew.ts (vite.helpIndex.ts), which stay the only source; the Help screens load
   the full text when opened. */
import INDEX from 'virtual:faro-help-index';
import { closestRoute, entriesAfter, routePaths } from './match';

export type ArticleRef = (typeof INDEX.articles)[number];
export type NewsRef = (typeof INDEX.news)[number];

const BY_ID = new Map(INDEX.articles.map((a) => [a.id, a]));

/** An article's id, title and routes, following a renamed article's old id (as src/help/guide.ts articleById does). */
export const articleRef = (id: string): ArticleRef | undefined => BY_ID.get(id) ?? BY_ID.get(INDEX.moved[id] ?? '');

/** The article for a page: the one whose route matches the address most closely (as guide.ts articleForPath). */
export const articleForPath = (pathname: string, search = ''): ArticleRef | undefined => closestRoute(INDEX.articles, (a) => a.routes, pathname, search)?.item;

const APP_ROUTES = routePaths(INDEX.articles);
/** The App.tsx route an address is on, e.g. /goals/:goalId for /goals/G-12: what telemetry records instead of ids. */
export const appRouteFor = (pathname: string): string | undefined => closestRoute(APP_ROUTES, (r) => [r], pathname)?.route;

/** Every release, newest first: id, date and title. */
export const NEWS: readonly NewsRef[] = INDEX.news;

/** The newest release's id: the app's version, for telemetry and markups. */
export const latestNewsId = (): string | undefined => INDEX.news[0]?.id;

/** Releases newer than the one with this id (all of them when the id is unknown or missing). */
export const newsAfter = (seenId: string | null): NewsRef[] => entriesAfter(INDEX.news, seenId);
