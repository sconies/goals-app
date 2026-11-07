/* F7: fit and finish, data-workspace (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   [Dn] are the Data tables report's findings, [Wn] the Workspace and set-up report's. */
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

module.exports = {
  id: 'F7',
  area: 'data-workspace',
  async run({ open, url, browser }) {
    const fails = [];
    const box = (r, sel) => r.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }, sel);

    /* ---------- Data, phone: the changes bar, the name column, cells ---------- */
    let [c, r] = await open(360, 740, 'grace', '/data');
    const tabW = await r.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').getBoundingClientRect().width);
    await r.locator('.dtable tbody td.dname input').first().fill('A goal renamed with a much longer name than the column has room for');
    await r.locator('.dtable tbody td.num input').first().fill('7');
    await r.waitForTimeout(250);
    const foot = await r.evaluate(() => {
      const f = document.querySelector('.data-foot').getBoundingClientRect();
      const bar = document.querySelector('.tabbar').getBoundingClientRect();
      const btns = [...document.querySelectorAll('.data-foot .btn')].map((b) => b.getBoundingClientRect());
      return { f: { top: f.top, bottom: f.bottom, h: f.height }, barTop: bar.top, btns: btns.map((b) => ({ top: Math.round(b.top), h: b.height, right: b.right })), count: document.querySelector('.data-foot-count').innerText.trim(), gap: btns[1].left - btns[0].right };
    });
    if (foot.f.bottom > foot.barTop - 7) fails.push(`[D1] 360 changes bar ends at ${Math.round(foot.f.bottom)}, under the tab bar at ${Math.round(foot.barTop)}`);
    if (foot.f.h > 64 || new Set(foot.btns.map((b) => b.top)).size > 1) fails.push(`[D1] 360 changes bar is ${Math.round(foot.f.h)}px over more than one row`);
    if (foot.btns.some((b) => b.h < 44) || !near(foot.gap, 8)) fails.push(`[D1] 360 changes buttons ${foot.btns.map((b) => Math.round(b.h)).join('/')}px tall, ${Math.round(foot.gap)}px apart`);
    if (!/^\d+ changes?$/.test(foot.count)) fails.push(`[D1] 360 changes bar says "${foot.count}"`);
    const ed = await r.evaluate(() => {
      const td = document.querySelector('.dtable td.dname.edited');
      const cs = getComputedStyle(td), dot = getComputedStyle(td, '::after');
      return { bg: cs.backgroundColor, sh: cs.boxShadow, pos: cs.position, w: td.getBoundingClientRect().width, dot: [dot.width, dot.height, dot.top, dot.right].join(' '), weight: getComputedStyle(td.querySelector('input')).fontWeight, inputH: td.querySelector('input').getBoundingClientRect().height, tdH: td.getBoundingClientRect().height };
    });
    if (ed.bg !== 'rgb(226, 241, 239)' || !/1px inset/.test(ed.sh) || ed.dot !== '6px 6px 6px 6px' || ed.weight !== '400') fails.push(`[D4] an edited name cell: fill ${ed.bg}, outline ${ed.sh}, dot ${ed.dot}, weight ${ed.weight}`);
    if (ed.pos !== 'sticky' || !near(ed.w, 160)) fails.push(`[D3, D10] 360 name column is ${ed.pos}, ${Math.round(ed.w)}px (want sticky, 160)`);
    if (!near(ed.inputH, ed.tdH - 1)) fails.push(`[D11] an input is ${Math.round(ed.inputH)}px in a ${Math.round(ed.tdH)}px cell`);
    const tabW2 = await r.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').getBoundingClientRect().width);
    if (!near(tabW, tabW2)) fails.push(`[D23] the tab grows ${Math.round(tabW)}→${Math.round(tabW2)}px when edited`);
    // Asks (one ask model; the tab was Requests): the ask names the row, comes first and stays in view.
    await r.getByRole('tab', { name: /Asks/ }).click(); await r.waitForTimeout(250);
    const req = await r.evaluate(() => { const th = document.querySelector('.dtable thead th'); return { text: th.innerText.trim(), pos: getComputedStyle(th).position, w: th.getBoundingClientRect().width }; });
    if (req.text !== 'Ask' || req.pos !== 'sticky' || req.w > 161) fails.push(`[D3] Asks: first column "${req.text}", ${req.pos}, ${Math.round(req.w)}px`);
    const asked = await r.evaluate(() => { const i = [...document.querySelectorAll('.dtable thead th')].findIndex((t) => /Asked at/.test(t.innerText)); const td = document.querySelector('.dtable tbody tr').children[i]; return { t: td.innerText.trim(), f: getComputedStyle(td).fontFamily, w: td.getBoundingClientRect().width }; });
    if (!/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/.test(asked.t) || /mono/i.test(asked.f) || !near(asked.w, 160)) fails.push(`[D17] Asked at reads "${asked.t}" in ${asked.f.split(',')[0]}, ${Math.round(asked.w)}px`);
    // A filter with three values: one line, two values then +1.
    await r.goto(url('/data?t=goals&f=' + encodeURIComponent('Owner~is~Rhea Kapoor|Tariq Haddad|Mateo Fernández'))); await r.waitForTimeout(400);
    const chip = await r.evaluate(() => { const e = document.querySelector('.prop-chip'); return e ? { h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width, t: e.innerText, pw: e.parentElement.getBoundingClientRect().width } : null; });
    if (!chip) fails.push('[D19] no filter chip from the link');
    else if (chip.h > 46 || chip.w > chip.pw + 1 || !/\+1/.test(chip.t)) fails.push(`[D19] 360 filter chip ${Math.round(chip.w)}x${Math.round(chip.h)} "${chip.t.trim()}"`);
    const sw = await r.evaluate(() => document.querySelector('.filter-search .input').getBoundingClientRect().width);
    if (sw < 280) fails.push(`360 Data search is ${Math.round(sw)}px wide`);
    await c.close();

    /* ---------- Data, desktop ---------- */
    [c, r] = await open(1280, 800, 'rhea', '/data');
    const d = await r.evaluate(() => {
      const th = document.querySelector('.dtable thead th'), wrap = document.querySelector('.data-wrap');
      const ths = [...document.querySelectorAll('.dtable thead th')];
      const si = ths.findIndex((t) => t.innerText.trim() === 'Status');
      const row = document.querySelector('.dtable tbody tr');
      const st = row.children[si]?.querySelector('svg.status-shape');
      const link = document.querySelector('.dtable td.dname .linkish');
      const num = document.querySelector('.dtable td.num'), plain = row.children[ths.findIndex((t) => t.innerText.trim() === 'Team')];
      const cells = [...row.children].map((td) => { const r = td.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(td); const t = range.getBoundingClientRect(); return t.height ? Math.abs((t.top + t.bottom) / 2 - (r.top + r.bottom) / 2) : 0; });
      return { first: th.innerText.trim(), w: th.getBoundingClientRect().width, pad: getComputedStyle(th).padding, radius: getComputedStyle(wrap).borderRadius, shape: st ? st.getBoundingClientRect().width : 0, linkCut: link ? getComputedStyle(link).textOverflow : '', tnum: getComputedStyle(num).fontVariantNumeric, plain: getComputedStyle(plain).fontVariantNumeric, numPad: getComputedStyle(num).paddingRight, offCentre: Math.max(...cells) };
    });
    if (d.first !== 'Goal' || !near(d.w, 240)) fails.push(`[D10] 1280 first column "${d.first}" is ${Math.round(d.w)}px (want Goal, 240)`);
    if (d.linkCut !== 'ellipsis') fails.push('[D10] goal names are cut without an ellipsis');
    if (d.pad !== '8px 12px' || d.radius !== '8px') fails.push(`[D14] headers padded ${d.pad}, box radius ${d.radius}`);
    if (!near(d.shape, 8)) fails.push(`[D16] the Status column has no 8px shape (${d.shape})`);
    if (!/tabular/.test(d.tnum) || /tabular/.test(d.plain) || d.numPad !== '12px') fails.push(`[D9, D15] figures ${d.tnum} (padding ${d.numPad}), words ${d.plain}`);
    if (d.offCentre > 2) fails.push(`[D11] cell text sits ${d.offCentre.toFixed(1)}px off centre`);
    // Sorting doesn't widen a column; the icon is in a 12px slot.
    const before = await r.evaluate(() => [...document.querySelectorAll('.dtable thead th')].find((t) => t.innerText.trim() === 'Owner').getBoundingClientRect().width);
    await r.locator('.dtable thead').getByRole('button', { name: /^Owner/ }).click(); await r.waitForTimeout(250);
    const after = await r.evaluate(() => { const th = [...document.querySelectorAll('.dtable thead th')].find((t) => t.innerText.trim() === 'Owner'); return { w: th.getBoundingClientRect().width, icon: !!th.querySelector('.sort-slot svg'), glyph: /[↑↓]/.test(th.innerText) }; });
    if (!near(before, after.w) || !after.icon || after.glyph) fails.push(`[D26] sorting: Owner ${Math.round(before)}→${Math.round(after.w)}px, icon ${after.icon}, glyph ${after.glyph}`);
    // Nothing matches: inside the box, quiet.
    await r.getByPlaceholder('Search goals').fill('zzzz'); await r.waitForTimeout(250);
    const em = await r.evaluate(() => { const e = document.querySelector('.data-wrap .data-empty'); if (!e) return null; const cs = getComputedStyle(e); return { c: cs.color, w: cs.fontWeight, link: !!e.querySelector('button.linkish') }; });
    if (!em || em.c !== 'rgb(70, 87, 89)' || em.w !== '400' || !em.link) fails.push(`[D18] no rows: ${JSON.stringify(em)}`);
    await c.close();

    // Plans: week columns 72px. Columns: a grouped chooser in two columns.
    [c, r] = await open(1280, 800, 'grace', '/data?t=plan');
    const wk = await r.evaluate(() => [...document.querySelectorAll('.dtable thead th')].find((t) => /^Week 1\b/.test(t.innerText.trim()))?.getBoundingClientRect().width ?? 0);
    if (!near(wk, 72)) fails.push(`[D9] Plans week columns are ${Math.round(wk)}px`);
    await r.goto(url('/data?t=goals')); await r.waitForTimeout(300);
    await r.getByRole('button', { name: /^Columns/ }).click(); await r.waitForTimeout(300);
    const ch = await r.evaluate(() => ({ w: document.querySelector('[role="dialog"]').getBoundingClientRect().width, groups: document.querySelectorAll('.col-group').length, xs: new Set([...document.querySelectorAll('.col-checks .check')].map((e) => Math.round(e.getBoundingClientRect().left))).size }));
    if (!near(ch.w, 640) || ch.groups !== 4 || ch.xs !== 2) fails.push(`[D24] column chooser ${Math.round(ch.w)}px, ${ch.groups} groups, ${ch.xs} columns`);
    await r.keyboard.press('Escape');
    // Review: one column with room between its parts; a secondary with a border; the reason starts neutral.
    await r.locator('.dtable tbody td.num input').first().fill('7'); await r.waitForTimeout(200);
    await r.getByRole('button', { name: 'Review changes' }).click(); await r.waitForTimeout(400);
    const rv = await r.evaluate(() => {
      const kids = [...document.querySelector('[role="dialog"] .change-review').children].filter((e) => e.getClientRects().length);
      const gaps = kids.slice(1).map((e, i) => Math.round(e.getBoundingClientRect().top - kids[i].getBoundingClientRect().bottom));
      document.activeElement?.blur(); const again = document.querySelector('.preview-again'), ta = document.querySelector('[role="dialog"] textarea');
      return { gaps, border: getComputedStyle(again).borderTopColor, ta: ta ? getComputedStyle(ta).borderTopColor : null };
    });
    if (rv.gaps.some((g) => g < 8)) fails.push(`[D5] review parts ${rv.gaps.join('/')}px apart`);
    if (/rgba\(0, 0, 0, 0\)/.test(rv.border)) fails.push('[D5] Keep editing has no border');
    if (rv.ta && rv.ta !== 'rgb(210, 206, 196)') fails.push(`[D8] the reason opens with a ${rv.ta} border`);
    if (rv.ta) {
      await r.getByRole('dialog').getByRole('button', { name: /^Save/ }).click({ force: true }); await r.waitForTimeout(200);
      const t2 = await r.evaluate(() => getComputedStyle(document.querySelector('[role="dialog"] textarea')).borderTopColor);
      if (t2 === 'rgb(210, 206, 196)') fails.push('[D8] pressing Save without a reason does not mark the field');
    }
    await c.close();

    // Review at 150% zoom: the buttons and the title stay in the window.
    [c, r] = await open(853, 533, 'grace', '/data?t=goals');
    await r.locator('.dtable tbody td.num input').first().fill('7');
    await r.waitForTimeout(200);
    await r.getByRole('button', { name: 'Review changes' }).click(); await r.waitForTimeout(400);
    const z = await r.evaluate(() => { const s = document.querySelector('[role="dialog"]').getBoundingClientRect(), save = [...document.querySelectorAll('[role="dialog"] .btn.primary')].pop().getBoundingClientRect(), head = document.querySelector('[role="dialog"] .sheet-head').getBoundingClientRect(); return { top: s.top, bottom: s.bottom, save: save.bottom, saveTop: save.top, head: head.top }; });
    if (z.save > 533 || z.save > z.bottom + 1 || z.head < z.top - 1 || z.top > 17) fails.push(`[D7] 853x533 review: sheet ${Math.round(z.top)}–${Math.round(z.bottom)}, Save ends ${Math.round(z.save)}`);
    await c.close();

    // Table height follows the window; on a wide screen the data uses the width.
    [c, r] = await open(1440, 700, 'rhea', '/data?t=checkIns');
    const t1 = await box(r, '.data-wrap');
    if (t1.bottom > 700 - 23 || t1.bottom < 700 - 40) fails.push(`[D6] 1440x700 table box ends at ${Math.round(t1.bottom)}`);
    await c.close();
    [c, r] = await open(2560, 1440, 'rhea', '/data?t=checkIns');
    const t2 = await box(r, '.data-wrap');
    if (t2.bottom < 1440 - 40 || t2.bottom > 1440 - 23) fails.push(`[D6] 2560x1440 table box ends at ${Math.round(t2.bottom)}`);
    if (t2.right < 2560 - 34) fails.push(`[D21] 2560 Data stops at ${Math.round(t2.right)}`);
    await c.close();

    // Dark mode: read-only cells stand apart from the ones you can type into.
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
      const p = await ctx.newPage();
      await p.goto(url('/')); await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'grace'));
      await p.goto(url('/data')); await p.waitForTimeout(400);
      const dk = await p.evaluate(() => ({ ro: getComputedStyle(document.querySelector('.dtable td.dcell.ro:not(.dname)')).backgroundColor, rw: getComputedStyle(document.querySelector('.dtable td.dcell:not(.ro):not(.dname)')).backgroundColor, body: getComputedStyle(document.querySelector('.data-wrap')).backgroundColor }));
      const rw = /rgba\(0, 0, 0, 0\)/.test(dk.rw) ? dk.body : dk.rw;
      if (contrast(dk.ro, rw) < 1.3) fails.push(`[D20] dark: read-only ${dk.ro} vs editable ${rw} is ${contrast(dk.ro, rw).toFixed(2)}:1`);
      await ctx.close();
    }

    /* ---------- Workspace ---------- */
    [c, r] = await open(360, 740, 'grace', '/workspace');
    // There is one example now, so give the person a second workspace of their own to tell the marks apart.
    await r.evaluate(() => localStorage.setItem('goals-app-v2:workspaces', JSON.stringify([{ id: 'ws_other', name: 'Support desk', kind: 'own', createdAt: '2026-10-01T00:00:00Z' }])));
    await r.reload(); await r.waitForTimeout(500);
    const ws = await r.evaluate(() => {
      const opt = document.querySelector('.person-opt'), cs = getComputedStyle(opt);
      const av = opt.querySelector('.avatar').getBoundingClientRect(), name = opt.querySelector('.person-name').getBoundingClientRect();
      const hint = opt.querySelector('.hint');
      const h2 = document.querySelector('.people-head h2'), cnt = h2.querySelector('.hint').getBoundingClientRect(), add = [...document.querySelectorAll('.people-head .btn')][0]?.getBoundingClientRect();
      const range = document.createRange(); range.setStart(h2, 0); range.setEndBefore(h2.querySelector('.hint')); const words = [...range.getClientRects()].pop();
      return { cols: cs.gridTemplateColumns, align: cs.alignItems, avTop: av.top, nameTop: name.top, nameLeft: name.left, avRight: av.right, hint: hint ? [getComputedStyle(hint).fontWeight, getComputedStyle(hint).color].join(' ') : '', nameW: getComputedStyle(opt.querySelector('.person-name')).fontWeight, cntGap: cnt.left - words.right, cntTop: Math.abs(cnt.top - words.top), addBelow: add ? add.top >= h2.getBoundingClientRect().bottom - 1 : true, marks: [...document.querySelectorAll('.ws-line .wsmark')].map((m) => m.innerText.trim()).join('') };
    });
    if (!/^24px /.test(ws.cols) || ws.align !== 'start' || !near(ws.nameLeft - ws.avRight, 12)) fails.push(`[W1] a person row: ${ws.cols}, align ${ws.align}, name ${Math.round(ws.nameLeft - ws.avRight)}px from the avatar`);
    if (ws.hint !== '400 rgb(70, 87, 89)' || ws.nameW !== '550') fails.push(`[W14] job title ${ws.hint}, name weight ${ws.nameW}`);
    if (ws.cntGap > 12 || ws.cntTop > 6 || !ws.addBelow) fails.push(`[W19] 360 heading count ${Math.round(ws.cntGap)}px after the last word; Add a person below: ${ws.addBelow}`);
    if (new Set(ws.marks).size < 2) fails.push(`[W21] every workspace mark is "${ws.marks[0]}"`);
    await r.getByRole('button', { name: 'Add a person' }).click(); await r.waitForTimeout(300);
    await r.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click(); await r.waitForTimeout(200);
    const ap = await r.evaluate(() => { const dlg = document.querySelector('[role="dialog"]'); const inp = dlg.querySelector('input.input').getBoundingClientRect(), al = dlg.querySelector('[role="alert"]').getBoundingClientRect(), cb = dlg.querySelector('.check input').getBoundingClientRect(), w = getComputedStyle(dlg.querySelector('.admin-word')); return { gap: al.top - inp.bottom, cb: [cb.width, cb.height], word: `${w.fontSize} ${w.fontWeight}` }; });
    if (!near(ap.gap, 8, 2)) fails.push(`[W12] "Add a name." is ${Math.round(ap.gap)}px under Name`);
    if (ap.cb[0] < 17 || ap.cb[1] < 17 || ap.word !== '14px 600') fails.push(`[W12] Admin checkbox ${ap.cb.join('x')}, label ${ap.word}`);
    await c.close();
    [c, r] = await open(1280, 800, 'grace', '/workspace');
    await r.getByRole('button', { name: 'Reset the example' }).click(); await r.waitForTimeout(200);
    const rc = await r.evaluate(() => { const q = document.querySelector('.reset-confirm'), btns = [...document.querySelectorAll('.split-a > .row .btn')]; if (!q) return null; const b = q.getBoundingClientRect(); return { below: b.top - Math.max(...btns.map((x) => x.getBoundingClientRect().bottom)), row: new Set([...q.querySelectorAll('.btn')].map((x) => Math.round(x.getBoundingClientRect().top))).size }; });
    if (!rc || !near(rc.below, 12, 2) || rc.row !== 1) fails.push(`[W13] reset confirm: ${JSON.stringify(rc)}`);
    await c.close();
    [c, r] = await open(2560, 1440, 'grace', '/workspace');
    const pw = await box(r, '.page.workspace');
    if (pw.w > 1121) fails.push(`[W24] 2560 Workspace page is ${Math.round(pw.w)}px`);
    await c.close();

    /* ---------- Setting up ---------- */
    [c, r] = await open(1280, 800, 'grace', '/workspace/new');
    await r.getByRole('button', { name: 'Next' }).click(); await r.waitForTimeout(250);
    const e0 = await r.evaluate(() => { const al = [...document.querySelectorAll('[role="alert"]')].filter((x) => x.getClientRects().length); const inp = document.querySelector('.qsection input').getBoundingClientRect(); return { n: al.length, inFoot: al.some((a) => a.closest('.focus-foot')), gap: al[0] ? al[0].getBoundingClientRect().top - inp.bottom : -1, color: al[0] ? getComputedStyle(al[0]).color : '', focused: document.activeElement === document.querySelector('.qsection input') }; });
    if (e0.inFoot || !near(e0.gap, 8, 2) || e0.color !== 'rgb(180, 35, 24)' || !e0.focused) fails.push(`[W7] step 1 problem: in footer ${e0.inFoot}, ${Math.round(e0.gap)}px under the field, ${e0.color}, focused ${e0.focused}`);
    const bar = await r.evaluate(() => [...document.querySelectorAll('.steps-bar i')].map((i) => `${getComputedStyle(i).backgroundColor}/${i.getBoundingClientRect().height}`));
    if (bar[0] !== 'rgb(33, 150, 142)/6' || bar[1] !== 'rgb(210, 206, 196)/4') fails.push(`[W5] progress: ${bar.slice(0, 2).join(', ')}`);
    await r.getByLabel('Name').first().fill('Test space');
    await r.getByRole('button', { name: 'Next' }).click(); await r.waitForTimeout(200);
    await r.getByLabel('Your name').fill('Ana Silva'); await r.getByLabel('Your team').fill('Platform'); await r.getByLabel('Your email').fill('ana.silva@example.com');
    await r.getByRole('button', { name: 'Next' }).click(); await r.waitForTimeout(250);
    await r.getByLabel('Person 1: name').fill('Ana Silva');
    await r.evaluate(() => document.activeElement?.blur());
    await r.waitForTimeout(150);
    const pg = await r.evaluate(() => { const row = document.querySelector('.pg-row'); const [n, em, t] = row.querySelectorAll('.input'); const chk = row.querySelector('.pg-check').getBoundingClientRect(); const issue = row.querySelector('.pg-issue')?.getBoundingClientRect(); return { focus: document.querySelector('.focus').getBoundingClientRect().width, n: n.getBoundingClientRect().width, em: em.getBoundingClientRect().width, t: t.getBoundingClientRect().width, chk: [Math.round(chk.width), Math.round(chk.height)], red: getComputedStyle(n).borderTopColor, issueW: issue ? issue.width : 0, ph: t.placeholder }; });
    // Name, email and team side by side (release 3: everyone has an email): each wide enough to read what's typed.
    if (pg.focus > 801 || pg.focus < 760 || pg.n < 200 || pg.em < 200 || pg.t < 140) fails.push(`[W4] 1280 people step ${Math.round(pg.focus)}px: Name ${Math.round(pg.n)}, Email ${Math.round(pg.em)}, Team ${Math.round(pg.t)}`);
    if (pg.chk.join('x') !== '44x44' || pg.ph !== 'Team') fails.push(`[W11, W4] Admin cell ${pg.chk.join('x')}, Team placeholder "${pg.ph}"`);
    if (pg.red !== 'rgb(200, 55, 43)' || pg.issueW > pg.n + pg.em + pg.t + 17) fails.push(`[W6] a duplicate name: border ${pg.red}, message ${Math.round(pg.issueW)}px wide`);
    await r.getByLabel('Person 1: name').fill('Cat Lee'); await r.getByLabel('Person 1: email').fill('cat.lee@example.com');
    await r.getByRole('button', { name: 'Next' }).click(); await r.waitForTimeout(250);
    await r.locator('.opt[role="radio"]').nth(1).click(); await r.waitForTimeout(150);
    const op = await r.evaluate(() => { const o = document.querySelector('.opt[role="radio"][aria-checked="true"]'); const b = getComputedStyle(o, '::before'); return { sh: getComputedStyle(o).boxShadow, ol: getComputedStyle(o).outlineStyle, circle: [b.width, b.height, b.borderTopLeftRadius].join(' ') }; });
    if (!/2px inset/.test(op.sh) || op.ol !== 'none' || op.circle !== '16px 16px 50%') fails.push(`[W18] a chosen option: ${op.sh}, outline ${op.ol}, circle ${op.circle}`);
    await c.close();
    [c, r] = await open(360, 740, 'grace', '/workspace/new');
    await r.getByLabel('Name').first().fill('Test space');
    await r.getByRole('button', { name: 'Next' }).click(); await r.waitForTimeout(200);
    await r.getByLabel('Your name').fill('Ana Silva'); await r.getByLabel('Your team').fill('Platform'); await r.getByLabel('Your email').fill('ana.silva@example.com');
    await r.getByRole('button', { name: 'Next' }).click(); await r.waitForTimeout(250);
    const pp = await r.evaluate(() => { const row = document.querySelector('.pg-row'); const [n, t] = [...row.querySelectorAll('.input')].map((e) => e.getBoundingClientRect()); const c2 = row.querySelector('.pg-check').getBoundingClientRect(); return { stacked: t.top >= n.bottom + 7, same: Math.abs(n.width - t.width) < 1, third: c2.top >= t.bottom }; });
    if (!pp.stacked || !pp.same || !pp.third) fails.push(`[W4] 360 people rows: ${JSON.stringify(pp)}`);
    await c.close();

    /* ---------- Import preview and Export ---------- */
    [c, r] = await open(390, 844, 'mateo', '/import');
    const steps = await r.evaluate(() => { const ol = document.querySelector('.import-steps'), h = document.querySelector('.page-head h1'); return Math.round(ol.querySelector('li').getBoundingClientRect().left - h.getBoundingClientRect().left); });
    if (steps > 1) fails.push(`[W15] import steps start ${steps}px in from the title`);
    await r.getByLabel('Choose a spreadsheet').setInputFiles({ name: 'plan.csv', mimeType: 'text/csv', buffer: Buffer.from('ID,Goal,Week 45,Week 46,Week 47\nmttr-pir,Post-incident actions closed within 30 days,30,31,32\n') });
    await r.waitForTimeout(500);
    const ta = await r.evaluate(() => { const t = document.querySelector('textarea'); return t ? getComputedStyle(t).borderTopColor : null; });
    if (ta && ta !== 'rgb(210, 206, 196)') fails.push(`[W8] the plan reason opens with a ${ta} border`);
    const chev0 = await box(r, '.change-goal .change-chev');
    await r.locator('.change-goal summary').first().click(); await r.waitForTimeout(300);
    const pv = await r.evaluate(() => { const g = document.querySelector('.change-goal'); const title = g.querySelector('summary .strong').getBoundingClientRect(); const det = g.querySelector('.changes li').getBoundingClientRect(); const ch = g.querySelector('.change-chev').getBoundingClientRect(); const save = [...document.querySelectorAll('.import-foot .btn.primary')].pop(); const cs = getComputedStyle(save); return { off: det.left - title.left, chev: ch.left, chevRight: ch.right, title: title.left, table: !!g.querySelector('.plan-diff-table'), save: `${cs.opacity} ${cs.backgroundColor} ${cs.whiteSpace}` }; });
    if (!chev0 || Math.abs(pv.chev - chev0.left) > 1 || pv.chevRight > pv.title) fails.push(`[W3] the chevron moves ${chev0 ? Math.round(pv.chev - chev0.left) : '?'}px when opened`);
    if (Math.abs(pv.off) > 1 || !pv.table) fails.push(`[W9] plan details ${Math.round(pv.off)}px off the title; week table ${pv.table}`);
    if (pv.save !== '1 rgb(210, 206, 196) nowrap') fails.push(`[W16] Save not ready: ${pv.save}`);
    await c.close();
    [c, r] = await open(1280, 800, 'rhea', '/goals');
    await r.locator('button.btn:visible', { hasText: /^Export$/ }).first().click(); await r.waitForTimeout(400);
    const ex = await r.evaluate(() => { const dlg = document.querySelector('[role="dialog"]'); const row = dlg.querySelector('.export-list .opt.static'); const [a, b] = row.children; return { w: dlg.getBoundingClientRect().width, gap: b.getBoundingClientRect().left - a.getBoundingClientRect().right, bw: b.getBoundingClientRect().width }; });
    if (!near(ex.w, 520) || !near(ex.gap, 16) || ex.bw < 112) fails.push(`[W22] export sheet ${Math.round(ex.w)}px, ${Math.round(ex.gap)}px gap, buttons ${Math.round(ex.bw)}px`);
    await c.close();
    return fails;
  },
};
