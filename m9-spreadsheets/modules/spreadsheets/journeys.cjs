// Drives the rebuild through the spreadsheets module's journeys (spec/modules/spreadsheets/journeys/<id>.md),
// on a phone and a desktop. node modules/spreadsheets/journeys.cjs [ids…]   (the app on :4180, or FARO_BASE)
// Writes modules/spreadsheets/journeys-results.json, and exits 1 when any journey is not DONE.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.FARO_BASE || 'http://localhost:4180';
const WIDTHS = { phone: [390, 844], desktop: [1440, 900] };
let X; // xlsx.mjs
const shot = process.env.SHOTS ? (j, n) => j.p.screenshot({ path: path.join(__dirname, 'shots', `${n}-${j.phone ? 'phone' : 'desktop'}.png`), fullPage: true }) : async () => {};

class J {
  constructor(b, phone) { this.b = b; this.phone = phone; this.steps = 0; this.fails = []; this.passes = 0; this.contexts = []; }
  async open(as) {
    const [w, h] = WIDTHS[this.phone ? 'phone' : 'desktop'];
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
  async text(scope) { return (await (scope || this.p.locator('body')).innerText()).replace(/\s+/g, ' '); }
  async shows(s, name, scope) { const t = await this.text(scope); const ok = typeof s === 'string' ? t.includes(s) : s.test(t); if (!ok && process.env.DEBUG) console.log(`   [${this.p.url()}] ${t.slice(0, 900)}`); return this.check(name || `shows “${s}”`, ok); }
  async notShows(s, name) { const t = await this.text(); return this.check(name || `doesn’t show “${s}”`, !t.includes(s)); }
  async addr(re, name) { await this.p.waitForLoadState(); return this.check(name || `address ${re}`, re.test(this.p.url())); }
  async inView(loc, name) {
    try { await loc.first().waitFor({ timeout: 3000 }); } catch { return this.check(`${name}: not there`, false); }
    const box = await loc.first().boundingBox(); const tab = await this.p.locator('nav.tabbar').isVisible().catch(() => false); const vh = this.p.viewportSize().height - (tab ? 60 : 0);
    return this.check(`${name}: in view without scrolling`, !!box && box.y + box.height <= vh && box.y >= 0);
  }
  async checkpoint(name) {
    const r = await this.p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.top < innerHeight && b.bottom > 0; };
      const dlg = document.querySelector('dialog[open]');
      const scope = dlg || document;
      const prim = [...scope.querySelectorAll('.btn.primary')].filter(vis);
      const small = [...scope.querySelectorAll('button, .btn, [role=button]')].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length;
      return { prim: prim.length, primH: prim.map((e) => e.getBoundingClientRect().height), sideways: document.documentElement.scrollWidth > innerWidth + 1, small,
        unnamed: [...scope.querySelectorAll('button, a, input, select, textarea')].filter(vis).filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label') || e.type === 'hidden')).length };
    });
    this.check(`${name}: at most one main button in view (${r.prim})`, r.prim <= 1);
    this.check(`${name}: no sideways scrolling`, !r.sideways);
    if (this.phone) this.check(`${name}: main button 44px`, r.primH.every((h) => h >= 44));
    this.check(`${name}: every control has a name (${r.unnamed})`, r.unnamed === 0);
  }
  async choose(file) { const nav = this.p.waitForNavigation({ timeout: 20000 }).catch(() => {}); await this.p.locator('#sheetfile').setInputFiles(file); await nav; await this.p.waitForURL(/\/data\/import\/(check|reading)/, { timeout: 15000 }).catch(() => {}); if (/reading/.test(this.p.url())) await this.p.waitForURL(/\/data\/import\/check/, { timeout: 60000 }).catch(() => {}); await this.p.waitForLoadState(); }
  async press(name, opt = {}) { this.step(); await (opt.scope || this.p).getByRole(opt.role || 'button', { name, exact: opt.exact }).first().click(); await this.p.waitForLoadState(); }
  async download(fn) { const [d] = await Promise.all([this.p.waitForEvent('download', { timeout: 15000 }), fn()]); const f = await d.path(); return { name: d.suggestedFilename(), buf: fs.readFileSync(f) }; }
  async close() { for (const c of this.contexts) await c.close(); this.contexts = []; }
}
const reset = async () => { await fetch(BASE + '/__reset', { method: 'POST' }); };
const csv = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });
const book = (name, buf) => ({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf });
// a downloaded workbook as sheets of rows, and back
const readWorkbook = (buf) => X.readXlsx(buf);
const writeBook = (sheets) => X.writeXlsx(sheets);
const sheetOf = (b, n) => b.find((s) => s.name === n);
const col = (s, h) => s.rows[0].indexOf(h);
async function exportAll(j, from = '/goals?scope=all') {
  await j.go(from);
  await j.p.locator('[data-export-open]').first().click();
  await j.p.locator('#exportdlg [name=which][value=all]').check().catch(() => {});
  return j.download(() => j.p.locator('#exportdlg .export-go').click());
}
const goalsOf = async () => (await (await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: 'Bearer amara', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'export', arguments: { format: 'json' } } }) })).json()).result;
const jsonNow = async () => JSON.parse((await goalsOf()).content[0].text);

