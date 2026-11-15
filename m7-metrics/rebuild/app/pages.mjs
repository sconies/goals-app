// The core screens, drawn on the server from the screens' rules. Each page: its route, its named parts, one main action.
import { searchRows, menuFor, tabsFor, litFor, litTab, pageName, browserTitle, makeIndex, findAnywhere, countLine, filterLine, nothingLine, STATUS_WORD, STATUS_RANK, levelName, findGoal, isForm, NEW_GOAL_STEPS } from '../screens.mjs';
import { homeFor, longDay, dueGoals, waitingAsks, askTitle, attentionGoals } from '../home.mjs';
import { readBack, startLevel, draftChecks, weekWords, withUnit } from '../readback.mjs';
import { GROUPS, W_ } from '../platform.mjs';

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LABEL = { home: 'Home', checkin: 'Check-in', goals: 'Goals', reviews: 'Reviews', people: 'People', activity: 'Activity', data: 'Data', new: 'New goal', workspace: 'Workspace', settings: 'Settings', help: 'Help', feedback: 'Feedback', more: 'More' };
const HREF = { home: '/', checkin: '/check-in', goals: '/goals', reviews: '/reviews', people: '/people', activity: '/activity', data: '/data', new: '/goals/new', workspace: '/workspace', settings: '/settings', help: '/help', feedback: '/feedback' };
const GROUP_NAME = ['your work', 'look up', 'make', 'this workspace and you'];

// ---------- the status: a shape and a word ----------
const SHAPES = {
  on: '<circle cx="8" cy="8" r="6" fill="currentColor"/>',
  risk: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/>',
  off: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  stale: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4"/>',
  unmeasured: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/>',
  done: '<circle cx="8" cy="8" r="6.5" fill="currentColor"/><path d="M5 8.2l2 2 4-4.4" stroke="var(--bg)" stroke-width="1.8" fill="none"/>',
  none: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1" />',
  planned: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1" />',
};
export const shape = (st) => `<svg class="shape ${st}" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">${SHAPES[st] || SHAPES.none}</svg>`;
export const status = (st) => `<span class="status ${st}">${shape(st)}<span class="word">${STATUS_WORD[st]}</span></span>`;
const warn = '<svg class="warn" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l7 13H1z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 6v4M8 11.5v1.2" stroke="currentColor" stroke-width="1.6"/></svg>';

