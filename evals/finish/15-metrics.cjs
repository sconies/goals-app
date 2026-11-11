/* F15: the metric library on a phone (ML1, docs/design/metrics/spec.md section 6). run({ open }) returns a list of
   failures. At 390 px, as a member: the first metric on the library is within 300 px of the top; a row is at most three
   lines (a long name may take one more); a metric's goals are rows of their own, not a table that scrolls sideways; and
   nothing on the library, a metric, the form, or the pages the module adds to scrolls sideways. ("Measured by" found by
   typing, and its sheet's first result, come with ML2.) */
module.exports = {
  id: 'F15',
  area: 'metrics',
  reqs: ['METRICS-LIBRARY', 'FIT-AND-FINISH'],
  title: 'The metric library on a phone: the first metric near the top, rows of at most three lines, a metric’s goals as rows, nothing scrolls sideways',
  async run({ open }) {
    const fails = [];
    const fail = (m) => fails.push(m);

    const [c, p] = await open(390, 844, 'oskar', '/metrics', true);
    await p.locator('.metric-row').first().waitFor();
    const first = await p.locator('.metric-row').first().evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY));
    if (first > 300) fail(`390px: the first metric on the library is ${first}px from the top (at most 300)`);
    const rows = await p.locator('.metric-row').evaluateAll((rs) => rs.map((r) => {
      const name = r.querySelector('.metric-name');
      const lh = parseFloat(getComputedStyle(name).lineHeight) || 22;
      const lines = [...r.querySelectorAll('.metric-name, .metric-text .hint, .metric-side > *')].reduce((n, e) => n + Math.max(1, Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || lh))), 0);
      return { name: name.textContent, lines, buttons: r.querySelectorAll('button, .btn').length };
    }));
    const tall = rows.filter((r) => r.lines > (r.name.length > 30 ? 4 : 3));
    if (tall.length) fail(`390px: library rows over three lines: ${tall.map((r) => `${r.name} (${r.lines})`).join(', ')}`);
    if (rows.some((r) => r.buttons)) fail('390px: a library row has a button in it');

    // A metric's goals: each a block of its own on a phone, never a table wider than the page.
    await p.goto(p.url().replace(/\/demo\/[^?]*/, '/demo/metrics/queue-wait'));
    await p.locator('.metric-goals').waitFor();
    const table = await p.locator('.metric-goals').evaluate((t) => ({ display: getComputedStyle(t.querySelector('tbody tr')).display, wide: Math.round(t.scrollWidth - t.clientWidth) }));
    if (table.display !== 'block') fail(`390px: a metric’s goals are table rows (display ${table.display}), not rows of their own`);
    if (table.wide > 1) fail(`390px: a metric’s goals scroll sideways by ${table.wide}px`);

    const sideways = [];
    for (const path of ['/metrics', '/metrics?sortout=1', '/metrics/lead-time', '/metrics/flaky-rate', '/metrics/ci-cost', '/metrics/new', '/metrics/nope', '/people/rhea', '/teams/cicd', '/goals/ns-lead']) {
      await p.goto(p.url().replace(/\/demo\/[^?]*/, '/demo' + path));
      await p.locator('main h1, .focus h1').first().waitFor();
      await p.waitForTimeout(150);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 1) sideways.push(`${path} by ${over}px`);
    }
    if (sideways.length) fail(`390px: scrolls sideways: ${sideways.join(', ')}`);
    await c.close();
    return fails;
  },
};
