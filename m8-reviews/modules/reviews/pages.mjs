// Reviews' screens and places on core screens: the list, set-up, a review's page, the walk on a goal's page,
// what was said (summary and print), Home's review lead and its Next review cell, Goals' inreview= filter.
import * as RV from './rules.mjs';
import { esc, status, shape, warnMark } from '../../app/lib.mjs';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const rvOf = (W, id) => (W.reviews || []).find((r) => r.id === id && !r.removedAt) || null;
const first = (ctx, id) => (ctx.R.person.get(id)?.name || id).split(' ')[0];
const ringSvg = (done, total, label = 'reviewed') => `<svg class="ring" viewBox="0 0 72 72" role="img" aria-label="${done} of ${total} ${label}"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" stroke-width="7" stroke-dasharray="${total ? (188.5 * done) / total : 0} 188.5" transform="rotate(-90 36 36)"/><text x="36" y="36" text-anchor="middle" font-size="14" fill="currentColor">${done}/${total}</text><text x="36" y="50" text-anchor="middle" font-size="8" fill="currentColor">${label}</text></svg>`;

// Where a review stands for the viewer today: its walk, its session, the fixed order, who is in it.
export function where(ctx, r) {
  const { W, R } = ctx;
  const gl = RV.goalsIn(r, R.standing(ctx.moment).ws.goals);
  const st = RV.sessionState(W, r, gl, ctx.moment);
  const w0 = ctx.week;
  const week = st.state === 'held' && st.week === w0 ? w0 : st.state === 'in-progress' || st.state === 'outstanding' ? st.week : RV.meetsIn(r, w0) && !st.skipped ? w0 : null;
  const done = week !== null && RV.heldIn(W, r, week, gl, ctx.moment);
  // The order is fixed when the session starts: the standing at its first word.
  const firsts = (W.decisions || []).filter((d) => d.reviewId === r.id && d.week === week && !d.removedAt).map((d) => d.at).sort();
  const startAt = firsts[0] && firsts[0] < ctx.moment ? firsts[0] : ctx.moment;
  const at = R.standing(startAt <= ctx.moment ? startAt : ctx.moment);
  const now = R.standing(ctx.moment);
  // Which goals are to discuss is today's flags (as Home counts them); their order is the session's start.
  const split = RV.agenda(gl, now.st);
  const rank = RV.agenda(gl.filter((g) => at.st.has(g.id)), new Map(gl.map((g) => [g.id, at.st.get(g.id) || now.st.get(g.id)])));
  const pos = new Map([...rank.exceptions, ...rank.healthy].map((g, i) => [g.id, i]));
  const ordered = { exceptions: split.exceptions.slice().sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9)), healthy: split.healthy };
  const marked = week === null ? new Set() : RV.marked(W, r, week, ctx.moment);
  const exLeft = ordered.exceptions.filter((g) => !marked.has(g.id));
  const healthyLeft = ordered.healthy.filter((g) => !marked.has(g.id));
  const inIt = RV.canSpeakFor(W, r, ctx.viewer);
  return { r, gl, st, week, done, ordered, marked, exLeft, healthyLeft, inIt, now, reviewed: gl.filter((g) => marked.has(g.id)).length };
}
const walkHref = (r, g) => `/goals/${g.id}?review=${r.id}`;

