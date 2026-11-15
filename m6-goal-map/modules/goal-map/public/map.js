// The Goal map in the browser: draws the goals with the module's rules (rules.mjs), folds, finds, pans, zooms and drags.
import { forest, shownOnMap, pathSteps, rollup, troubled as troubledTops, findOnMap, layout, layoutIndented, ancestors, descendants } from './rules.mjs';

const D = JSON.parse(document.getElementById('map-data').textContent);
const root = document.querySelector('.goal-map');
const canvas = root.querySelector('.map-canvas');
const stage = root.querySelector('.map-stage');
const svg = root.querySelector('svg.edges');
const list = root.querySelector('.map-list');
const story = root.querySelector('.map-story');
const wrap = root.querySelector('.map-wrap');
const countEl = root.querySelector('.map-count');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NODE = { w: 240, h: 124, gx: 24, gy: 56 };

const rows = D.rows;
const byId = new Map(rows.map((r) => [r.id, r]));
const st = Object.fromEntries(rows.map((r) => [r.id, r.status]));
const F = forest(rows);
const S = { opened: new Set(), shut: new Set(), all: false, troubled: D.troubled, selected: null, found: null, scale: 1, tx: 16, ty: 16, moved: {} };
try { S.moved = JSON.parse(localStorage.getItem('faro.map.moved') || '{}'); } catch (e) { S.moved = {}; }
const saveMoved = () => { try { localStorage.setItem('faro.map.moved', JSON.stringify(S.moved)); } catch (e) {} };
const phone = () => matchMedia('(max-width: 760px)').matches;
const statusHtml = (s) => `<span class="status st-${s}">${D.shapes[s] || ''}<span class="st-word">${esc(D.words[s] || s)}</span></span>`;

let view = { goals: rows, shown: [], context: new Set(), steps: new Map() };
function compute() {
  let goals = rows;
  const context = new Set();
  let shown;
  if (D.matchIds) {
    const keep = new Set(D.matchIds);
    for (const id of D.matchIds) for (const a of ancestors(rows, id, F)) if (!keep.has(a)) { keep.add(a); context.add(a); }
    goals = rows.filter((r) => keep.has(r.id));
    shown = goals.map((g) => g.id);
  } else {
    if (S.troubled) {
      const tops = new Set(troubledTops(rows, st, F));
      const inT = new Set(); for (const t of tops) { inT.add(t); for (const d of descendants(rows, t, F)) inT.add(d); }
      goals = rows.filter((r) => inT.has(r.id));
    }
    shown = shownOnMap(goals, st, { opened: S.opened, shut: S.shut, all: S.all });
  }
  view = { goals, shown, context, steps: pathSteps(goals, st), F: forest(goals) };
}

function nodeInner(r) {
  const ru = rollup(view.goals, st, r.id, view.F);
  const kids = view.F.kids.get(r.id) || [];
  const shownSet = new Set(view.shown);
  const hidden = descendants(view.goals, r.id, view.F).filter((x) => !shownSet.has(x)).length;
  const all = descendants(view.goals, r.id, view.F).length;
  const fold = !D.matchIds && kids.length ? `<button type="button" class="fold" data-fold="${hidden ? 'open' : 'shut'}" aria-label="${hidden ? `Show the ${hidden} ${hidden === 1 ? 'goal' : 'goals'} feeding ${esc(r.title)}` : `Hide the ${all} ${all === 1 ? 'goal' : 'goals'} feeding ${esc(r.title)}`}">${hidden ? `+${hidden}` : '−'}</button>` : '';
  const nums = [r.key, r.value && `Now ${r.value}`, r.target && `Target ${r.target}`, r.vsPlan].filter(Boolean).join(' · ');
  return `${r.level === 'north-star' ? '<span class="north">North star · </span>' : ''}${statusHtml(r.status)}<span class="t" title="${esc(r.title)}">${esc(r.title)}</span><span class="meta">${esc(nums)}</span>${ru ? `<span class="meta">Under it: ${statusHtml(ru.status)} · ${esc(ru.text)}</span>` : ''}${view.context.has(r.id) ? '<span class="meta">For context</span>' : ''}${fold}`;
}
const cls = (r) => `${view.steps.has(r.id) || [...view.steps.values()].includes(r.id) ? ' on-path' : ''}${r.status === 'off' ? ' is-off' : ''}${view.context.has(r.id) ? ' context' : ''}${S.found === r.id ? ' found' : ''}`;

