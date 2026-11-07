/* A goal page's four facts (Lane's notes, 5 Nov): against plan, trend, since last update, projection.
   Plain numbers, tagged with the requirement they hold up. */
import { describe, expect, it } from 'vitest';
import { summaryFacts, type SummaryFact } from '../src/domain/summaryFacts';
import type { CheckIn, Cycle, MetricGoal, MilestoneGoal, RangeGoal } from '../src/domain/types';

const cycle: Cycle = { id: 'c', name: 'Eval cycle', startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
const base = { cycleId: 'c', teamId: 't', ownerId: 'o', io: 'input' as const, level: 'team' as const, guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '' };
// Straight plan from 20 to 72 over 13 weeks: 4 points a week.
const up: MetricGoal = { ...base, id: 'up', title: 'Up', kind: 'metric', unit: '%', decimals: 0, plan: { start: 20, target: 72, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null };
const down: MetricGoal = { ...up, id: 'down', title: 'Down', unit: 'days', decimals: 1, plan: { start: 34, target: 8, shape: 'straight' } };
const cfr: RangeGoal = { ...base, id: 'cfr', title: 'CFR', kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 12, margin: 1 } };
const ms: MilestoneGoal = { ...base, id: 'ms', title: 'MS', kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: 4 }, { id: 'b', name: 'Build', dueWeek: 6 }, { id: 'c', name: 'Launch', dueWeek: 8 }] };
const R = (text: string) => `[GOAL-SUMMARY] ${text}`;
let n = 0;
const ci = (goalId: string, week: number, extra: Partial<CheckIn> = {}): CheckIn => ({
  id: goalId + week + '-' + n++, goalId, authorId: 'o', week, postedAt: `2026-10-${String(week + 1).padStart(2, '0')}T10:00:00Z`, value: null, stages: null, status: 'on', calculated: 'on',
  cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false, ...extra,
});
const fact = (fs: SummaryFact[], key: SummaryFact['key']) => fs.find((f) => f.key === key)!;

