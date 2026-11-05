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
/* The demo follows the calendar: on Friday 30 October 2026 it is in ISO week 44 of 2026, a 53-week year; its story
   weeks 1–7 are year weeks 38–44. */
const NOW = 44;
const WEEKS = 53;
const W = (storyWeek) => storyWeek + NOW - 7;
/** The plan's number for a week, as src/domain/plan.ts works it out. */
function planAt(plan, week, weeks = WEEKS) {
  const end = plan.endWeek ?? weeks;
  const from = Math.min(plan.fromWeek ?? 0, end - 1);
  if (week <= from) return plan.start;
  if (week >= end) return plan.target;
  if (plan.points?.length) {
    const pts = [{ week: from, value: plan.start }, ...plan.points.filter((p) => p.week > from && p.week < end).sort((a, b) => a.week - b.week), { week: end, value: plan.target }];
    const i = pts.findIndex((p) => p.week >= week);
    const a = pts[i - 1], b = pts[i];
    return a.value + (b.value - a.value) * ((week - a.week) / (b.week - a.week));
  }
  const n = end - from, w = Math.max(0, Math.min(n, week - from));
  const prog = plan.shape === 'back' ? Math.pow(w / n, 1.5) : plan.shape === 'stepped' ? ((w >= Math.floor(n / 3) + 1 ? 1 : 0) + (w >= Math.floor((2 * n) / 3) + 1 ? 1 : 0) + (w >= n ? 1 : 0)) / 3 : w / n;
  return plan.start + (plan.target - plan.start) * prog;
}
/** A value `ratio` of the way the plan expected by the week (1 = on plan), with the goal's decimals. */
const valueAt = (g, week, ratio = 1) => (g.plan.start + ratio * (planAt(g.plan, week) - g.plan.start)).toFixed(g.decimals);
let browser;

function fail(msg) { throw new Error(msg); }
/** Waits until some visible element shows the text (a hidden duplicate, like a phone-only label on a desktop, doesn't count). */
async function see(p, text, msg, timeout = 5000) {
  // p is a page, or a locator to look inside.
  const all = p.getByText(text, { exact: false });
  const page = typeof p.page === 'function' ? p.page() : p;
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const n = await all.count();
    for (let i = 0; i < n; i++) if (await all.nth(i).isVisible().catch(() => false)) return;
    await page.waitForTimeout(100);
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
      const first = loc.first();
      const box = await first.boundingBox().catch(() => null);
      // The fold is the top of the phone's tab bar, not the bottom of the screen: anything under the bar can't be seen.
      // (Unless the thing is in the tab bar itself.)
      const vh = box ? await first.evaluate((el) => {
        const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
        return bar && !bar.contains(el) ? bar.getBoundingClientRect().top : window.innerHeight + 24;
      }) : DEVICES[device].height;
      // A margin, so a few pixels of font difference between machines can't flip the result.
      set(k, !!box && box.y >= 0 && box.y + box.height <= vh - 24, `${label} is ${box ? 'below the fold' : 'missing'}`);
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

/** The demo's controls: the quiet Demo button (sidebar on desktop, header on a phone) opens the panel. */
const demoPanel = async (p, h) => {
  const entry = p.locator('.demo-entry:visible').first();
  if (h) await h.click(entry); else await entry.click();
  return p.getByRole('dialog', { name: 'Demo' });
};
/** Switch who you are in the demo, by first name, through the demo panel (people are listed by role first). */
const viewAs = async (p, first, h) => {
  const panel = await demoPanel(p, h);
  const pick = panel.getByRole('button', { name: new RegExp('\\b' + first + '\\b') }).first();
  if (!(await pick.isVisible().catch(() => false))) await panel.getByRole('button', { name: /Everyone else/ }).click();
  if (h) await h.click(pick); else await pick.click();
};

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
  const s0 = await h.snapshot();
  const g0 = (id) => s0.goals.find((g) => g.id === id);
  const reviewV = String(Math.round(planAt(g0('review').plan, NOW)) + 2);
  await h.fill(p.getByLabel('This week’s value'), reviewV);
  await see(p, `above week-${NOW} plan`, 'the verdict names the week it compares with');
  await h.checkpoint('first goal');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  await h.checkpoint('posted');
  await h.click(p.getByRole('button', { name: /Next: / }));
  // Leave mid-way and come back: the typed value is restored.
  const leadV = valueAt(g0('lead'), NOW, 1.05);
  await p.getByLabel('This week’s value').fill(leadV);
  await p.goto(url('/'));
  await see(p, 'Pick up where you left off', 'a draft is offered back on home');
  await p.getByRole('link', { name: /Pick up where you left off/ }).click();
  const restored = await p.getByLabel('This week’s value').inputValue();
  if (restored !== leadV) fail('the draft value was not restored');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  // The last post is the only confirmation: what was saved, that the week is done, and a way on.
  await see(p, `checked in for week ${NOW}`, 'the last post says the week is done');
  h.set('finish', await p.getByRole('link', { name: 'Back to home' }).isVisible() && await p.getByRole('link', { name: 'View the goal' }).isVisible(), 'no way on from the confirmation');
  await h.checkpoint('done');
  let s = await h.snapshot();
  const posts = s.changes.filter((c) => c.actorId === 'sam' && c.action === 'posted' && new RegExp(`week ${NOW}:`).test(c.summary));
  h.set('logged', posts.length === 2 && posts.every((c) => c.diffs.some((d) => d.field === 'Value')), `expected two logged week-${NOW} posts by Sam, saw ${posts.length}`);
  await p.goto(url('/'));
  await p.reload();
  await see(p, /All \d+ check-ins posted for week|Your check-in is posted for week/, 'posted check-ins survive a reload, and home moves on to the review Sam is in');
  // An ad hoc check-in, any time, from the goal page: kept alongside the first, and the latest is the week's status.
  await p.goto(url('/goals/review'));
  await h.click(p.getByRole('link', { name: 'Check in now' }));
  await see(p, `You checked in for week ${NOW} already`, 'a second check-in says it is kept alongside the first');
  const reviewV2 = String(Number(reviewV) - 1);
  await h.fill(p.getByLabel('This week’s value'), reviewV2);
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Kept alongside your earlier check-in this week');
  s = await h.snapshot();
  const again = s.changes.filter((c) => c.actorId === 'sam' && c.goalId === 'review' && c.action === 'posted').pop();
  const weekCis = s.checkIns.filter((c) => c.goalId === 'review' && c.week === NOW);
  h.set('logged', !!again && new RegExp(`Checked in again for week ${NOW}`).test(again.summary) && weekCis.length === 2 && weekCis.some((c) => c.value === Number(reviewV)) && weekCis.some((c) => c.value === Number(reviewV2)), 'the ad hoc check-in is not kept alongside the first, or not logged');
  await p.context().close();

  // Maya: behind plan. One question per screen: the number, then last week's note offered back.
  // "Still true" carries it over and posts; an empty number is explained in place.
  p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/check-in'));
  await p.locator('.focus-foot button[type=submit]').click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Type this week’s number' }).isVisible(), 'an empty number says nothing');
  const sm = await h.snapshot();
  await h.fill(p.getByLabel('This week’s value'), valueAt(sm.goals.find((g) => g.id === 'head'), NOW, 0.5));
  h.set('attention', await p.locator('.verdict[data-tone=off]').isVisible(), 'behind plan is not flagged in the verdict');
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await see(p, 'Is last week’s note still true?', 'last week’s reason and path are offered back');
  await h.progressShown('carry');
  await h.checkpoint('carry');
  // What "Still true" will carry, the open request included, is shown before posting (product review, 3 Nov).
  h.set('attention', await p.getByText('Still asking:').isVisible(), 'the request that Still true carries forward is not shown');
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
  // Lane's notes (5 Nov): Home shows "Your goals" (what needs attention, what's being handled) and "Goals you watch".
  await see(p, 'Your goals');
  await see(p, 'Need attention');
  await see(p, 'Watching', 'home also shows the goals Maya watches');
  await h.checkpoint('home');
  h.set('progress', await p.locator('.hero .ring').isVisible(), 'no weekly progress ring');
  const cards = p.locator('.arow');
  if ((await cards.count()) < 1) fail('expected an attention card for Maya’s own goals');
  const reasons = await cards.locator('.arow-why').allInnerTexts();
  h.set('attention', reasons.every((r) => r.trim().length > 20) && await p.locator('.arow[data-tone=risk] .arow-icon, .arow[data-tone=off] .arow-icon').count() > 0, 'attention rows lack a reason or a status icon');
  await h.inView(cards.first(), 'entry', 'the first attention card');
  await see(p, 'late', 'an overdue check-in is called late');
  // The north star is being handled (Elena noted it in last week's review), so the first card is a goal already
  // checked in; the week's check-in is the hero's one action.
  await h.click(p.locator('.home-hero').getByRole('link', { name: /Start check-in|Pick up where you left off/ }));
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
  await see(p, 'goals to discuss');
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
  // The walk is the exceptions; goals on track with nothing flagged are acknowledged together (Senior UX review, 2 Nov).
  await see(p, 'On track, nothing new', 'healthy goals are not grouped after the exceptions');
  const ack = p.getByRole('button', { name: /^Mark \d+ goals? on track reviewed/ });
  const healthyN = Number(((await ack.innerText().catch(() => '')).match(/\d+/) || ['0'])[0]);
  h.set('finish', healthyN > 0 && items + healthyN <= 14, `expected the healthy goals as one acknowledgement, saw ${healthyN} after walking ${items}`);
  await h.checkpoint('healthy group');
  await h.click(ack);
  await see(p, 'Review complete', 'the review ends on its record');
  await see(p, 'Can the golden path ship', 'what was said is kept in the summary');
  h.set('finish', await p.getByRole('link', { name: 'Reviews' }).first().isVisible(), 'no way on from the review record');
  const s = await h.snapshot();
  const calls = s.changes.filter((c) => c.actorId === 'elena' && c.entity === 'decision' && c.id !== 'chg_dec_weekly_6');
  const ask = calls.find((c) => c.action === 'asked');
  h.set('logged', calls.length === items + healthyN + 2 && !!ask && ask.diffs.some((d) => /golden path/.test(d.to)), `expected ${items + healthyN} reviews plus a question and a note, logged, saw ${calls.length}`);
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
  await h.fill(p.getByLabel(new RegExp(`Target \\(week ${WEEKS}\\)`)), '45');
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
  // Switching workspace is in the person menu (review notes, 5 Nov), shown when there's more than one.
  await p.locator('.me:visible, .profilebtn:visible').first().click();
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
  if (await p.locator('.demo-entry').count()) fail('the real app shows the demo controls');
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
  h.set('attention', await p.locator('.demo-entry:visible').count() > 0, 'the demo is not marked as the demo');
  await h.checkpoint('demo home');
  await h.inView(p.locator('.demo-entry:visible').first(), 'entry', 'the demo controls');
  const panel = await demoPanel(p, h);
  // People are offered by what they do, with the name second.
  h.set('attention', await panel.getByRole('button', { name: /^Leader/ }).first().isVisible() && await panel.getByRole('button', { name: /^Goal owner/ }).first().isVisible(), 'the demo panel does not lead with roles');
  await h.click(panel.getByRole('button', { name: /Elena/ }).first());
  await see(p, 'Good', 'Elena’s home opens');
  await see(p, 'goals to discuss', 'Elena’s home leads with her review');
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
  await see(p, 'check-in · '); // "Week 43 check-in · Aisha Rahman · 9 days ago" (N2)
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
  await see(p, `Target changed in week ${W(5)}: 75% → 95%`, 'the re-baseline is explained on the chart');
  await p.context().close();
}, ['errors', 'budget']);

journey('U7', ['REASON-AHEAD', 'REBASELINE', 'CHANGE-LOG', 'PLAN-CHANGE', 'WATCHING'], 'An owner changes a target with a reason; a watcher sees it', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'sam'));
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await h.click(p.getByRole('link', { name: /Start check-in/ }));
  const s7 = await h.snapshot();
  // Well ahead, but still a possible coverage (under 100%).
  await h.fill(p.getByLabel('This week’s value'), valueAt(s7.goals.find((g) => g.id === 'review'), NOW, 1.25));
  await h.click(p.getByRole('button', { name: 'Continue' }));
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
  await see(p, `Target changed in week ${NOW}: 2.0 days → 1.5 days`, 'the chart keeps the original plan and says when it changed');
  const s = await h.snapshot();
  const lead = s.goals.find((g) => g.id === 'lead');
  const c = s.changes.filter((x) => x.actorId === 'sam' && x.goalId === 'lead' && x.action === 'edited').pop();
  h.set('logged', lead.plan.target === 1.5 && lead.originalPlan?.target === 2 && lead.rebaselinedWeek === NOW && !!c && c.diffs.some((d) => d.field === 'Target') && c.diffs.some((d) => d.field === 'Why' && /merge queue/.test(d.to)), 'the plan change is not applied, kept as original, or logged with its reason');
  // Same browser, Tom, who watches this goal: Watching shows the change.
  await viewAs(p, 'Tom');
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
  await see(p, 'No recent update');
  await see(p, /\d+ goals · .*need/, 'the summary line counts what needs attention');
  const quiet = p.locator('section', { has: p.getByRole('heading', { name: /No recent update/ }) }).locator('.trow').first();
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
  await h.click(p.getByRole('button', { name: /^Watch SVP/ }));
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
  // Exceptions are listed; goals on track with nothing flagged are one named group with a count.
  const healthyN = Number(((await p.locator('.healthy-group .block-title').innerText().catch(() => '')).match(/(\d+)\s*$/) || ['', '0'])[1]);
  h.set('attention', (await p.locator('.tree .trow').count()) + healthyN >= 2, 'the review does not list its goals');
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
  await viewAs(p, 'Tom');
  await p.goto(url('/workspace'));
  await see(p, 'Admins can add people');
  if (await p.getByRole('button', { name: 'Add a person' }).count()) fail('a non-admin was offered Add a person');
  await p.context().close();
});

