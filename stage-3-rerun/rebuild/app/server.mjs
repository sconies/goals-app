// Faro's core, rebuilt: one server drawing every core screen, the module platform and the AI tools' server.
// node app/server.mjs [--port 47310] [--test]
//   FARO_MODULES_OFF=<ids|all>  start with these modules switched off;  FARO_WITHOUT=<ids>  build without them.
//   --test opens the test door (/__test/…): reset, load, commit, token. Never in production.
import http from 'node:http';
import { createState, WS_ID } from './state.mjs';
import { createMcp, hashToken, newToken } from './mcp.mjs';
import { page, esc, itemLabel, itemTo } from './html.mjs';
import * as S from './screens.mjs';
import { example, exampleTwo } from './modules/example.mjs';
import { pageName, backTo, moreRows, GROUP_NAMES, isForm, placeLabel, FIRST_PAGES } from '../s3/navigation.mjs';
import { personRows, teamRows, goalRows, search } from '../s3/finding.mjs';
import { words } from './platform.mjs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const PORT = Number(flag('--port') || process.env.PORT || 47310);
const TEST = args.includes('--test');
const ALL = [example, exampleTwo, ...(process.env.FARO_PROBE ? [(await import('../tests/probe.mjs')).probe] : [])];
const without = new Set((process.env.FARO_WITHOUT || '').split(',').filter(Boolean));
const installed = ALL.filter((m) => !without.has(m.id));
const offEnv = process.env.FARO_MODULES_OFF || '';
const startOff = offEnv === 'all' ? installed.map((m) => m.id) : offEnv.split(',').filter(Boolean);

const state = await createState({ installed, modulesOff: startOff });
const mcp = createMcp(state);
const drafts = new Map(); // New goal's draft, per viewer
const histories = new Map(); // each viewer's earlier addresses (the tab's history, for the back link)

const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const readBody = (req) => new Promise((res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => res(b)); });
const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers }); res.end(body); };
const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(body === null ? '' : JSON.stringify(body)); };
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };
const flashCookie = (f) => `flash=${encodeURIComponent(JSON.stringify(f))}; Path=/`;

function context(req, url) {
  const ck = cookies(req);
  if (url.searchParams.get('today')) state.today = url.searchParams.get('today');
  else if (ck.today) state.today = ck.today;
  const v = state.view();
  const d = v.d;
  const viewer = url.searchParams.get('as') || ck.viewer || 'rhea';
  const person = d.people.find((p) => p.id === viewer) || d.people[0];
  const m = state.moment();
  const on = v.on;
  const mods = state.platform.menuItems(on);
  const navOpts = { checkin: v.core.hasGoalToCheckIn(person.id, m), reviewsOn: on.has('reviews'), feedbackOn: on.has('feedback'), mods };
  const isAdmin = !!person.admin;
  const team = v.core.teamById.get(person.teamId)?.name ?? '';
  let flash = null;
  try { flash = ck.flash ? JSON.parse(ck.flash) : null; } catch { flash = null; }
  const views = (d.views || []).filter((x) => !x.removedAt && (x.ownerId === person.id || x.pinned));
  const due = v.core.goalStates(m).filter((s) => s.g.ownerId === person.id && s.flags.includes('due')).length;
  const menuCounts = { checkin: 0 };
  for (const mod of state.platform.mods) if (on.has(mod.id) && mod.parts?.['menu.count']) { const n = mod.parts['menu.count']({ viewer: person.id, data: d }); if (n) menuCounts[`module:${mod.id}`] = n; }
  return { state, req, url, viewer: person.id, person, d, C: v.core, m, on, mods, navOpts, isAdmin, wsName: state.wsName(), viewerName: person.name, viewerLine: isAdmin ? `Admin · ${team}` : team, flash, views, address: url.pathname + url.search, menuCounts: { ...menuCounts, checkin: due } };
}

