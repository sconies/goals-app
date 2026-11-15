// Stage 10's exit criteria, one test per criterion, each run with Fields on and with it off.
// node --test modules/tags/exit.test.mjs   (from rebuild/; starts the app on a port of its own)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { start, strip } from './harness.mjs';
import { fieldProblem, valueProblem } from './rules.mjs';
import { filterGoals, pickedOf, pickedText } from './filter.mjs';
import { constraintOf, saveRows, carry, markRemoved, restore, toRow, tablesOf } from './records.mjs';
import { unknownValue } from './sheet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OFF = 'Fields is switched off in Platform Engineering. An admin can switch it on in Workspace, Features.';
const offTool = (what) => `Fields is switched off in Platform Engineering, so ${what} can’t be used there. An admin can switch it on in Workspace, under Features.`;
let A;
before(async () => { A = await start(47400 + Math.floor(Math.random() * 500)); });
after(() => A.stop());
/** A fresh demo, Stage seeded (and Programme, free text), then Fields switched off for the off run. */
async function fresh(mode, { seed = true, programme = false } = {}) {
  await A.reset();
  let id = null, pid = null;
  if (seed) id = await A.seedStage();
  if (programme) { await A.post('amara', '/workspace/fields/add', { name: 'Programme', kind: 'text', values: '' }); pid = await A.fieldId('Programme'); }
  if (mode === 'off') await A.setModule(false);
  return { id, pid };
}
const modes = ['on', 'off'];
const each = (n, title, fn) => { for (const mode of modes) test(`criterion ${n} (${mode}): ${title}`, () => fn(mode)); };

