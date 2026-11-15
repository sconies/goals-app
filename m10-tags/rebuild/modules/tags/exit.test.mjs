// Stage 10's exit criteria (spec/rebuild/stage-10-module-tags.md), one test each, with Fields on, switched off, and left out
// of the build. Run: node --test modules/tags/exit.test.mjs   (from rebuild/)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../../app/state.mjs';
import { fieldProblem, valueProblem, filterGoals, pickedOf, pickedText, NOT_SET } from './rules.mjs';
import * as F from './fields.mjs';
import { readFieldColumns, applyFieldColumns, undoFieldColumns, exportColumns } from './sheet.mjs';
import { tagsRows } from './conformance.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const REB = path.resolve(here, '../..');
const WS = 'Platform Engineering';
const OFF_PAGE = `Fields is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const offTool = (t) => `Fields is switched off in ${WS}, so ${t} can’t be used there. An admin can switch it on in Workspace, under Features.`;

async function start(port, env = {}) {
  const s = spawn(process.execPath, [path.join(REB, 'app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  let err = '';
  s.stderr.on('data', (d) => (err += d));
  await new Promise((res, rej) => { s.stdout.once('data', res); s.once('exit', (c) => rej(new Error(`the app didn’t start (exit ${c}): ${err}`))); });
  return s;
}
const client = (base) => {
  const get = async (p, as = 'amara') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}` }, redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
  const post = async (p, body, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded', referer: base + '/' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
  const state = async () => (await fetch(`${base}/api/state`)).json();
  const reset = async () => fetch(`${base}/api/reset`, { method: 'POST' });
  const tool = async (token, name, args) => { const r = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }); const j = await r.json(); return { isError: j.result.isError, text: j.result.content[0].text, data: j.result.structuredContent }; };
  return { get, post, state, reset, tool };
};
const seed = async (c) => {
  await c.post('/act/tags.addField', { name: 'Stage', kind: 'list', options: 'Discover\nBuild\nRun' });
  await c.post('/act/tags.setGoalFields', { goalId: 'lead-flaky', fieldId: 'fld_stage', value: 'Build' });
  await c.post('/act/tags.setGoalFields', { goalId: 'ci-docker', fieldId: 'fld_stage', value: 'Discover' });
};
const switchTo = (c, on) => c.post('/act/setFeature', { id: 'tags', on: on ? 'true' : 'false' });
const appWith = () => { const a = new App(); a.now = a.W.builtFor; return a; };

