// The goal map's rules (spec/core/rules/map.md), pure: no screen, no store. Runs on the server and in the browser.
// A goal here is { id, key, title, parentId, alsoHelps, effect } and `st` maps an id to its status code.

const WORD = { on: 'on track', risk: 'at risk', off: 'off track', stale: 'no recent update', none: 'no check-in yet', planned: 'not started', unmeasured: 'not measured yet', done: 'done' };
// A goal's status ranks (status.md): lower is better.
const RANK = { done: 0, planned: 0, none: 0, unmeasured: 0, on: 1, risk: 2, stale: 2, off: 3 };
const TIE = ['off', 'risk', 'stale', 'none', 'unmeasured', 'on', 'planned', 'done'];

// A group's status (`worst`, status.md): the core's rule; the core rebuild had no group status, so it lives here for now.
export function worst(list) {
  if (!list.length) return 'none';
  if (list.every((s) => s === 'done')) return 'done';
  const top = Math.max(...list.map((s) => RANK[s] ?? 0));
  return TIE.find((s) => list.includes(s) && (RANK[s] ?? 0) === top);
}

export function forest(goals) {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const kids = new Map(goals.map((g) => [g.id, []]));
  const tops = [];
  for (const g of goals) {
    if (g.parentId && byId.has(g.parentId)) kids.get(g.parentId).push(g.id);
    else tops.push(g.id);
  }
  return { byId, kids, tops };
}
const under = (F, id) => { const out = []; const walk = (x) => { for (const c of F.kids.get(x) || []) { out.push(c); walk(c); } }; walk(id); return out; };
export const descendants = (goals, id, F = forest(goals)) => under(F, id);
export function ancestors(goals, id, F = forest(goals)) {
  const out = []; let g = F.byId.get(id);
  while (g && g.parentId && F.byId.has(g.parentId)) { out.push(g.parentId); g = F.byId.get(g.parentId); }
  return out;
}

// The critical path: from each top goal, step down to the input most likely to make it miss.
const THREAT = (s) => (s === 'off' ? 4 : s === 'risk' || s === 'stale' ? 2 : 0);
function nextStep(F, st, id) {
  const kids = F.kids.get(id) || [];
  if (!kids.length) return null;
  const anyEffect = kids.some((k) => Number(F.byId.get(k).effect) > 0);
  const total = kids.reduce((a, k) => a + (Number(F.byId.get(k).effect) || 0), 0);
  let best = null, bestScore = 0;
  for (const k of kids) {
    const share = anyEffect ? (Number(F.byId.get(k).effect) || 0) / total : 1 / kids.length;
    const score = THREAT(st[k]) * (0.5 + share);
    if (score <= 0) continue;
    if (best === null || score > bestScore + 1e-12 || (Math.abs(score - bestScore) < 1e-12 && (RANK[st[k]] ?? 0) > (RANK[st[best]] ?? 0))) { best = k; bestScore = score; }
  }
  return best;
}
// Every goal on a drawn path, top goal first, tree by tree.
export function criticalPath(goals, st, F = forest(goals)) {
  const out = [];
  for (const t of F.tops) {
    const path = [t];
    let x = t;
    for (let n = nextStep(F, st, x); n; n = nextStep(F, st, n)) path.push(n);
    if (path.some((id) => THREAT(st[id]) > 0) && path.length > 1) out.push(...path);
  }
  return out;
}
export function pathSteps(goals, st, F = forest(goals)) {
  const on = new Set(criticalPath(goals, st, F));
  const step = new Map();
  for (const id of on) { const n = nextStep(F, st, id); if (n && on.has(n)) step.set(id, n); }
  return step;
}

// What the map shows: every top goal; under a goal, everything once opened, nothing once shut, else its next path step.
export function shownOnMap(goals, st, fold = {}, F = forest(goals)) {
  const opened = new Set(fold.opened || []), shut = new Set(fold.shut || []);
  const step = pathSteps(goals, st, F);
  const out = [];
  const walk = (id, open) => {
    out.push(id);
    if (shut.has(id)) return;
    const all = fold.all || open || opened.has(id);
    for (const k of F.kids.get(id) || []) if (all || step.get(id) === k) walk(k, all);
  };
  for (const t of F.tops) walk(t, false);
  return out;
}

// What's under a goal: everything feeding it, at any depth; no check-in yet isn't counted.
export function rollup(goals, st, id, F = forest(goals)) {
  const all = under(F, id);
  if (!all.length) return null;
  const counted = all.filter((x) => st[x] !== 'none');
  const status = worst(counted.map((x) => st[x]));
  const n = (s) => counted.filter((x) => st[x] === s).length;
  const behind = ['off', 'risk', 'stale'].filter((s) => n(s)).map((s) => `${n(s)} ${WORD[s]}`);
  let text;
  if (behind.length) text = behind.join(', ');
  else if (counted.length && counted.every((x) => st[x] === 'done')) text = `All ${counted.length} done`;
  else text = `None behind: ${WORD[status]}`;
  return { status, text, count: all.length };
}
export const rollupText = (goals, st, id) => { const r = rollup(goals, st, id); return r ? `${r.status}: ${r.text}` : ''; };

