// MOD1: the module platform with one example module (spec/rebuild/module-platform.md, "What proves it"), by the screens.
// On: its menu row, page, part on a goal's page, Help article, Workspace section and Features switch. Switched off by an admin:
// gone, its address Page not found with its sentence, back on brings its note back. Off from the start: off. Left out: no switch at all.
export default {
  id: 'MOD1', title: 'A module on, switched off and left out', budget: 6,
  async run(h) {
    await h.open('amara');
    await h.goto('/');
    const nav = h.phone ? h.p.getByRole('navigation', { name: 'Tabs' }) : h.p.getByRole('navigation', { name: 'Menu' });
    if (h.mode === 'without') {
      await h.goto('/workspace/features');
      await h.check('Features shows no switch for a module left out', async () => (await h.p.getByRole('checkbox', { name: 'Example', exact: true }).count()) === 0);
      await h.goto('/example');
      await h.check('its address is Page not found, with no sentence', async () => (await h.p.title()).startsWith('Page not found') && !(await h.p.getByText(/Example is switched off/).count()));
      return;
    }
    if (h.mode === 'off') {
      await h.goto('/example');
      await h.shows('Example is switched off in Platform Engineering. An admin can switch it on in Workspace, Features.');
      await h.goto('/workspace/features');
      await h.check('its switch says Off', async () => (await h.p.locator('li[data-module="example"] .switch-word').innerText()) === 'Off');
      return;
    }
    if (!h.phone) await h.check('its menu row shows in Look up', () => h.visible(nav.getByRole('link', { name: 'Example', exact: true })));
    await h.goto('/goals/ns-lead');
    await h.check('its part is drawn on a goal’s page', () => h.visible(h.p.getByRole('heading', { name: 'Example notes' })));
    await h.fill(h.p.getByLabel('Add an example note'), 'A note from the example module', 'Type a note');
    await h.click(h.p.getByRole('button', { name: 'Add the note' }), 'Add the note');
    await h.shows('A note from the example module');
    await h.goto('/workspace/features');
    await h.click(h.p.getByRole('checkbox', { name: 'Example', exact: true }), 'Switch Example off');
    await h.shows('Example is off in Platform Engineering. Nothing it saved is lost.');
    await h.shows('Off until Example is on.');
    await h.goto('/goals/ns-lead');
    await h.check('its part is gone', async () => (await h.p.getByRole('heading', { name: 'Example notes' }).count()) === 0);
    await h.check('its menu row is gone', async () => (await h.p.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Example', exact: true }).count()) === 0);
    await h.goto('/example');
    await h.shows('Example is switched off in Platform Engineering. An admin can switch it on in Workspace, Features.');
    await h.goto('/help/example');
    await h.shows('Example is switched off in Platform Engineering. An admin can switch it on in Workspace, Features.');
    const snap = await h.snapshot();
    await h.check('the switch is in the log, with what went with it', () => snap.changes.some((c) => c.summary === 'Switched off Example, and with it Second example'), { point: 'logged' });
    await h.goto('/workspace/features');
    await h.click(h.p.getByRole('checkbox', { name: 'Example', exact: true }), 'Switch Example back on');
    await h.goto('/goals/ns-lead');
    await h.shows('A note from the example module');
    await h.open('rhea');
    await h.goto('/workspace/features');
    await h.shows('Features is for admins. The admins here are Amara Nwosu, Grace Achterberg and Hamid Rezaei.');
  },
};
