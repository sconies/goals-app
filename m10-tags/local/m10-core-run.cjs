// Drives the rebuild through the core journeys' steps and checks (spec/core/journeys/<id>.md), on a phone and a desktop.
// node journeys/run.cjs [ids…]   (the app must run on :4173: node app/server.mjs)
const { chromium } = require('playwright');
const BASE = 'http://localhost:47961';
const WIDTHS = [['phone', 390, 844], ['desktop', 1440, 900]];

class J {
  constructor(b, phone) { this.b = b; this.phone = phone; this.steps = 0; this.fails = []; this.passes = 0; this.contexts = []; }
  async open(as, today) {
    const [, w, h] = this.phone ? WIDTHS[0] : WIDTHS[1];
    const ctx = await this.b.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([{ name: 'as', value: as, url: BASE }, ...(today ? [{ name: 'today', value: today, url: BASE }] : [{ name: 'today', value: '2026-11-05', url: BASE }])]);
    this.contexts.push(ctx);
    this.p = await ctx.newPage();
    this.p.on('pageerror', (e) => this.fail(`page error: ${e.message}`));
    return this.p;
  }
  async go(path, today) { await this.p.goto(BASE + path + (today ? `${path.includes('?') ? '&' : '?'}today=${today}` : '')); }
  step() { this.steps++; }
  fail(m) { this.fails.push(m); }
  check(name, ok) { if (ok) this.passes++; else this.fail(name); return ok; }
  async text() { return (await this.p.locator('body').innerText()).replace(/\s+/g, ' '); }
  async shows(s, name) { const t = await this.text(); return this.check(name || `shows “${s}”`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
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
      return { prim: prim.length, primH: prim.map((e) => e.getBoundingClientRect().height), sideways: document.documentElement.scrollWidth > innerWidth + 1,
        shapes: [...document.querySelectorAll('svg.shape')].filter(vis).filter((s) => !(s.parentElement && /\S/.test(s.parentElement.textContent))).length };
    });
    this.check(`${name}: at most one main button in view (${r.prim})`, r.prim <= 1);
    this.check(`${name}: no sideways scrolling`, !r.sideways);
    if (this.phone) this.check(`${name}: main button 44px`, r.primH.every((h) => h >= 44));
    this.check(`${name}: every shape beside its word`, r.shapes === 0);
  }
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

const reset = async () => { await fetch(BASE + '/__reset', { method: 'POST' }); };
const T = {};

T.U2 = { budget: 1, run: async (j) => {
  await j.open('rhea'); await j.go('/');
  await j.shows('Your goals'); await j.shows(/\d+ needs? attention/, '“N need attention”');
  await j.shows('Goals you watch'); await j.checkpoint('home');
  j.check('ring in the hero', await j.p.locator('.hero .ring').isVisible());
  j.check('attention rows have a status word', (await j.p.locator('.home-mine .attn .st-word').count()) > 0);
  const t = await j.p.locator('.home-mine .attn .t').first().boundingBox();
  j.check('first attention card on the first screen', t && t.y + t.height < j.p.viewportSize().height);
  await j.shows(/late|Late/, '“late” is shown');
  j.step(); await j.p.getByRole('link', { name: /Start check-in|Pick up where you left off/ }).click();
  await j.shows('What’s the number this week?');
} };

T.U66 = { budget: 4, run: async (j) => {
  await j.open('amara'); await j.go('/goals?scope=all');
  const box = j.p.getByRole('searchbox', { name: 'Find a goal' });
  await j.inView(box, 'Find a goal field');
  j.step(); await box.fill('rolback'); await box.press('Enter'); await j.p.waitForLoadState();
  await j.shows('No goal matches “rolback”. Showing goals that match “rollback”.');
  j.check('rows matching rollback shown', (await j.p.locator('.goal-row', { hasText: /rollback/i }).count()) > 0);
  j.check('field keeps what was typed', (await j.p.getByRole('searchbox', { name: 'Find a goal' }).inputValue()) === 'rolback');
  await j.checkpoint('near miss');
  const before = j.p.url();
  j.step(); await j.p.getByRole('button', { name: 'Clear the search' }).click(); await j.p.waitForLoadState();
  j.check('address changes', j.p.url() !== before);
  j.check('Clear the search took the search off', !/q=/.test(j.p.url()) && (await j.p.getByRole('searchbox', { name: 'Find a goal' }).inputValue()) === '');
} };

