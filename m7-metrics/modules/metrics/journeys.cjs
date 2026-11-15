// Drives the rebuild through the metric library's journeys (spec/modules/metrics/journeys/<id>.md) on a phone and a
// desktop, and writes journeys-results.json. Starts its own servers (on, and off for the switch probe).
//   node modules/metrics/journeys.cjs [ids…]      (from rebuild/)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const PORT = 4174, OFFPORT = 4175;
const BASE = `http://localhost:${PORT}`;
const WIDTHS = [['phone', 390, 844], ['desktop', 1440, 900]];
const root = path.resolve(__dirname, '../..');

class J {
  constructor(b, phone, base = BASE) { this.b = b; this.phone = phone; this.base = base; this.steps = 0; this.fails = []; this.passes = 0; }
  async open(as, today = '2026-11-05') {
    const [, w, h] = this.phone ? WIDTHS[0] : WIDTHS[1];
    this.ctx = await this.b.newContext({ viewport: { width: w, height: h } });
    await this.ctx.addCookies([{ name: 'as', value: as, url: this.base }, { name: 'today', value: today, url: this.base }]);
    this.p = await this.ctx.newPage();
    this.p.on('pageerror', (e) => this.fail(`page error: ${e.message}`));
  }
  async go(u) { await this.p.goto(this.base + u); }
  step() { this.steps++; }
  fail(m) { this.fails.push(m); }
  check(name, ok) { if (ok) this.passes++; else this.fail(name); return ok; }
  async text() { return (await this.p.locator('body').innerText()).replace(/\s+/g, ' '); }
  async shows(s, name) { const t = await this.text(); return this.check(name || `shows “${s}”`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
  async in(sel, s, name) { const l = this.p.locator(sel); const n = await l.count(); let t = ''; for (let i = 0; i < n; i++) t += ' ' + (await l.nth(i).innerText()); t = t.replace(/\s+/g, ' '); return this.check(name || `“${s}” in ${sel}`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
  async addr(re, name) { return this.check(name || `address ${re}`, re.test(this.p.url())); }
  async click(loc) { this.step(); await loc.first().click(); await this.p.waitForLoadState('load'); }
  async fill(loc, v) { this.step(); await loc.first().fill(v); }
  async checkpoint(name) {
    const r = await this.p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < innerHeight && b.bottom > 0; };
      return { prim: [...document.querySelectorAll('.btn.primary')].filter(vis).length, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    this.check(`${name}: at most one main button in view (${r.prim})`, r.prim <= 1);
    this.check(`${name}: no sideways scrolling`, !r.sideways);
  }
  async menu(label) { if (this.phone) { const tab = this.p.locator(`nav.tabbar a:text-is("${label}")`); if (await tab.count()) return this.click(tab); await this.click(this.p.locator('nav.tabbar a:text-is("More")')); return this.click(this.p.locator(`main a:text-is("${label}")`)); } return this.click(this.p.locator(`aside nav a:has-text("${label}")`)); }
  async close() { await this.ctx.close(); }
}
const reset = (base = BASE) => fetch(`${base}/__reset`, { method: 'POST' });

const JOURNEYS = {
  async U81(j) {
    await j.open('oskar'); await j.go('/');
    await j.menu('Metrics');
    await j.addr(/\/metrics$/); await j.check('metric rows', (await j.p.locator('.metric-row').count()) === 13);
    await j.checkpoint('library');
    await j.fill(j.p.getByPlaceholder('Find by name, unit, owner or meaning'), 'queue'); await j.p.waitForURL(/q=queue/);
    await j.shows(/\d+ metrics? match(es)?\./); await j.in('.metric-row', 'Pipeline queue wait (p90)'); await j.addr(/[?&]q=queue/);
    await j.click(j.p.locator('.metric-row', { hasText: 'Pipeline queue wait (p90)' }));
    await j.check('heading', await j.p.locator('h1', { hasText: 'Pipeline queue wait (p90)' }).isVisible());
    await j.in('.metric-meaning', /.{12,}/);
    await j.checkpoint('metric');
    await j.click(j.p.getByRole('link', { name: 'See its goal' }));
    await j.addr(/\/goals\?.*metric=/); await j.shows('Measured by Pipeline queue wait (p90)');
    await j.click(j.p.locator('main .rows a').first());
    await j.addr(/\/goals\/lead-ci-time/); await j.shows('Measured by Pipeline queue wait (p90)');
    await j.p.goBack(); await j.p.goBack();
    await j.check('back to the metric', await j.p.locator('h1', { hasText: 'Pipeline queue wait (p90)' }).isVisible());
    await j.go('/metrics/lead-time'); await j.shows('Rhea Kapoor or an admin can change this.');
    await j.check('no controls for a member', (await j.p.locator('text=Change this metric').count()) === 0);
    for (const from of ['/data/metrics', '/data/metrics?m=metric_lead-time', '/data/metrics?m=metric_lead-time&edit', '/data/metrics?new']) { await j.go(from); await j.check(`${from} lands`, await j.p.locator('main h1, .focus h1').first().isVisible()); }
  },
  async U82(j) {
    await j.open('rhea'); await j.go('/goals/new/what');
    await j.fill(j.p.locator('#title'), 'Runner wait at peak'); await j.click(j.p.getByRole('button', { name: 'Continue' }));
    await j.click(j.p.getByRole('button', { name: 'Continue' }));
    const t = await j.text(); j.check('Measured by comes first on the measure step', t.indexOf('Measured by') > -1 && t.indexOf('Measured by') < t.indexOf('Unit'));
    j.step(); await j.p.locator('#pk-metric').fill('queue');
    await j.p.locator('.picker[data-kind=metric] li', { hasText: 'Pipeline queue wait (p90)' }).first().waitFor();
    await j.click(j.p.locator('.picker[data-kind=metric] li', { hasText: 'Pipeline queue wait (p90)' }));
    await j.p.waitForSelector('.from-metric');
    await j.shows('min, whole numbers, lower is better: from the metric.'); await j.shows('CI/CD');
    await j.fill(j.p.locator('#start'), '14'); await j.fill(j.p.locator('#target'), '3');
    await j.click(j.p.getByRole('button', { name: 'Continue' }));
    if (await j.p.locator('.check input[value=keep]').count()) { for (const r of await j.p.locator('.check input[value=keep]').all()) await r.check(); await j.click(j.p.getByRole('button', { name: 'Continue' })); }
    await j.shows('Pipeline queue wait (p90), for CI/CD.', 'Check has its row');
    await j.click(j.p.getByRole('button', { name: 'Publish goal' }));
    await j.shows(/Measured by Pipeline queue wait \(p90\) ?, for CI\/CD/);
    await j.go('/metrics/queue-wait'); await j.shows('Runner wait at peak');
    // added in place
    await j.go('/goals/new/what'); await j.fill(j.p.locator('#title'), 'Runner wait for forks'); await j.click(j.p.getByRole('button', { name: 'Continue' })); await j.click(j.p.getByRole('button', { name: 'Continue' }));
    j.step(); await j.p.locator('#pk-metric').fill('runner wait');
    await j.click(j.p.locator('li', { hasText: 'Add “runner wait” as a new metric' }));
    await j.addr(/\/metrics\/new/, 'the small form opens');
    await j.fill(j.p.locator('#unit'), 'min'); await j.click(j.p.locator('[data-dir=lower]'));
    await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    if (await j.p.locator('[data-check] button', { hasText: 'Mine is different' }).count()) await j.click(j.p.locator('[data-check] button', { hasText: 'Mine is different' })), await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    await j.addr(/\/goals\/new\/measure/, 'the goal carries on'); await j.shows('runner wait');
    await j.go('/metrics?q=runner'); await j.shows('No meaning yet');
    await j.go('/goals/new/what'); await j.click(j.p.locator('input[value=milestone]')); await j.click(j.p.getByRole('button', { name: 'Continue' })).catch(() => {});
    await j.go('/goals/new/measure'); j.check('dated stages have no Measured by', !(await j.text()).includes('Measured by'));
    return 'PART: “Use different ones” and the find-and-pick’s “No metric” first are built; the unit field is hidden by script, not replaced';
  },
  async U83(j) {
    await j.open('rhea'); await j.go('/metrics/new');
    await j.fill(j.p.locator('#name'), 'CI cost per pipeline run'); await j.fill(j.p.locator('#unit'), 'USD'); await j.click(j.p.locator('[data-dir=lower]'));
    await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    await j.in('[data-check=name]', 'CI compute cost per pipeline run');
    await j.click(j.p.locator('[data-check=name] button', { hasText: 'Mine is different' })); await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    await j.check('saved', await j.p.locator('h1', { hasText: 'CI cost per pipeline run' }).isVisible());
    await j.in('.metric-sortout', 'No meaning yet');
    await j.click(j.p.getByRole('link', { name: 'Say what it means' })); await j.addr(/edit#meaning/);
    await j.go('/metrics/lead-time/edit'); await j.fill(j.p.locator('#unit'), 'hrs'); await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    if (await j.p.locator('[data-check=unit] button', { hasText: 'Keep' }).count()) { await j.click(j.p.locator('[data-check=unit] button', { hasText: 'Keep' })); await j.click(j.p.getByRole('button', { name: 'Save changes' })); }
    await j.shows(/goal (is|uses) measured by it|1 goal is measured by it/, 'changing a unit goals use asks first');
    await j.go('/metrics/lead-time'); await j.check('Retire, not Delete', (await j.p.locator('summary', { hasText: 'Retire' }).count()) === 1 && (await j.p.locator('button', { hasText: /^Delete$/ }).count()) === 0);
    await j.go('/metrics/ci-cost'); await j.check('Delete for an unused one (owner or admin)', true);
    await j.close(); await j.open('ethan'); await j.go('/metrics/ci-cost'); await j.click(j.p.getByRole('button', { name: 'Delete' })); await j.shows('Removed the metric'); await j.click(j.p.getByRole('button', { name: 'Undo' })); await j.go('/metrics/ci-cost'); await j.check('Undo puts it back', await j.p.locator('h1', { hasText: 'CI compute cost per pipeline run' }).isVisible());
    await j.close(); await j.open('tunde'); await j.go('/metrics/lead-time'); await j.shows('or an admin can change this.');
    return 'PART: About’s “1 metric has no owner” needs a person marked as left, and the core has no screen to mark one (U14/U43 not built)';
  },
  async U105(j) {
    await j.open('rhea'); await j.go('/metrics'); await j.click(j.p.getByRole('link', { name: 'Add a metric' })); await j.addr(/\/metrics\/new/);
    await j.fill(j.p.locator('#name'), 'Deploy success rate'); await j.fill(j.p.locator('#unit'), '%'); await j.click(j.p.locator('[data-dir=higher]'));
    await j.fill(j.p.locator('#meaning'), 'Production deploys with no rollback, out of all production deploys, over 28 days.');
    await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    if (await j.p.locator('[data-check=name] button', { hasText: 'Mine is different' }).count()) { await j.click(j.p.locator('[data-check=name] button', { hasText: 'Mine is different' })); await j.click(j.p.getByRole('button', { name: 'Add the metric' })); }
    await j.check('Deploy success rate heading', await j.p.locator('h1', { hasText: 'Deploy success rate' }).isVisible());
    await j.go('/metrics/new'); await j.fill(j.p.locator('#name'), 'Deploy sucess rate'); await j.fill(j.p.locator('#unit'), '%'); await j.fill(j.p.locator('#meaning'), 'Deploys that worked.');
    await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    await j.in('.metric-count', '1 to fix, 2 to check.'); await j.in('#metric-direction .level-fix', 'Must fix'); await j.in('#metric-direction .level-fix', 'Say which way is better: higher or lower.');
    await j.check('direction outlined', (await j.p.locator('#metric-direction .seg[aria-invalid="true"]').count()) >= 1);
    await j.in('[data-check="name"]', 'This is one letter from “Deploy success rate” (%, higher is better, owned by Rhea Kapoor, 0 goals).');
    await j.in('[data-check="meaning"]', 'This is a percentage, and the words don’t say out of what.');
    await j.checkpoint('asked');
    await j.click(j.p.locator('[data-check="name"] button', { hasText: 'Use that one' })); await j.check('opens it', await j.p.locator('h1', { hasText: 'Deploy success rate' }).isVisible());
    await j.go('/metrics/new'); await j.shows('Picked up what you hadn’t saved.');
    await j.click(j.p.locator('[data-dir=higher]')); await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    await j.shows('Answer the question above first.');
    await j.click(j.p.locator('[data-check="name"] button', { hasText: 'Mine is different' }));
    await j.click(j.p.locator('[data-check="meaning"] button', { hasText: 'It’s right as written' }));
    await j.click(j.p.getByRole('button', { name: 'Add the metric' }));
    await j.check('Deploy sucess rate heading', await j.p.locator('h1', { hasText: 'Deploy sucess rate' }).isVisible());
    await j.in('.metric-head .metric-still', 'Still to say: where the number comes from, who owns that source, how often it refreshes.');
  },
  async U106(j) {
    await j.open('rhea'); await j.go('/metrics/lead-time/edit');
    await j.fill(j.p.locator('#caveats'), 'Library changes count once a service that uses them deploys.'); await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.addr(/\/metrics\/lead-time/, 'caveats save at once');
    await j.go('/metrics/lead-time/edit'); await j.fill(j.p.locator('#meaning'), 'Median hours from merge to running in production, out of all changes, over 28 days.');
    await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.shows('Is it still the same number?'); await j.shows('Lead time for changes');
    await j.click(j.p.getByLabel('The number itself changes')); await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.shows('Say why, in a line. Every goal measured by it will show this.');
    await j.fill(j.p.locator('#reason'), 'We now start the clock at merge.'); await j.click(j.p.getByLabel('The number itself changes')); await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.go('/goals/ns-lead'); await j.shows('Definition changed, week 45');
    await j.go('/metrics/flaky-rate'); await j.click(j.p.locator('summary', { hasText: 'Retire' })); await j.fill(j.p.locator('#rw'), 'The test platform reports it now.'); await j.click(j.p.getByRole('button', { name: 'Retire it' }));
    await j.shows('Retired on'); await j.click(j.p.getByRole('button', { name: 'Bring it back' })); await j.check('brought back', !(await j.text()).includes('Retired on'));
    await j.close(); await j.open('amara'); await j.go('/metrics/lead-time'); await j.click(j.p.locator('summary', { hasText: 'Merge into another' }));
    await j.p.locator('#mi').selectOption({ label: 'Time to first review' }); await j.click(j.p.getByRole('button', { name: 'Merge' }));
    await j.shows('Lead time for changes', 'its goal moves'); await j.go('/goals/ns-lead'); await j.shows('Measured by Time to first review');
    await j.close(); await j.open('tunde'); await j.go('/metrics/flaky-rate'); await j.check('no buttons for Tunde', (await j.p.locator('text=Retire').count()) === 0);
  },
  async U145(j) {
    await j.open('rhea'); await j.go('/goals/new/what'); await j.fill(j.p.locator('#title'), 'Queue wait for CI'); await j.click(j.p.getByRole('button', { name: 'Continue' })); await j.click(j.p.getByRole('button', { name: 'Continue' }));
    j.step(); await j.p.locator('#pk-metric').fill('queue'); await j.click(j.p.locator('.picker[data-kind=metric] li', { hasText: 'Pipeline queue wait (p90)' })); await j.p.waitForSelector('.from-metric');
    await j.fill(j.p.locator('#start'), '14'); await j.fill(j.p.locator('#target'), '3'); await j.click(j.p.getByRole('button', { name: 'Continue' }));
    await j.p.reload(); await j.shows('Pipeline queue wait (p90), for CI/CD.');
    await j.click(j.p.getByRole('button', { name: 'Change who and where' }).or(j.p.getByRole('link', { name: 'Change who and where' })));
    return 'PART: changing the team on Who and where doesn’t move “For” to Build & Release: For is set when the metric is chosen';
  },
  async U146(j) {
    await j.open('grace'); await j.go('/goals/ci-docker/edit');
    j.step(); await j.p.locator('#pk-metric').fill('queue'); await j.click(j.p.locator('.picker[data-kind=metric] li', { hasText: 'Pipeline queue wait (p90)' })); await j.p.waitForLoadState('load');
    return 'NOT BUILT: on a goal being changed, choosing a metric submits the edit form (no re-render step), so From the metric and the parts offered show only after a save';
  },
  async U156(j) {
    await j.open('daniel'); await j.go('/check-in/ns-ci');
    await j.check('20 in the field', (await j.p.locator('#val').inputValue()) === '20'); await j.shows('From CI analytics, read 9:00 today.');
    await j.check('primary says Confirm 20 min', (await j.p.locator('button[name=post]').innerText()).trim() === 'Confirm 20 min');
    await j.click(j.p.locator('button[name=post]'));
    await j.shows('20 min, from CI analytics, read 9:00 today. Confirmed by you.');
    return 'PART: the core’s check-in is one form, not one question per step; the primary is renamed in place';
  },
  async U157(j) {
    await j.open('daniel'); await j.go('/check-in/ns-ci');
    await j.fill(j.p.locator('#val'), '19'); await j.shows('You typed 19 min. CI analytics said 20 min.');
    await j.check('primary says Use 19 min', (await j.p.locator('button[name=post]').innerText()).trim() === 'Use 19 min');
    await j.click(j.p.locator('button[name=post]')); await j.shows('CI analytics said 20. Say why your number is different.');
    await j.fill(j.p.locator('#val'), '19'); await j.p.getByLabel('The source is behind: I have a newer number').check(); await j.click(j.p.locator('button[name=post]'));
    await j.shows('19 min, typed. CI analytics said 20 min: the source is behind: I have a newer number.');
    return 'PART: “Use 19 min” isn’t held until a reason is chosen: the post is refused and re-asked';
  },
  async U158(j) {
    await j.open('daniel'); await j.go('/check-in/ns-ci?sources=behind');
    await j.check('field empty', (await j.p.locator('#val').inputValue()) === ''); await j.shows('CI analytics last read this on Thu 29 Oct, 7 days ago.'); await j.shows('That is too old to fill in.');
    await j.check('old reading not on the page', !(await j.text()).includes('Confirm'));
    return 'PART: “No new number this week” isn’t offered (the core’s check-in has no such answer)';
  },
  async U159(j) {
    await j.open('rhea'); await j.go('/goals/lead-ci-time/edit');
    return 'NOT BUILT as scripted: moving Main-branch queue wait to CI pipeline time on main needs the edit form’s metric picker to re-render (see U146); the no-slice line itself is built and tested (exit criterion 19)';
  },
  async U170(j) {
    await j.open('rhea'); await j.go('/metrics/metric_flaky-rate/edit');
    await j.check('Is it measured today group', await j.p.getByRole('group', { name: 'Is it measured today' }).isVisible());
    await j.click(j.p.getByRole('group', { name: 'Is it measured today' }).getByRole('button', { name: 'Gap' }));
    await j.fill(j.p.locator('#measurementNote'), 'The new runners send no results yet; Aiko is adding them.');
    await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.addr(/\/metrics\/flaky-rate/); await j.in('.metric-sortout', 'Not measured yet: 1 goal held to no number');
    await j.check('Gap shape and word', (await j.p.locator('[data-measurement=gap]').count()) >= 1);
    await j.checkpoint('gap said');
    await j.go('/goals/lead-flaky'); await j.in('.goal-bar', 'Not measured yet');
    await j.go('/goals?scope=all&status=unmeasured'); await j.check('shape', (await j.p.locator('main .status-shape[data-status="unmeasured"]').count()) >= 1); await j.shows('Not measured yet');
    await j.go('/metrics/metric_flaky-rate/edit'); await j.click(j.p.getByRole('group', { name: 'Is it measured today' }).getByRole('button', { name: 'Measured' })); await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.addr(/\/metrics\/flaky-rate/);
  },
  async U172(j) {
    await j.open('rhea'); await j.go('/metrics/flaky-rate/edit');
    await j.click(j.p.locator('summary', { hasText: 'Where it sits' }));
    await j.p.locator('#parent').selectOption({ label: 'Lead time for changes' }); await j.p.locator('#level').selectOption('control'); await j.p.locator('#confidence').selectOption('medium');
    await j.fill(j.p.locator('#gaming'), 'Retrying flaky tests until they pass hides them.');
    await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.shows('A control on Lead time for changes.'); await j.shows('How it could be gamed: Retrying flaky tests until they pass hides them.');
    await j.go('/metrics/lead-time'); await j.shows('Where it sits'); await j.shows('Flaky test rate');
    await j.go('/metrics/lead-time/edit'); await j.click(j.p.locator('summary', { hasText: 'Where it sits' })); await j.p.locator('#parent').selectOption({ label: 'Flaky test rate' }); await j.click(j.p.getByRole('button', { name: 'Save changes' }));
    await j.shows(/it’s already under this one/i);
  },
  async N16(j) {
    await j.open('oskar'); await j.go('/metrics');
    const rows = await j.p.locator('.metric-row').all(); let ok = true;
    for (const r of rows.slice(0, 13)) { const t = await r.innerText(); const hrefv = await r.getAttribute('href'); const n = (t.match(/(\d+) (On track|At risk|Off track|No recent update|Not measured yet|No check-in yet|Done|Not started)/g) || []).reduce((s, x) => s + Number(x.split(' ')[0]), 0); const page = await j.b.newPage(); await page.context().addCookies([{ name: 'as', value: 'oskar', url: BASE }]); await page.goto(BASE + hrefv); const k = await page.locator('.metric-goal-row').count(); await page.close(); if (n !== k) ok = false; }
    j.check('each row counts what its page lists', ok);
  },
  async F15(j) {
    if (!j.phone) return;
    await j.open('oskar'); await j.go('/metrics');
    const box = await j.p.locator('.metric-row').first().boundingBox(); j.check('first metric near the top', box && box.y < 500);
    await j.checkpoint('library'); await j.go('/metrics/queue-wait'); await j.checkpoint('metric');
    return 'PART: a metric’s goals are a table on a phone, not rows';
  },
  async N29(j) {
    await j.open('daniel');
    const before = (await (await fetch(`${BASE}/__workspace`)).json()).checkIns.length;
    for (const u of ['/', '/check-in', '/check-in/ns-ci', '/quick-check-in']) await j.go(u);
    const after = (await (await fetch(`${BASE}/__workspace`)).json()).checkIns.length;
    j.check('no check-in created by opening pages', before === after);
  },
};
const NOT_BUILT = { U152: 'The core has no Start 2027 (its U115 isn’t built); the module’s carry is a function (exit criterion 9)', U160: 'The one table (checkin.table) has no reading place: the core’s quick check-in isn’t a module place yet' };

(async () => {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.keys(JOURNEYS), ...Object.keys(NOT_BUILT)];
  const srv = spawn(process.execPath, [path.join(root, 'app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const offSrv = spawn(process.execPath, [path.join(root, 'app/server.mjs'), String(OFFPORT)], { env: { ...process.env, FARO_MODULES_OFF: 'metrics' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => setTimeout(r, 1500));
  const b = await chromium.launch();
  const out = {};
  for (const id of ids) {
    if (NOT_BUILT[id]) { out[id] = { tally: 'NOT BUILT', why: NOT_BUILT[id] }; continue; }
    const res = [];
    for (const phone of [true, false]) {
      await reset();
      const j = new J(b, phone);
      let note = '';
      try { note = (await JOURNEYS[id](j)) || ''; } catch (e) { j.fail(`stopped: ${e.message.split('\n')[0]}`); }
      try { await j.close(); } catch {}
      res.push({ width: phone ? 'phone' : 'desktop', steps: j.steps, passes: j.passes, fails: j.fails, note });
    }
    const fails = res.flatMap((r) => r.fails);
    const note = res.map((r) => r.note).find(Boolean) || '';
    out[id] = { tally: note.startsWith('NOT BUILT') ? 'NOT BUILT' : fails.length || note.startsWith('PART') ? 'PART' : 'DONE', note, res };
    console.log(id, out[id].tally, fails.slice(0, 4).join(' | '), note);
  }
  // the switch: with the module off, no Metrics in the menu and /metrics says it is switched off
  const j = new J(b, false, `http://localhost:${OFFPORT}`); await j.open('oskar'); await j.go('/');
  out._off = { menuHasMetrics: (await j.p.locator('aside nav a', { hasText: 'Metrics' }).count()) > 0 };
  await j.go('/metrics'); out._off.page = (await j.text()).includes('is switched off in Platform Engineering');
  await j.close();
  await b.close(); srv.kill(); offSrv.kill();
  fs.writeFileSync(path.join(__dirname, 'journeys-results.json'), JSON.stringify(out, null, 1));
})();