const T = {};
T.U19 = { budget: 19, run: async (j) => {
  await j.open('rhea'); await j.go('/goals?scope=all');
  j.check('Table, Board and History layouts (core, stage 3: not built)', false);
  j.step(); await j.p.locator('[data-export-open]').first().click();
  await j.checkpoint('export');
  j.step(); await j.p.getByRole('button', { name: 'Other formats' }).click();
  const x = await j.download(() => j.p.locator('#exportdlg .export-go').click());
  j.check(`workbook saved as …-goals-all-{date}.xlsx: ${x.name}`, /-goals-all-2026-11-05\.xlsx$/.test(x.name));
  const js = await j.download(() => j.p.getByRole('link', { name: 'JSON' }).click());
  const data = JSON.parse(js.buf.toString()); j.check('the JSON has every goal with its check-ins', data.goals.length === 126 && data.goals.every((g) => Array.isArray(g.checkIns)));
  await j.go('/goals?scope=all&attention=1');
  j.step(); await j.p.locator('[data-export-open]').first().click();
  j.step(); const part = await j.download(() => j.p.locator('#exportdlg .export-go').click());
  j.check(`a filtered All tab saved as …-goals-as-shown-{date}.xlsx: ${part.name}`, /-goals-as-shown-2026-11-05\.xlsx$/.test(part.name));
  await j.go('/data');
  j.step(); await j.p.locator('.data-export > summary').click();
  j.step(); await j.p.getByRole('button', { name: 'Everything…' }).click();
  j.check('Export .xlsx in the Export dialog', await j.p.locator('#exportdlg .export-go').isVisible());
  await j.shows(/-goals-all-2026-11-05\.xlsx, as of week 45/, 'names an …-all-{date}.xlsx as of this week', j.p.locator('#exportdlg'));
  await j.p.keyboard.press('Escape');
  j.check('Export dialog goes away', !(await j.p.locator('#exportdlg').isVisible()));
  j.check('focus back on Export', await j.p.evaluate(() => document.activeElement?.matches('.data-export > summary')));
} };

T.U20 = { budget: 15, run: async (j) => {
  await reset(); await j.open('mateo'); await j.go('/data');
  await j.inView(j.p.locator('.data-tools .data-import'), 'Import on Data');
  j.check('Data’s tools say Export and Import', (await j.p.locator('.data-export > summary').innerText()).trim() === 'Export' && (await j.p.locator('.data-tools .data-import').innerText()).trim() === 'Import');
  j.step(); await j.p.locator('.data-tools .data-import').click();
  await j.addr(/\/data\/import$/); await j.shows('Add or change goals, plans, check-ins and people from a spreadsheet.');
  await j.checkpoint('import');
  j.step(); await j.choose(csv('goals.csv', 'Goal,Owner,Unit,Start,Target,Plan from week,Feeds into\nRunbooks with an owner,Mateo Fernández,%,40,90,40,Mean time to restore service (P1 and P2)\n'));
  await j.shows('1 new goal'); await j.checkpoint('preview');
  await j.press('Save 1 change');
  await j.shows('Saved 1 row from goals.csv.');
  await j.go('/import'); await j.addr(/\/data\/import$/, '/import leads to /data/import');
  const bad = 'Goal,Week,Value\nRunbooks with an owner,43,45\nRunbooks with an owner,47,48\n';
  j.step(); await j.choose(csv('history.csv', bad));
  await j.shows('hasn’t happened yet');
  j.check('no Save while a row must be fixed', (await j.p.getByRole('button', { name: /^Save/ }).count()) === 0);
  j.step(); await j.p.getByRole('button', { name: 'Choose the corrected file' }).click();
  await j.choose(csv('history.csv', 'Goal,Week,Value\nRunbooks with an owner,43,52\nRunbooks with an owner,44,55\n'));
  await j.shows('2 check-ins (2 for past weeks)');
  await j.press('Show the 2 changes', { role: 'link' });
  j.check('2 changes name Runbooks with an owner', (await j.p.locator('.import-change', { hasText: 'Runbooks with an owner' }).count()) === 2);
  await j.press('Save 2 changes');
  await j.addr(/\/data\/import\/done\/imp_/);
  const d = await jsonNow(); const g = d.goals.find((x) => x.title === 'Runbooks with an owner');
  j.check('the goal and its past weeks were saved, marked as loaded later', g && g.checkIns.length === 2 && g.checkIns.every((c) => c.backfilled));
  await j.go('/activity'); await j.shows('imported history.csv', 'logged as coming from a spreadsheet');
} };