function said(ctx, items) {
  if (!items.length) return '';
  const { R } = ctx;
  return `<ul class="said">${items.map((x) => {
    const g = R.goalById.get(x.goalId);
    const who = ctx.core.nameOf(x.by);
    const line = x.kind === 'note' ? `${esc(who)} noted: ${esc(x.text)}` : x.kind === 'removed' ? 'Note removed' : x.kind === 'risk' ? `We accept the risk: ${esc(x.text)}` : x.kind === 'question' ? `${esc(who)} asked ${esc(first(ctx, x.to))}: ${esc(x.text)}${x.status === 'open' ? ' · Open' : ' · Answered'}` : x.kind === 'action' ? `${esc(first(ctx, x.to))} agreed: ${esc(x.text)}${x.dueWeek ? ` · by week ${x.dueWeek} (${R.dayShort(R.dueDay(x.dueWeek))})` : ''}${x.status === 'done' ? ' · Done' : ''}` : esc(x.text);
    return `<li>${line}${g ? ` <span class="meta">· <a href="/goals/${g.id}">${esc(g.title)}</a></span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function lastTimeHtml(ctx, r, week, goalId = null) {
  const lt = RV.lastTime(ctx.W, r, week ?? ctx.week + 1);
  if (!lt) return '';
  const acts = lt.actions.filter((x) => !goalId || x.a.goalIds.includes(goalId));
  if (!acts.length) return goalId ? '' : `<section aria-labelledby="lt-h"><h2 id="lt-h">Last time · ${RV.dayShort(lt.day)}</h2><p class="meta">Nothing was agreed.</p></section>`;
  return `<section aria-labelledby="lt-h"><h2 id="lt-h">Last time · ${RV.dayShort(lt.day)}</h2><div class="rows">${acts.map(({ a, state }) => {
    const g = ctx.R.goalById.get(a.goalIds[0]);
    const can = state !== 'done' && (a.recipientId === ctx.viewer || a.askedBy === ctx.viewer || ctx.isAdmin);
    return `<div><p><strong>${esc(first(ctx, a.recipientId))} agreed:</strong> ${esc(a.ask)}</p><p class="meta">${a.dueWeek ? `by ${ctx.R.dayShort(ctx.R.dueDay(a.dueWeek))} · ` : ''}${g ? `<a href="/goals/${g.id}">${esc(g.title)}</a>` : ''}</p><p>${state === 'done' ? `${shape('done')} Done` : state === 'overdue' ? `${warnMark} Overdue` : '<span aria-hidden="true">□</span> Open'}${can ? ` <form method="post" action="/asks/${a.id}/done" style="display:inline"><input type="hidden" name="back" value="/reviews/${r.id}"><button class="btn link" type="submit">Done?</button></form>` : ''}</p></div>`;
  }).join('')}</div></section>`;
}

// ---------- the list ----------
function listPage(ctx) {
  const { W } = ctx;
  const all = (W.reviews || []).filter((r) => !r.removedAt);
  const row = (r) => {
    const x = where(ctx, r);
    const lh = x.st.lastHeld;
    return `<a class="review-row" href="/reviews/${r.id}"><strong>${esc(r.name)}</strong><br><span class="meta">${esc(RV.cadenceWords(r))} · ${r.people.length} people · ${x.gl.length} goals</span><br><span>${r.endedAt ? 'Ended' : esc(RV.stateWords(x.st))}</span><span class="meta">${lh !== null && lh !== undefined && x.st.state !== 'held' ? ` · Last held ${RV.dayShort(RV.sessionDay(W, r, lh))}` : ''} · ${RV.openActions(W, r)} open action${RV.openActions(W, r) === 1 ? '' : 's'}</span></a>`;
  };
  const order = (a, b) => (where(ctx, b).st.state === 'in-progress') - (where(ctx, a).st.state === 'in-progress') || a.name.localeCompare(b.name);
  const mine = all.filter((r) => r.people.includes(ctx.viewer)).sort(order), other = all.filter((r) => !r.people.includes(ctx.viewer)).sort(order);
  const body = all.length
    ? `<h1>Reviews</h1><p><a class="btn" href="/reviews/new">Set up a review</a></p>${mine.length ? `<section aria-labelledby="yi"><h2 id="yi">You’re in</h2><div class="rows reviews-list">${mine.map(row).join('')}</div></section>` : ''}${other.length ? `<section aria-labelledby="or"><h2 id="or">Other reviews</h2><div class="rows reviews-list">${other.map(row).join('')}</div></section>` : ''}`
    : `<h1>Reviews</h1><p>No reviews yet</p><p><a class="btn primary" href="/reviews/new">Set up the first review</a></p>`;
  return ctx.layout(ctx, { address: '/reviews', body, narrow: true });
}

// ---------- set-up ----------
function setupPage(ctx, r, err = {}, f = null) {
  const { R } = ctx;
  const v = (k, d) => esc(f ? f[k] ?? '' : d ?? '');
  const every = Number(f?.every ?? r?.everyWeeks ?? 1), day = Number(f?.weekday ?? r?.weekday ?? 3);
  const sc = r?.scope || { goals: [], trees: [], levels: [] };
  const levels = f ? String(f.levels || '').split(',').filter(Boolean) : sc.levels;
  const goals = f ? String(f.goals || '').split(',').filter(Boolean) : sc.goals;
  const trees = f ? String(f.trees || '').split(',').filter(Boolean) : sc.trees;
  const people = f ? String(f.people || '').split(',').filter(Boolean) : (r?.people || []);
  const chip = (kind, id, label) => `<li data-id="${esc(id)}"><span>${esc(label)}</span> <button type="button" class="btn link" data-remove aria-label="Remove ${esc(label)}">Remove</button></li>`;
  const pick = (name, kind, label, chosen, open) => `<div class="mpick" data-name="${name}" data-kind="${kind}"><input type="hidden" name="${name}" value="${esc(chosen.join(','))}"><ul class="chosen-list">${chosen.map((id) => chip(kind, id, kind === 'person' ? R.person.get(id)?.name || id : R.goalById.get(id)?.title || id)).join('')}</ul>
<button type="button" class="btn pick-open" aria-label="${esc(label)}" aria-expanded="false">${chosen.length ? open[1] : open[0]}</button>
<div class="pick-pop" hidden><input type="search" aria-label="${esc(label)}" placeholder="Type a name${kind === 'goal' ? ' or a key' : ''}" autocomplete="off"><p class="pick-count meta" role="status"></p><ul role="listbox" aria-label="${esc(label)}"></ul></div></div>`;
  const toggle = (name, val, label, on) => `<button type="button" class="btn toggle" data-group="${name}" data-value="${val}" aria-pressed="${on ? 'true' : 'false'}">${esc(label)}</button>`;
  const body = `<form method="post" action="${r ? `/reviews/${r.id}/edit` : '/reviews/new'}" id="rvform" novalidate>
<div class="closer"><button type="button" class="btn" id="closeform">Close without saving</button></div>
<h1>${r ? `Change ${esc(r.name)}` : 'New review'}</h1><p class="draftnote meta" role="status" hidden>Picked up where you left off.</p>
${err._ ? `<p class="err" role="alert">${esc(err._)}</p>` : ''}
${r ? `<input type="hidden" name="version" value="${r.version || 1}">` : ''}
<label for="rvname">Name</label><input type="text" id="rvname" name="name" value="${v('name', r?.name)}"${err.name ? ' aria-invalid="true" aria-describedby="rvname-err"' : ''}>${err.name ? `<p class="err" role="alert" id="rvname-err">${esc(err.name)}</p>` : ''}
<fieldset><legend>When</legend><input type="hidden" name="every" value="${every}"><div role="group" aria-label="How often" class="home-counts">${[1, 2, 4].map((n) => toggle('every', n, n === 1 ? 'Every week' : `Every ${n} weeks`, every === n)).join('')}</div>
<label for="rvday">On</label><select id="rvday" name="weekday">${DAYS.map((d, i) => `<option value="${i}"${day === i ? ' selected' : ''}>${d}</option>`).join('')}</select></fieldset>
<fieldset><legend>Which goals</legend><input type="hidden" name="levels" value="${esc(levels.join(','))}"><p class="meta">Every goal at a level:</p><div role="group" aria-label="Levels" class="home-counts">${[['north-star', 'North star'], ['svp', 'SVP'], ['team', 'Team']].map(([id, l]) => toggle('levels', id, l, levels.includes(id))).join('')}</div>
<p class="meta">A goal and everything feeding it:</p>${pick('trees', 'goal', 'Goals and what feeds them', trees, ['Choose a goal', 'Add another goal'])}
<p class="meta">Single goals:</p>${pick('goals', 'goal', 'Single goals', goals, ['Choose a goal', 'Add another goal'])}
<p class="goalcount meta" aria-live="polite"></p>${err.goals ? `<p class="err" role="alert">${esc(err.goals)}</p>` : ''}</fieldset>
<fieldset><legend>Who takes part</legend>${pick('people', 'person', 'People', people, ['Choose a person', 'Add another person'])}<p class="meta">You are in it too.</p></fieldset>
<p><button class="btn primary" type="submit">${r ? 'Save changes' : 'Set up the review'}</button></p>
<dialog id="closeask" aria-label="Close without saving?"><h2>Close without saving?</h2><p>What you typed here is not kept.</p><p><button type="button" class="btn" id="keep">Keep editing</button> <button type="button" class="btn" id="reallyclose">Close without saving</button></p></dialog>
</form>
<script>${SETUP_JS(r ? `edit-${r.id}` : 'new', !!f)}</script>`;
  return ctx.layout(ctx, { address: r ? `/reviews/${r.id}/edit` : '/reviews/new', body, form: true, page: r ? `Change ${r.name}` : 'New review' });
}
const SETUP_JS = (key, posted) => `(function(){
var f=document.getElementById('rvform'),K='reviewDraft:${key}',dirty=false;
function count(){var q=new URLSearchParams({levels:f.levels.value,trees:f.trees.value,goals:f.goals.value});fetch('/reviews/new/count?'+q).then(function(r){return r.json()}).then(function(j){f.querySelector('.goalcount').textContent=j.n+' goal'+(j.n===1?'':'s')+' so far';});}
function snap(){var d={};['name','every','weekday','levels','trees','goals','people'].forEach(function(k){d[k]=f[k].value});d.labels={};f.querySelectorAll('.chosen-list li').forEach(function(li){d.labels[li.dataset.id]=li.querySelector('span').textContent});return d;}
function store(){dirty=true;try{sessionStorage.setItem(K,JSON.stringify(snap()))}catch(e){}}
function chip(ul,id,label){var li=document.createElement('li');li.dataset.id=id;li.innerHTML='<span></span> <button type="button" class="btn link" data-remove>Remove</button>';li.querySelector('span').textContent=label;li.querySelector('button').setAttribute('aria-label','Remove '+label);ul.appendChild(li);}
function sync(p){var ids=[].map.call(p.querySelectorAll('.chosen-list li'),function(li){return li.dataset.id});p.querySelector('input[type=hidden]').value=ids.join(',');var b=p.querySelector('.pick-open');b.textContent=ids.length?(p.dataset.kind==='person'?'Add another person':'Add another goal'):(p.dataset.kind==='person'?'Choose a person':'Choose a goal');store();count();}
f.querySelectorAll('.toggle').forEach(function(b){b.addEventListener('click',function(){var g=b.dataset.group;if(g==='every'){f.querySelectorAll('.toggle[data-group=every]').forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');f.every.value=b.dataset.value;}else{b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true');f.levels.value=[].filter.call(f.querySelectorAll('.toggle[data-group=levels]'),function(x){return x.getAttribute('aria-pressed')==='true'}).map(function(x){return x.dataset.value}).join(',');count();}store();});});
f.querySelectorAll('.mpick').forEach(function(p){var open=p.querySelector('.pick-open'),pop=p.querySelector('.pick-pop'),inp=pop.querySelector('input'),ul=pop.querySelector('ul'),cnt=pop.querySelector('.pick-count'),sel=-1;
 function load(){var q=inp.value.trim();fetch('/api/pick?kind='+p.dataset.kind+'&q='+encodeURIComponent(q)+'&review=1').then(function(r){return r.json()}).then(function(j){ul.innerHTML=j.html;sel=-1;var n=ul.querySelectorAll('[role=option]').length;cnt.textContent=q?(n+' matches'):(n?'Suggested: you and your team':'');});}
 function close(){pop.hidden=true;open.setAttribute('aria-expanded','false');requestAnimationFrame(function(){open.focus()});}
 function choose(li){var ids=p.querySelector('input[type=hidden]').value.split(',').filter(Boolean);if(ids.indexOf(li.dataset.id)<0)chip(p.querySelector('.chosen-list'),li.dataset.id,li.dataset.label);sync(p);inp.value='';load();}
 open.addEventListener('click',function(){pop.hidden=false;open.setAttribute('aria-expanded','true');inp.focus();load();});
 inp.addEventListener('input',load);
 inp.addEventListener('keydown',function(e){var o=ul.querySelectorAll('[role=option]');if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(o.length-1,sel+1);}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);}else if(e.key==='Enter'){e.preventDefault();if(sel<0&&o.length===1)sel=0;if(o[sel])choose(o[sel]);return;}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}else return;o.forEach(function(x,i){x.setAttribute('aria-selected',i===sel?'true':'false')});});
 ul.addEventListener('click',function(e){var li=e.target.closest('[role=option]');if(li&&li.dataset.id)choose(li);});
 p.querySelector('.chosen-list').addEventListener('click',function(e){if(e.target.closest('[data-remove]')){e.target.closest('li').remove();sync(p);}});
});
f.addEventListener('input',function(e){if(e.target.name==='name'||e.target.name==='weekday')store();});
f.addEventListener('change',function(e){if(e.target.name==='weekday')store();});
var d=null;try{d=JSON.parse(sessionStorage.getItem(K)||'null')}catch(e){}
if(d&&!${posted ? 'true' : 'false'}){['name','every','weekday','levels'].forEach(function(k){f[k].value=d[k]});f.querySelectorAll('.toggle[data-group=every]').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.value===String(d.every)?'true':'false')});f.querySelectorAll('.toggle[data-group=levels]').forEach(function(x){x.setAttribute('aria-pressed',d.levels.split(',').indexOf(x.dataset.value)>=0?'true':'false')});
 ['trees','goals','people'].forEach(function(k){var p=f.querySelector('.mpick[data-name='+k+']');var ul=p.querySelector('.chosen-list');ul.innerHTML='';d[k].split(',').filter(Boolean).forEach(function(id){chip(ul,id,(d.labels||{})[id]||id)});p.querySelector('input[type=hidden]').value=d[k];});
 dirty=true;f.querySelector('.draftnote').hidden=false;}
