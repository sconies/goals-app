/* N2: Lane's review notes (5 Nov), goal-page, as rebuilt into the flagship page the same day. run({ open, url, browser })
   returns a list of failures.
   What each old check protected, and where it is now:
   - the four facts (against plan, trend, since, projection) → the summary bar's second line (number, plan, target,
     direction) and the words under the chart (trend and projection); the facts themselves are still worked out once in
     summaryFacts (evals/goalSummary.eval.ts);
   - the path to green in the main column → What's being done, in the main column, with the owner's date labelled;
   - the grouped side column → Asked of you, Actions and Last time we talked, under labelled headings;
   - the header that stays on screen → the summary bar itself shrinking to one line, under the review bar when there is one;
   - what it feeds and how it's measured under the title → About this goal (open on a first visit), and Back naming the
     goal it feeds when you arrive from outside;
   - the review walk (chart and check-ins open, each check-in opening in full, full width when stacked) → unchanged;
   - check-ins opening in full on the Check-ins tab → the same rows in the Activity stream;
   - goal rows that never draw over each other → the rows in What feeds it. */

/** The summary bar and the columns, as the page shows them. */
async function bar(p) {
  return p.evaluate(() => {
    const vis = (e) => !!e && e.getClientRects().length > 0;
    const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : '');
    const b = document.querySelector('.goal-bar');
    const ptg = document.querySelector('.doing .ptg');
    return {
      status: txt(b?.querySelector('.bar-status')),
      shape: !!b?.querySelector('.bar-status svg'),
      now: txt(b?.querySelector('.bar-now')),
      against: [...(b?.querySelectorAll('.bar-against') ?? [])].map(txt),
      dir: txt(b?.querySelector('.bar-dir')),
      why: txt(b?.querySelector('.bar-why')),
      handled: txt(b?.querySelector('.bar-handled')),
      ptg: vis(ptg) ? { inMain: !!ptg.closest('.goal-main, .goal-col'), inSide: !!ptg.closest('.goal-side'), text: txt(ptg) } : null,
      heads: [...document.querySelectorAll('.goal-side .block-title')].filter(vis).map(txt),
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

module.exports = {
  id: 'N2',
  area: 'goal-page',
  title: 'Review notes, goal-page (the flagship page)',
  reqs: ['GOAL-SUMMARY', 'GOAL-PAGE-BAR', 'GOAL-PAGE'],
  async run({ open }) {
    const fails = [];
    const chk = (ok, msg) => { if (!ok) fails.push(msg); };
    let c, p;

    // (a, b) The bar's second and third lines, and the path to green in the main column, on a number goal behind plan,
    // at every width, light and dark.
    for (const [w, h, touch] of [[390, 844, true], [1100, 900, false], [1280, 800, false], [1440, 900, false]]) {
      for (const scheme of ['light', 'dark']) {
        [c, p] = await open(w, h, 'kofi', '/goals/alerts', touch);
        await p.emulateMedia({ colorScheme: scheme });
        await p.locator('.goal-bar').waitFor();
        await p.waitForTimeout(300);
        const f = await bar(p);
        const at = `alerts ${w} ${scheme}`;
        chk(/^(At risk|Off track)$/.test(f.status) && f.shape, `${at}: bar status “${f.status}”`);
        chk(/^\d+%$/.test(f.now), `${at}: bar number “${f.now}”`);
        chk(/plan \d+%/.test(f.against.join(' ')) && /target \d+%/.test(f.against.join(' ')), `${at}: bar says “${f.against.join(' / ')}”`);
        chk(/^(worsening|flat|recovering)$/.test(f.dir), `${at}: bar direction “${f.dir}”`);
        chk(f.why.length > 20 && /^· (being handled|nobody on it yet)/.test(f.handled), `${at}: line 3 “${f.why}” “${f.handled}”`);
        chk(f.ptg && f.ptg.inMain && !f.ptg.inSide && /Path to green/.test(f.ptg.text) && /Owner’s date: back on plan by/.test(f.ptg.text), `${at}: path to green not in the main column (${JSON.stringify(f.ptg)})`);
        if (w >= 1100) chk(f.heads.length >= 1 && f.heads.every((x) => ['Asked of you', 'Actions', 'Last time we talked'].includes(x)), `${at}: side headings ${f.heads.join(' / ')}`);
        chk(f.sideways <= 1, `${at}: ${f.sideways}px sideways`);
        // Words in the bar and the side column sit on the page (or the bar's off-track wash), never on a fill of their own.
        const filled = await p.evaluate(() => [...document.querySelectorAll('.goal-bar *, .goal-side *')]
          .filter((e) => !e.closest('.asked-item, .btn, button, .view-menu-list, .bar-me, summary, .avatar') && /^(P|SPAN|STRONG|EM|DIV|DT|DD|H2|H1)$/.test(e.tagName))
          .filter((e) => { const b = getComputedStyle(e).backgroundColor; return b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent'; })
          .map((e) => e.tagName.toLowerCase() + '.' + e.className).slice(0, 3));
        chk(!filled.length, `${at}: text with a fill behind it: ${filled.join(', ')}`);
        if (scheme === 'light' && w === 1280) {
          // On track: no path to green, and line 3 has no "being handled".
          await p.goto(p.url().replace('/goals/alerts', '/goals/lead')); await p.locator('.goal-bar').waitFor();
          const on = await bar(p);
          chk(!on.ptg && !on.handled, `lead 1280: on track shows path to green ${!!on.ptg}, handled “${on.handled}”`);
        }
        await c.close();
      }
    }

    // (a) A range and dated stages, in their own terms.
    [c, p] = await open(1280, 800, 'elena', '/goals/cfr');
    await p.locator('.goal-bar').waitFor();
    let f = await bar(p);
    chk(/at most \d/.test(f.against.join(' ')) && /(inside|outside) the limit/.test(f.against.join(' ')), `cfr: bar says ${f.against.join(' / ')}`);
    await p.goto(p.url().replace('/goals/cfr', '/goals/access')); await p.locator('.goal-bar').waitFor();
    f = await bar(p);
    chk(/^\d of \d stages done$/.test(f.now) && /stages? slipping/.test(f.against.join(' ')), `access: bar says ${f.now} / ${f.against.join(' / ')}`);
    chk(f.heads[0] === 'Asked of you', `access as Elena: first side heading “${f.heads[0]}”`);
    // (e) Arriving from outside on a goal that feeds another, Back names that goal; About says what it feeds.
    const back = (await p.locator('.goal-page > .backlink').innerText()).trim();
    chk(back === 'Back to Intake-to-delivery time', `access from outside: “${back}”`);
    const feeds = await p.evaluate(() => { const dt = [...document.querySelectorAll('.about dt')].find((d) => d.textContent === 'Feeds into'); const a = dt?.nextElementSibling?.querySelector('a'); return a ? a.getAttribute('href') : null; });
    chk(/\/goals\/head$/.test(feeds || ''), `access: About's Feeds into links to ${feeds}`);
    await c.close();

    // (e) How it's measured, in About (open on a first visit); only the owner (or an admin) is offered to change it.
    [c, p] = await open(390, 844, 'maya', '/goals/head', true);
    await p.locator('details.about[open]').waitFor();
    const about = await p.evaluate(() => { const dt = [...document.querySelectorAll('.about dt')].find((d) => d.textContent === 'How it’s measured'); return dt?.nextElementSibling?.innerText.replace(/\s+/g, ' ') || ''; });
    chk(/Source: .+\.$/.test(about) && about.length > 20, `head: How it’s measured “${about}”`);
    await c.close();
    for (const [who, want] of [['kofi', true], ['maya', false]]) {
      [c, p] = await open(1280, 800, who, '/goals/alerts');
      await p.locator('.goal-bar').waitFor();
      const n = await p.locator('#change-goal a').count();
      chk(!!n === want, `alerts as ${who}: ${n} ways to change the goal`);
      await c.close();
    }

    // (d) The bar stays on screen: in place at the top, then one line once scrolled, under the review bar in a review.
    for (const [w, h, touch, who, route] of [[390, 844, true, 'elena', '/goals/head'], [1280, 800, false, 'elena', '/goals/cfr'], [1440, 900, false, 'maya', '/goals/head'], [1100, 800, false, 'elena', '/goals/access?review=weekly']]) {
      [c, p] = await open(w, h, who, route, touch);
      await p.locator('.goal-bar').waitFor();
      const before = await p.locator('.goal-bar.compact').count();
      await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(300);
      const s = await p.evaluate(() => {
        const b = document.querySelector('.goal-bar.compact');
        if (!b) return null;
        const above = [...document.querySelectorAll('.goal-page > .reviewbar')].filter((e) => e.getClientRects().length && /sticky|fixed/.test(getComputedStyle(e).position));
        const r = b.getBoundingClientRect();
        return { n: document.querySelectorAll('.goal-bar').length, top: Math.round(r.top), h: Math.round(r.height), under: Math.round(Math.max(0, ...above.map((e) => e.getBoundingClientRect().bottom))), title: b.querySelector('.bar-title')?.innerText, chip: !!b.querySelector('.bar-status svg'), number: b.querySelector('.bar-now')?.innerText, actions: [...b.querySelectorAll('.bar-actions .btn')].filter((x) => x.getClientRects().length).map((x) => x.innerText.trim()), bg: getComputedStyle(b).backgroundColor };
      });
      const at = `${route} ${w}`;
      chk(before === 0, `${at}: bar compact before scrolling`);
      chk(s && s.n === 1, `${at}: ${s?.n} bars (the compact bar must be the same element)`);
      chk(s && Math.abs(s.top - s.under) <= 1, `${at}: compact bar at ${s?.top}, under ${s?.under}`);
      chk(s && s.title && s.chip && s.number && !/rgba\(0, 0, 0, 0\)/.test(s.bg) && s.h <= (w < 500 ? 100 : 64), `${at}: compact bar ${JSON.stringify(s)}`);
      if (!/review=/.test(route)) chk(s && s.actions.length >= 1, `${at}: compact bar actions ${s?.actions}`);
      // Back at the top it opens out again.
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(250);
      chk(await p.locator('.goal-bar.compact').count() === 0, `${at}: the bar stays compact at the top`);
      await c.close();
    }

    // (f) The review walk: the chart and recent check-ins open, full width when the columns stack (1024–1200), and each
    // check-in opens to the whole check-in.
    for (const [w, h, touch] of [[390, 844, true], [1024, 768, false], [1100, 900, false], [1200, 900, false], [1280, 800, false]]) {
      [c, p] = await open(w, h, 'elena', '/goals/access?review=weekly', touch);
      await p.locator('.decide').waitFor();
      const m = await p.evaluate(() => {
        const ev = document.querySelector('.review-evidence'), split = document.querySelector('.goal-page .split');
        const box = split || document.querySelector('.goal-page .goal-col');
        return {
          shown: !!ev && ev.getClientRects().length > 0 && !ev.closest('details:not([open])'),
          w: ev ? Math.round(ev.getBoundingClientRect().width) : 0, boxW: Math.round(box.getBoundingClientRect().width), stacked: !split,
          stages: !!ev?.querySelector('.stagelist, svg.chart'), rows: ev ? ev.querySelectorAll('.ci-row').length : 0,
        };
      });
      const at = `review ${w}`;
      chk(m.shown && m.stages && m.rows >= 2, `${at}: chart and check-ins not open (${JSON.stringify(m)})`);
      chk(m.w >= (m.stacked ? m.boxW - 2 : 380), `${at}: evidence column ${m.w}px of ${m.boxW}px`);
      await p.locator('.review-evidence .ci-row').first().click();
      const full = await p.locator('.review-evidence .ci-full').first().innerText().catch(() => '');
      chk(/Call/.test(full) && /Why/.test(full) && /Path to green/.test(full) && /Checked in/.test(full), `${at}: an opened check-in shows “${full.replace(/\s+/g, ' ').slice(0, 80)}”`);
      await c.close();
    }
    // The same rows in the Activity stream, a number goal, dark.
    [c, p] = await open(1440, 900, 'elena', '/goals/alerts');
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.locator('#activity').getByRole('button', { name: 'Check-ins', exact: true }).click();
    await p.locator('#activity .ci-row').first().click();
    const row = await p.evaluate(() => { const b = document.querySelector('#activity .ci-row'); const d = document.querySelector('#activity .ci-full'); return { exp: b?.getAttribute('aria-expanded'), text: d?.innerText.replace(/\s+/g, ' ') || '' }; });
    chk(row.exp === 'true' && /Cause/.test(row.text) && /Path to green/.test(row.text) && /Checked in Kofi Boateng/.test(row.text), `alerts activity: opened check-in ${JSON.stringify(row)}`);
    await c.close();

    // What feeds it: no part of a row draws over another (status over the number, 5 Nov).
    for (const w of [1280, 1440, 390]) {
      [c, p] = await open(w, 900, 'maya', '/goals/head');
      const clash = await p.evaluate(() => {
        let n = 0;
        for (const row of document.querySelectorAll('.goal-page .tree .trow')) {
          const parts = [...row.querySelectorAll(':scope > .trow-icon, :scope .trow-title, :scope > .trow-now')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
          for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
            const a = parts[i], b = parts[j];
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) n++;
          }
        }
        return n;
      });
      chk(clash === 0, `${w}: ${clash} overlapping parts in the goal rows on the north star`);
      await c.close();
    }

    return fails;
  },
};
