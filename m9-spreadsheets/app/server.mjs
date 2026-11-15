// Faro's core screens, rebuilt from spec/ alone: a small server-rendered app over the stage 1-2 rules.
// node app/server.mjs [port] [workspace.json]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from '../s1.mjs';
import { makeRules, WORKSPACE_NAME, wordsOf, matches, fold } from '../stage3.mjs';
import { readBack, questionsFor, fmtVal, startLevel, weekWords } from '../readback.mjs';
import { esc, status, shape, warnMark, layout, picker, STATUS_WORD } from './lib.mjs';
import { helpArticles } from './help.mjs';
// the modules' extension points (CORE-CHANGES 1)
import { MODULES, KNOWN, isOn, routeOwner, oldAddress, place, helpOwner, moduleById, offSentence, toolOffSentence } from '../modules/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 4173);
const wsPath = path.resolve(process.argv[3] || path.join(here, '../../spec/conformance/workspace.json'));
const { S1 } = await load(wsPath);
const W = S1.W;
W.changes = W.changes || [];
// the modules switched off for this run (CORE-CHANGES 4)
const envOff = () => { if (process.env.FARO_MODULES_OFF) W.modulesOff = process.env.FARO_MODULES_OFF.split(',').filter(Boolean); };
envOff();
W.comments = W.comments || [];
const views = [];
let R = makeRules(W, S1);
const bump = () => { R = makeRules(W, S1); };
const drafts = new Map(); // viewer -> { checkins: {goalId: {...}}, newGoal: {...}, edits: {goalId: {...}} }
const draftOf = (v) => { if (!drafts.has(v)) drafts.set(v, { checkins: {}, newGoal: null, edits: {}, newGoalStep: 'what', picked: [] }); return drafts.get(v); };
const ARTICLES = helpArticles(path.join(here, '../../spec/core/help-guide.md'));
let idn = 1;
const newId = (p) => `${p}_r${idn++}`;

// ---------- helpers ----------
// what a module may use of the core (CORE-CHANGES 1): the layout, the log, names, the goals a Goals address shows
const H = {
  layout, esc, send, redirect: (res, to) => redirect(res, to), nameOf: (id) => nameOf(id), bump: () => bump(),
  log: (ctx, what, extra) => log(ctx, what, extra),
  goalIds: (ctx, url) => new Set(goalsQuery(ctx, url.searchParams).goals.map((g) => g.id)),
};
const LEVEL = { 'north-star': 'North star', svp: 'SVP', team: 'Team' };
const goalNum = (k) => Number(String(k).replace(/^\D+/, ''));
const nameOf = (id) => R.person.get(id)?.name ?? '—';
const teamName = (id) => R.team.get(id)?.name ?? '—';
const fmt = (g, v) => (v === null || v === undefined ? '—' : fmtVal(v, g.unit, g.decimals ?? 0));
function cookies(req) { const o = {}; for (const p of (req.headers.cookie || '').split(';')) { const [k, ...v] = p.trim().split('='); if (k) o[k] = decodeURIComponent(v.join('=')); } return o; }
function send(res, code, body, type = 'text/html; charset=utf-8', headers = {}) { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', ...headers }); res.end(body); }
const redirect = (res, to, headers = {}) => { res.writeHead(303, { location: to, ...headers }); res.end(); };
async function body(req) { let s = ''; for await (const c of req) s += c; return Object.fromEntries(new URLSearchParams(s)); }
function log(ctx, what, extra = {}) { W.changes.unshift({ id: newId('chg'), at: ctx.nowIso(), by: ctx.viewer, what, ...extra }); }
const weekOfMoment = (m) => S1.currentWeek(m);

function goalInfo(ctx, g) {
  const s = R.standing(ctx.moment).st.get(g.id) || { status: 'none', flags: [], latest: null };
  const w = ctx.week;
  const latest = s.latest;
  let value = '', vsPlan = '';
  if (g.kind === 'milestone') {
    const st = g.stages || [];
    const done = new Set((latest?.stages || []).filter((x) => x.done || x.state === 'done').map((x) => x.id ?? x));
    value = `${st.filter((x) => done.has(x.id)).length} of ${st.length} stages${st.some((x) => !done.has(x.id) && x.dueWeek < w) ? ' · Late' : ''}`;
  } else if (latest && latest.value !== null && latest.value !== undefined) {
    value = fmt(g, latest.value);
    if (g.kind === 'metric' && g.plan) {
      const plan = S1.planAt(S1.planAsOf(g, w), latest.week);
      const better = g.plan.target >= g.plan.start ? 1 : -1;
      const gap = (latest.value - plan) * better;
      const d = g.decimals ?? 0;
      const unitWord = g.unit === '%' ? ' pts' : g.unit ? ` ${g.unit}` : '';
      vsPlan = Math.abs(gap) < Math.pow(10, -d) / 2 ? 'On plan' : `${Math.abs(gap).toFixed(d)}${unitWord} ${gap > 0 ? 'ahead of' : 'behind'} plan`;
    }
  } else value = 'No value yet';
  return { ...s, value, vsPlan };
}
const reasonOf = (s) => (s.latest?.why || '').trim();
function flagWords(flags) {
  const W2 = { off: 'Off track', 'missed-path': 'Missed its own date', stale: 'No recent update', decision: 'Decision or help needed', 'no-path': 'No path to green', risk: 'At risk', trend: 'Getting worse', greener: 'Greener than calculated' };
  return flags.filter((f) => f !== 'due' && f !== 'off' && f !== 'risk' && f !== 'stale').map((f) => `${warnMark} ${W2[f]}`).join(' · ');
}
function goalRow(ctx, g, extra = '') {
  const s = goalInfo(ctx, g);
  return `<a class="goal-row trow ${s.status === 'off' ? 'row-off' : ''}" href="/goals/${g.id}${extra}">${status(s.status)}<span class="t">${esc(g.title)}</span><span class="meta">${esc(s.value)}${s.vsPlan ? ` · ${esc(s.vsPlan)}` : ''}</span><span class="m meta">${esc(g.key)} · ${esc(nameOf(g.ownerId))} · ${esc(teamName(g.teamId))}${flagWords(s.flags) ? ` · ${flagWords(s.flags)}` : ''}</span></a>`;
}
const needsAttention = (s) => s.flags.some((f) => f !== 'due') && !s.handled;

// ---------- Goals: the query ----------
const STATUS_ORDER = ['off', 'risk', 'stale', 'on', 'done', 'planned', 'none', 'unmeasured'];
function goalsQuery(ctx, params) {
  const { ws, st } = R.standing(ctx.moment);
  let list = ws.goals.slice();
  const scope = params.get('scope') || 'mine';
  const me = R.person.get(ctx.viewer);
  if (scope === 'mine') list = list.filter((g) => g.ownerId === ctx.viewer);
  else if (scope === 'team') list = list.filter((g) => g.teamId === me?.teamId);
  else if (scope === 'watching') {
    const w = (W.watches || []).filter((x) => x.personId === ctx.viewer && !x.removedAt);
    const set = new Set();
    for (const x of w) { if (x.kind === 'goal') set.add(x.ref); if (x.kind === 'level') ws.goals.filter((g) => g.level === x.ref).forEach((g) => set.add(g.id)); if (x.kind === 'tree') R.goalsIn({ scope: { goals: [], trees: [x.ref], levels: [] } }, ws.goals).forEach((g) => set.add(g.id)); }
    list = list.filter((g) => set.has(g.id));
  }
  const filters = [];
  const statusF = (params.get('status') || '').split(',').filter(Boolean);
  if (statusF.length) { list = list.filter((g) => statusF.includes(st.get(g.id).status)); filters.push(['status', 'Status', statusF.map((x) => STATUS_WORD[x]).join(' or ')]); }
  const teamF = params.get('team');
  if (teamF) { list = list.filter((g) => g.teamId === teamF); filters.push(['team', 'Team', teamName(teamF)]); }
  const ownerF = params.get('owner');
  if (ownerF) { const not = ownerF === '-me'; list = list.filter((g) => (not ? g.ownerId !== ctx.viewer : g.ownerId === ownerF)); filters.push(['owner', 'Owner', not ? 'not you' : nameOf(ownerF)]); }
  const levelF = params.get('level');
  if (levelF) { list = list.filter((g) => g.level === levelF); filters.push(['level', 'Level', LEVEL[levelF]]); }
  if (params.get('attention') === '1') { list = list.filter((g) => needsAttention(st.get(g.id))); filters.push(['attention', 'Needs attention', 'Yes']); }
  const ckF = params.get('checkedin');
  if (ckF === 'no') { list = list.filter((g) => st.get(g.id).flags.includes('due')); filters.push(['checkedin', 'Checked in', 'Not yet this week']); }
  const q = params.get('q') || '';
  const rows = R.goalRows(ctx.moment).filter((r) => list.some((g) => g.id === r.id));
  let found = rows, near = '';
  if (q) {
    const r = R.search('goal', q, { moment: ctx.moment });
    const ids = new Set(rows.map((x) => x.id));
    near = r.near;
    found = near ? [] : r.rows.filter((x) => ids.has(x.id));
    if (!found.length && !near) {
      // a near miss within this list
    }
  }
  const sort = params.get('sort') || 'worst';
  if (sort === 'title') found = found.slice().sort((a, b) => fold(a.g.title).localeCompare(fold(b.g.title)));
  return { goals: found.map((r) => r.g), filters, q, near, scope, total: found.length, sort };
}

// ---------- pages ----------
function homePage(ctx) {
  const v = ctx.viewer;
  const h = R.homeFor(v, ctx.moment);
  const me = R.person.get(v);
  const { ws, st } = R.standing(ctx.moment);
  const mine = ws.goals.filter((g) => g.ownerId === v);
  const dr = draftOf(v);
  const hasDraft = Object.keys(dr.checkins).length > 0;
  const due = R.dueGoalsFor(v, ctx.week, ctx.moment);
  const numberGoals = h.toDo.filter((g) => g.kind !== 'milestone');
  let hero = '';
  const ring = (done, total) => `<svg class="ring" viewBox="0 0 72 72" role="img" aria-label="${done} of ${total}"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" stroke-width="7" stroke-dasharray="${total ? (188.5 * done) / total : 0} 188.5" transform="rotate(-90 36 36)"/><text x="36" y="40" text-anchor="middle" font-size="14" fill="currentColor">${done}/${total}</text></svg>`;
  if (h.lead) {
    let btn = '', extra = '';
    if (h.lead === 'check-in' || h.lead === 'check-in-late') {
      btn = `<a class="btn primary" href="/check-in?start=1">${hasDraft ? 'Pick up where you left off' : 'Start check-in'}</a>`;
      if (numberGoals.length >= 2) extra = `<p><a href="/quick-check-in">Or type all your numbers in one table</a></p>`;
      extra = `<p class="meta">${esc(h.toDo.map((g) => g.title).join(' and '))}.${h.lead === 'check-in-late' ? ` They count for week ${ctx.week} until Sunday.` : ''}</p>` + extra;
    } else if (h.lead === 'review') btn = `<a class="btn primary" href="/reviews/${h.review.id}">Open the review</a>`;
    else if (h.lead === 'ask') {
      const a = h.waiting.find((x) => x.group <= 2)?.a;
      extra = a ? `<p>“${esc(a.ask)}”. About ${esc(R.goalById.get(a.goalIds[0])?.title)}.</p>` : '';
      btn = a ? `<a class="btn primary" href="/goals/${a.goalIds[0]}#asks">${a.kind === 'decision' ? 'Respond' : a.kind === 'question' ? 'Answer' : a.kind === 'update' ? 'Check in' : 'Mark done'}</a>` : '';
    } else if (h.lead === 'wrap-up') btn = `<a class="btn primary" href="/retro">Start the wrap-up</a>`;
    const done = due.length - h.toDo.length;
    hero = `<section class="hero" aria-label="This week">${due.length ? ring(done, due.length) : ''}<div><p class="meta">${esc(h.head || '')}</p><h2 style="margin:0 0 6px">${esc(h.title)}</h2>${extra}${btn}</div></section>`;
  } else {
    const btns = h.quiet.includes('Check-ins for week') ? ` <a class="btn" href="/check-in?start=1">Check in early</a>` : h.quiet.includes('don’t own or watch') ? ` <a class="btn" href="/goals?scope=all">See the goals</a> <a class="btn" href="/goals/new">Set up a goal</a>` : '';
    hero = `<section class="hero" aria-label="This week">${due.length ? ring(due.length - h.toDo.length, due.length) : ''}<div><p class="quiet">${esc(h.quiet)}</p>${btns}</div></section>`;
  }
  // your goals, counted once
  const counts = {};
  for (const g of mine) { const s = st.get(g.id).status; counts[s] = (counts[s] || 0) + 1; }
  const countLinks = STATUS_ORDER.filter((s) => counts[s]).map((s) => `<a href="/goals?scope=mine&status=${s}">${shape(s)} ${counts[s]} ${STATUS_WORD[s].toLowerCase()}</a>`).join('');
  const needs = mine.filter((g) => needsAttention(st.get(g.id)));
  const handled = mine.filter((g) => st.get(g.id).handled);
  const rest = mine.filter((g) => !needs.includes(g));
  const attnRow = (g) => { const s = goalInfo(ctx, g); return `<a class="goal-row trow attn ${s.status === 'off' ? 'row-off' : ''}" href="/goals/${g.id}">${status(s.status)}<span class="t">${esc(g.title)}</span><span></span><span class="m meta">${flagWords(s.flags) ? `${flagWords(s.flags)} — ` : ''}${esc(reasonOf(s).slice(0, 220)) || esc(s.value)}</span></a>`; };
  let yours = '';
  if (mine.length) {
    yours = `<section class="home-mine" aria-label="Your goals"><h2>Your goals <span class="meta">· ${mine.length}</span> <a class="meta" href="/goals?scope=mine">See them in Goals</a></h2><div class="home-counts">${countLinks}</div>
<p class="meta">${needs.length} need${needs.length === 1 ? 's' : ''} attention${handled.length ? ` · ${handled.length} being handled` : ''}</p>${needs.length ? `<div class="rows">${needs.map(attnRow).join('')}</div>` : ''}${rest.length ? `<div class="rows">${rest.map((g) => goalRow(ctx, g)).join('')}</div>` : ''}</section>`;
  }
  // your team (a team lead)
  let teamBlock = '';
  const led = W.teams.find((t) => t.leadId === v);
  if (led) {
    const tg = ws.goals.filter((g) => g.teamId === led.id);
    const tc = {}; for (const g of tg) { const s2 = st.get(g.id).status; tc[s2] = (tc[s2] || 0) + 1; }
    const theirs = tg.filter((g) => g.ownerId !== v && needsAttention(st.get(g.id)));
    teamBlock = `<section data-part="Your team" aria-label="Your team"><h2>Your team · ${esc(led.name)} <span class="meta">${tg.length}</span> <a class="meta" href="/goals?scope=team">See them in Goals</a></h2><div class="home-counts">${STATUS_ORDER.filter((x) => tc[x]).map((x) => `<a href="/goals?scope=team&status=${x}">${shape(x)} ${tc[x]} ${STATUS_WORD[x].toLowerCase()}</a>`).join('')}</div>${theirs.length ? `<p><a class="home-team-needs" href="/goals?scope=team&attention=1&owner=-me">${theirs.length} need attention that aren’t yours</a></p><div class="rows">${theirs.slice(0, 4).map((g) => { const s2 = goalInfo(ctx, g); return `<a href="/goals/${g.id}" class="trow">${esc(nameOf(g.ownerId))} · ${status(s2.status)} ${esc(g.title)}</a>`; }).join('')}</div>` : ''}</section>`;
  }
  // goals you watch
  const watched = goalsQuery(ctx, new URLSearchParams('scope=watching')).goals.filter((g) => g.ownerId !== v);
  let watching = '';
  if (watched.length) {
    const wn = watched.filter((g) => needsAttention(st.get(g.id)));
    watching = `<section aria-label="Goals you watch"><h2>Goals you watch <span class="meta">${watched.length}</span> <a class="meta" href="/goals?scope=watching">See them in Goals</a></h2><p class="meta">${wn.length} need attention · ${watched.length - wn.length} with nothing flagged.</p><div class="rows">${wn.slice(0, 4).map((g) => { const s = goalInfo(ctx, g); const late = s.flags.includes('stale') || (s.flags.includes('due') && ctx.today > R.dueDay(ctx.week)); return goalRow(ctx, g).replace('</a>', late ? `<span class="m meta">${warnMark} Check-in late</span></a>` : '</a>'); }).join('')}</div></section>`;
  }
  // needs your response
  const asks = h.waiting;
  const side = asks.length ? `<section aria-label="Needs your response"><h2>Needs your response <span class="meta">${asks.length}</span></h2><div class="rows">${asks.map((x) => { const g = R.goalById.get(x.a.goalIds[0]); return `<div><strong>${esc(g?.title)}</strong><p>“${esc(x.a.ask)}”</p><p class="meta">${esc(R.firstName(x.a.askedBy))} asked ${x.waited >= 14 ? `${Math.floor(x.waited / 7)} weeks` : `${x.waited} days`} ago.${x.late ? ` ${warnMark} Late.` : ''}</p><a class="btn" href="/goals/${g?.id}#asks">${x.a.kind === 'decision' ? 'Respond' : x.a.kind === 'question' ? 'Answer' : x.a.kind === 'update' ? 'Check in' : 'Mark done'}</a></div>`; }).join('')}</div></section>` : '';
  const hour = 12;
  const body = `<div class="page home"><h1>Good afternoon, ${esc(me?.name.split(' ')[0])}</h1><p class="sub">${esc(WORKSPACE_NAME)} · 2026 · week ${ctx.week}</p>
<div class="grid2"><div>${hero}${yours}${teamBlock}${watching}</div><aside>${side}</aside></div></div>`;
  return layout(ctx, { address: '/', body });
}

function goalsPage(ctx, url) {
  const p = url.searchParams;
  const r = goalsQuery(ctx, p);
  const thing = (n) => (n === 1 ? 'goal' : 'goals');
  const narrowed = r.q || r.filters.length;
  let countLine = '';
  if (r.total) countLine = narrowed ? `${r.total} ${thing(r.total)} ${r.total === 1 ? 'matches' : 'match'}.` : `${r.total} ${thing(r.total)}, worst first.`;
  let none = '';
  if (!r.total && r.q && r.near) none = `No goal matches “${esc(r.q)}”. Showing goals that match “${esc(r.near)}”.`;
  else if (!r.total && r.q) none = `No goal matches “${esc(r.q)}”${r.filters.length ? ' with these filters' : ''}.`;
  else if (!r.total && r.filters.length) none = 'No goals match these filters.';
  let shown = r.goals;
  if (!r.total && r.near) shown = R.search('goal', r.near, { moment: ctx.moment }).rows.map((x) => x.g);
  const keep = (drop) => { const q = new URLSearchParams(p); for (const d of [].concat(drop)) q.delete(d); const s = q.toString(); return `/goals${s ? `?${s}` : ''}`; };
  const filterLine = r.filters.length ? `<p class="filterline">Filtered by: ${r.filters.map(([k, l, v]) => `${esc(l)} ${esc(v)} <a href="${keep(k)}" role="button" aria-label="Remove the filter ${esc(l)}">Remove</a>`).join(' · ')}</p>` : '';
  const scopes = [['mine', 'Mine'], ['team', 'My team'], ['watching', 'Watching'], ['all', 'Everyone']];
  const tabs = `<nav aria-label="Whose goals" class="home-counts">${scopes.map(([k, l]) => `<a href="/goals?scope=${k}"${r.scope === k ? ' aria-current="page" style="font-weight:700"' : ''}>${l}</a>`).join('')}</nav>`;
  const statusOpts = STATUS_ORDER.map((s) => `<label style="display:inline-flex;gap:4px;font-weight:400;margin-right:10px"><input type="checkbox" name="status" value="${s}"${(p.get('status') || '').split(',').includes(s) ? ' checked' : ''}> ${STATUS_WORD[s]}</label>`).join('');
  const hidden = ['scope', 'team', 'owner', 'level', 'attention', 'checkedin', 'sort'].filter((k) => p.get(k)).map((k) => `<input type="hidden" name="${k}" value="${esc(p.get(k))}">`).join('');
  const body = `<h1>Goals</h1>${tabs}<div class="goals-toolbar">${place(ctx, H, 'goals.tools', url)}</div>
<div class="listbar" role="search"><form method="get" action="/goals" id="lb">${hidden}${p.get('status') ? `<input type="hidden" name="status" value="${esc(p.get('status'))}">` : ''}<input type="search" name="q" value="${esc(r.q)}" aria-label="Find a goal" placeholder="Find a goal"><button class="btn" type="submit">Search</button>${r.q ? `<a class="btn" role="button" href="${keep('q')}">Clear the search</a>` : ''}</form>
<details><summary>Filters</summary><form method="get" action="/goals" onsubmit="var s=[].slice.call(this.querySelectorAll('[name=status]:checked')).map(function(x){return x.value}).join(',');this.querySelectorAll('[name=status]').forEach(function(x){x.disabled=true});var h=document.createElement('input');h.type='hidden';h.name='status';h.value=s;if(s)this.appendChild(h);">${['scope', 'q'].filter((k) => p.get(k)).map((k) => `<input type="hidden" name="${k}" value="${esc(p.get(k))}">`).join('')}<fieldset><legend>Status</legend>${statusOpts}</fieldset><label>Team<select name="team"><option value="">Any team</option>${W.teams.map((t) => `<option value="${t.id}"${p.get('team') === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><label><input type="checkbox" name="attention" value="1"${p.get('attention') ? ' checked' : ''}> Needs attention</label><button class="btn" type="submit">Show these goals</button></form></details>
<p class="countline count-line" role="status">${countLine}${none}</p>${filterLine}</div>
<div class="rows">${shown.map((g) => goalRow(ctx, g)).join('') || '<p class="meta" style="padding:12px 16px">Nothing here.</p>'}</div>
<p><a href="/goals?scope=all&state=stopped">Stopped goals</a></p>
<script>(function(){var f=document.getElementById('lb');var b=f.querySelector('[name=q]');var t;b.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){var u=new URL(location.href);if(b.value)u.searchParams.set('q',b.value);else u.searchParams.delete('q');var first=!new URL(location.href).searchParams.get('q');if(first)location.assign(u);else location.replace(u);},700);});})();</script>`;
  return layout(ctx, { address: url.pathname + url.search, body, navName: r.scope === 'mine' ? 'your goals' : 'Goals' });
}

function goalPage(ctx, g, url) {
  const v = ctx.viewer;
  const s = goalInfo(ctx, g);
  const reviewId = url.searchParams.get('review');
  const review = reviewId ? R.reviewById(reviewId) : null;
  const { ws } = R.standing(ctx.moment);
  const cks = (ws.ckByGoal.get(g.id) || []).slice().sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  const isOwner = g.ownerId === v;
  const asks = (W.requests || []).filter((a) => a.goalIds.includes(g.id) && a.status !== 'withdrawn' && !a.removedAt && a.createdAt <= ctx.moment);
  const open = asks.filter((a) => a.status === 'open');
  const forYou = open.filter((a) => (a.kind !== 'action' ? a.recipientId === v : a.recipientId === v));
  const stepsOpen = open.filter((a) => a.kind === 'action');
  const behind = s.status === 'off' || s.status === 'risk';
  const checkedThisWeek = cks.some((c) => c.week === ctx.week);
  // the main button (goal-act rule)
  let main = '';
  const q = forYou.find((a) => a.kind === 'question'); const dq = forYou.find((a) => a.kind === 'decision');
  const myStep = stepsOpen.find((a) => a.recipientId === v);
  if (q) main = `<button class="btn primary" data-open="${q.id}">Answer ${esc(R.firstName(q.askedBy))}’s question</button>`;
  else if (dq) main = `<button class="btn primary" data-open="${dq.id}">Answer ${esc(R.firstName(dq.askedBy))}’s request</button>`;
  else if (isOwner && !cks.length) main = `<a class="btn primary" href="/check-in/${g.id}">Post the first check-in</a>`;
  else if (isOwner && s.flags.includes('due')) main = `<a class="btn primary" href="/check-in/${g.id}">Check in for week ${ctx.week}</a>`;
  else if (myStep) main = `<button class="btn primary" data-open="${myStep.id}">Mark your next step done</button>`;
  else if (isOwner && behind && !stepsOpen.length) main = `<button class="btn primary" data-dialog="addstep">Add a next step</button>`;
  else if (!isOwner && s.status === 'stale' && !open.some((a) => a.kind === 'update')) main = `<form method="post" action="/goals/${g.id}/ask-update" style="display:inline"><button class="btn primary">Ask ${esc(R.firstName(g.ownerId))} for an update</button></form>`;
  let beside = '';
  if (isOwner && !main.includes('/check-in/') && s.status !== 'done' && !g.stoppedAt) beside = `<a class="btn" href="/check-in/${g.id}">Check in again</a>`;
  if (!isOwner && !g.stoppedAt) { const w = (W.watches || []).some((x) => x.personId === v && x.kind === 'goal' && x.ref === g.id && !x.removedAt); beside = `<form method="post" action="/goals/${g.id}/watch" style="display:inline"><button class="btn">${w ? 'Watching' : 'Watch'}</button></form>`; }
  const more = `<details class="goal-more"><summary class="btn" aria-label="More about this goal">…</summary><div role="group" aria-label="More about this goal" class="rows">${isOwner || R.person.get(v)?.admin ? `<a href="/goals/${g.id}/edit">Change this goal</a>` : ''}<a href="/goals/${g.id}/print">Print this goal</a></div></details>`;
  if (review) beside += ` <form method="post" action="/reviews/${review.id}/mark/${g.id}" style="display:inline"><button class="btn">Mark reviewed</button></form>`;
  const parent = g.parentId ? R.goalById.get(g.parentId) : null;
  const plan = g.kind === 'metric' && g.plan ? S1.planAt(S1.planAsOf(g, ctx.week), ctx.week) : null;
  const summary = `<section class="goal-bar ${s.status === 'off' ? 'is-off' : ''}" aria-label="Summary"><div>${status(s.status)} ${flagWords(s.flags) ? `<span class="meta">· ${flagWords(s.flags)}</span>` : ''}</div>
