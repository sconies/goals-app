// Drives Feedback's journeys (spec/modules/feedback/journeys/<id>.md) on a phone and a desktop against the running rebuild.
// node modules/feedback/journeys.cjs [ids…]   Starts its own app on :4191 (FARO_PORT to change it). Writes journeys-results.json beside it.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const PORT = Number(process.env.FARO_PORT || 4191);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = [['phone', 390, 844], ['desktop', 1440, 900]];

class J {
  constructor(b, phone) { this.b = b; this.phone = phone; this.steps = 0; this.fails = []; this.passes = 0; this.contexts = []; }
  async open(as) {
    const [, w, h] = this.phone ? WIDTHS[0] : WIDTHS[1];
    const ctx = await this.b.newContext({ viewport: { width: w, height: h } });
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
  async text(scope = 'body') { return (await this.p.locator(scope).first().innerText()).replace(/\s+/g, ' '); }
  async shows(s, name, scope) { let t = ''; for (let i = 0; i < 10; i++) { t = await this.text(scope).catch(() => ''); if (typeof s === 'string' ? t.includes(s) : s.test(t)) break; await this.p.waitForTimeout(150); } return this.check(name || `shows “${s}”`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
  async inView(loc, name) {
    try { await loc.first().waitFor({ timeout: 3000 }); } catch { return this.check(`${name}: not there`, false); }
    const box = await loc.first().boundingBox(); const tab = await this.p.locator('nav.tabbar').isVisible().catch(() => false); const vh = this.p.viewportSize().height - (tab ? 60 : 0);
    return this.check(`${name}: in view without scrolling`, !!box && box.y + box.height <= vh && box.y >= 0);
  }
  async checkpoint(name) {
    const r = await this.p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.top < innerHeight && b.bottom > 0; };
      const dlg = document.querySelector('dialog[open], [role=dialog]');
      const scope = dlg || document;
      const prim = [...scope.querySelectorAll('.btn.primary')].filter(vis);
      return { prim: prim.length, primH: prim.map((e) => e.getBoundingClientRect().height), sideways: document.documentElement.scrollWidth > innerWidth + 1,
        shapes: [...document.querySelectorAll('svg.shape')].filter(vis).filter((s) => !(s.parentElement && /\S/.test(s.parentElement.textContent))).length };
    });
    this.check(`${name}: at most one main button in view (${r.prim})`, r.prim <= 1);
    this.check(`${name}: no sideways scrolling`, !r.sideways);
    if (this.phone) this.check(`${name}: main button 44px`, r.primH.every((h) => h >= 44));
    this.check(`${name}: every shape beside its word`, r.shapes === 0);
  }
  async menuWords() { return this.phone ? (await this.p.locator('nav.tabbar a').allInnerTexts()) : (await this.p.locator('aside.side nav a').allInnerTexts()).map((s) => s.split('\n')[0]); }
  async menu(label) {
    this.step();
    if (!this.phone) return this.p.locator('aside.side nav a', { hasText: new RegExp(`^${label}`) }).first().click();
    const tab = this.p.locator('nav.tabbar a', { hasText: new RegExp(`^${label}$`) });
    if (await tab.count()) return tab.first().click();
    await this.p.locator('nav.tabbar a', { hasText: 'More' }).click();
    await this.p.locator('main a', { hasText: new RegExp(`^${label}$`) }).first().click();
  }
  async addr(re, name) { await this.p.waitForLoadState(); return this.check(name || `address ${re}`, re.test(this.p.url())); }
  async close() { for (const c of this.contexts) await c.close(); this.contexts = []; }
}
const post = (p, body, type = 'application/json') => fetch(BASE + p, { method: 'POST', headers: { 'content-type': type }, body });
const reset = async () => { await post('/__reset', ''); await post('/__inbox/reset', ''); };
const dump = async () => (await post('/__inbox/dump', '')).json();
const inbox = (j) => j.p.locator('#inbox');
const article = (j, kind) => inbox(j).locator(`article[aria-label^="${kind}:"]`);

