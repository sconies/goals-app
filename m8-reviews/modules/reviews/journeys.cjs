// Drives the Reviews module's journeys (spec/modules/reviews/journeys/<id>.md) against the running rebuild, on a phone
// and a desktop. node modules/reviews/journeys.cjs [--base http://localhost:4173] [ids…]
// Prints one JSON line of results to stdout (the exit test reads that, never a file from an earlier run).
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const bi = args.indexOf('--base');
const BASE = bi >= 0 ? args.splice(bi, 2)[1] : 'http://localhost:4873';
const WIDTHS = [['phone', 390, 844], ['desktop', 1440, 900]];

class J {
  constructor(b, phone) { this.b = b; this.phone = phone; this.steps = 0; this.fails = []; this.passes = 0; this.contexts = []; this.notes = []; }
  async open(as, today = '2026-11-05') {
    const [, w, h] = this.phone ? WIDTHS[0] : WIDTHS[1];
    const ctx = await this.b.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([{ name: 'as', value: as, url: BASE }, { name: 'today', value: today, url: BASE }]);
    this.contexts.push(ctx);
    this.p = await ctx.newPage();
    this.p.on('pageerror', (e) => this.fail(`page error: ${e.message}`));
    return this.p;
  }
  async go(path, today) { await this.p.goto(BASE + path + (today ? `${path.includes('?') ? '&' : '?'}today=${today}` : '')); }
  step(n = 1) { this.steps += n; }
  fail(m) { this.fails.push(m); }
  note(m) { this.notes.push(m); }
  check(name, ok) { if (ok) this.passes++; else this.fail(name); return ok; }
  async text(sel = 'body') { return (await this.p.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' '); }
  async shows(s, name, sel) { const t = await this.text(sel); return this.check(name || `shows “${s}”`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
  async visible(loc, name) { const ok = await loc.first().isVisible().catch(() => false); return this.check(name, ok); }
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
  async tool(tool, a = {}) { return this.p.evaluate(async ([tool, a]) => (await fetch('/api/mcp', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ tool, args: JSON.stringify(a) }) })).json(), [tool, a]); }
  async close() { for (const c of this.contexts) await c.close(); this.contexts = []; }
}
const reset = async () => { await fetch(BASE + '/__reset', { method: 'POST' }); };
const ownWords = async (j) => j.p.evaluate(() => {
  // The page's own words: leave out History (unlinked names of past reviews stay, spec 2.3) and an ask's own quoted words.
  const c = document.querySelector('main').cloneNode(true);
  c.querySelectorAll('#history, .step-row > p:first-child, .step-row > p.meta, aside[aria-label] p, [aria-label="Needs your response"] p:not(.meta), .why-block p:not(.meta), .attn .m, .goal-row .m').forEach((e) => e.remove());
  return c.innerText.replace(/\s+/g, ' ');
});
async function switchOff(j) {
  await j.go('/workspace/features'); j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click();
  j.step(); await j.p.getByRole('dialog', { name: /Switch off Reviews in/ }).getByRole('button', { name: 'Switch off Reviews' }).click();
  await j.p.waitForLoadState();
}
async function switchOn(j) { await j.go('/workspace/features'); j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click(); await j.p.waitForURL(/did=on/); }

const T = {};

