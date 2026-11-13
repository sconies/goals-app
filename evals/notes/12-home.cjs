/* N26: Home's one primary, and quiet when quiet (docs/design/home/spec.md, HM1). run({ open, url }) returns a list of failures.
   [HOME-OWNER] On every day of two weeks for four of the demo's people, at a phone's and a computer's size: at most one
   primary button on Home, and none when there is no lead (the quiet line); the lead's button, and on a phone the first of
   your goals that needs attention, in the first screen (above
   the phone's tab bar at 390×844, above the fold at 1440×900); and Home never says "0 weeks", "None you’re in" or
   "You’re all set", nor links to a bare /goals or an old show= address. */
const DAYS = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 10, 9 + i)).toISOString().slice(0, 10));
const PEOPLE = ['tunde', 'rhea', 'amara', 'oskar', 'tariq'];
const SIZES = [[390, 844, true], [1440, 900, false]];

module.exports = {
  id: 'N26',
  area: 'home',
  title: 'Home: one primary at most, none when nothing is asked, in the first screen, and none of the words Home no longer says',
  reqs: ['HOME-OWNER'],
  async run({ open }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };
    for (const who of PEOPLE) for (const [w, h, touch] of SIZES) {
      const [c, p] = await open(w, h, who, '/?today=' + DAYS[0], touch);
      for (const day of DAYS) {
        const at = `${who}, ${day}, ${w}px`;
        if (day !== DAYS[0]) await p.goto(p.url().replace(/today=[\d-]+/, 'today=' + day));
        await p.locator('.page.home .home-hero').first().waitFor({ timeout: 8000 }).catch(() => {});
        const seen = await p.evaluate(() => {
          const bar = [...document.querySelectorAll('.tabbar')].find((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length);
          const fold = bar ? bar.getBoundingClientRect().top : innerHeight;
          const home = document.querySelector('.page.home');
          const primaries = [...(home?.querySelectorAll('.btn.primary') ?? [])].filter((e) => e.getClientRects().length);
          const hero = home?.querySelector('.home-hero');
          return {
            lead: hero?.getAttribute('data-lead') ?? 'missing',
            primaries: primaries.length,
            bottom: primaries[0] ? primaries[0].getBoundingClientRect().bottom : null,
            fold,
            text: home?.innerText ?? '',
            hrefs: [...(home?.querySelectorAll('a[href]') ?? [])].map((a) => a.getAttribute('href').replace(/^\/demo/, '')),
            // U2's measure: the first of your goals that needs attention, its title ending 8px above the fold.
            firstGoal: (() => { const t = home?.querySelector('.home-mine .arow .arow-title'); return t ? t.getBoundingClientRect().bottom : null; })(),
            // Every ask's waiting line (the part before " · "), cut on a phone (review of #369, medium 4).
            cutMeta: [...(home?.querySelectorAll('.needs-you .need-meta') ?? [])].map((e) => {
              const node = [...e.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(' · '));
              if (!node) return null;
              const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, node.textContent.indexOf(' · '));
              return r.getBoundingClientRect().right > e.getBoundingClientRect().right + 0.5 ? (e.textContent || '').trim() : null;
            }).filter(Boolean),
          };
        });
        check(seen.lead !== 'missing', `${at}: Home has neither a lead nor the quiet line`);
        check(seen.primaries <= 1, `${at}: ${seen.primaries} primary buttons`);
        if (seen.lead === 'none') {
          check(seen.primaries === 0, `${at}: nothing is asked, but Home has a primary button`);
          check(/Nothing is asked of you today\.| in for week \d+\.| in before \w+’s review\.| came after \w+’s review\.| in by \w+\.| came after \w+\.|(One ask waits|\d+ asks wait) for your response\./.test(seen.text), `${at}: the quiet line is not one of its sentences`);
        } else check(seen.primaries === 1 && seen.bottom != null && seen.bottom <= seen.fold, `${at}: the lead’s button (${seen.lead}) is not in the first screen (${Math.round(seen.bottom ?? -1)}px, fold ${Math.round(seen.fold)}px)`);
        check(!/\b0 weeks\b|None you’re in|You’re all set/.test(seen.text), `${at}: Home says something it no longer says`);
        // [HOME-OWNER] On every day, not U2's one (build review of #305): your first goal that needs attention starts on a phone's first screen.
        if (touch && seen.firstGoal != null) check(seen.firstGoal <= seen.fold - 8, `${at}: the first of your goals that needs attention ends at ${Math.round(seen.firstGoal)}px, under the fold at ${Math.round(seen.fold)}px`);
        const bad = seen.hrefs.filter((x) => /^\/goals(\?)?$/.test(x.replace(/[?&]today=[\d-]+/, '')) || /[?&]show=/.test(x));
        check(!bad.length, `${at}: a bare or old Goals link (${bad.join(' ')})`);
        if (touch) check(!seen.cutMeta.length, `${at}: an ask’s waiting line is cut (${seen.cutMeta.join(' | ')})`);
      }
      await c.close();
    }
    // [HOME-OWNER] An ask that waits (HM2): Amara on Monday 9 Nov has Rhea's decision, asked in August, as her one primary;
    // Rhea on Wednesday 11 Nov sees Daniel's question, due before Tuesday's session, as late, with the warning mark first.
    for (const [w, h, touch] of SIZES) {
      const [c, p] = await open(w, h, 'amara', '/?today=2026-11-09', touch);
      await p.locator('.page.home .home-hero').first().waitFor();
      const hero = await p.locator('.home-hero').first().innerText();
      const primary = await p.locator('.page.home .btn.primary').allInnerTexts();
      check(/Needs your response · waiting since \d+ Aug, \d+ weeks/.test(hero) && /Rhea needs a decision/.test(hero) && primary.length === 1 && primary[0].trim() === 'Respond', `Amara, 2026-11-09, ${w}px: the lead is “${hero.replace(/\s+/g, ' ')}” with ${primary.join(', ')}`);
      const also = await p.locator('.needs-you h2').innerText().catch(() => '');
      check(!also || /^Also needs your response/.test(also), `Amara, 2026-11-09, ${w}px: the list under an ask lead is headed “${also}”`);
      await c.close();
      const [c2, q] = await open(w, h, 'rhea', '/?today=2026-11-11', touch);
      await q.locator('.needs-you').first().waitFor({ timeout: 8000 }).catch(() => {});
      const metas = await q.locator('.needs-you .need-meta').evaluateAll((els) => els.map((e) => ({ text: e.innerText, warn: !!e.querySelector('svg, .warn-mark, [class*=warn]') })));
      check(metas.some((m) => m.warn && /^Was due by Tue 10 Nov/.test(m.text.trim())), `Rhea, 2026-11-11, ${w}px: no late question says “Was due by Tue 10 Nov” first with the warning mark (${metas.map((m) => m.text).join(' | ')})`);
      // The wait is what HM2 adds: on a phone's one line, cut short, it still shows whole (build review of #310).
      const cut = await q.locator('.needs-you .need-meta').evaluateAll((els) => els.map((e) => {
        const text = e.textContent ?? '';
        const node = [...e.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(' · '));
        if (!node) return null;
        const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, node.textContent.indexOf(' · '));
        return r.getBoundingClientRect().right > e.getBoundingClientRect().right + 0.5 ? text : null;
      }).filter(Boolean));
      check(!cut.length, `Rhea, 2026-11-11, ${w}px: an ask’s waiting line is cut short (${cut.join(' | ')})`);
      await c2.close();
    }
    return fails;
  },
};