<p class="big">${esc(s.value)} <span class="meta" style="font-size:1rem">${esc(s.vsPlan)}</span></p>
${g.kind === 'metric' && g.plan ? `<p class="meta">Planned for week ${ctx.week}: ${esc(fmt(g, Number(plan.toFixed(g.decimals ?? 0))))} · Target ${esc(fmt(g, g.plan.target))} by week ${g.plan.endWeek ?? R.WEEKS}</p>` : ''}
${g.kind === 'milestone' ? `<ul class="stagelist">${(g.stages || []).map((x) => { const d = (s.latest?.stages || []).find((y) => (y.id ?? y) === x.id); return `<li>${esc(x.name)} · due week ${x.dueWeek}${d && (d.done || d.state === 'done') ? ' · Done' : x.dueWeek < ctx.week ? ` · ${warnMark} Late` : ''}</li>`; }).join('')}</ul>` : ''}
<div class="bar-actions">${main}${beside}${more}</div></section>`;
  // next steps and asks
  const askRow = (a) => {
    const kindWord = a.kind === 'decision' ? 'Decision or help' : a.kind === 'question' ? 'Question' : a.kind === 'action' ? 'Next step' : 'Update asked';
    const settled = a.status !== 'open';
    let btn = '';
    if (!settled) {
      if (a.kind === 'decision' && a.recipientId === v) btn = 'Respond';
      else if (a.kind === 'question' && a.recipientId === v) btn = 'Answer';
      else if (a.kind === 'action' && (a.recipientId === v || R.person.get(v)?.admin)) btn = 'Mark done';
      else if (a.kind === 'update' && isOwner) btn = 'Check in';
      else if (a.askedBy === v || R.person.get(v)?.admin) btn = 'Withdraw';
    }
    const due = a.dueWeek ? ` · by week ${a.dueWeek} (${R.dayShort(R.dueDay(a.dueWeek))})` : '';
    const overdue = !settled && a.kind === 'action' && a.dueWeek && a.dueWeek < ctx.week;
    const panel = btn === 'Respond' || btn === 'Answer' ? `<form class="step-panel" method="post" action="/asks/${a.id}/answer" hidden><label>Your answer<textarea name="answer" required></textarea></label><button class="btn primary" type="submit">Send the answer</button></form>`
      : btn === 'Mark done' ? `<form class="step-panel" method="post" action="/asks/${a.id}/done" hidden><button class="btn primary" type="submit">Mark it done</button></form>`
      : '';
    return `<div class="step-row ${settled ? 'is-settled' : ''}" id="ask-${a.id}"><p><strong>${kindWord}:</strong> ${esc(a.ask)}</p><p class="meta">${a.kind === 'action' ? `${esc(nameOf(a.recipientId))}${due}${a.reviewId ? ` · agreed in ${esc(R.reviewById(a.reviewId)?.name)}` : ''}` : `Asked of ${esc(nameOf(a.recipientId))} by ${esc(nameOf(a.askedBy))}`} · ${settled ? (a.status === 'done' ? 'Done' : 'Answered') : overdue ? `${warnMark} Overdue` : 'Open'}</p>${a.answer ? `<p>${esc(R.firstName(a.answeredBy))}: ${esc(a.answer)}</p>` : ''}${btn === 'Withdraw' ? `<form method="post" action="/asks/${a.id}/withdraw"><button class="btn" type="submit">Withdraw</button></form>` : btn ? `<button class="btn" type="button" data-open="${a.id}">${btn}</button>${panel}` : ''}</div>`;
  };
  const doneRecent = asks.filter((a) => a.status !== 'open').sort((a, b) => ((a.answeredAt || a.updatedAt) < (b.answeredAt || b.updatedAt) ? 1 : -1));
  const gap = behind && !stepsOpen.length ? '<p>No next step yet. Nobody has said what happens next, who does it and by when.</p>' : '';
  const asksSec = `<section id="asks" aria-labelledby="asks-h"><h2 id="asks-h">Next steps and asks</h2>${gap}${forYou.length ? `<h3>For you</h3><div class="rows">${forYou.map(askRow).join('')}</div>` : ''}${open.filter((a) => !forYou.includes(a)).length ? `<h3>Open</h3><div class="rows">${open.filter((a) => !forYou.includes(a)).map(askRow).join('')}</div>` : ''}${doneRecent.length ? `<h3>Done lately</h3><div class="rows">${doneRecent.slice(0, 5).map(askRow).join('')}</div>` : ''}${!asks.length && !gap ? '<p class="meta">Nothing asked and no next step.</p>' : ''}</section>`;
  const openDec = open.filter((a) => a.kind === 'decision');
  const why = `<section class="why-block" aria-labelledby="why-h"><h2 id="why-h">Why</h2>${openDec.length ? `<p class="why-pointer">Waiting on a decision from ${openDec.map((a) => esc(R.firstName(a.recipientId))).join(' and ')}: see Next steps and asks</p>` : ''}${s.latest ? `<p class="meta">${esc(nameOf(s.latest.authorId))} said in week ${s.latest.week}</p><p>${esc(s.latest.why || 'Nothing said.')}</p>${s.latest.pathToGreen ? `<p><strong>Path to green:</strong> ${esc(s.latest.pathToGreen.what)}${s.latest.pathToGreen.byWeek ? ` Back on plan by week ${s.latest.pathToGreen.byWeek}.` : ''}</p>` : ''}` : '<p class="meta">No check-in yet.</p>'}</section>`;
  // chart
  let chart = '';
  if (g.kind !== 'milestone') {
    const pts = cks.filter((c) => c.value !== null && c.value !== undefined).slice().reverse();
    const vals = pts.map((c) => c.value).concat(g.plan ? [g.plan.start, g.plan.target] : g.range ? [g.range.limit] : []);
    if (vals.length) {
      const lo = Math.min(...vals), hi = Math.max(...vals) || 1, span = hi - lo || 1;
      const X = (w) => 20 + (w / R.WEEKS) * 600, Y = (v2) => 180 - ((v2 - lo) / span) * 160;
      const line = pts.map((c) => `${X(c.week).toFixed(1)},${Y(c.value).toFixed(1)}`).join(' ');
      const planLine = g.plan ? Array.from({ length: R.WEEKS + 1 }, (_, w) => `${X(w).toFixed(1)},${Y(S1.planAt(S1.planAsOf(g, ctx.week), w)).toFixed(1)}`).join(' ') : '';
      chart = `<section aria-labelledby="chart-h"><h2 id="chart-h">Against the plan</h2><svg class="chart" viewBox="0 0 640 200" role="img" aria-label="${esc(g.title)}: each week’s number against the plan"><polyline points="${planLine}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/><polyline points="${line}" fill="none" stroke="var(--ink)" stroke-width="2"/></svg>${g.rebaselinedWeek && g.originalPlan ? `<p class="meta">Target changed in week ${g.rebaselinedWeek}: ${esc(fmt(g, g.originalPlan.target))} → ${esc(fmt(g, g.plan.target))}</p>` : ''}</section>`;
    }
  }
  // history
  const comments = W.comments.filter((c) => c.goalId === g.id);
  const changes = W.changes.filter((c) => c.goalId === g.id);
  const filt = url.searchParams.get('history') || 'all';
  const hItems = [];
  if (filt === 'all' || filt === 'checkins') for (const c of cks.slice(0, 30)) hItems.push(`<div><p>${status(c.status)} <strong>Week ${c.week}</strong> · ${c.value !== null && c.value !== undefined ? esc(fmt(g, c.value)) : ''} <span class="meta">· ${esc(nameOf(c.authorId))} checked in</span></p>${c.why ? `<p>${esc(c.why)}</p>` : ''}</div>`);
  if (filt === 'all' || filt === 'comments') for (const c of comments) hItems.unshift(`<div><p class="meta">${esc(nameOf(c.by))} commented</p><p>${esc(c.text)}</p></div>`);
  if (filt === 'all' || filt === 'changes') for (const c of changes) hItems.unshift(`<div><p class="meta">${esc(nameOf(c.by))} · ${esc(c.what)}</p>${c.diffs && c.diffs[0] && c.diffs[0][0] === 'Checked' ? `<p class="diffs">${c.diffs.map((d) => `<span class="small-caps">Checked</span> ${esc(d[1])}: <ins>${esc(d[2])}</ins>`).join('<br>')}</p>` : c.diffs ? `<details><summary>Show the change</summary><p class="diffs">${c.diffs.map((d) => `${esc(d[0])}: <del>${esc(d[1])}</del> → <ins>${esc(d[2])}</ins>`).join('<br>')}</p></details>` : ''}</div>`);
  const hist = `<section id="history" aria-labelledby="hist-h"><h2 id="hist-h">History</h2><nav class="history-filters home-counts"><a href="?history=all#history">All</a><a href="?history=checkins#history">Check-ins ${cks.length}</a><a href="?history=comments#history">Comments ${comments.length}</a><a href="?history=changes#history">Changes ${changes.length}</a></nav>
<form method="post" action="/goals/${g.id}/comment"><label for="cm">Add a comment</label><textarea id="cm" name="text"></textarea><button class="btn" type="submit">Post comment</button></form><div class="rows">${hItems.join('') || '<p class="meta" style="padding:12px 16px">Nothing yet.</p>'}</div></section>`;
  const weeks = Array.from({ length: 6 }, (_, i) => ctx.week + 1 + i).filter((w) => w <= R.WEEKS);
  const addStep = `<dialog id="addstep" aria-label="Add a next step"><form method="post" action="/goals/${g.id}/step" novalidate><h2>Add a next step</h2><label for="sw">What needs doing</label><input type="text" id="sw" name="what"><p class="err" role="alert" data-for="what" hidden>Say what needs doing.</p><label for="sk">By which week</label><select id="sk" name="week"><option value="">Choose a week</option>${weeks.map((w) => `<option value="${w}">Week ${w} (${R.dayShort(R.dueDay(w))})</option>`).join('')}</select><p class="err" role="alert" data-for="week" hidden>Choose a week.</p><p><button class="btn primary" type="submit">Add the next step</button> <button class="btn" type="button" onclick="this.closest('dialog').close()">Cancel</button></p></form></dialog>`;
  const head = `<p class="meta">${esc(g.key)} · ${esc(LEVEL[g.level] || '')} · ${esc(nameOf(g.ownerId))} · ${esc(teamName(g.teamId))}${parent ? ` · feeds <a href="/goals/${parent.id}">${esc(parent.title)}</a>` : ''}</p>`;
  const published = url.searchParams.get('published') && !cks.length ? `<p class="check" role="status">${esc(g.title)} is published.${isOwner ? ' Post its first check-in now, or when it is due.' : ''}</p>` : '';
  const body = `<div class="page goal"><h1>${esc(g.title)}</h1>${head}${published}${summary}${asksSec}${why}${chart}<section><h2>What it measures</h2><p>${esc(g.definition || '')}</p><p class="meta">${esc(g.source || '')}</p></section>${hist}${addStep}</div>
<script>document.querySelectorAll('[data-open]').forEach(function(b){b.addEventListener('click',function(){var row=document.getElementById('ask-'+b.dataset.open);if(!row)return;var p=row.querySelector('.step-panel');if(p){p.hidden=false;var f=p.querySelector('textarea,button');if(f)f.focus();}row.scrollIntoView({block:'center'});});});
document.querySelectorAll('[data-dialog]').forEach(function(b){b.addEventListener('click',function(){document.getElementById(b.dataset.dialog).showModal();});});
var sf=document.querySelector('#addstep form');if(sf)sf.addEventListener('submit',function(e){var bad=false;['what','week'].forEach(function(n){var el=sf.querySelector('[name='+n+']');var m=sf.querySelector('[data-for='+n+']');m.hidden=!!el.value;if(!el.value)bad=true;});if(bad)e.preventDefault();});</script>`;
  const parentNav = review ? [`/reviews/${review.id}`, review.name] : parent ? [`/goals/${parent.id}`, parent.title] : ['/goals', 'Goals'];
  return layout(ctx, { address: url.pathname + url.search, body, navName: g.title, parent: parentNav, group: review ? `review:${review.id}` : '' });
}

