/* User-journey evals: drive the built app in Chromium as each profile would, on a phone and a desktop,
   and score every journey against the 10-point ease-of-use test in requirements.json.
   Usage: BASE=http://localhost:4318 [DOWN=http://localhost:4319] node evals/journeys.cjs
   ONLY=U1,U2[,PLATFORM]  run just these journeys (PLATFORM: and the platform checks)
   CHECKS=P6,F3           run just these platform checks (and no others)
   FINISH=F1,N3           run just these per-area modules (and no journeys, unless ONLY names some)
   SHARD=k/n              run shard k of n: journeys by position, platform checks as evals/shards.cjs places them; writes
                          out/journeys-k.json (P5 is left to the merge, which has every shard's console errors) */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4318';
const DOWN = process.env.DOWN || '';
const SHARD = (/^(\d+)\/(\d+)$/.exec(process.env.SHARD || '') || []).slice(1).map(Number);
const secs = {}; // seconds each platform check took
let shardPlan = null; // set once the journeys are registered
const picked = (process.env.CHECKS || '').split(',').filter(Boolean);
/** Does this platform check run here? Not in another shard, and not when CHECKS names others. */
const want = (id) => (!picked.length || picked.includes(id)) && (!shardPlan || shardPlan.checks.includes(id));
const TODAY = '2026-11-05'; // Thursday of week 45 in the example, before the leadership weekly at 14:00
const OUT = path.join(__dirname, 'out');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const DEVICES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const CRITERIA = ['entry', 'one-action', 'progress', 'budget', 'errors', 'finish', 'attention', 'parity', 'a11y', 'logged'];

/** The demo: the example data in this browser, with the role switcher. */
const url = (p) => BASE + '/demo' + p + (p.includes('?') ? '&' : '?') + 'today=' + TODAY;
/** The real app, with its data kept in this browser (the eval build has no Supabase). */
const live = (p) => BASE + p + (p.includes('?') ? '&' : '?') + 'store=browser&today=' + TODAY;
const consoleErrors = [];
/* The demo follows the calendar: on Thursday 5 November 2026 it is in ISO week 45 of 2026, a 53-week year. The
   Platform Engineering example is written for week 45 (src/data/platformOrg). W(storyWeek) is the old seven-week
   story's mapping, kept until every journey is rewritten for the new example. */
const NOW = 45;
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
      // Let entrance motion finish first (the goal page's story runs up to 4s): an element caught mid-fade isn't its real contrast.
      await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))), new Promise((res) => setTimeout(res, 5000))]));
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
      // Wait for it to be drawn first: read straight away, a page still settling (a slow machine, the shards side by
      // side) has no box for it yet, which read as "below the fold" (U14 on 7 Nov).
      await first.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
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
    /** The workspace as the app has it now. The demo keeps only its saves on top of the rebuilt example (DEMO-STORAGE),
        so it's read through the store the page exposes, not from localStorage. */
    async snapshot(ws = 'platform-org') {
      return p.evaluate((w) => window.__goalsStore.load(w).catch(() => null), ws);
    },
  };
}

async function newPage(device, viewer) {
  const ctx = await browser.newContext({ viewport: DEVICES[device] });
  if (viewer) await ctx.addInitScript((v) => { if (!sessionStorage.getItem('viewer-set')) { localStorage.setItem('goals-app-viewer:platform-org', v); sessionStorage.setItem('viewer-set', '1'); } }, viewer);
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

/** The goal page's "…" menu (the flagship page, 5 Nov): Share image, Copy link, Print, Check in again, Change this goal. */
const goalMenu = async (h, p, item) => {
  await h.click(p.locator('.goal-bar summary[aria-label="More about this goal"]').first());
  await h.click(p.getByRole('group', { name: 'More about this goal' }).getByRole(item === 'Print or save as PDF' || /^Check in/.test(item) ? 'link' : 'button', { name: item }));
};

const navTo = async (h, p, label) => {
  // Wait for the app's navigation first. Right after p.goto a slow machine can still be showing "Loading goals…", and
  // the instant visibility checks below would then take the phone's way (the tab bar's More) on a desktop, where it
  // never appears (U8 timed out on the CI runners that way).
  await p.locator('.side:visible, .tabbar:visible').first().waitFor();
  const side = p.locator('.side').getByRole('link', { name: label });
  if (await side.isVisible().catch(() => false)) return h.click(side);
  const tab = p.locator('.tabbar').getByRole('link', { name: label });
  if (await tab.isVisible().catch(() => false)) return h.click(tab);
  await h.click(p.locator('.tabbar').getByRole('button', { name: 'More' }));
  await h.click(p.getByRole('dialog').getByRole('link', { name: label }));
};

/** Status shapes whose words disagree with them (SHAPE-MATCHES-WORD): the shape says one status and the words nearest it
    (its own slot, or the nearest box around it with any text) don't name it, such as the At risk half-circle beside
    "Getting worse" on a goal that is on track. The app's own rule decides (vocabulary.ts shapeAgrees, which the page
    exposes); the history grid's compact cells have a key instead. */
const shapeMismatches = (p) => p.$$eval('svg.status-shape[data-status]', (els) => {
  const near = (e) => { let box = e.parentElement; while (box && !box.innerText.trim()) box = box.parentElement; return box ? box.innerText : ''; };
  if (typeof window.__shapeAgrees !== 'function') return ['the page does not expose the shape rule (window.__shapeAgrees)'];
  return els.filter((e) => e.getClientRects().length && !e.closest('.hgrid') && !window.__shapeAgrees(e.dataset.status, near(e)))
    .map((e) => `the ${e.dataset.status} shape beside “${near(e).replace(/\s+/g, ' ').trim().slice(0, 60)}”`);
});

/* ---------------- the ten journeys ---------------- */
const J = [];
const journey = (id, reqs, title, budget, fn, na = []) => J.push({ id, reqs, title, budget, fn, na });

journey('U1', ['UPDATE-ANYTIME', 'CARRY-OVER', 'CHECKIN-STATUS-VS-PLAN', 'REASON-BEHIND', 'PATH-TO-GREEN', 'ONE-PER-WEEK', 'CHANGE-LOG', 'DRAFTS', 'PROFILES', 'PERSIST'], 'Weekly check-in, all due goals in one pass', 17, async (h, device) => {
  // Rhea: two goals due. Image slimming is on plan (number, post, next: three interactions); the new CI cost goal comes
  // in a cent better than its plan (0.40 against 0.41, well ahead of a small first step), so it asks why, and she says.
  let p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/'));
  await see(p, '2 check-ins to do');
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await h.checkpoint('home');
  await h.click(p.getByRole('link', { name: /Start check-in/ }));
  await h.progressShown('check-in');
  const s0 = await h.snapshot();
  const g0 = (id) => s0.goals.find((g) => g.id === id);
  const reviewV = String(Math.round(planAt(g0('ci-docker').plan, NOW)) - 2); // lower is better: two minutes under plan
  await h.fill(p.getByLabel('This week’s value'), reviewV);
  // The gap in the words every list uses, whichever way is better; the line under it names the week it compares with.
  await see(p, 'ahead of plan', 'the verdict says how it stands against the plan');
  await see(p, `planned for week ${NOW}`, 'the verdict names the week it compares with');
  await h.checkpoint('first goal');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  await h.checkpoint('posted');
  await h.click(p.getByRole('button', { name: /Next: / }));
  // Leave mid-way and come back: the typed value is restored.
  const leadV = '0.40';
  await p.getByLabel('This week’s value').fill(leadV);
  await p.goto(url('/'));
  await see(p, 'Pick up where you left off', 'a draft is offered back on home');
  await p.getByRole('link', { name: /Pick up where you left off/ }).click();
  const restored = await p.getByLabel('This week’s value').inputValue();
  if (restored !== leadV) fail('the draft value was not restored');
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await h.click(p.getByRole('button', { name: 'Change landed early' }));
  await h.fill(p.getByLabel('What happened'), 'The runner budget came through a week early.');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  // The last post is the only confirmation: what was saved, that the week is done, and a way on.
  await see(p, `checked in for week ${NOW}`, 'the last post says the week is done');
  h.set('finish', await p.getByRole('link', { name: 'Back to home' }).isVisible() && await p.getByRole('link', { name: 'View the goal' }).isVisible(), 'no way on from the confirmation');
  await h.checkpoint('done');
  let s = await h.snapshot();
  const before = new Set(s0.changes.map((c) => c.id));
  const posts = s.changes.filter((c) => !before.has(c.id) && c.actorId === 'rhea' && c.action === 'posted' && new RegExp(`week ${NOW}:`).test(c.summary));
  h.set('logged', posts.length === 2 && posts.every((c) => c.diffs.some((d) => d.field === 'Value')), `expected two logged week-${NOW} posts by Rhea, saw ${posts.length}`);
  await p.goto(url('/'));
  await p.reload();
  // Rhea is in no review this week (hers is on Tuesday), so Home says the week is done rather than moving on to a review.
  await see(p, /You’re all set for week/, 'posted check-ins survive a reload, and home says the week is done');
  // An ad hoc check-in, any time, from the goal page: kept alongside the first, and the latest is the week's status.
  await p.goto(url('/goals/ci-docker'));
  // Checked in already: the owner's check-in is no longer the page's main action; "Check in again" is in the "…" menu.
  await goalMenu(h, p, 'Check in again');
  await see(p, `You checked in for week ${NOW} already`, 'a second check-in says it is kept alongside the first');
  const reviewV2 = String(Number(reviewV) + 1);
  await h.fill(p.getByLabel('This week’s value'), reviewV2);
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Kept alongside your earlier check-in this week');
  s = await h.snapshot();
  const again = s.changes.filter((c) => c.actorId === 'rhea' && c.goalId === 'ci-docker' && c.action === 'posted').pop();
  const weekCis = s.checkIns.filter((c) => c.goalId === 'ci-docker' && c.week === NOW);
  h.set('logged', !!again && new RegExp(`Checked in again for week ${NOW}`).test(again.summary) && weekCis.length === 2 && weekCis.some((c) => c.value === Number(reviewV)) && weekCis.some((c) => c.value === Number(reviewV2)), 'the ad hoc check-in is not kept alongside the first, or not logged');
  await p.context().close();

  // Rhea again, on the north star that is behind plan (a fresh browser, so her week is still open). One question per
  // screen: the number, then last week's note offered back. "Still true" carries it over and posts; an empty number is
  // explained in place.
  p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/check-in/ns-lead'));
  await p.locator('.focus-foot button[type=submit]').click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Type this week’s number' }).isVisible(), 'an empty number says nothing');
  const sm = await h.snapshot();
  await h.fill(p.getByLabel('This week’s value'), valueAt(sm.goals.find((g) => g.id === 'ns-lead'), NOW, 0.5));
  h.set('attention', await p.locator('.verdict[data-tone=off]').isVisible(), 'behind plan is not flagged in the verdict');
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await see(p, 'Is what you said last week still true?', 'last week’s reason and path are offered back');
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
  const c = s.changes.filter((x) => x.actorId === 'rhea' && x.action === 'posted').pop();
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Path to green') && c.diffs.some((d) => /Merge queue/.test(d.to)), 'Rhea’s carried-over reason and path are not in the log');
  await p.context().close();
});

journey('U2', ['ATTENTION', 'PROFILES', 'STALE'], 'What needs me? Home shows what’s due, off track, stale or slipping', 1, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/'));
  // Lane's notes (5 Nov): Home shows "Your goals" (what needs attention, what's being handled) and "Goals you watch".
  await see(p, 'Your goals');
  await see(p, 'Need attention');
  await see(p, 'Watching', 'home also shows the goals Rhea watches');
  await h.checkpoint('home');
  h.set('progress', await p.locator('.hero .ring').isVisible(), 'no weekly progress ring');
  const cards = p.locator('.arow');
  if ((await cards.count()) < 1) fail('expected an attention card for Rhea’s own goals');
  const reasons = await cards.locator('.arow-why').allInnerTexts();
  h.set('attention', reasons.every((r) => r.trim().length > 20) && await p.locator('.arow[data-tone=risk] .arow-icon, .arow[data-tone=off] .arow-icon').count() > 0, 'attention rows lack a reason or a status icon');
  // The first goal that needs attention starts on the first screen: its shape and title, with what needs your response
  // above it (Lane, 5 Nov). Its reason is two lines on Home, and in full on the goal's page.
  const top = await cards.first().evaluate((el) => {
    const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
    const t = el.querySelector('.arow-title')?.getBoundingClientRect();
    return { y: el.getBoundingClientRect().top, title: t ? t.bottom : null, fold: bar ? bar.getBoundingClientRect().top : innerHeight };
  });
  h.set('entry', top.y >= 0 && top.title != null && top.title <= top.fold - 8, `the first attention card's title ends at ${Math.round(top.title ?? -1)}px, fold ${Math.round(top.fold)}px`);
  await see(p, 'late', 'an overdue check-in is called late');
  // The north star is being handled (Amara looked at it in last week's review), so the first card is a goal already
  // checked in; the week's check-in is the hero's one action.
  await h.click(p.locator('.home-hero').getByRole('link', { name: /Start check-in|Pick up where you left off/ }));
  await see(p, 'What’s the number this week?');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U3', ['REVIEW', 'INSPECT-ACT', 'OUTCOME-TREE', 'ATTENTION', 'CHANGE-LOG', 'REVIEW-RUN', 'ONE-ASK'], 'Weekly review: walk the goals worst first and record what was said', 18, async (h, device) => {
  // Marisol runs the Reliability weekly, already under way this Thursday (nine goals reviewed). One ask model: a
  // question she asks in it is an ask, open on the owner's Home and goal page until they answer it.
  const p = h.use(await newPage(device, 'marisol'));
  // The goals view opens on the trees: each top goal with its forecast, then what feeds it, worst first.
  await p.goto(url('/goals'));
  await p.locator('.outcome-card').first().waitFor();
  const cards = await p.locator('.outcome-card').count();
  const firstRow = p.locator('.outcome').first().locator('.trow').first();
  h.set('attention', cards >= 2 && await p.getByText(/Projected/).first().isVisible() && ['off', 'risk', 'stale'].includes(await firstRow.getAttribute('data-tone')) && (await firstRow.locator('.trow-why').innerText()).length > 15,
    'the tree does not lead with the worst goal and its reason');
  const s0 = await h.snapshot();
  // Reviews lists the sessions she's in, one under way first; the Reliability weekly picks up where it was left.
  await p.goto(url('/'));
  await see(p, 'goals to discuss');
  await h.checkpoint('home');
  await navTo(h, p, 'Reviews');
  const line = p.getByRole('link', { name: /Reliability weekly/ }).first();
  await h.inView(line, 'entry', 'the Reliability weekly on Reviews');
  await h.click(line);
  await p.locator('.review-home').waitFor();
  await h.progressShown('review home');
  await h.click(p.getByRole('button', { name: /^Continue review/ }));
  // The review walks the goal pages themselves, one at a time, with what to say at the bottom.
  await p.locator('.reviewbar').waitFor();
  await h.progressShown('review walk');
  let items = 0, asked = null;
  while (items < 14 && /review=reliability/.test(p.url())) {
    await p.locator('.decide').waitFor();
    h.set('attention', await p.locator('.goal-bar .bar-status').isVisible(), 'a goal in the review has no status');
    if (items < 2) await h.checkpoint('item ' + (items + 1));
    const here = p.url();
    const reviewedNext = p.locator('.decide').getByRole('button', { name: /^Reviewed & / });
    const askOwner = p.locator('.decide .quiet-links').getByRole('button', { name: /^Ask / });
    if (!asked && await askOwner.isVisible().catch(() => false)) {
      // Ask the owner in a composer that names the goal; an empty question is refused; saving stays on the goal.
      const title = (await p.locator('h1').first().innerText()).trim();
      await h.click(askOwner);
      h.set('attention', ((await p.getByRole('dialog').getAttribute('aria-label')) || '').includes(title), 'the composer does not name the goal');
      await p.getByRole('button', { name: 'Save question' }).click();
      h.set('errors', await p.getByRole('alert').filter({ hasText: 'Write a few words' }).isVisible(), 'asking without a question is not caught');
      await h.fill(p.getByPlaceholder(/What would it take/), 'Can this be back on plan before the next incident review?');
      await h.click(p.getByRole('button', { name: 'Save question' }));
      await p.locator('.said').getByText('Can this be back on plan').waitFor();
      h.set('finish', p.url() === here, 'saving a question moved to another goal');
      asked = here;
      await h.checkpoint('saved question');
      await h.click(reviewedNext);
    } else if (items === 2) {
      await h.click(p.getByRole('button', { name: 'Add a note' }));
      await h.fill(p.getByPlaceholder('What the review said'), 'Agreed to pair SRE and Observability on the burn-rate alerts.');
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
  await see(p, 'Nothing flagged', 'healthy goals are not grouped after the exceptions');
  const ack = p.getByRole('button', { name: /^Mark \d+ goals? with nothing flagged reviewed/ });
  const healthyN = Number(((await ack.innerText().catch(() => '')).match(/\d+/) || ['0'])[0]);
  h.set('finish', healthyN > 0 && items <= 10, `expected the healthy goals as one acknowledgement, saw ${healthyN} after walking ${items}`);
  await h.checkpoint('healthy group');
  await h.click(ack);
  await see(p, 'What was said', 'the held review leads with its record');
  await see(p, 'Can this be back on plan', 'what was said is kept on the review');
  h.set('finish', await p.getByRole('link', { name: 'Reviews' }).first().isVisible(), 'no way on from the review record');
  const s = await h.snapshot();
  const before = new Set(s0.changes.map((c) => c.id));
  const calls = s.changes.filter((c) => !before.has(c.id) && c.actorId === 'marisol' && c.entity === 'decision');
  // The question is an ask: one record, open, for the goal's owner, raised in this session.
  const q = (s.requests || []).find((r) => r.kind === 'question' && /back on plan before the next incident review/.test(r.ask));
  const qLog = s.changes.find((c) => !before.has(c.id) && c.entity === 'request' && c.action === 'asked' && c.entityId === (q && q.id));
  h.set('logged', calls.length === items + healthyN + 1 && !!q && q.status === 'open' && q.reviewId === 'reliability' && !!qLog, `expected ${items + healthyN} reviews and a note logged, and the question as an open ask, saw ${calls.length}${q ? '' : ', no question'}`);
  // The owner sees the question under "Asked of you" on the goal, and on Home; everyone else in the goal's action list.
  const goalId = q.goalIds[0];
  await p.goto(url('/goals/' + goalId));
  await see(p, 'Can this be back on plan', 'the question is not on the goal for everyone');
  await p.evaluate((v) => localStorage.setItem('goals-app-viewer:platform-org', v), q.recipientId);
  await p.goto(url('/goals/' + goalId));
  await see(p, 'Question from Marisol in Reliability weekly', 'the owner sees the question on the goal');
  await p.goto(url('/'));
  await see(p, 'Questions for you', 'the owner’s Home groups the question with the other questions');
  await see(p, 'Can this be back on plan', 'the owner’s Home shows the question');
  await p.context().close();
});

journey('U4', ['GOAL-CREATE', 'PLAN-SHAPE', 'HIERARCHY', 'LEVELS', 'CHANGE-LOG', 'DRAFTS'], 'Set up a goal, step by step', 13, async (h, device) => {
  const p = h.use(await newPage(device, 'mateo'));
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
  await p.getByLabel('Feeds into').selectOption('ns-mttr');
  await h.click(p.getByRole('button', { name: 'SVP' }));
  await h.checkpoint('step 3');
  await h.click(p.getByRole('button', { name: /Continue/ }));
  await see(p, 'Does this read right?');
  await see(p, 'Mean time to restore service', 'the summary says what it feeds');
  await see(p, 'SVP level', 'the summary says its level');
  await h.checkpoint('step 4');
  await h.click(p.getByRole('button', { name: 'Publish goal' }));
  await p.waitForURL(/\/goals\/goal_/);
  await see(p, 'MTTR for P1 incidents');
  h.set('finish', await p.getByText(/Published/).isVisible().catch(() => false) || await p.getByRole('link', { name: /Check in/ }).isVisible(), 'publishing is not confirmed');
  const s = await h.snapshot();
  const c = s.changes.filter((x) => x.action === 'created' && x.actorId === 'mateo').pop();
  h.set('logged', !!c && c.diffs.some((d) => d.field === 'Target' && d.to === '45 min') && c.diffs.some((d) => d.field === 'Plan shape' && d.to === 'Back-loaded') && c.diffs.some((d) => d.field === 'Level' && d.to === 'SVP'), 'the new goal is not logged with its fields and level');
  await p.context().close();
}, ['attention']);

journey('U5', ['WORKSPACES', 'ONBOARDING', 'CHANGE-LOG', 'ADMIN'], 'Load your own data and switch between it and the example', 15, async (h, device) => {
  const p = h.use(await newPage(device, 'grace'));
  await p.goto(url('/'));
  await see(p, 'Try it with your own team');
  await h.inView(p.getByRole('link', { name: 'Set one up' }), 'entry', 'Set one up');
  await h.checkpoint('admin home');
  await h.click(p.getByRole('link', { name: 'Set one up' }));
  await p.locator('.steps').first().waitFor();
  await h.progressShown('set up');
  await h.fill(p.getByLabel('Name', { exact: true }), 'Platform Engineering');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.fill(p.getByLabel('Your name'), 'Grace Achterberg');
  await h.fill(p.getByLabel('Your team'), 'Leadership');
  await see(p, 'You’ll be this workspace’s admin');
  // An email tells people apart: a missing one is explained before going on.
  await p.getByRole('button', { name: 'Next' }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Add your email' }).isVisible(), 'a missing email is not explained');
  await h.fill(p.getByLabel('Your email'), 'grace.achterberg@example.com');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'Who else is on it?');
  // A second person with your name is explained on their row before anything is saved; a row with no team takes yours.
  await p.getByLabel('Person 1: name').fill('Grace Achterberg');
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
  await see(p, 'Grace', 'home now speaks to the new workspace’s admin');
  const wsId = await p.evaluate(() => localStorage.getItem('goals-app-workspace'));
  const s = await h.snapshot(wsId);
  h.set('logged', !!s && s.changes.some((c) => c.action === 'imported' && /5 people/.test(c.summary)), 'creating the workspace is not logged');
  // Switching workspace is in the person menu (review notes, 5 Nov), shown when there's more than one.
  await p.locator('.me:visible, .profilebtn:visible').first().click();
  await p.getByRole('dialog').getByRole('button', { name: /Example: Platform Engineering/ }).click();
  await see(p, 'Grace', 'switching back shows the example again');
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
  await h.fill(p.getByLabel('Your email'), 'rosa.lind@example.com');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await p.getByLabel('Person 1: name').fill('Omar Haddad');
  await p.getByLabel('Person 1: email').fill('omar.haddad@example.com');
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

journey('U49', ['ONBOARDING', 'WORKSPACES', 'REVIEWS', 'CALENDAR-WEEKS', 'DEMO-MODE'], 'Set up a small workspace on a Sunday, as the outside reviewer did: each field says what it needs, a team typo is caught, nothing is late, the weekly review exists, and Start over removes it all', 30, async (h, device) => {
  // The setup review of 8 Nov, replayed: Sunday 8 November is after week 45's Thursday review.
  const sunday = (x) => BASE + '/demo' + x + (x.includes('?') ? '&' : '?') + 'today=2026-11-08';
  const p = h.use(await newPage(device, 'grace'));
  await p.goto(sunday('/'));
  await see(p, 'Try it with your own team');
  await h.inView(p.getByRole('link', { name: 'Set one up' }), 'entry', 'Set one up');
  await h.click(p.getByRole('link', { name: 'Set one up' }));
  await p.locator('.steps').first().waitFor();
  await h.progressShown('set up');
  // One minimum name length for workspaces and goals, said under the field.
  await h.fill(p.getByLabel('Name', { exact: true }), 'Vo');
  await p.getByRole('button', { name: 'Next' }).click();
  const short = await p.getByRole('alert').filter({ hasText: 'at least three characters' }).isVisible();
  await see(p, 'The first is on Thursday 12 Nov', 'step 1 doesn’t say when the first review is');
  await h.fill(p.getByLabel('Name', { exact: true }), 'Voss Test Workspace');
  await h.click(p.getByRole('button', { name: 'Next' }));
  // Every empty field says what it needs, not only the first.
  await p.getByRole('button', { name: 'Next' }).click();
  const each = (await p.getByRole('alert').allInnerTexts()).join(' | ');
  h.set('errors', short && /Add your name/.test(each) && /Add your email/.test(each) && /Add your team/.test(each), `step 2 says: ${each}; a two-letter name ${short ? 'is' : 'is not'} explained`);
  await h.fill(p.getByLabel('Your name'), 'Ines Voss');
  await h.fill(p.getByLabel('Your team'), 'Support');
  await h.fill(p.getByLabel('Your email'), 'ines.voss@example.com');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'Who else is on it?');
  // Three more people: an empty Team takes yours; a typo of a team already typed is caught before it makes a second one.
  await p.getByLabel('Person 1: name').fill('Theo Brandt');
  await p.getByLabel('Person 1: email').fill('theo.brandt@example.com');
  await p.getByLabel('Person 2: name').fill('Mina Okafor');
  await p.getByLabel('Person 2: email').fill('mina.okafor@example.com');
  await p.getByLabel('Person 2: team').fill('Suport');
  await see(p, 'looks like Support', 'a team typo is not caught');
  await h.click(p.getByRole('button', { name: 'Use Support' }));
  if ((await p.getByLabel('Person 2: team').inputValue()) !== 'Support') fail('Use Support did not fix the typo');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await h.click(p.getByRole('radio', { name: /Start blank/ }));
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'What outcome are you after?');
  await p.getByRole('button', { name: 'Next' }).click();
  const outcomeSays = (await p.getByRole('alert').allInnerTexts()).join(' | ');
  if (!/Give the outcome a name/.test(outcomeSays) || !/Add today’s number/.test(outcomeSays) || !/Add the target/.test(outcomeSays)) fail('the outcome step doesn’t say what each field needs: ' + outcomeSays);
  await h.fill(p.getByLabel('Outcome', { exact: true }), 'Weekly active users');
  await p.getByLabel('Outcome: today').fill('1200');
  await p.getByLabel('Outcome: target').fill('2000');
  await p.getByLabel('Outcome: unit').fill('users');
  // How it's measured is asked in the open, and optional.
  await p.getByLabel('Outcome: how it’s measured').fill('People who used it at least once in the week');
  await h.click(p.getByRole('button', { name: 'Next' }));
  await see(p, 'What feeds it?');
  const goals = [['Support response time', '8', '4', 'hours'], ['Customer interviews', '0', '12', 'interviews'], ['Build time', '10', '6', 'min']];
  for (let i = 0; i < goals.length; i++) {
    if (i > 0) await p.getByRole('button', { name: 'Add a goal' }).click();
    const [t, a, b, u] = goals[i];
    await p.getByLabel('Goal', { exact: true }).nth(i).fill(t);
    await p.getByLabel(t + ': today').fill(a);
    await p.getByLabel(t + ': target').fill(b);
    await p.getByLabel(t + ': unit').fill(u);
  }
  // Two to four: a fifth can't be added, and a removed card comes back with Undo.
  await p.getByRole('button', { name: 'Add a goal' }).click();
  const capped = await p.getByRole('button', { name: 'Add a goal' }).isDisabled() && await p.getByText('Four is the most here').isVisible();
  await p.getByRole('button', { name: 'Remove this goal' }).nth(3).click();
  await p.getByRole('button', { name: 'Remove this goal' }).nth(2).click();
  await p.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  const back = (await p.getByLabel('Goal', { exact: true }).nth(2).inputValue()) === 'Build time';
  h.set('attention', capped && back, `fifth goal ${capped ? 'refused with a reason' : 'not refused'}; Undo ${back ? 'brought Build time back' : 'did not bring the goal back'}`);
  await h.click(p.getByRole('button', { name: 'Next' }));
  // Check shows where each goal starts, the way it should move, and the weekly review it will make.
  await see(p, '10 min today → 6 min, lower is better', 'Check doesn’t show the start value');
  await see(p, 'Everyone, every goal, on Thursdays', 'Check doesn’t describe the weekly review');
  await h.checkpoint('check');
  await h.click(p.getByRole('button', { name: 'Create workspace' }));
  await see(p, 'Voss Test Workspace is ready');
  await see(p, 'Faro doesn’t send any email', 'Ready doesn’t say the invite is a link to send');
  const wsId = await p.evaluate(() => localStorage.getItem('goals-app-workspace'));
  const s = await h.snapshot(wsId);
  const review = s && s.reviews.find((r) => r.name === 'Weekly review');
  h.set('logged', !!review && review.people.length === 3 && review.scope.levels.length === 3 && review.weekday === 3 && s.changes.some((c) => c.entity === 'review' && c.action === 'created') && s.views.filter((v) => v.pinned).length === 3 && s.goals.find((g) => g.level === 'north-star')?.definition === 'People who used it at least once in the week', 'set-up didn’t save the weekly review, the pinned views and the outcome’s definition');
  // Born on time: nothing due or late on Home, the first review is next Thursday, and the pinned views are in the sidebar.
  await p.goto(sunday('/'));
  await see(p, 'Your first check-in is next week', 'Home doesn’t say the first check-in is next week');
  if (await p.getByText(/days? late/).count()) fail('a new workspace starts with something late');
  await see(p, 'Weekly review', 'Home has no next review');
  await p.goto(sunday('/reviews'));
  await see(p, 'Session Thu 12 Nov', 'the first review session is not next Thursday');
  // A goal page asks for how it's measured while it isn't said.
  const build = s.goals.find((g) => g.title === 'Build time');
  await p.goto(sunday('/goals/' + build.id));
  await see(p, 'How it’s measured isn’t described yet', 'the goal page doesn’t ask how it’s measured');
  // The Demo panel offers the walkthroughs (they open the example) and Start over, which removes the workspace and what the browser kept about it.
  await p.evaluate((w) => localStorage.setItem(`goals-app-draft:${w}:checkin:any:45`, '{"value":"7"}'), wsId);
  const panel = await demoPanel(p, h);
  const tours = await panel.getByRole('region', { name: 'Show me how' }).isVisible();
  await h.click(panel.getByRole('button', { name: /^Start over/ }));
  await h.click(panel.getByRole('button', { name: 'Yes, remove it' }));
  await see(p, 'Deleted Voss Test Workspace');
  const left = await p.evaluate((w) => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => k.includes(w)), wsId);
  const listed = await p.evaluate((w) => JSON.stringify(localStorage.getItem('goals-app-v2:workspaces') || '').includes(w), wsId);
  h.set('finish', tours && !left.length && !listed, `walkthroughs ${tours ? 'offered' : 'missing'}; left behind: ${left.join(', ') || 'nothing'}${listed ? '; still listed' : ''}`);
  await p.context().close();
}, ['budget']);

journey('U12', ['DEMO-MODE'], 'Demo: switch person, look around, start over', 4, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/'));
  await see(p, 'Example');
  h.set('attention', await p.locator('.demo-entry:visible').count() > 0, 'the demo is not marked as the demo');
  await h.checkpoint('demo home');
  await h.inView(p.locator('.demo-entry:visible').first(), 'entry', 'the demo controls');
  const panel = await demoPanel(p, h);
  // Demo review, 8 Nov, item 13: the panel says plainly what Faro is.
  if (!/Faro is a prototype/.test(await panel.innerText()) || !/nothing here is for sale/.test(await panel.innerText())) fail('the Demo panel doesn’t say Faro is a prototype with nothing for sale');
  // People are offered by what they do, with the name second.
  h.set('attention', await panel.getByRole('button', { name: /^Leader/ }).first().isVisible() && await panel.getByRole('button', { name: /^Goal owner/ }).first().isVisible(), 'the demo panel does not lead with roles');
  await h.click(panel.getByRole('button', { name: /Amara/ }).first());
  await see(p, 'Good', 'Amara’s home opens');
  await see(p, 'goals to discuss', 'Amara’s home leads with her review');
  h.set('progress', await p.locator('.ring:visible').count() > 0, 'no progress on Amara’s home');
  // A change in the demo stays in this browser and can be undone in one place.
  await p.goto(url('/workspace/overview'));
  await h.click(p.getByRole('button', { name: 'Reset the example' }));
  await h.click(p.getByRole('button', { name: 'Yes, reset it' }));
  await see(p, 'The example is back to its starting point');
  // Start over in the Demo panel clears what the demo keeps besides its saves (demo review, 8 Nov, item 1): a half-typed
  // check-in, What's new marked as read, a walkthrough in progress. The person you're viewing as stays.
  await p.evaluate(() => {
    localStorage.setItem('goals-app-draft:platform-org:checkin:any:45', '{"value":"7"}');
    localStorage.setItem('goals-app-draft:platform-org:checkin:any:45:step', 'account');
    localStorage.setItem('goals-whats-new-seen', 'anything');
    sessionStorage.setItem('goals-tour', '{"id":"checkin","step":1}');
  });
  // Not counted against the journey's budget: this is a second way to do the same thing.
  const again = await demoPanel(p);
  await again.getByRole('button', { name: /^Start over/ }).click();
  await again.getByRole('button', { name: 'Yes, start over' }).click();
  await see(p, 'The example is back to its starting point');
  const left = await p.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage).map((k) => 'session:' + k)]);
  const stale = left.filter((k) => /goals-app-draft:|goals-whats-new-seen|session:goals-tour/.test(k));
  if (stale.length) fail('Start over left behind: ' + stale.join(', '));
  if (!left.includes('goals-app-viewer:platform-org')) fail('Start over forgot who you are viewing as');
  h.set('finish', true);
  await p.context().close();
}, ['errors', 'logged']);

