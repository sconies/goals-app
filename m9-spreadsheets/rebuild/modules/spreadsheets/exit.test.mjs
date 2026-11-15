// Stage 9's exit criteria, one test each, with the module on, switched off, and left out of the build.
// Run: node --test modules/spreadsheets/exit.test.mjs   (from rebuild/). Each mode starts its own server.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readWorkbook, writeWorkbook } from './book.mjs';
import { FORMAT } from './fields.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const KIT = path.resolve(root, '../spec');
const MODES = (process.env.MODES || 'on,off,out').split(',');

function client(port) {
  const B = `http://localhost:${port}`;
  const ck = { as: 'amara' };
  const cookie = () => Object.entries(ck).map(([k, v]) => `${k}=${v}`).join('; ');
  async function go(pathname, opts = {}) {
    let url = B + pathname, method = opts.method || 'GET', body = opts.body, hops = 0, r;
    for (;;) {
      r = await fetch(url, { method, body, headers: { cookie: cookie(), ...(opts.headers || {}) }, redirect: 'manual' });
      if (r.status === 303 || r.status === 302) { url = new URL(r.headers.get('location'), B).href; method = 'GET'; body = undefined; if (++hops > 5) break; continue; }
      break;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, url: url.replace(B, ''), headers: r.headers, buf, text: buf.toString('utf8') };
  }
  const upload = (name, data, extra = {}) => { const fd = new FormData(); for (const [k, v] of Object.entries(extra)) fd.append(k, v); fd.append('file', new Blob([data]), name); return go('/data/import', { method: 'POST', body: fd }); };
  const post = (p, form) => go(p, { method: 'POST', body: new URLSearchParams(form).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  // the check, once a large file's worker is done
  const check = async (p = '/data/import/check') => { for (let i = 0; i < 300; i++) { const r = await go(p); if (!/<h1>Reading /.test(r.text)) return r; await new Promise((s) => setTimeout(s, 100)); } throw new Error('the check never finished'); };
  return { B, ck, go, upload, post, check, state: async () => JSON.parse((await go('/api/state')).text), reset: () => go('/api/reset', { method: 'POST' }) };
}
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const csvOf = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n';
const wait = (ms) => new Promise((s) => setTimeout(s, ms));

for (const mode of MODES) {
  describe(`stage 9, Spreadsheets ${mode === 'on' ? 'on' : mode === 'off' ? 'switched off' : 'left out of the build'}`, () => {
    const port = 47930 + MODES.indexOf(mode);
    let srv, c;
    before(async () => {
      srv = spawn(process.execPath, ['app/server.mjs', String(port)], { cwd: root, env: { ...process.env, FARO_WITHOUT: mode === 'out' ? 'spreadsheets' : '' }, stdio: ['ignore', 'pipe', 'inherit'] });
      await new Promise((res, rej) => { srv.stdout.on('data', (d) => /rebuilt on/.test(d) && res()); srv.on('exit', (code) => rej(new Error(`the app did not start (${code})`))); });
      c = client(port);
    });
    after(() => srv.kill());
    const fresh = async () => {
      await c.reset(); c.ck.as = 'amara'; delete c.ck.today;
      if (mode === 'off') { const r = await c.post('/act/setFeature', { id: 'spreadsheets', on: 'false' }); assert.match(text(r.text), /Spreadsheets is off in/); }
    };
    // with the module not on, every criterion's door is shut: the page is Page not found with the module's sentence
    const shut = async (p) => {
      const r = await c.go(p);
      assert.equal(r.status, 404, `${p} should be Page not found`);
      if (mode === 'off') assert.match(text(r.text), /Spreadsheets is switched off in Platform Engineering\. An admin can switch it on in Workspace, Features\./);
    };
    const exportXlsx = async (q = '') => c.go(`/data/import?export=xlsx${q}`);

    test('1. its requirements hold (EXPORT, BULK-IMPORT, IMPORT-ACTIONS, SPREADSHEETS-ON-DATA, FIELD-TABLE, IMPORT-LEVELS, IMPORT-PREVIEW, IMPORT-UNDO, IMPORT-LARGE)', async () => {
      await fresh();
      const data = await c.go('/data');
      if (mode !== 'on') {
        assert.doesNotMatch(data.text, /data-export|data-import/); await shut('/data/import'); await shut('/import');
        const goals = await c.go('/goals?scope=all'); assert.doesNotMatch(goals.text, /Export these goals/);
        const help = await c.go('/help'); assert.doesNotMatch(help.text, /Importing from a spreadsheet/);
        // its AI tools: listed, and answer with the module's sentence while off (left out: not there at all)
        const tok = (await c.state()).tokens.amara;
        const call = await fetch(`${c.B}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'export', arguments: { format: 'brief' } } }) }).then((r) => r.json());
        if (mode === 'off') assert.match(call.result.content[0].text, /Spreadsheets is switched off in Platform Engineering, so export can’t be used there/);
        else assert.equal(call.error.code, -32602);
        return;
      }
      // EXPORT: one workbook with every sheet, Start here first; the other formats
      const wb = readWorkbook((await exportXlsx()).buf).map((s) => s.name);
      assert.deepEqual(wb, ['Start here', 'Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'Metrics']);
      for (const f of ['zip', 'json', 'md']) assert.equal((await c.go(`/data/import?export=${f}`)).status, 200);
      // SPREADSHEETS-ON-DATA: Export and Import side by side on Data
      assert.match(data.text, /<summary>Export<\/summary>/); assert.match(data.text, /class="data-import" href="\/data\/import">Import</);
      // BULK-IMPORT: a new goal, then its past weeks, marked as loaded later
      c.ck.as = 'mateo';
      await c.upload('goals.csv', 'Goal,Owner,Type,Unit,Start,Target,Feeds into\nRunbooks with an owner,Mateo Fernández,metric,%,20,90,Change failure rate\n');
      let r = await c.post('/data/import/check', { op: 'save' });
      assert.match(text(r.text), /Saved 1 row from goals\.csv\./);
      await c.upload('history.csv', 'Goal,Week,Value\nRunbooks with an owner,42,20\nRunbooks with an owner,43,20\n');
      r = await c.check(); assert.match(text(r.text), /2 check-ins \(2 for past weeks\)/);
      await c.post('/data/import/check', { op: 'save' });
      let s = await c.state();
      const g = s.goals ? null : null; // goals count only in /api/state; the change log says enough
      assert.ok(s.changes.filter((x) => x.action === 'imported').length === 2);
      // IMPORT-ACTIONS: Stop with a Reason, and the import's Undo puts it back
      c.ck.as = 'amara';
      const book = readWorkbook((await exportXlsx()).buf);
      const goals = book.find((x) => x.name === 'Goals').rows;
      const H = goals[0], col = (n) => H.indexOf(n);
      const row = goals.find((x, i) => i > 0 && x[col('Owner')] === 'Mateo Fernández' && x[col('Last check-in week')]);
      row[col('Action')] = 'Stop'; row[col('Reason')] = 'Folded into the incident review goal for the rest of the year.';
      await c.upload('stop.xlsx', writeWorkbook([{ name: 'Goals', rows: [H, row] }]));
      r = await c.check(); assert.match(text(r.text), /1 goal stopped/);
      r = await c.post('/data/import/check', { op: 'save' });
      const impId = /\/data\/import\/done\/([^/?]+)/.exec(r.url)[1];
      s = await c.state(); assert.ok(s.changes.some((x) => x.importId === impId && x.action === 'stopped'));
      // IMPORT-UNDO: one line in Past imports, one entry in Activity, Undo as a whole
      assert.match(text((await c.go('/data/imports')).text), /stop\.xlsx/);
      assert.match(text((await c.go('/activity?kind=imports')).text), /imported stop\.xlsx/);
      r = await c.post('/data/imports', { op: 'undo', id: impId });
      assert.match(text(r.text), /Undone: 1 row put back\./);
      // IMPORT-LEVELS and IMPORT-PREVIEW: criteria 5 to 8; IMPORT-LARGE: 11 and 14; FIELD-TABLE: 10
      const imp = text((await c.go('/data/import')).text);
      assert.match(imp, /Up to 30,000 rows a file, and 5,000 changes at a time\./);
      // its AI tools answer
      const tok = (await c.state()).tokens.amara;
      const mcp = (name, args) => fetch(`${c.B}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }).then((x) => x.json());
      assert.match((await mcp('export', { format: 'brief' })).result.content[0].text, /## How to read the status/);
      assert.match((await mcp('export', { format: 'goals_csv' })).result.content[0].text, /^Key,ID,Goal,Action/);
      assert.match((await mcp('export_table', { columns: ['Goal', 'Owner'] })).result.content[0].text, /adding Key and ID so it loads back\.\n\nGoal,Owner,Key,ID/);
    });

    test('2. its journeys and checks can be done (U20, U87, U88, U89, U90, U94, U95, U96, U46, U48, U19 as far as built; see JOURNEYS.md)', async () => {
      await fresh();
      if (mode !== 'on') { await shut('/data/import/check'); await shut('/data/imports'); await shut('/data/import/done/imp_x'); return; }
      // U95: pasted rows with a near header, asked once, read as Target, saved
      let r = await c.post('/data/import', { paste: 'Goal name\tOwner\tTeam\tUnit\tStart\tTargett\nPasted cache hit rate\tRhea Kapoor\tCI/CD\t%\t20\t90\n' });
      assert.match(text(r.text), /A column on Goals is called “targett”\. Read it as Target\?/i);
      const grp = /name="group" value="([^"]*near-header[^"]*)"/.exec(r.text)[1];
      await c.post('/data/import/check', { op: 'answer', group: grp, answer: 'use' });
      r = await c.check(); assert.match(r.text, /Save 1 change/);
      r = await c.post('/data/import/check', { op: 'save' }); assert.match(r.url, /\/data\/import\/done\/imp_/);
      // U95: a title row above the headers; no Faro sheet
      await c.upload('titled.csv', 'Platform goals FY27,,\nGoal,Owner,Team,Unit,Start,Target\nTitled cache size,Rhea Kapoor,CI/CD,GB,20,10\n');
      assert.match(text((await c.check()).text), /Row 2 of titled\.csv is the header row; 1 row above it was skipped\./);
      await c.upload('staff.csv', 'Name,Department,Salary band\nAna,Ops,B\n');
      r = await c.check(); assert.match(text(r.text), /Its first sheet’s headers are Name, Department, Salary band…/); assert.match(r.text, /role="alert"[\s\S]*Download the template/);
      // U96: leave one row out, the rest saves, Imported says so and offers it
      await c.upload('u96.csv', 'Goal,Owner,Team,Unit,Start,Target\nKept cache hit rate,Rhea Kapoor,CI/CD,%,20,90\nOrphan cache size,,CI/CD,GB,20,10\n');
      r = await c.check(); assert.match(r.text, /Leave this row out and save the rest/); assert.match(text(r.text), /Orphan cache size/);
      r = await c.post('/data/import/check', { op: 'leave', rows: 'goals:3' });
      assert.match(text(r.text), /1 row was left out at your choice/); assert.match(r.text, /autofocus>Save 1 change/);
      r = await c.post('/data/import/check', { op: 'save' });
      assert.match(text(r.text), /1 row was left out\./); assert.match(r.text, /Download them/);
      // U88: one answer for many rows; the corrected file keeps it
      const head = 'Goal,Owner,Team,Type,Unit,Start,Target,Stages\n';
      const many = Array.from({ length: 14 }, (_, i) => `Runner pool ${i + 1} wait,Rhea Kapoor,CI/DC,metric,min,10,5,\n`).join('');
      const orphans = (o) => ['Cache warm-up', 'Artifact pruning', 'Mirror freshness'].map((t) => `${t},${o},CI/CD,metric,min,10,5,\n`).join('');
      const staged = 'Runbooks rewritten,Rhea Kapoor,,milestone,,,,Draft@2; Signed off@50\n';
      await c.upload('goals-u88.csv', head + many + orphans('') + staged);
      r = await c.check(); const t88 = text(r.text);
      assert.match(t88, /3 rows, 1 kind of problem/); assert.match(t88, /2 questions cover 15 rows/); assert.doesNotMatch(r.text, />Save \d/); assert.match(r.text, /Choose the corrected file/);
      const g88 = /name="group" value="(near-ref[^"]*)"/.exec(r.text)[1];
      r = await c.post('/data/import/check', { op: 'answer', group: g88, answer: 'use' });
      assert.match(text(r.text), /Did you mean CI\/CD\?: Use CI\/CD/); assert.match(r.text, />Change</);
      const fix = await c.go('/data/import/check?download=fix');
      assert.match(fix.headers.get('content-disposition'), /goals-u88-rows-to-fix\.xlsx/);
      const fb = readWorkbook(fix.buf); assert.equal(fb[0].rows[0][0], 'Problem'); assert.equal(fb[0].rows.length, 4);
      r = await c.upload('goals-u88.csv', head + many + orphans('Rhea Kapoor') + staged, { keep: '1' });
      r = await c.check(); assert.match(text(r.text), /Your 1 answer still applies\./);
      const gs = /name="group" value="(past-stage[^"]*)"/.exec(r.text)[1];
      r = await c.post('/data/import/check', { op: 'answer', group: gs, answer: 'no' });
      assert.match(r.text, /Save 18 changes/);
      r = await c.go('/data/import/check/changes'); assert.match(text(r.text), /the owner’s team; the row gave none/);
      r = await c.post('/data/import/check', { op: 'save' }); assert.match(r.url, /done\/imp_/);
      // U94: as Tunde, another's goal and a People row: two groups, both left out, his change saves
      c.ck.as = 'tunde';
      const wb = readWorkbook((await exportXlsx()).buf);
      const G = wb.find((x) => x.name === 'Goals').rows, P = wb.find((x) => x.name === 'People').rows;
      const gi = (n) => G[0].indexOf(n);
      const mine = G.find((x) => x[gi('Owner')] === 'Tunde Bakare' && x[gi('Type')] === 'metric');
      const hers = G.find((x) => x[gi('Owner')] === 'Rhea Kapoor' && x[gi('Type')] === 'metric');
      mine[gi('Target')] = Number(mine[gi('Target')]) + 2; hers[gi('Target')] = Number(hers[gi('Target')]) + 2;
      const pr = P.find((x) => x[1] === 'rhea'); pr[P[0].indexOf('Job title')] = 'Pipeline lead';
      await c.upload('u94.xlsx', writeWorkbook([{ name: 'Goals', rows: [G[0], mine, hers] }, { name: 'People', rows: [P[0], pr] }]));
      r = await c.check(); const t94 = text(r.text);
      assert.match(t94, /1 row changes a goal you don’t own/); assert.match(t94, /1 row changes people\. Only an admin can add or change people/);
      for (const m of [...r.text.matchAll(/name="label" value="([^"]*)"><input type="hidden" name="rows" value="([^"]*)"><button>Leave these rows out/g)]) r = await c.post('/data/import/check', { op: 'leave', label: m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'), rows: m[2] });
      assert.match(text(r.text), /2 rows are left out/); assert.equal((r.text.match(/class="import-answered"/g) || []).length, 2);
      if (/Why the plans change/.test(r.text)) r = await c.post('/data/import/check', { op: 'reason', reason: 'Agreed at the build review' });
      assert.match(r.text, /Save 1 change/);
      r = await c.post('/data/import/check', { op: 'save' }); assert.match(r.url, /done\/imp_/);
      c.ck.as = 'amara';
    });

    test('3. Export from Goals saves one workbook named {workspace}-goals-all-{date}.xlsx (or as-shown when filtered); Data’s table as shown says its rows, columns and added key columns', async () => {
      await fresh();
      const goals = await c.go('/goals?scope=all');
      if (mode !== 'on') { assert.doesNotMatch(goals.text, /Export these goals/); assert.doesNotMatch((await c.go('/data')).text, /as-shown|Export \.xlsx/); await shut('/data/import?export=xlsx'); return; }
      assert.match(goals.text, /Export these goals/); assert.match(goals.text, /platform-engineering-goals-all-2026-11-05\.xlsx: 126 goals, as of week \d+\./);
      const r = await c.go('/data/import?export=xlsx&view=' + encodeURIComponent('?scope=all'));
      assert.match(r.headers.get('content-disposition'), /filename="platform-engineering-goals-all-2026-11-05\.xlsx"/);
      const f = await c.go('/goals?scope=all&attention=1'); const view = /name="view" value="([^"]*)"/.exec(f.text)[1].replace(/&amp;/g, '&');
      assert.match((await c.go('/data/import?export=xlsx&view=' + encodeURIComponent(view))).headers.get('content-disposition'), /-goals-as-shown-2026-11-05\.xlsx/);
      const data = text((await c.go('/data')).text);
      assert.match(data, /Saves the Goals table as shown: 126 rows and 6 columns, adding Key and ID so it loads back\./);
      assert.match((await c.go('/data/import?export=xlsx&what=table')).headers.get('content-disposition'), /platform-engineering-goals-as-shown-2026-11-05\.xlsx/);
    });

    test('4. a workbook downloaded and loaded straight back changes nothing, on any day and at any number of decimal places', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import?export=xlsx');
      for (const today of ['2026-11-05', '2026-06-17']) {
        c.ck.today = today;
        const wb = (await exportXlsx()).buf;
        await c.upload('back.xlsx', wb);
        const r = await c.check(); const t = text(r.text);
        assert.match(t, /Nothing would change\./, today); assert.doesNotMatch(t, /Must fix|Questions|differs from what Faro works out today/);
      }
      delete c.ck.today;
      // a goal kept at 3 decimal places, with a check-in, loaded back unchanged
      await c.post('/data/import', { paste: 'Goal\tOwner\tTeam\tUnit\tDecimals\tStart\tTarget\nPrecise ratio\tAmara Nwosu\tOffice of the VP\tratio\t3\t0.125\t0.333\n' });
      await c.post('/data/import/check', { op: 'save' });
      const wb = readWorkbook((await exportXlsx()).buf); const G = wb.find((x) => x.name === 'Goals').rows; const key = G.find((x) => x[2] === 'Precise ratio')[0];
      await c.post('/data/import', { paste: `Goal key\tWeek\tValue\tCall\n${key}\t44\t0.127\t\n` });
      await c.post('/data/import/check', { op: 'save' });
      await c.upload('back.xlsx', (await exportXlsx()).buf);
      assert.match(text((await c.check()).text), /Nothing would change\./);
    });

    test('5. a workbook with one wrong row saves nothing, and the preview names the row and the problem', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import/check');
      const before = (await c.state()).goals;
      await c.upload('wrong.csv', csvOf([['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target'], ['Good one', 'Rhea Kapoor', 'CI/CD', '%', 20, 90], ['Bad one', 'Rhea Kapoor', 'CI/CD', '%', 'six', 90]]));
      const r = await c.check(); const t = text(r.text);
      assert.match(t, /Must fix/); assert.match(t, /“six” isn’t a number/); assert.match(t, /Goals row 3/); assert.doesNotMatch(r.text, />Save \d/);
      const s = await c.post('/data/import/check', { op: 'save' });
      assert.equal((await c.state()).goals, before); assert.match(text(s.text), /Must fix/);
    });

    test('6. one row to fix is offered as a download with Problem first; leaving it out saves the rest; a new goal left out takes its check-ins and the goals that feed into it, each saying why', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import/check?download=fix');
      const goals = csvOf([['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target', 'Feeds into'], ['Parent cache goal', '', 'CI/CD', '%', 20, 90, ''], ['Child cache goal', 'Rhea Kapoor', 'CI/CD', '%', 20, 90, 'Parent cache goal'], ['Other cache goal', 'Rhea Kapoor', 'CI/CD', '%', 20, 90, '']]);
      const cks = csvOf([['Goal', 'Week', 'Value'], ['Parent cache goal', 43, 25], ['Other cache goal', 43, 30]]);
      const { zip } = await import('./book.mjs');
      await c.upload('six.zip', zip([{ name: 'Goals.csv', data: goals }, { name: 'Check-ins.csv', data: cks }]));
      let r = await c.check();
      const fix = await c.go('/data/import/check?download=fix');
      const fb = readWorkbook(fix.buf); assert.equal(fb[0].rows[0][0], 'Problem'); assert.match(fb[0].rows[1][0], /needs an owner/); assert.equal(fb[0].rows[1][1], 'Parent cache goal');
      r = await c.post('/data/import/check', { op: 'leave', rows: 'goals:2' });
      const t = text(r.text);
      assert.match(t, /Goals row 3 goes with it: Feeds into names Goals row 2\./); assert.match(t, /Check-ins row 2 goes with it: its goal, Goals row 2, is left out\./);
      r = await c.post('/data/import/check', { op: 'save' });
      assert.match(text(r.text), /Saved 2 rows from six\.zip\./); assert.match(text(r.text), /3 rows were left out\./);
    });

    test('7. a workbook loaded back with Status edited on two rows changes nothing and says so; a column nothing reads is named in the file line', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import/check');
      const book = readWorkbook((await exportXlsx()).buf);
      const G = book.find((x) => x.name === 'Goals').rows;
      const st = G[0].indexOf('Status');
      G[0].push('Budget');
      G[1][st] = 'Done'; G[2][st] = G[2][st] === 'Off track' ? 'On track' : 'Off track'; G[1].push('£40k');
      await c.upload('edited.xlsx', writeWorkbook(book.map((s) => ({ name: s.name, rows: s.rows }))));
      const t = text((await c.check()).text);
      assert.match(t, /On 2 rows, Status differs from what Faro works out today/); assert.match(t, /Nothing would change\./); assert.match(t, /the column Budget on Goals/);
    });

    test('8. fourteen rows with one typo are one question; answered, all fourteen save as the team; a name one letter out is asked, never guessed', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import/check');
      const rows = [['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target'], ...Array.from({ length: 14 }, (_, i) => [`Dashboard ${i + 1} load time`, 'Rhea Kapoor', 'Observabilty', 's', 10, 5])];
      await c.upload('typo.csv', csvOf(rows));
      let r = await c.check(); const t = text(r.text);
      assert.match(t, /1 question covers 14 rows/); assert.match(t, /Did you mean Observability\?/); assert.doesNotMatch(r.text, />Save \d/);
      const g = /name="group" value="(near-ref[^"]*)"/.exec(r.text)[1];
      await c.post('/data/import/check', { op: 'answer', group: g, answer: 'use' });
      r = await c.check(); assert.match(r.text, /Save 14 changes/);
      r = await c.go('/data/import/check/changes'); assert.equal((text(r.text).match(/Team: — → Observability/g) || []).length, 14);
      await c.post('/data/import/check', { op: 'save' });
      const s = await c.state(); assert.equal(s.changes.filter((x) => x.action === 'created' && x.diffs.some((d) => d.field === 'Team' && d.to === 'Observability')).length, 14);
    });

    test('9. the template loaded straight back changes nothing, and its example rows are left out and counted', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import?download=template');
      const tpl = await c.go('/data/import?download=template');
      assert.match(tpl.headers.get('content-disposition'), /filename="faro-template\.xlsx"/);
      const book = readWorkbook(tpl.buf);
      assert.equal(book[0].name, 'Start here'); assert.ok(book[0].rows.some((r) => r[0] === 'Goal' && r[1] === 'Required'));
      const G = book.find((x) => x.name === 'Goals').rows; assert.ok(!G[0].includes('Status'));
      assert.deepEqual(G.slice(1).map((r) => r[G[0].indexOf('Action')]), ['Example', 'Example']);
      await c.upload('faro-template.xlsx', tpl.buf);
      const t = text((await c.check()).text);
      assert.match(t, /3 example rows left out\./); assert.match(t, /Nothing would change\./);
    });

    test('10. the field table gives every column the same need, format and example as Faro’s', async () => {
      await fresh();
      if (mode !== 'on') return shut('/help/columns');
      // Faro's, from the kit
      const md = fs.readFileSync(path.join(KIT, 'core/export-format.md'), 'utf8');
      for (const sheet of ['Goals', 'Plan', 'Check-ins', 'People']) {
        const sec = md.split(`\n## ${sheet}\n`)[1].split('\n## ')[0];
        const rows = sec.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Column')).map((l) => l.split(' | ').map((x) => x.replace(/^\|\s?|\s?\|$/g, '').replace(/^`|`$/g, '').trim()));
        assert.deepEqual(FORMAT[sheet].cols.map((x) => [x.col, x.need, x.format, x.example]), rows.map((r) => [r[0], r[1], r[2], r[3]]), sheet);
      }
      // the workbook's Start here, Help and Import are made from it
      const start = readWorkbook((await exportXlsx()).buf)[0].rows;
      for (const x of FORMAT.Goals.cols) assert.ok(start.some((r) => r[0] === x.col && r[1] === x.need && (r[2] || '') === x.format && String(r[3] ?? '') === x.example), x.col);
      const help = text((await c.go('/help/columns')).text);
      assert.match(help, /Goal: Required\./); assert.match(help, /Owner: Required \(or Owner email\)/); assert.match(help, /Start: Required for a number goal/); assert.match(help, /Status: Worked out/);
      const imp = text((await c.go('/data/import')).text);
      assert.match(imp, /Goal, and Owner or Owner email\. A number goal also needs Start and Target/); assert.match(imp, /Goal key \(or Goal\), Week, and Value or Stages\./); assert.match(imp, /Name and Email\./);
    });

    test('11. 5,000 new rows are checked within 8 seconds and an unedited workbook of 30,000 rows within 20, giving what a row-by-row scan gives', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import/check');
      const rows = [['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target'], ...Array.from({ length: 5000 }, (_, i) => [`Bulk goal ${i + 1}`, 'Rhea Kapoor', 'CI/CD', '%', 10, 50 + (i % 40)])];
      let t0 = Date.now();
      await c.upload('5000.csv', csvOf(rows));
      let r = await c.check();
      const took = Date.now() - t0;
      assert.ok(took < 8000, `5,000 rows took ${took} ms`); assert.match(r.text, /Save 5,?000 changes|5000 new goals|5,000 new goals/);
      // the same result a row-by-row scan gives: the full run's changes are the sum of each row's own
      const { App } = await import('../../app/state.mjs');
      const I = await import('./importer.mjs');
      const app = new App(); app.now = app.W.builtFor;
      const rec = I.recognise(app, 'x.csv', I.readFile('x.csv', Buffer.from(csvOf(rows.slice(0, 201)))));
      const full = I.check(app, 'amara', rec.tables);
      let sum = 0; const kinds = new Set();
      for (const row of rec.tables.goals) { const one = I.check(app, 'amara', { goals: [row] }); sum += one.items.length; for (const i of one.issues) kinds.add(i.kind); }
      assert.equal(full.items.length, sum); assert.deepEqual(new Set(full.issues.map((i) => i.kind)), kinds);
      // 30,000 rows, unedited: a workspace grown to 30,000 records (its goals copied with their check-ins), exported and read back
      const X = await import('./exporter.mjs');
      const big = new App(); big.now = big.W.builtFor;
      const W = big.W, base = W.goals.slice(), baseCk = W.checkIns.slice();
      let k = Math.max(...W.goals.map((g) => Number(g.key.slice(2))));
      for (let n = 1; W.goals.length + W.checkIns.length + W.people.length < 30000; n++) for (const g of base) {
        const id = `${g.id}_x${n}`;
        W.goals.push({ ...JSON.parse(JSON.stringify(g)), id, key: `G-${++k}`, title: `${g.title} (${n})`, parentId: null, stages: g.stages ? g.stages.map((st) => ({ ...st, id: `${st.id}_x${n}` })) : undefined });
        for (const ck of baseCk) if (ck.goalId === g.id) W.checkIns.push({ ...JSON.parse(JSON.stringify(ck)), id: `${ck.id}_x${n}`, goalId: id, stages: ck.stages ? ck.stages.map((st) => ({ ...st, stageId: `${st.stageId}_x${n}` })) : null });
        if (W.goals.length + W.checkIns.length + W.people.length >= 30000) break;
      }
      big.rebind();
      const wb = X.workbook(big);
      t0 = Date.now();
      const rec2 = I.recognise(big, 'big.xlsx', I.readFile('big.xlsx', wb));
      const res2 = I.check(big, 'amara', rec2.tables);
      const took2 = Date.now() - t0;
      assert.ok(rec2.rowCount >= 30000, `${rec2.rowCount} rows`);
      assert.ok(took2 < 20000, `the unedited workbook of ${rec2.rowCount} rows took ${took2} ms`);
      assert.equal(res2.items.length, 0); assert.equal(res2.issues.filter((i) => i.level !== 'note').length, 0);
    });

    test('12. every row of the conformance file import.csv gives the same kind, level, group and sentence', async () => {
      if (mode === 'out') return; // the engine is the core's: scored once
      const out = execFileSync(process.execPath, ['spec/rebuild/drill.mjs', 'rebuild', '--files', 'import'], { cwd: path.resolve(root, '..'), encoding: 'utf8' });
      assert.match(out, /import\.csv: 70 of 70 rows match \(100\.0%\)/);
      assert.ok(JSON.parse(fs.readFileSync(path.join(root, 'drill.json'), 'utf8')).also.includes('import'));
    });

    test('13. an import of 5 goals and 10 check-ins, with one check-in posted on an imported goal since, previews Undo as 14 back and 1 staying, naming who and when; Undo does exactly that; Past imports says when and by whom', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/imports');
      const titles = ['Mirror sync lag', 'Cache hit rate', 'Flaky test share', 'Queue wait p90', 'Runner idle time'].map((t) => `${t} (U90)`);
      const goals = [['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target'], ...titles.map((t) => [t, 'Rhea Kapoor', 'CI/CD', '%', 20, 90])];
      const cks = [['Goal', 'Week', 'Value'], ...titles.flatMap((t) => [[t, 42, 21], [t, 43, 22]])];
      await c.upload('u90.xlsx', writeWorkbook([{ name: 'Goals', rows: goals }, { name: 'Check-ins', rows: cks }]));
      let r = await c.post('/data/import/check', { op: 'save' });
      assert.match(text(r.text), /Saved 15 rows from u90\.xlsx\./); assert.match(r.text, /Undo this import/);
      const id = /done\/([^/?]+)/.exec(r.url)[1];
      // Rhea posts a check-in on the first imported goal (as the app does), week 45
      c.ck.as = 'rhea';
      const s0 = await c.state();
      const gid = s0.changes.find((x) => x.importId === id && x.action === 'created' && /Mirror sync lag/.test(x.summary)).entityId;
      await c.post(`/check-in/${gid}`, { value: '30', call: 'on', why: 'The mirror caught up after the move.' });
      c.ck.as = 'amara';
      r = await c.go('/data/imports'); const t = text(r.text);
      assert.match(t, /u90\.xlsx/); assert.match(t, /1 of its 15 rows has changed since, so Undo would put back 14\./);
      assert.match(t, /14 rows go back to how they were on/); assert.match(t, /Rhea Kapoor posted a check-in for week 45 on 5 Nov/); assert.match(r.text, /Rows that stay as they are/);
      r = await c.post('/data/imports', { op: 'undo', id });
      assert.match(text(r.text), /Undone: 14 rows put back\./); assert.match(text(r.text), /Undone on 5 Nov 2026 by Amara Nwosu\./);
      const s1 = await c.state();
      assert.equal(s1.changes.filter((x) => x.action === 'undid import').length, 1);
      const a = text((await c.go('/activity')).text); assert.match(a, /imported u90\.xlsx/); assert.match(a, /Show the 15 changes/);
    });

    test('14. 6,000 new goals: Reading with progress and Stop; Stop saves nothing; checked, it offers 2 files of 5,000 rows instead of Save, and the parts load one after the other; the page stays free and the preview small', async () => {
      await fresh();
      if (mode !== 'on') return shut('/data/import/check');
      const rows = [['Goal', 'Owner', 'Team', 'Unit', 'Start', 'Target'], ...Array.from({ length: 6000 }, (_, i) => [`Big goal ${i + 1}`, 'Rhea Kapoor', 'CI/CD', '%', 10, 50])];
      const file = csvOf(rows);
      const before = (await c.state()).goals;
      await c.upload('6000.csv', file);
      let r = await c.go('/data/import/check');
      assert.match(text(r.text), /Reading 6000\.csv/); assert.match(text(r.text), /Checked [\d,]+ of 6,000 rows\. Found so far:/); assert.match(r.text, />Stop</);
      r = await c.post('/data/import/check', { op: 'stop' });
      assert.match(text(r.text), /Stopped\. Nothing was saved\./); assert.equal((await c.state()).goals, before);
      await c.upload('6000.csv', file);
      // while it is checked, the app answers in under 200 ms
      const t0 = Date.now(); await c.go('/data/import/check'); assert.ok(Date.now() - t0 < 200, `${Date.now() - t0} ms`);
      r = await c.check();
      assert.match(r.text, /Download as 2 files/); assert.doesNotMatch(r.text, />Save \d/);
      assert.ok((r.text.match(/<[a-z]/g) || []).length < 3000, 'the preview has fewer than 3,000 elements');
      const z = await c.go('/data/import/check?download=parts');
      const { unzip } = await import('./book.mjs');
      const parts = [...unzip(z.buf)];
      assert.equal(parts.length, 2);
      for (const [name, data] of parts) {
        await c.upload(name, data);
        r = await c.check(); assert.match(r.text, /Save [\d,]+ changes/);
        r = await c.post('/data/import/check', { op: 'save' }); assert.match(r.url, /done\/imp_/);
      }
      assert.equal((await c.state()).goals, before + 6000);
    });
  });
}