// ---------- the shell ----------
export function shell(app, ctx, { address, body, name, focus = false, backParent = null }) {
  const { viewer } = ctx;
  const on = app.on;
  const modules = app.registry.menu(on);
  const owns = ownsAny(app, viewer.id);
  const menu = menuFor({ ownsGoals: owns, on, modules });
  const tabs = tabsFor({ ownsGoals: owns, on });
  const navCtx = { on, modules };
  const lit = litFor(address, navCtx, menu);
  const ltab = litTab(lit, tabs);
  const pname = name || pageName(app.W, address, { modules, on: (id) => on(id) });
  const label = (id) => (id.startsWith('module:') ? modules.find((m) => `module:${m.id}` === id).label : LABEL[id]);
  const href = (id) => (id.startsWith('module:') ? modules.find((m) => `module:${m.id}` === id).to : HREF[id]);
  const due = owns ? dueGoals(app.S1, app.S1.asOf(app.now), viewer.id, app.S1.currentWeek(app.now)).length : 0;
  const item = (id) => `<li><a href="${href(id)}"${id === lit ? ' aria-current="page"' : ''} data-item="${id}">${h(label(id))}${id === 'checkin' && app.S1.CHECKIN_WEEKS && due ? ` <span class="count">${due}</span>` : ''}</a></li>`;
  const sidebar = `<nav class="sidebar" aria-label="Menu"><a class="brand" href="/">Faro</a><button type="button" class="find-open" data-find>Find</button>
    ${menu.map((g, i) => `<ul aria-label="${GROUP_NAME[i]}">${g.map(item).join('')}</ul>`).join('<hr>')}
    <p class="you">${h(viewer.name)}<br><small>${viewer.admin ? `Admin · ${h(app.W.teams.find((t) => t.id === viewer.teamId)?.name)}` : h(app.W.teams.find((t) => t.id === viewer.teamId)?.name)}</small></p></nav>`;
  const more = menu.map((g, i) => g.filter((id) => !tabs.includes(id))).filter((g) => g.length);
  const tabbar = `<nav class="tabbar" aria-label="Tabs">${tabs.map((id) => `<a href="${href(id)}"${id === ltab ? ' aria-current="page"' : ''}>${h(label(id))}</a>`).join('')}
    <details class="more"><summary${ltab === 'more' ? ' aria-current="page"' : ''}>More</summary><div class="more-sheet">${more.map((g) => `<ul>${g.map(item).join('')}</ul>`).join('')}<button type="button" data-find>Find</button></div></details></nav>`;
  const parent = backParent || {};
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(browserTitle(pname, app.wsName))}</title><link rel="stylesheet" href="/app/style.css"></head>
<body data-viewer="${h(viewer.id)}"${focus ? ' class="focus"' : ''}>
${focus ? '' : sidebar}
<div class="frame"><header class="topbar"><span class="page-name">${h(pname.split(' · ')[0])}</span></header>
<main id="main" data-address="${h(address)}" data-name="${h(pname)}" data-form="${isForm(address) ? 1 : 0}" data-first="${parent.none ? 1 : 0}" data-parent="${h(parent.to || '')}" data-parent-label="${h(parent.label || '')}">
<div class="backslot"></div>
${body}
</main></div>
${focus ? '' : tabbar}
<script type="module" src="/app/client.js"></script></body></html>`;
}
export function ownsAny(app, id) {
  const ws = app.S1.asOf(app.now);
  return ws.goals.some((g) => g.ownerId === id && app.S1.goalStatus(g, ws.ckByGoal.get(g.id) || [], app.now).status !== 'done');
}

// ---------- the list bar ----------
function listBar({ label, q, count, filters = [], nothing = '', clearHref, filterRemove = {} }) {
  return `<div class="list-bar"><form role="search" class="search" method="get"><input type="search" name="q" aria-label="${h(label)}" placeholder="${h(label)}" value="${h(q)}" data-live>
  ${q ? `<a class="clear" role="button" href="${h(clearHref)}" data-clear>Clear the search</a>` : ''}</form>
  <p class="count-line" role="status">${h(count)}</p>
  ${filters.length ? `<p class="filter-line">${h(filterLine(filters))} ${filters.map((f) => `<a role="button" href="${h(filterRemove[f.label] || '?')}" aria-label="Remove the filter ${h(f.label)}">Remove</a>`).join(' ')}</p>` : ''}
  ${nothing ? `<p class="nothing">${h(nothing)}</p>` : ''}</div>`;
}
const withParam = (url, k, v) => { const u = new URL(url, 'http://x'); if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); return u.pathname + (u.search || ''); };

// ---------- Home ----------
export function homePage(app, ctx) {
  const v = ctx.viewer;
  const H = homeFor(app.W, app.S1, v.id, app.now, { on: app.on, wsName: app.wsName });
  const ws = app.S1.asOf(app.now);
  const w = app.S1.currentWeek(app.now);
  let hero;
  if (H.lead) {
    const L = H.lead;
    const action = L.kind.startsWith('check-in') ? `<a class="btn primary" href="/check-in">Start check-in</a>` : L.kind === 'review' ? `<a class="btn primary" href="/reviews/${L.review.id}">Open the review</a>` : L.kind === 'ask' ? `<a class="btn primary" href="/goals/${L.ask.goalIds[0]}#asks">Respond</a>` : L.kind === 'attention' ? `<a class="btn primary" href="/goals?scope=all&attention=1">See them</a>` : `<a class="btn primary" href="/retro">Start the wrap-up</a>`;
    const ring = H.due.length ? `<span class="ring" role="img" aria-label="${H.due.length - H.toDo.length} of ${H.due.length} in">${H.due.length - H.toDo.length}/${H.due.length}</span>` : '';
    hero = `<section class="hero" data-part="This week’s main action" aria-label="This week">${ring}<p class="eyebrow">${h(L.eyebrow)}</p><p class="lead-title">${h(L.title)}</p>${L.kind === 'ask' ? `<p>“${h(L.ask.ask)}”.</p>` : ''}${action}</section>`;
  } else {
    const ring = H.due.length ? `<span class="ring" role="img" aria-label="${H.due.length - H.toDo.length} of ${H.due.length} in">${H.due.length - H.toDo.length}/${H.due.length}</span>` : '';
    const btns = H.toDo.length ? ' <a href="/check-in">Check in early</a>' : /don’t own or watch/.test(H.quiet) ? ' <a href="/goals?scope=all">See the goals</a> <a href="/goals/new">Set up a goal</a>' : '';
    hero = `<section class="hero quiet" aria-label="This week">${ring}<p class="quiet-line">${h(H.quiet)}</p>${btns}</section>`;
  }
  const asks = waitingAsks(app.W, app.S1, ws, v.id, app.now, app.on).filter((x) => !(H.lead && H.lead.ask === x.a));
  const asksBlock = asks.length ? `<section aria-label="Needs your response" data-part="Needs your response"><h2>Also needs your response</h2><ul>${asks.slice(0, 5).map((x) => `<li><a href="/goals/${x.a.goalIds[0]}#asks">${h(askTitle(app.W, x.a))}</a>: “${h(x.a.ask)}”</li>`).join('')}</ul></section>` : '';
  const mine = ws.goals.filter((g) => g.ownerId === v.id);
  const rowsOf = (list) => list.map((g) => goalCard(app, ws, g)).join('');
  const need = (list) => list.filter((g) => { const fl = app.S1.flagsFor(g, ws, app.now); return fl.flags.some((x) => x !== 'due') && !app.S1.handledFor(g, ws, app.now, fl); });
  const mineNeed = need(mine);
  const byStatus = {};
  for (const g of mine) { const s = app.S1.goalStatus(g, ws.ckByGoal.get(g.id) || [], app.now).status; byStatus[s] = (byStatus[s] || 0) + 1; }
  const counts = Object.entries(byStatus).sort((x, y) => STATUS_RANK[x[0]] - STATUS_RANK[y[0]]).map(([s, n]) => `<a href="/goals?scope=mine&status=${s}">${n} ${STATUS_WORD[s].toLowerCase()}</a>`).join(' · ');
  const yours = mine.length ? `<section class="home-mine" aria-label="Your goals"><h2>Your goals · ${mine.length}</h2><p class="home-counts">${counts}</p><p>${mineNeed.length} ${mineNeed.length === 1 ? 'needs' : 'need'} attention</p>${rowsOf(mineNeed.length ? mineNeed : mine.slice(0, 3))}</section>` : '';
  let watching = '';
  if (app.on('watching')) {
    const ids = watchedGoalIds(app, ws, v.id);
    const wl = ws.goals.filter((g) => ids.has(g.id) && g.ownerId !== v.id);
    if (wl.length) { const wn = need(wl); watching = `<section aria-label="Goals you watch"><h2>Goals you watch</h2><p>${wn.length} ${wn.length === 1 ? 'needs' : 'need'} attention</p>${rowsOf(wn.slice(0, 6))}</section>`; }
  }
  const blocks = app.registry.place('home.blocks', app.on, { app, viewer: v });
  return shell(app, ctx, { address: '/', body: `<div class="page home"><h1 class="sr-only">Home</h1>${hero}${asksBlock}<div aria-label="For you" role="region">${yours}${watching}${blocks}</div></div>`, backParent: { none: true } });
}
export function watchedGoalIds(app, ws, pid) {
  const ids = new Set();
  const kids = new Map();
  for (const g of ws.goals) if (g.parentId) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g.id); }
  const tree = (id) => { ids.add(id); for (const k of kids.get(id) || []) tree(k); };
  for (const x of app.W.watches || []) if (x.personId === pid) { if (x.kind === 'goal') ids.add(x.ref); else if (x.kind === 'tree') tree(x.ref); else if (x.kind === 'level') for (const g of ws.goals) if (g.level === x.ref) ids.add(g.id); }
  return ids;
}
function flagWords(app, g, ws) {
  const fl = app.S1.flagsFor(g, ws, app.now);
  const st = fl.st;
  const last = st.latest;
  const bits = [];
  if (fl.flags.includes('stale')) bits.push(`No check-in for ${st.days} days`);
  if (fl.flags.includes('due') && app.on('watching')) bits.push('Its check-in for this week is late');
  if (fl.flags.includes('no-path')) bits.push('No path to green yet');
  if (fl.flags.includes('missed-path')) bits.push('Missed its own date');
  if (fl.flags.includes('decision')) bits.push('Waiting on a decision');
  if (fl.flags.includes('trend')) bits.push('Getting worse over recent weeks');
  if (last && last.why) bits.push(last.why);
  return { fl, why: bits.join('. ') || 'Nothing flagged.' };
}
function goalCard(app, ws, g) {
  const { fl, why } = flagWords(app, g, ws);
  const tone = fl.st.status;
  return `<a class="arow" data-tone="${tone}" href="/goals/${g.id}"><span class="arow-icon">${shape(tone)}</span><span class="arow-body"><span class="arow-title">${h(g.title)}</span> <span class="word">${STATUS_WORD[tone]}</span><span class="arow-why">${h(why.length > 20 ? why : `${why} ${STATUS_WORD[tone]} as of week ${app.S1.currentWeek(app.now)}.`)}</span></span></a>`;
}

// ---------- Goals ----------
export function goalsQuery(app, ctx, url) {
  const p = url.searchParams;
  const index = makeIndex(app.W, app.S1, app.now);
  const ws = index.ws;
  const v = ctx.viewer;
  let rows = index.goalRows;
  const scope = p.get('scope') || (url.pathname === '/watching' ? 'watching' : 'all');
  const filters = [];
  const remove = {};
  if (scope === 'mine') rows = rows.filter((r) => r.goal.ownerId === v.id);
  if (scope === 'team') rows = rows.filter((r) => r.goal.teamId === v.teamId);
  if (scope === 'watching' && app.on('watching')) { const ids = watchedGoalIds(app, ws, v.id); rows = rows.filter((r) => ids.has(r.id)); }
  const listF = (key, label, word, test) => { const vals = p.get(key) ? p.get(key).split(',') : []; if (!vals.length) return; rows = rows.filter((r) => vals.some((x) => test(r, x))); filters.push({ label, values: vals.map(word) }); remove[label] = withParam(url.pathname + url.search, key, null); };
  listF('status', 'Status', (x) => STATUS_WORD[x] || x, (r, x) => r.status === x);
  listF('team', 'Team', (x) => app.W.teams.find((t) => t.id === x)?.name || x, (r, x) => r.goal.teamId === x);
  listF('owner', 'Owner', (x) => app.person(x)?.name || x, (r, x) => r.goal.ownerId === x);
  listF('level', 'Level', (x) => levelName(app.W, x), (r, x) => r.goal.level === x);
  if (p.get('attention') === '1') { const need = new Set(attentionGoals(app.S1, ws, app.now).map((g) => g.id)); rows = rows.filter((r) => need.has(r.id)); filters.push({ label: 'Needs attention', values: ['Yes'] }); remove['Needs attention'] = withParam(url.pathname + url.search, 'attention', null); }
  const q = p.get('q') || '';
  const order = (rs) => [...rs].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1));
  const res = searchRows(rows, { q, size: 100000 }, { order, keyOf: (r) => `G-${Number(String(r.goal.key).replace(/\D/g, ''))}` });
  const shown = res.all;
  return { rows: shown, total: shown.length, q, near: res.near, filters, remove, scope, index };
}
export function goalsPage(app, ctx, url) {
  if (url.searchParams.get('state') === 'stopped') {
    const here = url.pathname + url.search;
    const stopped = app.W.goals.filter((g) => g.stoppedAt && !g.removedAt).sort((a, b) => (a.stoppedAt < b.stoppedAt ? 1 : -1));
    const fmt = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`; };
    const body = `<h1>Goals</h1><div class="list-bar"><p class="count-line" role="status">${stopped.length} stopped ${stopped.length === 1 ? 'goal' : 'goals'}, most recently stopped first.</p><p class="filter-line">Filtered by: Stopped <a role="button" href="${h(withParam(here, 'state', null))}">Remove</a></p></div>
      <section data-part="Stopped goals" aria-label="Stopped goals"><ul>${stopped.map((g) => `<li><a href="/goals/${g.id}">${h(g.title)}</a> <span class="life-mark">Stopped</span> ${status(app.S1.goalStatus(g, app.S1.sortCk(app.W.checkIns.filter((c) => c.goalId === g.id && !c.removedAt)), app.now).status)} · stopped ${fmt(g.stoppedAt)} by ${h(app.person(g.stoppedBy)?.name.split(' ')[0])}: ${h(g.stopReason)}</li>`).join('')}</ul></section>`;
    return shell(app, ctx, { address: here, body, backParent: { none: true } });
  }
  const Q = goalsQuery(app, ctx, url);
  const layout = url.searchParams.get('layout') || 'list';
  const narrowed = !!Q.q || Q.filters.length > 0 || Q.scope !== 'all';
  const count = countLine(Q.total, 'goal', 'goals', 'worst first', { narrowed });
  const nothing = !Q.total ? nothingLine('goal', 'goals', Q.q, null, Q.filters.length) : Q.near ? nothingLine('goal', 'goals', Q.q, Q.near) : '';
  const here = url.pathname + url.search;
  const bar = listBar({ label: 'Find a goal', q: Q.q, count, filters: Q.filters, nothing, clearHref: withParam(here, 'q', null), filterRemove: Q.remove });
  const layouts = ['list', 'table', 'board', 'history'];
  const menu = `<details class="layout-menu"><summary>Layout: ${layout[0].toUpperCase() + layout.slice(1)}</summary><ul role="menu">${layouts.map((l) => `<li><a role="menuitem" href="${h(withParam(here, 'layout', l === 'list' ? null : l))}">${l[0].toUpperCase() + l.slice(1)}</a></li>`).join('')}</ul></details>`;
  const scopes = [['mine', 'Mine'], ['team', 'My team'], ['all', 'All']].concat(app.on('watching') ? [['watching', 'Watching']] : []);
  const tabs = `<nav class="scope-tabs" aria-label="Which goals">${scopes.map(([k, l]) => `<a href="${h(withParam(here, 'scope', k))}"${Q.scope === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const people = new Map(app.W.people.map((p) => [p.id, p]));
  let list;
  if (layout === 'table') list = `<table class="gtable"><thead><tr><th>Key</th><th>Goal</th><th>Status</th><th>Owner</th><th>Team</th></tr></thead><tbody>${Q.rows.slice(0, 200).map((r) => `<tr class="trow" data-href="/goals/${r.id}"><td>${h(r.goal.key)}</td><td><a href="/goals/${r.id}">${h(r.title)}</a></td><td>${status(r.status)}</td><td>${h(people.get(r.goal.ownerId)?.name)}</td><td>${h(app.W.teams.find((t) => t.id === r.goal.teamId)?.name)}</td></tr>`).join('')}</tbody></table>`;
  else if (layout === 'board') list = `<div class="board">${['off', 'risk', 'stale', 'on', 'done'].map((s) => `<section aria-label="${STATUS_WORD[s]}"><h2>${status(s)}</h2>${Q.rows.filter((r) => r.status === s).slice(0, 50).map((r) => `<a class="goal-row" href="/goals/${r.id}">${h(r.title)}</a>`).join('')}</section>`).join('')}</div>`;
  else if (layout === 'history') list = `<p>Each goal’s weekly status, latest first.</p><ul class="history-list">${Q.rows.slice(0, 50).map((r) => `<li><a class="goal-row" href="/goals/${r.id}">${h(r.title)}</a> ${status(r.status)}</li>`).join('')}</ul>`;
  else list = `<ul class="goal-list">${Q.rows.slice(0, 50).map((r) => `<li><a class="goal-row" href="/goals/${r.id}">${status(r.status)} <span class="gtitle">${h(r.title)}</span><span class="gline">${h(r.line)}</span></a></li>`).join('')}</ul>`;
  return shell(app, ctx, { address: here, body: `<h1>Goals</h1>${tabs}<div class="bar-row">${bar}${menu}</div>${list}`, backParent: { none: true } });
}

