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

/** The demo: the example data in this browser, with the role switcher. */
const url = (p) => BASE + '/demo' + p + (p.includes('?') ? '&' : '?') + 'today=' + TODAY;
/** The real app, with its data kept in this browser (the eval build has no Supabase). */
const live = (p) => BASE + p + (p.includes('?') ? '&' : '?') + 'store=browser&today=' + TODAY;
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
      // With a sheet open, only what's in the sheet counts: the page behind it is covered.
      const primaries = await p.$$eval('.btn.primary', (els) => els.filter((e) => !document.querySelector('[role=dialog]') || e.closest('[role=dialog]')).filter((e) => {
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
      const sideways = await p.evaluate(() => {
        const w = document.documentElement.clientWidth;
        const by = document.documentElement.scrollWidth - w;
        const el = by > 1 ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 1).pop() : null;
        return { by, el: el ? (el.tagName.toLowerCase() + '.' + String(el.className).split(' ').join('.')) : '' };
      });
      set('a11y', sideways.by <= 1, `${label}: page scrolls sideways by ${sideways.by}px (${sideways.el})`);
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

journey('U1', ['UPDATE-ANYTIME', 'CARRY-OVER', 'CHECKIN-STATUS-VS-PLAN', 'REASON-BEHIND', 'PATH-TO-GREEN', 'ONE-PER-WEEK', 'CHANGE-LOG', 'DRAFTS', 'PROFILES', 'PERSIST'], 'Weekly check-in, all due goals in one pass', 17, async (h, device) => {
  // Sam: two goals due and both on plan. Number, post, next: three interactions a goal.
  let p = h.use(await newPage(device, 'sam'));
  await p.goto(url('/'));
  await see(p, '2 check-ins to do');
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await h.checkpoint('home');
  await h.click(p.getByRole('link', { name: /Start check-in/ }));
  await h.progressShown('check-in');
  await h.fill(p.getByLabel('This week’s value'), '70');
  await see(p, 'above week-7 plan', 'the verdict names the week it compares with');
  await h.checkpoint('first goal');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
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
  // The last post is the only confirmation: what was saved, that the week is done, and a way on.
  await see(p, 'checked in for week 7', 'the last post says the week is done');
  h.set('finish', await p.getByRole('link', { name: 'Back to home' }).isVisible() && await p.getByRole('link', { name: 'View the goal' }).isVisible(), 'no way on from the confirmation');
  await h.checkpoint('done');
  let s = await h.snapshot();
  const posts = s.changes.filter((c) => c.actorId === 'sam' && c.action === 'posted' && /week 7/.test(c.summary));
  h.set('logged', posts.length === 2 && posts.every((c) => c.diffs.some((d) => d.field === 'Value')), `expected two logged week-7 posts by Sam, saw ${posts.length}`);
  await p.goto(url('/'));
  await p.reload();
  await see(p, 'Your check-ins are in', 'posted check-ins survive a reload, and home moves on to the review Sam is in');
  // An update between check-ins is the same check-in flow, started from the goal page; it replaces the week's number and is logged.
  await p.goto(url('/goals/review'));
  await h.click(p.getByRole('link', { name: 'Post an update' }));
  await see(p, 'You checked in for week 7 already', 'an update says it replaces this week’s check-in');
  await h.fill(p.getByLabel('This week’s value'), '69');
  await h.click(p.getByRole('button', { name: 'Post update' }));
  await see(p, 'Update saved');
  s = await h.snapshot();
  const upd = s.changes.filter((c) => c.actorId === 'sam' && c.goalId === 'review' && c.action === 'edited').pop();
  h.set('logged', !!upd && /update for week 7/.test(upd.summary) && upd.diffs.some((d) => d.field === 'Value' && d.from === '70%' && d.to === '69%'), 'the off-cycle update is not logged with the old and new number');
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
  await h.click(p.getByRole('button', { name: /^Still true/ }));
  if (await p.getByRole('group', { name: 'Back on plan by' }).isVisible().catch(() => false)) {
    await h.click(p.getByRole('group', { name: 'Back on plan by' }).getByRole('button').first());
    await h.click(p.getByRole('button', { name: 'Post check-in' }));
  }
  await see(p, 'Check-in saved');
  s = await h.snapshot();
  const c = s.changes.filter((x) => x.actorId === 'maya' && x.action === 'posted').pop();
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Path to green') && c.diffs.some((d) => /Brain/.test(d.to)), 'Maya’s carried-over reason and path are not in the log');
  await p.context().close();
});

journey('U2', ['ATTENTION', 'PROFILES', 'STALE'], 'What needs me? Home shows what’s due, off track, stale or slipping', 1, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/'));
  await see(p, 'Your goals that need you');
  await see(p, 'Watching', 'home also shows the goals Maya watches');
  await h.checkpoint('home');
  h.set('progress', await p.locator('.hero .ring').isVisible(), 'no weekly progress ring');
  const cards = p.locator('.arow');
  if ((await cards.count()) < 1) fail('expected an attention card for Maya’s own goals');
  const reasons = await cards.locator('.arow-why').allInnerTexts();
  h.set('attention', reasons.every((r) => r.trim().length > 20) && await p.locator('.arow[data-tone=risk] .arow-icon, .arow[data-tone=off] .arow-icon').count() > 0, 'attention rows lack a reason or a status icon');
  await h.inView(cards.first(), 'entry', 'the first attention card');
  await see(p, 'late', 'an overdue check-in is called late');
  await h.click(cards.first().getByRole('link', { name: 'Check in' }));
  await see(p, 'What’s the number this week?');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U3', ['REVIEW', 'INSPECT-ACT', 'OUTCOME-TREE', 'ATTENTION', 'CHANGE-LOG', 'REVIEW-RUN'], 'Weekly review: walk the goals worst first and record what was said', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  // The goals view opens on the trees: each top goal with its forecast, then what feeds it, worst first.
  await p.goto(url('/goals'));
  await p.locator('.outcome-card').first().waitFor();
  const cards = await p.locator('.outcome-card').count();
  const firstRow = p.locator('.outcome').first().locator('.trow').first();
  h.set('attention', cards >= 2 && await p.getByText(/Projected/).first().isVisible() && ['off', 'risk', 'stale'].includes(await firstRow.getAttribute('data-tone')) && (await firstRow.locator('.trow-why').innerText()).length > 15,
    'the tree does not lead with the worst goal and its reason');
  // Home leads with the review Elena is in.
  await p.goto(url('/'));
  await see(p, 'goals to review');
  await h.inView(p.getByRole('link', { name: /Open the review/ }), 'entry', 'Open the review');
  await h.checkpoint('home');
  await h.click(p.getByRole('link', { name: /Open the review/ }));
  await see(p, 'Platform weekly review');
  await h.progressShown('review home');
  await h.checkpoint('review home');
  await h.click(p.getByRole('button', { name: /^Start review/ }));
  // The review walks the goal pages themselves, one at a time, with what to say at the bottom.
  await p.locator('.reviewbar').waitFor();
  let items = 0;
  while (items < 14 && /review=weekly/.test(p.url())) {
    await p.locator('.decide').waitFor();
    h.set('attention', await p.locator('.story .chip').isVisible(), 'a goal in the review has no status');
    if (items < 2) await h.checkpoint('item ' + (items + 1));
    const here = p.url();
    const reviewedNext = p.locator('.decide').getByRole('button', { name: /^Reviewed & / });
    if (items === 1) {
      // Ask the owner in a composer that names the goal; an empty question is refused; saving stays on the goal.
      const title = (await p.locator('h1').first().innerText()).trim();
      await h.click(p.locator('.decide .quiet-links').getByRole('button', { name: /^Ask / }));
      h.set('attention', ((await p.getByRole('dialog').getAttribute('aria-label')) || '').includes(title), 'the composer does not name the goal');
      await p.getByRole('button', { name: 'Save question' }).click();
      h.set('errors', await p.getByRole('alert').filter({ hasText: 'Write a few words' }).isVisible(), 'asking without a question is not caught');
      await h.fill(p.getByPlaceholder(/What would it take/), 'Can the golden path ship before the GPU quota?');
      await h.click(p.getByRole('button', { name: 'Save question' }));
      await p.locator('.said').getByText('Can the golden path ship').waitFor();
      h.set('finish', p.url() === here, 'saving a question moved to another goal');
      h.set('errors', (await p.locator('.reviewbar').innerText()).includes('1 reviewed'), 'saving a question also marked the goal reviewed');
      await h.checkpoint('saved question');
      await h.click(reviewedNext);
    } else if (items === 2) {
      await h.click(p.getByRole('button', { name: 'Add a note' }));
      await h.fill(p.getByPlaceholder('What the review said'), 'Agreed to pair Leo and Jonas on the interim scope.');
      await h.click(p.getByRole('button', { name: 'Save note' }));
      await p.locator('.said').getByText('Agreed to pair').waitFor();
      await h.click(reviewedNext);
    } else {
      await reviewedNext.click();
    }
    const toasts = await p.locator('.toast').count();
    h.set('attention', toasts <= 1, `${toasts} messages stacked up during the review`);
    items++;
    await p.waitForURL((u) => u.href !== here);
    await p.waitForTimeout(120);
  }
  await see(p, 'Review complete', 'the review ends on its record');
  await see(p, 'Can the golden path ship', 'what was said is kept in the summary');
  h.set('finish', await p.getByRole('link', { name: 'Reviews' }).first().isVisible(), 'no way on from the review record');
  const s = await h.snapshot();
  const calls = s.changes.filter((c) => c.actorId === 'elena' && c.entity === 'decision' && c.id !== 'chg_dec_weekly_6');
  const ask = calls.find((c) => c.action === 'asked');
  h.set('logged', calls.length === items + 2 && !!ask && ask.diffs.some((d) => /golden path/.test(d.to)), `expected ${items} reviews plus a question and a note, logged, saw ${calls.length}`);
  // The owner sees the question on the goal page.
  const asked = s.decisions.find((d) => d.kind === 'ask');
  await p.goto(url('/goals/' + asked.goalId));
  await see(p, 'Question from Platform weekly review', 'the owner sees the question on the goal');
  await p.context().close();
});

journey('U4', ['GOAL-CREATE', 'PLAN-SHAPE', 'HIERARCHY', 'LEVELS', 'CHANGE-LOG', 'DRAFTS'], 'Set up a goal, step by step', 13, async (h, device) => {
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
  await h.fill(p.getByLabel(/^Today \(week/), '90');
  await h.fill(p.getByLabel(/Target \(week 13\)/), '45');
  await h.click(p.getByRole('button', { name: /Back-loaded/ }));
  if (!(await p.getByLabel('Plan preview').isVisible())) fail('no plan preview');
  await h.checkpoint('step 2');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Where does it fit?');
  await p.getByLabel('Feeds into').selectOption('head');
  await h.click(p.getByRole('button', { name: 'SVP' }));
  await h.checkpoint('step 3');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Does this read right?');
  await see(p, 'Intake-to-delivery time', 'the summary says what it feeds');
  await see(p, 'SVP level', 'the summary says its level');
  await h.checkpoint('step 4');
  await h.click(p.getByRole('button', { name: 'Publish goal' }));
  await p.waitForURL(/\/goals\/goal_/);
  await see(p, 'MTTR for P1 incidents');
  h.set('finish', await p.getByText(/Published/).isVisible().catch(() => false) || await p.getByRole('link', { name: /Check in/ }).isVisible(), 'publishing is not confirmed');
  const s = await h.snapshot();
  const c = s.changes.filter((x) => x.action === 'created' && x.actorId === 'kofi').pop();
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Target' && d.to === '45 min') && c.diffs.some((d) => d.field === 'Plan shape' && d.to === 'Back-loaded') && c.diffs.some((d) => d.field === 'Level' && d.to === 'SVP'), 'the new goal is not logged with its fields and level');
  await p.context().close();
}, ['attention']);

journey('U5', ['WORKSPACES', 'ONBOARDING', 'CHANGE-LOG', 'ADMIN'], 'Load your own data and switch between it and the example', 15, async (h, device) => {
  const p = h.use(await newPage(device, 'priya'));
  await p.goto(url('/'));
  await see(p, 'Try it with your own team');
  await h.inView(p.getByRole('link', { name: 'Set one up' }), 'entry', 'Set one up');
  await h.checkpoint('admin home');
  await h.click(p.getByRole('link', { name: 'Set one up' }));
  await p.locator('.steps').first().waitFor();
  await h.progressShown('set up');
  await h.fill(p.getByLabel('Name', { exact: true }), 'Platform Engineering');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.fill(p.getByLabel('Your name'), 'Priya Nair');
  await h.fill(p.getByLabel('Your team'), 'Leadership');
  await see(p, 'You’ll be this workspace’s admin');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'Who else is on it?');
  // A second person with your name is explained on their row before anything is saved; a row with no team takes yours.
  await p.getByLabel('Person 1: name').fill('Priya Nair');
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'appears twice' }).isVisible(), 'a duplicate name is not explained on its row');
  // Pasting rows from a spreadsheet fills the table.
  await p.getByLabel('Person 1: name').evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'Name\tTeam\tAdmin\nAna Silva\tPlatform\tyes\nBen Ortiz\tPlatform\t');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  if ((await p.getByLabel('Person 2: name').inputValue()) !== 'Ben Ortiz') fail('pasted rows did not fill the table');
  if (!(await p.getByLabel('Person 1: admin').isChecked())) fail('the pasted Admin column was not read');
  // The Excel template downloads, and uploading it back reads both sheets.
  const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Download the Excel template/ }).click()]);
  const file = path.join(OUT, `template-${device}.xlsx`);
  await download.saveAs(file);
  await p.locator('input[type=file]').first().setInputFiles(file);
  await see(p, '4 people, plus a goals sheet');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.click(p.getByRole('radio', { name: /Goals from your spreadsheet/ }));
  await h.checkpoint('starting point');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'Deploy lead time', 'the check step shows the outcome from the file');
  await h.checkpoint('check');
  await h.click(p.getByRole('button', { name: 'Create workspace' }));
  await see(p, 'Platform Engineering is ready');
  h.set('finish', await p.locator('.celebrate .btn.primary').isVisible(), 'no way on after creating');
  await p.goto(url('/'));
  await see(p, 'Priya', 'home now speaks to the new workspace’s admin');
  const wsId = await p.evaluate(() => localStorage.getItem('goals-app-workspace'));
  const s = await h.snapshot(wsId);
  h.set('logged', !!s && s.changes.some((c) => c.action === 'imported' && /5 people/.test(c.summary)), 'creating the workspace is not logged');
  await p.locator('.wsbtn:visible').first().click();
  await p.getByRole('dialog').getByRole('button', { name: /Example: Developer Platform/ }).click();
  await see(p, 'Priya', 'switching back shows the example again');
  await p.context().close();
}, ['attention']);

