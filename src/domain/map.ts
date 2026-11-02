/* The goal map: every goal as a node, laid out as trees (north stars at the top, the goals that feed them below),
   solid lines for "feeds into", dotted lines for "also helps", and the critical path: from each top goal, the chain
   of inputs most likely to make it miss. Pure functions; the screen draws them. */
import { RANK } from './status';
import type { DisplayStatus, Goal } from './types';

export interface MapNode {
  id: string; goal: Goal; depth: number; x: number; y: number; children: number; collapsed: boolean;
  /** For inputs stacked in columns under a goal with many: the x of the line down their left side that joins them to it. */
  bus?: number;
}
export interface MapEdge { id: string; from: string; to: string; kind: 'feeds' | 'helps'; critical: boolean }

export const NODE_W = 240;
export const NODE_H = 96;
const GAP_X = 32;
const GAP_Y = 72;
/** Stacked inputs sit this far in from their column's left edge (room for the line that joins them) and this far apart. */
const BUS_INDENT = 28;
const STACK_GAP = 40;

/** How much a goal's state threatens what it feeds: off track most, then at risk or gone quiet; on track or done not at all. */
const threat = (s: DisplayStatus) => (s === 'off' ? 4 : s === 'risk' || s === 'stale' ? 2 : s === 'none' ? 1 : 0);

/**
 * The critical path from each top goal: at each step, the input most likely to sink it, weighing how badly it's
 * doing by how much it's expected to move its parent (its estimated effect, as a share of its siblings'). The path
 * stops where nothing below is at risk. Returns the goal ids on any critical path.
 */
export function criticalPath(goals: Goal[], statusOf: (g: Goal) => DisplayStatus): Set<string> {
  const kids = new Map<string, Goal[]>();
  for (const g of goals) if (g.parentId) kids.set(g.parentId, [...(kids.get(g.parentId) ?? []), g]);
  const on = new Set<string>();
  const roots = goals.filter((g) => !g.parentId || !goals.some((p) => p.id === g.parentId));
  for (const root of roots) {
    let at: Goal | undefined = root;
    const seen = new Set<string>();
    const path: string[] = [];
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      path.push(at.id);
      const children: Goal[] = kids.get(at.id) ?? [];
      const total = children.reduce((n, c) => n + Math.max(0, c.effect ?? 0), 0);
      let best: Goal | undefined, bestScore = 0;
      for (const c of children) {
        const share = total > 0 ? Math.max(0, c.effect ?? 0) / total : 1 / children.length;
        const score = threat(statusOf(c)) * (0.5 + share);
        if (score > bestScore || (score === bestScore && best && RANK[statusOf(c)] > RANK[statusOf(best)])) { best = c; bestScore = score; }
      }
      at = bestScore > 0 ? best : undefined;
    }
    // A path is only critical if it reaches a goal in trouble.
    if (path.length > 1 || threat(statusOf(root)) > 0) path.forEach((id) => on.add(id));
  }
  return on;
}

/** Ancestors of every goal that needs attention, so a filtered map still shows what they feed. */
export function withAncestors(goals: Goal[], ids: Set<string>): Set<string> {
  const out = new Set(ids);
  const byId = new Map(goals.map((g) => [g.id, g]));
  for (const id of ids) {
    let p = byId.get(id)?.parentId;
    const seen = new Set<string>();
    while (p && !seen.has(p)) { seen.add(p); out.add(p); p = byId.get(p)?.parentId ?? null; }
  }
  return out;
}

/**
 * A tidy top-down layout: leaves side by side, each parent centred over its children, trees next to each other.
 * Collapsed goals hide what feeds them; `only` limits the map to some goals.
 */