// Starts a markup: Ctrl+Shift+M on a computer; on a phone, Feedback in More, Send feedback, Mark up the last screen.
async function startMarkup(j) {
  if (j.phone) {
    await j.menu('Feedback');
    j.step(); await j.p.getByRole('button', { name: 'Send feedback' }).click();
    const dlg = j.p.getByRole('dialog', { name: 'How is the app working for you?' });
    await j.inView(dlg.getByRole('button', { name: 'Mark up the last screen' }), 'entry: Mark up the last screen');
    j.step(); await dlg.getByRole('button', { name: 'Mark up the last screen' }).click();
  } else await j.p.keyboard.press('Control+Shift+M');
  await j.p.locator('.markup-root').waitFor({ timeout: 5000 });
}
async function drag(j, from, to) {
  await j.p.mouse.move(from[0], from[1]); await j.p.mouse.down();
  for (let i = 1; i <= 5; i++) await j.p.mouse.move(from[0] + ((to[0] - from[0]) * i) / 5, from[1] + ((to[1] - from[1]) * i) / 5);
  await j.p.mouse.up();
}
async function sendHomeMarkup(j, line = 'The week strip should say which week it is') { // a helper, as the kit's sendHomeMarkup: its steps aren't counted
  const counted = j.steps;
  await j.go('/');
  await startMarkup(j);
  j.step(); await j.p.getByRole('button', { name: 'Box', exact: true }).click();
  await drag(j, [120, 140], [300, 220]);
  j.step(); await j.p.getByRole('button', { name: 'Next' }).click();
  const dlg = j.p.getByRole('dialog', { name: 'Send the markup' });
  j.step(); await dlg.getByLabel('What should change?').fill(line);
  j.step(); await dlg.getByRole('button', { name: 'Send' }).click();
  await j.shows('Sent. You’ll hear when it’s fixed.');
  j.steps = counted;
}

const T = {};
T.U41 = { budget: 14, run: async (j) => {
  await j.open('rhea'); await j.go('/goals/ns-lead');
  await j.shows(/./, 'the goal’s page shows');
  const scrollBefore = await j.p.evaluate(() => scrollY);
  if (j.phone) await startMarkup(j);
  else {
    await j.p.keyboard.press('Control+Shift+M'); await j.p.locator('.markup-root').waitFor();
    await j.p.keyboard.press('Escape');
    j.check('Escape: the markup root goes away', (await j.p.locator('.markup-root').count()) === 0);
    j.check('Escape left the page as it was', (await j.p.locator('main h1').isVisible()));
    await j.p.keyboard.press('Control+Shift+M'); await j.p.locator('.markup-root').waitFor();
  }
  j.check('the picture is the screen (an image of it shows)', await j.p.locator('.markup-root img.mk-screen').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false));
  j.check('the page is frozen', (await j.p.evaluate(() => getComputedStyle(document.documentElement).overflow)) === 'hidden');
  j.step(); await j.p.getByRole('button', { name: 'Box', exact: true }).click();
  await drag(j, [100, 200], [260, 300]);
  j.step(); await j.p.getByRole('button', { name: 'Pen', exact: true }).click();
  await drag(j, [60, 380], [220, 420]);
  j.step(); await j.p.getByRole('button', { name: 'Undo', exact: true }).click();
  await j.p.locator('.mk-surface').focus();
  await j.p.keyboard.press('n');
  for (let i = 0; i < 4; i++) await j.p.keyboard.press('Shift+ArrowDown');
  await j.p.keyboard.press('Enter');
  j.step(); await j.p.getByLabel('Note 1').fill('Hard to tell which way is better');
  await j.p.keyboard.press('Enter');
  await j.shows('Note added', 'the note was announced');
  await j.checkpoint('drawing');
  j.step(); await j.p.getByRole('button', { name: 'Next' }).click();
  const dlg = j.p.getByRole('dialog', { name: 'Send the markup' });
  j.check('.mk-preview img shows', await dlg.locator('.mk-preview img').isVisible());
  j.step(); await dlg.getByRole('button', { name: 'Send' }).click();
  j.check('an empty line says “Say what should change first”', (await dlg.getByRole('alert').innerText().catch(() => '')).includes('Say what should change first'));
  j.step(); await dlg.getByLabel('What should change?').fill('Say whether it will hit the target in words I can scan');
  j.step(); await dlg.getByRole('button', { name: 'It’s OK' }).click();
  await j.checkpoint('send');
  j.step(); await dlg.getByRole('button', { name: 'Send' }).click();
  await j.shows('Sent. You’ll hear when it’s fixed.', 'says it was sent');
  j.check('the markup root goes away', (await j.p.locator('.markup-root').count()) === 0);
  const d = await dump(); const m = d.items.find((x) => x.kind === 'markup'); if (process.env.DEBUG) console.log(JSON.stringify({ ...m, steps: m?.steps?.length }));
  j.check('logged: the markup kept its line, mood, box, note, parts, route, steps', !!m && m.line.startsWith('Say whether') && m.mood === 'meh' && m.strokes.length === 1 && m.strokes[0].kind === 'box' && m.pins.length === 1 && m.pins[0].text === 'Hard to tell which way is better' && m.route === '/goals/ns-lead' && m.goalId === 'ns-lead' && m.steps.length > 0 && m.parts.length > 0);
  j.check('the page did not move under the drawing', (await j.p.evaluate(() => scrollY)) === scrollBefore);
} };

