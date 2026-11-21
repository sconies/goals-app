/* F26: the design review of 21 Nov, its highs (docs/reviews/2026-11-design-review.md H1–H5, A1; backlog DR1–DR5, DR10).
   H3 (the marks' 3:1) is checked on every screen by P6. run({ open }) returns a list of failures. */
const LATE = '/?today=2026-10-30'; // the review's own day: Amara has two reviews not held yet
const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);
const hit = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
/** A token's colour as the page computes it ("rgb(200, 55, 43)"). */
const token = (p, v) => p.evaluate((name) => { const t = document.createElement('i'); t.style.color = `var(${name})`; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; }, v);
const rgbOf = (c) => (String(c).match(/[\d.]+/g) || []).slice(0, 3).join(',');

module.exports = {
  id: 'F26',
  area: 'design-review',
  title: 'The design review’s highs: the ring’s word under it and its count named beside it, a neutral projection range, the critical path in words not red, the late review named once, and Find giving focus back',
  reqs: ['DESIGN-RULES', 'FIT-AND-FINISH-AREAS'],
  async run({ open }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };

    // ---------- H1, H5: Amara's Home with two late reviews, at desktop and phone ----------
    for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
      const at = `${w}px`;
      const [c, p] = await open(w, h, 'amara', LATE, touch);
      await p.locator('.home-hero').waitFor({ timeout: 8000 }).catch(() => {});
      const m = await p.evaluate(() => {
        const ring = document.querySelector('.home-hero .ring'), word = ring?.querySelector('.ring-counts');
        const r = ring?.getBoundingClientRect(), wb = word?.getBoundingClientRect();
        const others = [...document.querySelectorAll('.home-hero .hero-body > *')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
        const eb = document.querySelector('.home-hero .eyebrow'), mark = eb?.querySelector('svg');
        const text = eb ? [...eb.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()) : null;
        let first = null;
        if (text) { const rg = document.createRange(); rg.selectNodeContents(text); const rs = rg.getClientRects(); if (rs.length) first = { t: rs[0].top, b: rs[0].bottom }; }
        const mb = mark?.getBoundingClientRect();
        return {
          ring: r && { l: r.left, t: r.top, r: r.right, b: r.bottom }, word: wb && wb.width > 0 && getComputedStyle(word).display !== 'none' ? { l: wb.left, t: wb.top, r: wb.right, b: wb.bottom, text: word.textContent } : null,
          others, shown: ring?.querySelector('.ring-text')?.textContent || '',
          title: document.querySelector('.home-hero .hero-title')?.textContent || '', eyebrow: eb?.textContent || '',
          button: document.querySelector('.home-hero .btn.primary')?.textContent || '',
          strip: document.querySelector('.dash-missed')?.textContent || null,
          mark: mb && first ? { mid: (mb.top + mb.bottom) / 2, t: first.t, b: first.b } : null,
        };
      });
      // H1: the ring's word is shown, under the ring, clear of the hero's words.
      fail(!!m.word, `H1 ${at}: Home’s ring has no word saying what it counts (it shows a bare “${m.shown}”)`);
      if (m.word && m.ring) {
        fail(m.word.t >= m.ring.b - 0.5, `H1 ${at}: the ring’s word “${m.word.text}” sits inside the ring (its top ${Math.round(m.word.t)}, the ring’s bottom ${Math.round(m.ring.b)})`);
        fail(!m.others.some((o) => hit(o, m.word)), `H1 ${at}: the ring’s word “${m.word.text}” runs into the hero’s words`);
      }
      // H1: the ring's count is a number the words beside it say ("0/17" with "…, of 17 in the review").
      const total = (m.shown.match(/\/(\d+)/) || [])[1];
      fail(!total || new RegExp(`\\b${total}\\b`).test(m.title), `H1 ${at}: the ring reads ${m.shown}, but the title says “${m.title}”`);
      // H5: the button names its review, the strip doesn't say "Not held yet" a second time, and the mark keeps its line.
      const named = /^Not held yet · (.+?) was on /.exec(m.eyebrow)?.[1];
      fail(!!named, `H5 ${at}: the hero is not about a late review: “${m.eyebrow}”`);
      if (named) {
        fail(m.button.includes(named), `H5 ${at}: the hero’s button “${m.button}” doesn’t name ${named}`);
        fail(m.strip == null || !/Not held yet/.test(m.strip), `H5 ${at}: This week says “Not held yet” again: “${m.strip}”`);
      }
      fail(!m.mark || (m.mark.mid >= m.mark.t - 1 && m.mark.mid <= m.mark.b + 1), `H5 ${at}: the eyebrow’s warning mark sits on a line of its own`);
      await c.close();
    }

    // ---------- H1: a review's page, where the ring counts the review and the button the goals to discuss ----------
    {
      const [c, p] = await open(1440, 900, 'amara', '/reviews/weekly?today=2026-10-30');
      await p.locator('.review-home .ring').waitFor({ timeout: 8000 }).catch(() => {});
      const shown = await p.locator('.review-home .ring .ring-text').innerText().catch(() => '');
      const line = await p.locator('.review-line').innerText().catch(() => '');
      const btn = await p.locator('.review-home .btn.primary').first().innerText().catch(() => '');
      const total = (shown.match(/\/(\d+)/) || [])[1], walk = (btn.match(/· (\d+) goals?/) || [])[1];
      fail(!total || new RegExp(`\\b${total} in scope\\b`).test(line), `H1 review: the ring reads ${shown}, but the line says “${line}”`);
      fail(!walk || walk === total || /to discuss/.test(btn), `H1 review: the ring reads ${shown} and the button “${btn}” counts something else without saying what`);
      await c.close();
    }

    // ---------- H2: the projection's range in neutral ink, with its edges and a "likely" label; the line never red ----------
    for (const scheme of ['light', 'dark']) {
      const [c, p] = await open(1440, 900, 'rhea', '/goals/lead-ci-time');
      await p.emulateMedia({ colorScheme: scheme });
      await p.locator('.goal-chart svg').first().waitFor({ timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(400);
      const off = rgbOf(await token(p, '--off-mark'));
      const m = await p.evaluate(() => {
        const band = document.querySelector('.goal-chart .c-band'), fc = document.querySelector('.goal-chart .c-fc');
        const words = [...document.querySelectorAll('.goal-chart svg text')].map((t) => t.textContent);
        return {
          band: band && { fill: getComputedStyle(band).fill, op: parseFloat(getComputedStyle(band).fillOpacity) },
          edges: document.querySelectorAll('.goal-chart .c-band-edge').length,
          fc: fc && getComputedStyle(fc).stroke, words,
        };
      });
      fail(!!m.band, `H2 ${scheme}: Pipeline queue wait’s chart draws no range`);
      if (m.band) {
        fail(rgbOf(m.band.fill) !== off, `H2 ${scheme}: the range is filled in off track’s red`);
        fail(m.band.op >= 0.15, `H2 ${scheme}: the range is filled at ${m.band.op}, too faint to see (at least 0.15)`);
        fail(m.edges === 2, `H2 ${scheme}: the range has ${m.edges} edges drawn, not its top and bottom`);
        fail(m.words.some((t) => /^likely [\d.,]+–[\d.,]+/.test(t || '')), `H2 ${scheme}: the range isn’t labelled “likely {low}–{high}” (${m.words.filter((t) => /likely/.test(t)).join(' | ') || 'no likely'})`);
      }
      fail(!m.fc || rgbOf(m.fc) !== off, `H2 ${scheme}: the projection line is off track’s red whatever the goal’s status`);
      await c.close();
    }

    // ---------- H4: the map's critical path in words and ink on the node; red only on its edges ----------
    {
      const [c, p] = await open(1440, 900, 'amara', '/goals?scope=all&view=map');
      await p.locator('.map-node.critical').first().waitFor({ timeout: 10000 }).catch(() => {});
      const off = rgbOf(await token(p, '--off-mark'));
      const nodes = await p.$$eval('.map-node.critical', (els) => els.map((e) => {
        const cs = getComputedStyle(e);
        return { tone: e.dataset.tone, text: e.textContent, colours: ['Top', 'Right', 'Bottom', 'Left'].map((k) => cs['border' + k + 'Color']), styles: ['Top', 'Right', 'Bottom', 'Left'].map((k) => cs['border' + k + 'Style']), shadow: cs.boxShadow };
      }));
      fail(nodes.length > 0, 'H4: Amara’s map shows no goal on the critical path');
      for (const x of nodes) {
        const red = x.colours.some((k) => rgbOf(k) === off) || x.shadow.includes(`rgb(${off.split(',').join(', ')})`);
        fail(!red, `H4: a ${x.tone} goal on the critical path is outlined in off track’s red`);
        fail(x.styles.every((s) => s === 'solid'), `H4: a ${x.tone} goal on the critical path has a ${x.styles.join('/')} outline, not solid`);
        fail(/Critical path/.test(x.text), `H4: a ${x.tone} goal on the critical path doesn’t say so in words`);
      }
      const edges = await p.$$eval('.react-flow__edge.critical .react-flow__edge-path', (els) => els.map((e) => getComputedStyle(e).stroke));
      fail(edges.length > 0 && edges.every((s) => rgbOf(s) === off), 'H4: the critical path’s edges are no longer drawn in red');
      await c.close();
    }

    // ---------- A1, A2: Find shows its focus ring, and gives focus back to what opened it ----------
    {
      const [c, p] = await open(1440, 900, 'rhea', '/');
      await p.locator('[data-part="Home"]').waitFor({ timeout: 8000 }).catch(() => {});
      const button = p.locator('button.find-nav:visible, button.find-btn:visible').first();
      await button.focus();
      await p.keyboard.press('Enter');
      await p.locator('.find-input').waitFor({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(150);
      const ring = await p.evaluate(() => { const e = document.activeElement; const cs = e && getComputedStyle(e); return e?.classList.contains('find-input') ? { o: cs.outlineStyle, w: parseFloat(cs.outlineWidth), s: cs.boxShadow } : null; });
      fail(!!ring, 'A1: Find opened without focus in its field');
      fail(!ring || (ring.o !== 'none' && ring.w >= 2) || ring.s !== 'none', `A2: Find’s field shows no focus ring (outline ${ring?.o} ${ring?.w}px, shadow ${ring?.s})`);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
      const back = await p.evaluate(() => { const e = document.activeElement; return e?.matches('button.find-nav, button.find-btn') ? 'the Find button' : e ? e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') : 'nothing'; });
      fail(back === 'the Find button', `A1: closing Find from its button put focus on ${back}`);
      // Opened with Ctrl K from a link on the page: Escape gives focus back to that link.
      const link = p.locator('main a[href]:visible').first();
      await link.focus();
      const before = await link.getAttribute('href');
      await p.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
      await p.locator('.find-input').waitFor({ timeout: 5000 }).catch(() => {});
      await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
      const after = await p.evaluate(() => document.activeElement?.getAttribute('href') ?? document.activeElement?.tagName.toLowerCase());
      fail(after === before, `A1: closing Find opened with the key put focus on ${after}, not the link that had it (${before})`);
      await c.close();
    }
    return fails;
  },
};
