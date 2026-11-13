// @vitest-environment node
import { goalsIn } from '../domain/review';
import { serve, type Deps } from '../../server/mcp';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { asksOf } from '../domain/asks';
import { isProposed } from '../domain/proposed';
import { currentWeek, planAt } from '../domain/plan';
import { applyQuery, parseQuery } from '../domain/query';
import { summariseAll } from '../domain/summary';
import type { ApiToken, MetricGoal, RangeGoal, Snapshot } from '../domain/types';
import { hashToken, newToken } from './protocol';

// Monday of week 45, before this week's check-ins.
const today = new Date('2026-11-02T12:00:00Z');
const built = buildPlatformOrg(today);
/** The demo's week today, and its year's length. */
const demo = built.cycles[0]!;
const NOW = currentWeek(demo, today), WEEKS = demo.weeks;

async function setup(personId = 'mateo') {
  let data: Snapshot = structuredClone(built);
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId, name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  let touched = 0;
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash && !t.revokedAt ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Platform Engineering',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => { touched++; },
    now: () => today,
  };
  let id = 0;
  const rpc = async (method: string, params?: object, key = token) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) }), deps);
    return { status: res.status, body: res.status === 202 ? null : await res.json() };
  };
  const call = async (name: string, args: object = {}) => (await rpc('tools/call', { name, arguments: args })).body.result as { content: { text: string }[]; structuredContent?: Record<string, unknown>; isError: boolean };
  return { rpc, call, token, t, data: () => data, touched: () => touched, deps };
}

