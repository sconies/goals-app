/* F4: fit and finish, goal-history (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   The goal page ([Goal]), the History layout ([Hist]) and the check-in step's chart ([Check-in 3]). */

/** Chart measurements: y ticks, x labels, target label and key, in page coordinates. */
async function chartFacts(p) {
  return p.evaluate(() => {
    const svg = document.querySelector('svg.chart');
    if (!svg) return null;
    const box = (e) => e.getBoundingClientRect();
    const s = box(svg);
    const grid = [...svg.querySelectorAll('.c-grid')];
    const plotL = grid.length ? box(grid[0]).left : s.left;
    const axis = [...svg.querySelectorAll('text.c-axis')];
    const yt = axis.filter((t) => t.getAttribute('text-anchor') === 'end' && /^-?[\d.]+$/.test(t.textContent)).map((t) => ({ v: Number(t.textContent), r: box(t).right }));
    const xt = axis.filter((t) => !/^-?[\d.]+$/.test(t.textContent)).map((t) => { const b = box(t); return { t: t.textContent, l: b.left, r: b.right, top: b.top }; }).sort((a, b) => a.l - b.l);
    const tl = svg.querySelector('.c-target-t'), tline = svg.querySelector('.c-target');
    const key = (svg.closest('.chart-box') || svg.parentElement).querySelector('.chart-key');
    const kcs = key && getComputedStyle(key);
    return {
      svg: { l: s.left, r: s.right, b: s.bottom }, plotL, yt, xt,
      target: tl && { b: box(tl).bottom, t: box(tl).top, l: box(tl).left, r: box(tl).right, line: box(tline).top, paint: getComputedStyle(tl).paintOrder },
      key: key && { l: box(key).left + parseFloat(kcs.paddingLeft), border: kcs.borderTopWidth, bg: kcs.backgroundColor, h: box(key).height, words: key.innerText.replace(/\s+/g, ' ').trim() },
    };
  });
}
/** Round ticks: evenly spaced, 1, 2 or 5 × 10ⁿ apart. */
const roundTicks = (vs) => {
  if (vs.length < 2) return false;
  const st = Math.abs(vs[1] - vs[0]);
  const m = st / 10 ** Math.floor(Math.log10(st) + 1e-9);
  return vs.every((v, i) => !i || Math.abs(Math.abs(v - vs[i - 1]) - st) < 1e-6) && [1, 2, 5].some((k) => Math.abs(m - k) < 1e-6);
};
function checkChart(c, at, fails, { ticks }) {
  if (!c) { fails.push(`${at}: no chart`); return; }
  const vals = c.yt.map((t) => t.v);
  if (!roundTicks(vals)) fails.push(`${at}: y ticks not round: ${vals.join('/')}`);
  if (ticks && (vals.length < ticks[0] || vals.length > ticks[1])) fails.push(`${at}: ${vals.length} y ticks`);
  if (c.yt.some((t) => Math.abs(c.plotL - 8 - t.r) > 2)) fails.push(`${at}: y labels not 8px from the plot`);
  for (let i = 1; i < c.xt.length; i++) if (c.xt[i].l < c.xt[i - 1].r + 11) fails.push(`${at}: x labels “${c.xt[i - 1].t}” and “${c.xt[i].t}” ${Math.round(c.xt[i].l - c.xt[i - 1].r)}px apart`);
  if (c.xt.some((x) => x.r > c.svg.r + 1 || x.l < c.svg.l - 1)) fails.push(`${at}: an x label runs out of the chart`);
  if (c.target) {
    if (c.target.b > c.target.line + 1) fails.push(`${at}: target label not above its line`);
    if (c.xt.some((x) => !(x.r < c.target.l || x.l > c.target.r) && x.top < c.target.b)) fails.push(`${at}: target label overlaps a week label`);
    if (!/stroke/.test(c.target.paint)) fails.push(`${at}: target label has no halo`);
  }
  if (!c.key) fails.push(`${at}: no key`);
  else {
    if (Math.abs(c.key.l - c.plotL) > 2) fails.push(`${at}: key starts ${Math.round(c.key.l - c.plotL)}px from the plot`);
    if (c.key.border !== '0px' || !/rgba\(0, 0, 0, 0\)|transparent/.test(c.key.bg)) fails.push(`${at}: key is boxed`);
  }
}

