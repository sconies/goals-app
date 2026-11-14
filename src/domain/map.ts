/* The goal map: every goal as a node, laid out as trees (north stars at the top, the goals that feed them below),
   solid lines for "feeds into", dotted lines for "also helps", and the critical path: from each top goal, the chain
   of inputs most likely to make it miss. Pure functions; the screen draws them. */
import { isTop } from './levels';
import type { GoalAttention } from './attention';
import { keyNumber } from './goalKey';
import { LABEL, RANK, worst } from './status';
import type { DisplayStatus, Goal } from './types';
import { rollup, ROLLUP_ORDER, under } from './rollup';

export { rollup, ROLLUP_ORDER, under };

export interface MapNode {
  id: string; goal: Goal; depth: number; x: number; y: number; children: number; collapsed: boolean;
  /** The top goal of the tree this goal is drawn in. */
  tree: string;
  /** For inputs stacked in columns under a goal with many: the x of the line down their left side that joins them to it. */
  bus?: number;
}
export interface MapEdge { id: string; from: string; to: string; kind: 'feeds' | 'helps'; critical: boolean }

export const NODE_W = 240;
/** A node: its status, two lines of title, its numbers, what's under it and its owner. */
export const NODE_H = 148;
const GAP_X = 32;
const GAP_Y = 72;
/** Stacked inputs sit this far in from their column's left edge (room for the line that joins them) and this far apart. */
const BUS_INDENT = 28;
const STACK_GAP = 40;

/** How much a goal's state threatens what it feeds: off track most, then at risk or gone quiet; on track or done not at all. */
// A goal with no check-in yet isn't a threat: its status is unknown, not bad (product review, 3 Nov).
const threat = (s: DisplayStatus) => (s === 'off' ? 4 : s === 'risk' || s === 'stale' ? 2 : 0);

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
  const roots = shown.filter((g) => !g.parentId || !ids.has(g.parentId)).sort((a, b) => (isTop(null, a.level) ? 0 : 1) - (isTop(null, b.level) ? 0 : 1) || (opts.order?.(a, b) ?? 0));
  const out: MapNode[] = [];
  let slot = 0, tree = '';
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
        out.push({ id: c.id, goal: c, depth: depth + 1, x: cx + BUS_INDENT, y: (depth + 1) * (NODE_H + GAP_Y) + row * (NODE_H + STACK_GAP), children: (kids.get(c.id) ?? []).length, collapsed: !!opts.collapsed?.has(c.id) && (kids.get(c.id) ?? []).length > 0, bus: cx + 8, tree });
      });
      slot += width;
      // Centre this goal over its columns.
      const mid = left + ((cols - 1) * SLOT + BUS_INDENT) / 2;
      out.push({ id: g.id, goal: g, depth, x: mid, y: depth * (NODE_H + GAP_Y), children: all.length, collapsed, tree });
      return mid / (NODE_W + GAP_X);
    } else { const xs = all.map((c) => place(c, depth + 1)); x = (xs[0]! + xs[xs.length - 1]!) / 2; }
    out.push({ id: g.id, goal: g, depth, x: x * (NODE_W + GAP_X), y: depth * (NODE_H + GAP_Y), children: all.length, collapsed, tree });
    return x;
  };
  for (const r of roots) { if (!seen.has(r.id)) { tree = r.id; place(r, 0); slot += 0.5; } }
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
  const roots = shown.filter((g) => !g.parentId || !ids.has(g.parentId)).sort((a, b) => (isTop(null, a.level) ? 0 : 1) - (isTop(null, b.level) ? 0 : 1) || (opts.order?.(a, b) ?? 0));
  const out: MapNode[] = [];
  const seen = new Set<string>();
  let tree = '';
  const place = (g: Goal, depth: number) => {
    seen.add(g.id);
    const all = (kids.get(g.id) ?? []).filter((c) => !seen.has(c.id));
    const collapsed = !!opts.collapsed?.has(g.id) && all.length > 0;
    out.push({ id: g.id, goal: g, depth, x: depth * 36, y: out.length * (NODE_H + 28), children: all.length, collapsed, tree });
    if (!collapsed) all.forEach((c) => place(c, depth + 1));
  };
  for (const r of roots) if (!seen.has(r.id)) { tree = r.id; place(r, 0); }
  return out;
}

