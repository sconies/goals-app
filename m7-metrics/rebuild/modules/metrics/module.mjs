// The Metric library module (spec/rebuild/stage-7-module-metrics.md): it registers into the core's module platform
// (a menu row after People, routes, places, Help, actions, AI tools and hooks) and keeps its own records under
// modules.metrics. The core never names it; with `metrics` in modulesOff, none of this is drawn or answers.
import { h, status as statusOf } from '../../app/pages.mjs';
import { fold } from '../../screens.mjs';
import * as R from './rules.mjs';
import * as O from './ops.mjs';
import * as RD from './reading.mjs';
import { metricsSheetRows, SHEET_COLS } from './sheet.mjs';

const NAME = 'Metric library';
const STYLE = '<style>.filters{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:end}.filters label,.filters select,.filters input{max-width:100%;min-width:0}.metrics li,.metric-goals td{overflow-wrap:anywhere}@media (max-width:700px){.metric-goals thead{display:none}.metric-goals,.metric-goals tbody,.metric-goals tr,.metric-goals td{display:block}.metric-goals tr{padding:8px 0;border-bottom:1px solid currentColor}}</style>';
const ctxOf = (app) => ({ W: app.W, S1: app.S1, now: app.now || app.W.builtFor });
const SQ = {
  measured: '<rect x="2" y="2" width="12" height="12" fill="currentColor"/>',
  partly: '<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="8" width="12" height="6" fill="currentColor"/>',
  gap: '<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>',
};
export const measuredMark = (ms) => `<span class="measurement ${ms}"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">${SQ[ms]}</svg><span class="word">${R.MEASUREMENT_WORDS[ms]}</span></span>`;
const href = (m) => `/metrics/${R.metricSlug(m)}`;
const isAdmin = (app, id) => !!app.person(id)?.admin;
const mayChange = (app, v, m) => R.mayChange(app.W, v.id, m);
const sel = (name, opts, cur, label) => `<label>${label} <select name="${name}">${opts.map(([v, l]) => `<option value="${h(v)}"${String(cur ?? '') === String(v) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>`;
const msg = (url) => (url && url.searchParams.get('said') ? `<p class="message" role="status">${h(url.searchParams.get('said'))}</p>` : '');
const withSaid = (to, said) => `${to}${to.includes('?') ? '&' : '?'}said=${encodeURIComponent(said)}`;

// ---------- the library ----------
function libraryPage(app, v, url) {
  const ctx = ctxOf(app), q = url.searchParams;
  const ask = Object.fromEntries(['q', 'unit', 'teamId', 'ownerId', 'dir', 'unused', 'sortout', 'sort', 'page', 'retired'].filter((k) => q.get(k)).map((k) => [k, q.get(k)]));
  const r = R.findMetrics(ctx, ask);
  const live = R.liveGoalIds(ctx);
  const units = [...new Set(R.liveMetrics(app.W).map((m) => m.unit))].sort((a, b) => (fold(a) < fold(b) ? -1 : 1));
  const rows = r.rows.map((m) => {
    const goals = R.metricGoals(ctx, m, live);
    const needs = mayChange(app, v, m) ? R.needsLine(R.metricNeeds(ctx, m, live)) : '';
    return `<li class="metric-row" data-metric="${h(m.id)}"><a href="${href(m)}">${h(m.name)}</a> <span class="line">${h(m.unit)} · ${h(R.DIR_WORDS[m.direction])} · ${h(R.ownerName(app.W, m) || 'no owner')}</span>
      <span class="by-status">${R.goalsByStatus(goals).map(([st, n]) => `${statusOf(st)} ${n}`).join(' ') || 'No goals'}</span> ${measuredMark(R.measurementOf(m))}${needs ? ` <span class="needs">${h(needs)}</span>` : ''}</li>`;
  }).join('');
  const retired = R.inUseMetrics(app.W).filter(R.isRetired).length;
  const filters = `<form method="get" action="/metrics" class="filters"><label>Find a metric <input type="search" name="q" value="${h(ask.q || '')}"></label>
    ${sel('unit', [['', 'Any unit'], ...units.map((u) => [u, u])], ask.unit, 'Unit')}
    ${sel('teamId', [['', 'Any'], ['company', 'The whole company'], ...app.W.teams.map((t) => [t.id, t.name])], ask.teamId, 'Measured for')}
    ${sel('dir', [['', 'Either way'], ['higher', 'Higher is better'], ['lower', 'Lower is better']], ask.dir, 'Which way is better')}
    ${sel('sort', [['', 'A to Z'], ['goals', 'Most goals first'], ['changed', 'Changed lately']], ask.sort, 'Order')}
    <label><input type="checkbox" name="unused" value="true"${ask.unused ? ' checked' : ''}> No goals</label> <label><input type="checkbox" name="sortout" value="true"${ask.sortout ? ' checked' : ''}> Something to sort out</label> <button>Show</button></form>`;
  const pager = r.pages > 1 ? `<p>Page ${r.page} of ${r.pages}${r.page < r.pages ? ` · <a href="/metrics?${new URLSearchParams({ ...ask, page: r.page + 1 })}">Next 50</a>` : ''}</p>` : '';
  return { name: ask.retired ? 'Retired metrics' : 'Metrics', backParent: { none: true }, body: `${STYLE}<h1>${ask.retired ? 'Retired metrics' : 'Metrics'}</h1>${msg(url)}<p>Each number goals are measured by, defined once.</p>
    <a class="btn primary" href="/metrics/new">Add a metric</a>${filters}<p class="count">${r.total} ${r.total === 1 ? 'metric' : 'metrics'}</p><ul class="metrics">${rows}</ul>${pager}
    ${!ask.retired && retired ? `<p><a href="/metrics?retired=true">See the ${retired} retired metrics</a></p>` : ''}<p><a href="/metrics/removed">Recently removed</a> · <a href="/metrics/sheet">The Metrics sheet</a></p>` };
}

// ---------- a metric's page ----------
function metricPage(app, v, url, m) {
  const ctx = ctxOf(app), W = app.W, live = R.liveGoalIds(ctx);
  const goals = R.metricGoals(ctx, m, live);
  const can = mayChange(app, v, m);
  const needs = can ? R.metricNeeds(ctx, m, live) : [];
  const sources = R.demoSources(W, app.S1);
  const src = R.sourceFor(sources, m.id);
  const table = goals.length ? `<table class="metric-goals"><thead><tr><th>Status</th><th>Goal</th><th>For</th><th>Now</th><th>Target</th><th>Against plan</th><th>Owner</th></tr></thead><tbody>${goals.map((x) => `<tr data-goal="${h(x.goal.key)}"><td>${statusOf(x.status)}</td><td><a href="/goals/${x.goal.id}">${h(x.goal.title)}</a></td><td>${h(x.slice)}</td><td>${h(x.now)}</td><td>${h(x.target)}</td><td>${h(x.vsPlan)}</td><td>${h(x.owner)}</td></tr>`).join('')}</tbody></table><p class="summary">${h(R.summaryLine(goals))}</p><p><a href="/goals?scope=all&metric=${h(m.id)}">See these goals in Goals</a></p>` : '<p>No goal is measured by it yet.</p>';
  const inCk = m.source ? `<h3>In each goal’s check-in</h3><ul>${goals.map((x) => {
    const asked = src ? R.askSource(src, m.id, ctx.now, { teamId: x.link.teamId, part: x.link.part || '' }) : null;
    const last = W.checkIns.filter((c) => c.goalId === x.goal.id && c.reading && !c.removedAt).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
    const words = !src ? 'Typed by hand: no source can be read' : asked.state === 'no-slice' ? `Typed by hand: ${src.name} has no number per team` : `Filled in from ${src.name}${last ? ` · last read ${RD.readWhen(last.reading.at, ctx.now)}` : ''}`;
    return `<li>${h(x.goal.title)} · ${h(x.slice)} · ${h(words)}</li>`;
  }).join('')}</ul>${src ? `<p>${h(RD.differentWords(W, app.S1, m, src.name, ctx.now).words)}</p>` : ''}` : '';
  const marks = (m.marks || []).map((mk) => `<li>${h(R.markLabel(mk))}: ${h(mk.why)}</li>`).join('');
  const kids = R.childrenOf(W, m);
  const facts = [['Unit', `${m.unit}, ${R.decimalsWords(m.decimals ?? 0)}`], ['Which way is better', R.DIR_WORDS[m.direction]], ['Measured', null], ['Source', m.source], ['The source’s owner', m.sourceOwner], ['Refresh', m.refresh || ''], ['Owner', R.ownerName(W, m) || 'No owner'], ['Caveats', m.caveats], ['Confidence', m.confidence || ''], ['How it could be gamed', m.gaming || ''], ['Added by', app.person(m.createdBy)?.name]];
  const actions = can ? `<p><a class="btn primary" href="${href(m)}/edit">Change it</a></p>
    <form method="post" action="/act/metrics.${R.isRetired(m) ? 'unretire' : R.everUsed(W, m) ? 'retire' : 'remove'}"><input type="hidden" name="id" value="${h(m.id)}">${!R.isRetired(m) && R.everUsed(W, m) ? '<label>Why it is retired <input name="why" maxlength="300"></label>' : ''}<button>${R.isRetired(m) ? 'Bring it back' : R.everUsed(W, m) ? 'Retire it' : 'Remove it'}</button></form>
    ${isAdmin(app, v.id) && !R.isRetired(m) ? `<form method="post" action="/act/metrics.merge"><input type="hidden" name="from" value="${h(m.id)}">${sel('to', R.liveMetrics(W).filter((x) => x.id !== m.id && x.unit === m.unit).map((x) => [x.id, x.name]), '', 'Merge into')}<button>Merge</button></form>` : ''}`
    : `<p>Only ${h(app.person(m.ownerId)?.name || 'its owner')} or an admin can change it.</p>`;
  const body = `${STYLE}<h1>${h(m.name)}</h1>${msg(url)}<p class="still">${h(R.stillToSay(W, m))}</p>${R.isRetired(m) ? `<p>Retired ${h(String(m.retiredAt).slice(0, 10))}: ${h(m.retiredWhy || '')}</p>` : ''}
    ${R.placeWords(W, m) ? `<p>${h(R.placeWords(W, m))}</p>` : ''}
    <section aria-label="What it means"><h2>What it means</h2><p>${h(m.meaning || 'No meaning yet.')}</p></section>
    <section aria-label="Its goals"><h2>Goals measured by it</h2>${table}</section>
    ${needs.length ? `<section aria-label="To sort out"><h2>To sort out</h2><ul>${needs.map((n) => `<li data-need="${n.code}">${h(n.words)} <a href="${n.href || `${href(m)}/edit#${n.field}`}">${h(n.button)}</a></li>`).join('')}</ul></section>` : ''}
    <section aria-label="Where the number comes from"><h2>Where the number comes from</h2><dl class="facts">${facts.map(([k, val]) => `<dt>${k}</dt><dd>${val === null ? `${measuredMark(R.measurementOf(m))}${m.measurementNote ? ` ${h(m.measurementNote)}` : ''}` : h(val || '—')}</dd>`).join('')}</dl>${inCk}</section>
    ${kids.length ? `<section aria-label="Under it"><h2>Under it</h2><ul>${kids.map((k) => `<li><a href="${href(k)}">${h(k.name)}</a>, ${h(k.level || 'under it')}</li>`).join('')}</ul></section>` : ''}
    ${marks ? `<section aria-label="Changes"><h2>Changes its goals show</h2><ul>${marks}</ul></section>` : ''}${actions}`;
  return { name: m.name, body, backParent: { to: '/metrics', label: 'Metrics' } };
}

// ---------- the form ----------
function formPage(app, v, url, m) {
  const d = m || { name: url.searchParams.get('name') || '', unit: '', decimals: 0, direction: '', meaning: '', source: '', sourceOwner: '', refresh: '', caveats: '', ownerId: v.id };
  const f = (name, label, val, type = 'input') => type === 'input' ? `<label id="${name}">${label} <input name="${name}" value="${h(val ?? '')}"></label>` : `<label id="${name}">${label} <textarea name="${name}">${h(val ?? '')}</textarea></label>`;
  const body = `<h1>${m ? `Change ${h(m.name)}` : 'Add a metric'}</h1><form method="post" action="/act/metrics.save">${m ? `<input type="hidden" name="id" value="${h(m.id)}">` : ''}
    ${f('name', 'Name', d.name)}${f('unit', 'Unit', d.unit)}${sel('direction', [['', 'Choose'], ['higher', 'Higher is better'], ['lower', 'Lower is better']], d.direction, 'Which way is better')}
    ${sel('decimals', [0, 1, 2, 3, 4].map((x) => [x, R.decimalsWords(x)]), d.decimals ?? 0, 'Decimals')}
    ${f('meaning', 'What it means and how it’s calculated', d.meaning, 'textarea')}${f('source', 'Source', d.source)}${f('sourceOwner', 'Who owns that source', d.sourceOwner)}
    ${sel('refresh', [['', 'Not said'], ...R.REFRESH.map((x) => [x, x[0].toUpperCase() + x.slice(1)])], d.refresh, 'Refresh')}
    ${sel('ownerId', app.W.people.filter((p) => !p.leftAt).map((p) => [p.id, p.name]), d.ownerId, 'Owner')}${f('caveats', 'Caveats', d.caveats, 'textarea')}
    ${sel('measurement', [['measured', 'Measured'], ['partly', 'Partly'], ['gap', 'Gap']], R.measurementOf(d), 'Measured today')}${f('measurementNote', 'What’s missing', d.measurementNote)}
    ${sel('parentId', [['', 'None'], ...R.liveMetrics(app.W).filter((x) => !m || x.id !== m.id).map((x) => [x.id, x.name])], d.parentId, 'Part of')}
    ${sel('level', [['', 'Not said'], ...R.LEVELS.map((x) => [x, x])], d.level, 'How it relates')}${sel('confidence', [['', 'Not said'], ...R.CONFIDENCE.map((x) => [x, x])], d.confidence, 'Confidence')}
    ${f('gaming', 'How it could be gamed', d.gaming, 'textarea')}
    ${m ? `${sel('comparable', [['', '—'], ['true', 'It’s still the same number'], ['false', 'The number itself changes']], '', 'If the meaning or source changes')}<label>Why <input name="reason" maxlength="300"></label><label><input type="checkbox" name="relabel" value="true"> A new unit is only a new label</label><label><input type="checkbox" name="confirm" value="true"> Change it for the goals that use it</label>` : ''}
    <fieldset><legend>Questions answered</legend><label><input type="checkbox" name="answer:name" value="keep"> Mine is different: keep it</label> <label><input type="checkbox" name="answer:unit" value="keep"> Keep my unit</label> <label><input type="checkbox" name="answer:meaning" value="as-written"> It’s right as written</label></fieldset>
    <p class="foot">${h(m ? R.stillToSay(app.W, m) : 'A name, a unit and which way is better make it usable; say the rest later.')}</p><button class="btn primary">${m ? 'Save the metric' : 'Add the metric'}</button></form>`;
  return { name: m ? `Change ${m.name}` : 'Add a metric', body, backParent: { to: m ? href(m) : '/metrics', label: m ? m.name : 'Metrics' } };
}

function removedPage(app, v) {
  const rows = R.lib(app.W).metrics.filter((m) => m.removedAt);
  return { name: 'Recently removed', body: `<h1>Recently removed metrics</h1>${rows.length ? `<ul>${rows.map((m) => `<li>${h(m.name)} <form method="post" action="/act/metrics.restore" style="display:inline"><input type="hidden" name="id" value="${h(m.id)}"><button>Restore</button></form></li>`).join('')}</ul>` : '<p>Nothing removed.</p>'}<form method="post" action="/act/metrics.undo"><button>Undo my last change</button></form>`, backParent: { to: '/metrics', label: 'Metrics' } };
}
function sheetPage(app, v, url) {
  const rows = metricsSheetRows(ctxOf(app));
  const csv = [SHEET_COLS, ...rows.map((r) => SHEET_COLS.map((c) => r[c]))].map((r) => r.map((x) => (/[",\n]/.test(String(x ?? '')) ? `"${String(x).replace(/"/g, '""')}"` : String(x ?? ''))).join(',')).join('\n');
  return { name: 'The Metrics sheet', body: `<h1>The Metrics sheet</h1>${msg(url)}<p>Copy it out, change rows, and load it back. An empty ID adds a metric.</p><form method="post" action="/act/metrics.import"><label>Metrics sheet (CSV) <textarea name="csv" rows="12">${h(csv)}</textarea></label><label><input type="checkbox" name="leaveOut" value="true"> Leave the rows to fix out and save the rest</label><button class="btn primary">Load it back</button></form>`, backParent: { to: '/metrics', label: 'Metrics' } };
}
export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ''));
  return (body || []).map((r) => Object.fromEntries(head.map((k, i) => [k.trim(), r[i] ?? ''])));
}

