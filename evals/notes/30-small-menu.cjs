/* N30: small workspaces, rows and tabs that wait (SM1, rule 1). [SMALL-MENU] In the demo the menu is unchanged (it has a
   metric, so Metrics is a row). On Goals no tab but All is the same list as All, a tab is drawn only with goals in it,
   and every hidden scope's address still opens: ?scope=team (to All when My team waits) and ?scope=watching. In a
   workspace with no metric the Metrics row waits, also when you switch to it from one that has a metric without the
   page reloading (build review of #461: the row once followed you there). */
const PEOPLE = ['rhea', 'tunde', 'oskar', 'hamid', 'grace'];

module.exports = {
  id: 'N30',
  area: 'shell',
  title: 'Small workspaces: a tab or a module’s row waits until it has something in it, and every address still opens',
  reqs: ['SMALL-MENU'],
  async run({ open, url, browser }) {
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
    // A workspace with no metric: no Metrics row, whether opened afresh or switched to from one with metrics.
    {
      const base = url('/').replace(/\/demo\/.*$/, '');
      const live = (p) => base + p + (p.includes('?') ? '&' : '?') + 'store=browser&today=2026-11-05';
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await c.newPage();
      try {
        await p.goto(url('/')); await p.locator('.page-head').first().waitFor();
        await p.evaluate(async () => {
          const full = await window.__goalsStore.load('platform-org');
          const has = { ...full, changes: [] };
          const none = { ...has, modules: { ...(has.modules ?? {}) } };
          delete none.modules.metrics;
          localStorage.setItem('goals-live-v1:workspaces', JSON.stringify([
            { id: 'ws_metrics', name: 'Has metrics', kind: 'own', createdAt: '2026-09-01T00:00:00Z' },
            { id: 'ws_bare', name: 'No metrics', kind: 'own', createdAt: '2026-09-01T00:00:00Z' },
          ]));
          localStorage.setItem('goals-live-v1:ws_metrics', JSON.stringify(has));
          localStorage.setItem('goals-live-v1:ws_bare', JSON.stringify(none));
          localStorage.setItem('goals-live-workspace', 'ws_metrics');
          localStorage.setItem('goals-live-me:ws_metrics', 'amara');
          localStorage.setItem('goals-live-me:ws_bare', 'amara');
        });
        const metricsRow = () => p.locator('.side a.nav', { hasText: 'Metrics' }).count();
        await p.goto(live('/')); await p.locator('.page-head').first().waitFor();
        check(await metricsRow() > 0, 'a workspace with metrics has no Metrics row');
        // Switch without a reload: the switcher at the top of the sidebar.
        await p.locator('.side .ws-switch').click();
        await p.getByRole('dialog', { name: 'Workspaces' }).locator('.ws-pick', { hasText: 'No metrics' }).first().click();
        await p.waitForFunction(() => localStorage.getItem('goals-live-workspace') === 'ws_bare', null, { timeout: 8000 }).catch(() => {});
        await p.locator('.page-head').first().waitFor();
        await p.waitForTimeout(300);
        check(await metricsRow() === 0, 'switched from a workspace with metrics to one with none, the Metrics row followed');
        await p.reload(); await p.locator('.page-head').first().waitFor();
        check(await metricsRow() === 0, 'a workspace with no metric has a Metrics row');
      } catch (e) {
        fails.push(`no metrics: crashed (${String(e.message || e).split('\n')[0]})`);
      } finally { await c.close(); }
    }
    return fails;
  },
};
