// U65: Find from anywhere (spec/core/journeys/U65.md). How Find opens isn't on the page: the runner presses Ctrl K (gap S3).
export default {
  id: 'U65', title: 'Find from anywhere', budget: 6,
  async run(h) {
    await h.open('oskar');
    await h.goto('/');
    await h.check('the menu shows', () => h.visible((h.phone ? h.p.getByRole('navigation', { name: 'Tabs' }) : h.p.getByRole('navigation', { name: 'Menu' }))));
    if (!h.phone) await h.check('the “Find” button in the sidebar is visible', () => h.visible(h.p.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Find' })), { point: 'entry' });
    await h.p.keyboard.press('Control+k');
    const find = h.p.getByRole('dialog', { name: 'Find' });
    const box = find.getByRole('combobox');
    await h.check('the search is focused when Find opens', () => box.evaluate((e) => e === document.activeElement), { point: 'entry' });
    await find.getByText(/Type a name|Opened lately/).first().waitFor({ timeout: 4000 }).catch(() => {});
    await find.getByText(/Type a name|Opened lately/).first().waitFor({ timeout: 4000 }).catch(() => {});
    await h.check('Find shows what to type', async () => /Opened lately|Type a name, a key like G-48, or a few words\./.test(await find.innerText()), { point: 'attention' });
    await h.checkpoint('find');
    await h.fill(box, 'G-48', 'Type “G-48”');
    await h.check('“Goals · 1”', () => h.visible(find.getByRole('group', { name: 'Goals · 1' })));
    await box.press('Enter');
    await h.address(/\/goals\/[^/?]+/);
    await h.check('the Find dialog goes away', async () => find.waitFor({ state: 'hidden', timeout: 4000 }).then(() => true));
    await h.check('Enter on G-48 opened G-48', async () => (await h.p.locator('main .gkey').first().innerText()) === 'G-48', { point: 'progress' });
    await h.p.keyboard.press('Control+k');
    await h.fill(box, 'rhea', 'Type “rhea”');
    await h.check('“People · 1”', () => h.visible(find.getByRole('group', { name: 'People · 1' })));
    const groups = await find.getByRole('group').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    await h.check(`the core’s three kinds, in order (${groups.join(', ')})`, () => JSON.stringify(groups.filter((g) => /^(Goals|People|Teams) · /.test(g))) === JSON.stringify(['Goals · 8', 'People · 1', 'Teams · 1']), { point: 'attention' });
    await h.check('People shows Rhea Kapoor', async () => /Rhea Kapoor/.test((await find.getByRole('group', { name: 'People · 1' }).getByRole('option').allInnerTexts())[0] || ''), { point: 'finish' });
    const goals = find.getByRole('group', { name: 'Goals · 8' }).getByRole('option');
    await h.check('Goals shows three rows and See all 8 goals', async () => (await goals.count()) === 4 && /See all 8 goals/.test(await goals.last().innerText()), { point: 'finish' });
    await h.check('See all opens Goals with the search', async () => /\/goals\?scope=all&q=rhea/.test((await goals.last().getAttribute('href')) || ''), { point: 'a11y' });
    await h.checkpoint('rhea');
    const opts = await find.getByRole('option').allInnerTexts();
    const k = opts.findIndex((t) => t === 'CI/CD');
    for (let i = 0; i < k; i++) await box.press('ArrowDown');
    await box.press('Enter');
    await h.address(/\/teams\/cicd/, 'Enter on CI/CD opens /teams/cicd');
    await h.p.keyboard.press('Escape');
    await h.check('Escape closes Find', async () => find.waitFor({ state: 'hidden', timeout: 4000 }).then(() => true), { point: 'errors' });
  },
};
