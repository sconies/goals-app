// @vitest-environment node
/* Being handled (Lane's notes, 5 Nov): a goal that is off track or at risk but that someone has looked at since its
   latest check-in, with nothing new since, is "being handled", not "needs attention". */
import { seed } from '../data/seed';
import { attentionFor, attentionList, handledFor, needsAttention, splitAttention } from './attention';
import { aiBrief } from './export';
import { currentWeek } from './plan';
import { answerRequest, openFor } from './requests';
import { agendaOf, reviewSession } from './review';
import type { CheckIn, Decision, Snapshot } from './types';

const today = new Date('2026-10-30T12:00:00Z'); // Friday of week 44
const s0 = seed(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
const latest = (s: Snapshot, id: string) => s.checkIns.filter((c) => c.goalId === id).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
const goal = (s: Snapshot, id: string) => s.goals.find((g) => g.id === id)!;
let n = 0;
const said = (goalId: string, kind: Decision['kind'], extra: Partial<Decision> = {}): Decision => ({
  id: `dec_t${++n}`, goalId, checkInId: null, reviewId: 'weekly', week, kind, byId: 'elena', at: '2026-10-29T15:00:00.000Z', note: kind === 'acknowledge' ? '' : 'Pair with Leo on the interim scope', ...extra,
});
const withSaid = (s: Snapshot, ...d: Decision[]): Snapshot => ({ ...s, decisions: [...s.decisions, ...d] });
const checkIn = (s: Snapshot, id: string, postedAt: string, extra: Partial<CheckIn> = {}): Snapshot => {
  const c = latest(s, id);
  return { ...s, checkIns: [...s.checkIns, { ...c, id: `ci_t${++n}`, week, postedAt, ...extra }] };
};
const handled = (s: Snapshot, id: string, at = today) => attentionFor(goal(s, id), s, cycle, at).handled;

describe('being handled', () => {
  it('starts with the north star being handled: Elena noted it in last week’s review, after its latest check-in', () => {
    const h = handled(s0, 'head');
    expect(h).toMatchObject({ kind: 'noted', text: `Noted in Platform weekly review, week ${week - 1}` });
    expect(h!.said).toMatch(/two blockers/);
    // Repo-access controls is off track and nobody has looked since its check-in: it needs attention.
    expect(handled(s0, 'access')).toBeNull();
    expect(needsAttention(attentionFor(goal(s0, 'access'), s0, cycle, today))).toBe(true);
  });

  it('an action agreed on a red goal puts it in hand, saying who and by when', () => {
    const s = withSaid(s0, said('access', 'action', { assigneeId: 'aisha', dueWeek: 47 }));
    expect(handled(s, 'access')).toMatchObject({ kind: 'action', text: 'Action: Aisha, due week 47' });
    expect(needsAttention(attentionFor(goal(s, 'access'), s, cycle, today))).toBe(false);
  });

  it('an action with no assignee is the owner’s, and one with no week says no week', () => {
    expect(handled(withSaid(s0, said('access', 'action')), 'access')!.text).toBe('Action: Aisha');
  });

  it('a new check-in makes it news again, even with the same call', () => {
    const s = checkIn(withSaid(s0, said('access', 'action', { dueWeek: 47 })), 'access', '2026-10-30T09:00:00.000Z');
    expect(attentionFor(goal(s, 'access'), s, cycle, today).status.status).toBe('off');
    expect(handled(s, 'access')).toBeNull();
    // And the north star's note no longer covers it once Maya checks in again.
    expect(handled(checkIn(s0, 'head', '2026-10-30T09:00:00.000Z'), 'head')).toBeNull();
  });

  it('a look from before the latest check-in does not count', () => {
    expect(handled(withSaid(s0, said('access', 'acknowledge', { at: '2026-10-20T15:00:00.000Z' })), 'access')).toBeNull();
  });

  it('marked reviewed in a review counts, and says where and when', () => {
    expect(handled(withSaid(s0, said('access', 'acknowledge')), 'access')).toMatchObject({ kind: 'reviewed', text: `Reviewed in Platform weekly review, week ${week}`, said: '' });
  });

  it('a note outside a review names who looked', () => {
    expect(handled(withSaid(s0, said('access', 'note', { reviewId: null })), 'access')!.text).toBe(`Noted by Elena, week ${week}`);
  });

  it('the owner looking at their own goal is not someone else having looked; their agreed action is', () => {
    expect(handled(withSaid(s0, said('access', 'acknowledge', { byId: 'aisha' })), 'access')).toBeNull();
    expect(handled(withSaid(s0, said('access', 'note', { byId: 'aisha' })), 'access')).toBeNull();
    expect(handled(withSaid(s0, said('access', 'action', { byId: 'aisha', dueWeek: 46 })), 'access')!.kind).toBe('action');
  });

  it('a question for the owner is not in hand: it waits on them', () => {
    expect(handled(withSaid(s0, said('access', 'ask', { note: 'When does the vendor ship?' })), 'access')).toBeNull();
  });

  it('an answered request puts it in hand', () => {
    const r = openFor('access', s0)[0]!;
    const { request } = answerRequest(r, 'Approved: read-only for the Brain until week 49.', 'elena', '2026-10-29T16:00:00.000Z', (p) => `${p}_t${++n}`);
    const s: Snapshot = { ...s0, requests: (s0.requests ?? []).map((x) => (x.id === r.id ? request : x)) };
    expect(handled(s, 'access')).toMatchObject({ kind: 'answered', text: `Request answered by Elena, week ${week}`, said: 'Approved: read-only for the Brain until week 49.' });
  });

  it('a new flag since the look makes it news again: the recovery date passes', () => {
    // Access’s latest check-in says it is back on plan by week 44; Elena reviews it in week 44.
    const s1: Snapshot = { ...s0, checkIns: s0.checkIns.map((c) => (c.id === latest(s0, 'access').id ? { ...c, pathToGreen: { ...c.pathToGreen!, byWeek: 44 } } : c)) };
    const s = withSaid(s1, said('access', 'acknowledge'));
    expect(handled(s, 'access')).not.toBeNull();
    // Monday of week 45: still not stale, but the date it was due back on plan has passed.
    const monday = new Date('2026-11-02T12:00:00Z');
    expect(attentionFor(goal(s, 'access'), s, cycle, monday).flags.map((f) => f.kind)).toContain('missed-path');
    expect(handled(s, 'access', monday)).toBeNull();
  });

  it('a check-in coming due does not count as new: the owner has a week to post it', () => {
    const monday = new Date('2026-11-02T12:00:00Z');
    const s = withSaid(s0, said('access', 'acknowledge'));
    expect(attentionFor(goal(s, 'access'), s, cycle, monday).flags.map((f) => f.kind)).toContain('due');
    expect(handled(s, 'access', monday)).not.toBeNull();
  });

  it('an action past its week is news, not in hand', () => {
    expect(handled(withSaid(s0, said('access', 'action', { dueWeek: week - 1 })), 'access')).toBeNull();
    expect(handled(withSaid(s0, said('access', 'action', { dueWeek: week })), 'access')).not.toBeNull();
  });

  it('a goal going quiet is never being handled', () => {
    expect(handled(withSaid(s0, said('env', 'action', { at: '2026-10-29T15:00:00.000Z', dueWeek: 47 })), 'env')).toBeNull();
  });

  it('only behind goals are handled: an on-track goal with a note is just on track', () => {
    expect(handled(withSaid(s0, said('lead', 'note')), 'lead')).toBeNull();
  });

  it('a look dated after today does not count yet', () => {
    expect(handled(withSaid(s0, said('access', 'acknowledge', { at: '2026-11-03T15:00:00.000Z' })), 'access')).toBeNull();
  });

  it('an agreed action is shown before a note or a plain “reviewed”', () => {
    const s = withSaid(s0, said('access', 'acknowledge', { at: '2026-10-29T17:00:00.000Z' }), said('access', 'action', { assigneeId: 'elena', dueWeek: 46 }), said('access', 'note'));
    expect(handled(s, 'access')!.text).toBe('Action: Elena, due week 46');
  });

  it('handledFor is the same rule on its own', () => {
    const s = withSaid(s0, said('access', 'acknowledge'));
    expect(handledFor(goal(s, 'access'), s, cycle, today)).toEqual(handled(s, 'access'));
  });
});

describe('lists that show attention', () => {
  it('put what needs attention first and what is being handled after, and split them', () => {
    const list = attentionList(s0, cycle, today);
    const firstHandled = list.findIndex((a) => a.handled);
    expect(firstHandled).toBeGreaterThan(0);
    expect(list.slice(firstHandled).every((a) => a.handled)).toBe(true);
    const { needs, handled: inHand } = splitAttention(list);
    expect(inHand.map((a) => a.goal.id)).toEqual(['head']);
    expect(needs.map((a) => a.goal.id)).toContain('access');
    expect(needs.every(needsAttention)).toBe(true);
  });

  it('the review agenda carries it: new information first, then what is being handled, then the healthy goals', () => {
    const s = withSaid(s0, said('access', 'action', { dueWeek: 47 }));
    const x = reviewSession(s.reviews.find((r) => r.id === 'weekly')!, s, cycle, today, week);
    const ids = x.items.map((a) => a.goal.id);
    const tier = (id: string) => { const a = x.items.find((i) => i.goal.id === id)!; return a.handled ? 1 : a.status.status === 'on' && a.flags.every((f) => f.kind === 'due') ? 2 : 0; };
    expect(ids.map(tier)).toEqual([...ids.map(tier)].sort((a, b) => a - b));
    const ag = agendaOf(x);
    expect(ag.handled.map((a) => a.goal.id).sort()).toEqual(['access', 'head']);
    // Being handled is a part of discuss, at its end, so the agenda's screen still walks them.
    expect(ag.handled.every((a) => ag.discuss.includes(a))).toBe(true);
    expect(ag.discuss.slice(-2).map((a) => a.goal.id).sort()).toEqual(['access', 'head']);
  });

  it('the AI brief lists them apart, with what is in hand, and not under at risk', () => {
    const md = aiBrief({ ws: { id: 'x', name: 'Platform' }, snapshot: s0, cycle, week, today });
    const risk = md.slice(md.indexOf('## At risk'), md.indexOf('## Being handled'));
    expect(md).toContain('## Being handled');
    expect(risk).not.toContain('### Intake-to-delivery time');
    const inHand = md.slice(md.indexOf('## Being handled'), md.indexOf('## No recent update'));
    expect(inHand).toContain('### Intake-to-delivery time');
    expect(inHand).toContain(`**Being handled:** Noted in Platform weekly review, week ${week - 1}`);
    expect(md).toMatch(/1 behind and being handled/);
  });
});
