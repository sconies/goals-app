// U66: a near miss on Goals (spec/core/journeys/U66.md).
export default {
  id: 'U66', title: 'A near miss', budget: 4,
  async run(h) {
    await h.open('amara');
    await h.goto('/goals?scope=all');
    const box = h.p.getByRole('searchbox', { name: 'Find a goal' });
    await h.inView(box, 'the “Find a goal” search field is in view without scrolling');
    await h.fill(box, 'rolback', 'Type “rolback”');
    await box.press('Enter');
    await h.p.waitForLoadState('domcontentloaded');
    await h.shows('No goal matches “rolback”. Showing goals that match “rollback”.');
    await h.check('the goals matching “rollback” are shown', () => h.visible(h.p.locator('.goal-row', { hasText: /rollback/i }).first()), { point: 'finish' });
    await h.check('the field keeps what was typed', async () => (await h.p.getByRole('searchbox', { name: 'Find a goal' }).inputValue()) === 'rolback', { point: 'errors' });
    await h.checkpoint('near miss');
    const before = h.p.url();
    await h.click(h.p.getByRole('button', { name: 'Clear the search' }), 'Press Clear the search');
    await h.check('the address changes', () => h.p.url() !== before);
    await h.check('Clear the search clears it', async () => !/[?&]q=/.test(h.p.url()) && (await h.p.getByRole('searchbox', { name: 'Find a goal' }).inputValue()) === '', { point: 'progress' });
  },
};
