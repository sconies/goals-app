import { currentWeek, forecast, planAt, shapeProgress, valueSeries } from './plan';
import { assessMetric, assessMilestone, assessRange, goalStatus, worst } from './status';
import { emptyDraft, evaluate, toCheckIn, type Draft } from './checkin';
import { blankGoal, buildGoal, validateGoal } from './goal';
import type { CheckIn, Cycle, MetricGoal, MilestoneGoal, RangeGoal } from './types';

const cycle: Cycle = { id: 'c1', name: 'Q4', startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
const base = { cycleId: 'c1', teamId: 't', ownerId: 'p', io: 'input' as const, level: 'team' as const, guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '2026-09-01T00:00:00Z' };
const metric = (start: number, target: number, shape: 'straight' | 'back' | 'stepped' = 'straight'): MetricGoal =>
  ({ ...base, id: 'm', title: 'M', kind: 'metric', unit: '%', decimals: 0, plan: { start, target, shape }, originalPlan: null, rebaselinedWeek: null });
const range: RangeGoal = { ...base, id: 'r', title: 'CFR', kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 12, margin: 1 } };
const milestone: MilestoneGoal = { ...base, id: 'ms', title: 'MS', kind: 'milestone', stages: [{ id: 'a', name: 'A', dueWeek: 3 }, { id: 'b', name: 'B', dueWeek: 7 }] };

const ci = (goalId: string, week: number, value: number | null, extra: Partial<CheckIn> = {}): CheckIn => ({
  id: goalId + week, goalId, authorId: 'p', week, postedAt: new Date(Date.parse('2026-09-07T10:00:00Z') + week * 7 * 86_400_000).toISOString(),
  value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false, ...extra,
});

describe('plan', () => {
  it('counts weeks from the start date', () => {
    expect(currentWeek(cycle, new Date('2026-09-07T09:00:00Z'))).toBe(0);
    expect(currentWeek(cycle, new Date('2026-09-13T23:00:00Z'))).toBe(0);
    expect(currentWeek(cycle, new Date('2026-09-14T00:00:00Z'))).toBe(1);
    expect(currentWeek(cycle, new Date('2026-09-01T00:00:00Z'))).toBe(0);
    expect(currentWeek(cycle, new Date('2027-03-01T00:00:00Z'))).toBe(13);
  });

  it('shapes the plan: straight, back-loaded (w/13)^1.5, three steps', () => {
    expect(shapeProgress('straight', 0, 13)).toBe(0);
    expect(shapeProgress('straight', 13, 13)).toBe(1);
    expect(shapeProgress('back', 4, 13)).toBeCloseTo(Math.pow(4 / 13, 1.5));
    expect([4, 5, 8, 9, 12, 13].map((w) => shapeProgress('stepped', w, 13))).toEqual([0, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 1]);
    expect(planAt({ start: 34, target: 18, shape: 'back' }, 4, 13)).toBeCloseTo(34 - 16 * Math.pow(4 / 13, 1.5));
  });

  it('forecasts from the last three weeks of trend, and needs that much data', () => {
    expect(forecast([{ week: 1, value: 10 }, { week: 2, value: 12 }], 13)).toBeNull();
    expect(forecast([{ week: 1, value: 10 }, { week: 4, value: 16 }], 13)).toBe(16 + 2 * 9);
    // Uses the latest value at least three weeks earlier, not the first one.
    expect(forecast([{ week: 1, value: 0 }, { week: 3, value: 10 }, { week: 6, value: 16 }], 13)).toBeCloseTo(16 + 2 * 7);
  });

  it('keeps the latest check-in for each week', () => {
    const s = valueSeries([ci('m', 2, 5, { postedAt: '2026-09-21T10:00:00Z' }), ci('m', 2, 7, { postedAt: '2026-09-22T10:00:00Z' }), ci('m', 1, 3)]);
    expect(s).toEqual([{ week: 1, value: 3 }, { week: 2, value: 7 }]);
  });
});

