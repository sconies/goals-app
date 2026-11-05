// @vitest-environment node
import { seed } from '../data/seed';
import { findGoal, keyNumber, lastKey, nextKey, settleKeys, withKeys } from './goalKey';
import { moveColumn, parseLayout, visibleColumns } from './tableLayout';
import type { Goal } from './types';

const s = seed(new Date('2026-10-30T12:00:00Z'));
const bare = (g: Goal): Goal => { const { key: _k, ...rest } = g; return rest as Goal; };

describe('goal keys', () => {
  it('reads keys loosely and writes them one way', () => {
    expect(['G-12', 'g-12', 'g12', ' G12 '].map(keyNumber)).toEqual([12, 12, 12, 12]);
    expect(['G-', 'goal-12', '12', '', null].map(keyNumber)).toEqual([null, null, null, null, null]);
    expect(nextKey(s.goals)).toBe('G-14');
    expect(nextKey(s.goals, 30)).toBe('G-31');
    expect(lastKey([])).toBe(0);
  });

  it('keeps the keys goals have and numbers the rest after them, oldest first', () => {
    const mixed = [s.goals[0]!, bare(s.goals[1]!), { ...s.goals[2]!, key: 'G-20' }, bare(s.goals[3]!)];
    expect(withKeys(mixed).map((g) => g.key)).toEqual(['G-1', 'G-21', 'G-20', 'G-22']);
  });

  it('gives a goal carried into another cycle before keys existed the key of the goal it continues', () => {
    const last = { ...bare(s.goals[5]!), id: 'cfr-last', cycleId: 'last', createdAt: '2025-01-01T00:00:00.000Z' };
    const keyed = withKeys([last, ...s.goals.map(bare)]);
    expect(keyed.find((g) => g.id === 'cfr')!.key).toBe(keyed.find((g) => g.id === 'cfr-last')!.key);
    expect(new Set(keyed.filter((g) => g.cycleId === 'cycle').map((g) => g.key)).size).toBe(s.goals.length);
  });

  it('settles a save: stored goals keep their keys, new goals keep a free key or take the next', () => {
    const fresh = (id: string, key?: string): Goal => ({ ...s.goals[0]!, id, ...(key ? { key } : {}) });
    const out = settleKeys(s.goals, [fresh('x', 'G-1'), fresh('y', 'G-30'), bare(fresh('z')), { ...s.goals[4]!, key: 'G-77' }]);
    expect(out.map((g) => g.key)).toEqual(['G-31', 'G-30', 'G-32', 'G-5']);
    expect(findGoal(out, 'g-30')?.id).toBe('y');
  });
});

describe('table layouts', () => {
  it('keeps the name column first, whatever the order says', () => {
    const head = ['ID', 'Request', 'Goals', 'Status'];
    expect(visibleColumns('requests', head, ['Status', 'Request', 'Goals'])).toEqual(['Request', 'ID', 'Status', 'Goals']);
    expect(moveColumn(['a', 'b', 'c'], 'a', 9)).toEqual(['b', 'c', 'a']);
  });
  it('reads only the tables there are', () => {
    expect(parseLayout('table=goals&c=Owner')?.cols).toEqual(['Owner']);
    expect(parseLayout('table=nope')).toBeNull();
    expect(parseLayout('status=off')).toBeNull();
  });
});