count();
var dlg=document.getElementById('closeask');
document.getElementById('closeform').addEventListener('click',function(){if(dirty||f.name.value){dlg.showModal();}else{location.href='/reviews';}});
document.getElementById('keep').addEventListener('click',function(){dlg.close()});
document.getElementById('reallyclose').addEventListener('click',function(){try{sessionStorage.removeItem(K)}catch(e){}location.href='/reviews';});
f.addEventListener('submit',function(e){if(!f.name.value.trim()){e.preventDefault();var er=document.getElementById('rvname-err');if(!er){er=document.createElement('p');er.className='err';er.id='rvname-err';er.setAttribute('role','alert');f.name.insertAdjacentElement('afterend',er);}er.textContent='Give the review a name, like “SRE fortnightly”.';f.name.setAttribute('aria-invalid','true');f.name.focus();return;}try{sessionStorage.removeItem(K)}catch(x){}});
})();`;

function reviewFromForm(ctx, f, old) {
  const err = {};
  const name = String(f.name || '').trim();
  if (!name) err.name = 'Give the review a name, like “SRE fortnightly”.';
  const every = Number(f.every || 1), weekday = Number(f.weekday ?? 3);
  if (![1, 2, 4].includes(every) && !(every >= 1 && every <= 13)) err._ = 'Choose how often: every 1, 2 or 4 weeks.';
  if (!(weekday >= 0 && weekday <= 4)) err._ = 'Choose a weekday, Monday to Friday.';
  const list = (k) => String(f[k] || '').split(',').filter(Boolean);
  const scope = { goals: list('goals'), trees: list('trees'), levels: list('levels') };
  if (!scope.goals.length && !scope.trees.length && !scope.levels.length) err.goals = 'Choose the goals it walks: a level, a goal and what feeds it, or single goals.';
  const people = [...new Set([...list('people'), ...(old ? [] : [ctx.viewer])])];
  return { err, rec: { ...(old || { id: `rv_${ctx.core.newId('r').split('_r')[1]}_${Date.now() % 100000}`, createdBy: ctx.viewer, createdAt: ctx.nowIso() }), name, everyWeeks: every, weekday, scope, people, version: (old?.version || 0) + 1 } };
}

// ---------- a review's page ----------
function reviewPage(ctx, r, url) {
  const { W, R } = ctx;
  const x = where(ctx, r);
  const p = url.searchParams;
  const toDiscuss = x.exLeft.length;
  const inProgress = x.week !== null && x.marked.size > 0 && !x.done;
  let main = '';
  if (!r.endedAt && x.inIt && x.week !== null && !x.done) {
    if (toDiscuss) main = `<a class="btn primary" href="${walkHref(r, x.exLeft[0])}">${inProgress ? `Continue review · ${toDiscuss} left` : `Start review · ${toDiscuss} goal${toDiscuss === 1 ? '' : 's'}`}</a>`;
    else if (x.healthyLeft.length) main = `<button class="btn primary" type="button" data-dialog="finish">Finish review</button>`;
  }
  const nextDay = x.week === null ? x.st.day : x.st.nextDay;
  const when = x.week !== null ? `${RV.dayShort(RV.sessionDay(W, r, x.week))} · ${toDiscuss} to discuss · ${x.healthyLeft.length} with nothing flagged` : nextDay !== null && nextDay !== undefined ? `Next: ${RV.dayShort(nextDay)}` : 'No session left this year';
  const canChange = r.createdBy === ctx.viewer || ctx.isAdmin || x.inIt;
  const flash = p.get('finished') ? `<div class="check" role="status"><p>${esc(r.name)} is held. Everything said is kept on each goal.</p><form method="post" action="/reviews/${r.id}/undo"><input type="hidden" name="batch" value="${esc(p.get('finished'))}"><button class="btn" type="submit">Undo</button></form></div>`
    : p.get('marked') ? `<div class="check" role="status"><p>${esc(p.get('n'))} goals with nothing flagged are marked reviewed.</p><form method="post" action="/reviews/${r.id}/undo"><input type="hidden" name="batch" value="${esc(p.get('marked'))}"><button class="btn" type="submit">Undo</button></form></div>`
    : p.get('undone') ? `<div class="check" role="status"><p>Undone: those goals are back on the agenda.</p></div>` : p.get('err') ? `<p class="err" role="alert">${esc(p.get('err'))}</p>` : '';
  const head = `<div class="review-head" style="display:flex;gap:20px;align-items:center">${ringSvg(x.reviewed, x.gl.length)}<div><p class="meta">${esc(RV.cadenceWords(r))}${r.endedAt ? ' · Ended' : ''}</p><h1>${esc(r.name)}</h1><p class="sub">${when}</p><p class="bar-actions">${main}${canChange && !r.endedAt ? `<a class="btn" href="/reviews/${r.id}/edit">Edit review setup</a>` : ''}<a class="btn link" href="/reviews/${r.id}/print">Print or save as PDF</a></p></div></div>`;
  const join = x.inIt ? '' : `<p class="joinline">${esc(RV.joinLine(W, r))}</p>`;
  const heldWeek = x.done ? x.week : x.st.state === 'held' ? x.st.week : null;
  const saidSec = heldWeek !== null ? `<section aria-labelledby="ws-h" class="what-said"><h2 id="ws-h">What was said</h2><p class="meta">Held ${RV.dayShort(x.st.heldDay ?? RV.sessionDay(W, r, heldWeek))} · every goal reviewed</p>${said(ctx, RV.saidIn(W, r, heldWeek)) || '<p class="meta">Nothing was noted; every goal was reviewed.</p>'}<p><a href="/reviews">Reviews</a> · <a href="/reviews/${r.id}/summary">The whole summary</a></p></section>` : '';
  // Before this review: only in a week it is held on the due day; else the week and its due date.
  const { ws, st } = x.now;
  const w = ctx.week;
  const inSoFar = x.gl.filter((g) => (ws.ckByGoal.get(g.id) || []).some((c) => c.week === w)).length;
  const noCk = x.gl.filter((g) => st.get(g.id).flags.includes('due')).length;
  const beforeHead = r.weekday === W.cycle.reviewDay && RV.meetsIn(r, w) ? 'Before this review' : `Week ${w}, due by ${R.dayLong(R.dueDay(w))}`;
  const before = `<section aria-labelledby="bt-h"><h2 id="bt-h">${esc(beforeHead)}</h2><p>${inSoFar} of ${inSoFar + noCk} goals are checked in so far.</p>${noCk ? `<p><a href="/goals?scope=all&inreview=${r.id}&checkedin=no">${noCk} have no check-in for week ${w} yet</a></p>` : ''}</section>`;
  const row = (g) => ctx.core.goalRow(ctx, g, `?review=${r.id}`).replace('</a>', x.marked.has(g.id) ? `<span class="m meta">${shape('done')} Reviewed</span></a>` : '</a>');
  const still = x.ordered.exceptions;
  const agendaSec = `<section aria-labelledby="sr-h"><h2 id="sr-h">${x.done ? 'Discussed' : 'Still to review'} · ${x.done ? still.length : toDiscuss}</h2>${still.length ? `<div class="rows agenda">${still.map(row).join('')}</div>` : '<p class="meta">Nothing to discuss: no goal here is flagged.</p>'}</section>`;
  const healthy = x.ordered.healthy;
  const healthySec = healthy.length ? `<section aria-labelledby="nf-h"><h2 id="nf-h">Nothing flagged · ${healthy.length}</h2>${x.inIt && x.week !== null && !x.done && x.healthyLeft.length && toDiscuss ? `<form method="post" action="/reviews/${r.id}/mark-healthy"><button class="btn" type="submit">Mark ${x.healthyLeft.length} reviewed</button></form>` : ''}<details><summary>Show the ${healthy.length} goals</summary><div class="rows">${healthy.map(row).join('')}</div></details></section>` : '';
  const dec = x.week !== null ? RV.sessionDecisions(W, r, x.week) : null;
  const finishDlg = dec ? `<dialog id="finish" aria-label="Finish ${esc(r.name)}"><h2>Finish ${esc(r.name)}</h2><p>This marks the ${x.healthyLeft.length + x.exLeft.length} goals not yet reviewed and records the session as held.</p>${dec.steps.size ? `<h3>Next steps</h3><ul>${[...dec.steps].map(([who, l]) => `<li>${esc(ctx.core.nameOf(who))}: ${l.map((a) => esc(a.ask)).join('; ')}</li>`).join('')}</ul>` : '<p>No next steps were agreed.</p>'}${dec.risks.length ? `<h3>Risks accepted</h3><ul>${dec.risks.map((d) => `<li>${esc(R.goalById.get(d.goalId)?.title)}: ${esc(RV.acceptedReason(d))}</li>`).join('')}</ul>` : ''}${dec.questions.length ? `<h3>Questions still open</h3><ul>${dec.questions.map((a) => `<li>${esc(first(ctx, a.recipientId))}: ${esc(a.ask)}</li>`).join('')}</ul>` : ''}<form method="post" action="/reviews/${r.id}/finish"><p><button class="btn" type="button" data-close>Not yet</button> <button class="btn primary" type="submit">Finish the review</button></p></form></dialog>` : '';
  const foot = r.createdBy === ctx.viewer || ctx.isAdmin ? `<section aria-label="Ending it"><form method="post" action="/reviews/${r.id}/${r.endedAt ? 'reopen' : 'end'}"><button class="btn" type="submit">${r.endedAt ? 'Reopen' : 'End this review'}</button></form></section>` : '';
  const body = `${flash}${head}${join}${saidSec}${x.done ? '' : lastTimeHtml(ctx, r, x.week)}${x.done ? '' : before}${agendaSec}${healthySec}${finishDlg}${foot}