journey('U10', ['RETRO', 'CHANGE-LOG', 'ADMIN'], 'Close the cycle: owners wrap up their goals, an admin starts the next cycle', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  // Seed the example in week 44, then come back in week 52, when the wrap-up opens.
  await p.goto(url('/'));
  await p.locator('.hero').waitFor();
  const late = (path) => BASE + '/demo' + path + (path.includes('?') ? '&' : '?') + 'today=2026-12-22';
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
  await viewAs(p, 'Elena');
  await see(p, 'The year is ending', 'an admin is told the year is ending');
  await p.goto(late('/retro'));
  await h.click(p.getByRole('button', { name: 'Start it' }));
  await h.click(p.getByRole('button', { name: 'Start next year' }));
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

journey('U16', ['ATTENTION', 'WATCHING'], 'Home by responsibility, and the 4-tab navigation trial', 4, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  await p.goto(url('/'));
  // Needs your response: a decision Aisha named Elena for, with why, what and a specific action.
  await see(p, 'Needs your response');
  const card = p.locator('.need-group', { hasText: 'Decisions or help needed' }).locator('.need').first();
  await h.inView(card, 'entry', 'the decision that needs Elena');
  h.set('attention', await card.getByText(/approve an interim/i).isVisible() && await card.getByRole('button', { name: 'Respond' }).isVisible(), 'the request does not say what is needed or offer a specific action');
  await see(p, 'Goals you watch');
  await h.checkpoint('home');
  // Respond opens the request itself, ready to answer (product review, 3 Nov).
  await h.click(card.getByRole('button', { name: 'Respond' }));
  const respond = p.getByRole('dialog', { name: 'Respond to the request' });
  await see(respond, 'Your answer or decision', 'Respond does not open the request to answer');
  await p.keyboard.press('Escape');
  // The 4-tab trial: Home, Goals, Reviews, More; Watching lives in Goals.
  await p.goto(url('/'));
  { const panel = await demoPanel(p, h); await h.click(panel.getByRole('button', { name: /Try 4 tabs/ })); await p.keyboard.press('Escape'); }
  if (device === 'phone') {
    const labels = await p.locator('.tabbar').getByRole('link').allInnerTexts();
    h.set('progress', labels.map((x) => x.replace(/\d+/g, '').trim()).join(',') === 'Home,Goals,Reviews', `phone tabs are ${labels.join(', ')}`);
  } else h.set('progress', true);
  await p.goto(url('/goals?show=watching'));
  await see(p, 'Needs attention', 'Watching shows inside Goals in the 4-tab trial');
  await p.evaluate(() => localStorage.removeItem('goals-app-nav'));
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U17', ['DEMO-MODE', 'WORKSPACES'], 'Demo data sets, presenting without the bar, and deleting a workspace', 12, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/workspace'));
  // Four example workspaces to choose from.
  for (const name of ['Developer Platform', 'Customer Support', 'B2B Sales', 'Product Growth']) await see(p, 'Example: ' + name);
  await h.inView(p.getByRole('button', { name: /Example: Customer Support/ }), 'entry', 'the Customer Support example');
  await h.checkpoint('workspaces');
  await h.click(p.getByRole('button', { name: /Example: Customer Support/ }));
  await p.goto(url('/goals'));
  await see(p, 'Customer satisfaction (CSAT)', 'the Customer Support example has its own goals');
  h.set('attention', await p.locator('.outcome-card').count() >= 1, 'the example has no trees');
  // Presenting: the demo without the "Viewing as" bar.
  await p.goto(url('/?present'));
  await p.locator('.page-head').first().waitFor();
  h.set('progress', (await p.locator('.demo-entry').count()) === 0, 'the demo controls still show when presenting');
  await p.goto(url('/?present=0'));
  await p.locator('.demo-entry:visible').first().waitFor();
  // Set up a workspace, then delete it: typing its name is required.
  await p.evaluate(() => {
    const ws = { id: 'ws_temp', name: 'Temp team', kind: 'own', createdAt: '2026-10-01T00:00:00Z' };
    localStorage.setItem('goals-app-v2:workspaces', JSON.stringify([ws]));
    const ex = JSON.parse(localStorage.getItem('goals-app-v2:example'));
    localStorage.setItem('goals-app-v2:ws_temp', JSON.stringify({ ...ex, people: ex.people.map((x) => ({ ...x, admin: x.id === 'maya' ? true : x.admin })) }));
    localStorage.setItem('goals-app-workspace', 'ws_temp');
  });
  await p.goto(url('/workspace'));
  await h.click(p.getByRole('button', { name: /Delete Temp team/ }));
  h.set('errors', await p.getByRole('button', { name: 'Delete it for good' }).isDisabled(), 'deleting does not ask for the name first');
  await h.fill(p.getByLabel('Type Temp team to confirm'), 'Temp team');
  await h.checkpoint('delete');
  await h.click(p.getByRole('button', { name: 'Delete it for good' }));
  await see(p, 'Deleted Temp team');
  const left = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-app-v2:workspaces') || '[]').length);
  h.set('finish', left === 0 && !(await p.evaluate(() => localStorage.getItem('goals-app-v2:ws_temp'))), 'the workspace was not removed');
  await p.context().close();
}, ['logged']);

journey('U18', ['PLAN-SHAPE', 'GOAL-CREATE', 'YEAR'], 'Set a goal for the year and its plan numbers by hand', 12, async (h, device) => {
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/goals/new'));
  await h.fill(p.getByLabel(/Name it the way/), 'Runbooks with an owner');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  // With one possible date (the year end) it is said, not offered as a one-button choice (fit and finish F3, 8).
  const due = p.getByText(/^Year end · due week \d+/);
  await h.inView(due, 'entry', 'when the target is due');
  h.set('attention', await due.isVisible(), 'a new goal is not due at the year end by default');
  await h.fill(p.getByLabel('Unit'), '%');
  await h.fill(p.getByLabel(/^Today \(week/), '20');
  await h.fill(p.getByLabel(/^Target \(week/), '90');
  // The plan is a table of numbers, with the shape's defaults; type over one.
  const row = p.getByLabel(/^Plan for week \d+/).first();
  await row.waitFor();
  h.set('attention', (await p.getByLabel(/^Plan for week \d+/).count()) >= 3 && /\d/.test(await row.inputValue()), 'the plan table has no default numbers');
  await h.fill(row, '30');
  await h.checkpoint('plan table');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'with plan numbers set by hand', 'the summary says the plan was set by hand');
  await h.click(p.getByRole('button', { name: 'Publish goal' }));
  await p.waitForURL(/\/goals\/goal_/);
  await h.click(p.getByRole('tab', { name: 'Details' }));
  await see(p, 'Plan and actual by week');
  const s = await h.snapshot();
  const g = s.goals.find((x) => x.title === 'Runbooks with an owner');
  h.set('logged', !!g && (g.plan.endWeek ?? WEEKS) === WEEKS && g.plan.points?.some((pt) => pt.value === 30), 'the year end or the hand-set number was not saved');
  h.set('progress', true);
  h.set('finish', true);
  await p.context().close();
}, ['errors']);

journey('U19', ['VIEWS', 'EXPORT', 'STORY'], 'See the same goals as a table, board, history grid or cards, and export them', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/goals'));
  const layout = p.getByRole('group', { name: 'Layout' });
  await h.inView(layout, 'entry', 'the layout switch');
  // Table: sorting by status puts the off-track goal first.
  await h.click(layout.getByRole('button', { name: 'Table' }));
  await p.locator('.gtable').first().waitFor();
  await h.checkpoint('table');
  await h.click(p.locator('.gtable').first().getByRole('button', { name: 'Status' }));
  const first = await p.locator('.gtable').first().locator('tbody tr').first().getAttribute('data-tone');
  h.set('attention', first === 'off', `sorting by status put “${first}” first`);
  // Board: a column per status.
  await h.click(layout.getByRole('button', { name: 'Board' }));
  await p.locator('.board').waitFor();
  for (const col of ['Off track', 'At risk', 'No recent update', 'On track']) await see(p, col);
  await h.checkpoint('board');
  // History: a square per goal per week, the owner's call.
  await h.click(layout.getByRole('button', { name: 'History' }));
  // History opens on quarter results; the owners' weekly calls are one press away.
  await p.locator('.qtable').first().waitFor();
  await h.click(p.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Weekly status' }));
  await p.locator('.hgrid').first().waitFor();
  h.set('progress', (await p.locator('.hcell.tone-on, .hcell.tone-risk, .hcell.tone-off').count()) > 20, 'the history grid has too few check-ins');
  await h.checkpoint('history');
  await h.click(layout.getByRole('button', { name: 'Cards' }));
  await p.locator('.gcard').first().waitFor();
  await h.checkpoint('cards');
  // The choice is remembered, and the tabs still choose which goals and how they're grouped.
  await p.goto(url('/goals?show=teams'));
  await p.locator('.gcard').first().waitFor();
  h.set('parity', (await layout.getByRole('button', { name: 'Cards' }).getAttribute('aria-pressed')) === 'true', 'the layout was not remembered');
  // Export: a workbook, and JSON another tool can read.
  await h.click(p.getByRole('button', { name: 'Export' }));
  await h.checkpoint('export');
  const [xlsx] = await Promise.all([p.waitForEvent('download'), h.click(p.getByRole('button', { name: /Excel workbook/ }))]);
  const [json] = await Promise.all([p.waitForEvent('download'), h.click(p.getByRole('button', { name: 'Save .json' }))]);
  const data = JSON.parse(fs.readFileSync(await json.path(), 'utf8'));
  const [md] = await Promise.all([p.waitForEvent('download'), h.click(p.getByRole('button', { name: 'Save .md' }))]);
  const brief = fs.readFileSync(await md.path(), 'utf8');
  const s = await h.snapshot();
  h.set('finish', /\.xlsx$/.test(xlsx.suggestedFilename()) && fs.statSync(await xlsx.path()).size > 4000, 'the workbook was not saved');
  h.set('logged', data.format === 'goals-app.export' && data.goals.length === s.goals.length && data.goals.some((g) => g.checkIns.length) && brief.includes('## How to read the status') && brief.includes('**Recovery plan:**'), 'the JSON or brief is incomplete');
  await p.context().close();
}, ['errors']);

journey('U20', ['BULK-IMPORT'], 'Load a spreadsheet: a new goal, then its past weeks, with every change shown before saving', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/goals'));
  await h.inView(p.getByRole('link', { name: 'Import' }), 'entry', 'Import on the Goals screen');
  await h.click(p.getByRole('link', { name: 'Import' }));
  await see(p, 'Load changes from a spreadsheet');
  await h.checkpoint('import');
  const csv = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
  const input = p.getByLabel('Choose a spreadsheet');
  // A new goal, linked by name.
  await input.setInputFiles(csv('goals.csv', 'Goal,Owner,Type,Unit,Start,Target,Feeds into\nRunbooks with an owner,Kofi Boateng,metric,%,20,90,Change failure rate\n'));
  await see(p, '1 new goal');
  await h.checkpoint('preview');
  await h.click(p.getByRole('button', { name: 'Save 1 change' }));
  await see(p, 'Saved: 1 new goal');
  // Its past weeks: a week in the future is refused, and nothing saves until it's fixed.
  await p.goto(url('/import'));
  await input.setInputFiles(csv('history.csv', `Goal,Week,Value\nRunbooks with an owner,${NOW - 3},20\nRunbooks with an owner,${NOW - 2},20\nRunbooks with an owner,${NOW + 2},20\n`));
  await see(p, 'hasn’t happened yet', 'a future week was not refused');
  h.set('errors', await p.getByRole('button', { name: /^Save/ }).isDisabled(), 'Save was allowed with a row that needs fixing');
  await h.click(p.getByRole('button', { name: 'Choose another file' }));
  await input.setInputFiles(csv('history.csv', `Goal,Week,Value\nRunbooks with an owner,${NOW - 3},20\nRunbooks with an owner,${NOW - 2},20\n`));
  await see(p, '2 check-ins (2 for past weeks)');
  h.set('attention', await p.getByText('Runbooks with an owner').first().isVisible(), 'the preview does not name the goal');
  await h.click(p.getByRole('button', { name: 'Save 2 changes' }));
  await p.waitForURL(/\/goals$/);
  const s = await h.snapshot();
  const g = s.goals.find((x) => x.title === 'Runbooks with an owner');
  const cis = s.checkIns.filter((c) => c.goalId === g?.id);
  h.set('finish', !!g && g.parentId === 'cfr' && cis.length === 2 && cis.every((c) => c.backfilled), 'the goal or its past weeks were not saved');
  h.set('logged', s.changes.some((c) => c.entity === 'workspace' && c.action === 'imported' && /Loaded a spreadsheet/.test(c.summary)) && s.changes.filter((c) => c.goalId === g?.id).every((c) => c.diffs.some((d) => d.field === 'Via' && d.to === 'Spreadsheet')), 'the import was not logged as coming from a spreadsheet');
  h.set('progress', true);
  await p.context().close();
});

