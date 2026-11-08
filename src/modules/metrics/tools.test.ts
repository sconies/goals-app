// @vitest-environment node
/* The metric library's AI tools, through the MCP server as a person's assistant: the same rules as domain/metrics.ts,
   every change logged as that person via the assistant, a removed metric restorable, and the tools off with the module. */
import { serve, type Deps } from '../../../server/mcp';
import { applyCommit } from '../../data/store';
import { buildPlatformOrg } from '../../data/platformOrg';
import { hashToken, newToken } from '../../mcp/protocol';
import type { ApiToken, Snapshot } from '../../domain/types';

const today = new Date('2026-11-02T12:00:00Z');
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

describe('metric library tools', () => {
  it('lists the library and reads one metric in full, with the goals it measures', async () => {
    const { call } = await setup('oskar');
    const list = await call('list_metrics');
    expect(list.isError).toBe(false);
    expect((list.structuredContent!.metrics as unknown[]).length).toBe(13);
    expect(list.content[0]!.text).toMatch(/metric_flaky-rate · Flaky test rate \(%, lower is better\) · owner Rhea Kapoor · measures 1 goal/);
    expect(((await call('list_metrics', { search: 'dora' })).structuredContent!.metrics as unknown[]).length).toBe(3);
    const one = await call('get_metric', { metric: 'lead time for changes' });
    expect(one.structuredContent).toMatchObject({ id: 'metric_lead-time', unit: 'hours', direction: 'lower', youCanChange: false, measures: [{ goalId: 'ns-lead', slice: 'The whole company', target: { value: 24, kind: 'target' } }] });
    expect((await call('get_metric', { metric: 'nope' })).isError).toBe(true);
  });

  it('adds a metric as the person, via the assistant; a second with the same name is refused', async () => {
    const { call, data } = await setup('oskar');
    const r = await call('save_metric', { name: 'Build time', unit: 'min', direction: 'lower', refresh: 'daily' });
    expect(r.isError).toBe(false);
    const m = data().metrics!.find((x) => x.name === 'Build time')!;
    expect(m).toMatchObject({ ownerId: 'oskar', refresh: 'daily', decimals: 0 });
    const log = data().changes.find((c) => c.entityId === m.id)!;
    expect(log).toMatchObject({ actorId: 'oskar', entity: 'metric', action: 'created' });
    expect(log.diffs.at(-1)).toEqual({ field: 'Via', from: '—', to: 'AI assistant (MCP)' });
    const again = await call('save_metric', { name: 'build TIME', unit: 'min', direction: 'lower' });
    expect(again).toMatchObject({ isError: true });
    expect(again.content[0]!.text).toMatch(/already a metric called Build time/);
    expect((await call('save_metric', { name: 'No unit' })).content[0]!.text).toMatch(/Say its unit/);
  });

  it('changes a metric only for its owner or an admin', async () => {
    const other = await setup('oskar');
    expect((await other.call('save_metric', { id: 'Flaky test rate', caveats: 'x' })).content[0]!.text).toMatch(/Only Rhea Kapoor or an admin/);
    const owner = await setup('rhea');
    expect((await owner.call('save_metric', { id: 'Flaky test rate', decimals: 2 })).isError).toBe(false);
    expect(owner.data().metrics!.find((m) => m.id === 'metric_flaky-rate')!.decimals).toBe(2);
    expect((await owner.call('save_metric', { id: 'Flaky test rate', decimals: 2 })).content[0]!.text).toMatch(/Nothing changed/);
  });

  it('links a goal for a team’s slice, warns on a direction mismatch, and unlinks it', async () => {
    const { call, data } = await setup('rhea');
    const r = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Remote build cache hit rate', team: 'CI/CD' });
    expect(r.isError).toBe(false);
    expect(data().metricLinks!.find((l) => l.goalId === 'ci-shard')).toMatchObject({ metricId: 'metric_cache-hit', teamId: 'cicd' });
    const wrong = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Flaky test rate' });
    expect(wrong.content[0]!.text).toMatch(/Warning: The goal aims up, but for Flaky test rate lower is better/);
    expect(data().metricLinks!.find((l) => l.goalId === 'ci-shard')).toMatchObject({ metricId: 'metric_flaky-rate', teamId: null });
    expect((await call('link_goal_metric', { goal: 'ns-lead', metric: 'CI pipeline time on main (p90)' })).content[0]!.text).toMatch(/The goal is in hours and the metric is in min/);
    expect((await call('link_goal_metric', { goal: 'ci-shard', unlink: true })).isError).toBe(false);
    expect(data().metricLinks!.find((l) => l.goalId === 'ci-shard')!.removedAt).toBeTruthy();
    expect((await call('link_goal_metric', { goal: 'ns-ci', metric: 'CI pipeline time on main (p90)' })).content[0]!.text).toMatch(/Only the goal’s owner or an admin/);
  });

  it('removes a metric, unlinking its goals, and restore_removed brings it back', async () => {
    const { call, data } = await setup('grace');
    const r = await call('remove_metric', { metric: 'metric_lead-time' });
    expect(r.content[0]!.text).toMatch(/Removed the metric “Lead time for changes”, unlinking 1 goal/);
    expect(data().metricLinks!.find((l) => l.goalId === 'ns-lead')!.removedAt).toBeTruthy();
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(12);
    expect((await call('restore_removed', { kind: 'metric', id: 'metric_lead-time' })).isError).toBe(false);
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(13);
  });

  it('says the library is off where an admin has switched it off', async () => {
    const { call } = await setup('grace', ['metrics']);
    const r = await call('list_metrics');
    expect(r.isError).toBe(true);
  });
});
