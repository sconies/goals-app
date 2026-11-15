// U69: a page says where it is (spec/core/journeys/U69.md). Lit item read from the sidebar's or the tab bar's current link.
const PAGES = [
  ['/', 'Home', 'Home', 'Home'], ['/goals?scope=all', 'Goals', 'Goals', 'Goals'], ['/goals?scope=watching', 'Goals', 'Goals', 'Goals'],
  ['/goals/ns-lead', 'Lead time for changes', 'Goals', 'Goals'], ['/goals/ns-lead/print', 'Lead time for changes, to print', null, null],
  ['/goals/ns-lead?review=weekly', 'Lead time for changes · Platform leadership weekly', 'Reviews', 'Reviews'], ['/check-in/ns-lead', 'Check in: Lead time for changes', null, null],
  ['/reviews/weekly', 'Platform leadership weekly', 'Reviews', 'Reviews'], ['/people/rhea', 'Rhea Kapoor', 'People', 'More'], ['/teams/cicd', 'CI/CD', 'People', 'More'],
  ['/workspace/cycles', 'Cycles · Workspace', 'Workspace', 'More'], ['/activity', 'Activity', 'Activity', 'More'], ['/settings', 'Settings', 'Settings', 'More'],
  ['/whats-new', 'What’s new', 'Help', 'More'], ['/goals/no-such-goal', 'Goal not found', 'Goals', 'Goals'], ['/no-such-page', 'Page not found', '', ''],
];
export default {
  id: 'U69', title: 'A page says where it is', budget: 1,
  async run(h) {
    await h.open('rhea');
    const wrongT = [], wrongL = [];
    for (const [addr, name, side, tab] of PAGES) {
      await h.goto(addr);
      const title = await h.p.title();
      if (title !== `${name} · Platform Engineering · Faro`) wrongT.push(`${addr}: ${title}`);
      const nav = h.phone ? h.p.getByRole('navigation', { name: 'Tabs' }) : h.p.getByRole('navigation', { name: 'Menu' });
      const lit = (await nav.count()) ? await nav.locator('[aria-current=page]').allInnerTexts() : [];
      const want = h.phone ? tab : side;
      const got = lit.map((x) => x.replace(/\d+$/, '').trim()).join(',');
      if ((want || '') !== got) wrongL.push(`${addr}: lit “${got}”, want “${want || ''}”`);
    }
    await h.check(`every address names itself in the title (${wrongT.join('; ')})`, () => !wrongT.length, { point: 'entry' });
    await h.check(`every address lights one place (${wrongL.join('; ')})`, () => !wrongL.length, { point: 'attention' });
    await h.checkpoint('titles');
    const titles = new Set();
    for (const g of ['ns-lead', 'lead-mq', 'cost-rightsize', 'mttr-oncall', 'ci-docker', 'rel-cfr']) { await h.goto(`/goals/${g}`); titles.add(await h.p.title()); }
    await h.check('six goals, six titles', () => titles.size === 6, { point: 'finish' });
  },
};
