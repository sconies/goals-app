// @vitest-environment node
/* The demo's words read like people wrote them (demo review, 8 Nov, item 10): the generator varies its phrasings, so a
   stock reason isn't given verbatim by many goals in one week, no filled-in sentence doubles a word ("the old the"),
   and no title ends mid-sentence. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '.';

const s = buildPlatformOrg(new Date('2026-11-08T12:00:00Z'));
const last = Math.max(...s.checkIns.map((c) => c.week));

describe('the demo’s words', () => {
  it('gives no reason for being behind or ahead verbatim on more than four goals (the review found one on five or more) in any of the last four weeks', () => {
    for (let w = last - 3; w <= last; w++) {
      const by = new Map<string, Set<string>>();
      for (const c of s.checkIns.filter((x) => x.week === w && x.why && x.cause)) by.set(c.why, (by.get(c.why) ?? new Set()).add(c.goalId));
      expect([...by].filter(([, g]) => g.size > 4).map(([t, g]) => `week ${w}: ${g.size}× ${t}`)).toEqual([]);
    }
  });
  it('never doubles a word when it fills in a goal’s words', () => {
    const text = s.checkIns.flatMap((c) => [c.why, c.pathToGreen?.what ?? '']);
    expect(text.filter((t) => /\b(the|a|an|to|of) \1\b|the old the/i.test(t))).toEqual([]);
  });
  it('ends no goal title with a comma, a colon or a space', () => {
    expect(s.goals.filter((g) => /[,;:]$|\s$/.test(g.title)).map((g) => g.title)).toEqual([]);
  });
});