T.U65 = { budget: 6, run: async (j) => {
  await j.open('oskar'); await j.go('/');
  j.check('the menu shows', await j.p.locator(j.phone ? 'nav.tabbar' : 'aside.side').isVisible());
  if (!j.phone) j.check('Find in the sidebar', await j.p.locator('aside.side [data-find]').isVisible());
  await j.p.keyboard.press('Control+k');
  const box = j.p.locator('#find input');
  j.check('search focused when Find opens', await box.evaluate((e) => e === document.activeElement));
  await j.p.waitForTimeout(250);
  await j.shows(/Type a name|lately/, 'Find says what to type');
  await j.checkpoint('find');
  j.step(); await box.fill('G-48'); await j.p.waitForTimeout(400);
  j.check('“Goals · 1”', (await j.p.locator('#find').innerText()).includes('Goals · 1'));
  await box.press('Enter'); await j.p.waitForLoadState();
  await j.addr(/\/goals\/mttr-oncall/, 'Enter opened G-48');
  j.check('Find dialog gone', !(await j.p.locator('#find[open]').count()));
  await j.p.keyboard.press('Control+k');
  j.step(); await j.p.locator('#find input').fill('rhea'); await j.p.waitForTimeout(400);
  const ft = await j.p.locator('#find').innerText();
  j.check('“People · 1”', ft.includes('People · 1'));
  j.check('groups are Goals, People, Teams', /Goals · 8[\s\S]*People · 1[\s\S]*Teams · 1/.test(ft));
  j.check('Goals: three rows and See all 8 goals', ft.includes('See all 8 goals') && (await j.p.locator('#find a[data-row][href^="/goals/"]').count()) === 3);
  const seeAll = await j.p.locator('#find a', { hasText: 'See all 8 goals' }).getAttribute('href');
  j.check('See all opens Goals with the search', /\/goals\?.*q=rhea/.test(seeAll));
  await j.checkpoint('rhea');
  for (let i = 0; i < 5; i++) await j.p.locator('#find input').press('ArrowDown');
  await j.p.locator('#find input').press('Enter'); await j.p.waitForLoadState();
  await j.addr(/\/teams\/cicd/, 'Enter on CI/CD opened /teams/cicd');
  await j.p.keyboard.press('Control+k'); await j.p.keyboard.press('Escape');
  j.check('Escape closes Find', !(await j.p.locator('#find[open]').count()));
} };

T.U58 = { budget: 12, run: async (j) => {
  await j.open('oskar'); await j.go('/');
  await j.menu('People');
  await j.addr(/\/demo\/people/, 'address becomes /demo/people (the journey’s words; this rebuild has /people)');
  j.check('people rows', (await j.p.locator('.people-row').count()) > 0);
  const box = j.p.getByRole('searchbox', { name: 'Find by name, job title or team' });
  await j.inView(box, 'Find by name field');
  await j.shows('97 people', 'People’s count line');
  await j.checkpoint('people');
  j.step(); await box.fill('rhea'); await box.press('Enter'); await j.p.waitForLoadState();
  await j.shows('1 person matches.');
  await j.addr(/[?&]q=rhea/, 'the search is in the address');
  j.step(); await j.p.locator('.people-row').first().click();
  j.check('Rhea Kapoor heading', await j.p.getByRole('heading', { name: 'Rhea Kapoor' }).isVisible());
  const see = j.p.getByRole('link', { name: /See Rhea’s \d+ goals/ });
  await j.inView(see, 'See Rhea’s N goals');
  await j.checkpoint('person');
  j.step(); await see.click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\?.*owner=rhea/, 'opens Goals by owner');
  await j.shows('Rhea Kapoor');
  await j.p.goBack();
  j.check('back on Rhea', await j.p.getByRole('heading', { name: 'Rhea Kapoor' }).isVisible());
  await j.go('/teams');
  j.check('team rows', (await j.p.locator('.team-row').count()) > 0);
  await j.checkpoint('teams');
  j.step(); await j.p.locator('.team-row', { hasText: 'CI/CD' }).first().click();
  j.check('CI/CD heading', await j.p.getByRole('heading', { name: 'CI/CD' }).isVisible());
  await j.checkpoint('team');
  await j.go('/goals?show=teams');
  j.fail('Goals’ By team (show=teams) is not built: the kit names it but gives no screen words for it');
  await j.go('/teams/cicd');
  j.step(); await j.p.getByRole('link', { name: /See its \d+ goals/ }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\?.*team=cicd/, 'See its N goals opens Goals by team');
  j.check('no button that changes people or teams for a member', (await j.p.locator('main form button').count()) === 0);
  j.fail('old addresses: the journey’s table of old addresses (`old`) is not in the kit');
} };

