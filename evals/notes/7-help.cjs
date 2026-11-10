/* N7: Help and what's new. run({ open, url, browser }) returns a list of failures.
   [HELP-GUIDE] Help is reachable from the sidebar (desktop), the icon rail (tablet) and More (phone); its search finds
   articles; the Help link at the foot of a page opens that page's article; the pages don't scroll sideways, read at a
   readable width and have no serious accessibility problems.
   [WHATS-NEW] A release you haven't seen puts a quiet dot beside Help (and on More) and one line on Home that doesn't
   push the week's main action out of the first screen; opening What's new clears both, and they stay cleared after a
   reload; dismissing the line on Home does the same. */
const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SIZES = [[390, 844, true], [768, 1024, true], [1280, 800, false]];
// The newest entry's title, read from What's new itself, so a new release doesn't need this check changed.
const LATEST = (require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'help', 'whatsNew.ts'), 'utf8').match(/title: '([^']+)'/) || [])[1];

module.exports = {
  id: 'N7',
  area: 'help',
  title: 'Help and what’s new: reachable everywhere, searchable, opened for the page you’re on, and an unread dot that clears',
  reqs: ['HELP-GUIDE', 'WHATS-NEW'],
  async run({ open, url }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };
    const path = (p) => new URL(p.url()).pathname.replace(/^\/demo/, '');
    const h1 = (p) => p.locator('main h1').first().innerText().catch(() => '');
    const dot = (p, sel) => p.locator(sel).evaluate((e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().width >= 5).catch(() => false);

    for (const [w, h, touch] of SIZES) {
      // ---------- [WHATS-NEW] a fresh browser: the dot and the Home line, then What's new clears them for good ----------
      {
        const [c, p] = await open(w, h, 'rhea', '/', touch);
        await p.locator('.home-hero').waitFor();
        const where = w < 761 ? '.tabbar .tabicon .help-dot' : '.side .help-nav .help-dot';
        fail(await dot(p, where), `[WHATS-NEW] ${w}: no unread dot (${where})`);
        const line = p.locator('.home-news:visible');
        fail(await line.isVisible() && (await line.innerText()).includes(LATEST), `[WHATS-NEW] ${w}: Home has no line “New: ${LATEST}”`);
        // The week's main action stays in the first screen, above the phone's tab bar.
        const fold = await p.evaluate(() => {
          const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
          const limit = (bar ? bar.getBoundingClientRect().top : innerHeight) - 24;
          const b = document.querySelector('.home-hero .btn.primary')?.getBoundingClientRect();
          const n = [...document.querySelectorAll('.home-news')].find((e) => e.getClientRects().length);
          const news = n?.getBoundingClientRect();
          const grid = document.querySelector('.home-grid')?.getBoundingClientRect();
          return { bottom: b ? Math.round(b.bottom) : null, limit: Math.round(limit), newsH: news ? Math.round(news.height) : 0, afterGrid: !!(news && grid && news.top >= grid.bottom - 1) };
        });
        fail(fold.bottom !== null && fold.bottom <= fold.limit, `[WHATS-NEW] ${w}: Start check-in ends at ${fold.bottom}px, below the fold (${fold.limit})`);
        fail(fold.newsH > 0 && fold.newsH <= (w < 400 ? 56 : 28), `[WHATS-NEW] ${w}: the Home line is ${fold.newsH}px tall`);
        // Never at the foot of Home (backlog N, 8 Nov): under the greeting from a tablet up, and on a phone just after the
        // goals that need you, so the first screen stays the week's work (U2).
        fail(!fold.afterGrid, `[WHATS-NEW] ${w}: the Home line is at the foot of Home`);
        if (w < 761) {
          // Right after the goals that need attention: before the rest of your goals and everything below them.
          const order = await p.evaluate(() => { const n = [...document.querySelectorAll('.home-news')].find((e) => e.getClientRects().length); const rest = document.querySelector('.home-mine .glist'); return !n ? 'none' : !rest || (n.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'ok' : 'after'; });
          fail(order === 'ok', `[WHATS-NEW] ${w}: the Home line isn’t just after the goals that need attention (${order})`);
        }
        await line.scrollIntoViewIfNeeded();
        await line.getByRole('link', { name: /See what’s new/ }).click();
        await p.waitForTimeout(300);
        fail(path(p) === '/whats-new' && /What’s new/.test(await h1(p)), `[WHATS-NEW] ${w}: See what’s new went to ${path(p)}`);
        const first = await p.locator('.news h2').first().innerText().catch(() => '');
        fail(first === LATEST, `[WHATS-NEW] ${w}: the newest entry is “${first}”`);
        const entries = await p.evaluate(() => [...document.querySelectorAll('.news time')].map((t) => t.getAttribute('datetime')));
        fail(entries.length > 10 && entries.every((d, i) => !i || d <= entries[i - 1]), `[WHATS-NEW] ${w}: ${entries.length} entries, newest first ${entries.every((d, i) => !i || d <= entries[i - 1])}`);
        await p.waitForTimeout(200);
        fail(!(await dot(p, where)), `[WHATS-NEW] ${w}: the dot is still there on What’s new`);
        await p.reload(); await p.waitForTimeout(300);
        fail(!(await dot(p, where)), `[WHATS-NEW] ${w}: the dot came back after a reload`);
        await p.goto(url('/')); await p.locator('.home-hero').waitFor();
        fail(!(await p.locator('.home-news').count()), `[WHATS-NEW] ${w}: Home still says what’s new after it was seen`);
        await c.close();
      }
      // ---------- [WHATS-NEW] dismissing the Home line counts as seen ----------
      {
        const [c, p] = await open(w, h, 'amara', '/', touch);
        await p.locator('.home-news:visible').waitFor({ timeout: 3000 }).catch(() => {});
        const close = p.getByRole('button', { name: 'Dismiss what’s new' });
        if (await close.count()) {
          const box = await close.boundingBox();
          if (touch) fail(box && box.height >= 44 && box.width >= 44, `[WHATS-NEW] ${w}: Dismiss is ${box && Math.round(box.width)}×${box && Math.round(box.height)} on touch`);
          await close.click(); await p.waitForTimeout(200);
          fail(!(await p.locator('.home-news').count()), `[WHATS-NEW] ${w}: Dismiss left the line`);
          await p.reload(); await p.locator('.home-hero, .page.home').first().waitFor(); await p.waitForTimeout(200);
          fail(!(await p.locator('.home-news').count()), `[WHATS-NEW] ${w}: the line came back after a reload`);
        } else fail(false, `[WHATS-NEW] ${w}: no Dismiss on the Home line`);
        await c.close();
      }

      // ---------- [HELP-GUIDE] reaching Help: sidebar, rail with a name on hover, or More ----------
      {
        const [c, p] = await open(w, h, 'rhea', '/goals?scope=all', touch);
        if (w < 761) {
          await p.locator('.tabbar').getByRole('button', { name: 'More' }).click();
          await p.getByRole('dialog', { name: 'More' }).getByRole('link', { name: /^Help/ }).click();
        } else {
          const link = p.locator('.side a.help-nav');
          const m = await link.evaluate((e) => ({ title: e.getAttribute('title'), w: Math.round(e.getBoundingClientRect().width), words: [...e.querySelectorAll('span')].some((s) => !s.classList.contains('sr') && s.getBoundingClientRect().width > 2) }));
          fail(/^Help/.test(m.title || ''), `[HELP-GUIDE] ${w}: the sidebar's Help has no name on hover`);
          if (w < 1101) fail(m.w <= 52 && !m.words, `[HELP-GUIDE] ${w}: the rail's Help is ${m.w}px wide, words shown ${m.words}`);
          await link.click();
        }
        await p.waitForTimeout(300);
        fail(path(p) === '/help' && (await h1(p)) === 'Help', `[HELP-GUIDE] ${w}: Help went to ${path(p)} (“${await h1(p)}”)`);
        const current = await p.evaluate(() => [...document.querySelectorAll('[aria-current="page"]')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()));
        if (w >= 761) fail(current.some((t) => /^Help/.test(t)), `[HELP-GUIDE] ${w}: Help is not the current place in the sidebar (${current.join(', ')})`);
        // Every section, with its articles.
        const sections = await p.locator('.help-page section h2').allInnerTexts();
        fail(sections.length >= 5 && (await p.locator('.help-row').count()) >= 20, `[HELP-GUIDE] ${w}: ${sections.length} sections, ${await p.locator('.help-row').count()} articles`);
        fail(/What’s new/.test(await p.locator('.help-news').innerText().catch(() => '')) && (await p.locator('.help-news').innerText()).includes(LATEST), `[HELP-GUIDE] ${w}: no What’s new link with the latest title`);
        // Search.
        const box = p.getByRole('searchbox', { name: 'Find in Help' });
        await box.fill('dark mode'); await p.waitForTimeout(200);
        const firstHit = await p.locator('.help-row-title').first().innerText().catch(() => '');
        fail(firstHit === 'Settings', `[HELP-GUIDE] ${w}: “dark mode” finds “${firstHit}” first`);
        fail(/[?&]q=dark/.test(p.url()), `[HELP-GUIDE] ${w}: the search is not in the link`);
        await box.fill('plan change reason'); await p.waitForTimeout(200);
        fail((await p.locator('.help-row-title').allInnerTexts()).includes('Changing a goal or its plan'), `[HELP-GUIDE] ${w}: “plan change reason” misses Changing a goal or its plan`);
        await box.fill('xylophone'); await p.waitForTimeout(200);
        fail(await p.getByText('No article matches “xylophone”.').isVisible(), `[HELP-GUIDE] ${w}: no “No article matches” for a search that finds nothing`);
        await box.fill('');
        await p.locator('.help-row-link', { hasText: 'Checking in on a goal' }).click(); await p.waitForTimeout(300);
        fail(path(p) === '/help/check-in' && (await h1(p)) === 'Checking in on a goal', `[HELP-GUIDE] ${w}: the article opened at ${path(p)}`);
        fail((await p.locator('#help-related ~ .help-list .help-row').count()) >= 2, `[HELP-GUIDE] ${w}: the article has no Related links`);
        const back = p.locator('main .backlink');
        fail(/Back to Help/.test(await back.innerText().catch(() => '')), `[HELP-GUIDE] ${w}: the article's Back link says “${await back.innerText().catch(() => '')}”`);
        await c.close();
      }

      // ---------- [HELP-GUIDE] the Help link at the foot of a page opens that page's article ----------
      const pages = w < 761
        ? [['rhea', '/', 'Home and your week at a glance'], ['rhea', '/goals/ns-lead', 'A goal’s page'], ['grace', '/data', 'Data']]
        : [['rhea', '/', 'Home and your week at a glance'], ['amara', '/goals?scope=all&view=table', 'Goals and its layouts'], ['amara', '/goals?scope=all&view=map', 'The goal map'], ['amara', '/goals?scope=all&view=history', 'History: quarter results and weekly status'],
          ['rhea', '/goals/ns-lead', 'A goal’s page'], ['amara', '/reviews/weekly', 'Reviews'], ['mateo', '/check-in/mttr-pir', 'Checking in on a goal'], ['grace', '/data', 'Data'], ['rhea', '/settings', 'Settings'], ['grace', '/workspace', 'Workspace: about this one']];
      if (w === 768) pages.splice(3);
      for (const [who, route, title] of pages) {
        const [c, p] = await open(w, h, who, route, touch);
        await p.waitForTimeout(route.includes('map') ? 500 : 100);
        const link = p.locator('main .page-help a');
        if (!(await link.count())) { fail(false, `[HELP-GUIDE] ${w} ${route}: no Help link on the page`); await c.close(); continue; }
        await link.scrollIntoViewIfNeeded();
        const m = await link.evaluate((e) => ({ name: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height) }));
        fail(m.name === 'Help with this page', `[HELP-GUIDE] ${w} ${route}: the link says “${m.name}”`);
        if (touch) fail(m.h >= 44, `[HELP-GUIDE] ${w} ${route}: the Help link is ${m.h}px tall on touch`);
        await link.click(); await p.waitForTimeout(300);
        fail((await h1(p)) === title, `[HELP-GUIDE] ${w} ${route}: Help opened “${await h1(p)}” (${path(p)}), want “${title}”`);
        await c.close();
      }

      // ---------- [HELP-GUIDE] the pages themselves: no sideways scroll, a readable width, no serious a11y issues ----------
      for (const route of ['/help', '/help/status', '/help/check-in', '/whats-new', '/help?q=review']) {
        const [c, p] = await open(w, h, 'rhea', route, touch);
        await p.locator('main h1').first().waitFor();
        const m = await p.evaluate(() => {
          const prose = [...document.querySelectorAll('.help-page p, .help-points li, .help-row-sum')].filter((e) => e.getClientRects().length);
          const widths = prose.map((e) => e.getBoundingClientRect().width);
          return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth, widest: Math.round(Math.max(0, ...widths)), narrowest: Math.round(Math.min(9999, ...widths)), n: prose.length };
        });
        fail(m.sideways <= 1, `[HELP-GUIDE] ${w} ${route}: scrolls sideways by ${m.sideways}px`);
        fail(m.n > 0 && m.widest <= 720, `[HELP-GUIDE] ${w} ${route}: prose runs ${m.widest}px wide`);
        fail(m.narrowest >= Math.min(260, w - 80), `[HELP-GUIDE] ${w} ${route}: prose squeezed to ${m.narrowest}px`);
        await p.addScriptTag({ content: AXE });
        const v = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id + ' ' + x.nodes[0].target.join(' ')));
        fail(!v.length, `[HELP-GUIDE] ${w} ${route}: ${v.slice(0, 2).join('; ')}`);
        await c.close();
      }
    }

    // ---------- [HELP-GUIDE] an unknown article says so and leads back ----------
    {
      const [c, p] = await open(1280, 800, 'rhea', '/help/no-such-thing');
      fail(await p.getByText('There’s no help article here').isVisible(), '[HELP-GUIDE] an unknown article does not say so');
      await c.close();
    }
    return fails;
  },
};
