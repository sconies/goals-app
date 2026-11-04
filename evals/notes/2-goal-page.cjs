/* N2: Lane's review notes (5 Nov), goal-page. run({ open, url, browser }) returns a list of failures.
   The status block's four facts, the path to green in the main column, the grouped side column, the header that stays
   on screen, what the goal feeds and how it's measured, and the review walk (chart and check-ins open, each check-in
   opening to the whole check-in, no collapsed column at 1024–1200), at phone, tablet and desktop widths, light and dark. */

const FACTS = ['Against plan', 'Trend', 'Since last update', 'Projection'];
const GROUPS = ['Asked of you', 'Requests', 'What the owner says', 'Signals', 'Said in reviews'];

/** The status block, the path to green and the side column, as the page shows them. */
async function facts(p) {
  return p.evaluate(() => {
    const vis = (e) => !!e && e.getClientRects().length > 0;
    const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : '');
    const ptg = document.querySelector('.ptg');
    return {
      labels: [...document.querySelectorAll('.story .fact dt')].filter(vis).map(txt),
      values: [...document.querySelectorAll('.story .fact .fact-value')].map(txt),
      source: txt(document.querySelector('.story .fact-source')),
      ptg: vis(ptg) ? { inHead: !!ptg.closest('.goal-head'), inRail: !!ptg.closest('.goal-rail'), text: txt(ptg) } : null,
      heads: [...document.querySelectorAll('.goal-rail .rail-head')].filter(vis).map(txt),
      emptyGroups: [...document.querySelectorAll('.goal-rail .rail-group')].filter((g) => g.children.length < 2).length,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

module.exports = {
  id: 'N2',
  area: 'goal-page',
  title: 'Review notes, goal-page',
  reqs: ['GOAL-SUMMARY'],
  async run({ open }) {
    const fails = [];
    const chk = (ok, msg) => { if (!ok) fails.push(msg); };
    let c, p;

    // (a, b, c) Facts, path to green and side groups, on a number goal behind plan, at every width, light and dark.
    for (const [w, h, touch] of [[390, 844, true], [1100, 900, false], [1280, 800, false], [1440, 900, false]]) {
      for (const scheme of ['light', 'dark']) {
        [c, p] = await open(w, h, 'kofi', '/goals/alerts', touch);
        await p.emulateMedia({ colorScheme: scheme });
        await p.locator('.story .facts').waitFor();
        const f = await facts(p);
        const at = `alerts ${w} ${scheme}`;
        chk(JSON.stringify(f.labels) === JSON.stringify(FACTS), `${at}: facts labelled ${f.labels.join(' / ')}`);
        chk(/behind plan$/.test(f.values[0] || ''), `${at}: against plan reads “${f.values[0]}”`);
        chk(/^\d+% → \d+% → \d+% of plan$/.test(f.values[1] || ''), `${at}: trend reads “${f.values[1]}”`);
        chk(/^(Up|Down) /.test(f.values[2] || ''), `${at}: since last update reads “${f.values[2]}”`);
        chk(/by week \d+$/.test(f.values[3] || ''), `${at}: projection reads “${f.values[3]}”`);
        chk(/^Week \d+ check-in · Kofi Boateng · /.test(f.source), `${at}: source line “${f.source}”`);
        chk(f.ptg && f.ptg.inHead && !f.ptg.inRail && /Path to green/.test(f.ptg.text) && /Owner’s date: back on plan by/.test(f.ptg.text), `${at}: path to green not in the main column (${JSON.stringify(f.ptg)})`);
        chk(f.heads.length >= 2 && f.heads.every((x) => GROUPS.includes(x)) && !f.emptyGroups, `${at}: side groups ${f.heads.join(' / ')} (${f.emptyGroups} empty)`);
        chk(f.sideways <= 1, `${at}: ${f.sideways}px sideways`);
        // Side text sits on the page: no fill behind it in either theme (the dark bars in Lane's screenshot).
        const filled = await p.evaluate(() => [...document.querySelectorAll('.goal-rail *, .story *')]
          .filter((e) => !e.closest('.request-block, .btn, button') && /^(P|SPAN|STRONG|EM|DIV|DT|DD|H2)$/.test(e.tagName))
          .filter((e) => { const b = getComputedStyle(e).backgroundColor; return b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent'; })
          .map((e) => e.tagName.toLowerCase() + '.' + e.className).slice(0, 3));
        chk(!filled.length, `${at}: text with a fill behind it: ${filled.join(', ')}`);
        // A path to green only when behind: an on-track goal has none, and its facts still lead.
        if (scheme === 'light' && w === 1280) {
          await p.goto(p.url().replace('/goals/alerts', '/goals/lead')); await p.locator('.story .facts').waitFor();
          const on = await facts(p);
          chk(!on.ptg && on.labels.length === 4, `lead 1280: on track shows path to green ${!!on.ptg}, ${on.labels.length} facts`);
        }
        await c.close();
      }
    }

    // (a) A range and dated stages get the same four facts, in their own terms.
    [c, p] = await open(1280, 800, 'elena', '/goals/cfr');
    await p.locator('.story .facts').waitFor();
    let f = await facts(p);
    chk(f.labels[0] === 'Against the limit' && /limit$/.test(f.values[0] || '') && f.labels.length === 4, `cfr: facts ${f.labels.join(' / ')}: ${f.values[0]}`);
    await p.goto(p.url().replace('/goals/cfr', '/goals/access')); await p.locator('.story .facts').waitFor();
    f = await facts(p);
    chk(/stages? late$/.test(f.values[0] || '') && /weeks late$/.test(f.values[1] || '') && /slipped \d+ weeks?$/.test(f.values[2] || '') && /^Finishes week \d+/.test(f.values[3] || ''), `access: facts read ${f.values.join(' / ')}`);
    chk(f.heads[0] === 'Asked of you', `access as Elena: first side group “${f.heads[0]}”`);
    // (e) What it feeds, with that goal's status, as a link.
    const feeds = await p.evaluate(() => { const l = document.querySelector('.ctx-feeds'); return l ? { text: l.innerText.replace(/\s+/g, ' '), href: l.querySelector('a.ctx-parent')?.getAttribute('href'), shape: !!l.querySelector('.chip svg') } : null; });
    chk(feeds && /^Feeds into: Intake-to-delivery time · (On track|At risk|Off track|No recent update)/.test(feeds.text) && /\/goals\/head/.test(feeds.href || '') && feeds.shape, `access: feeds line ${JSON.stringify(feeds)}`);
    await c.close();

    // (e) How it's measured, and how many goals feed this one; the owner can add a missing definition, others can't.
    [c, p] = await open(390, 844, 'maya', '/goals/head', true);
    await p.locator('.goal-context').waitFor();
    const ctx = await p.evaluate(() => ({ measure: document.querySelector('.ctx-measure')?.innerText.replace(/\s+/g, ' ') || '', feeding: document.querySelector('.ctx-feeding')?.innerText || '' }));
    chk(/^How it’s measured: .+\(source: .+\)$/.test(ctx.measure), `head: measure line “${ctx.measure}”`);
    chk(/^\d+ goals feed this one$/.test(ctx.feeding), `head: feeding line “${ctx.feeding}”`);
    await c.close();
    for (const [who, want] of [['kofi', true], ['maya', false]]) {
      [c, p] = await open(1280, 800, who, '/goals/alerts');
      await p.locator('.story').waitFor();
      const link = await p.locator('.ctx-measure a').count();
      chk(!!link === want, `alerts as ${who}: ${link ? 'an' : 'no'} edit link for the missing definition`);
      await c.close();
    }

    // (d) The header stays on screen: hidden at the top; once the title scrolls away, title, status, number and actions,
    // under the phone's top bar or the review bar.
    for (const [w, h, touch, who, route] of [[390, 844, true, 'elena', '/goals/head'], [1280, 800, false, 'elena', '/goals/cfr'], [1440, 900, false, 'maya', '/goals/head'], [1100, 800, false, 'elena', '/goals/access?review=weekly']]) {
      [c, p] = await open(w, h, who, route, touch);
      await p.locator('.story').waitFor();
      const before = await p.locator('.goal-sticky-bar').count();
      await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(300);
      const s = await p.evaluate(() => {
        const bar = document.querySelector('.goal-sticky-bar');
        if (!bar) return null;
        const above = [...document.querySelectorAll('.mtop, .goal-page > .reviewbar')].filter((e) => e.getClientRects().length && /sticky|fixed/.test(getComputedStyle(e).position));
        const r = bar.getBoundingClientRect();
        return { top: Math.round(r.top), under: Math.round(Math.max(0, ...above.map((e) => e.getBoundingClientRect().bottom))), title: bar.querySelector('.goal-sticky-title')?.innerText, chip: !!bar.querySelector('.chip svg'), number: bar.querySelector('.goal-sticky-number')?.innerText, actions: [...bar.querySelectorAll('.btn')].map((b) => b.innerText.trim()), bg: getComputedStyle(bar).backgroundColor };
      });
      const at = `${route} ${w}`;
      chk(before === 0, `${at}: sticky header shown before scrolling`);
      chk(s && Math.abs(s.top - s.under) <= 1, `${at}: sticky header at ${s?.top}, under ${s?.under}`);
      chk(s && s.title && s.chip && s.number && !/rgba\(0, 0, 0, 0\)/.test(s.bg), `${at}: sticky header ${JSON.stringify(s)}`);
      if (!/review=/.test(route)) chk(s && s.actions.some((a) => /Edit|Watch/.test(a)), `${at}: sticky header actions ${s?.actions}`);
      await c.close();
    }

    // (f) The review walk: the chart and recent check-ins open, full width when the columns stack (1024–1200), and
    // each check-in opens to the whole check-in.
    for (const [w, h, touch] of [[390, 844, true], [1024, 768, false], [1100, 900, false], [1200, 900, false], [1280, 800, false]]) {
      [c, p] = await open(w, h, 'elena', '/goals/access?review=weekly', touch);
      await p.locator('.decide').waitFor();
      const m = await p.evaluate(() => {
        const ev = document.querySelector('.review-evidence'), split = document.querySelector('.goal-page .split');
        const stacked = getComputedStyle(split).display !== 'grid';
        return {
          shown: !!ev && ev.getClientRects().length > 0 && !ev.closest('details:not([open])'),
          w: ev ? Math.round(ev.getBoundingClientRect().width) : 0, splitW: Math.round(split.getBoundingClientRect().width), stacked,
          stages: !!ev?.querySelector('.stagelist, svg.chart'), rows: ev ? ev.querySelectorAll('.ci-row').length : 0,
        };
      });
      const at = `review ${w}`;
      chk(m.shown && m.stages && m.rows >= 2, `${at}: chart and check-ins not open (${JSON.stringify(m)})`);
      chk(m.w >= (m.stacked ? m.splitW - 2 : 380), `${at}: evidence column ${m.w}px of ${m.splitW}px`);
      await p.locator('.review-evidence .ci-row').first().click();
      const full = await p.locator('.review-evidence .ci-full').first().innerText().catch(() => '');
      chk(/Call/.test(full) && /Why/.test(full) && /Path to green/.test(full) && /Checked in/.test(full), `${at}: an opened check-in shows “${full.replace(/\s+/g, ' ').slice(0, 80)}”`);
      await c.close();
    }
    // The same on the goal page's Check-ins tab, a number goal, dark.
    [c, p] = await open(1440, 900, 'elena', '/goals/alerts');
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.locator('.cilist .ci-row').first().click();
    const row = await p.evaluate(() => { const b = document.querySelector('.cilist .ci-row'); const d = document.querySelector('.cilist .ci-full'); return { exp: b?.getAttribute('aria-expanded'), text: d?.innerText.replace(/\s+/g, ' ') || '' }; });
    chk(row.exp === 'true' && /Cause/.test(row.text) && /Path to green/.test(row.text) && /Checked in Kofi Boateng/.test(row.text), `alerts tab: opened check-in ${JSON.stringify(row)}`);
    await c.close();

    return fails;
  },
};
