/* N34: Fields switched off (TG1, docs/design/round-4/tags/spec.md section 6). run({ open, url }) returns a list of
   failures. As Amara, an admin, on a computer: with a field “Stage” added, a goal's page shows its Fields block and
   Workspace's menu has Fields; Goals' Filters sheet has a Stage row and Data's Goals table a Stage column (TG2).
   Switched off on Workspace, Features: the goal's page has no Fields block, Workspace's menu has no Fields,
   /workspace/fields is Page not found saying Fields is switched off, Goals has no Stage filter and Data no Stage column,
   and Help has no Fields article. Switched back on, they are back, the field with them. The AI tools' refusals,
   find_goals' fields filter among them, and the export's and import's columns are unit tests
   (src/modules/tags/tools.test.ts, sheet.test.ts). */
module.exports = {
  id: 'N34',
  area: 'modules',
  title: 'Fields switched off: no Fields block on a goal, no Workspace → Fields, no Stage filter on Goals or column on Data, its address says it is off, and it all comes back on',
  reqs: ['TAGS-OFF', 'TAGS-FILTER', 'MODULES'],
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
    // TG2's surfaces: a Stage row in Goals' Filters sheet, and a Stage column on Data's Goals table.
    const filterRow = async () => {
      await p.goto(url('/goals?scope=all'));
      await p.getByRole('button', { name: /^Filter(s| and sort)/ }).click();
      const sheet = p.getByRole('dialog', { name: 'Filter goals' });
      await sheet.waitFor();
      await sheet.getByRole('group', { name: 'Status' }).waitFor();
      const has = await sheet.getByRole('group', { name: 'Stage' }).count() > 0;
      await p.keyboard.press('Escape');
      return has;
    };
    const dataColumn = async () => {
      await p.goto(url('/data?t=goals'));
      await p.locator('main table').first().waitFor();
      return (await p.locator('main table thead').first().innerText()).includes('Stage');
    };
    if (!(await block())) fails.push('with Fields on, a goal’s page has no Fields block');
    if (!(await menu()).includes('Fields')) fails.push('with Fields on, Workspace’s menu has no Fields');
    if (!(await filterRow())) fails.push('with Fields on, Goals’ Filters sheet has no Stage row');
    if (!(await dataColumn())) fails.push('with Fields on, Data’s Goals table has no Stage column');

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
    if (await filterRow()) fails.push('with Fields off, Goals’ Filters sheet still has a Stage row');
    if (await dataColumn()) fails.push('with Fields off, Data’s Goals table still has a Stage column');
    // A link's Stage filter narrows nothing while Fields is off (as a switched-off module's filter never does).
    const fid = await p.evaluate(async () => (await window.__goalsStore.load('platform-org')).modules?.tags?.fields?.[0]?.id ?? 'none');
    await p.goto(url(`/goals?scope=all&view=list&f.${fid}=Build`));
    await p.locator('main').getByText('Flaky test rate in the main pipelines').first().waitFor({ timeout: 8000 }).catch(() => fails.push('with Fields off, Goals does not list every goal'));
    await p.goto(url('/help'));
    await p.locator('main').waitFor();
    if ((await p.locator('main').innerText()).includes('Fields: a workspace’s own columns on goals')) fails.push('Help still lists the Fields article');

    await flip(true);
    if (!(await block())) fails.push('Fields back on, a goal’s page has no Fields block');
    else if (!/Stage/.test(await p.locator('[data-part="Fields"]').innerText())) fails.push('Fields back on, the block does not show Stage');
    if (!(await menu()).includes('Fields')) fails.push('Fields back on, Workspace’s menu has no Fields');
    if (!(await filterRow())) fails.push('Fields back on, Goals’ Filters sheet has no Stage row');
    await c.close();
    return fails;
  },
};
