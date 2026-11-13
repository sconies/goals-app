/* N28: a reading is a suggestion, never a check-in (NR, docs/design/round-4/readings/spec.md 2.3 and answer a). With the
   demo's number sources registered, Daniel (CI pipeline time on main, read by CI analytics) and Rhea (Pipeline queue
   wait, read by CI runner metrics for CI/CD · main branch pipelines) each open Home, the week's check-in list and their
   goal's number step, which fills in the reading, and walk away without posting; Rhea also opens the one table. The
   store's check-ins for ns-ci and lead-ci-time are exactly as before, and none carries a reading. run({ open }) returns
   a list of failures. */
const GOALS = ['ns-ci', 'lead-ci-time'];
const of = (s) => JSON.stringify((s?.checkIns ?? []).filter((c) => GOALS.includes(c.goalId)).map((c) => [c.id, c.goalId, c.week, c.value, c.postedAt, c.reading ?? null]).sort());

module.exports = {
  id: 'N28',
  area: 'metrics',
  title: 'A reading is never posted for anyone: opening Home, the check-in list, the number step and the one table and leaving creates no check-in for a goal on a read metric',
  reqs: ['READING-RECORDED-ONLY', 'READING-PREFILL'],
  async run({ open }) {
    const fails = [];
    for (const [who, goal, table] of [['daniel', 'ns-ci', false], ['rhea', 'lead-ci-time', true]]) {
      const [c, p] = await open(1440, 900, who, '/');
      const read = () => p.evaluate(() => window.__goalsStore.load('platform-org').catch(() => null));
      const before = of(await read());
      if (before === '[]') fails.push(`${who}: the store has no check-ins for ${GOALS.join(' or ')} to compare`);
      await p.goto(p.url().replace(/\/demo\/?[^?]*/, '/demo/check-in'));
      await p.locator('main').first().waitFor();
      await p.goto(p.url().replace(/\/demo\/[^?]*/, `/demo/check-in/${goal}`));
      const block = p.locator('.ci-reading-block');
      await block.waitFor({ timeout: 8000 }).catch(() => fails.push(`${who}: ${goal}’s number step drew no reading`));
      // The step is filled in for a fresh reading: walking away from it must post nothing.
      await p.waitForTimeout(400);
      if (table) {
        await p.goto(p.url().replace(/\/demo\/[^?]*/, '/demo/quick-check-in'));
        await p.locator('.qrow').first().waitFor().catch(() => fails.push(`${who}: the one table did not open`));
        await p.waitForTimeout(400);
      }
      await p.goto(p.url().replace(/\/demo\/[^?]*/, '/demo/'));
      await p.locator('main').first().waitFor();
      const after = of(await read());
      if (after !== before) fails.push(`${who}: the check-ins for ${GOALS.join(' and ')} changed without a post (${before.length} → ${after.length} characters)`);
      if (/"source"/.test(after)) fails.push(`${who}: a check-in carries a reading nobody posted`);
      await c.close();
    }
    return fails;
  },
};