T.U64 = { budget: 10, run: async (j) => {
  await reset();
  await j.open('amara'); await j.go('/activity');
  const box = () => j.p.getByRole('searchbox', { name: 'Find a change' });
  await j.inView(box(), 'Find a change');
  j.step(); await box().fill('Rhea'); await box().press('Enter'); await j.p.waitForLoadState();
  await j.shows(/changes? match(es)?\./, 'count line counts the matches');
  j.check('count line read out', await j.p.locator('.count-line[role="status"]').isVisible());
  await j.addr(/[?&]q=Rhea/, 'search in the address');
  await j.checkpoint('activity search');
  await j.p.goBack(); await j.p.waitForLoadState();
  j.check('Back returns to the list before the search', !/q=/.test(j.p.url()) && (await box().inputValue()) === '');
  await j.p.goForward();
  j.step(); await box().fill('zzzz'); await box().press('Enter'); await j.p.waitForLoadState();
  await j.shows('No change matches “zzzz”.');
  j.step(); await j.p.getByRole('button', { name: 'Clear the search' }).click(); await j.p.waitForLoadState();
  j.step(); await j.p.getByRole('group', { name: 'Kind of change' }).getByRole('button', { name: 'Check-ins' }).click(); await j.p.waitForLoadState();
  await j.shows('Filtered by: Kind Check-ins');
  await j.addr(/kind=checkins/, 'filter in the address');
  await j.p.goBack(); await j.p.waitForLoadState();
  j.check('Back took the filter off', !/kind=checkins/.test(j.p.url()) && !(await j.p.locator('.filterline').count()));
  await j.p.goForward(); await j.p.waitForLoadState();
  j.step(); await j.p.getByRole('button', { name: 'Remove the filter Kind' }).click(); await j.p.waitForLoadState();
  j.check('Remove took the filter off', !(await j.p.locator('.filterline').count()) && !/kind=/.test(j.p.url()));
  await j.go('/help');
  const hb = j.p.getByRole('searchbox', { name: 'Find in Help' });
  j.step(); await hb.fill('xylophone'); await hb.press('Enter'); await j.p.waitForLoadState();
  await j.shows('No article matches “xylophone”.');
} };

T.U69 = { budget: 1, run: async (j) => {
  await j.open('rhea');
  const PAGES = [['/', 'Home', 'Home'], ['/goals', 'Goals', 'Goals'], ['/goals?scope=all', 'Goals', 'Goals'], ['/goals/lead-mq', 'Merge queue live for every monorepo', 'Goals'], ['/goals/lead-mq?review=weekly', 'Merge queue live for every monorepo · Platform leadership weekly', 'Reviews'], ['/check-in', 'Check-in', 'Check-in'], ['/people/rhea', 'Rhea Kapoor', 'People'], ['/teams/cicd', 'CI/CD', 'People'], ['/activity', 'Activity', 'Activity'], ['/settings', 'Settings', 'Settings'], ['/help', 'Help', 'Help'], ['/whats-new', 'What’s new', 'Help'], ['/nowhere', 'Page not found', '']];
  const wrong = [];
  for (const [a, name, lit] of PAGES) {
    await j.go(a);
    const title = await j.p.title();
    if (title !== `${name} · Platform Engineering · Faro`) wrong.push(`${a} title “${title}”`);
    const litText = j.phone ? (await j.p.locator('nav.tabbar [aria-current="page"]').allInnerTexts()).join() : (await j.p.locator('aside.side [aria-current="page"]').allInnerTexts()).join().replace(/\d+$/, '').trim();
    const want = j.phone ? (['Home', 'Check-in', 'Goals', 'Reviews'].includes(lit) ? lit : lit ? 'More' : '') : lit;
    if (!litText.startsWith(want) || (!want && litText)) wrong.push(`${a} lit “${litText}”, not “${want}”`);
  }
  j.check(`titles and lit items: ${wrong.join('; ')}`, !wrong.length);
  await j.checkpoint('titles');
  const titles = new Set();
  for (const g of ['ns-lead', 'lead-mq', 'cost-rightsize', 'mttr-oncall', 'ci-docker', 'rel-cfr']) { await j.go(`/goals/${g}`); titles.add(await j.p.title()); }
  j.check(`six goals gave ${titles.size} titles`, titles.size === 6);
} };