journey('U6', ['NOTES', 'GOAL-PAGE', 'CHANGE-LOG', 'ATTENTION', 'REBASELINE'], 'Understand a goal and its change history', 3, async (h, device) => {
  // Santiago owns the Kafka migration: a milestone, off track, with late stages and a worsening trend.
  const p = h.use(await newPage(device, 'santiago'));
  await p.goto(url('/goals?show=attention'));
  await h.inView(p.locator('.arow').first(), 'entry', 'the first goal');
  await h.click(p.locator('.arow-main', { hasText: 'Kafka moved to the managed service' }));
  await p.locator('.goal-bar').waitFor();
  // The summary bar says off track and how many stages are late; Why opens with the reason (the scorecard, 5 Nov).
  h.set('attention', await p.locator('.goal-bar[data-tone=off] .bar-status.off').isVisible() && /^[1-9]\d*$/.test((await p.locator('.goal-bar .sc-late .sc-value').innerText()).trim()) && (await p.locator('.why-block .why-text').innerText()).length > 10, 'off track and its reasons are not shown');
  await h.checkpoint('goal page');
  // Check-ins, comments and changes are one stream; Changes shows only the changes.
  await h.click(p.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Changes', exact: true }));
  await h.click(p.locator('#activity').getByRole('button', { name: /Show .*change/ }).first());
  h.set('logged', await p.locator('.diffs ins').first().isVisible(), 'a change does not show its before and after');
  h.set('finish', true);
  h.set('progress', await p.locator('.stagelist').isVisible(), 'the stages are not shown');
  // Anyone can comment; it goes straight into the goal's activity, logged like every other save.
  await h.fill(p.getByLabel('Add a comment'), 'The vendor confirmed their December date holds.');
  await h.click(p.getByRole('button', { name: 'Post comment' }));
  await h.click(p.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Comments', exact: true }));
  await see(p, 'The vendor confirmed their December date holds.', 'the comment shows in the activity');
  const s = await h.snapshot();
  h.set('logged', s.changes.some((c) => c.actorId === 'santiago' && c.goalId === 'fresh-kafka' && c.diffs.some((d) => /December date/.test(d.to))), 'the comment is not in the change log');
  await p.goto(url('/goals/ns-ai'));
  await see(p, 'Target changed in week 20: 60% → 80%', 'the re-baseline is explained on the chart');
  await p.context().close();
}, ['errors', 'budget']);

journey('U7', ['REASON-AHEAD', 'REBASELINE', 'CHANGE-LOG', 'PLAN-CHANGE', 'WATCHING'], 'An owner changes a target with a reason; a watcher sees it', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'tariq'));
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await h.click(p.getByRole('link', { name: /Start check-in/ }));
  const s7 = await h.snapshot();
  // Well ahead, but still a possible coverage (under 100%).
  await h.fill(p.getByLabel('This week’s value'), valueAt(s7.goals.find((g) => g.id === 'lead-review'), NOW, 1.25));
  await h.click(p.getByRole('button', { name: 'Continue' }));
  // Last week's reason is offered back; this week's is different, so edit it.
  // (Tariq's goal was on plan last week, so there is no earlier reason to offer back.)
  const changed = p.getByRole('button', { name: 'Something changed', exact: true });
  if (await changed.isVisible().catch(() => false)) await h.click(changed);
  await see(p, 'Why is it ahead?');
  await h.click(p.getByRole('button', { name: 'Change landed early' }));
  await h.fill(p.getByLabel('What happened'), 'The review rota change landed early, so waits are already down.');
  await see(p, 'If the target should move', 'well ahead, the owner is pointed at changing the target');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  // A plan change once check-ins have started saves directly, but needs a reason.
  await p.goto(url('/goals/ns-ai'));
  await goalMenu(h, p, 'Change this goal');
  await h.click(p.getByRole('link', { name: 'Change the plan or target' }));
  await h.fill(p.getByLabel(/^Target/), '85');
  await p.locator('.focus-foot button[type=submit]').click({ force: true });
  h.set('errors', await p.locator('textarea.invalid[aria-label="Why change it?"]').isVisible() && await p.getByRole('alert').filter({ hasText: 'Say why' }).isVisible(), 'a plan change without a reason is not explained');
  await h.fill(p.getByLabel('Why change it?'), 'AI review reached the monorepos faster than planned; 85% is reachable.');
  await h.checkpoint('edit');
  await h.click(p.getByRole('button', { name: 'Save changes' }));
  await see(p, `Target changed in week ${NOW}: 80% → 85%`, 'the chart keeps the original plan and says when it changed');
  const s = await h.snapshot();
  const lead = s.goals.find((g) => g.id === 'ns-ai');
  const c = s.changes.filter((x) => x.actorId === 'tariq' && x.goalId === 'ns-ai' && x.action === 'edited').pop();
  // (Re-planned once before, in week 20: the original plan is still the first one, 60%.)
  h.set('logged', lead.plan.target === 85 && lead.originalPlan?.target === 60 && lead.rebaselinedWeek === NOW && !!c && c.diffs.some((d) => d.field === 'Target') && c.diffs.some((d) => d.field === 'Why' && /AI review reached/.test(d.to)), 'the plan change is not applied, kept as original, or logged with its reason');
  // Same browser, Oskar, who watches this goal: Watching shows the change.
  await viewAs(p, 'Oskar');
  await see(p, 'Good');
  await navTo(h, p, 'Watching');
  await see(p, 'What changed this week');
  h.set('progress', true);
  h.set('attention', await p.locator('.changes').getByText('Pull requests with AI-assisted review').first().isVisible().catch(() => false) || await p.locator('.changes .change').count() > 0, 'the watched change is not shown');
  await h.checkpoint('watching');
  h.set('finish', true);
  await p.context().close();
});

journey('U8', ['STALE', 'ATTENTION', 'WATCHING', 'ONE-WATCHING', 'ONE-ASK'], 'Watching: see what has gone quiet and chase it', 5, async (h, device) => {
  // Rhea watches the self-service environments tree, where portal search has gone quiet. Watching is a scope of Goals
  // (one Watching, 5 Nov): the same toolbar, the Level filter instead of tabs, what changed beside it.
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/'));
  await navTo(h, p, 'Watching');
  await p.waitForURL(/\/goals\?(.*&)?show=watching/);
  await see(p, 'No recent update');
  await see(p, /\d+ goals · .*need/, 'the summary line counts what needs attention');
  h.set('parity', await p.getByRole('tab', { name: /^Watching/, selected: true }).isVisible() && await p.locator('.goals-toolbar .view-bar').isVisible(), 'Watching is not a Goals tab with the Goals toolbar');
  // A goal with no recent update needs attention (the one rule): it's in that group, saying its status.
  const quiet = p.locator('section', { has: p.getByRole('heading', { name: /Needs attention/ }) }).locator('.trow[data-tone="stale"]').first();
  await h.inView(p.getByRole('heading', { name: /Needs attention/ }), 'entry', 'Needs attention');
  await h.checkpoint('watching');
  h.set('attention', /No check-in for \d+ days/.test(await quiet.innerText()), 'a quiet goal does not say how long it has been');
  await h.click(quiet);
  await p.locator('.goal-bar').waitFor();
  h.set('attention', await p.locator('.goal-bar[data-tone=stale] .bar-status.stale').isVisible() && await p.getByText('can’t be trusted').isVisible(), 'stale is not flagged on the goal');
  // Chase it with an ask for an update: an ask, open on the owner's Home until they check in.
  const askBtn = p.locator('.goal-bar').getByRole('button', { name: /^Ask \w+ for an update$/ }).first();
  await h.click(askBtn);
  await see(p, /Asked \w+ for an update/, 'asking is not confirmed on the goal');
  h.set('progress', true);
  h.set('finish', await p.getByText('It’s open on their Home until they check in or answer it.').first().isVisible(), 'the ask does not say how long it stays open');
  const s = await h.snapshot();
  const ask = (s.requests || []).find((r) => r.kind === 'update' && r.askedBy === 'rhea' && r.status === 'open');
  h.set('logged', !!ask && s.changes.some((c) => c.entity === 'request' && c.entityId === ask.id && c.action === 'asked' && c.actorId === 'rhea'), 'the chase is not an open ask, logged');
  // /watching is the way in; the Level filter narrows it, as on any Goals scope.
  await p.goto(url('/watching?level=team'));
  await p.waitForURL(/show=watching/);
  h.set('parity', /level=team/.test(p.url()) && await p.locator('.filter-chip, .chip').filter({ hasText: /Team/ }).first().isVisible().catch(() => false), 'the Level filter is not applied to Watching');
  await p.context().close();
}, ['errors']);

journey('U9', ['WATCHING', 'HIERARCHY', 'OWNER-ONLY', 'LEVELS', 'PROFILES', 'ONE-WATCHING'], 'Follow goals you don’t own: watch a tree or a level', 6, async (h, device) => {
  // Oskar, an engineer, watches three goals and owns none.
  const p = h.use(await newPage(device, 'oskar'));
  await p.goto(url('/'));
  await see(p, 'No check-ins or reviews due', 'someone who owns no goal is told so, calmly');
  await see(p, 'Goals you watch', 'home shows what Oskar watches');
  // One watching block on Home (one Watching): no second summary of the same goals.
  h.set('parity', await p.locator('.dash-watch').count() === 0 && await p.locator('.home-watch').count() === 1, 'Home shows the goals you watch more than once');
  await h.inView(p.locator('.tree .trow').first(), 'entry', 'the goals Oskar watches');
  h.set('attention', (await p.locator('.tree .trow').count()) > 0 && (await p.locator('.tree .trow .trow-why').first().innerText()).length > 10, 'watched goals are not shown with what changed or how fresh they are');
  await h.checkpoint('home');
  // Watch a whole tree from a goal page.
  await p.goto(url('/goals/ns-lead'));
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
  h.set('logged', s.watches.some((w) => w.personId === 'oskar' && w.kind === 'tree' && w.ref === 'ns-lead') && s.watches.some((w) => w.personId === 'oskar' && w.kind === 'level' && w.ref === 'svp'), 'the watches are not saved');
  // A watcher can follow a goal but not post its check-in or edit it.
  await p.goto(url('/check-in/lead-review'));
  await see(p, 'Only Tariq Haddad checks in on this goal');
  if (await p.getByRole('button', { name: /Post check-in/ }).count()) fail('a non-owner was offered Post check-in');
  await p.goto(url('/goals/lead-review/edit'));
  await see(p, 'Only its owner can change this goal');
  await p.context().close();
}, ['errors']);


