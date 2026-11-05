import { describe, expect, it } from 'vitest';
import { headingSentence, metricFacts, sayAmount, sayDiff, standingSentence } from './chartStory';
import type { MetricGoal } from './types';

const money = { kind: 'metric', unit: '£k', decimals: 0, plan: { start: 2000, target: 3600, shape: 'linear' } } as unknown as MetricGoal;
const pct = { kind: 'metric', unit: '%', decimals: 0, plan: { start: 70, target: 88, shape: 'linear' } } as unknown as MetricGoal;

describe('chart story in plain words (Lane, 5 Nov)', () => {
  it('says money the way people read it', () => {
    expect(sayAmount(3409, money)).toBe('£3.41m');
    expect(sayAmount(61, money)).toBe('£61k');
    expect(sayAmount(3600, money)).toBe('£3.6m');
    expect(sayDiff(-61, money)).toBe('£61k');
    expect(sayDiff(3, pct)).toBe('3 points');
    expect(sayDiff(1, pct)).toBe('1 point');
  });
  it('heading: the likely end, the range, and how close to the target, in a sentence', () => {
    const s = headingSentence(money, { likely: 3558, low: 3409, high: 3706 }, true, 'by 3 Jan');
    expect(s).toBe('On its recent trend it ends at about £3.56m by 3 Jan (somewhere between £3.41m and £3.71m), just missing its target of £3.6m. Projected by the app from the last eight weeks, not the owner’s date.');
    expect(s).not.toMatch(/→|£k|week \d/);
  });
  it('standing: behind and catching up, compared with a few weeks ago', () => {
    const plan = { ...money, plan: { start: 0, target: 5300, shape: 'linear' } } as unknown as MetricGoal;
    // Plan is 100 a week over 53 weeks: week 43 plan 4300, week 45 plan 4500.
    const s = standingSentence(plan, [{ week: 43, value: 4206 }, { week: 44, value: 4307 }, { week: 45, value: 4439 }], 53);
    expect(s).toMatch(/^£\d+k behind plan and catching up: it was £\d+k behind two weeks ago\.$/);
  });
  it('standing: no arrows, no jargon', () => {
    const s = standingSentence(pct, [{ week: 1, value: 70 }, { week: 2, value: 71 }, { week: 3, value: 71 }], 13) ?? '';
    expect(s).not.toMatch(/→|pts|plan:/);
  });
  it('facts: short rows and a likely-end bar instead of a paragraph', () => {
    const plan = { ...money, plan: { start: 0, target: 3600, shape: 'linear' } } as unknown as MetricGoal;
    const f = metricFacts(plan, [{ week: 43, value: 2850 }, { week: 45, value: 2950 }], 53, { likely: 3558, low: 3409, high: 3706 }, true, 'by the end of the year');
    expect(f.rows.map((r) => r.label)).toEqual(['Against plan', 'Likely end', 'Target']);
    expect(f.rows[1]).toMatchObject({ value: 'about £3.56m', note: 'by the end of the year · could be £3.41m to £3.71m' });
    expect(f.rows[2]).toMatchObject({ value: '£3.6m', note: 'just missing it', tone: 'bad' });
    expect(f.end).toMatchObject({ low: 3409, high: 3706, likely: 3558, mark: 3600, markLabel: 'Target £3.6m' });
    for (const r of f.rows) expect(`${r.value} ${r.note ?? ''}`).not.toMatch(/→|£k|week \d/);
  });
});