// The names a page is called by, with what the screen hands it (PlaceNames): a switched-off module's addresses are off.
function namesFor(ctx) {
  const n = ctx.C.names();
  return { ...n, review: (id) => (ctx.on.has('reviews') ? n.review(id) : null),
    modulePage: (path) => { const r = state.platform.route(path); return r && ctx.on.has(r.module.id) ? r.module.navigation?.[0]?.label ?? r.module.name : null; },
    off: (path) => { const r = state.platform.route(path); return !!r && !ctx.on.has(r.module.id); },
    sectionLabel: (id) => state.platform.sections(ctx.on).find((s) => s.id === id)?.label };
}

function render(res, ctx, scr, headers = {}) {
  if (!scr) scr = S.notFound(ctx);
  const names = namesFor(ctx);
  const address = ctx.url.pathname + (ctx.url.search || '');
  const title = scr.titleOverride || pageName(address, names);
  // the server draws the parent; the page's own script swaps in the tab's history (rule 4)
  const back = scr.back !== undefined && scr.back !== null ? scr.back : backTo(address, [], names, ['/more']);
  ctx.isForm = isForm(ctx.url.pathname) || !!scr.focused;
  ctx.isFirst = FIRST_PAGES.includes(ctx.url.pathname);
  ctx.placeLabel = placeLabel(address, names);
  const out = page({ title, body: scr.body, ctx, wide: scr.wide, narrow: scr.narrow, focused: scr.focused, back: scr.focused ? null : back, status: scr.notFound ? 404 : 200 });
  // remember this tab's pages for the back link
  const h = histories.get(ctx.viewer) || [];
  if (h[h.length - 1] !== address) h.push(address);
  histories.set(ctx.viewer, h.slice(-30));
  send(res, out.status, out.html, { 'Set-Cookie': ['flash=; Path=/; Max-Age=0', `today=${state.today}; Path=/`, `viewer=${ctx.viewer}; Path=/`], ...headers });
}

