/* Spec scenarios: each case states a rule from the build spec in plain numbers and is tagged
   with its requirement ID, so the scorecard can say which requirements hold. */
import { describe, expect, it } from 'vitest';
import { emptyDraft, evaluate, toCheckIn, type Draft } from '../src/domain/checkin';
import { blankGoal, buildGoal, draftOf, goalAsOf, overHundredHint, validateGoal } from '../src/domain/goal';
import { forecast, planAt, shapeProgress } from '../src/domain/plan';
import { assessMetric, assessMilestone, assessRange, goalStatus } from '../src/domain/status';
import type { CheckIn, Cycle, MetricGoal, MilestoneGoal, RangeGoal } from '../src/domain/types';
import { seed } from '../src/data/seed';
import { applyQuery, EMPTY_QUERY, parseQuery, queryEntries, type GoalQuery } from '../src/domain/query';
import { summariseAll } from '../src/domain/summary';

const cycle: Cycle = { id: 'c', name: 'Eval cycle', startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
const base = { cycleId: 'c', teamId: 't', ownerId: 'o', io: 'input' as const, level: 'team' as const, guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '' };
const up: MetricGoal = { ...base, id: 'up', title: 'Up', kind: 'metric', unit: '%', decimals: 0, plan: { start: 20, target: 72, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null };
const down: MetricGoal = { ...up, id: 'down', title: 'Down', unit: 'days', decimals: 1, plan: { start: 34, target: 8, shape: 'straight' } };
const cfr: RangeGoal = { ...base, id: 'cfr', title: 'CFR', kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 12, margin: 1 } };
const ms: MilestoneGoal = { ...base, id: 'ms', title: 'MS', kind: 'milestone', stages: [{ id: 'a', name: 'A', dueWeek: 4 }, { id: 'b', name: 'B', dueWeek: 8 }] };
// Straight plan from 20 to 72 over 13 weeks: 4 points a week, so week 5's plan is 40 (20 points of planned progress).
const at = (pct: number) => 20 + 20 * pct;
const R = (id: string, text: string) => `[${id}] ${text}`;
const day = (iso: string) => new Date(iso + 'T12:00:00Z');
const posted = (goal: string, week: number, postedOn: string, extra: Partial<CheckIn> = {}): CheckIn => ({
  id: goal + week, goalId: goal, authorId: 'o', week, postedAt: postedOn + 'T10:00:00Z', value: 40, stages: null, status: 'on', calculated: 'on',
  cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false, ...extra,
});

describe('plans', () => {
  it(R('PLAN-SHAPE', 'straight plan reaches half the change at mid-cycle'), () => expect(planAt(up.plan, 6.5, 13)).toBeCloseTo(46));
  it(R('PLAN-SHAPE', 'back-loaded plan follows (w/13)^1.5'), () => {
    for (const w of [1, 4, 7, 10, 13]) expect(shapeProgress('back', w, 13)).toBeCloseTo(Math.pow(w / 13, 1.5));
  });
  it(R('PLAN-SHAPE', 'stepped plan moves in three equal steps and ends on target'), () => {
    const steps = Array.from({ length: 14 }, (_, w) => shapeProgress('stepped', w, 13));
    expect(new Set(steps)).toEqual(new Set([0, 1 / 3, 2 / 3, 1]));
    expect(steps[13]).toBe(1);
  });
  it(R('FORECAST', 'projects the last three weeks of trend to week 13'), () => {
    expect(forecast([{ week: 3, value: 30 }, { week: 6, value: 36 }], 13)).toBeCloseTo(36 + 2 * 7);
  });
  it(R('FORECAST', 'shows no forecast with less than three weeks of trend'), () => {
    expect(forecast([{ week: 5, value: 30 }, { week: 6, value: 36 }], 13)).toBeNull();
  });
  it(R('REBASELINE', 'raising a target after check-ins keeps the original plan and the week it changed'), () => {
    const d = { ...blankGoal('t', 'o', ''), title: 'AI review', start: '30', target: '75' };
    const v1 = buildGoal(d, cycle, { id: 'g', createdAt: '' }, null, false, 0) as MetricGoal;
    const v2 = buildGoal({ ...d, target: '95' }, cycle, { id: 'g', createdAt: '' }, v1, true, 4) as MetricGoal;
    expect(v2.plan.target).toBe(95);
    expect(v2.originalPlan).toEqual({ start: 30, target: 75, shape: 'straight' });
    expect(v2.rebaselinedWeek).toBe(4);
  });
});

describe('metric status bands', () => {
  const cases: [number, string][] = [[1.5, 'on'], [1, 'on'], [0.95, 'on'], [0.949, 'risk'], [0.8, 'risk'], [0.799, 'off'], [0, 'off'], [-0.5, 'off']];
  for (const [pct, want] of cases) {
    it(R('STATUS-BANDS', `${Math.round(pct * 1000) / 10}% of planned progress is ${want}`), () => expect(assessMetric(up, 13, 5, at(pct), []).calc).toBe(want));
  }
  it(R('STATUS-DIRECTION', 'a lower-is-better metric that falls on plan is on track'), () => expect(assessMetric(down, 13, 5, planAt(down.plan, 5, 13), []).calc).toBe('on'));
  it(R('STATUS-DIRECTION', 'a lower-is-better metric that rises is off track'), () => expect(assessMetric(down, 13, 5, 35, []).calc).toBe('off'));
  it(R('STATUS-DIRECTION', 'a lower-is-better metric at 85% of its planned fall is at risk'), () => {
    const v = 34 - (34 - planAt(down.plan, 5, 13)) * 0.85;
    expect(assessMetric(down, 13, 5, v, []).calc).toBe('risk');
  });
});

describe('range status', () => {
  const cases: [string, number, number | null, string][] = [
    ['well inside the range', 10, 10, 'on'],
    ['exactly at the edge of the warning margin', 11, 10, 'on'],
    ['inside the warning margin', 11.5, 10, 'risk'],
    ['over the limit for the first time', 12.5, 11, 'risk'],
    ['back in range a week after a breach', 10, 12.5, 'risk'],
    ['over the limit two weeks running', 12.2, 12.5, 'off'],
  ];
  for (const [what, v, prev, want] of cases) it(R('RANGE', `${what} is ${want}`), () => expect(assessRange(cfr, 6, v, prev).calc).toBe(want));
});

describe('milestone status', () => {
  const u = (b: number | null, bDone: number | null = null) => [{ stageId: 'a', doneWeek: 4, forecastWeek: null }, { stageId: 'b', doneWeek: bDone, forecastWeek: b }];
  it(R('MILESTONE', 'on schedule is on track'), () => expect(assessMilestone(ms, 5, u(null)).calc).toBe('on'));
  it(R('MILESTONE', 'a stage forecast 1 week late is at risk'), () => expect(assessMilestone(ms, 5, u(9)).calc).toBe('risk'));
  it(R('MILESTONE', 'a stage forecast 2 weeks late is at risk'), () => expect(assessMilestone(ms, 5, u(10)).calc).toBe('risk'));
  it(R('MILESTONE', 'a stage forecast 3 weeks late is off track'), () => expect(assessMilestone(ms, 5, u(11)).calc).toBe('off'));
  it(R('MILESTONE', 'a stage past its due week and not done counts as late'), () => expect(assessMilestone(ms, 11, u(null)).calc).toBe('off'));
  it(R('MILESTONE', 'all stages done is done'), () => expect(assessMilestone(ms, 9, u(null, 9)).calc).toBe('done'));
});

describe('the owner’s call and staleness', () => {
  it(R('OWNER-CALL', 'the latest call is the official status even when the calculation differs'), () => {
    const s = goalStatus(up, cycle, [posted('up', 5, '2026-10-14', { value: at(0.5), status: 'risk', calculated: 'off' })], day('2026-10-16'));
    expect(s.status).toBe('risk');
    expect(s.calc).toBe('off');
  });
  it(R('GREENER', 'a greener call is flagged'), () => {
    expect(goalStatus(up, cycle, [posted('up', 5, '2026-10-14', { status: 'risk', calculated: 'off' })], day('2026-10-16')).greener).toBe(true);
  });
  it(R('STALE', '13 days after the last check-in it is still the owner’s call'), () => {
    expect(goalStatus(up, cycle, [posted('up', 4, '2026-10-05')], day('2026-10-18')).status).toBe('on');
  });
  it(R('STALE', '14 days after the last check-in an on-track goal shows Stale'), () => {
    expect(goalStatus(up, cycle, [posted('up', 4, '2026-10-05')], day('2026-10-19')).status).toBe('stale');
  });
  it(R('STALE', 'a goal never checked in goes stale two weeks into the cycle'), () => {
    expect(goalStatus(up, cycle, [], day('2026-09-21')).status).toBe('stale');
  });
});

describe('what a check-in must say', () => {
  const draft = (d: Partial<Draft>): Draft => ({ ...emptyDraft(up, null), ...d });
  const why = { cause: 'slower' as const, why: 'Rollout paused for a week' };
  const path = { ptgWhat: 'Restart the rollout', ptgBy: 8 };
  it(R('CHECKIN-STATUS-VS-PLAN', 'the calculation follows the value as it is typed'), () => {
    expect(evaluate(up, cycle, 5, draft({ value: String(at(1)) }), []).calc).toBe('on');
    expect(evaluate(up, cycle, 5, draft({ value: String(at(0.5)) }), []).calc).toBe('off');
  });
  it(R('REASON-BEHIND', 'at 94% a reason is required'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(0.94)) }), []).missing).toContain('why it’s behind'));
  it(R('REASON-BEHIND', 'at 95% no reason is required'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(0.95)) }), []).canPost).toBe(true));
  it(R('REASON-BEHIND', 'a cause without an explanation is not enough'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(0.9)), cause: 'slower', ...path }), []).canPost).toBe(false));
  it(R('REASON-AHEAD', 'at 120% a reason is required and the target question is asked'), () => {
    const e = evaluate(up, cycle, 5, draft({ value: String(at(1.2)) }), []);
    expect(e.missing).toContain('why it’s ahead');
    expect(e.asksTarget).toBe(true);
  });
  it(R('REASON-AHEAD', 'at 119% no reason is required'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(1.19)) }), []).canPost).toBe(true));
  it(R('REASON-AHEAD', 'a proposed target must go beyond the current one'), () => {
    const d = draft({ value: String(at(1.5)), cause: 'early' as const, why: 'The bot shipped two weeks early' });
    expect(evaluate(up, cycle, 5, { ...d, proposeTarget: '60' }, []).canPost).toBe(false);
    expect(evaluate(up, cycle, 5, { ...d, proposeTarget: '90' }, []).canPost).toBe(true);
  });
  it(R('PATH-TO-GREEN', 'an at-risk call without a path to green cannot be posted'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(0.9)), ...why }), []).missing).toEqual(['path to green']));
  it(R('PATH-TO-GREEN', 'the back-on-plan week must be in the future'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(0.9)), ...why, ptgWhat: 'Restart the rollout', ptgBy: 5 }), []).canPost).toBe(false));
  it(R('PATH-TO-GREEN', 'an off-track call with a reason and path posts, and keeps the decision needed'), () => {
    const c = toCheckIn(up, cycle, 5, draft({ value: String(at(0.5)), ...why, ...path, needs: 'VP: approve scope' }), [], 'o', new Date(), 'x');
    expect(c.pathToGreen).toEqual({ what: 'Restart the rollout', byWeek: 8, needs: 'VP: approve scope', state: 'plan' });
  });
  it(R('PATH-TO-GREEN', 'an owner who is still investigating can post without inventing a date'), () => {
    const d = draft({ value: String(at(0.5)), ...why, ptgWhat: 'Looking into why intake doubled', ptgBy: null, ptgState: 'investigating' });
    expect(evaluate(up, cycle, 5, d, []).missing).toEqual([]);
    expect(toCheckIn(up, cycle, 5, d, [], 'o', new Date(), 'x').pathToGreen).toMatchObject({ byWeek: null, state: 'investigating' });
    expect(evaluate(up, cycle, 5, { ...d, ptgState: 'plan' }, []).missing).toEqual(['path to green']);
  });
  it(R('PATH-TO-GREEN', 'calling an on-plan goal at risk still needs a path to green'), () => expect(evaluate(up, cycle, 5, draft({ value: String(at(1)), status: 'risk' }), []).missing).toEqual(['path to green']));
  it(R('GREENER', 'calling an off-track goal on track needs a reason for the greener call'), () => {
    expect(evaluate(up, cycle, 5, draft({ value: String(at(0.5)), status: 'on', ...why }), []).missing).toEqual(['why your call is greener']);
  });
  it(R('GREENER', 'the posted record keeps both the call and the calculation'), () => {
    const c = toCheckIn(up, cycle, 5, draft({ value: String(at(0.5)), status: 'on', ...why, greenerWhy: 'The fix ships Monday and closes the gap' }), [], 'o', new Date(), 'x');
    expect([c.status, c.calculated]).toEqual(['on', 'off']);
  });
});

