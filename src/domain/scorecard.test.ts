// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { goalStatus } from './status';
import { amount, goalScorecard, likelihood, likelihoodFloor, projects } from './scorecard';
import type { CheckIn, Cycle, MetricGoal, RangeGoal } from './types';

describe('will it hit the target: where the target sits against the projected range', () => {
  // Higher is better; likely 50, range 46–54 (half-width 4).
  const p = { value: 50, low: 46, high: 54 };
  it('likely when the target sits comfortably on the near side of the likeliest value, or below the whole range', () => {
    expect(likelihood(40, p, 1)).toBe('likely');
    expect(likelihood(48, p, 1)).toBe('likely'); // half a half-width below the likeliest value: the boundary
    expect(likelihood(46, p, 1)).toBe('likely');
  });
  it('possible when the target is close to the likeliest value or inside the range on its better side', () => {
    expect(likelihood(48.5, p, 1)).toBe('possible');
    expect(likelihood(50, p, 1)).toBe('possible');
    expect(likelihood(54, p, 1)).toBe('possible');
  });
  it('unlikely when the target is beyond the range by up to half its width; very unlikely further', () => {
    expect(likelihood(54.5, p, 1)).toBe('unlikely');
    expect(likelihood(58, p, 1)).toBe('unlikely');
    expect(likelihood(58.5, p, 1)).toBe('very-unlikely');
  });
  it('reads the same way round when lower is better', () => {
    expect(likelihood(60, p, -1)).toBe('likely');
    expect(likelihood(50, p, -1)).toBe('possible');
    expect(likelihood(44, p, -1)).toBe('unlikely');
    expect(likelihood(24, { value: 37.6, low: 37.1, high: 38.1 }, -1)).toBe('very-unlikely');
  });
  it('a clean trend with no spread still has a little doubt, from the floor', () => {
    const clean = { value: 80, low: 80, high: 80 };
    const floor = likelihoodFloor(60, 0); // 2% of a change of 60: 1.2
    expect(likelihood(80, clean, 1, floor)).toBe('possible');
    expect(likelihood(79, clean, 1, floor)).toBe('likely');
    expect(likelihood(82, clean, 1, floor)).toBe('unlikely');
    expect(likelihood(90, clean, 1, floor)).toBe('very-unlikely');
  });
});

describe('amounts say their unit once, in the singular for one', () => {
  it('hours, days and points', () => {
    expect(amount(9, { unit: 'hours', decimals: 0 })).toBe('9 hours');
    expect(amount(-1, { unit: 'hours', decimals: 0 })).toBe('1 hour');
    expect(amount(1, { unit: 'days', decimals: 1 })).toBe('1.0 day');
    expect(amount(3, { unit: '%', decimals: 0 })).toBe('3 pts');
  });
});