T.U40 = { budget: 16, part: 'The check-in’s Something else cause and the research panel are the core’s (not built in the core rebuild); only the feedback part is driven.', run: async (j) => {
  await j.open('chen'); await j.go('/');
  await j.menu('Feedback');
  j.step(); await j.p.getByRole('button', { name: 'Send feedback' }).click();
  const dlg = j.p.getByRole('dialog', { name: 'How is the app working for you?' });
  j.step(); await dlg.getByRole('button', { name: 'It gets in the way' }).click();
  j.step(); await dlg.getByLabel('A few words').fill('The causes didn’t fit my week.');
  await j.checkpoint('feedback');
  j.step(); await dlg.getByRole('button', { name: 'Send', exact: true }).click();
  await j.shows('It goes to the people building this app', 'demo feedback says where it goes');
  const d = await dump(); j.check('logged: the feedback was kept, New, as Chen', d.items.some((x) => x.kind === 'feedback' && x.text === 'The causes didn’t fit my week.' && x.mood === 'bad' && x.personId === 'chen' && x.status === 'new'));
} };

T.U42 = { budget: 23, run: async (j) => {
  await j.open('amara');
  await post('/__inbox/seed', JSON.stringify([{ kind: 'feedback', workspace: 'Platform Engineering', demo: true, personId: 'tunde', personName: 'Tunde Bakare', path: '/check-in', mood: 'meh', text: 'The check-in asks too much', at: '2026-11-04T09:00:00.000Z' }]));
  await sendHomeMarkup(j, 'The week strip should say which week it is');
  await j.go('/feedback');
  j.check('an inbox row shows', await inbox(j).locator('.ibx-row').first().isVisible());
  j.check('entry: no sign-in or token asked for', (await inbox(j).locator('input[type=email], input[type=password]').count()) === 0 && !(await j.text('#inbox')).includes('Sign in'));
  const row = await inbox(j).locator('.ibx-row.mk-item').first().innerText();
  j.check('attention: the markup is listed as New, with its line and where it came from', /New/.test(row) && row.includes('The week strip should say') && row.includes('Platform Engineering'));
  await j.checkpoint('inbox');
  j.step(); await inbox(j).getByRole('button', { name: 'Connect Claude' }).click();
  j.check('Connect Claude says any token from it reads the demo’s markups too', (await inbox(j).locator('.connect').innerText()).includes('any token from it reads the demo’s markups too'));
  await inbox(j).getByRole('button', { name: 'Connect Claude' }).click();
  j.step(); await inbox(j).locator('.ibx-row.mk-item .ibx-open').first().click();
  const mk = article(j, 'Markup');
  j.check('.mk-layers img shows', await mk.locator('.mk-layers img').first().isVisible());
  j.step(); await mk.getByLabel('Show the drawing').click();
  j.check('the drawing hides', (await mk.locator('.mk-l-ink').evaluate((e) => getComputedStyle(e).visibility)) === 'hidden');
  await j.checkpoint('markup');
  j.step(); await mk.getByRole('button', { name: 'Mark in hand' }).click();
  j.check('the next item (the feedback) opens', await article(j, 'Feedback').isVisible());
  await j.shows('Marked in hand: “The week strip', 'the inbox says what was just done', '#inbox');
  j.step(); await inbox(j).getByRole('button', { name: 'Undo' }).click();
  j.check('Undo put the markup back to New', (await article(j, 'Markup').locator('.mk-status').innerText()).includes('New'));
  j.step(); await article(j, 'Markup').getByRole('button', { name: 'Mark in hand' }).click();
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  j.step(); await inbox(j).getByRole('tab', { name: 'In hand' }).click();
  j.step(); await inbox(j).locator('.ibx-row .ibx-open').first().click();
  j.check('status line says In hand', (await article(j, 'Markup').locator('.mk-status').innerText()).includes('In hand'));
  await j.shows('Marked in hand by Amara Nwosu', 'says who marked it', 'article[aria-label^="Markup:"]');
  j.check('Open GitHub issue opens a filled-in new issue', /github\.com\/new\?title=/.test(await article(j, 'Markup').getByRole('link', { name: 'Open GitHub issue' }).getAttribute('href')));
  j.step(); await article(j, 'Markup').getByLabel('Paste issue link').fill('https://github.com/sconies/goals-app/issues/101');
  j.step(); await article(j, 'Markup').getByRole('button', { name: 'Keep the link' }).click();
  await j.shows('sconies/goals-app/issues/101', 'the issue link is shown', 'article[aria-label^="Markup:"]');
  j.step(); await article(j, 'Markup').getByRole('button', { name: 'Mark fixed' }).click();
  j.step(); await article(j, 'Markup').locator('.mk-form').getByRole('button', { name: 'Mark fixed' }).click();
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  await j.shows('Nothing is in hand.', 'the fixed markup left In hand', '#inbox');
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  j.step(); await inbox(j).getByRole('tab', { name: 'New' }).click();
  const fbRow = await inbox(j).locator('.ibx-row.fb-item').first().innerText();
  j.check('attention: the feedback is listed as New, with its words and who sent it', /New/.test(fbRow) && fbRow.includes('The check-in asks too much') && fbRow.includes('Tunde Bakare'));
  j.step(); await inbox(j).locator('.ibx-row.fb-item .ibx-open').first().click();
  j.step(); await article(j, 'Feedback').getByRole('button', { name: 'Mark in hand' }).click();
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  await j.shows('Nothing new.', 'the inbox says there is nothing new', '#inbox');
  const d = await dump();
  const m = d.items.find((x) => x.kind === 'markup');
  j.check('logged: fixed, by Amara, with its issue and its What’s new entry', m.status === 'fixed' && m.statusBy === 'amara' && m.fixedIn === 'rebuild-1' && m.issueUrl.endsWith('/101'));
  j.check('logged: the feedback in hand, by Amara', d.items.find((x) => x.kind === 'feedback').status === 'in-hand');
  await j.close();
  await post('/__inbox/seed', JSON.stringify([{ kind: 'feedback', workspace: 'Platform Engineering', demo: true, personId: 'oskar', personName: 'Oskar Lindgren', path: '/', mood: 'good', text: 'Home is calm', at: '2026-11-04T10:00:00.000Z' }]));
  await j.open('rhea'); await j.go('/inbox');
  await j.addr(/\/feedback$/, 'the address becomes /feedback');
  j.check('an inbox row shows', await inbox(j).locator('.ibx-row').first().isVisible());
  await inbox(j).locator('.ibx-row .ibx-open').first().click();
  await j.shows('Only an admin can change the status of feedback.', 'a member is told who changes a status', '#inbox');
  j.check('a member is offered no way to change a status', (await inbox(j).locator('button[name=status], [data-key]').count()) === 0);
} };

