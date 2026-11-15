// Stage 9's exit criteria, one test each, run with the module on and with it off.
// node --test modules/spreadsheets/exit.test.mjs        (from rebuild/; starts its own servers on :4191 and :4192)
// JOURNEYS=0 skips criterion 2's Playwright run (it takes a few minutes); it is then reported as skipped, not passed.
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REBUILD = path.resolve(here, '../..');
const KIT = path.resolve(REBUILD, '..');
const WS = path.join(KIT, 'spec/conformance/workspace.json');
const { load } = await import('../../s1.mjs');
const { S1 } = await load(WS);
const { makeRules, WORKSPACE_NAME } = await import('../../stage3.mjs');
const E = await import('./export.mjs');
const I = await import('./importer.mjs');
const U = await import('./undo.mjs');
const X = await import('./xlsx.mjs');
const FRESH = JSON.stringify(S1.W);

// a context over a copy of the workspace, as the app builds one
function ctxOf(opt = {}) {
  const W = JSON.parse(FRESH); W.changes = []; if (opt.off) W.modulesOff = ['spreadsheets'];
  if (opt.edit) opt.edit(W);
  const S = { ...S1, W };
  const R = makeRules(W, S);
  const moment = `${opt.day || '2026-11-05'}T12:00:00.000Z`;
  return { W, S1: S, R, viewer: opt.as || 'amara', moment, week: S1.currentWeek(moment), wsId: 'demo', wsName: WORKSPACE_NAME, todayIso: moment.slice(0, 10), nowIso: () => moment, on: (id) => !(W.modulesOff || []).includes(id) };
}
const csv = (t) => Buffer.from(t, 'utf8');
const readBack = (ctx, buf, name = 'f.xlsx', answers = {}, leave = []) => {
  const rt = I.readTables(I.readFile(buf, name), { fileName: name });
  const left = leave.length ? I.leaveOut(rt, leave) : [];
  const res = I.run(ctx, rt, answers);
  return { rt, res, gs: I.groups(res, rt), left };
};
const real = (res) => res.issues.filter((i) => i.level !== 'note');

