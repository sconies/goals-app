// U2: what needs me (spec/core/journeys/U2.md). Lines under “If the Watching module is on” run only with it built and on.
export default {
  id: 'U2', title: 'What needs me? Home', budget: 1,
  async run(h) {
    await h.open('rhea');
    await h.goto('/');
    await h.shows('Your goals');
    await h.check('“N needs attention” is shown', () => h.visible(h.p.getByText(/\d+ needs? attention/).first()));
    await h.checkpoint('home');
    await h.check('the ring in the hero is visible', () => h.visible(h.p.locator('.hero .ring')), { point: 'progress' });
    const cards = h.p.locator('.arow');
    await h.check('an attention card for Rhea’s own goals', async () => (await cards.count()) > 0);
    await h.check('attention rows have a reason and a status icon', async () => (await cards.locator('.arow-why').allInnerTexts()).every((r) => r.trim().length > 20) && (await h.p.locator('.arow[data-tone=risk] .arow-icon, .arow[data-tone=off] .arow-icon').count()) > 0, { point: 'attention' });
    await h.inView(cards.first().locator('.arow-title'), 'the first attention card’s title is on the first screen');
    await h.click(h.p.locator('.hero').getByRole('link', { name: /Start check-in|Pick up where you left off/ }), 'Press Start check-in');
    await h.shows('What’s the number this week?');
    await h.check('finish', () => true, { point: 'finish' });
  },
};