T.U70 = { budget: 9, run: async (j) => {
  await reset();
  await j.open('rhea');
  const want = [['/goals/lead-merge', 'Lead time for changes'], ['/goals/ns-lead', 'Goals'], ['/people/rhea', 'People']];
  const wrong = [];
  for (const [a, label] of want) { const c = await j.b.newContext(); await c.addCookies([{ name: 'as', value: 'rhea', url: BASE }]); const p = await c.newPage(); await p.goto(BASE + a); const t = await p.locator('main .backlink').innerText().catch(() => ''); if (!t.includes(label)) wrong.push(`${a}: “${t}”`); await c.close(); }
  for (const a of ['/', '/goals?scope=all', '/settings', '/reviews', '/activity']) { await j.go(a); if (await j.p.locator('main .backlink').count()) wrong.push(`${a} has a back link`); }
  j.check(`new tabs: ${wrong.join('; ')}`, !wrong.length);
  await j.go('/goals?scope=all');
  await j.menu('Home'); await j.p.waitForLoadState();
  await j.menu('Goals'); await j.p.waitForLoadState();
  await j.addr(/\/goals$/, 'address /goals');
  j.step(); await j.p.locator('main a[href*="/goals/ns-lead"]').first().click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/ns-lead$/);
  j.check('a goal opened from Goals (Mine) says ‹ your goals', (await j.p.locator('main .backlink').innerText()).includes('your goals'));
  j.step(); await j.p.getByLabel('More about this goal').first().click();
  j.step(); await j.p.getByRole('group', { name: 'More about this goal' }).getByRole('link', { name: 'Change this goal' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/edit$/);
  await j.p.getByRole('button', { name: 'Save changes' }).click(); await j.p.waitForURL(/\/goals\/ns-lead$/, { timeout: 5000 }).catch(() => {}); await j.p.waitForTimeout(500);
  await j.addr(/\/goals\/ns-lead$/);
  await j.p.goBack(); await j.p.waitForLoadState();
  await j.addr(/\/goals$/, 'after saving, Back goes to Goals (stepping over the form)');
  await j.p.goForward(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/ns-lead/, 'Forward returns to the goal');
  j.step(); await j.p.locator('main .backlink').click(); await j.p.waitForLoadState();
  await j.addr(/\/goals$/, 'back link goes to Goals');
  await j.p.goForward(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/ns-lead/, 'Forward after the back link');
  if (!j.phone) j.fail('Settings’ section links (`.section-links`) are not built');
  j.fail('Save this view… (saved views) is not built');
  await j.go('/no-such-page');
  await j.shows('Page not found');
  await j.p.locator('.not-found .find-input').fill('rhea'); await j.p.waitForTimeout(400);
  j.check('Page not found’s Find finds Rhea', await j.p.locator('.not-found [role=option]', { hasText: 'Rhea Kapoor' }).isVisible());
} };

