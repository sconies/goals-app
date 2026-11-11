/* The bundle budget (backlog AX4; R4 asks the internal app for a first download under 300 KB compressed): what a first
   visit downloads before anything draws, gzipped, stays under a stated size. That is the entry script and every file
   dist/index.html preloads with it (modulepreload), summed: the entry alone hides what it imports (build review, 11 Nov).
   Run after `vite build`:  node scripts/check-bundle.mjs
   Start at today's size and lower it as screens are split out; never raise it to make a change pass. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** The first download, gzipped, at most (367 KB on 11 Nov 2026, late evening, once Help and What's new load when opened
    and the first download carries only their index, src/help/lookup.ts: the entry and its ten preloads). */
export const FIRST_DOWNLOAD_KB = 370;

const dist = join(process.cwd(), 'dist');
let html;
try { html = readFileSync(join(dist, 'index.html'), 'utf8'); } catch { console.error('No dist/index.html. Run vite build first.'); process.exit(1); }
const entry = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+\.js)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+\.js)"/g)].map((m) => m[1]);
if (entry.length !== 1) { console.error(`Expected one entry script in dist/index.html, found ${entry.length}.`); process.exit(1); }
const files = [...new Set([...entry, ...preloads])];
const sizes = files.map((f) => [f, gzipSync(readFileSync(join(dist, f.replace(/^\//, '')))).length / 1024]);
const kb = sizes.reduce((a, [, s]) => a + s, 0);
const parts = sizes.sort((a, b) => b[1] - a[1]).map(([f, s]) => `${f.split('/').pop()} ${s.toFixed(0)}`).join(', ');
if (kb > FIRST_DOWNLOAD_KB) {
  console.error(`The first download is ${kb.toFixed(0)} KB compressed (${parts}), over the budget of ${FIRST_DOWNLOAD_KB} KB. Load a screen a first visit doesn't need when it is opened (React.lazy in src/App.tsx), or move a large dependency out of what the entry imports.`);
  process.exit(1);
}
console.log(`The first download is ${kb.toFixed(0)} KB compressed (${files.length} files: ${parts}), within the budget of ${FIRST_DOWNLOAD_KB} KB.`);
