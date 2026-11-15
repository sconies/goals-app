// The Feedback module: Send feedback, Mark up this screen (Ctrl+Shift+M), the builders' inbox at /feedback, and its AI tools.
// It registers into the core's extension points (app/modules.mjs); the core decides whether it is on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeInbox } from './store.mjs';
import { STATUS_WORD, TAB_OF, MOODS, ONLY_ADMIN, checkFeedback, checkMarkup, triage, pick, doneWords, byWords, foldKey, raised } from './rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = fs.readFileSync(path.join(here, 'client.js'), 'utf8');
const PAGE_SIZE = 25;
const TABS = [['new', 'New'], ['in-hand', 'In hand'], ['closed', 'Closed']];
const EMPTY = { new: 'Nothing new.', 'in-hand': 'Nothing is in hand.', closed: 'Nothing is closed yet.' };
const PICTURES = ['screen.svg', 'ink.svg', 'marked.svg'];

export function register(core) {
  const inbox = makeInbox();
  const { esc } = core;
  const last = new Map(); // viewer -> the last change, for Undo: { items: [{ id, before }], words, openId }
  const flashes = new Map(); // viewer -> words to say once

  // ---------- shapes: status is a shape and a word ----------
  function shape(st) {
    const b = 'width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" class="shape"';
    if (st === 'new') return `<svg ${b}><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>`;
    if (st === 'in-hand') return `<svg ${b}><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill="currentColor"/></svg>`;
    if (st === 'fixed') return `<svg ${b}><circle cx="7" cy="7" r="5.5" fill="currentColor"/><path d="M4.2 7.2 l2 2 l3.6-4" fill="none" stroke="var(--bg)" stroke-width="1.6"/></svg>`;
    return `<svg ${b}><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.2 10.8 L10.8 3.2" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }
  const statusHtml = (st) => `<span class="mk-st">${shape(st)} <span>${esc(STATUS_WORD[st])}</span></span>`;
  const day = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`; };
  const where = (x) => {
    let s = `${x.workspace}${x.demo ? ', the demo' : ''}`;
    if (x.from && /localhost|127\.0\.0\.1/.test(x.from)) s += ', from a laptop';
    else if (x.from && /preview|vercel\.app/.test(x.from)) s += ', from a preview build';
    return s;
  };
  const what = (x) => (x.kind === 'markup' ? x.line : x.text || MOODS[x.mood]);
  const pathOf = (r) => String(r || '').split('?')[0];

  // ---------- reading the inbox ----------
  function listFor(p) {
    const tab = TABS.some(([t]) => t === p.get('tab')) ? p.get('tab') : 'new';
    const q = (p.get('q') || '').trim().toLowerCase(), kind = p.get('kind') || 'all', page = p.get('page') || '', from = p.get('from') || '';
    const all = inbox.all();
    const counts = { new: 0, 'in-hand': 0, closed: 0 };
    for (const x of all) counts[TAB_OF[x.status]]++;
    let items = all.filter((x) => TAB_OF[x.status] === tab);
    if (kind !== 'all') items = items.filter((x) => x.kind === kind);
    if (page) items = items.filter((x) => pathOf(x.route || x.path) === page);
    if (from) items = items.filter((x) => (x.personName || '').toLowerCase() === from.toLowerCase());
    if (q) items = items.filter((x) => [what(x), ...(x.parts || []), x.route || x.path, x.personName, x.workspace].join(' ').toLowerCase().includes(q));
    const rows = []; const byKey = new Map();
    for (const x of items) { const k = foldKey(x); if (!byKey.has(k)) { const r = { key: k, items: [] }; byKey.set(k, r); rows.push(r); } byKey.get(k).items.push(x); }
    for (const r of rows) r.lead = r.items[0];
    const pages = [...new Set(all.map((x) => pathOf(x.route || x.path)))].sort();
    const senders = [...new Set(all.map((x) => x.personName).filter(Boolean))].sort();
    return { tab, q: p.get('q') || '', kind, page, from, rows, counts, pages, senders, total: items.length };
  }
  const newCount = () => inbox.all().filter((x) => x.status === 'new').length;

  function qs(p, over = {}) {
    const o = new URLSearchParams();
    for (const k of ['tab', 'q', 'kind', 'page', 'from', 'p', 'open']) { const v = k in over ? over[k] : p.get(k); if (v !== null && v !== undefined && v !== '' && !(k === 'tab' && v === 'new') && !(k === 'kind' && v === 'all') && !(k === 'p' && String(v) === '1')) o.set(k, v); }
    const s = o.toString();
    return `/feedback${s ? `?${s}` : ''}`;
  }

  // ---------- the page ----------
  function inboxPage(ctx, url) {
    const p = url.searchParams, admin = core.isAdmin(ctx.viewer);
    if (p.get('markup') && !p.get('open')) p.set('open', p.get('markup'));
    const L = listFor(p);
    const pages = Math.max(1, Math.ceil(L.rows.length / PAGE_SIZE));
    let pg = Math.min(pages, Math.max(1, Number(p.get('p')) || 1));
    let openRow = p.get('open') ? L.rows.find((r) => r.items.some((x) => x.id === p.get('open'))) : null;
    let openItem = openRow ? openRow.items.find((x) => x.id === p.get('open')) : null;
    if (!openRow && p.get('open')) { openItem = inbox.get(p.get('open')); }
    if (openRow) pg = Math.floor(L.rows.indexOf(openRow) / PAGE_SIZE) + 1;
    const shown = L.rows.slice((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE);
    const explicit = !!openItem;
    if (!openItem && shown.length) { openRow = shown[0]; openItem = openRow.lead; }
    const filtersOn = [L.kind !== 'all' && ['kind', 'Kind', L.kind === 'markup' ? 'Markups' : 'Feedback'], L.page && ['page', 'Page', L.page], L.from && ['from', 'From', L.from]].filter(Boolean);
    const flash = flashes.get(ctx.viewer); flashes.delete(ctx.viewer);
    const lastCh = last.get(ctx.viewer);
    const top = `<div class="ibx-top"><h1>Feedback</h1><p class="sub">From every workspace and the demo</p>
<p class="ibx-actions"><a class="btn" role="button" href="/feedback?send=1" data-sheet>Send feedback</a> <button type="button" class="btn" aria-expanded="false" data-connect>Connect Claude</button></p>
${connectHtml(ctx, url)}
${p.get('sent') ? '<p role="status" class="ibx-flash">Thanks. It goes to the people building this app, who read every one.</p>' : ''}
${flash ? `<p role="status" class="ibx-flash">${esc(flash)}${lastCh && admin ? ` <button class="btn" form="ibx-undo">Undo</button>` : ''}</p><form id="ibx-undo" method="post" action="/feedback/undo"><input type="hidden" name="back" value="${esc(qs(p, { open: null }))}"></form>` : ''}</div>`;
    const tabs = `<div role="tablist" aria-label="Status" class="ibx-tabs">${TABS.map(([t, l]) => `<a role="tab" href="${esc(qs(p, { tab: t, p: null, open: null }))}" aria-selected="${t === L.tab}">${l} <span class="count">${L.counts[t]}</span></a>`).join('')}</div>`;
    const kindSel = (cls) => `<label class="${cls}">Kind <select name="kind" aria-label="Kind"${cls === 'ibx-kind-inline' ? ' onchange="this.form.submit()"' : ''}>${[['all', 'All'], ['markup', 'Markups'], ['feedback', 'Feedback']].map(([v, l]) => `<option value="${v}"${L.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
    const keep = (skip) => ['tab', 'kind', 'page', 'from'].filter((k) => k !== skip).map((k) => (p.get(k) ? `<input type="hidden" name="${k}" value="${esc(p.get(k))}">` : '')).join('');
    const search = `<form class="ibx-search" method="get" action="/feedback" role="search">${keep('kind')}<input type="search" name="q" aria-label="Find feedback" placeholder="What was said, the part, the page or who sent it" value="${esc(L.q)}"> ${kindSel('ibx-kind-inline')} <button class="btn" type="submit">Find</button>${L.q ? ` <a class="btn" role="button" href="${esc(qs(p, { q: null, p: null, open: null }))}">Clear the search</a>` : ''} <button type="button" class="btn" data-filters>Filters</button></form>`;
    const countLine = L.q || filtersOn.length ? `<p class="count-line" aria-live="polite">${L.rows.length === 0 ? (L.q ? `No item matches “${esc(L.q)}”.` : 'No item matches.') : L.rows.length === 1 ? '1 item matches.' : `${L.rows.length} items match.`}</p>` : '';
    const filterLine = filtersOn.length ? `<p class="filter-line">Filtered by: ${filtersOn.map(([k, l, v]) => `${l} ${esc(v)} <a class="btn" role="button" aria-label="Remove the filter ${l}" href="${esc(qs(p, { [k]: null, p: null, open: null }))}">Remove</a>`).join(' ')}${filtersOn.length >= 2 ? ` <a class="btn" role="button" href="${esc(qs(p, { kind: null, page: null, from: null, p: null, open: null }))}">Clear filters</a>` : ''}</p>` : '';
    const filterDlg = `<dialog class="ibx-filters" aria-label="Filter feedback"><form method="get" action="/feedback">${['tab', 'q'].map((k) => (p.get(k) ? `<input type="hidden" name="${k}" value="${esc(p.get(k))}">` : '')).join('')}<h2>Filter feedback</h2>
${kindSel('ibx-kind-phone')}
<label>Page <select name="page" aria-label="Page"><option value="">Any page</option>${L.pages.map((x) => `<option${x === L.page ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
<label>From <input name="from" aria-label="From" list="ibx-senders" value="${esc(L.from)}" placeholder="Type a name" autocomplete="off"></label><datalist id="ibx-senders">${L.senders.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
<p><button class="btn primary" type="submit">Show ${L.total} items</button> <button class="btn" type="button" data-close>Cancel</button></p></form></dialog>`;
    const rowsHtml = shown.length ? `<form id="ibx-bulkform" method="post" action="/feedback/triage"><input type="hidden" name="back" value="${esc(qs(p, { open: null }))}">
${admin ? `<p class="ibx-select"><label><input type="checkbox" data-selectall> Select this page</label></p>` : ''}
<ul class="ibx-list" aria-label="Inbox">${shown.map((r, i) => {
      const x = r.lead, n = r.items.length;
      const line = x.kind === 'markup' ? `${n > 1 ? `${n} on this part · ` : ''}${esc((x.parts || [])[0] || pathOf(x.route))} · ${esc(pathOf(x.route))}` : `Feedback · ${esc(MOODS[x.mood] || '')} · ${esc(pathOf(x.path))}`;
      return `<li class="ibx-row ${x.kind === 'markup' ? 'mk-item' : 'fb-item'}${openRow === r ? ' is-open' : ''}" data-open-href="${esc(qs(p, { open: x.id, p: String(pg) }))}" aria-label="Inbox row">${admin ? `<input type="checkbox" name="id" value="${esc(r.items.map((y) => y.id).join(','))}" data-n="${n}" aria-label="Select “${esc(what(x))}”">` : ''}
<a class="ibx-open" href="${esc(qs(p, { open: x.id, p: String(pg) }))}"${openRow === r ? ' aria-current="true"' : ''}>${statusHtml(x.status)} ${x.kind === 'markup' ? (inbox.hasPictures(x.id) ? `<img class="ibx-thumb" alt="" src="/feedback/pictures/${esc(x.id)}/marked.svg" loading="lazy">` : '') : '<span class="ibx-speech" aria-hidden="true">“”</span>'}<strong>${esc(what(x))}</strong><br><span class="meta">${line} · ${esc(x.personName || 'Someone')} · ${esc(where(x))} · ${day(x.at)}</span></a></li>`;
    }).join('')}</ul>
${admin ? `<div class="ibx-bulk" hidden><p><span data-ticked>0</span> ticked. <button class="btn" name="status" value="in-hand">Mark in hand</button> <button type="button" class="btn" data-show="bulk-fixed">Mark fixed…</button> <button type="button" class="btn" data-show="bulk-wont">Won’t fix…</button> <button class="btn" name="status" value="new">Mark new again</button></p>
<div class="mk-form" id="bulk-fixed" hidden>${fixedField('bulk')}<button class="btn primary" name="status" value="fixed" data-label="Mark N fixed">Mark N fixed</button></div>
<div class="mk-form" id="bulk-wont" hidden><label for="bulk-why">Why it won’t be fixed</label><input id="bulk-why" name="reason"><button class="btn primary" name="status" value="wont-fix" data-label="Won’t fix N" data-needs="bulk-why">Won’t fix N</button></div></div>` : ''}
</form>
${pages > 1 ? `<p class="ibx-pager">Page ${pg} of ${pages} ${pg > 1 ? `<a class="btn" href="${esc(qs(p, { p: String(pg - 1), open: null }))}">Earlier page</a>` : ''} ${pg < pages ? `<a class="btn" href="${esc(qs(p, { p: String(pg + 1), open: null }))}">Next page</a>` : ''}</p>` : ''}` : `<p class="ibx-empty">${L.q || filtersOn.length ? '' : EMPTY[L.tab]}</p>`;
    const idx = openRow ? L.rows.indexOf(openRow) : -1;
    const nextRow = idx >= 0 ? L.rows[idx + 1] : null;
    const detail = openItem ? detailHtml(ctx, openItem, openRow ? openRow.items : [openItem], { admin, p, idx, total: L.rows.length, nextRow, prevRow: idx > 0 ? L.rows[idx - 1] : null }) : '';
    const body = `<div id="inbox" class="ibx${explicit ? ' has-open' : ''}" data-admin="${admin ? 1 : 0}">${top}${tabs}${search}${countLine}${filterLine}${filterDlg}
<div class="ibx-split"><div class="ibx-listwrap">${rowsHtml}</div>${detail}</div></div>${sheetHtml(ctx, url)}<style>${CSS}</style><script>${INBOX_JS}</script>`;
    return core.layout(ctx, { address: url.pathname + url.search, body, page: 'Feedback' });
  }

  function fixedField(prefix) {
    const entries = core.whatsNewEntries();
    return `<label for="${prefix}-fixed">Fixed in, the What’s new entry</label><select id="${prefix}-fixed" name="fixedIn">${entries.map((e, i) => `<option value="${esc(e.id)}"${i === 0 ? ' selected' : ''}>${esc(e.title)}</option>`).join('')}</select>`;
  }

  function detailHtml(ctx, x, group, o) {
    const n = group.length, admin = o.admin, label = x.kind === 'markup' ? 'Markup' : 'Feedback';
    const ids = group.map((y) => y.id).join(',');
    const all = n > 1 ? ` (all ${n})` : '';
    const nextOpen = o.nextRow ? o.nextRow.lead.id : o.prevRow ? o.prevRow.lead.id : '';
    const by = x.statusBy ? `<p class="mk-by">${esc(byWords(x.status, core.nameOf(x.statusBy) || x.statusBy))}${x.statusVia ? `, ${esc(x.statusVia)}` : ''}, ${day(x.statusAt)}${x.status === 'wont-fix' && x.wontFixReason ? `: ${esc(x.wontFixReason)}` : ''}${x.status === 'fixed' && x.fixedIn ? ` in “${esc(core.whatsNewEntries().find((e) => e.id === x.fixedIn)?.title || x.fixedIn)}”` : ''}</p>` : '';
    const form = (inner) => `<form method="post" action="/feedback/triage"><input type="hidden" name="id" value="${esc(ids)}"><input type="hidden" name="back" value="${esc(qs(o.p, { open: null }))}"><input type="hidden" name="next" value="${esc(nextOpen)}"><input type="hidden" name="here" value="${esc(x.id)}">${inner}</form>`;
    const actions = !admin ? `<p class="mk-only">${ONLY_ADMIN}</p>` : `<div class="mk-actions">
${x.status !== 'in-hand' ? form(`<button class="btn primary" name="status" value="in-hand" data-key="i">Mark in hand${all}</button>`) : ''}
${x.status !== 'fixed' ? `<button type="button" class="btn" data-show="fx-${esc(x.id)}" data-key="f">Mark fixed${all}</button>` : ''}
${x.status !== 'wont-fix' ? `<button type="button" class="btn" data-show="wf-${esc(x.id)}" data-key="w">Won’t fix${all}</button>` : ''}
${x.status !== 'new' ? form(`<button class="btn" name="status" value="new">Mark new again${all}</button>`) : ''}
</div>
<div class="mk-form" id="fx-${esc(x.id)}" hidden>${form(`${fixedField(`fx-${x.id}`)} <button class="btn primary" name="status" value="fixed">Mark fixed</button>`)}</div>
<div class="mk-form" id="wf-${esc(x.id)}" hidden>${form(`<label for="wf-why-${esc(x.id)}">Why it won’t be fixed</label><input id="wf-why-${esc(x.id)}" name="reason" required> <button class="btn primary" name="status" value="wont-fix">Won’t fix</button>`)}</div>`;
    const mk = x.kind === 'markup' ? `
<div class="mk-layers"><img class="mk-l-screen" alt="The screen as it was sent" src="/feedback/pictures/${esc(x.id)}/screen.svg"><img class="mk-l-ink" alt="The drawing on it" src="/feedback/pictures/${esc(x.id)}/ink.svg"></div>
<p><label><input type="checkbox" checked data-drawing> Show the drawing</label></p>
${(x.parts || []).length ? `<h3>The parts its marks are on</h3><p>${x.parts.map(esc).join(', ')}</p>` : ''}
${(x.pins || []).filter((q) => q.text).length ? `<h3>Notes</h3><ol>${x.pins.filter((q) => q.text).map((q) => `<li value="${q.n}">${esc(q.text)}</li>`).join('')}</ol>` : ''}
${(x.steps || []).length ? `<h3>The steps before it</h3><ol class="mk-steps">${x.steps.map((s) => `<li>${s.kind === 'page' ? `Opened ${esc(s.path)}` : `Pressed “${esc(s.name)}”`}</li>`).join('')}</ol>` : ''}
${(x.errors || []).length ? `<h3>Errors on that visit</h3><ul>${x.errors.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>` : ''}
<h3>Where it came from</h3><p>${esc(x.route)} · ${esc(where(x))} · ${x.viewport ? `${x.viewport.w} × ${x.viewport.h}` : ''} · ${esc(x.theme || '')}${x.mood ? ` · ${esc(MOODS[x.mood])}` : ''}</p>
<h3>GitHub issue</h3>${x.issueUrl ? `<p><a href="${esc(x.issueUrl)}">${esc(x.issueUrl.replace(/^https:\/\/github\.com\//, ''))}</a></p>` : ''}
${admin ? `<p><a class="btn" target="_blank" rel="noopener" href="${esc(issueLink(x))}">Open GitHub issue</a></p>${form(`<label for="iss-${esc(x.id)}">Paste issue link</label><input id="iss-${esc(x.id)}" name="issueUrl" value="${esc(x.issueUrl || '')}" placeholder="https://github.com/…/issues/12"> <button class="btn" name="keep" value="1">Keep the link</button>`)}` : ''}`
      : `<p>${esc(MOODS[x.mood] || '')} · sent from ${esc(x.path)}</p><p>No picture and no GitHub issue: it’s feedback.</p>`;
    return `<article class="ibx-detail" aria-label="${label}: ${esc(what(x))}">
<p class="ibx-phone"><a class="btn" role="button" href="${esc(qs(o.p, { open: null }))}">Back to the list</a> ${o.nextRow ? `<a class="btn" role="button" href="${esc(qs(o.p, { open: o.nextRow.lead.id }))}">Next</a>` : ''}</p>
${o.idx >= 0 ? `<p class="meta">${o.idx + 1} of ${o.total}</p>` : ''}
<h2>${esc(what(x))}</h2>
<p class="mk-status">${statusHtml(x.status)}</p>${by}
${n > 1 ? `<p>${n} on this part.</p>` : ''}
<p class="meta">${esc(x.personName || 'Someone')} · ${esc(where(x))} · ${day(x.at)}</p>
${actions}${mk}
${o.nextRow ? `<a hidden data-next href="${esc(qs(o.p, { open: o.nextRow.lead.id }))}"></a>` : ''}${o.prevRow ? `<a hidden data-prev href="${esc(qs(o.p, { open: o.prevRow.lead.id }))}"></a>` : ''}
</article>`;
  }
  function issueLink(x) {
    const body = `${x.line}\n\nPage: ${x.route}\nParts: ${(x.parts || []).join(', ')}\nSteps:\n${(x.steps || []).map((s) => `- ${s.kind === 'page' ? `opened ${s.path}` : `pressed ${s.name}`}`).join('\n')}\n\nIn the inbox: /feedback?markup=${x.id}`;
    return `https://github.com/new?title=${encodeURIComponent(x.line)}&body=${encodeURIComponent(body)}`;
  }

  function connectHtml(ctx, url) {
    const host = `${url.protocol === 'x:' ? 'http:' : url.protocol}//${ctx.host || 'localhost'}/api/mcp`;
    const pics = picturesCheck();
    return `<section class="connect" aria-label="Connect Claude" hidden><h2>Connect Claude</h2>
<p>Any Faro token works. This is the demo: tokens are made in the real app, and any token from it reads the demo’s markups too.</p>
<p>For a Claude cloud session: the host is <code>${esc(host)}</code>, and the token goes in the Authorization header as <code>Bearer &lt;token&gt;</code>.</p>
<p>For Claude Code: <code>claude mcp add --transport http faro ${esc(host)} --header "Authorization: Bearer &lt;token&gt;"</code></p>
<p>${pics.ok ? 'The server can send Claude the pictures.' : `The server can’t send Claude the pictures: ${esc(pics.why)}`}</p>
<p>Tokens are listed and revoked on Workspace, under Access, and yours in Settings.</p></section>`;
  }
  const picturesCheck = () => ({ ok: true, why: '' });

  function sheetHtml(ctx, url) {
    const from = url.searchParams.get('from') || ctx.referrer || '/';
    const open = url.searchParams.get('send') === '1' || url.searchParams.get('sendErr');
    const err = url.searchParams.get('sendErr');
    return `<dialog id="fb-sheet" aria-label="How is the app working for you?"${open ? ' open data-open' : ''}><form method="post" action="/feedback/send" class="fb-sheet">
<h2>How is the app working for you?</h2>
<p><button type="button" class="btn primary" data-markup-last="${esc(from)}">Mark up the last screen</button></p>
<p class="meta">It came from ${esc(from)}.</p>
<input type="hidden" name="path" value="${esc(from)}"><input type="hidden" name="mood" value="">
<div role="group" aria-label="How it’s working">${Object.entries(MOODS).map(([k, l]) => `<button type="button" class="btn" aria-pressed="false" data-mood="${k}">${esc(l)}</button>`).join(' ')}</div>
<label for="fb-text">A few words <span class="opt">optional</span></label><textarea id="fb-text" name="text"></textarea>
${err ? `<p class="err" role="alert">${esc(err)}</p>` : ''}
<p><button class="btn" type="submit">Send</button> <button class="btn" type="button" data-close>Cancel</button></p></form></dialog>`;
  }

  // ---------- writing ----------
  function person(ctx) { const me = core.person(ctx.viewer); return { personId: ctx.viewer, personName: me?.name || ctx.viewer }; }
  function sendFeedback(ctx, { mood, text, path: p }, via) {
    const bad = checkFeedback({ mood, text: text ?? '', path: p });
    if (bad) return { refuse: bad };
    const row = { kind: 'feedback', id: inbox.newFeedbackId(), workspace: ctx.wsName, demo: true, ...person(ctx), path: p, mood, text: String(text || '').trim(), at: ctx.nowIso(), via: via || null };
    inbox.add(row);
    const W = core.W(); W.feedback = W.feedback || []; W.feedback.push({ id: row.id, personId: row.personId, path: row.path, mood: row.mood, text: row.text, at: row.at });
    return { ok: row };
  }
  function sendMarkup(ctx, b) {
    const bad = checkMarkup(b);
    if (bad) return { refuse: bad };
    const id = inbox.newMarkupId();
    if (!inbox.idOk(id)) return { refuse: 'That id wasn’t issued.' };
    const row = { kind: 'markup', id, workspace: ctx.wsName, demo: true, ...person(ctx), at: ctx.nowIso(), line: String(b.line).trim(), mood: b.mood || null,
      strokes: b.strokes || [], pins: b.pins || [], parts: b.parts || [], route: b.route || '/', goalId: (String(b.route || '').match(/^\/goals\/([^/?]+)/) || [])[1] || null,
      reviewId: (String(b.route || '').match(/^\/reviews\/([^/?]+)/) || [])[1] || null, viewport: b.viewport || null, theme: b.theme || null, accent: b.accent || null,
      version: b.version || null, steps: (b.steps || []).slice(-20), errors: b.errors || [], from: b.from || null };
    inbox.add(row, { 'screen.svg': String(b.screen || ''), 'ink.svg': String(b.ink || ''), 'marked.svg': String(b.marked || '') });
    return { ok: row };
  }
  // The one status rule over one or many items; returns the words and Undo's befores.
  function change(ctx, ids, patch, via) {
    const admin = core.isAdmin(ctx.viewer);
    const done = [];
    for (const id of ids) {
      const x = inbox.get(id);
      if (!x) return { refuse: `There is no item ${id}.` };
      const r = triage(x, patch, ctx.viewer, { admin, at: ctx.nowIso(), via });
      if (r.refuse) return r;
      done.push({ id, before: r.before, next: r.next });
    }
    for (const d of done) inbox.patch(d.id, d.next, { at: ctx.nowIso(), by: ctx.viewer, via });
    const first = inbox.get(ids[0]);
    const words = patch.status !== undefined ? doneWords(patch.status, what(first), ids.length) : 'Kept the issue link';
    if (!via) { last.set(ctx.viewer, { items: done.map((d) => ({ id: d.id, before: d.before })), words, openId: ids[0] }); flashes.set(ctx.viewer, words); }
    return { ok: done.map((d) => inbox.get(d.id)), words };
  }

  // ---------- routes ----------
  const owns = (P) => P[0] === 'feedback' || (P[0] === 'inbox' && !P[1]) || (P[0] === 'workspace' && P[1] === 'inbox');
  async function readRaw(req) { let s = ''; for await (const c of req) s += c; return s; }

  function get(ctx, req, res, url, P) {
    if (P[0] === 'workspace' && !P[1] && url.searchParams.get('inbox')) { core.redirect(res, `/feedback${url.searchParams.get('markup') ? `?markup=${encodeURIComponent(url.searchParams.get('markup'))}` : ''}`); return true; }
    if (!owns(P)) return false;
    if (P[0] !== 'feedback') { core.redirect(res, `/feedback${url.search}`); return true; }
    if (P[1] === 'pictures') { // by its address only; nothing lists them
      const pic = PICTURES.includes(P[3]) ? inbox.picture(P[2], P[3]) : null;
      if (pic === null) { core.send(res, 404, 'Not found', 'text/plain'); return true; }
      core.send(res, 200, pic, 'image/svg+xml'); return true;
    }
    if (P[1]) return false;
    core.send(res, 200, inboxPage(ctx, url));
    return true;
  }
  async function post(ctx, req, res, url, P) {
    if (P[0] === '__inbox') { // test hooks, like the core's __reset
      const raw = await readRaw(req);
      if (P[1] === 'reset') inbox.reset();
      if (P[1] === 'seed') for (const r of JSON.parse(raw || '[]')) inbox.add({ ...r, id: r.kind === 'markup' ? inbox.newMarkupId() : inbox.newFeedbackId() }, r.kind === 'markup' ? { 'screen.svg': r.screen || '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', 'ink.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', 'marked.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' } : null);
      if (P[1] === 'dump') { core.send(res, 200, JSON.stringify({ items: inbox.all(), changes: inbox.changes() }), 'application/json'); return true; }
      core.send(res, 200, 'ok', 'text/plain'); return true;
    }
    if (P[0] !== 'feedback') return false;
    const raw = await readRaw(req);
    if (P[1] === 'markup') {
      let b; try { b = JSON.parse(raw); } catch { b = {}; }
      const r = sendMarkup(ctx, b);
      core.send(res, r.refuse ? 400 : 200, JSON.stringify(r.refuse ? { error: r.refuse } : { id: r.ok.id, said: 'Sent. You’ll hear when it’s fixed.' }), 'application/json');
      return true;
    }
    const f = new URLSearchParams(raw);
    if (P[1] === 'send') {
      const r = sendFeedback(ctx, { mood: f.get('mood'), text: f.get('text') || '', path: f.get('path') || '/' });
      if (r.refuse) { core.redirect(res, `/feedback?send=1&from=${encodeURIComponent(f.get('path') || '/')}&sendErr=${encodeURIComponent(r.refuse)}`); return true; }
      core.redirect(res, '/feedback?sent=1'); return true;
    }
    if (P[1] === 'triage') {
      const ids = f.getAll('id').flatMap((s) => s.split(',')).filter(Boolean);
      const back = f.get('back') || '/feedback';
      if (!ids.length) { core.redirect(res, back); return true; }
      const patch = f.get('keep') ? { issueUrl: f.get('issueUrl') || '' } : { status: f.get('status'), fixedIn: f.get('fixedIn'), reason: f.get('reason') };
      const r = change(ctx, ids, patch);
      if (r.refuse) { flashes.set(ctx.viewer, r.refuse); last.delete(ctx.viewer); core.redirect(res, withOpen(back, f.get('here') || ids[0])); return true; }
      const stays = f.get('keep') || TAB_OF[r.ok[0].status] === new URL(back, 'http://x').searchParams.get('tab') || (TAB_OF[r.ok[0].status] === 'new' && !new URL(back, 'http://x').searchParams.get('tab'));
      core.redirect(res, withOpen(back, stays ? (f.get('here') || '') : f.get('next') || ''));
      return true;
    }
    if (P[1] === 'undo') {
      const l = last.get(ctx.viewer);
      if (l) { for (const it of l.items) inbox.patch(it.id, it.before, { at: ctx.nowIso(), by: ctx.viewer, via: 'undo' }); last.delete(ctx.viewer); flashes.set(ctx.viewer, 'Undone.'); }
      const back = new URL(f.get('back') || '/feedback', 'http://x');
      const x = l && inbox.get(l.openId);
      if (x) { back.searchParams.set('open', x.id); if (TAB_OF[x.status] === 'new') back.searchParams.delete('tab'); else back.searchParams.set('tab', TAB_OF[x.status]); }
      core.redirect(res, back.pathname + back.search); return true;
    }
    return false;
  }
  const withOpen = (back, id) => { const u = new URL(back, 'http://x'); if (id) u.searchParams.set('open', id); else u.searchParams.delete('open'); return u.pathname + u.search; };

  // ---------- AI tools (tools.md) ----------
  const statusEnum = { type: 'string', enum: ['new', 'in-hand', 'fixed', 'wont-fix'] };
  const brief = (x) => ({ id: x.id, kind: x.kind, status: x.status, statusWord: STATUS_WORD[x.status], said: what(x), mood: x.mood || null, page: x.route || x.path, parts: x.parts || undefined, from: x.personName, workspace: x.workspace, demo: !!x.demo, at: x.at, statusBy: x.statusBy ? core.nameOf(x.statusBy) : null, fixedIn: x.fixedIn, wontFixReason: x.wontFixReason, issueUrl: x.issueUrl });
  const text = (o) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 1) }] });
  const img = (id, which = 'marked.svg') => { const s = inbox.picture(id, which); return s ? { type: 'image', mimeType: 'image/svg+xml', data: Buffer.from(s).toString('base64') } : null; };
  const filterBy = (kind, a) => inbox.all().filter((x) => x.kind === kind && (!a.status || x.status === a.status) && (!a.workspace || x.workspace === a.workspace));
  const triageTool = (kind) => (ctx, a) => {
    const x = inbox.get(a.id);
    if (!x || x.kind !== kind) return text(`There is no ${kind} ${a.id}.`);
    const r = change(ctx, [a.id], { ...(a.status ? { status: a.status, fixedIn: a.fixedIn, reason: a.reason } : {}), ...(a.issueUrl !== undefined ? { issueUrl: a.issueUrl } : {}) }, 'via the AI assistant');
    return r.refuse ? { ...text(r.refuse), isError: true } : text({ said: r.words, item: brief(r.ok[0]) });
  };
  const tools = [
    { name: 'list_markups', title: 'List markups', changes: false, inputSchema: { type: 'object', properties: { status: statusEnum, workspace: { type: 'string' } } }, call: (ctx, a) => text(filterBy('markup', a).map(brief)) },
    { name: 'get_markup', title: 'Open a markup', changes: false, inputSchema: { type: 'object', properties: { id: { type: 'string' }, picture: { type: 'string', enum: ['marked', 'screen', 'none'] } }, required: ['id'] },
      call: (ctx, a) => { const x = inbox.get(a.id); if (!x || x.kind !== 'markup') return text(`There is no markup ${a.id}.`); const t = text({ markup: { ...brief(x), notes: x.pins, context: { route: x.route, goalId: x.goalId, reviewId: x.reviewId, viewport: x.viewport, theme: x.theme, accent: x.accent, version: x.version, from: x.from }, steps: x.steps, errors: x.errors } }); const pic = a.picture === 'none' ? null : img(x.id, a.picture === 'screen' ? 'screen.svg' : 'marked.svg'); if (pic) t.content.push(pic); return t; } },
    { name: 'review_inbox', title: 'Review the inbox', changes: false, inputSchema: { type: 'object', properties: { status: statusEnum } },
      call: (ctx, a) => {
        const st = a.status || 'new', mks = filterBy('markup', { status: st }), fbs = filterBy('feedback', { status: st });
        const groups = new Map(); for (const x of mks) { const k = `${pathOf(x.route)} · ${(x.parts || [])[0] || 'the page'}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
        const byPage = new Map(); for (const x of fbs) { const k = pathOf(x.path); if (!byPage.has(k)) byPage.set(k, []); byPage.get(k).push(brief(x)); }
        const out = text({ status: st, markups: [...groups].map(([k, xs]) => ({ part: k, count: xs.length, items: xs.map(brief) })), feedback: [...byPage].map(([k, xs]) => ({ page: k, count: xs.length, items: xs })) });
        let budget = 2_000_000; for (const [, xs] of groups) { const p = img(xs[0].id); if (p && p.data.length < budget) { out.content.push(p); budget -= p.data.length; } }
        return out;
      } },
    { name: 'update_markup', title: 'Change a markup', changes: true, inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: statusEnum, fixedIn: { type: 'string' }, reason: { type: 'string' }, issueUrl: { type: 'string' } }, required: ['id'] }, call: triageTool('markup') },
    { name: 'list_feedback', title: 'Feedback about the app', changes: false, inputSchema: { type: 'object', properties: { status: statusEnum, workspace: { type: 'string' } } }, call: (ctx, a) => text(filterBy('feedback', a).map(brief)) },
    { name: 'get_feedback', title: 'Open a piece of feedback', changes: false, inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, call: (ctx, a) => { const x = inbox.get(a.id); return x && x.kind === 'feedback' ? text(brief(x)) : text(`There is no feedback ${a.id}.`); } },
    { name: 'update_feedback', title: 'Change a piece of feedback', changes: true, inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: statusEnum, fixedIn: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'status'] }, call: triageTool('feedback') },
    { name: 'send_feedback', title: 'Send feedback about the app', changes: true, inputSchema: { type: 'object', properties: { mood: { type: 'string', enum: ['good', 'meh', 'bad'] }, text: { type: 'string' }, path: { type: 'string' } }, required: ['mood', 'text'] },
      call: (ctx, a) => { const r = sendFeedback(ctx, { mood: a.mood, text: a.text, path: a.path || '/' }, 'via the AI assistant'); return r.refuse ? { ...text(r.refuse), isError: true } : text({ said: 'Sent. It goes to the people building this app.', id: r.ok.id }); } },
  ];

  return {
    id: 'feedback', name: 'Feedback', group: 'Beyond this workspace',
    what: 'Send feedback about Faro, or mark up a screen. It goes to the people who build Faro.',
    menu: 'feedback', owns, get, post, tools,
    help: { 'Send feedback, and marking up a screen': 'feedback', 'The inbox': 'inbox' },
    script: () => CLIENT,
    badge: () => { const n = newCount(); return n ? `${n} new` : ''; },
    holds: () => { const n = inbox.all().filter((x) => x.workspace === core.wsName()).length; return n ? `${n} sent from here, in the builders’ inbox` : 'Nothing sent from here yet'; },
    offSendSentence: (ws) => `Feedback is off in ${ws}.`,
    refuseOffPost: (P) => P[0] === 'feedback' && ['send', 'markup', 'triage', 'undo'].includes(P[1]),
    importNotes: () => [], // Feedback adds no sheet or column to the spreadsheet: there is nothing an import could leave unread.
    whatsNewNote: (ctx, entry) => { const r = raised(inbox.all(), ctx.viewer, [entry]); return r.get(entry.id) ? 'You raised this' : ''; },
    inbox,
  };
}

const CSS = `
.ibx-top .sub{margin-top:-8px;color:var(--muted)}.ibx-actions{display:flex;gap:8px;flex-wrap:wrap}
.ibx-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:12px 0}.ibx-tabs a{padding:8px 12px;text-decoration:none;color:var(--ink);border-radius:8px 8px 0 0}.ibx-tabs a[aria-selected="true"]{font-weight:600;border:1px solid var(--line);border-bottom-color:var(--bg)}
.ibx-search{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.ibx-search input[type=search]{flex:1;min-width:200px;min-height:40px}
.ibx-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:20px;align-items:start}
.ibx-list{list-style:none;margin:0;padding:0}.ibx-row{display:flex;gap:8px;align-items:flex-start;border-bottom:1px solid var(--line);padding:8px 0}.ibx-row.is-open{background:var(--panel)}
.ibx-open{color:var(--ink);text-decoration:none;flex:1;min-width:0}.ibx-thumb{width:56px;height:36px;object-fit:cover;border:1px solid var(--line);border-radius:4px;vertical-align:middle;margin:0 6px}.ibx-speech{font-weight:700;margin:0 6px}
.mk-st{display:inline-flex;gap:4px;align-items:center}.ibx-detail{border:1px solid var(--line);border-radius:10px;padding:12px 16px;background:var(--panel);position:sticky;top:12px}
.mk-layers{position:relative}.mk-layers img{width:100%;display:block;border:1px solid var(--line);border-radius:6px}.mk-layers .mk-l-ink{position:absolute;inset:0;border-color:transparent}
.mk-actions{display:flex;gap:6px;flex-wrap:wrap}.mk-actions form{display:inline}.mk-form{margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.mk-form[hidden]{display:none}
.ibx-phone{display:none}.ibx-bulk{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--line);padding:6px 0}.ibx-kind-phone{display:none}
.fb-sheet [aria-pressed="true"]{outline:2px solid var(--accent);font-weight:600}
@media (max-width:760px){.ibx-split{display:block}.ibx.has-open .ibx-listwrap,.ibx.has-open .ibx-tabs,.ibx.has-open .ibx-search{display:none}.ibx:not(.has-open) .ibx-detail{display:none}.ibx-phone{display:flex;gap:8px}.ibx-detail{position:static}.ibx-kind-inline{display:none}.ibx-kind-phone{display:block}}
`;

const INBOX_JS = `(function(){
var ibx=document.getElementById('inbox'); if(!ibx) return;
var admin=ibx.dataset.admin==='1';
document.querySelectorAll('[data-show]').forEach(function(b){ b.addEventListener('click',function(){ var f=document.getElementById(b.dataset.show); if(!f) return; f.hidden=!f.hidden; var i=f.querySelector('input,select'); if(i&&!f.hidden) i.focus(); }); });
var dr=document.querySelector('[data-drawing]'); if(dr) dr.addEventListener('change',function(){ var l=document.querySelector('.mk-l-ink'); if(l) l.style.visibility=dr.checked?'visible':'hidden'; });
var c=document.querySelector('[data-connect]'),cs=document.querySelector('.connect'); if(c&&cs) c.addEventListener('click',function(){ cs.hidden=!cs.hidden; c.setAttribute('aria-expanded',String(!cs.hidden)); });
var fd=document.querySelector('.ibx-filters'); document.querySelectorAll('[data-filters]').forEach(function(b){ b.addEventListener('click',function(){ fd.showModal(); }); });
document.querySelectorAll('dialog [data-close]').forEach(function(b){ b.addEventListener('click',function(){ b.closest('dialog').close(); }); });
var sheet=document.getElementById('fb-sheet');
if(sheet){ if(sheet.hasAttribute('data-open')){ sheet.removeAttribute('open'); sheet.showModal(); }
 document.querySelectorAll('[data-sheet]').forEach(function(a){ a.addEventListener('click',function(e){ e.preventDefault(); sheet.showModal(); }); });
 sheet.querySelectorAll('[data-mood]').forEach(function(b){ b.addEventListener('click',function(){ sheet.querySelector('[name=mood]').value=b.dataset.mood; sheet.querySelectorAll('[data-mood]').forEach(function(x){ x.setAttribute('aria-pressed',String(x===b)); }); }); });
 var ml=sheet.querySelector('[data-markup-last]'); if(ml) ml.addEventListener('click',function(){ var to=ml.dataset.markupLast; try{ var st=JSON.parse(sessionStorage.getItem('faro-steps')||'[]').filter(function(x){ return x.kind==='page'&&!/^[/](feedback|more)([/?]|$)/.test(x.path); }); if(st.length) to=st[st.length-1].path; }catch(e){} location.href=to+'#markup'; }); }
var bf=document.getElementById('ibx-bulkform');
if(bf){ var boxes=[].slice.call(bf.querySelectorAll('input[name=id]')), all=bf.querySelector('[data-selectall]'), bulk=bf.querySelector('.ibx-bulk');
 function upd(){ var n=0,k=0; boxes.forEach(function(b){ if(b.checked){ n+=Number(b.dataset.n); k++; } }); if(bulk){ bulk.hidden=!k; bulk.querySelector('[data-ticked]').textContent=n; bulk.querySelectorAll('[data-label]').forEach(function(b){ b.textContent=b.dataset.label.replace('N',n); }); } }
 boxes.forEach(function(b){ b.addEventListener('change',upd); }); if(all) all.addEventListener('change',function(){ boxes.forEach(function(b){ b.checked=all.checked; }); upd(); });
 bf.addEventListener('submit',function(e){ var s=e.submitter; if(s&&s.dataset.needs){ var i=document.getElementById(s.dataset.needs); if(!i.value.trim()){ e.preventDefault(); i.setAttribute('aria-invalid','true'); i.focus(); } } }); }
document.addEventListener('keydown',function(e){
 if(e.ctrlKey||e.metaKey||e.altKey) return; var t=e.target; if(t.closest&&t.closest('input,textarea,select,dialog')) return;
 if(matchMedia('(max-width:760px)').matches) return;
 var k=e.key.toLowerCase();
 if(k==='j'||k==='k'){ var a=document.querySelector(k==='j'?'[data-next]':'[data-prev]'); if(a){ e.preventDefault(); location.href=a.getAttribute('href'); } return; }
 if(!admin) return;
 var d=document.querySelector('.ibx-detail'); if(!d) return;
 var b=d.querySelector('[data-key="'+k+'"]'); if(b){ e.preventDefault(); b.click(); }
});
})();`;
