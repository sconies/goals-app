/* The settings lint (round 3's workspace settings, docs/design/workspace-settings/spec.md; CF1 for levels): a goal's
   level is read from one place, src/domain/levels.ts. Fails a level id written as a string ('north-star', 'svp'),
   LEVEL_LABEL, or a `level` compared with a string literal, anywhere in src/ but levels.ts, src/data/rows.ts (rows from
   before migration 0006), the demo's data (src/data/platformOrg/), the spec (src/spec/, whose worked examples name the ids) and tests. CF3 adds the status
   thresholds.

   npm run lint:settings runs it; so does npm test (src/core/layers.test.ts) and CI. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = [/^src\/domain\/levels\.ts$/, /^src\/data\/rows\.ts$/, /^src\/data\/platformOrg\//, /^src\/spec\//, /\.test\.tsx?$/, /\.d\.ts$/];
const RULES = [
  [/['"`](north-star|svp)['"`]/, 'names a level by its id; ask src/domain/levels.ts'],
  [/\bLEVEL_LABEL\b/, 'uses LEVEL_LABEL; use levelName from src/domain/levels.ts'],
  // An import problem's level (IM2: must, check, note; src/domain/problemLevels.ts) is not a goal's level.
  [/\blevel\s*[!=]==\s*['"`](?!(?:must|check|note)['"`])|(?<!['"`](?:must|check|note))['"`]\s*[!=]==\s*\w*\.?level\b/, 'compares a level with a word; use isEveryday, isTop or levelRank'],
];

function files(root, dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? files(root, rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/** What one line of code does wrong, if anything. */
export const lineProblems = (code) => RULES.filter(([re]) => re.test(code)).map(([, why]) => why);

/** Each place that names a level outside levels.ts: "file:line: what's wrong". */
export function checkSettings(root) {
  const out = [];
  for (const f of files(root, 'src')) {
    if (ALLOWED.some((r) => r.test(f))) continue;
    // Comments may name a level; code may not.
    const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\*|\/\*).*$/, '');
      for (const [re, why] of RULES) if (re.test(code)) out.push(`${f}:${i + 1}: ${why}`);
    });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = checkSettings(root);
  if (problems.length) { console.error(`Levels are read from src/domain/levels.ts only:\n${problems.map((p) => '  ' + p).join('\n')}`); process.exitCode = 1; }
  else console.log('Levels are read from one place (src/domain/levels.ts).');
}
