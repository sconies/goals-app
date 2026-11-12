/* The change engine (src/domain/changeset.ts) stays out of the first download: the dispatcher loads it when an action
   needs it (src/app/actions.ts loadEngine). Twice a small constant imported from it pulled the whole engine back in
   (the Via labels, in activity.ts and removal.ts), so only the files listed here may import it at run time: the
   engine's own callers in the rules, the AI tools, the spec, src/app/engineReady.ts (which screens that preview
   changes import) and screens that load when opened. Anything else that
   needs a Via label or another small name imports it from src/domain/via.ts. */
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED = new Set([
  'src/app/engineReady.ts',
  'src/domain/importer.ts',
  'src/mcp/tools.ts',
  'src/spec/conformance.ts',
  'src/spec/rules.ts',
  'src/data/platformOrg/generate.ts',
  'src/ui/Preview.tsx',
  'src/screens/DataTables.tsx',
  'src/screens/BulkEdit.tsx',
  'src/modules/spreadsheets/Changes.tsx',
  'src/modules/spreadsheets/Check.tsx',
  // The import's worker (its own bundle), and what runs it, loaded with the preview.
  'src/modules/spreadsheets/checkRun.ts',
  'src/modules/spreadsheets/worker.ts',
]);

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('the change engine loads on its own', () => {
  it('is imported at run time only by the files allowed to (a Via label comes from domain/via.ts)', () => {
    const root = path.join(__dirname, '..', '..');
    const importers = sources(path.join(root, 'src'))
      .map((f) => path.relative(root, f).split(path.sep).join('/'))
      .filter((f) => !f.startsWith('src/domain/changeset'))
      .filter((f) => /^import \{(?![^}]*^\s*type\b)[^}]*\} from '(?:\.\.?\/)+(?:domain\/)?changeset'/m.test(fs.readFileSync(path.join(root, f), 'utf8')));
    expect(importers.filter((f) => !ALLOWED.has(f))).toEqual([]);
  });
});