journey('U21', ['BULK-EDIT'], 'Type the week’s numbers in one table, and change several goals at once', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /all your numbers in one table/ }), 'entry', 'the one-table check-in');
  await h.click(p.getByRole('link', { name: /all your numbers in one table/ }));
  const s21 = await h.snapshot();
  const g21 = (id) => s21.goals.find((g) => g.id === id);
  const alertsV = valueAt(g21('alerts'), NOW, 1.02), cacheV = valueAt(g21('cache'), NOW, 1.05);
  const alerts = p.getByLabel(/Alerts auto-triaged by AIOps: this week’s number/);
  await h.fill(alerts, valueAt(g21('alerts'), NOW, 0.4));
  // Behind plan: the row asks why, and won't post without it.
  await h.click(p.getByRole('button', { name: 'Post 1 check-in' }));
  await see(p, 'needs a reason or a path to green');
  h.set('errors', true);
  await h.fill(alerts, alertsV);
  await h.fill(p.getByLabel(/Build cache hit rate: this week’s number/), cacheV);
  await h.checkpoint('grid');
  h.set('progress', (await p.locator('.qstatus .chip').count()) === 2, 'each row does not show its status as you type');
  await h.click(p.getByRole('button', { name: 'Post 2 check-ins' }));
  await see(p, 'Saved: 2 check-ins, 1 replaced');
  // The table: select two goals and change their level together.
  await p.goto(url('/goals?view=table'));
  await h.click(p.getByLabel('Select Alerts auto-triaged by AIOps').first());
  await h.click(p.getByLabel('Select Build cache hit rate').first());
  await see(p, '2 selected');
  // On a phone the bulk actions share one Actions menu, so the bar stays one row (fit and finish, L&T 6).
  if (device === 'phone') await h.click(p.locator('.selbar-menu > summary'));
  await h.click(p.getByRole('button', { name: 'Change level' }));
  await p.getByRole('dialog').getByLabel('Level').selectOption('svp');
  await h.checkpoint('bulk level');
  await h.click(p.getByRole('dialog').getByRole('button', { name: 'Save' }));
  await see(p, 'Saved: 2 goals changed');
  const s = await h.snapshot();
  const posted = s.checkIns.filter((c) => c.week === NOW && ((c.goalId === 'alerts' && c.value === Number(alertsV)) || (c.goalId === 'cache' && c.value === Number(cacheV))));
  h.set('finish', posted.length === 2 && ['alerts', 'cache'].every((id) => s.goals.find((g) => g.id === id).level === 'svp'), 'the check-ins or the level change were not saved');
  h.set('attention', true);
  h.set('logged', s.changes.filter((c) => c.diffs.some((d) => d.field === 'Via' && d.to === 'Bulk edit')).length >= 4, 'bulk changes were not logged on each goal');
  await p.context().close();
});

journey('U22', ['MCP-TOKENS'], 'An admin gives a teammate a token for an AI assistant, then revokes it', 10, async (h, device) => {
  const p = h.use(await newPage(device));
  // A real-app workspace (kept in the browser for the evals), copied from the example, with Elena as the admin.
  await p.goto(url('/'));
  await p.locator('.page-head').first().waitFor();
  await p.evaluate(() => {
    const ex = JSON.parse(localStorage.getItem('goals-app-v2:example'));
    localStorage.setItem('goals-live-v1:workspaces', JSON.stringify([{ id: 'ws_live', name: 'Platform', kind: 'own', createdAt: '2026-09-01T00:00:00Z' }]));
    localStorage.setItem('goals-live-v1:ws_live', JSON.stringify(ex));
    localStorage.setItem('goals-live-workspace', 'ws_live');
    localStorage.setItem('goals-live-me:ws_live', 'elena');
  });
  await p.goto(live('/workspace'));
  // An admin setting, further down the Workspace page: 'entry' is judged on everyday journeys, not this one.
  await p.getByRole('heading', { name: 'AI assistants' }).scrollIntoViewIfNeeded();
  await h.click(p.getByRole('button', { name: 'Make a token' }));
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Who it acts as').selectOption({ label: 'Kofi Boateng' });
  h.set('errors', await dlg.getByRole('button', { name: 'Make the token' }).isDisabled(), 'a token can be made without saying what it is for');
  await h.fill(dlg.getByLabel('What it’s for'), 'Claude on Kofi’s laptop');
  await h.checkpoint('make token');
  await h.click(dlg.getByRole('button', { name: 'Make the token' }));
  await see(p, 'it isn’t shown again');
  const token = await dlg.getByLabel('Token').inputValue();
  h.set('attention', /^gk_[A-Za-z0-9]{40}$/.test(token) && (await dlg.getByLabel('Claude Code command').inputValue()).includes('/api/mcp'), 'the token or the connection command is missing');
  await h.checkpoint('token');
  await h.click(dlg.getByRole('button', { name: 'Done' }));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-live-v1:ws_live')).tokens);
  const hash = await p.evaluate(async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join(''), token);
  h.set('logged', stored.length === 1 && stored[0].tokenHash === hash && stored[0].personId === 'kofi' && !JSON.stringify(stored).includes(token), 'the token was stored in plain text, or not at all');
  await see(p, 'not used yet');
  await h.click(p.getByRole('button', { name: 'Revoke Claude on Kofi’s laptop' }));
  await see(p, 'Revoked');
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-live-v1:ws_live')).tokens);
  h.set('finish', !!after[0].revokedAt, 'the token was not revoked');
  h.set('progress', true);
  await p.context().close();
}, ['entry']);

journey('U23', ['YEAR'], 'See the year in quarters: where we are, each quarter met or missed, and the year’s history', 6, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  await p.goto(url('/goals'));
  await see(p, 'Week 44 of 53 · Q4 (Oct–Dec)', 'the Goals page says the week, the quarter and the year');
  await h.inView(p.getByText('Week 44 of 53 · Q4 (Oct–Dec)'), 'entry', 'the week, quarter and year');
  await p.goto(url('/goals/scan'));
  const strip = p.getByRole('region', { name: 'This year by quarter' });
  await strip.waitFor();
  const cells = await strip.locator('li').allInnerTexts();
  h.set('attention', cells.length === 4 && cells.slice(0, 3).every((t) => /Met/.test(t) && /against a plan of/.test(t)) && /Now/.test(cells[3]), `the quarters read: ${cells.join(' | ')}`);
  await h.checkpoint('quarters');
  // The weekly history grid shows this quarter by default, or the whole year.
  await p.goto(url('/goals?view=history&hist=weekly'));
  const grid = p.locator('.hgrid').first();
  await grid.waitFor();
  const quarterCols = await grid.locator('thead th').count();
  const yearBtn = p.getByRole('group', { name: 'Weeks shown' }).getByRole('button', { name: 'Whole year' });
  await h.click(yearBtn);
  // The range is in the link now, so the grid redraws from it.
  await p.waitForFunction(() => document.querySelectorAll('.hgrid thead th').length > 20, null, { timeout: 10000 }).catch(() => {});
  const yearCols = await p.locator('.hgrid').first().locator('thead th').count();
  const pressed = await yearBtn.getAttribute('aria-pressed').catch(() => '?');
  h.set('progress', quarterCols === WEEKS - 39 + 1 && yearCols === WEEKS + 1, `expected ${WEEKS - 39} then ${WEEKS} week columns, saw ${quarterCols - 1} then ${yearCols - 1} (Whole year pressed: ${pressed}; link ${new URL(p.url()).search})`);
  await h.checkpoint('year grid');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged', 'budget']);

journey('U24', ['NO-LOST-UPDATES'], 'Two people change the same goal at once: the second is told, not overwritten', 8, async (h, device) => {
  const a = h.use(await newPage(device, 'sam'));
  const b = await a.context().newPage();
  b.on('pageerror', (e) => consoleErrors.push(`${device} ${b.url()} · ${e.message}`));
  await a.goto(url('/goals/lead/edit'));
  await b.goto(url('/goals/lead/edit'));
  await a.getByLabel('Name').first().waitFor();
  await b.getByLabel('Name').first().waitFor();
  // A renames it and saves.
  await h.fill(a.getByLabel('Name').first(), 'Lead time for changes (DORA)');
  await h.click(a.getByRole('button', { name: 'Save changes' }));
  await see(a, 'Lead time for changes (DORA)');
  // B, still looking at the old version, changes the source and saves: refused, and shown the latest.
  await b.getByText('More details').click();
  await h.fill(b.getByLabel('Data source'), 'Engineering metrics warehouse');
  await h.click(b.getByRole('button', { name: 'Save changes' }));
  await see(b, 'Someone else changed this a moment ago', 'the second save is not told it was refused');
  h.set('errors', true);
  await h.checkpoint('refused');
  const s = await h.snapshot();
  const g = s.goals.find((x) => x.id === 'lead');
  h.set('finish', g.title === 'Lead time for changes (DORA)' && g.source !== 'Engineering metrics warehouse', `the first save was overwritten or the second landed (title “${g.title}”, source “${g.source}”)`);
  h.set('logged', s.changes.filter((c) => c.goalId === 'lead' && c.action === 'edited').length === 1, 'the refused save was logged');
  h.set('attention', true);
  h.set('progress', true);
  await a.context().close();
}, ['entry', 'budget']);

journey('U25', ['FIRST-CHECKIN', 'GOAL-CREATE'], 'Publish a goal, then post its first check-in straight away', 12, async (h, device) => {
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/goals/new'));
  await h.fill(p.getByLabel(/Name it the way/), 'Runbooks with an owner');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.fill(p.getByLabel('Unit'), '%');
  await h.fill(p.getByLabel(/^Today \(week/), '20');
  await h.fill(p.getByLabel(/^Target \(week/), '90');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.click(p.getByRole('button', { name: 'Publish goal' }));
  await see(p, 'is published', 'publishing does not offer the first check-in');
  await h.inView(p.getByRole('link', { name: 'Post the first check-in' }), 'entry', 'Post the first check-in');
  await h.checkpoint('published');
  await h.click(p.getByRole('link', { name: 'Post the first check-in' }));
  await h.fill(p.getByLabel('This week’s value'), '20');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  const s = await h.snapshot();
  const g = s.goals.find((x) => x.title === 'Runbooks with an owner');
  const cis = s.checkIns.filter((c) => c.goalId === g?.id);
  h.set('finish', cis.length === 1 && cis[0].week === NOW && cis[0].value === 20, 'the first check-in was not saved for this week');
  h.set('logged', s.changes.some((c) => c.goalId === g?.id && c.action === 'posted'), 'the first check-in is not logged');
  // Later is fine too: the prompt goes, and the goal waits for its first check-in.
  await p.goto(url('/goals/scan?published=1'));
  h.set('attention', (await p.getByText('is published').count()) === 0, 'the prompt shows on a goal that already has check-ins');
  h.set('progress', true);
  await p.context().close();
}, ['errors']);

journey('U30', ['HONEST-NUMBERS', 'GOAL-MAP', 'DRAFTS'], 'Numbers you can trust, a map you can use from the keyboard, and a review set-up that survives a refresh', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'sam'));
  // From Home, the one-table check-in. Letters aren't a number: it says so in place, and no status is guessed.
  await p.goto(url('/'));
  const quick = p.getByRole('link', { name: /one table/ });
  await h.inView(quick, 'entry', 'Or type all your numbers in one table');
  await h.click(quick);
  const row = p.locator('.qrow').filter({ hasText: 'PRs with AI code review' });
  await h.fill(row.getByRole('textbox'), 'abc');
  await see(row, 'isn’t a number', 'letters are not called out as not a number');
  h.set('attention', (await row.locator('.qstatus .chip').count()) === 0, 'a status is shown for a value that isn’t a number');
  // Coverage can't pass 100%: refused in place, and the summary names the real problem.
  await h.fill(row.getByRole('textbox'), '150');
  await see(row, 'can’t be over 100%', 'a coverage of 150% is not refused');
  // Post keeps its label; what's wrong is said in the summary above it (fit and finish, 4 Nov: Numbers 7).
  await h.click(p.getByRole('button', { name: /^Post 1 check-in/ }));
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'needs a possible number' }).isVisible(), 'the summary blames a reason, not the number');
  const s = await h.snapshot();
  h.set('logged', !s.checkIns.some((c) => c.goalId === 'review' && c.value === 150), 'an impossible coverage was saved');
  await h.checkpoint('one table');
  // The map from the keyboard: Enter on a goal opens its story, which takes focus; Escape gives focus back.
  await p.goto(url('/goals'));
  await h.click(p.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Map' }));
  const node = p.locator('.react-flow__node[data-id="access"]');
  await node.waitFor();
  await node.focus();
  await p.keyboard.press('Enter');
  const panel = p.getByRole('complementary', { name: /Repo-access controls/ });
  await panel.waitFor({ timeout: 3000 }).catch(() => {});
  const opened = await panel.isVisible();
  const focused = opened && await panel.evaluate((el) => el.contains(document.activeElement));
  await p.keyboard.press('Escape');
  const back = opened && !(await panel.isVisible()) && await node.evaluate((el) => el === document.activeElement);
  h.set('finish', opened && focused && back, `keyboard map: opened ${opened}, focus in panel ${focused}, focus back ${back}`);
  // Setting up a review survives a refresh, and says so.
  await p.goto(url('/reviews/new'));
  const name = () => p.getByLabel('Name', { exact: true });
  await h.fill(name(), 'Research draft review');
  await p.reload();
  await see(p, 'Picked up where you left off', 'a refreshed review set-up does not say it kept the draft');
  h.set('progress', (await name().inputValue()) === 'Research draft review', 'the review name was lost on refresh');
  await p.getByRole('button', { name: 'Close without saving' }).click();
  await p.goto(url('/reviews/new'));
  h.set('progress', (await name().inputValue()) === '', 'closing without saving kept the draft');
  await p.context().close();
});

