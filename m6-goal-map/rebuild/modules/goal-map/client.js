// The Goal map's own behaviour in the page, run inside the same closure as map.mjs's rules (inlined by module.mjs).
// Classic script inside <main>: it runs while the page is parsed, before the core's client.js (a module script).
const D = JSON.parse(document.getElementById('map-data').textContent);
const root = document.querySelector('.goal-map');
const canvas = root.querySelector('.map-canvas'), viewport = root.querySelector('.map-viewport');
const svg = root.querySelector('.map-edges'), nodesEl = root.querySelector('.map-nodes'), story = root.querySelector('.map-story');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const goals = D.goals; const byId = new Map(goals.map((g) => [g.id, g]));
const st = { opened: new Set(), shut: new Set(), all: D.all, troubledOnly: false, found: null, moved: new Map(), tx: 0, ty: 0, s: 1, selected: null };
let L = null, phone = false, shown = [];

// ---------- the list bar's search, on the Map: lists the goals it finds; choosing one goes to it, Enter narrows ----------
const box = document.querySelector('.list-bar input[type=search]');
if (box) {
  box.removeAttribute('data-live');
  box.setAttribute('role', 'combobox'); box.setAttribute('aria-controls', 'map-find'); box.setAttribute('aria-expanded', 'false'); box.setAttribute('autocomplete', 'off');
  const list = document.createElement('div'); list.id = 'map-find'; list.setAttribute('role', 'listbox'); list.className = 'map-find'; list.hidden = true;
  box.closest('form').after(list);
  let active = -1, found = [];
  const paint = () => { list.innerHTML = found.slice(0, 8).map((g, i) => `<button type="button" role="option" id="mf-${i}" data-id="${esc(g.id)}" aria-selected="${i === active}">${esc(g.key)} ${esc(g.title)}</button>`).join(''); list.hidden = !found.length; box.setAttribute('aria-expanded', String(!!found.length)); };
  box.addEventListener('input', () => { found = findOnMap(goals, box.value); active = -1; paint(); });
  list.addEventListener('mouseover', (e) => { const b = e.target.closest('[role=option]'); if (b) { active = Number(b.id.slice(3)); for (const x of list.children) x.setAttribute('aria-selected', String(x === b)); } });
  list.addEventListener('mouseleave', () => { active = -1; for (const x of list.children) x.setAttribute('aria-selected', 'false'); });
  list.addEventListener('click', (e) => { const b = e.target.closest('[role=option]'); if (b) { list.hidden = true; box.setAttribute('aria-expanded', 'false'); goTo(b.dataset.id); } });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!found.length) return; active = (active + (e.key === 'ArrowDown' ? 1 : -1) + Math.min(8, found.length)) % Math.min(8, found.length); paint(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && found[active]) { list.hidden = true; goTo(found[active].id); return; }
      const u = new URL(location.href); if (box.value.trim()) u.searchParams.set('q', box.value.trim()); else u.searchParams.delete('q');
      location.assign(u.pathname + u.search);
    } else if (e.key === 'Escape') { list.hidden = true; box.setAttribute('aria-expanded', 'false'); }
  });
}
function goTo(id) {
  st.troubledOnly = false; root.querySelector('[data-map=troubled]').checked = false;
  for (const a of ancestors(goals, id)) { st.shut.delete(a); st.opened.add(a); }
  st.found = id; render(true);
  const g = byId.get(id), el = nodesEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!phone) { const p = L.pos.get(id); st.s = Math.max(st.s, 0.75); st.tx = canvas.clientWidth / 2 - (p.x + NODE.w / 2) * st.s; st.ty = canvas.clientHeight / 2 - (p.y + NODE.h / 2) * st.s; apply(); }
  else el && el.scrollIntoView({ block: 'center' });
  if (el) el.focus({ preventScroll: !phone });
  return g;
}

