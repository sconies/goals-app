// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { bounds, criticalPath, edges, findOnMap, layout, NODE_H, NODE_W, pack, rollup, rollupText, shownOnMap, troubled, withAncestors } from './map';
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

  describe('at scale (126 goals)', () => {
    const critical = criticalPath(s.goals, statusOf);
    const roots = s.goals.filter((g) => !g.parentId);
    it('opens folded to the top goals, with only the critical path drawn beneath them', () => {
      const shown = shownOnMap(s.goals, critical, { open: new Set(), shut: new Set(), trail: true });
      expect(roots.every((r) => shown.has(r.id))).toBe(true);
      expect([...shown].every((id) => critical.has(id) || roots.some((r) => r.id === id))).toBe(true);
      expect(shown.has('lead-mq')).toBe(true);
      expect(shown.size).toBeLessThan(s.goals.length / 2);
      // Without the trail, only the top goals; opened, all of a goal's inputs; shut, none of them.
      expect(shownOnMap(s.goals, critical, { open: new Set(), shut: new Set(), trail: false }).size).toBe(roots.length);
      const open = shownOnMap(s.goals, critical, { open: new Set(['ns-lead']), shut: new Set(), trail: true });
      expect(s.goals.filter((g) => g.parentId === 'ns-lead').every((g) => open.has(g.id))).toBe(true);
      expect(shownOnMap(s.goals, critical, { open: new Set(), shut: new Set(['ns-lead']), trail: true }).has('lead-merge')).toBe(false);
    });
    it('wraps the trees into rows, so Fit all fits every goal at a size that can be read', () => {
      const all = layout(s.goals, { stack: 3 });
      const wide = bounds(all);
      const packed = pack(all, 1600, 800);
      const b = bounds(packed);
      // Unpacked, twelve trees in a row only fit 1600px at under a fifth of full size; packed, at well over twice that.
      const zoom = (k: typeof b) => Math.min(1600 / (k.maxX - k.minX), 800 / (k.maxY - k.minY));
      expect(zoom(wide)).toBeLessThan(0.2);
      expect(zoom(b)).toBeGreaterThan(zoom(wide) * 2);
      expect(packed).toHaveLength(all.length);
      // Nothing overlaps.
      const hit = (a: { x: number; y: number }, c: { x: number; y: number }) => Math.abs(a.x - c.x) < NODE_W && Math.abs(a.y - c.y) < NODE_H;
      expect(packed.some((n, i) => packed.some((m, j) => j > i && hit(n, m)))).toBe(false);
      // Folded to the top goals and their critical paths, the whole map fits a 1600 × 800 window at a readable size.
      const folded = layout(s.goals, { stack: 3, only: shownOnMap(s.goals, critical, { open: new Set(), shut: new Set(), trail: true }) });
      expect(zoom(bounds(pack(folded, 1600, 800)))).toBeGreaterThanOrEqual(0.6);
    });
    it('gives a parent the worst status of everything under it, with the List’s counts', () => {
      const r = rollup(s.goals.find((g) => g.id === 'ns-lead')!, s.goals, statusOf)!;
      expect(r.total).toBe(16);
      expect(r.worst).toBe(r.counts[0]![0]);
      expect(r.counts.reduce((n, [, c]) => n + c, 0)).toBeLessThanOrEqual(16);
      expect(rollupText(r)).toMatch(/^\d+ (off track|at risk|no recent update)/);
      expect(rollup(s.goals.find((g) => g.id === 'lead-mq')!, s.goals, statusOf)).toBeNull();
      expect(rollupText({ worst: 'on', total: 3, counts: [['on', 2], ['done', 1]] })).toBe('None behind: on track');
      expect(rollupText({ worst: 'done', total: 2, counts: [['done', 2]] })).toBe('All 2 done');
    });
    it('keeps only the trees in trouble when asked', () => {
      const bad = roots.filter((r) => troubled(r, s.goals, statusOf)).map((r) => r.id);
      expect(bad).toContain('ns-lead');
      expect(bad.length).toBeLessThan(roots.length);
    });
    it('finds a goal by its key or its title', () => {
      const g48 = s.goals.find((g) => g.key === 'G-48')!;
      expect(findOnMap(s.goals, 'G-48')[0]).toBe(g48);
      expect(findOnMap(s.goals, 'g48')[0]).toBe(g48);
      expect(findOnMap(s.goals, 'lead time')[0]!.title.toLowerCase()).toContain('lead time');
      expect(findOnMap(s.goals, '  ')).toEqual([]);
    });
  });
});