T.U3 = { budget: 30, run: async (j) => {
  await j.open('marisol'); await j.go('/goals?scope=all');
  await j.visible(j.p.locator('.outcome-card'), 'the outcome card shows (core: Goals’ trees view)');
  await j.go('/'); await j.shows('goals to discuss'); await j.checkpoint('home');
  const homeRing = (await j.p.locator('.hero .ring').getAttribute('aria-label').catch(() => '')) || '';
  await j.menu('Reviews');
  await j.inView(j.p.locator('main a.review-row', { hasText: 'Reliability weekly' }), 'Reliability weekly link');
  const listLine = await j.text('main a.review-row:has-text("Reliability weekly")');
  j.step(); await j.p.locator('main a.review-row', { hasText: 'Reliability weekly' }).click();
  await j.shows('Reliability weekly'); await j.visible(j.p.locator('main .ring'), 'progress ring on the review');
  const pageRing = (await j.p.locator('main .ring').first().getAttribute('aria-label')) || '';
  const n = (s) => (s.match(/(\d+) (?:of|\/) ?(\d+)/) || []).slice(1).join('/');
  j.check(`reviewed count agrees before (home ${homeRing}, list ${listLine}, page ${pageRing})`, n(homeRing) === n(pageRing) && listLine.includes(`${n(pageRing).split('/')[0]} of ${n(pageRing).split('/')[1]}`));
  j.step(); await j.p.getByRole('link', { name: /Continue review/ }).click();
  let items = 0, asked = false, goalId = null, guard = 0;
  while ((await j.p.locator('.decide').count()) && guard++ < 20) {
    await j.visible(j.p.locator('.reviewbar'), 'the reviewbar shows'); await j.visible(j.p.locator('.reviewbar .ring'), 'reviewbar progress');
    await j.visible(j.p.locator('.goal-bar .status'), 'the status on the summary bar');
    if (items < 2) await j.checkpoint(`item 0${items + 1}`);
    const askOwner = j.p.locator('.decide .quiet-links button', { hasText: /^Ask / });
    const before = j.p.url();
    if (!asked && await askOwner.isVisible().catch(() => false)) {
      j.step(); await askOwner.click();
      const title = (await j.p.locator('h1').innerText()).trim();
      j.check('the composer names the goal', (await j.text('#f-q')).includes(title));
      await j.p.getByRole('button', { name: 'Save question' }).click();
      await j.visible(j.p.getByRole('alert').filter({ hasText: 'Write a few words' }), 'asking without a question is caught');
      j.step(); await j.p.getByPlaceholder(/What would it take/).fill('Can this be back on plan before the next incident review?');
      j.step(); await j.p.getByRole('button', { name: 'Save question' }).click(); await j.p.waitForLoadState();
      await j.shows('Can this be back on plan', 'the question is in what was said', '.said');
      j.check('saving a question stayed on the goal', j.p.url().split('?')[0] === before.split('?')[0]);
      goalId = new URL(j.p.url()).pathname.split('/')[2];
      await j.checkpoint('saved question'); asked = true;
    } else if (items === 2) {
      j.step(); await j.p.locator('.decide .quiet-links button', { hasText: 'Add a note' }).click();
      j.step(); await j.p.getByLabel('What the review said').fill('Agreed to pair SRE and Observability on the burn-rate alerts.');
      j.step(); await j.p.getByRole('button', { name: 'Save note' }).click(); await j.p.waitForLoadState();
      await j.shows('Agreed to pair', 'the note is in what was said', '.said');
    }
    const here = j.p.url();
    j.step(); await j.p.locator('.decide button', { hasText: /^Reviewed &/ }).click(); await j.p.waitForLoadState();
    if (j.p.url().split('?')[0] === here.split('?')[0] && await j.p.locator('.decide .err[role=alert]').count()) {
      // The kit: a goal off track or at risk asks first. The journey's loop presses Reviewed & only; here a next step comes first.
      j.note('a goal behind needed a next step before Reviewed & next (the loop in U3 has no such step)');
      j.step(3); await j.p.locator('.decide').getByLabel('What happens next').fill('Agree the owner’s path to green at the next stand-up.');
      await j.p.locator('.decide').getByLabel('By which week').selectOption({ index: 1 });
      await j.p.getByRole('button', { name: 'Add the next step' }).click(); await j.p.waitForLoadState();
      j.step(); await j.p.locator('.decide button', { hasText: /^Reviewed &/ }).click(); await j.p.waitForLoadState();
    }
    j.check('the address changes', j.p.url() !== here);
    items++;
  }
  await j.shows('Nothing flagged', 'healthy goals grouped after the exceptions');
  await j.checkpoint('healthy group');
  j.step(); await j.p.getByRole('button', { name: 'Finish review' }).click();
  const dlg = j.p.getByRole('dialog', { name: 'Finish Reliability weekly' });
  await j.visible(dlg, 'the Finish Reliability weekly dialog'); await j.checkpoint('finish question');
  j.step(); await dlg.getByRole('button', { name: 'Finish the review' }).click(); await j.p.waitForLoadState();
  await j.shows('What was said', 'the held review leads with its record');
  const after = (await j.p.locator('main .ring').first().getAttribute('aria-label')) || '';
  await j.go('/'); const homeAfter = await j.text('main');
  await j.go('/reviews'); const listAfter = await j.text('main a.review-row:has-text("Reliability weekly")');
  j.check(`reviewed count agrees after (page ${after}, list ${listAfter})`, /27 of 27/.test(after) && /Held/.test(listAfter) && !/Reliability weekly · Not held yet/.test(homeAfter));
  await j.go('/reviews/reliability');
  await j.shows('Can this be back on plan', 'what was said is kept on the review');
  await j.visible(j.p.getByRole('link', { name: 'Reviews', exact: true }).last(), 'a way on from the review record');
  const rv = await j.tool('get_review', { review: 'reliability' });
  const q = (rv.said || []).find((x) => x.kind === 'question' && /Can this be back on plan/.test(x.text));
  const act = await j.text('main'); void act;
  await j.go('/activity?q=Reliability'); const logged = await j.text('main');
  j.check('reviews and the note logged, the question an open ask', !!q && q.status === 'open' && /marked .* reviewed in Reliability weekly|finished Reliability weekly/.test(logged) && /noted on .* in Reliability weekly/.test(logged));
  if (goalId) {
    await j.go(`/goals/${goalId}`); await j.shows('Can this be back on plan', 'the question is on the goal for everyone');
    const owner = (await j.tool('get_goal', { goal: goalId })).owner;
    await j.close(); await j.open(owner); await j.go(`/goals/${goalId}`);
    await j.shows('by Marisol in Reliability weekly', 'the owner sees the question on the goal', '.step-row:has-text("Can this be back on plan")');
    await j.shows('For you', 'the question is under For you');
    await j.go('/'); await j.shows('Questions for you'); await j.shows('Can this be back on plan', 'the owner’s Home shows the question');
  } else j.fail('no question was asked');
} };

