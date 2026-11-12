/* The conformance data (backlog 8b): recompute every row from spec/conformance/workspace.json with Faro's own rules,
   and fail on any difference from the files. A rebuild proves itself the same way (spec/conformance/README.md). */
import fs from 'node:fs';
import path from 'node:path';
import { CHANGES_HEADER, changeRowsOf, conformanceFiles, importCases, type ConformanceWorkspace } from './conformance';

const dir = path.resolve(__dirname, '../../spec/conformance');

describe('the conformance data', () => {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'workspace.json'), 'utf8')) as ConformanceWorkspace;
  const made = conformanceFiles(w);

  for (const file of Object.keys(made)) {
    it(`${file}: every row is what the rules give for workspace.json`, () => {
      const want = made[file]!.split('\n');
      const have = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
      // The first few rows that differ, each as the file has it and as the rules give it.
      const diff: string[] = [];
      for (let i = 0; i < Math.max(want.length, have.length) && diff.length < 10; i++) if (want[i] !== have[i]) diff.push(`row ${i}: file “${have[i] ?? ''}”, rules “${want[i] ?? ''}”`);
      expect(diff).toEqual([]);
    });
  }
});

describe('pinned rows', () => {
  const rows = fs.readFileSync(path.join(dir, 'scorecard-words.csv'), 'utf8').split('\n');
  it('a unit of ms keeps its s after 1: G-58 in week 10 is “1 ms worse”, not “1 m worse” (backlog 0u)', () => {
    expect(rows).toContain('10,G-58,since,1 ms worse,Vs last week,was 101 ms in week 9');
    expect(rows.some((r) => / 1 m (worse|better|ahead|behind|to go|over)/.test(r))).toBe(false);
  });
});

describe('changes.csv (stage 2’s drill)', () => {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'workspace.json'), 'utf8')) as ConformanceWorkspace;
  const rows = changeRowsOf(w);
  const head = (c: string) => rows.find((r) => r[0] === c && r[1] === '0')!;
  const items = (c: string) => rows.filter((r) => r[0] === c && r[1] !== '0');
  const col = (n: string) => CHANGES_HEADER.indexOf(n);

  it('runs every import case, and each case that blocks saves nothing', () => {
    for (const c of importCases(w)) expect(head(c.case)).toBeTruthy();
    expect(head('required-empty')[col('saves')]).toBe('no');
  });

  it('saves each of the five save cases as one item of its kind', () => {
    const kinds = { 'saves-check-in': 'check-in', 'saves-plan-with-reason': 'plan', 'saves-new-goal': 'new goal', 'saves-person': 'person', 'saves-stop': 'stop goal' };
    for (const [c, kind] of Object.entries(kinds)) {
      expect(head(c)[col('saves')], c).toBe('yes');
      expect(items(c).map((r) => r[col('kind')]), c).toEqual([kind]);
    }
    expect(items('saves-plan-with-reason')[0]![col('needs_reason')]).toBe('yes');
    expect(items('saves-person')[0]![col('diffs')]).toContain('Team: CI/CD → Build & Release');
  });
});