describe('the four facts a goal leads with', () => {
  // Plan by week: 4 → 36, 5 → 40, 6 → 44.
  const ups = [ci('up', 4, { value: 37 }), ci('up', 5, { value: 39 }), ci('up', 6, { value: 40, status: 'risk' })];

  it(R('a number goal: the gap to this week’s plan, in its own units'), () => {
    const { facts, source } = summaryFacts(up, cycle, ups, 6);
    expect(facts.map((f) => f.label)).toEqual(['Against plan', 'Trend', 'Since last update', 'Projection']);
    expect(fact(facts, 'plan').value).toBe('4 pts behind plan');
    expect(fact(facts, 'plan').detail).toBe('40% against 44% planned for week 6 · 83% of the planned progress');
    expect(fact(facts, 'plan').tone).toBe('bad');
    expect(source).toMatchObject({ week: 6, authorId: 'o' });
  });

  it(R('a number goal: the gap to plan at each of the last three check-ins, in its own units, and which way it’s heading'), () => {
    // Plans 36, 40, 44 against 37, 39, 40: one point ahead, then one and four behind. Never a share of plan (5 Nov).
    const t = fact(summaryFacts(up, cycle, ups, 6).facts, 'trend');
    expect(t.value).toBe('1 ahead → 1 behind → 4 pts behind plan');
    // Further behind plan at each check-in, and behind now: the one trend rule's Getting worse (trend.ts).
    expect(t.detail).toBe('Getting worse, weeks 4–6');
    expect(t.tone).toBe('bad');
    expect(t.direction).toBe('worsening');
    // Behind all three times: "1 → 2 → 3 pts behind plan", falling further behind.
    const behind = fact(summaryFacts(up, cycle, [ci('up', 4, { value: 35 }), ci('up', 5, { value: 38 }), ci('up', 6, { value: 41 })], 6).facts, 'trend');
    expect(behind.value).toBe('1 → 2 → 3 pts behind plan');
    expect(behind.detail).toBe('Getting worse, weeks 4–6');
    // The same number while the plan rises is said once, plainly: flat, not a collapse.
    const flat = fact(summaryFacts(up, cycle, [ci('up', 4, { value: 35 }), ci('up', 5, { value: 38 }), ci('up', 6, { value: 38 })], 6).facts, 'trend');
    expect(flat.detail).toBe('Flat at 38% for two weeks while the plan rises');
    expect(flat.direction).toBe('worsening');
  });

  it(R('a number goal: the change since the previous check-in, and the call if it moved'), () => {
    const s = fact(summaryFacts(up, cycle, ups, 6).facts, 'since');
    expect(s.value).toBe('Up 1 pt');
    expect(s.detail).toBe('39% in week 5 → 40% in week 6; was on track, now at risk');
    expect(s.tone).toBe('good');
  });

  it(R('a number goal: where the recent trend lands at the due week, as a range, against the target'), () => {
    const p = fact(summaryFacts(up, cycle, [ci('up', 3, { value: 30 }), ...ups], 6).facts, 'projection');
    // 30, 37, 39, 40 in weeks 3–6: a line through all four (not week 6 against week 3), with a range from their spread.
    expect(p.value).toMatch(/^Heading for \d+–\d+% by week 13$/);
    expect(p.detail).toMatch(/^Misses the 72% target by about \d+ pts\. Projected by the app from the last 4 weeks/);
    expect(p.projection!.low).toBeLessThan(p.projection!.high);
    expect(p.projection!.high).toBeLessThan(72);
    expect(fact(summaryFacts(up, cycle, ups, 6).facts, 'projection').value).toBe('Not enough check-ins yet');
    expect(fact(summaryFacts(up, cycle, ups, 6, true).facts, 'projection').value).toBe('Not projected');
  });

  it(R('lower is better: behind and ahead read the right way round'), () => {
    // Plan: 34 → 8 over 13 weeks, 2 a week; week 5's plan is 24.
    const { facts } = summaryFacts(down, cycle, [ci('down', 4, { value: 27 }), ci('down', 5, { value: 23 })], 5);
    expect(fact(facts, 'plan').value).toBe('1.0 days ahead of plan');
    expect(fact(facts, 'since').value).toBe('Down 4.0 days');
    expect(fact(facts, 'since').tone).toBe('good');
  });

  it(R('a range: room to the limit, the values moving towards it, and where they land'), () => {
    const { facts } = summaryFacts(cfr, cycle, [ci('cfr', 3, { value: 10 }), ci('cfr', 5, { value: 10.8 }), ci('cfr', 6, { value: 11.4 })], 6);
    expect(fact(facts, 'plan')).toMatchObject({ label: 'Against the limit', value: '0.6 pts inside the limit', tone: 'flat' });
    expect(fact(facts, 'trend').value).toBe('10.0% → 10.8% → 11.4%');
    expect(fact(facts, 'trend').detail).toBe('Getting worse, weeks 3–6');
    expect(fact(facts, 'since').value).toBe('Up 0.6 pts');
    expect(fact(facts, 'since').tone).toBe('bad');
    expect(fact(facts, 'projection').detail).toMatch(/^Outside the 12\.0% limit/);
    expect(fact(facts, 'trend').direction).toBe('worsening');
  });

  it(R('dated stages: stages late against those due, the slip over the last check-ins and since the last one, and the next stage'), () => {
    const st = (a: number | null, bWhen: number) => [{ stageId: 'a', doneWeek: a, forecastWeek: null }, { stageId: 'b', doneWeek: null, forecastWeek: bWhen }, { stageId: 'c', doneWeek: null, forecastWeek: null }];
    const cs = [ci('ms', 3, { stages: st(null, 6) }), ci('ms', 4, { stages: st(4, 7) }), ci('ms', 5, { stages: st(4, 9) })];
    const { facts } = summaryFacts(ms, cycle, cs, 5);
    expect(fact(facts, 'plan')).toMatchObject({ value: '1 stage late', detail: '1 of 3 stages done; 1 due by week 5', tone: 'bad' });
    expect(fact(facts, 'trend').value).toBe('0 → 1 → 3 weeks late');
    expect(fact(facts, 'trend').detail).toBe('Getting worse, weeks 3–5');
    expect(fact(facts, 'since').value).toBe('Build slipped 2 weeks');
    expect(fact(facts, 'since').detail).toBe('Since week 4: Build moved from week 7 to week 9');
    expect(fact(facts, 'projection').value).toBe('Finishes week 9, 1 week late');
    expect(fact(facts, 'projection').detail).toBe('Next: Build, due week 6, expected week 9');
    // A stage finished since the last update is good news.
    const done = summaryFacts(ms, cycle, cs.slice(0, 2), 4).facts;
    expect(fact(done, 'since').value).toBe('Build slipped 1 week');
    expect(fact(done, 'since').detail).toBe('Since week 3: Design done; Build moved from week 6 to week 7');
  });

  it(R('no check-in yet: no facts, and nothing claimed'), () => {
    expect(summaryFacts(up, cycle, [], 6)).toEqual({ facts: [], source: null });
  });
});
