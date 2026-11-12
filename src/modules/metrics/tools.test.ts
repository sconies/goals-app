// @vitest-environment node
/* The metric library's AI tools, through the MCP server as a person's assistant: the same rules as rules.ts,
   every change logged as that person via the assistant, a removed metric restorable, and the tools off with the module. */
import { serve, type Deps } from '../../../server/mcp';
import { applyCommit } from '../../data/store';
import { buildPlatformOrg } from '../../data/platformOrg';
import { hashToken, newToken } from '../../mcp/protocol';
import type { ApiToken, Snapshot } from '../../domain/types';
import { linksOf, metricsOf } from './rules';

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
    expect(list.content[0]!.text).toMatch(/metric_flaky-rate · Flaky test rate \(%, lower is better\) · owner Rhea Kapoor · 1 at risk/);
    expect(((await call('list_metrics', { search: 'dora' })).structuredContent!.metrics as unknown[]).length).toBe(3);
    const one = await call('get_metric', { metric: 'lead time for changes' });
    expect(one.structuredContent).toMatchObject({ id: 'metric_lead-time', unit: 'hours', direction: 'lower', youCanChange: false, measures: [{ goalId: 'ns-lead', slice: 'The whole company', target: { value: 24, kind: 'target' } }] });
    // Rule 2's row, as its page's table shows it; what it needs only for its owner and admins.
    expect(one.structuredContent).toMatchObject({ goals: [{ key: 'G-1', status: 'off', slice: 'The whole company', now: '37 hours', target: '24 hours by year end', vsPlan: expect.stringMatching(/^\d+ hours behind plan$/), owner: 'Rhea Kapoor' }], summary: null, needs: [] });
    expect((await call('get_metric', { metric: 'nope' })).isError).toBe(true);
  });

  it('narrows the library as its page does (rule 1), and says what a metric needs to its owner (rule 3)', async () => {
    const { call } = await setup('ethan');
    const names = async (a: Record<string, unknown>) => ((await call('list_metrics', a)).structuredContent!.metrics as { name: string }[]).map((m) => m.name);
    expect(await names({ search: 'min lower' })).toEqual(['CI pipeline time on main (p90)', 'Mean time to detect', 'Mean time to restore (P1 and P2)', 'Pipeline queue wait (p90)']);
    expect(await names({ owner: 'Rhea Kapoor' })).toHaveLength(4);
    expect(await names({ unit: '%' })).toEqual(['Change failure rate', 'Flaky test rate', 'Remote build cache hit rate']);
    expect(await names({ team: 'CI/CD' })).toEqual(['Flaky test rate', 'Pipeline queue wait (p90)', 'Remote build cache hit rate']);
    expect(await names({ team: 'company' })).toHaveLength(7);
    expect(await names({ unused: true })).toEqual(['CI compute cost per pipeline run']);
    expect((await names({ sort: 'goals' })).at(-1)).toBe('CI compute cost per pipeline run');
    const mine = (await call('list_metrics', { sort_out: true })).structuredContent!.metrics as { name: string; needs: { id: string }[] }[];
    expect(mine).toMatchObject([{ name: 'CI compute cost per pipeline run', needs: [{ id: 'unused' }] }]);
    expect((await call('get_metric', { metric: 'metric_ci-cost' })).structuredContent).toMatchObject({ goals: [], needs: [{ id: 'unused', sentence: 'No goal uses it' }] });
    expect((await call('list_metrics', { team: 'Nowhere' })).isError).toBe(true);
  });

  it('adds a metric as the person, via the assistant; a second with the same name is refused', async () => {
    const { call, data } = await setup('oskar');
    const r = await call('save_metric', { name: 'Build time', unit: 'min', direction: 'lower', refresh: 'daily' });
    expect(r.isError).toBe(false);
    const m = metricsOf(data()).find((x) => x.name === 'Build time')!;
    expect(m).toMatchObject({ ownerId: 'oskar', refresh: 'daily', decimals: 0 });
    const log = data().changes.find((c) => c.entityId === m.id)!;
    expect(log).toMatchObject({ actorId: 'oskar', entity: 'metric', action: 'created' });
    expect(log.diffs.at(-1)).toEqual({ field: 'Via', from: '—', to: 'MCP' });
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
    expect(metricsOf(owner.data()).find((m) => m.id === 'metric_flaky-rate')!.decimals).toBe(2);
    expect((await owner.call('save_metric', { id: 'Flaky test rate', decimals: 2 })).content[0]!.text).toMatch(/Nothing changed/);
  });

  it('links a goal for a team’s slice, warns on a direction mismatch, and unlinks it', async () => {
    const { call, data } = await setup('rhea');
    const r = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Remote build cache hit rate', team: 'CI/CD' });
    expect(r.isError).toBe(false);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')).toMatchObject({ metricId: 'metric_cache-hit', teamId: 'cicd' });
    const wrong = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Flaky test rate' });
    expect(wrong.content[0]!.text).toMatch(/Warning: The goal aims up, but for Flaky test rate lower is better/);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')).toMatchObject({ metricId: 'metric_flaky-rate', teamId: null });
    expect((await call('link_goal_metric', { goal: 'ns-lead', metric: 'CI pipeline time on main (p90)' })).content[0]!.text).toMatch(/The goal is in hours and the metric is in min/);
    expect((await call('link_goal_metric', { goal: 'ci-shard', unlink: true })).isError).toBe(false);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')!.removedAt).toBeTruthy();
    expect((await call('link_goal_metric', { goal: 'ns-ci', metric: 'CI pipeline time on main (p90)' })).content[0]!.text).toMatch(/Only the goal’s owner or an admin/);
  });

  it('removes a metric, unlinking its goals, and restore_removed brings it back', async () => {
    const { call, data } = await setup('grace');
    const r = await call('remove_metric', { metric: 'metric_lead-time' });
    expect(r.content[0]!.text).toMatch(/Removed the metric “Lead time for changes”, unlinking 1 goal/);
    expect(linksOf(data()).find((l) => l.goalId === 'ns-lead')!.removedAt).toBeTruthy();
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(12);
    expect((await call('restore_removed', { kind: 'metric', id: 'metric_lead-time' })).isError).toBe(false);
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(13);
  });

  it('says the library is off where an admin has switched it off', async () => {
    const { call } = await setup('grace', ['metrics']);
    const r = await call('list_metrics');
    expect(r.isError).toBe(true);
  });
  it('find_goals reads the metric filter in a Goals link, and save_metric asks before changing a unit goals use (review, 11 Nov)', async () => {
    const { call } = await setup('rhea');
    const found = await call('find_goals', { query: 'metric=metric_lead-time' });
    expect((found.structuredContent!.goals as { id: string }[]).map((g) => g.id)).toEqual(['ns-lead']);
    const asked = await call('save_metric', { id: 'metric_lead-time', unit: 'days' });
    expect(asked.isError).toBe(true);
    expect(asked.content[0]!.text).toMatch(/1 goal is measured by this metric. .* save it again with confirm/);
    expect((await call('save_metric', { id: 'metric_lead-time', unit: 'days', confirm: true })).isError).toBe(false);
  });
});
