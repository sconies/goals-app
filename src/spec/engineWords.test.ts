import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg/generate';
import { changeCases, CHECK_IN_MOMENT, conformanceWorkspace, runCase } from './conformance';
import { engineSentences, wordsPattern } from './engineWords';

describe('every sentence the change engine can say (rebuild drill, stage 2, gap 2)', () => {
  const said = engineSentences(process.cwd());
  const w = conformanceWorkspace(buildPlatformOrg(new Date(CHECK_IN_MOMENT)));

  it('reads them all from the engine and the rules it shares, each with a kind', () => {
    expect(said.length).toBeGreaterThan(150);
    expect(said.every((x) => x.words.trim() && x.kind)).toBe(true);
  });

  it('has every sentence the conformance cases raise, under its kind', () => {
    const missing: string[] = [];
    for (const c of changeCases(w)) {
      for (const i of runCase(w, c).issues) {
        if (!said.some((x) => (x.kind === i.kind || x.level === 'must' && x.kind.startsWith('{')) && wordsPattern(x.words).test(i.message))) missing.push(`${c.case}: ${i.kind}: ${i.message}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('a goal’s name has no longest length (drill, 15 Nov: G-48)', () => {
  it('lists no “characters or fewer” Must fix on Goals, which a rebuild applied to demo goal G-48’s 141-character name', () => {
    const said = engineSentences(process.cwd());
    expect(said.filter((s) => /characters or fewer/.test(s.words) && /goal/i.test(s.sheet)).map((s) => `${s.sheet}: ${s.words}`)).toEqual([]);
  });
  it('still refuses a workspace name over 80 characters, and no goal name for its length', async () => {
    const { workspaceNameProblem, nameProblem } = await import('../domain/thresholds');
    const { buildPlatformOrg } = await import('../data/platformOrg/generate');
    const long = buildPlatformOrg(new Date('2026-11-05T12:00:00Z')).goals.find((g) => g.key === 'G-48')!.title;
    expect(long.length).toBe(141);
    expect(nameProblem(long, 'goal')).toBeNull();
    expect(workspaceNameProblem('x'.repeat(83))).toBe('Keep the name to 80 characters or fewer: it has 83.');
  });
});
