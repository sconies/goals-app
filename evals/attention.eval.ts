/* Spec scenarios for Lane's notes (5 Nov), attention and Home: "needs attention" means new since something was agreed
   (Lane, 10 Nov: an action with an owner and a date, or an answer; a review mark alone is a look, not a plan), and Home
   opens with the week at a glance. The same rules reach the AI assistant through the MCP server. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit } from '../src/data/store';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { attentionFor, attentionList, splitAttention } from '../src/domain/attention';
import { aiBrief } from '../src/domain/export';
import { dashboard, groupWatched, missedReviews, nextReview } from '../src/domain/home';
import { currentWeek } from '../src/domain/plan';
import { agendaOf, reviewSession, watchedGoals } from '../src/domain/review';
import type { Ask, ApiToken, CheckIn, Decision, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-11-05T12:00:00Z'); // Thursday of week 45; the leadership weekly is this afternoon
const s0 = seed(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
const handled = (s: Snapshot, id: string, at = today) => attentionFor(goal(s, id), s, cycle, at).handled;
// An action agreed in a review is an ask now (kind 'action'); a look is still a decision (acknowledge or note).
const action = (goalId: string, extra: Partial<Ask> = {}): Ask => ({ id: 'ask_eval_' + goalId, kind: 'action', goalIds: [goalId], askedBy: 'daniel', recipientId: 'diego', ask: 'Chase the vendor for the SEC-88 date', status: 'open', dueWeek: 46, reviewId: 'devprod', week, checkInId: null, createdAt: '2026-11-05T09:00:00.000Z', updatedAt: '2026-11-05T09:00:00.000Z', answer: null, answeredBy: null, answeredAt: null, ...extra });
const look = (goalId: string): Decision => ({ id: 'dec_eval_' + goalId, goalId, checkInId: null, reviewId: 'devprod', week, kind: 'acknowledge', byId: 'daniel', at: '2026-11-05T09:00:00.000Z', note: '' });
const recheck = (s: Snapshot, id: string, postedAt = '2026-11-05T10:00:00.000Z'): Snapshot => {
  const last = s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
  return { ...s, checkIns: [...s.checkIns, { ...last, id: 'ci_eval_' + id, week, postedAt } as CheckIn] };
};

describe('needs attention means new since someone looked', () => {
  it(R('ATTENTION-HANDLED', 'a red goal with an action agreed in review since its latest check-in is being handled, not needing attention'), () => {
    expect(handled(s0, 'lead-mq')).toBeNull();
    const s = { ...s0, requests: [...(s0.requests ?? []), action('lead-mq')] };
    expect(attentionFor(goal(s, 'lead-mq'), s, cycle, today).status.status).toBe('off');
    expect(handled(s, 'lead-mq')!.text).toBe('Action: Diego, due week 46');
    expect(splitAttention(attentionList(s, cycle, today)).needs.map((a) => a.goal.id)).not.toContain('lead-mq');
  });
  it(R('ATTENTION-HANDLED', 'a new check-in makes it need attention again'), () => {
    const s = recheck({ ...s0, requests: [...(s0.requests ?? []), action('lead-mq')] }, 'lead-mq');
    expect(handled(s, 'lead-mq')).toBeNull();
  });
  it(R('ATTENTION-HANDLED', 'a review mark alone is a look, not a plan: the red goal still needs attention, and says who looked'), () => {
    const s: Snapshot = { ...s0, decisions: [...s0.decisions, look('lead-mq')] };
    const a = attentionFor(goal(s, 'lead-mq'), s, cycle, today);
    expect(a.handled).toBeNull();
    expect(a.lookedAt!.text).toBe(`Looked at by Daniel in Developer Productivity fortnightly, week ${week}`);
    expect(splitAttention(attentionList(s, cycle, today)).needs.map((x) => x.goal.id)).toContain('lead-mq');
  });
  it(R('ATTENTION-HANDLED', 'a new warning since the action makes it need attention again: the recovery date passes'), () => {
    const last = s0.checkIns.filter((c) => c.goalId === 'lead-mq').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
    const s: Snapshot = { ...s0, checkIns: s0.checkIns.map((c) => (c.id === last.id ? { ...c, pathToGreen: { ...c.pathToGreen!, byWeek: week } } : c)), requests: [...(s0.requests ?? []), action('lead-mq', { dueWeek: 47 })] };
    expect(handled(s, 'lead-mq')!.text).toBe('Action: Diego, due week 47');
    expect(handled(s, 'lead-mq', new Date('2026-11-12T12:00:00Z'))).toBeNull();
  });
  it(R('ATTENTION-HANDLED', 'an answered request doesn’t put an off-track goal in hand (it needs an action); an open question to the owner doesn’t either'), () => {
    // One ask: a decision or help is answered by whoever was asked (Daniel); a question to the owner is an ask too, and being open it puts nothing in hand.
    const req = (s0.requests ?? []).find((r) => r.kind === 'decision' && r.status === 'open' && r.goalIds.includes('lead-mq'))!;
    const answered: Snapshot = { ...s0, requests: (s0.requests ?? []).map((r) => (r.id === req.id ? { ...r, status: 'answered', answer: 'Approved for a month.', answeredBy: 'daniel', answeredAt: '2026-11-05T09:00:00.000Z' } : r)) };
    expect(attentionFor(goal(answered, 'lead-mq'), answered, cycle, today).status.status).toBe('off');
    expect(handled(answered, 'lead-mq')).toBeNull();
    const asked: Snapshot = { ...s0, requests: [...(s0.requests ?? []), action('lead-mq', { id: 'ask_eval_q', kind: 'question', askedBy: 'daniel', recipientId: 'diego', ask: 'When does the vendor ship?', dueWeek: null })] };
    expect(handled(asked, 'lead-mq')).toBeNull();
    // …and answering that question (a comment on the goal, not the owner's check-in) puts nothing in hand either.
    const answeredQuestion: Snapshot = { ...asked, requests: asked.requests!.map((r) => (r.id === 'ask_eval_q' ? { ...r, status: 'answered', answer: 'Week 49.', answeredBy: 'diego', answeredAt: '2026-11-05T10:00:00.000Z' } : r)) };
    expect(handled(answeredQuestion, 'lead-mq')).toBeNull();
  });
  it(R('ATTENTION-HANDLED', 'Watching, the review agenda and the AI brief all split them out the same way'), () => {
    const groups = groupWatched(watchedGoals('amara', s0).map((g) => attentionFor(g, s0, cycle, today)));
    expect(groups.handled.map((a) => a.goal.id)).toEqual(['ns-vuln']);
    expect(groups.needs.map((a) => a.goal.id)).not.toContain('ns-vuln');
    const ag = agendaOf(reviewSession(s0.reviews.find((r) => r.id === 'security')!, s0, cycle, today, week));
    expect(ag.handled.map((a) => a.goal.id)).toEqual(['ns-vuln']);
    expect(ag.discuss.at(-1)!.goal.id).toBe('ns-vuln');
    const md = aiBrief({ ws: { id: 'x', name: 'Platform' }, snapshot: s0, cycle, week, today });
    expect(md).toContain('## Being handled');
    expect(md.slice(md.indexOf('## At risk'), md.indexOf('## Being handled'))).not.toContain('### Critical and high vulnerabilities fixed within SLA');
  });
});

describe('one counting rule for attention (re-review, 8 Nov, backlog T)', () => {
  for (const at of [today, new Date('2026-11-08T18:20:00Z')]) {
    const s = seed(at);
    const all = attentionList(s, cycle, at);
    const { needs, handled: inHand } = splitAttention(all);
    it(R('ATTENTION-HANDLED', `on ${at.toISOString().slice(0, 10)}, every flagged goal either needs attention or is being handled, so the tab and the board add up`), () => {
      expect(needs.length + inHand.length).toBe(all.length);
      expect(needs.some((a) => inHand.includes(a))).toBe(false);
    });
    it(R('ATTENTION-HANDLED', `on ${at.toISOString().slice(0, 10)}, a done goal never needs attention and is never on a review's list to discuss`), () => {
      const done = s.goals.filter((g) => attentionFor(g, s, cycle, at).status.status === 'done');
      expect(done.length).toBeGreaterThan(0);
      expect(needs.filter((a) => a.status.status === 'done').map((a) => a.goal.id)).toEqual([]);
      for (const r of s.reviews) {
        const { discuss } = agendaOf(reviewSession(r, s, cycle, at, currentWeek(cycle, at)));
        expect(discuss.filter((a) => a.status.status === 'done').map((a) => a.goal.id)).toEqual([]);
      }
    });
  }
});

describe('Home at a glance', () => {
  it(R('HOME-DASHBOARD', 'a session past its date and not held shows before the next review, with how long past (re-review, 8 Nov, backlog T)'), () => {
    const sunday = new Date('2026-11-08T18:20:00Z');
    const s = seed(sunday);
    const d = dashboard('amara', s, cycle, currentWeek(cycle, sunday), sunday);
    expect(d.missed[0]).toMatchObject({ id: 'weekly', name: 'Platform leadership weekly', date: '2026-11-05', daysPast: 3 });
    // On its own day it isn't missed yet.
    expect(missedReviews('amara', s, cycle, currentWeek(cycle, today), today).map((m) => m.id)).not.toContain('weekly');
  });
  it(R('HOME-DASHBOARD', 'an owner sees their goals by status, their on-time streak, what they watch and their next review'), () => {
    const d = dashboard('pavel', s0, cycle, week, today);
    expect(d.scope).toBe('mine');
    expect(d.counts).toEqual([{ status: 'off', n: 1 }, { status: 'on', n: 3 }]); // Pavel owns four goals
    expect(d.streak).toBeGreaterThan(0);
    // Both were only marked reviewed since their check-ins, so they still need attention (Lane, 10 Nov).
    expect(d.watching!.handled.map((a) => a.goal.id)).toEqual([]);
    expect(d.watching!.needs.map((a) => a.goal.id)).toEqual(expect.arrayContaining(['cfr-contract', 'cfr-halt']));
    expect(d.next).toMatchObject({ id: 'devprod', weekday: 'Tuesday', week: week + 1, days: 5 });
  });
  it(R('HOME-DASHBOARD', 'a leader with no goals of their own sees every goal by status and no streak; someone watching nothing has no watch summary'), () => {
    const d = dashboard('amara', s0, cycle, week, today);
    expect(d.scope).toBe('all');
    expect(d.counts.reduce((n, c) => n + c.n, 0)).toBe(s0.goals.length);
    expect(d.counts[0]!.status).toBe('off');
    expect(d.streak).toBeNull();
    expect(dashboard('hannah', s0, cycle, week, today).watching).toBeNull();
  });
  it(R('HOME-DASHBOARD', 'the next review is today on its day, and none when you are in no review'), () => {
    expect(nextReview('daniel', s0, cycle, week, new Date('2026-11-05T08:00:00Z'))).toMatchObject({ id: 'weekly', days: 0 });
    expect(nextReview('oskar', s0, cycle, week, today)).toBeNull();
  });
});

describe('the AI assistant sees the same split', () => {
  async function as(personId: string, start: Snapshot = s0) {
    let data: Snapshot = start;
    const token = newToken();
    const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
    data = { ...data, tokens: [...(data.tokens ?? []), t] };
    const deps: Deps = {
      findToken: async (h) => { const x = (data.tokens ?? []).find((k) => k.tokenHash === h && !k.revokedAt); return x ? { token: x, workspaceId: 'acme' } : null; },
      workspaceName: async () => 'Acme', load: async () => data, commit: async (_ws, c) => { data = applyCommit(data, c); }, touch: async () => undefined, deleteWorkspace: async () => undefined, now: () => today,
    };
    let n = 0;
    return async (name: string, args: object = {}) => {
      const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps);
      const body = await res.json() as { result: { content: { text: string }[]; structuredContent?: Record<string, any> } };
      return { text: body.result.content[0]!.text, data: body.result.structuredContent };
    };
  }
  it(R('ATTENTION-HANDLED', 'get_my_work lists the owner’s handled goal apart, with what’s in hand'), async () => {
    // Jenkins was only marked reviewed: it needs attention (Lane, 10 Nov). cfr-tests heads for 88–90% against 90%, which
    // isn't heading short (deep review T5). With an action agreed, Jenkins is in hand.
    let w = await (await as('chen'))('get_my_work');
    expect(w.data!.needsAttention.map((g: { id: string }) => g.id)).toEqual(['dep-jenkins']);
    expect(w.data!.beingHandled).toEqual([]);
    w = await (await as('chen', { ...s0, requests: [...(s0.requests ?? []), action('dep-jenkins', { recipientId: 'chen', dueWeek: 47 })] }))('get_my_work');
    expect(w.data!.beingHandled).toEqual([expect.objectContaining({ id: 'dep-jenkins', inHand: 'Action: Chen, due week 47' })]);
    expect(w.text).toMatch(/Being handled .*Jenkins jobs still running \(At risk \(risk\)\): Action: Chen, due week 47/);
  });
  it(R('ATTENTION-HANDLED', 'an action agreed through the assistant moves the red goal to being handled in the overview; a new check-in moves it back'), async () => {
    const daniel = await as('daniel'); // Daniel runs the Developer Productivity fortnightly, which has the merge queue on its map
    await daniel('review_call', { review_id: 'devprod', goal_id: 'lead-mq', kind: 'action', text: 'Chase the vendor for the SEC-88 date', who: 'Diego', due_week: 46 });
    let brief = (await daniel('get_overview')).text;
    const inHand = brief.slice(brief.indexOf('## Being handled'), brief.indexOf('## No recent update'));
    expect(inHand).toContain('### Merge queue live for every monorepo');
    expect(inHand).toContain('**Being handled:** Action: Diego, due week 46: Chase the vendor');
    const review = await daniel('get_review', { review_id: 'devprod' });
    expect(review.data!.toDiscuss.find((g: { id: string }) => g.id === 'lead-mq').beingHandled).toBe('Action: Diego, due week 46');
    // Diego checks in again on the same data, with Amara's action in it: it's news, off track again.
    const diego = await as('diego', recheck({ ...s0, requests: [...(s0.requests ?? []), action('lead-mq')] }, 'lead-mq'));
    brief = (await diego('get_overview')).text;
    expect(brief.slice(brief.indexOf('## Off track'), brief.indexOf('## At risk'))).toContain('### Merge queue live for every monorepo');
    expect(brief.slice(brief.indexOf('## Being handled'), brief.indexOf('## No recent update'))).not.toContain('Merge queue live');
  });
  it(R('HOME-DASHBOARD', 'get_my_work starts with the week at a glance'), async () => {
    const w = await (await as('diego'))('get_my_work');
    expect(w.data!.atAGlance).toMatchObject({ goals: { whose: 'mine', total: 2 }, watching: null, nextReview: { name: 'Developer Productivity fortnightly', day: 'Tuesday' } });
    expect(w.data!.atAGlance.onTimeStreakWeeks).toEqual(expect.any(Number));
    expect(w.text).toMatch(/Your goals: 1 off track, 1 done\. On-time streak: \d+ weeks?\. Next review: Developer Productivity fortnightly, Tuesday/);
  });
});