T.U47 = { budget: 12, run: async (j) => {
  await j.open('rhea'); await sendHomeMarkup(j, 'The week strip is hard to read'); await j.close();
  await j.open('grace'); await j.go('/feedback');
  const row = await inbox(j).locator('.ibx-row.mk-item').first().innerText();
  j.check('entry: no sign-in or token', (await inbox(j).locator('input[type=email], input[type=password]').count()) === 0);
  j.check('attention: the markup from the demo is listed as New', /New/.test(row) && row.includes('the demo'));
  await j.checkpoint('inbox');
  j.step(); await inbox(j).locator('.ibx-row.mk-item .ibx-open').first().click();
  j.check('.mk-layers img shows', await article(j, 'Markup').locator('.mk-layers img').first().isVisible());
  j.step(); await article(j, 'Markup').getByRole('button', { name: 'Won’t fix' }).click();
  await article(j, 'Markup').locator('.mk-form').getByRole('button', { name: 'Won’t fix' }).click();
  j.check('errors: a markup can’t be marked won’t fix with no reason', (await dump()).items[0].status === 'new');
  j.step(); await article(j, 'Markup').getByLabel('Why it won’t be fixed').fill('The strip already says the week on wider screens.');
  j.step(); await article(j, 'Markup').locator('.mk-form').getByRole('button', { name: 'Won’t fix' }).click();
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  j.step(); await inbox(j).getByRole('tab', { name: 'Closed' }).click();
  j.step(); await inbox(j).locator('.ibx-row .ibx-open').first().click();
  j.check('“Won’t fix” in its status line', (await article(j, 'Markup').locator('.mk-status').innerText()).includes('Won’t fix'));
  await j.shows('Marked won’t fix by Grace', 'says who closed it', 'article[aria-label^="Markup:"]');
  await j.shows('The strip already says the week', 'says why', 'article[aria-label^="Markup:"]');
} };