let lay = null;
function sizeCanvas() {
  const top = canvas.getBoundingClientRect().top + scrollY;
  canvas.style.height = `${Math.max(360, innerHeight - top - 24)}px`;
}
function drawCanvas(refit) {
  if (refit) sizeCanvas();
  const box = canvas.getBoundingClientRect();
  lay = layout(view.goals, st, view.shown, { w: Math.max(200, box.width - 32), h: Math.max(200, box.height - 32) }, NODE);
  stage.querySelectorAll('.react-flow__node').forEach((n) => n.remove());
  const at = (id) => { const p = lay.pos[id]; const m = S.moved[id] || { dx: 0, dy: 0 }; return { x: p.x + m.dx, y: p.y + m.dy }; };
  const frag = document.createDocumentFragment();
  for (const id of view.shown) {
    const r = byId.get(id); const p = at(id);
    const el = document.createElement('div');
    el.className = 'react-flow__node';
    el.dataset.id = id;
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    el.innerHTML = `<div class="map-node${cls(r)}" tabindex="0" role="button" aria-pressed="${S.selected === id}" aria-label="${esc(r.title)}, ${esc(D.words[r.status])}">${nodeInner(r)}</div>`;
    frag.appendChild(el);
  }
  stage.appendChild(frag);
  const shownSet = new Set(view.shown);
  const crit = new Set([...view.steps.entries()].map(([a, b]) => `${b}>${a}`));
  let paths = '';
  const line = (from, to, c) => { const a = at(from), b = at(to); const x1 = a.x + NODE.w / 2, y1 = a.y, x2 = b.x + NODE.w / 2, y2 = b.y + NODE.h; const my = (y1 + y2) / 2; paths += `<path class="${c}" data-from="${from}" data-to="${to}" d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}"/>`; };
  for (const id of view.shown) {
    const r = byId.get(id);
    if (r.parentId && shownSet.has(r.parentId)) line(id, r.parentId, crit.has(`${id}>${r.parentId}`) ? 'feeds critical' : 'feeds');
    for (const h of r.alsoHelps || []) if (shownSet.has(h)) line(id, h, 'helps');
  }
  svg.innerHTML = paths;
  if (refit) fit();
  else apply();
}
function apply() { stage.style.transform = `translate(${S.tx}px, ${S.ty}px) scale(${S.scale})`; }
function fit() {
  const box = canvas.getBoundingClientRect();
  S.scale = lay.fit;
  S.tx = Math.max(16, (box.width - lay.w * S.scale) / 2); S.ty = 16;
  apply();
}
function readable() { S.scale = Math.max(0.75, Math.min(1, lay.fit)); S.tx = 16; S.ty = 16; apply(); }
function centreOn(id) {
  if (!lay || !lay.pos[id]) return;
  const box = canvas.getBoundingClientRect();
  S.scale = Math.max(S.scale, 0.75);
  const p = lay.pos[id];
  S.tx = box.width / 2 - (p.x + NODE.w / 2) * S.scale; S.ty = box.height / 2 - (p.y + NODE.h / 2) * S.scale;
  apply();
}

function drawList() {
  const rowsIn = layoutIndented(view.goals, view.shown);
  list.innerHTML = rowsIn.map(({ id, depth }) => { const r = byId.get(id); return `<li class="react-flow__node" data-id="${id}"><div class="map-node map-row${cls(r)}" tabindex="0" role="button" aria-pressed="${S.selected === id}" style="padding-left:${12 + depth * 18}px"><div>${nodeInner(r)}</div></div></li>`; }).join('');
}

