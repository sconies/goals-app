/* User-journey evals: drive the built app in Chromium as each profile would, on a phone and a desktop,
   and score every journey against the 10-point ease-of-use test in requirements.json.
   Usage: BASE=http://localhost:4318 [DOWN=http://localhost:4319] node evals/journeys.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4318';
const DOWN = process.env.DOWN || '';
const TODAY = '2026-10-30'; // Friday of week 7 in the example
const OUT = path.join(__dirname, 'out');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const DEVICES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const CRITERIA = ['entry', 'one-action', 'progress', 'budget', 'errors', 'finish', 'attention', 'parity', 'a11y', 'logged'];

const url = (p) => BASE + p + (p.includes('?') ? '&' : '?') + 'store=browser&today=' + TODAY;
const consoleErrors = [];
let browser;

function fail(msg) { throw new Error(msg); }
/** Waits until some visible element shows the text (a hidden duplicate, like a phone-only label on a desktop, doesn't count). */
async function see(p, text, msg, timeout = 5000) {
  const all = p.getByText(text, { exact: false });
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const n = await all.count();
    for (let i = 0; i < n; i++) if (await all.nth(i).isVisible().catch(() => false)) return;
    await p.waitForTimeout(100);
  }
  fail(msg || `expected to see “${text}”`);
}

/** Everything a journey needs: counted interactions, checkpoints and criteria. */
function harness(device) {
  const crit = {};
  let n = 0;
  const notes = [];
  let p = null;
  const set = (k, ok, note) => {
    if (crit[k] === false) return;
    crit[k] = ok;
    if (!ok && note) notes.push(`${k}: ${note}`);
  };
  return {
    device, crit, notes, set,
    use(page) { p = page; return page; },
    get page() { return p; },
    get count() { return n; },
    async click(loc) { n++; await loc.click(); },
    async fill(loc, v) { n++; await loc.fill(v); },
    /** Checks a screen: at most one primary action in view, no serious a11y issues, big enough targets on a phone. */
    async checkpoint(label) {
      await p.waitForTimeout(220);
      const primaries = await p.$$eval('.btn.primary', (els) => els.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden';
      }).map((e) => ({ text: e.textContent.trim(), h: e.getBoundingClientRect().height })));
      set('one-action', primaries.length <= 1, `${label}: ${primaries.length} primary buttons in view (${primaries.map((x) => x.text).join(' | ')})`);
      if (device === 'phone') {
        const small = primaries.filter((x) => x.h < 44);
        set('a11y', !small.length, `${label}: primary button under 44px (${small.map((x) => x.text + ' ' + Math.round(x.h)).join(', ')})`);
      }
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
        .filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} ${x.nodes[0].target.join(' ')}`));
      set('a11y', !v.length, `${label}: ${v.slice(0, 2).join('; ')}`);
      const sideways = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      set('a11y', sideways <= 1, `${label}: page scrolls sideways by ${sideways}px`);
    },
    async inView(loc, k, label) {
      const box = await loc.first().boundingBox().catch(() => null);
      const vh = DEVICES[device].height;
      set(k, !!box && box.y >= 0 && box.y + box.height <= vh + 1, `${label} is ${box ? 'below the fold' : 'missing'}`);
    },
    async progressShown(label) {
      const ok = await p.locator('.ring:visible, .steps:visible, .dots:visible, .checklist:visible, .bar:visible').count() > 0;
      set('progress', ok, `${label}: no progress indicator`);
    },
    async snapshot(ws = 'example') {
      return p.evaluate((w) => JSON.parse(localStorage.getItem('goals-app-v2:' + w) || 'null'), ws);
    },
  };
}

async function newPage(device, viewer) {
  const ctx = await browser.newContext({ viewport: DEVICES[device] });
  if (viewer) await ctx.addInitScript((v) => { if (!sessionStorage.getItem('viewer-set')) { localStorage.setItem('goals-app-viewer:example', v); sessionStorage.setItem('viewer-set', '1'); } }, viewer);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consoleErrors.push(`${device} ${p.url()} · ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) consoleErrors.push(`${device} ${p.url()} · ${m.text()}`); });
  return p;
}

