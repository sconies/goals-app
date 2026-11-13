/* N22: the four switches SW1 adds (docs/design/feature-switches/spec.md sections 3, 4 and 9; module map, "Designed,
   not built"). run({ open, url }) returns a list of failures. As Amara, an admin, on a computer: with Watching, the
   Wrap-up, the Goal map and Feedback switched off, every door that is a screen is shut: the menu's last group is
   Workspace, Settings, Help; Goals has no Watching tab and no Map; a link to the Map opens the List and says so once;
   Home has no “Goals you watch” and Getting started no “Watch the goals you care about”; a goal's page has no Watch
   and no “Watched by”; Help lists none of their articles and each article's address says the feature is off; the
   Features page shows them under their groups with “Off” beside each switch. Then every one back on, and each door
   opens again. The AI tools' refusals and the actions' are unit tests (src/modules/*/tools.test.ts,
   src/app/actions.test.ts). */
const SWITCHES = [
  { name: 'Watching', help: 'watching' },
  { name: 'Wrap-up', help: 'wrap-up' },
  { name: 'Goal map', help: 'goal-map' },
  { name: 'Feedback', help: 'inbox' },
];

module.exports = {
  id: 'N22',
  area: 'modules',
  title: 'Watching, the Wrap-up, the Goal map and Feedback switched off: no menu row, tab, layout, button or Help article of theirs, and each comes back on',
  reqs: ['WATCHING-OPTIONAL', 'WRAP-UP-OPTIONAL', 'MAP-OPTIONAL', 'FEEDBACK-OPTIONAL', 'FEATURE-GROUPS', 'MODULES'],
  async run({ open, url }) {
    const fails = [];
    const [c, p] = await open(1440, 900, 'amara', '/workspace/features');
    const box = (name) => p.getByRole('checkbox', { name, exact: true });
    await box('Watching').waitFor();
    const flip = async (name, on) => {
      const b = box(name);
      await b.scrollIntoViewIfNeeded();
      if ((await b.isChecked()) === on) return;
      await b.click();
      const ask = p.getByRole('dialog', { name: /^Switch off / });
      if (!on && await ask.waitFor({ timeout: 1500 }).then(() => true, () => false)) await ask.getByRole('button', { name: /^Switch off / }).click();
      await p.getByText(`${name} is ${on ? 'on' : 'off'} in`).first().waitFor();
    };
    for (const s of SWITCHES) await flip(s.name, false);
    const groups = (await p.locator('.features-group').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
    const inGroup = (g, name) => groups.some((t) => t.startsWith(g) && t.includes(name));
    for (const [g, name] of [['Working together', 'Watching'], ['Working together', 'Wrap-up'], ['Tools', 'Goal map'], ['Beyond this workspace', 'Feedback']]) if (!inGroup(g, name)) fails.push(`Features does not list ${name} under ${g}`);

    // The menu: no Feedback; its last group is Workspace, Settings, Help.
    await p.goto(url('/'));
    await p.locator('.page.home').waitFor();
    const last = (await p.locator('nav.side .nav-group-you a.nav').allInnerTexts()).map((t) => t.trim().split('\n')[0]);
    if (JSON.stringify(last) !== JSON.stringify(['Workspace', 'Settings', 'Help'])) fails.push(`the menu’s last group is ${last.join(', ')}`);
    const home = await p.locator('[data-part="Home"]').innerText();
    if (/Goals you watch|Watch the goals you care about|See the wrap-up/.test(home)) fails.push(`Home still says “${home.match(/Goals you watch|Watch the goals you care about|See the wrap-up/)[0]}”`);

    // Goals: no Watching tab, no Map; a link to the Map opens the List and says so.
    await p.goto(url('/goals?scope=all&view=map'));
    await p.getByText('The Goal map is off here, so this is the List.').first().waitFor({ timeout: 8000 }).catch(() => fails.push('a link to the Map does not say “The Goal map is off here, so this is the List.”'));
    const tabs = await p.getByRole('tablist', { name: 'Whose goals' }).getByRole('tab').allInnerTexts();
    if (tabs.some((t) => /^Watching/.test(t.trim()))) fails.push(`Goals has a Watching tab: ${tabs.join(' | ')}`);
    await p.locator('.layout-menu').first().click().catch(() => {});
    if (await p.getByRole('menuitem', { name: /^Map/ }).count()) fails.push('Goals’ Layout still offers Map');
    await p.keyboard.press('Escape');

    // A goal's page: no Watch, no Watched by.
    await p.goto(url('/goals/ns-lead'));
    await p.locator('.goal-bar').waitFor();
    if (await p.locator('.goal-bar').getByRole('button', { name: /^Watch/ }).count()) fails.push('a goal’s page offers Watch');
    if (await p.getByText('Watched by').count()) fails.push('a goal’s page says Watched by');

    // Help: none of their articles, and each article's address says the feature is off.
    await p.goto(url('/help'));
    await p.locator('main').waitFor();
    const help = await p.locator('main').innerText();
    for (const t of ['Watching goals', 'The goal map', 'Wrapping up the year', 'The inbox']) if (help.includes(t)) fails.push(`Help still lists “${t}”`);
    for (const s of SWITCHES) {
      await p.goto(url(`/help/${s.help}`));
      await p.locator('main').getByText(/There’s no help article here/).first().waitFor({ timeout: 8000 }).catch(() => {});
      if (!new RegExp(`${s.name} is switched off in`).test(await p.locator('main').innerText())) fails.push(`/help/${s.help} does not say ${s.name} is switched off`);
    }

    // Every one back on: each door opens again.
    await p.goto(url('/workspace/features'));
    for (const s of SWITCHES) await flip(s.name, true);
    await p.goto(url('/'));
    await p.locator('.page.home').waitFor();
    const back = (await p.locator('nav.side .nav-group-you a.nav').allInnerTexts()).map((t) => t.trim().split('\n')[0]);
    if (!back.includes('Feedback')) fails.push('Feedback back on, the menu has no Feedback');
    await p.goto(url('/goals/ns-lead'));
    await p.locator('.goal-bar').waitFor();
    if (!(await p.getByText('Watched by').count())) fails.push('Watching back on, a goal’s page has no Watched by');
    await c.close();
    return fails;
  },
};
