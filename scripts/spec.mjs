/* Writes the spec (spec/ and llms.txt) from the code (src/spec/build.ts). Backlog 8a: a spec that can't drift.
   npm run spec             rewrite every file, and remove any under spec/ the code no longer makes
   npm run spec -- --check  exit 1 if any file is out of date, missing or extra (CI runs this; so does npm test) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { buildSpec } = await server.ssrLoadModule('/src/spec/build.ts');
  const want = await buildSpec(root);
  const onDisk = [];
  const walk = (rel) => { for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) { const p = `${rel}/${e.name}`; if (e.isDirectory()) walk(p); else onDisk.push(p); } };
  if (fs.existsSync(path.join(root, 'spec'))) walk('spec');
  // The screens' pictures are taken by npm run spec:shots, not made here; screens.md shows them and the spec test checks them.
  const extra = onDisk.filter((f) => !(f in want) && !/^spec\/core\/screens\/[^/]+\.jpg$/.test(f));
  const stale = Object.entries(want).filter(([f, text]) => !fs.existsSync(path.join(root, f)) || fs.readFileSync(path.join(root, f), 'utf8') !== text).map(([f]) => f);
  if (check) {
    if (stale.length || extra.length) {
      console.error(`The spec is out of date: run npm run spec and commit what it writes.\n${[...stale.map((f) => `  changed or missing: ${f}`), ...extra.map((f) => `  no longer made: ${f}`)].join('\n')}`);
      process.exitCode = 1;
    } else console.log(`The spec is current (${Object.keys(want).length} files).`);
  } else {
    for (const f of stale) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), want[f]); }
    for (const f of extra) fs.rmSync(path.join(root, f));
    console.log(stale.length || extra.length ? `Wrote ${stale.length} spec files${extra.length ? `, removed ${extra.length}` : ''}.` : 'The spec was already current.');
  }
} finally {
  await server.close();
}