T.U46 = { budget: 16, run: async (j) => {
  await reset(); await j.open('grace'); await j.go('/goals?scope=all');
  j.step(); await j.p.locator('[data-export-open]').first().click();
  await j.inView(j.p.locator('#exportdlg .export-go'), 'Export .xlsx in the sheet');
  j.check('Export dialog shows', await j.p.locator('#exportdlg').isVisible());
  await j.shows('Results', 'the sheet says it has Results', j.p.locator('#exportdlg'));
  await j.press('Other formats', { scope: j.p.locator('#exportdlg') });
  await j.shows('CSV files, zipped', 'zipped CSVs behind Other formats', j.p.locator('#exportdlg'));
  await j.checkpoint('export choices');
  await j.p.locator('#exportdlg [name=which][value=all]').check();
  const x = await j.download(() => j.p.locator('#exportdlg .export-go').click());
  const b = readWorkbook(x.buf);
  j.check(`the workbook has every sheet: ${b.map((s) => s.name).join(', ')}`, b.map((s) => s.name).join(',') === 'Start here,Goals,Plan,Check-ins,People,Results,Asks,Notes,Metrics');
  // in Excel: stop G-14 with a reason, G-37 to a new owner by email (Rhea’s email added on People), a line break in a Why
  const G = sheetOf(b, 'Goals'), Pp = sheetOf(b, 'People'), C = sheetOf(b, 'Check-ins');
  const r14 = G.rows.find((r) => r[col(G, 'Key')] === 'G-14'), r37 = G.rows.find((r) => r[col(G, 'Key')] === 'G-37');
  r14[col(G, 'Action')] = 'Stop'; r14[col(G, 'Reason')] = 'Folded into G-1 at the Q4 review';
  // (no one has an email in the demo: owner by email needs one, so Owner by name)
  r37[col(G, 'Owner')] = 'Rhea Kapoor'; r37[col(G, 'Team')] = 'CI/CD';
  await j.p.keyboard.press('Escape');
  await j.go('/data');
  j.step(); await j.p.locator('.data-tools .data-import').click();
  await j.shows('Add or change goals, plans, check-ins and people from a spreadsheet.');
  j.step(); await j.choose(book('everything.xlsx', writeBook(b)));
  await j.shows('1 goal changed, 1 goal stopped');
  await j.shows('Read Goals, Plan, Check-ins and People');
  await j.checkpoint('import preview');
  await j.press('Show the 2 changes', { role: 'link' });
  await j.addr(/\/data\/import\/check\/changes/);
  j.check('changes name both goals', (await j.p.locator('.import-change', { hasText: 'Pipeline queue wait' }).count()) === 1 && (await j.p.locator('.import-change', { hasText: 'Contract tests' }).count()) === 1);
  let d = await jsonNow(); j.check('nothing saved before Save', !d.goals.find((g) => g.key === 'G-14').stopped);
  await j.press('Save 2 changes');
  await j.addr(/\/data\/import\/done\/imp_/);
  d = await jsonNow();
  j.check('G-14 stopped, G-37 now Rhea’s', !!d.goals.find((g) => g.key === 'G-14').stopped && d.goals.find((g) => g.key === 'G-37').ownerId === 'rhea');
  await j.go('/activity?kind=imports');
  j.check('import and stop logged together', (await j.p.locator('main .rows > div', { hasText: 'imported everything.xlsx' }).count()) === 1);
  await j.press('Undo this import');
  await j.press(/^Undo \d+ rows?$/, { scope: j.p.locator('dialog[open]') });
  await j.shows('Undone:');
  d = await jsonNow();
  j.check('Undo put both goals back', !d.goals.find((g) => g.key === 'G-14').stopped && d.goals.find((g) => g.key === 'G-37').ownerId === 'tunde');
  j.check('People: “1 person has no email yet” and saving it (core: People and Workspace, not built)', false);
} };