each(1, 'its requirements hold: TAGS-FIELDS, TAGS-FILTER, TAGS-SHEET, TAGS-OFF', async (mode) => {
  const { id } = await fresh(mode);
  const ws = await A.get('amara', '/workspace/fields');
  const goal = strip((await A.get('rhea', '/goals/lead-flaky')).text);
  const goals = strip((await A.get('amara', `/goals?scope=all&f.${id}=Build`)).text);
  const data = (await A.get('amara', '/data?t=goals')).text;
  const exp = (await A.get('amara', '/data/export')).text;
  if (mode === 'on') {
    assert.equal(ws.status, 200); assert.match(strip(ws.text), /A list: Discover, Build, Run/);           // TAGS-FIELDS
    assert.match(goal, /Stage · Build/); assert.match(goal, /Stage: Discover → Build|Stage: Not set → Build/);
    assert.match(goals, /Stage is Build/); assert.match(goals, /1 goal matches/);                         // TAGS-FILTER
    assert.match(data, /<th scope="col">Stage<\/th>/);
    assert.match(exp.split('\n')[0], /,Stage\r?$/);                                                          // TAGS-SHEET
  } else {
    assert.equal(ws.status, 404); assert.match(strip(ws.text), new RegExp(OFF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); // TAGS-OFF
    assert.doesNotMatch(goal, /Stage ·/);
    assert.doesNotMatch(goals, /Stage is Build/);
    assert.doesNotMatch(data, />Stage</); assert.doesNotMatch(exp.split('\n')[0], /Stage/);
    await A.setModule(true);
    assert.match(strip((await A.get('rhea', '/goals/lead-flaky')).text), /Stage · Build/, 'every value stays and comes back');
  }
});

each(2, 'its journeys and checks can be done: U174, U177, U178 (on) and N34 (off)', async (mode) => {
  const ids = mode === 'on' ? ['U174', 'U177', 'U178'] : ['N34'];
  const r = spawnSync(process.execPath, [path.join(here, 'journeys.cjs'), '--out', path.join(os.tmpdir(), `tags-journeys-${mode}-${process.pid}.json`), '--port', String(47900 + Math.floor(Math.random() * 90)), ...ids], { encoding: 'utf8', timeout: 400000 });
  assert.equal(r.status, 0, `the journeys failed:\n${r.stdout}\n${r.stderr}`);
});

each(3, 'fieldProblem and valueProblem give the worked examples, and every row of tags.csv matches', async () => {
  const stage = { id: 's', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] };
  assert.deepEqual(valueProblem(stage, ' build '), { kept: 'Build' });
  assert.equal(valueProblem(stage, 'Operate').problem, '“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `F${i}`, kind: 'text', options: [] }));
  assert.equal(fieldProblem({ name: 'Region', kind: 'text', options: [] }, six), 'A workspace has at most 6 fields. Retire one first.');
  const r = spawnSync(process.execPath, [path.join(here, 'score.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /25 of 25 rows match/);
});

each(4, 'the database refuses a name over 40, another kind, a list of 0 or 21 values, free text with values, a value over 80', async () => {
  const ok = { id: 'f', name: 'Stage', kind: 'list', options: ['A'] };
  assert.equal(constraintOf('fields', ok), null);
  assert.equal(constraintOf('fields', { ...ok, name: 'x'.repeat(41) }), 'goal_fields_name_check');
  assert.equal(constraintOf('fields', { ...ok, kind: 'number' }), 'goal_fields_kind_check');
  assert.equal(constraintOf('fields', { ...ok, options: [] }), 'goal_fields_options_check');
  assert.equal(constraintOf('fields', { ...ok, options: Array.from({ length: 21 }, (_, i) => `v${i}`) }), 'goal_fields_options_check');
  assert.equal(constraintOf('fields', { ...ok, kind: 'text', options: ['A'] }), 'goal_fields_text_no_options');
  assert.equal(constraintOf('fieldValues', { id: 'g:f', goalId: 'g', fieldId: 'f', value: 'x'.repeat(81) }), 'goal_field_values_value_check');
  assert.equal(constraintOf('fieldValues', { id: 'g-f', goalId: 'g', fieldId: 'f', value: '' }), 'goal_field_values_one');
  const W = { goals: [] };
  assert.throws(() => saveRows(W, { fields: [ok, { ...ok, id: 'f2', kind: 'text' }] }), /goal_fields_text_no_options/);
  assert.equal(tablesOf(W).fields.length, 0, 'a refused row saves nothing');
});

each(5, 'U174 by hand: No fields yet, Add a field, “A list: Discover, Build, Run”, Stage · Build, History', async (mode) => {
  await fresh(mode, { seed: false });
  const page = await A.get('amara', '/workspace/fields');
  if (mode === 'off') {
    assert.equal(page.status, 404);
    const add = await A.post('amara', '/workspace/fields/add', { name: 'Stage', kind: 'list', values: 'Discover\nBuild\nRun' });
    assert.equal(add.status, 403);
    await A.setModule(true);
    assert.match(strip((await A.get('amara', '/workspace/fields')).text), /No fields yet/, 'nothing was added while off');
    return;
  }
  assert.match(strip(page.text), /No fields yet/); assert.match(page.text, />Add a field</);
  await A.post('amara', '/workspace/fields/add', { name: 'Stage', kind: 'list', values: 'Discover\nBuild\nRun' });
  assert.match(strip((await A.get('amara', '/workspace/fields')).text), /A list: Discover, Build, Run/);
  const id = await A.fieldId('Stage');
  assert.match(strip((await A.get('amara', '/goals/lead-flaky')).text), /Stage · Not set/);
  await A.post('amara', '/goals/lead-flaky/fields', { field: id, value: 'Discover' });
  await A.post('amara', '/goals/lead-flaky/fields', { field: id, value: 'Build' });
  const g = strip((await A.get('amara', '/goals/lead-flaky')).text);
  assert.match(g, /Stage · Build/); assert.match(g, /Stage: Discover → Build/);
});

each(6, 'only an admin defines fields, only the owner or an admin sets a value; the rule’s refusals, in the app and the tools', async (mode) => {
  const { id } = await fresh(mode);
  if (mode === 'off') {
    for (const [name, args] of [['save_field', { name: 'Region', kind: 'text' }], ['set_goal_fields', { goal_id: 'G-11', fields: { Stage: 'Run' } }], ['list_fields', {}]]) {
      const r = await A.tool('amara', name, args); assert.ok(r.error); assert.equal(r.text, offTool(name));
    }
    assert.equal((await A.post('rhea', `/goals/lead-flaky/fields`, { field: id, value: 'Run' }, false)).status, 403);
    return;
  }
  // the app
  assert.match(strip((await A.post('tunde', '/workspace/fields/add', { name: 'Region', kind: 'text' })).text), /Only an admin can add or change a workspace’s fields\./);
  assert.match(strip((await A.post('amara', '/workspace/fields/add', { name: 'stage', kind: 'list', values: 'A' })).text), /There’s already a field called “Stage”\./);
  const r = await A.post('tunde', '/goals/lead-flaky/fields', { field: id, value: 'Run' });
  assert.match(decodeURIComponent(r.url), /Only the goal’s owner or an admin can change its fields\./);
  const own = await A.post('rhea', '/goals/lead-flaky/fields', { field: id, value: 'Operate' });
  assert.match(decodeURIComponent(own.url), /“Operate” isn’t one of Stage’s values: Discover, Build or Run\./);
  for (let i = 0; i < 5; i++) await A.post('amara', '/workspace/fields/add', { name: `F${i}`, kind: 'text' });
  assert.match(strip((await A.post('amara', '/workspace/fields/add', { name: 'Region', kind: 'text' })).text), /A workspace has at most 6 fields\. Retire one first\./);
  // the tools
  assert.match((await A.tool('tunde', 'save_field', { name: 'Region', kind: 'text' })).text, /^Only an admin can add or change a workspace’s fields\. This token acts as Tunde/);
  assert.match((await A.tool('amara', 'save_field', { name: 'Region', kind: 'text' })).text, /A workspace has at most 6 fields\. Retire one first\./);
  assert.match((await A.tool('amara', 'save_field', { field: 'F0', name: 'stage' })).text, /There’s already a field called “Stage”\./);
  assert.match((await A.tool('tunde', 'set_goal_fields', { goal_id: 'G-11', fields: { Stage: 'Run' } })).text, /^Only the goal’s owner or an admin can change its fields\./);
  assert.match((await A.tool('rhea', 'set_goal_fields', { goal_id: 'G-11', fields: { Stage: 'Operate' } })).text, /“Operate” isn’t one of Stage’s values: Discover, Build or Run\./);
  const dry = await A.tool('rhea', 'set_goal_fields', { goal_id: 'G-11', fields: { Stage: 'run' }, dry_run: true });
  assert.ok(!dry.error); assert.match(dry.text, /Would change G-11: Stage: Build → Run\. Nothing was saved\./);
  assert.match(strip((await A.get('rhea', '/goals/lead-flaky')).text), /Stage · Build/);
  assert.match((await A.tool('rhea', 'set_goal_fields', { goal_id: 'G-11', fields: { Stage: 'run' } })).text, /Saved on G-11: Stage: Build → Run/);
  assert.match(strip((await A.get('rhea', '/goals/lead-flaky')).text), /Stage · Run/);
});

each(7, 'a retired field leaves goals’ pages and list_fields’ live fields, keeps every value, and comes back', async (mode) => {
  const { id } = await fresh(mode);
  if (mode === 'off') {
    assert.equal((await A.post('amara', `/workspace/fields/${id}/retire`, {}, false)).status, 403);
    await A.setModule(true);
    assert.match(strip((await A.get('rhea', '/goals/lead-flaky')).text), /Stage · Build/);
    return;
  }
  await A.post('amara', `/workspace/fields/${id}/retire`, {});
  assert.doesNotMatch(strip((await A.get('rhea', '/goals/lead-flaky')).text), /Stage ·/);
  const l = await A.tool('amara', 'list_fields', {});
  assert.equal(l.data.fields.length, 0); assert.equal(l.data.retired[0].name, 'Stage');
  assert.match((await A.tool('rhea', 'set_goal_fields', { goal_id: 'G-11', fields: { Stage: 'Run' } })).text, /Stage is retired\. An admin can bring it back in Workspace, Fields\./);
  await A.post('amara', `/workspace/fields/${id}/bring-back`, {});
  assert.match(strip((await A.get('rhea', '/goals/lead-flaky')).text), /Stage · Build/);
  assert.match(strip((await A.get('rhea', '/goals/ci-docker')).text), /Stage · Discover/);
});

each(8, 'starting the next year copies each goal’s values; a copy that leaves, or a start undone, clears them (no removed_at)', async () => {
  const W = { goals: [{ id: 'g1' }, { id: 'g2' }], modules: { tags: { fields: [{ id: 'st', name: 'Stage', kind: 'list', options: ['Build'], position: 0, retiredAt: '2026-01-01' }], fieldValues: [{ id: 'g1:st', goalId: 'g1', fieldId: 'st', value: 'Build', setBy: 'rhea', setAt: 't' }] } } };
  const c = carry(W, [{ from: 'g1', to: 'n1' }, { from: 'g2', to: 'n2' }], 't2', 'amara');
  assert.deepEqual(c.fieldValues.map((v) => [v.id, v.value]), [['n1:st', 'Build']], 'a retired field’s value carries too');
  saveRows(W, c);
  const undo = markRemoved(W, ['n1'], 't3', 'amara');
  const row = toRow('fieldValues', W.modules.tags.fieldValues.find((v) => v.id === 'n1:st'));
  assert.equal(row.value, ''); assert.equal('removedAt' in row, false, 'written cleared, with no removed_at');
  assert.equal(filterGoals([{ id: 'n1' }], W.modules.tags.fieldValues, [{ field: W.modules.tags.fields[0], picked: ['Not set'] }]).length, 1);
  restore(W, undo);
  assert.equal(toRow('fieldValues', W.modules.tags.fieldValues.find((v) => v.id === 'n1:st')).value, 'Build', 'Undo puts it back');
});

each(9, 'switched off: no block, no Workspace → Fields, Page not found with the sentence, no filter or column, tools refuse; back on, every value', async (mode) => {
  const { id } = await fresh(mode);
  const goal = (await A.get('amara', '/goals/lead-flaky')).text;
  const ws = strip((await A.get('amara', '/workspace')).text);
  const page = await A.get('amara', '/workspace/fields');
  const filters = (await A.get('amara', '/goals?scope=all')).text;
  const link = strip((await A.get('amara', `/goals?scope=all&f.${id}=Build`)).text);
  const data = (await A.get('amara', '/data?t=goals')).text;
  const find = await A.tool('amara', 'find_goals', { fields: { Stage: 'Build' } });
  if (mode === 'on') {
    assert.match(goal, /data-part="Fields"/); assert.match(ws, /Fields/); assert.equal(page.status, 200);
    assert.match(filters, /aria-label="Stage"/); assert.match(link, /1 goal matches/); assert.match(data, />Stage</);
    assert.ok(!find.error); assert.deepEqual(find.data.ids, ['lead-flaky']);
    return;
  }
  assert.doesNotMatch(goal, /data-part="Fields"/);
  assert.doesNotMatch(ws, /Sections Features Fields/); assert.match(ws, /Sections Features/);
  assert.equal(page.status, 404); assert.match(strip(page.text), /Page not found/); assert.ok(strip(page.text).includes(OFF));
  assert.doesNotMatch(filters, /aria-label="Stage"/); assert.doesNotMatch(link, /Stage is Build/); assert.doesNotMatch(link, /1 goal matches/);
  assert.doesNotMatch(data, />Stage</);
  assert.ok(find.error); assert.equal(find.text, offTool('find_goals’ fields'));
  for (const t of ['list_fields', 'set_goal_fields', 'save_field']) assert.equal((await A.tool('amara', t, {})).text, offTool(t));
  await A.setModule(true);
  assert.match(strip((await A.get('amara', '/goals/lead-flaky')).text), /Stage · Build/);
  assert.match(strip((await A.get('amara', '/goals/ci-docker')).text), /Stage · Discover/);
});

each(10, 'filterGoals gives the worked examples: every field filtered, Not set, a value with a comma read as one', async () => {
  const stage = { id: 'st', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] };
  const goals = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id }));
  const vals = [['g1', 'Build'], ['g2', 'Discover'], ['g3', 'Build']].map(([goalId, value]) => ({ goalId, fieldId: 'st', value }));
  const ids = (f) => filterGoals(goals, vals, f).map((g) => g.id).join(', ');
  assert.equal(ids([{ field: stage, picked: ['Build'] }]), 'g1, g3');
  assert.equal(ids([{ field: stage, picked: ['Discover', 'Not set'] }]), 'g2, g4');
  assert.equal(pickedText(stage, pickedOf(stage, 'run,Operate,not set')), 'Run,Not set');
  const team = { id: 'tm', name: 'Team', kind: 'list', options: ['A, B', 'C'] };
  assert.deepEqual(pickedOf(team, 'C,a, b'), ['A, B', 'C'], 'a comma inside a value is read as one');
  const both = filterGoals(goals, [...vals, { goalId: 'g1', fieldId: 'tm', value: 'C' }], [{ field: stage, picked: ['Build'] }, { field: team, picked: ['C'] }]);
  assert.deepEqual(both.map((g) => g.id), ['g1'], 'a goal matches every field filtered');
});

