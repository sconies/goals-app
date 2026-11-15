// The core journeys (spec/core/journeys/*.md), driven against this rebuild in a real browser at both widths.
// Each check throws when it fails; the process exits 1 when any journey fails. No results file is written.
// Usage: PLAYWRIGHT=<path to playwright> node tests/journeys.mjs [U2 U58 ...]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = Number(process.env.JOURNEY_PORT || 48917);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (p, text, words) => check(await p.locator('main, [role=dialog]').getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const state = async () => (await fetch(`${BASE}/api/state`)).json();
async function openMenu(p, phone, name) {
  if (!phone) return p.locator('nav.sidebar').getByRole('link', { name, exact: true }).first().click();
  const tab = p.locator('nav.tabbar > a', { hasText: name });
  if (await tab.count()) return tab.first().click();
  await p.locator('nav.tabbar details.more summary').click();
  return p.locator('nav.tabbar .more-sheet').getByRole('link', { name, exact: true }).first().click();
}
const inView = async (loc) => { const b = await loc.boundingBox(); const vh = loc.page().viewportSize().height; return !!b && b.y >= 0 && b.y + b.height <= vh - 56; };

const J = {
  async U2(p) {
    await p.goto(`${BASE}/?as=rhea`);
    await shown(p, 'Your goals');
    check(/\d+ needs? attention/.test(await p.locator('main').innerText()), '“N needs attention” is not shown');
    await shown(p, 'Goals you watch', 'home does not show the goals Rhea watches');
    check(await p.locator('.hero .ring').isVisible(), 'no weekly progress ring');
    const reasons = await p.locator('.arow .arow-why').allInnerTexts();
    check(reasons.length && reasons.every((r) => r.trim().length > 20) && (await p.locator('.arow[data-tone=risk] .arow-icon, .arow[data-tone=off] .arow-icon').count()) > 0, 'attention rows lack a reason or a status icon');
    await p.locator('.hero').getByRole('link', { name: /Start check-in|Pick up where you left off/ }).click();
    await p.waitForURL(/\/check-in/);
    await p.locator('.checkin-list a').first().click();
    await shown(p, 'What’s the number this week?');
  },
  async U58(p, { phone }) {
    await p.goto(`${BASE}/?as=oskar`);
    await openMenu(p, phone, 'People');
    await p.waitForURL(/\/people$/);
    check(await p.locator('.people-row').first().isVisible(), 'no people rows');
    const box = p.getByRole('searchbox', { name: 'Find by name, job title or team' });
    check(await inView(box), 'the search is not in view');
    check(/^\d+ people, A to Z\. Showing 1 to 50\.$/.test((await p.locator('.count-line').innerText()).trim()), 'count line is not “N people, A to Z. Showing 1 to 50.”');
    await box.fill('rhea');
    await shown(p, '1 person matches.');
    check(/[?&]q=rhea/.test(p.url()), `the search is not in the address: ${p.url()}`);
    await p.locator('.people-row').first().click();
    await p.getByRole('heading', { name: 'Rhea Kapoor' }).waitFor();
    const see = p.getByRole('link', { name: /See Rhea’s \d+ goals/ });
    check(await inView(see), 'See Rhea’s N goals is not in view');
    const facts = await p.locator('.person-facts').innerText();
    check(/CI\/CD, which Rhea leads/.test(facts) && /Member\./.test(facts), `facts say: ${facts}`);
    await see.click();
    await p.waitForURL(/\/goals\?.*owner=rhea/);
    await shown(p, 'Rhea Kapoor');
    await p.goto(`${BASE}/teams`);
    await p.locator('.team-row', { hasText: 'CI/CD' }).click();
    await p.getByRole('heading', { name: 'CI/CD' }).waitFor();
    await p.getByRole('link', { name: /See its \d+ goals/ }).click();
    await p.waitForURL(/\/goals\?.*team=cicd/);
  },
  async U64(p) {
    await p.goto(`${BASE}/activity?as=amara`);
    const box = p.getByRole('searchbox', { name: 'Find a change' });
    check(await inView(box), 'the search is not in view');
    await box.fill('Rhea');
    await p.waitForURL(/[?&]q=Rhea/);
    check(/changes? match(es)?\./.test(await p.locator('.count-line[role=status]').innerText()), 'Activity does not count what the search matches');
    await p.goBack();
    await p.waitForLoadState();
    check(!/[?&]q=/.test(p.url()) && (await p.getByRole('searchbox', { name: 'Find a change' }).inputValue()) === '', `Back after a search leaves ${p.url()}`);
    await p.getByRole('searchbox', { name: 'Find a change' }).fill('zzzz');
    await shown(p, 'No change matches “zzzz”.');
    await p.getByRole('button', { name: 'Clear the search' }).click();
    await p.waitForURL((u) => !/q=/.test(u.search));
    await p.getByRole('group', { name: 'Kind of change' }).getByRole('button', { name: 'Check-ins' }).click();
    await p.waitForURL(/kind=checkins/);
    await shown(p, 'Filtered by: Kind Check-ins');
    await p.goBack(); await p.waitForLoadState();
    check(!/kind=checkins/.test(p.url()) && !(await p.locator('.filter-line').count()), 'Back did not take the filter off');
    await p.goForward(); await p.waitForLoadState();
    await p.getByRole('button', { name: 'Remove the filter Kind' }).click();
    await p.waitForURL((u) => !/kind=/.test(u.search));
    check(!(await p.locator('.filter-line').count()), 'Remove did not take the filter off');
    await p.goto(`${BASE}/help`);
    await p.getByRole('searchbox', { name: 'Find in Help' }).fill('xylophone');
    await shown(p, 'No article matches “xylophone”.');
  },
  async U65(p, { phone }) {
    await p.goto(`${BASE}/?as=oskar`);
    if (!phone) check(await p.locator('nav.sidebar [data-find]').isVisible(), 'the sidebar has no Find');
    await p.keyboard.press('Control+k');
    const find = p.getByRole('dialog', { name: 'Find' });
    const box = find.getByRole('combobox');
    check(await box.evaluate((e) => e === document.activeElement), 'the search is not focused when Find opens');
    check(/Type a name, a key like G-48, or a few words\./.test(await find.innerText()), 'Find shows neither what was opened lately nor what to type');
    await box.fill('G-48');
    await find.getByRole('group', { name: 'Goals · 1' }).waitFor();
    await box.press('Enter');
    await p.waitForURL(/\/goals\/[^/?]+/);
    check((await p.locator('main .gkey').first().innerText()) === 'G-48', 'Enter on G-48 opened another goal');
    check(!(await p.getByRole('dialog', { name: 'Find' }).count()), 'Find did not go away');
    await p.keyboard.press('Control+k');
    const f2 = p.getByRole('dialog', { name: 'Find' });
    await f2.getByRole('combobox').fill('rhea');
    await f2.getByRole('group', { name: 'People · 1' }).waitFor();
    const groups = await f2.getByRole('group').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    check(JSON.stringify(groups) === JSON.stringify(['Goals · 8', 'People · 1', 'Teams · 1']), `groups: ${groups}`);
    const people = await f2.getByRole('group', { name: 'People · 1' }).getByRole('option').allInnerTexts();
    check(/Rhea Kapoor/.test(people[0] || ''), 'People shows someone else');
    const goals = f2.getByRole('group', { name: 'Goals · 8' }).getByRole('option');
    check((await goals.count()) === 4 && /See all 8 goals/.test(await goals.last().innerText()), 'Goals does not show three rows and See all 8 goals');
    check(/\/goals\?scope=all&q=rhea/.test((await goals.last().getAttribute('href')) || ''), 'See all does not open Goals with the search');
    await f2.getByRole('combobox').fill('ci/cd');
    await f2.getByRole('group', { name: /^Teams · / }).waitFor();
    await f2.getByRole('combobox').fill('cicd team');
    await f2.getByRole('combobox').fill('CI/CD');
    await p.waitForTimeout(300);
    const first = await f2.getByRole('option').first().getAttribute('href');
    if (first !== '/teams/cicd') { await f2.getByRole('group', { name: /^Teams · / }).getByRole('option').first().click(); } else await f2.getByRole('combobox').press('Enter');
    await p.waitForURL(/\/teams\/cicd/);
    await p.keyboard.press('Control+k');
    await p.keyboard.press('Escape');
    check(!(await p.getByRole('dialog', { name: 'Find' }).count()), 'Escape does not close Find');
  },
  async U66(p) {
    await p.goto(`${BASE}/goals?scope=all&as=amara`);
    const box = p.getByRole('searchbox', { name: 'Find a goal' });
    check(await inView(box), 'the search field is not in view');
    await box.fill('rolback');
    await shown(p, 'No goal matches “rolback”. Showing goals that match “rollback”.', 'a near miss is not offered');
    check(await p.locator('.goal-row, .gtable tbody tr', { hasText: /rollback/i }).first().isVisible(), 'the goals matching “rollback” are not shown');
    check((await box.inputValue()) === 'rolback', `the field says ${await box.inputValue()}`);
    await p.getByRole('button', { name: 'Clear the search' }).click();
    await p.waitForURL((u) => !/[?&]q=/.test(u.search));
    check((await p.getByRole('searchbox', { name: 'Find a goal' }).inputValue()) === '', 'Clear the search left the search on');
  },
  async U69(p) {
    await p.goto(`${BASE}/?as=rhea`);
    const cases = [['/', 'Home', 'Home'], ['/goals?scope=all', 'Goals', 'Goals'], ['/goals/ns-lead', null, 'Goals'], ['/goals/ns-lead?review=weekly', null, 'Reviews'], ['/people/rhea', 'Rhea Kapoor', 'People'], ['/teams/cicd', 'CI/CD', 'People'], ['/help/check-in', 'Help', 'Help'], ['/nowhere', 'Page not found', null]];
    const wrong = [];
    for (const [addr, name, lit] of cases) {
      await p.goto(BASE + addr);
      const t = await p.title();
      if (name && !t.startsWith(`${name} · Platform Engineering · Faro`)) wrong.push(`${addr} is titled ${t}`);
      const litNow = await p.locator('nav.sidebar a[aria-current=page], nav.tabbar [aria-current=page]').first().innerText().catch(() => null);
      if (lit && !(litNow || '').startsWith(lit) && !(litNow === 'More')) wrong.push(`${addr} lights ${litNow}`);
      if (!lit && litNow) wrong.push(`${addr} lights ${litNow}`);
    }
    check(!wrong.length, wrong.join('; '));
    const titles = new Set();
    for (const g of ['ns-lead', 'lead-mq', 'lead-merge', 'lead-flaky', 'lead-ci-time', 'lead-review']) { await p.goto(`${BASE}/goals/${g}`); titles.add(await p.title()); }
    check(titles.size === 6, `six goals gave ${titles.size} titles`);
  },
  async U70(p, { phone }) {
    await p.goto(`${BASE}/goals?scope=all&as=rhea`);
    await openMenu(p, phone, 'Home');
    await openMenu(p, phone, 'Goals');
    await p.waitForURL(/\/goals$/);
    await p.locator('main a[href*="/goals/ns-lead"]').first().click();
    await p.waitForURL(/\/goals\/ns-lead$/);
    const says = () => p.locator('main .backlink').getAttribute('aria-label');
    check(/^Back to (Goals|your goals)$/.test(await says()), `the back link says ${await says()}`);
    await p.locator('.goal-bar .more-menu summary').click();
    await p.getByRole('group', { name: 'More about this goal' }).getByRole('link', { name: 'Change this goal' }).click();
    await p.waitForURL(/\/edit$/);
    await p.goBack(); await p.waitForURL(/\/goals\/ns-lead$/);
    check(await p.locator('.goal-bar').isVisible(), 'the goal’s summary bar is not shown');
    await p.goBack(); await p.waitForURL(/\/goals$/);
    await p.goForward(); await p.waitForURL(/\/goals\/ns-lead$/);
    await p.locator('main .backlink').click();
    await p.waitForURL(/\/goals$/);
    await p.goForward(); await p.waitForURL(/\/goals\/ns-lead$/);
    await p.goto(`${BASE}/no-such-page`);
    await shown(p, 'Page not found', `Page not found is not shown at ${p.url()}: ${(await p.title())}`);
    check(await p.locator('.not-found [role=option]', { hasText: 'Rhea Kapoor' }).isVisible(), 'Page not found offers no way on');
  },
  async U77(p) {
    await p.goto(`${BASE}/goals/ns-lead?as=rhea`);
    check(await p.locator('.goal-bar').isVisible(), 'no summary bar');
    const again = p.locator('.goal-bar .bar-actions').getByRole('link', { name: /^Check in( again)?$/ });
    check(await inView(again), 'Check in is not in view');
    check(await inView(p.getByRole('heading', { name: 'Next steps and asks' })), 'Next steps and asks is not in view');
    await again.click();
    await p.waitForURL(/\/check-in\/ns-lead/);
  },
  async U6(p) {
    await p.goto(`${BASE}/goals?scope=all&attention=1&layout=table&as=santiago`);
    check(await inView(p.locator('.trow').first()), 'the first row is not in view');
    await p.locator('.trow').first().click();
    await p.locator('.goal-bar').waitFor();
    check((await p.locator('.why-block .why-text').innerText()).length > 10, 'no reason in Why');
    await p.goto(`${BASE}/goals/fresh-kafka`);
    await p.getByLabel('Add a comment').fill('The vendor confirmed their December date holds.');
    await p.getByRole('button', { name: 'Post comment' }).click();
    await p.locator('#history .history-filters').getByRole('link', { name: /^Comments \d+/ }).click();
    await shown(p, 'The vendor confirmed their December date holds.');
    const s = await state();
    check(s.changes.some((c) => c.actorId === 'santiago' && c.goalId === 'fresh-kafka' && c.diffs.some((d) => /December date/.test(d.to))), 'the comment is not logged');
    await p.locator('#history .history-filters').getByRole('link', { name: /^Changes \d+/ }).click();
    await p.locator('#history summary', { hasText: 'Show the change' }).first().click();
    check(await p.locator('.diffs ins').first().isVisible(), 'a change does not show its before and after');
  },
  async U122(p) {
    await p.goto(`${BASE}/?as=tunde&today=2026-11-09`);
    const monday = await p.locator('.hero').innerText();
    check(/Nothing is asked of you today\./.test(monday) && /due by Thursday 12 Nov\. You have 2 to do\./.test(monday), `Monday says: ${monday}`);
    check(!(await p.locator('.page.home .btn.primary').count()), 'Monday’s Home has a primary button with nothing asked');
    const heads = await p.locator('main h2').allInnerTexts();
    check(heads.filter((t) => /^Your goals/.test(t.trim())).length === 1 && /Your goals\s*·?\s*2\b/.test(heads.join(' ')), `headings: ${heads}`);
    await p.locator('.home-mine .home-counts a').first().click();
    await p.waitForURL(/\/goals\?scope=mine&status=/);
    check(await p.locator('.count-line').isVisible(), 'no count line');
    await p.goto(`${BASE}/?today=2026-11-11`);
    const lead = await p.locator('.hero').innerText();
    check(/Check-ins are due by Thursday 12 Nov, tomorrow/.test(lead) && /\d+ check-ins? to do/.test(lead) && (await p.locator('.page.home .btn.primary').count()) === 1, `Wednesday says: ${lead}`);
    await p.locator('.hero').getByRole('link', { name: /Start check-in|Pick up where you left off/ }).click();
    await p.waitForURL(/\/check-in$/);
  },
};