<script>document.querySelectorAll('[data-dialog]').forEach(function(b){b.addEventListener('click',function(){document.getElementById(b.dataset.dialog).showModal();});});document.querySelectorAll('[data-close]').forEach(function(b){b.addEventListener('click',function(){b.closest('dialog').close();});});</script>`;
  return ctx.layout(ctx, { address: `/reviews/${r.id}`, body, parent: ['/reviews', 'Reviews'], group: `review:${r.id}` });
}

function summaryPage(ctx, r, url, print) {
  const { W } = ctx;
  const x = where(ctx, r);
  const weeks = [...new Set([...(W.decisions || []).filter((d) => d.reviewId === r.id).map((d) => d.week), ...(W.requests || []).filter((a) => a.reviewId === r.id).map((a) => a.week)])].sort((a, b) => b - a);
  const wk = Number(url.searchParams.get('week')) || (x.done ? x.week : x.st.lastHeld ?? weeks[0]);
  const items = wk ? RV.saidIn(W, r, wk) : [];
  const body = `<h1>${esc(r.name)}${print ? ', to print' : ': summary'}</h1><p class="sub">${wk ? `Session ${RV.dayShort(RV.sessionDay(W, r, wk))} · ${esc(RV.cadenceWords(r))}` : 'Not held yet'}</p><section aria-labelledby="ws-h" class="what-said"><h2 id="ws-h">What was said</h2>${said(ctx, items) || '<p class="meta">Nothing was noted.</p>'}</section>${print ? '<p class="noprint"><button class="btn" onclick="print()">Print or save as PDF</button></p>' : `<p><a href="/reviews/${r.id}">Back to ${esc(r.name)}</a></p>`}`;
  return ctx.layout(ctx, { address: url.pathname, body, narrow: true, parent: [`/reviews/${r.id}`, r.name] });
}

// ---------- the walk, on a goal's page ----------
function goalWalk(ctx, g, url) {
  const { W, R } = ctx;
  const r = rvOf(W, url.searchParams.get('review'));
  if (!r) return null;
  const x = where(ctx, r);
  const inWalk = x.gl.some((y) => y.id === g.id);
  const ex = x.ordered.exceptions;
  const i = ex.findIndex((y) => y.id === g.id);
  const prev = i > 0 ? ex[i - 1] : null;
  const next = ex.slice(i + 1).find((y) => !x.marked.has(y.id)) || null;
  const pos = i >= 0 ? `Goal ${i + 1} of ${ex.length} to discuss` : inWalk ? 'Nothing flagged on this goal' : `Not in ${r.name}`;
  const bar = `<div class="reviewbar" role="region" aria-label="${esc(r.name)}"><div style="display:flex;gap:12px;align-items:center">${ringSvg(x.reviewed, x.gl.length)}<div><p style="margin:0"><a href="/reviews/${r.id}"><strong>${esc(r.name)}</strong></a></p><p class="meta" style="margin:0">${pos} · ${x.reviewed} of ${x.gl.length} reviewed</p></div></div><p class="home-counts">${prev ? `<a href="${walkHref(r, prev)}">Previous goal</a>` : ''}${next ? `<a href="${walkHref(r, next)}">Next goal</a>` : `<a href="/reviews/${r.id}">Back to the review</a>`}</p></div>`;
  const p = url.searchParams;
  if (!inWalk || x.week === null || r.endedAt) return { bar, decide: `<section class="decide" aria-label="What the review says"><p>${!inWalk ? esc(RV.scopeRefusal(r, g)) : r.endedAt ? 'This review has ended.' : 'No session of this review is under way.'}</p></section>`, parent: [`/reviews/${r.id}`, r.name], group: `review:${r.id}` };
  const s = x.now.st.get(g.id);
  const decision = RV.decisionFor(W, r, x.week, g, s.latest, ctx.week);
  const need = RV.needsDecision(s.status) && !decision;
  const mine = RV.saidIn(W, r, x.week).filter((y) => y.goalId === g.id);
  const reviewed = x.marked.has(g.id);
  const owner = first(ctx, g.ownerId);
  const ret = `${walkHref(r, g)}`;
  const weeks = Array.from({ length: 8 }, (_, k) => ctx.week + 1 + k).filter((w) => w <= R.WEEKS);
  const err = p.get('err');
  const open = p.get('open');
  let decide;
  if (!x.inIt) decide = `<section class="decide" aria-label="What the review says"><p class="joinline">${esc(RV.joinLine(W, r))}</p>${said(ctx, mine)}</section>`;
  else decide = `<section class="decide" aria-label="What the review says"><h2>${esc(r.name)} on this goal</h2>${said(ctx, mine)}${lastTimeHtml(ctx, r, x.week, g.id)}
