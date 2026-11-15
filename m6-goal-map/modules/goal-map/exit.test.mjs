// Stage 6's exit criteria (spec/rebuild/stage-6-module-goal-map.md), each with the Goal map on and off.
// node --test rebuild/modules/goal-map/exit.test.mjs     (starts its own two servers: on :4181, off :4182)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as M from './rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '../../app/server.mjs');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ON = 'http://localhost:4181', OFF = 'http://localhost:4182';
const procs = [];
let browser;

const start = (port, off) => new Promise((res, rej) => {
  const p = spawn(process.execPath, [app, String(port)], { env: { ...process.env, FARO_MODULES_OFF: off ? 'goal-map' : '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  procs.push(p);
  p.stdout.on('data', (d) => { if (String(d).includes('Faro rebuild on')) res(); });
  p.on('exit', (c) => rej(new Error(`server ${port} exited ${c}`)));
});
const get = async (base, p, as = 'amara') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}; today=2026-11-05` }, redirect: 'manual' }); return { status: r.status, html: await r.text(), cookie: r.headers.get('set-cookie') || '' }; };
const layoutsOffered = (html) => [...html.matchAll(/role="menuitemradio"[^>]*><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
async function page(base, as = 'amara', phone = false) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'as', value: as, url: base }, { name: 'today', value: '2026-11-05', url: base }]);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  return { p, ctx, errors };
}
const nodeIds = (p) => p.$$eval('.react-flow__node', (n) => n.filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.id));

before(async () => { await Promise.all([start(4181, false), start(4182, true)]); browser = await chromium.launch(); });
after(async () => { await browser?.close(); for (const p of procs) p.kill(); });

// The worked examples of spec/core/rules/map.md (their records inferred: the kit gives only the goals' names).
const G = [{ id: 't', key: 'G-1', title: 'Lead time' }, { id: 'a', key: 'G-2', title: 'Merge to deploy', parentId: 't' }, { id: 'b', key: 'G-3', title: 'Review time', parentId: 't' }, { id: 'c', key: 'G-4', title: 'Merge queue live', parentId: 'a' }, { id: 'd', key: 'G-5', title: 'Cloud cost' }, { id: 'e', key: 'G-6', title: 'Idle machines off', parentId: 'd' }];
const ST = { t: 'on', a: 'off', b: 'risk', c: 'on', d: 'on', e: 'done' };

test('1. its requirements hold: GOAL-MAP, MAP-OPTIONAL · on', async () => {
  // the rules, by their worked examples
  assert.equal(M.criticalPath(G, ST).join(', '), 't, a');
  assert.equal([M.shownOnMap(G, ST), M.shownOnMap(G, ST, { opened: ['t'] }), M.shownOnMap(G, ST, { shut: ['t'] })].map((x) => x.join(', ')).join('; '), 't, a, d; t, a, c, b, d; t, d');
  assert.equal(`${M.rollupText(G, ST, 't')}; ${M.rollupText(G, ST, 'd')}`, 'off: 1 off track, 1 at risk; done: All 1 done');
  const H = [{ id: 'p' }, { id: 'x', parentId: 'p' }, { id: 'y', parentId: 'p' }];
  assert.equal(`${M.rollup(H, { p: 'on', x: 'on', y: 'done' }, 'p').text}; ${M.rollup(H, { p: 'on', x: 'on', y: 'stale' }, 'p').text}`, 'None behind: on track; 1 no recent update');
  assert.equal(M.troubled(G, ST).join(', '), 't');
  assert.equal(['g4', 'G-2', 'merge', 'queue merge'].map((q) => M.findOnMap(G, q).join(', ')).join('; '), 'c; a; c, a; c');
  // at the size of a division: the demo's 126 goals
  const { p, ctx, errors } = await page(ON);
  await p.goto(`${ON}/goals?scope=all&view=map`); await p.waitForSelector('.goal-map[data-ready]');
  const opened = await nodeIds(p);
  assert.ok(opened.length < 126 && opened.length >= 14, `opens folded to the top goals and the critical path (${opened.length})`);
  assert.ok(await p.locator('svg.edges path.critical').count() > 0, 'the critical path drawn bold');
  await p.getByRole('button', { name: 'Unfold all' }).click();
  const all = await nodeIds(p);
  assert.equal(all.length, 126, 'Unfold all shows every goal');
  assert.ok(await p.locator('svg.edges path.helps').count() > 0, 'dotted lines for also helps');
  await p.getByRole('button', { name: 'Fit all' }).click();
  const inside = await p.evaluate(() => { const c = document.querySelector('.map-canvas').getBoundingClientRect(); return [...document.querySelectorAll('.map-stage .react-flow__node')].every((n) => { const b = n.getBoundingClientRect(); return b.left >= c.left - 1 && b.right <= c.right + 1 && b.top >= c.top - 1 && b.bottom <= c.bottom + 1; }); });
  assert.ok(inside, 'Fit all shows every goal inside the canvas');
  const lead = await p.locator('.react-flow__node[data-id="ns-lead"]').innerText();
  assert.match(lead.replace(/\s+/g, ' '), /Under it: Off track · \d+ off track/, 'a goal others feed says the worst status under it');
  assert.match(lead, /Target/, 'each goal shows its target');
  await p.locator('.react-flow__node[data-id="ns-lead"] .map-node').focus(); await p.keyboard.press('Delete'); await p.keyboard.press('Backspace');
  assert.equal((await nodeIds(p)).length, 126, 'Delete and Backspace remove nothing');
  await p.locator('[data-act=troubled]').check();
  const tr = await nodeIds(p);
  assert.ok(tr.length < 126 && tr.length > 0, 'Troubled trees only keeps the trees in trouble');
  await p.locator('.react-flow__node[data-id="lead-mq"]').click();
  assert.ok(await p.locator('aside.map-story[aria-label="Merge queue live for every monorepo"]').isVisible(), 'selecting a goal shows its story beside the map');
  assert.deepEqual(errors, []);
  await ctx.close();
  const ph = await page(ON, 'amara', true);
  await ph.p.goto(`${ON}/goals?scope=all&view=map`); await ph.p.waitForSelector('.goal-map[data-ready]');
  assert.ok(await ph.p.locator('ul.map-list li.react-flow__node').count() > 0, 'on a phone the map is indented, one goal per row');
  await ph.ctx.close();
});
test('1. its requirements hold: GOAL-MAP, MAP-OPTIONAL · off', async () => {
  const r = await get(OFF, '/goals?scope=all&view=map');
  assert.ok(!layoutsOffered(r.html).includes('Map'), 'Goals offers no Map');
  assert.ok(r.html.includes('The Goal map is off here, so this is the List.'), 'a link that asked for the Map says so');
  assert.ok(!r.html.includes('class="goal-map"'), 'no map drawn');
  const h = await get(OFF, '/help');
  assert.ok(!h.html.includes('The goal map'), 'Help has no Goal map article');
  const a = await get(OFF, '/help/goal-map');
  assert.equal(a.status, 404); assert.ok(a.html.includes('Goal map is switched off in Platform Engineering'));
});

const runJourneys = (base, ids) => new Promise((res) => {
  const out = path.join((fs.mkdirSync(path.join(here, 'local'), { recursive: true }), fs.mkdtempSync(path.join(here, 'local', 'j-'))), 'j.json');
  execFile(process.execPath, [path.join(here, 'journeys.cjs'), ...ids], { env: { ...process.env, FARO_BASE: base, FARO_JOURNEYS_OUT: out }, timeout: 240000 }, () => res(JSON.parse(fs.readFileSync(out, 'utf8'))));
});
const holds = (r) => Object.values(r).every((w) => w.fails.length === 0 && w.steps <= w.budget);
test('2. its journeys and checks can be done (U26, U30’s map, U165 for the map) · on', { timeout: 300000 }, async () => {
  const r = await runJourneys(ON, ['U26', 'U30']);
  assert.ok(holds(r.U26), `U26: ${JSON.stringify(r.U26)}`);
  assert.ok(holds(r.U30), `U30 (the map part): ${JSON.stringify(r.U30)}`);
  const u = await runJourneys(ON, ['U165']);
  const mapFails = [...u.U165.phone.fails, ...u.U165.desktop.fails].filter((f) => !/Feedback/.test(f));
  assert.deepEqual(mapFails, [], 'U165, the Goal map’s half (Feedback is not in this rebuild)');
});
test('2. its journeys and checks can be done · off (the map journeys open the List and say why)', async () => {
  const { p, ctx } = await page(OFF);
  await p.goto(`${OFF}/goals?scope=all`);
  await p.locator('details.layout-menu > summary').click();
  assert.equal(await p.locator('[role=menuitemradio]', { hasText: /^Map/ }).count(), 0, 'no Map to choose');
  await p.goto(`${OFF}/goals?scope=all&view=map`);
  assert.equal(await p.locator('.react-flow__node, .map-list').count(), 0, 'nothing drawn');
  assert.ok((await p.locator('body').innerText()).includes('The Goal map is off here, so this is the List.'));
  assert.ok(await p.locator('.goal-row').count() > 0, 'the List is shown');
  await ctx.close();
});

test('3. switched off, Layout offers List, Table, Board and History, and nothing on Goals says Map · on', async () => {
  const r = await get(ON, '/goals?scope=all');
  assert.deepEqual(layoutsOffered(r.html), ['List', 'Table', 'Board', 'History', 'Map']);
});
test('3. switched off, Layout offers List, Table, Board and History, and nothing on Goals says Map · off', async () => {
  for (const v of ['list', 'table', 'board', 'history']) {
    const r = await get(OFF, `/goals?scope=all&view=${v}`);
    assert.deepEqual(layoutsOffered(r.html), ['List', 'Table', 'Board', 'History'], v);
    assert.ok(!/\bMap\b/.test(visibleText(r.html)), `nothing on Goals (${v}) says Map`);
  }
  const { p, ctx } = await page(OFF, 'rhea', true);
  await p.goto(`${OFF}/goals?scope=all`);
  assert.equal(await p.locator('details.layout-menu > summary').innerText(), 'View: List', 'the phone’s View says the layout');
  await ctx.close();
});

test('4. /goals?view=map opens the List, said once; back on, the same address opens the Map · on', async () => {
  const r = await get(ON, '/goals?scope=all&view=map');
  assert.ok(r.html.includes('class="goal-map"') && !r.html.includes('The Goal map is off here'));
});
test('4. /goals?view=map opens the List, said once; back on, the same address opens the Map · off', async () => {
  const { p, ctx } = await page(OFF);
  await p.goto(`${OFF}/goals?scope=all&view=map`);
  const said = (await p.locator('body').innerText()).split('The Goal map is off here, so this is the List.').length - 1;
  assert.equal(said, 1, 'said once on the page');
  assert.ok(!/view=map/.test(p.url()), `the address no longer asks for the Map: ${p.url()}`);
  await p.reload();
  assert.ok(!(await p.locator('body').innerText()).includes('The Goal map is off here'), 'not said again after a refresh');
  // a remembered Map (the layout cookie) also opens the List
  await ctx.addCookies([{ name: 'layout', value: 'map', url: OFF }]);
  await p.goto(`${OFF}/goals?scope=all`);
  assert.equal(await p.locator('.goal-map').count(), 0);
  // switched back on at Workspace, Features (as an admin), the same address opens the Map; then off again
  await p.goto(`${OFF}/workspace/features`);
  await p.locator('label', { hasText: 'Goal map' }).locator('input[type=checkbox]').click(); await p.waitForLoadState();
  assert.ok((await p.locator('body').innerText()).includes('Goal map is on in Platform Engineering.'));
  await p.goto(`${OFF}/goals?scope=all&view=map`); await p.waitForSelector('.goal-map[data-ready]');
  assert.ok(await p.locator('.react-flow__node').count() > 0, 'the Map opens');
  await p.goto(`${OFF}/workspace/features`);
  await p.locator('label', { hasText: 'Goal map' }).locator('input[type=checkbox]').click(); await p.waitForLoadState();
  assert.ok((await p.locator('body').innerText()).includes('Goal map is off in Platform Engineering.'));
  await p.goto(`${OFF}/activity`);
  assert.match(await p.locator('body').innerText(), /switched Goal map on[\s\S]*|switched Goal map off/, 'each switch is logged');
  await ctx.close();
  // only an admin switches it
  const r = await fetch(`${OFF}/workspace/features`, { method: 'POST', headers: { cookie: 'as=rhea', 'content-type': 'application/x-www-form-urlencoded' }, body: 'feature=goal-map&on=1' });
  assert.equal(r.status, 403);
});