T.U48 = { budget: 10, run: async (j) => {
  await reset(); await j.open('grace'); await j.go('/workspace/features');
  const box = j.p.getByRole('switch', { name: 'Spreadsheets' });
  j.check('Spreadsheets ticked, with what it does', (await box.isChecked()) && (await j.text()).includes('Download the goals as an Excel workbook'));
  await j.checkpoint('features');
  j.step(); await box.click(); await j.p.waitForLoadState();
  await j.shows('Spreadsheets is off in');
  await j.go('/data'); j.check('.data-tools shows', await j.p.locator('.data-tools').isVisible());
  const dataGone = (await j.p.locator('.data-export, .data-import').count()) === 0;
  await j.go('/goals?scope=all'); j.check('.goals-toolbar shows', await j.p.locator('.goals-toolbar').count() === 1);
  const goalsGone = (await j.p.locator('[data-export-open]').count()) === 0;
  await j.go('/data/import'); await j.shows('Page not found', 'Import finds nothing');
  await j.go('/import'); await j.shows('Page not found', 'the old link finds nothing');
  j.step(); await j.p.getByRole('link', { name: 'Go to Home' }).click(); await j.addr(/\/$/, 'Home shows');
  await j.go('/help'); await j.shows('Data in and out');
  const helpGone = !(await j.text()).includes('Importing from a spreadsheet');
  j.check(`spreadsheets off: Data's menu ${dataGone ? 'gone' : 'still there'}, Goals' export ${goalsGone ? 'gone' : 'still there'}, Help's article ${helpGone ? 'gone' : 'still listed'}`, dataGone && goalsGone && helpGone);
  await j.go('/activity'); await j.shows('switched Spreadsheets off', 'the switch was logged');
  await j.go('/workspace/features');
  j.step(); await j.p.getByRole('switch', { name: 'Spreadsheets' }).click(); await j.p.waitForLoadState();
  await j.shows('Spreadsheets is on in');
  await j.go('/data'); j.check('Export on Data again', await j.p.locator('.data-export > summary').isVisible());
  await j.go('/import'); await j.addr(/\/data\/import$/); await j.shows('Add or change goals, plans, check-ins and people from a spreadsheet.');
  // off, then Undo straight away (checked, not scored)
  await j.go('/workspace/features');
  await j.p.getByRole('switch', { name: 'Spreadsheets' }).click(); await j.p.waitForLoadState();
  await j.shows('Spreadsheets is off in');
  await j.p.getByRole('button', { name: 'Undo' }).last().click(); await j.p.waitForLoadState();
  await j.shows('Spreadsheets is back on.');
  j.check('Undo left it on', await j.p.getByRole('switch', { name: 'Spreadsheets' }).isChecked());
  await j.go('/data'); j.check('Export on Data after Undo', await j.p.locator('.data-export > summary').isVisible());
  await j.go('/activity'); await j.shows('switched Spreadsheets on', 'Undo logged as switching it on');
  await j.go('/workspace'); j.check('Workspace heading', await j.p.locator('h1').isVisible());
  const o = await j.open('oskar'); await j.go('/workspace/features');
  j.check('someone who isn’t an admin has no switches', (await j.p.getByRole('switch').count()) === 0);
} };