J.U25 = async (p) => {
  await p.goto(`${BASE}/goals/new?as=mateo`);
  await p.getByLabel(/^Name it the way/).fill('Runbooks with an owner');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.waitForURL(/\/goals\/new\/who/);
  await p.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Team' }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByLabel('Unit').fill('%');
  await p.getByLabel('Baseline').fill('20');
  await p.getByLabel('Target').fill('90');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Publish goal' }).click();
  await shown(p, 'is published', 'publishing does not offer the first check-in');
  const first = p.getByRole('link', { name: 'Post the first check-in' });
  check(await inView(first), 'Post the first check-in is not in view');
  await first.click();
  await p.getByLabel('This week’s value').fill('20');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await shown(p, 'Check-in saved');
  const s = await state();
  const g = s.goalsList ? null : null;
  const res = await (await fetch(`${BASE}/api/state`)).json();
  const mine = res.changes.find((c) => c.action === 'created' && /Runbooks with an owner/.test(c.summary));
  check(!!mine, 'the new goal is not logged');
  check(res.changes.some((c) => c.goalId === mine.goalId && c.action === 'posted'), 'the check-in is not logged as posted');
  await p.goto(`${BASE}/goals/cost-rightsize?published=1`);
  check(!(await p.getByText('is published').count()), 'the prompt shows on a goal that already has check-ins');
};
J.U4 = async (p, { phone }) => {
  await p.goto(`${BASE}/?as=mateo`);
  await openMenu(p, phone, 'New goal');
  await shown(p, 'What do you want to achieve?');
  check(await p.locator('ol.steps').isVisible(), 'no progress indicator');
  await p.getByRole('button', { name: 'Continue' }).click();
  check(/name/.test(await p.getByRole('alert').innerText()), 'an empty name is not explained');
  await p.getByLabel(/^Name it the way/).fill('MTTR for P1 incidents');
  await p.getByRole('button', { name: 'Continue' }).click();
  await shown(p, 'Whose is it, and where does it fit?');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByLabel('Unit').fill('min');
  await p.getByLabel('Baseline').fill('90');
  await p.getByLabel('Target').fill('45');
  await p.getByRole('button', { name: 'Back-loaded' }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  await shown(p, 'Does this read right?');
  await shown(p, 'slowly at first, faster near the end');
  await p.getByRole('button', { name: 'Publish goal' }).click();
  await p.waitForURL(/\/goals\/goal_/);
  await shown(p, 'MTTR for P1 incidents');
  await shown(p, 'is published.');
  const s = await state();
  const c = s.changes.find((x) => x.action === 'created' && /MTTR for P1/.test(x.summary));
  check(!!c && c.diffs.some((d) => d.field === 'Target' && /45/.test(d.to)), `the new goal’s log lacks its target: ${JSON.stringify(c && c.diffs)}`);
};

J.U78 = async (p) => {
  await p.goto(`${BASE}/goals/ns-lead?as=rhea`);
  check(await p.locator('.goal-bar').isVisible(), 'no summary bar');
  const mine = p.locator('.step-row', { hasText: 'Rhea needs a decision' });
  const rheaButtons = await mine.locator('.step-buttons button, .step-buttons summary').allInnerTexts();
  check(rheaButtons.length === 1 && rheaButtons[0] === 'Withdraw', `Rhea’s buttons: ${rheaButtons}`);
  check((await p.locator('main').getByText('Rhea needs a decision').count()) === 1, 'the ask is said more than once');
  await p.goto(`${BASE}/goals/ns-lead?as=amara`);
  await shown(p, 'For you');
  check(await p.locator('.why-block').getByText('Waiting on a decision from Amara: see Next steps and asks').isVisible(), 'Why does not point to the list');
  const btn = p.locator('.goal-bar .bar-actions .btn.primary');
  check(await inView(btn), 'the main button is not in view');
  await btn.click();
  await p.locator('.step-row details[open] .step-panel textarea').fill('Approved for Q4, from the platform reserve.');
  await p.locator('.step-row details[open] .step-panel button[type=submit]').click();
  await p.locator('.step-row.is-settled').first().waitFor();
  check(!(await p.locator('.why-block .why-pointer').count()), 'Why still points to an answered ask');
  const s = await state();
  check(s.changes.some((c) => c.action === 'answered' && c.actorId === 'amara'), 'the answer is not logged');
};

J.U141 = async (p) => {
  await p.goto(`${BASE}/goals/ci-docker?as=hamid`);
  check(await p.locator('.goal-bar .bar-status').isVisible(), 'the goal has no status on its bar');
  const s0 = await state();
  await p.locator('.goal-bar .more-menu summary').click();
  check(await inView(p.getByRole('group', { name: 'More about this goal' }).getByRole('link', { name: 'Change this goal' })), 'Change this goal is not in view');
  check(!(await p.locator('.goal-bar').getByRole('link', { name: /Check in/ }).count()), 'an admin is offered a check-in that only the owner may post');
  const s1 = await state();
  check(s1.changes.length === s0.changes.length && s1.checkIns === s0.checkIns, 'something was saved');
  await p.goto(`${BASE}/goals/ci-docker?as=rhea`);
  const ci = p.locator('.goal-bar .bar-actions').getByRole('link', { name: 'Check in' });
  check(await ci.isVisible(), 'the owner has no check-in on the bar');
  await ci.click();
  await shown(p, 'This week’s value');
};
J.U150 = async (p) => {
  await p.goto(`${BASE}/goals/ci-docker?as=rhea&today=2026-11-11`);
  await p.locator('.goal-bar .more-menu summary').click();
  await p.getByRole('button', { name: 'Stop this goal' }).click();
  const dlg = p.getByRole('dialog', { name: 'Stop this goal' });
  check(await dlg.isVisible(), 'Stop this goal opens no dialog');
  await dlg.getByRole('button', { name: 'Stop the goal' }).click();
  check(await dlg.getByRole('alert').isVisible(), 'an empty reason is not refused');
  let s = await state();
  await dlg.getByLabel('Why is it stopping?').fill('The platform team took base images over in October.');
  await dlg.getByRole('button', { name: 'Stop the goal' }).click();
  await shown(p, 'Stopped Base image build time');
  s = await state();
  check(s.changes.some((c) => c.action === 'stopped' && c.actorId === 'rhea' && c.goalId === 'ci-docker' && c.diffs.some((d) => d.to === 'The platform team took base images over in October.')), 'the stop is not logged');
  await p.goto(`${BASE}/goals?scope=all&state=stopped`);
  await shown(p, 'Filtered by: Stopped');
  await shown(p, '1 stopped goal, most recently stopped first.');
  const li = p.locator('[data-part="Stopped goals"] li');
  check(await inView(li.first()), 'the stopped goal is not in view');
  const says = await li.first().innerText();
  check(says.includes('Base image build time') && says.includes('stopped 11 Nov by Rhea') && says.includes('The platform team took base images over in October.'), `it says: ${says}`);
  check((await li.first().locator('.life-mark').count()) === 1 && (await li.first().locator('.shape').count()) === 1, 'no life mark or status shape');
  await p.getByRole('button', { name: 'Remove' }).click();
  await p.waitForURL((u) => !/state=/.test(u.search));
  check(await p.locator('.count-line').isVisible(), 'no count line');
  check(!(await p.locator('[data-part="Stopped goals"]').count()), 'the stopped part stays');
  check(!(await p.locator('main a[href$="/goals/ci-docker"]').count()), 'the stopped goal is listed among the active goals');
};

async function main() {
  const only = process.argv.slice(2);
  const server = spawn(process.execPath, [path.join(here, '../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => server.stdout.once('data', r));
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const [id, run] of Object.entries(J)) {
      if (only.length && !only.includes(id)) continue;
      for (const [width, vp] of Object.entries(WIDTHS)) {
        await reset();
        const context = await browser.newContext({ viewport: vp });
        const p = await context.newPage();
        p.setDefaultTimeout(6000);
        try { await run(p, { phone: width === 'phone' }); console.log(`PASS ${id} ${width}`); }
        catch (e) { failed++; console.log(`FAIL ${id} ${width}: ${e instanceof CheckFailed ? e.message : e.message.split("\n")[0]} (at ${p.url()})`); }
        await context.close();
      }
    }
  } finally { await browser.close(); server.kill(); }
  console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
  process.exit(failed ? 1 : 0);
}
main();
