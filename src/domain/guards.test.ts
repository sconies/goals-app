// @vitest-environment node
/* Guardrails on a goal (GR, domain/guards): which goals may guard, the breaches as of a week, the calculated status with
   them applied, their words, and the check-in and the database row that carry them. */
import { goalFromRows, goalToRows } from '../data/rows';
import { CYCLE, metric, RANGE } from '../spec/examples';
import { builtOver } from './changeset';
import { emptyDraft, evaluate } from './checkin';
import { blankGoal, buildGoal, draftOf } from './goal';
import { guardBreaches, guardedCalc, MAX_GUARDS } from './guards';
import { breachWords, cleanGuards, guardRefusal } from './guardWords';
import type { CheckIn, Goal, MetricGoal, RangeGoal } from './types';

const CFR: RangeGoal = { ...RANGE, id: 'cfr', key: 'G-41' };
const SPEED: MetricGoal = metric(10, 30, 'straight', { id: 'speed', title: 'Deploys a week', unit: 'deploys', guards: [{ goal: 'cfr' }] });
const GOALS: Goal[] = [CFR, SPEED];
const ci = (goalId: string, week: number, value: number): CheckIn => ({
  id: `${goalId}-${week}`, goalId, authorId: 'p', week, postedAt: `2026-09-${String(7 + week).padStart(2, '0')}T10:00:00Z`, value, stages: null,
  status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false,
});

describe('guardrails on a goal', () => {
  it('only a running goal kept in a range, in the same year, can guard; never the goal itself', () => {
    expect(guardRefusal(SPEED, CFR)).toBeNull();
    expect(guardRefusal(SPEED, SPEED)).toBe('A goal can’t guard itself');
    expect(guardRefusal(CFR, SPEED)).toBe('Only a goal kept in a range can guard');
    expect(guardRefusal(SPEED, { ...CFR, stoppedAt: '2026-09-20' })).toBe('It’s no longer running');
    expect(guardRefusal(SPEED, { ...CFR, cycleId: 'c2' })).toBe('It’s in another year');
    expect(cleanGuards(SPEED, ['cfr', 'cfr', 'speed', 'nope'], GOALS)).toEqual([{ goal: 'cfr' }]);
  });

  it('a guard past its limit makes the goal at risk; two weeks running, off track; near it, nothing', () => {
    expect(guardBreaches(SPEED, GOALS, CYCLE, [ci('cfr', 3, 11.5)], 3)).toEqual([]);
    const once = guardBreaches(SPEED, GOALS, CYCLE, [ci('cfr', 3, 11), ci('cfr', 4, 14)], 4);
    expect(once.map((b) => [b.status, b.value, b.limit, b.by])).toEqual([['risk', 14, 12, 2]]);
    const twice = guardBreaches(SPEED, GOALS, CYCLE, [ci('cfr', 3, 13), ci('cfr', 4, 14)], 4);
    expect(twice[0]!.status).toBe('off');
    // As of an earlier week, a later number isn't seen.
    expect(guardBreaches(SPEED, GOALS, CYCLE, [ci('cfr', 3, 11), ci('cfr', 4, 14)], 3)).toEqual([]);
    // A guard stopped since guards nothing.
    expect(guardBreaches(SPEED, [{ ...CFR, stoppedAt: '2026-09-30' }, SPEED], CYCLE, [ci('cfr', 4, 14)], 4)).toEqual([]);
  });

  it('the calculated status is the worse of the goal’s own and its worst guard’s', () => {
    const [b] = guardBreaches(SPEED, GOALS, CYCLE, [ci('cfr', 3, 13), ci('cfr', 4, 14)], 4);
    expect(guardedCalc('on', [b!])).toBe('off');
    expect(guardedCalc('on', [{ ...b!, status: 'risk' }])).toBe('risk');
    expect(guardedCalc('off', [{ ...b!, status: 'risk' }])).toBe('off');
    expect(guardedCalc('on', [])).toBe('on');
    expect(breachWords(b!)).toBe('Guardrail “Change failure rate” (G-41) is over its 12.0% limit: 14.0% in week 4, 2.0 pts over, 2 weeks running.');
  });

  it('a check-in on plan with a guard past its limit is off track, and asks why', () => {
    const all = [ci('cfr', 3, 13), ci('cfr', 4, 14)];
    const breaches = guardBreaches(SPEED, GOALS, CYCLE, all, 4);
    const draft = { ...emptyDraft(SPEED, null), value: String(10 + (20 * 4) / 13) };
    const plain = evaluate(SPEED, CYCLE, 4, { ...draft, value: '16' }, all);
    const guarded = evaluate(SPEED, CYCLE, 4, { ...draft, value: '16' }, all, breaches);
    expect(plain.calc).toBe('on');
    expect([guarded.calc, guarded.reason, guarded.codes.includes('reason-behind'), guarded.breaches.length]).toEqual(['off', 'behind', true, 1]);
  });

  it('is kept through the form and the database row, at most five, never itself', () => {
    const d = { ...draftOf(SPEED), guards: ['cfr', 'speed', 'cfr', 'a', 'b', 'c', 'd', 'e'] };
    const built = buildGoal(d, CYCLE, { id: 'speed', createdAt: SPEED.createdAt }, SPEED, false, 2);
    expect(built.guards).toEqual(['cfr', 'a', 'b', 'c', 'd'].map((goal) => ({ goal })));
    expect(MAX_GUARDS).toBe(5);
    // A draft that says nothing about guards keeps the goal's.
    const { guards: _, ...silent } = draftOf(SPEED);
    expect(buildGoal(silent, CYCLE, { id: 'speed', createdAt: SPEED.createdAt }, SPEED, false, 2).guards).toEqual([{ goal: 'cfr' }]);
    expect(buildGoal(blankGoal('t', 'p', ''), CYCLE, { id: 'n', createdAt: '' }, null, false, 0).guards).toBeUndefined();
    const { goal } = goalToRows('ws', SPEED);
    expect(goal.guards).toEqual([{ goal: 'cfr' }]);
    expect(goalFromRows(goal, []).guards).toEqual([{ goal: 'cfr' }]);
    expect(goalToRows('ws', CFR).goal.guards).toBeNull();
    expect(goalFromRows(goalToRows('ws', CFR).goal, []).guards).toBeUndefined();
  });

  it('clearing every guard removes them through the engine’s build; a draft that says nothing keeps them', () => {
    const cleared = buildGoal({ ...draftOf(SPEED), guards: [] }, CYCLE, { id: 'speed', createdAt: SPEED.createdAt }, SPEED, false, 2);
    expect(builtOver(SPEED, cleared).guards).toBeUndefined();
    const { guards: _, ...silent } = draftOf(SPEED);
    expect(builtOver(SPEED, buildGoal(silent, CYCLE, { id: 'speed', createdAt: SPEED.createdAt }, SPEED, false, 2)).guards).toEqual([{ goal: 'cfr' }]);
  });
});
