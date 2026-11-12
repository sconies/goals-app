// @vitest-environment node
/* A file too large to save at once, in parts (import spec 2.8; backlog IM6). */
import { partName, splitTables } from './splitFile';
import type { Rec } from './sheets';

const goal = (title: string, extra: Rec = {}): Rec => ({ goal: title, owner: 'Rhea', ...extra });
const ci = (title: string, week: number): Rec => ({ goal: title, week: String(week), value: '1' });

describe('splitTables: a large file in parts that each import on their own', () => {
  it('keeps one part when the file fits, dropping blank rows', () => {
    const parts = splitTables({ goals: [goal('A'), { goal: '', owner: '' }], checkIns: [ci('A', 1)] }, 10);
    expect(parts).toHaveLength(1);
    expect(parts[0]!.goals).toHaveLength(1);
  });

  it('keeps a goal’s check-ins and plan with it, whatever order the file has them in', () => {
    const goals = ['A', 'B', 'C'].map((t, i) => goal(t, { key: `G-${i + 1}` }));
    const checkIns = [ci('C', 1), ci('A', 1), ci('B', 1), ci('A', 2), ci('C', 2), ci('B', 2)];
    const plan = [{ key: 'G-2', week: '1', value: '5' }];
    const parts = splitTables({ goals, plan, checkIns }, 4);
    for (const p of parts) {
      const titles = new Set(p.goals!.map((g) => g.goal));
      expect(p.checkIns!.every((c) => titles.has(c.goal!))).toBe(true);
      expect(p.plan!.every((r) => p.goals!.some((g) => g.key === r.key))).toBe(true);
    }
    expect(parts.flatMap((p) => p.checkIns!)).toHaveLength(6);
  });

  it('puts a goal in the same part as the goal it feeds into, or a later one', () => {
    // The child is first in the file; its parent comes first in the parts.
    const goals = [goal('Child', { 'feeds into': 'Parent' }), goal('Other'), goal('Parent')];
    const parts = splitTables({ goals }, 1);
    const at = (t: string) => parts.findIndex((p) => p.goals!.some((g) => g.goal === t));
    expect(at('Parent')).toBeLessThan(at('Child'));
  });

  it('puts people first, and never splits a goal larger than a part', () => {
    const big = [goal('Big'), ...Array.from({ length: 7 }, (_, i) => ci('Big', i + 1))];
    const parts = splitTables({ people: [{ name: 'Ola', email: 'ola@x.org' }], goals: [big[0]!, goal('Small')], checkIns: big.slice(1) }, 5);
    expect(parts[0]!.people).toHaveLength(1);
    const withBig = parts.find((p) => p.goals!.some((g) => g.goal === 'Big'))!;
    expect(withBig.checkIns).toHaveLength(7);
  });

  it('splits 5,001 changes into two files of at most 5,000 rows', () => {
    const goals = Array.from({ length: 5001 }, (_, i) => goal(`Goal ${i}`));
    const parts = splitTables({ goals }, 5000);
    expect(parts.map((p) => p.goals!.length)).toEqual([5000, 1]);
    expect(partName('plan', 1, 2)).toBe('plan-part-1-of-2');
  });
});