T.U13 = { budget: 11, run: async (j) => {
  await j.open('jun'); await j.go('/');
  await j.menu('Reviews'); await j.shows('Platform leadership weekly');
  await j.inView(j.p.getByRole('link', { name: 'Set up a review' }), 'Set up a review link'); await j.checkpoint('reviews');
  j.step(); await j.p.getByRole('link', { name: 'Set up a review' }).click();
  await j.p.getByRole('button', { name: 'Set up the review' }).click();
  await j.visible(j.p.getByRole('alert').filter({ hasText: 'Give the review a name' }), 'an unnamed review is explained');
  j.step(); await j.p.getByLabel('Name', { exact: true }).fill('SRE fortnightly');
  j.step(); await j.p.getByRole('button', { name: 'Every 4 weeks' }).click();
  await j.p.getByLabel('On', { exact: true }).selectOption('4');
  j.step(); await j.p.getByRole('button', { name: 'North star' }).click();
  j.step(); await j.p.getByRole('button', { name: 'People', exact: true }).click();
  j.step(); await j.p.getByRole('searchbox', { name: 'People' }).fill('Mateo');
  await j.p.waitForTimeout(400);
  await j.shows('match', 'the pick count says it matched', '.pick-count[role="status"]:visible');
  const listed = await j.p.getByRole('listbox', { name: 'People' }).getByRole('option').count();
  j.check(`finding “Mateo” left ${listed} people in the list`, listed === 1);
  j.step(); await j.p.getByRole('option', { name: /Mateo Fernández/ }).click();
  await j.p.keyboard.press('Escape');
  await j.p.waitForTimeout(300);
  await j.shows(/[2-9] goals so far/, 'the form counts the goals picked');
  await j.checkpoint('set up');
  j.step(); await j.p.getByRole('button', { name: 'Set up the review' }).click(); await j.p.waitForLoadState();
  await j.shows('SRE fortnightly'); await j.shows('Every 4 weeks, Fridays');
  await j.visible(j.p.locator('.ring'), 'the review page has its ring');
  j.check('the review lists its goals', (await j.p.locator('main .goal-row').count()) > 0);
  j.check('a way to start the new review', await j.p.getByRole('link', { name: /Start review/ }).isVisible().catch(() => false) || (await j.text('main')).includes('Next:'));
  const list = await j.tool('list_reviews');
  await j.go('/activity?q=SRE'); const logged = await j.text('main');
  j.check('the review is saved and logged', list.reviews.some((r) => r.name === 'SRE fortnightly' && r.people.includes('mateo') && r.people.includes('jun')) && /set up the review SRE fortnightly/.test(logged));
} };

