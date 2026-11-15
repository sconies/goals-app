// The metric library's declaration: what it adds to the core (spec/modules/metrics/README.md, "What it adds to the core"),
// registered into core/modules.mjs. Nothing outside this folder knows what a metric is.
import * as L from './rules.mjs';
import * as B from './library.mjs';
import * as P from './pages.mjs';
import { tools } from './tools.mjs';
import { writeMetricsCsv } from './conformance.mjs';
import { sourceFor } from './sources.mjs';

const rowsOf = (W) => B.rows(W);
const linkOf = (W, goalId) => rowsOf(W).metricLinks.find((l) => l.goalId === goalId && !l.removedAt) || null;
const metricOf = (W, id) => rowsOf(W).metrics.find((m) => m.id === id) || null;
const actx = (ctx) => ({ actor: ctx.viewer, now: ctx.nowIso(), week: ctx.week });

/** Old addresses under Data (rule 3, movedMetrics). */
export function movedMetrics(url) {
  const q = new URLSearchParams(url.searchParams);
  const id = q.get('m'); const edit = q.has('edit'); const nw = q.has('new');
  q.delete('m'); q.delete('edit'); q.delete('new');
  const rest = q.toString() ? `?${q}` : '';
  if (nw) return `/metrics/new${rest}`;
  if (id) return `/metrics/${L.metricSlug(id)}${edit ? '/edit' : ''}${rest}`;
  return `/metrics${rest}`;
}

function measureField(api, ctx, d, errs = {}) {
  const { W, esc } = api;
  const existing = !!d.existing;
  if (existing && !(d.ownerId === ctx.viewer || api.R.person.get(ctx.viewer)?.admin)) return '';
  const link = existing ? linkOf(W, d.id) : null;
  const metricId = existing ? (d._metricId ?? link?.metricId ?? '') : d.metricId || '';
  const m = metricId ? metricOf(W, metricId) : null;
  const teamId = existing ? (link ? link.teamId : d.teamId) : d.teamId;
  const forVal = existing ? (d._for ?? (link ? link.teamId ?? 'company' : d.teamId || 'company')) : (d.metricFor || (teamId || 'company'));
  const part = existing ? (d._part ?? link?.part ?? '') : d.metricPart || '';
  const live = P.liveGoalIds(api, ctx);
  const parts = m ? L.partsOf(m.id, rowsOf(W).metricLinks, live).slice(0, 5) : [];
  const hasCk = existing && (W.checkIns || []).some((c) => c.goalId === d.id && !c.removedAt);
  const fromLine = m && !existing && d.unitFromMetric ? `<p class="from-metric">${esc(m.unit)}, ${L.decimalsWords(m.decimals || 0)}, ${L.dirWords(m.direction)}: from the metric. <button class="btn link" type="submit" name="metricOwnUnit" value="1">Use different ones</button></p>` : '';
  const err = errs.metric ? `<p class="err" role="alert">${esc(errs.metric)}</p>` : '';
  const checks = (errs._metricChecks || []).map((c) => `<div class="check" role="group" aria-label="Check">${api.warnMark} <strong>Check</strong> <p>${esc(c.text)}</p>${c.field === 'others' ? '<button class="btn" name="ans_others" value="carry-on">Carry on</button>' : `<button class="btn" name="ans_part" value="use:${esc(c.use)}">Use “${esc(c.use)}”</button> <button class="btn" name="ans_part" value="keep">Keep yours</button>`}</div>`).join('');
  const team = api.R.team.get(teamId);
  return `<div class="measured-by-field"><label for="pk-metric">Measured by <span class="opt">· optional</span></label>${api.picker('metricId', 'metric', metricId, m ? m.name : '', { aria: 'Find a metric', id: 'pk-metric', for: d.unit || '' })}
${metricId ? '<button class="btn link" type="submit" name="metricNone" value="1">No metric</button>' : ''}${err}
${m ? `<p class="metric-meaning meta">${esc(m.meaning || 'No meaning yet.')}</p>${fromLine}${existing ? `<p class="meta">From the metric: ${esc(L.fromTheMetric(m))}</p>` : ''}
<label for="metricFor">For</label><select id="metricFor" name="metricFor">${team ? `<option value="${team.id}"${forVal === team.id ? ' selected' : ''}>${esc(team.name)}</option>` : ''}<option value="company"${forVal === 'company' ? ' selected' : ''}>The whole company</option></select>
<label for="metricPart">Which part <span class="opt">· optional, at most 60 characters</span></label><input type="text" id="metricPart" name="metricPart" maxlength="60" value="${esc(part)}">${parts.length ? `<p class="meta">Parts other goals on this metric use: ${parts.map((x) => `<button class="btn link" type="button" data-part="${esc(x)}">${esc(x)}</button>`).join(', ')}</p>` : ''}
${hasCk ? `<label for="metricWhy">Why <span class="opt">· required if what measures it changes; it shows in its History</span></label><input type="text" id="metricWhy" name="metricWhy" maxlength="300" value="${esc(d._why || '')}">${errs.why ? `<div class="must-fix" role="alert">${api.warnMark} <strong>Must fix</strong> ${esc(errs.why)}</div>` : ''}` : ''}` : ''}${checks}
<script>(function(){var w=document.currentScript.parentNode;var h=w.querySelector('input[name=metricId]');if(h)h.addEventListener('change',function(){var f=h.form;var r=document.createElement('input');r.type='hidden';r.name='metricRefresh';r.value='1';f.appendChild(r);if(f.requestSubmit)f.requestSubmit();else f.submit();});
w.querySelectorAll('[data-part]').forEach(function(b){b.addEventListener('click',function(){w.querySelector('#metricPart').value=b.dataset.part;});});
${fromLine ? "var u=document.getElementById('unit');if(u){u.style.display='none';var lb=document.querySelector('label[for=unit]');if(lb)lb.style.display='none';}" : ''}})();</script></div>`;
}