describe('MCP server', () => {
  it('refuses a request without a valid token', async () => {
    const { rpc, t } = await setup();
    expect((await rpc('initialize', {}, '')).status).toBe(401);
    expect((await rpc('initialize', {}, 'gk_wrong')).status).toBe(401);
    t.revokedAt = today.toISOString();
    expect((await rpc('tools/list')).status).toBe(401);
  });

  it('initialises and lists its tools', async () => {
    const { rpc } = await setup();
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(init.body.result.protocolVersion).toBe('2025-06-18');
    expect(init.body.result.capabilities.tools).toBeDefined();
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${(await setup()).token}` }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }), (await setup()).deps);
    expect([202, 401]).toContain(res.status);
    const list = await rpc('tools/list');
    const names = list.body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(['get_overview', 'find_goals', 'get_goal', 'post_check_in', 'update_goal', 'create_goal', 'set_plan_numbers', 'add_comment', 'bulk_change', 'export']));
    for (const t of list.body.result.tools) expect(t.inputSchema.type).toBe('object');
  });

  it('reads: an overview, goals and one goal in full', async () => {
    const { call } = await setup();
    expect((await call('get_overview')).content[0]!.text).toMatch(/acting as Mateo Fernández/);
    const mine = await call('find_goals', { mine: true });
    expect((mine.structuredContent!.goals as { id: string }[]).map((g) => g.id).sort()).toEqual(['mttr-pir', 'ns-mttr']);
    const g = await call('get_goal', { goal_id: 'mttr-pir' });
    expect((g.structuredContent!.goal as { checkIns: unknown[] }).checkIns.length).toBeGreaterThan(3);
    // The goal page's scorecard, in the same words (domain/scorecard): the assistant and the page agree.
    const card = g.structuredContent!.scorecard as { label: string; value: string; detail: string }[];
    expect(card.map((c) => c.label).slice(0, 3)).toEqual(['Vs plan', 'Vs last week', 'To target']);
    expect(card[3]!.value).toMatch(/^(Likely|Possible|Unlikely|Very unlikely|Too early to say|Can’t say)$/);
    expect((await call('get_goal', { goal_id: 'nope' })).isError).toBe(true);
  });

  it('finds goals by scope, as the Goals screen’s tabs (goals spec, rule 1): mine, team, watching, all', async () => {
    const ids = (r: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['call']>>) => (r.structuredContent!.goals as { id: string }[]).map((g) => g.id).sort();
    const { call, data } = await setup('tariq');
    const s = data() as Snapshot;
    const running = s.goals.filter((g) => !g.stoppedAt && !g.removedAt);
    // Mine: the goals Tariq owns, the same as mine: true.
    expect(ids(await call('find_goals', { scope: 'mine' }))).toEqual(running.filter((g) => g.ownerId === 'tariq').map((g) => g.id).sort());
    expect(ids(await call('find_goals', { scope: 'mine' }))).toEqual(ids(await call('find_goals', { mine: true })));
    // Team: his team's goals (he leads Developer Experience, his own team).
    const team = ids(await call('find_goals', { scope: 'team' }));
    expect(team).toEqual(running.filter((g) => g.teamId === 'devex').map((g) => g.id).sort());
    // Watching: what he watches, directly or through a tree or a level, as Watching lists it.
    const { watchedGoals } = await import('../domain/review');
    expect(ids(await call('find_goals', { scope: 'watching' }))).toEqual(watchedGoals('tariq', s).filter((g) => !g.stoppedAt).map((g) => g.id).sort());
    // All: every goal in the running cycle; no scope is All.
    const all = ids(await call('find_goals', { scope: 'all', limit: 200 }));
    expect(all.length).toBe(running.length);
    expect(ids(await call('find_goals', { limit: 200 }))).toEqual(all);
    // A scope narrows the other filters, and they narrow it.
    expect(ids(await call('find_goals', { scope: 'team', status: 'off' })).every((id) => team.includes(id))).toBe(true);
    // A Goals link's scope= is read too (build review of #116); the scope argument wins over it.
    expect(ids(await call('find_goals', { query: 'scope=mine' }))).toEqual(ids(await call('find_goals', { scope: 'mine' })));
    expect(ids(await call('find_goals', { query: '/goals?scope=team&status=off' }))).toEqual(ids(await call('find_goals', { scope: 'team', status: 'off' })));
    expect(ids(await call('find_goals', { query: 'scope=mine', scope: 'all', limit: 200 }))).toEqual(all);
  });

  it('says why a scope someone doesn’t have finds nothing, and refuses a scope that doesn’t exist', async () => {
    const { call, data } = await setup('oskar');
    // Oskar here is in no team, leads none and owns no goals.
    const s = data() as Snapshot;
    s.people.find((p) => p.id === 'oskar')!.teamId = null;
    for (const t of s.teams) if (t.leadId === 'oskar') t.leadId = 'amara';
    for (const g of s.goals) if (g.ownerId === 'oskar') g.ownerId = 'amara';
    const mine = await call('find_goals', { scope: 'mine' });
    expect(mine.structuredContent!.goals).toEqual([]);
    expect(mine.structuredContent!.why).toBe('You own no goals this year.');
    expect(JSON.parse(mine.content[0]!.text)).toEqual(mine.structuredContent);
    expect((await call('find_goals', { scope: 'team' })).structuredContent!.why).toBe('You’re in no team and lead none.');
    const nope = await call('find_goals', { scope: 'everyone' });
    expect(nope.isError).toBe(true);
    expect(nope.content[0]!.text).toMatch(/mine, team, watching or all/);
  });

  it('finds what the Goals screen finds for a link with a search, and an argument only narrows a link (outside review of #88)', async () => {
    const { call, data } = await setup();
    const ids = (r: Awaited<ReturnType<typeof call>>) => (r.structuredContent!.goals as { id: string }[]).map((g) => g.id).sort();
    const s = data() as Snapshot;
    for (const link of ['q=flow', 'q=back', 'q=lin', 'q=off+track', 'q=G-48', 'status=off,risk&q=ci']) {
      const want = applyQuery(summariseAll(s.goals.filter((g) => !g.stoppedAt && !g.removedAt), s, demo, today, NOW), parseQuery(new URLSearchParams(link)), { goals: s.goals, cycle: demo, week: NOW }).map((x) => x.goal.id).sort();
      expect(ids(await call('find_goals', { query: link })), link).toEqual(want);
    }
    expect(ids(await call('find_goals', { query: 'status=on', status: 'off' }))).toEqual([]);
    expect(ids(await call('find_goals', { query: 'level=team', level: 'svp' }))).toEqual([]);
    expect(ids(await call('find_goals', { query: 'level=team,svp', level: 'svp' })).length).toBeGreaterThan(0);
  }, 30_000);

  it('finds goals with the Goals screen’s filters, by a link’s query or a saved view’s name', async () => {
    const { call, data } = await setup();
    const ids = (r: Awaited<ReturnType<typeof call>>) => (r.structuredContent!.goals as { id: string }[]).map((g) => g.id).sort();
    expect(ids(await call('find_goals', { query: 'q=MergeFlow' }))).toContain('lead-mq');
    // A whole link works too; the part before ? is ignored.
    expect(ids(await call('find_goals', { query: 'https://x/goals?status=stale&view=table' }))).toEqual(['cost-storage', 'env-search']);
    data().views = [{ id: 'v1', personId: 'amara', name: 'Missed dates', params: 'result=missed', pinned: true, createdAt: today.toISOString(), updatedAt: today.toISOString(), deletedAt: null }];
    expect(ids(await call('find_goals', { view: 'missed dates' }))).toContain('lead-mq');
    expect((await call('find_goals', { view: 'Someone else’s' })).isError).toBe(true);
  });

  it('posts a check-in as the token’s person, with the app’s rules, logged via MCP', async () => {
    const { call, data, touched } = await setup();
    const behind = await call('post_check_in', { goal_id: 'mttr-pir', value: 30 });
    expect(behind.isError).toBe(true);
    expect(behind.content[0]!.text).toMatch(/needs a Cause and a Why/);
    const onPlan = Math.round(planAt((data().goals.find((g) => g.id === 'mttr-pir') as MetricGoal).plan, NOW, WEEKS));
    const dry = await call('post_check_in', { goal_id: 'mttr-pir', value: onPlan, dry_run: true });
    expect(dry.content[0]!.text).toMatch(/dry run/);
    expect(data().checkIns.some((c) => c.goalId === 'mttr-pir' && c.week === NOW)).toBe(false);
    const ok = await call('post_check_in', { goal_id: 'mttr-pir', value: onPlan });
    expect(ok.isError).toBe(false);
    const c = data().checkIns.find((x) => x.goalId === 'mttr-pir' && x.week === NOW)!;
    expect(c.authorId).toBe('mateo');
    expect(data().changes.at(-2)!.diffs).toEqual(expect.arrayContaining([{ field: 'Via', from: '—', to: 'MCP' }]));
    expect(touched()).toBeGreaterThan(0);
    // The week now has a check-in, so posting it again corrects it: refused without a reason, saved with one (#225's review).
    const again = await call('post_check_in', { goal_id: 'mttr-pir', value: onPlan + 1 });
    expect(again.isError).toBe(true);
    expect(again.content[0]!.text).toMatch(/corrects it, which needs a reason.*call again with "reason"/);
    const fixed = await call('post_check_in', { goal_id: 'mttr-pir', value: onPlan + 1, reason: 'The first number was misread' });
    expect(fixed.isError).toBe(false);
    expect(data().checkIns.filter((x) => x.goalId === 'mttr-pir' && x.week === NOW && !x.removedAt).map((x) => x.value)).toEqual([onPlan + 1]);
    expect(data().changes.flatMap((ch) => ch.diffs ?? [])).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'Why corrected', to: 'The first number was misread' })]));
  });

  it('can’t change someone else’s goal, unless the person is an admin', async () => {
    const mateo = await setup('mateo');
    expect((await mateo.call('update_goal', { goal_id: 'ns-ai', level: 'svp' })).content[0]!.text).toMatch(/Only Tariq Haddad/);
    const amara = await setup('amara');
    expect((await amara.call('update_goal', { goal_id: 'ns-ai', level: 'svp' })).isError).toBe(false);
    expect(amara.data().goals.find((g) => g.id === 'ns-ai')!.level).toBe('svp');
  });

  it('asks for a reason before changing a plan, then sets plan numbers', async () => {
    const { call, data } = await setup();
    const no = await call('set_plan_numbers', { goal_id: 'mttr-pir', numbers: [{ week: 48, value: 50 }] });
    expect(no.content[0]!.text).toMatch(/needs a reason/);
    const yes = await call('set_plan_numbers', { goal_id: 'mttr-pir', numbers: [{ week: 48, value: 50 }], reason: 'The incident tool export ships in week 50' });
    expect(yes.isError).toBe(false);
    expect(planAt((data().goals.find((g) => g.id === 'mttr-pir') as MetricGoal).plan, 48, WEEKS)).toBe(50);
  });

  it('checks a target that flips which way is better with the person before saving it', async () => {
    const { call, data } = await setup();
    const g = data().goals.find((x) => x.id === 'mttr-pir') as MetricGoal;
    const flipped = 2 * g.plan.start - g.plan.target;
    const args = { goal_id: 'mttr-pir', target: flipped, reason: 'Measured the other way round now' };
    const no = await call('update_goal', args);
    expect(no.isError).toBe(true);
    expect(no.content[0]!.text).toMatch(/This makes (higher|lower) better[\s\S]*"confirm": true/);
    expect((data().goals.find((x) => x.id === 'mttr-pir') as MetricGoal).plan.target).toBe(g.plan.target);
    const yes = await call('update_goal', { ...args, confirm: true });
    expect(yes.isError).toBe(false);
    expect((data().goals.find((x) => x.id === 'mttr-pir') as MetricGoal).plan.target).toBe(flipped);
  });

  it('keeps Import’s size limit: more rows than one file may have are refused before they are checked (#257 review)', async () => {
    const { call } = await setup('amara');
    const out = await call('bulk_change', { check_ins: Array.from({ length: 30_001 }, () => ({ 'Goal ID': 'mttr-pir', Week: 1, Value: 1 })) });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toBe('Not checked. This call has 30,001 rows. Faro reads up to 30,000 in one call. Send them in parts.');
  });

  it('checks a bulk change first and saves only with apply', async () => {
    const { call, data } = await setup('amara');
    const rows = { goals: [{ ID: 'mttr-pir', Level: 'svp' }, { Goal: 'Runbooks with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: 20, Target: 90, 'Feeds into ID': 'ns-cfr' }] };
    const check = await call('bulk_change', rows);
    expect(check.content[0]!.text).toMatch(/dry run.*1 new goal, 1 goal changed/);
    expect(data().goals.some((g) => g.title === 'Runbooks with an owner')).toBe(false);
    await call('bulk_change', { ...rows, apply: true });
    expect(data().goals.find((g) => g.title === 'Runbooks with an owner')!.parentId).toBe('ns-cfr');
  });

  it('says each new goal’s ID and key, from create_goal and bulk_change, dry run and saved (MCP load, 12 Nov)', async () => {
    const { call, data } = await setup('amara');
    type Created = { id: string; key: string | null; title: string }[];
    const one = await call('create_goal', { type: 'metric', title: 'Runbooks with an owner', owner: 'Mateo Fernández', unit: '%', start: 20, target: 90 });
    expect(one.isError).toBe(false);
    const made = data().goals.find((g) => g.title === 'Runbooks with an owner')!;
    expect(made.key).toMatch(/^G-\d+$/);
    expect(one.structuredContent!.created as Created).toEqual([{ id: made.id, key: made.key, title: made.title }]);
    expect((one.structuredContent!.changes as { key?: string }[])[0]!.key).toBe(made.key);
    expect(one.content[0]!.text).toContain(`New goal: ${made.key} · ${made.id} · Runbooks with an owner.`);
    const rows = { goals: [{ Goal: 'Alerts with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: 10, Target: 80 }, { Goal: 'Dashboards with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: 5, Target: 60 }] };
    const dry = (await call('bulk_change', rows)).structuredContent!.created as Created;
    expect(dry.map((x) => x.key)).toEqual(dry.map((x) => x.key).filter((k) => /^G-\d+$/.test(k ?? '')));
    expect(dry).toHaveLength(2);
    // A dry run gives no ID: the save makes its own (#242's review).
    expect(dry.map((x) => x.id)).toEqual([null, null]);
    const saved = (await call('bulk_change', { ...rows, apply: true })).structuredContent!.created as Created;
    for (const x of saved) expect(data().goals.find((g) => g.id === x.id)?.key).toBe(x.key);
    expect(new Set(saved.map((x) => x.key)).size).toBe(2);
  });

  it('creates and changes a range between two numbers (lower and limit)', async () => {
    const { call, data } = await setup('amara');
    const made = await call('create_goal', { type: 'range', title: 'API uptime', owner: 'Mateo Fernández', unit: '%', decimals: 2, lower: 99.5, limit: 99.95, margin: 0.1 });
    expect(made.isError).toBe(false);
    const g = data().goals.find((x) => x.title === 'API uptime')!;
    expect(g.kind === 'range' && g.range).toEqual({ bound: 'between', lower: 99.5, limit: 99.95, margin: 0.1 });
    // A lower bound alone keeps the upper one; at most drops the lower.
    expect((await call('update_goal', { goal_id: g.id, lower: 99.6 })).isError).toBe(false);
    expect(data().goals.find((x) => x.id === g.id)!).toMatchObject({ range: { bound: 'between', lower: 99.6, limit: 99.95 } });
    expect((await call('update_goal', { goal_id: g.id, must_stay: 'at least', limit: 99.5 })).isError).toBe(false);
    expect(data().goals.find((x) => x.id === g.id)!).toMatchObject({ range: { bound: 'atLeast', limit: 99.5, margin: 0.1 } });
    expect((data().goals.find((x) => x.id === g.id) as RangeGoal).range.lower).toBeUndefined();
    // Lower at or above the upper is goal entry's Must fix.
    const bad = await call('create_goal', { type: 'range', title: 'Error budget left', owner: 'Mateo Fernández', unit: '%', lower: 5, limit: 2 });
    expect(bad.content[0]!.text).toContain('The lower number (5%) must be below the upper one (2%).');
  });

  it('names the key the database stored, not the one the request asked for (#242’s review)', async () => {
    const { call, data, deps } = await setup('amara');
    // Another goal takes the next key between this request's load and its save: the database gives the new goal the
    // one after (migration 0021), as okr_goal_key does.
    const commit = deps.commit;
    let stored: Record<string, string> = {};
    deps.commit = async (ws, c) => {
      const used = new Set(data().goals.map((g) => g.key));
      const next = () => { let n = Math.max(...[...used].map((k) => Number(String(k).slice(2)) || 0)) + 1; while (used.has(`G-${n}`)) n++; return `G-${n}`; };
      used.add(next()); // the other goal's
      stored = {};
      const goals = (c.goals ?? []).map((g) => (data().goals.some((o) => o.id === g.id) ? g : (() => { const key = next(); used.add(key); stored[g.id] = key; return { ...g, key }; })()));
      await commit(ws, { ...c, goals });
    };
    deps.goalKeys = async (_ws, ids) => Object.fromEntries(ids.filter((id) => stored[id]).map((id) => [id, stored[id]!]));
    const one = await call('create_goal', { type: 'metric', title: 'Runbooks with an owner', owner: 'Mateo Fernández', unit: '%', start: 20, target: 90 });
    const made = data().goals.find((g) => g.title === 'Runbooks with an owner')!;
    const said = (one.structuredContent!.created as { key: string }[])[0]!.key;
    expect(said).toBe(made.key);
    expect(one.content[0]!.text).toContain(`New goal: ${made.key} · ${made.id}`);
  });

  it('lists no new goals when a bulk_change is refused (#242’s review)', async () => {
    const { call } = await setup('amara');
    const r = await call('bulk_change', { goals: [{ Goal: 'Alerts with an owner', Owner: 'Nobody At All', Type: 'metric', Unit: '%', Start: 10, Target: 80 }] });
    expect(r.isError).toBe(true);
    expect(r.structuredContent!.created).toEqual([]);
  });

  it('lists find_goals a page at a time, compactly, with the same keys every time (#249’s review)', async () => {
    const { call, data } = await setup('amara');
    const running = data().goals.filter((g) => !g.stoppedAt && !g.removedAt && !isProposed(g)).length;
    const first = await call('find_goals', {});
    const d = first.structuredContent! as { total: number; offset: number; goals: { id: string }[]; more: string | null; why: string | null };
    expect(d.total).toBe(running);
    expect(d.goals).toHaveLength(50);
    expect(d.more).toBe(`${running - 50} more: call again with offset 50.`);
    expect(d.why).toBeNull();
    // Compact: no indent, and the demo's 126 goals no longer come back in one 81k answer.
    expect(first.content[0]!.text).not.toContain('\n');
    expect(first.content[0]!.text.length).toBeLessThan(40_000);
    const second = (await call('find_goals', { offset: 50 })).structuredContent! as typeof d;
    expect(second.goals.map((g) => g.id)).not.toContain(d.goals[0]!.id);
    const last = (await call('find_goals', { offset: 100, limit: 200 })).structuredContent! as typeof d;
    expect(last.goals).toHaveLength(running - 100);
    expect(last.more).toBeNull();
    // Nothing found says why, with the same keys as a full answer.
    const none = (await call('find_goals', { text: 'zzzz nothing' })).structuredContent! as typeof d;
    expect(Object.keys(none)).toEqual(Object.keys(d));
    expect(none.why).toMatch(/^No goal matches/);
  });

  it('answers every list the same way, filtered or not: its data as JSON, as structured content and as text (MCP load, 12 Nov)', async () => {
    const { rpc, call } = await setup('amara');
    const asks: [string, object][] = [['find_goals', {}], ['find_goals', { text: 'deploy' }], ['find_goals', { text: 'zzzz nothing' }], ['find_goals', { status: 'off' }], ['get_activity', { limit: 5 }], ['list_requests', { status: 'all' }]];
    // Every list_ tool, as the server lists them, so a new one is held to the same shape.
    const names = ((await rpc('tools/list')).body.result.tools as { name: string }[]).map((t) => t.name).filter((n) => n.startsWith('list_'));
    for (const n of names) asks.push([n, {}]);
    for (const [name, args] of asks) {
      const r = await call(name, args);
      if (r.isError) continue; // an inbox this test server hasn't got
      expect(r.structuredContent, name).toBeDefined();
      expect(JSON.parse(r.content[0]!.text), `${name} ${JSON.stringify(args)}`).toEqual(r.structuredContent);
    }
    const all = await call('find_goals', {}), some = await call('find_goals', { text: 'deploy' });
    expect(Object.keys(some.structuredContent!)).toEqual(Object.keys(all.structuredContent!));
  });

  it('[REVIEW-DECIDE] decides in a review and adds a next step, as the app does', async () => {
    const { call, data } = await setup('daniel');
    const refused = await call('review_call', { review_id: 'devprod', goal_id: 'lead-mq', kind: 'accept', text: 'no' });
    expect(refused.isError).toBe(true);
    await call('review_call', { review_id: 'devprod', goal_id: 'lead-mq', kind: 'accept', text: 'The vendor fix lands next release; nothing we can do sooner.' });
    expect(data().decisions.at(-1)!.note).toBe('We accept the risk: The vendor fix lands next release; nothing we can do sooner.');
    // Only about a goal the review walks (build review of #322): one outside it is refused, and nothing is saved.
    const outside = data().goals.find((g) => !goalsIn(data().reviews.find((r) => r.id === 'devprod')!.scope, data().goals).some((v) => v.id === g.id))!;
    const before = data().decisions.length;
    const off = await call('review_call', { review_id: 'devprod', goal_id: outside.id, kind: 'acknowledge' });
    expect(off.isError).toBe(true);
    expect(off.content[0]!.text).toContain('doesn’t cover');
    expect(data().decisions.length).toBe(before);
    await call('add_action', { goal_id: 'lead-review-rota', text: 'Audit CODEOWNERS for payments', who: 'Rhea Kapoor', due_week: 48 });
    const a = data().requests!.at(-1)!;
    expect(a).toMatchObject({ kind: 'action', recipientId: 'rhea', dueWeek: 48, ask: 'Audit CODEOWNERS for payments' });
  });

  it('[REVIEW-DECIDE] undoes marking a goal reviewed, as the app’s Undo does (parity: unmarkReviewed)', async () => {
    const { call, data } = await setup('daniel');
    expect((await call('review_call', { review_id: 'devprod', goal_id: 'lead-mq', kind: 'acknowledge' })).isError).toBe(false);
    const mark = data().decisions.at(-1)!;
    expect(mark).toMatchObject({ kind: 'acknowledge', goalId: 'lead-mq' });
    expect(mark.removedAt ?? null).toBe(null);
    const undo = await call('unmark_reviewed', { call_ids: [mark.id] });
    expect(undo.isError).toBe(false);
    expect(data().decisions.find((d) => d.id === mark.id)!.removedAt).toBeTruthy();
    // Undone already: refused, and nothing changes.
    const again = await call('unmark_reviewed', { call_ids: [mark.id] });
    expect(again.isError).toBe(true);
    expect(again.content[0]!.text).toMatch(/There’s no mark with those IDs/);
  });

  it('comments and exports', async () => {
    const { call, data } = await setup('oskar');
    await call('add_comment', { goal_id: 'ns-lead', text: 'Merge queue is the bottleneck' });
    expect(data().changes.at(-1)!.diffs[0]!.to).toBe('Merge queue is the bottleneck');
    const j = await call('export', { format: 'json' });
    expect(JSON.parse(j.content[0]!.text).format).toBe('goals-app.export');
  });

  it('says what needs someone in plain sentences, each ending in one full stop', async () => {
    for (const who of ['rhea', 'amara', 'daniel']) {
      const text = (await (await setup(who)).call('get_my_work')).content[0]!.text;
      expect(text, who).toMatch(/Your goals that need attention: /);
      expect(text, who).not.toMatch(/\.\.|\.;|\. \./);
    }
  });

  it('[ONE-ASK] reads and answers every kind of ask, under the same rules as the app', async () => {
    const amara = await setup('amara');
    const work = await amara.call('get_my_work');
    const w = work.structuredContent as { requestsForYou: { id: string; kind: string }[]; yourActions: { id: string; action: string }[] };
    expect(w.requestsForYou.map((r) => r.kind)).toEqual(['decision']);
    expect(w.yourActions.map((a) => a.action)).toContain('Take the runner budget to the finance review.');
    // An action is marked done, not answered; a decision is answered.
    const action = w.yourActions[0]!;
    expect((await amara.call('answer_request', { request_id: action.id, answer: 'Done' })).isError).toBe(true);
    expect((await amara.call('mark_action_done', { request_id: action.id, note: 'On the finance agenda for the 12th' })).isError).toBe(false);
    expect(asksOf(amara.data()).find((r) => r.id === action.id)).toMatchObject({ status: 'done', answer: 'On the finance agenda for the 12th' });
    const ok = await amara.call('answer_request', { request_id: w.requestsForYou[0]!.id, answer: 'Approved for Q4.' });
    expect(ok.isError).toBe(false);
    expect(asksOf(amara.data()).find((r) => r.id === w.requestsForYou[0]!.id)!.status).toBe('answered');
    // Oskar asks Tariq a question; only Tariq (or an admin) answers it, and a comment doesn't.
    const oskar = await setup('oskar');
    expect((await oskar.call('ask_question', { goal_id: 'lead-review', question: 'Which repositories are slowest?' })).isError).toBe(false);
    const q = asksOf(oskar.data()).find((r) => r.kind === 'question' && r.ask === 'Which repositories are slowest?')!;
    expect(q).toMatchObject({ recipientId: 'tariq', status: 'open' });
    await oskar.call('add_comment', { goal_id: 'lead-review', text: 'Any news?' });
    expect(asksOf(oskar.data()).find((r) => r.id === q.id)!.status).toBe('open');
    expect((await oskar.call('answer_request', { request_id: q.id, answer: 'Myself' })).content[0]!.text).toMatch(/Only Tariq Haddad or an admin/);
    const list = await oskar.call('list_requests', { kind: 'question', status: 'open' });
    expect((list.structuredContent!.requests as { id: string }[]).map((r) => r.id)).toContain(q.id);
    expect((await oskar.call('withdraw_request', { request_id: q.id })).isError).toBe(false);
    expect(asksOf(oskar.data()).find((r) => r.id === q.id)!.status).toBe('withdrawn');
  });

  it('removes, archives and undoes with the app’s own rules: stop a goal, edit and remove a comment, mark someone as left, undo an import, restore', async () => {
    const rhea = await setup('rhea');
    // Not Rhea's goal: refused, as in the app.
    expect((await rhea.call('stop_goal', { goal_id: 'lead-mq', reason: 'Not mine to stop at all.' })).content[0]!.text).toMatch(/Only the goal’s owner or an admin/);
    expect((await rhea.call('delete_goal', { goal_id: 'ci-docker' })).content[0]!.text).toMatch(/stop it instead/);
    expect((await rhea.call('stop_goal', { goal_id: 'ci-docker', reason: 'Taken over by the platform team.' })).isError).toBe(false);
    expect(rhea.data().goals.find((g) => g.id === 'ci-docker')).toMatchObject({ stopReason: 'Taken over by the platform team.', stoppedBy: 'rhea' });
    expect(((await rhea.call('find_goals', { text: 'Base image' })).structuredContent!.goals as { id: string }[]).map((g) => g.id)).not.toContain('ci-docker');
    // A comment: written, edited, removed; get_goal says so.
    await rhea.call('add_comment', { goal_id: 'lead-review', text: 'First go' });
    const goal = await rhea.call('get_goal', { goal_id: 'lead-review' });
    const c = (goal.structuredContent!.comments as { id: string; text: string }[]).find((x) => x.text === 'First go')!;
    expect((await rhea.call('edit_comment', { comment_id: c.id, text: 'Second go' })).isError).toBe(false);
    expect((await rhea.call('delete_comment', { comment_id: c.id })).isError).toBe(false);
    const after = (await rhea.call('get_goal', { goal_id: 'lead-review' })).structuredContent!.comments as { id: string; text: string; edited: boolean; removed: boolean }[];
    expect(after.find((x) => x.id === c.id)).toMatchObject({ text: 'Comment removed', edited: true, removed: true });
    // What she removed, she can list and restore.
    const removed = (await rhea.call('list_removed')).structuredContent!.removed as { kind: string; id: string }[];
    expect(removed.map((r) => r.kind).sort()).toEqual(['comment', 'stopped']);
    expect((await rhea.call('restore_removed', { kind: 'stopped', id: 'ci-docker' })).isError).toBe(false);
    expect(rhea.data().goals.find((g) => g.id === 'ci-docker')!.stoppedAt).toBeNull();
    // An import through bulk_change, undone.
    await rhea.call('bulk_change', { goals: [{ ID: 'ci-docker', Goal: 'Base image build time, renamed' }], apply: true });
    const imports = ((await rhea.call('get_activity', { query: 'kind=ai', limit: 5 })).structuredContent!.changes as { importId?: string; canUndo?: boolean }[]).filter((x) => x.importId);
    expect(imports[0]!.canUndo).toBe(true);
    expect((await rhea.call('undo_import', { import_id: imports[0]!.importId })).content[0]!.text).toMatch(/1 row put back/);
    expect(rhea.data().goals.find((g) => g.id === 'ci-docker')!.title).toBe('Base image build time');
    // Admins only: marking someone as left, with their goals handed over; then their token stops working.
    expect((await rhea.call('mark_person_left', { person: 'Mateo', goals_to: 'Marisol', asks_to: 'Marisol' })).content[0]!.text).toMatch(/Only admins/);
    // A refusal says who the token acts as (backlog N: a token made for a non-admin, taken for an admin's).
    expect((await rhea.call('delete_workspace', { confirm_name: 'x' })).content[0]!.text).toBe('Only admins can delete the workspace. This token acts as Rhea Kapoor, who isn’t an admin.');
    const grace = await setup('grace');
    expect((await grace.call('mark_person_left', { person: 'Mateo' })).content[0]!.text).toMatch(/choose who takes them over/);
    expect((await grace.call('mark_person_left', { person: 'Mateo', goals_to: 'Marisol', asks_to: 'Marisol' })).isError).toBe(false);
    expect(grace.data().goals.filter((g) => g.ownerId === 'mateo' && g.cycleId === demo.id)).toEqual([]);
    const mateo = await setup('mateo');
    (mateo.deps as { load: Deps['load'] }).load = async () => grace.data();
    expect((await mateo.rpc('tools/call', { name: 'get_overview', arguments: {} })).body.error.message).toMatch(/no longer in the workspace/);
  });
});
