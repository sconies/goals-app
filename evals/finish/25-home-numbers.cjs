/* F25: Home's numbers agree (docs/design/home/spec.md section 8, HM4). For Tunde, Rhea, Amara and Oskar on three days,
   every count on Home that is a link opens a Goals page whose count line says the same number. Home's last look is set
   to Friday 6 Nov first (the `home-seen` pref, per browser), so "Changed since" counts from a day the check knows.
   Not checked here: that every count on Home that isn't a link is the length of a list on Home; nor "{k} more …" links,
   which continue a list (their page counts the whole of it). */
const PEOPLE = ['tunde', 'rhea', 'amara', 'oskar'];
const DAYS = ['2026-11-09', '2026-11-11', '2026-11-12'];
const SEEN = JSON.stringify({ last: '2026-11-06', prev: null });

module.exports = {
  id: 'F25',
  area: 'home-numbers',
  title: 'Home’s numbers agree: every count on Home that is a link opens Goals with that number in its count line',
  reqs: ['HOME-OWNER', 'HOME-MANAGER'],
  async run({ open }) {
    const fails = [];
    let changed = 0;
    for (const who of PEOPLE) {
      for (const day of DAYS) {
        const [c, p] = await open(1440, 900, who, `/?today=${day}`);
        try {
          // Home's last look (`home-seen`, kept per browser) is Friday 6 Nov, so "Changed since" counts from it.
          await p.evaluate(([k, v]) => localStorage.setItem(k, v), [`faro-prefs:platform-org:${who}:home-seen`, SEEN]);
          await p.reload();
          await p.locator('[data-part="Home"]').waitFor();
          await p.waitForLoadState('networkidle').catch(() => {});
          await p.waitForTimeout(300);
          // Every link on Home to Goals whose words start with a number: the counts. "{k} more teams, …" and "{k} more need
          // attention" open the whole list they continue, so their number is what is left to show, not the page's count.
          const links = await p.$$eval('.page.home a[href*="/goals?"]', (as) => as
            .filter((a) => !a.classList.contains('teams-more') && !/^\d+ more\b/.test((a.textContent || '').trim()))
            .map((a) => ({ n: Number(((a.textContent || '').trim().match(/^(?:All )?(\d+)\b/) || [])[1]), href: a.getAttribute('href') || '', text: (a.textContent || '').trim() }))
            .filter((x) => Number.isFinite(x.n)));
          changed += links.filter((l) => /moved=/.test(l.href)).length;
          const seen = new Map();
          for (const l of links) { if (!seen.has(l.href)) seen.set(l.href, l); else if (seen.get(l.href).n !== l.n) fails.push(`${who} ${day}: “${l.text}” and “${seen.get(l.href).text}” open ${l.href} with different numbers`); }
          for (const l of seen.values()) {
            // Within the app, as a press on the link would: the day stays the one Home opened on.
            await p.evaluate((h) => { history.pushState(null, '', h); dispatchEvent(new PopStateEvent('popstate')); }, l.href);
            const said = await p.waitForFunction((n) => {
              const line = document.querySelector('.goals-line');
              const got = Number(((line?.textContent || '').match(/^(\d+)/) || [])[1]);
              return got === n ? 'ok' : null;
            }, l.n, { timeout: 6000 }).then(() => null, async () => (await p.locator('.goals-line').first().innerText().catch(() => '(no count line)')));
            if (said != null) fails.push(`${who} ${day}: “${l.text}” (${l.href}) opened Goals saying “${said}”`);
          }
        } finally { await c.close(); }
      }
    }
    // Something moved on one of these days for one of them: the "Changed since" counts were among the links checked.
    if (!changed) fails.push('no “Changed since” count or “Since” link was found on any Home');
    return fails;
  },
};
