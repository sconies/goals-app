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