function aboutSection(api, ctx, g) {
  const { W, esc } = api;
  const l = linkOf(W, g.id);
  if (!l) return '';
  const m = metricOf(W, l.metricId);
  if (!m) return '';
  const slice = L.sliceWords(l, W.teams);
  const target = L.goalTarget(g);
  const latest = (W.checkIns || []).filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= ctx.moment).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
  const sw = P.sayWhen(api, ctx);
  const thisWeek = latest && latest.reading ? (latest.reading.why ? `${L.fmt(latest.value, g.unit, g.decimals || 0)}, typed by ${api.nameOf(latest.authorId)}. ${latest.reading.source} said ${L.fmt(latest.reading.value, g.unit, g.decimals || 0)}.` : `${L.fmt(latest.value, g.unit, g.decimals || 0)}, from ${latest.reading.source}, read ${sw(latest.reading.at)}. Confirmed by ${api.nameOf(latest.authorId)}.`) : '';
  const marks = marksFor(api, ctx, g);
  const row = (k, v) => (v ? `<div><dt class="meta">${esc(k)}</dt><dd>${v}</dd></div>` : '');
  const src = [m.source, m.sourceOwner ? `(${m.sourceOwner})` : ''].filter(Boolean).join(' ') + (m.refresh ? `, refreshed ${m.refresh}` : '');
  return `<section class="measured-by" aria-labelledby="mb-h"><h2 id="mb-h">Measured by ${esc(m.name)}</h2>${m.retiredAt ? `<p>Measured by ${esc(m.name)}, retired ${P.dateWords(m.retiredAt)}.</p>` : ''}<dl>
${row('For', esc(slice))}${row('What it means', esc(m.meaning || 'No meaning yet.'))}${row('From the metric', esc(L.fromTheMetric(m)))}${row('Where the number comes from', esc(src.trim()))}${row('Caveats', esc(m.caveats))}${row('This goal’s own', target !== null ? esc(`${g.kind === 'range' ? (g.range.bound === 'atLeast' ? 'at least ' : 'at most ') : 'target '}${L.fmt(target, g.unit, g.decimals || 0)}`) : '')}${row('For this goal', g.definition && g.definition.trim() !== String(m.meaning || '').trim() ? esc(g.definition) : '')}${row('This week’s number', esc(thisWeek))}</dl>
${marks.map((mk) => `<p class="meta">${esc(mk.label)}: ${esc(mk.why)} <details style="display:inline"><summary>See both definitions</summary><p>Was: ${esc(mk.was)}</p><p>Now: ${esc(mk.now)}</p></details></p>`).join('')}
<p><a href="/metrics/${L.metricSlug(m.id)}">See the metric</a></p></section>`;
}
function marksFor(api, ctx, g) {
  const l = rowsOf(api.W).metricLinks.find((x) => x.goalId === g.id);
  if (!l) return [];
  const m = metricOf(api.W, l.metricId);
  return (m?.marks || []).filter((mk) => mk.at >= l.linkedAt).map((mk) => ({ ...mk, label: L.markLabel(mk) }));
}

