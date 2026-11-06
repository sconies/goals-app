// @vitest-environment node
/* The MCP server's markup tools: a builder token lists, opens and triages markups, through the same operations as
   the inbox; any other token is told to get a builder token from the inbox. */
import { serve, type Deps } from '../../server/mcp';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { WHATS_NEW } from '../help/whatsNew';
import { buildMarkup, type Markup } from '../markup/model';
import { markupOps, type MarkupStore } from '../markup/ops';
import type { ApiToken, Snapshot } from '../domain/types';
import { hashToken, newToken } from './protocol';

const today = new Date('2026-11-05T12:00:00Z');

function markup(id: string, line: string, createdAt: string): Markup {
  return buildMarkup({
    id, line, mood: null, includeSteps: false, strokes: [{ kind: 'box', x: 10, y: 10, w: 50, h: 50 }],
    parts: [{ path: ['Home', 'Your goals'], rect: { x: 0, y: 0, w: 300, h: 300 } }], pathname: '/', search: '', route: '/',
    workspace: { id: 'platform-org', name: 'Platform Engineering' }, demo: true, person: { id: 'rhea', name: 'Rhea Kapoor' },
    context: { viewport: { w: 390, h: 844, dpr: 3 }, theme: 'light', themeChoice: 'light', accent: 'faro', appVersion: WHATS_NEW[0]!.id, sessionId: 'b'.repeat(32) },
    steps: [], errors: [], pictures: ['screen.png'], now: createdAt,
  });
}

async function setup(builder: boolean) {
  let data: Snapshot = structuredClone(buildPlatformOrg(today));
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId: 'grace', name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const list = [markup('mk_aaaaaaaaaaaaaaaa', 'Goals list is cramped', '2026-11-05T09:00:00Z'), markup('mk_bbbbbbbbbbbbbbbb', 'Streak is confusing', '2026-11-05T10:00:00Z')];
  const store: MarkupStore = {
    list: async (o) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((m) => !o.status || m.status === o.status).slice(0, o.limit),
    get: async (id) => list.find((m) => m.id === id) ?? null,
    update: async (id, p) => { const i = list.findIndex((m) => m.id === id); list[i] = { ...list[i]!, ...p }; return list[i]!; },
    pictureUrl: async () => null,
  };
  let askedFor = '';
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org', builder } : null),
    workspaceName: async () => 'Platform Engineering',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    markups: (hash) => { askedFor = hash; return markupOps({ store, entries: WHATS_NEW.map((e) => e.id), repo: 'sconies/goals-app' }); },
    now: () => today,
  };
  let n = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    return (await res.json() as { result: { content: { text: string }[]; structuredContent?: Record<string, any>; isError: boolean } }).result;
  };
  return { call, list, hash: t.tokenHash!, askedFor: () => askedFor };
}

describe('the MCP server’s markup tools', () => {
  it('let a builder token list, open and triage markups, through the same operations as the inbox', async () => {
    const b = await setup(true);
    const listed = await b.call('list_markups');
    expect(listed.isError).toBe(false);
    expect(listed.structuredContent!.markups.map((m: { id: string }) => m.id)).toEqual(['mk_bbbbbbbbbbbbbbbb', 'mk_aaaaaaaaaaaaaaaa']);
    expect(listed.content[0]!.text).toContain('Home › Your goals');
    expect(b.askedFor()).toBe(b.hash);
    const opened = await b.call('get_markup', { id: 'mk_aaaaaaaaaaaaaaaa' });
    expect(opened.content[0]!.text).toContain('Goals list is cramped');
    expect(opened.content[0]!.text).toContain('open it in Faro’s inbox');
    const fixed = await b.call('update_markup', { id: 'mk_aaaaaaaaaaaaaaaa', status: 'fixed', fixed_in: WHATS_NEW[0]!.id, issue_url: 'https://github.com/sconies/goals-app/issues/9' });
    expect(fixed.isError).toBe(false);
    expect(b.list[0]).toMatchObject({ status: 'fixed', fixedIn: WHATS_NEW[0]!.id, issueUrl: 'https://github.com/sconies/goals-app/issues/9' });
    expect(b.list[0]!.statusBy).toMatch(/via AI assistant/);
    // The rules are the inbox's: Won't fix needs a reason.
    expect((await b.call('update_markup', { id: 'mk_bbbbbbbbbbbbbbbb', status: 'wont-fix' })).isError).toBe(true);
  });

  it('tell an ordinary token that only a builder token reads markups', async () => {
    const o = await setup(false);
    const r = await o.call('list_markups');
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/builder token/);
    expect(o.askedFor()).toBe('');
  });
});
