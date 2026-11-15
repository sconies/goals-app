// U59: Workspace opens on About (spec/core/journeys/U59.md). "Switch to Rhea in the Demo panel" is the demo's: a fresh browser as Rhea here.
export default {
  id: 'U59', title: 'Workspace opens on About', budget: 8,
  part: ['its finish check’s list of the facts’ links is cut short on the page (“…”), so the runner checks the six sections it names'],
  async run(h) {
    await h.open('amara');
    await h.goto('/');
    await h.check('the menu shows', () => h.visible((h.phone ? h.p.getByRole('navigation', { name: 'Tabs' }) : h.p.getByRole('navigation', { name: 'Menu' }))));
    await h.menu('Workspace');
    await h.check('the workspace facts show', () => h.visible(h.p.locator('.ws-facts')));
    await h.inView(h.p.locator('.ws-facts dt'), 'the facts are in view without scrolling');
    await h.check('the role line says you’re an admin here', async () => (await h.p.locator('.ws-role-line').innerText()) === 'Platform Engineering · you’re an admin here', { point: 'progress' });
    await h.check('the facts lead to their sections', async () => { const links = await h.p.locator('.ws-facts a').evaluateAll((as) => as.map((a) => new URL(a.href).pathname)); return ['/people', '/workspace/cycles', '/workspace/access', '/workspace/features', '/workspace/privacy'].every((w) => links.includes(w)); }, { point: 'finish' });
    await h.check('nothing about another workspace', async () => (await h.p.locator('main').getByRole('link', { name: /Try it with your own team|Set up a workspace|Try the demo/ }).count()) === 0, { point: 'attention' });
    await h.checkpoint('about');
    if (h.phone) {
      const more = h.p.getByRole('list', { name: 'Workspace sections' });
      await h.check('the sections list shows', () => h.visible(more));
      await h.check('the facts come before the sections', async () => (await h.p.locator('.ws-facts').evaluate((e) => e.getBoundingClientRect().top + scrollY)) < (await more.evaluate((e) => e.getBoundingClientRect().top + scrollY)), { point: 'progress' });
      await h.click(more.getByRole('link', { name: 'Privacy' }), 'Press Privacy');
      await h.check('the Workspace link shows', () => h.visible(h.p.getByRole('link', { name: 'Workspace' }).first()));
    }
    await h.open('rhea');
    await h.goto('/workspace');
    await h.check('the workspace facts show for a member', () => h.visible(h.p.locator('.ws-facts')));
    const facts = await h.p.locator('.ws-facts').innerText();
    const sortOut = await h.p.getByRole('heading', { name: /To sort out/ }).count();
    await h.goto('/workspace/access');
    await h.shows('Access is for admins. The admins here are Amara Nwosu, Grace Achterberg and Hamid Rezaei.');
    await h.check('a member is told whom to ask, and sees nothing to sort out', () => /Ask one of them to add someone, change a team or change a setting\./.test(facts) && !sortOut, { point: 'errors' });
  },
};