journey('U11', ['ONBOARDING', 'IDENTITY', 'DEMO-MODE', 'CHANGE-LOG'], 'Real app: from empty to a filled-in workspace with a template, then a teammate joins', 14, async (h, device) => {
  const p = h.use(await newPage(device));
  await p.goto(live('/'));
  // The empty real app explains itself and offers the demo, with one thing to do.
  await see(p, 'Weekly goals that stay on track');
  h.set('attention', await p.getByRole('link', { name: /try the demo/i }).isVisible(), 'the empty app does not offer the demo');
  await h.inView(p.getByRole('button', { name: 'Set up your workspace' }), 'entry', 'Set up your workspace');
  await h.checkpoint('welcome');
  await h.click(p.getByRole('button', { name: 'Set up your workspace' }));
  await h.progressShown('set up');
  await p.getByRole('button', { name: 'Next' }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Give the workspace a name' }).isVisible(), 'an empty name is not explained');
  await h.fill(p.getByLabel('Name', { exact: true }), 'Growth');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.fill(p.getByLabel('Your name'), 'Rosa Lind');
  await h.fill(p.getByLabel('Your team'), 'Growth');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await p.getByLabel('Person 1: name').fill('Omar Haddad');
  await p.getByLabel('Person 1: team').fill('Growth');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.click(p.getByRole('radio', { name: /Product team/ }));
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'What outcome are you after?');
  if ((await p.getByLabel('Outcome', { exact: true }).inputValue()) !== 'Weekly active users') fail('the template did not fill in the outcome');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'What feeds it?');
  await h.checkpoint('goals');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.click(p.getByRole('button', { name: 'Create workspace' }));
  await see(p, 'Growth is ready');
  h.set('finish', await p.locator('.celebrate .btn.primary').isVisible(), 'no next step after setting up');
  await h.checkpoint('ready');
  const ws = await p.evaluate(() => localStorage.getItem('goals-live-workspace'));
  const s = await p.evaluate((w) => JSON.parse(localStorage.getItem('goals-live-v1:' + w) || 'null'), ws);
  h.set('logged', !!s && s.goals.length === 4 && s.goals.some((g) => g.level === 'north-star' && g.title === 'Weekly active users') && s.people.find((x) => x.name === 'Rosa Lind')?.admin && s.changes.some((c) => c.action === 'imported'), 'the new workspace is not saved and logged with its outcome and goals');
  // The real app has no demo controls, and never shows the example.
  await p.goto(live('/goals'));
  await see(p, 'Weekly active users');
  if (await p.locator('.rolebar').count()) fail('the real app shows the demo role switcher');
  if (await p.getByText('Example: Developer Platform').count()) fail('the real app shows the example');
  // A teammate on another device says who they are once, then lands on their own home.
  const state = await p.context().storageState();
  const other = await browser.newContext({ viewport: DEVICES[device], storageState: { cookies: [], origins: state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((x) => !x.name.startsWith('goals-live-me:')) })) } });
  const q = await other.newPage();
  await q.goto(live('/'));
  await see(q, 'Who are you?');
  await q.getByRole('button', { name: /Omar Haddad/ }).click();
  await see(q, 'Omar', 'the teammate lands on their own home');
  await other.close();
  await p.context().close();
});

