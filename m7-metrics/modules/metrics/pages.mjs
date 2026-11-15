// The metric library's screens: /metrics (the library), /metrics/:slug (a metric), /metrics/new and /metrics/:slug/edit
// (the form), and the old addresses under /data/metrics. Server-rendered, as the core's screens are.
import * as L from './rules.mjs';
import * as B from './library.mjs';
import { goalSummary } from './summary.mjs';
import { demoSources, sourceFor } from './sources.mjs';

const undos = new Map(); // viewer -> { undo, what }
const formDrafts = new Map(); // `${viewer}:${metricId|new}` -> draft fields
export const keepUndo = (viewer, r, what) => { if (r && r.undo) undos.set(viewer, { undo: r.undo, what }); };

const M = (W) => B.rows(W);
const isAdmin = (api, id) => !!api.R.person.get(id)?.admin;
const mayChange = (api, viewer, m) => m.ownerId === viewer || isAdmin(api, viewer);
export const liveGoalIds = (api, ctx) => new Set(api.R.standing(ctx.moment).ws.goals.filter((g) => !g.stoppedAt && !g.removedAt).map((g) => g.id));
const href = (m) => `/metrics/${L.metricSlug(m.id)}`;
const dateWords = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
/** The measurement status: a square shape and its word (rule 11). */
export function measureMark(m) {
  const k = L.measurementOf(m);
  const svg = k === 'measured' ? '<rect x="2" y="2" width="10" height="10" fill="currentColor"/>'
    : k === 'partly' ? '<rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="7" width="10" height="5" fill="currentColor"/>'
      : '<rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"/>';
  return `<span class="measure-mark" data-measurement="${k}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">${svg}</svg> ${L.MEASUREMENT_WORD[k]}</span>`;
}
export const sayWhen = (api, ctx) => (iso) => {
  const d = new Date(iso); const hm = `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const day = Math.floor(Date.parse(iso) / 86400000), today = Math.floor(Date.parse(ctx.moment) / 86400000);
  if (day === today) return `${hm} today`;
  if (day === today - 1) return `${hm} yesterday`;
  return `${hm} on ${api.R.dayShort(day)}`;
};
export function sourcesOf(api, ctx) { return demoSources(api.W, { behind: ctx.sources === 'behind' ? 2 : 0 }); }

// ---------- the library ----------
export function libraryPage(api, ctx, url) {
  const { W, esc, shape } = api;
  const p = url.searchParams;
  const ask = { q: p.get('q') || '', unit: p.get('unit') || '', teamId: p.get('team') || p.get('teamId') || '', ownerId: p.get('owner') || p.get('ownerId') || '', dir: p.get('dir') || '',
    unused: p.get('unused') === 'true' || p.get('unused') === '1', sortout: p.get('sortout') === 'true' || p.get('sortout') === '1', retired: p.get('retired') === '1' || p.get('retired') === 'true', sort: p.get('sort') || 'name', page: p.get('page') || 1 };
  const live = liveGoalIds(api, ctx);
  const rowsCtx = { metrics: M(W).metrics, links: M(W).metricLinks, liveGoalIds: live, people: W.people, moment: ctx.moment };
  const r = L.findMetrics(ask, rowsCtx);
  const narrowed = ask.q || ask.unit || ask.teamId || ask.ownerId || ask.dir || ask.unused || ask.sortout;
  const thing = (n) => (n === 1 ? 'metric' : 'metrics');
  const sortWords = { name: 'A to Z', goals: 'most goals first', changed: 'changed lately' };
  const count = r.total ? (narrowed ? `${r.total} ${thing(r.total)} ${r.total === 1 ? 'matches' : 'match'}.` : `${r.total} ${thing(r.total)}, ${sortWords[ask.sort] || 'A to Z'}.`) : narrowed ? `No metric matches${ask.q ? ` “${esc(ask.q)}”` : ''}.` : 'No metrics yet.';
  const inForce = L.liveLinks(M(W).metricLinks, live);
  const st = api.R.standing(ctx.moment).st;
  const row = (m) => {
    const byStatus = {};
    for (const l of inForce.filter((x) => x.metricId === m.id)) { const s = st.get(l.goalId)?.status || 'none'; byStatus[s] = (byStatus[s] || 0) + 1; }
    const goalsLine = Object.entries(byStatus).sort((a, b) => (L.STATUS_RANK[a[0]] ?? 3) - (L.STATUS_RANK[b[0]] ?? 3)).map(([s, k]) => `${shape(s)} ${k} ${esc(api.status(s).replace(/<[^>]+>/g, ''))}`).join(' · ');
    const needs = mayChange(api, ctx.viewer, m) ? L.needsLine(L.metricNeeds(m, rowsCtx)) : '';
    return `<a class="metric-row trow" href="${href(m)}"><span class="t"><strong>${esc(m.name)}</strong>${L.measurementOf(m) !== 'measured' ? ` ${measureMark(m)}` : ''}</span><span class="meta">${esc(m.unit)} · ${L.dirWords(m.direction)} · ${esc(api.nameOf(m.ownerId))}</span><span class="meta">${goalsLine || 'No goals'}${needs ? ` · ${api.warnMark} ${esc(needs)}` : ''}</span></a>`;
  };
  const keep = (k, v) => { const q = new URLSearchParams(p); if (v === null) q.delete(k); else q.set(k, v); q.delete('page'); const s = q.toString(); return `/metrics${s ? `?${s}` : ''}`; };
  const units = [...new Set(M(W).metrics.filter(L.inUse).map((m) => m.unit))].sort();
  const retiredN = M(W).metrics.filter((m) => L.inUse(m) && L.isRetired(m)).length;
  const sel = (name, opts, cur, label) => `<label>${label}<select name="${name}"><option value="">Any</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const owners = [...new Set(M(W).metrics.filter(L.inUse).map((m) => m.ownerId))].map((id) => [id, api.nameOf(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  const filters = `<details><summary>Filters and sort</summary><form method="get" action="/metrics">${ask.q ? `<input type="hidden" name="q" value="${esc(ask.q)}">` : ''}${sel('unit', units.map((u) => [u, u]), ask.unit, 'Unit')}${sel('team', [['company', 'The whole company'], ...W.teams.map((t) => [t.id, t.name])], ask.teamId, 'Measured for')}${sel('owner', owners, ask.ownerId, 'Owner')}${sel('dir', [['lower', 'Lower is better'], ['higher', 'Higher is better']], ask.dir, 'Which way is better')}
<label style="font-weight:400"><input type="checkbox" name="unused" value="true"${ask.unused ? ' checked' : ''}> No goals use it</label><label style="font-weight:400"><input type="checkbox" name="sortout" value="true"${ask.sortout ? ' checked' : ''}> Something to sort out</label>
<label>Sort<select name="sort">${Object.entries(sortWords).map(([k, l]) => `<option value="${k}"${ask.sort === k ? ' selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></label><button class="btn" type="submit">Show these metrics</button></form></details>`;
  const pager = r.pages > 1 ? `<p class="meta">Page ${r.page} of ${r.pages} ${r.page > 1 ? `<a href="${keep('page', r.page - 1)}">Previous</a>` : ''} ${r.page < r.pages ? `<a href="${keep('page', r.page + 1)}">Next</a>` : ''}</p>` : '';
  const flash = undos.get(ctx.viewer) && url.searchParams.get('done') ? `<form class="check" method="post" action="/metrics/undo" role="status"><p>${esc(undos.get(ctx.viewer).what)}. <button class="btn link" type="submit">Undo</button></p></form>` : '';
  const removed = M(W).metrics.filter((m) => m.removedAt && mayChange(api, ctx.viewer, m));
  const body = `<h1>Metrics${ask.retired ? ': retired' : ''}</h1><p class="sub">Each number goals are measured by, defined once.</p>${flash}
<div class="listbar" role="search"><form method="get" action="/metrics" id="mlb"><label for="mq" class="meta" style="font-weight:400;margin:0">Find by name, unit, owner or meaning</label><input type="search" id="mq" name="q" value="${esc(ask.q)}" placeholder="Find by name, unit, owner or meaning"><button class="btn" type="submit">Search</button>${ask.q ? `<a class="btn" role="button" href="${keep('q', null)}">Clear the search</a>` : ''}</form>${filters}
<p class="countline count-line" role="status">${count}</p></div>
<div class="rows">${r.rows.map(row).join('') || '<p class="meta" style="padding:12px 16px">Nothing here.</p>'}</div>${pager}
<p>${retiredN && !ask.retired ? `<a href="/metrics?retired=1">See the ${retiredN} retired ${thing(retiredN)}</a> · ` : ''}${ask.retired ? '<a href="/metrics">Back to the library</a> · ' : ''}<a class="btn primary" href="/metrics/new">Add a metric</a></p>
${removed.length ? `<details><summary>Recently removed</summary>${removed.map((m) => `<form method="post" action="/metrics/restore/${esc(m.id)}"><p>${esc(m.name)} <button class="btn link" type="submit">Put it back</button></p></form>`).join('')}</details>` : ''}
<script>(function(){var f=document.getElementById('mlb');var b=f.querySelector('[name=q]');var t;b.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){var u=new URL(location.href);if(b.value)u.searchParams.set('q',b.value);else u.searchParams.delete('q');u.searchParams.delete('page');location.replace(u);},500);});})();</script>`;
  return api.layout(ctx, { address: url.pathname + url.search, body, page: 'Metrics', navName: 'Metrics' });
}

// ---------- a metric ----------
export function metricPage(api, ctx, m, url) {
  const { W, esc } = api;
  const live = liveGoalIds(api, ctx);
  const links = M(W).metricLinks;
  const rowsCtx = { metrics: M(W).metrics, links, liveGoalIds: live, people: W.people, moment: ctx.moment };
  const can = mayChange(api, ctx.viewer, m);
  const still = L.stillToSay(m, W.people);
  const stillHtml = can && still.startsWith('Still to say') ? `Still to say: ${still.replace(/^Still to say: /, '').replace(/\.( Its owner has left\.)?$/, '').split(', ').map((w) => `<a href="${href(m)}/edit#${{ 'what it means': 'meaning', 'where the number comes from': 'source', 'who owns that source': 'sourceOwner', 'how often it refreshes': 'refresh' }[w]}">${esc(w)}</a>`).join(', ')}.${still.endsWith('Its owner has left.') ? ' Its owner has left.' : ''}` : esc(still);
  const gs = L.metricGoals(m.id, { links, liveGoalIds: live, goals: W.goals, teams: W.teams, summaryOf: (g) => goalSummary(g, api.S1, api.R, ctx.moment) });
  const needs = can ? L.metricNeeds(m, rowsCtx) : [];
  const sortout = needs.length ? `<section class="metric-sortout" aria-labelledby="so-h"><h2 id="so-h">To sort out</h2>${needs.map((n) => `<p>${api.warnMark} ${esc(n.words)} ${n.code === 'unused' ? `<a class="btn" href="/goals?scope=all&q=${encodeURIComponent(m.unit)}">${esc(n.button)}</a>` : `<a class="btn" href="${href(m)}/edit#${n.field}">${esc(n.button)}</a>`}</p>`).join('')}</section>` : '';
  const table = gs.length ? `<div style="overflow-x:auto"><table class="metric-goals"><thead><tr><th>Status</th><th>Goal</th><th>For</th><th>Now</th><th>Target</th><th>Against plan</th><th>Owner</th></tr></thead><tbody>${gs.map((r) => `<tr class="metric-goal-row"><td>${api.status(r.status)}</td><td><a href="/goals/${r.goal.id}">${esc(r.goal.title)}</a></td><td>${esc(r.slice)}</td><td>${esc(r.now)}</td><td>${esc(r.target)}</td><td>${esc(r.vsPlan)}</td><td>${esc(r.owner)}</td></tr>`).join('')}</tbody></table></div>${L.summaryLine(gs) ? `<p class="meta">${esc(L.summaryLine(gs))}</p>` : ''}<p><a class="btn primary" href="/goals?scope=all&metric=${encodeURIComponent(m.id)}">${gs.length === 1 ? 'See its goal' : `See its ${gs.length} goals`}</a></p>` : '<p class="meta">No goal is measured by it yet.</p>';
  // rule 4: how each goal's check-in gets its number
  const sources = sourcesOf(api, ctx);
  const sw = sayWhen(api, ctx);
  let inCheckIn = '';
  if (m.source && gs.length) {
    const lines = gs.map((r) => {
      const s = sourceFor(sources, m.id, r.link);
      const lastRead = (W.checkIns || []).filter((c) => c.goalId === r.goal.id && c.reading && !c.removedAt).sort((a, b) => (a.reading.at < b.reading.at ? 1 : -1))[0];
      const words = !s ? 'Typed by hand: no source can be read' : !s.readsSlice ? `Typed by hand: ${s.source.name} has no number per team` : `Filled in from ${s.source.name}${lastRead ? ` · last read ${sw(lastRead.reading.at)}` : ''}`;
      return `<tr><td>${esc(r.goal.title)}</td><td>${esc(r.slice)}</td><td>${esc(words)}</td></tr>`;
    }).join('');
    const w0 = ctx.week, ids = new Set(gs.map((r) => r.goal.id));
    const recent = (W.checkIns || []).filter((c) => ids.has(c.goalId) && !c.removedAt && c.reading && c.week > w0 - 8 && c.week <= w0);
    const bySrc = new Map(); for (const c of recent) { if (!bySrc.has(c.reading.source)) bySrc.set(c.reading.source, []); bySrc.get(c.reading.source).push(c); }
    const diffLines = [...bySrc.entries()].map(([src, cs]) => { const k = cs.filter((c) => { const g = W.goals.find((x) => x.id === c.goalId); return Number(Number(c.value).toFixed(g.decimals || 0)) !== Number(Number(c.reading.value).toFixed(g.decimals || 0)); }); return `<p>In the last 8 weeks, ${k.length} of ${cs.length} check-ins filled in from ${esc(src)} used a different number.${k.length ? ` <details><summary>See them</summary>${k.map((c) => `<a href="/goals/${c.goalId}#history">${esc(W.goals.find((x) => x.id === c.goalId).title)}, week ${c.week}</a>`).join('<br>')}</details>` : ''}</p>`; }).join('');
    inCheckIn = `<h3>In each goal’s check-in</h3><div style="overflow-x:auto"><table><thead><tr><th>Goal</th><th>For</th><th>In its check-in</th></tr></thead><tbody>${lines}</tbody></table></div>${diffLines}`;
  }
  const kids = L.childrenOf(m.id, M(W).metrics);
  const place = L.placeWords(m, M(W).metrics);
  const sits = place || kids.length ? `<section aria-labelledby="sits-h"><h2 id="sits-h">Where it sits</h2>${place ? `<p class="metric-place">${esc(place)}</p>` : ''}${kids.length ? `<ul>${kids.map((k) => `<li><a href="${href(k)}">${esc(k.name)}</a>${k.level ? ` · ${esc(L.LEVEL_NOUN[k.level])}` : ''}</li>`).join('')}</ul>` : ''}</section>` : '';
  const used = L.everUsed(m.id, links);
  const retired = m.retiredAt ? `<p class="check" role="status">Retired on ${dateWords(m.retiredAt)} by ${esc(api.nameOf(m.retiredBy))}: ${esc(m.retiredWhy || '')}${m.replacedBy ? ` Use <a href="${href({ id: m.replacedBy })}">${esc(M(W).metrics.find((x) => x.id === m.replacedBy)?.name || '')}</a> instead.` : ''}</p>${can ? `<form method="post" action="${href(m)}/unretire"><button class="btn" type="submit">Bring it back</button></form>` : ''}` : '';
  const others = M(W).metrics.filter((x) => L.inUse(x) && !x.retiredAt && x.id !== m.id && x.unit === m.unit).sort((a, b) => a.name.localeCompare(b.name));
  const actions = can && !m.retiredAt ? `<p><a class="btn" href="${href(m)}/edit">Change this metric</a></p>
${used ? `<details><summary class="btn">Retire</summary><form method="post" action="${href(m)}/retire"><label for="rw">Why it is retired</label><input type="text" id="rw" name="why" maxlength="300"><button class="btn" type="submit">Retire it</button></form></details>` : `<form method="post" action="${href(m)}/remove"><button class="btn" type="submit">Delete</button></form>`}
${isAdmin(api, ctx.viewer) && others.length ? `<details><summary class="btn">Merge into another</summary><form method="post" action="${href(m)}/merge"><label for="mi">Merge into</label><select id="mi" name="into">${others.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select><button class="btn" type="submit">Merge</button></form></details>` : ''}`
    : !can ? `<p class="meta">${esc(api.nameOf(m.ownerId))} or an admin can change this.</p>` : '';
  const flash = undos.get(ctx.viewer) && url.searchParams.get('done') ? `<form class="check" method="post" action="/metrics/undo" role="status"><p>${esc(undos.get(ctx.viewer).what)}. <button class="btn link" type="submit">Undo</button></p></form>` : '';
  const err = url.searchParams.get('err') ? `<p class="err" role="alert">${esc(url.searchParams.get('err'))}</p>` : '';
  const body = `<div class="page metric"><div class="metric-head"><h1>${esc(m.name)}</h1><p class="metric-still">${stillHtml}</p></div><p>${measureMark(m)}${m.measurementNote && L.measurementOf(m) !== 'measured' ? ` · ${esc(m.measurementNote)}` : ''}</p>${flash}${err}${retired}
<p class="meta">${esc(m.unit)} · ${L.decimalsWords(m.decimals || 0)} · ${L.dirWords(m.direction)} · owned by ${esc(api.nameOf(m.ownerId))}</p>
<section aria-labelledby="mm-h"><h2 id="mm-h">What it means</h2><p class="metric-meaning">${esc(m.meaning || 'No meaning yet.')}</p>${m.gaming ? `<p class="meta">How it could be gamed: ${esc(m.gaming)}</p>` : ''}${m.confidence ? `<p class="meta">Confidence: ${esc(L.CONFIDENCE_WORDS[m.confidence])}</p>` : ''}</section>
${sortout}<section aria-labelledby="mg-h"><h2 id="mg-h">Its goals</h2>${table}</section>
<section aria-labelledby="ms-h"><h2 id="ms-h">Where the number comes from</h2><p>${esc(m.source || 'Not said yet.')}${m.sourceOwner ? ` (${esc(m.sourceOwner)})` : ''}${m.refresh ? `, refreshed ${esc(m.refresh)}` : ''}</p>${m.caveats ? `<p><strong>Caveats:</strong> ${esc(m.caveats)}</p>` : ''}${inCheckIn}</section>
${sits}<p class="meta">Added by ${esc(api.nameOf(m.createdBy))} on ${dateWords(m.createdAt)}${m.updatedAt !== m.createdAt ? ` · last changed ${dateWords(m.updatedAt)}` : ''}</p>${actions}</div>`;
  return api.layout(ctx, { address: url.pathname + url.search, body, page: m.name, navName: m.name, parent: ['/metrics', 'Metrics'] });
}

// ---------- the form ----------
const REFRESH_WORDS = { '': 'Not said', live: 'Live', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };
export function metricForm(api, ctx, m, url, state = {}) {
  const { W, esc } = api;
  const key = `${ctx.viewer}:${m ? m.id : 'new'}`;
  const d = { ...(m || { decimals: 0, ownerId: ctx.viewer, direction: '' }), ...(formDrafts.get(key) || {}), ...(state.draft || {}) };
  const errs = state.problems || [], checks = state.checks || [], answers = d.answers || {};
  const tried = !!state.tried;
  const fe = (f) => errs.filter((e) => e.field === f).map((e) => `<div class="must-fix level-fix" role="alert">${api.warnMark} <strong>Must fix</strong> ${esc(e.text)}</div>`).join('');
  const fc = (f) => checks.filter((c) => c.field === f).map((c) => answers[f] ? `<p class="meta">You said: ${answers[f] === 'as-written' ? 'it’s right as written' : /^keep/.test(answers[f]) ? 'mine is different' : 'use the one in use'}. <button class="btn link" name="unanswer" value="${f}">Change</button></p>`
    : `<div class="metric-check" data-check="${f}" role="group" aria-label="Check">${api.warnMark} <strong>Check</strong> <p>${esc(c.text)}</p>${f === 'name' ? `<button class="btn" name="use_metric" value="${esc(c.metric.id)}">Use that one</button> <button class="btn" name="ans_name" value="keep:${c.metric.id}">Mine is different: keep it</button>` : f === 'unit' ? `<button class="btn" name="ans_unit" value="use">Use “${esc(c.use)}”</button> <button class="btn" name="ans_unit" value="keep">Keep “${esc(d.unit)}”</button>` : `<button class="btn" name="ans_meaning" value="as-written">It’s right as written</button>`}</div>`).join('');
  const openChecks = checks.filter((c) => !answers[c.field]).length;
  const foot = L.countLine(errs.length, openChecks);
  const rb = state.readBack ? `<section class="check readback" aria-label="What this does to its goals"><h2>${esc(state.readBack.title)}</h2>${state.readBack.html}</section>` : '';
  const others = M(W).metrics.filter((x) => L.inUse(x) && x.id !== m?.id).sort((a, b) => a.name.localeCompare(b.name));
  const meas = L.measurementOf(d);
  const body = `<form method="post" action="${m ? `${href(m)}/edit` : '/metrics/new'}${url.searchParams.get('from') ? `?from=${esc(url.searchParams.get('from'))}` : ''}" novalidate>
<div class="closer"><button class="btn" type="submit" name="close" value="keep" formnovalidate>Close and keep the draft</button></div>
<h1>${m ? `Change ${esc(m.name)}` : 'Add a metric'}</h1>${formDrafts.has(key) && !state.draft ? '<p class="meta" role="status">Picked up what you hadn’t saved.</p>' : ''}${rb}
<label for="name">Name</label><input type="text" id="name" name="name" value="${esc(d.name || '')}">${fe('name')}${fc('name')}
<label for="unit">Unit</label><input type="text" id="unit" name="unit" value="${esc(d.unit || '')}">${fe('unit')}${fc('unit')}
<label for="decimals">Decimal places <span class="opt">· optional, 0 if left</span></label><input type="text" inputmode="numeric" id="decimals" name="decimals" value="${esc(d.decimals ?? '')}">${fe('decimals')}
<div id="metric-direction" role="group" aria-labelledby="dir-l"><p id="dir-l" style="font-weight:600;margin:14px 0 4px">Which way is better</p><input type="hidden" name="direction" value="${esc(d.direction || '')}">${[['lower', 'Lower is better'], ['higher', 'Higher is better']].map(([k, l]) => `<button type="button" class="btn seg" data-dir="${k}" aria-pressed="${d.direction === k}"${errs.some((e) => e.field === 'direction') ? ' aria-invalid="true"' : ''}>${l}</button>`).join(' ')}${fe('direction')}</div>
<label for="meaning">What it means and how it’s calculated <span class="opt">· can be said later</span></label><textarea id="meaning" name="meaning">${esc(d.meaning || '')}</textarea>${fe('meaning')}${fc('meaning')}
<fieldset id="measurement" role="group" aria-label="Is it measured today"><legend>Is it measured today</legend><input type="hidden" name="measurement" value="${meas}">${['measured', 'partly', 'gap'].map((k) => `<button type="button" class="btn" data-meas="${k}" aria-pressed="${meas === k}">${L.MEASUREMENT_WORD[k]}</button>`).join(' ')}
<label for="measurementNote">What’s missing <span class="opt">· optional</span></label><input type="text" id="measurementNote" name="measurementNote" maxlength="300" value="${esc(d.measurementNote || '')}">${fe('measurementNote')}</fieldset>
<h2>Where the number comes from · can be said later</h2>
<label for="source">Where the number comes from</label><input type="text" id="source" name="source" value="${esc(d.source || '')}">
<label for="sourceOwner">Who owns that source</label><input type="text" id="sourceOwner" name="sourceOwner" value="${esc(d.sourceOwner || '')}">
<label for="refresh">How often it refreshes</label><select id="refresh" name="refresh">${Object.entries(REFRESH_WORDS).map(([k, l]) => `<option value="${k}"${(d.refresh || '') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
<label for="owner">Owner</label>${api.picker('ownerId', 'person', d.ownerId, api.nameOf(d.ownerId), { aria: 'Find the owner', id: 'owner' })}${fe('owner')}
<label for="caveats">Caveats <span class="opt">· optional</span></label><textarea id="caveats" name="caveats">${esc(d.caveats || '')}</textarea>
<details${d.parentId || d.level || d.confidence || d.gaming ? ' open' : ''}><summary>Where it sits, and how far to trust it</summary>
<label for="parent">Under which metric <span class="opt">· optional</span></label><select id="parent" name="parentId"><option value="">None</option>${others.map((o) => `<option value="${o.id}"${d.parentId === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>${fe('parent')}
<label for="level">How it relates <span class="opt">· optional</span></label><select id="level" name="level"><option value="">Not said</option>${Object.keys(L.LEVEL_NOUN).map((k) => `<option value="${k}"${d.level === k ? ' selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select>${fe('level')}
<label for="confidence">Confidence in its number <span class="opt">· optional</span></label><select id="confidence" name="confidence"><option value="">Not said</option>${Object.entries(L.CONFIDENCE_WORDS).map(([k, l]) => `<option value="${k}"${d.confidence === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
<label for="gaming">How it could be gamed <span class="opt">· optional</span></label><textarea id="gaming" name="gaming" maxlength="500">${esc(d.gaming || '')}</textarea>${fe('gaming')}</details>
<input type="hidden" name="answers" value="${esc(JSON.stringify(answers))}">
<div class="focus-foot" style="position:sticky;bottom:0;background:var(--bg);padding:8px 0">${foot ? `<p class="metric-count">${esc(foot)}</p>` : ''}<p class="meta">${esc(L.stillToSay({ ...d, ownerId: d.ownerId }, W.people))}</p>${tried && openChecks && !errs.length ? '<p class="err must-fix-line" role="alert">Answer the question above first.</p>' : ''}<button class="btn primary" type="submit" name="save" value="1">${m ? 'Save changes' : 'Add the metric'}</button></div></form>
<script>(function(){var f=document.querySelector('form');f.querySelectorAll('[data-dir]').forEach(function(b){b.addEventListener('click',function(){f.querySelector('[name=direction]').value=b.dataset.dir;f.querySelectorAll('[data-dir]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});});});f.querySelectorAll('[data-meas]').forEach(function(b){b.addEventListener('click',function(){f.querySelector('[name=measurement]').value=b.dataset.meas;f.querySelectorAll('[data-meas]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});});});
var first=f.querySelector('.must-fix,.metric-check');if(first){var fld=first.previousElementSibling;if(fld&&fld.focus)fld.focus();first.scrollIntoView({block:'center'});}})();</script>`;
  return api.layout(ctx, { address: url.pathname, body, form: true, page: m ? `Change ${m.name}` : 'Add a metric' });
}
export function formFields(f) {
  const o = {};
  for (const k of ['name', 'unit', 'decimals', 'direction', 'meaning', 'measurement', 'measurementNote', 'source', 'sourceOwner', 'refresh', 'ownerId', 'caveats', 'parentId', 'level', 'confidence', 'gaming']) if (f[k] !== undefined) o[k] = f[k];
  return o;
}
export function postForm(api, ctx, m, f, url) {
  const { W } = api;
  const key = `${ctx.viewer}:${m ? m.id : 'new'}`;
  let answers = {}; try { answers = JSON.parse(f.answers || '{}'); } catch { answers = {}; }
  for (const k of ['name', 'unit', 'meaning']) if (f[`ans_${k}`]) answers[k] = f[`ans_${k}`];
  if (f.unanswer) delete answers[f.unanswer];
  const fields = formFields(f);
  const draft = { ...fields, answers };
  formDrafts.set(key, draft);
  if (f.close) return { redirect: m ? href(m) : '/metrics' };
  if (f.use_metric) return { redirect: href({ id: f.use_metric }) };
  const opt = { answers, confirm: f.confirm === '1', relabel: f.relabel === '1' ? true : undefined, reason: f.reason || '' };
  if (f.comparable === 'yes') opt.comparable = true; else if (f.comparable === 'no') opt.comparable = false;
  const actx = { actor: ctx.viewer, now: ctx.nowIso(), week: ctx.week };
  const input = m ? { id: m.id, ...fields } : fields;
  if (!f.save) return { html: metricForm(api, ctx, m, url, { draft, ...shown(api, m, fields, answers) }) };
  const r = B.saveMetric(W, actx, input, opt);
  if (r.ok) {
    formDrafts.delete(key);
    keepUndo(ctx.viewer, r, r.nothing ? 'Nothing to save' : r.message);
    return { redirect: `${href(r.metric || m)}?done=1`, metric: r.metric || m };
  }
  const st = { draft, tried: true, ...shown(api, m, fields, answers) };
  if (r.asks || /Say why|still the same number|direction changes|measured by .* in /.test(r.refused || '')) st.readBack = readBackOf(api, m, fields, f, r.refused);
  else if (!st.problems.length && !st.checks.filter((c) => !answers[c.field]).length) st.problems = [{ field: 'name', text: r.refused }];
  return { html: metricForm(api, ctx, m, url, st), status: 400 };
}
function shown(api, m, fields, answers) {
  const { W } = api;
  const d = { ...(m || { decimals: 0, ownerId: '' }), ...fields };
  if (d.decimals === '') d.decimals = 0;
  const problems = L.metricProblems({ ...d, refresh: d.refresh || null }, { metrics: M(W).metrics, people: W.people, selfId: m?.id });
  const checks = B.checksFor(W, d, m);
  return { problems, checks, answers };
}
function readBackOf(api, m, fields, f, refused) {
  const { W, esc } = api;
  const goals = m ? B.linkedGoals(W, m.id) : [];
  const named = `${goals.slice(0, 6).map((g) => esc(g.title)).join(', ')}${goals.length > 6 ? ` and ${goals.length - 6} more` : ''}`;
  const meaningChanged = m && (String(fields.meaning ?? m.meaning).trim() !== String(m.meaning || '').trim() || String(fields.source ?? m.source).trim() !== String(m.source || '').trim());
  const unitChanged = m && fields.unit !== undefined && fields.unit.trim() !== m.unit;
  const dirChanged = m && fields.direction && fields.direction !== m.direction;
  let html = `<p>${goals.length} ${goals.length === 1 ? 'goal is' : 'goals are'} measured by it: ${named}.</p>`;
  if (meaningChanged) html += `<p><strong>Was:</strong> ${esc(m.meaning)}</p><p><strong>Will be:</strong> ${esc(fields.meaning ?? m.meaning)}</p><fieldset><legend>Is it still the same number?</legend><label style="font-weight:400"><input type="radio" name="comparable" value="yes"${f.comparable === 'yes' ? ' checked' : ''}> It’s still the same number: better words</label><label style="font-weight:400"><input type="radio" name="comparable" value="no"${f.comparable === 'no' ? ' checked' : ''}> The number itself changes</label></fieldset>`;
  if (unitChanged) html += `<fieldset><legend>${esc(m.unit)} to ${esc(fields.unit)}</legend><label style="font-weight:400"><input type="radio" name="relabel" value="1"> Only a new label for the same numbers: every goal’s unit changes too</label><label style="font-weight:400"><input type="radio" name="relabel" value="0"> A different scale</label></fieldset>`;
  if (dirChanged || meaningChanged) html += `<label for="reason">Why, in a line <span class="opt">· every goal measured by it will show this</span></label><input type="text" id="reason" name="reason" maxlength="300" value="${esc(f.reason || '')}">`;
  html += `<input type="hidden" name="confirm" value="1">`;
  if (refused && f.save && (f.comparable || f.reason || f.relabel)) html += `<div class="must-fix" role="alert">${api.warnMark} <strong>Must fix</strong> ${esc(refused)}</div>`;
  return { title: 'Before you save: what this does to its goals', html };
}
export { href, mayChange, undos, dateWords };
export function resetMemory() { undos.clear(); formDrafts.clear(); }
