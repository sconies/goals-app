/* F8: fit and finish, sheets (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   Sheets and menus: the sticky sheet footer (also Watching/Activity #3 and List #3), tall sheets, messages over a sheet,
   the walkthrough coach, the Demo menu, the Filter goals sheet, touch targets, focus, empty states and first load. */
const round = (n) => Math.round(n * 10) / 10;

/** The open sheet's footer at the top, middle and end of its scroll: it must meet the sheet's bottom edge, on screen. */
async function footerEverywhere(page) {
  await page.waitForTimeout(300); // the sheet's slide-up has finished
  return page.evaluate(async () => {
    const sheet = document.querySelector('.sheet');
    const body = sheet && sheet.querySelector('.sheet-body');
    const foot = sheet && sheet.querySelector('.sheet-foot');
    if (!sheet || !body || !foot) return { missing: true };
    const cs = getComputedStyle(foot);
    const out = [];
    for (const f of [0, 0.5, 1]) {
      body.scrollTop = (body.scrollHeight - body.clientHeight) * f;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const fr = foot.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      const btn = foot.querySelector('.btn.primary').getBoundingClientRect();
      out.push({ f, footBottom: fr.bottom, sheetBottom: sr.bottom, btnBottom: btn.bottom });
    }
    return { vh: innerHeight, scrolls: body.scrollHeight > body.clientHeight + 1, position: cs.position, bottom: cs.bottom, marginBottom: cs.marginBottom, borderTop: cs.borderTopWidth, sheetTop: sheet.getBoundingClientRect().top, out };
  });
}

function checkFooter(fails, label, m) {
  if (m.missing) { fails.push(`${label}: no sheet footer`); return; }
  if (m.position !== 'sticky' || m.bottom !== '0px' || m.marginBottom !== '0px') fails.push(`${label}: footer is ${m.position}, bottom ${m.bottom}, margin-bottom ${m.marginBottom} (want sticky, 0, 0)`);
  if (m.borderTop !== '1px') fails.push(`${label}: footer divider ${m.borderTop}`);
  for (const o of m.out) {
    if (o.footBottom > m.vh + 0.5 || Math.abs(o.footBottom - o.sheetBottom) > 1) fails.push(`${label} at ${o.f * 100}% scroll: footer ends at ${round(o.footBottom)}, sheet at ${round(o.sheetBottom)}, screen at ${m.vh}`);
    if (o.btnBottom > m.vh - 12 + 0.5) fails.push(`${label} at ${o.f * 100}% scroll: the primary button ends ${round(m.vh - o.btnBottom)}px above the screen edge (want 12)`);
  }
}

const setTour = (page, t) => page.evaluate((v) => { sessionStorage.setItem('goals-tour', JSON.stringify(v)); window.dispatchEvent(new Event('goals-tour')); }, t);

