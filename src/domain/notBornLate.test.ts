// @vitest-environment node
/* A new goal isn't born late (onboarding spec, rules 3 and 4; OB2): a stage already past is asked about, and one said
   to be done counts as on time; a first number can restart the plan. The worked examples, in a 13-week cycle. */
import { CYCLE, metric, MILESTONE } from '../spec/examples';
import { recordStagesDone, NotAllowed, type ActionContext } from './actions';
import { rebase, rebaseOffer } from './checkin';
import { blankGoal, pastStage, stagesDoneAtSetUp, type GoalDraft } from './goal';
import { goalMustFix } from './goalEntry';
import { assessMilestone } from './status';
import type { CheckIn, Goal, Person, Snapshot } from './types';

const P: Person = { id: 'p', name: 'Pat Owner', role: '', initials: 'PO', teamId: 't', admin: false };
const ctx = (goal: Goal, checkIns: CheckIn[] = [], actor = P): ActionContext => ({
  snapshot: { people: [P], teams: [{ id: 't', name: 'Team', leadId: 'p', objective: '' }], cycles: [CYCLE], goals: [goal], checkIns, decisions: [], changes: [], watches: [], reviews: [], retros: [] } as unknown as Snapshot,
  cycle: CYCLE, week: 10, actor, now: '2026-11-11T10:00:00Z', newId: (p) => `${p}_1`,
});

describe('a stage already past (rule 3)', () => {
  it('asks only for a stage due before this week', () => {
    expect([12, 10, 3].map((w) => pastStage(w, 10))).toEqual([false, false, true]);
  });

  it('won’t let a new goal go on until each past stage is answered; an existing goal is never asked', () => {
    const d = { ...blankGoal('t', 'p', ''), title: 'Launch', kind: 'milestone' as const, stages: [{ id: 'a', name: 'A', dueWeek: '3' }] };
    const said = (x: GoalDraft, door: 'form' | 'table') => goalMustFix(x, { cycleWeeks: CYCLE.weeks, week: 10, existing: null, door }).find((f) => f.field === 'stages')?.text;
    expect(said(d, 'form')).toBe('Say whether this stage is done.');
    expect(said({ ...d, stages: [{ ...d.stages[0]!, done: 'no' as const }] }, 'form')).toBeUndefined();
    // A file asks its own question about past stages (planChanges' past-stage), not this one.
    expect(said(d, 'table')).toBeUndefined();
  });

  it('a stage said to be done is recorded done in its own week, so nothing is late', () => {
    const c = stagesDoneAtSetUp(MILESTONE, ['a'], 'p', '2026-11-11T10:00:00Z', 'ci1')!;
    expect(c).toMatchObject({ week: 3, status: 'on', why: 'Recorded as already done when the goal was set up' });
    expect(assessMilestone(MILESTONE, 3, c.stages).late).toEqual([]);
  });

  it('a stage said to be overdue is late from the start; none done records nothing', () => {
    expect(stagesDoneAtSetUp(MILESTONE, [], 'p', '', 'x')).toBeNull();
    expect(assessMilestone(MILESTONE, 10, null).late.length).toBeGreaterThan(0);
  });

  it('only the owner or an admin records it, and only before the first check-in', () => {
    expect(recordStagesDone(ctx(MILESTONE), MILESTONE, ['a'])!.checkIns).toHaveLength(1);
    expect(() => recordStagesDone(ctx(MILESTONE, [], { ...P, id: 'q' }), MILESTONE, ['a'])).toThrow(NotAllowed);
    const ci = stagesDoneAtSetUp(MILESTONE, ['a'], 'p', '', 'c0')!;
    expect(() => recordStagesDone(ctx(MILESTONE, [ci]), MILESTONE, ['a'])).toThrow(/check-ins already/);
  });
});

describe('re-basing at the first check-in (rule 4)', () => {
  // Lead time: 5 days down to 2, set up in week 10.
  const g = metric(5, 2, 'straight', { createdAt: '2026-11-09T09:00:00Z', unit: 'days', plan: { start: 5, target: 2, shape: 'straight', fromWeek: 10 } }) as Goal;
  const offer = (v: number, extra: { checkIns?: CheckIn[]; created?: number } = {}) => rebaseOffer(g, CYCLE, 10, v, extra.checkIns ?? [], extra.created ?? 10);
  it('is offered when the first number is off the plan', () => {
    expect(offer(7)).toEqual({ start: 5, value: 7 });
  });
  it('isn’t offered on plan, at the target, too long after set-up, or after a check-in', () => {
    expect(offer(5)).toBeNull();
    expect(offer(2)).toBeNull();
    expect(offer(7, { created: 1 })).toBeNull();
    expect(offer(7, { checkIns: [{ id: 'c', goalId: g.id, authorId: 'p', week: 9, postedAt: '', value: 5, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false }] })).toBeNull();
  });
  it('starts the plan from the number, to the same target, due week and shape', () => {
    const r = rebase(g, 7, 10);
    expect(r.kind === 'metric' && r.plan).toMatchObject({ start: 7, target: 2, shape: 'straight', fromWeek: 10 });
    expect(offer(7) && rebaseOffer(r, CYCLE, 10, 7, [], 10)).toBeNull();
  });
});
