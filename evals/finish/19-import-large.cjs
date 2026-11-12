/* N18 (b): size (IM6; docs/design/import/spec.md section 10). With 1,000, 5,000 and 30,000 generated rows, checking
   finishes within 3 s, 8 s and 20 s; no task on the page's thread is longer than 200 ms while it runs (the engine is in
   the import's worker); the preview has fewer than 3,000 elements. ("14 rows with one typo are one group" is held by
   src/domain/importSpeed.test.ts; N18 (a), the round trip, by src/domain/roundtrip.test.ts.) */
const rows = (k) => 'Goal,Owner,Team,Unit,Start,Target\n' + Array.from({ length: k }, (_, i) => `Generated goal ${i + 1},Rhea Kapoor,CI/CD,min,10,5\n`).join('');

module.exports = {
  id: 'N18',
  area: 'import',
  reqs: ['IMPORT-LARGE'],
  title: 'Size: 1,000, 5,000 and 30,000 rows are checked within 3, 8 and 20 seconds, the page never stops for more than 200 ms, and the preview has fewer than 3,000 elements',
  async run({ open }) {
    const fails = [];
    for (const [k, budget] of [[1000, 3000], [5000, 8000], [30000, 20000]]) {
      const [c, p] = await open(1440, 900, 'amara', '/data/import');
      await p.getByRole('button', { name: 'Choose a file' }).waitFor();
      const t = Date.now();
      await p.getByLabel('Choose a spreadsheet').setInputFiles({ name: `n18-${k}.csv`, mimeType: 'text/csv', buffer: Buffer.from(rows(k)) });
      // Watched from when the file is handed over: Playwright's own work putting 30,000 rows into the input is a long task
      // of the test's, not the page's. The page reads the file after this (File.text() is asynchronous).
      await p.evaluate(() => { window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); });
      const ok = await p.getByRole('heading', { name: 'Check this import' }).waitFor({ timeout: budget * 2 }).then(() => true, () => false);
      const took = Date.now() - t;
      if (!ok) { fails.push(`${k} rows: no preview after ${Math.round(took / 1000)} s`); await c.close(); continue; }
      if (took > budget) fails.push(`${k} rows: checked in ${(took / 1000).toFixed(1)} s, over ${budget / 1000} s`);
      await p.waitForTimeout(300);
      const long = await p.evaluate(() => window.__long.filter((d) => d > 200));
      if (long.length) fails.push(`${k} rows: the page stopped for ${long.join(', ')} ms`);
      const els = await p.evaluate(() => document.querySelectorAll('body *').length);
      if (els >= 3000) fails.push(`${k} rows: the preview has ${els} elements`);
      await c.close();
    }
    return fails;
  },
};
