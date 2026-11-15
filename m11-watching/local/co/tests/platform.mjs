// The module platform's exit criterion (spec/rebuild/module-platform.md, "What proves it"), against the running app:
// the example module on, switched off, switched back on, and left out of the build; and the AI tools' server.
// Exits 1 on the first failed check.
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const here = path.dirname(new URL(import.meta.url).pathname);
const WS = 'Platform Engineering';
async function start(port, env = {}) {
  const s = spawn(process.execPath, [path.join(here, '../app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  await new Promise((r) => s.stdout.once('data', r));
  return s;
}
const get = async (base, p, as = 'amara') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}` }, redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
const post = async (base, p, body, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded', referer: base + '/' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
const rpc = async (base, body, token) => { const r = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) }); return { status: r.status, headers: r.headers, json: r.status === 202 ? null : await r.json() }; };

let n = 0;
const ok = (cond, words) => { assert.ok(cond, words); n++; };

const PORT = 48933, base = `http://localhost:${PORT}`;
const s = await start(PORT);
try {
  const st = async () => (await fetch(`${base}/api/state`)).json();
  const tokens = (await st()).tokens;
  // 1. on: route, menu row, place, help, action, tool
  let home = await get(base, '/');
  ok(/data-item="module:example"/.test(home.text), 'the menu has the Example row');
  ok((await get(base, '/example')).status === 200, 'its page opens');
  ok(/data-module="example"/.test((await get(base, '/goals/lead-mq')).text), 'its part is in goal.facts');
  ok(/The example module/.test((await get(base, '/help')).text), 'its Help article is listed');
  await post(base, '/act/example.note', { text: 'A first note', goalId: 'lead-mq' });
  ok((await st()).modules.example.notes.length === 1, 'its action saved a note');
  let r = await rpc(base, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'example_notes', arguments: {} } }, tokens.amara);
  ok(!r.json.result.isError && /A first note/.test(r.json.result.content[0].text), 'its tool runs');
  // 3. someone who isn't an admin can't switch it
  const notAdmin = await post(base, '/act/setFeature', { id: 'example', on: 'false' }, 'rhea');
  ok(/Only admins can switch features on or off\./.test(notAdmin.text), 'a member is refused in the rule’s words');
  // 2. switched off by an admin on Features
  const off = await post(base, '/act/setFeature', { id: 'example', on: 'false' });
  ok(off.text.includes(`Example is off in ${WS}. Nothing it saved is lost.`), 'Features says it is off and nothing is lost');
  home = await get(base, '/');
  ok(!/module:example/.test(home.text), 'its menu row is gone');
  const page = await get(base, '/example');
  ok(page.status === 404 && /Page not found/.test(page.text) && page.text.includes(`Example is switched off in ${WS}. An admin can switch it on in Workspace, Features.`), 'its address is Page not found with its sentence');
  ok(!/data-module="example"/.test((await get(base, '/goals/lead-mq')).text), 'its part is gone');
  ok(!/The example module/.test((await get(base, '/help')).text), 'its Help article is gone');
  const art = await get(base, '/help/example');
  ok(art.text.includes(`Example is switched off in ${WS}.`), 'a link to its article says its sentence');
  const act = await post(base, '/act/example.note', { text: 'Refused' });
  ok(act.text.includes(`Example is switched off in ${WS}. An admin can switch it on in Workspace, under Features.`), 'its action is refused with the action’s sentence');
  r = await rpc(base, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, tokens.amara);
  ok(r.json.result.tools.some((t) => t.name === 'example_notes'), 'its tool is still listed');
  r = await rpc(base, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'example_notes', arguments: {} } }, tokens.amara);
  ok(r.json.result.isError && r.json.result.content[0].text === `Example is switched off in ${WS}, so example_notes can’t be used there. An admin can switch it on in Workspace, under Features.`, 'its tool answers with the tool’s sentence');
  ok((await st()).changes.some((c) => c.summary === 'Switched off Example' && c.diffs[0].from === 'On' && c.diffs[0].to === 'Off'), 'the switch is in the log');
  ok((await st()).modules.example.notes.length === 1, 'nothing it saved is deleted');
  await post(base, '/act/setFeature', { id: 'example', on: 'true' });
  ok(/module:example/.test((await get(base, '/')).text) && (await get(base, '/example')).text.includes('1 note kept.'), 'switched back on, everything is as it was');
  // a core module switched off leaves the core working: Reviews off
  await post(base, '/act/setFeature', { id: 'reviews', on: 'false' });
  ok(!/data-item="reviews"/.test((await get(base, '/', 'rhea')).text), 'Reviews off: no Reviews row');
  ok((await get(base, '/reviews/weekly')).text.includes(`Reviews is switched off in ${WS}.`), 'Reviews off: its address says its sentence');
  await post(base, '/act/setFeature', { id: 'reviews', on: 'true' });
  // 5. the server
  r = await rpc(base, { jsonrpc: '2.0', id: 4, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, tokens.rhea);
  ok(r.json.result.protocolVersion === '2025-03-26' && r.json.result.serverInfo.name === 'goals' && r.json.result.serverInfo.title === 'Faro', 'initialize');
  r = await rpc(base, { jsonrpc: '2.0', id: 5, method: 'ping' }, tokens.rhea);
  ok(JSON.stringify(r.json.result) === '{}', 'ping');
  r = await rpc(base, [{ jsonrpc: '2.0', id: 6, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 7, method: 'tools/list' }], tokens.rhea);
  ok(Array.isArray(r.json) && r.json.length === 2 && r.json[1].result.tools.length >= 8, 'a batch answers in order, notifications left out');
  r = await rpc(base, { jsonrpc: '2.0', id: 8, method: 'tools/list' });
  ok(r.status === 401 && r.headers.get('www-authenticate') === 'Bearer' && /Add your personal token/.test(r.json.error.message), 'no token: 401 and its words');
  r = await rpc(base, { jsonrpc: '2.0', id: 9, method: 'tools/list' }, 'gk_' + '0'.repeat(40));
  ok(r.status === 401 && /invalid_token/.test(r.headers.get('www-authenticate')) && /isn’t valid or has been revoked/.test(r.json.error.message), 'a revoked or unknown token: 401 and its words');
  r = await rpc(base, '{not json', tokens.rhea);
  ok(r.status === 400 && r.json.error.code === -32700, 'a body that is not JSON');
  r = await rpc(base, { jsonrpc: '2.0', id: 10, method: 'nope' }, tokens.rhea);
  ok(r.json.error.code === -32601 && r.json.error.message === 'Method not found: nope', 'an unknown method');
  r = await rpc(base, { jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'nope' } }, tokens.rhea);
  ok(r.json.error.code === -32602 && r.json.error.message === 'Unknown tool: nope', 'an unknown tool');
  const before = (await st()).checkIns;
  r = await rpc(base, { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'post_check_in', arguments: { goal_id: 'ns-lead', value: 30, call: 'Off track', cause: 'Delivery slower', why: 'Two monorepos still merge by hand this week.', path_to_green: 'Move the last two in the next sprint', back_on_plan_by_week: 50, dry_run: true } } }, tokens.rhea);
  ok(!r.json.result.isError && /Nothing was saved \(dry run\)/.test(r.json.result.content[0].text) && (await st()).checkIns === before, 'a write with dry_run saves nothing');
  r = await rpc(base, { jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'set_feature', arguments: { feature: 'reviews', on: false } } }, tokens.rhea);
  ok(r.json.result.isError && /This token acts as Rhea Kapoor, who isn’t an admin\./.test(r.json.result.content[0].text), 'a refusal says who the token acts as');
  // AI access off: the door shuts for all but initialize and tools/list
  await post(base, '/act/setFeature', { id: 'ai-access', on: 'false' });
  r = await rpc(base, { jsonrpc: '2.0', id: 14, method: 'tools/call', params: { name: 'get_my_work', arguments: {} } }, tokens.rhea);
  ok(r.json.error && r.json.error.message === `AI access is switched off in ${WS}. An admin can switch it on in Faro, under Workspace, Features.`, 'AI access off shuts the door');
  r = await rpc(base, { jsonrpc: '2.0', id: 15, method: 'tools/list' }, tokens.rhea);
  ok(!!r.json.result, 'tools/list still answers with AI access off');
} finally { s.kill(); }

// 4. built without the module at all
const s2 = await start(PORT + 1, { FARO_WITHOUT: 'example' });
try {
  const b2 = `http://localhost:${PORT + 1}`;
  ok(!/module:example/.test((await get(b2, '/')).text), 'left out: no row');
  const feat = await get(b2, '/workspace/features');
  ok(!/aria-label="Example"/.test(feat.text) && /aria-label="Reviews"/.test(feat.text), 'left out: Features shows no switch for it');
  ok((await get(b2, '/example')).status === 404, 'left out: its address is not there');
  const tokens = (await (await fetch(`${b2}/api/state`)).json()).tokens;
  const r = await rpc(b2, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'find_goals', arguments: { q: 'rolback' } } }, tokens.amara);
  ok(!r.json.result.isError && /showing goals that match “rollback”/.test(r.json.result.content[0].text), 'left out: the server answers the core’s tools');
} finally { s2.kill(); }
console.log(`Platform: ${n} checks pass.`);