T.U30 = { budget: 16, part: 'review set-up only: the one-table check-in’s refusals and the keyboard map are the core’s and other modules’', run: async (j) => {
  await j.open('chen'); await j.go('/reviews/new');
  j.step(); await j.p.getByLabel('Name', { exact: true }).fill('Research draft review');
  await j.p.reload(); await j.p.waitForLoadState();
  await j.shows('Picked up where you left off', 'a refreshed set-up says it kept the draft');
  j.check('the name survived the refresh', (await j.p.getByLabel('Name', { exact: true }).inputValue()) === 'Research draft review');
  await j.p.getByRole('button', { name: 'Close without saving' }).first().click();
  await j.p.getByRole('dialog', { name: 'Close without saving?' }).getByRole('button', { name: 'Close without saving' }).click();
  await j.p.waitForURL(/\/reviews$/);
  await j.go('/reviews/new');
  j.check('closing without saving dropped the draft', (await j.p.getByLabel('Name', { exact: true }).inputValue()) === '');
} };

T.U36 = { budget: 12, part: 'the second half (Amara): Rhea’s two-step check-in with “Still asking:” and “Keep this request open” is the core’s and isn’t built', run: async (j) => {
  await j.open('amara'); await j.go('/');
  await j.shows('goals to discuss', 'Home says how many goals need discussion');
  const discuss = Number(((await j.text('[data-part="This week’s main action"]')).match(/(\d+) goals? to discuss/) || [])[1]);
  j.step(); await j.p.getByRole('link', { name: /Open the review|Continue/ }).click(); await j.p.waitForLoadState();
  await j.shows(`Start review · ${discuss} goal`, 'Home and the review agree on how many goals need discussion');
  await j.checkpoint('review');
} };

T.U63 = { budget: 9, run: async (j) => {
  await j.open('rhea'); await j.go('/reviews/new');
  const btn = j.p.getByRole('button', { name: 'People', exact: true });
  await j.visible(btn, 'the People button shows'); j.check('it says Choose a person', (await btn.innerText()).includes('Choose a person'));
  j.step(); await btn.click();
  await j.p.waitForTimeout(300);
  await j.visible(j.p.getByRole('listbox', { name: 'People' }), 'the People listbox shows');
  const firstSug = (await j.p.getByRole('listbox', { name: 'People' }).getByRole('option').first().innerText().catch(() => '')).split('\n')[0];
  j.check(`the first suggestion is you (${firstSug})`, firstSug === 'Rhea Kapoor');
  await j.checkpoint('people picker');
  j.step(); await j.p.getByRole('searchbox', { name: 'People' }).fill('dan'); await j.p.waitForTimeout(400);
  await j.shows('1 matches', 'typing “dan” says 1 matches', '.mpick[data-name=people] .pick-count[role="status"]');
  await j.p.keyboard.press('ArrowDown'); await j.p.keyboard.press('Enter'); await j.p.waitForTimeout(200);
  await j.p.keyboard.press('Escape'); await j.p.waitForTimeout(200);
  j.check('the People listbox goes away', !(await j.p.getByRole('listbox', { name: 'People' }).isVisible()));
  j.check('Daniel Okafor is chosen, with Remove', await j.p.getByRole('button', { name: 'Remove Daniel Okafor' }).isVisible());
  j.check('Escape returned to the field', await j.p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'People'));
  j.step(); await j.p.getByRole('button', { name: 'Single goals', exact: true }).click();
  j.step(); await j.p.getByRole('searchbox', { name: 'Single goals' }).fill('G-48'); await j.p.waitForTimeout(400);
  await j.shows('1 matches', 'a key finds its goal', '.mpick[data-name=goals] .pick-count[role="status"]');
  const row = await j.p.getByRole('listbox', { name: 'Single goals' }).getByRole('option').first().innerText();
  j.check(`the goal row reads its status as a word, then its key (${row.replace(/\n/g, ' / ')})`, /(On track|At risk|Off track|No recent update|No check-in yet|Not started|Done|Not measured yet) · G-48/.test(row));
  await j.p.keyboard.press('Enter'); await j.p.keyboard.press('Escape');
  const big = await j.p.evaluate(() => Math.max(0, ...[...document.querySelectorAll('select')].map((s) => s.options.length)));
  j.check(`no select of everyone (${big} options)`, big < 20);
  await j.checkpoint('chosen');
} };

