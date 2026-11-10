/* F10: People and Teams on a phone (app redesign WR1, docs/design/workspace/spec.md section 6). run({ open }) returns a
   list of failures. At 390 px, as a member: the first person on People is near the top; a Teams row's counts start on its third
   line and it has no button in it; and nothing on People, Teams, a person, a team or a Workspace section scrolls sideways.
   (The About part of F10, the first fact within 220 px, comes with WR2, when Workspace opens on About.) */
module.exports = {
  id: 'F10',
  area: 'people',
  reqs: ['PEOPLE-DIRECTORY', 'FIT-AND-FINISH'],
  title: 'People and Teams on a phone: the first person near the top, short Teams rows with no buttons, nothing scrolls sideways',
  async run({ open }) {
    const fails = [];
    const fail = (m) => fails.push(m);

    const [c, p] = await open(390, 844, 'oskar', '/people', true);
    await p.locator('.people-row').first().waitFor();
    const first = await p.locator('.people-row').first().evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY));
    if (first > 380) fail(`390px: the first person on People is ${first}px from the top (at most 380)`);
    // A member sees nothing that changes anyone.
    const changes = await p.getByRole('button', { name: /^(Add a person|Add a team|Change|Mark as left|Remove)/ }).count();
    if (changes) fail(`390px: a member is offered ${changes} buttons that change people`);

    await p.goto(p.url().replace(/\/people(\?|$)/, '/teams$1'));
    await p.locator('.team-row').first().waitFor();
    const rows = await p.locator('.team-row').evaluateAll((rs) => rs.map((r) => {
      const name = r.querySelector('.person-name'), counts = r.querySelector('.team-counts, .people-line');
      const lh = parseFloat(getComputedStyle(name).lineHeight) || 22;
      const top = name.getBoundingClientRect().top;
      return { name: name.textContent, start: counts ? Math.round((counts.getBoundingClientRect().top - top) / lh) + 1 : 0, buttons: r.querySelectorAll('button, .btn').length };
    }));
    // A row is its name, its lead and people, then its counts on the third line (a long team name may take one more;
    // the counts themselves may wrap, since every status keeps its whole word).
    const tall = rows.filter((r) => r.start > (r.name.length > 34 ? 4 : 3));
    if (tall.length) fail(`390px: Teams rows whose counts start below the third line: ${tall.map((r) => `${r.name} (line ${r.start})`).join(', ')}`);
    if (rows.some((r) => r.buttons)) fail('390px: a Teams row has a button in it');

    const sideways = [];
    for (const path of ['/people', '/teams', '/people/rhea', '/teams/cicd', '/teams/portal', '/workspace', '/workspace/cycles', '/workspace/privacy', '/workspace/removed']) {
      await p.goto(p.url().replace(/\/demo\/[^?]*/, '/demo' + path));
      await p.locator('main h1').first().waitFor();
      await p.waitForTimeout(150);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 1) sideways.push(`${path} by ${over}px`);
    }
    if (sideways.length) fail(`390px: scrolls sideways: ${sideways.join(', ')}`);
    await c.close();
    return fails;
  },
};
