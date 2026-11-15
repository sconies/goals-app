// Reviews' journeys (spec/modules/reviews/journeys/*.md), as far as this build has them, in a real browser at both widths.
// Each check throws when it fails; the process exits 1 when any journey fails or the app does not start. No results file.
// Usage: node modules/reviews/journeys.mjs [U103 U104 ...]   (from rebuild/; JOURNEY_PORT, default 47841)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = Number(process.env.JOURNEY_PORT || 47841);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const WS = 'Platform Engineering';

class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (p, text, words) => check(await p.locator('main, [role=dialog]').getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const snapshot = async () => (await fetch(`${BASE}/api/state`)).json();
const main = (p) => p.locator('main').innerText();
const box = (p) => p.getByRole('checkbox', { name: /^Reviews/ });
const dialog = (p) => p.getByRole('dialog', { name: /^Switch off Reviews in/ });
async function switchOff(p) {
  await box(p).click();
  check(await dialog(p).isVisible(), 'the “Switch off Reviews in” dialog does not show');
  await dialog(p).getByRole('button', { name: 'Switch off Reviews' }).click();
  await shown(p, 'Reviews is off in');
}
async function openMenu(p, phone, name) {
  if (!phone) return p.locator('nav.sidebar').getByRole('link', { name, exact: true }).first().click();
  const tab = p.locator('nav.tabbar > a', { hasText: name });
  if (await tab.count()) return tab.first().click();
  await p.locator('nav.tabbar details.more summary').click();
  return p.locator('nav.tabbar .more-sheet').getByRole('link', { name, exact: true }).first().click();
}
const menuWords = async (p, phone) => (phone ? p.locator('nav.tabbar > a') : p.locator('nav.sidebar a[data-item]')).allInnerTexts();

const J = {
  async U103(p, { phone }) {
    await p.goto(`${BASE}/workspace/features?as=amara`);
    check(await box(p).isChecked() && /Working together/.test(await main(p)) && /6 reviews are set up\./.test(await main(p)), 'Features does not show Reviews under Working together, on, with “6 reviews are set up.”');
    await box(p).click();
    check(await dialog(p).isVisible(), 'the read-back dialog does not show');
    const says = await dialog(p).innerText();
    check(/6 reviews/.test(says), `the read-back does not name the 6 reviews: ${says.slice(0, 300)}`);
    check(/Nothing is deleted/.test(says), 'the read-back does not say nothing is deleted');
    await dialog(p).getByRole('button', { name: 'Cancel' }).click();
    check(!(await snapshot()).modulesOff.includes('reviews'), 'Cancel switched Reviews off');
    await box(p).click();
    await dialog(p).getByRole('button', { name: 'Switch off Reviews' }).click();
    await shown(p, 'Reviews is off in'); await shown(p, 'Nothing it saved is lost.');
    await p.goto(`${BASE}/`);
    const menu = await menuWords(p, phone);
    check(!menu.includes('Reviews'), `the menu still has Reviews: ${menu.join(', ')}`);
    if (phone) check(menu.includes('People'), `the phone’s tabs have no People in Reviews’ place: ${menu.join(', ')}`);
    const lead = await p.locator('[data-part="This week’s main action"]').innerText().catch(() => '');
    check(/Goals you watch · \d+ needs? attention/.test(lead), `Home’s lead is not “Goals you watch · {n} need attention”: ${lead}`);
    check(/See them/.test(lead), 'Home’s lead has no See them');
    check(!(await p.locator('[data-part="next-review"]').count()), 'Home still shows a review cell');
    const home = (await main(p)).split('\n').filter((l) => !/“.*”/.test(l));
    const named = home.filter((l) => /review|session|walk/i.test(l));
    check(!named.length, `Home still names a review: “${named[0]}”`);
    await p.goto(`${BASE}/reviews`);
    await shown(p, 'Page not found'); await shown(p, 'Reviews is switched off in', 'the Reviews address does not say Reviews is switched off');
    await p.goto(`${BASE}/goals/ns-lead?review=weekly`);
    check(!(await p.locator('[data-part="walk"]').count()), 'the walk still shows');
    await p.goto(`${BASE}/goals/ns-lead?history=reviews`);
    check(await p.locator('#history').isVisible(), 'no History section');
    check(!(await p.locator('[data-part="last-talked"]').count()), 'the goal still shows Last time we talked');
    const kept = /Platform leadership weekly/.test(await p.locator('#history').innerText());
    await p.goto(`${BASE}/`);
    const stepThere = await p.getByText('Take the runner budget to the finance review', { exact: false }).first().isVisible().catch(() => false);
    check(kept && stepThere, `with Reviews off: History ${kept ? 'keeps' : 'lost'} what the review said; the next step is ${stepThere ? 'still' : 'no longer'} on Home`);
    const s = await snapshot();
    check(s.changes.some((c) => c.entity === 'workspace' && c.actorId === 'amara' && c.summary === 'Switched off Reviews'), 'switching Reviews off was not logged');
    await p.goto(`${BASE}/workspace/features`);
    await box(p).click(); await shown(p, 'Reviews is on in');
    await switchOff(p);
    await p.getByRole('button', { name: 'Undo' }).last().click();
    await shown(p, 'Reviews is back on.');
    check(!(await snapshot()).modulesOff.includes('reviews'), 'Undo said Reviews is back on and left it off');
    await p.goto(`${BASE}/reviews`);
    await shown(p, 'Platform leadership weekly', 'Reviews did not come back with every review');
  },
  async U104(p) {
    await p.goto(`${BASE}/reviews?as=amara`);
    check(await p.locator('.reviews-list').isVisible(), 'the list of reviews does not show');
    await p.goto(`${BASE}/`);
    const before = ((await main(p)).match(/Platform leadership weekly|Quarterly business review/g) || []).length;
    await p.goto(`${BASE}/workspace/features`);
    await switchOff(p);
    await p.goto(`${BASE}/`);
    check(!/Not held yet|Review today|Open the review/.test(await main(p)), 'Home with Reviews off still names a review');
    await p.goto(`${BASE}/workspace/features`);
    await box(p).click(); await shown(p, 'Reviews is on in');
    await p.goto(`${BASE}/reviews`);
    check(await p.locator('.reviews-list').isVisible(), 'the list of reviews does not show back on');
    await p.goto(`${BASE}/`);
    const t = await main(p);
    const after = (t.match(/Platform leadership weekly|Quarterly business review/g) || []).length;
    check(after === before && after > 0 && !/Not held yet/.test(t), `back on, Home names ${after} reviews (was ${before})`);
    const s = await snapshot();
    check(s.changes.some((c) => c.summary === 'Switched off Reviews') && s.changes.some((c) => c.summary === 'Switched on Reviews'), 'switching Reviews off and on was not logged');
  },
  async U154(p) {
    await p.goto(`${BASE}/workspace/features?as=amara`);
    await box(p).click();
    const says = await dialog(p).innerText();
    const risks = 0;
    check(says.includes('Check-ins are still due by Thursday. “Before the review” becomes “by Thursday” on Home, in the check-in and in the count of goals checked in on time.') && (risks ? says.includes(`${risks} accepted risk`) : !/accepted risk/.test(says)), `the read-back does not say the due day: ${says}`);
    await dialog(p).getByRole('button', { name: 'Switch off Reviews' }).click();
    await shown(p, 'Reviews is off in');
    await p.goto(`${BASE}/?as=rhea`);
    const named = [];
    for (const a of ['/', '/check-in', '/goals', '/goals/ns-lead', '/goals/ci-docker', '/people/rhea', '/teams', '/activity', '/help']) {
      await p.goto(BASE + a);
      // the app's own words for a deadline or a session (people's own words, goal names and History's unlinked names aside)
      for (const l of (await main(p)).split('\n')) if (/before (the|this|\w+’s) review|after \w+’s review|review is today|Not held yet|Next review|Open the review|Last time we talked|Said in reviews|goals to discuss/.test(l)) named.push(`${a}: ${l.slice(0, 120)}`);
    }
    check(!named.length, `with Reviews off a page names a review: ${named.join('; ')}`);
  },
  async U155(p) {
    await p.goto(`${BASE}/workspace/features?as=amara&today=2026-11-02`);
    await switchOff(p);
    await p.goto(`${BASE}/workspace/features?today=2026-11-06`);
    check(!(await box(p).isChecked()), 'Reviews came back on by itself on Friday');
    await box(p).click(); await shown(p, 'Reviews is on in');
    await p.goto(`${BASE}/reviews`);
    const list = await main(p);
    await p.goto(`${BASE}/`);
    const home = await main(p);
    check(/Platform leadership weekly/.test(list) && !/Not held yet/.test(list) && !/Not held yet/.test(home), `back on Friday: ${/Not held yet/.test(list) ? 'Reviews' : 'Home'} says Not held yet`);
    const s = await snapshot();
    check(s.changes.some((c) => c.summary === 'Switched off Reviews') && s.changes.some((c) => c.summary === 'Switched on Reviews'), 'switching off and on was not logged');
  },
  async U13(p, { phone }) {
    await p.goto(`${BASE}/?as=jun`);
    await openMenu(p, phone, 'Reviews');
    await shown(p, 'Platform leadership weekly');
    await p.getByRole('link', { name: 'Set up a review' }).click();
    await p.getByRole('button', { name: 'Set up the review' }).click();
    check(await p.getByRole('alert').filter({ hasText: 'Give the review a name' }).isVisible(), 'an unnamed review is not explained');
    await p.getByLabel('Name').fill('SRE fortnightly');
    await p.getByLabel('Every 4 weeks').check();
    await p.getByLabel('On', { exact: true }).selectOption('4');
    await p.getByLabel('North star').check();
    await p.getByLabel('People').fill('jun, mateo');
    await p.getByRole('button', { name: 'Set up the review' }).click();
    await shown(p, 'SRE fortnightly'); await shown(p, 'Every 4 weeks, Fridays');
    check(await p.locator('.ring:visible').count(), 'the review page has no progress');
    check((await p.locator('.agenda .agenda-row').count()) >= 2, 'the review does not list its goals');
    check(await p.getByRole('link', { name: 'Start review' }).isVisible(), 'no way to start the new review');
    const s = await snapshot();
    const r = s.reviews.find((x) => x.name === 'SRE fortnightly');
    check(!!r && r.everyWeeks === 4 && r.weekday === 4 && r.people.includes('mateo') && r.people.includes('jun') && s.changes.some((c) => c.entity === 'review' && c.actorId === 'jun'), 'the review was not saved as set up');
  },
  // N21: a switched-off module's addresses say so, and who can switch it on; the read-back counts what stays
  async N21(p) {
    await p.goto(`${BASE}/workspace/features?as=amara`);
    await box(p).click();
    const says = await dialog(p).innerText();
    check(/6 reviews stay/.test(says) && /open next steps? stays?/.test(says) && /open questions?/.test(says), `the read-back does not count what stays: ${says}`);
    await dialog(p).getByRole('button', { name: 'Switch off Reviews' }).click();
    for (const a of ['/reviews', '/reviews/new', '/reviews/weekly', '/reviews/weekly/summary', '/review']) {
      await p.goto(BASE + a);
      await shown(p, `Reviews is switched off in ${WS}. An admin can switch it on in Workspace, Features.`, `${a} does not say Reviews is switched off and who can switch it on`);
    }
  },
};

const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
const up = await new Promise((r) => { server.stdout.once('data', () => r(true)); server.once('exit', () => r(false)); setTimeout(() => r(false), 10000); });
if (!up) { console.error('The app did not start.'); process.exit(1); }
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(J);
const browser = await chromium.launch();
let failed = 0;
try {
  for (const id of want) {
    if (!J[id]) { console.log(`${id}: NOT BUILT (no runner for it)`); failed++; continue; }
    for (const [wname, vp] of Object.entries(WIDTHS)) {
      await reset();
      const ctx = await browser.newContext({ viewport: vp });
      const p = await ctx.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      try { await J[id](p, { phone: wname === 'phone' }); check(!errors.length, `page errors: ${errors.join('; ')}`); console.log(`${id} ${wname}: pass`); }
      catch (e) { failed++; console.log(`${id} ${wname}: FAIL: ${e.message.split('\n')[0]}`); }
      await ctx.close();
    }
  }
} finally { await browser.close(); server.kill(); }
process.exit(failed ? 1 : 0);