T.U67 = { budget: 6, part: 'the collapsed rail (.collapse-nav, .rail-label) is the core’s and isn’t built', run: async (j) => {
  await j.open('rhea'); await j.go('/');
  if (j.phone) {
    const tabs = await j.p.locator('nav.tabbar a').allInnerTexts();
    j.check(`the tabs are ${tabs.join(', ')}`, tabs.join(',') === 'Home,Check-in,Goals,Reviews,More');
    j.step(); await j.p.locator('nav.tabbar a', { hasText: 'More' }).click();
    j.check('More has the rest in groups', (await j.text('main')).includes('People'));
  } else {
    const groups = await j.p.locator('aside.side nav > ul').evaluateAll((uls) => uls.map((u) => [...u.querySelectorAll(':scope > li > a > span:first-child')].map((s) => s.textContent).join(' ')));
    j.check(`the menu's groups are ${groups.join(' | ')}`, groups[0] === 'Home Check-in Goals Reviews' && groups.length === 4);
    j.check('one lit item', (await j.p.locator('.side [aria-current="page"]').count()) === 1);
    j.check('the collapsed rail names Check-in on focus', (await j.p.locator('.side .collapse-nav').count()) > 0);
  }
  await j.checkpoint('menu');
  j.step(); await j.close(); await j.open('oskar'); await j.go('/');
  j.check('someone who owns no goal has no Check-in', !(await j.text(j.phone ? 'nav.tabbar' : 'aside.side nav')).includes('Check-in'));
} };

T.U103 = { budget: 30, run: async (j) => {
  await j.open('amara'); await j.go('/workspace/features');
  const row = await j.text('section[aria-label="Features"]');
  j.check('Features shows Reviews under Working together, on, with “6 reviews are set up.”', /Working together.*Reviews.*On.*6 reviews are set up\./.test(row) && await j.p.getByRole('checkbox', { name: 'Reviews' }).isChecked());
  await j.checkpoint('features');
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click();
  const dlg = j.p.getByRole('dialog', { name: /Switch off Reviews in/ });
  await j.visible(dlg, 'the Switch off Reviews dialog');
  const says = (await dlg.innerText()).replace(/\s+/g, ' ');
  j.check('the read-back names the 6 reviews', /6 reviews stay/.test(says) && says.includes('Platform leadership weekly'));
  j.check('the read-back says nothing is deleted', says.includes('Nothing is deleted'));
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  j.check('Cancel did not switch Reviews off', await j.p.getByRole('checkbox', { name: 'Reviews' }).isChecked() && (await j.tool('list_reviews')).reviews);
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click();
  j.step(); await dlg.getByRole('button', { name: 'Switch off Reviews' }).click(); await j.p.waitForLoadState();
  await j.shows('Reviews is off in'); await j.shows('Nothing it saved is lost.');
  await j.go('/');
  const menu = j.phone ? await j.p.locator('nav.tabbar a').allInnerTexts() : await j.p.locator('aside.side nav a').allInnerTexts();
  j.check(`the menu has no Reviews: ${menu.join(', ')}`, !menu.some((m) => /^Reviews/.test(m.trim())));
  if (j.phone) j.check(`the phone’s tabs have People in Reviews’ place: ${menu.join(', ')}`, menu.map((m) => m.trim()).join(',') === 'Home,Goals,People,Activity,More');
  const lead = await j.text('[data-part="This week’s main action"]');
  j.check(`Home’s lead is “Goals you watch · {n} need attention”: ${lead}`, /Goals you watch · \d+ need attention/.test(lead));
  j.check('Home’s lead has See them', await j.p.locator('[data-part="This week’s main action"]').getByRole('link', { name: 'See them' }).isVisible());
  j.check('Home shows no review cell', !(await j.p.locator('.glance-cell').count()) && !(await j.text('main')).includes('Next review'));
  const own = await ownWords(j);
  const named = own.match(/[^.]*\breviews?\b[^.]*/i);
  j.check(`Home names no review: “${named ? named[0] : ''}”`, !named);
  await j.go('/reviews'); await j.shows('Page not found'); await j.shows('Reviews is switched off in', 'the Reviews address says Reviews is switched off');
  await j.go('/goals/ns-lead?review=weekly'); j.check('the address changes', !j.p.url().includes('review='));
  await j.go('/goals/ns-lead?history=reviews'); await j.visible(j.p.locator('#history'), 'the History section');
  j.check('the goal shows no Last time we talked', !(await j.text('main')).includes('Last time we talked'));
  const kept = (await j.text('#history')).includes('in Platform leadership weekly');
  await j.go('/'); const stepThere = (await j.text('main')).includes('Take the runner budget to the finance review');
  j.check(`History ${kept ? 'keeps' : 'lost'} what the review said; the next step is ${stepThere ? 'still' : 'no longer'} on Home`, kept && stepThere);
  await j.go('/activity?q=switched'); j.check('switching Reviews off was logged', (await j.text('main')).includes('switched off Reviews'));
  await j.go('/workspace/features');
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click(); await j.p.waitForLoadState(); await j.shows('Reviews is on in');
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click();
  j.step(); await dlg.getByRole('button', { name: 'Switch off Reviews' }).click(); await j.p.waitForLoadState(); await j.shows('Reviews is off in');
  await j.p.getByRole('button', { name: 'Undo' }).last().click(); await j.p.waitForLoadState();
  await j.shows('Reviews is back on.');
  j.check('Undo left it on', await j.p.getByRole('checkbox', { name: 'Reviews' }).isChecked());
  await j.go('/reviews'); await j.shows('Platform leadership weekly', 'Reviews came back with every review');
} };

