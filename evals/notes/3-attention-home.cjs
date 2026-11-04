/* N3: Lane's review notes (5 Nov), attention-home. run({ open, url, browser }) returns a list of failures.
   [ATTENTION-HANDLED] "Needs attention" means new since someone looked; a goal behind but looked at since its latest
   check-in is "Being handled", with what's in hand, everywhere. [HOME-DASHBOARD] Home opens with a slim strip (your goals
   by status, on-time streak, watched goals needing attention, next review) and shows what you own and what you watch. */
const box = (p, sel, i = 0) => p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, [sel, i]);
const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const STATUS_WORD = /on track|at risk|off track|no recent update|done|not started|no check-in/i;
/** A section on a page by its heading. */
const section = (p, name) => p.locator('section', { has: p.getByRole('heading', { name, exact: false }) }).last();
const rowsIn = async (loc) => (await loc.count()) ? loc.locator('.trow').allInnerTexts() : [];

module.exports = {
  id: 'N3',
  area: 'attention-home',
  title: 'Review notes, attention-home',
  reqs: ['ATTENTION-HANDLED', 'HOME-DASHBOARD'],
  async run({ open, url }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };

    // What Watching says each person's watched goals need: the dashboard must agree with it.
    const watchNeeds = {};
    for (const who of ['maya', 'elena']) {
      const [c, p] = await open(1280, 900, who, '/watching');
      const needs = await rowsIn(p.locator('.split-a section').filter({ has: p.getByRole('heading', { name: /^Needs attention/ }) }));
      const handled = await rowsIn(p.locator('section.handled-block'));
      watchNeeds[who] = needs.length;
      // [ATTENTION-HANDLED] The north star was noted in last week's review after its latest check-in: being handled.
      check(handled.some((t) => /Intake-to-delivery time/.test(t) && /Noted in Platform weekly review, week 43/.test(t) && /At risk/.test(t)), `[ATTENTION-HANDLED] ${who}'s Watching does not show the north star as being handled, with what's in hand and its status`);
      check(!needs.some((t) => /Intake-to-delivery time/.test(t)), `[ATTENTION-HANDLED] ${who}'s Watching still lists the handled north star under Needs attention`);
      check(needs.some((t) => /Repo-access controls/.test(t)), `[ATTENTION-HANDLED] ${who}'s Watching lost the off-track goal nobody has looked at`);
      const shape = await p.locator('section.handled-block .trow-icon svg.status-shape').count();
      check(shape >= 1, `[ATTENTION-HANDLED] being-handled rows on ${who}'s Watching have no status shape`);
      const lede = await p.locator('.page.watching .lede').innerText();
      check(/\d+ need(s)? attention · 1 being handled/.test(lede), `[ATTENTION-HANDLED] the Watching summary does not count what is being handled ("${lede}")`);
      await c.close();
    }

    // [HOME-DASHBOARD] The strip and the two lists, for owners and a leader, at a phone, a tablet and a desktop.
    for (const who of ['kofi', 'maya', 'elena']) {
      for (const w of [390, 768, 1280]) {
        const [c, p] = await open(w, 900, who, '/', w < 800);
        const at = `${who} at ${w}`;
        const head = await box(p, '.page.home > .page-head'), dash = await box(p, '.page.home > .dash'), grid = await box(p, '.page.home > .home-grid');
        check(dash && head && grid && dash.y >= head.b && dash.b <= grid.y, `[HOME-DASHBOARD] ${at}: the strip is not between the heading and the rest of Home`);
        check(dash && grid && Math.abs(dash.x - grid.x) <= 1 && Math.abs(dash.w - grid.w) <= 1, `[HOME-DASHBOARD] ${at}: the strip is not on the page's one left edge and width`);
        const cells = await p.$$eval('.dash .dash-cell', (els) => els.map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), h: r.height, bg: cs.backgroundColor, text: e.innerText, href: e.getAttribute('href') || '' }; }));
        const owner = who !== 'elena';
        check(cells.length === (owner ? 4 : 3), `[HOME-DASHBOARD] ${at}: ${cells.length} cells`);
        const rows = new Set(cells.map((x) => x.y)).size, cols = new Set(cells.map((x) => x.x)).size;
        if (w === 1280) check(rows === 1 && dash.h <= 140, `[HOME-DASHBOARD] ${at}: not one slim row (${rows} rows, ${dash && Math.round(dash.h)}px)`);
        if (w === 390) check(cols === 2 && rows === 2 && dash.h <= 140, `[HOME-DASHBOARD] ${at}: not a slim two by two (${cols} columns, ${rows} rows, ${dash && Math.round(dash.h)}px)`);
        // On a phone the strip leaves the week's one action in the first screen.
        if (w === 390) { const hero = await box(p, '.home-hero .btn.primary'); check(!hero || hero.b <= 900 - 90, `[HOME-DASHBOARD] ${at}: the week's main action is pushed below the first screen`); }
        check(cells.every((x) => x.h >= 44), `[HOME-DASHBOARD] ${at}: a cell is under 44px`);
        // No tinted tiles: every cell is the plain card surface, the same for all of them.
        const surface = await p.evaluate(() => { const e = document.createElement('i'); e.style.background = 'var(--surface)'; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; });
        check(cells.every((x) => x.bg === surface), `[HOME-DASHBOARD] ${at}: a cell is tinted (${cells.map((x) => x.bg).join(', ')}, surface ${surface})`);
        // Your goals (or all goals for a leader) by status: each count is a shape and a word, and they add up.
        const counts = await p.$$eval('.dash-count', (els) => els.map((e) => ({ shape: !!e.querySelector('svg.status-shape'), text: e.innerText.trim() })));
        check(counts.length > 0 && counts.every((x) => x.shape && /^\d+ /.test(x.text)), `[HOME-DASHBOARD] ${at}: a status count lacks its shape or number`);
        check(counts.every((x) => STATUS_WORD.test(x.text)), `[HOME-DASHBOARD] ${at}: a status count lacks its word`);
        const total = Number(((cells[0]?.text || '').match(/· (\d+)/) || [])[1]);
        check(counts.reduce((n, x) => n + parseInt(x.text, 10), 0) === total, `[HOME-DASHBOARD] ${at}: the counts don't add up to ${total}`);
        check(owner ? /Your goals/.test(cells[0].text) && /\/goals\?show=mine$/.test(cells[0].href) : /All goals/.test(cells[0].text), `[HOME-DASHBOARD] ${at}: the first cell is not ${owner ? 'your goals, linking to them' : 'all goals'}`);
        check(owner === cells.some((x) => /On-time streak\s+\d+ weeks?/.test(x.text)), `[HOME-DASHBOARD] ${at}: the on-time streak is ${owner ? 'missing' : 'shown to someone with no goals'}`);
        const watch = cells.find((x) => /^Watching/.test(x.text));
        if (who === 'kofi') check(watch && /Nothing yet/.test(watch.text), `[HOME-DASHBOARD] ${at}: Kofi watches nothing but the cell says otherwise`);
        else check(watch && /\/watching$/.test(watch.href) && new RegExp(`${watchNeeds[who]} needs? attention`).test(watch.text) && (w < 1280 || /1 being handled/.test(watch.text)), `[HOME-DASHBOARD] ${at}: the Watching cell does not match Watching (${watchNeeds[who]} need attention, 1 being handled): "${watch && watch.text.replace(/\n/g, ' ')}"`);
        const rev = cells.find((x) => /Next review/.test(x.text));
        check(rev && /Platform weekly review/.test(rev.text) && /Thursday/.test(rev.text) && /\/reviews\/weekly$/.test(rev.href), `[HOME-DASHBOARD] ${at}: the next review is not Platform weekly review, Thursday`);
        // One primary action on the screen, and no sideways scroll.
        const primaries = await p.$$eval('.btn.primary', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; }).length);
        check(primaries <= 1, `[HOME-DASHBOARD] ${at}: ${primaries} primary actions in view`);
        check(await noSideways(p), `[HOME-DASHBOARD] ${at}: sideways scroll`);
        // What you own and what you watch.
        const h2 = (await p.locator('.page.home h2').allInnerTexts()).map((t) => t.replace(/\s*\d+$/, '').trim());
        check(owner === h2.includes('Your goals'), `[HOME-DASHBOARD] ${at}: "Your goals" is ${owner ? 'missing' : 'shown with no goals'}`);
        check((who !== 'kofi') === h2.includes('Goals you watch'), `[HOME-DASHBOARD] ${at}: "Goals you watch" is ${who === 'kofi' ? 'shown with nothing watched' : 'missing'}`);
        if (who !== 'kofi') {
          // Exceptions first, being handled folded away under them.
          const fold = p.locator('details.handled-fold').last();
          check(await fold.count() === 1 && !(await fold.evaluate((d) => d.open)), `[ATTENTION-HANDLED] ${at}: being handled is not folded on Home`);
          const summary = await fold.locator('summary').innerText().catch(() => '');
          check(/Being handled · 1/.test(summary), `[ATTENTION-HANDLED] ${at}: the fold says "${summary}"`);
          const watched = section(p, 'Goals you watch');
          const first = await watched.locator('.tree .trow').first().getAttribute('data-tone').catch(() => null);
          check(['off', 'risk', 'stale'].includes(first), `[HOME-DASHBOARD] ${at}: Goals you watch does not lead with an exception (${first})`);
          if (w === 1280) {
            await fold.locator('summary').click();
            const row = await fold.locator('.trow').first().innerText().catch(() => '');
            check(/At risk/.test(row) && /Intake-to-delivery time/.test(row) && /Noted in Platform weekly review, week 43/.test(row), `[ATTENTION-HANDLED] ${at}: the folded row does not show its status and what's in hand`);
          }
        }
        if (who === 'maya') {
          const mine = await section(p, 'Your goals').locator('.alist .arow-title').allInnerTexts();
          check(!mine.includes('Intake-to-delivery time') && mine.includes('Requests triaged within 2 days'), `[ATTENTION-HANDLED] ${at}: Maya's goals that need attention are ${mine.join(', ')}`);
        }
        await c.close();
      }
    }

    // [ATTENTION-HANDLED] The Goals list's "Needs attention" view lists what's being handled apart.
    {
      const [c, p] = await open(1280, 900, 'elena', '/goals?show=attention');
      const text = await p.locator('.page').first().innerText();
      check(/Being handled/.test(text) && text.indexOf('Being handled') < text.lastIndexOf('Intake-to-delivery time'), '[ATTENTION-HANDLED] Goals › Needs attention does not list the handled north star under Being handled');
      await c.close();
    }

    // [ATTENTION-HANDLED] A review action on the red goal puts it in hand; Aisha's next check-in makes it news again.
    {
      const [c, p] = await open(1280, 900, 'elena', '/goals/access?review=weekly');
      const watchState = async () => {
        await p.goto(url('/watching'));
        await p.locator('.page.watching').waitFor();
        await p.waitForTimeout(200);
        const needs = await rowsIn(p.locator('.split-a section').filter({ has: p.getByRole('heading', { name: /^Needs attention/ }) }));
        const handled = await rowsIn(p.locator('section.handled-block'));
        return { needs: needs.some((t) => /Repo-access controls/.test(t)), handled: handled.find((t) => /Repo-access controls/.test(t)) || '' };
      };
      const before = await watchState();
      check(before.needs && !before.handled, '[ATTENTION-HANDLED] before the review, the red goal is not under Needs attention');
      await p.goto(url('/goals/access?review=weekly'));
      await p.locator('.decide').waitFor();
      await p.getByRole('button', { name: 'Add an action' }).click();
      const dlg = p.getByRole('dialog');
      await dlg.getByPlaceholder('What needs doing').fill('Chase the vendor for the SEC-88 fix date');
      await dlg.getByLabel('Who').selectOption('aisha');
      await dlg.getByLabel(/^By/).selectOption('46');
      await dlg.getByRole('button', { name: 'Save action' }).click();
      await p.locator('.said').getByText('Chase the vendor').waitFor();
      const after = await watchState();
      check(!after.needs && /Off track/.test(after.handled) && /Action: Aisha, due week 46/.test(after.handled), `[ATTENTION-HANDLED] after the action the red goal is not being handled with "Action: Aisha, due week 46" and its status ("${after.handled.replace(/\n/g, ' ')}")`);
      await p.goto(url('/'));
      await p.locator('.dash-watch').waitFor();
      const cell = await p.locator('.dash-watch').innerText();
      check(/1 needs attention/.test(cell) && /2 being handled/.test(cell), `[ATTENTION-HANDLED] Elena's strip does not move it to being handled ("${cell.replace(/\n/g, ' ')}")`);
      // Aisha checks in again: new information.
      await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'aisha'));
      await p.goto(url('/check-in/access'));
      await p.getByRole('button', { name: 'Continue' }).click();
      await p.getByRole('button', { name: /Still true: post check-in/ }).click();
      await p.getByText('Check-in saved').first().waitFor().catch(() => {});
      await p.evaluate(() => localStorage.setItem('goals-app-viewer:example', 'elena'));
      const again = await watchState();
      check(again.needs && !again.handled, '[ATTENTION-HANDLED] after a new check-in the red goal is not back under Needs attention');
      await c.close();
    }
    return fails;
  },
};
