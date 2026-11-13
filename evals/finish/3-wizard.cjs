/* F3: fit and finish, wizard (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   New goal (GoalWizard), Edit goal (GoalEdit) and the plan table. Numbers in brackets are the report's findings. */
const near = (a, b, d = 1.5) => Math.abs(a - b) <= d;
const box = (loc) => loc.first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
const css = (loc, prop) => loc.first().evaluate((e, p) => getComputedStyle(e)[p], prop);
const col = (p) => box(p.locator('.focus-body'));
const name = async (p, t = 'Runbooks with an owner') => p.getByLabel(/Name it the way/).fill(t);
// Mateo leads SRE, which owns north stars, so New goal asks his level (OB1, rule 1).
const team = (p) => p.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Team' }).click();
const cont = async (p) => { await p.getByRole('button', { name: /Continue/ }).click(); await p.waitForTimeout(150); };
// New goal's order (OB1): what, who and where, how it's measured, check. The plan table is folded under the chart.
const toNumbers = async (p, table = true) => {
  await name(p); await cont(p); await team(p); await cont(p);
  await p.getByLabel('Unit').fill('%');
  await p.getByLabel(/^Baseline$/).fill('20');
  await p.getByLabel(/^Target$/).fill('90');
  await p.waitForTimeout(250);
  if (table) { await p.getByText('Adjust the plan week by week').click(); await p.waitForTimeout(100); }
};
// Each read-back row is as wide as its list: full-width rows, never laid out in columns (build review of #202, finding 1).
const readBackFull = async (p, w, fail) => {
  const list = await box(p.getByRole('list', { name: 'Read back' }));
  const rows = await p.getByRole('list', { name: 'Read back' }).locator(':scope > li').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width));
  if (rows.length < 3 || rows.some((rw) => !near(rw, list.w - 2, 1.5))) fail(`(GE3) at ${w} the read-back's rows are ${rows.map(Math.round).join('/')}px wide in a ${Math.round(list.w)}px list`);
};
const noSideScroll = async (p, where, fail) => {
  const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  if (sw > iw) fail(`${where}: scrolls sideways (${sw} > ${iw})`);
};

