/* F1: fit and finish, home-watching (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   [Home] n and [WA] n are the findings of the Home report and the Watching and Activity report. */
const box = (p, sel, i = 0) => p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, [sel, i]);
const css = (p, sel, prop, i = 0) => p.evaluate(([s, prop, i]) => { const e = document.querySelectorAll(s)[i]; return e ? getComputedStyle(e).getPropertyValue(prop) : null; }, [sel, prop, i]);
const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

module.exports = {
  id: 'F1',
  area: 'home-watching',
  async run({ open, url }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };

    // [Home] 1, 2, 7, 18: Elena's Home on a phone.
    {
      // Amara's Watching spans 13 teams, so it is a table of teams (Home rule 4, HM3): Oskar's three watched goals are
      // the goal rows on a phone.
      {
        const [c0, q] = await open(390, 844, 'oskar', '/', true);
        check(await css(q, '.tree .trow', 'display') === 'flex', '[Home] 1: a phone row is not stacked');
        const t = await box(q, '.tree .trow-title'), row = await box(q, '.tree .trow');
        check(t && row && t.w >= row.w - 34, `[Home] 1: phone title is ${t && Math.round(t.w)}px of a ${row && Math.round(row.w)}px row`);
        check(await css(q, '.tree .trow-why', '-webkit-line-clamp') === 'none', '[Home] 1: phone reason is still clamped');
        await c0.close();
      }
      // [Home] 8: a goal row's level tag, on the first of these Homes that shows one at 390.
      {
        let seen = false;
        for (const who of ['oskar', 'rhea', 'tunde']) {
          const [cl, l] = await open(390, 844, who, '/', true);
          const tag = await box(l, '.trow-title .level');
          if (tag) {
            seen = true;
            check(await css(l, '.trow-title .level', 'margin-left') === '0px', '[Home] 8: the level tag still has a left margin');
            check(Math.round(tag.h) === 20, `[Home] 8: the level tag is ${Math.round(tag.h)}px tall, not 20`);
          }
          await cl.close();
          if (seen) break;
        }
        check(seen, '[Home] 8: no goal row on Oskar’s, Rhea’s or Tunde’s Home shows a level tag');
      }
      const [c, p] = await open(390, 844, 'amara', '/', true);
      // The teams table stacks each team on a phone, and nothing scrolls sideways (checked below).
      check(await css(p, '.teams-table tbody tr', 'display') !== 'table-row', '[Home] HM3: a team is not a stacked row on a phone');
      const ring = await box(p, '.home-hero > .ring'), eb = await box(p, '.home-hero .eyebrow');
      check(ring && Math.round(ring.w) === 40 && Math.round(ring.h) === 40, `[Home] 2: phone ring is ${ring && Math.round(ring.w)}px, not 40`);
      check(ring && eb && eb.x > ring.r && Math.abs(eb.y - ring.y) <= 4, '[Home] 2: the ring is not inline left of the eyebrow');
      const hero = await box(p, '.home-hero'), btn = await box(p, '.home-hero .btn.primary');
      check(hero && btn && Math.abs(btn.w - hero.w) <= 1 && btn.h >= 44, `[Home] 7: phone hero button is ${btn && Math.round(btn.w)}×${btn && Math.round(btn.h)} in a ${hero && Math.round(hero.w)}px hero`);
      // The Try it card left Home for the workspace switcher (backlog WS, Lane 9 Nov).
      const needs = await box(p, '.needs-you'), changes = await box(p, '.split-b');
      check(needs && changes && needs.y < changes.y && !(await p.getByText('Try it with your own team').count()), '[Home] 18: stacked order is not hero, needs your response, important changes; or Home still offers the Try it card');
      check(await noSideways(p), '[Home] sideways scroll at 390');
      await c.close();
    }
    // [Home] 1, 7: Maya and Tom at 360.
    {
      const [c, p] = await open(360, 740, 'rhea', '/', true);
      const m = await box(p, '.arow-main'), a = await box(p, '.arow');
      check(m && a && m.w >= a.w - 32 - 26 - 1, `[Home] 1: attention row text is ${m && Math.round(m.w)}px of ${a && Math.round(a.w)}`);
      // Lane (5 Nov): on a phone, Home keeps each attention reason to two lines, so the cards are shorter and the first
      // one's title starts on screen. That holds only while the whole reason is a tap away: every reason cut short here
      // is said in full on its goal's page (a missed or missing path to green, under What's being done).
      const clamp = await css(p, '.page.home .arow-why', '-webkit-line-clamp');
      check(clamp === 'none' || clamp === '2', `[Home] 1: attention reason is clamped to ${clamp} lines on a phone, not 2`);
      const cut = await p.$$eval('.page.home .arow', (els) => els.map((e) => {
        const why = e.querySelector('.arow-why');
        return { href: e.querySelector('a.arow-main')?.getAttribute('href') || '', flag: (why.querySelector('.arow-flags')?.textContent || '').split(' · ')[0], full: why.getAttribute('title') || '', cut: why.scrollHeight > why.clientHeight + 1 };
      }).filter((x) => x.cut));
      for (const x of cut) {
        const q = await c.newPage();
        await q.goto(url(x.href.replace(/^\/demo/, '')));
        await q.locator('.goal-bar').waitFor();
        const page = (await q.locator('main').innerText()).replace(/\s+/g, ' ');
        const path = /path to green/i.test(x.flag);
        const said = path ? await q.locator('.why-block .ptg, .why-block .ptg-none').count() > 0 : !!x.full && page.includes(x.full.replace(/\s+/g, ' '));
        check(said, `[Home] 1: the reason cut short on a phone (“${x.full.slice(0, 50)}…”) is not in full on ${x.href.replace(/^\/demo/, '')}`);
        await q.close();
      }
      check(await noSideways(p), '[Home] sideways scroll at 360');
      await c.close();
      const [c2, q] = await open(360, 740, 'oskar', '/', true);
      // Tom watches goals and is asked nothing: one quiet sentence and no button (Home's spec, HM1).
      const hero = await q.locator('.home-hero').innerText();
      check(/Nothing is asked of you today\./.test(hero) && await q.locator('.home-hero .btn').count() === 0, `[Home] 7: Tom’s Home is not one quiet sentence with no button (“${hero.replace(/\s+/g, ' ')}”)`);
      await c2.close();
    }
    // [Home] 1, 3, 5: Elena at 1280 and 1440.
    for (const w of [1280, 1440]) {
      {
        // Oskar's watched goals are rows (Amara's are a table of teams, rule 4).
        const [c0, q] = await open(w, 900, 'oskar', '/');
        const why = await q.$eval('.tree .trow-why', (e) => ({ clamp: getComputedStyle(e).webkitLineClamp, title: e.getAttribute('title') || '' }));
        check(why.clamp === '3' && why.title.length > 20, `[Home] 1: at ${w} the reason is clamped to ${why.clamp} with no title`);
        await c0.close();
      }
      const [c, p] = await open(w, 900, 'amara', '/');
      const head = await box(p, '.page.home > .page-head'), grid = await box(p, '.page.home > .home-grid');
      check(head && grid && Math.abs(head.w - grid.w) <= 1 && grid.w <= 1200, `[Home] 5: at ${w} heading ${head && Math.round(head.w)} vs grid ${grid && Math.round(grid.w)}`);
      const side = await box(p, '.home-side');
      check(side && Math.round(side.w) === 400, `[Home] 3: side column is ${side && Math.round(side.w)}px, not 400`);
      const n = await p.$$eval('.need', (els) => els.map((e) => e.getBoundingClientRect().height));
      check(n.length && n.every((x) => x <= 152), `[Home] 3: response items are ${n.map(Math.round).join(', ')}px tall`);
      check(await css(p, '.need-what', 'font-weight') === '600', '[Home] 3: the goal name is not the bold line');
      const what = await box(p, '.need-what'), act = await box(p, '.need .btn');
      check(what && act && Math.abs(act.x - what.x) <= 1 && act.y >= what.b, '[Home] 3: Respond is not under the text on its left edge');
      check(await noSideways(p), `[Home] sideways scroll at ${w}`);
      await c.close();
    }
    {
      const [c, p] = await open(1440, 900, 'oskar', '/');
      const head = await box(p, '.page.home > .page-head'), grid = await box(p, '.page.home > .home-grid');
      check(head && grid && Math.abs(head.w - grid.w) <= 1 && grid.w <= 1040, `[Home] 5: one-column heading ${head && Math.round(head.w)} vs grid ${grid && Math.round(grid.w)}`);
      await c.close();
    }
    // [Home] 9, [WA] 11, 27, 28: Maya's Watching, the row gone quiet and the missed result.
    for (const w of [768, 1440]) {
      const [c, p] = await open(w, 900, 'rhea', '/watching');
      const stale = p.locator('.trow[data-tone="stale"]').first();
      const icon = await stale.locator('.trow-icon').boundingBox();
      check(icon && icon.height <= 21, `[WA] 11: at ${w} "No recent update" wraps (${icon && Math.round(icon.height)}px)`);
      const now = (await stale.locator('.trow-now').innerText()).toLowerCase();
      check(!now.includes('no recent update'), '[WA] 27: the value line repeats "No recent update"');
      const miss = p.locator('.trow-now .result-missed').first();
      check(await miss.count() === 1, '[WA] 28: "Not met" is not in the value column');
      if (await miss.count()) check(await miss.evaluate((e) => getComputedStyle(e).textTransform) === 'none', '[WA] 28: the result is still uppercase');
      if (w === 768) {
        const why = await p.$eval('.tree .trow-why', (e) => ({ clamp: getComputedStyle(e).webkitLineClamp, title: e.getAttribute('title') || '' }));
        check(why.clamp === '3' && why.title.length > 20, `[WA] 2: at 768 the reason is clamped to ${why.clamp} with no title`);
      } else {
        check(Math.round(icon.width) === 136, `[WA] 11: status column is ${icon && Math.round(icon.width)}px, not 136`);
        const main = await box(p, '.tree .trow-main');
        check(main && main.w >= 320, `[Home] 1: title column is ${main && Math.round(main.w)}px at ${w}`);
      }
      check(await noSideways(p), `[WA] sideways scroll at ${w}`);
      await c.close();
    }
    // [WA] 10, 16: Tom's Watching has nothing that needs attention; his level chips match Activity's.
    {
      const [c, p] = await open(1280, 900, 'oskar', '/watching');
      check(await p.locator('.page.watching .split-a').count() === 0, '[WA] 10: an empty attention column is still rendered');
      // (Watching is a scope of Goals now: its toolbar sits under the tabs, so the gap is measured from the summary line.)
      const lede = (await box(p, '.page.watching .lede')) || (await box(p, '.page.watching .seg.tabs')), first = await box(p, '.page.watching .split .block');
      check(lede && first && first.y - lede.b <= 25, `[WA] 10: ${first && lede && Math.round(first.y - lede.b)}px from the tabs to the first section`);
      await p.getByRole('button', { name: 'Change', exact: true }).click();
      const chip = p.locator('.level-chips .filter-chip').first();
      check(await chip.count() === 1, '[WA] 16: level choices are not filter chips');
      if (await chip.count()) {
        const r = await chip.evaluate((e) => ({ rad: getComputedStyle(e).borderRadius, h: e.getBoundingClientRect().height, svg: !!e.querySelector('svg'), n: !!e.querySelector('.tabcount') }));
        check(r.rad === '6px' && Math.round(r.h) === 32 && r.svg && r.n, `[WA] 16: level chip is radius ${r.rad}, ${Math.round(r.h)}px tall`);
      }
      await c.close();
    }
    // [WA] 19: nobody watched yet.
    {
      const [c, p] = await open(1440, 900, 'mateo', '/watching');
      const card = p.locator('.watch-empty');
      if (await card.count()) {
        const r = await card.evaluate((e) => ({ w: e.getBoundingClientRect().width, bg: getComputedStyle(e).backgroundColor, bc: getComputedStyle(e).borderTopColor, prim: e.querySelectorAll('.btn.primary').length }));
        check(r.w <= 640 && r.bg === 'rgb(255, 255, 255)' && r.bc === 'rgb(228, 225, 217)' && r.prim === 1, `[WA] 19: empty card ${Math.round(r.w)}px, ${r.bg}, border ${r.bc}, ${r.prim} primary`);
      }
      await c.close();
    }
    // [WA] 4, 5, 7, 14, 22: Activity on a phone.
    for (const w of [360, 390]) {
      const [c, p] = await open(w, 800, 'amara', '/activity', true);
      check(await p.getAttribute('.filter-search input', 'placeholder') === 'Find by person, goal, key or what was said', '[WA] 5, find spec 2.1: the search placeholder isn’t the list bar’s');
      const fb = await box(p, '.filterbar');
      check(fb && fb.h <= 160, `[WA] 14: the filter bar is ${fb && Math.round(fb.h)}px tall at ${w}`);
      const kc = await box(p, '.kind-chips');
      check(kc && kc.h <= 48, `[WA] 14: kind chips wrap (${kc && Math.round(kc.h)}px)`);
      const small = await p.$$eval('.change .linkish.tiny', (els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
      check(small === 0, `[WA] 4: ${small} "Show the change" targets under 44px at ${w}`);
      check(await css(p, '.change .small > .linkish', 'display') === 'inline', '[WA] 7: goal links in summaries cannot wrap');
      const av = await p.$eval('.change', (li) => { const a = li.querySelector('.avatar').getBoundingClientRect(); const t = li.querySelector('.small').getBoundingClientRect(); return (a.top + a.height / 2) - (t.top + 10); });
      check(Math.abs(av) <= 1, `[WA] 22: the avatar sits ${av.toFixed(1)}px off the first line`);
      check(await noSideways(p), `[WA] sideways scroll on Activity at ${w}`);
      // [WA] 3: the Filters sheet footer stays on the screen.
      if (w === 390) {
        await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
        const dlg = p.getByRole('dialog', { name: 'Filter activity' });
        await dlg.waitFor(); await p.waitForTimeout(400);
        for (const end of [false, true]) {
          await p.evaluate((end) => { const s = document.querySelector('.sheet'); s.scrollTop = end ? s.scrollHeight : 0; }, end);
          await p.waitForTimeout(50);
          const b = await box(p, '.sheet .btn.primary');
          check(b && b.b <= 800 - 12 + 0.5, `[WA] 3: "Show the changes" bottom at ${b && Math.round(b.b)} (${end ? 'end' : 'top'})`);
        }
        check(await dlg.getByRole('button', { name: 'Save .csv' }).isVisible(), '[WA] 14: Save .csv is not in the phone Filters sheet');
      }
      await c.close();
    }
    // [WA] 8, 13, 21: Filters with a count, and the sheet's columns.
    {
      const [c, p] = await open(1024, 800, 'amara', '/activity?who=elena,maya&team=pm');
      const f = await box(p, '.filterbar-row > .btn[aria-haspopup]');
      check(f && f.w >= 104 && await p.locator('.filterbar-row > .btn[aria-haspopup] .tabcount').count() === 1, '[WA] 13: Filters count is not a pill on a 104px button');
      await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
      await p.locator('.activity-filter-sheet').waitFor();
      const tops = await p.$$eval('.activity-filter-sheet .filter-group', (gs) => gs.slice(0, 3).map((g) => { const l = g.querySelector('legend').getBoundingClientRect(); const f = [...g.children].find((x) => x.tagName !== 'LEGEND').getBoundingClientRect(); return Math.round(f.top - l.bottom); }));
      check(tops.every((x) => x === 8), `[WA] 8: fields sit ${tops.join(', ')}px under their legends`);
      const rows = await p.$$eval('.activity-filter-sheet .check', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      check(rows.every((h) => h >= 40), `[WA] 8: check rows ${[...new Set(rows)].join(', ')}px`);
      const lab = await p.$eval('.filter-dates .date-label', (e) => ({ s: getComputedStyle(e).fontSize, w: getComputedStyle(e).fontWeight }));
      check(lab.s === '12px' && lab.w === '600', `[WA] 21: From/To are ${lab.s}/${lab.w}`);
      await c.close();
    }
    // [WA] 18, 17: no results; a status call has its shape.
    {
      const [c, p] = await open(1280, 800, 'amara', '/activity?q=zzqqxxnothing');
      const t = p.locator('.empty-state-title');
      await t.first().waitFor({ timeout: 5000 }).catch(() => {});
      check(await t.count() === 1 && await t.evaluate((e) => getComputedStyle(e).color) === 'rgb(24, 54, 56)' && (await t.innerText()) === 'No change matches “zzqqxxnothing”.' && await p.locator('.empty-state .btn', { hasText: 'Clear the search' }).count() === 1, '[WA] 18, find spec 2.1: no results is not the list bar’s message with Clear the search');
      await p.goto(p.url().replace(/\?q=[^&]*&?/, '?'));
      await p.locator('.change-check-in .linkish.tiny').first().click();
      check(await p.locator('.diff-status .status-shape').count() > 0, '[WA] 17: "Status call" has no status shape');
      await c.close();
    }
    // [WA] 23: dark avatars.
    {
      const [c, p] = await open(1440, 900, 'amara', '/activity');
      await p.emulateMedia({ colorScheme: 'dark' });
      const bg = await p.$$eval('.avatar[data-hue="5"]', (els) => els.map((e) => getComputedStyle(e).backgroundColor));
      check(bg.every((x) => x === 'rgb(102, 112, 133)'), `[WA] 23: dark grey avatar is ${bg[0]}`);
      await c.close();
    }
    // [Home] 17: the Respond form's footer doesn't jump when the error shows.
    {
      // Respond opens the goal with the request open in place since the flagship page (5 Nov); the same footer promise.
      const [c, p] = await open(390, 844, 'amara', '/', true);
      await p.locator('.need').getByRole('link', { name: 'Respond' }).first().click();
      const dlg = p.getByRole('region', { name: 'Respond' });
      await dlg.waitFor(); await p.waitForTimeout(400);
      const before = await box(p, '.respond-form .sheet-foot');
      await dlg.getByRole('button', { name: 'Record the answer' }).click();
      await p.waitForTimeout(100);
      const after = await box(p, '.respond-form .sheet-foot');
      check(before && after && Math.abs(after.y - before.y) <= 1, `[Home] 17: the footer moved ${before && after && Math.round(after.y - before.y)}px`);
      check(await dlg.getByRole('alert').locator('svg').count() === 1, '[Home] 17: the error has no icon');
      await c.close();
    }
    // [Home] 14: Maya after posting her check-ins.
    {
      // Farah posts her one due number in the table, then comes back to Home.
      // (Farah is in the leadership weekly, held today, so her Home moves on to the review once her number is in.)
      const [c, p] = await open(390, 844, 'farah', '/quick-check-in', true);
      await p.locator('.qrow').first().waitFor();
      for (const row of await p.locator('.qrow').all()) {
        if (/already posted/.test(await row.innerText())) continue;
        const plan = (await row.innerText()).match(/Plan ([\d.]+)/)?.[1] || '20';
        await row.getByRole('textbox').fill(plan);
      }
      await p.getByRole('button', { name: /^Post/ }).click();
      await p.getByText('Saved').first().waitFor({ timeout: 4000 }).catch(() => {});
      await p.goto(url('/'));
      await p.waitForTimeout(400);
      // The review's eyebrow says her check-ins are in (HM1: one line, not a separate "all set" line).
      const eyebrow = await p.locator('.home-hero .eyebrow').innerText().catch(() => '');
      check(/is today · your (\d+ )?check-ins? (is|are) in/.test(eyebrow), `[Home] 14: the review's eyebrow doesn't say her check-ins are in (“${eyebrow}”)`);
      check(await p.locator('.home-hero .btn.primary').count() === 1, '[Home] 14: the review is not the one primary action');
      await c.close();
    }
    // No sideways scroll anywhere on these pages, from a small phone to a big monitor.
    for (const w of [360, 768, 1024, 2560]) {
      for (const [who, route] of [['amara', '/'], ['rhea', '/watching'], ['amara', '/activity']]) {
        const [c, p] = await open(w, 900, who, route, w < 800);
        check(await noSideways(p), `sideways scroll on ${route} at ${w}`);
        await c.close();
      }
    }
    return fails;
  },
};