journey('U31', ['HONEST-NUMBERS', 'WALKTHROUGHS', 'WATCHING'], 'After the week is done: check in again, a walkthrough that still works, and Activity that keeps Watching’s scope', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  // Maya's week starts from Home; she posts her numbers at plan in one table, so her week is done.
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await p.goto(url('/quick-check-in'));
  await p.locator('.qrow').first().waitFor();
  const s0 = await h.snapshot();
  for (const row of await p.locator('.qrow').all()) {
    const title = (await row.locator('a').first().innerText()).trim();
    const g = s0.goals.find((x) => x.title === title);
    await h.fill(row.getByRole('textbox'), valueAt(g, NOW, 1));
  }
  await h.click(p.getByRole('button', { name: /^Post/ }));
  await see(p, 'Saved', 'posting the table did not confirm');
  // The done screen still offers a check-in, for when something changes.
  await p.goto(url('/check-in'));
  await see(p, 'is done', 'the week is not shown as done');
  h.set('progress', (await p.locator('.again-links a').count()) >= 2, 'the done screen offers no way to check in again');
  await h.checkpoint('week done');
  // The check-in walkthrough, started now, says the check-ins are in and points at Check-in instead of a missing button.
  await p.goto(url('/'));
  const panel = await demoPanel(p, h);
  await h.click(panel.getByRole('button', { name: /Post your weekly check-in/ }));
  const coach = p.getByRole('dialog', { name: /Walkthrough: Post your weekly check-in/ });
  await see(coach, 'already in this week', 'the walkthrough asks for a button that isn’t there');
  await h.click(p.locator('a:visible', { hasText: /^Check-in$/ }).first());
  await see(coach, 'step 2 of 4', 'opening Check-in did not move the walkthrough on');
  await see(coach, 'check in again', 'step 2 does not explain the week is done');
  h.set('attention', await p.locator('.coach-ring').isVisible(), 'the walkthrough points at nothing');
  await h.click(p.locator('.again-links a').first());
  await p.getByLabel('This week’s value').waitFor();
  await see(coach, 'Type this week’s number', 'the walkthrough did not pick up once the number field was there');
  h.set('finish', true);
  await coach.getByRole('button', { name: 'End' }).click();
  // Activity, reached from Watching, keeps the scope and says so; one click shows everything.
  await p.goto(url('/activity?watching=all&since=2026-10-26'));
  await see(p, 'Showing: Goals you watch', 'Activity does not say what it is showing');
  const scoped = await p.locator('.changes > li').count();
  await h.click(p.getByRole('button', { name: 'Show all activity' }));
  await p.getByText('Showing:').waitFor({ state: 'detached' });
  const all = await p.locator('.changes > li').count();
  h.set('errors', scoped < all, `scoped ${scoped}, all ${all}`);
  // A percentage target over 100% asks whether it's a share.
  await p.goto(url('/goals/new'));
  await h.fill(p.getByLabel(/Name it the way/), 'Coverage of runbooks');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await h.fill(p.getByLabel('Unit'), '%');
  await h.fill(p.getByLabel(/^Today \(week/), '0');
  await h.fill(p.getByLabel(/^Target \(week/), '150');
  h.set('logged', await p.getByRole('status').filter({ hasText: 'can’t pass 100%' }).isVisible(), 'a 150% target is not questioned');
  await p.context().close();
});

journey('U32', ['SAVED-VIEWS'], 'Search, filter and sort the goals in any layout, save it as a view, come back to it, and share it as a link', 18, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  await p.goto(url('/goals'));
  const search = p.getByRole('searchbox', { name: 'Search goals' });
  await h.inView(search, 'entry', 'the search box');
  // Search finds goals by any word: a title, an owner, a reason.
  await h.fill(search, 'vendor');
  await see(p, '1 of 13 goals', 'searching does not say how many goals match');
  h.set('attention', await p.getByRole('link', { name: /Repo-access controls/ }).first().isVisible().catch(() => false) || (await p.getByText('Repo-access controls for the Brain').count()) > 0, 'a search on the owner’s reason did not find the goal');
  await h.fill(search, '');
  // Filters: what needs someone. Then sort, and the same goals in the Table.
  await h.click(p.getByRole('button', { name: /^Filters/ }));
  const sheet = p.getByRole('dialog', { name: 'Filter goals' });
  await h.click(sheet.getByLabel('Recovery date slipped'));
  // Sort is in the sheet on every screen (a phone has no room for it in the bar).
  await sheet.getByLabel('Sort').selectOption('due');
  await h.checkpoint('filters');
  await h.click(sheet.getByRole('button', { name: 'Show the goals' }));
  await see(p, '2 of 13 goals', 'the slipped-date filter does not narrow the goals');
  await h.click(p.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Table' }));
  await p.locator('.gtable tbody tr').first().waitFor();
  const rows = await p.locator('.gtable tbody tr:not(.story-row)').count();
  h.set('progress', rows === 2 && (await p.getByRole('button', { name: /Remove filter: Recovery date slipped/ }).isVisible()), `table shows ${rows} goals with the filter`);
  // Save it: a name is needed; then it's a tab of its own. On a phone, saving and sharing are in one View menu (L&T 23).
  if (device === 'phone') await h.click(p.locator('.filter-view-menu > summary'));
  await h.click(p.getByRole('button', { name: 'Save view' }));
  const save = p.getByRole('dialog', { name: 'Save this view' });
  await h.click(save.getByRole('button', { name: 'Save view' }));
  h.set('errors', await save.getByRole('alert').filter({ hasText: 'Give the view a name' }).isVisible(), 'saving without a name is not caught');
  await h.fill(save.getByLabel('Name'), 'Slipped dates');
  await h.click(save.getByRole('button', { name: 'Save view' }));
  const tab = p.getByRole('tab', { name: /Slipped dates/ });
  await tab.waitFor();
  h.set('finish', (await tab.getAttribute('aria-selected')) === 'true', 'the saved view is not shown as the current one');
  const s = await h.snapshot();
  h.set('logged', (s.views ?? []).some((v) => v.name === 'Slipped dates' && v.params.includes('needs=slipped') && v.params.includes('view=table') && !v.deletedAt), 'the view was not saved with its filters and layout');
  // Back later: plain Goals, then the view, from the Views menu, brings it all back (saved views wait in one menu
  // rather than adding tabs that run off a phone's screen, L&T 2).
  await p.goto(url('/goals?view=list'));
  await h.click(p.locator('.views-menu > summary'));
  await h.click(p.getByRole('button', { name: /Slipped dates/ }));
  await see(p, '2 of 13 goals', 'opening the saved view did not bring its filters back');
  // A shared link opens the same goals for anyone.
  const other = await newPage(device, 'maya');
  await other.goto(url('/goals?needs=slipped&sort=due'));
  await see(other, '2 of 13 goals', 'a shared link does not open the same goals');
  await other.context().close();
  // Delete it: the tab goes.
  // Rename, pin and delete live in one menu, not beside the filters.
  if (device === 'phone') await p.locator('.filter-view-menu > summary').click();
  else await p.getByText('Manage view', { exact: true }).click();
  await p.getByRole('button', { name: 'Delete' }).click();
  await tab.waitFor({ state: 'detached' });
  await p.context().close();
});

journey('U33', ['EXCEPTIONS-FIRST', 'STORY', 'SAVED-VIEWS'], 'A leader acts on what needs them: what threatens the north star, respond to a request, chase a quiet goal, compare in a table', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  // The north star says which contributing goals are most likely to make it miss, near the top.
  await p.goto(url('/goals/head'));
  const threats = p.getByRole('region', { name: 'Most likely to make it miss' });
  await threats.waitFor();
  h.set('attention', (await threats.locator('.trow, .gline, li').count()) > 0, 'the north star does not name what threatens it');
  await h.checkpoint('threats');
  // A goal waiting on Elena's decision: Respond is beside the request and opens it, ready to answer.
  await p.goto(url('/goals/access'));
  const request = p.getByRole('region', { name: 'Decision or help needed' });
  await request.waitFor();
  await h.click(request.getByRole('button', { name: 'Respond' }));
  const respond = p.getByRole('dialog', { name: 'Respond to the request' });
  await respond.waitFor({ timeout: 3000 }).catch(() => {});
  h.set('finish', await respond.getByLabel('Your answer or decision').isVisible().catch(() => false), 'Respond does not open a place to answer the request');
  await p.keyboard.press('Escape');
  const repeats = await p.locator('main').evaluate((m) => (m.innerText.match(/Elena Ruiz: Elena/g) || []).length);
  h.set('attention', repeats === 0, 'the request names its recipient twice');
  // Chasing a quiet goal leaves a lasting "Asked" in place of the button.
  await p.goto(url('/goals/env'));
  await h.click(p.getByRole('button', { name: /^Ask Jonas for an update/ }));
  await see(p, 'Asked Jonas for an update', 'asking for an update leaves no lasting trace');
  h.set('attention', !(await p.getByRole('button', { name: /^Ask Jonas for an update/ }).isVisible()), 'the ask button is still offered after asking');
  const s1 = await h.snapshot();
  h.set('logged', s1.changes.some((c) => c.goalId === 'env' && c.actorId === 'elena' && c.entity === 'note' && c.diffs.some((d) => /could you post an update/.test(d.to))), 'the request for an update was not logged');
  // The table compares: one line of story per goal, Details to open it.
  await p.goto(url('/goals?view=table'));
  const row = p.locator('.story-row').first();
  await row.waitFor();
  const tall = await row.evaluate((r) => r.getBoundingClientRect().height);
  h.set('attention', tall <= 60, `a table story row is ${Math.round(tall)}px tall before it is opened`);
  await h.click(row.getByRole('button', { name: /^Details/ }));
  h.set('finish', await row.locator('dl').isVisible(), 'Details does not open the story');
  // One press for the goals waiting on a decision (on a phone, it's in Filters).
  if (device === 'desktop') {
    await h.click(p.getByRole('button', { name: 'Decision or help needed', exact: true }));
    await see(p, 'of 13 goals', 'the decision filter did not narrow the goals');
  }
  // New goal with one left unpublished: asked first, not dropped into its last step.
  await p.goto(url('/goals/new'));
  await h.fill(p.getByRole('textbox').first(), 'Half-written goal');
  await p.goto(url('/goals'));
  await p.goto(url('/goals/new'));
  await see(p, 'You have a goal you didn’t publish', 'New goal reopens the old draft without asking');
  await h.click(p.getByRole('button', { name: 'Start another goal' }));
  h.set('finish', (await p.getByRole('textbox').first().inputValue()) === '', 'Start another goal kept the old draft');
  await p.context().close();
}, ['entry', 'progress', 'errors']);