function seed75() {
  const out = []; let t = Date.parse('2026-11-04T08:00:00Z');
  const at = () => new Date((t += 60000)).toISOString();
  for (let i = 0; i < 6; i++) out.push({ kind: 'markup', workspace: 'Platform Engineering', demo: true, personId: 'rhea', personName: 'Rhea Kapoor', route: '/', parts: ['The week strip'], line: `Week strip ${i + 1}`, at: at() });
  for (let i = 0; i < 3; i++) out.push({ kind: 'markup', workspace: 'Platform Engineering', demo: true, personId: 'chen', personName: 'Chen Wei', route: '/goals/ns-lead', parts: ['Scorecard'], line: `Scorecard ${i + 1}`, at: at() });
  for (let i = 0; i < 40; i++) out.push({ kind: 'markup', workspace: i % 2 ? 'Payments' : 'Platform Engineering', demo: i % 2 === 0, personId: 'x', personName: i % 3 ? 'Oskar Lindgren' : 'Jun Park', route: `/goals/g${i}`, parts: [`Part ${i}`], line: `Markup ${i + 1}`, at: at() });
  for (let i = 0; i < 26; i++) out.push({ kind: 'feedback', workspace: 'Payments', demo: false, personId: 'y', personName: i % 4 ? 'Hamid Rezaei' : 'Jun Park', path: `/page${i % 5}`, mood: ['good', 'meh', 'bad'][i % 3], text: `Feedback ${i + 1}`, at: at() });
  return out;
}
T.U52 = { budget: 30, run: async (j) => {
  await j.open('grace');
  await post('/__inbox/seed', JSON.stringify(seed75()));
  await j.go('/feedback');
  await j.inView(inbox(j).locator('.ibx-row'), 'entry: an inbox row');
  const newTab = await inbox(j).getByRole('tab', { name: 'New' }).innerText();
  const menuSays = j.phone ? true : (await j.p.locator('aside.side nav a', { hasText: 'Feedback' }).innerText()).includes('75 new');
  j.check(`attention: New 75, 25 rows on the page, the menu says “75 new” (${newTab.replace(/\s+/g, ' ')})`, /75/.test(newTab) && (await inbox(j).locator('.ibx-row').count()) === 25 && menuSays);
  await j.checkpoint('inbox of 75');
  j.step(); await inbox(j).getByLabel('Find feedback').fill('week strip'); await inbox(j).getByLabel('Find feedback').press('Enter');
  await j.shows('1 item matches.', 'the count line in the list bar’s words', '#inbox');
  j.step(); await inbox(j).locator('.ibx-row .ibx-open').first().click();
  await j.shows('6 on this part.', 'the folded row holds 6', 'article[aria-label^="Markup:"]');
  j.step(); await article(j, 'Markup').getByRole('button', { name: 'Mark in hand (all 6)' }).click();
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  await j.shows('No item matches “week strip”.', 'the folded row left New', '#inbox');
  j.step(); await inbox(j).getByRole('button', { name: 'Clear the search' }).click();
  if (j.phone) { await j.p.waitForURL((u) => !/q=week/.test(u)); j.step(); await inbox(j).getByRole('button', { name: 'Filters' }).click(); await j.p.locator('dialog.ibx-filters select[name=kind]').selectOption('feedback'); await Promise.all([j.p.waitForURL(/kind=feedback/), j.p.locator('dialog.ibx-filters').getByRole('button', { name: /^Show/ }).click()]); }
  else await Promise.all([j.p.waitForURL(/kind=feedback/), inbox(j).locator('.ibx-kind-inline select').selectOption('feedback')]);
  await j.p.waitForLoadState();
  const kinds = await inbox(j).locator('.ibx-row.mk-item').count();
  j.check('Kind feedback leaves no markups, and is in the address', kinds === 0 && /kind=feedback/.test(j.p.url()));
  await j.go('/feedback');
  j.step(); await inbox(j).getByRole('button', { name: 'Filters' }).click();
  const fd = j.p.getByRole('dialog', { name: 'Filter feedback' });
  await fd.getByLabel('From').fill('Jun Park');
  j.step(); await fd.getByRole('button', { name: /^Show \d+ items$/ }).click();
  await j.shows('Filtered by: From Jun Park', 'the person filter is said in words', '#inbox');
  j.step(); await inbox(j).getByRole('button', { name: 'Remove the filter From' }).click();
  j.check('the filter line goes away', (await inbox(j).locator('.filter-line').count()) === 0);
  const count = async () => Number(((await inbox(j).getByRole('tab', { name: 'New' }).innerText()).match(/\d+/) || [0])[0]);
  const before = await count();
  if (j.phone) {
    j.step(); await inbox(j).locator('.ibx-row .ibx-open').first().click();
    j.step(); await inbox(j).getByRole('button', { name: 'Next' }).click();
    await j.shows('2 of', 'Next went on to the second item', '#inbox');
    j.step(); await inbox(j).locator('.ibx-detail').getByRole('button', { name: 'Mark in hand' }).click();
    await j.shows('2 of', 'handling an item opened the next one', '#inbox');
    j.step(); await inbox(j).getByRole('button', { name: 'Back to the list' }).click();
  } else {
    const first = await inbox(j).locator('.ibx-detail h2').innerText();
    await Promise.all([j.p.waitForNavigation(), j.p.locator('body').press('j')]); await j.p.waitForLoadState();
    const second = await inbox(j).locator('.ibx-detail h2').innerText();
    j.check('progress: J moved to the next row', first !== second);
    await Promise.all([j.p.waitForNavigation(), j.p.keyboard.press('i')]); await j.p.waitForLoadState();
    await j.p.keyboard.press('w');
    j.step(); await inbox(j).locator('.ibx-detail .mk-form').getByLabel('Why it won’t be fixed').fill('Seen it: already on the list.');
    j.step(); await inbox(j).locator('.ibx-detail .mk-form').getByRole('button', { name: 'Won’t fix' }).click();
  }
  const after = await count();
  j.check(`progress: one at a time, New went from ${before} to ${after}`, after === before - (j.phone ? 1 : 2));
  let rounds = 0;
  while ((await count()) > 0 && rounds < 6) {
    rounds++;
    j.step(); await inbox(j).getByLabel('Select this page').check();
    j.step(); await inbox(j).getByRole('button', { name: 'Won’t fix…' }).click();
    j.step(); await inbox(j).locator('.ibx-bulk').getByLabel('Why it won’t be fixed').fill('Closed in the triage of 8 November.');
    j.step(); await inbox(j).locator('.ibx-bulk .mk-form').getByRole('button', { name: /^Won’t fix \d+$/ }).click();
    if (rounds === 1) await j.checkpoint('a batch closed');
    if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  }
  await j.shows('Nothing new.', 'nothing new', '#inbox');
  j.step(); await inbox(j).getByRole('tab', { name: 'In hand' }).click();
  j.step(); await inbox(j).getByLabel('Select this page').check();
  j.step(); await inbox(j).getByRole('button', { name: 'Mark fixed…' }).click();
  j.step(); await inbox(j).locator('.ibx-bulk .mk-form').getByRole('button', { name: /^Mark \d+ fixed$/ }).click();
  if (j.phone) { const back = inbox(j).getByRole('button', { name: 'Back to the list' }); if (await back.isVisible()) await back.click(); }
  await j.shows('Nothing is in hand.', 'the batch was marked fixed', '#inbox');
  const d = await dump();
  j.check('errors: the menu says nothing new; Closed holds all 75', !(j.phone ? false : (await j.p.locator('aside.side nav a', { hasText: 'Feedback' }).innerText()).includes('new')) && d.items.filter((x) => x.status === 'fixed' || x.status === 'wont-fix').length === 75);
  j.check('logged: all closed by Grace', d.items.every((x) => x.statusBy === 'grace'));
} };