// ---------- check-in ----------
function dueList(ctx, v) {
  const due = R.dueGoalsFor(v, ctx.week, ctx.moment);
  const { ws } = R.standing(ctx.moment);
  const toDo = due.filter((g) => !(ws.ckByGoal.get(g.id) || []).some((c) => c.week === ctx.week));
  return { due, toDo, done: due.filter((g) => !toDo.includes(g)) };
}
function checkInList(ctx) {
  const v = ctx.viewer;
  const { ws } = R.standing(ctx.moment);
  const mine = ws.goals.filter((g) => g.ownerId === v);
  if (!mine.length) {
    const body = `<h1>Check-in</h1><p>You don’t own a goal in ${esc(WORKSPACE_NAME)}, so there is nothing to check in on.</p><p><a class="btn" href="/goals?scope=watching">See the goals you watch</a> <a class="btn" href="/goals/new">Set up a goal</a></p>`;
    return layout(ctx, { address: '/check-in', body, narrow: true });
  }
  const { toDo, done } = dueList(ctx, v);
  const dr = draftOf(v);
  const row = (g) => { const s = goalInfo(ctx, g); return `<div class="ciq-row">${status(s.status)} <a href="/check-in/${g.id}">Check in: ${esc(g.title)}</a><p class="meta">${s.latest ? `Week ${s.latest.week}: ${esc(s.value)}${s.latest.why ? ` · “${esc(s.latest.why.slice(0, 120))}”` : ''}` : 'No check-in yet'}${dr.checkins[g.id] ? ' · Draft kept' : ''}</p></div>`; };
  const first = toDo[0];
  const body = `<h1>Check-in</h1><p class="sub">Week ${ctx.week} · ${esc(R.weekRange(ctx.week))} · due by ${esc(R.dayLong(R.dueDay(ctx.week)))}</p>
${first ? `<p><a class="btn primary" href="/check-in/${first.id}?walk=1">Start with ${esc(first.title)}</a></p>` : ''}
<section aria-labelledby="todo-h"><h2 id="todo-h">To do this week</h2>${toDo.length ? `<div class="rows">${toDo.map(row).join('')}</div>` : '<p>Nothing left to check in on this week.</p>'}</section>
${done.length ? `<section aria-labelledby="done-h"><h2 id="done-h">Checked in this week</h2><div class="rows">${done.map(row).join('')}</div></section>` : ''}
<section><h2>Check in on a goal</h2><div class="rows">${mine.filter((g) => !toDo.includes(g) && !done.includes(g)).map(row).join('') || '<p class="meta" style="padding:12px 16px">Every goal you own is above.</p>'}</div></section>
<p><a href="/quick-check-in">Or type all your numbers in one table</a></p>`;
  return layout(ctx, { address: '/check-in', body, narrow: true });
}
function verdict(ctx, g, value) {
  if (g.kind !== 'metric' || value === null || Number.isNaN(value)) return null;
  const plan = S1.planAt(S1.planAsOf(g, ctx.week), ctx.week);
  const better = g.plan.target >= g.plan.start ? 1 : -1;
  const gap = (value - plan) * better;
  const d = g.decimals ?? 0;
  const draft = { id: 'draft', goalId: g.id, authorId: ctx.viewer, week: ctx.week, postedAt: ctx.nowIso(), value, stages: null, status: null };
  const { ws } = R.standing(ctx.moment);
  const e = S1.evaluate(g, draft, (ws.ckByGoal.get(g.id) || []).concat([draft]));
  const words = Math.abs(gap) < Math.pow(10, -d) / 2 ? 'On plan' : `${fmtVal(Math.abs(gap).toFixed(d), g.unit === '%' ? '' : g.unit, d)}${g.unit === '%' ? ' pts' : ''} ${gap > 0 ? 'ahead of plan' : 'behind plan'}`;
  return { calc: e.calc, reason: e.reason, words, plan: fmt(g, Number(plan.toFixed(d))), asksTarget: e.asksTarget };
}
function checkInForm(ctx, g, url, err = {}) {
  const v = ctx.viewer;
  if (g.ownerId !== v) {
    return layout(ctx, { address: url.pathname, form: true, body: `<div class="closer"><a class="btn" href="/goals/${g.id}">Close without saving</a></div><h1>Check in: ${esc(g.title)}</h1><p role="alert">Only ${esc(nameOf(g.ownerId))}, who owns it, checks in on this goal.</p>` });
  }
  const dr = draftOf(v).checkins[g.id] || {};
  const { ws } = R.standing(ctx.moment);
  const cks = ws.ckByGoal.get(g.id) || [];
  const already = cks.some((c) => c.week === ctx.week);
  const { toDo, due } = dueList(ctx, v);
  const walk = url.searchParams.get('walk') || url.searchParams.get('start');
  const idx = due.indexOf(g);
  const val = dr.value ?? '';
  const vd = val !== '' ? verdict(ctx, g, Number(String(val).replace(',', '.'))) : null;
  const behind = vd && (vd.calc === 'off' || vd.calc === 'risk');
  const latest = cks.slice().sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
  const field = g.kind === 'milestone'
    ? `<fieldset><legend>Which stages are done?</legend>${(g.stages || []).map((x) => `<label style="font-weight:400"><input type="checkbox" name="stage" value="${x.id}"> ${esc(x.name)} · due week ${x.dueWeek}</label>`).join('')}</fieldset>`
    : `<h2>What’s the number this week?</h2><label for="val">This week’s value${g.unit ? ` <span class="opt">(${esc(g.unit)})</span>` : ''}</label><input type="text" inputmode="decimal" id="val" name="value" value="${esc(val)}" autocomplete="off">${err.value ? `<p class="err" role="alert">${esc(err.value)}</p>` : ''}
<p id="verdict" aria-live="polite" class="${behind ? 'off-plan' : ''}">${vd ? `${behind ? `${warnMark} ` : ''}${esc(vd.words)} <span class="meta">· planned for week ${ctx.week}: ${esc(vd.plan)}</span>` : ''}</p>`;
  const prog = `<p class="meta" aria-label="Progress">${idx >= 0 ? `Goal ${idx + 1} of ${due.length}` : ''} · Week ${ctx.week} · ${esc(R.weekRange(ctx.week))}</p><progress max="${Math.max(1, due.length)}" value="${Math.max(0, due.length - toDo.length)}" aria-label="Check-ins done this week"></progress>`;
  const carry = latest && (latest.why || latest.pathToGreen) ? `<div class="check"><p><strong>Is what you said in ${latest.week === ctx.week ? 'this week’s earlier check-in' : 'last week’s check-in'} still true?</strong></p><p class="meta">You said in week ${latest.week}</p><p>${esc(latest.why || '')}</p>${latest.pathToGreen ? `<p>${esc(latest.pathToGreen.what)}</p>` : ''}${(W.requests || []).some((a) => a.goalIds.includes(g.id) && a.status === 'open' && a.kind === 'decision') ? `<p>Still asking: ${esc((W.requests || []).find((a) => a.goalIds.includes(g.id) && a.status === 'open' && a.kind === 'decision').ask)}</p>` : ''}<label style="font-weight:400"><input type="checkbox" name="still" value="1"> Still true: carry it over</label></div>` : '';
  const body = `<form method="post" action="/check-in/${g.id}${walk ? '?walk=1' : ''}" novalidate>
<div class="closer"><button class="btn" name="close" value="keep" type="submit" formnovalidate>Close and keep the draft</button></div>${prog}
<h1>Check in: ${esc(g.title)}</h1>${already ? `<p class="check">You checked in for week ${ctx.week} already. This one is kept alongside it, and the latest is the week’s status.</p>` : ''}
${field}
<label for="why">Why, in a sentence <span class="opt">· ${behind ? 'needed: it is behind plan' : 'optional'}</span></label><textarea id="why" name="why">${esc(dr.why || '')}</textarea>${err.why ? `<p class="err" role="alert">${esc(err.why)}</p>` : ''}
${behind ? `<label for="path">What changes to get back on plan</label><textarea id="path" name="path">${esc(dr.path || '')}</textarea><label for="by">Back on plan by</label><select id="by" name="by"><option value="">Choose a week</option>${Array.from({ length: 8 }, (_, i) => ctx.week + 1 + i).filter((w) => w <= R.WEEKS).map((w) => `<option value="${w}">Week ${w}</option>`).join('')}</select>` : ''}
${carry}
<fieldset><legend>Your call</legend>${['on', 'risk', 'off', 'done'].map((c) => `<label style="font-weight:400;display:inline-flex;gap:6px;margin-right:12px"><input type="radio" name="call" value="${c}"${(dr.call || vd?.calc || 'on') === c ? ' checked' : ''}> ${shape(c)} ${STATUS_WORD[c]}</label>`).join('')}</fieldset>
<p><button class="btn primary" type="submit" name="post" value="1">Post check-in</button></p></form>
<script>(function(){var f=document.querySelector('form');var v=f.querySelector('[name=value]');if(!v)return;var t;v.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){fetch('/api/verdict/${g.id}?value='+encodeURIComponent(v.value)).then(function(r){return r.json()}).then(function(d){var el=document.getElementById('verdict');el.innerHTML=d.html;el.className=d.behind?'off-plan':'';});fetch('/api/draft/${g.id}',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'value='+encodeURIComponent(v.value)});},150);});})();</script>`;
  return layout(ctx, { address: url.pathname, body, form: true, page: `Check in: ${g.title}` });
}
function receiptText(ctx, v) {
  const { due, toDo } = dueList(ctx, v);
  if (!due.length || toDo.length) return '';
  const { ws } = R.standing(ctx.moment);
  const dueDay = R.dueDay(ctx.week);
  const total = due.length;
  const after = due.filter((g) => { const f = (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === ctx.week).map((c) => S1.dayNum(c.postedAt)).sort((a, b) => a - b)[0]; return f > dueDay; }).length;
  const yours = total === 1 ? 'Your check-in is' : total === 2 ? 'Both of your check-ins are' : `All ${total} of your check-ins are`;
  const held = (W.reviews || []).some((r) => r.people.includes(v) && R.meetsIn(r, ctx.week) && R.reviewDay(r, ctx.week) === dueDay);
  const day = R.dayLong(dueDay).split(' ')[0];
  const { run } = R.onTimeStreak(v, ctx.nowIso());
  if (!after) return `${yours} in ${held ? `before ${day}’s review` : `by ${day}`}.${run >= 2 ? ` That is ${run} weeks in a row.` : ''}`;
  const who = total === 1 ? 'It' : after === total ? (total === 2 ? 'Both' : 'All of them') : after === 1 ? 'One' : String(after);
  return `${yours} in. ${who} came ${held ? `after ${day}’s review` : `after ${day}`}. The next ${total === 1 ? 'is' : 'are'} due by ${R.dayLong(R.dueDay(ctx.week + 1))}.`;
}

