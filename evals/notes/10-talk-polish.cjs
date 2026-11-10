/* N10: the talk-path polish (deep review, 10 Nov; Lane approved 9 Nov, before the talk on 11 Nov). run({ open, url })
   returns a list of failures. One check per finding:
   U28 Goals search finds a goal by its key, however it is typed ("G-48", "g48", "48"), and a key finds only its goal.
   U23 Home's counts by status each open their own filtered Goals list, and the list holds that many goals.
   U24 By team gives each team its goals counted by status (shape and word) and lists the teams worst first.
   U25 "Decision or help needed" names the same goals in the saved view, the Table's story lines and Home's ask.
   U27 On a phone, what someone asked of you in Needs your response wraps to two lines, never cut mid-word.
   D2  Every Board card leads with its own status, a shape and its word, the same as its lane.
   D3  Set-up's small links (Start over, Change, Change people) are 44px to hit on a phone. */
const STATUS = ['off', 'risk', 'stale', 'none'];
const WORD = { off: 'off track', risk: 'at risk', stale: 'no recent update', none: 'no check-in yet', on: 'on track', done: 'done', planned: 'not started' };
const tally = (text) => Object.fromEntries(Object.entries(WORD).map(([k, w]) => [k, Number((new RegExp('(\\d+) ' + w + '\\b').exec(text) || [0, 0])[1])]));
const shownOf = (p) => p.evaluate(() => Number((/(\d+) of \d+ goals?/.exec(document.querySelector('main').innerText) || [0, -1])[1]));
const settle = (p, ms = 700) => p.waitForTimeout(ms);

