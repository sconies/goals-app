import { App } from '../app/state.mjs';
import { readFile, recognise, check } from '../modules/spreadsheets/importer.mjs';
const app = new App(); app.now = app.W.builtFor;
const head = 'Goal,Owner,Team,Type,Unit,Start,Target,Stages\n';
const many = Array.from({ length: 14 }, (_, i) => `Runner pool ${i + 1} wait,Rhea Kapoor,CI/DC,metric,min,10,5,\n`).join('');
const orphans = (owner) => ['Cache warm-up', 'Artifact pruning', 'Mirror freshness'].map((t) => `${t},${owner},CI/CD,metric,min,10,5,\n`).join('');
const staged = 'Runbooks rewritten,Rhea Kapoor,,milestone,,,,Draft@2; Signed off@50\n';
const txt = process.argv[2] === 'b' ? head + many + orphans('Rhea Kapoor') + staged : head + many + orphans('') + staged;
const rec = recognise(app, 'g.csv', readFile('g.csv', Buffer.from(txt)));
const ans = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const res = check(app, 'amara', rec.tables, ans);
const seen = new Set();
for (const i of res.issues) { if (seen.has(i.group)) continue; seen.add(i.group); const { seq, ...o } = i; console.log(JSON.stringify(o)); }
console.log(res.items.length, res.saves, JSON.stringify(res.counts), res.items.slice(-1).map(i=>JSON.stringify(i.diffs)));
