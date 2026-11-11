/* The Help index the build makes (vite.helpIndex.ts) says what the guide and What's new say: the first download reads
   it instead of them (src/help/lookup.ts), so it must never drift from them. */
import { ARTICLES, MOVED_ARTICLES, appRouteFor as guideRoute, articleById, articleForPath as guideArticle } from './guide';
import { WHATS_NEW, newsAfter as fullNewsAfter } from './whatsNew';
import { NEWS, appRouteFor, articleForPath, articleRef, latestNewsId, newsAfter } from './lookup';

describe('the Help index', () => {
  it('has every guide article, in order, with its title and routes', () => {
    expect(ARTICLES.map((a) => articleRef(a.id))).toEqual(ARTICLES.map((a) => ({ id: a.id, title: a.title, routes: a.routes, ...(a.module ? { module: a.module } : {}) })));
    for (const old of Object.keys(MOVED_ARTICLES)) expect(articleRef(old)?.id).toBe(articleById(old)?.id);
  });

  it('has every What’s new release, newest first, with its date and title', () => {
    expect(NEWS).toEqual(WHATS_NEW.map((e) => ({ id: e.id, date: e.date, title: e.title })));
    expect(latestNewsId()).toBe(WHATS_NEW[0]?.id);
    for (const seen of [null, 'no-such-release', WHATS_NEW[3]!.id]) expect(newsAfter(seen).map((e) => e.id)).toEqual(fullNewsAfter(seen).map((e) => e.id));
  });

  it('finds the same article and route for an address as the guide', () => {
    for (const [path, search] of [['/', ''], ['/goals/G-12', ''], ['/goals/new', ''], ['/goals', '?review=r1'], ['/help/check-in', ''], ['/nowhere/at/all', '']] as const) {
      expect(articleForPath(path, search)?.id).toBe(guideArticle(path, search)?.id);
      expect(appRouteFor(path)).toBe(guideRoute(path));
    }
  });
});