// A tree in trouble: the group's status of its top goal and everything under it ranks 2 or worse.
export function troubled(goals, st, F = forest(goals)) {
  return F.tops.filter((t) => (RANK[worst([t, ...under(F, t)].filter((x) => st[x] !== 'none').map((x) => st[x]))] ?? 0) >= 2);
}

// Finding a goal by key or name, best first.
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
export function findOnMap(goals, q) {
  const t = fold(q).trim();
  if (!t) return [];
  const qw = words(t);
  const km = t.match(/^g\s*-?\s*(\d+)$/);
  const keyNum = (g) => Number(String(g.key || '').replace(/^\D+/, ''));
  const az = (a, b) => fold(a.title).localeCompare(fold(b.title));
  const tiers = [[], [], [], []];
  for (const g of goals) {
    const tw = words(g.title);
    if (km && keyNum(g) === Number(km[1])) tiers[0].push(g);
    else if (qw.length && qw.every((w, i) => (i < qw.length - 1 ? tw[i] === w : (tw[i] || '').startsWith(w)))) tiers[1].push(g);
    else if (qw.length && qw.every((w) => tw.some((x) => x.startsWith(w)))) tiers[2].push(g);
    else if (fold(g.key).replace(/[^a-z0-9]/g, '').startsWith(t.replace(/[^a-z0-9]/g, ''))) tiers[3].push(g);
  }
  return tiers.flatMap((x) => x.sort(az)).map((g) => g.id);
}

// Drawing: each tree top-down, parents centred over the goals that feed them; the trees wrap into rows.
export function layoutTree(F, root, shown, size) {
  const { w, h, gx, gy } = size;
  const pos = {};
  let x = 0;
  const place = (id, depth) => {
    const kids = (F.kids.get(id) || []).filter((k) => shown.has(k));
    if (!kids.length) { pos[id] = { x, y: depth * (h + gy) }; x += w + gx; return; }
    for (const k of kids) place(k, depth + 1);
    pos[id] = { x: (pos[kids[0]].x + pos[kids[kids.length - 1]].x) / 2, y: depth * (h + gy) };
  };
  place(root, 0);
  const xs = Object.values(pos);
  return { pos, w: Math.max(...xs.map((p) => p.x)) + w, h: Math.max(...xs.map((p) => p.y)) + h };
}
// Of every place the rows could break, take the one that lets the map be drawn largest in the window.
export function pack(trees, viewW, viewH, gap = 48) {
  if (!trees.length) return { rows: [], w: 0, h: 0, scale: 1 };
  const widest = Math.max(...trees.map((t) => t.w));
  const cands = new Set([widest]);
  for (let i = 0; i < trees.length; i++) { let s = 0; for (let j = i; j < trees.length; j++) { s += trees[j].w + (j > i ? gap : 0); if (s >= widest) cands.add(s); } }
  let best = null;
  for (const limit of cands) {
    const rows = []; let row = [], rw = 0;
    for (const t of trees) {
      const add = (row.length ? gap : 0) + t.w;
      if (row.length && rw + add > limit) { rows.push(row); row = []; rw = 0; }
      row.push(t); rw += (row.length > 1 ? gap : 0) + t.w;
    }
    if (row.length) rows.push(row);
    const W = Math.max(...rows.map((r) => r.reduce((a, t, i) => a + t.w + (i ? gap : 0), 0)));
    const H = rows.reduce((a, r, i) => a + Math.max(...r.map((t) => t.h)) + (i ? gap : 0), 0);
    const scale = Math.min(viewW / W, viewH / H);
    if (!best || scale > best.scale + 1e-9) best = { rows, w: W, h: H, scale };
  }
  return best;
}
export function layout(goals, st, shownIds, view, size = { w: 240, h: 112, gx: 24, gy: 56 }) {
  const F = forest(goals);
  const shown = new Set(shownIds);
  const trees = F.tops.filter((t) => shown.has(t)).map((t) => ({ id: t, ...layoutTree(F, t, shown, size) }));
  const p = pack(trees, view.w, view.h);
  const pos = {};
  let y = 0;
  for (const row of p.rows) {
    let x = 0;
    for (const t of row) { for (const [id, q] of Object.entries(t.pos)) pos[id] = { x: x + q.x, y: y + q.y }; x += t.w + 48; }
    y += Math.max(...row.map((t) => t.h)) + 48;
  }
  return { pos, w: p.w, h: p.h, fit: Math.min(1, p.scale) };
}
// On a phone: the same map indented, one goal per row.
export function layoutIndented(goals, shownIds) {
  const F = forest(goals);
  const shown = new Set(shownIds);
  const out = [];
  const walk = (id, depth) => { if (!shown.has(id)) return; out.push({ id, depth }); for (const k of F.kids.get(id) || []) walk(k, depth + 1); };
  for (const t of F.tops) walk(t, 0);
  return out;
}