T.U165 = { budget: 12, part: 'The Goal map (stage 6) isn’t built: only its Feedback half is driven.', run: async (j) => {
  await j.open('amara'); await j.go('/workspace/features');
  j.step(); await j.p.getByRole('checkbox', { name: /Feedback/ }).click();
  await j.shows('Feedback is off in', 'Feedback is off in …');
  await j.go('/');
  const menu = await j.menuWords();
  j.check(`the menu has no Feedback: ${menu.join(', ')}`, !menu.some((m) => /^Feedback/.test(m)));
  if (j.phone) { await j.go('/more'); j.check('More has no Feedback', !(await j.text('main')).includes('Feedback')); await j.go('/'); }
  if (!j.phone) { await j.p.keyboard.press('Control+Shift+M'); await j.p.waitForTimeout(400); j.check('Ctrl+Shift+M opened nothing', (await j.p.locator('.markup-root').count()) === 0); }
  await j.go('/feedback');
  await j.shows('Page not found'); await j.shows('Feedback is switched off in', '/feedback says Feedback is switched off');
  await j.go('/activity');
  await j.shows('switched Feedback off', 'logged: switching Feedback off');
  await j.go('/workspace/features');
  j.step(); await j.p.getByRole('checkbox', { name: /Feedback/ }).click();
  await j.shows('Feedback is on in', 'Feedback is on in …');
  await j.go('/');
  const menu2 = await j.menuWords();
  if (!j.phone) j.check('the row is back', menu2.some((m) => /^Feedback/.test(m)));
  if (!j.phone) { await j.p.keyboard.press('Control+Shift+M'); j.check('the key is back', await j.p.locator('.markup-root').waitFor({ timeout: 3000 }).then(() => true, () => false)); }
  await j.go('/feedback'); await j.shows('From every workspace and the demo', 'the page is back');
} };