module.exports = {
  id: 'F3',
  area: 'wizard',
  async run({ open }) {
    const fails = [];
    const f = (m) => fails.push(m);

    // Step 2 at 1280: header (9), chart (2), number grid (22), single due date (8), plan table (15, 16), legend (6), figures (11).
    {
      const [c, p] = await open(1280, 900, 'mateo', '/goals/new');
      const k = p.locator('.kindcard');
      const [sel, other] = [await box(k.nth(0)), await box(k.nth(1))];
      if (!near(sel.h, other.h, 0.5) || (await css(k.nth(0), 'paddingTop')) !== (await css(k.nth(1), 'paddingTop'))) f(`(7) the chosen type card is a different size (${sel.h} vs ${other.h})`);
      if (!/inset/.test(await css(k.nth(0), 'boxShadow'))) f('(7) the chosen type card has no 2px ring');
      const lg = await box(p.locator('fieldset > legend')); const cl = await col(p);
      if (!near(lg.x, cl.x, 0.5)) f(`(6) the legend starts at ${lg.x}, not the column's ${cl.x}`);
      if ((await p.evaluate(() => getComputedStyle(document.body).fontVariantNumeric)) !== 'normal') f('(11) the body still has tabular figures');
      await toNumbers(p);
      // (9) progress bar
      const bar = await box(p.locator('.steps-bar')); const close = await box(p.locator('.focus-top .form-close')); const c1 = await col(p);
      if (!near(bar.x, c1.x)) f(`(9) the step bar starts at ${bar.x}, not the column's ${c1.x}`);
      if (!near(close.x - bar.r, 16, 2)) f(`(9) the step bar ends ${close.x - bar.r}px from Close, not 16`);
      const segs = await p.locator('.steps-bar i').evaluateAll((es) => es.map((e) => [e.getBoundingClientRect().width, getComputedStyle(e).backgroundColor]));
      if (Math.max(...segs.map((s) => s[0])) - Math.min(...segs.map((s) => s[0])) > 1) f('(9) the step bar segments are uneven');
      if (segs[0][1] !== segs[1][1]) f('(9) done and current steps are different colours');
      if (segs[3][1] !== 'rgb(210, 206, 196)') f(`(9) steps to come are ${segs[3][1]}`);
      // (22) the unit lines up with today (decimals are worked out and said in a line: goal entry 2.4)
      const [u, t] = [await box(p.getByLabel(/^Unit/)), await box(p.getByLabel(/^Baseline$/))];
      if (!near(u.x, t.x)) f(`(22) Unit (${u.x}) doesn't line up with Today (${t.x})`);
      if (await p.getByLabel('Decimals', { exact: true }).count()) f('(22) Decimals is still a field to fill in');
      // (8) the due week is a picked week said in words, with what it is (GE9's week picker)
      const due = p.getByRole('button', { name: /^To Week \d+ · / });
      if (!(await due.count()) || !/^The end of \d{4}$/.test(((await p.locator('.weekpick', { has: due }).locator('.weekpick-is').textContent()) || '').trim())) f('(8) To does not start as the year’s end, said in words');
      // (5) segments 36px in a 44px track
      const seg = await box(p.locator('.seg').first()); const sb = await box(p.locator('.seg button').first());
      if (!near(seg.h, 44, 0.5) || !near(sb.h, 36, 0.5)) f(`(5) segmented track ${seg.h}px, segment ${sb.h}px`);
      // (2) chart from now to the target week, a tick per week
      const ticks = await p.locator('.chart .c-axis[y]').evaluateAll((es) => es.filter((e) => e.getAttribute('text-anchor') !== 'end').map((e) => [Number(e.getAttribute('x')), e.textContent]));
      const xt = ticks.filter((t2) => /^(Now|Wk)/.test(t2[1]));
      if (xt[0]?.[1] !== 'Now' || xt[xt.length - 1]?.[1] !== 'Wk 53') f(`(2) the x-axis runs ${xt[0]?.[1]}–${xt[xt.length - 1]?.[1]}, not Now–Wk 53`);
      if (xt.length < 9) f(`(2) only ${xt.length} week ticks at 1280`);
      const gaps = xt.slice(1).map((t2, i) => t2[0] - xt[i][0]);
      if (Math.min(...gaps) < 44) f(`(2) week ticks ${Math.min(...gaps).toFixed(0)}px apart at 1280`);
      const plan = await p.locator('.chart .c-plan').getAttribute('points');
      const pts = plan.split(' ').map((s) => s.split(',').map(Number));
      if (pts[0][1] === pts[1][1]) f('(2) the plan line starts flat');
      if (!(await p.locator('.chart .c-target').count()) || !(await p.locator('.chart .c-today').count())) f('(2) the target line or the Now marker is gone');
      // (15) real numbers in the text colour, not placeholders
      const pi = p.getByLabel(/^Plan for week \d+/).first();
      if (!(await pi.inputValue()) || (await pi.getAttribute('placeholder')) || (await css(pi, 'color')) !== 'rgb(24, 54, 56)') f('(15) plan numbers are placeholders, not real values');
      await pi.fill('30'); await p.waitForTimeout(100);
      if (!(await p.getByText('· set by you').count())) f('(15) a hand-set week is not marked "set by you"');
      const endRow = p.locator('.plantable tbody tr').last();
      if (!/^Target /.test(((await endRow.locator('td.num').textContent()) || '').trim())) f('(16) the last row\'s plan cell does not say Target');
      // (20) the footer's rule at the column's width
      const foot = await box(p.locator('.focus-foot')); const c2 = await col(p);
      if (!near(foot.x, c2.x) || !near(foot.w, c2.w)) f(`(20) the footer is ${foot.w}px wide from ${foot.x}, the column ${c2.w}px from ${c2.x}`);
      // (31) a hover on the segments not chosen
      const off = p.locator('.seg button[aria-pressed="false"]').first();
      const before = await css(off, 'backgroundColor'); await off.hover(); await p.waitForTimeout(250);
      if ((await css(off, 'backgroundColor')) === before) f('(31) an unchosen segment does not change on hover');
      await c.close();
    }

    // Step 2 at 390 and 360: chart every other week, number grid, plan table on one line, no sideways scroll.
    for (const w of [390, 360]) {
      const [c, p] = await open(w, 800, 'mateo', '/goals/new');
      await toNumbers(p);
      const xt = await p.locator('.chart .c-axis').evaluateAll((es) => es.map((e) => [Number(e.getAttribute('x')), e.textContent]).filter((t) => /^(Now|Wk)/.test(t[1])));
      if (xt[0]?.[1] !== 'Now' || xt[xt.length - 1]?.[1] !== 'Wk 53' || xt.length < 4) f(`(2) at ${w} the x-axis is ${xt.map((t) => t[1]).join(', ')}`);
      const gaps = xt.slice(1).map((t, i) => t[0] - xt[i][0]);
      if (Math.min(...gaps) < 36) f(`(2) at ${w} week labels are ${Math.min(...gaps).toFixed(0)}px apart`);
      const [u, t] = [await box(p.getByLabel(/^Unit/)), await box(p.getByLabel(/^Baseline$/))];
      const g = await box(p.getByLabel(/^Target$/));
      if (!near(u.x, t.x) || !near(t.x, g.x)) f(`(22) at ${w} Unit, Baseline and Target aren't one column`);
      // Each date on one line: its text has one line box.
      const lines = await p.locator('.plantable td.pt-date, .plantable .pt-week, .plantable tbody tr:last-child td.num').evaluateAll((es) => Math.max(...es.map((e) => {
        const r = document.createRange(); r.selectNodeContents(e);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      })));
      if (lines > 1) f(`(16) at ${w} a week or date wraps`);
      const rowsH = await p.locator('.plantable tbody tr:has(.plan-input)').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      if (Math.max(...rowsH) - Math.min(...rowsH) > 1) f(`(16) at ${w} plan rows differ in height (${Math.min(...rowsH)}–${Math.max(...rowsH)})`);
      const tbl = await box(p.locator('.plantable table'));
      if (tbl.r > (await col(p)).r + 0.5) f(`(16) at ${w} the plan table runs past the column`);
      await noSideScroll(p, `step 2 at ${w}`, f);
      await c.close();
    }

    // Touch at 390 (3): plan inputs 44 in 52px rows; the review's Change rows 44px; disclosures 44px.
    {
      const [c, p] = await open(390, 844, 'mateo', '/goals/new', true);
      await toNumbers(p);
      const pi = await box(p.getByLabel(/^Plan for week \d+/));
      const row = await box(p.locator('.plantable tbody tr').nth(1));
      if (pi.h < 44 || row.h < 52) f(`(3) on touch plan inputs are ${pi.h}px in ${row.h}px rows`);
      const sum = await box(p.locator('.disclose > summary'));
      if (sum.h < 44) f(`(3) the plan table's disclosure is ${sum.h}px tall`);
      // Who and where, one step back (the browser's Back).
      await p.goBack(); await p.waitForTimeout(200);
      // (21) Owner and Team stacked 24px apart
      const [ownerField, teamField] = [await box(p.locator('.fit-pair > .stack').nth(0)), await box(p.locator('.fit-pair > .stack').nth(1))];
      if (teamField.y > ownerField.y + 1 && teamField.y - ownerField.b < 23.5) f(`(21) stacked Owner and Team are ${teamField.y - ownerField.b}px apart`);
      // (27) the guardrail box on the column's edge, level with the first line
      const cb = await box(p.locator('.check input')); const lab = await box(p.locator('.check span')); const c1 = await col(p);
      if (!near(cb.x, c1.x, 0.5)) f(`(27) the guardrail box is at ${cb.x}, the column at ${c1.x}`);
      if (!near(lab.x - cb.r, 12, 1)) f(`(27) the guardrail box is ${lab.x - cb.r}px from its words`);
      if (Math.abs((cb.y + cb.h / 2) - (lab.y + 11)) > 2) f('(27) the guardrail box is not level with the first line');
      await cont(p); await cont(p);
      const rr = await p.locator('.review-rows li').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      const ch = await p.locator('.review-rows .linkish').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      if (rr.length < 4 || Math.min(...rr) < 44 || Math.min(...ch) < 44) f(`(3, 23) the read-back's rows are ${rr.join('/')}px, Change ${ch.join('/')}px`);
      await readBackFull(p, 390, f);
      // (23) the plan is read back with its weeks' dates (GE9, GE3): "A number to move: from 20% in week 45 (2–8 Nov 2026) to 90% by week 53 (…)".
      if (!/by week \d+ \(\d/.test((await p.locator('.review-rows li[data-row="what"]').textContent()) || '')) f('(23) Check doesn’t say the due week with its dates');
      await c.close();
    }

    // The read-back at 1440: one row under another, each the list's width (build review of #202, finding 1).
    {
      const [c, p] = await open(1440, 900, 'mateo', '/goals/new');
      await toNumbers(p, false); await cont(p);
      await readBackFull(p, 1440, f);
      await c.close();
    }

    // Limits (5) at 1280 and 390.
    for (const w of [1280, 390]) {
      const [c, p] = await open(w, 900, 'mateo', '/goals/new');
      await name(p); await p.getByRole('button', { name: /Keep a number in range/ }).click(); await cont(p); await team(p); await cont(p);
      const [seg, lim, warn] = [await box(p.locator('.limits .seg')), await box(p.getByLabel('Limit')), await box(p.getByLabel('Warn this close'))];
      if (w > 600 && (!near(seg.b, lim.b) || !near(lim.b, warn.b))) f(`(5) at ${w} limit row bottoms ${seg.b}/${lim.b}/${warn.b}`);
      if (w > 600 && !near(seg.h, 44, 0.5)) f(`(5) at ${w} the Must stay track is ${seg.h}px`);
      if (w <= 600) {
        const c1 = await col(p);
        if (!near(seg.w, c1.w)) f(`(5) at ${w} Must stay is ${seg.w}px, not full width`);
        if (!near(lim.y, warn.y) || !(lim.r < warn.x)) f(`(5) at ${w} Limit and Warn are not side by side`);
      }
      await c.close();
    }

    // A range between two numbers (#300 review): Between asks a lower and an upper limit and refuses them the wrong way
    // round; the read-back says both; published, the chart's two labels on a narrow band (1.6% to 1.8%) stay apart.
    for (const w of [1280, 390]) {
      const [c, p] = await open(w, 900, 'mateo', '/goals/new');
      await name(p, 'Share of builds retried'); await p.getByRole('button', { name: /Keep a number in range/ }).click(); await cont(p); await team(p); await cont(p);
      await p.locator('.limits .seg').getByRole('button', { name: 'Between' }).click();
      if (!(await p.getByLabel('Lower limit').count()) || !(await p.getByLabel('Upper limit').count())) { f(`(#300) at ${w} Between doesn’t ask a lower and an upper limit`); await c.close(); continue; }
      await p.getByLabel(/^Unit/).fill('%');
      await p.getByLabel('Lower limit').fill('1.8'); await p.getByLabel('Upper limit').fill('1.6');
      await cont(p);
      if (!(await p.getByRole('alert').filter({ hasText: 'must be below the upper one' }).count())) f(`(#300) at ${w} a lower limit above the upper one isn’t refused under its field`);
      await p.getByLabel('Lower limit').fill('1.6'); await p.getByLabel('Upper limit').fill('1.8');
      await cont(p);
      const what = (await p.locator('.review-rows li[data-row="what"]').textContent().catch(() => '')) || '';
      if (!/between 1\.6\s?% and 1\.8\s?%/i.test(what)) f(`(#300) at ${w} the read-back says “${what.trim()}”, not both limits`);
      if (w > 600) {
        await p.getByRole('button', { name: 'Publish goal' }).click();
        await p.waitForURL(/\/goals\/[^/?]+\?published=1/, { timeout: 10000 }).catch(() => {});
        const labels = p.locator('.goal-chart .c-target-t');
        await labels.first().waitFor({ timeout: 5000 }).catch(() => {});
        const ls = await labels.evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent || '', y: r.top, b: r.bottom }; }));
        const up = ls.find((l) => /^Upper/.test(l.t)), lo = ls.find((l) => /^Lower/.test(l.t));
        if (!up || !lo) f(`(#300) the published goal’s chart doesn’t label both limits (${ls.map((l) => l.t).join(' / ') || 'no labels'})`);
        else if (up.b > lo.y) f(`(#300) on a narrow band the chart’s labels overlap: Upper ends at ${Math.round(up.b)}, Lower starts at ${Math.round(lo.y)}`);
      }
      await c.close();
    }

    // Stages (12, 13, 14) at 1280 and 390.
    for (const w of [1280, 390]) {
      const [c, p] = await open(w, 900, 'mateo', '/goals/new');
      await name(p); await p.getByRole('button', { name: /Hit dated stages/ }).click(); await cont(p); await team(p); await cont(p); await cont(p);
      const err = p.locator('.stage .field-error');
      if (!(await err.count())) f(`(13) at ${w} the stage error is not under Stage 1`);
      else {
        const [e, i] = [await box(err), await box(p.getByLabel('Stage 1', { exact: true }))];
        const rowB = (await box(p.locator('.stage-row').first())).b;
        if (!(e.y - rowB >= 2 && e.y - rowB <= 6) || e.y < i.b) f(`(13) at ${w} the stage error is ${e.y - rowB}px under its row`);
        if ((await css(p.getByLabel('Stage 1', { exact: true }), 'borderTopColor')) !== 'rgb(180, 35, 24)') f(`(13) at ${w} the empty stage has no red border`);
        if ((await css(err, 'fontSize')) !== '14px' || (await css(err, 'lineHeight')) !== '20px') f('(14) errors are not 14/20');
      }
      await p.getByLabel('Stage 1', { exact: true }).fill('Threat model');
      await p.getByRole('button', { name: 'Add a stage' }).click();
      if ((await p.locator('.stage-head').count()) !== 1) f('(12) the Stage / Due labels repeat');
      const rows = await p.locator('.stage').evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }));
      if (w > 600 && !near(rows[1][0] - rows[0][1], 12, 1)) f(`(12) stage rows are ${rows[1][0] - rows[0][1]}px apart`);
      const [rm, inp] = [await box(p.getByRole('button', { name: 'Remove stage 1' })), await box(p.getByLabel('Stage 1', { exact: true }))];
      if (rm.w < 44 || rm.h < 44) f(`(12) Remove is ${rm.w}×${rm.h}`);
      if (w > 600 && !near(rm.y + rm.h / 2, inp.y + inp.h / 2, 1)) f('(12) Remove is not centred on its row');
      if (w <= 600 && !near(inp.w, (await col(p)).w)) f(`(12) at ${w} the stage name is ${inp.w}px, not full width`);
      await c.close();
    }

    // Picking up a draft (24, now OB1's line) at 360: one line above the heading, and "Start a new one" is 44px.
    {
      const [c, p] = await open(360, 780, 'mateo', '/goals/new', true);
      await name(p, 'Half-written');
      await p.goto(p.url().replace(/\/goals\/new\/what/, '/goals?scope=all')); await p.goto(p.url().replace('/goals?', '/goals/new?')); await p.waitForTimeout(300);
      const [line, h1] = [await box(p.locator('.restored')), await box(p.locator('h1'))];
      if (!(line.b <= h1.y)) f('(24) the pick-up line is not above the heading');
      const sn = await box(p.getByRole('button', { name: 'Start a new one' }));
      if (sn.h < 44) f(`(24) “Start a new one” is ${sn.h}px tall`);
      await c.close();
    }

    // Change a goal at 1280: heading (18), level (17), reason under the numbers (19), focus never under the footer (1).
    {
      const [c, p] = await open(1280, 900, 'tariq', '/goals/ns-ai/edit');
      const h1 = p.locator('h1');
      if (((await h1.textContent()) || '') !== 'Change Pull requests with AI-assisted review' || (await css(h1, 'fontSize')) !== '22px') f('(18) Change a goal has no 22px h1 with the goal name');
      const lv = p.locator('.seg[aria-labelledby="level-l"] button[aria-pressed]');
      if ((await lv.count()) !== 3 || (await p.locator('.optlist').count())) f('(17) Level is not the wizard\'s segmented control');
      await p.getByLabel(/^Target/).fill('85'); await p.waitForTimeout(150);
      // The numbers end with the line saying their weeks (GE9); the reason comes straight after.
      const [pair, reason] = [await box(p.locator('.goal-edit .span-says').first()), await box(p.locator('.reason-field'))];
      if (!near(reason.y - pair.b, 16, 1)) f(`(19) "Why change it?" is ${reason.y - pair.b}px under the numbers`);
      const help = p.locator('.reason-field > .hint'); const ta = await box(p.getByLabel('Why change it?'));
      if (!near((await box(help)).y - ta.b, 4, 1)) f('(19) the reason helper is not 4px under the box');
      await p.locator('summary', { hasText: 'Plan by week' }).click();
      const vals = await p.getByLabel(/^Plan for week \d+/).evaluateAll((es) => es.map((e) => e.value));
      if (!vals.length || vals.some((v) => !/^\d+$/.test(v))) f(`(15) Edit plan numbers are not to the goal's decimals (${vals.slice(0, 3).join(', ')})`);
      await p.locator('summary', { hasText: 'More details' }).click();
      for (const lab of ['Data source', 'What it measures']) {
        // (A label that wraps its field is named with the field's text too, so a goal with a definition reads “Definition Share of…”.)
        const el = p.getByRole('textbox', { name: new RegExp('^' + lab) });
        await p.evaluate(() => window.scrollTo(0, 0));
        await el.focus(); await p.waitForTimeout(150);
        const [e, ft] = [await box(el), await box(p.locator('.focus-foot'))];
        if (e.b > ft.y - 12) f(`(1) focused ${lab} ends at ${e.b}, the footer starts at ${ft.y}`);
      }
      await c.close();
    }

    // Wizard step 3 at 390: where the number comes from, focused, never under the footer (1).
    {
      const [c, p] = await open(390, 700, 'mateo', '/goals/new');
      await toNumbers(p);
      // How it's measured is asked in the open on the numbers step, as set-up does (re-review, 8 Nov, backlog T); with the
      // metric library on, once “No metric” is chosen under “Measured by” (metrics spec 2.4, ML2).
      const measured = p.locator('.measured-by');
      if (await measured.count()) {
        await measured.getByRole('button', { name: /^Measured by/ }).click();
        await p.locator('.pick.open').getByRole('option', { name: 'No metric' }).click();
      }
      if (!(await p.getByRole('textbox', { name: /^How it’s measured/ }).isVisible())) f('(T7) New goal: “How it’s measured” is not shown on the numbers step');
      for (const lab of ['Where the number comes from']) {
        // (A label that wraps its field is named with the field's text too, so a goal with a definition reads “Definition Share of…”.)
        const el = p.getByRole('textbox', { name: new RegExp('^' + lab) });
        await p.evaluate(() => window.scrollTo(0, 0));
        await el.focus(); await p.waitForTimeout(150);
        const [e, ft] = [await box(el), await box(p.locator('.focus-foot'))];
        if (e.b > ft.y - 12) f(`(1) at 390 focused ${lab} ends at ${e.b}, the footer starts at ${ft.y}`);
      }
      await c.close();
    }

    // Dark segmented (25).
    {
      const [c, p] = await open(1280, 900, 'mateo', '/goals/new');
      await p.emulateMedia({ colorScheme: 'dark' });
      await toNumbers(p);
      const bg = await css(p.locator('.seg button[aria-pressed="true"]'), 'backgroundColor');
      if (bg !== 'rgb(44, 68, 71)') f(`(25) the chosen segment in dark is ${bg}`);
      await c.close();
    }

    // Wide (28) and short (30) screens.
    {
      const [c, p] = await open(2560, 1300, 'mateo', '/goals/new');
      if ((await col(p)).w < 639) f(`(28) at 2560 the wizard column is ${(await col(p)).w}px`);
      await c.close();
      const [c2, p2] = await open(853, 533, 'mateo', '/goals/new');
      if ((await css(p2.locator('.focus-foot'), 'position')) !== 'static') f('(30) the footer still sticks on a short screen');
      await c2.close();
    }

    // Edit's plan table at 360 (16): "Target 2.0 days" and the dates on one line, nothing past the screen.
    {
      const [c, p] = await open(360, 780, 'tariq', '/goals/ns-ai/edit');
      await p.locator('summary', { hasText: 'Plan by week' }).click();
      const lines = await p.locator('.plantable td.pt-date, .plantable .pt-week, .plantable tbody tr:last-child td.num').evaluateAll((es) => Math.max(...es.map((e) => {
        const r = document.createRange(); r.selectNodeContents(e);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      })));
      if (lines > 1) f('(16) Edit at 360: a week, date or the target wraps');
      await noSideScroll(p, 'Edit with the plan open at 360', f);
      await c.close();
    }

    // The plan table on the goal page at 360 stays inside the screen.
    {
      const [c, p] = await open(360, 780, 'rhea', '/goals/ns-lead');
      // The plan table is in About this goal, open on a first visit (the flagship page, 5 Nov; it was the Details tab).
      const about = p.locator('details.about');
      if (await about.count() && !(await about.evaluate((d) => d.open))) { await about.locator('summary').click(); await p.waitForTimeout(200); }
      await p.getByText('Plan and actual by week').first().waitFor({ timeout: 3000 }).catch(() => f('goal page at 360: no plan table in About this goal'));
      await noSideScroll(p, 'goal page details at 360', f);
      await c.close();
    }

    // Demo review, 8 Nov, item 11: a new goal feeds nothing until you choose, and the check step says so, with the
    // team named as a team (it read "CI/CD · Rhea Kapoor" beside Where it fits).
    {
      const [c, p] = await open(1280, 900, 'rhea', '/goals/new');
      await name(p); await cont(p);
      if (!(await p.getByRole('button', { name: /^Feeds into\b.*(Choose a goal|Nothing: top of its own tree)/ }).isVisible().catch(() => false))) f('new goal: Feeds into does not start empty');
      // Rhea leads a team with SVP goals, so her level is asked, not assumed (OB1, rule 1).
      await cont(p);
      if (!(await p.getByText('Choose a level.').isVisible().catch(() => false))) f('new goal: Rhea is not asked the level');
      await p.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Team' }).click();
      await cont(p);
      await p.getByLabel('Unit').fill('%'); await p.getByLabel(/^Baseline$/).fill('20'); await p.getByLabel(/^Target$/).fill('90');
      await cont(p);
      // The read-back (GE3) says the owner, team and level in one sentence.
      const who = (await p.locator('.review-rows li[data-row="who"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (!/Rhea Kapoor owns it, in CI\/CD\. It’s a Team goal and feeds nothing: it’s at the top of its own tree\./.test(who)) f(`new goal: Who and where reads “${who}”`);
      await c.close();
    }
    return fails;
  },
};