module.exports = {
  id: 'N10',
  area: 'talk-polish',
  title: 'Talk-path polish: search by key, Home counts that open their goals, teams worst first, one rule for a decision waiting, the Board’s own status, phone wrapping and targets',
  reqs: ['READABLE-IDS', 'SAVED-VIEWS', 'HOME-DASHBOARD', 'VIEWS', 'ONBOARDING'],
  async run({ open, url }) {
    const fails = [];
    const chk = (ok, msg) => { if (!ok) fails.push(msg); };

    // U28: a goal's key finds it.
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals?scope=all');
      const snap = await p.evaluate(() => window.__goalsStore.load('platform-org'));
      const g = snap.goals.find((x) => x.key === 'G-48');
      chk(!!g, 'U28: the example has no G-48');
      if (g) {
        for (const typed of ['G-48', 'g48', '48']) {
          await p.goto(url('/goals?scope=all&q=' + encodeURIComponent(typed)));
          await settle(p);
          const names = await p.evaluate(() => [...document.querySelectorAll('.trow-name')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()));
          chk(names.includes(g.title), `U28: searching “${typed}” doesn't find G-48 (${g.title}); found ${names.length}`);
          if (typed !== '48') chk(names.length === 1, `U28: searching “${typed}” finds ${names.length} goals, not just G-48`);
        }
      }
      await c.close();
    }

    // U23: each count opens its own goals, as a leader (every goal) and as an owner (her own).
    for (const [who, mine] of [['amara', false], ['rhea', true]]) {
      const [c, p] = await open(1280, 900, who, '/');
      const counts = await p.evaluate(() => [...document.querySelectorAll('.dash-goals .dash-count')].map((a) => ({ href: a.getAttribute('href') || '', text: a.textContent.trim(), tag: a.tagName, shape: !!a.querySelector('svg.status-shape') })));
      chk(counts.length > 0 && counts.every((x) => x.tag === 'A' && x.shape), `U23 (${who}): Home's counts are not each a link with a shape: ${JSON.stringify(counts.slice(0, 3))}`);
      for (const x of counts.filter((k) => /off track|at risk/.test(k.text))) {
        const n = Number(x.text.match(/^\d+/)?.[0]);
        chk(/[?&]status=(off|risk)\b/.test(x.href) && (!mine || /show=mine/.test(x.href)), `U23 (${who}): “${x.text}” links to ${x.href}`);
        // Pressed as a person would: the link keeps the demo's pinned date.
        await p.locator('.dash-goals a.dash-count', { hasText: x.text }).first().click();
        await p.waitForURL(/\/goals\?/);
        await settle(p);
        const shown = await shownOf(p);
        chk(shown === n, `U23 (${who}): “${x.text}” opens ${shown} goals`);
        await p.goBack();
        await p.locator('.dash-goals').waitFor();
        await settle(p, 400);
      }
      await c.close();
    }

    // U24: By team, counts on each team and the worst team first.
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals?show=teams');
      const teams = await p.evaluate(() => [...document.querySelectorAll('main section.block')].filter((s) => s.querySelector('.team-counts')).map((s) => ({
        name: s.getAttribute('aria-label'), counts: s.querySelector('.team-counts').innerText.replace(/\s+/g, ' '), rows: s.querySelectorAll('.trow').length,
        shapes: s.querySelectorAll('.team-counts .team-count svg.status-shape').length, items: s.querySelectorAll('.team-counts .team-count').length,
      })));
      chk(teams.length >= 10, `U24: By team shows ${teams.length} teams with counts`);
      for (const t of teams) {
        const k = tally(t.counts), sum = Object.values(k).reduce((a, b) => a + b, 0);
        chk(sum === t.rows && t.items === t.shapes, `U24: ${t.name} counts “${t.counts}” (${sum}) for ${t.rows} goals, ${t.shapes} shapes for ${t.items} counts`);
      }
      const key = (t) => STATUS.map((s) => tally(t.counts)[s]);
      const worse = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
      for (let i = 1; i < teams.length; i++) chk(!worse(key(teams[i]), key(teams[i - 1])), `U24: ${teams[i].name} (${teams[i].counts}) is listed after ${teams[i - 1].name} (${teams[i - 1].counts}) though it is worse`);
      await c.close();
    }

    // U25: the saved view, the Table and Home agree on which goals wait on a decision.
    {
      const [c, p] = await open(1280, 900, 'amara', '/goals?scope=all&needs=decision&sort=worst');
      await settle(p);
      const view = await p.evaluate(() => [...document.querySelectorAll('.trow-name')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()));
      const shown = await shownOf(p);
      chk(view.length > 0 && view.length === shown, `U25: the saved view lists ${view.length} goals and says ${shown}`);
      await p.goto(url('/goals?scope=all&view=table'));
      await settle(p, 1200);
      const labelled = await p.evaluate(() => [...document.querySelectorAll('.table-story-line')].filter((e) => /^Decision or help needed\b/.test(e.textContent.trim())).length);
      chk(labelled === view.length, `U25: Table labels ${labelled} goals “Decision or help needed”, the saved view ${view.length}`);
      await p.goto(url('/'));
      await settle(p);
      const asked = await p.evaluate(() => [...document.querySelectorAll('.needs-you .need-group')].filter((g) => /^Decisions or help/.test(g.querySelector('.need-group-title')?.textContent || '')).flatMap((g) => [...g.querySelectorAll('.need-what')].map((e) => e.textContent.trim())));
      for (const a of asked) chk(view.some((t) => a.startsWith(t)), `U25: Home says “${a}” waits on Amara, but the saved view leaves it out`);
      await c.close();
    }

    // U27: the ask wraps on a phone.
    {
      const [c, p] = await open(390, 844, 'amara', '/', true);
      const q = await p.evaluate(() => [...document.querySelectorAll('.needs-you .need-quote')].map((e) => { const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight); return { text: e.textContent.trim().slice(0, 40), ws: cs.whiteSpace, fits: e.scrollHeight <= e.clientHeight + 1, lines: Math.round(e.getBoundingClientRect().height / lh), long: e.scrollWidth > e.clientWidth + 1 }; }));
      chk(q.length > 0, 'U27: no ask in Needs your response at 390');
      for (const x of q) chk(x.ws !== 'nowrap' && !x.long && x.fits && x.lines <= 2, `U27: “${x.text}” at 390: white-space ${x.ws}, ${x.lines} lines, ${x.fits ? 'fits' : 'cut off'}`);
      await c.close();
    }

    // D2: each Board card says its own status, the same as its lane, on a phone.
    {
      const [c, p] = await open(390, 844, 'amara', '/goals?scope=all&view=board', true);
      await settle(p);
      const bad = await p.evaluate(() => [...document.querySelectorAll('.board-col')].flatMap((col) => {
        const lane = col.querySelector('.board-head').innerText.replace(/\d+\s*$/, '').trim();
        return [...col.querySelectorAll('.board-card')].map((card) => {
          const first = card.firstElementChild, st = first?.querySelector('.board-status');
          const ok = first?.classList.contains('board-top') && st && st.querySelector('svg.status-shape') && st.innerText.trim() === lane;
          return ok ? null : `${card.querySelector('.board-title')?.textContent.slice(0, 30)} says “${st?.innerText.trim() ?? 'nothing'}” in ${lane}`;
        }).filter(Boolean);
      }));
      const cards = await p.locator('.board-card').count();
      chk(cards > 0 && bad.length === 0, `D2: ${bad.length} of ${cards} Board cards don't lead with their status: ${bad.slice(0, 3).join('; ')}`);
      await c.close();
    }

    // D3: set-up's small links are 44px to hit on a phone.
    {
      const [c, r] = await open(390, 844, 'grace', '/workspace/new', true);
      const tall = (name) => r.getByRole('button', { name, exact: true }).first().evaluate((e) => Math.round(e.getBoundingClientRect().height)).catch(() => 0);
      const h0 = await tall('Change');
      chk(h0 >= 44, `D3: set-up's “Change” (the goal year) is ${h0}px tall at 390`);
      await r.getByLabel('Name').first().fill('Test space');
      await r.getByRole('button', { name: 'Next' }).click(); await settle(r, 250);
      await r.getByLabel('Your name').fill('Ana Silva'); await r.getByLabel('Your team').fill('Platform'); await r.getByLabel('Your email').fill('ana.silva@example.com');
      await r.getByRole('button', { name: 'Next' }).click(); await settle(r, 250);
      await r.getByLabel('Person 1: name').fill('Cat Lee'); await r.getByLabel('Person 1: email').fill('cat.lee@example.com');
      await r.getByRole('button', { name: 'Next' }).click(); await settle(r, 250);
      await r.getByRole('radio', { name: /Set goals up later/ }).click();
      await r.getByRole('button', { name: 'Next' }).click(); await settle(r, 400);
      const h1 = await tall('Change people');
      chk(h1 >= 44, `D3: set-up's “Change people” is ${h1}px tall at 390`);
      await r.reload(); await settle(r, 800);
      const h2 = await tall('Start over');
      chk(h2 >= 44, `D3: set-up's “Start over” is ${h2}px tall at 390`);
      await c.close();
    }
    return fails;
  },
};
