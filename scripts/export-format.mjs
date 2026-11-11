/* Writes docs/export-format.md from the one format (src/domain/columns.ts).
   npm run export-format              rewrite it
   npm run export-format -- --check   exit 1 if it isn't current (evals/format.eval.ts checks the same) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'docs', 'export-format.md');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { exportFormatMarkdown } = await server.ssrLoadModule('/src/domain/formatDoc.ts');
  // With the sheets the feature modules add (src/core/records.ts), as the export writes them.
  const { MODULE_SHEETS } = await server.ssrLoadModule('/src/core/records.ts');
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const after = exportFormatMarkdown(MODULE_SHEETS);
  if (process.argv.includes('--check')) {
    if (after !== before) { console.error('docs/export-format.md is out of date: run npm run export-format'); process.exitCode = 1; }
    else console.log('docs/export-format.md is current.');
  } else if (after !== before) {
    fs.writeFileSync(file, after);
    console.log('Wrote docs/export-format.md.');
  } else console.log('docs/export-format.md was already current.');
} finally {
  await server.close();
}
