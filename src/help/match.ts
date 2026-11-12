/* The small rules the guide and What's new share with the light index (src/help/lookup.ts): which route an address is
   on, and which releases are newer than the one a person last saw. Written once here, with no article or release in
   it, so the first download can use them without the guide's or What's new's text. */

/** A route pattern's path and the query values it needs. */
function parseRoute(r: string): { segs: string[]; query: [string, string][] } {
  const [path = '/', q = ''] = r.split('?');
  return { segs: path.split('/').filter(Boolean), query: [...new URLSearchParams(q).entries()] };
}

/**
 * How closely a route (as App.tsx and the guide write it) matches an address: null when it doesn't. Fixed path
 * segments beat parameters (/goals/new over /goals/:goalId), and a route that needs a query value beats one that
 * doesn't. Shared by the Help link on every page and by the named flows (src/help/flows.ts).
 */
export function routeScore(route: string, pathname: string, search = ''): number | null {
  const segs = pathname.split('/').filter(Boolean);
  const p = parseRoute(route);
  if (p.segs.length !== segs.length) return null;
  if (!p.segs.every((s, i) => s.startsWith(':') || s === segs[i])) return null;
  const q = new URLSearchParams(search);
  if (!p.query.every(([k, v]) => (v === '*' ? q.has(k) && q.get(k) !== '' : q.get(k) === v))) return null;
  return p.segs.filter((s) => !s.startsWith(':')).length * 10 + p.query.length * 100;
}

/** The item with the route that matches an address most closely (the first, on a tie). */
export function closestRoute<T>(items: readonly T[], routesOf: (t: T) => readonly string[], pathname: string, search = ''): { item: T; route: string } | undefined {
  let best: { item: T; route: string; score: number } | undefined;
  for (const item of items) {
    for (const route of routesOf(item)) {
      const score = routeScore(route, pathname, search);
      if (score !== null && (!best || score > best.score)) best = { item, route, score };
    }
  }
  return best && { item: best.item, route: best.route };
}

/** The route paths a list of articles explains, without their queries. */
export const routePaths = (list: readonly { routes: readonly string[] }[]): string[] => [...new Set(list.flatMap((a) => a.routes.map((r) => r.split('?')[0]!)))];

/** The releases newer than the one with this id, newest first (all of them when the id is unknown or missing). */
export function entriesAfter<T extends { id: string }>(list: readonly T[], seenId: string | null): T[] {
  const i = seenId ? list.findIndex((e) => e.id === seenId) : -1;
  return i < 0 ? [...list] : list.slice(0, i);
}
