/* N6: Lane's review notes (5 Nov), print-motion. run({ open, url, browser }) returns a list of failures.
   [Print] a goal and a review session each print as A4 portrait pages with everything critical, no navigation, black
   on white, status as shape plus word. [Motion] everything moves for 250ms at most and not at all under reduced
   motion; counts land on their value; rows slide to their new places and end there. */

const A4_CONTENT = 695; // 210mm less 13mm margins each side, at 96dpi
const LIMIT = 250;
// The goal page's story (chart drawing in, the headline number counting and landing, quarters filling, a status turning)
// is off by default since backlog T (8 Nov), so every page here is held to 250ms. Switched on in the Motion lab it is
// slower on purpose (up to 4 seconds at the default pace), checked by N9.
// The launch splash (src/ui/Splash.tsx, backlog I) is the one other exception: about 2.5 s, once per launch, over the app
// as it loads. Automated browsers never see it unless they ask, so it can't count here; N4 [LAUNCH] checks it.

/** Samples every animation and every counter on the page, every frame from the first paint. */
const SAMPLER = () => {
  window.__pm = { anims: new Map(), counts: [], maxRunning: 0, shift: 0, faint: 1 };
  const name = (a) => {
    const t = a.effect && a.effect.target;
    const cls = t ? (typeof t.className === 'string' ? t.className : t.className && t.className.baseVal) || '' : '';
    return (a.animationName || a.transitionProperty || a.id || 'anim') + ' on ' + (t ? t.tagName.toLowerCase() + '.' + String(cls).split(' ')[0] : '?');
  };
  const tick = () => {
    const list = document.getAnimations ? document.getAnimations() : [];
    window.__pm.maxRunning = Math.max(window.__pm.maxRunning, list.length);
    for (const a of list) {
      const t = a.effect.getTiming();
      const target = a.effect.target;
      if (target && target.closest && target.closest('.skeleton, .boot, .preboot')) continue;
      const total = (t.iterations === Infinity ? Infinity : (Number(t.duration) || 0) * (t.iterations || 1)) + (t.delay || 0);
      window.__pm.anims.set(a, { name: name(a), total });
    }
    // How visible the page's heading is, all the way up (a fade on any parent counts): readable from the first frame.
    let o = 1, e = document.querySelector('main.work h1');
    if (e) { for (; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); window.__pm.faint = Math.min(window.__pm.faint, o); }
    const c = document.querySelector('.goal-bar .countup-now, .statusline .countup-now');
    if (c) { const v = c.textContent; if (window.__pm.counts[window.__pm.counts.length - 1] !== v) window.__pm.counts.push(v); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__pm.shift += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* no layout-shift API */ }
};
/** Sets who's looking before the app starts, so a page loads once (not Home first, then the page). */
const asViewer = (v) => { if (!sessionStorage.getItem('viewer-set')) { localStorage.setItem('goals-app-viewer:platform-org', v); sessionStorage.setItem('viewer-set', '1'); } };

/**
 * Waits for the page to be up and its entrance motion to end, instead of reading at a fixed time. Home's progress ring
 * was read 700ms after the address opened: on a machine four times slower (EVALS_CPU=4) Home wasn't drawn by then, so
 * the ring hadn't filled and its count was part-way (found in PR #38). Endless animations (a spinner) don't count.
 */
async function settled(p) {
  await p.waitForFunction(() => {
    if (document.querySelector('.preboot, .boot')) return false;
    const main = document.querySelector('main');
    return !!main && [...main.children].some((e) => !e.matches('.page-help, [data-page-wait]'));
  }, null, { timeout: 20000 }).catch(() => {});
  await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  // A count drawn frame by frame (not an animation) lands within a few frames of the motion ending.
  await p.waitForTimeout(150);
}

/** EVALS_CPU=4 runs these pages four times slower (Chrome's CPU throttling), to prove the checks don't depend on speed. */
async function slower(c, p) {
  const rate = Number(process.env.EVALS_CPU || 1);
  if (rate > 1) await (await c.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate });
}

const sampled = (p) => p.evaluate(() => ({ anims: [...window.__pm.anims.values()], counts: window.__pm.counts, maxRunning: window.__pm.maxRunning, shift: window.__pm.shift, faint: window.__pm.faint }));

/** Each row's goal, in order: the first link in it. */
const keysOf = (p, rows) => p.$$eval(rows, (rs) => rs.map((r) => r.querySelector('a[href]')?.getAttribute('href')));

