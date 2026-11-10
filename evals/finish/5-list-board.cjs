/* F5: fit and finish, list-board (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   Goals List and Table (L&T) and Board and Cards (B&C; Cards went on 9 Nov, GP); the numbers are the reports' finding numbers. */
/* The first-reports banner (two goals still waiting for a first check-in) sits above the goals all year in the example; the
   distances below are measured without it, so they still mean what they did. */
const bannerPx = () => { const b = document.querySelector('.first-reports'); if (!b) return 0; const n = b.nextElementSibling; return n ? n.getBoundingClientRect().top - b.getBoundingClientRect().top : b.getBoundingClientRect().height; };

module.exports = {
  id: 'F5',
  area: 'list-board',
  async run({ open, url }) {
    const fails = [];
    const chk = (ok, msg) => { if (!ok) fails.push(msg); };
    const r0 = (n) => Math.round(n);

    // L&T 4, 31, 23 and backlog G (Lane's markup, 9 Nov): a 360px phone, goals first. The week is one small line under
    // the title, beside New goal, so the header is one 44px row; which goals and how to see them are one row of two menus, the Views button saying the open
    // view and its count; search and Filters one row with a short placeholder; and the first goal within 240px.
    {
      const [c, p] = await open(360, 740, 'amara', '/goals', true);
      const m = await p.evaluate((src) => {
        const ban = (0, eval)('(' + src + ')')();
        const rect = (s) => document.querySelector(s)?.getBoundingClientRect();
        const bar = rect('.goals-phonebar'), row = rect('.filterbar-row');
        const shown = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).length;
        const period = rect('.goals-period'), h1 = rect('.goals-head h1'), head = rect('.goals-head');
        return { period: period && [period.top, period.height], h1Bottom: h1?.bottom, head: head?.height, bar: bar?.height, hidden: shown('.goals-toolbar') + shown('.layout-about'),
          views: document.querySelector('.show-menu > summary')?.innerText.replace(/\s+/g, ' ').trim(), layout: document.querySelector('.layout-menu > summary')?.innerText.replace(/\s+/g, ' ').trim(),
          row: row?.height, first: rect('.outcome')?.top - ban, placeholder: document.querySelector('.filter-search input')?.placeholder, side: document.documentElement.scrollWidth - innerWidth };
      }, bannerPx.toString());
      chk(m.period && m.period[1] > 0 && m.period[1] <= 18 && m.period[0] >= m.h1Bottom - 1 && m.head <= 48, `G: 360px week line ${m.period && r0(m.period[1])}px tall in a ${r0(m.head)}px header (one line under the title, beside New goal, expected)`);
      chk(m.bar <= 48 && m.hidden === 0, `G: 360px views and layout take ${r0(m.bar)}px (one 44px row expected), ${m.hidden} of the wide toolbar's rows still shown`);
      chk(/^Views: Trees ?, ?\d+ goals$/.test(m.views ?? '') && /^Layout: List$/.test(m.layout ?? ''), `G: 360px menus say “${m.views}” and “${m.layout}”`);
      chk(m.row <= 48, `L&T 4: 360px search and Filters take ${r0(m.row)}px (one row expected)`);
      // Backlog G (9 Nov) brought the first goal up from about 427px (backlog N's wrapped tabs and layout line) to about 235px.
      chk(m.first <= 240, `G: 360×740 first goal starts at ${r0(m.first)}px (≤240 expected)`);
      chk(m.placeholder === 'Search goals', `L&T 31: search placeholder is “${m.placeholder}”`);
      chk(m.side <= 1, `360px Goals scrolls sideways by ${m.side}px`);
      // The first-check-in note is one line until Why? opens the rest.
      const why = p.getByRole('button', { name: 'Why?' });
      const h1 = await p.locator('.first-reports').evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
      chk(h1 > 0 && h1 <= 44 && await why.isVisible(), `G: 360px first-check-in note is ${r0(h1)}px tall${await why.isVisible() ? '' : ', with no Why?'}`);
      if (await why.isVisible()) {
        await why.click();
        chk(/nobody has reported/.test(await p.locator('.first-reports').innerText()), 'G: Why? does not open the rest of the first-check-in note');
      }
      await c.close();
    }

    // L&T 2, 19, 20, 21, 22: By team on a phone. The selected tab is scrolled into view; every row is the shared row;
    // "no recent update" is stale grey; the number and gap sit on a line of their own under a full-width title.
    {
      const [c, p] = await open(390, 844, 'amara', '/goals?show=teams', true);
      const m = await p.evaluate(() => {
        // On a phone the open view is what the Views button says (backlog G), not a tab to scroll to.
        const name = document.querySelector('.show-menu > summary .show-name');
        const stale = [...document.querySelectorAll('.trow')].find((r) => r.querySelector('.trow-icon.tone-stale'));
        const now = stale?.querySelector('.trow-now > span:last-child');
        const row = document.querySelector('.trow'), title = row.querySelector('.trow-title').getBoundingClientRect(), value = row.querySelector('.trow-now').getBoundingClientRect();
        return { inView: name?.textContent === 'By team' && name.scrollWidth <= name.clientWidth + 1, glines: document.querySelectorAll('.page .gline').length, trows: document.querySelectorAll('.page .trow').length,
          staleColour: now && getComputedStyle(now).color, titleW: title.width, valueLeft: value.left, titleLeft: title.left, valueBelow: value.top >= title.bottom - 1, valueSize: parseFloat(getComputedStyle(row.querySelector('.trow-now')).fontSize) };
      });
      chk(m.inView, 'L&T 2: the Views button does not say By team in full');
      chk(m.glines === 0 && m.trows > 5, `L&T 21: By team draws ${m.glines} rows of another kind`);
      chk(m.staleColour === 'rgb(70, 87, 89)', `L&T 19: “no recent update” is ${m.staleColour}`);
      chk(m.titleW >= 300 && m.valueBelow && Math.abs(m.valueLeft - m.titleLeft) <= 1 && m.valueSize === 14, `L&T 22: phone row title ${r0(m.titleW)}px, value ${m.valueBelow ? 'below' : 'beside'} it at x ${r0(m.valueLeft)} vs ${r0(m.titleLeft)}, ${m.valueSize}px`);
      await c.close();
    }
    // L&T 20: on a desktop the status slot fits "No recent update" on one line.
    {
      const [c, p] = await open(1280, 800, 'amara', '/goals?show=teams');
      const h = await p.evaluate(() => { const s = [...document.querySelectorAll('.trow-icon.tone-stale')][0]; return s && [s.getBoundingClientRect().width, s.getBoundingClientRect().height]; });
      chk(h && h[1] <= 22, `L&T 20: “No recent update” wraps (${h && h.map(r0).join('×')})`);
      await c.close();
    }

    // L&T 3, 26: the filter sheet on a phone. Its footer is inside the screen with the button 12px above the edge;
    // legends have no padding and checkboxes don't shrink.
    {
      const [c, p] = await open(390, 844, 'amara', '/goals', true);
      await p.getByRole('button', { name: /^Filters/ }).click();
      await p.waitForTimeout(400);
      const m = await p.evaluate(() => {
        const sheet = document.querySelector('.sheet').getBoundingClientRect();
        const btn = [...document.querySelectorAll('.sheet-foot .btn')].find((b) => /Show the goals/.test(b.textContent)).getBoundingClientRect();
        const legend = getComputedStyle(document.querySelector('.filter-group > legend'));
        const box = getComputedStyle(document.querySelector('.filter-options .check input'));
        return { sheetBottom: sheet.bottom, btnBottom: btn.bottom, legendPad: legend.paddingLeft, shrink: box.flexShrink, H: innerHeight };
      });
      chk(m.sheetBottom <= m.H + 0.5 && m.btnBottom <= m.H - 11.5, `L&T 3: filter sheet ends at ${r0(m.sheetBottom)}, “Show the goals” at ${r0(m.btnBottom)} on a ${m.H}px screen`);
      chk(m.legendPad === '0px' && m.shrink === '0', `L&T 26: legend padding ${m.legendPad}, checkbox flex-shrink ${m.shrink}`);
      await c.close();
    }

    // L&T 23, 7, 6: the table on a phone with four filters. The active filters are one row, the table starts within
    // 360px; the sticky header sits under the top bar; three selected goals keep the bulk bar to one 56px row.
    {
      const [c, p] = await open(390, 844, 'amara', '/goals?view=table&status=risk,off,stale&level=north-star,svp,team&team=cicd,sre,infra,sec&owner=rhea,mateo,bjorn,farah', true);
      await p.waitForTimeout(300);
      // Backlog N (8 Nov) replaced the one scrolling row: every active filter shows in full, wrapping, none cut off.
      const m = await p.evaluate(() => {
        const chips = [...document.querySelectorAll('.filter-chips .filter-chip')];
        const cut = chips.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5 || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.textContent.trim());
        return { n: chips.length, cut, table: !!document.querySelector('.table-wrap') };
      });
      chk(m.n >= 4 && m.cut.length === 0, `N: ${m.n} filter chips, cut off: ${m.cut.join(', ') || 'none'}`);
      chk(m.table, 'L&T 23: with filters there is no table');
      await c.close();
    }
    {
      const [c, p] = await open(390, 844, 'amara', '/goals?view=table', true);
      await p.evaluate(() => window.scrollTo(0, 900));
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => {
        const bar = document.querySelector('.mtop').getBoundingClientRect().bottom;
        const head = [...document.querySelectorAll('.gtable thead')].map((t) => t.getBoundingClientRect()).find((r) => r.top < 200 && r.bottom > 0);
        return { bar, head: head?.top };
      });
      chk(m.head != null && Math.abs(m.head - m.bar) <= 1, `L&T 7: the sticky table header sits at ${m.head && r0(m.head)} under a ${r0(m.bar)}px top bar`);
      await c.close();
    }
    {
      const [c, p] = await open(360, 740, 'amara', '/goals?view=table', true);
      const boxes = p.locator('.gtable tbody .selcol input');
      for (let i = 0; i < 3; i++) await boxes.nth(i).check();
      await p.waitForTimeout(200);
      const m = await p.evaluate(() => { const b = document.querySelector('.selbar').getBoundingClientRect(); const a = document.querySelector('.selbar-menu > summary')?.getBoundingClientRect(); return { h: b.height, menu: a && a.height, side: document.documentElement.scrollWidth - innerWidth }; });
      chk(m.h <= 60 && m.menu >= 44, `L&T 6: 360px bulk bar is ${r0(m.h)}px tall, Actions ${m.menu}px`);
      await c.close();
    }

    // L&T 8: a laptop at 150% zoom (853×533). Sort is in Filters, so search, Filters and Decision are one row.
    {
      const [c, p] = await open(853, 533, 'amara', '/goals?view=table');
      const m = await p.evaluate((src) => ({ sort: getComputedStyle(document.querySelector('.inline-sort')).display, row: document.querySelector('.filterbar-row').getBoundingClientRect().height, first: document.querySelector('.gtable tbody tr').getBoundingClientRect().top - (0, eval)('(' + src + ')')() }), bannerPx.toString());
      chk(m.sort === 'none' && m.row <= 44, `L&T 8: 853px filter row is ${r0(m.row)}px with Sort ${m.sort}`);
      // Backlog N (8 Nov): the line saying what the layout is costs about 36px (was ≤260).
      chk(m.first <= 300, `L&T 8: at 853×533 the first goal row starts at ${r0(m.first)}px (≤300 expected)`);
      await c.close();
    }

    // L&T 5, 9, 11, 13: a wide table. Goal ≥360, Now 136, Gap 232 on one line, tags on the name's line, cells top-aligned,
    // the story two lines at most within 72ch, and the sorted column marked from the shared Sort.
    {
      const [c, p] = await open(1920, 1000, 'amara', '/goals?view=table&sort=gap');
      const m = await p.evaluate(() => {
        const th = (t) => [...document.querySelectorAll('.gtable thead th')].find((x) => x.textContent.trim() === t);
        const w = (t) => th(t)?.getBoundingClientRect().width;
        // A top-aligned cell is as tall as its row, so count the lines of its text instead.
        const gaps = [...document.querySelectorAll('.gtable td.gt-gap')].map((t) => { const rg = document.createRange(); rg.selectNodeContents(t); return new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size * 20; });
        const tagLine = [...document.querySelectorAll('.gt-name')].filter((n) => n.querySelector('.level')).every((n) => n.querySelector('.level').getBoundingClientRect().top - n.querySelector('a').getBoundingClientRect().top < 8);
        const va = [...document.querySelectorAll('.gtable tbody tr:not(.story-row) td')].every((t) => getComputedStyle(t).verticalAlign === 'top');
        const story = [...document.querySelectorAll('.table-story-line')].map((s) => [s.getBoundingClientRect().height, s.getBoundingClientRect().width]);
        return { goal: w('Goal'), now: w('Now'), gap: w('Gap'), gapH: Math.max(...gaps), tagLine, va, story, sorted: th('Gap')?.getAttribute('aria-sort'), select: document.querySelector('.inline-sort select')?.selectedOptions[0]?.textContent, sortBtns: document.querySelectorAll('.sortbtn').length, chev: !!th('Gap')?.querySelector('svg') };
      });
      chk(m.goal >= 360 && Math.abs(m.now - 136) <= 1 && Math.abs(m.gap - 232) <= 1, `L&T 5: 1920px columns Goal ${r0(m.goal)}, Now ${r0(m.now)}, Gap ${r0(m.gap)}`);
      chk(m.gapH <= 20, `L&T 5: a Gap cell wraps to ${m.gapH / 20} lines`);
      chk(m.tagLine, 'L&T 5: a level tag drops below the goal name');
      chk(m.va, 'L&T 13: table cells are not top-aligned');
      chk(m.story.every(([h, w]) => h <= 42 && w <= 680), `L&T 9: a story line is ${m.story.map(([h, w]) => r0(h) + '×' + r0(w)).slice(0, 3).join(', ')} (2 lines within 72ch expected)`);
      chk(m.sorted === 'descending' || m.sorted === 'ascending', 'L&T 11: the Gap column does not say it is sorted');
      chk(/Furthest from plan/.test(m.select || ''), `L&T 11: the Sort select says “${m.select}” while Gap is sorted`);
      chk(m.sortBtns >= 4 && m.chev, `L&T 11: ${m.sortBtns} sortable headers, ${m.chev ? 'a' : 'no'} chevron on the sorted column`);
      // A header sets the same Sort as the toolbar: sorting by Goal, the select says Name.
      await p.locator('.gtable').first().getByRole('button', { name: 'Goal' }).click();
      // Waits for the re-render rather than a fixed 300 ms, which a loaded machine (four shards at once) can miss.
      await p.waitForFunction(() => document.querySelector('.inline-sort select')?.selectedOptions[0]?.textContent === 'Sort: Name', null, { timeout: 5000 }).catch(() => undefined);
      const sel = await p.evaluate(() => document.querySelector('.inline-sort select').selectedOptions[0].textContent);
      chk(sel === 'Sort: Name', `L&T 11: after sorting by the Goal header the Sort select says “${sel}”`);
      await c.close();
    }
    // L&T 10, 29, 30, 24: selection fills both rows; opened stories have no divider; a child of a filtered-out parent isn't indented.
    {
      const [c, p] = await open(1280, 800, 'amara', '/goals?view=table');
      await p.getByLabel('Select Merge queue live for every monorepo').check();
      await p.waitForTimeout(200);
      const m = await p.evaluate(() => {
        const main = document.querySelector('.gtable tr.selected:not(.story-row) td.gt-goal');
        const story = document.querySelector('.gtable tr.story-row.selected td:last-child');
        return { main: main && getComputedStyle(main).backgroundColor, story: story && getComputedStyle(story).backgroundColor };
      });
      chk(m.main === 'rgb(238, 236, 230)' && m.story === m.main, `L&T 10: selected off-track goal fills ${m.main} and its story ${m.story}`);
      await p.locator('.story-row').first().getByRole('button', { name: /^Details/ }).click();
      const st = await p.evaluate(() => { const s = document.querySelector('.story-row .story'); const cs = getComputedStyle(s); return [cs.borderBottomWidth, cs.paddingBottom]; });
      chk(st[0] === '0px' && st[1] === '0px', `L&T 30: an opened story keeps a ${st[0]} divider and ${st[1]} under it`);
      await p.goto(p.url().replace('view=table', 'view=table&status=stale'));
      await p.waitForTimeout(400);
      const pad = await p.evaluate(() => [...document.querySelectorAll('.gtable td.gt-goal')].map((t) => getComputedStyle(t).paddingLeft));
      chk(pad.length > 0 && pad.every((x) => x === '12px'), `L&T 24: filtered children (the two quiet goals, whose parents are on track and filtered out) are indented ${pad.join(', ')}`);
      await c.close();
    }

    // L&T 14, 16, 25: a tablet. Tabs and layout buttons 44px; a 44px target round each 16px checkbox; the tab track only
    // as wide as its tabs; the decision toggle pressed is a light fill with a 2px outline, and not also a chip.
    {
      const [c, p] = await open(1024, 768, 'amara', '/goals?view=table&needs=decision', true);
      const m = await p.evaluate(() => {
        const tab = document.querySelector('.goals-tabs [role="tab"]').getBoundingClientRect().height;
        const lay = Math.min(...[...document.querySelectorAll('.layout-switch button')].map((b) => b.getBoundingClientRect().height));
        const hit = document.querySelector('.gtable tbody .selhit').getBoundingClientRect();
        const box = document.querySelector('.gtable tbody .selhit input').getBoundingClientRect();
        const track = document.querySelector('.goals-tabs > .seg.tabs');
        const sum = [...track.children].reduce((a, b) => a + b.getBoundingClientRect().width, 0);
        const q = getComputedStyle(document.querySelector('.quick-filter'));
        const chip = document.querySelector('.filter-chip.chip-decision');
        return { tab, lay, hit: [hit.width, hit.height], box: box.width, track: track.getBoundingClientRect().width, sum, qBg: q.backgroundColor, qBorder: q.borderTopWidth, chip: chip ? getComputedStyle(chip).display : 'none' };
      });
      chk(m.tab >= 44 && m.lay >= 44, `L&T 14: tabs ${r0(m.tab)}px, layout buttons ${r0(m.lay)}px`);
      chk(m.hit[0] >= 44 && m.hit[1] >= 44 && r0(m.box) === 16, `L&T 14: checkbox ${r0(m.box)}px in a ${m.hit.map(r0).join('×')} target`);
      chk(m.track <= m.sum + 40, `L&T 16: the tab track is ${r0(m.track)}px for ${r0(m.sum)}px of tabs`);
      chk(m.qBg === 'rgb(250, 249, 246)' && m.qBorder === '2px' && m.chip === 'none', `L&T 25: pressed decision toggle ${m.qBg}, border ${m.qBorder}, chip ${m.chip}`);
      await c.close();
    }

    // B&C 1, 9, 18, 6, 5, 8, 12: the board on a tablet-sized laptop. Lanes side by side and scrolling, 280px, the next
    // one peeking; every lane the same height; a plain count; the level on its own right-aligned row; radius 8; hyphens
    // their natural width.
    {
      const [c, p] = await open(1024, 768, 'amara', '/goals?view=board');
      const m = await p.evaluate(() => {
        const board = document.querySelector('.board'), b = board.getBoundingClientRect();
        const lanes = [...document.querySelectorAll('.board-col')].map((l) => l.getBoundingClientRect());
        const peek = lanes.find((l) => l.left < b.right && l.right > b.right);
        const count = getComputedStyle(document.querySelector('.board-head .board-count'));
        const lvl = document.querySelector('.board-level'), card = lvl.closest('.board-card');
        const tag = document.querySelector('.board-card .result-tag');
        const meta = document.querySelector('.board-card .small.muted');
        const m = document.createElement('span'); m.textContent = '-'; m.style.cssText = 'position:absolute;white-space:pre'; meta.appendChild(m); const hy = m.getBoundingClientRect().width / parseFloat(getComputedStyle(meta).fontSize); m.remove();
        return { tops: new Set(lanes.map((l) => Math.round(l.top))).size, widths: lanes.map((l) => Math.round(l.width)), heights: new Set(lanes.map((l) => Math.round(l.height))).size, scroll: getComputedStyle(board).overflowX,
          peek: peek ? b.right - peek.left : 0, countBg: count.backgroundColor, countSize: count.fontSize, lvlRight: card.getBoundingClientRect().right - lvl.querySelector('.level').getBoundingClientRect().right,
          lvlFirst: lvl === card.firstElementChild, tagMargin: tag && getComputedStyle(tag).marginLeft, radius: getComputedStyle(card).borderRadius, laneRadius: getComputedStyle(document.querySelector('.board-col')).borderRadius, hy };
      });
      chk(m.tops === 1 && m.scroll === 'auto' && m.widths.every((w) => w >= 280 && w <= 320), `B&C 1: 1024px lanes in ${m.tops} row(s), widths ${m.widths.join('/')}, overflow ${m.scroll}`);
      chk(m.peek >= 24, `B&C 1: the next lane peeks ${r0(m.peek)}px`);
      chk(m.heights === 1, 'B&C 9: lanes are different heights');
      chk(m.countBg === 'rgba(0, 0, 0, 0)' && m.countSize === '13px', `B&C 18: lane count is a ${m.countBg} pill at ${m.countSize}`);
      chk(m.lvlFirst && m.lvlRight <= 13, `B&C 6: the level is not a right-aligned top row (${r0(m.lvlRight)}px from the right)`);
      chk(m.tagMargin == null || m.tagMargin === '0px', `B&C 5: result tag indented ${m.tagMargin}`);
      chk(m.radius === '8px' && m.laneRadius === '8px', `B&C 8: card radius ${m.radius}, lane ${m.laneRadius}`);
      chk(m.hy <= 0.5, `B&C 12: a hyphen is ${m.hy.toFixed(2)}em wide`);
      // Show all, then Show fewer in the same place (10).
      const more = p.locator('.board-more').first();
      const label1 = (await more.textContent()).trim();
      await more.click();
      const label2 = (await p.locator('.board-more').first().textContent()).trim();
      chk(/^Show all/.test(label1) && label2 === 'Show fewer', `B&C 10: “${label1}” becomes “${label2}”`);
      await c.close();
    }
    // B&C 1: stacked on a phone. B&C 2: filtered, lanes stay ≤320px. B&C 17: dark lanes recede.
    {
      const [c, p] = await open(390, 844, 'amara', '/goals?view=board', true);
      const cols = await p.evaluate(() => new Set([...document.querySelectorAll('.board-col')].map((l) => Math.round(l.getBoundingClientRect().left))).size);
      chk(cols === 1, `B&C 1: phone board has ${cols} columns`);
      await c.close();
    }
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals?view=board&status=off,risk');
      await p.emulateMedia({ colorScheme: 'dark' });
      await p.waitForTimeout(200);
      // The cards fade to their dark colour (.15s); under load that can still be running at 200ms, so wait for it to end.
      await p.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'), null, { timeout: 3000 }).catch(() => {});
      const m = await p.evaluate(() => ({ w: [...document.querySelectorAll('.board-col')].map((l) => Math.round(l.getBoundingClientRect().width)), lane: getComputedStyle(document.querySelector('.board-col')).backgroundColor, card: getComputedStyle(document.querySelector('.board-card')).backgroundColor }));
      chk(m.w.every((w) => w <= 320), `B&C 2: filtered lanes are ${m.w.join('/')}px`);
      chk(m.lane === 'rgb(21, 36, 38)' && m.card === 'rgb(28, 46, 48)', `B&C 17: dark lane ${m.lane}, card ${m.card}`);
      await c.close();
    }

    // GP (Lane, 9 Nov). Cards has gone: five layouts, and a link naming it opens the list saying so once. Every layout
    // has the one health line, counting the goals shown. The Board shows 8 healthy cards before Show all, each naming
    // its parent. Filtered to Needs attention, the goals being handled are listed below the others, not hidden, and
    // the tab's count counts the first group and says so. Sorted, Trees is one list across every tree.
    {
      const [c, p] = await open(1280, 800, 'amara', '/goals?view=cards');
      await p.locator('.tree').first().waitFor();
      const m = await p.evaluate(() => ({
        layouts: document.querySelectorAll('.layout-switch button').length,
        note: document.querySelector('.link-note')?.textContent ?? '',
        view: new URL(location.href).searchParams.get('view'),
        health: [...document.querySelectorAll('.health-line .health-count')].map((x) => x.textContent),
      }));
      chk(m.layouts === 5, `GP 2: ${m.layouts} layouts`);
      chk(/Cards has gone/.test(m.note) && m.view !== 'cards', `GP 2: view=cards gives “${m.note}”, view=${m.view}`);
      chk(m.health.length >= 2 && m.health.some((t) => /off track/.test(t)) && m.health.some((t) => /on track/.test(t)), `GP 3: health line “${m.health.join(' · ')}”`);
      await p.reload(); await p.locator('.tree').first().waitFor();
      chk(!(await p.locator('.link-note').count()), 'GP 2: the Cards note is said more than once');
      await c.close();
    }
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals?view=board');
      await p.locator('.board').waitFor();
      const m = await p.evaluate(() => {
        const on = [...document.querySelectorAll('.board-col')].find((l) => /^On track/.test(l.getAttribute('aria-label')));
        const n = Number(on.getAttribute('aria-label').match(/\d+/)[0]);
        const health = [...document.querySelectorAll('.health-line .health-count')].reduce((t, x) => t + Number(x.textContent.match(/\d+/)[0]), 0);
        return { n, cards: on.querySelectorAll('.board-card').length, parents: document.querySelectorAll('.board-card .board-parent').length, health, all: document.querySelectorAll('.board-card').length };
      });
      chk(m.cards === Math.min(8, m.n), `GP 5: On track shows ${m.cards} of ${m.n} before Show all`);
      chk(m.parents > 0, 'GP 5: no board card names its parent');
      await c.close();
    }
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals?show=teams&attention=1');
      await p.locator('.goals-page section.block').first().waitFor();
      const m = await p.evaluate(() => ({
        groups: [...document.querySelectorAll('.goals-page section.block > h2.block-title')].map((h) => h.textContent),
        badge: document.querySelector('[role="tab"] .tabcount[title]')?.getAttribute('title') ?? '',
      }));
      chk(m.groups.length === 2 && /^Needs attention/.test(m.groups[0]) && /^Being handled/.test(m.groups[1]), `GP 1: filtered to Needs attention, the groups are ${JSON.stringify(m.groups)}`);
      chk(/need attention; \d+ being handled are listed below them and not counted/.test(m.badge), `GP 1: the tab's count says “${m.badge}”`);
      await p.goto(p.url().replace(/\?.*$/, '?sort=worst'));
      await p.locator('.goals-page section.block').first().waitFor();
      const trees = await p.locator('.goals-page section.block > h2.block-title').allInnerTexts();
      chk(trees.length === 1 && /^Every tree/.test(trees[0]), `GP 4: Trees sorted worst first is ${trees.length} groups (${trees.slice(0, 2).join(', ')})`);
      await c.close();
    }
    // Outside review, 10 Nov. U13: on the Needs attention tab the tab, the count line and the health line give one set
    // of numbers. U15: the count line is one line with Why?, and on a phone it doesn't push the goals down.
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals?show=attention');
      await p.locator('.attention-counts').waitFor();
      const m = await p.evaluate(() => ({
        tab: Number(document.querySelector('[role="tab"][aria-selected="true"] .tabcount')?.textContent),
        line: Number(document.querySelector('.attention-counts .strong')?.textContent.match(/^\d+/)?.[0]),
        health: [...document.querySelectorAll('.health-line .health-count')].reduce((t, x) => t + Number(x.textContent.match(/\d+/)[0]), 0),
        h: document.querySelector('.attention-counts').getBoundingClientRect().height,
      }));
      chk(m.tab === m.line && m.line === m.health, `U13: tab ${m.tab}, count line ${m.line}, health line ${m.health}`);
      chk(m.h <= 24, `U15: the count line is ${r0(m.h)}px tall (one line expected)`);
      await c.close();
    }
    {
      const [c, p] = await open(390, 844, 'amara', '/goals?show=attention', true);
      await p.locator('.attention-counts').waitFor();
      const h = await p.locator('.attention-counts').evaluate((e) => e.getBoundingClientRect().height);
      chk(h <= 44, `U15: at 390px the count line is ${r0(h)}px tall (two lines at most)`);
      await c.close();
    }

    // Outside review, 9 Nov (the demo searches this page live). OR 1: search keeps every character typed at full speed
    // or pasted, spaces included, and the address follows. OR 3: tabs and layouts are steps Back returns to, and Back
    // puts the box back as the address has it. OR 2: clearing keeps the tab, the layout and the sort.
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals');
      const box = p.locator('.filter-search input');
      const q = () => new URL(p.url()).searchParams;
      await box.click();
      await box.pressSequentially('Kafka', { delay: 0 });
      chk((await box.inputValue()) === 'Kafka', `OR 1: typing “Kafka” at full speed leaves “${await box.inputValue()}”`);
      await box.fill('');
      await box.pressSequentially('Amara Nwosu', { delay: 0 });
      chk((await box.inputValue()) === 'Amara Nwosu', `OR 1: typing “Amara Nwosu” at full speed leaves “${await box.inputValue()}”`);
      await p.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'Amara Nwosu', null, { timeout: 3000 }).catch(() => {});
      chk(q().get('q') === 'Amara Nwosu', `OR 1: the address says q=${q().get('q')} after typing “Amara Nwosu”`);
      // A paste: one input event with the whole text, into a box that already has words in it.
      await box.fill('lead');
      await box.press('End');
      await p.keyboard.insertText(' time for changes');
      await p.keyboard.type('!', { delay: 0 });
      chk((await box.inputValue()) === 'lead time for changes!', `OR 1: pasting into the box leaves “${await box.inputValue()}”`);
      await box.fill('');
      await p.waitForFunction(() => !new URL(location.href).searchParams.get('q'), null, { timeout: 3000 }).catch(() => {});

      // Back: Needs attention, then Table, then List, then a search; Back walks the same steps in reverse.
      await p.getByRole('tab', { name: /Needs attention/ }).click();
      await p.locator('[aria-label="Table"]').first().click();
      await p.locator('.gtable').first().waitFor({ timeout: 5000 }).catch(() => {});
      await p.locator('[aria-label="List"]').first().click();
      await box.click();
      await box.pressSequentially('platform', { delay: 0 });
      await p.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'platform', null, { timeout: 3000 }).catch(() => {});
      const steps = [];
      for (let i = 0; i < 3; i++) {
        await p.goBack();
        await p.waitForTimeout(250);
        steps.push(`${q().get('show') ?? 'trees'}/${q().get('view') ?? 'list'}/“${await box.inputValue()}”`);
      }
      chk(steps.join(' ') === 'attention/table/“” attention/list/“” trees/list/“”', `OR 3: Back after Needs attention → Table → List → a search goes ${steps.join(', ')}`);

      // Clear, from No goals match: the tab, the layout and the sort stay.
      await p.goto(url('/goals?show=attention&view=table&sort=title'));
      await box.click();
      await box.pressSequentially('zzzz no such goal', { delay: 0 });
      await p.getByRole('button', { name: 'Clear search and filters' }).click({ timeout: 5000 }).catch(() => fails.push('OR 2: no Clear search and filters for a search matching nothing'));
      await p.waitForTimeout(250);
      chk(q().get('show') === 'attention' && q().get('view') === 'table' && q().get('sort') === 'title' && !q().get('q') && (await box.inputValue()) === '', `OR 2: Clear search and filters leaves ${q().toString()} and “${await box.inputValue()}” in the box`);
      await c.close();
    }

    // OR 9 (second review, 9 Nov): search on Trees covers every goal, not only the top ones, and each match is shown
    // under its tree, as on By level.
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals');
      await p.locator('.filter-search input').pressSequentially('canary', { delay: 0 });
      await p.waitForFunction(() => /of \d+/.test(document.querySelector('.filter-count')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});
      const trees = await p.evaluate(() => ({ count: document.querySelector('.filter-count')?.textContent ?? '', heads: [...document.querySelectorAll('.goals-page section.block h2')].map((h) => h.textContent), rows: document.querySelectorAll('.goals-page section.block .tree li').length }));
      await p.getByRole('tab', { name: 'By level' }).click();
      await p.waitForTimeout(300);
      const byLevel = await p.evaluate(() => document.querySelector('.filter-count')?.textContent ?? '');
      const n = (s) => (/(\d+) of (\d+)/.exec(s) || []).slice(1).map(Number);
      const [found, of] = n(trees.count), [found2, of2] = n(byLevel);
      chk(found >= 2 && found === found2 && of === of2 && trees.rows === found && trees.heads.length > 0, `OR 9: “canary” finds ${trees.count} on Trees (${trees.rows} rows under ${trees.heads.join(', ')}) and ${byLevel} on By level`);
      await c.close();
    }

    // OR 4: a link with a tab or team the workspace doesn't have shows the trees and says what it dropped.
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals?show=nonsense&team=no-such-team');
      await p.locator('.link-note').waitFor({ timeout: 5000 }).catch(() => {});
      const m = await p.evaluate(() => ({ note: document.querySelector('.link-note')?.textContent ?? '', trees: document.querySelectorAll('.outcome').length,
        sel: document.querySelector('.goals-tabs [aria-selected="true"]')?.textContent, chips: [...document.querySelectorAll('.filter-chip')].map((x) => x.textContent) }));
      const u = new URL(p.url()).searchParams;
      chk(/no “nonsense” tab/.test(m.note) && /no-such-team/.test(m.note), `OR 4: a bad link says “${m.note}”`);
      chk(m.trees > 0 && m.sel === 'Trees' && !m.chips.length && !u.get('show') && !u.get('team'), `OR 4: a bad link shows ${m.trees} trees, tab ${m.sel}, filters ${m.chips.join(', ') || 'none'}, address ${u.toString()}`);
      await c.close();
    }

    // OR 7: every tab is whole beside the layouts, on a laptop and on a 1920px screen, in the list and the table.
    for (const [w, route] of [[1440, '/goals'], [1920, '/goals'], [1920, '/goals?view=table']]) {
      const [c, p] = await open(w, 1000, 'rhea', route);
      const m = await p.evaluate(() => {
        const row = document.querySelector('.goals-tabs > .seg.tabs'), box = row.getBoundingClientRect();
        const cut = [...row.querySelectorAll('[role="tab"]')].filter((t) => { const r = t.getBoundingClientRect(); return r.left < box.left - 0.5 || r.right > box.right + 0.5; }).map((t) => t.textContent);
        return { over: row.scrollWidth - row.clientWidth, cut };
      });
      chk(m.over <= 1 && !m.cut.length, `OR 7: at ${w}px ${route} the tabs scroll by ${m.over}px; cut off: ${m.cut.join(', ') || 'none'}`);
      await c.close();
    }
    return fails;
  },
};
