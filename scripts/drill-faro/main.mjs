/* Faro's own core rules behind the drill's contract (spec/rebuild/stage-1-core-rules.md), to prove the harness:
   `npm run drill -- scripts/drill-faro` must score 100%. CI runs it. It reads the workspace it is given and writes the
   five CSV files, and find.csv, navigation.csv and import.csv, with the code that made the conformance data (src/spec/conformance.ts), so it is not a rebuild: the
   drill itself is a fresh session that sees only spec/ and llms.txt.
     node main.mjs <workspace.json> <folder to write into> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const [workspace, out] = process.argv.slice(2);
if (!workspace || !out) { console.error('Usage: node main.mjs <workspace.json> <folder to write into>'); process.exit(2); }
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { conformanceFiles } = await server.ssrLoadModule('/src/spec/conformance.ts');
  const files = conformanceFiles(JSON.parse(fs.readFileSync(workspace, 'utf8')));
  fs.mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text);
} finally {
  await server.close();
}