describe('metric status', () => {
  const g = metric(30, 75); // straight: plan at week 4 is 30 + 45 * 4/13 ≈ 43.85
  it('is on track at 95% of planned progress or more', () => {
    const plan = planAt(g.plan, 4, 13);
    expect(assessMetric(g, 13, 4, 30 + (plan - 30) * 0.95, []).calc).toBe('on');
    expect(assessMetric(g, 13, 4, 30 + (plan - 30) * 0.94, []).calc).toBe('risk');
    expect(assessMetric(g, 13, 4, 30 + (plan - 30) * 0.8, []).calc).toBe('risk');
    expect(assessMetric(g, 13, 4, 30 + (plan - 30) * 0.79, []).calc).toBe('off');
  });
  it('works when lower is better', () => {
    const down = metric(34, 18, 'back');
    const plan = planAt(down.plan, 6, 13);
    expect(assessMetric(down, 13, 6, 29.4, []).ratio).toBeCloseTo((29.4 - 34) / (plan - 34));
    expect(assessMetric(down, 13, 6, 29.4, []).calc).toBe('risk');
    expect(assessMetric(down, 13, 6, 35, []).calc).toBe('off');
  });
  it('marks well ahead at 120% and behind under 95%', () => {
    const a = assessMetric(g, 13, 4, 58, []);
    expect(a.ahead).toBe(true);
    expect(a.calc).toBe('on');
    expect(assessMetric(g, 13, 4, 40, []).behind).toBe(true);
  });
  it('is not started in week 0 and waits for a value', () => {
    expect(assessMetric(g, 13, 0, 30, []).calc).toBe('planned');
    expect(assessMetric(g, 13, 3, null, []).calc).toBe('none');
  });
  it('handles a stepped plan before its first step', () => {
    const st = metric(10, 40, 'stepped');
    expect(assessMetric(st, 13, 2, 10, []).calc).toBe('on');
    expect(assessMetric(st, 13, 2, 8, []).calc).toBe('risk');
  });
  it('says when the forecast misses the target', () => {
    const a = assessMetric(g, 13, 6, 45, [{ week: 3, value: 42 }]);
    expect(a.forecast).toBeCloseTo(52);
    expect(a.forecastMisses).toBe(true);
  });
});

describe('range status', () => {
  it('is on track inside the range and clear of the margin', () => expect(assessRange(range, 3, 10.5, 10.6).calc).toBe('on'));
  it('is at risk inside the warning margin', () => expect(assessRange(range, 3, 11.2, 10.6).calc).toBe('risk'));
  it('is at risk after one breach, this week or last', () => {
    expect(assessRange(range, 6, 12.6, 11.2).calc).toBe('risk');
    expect(assessRange(range, 7, 10.4, 12.6).calc).toBe('risk');
  });
  it('is off track after two weeks out of range', () => expect(assessRange(range, 7, 12.4, 12.6).calc).toBe('off'));
  it('works for a lower bound', () => {
    const atLeast: RangeGoal = { ...range, range: { bound: 'atLeast', limit: 99, margin: 0.5 } };
    expect(assessRange(atLeast, 2, 99.8, 99.9).calc).toBe('on');
    expect(assessRange(atLeast, 2, 99.3, 99.9).calc).toBe('risk');
    expect(assessRange(atLeast, 2, 98, 98.5).calc).toBe('off');
  });
});

describe('milestone status', () => {
  it('is on track while stages are on schedule', () => {
    expect(assessMilestone(milestone, 2, null).calc).toBe('on');
  });
  it('is at risk up to two weeks late, off track beyond', () => {
    expect(assessMilestone(milestone, 4, [{ stageId: 'a', doneWeek: 3, forecastWeek: null }, { stageId: 'b', doneWeek: null, forecastWeek: 9 }]).calc).toBe('risk');
    expect(assessMilestone(milestone, 4, [{ stageId: 'a', doneWeek: 3, forecastWeek: null }, { stageId: 'b', doneWeek: null, forecastWeek: 10 }]).calc).toBe('off');
  });
  it('treats an overdue stage as late by at least the weeks since its due date', () => {
    const a = assessMilestone(milestone, 6, null);
    expect(a.stages[0]).toMatchObject({ kind: 'off', weeksLate: 3 });
    expect(a.calc).toBe('off');
  });
  it('is done when every stage is done, and counts late finishes', () => {
    const a = assessMilestone(milestone, 9, [{ stageId: 'a', doneWeek: 3, forecastWeek: null }, { stageId: 'b', doneWeek: 9, forecastWeek: null }]);
    expect(a.calc).toBe('done');
    expect(a.stages[1]?.weeksLate).toBe(2);
  });
});

