// Feedback, in the browser, on every page while the module is on: the visit's last 20 steps and errors (sent only with a
// markup), Ctrl+Shift+M (Cmd+Shift+M) to mark up the screen, the Send feedback sheet, and the inbox's buttons and keys.
// The markup itself (markup.js) is loaded only when a markup starts. Off, this file isn't on the page at all.
const SS = { get: (k, d) => { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const main = document.querySelector('main');
const here = location.pathname + location.search;

// ---------- the visit: steps (pages opened, buttons pressed, never what was typed) and errors ----------
const step = (s) => { const l = SS.get('fb-steps', []); l.push({ ...s, at: new Date().toISOString() }); SS.set('fb-steps', l.slice(-20)); };
step({ kind: 'page', path: location.pathname });
document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a, summary, [role=button]');
  if (b && !b.closest('.markup-root')) step({ kind: 'press', name: (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) });
}, true);
const err = (message) => { const l = SS.get('fb-errors', []); l.push({ message: String(message).slice(0, 300), path: location.pathname, at: new Date().toISOString() }); SS.set('fb-errors', l.slice(-20)); };
addEventListener('error', (e) => err(e.message));
addEventListener('unhandledrejection', (e) => err(e.reason?.message || e.reason));
// the last screen, for Mark up the last screen (any page but Feedback's own)
if (location.pathname !== '/feedback') SS.set('fb-last', { path: here, name: main?.dataset.name || document.title });

// ---------- marking up ----------
let starting = false;
async function startMarkup() {
  if (starting || document.querySelector('.markup-root')) return;
  starting = true;
  try { const m = await import('/m/feedback/static/markup.js'); await m.start(); } finally { starting = false; }
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); startMarkup(); }
});
if (SS.get('fb-markup', false)) { SS.set('fb-markup', false); (document.fonts?.ready || Promise.resolve()).then(() => setTimeout(startMarkup, 150)); }

