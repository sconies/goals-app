// The Goal map's journeys (spec/modules/goal-map/journeys/*.md), driven on a phone and a desktop against the running rebuild.
// node modules/goal-map/journeys.cjs [ids…]   (the app on :4173: node app/server.mjs 4173)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.FARO_BASE || 'http://localhost:4173';
const WIDTHS = { phone: [390, 844], desktop: [1440, 900] };

class J {
  constructor(b, phone) { this.b = b; this.phone = phone; this.steps = 0; this.fails = []; this.passes = 0; this.contexts = []; }
  async open(as) {
    const [w, h] = this.phone ? WIDTHS.phone : WIDTHS.desktop;
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
  async text() { return (await this.p.locator('body').innerText()).replace(/\s+/g, ' '); }
  async shows(s, name) { const t = await this.text(); return this.check(name || `shows “${s}”`, typeof s === 'string' ? t.includes(s) : s.test(t)); }
  async visible(sel, name) { try { await this.p.locator(sel).first().waitFor({ state: 'visible', timeout: 3000 }); return this.check(name || sel, true); } catch { return this.check(name || `${sel} shows`, false); } }
  async checkpoint(name) {
    const r = await this.p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.top < innerHeight && b.bottom > 0; };
      const prim = [...document.querySelectorAll('.btn.primary')].filter(vis);
      return { prim: prim.length, primH: prim.map((e) => e.getBoundingClientRect().height), sideways: document.documentElement.scrollWidth > innerWidth + 1,
        shapes: [...document.querySelectorAll('svg.shape')].filter(vis).filter((s) => !(s.parentElement && /\S/.test(s.parentElement.textContent))).length };
    });
    this.check(`${name}: at most one main button in view (${r.prim})`, r.prim <= 1);
    this.check(`${name}: no sideways scrolling`, !r.sideways);
    if (this.phone) this.check(`${name}: main button 44px`, r.primH.every((h) => h >= 44));
    this.check(`${name}: every shape beside its word`, r.shapes === 0);
  }
  async layout(label) {
    this.step();
    await this.p.locator('details.layout-menu > summary').click();
    await this.p.locator('details.layout-menu [role=menuitemradio]', { hasText: new RegExp(`^${label}`) }).first().click();
    await this.p.waitForLoadState();
    if (label === 'Map') await this.p.waitForSelector('.goal-map[data-ready]');
  }
  async ids() { return this.p.$$eval('.react-flow__node', (n) => n.filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.id)); }
  async close() { for (const c of this.contexts) await c.close(); this.contexts = []; }
}
const reset = async () => { await fetch(BASE + '/__reset', { method: 'POST' }); };
const T = {};

T.U26 = { budget: 8, run: async (j) => {
  await j.open('amara'); await j.go('/goals?scope=all');
  await j.layout('Map');
  await j.visible('section[aria-label="Goal map"]', 'the Goal map section shows');
  await j.visible('.react-flow__node', 'a goal on the map shows');
  const onPath = await j.p.$$eval('.map-node.on-path', (n) => n.map((x) => x.closest('[data-id]').dataset.id));
  j.check(`critical path runs from the north star through the off-track input: ${onPath.slice(0, 3).join(', ')}`, onPath.includes('ns-lead') && onPath.includes('lead-merge') && onPath.includes('lead-mq'));
  const before = (await j.ids()).length;
  j.check('the map opens folded on the critical path', before < 126 && onPath.length > 0);
  await j.checkpoint('map');
  j.step(); await j.p.locator('.react-flow__node[data-id="lead-mq"]').click();
  await j.visible('aside[aria-label="Merge queue live for every monorepo"]', 'the story side panel shows');
  const panel = await j.p.locator('aside.map-story').innerText();
  j.check('the story has its why and its link', /Why:/.test(panel) && await j.p.locator('aside.map-story a[href="/goals/lead-mq"]').count() === 1);
  j.step(); await j.p.getByRole('button', { name: 'Unfold all' }).click();
  const all = (await j.ids()).length;
  const dotted = await j.p.locator('svg.edges path.helps').count();
  j.step(); await j.p.getByRole('button', { name: 'Fold to the top' }).click();
  const folded = (await j.ids()).length;
  j.step(); await j.p.locator('.attention-switch:visible').click(); await j.p.waitForSelector('.goal-map[data-ready]');
  const attention = (await j.ids()).length;
  j.check(`nodes: ${before} on opening, ${all} unfolded, ${folded} folded again, ${attention} needing attention`, before < all && folded === before && attention > 0 && attention < all);
  j.step(); await j.p.locator('.attention-switch:visible').click(); await j.p.waitForSelector('.goal-map[data-ready]');
  j.check(`dotted also-helps lines (${dotted})`, dotted > 0 || j.phone);
} };

