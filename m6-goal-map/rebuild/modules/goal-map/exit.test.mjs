// Stage 6's exit criteria (spec/rebuild/stage-6-module-goal-map.md), one test per criterion, each run with the
// Goal map on, switched off, and left out of the build (FARO_WITHOUT=goal-map). Run: node --test modules/goal-map/exit.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OFF = 'The Goal map is off here, so this is the List.';
const servers = [];
async function start(port, env = {}) {
  const s = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  servers.push(s);
  const up = await Promise.race([new Promise((r) => s.stdout.once('data', () => r(true))), new Promise((r) => s.once('exit', () => r(false))), new Promise((r) => setTimeout(() => r(false), 15000))]);
  assert.ok(up, `the app did not start on ${port}`);
  return `http://localhost:${port}`;
}
const get = async (base, p, as = 'amara') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}` }, redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
const post = async (base, p, body, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
const reset = (base) => fetch(`${base}/api/reset`, { method: 'POST' });
const setMap = (base, on, as) => post(base, '/act/setFeature', { id: 'goal-map', on: String(on) }, as);
const layouts = (html) => [...(/<details class="layout-menu">([\s\S]*?)<\/details>/.exec(html) || ['', ''])[1].matchAll(/role="menuitem"[^>]*>([^<]*)</g)].map((m) => m[1]);
const mainOf = (html) => (/<main[\s\S]*<\/main>/.exec(html) || [''])[0].replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
let ON, OUT, browser;
before(async () => { ON = await start(47130); OUT = await start(47131, { FARO_WITHOUT: 'goal-map' }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); for (const s of servers) s.kill(); });

test('1. its requirements hold: GOAL-MAP and MAP-OPTIONAL', async (t) => {
  await t.test('GOAL-MAP, the rules: the map rule’s worked examples', () => {
    const r = spawnSync(process.execPath, ['--test', path.join(here, 'map.test.mjs')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout.slice(-2000));
  });
  await t.test('GOAL-MAP, on: the canvas at the size of a division (126 goals)', async () => {
    await reset(ON);
    const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    p.setDefaultTimeout(6000);
    await p.goto(`${ON}/goals?scope=all&view=map&as=amara`);
    const nodes = p.locator('.react-flow__node'); await nodes.first().waitFor();
    const D = JSON.parse(await p.locator('#map-data').textContent());
    assert.equal(D.goals.length, 126, 'every goal is on the map');
    const tops = D.goals.filter((g) => !g.parentId).map((g) => g.id);
    const shown = await nodes.evaluateAll((els) => els.map((e) => e.dataset.id));
    const pathIds = new Set(D.paths.flat());
    assert.ok(tops.every((id) => shown.includes(id)) && shown.every((id) => tops.includes(id) || pathIds.has(id)), 'opens folded to the top goals with only the critical path beneath them');
    const tops0 = await p.locator('.react-flow__node').evaluateAll((els, T) => els.filter((e) => T.includes(e.dataset.id)).map((e) => e.offsetTop), tops);
    assert.ok(tops0.length === tops.length && Math.min(...tops0) === 0, 'north stars at the top');
    assert.ok(await p.locator('.react-flow__edge.feeds.critical').count() > 0, 'the critical path is drawn');
    assert.ok(Number(await p.locator('.react-flow__edge.feeds.critical path').first().evaluate((e) => parseFloat(getComputedStyle(e).strokeWidth))) > Number(await p.locator('.react-flow__edge.feeds:not(.critical) path').first().evaluate((e) => parseFloat(getComputedStyle(e).strokeWidth)).catch(() => 1)), 'the critical path is bold');
    await p.getByRole('button', { name: 'Unfold all' }).click();
    assert.equal(await nodes.count(), 126, 'Unfold all shows every goal');
    const solid = await p.locator('.react-flow__edge.feeds path').first().evaluate((e) => getComputedStyle(e).strokeDasharray);
    const dotted = await p.locator('.react-flow__edge.helps path').first().evaluate((e) => getComputedStyle(e).strokeDasharray);
    assert.ok((solid === 'none' || !solid) && dotted && dotted !== 'none', 'feeds solid, also helps dotted');
    await p.getByRole('button', { name: 'Fit all' }).click();
    const area = await p.locator('.map-canvas').boundingBox();
    const boxes = await nodes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    assert.ok(boxes.every(([l, tp, r, b]) => l >= area.x - 1 && tp >= area.y - 1 && r <= area.x + area.width + 1 && b <= area.y + area.height + 1), 'Fit all shows every goal');
    // a goal shows its number, target and gap; a goal others feed, the worst status under it
    const lead = await p.locator('.react-flow__node[data-id="ns-lead"]').innerText();
    assert.match(lead, /target .* gap /); assert.match(lead, /Under it:\s*Off track/);
    // pan, zoom and rearrange
    const tf0 = await p.locator('.map-viewport').evaluate((e) => e.style.transform);
    await p.mouse.move(area.x + 5, area.y + area.height - 5); await p.mouse.wheel(0, -300);
    const tf1 = await p.locator('.map-viewport').evaluate((e) => e.style.transform);
    assert.notEqual(tf0, tf1, 'the canvas zooms');
    await p.mouse.move(area.x + 4, area.y + area.height - 4); await p.mouse.down(); await p.mouse.move(area.x + 80, area.y + area.height - 40, { steps: 5 }); await p.mouse.up();
    assert.notEqual(await p.locator('.map-viewport').evaluate((e) => e.style.transform), tf1, 'the canvas pans');
    await p.getByRole('button', { name: 'Fit all' }).click();
    const n = p.locator('.react-flow__node[data-id="ns-ci"]'); const b0 = await n.boundingBox();
    const cx = b0.x + b0.width / 2, cy = b0.y + b0.height / 2; await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 60, cy + 40, { steps: 6 }); await p.mouse.up();
    const b1 = await n.boundingBox(); assert.ok(Math.abs(b1.x - b0.x) > 20, 'a goal can be moved');
    // fold and unfold a branch
    await p.getByRole('button', { name: 'Fold to the top' }).click();
    const fold = p.locator('button.fold[data-fold="ns-lead"]'); const c0 = await nodes.count(); await fold.click();
    assert.ok(await nodes.count() > c0, 'a branch unfolds'); await p.locator('button.fold[data-fold="ns-lead"]').click();
    assert.ok(await nodes.count() < c0, 'a branch folds');
    // Troubled trees only
    await p.getByRole('button', { name: 'Fold to the top' }).click();
    const before = await nodes.count(); await p.getByLabel('Troubled trees only').check();
    const tops1 = await nodes.evaluateAll((els, T) => els.filter((e) => T.includes(e.dataset.id)).length, tops);
    assert.ok(tops1 > 0 && tops1 < tops.length && (await nodes.count()) <= before, 'Troubled trees only keeps the trees in trouble');
    await p.getByLabel('Troubled trees only').uncheck();
    // selecting a goal shows its story; Delete and Backspace remove nothing
    await p.locator('.react-flow__node[data-id="ns-lead"]').click();
    assert.ok(await p.getByRole('complementary', { name: /Lead time for changes/ }).isVisible(), 'its story shows beside the map');
    await p.keyboard.press('Escape');
    const goals0 = (await (await fetch(`${ON}/api/state`)).json()).goals; const c1 = await nodes.count();
    await p.locator('.react-flow__node[data-id="ns-lead"]').focus(); await p.keyboard.press('Delete'); await p.keyboard.press('Backspace');
    assert.equal(await nodes.count(), c1); assert.equal((await (await fetch(`${ON}/api/state`)).json()).goals, goals0);
    // the list bar's search lists goals by key and goes to one without narrowing
    await p.locator('.list-bar input[type=search]').fill('G-48');
    await p.getByRole('option', { name: /^G-48 / }).click();
    assert.equal(await p.locator('.react-flow__node[data-id="mttr-oncall"] .map-node.found').count(), 1);
    assert.doesNotMatch(p.url(), /[?&]q=/);
    await p.context().close();
  });
  await t.test('GOAL-MAP, on: on a phone the same map is indented, one goal per row', async () => {
    const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await p.goto(`${ON}/goals?scope=all&view=map&as=amara`);
    await p.locator('.map-list .react-flow__node').first().waitFor();
    const rows = await p.locator('.react-flow__node').evaluateAll((els) => els.map((e) => [e.dataset.id, e.offsetLeft, e.offsetTop]));
    assert.ok(new Set(rows.map((r) => r[2])).size === rows.length, 'one goal per row');
    const x = Object.fromEntries(rows.map((r) => [r[0], r[1]]));
    assert.ok(x['ns-lead'] < x['lead-merge'] && x['lead-merge'] < x['lead-mq'], 'indented by depth');
    await p.context().close();
  });
  await t.test('MAP-OPTIONAL: only an admin switches it off; off, Goals offers no Map and a link to it opens the List and says so', async () => {
    await reset(ON);
    const no = await setMap(ON, false, 'rhea');
    assert.equal(no.status, 403); assert.match(no.text, /Only admins can switch features on or off\./);
    assert.ok(layouts((await get(ON, '/goals?scope=all')).text).includes('Map'), 'on, Goals offers the Map');
    const off = await setMap(ON, false, 'amara'); assert.equal(off.status, 200);
    assert.ok(!layouts((await get(ON, '/goals?scope=all')).text).includes('Map'), 'off, Goals offers no Map');
    const asked = (await get(ON, '/goals?scope=all&view=map')).text;
    assert.ok(asked.includes(OFF) && !asked.includes('class="goal-map"'));
    await setMap(ON, true, 'amara');
    assert.ok((await get(ON, '/goals?scope=all&view=map')).text.includes('class="goal-map"'), 'back on, the Map opens');
    // left out of the build: no Map, and nothing of it is read (no sentence of a module that isn’t there)
    const out = (await get(OUT, '/goals?scope=all&view=map')).text;
    assert.ok(!layouts(out).includes('Map') && !out.includes('class="goal-map"') && !out.includes(OFF));
  });
});

const run = (args, env = {}) => new Promise((resolve) => { const c = spawn(process.execPath, args, { env: { ...process.env, ...env } }); let stdout = ''; c.stdout.on('data', (d) => { stdout += d; }); c.stderr.on('data', (d) => { stdout += d; }); c.on('exit', (status) => resolve({ status, stdout })); });
test('2. its journeys and checks can be done (U26, U30, U34, U135, U165, N22 here; see JOURNEYS.md)', async () => {
  const r = await run([path.join(here, 'journeys.mjs')], { JOURNEY_PORT: '47132' });
  assert.equal(r.status, 0, r.stdout.slice(-3000));
  assert.match(r.stdout, /Every journey run passed\./);
});

test('3. switched off, Layout offers List, Table, Board and History, and nothing on Goals says Map', async (t) => {
  await t.test('on: five layouts, the Map last', async () => { await reset(ON); assert.deepEqual(layouts((await get(ON, '/goals?scope=all')).text), ['List', 'Table', 'Board', 'History', 'Map']); });
  await t.test('off', async () => {
    await reset(ON); await setMap(ON, false);
    for (const v of ['', '&view=table', '&view=board', '&view=history', '&view=map']) {
      const html = (await get(ON, `/goals?scope=all${v}`)).text;
      assert.deepEqual(layouts(html), ['List', 'Table', 'Board', 'History']);
      assert.doesNotMatch(mainOf(html).replace(OFF, ''), /\bMap\b/, `Goals${v} says Map`);
    }
  });
  await t.test('left out', async () => { const html = (await get(OUT, '/goals?scope=all')).text; assert.deepEqual(layouts(html), ['List', 'Table', 'Board', 'History']); assert.doesNotMatch(mainOf(html), /\bMap\b/); });
});

test('4. switched off, /goals?view=map opens the List with the sentence once; switched back on, the same address opens the Map', async (t) => {
  await t.test('off, then back on', async () => {
    await reset(ON); await setMap(ON, false);
    const html = (await get(ON, '/goals?scope=all&view=map')).text;
    assert.equal(mainOf(html).split(OFF).length - 1, 1, 'said once');
    assert.match(html, /class="goal-list"/, 'it is the List');
    assert.match(html, /history\.replaceState\(history\.state, '', "\/goals\?scope=all"\)/, 'the address stops asking for the Map');
    assert.ok(!(await get(ON, '/goals?scope=all')).text.includes(OFF), 'the List itself does not say it');
    await setMap(ON, true);
    const again = (await get(ON, '/goals?scope=all&view=map')).text;
    assert.ok(again.includes('class="goal-map"') && !again.includes(OFF), 'back on, the Map');
  });
  await t.test('on: the address opens the Map', async () => { await reset(ON); assert.ok((await get(ON, '/goals?scope=all&view=map')).text.includes('class="goal-map"')); });
  await t.test('left out: the address opens the List, saying nothing of a module that is not there', async () => { const html = (await get(OUT, '/goals?scope=all&view=map')).text; assert.ok(html.includes('class="goal-list"') && !html.includes(OFF)); });
});