T.U71 = { budget: 10, run: async (j) => {
  await reset();
  await j.open('rhea'); await j.go('/');
  await j.menu('Check-in'); await j.p.waitForLoadState();
  j.check('To do this week', await j.p.getByRole('heading', { name: 'To do this week' }).isVisible());
  const start = j.p.getByRole('link', { name: /^Start with / });
  await j.inView(start, 'Start with link');
  j.check('each row says its status and what it last said', (await j.p.locator('.ciq-row').count()) === (await j.p.locator('.ciq-row .st-word').count()));
  if (!j.phone) j.check('Check-in lit', (await j.p.locator('.side [aria-current="page"]').count()) === 1);
  await j.checkpoint('queue');
  j.step(); await start.click(); await j.p.waitForLoadState();
  await j.shows(/Week 45/, 'a week in the check-in');
  j.step(); await j.p.getByRole('button', { name: 'Close and keep the draft' }).click(); await j.p.waitForLoadState();
  j.check('back on the list', await j.p.getByRole('heading', { name: 'To do this week' }).isVisible());
  j.step(); await j.p.locator('.ciq-row a', { hasText: 'Check in:' }).first().click(); await j.p.waitForLoadState();
  await j.addr(/\/check-in\/.+/);
  const title = (await j.p.locator('h1').innerText()).replace('Check in: ', '');
  j.step(); await j.p.getByLabel('This week’s value').fill('1');
  j.step(); await j.p.getByRole('button', { name: 'Close and keep the draft' }).click(); await j.p.waitForLoadState();
  j.check(`back on the list with “Draft kept” on ${title}`, (await j.p.locator('.ciq-row', { hasText: title }).innerText()).includes('Draft kept'));
  j.step(); await j.p.getByRole('link', { name: 'Or type all your numbers in one table' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/quick-check-in$/);
  j.check('the table’s page is named', (await j.p.title()).startsWith('Check-in, all in one table'));
  await j.go('/');
  j.step(); await j.p.getByRole('link', { name: /Start check-in|Pick up where you left off/ }).click(); await j.p.waitForLoadState();
  await j.addr(/check-in\?start=1/);
  await j.shows(/Week 45/, 'a week in the check-in');
  await j.go('/?as=oskar'); await j.go('/check-in');
  await j.shows('You don’t own a goal in');
  j.check('See the goals you watch and Set up a goal', await j.p.getByRole('link', { name: 'See the goals you watch' }).isVisible() && await j.p.getByRole('link', { name: 'Set up a goal' }).isVisible());
} };

T.U122 = { budget: 6, run: async (j) => {
  await reset();
  await j.open('tunde', '2026-11-09'); await j.go('/', '2026-11-09');
  const lead = await j.p.locator('.hero').innerText();
  j.check(`Monday’s Home: “${lead.replace(/\s+/g, ' ')}”`, /Nothing is asked of you today/.test(lead) && !/deadline/.test(lead));
  j.check('no primary button on Monday', !(await j.p.locator('.page.home .btn.primary').count()));
  const links = await j.p.locator('.home-mine .home-counts a').all();
  for (let i = 0; i < links.length; i++) {
    const a = j.p.locator('.home-mine .home-counts a').nth(i);
    const n = Number((await a.innerText()).match(/\d+/)[0]);
    j.step(); await a.click(); await j.p.waitForLoadState();
    await j.addr(/\/goals\?scope=mine&status=/);
    const line = await j.p.locator('.count-line').innerText();
    j.check(`count “${n}” opened “${line}”`, line.startsWith(`${n} `));
    await j.p.goBack(); await j.p.waitForLoadState();
  }
  await j.checkpoint('monday');
  await j.go('/', '2026-11-11');
  const wed = await j.p.locator('.hero').innerText();
  j.check(`Wednesday: both in, one sentence with the next date (“${wed.replace(/\s+/g, ' ')}”) — the kit’s workspace has no check-ins after 5 Nov`, /in for week 46|are in/.test(wed));
  await j.go('/', '2026-11-13');
  const fri = await j.p.locator('.hero').innerText();
  j.check(`Friday: the deadline he met is not said (“${fri.replace(/\s+/g, ' ')}”)`, !/Thursday 12 Nov/.test(fri) || /still to do/.test(fri));
  await j.checkpoint('friday');
  await j.go('/?as=rhea', '2026-11-11');
  const rl = await j.p.locator('.hero').innerText();
  j.check(`Rhea’s Wednesday lead: “${rl.replace(/\s+/g, ' ')}”`, /check-ins? to do/.test(rl) && (await j.p.locator('.hero .btn.primary').count()) === 1);
  j.step(); await j.p.getByRole('link', { name: /Start check-in|Pick up where you left off/ }).click(); await j.p.waitForLoadState();
  await j.addr(/\/check-in/);
} };

T.U77 = { budget: 10, run: async (j) => {
  await reset();
  await j.open('rhea'); await j.go('/goals/ns-lead');
  j.check('summary bar', await j.p.locator('.goal-bar').isVisible());
  const again = j.p.locator('.goal-bar .bar-actions a', { hasText: 'Check in again' });
  await j.inView(again, 'Check in again');
  await j.inView(j.p.getByRole('heading', { name: 'Next steps and asks' }), 'Next steps and asks heading');
  await j.checkpoint('goal page, owner');
  j.step(); await again.click(); await j.p.waitForLoadState();
  await j.addr(/\/check-in\/ns-lead/);
  await j.go('/goals/ns-lead?as=amara');
  j.step(); await j.p.locator('.step-row button', { hasText: 'Mark done' }).first().click();
  j.step(); await j.p.locator('.step-row .step-panel:visible button[type=submit]').first().click(); await j.p.waitForLoadState();
  await j.shows('Done lately');
  await j.go('/goals/ns-lead?as=rhea');
  await j.shows('No next step yet. Nobody has said what happens next');
  const add = j.p.locator('.goal-bar .bar-actions button', { hasText: 'Add a next step' });
  await j.inView(add, 'Add a next step');
  j.step(); await add.click();
  const dlg = j.p.getByRole('dialog', { name: 'Add a next step' });
  j.step(); await dlg.getByRole('button', { name: 'Add the next step' }).click();
  j.check('empty next step explained', await dlg.getByRole('alert').filter({ hasText: 'Say what needs doing.' }).isVisible() && await dlg.getByRole('alert').filter({ hasText: 'Choose a week.' }).isVisible());
  j.step(); await dlg.getByLabel('What needs doing').fill('Book the finance review slot for the runner budget');
  await dlg.locator('select').selectOption({ index: 2 });
  j.step(); await dlg.getByRole('button', { name: 'Add the next step' }).click(); await j.p.waitForLoadState();
  j.check('step row shows', (await j.p.locator('.step-row', { hasText: 'Book the finance review slot' }).count()) > 0);
  const main = await j.p.locator('.goal-bar .bar-actions .btn.primary').allInnerTexts();
  j.check(`after adding, gap gone and main button is to mark it done (${main})`, !(await j.text()).includes('No next step yet') && main.join() === 'Mark your next step done');
} };

T.U78 = { budget: 6, run: async (j) => {
  await reset();
  await j.open('rhea'); await j.go('/goals/ns-lead');
  const btns = await j.p.locator('#ask-req_po164 button').allInnerTexts();
  j.check(`as Rhea the row’s buttons are ${btns}`, btns.join() === 'Withdraw');
  await j.go('/goals/ns-lead?as=amara');
  await j.shows('For you');
  const ask = 'merge queue';
  const n = (await j.text()).split('Decision or help:').length - 1;
  j.check(`the ask’s words appear once (${n})`, n === 1);
  j.check('Why points to the list', await j.p.locator('.why-block').getByText('Waiting on a decision from Amara: see Next steps and asks').isVisible());
  const main = j.p.locator('.goal-bar .bar-actions .btn.primary');
  await j.inView(main, 'main button');
  await j.checkpoint('goal page, asked');
  j.step(); await main.click();
  j.step(); await j.p.locator('.step-row .step-panel:visible textarea').fill('Approved for Q4, from the platform reserve.');
  j.step(); await j.p.locator('.step-row .step-panel:visible button[type=submit]').click(); await j.p.waitForLoadState();
  j.check('row settled', (await j.p.locator('.step-row.is-settled', { hasText: 'Approved for Q4' }).count()) > 0);
  j.check('why pointer gone', !(await j.p.locator('.why-block .why-pointer').count()));
} };

T.U141 = { budget: 4, run: async (j) => {
  await reset();
  await j.open('hamid'); await j.go('/goals/ci-docker');
  j.check('status on the bar', await j.p.locator('.goal-bar .status').first().isVisible());
  j.step(); await j.p.getByLabel('More about this goal').first().click();
  await j.inView(j.p.getByRole('group', { name: 'More about this goal' }).getByRole('link', { name: 'Change this goal' }), 'Change this goal');
  j.check('no check-in offered to an admin', !(await j.p.locator('.goal-bar a', { hasText: /Check in/ }).count()));
  await j.open('rhea'); await j.go('/goals/ci-docker');
  const ci = j.p.locator('.goal-bar .bar-actions a', { hasText: /Check in/ }).first();
  j.check('owner has Check in on the bar', await ci.isVisible());
  j.step(); await ci.click(); await j.p.waitForLoadState();
  await j.shows('This week’s value');
} };

T.U24 = { budget: 8, run: async (j) => {
  await reset();
  const a = await j.open('tariq'); await j.go('/goals/ns-ai/edit');
  const ca = await j.b.newContext({ viewport: j.p.viewportSize() }); j.contexts.push(ca); await ca.addCookies([{ name: 'as', value: 'tariq', url: BASE }]);
  const b = await ca.newPage(); await b.goto(BASE + '/goals/ns-ai/edit');
  j.step(); await a.getByLabel('Name', { exact: true }).fill('AI-assisted pull request review');
  j.step(); await a.getByRole('button', { name: 'Save changes' }).click(); await a.waitForURL(/\/goals\/ns-ai$/, { timeout: 5000 }).catch(() => {});
  j.check('A’s save shown', (await a.locator('body').innerText()).includes('AI-assisted pull request review'));
  await b.locator('summary', { hasText: 'More details' }).click();
  j.step(); await b.getByLabel('Data source').fill('Engineering metrics warehouse');
  j.step(); await b.getByRole('button', { name: 'Save changes' }).click(); await b.waitForTimeout(1000);
  j.check('“Someone else changed this a moment ago”', (await b.locator('body').innerText()).includes('Someone else changed this a moment ago'));
  await a.goto(BASE + '/goals/ns-ai');
  const t = await a.locator('body').innerText();
  j.check('first save kept, second refused', t.includes('AI-assisted pull request review') && !t.includes('Engineering metrics warehouse'));
} };

T.U123 = { budget: 4, run: async (j) => {
  await reset();
  await j.open('rhea', '2026-11-11'); await j.go('/', '2026-11-11');
  const blk = j.p.locator('[data-part="Your team"]');
  j.check('Your team block', await blk.isVisible());
  j.check('heading “Your team · CI/CD”', (await blk.locator('h2').innerText()).startsWith('Your team · CI/CD'));
  const total = Number((await blk.locator('h2 .meta').first().innerText()).trim());
  const sum = (await blk.locator('.home-counts a').allInnerTexts()).reduce((s, x) => s + Number(x.match(/\d+/)[0]), 0);
  j.check(`counts add to the total (${sum} of ${total})`, sum === total);
  const said = await blk.locator('a.home-team-needs').innerText();
  const k = Number(said.match(/\d+/)[0]);
  const rows = await blk.locator('.rows a').allInnerTexts();
  j.check(`lists up to four rows, owner first, never Rhea (${rows.length})`, rows.length === Math.min(4, k) && rows.every((r) => !r.startsWith('Rhea')));
  j.step(); await blk.getByRole('link', { name: 'See them in Goals' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\?scope=team/);
  const line = await j.p.locator('.count-line').innerText();
  j.check(`Your team says ${total}, Goals says “${line}”`, line.startsWith(`${total} `));
  await j.p.goBack(); await j.p.waitForLoadState();
  j.step(); await j.p.locator('[data-part="Your team"] a.home-team-needs').click(); await j.p.waitForLoadState();
  await j.addr(/scope=team&attention=1&owner=-me/);
  const l2 = await j.p.locator('.count-line').innerText();
  j.check(`“${said}” opened “${l2}”`, l2.startsWith(`${k} `));
  j.check('filter line says “Owner not you”', (await j.p.locator('.filterline').innerText()).includes('Owner not you'));
} };

T.U137 = { budget: 26, run: async (j) => {
  await reset();
  await j.open('tunde', '2026-11-11'); await j.go('/goals/new', '2026-11-11');
  await j.addr(/\/goals\/new\/what/);
  j.check('progress shown', await j.p.locator('[aria-label="Steps"]').isVisible());
  j.step(); await j.p.getByLabel('Name it the way').fill('Signed artifacts in staging');
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/who/);
  const pick = async (label, q, choose) => { const box = j.p.locator(`#pk-${label}`); if (!(await box.isVisible())) await box.locator('xpath=..').getByRole('button', { name: 'Change' }).click(); await box.fill(q); await j.p.waitForTimeout(400); await box.locator('xpath=..').locator('li', { hasText: choose }).first().click(); };
  await pick('parentId', 'G-41', 'Mean time to restore service');
  await pick('teamId', 'CI/CD', 'CI/CD');
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  j.step(); await j.p.getByRole('button', { name: 'Keep it in CI/CD' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/measure/);
  j.step(); await j.p.getByLabel('Unit').fill('%');
  j.step(); await j.p.getByLabel('Baseline').fill('40');
  j.step(); await j.p.getByLabel('Target', { exact: true }).fill('90');
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/check/);
  await j.shows('Nothing is saved until you publish.');
  await j.inView(j.p.getByRole('button', { name: 'Publish goal' }), 'Publish goal');
  const rb = await j.text();
  j.check('What reads the spec’s sentence', rb.includes('A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.'));
  j.check('Measured by row', rb.includes('Measured by'));
  j.check('After you publish: Thursday 12 Nov and 47% for week 47', rb.includes('Its first check-in is due by Thursday 12 Nov, then every week.') && rb.includes('the plan says 47% for week 47'));
  j.check('After you publish says who sees it, the reviews and how long', /can see it/.test(rb) && /It joins/.test(rb) && /Until its first check-in/.test(rb));
  j.step(); await j.p.locator('.goal-read-back').getByRole('button', { name: 'Change left as usual' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/measure/);
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/check/, 'Continue after Change comes back to Check');
  j.step(); await j.p.locator('.goal-read-back').getByRole('button', { name: 'Change what' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/what/);
  j.step(); await j.p.getByText('Hit dated stages').click();
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/measure/, 'another type opens the stages');
  j.step(); await j.p.getByLabel('Stage 1', { exact: true }).fill('Pilot');
  await j.p.getByLabel('Stage 1: due').selectOption('50');
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/new\/check/);
  j.check('What now reads the stages', (await j.text()).includes('Dated stages: 1 stage, the last due week 50'));
  j.step(); await j.p.getByRole('button', { name: 'Publish goal' }).click(); await j.p.waitForLoadState();
  await j.addr(/\/goals\/.+\?published=1/);
  j.check('History keeps the answer as Checked', (await j.text()).includes('Checked'));
} };

