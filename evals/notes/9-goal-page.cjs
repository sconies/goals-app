/* N9: the flagship goal page (approved by Lane, 5 Nov). run({ url, browser }) returns a list of failures.
   Five journeys from the plan, each at 390 and 1280:
   J1 a leader scans an off-track north star (Lead time for changes, as Amara);
   J3 an owner answers a review question from Home without scrolling;
   J5 an owner posts a check-in and sees it land;
   J6 drilling into the goal most likely to make it miss, and back to the parent by name;
   J8 a first-time viewer from a shared key link, then coming back.
   And the page's promises: the goal's status once in the first screen, no reason repeated, the chart within the first
   phone screen, nothing moving under reduced motion (and nothing over 250ms otherwise), Share producing an image and a
   link. */

const SIZES = [[390, 844, true], [1280, 800, false]];
const LIMIT = 250;
// The page's story moves slower so it can be seen (Lane, 5 Nov): up to 4 seconds end to end at the default pace; everything else 250ms.
const STORY_LIMIT = 4000;
const story = (a) => /^(gp-|pm-draw|pm-dot-in|pm-shape-swap|pm-pulse|rise\b)|countup/.test(a.name);

/** A page in a fresh browser, in a workspace, as a person. */
async function at(browser, url, { w, h, touch, ws = 'platform-org', who, route, reduced = false, perms = [] }) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch && w < 800, reducedMotion: reduced ? 'reduce' : 'no-preference', permissions: perms });
  const p = await c.newPage();
  await p.goto(url('/'));
  await p.evaluate(([ws, who]) => { localStorage.setItem('goals-app-workspace', ws); localStorage.setItem('goals-app-viewer:' + ws, who); }, [ws, who]);
  await p.goto(url(route));
  await p.locator('.goal-bar, .need, main h1').first().waitFor();
  await p.waitForTimeout(450);
  return [c, p];
}

/** What the first screen shows: the fold is the top of a phone's tab bar, or the window's bottom. */
const firstScreen = (p) => p.evaluate(() => {
  const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
  const fold = bar ? bar.getBoundingClientRect().top : innerHeight;
  const label = document.querySelector('.goal-bar .bar-status')?.innerText.trim() ?? '';
  // The goal's own status: changes ("at risk → off track") and the goals feeding it are about something else.
  const skip = (e) => e.closest('.bar-feeds, .context-line, #feeds, .asked, .stream, .talked, .action-list, .chart-read');
  const words = [];
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || skip(el) || !el.getClientRects().length || !n.textContent.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= fold) continue;
    words.push(n.textContent);
  }
  const text = words.join(' ').replace(/\s+/g, ' ');
  const status = label ? (text.toLowerCase().match(new RegExp(label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
  const chart = document.querySelector('.goal-chart svg.chart, .goal-chart-block .stagelist');
  const cr = chart?.getBoundingClientRect();
  const why = document.querySelector('.goal-bar .bar-why')?.innerText.trim() ?? '';
  return { fold, label, status, chartTop: cr ? Math.round(cr.top) : null, chartBottom: cr ? Math.round(cr.bottom) : null, why, primaries: [...document.querySelectorAll('.btn.primary')].filter((b) => { const x = b.getBoundingClientRect(); return x.width && x.bottom > 0 && x.top < fold; }).map((b) => b.innerText.trim()) };
});

/** How many separate places on the page say a sentence, and how many of them are in the first two screens. */
const sayings = (p, sentence) => p.evaluate(([s]) => {
  const fold = innerHeight * 2;
  let all = 0, top = 0;
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !el.getClientRects().length || !n.textContent.includes(s)) continue;
    all++;
    if (el.getBoundingClientRect().top + scrollY < fold) top++;
  }
  return { all, top };
}, [sentence]);

