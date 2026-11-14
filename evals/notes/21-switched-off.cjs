/* N21: a switched-off module's addresses (FT2, docs/design/feature-toggles/spec.md sections 3, 4.2 and 9). run({ open, url })
   returns a list of failures. As Amara, an admin, on a computer: switching Reviews off first reads back what stays, and
   its counts are the workspace's (the rule switchOffReadBack: reviews not ended or removed, what was said or marked in
   them, the open next steps and questions raised in one); then, with every installed module switched off, each of their
   routes (from each module.json) is Page not found with “{Name} is switched off in {workspace}. An admin can switch it on
   in Workspace, Features.”, a link for an admin, and its Help link (if any) doesn't open the module's hidden article;
   Help lists none of their articles, Reviews' article address says it is off, and What's new still lists their releases
   (Lane, 14 Nov). For Rhea, who isn't an admin, the
   line is words, not a link, and Features offers her no switch (setModule refuses her too: src/domain/actions.ts, its
   unit test). */
const fs = require('fs');
const path = require('path');

const MODULES = fs.readdirSync(path.join(__dirname, '../../src/modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(__dirname, '../../src/modules', d.name, 'module.json')))
  .map((d) => require(`../../src/modules/${d.name}/module.json`));
/** A route as an address: each parameter given a value. */
const address = (route) => route.replace(/:[A-Za-z]+/g, 'x');
/** Each module's Help articles (its help.ts), which are hidden while it is off (Lane, 14 Nov). */
const ARTICLES = Object.fromEntries(MODULES.map((m) => {
  const f = path.join(__dirname, '../../src/modules', m.id, 'help.ts');
  return [m.id, fs.existsSync(f) ? [...fs.readFileSync(f, 'utf8').matchAll(/^    id: '([^']+)'/gm)].map((x) => x[1]) : []];
}));
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;

module.exports = {
  id: 'N21',
  area: 'modules',
  title: 'A switched-off module’s addresses say so, and who can switch it on; the read-back before switching Reviews off counts what stays',
  reqs: ['REVIEWS-OPTIONAL', 'MODULES'],
  async run({ open, url }) {
    const fails = [];
    const [c, p] = await open(1440, 900, 'amara', '/workspace/features');
    const box = (name) => p.getByRole('checkbox', { name, exact: true });
    await box('Reviews').waitFor();

    // The read-back's counts are the workspace's, as the rule counts them.
    const s = await p.evaluate(() => window.__goalsStore.load('platform-org'));
    const cycleId = s.goals.find((g) => g.id === 'ns-lead')?.cycleId;
    const inCycle = new Set(s.goals.filter((g) => g.cycleId === cycleId && !g.removedAt).map((g) => g.id));
    const asks = (s.requests ?? []).filter((r) => r.goalIds.some((id) => inCycle.has(id)));
    const want = {
      people: s.people.filter((x) => !x.leftAt && !x.removedAt).length,
      reviews: s.reviews.filter((r) => !r.removedAt && !r.endedAt).length,
      said: s.changes.filter((x) => x.entity === 'review' || x.entity === 'decision').length,
      steps: asks.filter((a) => a.kind === 'action' && a.status === 'open' && a.reviewId).length,
      questions: asks.filter((a) => a.kind === 'question' && a.status === 'open' && a.reviewId).length,
      // RS2: risks a review accepted, on goals not removed.
      risks: s.decisions.filter((d) => d.kind === 'note' && !d.removedAt && /^We accept the risk: /.test(d.note) && s.goals.some((g) => g.id === d.goalId && !g.removedAt)).length,
    };
    await box('Reviews').click();
    const sheet = p.getByRole('dialog', { name: /^Switch off Reviews in / });
    await sheet.waitFor();
    const said = (await sheet.innerText()).replace(/\s+/g, ' ');
    const expect = [
      `For all ${want.people} people here:`,
      'Reviews leaves the menu, and Home’s “Next review”.',
      ...(want.reviews ? [`${n(want.reviews, 'review stays', 'reviews stay')} in the record${want.said ? `, with the ${n(want.said, 'thing', 'things')} said or marked in ${want.reviews === 1 ? 'it' : 'them'}` : ''}.`] : []),
      ...(want.steps ? [`${n(want.steps, 'open next step', 'open next steps')} agreed in a review ${want.steps === 1 ? 'stays' : 'stay'} open on their goals and on Home.`] : []),
      ...(want.questions ? [`${n(want.questions, 'question', 'questions')} waiting for a review ${want.questions === 1 ? 'stays' : 'stay'} open`] : []),
      ...(want.risks ? [`${n(want.risks, 'accepted risk stays on its goal', 'accepted risks stay on their goals')}, as ${want.risks === 1 ? 'it was' : 'they were'} said. No new one can be accepted while Reviews is off.`] : []),
      'Check-ins are still due by Thursday. “Before the review” becomes “by Thursday” on Home, in the check-in and in the count of goals checked in on time.',
      'Nothing is deleted. Switch Reviews back on and every review is as it was.',
    ];
    for (const line of expect) if (!said.includes(line)) fails.push(`the read-back does not say “${line}”: ${said.slice(0, 400)}`);
    if (!want.steps && /open next step/.test(said)) fails.push('the read-back counts open next steps there are none of');
    if (!want.risks && /accepted risk/.test(said)) fails.push('the read-back counts accepted risks there are none of');
    await sheet.getByRole('button', { name: 'Switch off Reviews' }).click();
    await p.getByText('Reviews is off in').first().waitFor();

    // Every other installed module off too: at once, or through its read-back when it owns something (SW1).
    for (const m of MODULES.filter((x) => x.id !== 'reviews')) {
      const b = box(m.name);
      if (!(await b.count()) || !(await b.isChecked())) continue;
      await b.click();
      const ask = p.getByRole('dialog', { name: /^Switch off / });
      if (await ask.waitFor({ timeout: 1500 }).then(() => true, () => false)) await ask.getByRole('button', { name: /^Switch off / }).click();
      await p.getByText(`${m.name} is off in`).first().waitFor();
    }

    // Each module's routes: the not-found page with the line, “Workspace, Features” a link for an admin.
    for (const m of MODULES) {
      // Its routes and its old addresses (Feedback's /inbox: SW1).
      for (const r of [...m.routes, ...(m.redirects || []).map(([from]) => from)]) {
        await p.goto(url(address(r)));
        const main = p.locator('main');
        await main.getByText('Page not found').first().waitFor({ timeout: 8000 }).catch(() => {});
        const text = (await main.innerText().catch(() => '')).replace(/\s+/g, ' ');
        if (!/Page not found/.test(text)) { fails.push(`${m.name} off: ${r} is not Page not found`); continue; }
        if (!new RegExp(`${m.name} is switched off in .+\\. An admin can switch it on in Workspace, Features\\.`).test(text)) fails.push(`${m.name} off: ${r} does not say “${m.name} is switched off in …”`);
        else if (!(await main.getByRole('link', { name: 'Workspace, Features' }).count())) fails.push(`${m.name} off: on ${r}, “Workspace, Features” is not a link for an admin`);
        // The page's Help link doesn't lead to its hidden article.
        const foot = await p.locator('.page-help-link').getAttribute('data-article', { timeout: 500 }).catch(() => null);
        if (foot && ARTICLES[m.id].includes(foot)) fails.push(`${m.name} off: ${r}'s Help link opens its hidden article ${foot}`);
      }
    }
    await p.goto(url('/help/reviews'));
    await p.locator('main').getByText(/There’s no help article here/).first().waitFor({ timeout: 8000 }).catch(() => {});
    if (!/Reviews is switched off in/.test(await p.locator('main').innerText())) fails.push('Reviews off: /help/reviews does not say Reviews is switched off');
    // Help lists none of an off module's articles; What's new keeps their releases (Lane, 14 Nov).
    await p.goto(url('/help'));
    await p.locator('main h1').first().waitFor({ timeout: 8000 }).catch(() => {});
    for (const m of MODULES) for (const id of ARTICLES[m.id]) if (await p.locator(`main a[href$="/help/${id}"]`).count()) fails.push(`${m.name} off: Help still lists its article ${id}`);
    await p.goto(url('/whats-new'));
    await p.locator('main').getByText('Reviews can be switched off, and nothing they saved is lost').first().waitFor({ timeout: 8000 }).catch(() => {});
    if (!/Reviews can be switched off, and nothing they saved is lost/.test(await p.locator('main').innerText())) fails.push('Reviews off: What’s new no longer lists Reviews’ releases');

    // Rhea isn't an admin: the line is words, not a link, and Features offers her no switch.
    await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'rhea'));
    await p.goto(url('/reviews'));
    await p.locator('main').getByText('Page not found').first().waitFor({ timeout: 8000 }).catch(() => {});
    const rhea = await p.locator('main').innerText();
    if (!/Reviews is switched off in/.test(rhea)) fails.push('for Rhea, /reviews does not say Reviews is switched off');
    if (await p.locator('main').getByRole('link', { name: 'Workspace, Features' }).count()) fails.push('for Rhea, who isn’t an admin, “Workspace, Features” is a link');
    await p.goto(url('/workspace/features'));
    await p.waitForTimeout(500);
    if (await p.getByRole('checkbox', { name: 'Reviews', exact: true }).count()) fails.push('Features offers Rhea, who isn’t an admin, the Reviews switch');
    await c.close();
    return fails;
  },
};
