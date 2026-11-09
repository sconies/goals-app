// @vitest-environment node
/* The trend sentence says what the numbers show (deep review T5, 10 Nov): a number typed as the plan is never "getting
   worse", and "heads short of the target" means the whole range it heads for misses it. */
import { goalTrend } from './trend';
import { attentionFor } from './attention';
import { buildPlatformOrg } from '../data/platformOrg';
import type { CheckIn, Cycle, MetricGoal } from './types';

const cycle: Cycle = { id: 'c1', name: 'Q4', startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
const goal: MetricGoal = { cycleId: 'c1', teamId: 't', ownerId: 'p', io: 'input', level: 'team', guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '2026-09-01T00:00:00Z', id: 'm', title: 'Build time', kind: 'metric', unit: 'min', decimals: 0, plan: { start: 10, target: 11, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null };
const ci = (week: number, value: number): CheckIn => ({ id: 'c' + week, goalId: 'm', authorId: 'p', week, postedAt: new Date(Date.parse('2026-09-07T10:00:00Z') + week * 7 * 86_400_000).toISOString(), value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false });

describe('the trend sentence (deep review T5)', () => {
  it('never calls three check-ins on plan, as shown, getting worse', () => {
    // The plan creeps up 0.08 a week; 10 each week is "on plan" at the goal's decimals, though a little further behind each time.
    const t = goalTrend(goal, cycle, [ci(3, 10), ci(4, 10), ci(5, 10)]);
    expect(t.word).not.toBe('worse');
    expect(t.detail ?? '').not.toMatch(/on plan → on plan → on plan/);
  });

  it('still says getting worse once the gap shows', () => {
    const t = goalTrend(goal, cycle, [ci(3, 10), ci(4, 10), ci(5, 9)]);
    expect(t.word).toBe('worse');
    expect(t.detail).toBe('Further behind plan at each of the last two check-ins: on plan → on plan → 1 behind (min).');
  });

  // Every "Getting worse" in the example says something its own numbers show, on the demo's day and the talk's.
  for (const day of ['2026-11-05T12:00:00Z', '2026-11-11T12:00:00Z']) {
    it(`says only what the numbers show, across the example on ${day.slice(0, 10)}`, () => {
      const today = new Date(day);
      const s = buildPlatformOrg(today);
      const c = s.cycles.find((x) => x.startDate <= day.slice(0, 10)) ?? s.cycles[0]!;
      const wrong: string[] = [];
      for (const g of s.goals.filter((x) => x.cycleId === c.id)) {
        const f = attentionFor(g, s, c, today).flags.find((x) => x.kind === 'trend');
        const d = f?.detail ?? '';
        const steps = /: (.+) → (.+) → (.+) \(/.exec(d);
        if (/^Further behind/.test(d) && steps && (steps[1] === steps[3] || !/behind$/.test(steps[3]!))) wrong.push(`${g.id}: ${d}`);
        const heads = /heads for ([\d.,]+)–([\d.,]+)\S* .*target of ([\d.,]+)/.exec(d);
        if (heads) {
          const [lo, hi, t] = heads.slice(1).map((v) => Number(v.replace(/,/g, '')));
          if (t! >= lo! && t! <= hi!) wrong.push(`${g.id}: ${d}`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }
});