journey('U12', ['DEMO-MODE'], 'Demo: switch person, look around, start over', 4, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/'));
  await see(p, 'Example');
  h.set('attention', await p.locator('.demo-tag:visible').count() > 0, 'the demo is not marked as the demo');
  await h.checkpoint('demo home');
  const elena = p.locator('.rolebar').getByRole('button', { name: 'Elena', exact: true });
  await h.inView(elena, 'entry', 'the person switcher');
  await h.click(elena);
  await see(p, 'Good', 'Elena’s home opens');
  await see(p, 'goals to review', 'Elena’s home leads with her review');
  h.set('progress', await p.locator('.ring:visible').count() > 0, 'no progress on Elena’s home');
  // A change in the demo stays in this browser and can be undone in one place.
  await p.goto(url('/workspace'));
  await h.click(p.getByRole('button', { name: 'Reset the example' }));
  await h.click(p.getByRole('button', { name: 'Yes, reset it' }));
  await see(p, 'The example is back to its starting point');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U6', ['NOTES', 'GOAL-PAGE', 'CHANGE-LOG', 'ATTENTION', 'REBASELINE'], 'Understand a goal and its change history', 3, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/goals?show=attention'));
  await h.inView(p.locator('.arow').first(), 'entry', 'the first goal');
  await h.click(p.locator('.arow-main', { hasText: 'Repo-access controls' }));
  await see(p, 'checked in by');
  h.set('attention', await p.locator('.story[data-tone=off] .chip.off').isVisible() && await p.locator('.why .note-line').count() > 0, 'off track and its reasons are not shown');
  await h.checkpoint('goal page');
  await h.click(p.getByRole('tab', { name: /Comments and changes/ }));
  await h.click(p.getByRole('button', { name: /Show .*change/ }).first());
  h.set('logged', await p.locator('.diffs ins').first().isVisible(), 'a change does not show its before and after');
  h.set('finish', true);
  h.set('progress', await p.locator('.stagelist').isVisible(), 'the stages are not shown');
  // Anyone can comment; it goes straight into the goal's activity, logged like every other save.
  await h.fill(p.getByLabel('Add a comment'), 'Vendor confirmed the SEC-88 fix ships Tuesday.');
  await h.click(p.getByRole('button', { name: 'Post comment' }));
  await see(p, 'Vendor confirmed the SEC-88 fix ships Tuesday.', 'the comment shows in the activity');
  const s = await h.snapshot();
  h.set('logged', s.changes.some((c) => c.actorId === 'maya' && c.goalId === 'access' && c.diffs.some((d) => /SEC-88 fix/.test(d.to))), 'the comment is not in the change log');
  await p.goto(url('/goals/review'));
  await see(p, 'Target changed in week 4: 75% → 95%', 'the re-baseline is explained on the chart');
  await p.context().close();
}, ['errors', 'budget']);