journey('U34', ['HONEST-NUMBERS', 'SAVED-VIEWS', 'DRAFTS'], 'What you see is what you share: the map’s attention filter, History’s range and an unposted table survive links and refreshes', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'sam'));
  // The map's "Only what needs attention" is the status filter: in the link, in the count, and in Export.
  await p.goto(url('/goals?view=map'));
  await p.getByRole('region', { name: /Goal map/ }).waitFor();
  await h.click(p.getByLabel('Only what needs attention'));
  await p.waitForURL(/status=off(%2C|,)risk(%2C|,)stale/, { timeout: 3000 }).catch(() => {});
  h.set('logged', /status=off(%2C|,)risk(%2C|,)stale/.test(p.url()), 'the attention filter is not in the link');
  await see(p, /\d+ of 13 goals/, 'the attention filter does not show in the count');
  await h.click(p.getByRole('button', { name: /Export/ }));
  const scope = p.getByRole('dialog', { name: 'Export goals' }).getByLabel(/What’s shown now/);
  h.set('attention', await scope.isChecked().catch(() => false), 'a filtered export does not start from what is shown');
  await p.keyboard.press('Escape');
  await h.checkpoint('map attention');
  // History's range is part of the view: chosen, refreshed, still there.
  await p.goto(url('/goals?view=history&hist=weekly'));
  await h.click(p.getByRole('group', { name: 'Weeks shown' }).getByRole('button', { name: 'Whole year' }));
  await p.waitForURL(/weeks=year/, { timeout: 3000 }).catch(() => {});
  await p.reload();
  const year = p.getByRole('group', { name: 'Weeks shown' }).getByRole('button', { name: 'Whole year' });
  await year.waitFor();
  h.set('finish', (await year.getAttribute('aria-pressed')) === 'true', 'History forgot the whole-year range on refresh');
  // Numbers typed in the one table survive a refresh, and say so.
  await p.goto(url('/quick-check-in'));
  const row = p.locator('.qrow').first();
  await row.waitFor();
  await h.fill(row.getByRole('textbox').first(), '94');
  await p.waitForTimeout(150);
  await p.reload();
  await see(p, 'Picked up the numbers you hadn’t posted yet', 'a refreshed table does not say it kept the numbers');
  h.set('progress', (await p.locator('.qrow').first().getByRole('textbox').first().inputValue()) === '94', 'the typed number was lost on refresh');
  await p.context().close();
}, ['entry', 'errors', 'one-action']);

journey('U35', ['DATA-TABLES', 'CHANGE-LOG'], 'An admin corrects people, goals and a past check-in in the data tables; anyone filters the activity and saves it', 26, async (h, device) => {
  const p = h.use(await newPage(device, 'priya'));
  // Everyone can open the tables; an admin types into cells across tables, then reviews and saves once.
  await p.goto(url('/data?t=people'));
  const title = p.getByLabel('Job title, Tom Reid');
  await title.waitFor();
  await h.fill(title, 'Staff engineer, DevEx');
  await h.click(p.getByRole('tab', { name: /Check-ins/ }));
  // Property filters: a goal from its list of values, and a number condition; then sort by a column.
  await h.click(p.getByRole('button', { name: 'Filter', exact: true }));
  let sheet = p.getByRole('dialog', { name: 'Add a filter' });
  await sheet.getByLabel('Property').selectOption('Goal');
  await h.click(sheet.getByLabel('PRs with AI code review'));
  await h.click(sheet.getByRole('button', { name: 'Add filter' }));
  await h.click(p.getByRole('button', { name: 'Filter', exact: true }));
  sheet = p.getByRole('dialog', { name: 'Add a filter' });
  await sheet.getByLabel('Property').selectOption('Week');
  await sheet.getByLabel('Condition').selectOption('gte');
  await h.fill(sheet.getByRole('textbox', { name: 'Value', exact: true }), '38');
  await h.click(sheet.getByRole('button', { name: 'Add filter' }));
  await see(p, 'Goal is PRs with AI code review', 'the goal filter is not shown as words');
  await see(p, 'Week ≥ 38', 'the week filter is not shown as words');
  await h.click(p.locator('.dtable thead').getByRole('button', { name: /^Week$/ }));
  const weekCol = (await p.locator('.dtable thead th').allInnerTexts()).findIndex((t) => /^Week/.test(t.trim()));
  const weeks = await p.locator('.dtable tbody tr').evaluateAll((trs, i) => trs.map((tr) => tr.querySelectorAll('td')[i]?.textContent ?? ''), weekCol);
  h.set('progress', weeks.length > 0 && weeks.every((w, i) => Number(w) >= 38 && (i === 0 || Number(w) >= Number(weeks[i - 1]))) && /f=Goal/.test(p.url()) && /s=Week/.test(p.url()), `filtered and sorted weeks: ${weeks.join(', ')}`);
  await h.fill(p.getByPlaceholder('Search check-ins'), 'reached GA');
  const why = p.getByLabel(/^Why, PRs with AI code review, week/).first();
  await why.waitFor();
  const was = await why.inputValue();
  await h.fill(why, was.replace('two weeks early', 'three weeks early'));
  await see(p, '2 changes in 2 rows, not saved yet', 'the tables do not say what is waiting to be saved');
  h.set('attention', (await p.locator('.dcell.edited').count()) === 1 && (await why.getAttribute('aria-label')) !== null, 'a changed cell is not marked as changed');
  await h.checkpoint('edited');
  await h.click(p.getByRole('button', { name: 'Review changes' }));
  const dialog = p.getByRole('dialog', { name: 'Review your changes' });
  await see(dialog, 'Tom Reid', 'the review does not show the person change');
  h.set('errors', !(await dialog.getByText('fixing first').isVisible().catch(() => false)), 'the review found problems with the edits');
  await h.click(dialog.getByRole('button', { name: /^Save 2 changes/ }));
  await see(p, 'Saved 2 changes', 'saving the tables did not confirm');
  const s = await h.snapshot();
  h.set('logged', s.people.find((x) => x.id === 'tom')?.role === 'Staff engineer, DevEx' && s.changes.some((c) => c.entity === 'check-in' && c.actorId === 'priya' && c.diffs.some((d) => d.field === 'Via' && d.to === 'Data tables')), 'the person or the check-in correction was not saved and logged');
  // Someone who isn't an admin can look but not change anything.
  const m = await newPage(device, 'maya');
  await m.goto(url('/data'));
  await see(m, 'Admins can change them here', 'a non-admin is not told who can change the data');
  h.set('errors', (await m.locator('.dtable input, .dtable select').count()) === 0, 'a non-admin can type into the data tables');
  await m.context().close();
  // Activity: kind, who and when, all in the link; then save what's shown.
  await p.goto(url('/activity'));
  await h.click(p.getByRole('group', { name: 'Kind of change' }).getByRole('button', { name: /^Check-ins/ }));
  await p.waitForURL(/kind=checkins/, { timeout: 3000 }).catch(() => {});
  await h.click(p.getByRole('button', { name: /^Filters/ }));
  await h.click(p.getByRole('dialog', { name: 'Filter activity' }).getByLabel('Only my changes'));
  await h.click(p.getByRole('button', { name: 'Show the changes' }));
  await p.waitForURL(/who=priya/, { timeout: 3000 }).catch(() => {});
  h.set('finish', /kind=checkins/.test(p.url()) && /who=priya/.test(p.url()), 'the activity filters are not in the link');
  await see(p, /\d+ of \d+ changes/, 'the filtered activity does not say how many it shows');
  const download = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  // On a phone, Save .csv is in the Filters sheet's footer rather than a row of the filter bar.
  if (device === 'phone') { await h.click(p.getByRole('button', { name: /^Filters/ })); await h.click(p.getByRole('dialog', { name: 'Filter activity' }).getByRole('button', { name: 'Save .csv' })); }
  else await h.click(p.getByRole('button', { name: 'Save .csv' }));
  h.set('progress', !!(await download), 'Save .csv did not download the filtered log');
  await p.context().close();
}, ['entry', 'one-action']);

journey('U36', ['PATH-TO-GREEN', 'ATTENTION', 'REVIEW-RUN'], 'An owner keeps last week’s account but withdraws the request; the leader’s Home and review agree on what needs them', 12, async (h, device) => {
  // Maya: the same account as last week, but Elena's decision isn't needed any more.
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/check-in/head'));
  const s0 = await h.snapshot();
  await h.fill(p.getByLabel('This week’s value'), valueAt(s0.goals.find((g) => g.id === 'head'), NOW, 0.5));
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await see(p, 'Still asking:', 'the open request is not shown before posting');
  await h.click(p.getByLabel('Keep this request open on their Home'));
  await h.click(p.getByRole('button', { name: /^Still true/ }));
  if (await p.getByRole('group', { name: 'Back on plan by' }).isVisible().catch(() => false)) {
    await h.click(p.getByRole('group', { name: 'Back on plan by' }).getByRole('button').first());
    await h.click(p.getByRole('button', { name: 'Post check-in' }));
  }
  await see(p, 'Check-in saved');
  const s = await h.snapshot();
  const c = s.checkIns.filter((x) => x.goalId === 'head').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
  h.set('logged', !!c && !c.pathToGreen?.needs && /Brain/.test(c.pathToGreen?.what ?? ''), 'the withdrawn request was posted again, or the account was lost');
  h.set('progress', await p.locator('.celebrate').isVisible(), 'no confirmation after posting');
  await h.checkpoint('posted');
  // Elena, in the same demo data: Maya's request has gone from Home; Home and the review describe the same agenda.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'elena'));
  await p.goto(url('/'));
  await see(p, 'goals to discuss', 'Home does not say how many goals need discussion');
  const home = await p.locator('main').innerText();
  h.set('attention', !/Intake-to-delivery time[\s\S]{0,120}approve an interim read-only scope for the Brain/.test(home), 'Maya’s withdrawn request is still on Elena’s Home');
  const discuss = Number((home.match(/(\d+) goals? to discuss/) || [])[1]);
  await h.click(p.getByRole('link', { name: /Open the review|Continue/ }));
  await see(p, `Start review · ${discuss} goal`, 'Home and the review disagree on how many goals need discussion');
  h.set('finish', discuss > 0, 'no agenda count on Home');
  await h.checkpoint('review');
  await p.context().close();
}, ['entry', 'one-action', 'errors']);

journey('U37', ['PATH-TO-GREEN', 'ATTENTION', 'CHANGE-LOG'], 'Two goals wait on one decision: an owner links them, the leader answers once, and both goals show the answer', 12, async (h, device) => {
  // Aisha's goal is waiting on the same interim-scope decision Maya asked Elena for: she links it.
  const p = h.use(await newPage(device, 'aisha'));
  await p.goto(url('/goals/access'));
  await h.click(p.getByRole('button', { name: 'Waiting on a decision already asked for another goal?' }));
  const sheet = p.getByRole('dialog', { name: 'Waiting on the same decision' });
  await h.click(sheet.getByRole('button', { name: /Intake-to-delivery time/ }));
  await see(p, 'one answer will cover both goals', 'linking the request did not confirm');
  await h.checkpoint('linked');
  // Elena, in the same demo data: the request shows once, for both goals; she answers it from Home.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'elena'));
  await p.goto(url('/'));
  const need = p.locator('.need').filter({ hasText: 'and 1 more goal waiting on it' });
  await need.waitFor();
  h.set('attention', (await p.locator('.need').filter({ hasText: 'interim' }).count()) === 1, 'the same decision is asked twice on Home');
  await h.click(need.getByRole('button', { name: 'Respond' }));
  const respond = p.getByRole('dialog', { name: 'Respond to the request' });
  await see(respond, '2 goals are waiting on this', 'the answer sheet does not say which goals wait on it');
  await h.fill(respond.getByLabel('Your answer or decision'), 'Approved: interim read-only scope until the vendor fix lands.');
  await h.click(respond.getByRole('button', { name: 'Record the answer' }));
  await see(p, 'Answered for all 2 goals', 'answering did not confirm for both goals');
  h.set('progress', (await p.locator('.need').filter({ hasText: 'interim' }).count()) === 0, 'the answered request is still on Home');
  // Both goals show the answer; the request is answered once, logged on each goal.
  await p.goto(url('/goals/access'));
  await see(p, 'Answered by Elena Ruiz', 'the linked goal does not show the answer');
  const s = await h.snapshot();
  const r = (s.requests || []).find((x) => x.status === 'answered' && /vendor fix lands/.test(x.answer || ''));
  h.set('logged', !!r && r.goalIds.includes('head') && r.goalIds.includes('access') && s.changes.filter((c) => c.entity === 'request' && c.action === 'answered').length === 2, 'the answer is not one request, logged on both goals');
  h.set('finish', true);
  await p.context().close();
}, ['entry', 'one-action', 'errors']);

