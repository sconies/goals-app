// Feedback (spec/modules/feedback, stage 5): Send feedback, Mark up this screen (Ctrl+Shift+M), and the builders' inbox at
// /feedback that the people who build Faro work through, from New to In hand to Closed, with eight AI tools.
// It registers into the core's module platform; the core never names it. Off: no page, no sheet, no key, no tool answers.
import fs from 'node:fs';
import path from 'node:path';
import * as IB from './inbox.mjs';
import { W_ } from '../../platform.mjs';
import { pageName } from '../../screens.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const KIT = path.resolve(here, '../../../spec');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ID = 'feedback', NAME = 'Feedback';
const REPO = 'sconies/goals-app';
const ADMIN_ONLY = 'Only an admin can change the status of feedback.';
const NO_LINE = 'Say what should change first.';

// the builders' inbox belongs to no workspace: one per running app, fresh when the demo is reset
const stores = new WeakMap();
export const storeOf = (app) => { let s = stores.get(app.W); if (!s) { s = IB.makeStore(); stores.set(app.W, s); } return s; };

// its Help articles, in the kit's own words (spec/core/help-guide.md), registered by the module so they go while it is off
function article(id) {
  const guide = fs.readFileSync(path.join(KIT, 'core/help-guide.md'), 'utf8');
  const part = guide.split(/\n### /).find((x) => new RegExp('^[^\\n]*\\n+`' + id + '`, from the feedback module\\.').test(x));
  const [title, ...rest] = part.split('\n');
  return { id, title: title.trim(), after: 'getting-around', body: rest.join('\n').trim().replace(/^`[a-z-]+`, from the feedback module\.\s*/, '').replace(/^Routes:.*$/m, '').replace(/^Requirements:.*$/m, '').trim() };
}

// ---------- shapes and words ----------
const SHAPE = {
  new: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  'in-hand': '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/>',
  fixed: '<circle cx="8" cy="8" r="6.5" fill="currentColor"/><path d="M5 8.2l2 2 4-4.4" stroke="var(--bg)" stroke-width="1.8" fill="none"/>',
  'wont-fix': '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.2 11.8l7.6-7.6" stroke="currentColor" stroke-width="1.6"/>',
};
const shape = (st) => `<svg class="shape" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">${SHAPE[st]}</svg>`;
const speech = '<svg class="shape fb-mark" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const day = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`; };
const DONE = { new: 'Marked new again', 'in-hand': 'Marked in hand', fixed: 'Marked fixed', 'wont-fix': 'Marked won’t fix' };
const DONE_BY = { new: 'Marked new again by', 'in-hand': 'Marked in hand by', fixed: 'Marked fixed by', 'wont-fix': 'Marked won’t fix by' };

// the route a markup was sent from, as a pattern (/goals/:goalId), and the goal or review it is about
function routeOf(app, address) {
  const [a, b] = address.split('?')[0].split('/').filter(Boolean);
  const ids = {};
  let route = address.split('?')[0] || '/';
  if (a === 'goals' && b && b !== 'new') { route = '/goals/:goalId'; ids.goalId = app.goal(b)?.id || b; }
  else if (a === 'check-in' && b) { route = '/check-in/:goalId'; ids.goalId = app.goal(b)?.id || b; }
  else if (a === 'reviews' && b) { route = '/reviews/:reviewId'; ids.reviewId = b; }
  else if (a === 'people' && b) route = '/people/:personId';
  else if (a === 'teams' && b) route = '/teams/:teamId';
  return { route, ...ids };
}
const nameOfPage = (app, p) => { try { return pageName(app.W, p) || p; } catch { return p; } };

// ---------- sending ----------
function sendFeedback(app, person, { mood, text, path: from }) {
  if (!app.on(ID)) return { error: W_.coreAction(NAME, app.wsName) };
  if (!IB.MOODS[mood]) return { error: 'Mood is good, meh or bad.' };
  if (!String(text || '').trim()) return { error: 'Say in a few words how it’s working first.' };
  const store = storeOf(app);
  const at = new Date().toISOString();
  const fb = { id: IB.newId(store, 'feedback'), n: store.seq, kind: 'feedback', mood, text: String(text).trim().slice(0, 2000), path: from || '/', pageName: nameOfPage(app, from || '/'), personId: person.id, personName: person.name, workspaceId: app.W.id || 'demo', workspaceName: app.wsName, demo: true, at, status: 'new', history: [] };
  store.feedback.push(fb);
  // the workspace's own record of what was said (data model: Feedback), beside the builders' copy
  (app.W.feedback = app.W.feedback || []).push({ id: fb.id, personId: person.id, path: fb.path, mood, text: fb.text, at });
  return { ok: true, item: fb, message: 'Sent. It goes to the people building this app, who read every one.' };
}
function sendMarkup(app, person, b) {
  if (!app.on(ID)) return { error: W_.coreAction(NAME, app.wsName) };
  if (!String(b.line || '').trim()) return { error: NO_LINE };
  if (b.mood && !IB.MOODS[b.mood]) return { error: 'Mood is good, meh or bad.' };
  const store = storeOf(app);
  const id = IB.newId(store, 'markup'); // the id is issued here, never by the sender
  const pics = [];
  for (const [name, data] of Object.entries(b.pics || {})) {
    const m = /^data:(image\/(png|jpeg));base64,(.+)$/.exec(String(data));
    if (!m || !['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'].includes(name)) continue;
    store.pictures.set(`${id}/${name}`, { type: m[1], buf: Buffer.from(m[3], 'base64') });
    pics.push(name);
  }
  const address = String(b.address || '/');
  const strokes = (Array.isArray(b.strokes) ? b.strokes : []).slice(0, 200);
  const mk = { id, n: store.seq, kind: 'markup', line: String(b.line).trim().slice(0, 500), mood: IB.MOODS[b.mood] ? b.mood : null, address, ...routeOf(app, address), pageName: nameOfPage(app, address),
    strokes, parts: (Array.isArray(b.parts) ? b.parts : []).slice(0, 200), steps: b.includeSteps === false ? [] : (Array.isArray(b.steps) ? b.steps : []).slice(-20), errors: (Array.isArray(b.errors) ? b.errors : []).slice(-20),
    context: b.context || {}, origin: String(b.origin || ''), pics, personId: person.id, personName: person.name, workspaceId: app.W.id || 'demo', workspaceName: app.wsName, demo: true,
    at: new Date().toISOString(), status: 'new', history: [], issueUrl: null };
  store.markups.push(mk);
  return { ok: true, item: mk, message: 'Sent. You’ll hear when it’s fixed.' };
}

// ---------- triage: the one rule, for one item, a folded row or a batch, with Undo ----------
function triage(app, actor, items, change, via = 'app') {
  const person = typeof actor === 'string' ? app.person(actor) : actor;
  if (!person || !person.admin) return { error: ADMIN_ONLY };
  const at = new Date().toISOString();
  const before = [];
  for (const x of items) {
    const r = IB.setStatus(x, change, person.name, at, via);
    if (r.error) return r;
    if (r.changed) before.push(r.before);
  }
  const label = items.length === 1 ? `${DONE[change.status]}: “${IB.said(items[0])}”` : `${DONE[change.status]}: ${items.length} items.`;
  if (before.length) storeOf(app).undo.set(person.id, { label, before });
  return { ok: true, label, changed: before.length };
}
function undo(app, person) {
  const store = storeOf(app);
  const u = store.undo.get(person.id);
  if (!u) return { error: 'There’s nothing to undo.' };
  for (const b of u.before) { const x = IB.byId(store, b.id); if (x) IB.restore(x, b, person.name, new Date().toISOString()); }
  store.undo.delete(person.id);
  return { ok: true, ids: u.before.map((b) => b.id) };
}

// ---------- the page ----------
function readQ(url) {
  const tab = ['new', 'in-hand', 'closed'].includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'new';
  const kind = ['markups', 'feedback'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'all';
  return { tab, kind, q: (url.searchParams.get('q') || '').trim(), who: (url.searchParams.get('who') || '').trim(), page: Number(url.searchParams.get('page') || 1), open: url.searchParams.get('open') || '' };
}
const qs = (Q, over = {}) => {
  const o = { ...Q, ...over };
  const sp = new URLSearchParams();
  if (o.tab && o.tab !== 'new') sp.set('tab', o.tab);
  if (o.q) sp.set('q', o.q);
  if (o.kind && o.kind !== 'all') sp.set('kind', o.kind);
  if (o.who) sp.set('who', o.who);
  if (o.page && o.page > 1) sp.set('page', o.page);
  if (o.open) sp.set('open', o.open);
  const s = sp.toString();
  return `/feedback${s ? `?${s}` : ''}`;
};
const itemsWord = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;

function rowHtml(row, Q, admin) {
  const x = row.items[0], n = row.items.length;
  const meta = x.kind === 'markup'
    ? [IB.partOf(x) || x.pageName, `${x.personName}, ${IB.fromWhere(x)}`, day(x.at)]
    : ['Feedback', IB.MOODS[x.mood], x.pageName, `${x.personName}, ${IB.fromWhere(x)}`, day(x.at)];
  return `<li class="ibx-row" data-row="${h(row.key)}"${Q.open === row.key ? ' aria-current="true"' : ''}>
    ${admin ? `<input type="checkbox" class="ibx-sel" form="ibx-bulk-form" name="sel" value="${h(row.key)}" data-n="${n}" aria-label="Select “${h(IB.said(x))}”">` : ''}
    <a class="ibx-open" href="${h(qs(Q, { open: row.key }))}"><span class="mk-st">${shape(x.status)}<span class="mk-status">${IB.WORD[x.status]}</span></span>
    <span class="ibx-said">${x.kind === 'feedback' ? `${speech}<span class="fb-item">${h(x.text)}</span>` : `<span class="mk-item">${h(x.line)}</span>`}</span>
    <span class="ibx-meta">${meta.map(h).join(' · ')}${n > 1 ? ` · <span class="ibx-fold">${n} on this part</span>` : ''}</span></a></li>`;
}

function detailHtml(app, row, idx, total, Q, admin) {
  const x = row.items[0], n = row.items.length, isMk = x.kind === 'markup';
  const all = n > 1 ? ` (all ${n})` : '';
  const ids = row.items.map((i) => i.id).join(',');
  const back = qs(Q, { open: '' });
  const label = `${isMk ? 'Markup' : 'Feedback'}: ${IB.said(x)}`;
  const by = x.statusBy && x.status !== 'new' ? ` · ${DONE_BY[x.status]} ${h(x.statusBy)}${x.statusVia === 'mcp' ? ' via the AI assistant' : ''}, ${day(x.statusAt)}` : x.statusBy ? ` · ${DONE_BY.new} ${h(x.statusBy)}` : '';
  const why = x.status === 'wont-fix' ? `<p>Why it won’t be fixed: ${h(x.reason)}</p>` : x.status === 'fixed' ? `<p>Fixed in: ${h(x.fixedIn)}</p>` : '';
  const hidden = (name, v) => `<input type="hidden" name="${name}" value="${h(v)}">`;
  const keep = hidden('ids', ids) + hidden('back', qs(Q, { open: row.key }));
  let body = '';
  if (isMk) {
    const notes = x.strokes.filter((s) => s.kind === 'note');
    const parts = [...new Set((x.parts || []).flat().map((p) => p.join(' › ')))];
    const ctx = x.context || {};
    const fromBuild = x.origin && !/^https:\/\/[^/]*faro/.test(x.origin) ? ` (sent from ${h(x.origin)}${/localhost|127\.0\.0\.1/.test(x.origin) ? ', a laptop' : ''})` : '';
    body = `<div class="mk-layers">${x.pics.includes('screen.png') ? `<img class="mk-screen" src="/m/feedback/pic/${x.id}/screen.png" alt="The screen as it was">` : ''}${x.pics.includes('ink.png') ? `<img class="mk-ink-layer" src="/m/feedback/pic/${x.id}/ink.png" alt="The drawing">` : ''}</div>
      ${x.pics.includes('ink.png') ? '<label class="mk-ink-toggle"><input type="checkbox" checked data-show-ink> Show the drawing</label>' : ''}
      <h3>Parts its marks are on</h3>${parts.length ? `<ul>${parts.map((p) => `<li>${h(p)}</li>`).join('')}</ul>` : '<p>No named part.</p>'}
      ${notes.length ? `<h3>Notes</h3><ol>${notes.map((s) => `<li>${h(s.text)}</li>`).join('')}</ol>` : ''}
      <h3>Before it</h3>${x.steps.length ? `<ol class="mk-steps">${x.steps.map((s) => `<li>${h(s.kind === 'page' ? `Opened ${s.path}` : `Pressed ${s.name}`)}</li>`).join('')}</ol>` : '<p>No steps were sent.</p>'}
      ${x.errors.length ? `<h3>Errors on that visit</h3><ul>${x.errors.map((e) => `<li>${h(e.message || e)}</li>`).join('')}</ul>` : ''}
      <h3>Where it came from</h3><p>${h(x.pageName)} (${h(x.address)}), ${h(x.personName)}, ${h(IB.fromWhere(x))}${fromBuild}, ${day(x.at)}. Screen ${h(ctx.viewport?.w)} × ${h(ctx.viewport?.h)}, ${h(ctx.theme || 'light')}, accent ${h(ctx.accent || '')}, version ${h(ctx.version || '')}.</p>
      ${x.issueUrl ? `<p>Issue: <a href="${h(x.issueUrl)}">${h(x.issueUrl.replace('https://github.com/', ''))}</a></p>` : ''}`;
  } else {
    body = `<p>${speech} Feedback · ${h(IB.MOODS[x.mood])} · sent from ${h(x.pageName)} (${h(x.path)}) by ${h(x.personName)}, ${h(IB.fromWhere(x))}, ${day(x.at)}.</p>`;
  }
  const issueBody = isMk ? `${x.line}\n\nPage: ${x.pageName} (${x.address})\nParts: ${[...new Set((x.parts || []).flat().map((p) => p.join(' › ')))].join('; ')}\nSteps: ${x.steps.map((s) => (s.kind === 'page' ? s.path : s.name)).join(' → ')}\n\nIn the inbox: {origin}/feedback?markup=${x.id}` : '';
  const actions = admin ? `<div class="mk-actions">
      ${x.status !== 'in-hand' ? `<form method="post" action="/m/feedback/triage" class="mk-inline">${keep}${hidden('status', 'in-hand')}<button type="submit" class="primary" data-key="i">Mark in hand${all}</button></form>` : ''}
      ${x.status !== 'fixed' ? `<button type="button" data-mkform="fixed" data-key="f">Mark fixed${all}</button>` : ''}
      ${x.status !== 'wont-fix' ? `<button type="button" data-mkform="wont" data-key="w">Won’t fix${all}</button>` : ''}
      ${x.status !== 'new' ? `<form method="post" action="/m/feedback/triage" class="mk-inline">${keep}${hidden('status', 'new')}<button type="submit">Mark new again${all}</button></form>` : ''}
      ${isMk ? `<button type="button" data-issue="https://github.com/${REPO}/issues/new?title=${encodeURIComponent(x.line)}&amp;body=${h(encodeURIComponent(issueBody))}">Open GitHub issue</button>` : ''}
    </div>
    <form method="post" action="/m/feedback/triage" class="mk-form" data-form="fixed" hidden>${keep}${hidden('status', 'fixed')}<label>What’s new entry with the fix <select name="fixedIn"><option value="next-release">The next release</option></select></label><button type="submit">Mark fixed</button> <button type="button" data-mkform-close>Cancel</button></form>
    <form method="post" action="/m/feedback/triage" class="mk-form" data-form="wont" hidden>${keep}${hidden('status', 'wont-fix')}<label>Why it won’t be fixed <textarea name="reason" data-needs-text></textarea></label><button type="submit" disabled>Won’t fix</button> <button type="button" data-mkform-close>Cancel</button></form>
    ${isMk ? `<form method="post" action="/m/feedback/issue" class="mk-issue">${keep}<label>Paste issue link <input name="url" type="url" placeholder="https://github.com/${REPO}/issues/123"></label><button type="submit">Keep the link</button></form>` : ''}`
    : `<p class="ibx-who">${ADMIN_ONLY} Everyone reads the inbox and sends feedback.</p>`;
  return `<article class="ibx-detail" aria-label="${h(label)}">
    <p class="ibx-nav"><a class="ibx-back" role="button" href="${h(back)}">Back to the list</a> <span class="ibx-pos">${idx + 1} of ${total}</span>${idx + 1 < total ? ` <a class="ibx-next" role="button" href="${h(qs(Q, { open: '__next__' }))}" data-next>Next</a>` : ''}</p>
    <h2>${h(IB.said(x))}</h2>${n > 1 ? `<p>${n} on this part.</p>` : ''}
    <p class="mk-status-line">${shape(x.status)} <span class="mk-word">${IB.WORD[x.status]}</span>${by}</p>${why}
    ${actions}${body}</article>`;
}

function inboxPage(app, viewer, url) {
  const store = storeOf(app);
  const Q = readQ(url);
  const asked = url.searchParams.get('markup');
  if (asked) { const x = IB.byId(store, asked); if (x) { Q.tab = IB.TAB_OF[x.status]; const rows = IB.rowsOf(IB.all(store).filter((y) => IB.TAB_OF[y.status] === Q.tab && IB.matches(y, Q))); Q.open = rows.find((r) => r.items.includes(x))?.key || ''; } }
  const V = IB.view(store, Q);
  if (Q.open === '__next__') Q.open = '';
  const admin = !!viewer.admin;
  const openIdx = V.rows.findIndex((r) => r.key === Q.open);
  if (openIdx >= 0) { const pg = Math.floor(openIdx / IB.PAGE_SIZE) + 1; if (pg !== V.page) { Q.page = pg; Object.assign(V, IB.view(store, Q)); } }
  const total = V.rows.length;
  const nextKey = openIdx >= 0 && V.rows[openIdx + 1] ? V.rows[openIdx + 1].key : '';
  const tabs = `<nav class="ibx-tabs" role="tablist" aria-label="Status">${IB.TABS.map(([t, l]) => `<a role="tab" href="${h(qs(Q, { tab: t, open: '', page: 1 }))}" aria-selected="${Q.tab === t}"${Q.tab === t ? ' aria-current="page"' : ''}>${l} <span class="n">${V.counts[t]}</span></a>`).join('')}</nav>`;
  const people = [...new Set(IB.all(store).map((x) => x.personName))].sort();
  const kindSel = (cls) => `<label class="${cls}">Kind <select name="kind" data-autosubmit>${[['all', 'all'], ['markups', 'markups'], ['feedback', 'feedback']].map(([v, l]) => `<option value="${v}"${Q.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const keepGet = (skip) => Object.entries({ tab: Q.tab !== 'new' ? Q.tab : '', q: Q.q, kind: Q.kind !== 'all' ? Q.kind : '', who: Q.who }).filter(([k, v]) => v && !skip.includes(k)).map(([k, v]) => `<input type="hidden" name="${k}" value="${h(v)}">`).join('');
  const search = `<form class="ibx-search list-bar" method="get" action="/feedback" role="search">${keepGet(['q', 'kind'])}<input type="search" name="q" value="${h(Q.q)}" aria-label="Find feedback" placeholder="Find by what was said, the part, the page or who sent it">${kindSel('ibx-kind')}
    <button type="button" data-dialog="ibx-filters">Filters</button>${Q.q ? ` <a role="button" class="ibx-clear" href="${h(qs(Q, { q: '', open: '', page: 1 }))}">Clear the search</a>` : ''}</form>
    <dialog id="ibx-filters" aria-label="Filter feedback"><form method="get" action="/feedback">${keepGet(['who', 'kind'])}<h2>Filter feedback</h2>
      <label>From <input name="who" value="${h(Q.who)}" list="ibx-people" autocomplete="off" data-who></label><datalist id="ibx-people">${people.map((p) => `<option value="${h(p)}">`).join('')}</datalist>
      ${kindSel('ibx-kind-sheet')}<button type="submit" class="primary" data-show-n>Show ${itemsWord(IB.all(store).filter((x) => IB.matches(x, Q)).length)}</button> <button type="button" data-close-dialog>Cancel</button></form></dialog>`;
  const filterWords = [Q.who ? ['who', `From ${Q.who}`, 'From'] : null, Q.kind !== 'all' ? ['kind', `Kind ${Q.kind}`, 'Kind'] : null].filter(Boolean);
  const filterLine = filterWords.length ? `<p class="filter-line">Filtered by: ${filterWords.map(([k, w, n]) => `${h(w)} <a role="button" href="${h(qs(Q, { [k]: '', open: '', page: 1 }))}" aria-label="Remove the filter ${n}">Remove</a>`).join(', ')}${filterWords.length > 1 ? ` <a role="button" href="${h(qs(Q, { who: '', kind: 'all', open: '', page: 1 }))}">Clear filters</a>` : ''}</p>` : '';
  const countLine = Q.q ? (total ? `<p class="count-line">${total} ${total === 1 ? 'item matches' : 'items match'}.</p>` : `<p class="count-line">No item matches “${h(Q.q)}”.</p>`)
    : total ? `<p class="count-line">${(V.page - 1) * IB.PAGE_SIZE + 1}–${(V.page - 1) * IB.PAGE_SIZE + V.shown.length} of ${total}</p>` : '';
  const empty = !total && !Q.q ? `<p class="nothing">${{ new: 'Nothing new.', 'in-hand': 'Nothing is in hand.', closed: 'Nothing is closed yet.' }[Q.tab]}</p>` : '';
  const bulk = admin && total ? `<form id="ibx-bulk-form" class="ibx-bulk" method="post" action="/m/feedback/bulk"><input type="hidden" name="back" value="${h(qs(Q, { open: '' }))}">
      <label class="ibx-all"><input type="checkbox" data-select-page> Select this page</label>
      <span class="ibx-bulk-actions" hidden><button type="submit" name="status" value="in-hand">Mark in hand</button> <button type="button" data-mkform="bulk-fixed">Mark fixed…</button> <button type="button" data-mkform="bulk-wont">Won’t fix…</button> <button type="submit" name="status" value="new">Mark new again</button></span>
      <span class="mk-form" data-form="bulk-fixed" hidden><label>What’s new entry with the fix <select name="fixedIn"><option value="next-release">The next release</option></select></label><button type="submit" name="status" value="fixed" data-n-label="Mark {n} fixed">Mark fixed</button> <button type="button" data-mkform-close>Cancel</button></span>
      <span class="mk-form" data-form="bulk-wont" hidden><label>Why it won’t be fixed <textarea name="reason" data-needs-text></textarea></label><button type="submit" name="status" value="wont-fix" disabled data-n-label="Won’t fix {n}">Won’t fix</button> <button type="button" data-mkform-close>Cancel</button></span></form>` : '';
  const pager = V.pages > 1 ? `<nav class="ibx-pager" aria-label="Pages">${V.page > 1 ? `<a href="${h(qs(Q, { page: V.page - 1, open: '' }))}">Previous 25</a> ` : ''}Page ${V.page} of ${V.pages}${V.page < V.pages ? ` <a href="${h(qs(Q, { page: V.page + 1, open: '' }))}">Next 25</a>` : ''}</nav>` : '';
  const list = `<div class="ibx-list-wrap">${tabs}${search}${countLine}${filterLine}${bulk}${empty}<ol class="ibx-list">${V.shown.map((r) => rowHtml(r, Q, admin)).join('')}</ol>${pager}</div>`;
  const detail = openIdx >= 0 ? detailHtml(app, V.rows[openIdx], openIdx, total, Q, admin).replace(h(qs(Q, { open: '__next__' })), h(qs(Q, { open: nextKey }))) : '';
  // what was just done, with Undo; or what was just sent
  const u = store.undo.get(viewer.id);
  const done = url.searchParams.get('done') && u ? `<p class="message" role="status">${h(u.label)} <form method="post" action="/m/feedback/undo" class="mk-inline"><input type="hidden" name="back" value="${h(qs(Q, {}))}"><button type="submit">Undo</button></form></p>` : '';
  const sent = url.searchParams.get('sent') === 'feedback' ? '<p class="message" role="status">Sent. It goes to the people building this app, who read every one.</p>' : url.searchParams.get('undone') ? '<p class="message" role="status">Put back as it was.</p>' : '';
  const err = url.searchParams.get('error') ? `<p class="refused" role="alert">${h(url.searchParams.get('error'))}</p>` : '';
  const chk = check(app);
  const aiOff = !app.on('ai-access');
  const connect = `<section class="connect" aria-label="Connect Claude" hidden><h2>Connect Claude</h2>
    ${aiOff ? `<p>${h(W_.aiShut(app.wsName))}</p>` : `<p>Any Faro token works. This is the demo: tokens are made in the real app, where an admin makes one on Workspace, AI access (anyone else asks an admin), and any token from it reads the demo’s markups too.</p>
    <p>For a Claude cloud session: the host is <code data-origin>{origin}</code>/api/mcp, and the token goes in the Authorization header as Bearer gk_…</p>
    <label>Claude Code command <input readonly data-origin-value value="claude mcp add --transport http goals {origin}/api/mcp --header &quot;Authorization: Bearer gk_…&quot;"></label>
    <p>Then ask Claude to review the inbox: review_inbox brings everything new in one step, with its pictures.</p>`}
    <p>${chk.pictures ? 'Pictures for Claude: ready.' : `Pictures for Claude: not ready. ${h(chk.problems.join(' '))}`}</p></section>`;
  return `<h1>Feedback</h1><p class="ibx-sub">From every workspace and the demo</p>
    <div id="inbox" class="ibx${openIdx >= 0 ? ' has-open' : ''}" data-part="Feedback" data-admin="${admin ? 1 : 0}">
      <div class="ibx-top"><button type="button" data-fb-sheet>Send feedback</button> <button type="button" data-connect aria-expanded="false">Connect Claude</button></div>
      ${connect}${err}${done}${sent}
      <div class="ibx-cols">${list}${detail}</div></div>`;
}

const check = () => ({ pictures: true, problems: [] });

// ---------- its own addresses: /m/feedback/… ----------
const json = (status, o) => ({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const back = (to, extra = {}) => { const u = new URL(to || '/feedback', 'http://x'); for (const [k, v] of Object.entries(extra)) if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); return { status: 303, headers: { Location: u.pathname + u.search } }; };
const STATIC = { 'feedback.js': 'text/javascript', 'markup.js': 'text/javascript', 'feedback.css': 'text/css' };
const kept = (x) => ({ ...x, status_by: x.statusBy || null, fixed_in: x.fixedIn || null, issue_url: x.issueUrl || null });

async function serve(app, { req, url, viewer, body, on }) {
  const rest = url.pathname.split('/').slice(3);
  const store = storeOf(app);
  if (req.method === 'GET' && rest[0] === 'static' && STATIC[rest[1]]) return { status: 200, headers: { 'Content-Type': STATIC[rest[1]] }, body: fs.readFileSync(path.join(here, 'public', rest[1])) };
  // a picture is read by its address; nobody can list them
  if (req.method === 'GET' && rest[0] === 'pic' && rest[1] && rest[2]) {
    const p = store.pictures.get(`${rest[1]}/${rest[2]}`);
    if (!p) return { status: 404, body: 'Not found' };
    store.pictureReads.push(`${rest[1]}/${rest[2]}`);
    return { status: 200, headers: { 'Content-Type': p.type, 'Cache-Control': 'public, max-age=31536000, immutable' }, body: p.buf };
  }
  // what the inbox keeps, as the journeys read it (the inbox is open to anyone; pictures are left out)
  if (req.method === 'GET' && rest[0] === 'kept') return json(200, { markups: store.markups.map(kept), feedback: store.feedback.map(kept), pictureReads: store.pictureReads });
  if (req.method === 'GET' && rest[0] === 'count') return json(200, { n: IB.all(store).filter((x) => IB.matches(x, readQ(url))).length });
  // the test door: seed the builders' inbox as a database would hold it (only when the app is started for tests)
  if (req.method === 'POST' && rest[0] === 'seed' && process.env.FARO_TEST === '1') {
    const b = JSON.parse(body || '{}');
    for (const x of b.items || []) { const it = { status: 'new', history: [], strokes: [], parts: [], steps: [], errors: [], pics: [], context: {}, demo: false, issueUrl: null, ...x, n: ++store.seq }; (it.kind === 'markup' ? store.markups : store.feedback).push(it); }
    return json(200, { ok: true });
  }
  if (req.method !== 'POST') return null;
  if (rest[0] === 'send' || rest[0] === 'markup') {
    let b; try { b = JSON.parse(body || '{}'); } catch { return json(400, { error: 'That isn’t JSON.' }); }
    const r = rest[0] === 'send' ? sendFeedback(app, viewer, b) : sendMarkup(app, viewer, b);
    return r.error ? json(on ? 422 : 403, { error: r.error }) : json(200, { ok: true, id: r.item.id, message: r.message });
  }
  const f = Object.fromEntries(new URLSearchParams(body));
  const fAll = new URLSearchParams(body);
  if (!on) return back('/feedback');
  if (rest[0] === 'undo') {
    const r = undo(app, viewer);
    if (r.error) return back(f.back, { error: r.error });
    // what was put back opens again, in the tab it is now in
    const x = IB.byId(store, r.ids[0]);
    const Q = { ...readQ(new URL(f.back || '/feedback', 'http://x')), tab: IB.TAB_OF[x.status], page: 1 };
    const row = IB.view(store, Q).rows.find((rw) => rw.items.includes(x));
    return back(qs({ ...Q, open: row ? row.key : '' }), { undone: '1' });
  }
  if (rest[0] === 'issue') {
    const x = IB.byId(store, String(f.ids || '').split(',')[0]);
    if (!viewer.admin) return back(f.back, { error: ADMIN_ONLY });
    if (!x || !IB.ISSUE_RE.test(String(f.url || '').trim())) return back(f.back, { error: 'Paste the issue’s address, like https://github.com/owner/repo/issues/123.' });
    const before = IB.snapshot(x);
    x.issueUrl = f.url.trim(); x.history.push({ issueUrl: x.issueUrl, by: viewer.name, at: new Date().toISOString() });
    store.undo.set(viewer.id, { label: `Kept the issue link: “${x.line}”`, before: [before] });
    return back(f.back, { done: '1' });
  }
  if (rest[0] === 'triage' || rest[0] === 'bulk') {
    const Q = readQ(new URL(f.back || '/feedback', 'http://x'));
    const before = IB.view(store, Q);
    let items, keys;
    if (rest[0] === 'triage') { items = String(f.ids || '').split(',').map((id) => IB.byId(store, id)).filter(Boolean); keys = [before.rows.find((r) => r.items.includes(items[0]))?.key]; }
    else { keys = fAll.getAll('sel'); items = before.rows.filter((r) => keys.includes(r.key)).flatMap((r) => r.items); }
    if (!items.length) return back(f.back, { error: 'Choose something to change first.' });
    const r = triage(app, viewer, items, { status: f.status, fixedIn: f.fixedIn, reason: f.reason });
    if (r.error) return back(f.back, { error: r.error });
    // the next item opens: the row after the one handled, as the list stood
    const at = before.rows.findIndex((x) => keys.includes(x.key));
    const after = IB.view(store, Q).rows;
    const still = after.find((x) => keys.includes(x.key));
    const next = rest[0] === 'bulk' ? '' : still ? still.key : (after[Math.min(at, after.length - 1)] || {}).key || '';
    return back(f.back, { open: next, done: '1', error: '' });
  }
  return null;
}

// ---------- the AI tools ----------
const S = { type: 'string' }, I = { type: 'integer' };
const ST = { type: 'string', enum: IB.STATUSES };
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const rw = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req });
const mkLine = (x) => `${x.id} · ${IB.WORD[x.status]} · “${x.line}” · ${IB.partOf(x) || x.pageName} · ${x.personName}, ${IB.fromWhere(x)} · ${day(x.at)}`;
const fbLine = (x) => `${x.id} · ${IB.WORD[x.status]} · ${IB.MOODS[x.mood]} · “${x.text}” · ${x.pageName} · ${x.personName}, ${IB.fromWhere(x)} · ${day(x.at)}`;
const pick = (list, a) => list.filter((x) => (!a.status || x.status === a.status) && (!a.workspace || x.workspaceId === a.workspace)).sort((p, q) => (p.at < q.at ? 1 : p.at > q.at ? -1 : q.n - p.n));
const image = (store, id, name) => { const p = store.pictures.get(`${id}/${name}`); return p ? { type: 'image', data: p.buf.toString('base64'), mimeType: p.type } : null; };
const notAdmin = (me) => `${ADMIN_ONLY} This token acts as ${me.name}, who isn’t an admin.`;
function toolChange(app, me, x, a, kindWord) {
  if (!me.admin) return { error: notAdmin(me) };
  if (!a.status && !a.issue_url) return { error: 'Give a status, an issue_url, or both.' };
  if (a.issue_url) {
    if (!IB.ISSUE_RE.test(a.issue_url)) return { error: 'issue_url is a GitHub issue’s address, https://github.com/owner/repo/issues/123.' };
    x.issueUrl = a.issue_url;
  }
  if (a.status) { const r = triage(app, me, [x], { status: a.status, fixedIn: a.fixed_in, reason: a.reason }, 'mcp'); if (r.error) return { error: r.error }; }
  return { text: `${kindWord} ${x.id} is ${IB.WORD[x.status]}${x.statusBy ? `, marked by ${x.statusBy} via the AI assistant` : ''}.${x.issueUrl ? ` Issue: ${x.issueUrl}.` : ''}`, structured: { id: x.id, status: x.status, fixed_in: x.fixedIn, reason: x.reason, issue_url: x.issueUrl } };
}
const aiTools = [
  { name: 'list_markups', title: 'List markups', description: 'Markups people sent (a picture of a screen with a drawing and a line saying what should change), newest first, from every workspace and the demo. Filter by status or workspace.', inputSchema: obj({ status: ST, workspace: S, limit: I }), annotations: ro,
    run: (app, me, a) => { const l = pick(storeOf(app).markups, a).slice(0, Math.min(a.limit || 50, 200)); return { text: l.length ? `${l.length} ${l.length === 1 ? 'markup' : 'markups'}, newest first.\n${l.map(mkLine).join('\n')}` : 'No markups.', structured: { markups: l.map((x) => ({ id: x.id, status: x.status, line: x.line, route: x.route, part: IB.partOf(x), by: x.personName, at: x.at, workspace: x.workspaceId, demo: x.demo })) } }; } },
  { name: 'get_markup', title: 'Open a markup', description: 'One markup in full: its line, the named screen parts under the drawing, the notes, where it was sent from, the steps before it and the errors on that visit. Its picture comes back as an image.', inputSchema: obj({ id: S, picture: { type: 'string', enum: ['marked', 'screen', 'none'] } }, ['id']), annotations: ro,
    run: (app, me, a) => { const store = storeOf(app); const x = store.markups.find((m) => m.id === a.id); if (!x) return { error: `There’s no markup ${a.id}.` };
      const pic = a.picture === 'none' ? null : image(store, x.id, a.picture === 'screen' ? 'screen.png' : 'marked.jpg');
      const parts = [...new Set((x.parts || []).flat().map((p) => p.join(' › ')))];
      return { text: `${mkLine(x)}\nParts: ${parts.join('; ') || 'none named'}\nNotes: ${x.strokes.filter((s) => s.kind === 'note').map((s) => s.text).join('; ') || 'none'}\nFrom: ${x.address}${x.goalId ? ` (goal ${x.goalId})` : ''}, ${x.context?.viewport ? `${x.context.viewport.w}×${x.context.viewport.h}` : ''} ${x.context?.theme || ''}, ${x.demo ? 'the demo' : x.workspaceName}${x.origin ? `, ${x.origin}` : ''}\nSteps: ${x.steps.map((s) => (s.kind === 'page' ? s.path : s.name)).join(' → ') || 'none'}\nErrors: ${x.errors.length || 'none'}${pic ? '' : a.picture === 'none' ? '' : '\nNo picture was kept for it.'}`,
        content: pic ? [pic] : [], structured: kept({ ...x }) }; } },
  { name: 'review_inbox', title: 'Review the inbox', description: 'Everything new in the inbox in one step: new markups grouped by the screen part they are about (newest first, with a count), and new feedback grouped by page. The newest markup of each group comes with its picture. Then use update_markup and update_feedback.', inputSchema: obj({ status: ST, workspace: S, pictures: I }), annotations: ro,
    run: (app, me, a) => { const store = storeOf(app); const st = a.status || 'new'; const want = Math.max(0, Math.min(a.pictures ?? 6, 12));
      const groups = []; for (const x of pick(store.markups, { ...a, status: st })) { const k = `${x.pageName} › ${IB.partOf(x) || 'the whole screen'}`; let g = groups.find((y) => y.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(x); }
      const fb = new Map(); for (const x of pick(store.feedback, { ...a, status: st })) { if (!fb.has(x.pageName)) fb.set(x.pageName, []); fb.get(x.pageName).push(x); }
      const content = []; let budget = 4_000_000;
      groups.forEach((g, i) => { if (i < want) { const p = image(store, g.items[0].id, 'marked.jpg'); if (p && p.data.length < budget) { budget -= p.data.length; content.push(p); } } });
      const text = `${st === 'new' ? 'New' : IB.WORD[st]} in the inbox: ${groups.reduce((s, g) => s + g.items.length, 0)} markups in ${groups.length} groups, ${[...fb.values()].reduce((s, l) => s + l.length, 0)} pieces of feedback.\n\n${groups.map((g) => `${g.k} (${g.items.length}):\n${g.items.map((x) => `  ${mkLine(x)}${x.strokes.filter((s) => s.kind === 'note').map((s) => `\n    Note: ${s.text}`).join('')}`).join('\n')}`).join('\n')}${fb.size ? `\n\nFeedback by page:\n${[...fb].map(([p, l]) => `${p} (${l.length}):\n${l.map((x) => `  ${fbLine(x)}`).join('\n')}`).join('\n')}` : ''}`;
      return { text, content, structured: { groups: groups.map((g) => ({ part: g.k, count: g.items.length, ids: g.items.map((x) => x.id) })), feedback: [...fb].map(([p, l]) => ({ page: p, ids: l.map((x) => x.id) })) } }; } },
  { name: 'update_markup', title: 'Change a markup', description: 'Set a markup’s status (admins only: new, in-hand, fixed with the What’s new entry id that has the fix, or wont-fix with a reason), and keep its GitHub issue’s address.', inputSchema: obj({ id: S, status: ST, fixed_in: S, reason: S, issue_url: S }, ['id']), annotations: rw,
    run: (app, me, a) => { const x = storeOf(app).markups.find((m) => m.id === a.id); return x ? toolChange(app, me, x, a, 'Markup') : { error: `There’s no markup ${a.id}.` }; } },
  { name: 'list_feedback', title: 'Feedback about the app', description: 'What people said through Send feedback (a mood and a few words), newest first, from every workspace, each with its status; filter by status or workspace.', inputSchema: obj({ status: ST, workspace: S, limit: I }), annotations: ro,
    run: (app, me, a) => { const l = pick(storeOf(app).feedback, a).slice(0, Math.min(a.limit || 50, 200)); return { text: l.length ? `${l.length} ${l.length === 1 ? 'piece' : 'pieces'} of feedback, newest first.\n${l.map(fbLine).join('\n')}` : 'No feedback.', structured: { feedback: l.map(({ id, status, mood, text, path: p, personName, workspaceName, at }) => ({ id, status, mood, text, path: p, by: personName, workspace: workspaceName, at })) } }; } },
  { name: 'get_feedback', title: 'Open a piece of feedback', description: 'One piece of feedback in full: its words and mood, the screen it was sent from, who sent it from which workspace and when, and its status.', inputSchema: obj({ id: S }, ['id']), annotations: ro,
    run: (app, me, a) => { const x = storeOf(app).feedback.find((m) => m.id === a.id); if (!x) return { error: `There’s no feedback ${a.id}.` };
      return { text: `${fbLine(x)}${x.status === 'fixed' ? `\nFixed in ${x.fixedIn}, marked by ${x.statusBy}.` : x.status === 'wont-fix' ? `\nWon’t fix: ${x.reason} (${x.statusBy}).` : x.statusBy ? `\nMarked by ${x.statusBy}.` : ''}`, structured: kept({ ...x }) }; } },
  { name: 'update_feedback', title: 'Change a piece of feedback', description: 'Set a piece of feedback’s status (admins only), with the inbox’s rules: new, in-hand, fixed (with fixed_in) or wont-fix (with a reason).', inputSchema: obj({ id: S, status: ST, fixed_in: S, reason: S }, ['id', 'status']), annotations: rw,
    run: (app, me, a) => { const x = storeOf(app).feedback.find((m) => m.id === a.id); return x ? toolChange(app, me, x, { ...a, issue_url: undefined }, 'Feedback') : { error: `There’s no feedback ${a.id}.` }; } },
  { name: 'send_feedback', title: 'Send feedback about the app', description: 'Feedback about the app itself, for the people who build it: how it felt and what happened.', inputSchema: obj({ mood: { type: 'string', enum: ['good', 'meh', 'bad'] }, text: S }, ['mood', 'text']), annotations: { ...rw, idempotentHint: false },
    run: (app, me, a) => { const r = sendFeedback(app, me, { mood: a.mood, text: a.text, path: 'MCP' }); return r.error ? { error: r.error } : { text: `Sent (${r.item.id}). It goes to the people building this app.`, structured: { id: r.item.id } }; } },
];

export default {
  id: ID, name: NAME, group: 'beyond', needs: [],
  summary: 'Send feedback about Faro, or mark up a screen. It goes to the people who build Faro.',
  // its menu row is the core's last group (Workspace, Settings, Help, Feedback), drawn while it is on
  routes: [{ path: '/feedback', name: NAME, help: 'inbox', first: true }],
  redirects: [
    { from: '/workspace/inbox', to: '/feedback' },
    { from: '/inbox', to: '/feedback' },
    { match: (url) => url.pathname === '/workspace' && (url.searchParams.has('inbox') || url.searchParams.has('markup')), to: (url) => `/feedback${url.searchParams.get('markup') ? `?markup=${encodeURIComponent(url.searchParams.get('markup'))}` : ''}` },
  ],
  places: {},
  assets: { styles: ['/m/feedback/static/feedback.css'], scripts: ['/m/feedback/static/feedback.js'] },
  help: [article('feedback'), article('inbox')],
  page: (app, viewer, url) => inboxPage(app, viewer, url),
  serve,
  check,
  aiTools,
  prompts: [{ name: 'review_inbox', title: 'Review the inbox', description: 'Review everything new in Faro’s inbox and triage it.', messages: () => [{ role: 'user', content: { type: 'text', text: 'Review Faro’s inbox: call review_inbox, look at each group’s picture, then mark each markup and piece of feedback in hand, fixed (with the What’s new entry) or won’t fix (with a reason) using update_markup and update_feedback.' } }] }],
  // for tests and the exit criteria
  _: { storeOf, triage, sendFeedback, sendMarkup },
};