describe('the scorecard on made-up goals', () => {
  const cycle: Cycle = { id: 'c', name: 'Year', startDate: '2026-01-05', weeks: 53 } as Cycle;
  const ci = (goalId: string, week: number, value: number, status: CheckIn['status'] = 'on'): CheckIn => ({
    id: `${goalId}-${week}`, goalId, week, value, status, calculated: status, why: 'On plan.', cause: null, authorId: 'x', postedAt: `2026-01-01T00:00:${String(week).padStart(2, '0')}Z`,
  } as unknown as CheckIn);
  const down: MetricGoal = { id: 'down', kind: 'metric', title: 'Lead time', unit: 'days', decimals: 1, plan: { start: 30, target: 18, shape: 'straight' } } as unknown as MetricGoal;

  it('a number goal, lower is better: vs plan, vs last week, to target, and will it hit', () => {
    const cs = [10, 11, 12, 13, 14].map((w) => ci('down', w, 25 + (w - 10) * 0.1));
    const card = goalScorecard(down, cycle, cs, 14, false);
    expect(card.cells.map((c) => c.label)).toEqual(['Vs plan', 'Vs last week', 'To target', 'Will it hit 18.0?']);
    const [plan, since, target, hit] = card.cells;
    // Plan for week 14: 30 − 12 × 14/53 ≈ 26.8; actual 25.4, so 1.4 days ahead of plan: the words every list says.
    expect(plan!.value).toBe('1.4 days ahead of plan');
    expect(plan!.sub).toBe('plan 26.8 days');
    // Up 0.1 days, and lower is better: worse, with an upward arrow.
    expect(since).toMatchObject({ value: '0.1 days worse', sub: 'was 25.3 days in week 13', tone: 'bad', move: 'up' });
    expect(target).toMatchObject({ value: '7.4 days over', sub: 'target 18.0 days' });
    // Rising while it should fall: nowhere near.
    expect(hit).toMatchObject({ value: 'Very unlikely', likelihood: 'very-unlikely' });
    expect(hit!.sub).toMatch(/^likely \d+\.\d days by year end$/);
    expect(card.gap).toBe('1.4 days ahead of plan');
    expect(card.marks?.now?.text).toBe('1.4 days ahead of plan');
    expect(card.marks?.end?.gapText).toMatch(/^\d+\.\d over$/);
    expect(card.marks?.end?.likelyText).toMatch(/^likely \d+\.\d$/);
  });

  it('a skipped week: the sub-line names the week compared', () => {
    const card = goalScorecard(down, cycle, [ci('down', 10, 26), ci('down', 12, 25.5)], 12, false);
    expect(card.cells[1]).toMatchObject({ value: '0.5 days better', sub: 'was 26.0 days in week 10', move: 'down', tone: 'good' });
    expect(card.cells[3]!.value).toBe('Too early to say');
  });

  it('a goal gone quiet says nothing about where it lands', () => {
    const card = goalScorecard(down, cycle, [10, 11, 12, 13].map((w) => ci('down', w, 26)), 20, true);
    expect(card.cells[3]!.value).toBe('Can’t say');
    expect(card.cells[0]!.sub).toMatch(/in week 13$/);
    expect(card.marks?.end).toBeNull();
  });

  it('a stopped goal says how it stood and makes no forecast: no “will it hit?”, no likely end on the chart', () => {
    const cs = [10, 11, 12, 13, 14].map((w) => ci('down', w, 25 + (w - 10) * 0.1));
    const stopped = { ...down, stoppedAt: '2026-04-10T10:00:00Z', stoppedBy: 'x', stopReason: 'Another team took it over.' } as MetricGoal;
    const card = goalScorecard(stopped, cycle, cs, 14, false);
    expect(card.cells.map((c) => c.label)).toEqual(['Vs plan', 'Vs last week', 'To target']);
    expect(card.cells.some((c) => c.likelihood)).toBe(false);
    expect(card.marks?.end).toBeNull();
    expect(card.marks?.now?.text).toBe('1.4 days ahead of plan');
    expect(projects(stopped, false)).toBe(false);
    expect(projects(down, false)).toBe(true);
    expect(projects(down, true)).toBe(false);
  });

  it('a range: vs the limit, vs last week, room to the limit, and will it stay within', () => {
    const r: RangeGoal = { id: 'r', kind: 'range', title: 'Errors', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 5, margin: 1 } } as unknown as RangeGoal;
    const card = goalScorecard(r, cycle, [10, 11, 12, 13].map((w) => ci('r', w, 2 + (w - 10) * 0.1)), 13, false);
    expect(card.cells.map((c) => c.label)).toEqual(['Vs the limit', 'Vs last week', 'Room to the limit', 'Will it stay within?']);
    expect(card.cells[0]!.value).toBe('Inside it');
    expect(card.cells[2]!.value).toBe('2.7 pts of room');
    // Rising 0.1 a week from 2.3% in week 13: about 6.3% by week 53, over the 5% limit.
    expect(card.cells[3]!.value).toMatch(/Unlikely|Very unlikely/);
  });
});

describe('the scorecard on the example', () => {
  const today = new Date('2026-11-05T12:00:00Z');
  const s = buildPlatformOrg(today);
  const cycle = s.cycles[0]!;
  const week = currentWeek(cycle, today);
  const card = (id: string) => {
    const g = s.goals.find((x) => x.id === id)!;
    return goalScorecard(g, cycle, s.checkIns, week, goalStatus(g, cycle, s.checkIns, today).status === 'stale');
  };
  it('lead time for changes: behind plan and very unlikely to reach 24 hours', () => {
    const c = card('ns-lead');
    expect(c.cells[0]!.value).toMatch(/^\d+ hours behind plan$/);
    expect(c.cells[2]!.sub).toBe('target 24 hours');
    expect(c.cells[3]!.label).toBe('Will it hit 24?');
    expect(['Unlikely', 'Very unlikely']).toContain(c.cells[3]!.value);
  });
  it('dated stages: done, late, and the next one due', () => {
    expect(card('lead-mq').cells.map((x) => x.label)).toEqual(['Stages done', 'Stages behind', 'Next stage']);
    expect(card('lead-mq').cells[0]!.value).toBe('2 of 4');
  });
  it('every goal gets a card that never says a percentage chance', () => {
    for (const g of s.goals) {
      const c = goalScorecard(g, cycle, s.checkIns, week, false);
      expect(c.cells.length).toBeGreaterThanOrEqual(3);
      const hit = c.cells.find((x) => x.key === 'hit');
      if (hit) expect(hit.value).toMatch(/^(Likely|Possible|Unlikely|Very unlikely|Too early to say|Can’t say)$/);
    }
  });
});