T.U51 = { budget: 14, part: 'Workspace’s sections (Cycles, Access, Privacy, Recently removed, the side menu) are the core’s and not built in the core rebuild; only the inbox’s old link is driven.', run: async (j) => {
  await j.open('grace'); await j.go('/workspace?inbox=1&markup=mk_old');
  await j.addr(/\/feedback\?markup=mk_old$/, 'the address becomes /feedback?markup=mk_old');
} };
T.U53 = { budget: 45, part: 'The workspace switcher, the role line and leaving from Settings are the core’s and not built; only the inbox’s old address and Feedback beside Help are driven.', run: async (j) => {
  await j.open('rhea'); await j.go('/workspace/inbox');
  await j.addr(/\/feedback$/, 'the address becomes /feedback');
  j.check('entry: the inbox’s old address opens Feedback', (await j.p.locator('main h1').innerText()) === 'Feedback');
  if (!j.phone) {
    const items = (await j.p.locator('aside.side nav ul[aria-label="This workspace and you"] a').allInnerTexts()).map((s) => s.split('\n')[0]);
    j.check(`Feedback is beside Help in the sidebar (${items.join(', ')})`, items.indexOf('Feedback') === items.indexOf('Help') + 1);
  }
} };

(async () => {
  const here = path.resolve(__dirname, '../..');
  const srv = spawn(process.execPath, [path.join(here, 'app/server.mjs'), String(PORT)], { cwd: here, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => srv.stdout.once('data', r));
  const b = await chromium.launch();
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(T);
  const results = {};
  try {
    for (const id of ids) {
      const t = T[id]; results[id] = {};
      for (const [w] of WIDTHS) {
        await reset();
        const j = new J(b, w === 'phone');
        try { await t.run(j); } catch (e) { j.fail(`threw: ${e.message.split('\n')[0]} at ${(e.stack.match(/journeys\.cjs:(\d+)/) || [])[1]}`); }
        await j.close();
        if (j.steps > t.budget) j.fail(`budget: ${j.steps} steps > ${t.budget}`);
        results[id][w] = { steps: j.steps, passes: j.passes, fails: j.fails };
      }
      const fails = [...results[id].phone.fails, ...results[id].desktop.fails];
      results[id].tally = fails.length ? 'PART' : t.part ? 'PART' : 'DONE';
      if (t.part) results[id].note = t.part;
      console.log(`${id} ${results[id].tally} · phone ${results[id].phone.steps} steps, desktop ${results[id].desktop.steps} / ${t.budget}${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`);
    }
  } finally {
    await b.close(); srv.kill();
    fs.writeFileSync(path.join(__dirname, 'journeys-results.json'), JSON.stringify(results, null, 1));
  }
})();
