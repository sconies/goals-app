/* N5: Lane's review notes (5 Nov), data-ids. run({ open, url, browser }) returns a list of failures.
   TABLE-LAYOUTS: in the data tables, columns move (drag a heading; Columns' up and down on touch) and change width (drag
   a heading's edge; arrow keys), the layout is remembered and saves as a named view that reopens, and the table exports
   (CSV, .xlsx) exactly as shown. READABLE-IDS: every goal has a key G-n, unique, shown on the goal, in the Goals table
   and the data tables; /goals/G-n opens the goal. The AI assistant's side (find_goals, get_goal and every tool taking a
   goal accept a key) is checked in evals/data-ids.eval.ts, which needs no browser. */
const fs = require('fs');

const heads = (p) => p.evaluate(() => [...document.querySelectorAll('.dtable thead th')].map((t) => t.dataset.col || t.innerText.trim()));
const thWidth = (p, col) => p.evaluate((c) => document.querySelector(`.dtable thead th[data-col="${c}"]`)?.getBoundingClientRect().width ?? 0, col);
const pageScroll = (p) => p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;

module.exports = {
  id: 'N5',
  area: 'data-ids',
  title: 'Review notes, data-ids',
  reqs: ['TABLE-LAYOUTS', 'READABLE-IDS'],
  async run({ open }) {
    const fails = [];

    /* ---------- desktop 1280: drag, resize, keyboard, remember, save, reopen, export ---------- */
    let [c, p] = await open(1280, 800, 'grace', '/data');
    let h = await heads(p);
    if (h[0] !== 'Goal' || h[1] !== 'Key') fails.push(`[TABLE-LAYOUTS] 1280 Goals table starts ${h.slice(0, 2).join(', ')} (want Goal, Key)`);
    const keys = await p.evaluate(() => { const i = [...document.querySelectorAll('.dtable thead th')].findIndex((t) => t.dataset.col === 'Key'); return [...document.querySelectorAll('.dtable tbody tr')].map((tr) => tr.children[i]?.innerText.trim()); });
    // (The table shows the first 100 of 126 goals, then “Show 100 more”.)
    if (keys.length !== 100 || new Set(keys).size !== 100 || !keys.every((k) => /^G-\d+$/.test(k))) fails.push(`[READABLE-IDS] data table keys: ${keys.join(' ')}`);

    // Drag Owner's heading onto Level: it moves there, and the drop isn't taken as a sort.
    const ob = await p.locator('.dtable thead th[data-col="Owner"] .sortbtn').boundingBox();
    const lb = await p.locator('.dtable thead th[data-col="Level"]').boundingBox();
    await p.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await p.mouse.down();
    for (let x = ob.x + ob.width / 2, k = 0; k < 12; k++) { x -= (ob.x + ob.width / 2 - (lb.x + lb.width * 0.25)) / 12; await p.mouse.move(x, ob.y + ob.height / 2); }
    await p.mouse.up(); await p.waitForTimeout(250);
    h = await heads(p);
    if (!(h.indexOf('Owner') < h.indexOf('Level') && h.indexOf('Owner') > 0)) fails.push(`[TABLE-LAYOUTS] 1280 dragging Owner onto Level: ${h.slice(0, 6).join(', ')}`);
    if (await p.locator('.dtable thead th[aria-sort]').count()) fails.push('[TABLE-LAYOUTS] 1280 dropping a dragged heading also sorted the table');

    // Drag Owner's edge 80px wider; then the keyboard on Team's edge: right 16px, Home to its least width.
    const w0 = await thWidth(p, 'Owner');
    const rb = await p.locator('.dtable thead th[data-col="Owner"] .col-resize').boundingBox();
    await p.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2); await p.mouse.down();
    await p.mouse.move(rb.x + rb.width / 2 + 40, rb.y + rb.height / 2); await p.mouse.move(rb.x + rb.width / 2 + 80, rb.y + rb.height / 2);
    await p.mouse.up(); await p.waitForTimeout(150);
    const w1 = await thWidth(p, 'Owner');
    if (!near(w1, w0 + 80, 4)) fails.push(`[TABLE-LAYOUTS] 1280 dragging Owner's edge 80px: ${Math.round(w0)}→${Math.round(w1)}px`);
    const team = p.locator('.dtable thead th[data-col="Team"] .col-resize');
    const t0 = await thWidth(p, 'Team');
    await team.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
    const t1 = await thWidth(p, 'Team');
    if (!near(t1, Math.round(t0) + 16, 2)) fails.push(`[TABLE-LAYOUTS] 1280 ArrowRight on Team's edge: ${Math.round(t0)}→${Math.round(t1)}px (want +16)`);
    await p.keyboard.press('Home'); await p.waitForTimeout(100);
    const t2 = await thWidth(p, 'Team');
    const now = await team.getAttribute('aria-valuenow');
    if (!near(t2, 72, 1) || now !== '72') fails.push(`[TABLE-LAYOUTS] 1280 Home on Team's edge: ${Math.round(t2)}px, aria-valuenow ${now} (want its least, 72)`);
    // Cells follow their heading's width.
    const cellW = await p.evaluate(() => { const i = [...document.querySelectorAll('.dtable thead th')].findIndex((t) => t.dataset.col === 'Owner'); return document.querySelector('.dtable tbody tr').children[i].getBoundingClientRect().width; });
    if (!near(cellW, w1, 1)) fails.push(`[TABLE-LAYOUTS] 1280 Owner cells are ${Math.round(cellW)}px under a ${Math.round(w1)}px heading`);

    // Remembered in this browser.
    await p.reload(); await p.waitForTimeout(500);
    const hr = await heads(p);
    if (hr.join() !== h.join() || !near(await thWidth(p, 'Owner'), w1, 1)) fails.push(`[TABLE-LAYOUTS] 1280 after a reload: ${hr.slice(0, 5).join(', ')}, Owner ${Math.round(await thWidth(p, 'Owner'))}px`);

    // Save it as a named view, go back to the usual columns, reopen the view.
    await p.locator('.data-views > summary').click();
    await p.getByRole('button', { name: 'Save this layout…' }).click(); await p.waitForTimeout(250);
    await p.getByRole('dialog').getByLabel('Name').fill('Owners first');
    await p.getByRole('dialog').getByRole('button', { name: 'Save layout' }).click(); await p.waitForTimeout(400);
    const named = (await p.locator('.data-views > summary').innerText()).trim();
    if (named !== 'Saved layout: Owners first') fails.push(`[TABLE-LAYOUTS] 1280 after saving, the Saved layouts button says "${named}"`);
    await p.locator('.data-views > summary').click();
    await p.getByRole('button', { name: 'Back to the usual columns' }).click(); await p.waitForTimeout(250);
    const usual = await heads(p);
    if (usual.indexOf('Owner') < usual.indexOf('Team') || !(await p.locator('.data-views > summary').innerText()).trim().startsWith('Saved layouts')) fails.push(`[TABLE-LAYOUTS] 1280 back to the usual columns: ${usual.slice(0, 6).join(', ')}`);
    // A fresh start in this browser: the saved view still opens, from the workspace's data rather than this browser's layout.
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('goals-data-layout:')) localStorage.removeItem(k); });
    await p.reload(); await p.waitForTimeout(500);
    await p.locator('.data-views > summary').click();
    await p.getByRole('button', { name: 'Owners first' }).click(); await p.waitForTimeout(300);
    const back = await heads(p);
    if (back.join() !== h.join() || !near(await thWidth(p, 'Owner'), w1, 1) || !near(await thWidth(p, 'Team'), 72, 1)) fails.push(`[TABLE-LAYOUTS] 1280 reopening “Owners first”: ${back.slice(0, 6).join(', ')}, Owner ${Math.round(await thWidth(p, 'Owner'))}px, Team ${Math.round(await thWidth(p, 'Team'))}px`);
    // It isn't one of the Goals screen's views.
    await p.goto(p.url().replace(/\/data.*$/, '/goals?today=2026-11-05')); await p.waitForTimeout(400);
    if (await p.locator('.views-menu:visible').count()) {
      await p.locator('.views-menu:visible > summary').click();
      if (await p.getByRole('button', { name: 'Owners first' }).count()) fails.push('[TABLE-LAYOUTS] the table view shows among the Goals screen’s views');
    }

    // Export as shown: filtered to Mateo, sorted by Key descending; CSV then .xlsx.
    await p.goto(p.url().replace(/\/goals.*$/, '/data?t=goals&f=' + encodeURIComponent('Owner~is~Mateo Fernández') + '&s=' + encodeURIComponent('Key~desc') + '&today=2026-11-05')); await p.waitForTimeout(400);
    const shown = await heads(p);
    await p.locator('.data-export > summary').click();
    let [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.getByRole('button', { name: 'CSV, as shown' }).click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
    // As shown, then the columns that say which record each row is, when the layout leaves them out (release 3: so it loads back).
    const keyCols = ['Key', 'ID'].filter((k) => !shown.includes(k));
    if (csv[0] !== [...shown, ...keyCols].join(',')) fails.push(`[TABLE-LAYOUTS] CSV header "${csv[0].slice(-60)}" isn't the table's, then its keys: "${[...shown, ...keyCols].join(',').slice(-60)}"`);
    const ki = shown.indexOf('Key');
    const csvKeys = csv.slice(1).map((l) => l.split(',')[ki]);
    if (csvKeys.join(' ') !== 'G-49 G-41') fails.push(`[TABLE-LAYOUTS] CSV rows are ${csvKeys.join(' ')} (want Mateo's goals, G-49 G-41)`);
    if (!/\.csv$/.test(dl.suggestedFilename())) fails.push(`[TABLE-LAYOUTS] CSV saved as ${dl.suggestedFilename()}`);
    await p.locator('.data-export > summary').click();
    [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.getByRole('button', { name: 'Excel (.xlsx), as shown' }).click()]);
    const size = fs.statSync(await dl.path()).size;
    if (!/\.xlsx$/.test(dl.suggestedFilename()) || size < 2000) fails.push(`[TABLE-LAYOUTS] .xlsx export: ${dl.suggestedFilename()}, ${size} bytes`);
    if (await pageScroll(p) > 0) fails.push(`[TABLE-LAYOUTS] 1280 Data scrolls sideways by ${await pageScroll(p)}px`);
    await c.close();

    /* ---------- phone 390, touch: Columns moves them; the menus stay on screen ---------- */
    [c, p] = await open(390, 844, 'rhea', '/data', true);
    if ((await heads(p))[1] !== 'Key') fails.push('[READABLE-IDS] 390 the key is not beside the goal in Data');
    await p.getByRole('button', { name: /^Columns/ }).click(); await p.waitForTimeout(300);
    const up = p.getByRole('button', { name: 'Move Owner up' });
    const ub = await up.boundingBox();
    if (!ub || ub.height < 44 || ub.width < 44) fails.push(`[TABLE-LAYOUTS] 390 Move up is ${ub ? Math.round(ub.width) + 'x' + Math.round(ub.height) : 'missing'} (want 44px to hit)`);
    await up.click(); await up.click(); await p.waitForTimeout(150);
    const sheetBox = await p.evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return { l: r.left, r: r.right }; });
    if (sheetBox.l < 0 || sheetBox.r > 390) fails.push(`[TABLE-LAYOUTS] 390 Columns sheet spans ${Math.round(sheetBox.l)}–${Math.round(sheetBox.r)}`);
    await p.getByRole('dialog').getByRole('button', { name: 'Done' }).click(); await p.waitForTimeout(200);
    const ph = await heads(p);
    if (ph.indexOf('Owner') !== 2) fails.push(`[TABLE-LAYOUTS] 390 after moving Owner up twice it's column ${ph.indexOf('Owner') + 1}: ${ph.slice(0, 5).join(', ')}`);
    for (const m of ['.data-views', '.data-export']) {
      await p.locator(m + ' > summary').click(); await p.waitForTimeout(150);
      const mb = await p.evaluate((s) => { const r = document.querySelector(s + ' .view-menu-list').getBoundingClientRect(); return { l: r.left, r: r.right }; }, m);
      if (mb.l < 0 || mb.r > 390) fails.push(`[TABLE-LAYOUTS] 390 the ${m.slice(6)} menu spans ${Math.round(mb.l)}–${Math.round(mb.r)}`);
      await p.locator(m + ' > summary').click();
    }
    const tb = await p.locator('.data-tools .data-export > summary').boundingBox();
    if (tb.height < 44) fails.push(`[TABLE-LAYOUTS] 390 Export is ${Math.round(tb.height)}px tall`);
    if (await pageScroll(p) > 0) fails.push(`[TABLE-LAYOUTS] 390 Data scrolls sideways by ${await pageScroll(p)}px`);
    // The goal's key, and its link: /goals/G-1.
    await p.goto(p.url().replace(/\/data.*$/, '/goals/G-1?today=2026-11-05')); await p.waitForTimeout(500);
    const g1 = await p.evaluate(() => ({ t: document.querySelector('h1')?.innerText.trim(), k: document.querySelector('.gkey')?.innerText.trim() }));
    if (g1.t !== 'Lead time for changes' || g1.k !== 'G-1') fails.push(`[READABLE-IDS] 390 /goals/G-1 shows "${g1.t}" with key "${g1.k}"`);
    await c.close();

    /* ---------- tablet 768 and 1024: the toolbar fits, keys in the Goals table, the key link in any case ---------- */
    for (const w of [768, 1024]) {
      [c, p] = await open(w, 1000, 'mateo', '/goals?scope=all&view=table');
      const gk = await p.evaluate(() => [...document.querySelectorAll('.gtable .gt-name .gkey')].map((e) => e.innerText.trim()));
      if (gk.length !== 126 || new Set(gk).size !== 126) fails.push(`[READABLE-IDS] ${w} Goals table shows ${gk.length} keys, ${new Set(gk).size} different`);
      await p.goto(p.url().replace(/\/goals.*$/, '/goals/g-6?today=2026-11-05')); await p.waitForTimeout(400);
      const g6 = await p.evaluate(() => ({ t: document.querySelector('h1')?.innerText.trim(), k: document.querySelector('.gkey')?.innerText.trim() }));
      if (g6.t !== 'Merge-to-deploy time (median)' || g6.k !== 'G-6') fails.push(`[READABLE-IDS] ${w} /goals/g-6 shows "${g6.t}" (${g6.k})`);
      await p.goto(p.url().replace(/\/goals.*$/, '/data?t=checkIns&today=2026-11-05')); await p.waitForTimeout(400);
      const ch = await heads(p);
      if (!ch.includes('Goal key')) fails.push(`[READABLE-IDS] ${w} the check-ins table has no Goal key column`);
      const over = await p.evaluate(() => [...document.querySelectorAll('.data-tools > *')].filter((e) => e.getBoundingClientRect().right > document.querySelector('.data-tools').getBoundingClientRect().right + 1).length);
      if (over || await pageScroll(p) > 0) fails.push(`[TABLE-LAYOUTS] ${w} the Data toolbar runs past its row (${over}) or the page scrolls sideways`);
      await c.close();
    }

    /* ---------- desktop 1440: the key on the goal page header ---------- */
    [c, p] = await open(1440, 900, 'amara', '/goals/G-17');
    const g13 = await p.evaluate(() => { const k = document.querySelector('.gkey'); const h1 = document.querySelector('h1'); return { t: h1?.innerText.trim(), k: k?.innerText.trim(), below: k ? k.getBoundingClientRect().top >= h1.getBoundingClientRect().bottom - 1 : false, size: k ? parseFloat(getComputedStyle(k).fontSize) : 0 }; });
    if (g13.t !== 'Remote build cache hit rate' || g13.k !== 'G-17' || !g13.below || g13.size > 13) fails.push(`[READABLE-IDS] 1440 goal header: "${g13.t}", key "${g13.k}" ${g13.size}px, under the title: ${g13.below}`);
    await c.close();
    return fails;
  },
};
