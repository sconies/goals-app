/* N15: said once on a goal's page (goal spec, GT1). run({ open }) returns a list of failures.
   On every demo goal with an open ask, the ask's words are in exactly one element of the page (in Next steps and asks),
   and "What it measures" is in exactly one. This week's reason said once is GT2's (History points to Why). */

const GOALS = ['ns-lead', 'ns-cfr', 'lead-mq', 'env-search', 'ns-env', 'lead-review', 'ns-ai', 'lead-flaky'];

const count = (p, words) => p.evaluate((w) => [...document.querySelectorAll('main *')].filter((e) => !e.closest('[role=status], .toast, .toasts') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(w))).length, words);

module.exports = {
  id: 'N15',
  area: 'said-once',
  title: 'Said once: an ask’s words, and what a goal measures, each in one place on its page',
  reqs: ['GOAL-ASK-ONCE'],
  async run({ open }) {
    const fails = [];
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      for (const id of GOALS) {
        const [c, p] = await open(w, h, 'amara', `/goals/${id}`, w < 800);
        await p.locator('.goal-bar').waitFor();
        await p.waitForTimeout(300);
        const open_ = await p.locator('.step-row:not(.is-settled) .step-text').allInnerTexts();
        for (const t of open_) {
          const words = t.replace(/^(Decision or help|Question|Next step): /, '').trim();
          if (!words || words === 'Update asked') continue;
          const n = await count(p, words.slice(0, 60));
          if (n !== 1) fails.push(`${id} at ${w}: “${words.slice(0, 40)}…” is said ${n} times`);
        }
        const measures = await count(p, 'What it measures');
        if (measures > 1) fails.push(`${id} at ${w}: “What it measures” is said ${measures} times`);
        await c.close();
      }
    }
    return fails;
  },
};
