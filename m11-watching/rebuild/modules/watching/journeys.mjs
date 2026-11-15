// Watching's journeys (spec/modules/watching/journeys), the parts this rebuild has, in a real browser at both widths.
// Each check throws when it fails; exits 1 when any run fails; a failed app start is a failure.
// Usage: node modules/watching/journeys.mjs [U164 U9 …]   (port 47360)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = 47360, BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (p, text, words) => check(await p.locator('main, [role=dialog], dialog[open]').getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const gone = async (p, text, words) => check(!(await p.locator('main').getByText(text, { exact: false }).count()), words);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const tokens = async () => (await (await fetch(`${BASE}/api/state`)).json()).tokens;
const watchesOf = async (who) => { const t = (await tokens())[who]; const r = await (await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${t}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_watching', arguments: {} } }) })).json(); return r.result.structuredContent?.watches || []; };
const state = async () => (await fetch(`${BASE}/api/state`)).json();

const J = {
  async U164(p) {
    await p.goto(`${BASE}/workspace/features?as=amara`);
    const groups = await p.locator('.features-group h2').allInnerTexts();
    check(JSON.stringify(groups) === JSON.stringify(['Working together', 'Tools', 'Beyond this workspace']), `Features’ groups are ${groups.join(' | ')}`);
    await shown(p, /\d+ people watch goals here\./, 'Watching does not say how many people watch goals');
    const before = {};
    for (const who of ['amara', 'rhea', 'oskar']) before[who] = (await watchesOf(who)).map((w) => w.id).join();
    await p.getByRole('switch', { name: 'Watching' }).click();
    const d = p.getByRole('dialog', { name: /Switch off Watching in/ });
    await d.waitFor();
    check(/\d+ people’s \d+ watches are kept\./.test(await d.innerText()), 'the read-back does not count the watches');
    check(/Nothing is deleted/.test(await d.innerText()), 'the read-back does not say nothing is deleted');
    await d.getByRole('button', { name: 'Cancel' }).click();
    check(!(await state()).modulesOff.includes('watching'), 'Cancel switched Watching off');
    await p.getByRole('switch', { name: 'Watching' }).click();
    await p.getByRole('dialog', { name: /Switch off Watching in/ }).getByRole('button', { name: 'Switch off Watching' }).click();
    await shown(p, 'Watching is off in');
    await p.goto(`${BASE}/goals`);
    await p.locator('.goals-page').waitFor();
    const tabs = await p.locator('.scope-tabs a').allInnerTexts();
    check(!tabs.includes('Watching'), `Goals still has a Watching tab: ${tabs.join(' | ')}`);
    await p.goto(`${BASE}/`);
    await gone(p, 'Goals you watch', 'Home still has “Goals you watch”');
    await p.goto(`${BASE}/goals/ns-lead`);
    await p.locator('.goal-bar').waitFor();
    check(!(await p.getByRole('button', { name: /^Watch(ing)?$/ }).count()), 'a goal’s page still offers Watch');
    await gone(p, 'Watched by', 'a goal’s page still says Watched by');
    await p.goto(`${BASE}/watching`);
    await shown(p, 'Page not found');
    await shown(p, 'Watching is switched off in', '/watching does not say Watching is switched off');
    const s = await state();
    check(s.changes.some((c) => c.entity === 'workspace' && c.actorId === 'amara' && c.summary === 'Switched off Watching'), 'switching Watching off was not logged');
    await p.goto(`${BASE}/workspace/features`);
    await p.getByRole('switch', { name: 'Watching' }).click();
    await shown(p, 'Watching is on in');
    for (const who of Object.keys(before)) check((await watchesOf(who)).map((w) => w.id).join() === before[who], `${who}’s watches did not come back`);
    await p.goto(`${BASE}/`);
    await shown(p, 'Goals you watch', 'Watching back on, Home has no “Goals you watch”');
  },
  async U9(p) {
    await p.goto(`${BASE}/?as=oskar`);
    await shown(p, 'Nothing is asked of you today.');
    await shown(p, 'Goals you watch');
    check(!(await p.locator('.dash-watch').count()) && (await p.locator('.home-watch').count()) === 1, 'Home shows the goals you watch more than once');
    check((await p.locator('.tree .trow').count()) > 0 && (await p.locator('.tree .trow .trow-why').first().innerText()).length > 10, 'watched goals are not shown with what changed or how fresh they are');
    await p.goto(`${BASE}/goals/ns-lead`);
    await p.locator('.goal-bar').getByRole('button', { name: 'Watch', exact: true }).click();
    const d = p.getByRole('dialog', { name: /^Watch/ });
    await d.getByText(/It and the \d+ goals feeding it/).click();
    await d.getByRole('button', { name: 'Watch', exact: true }).click();
    await shown(p, 'Watching all');
    await p.goto(`${BASE}/goals?scope=watching`);
    await p.locator('.watch-change summary').click();
    await p.getByRole('button', { name: 'Watch SVP' }).click();
    await shown(p, 'Every SVP goal');
    const w = await watchesOf('oskar');
    check(w.some((x) => x.kind === 'tree' && x.ref === 'ns-lead') && w.some((x) => x.kind === 'level' && x.ref === 'svp'), 'the watches are not saved');
  },
  async U80(p) {
    await p.goto(`${BASE}/goals/ns-lead?as=oskar`);
    await p.locator('.goal-bar').waitFor();
    await p.locator('.goal-bar').getByRole('button', { name: 'Watch', exact: true }).click();
    const d = p.getByRole('dialog', { name: 'Watch Lead time for changes' });
    check(/show on your Home and under Watching in Goals/.test(await d.innerText()), 'the Watch sheet does not say what watching does');
    check(/Faro sends no email/.test(await d.innerText()), 'the Watch sheet does not say Faro sends no email');
    await d.getByRole('button', { name: 'Watch', exact: true }).click();
    await shown(p, 'Watching Lead time for changes');
    check(await p.locator('.goal-bar').getByRole('button', { name: 'Watching', exact: true }).isVisible(), 'the button does not say Watching');
    await p.locator('.goal-bar').getByRole('button', { name: 'Watching', exact: true }).click();
    await p.getByRole('dialog', { name: 'You’re watching Lead time for changes' }).getByRole('button', { name: 'Stop watching' }).click();
    await shown(p, 'Undo', 'stopping has no Undo');
    check((await state()).changes.some((c) => c.actorId === 'oskar' && c.entity === 'watch'), 'the watch is not logged');
    await p.goto(`${BASE}/goals/ns-lead?as=rhea`);
    await p.locator('.goal-bar').waitFor();
    check(!(await p.locator('.goal-bar').getByRole('button', { name: 'Watch', exact: true }).count()), 'the owner is offered Watch');
    check(/Owners don’t need to watch their own goals\./.test(await p.locator('.about').innerText()), 'About does not say why an owner has no Watch');
  },
  async U8(p) {
    await p.goto(`${BASE}/goals?scope=watching&as=rhea`);
    await shown(p, /\d+ goals · \d+ needs? attention/, 'the summary line does not count what needs attention');
    check(await p.locator('.goals-page .filterbar-row').filter({ visible: true }).count() > 0, 'Watching is not a Goals tab with the Goals toolbar');
    await p.goto(`${BASE}/watching?level=team`);
    check(/scope=watching/.test(p.url()) && /level=team/.test(p.url()), `/watching opened ${p.url()}`);
    await shown(p, 'Level', 'the Level filter is not applied to Watching');
  },
  async U16(p) {
    await p.goto(`${BASE}/?as=rhea`);
    await shown(p, 'Goals you watch');
    await p.goto(`${BASE}/goals?scope=watching`);
    check(await p.locator('.scope-tabs a[aria-current=page]').innerText() === 'Watching', 'Watching is not a Goals scope');
  },
  async U73(p) {
    await p.goto(`${BASE}/watching?as=rhea`);
    check(/scope=watching/.test(p.url()), `/watching opened ${p.url()}`);
  },
};

const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, FARO_WITHOUT: '' } });
let failed = 0;
try {
  await new Promise((res, rej) => { server.stdout.once('data', res); server.once('exit', (c) => rej(new Error(`the app did not start (exit ${c})`))); });
  const browser = await chromium.launch();
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(J);
  for (const name of names) for (const [w, size] of Object.entries(WIDTHS)) {
    await reset();
    const ctx = await browser.newContext({ viewport: size });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    try { await J[name](p); check(!errors.length, `page errors: ${errors.join('; ')}`); console.log(`PASS ${name} ${w}`); }
    catch (e) { failed++; console.log(`FAIL ${name} ${w}: ${e.message.split('\n')[0]} (at ${p.url()})`); }
    await ctx.close();
  }
  await browser.close();
} catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
server.kill();
console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
process.exit(failed ? 1 : 0);