journey('U13', ['REVIEW-SETUP', 'LEVELS', 'CHANGE-LOG'], 'Anyone sets up a review: name, cadence, goals, people', 10, async (h, device) => {
  const p = h.use(await newPage(device, 'jun'));
  await p.goto(url('/'));
  await navTo(h, p, 'Reviews');
  await see(p, 'Platform leadership weekly');
  await h.inView(p.getByRole('link', { name: 'Set up a review' }), 'entry', 'Set up a review');
  await h.checkpoint('reviews');
  await h.click(p.getByRole('link', { name: 'Set up a review' }));
  await p.getByRole('button', { name: 'Set up the review' }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Give the review a name' }).isVisible(), 'an unnamed review is not explained');
  await h.fill(p.getByLabel('Name', { exact: true }), 'SRE fortnightly');
  await h.click(p.getByRole('button', { name: 'Every 4 weeks' }));
  await p.getByLabel('On').selectOption('4');
  await h.click(p.getByRole('button', { name: 'North star', exact: true }));
  await h.click(p.getByRole('checkbox', { name: /Mateo Fernández/ }));
  await see(p, /[2-9] goals so far/, 'the form counts the goals picked');
  await h.checkpoint('set up');
  await h.click(p.getByRole('button', { name: 'Set up the review' }));
  await see(p, 'SRE fortnightly');
  await see(p, 'Every 4 weeks, Fridays');
  h.set('progress', await p.locator('.ring:visible').count() > 0, 'the review page has no progress');
  // Exceptions are listed; goals on track with nothing flagged are one named group with a count.
  const healthyN = Number(((await p.locator('.healthy-group .block-title').innerText().catch(() => '')).match(/(\d+)\s*$/) || ['', '0'])[1]);
  h.set('attention', (await p.locator('.agenda .agenda-row').count()) + healthyN >= 2, 'the review does not list its goals');
  h.set('finish', await p.getByRole('button', { name: /^Start review/ }).isVisible().catch(() => false) || await p.getByText('Next:').isVisible().catch(() => false), 'no way to start the new review');
  const s = await h.snapshot();
  const r = s.reviews.find((x) => x.name === 'SRE fortnightly');
  h.set('logged', !!r && r.everyWeeks === 4 && r.weekday === 4 && r.people.includes('mateo') && r.people.includes('jun') && s.changes.some((c) => c.entity === 'review' && c.actorId === 'jun'), 'the review is not saved and logged');
  await p.context().close();
});

journey('U14', ['ADMIN', 'CHANGE-LOG'], 'An admin adds a person and makes them an admin', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'amara'));
  await p.goto(url('/workspace/people'));
  await see(p, 'You’re an admin');
  await h.inView(p.getByRole('button', { name: 'Add a person' }), 'entry', 'Add a person');
  await h.checkpoint('workspace');
  await h.click(p.getByRole('button', { name: 'Add a person' }));
  await p.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  h.set('errors', await p.getByRole('alert').filter({ hasText: 'Add a name' }).isVisible(), 'a person without a name is not explained');
  await h.fill(p.getByRole('dialog').getByLabel('Name'), 'Ines Karim');
  await h.fill(p.getByRole('dialog').getByLabel(/^Email/), 'ines.karim@example.com');
  await h.fill(p.getByRole('dialog').getByLabel(/Job title/), 'Head of SRE');
  await h.click(p.getByRole('dialog').getByRole('checkbox', { name: /Admin/ }));
  await h.checkpoint('add person');
  await h.click(p.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }));
  await see(p, 'Added Ines Karim');
  // 98 people are listed by team; the new person has none yet, so find them by name.
  await h.fill(p.getByPlaceholder('Find by name, role or team'), 'Ines Karim');
  h.set('attention', await p.locator('.opt', { hasText: 'Ines Karim' }).getByText('Admin').isVisible(), 'the new admin is not marked');
  h.set('finish', true);
  h.set('progress', true);
  const s = await h.snapshot();
  h.set('logged', s.people.some((x) => x.name === 'Ines Karim' && x.admin) && s.changes.some((c) => c.entity === 'person' && c.actorId === 'amara'), 'the new person is not saved and logged');
  // Someone who isn't an admin can't add people.
  await viewAs(p, 'Oskar');
  await p.goto(url('/workspace/people'));
  await see(p, 'Admins can add people');
  if (await p.getByRole('button', { name: 'Add a person' }).count()) fail('a non-admin was offered Add a person');
  await p.context().close();
});

journey('U10', ['RETRO', 'CHANGE-LOG', 'ADMIN'], 'Close the cycle: owners wrap up their goals, an admin starts the next cycle', 14, async (h, device) => {
  // Mateo owns two goals (the restore-time north star and its post-incident actions), so the wrap-up is two goals long.
  const p = h.use(await newPage(device, 'mateo'));
  // Seed the example in week 45, then come back in week 52, when the wrap-up opens.
  await p.goto(url('/'));
  await p.locator('.hero').waitFor();
  // The demo example follows the calendar and never reaches the last two weeks of its year (it moves to a financial year
  // instead), so the wrap-up is tried on a copy of it kept in this browser, as a workspace of the visitor's own.
  await p.evaluate(async () => {
    const full = await window.__goalsStore.load('platform-org');
    localStorage.setItem('goals-app-v2:workspaces', JSON.stringify([{ id: 'ws_wrap', name: 'Wrap-up team', kind: 'own', createdAt: '2026-10-01T00:00:00Z' }]));
    localStorage.setItem('goals-app-v2:ws_wrap', JSON.stringify({ ...full, changes: [], checkIns: full.checkIns.filter((c) => c.week >= 42) }));
    localStorage.setItem('goals-app-workspace', 'ws_wrap');
    localStorage.setItem('goals-app-viewer:ws_wrap', 'mateo');
  });
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
  await h.fill(p.getByLabel('What did you learn?'), 'Action reviews only help once every incident has an owner for each action.');
  await h.click(p.getByRole('button', { name: 'Stop it here' }));
  await h.click(p.getByRole('button', { name: 'Save and continue' }));
  await see(p, 'Your goals are wrapped up');
  await see(p, 'Dependencies on other teams', 'the summary shows what was learned');
  let s = await h.snapshot('ws_wrap');
  h.set('logged', s.retros.length === 2 && s.changes.filter((c) => c.entity === 'retro' && c.actorId === 'mateo').length === 2, 'the retros are not saved and logged');
  // Amara, an admin, starts the next cycle.
  await viewAs(p, 'Amara');
  await see(p, 'The year is ending', 'an admin is told the year is ending');
  await p.goto(late('/retro'));
  await h.click(p.getByRole('button', { name: 'Start it' }));
  await h.click(p.getByRole('button', { name: 'Start next year' }));
  await see(p, 'has started');
  s = await h.snapshot('ws_wrap');
  const c2 = s.cycles.find((c) => c.id !== 'cycle');
  const carried = s.goals.filter((g) => g.cycleId === c2?.id);
  h.set('finish', !!c2 && carried.length === s.goals.filter((g) => g.cycleId === 'cycle').length - 1 && !carried.some((g) => g.title === 'Post-incident actions closed within 30 days'), 'the next cycle does not carry the right goals');
  h.set('logged', s.changes.some((c) => c.entity === 'cycle' && c.actorId === 'amara'), 'starting the cycle is not logged');
  await p.goto(late('/goals'));
  await see(p, 'Lead time for changes', 'the new cycle shows the carried goals');
  if (await p.getByText('Post-incident actions closed within 30 days').count()) fail('a stopped goal came into the new cycle');
  await p.context().close();
});

journey('U15', ['OWNER-CALL', 'GREENER', 'CHECKIN-STATUS-VS-PLAN'], 'Call it greener than the numbers, with a reason, in the status sheet', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/check-in/ns-lead'));
  await h.fill(p.getByLabel('This week’s value'), '40'); // hours; well behind the week-45 plan, so the numbers say off track
  await p.locator('.callline').waitFor();
  await h.inView(p.locator('.callline').getByRole('button', { name: 'Change' }), 'entry', 'Change the status');
  await h.click(p.locator('.callline').getByRole('button', { name: 'Change' }));
  const sheet = p.getByRole('dialog');
  await h.click(sheet.getByRole('radio', { name: /At risk/ }));
  const why = sheet.getByRole('textbox').first();
  await why.click();
  await p.keyboard.type('The runner budget was approved today', { delay: 15 });
  const typed = await why.inputValue();
  h.set('errors', typed === 'The runner budget was approved today', `typing in the status sheet lost keys: “${typed}”`);
  h.set('attention', await sheet.getByText(/better than the numbers/i).first().isVisible(), 'the sheet does not say the call is greener than the numbers');
  await h.checkpoint('status sheet');
  await p.keyboard.press('Escape');
  h.set('a11y', await p.evaluate(() => document.activeElement && document.activeElement !== document.body), 'focus is lost after closing the sheet');
  h.set('progress', true);
  h.set('finish', true);
  await p.context().close();
}, ['logged']);

journey('U16', ['ATTENTION', 'WATCHING', 'ONE-ASK', 'ONE-WATCHING'], 'Home by responsibility: every ask waiting on you in one place, and one navigation', 4, async (h, device) => {
  const p = h.use(await newPage(device, 'amara'));
  await p.goto(url('/'));
  // Needs your response: every ask waiting on Amara, grouped by kind, each with what, who, by when and one action.
  await see(p, 'Needs your response');
  const card = p.locator('.need-group', { hasText: 'Decisions or help needed' }).locator('.need').first();
  await h.inView(card, 'entry', 'the decision that needs Amara');
  h.set('attention', await card.getByText(/approve the extra CI runner budget/i).isVisible() && await card.getByRole('link', { name: 'Respond' }).isVisible(), 'the request does not say what is needed or offer a specific action');
  const action = p.locator('.need-group', { hasText: 'Actions for you' }).locator('.need').first();
  h.set('attention', await action.getByText(/Take the runner budget to the finance review/).isVisible() && await action.getByText(/Due week 46/).isVisible() && await action.getByRole('link', { name: 'Mark done' }).isVisible(), 'the action does not say when it is due or offer to mark it done');
  await see(p, 'Goals you watch');
  await h.checkpoint('home');
  // Respond opens the goal with the ask open in the one Respond panel, ready to answer (one way to ask, 5 Nov).
  await h.click(card.getByRole('link', { name: 'Respond' }));
  const respond = p.getByRole('region', { name: 'Respond' });
  await see(respond, 'Your answer or decision', 'Respond does not open the request to answer');
  // One navigation: no four-tab trial in the demo panel, and Watching is a Goals scope for everyone.
  await p.goto(url('/'));
  { const panel = await demoPanel(p, h); h.set('progress', !(await panel.getByRole('button', { name: /4 tabs/ }).count()), 'the four-tab trial is still offered'); await p.keyboard.press('Escape'); }
  if (device === 'phone') {
    const labels = await p.locator('.tabbar').getByRole('link').allInnerTexts();
    h.set('progress', labels.map((x) => x.replace(/\d+/g, '').trim()).join(',') === 'Home,Goals,Watching,Reviews', `phone tabs are ${labels.join(', ')}`);
  }
  await p.goto(url('/goals?show=watching'));
  await see(p, 'Needs attention', 'Watching shows inside Goals');
  h.set('finish', await p.getByRole('heading', { name: 'Watching', level: 1 }).isVisible(), 'Watching inside Goals is not named Watching');
  await p.context().close();
}, ['errors', 'logged']);


journey('U17', ['DEMO-MODE', 'WORKSPACES'], 'Demo data sets, presenting without the bar, and deleting a workspace', 12, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/workspace/overview'));
  // One example now (Platform Engineering): the other example companies are gone, and starting over is on this page.
  await see(p, 'Example: Platform Engineering');
  for (const name of ['Customer Support', 'B2B Sales', 'Product Growth', 'Developer Platform']) if (await p.getByText('Example: ' + name).count()) fail(`“Example: ${name}” is still offered`);
  await h.inView(p.getByRole('button', { name: 'Reset the example' }), 'entry', 'Reset the example');
  await h.checkpoint('workspaces');
  await p.goto(url('/goals'));
  await see(p, 'Lead time for changes', 'the example has its goals');
  h.set('attention', await p.locator('.outcome-card').count() >= 1, 'the example has no trees');
  // Presenting: the demo without the "Viewing as" bar.
  await p.goto(url('/?present'));
  await p.locator('.page-head').first().waitFor();
  h.set('progress', (await p.locator('.demo-entry').count()) === 0, 'the demo controls still show when presenting');
  await p.goto(url('/?present=0'));
  await p.locator('.demo-entry:visible').first().waitFor();
  // Set up a workspace, then delete it: typing its name is required.
  await p.evaluate(async () => {
    const ws = { id: 'ws_temp', name: 'Temp team', kind: 'own', createdAt: '2026-10-01T00:00:00Z' };
    localStorage.setItem('goals-app-v2:workspaces', JSON.stringify([ws]));
    // A copy of the example, small enough for a browser to keep whole: its people, goals and the last weeks' check-ins.
    const full = await window.__goalsStore.load('platform-org');
    const ex = { ...full, changes: [], checkIns: full.checkIns.filter((c) => c.week >= 42) };
    localStorage.setItem('goals-app-v2:ws_temp', JSON.stringify({ ...ex, people: ex.people.map((x) => ({ ...x, admin: x.id === 'rhea' ? true : x.admin })) }));
    localStorage.setItem('goals-app-workspace', 'ws_temp');
  });
  await p.goto(url('/workspace/overview'));
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
  const p = h.use(await newPage(device, 'mateo'));
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
  // About this goal is open on a first visit, with the plan week by week (the flagship page, 5 Nov).
  await see(p, 'Plan and actual by week');
  const s = await h.snapshot();
  const g = s.goals.find((x) => x.title === 'Runbooks with an owner');
  h.set('logged', !!g && (g.plan.endWeek ?? WEEKS) === WEEKS && g.plan.points?.some((pt) => pt.value === 30), 'the year end or the hand-set number was not saved');
  h.set('progress', true);
  h.set('finish', true);
  await p.context().close();
}, ['errors']);

journey('U19', ['VIEWS', 'EXPORT', 'STORY'], 'See the same goals as a table, board, history grid or cards, and export them', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
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

journey('U20', ['BULK-IMPORT', 'SPREADSHEETS-ON-DATA'], 'Load a spreadsheet from Data: a new goal, then its past weeks, with every change shown before saving', 15, async (h, device) => {
  const p = h.use(await newPage(device, 'mateo'));
  // Spreadsheets live on Data (the spreadsheets module): its menu opens Import.
  await p.goto(url('/data'));
  const menu = p.locator('.data-export > summary');
  await h.inView(menu, 'entry', 'Spreadsheets on Data');
  h.set('parity', (await menu.innerText()).trim() === 'Spreadsheets', `Data's menu says “${(await menu.innerText()).trim()}”`);
  await h.click(menu);
  await h.click(p.locator('.data-export').getByRole('button', { name: 'Import a spreadsheet…' }));
  await p.waitForURL(/\/data\/import/);
  await see(p, 'Import from a spreadsheet');
  await h.checkpoint('import');
  const csv = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
  const input = p.getByLabel('Choose a spreadsheet');
  // A new goal, linked by name.
  await input.setInputFiles(csv('goals.csv', 'Goal,Owner,Type,Unit,Start,Target,Feeds into\nRunbooks with an owner,Mateo Fernández,metric,%,20,90,Change failure rate\n'));
  await see(p, '1 new goal');
  await h.checkpoint('preview');
  await h.click(p.getByRole('button', { name: 'Save 1 change' }));
  await see(p, 'Saved: 1 new goal');
  // Its past weeks, by the old address (it leads to Data's Import): a week in the future is refused, and nothing saves
  // until it's fixed.
  await p.goto(url('/import'));
  await p.waitForURL(/\/data\/import/);
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
  h.set('finish', !!g && g.parentId === 'ns-cfr' && cis.length === 2 && cis.every((c) => c.backfilled), 'the goal or its past weeks were not saved');
  h.set('logged', s.changes.some((c) => c.entity === 'workspace' && c.action === 'imported' && /Loaded a spreadsheet/.test(c.summary)) && s.changes.filter((c) => c.goalId === g?.id).every((c) => c.diffs.some((d) => d.field === 'Via' && d.to === 'Spreadsheet')), 'the import was not logged as coming from a spreadsheet');
  h.set('progress', true);
  await p.context().close();
});

journey('U21', ['BULK-EDIT'], 'Type the week’s numbers in one table, and change several goals at once', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'chen'));
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /all your numbers in one table/ }), 'entry', 'the one-table check-in');
  await h.click(p.getByRole('link', { name: /all your numbers in one table/ }));
  const s21 = await h.snapshot();
  const g21 = (id) => s21.goals.find((g) => g.id === id);
  // Chen has two goals to post (Jenkins jobs, integration tests), both numbers.
  const alertsV = valueAt(g21('dep-jenkins'), NOW, 1.02), cacheV = valueAt(g21('cfr-tests'), NOW, 1.05);
  const alerts = p.getByLabel(/Jenkins jobs still running: this week’s number/);
  await h.fill(alerts, valueAt(g21('dep-jenkins'), NOW, 0.4));
  // Behind plan: the row asks why, and won't post without it.
  await h.click(p.getByRole('button', { name: 'Post 1 check-in' }));
  await see(p, 'needs a reason or a path to green');
  h.set('errors', true);
  await h.fill(alerts, alertsV);
  await h.fill(p.getByLabel(/Changes shipped with automated integration tests: this week’s number/), cacheV);
  await h.checkpoint('grid');
  h.set('progress', (await p.locator('.qstatus .chip').count()) === 2, 'each row does not show its status as you type');
  await h.click(p.getByRole('button', { name: 'Post 2 check-ins' }));
  await see(p, 'Saved: 2 check-ins');
  // The table: select two goals and change their level together.
  await p.goto(url('/goals?view=table'));
  await h.click(p.getByLabel('Select Jenkins jobs still running').first());
  await h.click(p.getByLabel('Select Changes shipped with automated integration tests').first());
  await see(p, '2 selected');
  // On a phone the bulk actions share one Actions menu, so the bar stays one row (fit and finish, L&T 6).
  if (device === 'phone') await h.click(p.locator('.selbar-menu > summary'));
  await h.click(p.getByRole('button', { name: 'Change level' }));
  await p.getByRole('dialog').getByLabel('Level').selectOption('north-star'); // (Chen's integration-tests goal is already an SVP goal, so SVP would change only one)
  await h.checkpoint('bulk level');
  await h.click(p.getByRole('dialog').getByRole('button', { name: 'Save' }));
  await see(p, 'Saved: 2 goals changed').catch(async (e) => fail(`${e.message}: ${(await p.locator('.toast, [role=alert], [role=status], .dialog, [role=dialog]').allInnerTexts().catch(() => [])).join(' | ').slice(0, 300)}`));
  const s = await h.snapshot();
  const posted = s.checkIns.filter((c) => c.week === NOW && ((c.goalId === 'dep-jenkins' && c.value === Number(alertsV)) || (c.goalId === 'cfr-tests' && c.value === Number(cacheV))));
  h.set('finish', posted.length === 2 && ['dep-jenkins', 'cfr-tests'].every((id) => s.goals.find((g) => g.id === id).level === 'north-star'), 'the check-ins or the level change were not saved');
  h.set('attention', true);
  h.set('logged', s.changes.filter((c) => c.diffs.some((d) => d.field === 'Via' && d.to === 'Bulk edit')).length >= 4, 'bulk changes were not logged on each goal');
  await p.context().close();
});

journey('U22', ['MCP-TOKENS'], 'An admin gives a teammate a token for an AI assistant, then revokes it', 10, async (h, device) => {
  const p = h.use(await newPage(device));
  // A real-app workspace (kept in the browser for the evals), copied from the example, with Amara as the admin.
  await p.goto(url('/'));
  await p.locator('.page-head').first().waitFor();
  await p.evaluate(async () => {
    const full = await window.__goalsStore.load('platform-org');
    const ex = { ...full, tokens: [], changes: [], checkIns: full.checkIns.filter((c) => c.week >= 42) };
    localStorage.setItem('goals-live-v1:workspaces', JSON.stringify([{ id: 'ws_live', name: 'Platform', kind: 'own', createdAt: '2026-09-01T00:00:00Z' }]));
    localStorage.setItem('goals-live-v1:ws_live', JSON.stringify(ex));
    localStorage.setItem('goals-live-workspace', 'ws_live');
    localStorage.setItem('goals-live-me:ws_live', 'amara');
  });
  await p.goto(live('/workspace/access'));
  // An admin setting, further down the Workspace page: 'entry' is judged on everyday journeys, not this one.
  await p.getByRole('heading', { name: 'AI assistants' }).scrollIntoViewIfNeeded();
  await h.click(p.getByRole('button', { name: 'Make a token' }));
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Who it acts as').selectOption({ label: 'Mateo Fernández' });
  h.set('errors', await dlg.getByRole('button', { name: 'Make the token' }).isDisabled(), 'a token can be made without saying what it is for');
  await h.fill(dlg.getByLabel('What it’s for'), 'Claude on Mateo’s laptop');
  await h.checkpoint('make token');
  await h.click(dlg.getByRole('button', { name: 'Make the token' }));
  await see(p, 'it isn’t shown again');
  const token = await dlg.getByLabel('Token').inputValue();
  h.set('attention', /^gk_[A-Za-z0-9]{40}$/.test(token) && (await dlg.getByLabel('Claude Code command').inputValue()).includes('/api/mcp'), 'the token or the connection command is missing');
  await h.checkpoint('token');
  await h.click(dlg.getByRole('button', { name: 'Done' }));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-live-v1:ws_live')).tokens);
  const hash = await p.evaluate(async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join(''), token);
  h.set('logged', stored.length === 1 && stored[0].tokenHash === hash && stored[0].personId === 'mateo' && !JSON.stringify(stored).includes(token), 'the token was stored in plain text, or not at all');
  await see(p, 'not used yet');
  await h.click(p.getByRole('button', { name: 'Revoke Claude on Mateo’s laptop' }));
  await see(p, 'Revoked');
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-live-v1:ws_live')).tokens);
  h.set('finish', !!after[0].revokedAt, 'the token was not revoked');
  h.set('progress', true);
  await p.context().close();
}, ['entry']);

journey('U23', ['YEAR'], 'See the year in quarters: where we are, each quarter met or missed, and the year’s history', 6, async (h, device) => {
  const p = h.use(await newPage(device, 'amara'));
  await p.goto(url('/goals'));
  await see(p, 'Week 45 of 53 · Q4 (Oct–Dec)', 'the Goals page says the week, the quarter and the year');
  await h.inView(p.getByText('Week 45 of 53 · Q4 (Oct–Dec)'), 'entry', 'the week, quarter and year');
  await p.goto(url('/goals/cost-rightsize'));
  const strip = p.getByRole('region', { name: 'This year by quarter' });
  await strip.waitFor();
  const cells = await strip.locator('li').allInnerTexts();
  h.set('attention', cells.length === 4 && cells.slice(0, 3).every((t) => /Met/.test(t) && /against a plan of/.test(t)) && /In progress/.test(cells[3]), `the quarters read: ${cells.join(' | ')}`);
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
  const a = h.use(await newPage(device, 'tariq'));
  const b = await a.context().newPage();
  b.on('pageerror', (e) => consoleErrors.push(`${device} ${b.url()} · ${e.message}`));
  await a.goto(url('/goals/ns-ai/edit'));
  await b.goto(url('/goals/ns-ai/edit'));
  await a.getByLabel('Name').first().waitFor();
  await b.getByLabel('Name').first().waitFor();
  const s0 = await h.snapshot();
  // A renames it and saves.
  await h.fill(a.getByLabel('Name').first(), 'AI-assisted pull request review');
  await h.click(a.getByRole('button', { name: 'Save changes' }));
  await see(a, 'AI-assisted pull request review');
  // B, still looking at the old version, changes the source and saves: refused, and shown the latest.
  await b.getByText('More details').click();
  await h.fill(b.getByLabel('Data source'), 'Engineering metrics warehouse');
  await h.click(b.getByRole('button', { name: 'Save changes' }));
  await see(b, 'Someone else changed this a moment ago', 'the second save is not told it was refused');
  h.set('errors', true);
  await h.checkpoint('refused');
  const s = await h.snapshot();
  const g = s.goals.find((x) => x.id === 'ns-ai');
  h.set('finish', g.title === 'AI-assisted pull request review' && g.source !== 'Engineering metrics warehouse', `the first save was overwritten or the second landed (title “${g.title}”, source “${g.source}”)`);
  h.set('logged', s.changes.filter((c) => c.goalId === 'ns-ai' && c.action === 'edited' && !s0.changes.some((o) => o.id === c.id)).length === 1, 'the refused save was logged');
  h.set('attention', true);
  h.set('progress', true);
  await a.context().close();
}, ['entry', 'budget']);