journey('U38', ['QUARTER-RESULTS', 'WEEK-INSPECTOR', 'NO-DOUBLE-POST', 'ASK-UNDO', 'STICKY-HEAD'], 'A leader reads the quarters, inspects a week, asks for an update and takes it back; an owner’s double press posts once', 24, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  // History opens on each quarter's actual against plan, not the owners' weekly calls.
  await p.goto(url('/goals?view=history'));
  await p.locator('.qtable').first().waitFor();
  const met = await p.locator('.qcell.q-met').count();
  const missed = await p.locator('.qcell.q-missed').count();
  h.set('attention', met > 0 && missed > 0 && (await p.locator('.qcell').filter({ hasText: 'In progress' }).count()) > 0, `quarter results should show met, missed and in progress; saw ${met} met, ${missed} missed`);
  await h.checkpoint('quarter results');
  // Weekly status, one quarter at a time or the whole year, with the selected week in words.
  await h.click(p.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Weekly status' }));
  await p.locator('.hgrid').first().waitFor();
  await h.click(p.getByRole('group', { name: 'Weeks shown' }).getByRole('button', { name: 'Q3' }));
  await p.waitForFunction(() => /27/.test(document.querySelector('.hgrid thead th:nth-child(2)')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const q3 = await p.locator('.hgrid').first().locator('thead th:nth-child(2)').innerText().catch(() => '');
  await h.click(p.getByRole('group', { name: 'Weeks shown' }).getByRole('button', { name: 'Whole year' }));
  await p.waitForFunction(() => document.querySelectorAll('.hgrid thead th').length > 40, null, { timeout: 10000 }).catch(() => {});
  const inspector = p.locator('.week-inspector');
  await see(inspector, `Week ${NOW}`, 'the inspector does not start on this week');
  // By keyboard: one tab stop, then the arrow keys.
  await p.locator('.hgrid').first().locator('td[tabindex="0"]').focus();
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowLeft');
  await see(inspector, `Week ${NOW - 2}`, 'the arrow keys do not move the selected week');
  const said = await inspector.innerText();
  // By touch or mouse: a square.
  await h.click(p.locator('.hgrid').first().locator('tbody tr').nth(1).locator('td.hcell').nth(9));
  await see(inspector, 'Week 10', 'tapping a square does not select it');
  h.set('progress', /27/.test(q3) && /(On track|At risk|Off track|Done|No check-in)/.test(said), `Q3 starts “${q3}”; the inspector said “${said.replace(/\n/g, ' ')}”`);
  await h.checkpoint('week inspector');
  // The Table's header stays in view while the goals scroll under it.
  await p.goto(url('/goals?view=table'));
  const head = p.locator('.gtable').first().locator('thead th').nth(1);
  await head.waitFor();
  await p.evaluate(() => { const t = document.querySelector('.gtable'); window.scrollBy(0, t.getBoundingClientRect().top + 220); });
  await p.waitForTimeout(150);
  const stuck = await p.evaluate(() => { const t = document.querySelector('.gtable'); const th = t.querySelector('thead th'); const r = th.getBoundingClientRect(); return { top: Math.round(r.top), table: Math.round(t.getBoundingClientRect().top), bottom: Math.round(t.getBoundingClientRect().bottom) }; });
  h.set('parity', stuck.table < 0 && stuck.top >= 0 && stuck.top <= 90 && stuck.bottom > stuck.top + 40, `the table header scrolled away: ${JSON.stringify(stuck)}`);
  await h.checkpoint('sticky header');
  // Asking Jonas for an update shows as asked, with an Undo; undone, it leaves his Home too.
  await p.goto(url('/goals/env'));
  await h.click(p.getByRole('button', { name: 'Ask Jonas for an update' }));
  await see(p, 'Asked Jonas for an update', 'asking does not show as asked');
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'jonas'));
  await p.goto(url('/'));
  await see(p, 'Elena asked for an update', 'the ask is not on Jonas’s Home');
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'elena'));
  await p.goto(url('/goals/env'));
  await h.click(p.getByRole('button', { name: 'Undo' }));
  await p.getByRole('button', { name: 'Ask Jonas for an update' }).waitFor();
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'jonas'));
  await p.goto(url('/'));
  await p.locator('main').waitFor();
  await p.waitForTimeout(300);
  const left = await p.getByText('Elena asked for an update').count();
  const s1 = await h.snapshot();
  const asks = s1.changes.filter((c) => c.goalId === 'env' && c.entity === 'note');
  h.set('logged', left === 0 && asks.some((c) => c.action === 'noted') && asks.some((c) => c.action === 'withdrawn'), `undoing left ${left} asks on Home; logged ${asks.map((c) => c.action).join(', ')}`);
  await h.checkpoint('ask undone');
  // Sam presses Post twice before the screen can react: one check-in, not two.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'sam'));
  const before = (await h.snapshot()).checkIns.filter((c) => c.goalId === 'lead' && c.week === NOW).length;
  await p.goto(url('/check-in/lead'));
  await h.fill(p.getByLabel('This week’s value'), valueAt(s1.goals.find((g) => g.id === 'lead'), NOW, 1.05));
  const label = await p.locator('form.focus-body button[type=submit]').innerText();
  await p.evaluate(() => { const b = document.querySelector('form.focus-body button[type=submit]'); b.click(); b.click(); b.click(); });
  await see(p, 'Check-in saved', 'the check-in did not post');
  await p.waitForTimeout(500);
  const after = (await h.snapshot()).checkIns.filter((c) => c.goalId === 'lead' && c.week === NOW).length;
  h.set('errors', label === 'Post check-in' && after - before === 1, `three quick presses on “${label}” posted ${after - before} check-ins`);
  h.set('finish', true);
  await p.context().close();
}, ['entry', 'one-action']);

journey('U39', ['ONE-ACCOUNT', 'PATH-TO-GREEN', 'WALKTHROUGHS'], 'Something changed: what changed, what happens next and by when on one screen; the walkthrough coach never covers what it points at', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/check-in/alerts'));
  const s0 = await h.snapshot();
  // Before a number is typed the button doesn't promise to post.
  const before = await p.locator('form.focus-body button[type=submit]').innerText();
  await h.fill(p.getByLabel('This week’s value'), valueAt(s0.goals.find((g) => g.id === 'alerts'), NOW, 0.4));
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await h.click(p.getByRole('button', { name: 'Something changed', exact: true }));
  // One screen: the cause, the account, the way back and the week, with last week's words to edit.
  const account = p.getByRole('region', { name: 'What changed, and what happens next' });
  await account.waitFor();
  const steps = await p.locator('.dots').getAttribute('aria-label');
  const oneScreen = await account.getByRole('group', { name: 'Main cause' }).isVisible() && await account.getByRole('radiogroup', { name: 'Where you are' }).isVisible();
  const prefilled = (await account.getByLabel('What happened').inputValue()).length > 10;
  h.set('one-action', oneScreen && prefilled && steps === 'Step 3 of 3' && before === 'Continue', `one screen ${oneScreen}, last week’s words ${prefilled}, progress “${steps}”, first button “${before}”`);
  await h.checkpoint('one account');
  // An empty account is explained where it's missing, not posted.
  await account.getByLabel('What happened').fill('');
  await p.getByRole('button', { name: 'Post check-in' }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Write a sentence about what happened' }).isVisible(), 'an empty account is not explained');
  await h.fill(account.getByLabel('What happened'), 'The paging alerts moved to a new pipeline and the classifier lost its labels.');
  await h.click(account.getByRole('radio', { name: /I have a plan/ }));
  await h.fill(account.getByLabel('What changes?'), 'Relabel the paging alerts this week, then turn auto-triage back on.');
  await h.click(account.getByRole('group', { name: 'Back on plan by' }).getByRole('button').first());
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  const s = await h.snapshot();
  const c = s.checkIns.filter((x) => x.goalId === 'alerts').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
  h.set('logged', !!c && /new pipeline/.test(c.why) && /Relabel/.test(c.pathToGreen?.what ?? '') && (c.pathToGreen?.byWeek ?? 0) > NOW, 'the account was not saved whole');
  // The goal page says whose date is whose: the owner's recovery date and the app's projection.
  await p.goto(url('/goals/alerts'));
  await see(p, 'Owner’s date: back on plan by', 'the owner’s date is not labelled as theirs');
  const proj = await p.getByText(/Projected by the app/).count();
  h.set('attention', proj > 0, 'the projection is not labelled as the app’s estimate');
  // The map walkthrough: the coach sits beside the goal it points at, never on it.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'elena'));
  await p.goto(url('/goals?view=map'));
  await p.locator('.react-flow__node').first().waitFor();
  await p.evaluate(() => { sessionStorage.setItem('goals-tour', JSON.stringify({ id: 'map', step: 1 })); window.dispatchEvent(new Event('goals-tour')); });
  const coach = p.locator('.coach');
  await coach.waitFor().catch(() => {});
  await p.waitForTimeout(900);
  const clear = await p.evaluate(() => {
    const c = document.querySelector('.coach')?.getBoundingClientRect();
    const r = document.querySelector('.coach-ring')?.getBoundingClientRect();
    if (!c || !r) return { ok: false, why: `coach ${!!c}, ring ${!!r}` };
    const hit = c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top;
    const inView = c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight;
    return { ok: !hit && inView, why: `coach ${Math.round(c.left)},${Math.round(c.top)} ${Math.round(c.width)}×${Math.round(c.height)}; ring ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}` };
  });
  h.set('progress', clear.ok, `the coach covers what it points at, or is off screen: ${clear.why}`);
  h.set('finish', true);
  await p.context().close();
}, ['entry']);

journey('U40', ['OTHER-CAUSE', 'DEMO-FEEDBACK', 'RESEARCH'], 'Research notes followed up: a cause for anything else, demo feedback that says where it goes, and a research session that ends after its last task', 16, async (h, device) => {
  // Kofi's goal is behind, and none of the named causes fits: Something else, in his own words.
  const p = h.use(await newPage(device, 'kofi'));
  await p.goto(url('/check-in/alerts'));
  const s0 = await h.snapshot();
  await h.fill(p.getByLabel('This week’s value'), valueAt(s0.goals.find((g) => g.id === 'alerts'), NOW, 0.4));
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await h.click(p.getByRole('button', { name: 'Something changed', exact: true }));
  await h.click(p.getByRole('group', { name: 'Main cause' }).getByRole('button', { name: 'Something else' }));
  await h.fill(p.getByLabel('What happened'), 'A reorganisation moved the alert owners to another team mid-week.');
  await h.checkpoint('something else');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  const s1 = await h.snapshot();
  const c = s1.checkIns.filter((x) => x.goalId === 'alerts').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
  h.set('logged', !!c && c.cause === 'other' && /reorganisation/.test(c.why), 'the Something else cause was not saved');
  // Feedback in the demo says it goes to the people building the app (it used to stay in the browser).
  await p.goto(url('/'));
  await p.locator('main').first().waitFor();
  if (await p.locator('.feedback-nav').isVisible().catch(() => false)) await h.click(p.locator('.feedback-nav'));
  else { await h.click(p.locator('.tabbar').getByRole('button', { name: /More/ })); await h.click(p.getByRole('button', { name: /Send feedback/ })); }
  const sheet = p.getByRole('dialog', { name: 'How is the app working for you?' });
  await h.click(sheet.getByRole('button', { name: 'It gets in the way' }));
  await h.fill(sheet.getByRole('textbox'), 'The causes didn’t fit my week.');
  await h.checkpoint('feedback');
  await h.click(sheet.getByRole('button', { name: 'Send' }));
  await see(p, 'It goes to the people building this app', 'demo feedback does not say where it goes');
  h.set('attention', true);
  // A research session ends after its last task: no repeats of it, and a way to the report.
  await p.evaluate(() => {
    const s = { id: 'rs_eval', researcher: 'Eval agent', kind: 'ai', startedAt: new Date().toISOString(), task: 10 };
    sessionStorage.setItem('goals-research', JSON.stringify(s)); localStorage.setItem('goals-research', JSON.stringify(s));
  });
  await p.reload();
  const bar = p.getByRole('complementary', { name: 'Research' });
  if (await bar.getByRole('button', { name: 'Save' }).isVisible().catch(() => false)) await bar.getByRole('button', { name: /Skip|Not now|Close|Cancel/ }).first().click().catch(() => {});
  await h.click(bar.getByRole('button', { name: 'How did it go?' }));
  await h.click(bar.getByLabel('Done'));
  await h.click(bar.getByRole('button', { name: 'Save and next task' }));
  await see(bar, 'All 11 tasks noted', 'the research bar does not say the tasks are done');
  await h.checkpoint('research done');
  const again = await bar.getByRole('button', { name: 'How did it go?' }).count();
  const report = await bar.getByRole('link', { name: 'Write your report' }).count();
  h.set('progress', again === 0 && report === 1, `after the last task: ${again} “How did it go?” buttons, ${report} report links`);
  h.set('finish', true);
  await p.context().close();
}, ['entry', 'one-action', 'errors']);

