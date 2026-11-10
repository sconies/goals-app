/* F9: numbers and names (backlog N, 8 Nov). run({ open }) returns a list of failures.
   No silent rounding (check-in, New goal), numbers far outside the plan asked about with their thousands grouped, the
   reason box in goal edit once the plan changes, a duplicate goal name warned about, and a shared person name allowed. */
module.exports = {
  id: 'F9',
  area: 'numbers-names',
  reqs: ['NO-SILENT-ROUNDING', 'SAME-NAMES', 'PLAN-CHANGE'],
  title: 'Numbers and names: never rounded quietly, odd numbers asked about, shared names told apart',
  async run({ open }) {
    const fails = [];
    const fail = (m) => fails.push(m);
    const text = (p, sel) => p.locator(sel).allInnerTexts().then((t) => t.join(' | ')).catch(() => '');

    // The check-in: Rhea's lead time keeps whole hours (52 → 24).
    {
      const [c, p] = await open(390, 844, 'rhea', '/check-in/ns-lead');
      const input = p.locator('.bignum input');
      await input.fill('12.5');
      await p.getByRole('button', { name: 'Continue' }).click();
      const msg = await text(p, '#value-msg');
      if (!/12\.5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 13/.test(msg)) fail(`check-in: 12.5 in a whole-number goal isn’t refused with what it would show as (“${msg}”)`);
      if (await p.getByRole('button', { name: 'Something changed' }).isVisible().catch(() => false)) fail('check-in: 12.5 moved on past the number');
      await input.fill('1500');
      await p.waitForTimeout(200);
      const far = await text(p, '#value-msg');
      if (!/far outside this goal’s plan \(52 to 24 hours\)\. Is 1,500 right\?/.test(far)) fail(`check-in: 1500 hours isn’t asked about, with its thousands grouped (“${far}”)`);
      await input.fill('a12');
      await p.getByRole('button', { name: 'Continue' }).click();
      const letters = await text(p, '#value-msg');
      // The example is at the goal's decimal places: no decimal for whole hours (deep review U10).
      if (!/“a12” isn’t a number\. Type digits only, like 29\./.test(letters)) fail(`check-in: letters don’t get the one message, with a whole-number example (“${letters}”)`);
      await c.close();
    }

    // New goal: a name another goal has is warned about (not refused); a start finer than Decimals is refused.
    {
      const [c, p] = await open(1280, 900, 'rhea', '/goals/new');
      await p.locator('.big-input').first().fill('Lead time for changes');
      const warn = await text(p, '.field .hint.tone-risk');
      if (!/Another goal is called “Lead time for changes” \(G-1/.test(warn)) fail(`New goal: a duplicate name isn’t warned about (“${warn}”)`);
      await p.getByRole('button', { name: 'Continue' }).click();
      const start = p.getByLabel(/^Today/);
      if (!(await start.isVisible().catch(() => false))) fail('New goal: a duplicate name stopped the wizard at its first step');
      else {
        await start.fill('12.5');
        await p.getByLabel(/^Target/).fill('20');
        await p.getByRole('button', { name: 'Continue' }).click();
        const err = await text(p, '.field-error, [role="alert"]');
        if (!/would show as 13/.test(err)) fail(`New goal: 12.5 with whole-number Decimals isn’t refused (“${err}”)`);
      }
      await c.close();
    }

    // Goal edit: once check-ins have started, a target change brings the reason box.
    {
      const [c, p] = await open(1280, 900, 'rhea', '/goals/ns-lead/edit');
      if (await p.locator('.reason-field').isVisible().catch(() => false)) fail('goal edit: the reason box shows before anything changed');
      await p.getByLabel(/^Target/).first().fill('20');
      await p.waitForTimeout(200);
      if (!(await p.locator('.reason-field').isVisible().catch(() => false))) fail('goal edit: changing the target after check-ins doesn’t ask why');
      await c.close();
    }

    // People: a second Rhea Kapoor can be added; the note says the email tells them apart.
    {
      const [c, p] = await open(1280, 900, 'amara', '/people');
      await p.getByRole('button', { name: 'Add a person' }).click();
      const sheet = p.getByRole('dialog');
      await sheet.getByLabel('Name').fill('Rhea Kapoor');
      await sheet.getByLabel(/^Email/).fill('rhea.kapoor.two@example.com');
      const note = await text(p, '[role="dialog"] .hint.tone-risk');
      if (!/Rhea Kapoor \(.+\) is already here\. That’s fine: their email tells you apart/.test(note)) fail(`people: a shared name isn’t noted (“${note}”)`);
      await sheet.locator('form').evaluate((f) => f.requestSubmit());
      await p.waitForTimeout(400);
      if (await sheet.isVisible().catch(() => false)) fail(`people: a second Rhea Kapoor couldn’t be added (${await text(p, '[role="dialog"] [role="alert"]')})`);
      else {
        // The new person's page opens; the list shows both.
        await p.waitForURL(/\/people\/[^?]+/);
        const u = new URL(p.url()); u.pathname = u.pathname.replace(/\/people\/.+$/, '/people'); u.searchParams.set('q', 'Rhea');
        await p.goto(u.toString());
        await p.locator('.people-row').first().waitFor();
        await p.waitForTimeout(200);
        const names = await p.locator('.person-name').allInnerTexts();
        const both = names.filter((n) => n.startsWith('Rhea Kapoor'));
        if (both.length !== 2 || both[0] === both[1]) fail(`people: the two Rhea Kapoors aren’t told apart in the list (${both.join(', ')})`);
      }
      await c.close();
    }
    // Phones (demo review item 14, then backlog G): the layouts are one menu whose button names the open layout and whose
    // items say what each layout is; the open view's name is never cut off; active filters wrap, none cut off.
    for (const w of [360, 390]) {
      const [c, p] = await open(w, 800, 'rhea', '/goals?scope=all&view=board&status=off,risk&level=team&owner=rhea', true);
      await p.locator('.layout-menu > summary').click();
      const m = await p.evaluate(() => {
        const off = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > innerWidth + 0.5 || e.scrollWidth > e.clientWidth + 1); };
        const items = [...document.querySelectorAll('.layout-menu .view-menu-list .menuitem')].map((b) => b.innerText.replace(/\s+/g, ' ').trim());
        const name = document.querySelector('.show-menu .show-name');
        return { items, button: document.querySelector('.layout-menu > summary')?.innerText.replace(/\s+/g, ' ').trim(), items_off: [...document.querySelectorAll('.layout-menu .menuitem')].filter(off).length,
          view: name && name.scrollWidth > name.clientWidth + 1 ? name.textContent : '', chips: [...document.querySelectorAll('.filter-chips .filter-chip')].filter(off).map((e) => e.textContent), sideways: document.documentElement.scrollWidth - innerWidth };
      });
      if (m.items.length !== 5 || m.items_off) fail(`${w}px: the Layout menu has ${m.items.length} layouts, ${m.items_off} cut off`);
      if (m.button !== 'Layout: Board') fail(`${w}px: the Layout button says “${m.button}”`);
      if (!m.items.includes('Board A column for each status.')) fail(`${w}px: the Layout menu does not say what the Board layout is (${m.items.join(' | ')})`);
      if (m.view) fail(`${w}px: the open view's name is cut off: ${m.view}`);
      if (m.chips.length) fail(`${w}px: filter chips cut off: ${m.chips.join(', ')}`);
      if (m.sideways > 1) fail(`${w}px: Goals scrolls sideways by ${m.sideways}px`);
      await c.close();
    }

    // A saved view's long name in full on a wide monitor, as its tab.
    {
      const long = 'Platform goals at risk this quarter that need a decision from the steering group';
      const [c, p] = await open(1920, 1000, 'rhea', '/goals?scope=all&status=off,risk');
      await p.getByRole('button', { name: 'Save view' }).first().click();
      await p.getByRole('dialog').getByLabel('Name').fill(long);
      await p.getByRole('dialog').getByRole('button', { name: 'Save view' }).click();
      const tab = p.locator('.goals-tabs .view-tab');
      await tab.waitFor({ timeout: 4000 }).catch(() => {});
      const m = await tab.evaluate((e) => ({ text: e.textContent, cut: e.scrollWidth > e.clientWidth + 1 })).catch(() => null);
      if (!m || m.text !== long || m.cut) fail(`1920px: the saved view’s name is cut short (${m ? m.text : 'no tab'})`);
      await c.close();
    }
    return fails;
  },
};