/**
 * Why a contributing goal is listed as a threat to the goal it feeds, in a line: whether it's on the critical path
 * (worst status among what feeds the most), and what's actually known about it, so a reporting gap reads differently
 * from a delivery problem (product review, 3 Nov).
 */
export function threatReason(a: GoalAttention, onPath: boolean): string {
  const f = a.flags.find((x) => x.kind !== 'due');
  const known = a.status.status === 'stale'
    ? `Last result unknown: no check-in for ${a.status.daysSinceCheckIn} days`
    : f ? `${f.label}: ${f.detail.length > 110 ? f.detail.slice(0, 107).trimEnd() + '…' : f.detail}` : LABEL[a.status.status];
  return (onPath ? 'On the critical path. ' : '') + known;
}

/* ---------- the map at scale (backlog MAP, 9 Nov) ---------- */

/**
 * What the map shows of each tree. Every top goal always; under a goal, all of what feeds it once it is opened, none
 * once it is shut, and otherwise only its next step on the critical path (`trail`), so the map opens on the top goals
 * with the red line still drawn beneath the ones in trouble.
 */
export interface MapFold { open: ReadonlySet<string>; shut: ReadonlySet<string>; trail: boolean }

/** The goals the map draws, folded as `fold` says. */
export function shownOnMap(goals: Goal[], critical: ReadonlySet<string>, fold: MapFold): Set<string> {
  const ids = new Set(goals.map((g) => g.id));
  const kids = new Map<string, Goal[]>();
  for (const g of goals) if (g.parentId && ids.has(g.parentId)) kids.set(g.parentId, [...(kids.get(g.parentId) ?? []), g]);
  const out = new Set<string>();
  const walk = (g: Goal) => {
    if (out.has(g.id)) return;
    out.add(g.id);
    const all = kids.get(g.id) ?? [];
    const show = fold.open.has(g.id) ? all : fold.shut.has(g.id) || !fold.trail || !critical.has(g.id) ? [] : all.filter((c) => critical.has(c.id));
    show.forEach(walk);
  };
  goals.filter((g) => !g.parentId || !ids.has(g.parentId)).forEach(walk);
  return out;
}

/** Every goal above this one, nearest first. */
export function above(goal: Goal, goals: Goal[]): string[] {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const out: string[] = [];
  let p = goal.parentId ? byId.get(goal.parentId) : undefined;
  while (p && !out.includes(p.id) && p.id !== goal.id) { out.push(p.id); p = p.parentId ? byId.get(p.parentId) : undefined; }
  return out;
}




/** The words for a roll-up on a node: the goals behind, worst first, or else the group's status. */
export function rollupText(r: NonNullable<ReturnType<typeof rollup>>): string {
  const behind = r.counts.filter(([k]) => RANK[k] >= 2);
  return behind.length ? behind.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ') : r.worst === 'done' ? `All ${r.total} done` : `None behind: ${LABEL[r.worst].toLowerCase()}`;
}

/** A tree in trouble: its top goal or anything under it is off track, at risk or gone quiet (rank 2 or worse). */
export function troubled(root: Goal, goals: Goal[], statusOf: (g: Goal) => DisplayStatus): boolean {
  return RANK[worst([root, ...under(root, goals)].map(statusOf))] >= 2;
}

/**
 * The goals a search on the map finds, best first: the goal with that key ("G-48", "g48"), then titles starting with
 * the words, then titles holding every word.
 */
