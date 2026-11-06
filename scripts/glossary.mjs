/* Writes the status words section of docs/glossary.md from the vocabulary (src/domain/vocabulary.ts).
   npm run glossary           rewrite it
   npm run glossary -- --check  exit 1 if it isn't current (evals/vocabulary.eval.ts checks the same) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'docs', 'glossary.md');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { withGlossary } = await server.ssrLoadModule('/src/domain/glossaryDoc.ts');
  const before = fs.readFileSync(file, 'utf8');
  const after = withGlossary(before);
  if (process.argv.includes('--check')) {
    if (after !== before) { console.error('docs/glossary.md is out of date: run npm run glossary'); process.exitCode = 1; }
    else console.log('docs/glossary.md is current.');
  } else if (after !== before) {
    fs.writeFileSync(file, after);
    console.log('Wrote the status words in docs/glossary.md.');
  } else console.log('docs/glossary.md was already current.');
} finally {
  await server.close();
}
