// The page's own behaviour: the back link from this tab's history, live list searches, Find (Ctrl K), pickers.
const main = document.getElementById('main');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- this tab's history, for the back link (navigation rule 4) ----------
let stack = [];
try { stack = JSON.parse(sessionStorage.getItem('faro-stack') || '[]'); } catch {}
const here = { address: location.pathname + location.search, name: main.dataset.name, form: main.dataset.form === '1' };
let idx = history.state && typeof history.state.idx === 'number' ? history.state.idx : null;
if (idx === null) { idx = stack.length ? Math.min(stack.length, (Number(sessionStorage.getItem('faro-idx') ?? -1) + 1)) : 0; stack = stack.slice(0, idx); stack.push(here); history.replaceState({ idx }, ''); }
else stack[idx] = here;
sessionStorage.setItem('faro-stack', JSON.stringify(stack));
sessionStorage.setItem('faro-idx', String(idx));
function samePage(a, b) {
  if (a.address === b.address) return true;
  const ra = new URLSearchParams(a.address.split('?')[1] || '').get('review'), rb = new URLSearchParams(b.address.split('?')[1] || '').get('review');
  return ra && ra === rb && a.address.startsWith('/goals/') && b.address.startsWith('/goals/');
}
const backWords = (e) => { const [p, q = ''] = e.address.split('?'); if (p === '/goals' && new URLSearchParams(q).get('scope') === 'mine') return 'your goals'; return e.name.split(' · ')[0] === e.name ? e.name : e.name; };
if (main.dataset.first !== '1' && main.dataset.form !== '1') {
  let link = null;
  for (let i = idx - 1; i >= 0; i--) { const e = stack[i]; if (!e || e.form || samePage(e, here)) continue; link = { label: backWords(e), steps: idx - i }; break; }
  if (!link && main.dataset.parent) link = { label: main.dataset.parentLabel, to: main.dataset.parent };
  if (link) {
    const a = document.createElement('a');
    a.className = 'backlink'; a.textContent = `‹ ${link.label}`; a.setAttribute('aria-label', `Back to ${link.label}`);
    a.href = link.to || stack[idx - link.steps].address;
    if (link.steps) a.addEventListener('click', (ev) => { ev.preventDefault(); history.go(-link.steps); });
    main.querySelector('.backslot').append(a);
  }
}
// the browser's Back onto a form you left steps over it
if (main.dataset.form === '1' && performance.getEntriesByType('navigation')[0]?.type === 'back_forward' && idx < stack.length - 1) history.back();

// ---------- live list searches: the first key adds a history entry, later keys replace it ----------
for (const box of document.querySelectorAll('input[data-live]')) {
  let timer = null, pushed = false;
  box.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const u = new URL(location.href);
      if (box.value) u.searchParams.set('q', box.value); else u.searchParams.delete('q');
      const html = await (await fetch(u.pathname + u.search)).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.getElementById('main');
      const nbox = next.querySelector('input[data-live]');
      if (nbox) nbox.replaceWith(box);
      const nslot = next.querySelector('.backslot'), slot = main.querySelector('.backslot');
      if (nslot && slot) nslot.replaceWith(slot);
      main.replaceChildren(...next.childNodes);
      box.focus();
      if (!pushed) { history.pushState({ idx: idx + 1 }, '', u.pathname + u.search); pushed = true; idx += 1; stack = stack.slice(0, idx); stack.push({ ...here, address: u.pathname + u.search }); sessionStorage.setItem('faro-stack', JSON.stringify(stack)); sessionStorage.setItem('faro-idx', String(idx)); }
      else history.replaceState(history.state, '', u.pathname + u.search);
      shownAt = u.pathname + u.search;
      document.title = doc.title;
    }, 120);
  });
}
let shownAt = location.pathname + location.search;
window.addEventListener('popstate', () => { if (location.pathname + location.search !== shownAt) location.reload(); });
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-clear]');
  if (c) { e.preventDefault(); const u = new URL(location.href); u.searchParams.delete('q'); location.assign(u.pathname + u.search); return; }
  const r = e.target.closest('tr[data-href]');
  if (r && !e.target.closest('a')) location.assign(r.dataset.href);
});

