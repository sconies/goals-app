// @vitest-environment node
/* Keeping Help true. Like the AI parity test, these fail when the app grows without its guide: a new screen, route
   or requirement with no article, a What's new entry out of order, or a link that leads nowhere. */
import fs from 'node:fs';
import path from 'node:path';
import { ARTICLES, GROUPS, articleById, articleForPath, guideRoutes, searchGuide } from './guide';
import { WHATS_NEW, newsAfter, newsSince } from './whatsNew';

const root = path.join(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]!);
/** Routes with no article of their own: the not-found page. */
const NO_ARTICLE = new Set(['*']);

describe('The guide covers the whole app', () => {
  it('has an article listing every screen file in src/screens', () => {
    const screens = fs.readdirSync(path.join(root, 'src/screens')).filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''));
    const listed = new Set(ARTICLES.flatMap((a) => a.screens));
    expect(screens.filter((s) => !listed.has(s))).toEqual([]);
    // …and names only screens that exist.
    expect([...listed].filter((s) => !screens.includes(s))).toEqual([]);
  });

  it('covers every requirement in evals/requirements.json, and names only real ones', () => {
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'evals/requirements.json'), 'utf8')) as { requirements: { id: string }[] };
    const ids = spec.requirements.map((r) => r.id);
    const covered = new Set(ARTICLES.flatMap((a) => a.reqs));
    expect(ids.filter((r) => !covered.has(r))).toEqual([]);
    expect([...covered].filter((r) => !ids.includes(r))).toEqual([]);
    expect(ids).toEqual(expect.arrayContaining(['HELP-GUIDE', 'WHATS-NEW']));
  });

  it('maps every route in App.tsx to an article (except the not-found page), and names only real routes', () => {
    expect(routes.length).toBeGreaterThan(25);
    const explained = guideRoutes();
    expect(routes.filter((r) => !NO_ARTICLE.has(r) && !explained.includes(r))).toEqual([]);
    expect(explained.filter((r) => !routes.includes(r))).toEqual([]);
    for (const r of routes.filter((x) => !NO_ARTICLE.has(x))) {
      expect(articleForPath(r.replace(/:[^/]+/g, 'x1')), r).toBeDefined();
    }
  });

  it('gives every article an id, a title, a summary, sections, keywords and a known group', () => {
    const groups = new Set(GROUPS.map((g) => g.id));
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(a.id, a.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(a.title.length, a.id).toBeGreaterThan(3);
      expect(a.summary.length, a.id).toBeGreaterThan(30);
      expect(a.sections.length, a.id).toBeGreaterThan(0);
      for (const s of a.sections) expect((s.text?.length ?? 0) + (s.list?.length ?? 0), `${a.id}: ${s.heading}`).toBeGreaterThan(0);
      expect(a.keywords.length, a.id).toBeGreaterThan(2);
      expect(groups.has(a.group), a.id).toBe(true);
    }
    for (const g of GROUPS) expect(ARTICLES.some((a) => a.group === g.id), g.id).toBe(true);
  });

  it('has links that all resolve: related articles and What’s new’s articles', () => {
    for (const a of ARTICLES) expect(a.related.filter((r) => !articleById(r) || r === a.id), a.id).toEqual([]);
    for (const e of WHATS_NEW) {
      expect(e.articles.length, e.id).toBeGreaterThan(0);
      expect(e.articles.filter((r) => !articleById(r)), e.id).toEqual([]);
    }
  });

  it('opens the right article for a page', () => {
    const at = (p: string, q = '') => articleForPath(p, q)?.id;
    expect(at('/')).toBe('home');
    expect(at('/goals')).toBe('goals');
    expect(at('/goals', '?view=table')).toBe('goals');
    expect(at('/goals', '?view=map')).toBe('goal-map');
    expect(at('/goals', '?view=history&hist=weekly')).toBe('history');
    expect(at('/goals', '?show=attention')).toBe('needs-attention');
    expect(at('/goals/new')).toBe('new-goal');
    expect(at('/goals/head')).toBe('goal-page');
    expect(at('/goals/head', '?review=weekly')).toBe('reviews');
    expect(at('/goals/head/edit')).toBe('edit-goal');
    expect(at('/goals/head/print')).toBe('print');
    expect(at('/check-in/alerts')).toBe('check-in');
    expect(at('/reviews/weekly/summary')).toBe('reviews');
    expect(at('/data')).toBe('data');
    expect(at('/nowhere')).toBeUndefined();
  });

  it('finds articles by what they cover', () => {
    expect(searchGuide('dark mode')[0]?.id).toBe('settings');
    expect(searchGuide('plan change reason').map((a) => a.id)).toContain('edit-goal');
    expect(searchGuide('token')[0]?.id).toBe('ai-assistants');
    expect(searchGuide('  ')).toEqual([]);
    expect(searchGuide('xylophone')).toEqual([]);
  });
});

describe('What’s new', () => {
  it('is newest first, with unique stable ids, real dates and two to six plain lines each', () => {
    expect(WHATS_NEW.length).toBeGreaterThan(10);
    expect(new Set(WHATS_NEW.map((e) => e.id)).size).toBe(WHATS_NEW.length);
    for (const [i, e] of WHATS_NEW.entries()) {
      expect(e.id, e.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(e.date, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(e.date + 'T00:00:00Z').toISOString().slice(0, 10), e.id).toBe(e.date);
      if (i > 0) expect(e.date <= WHATS_NEW[i - 1]!.date, `${e.id} is out of order`).toBe(true);
      expect(e.points.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.points.length, e.id).toBeLessThanOrEqual(6);
      expect(e.title.length, e.id).toBeGreaterThan(5);
    }
  });

  it('counts what a person hasn’t seen, and filters by date', () => {
    expect(newsAfter(null)).toHaveLength(WHATS_NEW.length);
    expect(newsAfter(WHATS_NEW[0]!.id)).toEqual([]);
    expect(newsAfter(WHATS_NEW[2]!.id).map((e) => e.id)).toEqual([WHATS_NEW[0]!.id, WHATS_NEW[1]!.id]);
    expect(newsAfter('an-id-that-was-never-used')).toHaveLength(WHATS_NEW.length);
    expect(newsSince('2026-11-05').every((e) => e.date >= '2026-11-05')).toBe(true);
    expect(newsSince()).toHaveLength(WHATS_NEW.length);
  });
});
