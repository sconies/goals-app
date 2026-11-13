/* Spec scenarios for the AI assistants: through the MCP server, with a person's token, the assistant can do everything
   that person can do in the app, under the same rules, and every change is logged as them, via the assistant. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit } from '../src/data/store';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import type { ApiToken, Ask, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';
import { ACTIONS } from '../src/mcp/parity';
import { TOOLS } from '../src/mcp/tools';
import { MODULES } from '../src/core/registry';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The AI tools of feature modules left out of this build (FARO_WITHOUT=<id>): an action the parity map gives one of
    them has its tool when the module is there, and none without it, like the module's screens. */
const MODS = join(__dirname, '../src/modules');
const LEFT_OUT = new Set(readdirSync(MODS).filter((d) => !MODULES.some((m) => m.id === d)).flatMap((d) => { try { return (JSON.parse(readFileSync(join(MODS, d, 'module.json'), 'utf8')) as { aiTools: string[] }).aiTools; } catch { return []; } }));

const R = (text: string) => `[MCP-PARITY] ${text}`;
const TODAY = new Date('2026-11-05T12:00:00Z'); // Thursday of week 45 of 53
const DEC = new Date('2026-12-24T12:00:00Z'); // week 52: the wrap-up is open

async function as(personId: string, today = TODAY, start?: Snapshot, modulesOff: string[] = []) {
  let data: Snapshot = start ?? seed(TODAY);
  const token = newToken();
  const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [...(data.tokens ?? []), t] };
  let deleted = false;
  const deps: Deps = {
    findToken: async (h) => { const x = (data.tokens ?? []).find((k) => k.tokenHash === h && !k.revokedAt); return x ? { token: x, workspaceId: 'acme' } : null; },
    workspaceName: async () => 'Acme',
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    deleteWorkspace: async () => { deleted = true; },
    modulesOff: async () => modulesOff,
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
const viaMcp = (s: Snapshot) => s.changes.at(-1)!.diffs.some((d) => d.field === 'Via' && d.to === 'MCP');

describe('AI assistants can do what the person can', () => {
  it(R('every action in the app has a tool, and every tool the app’s parity map names exists'), () => {
    const names = new Set(TOOLS.map((t) => t.name));
    for (const [action, e] of Object.entries(ACTIONS)) {
      if (Array.isArray(e)) for (const tool of e) expect(names.has(tool) || LEFT_OUT.has(tool), `${action} → ${tool}`).toBe(true);
      else expect(e.notForAssistants.length, action).toBeGreaterThan(20);
    }
    expect(TOOLS.length).toBeGreaterThanOrEqual(40);
  });

  it(R('what needs me: check-ins due, asks waiting on me (decisions or help, questions, updates, actions), reviews I’m in'), async () => {
    const amara = await as('amara');
    const w = await amara.call('get_my_work');
    expect(w.data!.requestsForYou.map((r: { id: string }) => r.id).sort()).toEqual(['req_po164']);
    // An action is an ask too: Amara's own, from the leadership weekly, waits on her until she marks it done.
    expect(w.data!.yourActions.map((r: { id: string }) => r.id)).toContain('ask_po986');
    expect(w.data!.yourReviews[0].name).toBe('Platform leadership weekly');
  });

  it(R('what needs me: check-ins due are the goals still to post, as Home counts them (a goal that is done is not one)'), async () => {
    const rhea = await as('rhea');
    // Rhea owns eight goals; five have this week's check-in and ci-dedupe is done, so two are due (ci-cost has none yet): "2 check-ins to do" on Home.
    expect((await rhea.call('get_my_work')).data!.checkInsDue.map((g: { id: string }) => g.id).sort()).toEqual(['ci-cost', 'ci-docker']);
  });

  it(R('asks: only the person asked (or an admin) answers; the owner withdraws; another owner links'), async () => {
    // Pavel's merge goal has a request of its own to Amara (built here: nothing in the story is open to the same person as Rhea's).
    const own: Ask = { id: 'req_eval_merge', kind: 'decision', goalIds: ['lead-merge'], askedBy: 'pavel', recipientId: 'amara', ask: 'approve the extra CI runner budget for Q4', status: 'open', dueWeek: null, reviewId: null, week: null, checkInId: 'ci_lead-merge_45', createdAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z', answer: null, answeredBy: null, answeredAt: null };
    const start = seed(TODAY);
    const oskar = await as('oskar', TODAY, { ...start, requests: [...(start.requests ?? []), own] });
    const no = await oskar.call('answer_request', { request_id: 'req_po164', answer: 'Approved' });
    expect(no.error).toBe(true);
    expect(no.text).toMatch(/Only Amara Nwosu or an admin/);
    expect((await oskar.call('withdraw_request', { request_id: 'req_po164', goal_id: 'ns-lead' })).text).toMatch(/Only the goal’s owner, whoever asked, or an admin/);
    const pavel = await as('pavel', TODAY, oskar.data());
    expect((await pavel.call('link_request', { request_id: 'req_po164', goal_id: 'lead-merge' })).error).toBe(false);
    const linked = pavel.data().requests!;
    expect(linked.find((r) => r.id === 'req_po164')!.goalIds).toEqual(['ns-lead', 'lead-ci-time', 'lead-runners', 'lead-merge']);
    expect(linked.find((r) => r.id === 'req_eval_merge')!.status).toBe('withdrawn');
    const amara = await as('amara', TODAY, pavel.data());
    const yes = await amara.call('answer_request', { request_id: 'req_po164', answer: 'Approved for Q4, in two stages.' });
    expect(yes.error).toBe(false);
    const r = amara.data().requests!.find((x) => x.id === 'req_po164')!;
    expect([r.status, r.answer, r.answeredBy]).toEqual(['answered', 'Approved for Q4, in two stages.', 'amara']);
    expect(viaMcp(amara.data())).toBe(true);
    expect((await amara.call('list_requests', { status: 'answered', kind: 'decision', goal_id: 'ns-lead' })).data!.requests).toHaveLength(1);
    // One answer covers every goal it is about.
    expect(amara.data().changes.filter((c) => c.entity === 'request' && c.action === 'answered' && c.entityId === 'req_po164').map((c) => c.goalId).sort()).toEqual(['lead-ci-time', 'lead-merge', 'lead-runners', 'ns-lead']);
  });

  it(R('asks for an update: one ask until the owner answers it, withdrawn only by whoever asked'), async () => {
    const oskar = await as('oskar');
    expect((await oskar.call('ask_for_update', { goal_id: 'env-search' })).text).toMatch(/Asked Kojo/);
    expect((await oskar.call('ask_for_update', { goal_id: 'env-search' })).text).toMatch(/Already asked/);
    // It is an ask in the workspace (not a comment), with its own log entry.
    const ask = oskar.data().requests!.find((r) => r.kind === 'update' && r.goalIds.includes('env-search'))!;
    expect([ask.status, ask.askedBy, ask.recipientId]).toEqual(['open', 'oskar', 'kojo']);
    expect(oskar.data().changes.at(-1)).toMatchObject({ entity: 'request', action: 'asked', entityId: ask.id });
    expect(oskar.data().changes.some((c) => c.entity === 'note' && c.goalId === 'env-search' && /update/i.test(c.summary))).toBe(false);
    const tariq = await as('tariq', TODAY, oskar.data());
    expect((await tariq.call('undo_update_ask', { goal_id: 'env-search' })).text).toMatch(/Only whoever asked/);
    const kojo = await as('kojo', TODAY, oskar.data());
    expect((await kojo.call('get_my_work')).data!.asksForAnUpdate.map((x: { id: string }) => x.id)).toEqual([ask.id]);
    // The owner answers it: it closes, and asking again is a new ask.
    expect((await kojo.call('answer_request', { request_id: ask.id, answer: 'Back on it; numbers next week.' })).error).toBe(false);
    expect(kojo.data().requests!.find((r) => r.id === ask.id)!.status).toBe('answered');
    const again = await as('oskar', TODAY, kojo.data());
    expect((await again.call('ask_for_update', { goal_id: 'env-search' })).text).toMatch(/Asked Kojo/);
    // Whoever asked withdraws it, and the log says so.
    expect((await again.call('undo_update_ask', { goal_id: 'env-search' })).error).toBe(false);
    expect(again.data().requests!.filter((r) => r.kind === 'update' && r.goalIds.includes('env-search')).map((r) => r.status)).toEqual(['answered', 'withdrawn']);
    expect(again.data().changes.at(-1)!.summary).toBe('Withdrew the ask for an update');
    expect((await (await as('mateo')).call('ask_for_update', { goal_id: 'mttr-pir' })).text).toMatch(/your own goal/);
  });

  it(R('questions and actions are asks too: asked of the owner or agreed in a review, closed by answering or marking done, never by a comment'), async () => {
    const daniel = await as('daniel');
    const q = await daniel.call('ask_question', { goal_id: 'lead-mq', question: 'Which stage is the next to slip?' });
    expect(q.error).toBe(false);
    const ask = daniel.data().requests!.find((r) => r.kind === 'question' && r.ask === 'Which stage is the next to slip?')!;
    expect([ask.status, ask.recipientId, ask.goalIds]).toEqual(['open', 'diego', ['lead-mq']]);
    const diego = await as('diego', TODAY, daniel.data());
    expect((await diego.call('get_my_work')).data!.questionsOnYourGoals.map((x: { id: string }) => x.id)).toContain(ask.id);
    // Only an answer closes it, and only the person asked (or an admin) can give one.
    expect((await (await as('oskar', TODAY, daniel.data())).call('answer_request', { request_id: ask.id, answer: 'Web monorepo.' })).text).toMatch(/Only Diego Ramírez or an admin/);
    expect((await diego.call('answer_request', { request_id: ask.id, answer: 'The web monorepo.' })).error).toBe(false);
    expect(diego.data().requests!.find((r) => r.id === ask.id)!.status).toBe('answered');
    // An action agreed in a review stays open until it is marked done: by whoever does it, whoever asked, or an admin.
    await daniel.call('review_call', { review_id: 'devprod', goal_id: 'lead-mq', kind: 'action', text: 'Share the batching workaround with Web', who: 'Diego', due_week: 46 });
    const action = daniel.data().requests!.at(-1)!;
    expect([action.kind, action.status, action.recipientId, action.dueWeek, action.reviewId]).toEqual(['action', 'open', 'diego', 46, 'devprod']);
    expect((await (await as('oskar', TODAY, daniel.data())).call('mark_action_done', { request_id: action.id })).error).toBe(true);
    const done = await as('diego', TODAY, daniel.data());
    expect((await done.call('mark_action_done', { request_id: action.id, note: 'Sent.' })).error).toBe(false);
    const closed = done.data().requests!.find((r) => r.id === action.id)!;
    expect([closed.status, closed.answer, closed.answeredBy]).toEqual(['done', 'Sent.', 'diego']);
    expect(done.data().decisions.some((d) => d.kind === 'action' || d.kind === 'ask')).toBe(false); // none of this is a decision any more
  });

  it(R('reviews: set one up, walk its agenda, say things, correct them; only people in it change it'), async () => {
    const tariq = await as('tariq');
    const agenda = await tariq.call('get_review', { review_id: 'devprod' });
    expect(agenda.data!.toDiscuss.length + agenda.data!.healthy.length).toBe(agenda.data!.of);
    await tariq.call('review_call', { review_id: 'devprod', goal_id: 'lead-flaky', kind: 'acknowledge' });
    expect((await tariq.call('review_call', { review_id: 'devprod', goal_id: 'ns-lead', kind: 'ask' })).text).toMatch(/Write the question/);
    await tariq.call('review_call', { review_id: 'devprod', goal_id: 'ns-lead', kind: 'action', text: 'Draft the interim runner plan', who: 'Rhea', due_week: 46 });
    const action = tariq.data().requests!.at(-1)!; // an action agreed in review is an ask, not a decision
    expect([action.kind, action.recipientId, action.dueWeek, action.askedBy]).toEqual(['action', 'rhea', 46, 'tariq']);
    expect((await tariq.call('get_review', { review_id: 'devprod' })).data!.reviewed).toBe(agenda.data!.reviewed + 1);
    expect((await (await as('mateo', TODAY, tariq.data())).call('edit_call', { call_id: action.id, text: 'Something else' })).text).toMatch(/Only whoever asked, or an admin/);
    await tariq.call('edit_call', { call_id: action.id, text: 'Draft and share the interim runner plan' });
    expect(tariq.data().requests!.find((d) => d.id === action.id)!.ask).toBe('Draft and share the interim runner plan');

    const made = await tariq.call('save_review', { name: 'Reliability fortnightly', every_weeks: 2, weekday: 'Tuesday', trees: ['ns-cfr'], people: ['Mateo'] });
    const id = made.data!.id as string;
    expect(tariq.data().reviews.find((r) => r.id === id)!.people.sort()).toEqual(['mateo', 'tariq']);
    expect((await tariq.call('save_review', { name: 'Nothing in it' })).text).toMatch(/Pick the goals/);
    const outsider = await as('oskar', TODAY, tariq.data());
    expect((await outsider.call('save_review', { review_id: id, name: 'Mine now' })).text).toMatch(/Only someone in the review/);
    expect((await tariq.call('save_review', { review_id: id, every_weeks: 4 })).error).toBe(false);
  });

  it(R('watching: watch a goal, a tree or a level, list it, stop'), async () => {
    const oskar = await as('oskar');
    await oskar.call('watch', { kind: 'tree', ref: 'ns-cost' });
    expect((await oskar.call('watch', { kind: 'tree', ref: 'ns-cost' })).text).toMatch(/Already watching/);
    const list = await oskar.call('list_watching');
    expect(list.data!.goals.length).toBeGreaterThan(1);
    const mine = list.data!.watches.find((w: { ref: string }) => w.ref === 'ns-cost');
    expect((await (await as('mateo', TODAY, oskar.data())).call('unwatch', { watch_id: mine.id })).text).toMatch(/someone else’s/);
    await oskar.call('unwatch', { watch_id: mine.id });
    // Stopped, not erased (release 1b): the row stays, marked removed, so it can be undone.
    expect(oskar.data().watches.some((w) => w.id === mine.id && !w.removedAt)).toBe(false);
    expect(oskar.data().watches.find((w) => w.id === mine.id)?.removedBy).toBe('oskar');
    expect((await oskar.call('watch', { kind: 'level', ref: 'board' })).error).toBe(true);
  });

  it(R('people: admins add and change people; there is always an admin'), async () => {
    expect((await (await as('mateo')).call('save_person', { name: 'New Person' })).text).toMatch(/Only admins/);
    const grace = await as('grace');
    // Someone new needs an email: it tells people apart in the app, in spreadsheets and here.
    expect((await grace.call('save_person', { name: 'Ada Lovelace', job_title: 'Staff engineer', team: 'Site Reliability Engineering' })).text).toMatch(/Add their email/);
    const added = await grace.call('save_person', { name: 'Ada Lovelace', email: 'Ada.Lovelace@example.com', job_title: 'Staff engineer', team: 'Site Reliability Engineering' });
    const p = grace.data().people.find((x) => x.id === added.data!.id)!;
    expect([p.name, p.initials, p.teamId, p.admin, p.email]).toEqual(['Ada Lovelace', 'AL', 'sre', false, 'ada.lovelace@example.com']);
    // A shared name is allowed (the email is who someone is, backlog N); a second record with the same email isn't.
    expect((await grace.call('save_person', { name: 'Ada Lovelace', email: 'ada.lovelace@example.com' })).text).toMatch(/already has the email/);
    const twin = await grace.call('save_person', { name: 'Ada Lovelace', email: 'ada.lovelace2@example.com', team: 'Site Reliability Engineering' });
    expect(twin.text).not.toMatch(/no team|isn’t|can’t/);
    expect(twin.error).toBe(false);
    expect(grace.data().people.filter((x) => x.name === 'Ada Lovelace').length).toBe(2);
    await grace.call('save_person', { person_id: p.id, admin: true });
    expect(grace.data().people.find((x) => x.id === p.id)!.admin).toBe(true);
    expect((await grace.call('list_people')).data!.people.length).toBe(grace.data().people.length);
  });

  it(R('the end of the cycle: wrap-ups open in the last two weeks, by the day; owners wrap up; an admin starts the next cycle'), async () => {
    expect((await (await as('mateo')).call('wrap_up_goal', { goal_id: 'mttr-pir', result: 'hit', learned: 'Reviews caught most late actions.', next: 'carry' })).text).toMatch(/wrap-up opens on Mon 21 Dec 2026/);
    const mateo = await as('mateo', DEC);
    expect((await mateo.call('wrap_up_goal', { goal_id: 'ns-ai', result: 'hit', learned: 'Not mine to say anything about.', next: 'stop' })).text).toMatch(/Only the goal’s owner/);
    await mateo.call('wrap_up_goal', { goal_id: 'mttr-pir', result: 'hit', learned: 'Reviews caught most late actions.', next: 'carry' });
    expect((await mateo.call('get_wrap_up')).data!.goals.find((g: { id: string }) => g.id === 'mttr-pir').wrappedUp).toBe(true);
    expect((await mateo.call('start_next_cycle', { confirm: true })).text).toMatch(/Only admins/);
    const amara = await as('amara', DEC, mateo.data());
    // The dry run reads the start page back, and changes nothing.
    const dry = await amara.call('start_next_cycle', {});
    expect(dry.text).toMatch(/Ask the person first/);
    expect(dry.text).toMatch(/2027 runs from Mon 4 Jan 2027/);
    expect(amara.data().cycles).toHaveLength(seed(TODAY).cycles.length);
    const started = await amara.call('start_next_cycle', { confirm: true });
    expect(started.error).toBe(false);
    expect(amara.data().cycles).toHaveLength(seed(TODAY).cycles.length + 1);
    // Through the tools too, a wrap-up after the start keeps the copy true: stopped, it leaves 2027 (cycle-end rule 6).
    const made = amara.data().cycles.find((c) => c.name === '2027')!;
    const key = amara.data().goals.find((g) => g.id === 'mttr-pir')!.key;
    const copy = () => amara.data().goals.find((g) => g.cycleId === made.id && g.key === key && !g.removedAt);
    expect(copy()).toBeTruthy();
    await amara.call('wrap_up_goal', { goal_id: 'mttr-pir', result: 'partly', learned: 'Reviews caught most late actions.', next: 'stop' });
    expect(copy()).toBeUndefined();
    // Undo, while nobody has used it: admins only, and the year before is as it was.
    expect((await mateo.call('undo_start_cycle', { cycle_id: made.id })).text).toMatch(/Only admins|admin/);
    const undone = await amara.call('undo_start_cycle', { cycle_id: made.id });
    expect(undone.error).toBe(false);
    expect(undone.text).toMatch(/2027 was undone/);
    expect(amara.data().cycles.filter((c) => !c.removedAt)).toHaveLength(seed(TODAY).cycles.length);
  });

  it(R('views, tokens, feedback and the activity log, with the same rights as in the app'), async () => {
    const mateo = await as('mateo');
    const v = await mateo.call('save_view', { name: 'Off track', query: 'https://x/goals?status=off' });
    expect((await mateo.call('find_goals', { view: 'off track' })).error).toBe(false);
    expect((await mateo.call('pin_view', { view_id: v.data!.id, pinned: true })).text).toMatch(/Only admins/);
    const amara = await as('amara', TODAY, mateo.data());
    await amara.call('pin_view', { view_id: v.data!.id, pinned: true });
    expect((await amara.call('list_views')).data!.views.map((x: { name: string }) => x.name)).toContain('Off track');
    await mateo.call('delete_view', { view_id: v.data!.id }).catch(() => undefined);

    expect((await mateo.call('create_token', { person: 'Rhea', name: 'Her laptop' })).text).toMatch(/Only admins/);
    const made = await amara.call('create_token', { person: 'Rhea', name: 'Claude on Rhea’s laptop' });
    expect(made.data!.token).toMatch(/^gk_/);
    const tok = amara.data().tokens!.find((t) => t.name === 'Claude on Rhea’s laptop')!;
    expect(tok.tokenHash).toBe(await hashToken(made.data!.token));
    // Only his own: the 'Claude on my laptop' token in the story and this one; not Lucia's, nor the one just made for Rhea.
    expect((await mateo.call('list_tokens')).data!.tokens.map((t: { person: string }) => t.person)).toEqual(['Mateo Fernández', 'Mateo Fernández']);
    await amara.call('revoke_token', { token_id: tok.id });
    expect(amara.data().tokens!.find((t) => t.id === tok.id)!.revokedAt).not.toBeNull();

    await mateo.call('send_feedback', { mood: 'good', text: 'Posting from my assistant works.' });
    expect((await mateo.call('list_feedback')).error).toBe(true);
    const admin = await as('amara', TODAY, mateo.data());
    expect((await admin.call('list_feedback')).data!.feedback.at(0).text).toBe('Posting from my assistant works.');
    const log = await amara.call('get_activity', { query: 'kind=ai', limit: 5 });
    expect(log.data!.changes.length).toBeGreaterThan(0);
  });

  it(R('deleting the workspace: admins only, confirmed by its exact name'), async () => {
    expect((await (await as('mateo')).call('delete_workspace', { confirm_name: 'Acme' })).text).toMatch(/Only admins/);
    const amara = await as('amara');
    expect((await amara.call('delete_workspace', { confirm_name: 'acme' })).text).toMatch(/exactly/);
    expect(amara.deleted()).toBe(false);
    await amara.call('delete_workspace', { confirm_name: 'Acme' });
    expect(amara.deleted()).toBe(true);
  });
});

/* N30 (RS, docs/design/round-4/reviews-switch/spec.md 5 and 7): a switched-off module's tools all answer with one
   sentence, the same pattern for every module; edit_call on a note said in a review says Reviews' too. */
describe('a switched-off module’s tools say one sentence (N30)', () => {
  const off = (module: string, tool: string) => `${module} is switched off in Acme, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;
  for (const m of MODULES.filter((x) => x.aiTools.length)) {
    it(`[REVIEWS-OPTIONAL] N30: with ${m.name} off, each of its tools (${m.aiTools.join(', ')}) answers “${m.name} is switched off in Acme, so {tool} can’t be used there. …” and changes nothing`, async () => {
      const amara = await as('amara', TODAY, undefined, [m.id]);
      const before = amara.data().changes.length;
      for (const tool of m.aiTools) {
        const r = await amara.call(tool, {});
        expect(r.error, tool).toBe(true);
        expect(r.text, tool).toBe(off(m.name, tool));
      }
      expect(amara.data().changes.length).toBe(before);
    });
  }

  it('[REVIEWS-OPTIONAL] N30: with Reviews off, edit_call on a note said in a review answers with Reviews’ sentence', async () => {
    const amara = await as('amara', TODAY, undefined, ['reviews']);
    const note = amara.data().decisions.find((d) => d.kind === 'note' && d.reviewId)!;
    const r = await amara.call('edit_call', { call_id: note.id, text: 'Corrected' });
    expect([r.error, r.text]).toEqual([true, off('Reviews', 'edit_call')]);
  });
});