for (const mode of ['on', 'off']) describe(`Fields ${mode}`, () => {
  const PORT = mode === 'on' ? 47311 : 47312, base = `http://localhost:${PORT}`;
  let s, c, tok;
  before(async () => { s = await start(PORT); c = client(base); tok = (await c.state()).tokens; });
  after(() => s.kill());
  // each test starts from the demo with Stage seeded, and then switched off when the mode says so
  const fresh = async ({ seeded = true } = {}) => { await c.reset(); if (seeded) await seed(c); if (mode === 'off') await switchTo(c, false); };

  test('criterion 1: its requirements hold (TAGS-FIELDS, TAGS-FILTER, TAGS-SHEET, TAGS-OFF)', async () => {
    await fresh();
    const goal = await c.get('/goals/lead-flaky');
    const filtered = await c.get('/goals?scope=all&f.fld_stage=Build');
    const data = await c.get('/data?t=goals');
    if (mode === 'on') {
      assert.match(goal.text, /Stage · Build/); // TAGS-FIELDS
      assert.match(filtered.text, /Remove the filter Stage is Build/); // TAGS-FILTER
      assert.match(data.text, /<th>Stage<\/th>/); // TAGS-SHEET (Data's Goals table)
    } else { // TAGS-OFF
      assert.doesNotMatch(goal.text, /data-part="Fields"/);
      assert.doesNotMatch(filtered.text, /Stage is Build/);
      assert.doesNotMatch(data.text, /<th>Stage<\/th>/);
      assert.equal((await c.get('/workspace/fields')).status, 404);
    }
  });

  test('criterion 2: its journeys and checks can be done (U174, U177, U178, N34: see JOURNEYS.md)', async () => {
    // the journeys run in a browser (journeys.test.mjs); here: their state is reachable through the app's doors
    await fresh();
    const st = await c.state();
    assert.equal(st.modules.tags.fields[0].id, 'fld_stage');
    assert.ok(st.modules.tags.fieldValues.some((v) => v.goalId === 'lead-flaky' && v.value === 'Build'));
  });

  test('criterion 3: fieldProblem and valueProblem give the rule’s worked examples, and tags.csv’s rows', () => {
    const stage = { id: 'fld_stage', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
    assert.deepEqual(valueProblem(stage, ' build '), { kept: 'Build' });
    assert.equal(valueProblem(stage, 'Operate').problem, '“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
    assert.equal(fieldProblem({ name: 'owner', kind: 'list', options: ['A'] }, []), 'The Goals sheet already has a column called “Owner”. Call the field something else.');
    const six = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `f${i}`, name: `F${i}`, kind: 'text', options: [], position: i }));
    assert.equal(fieldProblem({ name: 'Region', kind: 'text', options: [] }, six), 'A workspace has at most 6 fields. Retire one first.');
    // every row of spec/conformance/tags.csv: the harness's score (node spec/rebuild/drill.mjs rebuild --files tags)
    const r = spawnSync(process.execPath, [path.join(REB, '../spec/rebuild/drill.mjs'), REB, '--files', 'tags', '--diffs', '0'], { cwd: path.join(REB, '..'), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout.slice(-400));
    assert.equal(tagsRows().length, 25);
  });

  test('criterion 4: the store refuses a name over 40, another kind, a list of 0 or 21, free text with values, a value over 80', () => {
    const base = { id: 'fld_x', name: 'X', kind: 'list', options: ['A'], position: 0 };
    assert.throws(() => F.checkRow('field', { ...base, name: 'x'.repeat(41) }), /goal_fields_name_check/);
    assert.throws(() => F.checkRow('field', { ...base, kind: 'number' }), /goal_fields_kind_check/);
    assert.throws(() => F.checkRow('field', { ...base, options: [] }), /goal_fields_options_check/);
    assert.throws(() => F.checkRow('field', { ...base, options: Array.from({ length: 21 }, (_, i) => `V${i}`) }), /goal_fields_options_check/);
    assert.throws(() => F.checkRow('field', { ...base, kind: 'text', options: ['A'] }), /goal_fields_text_no_options/);
    assert.throws(() => F.checkRow('value', { id: 'g:f', goalId: 'g', fieldId: 'f', value: 'y'.repeat(81) }), /goal_field_values_value_check/);
    assert.throws(() => F.checkRow('value', { id: 'g', goalId: 'g', fieldId: 'f', value: 'y' }), /goal_field_values_one/);
  });

  test('criterion 5: Workspace → Fields, adding Stage, and setting a goal’s Stage in place (U174)', async () => {
    await fresh({ seeded: false });
    const empty = await c.get('/workspace/fields');
    if (mode === 'off') { assert.equal(empty.status, 404); assert.ok(empty.text.includes(OFF_PAGE)); const r = await c.post('/act/tags.addField', { name: 'Stage', kind: 'list', options: 'Discover' }); assert.equal(r.status, 400); return; }
    assert.match(empty.text, /No fields yet/); assert.match(empty.text, /Add a field/);
    await c.post('/act/tags.addField', { name: 'Stage', kind: 'list', options: 'Discover\nBuild\nRun' });
    assert.match((await c.get('/workspace/fields')).text, /A list: Discover, Build, Run/);
    assert.match((await c.get('/goals/lead-flaky')).text, /Stage · Not set/);
    for (const v of ['Discover', 'Build']) await c.post('/act/tags.setGoalFields', { goalId: 'lead-flaky', fieldId: 'fld_stage', value: v });
    const page = (await c.get('/goals/lead-flaky')).text;
    assert.match(page, /Stage · Build/); assert.match(page, /Stage: Discover → Build/);
    assert.ok((await c.state()).changes.some((x) => x.entity === 'field' && x.goalId === 'lead-flaky' && x.summary === 'Stage: Discover → Build'));
  });

  test('criterion 6: who may, and the refusals, in the app and through the tools', async () => {
    await fresh();
    const expect = (r, words) => { if (mode === 'off') assert.ok(r.isError ?? true); else assert.ok((r.text || '').includes(words), r.text); };
    if (mode === 'off') {
      assert.ok((await c.post('/act/tags.addField', { name: 'Region', kind: 'text' })).text.includes(`Fields is switched off in ${WS}. An admin can switch it on in Workspace, under Features.`));
      assert.equal((await c.tool(tok.amara, 'save_field', { name: 'Region', kind: 'text' })).text, offTool('save_field'));
      return;
    }
    expect(await c.post('/act/tags.addField', { name: 'Region', kind: 'text' }, 'rhea'), 'Only admins can add or change fields.');
    for (const a of ['tags.changeField', 'tags.moveField', 'tags.retireField', 'tags.bringBackField']) expect(await c.post(`/act/${a}`, { fieldId: 'fld_stage', name: 'X', by: '1' }, 'rhea'), 'Only admins can add or change fields.');
    expect(await c.post('/act/tags.setGoalFields', { goalId: 'lead-flaky', fieldId: 'fld_stage', value: 'Run' }, 'aiko'), 'Only the goal’s owner or an admin can change its fields.');
    assert.equal((await c.post('/act/tags.setGoalFields', { goalId: 'lead-flaky', fieldId: 'fld_stage', value: 'Run' }, 'rhea')).status, 303); // the owner may
    expect(await c.post('/act/tags.addField', { name: 'stage', kind: 'text' }), 'There’s already a field called “Stage”.');
    expect(await c.post('/act/tags.addField', { name: 'TÉAM', kind: 'text' }), 'The Goals sheet already has a column called “Team”. Call the field something else.');
    expect(await c.post('/act/tags.setGoalFields', { goalId: 'lead-flaky', fieldId: 'fld_stage', value: 'Operate' }), '“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
    for (const n of ['B', 'C', 'D', 'E', 'F']) await c.post('/act/tags.addField', { name: `Field ${n}`, kind: 'text' });
    expect(await c.post('/act/tags.addField', { name: 'Region', kind: 'text' }), 'A workspace has at most 6 fields. Retire one first.');
    // the tools: same rules, same words
    expect(await c.tool(tok.amara, 'save_field', { name: 'Region', kind: 'text' }), 'A workspace has at most 6 fields. Retire one first.');
    expect(await c.tool(tok.rhea, 'save_field', { name: 'Region', kind: 'text' }), 'Only admins can add or change fields. This token acts as Rhea Kapoor, who isn’t an admin.');
    expect(await c.tool(tok.aiko, 'set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: 'Run' } }), 'Only the goal’s owner or an admin can change its fields.');
    expect(await c.tool(tok.rhea, 'set_goal_fields', { goal_id: 'lead-flaky', fields: { Stage: 'Operate' } }), '“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
    const dry = await c.tool(tok.rhea, 'set_goal_fields', { goal_id: 'lead-flaky', fields: { stage: 'build' }, dry_run: true });
    assert.match(dry.text, /Nothing was saved \(dry run\)/);
  });

  test('criterion 7: a retired field leaves goals’ pages and list_fields’ live fields, keeps its values, and comes back', async () => {
    await fresh();
    if (mode === 'off') { assert.equal((await c.tool(tok.amara, 'list_fields', {})).text, offTool('list_fields')); assert.equal((await c.state()).modules.tags.fieldValues.length, 2); return; }
    await c.post('/act/tags.retireField', { fieldId: 'fld_stage' });
    assert.doesNotMatch((await c.get('/goals/lead-flaky')).text, /Stage ·/);
    const lf = await c.tool(tok.amara, 'list_fields', {});
    assert.equal(lf.data.fields.length, 0); assert.equal(lf.data.retired[0].name, 'Stage');
    assert.ok((await c.state()).modules.tags.fieldValues.some((v) => v.goalId === 'lead-flaky' && v.value === 'Build'));
    await c.post('/act/tags.bringBackField', { fieldId: 'fld_stage' });
    assert.match((await c.get('/goals/lead-flaky')).text, /Stage · Build/);
  });

  test('criterion 8: the next year copies each goal’s values; a copy that leaves, or a start undone, clears them', () => {
    // the core in this rebuild has no Start the next year: the module's half (what a new cycle carries, what removal does)
    const app = appWith();
    if (mode === 'off') app.W.modulesOff = ['tags'];
    F.addField(app, 'amara', { name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] });
    F.setGoalFields(app, 'amara', { goalId: 'lead-flaky', values: { fld_stage: 'Build' } });
    F.retireField(app, 'amara', { fieldId: 'fld_stage' });
    const copies = new Map([['lead-flaky', 'lead-flaky-2027']]);
    app.W.goals.push({ ...app.goal('lead-flaky'), id: 'lead-flaky-2027', key: 'G-9001' });
    F.carryToCycle(app.W, copies, '2026-12-28T00:00:00Z', 'amara');
    assert.equal(F.valueOf(app.W, 'lead-flaky-2027', 'fld_stage'), 'Build'); // carried, retired field and all
    assert.equal(F.mod(app.W).fields.length, 1);
    F.removeForGoals(app.W, ['lead-flaky-2027'], '2026-12-29T00:00:00Z', 'amara');
    assert.equal(F.valueOf(app.W, 'lead-flaky-2027', 'fld_stage'), '');
    const row = F.mod(app.W).fieldValues.find((v) => v.id === 'lead-flaky-2027:fld_stage');
    assert.equal(F.asTableRow(row).value, ''); assert.ok(!('removed_at' in F.asTableRow(row))); // written cleared: the table has no removed_at
    F.restoreForGoals(app.W, ['lead-flaky-2027']);
    assert.equal(F.valueOf(app.W, 'lead-flaky-2027', 'fld_stage'), 'Build'); // Undo puts it back
  });

  test('criterion 9: switched off, everything of it is gone and refuses; switched back on, every value is there (N34)', async () => {
    await fresh();
    if (mode === 'on') await switchTo(c, false);
    assert.doesNotMatch((await c.get('/goals/lead-flaky')).text, /data-part="Fields"/);
    const ws = (await c.get('/workspace')).text;
    assert.doesNotMatch(ws, /href="\/workspace\/fields"/);
    const page = await c.get('/workspace/fields');
    assert.equal(page.status, 404); assert.match(page.text, /Page not found/); assert.ok(page.text.includes(OFF_PAGE));
    const goals = await c.get('/goals?scope=all');
    assert.doesNotMatch(goals.text, /aria-label="Stage"/);
    assert.doesNotMatch((await c.get('/data?t=goals')).text, /<th>Stage<\/th>/);
    const all = (await c.get('/goals?scope=all')).text.match(/role="status">([^<]*)</)[1];
    assert.equal((await c.get('/goals?scope=all&f.fld_stage=Build')).text.match(/role="status">([^<]*)</)[1], all); // narrows nothing
    for (const t of ['list_fields', 'set_goal_fields', 'save_field']) assert.equal((await c.tool(tok.amara, t, { goal_id: 'lead-flaky', fields: { Stage: 'Run' } })).text, offTool(t));
    assert.equal((await c.tool(tok.amara, 'find_goals', { fields: { Stage: 'Build' } })).text, offTool('find_goals'));
    assert.equal((await c.tool(tok.amara, 'find_goals', { q: 'flaky' })).isError, false); // find_goals itself still works
    await switchTo(c, true);
    assert.match((await c.get('/goals/lead-flaky')).text, /Stage · Build/);
    assert.match((await c.get('/goals/ci-docker')).text, /Stage · Discover/);
  });

  test('criterion 10: filterGoals gives the tags-filter rule’s worked examples', () => {
    const stage = { id: 'fld_stage', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] };
    const goals = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id }));
    const vals = { g1: 'Build', g2: 'Discover', g3: 'Build', g4: '' };
    const run = (text) => filterGoals(goals, [{ field: stage, picked: pickedOf(stage, text) }], (g) => vals[g]).map((g) => g.id);
    assert.deepEqual(run('Build'), ['g1', 'g3']);
    assert.deepEqual(run('Discover,Not set'), ['g2', 'g4']);
    assert.equal(pickedText(stage, pickedOf(stage, 'run,Operate,not set')), 'Run,Not set');
    const comma = { id: 'p', name: 'Phase', kind: 'list', options: ['Build, Run', 'Run'] };
    assert.deepEqual(pickedOf(comma, 'Build, Run'), ['Build, Run']); // a value with a comma in it is read as one
    // every field filtered must match; a field with nothing picked filters nothing
    const two = { id: 'fld_t', name: 'Tier', kind: 'list', options: ['A', 'B'] };
    const v2 = { g1: { fld_stage: 'Build', fld_t: 'A' }, g3: { fld_stage: 'Build', fld_t: 'B' } };
    assert.deepEqual(filterGoals(goals.slice(0, 3), [{ field: stage, picked: ['Build'] }, { field: two, picked: ['B'] }], (g, f) => v2[g]?.[f] || '').map((g) => g.id), ['g3']);
    assert.equal(NOT_SET, 'Not set');
  });

  test('criterion 11: as Amara, Goals’ Filters sheet has a Stage row, Build narrows it, the address carries it, Data has Stage (U177)', async () => {
    await fresh();
    const sheet = (await c.get('/goals?scope=all')).text;
    if (mode === 'off') { assert.doesNotMatch(sheet, /aria-label="Stage"/); return; }
    assert.match(sheet, /<fieldset role="group" aria-label="Stage">.*Discover.*Build.*Run.*Not set/s);
    const f = (await c.get('/goals?scope=all&f.fld_stage=Build')).text;
    assert.match(f, /Flaky test rate in the main pipelines/); assert.doesNotMatch(f, /Base image build time/);
    assert.match(f, /aria-label="Remove the filter Stage is Build"/);
    assert.match((await c.get('/data?t=goals')).text, /<th>Stage<\/th>/);
    // a saved view: the core in this rebuild has none (SAVED-VIEWS is the core's): PART, in JOURNEYS.md
  });

  test('criterion 12: the Goals sheet round-trips to nothing, asks once about Operate, and an admin’s Add saves it (U178)', () => {
    const app = appWith();
    F.addField(app, 'amara', { name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] });
    F.setGoalFields(app, 'amara', { goalId: 'lead-flaky', values: { fld_stage: 'Build' } });
    F.setGoalFields(app, 'amara', { goalId: 'ci-docker', values: { fld_stage: 'Discover' } });
    if (mode === 'off') app.W.modulesOff = ['tags'];
    app.rebind();
    const cols = exportColumns(app);
    const goals = app.S1.asOf(app.now).goals;
    const rows = goals.map((g) => Object.fromEntries([['Key', g.key], ['Goal', g.title], ...cols.map((c) => [c.header, c.value(g)])]));
    const headers = ['Key', 'Goal', ...cols.map((c) => c.header)];
    if (mode === 'off') {
      assert.equal(cols.length, 0); // no column in an export
      const r = readFieldColumns(app, 'amara', ['Key', 'Goal', 'Stage'], [{ Key: 'G-11', Stage: 'Operate' }]);
      assert.deepEqual(r.notRead, ['Stage']); assert.ok(r.nothing); // a file's are columns nothing reads; values stay
      assert.equal(F.valueOf(app.W, 'lead-flaky', 'fld_stage'), 'Build');
      return;
    }
    assert.ok(readFieldColumns(app, 'amara', headers, rows).nothing); // Nothing would change
    const file = [{ Key: app.goal('lead-flaky').key, Stage: 'Operate' }, { Key: app.goal('ci-docker').key, Stage: 'operate' }];
    const asked = readFieldColumns(app, 'amara', ['Key', 'Goal', 'Stage'], file);
    const q = asked.issues.filter((i) => i.kind === 'module-value');
    assert.equal(q.length, 1);
    assert.equal(q[0].message, 'Stage says “Operate” on 2 rows. Add “Operate” to Stage, or leave these cells empty?');
    const rhea = readFieldColumns(app, 'rhea', ['Key', 'Goal', 'Stage'], file);
    assert.deepEqual(rhea.issues.find((i) => i.kind === 'module-value').answers, ['empty']); // anyone else: leave them empty
    assert.ok(readFieldColumns(app, 'rhea', ['Key', 'Stage'], file, { [q[0].group]: 'add' }).issues.some((i) => i.answered === 'Only an admin can add a value to a list.'));
    const long = readFieldColumns(app, 'amara', ['Key', 'Stage'], [{ Key: 'G-11', Stage: 'Run' }]);
    assert.equal(long.plan.length, 1);
    const res = readFieldColumns(app, 'amara', ['Key', 'Goal', 'Stage'], file, { [q[0].group]: 'add' });
    assert.ok(res.saves);
    applyFieldColumns(app, 'amara', res, 'imp_1');
    assert.ok(F.mod(app.W).fields[0].options.includes('Operate'));
    assert.equal(F.valueOf(app.W, 'lead-flaky', 'fld_stage'), 'Operate'); assert.equal(F.valueOf(app.W, 'ci-docker', 'fld_stage'), 'Operate');
    assert.ok(app.W.changes.some((x) => x.entity === 'field' && x.goalId === 'lead-flaky' && x.summary === 'Stage: Build → Operate' && x.diffs.some((d) => d.field === 'Via' && d.to === 'Spreadsheet')));
    // free text over 80 characters is a Must fix; a goal the loader may not change is the core's Must fix
    F.addField(app, 'amara', { name: 'Programme', kind: 'text' });
    const m = readFieldColumns(app, 'aiko', ['Key', 'Programme', 'Stage'], [{ Key: 'G-11', Programme: 'x'.repeat(81), Stage: 'Run' }]);
    assert.ok(m.issues.some((i) => i.level === 'must' && i.message === 'Keep Programme to 80 characters.'));
    assert.ok(m.issues.some((i) => i.level === 'must' && /or an admin can change G-11/.test(i.message)));
  });

  test('criterion 13: Undo this import puts the values back and takes out a list value it added', () => {
    const app = appWith();
    if (mode === 'off') { app.W.modulesOff = ['tags']; app.rebind(); assert.equal(readFieldColumns(app, 'amara', ['Key', 'Stage'], [{ Key: 'G-11', Stage: 'Run' }]).plan.length, 0); return; }
    F.addField(app, 'amara', { name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] });
    F.setGoalFields(app, 'amara', { goalId: 'lead-flaky', values: { fld_stage: 'Build' } });
    const file = [{ Key: app.goal('lead-flaky').key, Stage: 'Operate' }, { Key: app.goal('ci-docker').key, Stage: 'Operate' }];
    const q = readFieldColumns(app, 'amara', ['Key', 'Stage'], file).issues[0];
    const done = applyFieldColumns(app, 'amara', readFieldColumns(app, 'amara', ['Key', 'Stage'], file, { [q.group]: 'add' }), 'imp_2');
    assert.equal(done.undo.values.length, 2); // an import that changed field values has those rows to undo
    undoFieldColumns(app, 'amara', done.undo);
    assert.equal(F.valueOf(app.W, 'lead-flaky', 'fld_stage'), 'Build'); assert.equal(F.valueOf(app.W, 'ci-docker', 'fld_stage'), '');
    assert.deepEqual(F.mod(app.W).fields[0].options, ['Discover', 'Build', 'Run']);
  });

  test('criterion 14: find_goals’ fields finds the same goals as the Goals link, and refuses in words', async () => {
    await fresh();
    if (mode === 'off') { assert.equal((await c.tool(tok.amara, 'find_goals', { fields: { Stage: 'Build' } })).text, offTool('find_goals')); return; }
    await c.post('/act/tags.addField', { name: 'Programme', kind: 'text' });
    const link = (await c.get('/goals?scope=all&f.fld_stage=Discover&f.fld_stage=Not%20set')).text;
    const tool = await c.tool(tok.amara, 'find_goals', { fields: { Stage: 'Discover, Not set' }, limit: 200 });
    const n = Number(link.match(/role="status">(\d+)/)[1]);
    assert.equal(tool.data.total, n);
    assert.ok(tool.data.goals.some((g) => g.id === 'ci-docker')); assert.ok(!tool.data.goals.some((g) => g.id === 'lead-flaky'));
    assert.match((await c.tool(tok.amara, 'find_goals', { fields: { Region: 'North' } })).text, /There’s no field called Region/);
    assert.match((await c.tool(tok.amara, 'find_goals', { fields: { Programme: 'x' } })).text, /free text/);
    assert.equal((await c.tool(tok.amara, 'find_goals', { fields: { Stage: 'Operate' } })).text, '“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
  });
});

describe('Fields left out of the build (FARO_WITHOUT=tags)', () => {
  const PORT = 47313, base = `http://localhost:${PORT}`;
  let s, c;
  before(async () => { s = await start(PORT, { FARO_WITHOUT: 'tags' }); c = client(base); });
  after(() => s.kill());
  test('criterion 9: built without it, the core runs with no switch for it, no section and no tools', async () => {
    assert.doesNotMatch((await c.get('/workspace/features')).text, /aria-label="Fields"/);
    assert.equal((await c.get('/workspace/fields')).status, 200); // no such section: Workspace's About
    assert.doesNotMatch((await c.get('/goals/lead-flaky')).text, /data-part="Fields"/);
    const tok = (await c.state()).tokens.amara;
    const r = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
    assert.ok(!(await r.json()).result.tools.some((t) => t.name === 'list_fields'));
  });
});
