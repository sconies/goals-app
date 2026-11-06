// @vitest-environment node
import { serve, type Deps } from '../../server/mcp';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { asksOf } from '../domain/asks';
import { currentWeek, planAt } from '../domain/plan';
import type { ApiToken, MetricGoal, Snapshot } from '../domain/types';
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
    expect(data().changes.at(-2)!.diffs).toEqual(expect.arrayContaining([{ field: 'Via', from: '—', to: 'AI assistant (MCP)' }]));
    expect(touched()).toBeGreaterThan(0);
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

  it('checks a bulk change first and saves only with apply', async () => {
    const { call, data } = await setup('amara');
    const rows = { goals: [{ ID: 'mttr-pir', Level: 'svp' }, { Goal: 'Runbooks with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: 20, Target: 90, 'Feeds into ID': 'ns-cfr' }] };
    const check = await call('bulk_change', rows);
    expect(check.content[0]!.text).toMatch(/dry run.*1 new goal, 1 goal changed/);
    expect(data().goals.some((g) => g.title === 'Runbooks with an owner')).toBe(false);
    await call('bulk_change', { ...rows, apply: true });
    expect(data().goals.find((g) => g.title === 'Runbooks with an owner')!.parentId).toBe('ns-cfr');
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
    const grace = await setup('grace');
    expect((await grace.call('mark_person_left', { person: 'Mateo' })).content[0]!.text).toMatch(/choose who takes them over/);
    expect((await grace.call('mark_person_left', { person: 'Mateo', goals_to: 'Marisol', asks_to: 'Marisol' })).isError).toBe(false);
    expect(grace.data().goals.filter((g) => g.ownerId === 'mateo' && g.cycleId === demo.id)).toEqual([]);
    const mateo = await setup('mateo');
    (mateo.deps as { load: Deps['load'] }).load = async () => grace.data();
    expect((await mateo.rpc('tools/call', { name: 'get_overview', arguments: {} })).body.error.message).toMatch(/no longer in the workspace/);
  });
});
