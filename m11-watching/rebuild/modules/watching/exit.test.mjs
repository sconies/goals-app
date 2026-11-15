// Stage 11's exit criteria (spec/rebuild/stage-11-module-watching.md), one test per criterion, each run against the
// running app with Watching on, switched off, and left out of the build. Usage: node --test modules/watching/exit.test.mjs
// Ports 47320–47329. A failed app start fails every test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { watchingOffReadBack, watchingOffLines, lineText, scopesFor, writesWatches } from './rules.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const WS = 'Platform Engineering';
const servers = [];
async function start(port, env = {}) {
  const s = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FARO_WITHOUT: '', ...env } });
  servers.push(s);
  let err = '';
  s.stderr.on('data', (d) => (err += d));
  await new Promise((res, rej) => { s.stdout.once('data', res); s.once('exit', (c) => rej(new Error(`the app did not start (exit ${c}): ${err}`))); setTimeout(() => rej(new Error('the app did not start in 10 s')), 10000); });
  const base = `http://localhost:${port}`;
  const get = async (p, as = 'amara', extra = '') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}${extra}` }, redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location'), cookie: r.headers.get('set-cookie') }; };
  const post = async (p, form, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };
  const tokens = (await (await fetch(base + '/api/state')).json()).tokens;
  let seq = 0;
  const tool = async (as, name, args = {}) => {
    const r = await fetch(base + '/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${tokens[as]}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name, arguments: args } }) });
    const j = await r.json();
    return { text: j.result?.content?.[0]?.text ?? j.error?.message, isError: j.result?.isError, data: j.result?.structuredContent };
  };
  const list = async () => (await (await fetch(base + '/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${tokens.amara}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).json()).result.tools.map((t) => t.name);
  const reset = () => fetch(base + '/api/reset', { method: 'POST' });
  const state = async () => (await fetch(base + '/api/state')).json();
  const off = () => post('/act/setFeature', { id: 'watching', on: 'false', confirm: '1' });
  const on = () => post('/act/setFeature', { id: 'watching', on: 'true' });
  return { base, get, post, tool, list, reset, state, off, on };
}
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
// everyone's live watches, as list_watching gives them (kept, and restored)
async function allWatches(A, people) { const out = {}; for (const p of people) { const r = await A.tool(p, 'list_watching'); out[p] = (r.data?.watches || []).map((w) => w.id).sort().join(','); } return out; }

let A, X; // A: the module in; X: the build without it
before(async () => { A = await start(47321); X = await start(47322, { FARO_WITHOUT: 'watching' }); });
after(() => { for (const s of servers) s.kill(); });

test('criterion 1: its requirements hold (WATCHING, ONE-WATCHING, WATCHING-OPTIONAL)', async () => {
  await A.reset();
  // on: anyone watches a goal, a tree or a level; Watching is a Goals scope with the toolbar, /watching goes there
  let r = await A.post('/act/watch', { kind: 'tree', ref: 'ns-lead', back: '/goals/ns-lead' }, 'oskar');
  assert.equal(r.status, 303); assert.equal(r.location, '/goals/ns-lead');
  r = await A.get('/goals/ns-lead', 'oskar');
  assert.match(strip(r.text), /Watching all \d+ goals in/);
  r = await A.post('/act/watch', { kind: 'level', ref: 'svp', back: '/goals?scope=watching' }, 'oskar');
  r = await A.get('/goals?scope=watching', 'oskar');
  assert.match(strip(r.text), /Every SVP goal/);
  assert.match(r.text, /class="bar-row filterbar-row"/, 'Watching has the Goals toolbar');
  assert.match(r.text, /aria-current="page">Watching</);
  r = await A.get('/watching?level=team', 'oskar');
  assert.equal(r.location, '/goals?scope=watching&level=team');
  r = await A.get('/goals?scope=watching&level=team', 'oskar');
  assert.match(strip(r.text), /Filtered by: Level Team|Level Team/);
  const s = await A.state();
  assert.ok(s.changes.some((c) => c.entity === 'watch' && c.actorId === 'oskar'), 'a watch is logged as a watch');
  // one watching block on Home
  r = await A.get('/', 'oskar');
  assert.equal((r.text.match(/aria-label="Goals you watch"/g) || []).length, 1);
  // off (WATCHING-OPTIONAL) is criteria 3–7; left out of the build, nothing of it is there
  r = await X.get('/', 'oskar');
  assert.doesNotMatch(r.text, /Goals you watch/);
  assert.ok(!(await X.list()).includes('watch'), 'built without it, its tools are not listed');
  r = await X.get('/workspace/features');
  assert.doesNotMatch(r.text, /aria-label="Watching"/);
});

test('criterion 2: its journeys and checks can be done (U9, U80, U164 in short, over HTTP)', async () => {
  await A.reset();
  // U9: Oskar owns no goal, is told so calmly, and sees what he watches
  let r = await A.get('/', 'oskar');
  assert.match(strip(r.text), /Nothing is asked of you today\./);
  assert.match(r.text, /class="tree"><a class="trow"/);
  assert.match(r.text, /class="trow-why">[^<]{11,}/);
  // U80: Watch says what it does; then Watching with Stop watching and Undo; an owner has no Watch and About says why
  r = await A.get('/goals/ns-lead', 'oskar');
  assert.match(strip(r.text), /show on your Home and under Watching in Goals/);
  assert.match(strip(r.text), /Faro sends no email/);
  assert.match(r.text, /aria-label="Watch Lead time for changes"/);
  await A.post('/act/watch', { kind: 'goal', ref: 'ns-lead', back: '/goals/ns-lead' }, 'oskar');
  r = await A.get('/goals/ns-lead', 'oskar');
  assert.match(strip(r.text), /Watching Lead time for changes/);
  assert.match(r.text, /aria-label="You’re watching Lead time for changes"/);
  const wid = /name="watchId" value="([^"]+)"/.exec(r.text.split('id="watch-sheet"')[1])[1];
  await A.post('/act/unwatch', { watchId: wid, back: '/goals/ns-lead' }, 'oskar');
  r = await A.get('/goals/ns-lead', 'oskar');
  assert.match(strip(r.text), /Stopped watching .* Undo/);
  r = await A.get('/goals/ns-lead', 'rhea');
  assert.doesNotMatch(r.text, /data-dialog="watch-sheet"/);
  assert.match(strip(r.text), /Owners don’t need to watch their own goals\./);
  // U164: Features in its groups, saying how many watch
  r = await A.get('/workspace/features');
  assert.deepEqual([...r.text.matchAll(/class="features-group"[^>]*><h2>([^<]+)</g)].map((m) => m[1]), ['Working together', 'Tools', 'Beyond this workspace']);
  assert.match(strip(r.text), /\d+ people watch goals here\./);
});

test('criterion 3: off, /watching is Page not found with its sentence, and its tools answer the switched-off sentence', async () => {
  await A.reset();
  let w = await A.tool('rhea', 'list_watching');
  assert.equal(w.isError, false); assert.ok(w.data.watches.length > 0);
  w = await A.tool('oskar', 'watch', { kind: 'goal', ref: 'G-9999' });
  assert.equal(w.isError, true); assert.equal(w.text, `There’s no goal with the ID or key G-9999 in ${WS}. Use find_goals to get IDs and keys.`);
  assert.match((await A.get('/help')).text, /href="\/help\/watching"/);
  await A.off();
  const r = await A.get('/watching');
  assert.equal(r.status, 404);
  assert.match(r.text, /Page not found/);
  assert.ok(strip(r.text).includes(`Watching is switched off in ${WS}. An admin can switch it on in Workspace, Features.`));
  for (const [name, args] of [['list_watching', {}], ['watch', { kind: 'level', ref: 'svp' }], ['unwatch', { watch_id: 'w_po1852' }]]) {
    const t = await A.tool('amara', name, args);
    assert.equal(t.isError, true);
    assert.equal(t.text, `Watching is switched off in ${WS}, so ${name} can’t be used there. An admin can switch it on in Workspace, under Features.`);
  }
  assert.ok((await A.list()).includes('watch'), 'still listed while off');
  // and its Help article (N22): gone from Help, its address says the sentence
  const hp = await A.get('/help/watching');
  assert.equal(hp.status, 404); assert.ok(strip(hp.text).includes(`Watching is switched off in ${WS}.`));
  assert.doesNotMatch((await A.get('/help')).text, /href="\/help\/watching"/);
  // left out: simply not there
  const x = await X.get('/watching');
  assert.equal(x.status, 404); assert.doesNotMatch(x.text, /switched off/);
});

test('criterion 4: off, no Watching tab (a remembered one opens Mine, or All), no “Goals you watch”, no Watch or Watched by, and the watch action refuses', async () => {
  await A.reset();
  let r = await A.get('/goals?scope=watching', 'rhea');
  assert.match(r.cookie || '', /goalsScope=watching/);
  r = await A.get('/goals/ns-lead', 'oskar');
  assert.match(r.text, /data-dialog="watch-sheet"/);
  r = await A.get('/goals/ns-lead', 'amara');
  assert.match(strip(r.text), /Watched by \d+ people/);
  await A.off();
  r = await A.get('/goals', 'rhea', '; goalsScope=watching');
  assert.doesNotMatch(r.text, /scope=watching/);
  assert.match(r.text, /aria-current="page">Mine</, 'a remembered Watching opens Mine for an owner');
  r = await A.get('/goals', 'oskar', '; goalsScope=watching');
  assert.match(r.text, /aria-current="page">All</, 'and All for someone who owns no goal');
  r = await A.get('/', 'rhea');
  assert.doesNotMatch(r.text, /Goals you watch/);
  r = await A.get('/goals/ns-lead', 'oskar');
  assert.doesNotMatch(r.text, /watch-sheet|>Watch<|>Watching</);
  assert.doesNotMatch(strip(r.text), /Watched by/);
  r = await A.post('/act/watch', { kind: 'goal', ref: 'ns-lead' }, 'oskar');
  assert.equal(r.status, 400);
  assert.ok(strip(r.text).includes(`Watching is off in ${WS}.`));
  r = await A.post('/act/unwatch', { watchId: 'w_po1852' }, 'amara');
  assert.ok(strip(r.text).includes(`Watching is off in ${WS}.`));
  // left out: the same, with no tab to remember
  r = await X.get('/goals', 'rhea', '; goalsScope=watching');
  assert.match(r.text, /aria-current="page">Mine</);
});

test('criterion 5: off, someone who owns no goal is led to “{n} goals need attention · See them”', async () => {
  await A.reset();
  let r = await A.get('/', 'oskar');
  assert.doesNotMatch(strip(r.text), /goals? needs? attention See them/);
  await A.off();
  r = await A.get('/', 'oskar');
  const t = strip(r.text);
  assert.match(t, /\d+ goals need attention See them/);
  assert.match(r.text, /href="\/goals\?scope=all&(amp;)?attention=1">See them/);
  r = await X.get('/', 'oskar');
  assert.match(strip(r.text), /\d+ goals need attention See them/);
});

test('criterion 6: switching off first reads back what stays (watchingOffReadBack); with no watch it acts at once', async () => {
  // the rule's worked example
  const W = { people: ['a', 'b', 'c', 'd'].map((id) => ({ id })), goals: [{ id: 'g1', ownerId: 'a' }, { id: 'g2', ownerId: 'b' }, { id: 'g3', ownerId: 'c', removedAt: 'x' }],
    watches: [{ id: 1, personId: 'a', kind: 'level', ref: 'svp' }, { id: 2, personId: 'b', kind: 'goal', ref: 'g1' }, { id: 3, personId: 'b', kind: 'goal', ref: 'g2' }, { id: 4, personId: 'c', kind: 'tree', ref: 'g1' }, { id: 5, personId: 'd', kind: 'goal', ref: 'g1', removedAt: 'y' }] };
  const lines = watchingOffLines(watchingOffReadBack(W)).map(lineText);
  assert.equal(lines[1], '3 people’s 4 watches are kept. Nobody is shown as watching while it is off.');
  assert.equal(lines[2], '1 person owns no goal and sees Home through what they watch. Their Home will show every goal that needs attention instead.');
  assert.ok(watchingOffLines(watchingOffReadBack(W), { reviewsOn: false }).map(lineText).includes('Goals don’t change. Each is still on its owner’s Home, in Goals.'));
  // the rule's other worked examples: the tabs, and what is refused
  assert.equal(`${scopesFor({ owns: true, hasTeam: true, watchingOn: true, counts: { mine: 1, team: 2, watching: 1, all: 3 }, last: 'watching' }).words}; opens ${scopesFor({ owns: true, hasTeam: true, watchingOn: true, last: 'watching' }).opens}`, 'Mine 1 · My team 2 · Watching 1 · All 3; opens watching');
  assert.equal(scopesFor({ owns: true, hasTeam: true, watchingOn: false, last: 'watching' }).opens, 'mine');
  assert.equal(scopesFor({ owns: false, hasTeam: false, watchingOn: false, last: 'watching' }).opens, 'all');
  assert.deepEqual([{ changes: [{ entity: 'watch' }] }, { changes: [{ entity: 'watch', action: 'Restored' }] }, { writes: { watches: [{ id: 1 }] } }, { changes: [{ entity: 'cycle' }], writes: { goals: [{}], watches: [{}] } }].map((x) => (writesWatches(x) ? 'refused' : 'saved')), ['refused', 'refused', 'refused', 'saved']);
  // in the app: the switch shows the read-back; Cancel keeps it on; its button switches it off
  await A.reset();
  let r = await A.post('/act/setFeature', { id: 'watching', on: 'false' });
  const t = strip(r.text);
  assert.match(r.text, new RegExp(`role="dialog"[^>]*aria-label="Switch off Watching in ${WS}"`));
  assert.match(t, /\d+ people’s \d+ watches are kept\./);
  assert.match(t, /Nothing is deleted\./);
  assert.ok(!(await A.state()).modulesOff.includes('watching'), 'the read-back alone switches nothing');
  r = await A.off();
  assert.ok(strip(r.text).includes(`Watching is off in ${WS}. Nothing it saved is lost.`));
  assert.ok((await A.state()).changes.some((c) => c.entity === 'workspace' && c.actorId === 'amara' && c.summary === 'Switched off Watching'));
  // with no watch at all it acts at once
  await A.reset();
  // stop every watch, as its owner
  const s = await (await fetch(A.base + '/api/state')).json();
  for (const p of Object.keys(s.tokens)) { const l = await A.tool(p, 'list_watching'); for (const w of l.data?.watches || []) await A.tool(p, 'unwatch', { watch_id: w.id }); }
  r = await A.post('/act/setFeature', { id: 'watching', on: 'false' });
  assert.doesNotMatch(r.text, /role="dialog"/);
  assert.ok((await A.state()).modulesOff.includes('watching'), 'with no watch it switched at once');
});

test('criterion 7: back on, every person watches what they did', async () => {
  await A.reset();
  const s = await A.state();
  const people = Object.keys(s.tokens);
  const before = await allWatches(A, people);
  assert.ok(Object.values(before).filter(Boolean).length >= 10);
  await A.off();
  let r = await A.get('/', 'rhea');
  assert.doesNotMatch(r.text, /Goals you watch/);
  r = await A.on();
  assert.ok(strip(r.text).includes(`Watching is on in ${WS}.`));
  assert.deepEqual(await allWatches(A, people), before);
  r = await A.get('/', 'rhea');
  assert.match(r.text, /Goals you watch/);
});
