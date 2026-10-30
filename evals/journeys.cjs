/* Browser journeys: drive the built app the way a lead would, in Chromium, and check what they see.
   Each journey is tagged with the requirements it exercises. Usage: BASE=http://localhost:4318 node evals/journeys.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4318';
const TODAY = '2026-10-30'; // week 7 of the demo cycle
const OUT = path.join(__dirname, 'out');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const ROUTES = ['/', '/check-in/head', '/goals', '/goals/head', '/goals/cfr', '/goals/access', '/goals/new', '/goals/lead/edit'];

const results = [];
const consoleErrors = [];
let browser;

const url = (p) => BASE + p + (p.includes('?') ? '&' : '?') + 'today=' + TODAY;

async function page(viewport = DESK) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consoleErrors.push(p.url() + ' · ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) consoleErrors.push(p.url() + ' · ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  return p;
}

function expectTrue(cond, msg) { if (!cond) throw new Error(msg); }
async function expectText(p, text, msg) {
  try {
    await p.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 });
  } catch {
    throw new Error(msg || `expected to see “${text}”`);
  }
}
const PEOPLE = { 'Maya Chen': 'maya', 'Sam Patel': 'sam', 'Kofi Boateng': 'kofi', 'Leo Park': 'leo', 'Tom Reid': 'tom' };
async function asViewer(p, name) {
  await p.locator('#viewer').selectOption(PEOPLE[name]);
}
/** Click Post even while it is marked unavailable, as a person can, to see what is still needed. */
const tryPost = (p) => p.getByRole('button', { name: 'Post check-in' }).click({ force: true });

async function journey(id, reqs, title, fn) {
  const started = Date.now();
  let p;
  try {
    p = await page(fn.viewport);
    await fn(p);
    results.push({ id, reqs, title, pass: true, ms: Date.now() - started });
  } catch (e) {
    const shot = path.join(OUT, id + '.png');
    if (p) await p.screenshot({ path: shot, fullPage: true }).catch(() => {});
    results.push({ id, reqs, title, pass: false, error: String(e.message || e).split('\n')[0], screenshot: path.relative(path.join(__dirname, '..'), shot), ms: Date.now() - started });
  } finally {
    if (p) await p.context().close();
  }
}

const J = [];
const def = (id, reqs, title, fn, viewport) => { fn.viewport = viewport; J.push([id, reqs, title, fn]); };

def('J01', ['CHECKIN-STATUS-VS-PLAN', 'ONE-PER-WEEK', 'PERSIST'], 'Owner posts an on-plan check-in, edits it, and it survives a reload', async (p) => {
  await p.goto(url('/'));
  await expectText(p, 'Intake-to-delivery time');
  await p.getByLabel('This week’s value').fill('27.6');
  await expectText(p, '1% ahead', 'the gap against plan updates as the value is typed');
  expectTrue(await p.getByRole('status').filter({ hasText: 'Ready to post' }).count() === 1, 'ready to post once the value is in');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'Checked in for week 7 · On track');
  await expectText(p, 'All checked in');
  await p.reload();
  await expectText(p, 'All checked in', 'still checked in after a reload');
  await p.getByRole('link', { name: /Intake-to-delivery time/ }).first().click();
  await p.getByRole('button', { name: 'Edit check-in' }).click();
  await p.getByLabel('This week’s value').fill('27.5');
  await p.getByRole('button', { name: 'Update check-in' }).click();
  await p.goto(url('/goals/head'));
  const week7 = await p.locator('tbody tr').filter({ has: p.locator('td:first-child', { hasText: /^7$/ }) }).count();
  expectTrue(week7 === 1, `expected one week-7 row in the history, saw ${week7}`);
  await expectText(p, '27.5 days');
});

def('J02', ['REASON-BEHIND', 'PATH-TO-GREEN', 'GOAL-PAGE'], 'Behind plan: posting is blocked until the reason and path to green are given', async (p) => {
  await p.goto(url('/'));
  await p.getByLabel('This week’s value').fill('29.0');
  await expectText(p, 'Why is it behind plan?');
  await tryPost(p);
  await expectText(p, 'Still needed: why it’s behind, path to green');
  expectTrue(await p.getByText('Checked in for week 7').count() === 0, 'must not post while incomplete');
  await p.getByRole('button', { name: 'Blocked by a dependency' }).click();
  await p.getByLabel('Explanation').fill('The Brain is still waiting on repo access from Security.');
  await p.getByLabel('What changes').fill('Interim read-only scope for the Brain');
  await p.getByLabel('Back on plan by').selectOption('9');
  await p.getByLabel(/Needs a decision/).fill('Elena: approve the interim scope');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'Checked in for week 7 · Off track');
  await p.goto(url('/goals/head'));
  await expectText(p, 'Back on plan by week 9');
  await expectText(p, 'Elena: approve the interim scope');
  await expectText(p, 'Forecast if nothing changes');
  await expectText(p, 'Path to green');
  expectTrue(await p.locator('.strip .chip.off').count() === 1, 'status strip shows Off track');
});

