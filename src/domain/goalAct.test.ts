// @vitest-environment node
/* Act on a goal (goal spec, GT1): the bar's buttons (rule 1), one list of next steps and asks (rule 2) and what Why says
   about an ask (rule 3), each from the spec's worked examples on the demo workspace, 11 Nov. */
import { buildPlatformOrg } from '../data/platformOrg';
import { attentionFor } from './attention';
import { asksOf } from './asks';
import { currentCycle, scopeToCycle } from './cycle';
import { primaryAction, standingAction, stepsAndAsks, whyPointer } from './goalPage';
import { currentWeek } from './plan';
import type { Ask, Goal, Snapshot } from './types';

const today = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle);
const week = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;
const person = (id: string) => s.people.find((p) => p.id === id)!;
const statusOf = (g: Goal, snap: Snapshot = s) => attentionFor(g, { ...full, ...snap }, cycle, today).status.status;
const steps = (id: string, who: string, snap: Snapshot = s, w = week) => {
  const g = goal(id);
  return stepsAndAsks({ goal: g, viewer: person(who), week: w, cycle, status: statusOf(g, snap), asks: asksOf(snap), people: snap.people, reviews: snap.reviews });
};
const lead = 'ns-lead';

describe('next steps and asks (rule 2)', () => {
  it('as Amara: the decision and her next step are for her, each with its one button; what was done is under Done lately', () => {
    const x = steps(lead, 'amara');
    expect(x.forYou.map((r) => [r.text, r.button])).toEqual([
      ['Decision or help: approve the extra CI runner budget for Q4', 'Respond'],
      ['Next step: Take the runner budget to the finance review.', 'Mark done'],
    ]);
    expect(x.forYou[1]!.line).toBe('Amara · by week 47 (Thu 19 Nov) · agreed in Platform leadership weekly');
    expect(x.open).toEqual([]);
    expect(x.done[0]).toMatchObject({ text: 'Next step: One-page case for the Q4 runner budget.', state: 'Done · week 44' });
    expect(x.openCount).toBe(2);
    expect(x.gap).toBe(false);
  });

  it('as Rhea: nothing for her; she may withdraw her decision; Amara’s step has no button for her', () => {
    const x = steps(lead, 'rhea');
    expect(x.forYou).toEqual([]);
    expect(x.open.map((r) => r.button)).toEqual(['Withdraw', null]);
    expect(x.openCount).toBe(2);
  });

  it('as Oskar: both rows, no buttons', () => {
    const x = steps(lead, 'oskar');
    expect(x.open.map((r) => r.button)).toEqual([null, null]);
  });

  it('a decision raised for several goals is one row that says so', () => {
    expect(steps(lead, 'oskar').open[0]!.line).toMatch(/· for 3 goals$/);
  });

  it('a step past its week says by how much, with the warning mark', () => {
    const x = steps(lead, 'oskar', s, 48);
    expect(x.open.find((r) => r.kind === 'action')).toMatchObject({ state: 'Overdue by 1 week', overdue: true });
    // An overdue step comes first.
    expect(x.open[0]!.kind).toBe('action');
  });

  it('a goal behind with no next step open has a gap; one on track with nothing is empty', () => {
    expect(steps('lead-flaky', 'rhea').gap).toBe(true);
    const calm = s.goals.find((g) => statusOf(g) === 'on' && !asksOf(s).some((r) => r.goalIds.includes(g.id)))!;
    const x = steps(calm.id, 'rhea');
    expect([x.forYou, x.open, x.done, x.openCount, x.gap]).toEqual([[], [], [], 0, false]);
  });

  it('a question open on a goal off track, with no next step: still a gap', () => {
    const g = goal('lead-flaky');
    const q: Ask = { id: 'q-t', kind: 'question', goalIds: [g.id], askedBy: 'amara', recipientId: g.ownerId, ask: 'When will it be under 2%?', status: 'open', dueWeek: null, reviewId: null, week: null, checkInId: null, createdAt: today.toISOString(), updatedAt: today.toISOString(), answer: null, answeredBy: null, answeredAt: null };
    const x = steps('lead-flaky', 'rhea', { ...s, requests: [...asksOf(s), q] });
    expect(x.forYou[0]).toMatchObject({ text: 'Question: When will it be under 2%?', button: 'Answer' });
    expect(x.gap).toBe(true);
  });
});

describe('the bar’s buttons (rule 1)', () => {
  const p = (id: string, who: string, extra: Partial<Parameters<typeof primaryAction>[0]> = {}) => {
    const g = goal(id);
    return primaryAction({ goal: g, viewer: person(who), owner: person(g.ownerId), status: statusOf(g), due: false, week, asked: [], updateAsked: false, openSteps: steps(id, who).open.filter((r) => r.kind === 'action').length + steps(id, who).forYou.filter((r) => r.kind === 'action').length, ...extra });
  };
  it('Rhea on Lead time for changes, checked in, one step open: no primary, Check in again beside it', () => {
    const pr = p(lead, 'rhea');
    expect(pr.kind).toBe(null);
    expect(standingAction({ goal: goal(lead), viewer: person('rhea'), primary: pr, watching: false, status: statusOf(goal(lead)) }).label).toBe('Check in again');
  });
  it('the same with no open next step: Add a next step', () => {
    expect(p(lead, 'rhea', { openSteps: 0 }).label).toBe('Add a next step');
  });
  it('the owner, due this week: Check in for week n, and no standing button', () => {
    const pr = p('lead-flaky', 'rhea', { due: true });
    expect(pr.label).toBe(`Check in for week ${week}`);
    expect(standingAction({ goal: goal('lead-flaky'), viewer: person('rhea'), primary: pr, watching: false, status: 'risk' }).kind).toBe(null);
  });
  it('a goal with no check-in yet: Post the first check-in', () => {
    expect(p(lead, 'rhea', { firstDue: true, due: true }).label).toBe('Post the first check-in');
  });
  it('someone else is offered Watch or Watching, never as the primary', () => {
    const pr = p(lead, 'oskar');
    expect(pr.kind).toBe(null);
    expect(standingAction({ goal: goal(lead), viewer: person('oskar'), primary: pr, watching: true, status: 'off' }).label).toBe('Watching');
    expect(standingAction({ goal: goal(lead), viewer: person('oskar'), primary: pr, watching: false, status: 'off' }).label).toBe('Watch');
  });
  it('a stopped goal has no standing button', () => {
    const g = { ...goal(lead), stoppedAt: today.toISOString() };
    expect(standingAction({ goal: g, viewer: person('rhea'), primary: { kind: null, label: '', targetId: null }, watching: false, status: 'off' }).kind).toBe(null);
  });
});

describe('what Why says about an ask (rule 3)', () => {
  it('points to the list, naming who it waits on, never the ask’s words', () => {
    expect(whyPointer(goal(lead), asksOf(s), s.people)).toBe('Waiting on a decision from Amara: see Next steps and asks');
    expect(whyPointer(goal('lead-flaky'), asksOf(s), s.people)).toBe(null);
  });
  it('to no one in particular: no name', () => {
    const asks = asksOf(s).map((r) => (r.kind === 'decision' && r.goalIds.includes(lead) ? { ...r, recipientId: null } : r));
    expect(whyPointer(goal(lead), asks, s.people)).toBe('Waiting on a decision: see Next steps and asks');
  });
});