journey('U25', ['FIRST-CHECKIN', 'GOAL-CREATE'], 'Publish a goal, then post its first check-in straight away', 12, async (h, device) => {
  const p = h.use(await newPage(device, 'mateo'));
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
  await p.goto(url('/goals/cost-rightsize?published=1'));
  h.set('attention', (await p.getByText('is published').count()) === 0, 'the prompt shows on a goal that already has check-ins');
  h.set('progress', true);
  await p.context().close();
}, ['errors']);

journey('U30', ['HONEST-NUMBERS', 'GOAL-MAP', 'DRAFTS'], 'Numbers you can trust, a map you can use from the keyboard, and a review set-up that survives a refresh', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'chen'));
  // From Home, the one-table check-in. Letters aren't a number: it says so in place, and no status is guessed.
  await p.goto(url('/'));
  const quick = p.getByRole('link', { name: /one table/ });
  await h.inView(quick, 'entry', 'Or type all your numbers in one table');
  await h.click(quick);
  const row = p.locator('.qrow').filter({ hasText: 'Changes shipped with automated integration tests' });
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
  h.set('logged', !s.checkIns.some((c) => c.goalId === 'cfr-tests' && c.value === 150), 'an impossible coverage was saved');
  await h.checkpoint('one table');
  // The map from the keyboard: Enter on a goal opens its story, which takes focus; Escape gives focus back.
  await p.goto(url('/goals'));
  await h.click(p.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Map' }));
  const node = p.locator('.react-flow__node[data-id="ns-lead"]');
  await node.waitFor();
  await node.focus();
  await p.keyboard.press('Enter');
  const panel = p.getByRole('complementary', { name: /Lead time for changes/ });
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

journey('U31', ['HONEST-NUMBERS', 'WALKTHROUGHS', 'WATCHING', 'ONE-WATCHING'], 'After the week is done: check in again, a walkthrough that still works, and Activity that keeps Watching’s scope', 19, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
  // Rhea's week starts from Home; she posts her numbers at plan in one table, so her week is done.
  await p.goto(url('/'));
  await h.inView(p.getByRole('link', { name: /Start check-in/ }), 'entry', 'Start check-in');
  await p.goto(url('/quick-check-in'));
  await p.locator('.qrow').first().waitFor();
  const s0 = await h.snapshot();
  for (const row of await p.locator('.qrow').all()) {
    const title = (await row.locator('a').first().innerText()).trim();
    const g = s0.goals.find((x) => x.title === title);
    // A number to keep in range sits comfortably inside its limit; a number to move is its plan as written at the
    // goal's decimals, which is on plan (the CI cost's 0.4067 is typed as 0.41, and is on plan, not behind).
    const v = g.kind === 'range' ? (g.range.bound === 'atMost' ? g.range.limit - 2 * g.range.margin : g.range.limit + 2 * g.range.margin).toFixed(g.decimals) : planAt(g.plan, NOW).toFixed(g.decimals);
    await h.fill(row.getByRole('textbox').first(), v);
  }
  // Every number is on plan, so no row asks why (a two-decimal goal one week into its plan once did: 0.41 against
  // 0.4067 read as behind).
  for (const row of await p.locator('.qrow').all()) {
    const asks = (await row.getByRole('textbox').count()) > 1 || (await row.locator('select').evaluateAll((els) => els.some((e) => !e.value)));
    if (asks) fail(`a number on plan asks why: ${(await row.innerText()).split('\n')[0]}`);
  }
  await h.click(p.getByRole('button', { name: /^Post/ }));
  await see(p, 'Saved', 'posting the table did not confirm').catch(async (e) => {
    const said = (await p.locator('.toast, [role=alert], .qissues').allInnerTexts().catch(() => [])).join(' | ');
    fail(`${e.message}${said ? `: ${said}` : ''}`);
  });
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
  // Activity, reached from Watching (a Goals scope), keeps the scope and says so; one click shows everything.
  await p.goto(url('/activity?watching=all&since=2026-11-02'));
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
  const p = h.use(await newPage(device, 'amara'));
  await p.goto(url('/goals'));
  const search = p.getByRole('searchbox', { name: 'Search goals' });
  await h.inView(search, 'entry', 'the search box');
  // Search finds goals by any word: a title, an owner, a reason.
  await h.fill(search, 'December date');
  await see(p, '1 of 126 goals', 'searching does not say how many goals match');
  h.set('attention', await p.getByRole('link', { name: /Kafka moved to the managed service/ }).first().isVisible().catch(() => false) || (await p.getByText('Kafka moved to the managed service').count()) > 0, 'a search on the owner’s reason did not find the goal');
  await h.fill(search, '');
  // Filters: what needs someone. Then sort, and the same goals in the Table.
  await h.click(p.getByRole('button', { name: /^Filters/ }));
  const sheet = p.getByRole('dialog', { name: 'Filter goals' });
  // Needs attention, narrowed to a slipped date: the one Needs attention rule, then why.
  await h.click(sheet.getByLabel('Date slipped'));
  // Sort is in the sheet on every screen (a phone has no room for it in the bar).
  await sheet.getByLabel('Sort').selectOption('due');
  await h.checkpoint('filters');
  await h.click(sheet.getByRole('button', { name: 'Show the goals' }));
  await see(p, '21 of 126 goals', 'the slipped-date filter does not narrow the goals');
  await h.click(p.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Table' }));
  await p.locator('.gtable tbody tr').first().waitFor();
  const rows = await p.locator('.gtable tbody tr:not(.story-row)').count();
  h.set('progress', rows === 21 && (await p.getByRole('button', { name: /Remove filter: Needs attention because: date slipped/ }).isVisible()), `table shows ${rows} goals with the filter`);
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
  await see(p, '21 of 126 goals', 'opening the saved view did not bring its filters back');
  // A shared link opens the same goals for anyone.
  const other = await newPage(device, 'rhea');
  // A link from before release 2 (needs=slipped, without attention=1) opens the same goals.
  await other.goto(url('/goals?needs=slipped&sort=due'));
  await see(other, '21 of 126 goals', 'a shared link does not open the same goals');
  await other.context().close();
  // Delete it: the tab goes.
  // Rename, pin and delete live in one menu, not beside the filters.
  if (device === 'phone') await p.locator('.filter-view-menu > summary').click();
  else await p.getByText('Manage view', { exact: true }).click();
  await p.getByRole('button', { name: 'Delete' }).click();
  await tab.waitFor({ state: 'detached' });
  await p.context().close();
});

journey('U33', ['EXCEPTIONS-FIRST', 'STORY', 'SAVED-VIEWS', 'ONE-ASK'], 'A leader acts on what needs them: what threatens the north star, respond to a request, chase a quiet goal, compare in a table', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'amara'));
  // The north star says which contributing goals are most likely to make it miss, near the top.
  await p.goto(url('/goals/ns-lead'));
  // Pinned at the top of What feeds it, with why, instead of a second copy above (the flagship page, 5 Nov).
  const threats = p.locator('#feeds .pinned');
  await threats.waitFor();
  h.set('attention', (await threats.locator('.trow, .gline').count()) > 0 && /Most likely to make it miss/.test(await threats.innerText()), 'the north star does not name what threatens it');
  await h.checkpoint('threats');
  // The goal waiting on Amara's decision: Respond is beside the ask and opens the one Respond panel, ready to answer.
  const request = p.getByRole('region', { name: /^Decision or help, from Rhea/ });
  await request.waitFor();
  await h.click(request.getByRole('button', { name: 'Respond' }));
  const respond = p.getByRole('region', { name: 'Respond' });
  await respond.waitFor({ timeout: 3000 }).catch(() => {});
  h.set('finish', await respond.getByLabel('Your answer or decision').isVisible().catch(() => false), 'Respond does not open a place to answer the request');
  const repeats = await p.locator('main').evaluate((m) => (m.innerText.match(/Amara Nwosu: Amara/g) || []).length);
  h.set('attention', repeats === 0, 'the request names its recipient twice');
  // Chasing a quiet goal leaves a lasting "Asked" in place of the button: an ask, open until Kojo checks in.
  await p.goto(url('/goals/env-search'));
  await h.click(p.getByRole('button', { name: /^Ask Kojo for an update/ }));
  await see(p, 'Asked Kojo for an update', 'asking for an update leaves no lasting trace');
  h.set('attention', !(await p.getByRole('button', { name: /^Ask Kojo for an update/ }).isVisible()), 'the ask button is still offered after asking');
  const s1 = await h.snapshot();
  h.set('logged', (s1.requests || []).some((r) => r.kind === 'update' && r.goalIds[0] === 'env-search' && r.askedBy === 'amara' && r.status === 'open') && s1.changes.some((c) => c.goalId === 'env-search' && c.actorId === 'amara' && c.entity === 'request' && c.action === 'asked'), 'the ask for an update was not saved as an open ask and logged');
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
    await see(p, /of 12\d goals/, 'the decision filter did not narrow the goals');
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
  const p = h.use(await newPage(device, 'tariq'));
  // The map's "Only what needs attention" is the status filter: in the link, in the count, and in Export.
  await p.goto(url('/goals?view=map'));
  await p.getByRole('region', { name: /Goal map/ }).waitFor();
  await h.click(p.getByLabel('Only what needs attention'));
  await p.waitForURL(/status=off(%2C|,)risk(%2C|,)stale/, { timeout: 3000 }).catch(() => {});
  // The map's toggle is the Goals screen's Needs attention filter (the one rule), so the link carries attention=1.
  h.set('logged', /attention=1/.test(p.url()), 'the attention filter is not in the link');
  await see(p, /\d+ of 126 goals/, 'the attention filter does not show in the count');
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
  const p = h.use(await newPage(device, 'grace'));
  // Everyone can open the tables; an admin types into cells across tables, then reviews and saves once.
  await p.goto(url('/data?t=people'));
  const title = p.getByLabel('Job title, Oskar Lindgren');
  await title.waitFor();
  await h.fill(title, 'Staff engineer, DevEx');
  await h.click(p.getByRole('tab', { name: /Check-ins/ }));
  // Property filters: a goal from its list of values, and a number condition; then sort by a column.
  await h.click(p.getByRole('button', { name: 'Filter', exact: true }));
  let sheet = p.getByRole('dialog', { name: 'Add a filter' });
  await sheet.getByLabel('Property').selectOption('Goal');
  // With 126 goals the Goal filter starts as “contains”; “is” gives the list of goals to pick from.
  await sheet.getByLabel('Condition').selectOption('is');
  await h.click(sheet.getByLabel('Pull requests with AI-assisted review'));
  await h.click(sheet.getByRole('button', { name: 'Add filter' }));
  await h.click(p.getByRole('button', { name: 'Filter', exact: true }));
  sheet = p.getByRole('dialog', { name: 'Add a filter' });
  await sheet.getByLabel('Property').selectOption('Week');
  await sheet.getByLabel('Condition').selectOption('gte');
  await h.fill(sheet.getByRole('textbox', { name: 'Value', exact: true }), '38');
  await h.click(sheet.getByRole('button', { name: 'Add filter' }));
  await see(p, 'Goal is Pull requests with AI-assisted review', 'the goal filter is not shown as words');
  await see(p, 'Week ≥ 38', 'the week filter is not shown as words');
  await h.click(p.locator('.dtable thead').getByRole('button', { name: /^Week$/ }));
  const weekCol = (await p.locator('.dtable thead th').allInnerTexts()).findIndex((t) => /^Week/.test(t.trim()));
  const weeks = await p.locator('.dtable tbody tr').evaluateAll((trs, i) => trs.map((tr) => tr.querySelectorAll('td')[i]?.textContent ?? ''), weekCol);
  h.set('progress', weeks.length > 0 && weeks.every((w, i) => Number(w) >= 38 && (i === 0 || Number(w) >= Number(weeks[i - 1]))) && /f=Goal/.test(p.url()) && /s=Week/.test(p.url()), `filtered and sorted weeks: ${weeks.join(', ')}`);
  // A note the demo's generator gives this goal in weeks 41 and 44 (demo text varied in the 8 Nov review).
  await h.fill(p.getByPlaceholder('Search check-ins'), 'No surprises');
  const why = p.getByLabel(/^Why, Pull requests with AI-assisted review, week/).first();
  await why.waitFor();
  const was = await why.inputValue();
  await h.fill(why, was.replace('No surprises', 'Nothing unexpected'));
  await see(p, '2 changes in 2 rows, not saved yet', 'the tables do not say what is waiting to be saved');
  h.set('attention', (await p.locator('.dcell.edited').count()) === 1 && (await why.getAttribute('aria-label')) !== null, 'a changed cell is not marked as changed');
  await h.checkpoint('edited');
  await h.click(p.getByRole('button', { name: 'Review changes' }));
  const dialog = p.getByRole('dialog', { name: 'Review your changes' });
  await see(dialog, 'Oskar Lindgren', 'the review does not show the person change');
  h.set('errors', !(await dialog.getByText('fixing first').isVisible().catch(() => false)), 'the review found problems with the edits');
  await h.click(dialog.getByRole('button', { name: /^Save 2 changes/ }));
  await see(p, 'Saved 2 changes', 'saving the tables did not confirm');
  const s = await h.snapshot();
  h.set('logged', s.people.find((x) => x.id === 'oskar')?.role === 'Staff engineer, DevEx' && s.changes.some((c) => c.entity === 'check-in' && c.actorId === 'grace' && c.diffs.some((d) => d.field === 'Via' && d.to === 'Data tables')), 'the person or the check-in correction was not saved and logged');
  // Someone who isn't an admin can look but not change anything.
  const m = await newPage(device, 'rhea');
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
  // Demo review, 8 Nov, item 12: no filter is offered greyed out with no reason.
  const greyed = await p.getByRole('dialog', { name: 'Filter activity' }).evaluate((d) => [...d.querySelectorAll('input:disabled, select:disabled, button:disabled')].filter((e) => !e.closest('label, .field')?.querySelector('.hint') && !e.getAttribute('title')).map((e) => e.closest('label')?.textContent.trim() || e.outerHTML.slice(0, 60)));
  if (greyed.length) fail('Activity filters offered greyed out with no reason: ' + greyed.join(', '));
  await h.click(p.getByRole('button', { name: 'Show the changes' }));
  await p.waitForURL(/who=grace/, { timeout: 3000 }).catch(() => {});
  h.set('finish', /kind=checkins/.test(p.url()) && /who=grace/.test(p.url()), 'the activity filters are not in the link');
  await see(p, /\d+ of \d+ changes/, 'the filtered activity does not say how many it shows');
  const download = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  // On a phone, Save .csv is in the Filters sheet's footer rather than a row of the filter bar.
  if (device === 'phone') { await h.click(p.getByRole('button', { name: /^Filters/ })); await h.click(p.getByRole('dialog', { name: 'Filter activity' }).getByRole('button', { name: 'Save .csv' })); }
  else await h.click(p.getByRole('button', { name: 'Save .csv' }));
  h.set('progress', !!(await download), 'Save .csv did not download the filtered log');
  await p.context().close();
}, ['entry', 'one-action']);

journey('U36', ['PATH-TO-GREEN', 'ATTENTION', 'REVIEW-RUN', 'ONE-ASK'], 'An owner keeps last week’s account but withdraws the request; the leader’s Home and review agree on what needs them', 12, async (h, device) => {
  // Rhea: the same account as last week, but Amara's decision on the runner budget isn't needed any more.
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/check-in/ns-lead'));
  const s0 = await h.snapshot();
  await h.fill(p.getByLabel('This week’s value'), valueAt(s0.goals.find((g) => g.id === 'ns-lead'), NOW, 0.5));
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
  const c = s.checkIns.filter((x) => x.goalId === 'ns-lead').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
  const r = (s.requests || []).find((x) => x.kind === 'decision' && x.goalIds[0] === 'ns-lead' && /runner budget/.test(x.ask));
  h.set('logged', !!c && !c.pathToGreen?.needs && /merge queue/i.test(c.pathToGreen?.what ?? '') && r?.status === 'withdrawn', 'the withdrawn request was posted again, the account was lost, or the ask is still open');
  h.set('progress', await p.locator('.celebrate').isVisible(), 'no confirmation after posting');
  await h.checkpoint('posted');
  // Amara, in the same demo data: Rhea's request has gone from Home; Home and the review describe the same agenda.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'amara'));
  await p.goto(url('/'));
  await see(p, 'goals to discuss', 'Home does not say how many goals need discussion');
  const home = await p.locator('main').innerText();
  h.set('attention', !/approve the extra CI runner budget/.test(home), 'Rhea’s withdrawn request is still on Amara’s Home');
  const discuss = Number((home.match(/(\d+) goals? to discuss/) || [])[1]);
  await h.click(p.getByRole('link', { name: /Open the review|Continue/ }));
  await see(p, `Start review · ${discuss} goal`, 'Home and the review disagree on how many goals need discussion');
  h.set('finish', discuss > 0, 'no agenda count on Home');
  await h.checkpoint('review');
  await p.context().close();
}, ['entry', 'one-action', 'errors']);

journey('U37', ['PATH-TO-GREEN', 'ATTENTION', 'CHANGE-LOG', 'ONE-ASK'], 'Several goals wait on one decision: an owner links theirs, the leader answers once, and every goal shows the answer', 12, async (h, device) => {
  // Pavel's merge-to-deploy time waits on the same runner budget Rhea asked Amara for (two CI goals already do): he
  // links it in his check-in, where the owner says what's needed.
  const p = h.use(await newPage(device, 'pavel'));
  await p.goto(url('/check-in/lead-merge'));
  // His week is posted already, so this is another check-in: the number hasn't moved.
  await h.click(p.getByRole('button', { name: /^Measured again/ }));
  await h.click(p.getByRole('button', { name: /^(Continue|Post check-in)$/ }));
  if (await p.getByRole('button', { name: 'Something changed', exact: true }).isVisible().catch(() => false)) await h.click(p.getByRole('button', { name: 'Something changed', exact: true }));
  await h.click(p.getByRole('button', { name: 'Waiting on a decision already asked for another goal?' }));
  const sheet = p.getByRole('dialog', { name: 'Waiting on the same decision' });
  await h.click(sheet.getByRole('button', { name: /Lead time for changes/ }));
  await see(p, 'one answer will cover all 4 goals', 'linking the request did not confirm');
  await h.checkpoint('linked');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved', 'the check-in with the linked request did not post');
  // Amara, in the same demo data: the request shows once, for every goal; she answers it from Home.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'amara'));
  await p.goto(url('/'));
  const need = p.locator('.need').filter({ hasText: 'and 3 more goals waiting on it' });
  await need.waitFor();
  h.set('attention', (await p.locator('.need').filter({ hasText: 'approve the extra CI runner budget' }).count()) === 1, 'the same decision is asked more than once on Home');
  await h.click(need.getByRole('link', { name: 'Respond' }));
  const respond = p.getByRole('region', { name: 'Respond' });
  await see(respond, '4 goals are waiting on this', 'the answer does not say which goals wait on it');
  await h.fill(respond.getByLabel('Your answer or decision'), 'Approved: the extra runner budget for Q4, from finance on the 12th.');
  await h.click(respond.getByRole('button', { name: 'Record the answer' }));
  await see(p, 'Answered for all 4 goals', 'answering did not confirm for every goal');
  await p.goto(url('/'));
  await p.locator('main').waitFor();
  await p.waitForTimeout(300);
  h.set('progress', (await p.locator('.need').filter({ hasText: 'approve the extra CI runner budget' }).count()) === 0, 'the answered request is still on Home');
  // Every goal shows the answer; the request is answered once, logged on each goal.
  await p.goto(url('/goals/lead-merge'));
  await see(p, 'Answered by Amara Nwosu', 'the linked goal does not show the answer');
  const s = await h.snapshot();
  const r = (s.requests || []).find((x) => x.status === 'answered' && /from finance on the 12th/.test(x.answer || ''));
  h.set('logged', !!r && r.goalIds.includes('ns-lead') && r.goalIds.includes('lead-merge') && s.changes.filter((c) => c.entity === 'request' && c.action === 'answered' && c.entityId === r.id).length === 4, 'the answer is not one request, logged on every goal');
  h.set('finish', true);
  await p.context().close();
}, ['entry', 'one-action', 'errors']);


journey('U38', ['QUARTER-RESULTS', 'WEEK-INSPECTOR', 'NO-DOUBLE-POST', 'ASK-UNDO', 'STICKY-HEAD', 'ONE-ASK'], 'A leader reads the quarters, inspects a week, asks for an update and takes it back; an owner’s double press posts once', 24, async (h, device) => {
  const p = h.use(await newPage(device, 'amara'));
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
  // Asking Kojo for an update shows as asked, with an Undo; undone (withdrawn), it leaves his Home too.
  await p.goto(url('/goals/env-search'));
  await h.click(p.getByRole('button', { name: 'Ask Kojo for an update' }));
  await see(p, 'Asked Kojo for an update', 'asking does not show as asked');
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'kojo'));
  await p.goto(url('/'));
  await see(p, 'Updates asked for', 'the ask is not on Kojo’s Home, under its kind');
  await see(p, 'Amara asked', 'Kojo’s Home does not say who asked');
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'amara'));
  await p.goto(url('/goals/env-search'));
  await h.click(p.getByRole('button', { name: 'Undo' }));
  await p.getByRole('button', { name: 'Ask Kojo for an update' }).waitFor();
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'kojo'));
  await p.goto(url('/'));
  await p.locator('main').waitFor();
  await p.waitForTimeout(300);
  const left = await p.getByText('Updates asked for').count();
  const s1 = await h.snapshot();
  const ask = (s1.requests || []).filter((r) => r.kind === 'update' && r.goalIds[0] === 'env-search' && r.askedBy === 'amara').pop();
  const asks = s1.changes.filter((c) => c.goalId === 'env-search' && c.entity === 'request' && c.entityId === (ask && ask.id));
  h.set('logged', left === 0 && ask?.status === 'withdrawn' && asks.some((c) => c.action === 'asked') && asks.some((c) => c.action === 'withdrawn'), `undoing left ${left} asks on Home; the ask is ${ask?.status}; logged ${asks.map((c) => c.action).join(', ')}`);
  await h.checkpoint('ask undone');
  // Tariq presses Post twice before the screen can react: one check-in, not two.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'tariq'));
  const before = (await h.snapshot()).checkIns.filter((c) => c.goalId === 'ns-ai' && c.week === NOW).length;
  await p.goto(url('/check-in/ns-ai'));
  await h.fill(p.getByLabel('This week’s value'), valueAt(s1.goals.find((g) => g.id === 'ns-ai'), NOW, 1.05));
  const label = await p.locator('form.focus-body button[type=submit]').innerText();
  await p.evaluate(() => { const b = document.querySelector('form.focus-body button[type=submit]'); b.click(); b.click(); b.click(); });
  await see(p, 'Check-in saved', 'the check-in did not post');
  await p.waitForTimeout(500);
  const after = (await h.snapshot()).checkIns.filter((c) => c.goalId === 'ns-ai' && c.week === NOW).length;
  h.set('errors', label === 'Post check-in' && after - before === 1, `three quick presses on “${label}” posted ${after - before} check-ins`);
  h.set('finish', true);
  await p.context().close();
}, ['entry', 'one-action']);