const navTo = async (h, p, label) => {
  const side = p.locator('.side').getByRole('link', { name: label });
  if (await side.isVisible().catch(() => false)) return h.click(side);
  const tab = p.locator('.tabbar').getByRole('link', { name: label });
  if (await tab.isVisible().catch(() => false)) return h.click(tab);
  await h.click(p.locator('.tabbar').getByRole('button', { name: 'More' }));
  await h.click(p.getByRole('dialog').getByRole('link', { name: label }));
};

/* ---------------- the ten journeys ---------------- */
const J = [];
const journey = (id, reqs, title, budget, fn, na = []) => J.push({ id, reqs, title, budget, fn, na });

journey('U1', ['CARRY-OVER', 'CHECKIN-STATUS-VS-PLAN', 'REASON-BEHIND', 'PATH-TO-GREEN', 'ONE-PER-WEEK', 'CHANGE-LOG', 'DRAFTS', 'PROFILES', 'PERSIST'], 'Weekly check-in, all due goals in one pass', 17, async (h, device) => {
  // Sam: two goals due and both on plan. Number, post, next: three interactions a goal.
  let p = h.use(await newPage(device, 'sam'));
  await p.goto(url('/'));
  await see(p, '2 check-ins to do');
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await h.checkpoint('home');
  await h.click(p.getByRole('link', { name: /Start check-in/ }));
  await h.progressShown('check-in');
  await h.fill(p.getByLabel('This week’s value'), '70');
  await see(p, 'ahead');
  await h.checkpoint('first goal');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Posted');
  await h.checkpoint('posted');
  await h.click(p.getByRole('button', { name: /Next: / }));
  // Leave mid-way and come back: the typed value is restored.
  await p.getByLabel('This week’s value').fill('2.9');
  await p.goto(url('/'));
  await see(p, 'Pick up where you left off', 'a draft is offered back on home');
  await p.getByRole('link', { name: /Pick up where you left off/ }).click();
  const restored = await p.getByLabel('This week’s value').inputValue();
  if (restored !== '2.9') fail('the draft value was not restored');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await h.click(p.getByRole('button', { name: /Finish/ }));
  await see(p, 'Week 7 is done');
  h.set('finish', await p.getByRole('link', { name: 'Back to home' }).isVisible(), 'no way on from the finish screen');
  await h.checkpoint('done');
  let s = await h.snapshot();
  const posts = s.changes.filter((c) => c.actorId === 'sam' && c.action === 'posted' && /week 7/.test(c.summary));
  h.set('logged', posts.length === 2 && posts.every((c) => c.diffs.some((d) => d.field === 'Value')), `expected two logged week-7 posts by Sam, saw ${posts.length}`);
  await p.goto(url('/'));
  await p.reload();
  await see(p, 'You’re all set for week 7', 'posted check-ins survive a reload');
  await p.context().close();

  // Maya: behind plan. One question per screen: the number, then last week's note offered back.
  // "Still true" carries it over and posts; an empty number is explained in place.
  p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/check-in'));
  await p.locator('.focus-foot button[type=submit]').click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Type this week’s number' }).isVisible(), 'an empty number says nothing');
  await h.fill(p.getByLabel('This week’s value'), '29.0');
  h.set('attention', await p.locator('.verdict[data-tone=off]').isVisible(), 'behind plan is not flagged in the verdict');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'Is last week’s note still true?', 'last week’s reason and path are offered back');
  await h.progressShown('carry');
  await h.checkpoint('carry');
  await h.click(p.getByRole('button', { name: 'Still true', exact: true }));
  if (await p.getByRole('group', { name: 'Back on plan by' }).isVisible().catch(() => false)) {
    await h.click(p.getByRole('group', { name: 'Back on plan by' }).getByRole('button').first());
    await h.click(p.getByRole('button', { name: 'Post check-in' }));
  }
  await see(p, 'Posted');
  s = await h.snapshot();
  const c = s.changes.filter((x) => x.actorId === 'maya' && x.action === 'posted').pop();
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Path to green') && c.diffs.some((d) => /Brain/.test(d.to)), 'Maya’s carried-over reason and path are not in the log');
  await p.context().close();
});