describe('goals', () => {
  it(R('GOAL-CREATE', 'a metric goal needs a name, a start and a different target'), () => {
    expect(Object.keys(validateGoal(blankGoal('t', 'o', ''), cycle)).sort()).toEqual(['start', 'target', 'title']);
  });
  it(R('GOAL-CREATE', 'a range goal needs a limit'), () => expect(validateGoal({ ...blankGoal('t', 'o', ''), kind: 'range', title: 'CFR' }, cycle).limit).toBeTruthy());
  it(R('GOAL-CREATE', 'milestone stages must fall inside the cycle'), () => {
    expect(validateGoal({ ...blankGoal('t', 'o', ''), kind: 'milestone', title: 'X', stages: [{ id: 's', name: 'Ship', dueWeek: '0' }] }, cycle).stages).toBeTruthy();
    expect(validateGoal({ ...blankGoal('t', 'o', ''), kind: 'milestone', title: 'X', stages: [{ id: 's', name: 'Ship', dueWeek: '6' }] }, cycle).stages).toBeUndefined();
  });
});

describe('the demo story holds on any day', () => {
  for (const d of ['2026-10-30', '2026-12-07', '2027-03-14']) {
    it(R('HIERARCHY', `headline with inputs from six teams, effects set (${d})`), () => {
      const s = seed(day(d));
      const inputs = s.goals.filter((g) => g.parentId === 'head');
      expect(new Set(inputs.map((g) => g.teamId)).size).toBe(6);
      expect(inputs.filter((g) => g.effect != null).length).toBeGreaterThanOrEqual(6);
    });
    it(R('STALE', `Infrastructure’s quiet goal is stale and the rest are not (${d})`), () => {
      const s = seed(day(d));
      const stale = s.goals.filter((g) => goalStatus(g, s.cycles[0]!, s.checkIns, day(d)).status === 'stale').map((g) => g.id);
      expect(stale).toEqual(['env']);
    });
  }
});

