import fs from 'node:fs';
const X = await import('../modules/spreadsheets/xlsx.mjs');
const r = await fetch('http://localhost:4180/export/xlsx?scope=all', { headers: { cookie: 'as=grace' } });
const buf = Buffer.from(await r.arrayBuffer());
const b = X.readXlsx(buf);
const G = b.find(s => s.name === 'Goals'); const c = (h) => G.rows[0].indexOf(h);
const mode = process.argv[2];
if (mode === 'u46') { const r14 = G.rows.find(r => r[c('Key')] === 'G-14'); r14[c('Action')] = 'Stop'; r14[c('Reason')] = 'Folded into G-1'; const r37 = G.rows.find(r => r[c('Key')] === 'G-37'); r37[c('Owner')] = 'Rhea Kapoor'; r37[c('Team')] = 'CI/CD'; }
fs.writeFileSync('local/x.xlsx', mode ? X.writeXlsx(b) : buf);