each(11, 'U177 by hand: the Stage row, Build, “Stage is Build” with Remove, the address, a saved view, Data’s column', async (mode) => {
  const { id } = await fresh(mode);
  const g = await A.get('amara', '/goals?scope=all');
  if (mode === 'off') {
    assert.doesNotMatch(g.text, /aria-label="Stage"/);
    const narrowed = strip((await A.get('amara', `/goals?scope=all&f.${id}=Build`)).text);
    assert.match(narrowed, /Base image build time/, 'a link’s f. narrows nothing');
    assert.doesNotMatch((await A.get('amara', '/data?t=goals')).text, />Stage</);
    return;
  }
  assert.match(g.text, /<fieldset role="group" aria-label="Stage" data-join="f\.[^"]+"><legend>Stage<\/legend>/);
  assert.match(strip(g.text), /Stage Discover Build Run Not set/);
  const href = `/goals?scope=all&f.${id}=Build`;
  const f = await A.get('amara', href);
  const t = strip(f.text);
  assert.match(f.text, /aria-label="Remove the filter Stage is Build"/);
  assert.match(t, /Flaky test rate in the main pipelines/); assert.doesNotMatch(t, /Base image build time/);
  await A.post('amara', '/views', { name: 'Building', href });
  const plain = strip((await A.get('amara', '/goals?scope=all')).text);
  assert.match(plain, /Base image build time/);
  const view = (await A.get('amara', '/goals?scope=all')).text.match(/<a href="([^"]+)">Building<\/a>/);
  assert.ok(view, 'the view is listed');
  const back = strip((await A.get('amara', view[1].replace(/&amp;/g, '&'))).text);
  assert.match(back, /Flaky test rate in the main pipelines/); assert.doesNotMatch(back, /Base image build time/); assert.match(back, /Stage is Build/);
  assert.match((await A.get('amara', '/data?t=goals')).text, /<th scope="col">Stage<\/th>/);
});

