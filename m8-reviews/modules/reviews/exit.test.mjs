// Stage 8's exit criteria, one test each, every one run with Reviews on and with it off.
// node --test modules/reviews/exit.test.mjs   (from rebuild/; starts its own app on :4190, resets it before each case)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as RV from './rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REBUILD = path.join(here, '../..');
const PORT = 4874, BASE = `http://localhost:${PORT}`;
const WS = 'Platform Engineering';
let app;
// A child node started under node --test must not think it is a test file itself.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NODE_TEST')));

before(async () => {
  app = spawn(process.execPath, [`${REBUILD}/app/./server.mjs`, String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'], env: ENV });
  let said = ''; app.stdout.on('data', (d) => { said += d; }); app.stderr.on('data', (d) => { said += d; });
  for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 100)); try { await fetch(`${BASE}/__reset`, { method: 'POST' }); return; } catch {} }
  throw new Error(`the app did not start: ${said.slice(0, 800)}`);
});
after(() => app && app.kill());

async function req(p, { as = 'amara', today = '2026-11-05', method = 'GET', form = null } = {}) {
  const r = await fetch(BASE + p, { method, redirect: 'manual', headers: { cookie: `as=${as}; today=${today}`, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form) : undefined });
  return { status: r.status, location: r.headers.get('location') || '', html: await r.text() };
}
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const main = (html) => text((html.match(/<main[\s\S]*<\/main>/) || [html])[0]);
const reset = () => fetch(`${BASE}/__reset`, { method: 'POST' });
const setReviews = async (on, extra = {}) => { const r = await req('/workspace/features', { method: 'POST', form: { module: 'reviews', to: on ? 'on' : 'off', ...extra.form }, today: extra.today }); assert.equal(r.status, 303); return r; };
const tool = async (name, args = {}, as = 'amara') => JSON.parse((await req('/api/mcp', { as, method: 'POST', form: { tool: name, args: JSON.stringify(args) } })).html);
const offPage = `Reviews is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const offAction = `Reviews is switched off in ${WS}. An admin can switch it on in Workspace, under Features.`;
const offTool = (t) => `Reviews is switched off in ${WS}, so ${t} can’t be used there. An admin can switch it on in Workspace, under Features.`;
// Runs a criterion's case with Reviews on and with it off, each from a fresh workspace.
async function both(t, fn) {
  for (const on of [true, false]) await t.test(on ? 'Reviews on' : 'Reviews off', async () => { await reset(); if (!on) await setReviews(false); await fn(on); });
}
const menuOf = (html) => { const nav = (html.match(/<nav aria-label="Main">([\s\S]*?)<\/nav>/) || [])[1] || ''; return [...nav.matchAll(/<ul aria-label="[^"]*">([\s\S]*?)<\/ul>/g)].map((m) => [...m[1].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => x[1])); };
const tabsOf = (html) => [...((html.match(/<nav class="tabbar"[^>]*>([\s\S]*?)<\/nav>/) || [])[1] || '').matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]);

test('1. Its requirements hold (REVIEW, REVIEW-SETUP, REVIEW-RUN, REVIEW-SPEAK, REVIEW-DECIDE, REVIEW-LIST-STATE, REVIEW-AGENDA, REVIEWS-OPTIONAL, REVIEWS-SWITCH-CLOCK)', (t) => both(t, async (on) => {
  if (!on) {
    // REVIEWS-OPTIONAL: nothing of Reviews answers; asks and what was said stay.
    for (const p of ['/reviews', '/reviews/new', '/reviews/weekly']) assert.equal((await req(p)).status, 404);
    assert.match(main((await req('/goals/ns-lead?history=reviews', { as: 'rhea' })).html), /reviewed it in Platform leadership weekly/);
    assert.ok((await tool('list_requests', {}, 'rhea')).asks.length > 0);
    assert.equal((await tool('list_reviews')).error, offTool('list_reviews'));
    return;
  }
  // REVIEW-LIST-STATE
  const list = main((await req('/reviews')).html);
  assert.match(list, /Reliability weekly .* In progress · 9 of 27 reviewed/);
  assert.match(list, /Data & ML sync .* Held Mon 2 Nov/);
  assert.match(list, /Last held Thu 29 Oct · 4 open actions/);
  // REVIEW + REVIEW-AGENDA: exceptions worst first, one row per goal to discuss; the walk has next and previous
  const page = (await req('/reviews/weekly')).html;
  const agenda = (page.match(/<div class="rows agenda">([\s\S]*?)<\/div><\/section>/) || [])[1] || '';
  const words = [...agenda.matchAll(/st-word">([^<]+)</g)].map((m) => m[1]);
  const rank = { 'Off track': 0, 'At risk': 1, 'No recent update': 1, 'On track': 2 };
  assert.deepEqual(words.map((w) => rank[w]), words.map((w) => rank[w]).slice().sort((a, b) => a - b), 'worst first');
  assert.equal(words.length, Number(main(page).match(/(\d+) to discuss/)[1]));
  const walk = main((await req('/goals/lead-ci-time?review=weekly')).html);
  assert.match(walk, /Goal \d+ of 18 to discuss/); assert.match(walk, /Previous goal/); assert.match(walk, /Next goal/);
  // REVIEW-SPEAK: Oskar is in no review and no admin
  const r1 = await req('/reviews/devprod/mark/ns-lead', { as: 'oskar', method: 'POST', form: {} });
  assert.match(decodeURIComponent(r1.location), /Only people in Developer Productivity fortnightly, or an admin, can speak for it\./);
  assert.equal((await tool('review_call', { review: 'devprod', goal: 'ns-lead', kind: 'note', text: 'hello there' }, 'oskar')).error, 'Only people in Developer Productivity fortnightly, or an admin, can speak for it.');
  assert.match(main((await req('/reviews/devprod', { as: 'oskar' })).html), /You’re not in this review\. .* or an admin can add you\./);
  assert.match((await tool('review_call', { review: 'devprod', goal: 'ns-cost', kind: 'note', text: 'out of scope' }, 'daniel')).error, /doesn’t cover .*, so nothing can be said about it there\./);
  // REVIEW-DECIDE: Lead time (off track) can't be marked without a decision; a reason under 5 characters is refused
  const reli = await req('/reviews/weekly/mark/slo-multiregion', { as: 'amara', method: 'POST', form: {} });
  assert.match(decodeURIComponent(reli.location), /What happens next, who, by when\?/);
  assert.equal((await tool('review_call', { review: 'devprod', goal: 'ns-lead', kind: 'risk', text: 'ok' }, 'daniel')).error, 'Say why the review accepts the risk.');
  await req('/reviews/weekly/say/slo-multiregion', { method: 'POST', form: { kind: 'step', text: 'Move the four services that can replicate now', who: 'akosua', week: '47' } });
  assert.equal((await req('/reviews/weekly/mark/slo-multiregion', { method: 'POST', form: {} })).location.includes('err='), false);
  // REVIEW-RUN: a question raised in a session is an ask, for the owner, on the goal's page and Home
  await req('/reviews/weekly/say/lead-ci-time', { method: 'POST', form: { kind: 'question', text: 'Is the runner budget still the blocker?' } });
  const g = main((await req('/goals/lead-ci-time', { as: 'rhea' })).html);
  assert.match(g, /For you .*Is the runner budget still the blocker\? .*by Amara in Platform leadership weekly/);
  assert.match(main((await req('/', { as: 'rhea' })).html), /Questions for you .*Is the runner budget still the blocker\?/);
  // REVIEW-SETUP: anyone sets one up, and it is logged
  const made = await req('/reviews/new', { as: 'jun', method: 'POST', form: { name: 'SRE fortnightly', every: '4', weekday: '4', levels: 'north-star', people: 'mateo' } });
  assert.match(made.location, /^\/reviews\/rv_/);
  assert.match(main((await req(made.location, { as: 'jun' })).html), /Every 4 weeks, Fridays/);
  assert.match(main((await req('/activity?q=SRE', { as: 'jun' })).html), /set up the review SRE fortnightly/);
  // REVIEWS-SWITCH-CLOCK: rule RS1's worked examples
  const cyc = { startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
  assert.equal(RV.dueWords(true, cyc, 46, true).by, 'before Thursday’s review');
  assert.equal(RV.dueWords(true, cyc, 46, false).by, 'by Thursday');
  assert.equal(RV.dueWords(false, cyc, 46, true).by, 'by Thursday');
}));

test('2. Its journeys and checks can be done (U3, U13, U30, U36, U47, U49, U63, U67, U79, U80, U103, U104, U154, U155, N1, N21)', (t) => both(t, async (on) => {
  if (!on) return; // the journeys switch Reviews themselves (U103, U104, U154, U155); each runs from a fresh workspace
  const ids = ['U3', 'U13', 'U30', 'U36', 'U47', 'U49', 'U63', 'U67', 'U79', 'U80', 'U103', 'U104', 'U154', 'U155', 'N1', 'N21'];
  const run = spawnSync(process.execPath, [path.join(here, 'journeys.cjs'), '--base', BASE, ...ids], { encoding: 'utf8', timeout: 1500000, env: ENV });
  const res = JSON.parse(run.stdout.trim().split('\n').pop());
  const notDone = ids.filter((id) => res[id]?.tally !== 'DONE').map((id) => `${id} ${res[id]?.tally}`);
  assert.deepEqual(notDone, [], `journeys not done: ${notDone.join(', ')}`);
}));

test('3. Switched off, no Reviews row; the tabs are Home, Check-in, Goals, People (an owner) or Home, Goals, People, Activity', (t) => both(t, async (on) => {
  const rhea = (await req('/', { as: 'rhea' })).html, oskar = (await req('/', { as: 'oskar' })).html;
  assert.deepEqual(menuOf(rhea)[0], on ? ['Home', 'Check-in', 'Goals', 'Reviews'] : ['Home', 'Check-in', 'Goals']);
  assert.deepEqual(menuOf(oskar)[0], on ? ['Home', 'Goals', 'Reviews'] : ['Home', 'Goals']);
  assert.deepEqual(tabsOf(rhea), on ? ['Home', 'Check-in', 'Goals', 'Reviews', 'More'] : ['Home', 'Check-in', 'Goals', 'People', 'More']);
  assert.deepEqual(tabsOf(oskar), on ? ['Home', 'Goals', 'Reviews', 'People', 'More'] : ['Home', 'Goals', 'People', 'Activity', 'More']);
}));

test('4. Switched off, every review address says so; ?review= opens the goal; whatever would save Reviews’ records is refused (N21)', (t) => both(t, async (on) => {
  for (const p of ['/review', '/reviews', '/reviews/new', '/reviews/weekly', '/reviews/weekly/edit', '/reviews/weekly/summary', '/reviews/weekly/print']) {
    const r = await req(p);
    if (on) assert.ok(r.status === 200 || r.status === 303, `${p} ${r.status}`);
    else { assert.equal(r.status, 404, p); assert.match(main(r.html), /Page not found/); assert.ok(main(r.html).includes(offPage), p); }
  }
  const walk = await req('/goals/ns-lead?review=weekly');
  if (on) assert.equal(walk.status, 200); else assert.equal(walk.location, '/goals/ns-lead');
  const decisions = async () => (await tool('export_json')).notes;
  const n0 = on ? (await decisions()).length : null;
  // saving through the app: a mark, a note, a question raised in a review, a new review
  const writes = [['/reviews/weekly/mark/ns-cost', {}], ['/reviews/weekly/say/ns-lead', { kind: 'note', text: 'A note' }], ['/reviews/weekly/say/ns-lead', { kind: 'question', text: 'A question?' }], ['/reviews/new', { name: 'X', every: '1', weekday: '3', levels: 'svp' }]];
  for (const [p, form] of writes) {
    const r = await req(p, { method: 'POST', form });
    if (on) assert.equal(r.status, 303, p); else { assert.equal(r.status, 403, p); assert.ok(main(r.html).includes(offAction), p); }
  }
  // and through the AI tools: correcting a note said in a review is Reviews'; correcting an ask's words is not
  const ed = await tool('edit_call', { id: 'dec_po51', text: 'Corrected words.' });
  if (on) assert.equal(ed.ok, true); else assert.equal(ed.error, offTool('edit_call'));
  const askId = 'ask_po97';
  assert.equal((await tool('edit_call', { id: askId, text: 'What’s the latest date for the merge queue pilot?' })).ok, true);
  // answering a question raised in a review only carries it along: it still saves
  const open = (await tool('list_requests', {}, 'rhea')).asks.find((a) => a.kind === 'question');
  assert.equal((await req(`/asks/${open.id}/answer`, { as: 'rhea', method: 'POST', form: { answer: 'Week 49.' } })).status, 303);
  if (on) assert.ok((await decisions()).length > n0);
  else { await setReviews(true); assert.equal((await decisions()).find((d) => d.id === 'dec_po51').note, 'Good first quarter. The merge queue pilot is the thing to watch in Q2.'); }
}));

test('5. Switched off, Home has no Next review and no review lead; an owner of no goal is led to the goals they watch; a question waits by its age; the due flag is the same', (t) => both(t, async (on) => {
  const amara = main((await req('/', { as: 'amara' })).html);
  if (on) { assert.match(amara, /Next review · /); assert.match(amara, /goals to discuss/); }
  else {
    assert.doesNotMatch(amara, /Next review|goals to discuss|Not held yet|Open the review/);
    assert.match(amara, /Goals you watch · \d+ need attention See them/);
  }
  // Rhea's question from the Developer Productivity fortnightly: on Home with no session named while off
  const rhea = (await req('/', { as: 'rhea' })).html;
  const side = text((rhea.match(/<section aria-label="Needs your response">[\s\S]*?<\/section>/) || [''])[0]);
  assert.match(side, /If the runner budget is approved/);
  if (!on) assert.doesNotMatch(side.replace(/“[^”]*”/g, ''), /review|session/i);
  const cyc = { startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
  assert.equal(RV.dueWords(on, cyc, 46, true).flag, 'Due by Thu 12 Nov.');
}));

test('6. Switching off first reads back what stays (switchOffReadBack), and Undo brings Reviews back (U103)', (t) => both(t, async (on) => {
  if (!on) { await setReviews(true); }
  const f = (await req('/workspace/features')).html;
  const dlg = text((f.match(/<dialog id="off-reviews"[\s\S]*?<\/dialog>/) || [''])[0]);
  for (const line of ['6 reviews stay in the record', '8 open next steps', '5 open questions', 'Check-ins are still due by Thursday.', 'Nothing is deleted.']) assert.ok(dlg.includes(line), line);
  await setReviews(false);
  const undo = await setReviews(true, { form: { undo: '1' } });
  assert.match(undo.location, /did=back/);
  assert.match(main((await req(undo.location)).html), /Reviews is back on\./);
  assert.match(main((await req('/reviews')).html), /Platform leadership weekly/);
}));

test('7. Back on, every review, its people, its cadence and what was said are as they were (U104)', (t) => both(t, async (on) => {
  if (!on) await setReviews(true);
  const snap = async () => JSON.stringify([(await tool('list_reviews')).reviews.map((r) => [r.id, r.name, r.cadence, r.people, r.goals]), await Promise.all(['weekly', 'reliability', 'devprod'].map((id) => tool('get_review', { review: id }).then((x) => x.said)))]);
  const a = await snap();
  await setReviews(false); await setReviews(true);
  assert.equal(await snap(), a);
}));

test('8. The clock’s words come from dueWords and match every row of reviews.csv; off, the receipt says “…are in by Thursday.” (U154)', (t) => both(t, async (on) => {
  if (on) {
    const r = spawnSync(process.execPath, [path.join(here, 'drill-reviews.mjs'), REBUILD, '--files', 'reviews', '--expected', path.join(REBUILD, '../spec/conformance')], { encoding: 'utf8', env: ENV, cwd: path.join(REBUILD, '..') });
    assert.equal(r.status, 0, r.stdout.slice(-600));
    assert.match(r.stdout, /reviews\.csv: 91 of 91 rows match/);
  }
  // Rhea's two check-ins still to do, posted on Thursday: the receipt words the deadline
  for (const g of ['ci-docker', 'ci-cost']) {
    const r = await req(`/check-in/${g}`, { as: 'rhea', method: 'POST', form: { value: '9', why: 'The runner budget came through a week early.', call: 'on' } });
    assert.equal(r.status, 303, `${g} ${main(r.html).slice(0, 200)}`);
  }
  const receipt = main((await req('/check-in/done?g=ci-cost', { as: 'rhea' })).html);
  assert.match(receipt, on ? /(are|is) in (by Thursday|before Thursday’s review)\./ : /All \d+ of your check-ins are in by Thursday\./);
  if (!on) assert.doesNotMatch(receipt, /review/i);
}));

test('9. A closed page and every review tool (and edit_call on a review note) answer with the one switched-off sentence (N30)', (t) => both(t, async (on) => {
  const page = main((await req('/reviews/weekly')).html);
  if (!on) assert.ok(page.includes(offPage));
  else assert.ok(!page.includes(offPage));
  const calls = [['list_reviews', {}], ['get_review', { review: 'weekly' }], ['review_call', { review: 'weekly', goal: 'ns-cost', kind: 'reviewed' }], ['unmark_reviewed', { review: 'weekly', goal: 'ns-cost' }], ['save_review', { name: 'Y', everyWeeks: 1, weekday: 2, scope: { levels: ['svp'], goals: [], trees: [] } }], ['end_review', { review: 'security' }], ['delete_review', { review: 'nothing-here' }], ['edit_call', { id: 'dec_po53', text: 'Edited.' }]];
  for (const [name, a] of calls) {
    const out = await tool(name, a);
    if (on) assert.notEqual(out.error, offTool(name), name); else assert.equal(out.error, offTool(name), name);
  }
}));

test('10. The read-back adds the accepted risks (left out at nought) and the due day’s line (RS2)', (t) => both(t, async (on) => {
  if (!on) await setReviews(true);
  const dlg = async () => text(((await req('/workspace/features')).html.match(/<dialog id="off-reviews"[\s\S]*?<\/dialog>/) || [''])[0]);
  const zero = await dlg();
  assert.doesNotMatch(zero, /accepted risk/);
  assert.match(zero, /5 open questions raised in a review stay open for their owners to answer\. Check-ins are still due by Thursday\. “Before the review” becomes “by Thursday” on Home, in the check-in and in the count of goals checked in on time\./);
  for (const g of ['ns-lead', 'lead-ci-time']) assert.equal((await tool('review_call', { review: 'weekly', goal: g, kind: 'risk', text: 'the vendor fix lands next release' })).ok, true);
  const two = await dlg();
  assert.match(two, /stay open for their owners to answer\. 2 accepted risks stay on their goals, as they were said\. No new one can be accepted while Reviews is off\. Check-ins are still due by Thursday\./);
}));

test('11. Switched off, the workbook has no Notes sheet and no Review column on Asks; an import with them says once they were not read', (t) => both(t, async (on) => {
  const wb = JSON.parse((await req('/data/workbook.json')).html);
  const asks = wb.find((s) => s.name === 'Asks');
  assert.equal(wb.some((s) => s.name === 'Notes'), on);
  assert.equal(asks.columns.includes('Review'), on);
  const pv = async (sheets) => JSON.parse((await req('/api/import-preview', { method: 'POST', form: { file: JSON.stringify({ sheets }) } })).html);
  const both_ = await pv([{ name: 'Goals', columns: ['Key'] }, { name: 'Asks', columns: ['Kind', 'Review'] }, { name: 'Notes', columns: ['Note'] }]);
  const notesOnly = await pv([{ name: 'Goals', columns: ['Key'] }, { name: 'Notes', columns: ['Note'] }]);
  const plain = await pv([{ name: 'Goals', columns: ['Key'] }]);
  if (on) { assert.deepEqual(both_.said, []); assert.ok(both_.read.includes('Notes')); }
  else {
    assert.deepEqual(both_.said, [`Reviews is off in ${WS}, so the Notes sheet and the Review column were not read.`]);
    assert.deepEqual(notesOnly.said, [`Reviews is off in ${WS}, so the Notes sheet was not read.`]);
    assert.ok(!both_.read.includes('Notes'));
  }
  assert.deepEqual(plain.said, []);
  assert.equal('notes' in JSON.parse((await req('/data/export.json')).html), on);
}));

test('12. Back on after a week off, a session whose date passed while it was off moves on: neither Reviews nor Home says Not held yet (U155)', (t) => both(t, async (on) => {
  // "on": never switched off, Friday 6 Nov: the Thursday session is outstanding. "off": switched off Monday 2 Nov, on Friday 6 Nov.
  if (!on) { await setReviews(true); await setReviews(false, { today: '2026-11-02' }); await setReviews(true, { today: '2026-11-06' }); }
  const list = main((await req('/reviews', { today: '2026-11-06' })).html);
  const home = main((await req('/', { today: '2026-11-06' })).html);
  if (on) { assert.match(home, /Platform leadership weekly · Not held yet/); assert.match(list, /Outstanding from Thu 5 Nov/); }
  else { assert.doesNotMatch(home, /Not held yet/); assert.doesNotMatch(list, /Outstanding|Not held yet/); assert.match(list, /Platform leadership weekly .* Session Thu 12 Nov/); }
}));