T.U1 = { budget: 17, run: async (j) => {
  await reset();
  await j.open('rhea'); await j.go('/');
  await j.shows('2 check-ins to do');
  const st = j.p.getByRole('link', { name: 'Start check-in' });
  await j.inView(st, 'Start check-in');
  await j.checkpoint('home');
  j.step(); await st.click(); await j.p.waitForLoadState();
  j.check('progress indicator', await j.p.locator('progress').isVisible());
  const g = (await j.p.locator('h1').innerText()).replace('Check in: ', '');
  j.step(); await j.p.getByLabel('This week’s value').fill('9'); await j.p.waitForTimeout(500);
  await j.shows(/ahead of plan|behind plan|On plan/, 'the verdict says how it stands against the plan');
  await j.shows('planned for week 45');
  await j.checkpoint('first goal');
  j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
  if (await j.p.getByRole('alert').count()) { j.step(); await j.p.getByLabel('Why, in a sentence').fill('The runner budget came through a week early.'); j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState(); }
  await j.shows('Check-in saved');
  await j.checkpoint('posted');
  j.step(); await j.p.getByRole('link', { name: /^Next:/ }).click(); await j.p.waitForLoadState();
  await j.p.getByLabel('This week’s value').fill('0.40'); await j.p.waitForTimeout(500);
  await j.go('/');
  await j.shows('Pick up where you left off');
  await j.p.getByRole('link', { name: 'Pick up where you left off' }).click(); await j.p.waitForLoadState();
  j.check('draft value restored', (await j.p.getByLabel('This week’s value').inputValue()) === '0.40');
  j.fail('first check-in off its plan: “Keep … and say why” and the cause buttons (“Change landed early”, “What happened”) are not built: the kit names the buttons but not the screen');
  await j.p.getByLabel('Why, in a sentence').fill('The runner budget came through a week early.');
  j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
  await j.shows(/(Your check-in is|Both of your check-ins are|All \d+ of your check-ins are) in/, 'the last post says the week is done');
  j.check('Back to home and View the goal', await j.p.getByRole('link', { name: 'Back to home' }).isVisible() && await j.p.getByRole('link', { name: 'View the goal' }).isVisible());
  await j.checkpoint('done');
  await j.go('/'); await j.p.reload();
  await j.shows(/(Your check-in is|Both (of your )?check-ins are|All \d+ (of your )?check-ins are) in( for week | before | by |\.)/, 'home says the week is done');
  await j.go('/goals/ci-docker');
  j.step(); await j.p.locator('.goal-bar a', { hasText: 'Check in again' }).click(); await j.p.waitForLoadState();
  await j.shows('You checked in for week 45 already');
  j.step(); await j.p.getByLabel('This week’s value').fill('9');
  j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
  await j.shows('Kept alongside your earlier check-in this week');
  await j.open('rhea'); await j.go('/check-in/ns-lead');
  await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
  j.check('“Type this week’s number” alert', await j.p.getByRole('alert').filter({ hasText: 'Type this week’s number' }).isVisible());
  j.step(); await j.p.getByLabel('This week’s value').fill('60'); await j.p.waitForTimeout(500);
  j.check('verdict marked off plan', await j.p.locator('#verdict.off-plan').isVisible());
  await j.shows('Is what you said in this week’s earlier check-in still true?');
  await j.shows('Still asking:');
  j.fail('one question per screen (Continue, then “Still true” as a button) is one form here');
  j.step(); await j.p.getByLabel(/Still true/).check();
  j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
  await j.shows('Check-in saved');
} };