journey('U39', ['ONE-ACCOUNT', 'PATH-TO-GREEN', 'WALKTHROUGHS'], 'Something changed: what changed, what happens next and by when on one screen; the walkthrough coach never covers what it points at', 14, async (h, device) => {
  const p = h.use(await newPage(device, 'chen'));
  await p.goto(url('/check-in/dep-jenkins'));
  const s0 = await h.snapshot();
  // Before a number is typed the button doesn't promise to post.
  const before = await p.locator('form.focus-body button[type=submit]').innerText();
  await h.fill(p.getByLabel('This week’s value'), valueAt(s0.goals.find((g) => g.id === 'dep-jenkins'), NOW, 0.4));
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
  await h.fill(account.getByLabel('What happened'), 'The payments team’s release train changed, so the Jenkins jobs we planned to retire were pinned for a new pipeline.');
  await h.click(account.getByRole('radio', { name: /I have a plan/ }));
  await h.fill(account.getByLabel('What changes?'), 'Relabel the pinned jobs this week, then retire the Jenkins agents.');
  await h.click(account.getByRole('group', { name: 'Back on plan by' }).getByRole('button').first());
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  const s = await h.snapshot();
  const c = s.checkIns.filter((x) => x.goalId === 'dep-jenkins').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
  h.set('logged', !!c && /new pipeline/.test(c.why) && /Relabel/.test(c.pathToGreen?.what ?? '') && (c.pathToGreen?.byWeek ?? 0) > NOW, 'the account was not saved whole');
  // The goal page says whose date is whose: the owner's recovery date and the app's projection.
  await p.goto(url('/goals/dep-jenkins'));
  await see(p, 'Owner’s date: back on plan by', 'the owner’s date is not labelled as theirs');
  // The chart's footnote: "Likely end projected from the last eight weeks, not the owner’s date." (the scorecard, 5 Nov).
  const proj = await p.getByText(/projected from the last eight weeks, not the owner’s date/i).count();
  h.set('attention', proj > 0, 'the projection is not labelled as the app’s estimate');
  // The map walkthrough: the coach sits beside the goal it points at, never on it.
  await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'amara'));
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
  // Chen's goal is behind, and none of the named causes fits: Something else, in his own words.
  const p = h.use(await newPage(device, 'chen'));
  await p.goto(url('/check-in/dep-jenkins'));
  const s0 = await h.snapshot();
  await h.fill(p.getByLabel('This week’s value'), valueAt(s0.goals.find((g) => g.id === 'dep-jenkins'), NOW, 0.4));
  await h.click(p.getByRole('button', { name: 'Continue' }));
  await h.click(p.getByRole('button', { name: 'Something changed', exact: true }));
  await h.click(p.getByRole('group', { name: 'Main cause' }).getByRole('button', { name: 'Something else' }));
  await h.fill(p.getByLabel('What happened'), 'A reorganisation moved the Jenkins job owners to another team mid-week.');
  await h.checkpoint('something else');
  await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(p, 'Check-in saved');
  const s1 = await h.snapshot();
  const c = s1.checkIns.filter((x) => x.goalId === 'dep-jenkins').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
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

/* ---------------- markups (Faro's plan, release 1) ---------------- */

/** The markups kept in this browser when there's no database (src/markup/backend.ts): what was sent, and its pictures. */
const keptMarkups = (p) => p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('faro-markups', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('markups', { keyPath: 'markup.id' });
  r.onsuccess = () => { const q = r.result.transaction('markups').objectStore('markups').getAll(); q.onsuccess = () => res(q.result.map((k) => ({ ...k.markup, pics: Object.keys(k.pictures) }))); q.onerror = () => res([]); };
  r.onerror = () => res([]);
}));
/** Drags the mouse across the frozen screen, as a person draws. */
const drag = async (p, [x1, y1], [x2, y2]) => { await p.mouse.move(x1, y1); await p.mouse.down(); await p.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }); await p.mouse.move(x2, y2, { steps: 4 }); await p.mouse.up(); };
const markupBar = (p) => p.getByRole('toolbar', { name: 'Mark up this screen' });
/** The screen as it is now, once its entrance motion has settled: what a markup's picture must match. */
const settledScreenshot = async (p) => {
  await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 5000))]));
  await p.waitForTimeout(200);
  return p.screenshot();
};
/** How much of the markup's picture differs from a real screenshot of the same screen, as a share of its pixels. The
    picture is drawn from a copy of the page that keeps each element's size: in any other font the text reflows and
    lines run into each other, which shows here as about 1% of pixels (measured at 390 and 1280, light and dark), against
    under 0.05% when it uses the page's fonts. */
async function pictureDiffers(p, live) {
  const { PNG } = require('pngjs');
  const pm = require('pixelmatch');
  const match = pm.default ?? pm;
  const a = PNG.sync.read(live);
  const src = await p.locator('.mk-shot').getAttribute('src');
  const b = PNG.sync.read(Buffer.from(String(src).split(',')[1] || '', 'base64'));
  if (a.width !== b.width || a.height !== b.height) return 1;
  return match(a.data, b.data, null, a.width, a.height, { threshold: 0.2 }) / (a.width * a.height);
}

journey('U41', ['MARKUP'], 'Mark up a screen on a phone and a desktop: draw, add a note, check the picture, say what should change, send', 14, async (h, device) => {
  // Rhea, on her north star's page. On a phone she starts from Send feedback in More; on a desktop with Ctrl+Shift+M.
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/goals/ns-lead'));
  await p.locator('.goal-bar').first().waitFor();
  await p.waitForTimeout(600);
  const vp = DEVICES[device];
  const live = await settledScreenshot(p);
  if (device === 'phone') {
    await h.click(p.locator('.tabbar').getByRole('button', { name: /More/ }));
    await h.click(p.getByRole('dialog', { name: 'More' }).getByRole('button', { name: 'Send feedback' }));
    const sheet = p.getByRole('dialog', { name: 'How is the app working for you?' });
    await h.inView(sheet.getByRole('button', { name: /Mark up this screen/ }), 'entry', 'Mark up this screen');
    await h.click(sheet.getByRole('button', { name: /Mark up this screen/ }));
  } else {
    // Escape cancels a markup, leaving the page as it was.
    await p.keyboard.press('Control+Shift+M');
    await markupBar(p).waitFor({ timeout: 15000 });
    await p.keyboard.press('Escape');
    await p.locator('.markup-root').waitFor({ state: 'detached' });
    h.set('entry', await p.locator('.goal-bar').first().isVisible(), 'Escape did not leave the page as it was');
    await p.keyboard.press('Control+Shift+M');
  }
  await markupBar(p).waitFor({ timeout: 15000 });
  const sheetGone = await p.getByRole('dialog', { name: 'How is the app working for you?' }).count() === 0;
  // The picture is the screen as it was, in its own fonts: no text reflowed into other text.
  const differs = await pictureDiffers(p, live);
  h.set('attention', differs < 0.003, `the picture differs from the screen in ${(differs * 100).toFixed(2)}% of its pixels (its fonts fell back?)`);
  // The page is frozen: it doesn't scroll while drawing.
  const before = await p.evaluate(() => [window.scrollY, document.querySelector('main')?.scrollTop ?? 0]);
  await p.mouse.wheel(0, 600);
  await p.waitForTimeout(200);
  const after = await p.evaluate(() => [window.scrollY, document.querySelector('main')?.scrollTop ?? 0]);
  h.set('attention', sheetGone && before.join() === after.join(), `the page moved under the drawing (${before} → ${after}) or the sheet is in the picture`);
  // A box round the scorecard's last cell, with the mouse (or a finger).
  const cell = await p.evaluate(() => { const r = document.querySelector('.sc-cell:last-child')?.getBoundingClientRect(); return r ? [r.left, r.top, r.right, r.bottom] : null; });
  if (!cell) fail('no scorecard to mark');
  await h.click(markupBar(p).getByRole('button', { name: 'Box', exact: true }));
  await drag(p, [cell[0] - 4, cell[1] - 4], [cell[2] + 4, cell[3] + 4]);
  // A pen line, then Undo takes it back.
  await h.click(markupBar(p).getByRole('button', { name: 'Pen', exact: true }));
  await drag(p, [vp.width * 0.2, vp.height * 0.6], [vp.width * 0.5, vp.height * 0.62]);
  await h.click(markupBar(p).getByRole('button', { name: 'Undo', exact: true }));
  // A numbered note, from the keyboard alone: N, Enter where the crosshair is, a few words, Enter.
  await p.locator('.mk-surface').focus();
  await p.keyboard.press('n');
  for (let i = 0; i < 6; i++) await p.keyboard.press('Shift+ArrowDown');
  await p.keyboard.press('Enter');
  await h.fill(p.getByLabel('Note 1'), 'Hard to tell which way is better');
  await p.keyboard.press('Enter');
  await see(p, 'Note added', 'the note was not announced');
  await h.checkpoint('drawing');
  await h.click(markupBar(p).getByRole('button', { name: 'Next', exact: true }));
  const send = p.getByRole('dialog', { name: 'Send the markup' });
  await send.locator('.mk-preview img').waitFor();
  // The line is needed: Send without it says so, in place.
  await h.click(send.getByRole('button', { name: 'Send', exact: true }));
  h.set('errors', await send.getByRole('alert').filter({ hasText: 'Say what should change first' }).isVisible(), 'an empty line says nothing');
  await h.fill(send.getByLabel('What should change?'), 'Say whether it will hit the target in words I can scan');
  await h.click(send.getByRole('button', { name: 'It’s OK' }));
  const steps = send.getByLabel(/Include my last 20 steps on this visit/);
  const ticked = await steps.isChecked();
  const help = await send.getByRole('link', { name: /What’s sent/ }).getAttribute('href');
  await h.checkpoint('send');
  await h.click(send.getByRole('button', { name: 'Send', exact: true }));
  await see(p, 'Sent. You’ll hear when it’s fixed.', 'no word that it was sent');
  await p.locator('.markup-root').waitFor({ state: 'detached' });
  h.set('finish', await p.locator('.goal-bar').first().isVisible() && ticked && /\/help\/feedback$/.test(help || ''), `after sending: steps ticked ${ticked}, help link ${help}`);
  const kept = (await keptMarkups(p)).pop();
  const ok = !!kept && kept.line === 'Say whether it will hit the target in words I can scan' && kept.mood === 'meh' && kept.route === '/goals/:goalId' && kept.goalId === 'ns-lead'
    && kept.strokes.length === 2 && kept.strokes[0].kind === 'box' && kept.strokes[1].kind === 'note' && kept.strokes[1].text === 'Hard to tell which way is better'
    && kept.parts[0].some((path) => path[0] === 'Goal page' && path.includes('Scorecard')) && kept.steps.length > 0 && kept.steps.length <= 20
    && ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'].every((x) => kept.pics.includes(x)) && kept.context.viewport.w === vp.width && kept.personId === 'rhea' && kept.demo === true;
  h.set('logged', ok, `the markup kept was ${JSON.stringify(kept && { line: kept.line, route: kept.route, goal: kept.goalId, strokes: kept.strokes.map((s) => s.kind), parts: kept.parts, steps: kept.steps.length, pics: kept.pics })}`);
  await p.context().close();
}, ['progress']);

/** A database for the build whose database never answers (DOWN): just enough of Supabase (REST and Storage) for
    markups and feedback in the open inbox, answered by Playwright. Keeps what was sent, and says what the inbox asked
    for. No sign-in anywhere: the inbox reads and triages on the public key (migration 0031). */
async function fakeSupabase(ctx) {
  const db = { markups: [], inserted: [], uploads: [], issued: [], patches: [], fbPatches: [], pictureReads: [], signIns: 0,
    // Feedback someone sent from another workspace two days ago (okr_feedback_inbox).
    feedback: [{ id: 'fb_j1', workspace_id: 'acme', workspace_name: 'Acme', person_id: 'mateo', person_name: 'Mateo Silva', path: '/check-in', mood: 'meh', text: 'The reason box is too small on a phone', at: '2026-11-04T10:00:00.000Z', status: 'new', fixed_in: null, wont_fix_reason: null, status_by: null, status_at: null }] };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Expose-Headers': '*' };
  const ok = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body) });
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  // The MCP server's check (GET /api/mcp?check), as on a deploy where the markups bucket is open.
  await ctx.route(/\/api\/mcp\?/, (route) => ok(route, { ok: true, database: true, pictures: true, problems: [] }));
  await ctx.route(/127\.0\.0\.1:\d+\//, async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = u.pathname;
    if (path.startsWith('/rest/v1/okr_telemetry_') || path === '/rest/v1/okr_research_notes') return ok(route, undefined, 201);
    if (path === '/rest/v1/rpc/okr_markup_new_id') { const id = 'mk_' + Math.random().toString(16).slice(2, 10).padEnd(8, '0') + Date.now().toString(16).slice(-8); db.issued.push(id); return ok(route, id); }
    if (path === '/rest/v1/rpc/okr_feedback_inbox') return ok(route, db.feedback);
    if (path === '/rest/v1/rpc/okr_feedback_triage') {
      const { fid, patch } = JSON.parse(r.postData() || '{}');
      db.fbPatches.push(patch);
      const f = db.feedback.find((x) => x.id === fid);
      if (f) Object.assign(f, patch);
      return ok(route, f ? [f] : []);
    }
    // Pictures: uploaded under an issued id, opened by their public address.
    if (path.startsWith('/storage/v1/object/public/markups/')) { db.pictureReads.push(path.split('/markups/')[1]); return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'image/png' }, body: PNG }); }
    if (path.startsWith('/storage/v1/object/markups/')) { db.uploads.push(path.split('/markups/')[1]); return ok(route, { Key: path.slice(18), Id: 'x' }); }
    if (path === '/rest/v1/okr_markups') {
      if (r.method() === 'POST') { const row = JSON.parse(r.postData()); db.inserted.push(row); db.markups.push({ status: 'new', issue_url: null, fixed_in: null, wont_fix_reason: null, status_by: null, status_at: null, created_at: new Date().toISOString(), ...row }); return ok(route, undefined, 201); }
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      if (r.method() === 'PATCH') { const patch = JSON.parse(r.postData()); db.patches.push(patch); const m = db.markups.find((x) => x.id === id); Object.assign(m, patch); return ok(route, [m]); }
      return ok(route, id ? db.markups.filter((x) => x.id === id) : [...db.markups].reverse());
    }
    if (path.startsWith('/auth/v1/')) { db.signIns++; return ok(route, { message: 'no sign-in in the open inbox' }, 404); }
    return ok(route, { message: 'not in the fake' }, 404);
  });
  return { db };
}

/** Sends a markup of Home from the demo, as the person on this page. */
async function sendHomeMarkup(p, device, line) {
  await p.locator('.page.home').waitFor();
  await p.waitForTimeout(500);
  await p.keyboard.press('Control+Shift+M');
  await markupBar(p).waitFor({ timeout: 15000 });
  const vp = DEVICES[device];
  await drag(p, [vp.width * 0.3, vp.height * 0.3], [vp.width * 0.7, vp.height * 0.35]);
  await markupBar(p).getByRole('button', { name: 'Next', exact: true }).click();
  const send = p.getByRole('dialog', { name: 'Send the markup' });
  await send.locator('.mk-preview img').waitFor();
  await send.getByLabel('What should change?').fill(line);
  await send.getByRole('button', { name: 'Send', exact: true }).click();
  await see(p, 'Sent. You’ll hear when it’s fixed.');
}

/** A tab's count, as the inbox shows it. */
const tabCount = async (inbox, name) => Number((await inbox.getByRole('tab', { name: new RegExp('^' + name) }).locator('.ibx-tab-count').innerText()).trim() || NaN);
/** On a phone an open item takes the screen: back to the list (and its tabs) first. */
const toInboxList = async (h, inbox) => { const back = inbox.getByRole('button', { name: 'Back to the list' }); if (await back.isVisible().catch(() => false)) await h.click(back); };

journey('U42', ['MARKUP', 'MARKUP-INBOX', 'FEEDBACK-INBOX'], 'Anyone opens the inbox with no sign-in, opens a markup, toggles the drawing, marks it in hand and undoes it, opens its GitHub issue and keeps the link, and marks it fixed; then marks a piece of feedback in hand', 23, async (h, device) => {
  if (!DOWN) fail('U42 needs the build with a database address (DOWN)');
  const down = (path) => DOWN + '/demo' + path + (path.includes('?') ? '&' : '?') + 'today=' + TODAY;
  const p = h.use(await newPage(device, 'rhea'));
  const { db } = await fakeSupabase(p.context());
  // Rhea marks up Home in the demo (her markup goes to the database, marked demo), with the shortcut.
  await p.goto(down('/'));
  await sendHomeMarkup(p, device, 'The week strip should say which week it is');
  const sent = db.markups[0];
  const shared = !!sent && sent.demo === true && db.issued.includes(sent.id) && ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'].every((x) => db.uploads.includes(`${sent.id}/${x}`)) && sent.route === '/' && !('status' in db.inserted[0]);
  // The inbox, a section of Workspace: open, no sign-in and no token to paste.
  await p.goto(down('/workspace/inbox'));
  const inbox = p.locator('#inbox');
  const row = inbox.locator('.ibx-row').first();
  await row.waitFor({ timeout: 10000 });
  h.set('entry', await inbox.locator('input[type=email], input[type=password]').count() === 0 && await inbox.getByText(/Sign in/).count() === 0, 'the inbox still asks to sign in or for a token');
  h.set('attention', await row.locator('.mk-status').innerText() === 'New' && (await row.innerText()).includes('The week strip should say which week it is') && (await row.innerText()).includes('the demo'), 'the markup is not listed as New, with its line and where it came from');
  await h.checkpoint('inbox');
  // Connect Claude opens from the top: in the demo it says tokens are made in the real app, and gives the set-up.
  await h.click(inbox.getByRole('button', { name: 'Connect Claude' }));
  const connect = inbox.locator('.connect');
  const atTop = await inbox.evaluate((el) => { const c = el.querySelector('.connect'); const l = el.querySelector('.ibx-list'); return !!c && !!l && !!(c.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); });
  const setUp = (await connect.getByLabel('Claude Code command', { exact: true }).inputValue()).includes('/api/mcp --header "Authorization: Bearer gk_');
  const says = await see(connect, 'any token from it reads the demo’s markups too').then(() => true, () => false);
  h.set('finish', atTop && setUp && says && await see(connect, 'Pictures for Claude: ready').then(() => true, () => false), `Connect Claude at the top ${atTop}, set-up ${setUp}, says any token works ${says}`);
  await inbox.getByRole('button', { name: 'Connect Claude' }).click();
  await h.click(row.locator('.ibx-open'));
  const detail = inbox.getByRole('article', { name: /^Markup: / });
  await detail.locator('.mk-layers img').first().waitFor();
  const drawn = await detail.locator('.mk-ink-layer').count();
  await h.click(detail.getByLabel('Show the drawing'));
  const hidden = await detail.locator('.mk-ink-layer').count();
  await h.checkpoint('markup');
  // Mark in hand: it leaves New and the next item (the feedback) opens; Undo puts the markup back as it was.
  await h.click(detail.getByRole('button', { name: 'Mark in hand' }));
  await inbox.getByRole('article', { name: /^Feedback: / }).waitFor({ timeout: 5000 }).catch(() => fail('handling the markup did not open the next item'));
  await see(inbox, 'Marked in hand: “The week strip', 'the inbox does not say what was just done');
  await h.click(inbox.getByRole('button', { name: 'Undo' }));
  await see(detail.locator('.mk-status').first(), 'New', 'Undo did not put the markup back to New');
  h.set('errors', db.markups[0].status === 'new' && db.patches.length === 2, `after Undo the markup is ${db.markups[0].status}, ${db.patches.length} changes saved`);
  await h.click(detail.getByRole('button', { name: 'Mark in hand' }));
  // In hand: open it there, say who marked it, open its GitHub issue and keep the link, then mark it fixed.
  await toInboxList(h, inbox);
  await h.click(inbox.getByRole('tab', { name: /^In hand/ }));
  await h.click(inbox.locator('.ibx-row').first().locator('.ibx-open'));
  await see(detail.locator('.mk-status').first(), 'In hand', 'not marked in hand');
  await see(detail, 'Marked in hand by Rhea Kapoor', 'the markup does not say who marked it');
  const [tab] = await Promise.all([p.context().waitForEvent('page'), h.click(detail.getByRole('button', { name: 'Open GitHub issue' }))]);
  // The address the app opened. GitHub sends a browser that isn't signed in on to its sign-in page, with that address
  // as return_to (a public repository does this since 8 Nov), so read it from there when it has.
  const opened = new URL(tab.url());
  const issue = opened.pathname === '/login' && opened.searchParams.get('return_to') ? new URL(opened.searchParams.get('return_to'), 'https://github.com') : opened;
  await tab.close();
  await h.fill(detail.getByLabel('Paste issue link'), 'https://github.com/sconies/goals-app/issues/101');
  await h.click(detail.getByRole('button', { name: 'Keep the link' }));
  await see(detail, 'sconies/goals-app/issues/101', 'the issue link is not shown');
  await h.click(detail.getByRole('button', { name: 'Mark fixed', exact: true }));
  await h.click(detail.locator('.mk-form').getByRole('button', { name: 'Mark fixed' }));
  await see(inbox, 'Nothing is in hand.', 'the fixed markup is still in hand');
  const m = db.markups[0];
  const link = issue.origin + issue.pathname === 'https://github.com/sconies/goals-app/issues/new' && /The week strip/.test(issue.searchParams.get('title') || '') && (issue.searchParams.get('body') || '').includes(`/workspace/inbox?markup=${m.id}`);
  h.set('finish', drawn === 1 && hidden === 0 && link, `drawing layer ${drawn} then ${hidden}; issue link ${tab.url().slice(0, 160)}`);
  h.set('logged', shared && db.signIns === 0 && db.pictureReads.includes(`${m.id}/screen.png`)
    && m.status === 'fixed' && m.fixed_in && m.issue_url === 'https://github.com/sconies/goals-app/issues/101' && m.status_by === 'Rhea Kapoor' && db.patches.length === 5,
  `sent ${shared}, sign-ins ${db.signIns}, pictures ${JSON.stringify(db.pictureReads)}, stored ${JSON.stringify({ status: m.status, fixed: m.fixed_in, issue: m.issue_url, by: m.status_by, patches: db.patches.length })}`);
  // Feedback sent with a mood and a few words is in the same inbox, with the same states.
  await toInboxList(h, inbox);
  await h.click(inbox.getByRole('tab', { name: /^New/ }));
  const fbRow = inbox.locator('.ibx-row').filter({ has: p.locator('.fb-item') }).first();
  const fbText = await fbRow.innerText();
  h.set('attention', await fbRow.locator('.mk-status').innerText() === 'New' && fbText.includes('The reason box is too small on a phone') && fbText.includes('Feedback') && fbText.includes('Mateo Silva, Acme'), `the feedback is not listed as New, with its words and who sent it: ${fbText.replace(/\n/g, ' | ')}`);
  await h.click(fbRow.locator('.ibx-open'));
  const fbDetail = inbox.getByRole('article', { name: /^Feedback: / });
  await h.click(fbDetail.getByRole('button', { name: 'Mark in hand' }));
  await see(inbox, 'Nothing new.', 'the inbox does not say there is nothing new');
  const fp = db.fbPatches[0] || {};
  h.set('logged', db.fbPatches.length === 1 && fp.status === 'in-hand' && fp.status_by === 'Rhea Kapoor' && db.feedback[0].status === 'in-hand', `feedback stored ${JSON.stringify(db.fbPatches)}`);
  await p.context().close();
}, ['progress']);

