// Reads the kit's one spreadsheet format (spec/core/export-format.md) into format.json, once.
// node modules/spreadsheets/gen-format.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../../../spec/core/export-format.md'), 'utf8');
const sheets = [];
let cur = null;
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, ''));
for (const line of src.split('\n')) {
  const h = line.match(/^## (.+)$/);
  if (h) { cur = ['Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'Metrics'].includes(h[1]) ? { name: h[1], about: '', needs: '', cols: [], keys: [] } : null; if (cur) sheets.push(cur); continue; }
  if (!cur) continue;
  if (!cur.about && line && !line.startsWith('|') && !line.startsWith('A new row needs') && !line.startsWith('Always')) { cur.about = line.trim(); continue; }
  if (line.startsWith('A new row needs')) { cur.needs = line.replace(/^A new row needs /, '').trim(); continue; }
  const al = line.match(/^Always written by a table from Data: (.+)\.$/);
  if (al) { cur.keys = al[1].split(', ').map((s) => s.trim()); continue; }
  if (line.startsWith('| ') && !line.startsWith('| Column') && !line.startsWith('|---')) {
    const c = cells(line);
    if (c.length === 7) cur.cols.push({ col: c[0], need: c[1], format: c[2], example: c[3], empty: c[4], means: c[5], back: c[6] });
    else cur.cols.push({ col: c[0], need: c[1], means: c[2], back: c[3] });
  }
}
fs.writeFileSync(path.join(here, 'format.json'), JSON.stringify(sheets, null, 1));
console.log(sheets.map((s) => `${s.name}: ${s.cols.length} columns`).join('\n'));