each(12, 'U178 by hand: a straight round trip changes nothing; “Operate” asked once; added, both in Operate, in History via the spreadsheet', async (mode) => {
  const { pid } = await fresh(mode, { programme: true });
  const exported = (await A.get('amara', '/data/export')).text;
  const file = 'Key,Stage\r\nG-11,Operate\r\nG-23,operate\r\n';
  if (mode === 'off') {
    const r = strip((await A.load('amara', 'stages.csv', file)).text);
    assert.match(r, /A column nothing reads: Stage\./); assert.match(r, /Nothing would change/);
    const own = strip((await A.load('amara', 'mine.csv', 'Key,Owner,Stage\r\nG-11,Rhea Kapoor,Build\r\n')).text);
    assert.match(own, /A column nothing reads: Stage\./);
    await A.setModule(true);
    assert.match(strip((await A.get('amara', '/goals/lead-flaky')).text), /Stage · Build/);
    return;
  }
  const rt = strip((await A.load('amara', 'export.csv', exported)).text);
  assert.match(rt, /Goals, 126 rows\. Columns read: Key, ID, Goal, Level, Team, Owner, Stage, Programme\./, 'the round trip read every row'); assert.match(rt, /Nothing would change/); assert.doesNotMatch(rt, /nothing reads/);
  const q = 'Stage says “Operate” on 2 rows. Add “Operate” to Stage, or leave these cells empty?';
  const asked = await A.load('amara', 'stages.csv', file);
  assert.equal(strip(asked.text).split(q).length - 1, 1, 'asked once');
  assert.equal((asked.text.match(/value="add"/g) || []).length, 1);
  assert.match(strip(asked.text), /Save 2 changes/);
  // anyone else may only leave the cells empty (Rhea owns both goals)
  const rhea = strip((await A.load('rhea', 'stages.csv', file)).text);
  assert.match(rhea, /Stage says “Operate” on 2 rows, which isn’t one of its values, and only an admin can add one\. Leave these cells empty, or fix the file\?/);
  assert.doesNotMatch((await A.load('rhea', 'stages.csv', file)).text, /value="add"/);
  // free text over 80: Must fix; a goal its loader may not change: Must fix
  assert.match(strip((await A.load('amara', 'p.csv', `Key,Programme\r\nG-11,${'x'.repeat(81)}\r\n`)).text), /Must fix · Programme on row 2 has more than 80 characters\./);
  assert.match(strip((await A.load('tunde', 's.csv', 'Key,Stage\r\nG-11,Run\r\n')).text), /Must fix · Only the goal’s owner or an admin can change its fields/);
  const group = 'module-value:Goals:stage:operate';
  const saved = await A.load('amara', 'stages.csv', file, { [group]: 'add' }, true);
  assert.match(saved.url, /\/data\/import\/done\/imp_/);
  for (const g of ['lead-flaky', 'ci-docker']) assert.match(strip((await A.get('amara', `/goals/${g}`)).text), /Stage · Operate/);
  assert.match(strip((await A.get('amara', '/workspace/fields')).text), /A list: Discover, Build, Run, Operate/);
  assert.match(strip((await A.get('amara', '/goals/lead-flaky')).text), /Amara Nwosu via Spreadsheet · Stage: Build → Operate/);
  // an empty cell clears a value
  await A.load('amara', 'clear.csv', 'Key,Stage\r\nG-11,\r\n', {}, true);
  assert.match(strip((await A.get('amara', '/goals/lead-flaky')).text), /Stage · Not set/);
  assert.ok(pid);
  assert.deepEqual(unknownValue({ name: 'Stage' }, 'Operate', 4, false).choices.map((c) => c[0]), ['empty']);
});