/**
 * The row slides an action starts. Re-rendering a list of over a hundred goals can take longer than any fixed pause
 * (more so with the shards running side by side), so the slides aren't read at a set time after the click: a mutation
 * observer, made after the app's FLIP watcher and so called straight after it in the same turn, notes every slide the
 * moment the rows change. Then it waits up to 5 seconds for the order of the `rows` to change and returns the
 * slides' total times in ms, or null when the order never changed.
 */
async function slidesOf(p, act, rows) {
  const before = await keysOf(p, rows);
  await p.evaluate(() => {
    window.__flips = new Map();
    const note = () => document.getAnimations().forEach((a) => {
      if (a.id === 'flip' && !window.__flips.has(a)) { const t = a.effect.getTiming(); window.__flips.set(a, Number(t.duration) + (t.delay || 0)); }
    });
    new MutationObserver(note).observe(document.getElementById('main'), { childList: true, subtree: true });
  });
  await act();
  const changed = await p.waitForFunction(([sel, was]) => JSON.stringify([...document.querySelectorAll(sel)].map((r) => r.querySelector('a[href]')?.getAttribute('href'))) !== was, [rows, JSON.stringify(before)], { timeout: 5000 }).then(() => true, () => false);
  return changed ? p.evaluate(() => [...window.__flips.values()]) : null;
}