journey('U47', ['CONNECT-CLAUDE', 'MARKUP-INBOX'], 'Someone else, in another browser, opens the inbox with no sign-in, sees a markup sent from the demo with its picture, says why it won’t be fixed and sees who said so', 12, async (h, device) => {
  if (!DOWN) fail('U47 needs the build with a database address (DOWN)');
  const down = (path) => DOWN + '/demo' + path + (path.includes('?') ? '&' : '?') + 'today=' + TODAY;
  // Rhea marks up Home in the demo.
  const sender = await newPage(device, 'rhea');
  const { db } = await fakeSupabase(sender.context());
  await sender.goto(down('/'));
  await sendHomeMarkup(sender, device, 'Say which week the strip is showing');
  await sender.context().close();
  // Grace, in a browser of her own, opens the inbox: no sign-in, no token.
  const p = h.use(await newPage(device, 'grace'));
  const other = await fakeSupabase(p.context());
  other.db.markups.push(...db.markups);
  await p.goto(down('/workspace/inbox'));
  const inbox = p.locator('#inbox');
  const row = inbox.locator('.ibx-row').filter({ has: p.locator('.mk-item') }).first();
  await row.waitFor({ timeout: 10000 });
  const rowText = await row.innerText();
  h.set('entry', await inbox.locator('input[type=email], input[type=password]').count() === 0, 'the inbox still asks for a sign-in or a token');
  h.set('attention', rowText.includes('Say which week the strip is showing') && rowText.includes('the demo') && await row.locator('.mk-status').innerText() === 'New', `the markup from the demo is not listed as New: ${rowText.replace(/\n/g, ' | ')}`);
  await h.checkpoint('inbox');
  await h.click(row.locator('.ibx-open'));
  const detail = inbox.getByRole('article', { name: /^Markup: / });
  await detail.locator('.mk-layers img').first().waitFor();
  const shown = await detail.locator('.mk-layers img').first().evaluate((img) => img.complete && img.naturalWidth > 0);
  await h.click(detail.getByRole('button', { name: 'Won’t fix' }));
  h.set('errors', await detail.locator('.mk-form').getByRole('button', { name: 'Won’t fix' }).isDisabled() && other.db.patches.length === 0, 'a markup can be marked won’t fix with no reason');
  await h.fill(detail.getByLabel('Why it won’t be fixed'), 'The strip already says the week on wider screens.');
  await h.click(detail.locator('.mk-form').getByRole('button', { name: 'Won’t fix' }));
  // It leaves New for Closed, where it says who closed it and why.
  await toInboxList(h, inbox);
  await h.click(inbox.getByRole('tab', { name: /^Closed/ }));
  await h.click(inbox.locator('.ibx-row').first().locator('.ibx-open'));
  await see(detail.locator('.mk-status').first(), 'Won’t fix', 'not marked won’t fix');
  const by = await see(detail, 'Marked won’t fix by Grace').then(() => true, () => false);
  const m = other.db.markups[0];
  h.set('finish', shown && by, `picture shown ${shown}, says who ${by}`);
  h.set('logged', !!m && m.status === 'wont-fix' && /^Grace/.test(m.status_by || '') && other.db.pictureReads.includes(`${m.id}/screen.png`) && other.db.signIns === 0,
    `stored ${JSON.stringify(m && { status: m.status, by: m.status_by })}, pictures read ${JSON.stringify(other.db.pictureReads)}, sign-ins ${other.db.signIns}`);
  await p.context().close();
}, ['progress']);

/* Backlog W (8 Nov): Workspace in sections, and an inbox that works at 75 items. */
/** 75 inbox items, as the database keeps them: 45 markups (6 on one part of Home, 3 on a goal page's scorecard, 36
    elsewhere) and 30 pieces of feedback, from five people, over the last three weeks. */
function seed75() {
  const people = [['rhea', 'Rhea Kapoor'], ['mateo', 'Mateo Silva'], ['amara', 'Amara Okafor'], ['jun', 'Jun Park'], ['oskar', 'Oskar Lind']];
  const pages = ['/', '/goals', '/goals/:goalId', '/check-in/:goalId', '/reviews/:reviewId', '/activity', '/data', '/workspace/people'];
  const at = (i) => new Date(Date.parse('2026-11-05T09:00:00Z') - i * 6.5 * 3600e3).toISOString();
  const ctx = { viewport: { w: 1440, h: 900, dpr: 2 }, theme: 'light', themeChoice: 'light', accent: 'teal', appVersion: 'w', sessionId: 's' };
  const markups = [];
  for (let i = 0; i < 45; i++) {
    const [pid, pname] = people[i % 5];
    const part = i < 6 ? ['Home', 'Week strip'] : i < 9 ? ['Goal page', 'Scorecard'] : [['Goals', 'Table'], ['Check-in', 'Reason'], ['Review', 'Agenda'], ['Activity', 'Filters'], ['Data', 'Toolbar'], ['People', 'Directory']][i % 6].concat(['Part ' + i]);
    const route = i < 6 ? '/' : i < 9 ? '/goals/:goalId' : pages[(i % 7) + 1];
    const line = i < 6 ? `The week strip should say which week it is (${i + 1})` : i < 9 ? `The scorecard needs a label for the target (${i - 5})` : `Seeded markup ${i}: ${part[1].toLowerCase()} could be clearer`;
    markups.push({ id: 'mk_seed' + String(i).padStart(3, '0'), workspace_id: 'platform-org', workspace_name: 'Platform Engineering', demo: true, person_id: pid, person_name: pname, line, mood: null,
      route, path: route.replace(':goalId', 'ns-lead').replace(':reviewId', 'weekly'), goal_id: null, review_id: null, parts: [[part]], strokes: [{ kind: 'box', x: 10, y: 10, w: 100, h: 40 }], context: ctx, steps: [], errors: [], pictures: [],
      status: 'new', issue_url: null, fixed_in: null, wont_fix_reason: null, status_by: null, status_at: null, created_at: at(i * 1.3) });
  }
  const moods = ['good', 'meh', 'bad'];
  const feedback = [];
  for (let i = 0; i < 30; i++) {
    const [pid, pname] = people[(i + 2) % 5];
    feedback.push({ id: 'fb_seed' + String(i).padStart(3, '0'), workspace_id: i % 4 ? 'platform-org' : 'acme', workspace_name: i % 4 ? 'Platform Engineering' : 'Acme', person_id: pid, person_name: pname,
      path: pages[i % pages.length].replace(':goalId', 'ns-lead').replace(':reviewId', 'weekly'), mood: moods[i % 3], text: i % 7 === 3 ? '' : `Seeded feedback ${i}: ${['the chart is hard to read', 'love the check-in', 'too many clicks to find my team', 'what does stale mean?', 'the reason box is small'][i % 5]}`,
      at: at(i * 1.9 + 0.5), status: 'new', fixed_in: null, wont_fix_reason: null, status_by: null, status_at: null });
  }
  return { markups, feedback };
}


journey('U51', ['WORKSPACE-SECTIONS'], 'Each Workspace section opens at its own address, from the menu on a computer and the list on a phone; someone who isn’t an admin sees only Overview, People, Teams and Inbox, and old links still land', 14, async (h, device) => {
  const SECTIONS = [['overview', 'Overview'], ['people', 'People'], ['teams', 'Teams'], ['inbox', 'Inbox'], ['cycles', 'Cycles'], ['access', 'Access'], ['features', 'Features'], ['privacy', 'Privacy'], ['removed', 'Recently removed']];
  const phone = device === 'phone';
  const p = h.use(await newPage(device, 'grace'));
  await p.goto(url('/workspace'));
  // A side menu on a computer, the overview beside it; a list of the sections on a phone.
  const menu = phone ? p.getByRole('list', { name: 'Workspace sections' }) : p.getByRole('navigation', { name: 'Workspace sections' });
  await menu.waitFor();
  const labels = (await menu.getByRole('link').allInnerTexts()).map((x) => x.split(/\n| · /)[0].trim());
  h.set('attention', JSON.stringify(labels) === JSON.stringify(SECTIONS.map(([, l]) => l)), `an admin’s sections are ${labels.join(', ')}`);
  // A long workspace name wraps to two lines in the sidebar, then ends with … and the full name on hover.
  if (!phone) {
    await p.evaluate(() => { const n = document.querySelector('.side .ws-name'); if (n) n.textContent = 'Voss Test Workspace for the platform engineering off-site in November'; });
    const nm = await p.evaluate(() => { const n = document.querySelector('.side .ws-name'); const lh = parseFloat(getComputedStyle(n).lineHeight); return { lines: Math.round(n.getBoundingClientRect().height / lh), clipped: n.scrollHeight > n.clientHeight + 1, hover: n.closest('[title]')?.getAttribute('title') || '' }; });
    h.set('attention', nm.lines === 2 && nm.clipped && nm.hover.length > 0, `a long workspace name shows on ${nm.lines} lines (clipped ${nm.clipped}, hover “${nm.hover}”)`);
    await p.reload(); await menu.waitFor();
  }
  h.set('progress', phone ? await p.locator('.ws-menu').count() === 0 && await p.locator('.ws-counts').count() === 0 : await p.locator('.ws-counts').isVisible(), phone ? 'a phone shows the side menu or the overview instead of the list' : 'a computer does not show the overview beside the menu');
  await h.checkpoint('sections');
  // Into a section and back, from the menu or the list: its address, its heading, and (on a phone) the way back.
  await h.click(menu.getByRole('link', { name: /^People/ }));
  await p.waitForURL(/\/workspace\/people(\?|$)/);
  await p.getByRole('button', { name: 'Add a person' }).waitFor();
  const heading = phone ? await p.locator('.page-head h1').innerText() : await p.locator('.ws-body h2').first().innerText();
  h.set('entry', heading === 'People' && await p.getByRole('button', { name: 'Add a person' }).isVisible(), `People opened with the heading “${heading}”`);
  await h.inView(p.getByRole('button', { name: 'Add a person' }), 'entry', 'Add a person');
  await h.checkpoint('people');
  if (phone) { await h.click(p.getByRole('link', { name: 'Workspace', exact: true })); await menu.waitFor(); }
  else h.set('attention', await menu.getByRole('link', { name: /^People/ }).getAttribute('aria-current') === 'page', 'the menu does not mark the section that’s open');
  // Every address opens its own section, with one main action at most.
  const broken = [];
  for (const [id, label] of SECTIONS) {
    await p.goto(url('/workspace/' + id));
    await p.locator('.page-head').first().waitFor();
    const title = phone ? await p.locator('.page-head h1').innerText() : await p.locator('.ws-body h2').first().innerText().catch(() => '');
    const primaries = await p.locator('.ws-body .btn.primary:visible').count();
    if (title !== label || await p.getByText('Page not found').count() || primaries > 1) broken.push(`${id}: “${title}”, ${primaries} main actions`);
  }
  h.set('finish', !broken.length, `sections that don’t open as themselves: ${broken.join('; ')}`);
  // Old links: the inbox's from a GitHub issue, and the one-page Workspace's anchors.
  await p.goto(url('/workspace?inbox=1&markup=mk_old'));
  const toInbox = await p.waitForURL(/\/workspace\/inbox\?markup=mk_old/, { timeout: 5000 }).then(() => true, () => false);
  await p.goto(BASE + '/demo/workspace?today=' + TODAY + '#people');
  const toPeople = await p.waitForURL(/\/workspace\/people/, { timeout: 5000 }).then(() => true, () => false);
  h.set('errors', toInbox && toPeople, `old links: the inbox’s ${toInbox}, #people ${toPeople}`);
  // Someone who isn't an admin: Overview, People, Teams and Inbox, and an admins' section says whose it is.
  await viewAs(p, 'Oskar');
  await p.goto(url('/workspace'));
  await menu.waitFor();
  const theirs = (await menu.getByRole('link').allInnerTexts()).map((x) => x.split(/\n| · /)[0].trim());
  await p.goto(url('/workspace/access'));
  const told = await see(p, 'Access is for the workspace’s admins.').then(() => true, () => false);
  h.set('attention', JSON.stringify(theirs) === JSON.stringify(['Overview', 'People', 'Teams', 'Inbox']) && told && await p.getByRole('button', { name: 'Make a token' }).count() === 0, `someone who isn’t an admin sees ${theirs.join(', ')}; told Access is for admins ${told}`);
  await p.context().close();
}, ['logged']);

journey('U52', ['INBOX-TRIAGE', 'MARKUP-INBOX', 'FEEDBACK-INBOX'], 'Anyone works an inbox of 75 markups and pieces of feedback down to nothing new: a folded row handled together, keys or Next, filters and search, and batches closed a page at a time', 30, async (h, device) => {
  if (!DOWN) fail('U52 needs the build with a database address (DOWN)');
  const down = (path) => DOWN + '/demo' + path + (path.includes('?') ? '&' : '?') + 'today=' + TODAY;
  const phone = device === 'phone';
  const p = h.use(await newPage(device, 'grace'));
  const { db } = await fakeSupabase(p.context());
  const seeded = seed75();
  db.markups.push(...seeded.markups);
  db.feedback.splice(0, db.feedback.length, ...seeded.feedback);
  await p.goto(down('/workspace/inbox'));
  const inbox = p.locator('#inbox');
  await inbox.locator('.ibx-row').first().waitFor({ timeout: 10000 });
  await h.inView(inbox.locator('.ibx-row').first(), 'entry', 'the newest item');
  // 75 new, in 68 rows (6 markups on Home's week strip fold into one, 3 on a goal's scorecard into another), 25 a page.
  const rows = inbox.locator('.ibx-row');
  const menuSays = phone ? '75 new' : (await p.locator('.ws-menu-item', { hasText: 'Inbox' }).locator('.ws-menu-note').innerText()).trim();
  h.set('attention', await tabCount(inbox, 'New') === 75 && await rows.count() === 25 && menuSays === '75 new' && await see(inbox, '1–25 of 68').then(() => true, () => false)
    && await see(rows.first(), '6 on this part').then(() => true, () => false), `New ${await tabCount(inbox, 'New')}, ${await rows.count()} rows on the page, the menu says “${menuSays}”`);
  await h.checkpoint('inbox of 75');
  // Search finds the folded row; it opens, and marking it in hand marks all 6.
  await h.fill(inbox.getByLabel('Search the inbox'), 'week strip');
  await rows.first().waitFor();
  const found = await rows.count();
  await h.click(rows.first().locator('.ibx-open'));
  const detail = inbox.getByRole('article', { name: /^Markup: / });
  await see(detail, '6 on this part.', 'the folded row does not say it holds 6');
  await h.click(detail.getByRole('button', { name: 'Mark in hand (all 6)' }));
  await see(inbox, 'Nothing here matches.', 'the folded row is still in New');
  const sixInHand = db.markups.filter((m) => /week strip/.test(m.line) && m.status === 'in-hand').length;
  await h.click(inbox.getByRole('button', { name: 'Clear the filters' }));
  // Filters: feedback only, then one person.
  if (phone) await h.click(inbox.getByRole('button', { name: /^Filters/ }));
  await inbox.getByLabel('Kind').selectOption('feedback');
  await p.waitForTimeout(200);
  const kinds = await inbox.locator('.ibx-row .mk-item').count();
  const fbNew = await tabCount(inbox, 'New');
  await inbox.getByLabel('Kind').selectOption('all');
  await inbox.getByLabel('Person').selectOption('Jun Park');
  await p.waitForTimeout(200);
  const jun = (await inbox.locator('.ibx-row').allInnerTexts()).every((x) => x.includes('Jun Park'));
  await inbox.getByLabel('Person').selectOption('');
  h.set('finish', found === 1 && sixInHand === 6 && kinds === 0 && fbNew === 30 && jun, `search found ${found}; ${sixInHand} of 6 in hand; feedback filter left ${kinds} markups and counts ${fbNew}; person filter ${jun}`);
  // One at a time: keys on a computer (J moves, I marks in hand, W won't fix), Next on a phone; each opens the next.
  const before = await tabCount(inbox, 'New');
  if (phone) {
    await h.click(rows.first().locator('.ibx-open'));
    await h.click(inbox.getByRole('button', { name: 'Next', exact: true }));
    await see(inbox, '2 of', 'Next did not go on to the second item');
    await h.click(inbox.locator('.ibx-detail').getByRole('button', { name: /^Mark in hand/ }));
    await see(inbox, '2 of', 'handling an item did not open the next one');
    await h.click(inbox.getByRole('button', { name: 'Back to the list' }));
  } else {
    const opened = async () => (await inbox.locator('.ibx-row[aria-current]').getAttribute('data-row'));
    const first = await opened();
    await p.locator('body').press('j');
    await p.waitForFunction((k) => document.querySelector('.ibx-row[aria-current]')?.getAttribute('data-row') !== k, first);
    const second = await opened();
    await p.keyboard.press('i');
    await p.waitForFunction((k) => !!document.querySelector('.ibx-row[aria-current]') && document.querySelector('.ibx-row[aria-current]').getAttribute('data-row') !== k, second);
    await p.keyboard.press('w');
    await h.fill(inbox.getByLabel('Why it won’t be fixed'), 'Seen it: already on the list.');
    await h.click(inbox.locator('.ibx-detail .mk-form').getByRole('button', { name: 'Won’t fix' }));
    h.set('progress', first !== second, 'J did not move to the next row');
  }
  await p.waitForTimeout(300);
  const after = await tabCount(inbox, 'New');
  h.set('progress', after === before - (phone ? 1 : 2), `one at a time: New went from ${before} to ${after}`);
  // A page at a time: tick the page and close the batch as won't fix, until nothing is new.
  let rounds = 0;
  while (await tabCount(inbox, 'New') > 0 && rounds++ < 5) {
    const n = await tabCount(inbox, 'New');
    await h.click(inbox.getByLabel('Select this page'));
    await h.click(inbox.getByRole('button', { name: 'Won’t fix…' }));
    await h.fill(inbox.locator('.ibx-bulk').getByLabel('Why it won’t be fixed'), 'Closed in the triage of 8 November.');
    await h.click(inbox.locator('.ibx-bulk .mk-form').getByRole('button', { name: /^Won’t fix \d+/ }));
    await p.waitForFunction((k) => Number(document.querySelector('.ibx-tab[aria-selected=true] .ibx-tab-count')?.textContent) < k, n, { timeout: 10000 });
    if (rounds === 1) await h.checkpoint('a batch closed');
  }
  await see(inbox, 'Nothing new.', 'the inbox does not say there is nothing new');
  const menuAfter = phone ? 'Nothing new' : (await p.locator('.ws-menu-item', { hasText: 'Inbox' }).locator('.ws-menu-note').innerText()).trim();
  // What's in hand, fixed in a batch.
  await h.click(inbox.getByRole('tab', { name: /^In hand/ }));
  await h.click(inbox.getByLabel('Select this page'));
  await h.click(inbox.getByRole('button', { name: 'Mark fixed…' }));
  await h.click(inbox.locator('.ibx-bulk .mk-form').getByRole('button', { name: /^Mark \d+ fixed/ }));
  await see(inbox, 'Nothing is in hand.', 'the batch was not marked fixed');
  const closed = await tabCount(inbox, 'Closed');
  const all = [...db.markups, ...db.feedback];
  h.set('errors', menuAfter === 'Nothing new' && closed === 75, `the menu says “${menuAfter}”; Closed holds ${closed}`);
  h.set('logged', all.length === 75 && all.every((x) => (x.status === 'fixed' || x.status === 'wont-fix') && /^Grace/.test(x.status_by || '')), `not all closed by Grace: ${all.filter((x) => !(x.status === 'fixed' || x.status === 'wont-fix')).map((x) => x.id + ' ' + x.status).slice(0, 5).join(', ')}`);
  await p.context().close();
});

/* Release 1b: remove, archive and undo. */
const liveCycle = (s) => [...s.cycles].filter((c) => !c.removedAt).sort((a, b) => a.startDate.localeCompare(b.startDate)).filter((c) => c.startDate <= '2026-11-12').pop();