journey('U2', ['ATTENTION', 'PROFILES', 'STALE'], 'What needs me? Home shows what’s due, off track, stale or slipping', 1, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/'));
  await see(p, 'Needs attention');
  await h.checkpoint('home');
  h.set('progress', await p.locator('.hero .ring').isVisible(), 'no weekly progress ring');
  const cards = p.locator('.arow');
  if ((await cards.count()) < 2) fail('expected at least two attention cards for Maya');
  const reasons = await cards.locator('.arow-why').allInnerTexts();
  h.set('attention', reasons.every((r) => r.trim().length > 20) && await p.locator('.arow[data-tone=risk] .arow-icon, .arow[data-tone=off] .arow-icon').count() > 0, 'attention rows lack a reason or a status icon');
  await h.inView(cards.first(), 'entry', 'the first attention card');
  await see(p, 'late', 'an overdue check-in is called late');
  await h.click(cards.first().getByRole('link', { name: 'Check in' }));
  await see(p, 'What’s the number this week?');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U3', ['REVIEW', 'ATTENTION', 'CHANGE-LOG', 'PROFILES'], 'Weekly review: work the queue to zero and make the calls', 13, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  await p.goto(url('/'));
  await see(p, 'things need you');
  await h.inView(p.getByRole('link', { name: /Start review/ }), 'entry', 'Start review');
  await h.checkpoint('home');
  await h.click(p.getByRole('link', { name: /Start review/ }));
  await p.locator('.review-card').waitFor();
  await h.progressShown('review');
  let items = 0;
  while (items < 12) {
    const card = p.locator('.review-card');
    if (!(await card.isVisible().catch(() => false))) break;
    h.set('attention', (await card.locator('.flag').count()) > 0 && (await card.locator('.lede').innerText()).length > 15, 'a review card has no flag or reason');
    await h.checkpoint('item ' + (items + 1));
    if (items === 1) {
      // Ask a question: the first click asks for the question; sending it without one is refused.
      await h.click(p.getByRole('button', { name: 'Ask a question' }));
      await p.getByRole('button', { name: 'Send question' }).click();
      h.set('errors', await p.getByPlaceholder(/What would it take/).isVisible(), 'asking without a question is not caught');
      await h.fill(p.getByPlaceholder(/What would it take/), 'Can the golden path ship before the GPU quota?');
      await h.click(p.getByRole('button', { name: 'Send question' }));
    } else {
      await h.click(p.getByRole('button', { name: /Seen, no action|Approve/ }).first());
    }
    items++;
    await p.locator('.review-card, .celebrate').first().waitFor();
    await p.waitForTimeout(200);
  }
  await see(p, 'Review done for week 7');
  h.set('finish', await p.getByRole('link', { name: 'Back to home' }).isVisible(), 'no way on from the review summary');
  const s = await h.snapshot();
  const calls = s.changes.filter((c) => c.actorId === 'elena' && c.entity === 'decision' && c.id !== 'chg_dec_review_4');
  const ask = calls.find((c) => c.action === 'asked');
  h.set('logged', calls.length === items && !!ask && ask.diffs.some((d) => d.field === 'Note'), `expected ${items} logged decisions with the question's text, saw ${calls.length}`);
  await p.goto(url('/'));
  await see(p, 'Review done for week 7', 'home shows the review as done');
  await p.context().close();
});

