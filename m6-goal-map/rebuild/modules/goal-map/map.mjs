// The goal map's rules (spec/core/rules/map.md), pure: no screen, no store. The server reads them and the page's own
// script runs this same file (inlined), so each rule lives once.
// A goal here is { id, key, title, parentId, alsoHelps, effect, status } with status a code from A goal's status.

export const THREAT = { off: 4, risk: 2, stale: 2 };
// a group's status (status.md, `worst`): ranks and the tie order
export const GROUP_RANK = { off: 3, risk: 2, stale: 2, on: 1, none: 0, unmeasured: 0, planned: 0, done: 0 };
export const TIE_ORDER = ['off', 'risk', 'stale', 'none', 'unmeasured', 'on', 'planned', 'done'];
export const WORDS = { on: 'on track', risk: 'at risk', off: 'off track', stale: 'no recent update', none: 'no check-in yet', planned: 'not started', unmeasured: 'not measured yet', done: 'done' };

export function worst(statuses) {
  if (!statuses.length) return 'none';
  if (statuses.every((s) => s === 'done')) return 'done';
  let best = null;
  for (const s of statuses) {
    if (best === null) { best = s; continue; }
    const a = GROUP_RANK[s] ?? 0, b = GROUP_RANK[best] ?? 0;
    if (a > b || (a === b && TIE_ORDER.indexOf(s) < TIE_ORDER.indexOf(best))) best = s;
  }
  return best;
}

export function childrenOf(goals) {
  const ids = new Set(goals.map((g) => g.id));
  const kids = new Map();
  for (const g of goals) if (g.parentId && ids.has(g.parentId)) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g); }
  return kids;
}
export function topsOf(goals) {
  const ids = new Set(goals.map((g) => g.id));
  return goals.filter((g) => !g.parentId || !ids.has(g.parentId));
}

// The critical path: from each top goal, step down to the input most likely to make it miss.
// Score = threat × (½ + share of the siblings' estimated effect; equal shares when none is set).
// Returns the paths that reach a goal in trouble, each a list of ids from the top down.
export function criticalPath(goals) {
  const kids = childrenOf(goals);
  const out = [];
  for (const top of topsOf(goals)) {
    const path = [top]; let cur = top;
    for (;;) {
      const ks = kids.get(cur.id) || [];
      if (!ks.length) break;
      const total = ks.reduce((s, k) => s + Math.abs(Number(k.effect) || 0), 0);
      const share = (k) => (total > 0 ? Math.abs(Number(k.effect) || 0) / total : 1 / ks.length);
      let best = null, bs = 0;
      for (const k of ks) {
        const s = (THREAT[k.status] || 0) * (0.5 + share(k));
        if (s <= 0) continue;
        if (!best || s > bs + 1e-9 || (Math.abs(s - bs) <= 1e-9 && (THREAT[k.status] || 0) > (THREAT[best.status] || 0))) { best = k; bs = s; }
      }
      if (!best) break;
      path.push(best); cur = best;
    }
    if (path.some((g) => THREAT[g.status])) out.push(path.map((g) => g.id));
  }
  return out;
}
export const onPathSet = (paths) => new Set(paths.flat());

// What the map shows: every top goal; under a goal everything once opened (and below it, unless shut), nothing once
// shut, otherwise only its next step on the critical path. `all` unfolds every goal (a searched or filtered Goals).
export function shownOnMap(goals, { opened = new Set(), shut = new Set(), paths = criticalPath(goals), all = false } = {}) {
  const kids = childrenOf(goals);
  const next = new Map();
  for (const p of paths) for (let i = 0; i < p.length - 1; i++) next.set(p[i], p[i + 1]);
  const out = [];
  const visit = (g, inherited) => {
    out.push(g.id);
    if (shut.has(g.id)) return;
    const open = all || inherited || opened.has(g.id);
    for (const k of kids.get(g.id) || []) if (open || next.get(g.id) === k.id) visit(k, open);
  };
  for (const t of topsOf(goals)) visit(t, false);
  return out;
}
// how many inputs under a goal the map still hides (its fold button's count)
export function hiddenUnder(goals, id, shown) {
  const kids = childrenOf(goals); const s = new Set(shown); let n = 0;
  const walk = (x) => { for (const k of kids.get(x) || []) { if (!s.has(k.id)) n++; walk(k.id); } };
  walk(id); return n;
}
export function descendants(goals, id) {
  const kids = childrenOf(goals); const out = [];
  const walk = (x) => { for (const k of kids.get(x) || []) { out.push(k); walk(k.id); } };
  walk(id); return out;
}
export function ancestors(goals, id) {
  const by = new Map(goals.map((g) => [g.id, g])); const out = []; let g = by.get(id); const seen = new Set();
  while (g && g.parentId && by.has(g.parentId) && !seen.has(g.parentId)) { seen.add(g.parentId); g = by.get(g.parentId); out.push(g.id); }
  return out;
}

// What's under a goal: everything feeding it at any depth (a goal with no check-in yet, or proposed, not counted).
export function rollup(goals, id) {
  const under = descendants(goals, id).filter((g) => g.status !== 'none' && !g.proposed);
  if (!under.length) return null;
  const st = under.map((g) => g.status);
  const status = worst(st);
  const behind = ['off', 'risk', 'stale'].map((s) => [s, st.filter((x) => x === s).length]).filter(([, n]) => n);
  const text = behind.length ? behind.map(([s, n]) => `${n} ${WORDS[s]}`).join(', ')
    : st.every((s) => s === 'done') ? `All ${st.length} done` : `None behind: ${WORDS[status]}`;
  return { status, text, count: under.length };
}
export const rollupText = (goals, id) => { const r = rollup(goals, id); return r ? r.text : ''; };