journey('U43', ['PERSON-LEFT', 'UNDO-REMOVE', 'REMOVE-ANYTHING'], 'An admin marks someone as left: first who takes over their goals and asks, then they leave every list, and history keeps their name', 10, async (h, device) => {
  const p = h.use(await newPage(device, 'grace'));
  await p.goto(url('/workspace/people'));
  await p.locator('.page-head').first().waitFor();
  const s0 = await h.snapshot();
  const cycle = liveCycle(s0).id;
  const owned = s0.goals.filter((g) => g.ownerId === 'mateo' && g.cycleId === cycle && !g.removedAt && !g.stoppedAt).map((g) => g.id);
  await h.fill(p.getByPlaceholder('Find by name, role or team'), 'Mateo');
  await h.click(p.getByRole('button', { name: /Mateo Fernández/ }).first());
  await h.click(p.getByRole('dialog').getByRole('button', { name: 'Mark as left…' }));
  const dlg = p.getByRole('dialog', { name: 'Mark Mateo Fernández as left' });
  await dlg.waitFor();
  // It asks who takes over first: marking him as left with no one chosen says what's missing and saves nothing.
  await see(dlg, `Who takes over Mateo’s ${owned.length} goal`, 'the dialog does not ask who takes over his goals');
  await h.click(dlg.getByRole('button', { name: 'Mark as left' }));
  await see(dlg, 'Choose who takes them over.', 'marking him as left with no one chosen did not say what was missing');
  h.set('errors', !(await h.snapshot()).people.find((x) => x.id === 'mateo').leftAt, 'he was marked as left with no one taking over');
  await h.checkpoint('mark as left');
  await dlg.getByLabel(/Who takes over Mateo’s \d+ goals?/).selectOption({ label: 'Marisol Duarte' });
  await h.click(dlg.getByRole('button', { name: 'Mark as left' }));
  await see(p, 'Mateo Fernández is marked as left', 'no message that he left');
  h.set('attention', await p.locator('.toast-action').filter({ hasText: 'Undo' }).isVisible(), 'the message has no Undo');
  // Gone from the directory; on Recently removed (its own section), with Restore.
  await see(p, 'No one matches', 'Mateo is still in the directory');
  await p.goto(url('/workspace/removed'));
  const removed = p.locator('.removed-block');
  await see(removed, 'Person who left', 'Recently removed does not list him');
  await see(removed, 'Mateo Fernández');
  await h.checkpoint('after');
  const s1 = await h.snapshot();
  const m = s1.people.find((x) => x.id === 'mateo');
  const handed = owned.every((id) => s1.goals.find((g) => g.id === id).ownerId === 'marisol');
  const open = (s1.requests || []).filter((r) => r.status === 'open' && (r.askedBy === 'mateo' || r.recipientId === 'mateo')).length;
  h.set('finish', !!m.leftAt && m.leftBy === 'grace' && handed && open === 0, `left ${m.leftAt}; goals handed over ${handed}; ${open} open asks still his`);
  const log = s1.changes.filter((c) => c.at > (s0.changes.at(-1)?.at ?? ''));
  h.set('logged', log.some((c) => c.entity === 'person' && c.action === 'left' && c.entityId === 'mateo') && log.filter((c) => c.entity === 'goal' && /as Mateo Fernández left/.test(c.summary)).length === owned.length, `logged: ${log.map((c) => c.summary).join(' | ').slice(0, 200)}`);
  // History keeps his name, as "Name (left)".
  await p.goto(url('/activity?who=mateo'));
  await see(p, 'Mateo Fernández (left)', 'Activity does not name him as having left');
  h.set('progress', true);
  await p.context().close();
}, ['entry']);

journey('U44', ['GOAL-STOP', 'UNDO-REMOVE', 'REMOVE-ANYTHING'], 'An owner stops a goal with history, then deletes a goal set up by mistake and undoes it', 11, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
  await p.goto(url('/goals/ci-docker'));
  await p.locator('.goal-bar').first().waitFor();
  // A goal set up by mistake beside it, with no check-ins.
  await p.evaluate(async () => {
    const s = await window.__goalsStore.load('platform-org');
    const g = s.goals.find((x) => x.id === 'ci-docker');
    await window.__goalsStore.commit('platform-org', { goals: [{ ...g, id: 'g-mistake', key: undefined, title: 'Base image build time, again', parentId: g.parentId, version: 0, createdAt: new Date().toISOString() }], changes: [] });
  });
  await p.reload();
  await p.locator('.goal-bar').first().waitFor();
  const s0 = await h.snapshot();
  const kids = s0.goals.filter((g) => g.parentId === 'ci-docker' && !g.removedAt).map((g) => g.id);
  await goalMenu(h, p, 'Stop this goal');
  const dlg = p.getByRole('dialog', { name: 'Stop this goal' });
  await dlg.waitFor();
  // A stop needs its reason.
  await h.click(dlg.getByRole('button', { name: 'Stop the goal' }));
  await see(dlg, 'Say why, in a sentence', 'stopping without a reason did not ask for one');
  h.set('errors', !(await h.snapshot()).goals.find((g) => g.id === 'ci-docker').stoppedAt, 'it stopped without a reason');
  await h.fill(dlg.getByLabel('Why is it stopping?'), 'The platform team took base images over in October.');
  await h.checkpoint('stop dialog');
  // The chart as it is now: stopping carries on with the same page, so it isn't drawn again under the message.
  await p.evaluate(() => { const c = document.querySelector('.goal-chart svg.chart'); if (c) c.dataset.beforeStop = '1'; });
  await h.click(dlg.getByRole('button', { name: 'Stop the goal' }));
  await see(p, 'Stopped Base image build time', 'no message that it stopped');
  // A stopped goal makes no forecast: no "will it hit?" on its scorecard, no projection on its chart.
  const kept = await p.locator('.goal-chart svg.chart[data-before-stop="1"]').count();
  const forecasts = await p.locator('.sc-hit, .goal-chart .c-fc, .goal-chart .c-band').count();
  h.set('attention', kept === 1 && forecasts === 0, `the chart was ${kept ? 'kept' : 'drawn afresh'} when the goal stopped; ${forecasts} forecast marks on a stopped goal`);
  // Its page stays, marked Stopped with the reason, and no main button.
  await see(p.locator('.goal-bar'), 'Stopped', 'the page does not say Stopped');
  await see(p.locator('.goal-bar'), 'The platform team took base images over in October.', 'the page does not give the reason');
  const primary = await p.locator('.goal-bar .btn.primary').count();
  await h.checkpoint('stopped page');
  const s1 = await h.snapshot();
  const g1 = s1.goals.find((g) => g.id === 'ci-docker');
  const moved = kids.every((id) => s1.goals.find((g) => g.id === id).parentId === g1.parentId);
  h.set('attention', primary === 0 && moved, `${primary} main buttons on a stopped goal; goals feeding it moved up: ${moved}`);
  // The mistaken goal: no check-ins, so it's deleted; Undo brings it back.
  await p.goto(url('/goals/g-mistake'));
  await p.locator('.goal-bar').first().waitFor();
  await goalMenu(h, p, 'Delete this goal');
  await h.click(p.getByRole('dialog', { name: 'Delete this goal' }).getByRole('button', { name: 'Delete the goal' }));
  await see(p, 'Deleted Base image build time, again', 'no message that it was deleted');
  const listed = await p.locator('main').innerText();
  h.set('finish', !!g1.stoppedAt && g1.stopReason === 'The platform team took base images over in October.' && !listed.includes('Base image build time'), `stopped ${g1.stoppedAt}; Goals still lists it: ${listed.includes('Base image build time')}`);
  await h.checkpoint('undo');
  await h.click(p.locator('.toast-action').filter({ hasText: 'Undo' }));
  await see(p, 'Undone', 'Undo did not say it was done');
  const s2 = await h.snapshot();
  const back = s2.goals.find((g) => g.id === 'g-mistake');
  const log = s2.changes.filter((c) => c.goalId === 'g-mistake' || c.goalId === 'ci-docker').map((c) => c.action);
  h.set('logged', !back.removedAt && log.includes('stopped') && log.includes('removed') && log.includes('restored'), `the mistaken goal is ${back.removedAt ? 'still deleted' : 'back'}; logged ${log.slice(-4).join(', ')}`);
  h.set('progress', true);
  await p.context().close();
}, ['entry']);

journey('U45', ['IMPORT-UNDO', 'BULK-EDIT'], 'Undo an import: every row back as it was, and a row changed since skipped and listed', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'chen'));
  await p.goto(url('/quick-check-in'));
  const s0 = await h.snapshot();
  const g0 = (id) => s0.goals.find((g) => g.id === id);
  const jenkins = valueAt(g0('dep-jenkins'), NOW, 1.02), tests = valueAt(g0('cfr-tests'), NOW, 1.05);
  await h.fill(p.getByLabel(/Jenkins jobs still running: this week’s number/), jenkins);
  await h.fill(p.getByLabel(/Changes shipped with automated integration tests: this week’s number/), tests);
  await h.click(p.getByRole('button', { name: 'Post 2 check-ins' }));
  await see(p, 'Saved: 2 check-ins');
  // Someone corrects one of the two afterwards: undoing the import must leave that one alone.
  const imp = await p.evaluate(async () => {
    const s = await window.__goalsStore.load('platform-org');
    const entry = s.changes.filter((c) => c.action === 'imported').pop();
    const row = s.changes.find((c) => c.importId === entry.entityId && c.goalId === 'cfr-tests');
    await window.__goalsStore.commit('platform-org', { changes: [{ id: 'chg-corrected', at: new Date(Date.parse(entry.at) + 60_000).toISOString(), actorId: 'tariq', goalId: 'cfr-tests', entity: 'check-in', entityId: row.entityId, action: 'edited', summary: 'Corrected the check-in', diffs: [] }] });
    return entry.entityId;
  });
  await p.goto(url('/activity?kind=imports'));
  const undo = p.getByRole('button', { name: 'Undo this import' }).first();
  await undo.waitFor();
  await h.inView(undo, 'entry', 'Undo this import');
  await h.click(undo);
  // It asks first, and says what happens to rows changed since.
  await see(p, 'Rows changed since are skipped and listed', 'it does not say what happens to rows changed since');
  h.set('errors', !(await h.snapshot()).changes.some((c) => c.action === 'undone'), 'it undid the import before it was confirmed');
  await h.checkpoint('undo import');
  await h.click(p.getByRole('button', { name: 'Undo the import' }));
  await see(p, 'Undid the import: 1 row put back; 1 skipped', 'the message does not say what was put back and skipped');
  await see(p, 'skipped as changed since', 'Activity does not list the skipped row');
  await see(p, 'Undone', 'the import is not marked undone');
  await h.checkpoint('undone');
  const s1 = await h.snapshot();
  const posted = (id) => s1.checkIns.filter((c) => c.goalId === id && c.week === NOW && s1.changes.some((x) => x.importId === imp && x.entityId === c.id));
  const gone = posted('dep-jenkins').every((c) => !!c.removedAt), kept = posted('cfr-tests').every((c) => !c.removedAt);
  h.set('finish', posted('dep-jenkins').length === 1 && gone && kept, `Jenkins check-in removed ${gone}; the corrected one kept ${kept}`);
  const undone = s1.changes.find((c) => c.action === 'undone' && c.entityId === imp);
  h.set('logged', !!undone && undone.diffs.some((d) => d.field === 'Skipped' && /Changes shipped with automated integration tests/.test(d.to)), 'the undo is not logged with the row it skipped');
  h.set('attention', true);
  h.set('progress', true);
  await p.context().close();
});

/** A downloaded workbook as sheets of rows (line breaks kept), and those sheets saved as a workbook again: what someone
    editing it in Excel does, done with the same libraries the app uses. */
async function readWorkbook(file) {
  const read = require('read-excel-file/node');
  return (await read(file)).map((s) => ({ name: s.sheet, rows: s.data }));
}
async function writeWorkbook(sheets, file) {
  const write = require('write-excel-file/node');
  await write(sheets.map((s) => ({ sheet: s.name, data: s.rows.map((r) => r.map((c) => (c == null || c === '' ? null : { value: c }))) })), {}).toFile(file);
}

journey('U46', ['ONE-FORMAT', 'ROUND-TRIP', 'IMPORT-ACTIONS', 'PERSON-EMAIL', 'IMPORT-UNDO'], 'An admin exports everything, stops a goal and moves an owner by email in the workbook, loads it back to see exactly those changes, saves and undoes them; then fills in the emails people are missing', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'grace'));
  await p.goto(url('/goals'));
  // Export these goals, from the Goals screen (on the smallest phones, its icon).
  const direct = p.getByRole('button', { name: 'Export these goals' });
  await h.inView(direct, 'entry', 'Export these goals on the Goals screen');
  await h.click(direct);
  const sheet = p.getByRole('dialog', { name: 'Export goals' });
  await sheet.waitFor();
  await see(sheet, 'Results', 'the workbook does not say it has every sheet');
  await see(sheet, 'CSV files', 'the zipped CSVs are not offered beside the workbook');
  await h.checkpoint('export choices');
  const [xlsx] = await Promise.all([p.waitForEvent('download'), h.click(sheet.getByRole('button', { name: /Excel workbook/ }))]);
  const file = path.join(OUT, `U46-${device}.xlsx`);
  await xlsx.saveAs(file);
  const book = await readWorkbook(file);
  h.set('finish', ['Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'README'].every((n) => book.some((s) => s.name === n)), `the workbook has ${book.map((s) => s.name).join(', ')}`);
  // In Excel: stop one goal (with a reason) and give another a new owner by email; a line break in a Why.
  const s0 = await h.snapshot();
  const goals = book.find((s) => s.name === 'Goals').rows;
  const col = (name) => goals[0].indexOf(name);
  const stop = s0.goals.find((g) => g.ownerId === 'mateo' && s0.checkIns.some((c) => c.goalId === g.id) && !s0.goals.some((c) => c.parentId === g.id));
  const move = s0.goals.find((g) => g.ownerId === 'tariq' && g.id !== stop.id);
  const stopRow = goals.find((r) => r[col('Key')] === stop.key);
  stopRow[col('Action')] = 'Stop';
  stopRow[col('Reason')] = 'Folded into the incident review goal for the rest of the year.';
  goals.find((r) => r[col('Key')] === move.key)[col('Owner email')] = 'rhea.kapoor@example.com';
  const edited = path.join(OUT, `U46-${device}-edited.xlsx`);
  await writeWorkbook(book, edited);
  await p.keyboard.press('Escape');
  // Load it back on Data's Import: exactly those two changes, the stop shown as such, before anything is saved.
  await p.goto(url('/data'));
  await h.click(p.locator('.data-export > summary'));
  await h.click(p.locator('.data-export').getByRole('button', { name: 'Import a spreadsheet…' }));
  await see(p, 'Import from a spreadsheet');
  await p.getByLabel('Choose a spreadsheet').setInputFiles(edited);
  await see(p, '1 goal changed, 1 goal stopped', 'the preview does not say exactly the two changes');
  await see(p, 'Read Goals, Plan, Check-ins and People', 'the preview does not say which sheets it read');
  h.set('attention', await p.getByText(stop.title).first().isVisible() && await p.getByText(move.title).first().isVisible(), 'the preview does not name both goals');
  await p.locator('.change-goal summary').first().click();
  await h.checkpoint('import preview');
  h.set('errors', (await h.snapshot()).goals.find((g) => g.id === stop.id) && !(await h.snapshot()).changes.some((c) => c.action === 'stopped'), 'something was saved before Save');
  await h.click(p.getByRole('button', { name: 'Save 2 changes' }));
  await p.waitForURL(/\/goals$/);
  const s1 = await h.snapshot();
  const stopped = (s1.goals.find((g) => g.id === stop.id) || {});
  const moved = s1.goals.find((g) => g.id === move.id);
  h.set('finish', !!stopped.stoppedAt && stopped.stopReason === 'Folded into the incident review goal for the rest of the year.' && moved.ownerId === 'rhea', `stopped ${!!stopped.stoppedAt}, owner ${moved.ownerId}`);
  const imp = s1.changes.filter((c) => c.action === 'imported').pop();
  h.set('logged', !!imp && /Loaded a spreadsheet: 1 goal changed, 1 goal stopped/.test(imp.summary) && s1.changes.some((c) => c.importId === imp.entityId && c.action === 'stopped'), 'the import and the stop were not logged together');
  // Undo it from Activity: both put back.
  await p.goto(url('/activity?kind=imports'));
  await h.click(p.getByRole('button', { name: 'Undo this import' }).first());
  await h.click(p.getByRole('button', { name: 'Undo the import' }));
  await see(p, 'Undid the import', 'the undo does not say it was done');
  const s2 = await h.snapshot();
  h.set('finish', !s2.goals.find((g) => g.id === stop.id).stoppedAt && s2.goals.find((g) => g.id === move.id).ownerId === 'tariq', 'the undo did not put both goals back');
  // Workspace: someone added before emails existed is listed, and their email saved.
  await p.evaluate(async () => {
    const s = await window.__goalsStore.load('platform-org');
    const wen = s.people.find((x) => x.id === 'wen');
    await window.__goalsStore.commit('platform-org', { people: [{ ...wen, email: null }], changes: [] });
  });
  await p.goto(url('/workspace/people'));
  const list = p.getByRole('region', { name: /People without an email/ }).or(p.locator('section.missing-emails'));
  await list.first().waitFor();
  await see(p, 'People without an email · 1', 'Workspace does not list the person without an email');
  await h.fill(p.getByLabel('Wen Zhao: email'), 'Wen.Zhao@example.com');
  await h.checkpoint('missing emails');
  await h.click(p.getByRole('button', { name: 'Save 1 email' }));
  await see(p, 'Saved 1 email');
  const s3 = await h.snapshot();
  h.set('logged', s3.people.find((x) => x.id === 'wen').email === 'wen.zhao@example.com' && s3.changes.some((c) => c.entity === 'person' && c.entityId === 'wen' && c.diffs.some((d) => d.field === 'Email')), 'the email was not saved, lower case, and logged');
  h.set('progress', true);
  await p.context().close();
});

journey('U48', ['MODULES', 'SPREADSHEETS-ON-DATA'], 'An admin switches Spreadsheets off for the workspace: Data, Goals, Help and the old Import link lose it, the change is logged, and switching it back on brings it all back', 10, async (h, device) => {
  const p = h.use(await newPage(device, 'grace'));
  await p.goto(url('/workspace/features'));
  // An admin setting, down the Workspace page with the others: 'entry' is judged on everyday journeys, not this one.
  const box = p.getByRole('checkbox', { name: /^Spreadsheets/ });
  await box.scrollIntoViewIfNeeded();
  h.set('attention', await box.isChecked() && await p.getByRole('region', { name: 'Features' }).or(p.locator('section.features-block')).first().getByText('Download the goals as an Excel workbook').isVisible(), 'Features does not show Spreadsheets as on, with what it does');
  await h.checkpoint('features');
  await h.click(box);
  await see(p, 'Spreadsheets is off in');
  // Gone from Data and Goals; the address and the old link find nothing; Help no longer lists its articles.
  await p.goto(url('/data'));
  await p.locator('.data-tools').waitFor();
  const dataGone = !(await p.locator('.data-export').count());
  await p.goto(url('/goals'));
  await p.locator('.goals-toolbar').waitFor();
  const goalsGone = !(await p.getByRole('button', { name: 'Export these goals' }).count());
  await p.goto(url('/data/import'));
  await see(p, 'Page not found', 'Import still opens with spreadsheets off');
  await p.goto(url('/import'));
  await see(p, 'Page not found', 'the old Import link still leads somewhere with spreadsheets off');
  await p.goto(url('/help'));
  await see(p, 'Data in and out');
  const helpGone = !(await p.getByRole('link', { name: 'Importing from a spreadsheet' }).count());
  h.set('finish', dataGone && goalsGone && helpGone, `with spreadsheets off: Data's menu ${dataGone ? 'gone' : 'still there'}, Goals' export ${goalsGone ? 'gone' : 'still there'}, Help's article ${helpGone ? 'gone' : 'still listed'}`);
  const s = await h.snapshot();
  h.set('logged', s.changes.some((c) => c.entity === 'workspace' && c.actorId === 'grace' && c.summary === 'Switched off Spreadsheets' && c.diffs.some((d) => d.field === 'Spreadsheets' && d.to === 'Off')), 'the switch was not logged');
  // Back on: everything is back.
  await p.goto(url('/workspace/features'));
  await box.scrollIntoViewIfNeeded();
  await h.click(box);
  await see(p, 'Spreadsheets is on in');
  await p.goto(url('/data'));
  await p.locator('.data-export > summary').waitFor();
  await p.goto(url('/import'));
  await p.waitForURL(/\/data\/import/);
  await see(p, 'Import from a spreadsheet', 'Import did not come back');
  h.set('progress', true);
  h.set('errors', true);
  // Someone who isn't an admin sees no switches. (Import is a focused page with no Demo control on a phone: leave it first.)
  await p.goto(url('/workspace'));
  await p.locator('.page-head').waitFor();
  await viewAs(p, 'Oskar');
  await p.goto(url('/workspace/features'));
  await p.locator('.page-head').waitFor();
  if (await p.getByRole('checkbox', { name: /^Spreadsheets/ }).count()) fail('someone who isn’t an admin was offered the Features switches');
  await p.context().close();
}, ['entry']);