module.exports = {
  id: 'N9',
  area: 'goal-page-flagship',
  title: 'The flagship goal page: five journeys at 390 and 1280; status once, no repeats, the chart in the first screen, motion and Share',
  reqs: ['GOAL-PAGE-BAR', 'GOAL-PAGE-ONCE', 'GOAL-PAGE-INTENT', 'GOAL-PAGE-ALIVE', 'GOAL-SHARE', 'PROJECTION-RANGE', 'CHART-READ'],
  async run({ url, browser }) {
    const fails = [];
    const chk = (ok, msg) => { if (!ok) fails.push(msg); };

    for (const [w, h, touch] of SIZES) {
      const dev = w < 500 ? 'phone' : 'laptop';

      /* ---------- J1: a leader scans an off-track north star (Lead time for changes, as Amara) ---------- */
      {
        const [c, p] = await at(browser, url, { w, h, touch, who: 'amara', route: '/goals/ns-lead' });
        const s = await firstScreen(p);
        const bar = await p.evaluate(() => ({
          title: document.querySelector('.goal-bar .bar-title')?.innerText, owner: document.querySelector('.goal-bar .bar-who')?.innerText,
          two: document.querySelector('.goal-bar .bar-2')?.innerText.replace(/\s+/g, ' '), three: document.querySelector('.goal-bar .bar-3')?.innerText.replace(/\s+/g, ' '),
          feeds: document.querySelector('.goal-bar .bar-feeds')?.innerText.replace(/\s+/g, ' '),
          mtop: [...document.querySelectorAll('.mtop')].some((e) => e.getClientRects().length),
          me: !!document.querySelector('.goal-bar .bar-me .profilebtn') && [...document.querySelectorAll('.goal-bar .bar-me')].some((e) => e.getClientRects().length),
          caption: document.querySelector('.goal-chart .chart-say')?.innerText ?? '',
          endBar: !!document.querySelector('.goal-chart .chart-facts svg.cf-end'),
          band: !!document.querySelector('.goal-chart .c-band'),
        }));
        const at1 = `J1 ${dev}`;
        chk(bar.title === 'Lead time for changes' && /Rhea Kapoor/.test(bar.owner || '') && /NORTH STAR|North star/i.test(bar.owner || '') && /G-\d+/.test(bar.owner || ''), `${at1}: line 1 “${bar.title}” / “${bar.owner}”`);
        chk(/Off track/.test(bar.two) && /\d+ hours · plan \d+ hours · target \d+ hours/.test(bar.two) && /(worsening|flat|recovering)/.test(bar.two), `${at1}: line 2 “${bar.two}”`);
        chk(/Lead time is well above plan/.test(bar.three || '') && /(being handled|no response yet)/.test(bar.three || ''), `${at1}: line 3 “${bar.three}”`);
        chk(/^Fed by four goals: .*2 off track/.test(bar.feeds || ''), `${at1}: north star feeds line “${bar.feeds}”`);
        chk(s.status === 1, `${at1}: the goal's status “${s.label}” appears ${s.status} times in the first screen`);
        chk(s.chartTop != null && s.chartTop < s.fold - 60, `${at1}: the chart starts at ${s.chartTop}px, fold ${Math.round(s.fold)}px`);
        if (dev === 'laptop') chk(s.chartBottom != null && s.chartBottom <= s.fold + 120, `${at1}: the chart ends at ${s.chartBottom}px, fold ${Math.round(s.fold)}`);
        chk(s.primaries.length <= 1, `${at1}: ${s.primaries.length} primary actions in the first screen (${s.primaries.join(' | ')})`);
        // The projection is a range on the chart, in words under it (approved: least squares over the recent weeks).
        // Under the chart: short rows and a likely-end bar, not a paragraph (Lane, 5 Nov).
        chk(bar.band && /Likely end\s+about \S+/.test(bar.caption) && /could be \S+ \S* ?to \S+/.test(bar.caption) && bar.endBar && !/→|week \d/.test(bar.caption), `${at1}: projection on the chart as rows and a bar: band ${bar.band}, bar ${bar.endBar}, “${bar.caption.slice(0, 160)}”`);
        // The reason is said once near the top; weeks that repeated it are one group in the activity.
        const said = await sayings(p, 'Lead time is well above plan and the gap grew again this week');
        chk(said.top === 1 && said.all <= 2, `${at1}: the reason is said ${said.top} times in the first two screens, ${said.all} in all`);
        // On a phone the bar is the header: no app header above it, the person button at its right.
        if (dev === 'phone') chk(!bar.mtop && bar.me, `${at1}: phone header still shown (${bar.mtop}) or no person button in the bar (${bar.me})`);
        // Removed: the four facts, Signals, What the owner says, the threats block, the breadcrumb and tab counts.
        const gone = await p.evaluate(() => ['.story .facts', '.goal-rail', '.threats', '.crumbs', '.goal-sticky', '.tabcount', '.fact-source'].filter((q) => document.querySelector('.goal-page ' + q)));
        chk(!gone.length, `${at1}: removed parts still on the page: ${gone.join(', ')}`);
        const heads = await p.evaluate(() => [...document.querySelectorAll('.goal-page h2')].map((e) => e.innerText.trim()));
        chk(!heads.some((x) => /^(Signals|What the owner says|Most likely to make it miss)$/.test(x)), `${at1}: old sections ${heads.join(' / ')}`);
        // Scrubbing reads a week in words.
        const svg = p.locator('.goal-chart svg.chart');
        const box = await svg.boundingBox();
        if (box) {
          await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
          if (touch) { await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5); }
          await p.waitForTimeout(120);
          const read = await p.locator('.goal-chart .chart-read').innerText();
          if (touch) await p.mouse.up();
          chk(/^Week \d+ \(.+\) · /.test(read), `${at1}: dragging along the chart reads “${read}”`);
        }
        await c.close();
      }

      /* ---------- J3: an owner answers a review question from Home without scrolling ---------- */
      {
        // Amara asks Pavel a question about Merge-to-deploy time in the leadership weekly.
        const [c, p] = await at(browser, url, { w, h, touch, who: 'amara', route: '/goals/lead-merge?review=weekly' });
        await p.locator('.decide').waitFor();
        await p.getByRole('button', { name: 'Ask Pavel a question' }).click();
        await p.getByRole('dialog').getByRole('textbox').fill('Can the batching workaround land by week 49?');
        await p.getByRole('dialog').getByRole('button', { name: 'Save question' }).click();
        await p.waitForTimeout(400);
        // Pavel, on Home: Answer opens the goal with the question open and the box focused, in the first screen.
        await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'pavel'));
        await p.goto(url('/'));
        const need = p.locator('.need').filter({ hasText: 'Can the batching workaround land' });
        await need.getByRole('link', { name: 'Answer' }).click();
        await p.locator('.asked').waitFor();
        await p.waitForTimeout(400);
        const a = await p.evaluate(() => {
          const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
          const fold = bar ? bar.getBoundingClientRect().top : innerHeight;
          const box = document.activeElement;
          const post = [...document.querySelectorAll('.asked button')].find((b) => /Record the answer/.test(b.textContent));
          const r = (e) => e?.getBoundingClientRect();
          return { url: location.search, focused: box?.tagName === 'TEXTAREA' && !!box.closest('.asked'), boxIn: box ? r(box).top >= 0 && r(box).bottom <= fold : false, postIn: post ? r(post).bottom <= fold && r(post).top >= 0 : false, scrolled: Math.round(scrollY) };
        });
        const at3 = `J3 ${dev}`;
        chk(/respond=/.test(a.url), `${at3}: Answer opened ${a.url}`);
        chk(a.focused && a.boxIn && a.postIn, `${at3}: the answer box focused ${a.focused}, in view ${a.boxIn}, Post in view ${a.postIn}`);
        await p.keyboard.type('Yes: Diego and Pavel pair on it from Monday.');
        await p.getByRole('button', { name: 'Record the answer' }).click();
        await p.waitForTimeout(400);
        await p.goto(url('/'));
        await p.locator('main').waitFor(); await p.waitForTimeout(300);
        chk(await p.locator('.need').filter({ hasText: 'Can the batching workaround land' }).count() === 0, `${at3}: the answered question is still on Home`);
        // The old link (?tab=comments) still opens the question.
        await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'amara'));
        await p.goto(url('/goals/lead-merge?review=weekly'));
        await p.locator('.decide').waitFor();
        await p.getByRole('button', { name: 'Ask Pavel a question' }).click();
        await p.getByRole('dialog').getByRole('textbox').fill('Who signs off the vendor’s fix?');
        await p.getByRole('dialog').getByRole('button', { name: 'Save question' }).click();
        await p.waitForTimeout(400);
        await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'pavel'));
        await p.goto(url('/goals/lead-merge?tab=comments'));
        await p.locator('.asked').waitFor(); await p.waitForTimeout(300);
        chk(await p.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' && !!document.activeElement.closest('.asked')), `${at3}: ?tab=comments does not open the question`);
        await c.close();
      }

      /* ---------- J5: an owner posts a check-in and sees it land ---------- */
      {
        const [c, p] = await at(browser, url, { w, h, touch, who: 'rhea', route: '/goals/ci-docker' }); // Rhea's Base image build time is due; ten minutes is on plan, so it posts without a reason
        const before = await p.locator('.goal-bar .bar-status').innerText();
        await p.locator('.goal-bar').getByRole('link', { name: /^Check in for week \d+$/ }).click();
        await p.getByLabel('This week’s value').fill('10');
        const cont = p.getByRole('button', { name: 'Continue' });
        if (await cont.isVisible().catch(() => false)) await cont.click();
        const still = p.getByRole('button', { name: /^Still true/ });
        if (await still.isVisible().catch(() => false)) await still.click();
        if (await p.getByRole('group', { name: 'Back on plan by' }).isVisible().catch(() => false)) {
          await p.getByRole('group', { name: 'Back on plan by' }).getByRole('button').first().click();
          await p.getByRole('button', { name: 'Post check-in' }).click();
        }
        const post = p.getByRole('button', { name: 'Post check-in' });
        if (await post.isVisible().catch(() => false)) await post.click();
        await p.getByText('Check-in saved').waitFor();
        await p.getByRole('link', { name: 'View the goal' }).click();
        await p.locator('.context-line.posted').waitFor();
        await p.waitForTimeout(60);
        const l = await p.evaluate(() => ({
          line: document.querySelector('.context-line.posted')?.innerText.replace(/\s+/g, ' ') ?? '',
          landed: !!document.querySelector('.goal-chart .c-dot.landed'),
          anims: document.getAnimations().map((a) => ({ name: a.animationName || a.id, target: a.effect?.target?.getAttribute?.('class') || '', total: (Number(a.effect.getTiming().duration) || 0) + (a.effect.getTiming().delay || 0) })),
          primary: [...document.querySelectorAll('.goal-bar .btn.primary')].map((b) => b.innerText.trim()),
        }));
        const at5 = `J5 ${dev}`;
        chk(/^Posted: (.+ → .+|still .+|first check-in, .+)( · \d+ weeks on time)?$/.test(l.line), `${at5}: posted line “${l.line}” (was “${before}”)`);
        chk(l.landed, `${at5}: the new point does not land on the chart`);
        chk(!l.primary.some((x) => /^Check in for week/.test(x)), `${at5}: still offered “${l.primary.join(', ')}” after checking in`);
        const tooLong5 = l.anims.filter((x) => x.total > (story(x) ? STORY_LIMIT : LIMIT));
        chk(!tooLong5.length, `${at5}: an animation runs too long: ${tooLong5.map((x) => x.name + ' ' + x.total).join(', ')}`);
        await c.close();
      }

      /* ---------- J6: drill into what most threatens the north star, and back by name ---------- */
      {
        const [c, p] = await at(browser, url, { w, h, touch, who: 'rhea', route: '/goals/ns-lead' });
        const pinned = p.locator('#feeds .pinned');
        const why = (await pinned.innerText()).replace(/\s+/g, ' ');
        const child = (await pinned.locator('.trow-title').first().innerText()).split('\n')[0].trim();
        const at6 = `J6 ${dev}`;
        chk(/Most likely to make it miss: .+\./.test(why), `${at6}: the pinned goal says “${why.slice(0, 100)}”`);
        // It's listed once: not again below, and no separate block above.
        chk(await p.locator('#feeds .trow-title').filter({ hasText: child }).count() === 1, `${at6}: ${child} is listed more than once`);
        await pinned.locator('a').first().click();
        await p.locator('.goal-bar .bar-title').filter({ hasText: child }).waitFor();
        const back = p.locator('.goal-page > .backlink');
        chk((await back.innerText()).trim() === 'Back to Lead time for changes', `${at6}: back from ${child} says “${(await back.innerText()).trim()}”`);
        await back.click();
        await p.locator('.goal-bar .bar-title').filter({ hasText: 'Lead time for changes' }).waitFor({ timeout: 3000 }).catch(() => fails.push(`${at6}: Back did not return to the north star`));
        await c.close();
      }

      /* ---------- J8: a first-time viewer from a shared key link, then back again ---------- */
      {
        const [c, p] = await at(browser, url, { w, h, touch, who: 'oskar', route: '/goals/G-1', perms: ['clipboard-read', 'clipboard-write'] });
        const s = await firstScreen(p);
        const f = await p.evaluate(() => ({
          about: !!document.querySelector('details.about[open]'),
          line: document.querySelector('.context-line')?.innerText ?? '',
          primary: [...document.querySelectorAll('.goal-bar .btn.primary')].map((b) => b.innerText.trim()),
        }));
        const at8 = `J8 ${dev}`;
        chk(f.about, `${at8}: About this goal is folded on a first visit`);
        chk(/^What it measures: .+/.test(f.line), `${at8}: first-visit line “${f.line}”`);
        chk(f.primary.length === 1 && /^Watch/.test(f.primary[0]), `${at8}: a viewer's main action is ${f.primary.join(', ') || 'missing'}`);
        chk(s.status === 1, `${at8}: the status appears ${s.status} times in the first screen`);
        chk(s.chartTop != null && s.chartTop < s.fold - 60, `${at8}: the chart starts at ${s.chartTop}px, fold ${Math.round(s.fold)}px`);
        // Share: an image and the link.
        const download = p.waitForEvent('download', { timeout: 4000 }).catch(() => null);
        await p.locator('.goal-bar summary[aria-label="More about this goal"]').click();
        // The menu opens fully on screen (on a phone it once ran off the left edge, anchored to the button's right).
        const menu = await p.getByRole('group', { name: 'More about this goal' }).boundingBox();
        chk(!!menu && menu.x >= 0 && menu.x + menu.width <= w, `${at8}: the "…" menu runs off the screen (${menu ? Math.round(menu.x) + '–' + Math.round(menu.x + menu.width) : 'missing'} of ${w}px)`);
        await p.getByRole('group', { name: 'More about this goal' }).getByRole('button', { name: 'Share image' }).click();
        await p.waitForTimeout(800);
        const clip = await p.evaluate(async () => {
          try {
            const items = await navigator.clipboard.read();
            const types = items.flatMap((i) => i.types);
            const text = items.find((i) => i.types.includes('text/plain'));
            const png = items.find((i) => i.types.includes('image/png'));
            return { types, text: text ? await (await text.getType('text/plain')).text() : '', size: png ? (await png.getType('image/png')).size : 0 };
          } catch (e) { return { types: [], text: '', size: 0, error: String(e) }; }
        });
        const dl = clip.size ? null : await download;
        const dlSize = dl ? require('fs').statSync(await dl.path()).size : 0;
        const text = clip.text || (await p.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch { return ''; } }));
        chk((clip.size > 5000 || (dl && /\.png$/.test(dl.suggestedFilename()) && dlSize > 5000)) && /\/goals\/G-1$/.test(text), `${at8}: Share gave an image of ${clip.size || dlSize} bytes${dl ? ` (${dl.suggestedFilename()})` : ''} and the link “${text}” (${clip.error || clip.types.join(',')})`);
        // Coming back: About folds, and the line says what's new since.
        await p.goto(url('/goals/G-1'));
        await p.locator('.goal-bar').waitFor(); await p.waitForTimeout(300);
        const again = await p.evaluate(() => ({ about: !!document.querySelector('details.about[open]'), line: document.querySelector('.context-line')?.innerText ?? '' }));
        chk(!again.about && /^(Nothing new since you looked|Since you looked) /.test(again.line), `${at8}: coming back, About open ${again.about}, line “${again.line}”`);
        await c.close();
      }
    }

    /* ---------- motion: the page comes alive slowly enough to see (4s at most at the default pace), lands with an impact, and not at all under reduced motion ---------- */
    for (const reduced of [false, true]) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await c.addInitScript(() => {
        window.__gp = { anims: new Map(), counts: [] };
        const tick = () => {
          for (const a of document.getAnimations ? document.getAnimations() : []) {
            const t = a.effect.getTiming();
            const el = a.effect.target;
            // The loading screen isn't the page (as N6 leaves it out).
            if (el && el.closest && el.closest('.skeleton, .boot, .preboot')) continue;
            window.__gp.anims.set(a, { name: (a.animationName || a.id || 'anim') + ' on ' + (el ? (el.getAttribute('class') || el.tagName) : '?'), total: (Number(t.duration) || 0) * (t.iterations || 1) + (t.delay || 0) });
          }
          const n = document.querySelector('.goal-bar .countup-now');
          if (n && window.__gp.counts[window.__gp.counts.length - 1] !== n.textContent) window.__gp.counts.push(n.textContent);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const p = await c.newPage();
      await p.goto(url('/'));
      await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'rhea'));
      // (Pull requests with AI-assisted review: 72% to 73% this week, so its number counts; lead time was 37 hours both weeks.)
      await p.goto(url('/goals/ns-ai'));
      await p.waitForTimeout(4500);
      const m = await p.evaluate(() => ({ anims: [...window.__gp.anims.values()], counts: window.__gp.counts }));
      if (reduced) {
        chk(m.anims.length === 0, `reduced motion: ${m.anims.length} animations ran (${[...new Set(m.anims.map((a) => a.name))].slice(0, 3).join(', ')})`);
        chk(m.counts.length === 1, `reduced motion: the number counted (${m.counts.join(' → ')})`);
      } else {
        const names = m.anims.map((a) => a.name).join(' | ');
        chk(/c-plan/.test(names) && /c-act/.test(names) && /c-fc|c-band/.test(names) && /c-today/.test(names), `motion: the chart doesn't draw itself in turn (${names.slice(0, 200)})`);
        const over = m.anims.filter((a) => a.total > (story(a) ? STORY_LIMIT : LIMIT));
        chk(!over.length, `motion: too long: ${over.map((a) => a.name + ' ' + a.total).slice(0, 3).join(', ')}`);
        // Slow enough to see: the actual line takes at least 600ms to draw.
        const act = m.anims.find((a) => /pm-draw on .*c-act/.test(a.name));
        chk(!!act && act.total >= 600, `motion: the chart draws too fast to see (${act ? act.total + 'ms' : 'no draw'})`);
        // Lands with an impact: the number thumps when it lands and the latest point thumps with a ring.
        // The default pace (Steady) is half the speed of Quick: the actual line draws over at least 1.6s.
        chk(!!act && act.total >= 1600, `motion: at the default pace the chart should draw over at least 1.6s (${act ? act.total + 'ms' : 'no draw'})`);
        chk(/gp-jolt/.test(names), `motion: nothing jolts when it lands (${[...new Set(m.anims.map((a) => a.name.split(' ')[0]))].join(', ')})`);
        chk(/gp-num-land/.test(names) && /gp-thump/.test(names) && /gp-ring/.test(names), `motion: no impact when it lands (${[...new Set(m.anims.map((a) => a.name.split(' ')[0]))].join(', ')})`);
        chk(m.counts.length >= 2, `motion: the number did not count up (${m.counts.join(' → ')})`);
      }
      await c.close();
    }

    /* ---------- a status that changed since your last look turns in once, with the line saying so ---------- */
    {
      const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p = await c.newPage();
      await p.goto(url('/'));
      await p.evaluate(() => { localStorage.setItem('goals-app-viewer:platform-org', 'rhea'); localStorage.setItem('goals-seen:platform-org:rhea:lead-mq', JSON.stringify({ at: '2026-11-02T09:00:00.000Z', status: 'risk' })); });
      await p.goto(url('/goals/lead-mq'));
      await p.locator('.goal-bar').waitFor(); await p.waitForTimeout(60);
      const m = await p.evaluate(() => ({ line: document.querySelector('.context-line')?.innerText ?? '', moved: !!document.querySelector('.goal-bar .bar-status.moved'), about: !!document.querySelector('details.about[open]') }));
      chk(/^Since you looked on Monday: .*at risk → off track\./.test(m.line) && m.moved && !m.about, `since you looked: “${m.line}”, shape turns ${m.moved}, About open ${m.about}`);
      await c.close();
    }

    /* ---------- plan and actual never alike; which way is better (Lane, 5 Nov) ---------- */
    for (const [ws, who, route, way] of [['platform-org', 'rhea', '/goals/ns-ai', 'Higher'], ['platform-org', 'amara', '/goals/ns-lead', 'Lower']]) {
      const [c, p] = await at(browser, url, { w: 1280, h: 800, ws, who, route });
      for (const theme of ['light', 'dark']) for (const accent of ['cobalt', 'violet', 'petrol', 'graphite']) {
        const r = await p.evaluate(([theme, accent]) => {
          const d = document.documentElement;
          d.setAttribute('data-theme', theme); if (accent === 'cobalt') d.removeAttribute('data-accent'); else d.setAttribute('data-accent', accent);
          const st = (q) => { const e = document.querySelector('.goal-chart ' + q); if (!e) return null; const s = getComputedStyle(e); return { c: s.stroke, w: parseFloat(s.strokeWidth), o: Number(s.strokeOpacity) }; };
          return { plan: st('.c-plan'), act: st('.c-act'), better: document.querySelector('.goal-chart .c-better-t')?.textContent ?? '' };
        }, [theme, accent]);
        const at9 = `Chart ${route} ${theme} ${accent}`;
        chk(r.plan && r.act && r.plan.w >= 2.5 * r.act.w && (r.plan.c !== r.act.c || r.plan.o <= 0.5 * r.act.o), `${at9}: plan ${JSON.stringify(r.plan)} and actual ${JSON.stringify(r.act)} look alike`);
        chk(r.better === `${way} is better`, `${at9}: says “${r.better}”, not “${way} is better”`);
      }
      await c.close();
    }

    /* ---------- the Motion lab: the last thing in Settings, with a light line; the Konami code opens it too ---------- */
    {
      const [c, p] = await at(browser, url, { w: 390, h: 844, touch: true, who: 'maya', route: '/settings' });
      const last = await p.evaluate(() => { const b = [...document.querySelectorAll('.settings-page .settings-block, .page .settings-block')]; return b.length ? b[b.length - 1].querySelector('h2')?.textContent : null; });
      chk(last === 'Motion lab', `Motion lab: the last Settings section is “${last}”`);
      await p.getByRole('button', { name: 'Open the Motion lab' }).click();
      const dlg = p.getByRole('dialog', { name: 'Motion lab' });
      chk(await dlg.isVisible().catch(() => false), 'Motion lab: Open the Motion lab shows no lab');
      chk(await dlg.getByRole('slider', { name: 'Speed' }).count() === 1 && await dlg.getByRole('slider', { name: 'Impact' }).count() === 1 && await dlg.getByRole('button', { name: 'Wobble' }).count() === 1, 'Motion lab: no Speed and Impact sliders or landing styles');
      await c.close();
      const [c2, q] = await at(browser, url, { w: 1280, h: 800, who: 'maya', route: '/goals' });
      for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await q.keyboard.press(k);
      chk(await q.getByRole('dialog', { name: 'Motion lab' }).isVisible().catch(() => false), 'Motion lab: the Konami code does not open it');
      await c2.close();
    }
    return fails;
  },
};