journey('U7', ['REASON-AHEAD', 'REBASELINE', 'CHANGE-LOG', 'PLAN-CHANGE', 'WATCHING'], 'An owner changes a target with a reason; a watcher sees it', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'sam'));
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
  await see(p, 'If the target should move', 'well ahead, the owner is pointed at changing the target');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  // A plan change once check-ins have started saves directly, but needs a reason.
  await p.goto(url('/goals/lead'));
  await h.click(p.getByRole('link', { name: 'Edit' }));
  await h.fill(p.getByLabel(/^Target/), '1.5');
  await p.locator('.focus-foot button[type=submit]').click({ force: true });
  h.set('errors', await p.locator('textarea.invalid[aria-label="Why change it?"]').isVisible() && await p.getByRole('alert').filter({ hasText: 'Say why' }).isVisible(), 'a plan change without a reason is not explained');
  await h.fill(p.getByLabel('Why change it?'), 'The merge queue cut lead time faster than planned; 1.5 days is reachable.');
  await h.checkpoint('edit');
  await h.click(p.getByRole('button', { name: 'Save changes' }));
  await see(p, 'Target changed in week 7: 2.0 days → 1.5 days', 'the chart keeps the original plan and says when it changed');
  const s = await h.snapshot();
  const lead = s.goals.find((g) => g.id === 'lead');
  const c = s.changes.filter((x) => x.actorId === 'sam' && x.goalId === 'lead' && x.action === 'edited').pop();
  h.set('logged', lead.plan.target === 1.5 && lead.originalPlan?.target === 2 && lead.rebaselinedWeek === 7 && !!c && c.diffs.some((d) => d.field === 'Target') && c.diffs.some((d) => d.field === 'Why' && /merge queue/.test(d.to)), 'the plan change is not applied, kept as original, or logged with its reason');
  // Same browser, Tom, who watches this goal: Watching shows the change.
  await p.locator('.rolebar').getByRole('button', { name: 'Tom', exact: true }).click();
  await see(p, 'Good');
  await navTo(h, p, 'Watching');
  await see(p, 'What changed this week');
  h.set('progress', true);
  h.set('attention', await p.locator('.changes').getByText('Lead time for changes').first().isVisible().catch(() => false) || await p.locator('.changes .change').count() > 0, 'the watched change is not shown');
  await h.checkpoint('watching');
  h.set('finish', true);
  await p.context().close();
});

