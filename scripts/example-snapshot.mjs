/* Builds the demo's example once, for one pinned day, and saves it beside an eval build (backlog -1).
   The demo builds its example in the browser on every page load (about 200 ms, more on a slow machine), and the evals
   load pages several hundred times a run. An eval build is made with VITE_EXAMPLE_SNAPSHOT set to the moment the evals
   pin the clock to (`?today=yyyy-mm-dd` is noon UTC that day), and src/data/examples.ts loads this file instead of
   building the example when the day matches. Any other day, and every build that isn't an eval build, builds it as
   before. The example is made by the same code either way (src/data/platformOrg/generate.ts).

   node scripts/example-snapshot.mjs <outDir> <ISO moment>, e.g. evals/out/dist 2026-11-05T12:00:00.000Z */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outDir, at] = process.argv.slice(2);
if (!outDir || !at || Number.isNaN(Date.parse(at))) { console.error('Usage: node scripts/example-snapshot.mjs <outDir> <ISO moment>'); process.exit(2); }

const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { buildPlatformOrg } = await vite.ssrLoadModule('/src/data/platformOrg/generate.ts');
  const snapshot = buildPlatformOrg(new Date(at));
  const file = path.resolve(root, outDir, `example-${at.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  console.log(`  example for ${at} saved: ${path.relative(root, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
} finally {
  await vite.close();
}
