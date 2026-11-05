// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { criticalPath, edges, layout, NODE_W, withAncestors } from './map';
import { currentWeek } from './plan';
import { goalStatus } from './status';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
void currentWeek;
const statusOf = (g: (typeof s.goals)[number]) => goalStatus(g, cycle, s.checkIns, today).status;

describe('the goal map', () => {
  it('draws the critical path through the input most likely to sink each top goal', () => {
    const path = criticalPath(s.goals, statusOf);
    // Lead time is off track; the merge queue, behind merge-to-deploy, is what sinks it: that's the path.
    expect([...path]).toEqual(expect.arrayContaining(['ns-lead', 'lead-merge', 'lead-mq']));
    expect(path.has('lead-review')).toBe(false);
    // Cloud cost is on track, but storage lifecycle, feeding it, has gone quiet.
    expect([...path]).toEqual(expect.arrayContaining(['ns-cost', 'cost-storage']));
    expect(path.has('cost-idle')).toBe(false);
  });
  it('lays out each tree top-down, parents centred over the goals that feed them', () => {
    const nodes = layout(s.goals);
    const head = nodes.find((n) => n.id === 'ns-lead')!;
    const kids = nodes.filter((n) => n.goal.parentId === 'ns-lead');
    expect(kids.every((k) => k.y > head.y)).toBe(true);
    const xs = kids.map((k) => k.x);
    expect(head.x).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2, 5);
    // No two goals in the same place.
    expect(new Set(nodes.map((n) => `${n.x},${n.y}`)).size).toBe(nodes.length);
    expect(Math.min(...nodes.filter((n) => n.depth === 1).map((n, i, a) => (i ? Math.abs(n.x - a[i - 1]!.x) : Infinity)))).toBeGreaterThanOrEqual(NODE_W);
  });
  it('folds a branch away, and can show only what needs attention with what it feeds', () => {
    const folded = layout(s.goals, { collapsed: new Set(['ns-lead']) });
    expect(folded.some((n) => n.goal.parentId === 'ns-lead')).toBe(false);
    expect(folded.find((n) => n.id === 'ns-lead')!.collapsed).toBe(true);
    const only = withAncestors(s.goals, new Set(['lead-mq']));
    expect([...only].sort()).toEqual(['lead-merge', 'lead-mq', 'ns-lead']);
  });
  it('draws feeds-into lines solid and also-helps lines dotted', () => {
    const e = edges(layout(s.goals), criticalPath(s.goals, statusOf));
    expect(e.find((x) => x.from === 'lead-mq' && x.to === 'lead-merge')).toMatchObject({ kind: 'feeds', critical: true });
    expect(e.find((x) => x.from === 'lead-cache' && x.to === 'ns-ci')).toMatchObject({ kind: 'helps', critical: false });
  });
});