// ---------- New goal ----------
const STEPS = ['what', 'who', 'measure', 'check'];
const STEP_TITLE = { what: 'What is the goal?', who: 'Who and where', measure: 'How it’s measured', check: 'Check and publish' };
function newGoalPage(ctx, step, url, errs = {}) {
  const v = ctx.viewer;
  const dr = draftOf(v);
  const d = dr.newGoal || (dr.newGoal = { ownerId: v, teamId: R.person.get(v)?.teamId, kind: 'metric', title: '', unit: '' });
  const picked = url.searchParams.get('picked') ? '<p class="meta" role="status">Your draft was picked up where you left it.</p>' : '';
  const kinds = [['metric', 'Move a number'], ['range', 'Keep a number in range'], ['milestone', 'Hit dated stages']];
  const err = (k) => (errs[k] ? `<p class="err" role="alert">${esc(errs[k])}</p>` : '');
  const nav = `<p class="meta" aria-label="Steps">${STEPS.map((s, i) => `${i + 1}. ${s === step ? `<strong aria-current="step">${STEP_TITLE[s]}</strong>` : STEP_TITLE[s]}`).join(' · ')}</p>`;
  let inner = '';
  if (step === 'what') {
    inner = `<label for="title">Name it the way people will say it</label><input type="text" id="title" name="title" value="${esc(d.title)}">${err('title')}<fieldset><legend>What kind of goal is it?</legend>${kinds.map(([k, l]) => `<label style="font-weight:400"><input type="radio" name="kind" value="${k}"${d.kind === k ? ' checked' : ''}> ${l}</label>`).join('')}</fieldset>`;
  } else if (step === 'who') {
    const lvl = startLevel(d, R, W, v);
    const sugg = R.goalRows(ctx.moment).filter((r) => r.g.teamId === d.teamId && r.g.level !== 'team').slice(0, 6);
    inner = `<label for="pk-ownerId">Owner</label>${picker('ownerId', 'person', d.ownerId, nameOf(d.ownerId), { aria: 'Find the owner', id: 'pk-ownerId' })}${d.ownerId && d.ownerId !== v ? `<p>${esc(R.firstName(d.ownerId))} will own it. After it is published, only ${esc(R.firstName(d.ownerId))} or an admin can change it.</p>` : ''}
<label for="pk-teamId">Team</label>${picker('teamId', 'team', d.teamId, teamName(d.teamId), { aria: 'Find the team', id: 'pk-teamId' })}
${d.teamId && d.teamId !== R.person.get(d.ownerId)?.teamId && !d.teamAnswer ? `<div class="check" role="group" aria-label="Check"><p>${warnMark} <strong>Check:</strong> ${esc(nameOf(d.ownerId).split(' ')[0])} is in ${esc(teamName(R.person.get(d.ownerId)?.teamId))}, not ${esc(teamName(d.teamId))}. Which team is this goal for?</p><button class="btn" type="submit" name="ans_team" value="keep">Keep it in ${esc(teamName(d.teamId))}</button> <button class="btn" type="submit" name="ans_team" value="move">Move it to ${esc(teamName(R.person.get(d.ownerId)?.teamId))}</button></div>` : ''}${errs._team ? `<p class="err" role="alert">${esc(errs._team)}</p>` : ''}
<fieldset role="group" aria-label="Level"><legend>Level</legend>${['north-star', 'svp', 'team'].map((l) => `<label style="font-weight:400;display:inline-flex;gap:6px;margin-right:12px"><input type="radio" name="level" value="${l}"${(d.level || lvl) === l ? ' checked' : ''}> ${LEVEL[l]}</label>`).join('')}</fieldset>
<label for="pk-parentId">Feeds into <span class="opt">· optional</span></label>${picker('parentId', 'goal', d.parentId, d.parentId ? R.goalById.get(d.parentId)?.title : '', { aria: 'Find the goal it feeds', id: 'pk-parentId' })}
${sugg.length && !d.parentId ? `<p class="meta">Suggested: ${sugg.map((r) => esc(r.g.title)).join(', ')}</p>` : ''}
<label for="pk-alsoHelps">Also helps <span class="opt">· optional</span></label>${picker('alsoHelps', 'goal', (d.alsoHelps || [])[0], d.alsoHelps?.[0] ? R.goalById.get(d.alsoHelps[0])?.title : '', { aria: 'Find a goal it also helps', id: 'pk-alsoHelps' })}
<label style="font-weight:400"><input type="checkbox" name="guardrail" value="1"${d.guardrail ? ' checked' : ''}> It’s a guardrail <span class="opt">· optional</span></label>`;
  } else if (step === 'measure') {
    const weekOpts = (sel, def) => Array.from({ length: R.WEEKS + 14 }, (_, i) => i + 1).map((w) => `<option value="${w}"${Number(sel ?? def) === w ? ' selected' : ''}>Week ${w > R.WEEKS ? `${w - R.WEEKS} of 2027` : w} · ${esc(R.weekRange(w))}${w === ctx.week ? ' · This week' : w === R.WEEKS ? ' · The end of 2026' : ''}</option>`).join('');
    inner = `<p>Everything here is needed unless it says optional.</p><label for="unit">Unit <span class="opt">· optional</span></label><input type="text" id="unit" name="unit" value="${esc(d.unit || '')}">`;
    if (d.kind === 'metric') inner += `<label for="start">Baseline</label><input type="text" id="start" name="start" value="${esc(d.start ?? '')}">${err('start')}<label for="from">From</label><select id="from" name="fromWeek">${weekOpts(d.fromWeek, ctx.week)}</select><label for="target">Target</label><input type="text" id="target" name="target" value="${esc(d.target ?? '')}">${err('target')}<label for="to">To</label><select id="to" name="endWeek">${weekOpts(d.endWeek, R.WEEKS)}</select>${err('endWeek')}
<label for="shape">How it moves</label><select id="shape" name="shape">${[['linear', 'Steady'], ['back', 'Slowly at first, faster near the end'], ['stepped', 'In a few jumps']].map(([k, l]) => `<option value="${k}"${(d.shape || 'linear') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    else if (d.kind === 'range') inner += `<label for="limit">Limit</label><input type="text" id="limit" name="limit" value="${esc(d.limit ?? '')}">${err('limit')}<label for="bound">Which side</label><select id="bound" name="bound"><option value="atMost">At or under</option><option value="atLeast"${d.bound === 'atLeast' ? ' selected' : ''}>At or over</option></select><label for="margin">Warning margin <span class="opt">· optional</span></label><input type="text" id="margin" name="margin" value="${esc(d.margin ?? '')}">`;
    else inner += `<label for="sname">Stage 1</label><input type="text" id="sname" name="sname" value="${esc(d.stages?.[0]?.name ?? '')}">${err('sname')}<label for="sdue">Stage 1: due</label><select id="sdue" name="sdue">${weekOpts(d.stages?.[0]?.dueWeek, R.WEEKS)}</select>`;
    inner += `<label for="definition">How it’s measured, in words <span class="opt">· optional</span></label><textarea id="definition" name="definition">${esc(d.definition || '')}</textarea>`;
    const qs = questionsFor(R, S1, d, ctx.moment).filter((q) => !(d.answered || []).includes(q.kind));
    if (qs.length) inner += qs.map((q) => `<div class="check" role="group" aria-label="Check"><p>${warnMark} <strong>Check:</strong> ${esc(q.text)}</p><label style="font-weight:400"><input type="radio" name="ans_${q.kind}" value="keep"> Yes, keep it</label><label style="font-weight:400"><input type="radio" name="ans_${q.kind}" value="change"> No, change it</label></div>`).join('');
    if (errs._line) inner += `<p role="alert" class="err">${esc(errs._line)}</p>`;
  } else {
    const answered = questionsFor(R, S1, d, ctx.moment).filter((q) => (d.answered || []).includes(q.kind));
    if (d.teamAnswer === 'keep') answered.unshift({ kind: 'owner-team', said: `You said it is for ${teamName(d.teamId)}, though ${nameOf(d.ownerId).split(' ')[0]} is in ${teamName(R.person.get(d.ownerId)?.teamId)}.` });
    const rb = readBack(R, W, S1, v, d, ctx.moment, { answered });
    const stepOf = { What: 'what', 'Who and where': 'who', 'Measured by': 'measure', 'Left as usual': 'measure' };
    inner = `<p>Nothing is saved until you publish.</p><dl class="readback goal-read-back">${rb.rows.map(([l, s2]) => `<div style="border-top:1px solid var(--line);padding:10px 0"><dt class="meta">${esc(l)}</dt><dd style="margin:0">${esc(s2)} ${stepOf[l] ? `<a class="btn link" role="button" href="/goals/new/${stepOf[l]}?back=check" aria-label="Change ${esc(l.toLowerCase())}">Change</a>` : ''}</dd></div>`).join('')}</dl><h2>After you publish</h2>${rb.after.map((x) => `<p>${esc(x)}</p>`).join('')}
${d.ownerId !== v ? `<fieldset><legend>Publish it as active?</legend><label style="font-weight:400"><input type="radio" name="state" value="proposed" checked> Not yet: propose it</label><label style="font-weight:400"><input type="radio" name="state" value="active"> Yes, publish it as active</label></fieldset>` : ''}`;
  }
  const primary = step === 'check' ? (d.ownerId !== v ? 'Publish goal' : 'Publish goal') : 'Continue';
  const body = `<form method="post" action="/goals/new/${step}${url.searchParams.get('back') ? `?back=${esc(url.searchParams.get('back'))}` : ''}" novalidate><div class="closer"><button class="btn" type="submit" name="close" value="keep" formnovalidate>Close and keep the draft</button></div>${nav}<h1>${STEP_TITLE[step]}</h1>${picked}${inner}<p${step === 'check' ? ' style="position:sticky;bottom:0;background:var(--bg);padding:8px 0;margin:0"' : ''}><button class="btn primary" type="submit" name="go" value="1">${primary}</button></p></form>`;
  return layout(ctx, { address: `/goals/new/${step}`, body, form: true, page: STEP_TITLE[step] });
}
function mustFixMeasure(d) {
  const e = {};
  const n = (x) => (x === '' || x === undefined || x === null ? null : Number(String(x).replace(',', '.')));
  if (d.kind === 'metric') {
    if (d.start === '' || d.start === undefined) e.start = 'Enter where it starts today.';
    else if (Number.isNaN(n(d.start))) e.start = `“${d.start}” has words in it. Type the number only, like 12.`;
    if (d.target === '' || d.target === undefined) e.target = 'Enter the target.';
    else if (Number.isNaN(n(d.target))) e.target = `“${d.target}” has words in it. Type the number only, like 30${d.unit ? `; this goal counts ${d.unit}` : ''}.`;
    else if (n(d.target) === n(d.start)) e.target = `The target is the same as today (${d.start}). To hold a number where it is, make this a number to keep in range.`;
    if (Number(d.endWeek) <= Number(d.fromWeek ?? 0)) e.endWeek = 'To isn’t after From. The plan has to run forwards.';
  } else if (d.kind === 'range') { if (d.limit === '' || d.limit === undefined || Number.isNaN(n(d.limit))) e.limit = 'Enter the limit.'; }
  else if (!d.stages?.[0]?.name) e.sname = 'Name the stage.';
  const labels = { start: 'Baseline', target: 'Target', endWeek: 'To', limit: 'Limit', sname: 'First stage' };
  const ks = Object.keys(e);
  if (ks.length) e._line = `${ks.length === 1 ? '1 thing' : `${ks.length} things`} to fix above: ${ks.length > 3 ? `${ks.slice(0, 2).map((k) => labels[k]).join(', ')} and ${ks.length - 2} more` : ks.map((k) => labels[k]).join(ks.length === 2 ? ' and ' : ', ')}.`;
  return e;
}

// ---------- simple pages ----------
function listBar(base, p, total, thing, things, extra = '', label = '') {
  const q = p.get('q') || '';
  const narrowed = q || extra;
  const count = total ? (narrowed ? `${total} ${total === 1 ? thing : things} ${total === 1 ? 'matches' : 'match'}.` : `${total} ${total === 1 ? thing : things}, A to Z.`) : '';
  const none = !total && q ? `No ${thing} matches “${esc(q)}”.` : '';
  return `<div class="listbar" role="search"><form method="get" action="${base}">${[...p.entries()].filter(([k]) => k !== 'q').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}<input type="search" autocomplete="off" name="q" value="${esc(q)}" aria-label="${esc(label || `Find a ${thing}`)}" placeholder="${esc(label || `Find a ${thing}`)}"><button class="btn" type="submit">Search</button>${q ? `<a class="btn" role="button" href="${base}">Clear the search</a>` : ''}</form><p class="countline count-line" role="status">${count}${none}</p>${extra}</div>`;
}
function peoplePage(ctx, url) {
  const p = url.searchParams;
  const q = p.get('q') || '';
  const rows = R.search('person', q).rows;
  const body = `<h1>People</h1><p><a href="/teams">Teams</a></p>${listBar('/people', p, rows.length, 'person', 'people', '', 'Find by name, job title or team')}<div class="rows">${rows.slice(0, 50).map((r) => `<a class="people-row" href="/people/${r.id}" style="text-decoration:none;color:inherit"><strong>${esc(r.p.name)}</strong><br><span class="meta">${esc(teamName(r.p.teamId))}${r.p.admin ? ' · Admin' : ''}</span></a>`).join('')}</div>`;
  return layout(ctx, { address: url.pathname + url.search, body, narrow: true });
}
function personPage(ctx, id, url) {
  const p = R.person.get(id);
  const { ws } = R.standing(ctx.moment);
  const gl = ws.goals.filter((g) => g.ownerId === id);
  const body = `<h1>${esc(p.name)}</h1><p class="sub">${p.admin ? 'Admin · ' : ''}<a href="/teams/${p.teamId}">${esc(teamName(p.teamId))}</a></p><p><a href="/goals?scope=all&owner=${id}">See ${esc(p.name.split(' ')[0])}’s ${gl.length} goals</a></p><h2>Their goals <span class="meta">${gl.length}</span></h2><div class="rows">${gl.map((g) => goalRow(ctx, g)).join('') || '<p class="meta" style="padding:12px 16px">No goals.</p>'}</div>`;
  return layout(ctx, { address: url.pathname, body, navName: p.name, parent: ['/people', 'People'] });
}
function teamsPage(ctx, url) {
  const p = url.searchParams;
  const rows = R.search('team', p.get('q') || '').rows;
  const body = `<h1>Teams</h1><p><a href="/people">People</a></p>${listBar('/teams', p, rows.length, 'team', 'teams')}<div class="rows">${rows.map((r) => `<a class="team-row" href="/teams/${r.id}" style="text-decoration:none;color:inherit"><strong>${esc(r.t.name)}</strong><br><span class="meta">${r.t.leadId ? `Led by ${esc(nameOf(r.t.leadId))}` : 'No lead'} · ${W.people.filter((x) => x.teamId === r.id).length} people</span></a>`).join('')}</div>`;
  return layout(ctx, { address: url.pathname + url.search, body, narrow: true });
}
function teamPage(ctx, id, url) {
  const t = R.team.get(id);
  const { ws, st } = R.standing(ctx.moment);
  const gl = ws.goals.filter((g) => g.teamId === id);
  const n = gl.filter((g) => needsAttention(st.get(g.id))).length;
  const body = `<h1>${esc(t.name)}</h1><p class="sub">${t.leadId ? `Led by <a href="/people/${t.leadId}">${esc(nameOf(t.leadId))}</a>` : 'No lead'} · ${W.people.filter((x) => x.teamId === id).length} people</p>${t.objective ? `<p>${esc(t.objective)}</p>` : ''}<h2>Goals <span class="meta">${gl.length}</span></h2><p><a href="/goals?scope=all&team=${id}">See its ${gl.length} goals</a> · <a href="/goals?scope=all&team=${id}&attention=1">${n} need attention</a></p><div class="rows">${gl.map((g) => goalRow(ctx, g)).join('')}</div><h2>People</h2><div class="rows">${W.people.filter((x) => x.teamId === id).map((x) => `<a href="/people/${x.id}">${esc(x.name)}</a>`).join('')}</div>`;
  return layout(ctx, { address: url.pathname, body, navName: t.name, parent: ['/teams', 'Teams'] });
}
// an import is one entry, its rows folded under it (core rule: undoing an import); its Undo is the module's place
function activityImport(ctx, c) {
  const rows = W.changes.filter((x) => x.kind === 'import-row' && x.importId === c.importId);
  return `<details><summary class="btn link">Show the ${rows.length} change${rows.length === 1 ? '' : 's'}</summary><ul>${rows.map((x) => `<li>${esc(x.what)}</li>`).join('')}</ul></details>${c.undoneAt ? `<p class="meta">Undone on ${esc(c.undoneAt.slice(0, 10))}</p>` : place(ctx, H, 'activity.import', c)}`;
}
function activityPage(ctx, url) {
  const p = url.searchParams;
  const q = p.get('q') || '';
  const kind = p.get('kind') || '';
  const { ws } = R.standing(ctx.moment);
  const folded = new Set(W.changes.filter((c) => c.kind === 'import').map((c) => c.importId));
  let items = W.changes.filter((c) => !(c.kind === 'import-row' && folded.has(c.importId) && !q)).map((c) => ({ at: c.at, by: c.by, text: c.what, kind: c.kind || 'change', goalId: c.goalId, c }));
  const recent = W.checkIns.filter((c) => !c.removedAt && c.postedAt <= ctx.moment).slice(-120).map((c) => ({ at: c.postedAt, by: c.authorId, text: `checked in on ${R.goalById.get(c.goalId)?.title} for week ${c.week}`, kind: 'checkin', goalId: c.goalId }));
  items = items.concat(recent).sort((a, b) => (a.at < b.at ? 1 : -1));
  if (kind) items = items.filter((x) => (kind === 'checkins' ? x.kind === 'checkin' : kind === 'imports' ? x.kind === 'import' : x.kind !== 'checkin'));
  if (q) items = items.filter((x) => matches(wordsOf(`${nameOf(x.by)} ${x.text}`), q));
  const extra = kind ? `<p class="filterline">Filtered by: Kind ${kind === 'checkins' ? 'Check-ins' : 'Changes'} <a class="btn" role="button" href="/activity${q ? `?q=${encodeURIComponent(q)}` : ''}" aria-label="Remove the filter Kind">Remove</a></p>` : '';
  const total = items.length;
  const bar = listBar('/activity', p, total, 'change', 'changes', extra, 'Find a change').replace(', A to Z.', ', newest first.');
  const body = `<h1>Activity</h1>${bar}<div role="group" aria-label="Kind of change" class="home-counts"><a class="btn" role="button" href="/activity?kind=checkins${q ? `&q=${encodeURIComponent(q)}` : ''}">Check-ins</a><a class="btn" role="button" href="/activity?kind=changes${q ? `&q=${encodeURIComponent(q)}` : ''}">Changes</a></div><div class="rows">${items.slice(0, 50).map((x) => `<div><p>${esc(nameOf(x.by))} ${esc(x.text)}</p><p class="meta">${esc(x.at.slice(0, 16).replace('T', ' '))}</p>${x.kind === 'import' ? activityImport(ctx, x.c) : ''}</div>`).join('')}</div>`;
  return layout(ctx, { address: url.pathname + url.search, body, narrow: true });
}
// Help's articles: a module's own are listed while it is on, by the id it gives them (CORE-CHANGES 1)
function helpList(ctx) {
  return ARTICLES.map((a) => { const m = helpOwner(a.title); return m ? { ...a, id: m.helpArticles[a.title], module: m } : a; }).filter((a) => !a.module || isOn(W, a.module.id));
}
function helpPage(ctx, url) {
  const p = url.searchParams;
  const q = p.get('q') || '';
  const list = helpList(ctx).filter((a) => !q || matches(wordsOf(`${a.title} ${a.text}`), q));
  const sections = [...new Set(list.map((a) => a.section))];
  const body = `<h1>Help</h1>${listBar('/help', p, list.length, 'article', 'articles', '', 'Find in Help')}${sections.map((sec) => `<h2>${esc(sec)}</h2><div class="rows">${list.filter((a) => a.section === sec).map((a) => `<a href="/help/${a.id}"><strong>${esc(a.title)}</strong><br><span class="meta">${esc(a.summary)}</span></a>`).join('')}</div>`).join('')}<p><a href="/whats-new">What’s new</a></p>`;
  return layout(ctx, { address: url.pathname + url.search, body, narrow: true });
}

// ---------- Workspace, Features: switching a module on or off (CORE-CHANGES 1) ----------
function featuresPage(ctx, url) {
  const me = R.person.get(ctx.viewer);
  const msg = url.searchParams.get('msg');
  const undo = url.searchParams.get('undo');
  const groupsOf = [...new Set(MODULES.map((m) => m.group || 'Tools'))];
  const rows = (m) => {
    const on = isOn(W, m.id);
    const holds = on && m.holds ? m.holds(ctx) : '';
    return me?.admin
      ? `<form method="post" action="/workspace/features" class="feature"><input type="hidden" name="feature" value="${m.id}"><input type="hidden" name="on" value="${on ? 'false' : 'true'}"><label style="font-weight:600;display:flex;gap:8px;align-items:center"><input type="checkbox" role="switch" name="tick"${on ? ' checked' : ''} onchange="this.form.submit()" aria-describedby="fd-${m.id}"> ${esc(m.name)}</label><span class="meta">${on ? 'On' : 'Off'}</span><p id="fd-${m.id}">${esc(m.about)}${holds ? ` ${esc(holds)}` : ''}</p></form>`
      : `<div><p><strong>${esc(m.name)}</strong> · ${on ? 'On' : 'Off'}</p><p class="meta">${esc(m.about)}</p></div>`;
  };
  const body = `<h1>Features</h1><p class="sub">Goals, check-ins and people are the core and always on. ${me?.admin ? 'Switch the optional parts of Faro on or off for everyone here.' : 'An admin switches these.'}</p>
${msg ? `<div role="status"><p>${esc(msg)}</p>${undo ? `<form method="post" action="/workspace/features"><input type="hidden" name="feature" value="${esc(undo.split(':')[0])}"><input type="hidden" name="on" value="${esc(undo.split(':')[1])}"><input type="hidden" name="undo" value="1"><button class="btn" type="submit">Undo</button></form>` : ''}</div>` : ''}
${groupsOf.map((g) => `<h2>${esc(g)}</h2><div class="rows">${MODULES.filter((m) => (m.group || 'Tools') === g).map(rows).join('')}</div>`).join('')}`;
  return layout(ctx, { address: '/workspace/features', body, narrow: true, page: 'Features', parent: ['/workspace', 'Workspace'] });
}
function featuresPost(ctx, res, f, hdr) {
  const me = R.person.get(ctx.viewer);
  const m = moduleById(f.feature);
  if (!me?.admin || !m) return redirect(res, '/workspace/features', hdr);
  const on = f.on === 'true';
  setFeature(ctx, m, on, f.undo ? 'Undo' : 'the app');
  const msg = f.undo ? `${m.name} is back ${on ? 'on' : 'off'}.` : `${m.name} is ${on ? 'on' : 'off'} in ${WORKSPACE_NAME}.`;
  return redirect(res, `/workspace/features?msg=${encodeURIComponent(msg)}${f.undo ? '' : `&undo=${m.id}:${on ? 'false' : 'true'}`}`, hdr);
}
function setFeature(ctx, m, on, via) {
  const off = new Set(W.modulesOff || []);
  if (on) off.delete(m.id); else off.add(m.id);
  W.modulesOff = [...off];
  log(ctx, `switched ${m.name} ${on ? 'on' : 'off'}`, { kind: 'feature', feature: m.id, on, via });
  bump();
}
// ---------- MCP (CORE-CHANGES 3): JSON-RPC over POST /mcp; the token is a person's id here (R1 is the platform's) ----------
async function mcp(ctx, req, res) {
  if (req.method !== 'POST') return send(res, 200, JSON.stringify({ name: 'faro-rebuild', tools: '/mcp tools/list' }), 'application/json');
  let raw = ''; for await (const c of req) raw += c;
  let msg; try { msg = JSON.parse(raw); } catch { return send(res, 400, JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }), 'application/json'); }
  const as = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const reply = (result) => send(res, 200, JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, result }), 'application/json');
  const person = R.person.get(as);
  if (!person) return send(res, 401, JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32001, message: 'This token isn’t one Faro knows.' } }), 'application/json');
  const tctx = { ...ctx, viewer: person.id };
  const core = [{ name: 'set_feature', description: 'Switch a feature on or off (admins).', inputSchema: { type: 'object', required: ['feature', 'on'], properties: { feature: { type: 'string', enum: KNOWN }, on: { type: 'boolean' } } },
    call: (c, a) => { if (!person.admin) throw new Error(`Only an admin can switch features. This token acts as ${person.name}, who isn’t an admin.`); const m = moduleById(a.feature); if (!m) throw new Error(`${a.feature} isn’t built in this rebuild.`); setFeature(c, m, !!a.on, 'MCP'); const offs = W.modulesOff || []; return { text: `${m.name} is ${a.on ? 'on' : 'off'} in ${WORKSPACE_NAME}.`, data: { on: MODULES.map((x) => x.id).filter((x) => !offs.includes(x)), off: offs } }; } }];
  const all = [...core.map((t) => ({ t, m: null })), ...MODULES.flatMap((m) => (m.tools || []).map((t) => ({ t, m })))];
  if (msg.method === 'tools/list') return reply({ tools: all.map(({ t }) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
  if (msg.method === 'tools/call') {
    const name = msg.params?.name;
    const found = all.find(({ t }) => t.name === name);
    if (!found) return reply({ isError: true, content: [{ type: 'text', text: `There’s no tool called ${name}.` }] });
    if (found.m && !isOn(W, found.m.id)) return reply({ isError: true, content: [{ type: 'text', text: toolOffSentence(found.m, name, WORKSPACE_NAME) }] });
    try { const r = found.t.call(tctx, msg.params?.arguments || {}); return reply({ content: [{ type: 'text', text: r.text }], ...(r.data ? { structuredContent: r.data } : {}) }); }
    catch (e) { return reply({ isError: true, content: [{ type: 'text', text: e.message }] }); }
  }
  return send(res, 200, JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32601, message: 'Method not found' } }), 'application/json');
}

