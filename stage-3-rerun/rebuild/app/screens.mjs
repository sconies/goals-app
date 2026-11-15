// The core screens. Each takes the request's context and gives { title, body, back?, wide?, focused?, narrow? }.
import { esc, plural, statusTag, shape, warnMark } from './html.mjs';
import { homeFor, dueGoals, waitingAsks, askTitle, runOf, receiptText } from '../s3/home.mjs';
import { goalRows, personRows, teamRows, search, STATUS_WORD, LEVEL_WORD, countLine, nothingLine, fold, keyOf } from '../s3/finding.mjs';
import { readBack, levelFor, weekSentence } from '../s3/readback.mjs';
import { startReadBack, cycleDays, cycleState, goalResult, resultWords, RESULT_WORD } from '../s3/year.mjs';
import { SECTION_NAMES } from '../s3/navigation.mjs';
import { GROUPS, words } from './platform.mjs';
import { HELP } from './help.mjs';
import { WHATS_NEW } from './whatsnew.mjs';

const FLAG_WORD = { off: 'Off track', 'missed-path': 'Missed its own date', stale: 'No recent update', decision: 'Decision or help needed', 'no-path': 'No path to green', risk: 'At risk', trend: 'Getting worse', greener: 'Greener than calculated', due: 'Check-in due' };
const FLAG_WHY = { off: 'under 80% of the progress planned by now: it needs a decision, help or a new plan', 'missed-path': 'the week its path to green named has passed and it is still behind', stale: 'its latest check-in was posted 14 days ago or more', decision: 'an ask for a decision or help is open on it', 'no-path': 'it is behind and its latest check-in has no path to green', risk: '80% to 95% of the progress planned by now', trend: 'it is further behind its plan at each of its last check-ins', greener: 'its owner called it greener than the numbers say, with a reason', due: 'no check-in yet for this week' };
const unitOf = (g, v) => (v === null || v === undefined ? '—' : `${v}${g.unit ? (g.unit === '%' ? '%' : ` ${g.unit}`) : ''}`);
const personName = (C, id) => C.personById.get(id)?.name ?? '—';
const teamName = (C, id) => C.teamById.get(id)?.name ?? '—';
const parts = (ctx, place, extra = {}) => ctx.state.platform.draw(place, ctx.on, { viewer: ctx.viewer, data: ctx.d, workspace: ctx.wsName, on: ctx.on, ...extra });
const qs = (params) => { const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString(); return s ? `?${s}` : ''; };
const form = (action, inner, { once = true, cls = '' } = {}) => `<form method="post" action="${esc(action)}"${once ? ' data-once' : ''}${cls ? ` class="${cls}"` : ''}>${inner}</form>`;

function goalRow(ctx, s) {
  const g = s.g;
  return `<li class="goal-row${s.status === 'off' ? ' row-off' : ''}">${statusTag(s.status)} <a href="/goals/${esc(g.id)}">${esc(g.title)}</a><br><span class="gkey">${esc(g.key)}</span> <span class="quiet">· ${esc(personName(ctx.C, g.ownerId))} · ${esc(teamName(ctx.C, g.teamId))}${g.proposedAt ? ' · Proposed' : ''}</span></li>`;
}
const reasonOf = (s) => { const f = s.flags.find((x) => x !== 'due') || s.flags[0]; return f ? `${FLAG_WORD[f]}: ${FLAG_WHY[f]}.` : ''; };

// ---------- Home ----------
export function home(ctx) {
  const { C, viewer, m, state } = ctx;
  const h = homeFor(C, viewer, m, { workspaceName: ctx.wsName });
  const w = C.S1.currentWeek(m);
  const dueDay = C.dueDay(w), today = C.dayNum(m);
  const due = dueGoals(C, viewer, w, m);
  const ws = C.goalStates(m).ws;
  const inN = due.filter((g) => (ws.ckByGoal.get(g.id) || []).some((c) => c.week === w)).length;
  const ring = due.length ? `<svg class="ring" viewBox="0 0 36 36" role="img" aria-label="${inN} of ${due.length} check-ins in"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--ink)" stroke-width="4" stroke-dasharray="${(94.2 * inN) / due.length} 94.2" transform="rotate(-90 18 18)"/></svg>` : '';
  let hero;
  if (h.lead) {
    const k = h.lead.kind;
    const eyebrow = k === 'check-in-late' ? `Check-ins were due on ${C.fmtDay(dueDay)}` : k === 'check-in' ? `Check-ins are due by ${C.fmtDay(dueDay)}${dueDay === today ? ', today' : dueDay - today === 1 ? ', tomorrow' : ''}`
      : k === 'review' ? 'A review is on today' : k === 'ask' ? 'Needs your response' : k === 'attention' ? `In ${ctx.wsName}` : k === 'watching' ? 'Goals you watch' : 'This week';
    const btn = k.startsWith('check-in') ? ['Start check-in', '/check-in/first'] : k === 'review' ? ['Open the review', '/reviews'] : k === 'ask' ? ['Respond', '#asks'] : k === 'attention' ? ['See them', '/goals?scope=all&attention=1'] : k === 'watching' ? ['See them', '/goals?scope=watching&attention=1'] : ['Start the wrap-up', '/retro'];
    hero = `<section class="hero" aria-label="This week" data-part="This week’s main action">${ring}<p class="eyebrow">${esc(eyebrow)}</p><p class="big">${esc(h.lead.title)}</p><a class="btn primary" href="${btn[1]}">${btn[0]}</a></section>`;
  } else {
    const owns = C.goalStates(m).some((s) => s.g.ownerId === viewer);
    const noGoal = /You don’t own or watch a goal/.test(h.quiet);
    const early = /You have \d+ to do/.test(h.quiet);
    hero = `<section class="hero" aria-label="This week">${ring}<p class="quiet-line">${esc(h.quiet)}</p>${early ? '<a class="btn" href="/check-in">Check in early</a>' : ''}${noGoal ? '<a class="btn" href="/goals?scope=all">See the goals</a> <a class="btn" href="/goals/new">Set up a goal</a>' : ''}${!owns && !noGoal ? '' : ''}</section>`;
  }
  const mine = C.goalStates(m).filter((s) => s.g.ownerId === viewer);
  const needs = mine.filter((s) => s.needs), handled = mine.filter((s) => s.handled);
  const arow = (s) => `<li class="arow" data-tone="${esc(s.status)}"><span class="arow-icon">${statusTag(s.status)}</span> <a class="arow-title" href="/goals/${esc(s.g.id)}">${esc(s.g.title)}</a><br><span class="arow-why">${esc(reasonOf(s))}</span></li>`;
  const goalsBlock = mine.length ? `<section aria-label="Your goals"><h2>Your goals</h2><p><a href="/goals?scope=mine&attention=1">${needs.length} ${needs.length === 1 ? 'needs' : 'need'} attention</a> · <a href="/goals?scope=mine">${plural(mine.length, 'goal', 'goals')}</a></p><ul class="rows">${needs.slice(0, 6).map(arow).join('')}${handled.slice(0, 3).map(arow).join('')}</ul></section>` : '';
  const asks = waitingAsks(C, viewer, m);
  const asksBlock = asks.length ? `<section id="asks" aria-label="Needs your response"><h2>Needs your response</h2><ul class="rows">${asks.map((x) => `<li>${esc(askTitle(C, x.a))}: “${esc(x.a.ask)}”. About ${x.a.goalIds.map((id) => `<a href="/goals/${esc(id)}">${esc(C.goalById.get(id)?.title ?? id)}</a>`).join(', ')}.</li>`).join('')}</ul></section>` : '';
  const run = h.run >= 2 ? `<p class="quiet">${h.run} weeks in a row on time.</p>` : '';
  hero = hero.replace('</section>', `${parts(ctx, 'home.lead', { day: m })}</section>`);
  return { title: 'Home', body: `<h1>Home</h1>${hero}${run}${asksBlock}${goalsBlock}${parts(ctx, 'home.blocks')}` };
}