// ---------- a goal's page ----------
export function goalPage(app, ctx, g, url) {
  const ws = app.S1.asOf(app.now);
  const posted = app.S1.sortCk(ws.ckByGoal.get(g.id) || []);
  const fl = app.S1.flagsFor(g, ws, app.now);
  const st = fl.st;
  const last = st.latest;
  const v = ctx.viewer;
  const owner = app.person(g.ownerId), team = app.W.teams.find((t) => t.id === g.teamId);
  const isOwner = v.id === g.ownerId;
  const w = app.S1.currentWeek(app.now);
  const parent = g.parentId ? app.goal(g.parentId) : null;
  const handled = app.S1.handledFor(g, ws, app.now, fl);
  // acting on a goal (rules/goal-act.md): the owner checks in; someone an ask waits on responds; anyone else asks for an update
  const KO = { decision: 0, question: 1, update: 2, action: 3 };
  const waitingOnMe = ws.asks.filter((a) => a.goalIds.includes(g.id) && a.status === 'open' && a.recipientId === v.id).sort((x, y) => KO[x.kind] - KO[y.kind])[0];
  const main = isOwner ? `<a class="btn primary" href="/check-in/${g.id}">${posted.some((c) => c.week === w) ? 'Check in again' : 'Check in'}</a>` : waitingOnMe ? `<a class="btn primary" href="#asks" data-open-ask="${waitingOnMe.id}">${({ question: 'Answer', action: 'Mark done', update: 'Check in' })[waitingOnMe.kind] || 'Respond'}</a>` : `<a class="btn primary" href="/goals/${g.id}?ask=update#asks">Ask for an update</a>`;
  const canChange = isOwner || v.admin;
  const plan = g.plan ? app.S1.planAt(app.S1.planAsOf(g, w), w) : null;
  const unit = g.unit || '';
  const late = fl.flags.includes('stale') ? st.days : 0;
  const bar = `<section class="goal-bar" data-tone="${st.status}" aria-label="Summary"><p class="gkey">${h(g.key)}</p><h1>${h(g.title)}</h1>
    <p class="bar-status ${st.status}">${status(st.status)}${handled ? ' · Being handled' : ''}</p>
    <p class="fact">${h(owner?.name)} · ${h(team?.name)} · ${h(levelName(app.W, g.level))}</p>
    ${app.registry.place('goal.facts', app.on, { goal: g, app })}
    <dl class="sc"><div class="sc-now"><dt>Now</dt><dd class="sc-value">${last && last.value !== null && last.value !== undefined ? h(withUnit(last.value, unit)) : '—'}</dd></div>${plan !== null ? `<div class="sc-plan"><dt>Plan this week</dt><dd class="sc-value">${h(withUnit(Number(plan.toFixed(g.decimals || 0)), unit))}</dd></div>` : ''}<div class="sc-late"><dt>Days since a check-in</dt><dd class="sc-value">${st.days >= 0 ? st.days : 0}</dd></div></dl>
    <div class="bar-actions">${main}<details class="more-menu"><summary aria-label="More about this goal">…</summary><ul role="group" aria-label="More about this goal">${canChange ? `<li><a href="/goals/${g.id}/edit">Change this goal</a></li><li><button type="button" data-dialog="stop">Stop this goal</button></li>` : ''}<li><a href="/goals/${g.id}/print">Print this goal</a></li></ul></details></div></section>`;
  const asks = ws.asks.filter((a) => a.goalIds.includes(g.id) && a.status === 'open');
  const settled = ws.asks.filter((a) => a.goalIds.includes(g.id) && a.status === 'answered' && a.answeredAt && a.answeredAt >= (app.now.slice(0, 10)));
  const verb = (a) => (a.kind === 'question' ? 'Answer' : a.kind === 'action' ? 'Mark done' : a.kind === 'update' ? 'Check in' : 'Respond');
  const stepRow = (a) => {
    const btns = [];
    if (a.recipientId === v.id) btns.push(`<details class="step-panel-wrap"><summary class="btn${a === waitingOnMe ? '' : ''}">${verb(a)}</summary><form class="step-panel" method="post" action="/act/answerAsk"><input type="hidden" name="askId" value="${a.id}"><label>Your answer <textarea name="answer"></textarea></label><button type="submit">Send the answer</button></form></details>`);
    if (a.askedBy === v.id) btns.push(`<form method="post" action="/act/withdrawAsk"><input type="hidden" name="askId" value="${a.id}"><button type="submit">Withdraw</button></form>`);
    return `<li class="step-row" data-ask="${a.id}"><p>${h(askTitle(app.W, a))}: “${h(a.ask)}”</p><div class="step-buttons">${btns.join('')}</div></li>`;
  };
  const forYou = asks.filter((a) => a.recipientId === v.id).sort((x, y) => KO[x.kind] - KO[y.kind]);
  const asksBlock = `<section id="asks" aria-label="Next steps and asks"><h2>Next steps and asks</h2>${forYou.length ? '<h3>For you</h3>' : ''}${asks.length || settled.length ? `<ul class="steps-list">${forYou.map(stepRow).join('')}${asks.filter((a) => !forYou.includes(a)).map(stepRow).join('')}${settled.map((a) => `<li class="step-row is-settled"><p>${h(askTitle(app.W, a))}: “${h(a.ask)}”</p><p>Answered: ${h(a.answer)}</p></li>`).join('')}</ul>` : `<p>Nothing open.</p>`}${isOwner && (st.status === 'off' || st.status === 'risk') && !asks.some((a) => a.kind === 'action') ? `<p>No next step yet. Nobody has said what happens next.</p>` : ''}</section>`;
  const dec = asks.find((a) => a.kind === 'decision');
  const why = `<section class="why-block" aria-label="Why"><h2>Why</h2><p class="why-text">${h(last && last.why ? last.why : 'No reason given yet.')}</p>${dec ? `<p class="why-pointer">Waiting on a decision from ${h(app.person(dec.recipientId)?.name.split(' ')[0])}: see <a href="#asks">Next steps and asks</a></p>` : ''}${last && last.pathToGreen ? `<p>Path to green: ${h(last.pathToGreen.what)}${last.pathToGreen.byWeek ? `, back on plan by week ${last.pathToGreen.byWeek}` : ''}.</p>` : ''}</section>`;
  const chart = chartOf(app, g, posted);
  const stages = g.kind === 'milestone' ? `<ul class="stagelist">${g.stages.map((s) => { const u = last && last.stages ? last.stages.find((x) => x.stageId === s.id) : null; return `<li>${h(s.name)} · due week ${s.dueWeek}${u && u.doneWeek ? ` · done week ${u.doneWeek}` : ''}</li>`; }).join('')}</ul>` : '';
  const about = `<section aria-label="About this goal"><h2>About this goal</h2><dl class="facts"><dt>Owner</dt><dd><a href="/people/${g.ownerId}">${h(owner?.name)}</a></dd><dt>Team</dt><dd><a href="/teams/${g.teamId}">${h(team?.name)}</a></dd><dt>Feeds</dt><dd>${parent ? `<a href="/goals/${parent.id}">${h(parent.title)}</a>` : 'Nothing: it’s at the top of its own tree.'}</dd>${g.definition ? `<dt>How it’s measured</dt><dd>${h(g.definition)}</dd>` : ''}${g.source ? `<dt>Source</dt><dd>${h(g.source)}</dd>` : ''}</dl>${stages}${app.registry.place('goal.sections', app.on, { goal: g, app })}</section>`;
  const comments = (app.W.decisions || []).filter((d) => d.goalId === g.id && !d.removedAt);
  const changes = app.W.changes.filter((c) => c.goalId === g.id);
  const hf = url.searchParams.get('history') || 'all';
  const items = [
    ...posted.map((c) => ({ at: c.postedAt, kind: 'checkins', html: `Week ${c.week}: ${status(c.status)} ${c.value !== null && c.value !== undefined ? h(withUnit(c.value, unit)) : ''} ${h(c.why || '')}` })),
    ...comments.map((d) => ({ at: d.at, kind: 'comments', html: `${h(app.person(d.byId)?.name)}: ${h(d.note || (d.kind === 'acknowledge' ? 'Marked reviewed' : d.kind))}` })),
    ...changes.map((c) => ({ at: c.at, kind: 'changes', html: `${h(c.summary)} <details><summary>Show the change</summary><div class="diffs">${(c.diffs || []).map((d) => `${h(d.field)}: <del>${h(d.from)}</del> <ins>${h(d.to)}</ins>`).join('<br>')}</div></details>` })),
  ].filter((x) => hf === 'all' || x.kind === hf).sort((a, b) => (a.at < b.at ? 1 : -1));
  const count = (k) => (k === 'checkins' ? posted.length : k === 'comments' ? comments.length : changes.length);
  const history = `<section id="history" aria-label="History"><h2>History</h2><nav class="history-filters">${['checkins', 'comments', 'changes'].map((k) => `<a href="/goals/${g.id}?history=${k}#history">${{ checkins: 'Check-ins', comments: 'Comments', changes: 'Changes' }[k]} ${count(k)}</a>`).join(' ')}</nav>
    <form method="post" action="/act/comment"><input type="hidden" name="goalId" value="${g.id}"><label>Add a comment <textarea name="text"></textarea></label><button>Post comment</button></form>
    <ol class="history-items">${items.slice(0, 60).map((x) => `<li>${x.html}</li>`).join('')}</ol></section>`;
  const rv = url.searchParams.get('review');
  const review = rv && app.on('reviews') ? app.W.reviews.find((r) => r.id === rv) : null;
  const name = review ? `${g.title} · ${review.name}` : g.title;
  const parentLink = review ? { to: `/reviews/${review.id}`, label: review.name } : parent ? { to: `/goals/${parent.id}`, label: parent.title } : { to: '/goals', label: 'Goals' };
  const msg = url.searchParams.get('published') && !posted.length ? `<p class="message" role="status">${h(g.title)} is published. <a href="/check-in/${g.id}">Post the first check-in</a></p>` : url.searchParams.get('posted') ? '<p class="message" role="status">Check-in saved.</p>' : url.searchParams.get('stopped') && g.stoppedAt ? `<p class="message" role="status">Stopped ${h(g.title)}. It leaves every list; History keeps it.</p>` : '';
  const stopDialog = canChange ? `<dialog id="stop" aria-label="Stop this goal"><form method="post" action="/act/stopGoal" data-must="reason"><h2>Stop this goal</h2><input type="hidden" name="goalId" value="${g.id}"><label>Why is it stopping? <textarea name="reason"></textarea></label><p class="fix-line" role="alert" hidden>Say why it is stopping, in 10 characters or more.</p><button type="submit">Stop the goal</button> <button type="button" data-close-dialog>Keep it</button></form></dialog>` : '';
  return shell(app, ctx, { address: url.pathname + url.search, name, body: msg + stopDialog + bar + asksBlock + why + chart + about + app.registry.place('goal.sections', app.on, { goal: g, app }) + history, backParent: parentLink });
}
function chartOf(app, g, posted) {
  if (g.kind !== 'metric' || !g.plan) return '';
  const W = 600, Hh = 160, weeks = app.S1.WEEKS;
  const pts = posted.filter((c) => c.value !== null && c.value !== undefined);
  const vals = [g.plan.start, g.plan.target, ...pts.map((c) => c.value)];
  const lo = Math.min(...vals), hi = Math.max(...vals) || 1;
  const x = (w) => (w / weeks) * (W - 20) + 10, y = (v) => Hh - 10 - ((v - lo) / (hi - lo || 1)) * (Hh - 20);
  const plan = Array.from({ length: weeks + 1 }, (_, w) => `${x(w)},${y(app.S1.planAt(app.S1.planAsOf(g, w), w))}`).join(' ');
  const act = pts.map((c) => `${x(c.week)},${y(c.value)}`).join(' ');
  const notes = [];
  if (g.originalPlan && g.rebaselinedWeek) notes.push(`Target changed in week ${g.rebaselinedWeek}: ${withUnit(g.originalPlan.target, g.unit)} → ${withUnit(g.plan.target, g.unit)}`);
  for (const ph of g.planHistory || []) if (ph.fromWeek && ph.plan && ph.prev) notes.push(`Target changed in week ${ph.fromWeek}: ${withUnit(ph.prev.target, g.unit)} → ${withUnit(ph.plan.target, g.unit)}`);
  return `<section class="chart" aria-label="The plan and the numbers"><h2>The plan and the numbers</h2><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Plan and check-ins by week"><polyline points="${plan}" fill="none" stroke="var(--muted)" stroke-dasharray="4 3"/><polyline points="${act}" fill="none" stroke="var(--ink)" stroke-width="2"/></svg>${notes.map((n) => `<p>${h(n)}</p>`).join('')}</section>`;
}

