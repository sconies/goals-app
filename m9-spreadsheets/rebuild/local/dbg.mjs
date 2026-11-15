import { App } from '../app/state.mjs';
import * as X from '../modules/spreadsheets/exporter.mjs';
import * as I from '../modules/spreadsheets/importer.mjs';
import { readWorkbook, writeWorkbook, zip } from '../modules/spreadsheets/book.mjs';
const app = new App(); app.now = app.W.builtFor;
const book = readWorkbook(X.workbook(app));
const G = book.find((x) => x.name === 'Goals').rows, H = G[0], col = (n) => H.indexOf(n);
const row = G.find((x, i) => i > 0 && x[col('Owner')] === 'Mateo Fernández' && x[col('Last check-in week')]);
row[col('Action')] = 'Stop'; row[col('Reason')] = 'Folded into the incident review goal for the rest of the year.';
let rec = I.recognise(app, 's.xlsx', I.readFile('s.xlsx', writeWorkbook([{ name: 'Goals', rows: [H, row] }])));
let res = I.check(app, 'amara', rec.tables);
console.log(res.issues.filter(i=>i.level!=='note').map(i=>i.message), res.items.map(i=>i.kind));
// with the row only Key + Action + Reason
rec = I.recognise(app, 's.xlsx', I.readFile('s.xlsx', writeWorkbook([{ name: 'Goals', rows: [['Key','Goal','Action','Reason'], [row[0], row[2], 'Stop', 'Folded into the incident review goal for the rest of the year.']] }])));
res = I.check(app, 'amara', rec.tables); console.log(res.issues.filter(i=>i.level!=='note').map(i=>i.message), res.items.map(i=>i.kind));
// six
const csvOf = (rows) => rows.map((r) => r.join(',')).join('\n') + '\n';
const goals = csvOf([['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target', 'Feeds into'], ['Parent cache goal', '', 'CI/CD', '%', 20, 90, ''], ['Child cache goal', 'Rhea Kapoor', 'CI/CD', '%', 20, 90, 'Parent cache goal'], ['Other cache goal', 'Rhea Kapoor', 'CI/CD', '%', 20, 90, '']]);
const cks = csvOf([['Goal', 'Week', 'Value'], ['Parent cache goal', 43, 25], ['Other cache goal', 43, 30]]);
rec = I.recognise(app, 'six.zip', I.readFile('six.zip', zip([{ name: 'Goals.csv', data: goals }, { name: 'Check-ins.csv', data: cks }])));
res = I.check(app, 'amara', rec.tables); console.log(res.issues.filter(i=>i.level!=='note').map(i=>[i.sheet,i.row,i.kind,i.message]));
