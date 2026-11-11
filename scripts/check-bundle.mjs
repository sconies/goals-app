/* The bundle budget (backlog AX4; R4 asks the internal app for a first download under 300 KB compressed): the first
   chunk a visit downloads, gzipped, stays under a stated size. Run after `vite build`:  node scripts/check-bundle.mjs
   Start at today's size and lower it as screens are split out; never raise it to make a change pass. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** The first chunk, gzipped, at most (241 KB on 11 Nov 2026, after the screens a first visit never needs went lazy). */
export const FIRST_CHUNK_KB = 250;

const dir = join(process.cwd(), 'dist/assets');
const first = readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f));
if (first.length !== 1) { console.error(`Expected one first chunk (dist/assets/index-*.js), found ${first.length}. Run vite build first.`); process.exit(1); }
const kb = gzipSync(readFileSync(join(dir, first[0]))).length / 1024;
if (kb > FIRST_CHUNK_KB) {
  console.error(`The first download is ${kb.toFixed(0)} KB compressed, over the budget of ${FIRST_CHUNK_KB} KB. Load a screen a first visit doesn't need when it is opened (React.lazy in src/App.tsx), or move a large dependency out of the first chunk.`);
  process.exit(1);
}
console.log(`The first download is ${kb.toFixed(0)} KB compressed, within the budget of ${FIRST_CHUNK_KB} KB.`);
