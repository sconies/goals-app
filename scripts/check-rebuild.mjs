/* Part of done (backlog 8k): every feature module has a rebuild stage. Fails when a folder in src/modules has no
   `rebuild` in its module.json (status, builds, entry, exit, gaps), or no stage page under spec/rebuild/ (npm run spec
   writes it from that field). Plain Node, nothing built; CI and npm test run it.
     node scripts/check-rebuild.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src', 'modules');
const stagesDir = path.join(root, 'spec', 'rebuild');
const pages = fs.existsSync(stagesDir) ? fs.readdirSync(stagesDir) : [];
const problems = [];
const ids = (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []).filter((d) => d.isDirectory()).map((d) => d.name).sort();
for (const id of ids) {
  const file = path.join(dir, id, 'module.json');
  if (!fs.existsSync(file)) { problems.push(`${id}: no module.json`); continue; }
  const r = JSON.parse(fs.readFileSync(file, 'utf8')).rebuild;
  const where = `src/modules/${id}/module.json`;
  if (!r) { problems.push(`${id}: no rebuild stage. Add "rebuild" to ${where} (status, builds, entry, exit, gaps; see docs/architecture.md), then run npm run spec`); continue; }
  if (!['drill', 'outline'].includes(r.status)) problems.push(`${id}: rebuild.status is "drill" or "outline", not ${JSON.stringify(r.status)}`);
  if (typeof r.builds !== 'string' || r.builds.length < 30) problems.push(`${id}: rebuild.builds says what the stage builds, in a sentence or two`);
  for (const k of ['entry', 'exit']) if (!Array.isArray(r[k]) || !r[k].length || r[k].some((x) => typeof x !== 'string' || !x.trim())) problems.push(`${id}: rebuild.${k} lists at least one criterion`);
  if (!Array.isArray(r.gaps)) problems.push(`${id}: rebuild.gaps lists what the kit doesn’t hold yet (an empty list if nothing)`);
  if (!pages.some((p) => new RegExp(`^stage-\\d+-module-${id}\\.md$`).test(p))) problems.push(`${id}: no stage page in spec/rebuild/. Run npm run spec and commit what it writes`);
}
if (problems.length) {
  console.error(`Every feature module needs a rebuild stage (backlog 8k):\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Every feature module has a rebuild stage (${ids.length}: ${ids.join(', ') || 'none'}).`);
