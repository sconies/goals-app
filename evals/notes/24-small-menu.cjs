/* N29: small workspaces, rows and tabs that wait (SM1, rule 1). [SMALL-MENU] In the demo the menu is unchanged (it has a
   metric, so Metrics is a row). On Goals no tab but All is the same list as All, a tab is drawn only with goals in it,
   and every hidden scope's address still opens: ?scope=team (to All when My team waits) and ?scope=watching. */
const PEOPLE = ['rhea', 'tunde', 'oskar', 'hamid', 'grace'];

module.exports = {
  id: 'N29',
  area: 'shell',
  title: 'Small workspaces: a tab or a module’s row waits until it has something in it, and every address still opens',
  reqs: ['SMALL-MENU'],
  async run({ open, url }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };
    for (const who of PEOPLE) {
      const [c, p] = await open(1440, 900, who, '/goals?scope=all', false);
      try {
        await p.locator('[role="tablist"][aria-label="Whose goals"]').first().waitFor({ timeout: 8000 }).catch(() => {});
        check(await p.locator('.side a.nav', { hasText: 'Metrics' }).count() > 0, `${who}: the demo's menu has no Metrics row, though it has metrics`);
        const tabs = await p.evaluate(() => [...document.querySelectorAll('[role="tablist"][aria-label="Whose goals"] [role="tab"]:not(.view-tab)')].map((t) => ({ name: t.childNodes[0]?.textContent?.trim() || '', n: Number(t.querySelector('.tabcount')?.textContent || 0) })));
        const all = tabs.find((t) => t.name === 'All');
        check(!!all, `${who}: Goals has no All tab`);
        for (const t of tabs) if (all && t.name !== 'All') {
          check(t.n > 0, `${who}: the ${t.name} tab is drawn with nothing in it`);
          check(t.n !== all.n, `${who}: the ${t.name} tab is drawn though it is the same list as All (${t.n})`);
        }
        for (const scope of ['watching', 'team']) {
          await p.goto(url(`/goals?scope=${scope}`));
          const opened = await p.locator('main').innerText().catch(() => '');
          check(!/doesn’t exist|Not found|Something went wrong/i.test(opened), `${who}: /goals?scope=${scope} does not open`);
        }
      } finally { await c.close(); }
    }
    return fails;
  },
};