T.U104 = { budget: 10, run: async (j) => {
  await j.open('amara'); await j.go('/reviews');
  const before = await j.p.locator('main a.review-row').allInnerTexts();
  j.check('the list of reviews shows', before.length > 0);
  await switchOff(j); await j.shows('Reviews is off in'); await j.checkpoint('off');
  await j.go('/'); const own = await ownWords(j);
  j.check('Home with Reviews off names no review', !/\breviews?\b/i.test(own));
  await switchOn(j); await j.shows('Reviews is on in');
  await j.go('/reviews'); const after = await j.p.locator('main a.review-row').allInnerTexts();
  await j.go('/');
  j.check(`back on: Reviews lists ${after.length} of the ${before.length} it listed before, as they were`, after.join('|') === before.join('|'));
  await j.go('/activity?q=Reviews'); const t = await j.text('main');
  j.check('switching Reviews off and on was logged', t.includes('switched off Reviews') && t.includes('switched on Reviews'));
} };

T.U154 = { budget: 14, part: 'Rhea’s second check-in through “Keep … and say why” and the cause buttons is the core’s one-question check-in, not built: the two are posted through the one form', run: async (j) => {
  await j.open('amara'); await j.go('/workspace/features');
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click();
  const dlg = j.p.getByRole('dialog', { name: /Switch off Reviews in/ });
  const says = (await dlg.innerText()).replace(/\s+/g, ' ');
  const risks = 0;
  j.check(`the read-back says when check-ins are due, and counts the ${risks} accepted risks: ${says.slice(0, 200)}`, says.includes('Check-ins are still due by Thursday.') && says.includes('“Before the review” becomes “by Thursday”') && !/accepted risk/.test(says));
  await j.checkpoint('read-back');
  j.step(); await dlg.getByRole('button', { name: 'Switch off Reviews' }).click(); await j.p.waitForLoadState(); await j.shows('Reviews is off in');
  await j.close(); await j.open('rhea');
  const named = [];
  for (const route of ['/', '/check-in', '/goals?scope=mine', '/goals/ns-lead', '/goals/ci-queue', '/people/rhea', '/teams/cicd', '/help']) {
    await j.go(route); const own = await ownWords(j);
    const m = own.match(/[^.]*\b(review|reviews|review’s)\b[^.]*/i); if (m) named.push(`${route}: ${m[0].trim().slice(0, 80)}`);
  }
  j.check(`with Reviews off no page names a review: ${named.join('; ')}`, !named.length);
  await j.go('/check-in');
  const todo = await j.p.locator('a', { hasText: /^Check in: / }).count(); void todo;
  for (let k = 0; k < 2; k++) {
    await j.go('/check-in?start=1');
    if (!(await j.p.getByLabel('This week’s value').count())) break;
    j.step(); await j.p.getByLabel('This week’s value').fill(k ? '0.40' : '9');
    const why = j.p.getByLabel(/Why/).first(); if (await why.isVisible().catch(() => false)) await why.fill('The runner budget came through a week early.');
    j.step(); await j.p.getByRole('button', { name: 'Post check-in' }).click(); await j.p.waitForLoadState();
    await j.shows('Check-in saved');
  }
  const receipt = await j.text('.receipt');
  j.check(`the receipt says “${receipt}”, not “…are in by Thursday.”`, /(Your check-in is|of your check-ins are) in by Thursday\./.test(receipt));
  await j.checkpoint('receipt');
  await j.go('/activity?q=Rhea'); const t = await j.text('main');
  j.check('switching off and the check-ins were logged', /checked in on/.test(t));
} };