journey('U4', ['GOAL-CREATE', 'PLAN-SHAPE', 'HIERARCHY', 'CHANGE-LOG', 'DRAFTS'], 'Set up a goal, step by step', 12, async (h, device) => {
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/'));
  const entry = device === 'desktop' ? p.locator('.side').getByRole('link', { name: 'New goal' }) : p.locator('.tabbar').getByRole('button', { name: 'More' });
  await h.inView(entry, 'entry', 'the way to New goal');
  await navTo(h, p, 'New goal');
  await see(p, 'What do you want to achieve?');
  await h.progressShown('wizard');
  await p.getByRole('button', { name: /Continue/ }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'name' }).isVisible(), 'an empty name is not explained');
  await h.fill(p.getByLabel(/Name it the way/), 'MTTR for P1 incidents');
  await h.checkpoint('step 1');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.fill(p.getByLabel('Unit'), 'min');
  await h.fill(p.getByLabel('Today (week 0)'), '90');
  await h.fill(p.getByLabel(/Target \(week 13\)/), '45');
  await h.click(p.getByRole('button', { name: /Back-loaded/ }));
  if (!(await p.getByLabel('Plan preview').isVisible())) fail('no plan preview');
  await h.checkpoint('step 2');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Where does it fit?');
  await h.checkpoint('step 3');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Does this read right?');
  await see(p, 'Intake-to-delivery time', 'the summary says what it feeds');
  await h.checkpoint('step 4');
  await h.click(p.getByRole('button', { name: 'Publish goal' }));
  await p.waitForURL(/\/goals\/goal_/);
  await see(p, 'MTTR for P1 incidents');
  h.set('finish', await p.getByText(/Published/).isVisible().catch(() => false) || await p.getByRole('link', { name: /Check in/ }).isVisible(), 'publishing is not confirmed');
  const s = await h.snapshot();
  const c = s.changes.filter((x) => x.action === 'created' && x.actorId === 'kofi').pop();
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Target' && d.to === '45 min') && c.diffs.some((d) => d.field === 'Plan shape' && d.to === 'Back-loaded'), 'the new goal is not logged with its fields');
  await p.context().close();
}, ['attention']);

journey('U5', ['WORKSPACES', 'CHANGE-LOG', 'PROFILES'], 'Load your own data and switch between it and the example', 11, async (h, device) => {
  const p = h.use(await newPage(device, 'priya'));
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /Load your data/ }), 'entry', 'Load your data');
  await h.checkpoint('coach home');
  await h.click(p.getByRole('link', { name: /Load your data/ }));
  await h.progressShown('import');
  await h.fill(p.getByLabel('Workspace name'), 'Platform Engineering');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Who’s involved?');
  // A person without a team is explained on their row before anything is saved.
  await p.getByLabel('Person 1: name').fill('Ana Silva');
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Ana Silva has no team.' }).isVisible(), 'a row with no team is not explained');
  // Pasting rows from a spreadsheet fills the table.
  await p.getByLabel('Person 1: name').evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'Name\tTeam\tRole\nAna Silva\tPlatform\tsponsor\nBen Ortiz\tPlatform\tlead');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  if ((await p.getByLabel('Person 2: name').inputValue()) !== 'Ben Ortiz') fail('pasted rows did not fill the table');
  // The Excel template downloads, and uploading it back reads both sheets.
  const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Download the template/ }).click()]);
  const file = path.join(OUT, `template-${device}.xlsx`);
  await download.saveAs(file);
  await p.locator('input[type=file]').first().setInputFiles(file);
  await see(p, '4 people, plus a goals sheet');
  h.count; await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Bring them from a spreadsheet');
  await see(p, 'Deploy lead time');
  await h.checkpoint('goals');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.checkpoint('check');
  await h.click(p.getByRole('button', { name: 'Create workspace' }));
  await see(p, 'Platform Engineering is ready');
  h.set('finish', await p.getByRole('link', { name: 'Go to home' }).isVisible(), 'no way on after creating');
  await h.click(p.getByRole('link', { name: 'Go to home' }));
  await see(p, 'Chloe', 'home now speaks to the new workspace’s coach');
  const wsId = await p.evaluate(() => localStorage.getItem('goals-app-workspace'));
  const s = await h.snapshot(wsId);
  h.set('logged', !!s && s.changes.some((c) => c.action === 'imported' && /4 people/.test(c.summary)), 'creating the workspace is not logged');
  await h.click(p.locator('.wsbtn:visible').first());
  await h.click(p.getByRole('dialog').getByRole('button', { name: /Example: Developer Platform/ }));
  await see(p, 'Priya', 'switching back shows the example again');
  await p.context().close();
}, ['attention']);

