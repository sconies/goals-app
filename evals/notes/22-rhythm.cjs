/* N22: the check-in rhythm's rules hold on screen (FT1, docs/design/feature-toggles/spec.md 4.2 and 9). run({ open, url })
   returns a list of failures. As Amara, an admin: the Change sheet's read-back counts what the rule counts
   (rhythmReadBack: the live goals, and those that stop reading No recent update), and Save is offered only once the
   choice differs. As Rhea, who isn't an admin, Features is not hers to open and the Change button is not there; the rule
   refuses her too (setRhythm, its unit test in src/domain/rhythm.test.ts). */
module.exports = {
  id: 'N22',
  area: 'rhythm',
  title: 'The check-in rhythm: the read-back counts what the rule counts; only an admin can change it',
  reqs: ['RHYTHM-OPTIONAL', 'ADMIN'],
  async run({ open, url }) {
    const fails = [];
    const [c, p] = await open(1440, 900, 'amara', '/workspace/features');
    const change = p.locator('.rhythm-row').getByRole('button', { name: 'Change' });
    await change.waitFor();
    await change.click();
    const sheet = p.getByRole('dialog', { name: 'Check-in rhythm' });
    if (!(await sheet.getByRole('button', { name: 'Save' }).isDisabled())) fails.push('Save is offered before the choice differs');
    await sheet.getByRole('radio', { name: /No set rhythm/ }).click();
    const said = (await sheet.innerText()).replace(/\s+/g, ' ');
    // The same goals the Goals page lists as live this year, and those it says have no recent update.
    await p.goto(url('/goals?scope=all&status=stale'));
    await p.locator('.goals-line').waitFor();
    const quiet = Number(((await p.locator('.goals-line').innerText()).match(/(\d+) goals?/) ?? [])[1] ?? NaN);
    const n = Number((said.match(/(\d+) goals? (?:has|have) nothing due/) ?? [])[1] ?? NaN);
    const stop = Number((said.match(/(\d+) goals? stops? reading “No recent update”/) ?? [])[1] ?? 0);
    if (!(n > 0)) fails.push(`the read-back does not count the goals with nothing due: ${said.slice(0, 300)}`);
    if (Number.isFinite(quiet) && stop !== quiet) fails.push(`the read-back says ${stop} stop reading No recent update; Goals lists ${quiet} with it`);
    await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'rhea'));
    await p.goto(url('/workspace/features'));
    await p.waitForTimeout(500);
    if (await p.locator('.rhythm-row').getByRole('button', { name: 'Change' }).count()) fails.push('Rhea, who isn’t an admin, is offered Change on the check-in rhythm');
    await c.close();
    return fails;
  },
};