def('J03', ['GREENER', 'OWNER-CALL'], 'A greener call needs a reason and is flagged on the goal and in the list', async (p) => {
  await p.goto(url('/'));
  await p.getByLabel('This week’s value').fill('29.0');
  await p.getByRole('button', { name: 'At risk' }).click();
  await expectText(p, 'Your call is greener than the calculation');
  await p.getByRole('button', { name: 'Blocked by a dependency' }).click();
  await p.getByLabel('Explanation').fill('The Brain is still waiting on repo access from Security.');
  await p.getByLabel('What changes').fill('Interim read-only scope for the Brain');
  await p.getByLabel('Back on plan by').selectOption('9');
  await tryPost(p);
  await expectText(p, 'Still needed: why your call is greener');
  await p.getByPlaceholder(/The fix ships next week/).fill('Interim scope is agreed in principle; approval is Thursday.');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'Checked in for week 7 · At risk');
  await p.goto(url('/goals/head'));
  expectTrue(await p.locator('.strip .chip.risk').count() === 1, 'official status is the owner’s At risk');
  await expectText(p, 'Calculated: Off track');
  await expectText(p, 'Owner’s call is greener than calculated');
  await p.goto(url('/goals'));
  await expectText(p, 'greener than calculated');
});

def('J04', ['REASON-AHEAD'], 'Well ahead: asks why, and whether to propose a higher target', async (p) => {
  await p.goto(url('/'));
  await asViewer(p, 'Sam Patel');
  await p.getByRole('link', { name: /PRs with AI code review/ }).click();
  await p.getByLabel('This week’s value').fill('80');
  await expectText(p, 'Why is it well ahead of plan?');
  await expectText(p, 'Should the target change?');
  await p.getByRole('button', { name: 'Change landed early' }).click();
  await p.getByLabel('Explanation').fill('Monorepo support shipped, so every repo now gets AI review.');
  await p.getByRole('button', { name: 'Propose a new target' }).click();
  await p.getByLabel('Proposed target').fill('90');
  await tryPost(p);
  await expectText(p, 'a proposed target beyond the current one');
  await p.getByLabel('Proposed target').fill('99');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'Target change proposed');
  await expectText(p, '95% → 99%');
});

def('J05', ['MILESTONE', 'PATH-TO-GREEN'], 'Milestone: a stage slipping three weeks turns it off track and needs a path to green', async (p) => {
  await p.goto(url('/'));
  await asViewer(p, 'Leo Park');
  await expectText(p, 'Brain data model and AI infrastructure live');
  await p.getByLabel('Private repo indexing: state').selectOption('late');
  await p.getByLabel('Private repo indexing: now expected').selectOption('10');
  expectTrue(await p.locator('.panel .chip.off').count() > 0, 'calculated status shows Off track');
  await expectText(p, 'Why is it late?');
  await p.getByRole('button', { name: 'Blocked by a dependency' }).click();
  await p.getByLabel('Explanation').fill('Security’s repo-access controls moved from week 6 to week 9.');
  await p.getByRole('button', { name: 'Off track' }).click();
  await p.getByLabel('What changes').fill('Index public repos now; interim scope for private ones');
  await p.getByLabel('Back on plan by').selectOption('10');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'Checked in for week 7 · Off track');
  await p.goto(url('/goals/brain'));
  await expectText(p, 'Expected week 10 · 3 late');
});

def('J06', ['GOAL-CREATE', 'HIERARCHY', 'PLAN-SHAPE'], 'A lead creates an input goal that feeds the headline', async (p) => {
  await p.goto(url('/goals/new'));
  await asViewer(p, 'Kofi Boateng');
  await p.getByRole('button', { name: 'Publish goal' }).click();
  await expectText(p, 'Give the goal a name');
  await p.getByLabel('Name').fill('MTTR for P1 incidents');
  await p.getByLabel('Unit', { exact: true }).fill('min');
  await p.getByLabel('Start (week 0)').fill('90');
  await p.getByLabel('Target (week 13)').fill('45');
  await p.getByRole('button', { name: 'Back-loaded' }).click();
  expectTrue(await p.getByLabel('Plan preview').locator('svg').count() === 1, 'plan preview chart shows');
  await p.getByLabel('Team').selectOption({ label: 'SRE / AIOps' });
  await p.getByLabel(/Estimated effect/).fill('1');
  await p.getByRole('button', { name: 'Publish goal' }).click();
  await p.waitForURL(/\/goals\/goal_/);
  await expectText(p, 'MTTR for P1 incidents');
  await expectText(p, 'Back-loaded');
  await p.goto(url('/goals'));
  const sre = p.getByRole('region', { name: 'SRE / AIOps' });
  expectTrue(await sre.getByText('MTTR for P1 incidents').count() === 1, 'listed under SRE / AIOps');
  await p.goto(url('/goals/head'));
  expectTrue(await p.getByRole('complementary').getByText('MTTR for P1 incidents').count() === 1, 'headline lists the new input');
});