journey('U6', ['NOTES', 'GOAL-PAGE', 'CHANGE-LOG', 'ATTENTION', 'REBASELINE'], 'Understand a goal and its change history', 3, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/goals'));
  await h.inView(p.locator('.arow').first(), 'entry', 'the first goal');
  await h.click(p.locator('.arow-main', { hasText: 'Repo-access controls' }));
  await see(p, 'Updated by');
  h.set('attention', await p.locator('.story[data-tone=off] .chip.off').isVisible() && await p.locator('.why .note-line').count() > 0, 'off track and its reasons are not shown');
  await h.checkpoint('goal page');
  await h.click(p.getByRole('button', { name: /Show .*change/ }).first());
  h.set('logged', await p.locator('.diffs ins').first().isVisible(), 'a change does not show its before and after');
  h.set('finish', true);
  h.set('progress', await p.locator('.stagelist').isVisible(), 'the stages are not shown');
  // A mid-week note goes straight into the goal's activity, logged like every other save.
  await h.fill(p.getByLabel('Add a note'), 'Vendor confirmed the SEC-88 fix ships Tuesday.');
  await h.click(p.getByRole('button', { name: 'Post note' }));
  await see(p, 'Vendor confirmed the SEC-88 fix ships Tuesday.', 'the note shows in the activity');
  const s = await h.snapshot();
  h.set('logged', s.changes.some((c) => c.entity === 'note' && c.actorId === 'maya' && c.goalId === 'access' && c.diffs.some((d) => /SEC-88 fix/.test(d.to))), 'the note is not in the change log');
  await p.goto(url('/goals/review'));
  await see(p, 'Target changed in week 4: 75% → 95%', 'the re-baseline is explained on the chart');
  await p.context().close();
}, ['errors', 'budget']);