T.U6 = { budget: 3, run: async (j) => {
  await reset();
  await j.open('santiago'); await j.go('/goals?scope=all&attention=1');
  await j.inView(j.p.locator('.trow'), 'trow');
  j.step(); await j.p.locator('.trow').first().click(); await j.p.waitForLoadState();
  j.check('summary bar', await j.p.locator('.goal-bar').isVisible());
  j.check('off track and its reasons shown', /Off track/.test(await j.p.locator('.goal-bar').innerText()));
  await j.checkpoint('goal page');
  j.step(); await j.p.locator('#history .history-filters a', { hasText: /^Changes/ }).click();
  j.fail('a change’s before and after (`.diffs ins`): the demo’s change log is not in the kit’s workspace, so there is no change to show');
  j.check('stagelist', await j.p.locator('.stagelist').isVisible().catch(() => false));
  j.step(); await j.p.getByLabel('Add a comment').fill('The vendor confirmed their December date holds.');
  j.step(); await j.p.getByRole('button', { name: 'Post comment' }).click(); await j.p.waitForLoadState();
  await j.shows('The vendor confirmed their December date holds.');
  await j.go('/goals/ns-ai');
  await j.shows('Target changed in week 20: 60% → 80%');
} };

T.U25 = { budget: 12, run: async (j) => {
  await reset();
  await j.open('mateo'); await j.go('/goals/new');
  j.step(); await j.p.getByLabel('Name it the way').fill('Runbooks with an owner');
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  j.step(); await j.p.getByRole('group', { name: 'Level' }).getByText('Team').click();
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  j.step(); await j.p.getByLabel('Unit').fill('%');
  j.step(); await j.p.getByLabel('Baseline').fill('20');
  j.step(); await j.p.getByLabel('Target', { exact: true }).fill('90');
  j.step(); await j.p.getByRole('button', { name: 'Continue' }).click(); await j.p.waitForLoadState();
  j.step(); await j.p.getByRole('button', { name: 'Publish goal' }).click(); await j.p.waitForLoadState();
  await j.shows('is published');
  const first = j.p.getByRole('link', { name: 'Post the first check-in' });
  await j.inView(first, 'Post the first check-in');
  j.step(); await first.click(); await j.p.waitForLoadState();
  j.step(); await j.p.getByLabel('This week’s value').fill('20');
  j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
  await j.shows('Check-in saved');
  await j.go('/activity');
  await j.shows('checked in on Runbooks with an owner for week 45', 'the first check-in is logged');
  await j.go('/goals/cost-rightsize?published=1');
  j.check('no “is published” on a goal with check-ins', !(await j.text()).includes('is published'));
} };

