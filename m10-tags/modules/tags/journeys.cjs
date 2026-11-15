// Drives Fields' journeys (spec/modules/tags/journeys/U174, U177, U178) and check N34 on a phone and a desktop, against
// the rebuild's app started here on a port of its own. Writes journeys-results.json; exits 0 only if every one is DONE.
// node modules/tags/journeys.cjs [--port 47950] [ids…]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const args = process.argv.slice(2);
const pi = args.indexOf('--port');
const PORT = pi >= 0 ? Number(args.splice(pi, 2)[1]) : 47950;
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args.splice(oi, 2)[1] : path.join(__dirname, 'journeys-results.json');
const BASE = `http://localhost:${PORT}`;
const WIDTHS = [['phone', 390, 844], ['desktop', 1440, 900]];

class J {
  constructor(b, phone) { this.b = b; this.phone = phone; this.steps = 0; this.fails = []; this.passes = 0; this.contexts = []; }
  async open(as) {
    const [, w, h] = this.phone ? WIDTHS[0] : WIDTHS[1];
    const ctx = await this.b.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    await ctx.addCookies([{ name: 'as', value: as, url: BASE }, { name: 'today', value: '2026-11-05', url: BASE }]);
    this.contexts.push(ctx);
    this.p = await ctx.newPage();
    this.p.on('pageerror', (e) => this.fail(`page error: ${e.message}`));
    return this.p;
  }
  async go(p) { await this.p.goto(BASE + p); }
  step() { this.steps++; }
  fail(m) { this.fails.push(m); }
  check(name, ok) { if (ok) this.passes++; else this.fail(name); return ok; }
  async text(loc) { return ((await (loc || this.p.locator('body')).innerText().catch(() => '')) || '').replace(/\s+/g, ' '); }
  async shows(s, name, loc) { const t = await this.text(loc); return this.check(name || `shows “${s}”`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
  async visible(loc, name) { try { await loc.first().waitFor({ state: 'visible', timeout: 3000 }); return this.check(name, true); } catch { return this.check(name, false); } }
  async inView(loc, name) {
    try { await loc.first().waitFor({ timeout: 3000 }); } catch { return this.check(`${name}: not there`, false); }
    const box = await loc.first().boundingBox(); const tab = await this.p.locator('nav.tabbar').isVisible().catch(() => false); const vh = this.p.viewportSize().height - (tab ? 60 : 0);
    return this.check(`${name}: in view without scrolling`, !!box && box.y + box.height <= vh && box.y >= 0);
  }
  async checkpoint(name) {
    const r = await this.p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.top < innerHeight && b.bottom > 0; };
      const dlg = document.querySelector('dialog[open]');
      const prim = [...(dlg || document).querySelectorAll('.btn.primary')].filter(vis);
      const unlabelled = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis).filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).length;
      return { prim: prim.length, primH: prim.map((e) => e.getBoundingClientRect().height), sideways: document.documentElement.scrollWidth > innerWidth + 1, unlabelled,
        shapes: [...document.querySelectorAll('svg.shape')].filter(vis).filter((s) => !(s.parentElement && /\S/.test(s.parentElement.textContent))).length };
    });
    this.check(`${name}: at most one main button in view (${r.prim})`, r.prim <= 1);
    this.check(`${name}: no sideways scrolling`, !r.sideways);
    if (this.phone) this.check(`${name}: main button 44px`, r.primH.every((h) => h >= 44));
    this.check(`${name}: every shape beside its word`, r.shapes === 0);
    this.check(`${name}: every field has a label (${r.unlabelled})`, r.unlabelled === 0);
  }
  async close() { for (const c of this.contexts) await c.close(); this.contexts = []; }
}
const post = (p, form, as = 'amara') => fetch(BASE + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
const reset = () => fetch(BASE + '/__reset', { method: 'POST' });
async function fieldId(name) { const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { cookie: 'as=amara', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_fields', arguments: {} } }) }); const j = await r.json(); return [...(j.result.structuredContent?.fields || []), ...(j.result.structuredContent?.retired || [])].find((f) => f.name === name)?.id; }
/** seedStage (the kit names it, not its rows): Stage on two goals, Flaky test rate in Build, Base image build time in Discover. */
async function seedStage() {
  await post('/workspace/fields/add', { name: 'Stage', kind: 'list', values: 'Discover\nBuild\nRun' });
  const id = await fieldId('Stage');
  await post('/goals/lead-flaky/fields', { field: id, value: 'Build' });
  await post('/goals/ci-docker/fields', { field: id, value: 'Discover' });
  return id;
}
const T = {};

T.U174 = { budget: 20, run: async (j) => {
  await reset();
  const p = await j.open('amara'); await j.go('/workspace/fields');
  await j.shows('No fields yet', 'Workspace → Fields with no field does not say “No fields yet”');
  j.step(); await p.getByRole('button', { name: 'Add a field' }).click();
  const dlg = p.getByRole('dialog');
  await j.visible(dlg, 'a dialog shows');
  j.step(); await dlg.getByLabel('Name').fill('Stage');
  j.step(); await dlg.getByLabel('Values').fill('Discover\nBuild\nRun');
  await j.checkpoint('adding a field');
  j.step(); await dlg.getByRole('button', { name: 'Add the field' }).click(); await p.waitForLoadState();
  await j.shows('A list: Discover, Build, Run', 'the new field is not listed with its values', p.getByRole('list', { name: 'Fields' }));
  await j.checkpoint('fields');
  j.step(); await p.getByRole('button', { name: 'Add a field' }).click();
  j.step(); await p.getByRole('dialog').getByLabel('Name').fill('stage');
  j.step(); await p.getByRole('dialog').getByRole('button', { name: 'Add the field' }).click(); await p.waitForLoadState();
  await j.shows('There’s already a field called “Stage”.', 'a second “stage” is not refused in the rule’s words', p.locator('dialog[open]'));
  await p.keyboard.press('Escape');
  j.check('a dialog goes away', !(await p.locator('dialog[open]').count()));
  await j.go('/goals/lead-flaky');
  await j.visible(p.locator('.goal-bar'), 'the goal’s summary bar shows');
  const part = p.locator('[data-part="Fields"]');
  await j.visible(part, 'the part [data-part="Fields"] shows');
  await j.shows('Not set', 'the goal’s Fields block does not say Stage is not set', part);
  for (const v of ['Discover', 'Build']) {
    j.step(); await part.getByRole('button', { name: 'Change Stage' }).click();
    await Promise.all([p.waitForNavigation(), part.getByLabel('Stage', { exact: true }).selectOption(v)]);
    await j.shows(`Stage · ${v}`, `the block does not say Stage · ${v}`, p.locator('[data-part="Fields"]'));
  }
  j.check('(attention) the block does not say “Stage · Not set”', !(await j.text(p.locator('[data-part="Fields"]'))).includes('Stage · Not set'));
  await j.checkpoint('goal fields');
  const hist = p.locator('#history');
  await j.visible(hist, 'the History section shows');
  await j.shows('Stage: Discover → Build', 'History does not say “Stage: Discover → Build”', hist);
  await j.go('/goals/lead-flaky');
  j.check('(logged) the value and its History entry were saved', (await j.text(p.locator('[data-part="Fields"]'))).includes('Stage · Build') && (await j.text(p.locator('#history'))).includes('Stage: Discover → Build'));
} };

T.U177 = { budget: 16, run: async (j) => {
  await reset(); const id = await seedStage();
  const p = await j.open('amara'); await j.go('/goals?scope=all');
  await j.inView(p.getByRole('button', { name: /Filter(s| and sort)/ }), '(entry) the Filters button');
  j.step(); await p.getByRole('button', { name: /Filter(s| and sort)/ }).click();
  const dlg = p.getByRole('dialog', { name: 'Filter goals' });
  const grp = dlg.getByRole('group', { name: 'Stage' });
  await j.visible(grp, 'the “Stage” group in the “Filter goals” dialog shows');
  j.check('(parity) the Stage row says Discover · Build · Run · Not set', /Stage Discover Build Run Not set/.test(await j.text(grp)));
  j.step(); await grp.getByLabel('Build').check();
  await j.checkpoint('filters');
  j.step(); await dlg.getByRole('button', { name: 'Show the goals' }).click(); await p.waitForLoadState();
  const rm = p.getByRole('button', { name: 'Remove the filter Stage is Build' });
  await j.visible(rm, '(attention) the filter line does not say “Stage is Build” with Remove');
  await j.shows('Flaky test rate in the main pipelines', 'the goal in Build is not listed');
  j.check(`(progress) the goal in Discover is not listed, and the address carries the filter (${p.url()})`, !(await j.text()).includes('Base image build time') && new URL(p.url()).searchParams.get(`f.${id}`) === 'Build');
  await j.checkpoint('filtered');
  j.step(); await p.locator('details.views summary').click(); await p.getByRole('button', { name: 'Save this view…' }).click();
  const sv = p.getByRole('dialog', { name: 'Save this view' });
  j.step(); await sv.getByLabel('Name').fill('Building');
  j.step(); await sv.getByRole('button', { name: 'Save view' }).click(); await p.waitForLoadState();
  j.check('the “Save this view” dialog goes away', !(await p.locator('dialog[open]').count()));
  await j.go('/goals?scope=all');
  await j.shows('Base image build time', 'plain Goals does not list every goal');
  j.step(); await p.locator('details.views summary').click(); await p.locator('details.views a', { hasText: 'Building' }).click(); await p.waitForLoadState();
  await j.shows('Flaky test rate in the main pipelines', 'opening the view does not list the goal in Build');
  await j.visible(p.getByRole('button', { name: 'Remove the filter Stage is Build' }), '(finish) the view brought the Stage filter back');
  j.check('(logged) the view was saved with the Stage filter', new URL(p.url()).searchParams.get(`f.${id}`) === 'Build');
  await j.go('/data?t=goals');
  await j.visible(p.locator('main table'), 'the table in the main shows');
  j.check('(errors) Data’s Goals table has a Stage column', (await p.locator('main table th', { hasText: /^Stage$/ }).count()) === 1);
} };

T.U178 = { budget: 14, run: async (j) => {
  await reset(); await seedStage();
  const p = await j.open('amara'); await j.go('/data/import');
  const dl = p.getByRole('link', { name: 'Download the workbook' });
  await j.inView(dl, '(entry) the “Download the workbook” button');
  const [d] = await Promise.all([p.waitForEvent('download'), dl.click()]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'u178-')), d.suggestedFilename()); await d.saveAs(file);
  await Promise.all([p.waitForNavigation(), p.getByLabel('Choose a spreadsheet').setInputFiles(file)]);
  await j.shows(/Goals, (\d{2,}) rows/, 'the workbook’s rows were read');
  await j.shows('Nothing would change', 'the workbook loaded straight back changes something');
  j.check('(parity) the file line does not say Stage is a column nothing reads', !/nothing reads:[^.]*Stage/.test(await j.text()));
  await j.checkpoint('round trip');
  await j.go('/data/import');
  const csv = path.join(path.dirname(file), 'stages.csv'); fs.writeFileSync(csv, 'Key,Stage\r\nG-11,Operate\r\nG-23,Operate\r\n');
  await Promise.all([p.waitForNavigation(), p.getByLabel('Choose a spreadsheet').setInputFiles(csv)]);
  await j.shows('Stage says “Operate” on 2 rows. Add “Operate” to Stage, or leave these cells empty?', 'a value Stage doesn’t hold is not asked about');
  j.check('(attention) there is 1 “Add “Operate” to Stage” choice', (await p.getByLabel('Add “Operate” to Stage').count()) === 1);
  await j.checkpoint('asked');
  j.step(); await p.getByLabel('Add “Operate” to Stage').check();
  j.step(); await p.getByRole('button', { name: 'Save 2 changes' }).click(); await p.waitForLoadState();
  j.check(`the address becomes /data/import/done/imp_ (${p.url()})`, /\/data\/import\/done\/imp_/.test(p.url()));
  await j.go('/workspace/fields'); const listed = (await j.text()).includes('A list: Discover, Build, Run, Operate');
  await j.go('/goals/lead-flaky'); const a = (await j.text(p.locator('[data-part="Fields"]'))).includes('Stage · Operate'); const h = await j.text(p.locator('#history'));
  await j.go('/goals/ci-docker'); const b = (await j.text(p.locator('[data-part="Fields"]'))).includes('Stage · Operate');
  j.check('(finish) Operate was added, and the goals are in it', listed && a && b);
  j.check('(logged) History says “Stage: Build → Operate” via the spreadsheet', /via Spreadsheet · Stage: Build → Operate/.test(h));
} };

// N34 (evals/notes/34-fields-off.cjs, not in the kit): its steps are this rebuild's reading of its one line.
T.N34 = { budget: 12, run: async (j) => {
  await reset(); const id = await seedStage();
  const p = await j.open('amara'); await j.go('/workspace/features');
  j.step(); await p.getByRole('button', { name: 'Switch Fields off' }).click(); await p.waitForLoadState();
  await j.go('/goals/lead-flaky');
  j.check('no Fields block on a goal', !(await p.locator('[data-part="Fields"]').count()));
  await j.go('/workspace');
  j.check('no Fields in Workspace’s menu', !(await p.getByRole('navigation', { name: 'Workspace sections' }).getByRole('link', { name: 'Fields' }).count()));
  const r = await p.goto(BASE + '/workspace/fields');
  j.check('its address is Page not found', r.status() === 404 && (await j.text()).includes('Page not found'));
  await j.shows('Fields is switched off in Platform Engineering. An admin can switch it on in Workspace, Features.', 'its address says it is off and who can switch it on');
  await j.go('/goals?scope=all');
  j.check('no Stage filter on Goals', !(await p.getByRole('dialog', { name: 'Filter goals' }).getByRole('group', { name: 'Stage', includeHidden: true }).count()));
  await j.go(`/goals?scope=all&f.${id}=Build`);
  await j.shows('Base image build time', 'a link’s f. narrows nothing');
  await j.go('/data?t=goals');
  j.check('no Stage column on Data', !(await p.locator('main table th', { hasText: /^Stage$/ }).count()));
  await j.checkpoint('off');
  await j.go('/workspace/features');
  j.step(); await p.getByRole('button', { name: 'Switch Fields on' }).click(); await p.waitForLoadState();
  await j.go('/goals/lead-flaky');
  await j.shows('Stage · Build', 'back on, the value is there', p.locator('[data-part="Fields"]'));
  await j.go('/goals?scope=all'); j.check('back on, the Stage filter is there', (await p.getByRole('group', { name: 'Stage', includeHidden: true }).count()) === 1);
  await j.go('/data?t=goals'); j.check('back on, the Stage column is there', (await p.locator('main table th', { hasText: /^Stage$/ }).count()) === 1);
} };

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '../../app/server.mjs'), String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 200; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const b = await chromium.launch();
  const out = {};
  let bad = 0;
  try {
    for (const id of Object.keys(T).filter((x) => !args.length || args.includes(x))) {
      const res = {};
      for (const phone of [true, false]) {
        const j = new J(b, phone);
        try { await T[id].run(j); } catch (e) { j.fail(`stopped: ${e.message.split('\n')[0]}`); }
        await j.close();
        res[phone ? 'phone' : 'desktop'] = { steps: j.steps, fails: j.fails, passes: j.passes };
      }
      const fails = [...new Set([...res.phone.fails.map((f) => `phone: ${f}`), ...res.desktop.fails.map((f) => `desktop: ${f}`)])];
      const over = Math.max(res.phone.steps, res.desktop.steps) > T[id].budget;
      out[id] = { verdict: fails.length || over ? 'PART' : 'DONE', steps: [res.phone.steps, res.desktop.steps], budget: T[id].budget, passes: res.phone.passes + res.desktop.passes, fails: over ? [...fails, 'over budget'] : fails };
      if (out[id].verdict !== 'DONE') bad++;
      console.log(id, out[id].verdict, `steps ${out[id].steps} / ${T[id].budget}`, out[id].fails.length ? `\n   - ${out[id].fails.join('\n   - ')}` : '');
    }
  } finally { await b.close(); server.kill(); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  process.exit(bad ? 1 : 0);
})();
