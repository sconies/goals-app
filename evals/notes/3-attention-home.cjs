/* N3: Lane's review notes (5 Nov), attention-home. run({ open, url, browser }) returns a list of failures.
   [ATTENTION-HANDLED] "Needs attention" means new since someone looked; a goal behind but looked at since its latest
   check-in is "Being handled", with what's in hand, everywhere. [HOME-OWNER] Home opens on what is asked of you today, or
   one quiet line; your goals are counted once, in "Your goals", each count opening exactly those goals; and it shows what
   you own and what you watch. */
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
  reqs: ['ATTENTION-HANDLED', 'HOME-OWNER'],
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

    // [HOME-OWNER] The lead, the counts in Your goals and the two lists, for owners and a leader, at a phone, a tablet and a desktop.
    // (Diego owns two goals, watches nothing and is in the Developer Productivity fortnightly.)
    for (const who of ['diego', 'daniel', 'amara']) {
      for (const w of [390, 768, 1280]) {
        const [c, p] = await open(w, 900, who, '/', w < 800);
        const at = `${who} at ${w}`;
        const head = await box(p, '.page.home > .page-head'), dash = await box(p, '.page.home > .dash'), grid = await box(p, '.page.home > .home-grid');
        // This week's cell (a review you're in), when there is one: between the heading and the rest, on the page's one edge.
        if (dash) {
          check(head && grid && dash.y >= head.b && dash.b <= grid.y, `[HOME-OWNER] ${at}: This week is not between the heading and the rest of Home`);
          check(grid && Math.abs(dash.x - grid.x) <= 1 && Math.abs(dash.w - grid.w) <= 1, `[HOME-OWNER] ${at}: This week is not on the page's one left edge and width`);
          const cells = await p.$$eval('.dash .dash-cell', (els) => els.map((e) => ({ h: e.getBoundingClientRect().height, bg: getComputedStyle(e).backgroundColor, text: e.innerText })));
          check(cells.every((x) => x.h >= 44), `[HOME-OWNER] ${at}: a cell is under 44px`);
          // No tinted tiles: every cell is the plain card surface.
          const surface = await p.evaluate(() => { const e = document.createElement('i'); e.style.background = 'var(--surface)'; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; });
          check(cells.every((x) => x.bg === surface), `[HOME-OWNER] ${at}: a cell is tinted`);
          check(!cells.some((x) => /Your goals|All goals|streak|None you’re in/.test(x.text)), `[HOME-OWNER] ${at}: This week still counts goals or the streak`);
        }
        const owner = who !== 'amara';
        // On a phone the week's one action, when there is one, is in the first screen.
        if (w === 390) { const hero = await box(p, '.home-hero .btn.primary'); check(!hero || hero.b <= 900 - 90, `[HOME-OWNER] ${at}: the week's main action is pushed below the first screen`); }
        // Your goals by status, once, in Your goals: each count is a shape and a word, they add up, and each opens exactly those.
        const counts = await p.$$eval('.home-mine .home-counts a', (els) => els.map((e) => ({ shape: !!e.querySelector('svg.status-shape'), text: e.innerText.trim(), href: e.getAttribute('href') || '' })));
        if (owner) {
          const total = Number(((await section(p, 'Your goals').locator('h2').innerText()).match(/(\d+)/) || [])[1]);
          check(counts.length > 0 && counts.every((x) => x.shape && /^\d+ /.test(x.text) && STATUS_WORD.test(x.text)), `[HOME-OWNER] ${at}: a status count lacks its shape, number or word`);
          check(counts.reduce((n, x) => n + parseInt(x.text, 10), 0) === total, `[HOME-OWNER] ${at}: the counts don't add up to ${total}`);
          check(counts.every((x) => /^\/goals\?scope=mine&status=\w+$/.test(x.href)), `[HOME-OWNER] ${at}: a count doesn't open exactly those goals (${counts.map((x) => x.href).join(' ')})`);
        } else check(!counts.length, `[HOME-OWNER] ${at}: someone who owns no goal is shown counts of goals`);
        // Never a bare /goals link or an old show= address, and none of the words Home no longer says.
        const hrefs = await p.$$eval('.page.home a[href]', (as) => as.map((a) => a.getAttribute('href')));
        check(!hrefs.some((h) => h === '/goals' || /show=/.test(h)), `[HOME-OWNER] ${at}: a link opens a bare /goals or an old address (${hrefs.filter((h) => h === '/goals' || /show=/.test(h)).join(' ')})`);
        const text = await p.locator('.page.home').innerText();
        check(!/You’re all set|None you’re in|\b0 weeks\b/.test(text), `[HOME-OWNER] ${at}: Home says something it no longer says`);
        if (who === 'diego') check(!(await p.getByRole('heading', { name: /^Goals you watch/ }).count()), `[HOME-OWNER] ${at}: Diego watches nothing but Home shows Goals you watch`);
        else {
          const block = await section(p, 'Goals you watch').innerText();
          check(new RegExp(`${watchNeeds[who]} need attention`).test(block) && /\/goals\?scope=watching/.test((await section(p, 'Goals you watch').locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')).join(' ')))), `[HOME-OWNER] ${at}: Goals you watch does not match Watching (${watchNeeds[who]} need attention): "${block.replace(/\n/g, ' ').slice(0, 160)}"`);
        }
        // One primary action on the screen, and no sideways scroll.
        const primaries = await p.$$eval('.btn.primary', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; }).length);
        check(primaries <= 1, `[HOME-OWNER] ${at}: ${primaries} primary actions in view`);
        check(await noSideways(p), `[HOME-OWNER] ${at}: sideways scroll`);
        // What you own and what you watch.
        const h2 = (await p.locator('.page.home h2').allInnerTexts()).map((t) => t.replace(/\s*·?\s*\d+$/, '').trim());
        check(owner === h2.includes('Your goals'), `[HOME-OWNER] ${at}: "Your goals" is ${owner ? 'missing' : 'shown with no goals'}`);
        check((who !== 'diego') === h2.includes('Goals you watch'), `[HOME-OWNER] ${at}: "Goals you watch" is ${who === 'diego' ? 'shown with nothing watched' : 'missing'}`);
        if (who === 'daniel') check(!(await p.locator('details.handled-fold').count()), `[ATTENTION-HANDLED] ${at}: Daniel has nothing being handled, but Home shows the fold`);
        if (who === 'amara') {
          // Exceptions first, being handled folded away under them.
          const fold = p.locator('details.handled-fold').last();
          check(await fold.count() === 1 && !(await fold.evaluate((d) => d.open)), `[ATTENTION-HANDLED] ${at}: being handled is not folded on Home`);
          const summary = await fold.locator('summary').innerText().catch(() => '');
          check(/Being handled · 1/.test(summary), `[ATTENTION-HANDLED] ${at}: the fold says "${summary}"`);
          const watched = section(p, 'Goals you watch');
          const first = await watched.locator('.tree .trow').first().getAttribute('data-tone').catch(() => null);
          check(['off', 'risk', 'stale'].includes(first), `[HOME-OWNER] ${at}: Goals you watch does not lead with an exception (${first})`);
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
      await dlg.locator('.pick').getByRole('button', { name: /Change$|^Who/ }).first().click();
      await dlg.getByRole('combobox', { name: /^Who/ }).fill('Pavel');
      await dlg.getByRole('option', { name: /Pavel/ }).click();
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
    // Review F13: the first-check-in note counts the whole workspace, whatever Goals is narrowed to, and says so. It
    // shows with the Needs attention switch on (goals spec, 2.1, item 6).
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals?scope=watching&attention=1');
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