// ---------- the server ----------
function ctxFor(req, url) {
  const ck = cookies(req);
  let viewer = url.searchParams.get('as') || ck.as || 'rhea';
  if (!R.person.get(viewer)) viewer = 'rhea';
  const today = url.searchParams.get('today') || ck.today || W.builtFor.slice(0, 10);
  const moment = `${today}T12:00:00.000Z`;
  const set = [];
  if (url.searchParams.get('as')) set.push(`as=${viewer}; Path=/`);
  if (url.searchParams.get('today')) set.push(`today=${today}; Path=/`);
  const clock = new Date().toISOString().slice(11);
  return { viewer, today: S1.dayNum(moment), todayIso: today, moment, week: weekOfMoment(moment), R, W, S1, wsId: 'demo', wsPath, wsName: WORKSPACE_NAME, views, set, nowIso: () => `${today}T${clock}`, on: (id) => isOn(W, id) };
}
function notFound(ctx, url, what = 'Page not found') {
  const body = `<div class="not-found"><h1>${esc(what)}</h1><p>There is nothing at this address. Find what you were looking for:</p>${picker('find', 'any', '', '', { aria: 'Find a goal, a person or a team' }).replace('type="search"', 'type="search" class="find-input"')}<p><a class="btn" href="/">Go to Home</a></p></div>`;
  return layout(ctx, { address: url.pathname, body, page: what });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const ctx = ctxFor(req, url);
    ctx.R = R;
    const hdr = ctx.set.length ? { 'set-cookie': ctx.set } : {};
    const ok = (html) => send(res, 200, html, 'text/html; charset=utf-8', hdr);
    const P = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const v = ctx.viewer;
    // the modules (CORE-CHANGES 1): an old address, then a module's own routes; off, they find nothing
    const h = { ...H, ok };
    const old = oldAddress(url.pathname);
    if (old) return isOn(W, old.m.id) ? redirect(res, old.to + url.search, hdr) : send(res, 404, notFound(ctx, url), 'text/html; charset=utf-8', hdr);
    const owner = routeOwner(P);
    if (owner) {
      if (!isOn(W, owner.id)) return send(res, 404, notFound(ctx, url), 'text/html; charset=utf-8', hdr);
      const done = req.method === 'GET' ? await owner.get(ctx, h, url, P, res) : await owner.post(ctx, h, url, P, res, await body(req));
      if (done === false) return send(res, 404, notFound(ctx, url), 'text/html; charset=utf-8', hdr);
      return;
    }
    if (P[0] === 'mcp') return mcp(ctx, req, res);
    if (P[0] === 'workspace' && P[1] === 'features') return req.method === 'GET' ? ok(featuresPage(ctx, url)) : featuresPost(ctx, res, await body(req), hdr);
    if (req.method === 'GET') {
      if (P[0] === 'api' && P[1] === 'find') {
        const q = url.searchParams.get('q') || '';
        if (!q.trim()) return send(res, 200, JSON.stringify({ html: '<p class="meta">Type a name, a few words or a goal’s key.</p>' }), 'application/json');
        const groups = [['goal', 'Goals', 'goals'], ['person', 'People', 'people'], ['team', 'Teams', 'teams']].map(([k, l, things]) => {
          const r = R.search(k, q, { moment: ctx.moment });
          return { k, l, things, rows: r.rows, total: r.total || r.rows.length, near: r.near };
        }).filter((g) => g.rows.length);
        const href = (k, r) => (k === 'goal' ? `/goals/${r.id}` : k === 'person' ? `/people/${r.id}` : `/teams/${r.id}`);
        const label = (k, r) => (k === 'goal' ? `${shape(r.status)} ${esc(STATUS_WORD[r.status])} · ${esc(r.g.title)}<br><span class="meta">${esc(r.g.key)} · ${esc(nameOf(r.g.ownerId))} · ${esc(teamName(r.g.teamId))}</span>` : k === 'person' ? `${esc(r.p.name)}<br><span class="meta">${esc(teamName(r.p.teamId))}</span>` : `${esc(r.t.name)}<br><span class="meta">${r.t.leadId ? `Led by ${esc(nameOf(r.t.leadId))}` : 'No lead'}</span>`);
        const seeAll = (g) => (g.k === 'goal' ? `/goals?scope=all&q=${encodeURIComponent(q)}` : g.k === 'person' ? `/people?q=${encodeURIComponent(q)}` : `/teams?q=${encodeURIComponent(q)}`);
        const html = groups.length ? groups.map((g) => `<h3>${g.l} · ${g.total}</h3>${g.rows.slice(0, 3).map((r) => `<a data-row href="${href(g.k, r)}">${label(g.k, r)}</a>`).join('')}${g.total > 3 ? `<a href="${seeAll(g)}">See all ${g.total} ${g.things}</a>` : ''}`).join('') : `<p>Nothing matches “${esc(q)}”.</p>`;
        return send(res, 200, JSON.stringify({ html }), 'application/json');
      }
      if (P[0] === 'api' && P[1] === 'pick') {
        const kind = url.searchParams.get('kind'), q = url.searchParams.get('q') || '';
        let rows;
        if (kind === 'any') {
          const html = !q ? '' : ['goal', 'person', 'team'].flatMap((k) => R.search(k, q, { moment: ctx.moment }).rows.slice(0, 5).map((x) => k === 'goal' ? `<li role="option" data-href="/goals/${x.id}">${esc(x.g.title)}</li>` : k === 'person' ? `<li role="option" data-href="/people/${x.id}">${esc(x.p.name)}</li>` : `<li role="option" data-href="/teams/${x.id}">${esc(x.t.name)}</li>`)).join('');
          return send(res, 200, JSON.stringify({ html: html || (q ? '<li aria-disabled="true">Nothing matches.</li>' : ''), count: '' }), 'application/json');
        }
        if (!q) {
          if (kind === 'person') { const me = R.person.get(v); const t = R.team.get(me.teamId); rows = [me, ...(t?.leadId && t.leadId !== v ? [R.person.get(t.leadId)] : []), ...W.people.filter((x) => x.teamId === me.teamId && x.id !== v && x.id !== t?.leadId).sort((a, b) => a.name.localeCompare(b.name))].slice(0, 6).map((p) => ({ id: p.id, label: p.name, line: teamName(p.teamId) })); }
          else if (kind === 'team') { const me = R.person.get(v); rows = [R.team.get(me.teamId), ...W.teams.filter((t) => t.leadId === v && t.id !== me.teamId)].filter(Boolean).slice(0, 6).map((t) => ({ id: t.id, label: t.name, line: t.leadId ? `Led by ${nameOf(t.leadId)}` : 'No lead' })); }
          else rows = R.goalRows(ctx.moment).filter((r) => r.g.ownerId === v).slice(0, 6).map((r) => ({ id: r.id, label: r.g.title, line: `${r.g.key} · ${nameOf(r.g.ownerId)} · ${teamName(r.g.teamId)}` }));
        } else {
          const r = R.search(kind, q, { moment: ctx.moment });
          rows = r.rows.slice(0, 50).map((x) => kind === 'goal' ? { id: x.id, label: x.g.title, line: `${x.g.key} · ${nameOf(x.g.ownerId)} · ${teamName(x.g.teamId)}` } : kind === 'person' ? { id: x.id, label: x.p.name, line: teamName(x.p.teamId) } : { id: x.id, label: x.t.name, line: x.t.leadId ? `Led by ${nameOf(x.t.leadId)}` : 'No lead' });
          var total = r.total || r.rows.length;
        }
        const html = rows.map((x) => `<li role="option" data-id="${esc(x.id)}" data-label="${esc(x.label)}">${esc(x.label)}<br><span class="meta">${esc(x.line)}</span></li>`).join('') || '<li aria-disabled="true">Nothing matches.</li>';
        return send(res, 200, JSON.stringify({ html, count: q ? `${total} found${total > 50 ? ', showing 50' : ''}` : '' }), 'application/json');
      }
      if (P[0] === 'api' && P[1] === 'verdict') {
        const g = R.findGoal(P[2]);
        const vd = verdict(ctx, g, Number(String(url.searchParams.get('value') || '').replace(',', '.')));
        const behind = vd && (vd.calc === 'off' || vd.calc === 'risk');
        return send(res, 200, JSON.stringify({ behind, html: vd && url.searchParams.get('value') ? `${behind ? `${warnMark} ` : ''}${esc(vd.words)} <span class="meta">· planned for week ${ctx.week}: ${esc(vd.plan)}</span>` : '' }), 'application/json');
      }
      if (!P.length) return ok(homePage(ctx));
      if (P[0] === 'demo') {
        const body = `<h1>Demo</h1><p>Switch person: look at Faro as someone else.</p><form method="get" action="/"><label for="as">Who</label>${picker('as', 'person', '', '', { aria: 'Find a person' })}<p><button class="btn primary" type="submit">Switch</button></p></form><p><a href="/?as=rhea">Rhea, goal owner</a> · <a href="/?as=amara">Amara, leader and admin</a> · <a href="/?as=tunde">Tunde, goal owner</a> · <a href="/?as=oskar">Oskar, watches</a></p>`;
        return ok(layout(ctx, { address: '/demo', body, page: 'Demo' }));
      }
      if (P[0] === 'more') {
        const opt = { owns: R.ownsToCheckIn(v, ctx.moment) };
        const tabs = R.phoneTabs(v, opt);
        const groups = R.menuGroups(v, opt).map((g) => g.filter((x) => !tabs.includes(x)));
        const href = { home: '/', checkin: '/check-in', goals: '/goals', reviews: '/reviews', people: '/people', activity: '/activity', data: '/data', new: '/goals/new', workspace: '/workspace', settings: '/settings', help: '/help', feedback: '/feedback' };
        const lab = { people: 'People', activity: 'Activity', data: 'Data', new: 'New goal', workspace: 'Workspace', settings: 'Settings', help: 'Help', feedback: 'Feedback', reviews: 'Reviews', checkin: 'Check-in', goals: 'Goals', home: 'Home' };
        return ok(layout(ctx, { address: '/more', page: 'More', body: `<h1>More</h1>${groups.filter((g) => g.length).map((g) => `<div class="rows">${g.map((x) => `<a href="${href[x]}">${lab[x]}</a>`).join('')}</div>`).join('')}` }));
      }
      if (P[0] === 'goals' && !P[1]) return ok(goalsPage(ctx, url));
      if (P[0] === 'watching') return ok(goalsPage(ctx, new URL('/goals?scope=watching', 'http://x')));
      if (P[0] === 'goals' && P[1] === 'new') {
        const dr = draftOf(v);
        if (!P[2]) return redirect(res, `/goals/new/${dr.newGoal ? dr.newGoalStep : 'what'}${dr.newGoal ? '?picked=1' : ''}`, hdr);
        if (!STEPS.includes(P[2])) return send(res, 404, notFound(ctx, url));
        return ok(newGoalPage(ctx, P[2], url));
      }
      if (P[0] === 'goals') {
        const g = R.findGoal(P[1]);
        if (!g) return send(res, 404, notFound(ctx, url, 'Goal not found'));
        if (P[2] === 'edit') return ok(editPage(ctx, g, url));
        if (P[2] === 'print') return ok(layout(ctx, { address: url.pathname, body: `<h1>${esc(g.title)}</h1>${goalRow(ctx, g)}`, parent: [`/goals/${g.id}`, g.title] }));
        if (P[2]) return send(res, 404, notFound(ctx, url));
        return ok(goalPage(ctx, g, url));
      }
      if (P[0] === 'check-in') {
        if (!P[1]) {
          if (url.searchParams.get('start')) {
            const { toDo } = dueList(ctx, v);
            const dr = draftOf(v);
            const first = toDo.find((g) => dr.checkins[g.id]) || toDo[0];
            if (first) return ok(checkInForm(ctx, first, new URL(`/check-in/${first.id}?start=1`, 'http://x')));
          }
          return ok(checkInList(ctx));
        }
        if (P[1] === 'done') {
          const g = R.findGoal(url.searchParams.get('g'));
          const receipt = receiptText(ctx, v);
          const { toDo } = dueList(ctx, v);
          const next = toDo[0];
          const body = `<h1>Check-in saved</h1><p>${esc(g?.title)}: ${url.searchParams.get('alongside') ? 'Kept alongside your earlier check-in this week. ' : ''}your check-in for week ${ctx.week} is saved.</p>${receipt ? `<p class="receipt">${esc(receipt)}</p>` : ''}
<p>${next ? `<a class="btn primary" href="/check-in/${next.id}?walk=1">Next: ${esc(next.title)}</a> ` : ''}<a class="btn" href="/">Back to home</a> <a class="btn" href="/goals/${g?.id}">View the goal</a></p>`;
          return ok(layout(ctx, { address: '/check-in/done', body, form: true, page: 'Check-in saved' }));
        }
        const g = R.findGoal(P[1]);
        if (!g) return send(res, 404, notFound(ctx, url, 'Goal not found'));
        return ok(checkInForm(ctx, g, url));
      }
      if (P[0] === 'quick-check-in') {
        const { toDo } = dueList(ctx, v);
        const nums = toDo.filter((g) => g.kind !== 'milestone');
        const body = `<form method="post" action="/quick-check-in"><div class="closer"><a class="btn" href="/check-in">Close and keep the draft</a></div><h1>Check-in, all in one table</h1><table><thead><tr><th>Goal</th><th>Planned for week ${ctx.week}</th><th>This week’s value</th></tr></thead><tbody>${nums.map((g) => `<tr><td>${esc(g.title)}</td><td>${g.plan ? esc(fmt(g, Number(S1.planAt(g.plan, ctx.week).toFixed(g.decimals ?? 0)))) : ''}</td><td><input type="text" name="v_${g.id}" aria-label="${esc(g.title)}: this week’s value" value="${esc(draftOf(v).checkins[g.id]?.value ?? '')}"></td></tr>`).join('')}</tbody></table><p class="meta">${nums.length} to do.</p><p><button class="btn primary" type="submit">Post the check-ins</button></p></form>`;
        return ok(layout(ctx, { address: '/quick-check-in', body, form: true }));
      }
      if (P[0] === 'people' && !P[1]) return ok(peoplePage(ctx, url));
      if (P[0] === 'people') { if (!R.person.get(P[1])) return send(res, 404, notFound(ctx, url, 'Person not found')); return ok(personPage(ctx, P[1], url)); }
      if (P[0] === 'teams' && !P[1]) return ok(teamsPage(ctx, url));
      if (P[0] === 'teams') { if (!R.team.get(P[1])) return send(res, 404, notFound(ctx, url, 'Team not found')); return ok(teamPage(ctx, P[1], url)); }
      if (P[0] === 'reviews' && !P[1]) {
        const body = `<h1>Reviews</h1><div class="rows">${W.reviews.map((r) => `<a href="/reviews/${r.id}"><strong>${esc(r.name)}</strong><br><span class="meta">Every ${r.everyWeeks === 1 ? 'week' : `${r.everyWeeks} weeks`} on ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][r.weekday]} · ${r.people.length} people</span></a>`).join('')}</div>`;
        return ok(layout(ctx, { address: '/reviews', body, narrow: true }));
      }
      if (P[0] === 'reviews' && P[1] === 'new') return ok(layout(ctx, { address: '/reviews/new', form: true, body: `<div class="closer"><a class="btn" href="/reviews">Close without saving</a></div><h1>New review</h1><p>Setting up a review isn’t built in this rebuild.</p>` }));
      if (P[0] === 'reviews') {
        const r = R.reviewById(P[1]);
        if (!r) return send(res, 404, notFound(ctx, url, 'Review not found'));
        const { ws, st } = R.standing(ctx.moment);
        const gl = R.goalsIn(r, ws.goals);
        const marked = new Set(W.decisions.filter((d) => d.reviewId === r.id && d.week === ctx.week).map((d) => d.goalId));
        const due = gl.filter((g) => st.get(g.id).flags.includes('due') || (ws.ckByGoal.get(g.id) || []).some((c) => c.week === ctx.week));
        const inSoFar = gl.filter((g) => (ws.ckByGoal.get(g.id) || []).some((c) => c.week === ctx.week)).length;
        const noCk = gl.filter((g) => st.get(g.id).flags.includes('due')).length;
        const body = `<h1>${esc(r.name)}</h1><p class="sub">${gl.length} goals · ${r.people.length} people</p><section aria-label="Before this review"><h2>Before this review</h2><p>${inSoFar} of ${due.length} goals are checked in so far.</p>${noCk ? `<p><a href="/goals?scope=all&inreview=${r.id}&checkedin=no">${noCk} have no check-in for week ${ctx.week} yet</a></p>` : ''}</section><h2>The agenda</h2><div class="rows">${gl.map((g) => goalRow(ctx, g, `?review=${r.id}`).replace('</a>', marked.has(g.id) ? '<span class="m meta">Reviewed</span></a>' : '</a>')).join('')}</div>`;
        return ok(layout(ctx, { address: url.pathname, body, parent: ['/reviews', 'Reviews'] }));
      }
      if (P[0] === 'activity') return ok(activityPage(ctx, url));
      if (P[0] === 'data') {
        const p = url.searchParams; const q = p.get('q') || '';
        const rows = R.search('person', q).rows;
        const body = `<h1>Data</h1><p class="home-counts"><a href="/data" aria-current="page">People</a><a href="/goals?scope=all">Goals</a></p><div class="data-tools" style="display:flex;gap:8px;flex-wrap:wrap;position:relative;min-height:44px">${place(ctx, H, 'data.tools', url, { name: 'people', rows: rows.length, cols: ['Name', 'Team', 'Admin'], keys: ['Email', 'ID'] })}</div>${listBar('/data', p, rows.length, 'person', 'people')}<table><thead><tr><th>Name</th><th>Team</th><th>Admin</th></tr></thead><tbody>${rows.slice(0, 50).map((r) => `<tr><td>${esc(r.p.name)}</td><td>${esc(teamName(r.p.teamId))}</td><td>${r.p.admin ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table>`;
        return ok(layout(ctx, { address: url.pathname + url.search, body }));
      }
      if (P[0] === 'workspace') {
        if (P[1] === 'new') return ok(layout(ctx, { address: '/workspace/new', form: true, body: `<div class="closer"><a class="btn" href="/">Close without saving</a></div><h1>Set up a workspace</h1><p>Set-up isn’t built in this rebuild.</p>` }));
        const admins = W.people.filter((p) => p.admin);
        const body = `<h1>Workspace</h1><p class="sub">${esc(WORKSPACE_NAME)}: one plan for the division, checked in every week.</p><section aria-label="About"><h2>About</h2><div class="rows"><a href="/workspace/people">${W.people.length} people</a><a href="/teams">${W.teams.length} teams</a><a href="/goals?scope=all">${R.standing(ctx.moment).ws.goals.length} goals</a><a href="/workspace/access">${admins.length === 1 ? 'One admin' : `${admins.length} admins`}: ${admins.map((a) => esc(a.name)).join(', ')}</a><a href="/workspace/features">Features: ${MODULES.filter((m) => isOn(W, m.id)).map((m) => esc(m.name)).join(', ') || 'none on'}</a><a href="/workspace/cycles">2026 · week ${ctx.week} of ${R.WEEKS} · check-ins due on ${R.dayLong(R.dueDay(ctx.week)).split(' ')[0]}s</a></div></section>`;
        return ok(layout(ctx, { address: url.pathname, body, narrow: true, parent: P[1] ? ['/workspace', 'Workspace'] : null }));
      }
      if (P[0] === 'settings') return ok(layout(ctx, { address: '/settings', narrow: true, body: `<h1>Settings</h1><form><fieldset><legend>Theme</legend><label style="font-weight:400"><input type="radio" name="theme" checked> Follow the device</label><label style="font-weight:400"><input type="radio" name="theme"> Light</label><label style="font-weight:400"><input type="radio" name="theme"> Dark</label></fieldset></form>` }));
      if (P[0] === 'help' && !P[1]) return ok(helpPage(ctx, url));
      if (P[0] === 'help') {
        const a = helpList(ctx).find((x) => x.id === P[1]);
        const off = !a && ARTICLES.map((x) => ({ x, m: helpOwner(x.title) })).find(({ x, m }) => m && m.helpArticles[x.title] === P[1]);
        const body = a ? `<h1>${esc(a.title)}</h1>${a.module?.helpHtml?.[a.id] ? a.module.helpHtml[a.id]() : a.html}` : off ? `<h1>Help</h1><p>${esc(`${off.m.name} is switched off in ${WORKSPACE_NAME}, so its Help isn’t shown there. An admin can switch it on in Workspace, under Features.`)}</p>` : '<h1>Help</h1><p>No article here.</p>';
        return ok(layout(ctx, { address: url.pathname, body, narrow: true, page: a ? a.title : 'Help', navName: a ? a.title : 'Help', parent: ['/help', 'Help'] }));
      }
      if (P[0] === 'whats-new') return ok(layout(ctx, { address: '/whats-new', narrow: true, parent: ['/help', 'Help'], body: '<h1>What’s new</h1><p>The core screens, rebuilt from the kit.</p>' }));
      if (P[0] === 'feedback') return ok(layout(ctx, { address: '/feedback', narrow: true, body: '<h1>Feedback</h1><form method="post" action="/feedback"><label for="fb">Anything to add? <span class="opt">optional</span></label><textarea id="fb" name="text"></textarea><p><button class="btn primary">Send</button></p></form>' }));
      if (P[0] === 'research') return ok(layout(ctx, { address: '/research', narrow: true, body: '<h1>Research</h1><p>Research sessions aren’t built in this rebuild.</p>' }));
      if (P[0] === 'ready') return ok(layout(ctx, { address: '/ready', narrow: true, body: '<h1>Ready to start</h1><p>Your workspace is ready.</p><p><a class="btn primary" href="/">Go to Home</a></p>' }));
      if (P[0] === 'retro') return ok(layout(ctx, { address: url.pathname, form: true, body: `<div class="closer"><a class="btn" href="/">Close and keep the draft</a></div><h1>Wrap up</h1><p>The wrap-up opens in the year’s last two weeks.</p>` }));
      return send(res, 404, notFound(ctx, url), 'text/html; charset=utf-8', hdr);
    }
    // ---------- POST ----------
    const f = await body(req);
    if (P[0] === '__reset') { const fresh = JSON.parse(fs.readFileSync(wsPath, 'utf8')); for (const k of Object.keys(W)) delete W[k]; Object.assign(W, fresh, { changes: [], comments: [] }); envOff(); drafts.clear(); views.length = 0; bump(); return send(res, 200, 'ok', 'text/plain'); }
    if (P[0] === 'api' && P[1] === 'draft') { const dr = draftOf(v); dr.checkins[P[2]] = { ...(dr.checkins[P[2]] || {}), value: f.value }; return send(res, 204, ''); }
    if (P[0] === 'check-in' && P[1]) {
      const g = R.findGoal(P[1]);
      const dr = draftOf(v);
      const raw = new URLSearchParams(await Promise.resolve('')); // keep f
      if (f.close) { dr.checkins[g.id] = { value: f.value, why: f.why, path: f.path, call: f.call }; return redirect(res, '/check-in', hdr); }
      const value = f.value === undefined || f.value === '' ? null : Number(String(f.value).replace(',', '.'));
      if (g.kind !== 'milestone' && value === null) { dr.checkins[g.id] = { ...f }; return send(res, 400, checkInForm(ctx, g, url, { value: 'Type this week’s number, like 12.' })); }
      if (g.kind !== 'milestone' && Number.isNaN(value)) { dr.checkins[g.id] = { ...f }; return send(res, 400, checkInForm(ctx, g, url, { value: `“${f.value}” isn’t a number. Type the number only, like 12.` })); }
      const vd = verdict(ctx, g, value);
      const behind = vd && (vd.calc === 'off' || vd.calc === 'risk');
      const { ws } = R.standing(ctx.moment);
      const prev = (ws.ckByGoal.get(g.id) || []).slice().sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
      let why = f.why || '', pathToGreen = f.path ? { what: f.path, byWeek: f.by ? Number(f.by) : null, needs: '', state: 'planned' } : null;
      if (f.still && prev) { why = why || prev.why; pathToGreen = pathToGreen || prev.pathToGreen; }
      if (behind && !why.trim()) { dr.checkins[g.id] = { ...f }; return send(res, 400, checkInForm(ctx, g, url, { why: 'Say why it is behind, in a sentence.' })); }
      const already = (ws.ckByGoal.get(g.id) || []).some((c) => c.week === ctx.week);
      const ck = { id: newId('ci'), goalId: g.id, authorId: v, week: ctx.week, postedAt: ctx.nowIso(), value, stages: g.kind === 'milestone' ? [].concat(f.stage || []).map((id) => ({ id, done: true })) : null, status: f.call || vd?.calc || 'on', calculated: vd?.calc || f.call || 'on', cause: null, why, greenerWhy: '', proposeTarget: null, pathToGreen, next: '', dataFlagged: false };
      W.checkIns.push(ck);
      log(ctx, `checked in on ${g.title} for week ${ctx.week}`, { goalId: g.id, kind: 'checkin' });
      delete dr.checkins[g.id];
      bump();
      return redirect(res, `/check-in/done?g=${g.id}${already ? '&alongside=1' : ''}`, hdr);
    }
    if (P[0] === 'quick-check-in') {
      for (const [k, val] of Object.entries(f)) if (k.startsWith('v_') && val !== '') { const g = R.findGoal(k.slice(2)); W.checkIns.push({ id: newId('ci'), goalId: g.id, authorId: v, week: ctx.week, postedAt: ctx.nowIso(), value: Number(val), stages: null, status: 'on', calculated: 'on', why: '', pathToGreen: null, next: '' }); log(ctx, `checked in on ${g.title} for week ${ctx.week}`, { goalId: g.id, kind: 'checkin' }); }
      bump();
      return redirect(res, '/check-in', hdr);
    }
    if (P[0] === 'goals' && P[1] === 'new') {
      const dr = draftOf(v);
      const d = dr.newGoal || (dr.newGoal = { ownerId: v, teamId: R.person.get(v)?.teamId, kind: 'metric', title: '' });
      const step = P[2];
      let kindChanged = false;
      if (step === 'what') { if (f.title !== undefined) d.title = f.title; if (f.kind && f.kind !== d.kind) { d.kind = f.kind; kindChanged = true; } }
      if (step === 'who' && f.ans_team) { d.teamAnswer = f.ans_team; if (f.ans_team === 'move') { d.teamId = R.person.get(d.ownerId)?.teamId; } }
      if (step === 'who') { if (f.ownerId && f.ownerId !== d.ownerId) { d.ownerId = f.ownerId; if (!d.teamChosen) d.teamId = R.person.get(f.ownerId)?.teamId; } if (f.teamId && f.teamId !== d.teamId) { d.teamId = f.teamId; d.teamChosen = true; } d.level = f.level || d.level; d.parentId = f.parentId || null; d.alsoHelps = f.alsoHelps ? [f.alsoHelps] : []; d.guardrail = !!f.guardrail; }
      if (step === 'measure') {
        for (const k of ['unit', 'start', 'target', 'fromWeek', 'endWeek', 'shape', 'limit', 'bound', 'margin', 'definition']) if (f[k] !== undefined) d[k] = f[k];
        if (f.fromWeek && Number(f.fromWeek) === ctx.week) delete d.fromWeek;
        if (f.endWeek && Number(f.endWeek) === R.WEEKS) delete d.endWeek;
        if (f.sname !== undefined) d.stages = [{ id: 's1', name: f.sname, dueWeek: Number(f.sdue) }];
        d.answered = Object.keys(f).filter((k) => k.startsWith('ans_') && f[k] === 'keep').map((k) => k.slice(4)).concat(d.answered || []);
      }
      dr.newGoalStep = step;
      if (f.close) return redirect(res, '/goals', hdr);
      let errs = {};
      if (step === 'what' && (d.title || '').trim().length < 3) errs.title = 'Give it a name of at least three characters.';
      if (step === 'who' && d.teamId !== R.person.get(d.ownerId)?.teamId && !d.teamAnswer) errs._team = 'Answer the question above, under Team.';
      if (step === 'measure') {
        errs = mustFixMeasure({ ...d, fromWeek: d.fromWeek ?? ctx.week, endWeek: d.endWeek ?? R.WEEKS });
        const open = questionsFor(R, S1, d, ctx.moment).filter((q) => !(d.answered || []).includes(q.kind));
        if (!Object.keys(errs).length && open.length) errs._line = open.length === 1 ? `Answer the question above, under ${open[0].field === 'target' ? 'Target' : open[0].field === 'unit' ? 'Unit' : 'From'}.` : `Answer the ${open.length} questions above.`;
      }
      if (Object.keys(errs).length) return send(res, 400, newGoalPage(ctx, step, url, errs));
      if (step !== 'check') {
        const back = url.searchParams.get('back') === 'check';
        const next = back && kindChanged ? 'measure' : back ? 'check' : STEPS[STEPS.indexOf(step) + 1];
        dr.newGoalStep = next;
        return redirect(res, `/goals/new/${next}${back && kindChanged ? '?back=check' : ''}`, hdr);
      }
      // publish
      const key = `G-${Math.max(...W.goals.map((g) => goalNum(g.key))) + 1}`;
      const level = d.level || startLevel(d, R, W, v) || 'team';
      const g = { id: `goal_${key.toLowerCase().replace('-', '')}`, cycleId: 'cycle', teamId: d.teamId, ownerId: d.ownerId, title: d.title, source: d.source || '', definition: d.definition || '', io: 'input', level, guardrail: !!d.guardrail, parentId: d.parentId || null, effect: null, createdAt: ctx.nowIso(), kind: d.kind, unit: d.unit || '', decimals: Number(d.decimals || 0), key, version: 1 };
      if (d.kind === 'metric') g.plan = { start: Number(d.start), target: Number(d.target), fromWeek: Number(d.fromWeek ?? ctx.week), endWeek: Number(d.endWeek ?? R.WEEKS), shape: d.shape || 'linear' };
      if (d.kind === 'range') g.range = { bound: d.bound || 'atMost', limit: Number(d.limit), margin: Number(d.margin || 0) };
      if (d.kind === 'milestone') g.stages = d.stages;
      if (d.ownerId !== v && f.state !== 'active') g.proposedAt = ctx.nowIso();
      W.goals.push(g);
      const checked = questionsFor(R, S1, d, ctx.moment).filter((q) => (d.answered || []).includes(q.kind)).map((q) => ['Checked', q.text, 'Yes, keep it']);
      if (d.teamAnswer === 'keep') checked.push(['Checked', `Owner in another team`, `Keep it in ${teamName(d.teamId)}`]);
      log(ctx, `added ${g.title} (${key})`, { goalId: g.id, kind: 'change', diffs: checked.length ? checked : null });
      dr.newGoal = null; dr.newGoalStep = 'what';
      bump();
      return redirect(res, `/goals/${g.id}?published=1`, hdr);
    }
    if (P[0] === 'goals' && P[2] === 'edit') {
      const g = R.findGoal(P[1]);
      const dr = draftOf(v);
      if (f.close) { dr.edits[g.id] = f; return redirect(res, `/goals/${g.id}`, hdr); }
      if (Number(f.version) !== (g.version || 1)) return send(res, 409, editPage(ctx, g, url, { _conflict: 'Someone else changed this a moment ago. Your change isn’t saved: here is the goal as it is now, so you can make it again.' }));
      const diffs = [];
      const set = (k, val, label, show = (x) => x) => { if (val !== undefined && String(val) !== String(g[k] ?? '')) { diffs.push([label, show(g[k] ?? '—'), show(val)]); g[k] = val; } };
      set('title', f.title, 'Title'); set('definition', f.definition, 'Definition'); set('source', f.source, 'Source');
      if (f.ownerId) set('ownerId', f.ownerId, 'Owner', nameOf); if (f.teamId) set('teamId', f.teamId, 'Team', teamName);
      if (g.plan && f.target !== undefined && Number(f.target) !== g.plan.target) {
        const started = W.checkIns.some((c) => c.goalId === g.id);
        if (started && !(f.reason || '').trim()) return send(res, 400, editPage(ctx, g, url, { reason: 'Say why, in a sentence. It goes in the goal’s History, and anyone watching it sees the change flagged.' }));
        diffs.push(['Target', fmt(g, g.plan.target), fmt(g, Number(f.target))]); g.plan = { ...g.plan, target: Number(f.target) };
      }
      g.version = (g.version || 1) + 1;
      if (diffs.length) log(ctx, `changed ${g.title}${f.reason ? `: ${f.reason}` : ''}`, { goalId: g.id, diffs, kind: 'change' });
      delete dr.edits[g.id];
      bump();
      return redirect(res, `/goals/${g.id}`, hdr);
    }
    if (P[0] === 'goals' && P[2] === 'comment') { const g = R.findGoal(P[1]); if ((f.text || '').trim()) { W.comments.unshift({ id: newId('cm'), goalId: g.id, by: v, text: f.text, at: ctx.nowIso() }); log(ctx, `commented on ${g.title}`, { goalId: g.id, kind: 'comment' }); } return redirect(res, `/goals/${g.id}?history=comments#history`, hdr); }
    if (P[0] === 'goals' && P[2] === 'step') { const g = R.findGoal(P[1]); if (f.what && f.week) { W.requests.push({ id: newId('ask'), kind: 'action', goalIds: [g.id], askedBy: v, recipientId: v, ask: f.what, status: 'open', dueWeek: Number(f.week), reviewId: null, week: ctx.week, checkInId: null, createdAt: ctx.nowIso(), updatedAt: ctx.nowIso(), answer: null, answeredBy: null, answeredAt: null }); log(ctx, `added a next step on ${g.title}`, { goalId: g.id, kind: 'change' }); bump(); } return redirect(res, `/goals/${g.id}#asks`, hdr); }
    if (P[0] === 'goals' && P[2] === 'ask-update') { const g = R.findGoal(P[1]); W.requests.push({ id: newId('ask'), kind: 'update', goalIds: [g.id], askedBy: v, recipientId: g.ownerId, ask: 'Please check in.', status: 'open', dueWeek: null, reviewId: null, week: ctx.week, checkInId: null, createdAt: ctx.nowIso(), updatedAt: ctx.nowIso(), answer: null, answeredBy: null, answeredAt: null }); log(ctx, `asked ${nameOf(g.ownerId)} for an update on ${g.title}`, { goalId: g.id, kind: 'change' }); bump(); return redirect(res, `/goals/${g.id}`, hdr); }
    if (P[0] === 'goals' && P[2] === 'watch') { const g = R.findGoal(P[1]); const w = W.watches.find((x) => x.personId === v && x.kind === 'goal' && x.ref === g.id && !x.removedAt); if (w) w.removedAt = ctx.nowIso(); else W.watches.push({ id: newId('w'), personId: v, kind: 'goal', ref: g.id }); bump(); return redirect(res, `/goals/${g.id}`, hdr); }
    if (P[0] === 'asks') {
      const a = W.requests.find((x) => x.id === P[1]);
      if (P[2] === 'answer') Object.assign(a, { status: 'answered', answer: f.answer, answeredBy: v, answeredAt: ctx.nowIso(), updatedAt: ctx.nowIso() });
      if (P[2] === 'done') Object.assign(a, { status: 'done', answeredBy: v, answeredAt: ctx.nowIso(), updatedAt: ctx.nowIso() });
      if (P[2] === 'withdraw') Object.assign(a, { status: 'withdrawn', updatedAt: ctx.nowIso() });
      log(ctx, `${P[2] === 'answer' ? 'answered' : P[2] === 'done' ? 'marked done' : 'withdrew'} “${a.ask}”`, { goalId: a.goalIds[0], kind: 'change' });
      bump();
      return redirect(res, `/goals/${a.goalIds[0]}#asks`, hdr);
    }
    if (P[0] === 'reviews' && P[2] === 'mark') { W.decisions.push({ id: newId('dec'), goalId: P[3], reviewId: P[1], week: ctx.week, kind: 'acknowledge', byId: v, at: ctx.nowIso(), note: '' }); bump(); return redirect(res, `/goals/${P[3]}?review=${P[1]}`, hdr); }
    if (P[0] === 'feedback') return redirect(res, '/feedback', hdr);
    return send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    send(res, 500, `<!doctype html><title>Something went wrong · Faro</title><h1>Something went wrong</h1><p>${esc(e.message)}</p><p><a href="">Try again</a></p>`);
  }
});

