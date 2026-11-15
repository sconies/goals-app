// The journey runner (spec/rebuild/README.md, "From stage 3 on: running the journeys").
// node tests/journeys/run.mjs [U2 U65 …] [--modes on,off,without] [--widths phone,desktop]
// It starts the app itself (with its test door), three ways: every module on, modules switched off, modules left out.
// It fails when the app didn't start or stopped, when a journey asked for doesn't exist, when nothing ran, and when any check fails.
// Every run writes tests/journeys/out/results.json afresh: journey, mode, width, steps, budget, every check.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const OUT = path.join(here, 'out');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const asked = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const MODES = opt('--modes', 'on,off,without').split(',');
const WIDTHS = opt('--widths', 'phone,desktop').split(',');
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const unknown = [...MODES.filter((m) => !['on', 'off', 'without'].includes(m)), ...WIDTHS.filter((w) => !SIZES[w])];
if (unknown.length) { console.error(`No such mode or width: ${unknown.join(', ')}.`); process.exit(2); }
const MODE_ENV = { on: {}, off: { FARO_MODULES_OFF: 'all' }, without: { FARO_WITHOUT: 'example,example-two' } };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The journeys: one file each under tests/journeys/core and tests/journeys/platform.
const files = ['core', 'platform'].flatMap((d) => fs.readdirSync(path.join(here, d)).filter((f) => f.endsWith('.mjs')).map((f) => path.join(here, d, f)));
const all = [];
for (const f of files) all.push((await import(f)).default);
const byId = new Map(all.map((j) => [j.id, j]));
const missing = asked.filter((id) => !byId.has(id));
if (missing.length) { console.error(`No journey called ${missing.join(', ')}.`); process.exit(2); }
const chosen = asked.length ? asked.map((id) => byId.get(id)) : all;

async function startApp(mode, port) {
  // never a server left over from another run: the port must be free, and the answer must carry this run's id
  try { await fetch(`http://127.0.0.1:${port}/`); throw new Error(`Port ${port} is already in use: something else answers there.`); } catch (e) { if (/already in use/.test(e.message)) throw e; }
  const runId = `${process.pid}-${Date.now()}-${mode}`;
  const child = spawn(process.execPath, [path.join(root, 'app/server.mjs'), '--port', String(port), '--test'], { cwd: root, env: { ...process.env, ...MODE_ENV[mode], FARO_RUN_ID: runId }, stdio: ['ignore', 'pipe', 'pipe'] });
  process.on('exit', () => child.kill());
  let log = '';
  child.stdout.on('data', (d) => (log += d)); child.stderr.on('data', (d) => (log += d));
  let exited = false; child.on('exit', () => (exited = true));
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    if (exited) throw new Error(`The app stopped while starting (${mode}):\n${log}`);
    try { const r = await fetch(`http://127.0.0.1:${port}/__test/load`); if (r.ok && r.headers.get('x-faro-run') === runId) return { child, alive: () => !exited, log: () => log }; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error(`The app didn't answer within 30 seconds (${mode}).`);
}

function harness({ browser, base, device, mode, record }) {
  let ctx = null, page = null;
  const h = {
    device, mode, phone: device === 'phone', base, steps: 0,
    get p() { return page; },
    async open(as, { today = '2026-11-05' } = {}) {
      if (ctx) await ctx.close();
      await fetch(`${base}/__test/reset`, { method: 'POST', body: JSON.stringify({ today }) });
      ctx = await browser.newContext({ viewport: SIZES[device], hasTouch: device === 'phone' });
      await ctx.addCookies([{ name: 'viewer', value: as, url: base }, { name: 'today', value: today, url: base }]);
      page = await ctx.newPage();
      page.setDefaultTimeout(5000);
    },
    async goto(addr) { await page.goto(base + addr); },
    async step(desc, fn) { h.steps++; await fn(); await page.waitForLoadState('domcontentloaded').catch(() => {}); },
    async click(locator, desc) { await h.step(desc, () => locator.click()); },
    async fill(locator, text, desc) { await h.step(desc, () => locator.fill(text)); },
    async menu(label) {
      await h.step(`Open “${label}” from the menu`, async () => {
        if (device === 'desktop') return page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: label, exact: true }).click();
        const tab = page.getByRole('navigation', { name: 'Tabs' }).getByRole('link', { name: label, exact: true });
        if (await tab.count()) return tab.click();
        await page.getByRole('navigation', { name: 'Tabs' }).getByRole('link', { name: 'More' }).click();
        await page.getByRole('main').getByRole('link', { name: label, exact: true }).click();
      });
    },
    async check(desc, fn, { point = null } = {}) {
      let ok = false, note = '';
      try { ok = !!(await fn()); } catch (e) { note = String(e.message || e).split('\n')[0]; }
      record.checks.push({ desc, point, ok, note });
      return ok;
    },
    visible: (locator, ms = 4000) => locator.first().waitFor({ state: 'visible', timeout: ms }).then(() => true),
    shows: (text, within) => h.check(`“${text}” is shown`, async () => h.visible((within || page.locator('body')).getByText(text, { exact: false }))),
    address: (re, desc) => h.check(desc || `the address matches ${re}`, async () => { await page.waitForURL(re, { timeout: 5000 }); return true; }),
    inView: (locator, desc, point = 'entry') => h.check(desc, async () => { const b = await locator.first().boundingBox(); if (!b) return false; const fold = device === 'phone' ? SIZES.phone.height - 60 : SIZES.desktop.height; return b.y >= 0 && b.y + Math.min(b.height, 40) <= fold; }, { point }),
    // The ease test's checkpoint: one-action (at most one main button in view or in the open sheet) and a11y.
    // axe-core isn't available to this runner, so a11y is checked by its own rules and the journey can be PART at best.
    async checkpoint(name) {
      await h.check(`Checkpoint “${name}”: at most one main button in view`, async () => {
        const n = await page.locator('.primary').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 && getComputedStyle(e).visibility !== 'hidden'; }).length);
        return n <= 1;
      }, { point: 'one-action' });
      await h.check(`Checkpoint “${name}”: no sideways scrolling, every control named, the main button 44px on a phone`, async () => page.evaluate((phone) => {
        if (document.documentElement.scrollWidth > innerWidth + 1) return false;
        const named = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea')].filter((e) => e.getClientRects().length).every((e) => (e.getAttribute('aria-label') || e.textContent.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label') || e.getAttribute('placeholder') || e.getAttribute('title')));
        const main = [...document.querySelectorAll('.primary')].filter((e) => e.getClientRects().length);
        return named && (!phone || main.every((e) => e.getBoundingClientRect().height >= 44));
      }, device === 'phone'), { point: 'a11y' });
      record.cannot.add('axe-core’s serious and critical faults (axe-core is not available offline; the runner checks names, reflow and target size itself)');
    },
    cannot(desc) { record.cannot.add(desc); },
    snapshot: async () => (await fetch(`${base}/__test/load`)).json(),
    commit: async (records, actor = 'amara') => fetch(`${base}/__test/commit`, { method: 'POST', body: JSON.stringify({ records, actor }) }),
    async close() { if (ctx) await ctx.close(); ctx = null; },
  };
  return h;
}