module.exports = {
  id: 'F4',
  area: 'goal-history',
  async run({ open }) {
    const fails = [];
    let c, p;

    // ---------- the goal page ----------
    // [Goal 2, 15, 17, 21, 22, 26, 29, 30; 6, 8, 10] Maya's north star on a laptop. Rebuilt as the flagship page (5 Nov):
    // the threats block is the pinned first row of What feeds it, the status line is the summary bar's second line, the
    // contributing counts are the bar's "Fed by" line, and the comments tab is the one Activity stream.
    [c, p] = await open(1280, 800, 'maya', '/goals/head');
    await p.locator('svg.chart').waitFor();
    const head = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const rows = [...document.querySelectorAll('.goal-page .tree .trow')].filter((t) => t.getClientRects().length);
      const narrowTitle = rows.filter((t) => r(t.querySelector('.trow-title')).width < r(t).width * 0.6 - 1).length;
      const clamped = [...document.querySelectorAll('.goal-page .trow-why')].filter((w) => w.scrollHeight > w.clientHeight + 1).length;
      const why = [...document.querySelectorAll('.pinned-why')].map((w) => { const cs = getComputedStyle(w); return r(w).height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); });
      const sa = document.querySelector('#activity .show-all');
      return {
        narrowTitle, clamped, why,
        mix: document.querySelectorAll('.goal-page .mix').length, counts: document.querySelectorAll('.bar-feeds .feeds-count').length,
        countShapes: [...document.querySelectorAll('.bar-feeds .feeds-count')].every((x) => x.querySelector('.status-shape')),
        statusAlign: getComputedStyle(document.querySelector('.goal-bar .bar-2')).alignItems,
        showAll: sa ? Math.round(r(sa).width) : null,
        // The projection's words under the chart are an explanation, in the muted colour, not an alert.
        fc: (() => { const f = document.querySelector('.goal-chart .chart-say'); return f ? getComputedStyle(f).color : null; })(),
        crumbs: document.querySelectorAll('.crumbs').length,
        back: document.querySelector('.goal-page > .backlink')?.innerText.trim() ?? '',
      };
    });
    if (head.narrowTitle) fails.push(`head 1280: ${head.narrowTitle} goal rows give the title under 60%`);
    if (head.clamped) fails.push(`head 1280: ${head.clamped} reasons clamped`);
    if (!head.why.length || head.why.some((h) => h > 22)) fails.push(`head 1280: the pinned goal's “most likely to make it miss” line is ${head.why.length ? Math.round(Math.max(...head.why)) + 'px tall' : 'missing'}`);
    if (head.mix || head.counts < 3 || !head.countShapes) fails.push(`head: the goals feeding it shown as a colour bar (${head.mix}) not counts with shapes (${head.counts})`);
    if (head.statusAlign !== 'baseline') fails.push('the bar’s status line is not on one baseline');
    if (!(head.showAll > 0 && head.showAll < 260)) fails.push(`Activity’s “Show all” is ${head.showAll}px wide`);
    if (head.fc !== 'rgb(71, 84, 103)') fails.push(`projection words in ${head.fc}`);
    if (head.crumbs || !/^Back to /.test(head.back)) fails.push(`head: a breadcrumb (${head.crumbs}) or no named Back link (“${head.back}”)`);
    checkChart(await chartFacts(p), 'head 1280 chart', fails, { ticks: [4, 6] });
    const changes = await p.locator('#activity .stream > li').count();
    if (changes > 8 || !(await p.locator('#activity').getByRole('button', { name: /^Show all \d+$/ }).count())) fails.push(`Activity shows ${changes} entries without a Show all`);
    await c.close();

    // [Goal 2, 4, 7, 31] The same on a phone.
    [c, p] = await open(390, 844, 'maya', '/goals/head', true);
    await p.locator('svg.chart').waitFor();
    const ph = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const rows = [...document.querySelectorAll('#feeds .trow')];
      const stacked = rows.length > 0 && rows.every((t) => r(t.querySelector('.trow-title')).width > r(t).width * 0.8);
      return { stacked, sideways: document.documentElement.scrollWidth - innerWidth };
    });
    await p.locator('#activity .ci-week').first().scrollIntoViewIfNeeded();
    const weeks = await p.evaluate(() => [...document.querySelectorAll('#activity .ci-week')].map((e) => Math.round(e.getBoundingClientRect().height)));
    if (!ph.stacked) fails.push('head 390: rows in What feeds it not stacked (title not full width)');
    if (weeks.some((h) => h > 24)) fails.push(`head 390: “Week n” wraps (${Math.max(...weeks)}px)`);
    if (ph.sideways > 0) fails.push(`head 390: ${ph.sideways}px sideways`);
    checkChart(await chartFacts(p), 'head 390 chart', fails, { ticks: [3, 4] });
    await c.close();

    // [Goal 1, 19, 20, 23] Elena on a goal with milestones, on a small phone: what's asked of her sits right under the bar.
    [c, p] = await open(360, 740, 'elena', '/goals/access', true);
    await p.locator('.stagelist').waitFor();
    const acc = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const card = document.querySelector('.stagelist');
      const w = [...document.querySelectorAll('.asked-item button')].map((b) => [b.textContent, Math.round(r(b).height)]);
      const asked = document.querySelector('.asked'), bar = document.querySelector('.goal-bar');
      const item = document.querySelector('.asked-item > section');
      return { sideways: document.documentElement.scrollWidth - innerWidth, out: [...card.querySelectorAll('.chip')].filter((x) => r(x).right > r(card).right + 1).length, dots: card.querySelectorAll('.dot').length, w,
        gap: asked && bar ? Math.round(r(asked).top - r(bar).bottom) : null, bg: item ? getComputedStyle(item).backgroundColor : null };
    });
    if (acc.sideways > 0) fails.push(`access 360: ${acc.sideways}px sideways`);
    if (acc.out) fails.push(`access 360: ${acc.out} stage tags run out of the card`);
    if (acc.dots) fails.push('access: colour-only dots beside the stages');
    if (!acc.w.length || acc.w.some(([, h]) => h < 44)) fails.push(`access 360: Asked of you buttons ${acc.w.map((x) => x.join(' ')).join(', ') || 'missing'}px`);
    if (acc.gap == null || acc.gap > 40) fails.push(`access 360: Asked of you ${acc.gap}px under the bar`);
    if (acc.bg !== 'rgb(255, 255, 255)') fails.push(`access: the request card is filled ${acc.bg}`);
    await c.close();

    // [Goal 13, 18, 24] Every goal gets the same columns; quarter cards are white; this quarter is outlined.
    [c, p] = await open(1440, 900, 'elena', '/goals/env');
    const envA = await p.evaluate(() => Math.round(document.querySelector('.goal-main').getBoundingClientRect().width));
    await p.goto(p.url().replace('/goals/env', '/goals/head')); await p.waitForTimeout(400);
    const headA = await p.evaluate(() => Math.round(document.querySelector('.goal-main').getBoundingClientRect().width));
    if (envA !== headA) fails.push(`main column ${envA}px on env, ${headA}px on head`);
    const q = await p.evaluate(() => [...document.querySelectorAll('.quarters li')].map((li) => ({ bg: getComputedStyle(li).backgroundColor, now: li.classList.contains('q-now'), bc: getComputedStyle(li).borderTopColor, dash: /—/.test(li.innerText) })));
    if (q.some((x) => x.bg !== 'rgb(255, 255, 255)')) fails.push('a quarter card is tinted');
    if (!q.some((x) => x.now && x.bc === 'rgb(52, 81, 209)')) fails.push('this quarter has no accent border');
    if (q.some((x) => x.dash)) fails.push('a quarter card uses “—” as its result');
    await c.close();

    // [Goal 9] A forecast that leaves the plot is not keyed as a stub.
    [c, p] = await open(1280, 800, 'sam', '/goals/review');
    await p.locator('svg.chart').waitFor();
    const rv = await p.evaluate(() => { const l = document.querySelector('.c-fc'); const b = l?.getBoundingClientRect(); return { drawn: !!l, len: b ? Math.hypot(b.width, b.height) : 0, keyed: /Projection/.test(document.querySelector('.chart-key')?.innerText || '') }; });
    if (rv.keyed !== rv.drawn || (rv.drawn && rv.len < 16)) fails.push(`review: projection drawn ${Math.round(rv.len)}px, keyed ${rv.keyed}`);
    checkChart(await chartFacts(p), 'review 1280 chart', fails, { ticks: [3, 6] });
    // [Goal 22] The breadcrumb went with the flagship page (5 Nov): the Back link above the bar is the one way back,
    // checked on the north star above.
    await c.close();

    // [Check-in 3] The chart on the number step: round ticks, target above its line, labels inside, a one-line key.
    for (const [w, h, touch] of [[390, 844, true], [1280, 800, false]]) {
      [c, p] = await open(w, h, 'kofi', '/check-in/alerts', touch);
      await p.getByLabel('This week’s value').fill('50');
      await p.getByRole('button', { name: 'Show chart' }).click();
      await p.locator('svg.chart').waitFor();
      const ch = await chartFacts(p);
      checkChart(ch, `check-in ${w} chart`, fails, { ticks: [3, 6] });
      if (ch?.key && (!/Plan.*Actual.*Projection/.test(ch.key.words) || ch.key.h > 20)) fails.push(`check-in ${w}: key “${ch.key.words}” ${Math.round(ch.key.h)}px`);
      await c.close();
    }

    // ---------- History ----------
    // [Hist 5, 6, 7, 8, 9] Quarter results on a laptop.
    [c, p] = await open(1280, 800, 'elena', '/goals?view=history');
    await p.locator('.qtable').first().waitFor();
    const qr = await p.evaluate(() => ({
      noShape: [...document.querySelectorAll('.qcell .q-result')].filter((x) => !x.querySelector('svg')).length,
      missedBg: [...new Set([...document.querySelectorAll('.qcell.q-missed')].map((x) => getComputedStyle(x).backgroundColor))],
      threeLines: [...document.querySelectorAll('.qcell-text')].filter((x) => x.getBoundingClientRect().height > 37).length,
      qlegend: document.querySelector('.qlegend')?.innerText.replace(/\s+/g, ' ') || '',
      footerKeys: [...document.querySelectorAll('details.legend .legend-key')].filter((x) => x.getClientRects().length).length,
    }));
    if (qr.noShape) fails.push(`${qr.noShape} quarter results without a shape`);
    if (qr.missedBg.some((b) => b !== 'rgba(0, 0, 0, 0)')) fails.push(`missed quarters tinted ${qr.missedBg}`);
    if (qr.threeLines) fails.push(`${qr.threeLines} quarter texts over two lines at 1280`);
    if (!/Met.*Missed.*In progress.*Nothing due/.test(qr.qlegend)) fails.push(`quarter key reads “${qr.qlegend}”`);
    if (qr.footerKeys) fails.push('History repeats the status key in the footer');
    await c.close();

    // [Hist 1, 20] Quarter results at 768: nothing clipped, phone cards.
    [c, p] = await open(768, 1024, 'elena', '/goals?view=history', true);
    await p.locator('.qtable').first().waitFor();
    const q768 = await p.evaluate(() => ({
      clipped: [...document.querySelectorAll('.table-wrap')].filter((t) => t.scrollWidth > t.clientWidth + 1).length,
      now: (() => { const l = [...document.querySelectorAll('.qcell.q-now .qcell-label')][0]; return l ? [l.innerText, getComputedStyle(l).color] : null; })(),
      gap: getComputedStyle(document.querySelector('.qtable tbody tr')).rowGap,
    }));
    if (q768.clipped) fails.push(`768 quarter results: ${q768.clipped} tables clipped`);
    if (!q768.now || !/now/.test(q768.now[0]) || q768.now[1] !== 'rgb(42, 68, 184)') fails.push(`768 quarter cards: this quarter labelled ${q768.now}`);
    if (q768.gap !== '8px') fails.push(`768 quarter cards: ${q768.gap} gap`);
    await c.close();

    // [Hist 3, 4, 9, 10, 13, 14, 17, 18, 24] Weekly, this quarter, on a laptop.
    [c, p] = await open(1440, 700, 'elena', '/goals?view=history&hist=weekly');
    await p.locator('.hgrid').first().waitFor();
    const wk = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const t = document.querySelector('.hgrid');
      const sel = document.querySelector('.hcell.sel');
      const ring = sel && getComputedStyle(sel, '::before');
      const hint = document.querySelector('.history-hint'), ctl = document.querySelector('.history-controls');
      const names = [...t.querySelectorAll('tbody .hg-goal a')];
      return {
        tableW: Math.round(r(t).width), rowH: Math.round(r(t.querySelector('tbody td.hcell')).height),
        ring: ring ? [ring.width, ring.height, ring.borderTopWidth, ring.borderRadius] : null,
        nowBg: getComputedStyle(t.querySelector('thead th.now')).backgroundColor,
        hint: hint ? [hint.innerText, Math.round(r(hint).left - r(ctl).left), Math.round(r(hint).top - r(ctl).bottom)] : null,
        untitled: names.filter((a) => !a.title).length, ellipsis: names.filter((a) => getComputedStyle(a).textOverflow === 'ellipsis').length,
        indent: (() => { const ch = t.querySelector('tbody .hg-goal.child'); return ch ? parseFloat(getComputedStyle(ch).paddingLeft) : null; })(),
        edge: getComputedStyle(t.querySelector('tbody .hg-goal')).boxShadow,
      };
    });
    if (wk.tableW > 1040) fails.push(`1440 weekly grid is ${wk.tableW}px wide`);
    if (wk.rowH !== 40) fails.push(`1440 weekly rows ${wk.rowH}px`);
    if (!wk.ring || wk.ring[0] !== '28px' || wk.ring[1] !== '28px' || wk.ring[2] !== '2px' || wk.ring[3] !== '6px') fails.push(`selection ring ${wk.ring}`);
    if (wk.nowBg !== 'rgb(238, 241, 253)') fails.push(`this week’s header ${wk.nowBg}`);
    if (!wk.hint || !/Each mark/.test(wk.hint[0]) || /square/.test(wk.hint[0]) || Math.abs(wk.hint[1]) > 1 || wk.hint[2] !== 8) fails.push(`weekly hint ${JSON.stringify(wk.hint)}`);
    if (wk.untitled || wk.ellipsis) fails.push(`goal names: ${wk.untitled} without a title, ${wk.ellipsis} cut with an ellipsis`);
    if (wk.indent !== 28) fails.push(`weekly child goals indented ${wk.indent}px`);
    if (!/1px 0px 0px/.test(wk.edge)) fails.push('sticky goal column has no edge');
    // Another goal and week: the inspector keeps its height.
    const h0 = await p.locator('.week-inspector').evaluate((e) => e.getBoundingClientRect().height);
    await p.locator('.hgrid').first().locator('tbody tr').nth(2).locator('td.hcell').nth(1).click();
    const h1 = await p.locator('.week-inspector').evaluate((e) => e.getBoundingClientRect().height);
    if (Math.round(h0) !== 64 || Math.round(h1) !== 64) fails.push(`inspector ${Math.round(h0)} then ${Math.round(h1)}px`);
    const nowBg2 = await p.evaluate(() => getComputedStyle(document.querySelector('.hgrid thead th.now')).backgroundColor);
    if (nowBg2 !== 'rgb(238, 241, 253)') fails.push(`this week loses its mark when another is selected (${nowBg2})`);
    // The header stays in view as the goals scroll under it.
    await p.evaluate(() => { const t = document.querySelector('.hgrid'); window.scrollBy(0, t.getBoundingClientRect().top + 200); });
    await p.waitForTimeout(150);
    const stuck = await p.evaluate(() => { const t = document.querySelector('.hgrid'); return { th: Math.round(t.querySelector('thead th').getBoundingClientRect().top), t: Math.round(t.getBoundingClientRect().top) }; });
    if (!(stuck.t < 0 && stuck.th >= -1 && stuck.th <= 4)) fails.push(`weekly header scrolled away ${JSON.stringify(stuck)}`);
    await c.close();

    // [Hist 15, 16] The whole year fits at 1280, with week numbers.
    [c, p] = await open(1280, 800, 'elena', '/goals?view=history&hist=weekly&weeks=year');
    await p.locator('.hgrid-year').first().waitFor();
    const yr = await p.evaluate(() => {
      const w = document.querySelector('.hwrap');
      const now = document.querySelector('.hgrid-year thead th.now .hn');
      return { over: w.scrollWidth - w.clientWidth, nums: [...document.querySelectorAll('.hgrid-year thead .hn')].filter((x) => x.textContent).length, now: now ? [now.textContent, getComputedStyle(now).color] : null, qpad: getComputedStyle(document.querySelector('.hgrid-year .hq')).paddingLeft };
    });
    if (yr.over > 1) fails.push(`1280 whole year scrolls ${yr.over}px`);
    if (yr.nums < 8 || !yr.now || yr.now[0] !== '44' || yr.now[1] !== 'rgb(42, 68, 184)') fails.push(`whole-year header: ${yr.nums} week numbers, this week ${yr.now}`);
    if (yr.qpad !== '8px') fails.push(`quarter labels padded ${yr.qpad}`);
    await c.close();

    // [Hist 2, 3, 16, 21, 22] Touch: 44px squares, two-line names, a key hint only for keyboards, an edge cue.
    [c, p] = await open(390, 844, 'elena', '/goals?view=history&hist=weekly', true);
    await p.locator('.hgrid').first().waitFor();
    const tc = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const cell = r(document.querySelector('.hgrid tbody td.hcell'));
      const names = [...document.querySelectorAll('.hgrid tbody .hg-goal')];
      const lg = [...document.querySelectorAll('.hlegend .hcell-key')].map((k) => Math.round(r(k).top));
      const insp = document.querySelector('.week-inspector');
      return {
        cell: [Math.round(cell.width), Math.round(cell.height)], goalW: Math.round(r(names[0]).width),
        tall: names.filter((n) => r(n.querySelector('a')).height > 37).length,
        legendRows: new Set(lg).size,
        keyHint: [...document.querySelectorAll('.key-hint')].filter((k) => k.getClientRects().length).length,
        inspector: Math.round(r(insp).height),
        cue: getComputedStyle(document.querySelector('.hwrap')).maskImage,
        sideways: document.documentElement.scrollWidth - innerWidth,
      };
    });
    if (tc.cell[0] < 44 || tc.cell[1] < 44) fails.push(`390 touch: squares ${tc.cell.join('×')}`);
    if (Math.abs(tc.goalW - 160) > 2) fails.push(`390: goal column ${tc.goalW}px`);
    if (tc.tall) fails.push(`390: ${tc.tall} goal names over two lines`);
    if (tc.legendRows > 2) fails.push(`390: weekly key on ${tc.legendRows} lines`);
    if (tc.keyHint) fails.push('390 touch: the arrow-key hint shows');
    if (tc.inspector > 96) fails.push(`390 touch: inspector ${tc.inspector}px`);
    if (!/gradient/.test(tc.cue)) fails.push('390: the grid scrolls sideways with no cue');
    if (tc.sideways > 0) fails.push(`390 weekly: ${tc.sideways}px sideways`);
    await p.goto(p.url().replace(/weeks=[^&]*&?/, '') + '&weeks=year'); await p.waitForTimeout(400);
    const yc = await p.evaluate(() => { const td = document.querySelector('.hgrid-year tbody td.hcell'); const s = td.querySelector('svg'); return [Math.round(td.getBoundingClientRect().width), s ? Math.round(s.getBoundingClientRect().width) : 12]; });
    if (yc[0] < 24 || yc[1] < 12) fails.push(`390 touch whole year: ${yc[0]}px columns, ${yc[1]}px marks`);
    await c.close();
    // The smallest phone: the range buttons fit, nothing sideways.
    [c, p] = await open(360, 740, 'elena', '/goals?view=history&hist=weekly&weeks=year', true);
    await p.locator('.hgrid').first().waitFor();
    const s360 = await p.evaluate(() => { const g = document.querySelector('[aria-label="Weeks shown"]').getBoundingClientRect(); return [document.documentElement.scrollWidth - innerWidth, Math.round(g.right - innerWidth)]; });
    if (s360[0] > 0 || s360[1] > -16) fails.push(`360 whole year: ${s360[0]}px sideways, range buttons end ${s360[1]}px from the edge`);
    await c.close();

    return fails;
  },
};