// ---------- drawing ----------
function nodeHtml(g, x, y, w, hgt) {
  const hidden = hiddenUnder(goals, g.id, shown); const hasKids = (childrenOf(goals).get(g.id) || []).length;
  const label = `${g.key} ${g.title}, ${g.word}${g.onPath ? ', on the critical path' : ''}`;
  return `<div class="react-flow__node" data-id="${esc(g.id)}" tabindex="0" role="button" aria-label="${esc(label)}" style="left:${x}px;top:${y}px;width:${w}px;height:${hgt}px">
    <div class="map-node${g.onPath ? ' on-path' : ''}${g.proposed ? ' proposed' : ''}${st.found === g.id ? ' found' : ''}">
      <p class="mhead"><span class="mkey">${esc(g.key)}</span> ${g.proposed ? '<span class="proposed-word">Proposed</span>' : g.statusHtml}</p>
      <p class="mtitle">${esc(g.title)}</p>
      ${g.nums ? `<p class="mnums">${esc(g.nums)}</p>` : ''}
      ${g.roll ? `<p class="mroll">Under it: ${g.roll.html} · ${esc(g.roll.text)}</p>` : ''}
    </div></div>${hasKids ? `<button type="button" class="fold" data-fold="${esc(g.id)}" style="left:${phone ? x + w - 64 : x + w / 2 - 28}px;top:${phone ? y + hgt - 24 : y + hgt - 2}px" aria-label="${hidden ? `Show the ${hidden} goals under ${esc(g.key)}` : `Fold the goals under ${esc(g.key)}`}">${hidden ? `+${hidden}` : 'Fold'}</button>` : ''}`;
}
function render(refit) {
  phone = canvas.clientWidth < 640;
  root.classList.toggle('is-phone', phone);
  let list = goals;
  if (st.troubledOnly) { const t = troubled(goals); const keep = new Set(); for (const top of topsOf(goals)) if (t.has(top.id)) { keep.add(top.id); for (const d of descendants(goals, top.id)) keep.add(d.id); } list = goals.filter((g) => keep.has(g.id)); }
  shown = shownOnMap(list, { opened: st.opened, shut: st.shut, paths: D.paths, all: st.all });
  const on = new Set(shown);
  const pos = new Map(); let W, H;
  if (phone) {
    const P = layoutIndented(goals, shown); W = canvas.clientWidth; H = P.h;
    for (const [id, p] of P.pos) pos.set(id, { x: p.x, y: p.y, w: W - p.x - 4, h: P.rowH - 10 });
    viewport.classList.add('map-list'); viewport.style.transform = ''; viewport.style.height = `${H}px`; canvas.style.height = 'auto';
  } else {
    viewport.classList.remove('map-list'); canvas.style.height = '';
    L = layout(goals, shown, { width: canvas.clientWidth, height: canvas.clientHeight });
    for (const [id, p] of L.pos) { const m = st.moved.get(id); pos.set(id, { x: m ? m.x : p.x, y: m ? m.y : p.y, w: NODE.w, h: NODE.h }); }
    W = L.w; H = L.h; viewport.style.height = '';
  }
  nodesEl.innerHTML = shown.map((id) => { const p = pos.get(id); return nodeHtml(byId.get(id), p.x, p.y, p.w, p.h); }).join('');
  // lines: feeds into (solid), the critical path (bold), also helps (dotted; from a folded goal, its nearest shown goal above)
  const next = new Set(); for (const p of D.paths) for (let i = 0; i < p.length - 1; i++) next.add(`${p[i]}>${p[i + 1]}`);
  const shownUp = (id) => { if (on.has(id)) return id; for (const a of ancestors(goals, id)) if (on.has(a)) return a; return null; };
  const edges = [];
  for (const id of shown) { const g = byId.get(id); if (g.parentId && on.has(g.parentId)) edges.push({ a: g.parentId, b: id, cls: `feeds${next.has(`${g.parentId}>${id}`) ? ' critical' : ''}` }); }
  const seen = new Set();
  for (const g of goals) for (const t of g.alsoHelps || []) { const a = shownUp(g.id), b = shownUp(t); if (!a || !b || a === b || seen.has(`${a}>${b}`)) continue; seen.add(`${a}>${b}`); edges.push({ a, b, cls: `helps${a === g.id ? '' : ' folded'}` }); }
  svg.setAttribute('width', Math.max(W, 10) + 400); svg.setAttribute('height', Math.max(H, 10) + 400);
  svg.innerHTML = edges.map((e) => {
    const p = pos.get(e.a), q = pos.get(e.b); let d;
    if (phone) d = e.cls.startsWith('feeds') ? `M${p.x + 8},${p.y + p.h} V${q.y + q.h / 2} H${q.x}` : `M${p.x + p.w},${p.y + p.h / 2} C${p.x + p.w + 14},${p.y + p.h / 2} ${q.x + q.w + 14},${q.y + q.h / 2} ${q.x + q.w},${q.y + q.h / 2}`;
    else if (e.cls.startsWith('feeds')) { const x1 = p.x + p.w / 2, y1 = p.y + p.h, x2 = q.x + q.w / 2, y2 = q.y; d = `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`; }
    else { const x1 = p.x + p.w, y1 = p.y + p.h / 2, x2 = q.x, y2 = q.y + q.h / 2; d = `M${x1},${y1} C${x1 + 60},${y1 - 40} ${x2 - 60},${y2 - 40} ${x2},${y2}`; }
    return `<g class="react-flow__edge ${e.cls}" data-from="${esc(e.a)}" data-to="${esc(e.b)}"><path d="${d}"/></g>`;
  }).join('');
  if (refit && !phone) fit();
  else apply();
}
function apply() { if (!phone) viewport.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.s})`; }
function fit() {
  if (!L) return; const cw = canvas.clientWidth, ch = canvas.clientHeight;
  st.s = Math.min(1, L.fit); st.tx = (cw - L.w * st.s) / 2; st.ty = Math.max(16, (ch - L.h * st.s) / 2); apply();
}
function readable() {
  if (!L) return; st.s = Math.max(0.75, Math.min(1, L.fit));
  const first = (D.paths.find((p) => p.length > 1) || [shown[0]])[0]; const p = L.pos.get(first) || { x: 0, y: 0 };
  st.tx = canvas.clientWidth / 2 - (p.x + NODE.w / 2) * st.s; st.ty = 24 - p.y * st.s; apply();
}

// ---------- a goal's story, beside the map ----------
function openStory(id) {
  const g = byId.get(id); if (!g) return; st.selected = id;
  for (const n of nodesEl.querySelectorAll('.map-node.selected')) n.classList.remove('selected');
  nodesEl.querySelector(`[data-id="${CSS.escape(id)}"] .map-node`)?.classList.add('selected');
  story.setAttribute('aria-label', g.title);
  story.innerHTML = `<button type="button" class="story-close" aria-label="Close the story">Close</button>
    <p class="mkey">${esc(g.key)}${g.owner ? ` · ${esc(g.owner)}` : ''}</p><h2>${esc(g.title)}</h2>
    <p>${g.proposed ? '<span class="proposed-word">Proposed</span>' : g.statusHtml}</p>
    ${g.nums ? `<p>${esc(g.nums)}</p>` : ''}
    <p><strong>Why:</strong> ${g.why ? esc(g.why) : 'The latest check-in gave no reason.'}</p>
    ${g.roll ? `<p>Under it: ${g.roll.html} · ${esc(g.roll.text)}</p>` : ''}
    <p>${g.onPath ? 'On the critical path: the inputs most likely to make its north star miss run through it.' : 'Not on a critical path.'}</p>
    <p><a href="/goals/${encodeURIComponent(g.id)}">Open the goal</a></p>`;
  story.hidden = false; story.focus();
}
function closeStory() {
  const id = st.selected; story.hidden = true; st.selected = null;
  for (const n of nodesEl.querySelectorAll('.map-node.selected')) n.classList.remove('selected');
  if (id) nodesEl.querySelector(`[data-id="${CSS.escape(id)}"]`)?.focus();
}
story.addEventListener('click', (e) => { if (e.target.closest('.story-close')) closeStory(); });
story.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeStory(); } });

// ---------- the toolbar ----------
root.querySelector('.map-bar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('attention-switch')) { const u = new URL(location.href); if (D.attention) u.searchParams.delete('attention'); else u.searchParams.set('attention', '1'); location.assign(u.pathname + u.search); return; }
  const k = b.dataset.map;
  if (k === 'unfold') { st.all = true; st.shut.clear(); render(true); }
  if (k === 'fold') { st.all = false; st.opened.clear(); st.shut.clear(); st.found = null; render(true); }
  if (k === 'fit') fit();
  if (k === 'readable') readable();
});
root.querySelector('[data-map=troubled]').addEventListener('change', (e) => { st.troubledOnly = e.target.checked; render(true); });
nodesEl.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fold]'); if (!f) return;
  const id = f.dataset.fold; const hidden = hiddenUnder(goals, id, shown);
  if (hidden) { st.shut.delete(id); st.opened.add(id); } else { st.opened.delete(id); st.shut.add(id); }
  render(true);
});

// ---------- keyboard: Enter opens the story; Delete and Backspace do nothing on the map ----------
root.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea')) { e.preventDefault(); return; }
  const n = e.target.closest('.react-flow__node');
  if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openStory(n.dataset.id); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !story.hidden) closeStory(); });

// ---------- pan, zoom, and moving a goal ----------
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('.fold')) return;
  const n = e.target.closest('.react-flow__node');
  drag = { x: e.clientX, y: e.clientY, tx: st.tx, ty: st.ty, node: n ? n.dataset.id : null, moved: false, el: n };
  if (n && !phone) { const L0 = n.style; drag.nx = parseFloat(L0.left); drag.ny = parseFloat(L0.top); }
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true; if (phone) return;
  if (drag.node) { const x = drag.nx + dx / st.s, y = drag.ny + dy / st.s; st.moved.set(drag.node, { x, y }); drag.el.style.left = `${x}px`; drag.el.style.top = `${y}px`; }
  else { st.tx = drag.tx + dx; st.ty = drag.ty + dy; apply(); }
});
window.addEventListener('pointerup', () => {
  if (!drag) return; const d = drag; drag = null;
  if (d.node && !d.moved) openStory(d.node);
  else if (d.node && d.moved) render(false);
});
canvas.addEventListener('wheel', (e) => {
  if (phone) return; e.preventDefault();
  const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
  const ns = Math.min(2, Math.max(0.1, st.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  st.tx = mx - (mx - st.tx) * (ns / st.s); st.ty = my - (my - st.ty) * (ns / st.s); st.s = ns; apply();
}, { passive: false });
let lastW = 0;
new ResizeObserver(() => { if (canvas.clientWidth !== lastW) { lastW = canvas.clientWidth; render(true); } }).observe(canvas);
render(true);