T.U87 = { budget: 8, run: async (j) => {
  await j.open('rhea'); await j.go('/data/import');
  await j.shows('What a new row must have');
  await j.shows('Goal, and Owner or Owner email. A number goal also needs Start and Target');
  await j.shows('Goal key (or Goal), Week, and Value or Stages.');
  await j.shows('Name and Email.');
  await j.checkpoint('import');
  await j.press('Every column, with its format and an example', { role: 'link' });
  await j.addr(/\/help\/columns$/); await j.shows('Every column, and what it needs');
  const rowSays = async (c, need) => (await j.p.locator('table tr', { has: j.p.locator(`td:text-is("${c}")`) }).first().innerText()).includes(need);
  j.check('Help: Goal Required, Owner Required, Start Required for a number goal, Status worked out', (await rowSays('Goal', 'Required')) && (await rowSays('Owner', 'Required')) && (await rowSays('Start', 'Required for a number goal')) && (await j.text()).includes('Worked out: Status'));
  await j.checkpoint('help');
  await j.go('/data/import');
  const t = await j.download(() => j.p.getByRole('link', { name: 'Download the template' }).click());
  const b = readWorkbook(t.buf);
  const G = sheetOf(b, 'Goals');
  const ex = G.rows.slice(1).map((r) => r[col(G, 'Action')]);
  j.check(`template: ${t.name}; sheets ${b.map((s) => s.name).join(', ')}; Goals' examples say ${ex.join(', ')}`, t.name === 'faro-template.xlsx' && b.map((s) => s.name).join(',') === 'Start here,Goals,Plan,Check-ins,People' && ex.length >= 1 && ex.every((x) => x === 'Example'));
  j.step(); await j.choose(book('faro-template.xlsx', t.buf));
  await j.shows(/\b\d+ example rows left out/, 'counts the example rows');
  await j.shows('3 example rows left out', '“3 example rows left out” (the kit’s count)');
  await j.shows('Nothing would change');
  await j.checkpoint('template loaded back');
} };

T.U88 = { budget: 20, run: async (j) => {
  await reset(); await j.open('amara'); await j.go('/data/import');
  const head = 'Goal,Owner,Team,Unit,Start,Target,Stages\n';
  const rows = Array.from({ length: 14 }, (_, i) => `Runner pool ${i + 1} ready,Rhea Kapoor,CI/DC,%,10,90,`).join('\n');
  const noOwner = (o) => ['Spare runners A', 'Spare runners B', 'Spare runners C'].map((n) => `${n},${o},,count,1,5,`).join('\n');
  const stage = 'Runner images rebuilt,Rhea Kapoor,CI/CD,,,,Draft@2; Ship@50';
  const file = (o) => csv('goals-u88.csv', `${head}${rows}\n${noOwner(o)}\n${stage}\n`);
  j.step(); await j.choose(file(''));
  await j.addr(/\/data\/import\/check$/); await j.shows('Check this import');
  await j.shows('3 rows, 1 kind of problem'); await j.shows('2 questions cover 15 rows');
  j.check('no Save, Choose the corrected file', (await j.p.getByRole('button', { name: /^Save/ }).count()) === 0 && (await j.p.getByRole('button', { name: 'Choose the corrected file' }).isVisible()));
  await j.checkpoint('preview');
  await j.press('Use CI/CD');
  await j.shows('Did you mean CI/CD?: Use CI/CD');
  j.check('the answered question has Change', await j.p.getByRole('button', { name: 'Change' }).first().isVisible());
  const fix = await j.download(() => j.p.getByRole('link', { name: 'Download the rows to fix' }).click());
  const fb = readWorkbook(fix.buf);
  j.check(`the rows to fix: ${fix.name}: ${JSON.stringify(fb[0]?.rows[0])}, ${fb[0]?.rows.length - 1} rows`, fb[0]?.rows[0][0] === 'Problem' && fb[0].rows.length === 4);
  j.step(); await j.choose(file('Rhea Kapoor'));
  await j.shows('Your 1 answer still applies.');
  await j.press('They’re not done');
  j.check('Save 18 changes is there and enabled', await j.p.getByRole('button', { name: 'Save 18 changes' }).isEnabled().catch(() => false));
  await j.checkpoint('answered');
  await j.press('Show the 18 changes', { role: 'link' });
  await j.addr(/\/data\/import\/check\/changes$/);
  await j.shows('the owner’s team; the row gave none');
  await j.press('Save 18 changes');
  await j.addr(/\/data\/import\/done\/imp_/);
  const d = await jsonNow(); const runners = d.goals.filter((g) => /^Runner pool/.test(g.title));
  j.check(`14 goals saved in CI/CD: ${runners.length}, teams ${[...new Set(runners.map((g) => g.team))]}`, runners.length === 14 && runners.every((g) => g.team === 'CI/CD'));
} };