describe('official status', () => {
  const g = metric(30, 75);
  it('is the owner’s latest call', () => {
    const s = goalStatus(g, cycle, [ci('m', 4, 40, { status: 'risk', calculated: 'off', postedAt: '2026-10-08T10:00:00Z' })], new Date('2026-10-10T10:00:00Z'));
    expect(s.status).toBe('risk');
    expect(s.greener).toBe(true);
  });
  it('goes stale after 14 days without a check-in', () => {
    const c = ci('m', 2, 36, { postedAt: '2026-09-23T10:00:00Z' });
    expect(goalStatus(g, cycle, [c], new Date('2026-10-06T10:00:00Z')).status).toBe('on');
    expect(goalStatus(g, cycle, [c], new Date('2026-10-07T10:00:00Z')).status).toBe('stale');
  });
  it('is not started in week 0, waiting in the first two weeks, then stale with no check-in', () => {
    expect(goalStatus(g, cycle, [], new Date('2026-09-08T10:00:00Z')).status).toBe('planned');
    expect(goalStatus(g, cycle, [], new Date('2026-09-15T10:00:00Z')).status).toBe('none');
    expect(goalStatus(g, cycle, [], new Date('2026-09-21T10:00:00Z')).status).toBe('stale');
  });
  it('rolls up to the worst, counting stale as at risk', () => {
    expect(worst(['on', 'stale'])).toBe('risk');
    expect(worst(['on', 'risk', 'off'])).toBe('off');
    expect(worst(['done', 'done'])).toBe('done');
    expect(worst(['on', 'done'])).toBe('on');
  });
});

describe('check-in rules', () => {
  const g = metric(30, 75);
  const fill = (d: Partial<Draft>): Draft => ({ ...emptyDraft(g, null), ...d });
  it('needs a value', () => {
    expect(evaluate(g, cycle, 4, fill({}), []).missing).toContain('this week’s value');
    expect(evaluate(g, cycle, 4, fill({ value: 'abc' }), []).missing).toContain('a number for this week’s value');
  });
  it('posts an on-plan check-in with just the value', () => {
    expect(evaluate(g, cycle, 4, fill({ value: '44' }), []).canPost).toBe(true);
  });
  it('asks why when behind, and for a path to green when the call is at risk or off', () => {
    const e = evaluate(g, cycle, 4, fill({ value: '40' }), []);
    expect(e.calc).toBe('off');
    expect(e.missing).toEqual(['why it’s behind', 'path to green']);
    const ok = evaluate(g, cycle, 4, fill({ value: '40', cause: 'slower', why: 'Rollout paused for a week', ptgWhat: 'Restart the rollout', ptgBy: 7 }), []);
    expect(ok.canPost).toBe(true);
  });
  it('rejects a path back by a week that has passed', () => {
    const e = evaluate(g, cycle, 4, fill({ value: '40', cause: 'slower', why: 'Rollout paused for a week', ptgWhat: 'Restart the rollout', ptgBy: 4 }), []);
    expect(e.missing).toEqual(['path to green']);
  });
  it('asks why when well ahead, and whether the target should change', () => {
    const e = evaluate(g, cycle, 4, fill({ value: '58' }), []);
    expect(e.reason).toBe('ahead');
    expect(e.asksTarget).toBe(true);
    expect(evaluate(g, cycle, 4, fill({ value: '58', cause: 'early', why: 'The bot shipped two weeks early', proposeTarget: '70' }), []).missing).toEqual(['a proposed target beyond the current one']);
    expect(evaluate(g, cycle, 4, fill({ value: '58', cause: 'early', why: 'The bot shipped two weeks early', proposeTarget: '95' }), []).canPost).toBe(true);
  });
  it('needs a reason for a greener call, and flags it on the record', () => {
    const d = fill({ value: '40', status: 'on', cause: 'slower', why: 'Rollout paused for a week' });
    expect(evaluate(g, cycle, 4, d, []).missing).toEqual(['why your call is greener']);
    const posted = toCheckIn(g, cycle, 4, { ...d, greenerWhy: 'The fix ships Monday and closes the gap' }, [], 'p', new Date('2026-10-08T10:00:00Z'), 'x');
    expect(posted).toMatchObject({ status: 'on', calculated: 'off', pathToGreen: null });
  });
  it('refuses to build an incomplete check-in', () => {
    expect(() => toCheckIn(g, cycle, 4, fill({ value: '40' }), [], 'p', new Date(), 'x')).toThrow(/Still needed/);
  });
  it('carries milestone stages forward from the last check-in', () => {
    const prev = ci('ms', 3, null, { stages: [{ stageId: 'a', doneWeek: 3, forecastWeek: null }, { stageId: 'b', doneWeek: null, forecastWeek: 8 }] });
    expect(emptyDraft(milestone, prev).stages[1]).toEqual({ stageId: 'b', doneWeek: null, forecastWeek: 8 });
    expect(evaluate(milestone, cycle, 4, emptyDraft(milestone, prev), []).calc).toBe('risk');
  });
});

