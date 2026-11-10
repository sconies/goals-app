/* N4: Lane's review notes (5 Nov), shell-settings. run({ open, url, browser }) returns a list of failures.
   Settings (light, dark or system; an accent colour; a full or icons-only sidebar; your AI assistants), Goals as a
   section of the navigation, no workspace switcher for someone in one workspace, a Back link on detail pages, and an
   admin renaming the workspace and adding, renaming and removing teams. Measured in the built app at phone, tablet and
   desktop widths. */
const round = (n) => Math.round(n * 10) / 10;
/* Faro's page colours (src/styles.css): warm paper in light, deep ink-teal in dark. */
const LIGHT_BG = 'rgb(246, 245, 241)';
const DARK_BG = 'rgb(15, 27, 28)';
const DARK_SURFACE = 'rgb(21, 36, 38)';

/** WCAG contrast of two CSS colours (rgb() or #hex), worked out in the page. */
const CONTRAST = `(a, b) => {
  const rgb = (c) => { const x = document.createElement('i'); x.style.color = c; document.body.appendChild(x); const v = getComputedStyle(x).color.match(/[\\d.]+/g).slice(0, 3).map(Number); x.remove(); return v; };
  const L = (c) => { const [r, g, b] = rgb(c).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}`;

module.exports = {
  id: 'N4',
  area: 'shell-settings',
  title: 'Review notes, shell-settings: Settings with theme, accent and sidebar; Goals as a nav section; no switcher for one workspace; Back on detail pages; workspace and team admin; Faro’s name, logo and colours',
  reqs: ['SETTINGS', 'NAV-GOALS', 'WORKSPACE-ADMIN', 'BRAND', 'LAUNCH'],
  async run({ open, url, browser }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };
    const step = async (name, f) => { try { await f(); } catch (e) { fails.push(`${name}: crashed (${String(e.message || e).split('\n')[0]})`); } };
    const base = url('/').replace(/\/demo\/.*$/, '');
    const live = (p) => base + p + (p.includes('?') ? '&' : '?') + 'store=browser&today=2026-11-05';

    /* ---------- [SETTINGS] the page, reached from the nav and the person menu ---------- */
    await step('settings reached', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/');
      await p.locator('.side').getByRole('link', { name: 'Settings' }).click();
      await p.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 3000 });
      fail(/\/demo\/settings/.test(p.url()), `[SETTINGS] the sidebar's Settings goes to ${p.url()}`);
      fail(await p.getByText(/kept in this browser only/).isVisible(), '[SETTINGS] the page does not say its choices are kept in this browser');
      for (const h of ['Appearance', 'Navigation', 'You', 'Your MCP access']) fail(await p.getByRole('heading', { name: h, exact: true }).isVisible(), `[SETTINGS] no "${h}" section`);
      // The person menu holds Settings too.
      await p.goto(url('/goals')); await p.waitForTimeout(300);
      await p.locator('.side .me').click();
      const menu = p.getByRole('dialog', { name: 'Switch person' });
      await menu.waitFor();
      await menu.getByRole('link', { name: /^Settings/ }).click();
      await p.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 3000 });
      await c.close();
    });
    await step('settings phone', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/', true);
      await p.locator('.tabbar').getByRole('button', { name: 'More' }).tap();
      await p.getByRole('dialog', { name: 'More' }).getByRole('link', { name: /^Settings/ }).tap();
      await p.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 3000 });
      const m = await p.evaluate(() => ({ side: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.settings-page button, .settings-page a')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 40).map((e) => e.textContent.trim()) }));
      fail(m.side <= 1, `[SETTINGS] 390 Settings scrolls sideways by ${m.side}px`);
      fail(!m.small.length, `[SETTINGS] 390 Settings controls under 40px: ${m.small.join(', ')}`);
      await c.close();
    });

    /* ---------- [SETTINGS] theme: computed colours change, survive a reload, and are there before the app's code ---------- */
    await step('theme', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/settings');
      const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const look = p.getByRole('group', { name: 'Light or dark' });
      await look.getByRole('button', { name: 'Dark' }).click();
      fail(await bg() === DARK_BG, `[SETTINGS] Dark: the page is ${await bg()}`);
      const card = await p.evaluate(() => getComputedStyle(document.querySelector('.accent-opt')).backgroundColor);
      fail(card === DARK_SURFACE, `[SETTINGS] Dark: a surface is ${card}`);
      await p.reload(); await p.waitForTimeout(300);
      fail(await bg() === DARK_BG && await look.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed') === 'true', '[SETTINGS] Dark is not kept after a reload');
      // No flash: hold the app's code back and look at the page that's drawn before it.
      // A script held back here may be answered already when it's let go (the page has moved on): that mustn't stop the run.
      await p.route('**/assets/*.js', async (r) => { await new Promise((ok) => setTimeout(ok, 1200)); await r.continue().catch(() => {}); });
      await p.goto(url('/'), { waitUntil: 'commit' });
      await p.locator('.preboot').waitFor({ state: 'attached', timeout: 3000 });
      const early = await p.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, preboot: !!document.querySelector('.preboot') }));
      fail(early.preboot && early.theme === 'dark' && early.bg === DARK_BG, `[SETTINGS] before the app's code runs: ${JSON.stringify(early)} (want dark, no flash of light)`);
      await p.unroute('**/assets/*.js');
      await p.goto(url('/settings')); await p.waitForTimeout(300);
      await look.getByRole('button', { name: 'Light' }).click();
      fail(await bg() === LIGHT_BG, `[SETTINGS] Light: the page is ${await bg()}`);
      await look.getByRole('button', { name: 'System' }).click();
      fail(await p.evaluate(() => !document.documentElement.hasAttribute('data-theme')), '[SETTINGS] System still forces a theme');
      await c.close();
      // System follows the device.
      const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
      const q = await c2.newPage();
      await q.goto(url('/settings')); await q.waitForTimeout(400);
      const sys = await q.evaluate(() => getComputedStyle(document.body).backgroundColor);
      fail(sys === DARK_BG, `[SETTINGS] System on a dark device: the page is ${sys}`);
      await c2.close();
    });

    /* ---------- [SETTINGS] accents: each passes 4.5:1 for text and under its own fill, light and dark, and persists ---------- */
    await step('accents', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/settings');
      const radios = p.getByRole('radiogroup', { name: 'Accent colour' }).getByRole('radio');
      const n = await radios.count();
      fail(n === 5 && /^Faro/.test(await radios.nth(0).textContent()), `[SETTINGS] ${n} accent colours, first “${await radios.nth(0).textContent()}” (want 5, Faro first)`);
      const seen = new Set();
      for (const theme of ['Light', 'Dark']) {
        await p.getByRole('group', { name: 'Light or dark' }).getByRole('button', { name: theme }).click();
        for (let i = 0; i < n; i++) {
          await radios.nth(i).click();
          const m = await p.evaluate((src) => {
            const contrast = eval(src);
            const v = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
            const min = Math.min(...['--bg', '--surface', '--surface-2', '--surface-3', '--accent-soft', '--accent-wash'].map((k) => contrast(v('--accent-text'), v(k))));
            return { name: document.querySelector('.accent-opt[aria-checked="true"]').textContent.trim(), text: v('--accent-text'), min, fill: contrast(v('--accent-fg'), v('--accent')), primary: contrast(v('--primary-fg'), v('--primary')), link: getComputedStyle(document.querySelector('.settings-page a')).color };
          }, CONTRAST);
          seen.add(m.text);
          fail(m.min >= 4.5, `[SETTINGS] ${theme} ${m.name}: accent text ${m.text} is ${round(m.min)}:1 at worst`);
          fail(m.fill >= 4.5 && m.primary >= 4.5, `[SETTINGS] ${theme} ${m.name}: text on its fill is ${round(m.fill)}:1, on a primary button ${round(m.primary)}:1`);
        }
      }
      fail(seen.size === n * 2, `[SETTINGS] accents do not change the colours: ${seen.size} distinct text colours for ${n} accents in 2 themes`);
      await radios.nth(1).click();
      const chosen = await radios.nth(1).textContent();
      await p.reload(); await p.waitForTimeout(300);
      fail(await radios.nth(1).getAttribute('aria-checked') === 'true' && await p.evaluate(() => !!document.documentElement.getAttribute('data-accent')), `[SETTINGS] ${chosen} is not kept after a reload`);
      await c.close();
    });

    /* ---------- [SETTINGS] the sidebar: collapse to the icon rail, named on hover, remembered; the tablet is always a rail ---------- */
    for (const [w, h] of [[1280, 800], [1440, 900]]) {
      await step(`collapse ${w}`, async () => {
        const [c, p] = await open(w, h, 'rhea', '/');
        const width = () => p.evaluate(() => Math.round(document.querySelector('.side').getBoundingClientRect().width));
        const full = await width();
        await p.locator('.side').getByRole('button', { name: /Collapse sidebar/ }).click();
        const rail = await width();
        fail(full >= 220 && rail <= 72, `[SETTINGS] ${w}: the sidebar is ${full}px, collapsed ${rail}px (want about 236 and 68)`);
        await p.reload(); await p.waitForTimeout(300);
        const after = await width();
        const m = await p.evaluate(() => {
          const shown = [...document.querySelectorAll('.side .nav')].filter((n) => n.getClientRects().length);
          return { untitled: shown.filter((n) => !n.getAttribute('title')).map((n) => n.textContent.trim()), wide: shown.filter((n) => n.getBoundingClientRect().width > 52).length, words: shown.filter((n) => [...n.querySelectorAll('span:not(.count)')].some((s) => s.getBoundingClientRect().width > 2)).length, main: Math.round(document.querySelector('main.work').getBoundingClientRect().left) };
        });
        fail(after <= 72, `[SETTINGS] ${w}: collapsed is not remembered (${after}px after a reload)`);
        fail(!m.untitled.length && !m.wide && !m.words, `[SETTINGS] ${w} rail: ${m.untitled.length} icons unnamed on hover, ${m.wide} wider than the rail, ${m.words} still showing words`);
        fail(m.main <= 70, `[SETTINGS] ${w} rail: the work area starts at ${m.main}px`);
        await p.locator('.side').getByRole('button', { name: /full sidebar/ }).click();
        fail(await width() >= 220, `[SETTINGS] ${w}: Show the full sidebar leaves it ${await width()}px`);
        await c.close();
      });
    }
    await step('tablet rail', async () => {
      const [c, p] = await open(1024, 768, 'rhea', '/', true);
      const m = await p.evaluate(() => ({ w: Math.round(document.querySelector('.side').getBoundingClientRect().width), toggle: !!document.querySelector('.side .collapse-nav')?.getClientRects().length, untitled: [...document.querySelectorAll('.side .nav')].filter((n) => n.getClientRects().length && !n.getAttribute('title')).length, watching: !!document.querySelector('.side a.nav.sub[href$="/watching"]')?.getClientRects().length }));
      fail(m.w <= 72 && !m.toggle && !m.untitled && m.watching, `[SETTINGS, NAV-GOALS] 1024: rail ${m.w}px, toggle shown ${m.toggle}, ${m.untitled} unnamed, Watching in the rail ${m.watching}`);
      await c.close();
    });

    /* ---------- [NAV-GOALS] Goals is a section: Mine, Watching, All and saved views; one current place ---------- */
    await step('goals section', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/');
      // A saved view of Maya's and one pinned for everyone, in the example's data.
      // Saved through the store: the demo keeps only its saves on top of the example (DEMO-STORAGE).
      await p.evaluate(async () => {
        const at = '2026-10-29T10:00:00.000Z';
        await window.__goalsStore.commit('platform-org', { views: [{ id: 'view_n4a', personId: 'rhea', name: 'Off track', params: 'status=off', pinned: false, createdAt: at, updatedAt: at, deletedAt: null }, { id: 'view_n4b', personId: 'amara', name: 'North star', params: 'level=north-star', pinned: true, createdAt: at, updatedAt: at, deletedAt: null }], changes: [] });
      });
      await p.reload(); await p.waitForTimeout(300);
      const sub = p.locator('.side .subnav');
      const items = (await sub.getByRole('link').allInnerTexts()).map((x) => x.trim());
      fail(items.slice(0, 3).join(',') === 'Mine,Watching,All' && items.includes('Off track') && items.includes('North star'), `[NAV-GOALS] under Goals: ${items.join(', ')}`);
      fail(items.indexOf('North star') < items.indexOf('Off track'), '[NAV-GOALS] the pinned view is not listed first');
      const current = () => p.evaluate(() => [...document.querySelectorAll('.side [aria-current="page"]')].map((e) => e.textContent.trim()));
      await sub.getByRole('link', { name: 'Mine' }).click(); await p.waitForTimeout(250);
      fail(/show=mine/.test(p.url()) && (await current()).join() === 'Mine', `[NAV-GOALS] Mine: ${p.url()}, current ${await current()}`);
      await sub.getByRole('link', { name: 'Off track' }).click(); await p.waitForTimeout(250);
      fail(/status=off/.test(p.url()) && (await current()).join() === 'Off track', `[NAV-GOALS] a saved view: ${p.url()}, current ${await current()}`);
      await sub.getByRole('link', { name: 'Watching' }).click(); await p.waitForTimeout(250);
      fail(/\/demo\/goals\?(.*&)?show=watching/.test(p.url()) && (await current()).join() === 'Watching', `[NAV-GOALS] Watching: ${p.url()}, current ${await current()}`);
      fail(!(await p.locator('.side > a.nav[href$="/watching"]').count()), '[NAV-GOALS] Watching is still a top-level item');
      await sub.getByRole('link', { name: 'All' }).click(); await p.waitForTimeout(250);
      fail((await current()).join() === 'All', `[NAV-GOALS] All: current ${await current()}`);
      await p.goto(url('/goals/ns-lead')); await p.waitForTimeout(300);
      fail((await current()).join() === 'Goals', `[NAV-GOALS] a goal's page: current ${await current()}`);
      await c.close();
    });
    await step('goals phone', async () => {
      const [c, p] = await open(390, 844, 'rhea', '/', true);
      const tabs = (await p.locator('.tabbar').getByRole('link').allInnerTexts()).map((x) => x.replace(/\d+/g, '').trim());
      fail(tabs.join() === 'Home,Check-in,Goals,Reviews', `[NAV-GOALS] 390 owner's tabs: ${tabs.join(', ')}`);
      await p.locator('.tabbar').getByRole('button', { name: 'More' }).tap();
      const more = p.getByRole('dialog', { name: 'More' });
      fail(await more.getByRole('group', { name: 'Goals' }).getByRole('link', { name: /^Watching/ }).isVisible() && await more.getByRole('group', { name: 'Goals' }).getByRole('link', { name: /^Mine/ }).isVisible(), '[NAV-GOALS] 390 More has no Goals group with Mine and Watching');
      await more.getByRole('link', { name: /^Watching/ }).tap(); await p.waitForTimeout(300);
      const cur = await p.evaluate(() => [...document.querySelectorAll('.tabbar [aria-current="page"]')].map((e) => e.textContent.replace(/\d+/g, '').trim()));
      fail(cur.join() === 'Goals', `[NAV-GOALS] 390 on Watching, the tab bar marks ${cur.join() || 'nothing'} (want Goals)`);
      await c.close();
      const [c2, q] = await open(390, 844, 'oskar', '/', true);
      const t2 = (await q.locator('.tabbar').getByRole('link').allInnerTexts()).map((x) => x.replace(/\d+/g, '').trim());
      fail(t2.join() === 'Home,Goals,Watching,Reviews', `[NAV-GOALS] 390 tabs for someone who owns no goal: ${t2.join(', ')}`);
      await c2.close();
    });

    /* ---------- [NAV-GOALS] one workspace: no switcher anywhere; several: switching is in the person menu ---------- */
    await step('one workspace', async () => {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const p = await c.newPage();
      await p.goto(url('/')); await p.locator('.page-head').first().waitFor();
      await p.evaluate(async () => {
        const full = await window.__goalsStore.load('platform-org');
        const ex = { ...full, changes: [], checkIns: full.checkIns.filter((c) => c.week >= 42) };
        localStorage.setItem('goals-live-v1:workspaces', JSON.stringify([{ id: 'ws_one', name: 'Acme', kind: 'own', createdAt: '2026-09-01T00:00:00Z' }]));
        localStorage.setItem('goals-live-v1:ws_one', JSON.stringify(ex));
        localStorage.setItem('goals-live-workspace', 'ws_one');
        localStorage.setItem('goals-live-me:ws_one', 'amara');
      });
      for (const [w, h] of [[1280, 800], [390, 844]]) {
        await p.setViewportSize({ width: w, height: h });
        await p.goto(live('/')); await p.locator('.page-head').first().waitFor();
        const m = await p.evaluate(() => ({ switchers: [...document.querySelectorAll('.wsbtn, button[aria-label*="workspace" i]')].filter((e) => e.getClientRects().length).length, name: [...document.querySelectorAll('.ws-name, .mtop')].filter((e) => e.getClientRects().length).map((e) => e.textContent).join(' ') }));
        fail(!m.switchers && /Acme/.test(m.name), `[NAV-GOALS] one workspace at ${w}: ${m.switchers} switchers; the name shown is "${m.name.trim()}"`);
        await p.locator('.me:visible, .profilebtn:visible').first().click();
        const menu = p.getByRole('dialog', { name: 'Who are you?' });
        await menu.waitFor();
        fail(await menu.getByRole('link', { name: /^Settings/ }).isVisible() && !(await menu.getByRole('group', { name: 'Workspaces' }).count()), `[NAV-GOALS] one workspace at ${w}: the person menu offers to switch workspace`);
        await p.keyboard.press('Escape');
      }
      await p.goto(live('/workspace/overview')); await p.locator('.page-head').first().waitFor();
      fail(!(await p.locator('.ws-line').count()) && /Acme/.test(await p.locator('.ws-facts').innerText()), '[NAV-GOALS] one workspace: the Workspace page still lists workspaces to switch between');
      await c.close();
      // The demo has one example now (Platform Engineering), so its person menu offers no other example companies; with a
      // workspace of the person's own beside it, the menu lists both and switching works.
      const [c2, q] = await open(1280, 800, 'rhea', '/');
      await q.locator('.side .me').click();
      const dlg = q.getByRole('dialog', { name: 'Switch person' });
      fail(await dlg.getByRole('group', { name: 'Workspaces' }).count() === 0, '[NAV-GOALS] the demo’s person menu offers to switch workspace when there is only the one example');
      await c2.close();
      const [c3, q3] = await open(1280, 800, 'rhea', '/');
      await q3.evaluate(() => localStorage.setItem('goals-app-v2:workspaces', JSON.stringify([{ id: 'ws_mine', name: 'Support desk', kind: 'own', createdAt: '2026-10-01T00:00:00Z' }])));
      await q3.reload(); await q3.waitForTimeout(500);
      // The person menu is only about people now; the workspace switcher at the top lists both (backlog WS).
      await q3.locator('.side .me').click();
      const inPerson = await q3.getByRole('dialog', { name: 'Switch person' }).getByRole('group', { name: 'Workspaces' }).count();
      await q3.keyboard.press('Escape');
      await q3.locator('.side .ws-switch').click();
      // The open one is a row that says "Open now", not a button (WR2); the other is a button.
      const ws = q3.getByRole('dialog', { name: 'Workspaces' }).getByRole('group', { name: 'Your workspaces' }).locator('.ws-pick');
      fail(!inPerson && await ws.count() === 2, `[NAV-GOALS] the switcher lists ${await ws.count()} workspaces (want the example and the person's own, 2); the person menu lists workspaces: ${inPerson}`);
      await c3.close();
    });

    /* ---------- [SETTINGS] Back: to the page you came from in the app, else the parent; never back into a form ---------- */
    await step('back', async () => {
      const [c, p] = await open(1280, 800, 'rhea', '/');
      const back = () => p.locator('.backlink').first();
      await p.locator('.side').getByRole('link', { name: 'Activity' }).click(); await p.waitForTimeout(250);
      await p.locator('.side').getByRole('link', { name: 'Settings' }).click(); await p.waitForTimeout(250);
      fail(/Back to Activity/.test(await back().innerText()), `[SETTINGS] Settings after Activity: "${await back().innerText()}"`);
      await back().click(); await p.waitForTimeout(250);
      fail(/\/demo\/activity/.test(p.url()), `[SETTINGS] Back from Settings went to ${p.url()}`);
      // Home → a goal → Change this goal → saved: Back on the goal skips the form and returns Home.
      await p.locator('.side').getByRole('link', { name: 'Home' }).click(); await p.waitForTimeout(250);
      await p.goto(url('/goals/ns-lead')); await p.waitForTimeout(300);
      fail(/Back to Goals/.test(await back().innerText()), `[SETTINGS] a goal opened from outside: "${await back().innerText()}" (want its parent, Goals)`);
      await p.locator('.side').getByRole('link', { name: 'Home' }).click(); await p.waitForTimeout(250);
      // Any of Maya's own goals on Home (the north star may be folded away under Being handled).
      await p.locator('.page a[href*="/goals/"]:visible').filter({ hasNotText: /^Goals$/ }).first().click(); await p.waitForTimeout(300);
      fail(/Back to Home/.test(await back().innerText()), `[SETTINGS] a goal opened from Home: "${await back().innerText()}"`);
      const title = (await p.locator('h1').first().innerText()).trim();
      // Edit is "Change this goal" in the bar's "…" menu: one link to the goal's form (GT1).
      await p.locator('.goal-bar summary[aria-label="More about this goal"]').click();
      await p.getByRole('group', { name: 'More about this goal' }).getByRole('link', { name: 'Change this goal' }).click(); await p.waitForTimeout(300);
      fail((await back().innerText()).includes(`Back to ${title}`), `[SETTINGS] Edit goal: "${await back().innerText()}" (want Back to ${title})`);
      await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(400);
      fail(/Back to Home/.test(await back().innerText()), `[SETTINGS] after saving an edit, the goal's Back says "${await back().innerText()}" (want Home, not the form)`);
      await back().click(); await p.waitForTimeout(300);
      fail(/\/demo\/?(\?|$)/.test(p.url()), `[SETTINGS] Back from the goal went to ${p.url()}`);
      await c.close();
    });
    await step('back review walk', async () => {
      const [c, p] = await open(1280, 800, 'amara', '/reviews/weekly');
      await p.getByRole('button', { name: /^(Start|Continue) review/ }).click(); await p.waitForTimeout(400);
      fail(/review=weekly/.test(p.url()), `[SETTINGS] starting the review opened ${p.url()}`);
      await p.getByRole('button', { name: /^Next goal/ }).first().click(); await p.waitForTimeout(400);
      const t = await p.locator('.backlink').first().innerText();
      fail(/Back to Platform leadership weekly/.test(t), `[SETTINGS] walking a review, Back says "${t}"`);
      await p.locator('.backlink').first().click(); await p.waitForTimeout(300);
      fail(/\/demo\/reviews\/weekly(\?|$)/.test(p.url()), `[SETTINGS] Back from the walk's second goal went to ${p.url()} (want the review, past the walk)`);
      await c.close();
      const [c2, q] = await open(390, 844, 'rhea', '/goals/ns-lead', true);
      const box = await q.locator('.backlink').first().boundingBox();
      fail(!!box && box.height >= 44, `[SETTINGS] 390 Back is ${box && round(box.height)}px tall`);
      await c2.close();
    });

    /* ---------- [WORKSPACE-ADMIN] rename the workspace; add, rename and remove teams; not for everyone ---------- */
    await step('workspace admin', async () => {
      for (const [w, h, touch] of [[1280, 800, false], [768, 1024, true], [390, 844, true]]) {
        const [c, p] = await open(w, h, 'amara', '/workspace', touch);
        const click = (l) => (touch ? l.tap() : l.click());
        await click(p.getByRole('button', { name: /^Rename Example/ }));
        await p.getByLabel('Workspace name').fill('Acme Platform');
        await click(p.getByRole('button', { name: 'Save the name' }));
        await p.waitForTimeout(300);
        const shown = await p.evaluate(() => [...document.querySelectorAll('.ws-title, .ws-name, .ws-facts dd, .mtop .tiny, .ws-line[aria-current] .gline-title')].filter((e) => e.getClientRects().length).map((e) => e.textContent).join(' | '));
        fail(/Acme Platform/.test(shown), `[WORKSPACE-ADMIN] ${w}: after renaming, the app says "${shown}"`);
        // Teams is a place of its own, in People (app redesign WR1): add a team, change it on its page, remove another.
        await p.goto(p.url().replace(/\/workspace(\?|$)/, '/teams$1')); await p.locator('.team-row').first().waitFor();
        await click(p.getByRole('button', { name: 'Add a team' }));
        await p.getByRole('dialog').getByLabel('Team name').fill('Insights');
        await click(p.getByRole('dialog').getByRole('button', { name: 'Add the team' }));
        await p.getByRole('heading', { level: 1, name: 'Insights' }).waitFor();
        await click(p.getByRole('button', { name: 'Change its name, lead or purpose' }));
        await p.getByRole('dialog').getByLabel('Team name').fill('Insights Platform');
        await click(p.getByRole('dialog').getByRole('button', { name: 'Save' }));
        await p.waitForTimeout(300);
        await p.goto(p.url().replace(/\/teams\/[^?]+/, '/teams/sec')); await p.getByRole('heading', { level: 1, name: 'Security Engineering' }).waitFor();
        await click(p.getByRole('button', { name: 'Remove this team…' }));
        const dlg = p.getByRole('dialog', { name: 'Remove Security Engineering' });
        await click(dlg.getByRole('button', { name: 'Move them and remove' }));
        fail(await dlg.getByRole('alert').filter({ hasText: 'Choose where they go' }).isVisible(), `[WORKSPACE-ADMIN] ${w}: removing a team with people, without saying where they go, is not explained`);
        await dlg.getByLabel('Move them to').selectOption({ label: 'Insights Platform' });
        await click(dlg.getByRole('button', { name: 'Move them and remove' }));
        await p.waitForURL(/\/teams(\?|$)/); await p.locator('.team-row').first().waitFor();
        await p.waitForTimeout(300);
        const s = await p.evaluate(() => window.__goalsStore.load('platform-org'));
        const names = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-app-v2:names') || '{}'));
        const data = s.teams.find((t) => t.name === 'Insights Platform');
        fail(names['platform-org'] === 'Acme Platform', `[WORKSPACE-ADMIN] ${w}: the new name is not saved`);
        fail(!!data && !s.teams.some((t) => t.id === 'sec') && s.people.find((x) => x.id === 'farah').teamId === data.id && s.goals.filter((g) => g.teamId === 'sec').length === 0, `[WORKSPACE-ADMIN] ${w}: teams after the changes: ${s.teams.map((t) => t.name).join(', ')}`);
        fail(['Renamed the workspace to “Acme Platform”', 'Added the team “Insights”', 'Renamed the team “Insights” to “Insights Platform”'].every((x) => s.changes.some((ch) => ch.summary === x && ch.actorId === 'amara')) && s.changes.some((ch) => /^Removed the team “Security Engineering”, moving/.test(ch.summary)), `[WORKSPACE-ADMIN] ${w}: the changes are not all logged`);
        const visible = await p.locator('.team-row').allInnerTexts();
        fail(visible.some((x) => /Insights Platform/.test(x)) && !visible.some((x) => /^Security/.test(x)), `[WORKSPACE-ADMIN] ${w}: the team list shows ${visible.map((x) => x.split('\n')[0]).join(', ')}`);
        const m = await p.evaluate(() => ({ side: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.people-head .btn, .ws-title-row .btn')].filter((b) => b.getBoundingClientRect().height < 40).length }));
        fail(m.side <= 1 && (!touch || !m.small), `[WORKSPACE-ADMIN] ${w}: scrolls sideways ${m.side}px; ${m.small} team buttons under 40px`);
        await c.close();
      }
      const [c, p] = await open(1280, 800, 'rhea', '/teams');
      await p.locator('.team-row').first().waitFor();
      fail(!(await p.getByRole('button', { name: /^Rename|Add a team|^Remove|^Change/ }).count()) && await p.locator('.team-row').count() >= 6, '[WORKSPACE-ADMIN] someone who isn’t an admin is offered rename, add or remove, or can’t see the teams');
      // Tokens are admins' business on Workspace (Access); everyone's own are in Settings, in the sidebar.
      fail(await p.getByRole('link', { name: 'Settings' }).first().isVisible() && await p.getByRole('link', { name: /^Access/ }).count() === 0, '[SETTINGS] a non-admin is not pointed to Settings, or is offered Workspace’s Access');
      await c.close();
    });

    /* ---------- [BRAND] Faro: the name in the title, the favicon, the logo, readable colours in light and dark ---------- */
    await step('brand', async () => {
      // The welcome page (the real app, no workspace yet): the logo, named “Faro”, above the promise.
      const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p = await c.newPage();
      await p.goto(live('/'));
      await p.getByRole('heading', { name: 'Run the company on outcomes, and manage by exception' }).waitFor({ timeout: 5000 });
      const logo = p.locator('.welcome').getByRole('img', { name: 'Faro', exact: true });
      fail(await logo.count() === 1 && await logo.isVisible(), '[BRAND] the welcome page has no logo named “Faro”');
      const order = await p.evaluate(() => { const l = document.querySelector('.welcome .faro-logo'), h = document.querySelector('.welcome h1'); return !!l && !!h && !!(l.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING); });
      fail(order, '[BRAND] the logo is not above “Run the company on outcomes, and manage by exception”');
      fail(/Faro$/.test(await p.title()), `[BRAND] the welcome page's title is “${await p.title()}”`);
      // The favicon: linked from the page, and an SVG that is really served, from the demo too.
      for (const at of [live('/'), url('/')]) {
        await p.goto(at); await p.waitForTimeout(300);
        const href = await p.evaluate(() => { const l = document.querySelector('link[rel="icon"]'); return l && l.getAttribute('type') === 'image/svg+xml' ? l.href : null; });
        const r = href ? await p.request.get(href) : null;
        const body = r ? await r.text() : '';
        fail(!!r && r.ok() && /image\/svg\+xml/.test(r.headers()['content-type'] || '') && /<svg[\s\S]*#(F7AE2E|FFC24A)/i.test(body), `[BRAND] ${at}: favicon ${href || 'not linked'} → ${r ? r.status() + ' ' + r.headers()['content-type'] : 'none'}`);
      }
      fail(!!(await p.locator('meta[name="theme-color"]').count()), '[BRAND] no theme-color');
      // The home-screen icon (backlog I): a manifest named Faro, with 192 and 512 icons, any and maskable, and an apple-touch icon, all served.
      const icons = await p.evaluate(() => ({ manifest: document.querySelector('link[rel="manifest"]')?.href, apple: document.querySelector('link[rel="apple-touch-icon"]')?.href }));
      const mr = icons.manifest ? await p.request.get(icons.manifest) : null;
      const man = mr && mr.ok() ? await mr.json().catch(() => null) : null;
      fail(!!man && man.name === 'Faro' && !!man.background_color && !!man.theme_color, `[LAUNCH] no web app manifest named Faro (${icons.manifest || 'not linked'})`);
      const want = ['192x192 any', '192x192 maskable', '512x512 any', '512x512 maskable'];
      const have = (man?.icons || []).map((i) => `${i.sizes} ${i.purpose}`);
      fail(want.every((w) => have.includes(w)), `[LAUNCH] the manifest's icons are ${have.join(', ') || 'none'}`);
      for (const src of [...(man?.icons || []).map((i) => new URL(i.src, icons.manifest).href), icons.apple].filter(Boolean)) {
        const r = await p.request.get(src);
        fail(r.ok() && /image\/png/.test(r.headers()['content-type'] || ''), `[LAUNCH] icon ${src} → ${r.status()} ${r.headers()['content-type']}`);
      }
      fail(!!icons.apple, '[LAUNCH] no apple-touch-icon');
      await c.close();
      // The splash: once per launch (a browser session), over the app, gone by itself, ended by a tap, and still under reduced motion.
      // Automated browsers never see it unless they ask (window.__faroSplash), so no other check waits for it.
      {
        const plain = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const p0 = await plain.newPage(); await p0.goto(live('/')); await p0.waitForTimeout(300);
        fail(await p0.locator('.faro-splash').count() === 0, '[LAUNCH] the splash shows in an automated browser that did not ask for it');
        await plain.close();
        const sc = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await sc.addInitScript(() => { window.__faroSplash = true; });
        const s = await sc.newPage();
        await s.goto(live('/'));
        fail(await s.locator('.faro-splash').waitFor({ state: 'attached', timeout: 3000 }).then(() => true, () => false), '[LAUNCH] no splash on the first load of a session');
        const t0 = Date.now();
        await s.locator('.faro-splash').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
        const took = Date.now() - t0;
        fail(took < 3200, `[LAUNCH] the splash took ${took}ms to go (want about 2.5s)`);
        fail(await s.getByRole('heading', { name: 'Run the company on outcomes, and manage by exception' }).isVisible(), '[LAUNCH] the app is not there when the splash ends');
        await s.reload(); await s.waitForTimeout(400);
        fail(await s.locator('.faro-splash').count() === 0, '[LAUNCH] the splash shows again in the same session (on a reload or navigation)');
        await sc.close();
        const tc = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await tc.addInitScript(() => { window.__faroSplash = true; });
        const tp = await tc.newPage(); await tp.goto(live('/'));
        await tp.locator('.faro-splash').waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
        const t1 = Date.now(); await tp.mouse.click(195, 420);
        await tp.locator('.faro-splash').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
        fail(await tp.locator('.faro-splash').count() === 0 && Date.now() - t1 < 600, `[LAUNCH] a tap did not skip the splash (${Date.now() - t1}ms)`);
        await tc.close();
        const rc = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await rc.addInitScript(() => { window.__faroSplash = true; });
        const rp = await rc.newPage(); await rp.goto(live('/'));
        await rp.locator('.faro-splash').waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
        const still = await rp.evaluate(() => { const e = document.querySelector('.faro-splash'); return !!e && e.classList.contains('is-still') && !document.querySelector('.faro-splash .sp-light').getAnimations().length; });
        fail(still, '[LAUNCH] under reduced motion the splash still turns or draws');
        await rc.close();
      }
      // In the app: the title ends “Faro”; the sidebar has the logo, and the mark alone on the rail; key colours are readable.
      for (const theme of ['light', 'dark']) {
        const [c2, q] = await open(1280, 800, 'rhea', '/');
        if (theme === 'dark') { await q.evaluate(() => localStorage.setItem('goals-theme', 'dark')); await q.reload(); await q.waitForTimeout(400); }
        const t = await q.title();
        fail(/ · Faro$/.test(t), `[BRAND] ${theme}: the page title is “${t}”`);
        const m = await q.evaluate((src) => {
          const contrast = eval(src);
          const v = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
          const shown = (sel) => { const e = document.querySelector(sel); return !!e && !!e.getClientRects().length; };
          const btn = document.querySelector('.btn.primary');
          const ink = getComputedStyle(document.querySelector('.side-brand .faro-logo')).color;
          return {
            logo: shown('.side .side-brand .faro-logo'), body: Math.min(contrast(v('--fg'), v('--bg')), contrast(v('--fg'), v('--surface'))),
            link: Math.min(contrast(v('--accent-text'), v('--bg')), contrast(v('--accent-text'), v('--surface'))),
            button: btn ? contrast(getComputedStyle(btn).color, getComputedStyle(btn).backgroundColor) : 0, ink: contrast(ink, getComputedStyle(document.querySelector('.side')).backgroundColor),
          };
        }, CONTRAST);
        fail(m.logo, `[BRAND] ${theme}: no logo at the top of the sidebar`);
        fail(m.body >= 7 && m.link >= 4.5 && m.button >= 4.5, `[BRAND] ${theme}: body text ${round(m.body)}:1 (want 7), links ${round(m.link)}:1, primary button ${round(m.button)}:1 (want 4.5)`);
        fail(m.ink >= 3, `[BRAND] ${theme}: the logo's ink is ${round(m.ink)}:1 on the sidebar (want 3)`);
        if (theme === 'light') {
          await q.locator('.side').getByRole('button', { name: /Collapse sidebar/ }).click();
          const rail = await q.evaluate(() => ({ mark: !!document.querySelector('.side .side-brand .faro-mark')?.getClientRects().length, logo: !!document.querySelector('.side .side-brand .faro-logo')?.getClientRects().length }));
          fail(rail.mark && !rail.logo, `[BRAND] icon rail: mark shown ${rail.mark}, wordmark shown ${rail.logo} (want the mark alone)`);
          await q.locator('.side').getByRole('button', { name: /full sidebar/ }).click();
        }
        await c2.close();
      }
    });

    return fails;
  },
};