T.U89 = { budget: 14, run: async (j) => {
  await reset(); await j.open('amara');
  const x = await exportAll(j);
  await j.go('/data/import');
  j.step(); await j.choose(book(x.name, x.buf));
  await j.shows('Nothing would change');
  await j.notShows('differs from what Faro works out today', 'an unedited workbook says nothing about worked-out cells');
  await j.checkpoint('nothing would change');
  const b = readWorkbook(x.buf); const G = sheetOf(b, 'Goals');
  for (const r of [1, 2]) G.rows[r][col(G, 'Status')] = G.rows[r][col(G, 'Status')] === 'Done' ? 'Off track' : 'Done';
  G.rows[0].push('Budget'); G.rows[1][G.rows[0].length - 1] = '12000';
  await j.go('/data/import');
  j.step(); await j.choose(book('edited.xlsx', writeBook(b)));
  await j.shows('On 2 rows, Status differs from what Faro works out today');
  await j.shows('the column Budget on Goals');
  await j.checkpoint('worked-out cells');
  const other = writeBook([{ name: 'Start here', rows: [['Faro: Start here'], ['File of', 'ws_other', 'cycle_other', 'Another Org']] }, { name: 'Goals', rows: [['Key', 'ID', 'Goal', 'Owner', 'Unit', 'Start', 'Target'], ['G-1', 'goal_x', 'Net revenue retention', 'Rhea Kapoor', '%', '90', '110'], ['G-2', 'goal_y', 'Gross margin', 'Rhea Kapoor', '%', '60', '70']] }]);
  await j.go('/data/import');
  j.step(); await j.choose(book('other.xlsx', other));
  await j.shows('This file was exported from “Another Org”');
  j.check('no Must fix or What will be saved before the question', (await j.p.getByRole('heading', { name: 'Must fix' }).count()) === 0 && (await j.p.getByRole('heading', { name: 'What will be saved' }).count()) === 0);
  await j.press('Add its rows as new goals');
  await j.shows('What will be saved');
} };

T.U90 = { budget: 14, run: async (j) => {
  await reset(); await j.open('amara'); await j.go('/data/import');
  const dev = j.phone ? 'phone' : 'desktop';
  const goals = ['Cache warm', 'Cache cold', 'Cache misses', 'Cache evictions', 'Cache size'];
  const g = [['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target', 'Plan from week'], ...goals.map((n) => [n, 'Rhea Kapoor', 'CI/CD', '%', '10', '50', '40'])];
  const c = [['Goal', 'Week', 'Value'], ...goals.flatMap((n) => [[n, '42', '16'], [n, '43', '19']])];
  const file = `u90-${dev}.xlsx`;
  j.step(); await j.choose(book(file, writeBook([{ name: 'Goals', rows: g }, { name: 'Check-ins', rows: c }])));
  await j.addr(/\/data\/import\/check$/);
  await j.press('Save 15 changes');
  await j.addr(/\/data\/import\/done\/imp_/);
  await j.shows(`Saved 15 rows from ${file}.`);
  j.check('Imported offers Undo', await j.p.getByRole('button', { name: 'Undo this import' }).isVisible());
  await j.checkpoint('imported');
  await j.go('/data');
  j.step(); await j.p.locator('.data-tools .data-import').click();
  await j.press(/^All \d+ past imports?$/, { role: 'link' });
  await j.addr(/\/data\/imports$/); await j.shows(file);
  // Rhea posts a check-in on one of the imported goals
  const r = await j.b.newContext(); await r.addCookies([{ name: 'as', value: 'rhea', url: BASE }, { name: 'today', value: '2026-11-05', url: BASE }]);
  const rp = await r.newPage(); const d0 = await jsonNow(); const gid = d0.goals.find((x) => x.title === 'Cache warm').id;
  await rp.goto(`${BASE}/check-in/${gid}`); await rp.locator('input[name=value]').fill('30'); await rp.getByRole('button', { name: /Post|Save|Check in/ }).first().click(); await rp.waitForLoadState(); await r.close();
  j.step(); await j.p.reload();
  await j.shows('1 of its 15 rows has changed since, so Undo would put back 14.');
  await j.press('Undo 14 rows');
  const dlg = j.p.locator('dialog[open]');
  await j.shows('14 rows go back to how they were on', 'Undo sheet says how many go back', dlg);
  await j.shows('Rhea Kapoor posted a check-in for week 45', 'Undo sheet names Rhea’s check-in', dlg);
  j.check('Rows that stay as they are, listed apart', await dlg.getByRole('list', { name: 'Rows that stay as they are' }).isVisible());
  await j.checkpoint('undo sheet');
  await j.press('Undo 14 rows', { scope: dlg });
  await j.shows('Undone: 14 rows put back.'); await j.shows('Undone on');
  const d = await jsonNow(); const left = d.goals.filter((x) => goals.includes(x.title)).map((x) => x.title);
  j.check(`goals left after Undo: ${left.join(', ')}`, left.length === 1 && left[0] === 'Cache warm');
  await j.go('/activity'); await j.shows(`imported ${file}`);
  j.check('Show the 15 changes', await j.p.getByText('Show the 15 changes').first().isVisible());
} };

