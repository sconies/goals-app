// @vitest-environment node
/* The layers lint (scripts/check-layers.mjs), so npm test keeps it as CI does: the rules layer imports only itself and
   uses no browser or network, the core never imports a module, and a module imports only what it needs. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error: a plain JavaScript script, run by CI with node, has no type declarations.
import { checkLayers } from '../../scripts/check-layers.mjs';

const root = path.join(__dirname, '..', '..');
const check = checkLayers as (root: string) => string[];

describe('The layers', () => {
  it('hold in this repository', () => {
    expect(check(root)).toEqual([]);
  });

  it('are caught when broken', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-'));
    const put = (f: string, text: string) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
    put('src/domain/a.ts', "import type { Commit } from '../data/store';\nimport { b } from './b';\n// fetch('x') in a comment is fine\nexport const go = () => fetch('/api');\n");
    put('src/domain/b.ts', "export const b = 'window.location is only words here';\nexport const c = () => localStorage.getItem('x');\n");
    put('src/domain/b.test.ts', "import { x } from '../data/examples';\n");
    put('src/screens/S.tsx', "import { Import } from '../modules/sheets/Import';\n");
    put('src/modules/sheets/module.json', '{ "id": "sheets", "needs": [] }');
    put('src/modules/sheets/Import.tsx', "import { m } from '../maps/Map';\nexport const Import = 1;\n");
    put('src/modules/maps/module.json', '{ "id": "maps", "needs": ["sheets"] }');
    put('src/modules/maps/Map.tsx', "import { Import } from '../sheets/Import';\nexport const m = 1;\n");
    const found = check(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    expect(found).toEqual([
      expect.stringMatching(/^src\/domain\/a\.ts:1: the rules layer \(src\/domain\) imports \.\.\/data\/store/),
      expect.stringMatching(/^src\/domain\/a\.ts:4: the rules layer \(src\/domain\) uses fetch/),
      expect.stringMatching(/^src\/domain\/b\.ts:2: the rules layer \(src\/domain\) uses localStorage/),
      expect.stringMatching(/^src\/modules\/sheets\/Import\.tsx:1: the sheets module imports \.\.\/maps\/Map from maps, which its module\.json doesn't list/),
      expect.stringMatching(/^src\/screens\/S\.tsx:1: imports \.\.\/modules\/sheets\/Import from the sheets module; the core never depends on a module/),
    ]);
  });
});