// ---------- Goals ----------
export function goalsScreen(ctx) {
  const { C, viewer, m, url } = ctx;
  const p = url.searchParams;
  const states = C.goalStates(m);
  const owns = states.some((s) => s.g.ownerId === viewer);
  const me = C.personById.get(viewer);
  const scope = p.get('scope') || (owns ? 'mine' : 'all');
  let list = states;
  if (scope === 'mine') list = list.filter((s) => s.g.ownerId === viewer);
  else if (scope === 'team') list = list.filter((s) => s.g.teamId === me?.teamId);
  const filters = [];
  const status = p.get('status'); if (status) { const st = status.split(','); list = list.filter((s) => st.includes(s.status)); filters.push(['Status', st.map((x) => STATUS_WORD[x] || x)]); }
  const team = p.get('team'); if (team) { list = list.filter((s) => s.g.teamId === team); filters.push(['Team', [teamName(C, team)]]); }
  const owner = p.get('owner'); if (owner) { list = list.filter((s) => s.g.ownerId === owner); filters.push(['Owner', [personName(C, owner)]]); }
  const level = p.get('level'); if (level) { list = list.filter((s) => s.g.level === level); filters.push(['Level', [LEVEL_WORD[level] || level]]); }
  const attention = p.get('attention') === '1';
  if (attention) { list = list.filter((s) => s.needs || s.handled); filters.push(['Needs attention', ['Yes']]); }
  const q = p.get('q') || '';
  const rows = goalRows(list, C);
  const found = search(rows, q, { keyRow: true });
  if (attention) found.rows.sort((a, b) => (list.find((s) => s.g.id === a.id).needs ? 0 : 1) - (list.find((s) => s.g.id === b.id).needs ? 0 : 1));
  const shown = found.rows.map((r) => list.find((s) => s.g.id === r.id));
  const layout = p.get('view') || 'list';
  const narrowed = !!(q || filters.length);
  const needN = list.filter((s) => s.needs).length;
  const count = attention && found.total ? `${needN} need attention: ${[...new Set(list.filter((s) => s.needs).flatMap((s) => s.flags.filter((f) => f !== 'due')))].map((f) => FLAG_WORD[f].toLowerCase()).slice(0, 3).join(', ')}.` : countLine(found.total, 'goal', 'goals', 'worst first', narrowed);
  const filterLine = filters.length ? `Filtered by: ${filters.map(([l, vs]) => `${l} ${vs.join(' or ')}`).join(' · ')}` : '';
  const nothing = !found.total ? nothingLine('goal', 'goals', q, filters.length > 0, found.near) : found.near ? nothingLine('goal', 'goals', q, filters.length > 0, found.near) : '';
  const keep = (extra) => qs({ scope: p.get('scope'), status, team, owner, level, attention: attention ? '1' : '', view: layout === 'list' ? '' : layout, q, ...extra });
  const tab = (id, label) => `<a href="/goals${qs({ scope: id })}"${scope === id ? ' aria-current="page"' : ''}>${label}</a>`;
  const hidden = ['scope', 'status', 'team', 'owner', 'level', 'attention', 'view'].filter((k) => p.get(k)).map((k) => `<input type="hidden" name="${k}" value="${esc(p.get(k))}">`).join('');
  const layoutMenu = `<form method="get" action="/goals" class="inline">${hidden.replace(/<input type="hidden" name="view"[^>]*>/, '')}${q ? `<input type="hidden" name="q" value="${esc(q)}">` : ''}<label class="inline">Layout: <select name="view" onchange="this.form.submit()" aria-label="Layout">${['list', 'table', 'board', 'history'].map((v) => `<option value="${v === 'list' ? '' : v}"${layout === v ? ' selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}${parts(ctx, 'goals.layouts', { goals: shown.map((s) => s.g), address: ctx.address })}</select></label><noscript><button>Show</button></noscript></form>`;
  const bar = `<div class="listbar"><form method="get" action="/goals" role="search" class="inline">${hidden}<input type="search" name="q" value="${esc(q)}" aria-label="Find a goal" placeholder="Find a goal"></form>${layoutMenu}<a href="/goals${keep({ attention: attention ? '' : '1' })}">${attention ? 'Show every goal' : 'Needs attention'}</a></div>
${count ? `<p class="countline">${esc(count)}</p>` : ''}${filterLine ? `<p class="filterline">${esc(filterLine)}</p>` : ''}${nothing ? `<p class="nothing">${esc(nothing)}</p>${q ? `<form method="get" action="/goals">${hidden}<button type="submit">Clear the search</button></form>` : ''}` : ''}`;
  let body;
  if (layout === 'table') body = `<table class="gtable"><thead><tr><th>Status</th><th>Goal</th><th>Owner</th><th>Team</th><th>Now</th></tr></thead><tbody>${shown.map((s) => `<tr${s.status === 'off' ? ' class="row-off"' : ''}><td>${statusTag(s.status)}</td><td><a href="/goals/${esc(s.g.id)}">${esc(s.g.title)}</a> <span class="gkey">${esc(s.g.key)}</span></td><td>${esc(personName(C, s.g.ownerId))}</td><td>${esc(teamName(C, s.g.teamId))}</td><td>${esc(unitOf(s.g, s.latest?.value))}</td></tr>`).join('')}</tbody></table>`;
  else if (layout === 'board') body = `<div class="board" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${['off', 'risk', 'stale', 'on', 'none', 'done'].map((st) => { const col = shown.filter((s) => s.status === st); return `<section aria-label="${STATUS_WORD[st]}"><h3>${statusTag(st)} ${col.length}</h3><ul class="rows">${col.map((s) => goalRow(ctx, s)).join('')}</ul></section>`; }).join('')}</div>`;
  else if (layout === 'history') { const w = C.S1.currentWeek(m); body = `<table class="gtable"><thead><tr><th>Goal</th>${[w - 3, w - 2, w - 1, w].map((x) => `<th>Week ${x}</th>`).join('')}</tr></thead><tbody>${shown.map((s) => `<tr><td><a href="/goals/${esc(s.g.id)}">${esc(s.g.title)}</a></td>${[w - 3, w - 2, w - 1, w].map((x) => { const c = s.posted.filter((k) => k.week === x).pop(); return `<td>${c ? `${statusTag(c.status)}` : '<span class="quiet">No check-in</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`; }
  else body = `<ul class="rows">${shown.map((s) => goalRow(ctx, s)).join('')}</ul>`;
  const address = `/goals${keep({})}`;
  const viewsTools = `<details class="sheet"><summary>Views</summary>${form('/act/saveView', `<input type="hidden" name="address" value="${esc(address)}"><label>Save this view… <input name="name" maxlength="80" required></label><button type="submit">Save</button>`)}<p><a href="${esc(address)}">Copy link</a></p>${parts(ctx, 'goals.tools', { goals: shown.map((s) => s.g), viewName: null })}</details>`;
  return { title: 'Goals', wide: layout !== 'list', body: `<h1>Goals</h1>${parts(ctx, 'goals.header')}<nav class="tabs" aria-label="Scope">${tab('mine', 'Mine')}${tab('team', 'My team')}${tab('all', 'All')}${parts(ctx, 'goals.scopes')}</nav>${bar}${viewsTools}${body}` };
}

// ---------- A goal ----------
function chart(C, s, m) {
  const g = s.g;
  if (g.kind !== 'metric') return '';
  const W = 520, H = 160, w = C.S1.currentWeek(m);
  const vals = s.posted.filter((c) => c.value !== null && c.value !== undefined);
  const plan = [0, w].map((x) => C.S1.planAt(C.S1.planAsOf(g, x), x));
  const all = [...vals.map((c) => c.value), g.plan.start, g.plan.target];
  const lo = Math.min(...all), hi = Math.max(...all) || 1;
  const X = (x) => 20 + ((W - 40) * x) / Math.max(1, C.WEEKS), Y = (v) => H - 20 - ((H - 40) * (v - lo)) / (hi - lo || 1);
  const pts = vals.map((c) => `${X(c.week).toFixed(1)},${Y(c.value).toFixed(1)}`).join(' ');
  return `<section aria-label="Chart" data-part="Chart"><h2>Chart</h2><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="The plan from ${unitOf(g, g.plan.start)} to ${unitOf(g, g.plan.target)}, and ${vals.length} numbers checked in"><line x1="${X(0)}" y1="${Y(plan[0])}" x2="${X(C.WEEKS)}" y2="${Y(C.S1.planAt(C.S1.planAsOf(g, C.WEEKS), C.WEEKS))}" stroke="var(--muted)" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="2"/></svg></section>`;
}
export function goalPage(ctx, id) {
  const { C, viewer, m, d } = ctx;
  const g = C.findGoal(id);
  if (!g || g.removedAt) return { notFound: 'Goal not found', title: 'Goal not found', body: '<h1>This goal doesn’t exist</h1><p><a href="/goals">All goals</a></p>' };
  const s = C.stateOf(g.id, m) || { g, status: g.stoppedAt ? 'done' : 'none', flags: [], posted: (d.checkIns || []).filter((c) => c.goalId === g.id && !c.removedAt), latest: null };
  const w = C.S1.currentWeek(m);
  const isOwner = g.ownerId === viewer;
  const asks = (d.requests || []).filter((a) => a.goalIds.includes(g.id) && a.status !== 'withdrawn' && !a.removedAt);
  // the main button (goal-act)
  let main = null;
  const q = asks.find((a) => a.status === 'open' && a.kind === 'question' && a.recipientId === viewer);
  const dec = asks.find((a) => a.status === 'open' && a.kind === 'decision' && a.recipientId === viewer);
  const myStep = asks.find((a) => a.status === 'open' && a.kind === 'action' && a.recipientId === viewer);
  const checkedThisWeek = s.posted.some((c) => c.week === w);
  if (g.stoppedAt) main = null;
  else if (q) main = [`Answer ${personName(C, q.askedBy).split(' ')[0]}’s question`, `#asks`];
  else if (dec) main = [`Answer ${personName(C, dec.askedBy).split(' ')[0]}’s request`, `#asks`];
  else if (isOwner && !s.posted.length) main = ['Post the first check-in', `/check-in/${g.id}`];
  else if (isOwner && !checkedThisWeek && s.status !== 'done') main = [`Check in for week ${w}`, `/check-in/${g.id}`];
  else if (myStep) main = ['Mark your next step done', '#asks'];
  else if (isOwner && (s.status === 'off' || s.status === 'risk') && !asks.some((a) => a.kind === 'action' && a.status === 'open')) main = ['Add a next step', '#asks'];
  else if (!isOwner && s.status === 'stale' && !asks.some((a) => a.kind === 'update' && a.status === 'open')) main = [`Ask ${personName(C, g.ownerId).split(' ')[0]} for an update`, '#asks'];
  const beside = isOwner && !g.stoppedAt && s.status !== 'done' && !(main && /^Check in|first check-in/.test(main[0])) ? `<a class="btn" href="/check-in/${esc(g.id)}">Check in again</a>` : '';
  const mayChange = isOwner || ctx.isAdmin;
  const menu = `<details class="goal-menu"><summary aria-label="More about this goal" class="btn">…</summary><div role="group" aria-label="More about this goal">${mayChange && !g.stoppedAt ? `<a href="/goals/${esc(g.id)}/edit">Change this goal</a><br>` : ''}<a href="/goals/${esc(g.id)}/print">Print this goal</a></div></details>`;
  const buttons = `<div class="actions summary-bar" data-part="Summary bar">${main ? `<a class="btn primary" href="${esc(main[1])}">${esc(main[0])}</a>` : ''}${beside}${parts(ctx, 'goal.buttons', { goal: g })}${menu}</div>`;
  const parent = g.parentId && C.goalById.get(g.parentId);
  const summary = `<p>${g.proposedAt ? '<span class="status">Proposed</span>' : statusTag(s.status)} <span class="gkey">${esc(g.key)}</span></p><h1>${esc(g.title)}</h1><p class="quiet">${esc(personName(C, g.ownerId))} · ${esc(teamName(C, g.teamId))} · ${esc(LEVEL_WORD[g.level] ?? g.level)}${g.stoppedAt ? ' · Stopped' : ''}</p>${parts(ctx, 'goal.facts', { goal: g })}`;
  const askRow = (a) => `<li><strong>${a.kind === 'decision' ? 'Decision or help' : a.kind === 'question' ? 'Question' : a.kind === 'action' ? 'Next step' : 'Update asked'}:</strong> ${esc(a.ask)}<br><span class="quiet">Asked of ${esc(personName(C, a.recipientId))} by ${esc(personName(C, a.askedBy))} · ${a.status === 'open' ? 'Open' : a.status === 'done' ? 'Done' : 'Answered'}</span>${a.answer ? `<br>${esc(personName(C, a.answeredBy))}: ${esc(a.answer)}` : ''}</li>`;
  const open = asks.filter((a) => a.status === 'open'), doneA = asks.filter((a) => a.status !== 'open');
  const gap = (s.status === 'off' || s.status === 'risk') && !open.some((a) => a.kind === 'action') ? '<p>No next step yet. Nobody has said what happens next, who does it and by when.</p>' : '';
  const asksSec = `<section id="asks" aria-label="Next steps and asks" data-part="Next steps and asks"><h2>Next steps and asks</h2>${gap}${open.length || doneA.length ? `<ul class="rows">${open.map(askRow).join('')}${doneA.slice(0, 3).map(askRow).join('')}</ul>` : '<p class="quiet">Nothing asked and no next step.</p>'}</section>`;
  const L = s.latest;
  const decisionOpen = open.filter((a) => a.kind === 'decision');
  const why = `<section aria-label="Why" data-part="Why"><h2>Why</h2>${decisionOpen.length ? `<p>Waiting on a decision from ${esc(decisionOpen.map((a) => personName(C, a.recipientId)).join(' and '))}: see Next steps and asks</p>` : ''}${L ? `<p>${esc(personName(C, L.authorId))} said in week ${L.week}: ${esc(L.why || 'nothing more.')}</p>${L.pathToGreen ? `<p data-part="Path to green">Path to green: ${esc(L.pathToGreen.what || '')}</p>` : ''}` : '<p class="quiet">No check-in yet.</p>'}</section>`;
  const res = goalResult(C, g, s.posted, m);
  const about = `<section aria-label="About this goal" data-part="About this goal"><h2>About this goal</h2><ul class="facts">${g.kind === 'metric' ? `<li>A number to move: from ${esc(unitOf(g, g.plan.start))} to ${esc(unitOf(g, g.plan.target))}</li>` : g.kind === 'range' ? `<li>A number to keep in range: limit ${esc(unitOf(g, g.range.limit))}</li>` : `<li>Dated stages: ${(g.stages || []).map((x) => esc(x.name)).join(', ')}</li>`}${g.definition ? `<li>How it’s measured: ${esc(g.definition)}</li>` : ''}${g.source ? `<li>Where the number comes from: ${esc(g.source)}</li>` : ''}<li>Feeds into: ${parent ? `<a href="/goals/${esc(parent.id)}">${esc(parent.title)}</a>` : 'nothing: it’s at the top of its own tree'}</li>${res ? `<li>Result: <span class="result">${esc(resultWords(res))}</span></li>` : ''}</ul>${parts(ctx, 'goal.sections', { goal: g })}</section>`;
  const hist = history(ctx, g, s);
  const removal = mayChange && !g.stoppedAt ? `<details class="sheet"><summary>Stop or delete this goal</summary>${s.posted.length ? form('/act/stopGoal', `<input type="hidden" name="goalId" value="${esc(g.id)}"><label>Why is it stopping? <input name="reason" required minlength="10"></label><button type="submit">Stop this goal</button>`) : form('/act/deleteGoal', `<input type="hidden" name="goalId" value="${esc(g.id)}"><button type="submit">Delete this goal</button>`)}</details>` : '';
  return { title: g.title, goal: g, body: `${summary}${buttons}${asksSec}${why}${chart(C, s, m)}${about}${hist}${removal}` };
}

// History: every week, newest first, each entry with its second line (who and when).
function history(ctx, g, s) {
  const { C, d, m } = ctx;
  const w = C.S1.currentWeek(m);
  const first = Math.max(1, Math.min(C.S1.currentWeek(g.createdAt), ...s.posted.map((c) => c.week)));
  const last = g.stoppedAt ? C.S1.currentWeek(g.stoppedAt) : w;
  const entries = [];
  const changes = (d.changes || []).filter((c) => c.goalId === g.id && c.entity !== 'checkIn');
  let gapStart = null;
  const flushGap = (to) => { if (gapStart === null) return; const n = to - gapStart + 1; if (n >= 4) entries.push({ week: to, text: `Weeks ${gapStart} to ${to} · No check-ins (${n} weeks)`, second: '' }); else for (let k = gapStart; k <= to; k++) entries.push({ week: k, text: `Week ${k} · No check-in`, second: '' }); gapStart = null; };
  for (let k = first; k <= last; k++) {
    const cks = s.posted.filter((c) => c.week === k);
    if (!cks.length && k !== w) { if (gapStart === null) gapStart = k; continue; }
    flushGap(k - 1);
    if (!cks.length) entries.push({ week: k, text: `Week ${k} · ${s.posted.length ? 'No check-in' : 'No check-in yet'}`, second: '' });
    for (const c of cks) entries.push({ week: k, text: `Week ${k} · ${STATUS_WORD[c.status] ?? c.status}${c.value !== null && c.value !== undefined ? ` · ${unitOf(g, c.value)}` : ''}${c.why ? ` · ${c.why}` : ''}`, second: `${personName(C, c.authorId)} · ${C.shortDay(C.dayNum(c.postedAt))}${c.backfilled ? ' · added later' : ''}`, kind: 'check-in' });
  }
  flushGap(last);
  for (const c of changes) entries.push({ week: C.S1.currentWeek(c.at), text: c.summary, second: `${personName(C, c.actorId)} · ${C.shortDay(C.dayNum(c.at))}`, kind: 'change', at: c.at });
  entries.sort((a, b) => b.week - a.week || (a.kind === 'change' ? -1 : 1));
  return `<section aria-label="History" data-part="History"><h2>History</h2><ul class="rows history">${entries.slice(0, 40).map((e) => `<li><span class="h1">${esc(e.text)}</span>${e.second ? `<br><span class="h2 quiet">${esc(e.second)}</span>` : ''}</li>`).join('')}</ul></section>`;
}

// ---------- Check-in ----------
export function checkInList(ctx) {
  const { C, viewer, m } = ctx;
  const w = C.S1.currentWeek(m);
  const mine = C.goalStates(m).filter((s) => s.g.ownerId === viewer && s.status !== 'done');
  if (!mine.length) return { title: 'Check-in', body: '<h1>Check-in</h1><p>You don’t own a goal to check in on. <a href="/goals?scope=all">See the goals</a></p>' };
  const toDo = mine.filter((s) => !s.posted.some((c) => c.week === w));
  const done = mine.filter((s) => s.posted.some((c) => c.week === w));
  const numberGoals = mine.filter((s) => s.g.kind !== 'milestone').length;
  return { title: 'Check-in', body: `<h1>Check-in</h1><p class="lede">Week ${w}: ${toDo.length ? `${plural(toDo.length, 'goal', 'goals')} to check in on, due by ${C.fmtDay(C.dueDay(w))}.` : 'every check-in is in.'}</p>
${toDo.length ? `<a class="btn primary" href="/check-in/${esc(toDo[0].g.id)}">Start with the first</a>` : ''}
<ul class="rows">${toDo.map((s) => `<li>${statusTag(s.status)} <a href="/check-in/${esc(s.g.id)}">${esc(s.g.title)}</a><br><span class="quiet">Last said: ${esc(s.latest?.why || (s.latest ? STATUS_WORD[s.latest.status] : 'nothing yet'))}</span></li>`).join('')}</ul>
${done.length ? `<h2>Done this week</h2><ul class="rows">${done.map((s) => `<li>${statusTag(s.status)} <a href="/goals/${esc(s.g.id)}">${esc(s.g.title)}</a></li>`).join('')}</ul>` : ''}
${numberGoals >= 2 ? '<p><a href="/quick-check-in">Or type all your numbers in one table</a></p>' : ''}` };
}
export function checkInForm(ctx, id, err = null, values = {}) {
  const { C, viewer, m } = ctx;
  const g = C.findGoal(id);
  if (!g || g.removedAt) return { notFound: true, title: 'Goal not found', body: '<h1>This goal doesn’t exist</h1>' };
  if (g.ownerId !== viewer) return { title: `Check in: ${g.title}`, focused: true, body: `<h1>Check in: ${esc(g.title)}</h1><p>Only ${esc(personName(C, g.ownerId))} checks in on this goal.</p><a href="/goals/${esc(g.id)}">Close</a>` };
  const w = C.S1.currentWeek(m);
  const s = C.stateOf(g.id, m);
  const plan = g.kind === 'metric' ? C.S1.planAt(C.S1.planAsOf(g, w), w) : null;
  const radio = (v, label) => `<label class="inline"><input type="radio" name="call" value="${v}"${values.call === v ? ' checked' : ''}> ${shape(v)} ${label}</label>`;
  const issues = (err?.issues || []).map((i) => `<p class="field-error">${esc(i.message)}</p>`).join('');
  return { title: `Check in: ${g.title}`, focused: true, body: `<p class="quiet">Week ${w}, due by ${C.fmtDay(C.dueDay(w))}</p><h1>${esc(g.title)}</h1>
${err ? `<div role="alert" class="msg-error">${esc(err.error)}</div>${issues}` : ''}
${form('/act/postCheckIn', `<input type="hidden" name="goalId" value="${esc(g.id)}">
${g.kind !== 'milestone' ? `<label for="value">What’s the number this week?</label><input id="value" name="value" inputmode="decimal" value="${esc(values.value ?? '')}">${plan !== null ? `<p class="quiet">The plan says ${esc(unitOf(g, Number(plan.toFixed(g.decimals ?? 0))))} for week ${w}.</p>` : ''}${parts(ctx, 'checkin.number', { goal: g, week: w })}` : ''}
<fieldset><legend>How is it going?</legend>${radio('on', 'On track')}${radio('risk', 'At risk')}${radio('off', 'Off track')}${radio('done', 'Done')}</fieldset>
<label for="why">Why <span class="quiet">· what happened this week</span></label><textarea id="why" name="why" rows="3">${esc(values.why ?? '')}</textarea>
<label for="greenerWhy">Why greener <span class="quiet">· only when you call it better than the numbers</span></label><textarea id="greenerWhy" name="greenerWhy" rows="2">${esc(values.greenerWhy ?? '')}</textarea>
<label for="cause">Cause <span class="quiet">· when it is behind or ahead</span></label><select id="cause" name="cause"><option value=""></option>${['Plan too aggressive', 'Delivery slower', 'Blocked by a dependency', 'External factor', 'Data problem', 'Something else', 'Plan too cautious', 'Change landed early', 'One-off, won’t last'].map((c) => `<option${values.cause === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
<label for="path">Path to green <span class="quiet">· when it is behind</span></label><textarea id="path" name="path" rows="2">${esc(values.path ?? '')}</textarea>
<label for="byWeek">Back on plan by week <span class="quiet">· when it is behind</span></label><select id="byWeek" name="byWeek"><option value=""></option>${Array.from({ length: C.WEEKS - w }, (_, k) => w + 1 + k).map((k) => `<option value="${k}"${String(values.byWeek) === String(k) ? ' selected' : ''}>Week ${k} · ${C.weekDates(k)}</option>`).join('')}</select>
<label for="next">Next step · optional</label><input id="next" name="next" value="${esc(values.next ?? '')}">
<div class="actions"><button class="primary" type="submit">Post the check-in</button><a href="/goals/${esc(g.id)}" data-close>Close</a></div>`, { cls: 'checkin' })}` };
}
export function receipt(ctx, goalId) {
  const { C, viewer, m } = ctx;
  const w = C.S1.currentWeek(m);
  const due = dueGoals(C, viewer, w, m);
  const ws = C.goalStates(m).ws;
  const firsts = due.map((g) => (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1))[0]);
  const allIn = due.length && firsts.every(Boolean);
  const { run, forgiven } = runOf(C, viewer, m);
  const left = due.filter((g, i) => !firsts[i]);
  const words = allIn ? receiptText(C, { total: due.length, after: firsts.filter((c) => C.dayNum(c.postedAt) > C.dueDay(w)).length, byDay: C.DAYS_NAME(C.dueDay(w)), held: false, run, forgiven, week: w, lastWeek: w >= C.WEEKS }) : `${plural(left.length, 'check-in', 'check-ins')} still to do this week.`;
  const g = C.findGoal(goalId);
  return { title: 'Check-in', focused: true, body: `<h1>Checked in for week ${w}</h1><p class="receipt">${esc(words)}</p><div class="actions">${left.length ? `<a class="btn primary" href="/check-in/${esc(left[0].id)}">Next: ${esc(left[0].title)}</a>` : ''}${g ? `<a class="btn" href="/goals/${esc(g.id)}">View the goal</a>` : ''}<a class="btn" href="/">Home</a></div>` };
}
export function quickCheckIn(ctx, err = null) {
  const { C, viewer, m } = ctx;
  const w = C.S1.currentWeek(m);
  const mine = C.goalStates(m).filter((s) => s.g.ownerId === viewer && s.g.kind !== 'milestone' && s.status !== 'done');
  if (!mine.length) return { title: 'Check-in, all in one table', focused: true, body: '<h1>Check-in, all in one table</h1><p>You don’t own a goal with a number to check in on.</p><a href="/check-in">Close</a>' };
  return { title: 'Check-in, all in one table', focused: true, body: `<h1>Type all your numbers in one table</h1><p class="lede">Week ${w}. Leave a number empty to skip that goal.</p>${err ? `<div role="alert" class="msg-error">${esc(err)}</div>` : ''}
${form('/act/quickCheckIn', `<table><thead><tr><th>Goal</th><th>Last number</th><th>This week</th></tr></thead><tbody>${mine.map((s) => `<tr><td>${statusTag(s.status)} ${esc(s.g.title)}</td><td>${esc(unitOf(s.g, s.posted.filter((c) => c.value !== null).pop()?.value))}</td><td><input name="v_${esc(s.g.id)}" aria-label="This week’s number for ${esc(s.g.title)}" inputmode="decimal"></td></tr>`).join('')}</tbody></table>${parts(ctx, 'checkin.table', { goals: mine.map((s) => s.g) })}<div class="actions"><button class="primary" type="submit">Post the numbers</button><a href="/check-in" data-close>Close</a></div>`)}` };
}

// ---------- New goal: four steps, each an address ----------
const STEPS = [['what', 'What'], ['who', 'Who and where'], ['measure', 'How it’s measured'], ['check', 'Check']];
export function newGoal(ctx, step, draft, err) {
  const { C, viewer, m } = ctx;
  const i = STEPS.findIndex(([id]) => id === step);
  const head = `<p class="quiet">New goal · step ${i + 1} of 4</p><h1>${STEPS[i][1]}</h1>${err ? `<div role="alert" class="msg-error">${esc(err)}</div>` : ''}`;
  const close = '<a href="/goals" data-close>Close and keep the draft</a>';
  const cont = (label = 'Continue') => `<div class="actions"><button class="primary" type="submit">${label}</button>${close}</div>`;
  let body;
  if (step === 'what') body = form('/goals/new/what', `<label for="title">Name it the way you’d say it</label><input id="title" name="title" value="${esc(draft.title)}" required minlength="3">
<fieldset><legend>What kind of goal is it?</legend>${[['metric', 'A number to move'], ['range', 'A number to keep in range'], ['milestone', 'Dated stages']].map(([v, l]) => `<label class="inline"><input type="radio" name="kind" value="${v}"${draft.kind === v ? ' checked' : ''}> ${l}</label><br>`).join('')}</fieldset>${cont()}`, { once: false });
  else if (step === 'who') {
    const owner = C.personById.get(draft.ownerId), team = C.teamById.get(draft.teamId), parent = draft.parentId && C.findGoal(draft.parentId);
    const lv = levelFor(C, draft, draft.levelByHand ? { level: draft.level } : {});
    const other = draft.ownerId !== viewer && owner ? `<p>${esc(owner.name.split(' ')[0])} will own it. After it is published, only ${esc(owner.name.split(' ')[0])} or an admin can change it.</p>` : '';
    body = form('/goals/new/who', `<p class="quiet">Everything here is needed unless it says optional.</p>
<label for="owner">Owner</label><p>${esc(owner?.name ?? '—')}</p><input id="owner" type="search" name="ownerQ" aria-label="Find the owner" placeholder="Type a name to change the owner" data-pick="person">${other}
<label for="team">Team</label><p>${esc(team?.name ?? '—')}</p><input id="team" type="search" name="teamQ" aria-label="Find the team" placeholder="Type a team to change it" data-pick="team">
<label for="level">Level</label><select id="level" name="level">${['', 'north-star', 'svp', 'team'].map((v) => `<option value="${v}"${(lv || '') === v ? ' selected' : ''}>${v ? LEVEL_WORD[v] : 'Choose a level.'}</option>`).join('')}</select>
<label for="parent">Feeds into · optional</label><p>${parent ? esc(`${parent.title} (${parent.key})`) : 'Nothing yet'}</p><input id="parent" type="search" name="parentQ" aria-label="Find the goal it feeds" placeholder="Type a goal’s name or key" data-pick="goal">
<label class="inline"><input type="checkbox" name="guardrail" value="1"${draft.guardrail ? ' checked' : ''}> It’s a guardrail · optional</label>${cont()}`, { once: false });
  } else if (step === 'measure') {
    const weeks = Array.from({ length: C.WEEKS + 1 }, (_, k) => k);
    const wkOpt = (name, val, label) => `<label for="${name}">${label}</label><select id="${name}" name="${name}"><option value="">${name === 'fromWeek' ? 'This week' : `The end of ${C.W.cycle.name}`}</option>${weeks.filter((k) => k >= 1).map((k) => `<option value="${k}"${String(val) === String(k) ? ' selected' : ''}>Week ${k} · ${C.weekDates(k)}</option>`).join('')}</select>`;
    if (draft.kind === 'range') body = form('/goals/new/measure', `<p class="quiet">Everything here is needed unless it says optional.</p><label for="unit">Unit · optional</label><input id="unit" name="unit" value="${esc(draft.unit)}"><label for="bound">Keep it</label><select id="bound" name="bound"><option value="atMost">At or under</option><option value="atLeast"${draft.bound === 'atLeast' ? ' selected' : ''}>At or over</option></select><label for="limit">Limit</label><input id="limit" name="limit" value="${esc(draft.limit)}" inputmode="decimal"><label for="margin">Warn within · optional</label><input id="margin" name="margin" value="${esc(draft.margin)}">${parts(ctx, 'goal.measure', { goal: null, kind: 'range' })}${cont()}`, { once: false });
    else if (draft.kind === 'milestone') body = form('/goals/new/measure', `<label for="s1">First stage</label><input id="s1" name="stage1" value="${esc(draft.stages?.[0]?.name ?? '')}"><label for="d1">Due</label><select id="d1" name="due1">${weeks.filter((k) => k >= 1).map((k) => `<option value="${k}"${String(draft.stages?.[0]?.dueWeek) === String(k) ? ' selected' : ''}>Week ${k} · ${C.weekDates(k)}</option>`).join('')}</select>${cont()}`, { once: false });
    else body = form('/goals/new/measure', `<p class="quiet">Everything here is needed unless it says optional.</p><label for="unit">Unit · optional</label><input id="unit" name="unit" value="${esc(draft.unit)}"><label for="start">Baseline: where it starts today</label><input id="start" name="start" value="${esc(draft.start)}" inputmode="decimal">${wkOpt('fromWeek', draft.fromWeek, 'From')}<label for="target">Target</label><input id="target" name="target" value="${esc(draft.target)}" inputmode="decimal">${wkOpt('endWeek', draft.endWeek, 'To')}<label for="definition">How it’s measured · optional</label><input id="definition" name="definition" value="${esc(draft.definition)}">${parts(ctx, 'goal.measure', { goal: null, kind: 'metric' })}${cont()}`, { once: false });
  } else {
    const r = readBack(C, draft, viewer, m, { workspaceName: ctx.wsName, draftGiven: draft.levelByHand ? { level: draft.level } : {} });
    const stepOf = { What: 'what', 'Who and where': 'who', 'Measured by': 'measure', 'Left as usual': draft.kind === 'milestone' ? 'who' : 'measure' };
    const rowId = { What: 'what', 'Who and where': 'who', 'Measured by': 'measured', 'Left as usual': 'usual', 'You said': 'said' };
    body = `<p>Nothing is saved until you publish.</p>${form('/goals/new/publish', `<div class="actions"><button class="primary" type="submit">Publish goal</button>${close}</div>`)}<ul class="goal-read-back rows" aria-label="Read back">${r.rows.map(([label, sentence]) => `<li data-row="${rowId[label]}"><span class="rr-label quiet">${esc(label)}</span><br><span class="rr-value">${esc(sentence)}</span>${stepOf[label] ? ` <a class="btn plain" href="/goals/new/${stepOf[label]}?back=check" aria-label="Change ${esc(label.toLowerCase())}">Change</a>` : ''}</li>`).join('')}</ul><h2>After you publish</h2><ul class="after-publish">${r.after.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  return { title: STEPS[i][1], focused: true, body: head + body };
}

// ---------- People and teams ----------
export function peopleScreen(ctx) {
  const { C, url } = ctx;
  const q = url.searchParams.get('q') || '';
  const r = search(personRows(C.W.people, C.teamById, q), q);
  const narrowed = !!q;
  return { title: 'People', body: `<h1>People</h1><nav class="tabs" aria-label="People and teams"><a href="/people" aria-current="page">People</a><a href="/teams">Teams</a></nav><div class="listbar"><form method="get" action="/people" role="search"><input type="search" name="q" value="${esc(q)}" aria-label="Find by name, job title or team" placeholder="Find by name, job title or team"></form></div>
${r.total ? `<p class="countline count-line">${esc(countLine(r.total, 'person', 'people', 'A to Z', narrowed, { from: 1, size: 50 }))}</p>` : `<p class="nothing">${esc(nothingLine('person', 'people', q, false, r.near))}</p><form method="get" action="/people"><button type="submit">Clear the search</button></form>`}
<ul class="rows">${r.rows.slice(0, 50).map((x) => `<li class="people-row"><a href="/people/${esc(x.id)}">${esc(x.name)}</a><br><span class="quiet">${esc(x.p.role || '')}${x.p.role ? ' · ' : ''}${esc(teamName(C, x.p.teamId))}</span></li>`).join('')}</ul>` };
}
export function personPage(ctx, id) {
  const { C, m } = ctx;
  const p = C.personById.get(id);
  if (!p) return { notFound: true, title: 'Person not found', body: '<h1>Person not found</h1>' };
  const goals = C.goalStates(m).filter((s) => s.g.ownerId === p.id);
  const leads = C.W.teams.filter((t) => t.leadId === p.id).map((t) => t.name);
  const first = p.name.split(' ')[0];
  const facts = `<ul class="facts person-facts"><li>${esc(p.role || 'No job title')}</li><li><a href="/teams/${esc(p.teamId)}">${esc(teamName(C, p.teamId))}</a>${leads.includes(teamName(C, p.teamId)) ? `, which ${esc(first)} leads` : ''}</li><li>${p.admin ? 'Admin.' : 'Member.'}</li>${p.leftAt ? '<li>Has left.</li>' : ''}</ul>`;
  return { title: p.name, body: `<h1>${esc(p.name)}</h1>${goals.length ? `<p><a href="/goals?scope=all&owner=${esc(p.id)}">See ${esc(first)}’s ${goals.length} goals</a></p>` : ''}${facts}${parts(ctx, 'people.person', { person: p })}<h2>${esc(first)}’s goals</h2>${goals.length ? `<ul class="rows">${goals.map((s) => goalRow(ctx, s)).join('')}</ul>` : '<p class="quiet">No goals.</p>'}` };
}
export function teamsScreen(ctx) {
  const { C } = ctx;
  return { title: 'Teams', body: `<h1>Teams</h1><nav class="tabs" aria-label="People and teams"><a href="/people">People</a><a href="/teams" aria-current="page">Teams</a></nav><ul class="rows">${teamRows(C.W.teams, C.personById).map((t) => `<li class="team-row"><a href="/teams/${esc(t.id)}">${esc(t.name)}</a><br><span class="quiet">${t.t.leadId ? `Led by ${esc(personName(C, t.t.leadId))}` : 'No lead'} · ${plural(C.W.people.filter((p) => p.teamId === t.id && !p.leftAt).length, 'person', 'people')}</span></li>`).join('')}</ul>` };
}
export function teamPage(ctx, id) {
  const { C, m } = ctx;
  const t = C.teamById.get(id);
  if (!t) return { notFound: true, title: 'Team not found', body: '<h1>Team not found</h1>' };
  const people = C.W.people.filter((p) => p.teamId === t.id && !p.leftAt);
  const goals = C.goalStates(m).filter((s) => s.g.teamId === t.id);
  return { title: t.name, body: `<h1>${esc(t.name)}</h1><p class="lede">${t.leadId ? `Led by ${esc(personName(C, t.leadId))}` : 'No lead'} · ${plural(people.length, 'person', 'people')} · <a href="/goals?scope=all&team=${esc(t.id)}">See its ${goals.length} goals</a></p><h2>People</h2><ul class="rows">${people.map((p) => `<li><a href="/people/${esc(p.id)}">${esc(p.name)}</a></li>`).join('')}</ul>${parts(ctx, 'people.team', { team: t })}<h2>Goals</h2><ul class="rows">${goals.map((s) => goalRow(ctx, s)).join('')}</ul>` };
}

// ---------- Activity and Data ----------
export function activity(ctx) {
  const { C, d, url } = ctx;
  const q = url.searchParams.get('q') || '';
  const all = [...(d.changes || [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  const rows = all.map((c) => ({ c, words: (q ? `${c.summary} ${personName(C, c.actorId)}` : '') }));
  const found = q ? rows.filter((r) => fold(r.words).includes(fold(q))) : rows;
  return { title: 'Activity', narrow: true, body: `<h1>Activity</h1><div class="listbar"><form method="get" action="/activity" role="search"><input type="search" name="q" value="${esc(q)}" aria-label="Find in the activity" placeholder="Find in the activity"></form></div>${found.length ? `<p class="countline">${esc(countLine(found.length, 'change', 'changes', 'newest first', !!q))}</p>` : `<p class="nothing">No change matches “${esc(q)}”.</p><a class="btn" href="/activity">Clear the search</a>`}<ul class="rows">${found.slice(0, 50).map(({ c }) => `<li>${esc(c.summary)}<br><span class="quiet">${esc(personName(C, c.actorId))} · ${esc(C.shortDay(C.dayNum(c.at)))}</span>${parts(ctx, 'activity.entry', { entry: c })}</li>`).join('')}</ul>` };
}
export function dataScreen(ctx) {
  const { C, m } = ctx;
  const states = C.goalStates(m);
  return { title: 'Data', wide: true, body: `<h1>Data</h1><div class="listbar"><span>Goals · ${states.length} rows</span>${parts(ctx, 'data.tools', { table: 'Goals', rows: states.map((s) => s.g) })}</div><table><thead><tr><th>Key</th><th>Goal</th><th>Owner</th><th>Team</th><th>Status</th></tr></thead><tbody>${states.map((s) => `<tr><td>${esc(s.g.key)}</td><td>${esc(s.g.title)}</td><td>${esc(personName(C, s.g.ownerId))}</td><td>${esc(teamName(C, s.g.teamId))}</td><td>${statusTag(s.status)}</td></tr>`).join('')}</tbody></table>` };
}

// ---------- Workspace ----------
const ADMIN_SECTIONS = new Set(['access', 'features']);
function workspaceMenu(ctx, current) {
  const secs = [['', 'About'], ['cycles', 'Cycles'], ['access', 'Access'], ['features', 'Features'], ['privacy', 'Privacy'], ['removed', 'Recently removed']];
  for (const s of ctx.state.platform.sections(ctx.on)) { const i = secs.findIndex(([id]) => id === s.after); secs.splice(i < 0 ? secs.length : i + 1, 0, [s.id, s.label]); }
  return `<nav><ul class="tabs" aria-label="Workspace sections" style="list-style:none;padding:0;flex-wrap:wrap">${secs.map(([id, label]) => `<li><a href="/workspace${id ? `/${id}` : ''}"${current === id ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('')}</ul></nav>`;
}
const adminsLine = (ctx) => { const a = ctx.C.W.people.filter((p) => p.admin && !p.leftAt).map((p) => p.name).sort(); return a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a.join(''); };
export function workspace(ctx, section = '') {
  const { C, m, d, isAdmin, state } = ctx;
  const sec = section || '';
  const modSec = state.platform.sections(ctx.on).find((s) => s.id === sec);
  const known = ['', 'cycles', 'access', 'features', 'privacy', 'removed'].includes(sec) || modSec;
  if (!known) return null;
  const title = sec ? `${SECTION_NAMES[sec] ?? modSec.label} · Workspace` : 'About · Workspace';
  const pageTitle = sec ? `${SECTION_NAMES[sec] ?? modSec.label} · Workspace` : 'Workspace';
  const head = `<h1>${esc(sec ? SECTION_NAMES[sec] ?? modSec.label : 'Workspace')}</h1>${sec ? workspaceMenu(ctx, sec) : ''}`;
  if ((ADMIN_SECTIONS.has(sec) || modSec?.admins) && !isAdmin) return { title: pageTitle, body: `${head}<p>${esc(SECTION_NAMES[sec] ?? modSec.label)} is for admins. The admins here are ${esc(adminsLine(ctx))}.</p><a href="/workspace">Workspace</a>`, back: { label: 'Workspace', to: '/workspace' } };
  let body = '';
  if (!sec) {
    const people = C.W.people.filter((p) => !p.leftAt);
    const days = cycleDays(C);
    const sort = [];
    if (isAdmin) {
      if (!C.W.goals.length) sort.push('There are no goals yet.');
      const admins = people.filter((p) => p.admin);
      if (admins.length === 1 && people.length >= 5) sort.push(`${admins[0].name} is the only admin of ${people.length} people.`);
      const noEmail = people.filter((p) => !p.email).length; if (noEmail) sort.push(`${plural(noEmail, 'person has', 'people have')} no email.`);
      const noTeam = people.filter((p) => !p.teamId).length; if (noTeam) sort.push(`${plural(noTeam, 'person is', 'people are')} in no team.`);
      for (const t of C.W.teams) if (!t.leadId && people.filter((p) => p.teamId === t.id).length >= 3) sort.push(`${t.name} has no lead.`);
    }
    const on = state.platform.mods.filter((x) => ctx.on.has(x.id)).map((x) => x.name);
    const fact = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
    body = `<p class="lede ws-role-line">${esc(ctx.wsName)} · you’re ${isAdmin ? 'an admin' : 'a member'} here</p>${sort.length ? `<section aria-label="To sort out"><h2>To sort out</h2><ul class="rows">${sort.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${sort.length > 3 ? `<p>and ${sort.length - 3} more</p>` : ''}</section>` : ''}${parts(ctx, 'workspace.about')}
<dl class="ws-facts">${fact('Name', `${esc(ctx.wsName)} · example data`)}${fact('People', `<a href="/people">${plural(people.length, 'person', 'people')}</a> in <a href="/teams">${plural(C.W.teams.length, 'team', 'teams')}</a>`)}${fact('Year', `<a href="/workspace/cycles">${esc(C.W.cycle.name)}, week ${C.S1.currentWeek(m)}; its wrap-up opens on ${esc(C.fmtDay(days.opens))}</a>`)}${fact('Admins', `<a href="/workspace/access">${esc(adminsLine(ctx))}</a>${isAdmin ? '' : '. Ask one of them to add someone, change a team or change a setting.'}`)}${fact('Features', `<a href="/workspace/features">On: ${on.length ? esc(on.join(', ')) : 'none'}</a>`)}${fact('Recording', '<a href="/workspace/privacy">Off</a>')}</dl>${workspaceMenu(ctx, sec)}`;
  } else if (sec === 'access') {
    const admins = C.W.people.filter((p) => p.admin && !p.leftAt).sort((a, b) => a.name.localeCompare(b.name));
    body = `<p class="lede">Admins can change the workspace, its people and teams, and switch features. An admin makes someone else one here.</p><h2>Admins</h2><ul class="rows">${admins.map((p) => `<li><a href="/people/${esc(p.id)}">${esc(p.name)}</a> ${form('/act/setAdmin', `<input type="hidden" name="personId" value="${esc(p.id)}"><input type="hidden" name="admin" value="0"><button class="plain" type="submit">Remove as admin</button>`)}</li>`).join('')}</ul><h2>Add an admin</h2>${form('/act/setAdmin', `<input type="hidden" name="admin" value="1"><label for="adm">Find a person</label><input id="adm" type="search" name="personQ" aria-label="Find a person to make an admin" data-pick="person"><button type="submit">Add an admin</button>`)}`;
  } else if (sec === 'cycles') {
    const st = cycleState(C, m);
    const days = cycleDays(C);
    const next = String(Number(C.W.cycle.name) + 1);
    const started = (d.cycles || []).filter((c) => c.startedFrom && !c.removedAt);
    body = `<ul class="rows">${(d.cycles || []).filter((c) => !c.removedAt).map((c) => `<li><strong>${esc(c.name)}</strong> · ${c.startedFrom ? `starts ${esc(C.fmtDay(C.dayNum(c.startDate) + 7))}` : { before: 'not started yet', running: `week ${C.S1.currentWeek(m)}`, ending: 'its last weeks', ended: 'has ended', closed: 'closed' }[st]}${c.startedFrom ? '' : parts(ctx, 'cycles.cycle', { cycle: c })}</li>`).join('')}</ul>
${started.length ? '' : isAdmin ? `<p><a class="btn${C.dayNum(m) >= days.opens ? ' primary' : ''}" href="/workspace/cycles/next">Start ${esc(next)}</a></p><p class="quiet">${esc(next)} can be started from ${esc(C.fmtDay(days.opens))}, when the wrap-up opens.</p>` : ''}`;
  } else if (sec === 'features') {
    const mods = state.platform.mods;
    const groups = GROUPS.map(([g, label]) => {
      const ms = mods.filter((x) => (x.group || 'tools') === g);
      if (!ms.length) return '';
      return `<section aria-label="${esc(label)}"><h2>${esc(label)}</h2><ul class="rows">${ms.map((x) => {
        const isOn = ctx.on.has(x.id), switchedOn = !(d.settings.modulesOff || []).includes(x.id);
        const needsOff = (x.needs || []).filter((n) => !ctx.on.has(n));
        const line = isOn ? state.platform.draw('features.line', new Set([x.id]), { data: d, workspace: ctx.wsName }) : '';
        return `<li data-module="${esc(x.id)}"><strong>${esc(x.name)}</strong><br><span class="quiet">${esc(x.summary)}</span>${line ? `<br>${esc(line)}` : ''}${needsOff.length ? `<br>${esc(words.offUntil(needsOff.map((n) => state.platform.byId.get(n)?.name ?? n).join(' and ')))}` : ''}${form('/act/setModule', `<input type="hidden" name="id" value="${esc(x.id)}"><input type="hidden" name="on" value="${switchedOn ? '0' : '1'}"><label class="inline"><input type="checkbox" ${switchedOn ? 'checked' : ''} onchange="this.form.submit()" aria-label="${esc(x.name)}"> ${esc(x.name)}</label> <span class="switch-word">${isOn ? 'On' : 'Off'}</span> <noscript><button type="submit">${switchedOn ? 'Switch off' : 'Switch on'}</button></noscript>`, { once: false })}</li>`;
      }).join('')}</ul></section>`;
    }).join('');
    body = `<section aria-label="How you work"><h2>How you work</h2><p>Check-ins every week, due by ${esc(C.DAYS_NAME(C.START + C.REVIEW_DAY))}.</p></section>${groups}<p class="quiet">Switching one off hides it and keeps what it saved. <a href="/workspace/privacy">Privacy</a> · <a href="/help/features">Help: Features</a></p>`;
  } else if (sec === 'privacy') {
    body = '<p>Faro keeps the goals, check-ins, asks and changes people make here, and who made each. Recording how the app is used is off. A feature switched off keeps what it saved.</p>';
  } else if (sec === 'removed') {
    const list = state.removed();
    body = list.length ? `<ul class="rows">${list.map((r) => `<li>${esc(r.kind === 'goals' ? 'Goal' : r.kind === 'checkIns' ? 'Check-in' : r.kind === 'views' ? 'View' : r.module ? state.platform.byId.get(r.module)?.name ?? r.module : r.kind)}: <strong>${esc(r.name)}</strong><br><span class="quiet">Removed by ${esc(personName(C, r.removedBy))} · ${esc(C.shortDay(C.dayNum(r.removedAt)))}</span> ${isAdmin ? form('/act/restoreRemoved', `<input type="hidden" name="kind" value="${esc(r.kind)}"><input type="hidden" name="id" value="${esc(r.id)}"><button type="submit">Restore</button>`) : ''}</li>`).join('')}</ul>` : '<p>Nothing was removed in the last 30 days.</p>';
  } else if (modSec) {
    body = state.platform.byId.get(modSec.module).sectionPage?.(ctx) ?? `<p>${esc(modSec.label)}: this section belongs to the ${esc(state.platform.byId.get(modSec.module).name)} module.</p>`;
  }
  return { title: pageTitle, body: head + body, back: sec ? null : null };
}
export function startNext(ctx) {
  const { C, m, isAdmin, on } = ctx;
  const rb = startReadBack(C, m, { wrapUpOn: on.has('wrap-up') });
  const r = ctx.state.dispatch(ctx.viewer, 'startNextCycle', {});
  return { title: 'Start the next year · Workspace', focused: true, body: `<h1>Start ${esc(rb.next)}</h1><p class="lede">${rb.total} goals in ${esc(C.W.cycle.name)}: every one is counted once.</p><ul class="rows">${rb.lines.map((l) => `<li><strong>${l.n}</strong> ${esc(l.says)}${l.sub ? `<br><span class="quiet">${esc(l.sub)}</span>` : ''}</li>`).join('')}</ul>${parts(ctx, 'cycles.start', { readBack: rb })}${r.whyNot ? `<p>${esc(r.whyNot)}</p>` : ''}${isAdmin && r.canStart ? form('/act/startNextCycle', `<input type="hidden" name="confirm" value="1"><div class="actions"><button class="primary" type="submit">Start ${esc(rb.next)}</button><a href="/workspace/cycles" data-close>Close</a></div>`) : '<a href="/workspace/cycles">Close</a>'}` };
}

// ---------- Settings, Help, What's new, More ----------
export function settings(ctx) {
  const { C, viewer } = ctx;
  const p = C.personById.get(viewer);
  return { title: 'Settings', narrow: true, body: `<h1>Settings</h1><section aria-label="You"><h2>You</h2><ul class="facts"><li>${esc(p.name)}</li><li>${esc(p.role || 'No job title')} · ${esc(teamName(C, p.teamId))}</li><li><a href="/people/${esc(p.id)}">Your page</a></li></ul>${ctx.isAdmin ? '' : `<p class="quiet">An admin (${esc(adminsLine(ctx))}) changes your name, job title or team.</p>`}</section>${parts(ctx, 'settings.you')}<section aria-label="Recording"><p><a href="/workspace/privacy">Recording is off: see Privacy</a></p></section><hr><section aria-label="Leave"><h2>Leave ${esc(ctx.wsName)}</h2>${form('/act/leaveWorkspace', `<label class="inline"><input type="checkbox" name="sure" value="1" required> I want to leave ${esc(ctx.wsName)}</label><div class="actions"><button type="submit">Leave this workspace</button></div>`)}</section>` };
}
export function helpScreen(ctx, id) {
  const { state } = ctx;
  const modArticles = state.platform.helpArticles(ctx.on);
  const articles = [...HELP];
  for (const a of modArticles) { const i = articles.findIndex((x) => x.id === a.id); if (i >= 0) articles[i] = a; else { const j = articles.findIndex((x) => x.id === a.after); articles.splice(j < 0 ? articles.length : j + 1, 0, a); } }
  if (!id) {
    const q = ctx.url.searchParams.get('q') || '';
    const found = q ? articles.filter((a) => fold(`${a.title} ${a.body.join(' ')}`).includes(fold(q))) : articles;
    return { title: 'Help', narrow: true, body: `<h1>Help</h1><div class="listbar"><form method="get" action="/help" role="search"><input type="search" name="q" value="${esc(q)}" aria-label="Find in Help" placeholder="Find in Help"></form></div>${found.length ? (q ? `<p class="countline">${esc(countLine(found.length, 'article', 'articles', '', true))}</p>` : '') : `<p class="nothing">No article matches “${esc(q)}”.</p><a class="btn" href="/help">Clear the search</a>`}<ul class="rows">${found.map((a) => `<li><a href="/help/${esc(a.id)}">${esc(a.title)}</a></li>`).join('')}</ul><p><a href="/whats-new">What’s new</a></p>` };
  }
  const a = articles.find((x) => x.id === id);
  if (!a) {
    const owner = state.platform.helpOwner(id);
    if (owner && !ctx.on.has(owner.id)) return { title: 'Help', narrow: true, body: `<h1>Help</h1><p>${esc(words.page(owner.name, ctx.wsName))}</p>` };
    return { notFound: true, title: 'Help', body: '<h1>Help</h1><p>There’s no such article.</p>' };
  }
  return { title: 'Help', narrow: true, body: `<p class="quiet">Help</p><h1>${esc(a.title)}</h1>${parts(ctx, 'help.article', { article: a.id })}${a.body.map((x) => `<p>${esc(x)}</p>`).join('')}${a.module ? `<p class="quiet">${esc(a.id)}, from the ${esc(state.platform.byId.get(a.module).name)} module.</p>` : ''}` };
}
export function whatsNew() {
  return { title: 'What’s new', narrow: true, body: `<h1>What’s new</h1><ul class="rows">${WHATS_NEW.map((e) => `<li id="${esc(e.id)}"><h2>${esc(e.title)}</h2><p class="quiet">${esc(e.date)}</p><ul>${e.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${e.help.length ? `<p>Help: ${e.help.map((h) => `<a href="/help/${esc(h)}">${esc(h)}</a>`).join(', ')}</p>` : ''}</li>`).join('')}</ul>` };
}
export function moreScreen(ctx, groupsHtml) {
  return { title: 'More', body: `<h1>More</h1><div class="more-list">${groupsHtml}</div>` };
}
export function notFound(ctx, sentence) {
  return { notFound: true, title: 'Page not found', body: `<h1>Page not found</h1>${sentence ? `<p>${esc(sentence)}</p>` : '<p>There’s nothing at this address.</p>'}<p><a href="/">Home</a></p>` };
}

// ---------- Find, from anywhere ----------
export function findGroups(ctx, q) {
  const { C, m } = ctx;
  if (!q.trim()) return '<p>Type a name, a key like G-48, or a few words.</p>';
  const groups = [];
  const g = search(goalRows(C.goalStates(m), C), q, { keyRow: true });
  if (g.total) groups.push(['Goals', g.total, g.rows.slice(0, keyOf(q) && g.total === 1 ? 1 : 3).map((r) => [`/goals/${r.id}`, `${STATUS_WORD[r.status]} · ${r.title} · ${r.key}`]), `/goals?scope=all&q=${encodeURIComponent(q)}`, 'goals']);
  const p = search(personRows(C.W.people, C.teamById, q), q);
  if (p.total) groups.push(['People', p.total, p.rows.slice(0, 3).map((r) => [`/people/${r.id}`, r.name]), `/people?q=${encodeURIComponent(q)}`, 'people']);
  const t = search(teamRows(C.W.teams, C.personById), q);
  if (t.total) groups.push(['Teams', t.total, t.rows.slice(0, 3).map((r) => [`/teams/${r.id}`, r.name]), '/teams', 'teams']);
  if (!groups.length) return `<p>Nothing matches “${esc(q)}”.</p>`;
  return groups.map(([label, n, rows, all, things]) => `<div role="group" aria-label="${label} · ${n}"><h3>${label} · ${n}</h3>${rows.map(([href, text]) => `<a role="option" href="${esc(href)}">${esc(text)}</a>`).join('')}${n > rows.length ? `<a role="option" href="${esc(all)}">See all ${n} ${things}</a>` : ''}</div>`).join('');
}

// ---------- Change a goal: one page, four sections ----------
export function editGoal(ctx, id) {
  const { C, viewer, isAdmin } = ctx;
  const g = C.findGoal(id);
  if (!g || g.removedAt) return null;
  if (g.ownerId !== viewer && !isAdmin) return { title: `Change ${g.title}`, focused: true, body: `<h1>Change ${esc(g.title)}</h1><p>Only ${esc(personName(C, g.ownerId))} or an admin can change it.</p><a href="/goals/${esc(g.id)}" data-close>Close</a>` };
  return { title: `Change ${g.title}`, focused: true, body: `<h1>Change ${esc(g.title)}</h1><nav aria-label="Sections"><a href="#definition">What it is</a> · <a href="#plan">Plan and target</a> · <a href="#owner">Owner and team</a> · <a href="#more">More details</a></nav>
<form method="post" action="/act/editGoal" data-save-back data-confirm-leave><input type="hidden" name="goalId" value="${esc(g.id)}">
<section id="definition"><h2>What it is</h2><label for="title">Name</label><input id="title" name="title" value="${esc(g.title)}"></section>
<section id="plan"><h2>Plan and target</h2><p>${esc(g.kind === 'metric' ? `From ${unitOf(g, g.plan.start)} to ${unitOf(g, g.plan.target)}` : g.kind === 'range' ? `Limit ${unitOf(g, g.range.limit)}` : 'Dated stages')}</p></section>
<section id="owner"><h2>Owner and team</h2><p>${esc(personName(C, g.ownerId))} · ${esc(teamName(C, g.teamId))}</p></section>
<section id="more"><h2>More details</h2><p>${esc(g.definition || 'Not described yet.')}</p></section>
<div class="actions" style="position:sticky;bottom:0;background:var(--bg)"><button class="primary" type="submit">Save changes</button><a href="/goals/${esc(g.id)}" data-close>Close and keep the draft</a></div></form>` };
}
export function printPage(ctx, id) {
  const { C, m } = ctx;
  const g = C.findGoal(id);
  if (!g || g.removedAt) return null;
  const s = C.stateOf(g.id, m);
  return { title: `${g.title}, to print`, focused: true, body: `<h1>${esc(g.title)}</h1><p>${s ? statusTag(s.status) : ''} <span class="gkey">${esc(g.key)}</span> · ${esc(personName(C, g.ownerId))}</p><p><a href="/goals/${esc(g.id)}">Close</a></p>` };
}

// Workspace → Features: a module's read-back before its switch acts (features.readBack).
export function featuresReadBack(ctx, mod, on, lines) {
  const name = mod.name;
  return { title: 'Features · Workspace', focused: true, body: `<h1>${esc(on ? `Switch ${name} back on in ${ctx.wsName}?` : `Switch off ${name} in ${ctx.wsName}?`)}</h1>${lines}${form('/act/setModule', `<input type="hidden" name="id" value="${esc(mod.id)}"><input type="hidden" name="on" value="${on ? '1' : '0'}"><input type="hidden" name="confirmed" value="1"><div class="actions"><button class="primary" type="submit">${esc(on ? `Switch on ${name}` : `Switch off ${name}`)}</button><a href="/workspace/features" data-close>Cancel</a></div>`)}` };
}