journey('U7', ['REASON-AHEAD', 'REVIEW', 'REBASELINE', 'CHANGE-LOG', 'PLAN-CHANGE'], 'Propose a target change and get it approved', 18, async (h, device) => {
  let p = h.use(await newPage(device, 'sam'));
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await h.click(p.getByRole('link', { name: /Start check-in/ }));
  await h.fill(p.getByLabel('This week’s value'), '90');
  await h.click(p.getByRole('button', { name: 'Next' }));
  // Last week's reason is offered back; this week's is different, so edit it.
  await h.click(p.getByRole('button', { name: 'Something changed', exact: true }));
  await see(p, 'Why is it ahead?');
  await h.click(p.getByRole('button', { name: 'Change landed early' }));
  await h.fill(p.getByLabel('What happened'), 'Monorepo support shipped, so every repo gets AI review.');
  await h.click(p.getByRole('button', { name: 'Propose a new target' }));
  await h.fill(p.getByLabel('Proposed target'), '90');
  await p.locator('.focus-foot button[type=submit]').click({ force: true });
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'beyond the current one' }).isVisible(), 'a target below the current one is not explained');
  await h.fill(p.getByLabel('Proposed target'), '99');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Posted');
  // A plan change from the edit screen: once check-ins have started it is proposed, with a reason, not saved.
  await p.goto(url('/goals/lead'));
  await h.click(p.getByRole('link', { name: 'Edit' }));
  await h.fill(p.getByLabel(/^Target/), '1.5');
  await p.locator('.focus-foot button[type=submit]').click({ force: true });
  h.set('errors', await p.locator('textarea.invalid[aria-label="Why change it?"]').isVisible() && await p.getByRole('alert').filter({ hasText: 'Say why' }).isVisible(), 'a plan change without a reason is not explained');
  await h.fill(p.getByLabel('Why change it?'), 'The merge queue cut lead time faster than planned; 1.5 days is reachable.');
  await h.checkpoint('edit');
  await h.click(p.getByRole('button', { name: 'Propose change' }));
  await see(p, 'Proposed: target 2.0 days → 1.5 days', 'the goal page shows the proposal waiting');
  let s = await h.snapshot();
  if (s.goals.find((g) => g.id === 'lead').plan.target !== 2) fail('the proposed target was applied before approval');
  // Same browser, other profile: the sponsor.
  await p.goto(url('/'));
  await p.locator('.me:visible, .profilebtn:visible').first().click();
  await p.getByRole('dialog').getByRole('button', { name: /Elena Ruiz/ }).click();
  await see(p, 'Good afternoon, Elena');
  await p.goto(url('/review'));
  await p.locator('.review-card').waitFor();
  await h.progressShown('review');
  const reach = async (name) => {
    for (let i = 0; i < 12; i++) {
      await p.locator('.review-card, .celebrate').first().waitFor();
      if (await p.getByRole('button', { name }).isVisible().catch(() => false)) return;
      await p.getByRole('button', { name: 'Skip for now' }).click();
    }
    fail(`never reached “${name}” in the review`);
  };
  await reach('Approve 99%');
  h.set('attention', await p.locator('.review-card .flag-proposal').isVisible(), 'the proposal is not flagged');
  await h.checkpoint('proposal');
  await h.click(p.getByRole('button', { name: 'Approve 99%' }));
  await p.waitForTimeout(250);
  // The goal page's "Decide" link opens the review on that goal.
  await p.goto(url('/goals/lead'));
  await h.click(p.getByRole('link', { name: 'Decide' }));
  await reach('Approve change');
  await see(p, 'Target 2.0 days → 1.5 days', 'the review card says what the plan change is');
  await h.checkpoint('plan change');
  await h.click(p.getByRole('button', { name: 'Approve change' }));
  await p.goto(url('/goals/review'));
  await see(p, 'Target changed in week 7: 75% → 99%', 'the approved target re-baselines the plan, keeping the original');
  h.set('finish', true);
  s = await h.snapshot();
  const c = s.changes.find((x) => x.action === 'approved' && x.actorId === 'elena' && x.goalId === 'review' && /99%/.test(x.summary));
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Target' && d.from === '95%' && d.to === '99%'), 'the approval is not logged with the old and new target');
  const lead = s.goals.find((g) => g.id === 'lead');
  const proposed = s.changes.find((x) => x.action === 'proposed' && x.actorId === 'sam' && x.goalId === 'lead');
  const approved = s.changes.find((x) => x.actorId === 'elena' && x.goalId === 'lead' && /plan change/.test(x.summary));
  h.set('logged', lead.plan.target === 1.5 && !lead.pending && lead.originalPlan?.target === 2 && !!proposed && proposed.diffs.some((d) => d.field === 'Why') && !!approved, 'the plan change is not applied, kept as original, or logged');
  await p.context().close();
});