// ---------- check-in ----------
export function checkInList(app, ctx) {
  const v = ctx.viewer;
  const ws = app.S1.asOf(app.now);
  const w = app.S1.currentWeek(app.now);
  const due = dueGoals(app.S1, ws, v.id, w);
  const done = due.filter((g) => (ws.ckByGoal.get(g.id) || []).some((c) => c.week === w));
  const todo = due.filter((g) => !done.includes(g));
  const dd = app.S1.START + 7 * w + app.S1.REVIEW_DAY;
  const body = `<h1>Check-in</h1><p>Week ${w}. ${due.length ? `${done.length} of ${due.length} in. Due by ${longDay(dd)}.` : 'Nothing is due this week.'}</p>
   ${todo.length ? `<a class="btn primary" href="/check-in/${todo[0].id}">Start with the first</a>` : ''}
   <ul class="checkin-list">${due.map((g) => `<li><a href="/check-in/${g.id}">${h(g.title)}</a> ${done.includes(g) ? 'Checked in' : 'To do'}</li>`).join('')}</ul>
   ${due.filter((g) => g.kind !== 'milestone').length >= 2 ? '<p><a href="/quick-check-in">Or type all your numbers in one table</a></p>' : ''}`;
  return shell(app, ctx, { address: '/check-in', body, backParent: { none: true } });
}
export function checkInForm(app, ctx, g, url, result = null) {
  const w = app.S1.currentWeek(app.now);
  const v = ctx.viewer;
  if (g.ownerId !== v.id) return shell(app, ctx, { address: url.pathname, focus: true, body: `<h1>Check in: ${h(g.title)}</h1><p>Only ${h(app.person(g.ownerId)?.name)} can check in on this goal.</p><a href="/goals/${g.id}">Close</a>` });
  const f = result?.input || {};
  const issues = result?.issues || [];
  const say = issues.length ? `<div class="problems" role="alert"><h2>Before it can be saved</h2><ul>${issues.map((i) => `<li>${h(i.message)}</li>`).join('')}</ul></div>` : '';
  const numberField = g.kind === 'milestone' ? `<label>Stages <input name="stages" value="${h(f.stages || '')}" placeholder="Pilot: done week ${w}"></label>` : `<p>What’s the number this week?</p><label>This week’s value <input name="value" inputmode="decimal" value="${h(f.value ?? '')}"> ${h(g.unit || '')}</label>`;
  const calls = [['', 'Let the rules decide'], ['on', 'On track'], ['risk', 'At risk'], ['off', 'Off track'], ['done', 'Done']];
  const body = `<h1>Check in: ${h(g.title)}</h1><p>Week ${w}.</p>${say}
  <form method="post" action="/check-in/${g.id}">${app.registry.place('checkin.number', app.on, { app, goal: g, viewer: v, input: f, url }) || numberField}
  <fieldset><legend>Your call</legend>${calls.map(([c, l]) => `<label><input type="radio" name="call" value="${c}"${(f.call || '') === c ? ' checked' : ''}> ${l}</label>`).join('')}</fieldset>
  <label>Why it’s behind or ahead <select name="cause"><option value=""></option>${['Plan too aggressive', 'Delivery slower', 'Blocked by a dependency', 'External factor', 'Data problem', 'Plan too cautious', 'Change landed early', 'One-off, won’t last'].map((c) => `<option${f.cause === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
  <label>Why, in a sentence <textarea name="why">${h(f.why || '')}</textarea></label>
  <label>Path to green <textarea name="path">${h(f.path || '')}</textarea></label>
  <label>Back on plan by week <input name="byWeek" inputmode="numeric" value="${h(f.byWeek || '')}"></label>
  <button class="btn primary">Post check-in</button> <button type="submit" name="close" value="1" formnovalidate>Close and keep the draft</button></form>`;
  return shell(app, ctx, { address: url.pathname, focus: true, body });
}

// ---------- New goal ----------
export const NEW_STEPS = ['what', 'who', 'measure', 'check'];
export function newGoalPage(app, ctx, step, draft, result = null) {
  const v = ctx.viewer;
  const d = draft;
  const idx = NEW_STEPS.indexOf(step);
  const hidden = Object.entries(d).filter(([k]) => !['stages', 'alsoHelps'].includes(k)).map(([k, val]) => `<input type="hidden" name="${h(k)}" value="${h(val)}">`).join('');
  let fields = '';
  const choice = (name, label, opts, cur) => `<div role="group" aria-label="${label}" class="choices"><input type="hidden" name="${name}" value="${h(cur)}">${opts.map(([k, l]) => `<button type="button" data-set="${name}" data-value="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
  if (step === 'what') fields = `<label>Name it the way you’d say it <input name="title" value="${h(d.title)}"></label>
    ${choice('kind', 'Type', [['metric', 'Move a number'], ['range', 'Keep it in a range'], ['milestone', 'Hit dated stages']], d.kind || 'metric')}`;
  if (step === 'who') {
    if (!d.ownerId) d.ownerId = v.id;
    if (!d.teamId) d.teamId = app.person(d.ownerId)?.teamId || '';
    const owner = app.person(d.ownerId), team = app.W.teams.find((t) => t.id === d.teamId), parent = d.parentId ? app.goal(d.parentId) : null;
    const lvl = d.level || startLevel(app.W, d.parentId, v.id) || '';
    fields = `<div class="picker" data-kind="person" data-name="ownerId"><label>Owner</label> <span class="chosen">${h(owner?.name || 'Nobody yet')}</span> <input type="search" aria-label="Find a person" data-pick="person"><input type="hidden" name="ownerId" value="${h(d.ownerId)}"></div>
     <div class="picker" data-kind="team" data-name="teamId"><label>Team</label> <span class="chosen">${h(team?.name || 'No team yet')}</span> <input type="search" aria-label="Find a team" data-pick="team"><input type="hidden" name="teamId" value="${h(d.teamId)}"></div>
     ${lvl ? '' : '<p>Choose a level.</p>'}${choice('level', 'Level', [['north-star', 'North star'], ['svp', 'SVP'], ['team', 'Team']], lvl)}
     <div class="picker" data-kind="goal" data-name="parentId"><label>Feeds into</label> <span class="chosen">${h(parent ? `${parent.key} ${parent.title}` : 'Nothing')}</span> <input type="search" aria-label="Find a goal" data-pick="goal"><input type="hidden" name="parentId" value="${h(d.parentId)}"></div>
     <label><input type="checkbox" name="guardrail" value="true"${d.guardrail === true || d.guardrail === 'true' ? ' checked' : ''}> It’s a guardrail</label>`;
  }
  if (step === 'measure') {
    if (d.kind === 'milestone') fields = `<label>First stage <input name="stage1" value="${h(d.stage1 || '')}"></label><label>Due week <input name="stage1Due" value="${h(d.stage1Due || '')}"></label>`;
    else if (d.kind === 'range') fields = `<label>Unit <input name="unit" value="${h(d.unit)}"></label><label>Must stay <select name="bound"><option value="atMost">At or under</option><option value="atLeast">At or over</option></select></label><label>Limit <input name="limit" value="${h(d.limit)}"></label><label>Warning margin <input name="margin" value="${h(d.margin)}"></label>`;
    else fields = `<label>Unit <input name="unit" value="${h(d.unit)}"></label><label>Baseline <input name="start" value="${h(d.start)}"></label><label>Target <input name="target" value="${h(d.target)}"></label>
      ${choice('shape', 'How it moves', [['straight', 'Steady'], ['back', 'Back-loaded'], ['stepped', 'In steps']], d.shape || 'straight')}
      <label>From <select name="fromWeek"><option value="">This week</option>${Array.from({ length: 6 }, (_, i) => app.S1.currentWeek(app.now) - 5 + i).filter((x) => x > 0).map((x) => `<option value="${x}"${String(d.fromWeek) === String(x) ? ' selected' : ''}>${h(weekWords(app.W, app.S1, x))}</option>`).join('')}</select></label>
      <label>How it’s measured <textarea name="definition">${h(d.definition)}</textarea></label>`;
    fields = app.registry.place('goal.measure', app.on, { app, draft: d, viewer: v }) + fields;
  }
  let check = '';
  if (step === 'check') {
    const rb = readBack(app.W, app.S1, normDraft(app, d, v.id), v.id, app.now, { on: app.on, wsName: app.wsName });
    const stepOf = { What: 'what', 'Who and where': 'who', 'Measured by': 'measure', 'Left as usual': 'measure' };
    check = `<p>Nothing is saved until you publish.</p><dl class="readback goal-read-back">${rb.rows.map((r) => `<div data-row="${h(r.label.toLowerCase().split(' ')[0])}"><dt>${h(r.label)}</dt><dd>${h(r.text)}${stepOf[r.label] ? ` <button type="submit" name="goto" value="${stepOf[r.label]}" aria-label="Change ${h(r.label.toLowerCase())}">Change</button>` : ''}</dd></div>`).join('')}</dl>
      <h2>After you publish</h2><ul class="after">${rb.after.map((x) => `<li>${h(x)}</li>`).join('')}</ul>`;
  }
  const issues = result?.issues || [];
  const say = issues.length ? `<div class="problems" role="alert"><ul>${issues.map((i) => `<li>${h(i.message)}</li>`).join('')}</ul></div>` : '';
  const btn = step === 'check' ? '<button class="btn primary" name="publish" value="1">Publish goal</button>' : '<button class="btn primary">Continue</button>';
  const HEAD = { what: 'What do you want to achieve?', who: 'Whose is it, and where does it fit?', measure: 'How it’s measured', check: 'Does this read right?' };
  const body = `<ol class="steps" aria-label="Steps">${NEW_STEPS.map((x, i) => `<li${i === idx ? ' aria-current="step"' : ''}>${i + 1}</li>`).join('')}</ol><h1>${h(HEAD[step])}</h1>${say}<form method="post" action="/goals/new/${step}">${hidden}${fields}${check}${btn} <a href="/goals" data-close>Close and keep the draft</a></form>`;
  return shell(app, ctx, { address: `/goals/new/${step}`, name: NEW_GOAL_STEPS[step], focus: true, body });
}
export function normDraft(app, d, viewer) {
  const out = { kind: 'metric', title: '', teamId: '', ownerId: viewer, io: 'input', level: '', guardrail: false, parentId: '', alsoHelps: [], endWeek: '', source: '', definition: '', unit: '', decimals: '', start: '', target: '', shape: 'straight', bound: 'atMost', limit: '', lower: '', margin: '', stages: [{ id: 's1', name: '', dueWeek: '' }], ...d };
  out.guardrail = out.guardrail === true || out.guardrail === 'true';
  if (!out.ownerId) out.ownerId = viewer;
  if (out.stage1) out.stages = [{ id: 's1', name: out.stage1, dueWeek: out.stage1Due || '' }];
  if (!out.level) out.level = startLevel(app.W, out.parentId, viewer) || 'team';
  if (!out.teamId) out.teamId = app.person(out.ownerId)?.teamId || '';
  return out;
}
export function draftRow(app, d) {
  const owner = app.person(d.ownerId), team = app.W.teams.find((t) => t.id === d.teamId), parent = d.parentId ? app.goal(d.parentId) : null;
  const row = { Goal: d.title, Owner: owner?.name || '', Team: team?.name || '', Level: levelName(app.W, d.level), Type: { metric: 'Number', range: 'Range', milestone: 'Stages' }[d.kind] || 'Number' };
  if (parent) row['Feeds into key'] = parent.key;
  if (d.kind === 'metric') Object.assign(row, { Unit: d.unit, Start: d.start, Target: d.target, ...(d.fromWeek ? { From: `${app.W.cycle.name}-W${String(d.fromWeek).padStart(2, '0')}` } : {}) });
  if (d.kind === 'range') Object.assign(row, { Unit: d.unit, Limit: d.limit, 'Must stay': d.bound === 'atLeast' ? 'At or over' : 'At or under', ...(d.margin ? { Margin: d.margin } : {}) });
  if (d.kind === 'milestone') row.Stages = d.stages.map((s) => `${s.name}: due week ${s.dueWeek}`).join('; ');
  if (d.definition) row.Definition = d.definition;
  return row;
}

// ---------- People and Teams ----------
export function peoplePage(app, ctx, url) {
  const index = makeIndex(app.W, app.S1, app.now);
  const q = url.searchParams.get('q') || '';
  const r = index.search('person', { q, size: 50 });
  const count = r.total ? countLine(r.total, 'person', 'people', 'A to Z', { narrowed: !!q, size: 50 }) : '';
  const nothing = !r.total ? nothingLine('person', 'people', q, null, 0) : r.near ? nothingLine('person', 'people', q, r.near) : '';
  const bar = listBar({ label: 'Find by name, job title or team', q, count, nothing, clearHref: '/people' });
  return shell(app, ctx, { address: url.pathname + url.search, body: `<h1>People</h1><nav class="scope-tabs"><a href="/people" aria-current="page">People</a> <a href="/teams">Teams</a></nav>${bar}<ul>${r.rows.map((x) => `<li><a class="people-row" href="/people/${x.id}">${h(x.title)}<span class="gline">${h(x.line)}</span></a></li>`).join('')}</ul>`, backParent: { none: true } });
}
export function personPage(app, ctx, p) {
  const ws = app.S1.asOf(app.now);
  const goals = ws.goals.filter((g) => g.ownerId === p.id);
  const team = app.W.teams.find((t) => t.id === p.teamId);
  const leads = app.W.teams.filter((t) => t.leadId === p.id);
  const first = p.name.split(' ')[0];
  const facts = `<p class="person-facts">${leads.length ? `${leads.map((t) => h(t.name)).join(', ')}, which ${h(first)} leads.` : `In <a href="/teams/${team?.id}">${h(team?.name)}</a>.`} ${p.admin ? 'Admin.' : 'Member.'}</p>`;
  const body = `<h1>${h(p.name)}</h1>${facts}<p><a href="/goals?scope=all&owner=${p.id}">See ${h(first)}’s ${goals.length} goals</a></p><ul>${goals.slice(0, 10).map((g) => `<li><a href="/goals/${g.id}">${h(g.title)}</a></li>`).join('')}</ul>${app.registry.place('people.person', app.on, { person: p, app })}`;
  return shell(app, ctx, { address: `/people/${p.id}`, body, backParent: { to: '/people', label: 'People' } });
}
export function teamsPage(app, ctx, url) {
  const index = makeIndex(app.W, app.S1, app.now);
  const q = url.searchParams.get('q') || '';
  const r = index.search('team', { q, size: 50 });
  const bar = listBar({ label: 'Find a team', q, count: countLine(r.total, 'team', 'teams', 'A to Z', { narrowed: !!q }), nothing: r.total ? '' : nothingLine('team', 'teams', q), clearHref: '/teams' });
  return shell(app, ctx, { address: url.pathname + url.search, body: `<h1>Teams</h1><nav class="scope-tabs"><a href="/people">People</a> <a href="/teams" aria-current="page">Teams</a></nav>${bar}<ul>${r.rows.map((x) => `<li><a class="team-row" href="/teams/${x.id}">${h(x.title)}<span class="gline">${h(x.line)}</span></a></li>`).join('')}</ul>`, backParent: { none: true } });
}
export function teamPage(app, ctx, t) {
  const ws = app.S1.asOf(app.now);
  const goals = ws.goals.filter((g) => g.teamId === t.id);
  const people = app.W.people.filter((p) => p.teamId === t.id && !p.leftAt);
  const lead = app.person(t.leadId);
  const body = `<h1>${h(t.name)}</h1><p>${lead ? `Led by <a href="/people/${lead.id}">${h(lead.name)}</a>` : 'No lead'} · ${people.length} people</p>${t.objective ? `<p>${h(t.objective)}</p>` : ''}<p><a href="/goals?scope=all&team=${t.id}">See its ${goals.length} goals</a></p><ul>${people.map((p) => `<li><a href="/people/${p.id}">${h(p.name)}</a></li>`).join('')}</ul>${app.registry.place('people.team', app.on, { team: t, app })}`;
  return shell(app, ctx, { address: `/teams/${t.id}`, body, backParent: { to: '/teams', label: 'Teams' } });
}

// ---------- Activity ----------
export function activityPage(app, ctx, url) {
  const q = url.searchParams.get('q') || '';
  const kind = url.searchParams.get('kind') || '';
  const ws = app.S1.asOf(app.now);
  const people = new Map(app.W.people.map((p) => [p.id, p]));
  const goalsById = new Map(app.W.goals.map((g) => [g.id, g]));
  let rows = [
    ...app.W.checkIns.filter((c) => !c.removedAt && c.postedAt <= app.now).map((c) => ({ kind: 'checkins', at: c.postedAt, text: `${people.get(c.authorId)?.name || ''} checked in on ${goalsById.get(c.goalId)?.title || ''} for week ${c.week}` })),
    ...app.W.changes.map((c) => ({ kind: c.entity === 'goal' ? 'goals' : 'other', at: c.at, text: `${people.get(c.actorId)?.name || ''}: ${c.summary}${c.via === 'mcp' ? ' (via MCP)' : ''}` })),
    ...(app.W.decisions || []).filter((d) => d.at <= app.now).map((d) => ({ kind: 'comments', at: d.at, text: `${people.get(d.byId)?.name || ''} on ${goalsById.get(d.goalId)?.title || ''}: ${d.note || 'marked reviewed'}` })),
  ];
  const filters = [];
  if (kind) { rows = rows.filter((r) => r.kind === kind); filters.push({ label: 'Kind', values: [{ checkins: 'Check-ins', goals: 'Goals', comments: 'Comments', other: 'Other' }[kind]] }); }
  const { words, matches } = { words: null, matches: null };
  if (q) rows = rows.filter((r) => matchText(r.text, q));
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  const here = url.pathname + url.search;
  const count = rows.length ? countLine(rows.length, 'change', 'changes', 'latest first', { narrowed: !!q || !!kind }) : '';
  const nothing = rows.length ? '' : q ? nothingLine('change', 'changes', q, null, filters.length) : nothingLine('change', 'changes', '', null, 1);
  const bar = listBar({ label: 'Find a change', q, count, filters, nothing, clearHref: withParam(here, 'q', null), filterRemove: { Kind: withParam(here, 'kind', null) } });
  const kinds = `<div role="group" aria-label="Kind of change">${[['checkins', 'Check-ins'], ['goals', 'Goals'], ['comments', 'Comments']].map(([k, l]) => `<a role="button" href="${h(withParam(here, 'kind', k))}"${kind === k ? ' aria-pressed="true"' : ''}>${l}</a>`).join(' ')}</div>`;
  return shell(app, ctx, { address: here, body: `<h1>Activity</h1>${bar}${kinds}<ol class="activity">${rows.slice(0, 100).map((r) => `<li>${h(r.text)} <time>${h(r.at.slice(0, 10))}</time></li>`).join('')}</ol>`, backParent: { none: true } });
}
import { words as wordsOf, matches as matchWords } from '../screens.mjs';
const matchText = (text, q) => matchWords(wordsOf(text), q);

// ---------- Help ----------
export function helpPage(app, ctx, url, articles) {
  const q = url.searchParams.get('q') || '';
  const list = articles.filter((a) => !q || matchText(`${a.title} ${a.body}`, q));
  const count = list.length ? countLine(list.length, 'article', 'articles', 'in order', { narrowed: !!q }) : '';
  const bar = listBar({ label: 'Find in Help', q, count, nothing: list.length ? '' : nothingLine('article', 'articles', q), clearHref: '/help' });
  return shell(app, ctx, { address: url.pathname + url.search, body: `<h1>Help</h1>${bar}<ul>${list.map((a) => `<li><a href="/help/${a.id}">${h(a.title)}</a></li>`).join('')}</ul><p><a href="/whats-new">What’s new</a></p>`, backParent: { none: true } });
}
export function articlePage(app, ctx, a) {
  return shell(app, ctx, { address: `/help/${a.id}`, body: `<h1>${h(a.title)}</h1>${app.registry.place('help.article', app.on, { id: a.id, app })}${a.body.split(/\n\n+/).map((p) => `<p>${h(p)}</p>`).join('')}`, backParent: { to: '/help', label: 'Help' } });
}

// ---------- Workspace ----------
export function workspacePage(app, ctx, section, msg = '') {
  const v = ctx.viewer;
  const sections = [['', 'About'], ['people', 'People'], ['features', 'Features']].concat(app.registry.sections(app.on).map((s) => [s.id, s.name]));
  const nav = `<nav class="section-links" aria-label="Workspace">${sections.map(([id, n]) => `<a href="/workspace${id ? '/' + id : ''}"${(section || '') === id ? ' aria-current="page"' : ''}>${n}</a>`).join(' ')}</nav>`;
  let body;
  if (section === 'features') {
    if (!v.admin) {
      const admins = app.W.people.filter((p) => p.admin).map((p) => p.name);
      body = `<h1>Features</h1><p>Only admins can switch features on or off. The admins are ${h(admins.join(', '))}.</p><a href="/workspace">Back to Workspace</a>`;
    } else {
      const facts = app.mods.facts;
      const grp = GROUPS.map(([gid, gname]) => { const ms = facts.filter((m) => (m.group || 'tools') === gid); if (!ms.length) return ''; return `<section aria-label="${gname}"><h2>${gname}</h2>${ms.map((m) => { const off = (app.W.modulesOff || []).includes(m.id); const needsOff = !off && !app.on(m.id); return `<form method="post" action="/act/setFeature" class="feature"><input type="hidden" name="id" value="${m.id}"><input type="hidden" name="on" value="${off ? 'true' : 'false'}"><p class="fname">${h(m.name)}</p><p>${h(m.summary || '')}</p>${needsOff ? `<p>${h(W_.needsOff(m.needs.map((n) => facts.find((x) => x.id === n)?.name || n)))}</p>` : ''}<button role="switch" aria-checked="${off ? 'false' : 'true'}" aria-label="${h(m.name)}">${off ? 'Off' : 'On'}</button></form>`; }).join('')}</section>`; }).join('');
      body = `<h1>Features</h1>${msg ? `<p class="message" role="status">${h(msg)}</p>` : ''}<section aria-label="How you work"><h2>How you work</h2><p>Check-ins are due every week, by ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][app.S1.REVIEW_DAY]}.</p></section>${grp}<p>${W_.featuresFoot} <a href="/help/features">Help on features</a></p>`;
    }
  } else if (section === 'people') {
    body = `<h1>People</h1><p>${app.W.people.length} people in ${h(app.wsName)}.</p>`;
  } else {
    const ws = app.S1.asOf(app.now);
    body = `<h1>${h(app.wsName)}</h1><p>One plan for the division, reviewed every week.</p><dl class="facts"><dt>Goals</dt><dd><a href="/goals?scope=all">${ws.goals.length} goals</a></dd><dt>People</dt><dd><a href="/workspace/people">${app.W.people.length} people</a></dd><dt>Teams</dt><dd><a href="/teams">${app.W.teams.length} teams</a></dd><dt>Year</dt><dd>${h(app.W.cycle.name)}, week ${app.S1.currentWeek(app.now)} of ${app.S1.WEEKS}</dd></dl>`;
  }
  if (!section) body += app.registry.place('workspace.about', app.on, { app, viewer: v });
  return shell(app, ctx, { address: `/workspace${section ? '/' + section : ''}`, body: nav + body, backParent: section ? { to: '/workspace', label: 'Workspace' } : { none: true } });
}
export function simplePage(app, ctx, address, title, inner, opts = {}) {
  return shell(app, ctx, { address, body: `<h1>${h(title)}</h1>${inner}`, ...opts });
}
export function notFoundPage(app, ctx, address, sentence = '') {
  const index = makeIndex(app.W, app.S1, app.now);
  const guess = address.split(/[/?=&-]/).filter((x) => x.length > 2).join(' ');
  const r = guess ? findAnywhere(index, guess) : [];
  const people = index.search('person', { q: '', size: 3 }).rows;
  const offer = (r.length ? r.flatMap((g) => g.rows) : people).slice(0, 4);
  const v = ctx.viewer;
  const me = index.personRows.find((x) => x.id === v.id);
  const opts = [me, ...offer.filter((x) => x !== me)].filter(Boolean).slice(0, 4);
  return shell(app, ctx, { address, name: 'Page not found', body: `<div class="not-found"><h1>Page not found</h1>${sentence ? `<p class="switched-off">${h(sentence)}</p>` : '<p>Nothing is at this address. It may have moved, or the link was cut short.</p>'}<ul role="listbox" aria-label="Places you might mean">${opts.map((x) => `<li role="option"><a href="${x.kind === 'goal' ? '/goals/' : x.kind === 'person' ? '/people/' : '/teams/'}${x.id}">${h(x.title)}</a></li>`).join('')}</ul><a class="btn primary" href="/">Go to Home</a></div>` });
}
