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

async function setup(personId: string, modulesOff: string[] = [], change: (s: Snapshot) => void = () => undefined) {
  let data: Snapshot = structuredClone(built);
  change(data);
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
    expect(JSON.parse(list.content[0]!.text)).toEqual(list.structuredContent);
    expect((list.structuredContent!.metrics as { id: string; owner: string | null }[]).find((m) => m.id === 'metric_flaky-rate')).toMatchObject({ owner: 'Rhea Kapoor' });
    expect(((await call('list_metrics', { search: 'dora' })).structuredContent!.metrics as unknown[]).length).toBe(3);
    const one = await call('get_metric', { metric: 'lead time for changes' });
    expect(one.structuredContent).toMatchObject({ id: 'metric_lead-time', unit: 'hours', direction: 'lower', youCanChange: false, measures: [{ goalId: 'ns-lead', slice: 'The whole company', target: { value: 24, kind: 'target' } }] });
    // Rule 2's row, as its page's table shows it; what it needs only for its owner and admins.
    expect(one.structuredContent).toMatchObject({ goals: [{ key: 'G-1', status: 'off', slice: 'The whole company', now: '37 hours', target: '24 hours by year end', vsPlan: expect.stringMatching(/^\d+ hours behind plan$/), owner: 'Rhea Kapoor' }], summary: null, needs: [] });
    expect((await call('get_metric', { metric: 'nope' })).isError).toBe(true);
    // Rule 1’s line, in words: never a score.
    expect((await call('get_metric', { metric: 'metric_lead-time' })).structuredContent).toMatchObject({ stillToSay: { full: true, missing: [], line: 'Fully defined' } });
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
    // Rule 3's needs and MQ2's loose ends together: CI compute cost needs a goal and (a Draft) a source link.
    expect(mine).toContainEqual(expect.objectContaining({ name: 'CI compute cost per pipeline run', needs: [{ id: 'unused', sentence: 'No goal uses it' }], stage: 'draft', missing: 'needs a source link' }));
    expect(mine.every((r) => r.needs.length + ((r as unknown as { sortOut: unknown[] }).sortOut.length) > 0)).toBe(true);
    expect((await call('get_metric', { metric: 'metric_ci-cost' })).structuredContent).toMatchObject({ goals: [], needs: [{ id: 'unused', sentence: 'No goal uses it' }] });
    expect((await call('list_metrics', { team: 'Nowhere' })).isError).toBe(true);
  });

  it('adds a metric as the person, via the assistant; a second with the same name is refused', async () => {
    const { call, data } = await setup('oskar');
    // A name close to another's is a Check (rule 1): nothing is saved until the person answers it.
    const asked = await call('save_metric', { name: 'Build time', unit: 'min', direction: 'lower', refresh: 'daily' });
    expect(asked.isError).toBe(false);
    expect(asked.structuredContent).toMatchObject({ saved: false, checks: [{ field: 'name', answers: [{ answer: 'use:metric_cache-hit' }, { answer: 'keep:metric_cache-hit' }] }] });
    expect(metricsOf(data()).some((x) => x.name === 'Build time')).toBe(false);
    const r = await call('save_metric', { name: 'Build time', unit: 'min', direction: 'lower', refresh: 'daily', answers: { name: 'keep:metric_cache-hit' } });
    expect(r.isError, r.content[0]!.text).toBe(false);
    expect(r.content[0]!.text).toMatch(/Still to say: what it means, where the number comes from, who owns that source\. Stage: Draft\./);
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

  it('fewer decimal places names the goals that show more, which keep theirs (#351 review)', async () => {
    const { call, data } = await setup('amara');
    const link = linksOf(data()).find((l) => !l.removedAt && data().goals.some((g) => g.id === l.goalId && g.kind !== 'milestone' && g.decimals > 0))!;
    const goal = data().goals.find((g) => g.id === link.goalId)!;
    const metric = metricsOf(data()).find((m) => m.id === link.metricId)!;
    if (metric.decimals === 0) await call('save_metric', { id: metric.id, decimals: 1 });
    const r = await call('save_metric', { id: metric.id, decimals: 0 });
    expect(r.isError, r.content[0]!.text).toBe(false);
    expect(r.content[0]!.text).toContain(`more decimal places than ${metric.name} now does: `);
    expect(r.content[0]!.text).toContain(goal.title);
    expect((r.structuredContent as { moreDecimals: string[] }).moreDecimals).toContain(goal.id);
  });

  it('refuses someone who may not change a metric before asking them anything, and says a bad answer plainly (#281)', async () => {
    const other = await setup('oskar');
    // A name one letter from another's would be asked; Oskar may not change Rhea's metric, so he is refused first.
    expect((await other.call('save_metric', { id: 'Flaky test rate', name: 'Flaky tests rate' })).content[0]!.text).toMatch(/Only Rhea Kapoor or an admin/);
    const bad = await other.call('save_metric', { name: 'Build time', unit: 'min', direction: 'lower', answers: { name: 5 } });
    expect(bad.isError).toBe(true);
    expect(bad.content[0]!.text).toMatch(/The answer for name is one of the words the question offered/);
    expect(bad.content[0]!.text).not.toMatch(/is not a function/);
    // A bare “keep”, not tied to the question it answers, saves nothing.
    expect((await other.call('save_metric', { name: 'Build time', unit: 'min', direction: 'lower', answers: { name: 'keep' } })).structuredContent).toMatchObject({ saved: false });
    // A name the same as another's but for an accent is a Must fix.
    expect((await other.call('save_metric', { name: 'Fláky test rate', unit: '%', direction: 'lower' })).content[0]!.text).toMatch(/already a metric called Flaky test rate/);
  });

  it('changes a metric only for its owner or an admin', async () => {
    const other = await setup('oskar');
    expect((await other.call('save_metric', { id: 'Flaky test rate', caveats: 'x' })).content[0]!.text).toMatch(/Only Rhea Kapoor or an admin/);
    const owner = await setup('rhea');
    expect((await owner.call('save_metric', { id: 'Flaky test rate', decimals: 2 })).isError).toBe(false);
    expect(metricsOf(owner.data()).find((m) => m.id === 'metric_flaky-rate')!.decimals).toBe(2);
    expect((await owner.call('save_metric', { id: 'Flaky test rate', decimals: 2 })).content[0]!.text).toMatch(/Nothing changed/);
  });

  it('gives a goal its metric’s monthly rhythm when linked, and the cycle’s again when unlinked (MQ2)', async () => {
    const { call, data } = await setup('bjorn');
    const off = await call('link_goal_metric', { goal: 'ns-cost', unlink: true });
    expect(off.isError).toBe(false);
    const on = await call('link_goal_metric', { goal: 'ns-cost', metric: 'Cloud cost per 1,000 requests', reason: 'Back on the cost report' });
    expect(on.isError).toBe(false);
    expect(on.structuredContent).toMatchObject({ saved: true, rhythm: 'monthly' });
    expect(on.content[0]!.text).toMatch(/Check-ins: once a month, by the month’s last due day, as Cloud cost per 1,000 requests refreshes monthly\./);
    expect(data().goals.find((g) => g.id === 'ns-cost')!.checkInRhythm).toBe('monthly');
    const again = await call('link_goal_metric', { goal: 'ns-cost', unlink: true });
    expect(again.isError).toBe(false);
    expect(data().goals.find((g) => g.id === 'ns-cost')!.checkInRhythm ?? null).toBeNull();
  });

  it('links a goal for a team’s slice, warns on a direction mismatch, and unlinks it', async () => {
    const { call, data } = await setup('rhea');
    const ask = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Remote build cache hit rate', team: 'CI/CD' });
    expect(ask.structuredContent).toMatchObject({ saved: false, checks: [{ field: 'part', answers: ['carry-on'] }] });
    expect(ask.content[0]!.text).toMatch(/Another goal already measures this for CI\/CD: “.+” \(G-\d+, .+\)\. Two goals on one number is unusual\./);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')).toBeUndefined();
    const r = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Remote build cache hit rate', team: 'CI/CD', answers: { others: 'carry-on' } });
    expect(r.isError).toBe(false);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')).toMatchObject({ metricId: 'metric_cache-hit', teamId: 'cicd' });
    // MQ2: a Draft metric is linked, with its warning and what it still needs.
    expect(r.structuredContent).toMatchObject({ saved: true, stage: 'draft', draft: { heading: 'Measured by a Draft metric' } });
    expect(r.content[0]!.text).toMatch(/Warning: Measured by a Draft metric\. Its .+ set, so this number may not mean the same to everyone\. The goal keeps working\. .+ owns the metric\. Still needed: .+\./);
    const wrong = await call('link_goal_metric', { goal: 'ci-shard', metric: 'Flaky test rate', reason: 'Shards are measured by flakiness now' });
    expect(wrong.content[0]!.text).toMatch(/Warning: The goal aims up, but for Flaky test rate lower is better/);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')).toMatchObject({ metricId: 'metric_flaky-rate', teamId: null });
    expect((await call('link_goal_metric', { goal: 'ns-lead', metric: 'CI pipeline time on main (p90)' })).content[0]!.text).toMatch(/The goal is in hours and the metric is in min/);
    expect((await call('link_goal_metric', { goal: 'ci-shard', unlink: true })).isError).toBe(false);
    expect(linksOf(data()).find((l) => l.goalId === 'ci-shard')!.removedAt).toBeTruthy();
    expect((await call('link_goal_metric', { goal: 'ns-ci', metric: 'CI pipeline time on main (p90)' })).content[0]!.text).toMatch(/Only the goal’s owner or an admin/);
  });

  it('asks why of a goal with check-ins measured differently even after unlinking it first (#308’s review)', async () => {
    const { call, data } = await setup('rhea');
    expect((await call('link_goal_metric', { goal: 'lead-ci-time', unlink: true })).isError).toBe(false);
    const asked = await call('link_goal_metric', { goal: 'lead-ci-time', metric: 'CI pipeline time on main (p90)' });
    expect(asked.isError).toBe(true);
    expect(asked.content[0]!.text).toMatch(/Say why this goal is measured differently now\./);
    expect(linksOf(data()).find((l) => l.goalId === 'lead-ci-time')!.removedAt).toBeTruthy();
    // Linked back as it was is no change, so nothing is asked.
    expect((await call('link_goal_metric', { goal: 'lead-ci-time', metric: 'metric_queue-wait', team: 'CI/CD', part: 'main branch pipelines' })).isError).toBe(false);
    expect((await call('link_goal_metric', { goal: 'lead-ci-time', unlink: true })).isError).toBe(false);
    const said = await call('link_goal_metric', { goal: 'lead-ci-time', metric: 'CI pipeline time on main (p90)', reason: 'Queue wait is part of pipeline time now', answers: { others: 'carry-on' } });
    expect(said.isError).toBe(false);
    expect(data().changes.some((c) => c.goalId === 'lead-ci-time' && c.summary === 'Measured by “CI pipeline time on main (p90)” for the whole company: Queue wait is part of pipeline time now')).toBe(true);
  });

  it('get_metric lists the parts its goals use', async () => {
    const { call } = await setup('rhea');
    const r = await call('get_metric', { metric: 'metric_queue-wait' });
    expect((r.structuredContent as { parts: string[] }).parts).toEqual(['main branch pipelines']);
    expect(r.content[0]!.text).toMatch(/Parts in use: main branch pipelines/);
  });

  it('removes only a metric no goal has used, and restore_removed brings it back; a used one is retired (MT3)', async () => {
    const { call, data } = await setup('grace');
    const used = await call('remove_metric', { metric: 'metric_lead-time' });
    expect(used.isError).toBe(true);
    expect(used.content[0]!.text).toMatch(/can’t be deleted\. Retire it instead/);
    const r = await call('remove_metric', { metric: 'metric_ci-cost' });
    expect(r.content[0]!.text).toMatch(/Removed the metric “CI compute cost per pipeline run”/);
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(12);
    expect((await call('restore_removed', { kind: 'metric', id: 'metric_ci-cost' })).isError).toBe(false);
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(13);
    // Retire: the goal keeps its link and the list leaves it out; retired lists it; bring_back puts it back.
    expect((await call('retire_metric', { metric: 'metric_lead-time' })).isError).toBe(true);
    const ret = await call('retire_metric', { metric: 'metric_lead-time', why: 'Replaced by the DORA dashboard’s figure.' });
    expect(ret.content[0]!.text).toMatch(/Retired the metric “Lead time for changes”: Replaced by/);
    expect(linksOf(data()).find((l) => l.goalId === 'ns-lead')!.removedAt).toBeFalsy();
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(12);
    expect(((await call('list_metrics', { retired: true })).structuredContent!.metrics as { id: string }[]).map((m) => m.id)).toEqual(['metric_lead-time']);
    expect(((await call('get_metric', { metric: 'metric_lead-time' })).structuredContent as { retired: { why: string } }).retired.why).toMatch(/DORA/);
    expect((await call('link_goal_metric', { goal: 'ns-lead', metric: 'metric_lead-time' })).isError).toBe(false);
    expect((await call('retire_metric', { metric: 'metric_lead-time', bring_back: true })).isError).toBe(false);
    expect(((await call('list_metrics')).structuredContent!.metrics as unknown[]).length).toBe(13);
  });
  it('merges one metric into another in the same unit, for admins (MT3)', async () => {
    const { call, data } = await setup('grace');
    expect((await call('merge_metrics', { from: 'metric_lead-time', into: 'metric_ci-time' })).content[0]!.text).toMatch(/Only metrics in the same unit can be merged/);
    const r = await call('merge_metrics', { from: 'metric_lead-time', into: 'metric_first-review' });
    expect(r.isError).toBe(false);
    expect(linksOf(data()).find((l) => l.goalId === 'ns-lead')!.metricId).toBe('metric_first-review');
    const rhea = await setup('rhea');
    expect((await rhea.call('merge_metrics', { from: 'metric_flaky-rate', into: 'metric_cache-hit' })).content[0]!.text).toMatch(/Only admins can merge metrics/);
  });

  it('asks, through the change engine, about a target on the worse side of the metric that measures the goal (wrong-side)', async () => {
    // Lead time for changes is better lower: a plan that rises is asked about, with the form's words.
    const { call } = await setup('rhea');
    const r = await call('update_goal', { goal_id: 'ns-lead', start: 20, target: 22, reason: 'Re-based on the new dashboard', dry_run: true });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/“Lead time for changes” is better lower, but the target \(22 hours\) is above today \(20 hours\)\. Is that the plan\?/);
    // Switched off, the library says nothing measures it, so nothing is asked about it.
    const off = await (await setup('rhea', ['metrics'])).call('update_goal', { goal_id: 'ns-lead', start: 20, target: 22, reason: 'Re-based on the new dashboard', dry_run: true });
    expect(off.content[0]!.text).not.toMatch(/is better lower/);
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
    expect(asked.content[0]!.text).toMatch(/1 goal is measured by Lead time for changes in hours\. A metric in days is a different number/);
    // A new label for the same numbers (MT3 rule 3, relabel): the goal's unit changes with it.
    expect((await call('save_metric', { id: 'metric_lead-time', unit: 'hrs', relabel: true })).isError).toBe(false);
  });

  it('lists a proposed goal that names a metric apart, with no numbers, and not among the goals it measures (GE10)', async () => {
    const goalId = linksOf(built).find((l) => l.metricId === 'metric_lead-time' && !l.removedAt)!.goalId;
    const { call } = await setup('oskar', [], (s) => { const g = s.goals.find((x) => x.id === goalId)!; g.proposedAt = '2026-10-30T10:00:00Z'; g.proposedBy = 'rhea'; });
    const one = await call('get_metric', { metric: 'metric_lead-time' });
    const sc = one.structuredContent as { goals: { goalId: string }[]; proposed: { goalId: string }[] };
    expect(sc.proposed.map((x) => x.goalId)).toEqual([goalId]);
    expect(sc.goals.some((x) => x.goalId === goalId)).toBe(false);
    expect(one.content[0]!.text).toMatch(/Proposed \(1\), not judged: /);
  });
  /* MQ2 (docs/design/mq2 sketch 13): every journey through MCP, by the same rules as the screens. */
  describe('metric quality through MCP', () => {
    it('lists stages, refresh and window, and filters by stage and to_verify', async () => {
      const { call } = await setup('amara');
      const v = (await call('list_metrics', { stage: 'verified' })).structuredContent!.metrics as { name: string; stage: string; refreshWords: string; window: string }[];
      expect(v.map((m) => m.name)).toEqual(['Change failure rate', 'Mean time to restore (P1 and P2)', 'Production deploys per day']);
      expect(v[0]).toMatchObject({ stage: 'verified', refreshWords: 'Refreshed weekly', window: 'Rolling 28 days' });
      const tv = (await call('list_metrics', { to_verify: true })).structuredContent!.metrics as { name: string; stage: string }[];
      expect(tv.every((m) => m.stage === 'defined')).toBe(true);
      expect(tv.map((m) => m.name)).toContain('CI pipeline time on main (p90)');
    });
    it('get_metric names the source’s owner here when it is a team’s exact name, as verifying reads it (#577 review)', async () => {
      const { call } = await setup('tariq');
      const d = (await call('get_metric', { metric: 'metric_ci-time' })).structuredContent as Record<string, any>;
      expect(d.sourceOwnerInFaro).toBe('Developer Experience');
    });
    it('get_metric returns the calculation, baselines per slice and the verification record', async () => {
      const { call } = await setup('amara');
      const d = (await call('get_metric', { metric: 'Change failure rate' })).structuredContent as Record<string, any>;
      expect(d).toMatchObject({ stage: 'verified', calculationWords: 'Ratio', windowWords: 'Rolling 28 days', baselines: [{ slice: 'The whole company', value: 11.8, period: 'Jul–Sep 2026' }], verification: { by: 'Amara Nwosu', figure: 11.8, stored: 11.8, storedFrom: 'baseline' } });
      expect(d.calculation.numerator.name).toBe('Failed changes');
    });
    it('verify_metric refuses the owner in words, and verifies for someone else with the comparison', async () => {
      const owner = await setup('daniel');
      const no = await owner.call('verify_metric', { metric: 'CI pipeline time on main (p90)', period: 'Aug–Oct 2026', figure: 21, opened_link: true, outcome: 'verified', note: 'Matches.' });
      expect(no.isError).toBe(true);
      expect(no.content[0]!.text).toMatch(/You own this metric, so someone else must verify it\. Ask an admin, someone in Developer Experience/);
      const { call } = await setup('amara');
      const ok = await call('verify_metric', { metric: 'CI pipeline time on main (p90)', period: 'Aug–Oct 2026', figure: 21, opened_link: true, outcome: 'verified', note: 'Matches apart from rounding.' });
      expect(ok.structuredContent).toMatchObject({ saved: true, stage: 'verified', stored: 22, storedFrom: 'baseline' });
      expect(ok.content[0]!.text).toMatch(/Your 21 min against 22 min stored \(1 min lower\)/);
    });
    it('save_metric returns the stage before and after, and asks before lapsing Verified', async () => {
      const { call } = await setup('marisol');
      const asked = await call('save_metric', { id: 'Change failure rate', window: 'rolling 14 days' });
      expect(asked.structuredContent).toMatchObject({ saved: false, checks: [{ field: 'lapse', answers: [{ answer: 'go' }] }] });
      const done = await call('save_metric', { id: 'Change failure rate', window: 'rolling 14 days', answers: { lapse: 'go' }, reason: 'Fortnightly reviews.' });
      expect(done.structuredContent).toMatchObject({ saved: true, stageBefore: 'verified', stageAfter: 'defined' });
      const draft = await setup('rhea');
      const r = await draft.call('save_metric', { id: 'Flaky test rate', source_link: 'https://ci.example.com/tests/flaky' });
      expect(r.structuredContent).toMatchObject({ stageBefore: 'draft', stageAfter: 'defined', missing: [] });
    });
    it('save_baselines sets slices, refuses a changed figure without a reason, and fills from readings without saving', async () => {
      const { call } = await setup('tariq');
      const bad = await call('save_baselines', { metric: 'Time to first review', baselines: [{ value: 9, period: 'Jul–Sep 2026', taken_on: '2026-10-01', how: 'PR data', read: 8.5 }] });
      expect(bad.isError).toBe(true);
      expect(bad.content[0]!.text).toMatch(/Say why you changed the figure read/);
      const ok = await call('save_baselines', { metric: 'Time to first review', baselines: [{ value: 9, period: 'Jul–Sep 2026', taken_on: '2026-10-01', how: 'PR data', read: 8.5, reason: 'Bots left out' }] });
      expect(ok.structuredContent).toMatchObject({ saved: true, stage: 'defined', baselines: [{ slice: 'The whole company', value: 9 }] });
      const fill = await call('save_baselines', { metric: 'Time to first review', from_readings: true });
      expect(fill.structuredContent).toMatchObject({ saved: false });
    });
    it('refuses every quality tool with the module-off sentence when Metrics is switched off', async () => {
      const { call } = await setup('amara', ['metrics']);
      for (const [tool, args] of [['verify_metric', { metric: 'x' }], ['save_baselines', { metric: 'x' }]] as const) {
        const r = await call(tool, args);
        expect(r.isError).toBe(true);
      }
    });
  });
});