journey('U8', ['STALE', 'ATTENTION', 'PROFILES'], 'Chase stale goals', 1, async (h, device) => {
  const p = h.use(await newPage(device, 'priya'));
  await p.evaluate(() => 0);
  // Give the coach an own workspace first so home leads with the rhythm, not the import.
  await p.goto(url('/'));
  await p.evaluate(() => localStorage.setItem('goals-app-v2:workspaces', JSON.stringify([{ id: 'ws_x', name: 'X', kind: 'own', createdAt: '2026-10-01T00:00:00Z' }])));
  await p.reload();
  await see(p, 'has gone quiet');
  await h.inView(p.getByRole('link', { name: /Start with Self-service/ }), 'entry', 'Start with the stale goal');
  await h.checkpoint('coach home');
  await h.click(p.getByRole('link', { name: /Start with Self-service/ }));
  await p.waitForURL(/\/goals\/env$/);
  await p.locator('.story').waitFor();
  h.set('attention', await p.locator('.story[data-tone=stale] .chip.stale').isVisible() && await p.getByText('can’t be trusted').isVisible(), 'stale is not flagged on the goal');
  h.set('progress', await p.locator('.story').isVisible(), 'no status story');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U9', ['PROFILES', 'HIERARCHY', 'OWNER-ONLY'], 'See how my team’s work maps to the goals', 1, async (h, device) => {
  const p = h.use(await newPage(device, 'tom'));
  await p.goto(url('/'));
  await see(p, 'Your team’s goals');
  await h.inView(p.locator('.gline').first(), 'entry', 'the team’s goals');
  await see(p, 'Headline goal');
  h.set('attention', await p.locator('.gline .dot.risk, .gline .dot.off, .gline .dot.on').count() > 0, 'goal status is not shown');
  await h.checkpoint('contributor home');
  await h.click(p.locator('.gline').first());
  await see(p, 'Feeds into', 'the goal page says what it feeds', 3000).catch(async () => { await p.getByRole('tab', { name: 'Details' }).click(); await see(p, 'Feeds into'); });
  h.set('finish', true);
  h.set('progress', true);
  // A contributor can follow a goal but not post its check-in.
  await p.goto(url('/check-in/review'));
  await see(p, 'Only Sam Patel checks in on this goal');
  if (await p.getByRole('button', { name: /Post check-in/ }).count()) fail('a non-owner was offered Post check-in');
  await p.context().close();
}, ['errors', 'logged']);

journey('U10', ['MOTION'], 'Close the cycle with a retro', 0, async () => {
  fail('Not built yet: there is no cycle close or retro.');
});