journey('U26', ['GOAL-MAP'], 'Find what will sink the north star on the goal map, and read its story', 8, async (h, device) => {
  const p = h.use(await newPage(device, 'amara'));
  await p.goto(url('/goals'));
  await h.click(p.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Map' }));
  const canvas = p.getByRole('region', { name: /Goal map/ });
  await canvas.waitFor();
  await p.locator('.react-flow__node').first().waitFor();
  // The critical path runs from the north star through the off-track input, and the map opens on it.
  const onPath = await p.locator('.react-flow__node[aria-label*="critical path"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  h.set('attention', onPath.includes('ns-lead') && onPath.includes('lead-merge') && onPath.includes('lead-mq') && !onPath.includes('lead-review'), `critical path: ${onPath.join(', ')}`);
  const access = p.locator('.react-flow__node[data-id="lead-mq"]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await access.boundingBox(), area = await canvas.boundingBox();
  h.set('entry', !!box && !!area && box.x >= area.x - 1 && box.x + box.width <= area.x + area.width + 1, 'the map does not open on the critical path');
  await h.checkpoint('map');
  // A goal opens its story beside the map.
  await h.click(access);
  const panel = p.getByRole('complementary', { name: /Merge queue live for every monorepo/ });
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
  const p = h.use(await newPage(device, 'rhea'));
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
  const g = s0.goals.find((x) => x.id === 'ci-docker');
  await h.fill(p.getByLabel('This week’s value'), valueAt(g, NOW, 1.02));
  await see(coach, 'step 3 of 4', 'the coach did not move on when the number was typed');
  h.set('progress', true);
  await h.click(p.locator('.focus-foot button[type=submit]'));
  if (await p.getByRole('button', { name: 'Post check-in' }).isVisible().catch(() => false)) await h.click(p.getByRole('button', { name: 'Post check-in' }));
  await see(coach, 'step 4 of 4', 'the coach did not notice the check-in was saved');
  await h.click(coach.getByRole('button', { name: 'Finish' }));
  h.set('finish', (await p.locator('.coach').count()) === 0, 'the coach did not close');
  h.set('attention', true);
  // Demo review, 8 Nov, item 4: with a check-in left as a draft, Home's button says "Pick up where you left off". The
  // walkthrough still points at it, and never says Rhea is all set while Home says a check-in is to do.
  await p.goto(url('/'));
  const start = p.locator('.hero a.btn.primary[href$="/check-in"]');
  if (await start.isVisible().catch(() => false)) {
    await start.click();
    await p.getByLabel('This week’s value').fill('1');
    await p.goto(url('/'));
    await see(p, 'Pick up where you left off', 'a half-typed check-in is not offered back on Home');
    const again = await demoPanel(p);
    await again.getByRole('button', { name: /Post your weekly check-in/ }).click();
    await coach.waitFor();
    await p.waitForTimeout(800);
    if (/all set/.test(await coach.innerText())) fail('with a check-in draft, the walkthrough says Rhea is all set while Home has one to do');
    if (!(await p.locator('.coach-ring').isVisible().catch(() => false))) fail('with a check-in draft, the walkthrough points at nothing');
  }
  await p.context().close();
}, ['errors', 'logged']);

journey('U28', ['RESEARCH'], 'A research session: first glances, a note pinned to the screen, a task result and a report', 16, async (h, device) => {
  const p = h.use(await newPage(device, 'rhea'));
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
  const p = h.use(await newPage(device, 'oskar'));
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
const P5 = (errors) => ({ id: 'P5', reqs: ['NO-ERRORS'], title: 'No console or page errors across every journey', pass: errors.length === 0, error: errors.slice(0, 4).join(' | ') || undefined });
  // F1–F8: the per-area fit-and-finish reports (4 Nov). Each area keeps its own checks in evals/finish/*.cjs.
async function finishChecks(add) {
  {
    const open = async (w, h, who, route, touch) => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch && w < 800 });
      // Who's looking is set before the app starts (as newPage does), so the page loads once, not twice: opening Home
      // first just to set it cost every check a whole extra load of the app and its example.
      if (who) await c.addInitScript((v) => { if (!sessionStorage.getItem('viewer-set')) { localStorage.setItem('goals-app-viewer:platform-org', v); sessionStorage.setItem('viewer-set', '1'); } }, who);
      const r = await c.newPage();
      await r.goto(url(route));
      // The example is built as the page opens: wait for the page itself first. On a slower machine (the CI runners) the
      // shell can still be empty here, with nothing moving yet, so the wait below ended at once and the measuring
      // landed part-way through the page's entrance: WA 10 read 27px for a 24px gap, the rows still 3px into their rise.
      await r.waitForFunction(() => {
        if (document.querySelector('.preboot, .boot')) return false;
        const main = document.querySelector('main');
        return !main || [...main.children].some((e) => !e.matches('.page-help'));
      }, null, { timeout: 15000 }).catch(() => {});
      // Then measure once the fade-in has finished, not part-way through it.
      await r.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'), null, { timeout: 3000 }).catch(() => {});
      return [c, r];
    };
    const pick = (process.env.FINISH || '').split(',').filter(Boolean);
    // finish/: the fit-and-finish areas; notes/: Lane's review notes (5 Nov). Each module names its requirements.
    for (const f of ['finish', 'notes'].flatMap((d) => fs.readdirSync(path.join(__dirname, d)).filter((x) => x.endsWith('.cjs')).sort().map((x) => path.join(__dirname, d, x)))) {
      const m = require(f);
      if (pick.length && !pick.includes(m.id)) continue;
      if (!want(m.id)) continue;
      let fails;
      const t0 = Date.now();
      try { fails = await m.run({ open, url, browser, down: DOWN }); } catch (e) { fails = [`check crashed: ${String(e.message || e).split('\n')[0]} (${(String(e.stack || '').match(/\/evals\/(?:finish|notes)\/[^\s)]+/) || [''])[0]})`]; }
      secs[m.id] = Math.round((Date.now() - t0) / 100) / 10;
      add(m.id, m.reqs ?? ['FIT-AND-FINISH-AREAS'], m.title ?? `Fit and finish, ${m.area}`, !fails.length, fails.slice(0, 8).join(' | '));
    }
  }
}

/** Results so far, so a check that throws loses only the checks after it (reported as one failure), not all of them. */
const platformOut = [];
async function platformChecks() {
  const out = platformOut;
  if (process.env.FINISH) { await finishChecks((id, reqs, title, pass, error) => out.push({ id, reqs, title, pass, error: pass ? undefined : error })); return out; }
  const add = (id, reqs, title, pass, error) => { out.push({ id, reqs, title, pass, error: pass ? undefined : error }); if (process.env.EVALS_PROGRESS) console.log(`  … ${id} ${pass ? 'ok' : 'FAIL ' + String(error).slice(0, 300)}`); };
  // How long each check took, to balance the shards (written to the results; the weights in shards.cjs come from here).
  let mark = Date.now();
  const lap = (id) => { if (want(id)) secs[id] = Math.round((Date.now() - mark) / 100) / 10; mark = Date.now(); };
  // Reduced motion switches animation off.
  if (want('P1')) {
    const ctx = await browser.newContext({ viewport: DEVICES.desktop, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(url('/'));
    await p.locator('.hero').waitFor();
    const anim = await p.$eval('.hero', (e) => getComputedStyle(e).animationName);
    add('P1', ['MOTION'], 'Animation switches off under reduced motion', anim === 'none', `hero animation is ${anim}`);
    await ctx.close();
  }
  lap('P1');
  // The demo keeps a comment through a reload at the example's full size (the dataset report's blocker), and says so
  // plainly when the browser won't keep it.
  if (want('P15')) {
    const cs = await browser.newContext({ viewport: DEVICES.desktop });
    const q = await cs.newPage();
    await q.goto(url('/'));
    await q.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'oskar'));
    await q.goto(url('/goals/ns-lead'));
    await q.getByLabel('Add a comment').fill('Kept after a reload, P15');
    await q.getByRole('button', { name: 'Post comment' }).click();
    await q.getByText('Kept after a reload, P15').first().waitFor().catch(() => {});
    await q.reload();
    let kept = false;
    try { await q.getByText('Kept after a reload, P15').first().waitFor({ timeout: 8000 }); kept = true; } catch { /* lost */ }
    const stored = await q.evaluate(() => Object.keys(localStorage).reduce((n, k) => n + k.length + (localStorage.getItem(k) || '').length, 0));
    const note = await q.locator('.save-note').count();
    // A browser that refuses to store: the next change says it lasts only for this visit.
    await q.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
    await q.getByLabel('Add a comment').fill('Only for this visit, P15');
    await q.getByRole('button', { name: 'Post comment' }).click();
    let said = false;
    try { await q.locator('.save-note').filter({ hasText: /last only until you reload/ }).waitFor({ timeout: 5000 }); said = true; } catch { /* not said */ }
    add('P15', ['DEMO-STORAGE'], 'A comment in the demo survives a reload, only the saves are stored, and a browser that refuses says so', kept && stored < 200_000 && note === 0 && said, `kept ${kept}, ${stored} characters stored, note before ${note}, said when full ${said}`);
    await cs.close();
  }
  lap('P15');
  // A dead database: a skeleton while waiting, then a clear error with Try again.
  if (DOWN && want('P2')) {
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
  lap('P2');
  // Every screen fits a phone with no sideways scroll and no serious a11y issues.
  for (const [device, vp] of Object.entries(DEVICES)) {
    if (!want(device === 'phone' ? 'P3' : 'P4')) continue;
    const c3 = await browser.newContext({ viewport: vp });
    const r = await c3.newPage();
    const problems = [];
    for (const [who, route] of [['rhea', '/'], ['amara', '/'], ['grace', '/'], ['oskar', '/'], ['ingrid', '/'], ['rhea', '/goals'], ['amara', '/goals'], ['rhea', '/goals?show=attention'], ['rhea', '/goals/ns-lead'], ['rhea', '/goals/lead-mq'], ['rhea', '/activity'], ['rhea', '/data'], ['grace', '/data?t=checkIns'], ['rhea', '/workspace'], ['grace', '/workspace/people'], ['grace', '/workspace/inbox'], ['grace', '/workspace/access'], ['amara', '/reviews'], ['amara', '/reviews/weekly'], ['jun', '/reviews/new'], ['rhea', '/watching'], ['oskar', '/watching'], ['jun', '/watching'], ['rhea', '/goals?show=levels'], ['jun', '/check-in'], ['tariq', '/goals/ns-ai/edit'], ['tariq', '/goals/new'], ['grace', '/workspace/new'], ['rhea', '/help'], ['rhea', '/help/status'], ['rhea', '/whats-new']]) {
      await r.goto(url(route));
      await r.evaluate((w) => localStorage.setItem('goals-app-viewer:platform-org', w), who);
      await r.reload();
      // The example is built when the page opens (about 300 ms); measure once it has settled, not mid fade-in.
      await r.locator('.page').first().waitFor({ timeout: 5000 }).catch(() => {});
      // Let entrance motion finish (the goal page's story runs up to 4s): a tile caught mid-fade isn't its real contrast.
      await r.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))), new Promise((res) => setTimeout(res, 5000))]));
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
        return !/on track|at risk|off track|stale|done|not started|no check-in|met|missed|no recent update|nothing is|late|slipping|on schedule|in progress|target reached|nothing flagged/i.test(near);
      }).map((e) => (e.closest('[class]')?.className || '').toString().split(' ')[0]));
      if (mute.length) problems.push(`${who} ${route}: ${mute.length} status shapes without a word (${[...new Set(mute)].join(', ')})`);
      (await shapeMismatches(r)).forEach((x) => problems.push(`${who} ${route}: ${x}`));
    }
    add(device === 'phone' ? 'P3' : 'P4', device === 'phone' ? ['PHONE', 'A11Y', 'SHAPE-MATCHES-WORD'] : ['A11Y', 'SHAPE-MATCHES-WORD'], `Every screen on ${device}: no sideways scroll, no serious accessibility issues, status as shape plus word`, !problems.length, problems.slice(0, 5).join(' | '));
    await c3.close();
    lap(device === 'phone' ? 'P3' : 'P4');
  }
  // P6: the design rules (docs/design-rules.md), on every screen and every Goals layout, at phone and desktop width.
  const design = [];
  for (const [device, vp] of want('P6') ? Object.entries(DEVICES) : []) {
    const c4 = await browser.newContext({ viewport: vp });
    const r = await c4.newPage();
    for (const [who, route] of [['rhea', '/'], ['amara', '/'], ['rhea', '/goals'], ['rhea', '/goals?view=table'], ['rhea', '/goals?view=board'], ['rhea', '/goals?view=history'], ['rhea', '/goals?view=cards'], ['rhea', '/goals?view=map'],
      ['rhea', '/goals/ns-lead'], ['rhea', '/goals/lead-mq'], ['amara', '/reviews/weekly'], ['rhea', '/watching'], ['mateo', '/quick-check-in'], ['mateo', '/data/import'], ['rhea', '/activity'], ['grace', '/data'], ['grace', '/workspace'], ['grace', '/workspace/people'], ['grace', '/workspace/inbox'], ['grace', '/workspace/features'], ['jun', '/check-in'], ['tariq', '/goals/ns-ai/edit'], ['rhea', '/retro'], ['rhea', '/help'], ['rhea', '/help/status'], ['rhea', '/whats-new']]) {
      await r.goto(url(route));
      await r.evaluate((w) => localStorage.setItem('goals-app-viewer:platform-org', w), who);
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
      // Status is a shape plus a word, and the shape is the word's: every Goals layout, at both widths.
      (await shapeMismatches(r)).forEach((x) => design.push(`${device} ${route}: ${x}`));
    }
    await c4.close();
  }
  lap('P6');
  if (want('P6')) add('P6', ['DESIGN-RULES', 'SHAPE-MATCHES-WORD'], 'Design rules on every screen: no coloured edges, accent bars, glyph icons, gradients or state capsules, and every status shape beside its own word', !design.length, design.slice(0, 6).join(' | '));
  // P7: wide screens and a short laptop. Each kind of page uses the room it has: no clipped tables, portfolio views and
  // the map fill the work area, Home, a goal and Watching put their side column beside the main one, and on a 1440×700
  // laptop a goal's chart starts above the fold.
  const wide = [];
  for (const [w, hgt] of want('P7') ? [[1920, 1080], [2560, 1300]] : []) {
    const c5 = await browser.newContext({ viewport: { width: w, height: hgt } });
    const r = await c5.newPage();
    for (const [who, route, kind] of [['amara', '/', 'split'], ['amara', '/goals?view=table', 'fill'], ['amara', '/goals?view=board', 'fill'], ['amara', '/goals?view=cards', 'fill'], ['amara', '/goals?view=map', 'map'], ['tariq', '/goals/lead-review', 'split'], ['rhea', '/watching', 'split'], ['amara', '/activity', 'plain']]) {
      await r.goto(url(route));
      await r.evaluate((v) => localStorage.setItem('goals-app-viewer:platform-org', v), who);
      await r.reload();
      await r.waitForTimeout(400);
      // The map draws its 126 goals after the page is up.
      if (kind === 'map') await r.locator('.react-flow__node').first().waitFor().then(() => r.waitForTimeout(600)).catch(() => {});
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
  if (want('P7')) {
    const c6 = await browser.newContext({ viewport: { width: 1440, height: 700 } });
    const r = await c6.newPage();
    await r.goto(url('/goals/lead-review'));
    await r.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'tariq'));
    await r.reload();
    await r.locator('svg.chart').first().waitFor();
    const top = await r.locator('svg.chart').first().evaluate((e) => e.getBoundingClientRect().top);
    if (top > 640) wide.push(`1440×700 /goals/lead-review: the chart starts at ${Math.round(top)}px, below the fold`);
    await c6.close();
  }
  lap('P7');
  // P8: the goals start in the first screen. The Goals header (views, layout, search, filters) mustn't push them down.
  const fold = [];
  for (const [device, vp] of want('P8') ? Object.entries(DEVICES) : []) {
    const c7 = await browser.newContext({ viewport: vp });
    const r = await c7.newPage();
    for (const v of ['list', 'table', 'board']) {
      await r.goto(url('/goals?view=' + v));
      await r.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'rhea'));
      await r.reload();
      await r.locator('.outcome, .gtable tbody tr, .board-card').first().waitFor();
      // Measured without the first-reports banner (two goals still waiting for a first check-in, all year in the example).
      const top = await r.evaluate(() => { const b = document.querySelector('.first-reports'); const n = b?.nextElementSibling; return document.querySelector('.outcome, .gtable tbody tr, .board-card').getBoundingClientRect().top - (b && n ? n.getBoundingClientRect().top - b.getBoundingClientRect().top : 0); });
      const limit = vp.height * (device === 'phone' ? 0.5 : 0.4);
      if (top > limit) fold.push(`${device} ${v}: the first goal starts at ${Math.round(top)}px (limit ${Math.round(limit)})`);
    }
    await c7.close();
  }
  lap('P8');
  // P9: every width in between (the reviewers couldn't resize their browsers). A small phone, a tablet both ways, a
  // laptop and an ultra-wide monitor: no sideways scroll, nothing cut off at the edge, navigation always there, and
  // prose never stretched across a wide screen.
  const widths = [];
  for (const [w, hgt] of want('P9') ? [[360, 740], [768, 1024], [1024, 768], [1280, 800], [3440, 1440]] : []) {
    const c8 = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: w <= 1024 });
    const r = await c8.newPage();
    for (const [who, route] of [['rhea', '/'], ['amara', '/'], ['amara', '/goals'], ['amara', '/goals?view=table'], ['amara', '/goals?view=history'], ['amara', '/goals?view=history&hist=weekly&weeks=year'], ['amara', '/goals?view=board'],
      ['rhea', '/goals/ns-lead'], ['mateo', '/check-in/mttr-pir'], ['amara', '/reviews/weekly'], ['oskar', '/watching'], ['amara', '/activity'], ['grace', '/data'], ['grace', '/workspace']]) {
      await r.goto(url(route));
      await r.evaluate((v) => localStorage.setItem('goals-app-viewer:platform-org', v), who);
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
  lap('P9');
  if (want('P9')) add('P9', ['EVERY-WIDTH'], 'Every width from a small phone to an ultra-wide monitor: no sideways scroll, nothing cut off, navigation always there, prose a readable width', !widths.length, widths.slice(0, 8).join(' | '));
  // P10: fit and finish (review of 4 Nov), re-measured: text follows the browser's size, one control height, phone
  // rows and toolbars that stack, a usable rail, no sideways scroll in a review, and one left edge for every layout.
  const finish = [];
  if (want('P10')) {
    const at = async (w, h, who, path, touch) => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch });
      const r = await c.newPage();
      await r.goto(url('/')); await r.evaluate((v) => localStorage.setItem('goals-app-viewer:platform-org', v), who);
      await r.goto(url(path)); await r.waitForTimeout(400);
      return [c, r];
    };
    let [c, r] = await at(1280, 800, 'amara', '/activity');
    const sizes = await r.evaluate(() => { const b = parseFloat(getComputedStyle(document.body).fontSize); document.documentElement.style.fontSize = '24px'; return [b, parseFloat(getComputedStyle(document.body).fontSize)]; });
    if (!(sizes[1] > sizes[0] * 1.4)) finish.push(`text does not follow the browser's size: ${sizes.join(' → ')}px`);
    await r.evaluate(() => { document.documentElement.style.fontSize = ''; });
    const hs = await r.evaluate(() => [...new Set([...document.querySelectorAll('.page .btn:not(.sm):not(.big-btn), .page .input:not(textarea)')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)))]);
    if (hs.length > 1) finish.push(`Activity controls come in ${hs.join(', ')}px`);
    await c.close();
    [c, r] = await at(360, 740, 'amara', '/goals?view=table', true);
    const gw = await r.evaluate(() => Math.min(...[...document.querySelectorAll('.gtable td.gt-goal')].map((t) => t.getBoundingClientRect().width)));
    if (gw < 200) finish.push(`360px Goals table: a goal name gets ${Math.round(gw)}px`);
    await r.goto(url('/data')); await r.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'grace')); await r.reload(); await r.waitForTimeout(400);
    const sw = await r.evaluate(() => document.querySelector('.filter-search .input')?.getBoundingClientRect().width ?? 0);
    if (sw < 280) finish.push(`360px Data search is ${Math.round(sw)}px wide`);
    await c.close();
    [c, r] = await at(1024, 768, 'amara', '/reviews/weekly', true);
    const go = r.getByRole('link', { name: /Start|Continue|Open/ }).first(); if (await go.count()) { await go.click(); await r.waitForTimeout(500); }
    const rv = await r.evaluate(() => { const d = document.querySelector('.side .demo-entry')?.getBoundingClientRect(); return { side: document.documentElement.scrollWidth - innerWidth, demo: d ? [Math.round(d.width), Math.round(d.height)] : null, titles: [...document.querySelectorAll('.side .nav')].filter((n) => !n.getAttribute('title')).length }; });
    if (rv.side > 1) finish.push(`1024px review scrolls sideways by ${rv.side}px`);
    if (!rv.demo || rv.demo[0] > 48 || rv.demo[1] < 44) finish.push(`1024px rail Demo box is ${rv.demo}`);
    if (rv.titles) finish.push(`${rv.titles} rail icons have no name on hover`);
    await c.close();
    [c, r] = await at(1440, 700, 'amara', '/goals');
    const lx = await r.evaluate(() => Math.round(document.querySelector('.goals-head h1').getBoundingClientRect().left));
    await r.goto(url('/goals?view=table')); await r.waitForTimeout(400);
    const tx = await r.evaluate(() => Math.round(document.querySelector('.goals-head h1').getBoundingClientRect().left));
    if (lx !== tx) finish.push(`Goals moves ${Math.abs(lx - tx)}px between List and Table`);
    await c.close();
  }
  lap('P10');
  if (want('P10')) add('P10', ['FIT-AND-FINISH'], 'Fit and finish: text follows the browser’s size, one control height, phone tables and toolbars that stack, a usable rail, no sideways scroll, one left edge', !finish.length, finish.join(' | '));
  await finishChecks(add);
  if (want('P8')) add('P8', ['WIDE-SCREENS', 'PHONE'], 'The goals start in the first screen: the Goals header stays short on a phone and a desktop', !fold.length, fold.join(' | '));
  if (want('P7')) add('P7', ['WIDE-SCREENS'], 'Wide screens and a short laptop: nothing clipped, each kind of page uses the room it has, and a goal’s chart is above the fold', !wide.length, wide.slice(0, 6).join(' | '));
  out.forEach((x) => { x.seconds = secs[x.id]; });
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch();
  const journeys = [];
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const ids = J.map((x) => x.id);
  if (SHARD.length) {
    const [k, n] = SHARD;
    if (!(n >= 1 && k >= 1 && k <= n)) throw new Error(`SHARD=${process.env.SHARD} is not k/n`);
    shardPlan = require('./shards.cjs').plan(n, ids)[k - 1];
    console.log(`Shard ${k}/${n}: journeys ${shardPlan.journeys.join(' ') || '–'} · checks ${shardPlan.checks.join(' ') || '–'}`);
  }
  // FINISH or CHECKS on their own run just those checks: before, they ran every journey too, one after another (10 minutes).
  const checksAlone = !only.length && !shardPlan && (!!process.env.FINISH || picked.length > 0);
  for (const j of J.filter((x) => !checksAlone && (!only.length || only.includes(x.id)) && (!shardPlan || shardPlan.journeys.includes(x.id)))) {
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
  // Platform checks run unless ONLY names journeys alone; a shard runs the ones it was given; CHECKS asks for them by name.
  const platform = only.length && !only.includes('PLATFORM') && !picked.length ? [] : await platformChecks().catch((e) => [...platformOut, { id: 'P0', reqs: [], title: 'The platform checks ran to the end', pass: false, error: `stopped after ${platformOut.map((x) => x.id).join(', ') || 'none'}: ${String(e.message || e).split('\n')[0]}` }]);
  platform.forEach((x) => console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} ${x.title}${x.pass ? '' : '\n     ' + x.error}`));
  // P5 reads the console errors of every journey, so a shard hands them over and the merge decides (see run.mjs).
  if (!shardPlan) {
    platform.push(P5(consoleErrors));
    console.log(`${consoleErrors.length ? 'FAIL' : 'PASS'} P5 No console or page errors${consoleErrors.length ? '\n     ' + consoleErrors.slice(0, 4).join('\n     ') : ''}`);
  }
  await browser.close();
  const file = process.env.OUT_FILE || (shardPlan ? `journeys-${SHARD[0]}.json` : 'journeys.json');
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ shard: shardPlan ? { k: SHARD[0], n: SHARD[1], journeys: shardPlan.journeys, checks: shardPlan.checks } : undefined, journeys, platform, consoleErrors }, null, 2));
  process.exit(journeys.every((r) => r.pass) && platform.every((x) => x.pass) ? 0 : 1);
})();