// ---------- the module ----------
const done = (r, to) => (r.error ? r : { ...r, redirect: to ? withSaid(to, r.summary || r.text || 'Saved') : undefined });
const logged = (app, actor, r, via) => { if (r.lines) O.logLines(app, actor, r.lines, via); return r; };
function act(fn) { return (app, actor, input) => { const r = fn(app, actor, input); if (r && r.nothing) return { error: r.text }; return r; }; }

export const module = {
  id: 'metrics', name: NAME, group: 'tools', summary: 'Define each metric once and link goals to it.', needs: [],
  menu: { to: '/metrics', label: 'Metrics', group: 'lookup' },
  records: [
    { id: 'metric', table: 'okr_metrics', filed: 'modules.metrics.metrics', removable: true },
    { id: 'metric link', table: 'okr_goal_metrics', filed: 'modules.metrics.metricLinks', removable: false },
  ],
  routes: [
    { path: '/metrics', name: 'Metrics', help: 'metrics' }, { path: '/metrics/new', name: 'Add a metric', help: 'metric-define' },
    { path: '/metrics/removed', name: 'Recently removed', help: 'metrics' }, { path: '/metrics/sheet', name: 'The Metrics sheet', help: 'metric-sheet' },
    { path: '/metrics/:slug', name: 'Metric', help: 'metrics' }, { path: '/metrics/:slug/edit', name: 'Change a metric', help: 'metric-define' },
    { path: '/data/metrics', name: 'Metrics', help: 'metrics' },
  ],
  page(app, viewer, { url, params, path }) {
    if (path === '/data/metrics') { const q = url.searchParams; const id = q.get('m'); const m = id ? R.findMetric(app.W, id) : null; const rest = new URLSearchParams([...q].filter(([k]) => !['m', 'edit', 'new'].includes(k))).toString(); return { redirect: `${q.has('new') ? '/metrics/new' : m ? `${href(m)}${q.has('edit') ? '/edit' : ''}` : '/metrics'}${rest ? `?${rest}` : ''}` }; }
    if (path === '/metrics') return libraryPage(app, viewer, url);
    if (path === '/metrics/new') return formPage(app, viewer, url, null);
    if (path === '/metrics/removed') return removedPage(app, viewer);
    if (path === '/metrics/sheet') return sheetPage(app, viewer, url);
    const m = R.findMetric(app.W, params.slug);
    if (!m || m.removedAt) return { status: 404, name: 'Metric not found', body: '<h1>Metric not found</h1><p>No metric is at this address. It may have been removed.</p><a href="/metrics">See every metric</a>' };
    if (path === '/metrics/:slug/edit') return mayChange(app, viewer, m) ? formPage(app, viewer, url, m) : { status: 403, name: m.name, body: `<h1>${h(m.name)}</h1><p>${h(R.changeRefusal(app.W, m))}</p>` };
    return metricPage(app, viewer, url, m);
  },
  places: {
    'goal.facts': ({ goal, app }) => { const mo = R.measureOf(app.W, goal.id); return mo ? `<p class="fact" data-module="metrics">Measured by <a href="${href(mo.metric)}">${h(mo.metric.name)}</a>${R.isRetired(mo.metric) ? `, retired ${h(String(mo.metric.retiredAt).slice(0, 10))}` : ''}</p>` : ''; },
    'goal.sections': ({ goal, app }) => {
      const mo = R.measureOf(app.W, goal.id);
      if (!mo) return '';
      const { metric: m, link: l } = mo;
      const from = `${m.unit}, ${R.decimalsWords(m.decimals ?? 0)}, ${R.DIR_WORDS[m.direction]}.${m.source ? ` From ${m.source}, refreshed ${m.refresh || 'when its owner says'}.` : ''}`;
      const where = [m.source, m.sourceOwner ? `(${m.sourceOwner})` : '', m.refresh ? `, refreshed ${m.refresh}` : ''].filter(Boolean).join(' ').replace(' ,', ',');
      const t = R.goalSummary(ctxOf(app), goal).target;
      const last = app.W.checkIns.filter((c) => c.goalId === goal.id && !c.removedAt).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
      const thisWeek = last && last.reading ? RD.readingThisWeek(app.W, goal, last, app.now) : '';
      const marks = R.marksFor(app.W, app.S1, m, l).map((mk) => `<li>${h(R.markLabel(mk))}: ${h(mk.why)}</li>`).join('');
      return `<section class="measured-by" data-module="metrics" aria-label="Measured by"><h2>Measured by <a href="${href(m)}">${h(m.name)}</a>${R.isRetired(m) ? `, retired ${h(String(m.retiredAt).slice(0, 10))}` : ''}</h2><dl class="facts"><dt>For</dt><dd>${h(R.sliceWords(app.W, l.teamId, l.part))}</dd><dt>What it means</dt><dd>${h(m.meaning || 'No meaning yet')}</dd><dt>From the metric</dt><dd>${h(from)}</dd>${where ? `<dt>Where the number comes from</dt><dd>${h(where)}</dd>` : ''}${m.caveats ? `<dt>Caveats</dt><dd>${h(m.caveats)}</dd>` : ''}<dt>This goal’s own</dt><dd>${h(t)}</dd>${thisWeek ? `<dt>This week’s number</dt><dd>${h(thisWeek)}</dd>` : ''}</dl>${marks ? `<ul class="marks">${marks}</ul>` : ''}</section>`;
    },
    'goal.measure': ({ app, draft, viewer }) => {
      if (draft.kind === 'milestone' || !viewer) return '';
      const ms = R.liveMetrics(app.W).sort((a, b) => (fold(a.unit) === fold(draft.unit || '') ? -1 : 0) - (fold(b.unit) === fold(draft.unit || '') ? -1 : 0) || (fold(a.name) < fold(b.name) ? -1 : 1));
      const chosen = draft.metricId ? R.findMetric(app.W, draft.metricId) : null;
      const team = app.W.teams.find((t) => t.id === draft.teamId);
      const fill = chosen && !draft.unitTyped ? `<p class="from-metric">${h(`${chosen.unit}, ${R.decimalsWords(chosen.decimals ?? 0)}, ${R.DIR_WORDS[chosen.direction]}: from the metric.`)}</p>` : '';
      return `<div class="measured-by-field" data-module="metrics"><label>Measured by <select name="metricId"><option value="">No metric</option>${ms.map((m) => `<option value="${h(m.id)}"${draft.metricId === m.id ? ' selected' : ''}>${h(m.name)} · ${h(m.unit)} · ${h(R.DIR_WORDS[m.direction])} · ${h(R.ownerName(app.W, m) || 'no owner')}</option>`).join('')}</select></label>
        ${chosen ? `<p class="meaning">${h(chosen.meaning)}</p>` : ''}${fill}${sel('metricFor', [...(team ? [[team.id, team.name]] : []), ['company', 'The whole company']], draft.metricFor || (team ? team.id : 'company'), 'For')}<label>Which part <input name="metricPart" maxlength="60" value="${h(draft.metricPart || '')}"></label>
        <p><a href="/metrics/new">Add a new metric</a></p></div>`;
    },
    'people.person': ({ person, app }) => { const ms = R.liveMetrics(app.W).filter((m) => m.ownerId === person.id); return ms.length ? `<section data-module="metrics" aria-label="Metrics"><h2>Metrics ${h(person.name.split(' ')[0])} owns</h2><ul>${ms.map((m) => `<li><a href="${href(m)}">${h(m.name)}</a></li>`).join('')}</ul></section>` : ''; },
    'people.team': ({ team, app }) => { const ids = new Set(R.liveLinks(ctxOf(app)).filter((l) => app.W.goals.find((g) => g.id === l.goalId)?.teamId === team.id).map((l) => l.metricId)); const ms = R.liveMetrics(app.W).filter((m) => ids.has(m.id)); return ms.length ? `<section data-module="metrics" aria-label="Metrics"><h2>Metrics its goals use</h2><ul>${ms.map((m) => `<li><a href="${href(m)}">${h(m.name)}</a></li>`).join('')}</ul></section>` : ''; },
    'workspace.about': ({ app, viewer }) => { if (!viewer.admin) return ''; const n = R.liveMetrics(app.W).filter((m) => !R.ownerName(app.W, m)).length; return n ? `<p data-module="metrics">${n} ${n === 1 ? 'metric has' : 'metrics have'} no owner. <a href="/metrics?sortout=true">See them</a></p>` : ''; },
    'checkin.number': ({ app, goal, viewer, input }) => RD.checkInNumberStep(app, goal, viewer, input),
  },
  help: [
    { id: 'metrics', after: 'getting-around', title: 'Metrics: what each number means', body: 'The metric library: each number goals are measured by, defined once, with its page saying what it means and every goal measured by it, side by side.' },
    { id: 'metric-define', title: 'Defining a metric well', body: 'A name, a unit and which way is better make a metric usable. Say the rest later: its page says what is still to say, in words.' },
    { id: 'metric-measured-by', title: 'Measured by: choosing a goal’s metric', body: 'Choose the metric where the goal is made or changed. On a new goal it fills in the unit, decimals and which way is better.' },
    { id: 'metric-slices', title: 'Measured by: for whom, and which part', body: 'A goal is measured for a team or the whole company, and optionally one part of that number.' },
    { id: 'metric-change', title: 'Changing, retiring and merging a metric', body: 'A change of meaning or direction is marked on every goal it measures. A metric that has measured a goal is retired, never deleted.' },
    { id: 'metric-measurement', title: 'When a number isn’t measured yet', body: 'A metric says whether it is measured today: Measured, Partly or Gap. A goal measured by a gap is held to no number.' },
    { id: 'metric-structure', title: 'Where a metric sits, and how far to trust it', body: 'A metric may name its parent and how it relates, a confidence and how it could be gamed.' },
    { id: 'metric-sheet', title: 'Metrics in a spreadsheet', body: 'Export the Metrics sheet, change or add rows, and load it back through the same questions and Undo.' },
  ],
  actions: {
    'metrics.save': act((app, actor, f) => { const isNew = !f.id; const r = O.saveMetric(app, actor, f, { answers: { name: f['answer:name'], unit: f['answer:unit'], meaning: f['answer:meaning'] }, comparable: f.comparable === '' ? undefined : f.comparable, reason: f.reason, relabel: f.relabel === 'true', confirm: f.confirm === 'true' }); logged(app, actor, r); return done(r, r.metric ? `/metrics/${R.metricSlug(r.metric)}` : null); }),
    'metrics.remove': act((app, actor, f) => done(O.removeMetric(app, actor, f.id), '/metrics')),
    'metrics.restore': act((app, actor, f) => done(O.restoreMetric(app, actor, f.id), '/metrics/removed')),
    'metrics.retire': act((app, actor, f) => { const r = logged(app, actor, O.retireMetric(app, actor, f.id, f.why, f.replacedBy)); return done(r, `/metrics/${R.metricSlug(R.findMetric(app.W, f.id) || { id: '' })}`); }),
    'metrics.unretire': act((app, actor, f) => { const r = logged(app, actor, O.unretireMetric(app, actor, f.id)); return done(r, `/metrics/${R.metricSlug(R.findMetric(app.W, f.id) || { id: '' })}`); }),
    'metrics.merge': act((app, actor, f) => done(logged(app, actor, O.mergeMetrics(app, actor, f.from, f.to)), '/metrics')),
    'metrics.link': act((app, actor, f) => { const r = logged(app, actor, O.linkGoal(app, actor, { goalId: f.goalId, metricId: f.metricId, teamId: f.teamId, part: f.part, reason: f.reason, answers: { others: f['answer:others'], part: f['answer:part'] } })); return done(r, `/goals/${f.goalId}`); }),
    'metrics.unlink': act((app, actor, f) => done(logged(app, actor, O.unlinkGoal(app, actor, f.goalId)), `/goals/${f.goalId}`)),
    'metrics.undo': act((app, actor) => done(O.undoLast(app, actor), '/metrics')),
    'metrics.import': act((app, actor, f) => { const r = O.loadSheet(app, actor, parseCsv(f.csv || ''), { leaveOut: f.leaveOut === 'true' }); return r.error ? r : done(logged(app, actor, r), '/metrics/sheet'); }),
  },
  hooks: {
    onGoalSaved: (app, actor, { goalId, draft, via }) => { if (!draft || !draft.metricId) return; const r = O.linkGoal(app, actor, { goalId, metricId: draft.metricId, teamId: draft.metricFor || null, part: draft.metricPart || '', answers: { others: 'carry-on', part: 'keep' } }); logged(app, actor, r, via); },
    checkInProblems: (app, actor, { goal, input }) => { const p = RD.readingFromForm(app, goal, input); return p && p.problem ? [p.problem] : []; },
    onCheckIn: (app, actor, { goalId, week, input }) => { const g = app.goal(goalId); const p = RD.readingFromForm(app, g, input); if (!p || !p.reading) return; const c = app.W.checkIns.filter((x) => x.goalId === goalId && x.week === week && !x.removedAt).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0]; if (c) c.reading = p.reading; },
    onSwitch: (app, actor, on) => O.onSwitch(app, actor, on),
  },
  aiTools: [],
};
import { TOOLS } from './tools.mjs';
module.aiTools = TOOLS;
