// @vitest-environment node
/* Being handled (Lane, 10 Nov): a goal that is off track or at risk is "being handled", not "needs attention", only
   when, since its latest check-in, an action was agreed with an owner and a due week, or (at risk only) its request
   was answered, and nothing new has happened since. Marking it reviewed or noting it is "looked at": a quiet line, and
   it still needs attention. In the Platform Engineering example on Thursday 5 November (week 45). */
import { buildPlatformOrg } from '../data/platformOrg';
import { answerAsk, openFor } from './asks';
import { attentionFor, attentionList, handledFor, lookedAtFor, needsAttention, splitAttention } from './attention';
import { aiBrief } from './export';
import { currentWeek } from './plan';
import { agendaOf, reviewSession } from './review';
import type { Ask, CheckIn, Decision, Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z'); // Thursday of week 45
const s0 = buildPlatformOrg(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
const latest = (s: Snapshot, id: string) => s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
let n = 0;
// Container rebuilds (vuln-containers, Yasmin's) is off track and nobody has looked since its check-in on Wednesday.
const RED = 'vuln-containers';
const AFTER = '2026-11-05T09:00:00.000Z';
const said = (goalId: string, kind: 'note' | 'acknowledge', extra: Partial<Decision> = {}): Decision => ({
  id: `dec_t${++n}`, goalId, checkInId: null, reviewId: 'weekly', week, kind, byId: 'amara', at: AFTER, note: kind === 'acknowledge' ? '' : 'Pair with CI/CD on the rebuild trigger', ...extra,
});
const action = (goalId: string, extra: Partial<Ask> = {}): Ask => ({
  id: `ask_t${++n}`, kind: 'action', goalIds: [goalId], askedBy: 'amara', recipientId: goal(s0, goalId).ownerId, ask: 'Agree the rebuild trigger with CI/CD', status: 'open', dueWeek: null,
  reviewId: 'weekly', week, checkInId: null, createdAt: AFTER, updatedAt: AFTER, answer: null, answeredBy: null, answeredAt: null, ...extra,
});
const withSaid = (s: Snapshot, ...d: (Decision | Ask)[]): Snapshot => ({
  ...s, decisions: [...s.decisions, ...d.filter((x): x is Decision => !('goalIds' in x))], requests: [...(s.requests ?? []), ...d.filter((x): x is Ask => 'goalIds' in x)],
});
const checkIn = (s: Snapshot, id: string, postedAt: string, extra: Partial<CheckIn> = {}): Snapshot => {
  const c = latest(s, id);
  return { ...s, checkIns: [...s.checkIns, { ...c, id: `ci_t${++n}`, week, postedAt, ...extra }] };
};
const handled = (s: Snapshot, id: string, at = today) => attentionFor(goal(s, id), s, cycle, at).handled;
const looked = (s: Snapshot, id: string, at = today) => attentionFor(goal(s, id), s, cycle, at).lookedAt;

describe('being handled', () => {
  it('starts with the halt looked at (reviewed in Reliability weekly after its check-in) but still needing attention, and lead time needing attention', () => {
    expect(handled(s0, 'cfr-halt')).toBeNull();
    expect(looked(s0, 'cfr-halt')).toMatchObject({ kind: 'reviewed', text: expect.stringMatching(new RegExp(`^Looked at by \\w+ in Reliability weekly, week ${week}$`)) });
    expect(needsAttention(attentionFor(goal(s0, 'cfr-halt'), s0, cycle, today))).toBe(true);
    expect(handled(s0, 'ns-lead')).toBeNull();
    expect(needsAttention(attentionFor(goal(s0, 'ns-lead'), s0, cycle, today))).toBe(true);
    expect(handled(s0, RED)).toBeNull();
  });

  it('an action agreed on a red goal puts it in hand, saying who and by when', () => {
    const s = withSaid(s0, action(RED, { recipientId: 'rhea', dueWeek: 47 }));
    expect(handled(s, RED)).toMatchObject({ kind: 'action', text: 'Action: Rhea, due week 47' });
    expect(needsAttention(attentionFor(goal(s, RED), s, cycle, today))).toBe(false);
  });

  it('an action is the owner’s unless someone else was named; one with no due week doesn’t put it in hand', () => {
    expect(handled(withSaid(s0, action(RED, { recipientId: null, dueWeek: 47 })), RED)!.text).toBe('Action: Yasmin, due week 47');
    expect(handled(withSaid(s0, action(RED)), RED)).toBeNull();
  });

  it('a new check-in makes it news again, even with the same call', () => {
    const s = checkIn(withSaid(s0, action(RED, { dueWeek: 47 })), RED, '2026-11-05T10:00:00.000Z');
    expect(attentionFor(goal(s, RED), s, cycle, today).status.status).toBe('off');
    expect(handled(s, RED)).toBeNull();
    // And the halt's review no longer covers it once Olivia checks in again.
    expect(handled(checkIn(s0, 'cfr-halt', '2026-11-05T10:00:00.000Z'), 'cfr-halt')).toBeNull();
  });

  it('a look from before the latest check-in does not count', () => {
    expect(handled(withSaid(s0, said(RED, 'acknowledge', { at: '2026-10-29T15:00:00.000Z' })), RED)).toBeNull();
  });

  it('marked reviewed in a review is a look, not a plan: it still needs attention, and says who looked, where and when', () => {
    const s = withSaid(s0, said(RED, 'acknowledge'));
    expect(handled(s, RED)).toBeNull();
    expect(needsAttention(attentionFor(goal(s, RED), s, cycle, today))).toBe(true);
    expect(looked(s, RED)).toMatchObject({ kind: 'reviewed', text: `Looked at by Amara in Platform leadership weekly, week ${week}`, said: '' });
    expect(lookedAtFor(goal(s, RED), s, cycle, today)).toEqual(looked(s, RED));
  });

  it('a note outside a review names who looked, and doesn’t put it in hand either', () => {
    const s = withSaid(s0, said(RED, 'note', { reviewId: null }));
    expect(handled(s, RED)).toBeNull();
    expect(looked(s, RED)!.text).toBe(`Looked at by Amara, week ${week}`);
  });

  it('the owner looking at their own goal is not someone else having looked; an action they agreed is', () => {
    expect(handled(withSaid(s0, said(RED, 'acknowledge', { byId: 'yasmin' })), RED)).toBeNull();
    expect(handled(withSaid(s0, said(RED, 'note', { byId: 'yasmin' })), RED)).toBeNull();
    expect(handled(withSaid(s0, action(RED, { askedBy: 'yasmin', dueWeek: 46 })), RED)!.kind).toBe('action');
  });

  it('a question for the owner is not in hand: it waits on them', () => {
    expect(handled(withSaid(s0, action(RED, { kind: 'question', ask: 'When does the trigger ship?' })), RED)).toBeNull();
  });

  it('an action marked done or withdrawn is no longer in hand', () => {
    expect(handled(withSaid(s0, action(RED, { status: 'done' })), RED)).toBeNull();
    expect(handled(withSaid(s0, action(RED, { status: 'withdrawn' })), RED)).toBeNull();
  });

  it('an answered request puts an at-risk goal in hand; an off-track goal stays counted until it has an action', () => {
    const answered = (id: string) => {
      const r = openFor(id, s0)[0]!;
      const { request } = answerAsk(r, 'Approved: the runner budget for Q4.', 'amara', '2026-11-05T10:00:00.000Z', (p) => `${p}_t${++n}`);
      return { ...s0, requests: (s0.requests ?? []).map((x) => (x.id === r.id ? request : x)) } as Snapshot;
    };
    expect(attentionFor(goal(s0, 'ns-lead'), s0, cycle, today).status.status).toBe('off');
    expect(handled(answered('ns-lead'), 'ns-lead')).toBeNull();
    const risky = s0.goals.find((g) => openFor(g.id, s0).length && attentionFor(g, s0, cycle, today).status.status === 'risk' && !handled(s0, g.id))!;
    expect(handled(answered(risky.id), risky.id)).toMatchObject({ kind: 'answered', text: `Request answered by Amara, week ${week}`, said: 'Approved: the runner budget for Q4.' });
  });

  it('a new flag since the look makes it news again: the recovery date passes', () => {
    // The latest check-in says it's back on plan by week 45; Amara reviews it this morning.
    const s1: Snapshot = { ...s0, checkIns: s0.checkIns.map((c) => (c.id === latest(s0, RED).id ? { ...c, pathToGreen: { ...c.pathToGreen!, byWeek: 45 } } : c)) };
    const s = withSaid(s1, action(RED, { dueWeek: 47 }));
    expect(handled(s, RED)).not.toBeNull();
    // Monday of week 46: still not stale, but the date it was due back on plan has passed.
    const monday = new Date('2026-11-09T12:00:00Z');
    expect(attentionFor(goal(s, RED), s, cycle, monday).flags.map((f) => f.kind)).toContain('missed-path');
    expect(handled(s, RED, monday)).toBeNull();
  });

  it('a check-in coming due does not count as new: the owner has a week to post it', () => {
    const monday = new Date('2026-11-09T12:00:00Z');
    const s = withSaid(s0, action(RED, { dueWeek: 47 }));
    expect(attentionFor(goal(s, RED), s, cycle, monday).flags.map((f) => f.kind)).toContain('due');
    expect(handled(s, RED, monday)).not.toBeNull();
  });

  it('says when a check-in is due by its day, never by a review (FT2): a review is not what makes it due', () => {
    const monday = new Date('2026-11-09T12:00:00Z');
    const due = attentionFor(goal(s0, RED), s0, cycle, monday).flags.find((f) => f.kind === 'due');
    expect(due?.detail).toMatch(/^Due by (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}\.$/);
    expect(due?.detail).not.toMatch(/review/);
  });

  it('an action past its week is news, not in hand', () => {
    expect(handled(withSaid(s0, action(RED, { dueWeek: week - 1 })), RED)).toBeNull();
    expect(handled(withSaid(s0, action(RED, { dueWeek: week })), RED)).not.toBeNull();
  });

  it('a goal going quiet is never being handled', () => {
    expect(handled(withSaid(s0, action('env-search', { dueWeek: 47 })), 'env-search')).toBeNull();
  });

  it('only behind goals are handled: an on-track goal with a note is just on track', () => {
    expect(handled(withSaid(s0, said('ns-ai', 'note')), 'ns-ai')).toBeNull();
  });

  it('a look dated after today does not count yet', () => {
    expect(handled(withSaid(s0, said(RED, 'acknowledge', { at: '2026-11-07T15:00:00.000Z' })), RED)).toBeNull();
  });

  it('an agreed action is shown before a note or a plain “reviewed”', () => {
    const s = withSaid(s0, said(RED, 'acknowledge', { at: '2026-11-05T11:00:00.000Z' }), action(RED, { recipientId: 'amara', dueWeek: 46 }), said(RED, 'note'));
    expect(handled(s, RED)!.text).toBe('Action: Amara, due week 46');
  });

  it('handledFor is the same rule on its own', () => {
    const s = withSaid(s0, action(RED, { dueWeek: 47 }));
    expect(handledFor(goal(s, RED), s, cycle, today)).toEqual(handled(s, RED));
  });
});

describe('lists that show attention', () => {
  it('put what needs attention first and what is being handled after, and split them', () => {
    const list = attentionList(s0, cycle, today);
    const firstHandled = list.findIndex((a) => a.handled);
    expect(firstHandled).toBeGreaterThan(0);
    expect(list.slice(firstHandled).every((a) => a.handled)).toBe(true);
    const { needs, handled: inHand } = splitAttention(list);
    expect(inHand.map((a) => a.goal.id).sort()).toEqual(['ns-vuln']);
    expect(needs.map((a) => a.goal.id)).toContain('ns-lead');
    expect(needs.every(needsAttention)).toBe(true);
  });

  it('the review agenda carries it: new information first, then what is being handled, then the healthy goals', () => {
    const s = withSaid(s0, action('ns-env', { dueWeek: 47 }));
    const x = reviewSession(s.reviews.find((r) => r.id === 'weekly')!, s, cycle, today, week);
    const ids = x.items.map((a) => a.goal.id);
    const tier = (id: string) => { const a = x.items.find((i) => i.goal.id === id)!; return a.handled ? 1 : (a.status.status === 'on' || a.status.status === 'done') && a.flags.every((f) => f.kind === 'due') ? 2 : 0; };
    expect(ids.map(tier)).toEqual([...ids.map(tier)].sort((a, b) => a - b));
    const ag = agendaOf(x);
    expect(ag.handled.map((a) => a.goal.id)).toContain('ns-env');
    // Being handled is a part of discuss, at its end, so the agenda's screen still walks them.
    expect(ag.handled.every((a) => ag.discuss.includes(a))).toBe(true);
    expect(ag.discuss.slice(-ag.handled.length).every((a) => !!a.handled)).toBe(true);
  });

  it('the AI brief lists them apart, with what is in hand, and not under at risk', () => {
    const md = aiBrief({ ws: { id: 'x', name: 'Platform Engineering' }, snapshot: s0, cycle, week, today });
    const risk = md.slice(md.indexOf('## At risk'), md.indexOf('## Being handled'));
    expect(md).toContain('## Being handled');
    expect(risk).not.toContain('### Critical and high vulnerabilities fixed within SLA');
    const inHand = md.slice(md.indexOf('## Being handled'), md.indexOf('## No recent update'));
    expect(inHand).toContain('### Critical and high vulnerabilities fixed within SLA');
    expect(inHand).toContain('**Being handled:** Action: Farah, due week 48');
    expect(md).toMatch(/1 behind and being handled/);
  });
});
