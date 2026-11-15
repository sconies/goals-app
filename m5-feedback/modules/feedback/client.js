// Feedback's script, added to every page by the shell while Feedback is on: the last 20 steps of this visit,
// the visit's errors, Ctrl+Shift+M (Cmd+Shift+M) to mark up the screen, and the markup itself.
(function () {
  var SK = 'faro-steps', EK = 'faro-errors';
  function get(k) { try { return JSON.parse(sessionStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function put(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v.slice(-20))); } catch (e) {} }
  function step(s) { var a = get(SK); a.push(s); put(SK, a); }
  step({ kind: 'page', path: location.pathname + location.search, at: new Date().toISOString() });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button, a, [role=button]');
    if (!b || b.closest('.markup-root')) return;
    step({ kind: 'press', name: (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), path: location.pathname, at: new Date().toISOString() });
  }, true);
  window.addEventListener('error', function (e) { var a = get(EK); a.push({ kind: 'error', message: String(e.message).slice(0, 200), at: new Date().toISOString() }); put(EK, a); });
  document.addEventListener('faro:save-failed', function (e) { var a = get(EK); a.push({ kind: 'save', message: String(e.detail || 'A save did not go through').slice(0, 200), at: new Date().toISOString() }); put(EK, a); });

  var INK = '#e0007a', NS = 'http://www.w3.org/2000/svg';
  var MOODS = [['good', 'It works well'], ['meh', 'It’s OK'], ['bad', 'It gets in the way']];
  var open = null;

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      e.preventDefault();
      if (!open) start();
    }
  });
  if (location.hash === '#markup') { history.replaceState(null, '', location.pathname + location.search); setTimeout(start, 250); }

  function xmlText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  // The still picture: the page as it is, drawn by the browser itself into an SVG (foreignObject), at the screen's size.
  function snapshot() {
    var w = innerWidth, h = innerHeight, sx = scrollX, sy = scrollY;
    var css = [].map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    var cs = getComputedStyle(document.body);
    var clone = document.body.cloneNode(true);
    [].forEach.call(clone.querySelectorAll('script, dialog:not([open]), .markup-root, .mk-toast'), function (n) { n.remove(); });
    var srcIn = document.body.querySelectorAll('input, textarea, select'), cloneIn = clone.querySelectorAll('input, textarea, select');
    for (var i = 0; i < srcIn.length && i < cloneIn.length; i++) {
      if (srcIn[i].type === 'checkbox' || srcIn[i].type === 'radio') { if (srcIn[i].checked) cloneIn[i].setAttribute('checked', ''); else cloneIn[i].removeAttribute('checked'); }
      else if (srcIn[i].tagName === 'TEXTAREA') cloneIn[i].textContent = srcIn[i].value; else cloneIn[i].setAttribute('value', srcIn[i].value);
    }
    var wrap = document.createElement('div');
    wrap.setAttribute('style', 'position:absolute;left:' + (-sx) + 'px;top:' + (-sy) + 'px;width:' + w + 'px;min-height:' + h + 'px;margin:0;background:' + cs.backgroundColor + ';color:' + cs.color + ';font:' + cs.font);
    while (clone.firstChild) wrap.appendChild(clone.firstChild);
    // A sticky sidebar stays where the eye sees it.
    var side = wrap.querySelector('.side'); if (side) side.style.cssText += ';position:absolute;top:' + sy + 'px';
    var html = new XMLSerializer().serializeToString(wrap);
    var dark = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject x="0" y="0" width="' + w + '" height="' + h + '"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;position:relative;background:' + cs.backgroundColor + '"><style>' + xmlText(css) + '</style>' + html + '</div></foreignObject></svg>';
    return { svg: svg, w: w, h: h, theme: dark };
  }
  function url(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function el(tag, attrs, parent, ns) { var n = ns ? document.createElementNS(NS, tag) : document.createElement(tag); for (var k in attrs || {}) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function btn(label, parent, cls) { var b = el('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : '') }, parent); b.textContent = label; return b; }

  // What is under a mark: the named part (data-part), else the nearest labelled region, else the page's heading.
  function partsAt(points) {
    var names = [];
    points.forEach(function (p) {
      var els = document.elementsFromPoint(p[0], p[1]).filter(function (n) { return !n.closest('.markup-root'); });
      var n = els[0]; if (!n) return;
      var named = n.closest('[data-part]');
      var nm = named ? named.getAttribute('data-part') : null;
      if (!nm) { var r = n.closest('section[aria-label], [role=region][aria-label], aside[aria-label], nav[aria-label], table, form'); if (r) nm = r.getAttribute('aria-label') || (r.querySelector('h2, h3, caption, legend') || {}).textContent; }
      if (!nm) { var h = document.querySelector('main h1'); nm = h ? h.textContent : document.title.split(' · ')[0]; }
      nm = String(nm).trim().replace(/\s+/g, ' ').slice(0, 60);
      if (nm && names.indexOf(nm) < 0) names.push(nm);
    });
    return names;
  }

  function start() {
    var shot = snapshot();
    var scrollY0 = scrollY;
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden'; // the page is frozen
    var root = el('div', { class: 'markup-root', role: 'region', 'aria-label': 'Mark up this screen' }, document.body);
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000';
    var img = el('img', { class: 'mk-screen', alt: 'The screen as it was', src: url(shot.svg) }, root);
    img.style.cssText = 'position:absolute;left:0;top:0;width:' + shot.w + 'px;height:' + shot.h + 'px';
    var surf = el('svg', { class: 'mk-surface', tabindex: '0', role: 'img', 'aria-label': 'Drawing area: arrow keys move, Enter starts and ends a mark; P pen, A arrow, B box, N note', width: shot.w, height: shot.h, viewBox: '0 0 ' + shot.w + ' ' + shot.h }, root, true);
    surf.style.cssText = 'position:absolute;left:0;top:0;touch-action:none;cursor:crosshair';
    var defs = el('defs', {}, surf, true), mk = el('marker', { id: 'mk-head', markerWidth: '10', markerHeight: '10', refX: '8', refY: '5', orient: 'auto' }, defs, true);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: INK }, mk, true);
    var layer = el('g', { class: 'mk-ink' }, surf, true);
    var cross = el('g', { class: 'mk-cross', visibility: 'hidden' }, surf, true);
    el('circle', { r: '9', fill: 'none', stroke: INK, 'stroke-width': '2' }, cross, true);
    el('path', { d: 'M-14 0H14M0 -14V14', stroke: INK, 'stroke-width': '1.5' }, cross, true);
    var bar = el('div', { role: 'toolbar', 'aria-label': 'Markup tools', class: 'mk-bar' }, root);
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:12px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;background:#111;color:#fff;padding:6px;border-radius:10px;max-width:calc(100vw - 16px);z-index:2';
    var live = el('p', { role: 'status', 'aria-live': 'polite', class: 'mk-live' }, root);
    live.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);margin:0;background:#111;color:#fff;padding:4px 10px;border-radius:8px;font:14px system-ui';
    var tools = {}, tool = 'pen', marks = [], cur = null, pins = 0, cx = Math.round(shot.w / 2), cy = Math.round(shot.h / 3);
    [['Pen', 'pen'], ['Arrow', 'arrow'], ['Box', 'box'], ['Note', 'note']].forEach(function (t) { tools[t[1]] = btn(t[0], bar); tools[t[1]].setAttribute('aria-pressed', 'false'); tools[t[1]].onclick = function () { choose(t[1]); surf.focus(); }; });
    btn('Undo', bar).onclick = undo;
    btn('Clear', bar).onclick = function () { marks.forEach(function (m) { m.node.remove(); }); marks = []; pins = 0; say('Cleared'); };
    btn('Cancel', bar).onclick = cancel;
    btn('Next', bar, 'primary').onclick = next;
    choose('pen');
    open = root;
    setTimeout(function () { surf.focus(); }, 0);
    say('Marking up this screen. Escape cancels.');

    function say(t) { live.textContent = t; }
    function choose(t) { tool = t; for (var k in tools) tools[k].setAttribute('aria-pressed', k === t ? 'true' : 'false'); }
    function undo() { var m = marks.pop(); if (m) { m.node.remove(); if (m.kind === 'note') pins--; say('Took back the last mark'); } }
    function outside(e) { if (e.key === 'Escape' && !root.contains(e.target)) { e.preventDefault(); cancel(); } }
    document.addEventListener('keydown', outside);
    function finish() { document.removeEventListener('keydown', outside); document.documentElement.style.overflow = prevOverflow; root.remove(); open = null; window.scrollTo(0, scrollY0); }
    function cancel() { finish(); }
    function newMark(kind, x, y) {
      var m = { kind: kind, points: [[x, y]] };
      if (kind === 'pen') m.node = el('path', { d: 'M' + x + ' ' + y, fill: 'none', stroke: INK, 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layer, true);
      if (kind === 'arrow') m.node = el('line', { x1: x, y1: y, x2: x, y2: y, stroke: INK, 'stroke-width': '4', 'marker-end': 'url(#mk-head)' }, layer, true);
      if (kind === 'box') m.node = el('rect', { x: x, y: y, width: 0, height: 0, fill: 'none', stroke: INK, 'stroke-width': '4', rx: '4' }, layer, true);
      return m;
    }
    function moveMark(m, x, y) {
      if (m.kind === 'pen') { m.points.push([x, y]); m.node.setAttribute('d', m.node.getAttribute('d') + ' L' + x + ' ' + y); }
      else { m.points[1] = [x, y]; var a = m.points[0]; if (m.kind === 'arrow') { m.node.setAttribute('x2', x); m.node.setAttribute('y2', y); } else { m.node.setAttribute('x', Math.min(a[0], x)); m.node.setAttribute('y', Math.min(a[1], y)); m.node.setAttribute('width', Math.abs(x - a[0])); m.node.setAttribute('height', Math.abs(y - a[1])); } }
    }
    function endMark(m) { marks.push(m); m.parts = partsAt(m.kind === 'box' && m.points[1] ? [m.points[0], m.points[1], [(m.points[0][0] + m.points[1][0]) / 2, (m.points[0][1] + m.points[1][1]) / 2]] : m.points.filter(function (p, i) { return i % 5 === 0; }).slice(0, 12)); say((m.kind[0].toUpperCase() + m.kind.slice(1)) + ' added'); }
    function addNote(x, y) {
      pins++;
      var n = pins, g = el('g', { class: 'mk-pin' }, layer, true);
      el('circle', { cx: x, cy: y, r: '12', fill: INK, stroke: '#fff', 'stroke-width': '2' }, g, true);
      var t = el('text', { x: x, y: y + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': '14', 'font-family': 'system-ui', 'font-weight': '700' }, g, true); t.textContent = String(n);
      var m = { kind: 'note', n: n, points: [[x, y]], node: g, text: '' };
      var box = el('div', { class: 'mk-note' }, root); box.style.cssText = 'position:fixed;left:' + Math.min(x + 16, shot.w - 240) + 'px;top:' + Math.min(y, shot.h - 80) + 'px;background:#fff;color:#111;padding:6px;border-radius:8px;z-index:3';
      var id = 'mk-note-' + n, lab = el('label', { for: id }, box); lab.textContent = 'Note ' + n; lab.style.cssText = 'display:block;font:600 13px system-ui';
      var inp = el('input', { id: id, type: 'text', maxlength: '120' }, box);
      inp.focus();
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); m.text = inp.value.trim(); box.remove(); if (m.text) { var tt = el('title', {}, g, true); tt.textContent = m.text; } marks.push(m); m.parts = partsAt(m.points); say('Note added'); surf.focus(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); box.remove(); g.remove(); pins--; surf.focus(); }
      });
    }
    // Mouse and touch.
    surf.addEventListener('pointerdown', function (e) {
      var r = surf.getBoundingClientRect(), x = Math.round(e.clientX - r.left), y = Math.round(e.clientY - r.top);
      if (tool === 'note') { addNote(x, y); return; }
      cur = newMark(tool, x, y); surf.setPointerCapture(e.pointerId);
    });
    surf.addEventListener('pointermove', function (e) { if (!cur) return; var r = surf.getBoundingClientRect(); moveMark(cur, Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)); });
    surf.addEventListener('pointerup', function () { if (cur) { endMark(cur); cur = null; } });
    // The keyboard alone.
    function showCross() { cross.setAttribute('visibility', 'visible'); cross.setAttribute('transform', 'translate(' + cx + ' ' + cy + ')'); }
    surf.addEventListener('focus', showCross);
    root.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { e.preventDefault(); if (cur) { cur.node.remove(); cur = null; say('Mark stopped'); } else cancel(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
      if (e.target !== surf) return;
      var d = e.shiftKey ? 40 : 8;
      if (e.key === 'ArrowLeft') cx = Math.max(0, cx - d); else if (e.key === 'ArrowRight') cx = Math.min(shot.w, cx + d);
      else if (e.key === 'ArrowUp') cy = Math.max(0, cy - d); else if (e.key === 'ArrowDown') cy = Math.min(shot.h, cy + d);
      else if (e.key === 'p' || e.key === 'P') { choose('pen'); return; } else if (e.key === 'a' || e.key === 'A') { choose('arrow'); return; }
      else if (e.key === 'b' || e.key === 'B') { choose('box'); return; } else if (e.key === 'n' || e.key === 'N') { choose('note'); return; }
      else if (e.key === 'Enter') { e.preventDefault(); if (tool === 'note') addNote(cx, cy); else if (!cur) { cur = newMark(tool, cx, cy); say('Mark started: move, then Enter'); } else { endMark(cur); cur = null; } return; }
      else return;
      e.preventDefault(); showCross(); if (cur) moveMark(cur, cx, cy);
    });

    function inkSvg() {
      var c = surf.cloneNode(true); c.removeAttribute('style'); c.removeAttribute('tabindex'); c.removeAttribute('role'); c.removeAttribute('aria-label'); c.removeAttribute('class');
      var cr = c.querySelector('.mk-cross'); if (cr) cr.remove();
      c.setAttribute('xmlns', NS);
      return new XMLSerializer().serializeToString(c);
    }
    function marked(ink) { // the screen with the drawing on it, as one picture
      return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + shot.w + '" height="' + shot.h + '" viewBox="0 0 ' + shot.w + ' ' + shot.h + '"><image width="' + shot.w + '" height="' + shot.h + '" href="' + xmlText(url(shot.svg)).replace(/"/g, '&quot;') + '"/><image width="' + shot.w + '" height="' + shot.h + '" href="' + xmlText(url(ink)).replace(/"/g, '&quot;') + '"/></svg>';
    }
    function next() {
      if (cur) { endMark(cur); cur = null; }
      bar.hidden = true; surf.style.pointerEvents = 'none';
      var ink = inkSvg();
      var dlg = el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send the markup', class: 'mk-send' }, root);
      dlg.style.cssText = 'position:fixed;inset:auto 0 0 0;margin:auto;max-height:100vh;overflow:auto;max-width:560px;background:var(--panel,#fff);color:var(--ink,#111);padding:16px;border-radius:12px 12px 0 0;z-index:4;font:15px/1.4 system-ui';
      var h = el('h2', {}, dlg); h.textContent = 'Send the markup'; h.style.margin = '0 0 8px';
      var pv = el('div', { class: 'mk-preview' }, dlg); var pimg = el('img', { alt: 'The picture that will be sent: your screen with your marks', src: url(marked(ink)) }, pv); pimg.style.cssText = 'width:100%;border:1px solid #ccc;border-radius:6px;max-height:40vh;object-fit:contain;background:#000';
      var lab = el('label', { for: 'mk-line' }, dlg); lab.textContent = 'What should change?'; lab.style.cssText = 'display:block;font-weight:600;margin-top:10px';
      var line = el('input', { id: 'mk-line', type: 'text', maxlength: '200', 'aria-describedby': 'mk-line-err' }, dlg); line.style.cssText = 'width:100%;min-height:44px;font:inherit';
      var err = el('p', { id: 'mk-line-err', class: 'err' }, dlg); err.style.color = '#b3261e';
      var mg = el('div', { role: 'group', 'aria-label': 'How is the app working for you?' }, dlg); var mlab = el('p', {}, mg); mlab.textContent = 'How is the app working for you? (optional)';
      var mood = null; MOODS.forEach(function (m) { var b = btn(m[1], mg); b.setAttribute('aria-pressed', 'false'); b.onclick = function () { mood = mood === m[0] ? null : m[0]; [].forEach.call(mg.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b && mood ? 'true' : 'false'); }); }; });
      var tickL = el('label', {}, dlg); tickL.style.cssText = 'display:block;margin-top:10px;font-weight:400';
      var tick = el('input', { type: 'checkbox', checked: '' }, tickL); tick.checked = true; tickL.appendChild(document.createTextNode(' Include my last 20 steps on this visit '));
      var help = el('a', { href: '/help/feedback', target: '_blank' }, dlg); help.textContent = 'What’s sent';
      var row = el('p', {}, dlg); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
      btn('Back', row).onclick = function () { dlg.remove(); bar.hidden = false; surf.style.pointerEvents = ''; surf.focus(); };
      btn('Cancel', row).onclick = cancel;
      var sendB = btn('Send', row, 'primary');
      line.focus();
      sendB.onclick = function () {
        if (!line.value.trim()) { err.textContent = 'Say what should change first'; err.setAttribute('role', 'alert'); line.setAttribute('aria-invalid', 'true'); line.focus(); return; }
        sendB.disabled = true;
        var allParts = []; marks.forEach(function (m) { (m.parts || []).forEach(function (p) { if (allParts.indexOf(p) < 0) allParts.push(p); }); });
        var body = {
          line: line.value.trim(), mood: mood, screen: shot.svg, ink: ink, marked: marked(ink),
          strokes: marks.filter(function (m) { return m.kind !== 'note'; }).map(function (m) { return { kind: m.kind, points: m.points, parts: m.parts }; }),
          pins: marks.filter(function (m) { return m.kind === 'note'; }).map(function (m) { return { n: m.n, at: m.points[0], text: m.text, parts: m.parts }; }),
          parts: allParts, route: location.pathname + location.search, viewport: { w: shot.w, h: shot.h }, theme: shot.theme,
          accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), version: document.documentElement.getAttribute('data-version') || 'rebuild',
          steps: tick.checked ? get(SK) : [], errors: get(EK), from: location.origin,
        };
        fetch('/feedback/markup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
          if (!res.ok) { err.textContent = res.j.error || 'It didn’t send. Try again.'; err.setAttribute('role', 'alert'); sendB.disabled = false; return; }
          finish();
          var t = el('p', { role: 'status', class: 'mk-toast' }, document.body); t.textContent = 'Sent. You’ll hear when it’s fixed.';
          t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:84px;background:#111;color:#fff;padding:8px 14px;border-radius:8px;z-index:50';
          setTimeout(function () { t.remove(); }, 6000);
        }).catch(function () { err.textContent = 'It didn’t send. Try again.'; err.setAttribute('role', 'alert'); sendB.disabled = false; });
      };
    }
  }
})();
