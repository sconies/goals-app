// Faro, rebuilt: the web app and the AI tools' server. Usage: node app/server.mjs [port]   (FARO_WITHOUT=example leaves a module out)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { App, KIT } from './state.mjs';
import * as P from './pages.mjs';
import { mcpHandler } from './mcp.mjs';
import { makeIndex, findAnywhere, pageName, findGoal, keyOfSearch } from '../screens.mjs';
import { W_ } from '../platform.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const app = new App();

// Help: the kit's guide, article by article, plus the modules' articles (left out while a module is off)
const guide = fs.readFileSync(path.join(KIT, 'core/help-guide.md'), 'utf8');
const coreArticles = [];
for (const part of guide.split(/\n### /).slice(1)) {
  const [title, ...rest] = part.split('\n');
  const text = rest.join('\n').trim();
  const m = /^`([a-z0-9-]+)`\.\s*/.exec(text);
  const id = m ? m[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  coreArticles.push({ id, title: title.trim(), body: (m ? text.slice(m[0].length) : text).split(/\n## /)[0].replace(/^Routes:.*$/m, '').trim() });
}
// a module's own article replaces the core guide's of the same id, and leaves with the module
const helpArticles = () => [...coreArticles.filter((a) => !app.mods.code.some((m) => (m.help || []).some((x) => x.id === a.id))), ...app.registry.help(app.on)];
const mcp = mcpHandler(app, helpArticles);

const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const readBody = (req) => new Promise((res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => res(b)); });
const form = (b) => Object.fromEntries(new URLSearchParams(b));
// for a module's action: a field sent more than once (ticked boxes) comes as a list
const formAll = (b) => { const o = {}; for (const [k, v] of new URLSearchParams(b)) o[k] = k in o ? [].concat(o[k], v) : v; return o; };
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript' };

function send(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers }); res.end(body); }
const redirect = (res, to, cookie) => { res.writeHead(303, { Location: to, ...(cookie ? { 'Set-Cookie': cookie } : {}) }); res.end(); };
const drafts = new Map();
const cdrafts = new Map(); // viewer:goal → a check-in draft // viewer → New goal draft (kept on every change)

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const c = cookies(req);
  // who and when: ?as= and ?today= are kept in cookies for the tab's session
  const setCookies = [];
  let as = c.as || 'amara', today = c.today || '';
  if (url.searchParams.has('as')) { as = url.searchParams.get('as'); setCookies.push(`as=${as}; Path=/`); }
  if (url.searchParams.has('today')) { today = url.searchParams.get('today'); setCookies.push(`today=${today}; Path=/`); }
  app.now = today ? `${today}T12:00:00.000Z` : app.W.builtFor;
  if (req.method === 'POST' && !today) app.now = app.W.builtFor;
  const viewer = app.person(as) || app.person('amara');
  const ctx = { viewer };
  if (setCookies.length && req.method === 'GET' && !url.pathname.startsWith('/api')) {
    url.searchParams.delete('as'); url.searchParams.delete('today');
    res.writeHead(303, { Location: url.pathname + url.search, 'Set-Cookie': setCookies }); return res.end();
  }
  const p = url.pathname;
  if (p.startsWith('/app/')) {
    const f = path.join(here, 'public', p.slice(5));
    if (!f.startsWith(path.join(here, 'public')) || !fs.existsSync(f)) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); return res.end(fs.readFileSync(f));
  }
  if (p === '/api/mcp') {
    const body = req.method === 'POST' ? await readBody(req) : '';
    const r = await mcp(req, body, url);
    res.writeHead(r.status, { 'Content-Type': 'application/json', ...(r.headers || {}) });
    return res.end(r.json !== undefined ? JSON.stringify(r.json) : '');
  }
  if (p === '/api/reset' && req.method === 'POST') { app.reset(); drafts.clear(); cdrafts.clear(); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
  if (p === '/api/state') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ changes: app.W.changes, modulesOff: app.W.modulesOff || [], checkIns: app.W.checkIns.length, goals: app.W.goals.length, decisions: app.W.decisions.length, modules: app.W.modules, reviews: app.W.reviews, tokens: app.demoTokens })); }
  if (p === '/api/find') {
    const q = url.searchParams.get('q') || '';
    const index = makeIndex(app.W, app.S1, app.now);
    const groups = findAnywhere(index, q);
    const key = keyOfSearch(q);
    const out = groups.map((g) => ({ kind: g.kind, total: g.total, near: g.near, rows: g.rows.map((r) => ({ id: r.id, title: r.title, line: r.line, href: `/${g.kind === 'goal' ? 'goals' : g.kind === 'person' ? 'people' : 'teams'}/${r.id}` })) }));
    if (key) for (const g of out) if (g.kind === 'goal') { g.rows = g.rows.slice(0, 1); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ q, groups: out }));
  }
  if (p === '/api/pick') {
    const index = makeIndex(app.W, app.S1, app.now);
    const r = index.search(url.searchParams.get('kind'), { q: url.searchParams.get('q') || '', size: 50 });
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ total: r.total, near: r.near, rows: r.rows.map((x) => ({ id: x.id, title: x.title, line: x.line })) }));
  }

  // ---------- form posts ----------
  if (req.method === 'POST') {
    const raw = await readBody(req);
    const f = form(raw);
    if (p.startsWith('/act/')) {
      const action = p.slice(5);
      const input = action === 'setFeature' ? { id: f.id, on: f.on === 'true' } : app.registry.actions()[action] ? formAll(raw) : f;
      const r = app.run(viewer.id, action, input);
      if (action === 'setFeature') {
        const m = app.mods.facts.find((x) => x.id === f.id);
        const msg = r.error || (f.undo && m ? (input.on ? W_.undoOn(m.name) : W_.undoOff(m.name)) : r.message || '');
        return send(res, r.error ? 403 : 200, P.workspacePage(app, ctx, 'features', msg, { undo: !r.error && !f.undo && !r.unchanged ? { id: f.id, on: !input.on } : null }));
      }
      if (r.redirect) return redirect(res, r.redirect);
      if (r.error && r.again) return send(res, 422, P.shell(app, ctx, { address: req.headers.referer ? new URL(req.headers.referer).pathname : p, body: r.again.body, focus: !!r.again.focus }));
      if (r.error) return send(res, 400, P.simplePage(app, ctx, p, 'Not saved', `<p class="refused" role="alert">${P.h(r.error)}</p>`));
      if (action === 'stopGoal') return redirect(res, `/goals/${f.goalId}?stopped=1`);
      return redirect(res, req.headers.referer ? new URL(req.headers.referer).pathname + new URL(req.headers.referer).search : '/');
    }
    const ck = /^\/check-in\/([^/]+)$/.exec(p);
    if (ck) {
      const g = app.goal(ck[1]);
      if (f.close) { cdrafts.set(`${viewer.id}:${g.id}`, f); return redirect(res, '/check-in'); }
      const input = { goalId: g.id, week: app.S1.currentWeek(app.now), value: f.value, stages: f.stages, call: { on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done' }[f.call] || '', cause: f.cause, why: f.why, path: f.path, byWeek: f.byWeek };
      const r = app.run(viewer.id, 'checkIn', input);
      if (!r.saves) return send(res, 422, P.checkInForm(app, ctx, g, url, { input: f, issues: r.issues }));
      cdrafts.delete(`${viewer.id}:${g.id}`);
      return redirect(res, `/goals/${g.id}?posted=1`);
    }
    const ng = /^\/goals\/new\/(what|who|measure|check)$/.exec(p);
    if (ng) {
      const step = ng[1];
      const d = { ...(drafts.get(viewer.id) || {}), ...f };
      delete d.goto; delete d.publish;
      if (step === 'who' && !f.guardrail) d.guardrail = 'false';
      drafts.set(viewer.id, d);
      if (f.goto) return redirect(res, `/goals/new/${f.goto}`);
      if (step === 'what' && !String(d.title || '').trim()) return send(res, 422, P.newGoalPage(app, ctx, 'what', d, { issues: [{ message: 'Give it a name: say what you want to achieve.' }] }));
      if (step !== 'check') return redirect(res, `/goals/new/${P.NEW_STEPS[P.NEW_STEPS.indexOf(step) + 1]}`);
      const nd = P.normDraft(app, d, viewer.id);
      const r = app.run(viewer.id, 'saveGoal', { row: P.draftRow(app, nd), answers: Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('answer:')).map(([k, v]) => [k.slice(7), v])) });
      if (!r.saves) {
        // the questions (Checks) are answered once on the read-back: take them as answered here and save again
        const checks = r.issues.filter((i) => i.level === 'check');
        const musts = r.issues.filter((i) => i.level === 'must');
        if (!musts.length && checks.length) {
          const r2 = app.run(viewer.id, 'saveGoal', { row: P.draftRow(app, nd), answers: Object.fromEntries(checks.map((i) => [i.group, 'keep'])) });
          if (r2.saves) { drafts.delete(viewer.id); return redirect(res, `/goals/${r2.id}?published=1`); }
        }
        return send(res, 422, P.newGoalPage(app, ctx, 'check', d, { issues: r.issues }));
      }
      drafts.delete(viewer.id);
      return redirect(res, `/goals/${r.id}?published=1`);
    }
    return send(res, 405, 'Method not allowed');
  }

  // ---------- pages ----------
  const parts = p.split('/').filter(Boolean);
  const [a, b, cc] = parts;
  // a module's routes (with :params): Page not found with its sentence while it is off
  for (const m of app.mods.code) for (const r of m.routes || []) {
    const keys = [];
    const re = new RegExp('^' + r.path.replace(/:([A-Za-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    const hit = re.exec(p);
    if (!hit) continue;
    if (!app.on(m.id)) return send(res, 404, P.notFoundPage(app, ctx, p, W_.page(m.name, app.wsName)));
    const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(hit[i + 1])]));
    const out = m.page(app, viewer, { path: p, params, url });
    const o = typeof out === 'string' ? { body: out } : out;
    if (o.redirect) return redirect(res, o.redirect);
    return send(res, o.status || 200, P.shell(app, ctx, { address: p, body: o.body, name: o.title, focus: !!o.focus, backParent: o.back || (p === m.menu?.to ? { none: true } : { to: m.menu?.to, label: m.name }) }));
  }
  if (p === '/') return send(res, 200, P.homePage(app, ctx));
  if (p === '/goals' || p === '/watching') return send(res, 200, P.goalsPage(app, ctx, url));
  if (a === 'goals' && b === 'new') {
    if (!cc) return redirect(res, '/goals/new/what');
    const d = drafts.get(viewer.id) || {};
    const firstUnfilled = !d.title ? 'what' : null;
    if (firstUnfilled && cc !== 'what') return redirect(res, `/goals/new/${firstUnfilled}`);
    return send(res, 200, P.newGoalPage(app, ctx, cc, d));
  }
  if (a === 'goals' && b) {
    const g = findGoal(app.W, b);
    if (!g) return send(res, 404, P.shell(app, ctx, { address: p, body: '<div class="not-found"><h1>Goal not found</h1><p>No goal is at this address. It may have been removed.</p><a href="/goals">See every goal</a></div>' }));
    if (cc === 'edit') return send(res, 200, P.simplePage(app, ctx, p, `Change ${g.title}`, `<nav class="sections"><a href="#definition">What it is</a> <a href="#plan">Plan and target</a> <a href="#owner">Owner and team</a> <a href="#more">More details</a></nav><section id="definition"><h2>What it is</h2><p>${P.h(g.title)}</p></section><section id="plan"><h2>Plan and target</h2></section><section id="owner"><h2>Owner and team</h2></section><section id="more"><h2>More details</h2></section><a href="/goals/${g.id}" data-close>Close and keep the draft</a>`, { focus: true }));
    return send(res, 200, P.goalPage(app, ctx, g, url));
  }
  if (a === 'check-in' && !b) return send(res, 200, P.checkInList(app, ctx));
  if (a === 'check-in' && b) { const g = findGoal(app.W, b); if (!g) return send(res, 404, P.notFoundPage(app, ctx, p)); return send(res, 200, P.checkInForm(app, ctx, g, url)); }
  if (p === '/quick-check-in') return send(res, 200, P.simplePage(app, ctx, p, 'Check-in, all in one table', '<p>Type each goal’s number for this week in its row.</p>', { focus: true }));
  if (p === '/people') return send(res, 200, P.peoplePage(app, ctx, url));
  if (a === 'people' && b) { const x = app.person(b); return x ? send(res, 200, P.personPage(app, ctx, x)) : send(res, 404, P.simplePage(app, ctx, p, 'Person not found', '')); }
  if (p === '/teams') return send(res, 200, P.teamsPage(app, ctx, url));
  if (a === 'teams' && b) { const t = app.W.teams.find((x) => x.id === b); return t ? send(res, 200, P.teamPage(app, ctx, t)) : send(res, 404, P.simplePage(app, ctx, p, 'Team not found', '')); }
  if (p === '/activity') return send(res, 200, P.activityPage(app, ctx, url));
  if (p === '/data') return send(res, 200, P.simplePage(app, ctx, p, 'Data', `<p>${app.W.goals.length} goals, ${app.W.checkIns.length} check-ins, ${app.W.people.length} people.</p>${app.registry.place('data.tools', app.on, { app })}`, { backParent: { none: true } }));
  if (a === 'workspace') return send(res, 200, P.workspacePage(app, ctx, b || '', '', { confirm: url.searchParams.get('confirm') }));
  if (p === '/settings') return send(res, 200, P.simplePage(app, ctx, p, 'Settings', `<nav class="section-links"><a href="#you">You</a> <a href="#leave">Leave</a></nav><section id="you"><h2>You</h2><p>${P.h(viewer.name)}</p></section><section id="leave"><h2>Leave</h2></section>`, { backParent: { none: true } }));
  if (p === '/help') return send(res, 200, P.helpPage(app, ctx, url, helpArticles()));
  if (a === 'help' && b) {
    const art = helpArticles().find((x) => x.id === b);
    const mod = app.mods.code.find((m) => (m.help || []).some((x) => x.id === b));
    if (!art && mod) return send(res, 404, P.simplePage(app, ctx, p, mod.help.find((x) => x.id === b).title, `<p>${P.h(W_.page(mod.name, app.wsName))}</p>`));
    return art ? send(res, 200, P.articlePage(app, ctx, art)) : send(res, 404, P.notFoundPage(app, ctx, p));
  }
  if (p === '/whats-new') return send(res, 200, P.simplePage(app, ctx, p, 'What’s new', '<p>The core screens, rebuilt from the kit.</p>', { backParent: { to: '/help', label: 'Help' } }));
  if (p === '/research') return send(res, 200, P.simplePage(app, ctx, p, 'Research', '<p>No research session is running.</p>'));
  if (a === 'reviews') return send(res, 404, P.notFoundPage(app, ctx, p, W_.page('Reviews', app.wsName)));
  if (a === 'retro') return send(res, 200, P.simplePage(app, ctx, p, pageName(app.W, p), '<p>The wrap-up opens in the last two weeks of the year.</p>', { focus: true }));
  if (p === '/feedback' && app.on('feedback')) return send(res, 200, P.simplePage(app, ctx, p, 'Feedback', '<p>Nothing sent yet.</p>', { backParent: { none: true } }));
  return send(res, 404, P.notFoundPage(app, ctx, p + url.search, p === '/feedback' ? W_.page('Feedback', app.wsName) : ''));
}

const port = Number(process.argv[2] || process.env.PORT || 48731);
http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); send(res, 500, `<h1>Something went wrong</h1><pre>${P.h(e.stack)}</pre>`); })).listen(port, () => console.log(`Faro rebuilt on http://localhost:${port}`));