each(13, 'find_goals’ fields finds the Goals link’s goals, and refuses an unknown field, free text and a value the list doesn’t hold', async (mode) => {
  const { id } = await fresh(mode, { programme: true });
  const f = await A.tool('amara', 'find_goals', { fields: { Stage: 'Build, Not set' } });
  if (mode === 'off') { assert.ok(f.error); assert.equal(f.text, offTool('find_goals’ fields')); return; }
  const link = (await A.get('amara', `/goals?scope=all&f.${id}=Build,Not%20set`)).text;
  const linkIds = [...link.matchAll(/href="\/goals\/([a-z0-9-]+)"/g)].map((m) => m[1]).filter((x, i, a) => x !== 'new' && a.indexOf(x) === i);
  assert.equal(f.data.total, linkIds.length); assert.ok(f.data.ids.includes('lead-flaky')); assert.ok(!f.data.ids.includes('ci-docker'));
  assert.deepEqual([...f.data.ids].sort(), [...linkIds].sort());
  assert.match((await A.tool('amara', 'find_goals', { fields: { Phase: 'Build' } })).text, /^There’s no field called “Phase”\. Fields: Stage, Programme\./);
  assert.match((await A.tool('amara', 'find_goals', { fields: { Programme: 'x' } })).text, /^Programme is free text, which can’t filter\./);
  assert.match((await A.tool('amara', 'find_goals', { fields: { Stage: 'Operate' } })).text, /^“Operate” isn’t one of Stage’s values: Discover, Build or Run\./);
});
