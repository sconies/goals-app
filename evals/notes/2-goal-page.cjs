/* N2: Lane's review notes (5 Nov), goal-page, as rebuilt into the flagship page the same day. run({ open, url, browser })
   returns a list of failures.
   What each old check protected, and where it is now:
   - the four facts (against plan, trend, since, projection) → the summary bar's scorecard (vs plan, vs last week, to
     target, will it hit), marked on the chart (the scorecard, 5 Nov); the facts themselves are still worked out once in
     summaryFacts and scorecard (evals/goalSummary.eval.ts, src/domain/scorecard.test.ts);
   - the reason and whether it's being handled → the top of Why, under the chart;
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
      cells: Object.fromEntries([...(b?.querySelectorAll('.scorecard .sc-cell') ?? [])].map((c) => [txt(c.querySelector('.sc-label')).toLowerCase(), { value: txt(c.querySelector('.sc-value')), sub: txt(c.querySelector('.sc-sub')) }])),
      why: txt(document.querySelector('.why-block .why-text')),
      handled: txt(document.querySelector('.why-block .why-handled')),
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

    // (a, b) The bar's status, number and scorecard, the reason opening Why, and the path to green in the main column, on
    // a number goal behind plan, at every width, light and dark.
    for (const [w, h, touch] of [[390, 844, true], [1100, 900, false], [1280, 800, false], [1440, 900, false]]) {
      for (const scheme of ['light', 'dark']) {
        [c, p] = await open(w, h, 'yasmin', '/goals/vuln-containers', touch);
        await p.emulateMedia({ colorScheme: scheme });
        await p.locator('.goal-bar').waitFor();
        await p.waitForTimeout(300);
        const f = await bar(p);
        const at = `vuln-containers ${w} ${scheme}`;
        chk(/^(At risk|Off track)$/.test(f.status) && f.shape, `${at}: bar status “${f.status}”`);
        chk(/^\d+%$/.test(f.now), `${at}: bar number “${f.now}”`);
        const cells = f.cells;
        chk(/^(\d+ pts? (behind|ahead)|On plan)$/.test(cells['vs plan']?.value) && /^plan \d+%$/.test(cells['vs plan']?.sub) && /^target \d+%/.test(cells['to target']?.sub) && !!cells['vs last week'] && /^(Likely|Possible|Unlikely|Very unlikely)$/.test(Object.entries(cells).find(([k]) => /^will it hit/.test(k))?.[1].value), `${at}: scorecard ${JSON.stringify(cells)}`);
        chk(f.why.length > 20 && /^(Being handled|No response yet)/.test(f.handled), `${at}: Why opens with “${f.why}” “${f.handled}”`);
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
          // On track: no path to green, and nothing says "being handled".
          await p.goto(p.url().replace('/goals/vuln-containers', '/goals/lead-review-small')); await p.locator('.goal-bar').waitFor();
          const on = await bar(p);
          chk(!on.ptg && !on.handled, `lead-review-small 1280: on track shows path to green ${!!on.ptg}, handled “${on.handled}”`);
        }
        await c.close();
      }
    }

    // (a) A range and dated stages, in their own terms.
    [c, p] = await open(1280, 800, 'daniel', '/goals/ns-cfr');
    await p.locator('.goal-bar').waitFor();
    let f = await bar(p);
    chk(/^must stay at most \d/.test(f.cells['vs the limit']?.sub) && /^(Inside it|Inside, near it|Outside it)$/.test(f.cells['vs the limit']?.value) && /of room|over|at the limit/.test(f.cells['room to the limit']?.value) && !!f.cells['vs last week'], `ns-cfr: scorecard ${JSON.stringify(f.cells)}`);
    await p.goto(p.url().replace('/goals/ns-cfr', '/goals/lead-mq')); await p.locator('.goal-bar').waitFor();
    f = await bar(p);
    chk(/^\d of \d stages done$/.test(f.now) && /^\d+$/.test(f.cells['stages late']?.value) && /^Week \d+$/.test(f.cells['next stage']?.value), `lead-mq: bar says ${f.now} / ${JSON.stringify(f.cells)}`);
    chk(f.heads[0] === 'Asked of you', `lead-mq as Daniel (the decision is asked of him): first side heading “${f.heads[0]}”`);
    // (e) Arriving from outside on a goal that feeds another, Back names that goal; About says what it feeds.
    const back = (await p.locator('.goal-page > .backlink').innerText()).trim();
    chk(back === 'Back to Merge-to-deploy time (median)', `lead-mq from outside: “${back}”`);
    const feeds = await p.evaluate(() => { const dt = [...document.querySelectorAll('.about dt')].find((d) => d.textContent === 'Feeds into'); const a = dt?.nextElementSibling?.querySelector('a'); return a ? a.getAttribute('href') : null; });
    chk(/\/goals\/lead-merge$/.test(feeds || ''), `lead-mq: About's Feeds into links to ${feeds}`);
    await c.close();

    // (e) How it's measured, in About (open on a first visit); only the owner (or an admin) is offered to change it.
    [c, p] = await open(390, 844, 'rhea', '/goals/ns-lead', true);
    await p.locator('details.about[open]').waitFor();
    const about = await p.evaluate(() => { const dt = [...document.querySelectorAll('.about dt')].find((d) => d.textContent === 'How it’s measured'); return dt?.nextElementSibling?.innerText.replace(/\s+/g, ' ') || ''; });
    chk(/Source: .+\.$/.test(about) && about.length > 20, `head: How it’s measured “${about}”`);
    await c.close();
    for (const [who, want] of [['yasmin', true], ['rhea', false]]) {
      [c, p] = await open(1280, 800, who, '/goals/vuln-containers');
      await p.locator('.goal-bar').waitFor();
      const n = await p.locator('#change-goal a').count();
      chk(!!n === want, `vuln-containers as ${who}: ${n} ways to change the goal`);
      await c.close();
    }

    // (d) The bar stays on screen: in place at the top, then one line once scrolled, under the review bar in a review.
    for (const [w, h, touch, who, route] of // (Rhea has checked in on the north star, so its check-in is in the … menu; her goal still to post, Base image build time, has the button.)
    [[390, 844, true, 'amara', '/goals/ns-lead'], [1280, 800, false, 'amara', '/goals/lead-mq'], [1440, 900, false, 'rhea', '/goals/ci-docker'], [1100, 800, false, 'amara', '/goals/ns-lead?review=weekly']]) {
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
      // One line: on a phone the status, number and gap (the page's own header had the title); wider, the title too.
      chk(s && (w < 500 || s.title) && s.chip && s.number && !/rgba\(0, 0, 0, 0\)/.test(s.bg) && s.h <= 64, `${at}: compact bar ${JSON.stringify(s)}`);
      if (!/review=/.test(route)) chk(s && s.actions.length >= 1, `${at}: compact bar actions ${s?.actions}`);
      // Back at the top it opens out again.
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(250);
      chk(await p.locator('.goal-bar.compact').count() === 0, `${at}: the bar stays compact at the top`);
      await c.close();
    }

    // (f) The review walk: the chart and recent check-ins open, full width when the columns stack (1024–1200), and each
    // check-in opens to the whole check-in.
    for (const [w, h, touch] of [[390, 844, true], [1024, 768, false], [1100, 900, false], [1200, 900, false], [1280, 800, false]]) {
      [c, p] = await open(w, h, 'amara', '/goals/ns-lead?review=weekly', touch);
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
    [c, p] = await open(1440, 900, 'amara', '/goals/vuln-containers');
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.locator('#activity').getByRole('button', { name: 'Check-ins', exact: true }).click();
    await p.locator('#activity .ci-row').first().click();
    const row = await p.evaluate(() => { const b = document.querySelector('#activity .ci-row'); const d = document.querySelector('#activity .ci-full'); return { exp: b?.getAttribute('aria-expanded'), text: d?.innerText.replace(/\s+/g, ' ') || '' }; });
    chk(row.exp === 'true' && /Cause/.test(row.text) && /Path to green/.test(row.text) && /Checked in Yasmin El-Amin/.test(row.text), `vuln-containers activity: opened check-in ${JSON.stringify(row)}`);
    await c.close();

    // What feeds it: no part of a row draws over another (status over the number, 5 Nov).
    for (const w of [1280, 1440, 390]) {
      [c, p] = await open(w, 900, 'rhea', '/goals/ns-lead');
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
