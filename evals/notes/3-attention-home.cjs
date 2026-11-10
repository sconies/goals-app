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
    // Amara (a leader who watches the north stars and SVP goals) has one goal behind with an action agreed since its
    // latest check-in: being handled. Daniel's Jenkins goal was only marked reviewed in the fortnightly, which since Lane's
    // call of 10 Nov is a look, not a plan: it still needs attention. The red goal nobody has looked at is Merge-to-deploy time.
    const IN_HAND = { amara: { title: 'Critical and high vulnerabilities fixed within SLA', said: 'Action: Farah, due week 48' } };
    const LOOKED = { daniel: 'Jenkins jobs still running' };
    const watchNeeds = {};
    {
      const [c, p] = await open(1280, 900, 'daniel', '/watching');
      const needs = await rowsIn(p.locator('section.block').filter({ has: p.getByRole('heading', { name: /^Needs attention/ }) }));
      watchNeeds.daniel = needs.length;
      check(needs.some((t) => t.includes(LOOKED.daniel)) && !(await p.locator('section.handled-block').count()), `[ATTENTION-HANDLED] Daniel's Watching doesn't list ${LOOKED.daniel} (only reviewed) under Needs attention`);
      await c.close();
    }
    for (const who of ['amara']) {
      const [c, p] = await open(1280, 900, who, '/watching');
      const needs = await rowsIn(p.locator('section.block').filter({ has: p.getByRole('heading', { name: /^Needs attention/ }) }));
      const handled = await rowsIn(p.locator('section.handled-block'));
      watchNeeds[who] = needs.length;
      // [ATTENTION-HANDLED] A goal looked at in a review (or given an action) after its latest check-in: being handled.
      const mine = IN_HAND[who];
      check(handled.some((t) => t.includes(mine.title) && t.includes(mine.said) && /At risk/.test(t)), `[ATTENTION-HANDLED] ${who}'s Watching does not show ${mine.title} as being handled, with what's in hand and its status`);
      check(!needs.some((t) => t.includes(mine.title)), `[ATTENTION-HANDLED] ${who}'s Watching still lists ${mine.title} under Needs attention`);
      check(needs.some((t) => /Merge-to-deploy time/.test(t)), `[ATTENTION-HANDLED] ${who}'s Watching lost the off-track goal nobody has looked at`);
      const shape = await p.locator('section.handled-block .trow-icon svg.status-shape').count();
      check(shape >= 1, `[ATTENTION-HANDLED] being-handled rows on ${who}'s Watching have no status shape`);
      const lede = await p.locator('.page.watching .lede').innerText();
      check(/\d+ need(s)? attention( \(\d+ with no recent update\))? · 1 being handled/.test(lede), `[ATTENTION-HANDLED] the Watching summary does not count what is being handled ("${lede}")`);
      await c.close();
    }

    // [HOME-DASHBOARD] The strip and the two lists, for owners and a leader, at a phone, a tablet and a desktop.
    // (Diego owns two goals, watches nothing and is in the Developer Productivity fortnightly.)
    for (const who of ['diego', 'daniel', 'amara']) {
      for (const w of [390, 768, 1280]) {
        const [c, p] = await open(w, 900, who, '/', w < 800);
        const at = `${who} at ${w}`;
        const head = await box(p, '.page.home > .page-head'), dash = await box(p, '.page.home > .dash'), grid = await box(p, '.page.home > .home-grid');
        check(dash && head && grid && dash.y >= head.b && dash.b <= grid.y, `[HOME-DASHBOARD] ${at}: the strip is not between the heading and the rest of Home`);
        check(dash && grid && Math.abs(dash.x - grid.x) <= 1 && Math.abs(dash.w - grid.w) <= 1, `[HOME-DASHBOARD] ${at}: the strip is not on the page's one left edge and width`);
        const cells = await p.$$eval('.dash .dash-cell', (els) => els.map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), h: r.height, bg: cs.backgroundColor, text: e.innerText, href: e.getAttribute('href') || '' }; }));
        const owner = who !== 'amara';
        // (One Watching: the strip no longer has a Watching cell; what you watch is the “Goals you watch” block under it.)
        check(cells.length === (owner ? 3 : 2), `[HOME-DASHBOARD] ${at}: ${cells.length} cells`);
        const rows = new Set(cells.map((x) => x.y)).size, cols = new Set(cells.map((x) => x.x)).size;
        if (w === 1280) check(rows === 1 && dash.h <= 140, `[HOME-DASHBOARD] ${at}: not one slim row (${rows} rows, ${dash && Math.round(dash.h)}px)`);
        // (Three cells for an owner make a two by two; a leader has two now that Watching has no cell, so one row of two.)
        if (w === 390) check(cols === 2 && rows === (owner ? 2 : 1) && dash.h <= 140, `[HOME-DASHBOARD] ${at}: not a slim ${owner ? 'two by two' : 'row of two'} (${cols} columns, ${rows} rows, ${dash && Math.round(dash.h)}px)`);
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
        check(!cells.some((x) => /^Watching/.test(x.text)), `[HOME-DASHBOARD] ${at}: the strip still has a Watching cell`);
        if (who === 'diego') check(!(await p.getByRole('heading', { name: /^Goals you watch/ }).count()), `[HOME-DASHBOARD] ${at}: Diego watches nothing but Home shows Goals you watch`);
        else {
          const block = await section(p, 'Goals you watch').innerText();
          check(new RegExp(`${watchNeeds[who]} need attention`).test(block) && /\/goals\?show=watching/.test((await section(p, 'Goals you watch').locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')).join(' ')))), `[HOME-DASHBOARD] ${at}: Goals you watch does not match Watching (${watchNeeds[who]} need attention): "${block.replace(/\n/g, ' ').slice(0, 160)}"`);
        }
        const rev = cells.find((x) => /Next review/.test(x.text));
        const [revName, revDay, revId] = who === 'diego' ? ['Developer Productivity fortnightly', 'Tuesday', 'devprod'] : ['Platform leadership weekly', 'Thursday', 'weekly'];
        check(rev && rev.text.includes(revName) && rev.text.includes(revDay) && rev.href.endsWith('/reviews/' + revId), `[HOME-DASHBOARD] ${at}: the next review is not ${revName}, ${revDay}`);
        // One primary action on the screen, and no sideways scroll.
        const primaries = await p.$$eval('.btn.primary', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; }).length);
        check(primaries <= 1, `[HOME-DASHBOARD] ${at}: ${primaries} primary actions in view`);
        check(await noSideways(p), `[HOME-DASHBOARD] ${at}: sideways scroll`);
        // What you own and what you watch.
        const h2 = (await p.locator('.page.home h2').allInnerTexts()).map((t) => t.replace(/\s*\d+$/, '').trim());
        check(owner === h2.includes('Your goals'), `[HOME-DASHBOARD] ${at}: "Your goals" is ${owner ? 'missing' : 'shown with no goals'}`);
        check((who !== 'diego') === h2.includes('Goals you watch'), `[HOME-DASHBOARD] ${at}: "Goals you watch" is ${who === 'diego' ? 'shown with nothing watched' : 'missing'}`);
        if (who === 'daniel') check(!(await p.locator('details.handled-fold').count()), `[ATTENTION-HANDLED] ${at}: Daniel has nothing being handled, but Home shows the fold`);
        if (who === 'amara') {
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
            check(/At risk/.test(row) && row.includes(IN_HAND[who].title) && row.includes(IN_HAND[who].said), `[ATTENTION-HANDLED] ${at}: the folded row does not show its status and what's in hand`);
          }
        }
        await c.close();
      }
    }
    // [ATTENTION-HANDLED] An owner's own list keeps a goal that was only looked at: Chen's Jenkins goal was marked reviewed
    // in the fortnightly, with no action, so it still needs attention (Lane, 10 Nov). His integration-tests goal heads for
    // 88–90% against 90%, which isn't heading short since deep review T5, so it doesn't.
    {
      const [c, p] = await open(1280, 900, 'chen', '/');
      const mine = await section(p, 'Your goals').locator('.alist .arow-title').allInnerTexts();
      check(mine.includes('Jenkins jobs still running') && !mine.includes('Changes shipped with automated integration tests'), `[ATTENTION-HANDLED] Chen's goals that need attention are ${mine.join(', ')}`);
      await c.close();
    }

    // [ATTENTION-HANDLED] The Goals list's "Needs attention" view lists what's being handled apart.
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals?show=attention');
      const text = await p.locator('.page').first().innerText();
      check(/Being handled/.test(text) && text.indexOf('Being handled') < text.lastIndexOf('Critical and high vulnerabilities fixed within SLA'), '[ATTENTION-HANDLED] Goals › Needs attention does not list the handled north star under Being handled');
      await c.close();
    }

    // [ATTENTION-HANDLED] A review action on the red goal puts it in hand; Pavel's next check-in makes it news again.
    // (The red goal is Merge-to-deploy time, an SVP goal in the leadership weekly, owned by Pavel.)
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals/lead-merge?review=weekly');
      const watchState = async () => {
        await p.goto(url('/watching'));
        await p.locator('.page.watching').waitFor();
        await p.waitForTimeout(200);
        const needs = await rowsIn(p.locator('section.block').filter({ has: p.getByRole('heading', { name: /^Needs attention/ }) }));
        const handled = await rowsIn(p.locator('section.handled-block'));
        return { needs: needs.some((t) => /Merge-to-deploy time/.test(t)), handled: handled.find((t) => /Merge-to-deploy time/.test(t)) || '' };
      };
      const stripCounts = async () => {
        await p.goto(url('/'));
        const block = section(p, 'Goals you watch');
        await block.waitFor();
        const cell = (await block.innerText()).replace(/\n/g, ' ');
        const fold = (await block.locator('details.handled-fold summary').innerText().catch(() => '')).replace(/\n/g, ' ');
        return { needs: Number((cell.match(/(\d+) needs? attention/) || [])[1]), handled: Number((fold.match(/Being handled · (\d+)/) || [])[1]), cell: cell.slice(0, 120) + ' / ' + fold };
      };
      const before = await watchState();
      check(before.needs && !before.handled, '[ATTENTION-HANDLED] before the review, the red goal is not under Needs attention');
      const strip0 = await stripCounts();
      await p.goto(url('/goals/lead-merge?review=weekly'));
      await p.locator('.decide').waitFor();
      // An off-track goal asks what happens next (deep review P2): a next step, its owner found by searching.
      await p.getByRole('button', { name: 'Add the next step' }).click();
      const dlg = p.getByRole('dialog');
      await dlg.getByPlaceholder('What needs doing').fill('Chase the vendor for the batching fix date');
      await dlg.getByRole('searchbox', { name: /^Who/ }).fill('Pavel');
      await dlg.getByRole('radio', { name: /Pavel/ }).click();
      await dlg.getByLabel(/^By/).selectOption('46');
      await dlg.getByRole('button', { name: 'Save the next step' }).click();
      await p.locator('.said').getByText('Chase the vendor').waitFor();
      const after = await watchState();
      check(!after.needs && /Off track/.test(after.handled) && /Action: Pavel, due week 46/.test(after.handled), `[ATTENTION-HANDLED] after the action the red goal is not being handled with "Action: Pavel, due week 46" and its status ("${after.handled.replace(/\n/g, ' ')}")`);
      const strip1 = await stripCounts();
      check(strip1.needs === strip0.needs - 1 && strip1.handled === strip0.handled + 1, `[ATTENTION-HANDLED] Amara's strip does not move it to being handled (${strip0.needs} need attention, ${strip0.handled} handled before; "${strip1.cell}")`);
      // Pavel checks in again: new information.
      await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'pavel'));
      const last = await p.evaluate(async () => { const s = await window.__goalsStore.load('platform-org'); return s.checkIns.filter((x) => x.goalId === 'lead-merge').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1).value; });
      await p.goto(url('/check-in/lead-merge'));
      await p.getByLabel('This week’s value').fill(String(last));
      await p.getByRole('button', { name: 'Continue' }).click();
      await p.getByRole('button', { name: /Still true: post check-in/ }).click();
      await p.getByText('Check-in saved').first().waitFor().catch(() => {});
      await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'amara'));
      const again = await watchState();
      check(again.needs && !again.handled, '[ATTENTION-HANDLED] after a new check-in the red goal is not back under Needs attention');
      await c.close();
    }
    // Review F13: the first-check-in note counts the whole workspace, whatever Goals is narrowed to, and says so.
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals?show=mine');
      const note = p.locator('.first-reports');
      if (await note.count()) {
        const t = (await note.innerText()).trim();
        check(/^Across the whole workspace, \d+ of \d+ goals have had their first check-in\./.test(t), `F13: the first-check-in note doesn't say it counts the whole workspace: "${t.slice(0, 90)}"`);
      }
      await c.close();
    }
    // ---------- Deep review T4 and T5 (10 Nov), on the talk's day: /demo?today=2026-11-11 ----------
    const talk = (route) => url(route).replace(/today=[\d-]+/, 'today=2026-11-11');
    // T4: Home gives the workspace's deadline as a deadline, and names a review only when it's one the person is in.
    for (const who of ['rhea', 'tunde']) {
      const [c, p] = await open(1280, 900, who, '/');
      await p.goto(talk('/'));
      await p.locator('.home-hero').waitFor();
      const t = await p.locator('main').innerText();
      check(!/[A-Z][a-z]+day’s review|before the review|in the review as you wrote/.test(t), `T4 ${who}: Home calls the deadline a review: "${(t.match(/[^\n]*(day’s review|before the review|in the review as you wrote)[^\n]*/) || [''])[0]}"`);
      check(/Check-ins (are|were) due/.test(await p.locator('.home-hero').innerText()), `T4 ${who}: the main action doesn't say when check-ins are due`);
      // The "Not held yet" tile's warning mark is a small sign beside its words, not a picture filling the tile.
      const mark = await box(p, '.dash-missed .dash-label svg');
      if (who === 'rhea') check(!!mark && mark.w <= 16 && mark.h <= 16, `Home: the "Not held yet" warning mark is ${mark ? `${Math.round(mark.w)}×${Math.round(mark.h)}px` : 'missing'}`);
      await c.close();
    }
    // T5: Rhea posts on-plan numbers, as the script's step 2 does. No "Getting worse" says three equal steps, and none
    // says a goal heads short when the range it heads for includes the target.
    {
      const [c, p] = await open(1280, 900, 'rhea', '/');
      await p.goto(talk('/quick-check-in'));
      const rows = p.locator('input');
      await rows.first().waitFor();
      // Each row's plan for this week, typed as it is shown ("Plan 28 hours"), skipping a limit (≤) and a milestone.
      const plans = await p.evaluate(() => [...document.querySelectorAll('input')].map((i) => { let el = i; let txt = ''; while (el && !/Plan /.test(txt)) { el = el.parentElement; txt = el?.innerText ?? ''; } const m = /Plan ([\d.,]+)/.exec(txt); return m && !/Plan ≤/.test(txt) ? m[1].replace(/,/g, '') : null; }));
      let typed = 0;
      for (let i = 0; i < plans.length; i++) if (plans[i]) { await rows.nth(i).fill(plans[i]); typed++; }
      check(typed >= 3, `T5: typed ${typed} on-plan numbers`);
      await p.getByRole('button', { name: /^Post/ }).click();
      await p.waitForURL((u) => !/quick-check-in/.test(u.pathname), { timeout: 5000 }).catch(() => check(false, 'T5: the on-plan check-ins did not post'));
      await p.goto(talk('/'));
      await p.locator('.home-mine').waitFor();
      const mine = await p.locator('.home-mine').innerText();
      check(!/on plan → on plan → on plan/.test(mine), 'T5: Home says "Getting worse … on plan → on plan → on plan"');
      for (const m of mine.matchAll(/heads for ([\d.,]+)–([\d.,]+)\S* .*?target of ([\d.,]+)/g)) {
        const [lo, hi, t] = m.slice(1).map((v) => Number(v.replace(/,/g, '')));
        check(t < lo || t > hi, `T5: "Getting worse" though the range includes the target: ${m[0]}`);
      }
      for (const m of mine.matchAll(/Further behind plan[^:]*: (.+?) → .+? → (.+?) \(/g)) check(m[1] !== m[2] && /behind$/.test(m[2]), `T5: "Getting worse" with no visible change: ${m[0]}`);
      await c.close();
    }

    return fails;
  },
};