T.U94 = { budget: 12, run: async (j) => {
  await reset(); await j.open('tunde');
  const x = await exportAll(j);
  const b = readWorkbook(x.buf); const G = sheetOf(b, 'Goals'), Pp = sheetOf(b, 'People');
  G.rows.find((r) => r[col(G, 'Key')] === 'G-37')[col(G, 'Target')] = 44;
  G.rows.find((r) => r[col(G, 'Key')] === 'G-14')[col(G, 'Target')] = 2;
  G.rows.find((r) => r[col(G, 'Key')] === 'G-37')[col(G, 'Reason')] = 'Two more service pairs agreed at the review';
  Pp.rows.find((r) => r[col(Pp, 'ID')] === 'rhea')[col(Pp, 'Job title')] = 'Head of CI';
  await j.go('/data/import');
  j.step(); await j.choose(book('mine.xlsx', writeBook(b)));
  await j.shows('1 row changes a goal you don’t own');
  await j.shows('1 row changes people. Only an admin can add or change people');
  await j.checkpoint('not yours');
  await j.press('Leave these rows out'); await j.press('Leave these rows out');
  await j.shows('2 rows are left out');
  j.check('two answers closed to their lines', (await j.p.locator('.import-answered').count()) === 2);
  await j.press('Save 1 change');
  await j.addr(/\/data\/import\/done\/imp_/);
  const d = await jsonNow();
  j.check(`G-37 ${d.goals.find((g) => g.key === 'G-37').plan.target}, G-14 ${d.goals.find((g) => g.key === 'G-14').plan.target}`, d.goals.find((g) => g.key === 'G-37').plan.target === 44 && d.goals.find((g) => g.key === 'G-14').plan.target === 3);
} };

T.U95 = { budget: 12, run: async (j) => {
  await reset(); await j.open('amara'); await j.go('/data/import');
  await j.shows('Up to 30,000 rows a file, and 5,000 changes at a time.');
  await j.inView(j.p.getByRole('button', { name: 'or paste rows from a spreadsheet' }), 'paste');
  await j.press('or paste rows from a spreadsheet');
  j.check('paste field shows', await j.p.getByLabel('Paste rows from a spreadsheet').isVisible());
  j.step(); await j.p.getByLabel('Paste rows from a spreadsheet').fill('Goal name\tOwner\tTeam\tUnit\tStart\tTargett\nPasted cache hit rate\tRhea Kapoor\tCI/CD\t%\t20\t90\n');
  await j.press('Check these rows');
  await j.addr(/\/data\/import\/check$/);
  await j.shows('A column on Goals is called “Targett”. Read it as Target?');
  await j.checkpoint('near header');
  await j.press('Read it as Target');
  await j.press('Save 1 change');
  await j.addr(/\/data\/import\/done\/imp_/);
  const d = await jsonNow(); const g = d.goals.find((x) => x.title === 'Pasted cache hit rate');
  j.check(`the pasted goal: ${g ? `${g.plan.start} to ${g.plan.target} ${g.unit}` : 'none'}`, g && g.plan.target === 90 && g.plan.start === 20);
  await j.go('/data/import');
  await j.choose(csv('titled.csv', 'Platform goals FY27\nGoal,Owner,Unit,Start,Target\nTitled goal,Rhea Kapoor,%,1,2\n'));
  await j.shows('Row 2 of titled.csv is the header row; 1 row above it was skipped.');
  await j.go('/data/import');
  await j.choose(csv('staff.csv', 'Name,Department,Salary band\nAna Silva,Ops,B\n'));
  await j.shows('Its first sheet’s headers are Name, Department, Salary band…');
  j.check('Download the template in an alert', await j.p.getByRole('alert').getByRole('link', { name: 'Download the template' }).isVisible());
} };

