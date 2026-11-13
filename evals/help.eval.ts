/* Spec scenarios for Help and What's new: the guide covers every screen, route and requirement and opens the right
   article for a page; What's new is in order and its links resolve; the CI check refuses an app change without news;
   and an AI assistant reads both through the MCP server. */
import fs from 'node:fs';
import path from 'node:path';
import { appRoutes, leftOut, leftOutArticles, screenFiles } from '../src/core/sources';
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit } from '../src/data/store';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';
import { SCREENS } from '../src/mcp/parity';
import { ARTICLES, articleById, articleForPath, guideRoutes, searchGuide } from '../src/help/guide';
import { WHATS_NEW, newsAfter } from '../src/help/whatsNew';
// @ts-expect-error: a plain script, without type declarations
import { decide } from '../scripts/check-whats-new.mjs';

const G = (text: string) => `[HELP-GUIDE] ${text}`;
const N = (text: string) => `[WHATS-NEW] ${text}`;
const root = path.join(__dirname, '..');
/** What this build leaves out (FARO_WITHOUT), excused from the checks that the guide is complete. */
const gone = leftOut(root);
const OCT = new Date('2026-11-05T12:00:00Z');

async function assistant(personId = 'rhea') {
  let data: Snapshot = seed(OCT);
  const token = newToken();
  const t: ApiToken = { id: 'tok-help', personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: OCT.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [...(data.tokens ?? []), t] };
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Developer Platform',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    now: () => OCT,
  };
  let n = 0;
  return async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    const body = await res.json() as { result: { content: { text: string }[]; structuredContent?: Record<string, any>; isError: boolean } };
    return { text: body.result.content[0]!.text, data: body.result.structuredContent, error: body.result.isError };
  };
}

