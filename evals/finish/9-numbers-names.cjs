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
      // An unlikely number is a Check (CK2): its question is in the block, not a hint.
      const far = await text(p, '.level-check');
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
      const warn = await text(p, '.hint.tone-risk');
      if (!/Another goal is called “Lead time for changes”: G-1, .*owned by /.test(warn)) fail(`New goal: a duplicate name isn’t warned about (“${warn}”)`);
      await p.getByRole('button', { name: 'Continue' }).click();
      // Who and where (OB1): Rhea is asked the level.
      await p.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Team' }).click();
      // The same name in the same team is asked about on this step (goal entry, rule 3's same-name), never refused.
      const differs = p.getByRole('button', { name: 'Yes, it’s a different goal' });
      if (await differs.isVisible().catch(() => false)) await differs.click();
      await p.getByRole('button', { name: 'Continue' }).click();
      const start = p.getByLabel(/^Baseline/);
      await start.waitFor({ timeout: 3000 }).catch(() => {});
      if (!(await start.isVisible().catch(() => false))) fail('New goal: a duplicate name stopped the wizard at its first step');
      else {
        await start.fill('12.5');
        await p.getByLabel(/^Target/).fill('20');
        // Decimals are worked out from what is typed (goal entry, rule 2), and said with Change.
        const kept = await text(p, '.decimals-line');
        if (!/Kept to 1 decimal place, as you typed them\./.test(kept)) fail(`New goal: 12.5 doesn’t say it is kept to 1 decimal place (“${kept}”)`);
        await p.getByRole('button', { name: 'Change the decimal places' }).click();
        await p.getByRole('button', { name: 'Whole numbers' }).click();
        await p.getByRole('button', { name: 'Continue' }).click();
        const err = await text(p, '.field-error, [role="alert"]');
        if (!/would show as 13/.test(err)) fail(`New goal: 12.5 with whole numbers chosen isn’t refused (“${err}”)`);
        if (!(await p.getByRole('button', { name: 'Keep 1 decimal place' }).isVisible().catch(() => false))) fail('New goal: a too-precise number doesn’t offer “Keep 1 decimal place”');
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
    // Phones (demo review item 14, backlog G, then GL2): the View button names the open layout and opens the View sheet,
    // whose Layout group says what each layout is; nothing in it is cut off; active filters wrap, none cut off.
    for (const w of [360, 390]) {
      const [c, p] = await open(w, 800, 'rhea', '/goals?scope=all&view=board&status=off,risk&level=team&owner=rhea', true);
      const button = (await p.locator('.goals-phone-switch .view-open').innerText()).replace(/\s+/g, ' ').trim();
      await p.locator('.goals-phone-switch .view-open').click();
      await p.getByRole('dialog', { name: 'View' }).waitFor();
      const m = await p.evaluate(() => {
        const off = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > innerWidth + 0.5 || e.scrollWidth > e.clientWidth + 1); };
        const items = [...document.querySelectorAll('.view-sheet input[name="view-layout"]')].map((b) => b.closest('label').innerText.replace(/\s+/g, ' ').trim());
        return { items, items_off: [...document.querySelectorAll('.view-sheet .view-choice, .view-sheet .btn')].filter(off).length,
          chips: [...document.querySelectorAll('.filter-line .filter-part')].filter(off).map((e) => e.textContent), sideways: document.documentElement.scrollWidth - innerWidth };
      });
      if (m.items.length !== 5 || m.items_off) fail(`${w}px: the View sheet has ${m.items.length} layouts, ${m.items_off} things cut off`);
      if (button !== 'View: Board, as trees') fail(`${w}px: the View button says “${button}”`);
      if (!m.items.includes('Board A column for each status.')) fail(`${w}px: the View sheet does not say what the Board layout is (${m.items.join(' | ')})`);
      if (m.chips.length) fail(`${w}px: filter chips cut off: ${m.chips.join(', ')}`);
      if (m.sideways > 1) fail(`${w}px: Goals scrolls sideways by ${m.sideways}px`);
      await c.close();
    }

    // A saved view's long name in full on a wide monitor, as its tab.
    {
      const long = 'Platform goals at risk this quarter that need a decision from the steering group';
      const [c, p] = await open(1920, 1000, 'rhea', '/goals?scope=all&status=off,risk');
      await p.locator('.views-menu > summary').click();
      await p.getByRole('button', { name: 'Save this view…' }).click();
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
