/* The bundle budget (backlog AX4; R4 asks the internal app for a first download under 300 KB compressed): what a first
   visit downloads before anything draws, gzipped, stays under a stated size. That is the entry script and every file
   dist/index.html preloads with it (modulepreload), summed: the entry alone hides what it imports (build review, 11 Nov).
   The real app downloads more before it draws: with Supabase configured, src/main.tsx awaits the store's chunk and the
   Supabase client's (LIVE_BEFORE_RENDER) before the first render, and neither is preloaded. That sum has its own budget
   (build review of #154: it was about 488 KB on live while the check said 429). The build's manifest says which files
   those chunks are, so build with it:
     npx vite build --manifest && node scripts/check-bundle.mjs
   Start at today's sizes and lower them as screens are split out; never raise one to make a change pass. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** The first download, gzipped, at most (286 KB on 12 Nov 2026, under R4's 300: every page but Home loads when it is
    opened, src/App.tsx, and so do the spreadsheets module's Import, Data menu and export sheet; it was 369 KB,
    and 241 KB when AX4 counted the entry alone, before #154 counted every file it preloads too). */
export const FIRST_DOWNLOAD_KB = 290;
/** The real app's, at most: the first download and what src/main.tsx awaits before the first render with Supabase
    configured (344 KB on 12 Nov 2026: 286 and the store's 5 and the client's 54). */
export const LIVE_FIRST_DOWNLOAD_KB = 348;
/** The modules src/main.tsx imports, and awaits, before the real app's first render. */
const LIVE_BEFORE_RENDER = ['src/adapters/supabase/goalsStore.ts'];

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

// The real app's: the same, and each module it awaits before the first render with everything that imports, once.
let manifest;
try { manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8')); } catch { console.error('No dist/.vite/manifest.json: build with `npx vite build --manifest` so the real app\'s first download can be measured.'); process.exit(1); }
const counted = new Set(files.map((f) => f.replace(/^\//, '')));
const extra = new Map();
const add = (key) => {
  const chunk = manifest[key];
  if (!chunk || counted.has(chunk.file) || extra.has(chunk.file)) return;
  extra.set(chunk.file, gzipSync(readFileSync(join(dist, chunk.file))).length / 1024);
  for (const i of chunk.imports ?? []) add(i);
};
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
for (const m of LIVE_BEFORE_RENDER) {
  if (!manifest[entryKey]?.dynamicImports?.includes(m)) { console.error(`${m} is no longer loaded by the entry when it is needed; update LIVE_BEFORE_RENDER in scripts/check-bundle.mjs to what src/main.tsx awaits before the first render.`); process.exit(1); }
  add(m);
}
const liveKb = kb + [...extra.values()].reduce((a, s) => a + s, 0);
const liveParts = [...extra].sort((a, b) => b[1] - a[1]).map(([f, s]) => `${f.split('/').pop()} ${s.toFixed(0)}`).join(', ');
if (liveKb > LIVE_FIRST_DOWNLOAD_KB) {
  console.error(`The real app's first download is ${liveKb.toFixed(0)} KB compressed (the first download and ${liveParts}), over the budget of ${LIVE_FIRST_DOWNLOAD_KB} KB.`);
  process.exit(1);
}
console.log(`The real app's first download is ${liveKb.toFixed(0)} KB compressed (the first download and ${liveParts}), within the budget of ${LIVE_FIRST_DOWNLOAD_KB} KB.`);
