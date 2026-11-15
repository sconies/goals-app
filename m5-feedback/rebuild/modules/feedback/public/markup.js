// Mark up this screen: a still picture of the screen as it is (drawn from a copy of the page in its own fonts and sizes),
// a slim toolbar (Pen, Arrow, Box, Note, Undo, Clear, Cancel, Next) in one high-contrast ink, by mouse, touch or the keyboard
// alone, with the page frozen beneath; then one line, a mood, the exact picture, and Send.
const INK = '#d1004a', HALO = '#ffffff';
const SS = { get: (k, d) => { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- the picture ----------
const INHERITED = ['color', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch', 'font-variant', 'font-feature-settings', 'font-kerning', 'font-optical-sizing', 'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-indent', 'text-transform', 'text-rendering', 'white-space', 'word-break', 'overflow-wrap', 'visibility', 'direction', 'list-style-type', 'list-style-position', 'border-collapse', 'border-spacing', 'caption-side', 'fill', 'stroke', 'stroke-width', 'color-scheme', '-webkit-font-smoothing', 'tab-size', 'hyphens', 'cursor', 'quotes', 'writing-mode', 'text-decoration-color', 'caret-color'];
let defaults = null;
function defaultStyle(tag) {
  if (!defaults) { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-9999px;width:10px;height:10px;visibility:hidden'; document.body.append(f); defaults = { f, cache: new Map() }; }
  if (!defaults.cache.has(tag)) {
    const doc = defaults.f.contentDocument;
    const el = doc.createElement(tag); doc.body.append(el);
    const cs = doc.defaultView.getComputedStyle(el); const o = {};
    for (const p of cs) o[p] = cs.getPropertyValue(p);
    el.remove(); defaults.cache.set(tag, o);
  }
  return defaults.cache.get(tag);
}
async function capture(skip) {
  defaultStyle('div'); // the clean frame for defaults is made before the copy, so the copy and the page line up
  const W = innerWidth, H = innerHeight;
  const body = document.body;
  const clone = body.cloneNode(true);
  const src = [body, ...body.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
  const bodyRect = body.getBoundingClientRect();
  const drop = [];
  for (let i = 0; i < src.length; i++) {
    const s = src[i], d = dst[i];
    if (skip && skip.contains(s)) { drop.push(d); continue; }
    if (['SCRIPT', 'LINK', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(s.tagName)) { drop.push(d); continue; }
    const cs = getComputedStyle(s);
    const def = defaultStyle(s.tagName.toLowerCase());
    let css = '';
    for (const p of cs) { const v = cs.getPropertyValue(p); if (v !== def[p] || INHERITED.includes(p)) css += `${p}:${v};`; }
    // fixed and sticky parts stay where the screen shows them
    if (cs.position === 'fixed') { const r = s.getBoundingClientRect(); css += `position:absolute;top:${r.top - bodyRect.top}px;left:${r.left - bodyRect.left}px;right:auto;bottom:auto;width:${r.width}px;height:${r.height}px;`; }
    else if (cs.position === 'sticky') {
      const r = s.getBoundingClientRect(); const was = s.style.position; s.style.position = 'static'; const r0 = s.getBoundingClientRect(); s.style.position = was;
      css += `position:relative;top:${r.top - r0.top}px;left:${r.left - r0.left}px;bottom:auto;right:auto;`;
    }
    d.setAttribute('style', css);
    if (s instanceof HTMLInputElement) { if (s.type === 'checkbox' || s.type === 'radio') { if (s.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked'); } else d.setAttribute('value', s.value); }
    if (s instanceof HTMLTextAreaElement) d.textContent = s.value;
    if (s instanceof HTMLSelectElement) [...d.options].forEach((o, j) => { if (j === s.selectedIndex) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
    if (s instanceof HTMLDetailsElement && s.open) d.setAttribute('open', '');
    if (s instanceof HTMLImageElement && s.complete && s.naturalWidth) { try { const c = document.createElement('canvas'); c.width = s.naturalWidth; c.height = s.naturalHeight; c.getContext('2d').drawImage(s, 0, 0); d.setAttribute('src', c.toDataURL('image/png')); } catch { d.removeAttribute('src'); } }
    if (s instanceof HTMLCanvasElement) { const im = document.createElement('img'); try { im.src = s.toDataURL(); } catch {} im.setAttribute('style', css); d.replaceWith(im); }
  }
  drop.forEach((d) => d.remove());
  clone.style.transform = `translate(${-scrollX}px, ${-scrollY}px)`;
  clone.style.margin = '0';
  const rootCs = getComputedStyle(document.documentElement);
  const wrap = document.createElement('div');
  wrap.setAttribute('style', `width:${W}px;height:${H}px;overflow:hidden;background:${rootCs.backgroundColor};color-scheme:${rootCs.colorScheme};font:${rootCs.font};`);
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const inner = document.createElement('div');
  inner.setAttribute('style', clone.getAttribute('style'));
  inner.style.transform = `translate(${-scrollX}px, ${-scrollY}px)`;
  inner.style.margin = '0';
  inner.append(...clone.childNodes);
  wrap.append(inner);
  const xhtml = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const dpr = devicePixelRatio || 1;
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = rootCs.backgroundColor || '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  return { canvas: c, url: c.toDataURL('image/png'), W, H, dpr };
}

// ---------- named parts under a point (Goal page › Scorecard) ----------
function partsAt(root, x, y) {
  root.style.visibility = 'hidden';
  const el = document.elementFromPoint(x, y);
  root.style.visibility = '';
  const path = [];
  for (let n = el; n && n !== document.body; n = n.parentElement) if (n.dataset && n.dataset.part) path.unshift(n.dataset.part);
  return path;
}
const anchor = (s) => (s.kind === 'box' ? [s.x + s.w / 2, s.y + s.h / 2] : s.kind === 'arrow' ? [s.x2, s.y2] : s.kind === 'pen' ? s.points[Math.floor(s.points.length / 2)] : [s.x, s.y]);

// ---------- drawing ----------
function draw(g, strokes, current, W, H, dpr) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  for (const s of [...strokes, ...(current ? [current] : [])]) for (const [colour, width] of [[HALO, 6], [INK, 3]]) {
    g.strokeStyle = colour; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    if (s.kind === 'pen') { g.beginPath(); s.points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    if (s.kind === 'box') g.strokeRect(s.x, s.y, s.w, s.h);
    if (s.kind === 'arrow') {
      const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2);
      g.moveTo(s.x2, s.y2); g.lineTo(s.x2 - 14 * Math.cos(a - 0.45), s.y2 - 14 * Math.sin(a - 0.45));
      g.moveTo(s.x2, s.y2); g.lineTo(s.x2 - 14 * Math.cos(a + 0.45), s.y2 - 14 * Math.sin(a + 0.45)); g.stroke();
    }
    if (s.kind === 'note' && colour === INK) {
      g.fillStyle = INK; g.beginPath(); g.arc(s.x, s.y, 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = HALO; g.lineWidth = 2; g.stroke();
      g.fillStyle = HALO; g.font = '600 13px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(s.n), s.x, s.y + 0.5);
      if (s.text) { g.font = '13px system-ui, sans-serif'; g.textAlign = 'left'; const w = g.measureText(s.text).width; g.fillStyle = HALO; g.fillRect(s.x + 15, s.y - 10, w + 10, 20); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(s.x + 15, s.y - 10, w + 10, 20); g.fillStyle = '#1d1f22'; g.fillText(s.text, s.x + 20, s.y); }
    }
  }
}

export async function start() {
  const shot = await capture();
  const { W, H, dpr } = shot;
  const html = document.documentElement;
  const was = { overflow: html.style.overflow, x: scrollX, y: scrollY };
  html.style.overflow = 'hidden';
  const root = document.createElement('div');
  root.className = 'markup-root';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Mark up this screen');
  const TOOLS = [['pen', 'Pen', 'p'], ['arrow', 'Arrow', 'a'], ['box', 'Box', 'b'], ['note', 'Note', 'n']];
  root.innerHTML = `<img class="mk-shot" alt="" src="${shot.url}">
    <canvas class="mk-surface" tabindex="0" width="${Math.round(W * dpr)}" height="${Math.round(H * dpr)}" aria-label="The screen, to draw on. Arrow keys move the crosshair, Enter starts and ends a mark, P, A, B and N choose Pen, Arrow, Box and Note."></canvas>
    <div class="mk-cross" hidden></div>
    <div class="mk-toolbar" role="toolbar" aria-label="Markup tools">${TOOLS.map(([k, l, key]) => `<button type="button" data-tool="${k}" aria-pressed="${k === 'pen'}" aria-keyshortcuts="${key}">${l}</button>`).join('')}
      <span class="mk-sep"></span><button type="button" data-do="undo" aria-keyshortcuts="Control+Z">Undo</button><button type="button" data-do="clear">Clear</button>
      <span class="mk-sep"></span><button type="button" data-do="cancel">Cancel</button><button type="button" class="primary" data-do="next">Next</button></div>
    <p class="mk-live sr-only" role="status" aria-live="polite"></p>`;
  document.body.append(root);
  const surface = root.querySelector('.mk-surface'), g = surface.getContext('2d'), cross = root.querySelector('.mk-cross'), live = root.querySelector('.mk-live');
  const say = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  let tool = 'pen', strokes = [], cur = null, pt = [W / 2, H / 2], noteOpen = null;
  const redraw = () => draw(g, strokes, cur, W, H, dpr);
  const setTool = (t) => { tool = t; root.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t))); };
  const commit = (s) => { s.parts = [partsAt(root, ...anchor(s))]; strokes.push(s); cur = null; redraw(); };
  const notes = () => strokes.filter((s) => s.kind === 'note').length;
  const placeNote = (x, y) => {
    const n = notes() + 1;
    const ed = document.createElement('div'); ed.className = 'mk-note-edit';
    ed.style.left = `${Math.min(x + 14, W - 230)}px`; ed.style.top = `${Math.min(y + 14, H - 60)}px`;
    ed.innerHTML = `<label>Note ${n} <input type="text" maxlength="80"></label>`;
    root.append(ed);
    const input = ed.querySelector('input'); input.focus();
    cur = { kind: 'note', x, y, n, text: '' }; redraw();
    noteOpen = { ed, done: (keep) => { ed.remove(); noteOpen = null; if (keep && input.value.trim()) { cur.text = input.value.trim(); commit(cur); say('Note added'); } else { cur = null; redraw(); } surface.focus(); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noteOpen?.done(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); noteOpen?.done(false); } });
  };
  const close = () => { root.remove(); html.style.overflow = was.overflow; scrollTo(was.x, was.y); document.removeEventListener('keydown', onKey, true); };
  // pointer: mouse, pen or a finger
  const at = (e) => { const r = surface.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  surface.addEventListener('pointerdown', (e) => {
    if (noteOpen) noteOpen.done(true);
    const [x, y] = at(e); e.preventDefault(); surface.setPointerCapture(e.pointerId);
    if (tool === 'note') return placeNote(x, y);
    cur = tool === 'pen' ? { kind: 'pen', points: [[x, y]] } : tool === 'box' ? { kind: 'box', x, y, w: 0, h: 0, x0: x, y0: y } : { kind: 'arrow', x1: x, y1: y, x2: x, y2: y };
  });
  surface.addEventListener('pointermove', (e) => { if (!cur || cur.kind === 'note') return; grow(...at(e)); redraw(); });
  surface.addEventListener('pointerup', (e) => { if (!cur || cur.kind === 'note') return; grow(...at(e)); finish(); });
  const grow = (x, y) => {
    if (cur.kind === 'pen') cur.points.push([x, y]);
    if (cur.kind === 'box') Object.assign(cur, { x: Math.min(cur.x0, x), y: Math.min(cur.y0, y), w: Math.abs(x - cur.x0), h: Math.abs(y - cur.y0) });
    if (cur.kind === 'arrow') Object.assign(cur, { x2: x, y2: y });
  };
  const finish = () => {
    const s = cur; delete s.x0; delete s.y0;
    const tiny = (s.kind === 'box' && s.w < 3 && s.h < 3) || (s.kind === 'arrow' && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 3);
    if (tiny) { cur = null; redraw(); return; }
    commit(s); say(`${s.kind === 'pen' ? 'Line' : s.kind === 'box' ? 'Box' : 'Arrow'} added`);
  };
  // the keyboard alone: arrows move the crosshair, Enter starts and ends a mark
  const showCross = () => { cross.hidden = false; cross.style.left = `${pt[0]}px`; cross.style.top = `${pt[1]}px`; };
  surface.addEventListener('focus', showCross);
  surface.addEventListener('blur', () => { cross.hidden = true; });
  surface.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 24 : 4;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); pt = [Math.max(0, Math.min(W, pt[0] + mv[0])), Math.max(0, Math.min(H, pt[1] + mv[1]))]; showCross(); if (cur) { grow(...pt); redraw(); } return; }
    const k = e.key.toLowerCase();
    if (!e.ctrlKey && !e.metaKey && TOOLS.some(([, , key]) => key === k)) { e.preventDefault(); setTool(TOOLS.find(([, , key]) => key === k)[0]); say(`${TOOLS.find(([, , key]) => key === k)[1]} chosen`); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tool === 'note') return placeNote(...pt);
      if (!cur) { cur = tool === 'pen' ? { kind: 'pen', points: [[...pt]] } : tool === 'box' ? { kind: 'box', x: pt[0], y: pt[1], w: 0, h: 0, x0: pt[0], y0: pt[1] } : { kind: 'arrow', x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1] }; say('Mark started: move, then Enter'); }
      else { grow(...pt); finish(); }
    }
  });
  // Escape stops the mark being made, or else cancels; Ctrl+Z takes back the last mark
  const onKey = (e) => {
    if (root.querySelector('.mk-send') && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); root.querySelector('.mk-send').remove(); surface.focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (noteOpen) noteOpen.done(false); else if (cur) { cur = null; redraw(); } else close(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea')) { e.preventDefault(); strokes.pop(); redraw(); say('Took back the last mark'); }
  };
  document.addEventListener('keydown', onKey, true);
  root.querySelector('.mk-toolbar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); surface.focus(); }
    const d = e.target.closest('[data-do]')?.dataset.do;
    if (d === 'undo') { strokes.pop(); redraw(); say('Took back the last mark'); }
    if (d === 'clear') { strokes = []; redraw(); say('Cleared'); }
    if (d === 'cancel') close();
    if (d === 'next') next();
  });
  setTimeout(() => surface.focus({ preventScroll: true }), 0);

  // ---------- Next: the line, the mood, the exact picture, Send ----------
  function pictures() {
    const ink = document.createElement('canvas'); ink.width = surface.width; ink.height = surface.height; draw(ink.getContext('2d'), strokes, null, W, H, dpr);
    const marked = document.createElement('canvas'); marked.width = surface.width; marked.height = surface.height;
    const mg = marked.getContext('2d'); mg.drawImage(shot.canvas, 0, 0); mg.drawImage(ink, 0, 0);
    const thumb = document.createElement('canvas'); thumb.width = 320; thumb.height = Math.round(320 * H / W);
    thumb.getContext('2d').drawImage(marked, 0, 0, thumb.width, thumb.height);
    return { 'screen.png': shot.url, 'ink.png': ink.toDataURL('image/png'), 'marked.jpg': marked.toDataURL('image/jpeg', 0.85), 'thumb.jpg': thumb.toDataURL('image/jpeg', 0.8) };
  }
  function next() {
    if (noteOpen) noteOpen.done(true);
    const pics = pictures();
    const d = document.createElement('div');
    d.className = 'mk-send'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Send the markup');
    d.innerHTML = `<h2>Send the markup</h2>
      <div class="mk-preview"><img alt="The picture that will be sent, with your marks" src="${pics['marked.jpg']}"></div>
      <label>What should change? <textarea rows="2" maxlength="500"></textarea></label>
      <p class="mk-error" role="alert" hidden></p>
      <div class="fb-moods" role="group" aria-label="How is the app working for you?">${[['good', 'It works well'], ['meh', 'It’s OK'], ['bad', 'It gets in the way']].map(([v, l]) => `<button type="button" aria-pressed="false" data-mood="${v}">${l}</button>`).join('')}</div>
      <label class="mk-steps-tick"><input type="checkbox" checked> Include my last 20 steps on this visit</label> <a href="/help/feedback" target="_blank">What’s sent</a>
      <p class="mk-send-buttons"><button type="button" data-send="back">Back</button> <button type="button" data-send="cancel">Cancel</button> <button type="button" class="primary" data-send="send">Send</button></p>`;
    root.append(d);
    let mood = null;
    d.querySelector('textarea').focus();
    d.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-mood]');
      if (m) { mood = m.dataset.mood; d.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b === m))); }
      const a = e.target.closest('[data-send]')?.dataset.send;
      if (a === 'back') { d.remove(); surface.focus(); }
      if (a === 'cancel') close();
      if (a === 'send') {
        const line = d.querySelector('textarea').value.trim();
        const alert = d.querySelector('.mk-error');
        if (!line) { alert.hidden = false; alert.textContent = 'Say what should change first.'; d.querySelector('textarea').focus(); return; }
        const steps = d.querySelector('.mk-steps-tick input').checked;
        const body = { line, mood, strokes: strokes.map(({ parts, ...s }) => s), parts: strokes.map((s) => s.parts), steps: steps ? SS.get('fb-steps', []) : [], includeSteps: steps, errors: SS.get('fb-errors', []), address: location.pathname + location.search, origin: location.origin,
          context: { viewport: { w: W, h: H }, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', accent: getComputedStyle(html).getPropertyValue('--accent').trim(), version: '1.0.0', title: document.title }, pics };
        const r = await fetch('/m/feedback/markup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({ error: 'It wasn’t sent. Try again.' }));
        if (!r.ok) { alert.hidden = false; alert.textContent = j.error; return; }
        close();
        const msg = document.createElement('p'); msg.className = 'message mk-sent'; msg.setAttribute('role', 'status'); msg.textContent = j.message;
        (document.querySelector('main') || document.body).prepend(msg);
      }
    });
  }
}
