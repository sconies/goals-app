// U70: Back agrees (spec/core/journeys/U70.md).
export default {
  id: 'U70', title: 'Back agrees', budget: 9,
  async run(h) {
    await h.open('rhea');
    const wrong = [];
    for (const [addr, want] of [['/goals/lead-mq', 'Back to Merge-to-deploy time (median)'], ['/goals/ns-lead', 'Back to Goals'], ['/people/rhea', 'Back to People'], ['/help/goals', 'Back to Help'], ['/reviews/weekly', 'Back to Reviews']]) {
      await h.open('rhea');
      await h.goto(addr);
      const got = await h.p.locator('main .backlink').first().getAttribute('aria-label', { timeout: 2000 }).catch(() => null);
      if (got !== want) wrong.push(`${addr}: ${got}`);
    }
    for (const addr of ['/', '/goals?scope=all', '/settings', '/reviews', '/activity']) {
      await h.open('rhea');
      await h.goto(addr);
      const has = await h.p.locator('main .backlink').count();
      if (has) wrong.push(`${addr} has a back link`);
      if (!(await h.p.locator('main h1').first().isVisible().catch(() => false))) wrong.push(`${addr} has no heading`);
    }
    await h.check(`a new tab’s back link goes to the page’s parent (${wrong.join('; ')})`, () => !wrong.length, { point: 'entry' });
    await h.checkpoint('new tabs');
    await h.open('rhea');
    await h.goto('/goals?scope=all');
    await h.menu('Home');
    await h.menu('Goals');
    await h.address(/\/goals(\?|$)/);
    await h.click(h.p.locator('main a[href*="/goals/ns-lead"]').first(), 'Press Lead time for changes');
    await h.address(/\/goals\/ns-lead$/);
    const says = async () => (await h.p.locator('main .backlink').first().getAttribute('aria-label').catch(() => '')) || '';
    await h.check('the back link says Back to Goals', async () => /^Back to (Goals|your goals)$/.test(await says()), { point: 'finish' });
    await h.click(h.p.getByRole('main').locator('summary[aria-label="More about this goal"]'), 'Press the goal’s … menu');
    await h.click(h.p.getByRole('group', { name: 'More about this goal' }).getByRole('link', { name: 'Change this goal' }), 'Press Change this goal');
    await h.address(/\/edit$/);
    await h.p.getByRole('button', { name: 'Save changes' }).click();
    await h.address(/\/goals\/ns-lead$/);
    await h.check('the goal’s summary bar shows', () => h.visible(h.p.locator('.summary-bar')));
    await h.p.goBack();
    await h.address(/\/goals(\?|$)/, 'the browser’s Back steps over the form to Goals');
    await h.check('after saving, Back went to Goals', async () => new URL(h.p.url()).pathname === '/goals', { point: 'errors' });
    await h.p.goForward();
    await h.address(/\/goals\/ns-lead$/, 'Forward returns to the goal');
    await h.click(h.p.locator('main .backlink').first(), 'Press the back link');
    await h.address(/\/goals(\?|$)/, 'the back link goes to Goals');
  },
};