const ACTIONS_AFTER = {
  editGoal: (r, input) => `/goals/${input.goalId}`,
  postCheckIn: (r, input) => `/check-in/done?goal=${encodeURIComponent(input.goalId)}`,
  saveGoal: (r) => `/goals/${r.goal.id}`,
  stopGoal: () => '/goals', deleteGoal: () => '/goals',
  saveView: (r, input) => input.address,
  setModule: () => '/workspace/features', restoreRemoved: () => '/workspace/removed', setAdmin: () => '/workspace/access',
  startNextCycle: () => '/workspace/cycles', leaveWorkspace: () => '/',
};

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // ---- the AI tools' server ----
  if (path === '/api/mcp') {
    if (req.method === 'GET' && url.searchParams.has('check')) return json(res, 200, { ok: true, database: true, pictures: false, problems: [] });
    const raw = await readBody(req);
    const r = mcp.handle({ method: req.method, auth: req.headers.authorization, tokenParam: url.searchParams.get('token'), raw });
    return json(res, r.status, r.body, r.headers || {});
  }
  // ---- the test door: only when started with --test ----
  if (path.startsWith('/__test/')) {
    if (!TEST) return send(res, 404, 'Page not found');
    const body = req.method === 'POST' ? JSON.parse((await readBody(req)) || '{}') : {};
    if (path === '/__test/reset') { state.reset(body.modulesOff ?? startOff); drafts.clear(); histories.clear(); if (body.today) state.today = body.today; return json(res, 200, { ok: true }); }
    if (path === '/__test/load') return json(res, 200, state.data(), { 'X-Faro-Run': process.env.FARO_RUN_ID || '' });
    if (path === '/__test/commit') { state.save(body.actor || 'amara', body.records || {}, body.change || null); return json(res, 200, { ok: true }); }
    if (path === '/__test/token') { const t = newToken(); state.save(body.actor || 'amara', { tokens: [{ id: state.ids('tok'), hash: hashToken(t), personId: body.personId || 'amara', name: body.name || 'Test token', createdBy: body.actor || 'amara', createdAt: state.now(), revokedAt: body.revoked ? state.now() : null }] }, null); return json(res, 200, { token: t }); }
    if (path === '/__test/revoke') { const d = state.data(); const t = (d.tokens || []).find((x) => x.hash === hashToken(body.token)); if (t) state.save('amara', { tokens: [{ ...t, revokedAt: state.now() }] }, null); return json(res, 200, { ok: !!t }); }
    return json(res, 404, { error: 'No such door.' });
  }
  const ctx = context(req, url);
  // ---- reads a page fetches ----
  if (path === '/api/find') return send(res, 200, S.findGroups(ctx, url.searchParams.get('q') || ''));
  if (path === '/api/pick') {
    const q = url.searchParams.get('q') || '', kind = url.searchParams.get('kind');
    const rows = kind === 'person' ? search(personRows(ctx.C.W.people, ctx.C.teamById, q), q).rows.map((r) => [r.id, r.name]) : kind === 'team' ? search(teamRows(ctx.C.W.teams, ctx.C.personById), q).rows.map((r) => [r.id, r.name]) : search(goalRows(ctx.C.goalStates(ctx.m), ctx.C), q, { keyRow: true }).rows.map((r) => [r.id, `${r.title} (${r.key})`]);
    return json(res, 200, { total: rows.length, rows: rows.slice(0, 50) });
  }
  // ---- saves: one dispatcher ----
  if (req.method === 'POST') {
    const input = Object.fromEntries(new URLSearchParams(await readBody(req)));
    if (path === '/undo') { const r = state.undo(ctx.viewer, input.id); return redirect(res, req.headers.referer ? new URL(req.headers.referer).pathname + new URL(req.headers.referer).search : '/', { 'Set-Cookie': flashCookie({ message: r.error || r.message }) }); }
    if (path.startsWith('/goals/new/')) return newGoalPost(req, res, ctx, path.split('/')[3], input);
    const name = path.replace(/^\/act\//, '');
    if (name === 'quickCheckIn') {
      const vals = Object.entries(input).filter(([k, v]) => k.startsWith('v_') && v.trim());
      if (!vals.length) return render(res, ctx, S.quickCheckIn(ctx, 'Type at least one number.'));
      for (const [k, v] of vals) { const r = state.dispatch(ctx.viewer, 'postCheckIn', { goalId: k.slice(2), value: v.trim(), confirm: true }); if (r.error) return render(res, ctx, S.quickCheckIn(ctx, `${state.findGoal(k.slice(2))?.title}: ${r.error}`)); }
      return redirect(res, '/check-in/done', { 'Set-Cookie': flashCookie({ message: `Posted ${vals.length} numbers.` }) });
    }
    if (name === 'setAdmin' && input.personQ) { const r = search(personRows(ctx.C.W.people, ctx.C.teamById, input.personQ), input.personQ).rows; input.personId = r[0]?.id; }
    if (name === 'setModule') {
      input.on = input.on === '1';
      const mod = state.platform.byId.get(input.id);
      const lines = mod && mod.parts?.['features.readBack'] ? mod.parts['features.readBack']({ data: ctx.d, workspace: ctx.wsName, on: input.on }) : '';
      if (lines && input.confirmed !== '1') return render(res, ctx, S.featuresReadBack(ctx, mod, input.on, lines));
    }
    if (name === 'setAdmin') input.admin = input.admin === '1';
    if (name === 'startNextCycle') input.confirm = input.confirm === '1';
    const r = state.dispatch(ctx.viewer, name, input);
    if (r.error) {
      if (name === 'postCheckIn') return render(res, ctx, S.checkInForm(ctx, input.goalId, r, input));
      return redirect(res, req.headers.referer ? new URL(req.headers.referer).pathname + new URL(req.headers.referer).search : '/', { 'Set-Cookie': flashCookie({ message: r.error }) });
    }
    const to = (ACTIONS_AFTER[name] || ((x, i) => (i.goalId ? `/goals/${i.goalId}` : '/')))(r, input);
    return redirect(res, to, { 'Set-Cookie': flashCookie({ message: r.message, undo: r.changeId }) });
  }
  // ---- pages ----
  const parts = path.split('/').filter(Boolean);
  const modRoute = state.platform.route(path);
  if (modRoute) {
    if (!ctx.on.has(modRoute.module.id)) return render(res, ctx, S.notFound(ctx, words.page(modRoute.module.name, ctx.wsName)));
    if (modRoute.redirect) return redirect(res, modRoute.redirect);
    const out = modRoute.handler({ data: ctx.d, params: modRoute.params, viewer: ctx.viewer, h: { list: (items, none) => (items.length ? `<ul class="rows">${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : `<p class="quiet">${none}</p>`), goalTitle: (id) => ctx.C.goalById.get(id)?.title ?? id } });
    return render(res, ctx, out);
  }
  if (path === '/workspace/people') { const t = url.searchParams.get('team'); return redirect(res, t && t !== '-' ? `/teams/${encodeURIComponent(t)}` : t === '-' ? '/people?team=-' : '/people'); }
  if (path === '/workspace/teams') return redirect(res, '/teams');
  let scr = null;
  if (path === '/') scr = S.home(ctx);
  else if (path === '/goals' || path === '/watching') scr = path === '/watching' ? null : S.goalsScreen(ctx);
  else if (parts[0] === 'goals' && parts[1] === 'new') {
    const d = drafts.get(ctx.viewer) || blankDraft(ctx);
    drafts.set(ctx.viewer, d);
    if (!parts[2]) return redirect(res, '/goals/new/what');
    if (!['what', 'who', 'measure', 'check'].includes(parts[2])) scr = null;
    else scr = S.newGoal(ctx, parts[2], d);
  } else if (parts[0] === 'goals' && parts.length === 2) scr = S.goalPage(ctx, parts[1]);
  else if (parts[0] === 'goals' && parts[2] === 'print' && parts.length === 3) scr = S.printPage(ctx, parts[1]);
  else if (parts[0] === 'goals' && parts[2] === 'edit' && parts.length === 3) scr = S.editGoal(ctx, parts[1]);
  else if (path === '/check-in') scr = S.checkInList(ctx);
  else if (path === '/check-in/first') { const w = ctx.C.S1.currentWeek(ctx.m); const s = ctx.C.goalStates(ctx.m).find((x) => x.g.ownerId === ctx.viewer && x.status !== 'done' && !x.posted.some((c) => c.week === w)); return redirect(res, s ? `/check-in/${s.g.id}` : '/check-in'); }
  else if (path === '/check-in/done') scr = S.receipt(ctx, url.searchParams.get('goal'));
  else if (parts[0] === 'check-in' && parts.length === 2) scr = S.checkInForm(ctx, parts[1]);
  else if (path === '/quick-check-in') scr = S.quickCheckIn(ctx);
  else if (path === '/people') scr = S.peopleScreen(ctx);
  else if (parts[0] === 'people' && parts.length === 2) scr = S.personPage(ctx, parts[1]);
  else if (path === '/teams') scr = S.teamsScreen(ctx);
  else if (parts[0] === 'teams' && parts.length === 2) scr = S.teamPage(ctx, parts[1]);
  else if (path === '/activity') scr = S.activity(ctx);
  else if (path === '/data') scr = S.dataScreen(ctx);
  else if (path === '/workspace/cycles/next') scr = S.startNext(ctx);
  else if (parts[0] === 'workspace' && parts.length <= 2) scr = S.workspace(ctx, parts[1] === 'overview' ? '' : parts[1] || '');
  else if (path === '/settings') scr = S.settings(ctx);
  else if (path === '/help') scr = S.helpScreen(ctx);
  else if (parts[0] === 'help' && parts.length === 2) scr = S.helpScreen(ctx, parts[1]);
  else if (path === '/whats-new') scr = S.whatsNew(ctx);
  else if (path === '/more') { const groups = moreRows(ctx.navOpts); scr = S.moreScreen(ctx, groups.map((g) => `<ul class="rows" aria-label="more">${g.map((id) => `<li><a href="${esc(itemTo(id, ctx.mods))}">${esc(itemLabel(id, ctx.mods))}</a></li>`).join('')}</ul>`).join('')); scr.titleOverride = 'More'; }
  render(res, ctx, scr);
}

function blankDraft(ctx) {
  return { kind: 'metric', title: '', ownerId: ctx.viewer, teamId: ctx.person.teamId, level: 'team', levelByHand: false, guardrail: false, parentId: '', alsoHelps: [], unit: '', decimals: '', start: '', target: '', shape: 'straight', fromWeek: '', endWeek: '', bound: 'atMost', limit: '', margin: '', stages: [{ id: 's1', name: '', dueWeek: '' }], definition: '', effect: '', whyHelps: '', points: {}, source: '', lower: '' };
}
function newGoalPost(req, res, ctx, step, input) {
  const d = drafts.get(ctx.viewer) || blankDraft(ctx);
  const next = { what: 'who', who: 'measure', measure: 'check' }[step];
  const C = ctx.C;
  if (step === 'what') {
    if (!input.title || input.title.trim().length < 3) return render(res, ctx, S.newGoal(ctx, 'what', { ...d, ...input }, 'Give the goal a name of at least three characters.'));
    d.title = input.title.trim(); d.kind = input.kind || d.kind;
  } else if (step === 'who') {
    if (input.ownerQ) { const p = search(personRows(C.W.people, C.teamById, input.ownerQ), input.ownerQ).rows[0]; if (p) { d.ownerId = p.id; if (!d.teamByHand) d.teamId = p.p.teamId; } }
    if (input.teamQ) { const t = search(teamRows(C.W.teams, C.personById), input.teamQ).rows[0]; if (t) { d.teamId = t.id; d.teamByHand = true; } }
    if (input.parentQ) { const g = search(goalRows(C.goalStates(ctx.m), C), input.parentQ, { keyRow: true }).rows[0]; if (g) d.parentId = g.id; }
    if (input.level) { d.level = input.level; d.levelByHand = true; }
    d.guardrail = input.guardrail === '1';
    if (input.ownerQ || input.teamQ || input.parentQ) { drafts.set(ctx.viewer, d); return redirect(res, '/goals/new/who'); }
  } else if (step === 'measure') {
    for (const k of ['unit', 'start', 'target', 'fromWeek', 'endWeek', 'limit', 'margin', 'bound', 'definition']) if (k in input) d[k] = input[k];
    if (input.stage1 !== undefined) d.stages = [{ id: 's1', name: input.stage1, dueWeek: input.due1 }];
    if (d.kind === 'metric' && (d.start === '' || d.target === '')) return render(res, ctx, S.newGoal(ctx, 'measure', d, d.start === '' ? 'Enter where it starts today.' : 'Enter the target.'));
    if (d.kind === 'metric' && Number(d.start) === Number(d.target)) return render(res, ctx, S.newGoal(ctx, 'measure', d, `The target is the same as today (${d.start}). To hold a number where it is, make this a number to keep in range.`));
    if (d.kind === 'range' && d.limit === '') return render(res, ctx, S.newGoal(ctx, 'measure', d, 'Enter the limit.'));
  } else if (step === 'publish') {
    const r = state.dispatch(ctx.viewer, 'saveGoal', { draft: d, confirm: true });
    if (r.error) return render(res, ctx, S.newGoal(ctx, 'check', d, r.error));
    drafts.delete(ctx.viewer);
    return redirect(res, `/goals/${r.goal.id}`, { 'Set-Cookie': flashCookie({ message: r.message, undo: r.changeId }) });
  }
  drafts.set(ctx.viewer, d);
  return redirect(res, `/goals/new/${next}`);
}

const server = http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); send(res, 500, `<h1>Something went wrong</h1><p>${esc(e.message)}</p>`); }));
server.listen(PORT, '127.0.0.1', () => console.log(`Faro (rebuild) on http://127.0.0.1:${PORT}${TEST ? ' with the test door open' : ''}; modules installed: ${installed.map((m) => m.id).join(', ') || 'none'}; off: ${startOff.join(', ') || 'none'}`));
