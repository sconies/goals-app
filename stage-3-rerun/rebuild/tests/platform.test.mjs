// The module platform (spec/rebuild/module-platform.md, "What proves it"), against the running app.
// node --test tests/   (starts its own servers on ports 47340–47349)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { PLACES, HOOKS } from '../app/platform.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const servers = [];
async function start(port, env = {}) {
  const child = spawn(process.execPath, [path.join(root, 'app/server.mjs'), '--port', String(port), '--test'], { cwd: root, env: { ...process.env, ...env }, stdio: 'ignore' });
  servers.push(child);
  const until = Date.now() + 30000;
  while (Date.now() < until) { try { if ((await fetch(`http://127.0.0.1:${port}/__test/load`)).ok) return `http://127.0.0.1:${port}`; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  throw new Error(`The app on ${port} didn't start.`);
}
const get = async (base, addr, as = 'rhea') => { const r = await fetch(base + addr, { headers: { cookie: `viewer=${as}` }, redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };
const post = async (base, addr, form, as = 'amara') => { const r = await fetch(base + addr, { method: 'POST', headers: { cookie: `viewer=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location'), cookie: r.headers.get('set-cookie') || '' }; };
const flashOf = (cookie) => { const m = cookie.match(/flash=([^;]*)/); return m && m[1] ? JSON.parse(decodeURIComponent(m[1])).message : ''; };
const rpc = async (base, body, token, extra = {}) => { const r = await fetch(`${base}/api/mcp`, { method: extra.method || 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: extra.method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); const t = await r.text(); return { status: r.status, headers: r.headers, body: t ? JSON.parse(t) : null }; };
const reset = (base) => fetch(`${base}/__test/reset`, { method: 'POST', body: '{}' });
const token = async (base, personId = 'amara', revoked = false) => (await (await fetch(`${base}/__test/token`, { method: 'POST', body: JSON.stringify({ personId, revoked }) })).json()).token;
const OFF = (m) => `${m} is switched off in Platform Engineering. An admin can switch it on in Workspace, Features.`;

let A, B, C;
before(async () => { [A, B, C] = await Promise.all([start(47341, { FARO_PROBE: '1' }), start(47342, { FARO_WITHOUT: 'example,example-two' }), start(47343, { FARO_MODULES_OFF: 'all' })]); });
after(() => { for (const s of servers) s.kill(); });

// Every place, drawn by the screen the kit names, and only while the module is on.
const WHERE = {
  'home.blocks': ['/', 'rhea'], 'home.lead': ['/', 'rhea'], 'goal.facts': ['/goals/ns-lead'], 'goal.sections': ['/goals/ns-lead'], 'goal.buttons': ['/goals/ns-lead'],
  'data.tools': ['/data'], 'goals.tools': ['/goals?scope=all'], 'goals.layouts': ['/goals?scope=all'], 'goals.scopes': ['/goals?scope=all'], 'goals.header': ['/goals?scope=all'],
  'goal.measure': ['/goals/new/measure'], 'people.person': ['/people/rhea'], 'people.team': ['/teams/cicd'], 'help.article': ['/help/home'],
  'checkin.number': ['/check-in/cfr-contract', 'tunde'], 'checkin.table': ['/quick-check-in', 'rhea'], 'settings.you': ['/settings'], 'workspace.about': ['/workspace', 'amara'],
  'cycles.cycle': ['/workspace/cycles', 'amara'], 'cycles.start': ['/workspace/cycles/next', 'amara'], 'activity.entry': ['/activity'],
};
test('every place is drawn by its screen while its module is on, and by none once it is off', async () => {
  await reset(A);
  for (const place of PLACES) {
    if (['features.line', 'features.readBack', 'menu.count'].includes(place)) continue;
    const [addr, as] = WHERE[place] || [];
    assert.ok(addr, `no screen listed for ${place}`);
    const r = await get(A, addr, as || 'rhea');
    assert.match(r.text, new RegExp(`data-probe="${place.replace('.', '\\.')}"`), `${place} on ${addr}`);
  }
  const f = await get(A, '/workspace/features', 'amara');
  assert.match(f.text, /Probe line\./, 'features.line');
  const home = await get(A, '/', 'rhea');
  assert.match(home.text, /<span>Probe<\/span><span class="count">3<\/span>/, 'menu.count after the row’s name');
  const rb = await post(A, '/act/setModule', { id: 'probe', on: '0' });
  assert.match(rb.text, /Switch off Probe in Platform Engineering\?/, 'features.readBack before the switch acts');
  assert.match(rb.text, /data-probe="features\.readBack"/);
  const done = await post(A, '/act/setModule', { id: 'probe', on: '0', confirmed: '1' });
  assert.equal(flashOf(done.cookie), 'Probe is off in Platform Engineering. Nothing it saved is lost.');
  for (const [place, [addr, as]] of Object.entries(WHERE)) assert.doesNotMatch((await get(A, addr, as || 'rhea')).text, /data-probe=/, `${place} gone while off`);
  assert.doesNotMatch((await get(A, '/', 'rhea')).text, /<span>Probe<\/span>/, 'no menu row while off');
  await reset(A);
});
test('the hooks the kit names exist, and beforeCheckIn may refuse a check-in', async () => {
  assert.deepEqual(HOOKS, ['afterGoalSaved', 'beforeCheckIn', 'onSwitch', 'writesWhenOff', 'drill']);
  await reset(A);
  const r = await post(A, '/act/postCheckIn', { goalId: 'cfr-contract', value: '5', call: 'on', why: 'probe refuses' }, 'tunde');
  assert.match(r.text, /The probe refuses this check-in\./);
});

test('on: its route, menu row in its group, Workspace section, Help article, action and tool', async () => {
  await reset(A);
  assert.equal((await get(A, '/probe')).status, 200);
  assert.match((await get(A, '/probe/7')).text, /Probe 7/, 'a route with a parameter');
  assert.equal((await get(A, '/old-probe')).location, '/probe', 'a redirect while on');
  const home = (await get(A, '/', 'rhea')).text;
  const work = home.match(/<ul aria-label="your work">(.*?)<\/ul>/s)[1];
  assert.match(work, /Reviews|Goals.*Probe/s, 'a work row after the core’s');
  assert.match((await get(A, '/workspace/probe', 'amara')).text, /Probe · Workspace/);
  assert.match((await get(A, '/workspace/probe', 'rhea')).text, /Probe is for admins\. The admins here are Amara Nwosu, Grace Achterberg and Hamid Rezaei\./);
  assert.match((await get(A, '/help/probe')).text, /The probe module’s own article\./);
  assert.match((await get(A, '/help/probe')).text, /probe, from the Probe module\./);
});

test('switched off: page not found with its sentence, its action refused, its tool listed and refusing, logged, nothing deleted', async () => {
  await reset(A);
  // an example note saved while on
  const add = await post(A, '/act/example.addNote', { goalId: 'ns-lead', text: 'Kept while off' }, 'rhea');
  assert.equal(flashOf(add.cookie), 'The example note is saved.');
  const off = await post(A, '/act/setModule', { id: 'example', on: '0' });
  assert.equal(flashOf(off.cookie), 'Example is off in Platform Engineering. Nothing it saved is lost.');
  const page = await get(A, '/example');
  assert.equal(page.status, 404);
  assert.match(page.text, /<title>Page not found · Platform Engineering · Faro<\/title>/);
  assert.ok(page.text.includes(OFF('Example')));
  assert.ok((await get(A, '/help/example')).text.includes(OFF('Example')), 'its Help article says its sentence');
  assert.equal((await get(A, '/workspace/example', 'amara')).status, 404, 'its Workspace section is gone');
  assert.doesNotMatch((await get(A, '/goals/ns-lead')).text, /Example notes/, 'its part is gone');
  const act = await post(A, '/act/example.addNote', { goalId: 'ns-lead', text: 'Another note' }, 'rhea');
  assert.equal(flashOf(act.cookie), 'Example is switched off in Platform Engineering. An admin can switch it on in Workspace, under Features.');
  const t = await token(A, 'amara');
  const list = await rpc(A, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, t);
  assert.ok(list.body.result.tools.some((x) => x.name === 'example_notes'), 'still listed while off');
  const call = await rpc(A, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'example_notes', arguments: {} } }, t);
  assert.equal(call.body.result.isError, true);
  assert.equal(call.body.result.content[0].text, 'Example is switched off in Platform Engineering, so example_notes can’t be used there. An admin can switch it on in Workspace, under Features.');
  const snap = await (await fetch(`${A}/__test/load`)).json();
  assert.ok(snap.changes.some((c) => c.summary === 'Switched off Example, and with it Second example' && c.diffs[0].field === 'Example' && c.diffs[0].to === 'Off'));
  assert.equal(snap.modules.example.notes.filter((n) => !n.removedAt).length, 1, 'nothing it saved is deleted');
  // a removal runs while off (whileOff), like revoking a token
  const r = await post(A, '/act/example.removeNote', { id: snap.modules.example.notes[0].id }, 'rhea');
  assert.equal(flashOf(r.cookie), 'The example note is removed.');
  const on = await post(A, '/act/setModule', { id: 'example', on: '1' });
  assert.equal(flashOf(on.cookie), 'Example is on in Platform Engineering.');
  assert.match((await get(A, '/workspace/removed', 'amara')).text, /Kept while off/, 'the removed note is in Recently removed');
});

test('who may switch, an unknown id, needs, and Undo', async () => {
  await reset(A);
  assert.equal(flashOf((await post(A, '/act/setModule', { id: 'example', on: '0' }, 'rhea')).cookie), 'Only admins can switch features on or off.');
  assert.equal(flashOf((await post(A, '/act/setModule', { id: 'nothing-here', on: '0' })).cookie), 'There’s no feature called nothing-here.');
  const off = await post(A, '/act/setModule', { id: 'example', on: '0' });
  const features = (await get(A, '/workspace/features', 'amara')).text;
  assert.match(features, /Off until Example is on\./, 'the module that needs it says so');
  assert.match(features, /data-module="example-two">[\s\S]*?class="switch-word">Off</);
  const undoId = JSON.parse(decodeURIComponent(off.cookie.match(/flash=([^;]*)/)[1])).undo;
  const u = await post(A, '/undo', { id: undoId });
  assert.equal(flashOf(u.cookie), 'Example is back on.');
  assert.match((await get(A, '/goals/ns-lead')).text, /Example notes/);
  assert.match((await get(A, '/goals/ns-lead')).text, /Second example is on for this goal\./);
});

test('started with modules off: off from the first page', async () => {
  const p = await get(C, '/example');
  assert.equal(p.status, 404);
  assert.ok(p.text.includes(OFF('Example')));
  assert.match((await get(C, '/workspace/features', 'amara')).text, /data-module="example">[\s\S]*?class="switch-word">Off</);
});

test('left out of the build: no switch, no route, no tool, and the core’s tools answer', async () => {
  const f = (await get(B, '/workspace/features', 'amara')).text;
  assert.doesNotMatch(f, /aria-label="Example"/);
  const p = await get(B, '/example');
  assert.equal(p.status, 404);
  assert.doesNotMatch(p.text, /switched off/);
  const t = await token(B, 'rhea');
  const list = await rpc(B, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, t);
  assert.ok(!list.body.result.tools.some((x) => x.name.startsWith('example')));
  const g = await rpc(B, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_goal', arguments: { goal: 'G-48' } } }, t);
  assert.equal(g.body.result.isError, false);
  assert.match(g.body.result.content[0].text, /^G-48 /);
});

test('the AI tools’ server: methods, batches, refusals, the door and dry runs', async () => {
  await reset(A);
  const t = await token(A, 'tunde');
  const init = await rpc(A, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, t);
  assert.equal(init.body.result.protocolVersion, '2025-03-26');
  assert.deepEqual(init.body.result.serverInfo, { name: 'goals', title: 'Faro', version: '1.0.0' });
  assert.deepEqual(init.body.result.capabilities, { tools: { listChanged: false }, prompts: { listChanged: false } });
  assert.equal((await rpc(A, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, t)).body.result.protocolVersion, '2025-06-18');
  assert.deepEqual((await rpc(A, { jsonrpc: '2.0', id: 2, method: 'ping' }, t)).body.result, {});
  const tl = (await rpc(A, { jsonrpc: '2.0', id: 3, method: 'tools/list' }, t)).body.result.tools;
  for (const x of tl) assert.deepEqual(Object.keys(x).sort(), ['annotations', 'description', 'inputSchema', 'name', 'title']);
  const batch = await rpc(A, [{ jsonrpc: '2.0', id: 'a', method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 'b', method: 'tools/call', params: { name: 'nope', arguments: {} } }, { jsonrpc: '2.0', id: 'c', method: 'nope' }, { hello: 1 }], t);
  assert.equal(batch.body.length, 4);
  assert.deepEqual(batch.body[1].error, { code: -32602, message: 'Unknown tool: nope' });
  assert.deepEqual(batch.body[2].error, { code: -32601, message: 'Method not found: nope' });
  assert.deepEqual(batch.body[3].error, { code: -32600, message: 'Invalid request' });
  const note = await rpc(A, { jsonrpc: '2.0', method: 'notifications/initialized' }, t);
  assert.equal(note.status, 202);
  assert.equal((await rpc(A, { jsonrpc: '2.0', method: 'tools/list' }, t)).body.id, null, 'tools/list is answered even with no id');
  const parse = await rpc(A, '{not json', t);
  assert.equal(parse.status, 400); assert.deepEqual(parse.body.error, { code: -32700, message: 'Parse error' });
  const get405 = await rpc(A, null, t, { method: 'GET' });
  assert.equal(get405.status, 405); assert.equal(get405.headers.get('allow'), 'GET, POST, OPTIONS');
  assert.equal(get405.body.error.message, 'This MCP server answers POST requests only (no event stream).');
  const none = await rpc(A, { jsonrpc: '2.0', id: 1, method: 'ping' });
  assert.equal(none.status, 401); assert.equal(none.headers.get('www-authenticate'), 'Bearer');
  assert.equal(none.body.error.message, 'Add your personal token: Authorization: Bearer gk_… An admin makes one under Workspace → Access → MCP access.');
  const revoked = await token(A, 'tunde', true);
  const bad = await rpc(A, { jsonrpc: '2.0', id: 1, method: 'ping' }, revoked);
  assert.equal(bad.status, 401); assert.equal(bad.headers.get('www-authenticate'), 'Bearer error="invalid_token"');
  assert.equal(bad.body.error.message, 'That token isn’t valid or has been revoked. Ask an admin for a new one.');
  // a rule saying no, then who the token acts as
  const sf = await rpc(A, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'set_feature', arguments: { feature: 'example', on: false } } }, t);
  assert.equal(sf.body.result.isError, true);
  assert.equal(sf.body.result.content[0].text, 'Only admins can switch features on or off. This token acts as Tunde Bakare, who isn’t an admin.');
  // dry runs save nothing
  const before = (await (await fetch(`${A}/__test/load`)).json()).changes.length;
  const dry = await rpc(A, { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'example_add_note', arguments: { goal: 'G-10', text: 'Only a dry run', dry_run: true } } }, t);
  assert.equal(dry.body.result.isError, false);
  const dry2 = await rpc(A, { jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'create_goal', arguments: { title: 'A dry goal', unit: '%', start: '10', target: '20', dry_run: true } } }, t);
  assert.equal(dry2.body.result.isError, false, dry2.body.result.content[0].text);
  const dry3 = await rpc(A, { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'start_next_cycle', arguments: {} } }, await token(A, 'amara'));
  assert.equal(dry3.body.result.structuredContent.canStart, false);
  const snap = await (await fetch(`${A}/__test/load`)).json();
  assert.equal(snap.changes.length, before, 'nothing saved');
  assert.ok(!snap.goals.some((g) => g.title === 'A dry goal'));
  // a batch runs in order: a later call sees what an earlier one saved
  const seq = await rpc(A, [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'example_add_note', arguments: { goal: 'G-10', text: 'First, saved' } } }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'example_notes', arguments: { goal: 'G-10' } } }], t);
  assert.match(seq.body[1].result.content[0].text, /First, saved/);
  const ch = (await (await fetch(`${A}/__test/load`)).json()).changes.find((c) => c.summary === 'Added an example note: First, saved');
  assert.equal(ch.actorId, 'tunde', 'logged as the token’s person');
  assert.equal(ch.via, 'MCP', 'marked via MCP');
  const check = await fetch(`${A}/api/mcp?check`);
  assert.equal(check.status, 200);
});
