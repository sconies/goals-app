// Stage 4's exit criteria (spec/rebuild/stage-4-module-ai-access.md), one test per criterion, each with the module on and off.
// Usage: node --test modules/ai-access/exit.test.mjs   (criterion 2 drives the journeys in a browser; JOURNEYS=skip leaves it out)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import * as R from './rules.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const WS = 'Platform Engineering';
const SHUT = `AI access is switched off in ${WS}. An admin can switch it on in Faro, under Workspace, Features.`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function start(port, env = {}) {
  const s = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  await new Promise((r) => s.stdout.once('data', r));
  const base = `http://localhost:${port}`;
  const get = async (p, as = 'amara') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}` }, redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
  const post = async (p, body, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded', referer: base + '/' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };
  const rpc = async (body, token) => { const r = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: r.status === 202 ? null : await r.json() }; };
  const call = (name, args, token, id = 1) => rpc({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, token);
  const state = async () => (await fetch(`${base}/api/state`)).json();
  const reset = () => fetch(`${base}/api/reset`, { method: 'POST' });
  // make a token in the app as Amara, read its secret from the dialog shown once
  const make = async (personId, name, back = '/workspace/ai') => { await post('/act/ai.createToken', { personId, name, back }); const page = await get(back); return /aria-label="Token" value="(gk_[A-Za-z0-9]{40})"/.exec(page.text)?.[1]; };
  const setOff = async (off) => post('/act/setFeature', { id: 'ai-access', on: String(!off), confirm: '1' });
  return { s, base, get, post, rpc, call, state, reset, make, setOff };
}

let A;
before(async () => { A = await start(47411); });
after(() => A.s.kill());
const fresh = async (off) => { await A.reset(); if (off) await A.setOff(true); };

test('criterion 1: MCP-TOKENS, TOKENS-SERVER-ONLY and AI-ACCESS-OPTIONAL hold', async (t) => {
  await t.test('on', async () => {
    await fresh(false);
    const secret = await A.make('mateo', 'Claude on Mateo’s laptop');
    assert.match(secret, /^gk_[A-Za-z0-9]{40}$/, 'the token is shown once in the gk_ form');
    assert.ok(!/gk_/.test((await A.get('/workspace/ai')).text), 'it isn’t shown again');
    // TOKENS-SERVER-ONLY: only its hash is kept, and no screen or tool hands the hash back
    const st = await A.state();
    const tokens = (await (await fetch(`${A.base}/api/state`)).json()).tokens;
    const list = await A.call('list_tokens', {}, tokens.amara);
    const mine = list.json.result.structuredContent.tokens.find((x) => x.name === 'Claude on Mateo’s laptop');
    assert.ok(mine && mine.personId === 'mateo' && !('tokenHash' in mine) && !('hash' in mine), 'list_tokens gives metadata, never the hash');
    const page = (await A.get('/workspace/ai')).text;
    assert.ok(!page.includes(sha(secret)) && !page.includes(secret), 'the page shows neither the token nor its hash');
    assert.ok(st.changes.some((c) => c.entity === 'token' && c.actorId === 'amara' && /Made an MCP token for Mateo/.test(c.summary)), 'making it is logged');
    // the token acts as Mateo, with his rights, logged as his via MCP; a dry run saves nothing
    const init = await A.rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, secret);
    assert.match(init.json.result.instructions, /Mateo Fernández/);
    const before = (await A.state()).changes.length;
    const g = (await A.call('find_goals', { q: '' }, secret)).json.result.structuredContent.goals[0];
    const dry = await A.call('add_comment', { goal_id: g.id, text: 'From Claude' }, secret);
    assert.equal(dry.json.result.isError, false);
    const after1 = await A.state();
    assert.ok(after1.changes.slice(before).some((c) => c.actorId === 'mateo' && c.via === 'mcp'), 'the change is logged as Mateo, via MCP');
    const feat = await A.call('set_feature', { feature: 'ai-access', on: false }, secret);
    assert.match(feat.json.result.content[0].text, /This token acts as Mateo Fernández, who isn’t an admin\./, 'the token has Mateo’s rights, no more');
    const ownGoal = (await A.call('get_my_work', {}, tokens.rhea)).json.result.structuredContent.goals[0];
    if (ownGoal) {
      const n0 = (await A.state()).checkIns;
      await A.call('post_check_in', { goal_id: ownGoal, value: 1, call: 'On track', why: 'A dry run only', dry_run: true }, tokens.rhea);
      assert.equal((await A.state()).checkIns, n0, 'a dry run saves nothing');
    }
    // revoked or wrong: refused
    const id = mine.id;
    await A.post('/act/ai.revokeToken', { tokenId: id, back: '/workspace/ai' });
    const refused = await A.rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, secret);
    assert.equal(refused.status, 401);
    assert.equal(refused.json.error.message, 'That token isn’t valid or has been revoked. Ask an admin for a new one.');
    assert.equal((await A.rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, 'gk_' + 'x'.repeat(40))).status, 401);
    // only admins make; the person or an admin revokes
    assert.match((await A.post('/act/ai.createToken', { personId: 'rhea', name: 'Mine' }, 'rhea')).text, /Only admins can make tokens\./);
    const s2 = await A.make('rhea', 'Claude for Rhea');
    const rid = (await A.call('list_tokens', {}, s2)).json.result.structuredContent.tokens[0].id;
    assert.match((await A.post('/act/ai.revokeToken', { tokenId: rid }, 'mateo')).text, /Only an admin or the token’s person can revoke it\./);
    const own = await A.call('revoke_token', { token_id: rid }, s2);
    assert.match(own.json.result.content[0].text, /its access ends now/);
    assert.equal((await A.rpc({ jsonrpc: '2.0', id: 2, method: 'ping' }, s2)).status, 401);
    assert.match((await A.call('create_token', { person: 'Nobody Here', name: 'x' }, tokens.amara)).json.result.content[0].text, /There’s no one called Nobody Here in this workspace\. Use list_people\./);
    assert.match((await A.call('create_token', { person: 'mateo', name: '' }, tokens.amara)).json.result.content[0].text, /Say what the token is for/);
    assert.match((await A.call('create_token', { person: 'Mateo', name: 'x'.repeat(121) }, tokens.amara)).json.result.content[0].text, /Keep what it’s for to 120 characters\./);
    const viaTool = await A.call('create_token', { person: 'Mateo Fernández', name: 'Made by a tool' }, tokens.amara);
    assert.match(viaTool.json.result.structuredContent.token, /^gk_[A-Za-z0-9]{40}$/);
  });
  await t.test('off', async () => {
    await fresh(false);
    const secret = await A.make('mateo', 'Kept while off');
    await A.setOff(true);
    // AI-ACCESS-OPTIONAL: kept, not revoked; refused at the door; works again once back on
    const st = await A.state();
    assert.equal((await A.rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_my_work', arguments: {} } }, secret)).json.error.message, SHUT);
    await A.setOff(false);
    const back = await A.call('get_my_work', {}, secret);
    assert.equal(back.json.result.isError, false, 'the kept token works again once back on');
    assert.ok(st.changes.some((c) => c.entity === 'workspace' && c.summary === 'Switched off AI access'), 'the switch is logged');
  });
  await t.test('built without the module: the server stays open and only the token tools are missing', async () => {
    const B = await start(47412, { FARO_WITHOUT: 'ai-access' });
    try {
      const tokens = (await B.state()).tokens;
      const r = await B.call('get_my_work', {}, tokens.amara);
      assert.equal(r.json.result.isError, false);
      assert.equal((await B.call('list_tokens', {}, tokens.amara)).json.error.message, 'Unknown tool: list_tokens');
      assert.ok(!/aria-label="AI access"/.test((await B.get('/workspace/features')).text), 'Features has no switch for it');
      assert.equal((await B.get('/workspace/ai')).status, 200, 'no section (Workspace’s About)');
      assert.ok(!/AI access<\/a>/.test((await B.get('/workspace')).text));
    } finally { B.s.kill(); }
  });
});

test('criterion 2: its journeys and checks can be done (U22, U62, U175)', { skip: process.env.JOURNEYS === 'skip' }, async (t) => {
  // the journeys run with the module on (each says so); U175 itself switches it off and back on
  const r = spawnSync(process.execPath, [path.join(here, 'journeys.mjs')], { encoding: 'utf8', env: { ...process.env, JOURNEY_PORT: '47413' } });
  t.diagnostic(r.stdout.trim());
  assert.equal(r.status, 0, `a journey failed:\n${r.stdout}${r.stderr}`);
});

test('criterion 3: switched off, the door refuses every request but initialize and tools/list, and lastUsedAt does not move', async (t) => {
  await t.test('on', async () => {
    await fresh(false);
    const secret = await A.make('amara', 'Claude on my laptop');
    const r = await A.rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, secret);
    assert.deepEqual(r.json.result, {});
    const used = (await A.call('list_tokens', {}, secret)).json.result.structuredContent.tokens.find((x) => x.name === 'Claude on my laptop');
    assert.ok(used.lastUsedAt, 'a request let through moves its last use');
  });
  await t.test('off', async () => {
    await fresh(false);
    const secret = await A.make('amara', 'Claude on my laptop');
    await A.setOff(true);
    const batch = await A.rpc([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'ping' },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_my_work', arguments: {} } },
      { jsonrpc: '2.0', id: 5, method: 'prompts/list' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
    ], secret);
    assert.equal(batch.status, 200);
    const byId = Object.fromEntries(batch.json.map((x) => [x.id, x]));
    assert.equal(batch.json.length, 5, 'the notification passes with no answer');
    assert.equal(byId[1].result.protocolVersion, '2025-03-26');
    assert.ok(byId[2].result.tools.some((x) => x.name === 'list_tokens') && byId[2].result.tools.some((x) => x.name === 'create_token'), 'tools/list still lists the tools');
    for (const i of [3, 4, 5]) { assert.equal(byId[i].error.code, -32001); assert.equal(byId[i].error.message, SHUT); }
    await A.setOff(false);
    // read with another token so this read doesn't move it
    const tokens = (await A.state()).tokens;
    const t1 = (await A.call('list_tokens', {}, tokens.amara)).json.result.structuredContent.tokens.find((x) => x.name === 'Claude on my laptop');
    assert.equal(t1.lastUsedAt, null, 'a refused request doesn’t count as a use');
  });
});

test('criterion 4: switched off, making a token is refused with its words, and revoking one still works', async (t) => {
  await t.test('on', async () => {
    await fresh(false);
    const r = await A.post('/act/ai.createToken', { personId: 'mateo', name: 'Claude', back: '/workspace/ai' });
    assert.equal(r.status, 303);
  });
  await t.test('off', async () => {
    await fresh(false);
    await A.make('mateo', 'Claude on Mateo’s laptop');
    await A.setOff(true);
    const r = await A.post('/act/ai.createToken', { personId: 'rhea', name: 'Claude' });
    assert.equal(r.status, 400);
    assert.match(r.text, new RegExp(`AI access is off in ${WS}\\.`));
    // revoking still works (by the person, in the app)
    const tok = (await A.state());
    const before = tok.changes.length;
    // find the id from Mateo's Settings? Settings shows none while off, so revoke through the read-back's list when switching on
    const rb = await A.post('/act/setFeature', { id: 'ai-access', on: 'true' });
    const id = /name="tokenId" value="([^"]+)"/.exec(rb.text)?.[1];
    assert.ok(id, 'switching back on reads back the kept token, with Revoke');
    const rv = await A.post('/act/ai.revokeToken', { tokenId: id, back: '/workspace/features' }, 'mateo');
    assert.equal(rv.status, 303);
    const after2 = await A.state();
    assert.ok(after2.changes.slice(before).some((c) => c.actorId === 'mateo' && /Revoked the MCP token/.test(c.summary)), 'revoked while off');
    assert.ok(!/Switch AI access back on\?/.test((await A.post('/act/setFeature', { id: 'ai-access', on: 'true' })).text), 'with no live token left, switching on acts at once');
  });
});

test('criterion 5: switched off, no AI access section, no “Your MCP tokens”, no Make an MCP token', async (t) => {
  await t.test('on', async () => {
    await fresh(false);
    assert.match((await A.get('/workspace')).text, /href="\/workspace\/ai"/);
    assert.match((await A.get('/workspace/ai')).text, /The MCP tokens that let an AI tool act as someone here\./);
    assert.match((await A.get('/settings', 'rhea')).text, /Your MCP tokens/);
    assert.match((await A.get('/people/mateo')).text, /Make an MCP token/);
    assert.ok(!/Make an MCP token/.test((await A.get('/people/mateo', 'rhea')).text), 'only admins see it');
    assert.match((await A.get('/workspace/features')).text, /aria-label="AI access"/);
  });
  await t.test('off', async () => {
    await fresh(true);
    assert.ok(!/href="\/workspace\/ai"/.test((await A.get('/workspace')).text), 'Workspace has no AI access section');
    const ai = await A.get('/workspace/ai');
    assert.equal(ai.status, 404);
    assert.match(ai.text, /Page not found/);
    assert.ok(ai.text.includes(`AI access is switched off in ${WS}. An admin can switch it on in Workspace, Features.`));
    assert.ok(!/Your MCP tokens/.test((await A.get('/settings', 'rhea')).text));
    assert.ok(!/Make an MCP token/.test((await A.get('/people/mateo')).text));
    const help = await A.get('/help/ai');
    assert.equal(help.status, 404, 'its Help article is left out');
    assert.ok(help.text.includes(`AI access is switched off in ${WS}. An admin can switch it on in Workspace, Features.`));
  });
});

test('criterion 6: switching off reads back the tokens and MCP changes (aiAccessReadBack); back on names those kept; none acts at once', async (t) => {
  await t.test('the rule, on its worked examples', () => {
    const W = {
      people: [{ id: 'amara', name: 'Amara Nwosu', admin: true }, { id: 'rhea', name: 'Rhea Kapoor' }, { id: 'hamid', name: 'Hamid Rezaei', leftAt: '2026-10-01' }],
      tokens: [
        { id: 't1', personId: 'amara', name: 'Old one', createdAt: '2026-01-01', revokedAt: '2026-02-01' },
        { id: 't2', personId: 'amara', name: 'Claude on my laptop', createdAt: '2026-03-01', revokedAt: null },
        { id: 't3', personId: 'rhea', name: 'Claude', createdAt: '2026-04-01', revokedAt: null },
        { id: 't4', personId: 'hamid', name: 'Hamid’s', createdAt: '2026-05-01', revokedAt: null },
      ],
      changes: [{ via: 'mcp' }, { via: 'spreadsheet' }],
    };
    const rb = R.aiAccessReadBack(W);
    assert.equal(R.lineText(R.aiAccessOffLines(rb)), '2 tokens stop working at once: Rhea Kapoor’s “Claude” and Amara Nwosu’s “Claude on my laptop”. | They are kept, not revoked. Switch AI access back on and they work again. To end one for good, revoke it first. | What AI tools already changed stays, marked “via MCP” in Activity: 1 change. | An AI tool can’t switch this back on. An admin does, here.');
    assert.equal(R.lineText(R.aiAccessOnLines(rb)).split(' | ')[0], '2 tokens made before will work again at once: Rhea Kapoor’s “Claude” and Amara Nwosu’s “Claude on my laptop”.');
    const only = { ...W, tokens: [W.tokens[0], W.tokens[3]] };
    assert.equal([R.aiAccessAsks(rb), R.aiAccessAsks(R.aiAccessReadBack(only))].map((x) => (x ? 'asks' : 'acts at once')).join(', '), 'asks, acts at once');
    const many = { ...W, tokens: Array.from({ length: 7 }, (_, i) => ({ id: `m${i}`, personId: 'rhea', name: `T${i}`, createdAt: `2026-0${i + 1}-01`, revokedAt: null })) };
    assert.equal(R.aiAccessReadBack(many).names, 'Rhea Kapoor’s “T6”, Rhea Kapoor’s “T5”, Rhea Kapoor’s “T4”, Rhea Kapoor’s “T3”, Rhea Kapoor’s “T2” and 2 more');
    assert.equal(R.featureLine(W), '2 tokens are in use.');
  });
  await t.test('on: switching off asks first, with a live token', async () => {
    await fresh(false);
    assert.match((await A.post('/act/setFeature', { id: 'ai-access', on: 'false' })).text, /AI access is off in/, 'with no token it acts at once');
    await A.setOff(false);
    await A.make('rhea', 'Claude');
    const tokens = (await A.state()).tokens;
    await A.call('add_comment', { goal_id: (await A.call('find_goals', {}, tokens.amara)).json.result.structuredContent.goals[0].id, text: 'via MCP' }, tokens.amara);
    assert.match((await A.get('/workspace/features')).text, /1 token is in use\./, 'Features’ third line');
    const rb = await A.post('/act/setFeature', { id: 'ai-access', on: 'false' });
    assert.match(rb.text, /<strong>1 token stops working at once<\/strong>: Rhea Kapoor’s “Claude”\./);
    assert.match(rb.text, /marked “via MCP” in Activity: 1 change\./);
    assert.match(rb.text, /See the tokens/);
    assert.ok(!(await A.state()).modulesOff.includes('ai-access'), 'the read-back switches nothing by itself');
    await A.setOff(true);
    assert.ok((await A.state()).modulesOff.includes('ai-access'));
  });
  await t.test('off: switching back on names the tokens kept', async () => {
    const rb = await A.post('/act/setFeature', { id: 'ai-access', on: 'true' });
    assert.match(rb.text, /<strong>1 token made before will work again at once<\/strong>: Rhea Kapoor’s “Claude”\./);
    await A.setOff(false);
    assert.ok(!(await A.state()).modulesOff.includes('ai-access'));
  });
});

test('criterion 7: set_feature switching AI access off answers its last words', async (t) => {
  await t.test('on', async () => {
    await fresh(false);
    const tokens = (await A.state()).tokens;
    const r = await A.call('set_feature', { feature: 'ai-access', on: false }, tokens.amara);
    assert.equal(r.json.result.isError, false);
    assert.equal(r.json.result.content[0].text, `AI access is off in ${WS}. This connection stops working now. An admin switches it back on in Faro.`);
    assert.equal((await A.call('get_my_work', {}, tokens.amara)).json.error.message, SHUT, 'and it is the last thing that token does');
  });
  await t.test('off', async () => {
    await fresh(true);
    const tokens = (await A.state()).tokens;
    const r = await A.call('set_feature', { feature: 'ai-access', on: true }, tokens.amara);
    assert.equal(r.json.error.message, SHUT, 'an AI tool can’t switch it back on');
  });
});
