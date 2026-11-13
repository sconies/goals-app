/* N27: the switcher on the icon rail (small workspaces SM4, 2.6). [RAIL-SWITCH] At 1024 × 768 the rail's Faro mark is the
   switcher: it names itself "{workspace}: switch workspace, or set one up", opens the Workspaces panel, and Escape puts
   focus back on it. No row is added to the rail, so the Demo box stays fully on screen (P10). */
module.exports = {
  id: 'N27',
  area: 'shell',
  title: 'The rail’s Faro mark opens the workspace switcher, the Demo box stays on screen, and Escape returns focus to the mark',
  reqs: ['RAIL-SWITCH'],
  async run({ open }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };
    const [c, p] = await open(1024, 768, 'rhea', '/', false);
    try {
      const mark = p.locator('.side .ws-rail-switch');
      check(await mark.isVisible(), 'the rail has no switcher on its Faro mark');
      if (await mark.isVisible()) {
        const name = (await mark.getAttribute('aria-label')) || '';
        check(/: switch workspace, or set one up$/.test(name), `the mark is named “${name}”`);
        const demo = await p.evaluate(() => { const d = document.querySelector('.side .demo-entry'); if (!d) return null; const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
        check(!!demo && demo.top >= 0 && demo.bottom <= demo.h, `the Demo box is not fully on screen at 1024 × 768 (${demo ? `${Math.round(demo.top)}–${Math.round(demo.bottom)}px of ${demo.h}` : 'missing'})`);
        await mark.click();
        const panel = p.getByRole('dialog', { name: 'Workspaces' });
        const opened = await panel.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        check(opened, 'the mark does not open the Workspaces panel');
        if (opened) {
          check(await panel.getByRole('button', { name: /Set up a new workspace/ }).count() > 0, 'the panel has no “Set up a new workspace”');
          await p.keyboard.press('Escape');
          await panel.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
          const back = await p.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('ws-rail-switch'));
          check(back, 'after Escape, focus is not back on the rail’s mark');
        }
      }
    } finally { await c.close(); }
    return fails;
  },
};
