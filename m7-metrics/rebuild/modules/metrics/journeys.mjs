// The module's journeys this rebuild can do, in a real browser at both widths, against the running app with the
// library on. Each check throws; exits 1 when any run fails. Usage: node modules/metrics/journeys.mjs [U81 …]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.env.JOURNEY_PORT || 47331), BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const check = (c, w) => { if (!c) throw new Error(w); };
const as = async (p, who, to) => { await p.goto(`${BASE}${to}${to.includes('?') ? '&' : '?'}as=${who}`); };
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const text = (p) => p.locator('main').innerText();

const J = {
  U81: async (p) => {
    await as(p, 'oskar', '/metrics');
    const t = await text(p);
    check(t.includes('13 metrics'), 'the library lists 13');
    await p.fill('input[name="q"]', 'queue'); await p.click('button:has-text("Show")');
    check((await text(p)).includes('Pipeline queue wait (p90)'), '“queue” finds it');
    await p.click('a:has-text("Pipeline queue wait (p90)")');
    const m = await text(p);
    for (const w of ['90th percentile', 'CI/CD · main branch pipelines', 'Against plan']) check(m.includes(w), `its page says ${w}`);
    check(!m.includes('Change it'), 'nothing on his pages changes a metric');
    await p.click('table a'); check(/\/goals\//.test(p.url()), 'See its goal opens it');
  },
  U82: async (p) => {
    await as(p, 'rhea', '/goals/new/what');
    await p.fill('input[name="title"]', 'Shorter release queues');
    await Promise.all([p.waitForNavigation(), p.locator('form').first().evaluate((f) => f.submit())]);
    await p.goto(`${BASE}/goals/new/measure`);
    const sel = p.locator('select[name="metricId"]');
    check(await sel.count(), 'Measured by is on the measure step');
    await sel.selectOption('metric_queue-wait');
    await Promise.all([p.waitForNavigation(), p.locator('form').first().evaluate((f) => f.submit())]);
    await p.goto(`${BASE}/goals/new/measure`);
    check((await text(p)).includes('min, whole numbers, lower is better: from the metric.'), 'it fills in from the metric');
  },
  U83: async (p) => {
    await as(p, 'rhea', '/metrics/new');
    await p.fill('input[name="name"]', 'CI cost per pipeline run'); await p.fill('input[name="unit"]', 'USD'); await p.selectOption('select[name="direction"]', 'lower');
    await p.click('button:has-text("Add the metric")');
    check((await p.content()).includes('This looks like “CI compute cost per pipeline run”'), 'it asks about the close name');
    await p.goBack(); await p.check('input[name="answer:name"]'); await p.click('button:has-text("Add the metric")');
    check((await text(p)).includes('Still to say: what it means'), 'it saves, and says what is still to say');
    await p.click('a:has-text("Say what it means")'); check(/\/edit/.test(p.url()), 'opens the form');
    await p.goto(`${BASE}/metrics/lead-time`); check((await text(p)).includes('Retire it') && !(await text(p)).includes('Remove it'), 'Retire, not Delete');
  },
  U156: async (p) => {
    await as(p, 'daniel', '/check-in/ns-ci');
    const t = await text(p);
    check(t.includes('From CI analytics, read 9:00 today.') && t.includes('Confirm 20 min'), 'filled in from its source');
    check((await p.inputValue('input[name="value"]')) === '20', '20 in the field');
  },
  U157: async (p) => {
    await as(p, 'daniel', '/check-in/ns-ci');
    await p.fill('input[name="value"]', '19'); await p.check('input[value="risk"]');
    await p.selectOption('select[name="cause"]', 'Delivery slower'); await p.fill('textarea[name="why"]', 'Slower than planned this week.'); await p.fill('textarea[name="path"]', 'Split the slow suites.'); await p.fill('input[name="byWeek"]', '50');
    await p.click('button:has-text("Post check-in")');
    check((await text(p)).includes('CI analytics said 20. Say why your number is different.'), 'asks why first');
  },
  U159: async (p) => {
    await as(p, 'rhea', '/goals/lead-ci-time');
    const st = await (await fetch(`${BASE}/api/state`)).json();
    await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${st.tokens.rhea}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'link_goal_metric', arguments: { goal_id: 'lead-ci-time', metric_id: 'metric_ci-time', team_id: 'cicd', reason: 'Main-branch time is what matters now' } } }) });
    await p.goto(`${BASE}/check-in/lead-ci-time`);
    check((await text(p)).includes('CI analytics measures this for the whole company, not for CI/CD on its own, so it isn’t filled in.'), 'never fills a team’s goal');
  },
  U170: async (p) => {
    await as(p, 'rhea', '/metrics/flaky-rate/edit');
    await p.selectOption('select[name="measurement"]', 'gap'); await p.fill('input[name="measurementNote"]', 'The new runners send no results yet.');
    await p.click('button:has-text("Save the metric")');
    const t = await text(p);
    check(t.includes('Gap') && t.includes('Not measured yet: 1 goal held to no number'), 'Gap, and under To sort out');
    await p.goto(`${BASE}/goals/lead-flaky`); check((await text(p)).includes('Not measured yet'), 'its goal says Not measured yet');
  },
  U172: async (p) => {
    await as(p, 'rhea', '/metrics/flaky-rate/edit');
    await p.selectOption('select[name="parentId"]', 'metric_lead-time'); await p.selectOption('select[name="level"]', 'control'); await p.selectOption('select[name="confidence"]', 'medium');
    await p.fill('textarea[name="gaming"]', 'Quarantining a test lowers it.'); await p.click('button:has-text("Save the metric")');
    check((await text(p)).includes('A control on Lead time for changes.'), 'says where it sits');
    await p.goto(`${BASE}/metrics/lead-time`); check((await text(p)).includes('Flaky test rate'), 'its parent lists it');
  },
  N16: async (p) => {
    await as(p, 'amara', '/metrics');
    for (const id of ['lead-time', 'flaky-rate', 'queue-wait']) {
      const row = await p.locator(`[data-metric="metric_${id}"] .by-status`).innerText();
      const n = row.match(/\d+/g)?.reduce((a, b) => a + Number(b), 0) || 0;
      await p.goto(`${BASE}/metrics/${id}`); const rows = await p.locator('tr[data-goal]').count(); await p.goBack();
      check(n === rows, `${id}: the row counts ${n}, its page lists ${rows}`);
    }
  },
  N29: async (p) => {
    const before = (await (await fetch(`${BASE}/api/state`)).json()).checkIns;
    for (const to of ['/', '/check-in', '/check-in/ns-ci', '/quick-check-in']) await as(p, 'daniel', to);
    check((await (await fetch(`${BASE}/api/state`)).json()).checkIns === before, 'no check-in was made');
  },
  F15: async (p, { phone }) => {
    await as(p, 'amara', '/metrics');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(sw <= 1 || !phone, `nothing scrolls sideways (${sw}px)`);
  },
};

const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r, j) => { server.stdout.once('data', r); server.once('exit', () => j(new Error('the app didn’t start'))); });
const browser = await chromium.launch();
let failed = 0;
const only = process.argv.slice(2);
try {
  for (const [id, run] of Object.entries(J)) {
    if (only.length && !only.includes(id)) continue;
    for (const [width, vp] of Object.entries(WIDTHS)) {
      await reset();
      const c = await browser.newContext({ viewport: vp }); const p = await c.newPage(); p.setDefaultTimeout(6000);
      try { await run(p, { phone: width === 'phone' }); console.log(`PASS ${id} ${width}`); } catch (e) { failed++; console.log(`FAIL ${id} ${width}: ${e.message.split('\n')[0]} (at ${p.url()})`); }
      await c.close();
    }
  }
} finally { await browser.close(); server.kill(); }
console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
process.exit(failed ? 1 : 0);