T.U165 = { budget: 12, run: async (j) => {
  await reset();
  await j.open('amara'); await j.go('/workspace/features');
  const hasFeedback = await j.p.locator('label', { hasText: 'Feedback' }).count();
  j.check('Feedback is in Features (not installed in this rebuild)', hasFeedback > 0);
  j.step(); await j.p.locator('label', { hasText: 'Goal map' }).locator('input[type=checkbox]').click(); await j.p.waitForLoadState();
  await j.shows('Goal map is off in');
  await j.go('/');
  const menu = await j.p.locator(j.phone ? 'nav.tabbar a' : 'aside.side nav a').allInnerTexts();
  j.check(`the menu has no Map or Feedback row: ${menu.join(', ')}`, !menu.some((m) => /Map/.test(m)));
  await j.go('/goals?scope=all');
  await j.p.locator('details.layout-menu > summary').click();
  const layouts = await j.p.locator('details.layout-menu [role=menuitemradio] strong').allInnerTexts();
  j.check(`Layout offers List, Table, Board and History: ${layouts.join(', ')}`, layouts.join(',') === 'List,Table,Board,History');
  j.check('nothing on Goals says Map', !/\bMap\b/.test(await j.text()));
  await j.go('/goals?scope=all&view=map');
  await j.shows('The Goal map is off here, so this is the List.');
  j.check(`the address no longer asks for the Map: ${j.p.url()}`, !/view=map/.test(j.p.url()));
  j.check('the Map was not drawn', (await j.p.locator('.react-flow__node, .map-list').count()) === 0);
  await j.p.reload();
  j.check('said once: a refresh does not say it again', !(await j.text()).includes('The Goal map is off here'));
  await j.go('/help');
  j.check('Help has no Goal map article', !(await j.text()).includes('The goal map'));
  await j.go('/activity');
  await j.shows('switched Goal map off', 'switching the Goal map off was logged');
  await j.go('/workspace/features');
  j.step(); await j.p.locator('label', { hasText: 'Goal map' }).locator('input[type=checkbox]').click(); await j.p.waitForLoadState();
  await j.shows('Goal map is on in');
  await j.go('/goals?scope=all&view=map');
  await j.visible('.react-flow__node, .map-list', 'the Map opens');
  await reset();
} };

T.U30 = { budget: 4, partial: 'Only the map part: the one table and the review set-up parts are the core’s', run: async (j) => {
  await j.open('chen'); await j.go('/goals?scope=all');
  await j.layout('Map');
  await j.visible('.react-flow__node[data-id="ns-lead"]');
  await j.p.locator('.react-flow__node[data-id="ns-lead"] .map-node').focus();
  await j.p.keyboard.press('Enter');
  await j.visible('aside[aria-label="Lead time for changes"]', 'the Lead time side panel shows');
  const focused = await j.p.evaluate(() => !!document.activeElement.closest('aside.map-story'));
  await j.p.keyboard.press('Escape');
  const back = await j.p.evaluate(() => document.activeElement.closest('[data-id]')?.dataset.id);
  j.check(`keyboard map: focus in panel ${focused}, focus back ${back}`, focused && back === 'ns-lead');
  await j.p.locator('.react-flow__node[data-id="ns-lead"] .map-node').focus();
  await j.p.keyboard.press('Delete');
  j.check('Delete removes nothing', (await j.ids()).includes('ns-lead'));
} };

T.U34 = { budget: 4, partial: 'Only the map part: Export, Views and History’s range are the core’s', run: async (j) => {
  await j.open('tariq'); await j.go('/goals?scope=all&view=map');
  await j.visible('section[aria-label="Goal map"]', 'the Goal map section shows');
  j.step(); await j.p.locator('.attention-switch:visible').click(); await j.p.waitForSelector('.goal-map[data-ready]');
  j.check('the address carries attention=1', /attention=1/.test(j.p.url()));
  await j.shows(/\d+ needs? attention:/, '“N needs attention:” in the count');
  await j.p.reload(); await j.p.waitForSelector('.goal-map[data-ready]');
  j.check('the filter survives a refresh', /attention=1/.test(j.p.url()) && (await j.p.locator('.map-node.context').count()) >= 0 && (await j.ids()).length < 126);
  await j.checkpoint('map attention');
  j.check('Export these goals (core, not built)', await j.p.getByRole('button', { name: 'Export these goals' }).count() > 0);
} };

