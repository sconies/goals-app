// @vitest-environment node
/* Days without an update are never negative (backlog 0v, found by the drill): a goal whose plan starts in week 5 has
   0 days without an update in weeks 3 and 4, not −11 and −4, and counts from its start once it comes. */
import { CYCLE, metric } from '../spec/examples';
import { weekDate } from './plan';
import { daysWithoutUpdate } from './status';
import type { Goal } from './types';

describe('days without an update before a plan starts (0v)', () => {
  const g = metric(10, 20, 'straight', { createdAt: `${CYCLE.startDate}T09:00:00Z`, plan: { start: 10, target: 20, shape: 'straight', fromWeek: 5 } }) as Goal;
  const on = (week: number, plusDays = 0) => new Date(new Date(`${weekDate(CYCLE, week)}T12:00:00Z`).getTime() + plusDays * 86_400_000);
  it('is 0 before the plan starts, never below', () => {
    expect([on(3), on(4)].map((d) => daysWithoutUpdate(g, CYCLE, null, d))).toEqual([0, 0]);
  });
  it('counts from the plan’s start once it comes', () => {
    expect(daysWithoutUpdate(g, CYCLE, null, on(5, 3))).toBe(3);
  });
});
