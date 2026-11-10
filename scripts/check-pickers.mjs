/* The pickers lint (docs/design/find/spec.md, N12; FS1): a person, team, goal, metric or workspace is chosen by typing
   to find it (src/ui/Pick.tsx), never from a <select> of everything. Fails a <select> whose options are mapped from
   people, teams, goals, metrics or workspaces, except in the files scripts/pickers-left.json lists, no more times than
   it says: those are the places still to move, and the list may only shrink.

   npm run lint:pickers runs it; so does npm test (src/core/layers.test.ts). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = /\b(people|teams|goals|metrics|workspaces|allGoals)\b[\s\S]*?\.map\(/;

function files(root, dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? files(root, rel) : /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name) ? [rel] : [];
  });
}

/** Each <select> of everything in a file, by line. */
export function selectsOfEverything(src) {
  const out = [];
  for (const m of src.matchAll(/<select\b[\s\S]*?<\/select>/g)) {
    if (KINDS.test(m[0]) && /<option\b/.test(m[0])) out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}

export function checkPickers(root) {
  const allowedFile = path.join(root, 'scripts/pickers-left.json');
  const allowed = fs.existsSync(allowedFile) ? JSON.parse(fs.readFileSync(allowedFile, 'utf8')).files : {};
  const problems = [];
  for (const file of files(root, 'src')) {
    const lines = selectsOfEverything(fs.readFileSync(path.join(root, file), 'utf8'));
    const may = allowed[file] ?? 0;
    if (lines.length > may) problems.push(`${file}:${lines[may] ?? lines[0]}: a <select> of everything (people, teams, goals, metrics or workspaces); use find-and-pick (src/ui/Pick.tsx)${may ? ` (scripts/pickers-left.json allows ${may} here)` : ''}`);
  }
  return problems;
}

export function pickersLeft(root) {
  const out = {};
  for (const file of files(root, 'src')) { const n = selectsOfEverything(fs.readFileSync(path.join(root, file), 'utf8')).length; if (n) out[file] = n; }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.includes('--left')) { console.log(JSON.stringify(pickersLeft(root), null, 2)); process.exit(0); }
  const problems = checkPickers(root);
  if (problems.length) { console.error(`The pickers lint found ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`); process.exit(1); }
  console.log('Pickers: nothing is chosen from a list of everything, outside the places still to move (scripts/pickers-left.json).');
}
