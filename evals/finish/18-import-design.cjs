/* P19: the design check on the import's new screens (IM3; docs/design-rules.md). On the preview with a Must fix and a
   Check: each is a word with the warning mark, never a status shape or a capsule; a Must-fix block is a wash with a full
   outline, no edge stripe; counts are plain numbers; no emoji. */
const FILE = 'Goal,Owner,Team,Type,Unit,Start,Target\nRunner pool wait,Rhea Kapoor,CI/DC,metric,min,10,5\nCache warm-up,,CI/CD,metric,min,10,5\n';

module.exports = {
  id: 'P19',
  area: 'import',
  reqs: ['IMPORT-PREVIEW', 'DESIGN-RULES'],
  title: 'The import’s preview keeps the design rules: Must fix and Check are words with the warning mark, a full outline and no stripe, plain counts, no capsules, no emoji',
  async run({ open }) {
    const fails = [];
    const [c, p] = await open(1280, 900, 'amara', '/data/import');
    await p.getByLabel('Choose a spreadsheet').setInputFiles({ name: 'p19.csv', mimeType: 'text/csv', buffer: Buffer.from(FILE) });
    await p.locator('.import-group').first().waitFor();
    const out = await p.evaluate(() => {
      const root = document.querySelector('.import-check');
      const f = [];
      for (const b of root.querySelectorAll('.import-group')) {
        const word = b.querySelector('.level-word')?.textContent;
        if (!['Must fix', 'Check'].includes(word)) f.push(`a block says “${word}”, not Must fix or Check`);
        if (!b.querySelector('.level-head svg')) f.push(`the ${word} block has no warning mark`);
        const cs = getComputedStyle(b);
        const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`border${s}Width`]));
        if (new Set(sides).size > 1 || sides.some((x) => x < 1)) f.push(`the ${word} block's outline is ${sides.join('/')}px, not full`);
        if (sides.some((x) => x >= 2) && new Set(sides).size > 1) f.push(`the ${word} block has an edge stripe`);
      }
      if (root.querySelector('.status-shape, svg.status-shape')) f.push('a status shape stands for a level');
      if (root.querySelector('.chip, .pill, .badge')) f.push('a capsule on the preview');
      for (const td of root.querySelectorAll('.import-counts-table td')) if (getComputedStyle(td).borderRadius !== '0px' || getComputedStyle(td).backgroundColor !== 'rgba(0, 0, 0, 0)') { f.push('a count is drawn as a capsule'); break; }
      if (/\p{Extended_Pictographic}/u.test(root.innerText)) f.push('an emoji on the preview');
      return f;
    });
    fails.push(...out);
    await c.close();
    return fails;
  },
};
