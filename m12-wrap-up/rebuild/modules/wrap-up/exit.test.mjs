// Stage 12's exit criteria (spec/rebuild/stage-12-module-wrap-up.md), one test per criterion, each run three ways:
// the module on, switched off by an admin, and left out of the build (FARO_WITHOUT=wrap-up).
// Usage: node --test modules/wrap-up/exit.test.mjs   (ports EXIT_PORT, +1, +2; default 47440)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, '../..');
const PORT = Number(process.env.EXIT_PORT || 47440);
const WS = 'Platform Engineering';
const OFF_PAGE = `Wrap-up is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const OFF_TOOL = (t) => `Wrap-up is switched off in ${WS}, so ${t} can’t be used there. An admin can switch it on in Workspace, under Features.`;
const OFF_SAVE = `Wrap-up is off in ${WS}.`;

const servers = {};
function start(port, env = {}) {
  return new Promise((res, rej) => {
    const s = spawn(process.execPath, [path.join(ROOT, 'app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
    s.on('exit', (code) => rej(new Error(`the app on ${port} stopped (${code})`)));
    s.stdout.on('data', (d) => { if (/rebuilt on/.test(String(d))) res(s); });
    setTimeout(() => rej(new Error(`the app on ${port} did not start`)), 10000);
  });
}
const MODES = { on: { port: PORT }, off: { port: PORT + 1 }, out: { port: PORT + 2, env: { FARO_WITHOUT: 'wrap-up' } } };
before(async () => { for (const [k, m] of Object.entries(MODES)) servers[k] = await start(m.port, m.env); });
after(() => { for (const s of Object.values(servers)) { s.removeAllListeners('exit'); s.kill(); } });

const base = (mode) => `http://localhost:${MODES[mode].port}`;
const text = (html) => html.replace(/<\/?(strong|em|b)>/g, '').replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, '’').replace(/\s+/g, ' ');
async function get(mode, p, as = 'amara', today = '') {
  const r = await fetch(base(mode) + p, { headers: { cookie: `as=${as}${today ? `; today=${today}` : ''}` }, redirect: 'manual' });
  const html = await r.text();
  return { status: r.status, html, text: text(html), location: r.headers.get('location') };
}
async function post(mode, p, body, as = 'amara', today = '') {
  const r = await fetch(base(mode) + p, { method: 'POST', headers: { cookie: `as=${as}${today ? `; today=${today}` : ''}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString(), redirect: 'manual' });
  const html = await r.text();
  return { status: r.status, html, text: text(html), location: r.headers.get('location') };
}
const state = async (mode) => (await fetch(base(mode) + '/api/state')).json();
async function mcp(mode, as, method, params = {}, today = '') {
  const tok = (await state(mode)).tokens[as];
  const r = await fetch(base(mode) + '/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', cookie: today ? `today=${today}` : '' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await r.json()).result;
}
const call = async (mode, as, name, args = {}, today = '') => { const r = await mcp(mode, as, 'tools/call', { name, arguments: args }, today); return { error: r.isError, text: r.content[0].text, data: r.structuredContent }; };
// each test starts from the demo as built; "off" switches the Wrap-up off as an admin first (on 5 Nov it acts at once)
async function fresh(mode) {
  await fetch(base(mode) + '/api/reset', { method: 'POST' });
  if (mode === 'off') { const r = await post(mode, '/act/setFeature', { id: 'wrap-up', on: 'false' }); match(r.text, /Wrap-up is off in Platform Engineering\. Nothing it saved is lost\./); }
}
const W52 = '2026-12-22';
const cut = (x) => String(x).slice(0, 240);
const match = (t, re, m) => assert.ok(re.test(t), m || `${re} not in: ${cut(t)}`);
const noMatch = (t, re, m) => assert.ok(!re.test(t), m || `${re} found in: ${cut(t)}`);
const learned = 'Dependencies on other teams need a date agreed in week 1.';

for (const mode of Object.keys(MODES)) {
  test(`1: RETRO and WRAP-UP-OPTIONAL hold (${mode})`, async () => {
    await fresh(mode);
    if (mode === 'on') {
      // RETRO: from the last two weeks each owner wraps up: how it landed, one thing learned, carry on or stop; then an admin starts the next cycle
      const early = await post(mode, '/retro/ns-mttr', { result: 'partly', next: 'carry', learned, save: '1' }, 'mateo', '2026-11-05');
      match(early.text, /2026’s wrap-up opens on Mon 21 Dec 2026\./);
      assert.equal((await post(mode, '/retro/ns-mttr', { result: 'partly', next: 'carry', learned, save: '1' }, 'mateo', W52)).location, '/retro/mttr-pir');
      assert.equal((await post(mode, '/retro/mttr-pir', { result: 'missed', next: 'stop', learned: 'Action reviews need an owner for each action.', save: '1' }, 'mateo', W52)).location, '/retro?done=1');
      match((await post(mode, '/retro/ns-mttr', { result: 'hit', next: 'carry', learned, save: '1' }, 'rhea', W52)).text, /Only its owner wraps up this goal/);
      const viaTool = await call(mode, 'rhea', 'wrap_up_goal', { goal_id: 'G-41', result: 'hit', learned, next: 'carry' }, W52);
      assert.ok(viaTool.error && /^Only the goal’s owner or an admin can wrap it up\./.test(viaTool.text), viaTool.text);
      const s = await state(mode);
      assert.equal(s.retros.length, 2);
      assert.equal(s.changes.filter((c) => c.entity === 'retro' && c.actorId === 'mateo').length, 2);
      const r = await post(mode, '/workspace/cycles/next', {}, 'amara', W52);
      match(r.text, /2027 is ready/);
      const s2 = await state(mode);
      const c2 = s2.cycles.find((c) => c.id !== 'cycle');
      assert.ok(c2 && s2.goalsAll.some((g) => g.carriedFrom === 'ns-mttr' && g.cycleId === c2.id), 'the goal that carries on is in 2027');
      assert.ok(!s2.goalsAll.some((g) => g.carriedFrom === 'mttr-pir'), 'the goal its owner stopped stays in 2026');
      assert.ok(s2.changes.some((c) => c.entity === 'cycle' && c.actorId === 'amara'), 'starting the cycle is logged');
    } else {
      // WRAP-UP-OPTIONAL: nobody is asked; results as before; an admin still starts the next year
      for (const p of ['/', '/goals?scope=all', '/goals/ns-mttr', '/workspace/cycles']) {
        const pg = await get(mode, p, 'mateo', W52);
        noMatch(pg.html, /href="\/retro/, `${p} offers no wrap-up`);
      }
      match((await post(mode, '/workspace/cycles/next', {}, 'amara', W52)).text, /2027 is ready/);
    }
  });

  test(`2: its journeys and checks can be done (${mode})`, async () => {
    // U10, U166 and N22 are driven in a real browser by modules/wrap-up/journeys.mjs (they run with the module on); its exit code is the check
    if (mode === 'on') {
      const code = await new Promise((res) => { const j = spawn(process.execPath, [path.join(here, 'journeys.mjs')], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, JOURNEY_PORT: String(PORT + 10) } }); let out = ''; j.stdout.on('data', (d) => (out += d)); j.on('exit', (c) => res({ c, out })); });
      assert.equal(code.c, 0, code.out.split('\n').filter((l) => /^FAIL/.test(l)).join('; ') || 'the journeys did not all pass');
    }
    // here, N22's parts the server says: no Help article while off, and it comes back when on
    await fresh(mode);
    const help = await get(mode, '/help');
    const art = await get(mode, '/help/wrap-up');
    if (mode === 'on') { match(help.text, /Wrapping up the year, and the next one/); assert.equal(art.status, 200); }
    else { noMatch(help.text, /Wrapping up the year, and the next one/); assert.equal(art.status, 404); }
    if (mode === 'off') match(art.text, new RegExp(OFF_PAGE.replace(/[.,]/g, '\\$&')));
    const gh = await call(mode, 'amara', 'get_help', { article: 'wrap-up' });
    if (mode === 'on') assert.equal(gh.error, false); else assert.equal(gh.error, true);
    if (mode === 'off') {
      // and it comes back on, with what it saved
      await post(mode, '/act/setFeature', { id: 'wrap-up', on: 'true' });
      assert.equal((await get(mode, '/help/wrap-up')).status, 200);
      assert.equal((await get(mode, '/retro', 'mateo', W52)).status, 200);
    }
  });

  test(`3: switched off, /retro says so and its tools refuse (${mode})`, async () => {
    await fresh(mode);
    for (const p of ['/retro', '/retro/ns-mttr']) {
      const pg = await get(mode, p, 'mateo', W52);
      if (mode === 'on') { assert.equal(pg.status, 200); continue; }
      assert.equal(pg.status, 404); match(pg.text, /Page not found/);
      if (mode === 'off') assert.ok(pg.text.includes(OFF_PAGE), `${p} says the switched-off sentence`);
      else assert.ok(!pg.text.includes(OFF_PAGE), `${p}: left out, it is simply not there`);
    }
    const list = (await mcp(mode, 'mateo', 'tools/list')).tools.map((t) => t.name);
    const gw = await call(mode, 'mateo', 'get_wrap_up', {}, W52).catch(() => null);
    const wg = await call(mode, 'mateo', 'wrap_up_goal', { goal_id: 'G-41', result: 'partly', learned, next: 'carry' }, W52).catch(() => null);
    if (mode === 'on') { assert.equal(gw.error, false); assert.equal(gw.data.open, true); assert.equal(wg.error, false); }
    if (mode === 'off') { assert.ok(list.includes('get_wrap_up') && list.includes('wrap_up_goal'), 'still listed'); assert.equal(gw.text, OFF_TOOL('get_wrap_up')); assert.equal(wg.text, OFF_TOOL('wrap_up_goal')); assert.equal((await state(mode)).retros.length, 0); }
    if (mode === 'out') assert.ok(!list.includes('get_wrap_up') && !list.includes('wrap_up_goal'), 'left out, its tools are not there');
  });

  test(`4: switched off, Home leads with check-ins, no “Wrap up this goal”, saving refuses (${mode})`, async () => {
    await fresh(mode);
    // Mateo checks in for week 52 (so nothing else leads), then Home in the year's last two weeks
    for (const [g, v, c] of [['G-41', 40, 'At risk'], ['G-49', 85, 'On track']]) {
      const r = await call(mode, 'mateo', 'post_check_in', { goal_id: g, week: 52, value: v, call: c, why: 'Still recovering from the November incidents, as planned.', path_to_green: 'Two more runbooks this week.', back_on_plan_by_week: 53 }, W52);
      assert.equal(r.error, false, r.text);
    }
    const home = await get(mode, '/', 'mateo', W52);
    const goal = await get(mode, '/goals/ns-mttr', 'mateo', W52);
    if (mode === 'on') { match(home.text, /Wrap up your 2 goals/); match(goal.text, /Wrap up this goal/); }
    else { noMatch(home.text, /Wrap up your/); noMatch(goal.text, /Wrap up this goal/); }
    // in week 52 before checking in, an owner's lead is the check-ins, as in any other week
    await fresh(mode);
    const home2 = await get(mode, '/', 'mateo', '2026-12-24'); // check-ins are due on Thursday 24 Dec
    match(home2.text, /2 check-ins to do/); noMatch(home2.text, /Wrap up your/);
    const save = await post(mode, '/act/wrapUp.save', { goalId: 'ns-mttr', result: 'partly', learned, next: 'carry' }, 'mateo', W52);
    if (mode === 'off') { assert.equal(save.status, 400); assert.ok(save.text.includes(OFF_SAVE), save.text.slice(0, 300)); }
    if (mode === 'on') assert.equal(save.status, 303);
  });

  test(`5: switching off reads back first, from wrapUpOffReadBack (${mode})`, async () => {
    await fresh(mode);
    if (mode !== 'on') { const f = await get(mode, '/workspace/features'); if (mode === 'out') noMatch(f.text, /Wrap-up/); else match(f.html, /aria-label="Wrap-up"[^>]*>Off|aria-checked="false" aria-label="Wrap-up"/); return; }
    // nothing written and not open: acts at once
    const f = await get(mode, '/workspace/features');
    match(f.text, /Opens on Mon 21 Dec 2026\./);
    let r = await post(mode, '/act/setFeature', { id: 'wrap-up', on: 'false' });
    match(r.text, /Wrap-up is off in Platform Engineering\. Nothing it saved is lost\./);
    assert.ok((await state(mode)).changes.some((c) => c.entity === 'workspace' && c.summary === 'Switched off Wrap-up'));
    // with wrap-ups written, while open: the read-back, then the switch
    await fresh(mode);
    await post(mode, '/retro/ns-mttr', { result: 'partly', next: 'carry', learned, save: '1' }, 'mateo', W52);
    await post(mode, '/retro/mttr-pir', { result: 'missed', next: 'stop', learned, save: '1' }, 'mateo', W52);
    r = await post(mode, '/act/setFeature', { id: 'wrap-up', on: 'false' }, 'amara', W52);
    match(r.text, /Switch off Wrap-up\?/);
    match(r.text, /The wrap-up leaves Home, Goals and Cycles\. Owners aren’t asked how their goals landed\. 124 goals are not wrapped up yet and won’t be asked for\./);
    match(r.text, /2 wrap-ups already written stay in each goal’s History\./);
    match(r.text, /1 goal was marked “Stop” at its wrap-up, and it stops when 2027 starts\./);
    match(r.text, /The year still ends\. Results are worked out as before, and an admin starts 2027 from Cycles\./);
    assert.deepEqual((await state(mode)).modulesOff, [], 'nothing switched yet');
    r = await post(mode, '/act/setFeature', { id: 'wrap-up', on: 'false', confirm: '1' }, 'amara', W52);
    assert.deepEqual((await state(mode)).modulesOff, ['wrap-up']);
    // wrap-ups already written stay in History
    match((await get(mode, '/goals/ns-mttr?history=changes', 'amara', W52)).text, /Wrapped up Mean time to restore service/);
  });

  test(`6: off or on, an admin starts the next year from Cycles, and results are as before (${mode})`, async () => {
    await fresh(mode);
    const cyc = await get(mode, '/workspace/cycles', 'amara', W52);
    match(cyc.html, /class="cycles-block"/);
    match(cyc.text, /Start 2027/);
    if (mode === 'on') match(cyc.text, /Open the wrap-up/); else noMatch(cyc.text, /wrap-up/i);
    const dry = await call(mode, 'amara', 'start_next_cycle', {}, W52);
    assert.equal(dry.error, false, dry.text); match(dry.text, /Nothing was saved \(dry run\)/);
    const r = await post(mode, '/workspace/cycles/next', {}, 'amara', W52);
    match(r.text, /2027 is ready/);
    const s = await state(mode);
    assert.equal(s.cycles.length, 2);
    const a = await call(mode, 'amara', 'get_goal', { goal_id: 'G-1' }, '2026-11-05');
    match(a.text, /^G-1 Lead time for changes — Off track/);
    // 4 Jan 2027: everyone is in 2027, with the goals that carried on
    const jan = await get(mode, '/goals?scope=all&q=Lead%20time', 'amara', '2027-01-04');
    assert.ok(/Lead time for changes/.test(jan.text), 'the new year shows the carried goals');
  });
}