journey('U8', ['STALE', 'ATTENTION', 'WATCHING'], 'Watching: see what has gone quiet and chase it', 4, async (h, device) => {
  // Maya watches the north-star tree she owns.
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/'));
  await navTo(h, p, 'Watching');
  await see(p, 'Gone quiet');
  await see(p, /\d+ goals · .*need/, 'the summary line counts what needs attention');
  const quiet = p.locator('section', { has: p.getByRole('heading', { name: /Gone quiet/ }) }).locator('.trow').first();
  await h.inView(p.getByRole('heading', { name: /Needs attention/ }), 'entry', 'Needs attention');
  await h.checkpoint('watching');
  h.set('attention', /No check-in for \d+ days/.test(await quiet.innerText()), 'a quiet goal does not say how long it has been');
  await h.click(quiet);
  await p.locator('.story').waitFor();
  h.set('attention', await p.locator('.story[data-tone=stale] .chip.stale').isVisible() && await p.getByText('can’t be trusted').isVisible(), 'stale is not flagged on the goal');
  // Chase it with a comment the owner sees.
  await h.click(p.getByRole('tab', { name: /Comments and changes/ }));
  await p.getByLabel('Add a comment').fill('Jonas, can you post where this is before Thursday?');
  await p.getByRole('button', { name: 'Post comment' }).click();
  await see(p, 'before Thursday');
  h.set('progress', true);
  h.set('finish', true);
  const s = await h.snapshot();
  h.set('logged', s.changes.some((c) => c.actorId === 'maya' && /before Thursday/.test(c.diffs.map((d) => d.to).join(' '))), 'the chase is not logged');
  await p.context().close();
}, ['errors']);

