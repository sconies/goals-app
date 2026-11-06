/* F6: fit and finish, map-reviews (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures. */
const MAP = '/goals?view=map';
const tour = (p, step) => p.evaluate((s) => { sessionStorage.setItem('goals-tour', JSON.stringify({ id: 'map', step: s })); window.dispatchEvent(new Event('goals-tour')); }, step);
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);
const hit = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const n = (x) => (x == null ? 'none' : Math.round(x));

module.exports = {
  id: 'F6',
  area: 'map-reviews',
  async run({ open }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };

    // ---------- the map, 1280×800: no page scroll, zoom top right, the walkthrough beside what it points at ----------
    {
      const [c, p] = await open(1280, 800, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => {
        const cv = document.querySelector('.map-canvas').getBoundingClientRect(), ct = document.querySelector('.react-flow__controls').getBoundingClientRect();
        const fold = document.querySelector('.map-fold').getBoundingClientRect();
        const edges = [...document.querySelectorAll('.react-flow__edge')];
        const feed = document.querySelector('.react-flow__edge.feeds:not(.critical) .react-flow__edge-path'), crit = document.querySelector('.react-flow__edge.critical .react-flow__edge-path');
        const lastPlain = edges.map((e) => !e.classList.contains('critical')).lastIndexOf(true), firstCrit = edges.findIndex((e) => e.classList.contains('critical'));
        const node = document.querySelector('.map-node:not(.critical)');
        const legend = [...document.querySelectorAll('.map-legend > span, .map-key-more > summary')].map((e) => e.getBoundingClientRect());
        return {
          sh: document.documentElement.scrollHeight, ih: innerHeight, cvB: cv.bottom, cvR: cv.right, cvT: cv.top, ctR: ct.right, ctT: ct.top, fold: fold.width,
          feed: feed && getComputedStyle(feed).stroke, feedW: feed && getComputedStyle(feed).strokeWidth, critW: crit && getComputedStyle(crit).strokeWidth,
          order: firstCrit > lastPlain, pad: getComputedStyle(node).padding, nums: getComputedStyle(document.querySelector('.map-title')).fontVariantNumeric,
          keyH: legend.map((r) => Math.round(r.height)), keyT: legend.map((r) => Math.round(r.top)),
          seg: [...document.querySelectorAll('.map-frame button')].map((b) => b.getAttribute('aria-pressed')),
        };
      });
      fail(m.sh <= m.ih + 1, `Map 16: the map page scrolls at 1280×800 (${m.sh} > ${m.ih})`);
      fail(Math.abs(m.cvB - (m.ih - 24)) <= 2, `Map 16: canvas ends at ${n(m.cvB)}, not 24px above the window (${m.ih - 24})`);
      fail(m.cvR - m.ctR >= 10 && m.cvR - m.ctR <= 16 && m.ctT - m.cvT >= 10 && m.ctT - m.cvT <= 16, `Map 7/11: zoom controls not top right 12px in (right gap ${n(m.cvR - m.ctR)}, top gap ${n(m.ctT - m.cvT)})`);
      fail(m.fold >= 96, `Map 17: Fold all is ${n(m.fold)}px wide (min 96)`);
      fail(m.feed === 'rgb(154, 163, 161)' && m.feedW === '1.5px', `Map 26: feeds-into lines ${m.feed} at ${m.feedW}`);
      fail(m.critW === '3px' && m.order, `Map 9: critical lines ${m.critW}, drawn last ${m.order}`);
      fail(m.pad === '12px', `Map 24: node padding ${m.pad}`);
      fail(m.nums === 'normal', `Map 23: map titles use ${m.nums} figures`);
      fail(m.keyH.every((h) => h === 26) && Math.max(...m.keyT) - Math.min(...m.keyT) <= 1, `Map 19: key line boxes ${m.keyH.join('/')} at ${m.keyT.join('/')}`);
      fail(m.seg.length === 2 && m.seg.filter((x) => x === 'true').length === 1, `Map 21: framing is not a segmented control with one pressed (${m.seg.join(',')})`);
      // Step 2: left of the critical goal (else below), 16px off, clear of the north star and the red line.
      await tour(p, 1);
      await p.waitForTimeout(900);
      const coach = await rect(p, '.coach'), ring = await rect(p, '.coach-ring'), star = await rect(p, '.map-node.critical[data-coach-avoid]');
      fail(!hit(coach, ring) && !hit(coach, star), `Map 4: the step 2 card covers the goal or its north star (card ${n(coach?.l)},${n(coach?.t)}; ring ${n(ring?.l)},${n(ring?.t)})`);
      // Left of the goal (or below) when that fits inside the main area; the sidebar is never covered, so at 1280 the card
      // takes the clear corner instead. Either way it is 16px clear of the goal.
      fail(!!coach && !!ring && (coach.r <= ring.l - 15 || coach.t >= ring.b + 15 || coach.l >= ring.r + 15 || coach.b <= ring.t - 15), `Map 4: the step 2 card is not 16px clear of the goal`);
      const mainL = await p.evaluate(() => document.querySelector('main.work')?.getBoundingClientRect().left ?? 0);
      fail(!!coach && coach.l >= mainL + 15, `Map 4: the step 2 card covers the sidebar (card left ${n(coach?.l)}, main starts ${n(mainL)})`);
      // Step 3: over the map, left of the panel, bottom 16px above the canvas's.
      await p.locator('.map-node.critical').first().click();
      await p.waitForTimeout(900);
      const c3 = await rect(p, '.coach'), panel = await rect(p, '.map-panel'), cv = await rect(p, '.map-canvas');
      fail(!!c3 && !!panel && !hit(c3, panel) && c3.r <= panel.l - 15 && Math.abs(c3.b - (cv.b - 16)) <= 2, `Map 1: step 3 card ${n(c3?.l)}–${n(c3?.r)} × ${n(c3?.t)}–${n(c3?.b)}, panel from ${n(panel?.l)}, canvas bottom ${n(cv?.b)}`);
      fail(!!panel && Math.abs(panel.h - cv.h) <= 1, `Map 12: panel ${n(panel?.h)}px tall beside a ${n(cv?.h)}px canvas`);
      const pm = await p.evaluate(() => {
        const dt = document.querySelector('.map-panel .story dt')?.getBoundingClientRect(), dd = document.querySelector('.map-panel .story dd')?.getBoundingClientRect();
        const x = document.querySelector('.map-panel .map-close').getBoundingClientRect();
        const sel = document.querySelector('.map-node.selected');
        return { stacked: !!dt && !!dd && Math.abs(dt.left - dd.left) < 1 && dd.top > dt.top, close: [x.width, x.height], outline: sel && getComputedStyle(sel).outlineWidth };
      });
      fail(pm.stacked, 'Map 14: the panel’s facts are not stacked, label above text');
      fail(pm.close[0] >= 44 && pm.close[1] >= 44, `Map 15: panel close is ${pm.close.join('×')}`);
      fail(pm.outline === '2px', `Map 25: the selected goal’s outline is ${pm.outline}`);
      await c.close();
    }
    // ---------- 768: the story is a sheet over a full-width map ----------
    {
      const [c, p] = await open(768, 1024, 'amara', MAP);
      await p.locator('.map-node.critical').first().waitFor();
      const before = await rect(p, '.map-canvas');
      await p.locator('.map-node.critical').first().click();
      await tour(p, 2);
      await p.waitForTimeout(900);
      const after = await rect(p, '.map-canvas'), panel = await rect(p, '.map-panel'), coach = await rect(p, '.coach');
      fail(Math.abs(after.w - before.w) < 1 && hit(panel, after), `Map 13: at 768 the canvas shrinks to ${n(after.w)}px for the panel`);
      fail(!hit(coach, panel), 'Map 1: at 768 the step 3 card covers the panel');
      await c.close();
    }
    // ---------- 853×533 (150%): the critical goal is scrolled into view, the card beside it ----------
    {
      const [c, p] = await open(853, 533, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      await tour(p, 1);
      await p.waitForTimeout(1200);
      const ring = await rect(p, '.coach-ring'), coach = await rect(p, '.coach'), bar = await rect(p, '.map-bar');
      fail(!!ring && ring.t >= 0 && ring.b <= 533, `Map 5: the critical goal is off screen at 853×533 (${n(ring?.t)}–${n(ring?.b)})`);
      fail(!hit(coach, ring) && !hit(coach, bar), 'Map 5: the card covers the goal or the map controls at 853×533');
      await c.close();
    }
    // ---------- phones ----------
    for (const [w, h] of [[360, 740], [390, 844]]) {
      const [c, p] = await open(w, h, 'amara', MAP, true);
      await p.locator('.map-node.critical').first().waitFor();
      const m = await p.evaluate(() => {
        const cv = document.querySelector('.map-canvas').getBoundingClientRect(), ct = document.querySelector('.react-flow__controls').getBoundingClientRect();
        const bar = document.querySelector('.map-bar').getBoundingClientRect(), seg = document.querySelector('.map-frame').getBoundingClientRect();
        return { cvH: cv.height, ctR: cv.right - ct.right, ctT: ct.top - cv.top, bar: bar.height, segL: seg.left };
      });
      fail(m.cvH >= 360, `Map 7: canvas ${n(m.cvH)}px tall at ${w}`);
      fail(m.ctR >= 10 && m.ctR <= 16 && m.ctT >= 10 && m.ctT <= 16, `Map 7: zoom controls not top right at ${w}`);
      fail(m.bar <= 140 && Math.abs(m.segL - 16) <= 1, `Map 22: controls row ${n(m.bar)}px tall, framing starts at x ${n(m.segL)}`);
      await p.locator('.map-node.critical').first().click();
      await p.waitForTimeout(700);
      const s = await p.evaluate(() => {
        const sh = document.querySelector('.map-panel'), r = sh.getBoundingClientRect(), sel = document.querySelector('.map-node.selected')?.getBoundingClientRect();
        return { pos: getComputedStyle(sh).position, b: r.bottom, w: r.width, h: r.height, t: r.top, selB: sel?.bottom, selT: sel?.top };
      });
      fail(s.pos === 'fixed' && Math.abs(s.b - h) <= 1 && s.w >= w - 1 && s.h <= h * 0.7 + 1, `Map 3: at ${w} the story is not a bottom sheet (${s.pos}, ${n(s.w)}×${n(s.h)})`);
      fail(s.selB != null && s.selB <= s.t && s.selT >= 0, `Map 3: at ${w} the selected goal is hidden (${n(s.selT)}–${n(s.selB)}, sheet from ${n(s.t)})`);
      await tour(p, 2);
      await p.waitForTimeout(900);
      const coach = await rect(p, '.coach'), sheet = await rect(p, '.map-panel');
      fail(!!coach && coach.b <= sheet.t - 15 && coach.t >= 60, `Map 2: at ${w} the step 3 card is not above the sheet (card ${n(coach?.t)}–${n(coach?.b)}, sheet ${n(sheet?.t)})`);
      await c.close();
    }
    // Fit all never goes below 75%.
    for (const w of [360, 1440]) {
      const [c, p] = await open(w, 900, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      await p.getByRole('button', { name: 'Fit all' }).click();
      await p.waitForTimeout(400);
      const z = await p.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.react-flow__viewport').style.transform)?.[1] ?? 0));
      fail(z >= 0.749, `Map 10: Fit all zooms to ${z} at ${w}`);
      await c.close();
    }
    {
      const [c, p] = await open(1920, 1080, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      await p.waitForTimeout(300);
      const ok = await p.evaluate(() => {
        const cv = document.querySelector('.map-canvas').getBoundingClientRect();
        // Twelve north stars now, so they can't all be in view at once: the first, on the critical path (Lead time for changes), is.
        const crit = [...document.querySelectorAll('.react-flow__node[data-id="ns-lead"]')];
        return crit.length > 0 && crit.every((e) => { const b = e.getBoundingClientRect(); return b.left >= cv.left && b.right <= cv.right; });
      });
      fail(ok, 'Map 16: at 1920 the map does not open with both north stars in view');
      await c.close();
    }

    // ---------- reviews ----------
    {
      const [c, p] = await open(1280, 800, 'amara', '/goals/ns-lead?review=weekly');
      await p.locator('.decide').waitFor();
      const m = await p.evaluate(() => {
        // The head is the summary bar since the flagship page (5 Nov); the evidence is the chart and recent check-ins.
        const head = document.querySelector('.goal-bar').getBoundingClientRect(), ev = document.querySelector('.review-evidence').getBoundingClientRect();
        const d = document.querySelector('.decide'), cs = getComputedStyle(d), track = getComputedStyle(document.querySelector('.reviewbar .bar')).backgroundColor;
        const cur = [...document.querySelectorAll('.side [aria-current="page"]')].map((e) => e.textContent.trim());
        return { gap: ev.top - head.bottom, pad: [cs.paddingTop, cs.paddingBottom], track, cur };
      });
      fail(m.gap <= 40, `RV 2: ${n(m.gap)}px hole above "Chart and check-ins"`);
      fail(m.pad[0] === '12px' && m.pad[1] === '12px', `RV 22: decide bar padding ${m.pad.join('/')}`);
      fail(m.track === 'rgb(154, 163, 161)', `RV 5: review bar track ${m.track}`);
      fail(m.cur.length === 1 && /Reviews/.test(m.cur[0]), `RV 8: the sidebar marks ${m.cur.join(', ') || 'nothing'} while walking a review`);
      await c.close();
    }
    {
      const [c, p] = await open(1920, 1080, 'amara', '/goals/lead-review?review=weekly');
      await p.locator('.decide').waitFor();
      const b = await rect(p, '.decide');
      fail(Math.abs(b.b - 1080) <= 1, `RV 17: on a short goal the decide bar ends at ${n(b.b)}, not the window's bottom`);
      await c.close();
    }
    for (const w of [360, 390]) {
      const [c, p] = await open(w, 800, 'amara', '/goals/ns-lead?review=weekly', true);
      await p.locator('.decide').waitFor();
      const m = await p.evaluate(() => {
        const d = document.querySelector('.decide').getBoundingClientRect();
        const btns = [...document.querySelectorAll('.decide-buttons .btn')].map((b) => b.getBoundingClientRect());
        const links = [...document.querySelectorAll('.decide .quiet-links .linkish')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().height);
        const skip = [...document.querySelectorAll('.decide .linkish')].some((e) => e.textContent.includes('Skip') && e.getClientRects().length);
        const track = document.querySelector('.reviewbar .bar').getBoundingClientRect(), name = document.querySelector('.reviewbar .ellipsis');
        return { h: d.height, w: btns.map((b) => b.width), bh: btns.map((b) => b.height), links, skip, trackW: track.width, cut: name.scrollWidth > name.clientWidth + 1 };
      });
      fail(m.h <= 130, `RV 4: decide bar ${n(m.h)}px tall at ${w}`);
      fail(Math.abs(m.w[0] - m.w[1]) <= 1 && m.bh.every((x) => x <= 48), `RV 4: decide buttons ${m.w.map(n).join('/')} wide, ${m.bh.map(n).join('/')} tall at ${w}`);
      fail(!m.skip && m.links.every((x) => x >= 44), `RV 4/7: quiet links ${m.links.map(n).join('/')} tall, Skip shown ${m.skip} at ${w}`);
      if (w === 360) fail(m.trackW >= 300 && !m.cut, `RV 19: at 360 the review name is cut (track ${n(m.trackW)}px)`);
      await c.close();
    }
    {
      const [c, p] = await open(390, 844, 'amara', '/reviews/weekly');
      await p.locator('.hero').waitFor();
      const m = await p.evaluate(() => {
        const a = [...document.querySelectorAll('.hero .actions .btn')].map((b) => b.getBoundingClientRect().width);
        const hw = document.querySelector('.hero').getBoundingClientRect().width;
        const t = document.querySelector('.agenda .agenda-name').getBoundingClientRect().width;
        return { a, t, hw };
      });
      fail(m.a.length >= 2 && m.a.every((x) => Math.abs(x - m.hw) < 1), `RV 10: hero buttons ${m.a.map(n).join('/')} wide at 390`);
      // The finished ring's tick: centred inside it, 24px (the ring as it draws on a finished review).
      const tick = await p.evaluate(() => {
        const r = document.querySelector('.ring'); r.classList.add('complete');
        r.querySelector('.ring-text').innerHTML = '<svg viewBox="0 0 16 16" width="21" height="21"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
        return new Promise((done) => setTimeout(() => {
        const a = r.getBoundingClientRect(), b = r.querySelector('.ring-text svg').getBoundingClientRect();
        done({ dx: (b.left + b.width / 2) - (a.left + a.width / 2), dy: (b.top + b.height / 2) - (a.top + a.height / 2), w: b.width });
        }, 500));
      });
      fail(Math.abs(tick.dx) <= 1 && Math.abs(tick.dy) <= 1 && Math.round(tick.w) === 24, `RV 20: the finished tick is ${n(tick.w)}px, ${n(tick.dx)},${n(tick.dy)} off centre`);
      fail(m.t >= m.hw - 40, `RV 11: goal titles squeezed to ${n(m.t)}px at 390`);
      await c.close();
    }
    {
      const [c, p] = await open(1280, 800, 'amara', '/reviews/weekly');
      await p.locator('.agenda .agenda-row').first().waitFor();
      const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.agenda .agenda-row')).gridTemplateColumns.split(' '));
      // The agenda's own rows (Lane, 5 Nov): one fixed status column so the names line up, the name taking the room.
      fail(cols[0] === '144px' && parseFloat(cols[1]) >= 200, `RV 11: Still to review columns ${cols.join(' ')}`);
      await p.goto(p.url().replace(/\/reviews\/weekly/, '/reviews'));
      await p.locator('a.arow').first().waitFor();
      const ap = await p.evaluate(() => getComputedStyle(document.querySelector('a.arow')).padding);
      fail(ap === '12px 16px', `RV 23: review rows padded ${ap}`);
      await c.close();
    }
    {
      const [c, p] = await open(390, 844, 'amara', '/reviews/new');
      await p.locator('.focus-top').waitFor();
      const h1 = await p.evaluate(() => { const h = document.querySelector('.focus-top h1'); return h ? [getComputedStyle(h).fontSize, h.textContent] : null; });
      fail(!!h1 && h1[0] === '22px', `RV 14: set-up title ${h1 ? h1.join(' ') : 'is not a heading'}`);
      await p.getByRole('button', { name: 'North star' }).click();
      await p.locator('.optlist .opt').first().click();
      const sel = await p.evaluate(() => {
        const pill = document.querySelector('.pill[aria-pressed="true"]'), opt = document.querySelector('.opt[aria-checked="true"]');
        return { pillIcon: !!pill?.querySelector('svg'), pillBg: pill && getComputedStyle(pill).backgroundColor, optIcon: !!opt?.querySelector('.picked-mark svg'), optBg: opt && getComputedStyle(opt).backgroundColor };
      });
      fail(sel.pillIcon && sel.optIcon, `RV 16: selected choices carry no tick (pill ${sel.pillIcon}, row ${sel.optIcon})`);
      fail(sel.pillBg !== 'rgb(226, 241, 239)' && sel.optBg !== 'rgb(226, 241, 239)', `RV 16: selection is still a pastel fill (${sel.pillBg}, ${sel.optBg})`);
      await c.close();
    }
    {
      // Below 1024: the review's text links are 44px targets.
      const [c, p] = await open(768, 1024, 'amara', '/reviews/weekly');
      await p.locator('.hero').waitFor();
      await p.locator('.healthy-group summary').click(); // the choice to walk them sits inside the folded group (Lane, 5 Nov)
      await p.locator('.healthy-group .linkish').first().waitFor();
      const hs = await p.evaluate(() => [...document.querySelectorAll('.healthy-group .linkish')].map((e) => e.getBoundingClientRect().height));
      fail(hs.length > 0 && hs.every((x) => x >= 44), `RV 7: "Walk them one at a time" is ${hs.map(n).join('/')}px tall at 768`);
      await c.close();
    }
    return fails;
  },
};