function drawStory() {
  const r = S.selected && byId.get(S.selected);
  wrap.classList.toggle('has-story', !!r);
  story.hidden = !r;
  if (!r) { story.innerHTML = ''; story.removeAttribute('aria-label'); return; }
  const ru = rollup(rows, st, r.id, F);
  story.setAttribute('aria-label', r.title);
  story.innerHTML = `<h2 tabindex="-1">${esc(r.title)}</h2><p>${statusHtml(r.status)} <span class="meta">${esc(r.key)} · ${esc(r.owner)}</span></p>
<p>${esc([r.value && `Now ${r.value}`, r.target && `Target ${r.target}`, r.vsPlan].filter(Boolean).join(' · ') || 'No number yet')}</p>
<p class="why"><strong>Why:</strong> ${esc(r.why || 'No reason given in the latest check-in.')}</p>
${ru ? `<p>Under it: ${statusHtml(ru.status)} · ${esc(ru.text)}</p>` : ''}
${r.parentId && byId.get(r.parentId) ? `<p class="meta">Feeds into ${esc(byId.get(r.parentId).title)}</p>` : ''}
<p><a class="btn primary" href="/goals/${encodeURIComponent(r.id)}">Open the goal</a> <button type="button" class="btn" data-act="close">Close</button></p>`;
}

function render(refit = true) {
  compute();
  const unf = root.querySelector('[data-act=unfold]');
  unf.textContent = S.all ? 'Fold to the top' : 'Unfold all';
  unf.hidden = !!D.matchIds;
  root.querySelector('[data-act=tidy]').hidden = !Object.keys(S.moved).length;
  countEl.textContent = `Showing ${view.shown.length} of ${rows.length} goals${D.matchIds ? `: ${D.matchIds.length} that match, the rest for context` : ''}.`;
  if (phone()) drawList(); else drawCanvas(refit);
  drawStory();
}

