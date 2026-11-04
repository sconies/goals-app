/* Spec scenarios for the AI assistants: through the MCP server, with a person's token, the assistant can do everything
   that person can do in the app, under the same rules, and every change is logged as them, via the assistant. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit } from '../src/data/store';
import { seed } from '../src/data/seed';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';
import { ACTIONS } from '../src/mcp/parity';
import { TOOLS } from '../src/mcp/tools';

const R = (text: string) => `[MCP-PARITY] ${text}`;
const OCT = new Date('2026-10-30T12:00:00Z'); // week 44 of 53
const DEC = new Date('2026-12-24T12:00:00Z'); // week 52: the wrap-up is open

async function as(personId: string, today = OCT, start?: Snapshot) {
  let data: Snapshot = start ?? seed(OCT);
  const token = newToken();
  const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'elena', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [...(data.tokens ?? []), t] };
  let deleted = false;
  const deps: Deps = {
    findToken: async (h) => { const x = (data.tokens ?? []).find((k) => k.tokenHash === h && !k.revokedAt); return x ? { token: x, workspaceId: 'acme' } : null; },
    workspaceName: async () => 'Acme',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    deleteWorkspace: async () => { deleted = true; },
    now: () => today,
  };
  let n = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    const body = await res.json() as { result?: { content: { text: string }[]; structuredContent?: Record<string, unknown>; isError: boolean }; error?: { message: string } };
    if (!body.result) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    return { text: body.result.content[0]!.text, data: body.result.structuredContent as Record<string, any> | undefined, error: body.result.isError };
  };
  return { call, data: () => data, deleted: () => deleted };
}
const viaMcp = (s: Snapshot) => s.changes.at(-1)!.diffs.some((d) => d.field === 'Via' && d.to === 'AI assistant (MCP)');

describe('AI assistants can do what the person can', () => {
  it(R('every action in the app has a tool, and every tool the app’s parity map names exists'), () => {
    const names = new Set(TOOLS.map((t) => t.name));
    for (const [action, e] of Object.entries(ACTIONS)) {
      if (Array.isArray(e)) for (const tool of e) expect(names.has(tool), `${action} → ${tool}`).toBe(true);
      else expect(e.notForAssistants.length, action).toBeGreaterThan(20);
    }
    expect(TOOLS.length).toBeGreaterThanOrEqual(40);
  });

  it(R('what needs me: check-ins due, requests waiting on me, reviews I’m in'), async () => {
    const elena = await as('elena');
    const w = await elena.call('get_my_work');
    expect(w.data!.requestsForYou.map((r: { id: string }) => r.id).sort()).toEqual(['req_ci_access_43', 'req_ci_head_43']);
    expect(w.data!.yourReviews[0].name).toBe('Platform weekly review');
    const kofi = await as('kofi');
    // Cache hit rate already has this week's check-in, so it isn't due.
    expect((await kofi.call('get_my_work')).data!.checkInsDue.map((g: { id: string }) => g.id).sort()).toEqual(['alerts', 'cfr']);
  });

  it(R('requests: only the person asked (or an admin) answers; the owner withdraws; another owner links'), async () => {
    const kofi = await as('kofi');
    const no = await kofi.call('answer_request', { request_id: 'req_ci_head_43', answer: 'Approved' });
    expect(no.error).toBe(true);
    expect(no.text).toMatch(/Only Elena Ruiz or an admin/);
    expect((await kofi.call('withdraw_request', { request_id: 'req_ci_head_43', goal_id: 'head' })).text).toMatch(/Only the goal’s owner or an admin/);
    const aisha = await as('aisha');
    expect((await aisha.call('link_request', { request_id: 'req_ci_head_43', goal_id: 'access' })).error).toBe(false);
    const linked = aisha.data().requests!;
    expect(linked.find((r) => r.id === 'req_ci_head_43')!.goalIds).toEqual(['head', 'access']);
    expect(linked.find((r) => r.id === 'req_ci_access_43')!.status).toBe('withdrawn');
    const elena = await as('elena', OCT, aisha.data());
    const yes = await elena.call('answer_request', { request_id: 'req_ci_head_43', answer: 'Approved for Q4, read-only.' });
    expect(yes.error).toBe(false);
    const r = elena.data().requests!.find((x) => x.id === 'req_ci_head_43')!;
    expect([r.status, r.answer, r.answeredBy]).toEqual(['answered', 'Approved for Q4, read-only.', 'elena']);
    expect(viaMcp(elena.data())).toBe(true);
    expect((await elena.call('list_requests', { status: 'answered' })).data!.requests).toHaveLength(1);
  });

  it(R('asks for an update: once until the owner checks in, undone only by whoever asked'), async () => {
    const tom = await as('tom');
    expect((await tom.call('ask_for_update', { goal_id: 'env' })).text).toMatch(/Asked Jonas/);
    expect((await tom.call('ask_for_update', { goal_id: 'env' })).text).toMatch(/Already asked/);
    const sam = await as('sam', OCT, tom.data());
    expect((await sam.call('undo_update_ask', { goal_id: 'env' })).text).toMatch(/Only whoever asked/);
    const jonas = await as('jonas', OCT, tom.data());
    expect((await jonas.call('get_my_work')).data!.asksForAnUpdate).toHaveLength(1);
    expect((await tom.call('undo_update_ask', { goal_id: 'env' })).error).toBe(false);
    expect((await (await as('kofi')).call('ask_for_update', { goal_id: 'cfr' })).text).toMatch(/your own goal/);
  });

  it(R('reviews: set one up, walk its agenda, say things, correct them; only people in it change it'), async () => {
    const sam = await as('sam');
    const agenda = await sam.call('get_review', { review_id: 'weekly' });
    expect(agenda.data!.toDiscuss.length + agenda.data!.healthy.length).toBe(agenda.data!.of);
    await sam.call('review_call', { review_id: 'weekly', goal_id: 'lead', kind: 'acknowledge' });
    expect((await sam.call('review_call', { review_id: 'weekly', goal_id: 'head', kind: 'ask' })).text).toMatch(/Write the question/);
    await sam.call('review_call', { review_id: 'weekly', goal_id: 'head', kind: 'action', text: 'Draft the interim scope', who: 'Maya', due_week: 46 });
    const action = sam.data().decisions.at(-1)!;
    expect([action.kind, action.assigneeId, action.dueWeek]).toEqual(['action', 'maya', 46]);
    expect((await sam.call('get_review', { review_id: 'weekly' })).data!.reviewed).toBe(agenda.data!.reviewed + 1);
    expect((await (await as('kofi', OCT, sam.data())).call('edit_call', { call_id: action.id, text: 'Something else' })).text).toMatch(/Only whoever said it/);
    await sam.call('edit_call', { call_id: action.id, text: 'Draft and share the interim scope' });
    expect(sam.data().decisions.find((d) => d.id === action.id)!.note).toBe('Draft and share the interim scope');

    const made = await sam.call('save_review', { name: 'Reliability fortnightly', every_weeks: 2, weekday: 'Tuesday', trees: ['cfr'], people: ['Kofi'] });
    const id = made.data!.id as string;
    expect(sam.data().reviews.find((r) => r.id === id)!.people.sort()).toEqual(['kofi', 'sam']);
    expect((await sam.call('save_review', { name: 'Nothing in it' })).text).toMatch(/Pick the goals/);
    const outsider = await as('tom', OCT, sam.data());
    expect((await outsider.call('save_review', { review_id: id, name: 'Mine now' })).text).toMatch(/Only someone in the review/);
    expect((await sam.call('save_review', { review_id: id, every_weeks: 4 })).error).toBe(false);
  });

  it(R('watching: watch a goal, a tree or a level, list it, stop'), async () => {
    const tom = await as('tom');
    await tom.call('watch', { kind: 'tree', ref: 'cost' });
    expect((await tom.call('watch', { kind: 'tree', ref: 'cost' })).text).toMatch(/Already watching/);
    const list = await tom.call('list_watching');
    expect(list.data!.goals.length).toBeGreaterThan(1);
    const mine = list.data!.watches.find((w: { ref: string }) => w.ref === 'cost');
    expect((await (await as('kofi', OCT, tom.data())).call('unwatch', { watch_id: mine.id })).text).toMatch(/someone else’s/);
    await tom.call('unwatch', { watch_id: mine.id });
    expect(tom.data().watches.some((w) => w.id === mine.id)).toBe(false);
    expect((await tom.call('watch', { kind: 'level', ref: 'board' })).error).toBe(true);
  });

  it(R('people: admins add and change people; there is always an admin'), async () => {
    expect((await (await as('kofi')).call('save_person', { name: 'New Person' })).text).toMatch(/Only admins/);
    const priya = await as('priya');
    const added = await priya.call('save_person', { name: 'Ada Lovelace', job_title: 'Staff engineer', team: 'SRE / AIOps' });
    const p = priya.data().people.find((x) => x.id === added.data!.id)!;
    expect([p.name, p.initials, p.teamId, p.admin]).toEqual(['Ada Lovelace', 'AL', 'sre', false]);
    expect((await priya.call('save_person', { name: 'Ada Lovelace' })).text).toMatch(/already here/);
    await priya.call('save_person', { person_id: p.id, admin: true });
    expect(priya.data().people.find((x) => x.id === p.id)!.admin).toBe(true);
    expect((await priya.call('list_people')).data!.people.length).toBe(priya.data().people.length);
  });

  it(R('the end of the cycle: wrap-ups open in the last two weeks; owners wrap up; an admin starts the next cycle'), async () => {
    expect((await (await as('kofi')).call('wrap_up_goal', { goal_id: 'cfr', result: 'hit', learned: 'Canaries caught most bad deploys.', next: 'carry' })).text).toMatch(/Wrap-ups open in the last two weeks/);
    const kofi = await as('kofi', DEC);
    expect((await kofi.call('wrap_up_goal', { goal_id: 'lead', result: 'hit', learned: 'Not mine to say anything about.', next: 'stop' })).text).toMatch(/Only the goal’s owner/);
    await kofi.call('wrap_up_goal', { goal_id: 'cfr', result: 'hit', learned: 'Canaries caught most bad deploys.', next: 'carry' });
    expect((await kofi.call('get_wrap_up')).data!.goals.find((g: { id: string }) => g.id === 'cfr').wrappedUp).toBe(true);
    expect((await kofi.call('start_next_cycle', { confirm: true })).text).toMatch(/Only admins/);
    const elena = await as('elena', DEC, kofi.data());
    expect((await elena.call('start_next_cycle', {})).text).toMatch(/Ask the person first/);
    const started = await elena.call('start_next_cycle', { confirm: true });
    expect(started.error).toBe(false);
    expect(elena.data().cycles).toHaveLength(seed(OCT).cycles.length + 1);
  });

  it(R('views, tokens, feedback and the activity log, with the same rights as in the app'), async () => {
    const kofi = await as('kofi');
    const v = await kofi.call('save_view', { name: 'Off track', query: 'https://x/goals?status=off' });
    expect((await kofi.call('find_goals', { view: 'off track' })).error).toBe(false);
    expect((await kofi.call('pin_view', { view_id: v.data!.id, pinned: true })).text).toMatch(/Only admins/);
    const elena = await as('elena', OCT, kofi.data());
    await elena.call('pin_view', { view_id: v.data!.id, pinned: true });
    expect((await elena.call('list_views')).data!.views.map((x: { name: string }) => x.name)).toContain('Off track');
    await kofi.call('delete_view', { view_id: v.data!.id }).catch(() => undefined);

    expect((await kofi.call('create_token', { person: 'Maya', name: 'Her laptop' })).text).toMatch(/Only admins/);
    const made = await elena.call('create_token', { person: 'Maya', name: 'Claude on Maya’s laptop' });
    expect(made.data!.token).toMatch(/^gk_/);
    const tok = elena.data().tokens!.find((t) => t.name === 'Claude on Maya’s laptop')!;
    expect(tok.tokenHash).toBe(await hashToken(made.data!.token));
    expect((await kofi.call('list_tokens')).data!.tokens.map((t: { person: string }) => t.person)).toEqual(['Kofi Boateng']);
    await elena.call('revoke_token', { token_id: tok.id });
    expect(elena.data().tokens!.find((t) => t.id === tok.id)!.revokedAt).not.toBeNull();

    await kofi.call('send_feedback', { mood: 'good', text: 'Posting from my assistant works.' });
    expect((await kofi.call('list_feedback')).error).toBe(true);
    const admin = await as('elena', OCT, kofi.data());
    expect((await admin.call('list_feedback')).data!.feedback.at(0).text).toBe('Posting from my assistant works.');
    const log = await elena.call('get_activity', { query: 'kind=ai', limit: 5 });
    expect(log.data!.changes.length).toBeGreaterThan(0);
  });

  it(R('deleting the workspace: admins only, confirmed by its exact name'), async () => {
    expect((await (await as('kofi')).call('delete_workspace', { confirm_name: 'Acme' })).text).toMatch(/Only admins/);
    const elena = await as('elena');
    expect((await elena.call('delete_workspace', { confirm_name: 'acme' })).text).toMatch(/exactly/);
    expect(elena.deleted()).toBe(false);
    await elena.call('delete_workspace', { confirm_name: 'Acme' });
    expect(elena.deleted()).toBe(true);
  });
});