// ---------- Send feedback: the sheet ----------
const MOODS = [['good', 'It works well'], ['meh', 'It’s OK'], ['bad', 'It gets in the way']];
function openSheet() {
  const last = SS.get('fb-last', null);
  const d = document.createElement('dialog');
  d.className = 'fb-sheet';
  d.setAttribute('aria-label', 'How is the app working for you?');
  d.innerHTML = `<h2>How is the app working for you?</h2>
    ${last ? `<p class="fb-from">You came from ${esc(last.name)}.</p><button type="button" class="primary" data-mk-last>Mark up the last screen</button>` : '<p class="fb-from">Open the screen you mean, then press Ctrl+Shift+M to mark it up.</p>'}
    <p class="fb-or">Or say how it’s working:</p>
    <div class="fb-moods" role="group" aria-label="How it’s working">${MOODS.map(([v, l]) => `<button type="button" aria-pressed="false" data-mood="${v}">${l}</button>`).join('')}</div>
    <label>A few words <textarea name="text" rows="3"></textarea></label>
    <p class="fb-alert" role="alert" hidden></p>
    <p class="fb-buttons"><button type="button" data-fb-send>Send</button> <button type="button" data-fb-cancel>Cancel</button></p>`;
  document.body.append(d);
  d.showModal();
  let mood = '';
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mood]');
    if (m) { mood = m.dataset.mood; d.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b === m))); }
    if (e.target.closest('[data-fb-cancel]')) d.close();
    if (e.target.closest('[data-mk-last]')) { SS.set('fb-markup', true); location.href = last.path; }
    if (e.target.closest('[data-fb-send]')) {
      const text = d.querySelector('textarea').value;
      const alert = d.querySelector('.fb-alert');
      if (!mood || !text.trim()) { alert.hidden = false; alert.textContent = !mood ? 'Choose how it’s working first.' : 'Say in a few words how it’s working first.'; return; }
      const r = await fetch('/m/feedback/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mood, text, path: last ? last.path : here }) });
      const j = await r.json();
      if (!r.ok) { alert.hidden = false; alert.textContent = j.error; return; }
      location.href = '/feedback?sent=feedback';
    }
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- the inbox ----------
const inbox = document.getElementById('inbox');
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-fb-sheet]')) openSheet();
  const c = e.target.closest('[data-connect]');
  if (c) { const s = inbox.querySelector('.connect'); s.hidden = !s.hidden; c.setAttribute('aria-expanded', String(!s.hidden)); }
  const f = e.target.closest('[data-mkform]');
  if (f) {
    const scope = f.closest('.ibx-detail, .ibx-bulk');
    scope.querySelectorAll('.mk-form').forEach((x) => { x.hidden = x.dataset.form !== f.dataset.mkform; });
    const open = scope.querySelector(`.mk-form[data-form="${f.dataset.mkform}"]`);
    open.querySelector('textarea, select')?.focus();
  }
  const x = e.target.closest('[data-mkform-close]');
  if (x) x.closest('.mk-form').hidden = true;
  const i = e.target.closest('[data-issue]');
  if (i) window.open(i.dataset.issue.replace(encodeURIComponent('{origin}'), encodeURIComponent(location.origin)), '_blank');
});
if (inbox) {
  inbox.querySelectorAll('[data-origin]').forEach((x) => { x.textContent = location.origin; });
  inbox.querySelectorAll('[data-origin-value]').forEach((x) => { x.value = x.value.replace('{origin}', location.origin); });
  inbox.addEventListener('change', (e) => {
    if (e.target.matches('[data-show-ink]')) {
      const layers = inbox.querySelector('.mk-layers');
      const ink = layers.querySelector('.mk-ink-layer');
      if (!e.target.checked && ink) { layers._ink = ink; ink.remove(); } else if (e.target.checked && layers._ink) layers.append(layers._ink);
    }
    if (e.target.matches('.ibx-kind [data-autosubmit]')) e.target.form.requestSubmit();
    if (e.target.matches('[data-select-page]')) inbox.querySelectorAll('.ibx-sel').forEach((b) => { b.checked = e.target.checked; });
    if (e.target.matches('[data-select-page], .ibx-sel')) bulkState();
  });
  inbox.addEventListener('input', async (e) => {
    if (e.target.matches('[data-needs-text]')) e.target.closest('.mk-form').querySelector('button[type=submit]').disabled = !e.target.value.trim();
    if (e.target.matches('[data-who]')) {
      const form = e.target.form, sp = new URLSearchParams(new FormData(form));
      const r = await fetch(`/m/feedback/count?${sp}`); const { n } = await r.json();
      form.querySelector('[data-show-n]').textContent = `Show ${n} ${n === 1 ? 'item' : 'items'}`;
    }
  });
  // the address keeps only what is set, so Back and a shared link show the same list
  inbox.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.method !== 'get') return;
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(f)) if (String(v).trim() && !(k === 'kind' && v === 'all')) sp.set(k, String(v).trim());
    location.href = `/feedback${sp.toString() ? `?${sp}` : ''}`;
  });
  const bulkState = () => {
    const sel = [...inbox.querySelectorAll('.ibx-sel:checked')];
    const n = sel.reduce((s, b) => s + Number(b.dataset.n || 1), 0);
    const acts = inbox.querySelector('.ibx-bulk-actions');
    if (acts) acts.hidden = !sel.length;
    if (!sel.length) inbox.querySelectorAll('.ibx-bulk .mk-form').forEach((x) => { x.hidden = true; });
    inbox.querySelectorAll('[data-n-label]').forEach((b) => { b.textContent = b.dataset.nLabel.replace('{n}', n); });
  };
  // keys on a computer: J and K move, I in hand, F fixed, W won't fix
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || matchMedia('(max-width: 700px)').matches) return;
    if (e.target.closest('input, textarea, select, [contenteditable], dialog, .markup-root')) return;
    const k = e.key.toLowerCase();
    const rows = [...inbox.querySelectorAll('.ibx-row')];
    const cur = rows.findIndex((r) => r.hasAttribute('aria-current'));
    if (k === 'j' || k === 'k') {
      const to = rows[k === 'j' ? (cur < 0 ? 0 : Math.min(cur + 1, rows.length - 1)) : Math.max(cur - 1, 0)];
      if (to) { e.preventDefault(); location.href = to.querySelector('.ibx-open').href; }
    }
    const b = { i: '[data-key=i]', f: '[data-key=f]', w: '[data-key=w]' }[k];
    const btn = b && inbox.querySelector(`.ibx-detail ${b}`);
    if (btn) { e.preventDefault(); btn.click(); }
  });
  const open = inbox.querySelector('.ibx-row[aria-current]');
  if (open && !matchMedia('(max-width: 700px)').matches) open.scrollIntoView({ block: 'nearest' });
}
