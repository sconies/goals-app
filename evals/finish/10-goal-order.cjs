/* F14: a goal's page reads in one order at every width (goal spec, 2.1; GT1). run({ open }) returns a list of failures.
   At 390 the sections come in the spec's order for each of eight demo goals; at 1440 the main column's and the side
   column's are each in that order. At 390 × 844 the status, the number, the primary action (when there is one) and the
   heading "Next steps and asks" are in the first screen; at 1440 × 900 so is the heading of Why. Nothing scrolls sideways. */

const GOALS = ['ns-lead', 'lead-flaky', 'ns-cfr', 'lead-mq', 'env-search', 'ns-ai', 'ci-docker', 'lead-rollback'];
// The sections by data-part, in the spec's order (the summary and the scorecard come first, in the bar).
const ORDER = ['Next steps and asks', 'Why', 'Chart', 'Review notes', 'What feeds it', 'Quarters', 'Activity', 'About this goal'];

const read = (p) => p.evaluate((order) => {
  const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
  const fold = bar ? bar.getBoundingClientRect().top : innerHeight;
  const parts = (root) => [...(root ?? document).querySelectorAll('[data-part]')].map((e) => e.getAttribute('data-part')).filter((x) => order.includes(x));
  const bottom = (sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; return Math.round(e.getBoundingClientRect().bottom); };
  return {
    fold,
    all: parts(document.querySelector('.goal-col')),
    main: parts(document.querySelector('.goal-main')),
    side: parts(document.querySelector('.goal-side')),
    status: bottom('.goal-bar .bar-status'), now: bottom('.goal-bar .bar-now'),
    primary: document.querySelector('.goal-bar .bar-actions .btn.primary') ? bottom('.goal-bar .bar-actions .btn.primary') : 0,
    next: bottom('#g-next'), why: bottom('#g-why'),
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, ORDER);

const inOrder = (list) => list.every((x, i) => !i || ORDER.indexOf(list[i - 1]) < ORDER.indexOf(x));

module.exports = {
  id: 'F14',
  area: 'goal-order',
  title: 'A goal’s page reads in one order on a computer and a phone, and what to act on is in the first screen',
  reqs: ['GOAL-ACT', 'GOAL-ASK-ONCE'],
  async run({ open }) {
    const fails = [];
    for (const [w, h, who] of [[390, 844, 'rhea'], [1440, 900, 'amara']]) {
      for (const id of GOALS) {
        const [c, p] = await open(w, h, who, `/goals/${id}`, w < 800);
        await p.locator('.goal-bar').waitFor();
        await p.waitForTimeout(300);
        const f = await read(p);
        const at = `${id} at ${w}`;
        if (w < 800) {
          if (!inOrder(f.all)) fails.push(`${at}: sections in the order ${f.all.join(' / ')}`);
          for (const [k, v] of [['status', f.status], ['number', f.now], ['main button', f.primary], ['Next steps and asks', f.next]]) {
            if (v == null || v > f.fold) fails.push(`${at}: ${k} is not in the first screen (${v} > ${Math.round(f.fold)})`);
          }
        } else {
          if (!inOrder(f.main)) fails.push(`${at}: main column in the order ${f.main.join(' / ')}`);
          if (!inOrder(f.side)) fails.push(`${at}: side column in the order ${f.side.join(' / ')}`);
          if (f.why != null && f.why > f.fold) fails.push(`${at}: the heading of Why is below the first screen`);
          if (f.next == null || f.next > f.fold) fails.push(`${at}: the heading Next steps and asks is below the first screen`);
        }
        if (f.sideways > 1) fails.push(`${at}: scrolls sideways by ${f.sideways}px`);
        await c.close();
      }
    }
    return fails;
  },
};