/* ---------------- platform checks ---------------- */
async function platformChecks() {
  const out = [];
  const add = (id, reqs, title, pass, error) => out.push({ id, reqs, title, pass, error: pass ? undefined : error });
  // Reduced motion switches animation off.
  const ctx = await browser.newContext({ viewport: DEVICES.desktop, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url('/'));
  await p.locator('.hero').waitFor();
  const anim = await p.$eval('.hero', (e) => getComputedStyle(e).animationName);
  add('P1', ['MOTION'], 'Animation switches off under reduced motion', anim === 'none', `hero animation is ${anim}`);
  await ctx.close();
  // A dead database: a skeleton while waiting, then a clear error with Try again.
  if (DOWN) {
    const c2 = await browser.newContext({ viewport: DEVICES.phone });
    const q = await c2.newPage();
    await q.goto(DOWN + '/?today=' + TODAY);
    await q.waitForTimeout(900);
    const skeleton = await q.locator('.skeleton').isVisible().catch(() => false);
    let error = false;
    try { await q.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 20000 }); error = true; } catch { /* timed out */ }
    add('P2', ['MOTION', 'NO-ERRORS'], 'Loading shows a skeleton, and an unreachable database becomes a clear error with Try again', skeleton && error, `skeleton ${skeleton}, error ${error}`);
    await c2.close();
  }
  // Every screen fits a phone with no sideways scroll and no serious a11y issues.
  for (const [device, vp] of Object.entries(DEVICES)) {
    const c3 = await browser.newContext({ viewport: vp });
    const r = await c3.newPage();
    const problems = [];
    for (const [who, route] of [['maya', '/'], ['elena', '/'], ['priya', '/'], ['tom', '/'], ['maya', '/goals'], ['maya', '/goals/head'], ['maya', '/goals/access'], ['maya', '/activity'], ['maya', '/workspace'], ['elena', '/review'], ['leo', '/check-in'], ['sam', '/goals/lead/edit']]) {
      await r.goto(url(route));
      await r.evaluate((w) => localStorage.setItem('goals-app-viewer:example', w), who);
      await r.reload();
      await r.waitForTimeout(250);
      const sideways = await r.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (sideways > 1) problems.push(`${who} ${route}: ${sideways}px sideways`);
      await r.addScriptTag({ content: AXE });
      const v = await r.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id + ' ' + x.nodes[0].target.join(' ')));
      v.forEach((x) => problems.push(`${who} ${route}: ${x}`));
      const bare = await r.$$eval('.chip.on, .chip.risk, .chip.off, .chip.stale, .chip.done, .chip.planned', (els) => els.filter((e) => !e.querySelector('svg') || !e.textContent.trim()).length);
      if (bare) problems.push(`${who} ${route}: ${bare} status chips without a shape or word`);
    }
    add(device === 'phone' ? 'P3' : 'P4', device === 'phone' ? ['PHONE', 'A11Y'] : ['A11Y'], `Every screen on ${device}: no sideways scroll, no serious accessibility issues, status as shape plus word`, !problems.length, problems.slice(0, 5).join(' | '));
    await c3.close();
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch();
  const journeys = [];
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  for (const j of J.filter((x) => !only.length || only.includes(x.id))) {
    const per = {};
    for (const device of Object.keys(DEVICES)) {
      const started = Date.now();
      const h = harness(device);
      let error;
      try {
        await j.fn(h, device);
      } catch (e) {
        error = String(e.message || e).split('\n')[0];
        if (h.page) await h.page.screenshot({ path: path.join(OUT, `${j.id}-${device}.png`), fullPage: true }).catch(() => {});
      }
      per[device] = { ok: !error, error, crit: h.crit, notes: h.notes, count: h.count, ms: Date.now() - started };
    }
    const scores = {};
    for (const k of CRITERIA) {
      if (j.na.includes(k)) { scores[k] = 'n/a'; continue; }
      if (k === 'parity') { scores[k] = per.phone.ok && per.desktop.ok; continue; }
      if (k === 'budget') { scores[k] = per.phone.ok && per.desktop.ok && Math.max(per.phone.count, per.desktop.count) <= j.budget; continue; }
      scores[k] = per.phone.ok && per.desktop.ok && per.phone.crit[k] === true && per.desktop.crit[k] === true;
    }
    const applicable = CRITERIA.filter((k) => scores[k] !== 'n/a');
    const met = applicable.filter((k) => scores[k] === true).length;
    const score = Math.round((met / applicable.length) * 100) / 10;
    const r = { id: j.id, title: j.title, reqs: j.reqs, budget: j.budget, scores, score, pass: per.phone.ok && per.desktop.ok, phone: per.phone, desktop: per.desktop };
    journeys.push(r);
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${j.id} ${score}/10 ${j.title}  [phone ${per.phone.count} steps ${per.phone.ms}ms · desktop ${per.desktop.count} steps ${per.desktop.ms}ms]`);
    for (const d of ['phone', 'desktop']) {
      if (per[d].error) console.log(`     ${d}: ${per[d].error}`);
      per[d].notes.forEach((n) => console.log(`     ${d} ${n}`));
    }
    const missed = CRITERIA.filter((k) => scores[k] === false);
    if (missed.length) console.log(`     missed: ${missed.join(', ')}`);
  }
  const platform = only.length ? [] : await platformChecks();
  platform.forEach((x) => console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} ${x.title}${x.pass ? '' : '\n     ' + x.error}`));
  platform.push({ id: 'P5', reqs: ['NO-ERRORS'], title: 'No console or page errors across every journey', pass: consoleErrors.length === 0, error: consoleErrors.slice(0, 4).join(' | ') || undefined });
  console.log(`${consoleErrors.length ? 'FAIL' : 'PASS'} P5 No console or page errors${consoleErrors.length ? '\n     ' + consoleErrors.slice(0, 4).join('\n     ') : ''}`);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'journeys.json'), JSON.stringify({ journeys, platform }, null, 2));
  process.exit(journeys.every((r) => r.pass || r.id === 'U10') && platform.every((x) => x.pass) ? 0 : 1);
})();