journey('U26', ['GOAL-MAP'], 'Find what will sink the north star on the goal map, and read its story', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'elena'));
  await p.goto(url('/goals'));
  await h.click(p.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Map' }));
  const canvas = p.getByRole('region', { name: /Goal map/ });
  await canvas.waitFor();
  await p.locator('.react-flow__node').first().waitFor();
  // The critical path runs from the north star through the off-track input, and the map opens on it.
  const onPath = await p.locator('.react-flow__node[aria-label*="critical path"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  h.set('attention', onPath.includes('head') && onPath.includes('access') && !onPath.includes('triage'), `critical path: ${onPath.join(', ')}`);
  const access = p.locator('.react-flow__node[data-id="access"]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await access.boundingBox(), area = await canvas.boundingBox();
  h.set('entry', !!box && !!area && box.x >= area.x - 1 && box.x + box.width <= area.x + area.width + 1, 'the map does not open on the critical path');
  await h.checkpoint('map');
  // A goal opens its story beside the map.
  await h.click(access);
  const panel = p.getByRole('complementary', { name: /Repo-access controls/ });
  await panel.waitFor();
  h.set('finish', /Why/.test(await panel.innerText()) && /On the critical path/.test(await panel.innerText()) && await panel.getByRole('link', { name: 'Open the goal' }).isVisible(), 'the story panel is missing its why or link');
  // Fold the branches, then show only what needs attention.
  const before = await p.locator('.react-flow__node').count();
  await h.click(p.getByRole('button', { name: 'Fold all' }));
  const folded = await p.locator('.react-flow__node').count();
  await h.click(p.getByRole('button', { name: 'Unfold all' }));
  await h.click(p.getByLabel('Only what needs attention'));
  // It's the status filter now, so the map redraws from the link.
  await p.waitForFunction((n) => document.querySelectorAll('.react-flow__node').length < n, before, { timeout: 3000 }).catch(() => {});
  const attention = await p.locator('.react-flow__node').count();
  h.set('progress', folded < before && attention < before && attention >= 3, `nodes: ${before} all, ${folded} folded, ${attention} needing attention`);
  // Dotted lines for goals that also help others.
  await h.click(p.getByLabel('Only what needs attention'));
  // The canvas draws its lines after the nodes are measured, so wait for them rather than counting at once.
  // (Drawn, not necessarily on screen: on a phone the dotted lines sit lower down the canvas.)
  const helps = await p.waitForFunction(() => document.querySelectorAll('.react-flow__edge.helps').length > 0, null, { timeout: 5000 }).then(() => true, () => false);
  h.set('logged', helps, 'no dotted also-helps lines');
  await p.context().close();
}, ['errors', 'budget']);

journey('U27', ['WALKTHROUGHS', 'DEMO-MODE'], 'Take a walkthrough: the coach points the way and moves on as you do each step', 10, async (h, device) => {
  const p = h.use(await newPage(device, 'tom'));
  await p.goto(url('/'));
  const panel = await demoPanel(p, h);
  await h.click(panel.getByRole('button', { name: /Post your weekly check-in/ }));
  const coach = p.getByRole('dialog', { name: /Walkthrough: Post your weekly check-in/ });
  await coach.waitFor();
  h.set('entry', /Goal owner · step 1 of 4/.test(await coach.innerText()) && await p.locator('.coach-ring').isVisible(), 'the coach or its pointer is missing');
  await h.checkpoint('coach');
  // You do the steps yourself; the coach notices.
  await h.click(p.locator('.hero a.btn.primary'));
  await see(coach, 'step 2 of 4', 'the coach did not move on when the check-in opened');
  const s0 = await h.snapshot();
  const g = s0.goals.find((x) => x.id === 'head');
  await h.fill(p.getByLabel('This week’s value'), valueAt(g, NOW, 1.02));
  await see(coach, 'step 3 of 4', 'the coach did not move on when the number was typed');
  h.set('progress', true);
  await h.click(p.locator('.focus-foot button[type=submit]'));
  if (await p.getByRole('button', { name: 'Post check-in' }).isVisible().catch(() => false)) await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(coach, 'step 4 of 4', 'the coach did not notice the check-in was saved');
  await h.click(coach.getByRole('button', { name: 'Finish' }));
  h.set('finish', (await p.locator('.coach').count()) === 0, 'the coach did not close');
  h.set('attention', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U28', ['RESEARCH'], 'A research session: first glances, a note pinned to the screen, a task result and a report', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'maya'));
  await p.goto(url('/research'));
  await see(p, 'Not built yet, on purpose: access control', 'the hub does not say access control is deliberately not built');
  await h.inView(p.getByRole('heading', { name: 'Research this app' }), 'entry', 'the research hub');
  await h.fill(p.getByLabel(/Your name, or the agent/), 'Eval agent');
  await h.click(p.getByLabel('An AI agent'));
  await h.click(p.getByRole('button', { name: 'Start the session' }));
  await see(p, '0 of 11 recorded');
  await h.checkpoint('hub');
  // The first task takes you there as the right person; the first glance asks before you do anything.
  await h.click(p.locator('.task-list li').first().getByRole('button'));
  const bar = p.getByRole('complementary', { name: 'Research' });
  await see(bar, 'First glance · Home', 'no first-glance question on a new screen');
  await h.fill(bar.getByRole('textbox'), 'Looks like my week: what to check in and what needs me.');
  await h.click(bar.getByRole('button', { name: 'Save' }));
  // A note pinned to a spot on the screen.
  await h.click(bar.getByRole('button', { name: 'Note on this' }));
  await p.locator('.hero').first().click();
  await see(bar, 'Note on', 'picking a spot did not open the note');
  await h.fill(bar.getByLabel('Your note'), 'I expected the due goals to be listed here.');
  await h.click(bar.getByRole('button', { name: 'Save note' }));
  // How the task went.
  await h.click(bar.getByRole('button', { name: 'How did it go?' }));
  await h.click(bar.getByLabel('Stuck'));
  await h.fill(bar.getByLabel('What happened'), 'Could not tell which goal was due first.');
  await h.click(bar.getByRole('button', { name: 'Save and next task' }));
  await h.checkpoint('research bar');
  // The report, back on the hub.
  await h.click(bar.getByRole('link', { name: 'Hub' }));
  await h.fill(p.getByLabel('Your report'), '## Summary\nCheck-in is quick. Home could say which goal is due first.\n\n## Top findings\n1. minor: Home');
  await h.click(p.getByRole('button', { name: 'Send the report' }));
  await see(p, 'Report received');
  const notes = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-research-notes') || '[]'));
  const kinds = [...new Set(notes.map((n) => n.kind))].sort().join(',');
  h.set('logged', kinds === 'comment,first-glance,report,task' && notes.every((n) => n.researcher === 'Eval agent' && n.researcherKind === 'ai') && notes.find((n) => n.kind === 'comment').target.length > 3, `notes kept: ${kinds}`);
  h.set('finish', true);
  h.set('progress', true);
  h.set('attention', true);
  await p.context().close();
}, ['errors', 'budget']);

journey('U29', ['WALKTHROUGHS'], 'Every walkthrough starts as the right person and points at something real', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'tom'));
  await p.goto(url('/'));
  const panel = await demoPanel(p);
  const titles = await panel.getByRole('region', { name: 'Show me how' }).getByRole('button').allInnerTexts().catch(() => []);
  await p.keyboard.press('Escape');
  const bad = [];
  for (const t of titles.map((x) => x.split('\n')[0])) {
    const pn = await demoPanel(p);
    await h.click(pn.getByRole('button', { name: t }));
    const coach = p.getByRole('dialog', { name: 'Walkthrough: ' + t });
    await coach.waitFor();
    await p.waitForTimeout(600);
    if (!(await p.locator('.coach-ring').isVisible().catch(() => false))) bad.push(t);
    await coach.getByRole('button', { name: 'End' }).click();
  }
  h.set('finish', titles.length >= 6 && !bad.length, `${titles.length} walkthroughs; no pointer on the first step of: ${bad.join(', ')}`);
  ['entry', 'progress', 'attention', 'logged'].forEach((k) => h.set(k, true));
  await p.context().close();
}, ['errors', 'budget', 'one-action', 'a11y']);

/* ---------------- platform checks ---------------- */
  // F1–F8: the per-area fit-and-finish reports (4 Nov). Each area keeps its own checks in evals/finish/*.cjs.
async function finishChecks(add) {
  {
    const open = async (w, h, who, route, touch) => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch && w < 800 });
      const r = await c.newPage();
      await r.goto(url('/')); if (who) await r.evaluate((v) => localStorage.setItem('goals-app-viewer:example', v), who);
      await r.goto(url(route)); await r.waitForTimeout(400);
      return [c, r];
    };
    const pick = (process.env.FINISH || '').split(',').filter(Boolean);
    // finish/: the fit-and-finish areas; notes/: Lane's review notes (5 Nov). Each module names its requirements.
    for (const f of ['finish', 'notes'].flatMap((d) => fs.readdirSync(path.join(__dirname, d)).filter((x) => x.endsWith('.cjs')).sort().map((x) => path.join(__dirname, d, x)))) {
      const m = require(f);
      if (pick.length && !pick.includes(m.id)) continue;
      let fails;
      try { fails = await m.run({ open, url, browser }); } catch (e) { fails = [`check crashed: ${String(e.message || e).split('\n')[0]}`]; }
      add(m.id, m.reqs ?? ['FIT-AND-FINISH-AREAS'], m.title ?? `Fit and finish, ${m.area}`, !fails.length, fails.slice(0, 8).join(' | '));
    }
  }
}

