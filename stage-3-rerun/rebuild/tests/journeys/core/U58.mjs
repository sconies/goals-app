// U58: anyone finds a person and a team (spec/core/journeys/U58.md).
export default {
  id: 'U58', title: 'Anyone finds a person and a team', budget: 12,
  part: ['the finish check compares with Goals’ By team (/goals?show=teams), whose code the page cuts short and which this rebuild doesn’t draw'],
  async run(h) {
    await h.open('oskar');
    await h.goto('/');
    await h.menu('People');
    await h.address(/\/people$/);
    await h.check('the people rows show', () => h.visible(h.p.locator('.people-row').first()));
    const field = h.p.getByRole('searchbox', { name: 'Find by name, job title or team' });
    await h.inView(field, 'the field “Find by name, job title or team” is in view without scrolling');
    await h.check('the count line: N people, A to Z. Showing 1 to 50.', async () => /^\d+ people, A to Z\. Showing 1 to 50\.$/.test((await h.p.locator('.count-line').innerText()).trim()), { point: 'progress' });
    await h.checkpoint('people');
    await h.fill(field, 'rhea', 'Type “rhea”');
    await field.press('Enter');
    await h.p.waitForLoadState('domcontentloaded');
    await h.shows('1 person matches.');
    await h.check('the search is in the address', () => /[?&]q=rhea/.test(h.p.url()), { point: 'attention' });
    await h.click(h.p.locator('.people-row a').first(), 'Press the people row');
    await h.check('the “Rhea Kapoor” heading', () => h.visible(h.p.getByRole('heading', { name: 'Rhea Kapoor' })));
    const see = h.p.getByRole('link', { name: /^See Rhea’s \d+ goals$/ });
    await h.inView(see, 'the “See Rhea’s N goals” link is in view');
    await h.check('Rhea’s facts say she leads CI/CD and is a member', async () => { const f = await h.p.locator('.person-facts').innerText(); return /CI\/CD, which Rhea leads/.test(f) && /Member\./.test(f); }, { point: 'attention' });
    await h.checkpoint('person');
    await h.click(see, 'Press See Rhea’s N goals');
    await h.address(/\/goals\?.*owner=rhea/);
    await h.shows('Rhea Kapoor');
    await h.p.goBack();
    await h.check('the “Rhea Kapoor” heading, after Back', () => h.visible(h.p.getByRole('heading', { name: 'Rhea Kapoor' })));
    await h.goto('/teams');
    await h.check('the team rows show', () => h.visible(h.p.locator('.team-row').first()));
    await h.checkpoint('teams');
    await h.click(h.p.locator('.team-row a', { hasText: 'CI/CD' }), 'Press the CI/CD team row');
    await h.check('the “CI/CD” heading', () => h.visible(h.p.getByRole('heading', { name: 'CI/CD' })));
    await h.checkpoint('team');
    await h.click(h.p.getByRole('link', { name: /^See its \d+ goals$/ }), 'Press See its N goals');
    await h.address(/\/goals\?.*team=cicd/);
    await h.check('a member is offered no change', async () => (await h.p.getByRole('button', { name: /^(Add a person|Add a team|Change|Mark as left|Remove|Delete)/ }).count()) === 0, { point: 'errors' });
    for (const from of ['/workspace/people', '/workspace/people?team=cicd', '/workspace/people?team=-', '/workspace/teams']) {
      await h.goto(from);
      await h.check(`${from} leads to a page`, () => h.visible(h.p.locator('main h1')));
    }
  },
};
