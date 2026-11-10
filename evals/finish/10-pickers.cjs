/* F11 (with P17): find-and-pick on a phone and a computer (docs/design/find/spec.md, section 7). On a 390 px phone an
   open picker's first result is near the top, its rows are at least 44 px high and nothing scrolls sideways; on both,
   a chosen person is plain words with a button, never a capsule (no rounded, filled box behind it). */
module.exports = {
  id: 'F11',
  area: 'pickers',
  reqs: ['FIND-AND-PICK', 'DESIGN-RULES'],
  title: 'Find-and-pick fits a phone, and a choice is never a capsule (F11, P17)',
  async run({ open }) {
    const fails = [];
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const [c, r] = await open(w, h, 'rhea', '/reviews/new');
      try {
        const opener = r.getByRole('button', { name: /^People/ }).filter({ hasText: /Choose a person|Add another person/ }).first();
        await opener.waitFor({ timeout: 15000 });
        await opener.click();
        const list = r.getByRole('listbox', { name: 'People' });
        await list.waitFor();
        await r.waitForTimeout(250);
        const m = await r.evaluate(() => {
          const rows = [...document.querySelectorAll('.pick-list [role="option"]')].map((e) => e.getBoundingClientRect());
          return { first: rows[0]?.top ?? -1, heights: rows.map((b) => Math.round(b.height)), sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        if (w < 800) {
          if (m.first < 0 || m.first > 200) fails.push(`${w}: the first suggestion starts at ${Math.round(m.first)} px, not within 200 px of the top`);
          if (m.heights.some((x) => x < 44)) fails.push(`${w}: picker rows ${m.heights.join('/')} px high (at least 44)`);
        }
        if (m.sideways > 1) fails.push(`${w}: the page scrolls sideways by ${m.sideways} px with a picker open`);
        await r.keyboard.press('Escape');
        await list.waitFor({ state: 'detached' });
        // P17: what is chosen reads as words, not a capsule.
        const caps = await r.evaluate(() => [...document.querySelectorAll('.pick-chosen li, .pick-field, .pick-name')].filter((e) => {
          const cs = getComputedStyle(e);
          const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
          return filled && parseFloat(cs.borderTopLeftRadius) > 8;
        }).map((e) => e.className));
        if (caps.length) fails.push(`${w}: a chosen value is drawn as a capsule (${caps.join(', ')})`);
      } finally { await c.close(); }
    }
    return fails;
  },
};