async function platformChecks() {
  if (process.env.FINISH) { const out = []; await finishChecks((id, reqs, title, pass, error) => out.push({ id, reqs, title, pass, error: pass ? undefined : error })); return out; }
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
    for (const [who, route] of [['maya', '/'], ['elena', '/'], ['priya', '/'], ['tom', '/'], ['maya', '/goals'], ['elena', '/goals'], ['maya', '/goals/head'], ['maya', '/goals/access'], ['maya', '/activity'], ['maya', '/data'], ['priya', '/data?t=checkIns'], ['maya', '/workspace'], ['elena', '/reviews'], ['elena', '/reviews/weekly'], ['leo', '/reviews/new'], ['maya', '/watching'], ['tom', '/watching'], ['leo', '/watching'], ['maya', '/goals?show=levels'], ['leo', '/check-in'], ['sam', '/goals/lead/edit'], ['sam', '/goals/new'], ['priya', '/workspace/new']]) {
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
      // Every status shape on screen has its word beside it (the history grid's compact cells have a key instead).
      const mute = await r.$$eval('svg.status-shape', (els) => els.filter((e) => {
        if (!e.getClientRects().length || e.closest('.hgrid, [aria-hidden="true"] [aria-hidden="true"]')) return false;
        const near = (e.parentElement?.innerText || '') + ' ' + (e.parentElement?.parentElement?.innerText || '');
        return !/on track|at risk|off track|stale|done|not started|no check-in|met|missed|completed|gone quiet|no recent update|nothing is|late|on schedule/i.test(near);
      }).map((e) => (e.closest('[class]')?.className || '').toString().split(' ')[0]));
      if (mute.length) problems.push(`${who} ${route}: ${mute.length} status shapes without a word (${[...new Set(mute)].join(', ')})`);
    }
    add(device === 'phone' ? 'P3' : 'P4', device === 'phone' ? ['PHONE', 'A11Y'] : ['A11Y'], `Every screen on ${device}: no sideways scroll, no serious accessibility issues, status as shape plus word`, !problems.length, problems.slice(0, 5).join(' | '));
    await c3.close();
  }
  // P6: the design rules (docs/design-rules.md), on every screen and every Goals layout, at phone and desktop width.
  const design = [];
  for (const [device, vp] of Object.entries(DEVICES)) {
    const c4 = await browser.newContext({ viewport: vp });
    const r = await c4.newPage();
    for (const [who, route] of [['maya', '/'], ['elena', '/'], ['maya', '/goals'], ['maya', '/goals?view=table'], ['maya', '/goals?view=board'], ['maya', '/goals?view=history'], ['maya', '/goals?view=cards'], ['maya', '/goals?view=map'],
      ['maya', '/goals/head'], ['maya', '/goals/access'], ['elena', '/reviews/weekly'], ['maya', '/watching'], ['kofi', '/quick-check-in'], ['kofi', '/import'], ['maya', '/activity'], ['priya', '/data'], ['priya', '/workspace'], ['leo', '/check-in'], ['sam', '/goals/lead/edit'], ['maya', '/retro']]) {
      await r.goto(url(route));
      await r.evaluate((w) => localStorage.setItem('goals-app-viewer:example', w), who);
      await r.reload();
      await r.waitForTimeout(route.includes('map') ? 700 : 250);
      const found = await r.evaluate(() => {
        const out = [];
        const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          // Lines themselves (dividers, legend samples) and SVG internals are not boxes.
          if (b.width <= 4 || b.height <= 4 || el.closest('svg')) continue;
          const cs = getComputedStyle(el);
          const sides = ['Top', 'Right', 'Bottom', 'Left'].map((k) => ({ w: parseFloat(cs['border' + k + 'Width']) || 0, c: cs['border' + k + 'Color'], st: cs['border' + k + 'Style'] })).filter((x) => x.w > 0 && x.st !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(x.c));
          const thick = sides.filter((x) => x.w >= 2);
          if (thick.length && sides.length < 4) out.push(name(el) + ': a coloured edge on one side');
          else if (sides.length === 4 && (new Set(sides.map((x) => x.c)).size > 1 || new Set(sides.map((x) => x.w)).size > 1) && thick.length) out.push(name(el) + ': one edge unlike the others');
          if (/(^|, )[^,]*?([2-9]|\d{2})(\.\d+)?px 0px 0px 0px inset|0px ([2-9]|\d{2})px 0px 0px inset/.test(cs.boxShadow)) out.push(name(el) + ': an inset accent bar');
          if (/gradient/.test(cs.backgroundImage) && !el.closest('.skeleton')) out.push(name(el) + ': a gradient');
          if (parseFloat(cs.borderTopLeftRadius) >= 999 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && /result|status|state|badge/.test(String(el.className)) && !/^\s*\d+\s*$/.test(el.textContent || '')) out.push(name(el) + ': a capsule badge for a state');
          for (const pseudo of ['::before', '::after']) { const c = getComputedStyle(el, pseudo).content; if (/[⚠✓✗✔❌⭐🔥★✕↘‹›⌄−▾↩]/.test(c)) out.push(name(el) + pseudo + ': a glyph used as an icon'); }
        }
        if (/[⚠✓✗✔❌⭐🔥★✕↘‹›⌄−▾↩]/.test(document.body.innerText)) out.push('text: a glyph used as an icon');
        return [...new Set(out)];
      });
      found.forEach((x) => design.push(`${device} ${route}: ${x}`));
    }
    await c4.close();
  }
  add('P6', ['DESIGN-RULES'], 'Design rules on every screen: no coloured edges, accent bars, glyph icons, gradients or state capsules', !design.length, design.slice(0, 6).join(' | '));
  // P7: wide screens and a short laptop. Each kind of page uses the room it has: no clipped tables, portfolio views and
  // the map fill the work area, Home, a goal and Watching put their side column beside the main one, and on a 1440×700
  // laptop a goal's chart starts above the fold.
  const wide = [];
  for (const [w, hgt] of [[1920, 1080], [2560, 1300]]) {
    const c5 = await browser.newContext({ viewport: { width: w, height: hgt } });
    const r = await c5.newPage();
    for (const [who, route, kind] of [['elena', '/', 'split'], ['elena', '/goals?view=table', 'fill'], ['elena', '/goals?view=board', 'fill'], ['elena', '/goals?view=cards', 'fill'], ['elena', '/goals?view=map', 'map'], ['sam', '/goals/review', 'split'], ['tom', '/watching', 'split'], ['elena', '/activity', 'plain']]) {
      await r.goto(url(route));
      await r.evaluate((v) => localStorage.setItem('goals-app-viewer:example', v), who);
      await r.reload();
      await r.waitForTimeout(400);
      const m = await r.evaluate(() => {
        const side = document.querySelector('.side');
        const work = window.innerWidth - (side ? side.getBoundingClientRect().width : 0);
        const page = document.querySelector('.page')?.getBoundingClientRect();
        const clipped = [...document.querySelectorAll('.table-wrap')].filter((t) => t.scrollWidth > t.clientWidth + 1).length;
        const a = document.querySelector('.split > .split-a')?.getBoundingClientRect();
        const s = document.querySelector('.split > .split-side');
        const sr = s && s.getClientRects().length ? s.getBoundingClientRect() : null;
        const canvas = document.querySelector('.map-canvas')?.getBoundingClientRect();
        const nodes = [...document.querySelectorAll('.react-flow__node')].filter((n) => { const b = n.getBoundingClientRect(); return b.width > 100 && b.top >= 0 && b.bottom <= window.innerHeight; }).length;
        return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth, work, pageW: page?.width ?? 0, pageL: page ? page.left - (side ? side.getBoundingClientRect().right : 0) : 0, clipped, sideBySide: !!(a && sr && sr.left >= a.right), hasSide: !!sr, canvasH: canvas?.height ?? 0, nodes };
      });
      const at = `${w}px ${route}`;
      if (m.sideways > 1) wide.push(`${at}: ${m.sideways}px sideways`);
      if (m.clipped) wide.push(`${at}: ${m.clipped} table(s) clipped`);
      if (m.pageL > 140) wide.push(`${at}: content starts ${Math.round(m.pageL)}px from the sidebar`);
      if (kind === 'fill' && m.pageW < Math.min(1700, m.work * 0.85)) wide.push(`${at}: uses ${Math.round(m.pageW)} of ${Math.round(m.work)}px`);
      if (kind === 'split' && m.hasSide && !m.sideBySide) wide.push(`${at}: side column not beside the main one`);
      if (kind === 'map' && (m.canvasH < 600 || m.nodes < 6)) wide.push(`${at}: map ${Math.round(m.canvasH)}px tall with ${m.nodes} readable goals in view`);
    }
    await c5.close();
  }
  {
    const c6 = await browser.newContext({ viewport: { width: 1440, height: 700 } });
    const r = await c6.newPage();
    await r.goto(url('/goals/review'));
    await r.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'sam'));
    await r.reload();
    await r.locator('svg.chart').first().waitFor();
    const top = await r.locator('svg.chart').first().evaluate((e) => e.getBoundingClientRect().top);
    if (top > 640) wide.push(`1440×700 /goals/review: the chart starts at ${Math.round(top)}px, below the fold`);
    await c6.close();
  }
  // P8: the goals start in the first screen. The Goals header (views, layout, search, filters) mustn't push them down.
  const fold = [];
  for (const [device, vp] of Object.entries(DEVICES)) {
    const c7 = await browser.newContext({ viewport: vp });
    const r = await c7.newPage();
    for (const v of ['list', 'table', 'board']) {
      await r.goto(url('/goals?view=' + v));
      await r.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'maya'));
      await r.reload();
      await r.locator('.outcome, .gtable tbody tr, .board-card').first().waitFor();
      const top = await r.evaluate(() => document.querySelector('.outcome, .gtable tbody tr, .board-card').getBoundingClientRect().top);
      const limit = vp.height * (device === 'phone' ? 0.5 : 0.4);
      if (top > limit) fold.push(`${device} ${v}: the first goal starts at ${Math.round(top)}px (limit ${Math.round(limit)})`);
    }
    await c7.close();
  }
  // P9: every width in between (the reviewers couldn't resize their browsers). A small phone, a tablet both ways, a
  // laptop and an ultra-wide monitor: no sideways scroll, nothing cut off at the edge, navigation always there, and
  // prose never stretched across a wide screen.
  const widths = [];
  for (const [w, hgt] of [[360, 740], [768, 1024], [1024, 768], [1280, 800], [3440, 1440]]) {
    const c8 = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: w <= 1024 });
    const r = await c8.newPage();
    for (const [who, route] of [['maya', '/'], ['elena', '/'], ['elena', '/goals'], ['elena', '/goals?view=table'], ['elena', '/goals?view=history'], ['elena', '/goals?view=history&hist=weekly&weeks=year'], ['elena', '/goals?view=board'],
      ['maya', '/goals/head'], ['kofi', '/check-in/alerts'], ['elena', '/reviews/weekly'], ['tom', '/watching'], ['elena', '/activity'], ['priya', '/data'], ['priya', '/workspace']]) {
      await r.goto(url(route));
      await r.evaluate((v) => localStorage.setItem('goals-app-viewer:example', v), who);
      await r.reload();
      await r.waitForTimeout(300);
      const m = await r.evaluate(() => {
        const W = window.innerWidth;
        // Past the edge of what holds it: the screen, or a container that clips. Inside one that scrolls, you can reach it.
        const holder = (el) => { for (let x = el.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll') return 'scrolls'; if (o === 'hidden' || o === 'clip') return x; } return null; };
        const cutBy = (el) => { const h = holder(el); if (h === 'scrolls') return false; const b = el.getBoundingClientRect(); const box = h ? h.getBoundingClientRect() : { left: 0, right: W }; return b.right > Math.min(W, box.right) + 1 || b.left < Math.max(0, box.left) - 1; };
        const seen = (el) => { const st = getComputedStyle(el); return el.getClientRects().length > 0 && st.visibility !== 'hidden' && !el.closest('[aria-hidden="true"], .sr'); };
        const cut = [...document.querySelectorAll('button, a, input, select, textarea, h1, h2, h3, p, .chip, th, td')].filter((el) => seen(el) && getComputedStyle(el).textOverflow !== 'ellipsis' && cutBy(el))
          .map((el) => el.tagName.toLowerCase() + ' “' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24) + '”');
        const nav = [...document.querySelectorAll('.side, .tabbar')].some((n) => n.getClientRects().length && getComputedStyle(n).display !== 'none');
        const wideProse = [...document.querySelectorAll('main p, .page p')].filter((el) => seen(el) && el.getBoundingClientRect().width > 960 && (el.textContent || '').length > 120).length;
        return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth, cut: [...new Set(cut)].slice(0, 3), nav, wideProse };
      });
      const at = `${w}px ${who} ${route}`;
      if (m.sideways > 1) widths.push(`${at}: ${m.sideways}px sideways`);
      if (m.cut.length) widths.push(`${at}: cut off at the edge: ${m.cut.join(', ')}`);
      if (!m.nav && !route.startsWith('/check-in')) widths.push(`${at}: no navigation`);
      if (m.wideProse) widths.push(`${at}: ${m.wideProse} paragraph(s) wider than 960px`);
    }
    await c8.close();
  }
  add('P9', ['EVERY-WIDTH'], 'Every width from a small phone to an ultra-wide monitor: no sideways scroll, nothing cut off, navigation always there, prose a readable width', !widths.length, widths.slice(0, 8).join(' | '));
  // P10: fit and finish (review of 4 Nov), re-measured: text follows the browser's size, one control height, phone
  // rows and toolbars that stack, a usable rail, no sideways scroll in a review, and one left edge for every layout.
  const finish = [];
  {
    const at = async (w, h, who, path, touch) => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch });
      const r = await c.newPage();
      await r.goto(url('/')); await r.evaluate((v) => localStorage.setItem('goals-app-viewer:example', v), who);
      await r.goto(url(path)); await r.waitForTimeout(400);
      return [c, r];
    };
    let [c, r] = await at(1280, 800, 'elena', '/activity');
    const sizes = await r.evaluate(() => { const b = parseFloat(getComputedStyle(document.body).fontSize); document.documentElement.style.fontSize = '24px'; return [b, parseFloat(getComputedStyle(document.body).fontSize)]; });
    if (!(sizes[1] > sizes[0] * 1.4)) finish.push(`text does not follow the browser's size: ${sizes.join(' → ')}px`);
    await r.evaluate(() => { document.documentElement.style.fontSize = ''; });
    const hs = await r.evaluate(() => [...new Set([...document.querySelectorAll('.page .btn:not(.sm):not(.big-btn), .page .input:not(textarea)')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)))]);
    if (hs.length > 1) finish.push(`Activity controls come in ${hs.join(', ')}px`);
    await c.close();
    [c, r] = await at(360, 740, 'elena', '/goals?view=table', true);
    const gw = await r.evaluate(() => Math.min(...[...document.querySelectorAll('.gtable td.gt-goal')].map((t) => t.getBoundingClientRect().width)));
    if (gw < 200) finish.push(`360px Goals table: a goal name gets ${Math.round(gw)}px`);
    await r.goto(url('/data')); await r.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'priya')); await r.reload(); await r.waitForTimeout(400);
    const sw = await r.evaluate(() => document.querySelector('.filter-search .input')?.getBoundingClientRect().width ?? 0);
    if (sw < 280) finish.push(`360px Data search is ${Math.round(sw)}px wide`);
    await c.close();
    [c, r] = await at(1024, 768, 'elena', '/reviews/weekly', true);
    const go = r.getByRole('link', { name: /Start|Continue|Open/ }).first(); if (await go.count()) { await go.click(); await r.waitForTimeout(500); }
    const rv = await r.evaluate(() => { const d = document.querySelector('.side .demo-entry')?.getBoundingClientRect(); return { side: document.documentElement.scrollWidth - innerWidth, demo: d ? [Math.round(d.width), Math.round(d.height)] : null, titles: [...document.querySelectorAll('.side .nav')].filter((n) => !n.getAttribute('title')).length }; });
    if (rv.side > 1) finish.push(`1024px review scrolls sideways by ${rv.side}px`);
    if (!rv.demo || rv.demo[0] > 48 || rv.demo[1] < 44) finish.push(`1024px rail Demo box is ${rv.demo}`);
    if (rv.titles) finish.push(`${rv.titles} rail icons have no name on hover`);
    await c.close();
    [c, r] = await at(1440, 700, 'elena', '/goals');
    const lx = await r.evaluate(() => Math.round(document.querySelector('.goals-head h1').getBoundingClientRect().left));
    await r.goto(url('/goals?view=table')); await r.waitForTimeout(400);
    const tx = await r.evaluate(() => Math.round(document.querySelector('.goals-head h1').getBoundingClientRect().left));
    if (lx !== tx) finish.push(`Goals moves ${Math.abs(lx - tx)}px between List and Table`);
    await c.close();
  }
  add('P10', ['FIT-AND-FINISH'], 'Fit and finish: text follows the browser’s size, one control height, phone tables and toolbars that stack, a usable rail, no sideways scroll, one left edge', !finish.length, finish.join(' | '));
  await finishChecks(add);
  add('P8', ['WIDE-SCREENS', 'PHONE'], 'The goals start in the first screen: the Goals header stays short on a phone and a desktop', !fold.length, fold.join(' | '));
  add('P7', ['WIDE-SCREENS'], 'Wide screens and a short laptop: nothing clipped, each kind of page uses the room it has, and a goal’s chart is above the fold', !wide.length, wide.slice(0, 6).join(' | '));
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
  const platform = only.length && !only.includes('PLATFORM') ? [] : await platformChecks();
  platform.forEach((x) => console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} ${x.title}${x.pass ? '' : '\n     ' + x.error}`));
  platform.push({ id: 'P5', reqs: ['NO-ERRORS'], title: 'No console or page errors across every journey', pass: consoleErrors.length === 0, error: consoleErrors.slice(0, 4).join(' | ') || undefined });
  console.log(`${consoleErrors.length ? 'FAIL' : 'PASS'} P5 No console or page errors${consoleErrors.length ? '\n     ' + consoleErrors.slice(0, 4).join('\n     ') : ''}`);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'journeys.json'), JSON.stringify({ journeys, platform }, null, 2));
  process.exit(journeys.every((r) => r.pass) && platform.every((x) => x.pass) ? 0 : 1);
})();

