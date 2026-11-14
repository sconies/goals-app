/* N34: Fields switched off (TG1, docs/design/round-4/tags/spec.md section 6). run({ open, url }) returns a list of
   failures. As Amara, an admin, on a computer: with a field “Stage” added, a goal's page shows its Fields block and
   Workspace's menu has Fields. Switched off on Workspace, Features: the goal's page has no Fields block, Workspace's
   menu has no Fields, /workspace/fields is Page not found saying Fields is switched off, and Help has no Fields
   article. Switched back on, the block and the section are back, the field with them. The AI tools' refusals are unit
   tests (src/modules/tags/tools.test.ts). */
module.exports = {
  id: 'N34',
  area: 'modules',
  title: 'Fields switched off: no Fields block on a goal, no Workspace → Fields, its address says it is off, and it all comes back on',
  reqs: ['TAGS-OFF', 'MODULES'],
  async run({ open, url }) {
    const fails = [];
    const [c, p] = await open(1440, 900, 'amara', '/workspace/fields');
    // A field to draw: added as an admin would.
    await p.getByRole('button', { name: 'Add a field' }).first().click();
    const sheet = p.getByRole('dialog');
    await sheet.getByLabel('Name', { exact: true }).fill('Stage');
    await sheet.getByLabel(/^Values/).fill('Discover\nBuild\nRun');
    await sheet.getByRole('button', { name: 'Add the field' }).click();
    await p.getByRole('list', { name: 'Fields' }).getByText('A list: Discover, Build, Run').waitFor({ timeout: 8000 }).catch(() => fails.push('the field “Stage” was not added'));
    const block = async () => {
      await p.goto(url('/goals/lead-flaky'));
      await p.locator('.goal-bar').waitFor();
      await p.evaluate(() => { const d = document.querySelector('details#about'); if (d && !d.open) d.open = true; });
      return p.locator('[data-part="Fields"]').waitFor({ timeout: 4000 }).then(() => true, () => false);
    };
    const menu = async () => {
      await p.goto(url('/workspace'));
      await p.locator('nav.ws-menu').waitFor();
      return (await p.locator('nav.ws-menu').innerText()).split('\n').map((t) => t.trim());
    };
    if (!(await block())) fails.push('with Fields on, a goal’s page has no Fields block');
    if (!(await menu()).includes('Fields')) fails.push('with Fields on, Workspace’s menu has no Fields');

    const flip = async (on) => {
      await p.goto(url('/workspace/features'));
      const b = p.getByRole('checkbox', { name: 'Fields', exact: true });
      await b.waitFor();
      await b.scrollIntoViewIfNeeded();
      if ((await b.isChecked()) === on) return;
      await b.click();
      const ask = p.getByRole('dialog', { name: /^Switch off / });
      if (!on && await ask.waitFor({ timeout: 1500 }).then(() => true, () => false)) await ask.getByRole('button', { name: /^Switch off / }).click();
      await p.getByText(`Fields is ${on ? 'on' : 'off'} in`).first().waitFor();
    };
    await flip(false);
    if (await block()) fails.push('with Fields off, a goal’s page still has a Fields block');
    if ((await menu()).includes('Fields')) fails.push('with Fields off, Workspace’s menu still has Fields');
    await p.goto(url('/workspace/fields'));
    await p.getByText('Page not found').first().waitFor({ timeout: 8000 }).catch(() => fails.push('/workspace/fields is not Page not found with Fields off'));
    if (!/Fields is switched off in/.test(await p.locator('main').innerText())) fails.push('/workspace/fields does not say Fields is switched off');
    await p.goto(url('/help'));
    await p.locator('main').waitFor();
    if ((await p.locator('main').innerText()).includes('Fields: a workspace’s own columns on goals')) fails.push('Help still lists the Fields article');

    await flip(true);
    if (!(await block())) fails.push('Fields back on, a goal’s page has no Fields block');
    else if (!/Stage/.test(await p.locator('[data-part="Fields"]').innerText())) fails.push('Fields back on, the block does not show Stage');
    if (!(await menu()).includes('Fields')) fails.push('Fields back on, Workspace’s menu has no Fields');
    await c.close();
    return fails;
  },
};
