// Loads stage 1's rules (main.mjs) for a workspace, for tests: its CSV files go to a scratch folder.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
export async function load(wsPath) {
  const out = fs.mkdtempSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'local', 's1-'));
  let S1;
  globalThis.__captureS1 = (x) => { S1 = x; };
  process.argv = [process.argv[0], 'main.mjs', wsPath, out];
  await import('./main.mjs');
  fs.rmSync(out, { recursive: true, force: true });
  return { S1 };
}
