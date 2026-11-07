// @vitest-environment node
/* The MCP server's feedback tools: an admin's token lists the workspace's feedback; a builder token lists every
   workspace's with its status, opens one and triages it, through the same operations and rules as the inbox. */
import { serve, type Deps } from '../../server/mcp';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { WHATS_NEW } from '../help/whatsNew';
import { feedbackOps, type FeedbackStore, type InboxFeedback } from '../markup/feedback';
import type { ApiToken, Snapshot } from '../domain/types';
import { hashToken, newToken } from './protocol';

const today = new Date('2026-11-05T12:00:00Z');
const fb = (id: string, workspaceId: string, at: string, o: Partial<InboxFeedback> = {}): InboxFeedback => ({
  id, workspaceId, workspaceName: workspaceId === 'platform-org' ? 'Platform Engineering' : 'Acme', personId: 'mateo', personName: 'Mateo Fernández',
  path: '/check-in', mood: 'bad', text: 'The reason box is too small', at, status: 'new', fixedIn: null, wontFixReason: null, statusBy: null, statusAt: null, ...o,
});

async function setup(o: { builder: boolean; person?: string }) {
  let data: Snapshot = structuredClone(buildPlatformOrg(today));
  const token = newToken();
  const person = o.person ?? 'grace';
  const t: ApiToken = { id: 'tok1', personId: person, name: 'Test', tokenHash: await hashToken(token), createdBy: person, createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const list = [fb('fb_a', 'platform-org', '2026-11-05T09:00:00.000Z'), fb('fb_b', 'acme', '2026-11-05T10:00:00.000Z', { mood: 'good', text: 'Calm', status: 'in-hand' })];
  const store: FeedbackStore = {
    list: async (limit, q) => [...list].sort((a, b) => b.at.localeCompare(a.at)).filter((f) => (!q?.status || f.status === q.status) && (!q?.workspaceId || f.workspaceId === q.workspaceId)).slice(0, limit),
    get: async (id) => list.find((f) => f.id === id) ?? null,
    update: async (id, p) => { const i = list.findIndex((f) => f.id === id); if (i < 0) return null; list[i] = { ...list[i]!, ...p }; return p; },
  };
  let askedFor = '';
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org', builder: o.builder } : null),
    workspaceName: async () => 'Platform Engineering',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    feedback: (hash) => { askedFor = hash; return feedbackOps({ store, entries: WHATS_NEW.map((e) => e.id), now: () => today }); },
    now: () => today,
  };
  let n = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    return (await res.json() as { result: { content: { text: string }[]; structuredContent?: Record<string, any>; isError: boolean } }).result;
  };
  return { call, list, hash: t.tokenHash!, askedFor: () => askedFor };
}

describe('the MCP server’s feedback tools', () => {
  it('let a builder token list every workspace’s feedback with its status, open one and triage it with the inbox’s rules', async () => {
    const b = await setup({ builder: true });
    const listed = await b.call('list_feedback');
    expect(listed.isError).toBe(false);
    expect(listed.structuredContent!.feedback.map((f: { id: string; status: string }) => [f.id, f.status])).toEqual([['fb_b', 'in-hand'], ['fb_a', 'new']]);
    expect(listed.content[0]!.text).toContain('fb_b · In hand · It helps · “Calm”');
    expect(b.askedFor()).toBe(b.hash);
    expect((await b.call('list_feedback', { status: 'new' })).structuredContent!.feedback.map((f: { id: string }) => f.id)).toEqual(['fb_a']);
    expect((await b.call('list_feedback', { workspace: 'acme' })).structuredContent!.feedback.map((f: { id: string }) => f.id)).toEqual(['fb_b']);
    const opened = await b.call('get_feedback', { id: 'fb_a' });
    expect(opened.content[0]!.text).toMatch(/fb_a · New\n“The reason box is too small”, saying It gets in the way\.\nFrom Mateo Fernández in Platform Engineering/);
    expect((await b.call('get_feedback', { id: 'fb_gone' })).isError).toBe(true);
    // The inbox's rules: fixed names a What's new entry that exists; won't fix needs a reason.
    expect((await b.call('update_feedback', { id: 'fb_a', status: 'fixed' })).isError).toBe(true);
    expect((await b.call('update_feedback', { id: 'fb_a', status: 'fixed', fixed_in: 'no-such-entry' })).isError).toBe(true);
    expect((await b.call('update_feedback', { id: 'fb_a', status: 'wont-fix' })).isError).toBe(true);
    const fixed = await b.call('update_feedback', { id: 'fb_a', status: 'fixed', fixed_in: WHATS_NEW[0]!.id });
    expect(fixed.isError).toBe(false);
    expect(fixed.content[0]!.text).toBe(`fb_a is Fixed, fixed in ${WHATS_NEW[0]!.id}.`);
    expect(b.list.find((f) => f.id === 'fb_a')).toMatchObject({ status: 'fixed', fixedIn: WHATS_NEW[0]!.id, statusAt: today.toISOString() });
    expect(b.list.find((f) => f.id === 'fb_a')!.statusBy).toMatch(/via AI assistant/);
    const wont = await b.call('update_feedback', { id: 'fb_b', status: 'wont-fix', reason: 'Calm is the point.' });
    expect(wont.content[0]!.text).toBe('fb_b is Won’t fix: Calm is the point.');
  });

  it('give an admin’s ordinary token this workspace’s feedback, without statuses, and nothing more', async () => {
    const o = await setup({ builder: false });
    const listed = await o.call('list_feedback');
    expect(listed.isError).toBe(false);
    expect(listed.structuredContent!.feedback.every((f: Record<string, unknown>) => !('status' in f))).toBe(true);
    for (const [name, args] of [['list_feedback', { status: 'new' }], ['get_feedback', { id: 'fb_a' }], ['update_feedback', { id: 'fb_a', status: 'in-hand' }]] as const) {
      const r = await o.call(name, args);
      expect(r.isError, name).toBe(true);
      expect(r.content[0]!.text, name).toMatch(/builder token/);
    }
    expect(o.askedFor()).toBe('');
  });

  it('tell someone who is neither a builder nor an admin that only admins read the feedback', async () => {
    const r = await (await setup({ builder: false, person: 'oskar' })).call('list_feedback');
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe('Only admins can read the feedback.');
  });
});