T.U96 = { budget: 10, run: async (j) => {
  await reset(); await j.open('amara'); await j.go('/data/import');
  j.step(); await j.choose(csv('u96.csv', 'Goal,Owner,Team,Unit,Start,Target\nOrphan cache size,,CI/CD,%,10,50\nAdopted cache size,Rhea Kapoor,CI/CD,%,10,50\n'));
  await j.addr(/\/data\/import\/check$/);
  await j.press('Leave this row out and save the rest');
  await j.shows('Orphan cache size', 'the sheet names the row', j.p.locator('dialog[open]'));
  await j.checkpoint('leave out');
  await j.press('Leave them out', { scope: j.p.locator('dialog[open]') });
  await j.shows('1 row was left out at your choice');
  j.check('focus on Save', await j.p.evaluate(() => /^Save/.test(document.activeElement?.textContent || '')));
  await j.press('Save 1 change');
  await j.addr(/\/data\/import\/done\/imp_/);
  await j.shows('1 row was left out.');
  j.check('Download them', await j.p.getByRole('link', { name: 'Download them' }).isVisible());
  const d = await jsonNow();
  j.check('the right goals saved', !!d.goals.find((g) => g.title === 'Adopted cache size') && !d.goals.find((g) => g.title === 'Orphan cache size'));
} };

// F17, from its one line in the kit: the import's preview on a phone
T.F17 = { budget: 6, phoneOnly: true, run: async (j) => {
  if (!j.phone) return;
  await reset(); await j.open('amara'); await j.go('/data/import');
  await j.inView(j.p.getByText('Choose a spreadsheet', { exact: true }).first(), 'Import’s primary action on the first screen');
  j.step(); await j.choose(csv('f17.csv', 'Goal,Owner,Team,Unit,Start,Target,Stages\nA runner goal,Rhea Kapoor,CI/DC,%,10,90,\nB runner goal,,CI/CD,%,1,5,\nRunner images,Rhea Kapoor,CI/CD,,,,Draft@2; Ship@50\n'));
  const r = await j.p.evaluate(() => ({ sideways: document.documentElement.scrollWidth > innerWidth + 1, small: [...document.querySelectorAll('main button, main .btn, main [role=button]')].filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()) }));
  j.check('nothing scrolls sideways', !r.sideways);
  j.check(`every answer and button is 44 px high: ${r.small.join(', ') || 'all'}`, r.small.length === 0);
} };

const ORDER = ['U19', 'U20', 'U46', 'U48', 'U87', 'U88', 'U89', 'U90', 'U94', 'U95', 'U96', 'F17'];
(async () => {
  X = await import('./xlsx.mjs');
  const want = process.argv.slice(2);
  if (process.env.SHOTS) fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  const b = await chromium.launch();
  const out = {};
  for (const id of ORDER.filter((x) => !want.length || want.includes(x))) {
    const res = {};
    for (const phone of [true, false]) {
      const j = new J(b, phone);
      try { await T[id].run(j); } catch (e) { let at = ''; try { at = process.env.DEBUG ? ` at ${j.p.url()}: ${(await j.text()).slice(0, 700)}` : ''; } catch {} j.fail(`stopped: ${e.message.split('\n')[0]}${at}`); }
      await j.close();
      res[phone ? 'phone' : 'desktop'] = { steps: j.steps, fails: j.fails, passes: j.passes };
    }
    const fails = [...new Set([...res.phone.fails, ...res.desktop.fails])];
    const over = Math.max(res.phone.steps, res.desktop.steps) > T[id].budget;
    out[id] = { verdict: fails.length || over ? 'PART' : 'DONE', steps: [res.phone.steps, res.desktop.steps], budget: T[id].budget, passes: res.desktop.passes, fails: over ? [...fails, `over budget: ${Math.max(res.phone.steps, res.desktop.steps)} steps`] : fails };
    console.log(id, out[id].verdict, `steps ${out[id].steps} / ${T[id].budget}`, out[id].fails.length ? `\n   - ${out[id].fails.join('\n   - ')}` : '');
  }
  await reset();
  fs.writeFileSync(path.join(__dirname, 'journeys-results.json'), JSON.stringify(out, null, 2));
  await b.close();
  process.exitCode = Object.values(out).every((x) => x.verdict === 'DONE') ? 0 : 1;
})();
