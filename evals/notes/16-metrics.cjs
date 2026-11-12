/* N16: one set of numbers in the metric library (ML1, docs/design/metrics/spec.md section 6). run({ open }) returns a
   list of failures. For every metric in the demo's library, as an admin on a computer: its row's goals by status are its
   page's table's rows, status by status; "No goals yet" on the row is "No goal uses this metric yet." on the page; and
   "See its goal" / "See its {n} goals" opens Goals filtered to the metric (ML2), which counts the same goals. */
module.exports = {
  id: 'N16',
  area: 'metrics',
  title: 'One set of numbers: a metric’s row in the library counts the goals its page lists, status by status',
  reqs: ['METRICS-LIBRARY', 'HONEST-NUMBERS'],
  async run({ open }) {
    const fails = [];
    const [c, p] = await open(1440, 900, 'amara', '/metrics');
    await p.locator('.metric-row').first().waitFor();
    const rows = await p.locator('.metric-row').evaluateAll((rs) => rs.map((r) => ({
      href: r.getAttribute('href'),
      name: r.querySelector('.metric-name').textContent,
      counts: r.querySelector('.metric-counts')?.getAttribute('aria-label')?.split(': ').slice(1).join(': ') ?? '',
      none: !!r.querySelector('.metric-none'),
    })));
    if (rows.length < 13) fails.push(`the library lists ${rows.length} metrics, not the demo’s 13`);
    const LABELS = { on: 'on track', risk: 'at risk', off: 'off track', stale: 'no recent update', none: 'no check-in yet', planned: 'not started', done: 'done' };
    for (const r of rows) {
      await p.goto(p.url().replace(/\/demo\/[^?]*/, r.href.replace(/^.*\/demo/, '/demo').split('?')[0]));
      await p.getByRole('heading', { level: 1, name: r.name }).waitFor();
      const statuses = await p.locator('.metric-goals tbody tr .mg-status svg[data-status]').evaluateAll((es) => es.map((e) => e.dataset.status));
      const n = new Map();
      for (const s of statuses) n.set(s, (n.get(s) ?? 0) + 1);
      const page = [...n.entries()].map(([s, k]) => `${k} ${LABELS[s] ?? s}`).sort().join(', ');
      const row = r.counts.split(', ').filter(Boolean).sort().join(', ');
      if (page !== row) fails.push(`${r.name}: its row says “${row || 'no goals'}”, its page lists “${page || 'no goals'}”`);
      if (r.none !== !statuses.length) fails.push(`${r.name}: its row says ${r.none ? 'No goals yet' : 'it has goals'}, its page lists ${statuses.length}`);
      const heading = await p.locator('#metric-goals').innerText();
      if (!heading.endsWith(`· ${statuses.length}`)) fails.push(`${r.name}: its page’s heading says “${heading}” for ${statuses.length} rows`);
      if (statuses.length) {
        const see = await p.getByRole('link', { name: statuses.length === 1 ? 'See its goal' : `See its ${statuses.length} goals` }).getAttribute('href').catch(() => null);
        if (!see || !/[?&]metric=/.test(see)) { fails.push(`${r.name}: “See its goals” leads to ${see}, not Goals filtered to it`); continue; }
        const back = p.url();
        await p.goto(back.replace(/\/demo\/[^?]*\??[^#]*/, see.replace(/^.*\/demo/, '/demo') + (back.includes('today=') ? `&${back.split('?')[1]}` : '')));
        const line = await p.locator('main').getByText(/^\d+ goals? match/).first().innerText().catch(() => '');
        const shown = Number((line.match(/^(\d+)/) ?? [])[1] ?? -1);
        if (shown !== statuses.length) fails.push(`${r.name}: Goals filtered to it says “${line}”, its page lists ${statuses.length}`);
      }
    }
    await c.close();
    return fails;
  },
};
