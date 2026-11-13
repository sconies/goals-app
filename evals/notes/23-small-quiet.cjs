/* N28: small workspaces, quiet (SM2; docs/design/round-4/small-workspaces/spec.md 2.4 and rule 2). [SMALL-QUIET] No "0"
   beside a Goals tab or a menu row at 390 and 1440, for several of the demo's people; and the empty Watching page says
   what watching is for, with no primary button. */
const PEOPLE = ['tunde', 'rhea', 'oskar', 'mateo', 'grace', 'camille'];
const SIZES = [[390, 844, true], [1440, 900, false]];

module.exports = {
  id: 'N28',
  area: 'shell',
  title: 'Small workspaces, quiet: no nought beside a tab or a menu row, and the empty Watching page says when you’d want it',
  reqs: ['SMALL-QUIET'],
  async run({ open, url }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };
    let emptySeen = false;
    for (const who of PEOPLE) for (const [w, h, touch] of SIZES) {
      const [c, p] = await open(w, h, who, '/goals?scope=all', touch);
      try {
        await p.locator('[role="tablist"][aria-label="Whose goals"]').first().waitFor({ timeout: 8000 }).catch(() => {});
        const noughts = await p.evaluate(() => [...document.querySelectorAll('.tabcount, .side .nav .count, .tabbar .count')].filter((e) => e.getClientRects().length && e.textContent.trim() === '0').map((e) => (e.closest('[role="tab"], a, button')?.textContent || '').trim()));
        check(!noughts.length, `${who}, ${w}px: a nought is printed beside ${noughts.join(', ')}`);
      } finally { await c.close(); }
    }
    // Someone in the demo who watches nothing: found in the workspace itself, then shown the empty Watching page.
    {
      const [c, p] = await open(1440, 900, 'tunde', '/', false);
      const nobody = await p.evaluate(async () => { const s = await window.__goalsStore.load('platform-org'); const w = new Set((s.watches || []).filter((x) => !x.removedAt).map((x) => x.personId)); return (s.people.find((x) => !w.has(x.id) && !x.leftAt && !x.removedAt) || {}).id || null; });
      await c.close();
      check(!!nobody, 'everyone in the demo watches something, so the empty Watching page could not be seen');
      if (nobody) {
        const [c2, q] = await open(1440, 900, nobody, '/goals?scope=watching', false);
        try {
          const empty = q.locator('.watch-empty');
          await empty.first().waitFor({ timeout: 8000 }).catch(() => {});
          emptySeen = (await empty.count()) > 0;
          check(emptySeen, `${nobody} watches nothing, but Goals' Watching tab shows no empty page (${q.url().replace(/^.*\/demo/, '')}: ${((await q.locator('main').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 400)})`);
          if (emptySeen) {
            const text = await empty.innerText();
            check(/You’re not watching anything/.test(text) && !/anything yet/.test(text), `${nobody}: the empty Watching page's heading reads “${text.split('\n')[0]}”`);
            check(/Watch is on (every|a) goal’s page/.test(text), `${nobody}: the empty Watching page doesn't say where Watch is`);
            check(!(await empty.locator('.btn.primary').count()), `${nobody}: the empty Watching page has a primary button`);
          }
        } finally { await c2.close(); }
      }
    }
    return fails;
  },
};
