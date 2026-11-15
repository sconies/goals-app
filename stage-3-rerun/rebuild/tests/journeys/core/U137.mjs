// U137: read back before it's saved (spec/core/journeys/U137.md), as far as this rebuild's New goal goes.
export default {
  id: 'U137', title: 'Read back before it’s saved', budget: 30,
  part: ['the expected sentences of the read-back rows are cut short on the page (“want”); the owner-in-another-team question (“Keep it in CI/CD”) and the review line need the Reviews module and a question step this rebuild doesn’t draw'],
  async run(h) {
    await h.open('tunde', { today: '2026-11-11' });
    await h.goto('/goals/new');
    await h.address(/\/goals\/new\/what$/);
    await h.check('a progress indicator is visible', () => h.visible(h.p.getByText(/step 1 of 4/)), { point: 'progress' });
    await h.fill(h.p.getByLabel(/^Name it the way/), 'Signed artifacts in staging', 'Type the name');
    await h.click(h.p.getByRole('button', { name: 'Continue' }), 'Press Continue');
    await h.address(/\/goals\/new\/who$/);
    await h.p.getByLabel('Find the goal it feeds').fill('G-41');
    await h.p.getByLabel('Find the team').fill('CI/CD');
    await h.click(h.p.getByRole('button', { name: 'Continue' }), 'Press Continue (it picks the goal and team typed)');
    await h.click(h.p.getByRole('button', { name: 'Continue' }), 'Press Continue');
    await h.address(/\/goals\/new\/measure$/);
    await h.fill(h.p.getByLabel(/^Unit/), '%', 'Type the unit');
    await h.fill(h.p.getByLabel(/^Baseline/), '40', 'Type the baseline');
    await h.fill(h.p.getByLabel(/^Target/), '90', 'Type the target');
    await h.click(h.p.getByRole('button', { name: 'Continue' }), 'Press Continue');
    await h.address(/\/goals\/new\/check$/);
    await h.shows('Nothing is saved until you publish.');
    await h.inView(h.p.getByRole('button', { name: 'Publish goal' }), 'the Publish goal button is in view');
    const row = async (id) => ((await h.p.locator(`.goal-read-back li[data-row="${id}"] .rr-value`).innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    await h.check('What reads back the number to move', async () => (await row('what')) === 'A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.', { point: 'finish' });
    await h.check('Measured by says No metric', async () => /^No metric/.test(await row('measured')), { point: 'finish' });
    const after = await h.p.locator('.after-publish').innerText();
    await h.check('After you publish: the first check-in and the plan', () => after.includes('Its first check-in is due by Thursday 12 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.'), { point: 'attention' });
    await h.check('After you publish: the reviews it joins, who sees it, how long it can be taken back', () => after.includes('It joins Platform leadership weekly and Reliability weekly.') && after.includes('can see it.') && after.includes('Until its first check-in you can change anything, or delete it.'), { point: 'attention' });
    await h.checkpoint('check');
    await h.click(h.p.getByRole('link', { name: 'Change left as usual' }), 'Press Change on Left as usual');
    await h.address(/\/goals\/new\/measure/);
    await h.click(h.p.getByRole('button', { name: 'Continue' }), 'Press Continue');
    await h.address(/\/goals\/new\/check$/, 'Continue after Change goes back to Check');
  },
};