describe('Help: what everything does', () => {
  it(G('every screen file, every route and every requirement has an article'), async () => {
    // The core's screens and routes, and those of the modules this build has (src/core/sources.ts). A screen that a
    // left-out module's own article explains goes with it, even while its file still sits in src/screens (until FT3).
    const theirs = await leftOutArticles(root);
    const screens = screenFiles(root).map((f) => f.name).filter((s) => !theirs.some((a) => a.screens.includes(s)));
    expect(screens.filter((s) => !ARTICLES.some((a) => a.screens.includes(s)))).toEqual([]);
    const routes = appRoutes(root).filter((r) => r !== '*');
    expect(routes.filter((r) => !guideRoutes().includes(r))).toEqual([]);
    const reqs = (JSON.parse(fs.readFileSync(path.join(root, 'evals/requirements.json'), 'utf8')) as { requirements: { id: string }[] }).requirements.map((r) => r.id);
    // A module left out of this build (FARO_WITHOUT) takes its articles with it: its requirements, and those its
    // articles explain, are excused.
    expect(reqs.filter((r) => !gone.requirements.has(r) && !theirs.some((a) => a.reqs.includes(r)) && !ARTICLES.some((a) => a.reqs.includes(r)))).toEqual([]);
  });

  it(G('the Help link on a page opens that page’s article, the most specific one'), () => {
    expect(articleForPath('/goals', '?view=map')?.id).toBe('goal-map');
    expect(articleForPath('/goals/new')?.id).toBe('new-goal');
    expect(articleForPath('/goals/G-12')?.id).toBe('goal-page');
    // A walk's address is Reviews' article; without Reviews it is the goal's page (the app drops ?review= there).
    expect(articleForPath('/goals/ns-lead', '?review=weekly')?.id).toBe(gone.help.has('reviews') ? 'goal-page' : 'reviews');
    expect(articleForPath('/quick-check-in')?.id).toBe('check-in-table');
  });

  it(G('search finds articles by what they cover, and every link in the guide leads somewhere'), () => {
    expect(searchGuide('accent colour')[0]?.id).toBe('settings');
    expect(searchGuide('quarter results met missed')[0]?.id).toBe('history');
    for (const a of ARTICLES) for (const r of a.related.filter((x) => !gone.help.has(x))) expect(articleById(r), `${a.id} → ${r}`).toBeDefined();
  });

  it(G('the status article reads its words and numbers from the status rules, not a copy'), () => {
    const s = articleById('status')!;
    const text = s.sections.flatMap((x) => [...(x.text ?? []), ...(x.list ?? [])]).join(' ');
    expect(text).toMatch(/At least 95% of the progress planned/);
    expect(text).toMatch(/No recent update: The latest check-in was posted 14 days ago or more/);
    expect(text).not.toMatch(/No recent update: No recent update/);
  });

  it(G('an AI assistant reads the guide: an article by id, a search, or the list, and every screen maps to a tool'), async () => {
    const call = await assistant();
    // A module's article is there only when the build has the module; a core article always is.
    expect((await call('get_help', { id: 'reviews' })).error).toBe(gone.help.has('reviews'));
    // Asks lists Reviews under Related: without the module it lists the rest, and still answers.
    const one = await call('get_help', { id: 'requests' });
    expect(one.error).toBe(false);
    expect(one.data!.related.map((r: { id: string }) => r.id)).toEqual(articleById('requests')!.related.filter((r) => !gone.help.has(r)));
    expect(one.data!.title).toBe(articleById('requests')!.title);
    expect(one.text).toMatch(/## Who can/);
    expect((await call('get_help', { search: 'dark mode' })).data!.articles[0].id).toBe('settings');
    expect((await call('get_help')).data!.articles).toHaveLength(ARTICLES.length);
    const missing = await call('get_help', { id: 'nope' });
    expect(missing.error).toBe(true);
    expect(missing.text).toMatch(/no help article/);
    expect(SCREENS.Help).toEqual(['get_help', 'whats_new']);
  });
});

describe('What’s new', () => {
  it(N('entries are newest first, with unique ids, real dates, two to six lines and guide links that resolve'), () => {
    expect(new Set(WHATS_NEW.map((e) => e.id)).size).toBe(WHATS_NEW.length);
    WHATS_NEW.forEach((e, i) => {
      expect(Number.isNaN(Date.parse(e.date))).toBe(false);
      if (i) expect(e.date <= WHATS_NEW[i - 1]!.date).toBe(true);
      expect(e.points.length).toBeGreaterThanOrEqual(2);
      expect(e.points.length).toBeLessThanOrEqual(6);
      expect(e.articles.every((a) => gone.help.has(a) || !!articleById(a))).toBe(true);
    });
    // The release that brought Help and What's new is listed (newer releases go above it).
    expect(WHATS_NEW.some((e) => e.id === 'help-and-whats-new')).toBe(true);
    expect(WHATS_NEW.some((e) => e.date === '2026-11-04' && /AI assistant/.test(e.title))).toBe(true);
  });

  it(N('what a person hasn’t seen is everything newer than the last entry they saw'), () => {
    expect(newsAfter(null).length).toBe(WHATS_NEW.length);
    expect(newsAfter(WHATS_NEW[0]!.id)).toEqual([]);
    expect(newsAfter(WHATS_NEW[1]!.id).map((e) => e.id)).toEqual([WHATS_NEW[0]!.id]);
  });

  it(N('CI refuses a change to the app without an entry, unless a commit says [no news]'), () => {
    expect(decide(['src/screens/Home.tsx'], ['Change Home']).ok).toBe(false);
    expect(decide(['supabase/migrations/0022_x.sql'], ['x']).ok).toBe(false);
    expect(decide(['src/screens/Home.tsx', 'src/help/whatsNew.ts'], ['x']).ok).toBe(true);
    expect(decide(['src/domain/plan.ts'], ['Tidy a helper [no news]']).ok).toBe(true);
    expect(decide(['src/domain/plan.test.ts', 'evals/x.eval.ts', 'docs/a.md'], ['x']).ok).toBe(true);
  });

  it(N('an AI assistant reads what’s new, all of it or since a date'), async () => {
    const call = await assistant();
    const all = await call('whats_new');
    expect(all.data!.entries).toHaveLength(WHATS_NEW.length);
    expect(all.data!.entries[0].title).toBe(WHATS_NEW[0]!.title);
    const recent = await call('whats_new', { since: '2026-11-04' });
    expect(recent.data!.entries.every((e: { date: string }) => e.date >= '2026-11-04')).toBe(true);
    expect(recent.data!.entries.length).toBeLessThan(WHATS_NEW.length);
    expect((await call('whats_new', { limit: 2 })).data!.entries).toHaveLength(2);
    expect((await call('whats_new', { since: 'last week' })).error).toBe(true);
  });
});
