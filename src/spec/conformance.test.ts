/* The conformance data (backlog 8b): recompute every row from spec/conformance/workspace.json with Faro's own rules,
   and fail on any difference from the files. A rebuild proves itself the same way (spec/conformance/README.md). */
import fs from 'node:fs';
import path from 'node:path';
import { conformanceFiles, type ConformanceWorkspace } from './conformance';

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
