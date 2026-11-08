/* The layers lint (docs/architecture.md, backlog item 0). Fails when code reaches across a boundary it shouldn't:

   1. The rules layer, src/domain, is plain TypeScript: it imports only other files in src/domain, and uses no browser,
      network or storage (fetch, window, document, localStorage…). Tests in it may use fixtures from elsewhere.
   2. The core never depends on a module: nothing outside src/modules imports a file in it. Modules join the app only
      through the registry the build makes (vite.modules.ts, `virtual:faro-modules…`).
   3. A module imports another module only if its module.json lists it under `needs`.

   npm run lint:layers runs it; CI runs it, and so does npm test (src/core/layers.test.ts). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE = /\.(ts|tsx|mjs|cjs|js)$/;
const isTest = (f) => /\.test\.tsx?$/.test(f);

/** Every code file under dir, relative to root, with forward slashes. */
function files(root, dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? files(root, rel) : CODE.test(e.name) ? [rel] : [];
  });
}

/** The code without its comments and string contents, line breaks kept, so a word in a comment or a message never counts. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length))
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => m[0] + ' '.repeat(m.length - 2) + m[0]);
}

/** Each import in a file (comments left out): what it names, and its line. */
function importsOf(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/.*$/gm, (m, a) => a);
  const out = [];
  const re = /^[ \t]*import\s+[^;'"`]*?\sfrom\s*(['"])([^'"\n]+)\1|^[ \t]*import\s*(['"])([^'"\n]+)\3|^[ \t]*export\s+(?:type\s+)?(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s*from\s*(['"])([^'"\n]+)\5|\bimport\(\s*(['"])([^'"\n]+)\7\s*\)/gm;
  for (const m of code.matchAll(re)) {
    const spec = m[2] ?? m[4] ?? m[6] ?? m[8];
    out.push({ spec, line: code.slice(0, m.index + m[0].lastIndexOf(spec)).split('\n').length });
  }
  return out;
}

/** Where an import leads, relative to root (null for a package or a virtual module). */
function target(file, spec) {
  if (!spec.startsWith('.')) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
}

/** Browser, network and storage, as the rules layer must not use them. */
const OUTSIDE = /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\b(window|document|navigator|localStorage|sessionStorage|indexedDB|location)\s*\.|\bnew\s+(XMLHttpRequest|WebSocket|EventSource|Worker)\b/;

const moduleOf = (rel) => /^src\/modules\/([^/]+)\//.exec(rel)?.[1] ?? null;

/** The problems, as "file:line: what". Empty when every layer keeps to itself. */
export function checkLayers(root) {
  const problems = [];
  const needs = {};
  for (const d of fs.existsSync(path.join(root, 'src/modules')) ? fs.readdirSync(path.join(root, 'src/modules'), { withFileTypes: true }) : []) {
    const f = path.join(root, 'src/modules', d.name, 'module.json');
    if (d.isDirectory() && fs.existsSync(f)) needs[d.name] = JSON.parse(fs.readFileSync(f, 'utf8')).needs ?? [];
  }
  for (const file of [...files(root, 'src'), ...files(root, 'server')]) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const imports = importsOf(raw);
    const inDomain = file.startsWith('src/domain/');
    const mine = moduleOf(file);
    for (const { spec, line } of imports) {
      const to = target(file, spec);
      // 1. The rules layer imports only itself (its tests may use fixtures).
      if (inDomain && !isTest(file) && (!to || !to.startsWith('src/domain/'))) problems.push(`${file}:${line}: the rules layer (src/domain) imports ${spec}; it may import only other files in src/domain`);
      const theirs = to ? moduleOf(to + '/') ?? moduleOf(to) : null;
      // 2. The core never depends on a module.
      if (theirs && !mine && !isTest(file)) problems.push(`${file}:${line}: imports ${spec} from the ${theirs} module; the core never depends on a module (it joins through the registry, vite.modules.ts)`);
      // 3. A module depends only on the modules it says it needs.
      if (theirs && mine && theirs !== mine && !(needs[mine] ?? []).includes(theirs)) problems.push(`${file}:${line}: the ${mine} module imports ${spec} from ${theirs}, which its module.json doesn't list under needs`);
    }
    if (inDomain && !isTest(file)) {
      codeOnly(raw).split('\n').forEach((l, i) => {
        const m = OUTSIDE.exec(l);
        if (m) problems.push(`${file}:${i + 1}: the rules layer (src/domain) uses ${m[0].replace(/\s*[.(]$/, '')}; browser, network and storage code belongs in src/app or src/data`);
      });
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = checkLayers(root);
  if (problems.length) {
    console.error(`The layers lint found ${problems.length} problem(s) (docs/architecture.md):\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Layers: the rules layer imports only itself, and the core depends on no module.');
}
