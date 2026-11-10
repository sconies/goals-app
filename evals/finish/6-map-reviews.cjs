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

    // ---------- Outside review, 9 Nov, item 8: Delete or Backspace on a goal on the map never removes it ----------
    {
      const [c, p] = await open(1440, 900, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor({ timeout: 10000 }).catch(() => {});
      const ids = () => p.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map((x) => x.dataset.id));
      const before = await ids();
      const node = p.locator('.react-flow__node').nth(1);
      await node.click();
      await p.keyboard.press('Escape');
      await node.focus();
      for (const k of ['Delete', 'Backspace']) await p.keyboard.press(k);
      await p.waitForTimeout(300);
      const after = await ids();
      fail(before.length > 0 && after.length === before.length, `Map: Delete/Backspace on a goal took the map from ${before.length} goals to ${after.length}`);
      await c.close();
    }

    // ---------- Demo review, 8 Nov, item 15: from the moment Map is chosen, it says it's drawing or shows the goals ----------
    {
      const [c, p] = await open(1280, 800, 'amara', '/goals');
      await p.locator('[aria-label="Map"]').first().click();
      await p.waitForURL(/view=map/, { timeout: 3000 }).catch(() => {});
      const blank = [];
      for (let t = 0; t < 6000; t += 100) {
        const s = await p.evaluate(() => ({ wait: !!document.querySelector('.map-loading, .map-wait'), nodes: document.querySelectorAll('.react-flow__node').length }));
        // Two samples in a row: the one frame before the click's change is drawn doesn't count.
        if (!s.wait && !s.nodes) blank.push(t);
        else if (blank.length === 1 && blank[0] === t - 100) blank.length = 0;
        if (s.nodes && !s.wait) break;
        await p.waitForTimeout(100);
      }
      fail(blank.length < 2, `Map: blank with nothing said while it loads, at ${blank.slice(0, 5).join(', ')} ms`);
      await c.close();
    }

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
    // Fit all fits: every goal drawn is inside the map, at any width, folded or unfolded (MAP, 9 Nov; it used to stop
    // at 75% and show two of twelve trees at 1920).
    for (const [w, h, unfold] of [[360, 900, false], [1440, 900, false], [1440, 900, true]]) {
      const [c, p] = await open(w, h, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      if (unfold) await p.getByRole('button', { name: 'Unfold all' }).click();
      await p.getByRole('button', { name: 'Fit all' }).click();
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const cv = document.querySelector('.map-canvas').getBoundingClientRect();
        const ns = [...document.querySelectorAll('.react-flow__node')].map((e) => e.getBoundingClientRect());
        return { n: ns.length, out: ns.filter((b) => b.left < cv.left - 1 || b.right > cv.right + 1 || b.top < cv.top - 1 || b.bottom > cv.bottom + 1).length };
      });
      fail(r.n > 0 && r.out === 0, `Map 10: Fit all leaves ${r.out} of ${r.n} goals outside the map at ${w}${unfold ? ', unfolded' : ''}`);
      await c.close();
    }
    // Feeds-into lines: thin and grey (Map 26), measured with the branches unfolded.
    {
      const [c, p] = await open(1280, 800, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      await p.getByRole('button', { name: 'Unfold all' }).click();
      await p.waitForFunction(() => document.querySelector('.react-flow__edge.feeds:not(.critical) .react-flow__edge-path'), null, { timeout: 5000 }).catch(() => {});
      const f = await p.evaluate(() => { const e = document.querySelector('.react-flow__edge.feeds:not(.critical) .react-flow__edge-path'); return e && [getComputedStyle(e).stroke, getComputedStyle(e).strokeWidth]; });
      fail(!!f && f[0] === 'rgb(154, 163, 161)' && f[1] === '1.5px', `Map 26: feeds-into lines ${f ? f.join(' at ') : 'not drawn'}`);
      await c.close();
    }
    {
      const [c, p] = await open(1920, 1080, 'amara', MAP);
      await p.locator('.react-flow__node').first().waitFor();
      await p.waitForTimeout(300);
      const ok = await p.evaluate(() => {
        const cv = document.querySelector('.map-canvas').getBoundingClientRect();
        // Twelve north stars: the map opens on all of them (MAP, 9 Nov); the first, on the critical path, is in view.
        const crit = [...document.querySelectorAll('.react-flow__node[data-id="ns-lead"]')];
        return crit.length > 0 && crit.every((e) => { const b = e.getBoundingClientRect(); return b.left >= cv.left && b.right <= cv.right; });
      });
      fail(ok, 'Map 16: at 1920 the map does not open with both north stars in view');
      await c.close();
    }

    // ---------- the map at scale: 126 goals (backlog MAP, outside review 9 Nov) ----------
    const inMap = (p, sel) => p.evaluate((s) => {
      const cv = document.querySelector('.map-canvas').getBoundingClientRect(), e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect(), find = document.querySelector('.map-find')?.getBoundingClientRect();
      return { in: b.left >= cv.left - 1 && b.right <= cv.right + 1 && b.top >= cv.top - 1 && b.bottom <= cv.bottom + 1, underFind: !!find && b.top < find.bottom && b.left < find.right && b.right > find.left };
    }, sel);
    for (const [w, h, touch] of [[1920, 1080, false], [390, 844, true]]) {
      const at = `at ${w}`;
      const [c, p] = await open(w, h, 'amara', '/goals', touch);
      // MAP 6: no staged "Drawing the map" wait: the goals are drawn soon after Map is chosen, and nothing says it's drawing.
      const t0 = Date.now();
      if (touch) await p.locator('.layout-menu > summary').click();
      await p.getByRole('group', { name: 'Layout' }).filter({ visible: true }).getByRole('button', { name: /^Map/ }).first().click();
      await p.locator('.react-flow__node').first().waitFor({ timeout: 10000 }).catch(() => {});
      const ms = Date.now() - t0;
      fail(ms < 4000, `MAP 6: the map took ${ms}ms to show its goals ${at}`);
      fail(!(await p.locator('.map-loading').count()), `MAP 6: the map still has a staged "Drawing the map" wait ${at}`);
      await p.waitForTimeout(500);
      // MAP 5: it opens folded to the top goals: all 14 of them, with the critical path drawn beneath the ones in trouble.
      const open1 = await p.evaluate(() => ({ n: document.querySelectorAll('.react-flow__node').length, roots: ['ns-lead', 'ns-ci', 'ns-deploy', 'ns-cfr', 'ns-mttr', 'ns-slo', 'ns-cost', 'ns-devsat', 'ns-vuln', 'ns-ai', 'ns-env', 'ns-fresh', 'laptops', 'ci-cost'].filter((id) => document.querySelector(`.react-flow__node[data-id="${id}"]`)).length, crit: document.querySelectorAll('.react-flow__edge.critical').length }));
      fail(open1.roots === 14 && open1.n < 63 && open1.crit > 0, `MAP 5: ${at} the map opens with ${open1.n} goals, ${open1.roots} of 14 top goals and ${open1.crit} critical lines`);
      // MAP 1: on a desktop it opens on every tree (Fit all), each top goal inside the map.
      if (!touch) {
        const all = await p.evaluate(() => { const cv = document.querySelector('.map-canvas').getBoundingClientRect(); return [...document.querySelectorAll('.react-flow__node')].every((e) => { const b = e.getBoundingClientRect(); return b.left >= cv.left - 1 && b.right <= cv.right + 1 && b.top >= cv.top - 1 && b.bottom <= cv.bottom + 1; }); });
        fail(all, `MAP 1: ${at} the map does not open with every tree in view`);
      }
      // MAP 3 and 4: numbers on the nodes, and a parent shows the worst status under it, shape and words agreeing.
      const lead = await p.evaluate(() => {
        const n = document.querySelector('.react-flow__node[data-id="ns-lead"] .map-node');
        return n && { nums: n.querySelector('.map-nums')?.textContent ?? '', under: n.querySelector('.map-under svg')?.dataset.status, words: n.querySelector('.map-under')?.textContent ?? '' };
      });
      fail(!!lead && /\d/.test(lead.nums) && /target/.test(lead.nums) && /behind|ahead|plan/.test(lead.nums), `MAP 3: ${at} Lead time's node has no value, target and gap ("${lead?.nums}")`);
      fail(!!lead && lead.under === 'off' && /Under it: \d+ off track/.test(lead.words), `MAP 4: ${at} Lead time's node does not show the worst status under it (${lead?.under}: "${lead?.words}")`);
      // MAP 2: search finds the node by its key: it opens the tree, outlines the goal and moves the map to it.
      const box = p.getByRole('combobox', { name: /Find a goal/ });
      await box.fill('G-48');
      await p.getByRole('option', { name: /G-48/ }).first().waitFor({ timeout: 3000 }).catch(() => {});
      await p.keyboard.press('Enter');
      await p.waitForTimeout(800);
      const g48 = await p.evaluate(() => { const n = document.querySelector('.map-node.found'); return n && n.closest('.react-flow__node').dataset.id; });
      const seen = g48 && await inMap(p, `.react-flow__node[data-id="${g48}"]`);
      fail(g48 === 'mttr-oncall' && !!seen && seen.in && !seen.underFind, `MAP 2: ${at} finding G-48 found ${g48 ?? 'nothing'}, in view ${seen?.in}, under the find box ${seen?.underFind}`);
      // ...and by its title.
      await box.fill('merge queue live');
      await p.waitForTimeout(200);
      await p.getByRole('option', { name: /Merge queue live/ }).first().click().catch(() => {});
      await p.waitForTimeout(800);
      const mq = await inMap(p, '.react-flow__node[data-id="lead-mq"] .map-node.found');
      fail(!!mq && mq.in, `MAP 2: ${at} finding "merge queue live" does not outline and show it`);
      // MAP 5: Troubled trees only: fewer trees, each of them in trouble (its top goal or something under it behind).
      await p.getByLabel(/Troubled trees/).check();
      await p.waitForTimeout(600);
      const tr = await p.evaluate(() => {
        const tops = ['ns-lead', 'ns-ci', 'ns-deploy', 'ns-cfr', 'ns-mttr', 'ns-slo', 'ns-cost', 'ns-devsat', 'ns-vuln', 'ns-ai', 'ns-env', 'ns-fresh', 'laptops', 'ci-cost'].map((id) => document.querySelector(`.react-flow__node[data-id="${id}"] .map-node`)).filter(Boolean);
        const bad = (k) => ['off', 'risk', 'stale'].includes(k);
        return { n: tops.length, ok: tops.every((t) => bad(t.dataset.tone) || bad(t.querySelector('.map-under svg')?.dataset.status)) };
      });
      fail(tr.n > 0 && tr.n < 14 && tr.ok, `MAP 5: ${at} Troubled trees only shows ${tr.n} trees, all in trouble ${tr.ok}`);
      // F05: the map refits when what it shows changes: with the trees in trouble only, every goal is in view again.
      if (!touch) {
        await p.getByRole('button', { name: 'Fit all' }).click();
        await p.getByLabel(/Troubled trees/).uncheck();
        await p.waitForTimeout(700);
        const out = await p.evaluate(() => { const cv = document.querySelector('.map-canvas').getBoundingClientRect(); return [...document.querySelectorAll('.react-flow__node')].filter((e) => { const b = e.getBoundingClientRect(); return b.right < cv.left || b.left > cv.right || b.bottom < cv.top || b.top > cv.bottom; }).length; });
        fail(out === 0, `F05: ${at} after the trees in trouble are shown again, ${out} goals are off the map`);
      } else await p.getByLabel(/Troubled trees/).uncheck();
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