describe('goals', () => {
  it('validates the form', () => {
    const d = blankGoal('t', 'p', '');
    expect(Object.keys(validateGoal(d, cycle)).sort()).toEqual(['start', 'target', 'title']);
    expect(validateGoal({ ...d, title: 'Triage', start: '40', target: '40' }, cycle).target).toMatch(/differ/);
    expect(validateGoal({ ...d, kind: 'milestone', title: 'Brain', stages: [{ id: 's1', name: 'Model', dueWeek: '14' }] }, cycle).stages).toMatch(/between 1 and 13/);
  });
  it('keeps the original plan when the plan changes after check-ins started', () => {
    const d = { ...blankGoal('t', 'p', ''), title: 'Review', start: '30', target: '75' };
    const g1 = buildGoal(d, cycle, { id: 'g', createdAt: 'x' }, null, false, 0) as MetricGoal;
    const g2 = buildGoal({ ...d, target: '95' }, cycle, { id: 'g', createdAt: 'x' }, g1, true, 4) as MetricGoal;
    expect(g2.originalPlan).toEqual(g1.plan);
    expect(g2.rebaselinedWeek).toBe(4);
    const g3 = buildGoal({ ...d, target: '90' }, cycle, { id: 'g', createdAt: 'x' }, g2, true, 6) as MetricGoal;
    expect(g3.originalPlan).toEqual(g1.plan);
    const early = buildGoal({ ...d, target: '80' }, cycle, { id: 'g', createdAt: 'x' }, g1, false, 0) as MetricGoal;
    expect(early.originalPlan).toBeNull();
  });
});

describe('typed numbers', () => {
  it('reads decimal commas, thousands, units and percentages', async () => {
    const { parseNumber } = await import('./checkin');
    expect(parseNumber('29,4')).toBe(29.4);
    expect(parseNumber('1,250')).toBe(1250);
    expect(parseNumber('1,250.5')).toBe(1250.5);
    expect(parseNumber('62%')).toBe(62);
    expect(parseNumber('29.4 days')).toBe(29.4);
    expect(parseNumber(' -3 ')).toBe(-3);
  });
  it('refuses what is not a number', async () => {
    const { parseNumber } = await import('./checkin');
    for (const bad of ['0x1F', '1e308', 'abc', '1.2.3', '99999999999999']) expect(parseNumber(bad)).toBeNull();
  });
  it('explains impossible and surprising values', async () => {
    const { valueProblem } = await import('./checkin');
    expect(valueProblem('-5', 30, 'days')?.block).toBe(true);
    expect(valueProblem('120', 60, '%')?.block).toBe(false);
    expect(valueProblem('294', 29.4, 'days')?.text).toMatch(/Last week was 29.4/);
    expect(valueProblem('29.6', 29.4, 'days')).toBeNull();
  });
});