export function findOnMap(goals: Goal[], text: string, limit = 8): Goal[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const k = keyNumber(q);
  const words = q.split(/\s+/).filter(Boolean);
  const score = (g: Goal) => {
    if (k != null && keyNumber(g.key) === k) return 0;
    const t = g.title.toLowerCase();
    if (t.startsWith(q)) return 1;
    if (words.every((w) => t.includes(w))) return 2;
    if (k == null && g.key && g.key.toLowerCase().startsWith(q)) return 3;
    return -1;
  };
  return goals.map((g) => ({ g, s: score(g) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.g.title.localeCompare(b.g.title)).slice(0, limit).map((x) => x.g);
}

/** The gap between trees side by side, and between rows of trees. */
const TREE_GAP_X = 64;
const TREE_GAP_Y = 96;

/**
 * Wrap the trees into rows so the whole map has about the shape of the window, rather than one long row of trees
 * that only fits at a size nobody can read. Trees keep their order, left to right, then row by row. Of every way to
 * break the rows, it picks the one that lets the map be drawn largest in a `width` × `height` window.
 */
export function pack(nodes: MapNode[], width: number, height: number): MapNode[] {
  const trees: { id: string; nodes: MapNode[]; minX: number; w: number; h: number }[] = [];
  for (const n of nodes) {
    let t = trees.find((x) => x.id === n.tree);
    if (!t) trees.push((t = { id: n.tree, nodes: [], minX: Infinity, w: 0, h: 0 }));
    t.nodes.push(n);
  }
  if (trees.length < 2 || width <= 0 || height <= 0) return nodes;
  for (const t of trees) {
    t.minX = Math.min(...t.nodes.map((n) => Math.min(n.x, n.bus ?? n.x)));
    t.w = Math.max(...t.nodes.map((n) => n.x)) + NODE_W - t.minX;
    t.h = Math.max(...t.nodes.map((n) => n.y)) + NODE_H;
  }
  const rowsFor = (limit: number) => {
    const rows: (typeof trees)[] = [[]];
    let x = 0;
    for (const t of trees) {
      const row = rows[rows.length - 1]!;
      if (row.length && x + TREE_GAP_X + t.w > limit) { rows.push([t]); x = t.w; } else { x += (row.length ? TREE_GAP_X : 0) + t.w; row.push(t); }
    }
    return rows;
  };
  const size = (rows: (typeof trees)[]) => ({
    w: Math.max(...rows.map((r) => r.reduce((s, t, i) => s + t.w + (i ? TREE_GAP_X : 0), 0))),
    h: rows.reduce((s, r, i) => s + Math.max(...r.map((t) => t.h)) + (i ? TREE_GAP_Y : 0), 0),
  });
  // Each candidate width is where a row could break: the running widths of the trees in order.
  const limits = new Set<number>();
  for (let i = 0; i < trees.length; i++) { let x = 0; for (let j = i; j < trees.length; j++) { x += trees[j]!.w + (j > i ? TREE_GAP_X : 0); limits.add(x); } }
  let best: (typeof trees)[] = [trees], bestZoom = -1;
  for (const limit of [...limits].sort((a, b) => a - b)) {
    const rows = rowsFor(limit), s = size(rows), zoom = Math.min(width / s.w, height / s.h);
    if (zoom > bestZoom + 1e-9) { best = rows; bestZoom = zoom; }
  }
  const out: MapNode[] = [];
  let y = 0;
  for (const row of best) {
    let x = 0;
    for (const t of row) {
      const dx = x - t.minX;
      for (const n of t.nodes) out.push({ ...n, x: n.x + dx, y: n.y + y, ...(n.bus != null ? { bus: n.bus + dx } : {}) });
      x += t.w + TREE_GAP_X;
    }
    y += Math.max(...row.map((t) => t.h)) + TREE_GAP_Y;
  }
  return out;
}

/** The box around some nodes on the map. */
export function bounds(nodes: { x: number; y: number }[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return { minX: Math.min(...nodes.map((p) => p.x)), maxX: Math.max(...nodes.map((p) => p.x)) + NODE_W, minY: Math.min(...nodes.map((p) => p.y)), maxY: Math.max(...nodes.map((p) => p.y)) + NODE_H };
}