T.U135 = { budget: 10, partial: 'Only the map part: Group, Sort and saved Views are the core’s', run: async (j) => {
  await j.open('rhea'); await j.go('/goals?scope=all');
  j.check('no row of layout buttons', (await j.p.locator('.layout-switch').count()) === 0);
  await j.layout('Board'); j.check('the address becomes view=board', /view=board/.test(j.p.url()));
  await j.layout('Map'); j.check('the address becomes view=map', /view=map/.test(j.p.url()));
  const says = await j.p.locator('details.layout-menu > summary').innerText();
  j.check(`the button says the layout: ${says}`, /Map/.test(says));
  j.check('no search or Needs attention of the map’s own', (await j.p.locator('.map-canvas input').count()) === 0 && (await j.p.getByLabel('Only what needs attention').count()) === 0);
  j.check('“The Map is always the trees.” on Group (Group not built in the core)', (await j.text()).includes('The Map is always the trees.'));
  await j.checkpoint('map');
  j.step(); await j.p.getByLabel('Find a goal', { exact: true }).fill('G-48');
  j.step(); await j.p.locator('#map-find [role=option]', { hasText: 'G-48' }).first().click();
  await j.visible('.react-flow__node[data-id="mttr-oncall"] .map-node.found', 'G-48 found on the map');
  j.check(`chose G-48 without narrowing (${j.p.url()})`, !/[?&]q=/.test(j.p.url()));
  const focus = await j.p.evaluate(() => document.activeElement.closest('[data-id]')?.dataset.id);
  j.check('the goal takes focus', focus === 'mttr-oncall');
  j.step(); await j.p.getByLabel('Find a goal', { exact: true }).fill('merge');
  await j.p.mouse.move(5, 5);
  await j.p.getByLabel('Find a goal', { exact: true }).press('Enter'); await j.p.waitForURL(/[?&]q=merge/);
  j.check('Enter with nothing chosen narrows', /[?&]q=merge/.test(j.p.url()));
} };

T.U39 = { budget: 2, partial: 'Only the map part: the walkthrough coach is not built', run: async (j) => {
  await j.open('chen'); await j.go('/goals?scope=all&view=map');
  await j.visible('.react-flow__node', 'a goal on the Goal map shows');
  j.check('the map walkthrough (not built)', (await j.p.locator('.coach').count()) > 0);
} };

T.U134 = { budget: 30, partial: 'Proposed goals are not built in the core', run: async (j) => {
  await j.open('tunde'); await j.go('/goals/new/check');
  j.check('“Is it under way?” (proposed goals: core, not built)', (await j.text()).includes('Is it under way?'));
} };

T.U90 = { budget: 30, partial: 'Undo of an import is the core’s and Spreadsheets’, not built', run: async (j) => {
  await j.open('amara'); await j.go('/data');
  j.check('Past imports (not built)', (await j.text()).includes('Past imports'));
} };

(async () => {
  const want = process.argv.slice(2);
  const ids = want.length ? want : Object.keys(T);
  const b = await chromium.launch();
  const out = {};
  for (const id of ids) {
    out[id] = {};
    for (const phone of [true, false]) {
      const j = new J(b, phone);
      try { await T[id].run(j); } catch (e) { j.fail(`stopped: ${e.message.split('\n')[0]}`); }
      await j.close();
      out[id][phone ? 'phone' : 'desktop'] = { steps: j.steps, budget: T[id].budget, passes: j.passes, fails: j.fails };
    }
    const f = [...out[id].phone.fails, ...out[id].desktop.fails];
    console.log(`${id}: ${f.length ? `${f.length} failing` : 'all checks hold'} · steps ${out[id].phone.steps}, ${out[id].desktop.steps} / ${T[id].budget}${f.length ? `\n  ${[...new Set(f)].join('\n  ')}` : ''}`);
  }
  await b.close();
  fs.writeFileSync(process.env.FARO_JOURNEYS_OUT || path.join(__dirname, 'journeys.json'), JSON.stringify(out, null, 1));
})();