def('J07', ['REBASELINE'], 'Changing a plan after check-ins re-baselines it and keeps the original', async (p) => {
  await p.goto(url('/goals/lead/edit'));
  await p.getByLabel('Target (week 13)').fill('1.5');
  await expectText(p, 're-baselines the plan from week 7');
  await p.getByRole('button', { name: 'Save goal' }).click();
  await p.waitForURL(/\/goals\/lead$/);
  await expectText(p, 'Plan re-baselined in week 7');
  await expectText(p, 'Original plan');
});

def('J08', ['STALE', 'OWNER-CALL'], 'A goal with no check-in for 14 days shows Stale, never on track', async (p) => {
  await p.goto(url('/goals/env'));
  expectTrue(await p.locator('.strip .chip.stale').count() === 1, 'status strip shows Stale');
  await expectText(p, 'No owner check-in for');
  await p.goto(url('/goals'));
  const row = p.getByRole('link', { name: /Self-service environments/ });
  expectTrue(await row.locator('.chip.stale').count() === 1, 'list shows Stale');
});

def('J09', ['OWNER-ONLY'], 'Only the owner can post; others see the goal but no check-in', async (p) => {
  await p.goto(url('/'));
  await asViewer(p, 'Tom Reid');
  await expectText(p, 'Nothing to check in');
  await asViewer(p, 'Maya Chen');
  await p.goto(url('/check-in/review'));
  expectTrue(await p.locator('.panel h2', { hasText: 'PRs with AI code review' }).count() === 0, 'another owner’s goal does not open for check-in');
  await p.goto(url('/goals/review'));
  expectTrue(await p.getByRole('link', { name: 'Check in', exact: true }).count() === 0, 'no Check in button on someone else’s goal');
});

def('J10', ['PERSIST'], 'Reset demo data restores the seed', async (p) => {
  await p.goto(url('/'));
  await p.getByLabel('This week’s value').fill('27.6');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'All checked in');
  await p.getByRole('button', { name: 'Reset demo data' }).click();
  await expectText(p, 'Due this week · 1');
});

def('J11', ['PHONE'], 'Every screen fits a 390px phone with the tab bar in view', async (p) => {
  const problems = [];
  for (const r of ROUTES) {
    await p.goto(url(r));
    await p.waitForTimeout(150);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (m.sw > m.cw + 1) problems.push(`${r}: ${m.sw - m.cw}px of horizontal scroll`);
    const tab = await p.locator('.tabbar').boundingBox();
    if (!tab || tab.y + tab.height > PHONE.height + 1 || tab.y < PHONE.height - 120) problems.push(`${r}: tab bar not pinned to the bottom`);
    if (!(await p.locator('.side').isHidden())) problems.push(`${r}: sidebar visible on phone`);
  }
  await p.goto(url('/check-in/head'));
  await p.getByLabel('This week’s value').fill('27.6');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  await expectText(p, 'Checked in for week 7');
  expectTrue(!problems.length, problems.join('; '));
}, PHONE);

for (const [id, vp, label] of [['J12', DESK, 'desktop'], ['J13', PHONE, 'phone']]) {
  def(id, ['A11Y'], `No serious or critical accessibility violations (${label}); status chips carry a shape and a word`, async (p) => {
    const problems = [];
    for (const r of ROUTES) {
      await p.goto(url(r));
      await p.waitForTimeout(150);
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => {
        const res = await window.axe.run(document, { resultTypes: ['violations'] });
        return res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.nodes.length}): ${x.nodes[0].target.join(' ')}`);
      });
      v.forEach((x) => problems.push(r + ' · ' + x));
      const bare = await p.$$eval('.chip.on, .chip.risk, .chip.off, .chip.stale, .chip.done, .chip.planned', (els) => els.filter((e) => !e.querySelector('svg') || !e.textContent.trim()).length);
      if (bare) problems.push(`${r} · ${bare} status chips without a shape or a word`);
    }
    expectTrue(!problems.length, problems.slice(0, 6).join(' | ') + (problems.length > 6 ? ` … +${problems.length - 6} more` : ''));
  }, vp);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch();
  for (const [id, reqs, title, fn] of J) {
    await journey(id, reqs, title, fn);
    const r = results[results.length - 1];
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${id} ${title}${r.pass ? '' : '\n     ' + r.error}`);
  }
  // Every page the journeys touched, checked for errors.
  results.push({ id: 'J14', reqs: ['NO-ERRORS'], title: 'No console or page errors across every journey', pass: consoleErrors.length === 0, error: consoleErrors.slice(0, 5).join(' | ') || undefined });
  console.log(`${consoleErrors.length ? 'FAIL' : 'PASS'} J14 No console or page errors across every journey${consoleErrors.length ? '\n     ' + consoleErrors.slice(0, 5).join('\n     ') : ''}`);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'journeys.json'), JSON.stringify(results, null, 2));
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