// ---------- the two servers ----------
// a pooled connection the server has closed while this process was busy is retried once on a fresh one
const fetch = async (u, o = {}) => { try { return await globalThis.fetch(u, o); } catch { return globalThis.fetch(u, { ...o, headers: { ...(o.headers || {}), connection: 'close' } }); } };
const servers = {};
async function startServer(port, off) {
  const env = { ...process.env, ...(off ? { FARO_MODULES_OFF: 'spreadsheets' } : {}) };
  const log = fs.openSync(path.join(REBUILD, 'local', `exit-server-${port}.log`), 'w');
  const p = spawn(process.execPath, ['app/server.mjs', String(port)], { cwd: REBUILD, env, stdio: ['ignore', log, log] });
  for (let i = 0; i < 60; i++) { try { await fetch(`http://localhost:${port}/`); return p; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  throw new Error('the app did not start');
}
const http = (port) => ({
  base: `http://localhost:${port}`,
  get: (u, as = 'amara') => fetch(`http://localhost:${port}${u}`, { headers: { cookie: `as=${as}` }, redirect: 'manual' }),
  text: async (u, as = 'amara') => (await (await fetch(`http://localhost:${port}${u}`, { headers: { cookie: `as=${as}` } })).text()),
  post: (u, form, as = 'amara') => fetch(`http://localhost:${port}${u}`, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), redirect: 'manual' }),
  upload: (file, buf, as = 'amara') => fetch(`http://localhost:${port}/data/import/check`, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ file, data: buf.toString('base64') }).toString(), redirect: 'manual' }),
  mcp: async (name, args, as = 'amara') => (await (await fetch(`http://localhost:${port}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${as}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })).json()).result,
  reset: () => fetch(`http://localhost:${port}/__reset`, { method: 'POST' }),
});
const plain = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
before(async () => { servers.on = await startServer(4191, false); servers.off = await startServer(4192, true); });
after(() => { servers.on?.kill(); servers.off?.kill(); });
const ON = http(4191), OFF = http(4192);
// with the module off: none of it answers, and the core still does
async function offEverywhere() {
  for (const u of ['/data/import', '/data/imports', '/import', '/export/xlsx?scope=all', '/data/import/template']) assert.equal((await OFF.get(u)).status, 404, `${u} finds nothing`);
  const goals = await OFF.text('/goals?scope=all'); assert.ok(!goals.includes('Export these goals')); assert.ok(goals.includes('goals-toolbar'));
  const data = await OFF.text('/data'); assert.ok(!data.includes('data-import') && !data.includes('data-export')); assert.ok(data.includes('data-tools'));
  const r = await OFF.mcp('export', { format: 'json' });
  assert.equal(r.isError, true); assert.equal(r.content[0].text, `Spreadsheets is switched off in ${WORKSPACE_NAME}, so export can’t be used there. An admin can switch it on in Workspace, under Features.`);
}

for (const mode of ['on', 'off']) {
  describe(`module ${mode}`, () => {
    const off = mode === 'off';

    test('1. its requirements hold: EXPORT, BULK-IMPORT, IMPORT-ACTIONS, SPREADSHEETS-ON-DATA, FIELD-TABLE, IMPORT-LEVELS, IMPORT-PREVIEW, IMPORT-UNDO, IMPORT-LARGE', async () => {
      if (off) return offEverywhere();
      const ctx = ctxOf();
      // EXPORT: one workbook with every sheet, Start here first
      const b = X.readXlsx(E.workbook(ctx));
      assert.deepEqual(b.map((s) => s.name), ['Start here', 'Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'Metrics']);
      for (const s of ['zip', 'csv?sheet=Goals', 'json', 'brief']) assert.equal((await ON.get(`/export/${s}${s.includes('?') ? '&' : '?'}scope=all`)).status, 200, s);
      // BULK-IMPORT: past weeks marked as loaded later; logged as from a spreadsheet
      const add = readBack(ctx, csv('Goal,Owner,Team,Unit,Start,Target,Plan from week\nBulk goal,Rhea Kapoor,CI/CD,%,10,50,40\n'), 'g.csv');
      U.saveImport(ctx, add.res, { file: 'g.csv', describe: 'x' });
      const hist = readBack(ctx, csv('Goal,Week,Value\nBulk goal,42,16\n'), 'h.csv');
      assert.equal(hist.res.counts.backfilled, 1);
      const imp = U.saveImport(ctx, hist.res, { file: 'h.csv', describe: 'x' });
      assert.equal(ctx.W.checkIns.find((c) => c.week === 42 && c.goalId === hist.res.items[0].target).backfilled, true);
      assert.equal(imp.via, 'Spreadsheet');
      // IMPORT-ACTIONS: Stop with a Reason, and its Undo
      const st = readBack(ctx, csv('Key,Action,Reason\nG-14,Stop,Folded into G-1\n'), 's.csv');
      const si = U.saveImport(ctx, st.res, { file: 's.csv', describe: 'x' });
      assert.ok(ctx.W.goals.find((g) => g.key === 'G-14').stoppedAt);
      U.undoImport(ctx, si); assert.ok(!ctx.W.goals.find((g) => g.key === 'G-14').stoppedAt);
      // SPREADSHEETS-ON-DATA: Export and Import on Data, Import opens /data/import with the template
      const data = await ON.text('/data'); assert.ok(data.includes('class="data-export"') && data.includes('class="btn data-import" href="/data/import"'));
      assert.match((await ON.get('/data/import/template')).headers.get('content-disposition'), /faro-template\.xlsx/);
      assert.equal((await ON.get('/import')).headers.get('location'), '/data/import');
      // FIELD-TABLE: Help, the template and Start here made from the one table
      assert.ok((await ON.text('/help/columns')).includes('Required for a number goal'));
      // IMPORT-LEVELS: Must fix blocks; a Check is asked once for its rows
      const lv = readBack(ctx, csv('Goal,Owner,Team,Unit,Start,Target\nA goal,Rhea Kapoor,CI/DC,%,1,2\nB goal,Rhea Kapoor,CI/DC,%,1,2\nC goal,,CI/CD,%,1,2\n'), 'l.csv');
      assert.equal(lv.res.saves, false);
      assert.equal(lv.gs.filter((g) => g.kind === 'near-ref').length, 1); assert.equal(lv.gs.find((g) => g.kind === 'near-ref').n, 2);
      // IMPORT-PREVIEW: what was read, counts, unread columns named
      assert.match(I.readLine(add.rt), /^Read Goals\./);
      // IMPORT-UNDO: one line in Past imports per import
      assert.equal(U.pastImports(ctx.W).length, 3);
      // IMPORT-LARGE: the limits said before a file is chosen
      assert.ok((await ON.text('/data/import')).includes('Up to 30,000 rows a file, and 5,000 changes at a time.'));
    });

    test('1. (IMPORT-ACTIONS) Left marks someone as left, their goals and asks to Takes over: not built in the core engine', { todo: 'the stage 2 engine never reads People’s Action Left (GAPS M9-4)' }, () => {
      const ctx = ctxOf();
      const r = readBack(ctx, csv('ID,Action,Takes over\ntunde,Left,Rhea Kapoor\n'), 'p.csv');
      assert.equal(r.res.counts.left, 1);
    });

    test('2. its journeys and checks can be done: U19, U20, U46, U48, U87, U88, U89, U94, U90, U95, U96, F7, F8, F17, N5', { skip: process.env.JOURNEYS === '0' ? 'JOURNEYS=0' : false }, async () => {
      if (off) {
        await offEverywhere();
        // U48's off half: Help keeps Data in and out, without the module's articles
        const help = await OFF.text('/help'); assert.ok(help.includes('Data in and out')); assert.ok(!help.includes('Importing from a spreadsheet'));
        return;
      }
      await ON.reset();
      const r = spawnSync(process.execPath, [path.join(here, 'journeys.cjs')], { cwd: REBUILD, env: { ...process.env, FARO_BASE: ON.base }, encoding: 'utf8', timeout: 900000 });
      const results = JSON.parse(fs.readFileSync(path.join(here, 'journeys-results.json'), 'utf8'));
      const notDone = Object.entries(results).filter(([, v]) => v.verdict !== 'DONE').map(([k, v]) => `${k}: ${v.fails.join('; ')}`);
      // F7, F8, F17 and N5 are named in the kit with no steps (their eval scripts aren't in it)
      assert.deepEqual(notDone, [], `${r.stdout}`);
      assert.fail('F7, F8, F17 and N5 have no steps in the kit, so they can’t be done here');
    });

    test('3. Export from Goals saves one workbook with one press, named {workspace}-goals-all-{date}.xlsx (or the view’s name when filtered); Data’s table as shown is named …-as-shown-{date}, and says first how many rows and columns it holds and which key columns it adds', async () => {
      if (off) return offEverywhere();
      const goals = await ON.text('/goals?scope=all');
      assert.equal((goals.match(/class="btn primary export-go"/g) || []).length, 1, 'one Export .xlsx');
      assert.ok(goals.includes('platform-engineering-goals-all-2026-11-05.xlsx'), 'the name shown before it saves');
      assert.match((await ON.get('/export/xlsx?scope=all')).headers.get('content-disposition'), /"platform-engineering-goals-all-2026-11-05\.xlsx"/);
      assert.match((await ON.get('/export/xlsx?scope=all&attention=1')).headers.get('content-disposition'), /-goals-as-shown-2026-11-05\.xlsx"/);
      const data = plain(await ON.text('/data'));
      assert.match(data, /This table as shown: 97 rows and 5 columns; adds Email and ID so it loads back\./);
      const t = await ON.get('/export/table?format=xlsx');
      assert.match(t.headers.get('content-disposition'), /-people-as-shown-2026-11-05\.xlsx"/);
      const rows = X.readXlsx(Buffer.from(await t.arrayBuffer()))[0].rows;
      assert.deepEqual(rows[0], ['Name', 'Team', 'Admin', 'Email', 'ID']);
    });

    test('4. A workbook downloaded from the rebuild and loaded straight back changes nothing: every row reads as unchanged, on any day and at any number of decimal places', () => {
      if (off) return offEverywhere(); // the rule is the module's: off, nothing exports or loads
      const decimals = (W) => {
        const g = W.goals.find((x) => x.key === 'G-1'); g.decimals = 3; g.plan = { ...g.plan, start: 52.125, target: 24.5 };
        for (const c of W.checkIns.filter((x) => x.goalId === g.id)) c.value = Math.round(c.value * 1000 + 333) / 1000;
        const r = W.goals.find((x) => x.key === 'G-11'); r.range = { ...r.range, limit: 2.05, margin: 0.125 }; r.decimals = 3;
      };
      // a day: the workspace as it stood then (nothing posted after it), as the app on that day holds it
      const asOn = (day, more) => (W) => { const m = `${day}T12:00:00.000Z`; W.checkIns = W.checkIns.filter((c) => c.postedAt <= m && c.week <= S1.currentWeek(m)); W.goals = W.goals.filter((g) => !g.createdAt || g.createdAt <= m); if (more) more(W); };
      for (const [day, edit] of [['2026-11-05'], ['2026-03-02'], ['2026-07-15'], ['2026-11-05', decimals]]) {
        const ctx = ctxOf({ day, edit: asOn(day, edit) });
        const { res } = readBack(ctx, E.workbook(ctx));
        assert.equal(res.items.length, 0, `${day}: ${res.items.slice(0, 2).map((i) => JSON.stringify(i.diffs)).join(' ')}`);
        assert.deepEqual(real(res).map((i) => i.message), [], day);
        assert.equal(res.unchanged, ctx.W.goals.length + ctx.W.checkIns.length + ctx.W.people.length);
      }
    });

    test('5. A workbook with one wrong row saves nothing, and the preview names the row and the problem', async () => {
      if (off) return offEverywhere();
      await ON.reset();
      const before = (await ON.mcp('export', { format: 'json' })).content[0].text;
      await ON.upload('one-wrong.csv', csv('Goal,Owner,Team,Unit,Start,Target\nGood goal,Rhea Kapoor,CI/CD,%,10,50\nBad goal,Rhea Kapoor,CI/CD,%,ten,50\n'));
      const page = plain(await ON.text('/data/import/check'));
      assert.match(page, /Goals row 3: “ten” isn’t a number/);
      assert.ok(!/Save \d/.test(page));
      await ON.post('/data/import/save', {});
      assert.equal(JSON.parse((await ON.mcp('export', { format: 'json' })).content[0].text).goals.length, JSON.parse(before).goals.length, 'nothing saved');
    });

    test('6. A file with one row to fix offers the rows to fix as a download, its first column Problem, and leaving them out saves the rest; a new goal left out takes its check-ins and the goals that feed into it with it, each saying why', async () => {
      if (off) return offEverywhere();
      await ON.reset();
      // a new goal in the same file is named by its Ref (the engine doesn't find a new goal by its name: GAPS M9-10)
      const goals = 'Goal,Ref,Owner,Team,Unit,Start,Target,Plan from week,Feeds into ref\nParent cache,p,,CI/CD,%,10,50,40,\nChild cache,c,Rhea Kapoor,CI/CD,%,10,50,40,p\nOther cache,o,Rhea Kapoor,CI/CD,%,10,50,40,\n';
      const cks = 'Goal ref,Week,Value\np,42,16\np,43,19\n';
      const book = X.writeXlsx([{ name: 'Goals', rows: I.readFile(csv(goals), 'g.csv')[0].rows }, { name: 'Check-ins', rows: I.readFile(csv(cks), 'c.csv')[0].rows }]);
      await ON.upload('six.xlsx', book);
      const fix = X.readXlsx(Buffer.from(await (await ON.get('/data/import/fix')).arrayBuffer()));
      assert.ok(fix.every((sh) => sh.rows[0][0] === 'Problem'), 'Problem first'); assert.equal(fix[0].name, 'Goals'); assert.match(fix[0].rows[1][0], /needs an owner/); assert.equal(fix[0].rows[1][1], 'Parent cache');
      const dlg = plain(await ON.text('/data/import/check'));
      assert.match(dlg, /3 rows go with it/);
      assert.match(dlg, /Check-ins row 2, because its goal \(Goals row 2\) is left out/);
      assert.match(dlg, /Goals row 3: Child cache, because Feeds into names Goals row 2/);
      await ON.post('/data/import/leave', { row: 'goals:2' });
      assert.match(plain(await ON.text('/data/import/check')), /1 row was left out at your choice, and 3 rows that depend on it\./);
      const saved = await ON.post('/data/import/save', {});
      assert.match(saved.headers.get('location'), /^\/data\/import\/done\/imp_/);
      const d = JSON.parse((await ON.mcp('export', { format: 'json' })).content[0].text);
      assert.ok(d.goals.find((g) => g.title === 'Other cache')); assert.ok(!d.goals.find((g) => /Parent cache|Child cache/.test(g.title)));
    });

    test('7. A workbook loaded back with Status edited on two rows changes nothing and says so, and a column nothing reads is named in the file line', () => {
      if (off) return offEverywhere();
      const ctx = ctxOf();
      const b = X.readXlsx(E.workbook(ctx)); const G = b[1]; const s = G.rows[0].indexOf('Status');
      for (const r of [1, 2]) G.rows[r][s] = G.rows[r][s] === 'Done' ? 'Off track' : 'Done';
      G.rows[0].push('Budget'); G.rows[1][G.rows[0].length - 1] = '12000';
      const { rt, res } = readBack(ctx, X.writeXlsx(b));
      assert.equal(res.items.length, 0);
      assert.equal(I.workedOutLine(I.workedOutEdits(ctx, rt)), 'On 2 rows, Status differs from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.');
      assert.match(I.readLine(rt), /the column Budget on Goals/);
    });

    test('8. Fourteen rows with one typo (“Platfrom”) are one question; answered “Use Platform”, all fourteen save as Platform. A name or word one letter out is asked about, never guessed', () => {
      if (off) return offEverywhere();
      const ctx = ctxOf({ edit: (W) => W.teams.push({ id: 'platform', name: 'Platform', leadId: null, objective: '' }) });
      const file = csv(`Goal,Owner,Team,Unit,Start,Target\n${Array.from({ length: 14 }, (_, i) => `Platform goal ${i + 1},Rhea Kapoor,Platfrom,%,1,2`).join('\n')}\n`);
      const a = readBack(ctx, file);
      const q = a.gs.filter((g) => g.level === 'check');
      assert.equal(q.length, 1); assert.equal(q[0].n, 14); assert.equal(q[0].answers[0].label, 'Use Platform');
      assert.equal(a.res.saves, false); assert.equal(a.res.items.length, 0, 'never guessed');
      const b = readBack(ctx, file, 'f.csv', { [q[0].id]: 'use' });
      assert.equal(b.res.saves, true); assert.equal(b.res.items.length, 14);
      U.saveImport(ctx, b.res, { file: 'f.csv', describe: 'x' });
      assert.equal(ctx.W.goals.filter((g) => /^Platform goal/.test(g.title) && g.teamId === 'platform').length, 14);
    });

    test('9. The template loaded straight back changes nothing, and its example rows (Action says Example) are left out and counted', () => {
      if (off) return offEverywhere();
      const ctx = ctxOf();
      const { rt, res } = readBack(ctx, E.template(ctx), 'faro-template.xlsx');
      assert.equal(res.items.length, 0); assert.deepEqual(real(res), []);
      assert.equal(rt.examples, 3); assert.match(I.readLine(rt), /3 example rows left out\./);
      assert.deepEqual(rt.read, ['Goals', 'Plan', 'Check-ins', 'People']);
    });

    test('10. The rebuild’s field table gives every column the same need, format and example as Faro’s (core rule: the field table)', () => {
      if (off) return offEverywhere();
      const md = fs.readFileSync(path.join(KIT, 'spec/core/rules/field-table.md'), 'utf8');
      let sheet = null; const want = {};
      for (const l of md.split('\n')) {
        const h = l.match(/^\*\*(Goals|Plan|Check-ins|People)\*\*/); if (h) { sheet = h[1]; want[sheet] = []; continue; }
        if (sheet && /^\| /.test(l) && !/^\| Column/.test(l)) { const c = l.split('|').slice(1, -1).map((x) => x.trim()); want[sheet].push([c[0], c[1], c[2], c[3]]); }
        if (/^Worked out:/.test(l)) sheet = null;
      }
      for (const s of ['Goals', 'Plan', 'Check-ins', 'People']) {
        const mine = E.SHEET[s].cols.filter((c) => !/^Worked out/.test(c.need) && c.format !== undefined).map((c) => [c.col, c.need, c.format, c.example]);
        assert.deepEqual(mine, want[s], s);
      }
    });

    test('11. A file of 5,000 new rows is checked within 8 seconds, and an unedited workbook of 30,000 rows within 20, giving the same result a row-by-row scan would (core rule: the change engine, Speed)', () => {
      if (off) return offEverywhere();
      const ctx = ctxOf();
      const lines = Array.from({ length: 5000 }, (_, i) => `Generated goal ${i},Rhea Kapoor,CI/CD,%,10,${50 + (i % 7)}`);
      const head = 'Goal,Owner,Team,Unit,Start,Target\n';
      let t = Date.now();
      const all = readBack(ctx, csv(head + lines.join('\n')));
      assert.ok(Date.now() - t < 8000, `${Date.now() - t} ms`);
      // row by row: each row on its own gives the same change
      const sample = [0, 1, 777, 2500, 4999].map((i) => readBack(ctx, csv(head + lines[i])).res.items[0]);
      for (const [k, i] of [[0, 0], [1, 1], [2, 777], [3, 2500], [4, 4999]]) assert.deepEqual(sample[k].diffs.filter(([f]) => f !== 'Via'), all.res.items[i].diffs.filter(([f]) => f !== 'Via'));
      // a 30,000-row workbook: the demo's goals six times over
      const big = ctxOf({ edit: (W) => { const g0 = W.goals.slice(), c0 = W.checkIns.slice(); for (let k = 1; k < 6; k++) { for (const g of g0) W.goals.push({ ...g, id: `${g.id}~${k}`, key: `G-${1000 * k + Number(g.key.slice(2))}`, title: `${g.title} (${k})`, parentId: g.parentId ? `${g.parentId}~${k}` : null, stages: g.stages?.map((s) => ({ ...s, id: `${s.id}~${k}` })) }); for (const c of c0) W.checkIns.push({ ...c, id: `${c.id}~${k}`, goalId: `${c.goalId}~${k}`, stages: c.stages?.map((s) => ({ ...s, stageId: `${s.stageId}~${k}` })) }); } } });
      const buf = E.workbook(big);
      t = Date.now();
      const r = readBack(big, buf);
      assert.ok(r.rt.rows >= 30000, `${r.rt.rows} rows`); assert.ok(Date.now() - t < 20000, `${Date.now() - t} ms`);
      assert.equal(r.res.items.length, 0); assert.deepEqual(real(r.res), []);
    });

    test('12. Every row of the conformance file import.csv gives the same kind, level, group and sentence (the drill scores it when drill.json lists "import" under "also")', () => {
      const drill = JSON.parse(fs.readFileSync(path.join(REBUILD, 'drill.json'), 'utf8'));
      assert.ok(drill.also.includes('import'));
      const r = spawnSync(process.execPath, ['spec/rebuild/drill.mjs', 'rebuild'], { cwd: KIT, env: { ...process.env, ...(off ? { FARO_MODULES_OFF: 'spreadsheets' } : {}) }, encoding: 'utf8', timeout: 600000 });
      assert.match(r.stdout, /import\.csv: 70 of 70 rows match \(100\.0%\)/);
      assert.match(r.stdout, /PASS: every row and column matches/);
      assert.equal(r.status, 0);
    });

    test('13. An import of 5 goals and 10 check-ins, with one check-in posted on an imported goal since, previews Undo as 14 rows going back and 1 staying, naming who posted the check-in and when; Undo then does exactly that, and Past imports says when and by whom it was undone', async () => {
      if (off) return offEverywhere();
      await ON.reset();
      const names = ['Undo one', 'Undo two', 'Undo three', 'Undo four', 'Undo five'];
      const book = X.writeXlsx([{ name: 'Goals', rows: [['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target', 'Plan from week'], ...names.map((n) => [n, 'Rhea Kapoor', 'CI/CD', '%', '10', '50', '40'])] }, { name: 'Check-ins', rows: [['Goal', 'Week', 'Value'], ...names.flatMap((n) => [[n, '42', '16'], [n, '43', '19']])] }]);
      await ON.upload('u13.xlsx', book);
      const done = await ON.post('/data/import/save', {});
      const id = done.headers.get('location').split('/').pop();
      const d = JSON.parse((await ON.mcp('export', { format: 'json' })).content[0].text);
      const gid = d.goals.find((g) => g.title === 'Undo one').id;
      await ON.post(`/check-in/${gid}`, { value: '30', post: '1' }, 'rhea');
      const past = plain(await ON.text('/data/imports'));
      assert.match(past, /1 of its 15 rows has changed since, so Undo would put back 14\./);
      assert.match(past, /14 rows go back to how they were on 5 Nov/);
      assert.match(past, /Undo one: Rhea Kapoor posted a check-in for week 45 on 5 Nov/);
      await ON.post(`/data/imports/${id}/undo`, {});
      const after = JSON.parse((await ON.mcp('export', { format: 'json' })).content[0].text);
      assert.deepEqual(after.goals.filter((g) => names.includes(g.title)).map((g) => g.title), ['Undo one']);
      assert.equal(after.goals.find((g) => g.title === 'Undo one').checkIns.length, 1, 'only Rhea’s check-in stays');
      assert.match(plain(await ON.text('/data/imports')), /Undone on 5 Nov by Amara Nwosu: 14 rows put back, 1 kept\./);
    });

    test('14. A file of 6,000 new goals shows Reading with progress and Stop; Stop saves nothing; checked, it offers Download as 2 files of 5,000 rows instead of Save, and the parts load one after the other; while it is checked, the page never stops for more than 200 ms and the preview has fewer than 3,000 elements', async () => {
      if (off) return offEverywhere();
      await ON.reset();
      const file = csv(`Goal,Owner,Team,Unit,Start,Target\n${Array.from({ length: 6000 }, (_, i) => `Bulk goal ${i},Rhea Kapoor,CI/CD,%,10,50`).join('\n')}\n`);
      const r1 = await ON.upload('six-thousand.csv', file);
      assert.equal(r1.headers.get('location'), '/data/import/reading');
      const reading = plain(await ON.text('/data/import/reading'));
      assert.match(reading, /Reading six-thousand\.csv/); assert.match(reading, /Stop/);
      await ON.post('/data/import/stop', {});
      assert.equal(JSON.parse((await ON.mcp('export', { format: 'json' })).content[0].text).goals.length, 126, 'Stop saved nothing');
      // checked to the end in a browser: the page never stops for long, and the preview stays small
      const { chromium } = createRequire(import.meta.url)('playwright');
      const b = await chromium.launch(); const c = await b.newContext(); await c.addCookies([{ name: 'as', value: 'amara', url: ON.base }]);
      const p = await c.newPage();
      await p.addInitScript(() => { window.__long = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long = Math.max(window.__long, e.duration); }).observe({ type: 'longtask', buffered: true }); });
      await p.goto(`${ON.base}/data/import`);
      await p.locator('#sheetfile').setInputFiles({ name: 'six-thousand.csv', mimeType: 'text/csv', buffer: file });
      await p.waitForURL(/\/data\/import\/check$/, { timeout: 60000 });
      const long = await p.evaluate(() => window.__long); const elements = await p.evaluate(() => document.querySelectorAll('*').length);
      const text = await p.locator('body').innerText();
      await b.close();
      assert.ok(long <= 200, `a long task of ${long} ms`); assert.ok(elements < 3000, `${elements} elements`);
      assert.match(text, /Download as 2 files of 5,000 rows/); assert.ok(!/Save \d/.test(text), 'no Save');
      const parts = [1, 2].map(async (k) => Buffer.from(await (await ON.get(`/data/import/parts?part=${k}`)).arrayBuffer()));
      const [p1, p2] = await Promise.all(parts);
      for (const [n, buf] of [['part-1.xlsx', p1], ['part-2.xlsx', p2]]) {
        await ON.upload(n, buf);
        for (let i = 0; i < 200; i++) { const j = await (await ON.get('/data/import/progress')).json(); if (j.done) break; await new Promise((r) => setTimeout(r, 200)); }
        const s = await ON.post('/data/import/save', {}); assert.match(s.headers.get('location') || '', /done\/imp_/, n);
      }
      assert.equal(JSON.parse((await ON.mcp('export', { format: 'json' })).content[0].text).goals.length, 6126);
    });
  });
}