function editPage(ctx, g, url, errs = {}) {
  const part = url.searchParams.get('part');
  if (part) { /* old ?part= links lead to the matching section */ }
  const d = draftOf(ctx.viewer).edits[g.id] || {};
  const val = (k, def) => esc(d[k] ?? def ?? '');
  const sectionFor = { plan: 'plan', owner: 'owner', definition: 'definition' };
  const jump = part ? `<script>location.hash='${sectionFor[part] || 'definition'}';</script>` : '';
  const body = `<form method="post" action="/goals/${g.id}/edit" novalidate><input type="hidden" name="version" value="${g.version || 1}"><div class="closer"><button class="btn" type="submit" name="close" value="keep" formnovalidate>Close and keep the draft</button></div><h1>Change ${esc(g.title)}</h1>${errs._conflict ? `<p class="check" role="alert">${esc(errs._conflict)}</p>` : ''}
<nav class="home-counts" aria-label="Sections"><a href="#definition">Definition</a><a href="#plan">Plan and target</a><a href="#owner">Owner and team</a><a href="#more">More details</a></nav>
<section id="definition"><h2>Definition</h2><label for="t">Name</label><input type="text" id="t" name="title" value="${val('title', g.title)}"><label for="df">What it measures <span class="opt">· optional</span></label><textarea id="df" name="definition">${val('definition', g.definition)}</textarea></section>
<section id="plan"><h2>Plan and target</h2>${g.plan ? `<label for="tg">Target</label><input type="text" id="tg" name="target" value="${val('target', g.plan.target)}"><label for="rs">Why change the plan? <span class="opt">· needed once check-ins have started</span></label><textarea id="rs" name="reason">${val('reason', '')}</textarea>${errs.reason ? `<p class="err" role="alert">${esc(errs.reason)}</p>` : ''}` : '<p class="meta">This goal has no number plan.</p>'}</section>
<section id="owner"><h2>Owner and team</h2><label>Owner</label>${picker('ownerId', 'person', g.ownerId, nameOf(g.ownerId), { aria: 'Find the owner' })}<label>Team</label>${picker('teamId', 'team', g.teamId, teamName(g.teamId), { aria: 'Find the team' })}<label>Feeds into</label>${picker('parentId', 'goal', g.parentId, g.parentId ? R.goalById.get(g.parentId)?.title : '', { aria: 'Find the goal it feeds', for: g.id })}</section>
<details id="more"${part === 'more' ? ' open' : ''}><summary><h2 style="display:inline">More details</h2></summary><label for="src">Data source <span class="opt">· optional</span></label><input type="text" id="src" name="source" value="${val('source', g.source)}"><p class="meta">${esc(LEVEL[g.level])} · ${g.guardrail ? 'A guardrail' : 'Not a guardrail'}</p></details>
<p style="position:sticky;bottom:0;background:var(--bg);padding:8px 0"><button class="btn primary" type="submit">Save changes</button></p></form>${jump}
<script>(function(){var f=document.querySelector('form');f.addEventListener('submit',function(e){var sub=e.submitter;if(sub&&sub.name==='close')return;e.preventDefault();var fd=new URLSearchParams(new FormData(f));fetch(f.action,{method:'POST',body:fd,headers:{'content-type':'application/x-www-form-urlencoded'}}).then(function(r){
 var goal='/goals/${g.id}';if(r.ok&&r.redirected&&new URL(r.url).pathname===goal){var t=[];try{t=JSON.parse(sessionStorage.getItem('trail')||'[]')}catch(x){}var prev=t[t.length-2];if(prev&&prev.p===goal){sessionStorage.setItem('reloadOnShow','1');history.back();}else location.replace(goal);}
 else return r.text().then(function(h){document.open();document.write(h);document.close();});});});})();</script>`;
  return layout(ctx, { address: `/goals/${g.id}/edit`, body, form: true, page: `Change ${g.title}` });
}

server.listen(PORT, () => console.log(`Faro rebuild on http://localhost:${PORT}`));
