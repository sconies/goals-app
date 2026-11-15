import fs from 'node:fs';
const big = process.argv[2] === 'big';
let wsPath = new URL('../../spec/conformance/workspace.json', import.meta.url).pathname;
if (big) { // the demo, its goals six times over: about 32,000 rows
  const W = JSON.parse(fs.readFileSync(wsPath)); const goals = [], cks = [];
  for (let k = 0; k < 6; k++) for (const g of W.goals) { const id = k ? `${g.id}~${k}` : g.id; goals.push({ ...g, id, key: k ? `G-${1000 * k + Number(g.key.slice(2))}` : g.key, title: k ? `${g.title} (${k})` : g.title, parentId: g.parentId ? (k ? `${g.parentId}~${k}` : g.parentId) : null, stages: g.stages?.map((s) => ({ ...s, id: k ? `${s.id}~${k}` : s.id })) });
    for (const c of W.checkIns.filter((c) => c.goalId === g.id)) cks.push({ ...c, id: k ? `${c.id}~${k}` : c.id, goalId: id, stages: c.stages?.map((s) => ({ ...s, stageId: k ? `${s.stageId}~${k}` : s.stageId })) }); }
  W.goals = goals; W.checkIns = cks; wsPath = new URL('./big-ws.json', import.meta.url).pathname; fs.writeFileSync(wsPath, JSON.stringify(W));
}
const { load } = await import('../s1.mjs');
const { S1 } = await load(wsPath);
const { makeRules, WORKSPACE_NAME } = await import('../stage3.mjs');
const E = await import('../modules/spreadsheets/export.mjs');
const I = await import('../modules/spreadsheets/importer.mjs');
const W = S1.W; const R = makeRules(W, S1); const moment = '2026-11-05T12:00:00.000Z';
const ctx = { W, S1, R, viewer: 'amara', moment, week: 45, wsName: WORKSPACE_NAME, todayIso: '2026-11-05', nowIso: () => moment, on: () => true };
let t = Date.now();
if (big) {
  const buf = E.workbook(ctx); console.log('export', Date.now() - t, 'ms');
  t = Date.now(); const rt = I.readTables(I.readFile(buf, 'b.xlsx')); console.log('rows', rt.rows, 'read', Date.now() - t);
  t = Date.now(); const res = I.run(ctx, rt); console.log('engine', Date.now() - t, 'ms; items', res.items.length, 'issues', res.issues.filter(i => i.level !== 'note').length);
} else {
  const rows = ['Goal,Owner,Team,Unit,Start,Target'];
  for (let i = 0; i < 5000; i++) rows.push(`Generated goal ${i},Rhea Kapoor,CI/CD,%,10,50`);
  const rt = I.readTables(I.readFile(Buffer.from(rows.join('\n')), 'n.csv'));
  t = Date.now(); const res = I.run(ctx, rt); console.log('5000 new: engine', Date.now() - t, 'ms; items', res.items.length, 'issues', res.issues.filter(i => i.level !== 'note').length);
}
