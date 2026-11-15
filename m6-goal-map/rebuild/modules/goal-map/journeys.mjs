// The Goal map's journeys (spec/modules/goal-map/journeys/*.md), the parts this rebuild can do, in a real browser at
// both widths. Each check throws when it fails; a failed app start is a failure; exits 1 when any run fails.
// Usage: node modules/goal-map/journeys.mjs [U26 U165 ...]   (JOURNEY_PORT, PLAYWRIGHT as in tests/journeys.mjs)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = Number(process.env.JOURNEY_PORT || 47120);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (p, text, words) => check(await p.locator('main').getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = async () => { const r = await fetch(`${BASE}/api/reset`, { method: 'POST' }); if (!r.ok) throw new Error(`reset failed: ${r.status}`); };
const state = async () => (await fetch(`${BASE}/api/state`)).json();
const nodes = (p) => p.locator('.react-flow__node');
async function chooseMap(p) {
  await p.locator('.layout-menu > summary').click();
  await p.locator('.layout-menu').getByRole('menuitem', { name: 'Map', exact: true }).click();
  await nodes(p).first().waitFor();
}
async function toggle(p, name) { await p.getByRole('switch', { name }).click(); } // Workspace → Features: the module's switch

const J = {
  async U26(p) {
    await p.goto(`${BASE}/goals?scope=all&as=amara`);
    await chooseMap(p);
    check(await p.getByRole('region', { name: 'Goal map' }).isVisible(), 'the Goal map section is not shown');
    const onPath = await p.locator('.react-flow__node[aria-label*="critical path"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    check(onPath.includes('ns-lead') && onPath.includes('lead-merge') && onPath.includes('lead-mq') && !onPath.includes('lead-review'), `critical path: ${onPath.join(', ')}`);
    const box = await p.locator('.react-flow__node[data-id="lead-mq"]').boundingBox(), area = await p.getByRole('region', { name: /Goal map/ }).boundingBox();
    check(!!box && !!area && box.x >= area.x - 1 && box.x + box.width <= area.x + area.width + 1, 'the map does not open on the critical path');
    await p.locator('.react-flow__node[data-id="lead-mq"]').click();
    const panel = p.getByRole('complementary', { name: /Merge queue live for every monorepo/ });
    await panel.waitFor();
    const t = await panel.innerText();
    check(/Why/.test(t) && /On the critical path/.test(t) && await panel.getByRole('link', { name: 'Open the goal' }).isVisible(), 'the story panel is missing its why or link');
    await p.keyboard.press('Escape');
    const before = await nodes(p).count();
    await p.getByRole('button', { name: 'Unfold all' }).click(); const all = await nodes(p).count();
    await p.getByRole('button', { name: 'Fold to the top' }).click(); const folded = await nodes(p).count();
    await p.locator('.attention-switch:visible').click(); await p.waitForURL(/attention=1/); await nodes(p).first().waitFor();
    const attention = await nodes(p).count();
    check(before < all && folded === before && attention < all && attention >= 3, `nodes: ${before} on opening, ${all} unfolded, ${folded} folded again, ${attention} needing attention`);
    await p.locator('.attention-switch:visible').click(); await p.waitForURL((u) => !/attention/.test(u.search));
    const helps = await p.waitForFunction(() => document.querySelectorAll('.react-flow__edge.helps').length > 0, null, { timeout: 5000 }).then(() => true, () => false);
    check(helps, 'no dotted also-helps lines');
  },
  async U30(p) {
    // the map part: from the keyboard, Enter opens the story and takes focus; Escape gives focus back
    await p.goto(`${BASE}/goals?scope=all&as=chen`);
    await chooseMap(p);
    const node = p.locator('.react-flow__node[data-id="ns-lead"]');
    await node.focus(); await p.keyboard.press('Enter');
    const panel = p.getByRole('complementary', { name: /Lead time for changes/ });
    const opened = await panel.isVisible(); const focused = opened && await panel.evaluate((el) => el.contains(document.activeElement));
    await p.keyboard.press('Escape');
    const back = opened && !(await panel.isVisible()) && await node.evaluate((el) => el === document.activeElement);
    check(opened && focused && back, `keyboard map: opened ${opened}, focus in panel ${focused}, focus back ${back}`);
    // the map never removes a goal: Delete and Backspace do nothing on it
    const n0 = await nodes(p).count(); const s0 = (await state()).goals;
    await node.focus(); await p.keyboard.press('Delete'); await p.keyboard.press('Backspace');
    check((await nodes(p).count()) === n0 && (await state()).goals === s0 && /view=map/.test(p.url()), 'Delete or Backspace changed the map');
  },
  async U34(p) {
    // the map part: the attention switch is the Goals filter, so it is in the link
    await p.goto(`${BASE}/goals?scope=all&view=map&as=tariq`);
    check(await p.getByRole('region', { name: 'Goal map' }).isVisible(), 'the Goal map section is not shown');
    await p.locator('.attention-switch:visible').click();
    await p.waitForURL(/attention=1/);
    check(/attention=1/.test(p.url()), 'the attention filter is not in the link');
    check(/Needs attention/.test(await p.locator('.filter-line').innerText()), 'the attention filter does not show in the bar');
    await p.reload(); await nodes(p).first().waitFor();
    check((await p.locator('.attention-switch').getAttribute('aria-pressed')) === 'true', 'the switch forgot it was on after a refresh');
  },
  async U135(p) {
    await p.goto(`${BASE}/goals?scope=all&as=rhea`);
    await chooseMap(p);
    check(/view=map/.test(p.url()), 'choosing Map does not put view=map in the address');
    check((await p.locator('.layout-menu > summary').innerText()).trim() === 'Layout: Map', 'Layout does not say Map');
    check(!(await p.locator('.map-canvas input, .map-bar input[type="checkbox"]:not(.map-troubled input)').count()) && !(await p.getByLabel('Only what needs attention').count()), 'the map has its own search or Needs attention tick box');
    const box = p.locator('.list-bar input[type=search]');
    await box.fill('G-48');
    await p.getByRole('option', { name: 'G-48' }).first().click();
    await p.locator('.react-flow__node[data-id="mttr-oncall"] .map-node.found').waitFor();
    check((await p.locator('.react-flow__node[data-id="mttr-oncall"] .map-node.found').count()) === 1 && !/[?&]q=/.test(p.url()), `choosing G-48 did not go to it on the map (${p.url()})`);
    await box.fill('merge'); await p.mouse.move(0, 0); await box.press('Enter');
    await p.waitForURL(/[?&]q=merge/);
    check(/[?&]q=merge/.test(p.url()) && /view=map/.test(p.url()), 'Enter did not narrow the map');
  },
  async U165(p) {
    // the Goal map part (Feedback's half is its own module's)
    await p.goto(`${BASE}/workspace/features?as=amara`);
    await toggle(p, 'Goal map');
    await shown(p, 'Goal map is off in');
    await p.goto(`${BASE}/goals?scope=all`);
    const items = await p.locator('.layout-menu [role=menuitem]').allTextContents();
    check(JSON.stringify(items.map((x) => x.trim())) === JSON.stringify(['List', 'Table', 'Board', 'History']), `Layout offers ${items.join(', ')}`);
    check(!/\bMap\b/.test(await p.locator('main').innerText()), 'something on Goals says Map');
    await p.goto(`${BASE}/goals?scope=all&view=map`);
    await shown(p, 'The Goal map is off here, so this is the List.', 'a link to the Map does not say the Goal map is off');
    check((await p.locator('main').getByText('The Goal map is off here, so this is the List.').count()) === 1, 'the sentence is said more than once');
    check(!/view=map/.test(p.url()), `the address still asks for the Map: ${p.url()}`);
    check(!(await nodes(p).count()), 'the Map was drawn with the Goal map off');
    await p.reload();
    check(!(await p.locator('main').getByText('The Goal map is off here').count()), 'the sentence is said again after a refresh');
    const s = await state();
    check(s.changes.some((c) => c.entity === 'workspace' && c.summary === 'Switched off Goal map'), 'switching the Goal map off was not logged');
    await p.goto(`${BASE}/workspace/features`);
    await toggle(p, 'Goal map');
    await shown(p, 'Goal map is on in');
    await p.goto(`${BASE}/goals?scope=all&view=map`);
    check(await nodes(p).first().waitFor().then(() => true, () => false), 'the Map does not open once switched back on');
  },
  async N22(p) {
    // the Goal map's part: off, no layout and no Help article of its own; back on, each comes back
    await p.goto(`${BASE}/workspace/features?as=amara`);
    await toggle(p, 'Goal map');
    await p.goto(`${BASE}/help`);
    check(!(await p.locator('main').getByRole('link', { name: 'The goal map' }).count()), 'Help still lists the goal map');
    await p.goto(`${BASE}/help/goal-map`);
    await shown(p, 'Goal map is switched off in', 'the goal map article does not say it is switched off');
    await p.goto(`${BASE}/goals?scope=all`);
    check(!(await p.locator('.layout-menu').getByText('Map', { exact: true }).count()), 'Layout still offers Map');
    await p.goto(`${BASE}/workspace/features`);
    await toggle(p, 'Goal map');
    await p.goto(`${BASE}/help`);
    check(await p.locator('main').getByRole('link', { name: 'The goal map' }).count() > 0, 'Help does not list the goal map once back on');
    await p.goto(`${BASE}/goals?scope=all`);
    check(await p.locator('.layout-menu').getByText('Map', { exact: true }).count() > 0, 'Layout does not offer Map once back on');
  },
};

async function main() {
  const only = process.argv.slice(2);
  const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const up = await Promise.race([new Promise((r) => server.stdout.once('data', () => r(true))), new Promise((r) => server.once('exit', () => r(false))), new Promise((r) => setTimeout(() => r(false), 15000))]);
  if (!up) { console.log('FAIL the app did not start'); process.exit(1); }
  const browser = await chromium.launch();
  let failed = 0, ran = 0;
  try {
    for (const [id, run] of Object.entries(J)) {
      if (only.length && !only.includes(id)) continue;
      for (const [width, vp] of Object.entries(WIDTHS)) {
        ran++;
        await reset();
        const context = await browser.newContext({ viewport: vp });
        const p = await context.newPage();
        p.setDefaultTimeout(6000);
        try { await run(p, { phone: width === 'phone' }); console.log(`PASS ${id} ${width}`); }
        catch (e) { failed++; console.log(`FAIL ${id} ${width}: ${e instanceof CheckFailed ? e.message : e.message.split('\n')[0]} (at ${p.url()})`); }
        await context.close();
      }
    }
  } finally { await browser.close(); server.kill(); }
  if (!ran) { console.log('FAIL no journey ran'); process.exit(1); }
  console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
  process.exit(failed ? 1 : 0);
}
main();
