// @vitest-environment node
import { seed } from '../data/seed';
import { criticalPath, edges, layout, NODE_W, withAncestors } from './map';
import { currentWeek } from './plan';
import { goalStatus } from './status';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
void currentWeek;
const statusOf = (g: (typeof s.goals)[number]) => goalStatus(g, cycle, s.checkIns, today).status;

describe('the goal map', () => {
  it('draws the critical path through the input most likely to sink each top goal', () => {
    const path = criticalPath(s.goals, statusOf);
    // Intake-to-delivery is at risk; of what feeds it, repo access is off track: that's the path.
    expect([...path]).toEqual(expect.arrayContaining(['head', 'access']));
    expect(path.has('triage')).toBe(false);
    // Cloud spend is on track, but idle environments, feeding it, are at risk.
    expect([...path]).toEqual(expect.arrayContaining(['cost', 'idle']));
    expect(path.has('cache')).toBe(false);
  });
  it('lays out each tree top-down, parents centred over the goals that feed them', () => {
    const nodes = layout(s.goals);
    const head = nodes.find((n) => n.id === 'head')!;
    const kids = nodes.filter((n) => n.goal.parentId === 'head');
    expect(kids.every((k) => k.y > head.y)).toBe(true);
    const xs = kids.map((k) => k.x);
    expect(head.x).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2, 5);
    // No two goals in the same place.
    expect(new Set(nodes.map((n) => `${n.x},${n.y}`)).size).toBe(nodes.length);
    expect(Math.min(...nodes.filter((n) => n.depth === 1).map((n, i, a) => (i ? Math.abs(n.x - a[i - 1]!.x) : Infinity)))).toBeGreaterThanOrEqual(NODE_W);
  });
  it('folds a branch away, and can show only what needs attention with what it feeds', () => {
    const folded = layout(s.goals, { collapsed: new Set(['head']) });
    expect(folded.some((n) => n.goal.parentId === 'head')).toBe(false);
    expect(folded.find((n) => n.id === 'head')!.collapsed).toBe(true);
    const only = withAncestors(s.goals, new Set(['access']));
    expect([...only].sort()).toEqual(['access', 'head']);
  });
  it('draws feeds-into lines solid and also-helps lines dotted', () => {
    const e = edges(layout(s.goals), criticalPath(s.goals, statusOf));
    expect(e.find((x) => x.from === 'access' && x.to === 'head')).toMatchObject({ kind: 'feeds', critical: true });
    expect(e.find((x) => x.from === 'cache' && x.to === 'lead')).toMatchObject({ kind: 'helps', critical: false });
  });
});