const ORDER = Object.keys(T);
(async () => {
  const want = process.argv.slice(2);
  const b = await chromium.launch();
  const out = {};
  for (const id of ORDER.filter((x) => !want.length || want.includes(x))) {
    const res = {};
    for (const phone of [true, false]) {
      const j = new J(b, phone);
      try { await T[id].run(j); } catch (e) { j.fail(`stopped: ${e.message.split('\n')[0]}`); }
      await j.close();
      res[phone ? 'phone' : 'desktop'] = { steps: j.steps, fails: j.fails, passes: j.passes };
    }
    const fails = [...new Set([...res.phone.fails, ...res.desktop.fails])];
    const over = Math.max(res.phone.steps, res.desktop.steps) > T[id].budget;
    out[id] = { verdict: fails.length || over ? 'PART' : 'DONE', steps: [res.phone.steps, res.desktop.steps], budget: T[id].budget, passes: res.desktop.passes, fails: over ? [...fails, `over budget: ${Math.max(res.phone.steps, res.desktop.steps)} steps`] : fails };
    console.log(id, out[id].verdict, `steps ${out[id].steps} / ${T[id].budget}`, out[id].fails.length ? `\n   - ${out[id].fails.join('\n   - ')}` : '');
  }
  require('fs').writeFileSync(require('path').join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
  await b.close();
})();