${decision ? `<p class="meta">Decided: ${decision.kind === 'risk' ? `we accept the risk: ${esc(decision.reason)}` : `${esc(first(ctx, decision.ask.recipientId))} agreed: ${esc(decision.ask.ask)}${decision.ask.dueWeek ? ` · by week ${decision.ask.dueWeek}` : ''}`}</p>` : need ? `<p class="decide-q"><strong>What happens next, who, by when?</strong> ${esc(g.title)} is ${s.status === 'off' ? 'off track' : 'at risk'}: add a next step, or say why the review accepts the risk.</p>` : ''}
${err ? `<p class="err" role="alert">${esc(err)}</p>` : ''}
<p class="quiet-links home-counts"><button class="btn link" type="button" data-show="f-note">Add a note</button><button class="btn link" type="button" data-show="f-q">Ask ${esc(owner)}</button><button class="btn link" type="button" data-show="f-step">Add a next step</button>${RV.needsDecision(s.status) ? '<button class="btn link" type="button" data-show="f-risk">We accept the risk</button>' : ''}${next ? `<a class="btn link" href="${walkHref(r, next)}">Skip for now</a>` : ''}</p>
<form id="f-note" class="say" method="post" action="/reviews/${r.id}/say/${g.id}" ${open === 'f-note' ? '' : 'hidden'} novalidate><input type="hidden" name="kind" value="note"><label for="t-note">What the review said</label><textarea id="t-note" name="text" placeholder="What the review said about it"></textarea><p><button class="btn" type="submit">Save note</button></p></form>
<form id="f-q" class="say" method="post" action="/reviews/${r.id}/say/${g.id}" ${open === 'f-q' ? '' : 'hidden'} novalidate aria-label="Ask ${esc(owner)} about ${esc(g.title)}"><input type="hidden" name="kind" value="question"><p><strong>Ask ${esc(owner)} about ${esc(g.title)}</strong></p><label for="t-q">Your question</label><textarea id="t-q" name="text" placeholder="What would it take to get it back on plan?"></textarea>${err === 'Write a few words to ask.' ? '' : '<p class="err" role="alert" data-empty hidden>Write a few words to ask.</p>'}<p><button class="btn" type="submit">Save question</button></p></form>
<form id="f-step" class="say" method="post" action="/reviews/${r.id}/say/${g.id}" ${open === 'f-step' ? '' : 'hidden'} novalidate><input type="hidden" name="kind" value="step"><label for="t-step">What happens next</label><input type="text" id="t-step" name="text"><label for="t-who">Who does it</label>${ctx.pickerHtml ? '' : ''}<select id="t-who" name="who">${[...new Set([ctx.viewer, g.ownerId, ...r.people])].map((id) => `<option value="${id}">${esc(ctx.core.nameOf(id))}</option>`).join('')}</select><label for="t-week">By which week</label><select id="t-week" name="week"><option value="">Choose a week</option>${weeks.map((w) => `<option value="${w}">Week ${w} (${R.dayShort(R.dueDay(w))})</option>`).join('')}</select><p><button class="btn" type="submit">Add the next step</button></p></form>
<form id="f-risk" class="say" method="post" action="/reviews/${r.id}/say/${g.id}" ${open === 'f-risk' ? '' : 'hidden'} novalidate><input type="hidden" name="kind" value="risk"><label for="t-risk">Why the review accepts the risk</label><textarea id="t-risk" name="text"></textarea><p><button class="btn" type="submit">Accept the risk</button></p></form>
<form method="post" action="/reviews/${r.id}/mark/${g.id}"><p><button class="btn primary" type="submit">${reviewed ? (next ? 'Next goal' : 'Back to the review') : next ? 'Reviewed & next' : 'Reviewed & back to the review'}</button></p></form></section>
<script>document.querySelectorAll('.decide [data-show]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.decide form.say').forEach(function(f){f.hidden=f.id!==b.dataset.show});var f=document.getElementById(b.dataset.show);var t=f.querySelector('textarea,input[type=text]');if(t)t.focus();});});
var q=document.getElementById('f-q');if(q)q.addEventListener('submit',function(e){if(!q.text.value.trim()){e.preventDefault();var m=q.querySelector('[data-empty]');if(m)m.hidden=false;q.text.focus();}});</script>`;
  void ret;
  return { bar, decide, parent: [`/reviews/${r.id}`, r.name], group: `review:${r.id}` };
}

// Last time we talked: the last review that discussed the goal, what was noted, and when it is next due.
function goalAside(ctx, g) {
  const { W } = ctx;
  const ds = (W.decisions || []).filter((d) => d.goalId === g.id && d.reviewId && !d.removedAt && d.at <= ctx.moment).sort((a, b) => (a.at < b.at ? 1 : -1));
  const covering = (W.reviews || []).filter((r) => RV.live(r) && RV.goalsIn(r, ctx.R.standing(ctx.moment).ws.goals).some((y) => y.id === g.id));
  if (!ds.length && !covering.length) return '';
  const last = ds[0];
  const r = last ? (W.reviews || []).find((x) => x.id === last.reviewId) : null;
  const notes = last ? ds.filter((d) => d.reviewId === last.reviewId && d.week === last.week && d.kind === 'note') : [];
  const nexts = covering.map((rv) => { const w = RV.sessionWeeks(W, rv).find((x) => x >= ctx.week && RV.sessionDay(W, rv, x) >= ctx.today); return w ? [rv, RV.sessionDay(W, rv, w)] : null; }).filter(Boolean).sort((a, b) => a[1] - b[1]);
  return `<section class="last-talked" aria-labelledby="lt-talk"><h2 id="lt-talk">Last time we talked</h2>${r ? `<p class="meta"><a href="/reviews/${r.id}">${esc(r.name)}</a> · ${RV.dayShort(RV.sessionDay(W, r, last.week))}</p>${notes.map((d) => `<p>${esc(ctx.core.nameOf(d.byId))}: ${esc(d.note)}</p>`).join('') || '<p class="meta">Reviewed; nothing noted.</p>'}` : '<p class="meta">Not discussed in a review yet.</p>'}${nexts.length ? `<p class="meta">Next: ${esc(nexts[0][0].name)} · ${RV.dayShort(nexts[0][1])}</p>` : ''}</section>`;
}

// ---------- Home ----------
function homeLeadHtml(ctx, h) {
  if (h.lead !== 'review' || !h.review) return null;
  const x = where(ctx, h.review);
  const nxt = x.exLeft[0];
  const btn = x.marked.size && nxt ? `<a class="btn primary" href="${walkHref(h.review, nxt)}">Continue: ${esc(nxt.title)}</a>` : `<a class="btn primary" href="/reviews/${h.review.id}">Open the review</a>`;
  return { btn, ring: ringSvg(x.reviewed, x.gl.length) };
}
function homeGlance(ctx, h) {
  const { W } = ctx;
  const mine = (W.reviews || []).filter((r) => RV.live(r) && r.people.includes(ctx.viewer));
  const cells = mine.map((r) => {
    const x = where(ctx, r);
    if (h.review && h.review.id === r.id) return null;
    if (x.st.state === 'outstanding') return [x.st.day, `<a href="/reviews/${r.id}" class="glance-cell">Next review · ${esc(r.name)} · ${warnMark} Not held yet</a>`];
    const day = x.week !== null && !x.done ? RV.sessionDay(W, r, x.week) : x.st.nextDay ?? x.st.day;
    return day === null || day === undefined ? null : [day, `<a href="/reviews/${r.id}" class="glance-cell">Next review · ${esc(r.name)} · ${RV.dayShort(day)}</a>`];
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  return cells.length ? cells[0][1] : '';
}

// ---------- the module's GET and POST ----------
async function get(ctx, P, url) {
  const { W, R } = ctx;
  if (P[0] === 'review') {
    const todo = (W.reviews || []).filter((r) => RV.live(r) && r.people.includes(ctx.viewer)).find((r) => { const x = where(ctx, r); return x.week !== null && !x.done; });
    return { redirect: todo ? `/reviews/${todo.id}` : '/reviews' };
  }
  if (!P[1]) return { html: listPage(ctx) };
  if (P[1] === 'new' && P[2] === 'count') {
    const sc = { goals: (url.searchParams.get('goals') || '').split(',').filter(Boolean), trees: (url.searchParams.get('trees') || '').split(',').filter(Boolean), levels: (url.searchParams.get('levels') || '').split(',').filter(Boolean) };
    return { html: JSON.stringify({ n: RV.goalsIn({ scope: sc }, R.standing(ctx.moment).ws.goals).length }) };
  }
  if (P[1] === 'new') return { html: setupPage(ctx, null) };
  const r = rvOf(W, P[1]);
  if (!r) return { status: 404, html: ctx.core.notFound(ctx, url, 'Review not found', 'That review doesn’t exist') };
  if (P[2] === 'edit') return { html: setupPage(ctx, r) };
  if (P[2] === 'summary') return { html: summaryPage(ctx, r, url, false) };
  if (P[2] === 'print') return { html: summaryPage(ctx, r, url, true) };
  if (P[2]) return null;
  return { html: reviewPage(ctx, r, url) };
}

async function post(ctx, P, f, url) {
  const { W, R, core } = ctx;
  const no = (where_, msg) => ({ redirect: `${where_}${where_.includes('?') ? '&' : '?'}err=${encodeURIComponent(msg)}` });
  if (P[1] === 'new' || P[2] === 'edit') {
    const old = P[2] === 'edit' ? rvOf(W, P[1]) : null;
    if (old && Number(f.version) !== (old.version || 1)) return { status: 409, html: setupPage(ctx, old, { _: 'Someone else changed this review a moment ago. Here it is as it is now.' }) };
    const { err, rec } = reviewFromForm(ctx, f, old);
    if (Object.keys(err).length) return { status: 400, html: setupPage(ctx, old, err, f) };
    const r = core.save(ctx, { reviews: [rec], changes: [{ what: `${old ? 'changed' : 'set up'} the review ${rec.name}`, entity: 'review', kind: 'change' }] });
    if (r.error) return { status: 403, html: core.notFound(ctx, url, 'Not saved', r.error) };
    return { redirect: `/reviews/${rec.id}` };
  }
  const r = rvOf(W, P[1]);
  if (!r) return { status: 404, html: core.notFound(ctx, url, 'Review not found') };
  const back = `/reviews/${r.id}`;
  if (P[2] === 'end' || P[2] === 'reopen') {
    if (r.createdBy !== ctx.viewer && !ctx.isAdmin) return no(back, 'Only whoever set it up, or an admin, can end it.');
    const rec = P[2] === 'end' ? { ...r, endedAt: ctx.nowIso(), endedBy: ctx.viewer } : { ...r, endedAt: null, endedBy: null };
    core.save(ctx, { reviews: [rec], changes: [{ what: `${P[2] === 'end' ? 'ended' : 'reopened'} the review ${r.name}`, entity: 'review', kind: 'change' }] });
    return { redirect: back };
  }
  if (!RV.canSpeakFor(W, r, ctx.viewer)) return no(back, RV.speakRefusal(r));
  const x = where(ctx, r);
  if (x.week === null) return no(back, 'No session of this review is under way.');
  const decisionRec = (g, kind, note = '') => ({ id: core.newId('dec'), goalId: g.id, checkInId: null, reviewId: r.id, week: x.week, kind, byId: ctx.viewer, at: ctx.nowIso(), note });
  if (P[2] === 'finish' || P[2] === 'mark-healthy') {
    const left = P[2] === 'finish' ? [...x.exLeft, ...x.healthyLeft] : x.healthyLeft;
    const batch = core.newId('batch');
    const recs = left.map((g) => ({ ...decisionRec(g, 'acknowledge'), batch }));
    core.save(ctx, { decisions: recs, changes: [{ what: P[2] === 'finish' ? `finished ${r.name}: marked ${recs.length} goals reviewed` : `marked ${recs.length} goals with nothing flagged reviewed in ${r.name}`, entity: 'review', kind: 'change' }] });
    return { redirect: `${back}?${P[2] === 'finish' ? 'finished' : 'marked'}=${batch}&n=${recs.length}` };
  }
  if (P[2] === 'undo') {
    const recs = (W.decisions || []).filter((d) => d.batch === f.batch && d.reviewId === r.id && !d.removedAt).map((d) => ({ ...d, removedAt: ctx.nowIso(), removedBy: ctx.viewer }));
    core.save(ctx, { decisions: recs, changes: [{ what: `undid marking ${recs.length} goals reviewed in ${r.name}`, entity: 'review', kind: 'change' }] });
    return { redirect: `${back}?undone=1` };
  }
  const g = R.findGoal(P[3]);
  if (!g) return { status: 404, html: core.notFound(ctx, url, 'Goal not found') };
  const ret = walkHref(r, g);
  if (!x.gl.some((y) => y.id === g.id)) return no(ret, RV.scopeRefusal(r, g));
  if (P[2] === 'mark') {
    const s = x.now.st.get(g.id);
    const next = x.ordered.exceptions.slice(x.ordered.exceptions.findIndex((y) => y.id === g.id) + 1).find((y) => !x.marked.has(y.id) && y.id !== g.id);
    const go = next ? walkHref(r, next) : back;
    if (x.marked.has(g.id)) return { redirect: go };
    if (RV.needsDecision(s.status) && !RV.decisionFor(W, r, x.week, g, s.latest, ctx.week)) return no(`${ret}&open=f-step`, 'What happens next, who, by when? Add a next step or accept the risk before marking it reviewed.');
    core.save(ctx, { decisions: [decisionRec(g, 'acknowledge')], changes: [{ what: `marked ${g.title} reviewed in ${r.name}`, entity: 'review', goalId: g.id, kind: 'change' }] });
    return { redirect: go };
  }
  if (P[2] === 'say') {
    const text = String(f.text || '').trim();
    let commit;
    if (f.kind === 'note') {
      if (!text) return no(`${ret}&open=f-note`, 'Write a few words for the note.');
      commit = { decisions: [decisionRec(g, 'note', text)], changes: [{ what: `noted on ${g.title} in ${r.name}`, entity: 'note', goalId: g.id, kind: 'change' }] };
    } else if (f.kind === 'risk') {
      if (text.length < 5) return no(`${ret}&open=f-risk`, 'Say why the review accepts the risk.');
      commit = { decisions: [decisionRec(g, 'note', RV.ACCEPT + text)], changes: [{ what: `accepted the risk on ${g.title} in ${r.name}`, entity: 'note', goalId: g.id, kind: 'change' }] };
    } else if (f.kind === 'question' || f.kind === 'step') {
      if (!text) return no(`${ret}&open=${f.kind === 'question' ? 'f-q' : 'f-step'}`, f.kind === 'question' ? 'Write a few words to ask.' : 'Say what happens next.');
      if (f.kind === 'step' && !(f.who && f.week)) return no(`${ret}&open=f-step`, 'Choose who does it and the week it’s due by.');
      const ask = { id: core.newId('ask'), kind: f.kind === 'question' ? 'question' : 'action', goalIds: [g.id], askedBy: ctx.viewer, recipientId: f.kind === 'question' ? g.ownerId : f.who, ask: text, status: 'open', dueWeek: f.kind === 'step' ? Number(f.week) : null, reviewId: r.id, week: x.week, checkInId: null, createdAt: ctx.nowIso(), updatedAt: ctx.nowIso(), answer: null, answeredBy: null, answeredAt: null };
      commit = { requests: [ask], changes: [{ what: f.kind === 'question' ? `asked ${core.nameOf(g.ownerId)} a question on ${g.title} in ${r.name}` : `agreed a next step on ${g.title} in ${r.name}`, entity: 'request', goalId: g.id, kind: 'change' }] };
    } else return no(ret, 'Choose what to say.');
    const res = core.save(ctx, commit);
    if (res.error) return no(ret, res.error);
    return { redirect: ret };
  }
  return null;
}

function goalsFilter(ctx, params, list) {
  const id = params.get('inreview');
  if (!id) return null;
  const r = rvOf(ctx.W, id);
  if (!r) return null;
  const set = new Set(RV.goalsIn(r, list).map((g) => g.id));
  return { list: list.filter((g) => set.has(g.id)), words: ['inreview', 'In review', r.name] };
}

export const pages = { get, post, goalWalk, goalAside, homeLeadHtml, homeGlance, goalsFilter };