module.exports = {
  id: 'N6',
  area: 'print-motion',
  title: 'Review notes, print-motion',
  reqs: ['PRINT-EXPORT', 'MOTION-ALIVE'],
  async run({ open, url, browser }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };
    /** A page with the sampler running from the start; `reduced` asks for reduced motion. */
    const at = async (w, h, who, route, opts = {}) => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', colorScheme: opts.scheme || 'light' });
      await c.addInitScript(asViewer, who);
      await c.addInitScript(SAMPLER);
      const p = await c.newPage();
      await slower(c, p);
      await p.goto(url(route));
      await settled(p);
      return [c, p];
    };

    // ---------- [Print] a goal's page: every section, at phone, tablet and desktop ----------
    for (const [w, h] of [[390, 844], [768, 1024], [1280, 800]]) {
      const [c, p] = await open(w, h, 'amara', '/goals/ns-lead/print');
      await p.locator('.print-sheet').waitFor();
      const m = await p.evaluate(() => {
        const sheet = document.querySelector('.print-sheet');
        const text = sheet.innerText;
        const chip = sheet.querySelector('.ps-status .chip');
        return {
          title: document.querySelector('.print-sheet h1')?.textContent,
          chip: chip ? !!chip.querySelector('svg.status-shape') && /at risk|off track|on track|no recent update|done/i.test(chip.textContent) : false,
          now: document.querySelector('.ps-now')?.textContent,
          sections: ['Where it stands', 'Path to green', 'What it needs', 'Latest check-in', 'Decisions or help needed', 'From reviews', 'This year by quarter', 'Contributing goals', 'Target', 'Plan'].filter((s) => !text.includes(s)),
          chart: !!sheet.querySelector('svg.chart .c-act'),
          said: /Runner budget/.test(text),
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          primaries: [...document.querySelectorAll('.btn.primary')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()),
        };
      });
      fail(m.title === 'Lead time for changes', `[Print] ${w}: goal page title is “${m.title}”`);
      fail(m.chip, `[Print] ${w}: the goal's status is not a shape and a word`);
      fail(m.now === '37 hours', `[Print] ${w}: the number is “${m.now}”`);
      fail(!m.sections.length, `[Print] ${w}: goal page lacks ${m.sections.join(', ')}`);
      fail(m.chart, `[Print] ${w}: no chart with the actual line`);
      fail(m.said, `[Print] ${w}: the note from last week's review is missing`);
      fail(m.sideways <= 1, `[Print] ${w}: ${m.sideways}px sideways scroll`);
      fail(m.primaries.length === 1 && m.primaries[0] === 'Print or save as PDF', `[Print] ${w}: primary actions ${m.primaries.join(' | ')}`);
      await c.close();
    }

    // ---------- [Print] print media at A4 width, in light and dark: no nav, nothing wider than the page, black on white ----------
    // (The page-count rule for a review, one to three pages, is checked on the quarterly review: the leadership weekly walks 56 goals.)
    for (const [route, scheme] of [['/goals/ns-lead/print', 'dark'], ['/reviews/qbr/print', 'light'], ['/goals/lead-mq/print', 'light']]) {
      const c = await browser.newContext({ viewport: { width: A4_CONTENT, height: 1000 }, colorScheme: scheme });
      await c.addInitScript(asViewer, 'amara');
      const p = await c.newPage();
      await p.goto(url(route));
      await p.locator('.print-sheet').waitFor();
      await p.emulateMedia({ media: 'print', colorScheme: scheme });
      await p.waitForTimeout(300);
      const m = await p.evaluate((W) => {
        const shown = (s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
        const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1; }).map((e) => e.tagName.toLowerCase() + '.' + String(e.className.baseVal ?? e.className).split(' ')[0]);
        const shapes = [...document.querySelectorAll('.print-sheet svg.status-shape')].filter((s) => s.getBoundingClientRect().width >= 8);
        return {
          nav: ['.side', '.tabbar', '.mtop', '.print-bar', '.toasts'].filter(shown),
          wide: [...new Set(wide)].slice(0, 4),
          body: getComputedStyle(document.body).backgroundColor,
          title: getComputedStyle(document.querySelector('.ps-title')).color,
          chipColour: getComputedStyle(document.querySelector('.print-sheet .chip')).color,
          shapes: shapes.length,
          words: shapes.every((s) => /on track|at risk|off track|no recent update|done|not started|no check-in|met|missed|now|to come|late|on schedule/i.test(s.parentElement.textContent + " " + s.parentElement.parentElement.textContent)),
        };
      }, A4_CONTENT);
      fail(!m.nav.length, `[Print] ${route}: ${m.nav.join(', ')} still printed`);
      fail(!m.wide.length, `[Print] ${route}: wider than A4: ${m.wide.join(', ')}`);
      fail(m.body === 'rgb(255, 255, 255)' && m.title === 'rgb(0, 0, 0)' && m.chipColour === 'rgb(0, 0, 0)', `[Print] ${route} (${scheme}): not black on white (page ${m.body}, title ${m.title}, status ${m.chipColour})`);
      fail(m.shapes > 0 && m.words, `[Print] ${route}: ${m.shapes} status shapes in print, all with words ${m.words}`);
      if (route === '/goals/lead-mq/print') fail(/Feeds Lead time for changes|Feeds /.test(await p.locator('.ps-head').innerText()), '[Print] a contributing goal does not say what it feeds');
      const pdf = await p.pdf({ format: 'A4', preferCSSPageSize: true });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      fail(route.startsWith('/goals?scope=all') ? pages === 1 : pages >= 1 && pages <= 3, `[Print] ${route}: prints on ${pages} A4 pages`);
      await c.close();
    }

    // ---------- [Print] a review's session: every goal, worst first, what was said ----------
    for (const [w, h] of [[390, 844], [1024, 768]]) {
      const [c, p] = await open(w, h, 'amara', '/reviews/weekly/print');
      await p.locator('.print-sheet').waitFor();
      const m = await p.evaluate(() => {
        // (Goals that are on track or done have the same weight, so they sit in one rank: the order among them isn't worst first.)
        const rank = { off: 3, risk: 2, stale: 2, on: 1, done: 1, planned: 1 };
        // A goal being handled (here, the vulnerability north star: an action agreed for it) comes after the ones that need
        // attention, so it is left out of the worst-first run and must come after it.
        const HANDLED = ['Critical and high vulnerabilities fixed within SLA'];
        const all = [...document.querySelectorAll('.ps-goal')];
        const kind = (b) => ['off', 'risk', 'stale', 'on', 'done', 'planned'].find((k) => b.querySelector('.ps-goal-head .chip.' + k));
        const blocks = all.filter((b) => !HANDLED.includes(b.getAttribute('aria-label'))).map(kind);
        const rows = document.querySelectorAll('.ps-rows li').length;
        return {
          title: document.querySelector('.print-sheet h1')?.textContent,
          first: blocks[0], count: all.length + rows,
          worstFirst: blocks.every((k, i) => !i || rank[k] <= rank[blocks[i - 1]] || k === 'stale' || blocks[i - 1] === 'stale'),
          head: (document.querySelector('.ps-goal[aria-label="Lead time for changes"]')?.innerText || ''),
          meta: document.querySelector('.ps-meta')?.textContent || '',
        };
      });
      fail(m.title === 'Platform leadership weekly', `[Print] review ${w}: title “${m.title}”`);
      fail(m.first === 'off' && m.worstFirst, `[Print] review ${w}: goals not worst first (first ${m.first})`);
      const total = Number((m.meta.match(/of (\d+) goals/) || [])[1]);
      fail(total > 0 && m.count === total, `[Print] review ${w}: ${m.count} goals on the page, ${total} in the session`);
      fail(/Said last time/.test(m.head) && /Runner budget/.test(m.head) && /Path to green/.test(m.head), '[Print] review: a goal block lacks its path to green or what was said');
      await c.close();
    }

    // ---------- [Print] the entry points: small, secondary, and they lead to the page ----------
    for (const [route, to] of [['/goals/ns-lead', '/goals/ns-lead/print'], ['/reviews/weekly', '/reviews/weekly/print']]) {
      const [c, p] = await open(1280, 800, 'amara', route);
      // On a goal it's in the summary bar's "…" menu since the flagship page (5 Nov): still small and secondary.
      if (route.startsWith('/goals/')) { await p.locator('.goal-bar summary[aria-label="More about this goal"]').click(); await p.waitForTimeout(150); }
      const link = p.getByRole('link', { name: 'Print or save as PDF' });
      fail(await link.count() === 1 && !(await link.evaluate((e) => e.classList.contains('primary'))), `[Print] ${route}: no secondary “Print or save as PDF”`);
      if (await link.count() === 1) { await link.click(); await p.waitForTimeout(300); fail(p.url().includes(to), `[Print] ${route}: the link went to ${p.url()}`); }
      await c.close();
    }

    // (The goal whose number counts is Pull requests with AI-assisted review: 72% to 73% this week. Lead time for changes was 37 hours both weeks, so it has nothing to count.)
    // ---------- [Motion] durations: animations happen, each 250ms at most, at phone and desktop ----------
    for (const [w, h, who, route] of [[390, 844, 'rhea', '/'], [1440, 900, 'amara', '/goals/ns-ai'], [1440, 900, 'amara', '/reviews/weekly'], [768, 1024, 'amara', '/goals?scope=all&view=board']]) {
      const [c, p] = await at(w, h, who, route);
      const s = await sampled(p);
      const long = s.anims.filter((a) => a.total > LIMIT);
      fail(s.anims.length > 0, `[Motion] ${route} at ${w}: nothing moves`);
      fail(!long.length, `[Motion] ${route} at ${w}: longer than ${LIMIT}ms: ${[...new Set(long.map((a) => a.name + ' ' + a.total + 'ms'))].slice(0, 3).join(', ')}`);
      fail(s.shift < 0.02, `[Motion] ${route} at ${w}: layout shifted by ${s.shift.toFixed(3)} after load`);
      // Readable at once (backlog T, 8 Nov): the heading is never faded, however slowly the browser draws frames.
      fail(s.faint >= 0.99, `[Motion] ${route} at ${w}: the page's heading was faded to ${s.faint.toFixed(2)} while it opened`);
      if (route === '/') fail(s.anims.some((a) => /ring-fill/.test(a.name)), '[Motion] Home: the progress ring does not fill');
      if (route === '/goals/ns-ai') {
        fail(s.anims.some((a) => /c-act/.test(a.name)), '[Motion] the goal chart does not draw its line');
        fail(s.counts.length >= 2 && s.counts[s.counts.length - 1] === '73%', `[Motion] the goal's number did not count to 73% (${s.counts.join(' → ')})`);
        // From last week's number, never through values the goal didn't have this year's way up (demo review, 8 Nov, item 16).
        fail(s.counts.every((v) => v === '72%' || v === '73%'), `[Motion] the goal's number passed through other values (${s.counts.join(' → ')})`);
      }
      // The ring's count is what its label says at every moment, not only once it lands (demo review, 8 Nov, item 16).
      if (route === '/' || route === '/reviews/weekly') {
        const early = await p.evaluate(() => { const r = document.querySelector('.ring'); return r ? { text: r.querySelector('.ring-text').textContent, label: r.getAttribute('aria-label') } : null; });
        if (early && /^\d+\/\d+$/.test(early.text)) fail(early.label.startsWith(early.text.replace('/', ' of ')), `[Motion] ${route}: ring shows ${early.text} while it means “${early.label}”`);
      }
      // The ring's count lands on what its label says.
      const ring = await p.evaluate(() => { const r = document.querySelector('.ring'); return r ? { text: r.querySelector('.ring-text').textContent, label: r.getAttribute('aria-label') } : null; });
      if (ring && /^\d+\/\d+$/.test(ring.text)) fail(ring.label.startsWith(ring.text.replace('/', ' of ')), `[Motion] ${route}: ring says ${ring.text} but means “${ring.label}”`);
      await c.close();
    }

    // ---------- [Motion] reduced motion: nothing moves, numbers show their value at once ----------
    for (const [w, h, who, route] of [[390, 844, 'rhea', '/'], [1280, 800, 'amara', '/goals/ns-ai']]) {
      const [c, p] = await at(w, h, who, route, { reduced: true });
      const s = await sampled(p);
      fail(s.maxRunning === 0, `[Motion] reduced, ${route}: ${s.maxRunning} animations ran (${[...new Set(s.anims.map((a) => a.name))].slice(0, 3).join(', ')})`);
      if (route === '/goals/ns-ai') fail(s.counts.length === 1 && s.counts[0] === '73%', `[Motion] reduced: the number counted (${s.counts.join(' → ')})`);
      await c.close();
    }

    // ---------- [Motion] FLIP: sorting the table slides rows, which end where they belong; none under reduced motion ----------
    for (const [w, h, reduced] of [[1280, 800, false], [1024, 768, false], [1280, 800, true]]) {
      const [c, p] = await at(w, h, 'amara', '/goals?scope=all&view=table', { reduced });
      await p.locator('.gtable tbody tr').first().waitFor();
      const order = () => p.$$eval('.gtable', (ts) => [...ts[0].querySelectorAll('tbody > tr:not(.story-row) .gt-name a')].map((a) => a.textContent));
      const before = await order();
      const mid = await slidesOf(p, () => p.locator('.gtable').first().getByRole('button', { name: 'Goal', exact: true }).click(), '.gtable tbody > tr:not(.story-row)');
      if (!mid) fail(false, `[Motion] ${w}${reduced ? ' reduced' : ''}: sorting the table by Goal did not change the order`);
      else if (reduced) fail(!mid.length, `[Motion] reduced: ${mid.length} rows slid when sorted`);
      else {
        fail(mid.length > 0, `[Motion] ${w}: sorting the table moved no rows`);
        fail(mid.every((d) => d <= LIMIT), `[Motion] ${w}: a row slides for ${Math.max(...mid)}ms`);
      }
      await p.waitForTimeout(400);
      const end = await p.evaluate(() => {
        const rows = [...document.querySelector('.gtable').querySelectorAll('tbody > tr')];
        const tops = rows.map((r) => r.getBoundingClientRect().top);
        return { running: document.getAnimations().filter((a) => a.id === 'flip').length, moved: rows.filter((r) => getComputedStyle(r).transform !== 'none').length, inOrder: tops.every((t, i) => !i || t >= tops[i - 1] - 0.5) };
      });
      const after = await order();
      const sorted = [...after].sort((a, b) => a.localeCompare(b));
      fail(JSON.stringify(after) === JSON.stringify(sorted) && JSON.stringify(after) !== JSON.stringify(before), `[Motion] ${w}: rows not sorted by name after the sort`);
      fail(!end.running && !end.moved && end.inOrder, `[Motion] ${w}${reduced ? ' reduced' : ''}: rows did not settle (${end.running} still sliding, ${end.moved} offset, in order ${end.inOrder})`);
      await c.close();
    }

    // ---------- [Motion] FLIP on a phone list: from By level to By team, the goals slide to their new places and stay there ----------
    {
      const [c, p] = await at(390, 844, 'amara', '/goals?show=levels');
      await p.locator('.tree > li').first().waitFor();
      // On a phone, Group is in the View sheet (GL2); the sheet closes with Done before the rows are watched.
      await p.locator('.goals-phone-switch .view-open').click();
      const sheet = p.getByRole('dialog', { name: 'View' });
      const mid = await slidesOf(p, async () => { await sheet.getByRole('radio', { name: /^By team/ }).click(); await sheet.getByRole('button', { name: 'Done' }).click(); }, 'main .tree > li');
      fail(!!mid, '[Motion] 390: By team lists the goals in the same order as By level, so nothing has to move');
      if (mid) {
        fail(mid.length > 0, '[Motion] 390: switching the list from By level to By team moved no rows');
        fail(mid.every((d) => d <= LIMIT), `[Motion] 390: a goal slides for ${Math.max(...mid)}ms`);
      }
      await p.waitForTimeout(400);
      const end = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('main .tree > li')];
        return { moved: rows.filter((r) => getComputedStyle(r).transform !== 'none' || Number(getComputedStyle(r).opacity) < 1).length, running: document.getAnimations().filter((a) => a.id === 'flip').length, n: rows.length };
      });
      fail(end.n > 0 && !end.moved && !end.running, `[Motion] 390: ${end.moved} of ${end.n} rows left offset or faded after the move`);
      await c.close();
    }
    return fails;
  },
};
