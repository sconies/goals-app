/* N4: Lane's review notes (5 Nov), shell-settings. run({ open, url, browser }) returns a list of failures.
   Settings (light, dark or system; an accent colour; a full or icons-only sidebar; your AI assistants), Goals as a
   section of the navigation, no workspace switcher for someone in one workspace, a Back link on detail pages, and an
   admin renaming the workspace and adding, renaming and removing teams. Measured in the built app at phone, tablet and
   desktop widths. */
const round = (n) => Math.round(n * 10) / 10;

/** WCAG contrast of two CSS colours (rgb() or #hex), worked out in the page. */
const CONTRAST = `(a, b) => {
  const rgb = (c) => { const x = document.createElement('i'); x.style.color = c; document.body.appendChild(x); const v = getComputedStyle(x).color.match(/[\\d.]+/g).slice(0, 3).map(Number); x.remove(); return v; };
  const L = (c) => { const [r, g, b] = rgb(c).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}`;

module.exports = {
  id: 'N4',
  area: 'shell-settings',
  title: 'Review notes, shell-settings: Settings with theme, accent and sidebar; Goals as a nav section; no switcher for one workspace; Back on detail pages; workspace and team admin',
  reqs: ['SETTINGS', 'NAV-GOALS', 'WORKSPACE-ADMIN'],
  async run({ open, url, browser }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };
    const step = async (name, f) => { try { await f(); } catch (e) { fails.push(`${name}: crashed (${String(e.message || e).split('\n')[0]})`); } };
    const base = url('/').replace(/\/demo\/.*$/, '');
    const live = (p) => base + p + (p.includes('?') ? '&' : '?') + 'store=browser&today=2026-10-30';

    /* ---------- [SETTINGS] the page, reached from the nav and the person menu ---------- */
    await step('settings reached', async () => {
      const [c, p] = await open(1280, 800, 'maya', '/');
      await p.locator('.side').getByRole('link', { name: 'Settings' }).click();
      await p.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 3000 });
      fail(/\/demo\/settings/.test(p.url()), `[SETTINGS] the sidebar's Settings goes to ${p.url()}`);
      fail(await p.getByText(/kept in this browser only/).isVisible(), '[SETTINGS] the page does not say its choices are kept in this browser');
      for (const h of ['Appearance', 'Navigation', 'You', 'Your AI assistants']) fail(await p.getByRole('heading', { name: h, exact: true }).isVisible(), `[SETTINGS] no "${h}" section`);
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
      const [c, p] = await open(390, 844, 'maya', '/', true);
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
      const [c, p] = await open(1280, 800, 'maya', '/settings');
      const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const look = p.getByRole('group', { name: 'Light or dark' });
      await look.getByRole('button', { name: 'Dark' }).click();
      fail(await bg() === 'rgb(14, 17, 22)', `[SETTINGS] Dark: the page is ${await bg()}`);
      const card = await p.evaluate(() => getComputedStyle(document.querySelector('.accent-opt')).backgroundColor);
      fail(card === 'rgb(22, 26, 33)', `[SETTINGS] Dark: a surface is ${card}`);
      await p.reload(); await p.waitForTimeout(300);
      fail(await bg() === 'rgb(14, 17, 22)' && await look.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed') === 'true', '[SETTINGS] Dark is not kept after a reload');
      // No flash: hold the app's code back and look at the page that's drawn before it.
      await p.route('**/assets/*.js', async (r) => { await new Promise((ok) => setTimeout(ok, 1200)); await r.continue(); });
      await p.goto(url('/'), { waitUntil: 'commit' });
      await p.locator('.preboot').waitFor({ state: 'attached', timeout: 3000 });
      const early = await p.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, preboot: !!document.querySelector('.preboot') }));
      fail(early.preboot && early.theme === 'dark' && early.bg === 'rgb(14, 17, 22)', `[SETTINGS] before the app's code runs: ${JSON.stringify(early)} (want dark, no flash of light)`);
      await p.unroute('**/assets/*.js');
      await p.goto(url('/settings')); await p.waitForTimeout(300);
      await look.getByRole('button', { name: 'Light' }).click();
      fail(await bg() === 'rgb(245, 246, 248)', `[SETTINGS] Light: the page is ${await bg()}`);
      await look.getByRole('button', { name: 'System' }).click();
      fail(await p.evaluate(() => !document.documentElement.hasAttribute('data-theme')), '[SETTINGS] System still forces a theme');
      await c.close();
      // System follows the device.
      const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
      const q = await c2.newPage();
      await q.goto(url('/settings')); await q.waitForTimeout(400);
      const sys = await q.evaluate(() => getComputedStyle(document.body).backgroundColor);
      fail(sys === 'rgb(14, 17, 22)', `[SETTINGS] System on a dark device: the page is ${sys}`);
      await c2.close();
    });

    /* ---------- [SETTINGS] accents: each passes 4.5:1 for text and under its own fill, light and dark, and persists ---------- */
    await step('accents', async () => {
      const [c, p] = await open(1280, 800, 'maya', '/settings');
      const radios = p.getByRole('radiogroup', { name: 'Accent colour' }).getByRole('radio');
      const n = await radios.count();
      fail(n >= 3 && n <= 4, `[SETTINGS] ${n} accent colours (want 3 or 4)`);
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
        const [c, p] = await open(w, h, 'maya', '/');
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
      const [c, p] = await open(1024, 768, 'maya', '/', true);
      const m = await p.evaluate(() => ({ w: Math.round(document.querySelector('.side').getBoundingClientRect().width), toggle: !!document.querySelector('.side .collapse-nav')?.getClientRects().length, untitled: [...document.querySelectorAll('.side .nav')].filter((n) => n.getClientRects().length && !n.getAttribute('title')).length, watching: !!document.querySelector('.side a.nav.sub[href$="/watching"]')?.getClientRects().length }));
      fail(m.w <= 72 && !m.toggle && !m.untitled && m.watching, `[SETTINGS, NAV-GOALS] 1024: rail ${m.w}px, toggle shown ${m.toggle}, ${m.untitled} unnamed, Watching in the rail ${m.watching}`);
      await c.close();
    });

    /* ---------- [NAV-GOALS] Goals is a section: Mine, Watching, All and saved views; one current place ---------- */
    await step('goals section', async () => {
      const [c, p] = await open(1280, 800, 'maya', '/');
      // A saved view of Maya's and one pinned for everyone, in the example's data.
      await p.evaluate(() => {
        const k = 'goals-app-v2:example', s = JSON.parse(localStorage.getItem(k));
        const at = '2026-10-29T10:00:00.000Z';
        s.views = [...(s.views || []), { id: 'view_n4a', personId: 'maya', name: 'Off track', params: 'status=off', pinned: false, createdAt: at, updatedAt: at, deletedAt: null }, { id: 'view_n4b', personId: 'elena', name: 'North star', params: 'level=north-star', pinned: true, createdAt: at, updatedAt: at, deletedAt: null }];
        localStorage.setItem(k, JSON.stringify(s));
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
      fail(/\/demo\/watching/.test(p.url()) && (await current()).join() === 'Watching', `[NAV-GOALS] Watching: ${p.url()}, current ${await current()}`);
      fail(!(await p.locator('.side > a.nav[href$="/watching"]').count()), '[NAV-GOALS] Watching is still a top-level item');
      await sub.getByRole('link', { name: 'All' }).click(); await p.waitForTimeout(250);
      fail((await current()).join() === 'All', `[NAV-GOALS] All: current ${await current()}`);
      await p.goto(url('/goals/head')); await p.waitForTimeout(300);
      fail((await current()).join() === 'Goals', `[NAV-GOALS] a goal's page: current ${await current()}`);
      await c.close();
    });
    await step('goals phone', async () => {
      const [c, p] = await open(390, 844, 'maya', '/', true);
      const tabs = (await p.locator('.tabbar').getByRole('link').allInnerTexts()).map((x) => x.replace(/\d+/g, '').trim());
      fail(tabs.join() === 'Home,Check-in,Goals,Reviews', `[NAV-GOALS] 390 owner's tabs: ${tabs.join(', ')}`);
      await p.locator('.tabbar').getByRole('button', { name: 'More' }).tap();
      const more = p.getByRole('dialog', { name: 'More' });
      fail(await more.getByRole('group', { name: 'Goals' }).getByRole('link', { name: /^Watching/ }).isVisible() && await more.getByRole('group', { name: 'Goals' }).getByRole('link', { name: /^Mine/ }).isVisible(), '[NAV-GOALS] 390 More has no Goals group with Mine and Watching');
      await more.getByRole('link', { name: /^Watching/ }).tap(); await p.waitForTimeout(300);
      const cur = await p.evaluate(() => [...document.querySelectorAll('.tabbar [aria-current="page"]')].map((e) => e.textContent.replace(/\d+/g, '').trim()));
      fail(cur.join() === 'Goals', `[NAV-GOALS] 390 on Watching, the tab bar marks ${cur.join() || 'nothing'} (want Goals)`);
      await c.close();
      const [c2, q] = await open(390, 844, 'tom', '/', true);
      const t2 = (await q.locator('.tabbar').getByRole('link').allInnerTexts()).map((x) => x.replace(/\d+/g, '').trim());
      fail(t2.join() === 'Home,Goals,Watching,Reviews', `[NAV-GOALS] 390 tabs for someone who owns no goal: ${t2.join(', ')}`);
      await c2.close();
    });

    /* ---------- [NAV-GOALS] one workspace: no switcher anywhere; several: switching is in the person menu ---------- */
    await step('one workspace', async () => {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const p = await c.newPage();
      await p.goto(url('/')); await p.locator('.page-head').first().waitFor();
      await p.evaluate(() => {
        const ex = JSON.parse(localStorage.getItem('goals-app-v2:example'));
        localStorage.setItem('goals-live-v1:workspaces', JSON.stringify([{ id: 'ws_one', name: 'Acme', kind: 'own', createdAt: '2026-09-01T00:00:00Z' }]));
        localStorage.setItem('goals-live-v1:ws_one', JSON.stringify(ex));
        localStorage.setItem('goals-live-workspace', 'ws_one');
        localStorage.setItem('goals-live-me:ws_one', 'elena');
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
      await p.goto(live('/workspace')); await p.locator('.page-head').first().waitFor();
      fail(!(await p.locator('.ws-line').count()) && await p.locator('.ws-title').innerText() === 'Acme', '[NAV-GOALS] one workspace: the Workspace page still lists workspaces to switch between');
      await c.close();
      // The demo has four: the person menu lists them, and switching works.
      const [c2, q] = await open(1280, 800, 'maya', '/');
      await q.locator('.side .me').click();
      const ws = q.getByRole('dialog', { name: 'Switch person' }).getByRole('group', { name: 'Workspaces' }).getByRole('button');
      fail(await ws.count() === 4, `[NAV-GOALS] the demo's person menu lists ${await ws.count()} workspaces (want 4)`);
      await ws.filter({ hasText: 'Customer Support' }).click(); await q.waitForTimeout(500);
      fail(/Customer Support/.test(await q.locator('.side .ws-name').innerText()), '[NAV-GOALS] switching from the person menu did not open Customer Support');
      await c2.close();
    });

    /* ---------- [SETTINGS] Back: to the page you came from in the app, else the parent; never back into a form ---------- */
    await step('back', async () => {
      const [c, p] = await open(1280, 800, 'maya', '/');
      const back = () => p.locator('.backlink').first();
      await p.locator('.side').getByRole('link', { name: 'Activity' }).click(); await p.waitForTimeout(250);
      await p.locator('.side').getByRole('link', { name: 'Settings' }).click(); await p.waitForTimeout(250);
      fail(/Back to Activity/.test(await back().innerText()), `[SETTINGS] Settings after Activity: "${await back().innerText()}"`);
      await back().click(); await p.waitForTimeout(250);
      fail(/\/demo\/activity/.test(p.url()), `[SETTINGS] Back from Settings went to ${p.url()}`);
      // Home → a goal → Edit → saved: Back on the goal skips the form and returns Home.
      await p.locator('.side').getByRole('link', { name: 'Home' }).click(); await p.waitForTimeout(250);
      await p.goto(url('/goals/head')); await p.waitForTimeout(300);
      fail(/Back to Goals/.test(await back().innerText()), `[SETTINGS] a goal opened from outside: "${await back().innerText()}" (want its parent, Goals)`);
      await p.locator('.side').getByRole('link', { name: 'Home' }).click(); await p.waitForTimeout(250);
      // Any of Maya's own goals on Home (the north star may be folded away under Being handled).
      await p.locator('.page a[href*="/goals/"]:visible').filter({ hasNotText: /^Goals$/ }).first().click(); await p.waitForTimeout(300);
      fail(/Back to Home/.test(await back().innerText()), `[SETTINGS] a goal opened from Home: "${await back().innerText()}"`);
      const title = (await p.locator('h1').first().innerText()).trim();
      await p.getByRole('link', { name: 'Edit', exact: true }).click(); await p.waitForTimeout(300);
      fail((await back().innerText()).includes(`Back to ${title}`), `[SETTINGS] Edit goal: "${await back().innerText()}" (want Back to ${title})`);
      await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(400);
      fail(/Back to Home/.test(await back().innerText()), `[SETTINGS] after saving an edit, the goal's Back says "${await back().innerText()}" (want Home, not the form)`);
      await back().click(); await p.waitForTimeout(300);
      fail(/\/demo\/?(\?|$)/.test(p.url()), `[SETTINGS] Back from the goal went to ${p.url()}`);
      await c.close();
    });
    await step('back review walk', async () => {
      const [c, p] = await open(1280, 800, 'elena', '/reviews/weekly');
      await p.getByRole('button', { name: /^(Start|Continue) review/ }).click(); await p.waitForTimeout(400);
      fail(/review=weekly/.test(p.url()), `[SETTINGS] starting the review opened ${p.url()}`);
      await p.getByRole('button', { name: /^Next goal/ }).first().click(); await p.waitForTimeout(400);
      const t = await p.locator('.backlink').first().innerText();
      fail(/Back to Platform weekly review/.test(t), `[SETTINGS] walking a review, Back says "${t}"`);
      await p.locator('.backlink').first().click(); await p.waitForTimeout(300);
      fail(/\/demo\/reviews\/weekly(\?|$)/.test(p.url()), `[SETTINGS] Back from the walk's second goal went to ${p.url()} (want the review, past the walk)`);
      await c.close();
      const [c2, q] = await open(390, 844, 'maya', '/goals/head', true);
      const box = await q.locator('.backlink').first().boundingBox();
      fail(!!box && box.height >= 44, `[SETTINGS] 390 Back is ${box && round(box.height)}px tall`);
      await c2.close();
    });

    /* ---------- [WORKSPACE-ADMIN] rename the workspace; add, rename and remove teams; not for everyone ---------- */
    await step('workspace admin', async () => {
      for (const [w, h, touch] of [[1280, 800, false], [768, 1024, true], [390, 844, true]]) {
        const [c, p] = await open(w, h, 'elena', '/workspace', touch);
        const click = (l) => (touch ? l.tap() : l.click());
        await click(p.getByRole('button', { name: /^Rename Example/ }));
        await p.getByLabel('Workspace name').fill('Acme Platform');
        await click(p.getByRole('button', { name: 'Save the name' }));
        await p.waitForTimeout(300);
        const shown = await p.evaluate(() => [...document.querySelectorAll('.ws-title, .ws-name, .mtop .tiny, .ws-line[aria-current] .gline-title')].filter((e) => e.getClientRects().length).map((e) => e.textContent).join(' | '));
        fail(/Acme Platform/.test(shown), `[WORKSPACE-ADMIN] ${w}: after renaming, the app says "${shown}"`);
        await click(p.getByRole('button', { name: 'Add a team' }));
        await p.getByRole('dialog').getByLabel('Team name').fill('Data');
        await click(p.getByRole('dialog').getByRole('button', { name: 'Add the team' }));
        await p.waitForTimeout(300);
        await click(p.getByRole('button', { name: 'Rename Data' }));
        await p.getByRole('dialog').getByLabel('Team name').fill('Data Platform');
        await click(p.getByRole('dialog').getByRole('button', { name: 'Save' }));
        await p.waitForTimeout(300);
        await click(p.getByRole('button', { name: 'Remove Security' }));
        const dlg = p.getByRole('dialog', { name: 'Remove Security' });
        await click(dlg.getByRole('button', { name: 'Move them and remove' }));
        fail(await dlg.getByRole('alert').filter({ hasText: 'Choose where they go' }).isVisible(), `[WORKSPACE-ADMIN] ${w}: removing a team with people, without saying where they go, is not explained`);
        await dlg.getByLabel('Move them to').selectOption({ label: 'Data Platform' });
        await click(dlg.getByRole('button', { name: 'Move them and remove' }));
        await p.waitForTimeout(400);
        const s = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-app-v2:example')));
        const names = await p.evaluate(() => JSON.parse(localStorage.getItem('goals-app-v2:names') || '{}'));
        const data = s.teams.find((t) => t.name === 'Data Platform');
        fail(names.example === 'Acme Platform', `[WORKSPACE-ADMIN] ${w}: the new name is not saved`);
        fail(!!data && !s.teams.some((t) => t.id === 'sec') && s.people.find((x) => x.id === 'aisha').teamId === data.id && s.goals.filter((g) => g.teamId === 'sec').length === 0, `[WORKSPACE-ADMIN] ${w}: teams after the changes: ${s.teams.map((t) => t.name).join(', ')}`);
        fail(['Renamed the workspace to “Acme Platform”', 'Added the team “Data”', 'Renamed the team “Data” to “Data Platform”'].every((x) => s.changes.some((ch) => ch.summary === x && ch.actorId === 'elena')) && s.changes.some((ch) => /^Removed the team “Security”, moving/.test(ch.summary)), `[WORKSPACE-ADMIN] ${w}: the changes are not all logged`);
        const visible = await p.locator('.team-opt').allInnerTexts();
        fail(visible.some((x) => /Data Platform/.test(x)) && !visible.some((x) => /^Security/.test(x)), `[WORKSPACE-ADMIN] ${w}: the team list shows ${visible.map((x) => x.split('\n')[0]).join(', ')}`);
        const m = await p.evaluate(() => ({ side: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.team-opt .btn, .ws-title-row .btn')].filter((b) => b.getBoundingClientRect().height < 40).length }));
        fail(m.side <= 1 && (!touch || !m.small), `[WORKSPACE-ADMIN] ${w}: scrolls sideways ${m.side}px; ${m.small} team buttons under 40px`);
        await c.close();
      }
      const [c, p] = await open(1280, 800, 'maya', '/workspace');
      fail(!(await p.getByRole('button', { name: /^Rename|Add a team|^Remove/ }).count()) && await p.locator('.team-opt').count() >= 6, '[WORKSPACE-ADMIN] someone who isn’t an admin is offered rename, add or remove, or can’t see the teams');
      fail(await p.getByRole('link', { name: 'Settings' }).first().isVisible(), '[SETTINGS] a non-admin on Workspace is not pointed to Settings for their tokens');
      await c.close();
    });

    return fails;
  },
};