export function layout(goals: Goal[], opts: { collapsed?: Set<string>; only?: Set<string>; order?: (a: Goal, b: Goal) => number; stack?: number } = {}): MapNode[] {
  const shown = opts.only ? goals.filter((g) => opts.only!.has(g.id)) : goals;
  const ids = new Set(shown.map((g) => g.id));
  const kids = new Map<string, Goal[]>();
  for (const g of shown) if (g.parentId && ids.has(g.parentId)) kids.set(g.parentId, [...(kids.get(g.parentId) ?? []), g]);
  if (opts.order) for (const l of kids.values()) l.sort(opts.order);
  const roots = shown.filter((g) => !g.parentId || !ids.has(g.parentId)).sort((a, b) => (a.level === 'north-star' ? 0 : 1) - (b.level === 'north-star' ? 0 : 1) || (opts.order?.(a, b) ?? 0));
  const out: MapNode[] = [];
  let slot = 0;
  const seen = new Set<string>();
  const place = (g: Goal, depth: number): number => {
    seen.add(g.id);
    const all = (kids.get(g.id) ?? []).filter((c) => !seen.has(c.id));
    const collapsed = !!opts.collapsed?.has(g.id) && all.length > 0;
    let x: number;
    const leaf = (c: Goal) => !(kids.get(c.id) ?? []).some((k) => !seen.has(k.id)) || !!opts.collapsed?.has(c.id);
    if (!all.length || collapsed) x = slot++;
    else if (opts.stack && all.length > opts.stack + 1 && all.every(leaf)) {
      // Many inputs and none with inputs of its own: columns of up to `stack`, worst first down the first column, rather
      // than one long row. Each column has a line down its left that joins its goals to this one, so no line crosses a goal.
      const per = opts.stack, cols = Math.ceil(all.length / per), start = slot, SLOT = NODE_W + GAP_X + BUS_INDENT;
      // Columns are a little wider than a normal slot, to make room for the line; count them in normal slots.
      const width = Math.ceil((cols * SLOT) / (NODE_W + GAP_X));
      const left = start * (NODE_W + GAP_X);
      all.forEach((c, i) => {
        seen.add(c.id);
        const cx = left + Math.floor(i / per) * SLOT, row = i % per;
        out.push({ id: c.id, goal: c, depth: depth + 1, x: cx + BUS_INDENT, y: (depth + 1) * (NODE_H + GAP_Y) + row * (NODE_H + STACK_GAP), children: (kids.get(c.id) ?? []).length, collapsed: !!opts.collapsed?.has(c.id) && (kids.get(c.id) ?? []).length > 0, bus: cx + 8 });
      });
      slot += width;
      // Centre this goal over its columns.
      const mid = left + ((cols - 1) * SLOT + BUS_INDENT) / 2;
      out.push({ id: g.id, goal: g, depth, x: mid, y: depth * (NODE_H + GAP_Y), children: all.length, collapsed });
      return mid / (NODE_W + GAP_X);
    } else { const xs = all.map((c) => place(c, depth + 1)); x = (xs[0]! + xs[xs.length - 1]!) / 2; }
    out.push({ id: g.id, goal: g, depth, x: x * (NODE_W + GAP_X), y: depth * (NODE_H + GAP_Y), children: all.length, collapsed });
    return x;
  };
  for (const r of roots) { if (!seen.has(r.id)) { place(r, 0); slot += 0.5; } }
  return out;
}

/** Lines between the goals on the map: feeds into (solid) and also helps (dotted). */
export function edges(nodes: MapNode[], critical: Set<string>): MapEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const out: MapEdge[] = [];
  for (const n of nodes) {
    const g = n.goal;
    if (g.parentId && ids.has(g.parentId)) out.push({ id: `f-${g.id}`, from: g.id, to: g.parentId, kind: 'feeds', critical: critical.has(g.id) && critical.has(g.parentId) });
    for (const h of g.alsoHelps ?? []) if (ids.has(h) && h !== g.parentId) out.push({ id: `h-${g.id}-${h}`, from: g.id, to: h, kind: 'helps', critical: false });
  }
  return out;
}

/** For narrow screens: the same trees, one goal per row, indented under the goal each feeds. */
export function layoutIndented(goals: Goal[], opts: { collapsed?: Set<string>; only?: Set<string>; order?: (a: Goal, b: Goal) => number } = {}): MapNode[] {
  const shown = opts.only ? goals.filter((g) => opts.only!.has(g.id)) : goals;
  const ids = new Set(shown.map((g) => g.id));
  const kids = new Map<string, Goal[]>();
  for (const g of shown) if (g.parentId && ids.has(g.parentId)) kids.set(g.parentId, [...(kids.get(g.parentId) ?? []), g]);
  if (opts.order) for (const l of kids.values()) l.sort(opts.order);
  const roots = shown.filter((g) => !g.parentId || !ids.has(g.parentId)).sort((a, b) => (a.level === 'north-star' ? 0 : 1) - (b.level === 'north-star' ? 0 : 1) || (opts.order?.(a, b) ?? 0));
  const out: MapNode[] = [];
  const seen = new Set<string>();
  const place = (g: Goal, depth: number) => {
    seen.add(g.id);
    const all = (kids.get(g.id) ?? []).filter((c) => !seen.has(c.id));
    const collapsed = !!opts.collapsed?.has(g.id) && all.length > 0;
    out.push({ id: g.id, goal: g, depth, x: depth * 36, y: out.length * (NODE_H + 28), children: all.length, collapsed });
    if (!collapsed) all.forEach((c) => place(c, depth + 1));
  };
  for (const r of roots) if (!seen.has(r.id)) place(r, 0);
  return out;
}
