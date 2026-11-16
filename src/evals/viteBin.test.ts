// @vitest-environment node
/* The evals find Vite as Node finds a package, from the app's folder up (drill, 15 Nov: evals/run.mjs needed Vite in
   the repo root's own node_modules, so a rebuild in a subfolder couldn't run them). */
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const { viteBin } = createRequire(import.meta.url)('../../evals/viteBin.cjs') as { viteBin: (from: string) => string | null };
const repo = join(__dirname, '../..');

describe('where the evals find Vite', () => {
  it('finds the repo’s Vite from a folder inside it that has no node_modules of its own', () => {
    const inner = join(repo, 'evals');
    expect(existsSync(join(inner, 'node_modules', 'vite'))).toBe(false);
    const bin = viteBin(inner);
    expect(bin && existsSync(bin)).toBe(true);
    expect(bin).toMatch(/vite[\\/]bin[\\/]vite\.js$/);
  });
  it('says there is none where nothing above has Vite', () => {
    const lone = mkdtempSync(join(tmpdir(), 'faro-novite-'));
    writeFileSync(join(lone, 'package.json'), '{}');
    expect(viteBin(lone)).toBeNull();
  });
});
