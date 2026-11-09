/* F2: fit and finish, forms-checkin (per-area reports, 4 Nov). run({ open, url, browser }) returns a list of failures.
   The check-in (CheckInFlow) and the one-table check-in (QuickCheckIn). Check-in #3 (the chart) is area 4's. */
module.exports = {
  id: 'F2',
  area: 'forms-checkin',
  async run({ open }) {
    const fails = [];
    const fail = (m) => fails.push(m);
    // The left edge of an element's text, not its box.
    const textLeft = (loc) => loc.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().left; });
    const box = (loc) => loc.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; });
    const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    // Rhea's lead time (hours, lower is better) is off track with a reason and a path from last week to carry; 40 hours is far behind plan.
    const kofiToCarry = async (p) => { await p.locator('.bignum input').fill('40'); await p.getByRole('button', { name: 'Continue' }).click(); await p.getByRole('button', { name: 'Something changed' }).waitFor(); };

    // ---------- the check-in ----------
    // Demo review, 8 Nov, item 2: a draft reopened at step 2 has Back, so a wrong number is corrected without posting,
    // and any draft can be discarded.
    {
      const [c, p] = await open(390, 844, 'rhea', '/check-in/ns-lead');
      await kofiToCarry(p);
      await p.getByRole('button', { name: 'Something changed' }).click();
      await p.reload();
      await p.locator('.focus-foot').waitFor();
      const back = p.locator('.focus-foot').getByRole('button', { name: 'Back' });
      if (!(await back.isVisible().catch(() => false))) fail('drafts: a check-in draft reopened past step 1 has no Back');
      else {
        // Back, once per step, to the number.
        for (let i = 0; i < 3 && !(await p.locator('.bignum input').isVisible().catch(() => false)); i++) await back.click();
        const v = await p.locator('.bignum input').inputValue().catch(() => null);
        if (v !== '40') fail(`drafts: Back from a reopened draft doesn't return to the number (it shows ${v})`);
      }
      const discard = p.getByRole('button', { name: 'Discard draft' });
      if (!(await discard.isVisible().catch(() => false))) fail('drafts: a reopened check-in draft has no Discard');
      else {
        await discard.click();
        const v = await p.locator('.bignum input').inputValue().catch(() => null);
        const kept = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(':checkin:ns-lead:')));
        if (v !== '' || kept.length) fail(`drafts: Discard left the draft (value “${v}”, kept ${kept.join(', ')})`);
      }
      await c.close();
    }
    // Check-in 4: step dots on every first step, one kind of dot row, and to-do dots you can see (3:1).
    for (const who of ['rhea', 'farah', 'chen']) {
      const [c, p] = await open(390, 844, who, '/check-in');
      const n = await p.locator('.goalhead .dots i').count();
      if (n < 1) fail(`check-in 4: ${who}'s first step has no step dots`);
      if (await p.locator('.focus-top .dots').count()) fail(`check-in 4: ${who} has a second, identical dot row for the goal counter`);
      const ratio = await p.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const todo = [...document.querySelectorAll('.goalhead .dots i')].find((i) => !i.className);
        if (!todo) return null;
        const a = lum(rgb(getComputedStyle(todo).backgroundColor)), b = lum(rgb(getComputedStyle(document.body).backgroundColor));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      if (ratio != null && ratio < 3) fail(`check-in 4: a to-do dot is ${ratio.toFixed(2)}:1 on the page (${who})`);
      if (await sideways(p) > 1) fail(`check-in: ${who} scrolls sideways at 390`);
      await c.close();
    }

    // Check-in 2, 8, 20: the note step's answers are both in the footer and on screen, even on a short laptop screen.
    for (const [w, h] of [[1280, 533], [1440, 700], [390, 844]]) {
      const [c, p] = await open(w, h, 'rhea', '/check-in/ns-lead');
      await kofiToCarry(p);
      const foot = p.locator('.focus-foot');
      for (const name of ['Something changed', 'Still true: post check-in']) {
        const b = foot.getByRole('button', { name });
        if (!(await b.count())) { fail(`check-in 2: “${name}” is not in the footer at ${w}×${h}`); continue; }
        await b.scrollIntoViewIfNeeded();
        const r = await box(b);
        if (r.y < 0 || r.b > h) fail(`check-in 2: “${name}” is off screen at ${w}×${h}`);
      }
      if (w >= 1024) {
        const sc = await box(foot.getByRole('button', { name: 'Something changed' })), st = await box(foot.getByRole('button', { name: /^Still true/ }));
        if (!(st.x > sc.r && Math.abs(st.y - sc.y) < 2)) fail(`check-in 2: the primary is not on the right of “Something changed” at ${w}`);
        // Check-in 8: Back's text starts at the column's edge.
        const col = (await box(p.locator('.goalhead'))).x;
        const back = await textLeft(foot.getByRole('button', { name: 'Back' }));
        if (Math.abs(back - col) > 1) fail(`check-in 8: Back's text is at x ${Math.round(back)}, the column at ${Math.round(col)} (${w})`);
        // Check-in 20: the footer's rule is the column's width.
        const rule = await foot.evaluate((el) => { const s = getComputedStyle(el, '::before'); const b = el.getBoundingClientRect(); return s.content === 'none' || s.borderTopWidth === '0px' ? null : b.width - parseFloat(s.left) - parseFloat(s.right); });
        const colW = (await box(p.locator('.goalhead'))).w;
        if (rule == null || Math.abs(rule - colW) > 1) fail(`check-in 20: the footer rule is ${rule == null ? 'the full footer' : Math.round(rule) + 'px'}, the column ${Math.round(colW)}px (${w})`);
      }
      await c.close();
    }

    // Check-in 1 (covered by the shared rule): a focused field never stops under the footer.
    {
      const [c, p] = await open(390, 844, 'rhea', '/check-in/ns-lead');
      const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom));
      const fh = (await box(p.locator('.focus-foot'))).h;
      if (pad < fh + 8) fail(`check-in 1: scroll padding ${pad}px under a ${Math.round(fh)}px footer`);
      // Check-in 11: on a phone "Show chart" is its own 44px line under the sentence, at the column's edge.
      await p.locator('.bignum input').fill('40');
      const sentence = await box(p.locator('.verdict > span').first());
      const show = p.getByRole('button', { name: 'Show chart' });
      const s = await box(show);
      if (s.y < sentence.b - 1) fail('check-in 11: “Show chart” is beside the verdict, not under the sentence, at 390');
      if (s.h < 44) fail(`check-in 11: “Show chart” is ${Math.round(s.h)}px tall at 390`);
      if (Math.abs((await textLeft(show)) - 16) > 1) fail('check-in 11: “Show chart” does not start at the column edge');
      if (!/week \d+\./.test(await p.locator('.verdict').innerText())) fail('check-in 11: “week 44.” can break between its words');
      // Check-in 19: one case for "from the numbers", and Change has no stray margin.
      await p.locator('.callline').getByRole('button', { name: 'Change' }).click();
      const sheetHint = await p.getByRole('dialog').locator('.opt .hint').filter({ hasText: /numbers/i }).first().innerText();
      if (sheetHint !== 'from the numbers') fail(`check-in 19: the sheet says “${sheetHint}”`);
      // Check-in 5: option rows are 56px with a regular-weight hint.
      const opt = await p.getByRole('dialog').locator('.opt').first().evaluate((el) => ({ h: el.getBoundingClientRect().height, hw: getComputedStyle(el.querySelector('.hint')).fontWeight }));
      if (Math.round(opt.h) < 56 || opt.hw !== '400') fail(`check-in 5: status rows ${Math.round(opt.h)}px, hint weight ${opt.hw}`);
      await c.close();
    }

    // Check-in 5, 6, 7, 9, 18: the account step.
    for (const w of [390, 1280]) {
      const [c, p] = await open(w, 900, 'rhea', '/check-in/ns-lead');
      await kofiToCarry(p);
      await p.getByRole('button', { name: 'Something changed' }).click();
      const rows = p.getByRole('radiogroup', { name: 'Where you are' }).locator('.opt');
      const r = await rows.first().evaluate((el) => ({ h: el.getBoundingClientRect().height, pt: getComputedStyle(el).paddingTop, lw: getComputedStyle(el.firstElementChild).fontWeight, hw: getComputedStyle(el.querySelector('.hint')).fontWeight, hs: getComputedStyle(el.querySelector('.hint')).fontSize }));
      // Rounded like the message: a 56px row can measure 55.99 after sub-pixel layout on the CI runner.
      if (Math.round(r.h) < 56 || r.pt !== '12px' || r.hw !== '400' || r.hs !== '14px' || r.lw !== '600') fail(`check-in 5: option row ${Math.round(r.h)}px, padding ${r.pt}, label ${r.lw}, hint ${r.hs}/${r.hw} at ${w}`);
      // Check-in 6: the focus ring sits inside the row, so the list's clip can't cut it.
      await p.keyboard.press('Shift');
      const ring = await rows.nth(1).evaluate((el) => { el.focus(); return { fv: el.matches(':focus-visible'), off: getComputedStyle(el).outlineOffset, ow: getComputedStyle(el).outlineWidth }; });
      if (ring.fv && (parseFloat(ring.off) > -2 || ring.ow !== '2px')) fail(`check-in 6: an option's focus ring is ${ring.ow} at offset ${ring.off}, clipped by the list`);
      if (w === 1280) {
        // Check-in 7: hover shows on an unselected row, and the selected row keeps its colour.
        // (Rhea's carried answer is already picked, so hover a row that isn't.)
        const unpicked = p.getByRole('radiogroup', { name: 'Where you are' }).locator('.opt[aria-checked="false"]').first();
        await unpicked.hover();
        const bg = await unpicked.evaluate((el) => getComputedStyle(el).backgroundColor);
        if (bg !== 'rgb(250, 249, 246)') fail(`check-in 7: hovered option is ${bg}`);
        // Check-in 9: the five week picks share one line, 48px tall.
        const picks = await p.getByRole('group', { name: 'Back on plan by' }).locator('.pill').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { y: Math.round(b.top), h: Math.round(b.height) }; }));
        if (new Set(picks.map((x) => x.y)).size > 1) fail(`check-in 9: ${picks.length} week picks wrap onto ${new Set(picks.map((x) => x.y)).size} lines at 1280`);
        if (picks.some((x) => x.h !== 48)) fail(`check-in 9: week picks are ${[...new Set(picks.map((x) => x.h))].join('/')}px, not 48`);
      }
      // Check-in 18: the carried-over text fits its box.
      const cut = await p.locator('.account textarea').evaluateAll((els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1).length);
      if (cut) fail(`check-in 18: ${cut} account box(es) cut off their text at ${w}`);
      // Check-in 14: an empty account's message sits 8px under its box.
      await p.getByLabel('What happened').fill('');
      await p.getByRole('button', { name: 'Post check-in' }).click();
      const ta = await box(p.getByLabel('What happened')), msg = await box(p.getByRole('alert').filter({ hasText: 'Write a sentence' }));
      if (Math.abs(msg.y - ta.b - 8) > 1) fail(`check-in 14: the account's message is ${Math.round(msg.y - ta.b)}px under its box at ${w}`);
      if (await sideways(p) > 1) fail(`check-in: the account scrolls sideways at ${w}`);
      await c.close();
    }

    // Check-in 14: a wrong number turns the field red and keeps last week's line under the message.
    {
      const [c, p] = await open(1280, 900, 'rhea', '/check-in/ns-lead');
      await p.locator('.bignum input').fill('abc');
      await p.getByRole('button', { name: 'Continue' }).click();
      const field = p.locator('.bignum');
      const border = await field.evaluate((el) => getComputedStyle(el).borderTopColor);
      if (border !== 'rgb(180, 35, 24)') fail(`check-in 14: a wrong number leaves the border ${border}`);
      const f = await box(field), m = await box(p.locator('#value-msg'));
      if (Math.abs(m.y - f.b - 8) > 1) fail(`check-in 14: the number's message is ${Math.round(m.y - f.b)}px under the field`);
      const hint = p.locator('#value-hint');
      if (!(await hint.isVisible()) || (await box(hint)).y < m.b) fail('check-in 14: last week’s number is replaced by the message, or above it');
      await c.close();
    }

    // Check-in 13: a stage's state is a shape and a word.
    {
      const [c, p] = await open(1280, 900, 'diego', '/check-in/lead-mq');
      const states = p.locator('.stagepick-state');
      const n = await states.count(), shaped = await states.locator('svg.status-shape').count();
      if (!n || shaped < n) fail(`check-in 13: ${n - shaped} of ${n} stage states are a coloured word with no shape`);
      // Check-in 9: the stage sheet uses the same week pills, ending at "Year end".
      await p.locator('.stagepick-row').first().click();
      const dlg = p.getByRole('dialog');
      const pills = await dlg.locator('.weekpicks .pill').evaluateAll((els) => els.map((e) => ({ t: e.innerText, h: Math.round(e.getBoundingClientRect().height) })));
      if (!pills.some((x) => /^Year end/.test(x.t))) fail('check-in 9: the stage sheet has no “Year end” pill');
      if (pills.some((x) => x.h !== 48)) fail('check-in 9: the stage sheet’s pills are not 48px');
      if (await dlg.locator('.optlist').count()) fail('check-in 9: “Done” is still a boxed row in the stage sheet');
      await c.close();
    }

    // Check-in 16: after posting on a phone, both buttons are full width and the status phrase stays together.
    {
      const [c, p] = await open(390, 844, 'rhea', '/check-in/ns-lead');
      await kofiToCarry(p);
      await p.getByRole('button', { name: /^Still true/ }).click();
      await p.getByText('Check-in saved').waitFor();
      const ws = await p.locator('.done-actions .btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
      if (ws.length < 2 || ws.some((x) => x < 350)) fail(`check-in 16: the buttons are ${ws.join(' and ')}px at 390`);
      const nobr = await p.locator('.celebrate .nobr').evaluate((el) => getComputedStyle(el).whiteSpace).catch(() => '');
      if (nobr !== 'nowrap') fail('check-in 16: “is ● On track” can split across lines');
      await c.close();
    }

    // ---------- the one-table check-in ----------
    // Numbers 1, 6, 7: Post is on screen; the summary sits in the bar above it; the label keeps saying Post.
    for (const [w, h] of [[390, 844], [1440, 700], [360, 740]]) {
      const [c, p] = await open(w, h, 'rhea', '/quick-check-in');
      await p.getByLabel(/Test suites split into parallel shards: this week’s number/).fill('20');
      await p.getByLabel(/Flaky test rate in the main pipelines: this week’s number/).fill('abc');
      const post = p.getByRole('button', { name: /^Post/ });
      if (!(await post.count())) { fail(`numbers 7: the button no longer says Post at ${w}`); await c.close(); continue; }
      // It counts only the rows that are ready (deep review U12): none here, so it says Post check-ins.
      if (!/^Post (\d check-ins?|check-ins)$/.test((await post.innerText()).trim())) fail(`numbers 7: the button says “${await post.innerText()}”`);
      await post.click();
      const pb = await box(post);
      if (pb.b > h || pb.y < 0) fail(`numbers 1: Post is off screen at ${w}×${h} (bottom ${Math.round(pb.b)})`);
      if (pb.h > 48) fail(`numbers 7: Post wraps to ${Math.round(pb.h)}px at ${w}`);
      const sum = p.locator('.qfoot .qsummary');
      if (!(await sum.count())) fail(`numbers 6: the summary is not in the sticky bar at ${w}`);
      else { const sb = await box(sum); if (sb.b > pb.y) fail(`numbers 6: the summary is not above Post at ${w}`); if (sb.b > h) fail(`numbers 6: the summary is off screen at ${w}×${h}`); }
      const foot = await p.locator('.qfoot').evaluate((el) => ({ pos: getComputedStyle(el).position, bt: getComputedStyle(el).borderTopColor }));
      if (foot.pos !== 'sticky') fail(`numbers 1: the button bar is ${foot.pos}`);
      if (w === 1440) {
        // Numbers 5: the row error sits 8px under its input and ends where it ends.
        const row = p.locator('.qrow').filter({ hasText: 'Flaky test rate' });
        const inp = await box(row.locator('.qvalue')), err = await box(row.locator('.qproblem'));
        if (Math.abs(err.y - inp.b - 8) > 1 || Math.abs(err.r - inp.r) > 1) fail(`numbers 5: the row error is ${Math.round(err.y - inp.b)}px under and ${Math.round(inp.r - err.r)}px short of its input`);
        // Numbers 9, 10: no row fill; exactly the listed fields outlined, and the message uses the labels' words.
        const alerts = p.locator('.qrow').filter({ hasText: 'Test suites split into parallel shards' });
        const bg = await alerts.evaluate((el) => getComputedStyle(el).backgroundColor);
        if (bg !== 'rgba(0, 0, 0, 0)') fail(`numbers 9: an error row is filled ${bg}`);
        const outlined = await alerts.locator('select, textarea').evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopColor === 'rgb(200, 55, 43)'));
        if (outlined.length !== 4 || outlined.some((x) => !x)) fail(`numbers 10: ${outlined.filter(Boolean).length} of ${outlined.length} missing fields outlined`);
        const valueBorder = await alerts.locator('.qvalue').evaluate((el) => getComputedStyle(el).borderTopColor);
        if (valueBorder === 'rgb(200, 55, 43)') fail('numbers 10: a valid number is outlined as wrong');
        if (!/how it gets back on plan/.test(await alerts.getByRole('alert').innerText())) fail('numbers 10: the message doesn’t use the field’s words');
        // Numbers 11: reasons get a box that holds a sentence.
        const ta = await alerts.locator('textarea').first().evaluate((el) => parseFloat(getComputedStyle(el).minHeight)).catch(() => 0);
        if (ta < 64) fail('numbers 11: the reason is a one-line field');
        // Numbers 16: selects drop the browser's own arrow.
        const ap = await alerts.locator('select').first().evaluate((el) => getComputedStyle(el).appearance);
        if (ap !== 'none') fail(`numbers 16: a select has appearance ${ap}`);
        // Numbers 22: Cancel's text lines up with the table's edge.
        const edge = (await box(p.locator('.qgrid'))).x, cancel = await textLeft(p.getByRole('link', { name: 'Cancel' }));
        if (Math.abs(cancel - edge) > 1) fail(`numbers 22: Cancel's text is at x ${Math.round(cancel)}, the table at ${Math.round(edge)}`);
      }
      if (w <= 390) {
        // Numbers 2: reasons in one column, the value under the name.
        const alerts = p.locator('.qrow').filter({ hasText: 'Test suites split into parallel shards' });
        const sel = await box(alerts.locator('select').first()), row = await box(alerts);
        if (sel.w < row.w - 40) fail(`numbers 2: the cause select is ${Math.round(sel.w)}px in a ${Math.round(row.w)}px row at ${w}`);
        const name = await box(alerts.locator('.qname')), val = await box(alerts.locator('.qvalue'));
        if (val.y < name.b - 1) fail(`numbers 2: the value sits beside the name at ${w}`);
        // Numbers 8: no "—" placeholder line on a phone.
        const dash = await p.locator('.qstatus').filter({ hasText: '—' }).evaluateAll((els) => els.filter((e) => e.getClientRects().length).length);
        if (dash) fail(`numbers 8: ${dash} empty status lines on a phone`);
      }
      if (await sideways(p) > 1) fail(`numbers: the table scrolls sideways at ${w}`);
      await c.close();
    }

    // Numbers 13, 14, 15, 18, 19: the unit, the posted number, the names, and the restored banner.
    {
      const [c, p] = await open(1280, 900, 'rhea', '/quick-check-in');
      const cache = p.locator('.qrow').filter({ hasText: 'Test suites split into parallel shards' }); // posted this week, a name that fits on one line
      const ph = await cache.locator('.qvalue input').getAttribute('placeholder');
      if (ph) fail(`numbers 13: the posted number shows as a placeholder “${ph}”`);
      if (!/\d+% posted/.test(await cache.locator('.qname .hint').innerText())) fail('numbers 13: the hint doesn’t say what was posted');
      const input = cache.locator('.qvalue input');
      await input.fill('81');
      const unit = cache.locator('.qunit');
      if (!(await unit.isVisible())) fail('numbers 14: the unit disappears once a number is typed');
      else {
        const fb = await box(cache.locator('.qvalue')), ub = await box(unit), ib = await box(input);
        if (Math.abs(fb.r - ub.r - 12) > 1) fail(`numbers 14: the unit is ${Math.round(fb.r - ub.r)}px from the field's edge`);
        if (Math.abs(ub.x - ib.r - 8) > 1) fail(`numbers 14: the number ends ${Math.round(ub.x - ib.r)}px before the unit`);
      }
      // Numbers 18: the name link is the size of its words, with rounded focus.
      const link = cache.locator('.qlink'), col = cache.locator('.qname');
      const lw = (await box(link)).w, cw = (await box(col)).w;
      if (lw >= cw - 1) fail(`numbers 18: the name link is the whole ${Math.round(cw)}px column`);
      if ((await link.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)) !== '4px') fail('numbers 18: the name link’s focus ring has square corners');
      // Numbers 15: the hint's parts don't split.
      const parts = await cache.locator('.qname .hint .nobr').count();
      if (parts < 2) fail('numbers 15: the plan and last parts can split');
      // Numbers 19: the restored banner: plain text, one blue link, the rows' left edge.
      await p.waitForTimeout(200);
      await p.reload();
      await p.locator('.restored').waitFor();
      const ban = await p.locator('.restored').evaluate((el) => ({ pl: getComputedStyle(el).paddingLeft, c: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
      if (ban.pl !== '16px' || ban.c !== 'rgb(47, 74, 76)') fail(`numbers 19: the banner has padding ${ban.pl} and text ${ban.c}`);
      await c.close();
    }

    // Numbers 4, 10 (touch): goal names and inline links are 44px to hit on a phone.
    {
      const [c, p] = await open(390, 844, 'rhea', '/quick-check-in', true);
      const h = await p.locator('.qlink').first().evaluate((el) => el.getBoundingClientRect().height);
      if (h < 44) fail(`numbers 4: a goal name is ${Math.round(h)}px to hit on touch`);
      await c.close();
    }
    return fails;
  },
};