module.exports = {
  id: 'F8',
  area: 'sheets',
  async run({ open, url }) {
    const fails = [];
    const step = async (name, f) => { try { await f(); } catch (e) { fails.push(`${name}: crashed (${String(e.message || e).split('\n')[0]})`); } };

    // #1 (and Watching/Activity #3, List #3): the footer at every scroll position, on a phone, in both filter sheets.
    await step('Activity filters 390', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/activity', true);
      await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
      await p.getByRole('dialog', { name: 'Filter activity' }).waitFor();
      checkFooter(fails, 'Activity Filters 390×844', await footerEverywhere(p));
      await c.close();
    });
    await step('Goals filters 390', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/goals?scope=all', true);
      await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
      await p.getByRole('dialog', { name: 'Filter goals' }).waitFor();
      const m = await footerEverywhere(p);
      checkFooter(fails, 'Filter goals 390×844', m);
      if (!m.missing && !m.scrolls) fails.push('Filter goals 390×844: expected a sheet tall enough to scroll (the check needs it)');
      // #15: "Clear filters" is a 44px target.
      const clear = await p.locator('.sheet-foot').getByRole('button', { name: 'Clear filters' }).boundingBox();
      if (!clear || clear.height < 44) fails.push(`Filter goals 390: "Clear filters" is ${clear && round(clear.height)}px tall`);
      await c.close();
    });
    await step('Goals filters 360', async () => {
      const [c, p] = await open(360, 740, 'rhea', '/goals?scope=all', true);
      await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
      await p.getByRole('dialog', { name: 'Filter goals' }).waitFor();
      checkFooter(fails, 'Filter goals 360×740', await footerEverywhere(p));
      await c.close();
    });

    // #2: tall sheets on a desktop end 24px above the window, and start 48px down on a short one.
    for (const [w, h, top] of [[1280, 800, 72], [1440, 700, 48], [1024, 768, 48]]) {
      await step(`tall sheet ${w}×${h}`, async () => {
        const [c, p] = await open(w, h, 'rhea', '/goals?scope=all');
        await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
        await p.getByRole('dialog', { name: 'Filter goals' }).waitFor();
        await p.waitForTimeout(250);
        const r = await p.evaluate(() => { const b = document.querySelector('.sheet').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight }; });
        if (r.bottom > r.vh - 24 + 0.5) fails.push(`Filter goals ${w}×${h}: sheet ends ${round(r.vh - r.bottom)}px above the window (want 24)`);
        if (Math.abs(r.top - top) > 1) fails.push(`Filter goals ${w}×${h}: sheet starts at ${round(r.top)} (want ${top})`);
        // #14: Sort is one full-width row above the groups; no checkbox is squeezed.
        if (w === 1440) {
          const f = await p.evaluate(() => {
            const grid = document.querySelector('.filter-sheet').getBoundingClientRect();
            const sort = document.querySelector('.filter-sheet select[aria-label="Sort"]').closest('fieldset').getBoundingClientRect();
            const boxes = [...document.querySelectorAll('.sheet .filter-options .check input')].map((i) => i.getBoundingClientRect()).filter((b) => b.width > 0);
            return { gridW: grid.width, sortW: sort.width, narrow: boxes.filter((b) => Math.round(b.width) !== 18 || Math.round(b.height) !== 18).length, n: boxes.length };
          });
          if (Math.abs(f.gridW - f.sortW) > 1) fails.push(`Filter goals 1440: Sort is ${round(f.sortW)}px of a ${round(f.gridW)}px row`);
          if (f.narrow) fails.push(`Filter goals 1440: ${f.narrow} of ${f.n} checkboxes are not 18×18`);
        }
        await c.close();
      });
    }

    // #4: a message raised with a sheet open shows inside the sheet, below its content, never over it.
    for (const [w, h] of [[1440, 700], [390, 844]]) {
      await step(`toast in sheet ${w}`, async () => {
        const [c, p] = await open(w, h, 'amara', '/goals?scope=all', w < 800);
        // Export these goals: in the Views menu, or the View sheet on a phone (GL2), whose sheet then sits under Export's.
        if (w < 800) await p.locator('.goals-phone-switch .view-open').click();
        else await p.locator('.views-menu > summary').click();
        await p.getByRole('button', { name: 'Export these goals' }).click();
        const sheet = p.getByRole('dialog', { name: 'Export', exact: true });
        await sheet.waitFor();
        await sheet.getByRole('button', { name: 'Other formats' }).click();
        await Promise.all([p.waitForEvent('download').catch(() => null), sheet.getByRole('button', { name: 'Save .json' }).click()]);
        // On a phone Export sits over the View sheet, which is hidden under it with its own copy of the message: the visible one.
        await p.locator('.sheet-toast:visible').first().waitFor({ timeout: 3000 });
        await p.waitForTimeout(350); // its slide-in has finished
        const r = await p.evaluate(() => {
          const top = [...document.querySelectorAll('.sheet')].pop();
          const t = top.querySelector('.sheet-toast').getBoundingClientRect(), b = top.querySelector('.sheet-body').getBoundingClientRect(), s = top.getBoundingClientRect();
          const g = document.querySelector('.toasts').getBoundingClientRect();
          return { tTop: t.top, tBottom: t.bottom, tLeft: t.left, bBottom: b.bottom, sBottom: s.bottom, sLeft: s.left, gW: g.width, vh: innerHeight };
        });
        if (r.tTop < r.bBottom - 0.5) fails.push(`Export sheet ${w}: the message overlaps the sheet's content by ${round(r.bBottom - r.tTop)}px`);
        if (r.tBottom > r.sBottom - 16 + 0.5 || r.tBottom > r.vh) fails.push(`Export sheet ${w}: the message ends ${round(r.sBottom - r.tBottom)}px above the sheet's bottom (want 16)`);
        if (Math.abs(r.tLeft - r.sLeft - 16) > 1) fails.push(`Export sheet ${w}: the message is ${round(r.tLeft - r.sLeft)}px in from the sheet's side (want 16)`);
        if (r.gW > 1) fails.push(`Export sheet ${w}: the page's own message still shows over the sheet`);
        await c.close();
      });
    }

    // #18: with no sheet open, a desktop message is centred on the work area, 24px up.
    await step('toast centring', async () => {
      const [c, p] = await open(1440, 900, 'rhea', '/feedback');
      await p.locator('main').getByRole('button', { name: 'Send feedback' }).click();
      const sheet = p.getByRole('dialog', { name: 'How is the app working for you?' });
      // #27: Send is enabled and reachable; pressed with no answer, it says what's missing.
      if (await sheet.getByRole('button', { name: 'Send' }).isDisabled()) fails.push('Send feedback: Send is disabled (greyed out, skipped by Tab)');
      await sheet.getByRole('button', { name: 'Send' }).click();
      if (!(await sheet.getByText('Choose one first.').isVisible().catch(() => false))) fails.push('Send feedback: pressing Send with no answer says nothing');
      await sheet.getByRole('button', { name: 'It helps' }).click();
      await sheet.getByRole('button', { name: 'Send' }).click();
      await p.locator('.toast').first().waitFor({ timeout: 3000 });
      await p.waitForTimeout(350); // its slide-in has finished
      const r = await p.evaluate(() => { const t = document.querySelector('.toast').getBoundingClientRect(); const m = document.querySelector('main.work').getBoundingClientRect(); return { mid: t.left + t.width / 2, main: m.left + m.width / 2, gap: innerHeight - t.bottom }; });
      if (Math.abs(r.mid - r.main) > 2) fails.push(`toast at 1440: centred at ${round(r.mid)}, the work area at ${round(r.main)}`);
      if (Math.abs(r.gap - 24) > 1) fails.push(`toast at 1440: ${round(r.gap)}px above the bottom (want 24)`);
      await c.close();
    });

    // #5: the Chase walkthrough scrolls its target into view; the ring is at least 16px inside the window.
    await step('Chase step 1', async () => {
      const [c, p] = await open(1280, 700, 'rhea', '/watching');
      await setTour(p, { id: 'quiet', step: 0 });
      await p.locator('.coach-ring').waitFor({ timeout: 3000 });
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => { const b = document.querySelector('.coach-ring').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight }; });
      if (r.top < 16 || r.bottom > r.vh - 16) fails.push(`Chase step 1 at 1280×700: the ring is at y ${round(r.top)}–${round(r.bottom)} in a ${r.vh}px window`);
      // #26, and the re-review (8 Nov, backlog T): every step before the last has a Next button, so a presenter can step through.
      const next = await p.locator('.coach .coach-next').filter({ hasText: /^Next$/ }).count();
      if (next !== 1) fails.push(`coach: step 1 has ${next} Next buttons, not one`);
      await c.close();
    });

    // #7: a closing step with nothing to point at sits 16px above the bottom, measured from its real height.
    for (const [w, h] of [[768, 1024], [1440, 900], [2560, 1440]]) {
      await step(`closing step ${w}`, async () => {
        const [c, p] = await open(w, h, 'rhea', '/watching');
        await setTour(p, { id: 'quiet', step: 0 });
        await p.locator('.coach').waitFor();
        await p.waitForTimeout(400);
        await setTour(p, { id: 'quiet', step: 2 });
        await p.waitForTimeout(500);
        const r = await p.evaluate(() => { const b = document.querySelector('.coach').getBoundingClientRect(); return { bottom: b.bottom, vh: innerHeight }; });
        if (Math.abs(r.vh - 16 - r.bottom) > 1) fails.push(`closing coach step at ${w}×${h}: ends ${round(r.vh - r.bottom)}px above the bottom (want 16)`);
        await c.close();
      });
    }

    // #6: the Brief walkthrough waits for the brief to be copied or saved, and rings the Brief row.
    await step('Brief walkthrough', async () => {
      const [c, p] = await open(1280, 800, 'amara', '/goals?scope=all');
      await setTour(p, { id: 'brief', step: 0 });
      await p.locator('.coach').waitFor();
      // Export these goals is in the Views menu (GL2), which the walkthrough points at first.
      await p.locator('.views-menu > summary').click();
      await p.getByRole('button', { name: 'Export these goals' }).click();
      await p.getByRole('dialog', { name: 'Export', exact: true }).waitFor();
      await p.waitForTimeout(900);
      const coach = p.locator('.coach');
      if (!/step 2 of 4/.test(await coach.innerText())) fails.push(`Brief walkthrough: after opening Export the coach shows "${(await coach.innerText()).split('\n')[0]}" (want step 2 of 4)`);
      // The brief is behind Other formats (import spec 2.9): step 2 opens them.
      await p.getByRole('button', { name: 'Other formats' }).click();
      await p.waitForTimeout(900);
      if (!/step 3 of 4/.test(await coach.innerText())) fails.push('Brief walkthrough: opening Other formats did not move on to step 3');
      const ring = await p.evaluate(() => {
        const r = document.querySelector('.coach-ring')?.getBoundingClientRect();
        const row = [...document.querySelectorAll('.export-list .opt')].find((e) => e.textContent.includes('Brief for an AI chat'))?.getBoundingClientRect();
        return r && row ? { ok: r.left <= row.left && r.top <= row.top && r.right >= row.right && r.bottom >= row.bottom } : { ok: false };
      });
      if (!ring.ok) fails.push('Brief walkthrough: step 3 does not ring the Brief row');
      await Promise.all([p.waitForEvent('download').catch(() => null), p.getByRole('button', { name: 'Save .md' }).click()]);
      await p.waitForTimeout(900);
      if (!/step 4 of 4/.test(await coach.innerText())) fails.push('Brief walkthrough: saving the brief did not move on to step 4');
      await c.close();
    });

    // #8: the ring round the full-bleed review bar stays inside the window; the coach never covers the sidebar.
    await step('review ring', async () => {
      const [c, p] = await open(1440, 900, 'amara', '/reviews/weekly');
      await p.locator('button.btn.primary', { hasText: /review/i }).first().click();
      await p.locator('.decide').first().waitFor({ timeout: 4000 });
      await setTour(p, { id: 'review', step: 2 });
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const b = document.querySelector('.coach-ring').getBoundingClientRect(), k = document.querySelector('.coach').getBoundingClientRect();
        const m = document.querySelector('main.work').getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, b: b.bottom, vw: innerWidth, vh: innerHeight, coach: k.left, main: m.left };
      });
      if (r.l < 4 || r.r > r.vw - 4 || r.t < 4 || r.b > r.vh - 4) fails.push(`review ring at 1440: ${round(r.l)}–${round(r.r)} × ${round(r.t)}–${round(r.b)} in ${r.vw}×${r.vh} (want 4px inside)`);
      if (r.coach < r.main + 16 - 0.5) fails.push(`review coach at 1440: left ${round(r.coach)}, over the sidebar (work area starts at ${round(r.main)})`);
      await c.close();
    });

    // #12, #13, #20: the Demo menu.
    await step('Demo menu', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/');
      await p.locator('.demo-entry:visible').first().click();
      const sheet = p.getByRole('dialog', { name: 'Demo' });
      await sheet.waitFor();
      const r = await p.evaluate(() => {
        const s = document.querySelector('.sheet');
        const people = s.querySelector('.demo-people');
        const avatar = people.querySelector('.menuitem .avatar').getBoundingClientRect().left;
        const head = people.querySelector('.field-label');
        const range = document.createRange(); range.selectNodeContents(head);
        const more = [...people.querySelectorAll('.linkish')].find((e) => /Everyone else/.test(e.textContent));
        const mr = document.createRange(); mr.selectNodeContents(more);
        const start = [...s.querySelectorAll('.menuitem')].find((e) => /Start over/.test(e.textContent));
        const label = start.querySelector('.strong').getBoundingClientRect(), hint = start.querySelector('.tiny').getBoundingClientRect();
        const current = getComputedStyle(s.querySelector('.menuitem[aria-current="true"]')).backgroundColor;
        return { avatar, head: range.getBoundingClientRect().left, more: mr.getBoundingClientRect().left, moreH: more.getBoundingClientRect().height, labelW: label.width, labelBottom: label.bottom, hintTop: hint.top, current };
      });
      if (Math.abs(r.head - r.avatar) > 1 || Math.abs(r.more - r.avatar) > 1) fails.push(`Demo menu: heading at x ${round(r.head)}, "Everyone else" at ${round(r.more)}, avatars at ${round(r.avatar)}`);
      if (r.hintTop < r.labelBottom - 0.5 || r.labelW < 60) fails.push(`Demo menu: "Start over" label ${round(r.labelW)}px wide, hint not under it`);
      if (r.current !== 'rgb(226, 241, 239)') fails.push(`Demo menu: the current person's row is ${r.current} (want the accent fill, at least as strong as hover)`);
      if (r.moreH < 44) fails.push(`Demo menu: "Everyone else" is ${round(r.moreH)}px tall`);
      await c.close();
    });

    // #16: the rail's person button is named, and opens a sheet titled for what you came to do.
    await step('rail person', async () => {
      const [c, p] = await open(1024, 768, 'rhea', '/');
      const me = p.locator('.side .me');
      // Its name comes from its own words, still there for screen readers when the rail hides them.
      const name = (await me.innerText().catch(() => '')) || (await me.textContent());
      const shown = await me.evaluate((b) => { const s = b.querySelector('.stack'); return s ? getComputedStyle(s).display !== 'none' : false; });
      // Navigation spec 2.1: you, by name and team; the rail's label says what it opens.
      if (!/Rhea Kapoor/.test(name || '') || !/CI\/CD/.test(name || '') || !shown) fails.push(`rail at 1024: the person button is named "${(name || '').replace(/\s+/g, ' ').trim()}"`);
      if (!/^Rhea Kapoor: .*switch person/.test((await me.getAttribute('data-label')) || '')) fails.push('rail at 1024: the person button has no label saying it switches person');
      await me.click();
      if (!(await p.getByRole('dialog', { name: 'Switch person' }).isVisible().catch(() => false))) fails.push('rail at 1024: the person button does not open "Switch person"');
      await c.close();
    });

    // #17 and #15: Respond starts in the answer, not on the goal link; its text links are 44px targets on a phone.
    // Since the flagship goal page (5 Nov) Respond opens the goal with the request open in place, not a sheet; the same
    // promises hold there, and its button is on screen when it opens.
    await step('Respond', async () => {
      const [c, p] = await open(390, 844, 'amara', '/', true);
      await p.locator('.need').getByRole('link', { name: 'Respond' }).first().click();
      const sheet = p.getByRole('region', { name: 'Respond' });
      await sheet.waitFor();
      await p.waitForTimeout(250);
      const tag = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
      if (tag !== 'TEXTAREA') fails.push(`Respond: first focus is on a ${tag}, not the answer`);
      const leave = await sheet.getByRole('button', { name: 'Leave it open' }).boundingBox();
      const link = await sheet.locator('.hint a').first().boundingBox();
      if (!leave || leave.height < 44) fails.push(`Respond 390: "Leave it open" is ${leave && round(leave.height)}px tall`);
      if (!link || link.height < 44) fails.push(`Respond 390: the goal link is ${link && round(link.height)}px tall`);
      const rec = await sheet.getByRole('button', { name: 'Record the answer' }).boundingBox();
      const fold = await p.evaluate(() => { const t = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length); return t ? t.getBoundingClientRect().top : innerHeight; });
      if (!rec || rec.y + rec.height > fold) fails.push(`Respond 390: “Record the answer” is ${rec ? 'below the fold' : 'missing'}`);
      await c.close();
    });

    // #21: the Status sheet shows its choice with a dot and a wash, not a focus-like outline.
    await step('Status sheet', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/check-in/ns-lead', true);
      await p.getByLabel('This week’s value').fill('31');
      await p.locator('.callline').getByRole('button', { name: 'Change' }).click();
      await p.getByRole('dialog', { name: 'Status' }).waitFor();
      const r = await p.evaluate(() => { const o = document.querySelector('.sheet .opt[aria-checked="true"]'); const cs = getComputedStyle(o); const dot = getComputedStyle(o, '::after'); return { outline: cs.outlineStyle, bg: cs.backgroundColor, dot: dot.backgroundColor, w: dot.width }; });
      if (r.outline !== 'none') fails.push(`Status sheet: the chosen row has a ${r.outline} outline`);
      if (r.bg !== 'rgb(242, 248, 247)' || r.dot !== 'rgb(33, 150, 142)' || r.w !== '18px') fails.push(`Status sheet: chosen row ${r.bg}, dot ${r.dot} ${r.w}`);
      await c.close();
    });

    // #23: the More sheet: no grey fill at rest on a phone, and the labels line up.
    await step('More sheet', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/', true);
      await p.locator('.tabbar').getByRole('button', { name: 'More' }).tap();
      const sheet = p.getByRole('dialog', { name: 'More' });
      await sheet.waitFor();
      await p.waitForTimeout(250);
      const r = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.sheet .menuitem')];
        const x = rows.map((m) => m.querySelector('.strong').getBoundingClientRect().left);
        const sw = rows.find((m) => /Switch person/.test(m.textContent));
        return { xs: [...new Set(x.map((v) => Math.round(v)))], bg: getComputedStyle(sw).backgroundColor };
      });
      if (r.xs.length !== 1) fails.push(`More sheet 390: labels start at x ${r.xs.join(', ')}`);
      if (r.bg !== 'rgba(0, 0, 0, 0)') fails.push(`More sheet 390: the Switch person row is filled ${r.bg} at rest`);
      await c.close();
    });

    // #10: nothing matches: a card with a heading, a line and the way out; no legend under it.
    await step('empty state', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/goals?scope=all&q=zzzzqq');
      await p.locator('.empty-state').waitFor({ timeout: 3000 });
      const r = await p.evaluate(() => {
        const e = document.querySelector('.empty-state'), cs = getComputedStyle(e), t = getComputedStyle(e.querySelector('.empty-state-title'));
        const line = e.querySelector('.empty-state-line').getBoundingClientRect(), btn = e.querySelector('.btn').getBoundingClientRect();
        return { border: cs.borderTopWidth, pad: cs.padding, title: `${t.fontSize}/${t.fontWeight}/${t.color}`, gap: btn.top - line.bottom, legend: !!document.querySelector('.legend') };
      });
      if (r.border !== '1px' || r.pad !== '32px 24px') fails.push(`empty state: border ${r.border}, padding ${r.pad}`);
      if (r.title !== '15px/600/rgb(24, 54, 56)') fails.push(`empty state: heading ${r.title}`);
      if (Math.abs(r.gap - 16) > 1) fails.push(`empty state: the button is ${round(r.gap)}px under the line (want 16)`);
      if (r.legend) fails.push('empty state: the legend still shows');
      await c.close();
    });

    // #11: a slow first load shows the app's name and "Loading…" before any script runs; the skeleton is a solid card.
    await step('first load', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/');
      const html = await (await p.request.get(url('/'))).text();
      if (!/class="preboot"[^>]*>Faro<span>Loading…<\/span>/.test(html)) fails.push('first load: index.html has no static "Loading…" placeholder');
      const s = await p.evaluate(() => {
        const d = document.createElement('div'); d.className = 'skeleton'; d.innerHTML = '<i></i><i></i><i></i><i></i>';
        const wrap = document.createElement('div'); wrap.style.width = '1400px'; wrap.appendChild(d); document.body.appendChild(wrap);
        const cs = getComputedStyle(d), i = getComputedStyle(d.querySelector('i'));
        const out = { w: d.getBoundingClientRect().width, bg: cs.backgroundImage, border: cs.borderTopWidth, block: i.backgroundColor };
        wrap.remove();
        return out;
      });
      if (Math.round(s.w) !== 1040 || s.bg !== 'none' || s.border !== '1px' || s.block !== 'rgb(238, 236, 230)') fails.push(`first load: skeleton ${round(s.w)}px wide, background ${s.bg}, border ${s.border}, blocks ${s.block}`);
      await c.close();
    });

    return fails;
  },
};
