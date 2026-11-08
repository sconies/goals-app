/* The feature modules, read from their module.json files (docs/architecture.md), with nothing run or built:
     node scripts/modules.mjs          a table: each module, what it needs, and what it adds
     node scripts/modules.mjs --ids    their ids as JSON, for CI's build-without-each-module job */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src', 'modules');
const modules = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((d) => fs.existsSync(path.join(dir, d, 'module.json'))).sort()
  .map((d) => JSON.parse(fs.readFileSync(path.join(dir, d, 'module.json'), 'utf8')));

if (process.argv.includes('--ids')) console.log(JSON.stringify(modules.map((m) => m.id)));
else {
  for (const m of modules) {
    console.log(`${m.id}: ${m.name}. ${m.summary}`);
    console.log(`  needs ${m.needs.join(', ') || 'nothing'} · routes ${m.routes.join(' ') || 'none'} · places ${m.places.join(' ') || 'none'} · AI tools ${m.aiTools.join(' ') || 'none'} · Help ${m.help.join(' ') || 'none'} · tables ${m.tables.map((t) => t.name).join(' ') || 'none'}`);
  }
}