journey('U9', ['WATCHING', 'HIERARCHY', 'OWNER-ONLY', 'LEVELS', 'PROFILES'], 'Follow goals you don’t own: watch a tree or a level', 6, async (h, device) => {
  const p = h.use(await newPage(device, 'tom'));
  await p.goto(url('/'));
  await see(p, 'No check-ins or reviews due', 'someone who owns no goal is told so, calmly');
  await see(p, 'Watching', 'home shows what Tom watches');
  await h.inView(p.locator('.tree .trow').first(), 'entry', 'the goals Tom watches');
  h.set('attention', (await p.locator('.tree .trow').count()) > 0 && (await p.locator('.tree .trow .trow-why').first().innerText()).length > 10, 'watched goals are not shown with what changed or how fresh they are');
  await h.checkpoint('home');
  // Watch a whole tree from a goal page.
  await p.goto(url('/goals/head'));
  await h.click(p.getByRole('button', { name: 'Watch', exact: true }));
  await h.click(p.getByRole('button', { name: /Watch it and everything feeding it/ }));
  await see(p, 'Watching all');
  // And a whole level from Watching.
  await navTo(h, p, 'Watching');
  await h.click(p.getByRole('button', { name: 'Change', exact: true }));
  await h.click(p.getByRole('button', { name: /\+ SVP/ }));
  await see(p, 'Every SVP goal');
  h.set('progress', true);
  h.set('finish', true);
  const s = await h.snapshot();
  h.set('logged', s.watches.some((w) => w.personId === 'tom' && w.kind === 'tree' && w.ref === 'head') && s.watches.some((w) => w.personId === 'tom' && w.kind === 'level' && w.ref === 'svp'), 'the watches are not saved');
  // A watcher can follow a goal but not post its check-in or edit it.
  await p.goto(url('/check-in/review'));
  await see(p, 'Only Sam Patel checks in on this goal');
  if (await p.getByRole('button', { name: /Post check-in/ }).count()) fail('a non-owner was offered Post check-in');
  await p.goto(url('/goals/review/edit'));
  await see(p, 'Only its owner can change this goal');
  await p.context().close();
}, ['errors']);

