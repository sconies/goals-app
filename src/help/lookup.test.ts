/* The Help index the build makes (vite.helpIndex.ts) says what the guide and What's new say: the first download reads
   it instead of them (src/help/lookup.ts), so it must never drift from them. */
import { ARTICLES, MOVED_ARTICLES, appRouteFor as guideRoute, articleById, articleForPath as guideArticle } from './guide';
import { WHATS_NEW, newsAfter as fullNewsAfter } from './whatsNew';
import { appRouteFor, articleForPath, articleRef, latestNews, latestNewsId, unreadSince } from './lookup';
import { NEWS } from './newsIndex';
import INDEX from 'virtual:faro-help-index';

describe('the Help index', () => {
  it('has every guide article, in order, with its title and routes', () => {
    expect(ARTICLES.map((a) => articleRef(a.id))).toEqual(ARTICLES.map((a) => ({ id: a.id, title: a.title, routes: a.routes, ...(a.module ? { module: a.module } : {}) })));
    for (const old of Object.keys(MOVED_ARTICLES)) expect(articleRef(old)?.id).toBe(articleById(old)?.id);
  });

  it('has only the newest What’s new release, so a new release never grows the first download', () => {
    const newest = WHATS_NEW[0]!;
    expect(latestNews()).toEqual({ id: newest.id, date: newest.date, title: newest.title });
    expect(latestNewsId()).toBe(newest.id);
    // The first download's index holds articles, moved ids and one release: nothing else that grows with each release.
    expect(Object.keys(INDEX).sort()).toEqual(['articles', 'latest', 'moved']);
    // By id, not title: a release may share its title with an article (“Guardrails on a goal”).
    expect(JSON.stringify(INDEX)).not.toContain(`"${WHATS_NEW[1]!.id}"`);
    expect(JSON.stringify(INDEX)).not.toContain(WHATS_NEW[1]!.points[0]!);
  });

  it('says something is new exactly when What’s new would list a release as unread, and the newest first', () => {
    for (const seen of [null, 'no-such-release', WHATS_NEW[3]!.id, WHATS_NEW[0]!.id]) {
      const full = fullNewsAfter(seen);
      expect(unreadSince(seen).map((e) => e.id)).toEqual(full.slice(0, 1).map((e) => e.id));
    }
  });

  it('lists every release, newest first, with its date and title, for the screens that list them', () => {
    expect(NEWS).toEqual(WHATS_NEW.map((e) => ({ id: e.id, date: e.date, title: e.title })));
  });

  it('finds the same article and route for an address as the guide', () => {
    for (const [path, search] of [['/', ''], ['/goals/G-12', ''], ['/goals/new', ''], ['/goals', '?review=r1'], ['/help/check-in', ''], ['/nowhere/at/all', '']] as const) {
      expect(articleForPath(path, search)?.id).toBe(guideArticle(path, search)?.id);
      expect(appRouteFor(path)).toBe(guideRoute(path));
    }
  });
});