// ---------- what people do ----------
function select(id, focus) {
  S.selected = id;
  render(false);
  if (phone()) story.scrollIntoView({ block: 'nearest' });
  if (focus) story.querySelector('h2').focus();
}
function closeStory() {
  const id = S.selected; S.selected = null; render(false);
  const n = id && root.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .map-node`);
  if (n) n.focus();
}
function toggleFold(id, how) {
  if (how === 'open') { S.opened.add(id); S.shut.delete(id); } else { S.shut.add(id); S.opened.delete(id); }
  render(true);
}
root.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'unfold') { S.all = !S.all; S.opened.clear(); S.shut.clear(); render(true); }
    else if (a === 'fit') fit();
    else if (a === 'readable') readable();
    else if (a === 'zoomin') { S.scale = Math.min(2, S.scale * 1.2); apply(); }
    else if (a === 'zoomout') { S.scale = Math.max(0.1, S.scale / 1.2); apply(); }
    else if (a === 'tidy') { S.moved = {}; saveMoved(); render(true); }
    else if (a === 'close') closeStory();
    return;
  }
  const f = e.target.closest('[data-fold]');
  if (f) { e.stopPropagation(); toggleFold(f.closest('[data-id]').dataset.id, f.dataset.fold); return; }
  if (phone()) { const n = e.target.closest('.map-list .react-flow__node'); if (n) select(n.dataset.id); }
});
root.addEventListener('change', (e) => {
  if (e.target.matches('[data-act=troubled]')) {
    S.troubled = e.target.checked;
    const u = new URL(location.href); if (S.troubled) u.searchParams.set('troubled', '1'); else u.searchParams.delete('troubled'); history.replaceState(history.state, '', u);
    render(true);
  }
});
root.addEventListener('keydown', (e) => {
  // The map never removes a goal.
  if (e.key === 'Delete' || e.key === 'Backspace') { if (!e.target.matches('input, textarea')) e.preventDefault(); return; }
  if (e.key === 'Escape' && S.selected) { e.preventDefault(); closeStory(); return; }
  const n = e.target.closest('[data-id]');
  if (n && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('.fold')) { e.preventDefault(); select(n.dataset.id, true); }
});

// pan, zoom and drag (a computer)
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.fold')) return;
  const n = e.target.closest('.react-flow__node');
  drag = { id: n && n.dataset.id, x: e.clientX, y: e.clientY, moved: false, tx: S.tx, ty: S.ty, start: n ? { ...(S.moved[n.dataset.id] || { dx: 0, dy: 0 }) } : null };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true;
  if (drag.id) { S.moved[drag.id] = { dx: drag.start.dx + dx / S.scale, dy: drag.start.dy + dy / S.scale }; drawCanvas(false); }
  else { S.tx = drag.tx + dx; S.ty = drag.ty + dy; apply(); }
});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.id && d.moved) { saveMoved(); render(false); }
  else if (d.id && !d.moved) select(d.id);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    const box = canvas.getBoundingClientRect(); const mx = e.clientX - box.left, my = e.clientY - box.top;
    const k = e.deltaY < 0 ? 1.1 : 1 / 1.1; const ns = Math.min(2, Math.max(0.1, S.scale * k));
    S.tx = mx - ((mx - S.tx) * ns) / S.scale; S.ty = my - ((my - S.ty) * ns) / S.scale; S.scale = ns;
  } else { S.tx -= e.deltaX; S.ty -= e.deltaY; }
  apply();
}, { passive: false });
canvas.addEventListener('keydown', (e) => {
  if (e.target !== canvas) return;
  const step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
  if (step) { e.preventDefault(); S.tx += step[0]; S.ty += step[1]; apply(); }
});

// The list bar's search, on the Map: lists the goals it finds; choosing one opens its tree and moves to it.
const field = document.querySelector('#lb input[name=q]');
if (field) {
  const ul = document.createElement('ul');
  ul.className = 'map-find'; ul.setAttribute('role', 'listbox'); ul.id = 'map-find'; ul.hidden = true;
  field.setAttribute('aria-controls', 'map-find'); field.setAttribute('aria-autocomplete', 'list'); field.setAttribute('autocomplete', 'off');
  field.closest('form').after(ul);
  let found = [], at = -1;
  const show = () => { ul.innerHTML = found.slice(0, 8).map((id, i) => { const r = byId.get(id); return `<li role="option" data-id="${id}" aria-selected="${i === at}">${esc(r.title)}<br><span class="meta">${esc(r.key)} · ${esc(D.words[r.status])}</span></li>`; }).join(''); ul.hidden = !found.length; };
  const choose = (id) => {
    ul.hidden = true; at = -1;
    if (S.troubled && !troubledTops(rows, st, F).some((t) => t === id || descendants(rows, t, F).includes(id))) { S.troubled = false; const c = root.querySelector('[data-act=troubled]'); if (c) c.checked = false; }
    for (const a of ancestors(rows, id, F)) { S.opened.add(a); S.shut.delete(a); }
    S.found = id;
    render(true);
    if (!phone()) centreOn(id);
    const n = root.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .map-node`);
    if (n) { if (phone()) n.scrollIntoView({ block: 'center' }); n.focus({ preventScroll: !phone() }); }
  };
  field.addEventListener('input', () => { found = findOnMap(rows, field.value); at = -1; show(); });
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && found.length) { e.preventDefault(); at = Math.min(at + 1, Math.min(found.length, 8) - 1); show(); }
    else if (e.key === 'ArrowUp' && found.length) { e.preventDefault(); at = Math.max(at - 1, 0); show(); }
    else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); choose(found[at]); }
    else if (e.key === 'Escape') { ul.hidden = true; }
  });
  ul.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-id]'); if (li) { e.preventDefault(); choose(li.dataset.id); } });
}

let wasPhone = phone();
addEventListener('resize', () => { if (phone() !== wasPhone) { wasPhone = phone(); render(true); } });
render(true);
root.dataset.ready = '1';