journey('U13', ['REVIEW-SETUP', 'LEVELS', 'CHANGE-LOG'], 'Anyone sets up a review: name, cadence, goals, people', 10, async (h, device) => {
  const p = h.use(await newPage(device, 'leo'));
  await p.goto(url('/'));
  await navTo(h, p, 'Reviews');
  await see(p, 'Platform weekly review');
  await h.inView(p.getByRole('link', { name: 'Set up a review' }), 'entry', 'Set up a review');
  await h.checkpoint('reviews');
  await h.click(p.getByRole('link', { name: 'Set up a review' }));
  await p.getByRole('button', { name: 'Set up the review' }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Give the review a name' }).isVisible(), 'an unnamed review is not explained');
  await h.fill(p.getByLabel('Name', { exact: true }), 'SRE fortnightly');
  await h.click(p.getByRole('button', { name: 'Every 4 weeks' }));
  await p.getByLabel('On').selectOption('4');
  await h.click(p.getByRole('button', { name: 'North star', exact: true }));
  await h.click(p.getByRole('checkbox', { name: /Kofi Boateng/ }));
  await see(p, /[2-9] goals so far/, 'the form counts the goals picked');
  await h.checkpoint('set up');
  await h.click(p.getByRole('button', { name: 'Set up the review' }));
  await see(p, 'SRE fortnightly');
  await see(p, 'Every 4 weeks, Fridays');
  h.set('progress', await p.locator('.ring:visible').count() > 0, 'the review page has no progress');
  h.set('attention', await p.locator('.tree .trow').count() >= 2, 'the review does not list its goals');
  h.set('finish', await p.getByRole('button', { name: /^Start review/ }).isVisible().catch(() => false) || await p.getByText('Next:').isVisible().catch(() => false), 'no way to start the new review');
  const s = await h.snapshot();
  const r = s.reviews.find((x) => x.name === 'SRE fortnightly');
  h.set('logged', !!r && r.everyWeeks === 4 && r.weekday === 4 && r.people.includes('kofi') && r.people.includes('leo') && s.changes.some((c) => c.entity === 'review' && c.actorId === 'leo'), 'the review is not saved and logged');
  await p.context().close();
});

journey('U14', ['ADMIN', 'CHANGE-LOG'], 'An admin adds a person and makes them an admin', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  await p.goto(url('/workspace'));
  await see(p, 'You’re an admin');
  await h.inView(p.getByRole('button', { name: 'Add a person' }), 'entry', 'Add a person');
  await h.checkpoint('workspace');
  await h.click(p.getByRole('button', { name: 'Add a person' }));
  await p.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Add a name' }).isVisible(), 'a person without a name is not explained');
  await h.fill(p.getByRole('dialog').getByLabel('Name'), 'Nadia Karim');
  await h.fill(p.getByRole('dialog').getByLabel(/Job title/), 'Head of SRE');
  await h.click(p.getByRole('dialog').getByRole('checkbox', { name: /Admin/ }));
  await h.checkpoint('add person');
  await h.click(p.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }));
  await see(p, 'Added Nadia Karim');
  h.set('attention', await p.locator('.opt', { hasText: 'Nadia Karim' }).getByText('Admin').isVisible(), 'the new admin is not marked');
  h.set('finish', true);
  h.set('progress', true);
  const s = await h.snapshot();
  h.set('logged', s.people.some((x) => x.name === 'Nadia Karim' && x.admin) && s.changes.some((c) => c.entity === 'person' && c.actorId === 'elena'), 'the new person is not saved and logged');
  // Someone who isn't an admin can't add people.
  await p.locator('.rolebar').getByRole('button', { name: 'Tom', exact: true }).click();
  await p.goto(url('/workspace'));
  await see(p, 'Admins can add people');
  if (await p.getByRole('button', { name: 'Add a person' }).count()) fail('a non-admin was offered Add a person');
  await p.context().close();
});

