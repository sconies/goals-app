// Stage 8's exit criteria, one test per criterion, each with Reviews on, switched off, and left out of the build
// (FARO_WITHOUT=reviews). Run: node --test modules/reviews/exit.test.mjs   (from rebuild/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { makeS1 } from '../../rules.mjs';
import { dueWords, heldOnDueDay, switchOffReadBack, workbookShape, importNotice, writesReviews, agenda } from './rules.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, '../..');
const WS = 'Platform Engineering';
const SENT_PAGE = `Reviews is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const SENT_ACTION = `Reviews is switched off in ${WS}. An admin can switch it on in Workspace, under Features.`;
const SENT_TOOL = (t) => `Reviews is switched off in ${WS}, so ${t} can’t be used there. An admin can switch it on in Workspace, under Features.`;
const TOOLS = ['list_reviews', 'get_review', 'review_call', 'unmark_reviewed', 'save_review', 'end_review', 'delete_review'];

// a kept-alive socket the server closed while a long test ran fails once; ask again on a fresh one
const fetch = async (u, o) => { try { return await globalThis.fetch(u, o); } catch { return globalThis.fetch(u, o); } };
const servers = {};
async function start(name, port, env = {}) {
  const s = spawn(process.execPath, [path.join(ROOT, 'app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  const up = await new Promise((r) => { s.stdout.once('data', () => r(true)); s.once('exit', () => r(false)); });
  if (!up) throw new Error(`the app (${name}) did not start`);
  servers[name] = { s, base: `http://localhost:${port}` };
}
const B = (n) => servers[n].base;
const strip = (t) => t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, '’').replace(/\s+/g, ' ');
const mainOf = (t) => strip((/<main[\s\S]*<\/main>/.exec(t) || [''])[0]);
async function get(n, p, as = 'amara', today = '') { const r = await fetch(B(n) + p, { headers: { cookie: `as=${as}${today ? `; today=${today}` : ''}` }, redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; }
async function post(n, p, body, as = 'amara', today = '') { const r = await fetch(B(n) + p, { method: 'POST', headers: { cookie: `as=${as}${today ? `; today=${today}` : ''}`, 'content-type': 'application/x-www-form-urlencoded', referer: B(n) + '/' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; }
const state = async (n) => (await fetch(`${B(n)}/api/state`)).json();
const reset = (n) => fetch(`${B(n)}/api/reset`, { method: 'POST' });
async function tool(n, name, args = {}, as = 'amara') {
  const token = (await state(n)).tokens[as];
  const r = await fetch(`${B(n)}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  const j = await r.json();
  return j.result ? { isError: j.result.isError, text: j.result.content[0].text } : { isError: true, text: j.error.message };
}
const off = (n) => post(n, '/act/setFeature', { id: 'reviews', on: 'false' });
const on = (n) => post(n, '/act/setFeature', { id: 'reviews', on: 'true' });
// each test runs "on", "off" (switched off on Features) and "out" (left out of the build)
async function modes(fn) {
  for (const mode of ['on', 'off', 'out']) {
    const n = mode === 'out' ? 'out' : 'main';
    await reset(n);
    if (mode === 'off') await off(n);
    await fn(mode, n);
  }
  await reset('main');
}

before(async () => { await start('main', 47821); await start('out', 47822, { FARO_WITHOUT: 'reviews' }); });
after(() => { for (const x of Object.values(servers)) x.s.kill(); });

const W0 = JSON.parse(fs.readFileSync(path.resolve(ROOT, '../spec/conformance/workspace.json'), 'utf8'));
const S1 = makeS1(W0);

test('criterion 1: its requirements hold', async () => {
  await modes(async (mode, n) => {
    const list = await get(n, '/reviews');
    if (mode !== 'on') {
      assert.equal(list.status, 404);
      const r = await post(n, '/act/saveReview', { name: 'Ops sync', everyWeeks: '2', weekday: '1', levels: 'svp', people: 'amara' });
      assert.ok(!(await state(n)).modules.reviews, 'no module state');
      assert.ok(mode === 'out' || r.text.includes(SENT_ACTION), `refused while ${mode}`);
      return;
    }
    // REVIEW-LIST-STATE: every review says where this session stands, when it was last held and how many actions are open
    const t = mainOf(list.text);
    for (const r of W0.reviews) assert.ok(new RegExp(`${r.name.replace('&', '&')}[^·]*· (Not held yet|In progress · \\d+ of \\d+ reviewed|Held \\w{3} \\d+ \\w{3}|Next on [^·]+)`).test(t), `${r.name} says its state`);
    assert.ok(/\d+ open actions?/.test(t), 'open actions counted');
    // REVIEW-SETUP: anyone sets one up (rhea is not an admin)
    const made = await post(n, '/act/saveReview', { name: 'Ops sync', everyWeeks: '2', weekday: '1', levels: 'svp', people: 'rhea, tariq' }, 'rhea');
    assert.equal(made.status, 303); assert.match(made.location, /^\/reviews\/ops-sync/);
    assert.ok((await get(n, '/reviews/ops-sync', 'rhea')).text.includes('Every 2 weeks, Tuesdays'));
    assert.match((await post(n, '/act/saveReview', { name: 'Bad', everyWeeks: '3', levels: 'svp' }, 'rhea')).text, /every 1, 2 or 4 weeks/);
    // REVIEW / REVIEW-AGENDA: worst and stalest first, one line per goal with status, name and key; the walk has next and previous
    const ag = agenda(W0, S1, W0.reviews[0], W0.builtFor);
    const firstNeedsIdx = ag.findIndex((x) => !x.needs);
    assert.ok(ag.slice(firstNeedsIdx).every((x) => !x.needs), 'goals needing attention come first');
    const page = await get(n, '/reviews/weekly');
    assert.equal((page.text.match(/class="agenda-row"/g) || []).length, ag.length, 'one line per goal');
    const walk = await get(n, `/goals/${ag[1].g.id}?review=weekly`);
    assert.ok(/rel="prev"/.test(walk.text) && /rel="next"/.test(walk.text), 'previous and next');
    // REVIEW-SPEAK: only someone in it, or an admin, speaks for it, app and AI tools alike
    const refused = await post(n, '/act/reviewCall', { reviewId: 'weekly', goalId: 'ns-lead', call: 'note', text: 'Looks fine' }, 'oskar');
    assert.match(refused.text, /Only the people in Platform leadership weekly, or an admin, can speak for it\./);
    assert.match((await tool(n, 'review_call', { review_id: 'weekly', goal_id: 'ns-lead', call: 'note', text: 'x' }, 'oskar')).text, /Only the people in Platform leadership weekly/);
    assert.ok(/Ask Amara to add you/.test(mainOf((await get(n, '/reviews/weekly', 'oskar')).text)) && !/>Join</.test((await get(n, '/reviews/weekly', 'oskar')).text), 'its page says who can add you, and offers no Join');
    // REVIEW-DECIDE: an off-track goal leaves the walk with a decision
    const g = ag.find((x) => x.status === 'off').g;
    assert.match((await post(n, '/act/markReviewed', { reviewId: 'weekly', goalId: g.id })).text, /agree a next step with who and by when, or accept the risk/);
    await post(n, '/act/reviewCall', { reviewId: 'weekly', goalId: g.id, call: 'action', text: 'Book the vendor call', who: g.ownerId, byWeek: '47' });
    assert.equal((await post(n, '/act/markReviewed', { reviewId: 'weekly', goalId: g.id })).status, 303);
    // REVIEW-RUN: what was said is its summary; owners see questions and actions on their goal page
    await post(n, '/act/reviewCall', { reviewId: 'weekly', goalId: g.id, call: 'question', text: 'When does the fix land?' });
    const sum = mainOf((await get(n, '/reviews/weekly/summary')).text);
    assert.ok(sum.includes('Book the vendor call') && sum.includes('When does the fix land?'));
    assert.ok(mainOf((await get(n, `/goals/${g.id}`, g.ownerId)).text).includes('When does the fix land?'));
    // asks wait on the owner's Home
    assert.ok(mainOf((await get(n, '/', g.ownerId)).text).includes('When does the fix land?') || mainOf((await get(n, '/', g.ownerId)).text).includes('Book the vendor call'));
  });
});

test('criterion 2: its journeys and checks can be done (the journeys this build runs, which fail when a check fails)', () => {
  const r = spawnSync(process.execPath, [path.join(here, 'journeys.mjs'), 'U103', 'U104', 'U154', 'U155', 'U13', 'N21'], { cwd: ROOT, encoding: 'utf8', timeout: 600000, env: { ...process.env, JOURNEY_PORT: '47831' } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('criterion 3: off, no Reviews row and the phone’s tabs as navigation.csv says', async () => {
  await modes(async (mode, n) => {
    for (const [as, tabs] of [['rhea', ['Home', 'Check-in', 'Goals', mode === 'on' ? 'Reviews' : 'People']], ['oskar', mode === 'on' ? ['Home', 'Goals', 'Reviews', 'People'] : ['Home', 'Goals', 'People', 'Activity']]]) {
      const t = (await get(n, '/', as)).text;
      assert.equal(/data-item="reviews"/.test(t), mode === 'on', `${as}: the menu ${mode === 'on' ? 'has' : 'has no'} Reviews row`);
      const tb = [...(/<nav class="tabbar"[\s\S]*?<details/.exec(t) || [''])[0].matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
      assert.deepEqual(tb, tabs, `${as}'s tabs`);
    }
  });
});

test('criterion 4: off, every review address is Page not found with its sentence; ?review= opens the goal; writes are refused', async () => {
  await modes(async (mode, n) => {
    for (const p of ['/review', '/reviews', '/reviews/new', '/reviews/weekly', '/reviews/weekly/edit', '/reviews/weekly/summary', '/reviews/weekly/print']) {
      const r = await get(n, p);
      if (mode === 'on') { assert.ok(r.status === 200 || r.status === 303, `${p} opens`); continue; }
      assert.equal(r.status, 404, p); assert.ok(r.text.includes('Page not found') && (mode === 'out' || r.text.includes(SENT_PAGE)), `${p} says the sentence`);
    }
    const g = await get(n, '/goals/ns-lead?review=weekly');
    assert.equal(g.status, 200);
    assert.equal(/data-part="walk"/.test(g.text), mode === 'on', 'the walk shows only while on');
    if (mode === 'on') return;
    const before = await state(n);
    const tries = [['saveReview', { name: 'X', levels: 'svp' }], ['reviewCall', { reviewId: 'weekly', goalId: 'ns-lead', call: 'note', text: 'A note' }], ['reviewCall', { reviewId: 'weekly', goalId: 'ns-lead', call: 'question', text: 'Why?' }], ['markReviewed', { reviewId: 'weekly', goalId: 'ns-lead' }], ['endReview', { reviewId: 'weekly' }], ['saveGoal', { proposedIn: 'weekly' }]];
    for (const [a, body] of tries) { const r = await post(n, `/act/${a}`, body); if (mode === 'off') assert.ok(r.text.includes(SENT_ACTION), `${a} refused with the sentence`); }
    for (const t of ['review_call', 'save_review']) assert.equal((await tool(n, t, { review_id: 'weekly', goal_id: 'ns-lead', call: 'note', text: 'x', name: 'X' })).isError, true);
    const after_ = await state(n);
    assert.equal(after_.decisions, before.decisions, 'no note saved'); assert.equal(after_.changes.length, before.changes.length, 'nothing logged');
    assert.equal(writesReviews('saveGoal', { proposedIn: 'weekly' }), true); assert.equal(writesReviews('answerAsk', { askId: 'ask_po97' }), false);
  });
});

test('criterion 5: off, Home has no Next review cell and no review lead; the due flag says “Due by Thu 12 Nov.”', async () => {
  await modes(async (mode, n) => {
    const amara = (await get(n, '/', 'amara')).text;
    assert.equal(/data-part="next-review"/.test(amara), mode === 'on', 'Next review cell');
    if (mode !== 'on') {
      const lead = mainOf((/<section class="hero[\s\S]*?<\/section>/.exec(amara) || [''])[0]);
      assert.ok(!/review/i.test(lead), `no review lead: ${lead}`);
    }
  });
  const w = S1.currentWeek('2026-11-12T12:00:00.000Z');
  assert.equal(dueWords(true, S1, w, true).flag, 'Due by Thu 12 Nov.'); assert.equal(dueWords(false, S1, w, true).flag, 'Due by Thu 12 Nov.');
});

test('criterion 6: switching off first reads back what stays, and Undo brings Reviews back', async () => {
  await modes(async (mode, n) => {
    const f = await get(n, '/workspace/features?confirm=reviews');
    if (mode !== 'on') { assert.ok(!/Switch off Reviews in/.test(f.text), 'no read-back while off or out'); return; }
    const rb = switchOffReadBack(W0, S1);
    const t = strip(f.text);
    for (const line of rb.lines) assert.ok(t.includes(line), `reads back: ${line}`);
    assert.ok(t.includes('6 reviews stay as they are') && t.includes('Nothing is deleted.'));
    assert.ok(!(await state(n)).modulesOff.includes('reviews'), 'the read-back changes nothing');
    const o = await off(n);
    assert.ok(strip(o.text).includes(`Reviews is off in ${WS}. Nothing it saved is lost.`) && /name="undo"/.test(o.text));
    const u = await post(n, '/act/setFeature', { id: 'reviews', on: 'true', undo: '1' });
    assert.ok(strip(u.text).includes('Reviews is back on.')); assert.ok(!(await state(n)).modulesOff.includes('reviews'));
  });
});

test('criterion 7: back on, every review, its people, its cadence and what was said are as they were', async () => {
  await reset('main');
  const reviewsBefore = JSON.stringify(W0.reviews);
  const said = (await state('main')).decisions;
  await off('main');
  await on('main');
  const t = mainOf((await get('main', '/reviews')).text);
  for (const r of W0.reviews) assert.ok(t.includes(r.name.replace('&', '&')), r.name);
  assert.equal((await state('main')).decisions, said);
  assert.match(mainOf((await get('main', '/reviews/devprod')).text), /Every 2 weeks, Tuesdays/);
  assert.equal(JSON.stringify(W0.reviews), reviewsBefore);
  await reset('main');
});

test('criterion 8: the clock’s words come from dueWords and match reviews.csv; off, no deadline names a review', async () => {
  const r = spawnSync(process.execPath, [path.resolve(ROOT, '../spec/rebuild/drill.mjs'), ROOT, '--files', 'reviews'], { cwd: path.resolve(ROOT, '..'), encoding: 'utf8', timeout: 300000 });
  assert.equal(r.status, 0, r.stdout.slice(-2000));
  assert.equal(dueWords(true, S1, 45, heldOnDueDay(W0, S1, 45)).by, 'before Thursday’s review');
  assert.equal(dueWords(false, S1, 45, true).by, 'by Thursday');
  await modes(async (mode, n) => {
    if (mode === 'on') return;
    for (const p of ['/', '/check-in', '/goals', '/goals/ns-lead', '/people/rhea']) {
      const t = mainOf((await get(n, p, 'rhea')).text);
      assert.ok(!/before (the|Thursday’s) review|after Thursday’s review/.test(t), `${p} names no review in a deadline`);
    }
  });
});

test('criterion 9: a closed page and every review tool say the switched-off sentences', async () => {
  await modes(async (mode, n) => {
    for (const t of TOOLS) {
      const r = await tool(n, t, { review_id: 'weekly', goal_id: 'ns-lead', call: 'note', text: 'x', name: 'X' });
      if (mode === 'on') { if (['list_reviews', 'get_review'].includes(t)) assert.equal(r.isError, false, t); continue; }
      if (mode === 'off') assert.equal(r.text, SENT_TOOL(t), t);
      else assert.equal(r.isError, true, `${t} left out: unknown`);
    }
    if (mode === 'off') assert.ok((await get(n, '/reviews')).text.includes(SENT_PAGE));
  });
});

test('criterion 10: the read-back adds the accepted risks line (left out at nought) and the due-day line', () => {
  const rb = switchOffReadBack(W0, S1);
  const day = 'Thursday';
  const due = `Check-ins are still due by ${day}. “Before the review” becomes “by ${day}” on Home, in the check-in and in the count of goals checked in on time.`;
  assert.ok(rb.lines.includes(due));
  assert.ok(!rb.lines.some((l) => /accepted risks? stays?/.test(l)) || rb.risks > 0, 'left out at nought');
  const W1 = structuredClone(W0);
  const live = W1.goals.filter((g) => !g.removedAt);
  W1.decisions.push({ id: 'x1', goalId: live[0].id, reviewId: 'weekly', week: 44, kind: 'note', byId: 'amara', at: W0.builtFor, note: 'We accept the risk: the vendor fix lands in December.' },
    { id: 'x2', goalId: live[1].id, reviewId: 'weekly', week: 44, kind: 'note', byId: 'amara', at: W0.builtFor, note: 'We accept the risk: two teams are short.' },
    { id: 'x3', goalId: live[2].id, reviewId: 'weekly', week: 44, kind: 'note', byId: 'amara', at: W0.builtFor, note: 'We accept the risk: removed.', removedAt: W0.builtFor },
    { id: 'x4', goalId: live[3].id, reviewId: 'weekly', week: 44, kind: 'note', byId: 'amara', at: W0.builtFor, note: 'Another note.' });
  const rb1 = switchOffReadBack(W1, S1);
  const qi = rb1.lines.findIndex((l) => /question/.test(l)), ri = rb1.lines.findIndex((l) => l.startsWith(`${rb.risks + 2} accepted risks stay on their goals, as they were said. No new one can be accepted while Reviews is off.`));
  assert.ok(ri > qi && ri < rb1.lines.indexOf(due), 'after the questions line, before the due-day line');
});

test('criterion 11: off, the workbook has no Notes sheet and no Review column; a file with them loads and says once', async () => {
  assert.ok(workbookShape(true).sheets.includes('Notes') && workbookShape(true).askColumns.includes('Review'));
  assert.ok(!workbookShape(false).sheets.includes('Notes') && !workbookShape(false).askColumns.includes('Review'));
  const file = workbookShape(true);
  assert.equal(importNotice(false, WS, file).notice, `Reviews is off in ${WS}, so the Notes sheet and the Review column were not read.`);
  assert.ok(!importNotice(false, WS, file).read.includes('Notes') && importNotice(false, WS, file).read.includes('Goals'));
  assert.equal(importNotice(false, WS, { sheets: ['Goals', 'Notes'], askColumns: [] }).notice, `Reviews is off in ${WS}, so the Notes sheet was not read.`);
  assert.equal(importNotice(true, WS, file).notice, null); assert.equal(importNotice(false, WS, workbookShape(false)).notice, null);
});

test('criterion 12: back on after a week off, no session whose date passed while it was off says Not held yet', async () => {
  await reset('main');
  await post('main', '/act/setFeature', { id: 'reviews', on: 'false' }, 'amara', '2026-11-02');
  await post('main', '/act/setFeature', { id: 'reviews', on: 'true' }, 'amara', '2026-11-06');
  const t = mainOf((await get('main', '/reviews', 'amara', '2026-11-06')).text);
  assert.ok(!t.includes('Not held yet'), t.slice(0, 600));
  assert.ok(/Platform leadership weekly[^·]*· Next on Thu 12 Nov/.test(t), 'the weekly moves to its next date');
  assert.ok(!mainOf((await get('main', '/', 'amara', '2026-11-06')).text).includes('Not held yet'));
  await reset('main');
});