describe('numbers people can trust (research round 1)', () => {
  const d = (value: string): Draft => ({ ...emptyDraft(up, null), value });
  it(R('HONEST-NUMBERS', 'a share can’t be over 100%: 150% on a 20%→72% goal is refused'), () => {
    expect(evaluate(up, cycle, 5, d('150'), []).missing).toContain('a possible value');
  });
  it(R('HONEST-NUMBERS', 'a percentage goal planned past 100% (growth) may report over 100%'), () => {
    const growth: MetricGoal = { ...up, id: 'g', plan: { start: 100, target: 180, shape: 'straight' } };
    expect(evaluate(growth, cycle, 5, d('130'), []).missing).not.toContain('a possible value');
  });
  it(R('HONEST-NUMBERS', 'letters are not a number, and say so before anything else'), () => {
    expect(evaluate(up, cycle, 5, d('abc'), []).missing[0]).toBe('a number for this week’s value');
  });
  it(R('HONEST-NUMBERS', 'a re-plan keeps every earlier plan; each week is judged against the plan of its day'), () => {
    const first = buildGoal({ ...draftOfUp(), target: '80' }, cycle, { id: 'up', createdAt: '' }, up, true, 4) as MetricGoal;
    const second = buildGoal({ ...draftOfUp(), target: '90' }, cycle, { id: 'up', createdAt: '' }, first, true, 8) as MetricGoal;
    expect(goalAsOf(second, 3).plan.target).toBe(72);
    expect(goalAsOf(second, 6).plan.target).toBe(80);
    expect(goalAsOf(second, 9).plan.target).toBe(90);
  });
});
describe('numbers people can trust (research round 2)', () => {
  it(R('HONEST-NUMBERS', 'a percentage target over 100% asks whether it measures a share'), () => {
    expect(overHundredHint('%', '0', '150')).toMatch(/can’t pass 100%/);
    expect(overHundredHint('%', '20', '90')).toBeNull();
    expect(overHundredHint('days', '0', '150')).toBeNull();
  });
});
function draftOfUp() { return draftOf(up); }

describe('search, filters and saved views', () => {
  const day0 = new Date('2026-10-30T12:00:00Z');
  const s0 = seed(day0);
  const c0 = s0.cycles[0]!;
  const w0 = 43;
  const sums = summariseAll(s0.goals, s0, c0, day0, w0);
  const ids = (q: Partial<GoalQuery>) => applyQuery(sums, { ...EMPTY_QUERY, ...q }, { goals: s0.goals, cycle: c0, week: w0 }).map((x) => x.goal.id).sort();
  it(R('SAVED-VIEWS', 'every word of a search must appear somewhere in the goal or its story'), () => expect(ids({ q: 'vendor brain' })).toEqual(['access']));
  it(R('SAVED-VIEWS', 'a slipped recovery date is a filter of its own'), () => expect(ids({ needs: ['slipped'] })).toEqual(['cfr', 'idle']));
  it(R('SAVED-VIEWS', 'a link carries the whole query, and reads back the same'), () => {
    const q: GoalQuery = { ...EMPTY_QUERY, status: ['off'], due: 'quarter', sort: 'due', dir: -1 };
    expect(parseQuery(new URLSearchParams(queryEntries(q)))).toEqual(q);
  });
});

