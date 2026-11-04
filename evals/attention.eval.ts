/* Spec scenarios for Lane's notes (5 Nov), attention and Home: "needs attention" means new since someone looked, and Home
   opens with the week at a glance. The same rules reach the AI assistant through the MCP server. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit } from '../src/data/store';
import { seed } from '../src/data/seed';
import { attentionFor, attentionList, splitAttention } from '../src/domain/attention';
import { aiBrief } from '../src/domain/export';
import { dashboard, groupWatched, nextReview } from '../src/domain/home';
import { currentWeek } from '../src/domain/plan';
import { agendaOf, reviewSession, watchedGoals } from '../src/domain/review';
import type { ApiToken, CheckIn, Decision, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-10-30T12:00:00Z'); // Friday of week 44; the weekly review was yesterday
const s0 = seed(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
const handled = (s: Snapshot, id: string, at = today) => attentionFor(goal(s, id), s, cycle, at).handled;
const action = (goalId: string, extra: Partial<Decision> = {}): Decision => ({ id: 'dec_eval_' + goalId, goalId, checkInId: null, reviewId: 'weekly', week, kind: 'action', byId: 'elena', at: '2026-10-29T15:00:00.000Z', note: 'Chase the vendor for the SEC-88 date', assigneeId: 'aisha', dueWeek: 46, ...extra });
const recheck = (s: Snapshot, id: string, postedAt = '2026-10-30T09:00:00.000Z'): Snapshot => {
  const last = s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
  return { ...s, checkIns: [...s.checkIns, { ...last, id: 'ci_eval_' + id, week, postedAt } as CheckIn] };
};

describe('needs attention means new since someone looked', () => {
  it(R('ATTENTION-HANDLED', 'a red goal with an action agreed in review since its latest check-in is being handled, not needing attention'), () => {
    expect(handled(s0, 'access')).toBeNull();
    const s = { ...s0, decisions: [...s0.decisions, action('access')] };
    expect(attentionFor(goal(s, 'access'), s, cycle, today).status.status).toBe('off');
    expect(handled(s, 'access')!.text).toBe('Action: Aisha, due week 46');
    expect(splitAttention(attentionList(s, cycle, today)).needs.map((a) => a.goal.id)).not.toContain('access');
  });
  it(R('ATTENTION-HANDLED', 'a new check-in makes it need attention again'), () => {
    const s = recheck({ ...s0, decisions: [...s0.decisions, action('access')] }, 'access');
    expect(handled(s, 'access')).toBeNull();
  });
  it(R('ATTENTION-HANDLED', 'a new warning since the look makes it need attention again: the recovery date passes'), () => {
    const last = s0.checkIns.filter((c) => c.goalId === 'access').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
    const s: Snapshot = { ...s0, checkIns: s0.checkIns.map((c) => (c.id === last.id ? { ...c, pathToGreen: { ...c.pathToGreen!, byWeek: week } } : c)), decisions: [...s0.decisions, action('access', { kind: 'acknowledge', note: '' })] };
    expect(handled(s, 'access')!.text).toBe(`Reviewed in Platform weekly review, week ${week}`);
    expect(handled(s, 'access', new Date('2026-11-02T12:00:00Z'))).toBeNull();
  });
  it(R('ATTENTION-HANDLED', 'an answered request puts it in hand; an open question to the owner does not'), () => {
    const req = (s0.requests ?? []).find((r) => r.goalIds.includes('access'))!;
    const answered: Snapshot = { ...s0, requests: (s0.requests ?? []).map((r) => (r.id === req.id ? { ...r, status: 'answered', answer: 'Approved until week 49.', answeredBy: 'elena', answeredAt: '2026-10-29T16:00:00.000Z' } : r)) };
    expect(handled(answered, 'access')!.text).toBe(`Request answered by Elena, week ${week}`);
    expect(handled({ ...s0, decisions: [...s0.decisions, action('access', { kind: 'ask', note: 'When does the vendor ship?' })] }, 'access')).toBeNull();
  });
  it(R('ATTENTION-HANDLED', 'Watching, the review agenda and the AI brief all split them out the same way'), () => {
    const groups = groupWatched(watchedGoals('elena', s0).map((g) => attentionFor(g, s0, cycle, today)));
    expect(groups.handled.map((a) => a.goal.id)).toEqual(['head']);
    expect(groups.needs.map((a) => a.goal.id)).not.toContain('head');
    const ag = agendaOf(reviewSession(s0.reviews.find((r) => r.id === 'weekly')!, s0, cycle, today, week));
    expect(ag.handled.map((a) => a.goal.id)).toEqual(['head']);
    expect(ag.discuss.at(-1)!.goal.id).toBe('head');
    const md = aiBrief({ ws: { id: 'x', name: 'Platform' }, snapshot: s0, cycle, week, today });
    expect(md).toContain('## Being handled');
    expect(md.slice(md.indexOf('## At risk'), md.indexOf('## Being handled'))).not.toContain('### Intake-to-delivery time');
  });
});

describe('Home at a glance', () => {
  it(R('HOME-DASHBOARD', 'an owner sees their goals by status, their on-time streak, what they watch and their next review'), () => {
    const d = dashboard('maya', s0, cycle, week, today);
    expect(d.scope).toBe('mine');
    expect(d.counts).toEqual([{ status: 'risk', n: 2 }]);
    expect(d.streak).toBeGreaterThan(0);
    expect(d.watching!.handled.map((a) => a.goal.id)).toEqual(['head']);
    expect(d.next).toMatchObject({ id: 'weekly', weekday: 'Thursday', week: week + 1, days: 6 });
  });
  it(R('HOME-DASHBOARD', 'a leader with no goals of their own sees every goal by status and no streak; someone watching nothing has no watch summary'), () => {
    const d = dashboard('elena', s0, cycle, week, today);
    expect(d.scope).toBe('all');
    expect(d.counts.reduce((n, c) => n + c.n, 0)).toBe(s0.goals.length);
    expect(d.counts[0]!.status).toBe('off');
    expect(d.streak).toBeNull();
    expect(dashboard('kofi', s0, cycle, week, today).watching).toBeNull();
  });
  it(R('HOME-DASHBOARD', 'the next review is today on its day, and none when you are in no review'), () => {
    expect(nextReview('maya', s0, cycle, week, new Date('2026-10-29T08:00:00Z'))).toMatchObject({ id: 'weekly', days: 0 });
    expect(nextReview('tom', s0, cycle, week, today)).toBeNull();
  });
});

describe('the AI assistant sees the same split', () => {
  async function as(personId: string, start: Snapshot = s0) {
    let data: Snapshot = start;
    const token = newToken();
    const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'elena', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
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
    const w = await (await as('maya'))('get_my_work');
    expect(w.data!.needsAttention.map((g: { id: string }) => g.id)).toEqual(['triage']);
    expect(w.data!.beingHandled).toEqual([expect.objectContaining({ id: 'head', inHand: `Noted in Platform weekly review, week ${week - 1}` })]);
    expect(w.text).toMatch(/Being handled .*Intake-to-delivery time \(at risk\): Noted in Platform weekly review/);
  });
  it(R('ATTENTION-HANDLED', 'an action agreed through the assistant moves the red goal to being handled in the overview; a new check-in moves it back'), async () => {
    const elena = await as('elena');
    await elena('review_call', { review_id: 'weekly', goal_id: 'access', kind: 'action', text: 'Chase the vendor for the SEC-88 date', who: 'Aisha', due_week: 46 });
    let brief = (await elena('get_overview')).text;
    const inHand = brief.slice(brief.indexOf('## Being handled'), brief.indexOf('## No recent update'));
    expect(inHand).toContain('### Repo-access controls for the Brain');
    expect(inHand).toContain('**Being handled:** Action: Aisha, due week 46: Chase the vendor');
    const review = await elena('get_review', { review_id: 'weekly' });
    expect(review.data!.toDiscuss.find((g: { id: string }) => g.id === 'access').beingHandled).toBe('Action: Aisha, due week 46');
    // Aisha checks in again on the same data, with Elena's action in it: it's news, off track again.
    const aisha = await as('aisha', recheck({ ...s0, decisions: [...s0.decisions, action('access')] }, 'access'));
    brief = (await aisha('get_overview')).text;
    expect(brief.slice(brief.indexOf('## Off track'), brief.indexOf('## At risk'))).toContain('### Repo-access controls for the Brain');
    expect(brief.slice(brief.indexOf('## Being handled'), brief.indexOf('## No recent update'))).not.toContain('Repo-access');
  });
  it(R('HOME-DASHBOARD', 'get_my_work starts with the week at a glance'), async () => {
    const w = await (await as('kofi'))('get_my_work');
    expect(w.data!.atAGlance).toMatchObject({ goals: { whose: 'mine', total: 3 }, watching: null, nextReview: { name: 'Platform weekly review', day: 'Thursday' } });
    expect(w.data!.atAGlance.onTimeStreakWeeks).toEqual(expect.any(Number));
    expect(w.text).toMatch(/Your goals: 2 at risk, 1 on track\. On-time streak: \d+ weeks?\. Next review: Platform weekly review, Thursday/);
  });
});