// A tree in trouble: its top goal and everything under it rank 2 or worse as a group.
export function troubled(goals) {
  const out = new Set();
  for (const t of topsOf(goals)) {
    const st = [t, ...descendants(goals, t.id)].filter((g) => g.status !== 'none' && !g.proposed).map((g) => g.status);
    if ((GROUP_RANK[worst(st)] || 0) >= 2) out.add(t.id);
  }
  return out;
}

// Finding a goal by name or key, best first.
export function findOnMap(goals, q) {
  const raw = String(q || '').trim().toLowerCase();
  if (!raw) return [];
  const byTitle = (a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0);
  const out = []; const seen = new Set();
  const add = (list) => { for (const g of list) if (!seen.has(g.id)) { seen.add(g.id); out.push(g); } };
  const keyNum = (g) => String(g.key || '').replace(/\D/g, '');
  const m = /^g?\s*-?\s*(\d+)$/.exec(raw);
  if (m) add(goals.filter((g) => keyNum(g) === String(Number(m[1]))));
  add(goals.filter((g) => g.title.toLowerCase().startsWith(raw)).sort(byTitle));
  const words = raw.split(/\s+/).filter(Boolean);
  add(goals.filter((g) => words.every((w) => g.title.toLowerCase().includes(w))).sort(byTitle));
  const kq = raw.replace(/\s+/g, '');
  add(goals.filter((g) => String(g.key || '').toLowerCase().startsWith(kq)));
  return out;
}

// ---------- drawing (a choice, not a rule: any layout where Fit all shows every goal, trees in order, conforms) ----------
export const NODE = { w: 220, h: 112, gx: 28, gy: 64, rowGap: 72 };
// one tree top-down, parents centred over the goals that feed them; returns {pos: Map id→{x,y}, w, h}
export function layoutTree(goals, topId, shown) {
  const s = new Set(shown); const kids = childrenOf(goals.filter((g) => s.has(g.id)));
  const pos = new Map(); let cursor = 0; let depthMax = 0;
  const place = (id, d) => {
    depthMax = Math.max(depthMax, d);
    const ks = kids.get(id) || [];
    if (!ks.length) { pos.set(id, { x: cursor, y: d * (NODE.h + NODE.gy) }); cursor += NODE.w + NODE.gx; return; }
    for (const k of ks) place(k.id, d + 1);
    const a = pos.get(ks[0].id).x, b = pos.get(ks[ks.length - 1].id).x;
    pos.set(id, { x: (a + b) / 2, y: d * (NODE.h + NODE.gy) });
  };
  place(topId, 0);
  return { pos, w: cursor - NODE.gx, h: (depthMax + 1) * NODE.h + depthMax * NODE.gy };
}
// the trees in order, wrapped into rows: of every place the rows could break, the one drawn largest in the window
export function layout(goals, shown, { width = 1200, height = 800, pad = 24 } = {}) {
  const s = new Set(shown);
  const trees = topsOf(goals).filter((t) => s.has(t.id)).map((t) => ({ id: t.id, ...layoutTree(goals, t.id, shown) }));
  let best = null;
  const tryMax = [...new Set(trees.map((_, i) => trees.slice(0, i + 1).reduce((a, t) => a + t.w + NODE.gx * 2, 0)))];
  tryMax.push(Math.max(...trees.map((t) => t.w), 1));
  for (const max of tryMax) {
    const rows = []; let row = [], rw = 0;
    for (const t of trees) { if (row.length && rw + t.w > max + 1) { rows.push(row); row = []; rw = 0; } row.push(t); rw += t.w + NODE.gx * 2; }
    if (row.length) rows.push(row);
    const W = Math.max(...rows.map((r) => r.reduce((a, t) => a + t.w + NODE.gx * 2, 0) - NODE.gx * 2), 1);
    const H = rows.reduce((a, r) => a + Math.max(...r.map((t) => t.h)), 0) + NODE.rowGap * (rows.length - 1);
    const scale = Math.min((width - pad * 2) / W, (height - pad * 2) / H);
    if (!best || scale > best.scale + 1e-9) best = { rows, W, H, scale };
  }
  const pos = new Map(); let y = 0;
  for (const r of best ? best.rows : []) {
    let x = 0;
    for (const t of r) { for (const [id, p] of t.pos) pos.set(id, { x: x + p.x, y: y + p.y }); x += t.w + NODE.gx * 2; }
    y += Math.max(...r.map((t) => t.h)) + NODE.rowGap;
  }
  return { pos, w: best ? best.W : 0, h: best ? best.H : 0, fit: best ? Math.min(1, best.scale) : 1 };
}
// on a phone: the same map indented, one goal per row
export function layoutIndented(goals, shown, { rowH = 96, indent = 18 } = {}) {
  const s = new Set(shown); const sub = goals.filter((g) => s.has(g.id)); const kids = childrenOf(sub);
  const pos = new Map(); let i = 0; let maxD = 0;
  const visit = (g, d) => { maxD = Math.max(maxD, d); pos.set(g.id, { x: d * indent, y: i * rowH, depth: d }); i++; for (const k of kids.get(g.id) || []) visit(k, d + 1); };
  for (const t of topsOf(sub)) visit(t, 0);
  return { pos, h: i * rowH, rowH, indent, maxD };
}