function checkinState(api, ctx, g, typed = null) {
  const l = linkOf(api.W, g.id);
  if (!l) return null;
  const m = metricOf(api.W, l.metricId);
  const s = sourceFor(P.sourcesOf(api, ctx), l.metricId, l);
  if (!m || !s) return null;
  const reading = s.readsSlice ? s.source.read(l.metricId, ctx.moment, l) : null;
  const posted = (api.W.checkIns || []).filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= ctx.nowIso()).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1));
  const last = posted[posted.length - 1] || null;
  const state = L.readingState({ reading, noSlice: !s.readsSlice, lastReading: last?.reading || null, lastValue: last ? last.value : null, now: ctx.moment, typed, decimals: g.decimals || 0 });
  return { link: l, metric: m, source: s.source, reading, state, last };
}

const def = {
  id: 'metrics',
  name: 'The metric library',
  summary: 'Each number goals are measured by, defined once, and which metric measures a goal.',
  records: [
    { name: 'metric', table: 'okr_metrics', under: 'metrics', removable: true },
    { name: 'metric link', table: 'okr_goal_metrics', under: 'metricLinks', removable: false },
  ],
  nav: { id: 'metrics', label: 'Metrics', href: '/metrics' },
  goalsParams: ['metric'],
  owns(P2, url) {
    if (P2[0] === 'metrics') return true;
    if (P2[0] === 'data' && P2[1] === 'metrics') return true;
    if (url && P2[0] === 'api' && P2[1] === 'pick' && url.searchParams.get('kind') === 'metric') return true;
    return false;
  },
  async routes(api, ctx, req, res, p, url, hdr) {
    const { W } = api;
    const ok = (html, code = 200) => api.send(res, code, html, 'text/html; charset=utf-8', hdr);
    if (p[0] === 'data') { res.writeHead(301, { location: movedMetrics(url) }); res.end(); return; }
    if (p[0] === 'api') {
      const q = url.searchParams.get('q') || '';
      const live = P.liveGoalIds(api, ctx);
      const unit = url.searchParams.get('for') || '';
      let list = q ? L.findMetrics({ q }, { metrics: rowsOf(W).metrics, links: rowsOf(W).metricLinks, liveGoalIds: live, people: W.people, moment: ctx.moment }).rows.slice(0, 50)
        : [...L.liveMetrics(rowsOf(W).metrics)].sort((a, b) => rowsOf(W).metricLinks.filter((l) => l.metricId === b.id && !l.removedAt).length - rowsOf(W).metricLinks.filter((l) => l.metricId === a.id && !l.removedAt).length).slice(0, 6);
      list = list.filter((m) => !m.retiredAt);
      if (unit) list.sort((a, b) => (a.unit === unit ? 0 : 1) - (b.unit === unit ? 0 : 1));
      const html = list.map((m) => `<li role="option" data-id="${api.esc(m.id)}" data-label="${api.esc(m.name)}">${api.esc(m.name)}<br><span class="meta">${api.esc(m.unit)} · ${L.dirWords(m.direction)} · ${api.esc(m.ownerId && api.R.person.get(m.ownerId) ? api.nameOf(m.ownerId) : 'no owner')}</span></li>`).join('')
        + (q ? `<li role="option" data-href="/metrics/new?name=${encodeURIComponent(q)}&from=goal">Add “${api.esc(q)}” as a new metric</li>` : '');
      return api.send(res, 200, JSON.stringify({ html: html || '<li aria-disabled="true">Nothing matches.</li>', count: q ? `${list.length} found` : '' }), 'application/json');
    }
    const slug = p[1];
    if (req.method === 'GET') {
      if (!slug) return ok(P.libraryPage(api, ctx, url));
      if (slug === 'new') {
        return ok(P.metricForm(api, ctx, null, url, url.searchParams.get('name') ? { draft: { name: url.searchParams.get('name') } } : {}));
      }
      const m = L.findMetric(rowsOf(W).metrics, slug);
      if (!m) return api.send(res, 404, api.notFound(ctx, url, 'Metric not found'), 'text/html; charset=utf-8', hdr);
      if (p[2] === 'edit') return ok(m.retiredAt ? P.metricPage(api, ctx, m, url) : P.metricForm(api, ctx, m, url));
      if (p[2]) return api.send(res, 404, api.notFound(ctx, url), 'text/html; charset=utf-8', hdr);
      return ok(P.metricPage(api, ctx, m, url));
    }
    const f = await api.body(req);
    const back = (to) => api.redirect(res, to, hdr);
    if (slug === 'undo') { const u = P.undos.get(ctx.viewer); if (u) { u.undo(); P.undos.delete(ctx.viewer); api.bump(); } return back(url.searchParams.get('to') || '/metrics'); }
    if (slug === 'restore') { const r = B.restoreMetric(W, actx(ctx), p[2]); P.keepUndo(ctx.viewer, r, r.message); api.bump(); return back(r.ok ? `/metrics/${L.metricSlug(p[2])}?done=1` : `/metrics?err=${encodeURIComponent(r.refused)}`); }
    if (slug === 'new') {
      const r = P.postForm(api, ctx, null, f, url);
      if (r.redirect) {
        api.bump();
        if (r.metric && url.searchParams.get('from') === 'goal') { const dr = api.draftOf(ctx.viewer); if (dr.newGoal) { dr.newGoal.metricId = r.metric.id; if (!dr.newGoal.unit) { dr.newGoal.unit = r.metric.unit; dr.newGoal.decimals = r.metric.decimals; dr.newGoal.unitFromMetric = true; } } return back('/goals/new/measure'); }
        return back(r.redirect);
      }
      return ok(r.html, r.status || 200);
    }
    const m = L.findMetric(rowsOf(W).metrics, slug);
    if (!m) return back('/metrics');
    const done = (r, ok2 = `/metrics/${L.metricSlug(m.id)}?done=1`) => { if (r.ok) { P.keepUndo(ctx.viewer, r, r.message); api.bump(); return back(ok2); } return back(`/metrics/${L.metricSlug(m.id)}?err=${encodeURIComponent(r.refused)}`); };
    if (p[2] === 'edit') { const r = P.postForm(api, ctx, m, f, url); if (r.redirect) { api.bump(); return back(r.redirect); } return ok(r.html, r.status || 200); }
    if (p[2] === 'remove') return done(B.removeMetric(W, actx(ctx), m.id), '/metrics?done=1');
    if (p[2] === 'retire') return done(B.retireMetric(W, actx(ctx), m.id, f.why || '', f.replacedBy || null));
    if (p[2] === 'unretire') return done(B.unretireMetric(W, actx(ctx), m.id));
    if (p[2] === 'merge') { const r = B.mergeMetrics(W, actx(ctx), m.id, f.into, f.why); return done(r, r.ok ? `/metrics/${L.metricSlug(f.into)}?done=1` : undefined); }
    return back(`/metrics/${L.metricSlug(m.id)}`);
  },
  places: {
    'goal.facts'(api, ctx, g) {
      const l = linkOf(api.W, g.id); if (!l) return '';
      const m = metricOf(api.W, l.metricId); if (!m) return '';
      return `<p class="measured-by-line meta">Measured by <a href="/metrics/${L.metricSlug(m.id)}">${api.esc(m.name)}</a>, for ${api.esc(L.sliceWords(l, api.W.teams).replace('The whole company', 'the whole company'))}${m.retiredAt ? `, retired ${P.dateWords(m.retiredAt)}` : ''}</p>`;
    },
    'goal.sections': aboutSection,
    'goal.measure': measureField,
    'people.person'(api, ctx, p) {
      const ms = L.liveMetrics(rowsOf(api.W).metrics).filter((m) => m.ownerId === p.id);
      return ms.length ? `<section aria-labelledby="pm-h"><h2 id="pm-h">Metrics they own <span class="meta">${ms.length}</span></h2><div class="rows">${ms.map((m) => `<a href="/metrics/${L.metricSlug(m.id)}">${api.esc(m.name)}</a>`).join('')}</div></section>` : '';
    },
    'people.team'(api, ctx, t) {
      const live = P.liveGoalIds(api, ctx);
      const goals = new Set(api.W.goals.filter((g) => g.teamId === t.id).map((g) => g.id));
      const ids = new Set(L.liveLinks(rowsOf(api.W).metricLinks, live).filter((l) => goals.has(l.goalId)).map((l) => l.metricId));
      const ms = rowsOf(api.W).metrics.filter((m) => ids.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
      return ms.length ? `<section aria-labelledby="tm-h"><h2 id="tm-h">Metrics its goals use <span class="meta">${ms.length}</span></h2><div class="rows">${ms.map((m) => `<a href="/metrics/${L.metricSlug(m.id)}">${api.esc(m.name)}</a>`).join('')}</div></section>` : '';
    },
    'workspace.about'(api, ctx) {
      if (!api.R.person.get(ctx.viewer)?.admin) return '';
      const n = L.liveMetrics(rowsOf(api.W).metrics).filter((m) => { const o = api.W.people.find((p) => p.id === m.ownerId); return !o || o.leftAt || o.left; }).length;
      return n ? `<p class="metrics-no-owner">${n} ${n === 1 ? 'metric has' : 'metrics have'} no owner, and an owner keeps a metric’s meaning true. <a href="/metrics?sortout=true">See them</a></p>` : '';
    },
    'checkin.number'(api, ctx, g, dr) {
      const s = checkinState(api, ctx, g, dr.value !== undefined && dr.value !== '' && !dr._filled ? Number(dr.value) : null);
      if (!s) return '';
      const { esc } = api; const sw = P.sayWhen(api, ctx); const u = g.unit || '';
      const v = (x) => L.fmt(x, u, g.decimals || 0);
      const src = s.source.name;
      const hidden = s.reading && ['fresh', 'changed', 'jump'].includes(s.state) ? `<input type="hidden" name="reading_source" value="${esc(src)}"><input type="hidden" name="reading_value" value="${s.reading.value}"><input type="hidden" name="reading_at" value="${esc(s.reading.at)}">` : '';
      let html = '';
      if (s.state === 'fresh' || s.state === 'changed') html = `<p class="reading-line">From ${esc(src)}, read ${esc(sw(s.reading.at))}.</p>${s.last && s.last.value !== null ? `<p class="meta">Week ${s.last.week}: ${esc(v(s.last.value))}. Change the number if it’s wrong, and you’ll be asked why. You still say what changed: that is the next step.</p>` : ''}
<div class="reading-why" hidden><p class="reading-typed"></p><fieldset><legend>Why is it different?</legend>${Object.entries(L.READING_WHY).map(([k, w]) => `<label style="font-weight:400"><input type="radio" name="reading_why" value="${k}"> ${esc(w[0].toUpperCase() + w.slice(1))}</label>`).join('')}</fieldset><label for="rwt">Say more <span class="opt">· needed with Something else</span></label><input type="text" id="rwt" name="reading_text" maxlength="500"><p class="meta">Kept with this check-in, beside what ${esc(src)} said. It doesn’t change the goal’s status and nobody is told.</p></div>`;
      else if (s.state === 'same') html = `<p class="reading-line">No new reading since your last check-in: ${esc(src)} still says ${esc(v(s.reading.value))}, read ${esc(sw(s.reading.at))}.</p>`;
      else if (s.state === 'old') { const days = Math.floor((Date.parse(ctx.moment) - Date.parse(s.reading.at)) / 86400000); html = `<p class="reading-line" role="status">${api.warnMark} ${esc(src)} last read this on ${esc(api.R.dayShort(Math.floor(Date.parse(s.reading.at) / 86400000)))}, ${days} days ago. That is too old to fill in. Type this week’s number, or say there isn’t one.</p>`; }
      else if (s.state === 'no-slice') html = `<p class="reading-line">${esc(src)} measures this for the whole company, not for ${esc(L.sliceWords(s.link, api.W.teams))} on its own, so it isn’t filled in.</p>`;
      else if (s.state === 'missing') html = `<p class="reading-line">${esc(src)} has no number for this yet. Type this week’s number.</p>`;
      else if (s.state === 'jump') html = `<p class="reading-line">${api.warnMark} ${esc(src)} says ${esc(v(s.reading.value))}. Is it right?</p>`;
      const rv = s.reading && ['fresh', 'changed', 'jump'].includes(s.state) ? s.reading.value : null;
      const script = rv !== null ? `<script>document.addEventListener('DOMContentLoaded',function(){var f=document.querySelector('.reading').closest('form');var v=f.querySelector('[name=value]');var b=f.querySelector('button[name=post]');var w=f.querySelector('.reading-why');var RV=${JSON.stringify(rv)};var D=${g.decimals || 0};var U=${JSON.stringify(u)};
function fm(x){var s=Number(x).toFixed(D);return U==='%'?s+'%':U?s+' '+U:s;}
function upd(){var t=v.value.trim();var same=t===''||Number(Number(t.replace(',','.')).toFixed(D))===Number(Number(RV).toFixed(D));if(w)w.hidden=same;if(!same&&w)w.querySelector('.reading-typed').textContent='You typed '+fm(t)+'. ${esc(src)} said '+fm(RV)+'.';if(b)b.textContent=same?'Confirm '+fm(RV):'Use '+fm(t);}
v.addEventListener('input',upd);upd();});</script>` : '';
      return `<div class="reading">${hidden}${html}${script}</div>`;
    },
  },
  checkinPrefill(api, ctx, g, dr) {
    if (dr.value !== undefined && dr.value !== '' && !dr._filled) return;
    const s = checkinState(api, ctx, g);
    if (s && s.state === 'fresh') { dr.value = String(s.reading.value); dr._filled = true; } else if (dr._filled) { delete dr.value; delete dr._filled; }
  },
  checkinPost(api, ctx, g, f, value) {
    if (!f.reading_source || value === null) return null;
    const reading = { source: f.reading_source, value: Number(f.reading_value), at: f.reading_at };
    if (f.reading_why) reading.why = f.reading_why === 'else' ? { kind: 'else', text: f.reading_text || '' } : { kind: f.reading_why };
    const err = L.readingProblem(reading, value, { now: ctx.moment, decimals: g.decimals || 0 });
    if (err) return { error: err };
    return { reading: L.keptReading(reading, value, g.decimals || 0) };
  },
  goalsFilter(api, ctx, params, list, filters) {
    const id = params.get('metric');
    if (!id) return list;
    const m = metricOf(api.W, id);
    const goals = new Set(L.liveLinks(rowsOf(api.W).metricLinks, P.liveGoalIds(api, ctx)).filter((l) => l.metricId === id).map((l) => l.goalId));
    filters.push(['metric', 'Measured by', m ? m.name : 'a metric']);
    return list.filter((g) => goals.has(g.id));
  },
  measurePost(api, ctx, d, f) {
    if (f.metricNone) { if (d.unitFromMetric) { d.unit = d._unitBefore ?? ''; delete d.decimals; } delete d.metricId; delete d.unitFromMetric; d._stay = true; return; }
    if (f.metricOwnUnit) { d.unitFromMetric = false; d.unitOwn = true; d._stay = true; return; }
    if (f.metricFor !== undefined) d.metricFor = f.metricFor;
    if (f.metricPart !== undefined) d.metricPart = f.metricPart;
    if (f.ans_others) d.metricAnswers = { ...(d.metricAnswers || {}), others: f.ans_others };
    if (f.ans_part) d.metricAnswers = { ...(d.metricAnswers || {}), part: f.ans_part };
    if (f.metricId !== undefined && f.metricId !== (d.metricId || '')) {
      d.metricId = f.metricId || undefined;
      const m = metricOf(api.W, f.metricId);
      if (m && !d.unitOwn && (!d.unit || d.unitFromMetric || d.unit === m.unit)) { d._unitBefore = d.unitFromMetric ? d._unitBefore : d.unit; d.unit = m.unit; d.decimals = m.decimals || 0; d.unitFromMetric = true; }
      d.metricFor = d.teamId || 'company';
    } else if (d.unitFromMetric && d.metricId) { const m = metricOf(api.W, d.metricId); if (m) d.unit = m.unit; }
    if (f.metricRefresh || f.ans_others || f.ans_part) d._stay = true;
  },
  measureProblems(api, ctx, d) {
    const e = {};
    if (d._stay) { delete d._stay; e._stay = ''; }
    if (d.metricId && d.kind !== 'milestone') {
      const m = metricOf(api.W, d.metricId);
      if (m && L.fold(m.unit) !== L.fold(d.unit || '')) e.metric = `This metric is in ${m.unit}; this goal is in ${d.unit || 'no unit'}.`;
      if ((d.metricPart || '').length > 60) e.metric = 'Keep the part to 60 characters or fewer.';
    }
    return e;
  },
  readBackRows(api, ctx, d, rows) {
    if (!d.metricId || d.kind === 'milestone') return;
    const m = metricOf(api.W, d.metricId); if (!m) return;
    const forW = d.metricFor && d.metricFor !== 'company' ? api.teamName(d.metricFor) : 'the whole company';
    const i = rows.findIndex((r) => r[0] === 'Measured by');
    const row = ['Measured by', `${m.name}, for ${forW}${d.metricPart ? ` · ${d.metricPart}` : ''}.`];
    if (i >= 0) rows[i] = row; else rows.push(row);
  },
  goalPublished(api, ctx, g, d) {
    if (!d.metricId || g.kind === 'milestone') return;
    B.linkGoal(api.W, { actor: g.ownerId, now: ctx.now, week: ctx.week }, { goalId: g.id, metricId: d.metricId, teamId: d.metricFor && d.metricFor !== 'company' ? d.metricFor : null, part: d.metricPart || '', answers: { others: 'carry-on', part: 'keep' } });
  },
  editPost(api, ctx, g, f) {
    if (f.metricId === undefined) return null;
    const cur = linkOf(api.W, g.id);
    const c2 = { actor: ctx.viewer, now: ctx.now, week: ctx.week };
    if (f.metricNone || !f.metricId) { if (cur) B.unlinkGoal(api.W, c2, g.id); return null; }
    const answers = {}; if (f.ans_others) answers.others = f.ans_others; if (f.ans_part) answers.part = f.ans_part;
    const r = B.linkGoal(api.W, c2, { goalId: g.id, metricId: f.metricId, teamId: f.metricFor && f.metricFor !== 'company' ? f.metricFor : null, part: f.metricPart || '', reason: f.metricWhy || '', answers });
    if (!r.ok) return { error: r.refused, field: r.field === 'why' ? 'why' : 'metric' };
    return null;
  },
  goalMarks(api, ctx, g) { return marksFor(api, ctx, g).filter((mk) => mk.week >= ctx.week - 2); },
  onSwitch(W, on, ctx) { B.rework(W, ctx, B.rows(W).metricLinks.filter((l) => !l.removedAt).map((l) => l.goalId), on); },
  switchReadBack(api, on) {
    const M2 = rowsOf(api.W);
    const held = api.W.goals.filter((g) => g.unmeasuredSince).length;
    return on ? `Switching it off takes Metrics out of the menu and the goal forms. Its ${M2.metrics.filter(L.inUse).length} metrics and ${M2.metricLinks.filter((l) => !l.removedAt).length} links stay, and come back when it is switched on.${held ? ` ${held} goals held to no number are held to their plans again.` : ''}` : 'Switching it on brings back every metric and link as it was.';
  },
  importNotes(W, sheets, on) {
    if (!sheets.includes('Metrics')) return [];
    return on ? ['The Metrics sheet isn’t loaded back: metrics are added and changed in the app.'] : ['The Metrics sheet wasn’t read: the metric library is switched off here.'];
  },
  tools,
  onReset() { P.resetMemory(); },
  conformance(W, S1, R, outDir) { writeMetricsCsv(W, S1, R, outDir); },
};
export default def;
// The check-in's read-back gains the reading line (rule: the read-back, readingLine).
def.places['checkin.done'] = (api, ctx, g) => {
  if (!g) return '';
  const ck = (api.W.checkIns || []).filter((c) => c.goalId === g.id && c.authorId === ctx.viewer && c.reading).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
  return ck && ck.week === ctx.week ? `<p class="reading-readback">${api.esc(L.readingLine(ck, g.unit, P.sayWhen(api, ctx)))}</p>` : '';
};
