// @vitest-environment node
/* With Reviews off, Help's core articles don't name reviews (drill, 15 Nov), except where they say what is there
   instead: the lines about Reviews being switched off. A module's article goes with its module (Help.tsx), and a
   section of the guide that names a module's screens is that module's (GuideSection.module). */
import { MODULES } from '../core/registry';
import { ARTICLES, articleShown, sectionsShown } from './guide';

const NAMES_REVIEWS = /\b(?<!then )reviews?\b(?! changes)|\breview’s\b|\breviewed\b/i;
/** A line that says what happens with Reviews off, or that it can be switched off, may name it. */
const ABOUT_OFF = /Reviews (is |are )?(switched )?off|switch(es|ed)? Reviews off|switch(es|ed)? (it )?off|doesn’t hold reviews|switched off|features/i;

describe('Help with Reviews switched off', () => {
  const on = new Set(MODULES.map((m) => m.id).filter((id) => id !== 'reviews'));
  it('names reviews in no core article, but where it says what is there instead', () => {
    const named: string[] = [];
    // Features names every switch, Reviews' included, whichever are on: it is the page that switches them.
    for (const a of ARTICLES.filter((x) => !x.module && x.id !== 'features')) {
      const head = articleShown(a, on);
      for (const t of [head.title, head.summary]) if (NAMES_REVIEWS.test(t) && !ABOUT_OFF.test(t)) named.push(`${a.id}: ${t.slice(0, 120)}`);
      for (const s of sectionsShown(a, on)) {
        const offSection = ABOUT_OFF.test(s.heading);
        for (const t of [s.heading, ...(s.text ?? []), ...(s.list ?? [])]) if (!offSection && NAMES_REVIEWS.test(t) && !ABOUT_OFF.test(t)) named.push(`${a.id}: ${t.slice(0, 120)}`);
      }
    }
    expect(named).toEqual([]);
  });
  it('shows the same core articles in full while Reviews is on', () => {
    const all = new Set(MODULES.map((m) => m.id));
    for (const a of ARTICLES.filter((x) => !x.module)) {
      const shown = sectionsShown(a, all).flatMap((s) => [...(s.text ?? []), ...(s.list ?? [])]);
      const only = a.sections.filter((s) => !s.moduleOff).flatMap((s) => [...(s.text ?? []), ...(s.list ?? [])]);
      expect(shown).toEqual(only);
    }
  });
});
