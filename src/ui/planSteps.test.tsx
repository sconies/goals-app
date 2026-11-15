// @vitest-environment jsdom
/* The chart draws the plan the plan table publishes (deep dive, 15 Nov, item 1): one number a week, held through the
   week, from one source (domain/plan planSteps). Before, the chart drew a straight line while the table stepped. */
import { render } from '@testing-library/react';
import { planCheckpoints, planSteps, stepCorners } from '../domain/plan';
import type { MetricGoal } from '../domain/types';
import { MetricChart } from './charts';

const plan = { start: 40, target: 70, shape: 'straight' as const, fromWeek: 46 };
const goal = { id: 'g', kind: 'metric', title: 'Uptime of the build farm', unit: '%', decimals: 0, plan, originalPlan: null, rebaselinedWeek: null } as unknown as MetricGoal;

describe('the plan, as table and chart draw it', () => {
  it('publishes one number a week, and the table’s rows are those numbers', () => {
    const steps = planSteps(plan, 53, 46);
    expect(steps.map((p) => Math.round(p.value))).toEqual([40, 44, 49, 53, 57, 61, 66, 70]);
    for (const w of planCheckpoints(46, 53)) expect(steps.find((p) => p.week === w)).toBeDefined();
  });

  it('turns the weeks into steps: flat through each week, then up to the next', () => {
    const c = stepCorners([{ week: 1, value: 10 }, { week: 2, value: 12 }, { week: 3, value: 15 }]);
    expect(c).toEqual([{ week: 1, value: 10 }, { week: 2, value: 10 }, { week: 2, value: 12 }, { week: 3, value: 12 }, { week: 3, value: 15 }]);
  });

  it('draws the goal page’s plan line as those steps, not a straight line from now to the target', () => {
    const cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
    try {
      const { container } = render(<MetricChart goal={goal} weeks={53} week={46} series={[]} forecast={null} showKey={false} />);
      const pts = container.querySelector('polyline.c-plan')!.getAttribute('points')!.split(' ').map((s) => s.split(',').map(Number) as [number, number]);
      // Every week from 46 on rises straight up at its own x: a riser for each of the seven weekly steps.
      const risers = pts.filter((p, i) => i > 0 && p[0] === pts[i - 1]![0] && p[1] !== pts[i - 1]![1]);
      expect(risers).toHaveLength(7);
      // And no sloped piece anywhere: every piece is flat or straight up.
      expect(pts.every((p, i) => i === 0 || p[0] === pts[i - 1]![0] || p[1] === pts[i - 1]![1])).toBe(true);
    } finally {
      if (cw) Object.defineProperty(HTMLElement.prototype, 'clientWidth', cw);
    }
  });
});