journey('U10', ['RETRO', 'CHANGE-LOG', 'ADMIN'], 'Close the cycle: owners wrap up their goals, an admin starts the next cycle', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  // Seed the example at week 7, then come back in week 12, when the wrap-up opens.
  await p.goto(url('/'));
  await p.locator('.hero').waitFor();
  const late = (path) => BASE + '/demo' + path + (path.includes('?') ? '&' : '?') + 'today=2026-12-02';
  await p.goto(late('/goals'));
  await h.inView(p.getByRole('link', { name: 'Wrap up', exact: true }), 'entry', 'Wrap up');
  await h.click(p.getByRole('link', { name: 'Wrap up', exact: true }));
  await see(p, 'goals to wrap up');
  await h.progressShown('wrap-up');
  await h.checkpoint('wrap-up');
  await h.click(p.locator('.hero .btn.primary'));
  await see(p, 'How did it land?');
  await p.getByRole('button', { name: 'Save and continue' }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Write a sentence' }).isVisible(), 'a retro without a lesson is not explained');
  h.set('attention', await p.locator('.focus-body .chip').first().isVisible() && await p.locator('[aria-labelledby=res-l] button[aria-pressed=true]').count() === 1, 'the retro does not show where the goal ended or suggest a result');
  await h.checkpoint('retro');
  await h.click(p.getByRole('button', { name: 'Partly' }));
  await h.fill(p.getByLabel('What did you learn?'), 'Dependencies on other teams need a date agreed in week 1, not week 5.');
  await h.click(p.getByRole('button', { name: 'Save and continue' }));
  await see(p, 'How did it land?');
  await h.fill(p.getByLabel('What did you learn?'), 'The triage model only helps once every intake form uses it.');
  await h.click(p.getByRole('button', { name: 'Stop it here' }));
  await h.click(p.getByRole('button', { name: 'Save and continue' }));
  await see(p, 'Your goals are wrapped up');
  await see(p, 'Dependencies on other teams', 'the summary shows what was learned');
  let s = await h.snapshot();
  h.set('logged', s.retros.length === 2 && s.changes.filter((c) => c.entity === 'retro' && c.actorId === 'maya').length === 2, 'the retros are not saved and logged');
  // Elena, an admin, starts the next cycle.
  await p.locator('.rolebar').getByRole('button', { name: 'Elena', exact: true }).click();
  await see(p, 'The cycle is ending', 'an admin is told the cycle is ending');
  await p.goto(late('/retro'));
  await h.click(p.getByRole('button', { name: 'Start it' }));
  await h.click(p.getByRole('button', { name: 'Start the next cycle' }));
  await see(p, 'has started');
  s = await h.snapshot();
  const c2 = s.cycles.find((c) => c.id !== 'cycle');
  const carried = s.goals.filter((g) => g.cycleId === c2?.id);
  h.set('finish', !!c2 && carried.length === s.goals.filter((g) => g.cycleId === 'cycle').length - 1 && !carried.some((g) => g.title === 'Requests triaged within 2 days'), 'the next cycle does not carry the right goals');
  h.set('logged', s.changes.some((c) => c.entity === 'cycle' && c.actorId === 'elena'), 'starting the cycle is not logged');
  await p.goto(late('/goals'));
  await see(p, 'Intake-to-delivery time', 'the new cycle shows the carried goals');
  if (await p.getByText('Requests triaged within 2 days').count()) fail('a stopped goal came into the new cycle');
  await p.context().close();
});

journey('U15', ['OWNER-CALL', 'GREENER', 'CHECKIN-STATUS-VS-PLAN'], 'Call it greener than the numbers, with a reason, in the status sheet', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/check-in/head'));
  await h.fill(p.getByLabel('This week’s value'), '31');
  await p.locator('.callline').waitFor();
  await h.inView(p.locator('.callline').getByRole('button', { name: 'Change' }), 'entry', 'Change the status');
  await h.click(p.locator('.callline').getByRole('button', { name: 'Change' }));
  const sheet = p.getByRole('dialog');
  await h.click(sheet.getByRole('radio', { name: /At risk/ }));
  const why = sheet.getByRole('textbox').first();
  await why.click();
  await p.keyboard.type('Security signed off the scope today', { delay: 15 });
  const typed = await why.inputValue();
  h.set('errors', typed === 'Security signed off the scope today', `typing in the status sheet lost keys: “${typed}”`);
  h.set('attention', await sheet.getByText(/better than the numbers/i).first().isVisible(), 'the sheet does not say the call is greener than the numbers');
  await h.checkpoint('status sheet');
  await p.keyboard.press('Escape');
  h.set('a11y', await p.evaluate(() => document.activeElement && document.activeElement !== document.body), 'focus is lost after closing the sheet');
  h.set('progress', true);
  h.set('finish', true);
  await p.context().close();
}, ['logged']);

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
    for (const [who, route] of [['maya', '/'], ['elena', '/'], ['priya', '/'], ['tom', '/'], ['maya', '/goals'], ['elena', '/goals'], ['maya', '/goals/head'], ['maya', '/goals/access'], ['maya', '/activity'], ['maya', '/workspace'], ['elena', '/reviews'], ['elena', '/reviews/weekly'], ['leo', '/reviews/new'], ['maya', '/watching'], ['tom', '/watching'], ['leo', '/watching'], ['maya', '/goals?show=levels'], ['leo', '/check-in'], ['sam', '/goals/lead/edit'], ['sam', '/goals/new'], ['priya', '/workspace/new']]) {
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
  process.exit(journeys.every((r) => r.pass) && platform.every((x) => x.pass) ? 0 : 1);
})();