const results = [];
let failedToStart = null;
const browser = await chromium.launch();
let port = 47320;
try {
  for (const mode of MODES) {
    let app;
    try { app = await startApp(mode, port++); } catch (e) { failedToStart = e.message; break; }
    for (const j of chosen) {
      if (j.modes && !j.modes.includes(mode)) continue;
      for (const device of WIDTHS) {
        const record = { journey: j.id, title: j.title, mode, device, budget: j.budget, steps: 0, checks: [], cannot: new Set(), error: null };
        const h = harness({ browser, base: `http://127.0.0.1:${port - 1}`, device, mode, record });
        try { await j.run(h); } catch (e) { record.error = String(e.message || e).split('\n')[0]; }
        await h.close();
        if (!app.alive()) record.error = record.error || 'The app stopped during the journey.';
        record.steps = h.steps;
        record.overBudget = h.steps > j.budget;
        record.failed = record.checks.filter((c) => !c.ok).length + (record.error ? 1 : 0) + (record.overBudget ? 1 : 0);
        record.result = record.failed ? 'FAIL' : record.cannot.size || j.part ? 'PART' : 'DONE';
        record.cannot = [...record.cannot, ...(j.part || [])];
        results.push(record);
        console.log(`${record.result.padEnd(4)} ${j.id.padEnd(6)} ${mode.padEnd(7)} ${device.padEnd(7)} steps ${h.steps}/${j.budget}  checks ${record.checks.filter((c) => c.ok).length}/${record.checks.length}${record.error ? `  error: ${record.error}` : ''}`);
        for (const c of record.checks.filter((x) => !x.ok)) console.log(`       not met: ${c.desc}${c.note ? ` (${c.note})` : ''}`);
      }
    }
    app.child.kill();
    if (!app.alive()) {}
  }
} finally { await browser.close(); }

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), modes: MODES, widths: WIDTHS, results }, null, 1));
const ran = results.length, passed = results.filter((r) => r.result !== 'FAIL').length;
console.log(`\n${ran} journey runs, ${passed} passed (${results.filter((r) => r.result === 'DONE').length} DONE, ${results.filter((r) => r.result === 'PART').length} PART), ${ran - passed} failed. Results: tests/journeys/out/results.json`);
if (failedToStart) { console.error(`The app didn't start: ${failedToStart}`); process.exit(3); }
if (!ran) { console.error('No journey ran.'); process.exit(4); }
process.exit(ran === passed ? 0 : 1);
