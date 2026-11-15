// one-off: copies the kit's field table (spec/core/export-format.md) into the module as data
import fs from 'node:fs';
const md = fs.readFileSync(process.argv[2], 'utf8');
const out = {};
for (const sec of md.split(/\n## /).slice(1)) {
  const [title, ...rest] = sec.split('\n');
  const name = title.trim();
  if (!['Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'Metrics'].includes(name)) continue;
  const lines = rest.join('\n').split('\n');
  const intro = lines.find((l) => l.trim() && !l.startsWith('|') && !l.startsWith('A new row needs') && !l.startsWith('Always'))?.trim();
  const needs = lines.find((l) => l.startsWith('A new row needs'))?.trim() || '';
  const always = (lines.find((l) => l.startsWith('Always written'))?.replace(/^Always written by a table from Data: /, '').replace(/\.$/, '') || '').split(', ').filter(Boolean);
  const tbl = lines.filter((l) => l.startsWith('|'));
  const head = tbl[0].split('|').slice(1, -1).map((s) => s.trim());
  const cols = tbl.slice(2).map((l) => { const c = l.split(' | ').map((s) => s.replace(/^\|\s?|\s?\|$/g, '').trim()); const o = {}; head.forEach((h, i) => (o[h] = (c[i] || '').replace(/^`|`$/g, ''))); return o; });
  out[name] = { intro, needs, always, cols: cols.map((o) => head.length === 7 ? { col: o.Column, need: o['A new row'], format: o.Format, example: o.Example, empty: o['If it’s left empty'], means: o['What it means'], back: o['When loaded back'] } : { col: o.Column, need: o.Kind, means: o['What it means'], back: o['When loaded back'] }) };
}
fs.writeFileSync(process.argv[3], '// The field table and every sheet’s columns, copied from the kit (spec/core/export-format.md, the field table rule).\n// Faro makes these from src/domain/columns.ts; here they are data. Regenerate with local/genfields.mjs.\nexport const FORMAT = ' + JSON.stringify(out, null, 1) + ';\n');
console.log(Object.entries(out).map(([k, v]) => `${k}:${v.cols.length} ${v.needs.slice(0, 40)}`).join('\n'));
