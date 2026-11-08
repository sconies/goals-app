// @vitest-environment node
/* The MCP server's markup tools: any token (an ordinary one, of someone who isn't an admin, included) lists, opens and
   triages markups, through the same operations as the inbox (backlog O: Faro's inbox is open on purpose). */
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

async function setup(o: { inbox?: boolean; pictures?: boolean; person?: string } = {}) {
  const withKey = o.pictures ?? false;
  const person = o.person ?? 'oskar';
  let data: Snapshot = structuredClone(buildPlatformOrg(today));
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId: person, name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const list = [markup('mk_aaaaaaaaaaaaaaaa', 'Goals list is cramped', '2026-11-05T09:00:00Z'), markup('mk_bbbbbbbbbbbbbbbb', 'Streak is confusing', '2026-11-05T10:00:00Z')];
  const store: MarkupStore = {
    list: async (o) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((m) => !o.status || m.status === o.status).slice(0, o.limit),
    get: async (id) => list.find((m) => m.id === id) ?? null,
    update: async (id, p) => { const i = list.findIndex((m) => m.id === id); list[i] = { ...list[i]!, ...p }; return list[i]!; },
    pictureUrl: async () => null,
    ...(withKey ? { pictureBytes: async (id: string, name: string) => (list.some((m) => m.id === id) ? new TextEncoder().encode(`${id}/${name}`) : null) } : {}),
  };
  let askedFor = '';
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Platform Engineering',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    ...(o.inbox === false ? {} : { markups: (hash: string) => { askedFor = hash; return markupOps({ store, entries: WHATS_NEW.map((e) => e.id), repo: 'sconies/goals-app' }); } }),
    now: () => today,
  };
  let n = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    return (await res.json() as { result: { content: { type: string; text?: string; data?: string; mimeType?: string }[]; structuredContent?: Record<string, any>; isError: boolean } }).result;
  };
  const get = (q: string, auth = true) => serve(new Request(`https://x/api/mcp?${q}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} }), deps);
  const rpc = async (method: string, params: object = {}) => (await (await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }) }), deps)).json() as { result?: any; error?: { message: string } });
  return { call, get, rpc, deps, list, hash: t.tokenHash!, askedFor: () => askedFor };
}

describe('the MCP server’s markup tools', () => {
  it('let any token list, open and triage markups, through the same operations as the inbox', async () => {
    // Oskar isn't an admin, and his is an ordinary token.
    const b = await setup();
    const listed = await b.call('list_markups');
    expect(listed.isError).toBe(false);
    expect(listed.structuredContent!.markups.map((m: { id: string }) => m.id)).toEqual(['mk_bbbbbbbbbbbbbbbb', 'mk_aaaaaaaaaaaaaaaa']);
    expect(listed.content[0]!.text).toContain('Home › Your goals');
    expect(b.askedFor()).toBe(b.hash);
    const opened = await b.call('get_markup', { id: 'mk_aaaaaaaaaaaaaaaa' });
    expect(opened.content[0]!.text).toContain('Goals list is cramped');
    // When pictures can't be read, it says plainly why and what fixes it, and sends no picture.
    expect(opened.content[0]!.text).toContain('Migration 0031');
    expect(opened.content.filter((c) => c.type === 'image')).toEqual([]);
    const fixed = await b.call('update_markup', { id: 'mk_aaaaaaaaaaaaaaaa', status: 'fixed', fixed_in: WHATS_NEW[0]!.id, issue_url: 'https://github.com/sconies/goals-app/issues/9' });
    expect(fixed.isError).toBe(false);
    expect(b.list[0]).toMatchObject({ status: 'fixed', fixedIn: WHATS_NEW[0]!.id, issueUrl: 'https://github.com/sconies/goals-app/issues/9' });
    expect(b.list[0]!.statusBy).toBe('Oskar Lindgren via AI assistant (MCP)');
    // The rules are the inbox's: Won't fix needs a reason.
    expect((await b.call('update_markup', { id: 'mk_bbbbbbbbbbbbbbbb', status: 'wont-fix' })).isError).toBe(true);
  });

  it('say plainly when the server has no inbox to read', async () => {
    const o = await setup({ inbox: false });
    const r = await o.call('list_markups');
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe('This server has no inbox to read.');
  });

  it('send a markup’s picture inside get_markup as MCP image content, when the server can read pictures', async () => {
    const b = await setup({ pictures: true });
    const opened = await b.call('get_markup', { id: 'mk_aaaaaaaaaaaaaaaa' });
    const image = opened.content.find((c) => c.type === 'image')!;
    // The test markup keeps only screen.png, so that is what comes back.
    expect(image).toMatchObject({ mimeType: 'image/png' });
    expect(Buffer.from(image.data!, 'base64').toString()).toBe('mk_aaaaaaaaaaaaaaaa/screen.png');
    expect(opened.content[0]!.text).toContain('Picture: the screen, below.');
    expect(opened.structuredContent!.markup.picture).toMatchObject({ name: 'screen.png', mimeType: 'image/png' });
    expect((await b.call('get_markup', { id: 'mk_aaaaaaaaaaaaaaaa', picture: 'none' })).content.some((c) => c.type === 'image')).toBe(false);
  });

  it('review the inbox in one step: new markups grouped by screen part with a picture each, and feedback by page', async () => {
    const b = await setup({ pictures: true });
    const r = await b.call('review_inbox');
    expect(r.isError).toBe(false);
    const text = r.content[0]!.text!;
    expect(text).toContain('New in the inbox: 2 markups on 1 part');
    expect(text).toContain('## Home › Your goals · / · 2 markups · picture 1 is mk_bbbbbbbbbbbbbbbb');
    expect(text.indexOf('Streak is confusing')).toBeLessThan(text.indexOf('Goals list is cramped'));
    expect(text).toContain('the demo');
    expect(r.content.filter((c) => c.type === 'image')).toHaveLength(1);
    expect(r.structuredContent!.groups[0].markups.map((m: { id: string }) => m.id)).toEqual(['mk_bbbbbbbbbbbbbbbb', 'mk_aaaaaaaaaaaaaaaa']);
    // When pictures can't be read: the same review, no pictures, and the plain reason.
    const nokey = await (await setup()).call('review_inbox');
    expect(nokey.content.some((c) => c.type === 'image')).toBe(false);
    expect(nokey.content[0]!.text).toContain('Pictures: Markup pictures can’t be read here yet');
  });

  it('offer review_inbox as a prompt too', async () => {
    const b = await setup();
    const listed = await b.rpc('prompts/list');
    expect(listed.result.prompts.map((p: { name: string }) => p.name)).toEqual(['review_inbox']);
    const got = await b.rpc('prompts/get', { name: 'review_inbox' });
    expect(got.result.messages[0].content.text).toContain('review_inbox');
    expect((await b.rpc('prompts/get', { name: 'nope' })).error).toBeDefined();
    expect((await b.rpc('initialize', { protocolVersion: '2025-06-18' })).result.capabilities.prompts).toBeDefined();
  });

  it('serve a picture to any token, and say plainly when pictures can’t be read', async () => {
    const b = await setup({ pictures: true });
    const res = await b.get('picture=mk_aaaaaaaaaaaaaaaa/screen.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(await res.text()).toBe('mk_aaaaaaaaaaaaaaaa/screen.png');
    expect((await b.get('picture=mk_aaaaaaaaaaaaaaaa/ink.png')).status).toBe(404);
    expect((await b.get('picture=mk_aaaaaaaaaaaaaaaa/../secret')).status).toBe(404);
    expect((await b.get('picture=mk_aaaaaaaaaaaaaaaa/screen.png', false)).status).toBe(401);
    const nokey = await (await setup()).get('picture=mk_aaaaaaaaaaaaaaaa/screen.png');
    expect(nokey.status).toBe(503);
    expect(await nokey.text()).toContain('Migration 0031');
    expect((await (await setup({ inbox: false })).get('picture=mk_aaaaaaaaaaaaaaaa/screen.png')).status).toBe(503);
  });

  it('answer the check after each deploy without a token: ok only when pictures can be read', async () => {
    const b = await setup();
    expect((await b.get('check', false)).status).toBe(503);
    b.deps.check = async () => ({ ok: false, database: true, pictures: false, problems: ['no key'] });
    const missing = await b.get('check', false);
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({ pictures: false, problems: ['no key'] });
    b.deps.check = async () => ({ ok: true, database: true, pictures: true, problems: [] });
    expect((await b.get('check', false)).status).toBe(200);
  });
});
