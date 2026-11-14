// @vitest-environment node
/* AI access behind its switch (SW2, docs/design/feature-switches/spec.md 6.1 and 6.2): while it is off in the workspace,
   the MCP server answers every request but initialize and tools/list with one sentence, lets tools/list through so a
   connected tool sees why each call refuses, and doesn't move the token's last use. set_feature switching it off says
   the connection stops now; the app refuses to make a token and still revokes one. */
import { serve, type Deps } from '../../server/mcp';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { hashToken, newToken } from './protocol';
import type { ApiToken, Snapshot } from '../domain/types';
import { performAny } from '../app/actions';
import { NotAllowed } from '../domain/actions';

const today = new Date('2026-11-05T12:00:00Z');
const built = buildPlatformOrg(today);
const SHUT = 'AI access is switched off in Platform Engineering. An admin can switch it on in Faro, under Workspace, Features.';

async function setup(personId: string, off: string[] = []) {
  let data: Snapshot = structuredClone(built);
  let modulesOff = off;
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId, name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const touched: string[] = [];
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Platform Engineering',
    modulesOff: async () => modulesOff,
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); if (c.modulesOff !== undefined) modulesOff = c.modulesOff; },
    touch: async (id) => { touched.push(id); },
    now: () => today,
  };
  const post = async (body: unknown) => (await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), deps)).json();
  const call = (id: number, name: string, args: object = {}) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
  return { post, call, touched, data: () => data };
}

describe('AI access’s door (SW2)', () => {
  it('while on, answers as ever and records the token’s use', async () => {
    const { post, call, touched } = await setup('grace');
    const r = await post(call(1, 'list_tokens'));
    expect(r.result.isError).toBe(false);
    expect(touched).toEqual(['tok1']);
  });

  it('while off, refuses every call with its sentence, lets initialize and tools/list through, and doesn’t record a use', async () => {
    const { post, call, touched } = await setup('grace', ['ai-access']);
    for (const tool of ['get_my_work', 'list_tokens', 'set_feature']) {
      const r = await post(call(1, tool, tool === 'set_feature' ? { feature: 'ai-access', on: true } : {}));
      expect(r.error, tool).toEqual({ code: -32001, message: SHUT });
    }
    const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(list.result.tools.length).toBeGreaterThan(10);
    const init = await post({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    expect(init.result.serverInfo).toBeDefined();
    const batch = await post([{ jsonrpc: '2.0', id: 4, method: 'tools/list' }, call(5, 'get_my_work'), { jsonrpc: '2.0', method: 'notifications/initialized' }]);
    expect(batch.map((x: { id: number; error?: unknown }) => [x.id, !!x.error])).toEqual([[4, false], [5, true]]);
    expect(touched).toEqual([]);
  });

  it('set_feature switching it off is the last thing the token does, and says so', async () => {
    const { post, call } = await setup('grace');
    const r = await post(call(1, 'set_feature', { feature: 'ai-access', on: false }));
    expect(r.result.content[0].text).toBe('AI access is off in Platform Engineering. This connection stops working now. An admin switches it back on in Faro.');
    expect((await post(call(2, 'get_my_work'))).error.message).toBe(SHUT);
  });

  it('in the app, making a token is refused while it is off; revoking one isn’t', () => {
    const s: Snapshot = { ...structuredClone(built), tokens: [{ id: 'tok9', personId: 'grace', name: 'Old', createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null }] };
    const grace = s.people.find((p) => p.id === 'grace')!;
    const x = { snapshot: s, cycle: s.cycles[0]!, week: 1, actor: grace, now: today.toISOString(), newId: () => 'n1', workspace: { id: 'platform-org', name: 'Platform Engineering', modulesOff: ['ai-access'] } } as unknown as Parameters<typeof performAny>[0];
    expect(() => performAny(x, 'createToken', { personId: 'grace', name: 'New' })).toThrow(new NotAllowed('AI access is off in Platform Engineering.'));
    expect(performAny(x, 'revokeToken', { tokenId: 'tok9' })).toBeTruthy();
  });
});
