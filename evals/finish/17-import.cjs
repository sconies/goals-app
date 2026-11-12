/* F17: the import's preview on a phone (IM3, docs/design/import/spec.md section 10). At 390 × 844 and 360 × 800: Import,
   the preview (with groups, answered and not) and the changes don't scroll sideways; every answer and button there is
   at least 44 px high; the primary action is on Import's first screen. (Imported, Past imports, Undo and Export come
   with IM4 and IM7.) */
const FILE = 'Goal,Owner,Team,Type,Unit,Start,Target\n' + Array.from({ length: 4 }, (_, i) => `Runner pool ${i + 1} wait,Rhea Kapoor,CI/DC,metric,min,10,5\n`).join('') + 'Cache warm-up,,CI/CD,metric,min,10,5\nMirror freshness,Rhea Kapoor,CI/CD,metric,min,10,5\n';

module.exports = {
  id: 'F17',
  area: 'import',
  reqs: ['IMPORT-PREVIEW', 'FIT-AND-FINISH'],
  title: 'The import’s preview on a phone: nothing scrolls sideways, every answer and button is 44 px high, Import’s primary action is on the first screen',
  async run({ open }) {
    const fails = [];
    const fail = (m) => fails.push(m);
    for (const [w, hgt] of [[390, 844], [360, 800]]) {
      const [c, p] = await open(w, hgt, 'amara', '/data/import', true);
      const sideways = async (where) => { await p.waitForTimeout(150); const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (over > 1) fail(`${w}px: ${where} scrolls sideways by ${over}px`); };
      const small = async (where) => {
        const low = await p.evaluate(() => [...document.querySelectorAll('main .import-check button, main .import-check .import-answer, main .import-check a.btn')].filter((e) => e.getClientRects().length).map((e) => ({ t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h < 44));
        if (low.length) fail(`${w}px: on ${where}, under 44px: ${low.map((x) => `${x.t} (${x.h})`).join(', ')}`);
      };
      const primary = await p.getByRole('button', { name: 'Choose a file' }).evaluate((e) => e.getBoundingClientRect().bottom);
      if (primary > hgt) fail(`${w}px: Import’s Choose a file is ${Math.round(primary)}px down, below the first screen`);
      await sideways('Import');
      await p.getByLabel('Choose a spreadsheet').setInputFiles({ name: 'f17.csv', mimeType: 'text/csv', buffer: Buffer.from(FILE) });
      await p.locator('.import-group').first().waitFor();
      await sideways('the preview'); await small('the preview');
      await p.getByRole('button', { name: /^Show the \d+ rows?$/ }).first().click();
      await sideways('a group’s rows');
      await p.getByRole('radio', { name: 'Use CI/CD' }).click();
      await p.locator('.import-answered').first().waitFor();
      await sideways('the preview, answered'); await small('the preview, answered');
      await c.close();
    }
    // The changes list, from a file with nothing to fix.
    const [c, p] = await open(390, 844, 'amara', '/data/import', true);
    await p.getByLabel('Choose a spreadsheet').setInputFiles({ name: 'f17b.csv', mimeType: 'text/csv', buffer: Buffer.from('Goal,Owner,Team,Type,Unit,Start,Target\nMirror freshness,Rhea Kapoor,CI/CD,metric,min,10,5\n') });
    await p.getByRole('link', { name: 'Show the 1 change' }).click();
    await p.locator('.import-change').first().waitFor();
    await p.waitForTimeout(150);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (over > 1) fail(`390px: the changes scroll sideways by ${over}px`);
    await c.close();
    return fails;
  },
};