// ---------- Find, from anywhere ----------
let dialog = null;
function openFind() {
  if (dialog) return;
  dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', 'Find'); dialog.setAttribute('aria-modal', 'true'); dialog.className = 'find';
  dialog.innerHTML = `<input role="combobox" aria-label="Find" aria-expanded="true" aria-controls="find-list" placeholder="Find a goal, person or team"><div id="find-list" role="listbox"><p class="hint">Type a name, a key like G-48, or a few words.</p></div>`;
  document.body.append(dialog);
  const box = dialog.querySelector('input'), list = dialog.querySelector('#find-list');
  box.focus();
  let seq = 0;
  box.addEventListener('input', async () => {
    const n = ++seq;
    const q = box.value;
    if (!q.trim()) { list.innerHTML = '<p class="hint">Type a name, a key like G-48, or a few words.</p>'; return; }
    const r = await (await fetch(`/api/find?q=${encodeURIComponent(q)}`)).json();
    if (n !== seq) return;
    const NAMES = { goal: ['Goals', 'goal', 'goals', '/goals?scope=all&q='], person: ['People', 'person', 'people', '/people?q='], team: ['Teams', 'team', 'teams', '/teams?q='] };
    list.innerHTML = r.groups.length ? r.groups.map((g) => { const [N, one, many, all] = NAMES[g.kind]; return `<div role="group" aria-label="${N} · ${g.total}"><p class="ghead">${N} · ${g.total}</p>${g.rows.map((x) => `<a role="option" href="${x.href}">${esc(x.title)}<span class="gline">${esc(x.line)}</span></a>`).join('')}${g.total > g.rows.length ? `<a role="option" href="${all}${encodeURIComponent(q)}">See all ${g.total} ${g.total === 1 ? one : many}</a>` : ''}</div>`; }).join('') : `<p>Nothing matches “${esc(q)}”.</p>`;
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeFind(); }
    if (e.key === 'Enter') { const first = list.querySelector('[role=option]'); if (first) location.assign(first.getAttribute('href')); }
  });
}
function closeFind() { dialog?.remove(); dialog = null; }
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openFind(); } else if (e.key === 'Escape') closeFind(); });
for (const b of document.querySelectorAll('[data-find]')) b.addEventListener('click', openFind);

// ---------- find-and-pick ----------
for (const box of document.querySelectorAll('input[data-pick]')) {
  const wrap = box.closest('.picker');
  const out = document.createElement('div'); out.setAttribute('role', 'listbox'); out.className = 'pick-list'; box.after(out);
  box.addEventListener('input', async () => {
    const r = await (await fetch(`/api/pick?kind=${box.dataset.pick}&q=${encodeURIComponent(box.value)}`)).json();
    out.innerHTML = `<p class="pcount">${r.total} found</p>` + r.rows.map((x) => `<button type="button" role="option" data-id="${x.id}">${esc(x.title)} <span class="gline">${esc(x.line)}</span></button>`).join('');
  });
  out.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; wrap.querySelector('input[type=hidden]').value = b.dataset.id; wrap.querySelector('.chosen').textContent = b.firstChild.textContent.trim(); out.innerHTML = ''; box.value = ''; });
}

// a choice of buttons sets its hidden field
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-set]');
  if (!b) return;
  const g = b.closest('[role=group]');
  g.querySelector(`input[name="${b.dataset.set}"]`).value = b.dataset.value;
  for (const x of g.querySelectorAll('button[data-set]')) x.setAttribute('aria-pressed', String(x === b));
});

// the goal bar's Respond opens the ask's panel
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open-ask]');
  if (!b) return;
  const row = document.querySelector(`.step-row[data-ask="${b.dataset.openAsk}"] details`);
  if (row) { row.open = true; row.querySelector('textarea')?.focus(); }
});

// dialogs: open, close, and a form that says what it needs before it posts
document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-dialog]');
  if (o) { const d = document.getElementById(o.dataset.dialog); d?.showModal(); d?.querySelector('textarea, input:not([type=hidden])')?.focus(); }
  const c = e.target.closest('[data-close-dialog]');
  if (c) c.closest('dialog')?.close();
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-must]');
  if (!f) return;
  const v = f.querySelector(`[name="${f.dataset.must}"]`).value.trim();
  if (v.length < 10) { e.preventDefault(); f.querySelector('.fix-line').hidden = false; }
});
