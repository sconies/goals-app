// @vitest-environment node
/* The AI tools of the four switches SW1 adds (docs/design/feature-switches/spec.md 6.2): with Watching, the Wrap-up or
   Feedback off in the workspace, each of its tools answers with the one sentence a switched-off module's tools use and
   changes nothing; get_my_work leaves out what is watched and whether the wrap-up is open; find_goals' Watching scope
   says why it has nothing. Starting the next year is the core's and is never refused. */
import { serve, type Deps } from '../../server/mcp';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { hashToken, newToken } from './protocol';
import type { ApiToken, Snapshot } from '../domain/types';

const today = new Date('2026-11-05T12:00:00Z');
const built = buildPlatformOrg(today);

async function setup(personId: string, modulesOff: string[] = []) {
  let data: Snapshot = structuredClone(built);
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId, name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Platform Engineering',
    modulesOff: async () => modulesOff,
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    now: () => today,
  };
  let id = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    return (await res.json()).result as { content: { text: string }[]; structuredContent?: Record<string, unknown>; isError: boolean };
  };
  return { call, data: () => data };
}

const OFF = (name: string, tool: string) => `${name} is switched off in Platform Engineering, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;

describe('Watching’s tools (SW1)', () => {
  it('work while Watching is on, and get_my_work says what is watched', async () => {
    const { call } = await setup('amara');
    expect((await call('list_watching')).isError).toBe(false);
    const work = await call('get_my_work');
    expect(work.structuredContent!.atAGlance).toHaveProperty('watching');
  });

  it('answer with the switched-off sentence while Watching is off, and change nothing', async () => {
    const { call, data } = await setup('amara', ['watching']);
    const before = data().watches.length;
    for (const [tool, args] of [['list_watching', {}], ['watch', { kind: 'goal', ref: 'ns-lead' }], ['unwatch', { watch_id: data().watches[0]!.id }]] as const) {
      const r = await call(tool, args);
      expect(r.isError, tool).toBe(true);
      expect(r.content[0]!.text).toBe(OFF('Watching', tool));
    }
    expect(data().watches.length).toBe(before);
    const work = await call('get_my_work');
    expect(work.structuredContent!.atAGlance).not.toHaveProperty('watching');
    const found = await call('find_goals', { scope: 'watching' });
    expect(found.content[0]!.text).toMatch(/Watching is switched off in Platform Engineering/);
  });
});

describe('the Wrap-up’s tools (SW1)', () => {
  it('answer with the switched-off sentence while the Wrap-up is off; get_my_work doesn’t say whether it is open', async () => {
    const { call } = await setup('rhea', ['wrap-up']);
    for (const [tool, args] of [['get_wrap_up', {}], ['wrap_up_goal', { goal_id: 'ci-docker', result: 'hit', learned: 'x', next: 'carry' }]] as const) {
      const r = await call(tool, args);
      expect(r.isError, tool).toBe(true);
      expect(r.content[0]!.text).toBe(OFF('Wrap-up', tool));
    }
    expect((await call('get_my_work')).structuredContent).not.toHaveProperty('wrapUpOpen');
    expect((await (await setup('rhea')).call('get_wrap_up')).isError).toBe(false);
  });

  it('never refuses starting the next year: a dry run answers with the Wrap-up off', async () => {
    const { call } = await setup('grace', ['wrap-up']);
    const r = await call('start_next_cycle', {});
    expect(r.content[0]!.text).not.toMatch(/switched off/);
  });
});

describe('Feedback’s tools (SW1)', () => {
  it('answer with the switched-off sentence while Feedback is off', async () => {
    const { call } = await setup('amara', ['feedback']);
    for (const tool of ['list_markups', 'list_feedback', 'review_inbox']) {
      const r = await call(tool);
      expect(r.isError, tool).toBe(true);
      expect(r.content[0]!.text).toBe(OFF('Feedback', tool));
    }
    const sent = await call('send_feedback', { mood: 'good', text: 'Nice' });
    expect(sent.content[0]!.text).toBe(OFF('Feedback', 'send_feedback'));
  });
});