T.U155 = { budget: 6, run: async (j) => {
  await j.open('amara', '2026-11-02'); await j.go('/workspace/features');
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click();
  j.step(); await j.p.getByRole('dialog', { name: /Switch off Reviews in/ }).getByRole('button', { name: 'Switch off Reviews' }).click(); await j.p.waitForLoadState();
  await j.shows('Reviews is off in');
  await j.close(); await j.open('amara', '2026-11-06'); await j.go('/workspace/features');
  j.check('Reviews did not come back on by itself', !(await j.p.getByRole('checkbox', { name: 'Reviews' }).isChecked()));
  j.step(); await j.p.getByRole('checkbox', { name: 'Reviews' }).click(); await j.p.waitForLoadState(); await j.shows('Reviews is on in');
  await j.go('/reviews'); j.check('the list of reviews shows', (await j.p.locator('main a.review-row').count()) > 0); await j.checkpoint('reviews back on');
  const list = await j.text('main');
  await j.go('/'); const home = await j.text('main');
  j.check(`back on Friday: Reviews ${/Not held yet|Outstanding/.test(list) ? 'says a session is not held' : 'is fine'}; Home ${/Not held yet/.test(home) ? 'says Not held yet' : 'is fine'}`, !/Not held yet|Outstanding/.test(list) && !/Not held yet/.test(home));
  await j.go('/activity?q=Reviews'); const t = await j.text('main');
  j.check('switching off and on was logged', t.includes('switched off Reviews') && t.includes('switched on Reviews'));
} };

// Starts its own app server (and stops it after) unless one already answers at BASE.
async function serve() {
  try { await fetch(BASE + '/__reset', { method: 'POST' }); return null; } catch {}
  const path = require('path');
  const child = require('child_process').spawn(process.execPath, [`${path.join(__dirname, '../../app')}/./server.mjs`, new URL(BASE).port], { stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 50; i++) { await new Promise((r) => setTimeout(r, 100)); try { await fetch(BASE + '/__reset', { method: 'POST' }); return child; } catch {} }
  throw new Error('the app did not start');
}
(async () => {
  const server = await serve();
  const ids = args.length ? args : Object.keys(T);
  const b = await chromium.launch();
  const out = {};
  for (const id of ids) {
    if (!T[id]) { out[id] = { tally: 'NOT BUILT', widths: {} }; continue; }
    out[id] = { budget: T[id].budget, part: T[id].part || '', widths: {} };
    for (const phone of [true, false]) {
      await reset();
      const j = new J(b, phone);
      try { await T[id].run(j); } catch (e) { j.fail(`stopped at ${j.p ? j.p.url() : "?"}: ${String(e.message).split("\n").slice(0, 3).join(" ")}`); }
      await j.close();
      const over = j.steps > T[id].budget;
      out[id].widths[phone ? 'phone' : 'desktop'] = { steps: j.steps, fails: over ? [...j.fails, `over budget: ${j.steps} steps of ${T[id].budget}`] : j.fails, passes: j.passes, notes: j.notes };
    }
    const fails = Object.values(out[id].widths).flatMap((w) => w.fails);
    out[id].tally = !fails.length && !out[id].part ? 'DONE' : 'PART';
  }
  await b.close();
  await reset();
  if (server) server.kill();
  process.stdout.write(JSON.stringify(out) + '\n');
})();
