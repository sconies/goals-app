/* F16: New goal on a phone (onboarding spec, section 6; OB1). At 390 × 844 and 360 × 800, on each of the four steps:
   the step's first field and its primary button are on the first screen with the keyboard closed; no step is taller
   than two screens (the measure step with the plan table folded); every control is at least 44 px high, "Change"
   included; nothing scrolls sideways. Set-up's steps join this check with OB3. */
const steps = ['what', 'who', 'measure', 'check'];

module.exports = {
  id: 'F16',
  area: 'new-goal-phone',
  reqs: ['NEW-GOAL-STEPS', 'GOAL-CREATE'],
  title: 'New goal fits a phone: first field and Continue on the first screen, no step over two screens, 44 px controls (F16)',
  async run({ open }) {
    const fails = [];
    const f = (m) => fails.push(m);
    for (const [w, h] of [[390, 844], [360, 800]]) {
      const [c, p] = await open(w, h, 'mateo', '/goals/new', true);
      for (const step of steps) {
        await p.waitForURL(new RegExp(`/goals/new/${step}`));
        await p.waitForTimeout(250);
        if (step === 'measure') {
          await p.getByLabel('Unit').fill('%');
          await p.getByLabel(/^Baseline$/).fill('20');
          await p.getByLabel(/^Target$/).fill('90');
          await p.evaluate(() => document.activeElement && document.activeElement.blur());
          await p.evaluate(() => window.scrollTo(0, 0));
          await p.waitForTimeout(250);
        }
        const at = `${step} at ${w}`;
        const first = p.locator('.focus-body h1 ~ * :is(input, textarea, button):visible').first();
        const fr = await first.boundingBox();
        if (!fr || fr.y + fr.height > h) f(`${at}: the first field is not on the first screen`);
        const primary = await p.locator('.focus-foot .btn.primary').boundingBox();
        if (!primary || primary.y + primary.height > h || primary.y < 0) f(`${at}: the primary button is not on the first screen`);
        const tall = await p.evaluate(() => document.documentElement.scrollHeight);
        if (tall > 2 * h) f(`${at}: the step is ${tall}px tall, over two screens`);
        const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        if (sw > iw) f(`${at}: scrolls sideways (${sw} > ${iw})`);
        const small = await p.evaluate(() => [...document.querySelectorAll('.focus-body :is(button, input:not([type=checkbox]), select, textarea, summary)')]
          .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.pick-panel'))
          .map((e) => [e.getAttribute('aria-label') || (e.textContent || '').trim().slice(0, 24) || e.tagName, Math.round(e.getBoundingClientRect().height)])
          .filter(([, x]) => x < 44));
        if (small.length) f(`${at}: controls under 44px: ${small.slice(0, 4).map(([n, x]) => `${n} ${x}px`).join(', ')}`);
        if (step === 'what') await p.getByLabel(/Name it the way/).fill('Runbooks with an owner');
        // Mateo leads SRE, which owns north stars, so his level is asked (OB1, rule 1).
        if (step === 'who') await p.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Team' }).click();
        if (step !== 'check') await p.getByRole('button', { name: 'Continue' }).click();
      }
      await c.close();
    }
    return fails;
  },
};
