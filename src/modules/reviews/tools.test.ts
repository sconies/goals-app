// @vitest-environment node
/* Reviews' AI tools behind its switch (FT2, docs/design/feature-toggles/spec.md section 6; round 4's reviews-switch 5):
   with Reviews off in the workspace, every review tool answers with the one sentence a switched-off module's tools
   use, edit_call refuses for a note said in a review and still corrects an ask's words, get_my_work names no review
   and describe_system says Reviews is off. Back on, they work as before. */
import { serve, type Deps } from '../../../server/mcp';
import { applyCommit } from '../../data/store';
import { buildPlatformOrg } from '../../data/platformOrg';
import { hashToken, newToken } from '../../mcp/protocol';
import type { ApiToken, Snapshot } from '../../domain/types';

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

const OFF = (tool: string) => `Reviews is switched off in Platform Engineering, so ${tool} can't be used there. An admin can switch it on in Workspace, under Features.`;

describe('Reviews’ tools', () => {
  it('work while Reviews is on', async () => {
    const { call } = await setup('amara');
    const list = await call('list_reviews');
    expect(list.isError).toBe(false);
    expect((list.structuredContent!.reviews as unknown[]).length).toBeGreaterThan(0);
    expect((await call('get_review', { review_id: 'weekly' })).isError).toBe(false);
    const work = await call('get_my_work');
    expect(work.structuredContent).toHaveProperty('yourReviews');
    expect(work.structuredContent!.atAGlance).toHaveProperty('nextReview');
  });

  it('answer with the switched-off sentence while Reviews is off, and change nothing', async () => {
    const { call, data } = await setup('amara', ['reviews']);
    const before = data().changes.length;
    for (const [tool, args] of [
      ['list_reviews', {}], ['get_review', { review_id: 'weekly' }], ['review_call', { review_id: 'weekly', goal_id: 'ns-lead', kind: 'note', text: 'Seen' }],
      ['save_review', { name: 'A new one' }], ['end_review', { review_id: 'weekly' }], ['delete_review', { review_id: 'weekly' }],
    ] as const) {
      const r = await call(tool, args);
      expect(r.isError, tool).toBe(true);
      expect(r.content[0]!.text, tool).toBe(OFF(tool));
    }
    expect(data().changes.length).toBe(before);
  });

  it('refuse to correct a note said in a review while Reviews is off, but not an ask’s words', async () => {
    const { call, data } = await setup('amara', ['reviews']);
    const note = data().decisions.find((d) => d.kind === 'note')!;
    const r = await call('edit_call', { call_id: note.id, text: 'Corrected' });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe(OFF('edit_call'));
    const ask = (data().requests ?? []).find((x) => x.status === 'open' && x.askedBy === 'amara');
    if (ask) expect((await call('edit_call', { call_id: ask.id, text: ask.ask + ' (corrected)' })).content[0]!.text).not.toBe(OFF('edit_call'));
  });

  it('leave reviews out of get_my_work, and describe_system says Reviews is off', async () => {
    const { call } = await setup('amara', ['reviews']);
    const work = await call('get_my_work');
    expect(work.isError).toBe(false);
    expect(work.structuredContent).not.toHaveProperty('yourReviews');
    expect(work.structuredContent!.atAGlance).not.toHaveProperty('nextReview');
    expect(work.content[0]!.text).not.toMatch(/Next review/);
    const sys = await call('describe_system');
    expect((sys.structuredContent!.modules as { id: string; on: boolean }[]).find((m) => m.id === 'reviews')?.on).toBe(false);
    expect(sys.content[0]!.text).toMatch(/Switched off in Platform Engineering: Reviews\./);
  });

  it('ask_question and add_action no longer point at a review', async () => {
    const { TOOLS } = await import('../../mcp/tools');
    expect(TOOLS.find((t) => t.name === 'ask_question')!.description).not.toMatch(/review/);
    expect(TOOLS.find((t) => t.name === 'add_action')!.description).not.toMatch(/review/);
  });
});
