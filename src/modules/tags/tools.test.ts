// @vitest-environment node
/* Fields' AI tools, through the MCP server as a person's assistant: the module's rules, every change logged as that
   person via the assistant, dry_run saving nothing, and every tool refused with the switched-off sentence while Fields
   is off (the values kept). */
import { serve, type Deps } from '../../../server/mcp';
import { applyCommit } from '../../data/store';
import { buildPlatformOrg } from '../../data/platformOrg';
import { hashToken, newToken } from '../../mcp/protocol';
import type { ApiToken, Snapshot } from '../../domain/types';
import { liveFields, valueOf } from './fields';

const today = new Date('2026-11-02T12:00:00Z');
const built = buildPlatformOrg(today);

async function setup(personId: string, modulesOff: string[] = [], start?: Snapshot) {
  let data: Snapshot = structuredClone(start ?? built);
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

describe('fields tools', () => {
  it('an admin defines a field; the owner sets a goal’s value by name, checked first with dry_run', async () => {
    const admin = await setup('amara');
    expect((await admin.call('list_fields')).structuredContent).toMatchObject({ fields: [], retired: [], youCanDefine: true });
    const add = await admin.call('save_field', { name: 'Stage', kind: 'list', values: ['Discover', 'Build', 'Run'] });
    expect(add.isError).toBe(false);
    expect(add.content[0]!.text).toBe('Stage added (as Amara Nwosu).');
    expect((await admin.call('save_field', { name: 'stage', kind: 'text' })).content[0]!.text).toBe('There’s already a field called “Stage”.');

    const owner = await setup('rhea', [], admin.data());
    expect((await owner.call('save_field', { name: 'Region', kind: 'text' })).content[0]!.text).toBe('Only an admin can change the workspace’s fields.');
    const dry = await owner.call('set_goal_fields', { goal_id: 'lead-flaky', fields: { stage: 'build' }, dry_run: true });
    expect(dry.structuredContent).toMatchObject({ saved: false, changes: ['Stage: Not set → Build'] });
    expect(liveFields(owner.data()).length).toBe(1);
    expect(valueOf(owner.data(), 'lead-flaky', liveFields(owner.data())[0]!.id)).toBe('');
    const set = await owner.call('set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: 'Build' } });
    expect(set.structuredContent).toMatchObject({ saved: true, changes: ['Stage: Not set → Build'] });
    expect(valueOf(owner.data(), 'lead-flaky', liveFields(owner.data())[0]!.id)).toBe('Build');
    const logged = owner.data().changes.find((c) => c.entity === 'field' && c.goalId === 'lead-flaky')!;
    expect(logged.actorId).toBe('rhea');
    expect(logged.diffs.some((d) => d.field === 'Via')).toBe(true);
    expect((await owner.call('set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: 'Operate' } })).content[0]!.text).toBe('“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
    expect((await owner.call('set_goal_fields', { goal_id: 'lead-flaky', fields: { Region: 'EU' } })).content[0]!.text).toBe('There’s no field called Region. Fields: Stage.');
    expect((await owner.call('list_fields', { goal_id: 'lead-flaky' })).structuredContent).toMatchObject({ fields: [{ name: 'Stage', kindLabel: 'A list: Discover, Build, Run', goalValue: 'Build', goalsWithAValue: 1 }], goal: { id: 'lead-flaky', youCanChange: true } });
  });

  it('refuses every tool while Fields is off, and keeps the values', async () => {
    const on = await setup('amara');
    await on.call('save_field', { name: 'Stage', kind: 'list', values: ['Build'] });
    await on.call('set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: 'Build' } });
    const off = await setup('amara', ['tags'], on.data());
    for (const [tool, args] of [['list_fields', {}], ['set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: '' } }], ['save_field', { name: 'Region', kind: 'text' }]] as const) {
      const r = await off.call(tool, args);
      expect(r.isError, tool).toBe(true);
      expect(r.content[0]!.text).toBe(`Fields is switched off in Platform Engineering, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`);
    }
    expect(valueOf(off.data(), 'lead-flaky', liveFields(off.data())[0]!.id)).toBe('Build');
    // find_goals' fields filter says the same sentence; a link's f.<field id> is no filter while it is off.
    const f = await off.call('find_goals', { fields: { Stage: 'Build' } });
    expect(f.isError).toBe(true);
    expect(f.content[0]!.text).toBe('Fields is switched off in Platform Engineering, so find_goals’ fields filter can’t be used there. An admin can switch it on in Workspace, under Features.');
    const param = `f.${liveFields(off.data())[0]!.id}=Build`;
    const all = ((await off.call('find_goals', { limit: 200 })).structuredContent as { total: number }).total;
    expect(((await off.call('find_goals', { query: param, limit: 200 })).structuredContent as { total: number }).total).toBe(all);
  });
});

describe('find_goals’ fields (TG2, rule 3)', () => {
  it('finds goals by a list field’s values, Not set among them, as Goals’ filter and its link do', async () => {
    const a = await setup('amara');
    await a.call('save_field', { name: 'Stage', kind: 'list', values: ['Discover', 'Build', 'Run'] });
    await a.call('save_field', { name: 'Notes', kind: 'text' });
    await a.call('set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: 'Build' } });
    await a.call('set_goal_fields', { goal_id: 'ci-docker', fields: { Stage: 'Run' } });
    const ids = async (args: object) => ((await a.call('find_goals', { limit: 200, ...args })).structuredContent as { goals: { id: string }[] }).goals.map((g) => g.id).sort();
    expect(await ids({ fields: { stage: 'build' } })).toEqual(['lead-flaky']);
    expect(await ids({ fields: { Stage: 'Build, Run' } })).toEqual(['ci-docker', 'lead-flaky']);
    expect(await ids({ fields: { Stage: ['Run'] } })).toEqual(['ci-docker']);
    const all = await ids({});
    expect((await ids({ fields: { Stage: 'Not set' } })).length).toBe(all.length - 2);
    // The same goals as the Goals link with the same filter.
    const id = liveFields(a.data())[0]!.id;
    expect(await ids({ query: `/goals?f.${id}=Build,Run` })).toEqual(['ci-docker', 'lead-flaky']);
    expect((await a.call('find_goals', { fields: { Stage: 'Operate' } })).content[0]!.text).toBe('“Operate” isn’t one of Stage’s values: Discover, Build or Run. Or Not set, for goals with no value.');
    expect((await a.call('find_goals', { fields: { Notes: 'x' } })).content[0]!.text).toBe('Notes is free text, so it can’t filter goals: only a list field can.');
    expect((await a.call('find_goals', { fields: { Region: 'EU' } })).content[0]!.text).toBe('There’s no field called Region. Fields: Stage, Notes.');
  });
});
