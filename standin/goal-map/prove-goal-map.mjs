/* The Goal map on the stand-in platform (drill item 11, stage 6). Starts the built server on a fresh data folder, seeds
   it, and checks its exit criteria on the running stand-in, through the API and the screens (Playwright, signed in by
   password): with the module in the build, on (the Map is a layout and draws), switched off by an admin in Workspace →
   Features (four layouts, nothing on Goals says Map, view=map opens the List and says so once), and back on; and the
   server's refusals for the only things it writes (the switch; a saved view for everyone that asks for the Map) by a
   member who isn't an admin. The Goal map owns no records and no AI tools, so /mcp must list the same tools as the core.
   With `out` it checks the build that leaves the module out: no Map, no Goal map row in Features, view=map opens the List.
   Usage: npm run build:standin && node platform/prove-goal-map.mjs [port] [in|out]. One line per check and a tally. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.argv[2] || 47720);
const MODE = process.argv[3] || 'in';
const B = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'faro-goalmap-'));
const ENV = { ...process.env, STANDIN_PORT: String(PORT), STANDIN_DATA: DATA, NODE_NO_WARNINGS: '1' };
const PASSWORD = 'faro-standin';
const WS = 'ws_platform';
const OFF = 'The Goal map is off here, so this is the List.';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

function run(args) { return new Promise((res, rej) => { const p = spawn(process.execPath, ['platform/dist/server.mjs', ...args], { env: ENV, stdio: 'inherit' }); p.on('exit', (c) => (c ? rej(new Error('exit ' + c)) : res())); }); }
async function start() {
  const p = spawn(process.execPath, ['platform/dist/server.mjs'], { env: ENV, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res) => p.stdout.on('data', (d) => { if (/stand-in platform/.test(String(d))) res(); }));
  return p;
}
function client() {
  let cookie = '';
  const c = async (method, url, body, headers = {}) => {
    const r = await fetch(B + url, { method, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: r.status, json, text };
  };
  c.signIn = (email) => c('POST', '/api/signin', { email, password: PASSWORD });
  return c;
}
let n = 0;
const change = (actor, entity, entityId, summary) => ({ id: `chg_gm${++n}`, at: new Date().toISOString(), actorId: actor, goalId: null, entity, entityId, action: 'edited', summary, diffs: [] });

await run(['seed', PASSWORD]);
const server = await start();
const browser = await chromium.launch();
try {
  const rhea = client(); await rhea.signIn('rhea.kapoor@example.com');
  const amara = client(); await amara.signIn('amara.nwosu@example.com');

  // ---------- The server: what the module writes, and who may (R1 rule 4) ----------
  if (MODE === 'in') {
    let r = await rhea('POST', `/api/workspaces/${WS}/commit`, { modulesOff: ['goal-map'], changes: [change('rhea', 'workspace', WS, 'Switched off Goal map')] });
    check('a member who isn’t an admin switches the Goal map off: refused by the server', r.status === 403 && /Only admins can switch features/.test(r.json?.error ?? ''), `${r.status} ${r.json?.error}`);
    const view = { id: 'view_gm_all', personId: 'rhea', name: 'Everything on the map', params: 'scope=all&view=map', pinned: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null };
    r = await rhea('POST', `/api/workspaces/${WS}/commit`, { views: [view], changes: [change('rhea', 'view', view.id, 'Saved a view')] });
    check('a member pins a Map view for everyone: refused by the server', r.status === 403 && /Only admins can pin/.test(r.json?.error ?? ''), `${r.status} ${r.json?.error}`);
    const own = { ...view, id: 'view_gm_mine', pinned: false };
    r = await rhea('POST', `/api/workspaces/${WS}/commit`, { views: [own], changes: [change('rhea', 'view', own.id, 'Saved a view')] });
    check('a member saves a Map view of their own: allowed', r.status === 200, `${r.status} ${r.json?.error ?? ''}`);
    r = await amara('POST', `/api/workspaces/${WS}/commit`, { views: [{ ...own, name: 'Taken' }], changes: [change('amara', 'view', own.id, 'Renamed a view')] });
    check('an admin may change it (R1: its owner or an admin)', r.status === 200, `${r.status} ${r.json?.error ?? ''}`);
    r = await client()('GET', `/api/workspaces/${WS}`);
    check('someone signed out reads nothing', r.status === 401);
  }
  // ---------- /mcp: the module adds no AI tools ----------
  {
    const r = await amara('POST', `/api/workspaces/${WS}/tokens`, { tokens: [{ id: 'tok_gmproof', personId: 'amara', name: 'proof', createdBy: 'amara', createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null }], changes: [] });
    const t = await fetch(B + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${r.json?.secret}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) }).then((x) => x.json());
    const tools = t?.result?.tools?.map((x) => x.name) ?? [];
    check(`/mcp lists the core’s tools and none of the Goal map’s (it has none)`, tools.length === 53 && !tools.some((x) => /map/i.test(x)), `${tools.length} tools`);
    if (MODE === 'in') {
      const r2 = await amara('POST', `/api/workspaces/${WS}/tokens`, { tokens: [{ id: 'tok_gmrhea', personId: 'rhea', name: 'proof', createdBy: 'amara', createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null }], changes: [] });
      const call = (secret, args) => fetch(B + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${secret}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'set_feature', arguments: args } }) }).then((x) => x.json());
      let c = await call(r2.json?.secret, { feature: 'goal-map', on: false });
      let w = (await amara('GET', '/api/workspaces')).json?.find((x) => x.id === WS);
      check('MCP set_feature by a member who isn’t an admin: refused, the switch unchanged', c?.result?.isError && !(w?.modulesOff ?? []).includes('goal-map'), String(c?.result?.content?.[0]?.text ?? JSON.stringify(c)).slice(0, 120));
      c = await call(r.json?.secret, { feature: 'goal-map', on: false });
      w = (await amara('GET', '/api/workspaces')).json?.find((x) => x.id === WS);
      check('MCP set_feature by an admin switches it off in SQLite', !c?.result?.isError && (w?.modulesOff ?? []).includes('goal-map'), String(c?.result?.content?.[0]?.text ?? '').slice(0, 120));
      c = await call(r.json?.secret, { feature: 'goal-map', on: true });
      w = (await amara('GET', '/api/workspaces')).json?.find((x) => x.id === WS);
      check('… and back on', !c?.result?.isError && !(w?.modulesOff ?? []).includes('goal-map'));
    }
  }

  // ---------- The screens ----------
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(B + '/goals');
  await page.fill('input[name=email]', 'amara.nwosu@example.com');
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !/signin/.test(u.pathname), { timeout: 15000 });
  const layouts = async () => {
    await page.goto(B + '/goals?scope=all');
    await page.locator('.layout-menu').first().waitFor({ timeout: 15000 });
    await page.locator('.layout-menu summary').first().click();
    await page.waitForTimeout(300);
    const items = (await page.locator('.layout-menu .menuitem .menu-text > span:first-child').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    await page.locator('.layout-menu summary').first().click();
    return items;
  };
  const mapDrawn = async () => { await page.locator('.react-flow__node, .map-list').first().waitFor({ timeout: 10000 }).catch(() => {}); return page.locator('.react-flow__node').count(); };
  const openMap = async () => {
    await page.goto(B + '/goals?scope=all&view=map');
    await page.waitForTimeout(1500);
    const body = await page.locator('main').innerText().catch(() => '');
    return { nodes: await page.locator('.react-flow__node').count(), says: body.split(OFF).length - 1, url: page.url() };
  };
  const flip = async (to) => {
    await page.goto(B + '/workspace/features');
    const box = page.getByRole('checkbox', { name: 'Goal map', exact: true });
    await box.waitFor({ timeout: 15000 });
    if ((await box.isChecked()) !== to) await box.click();
    await page.getByText(`Goal map is ${to ? 'on' : 'off'} in`).first().waitFor({ timeout: 8000 });
  };

  if (MODE === 'in') {
    await page.goto(B + '/help'); await page.waitForTimeout(1000);
    check('on: Help has the Goal map article', (await page.locator('main').innerText()).includes('The goal map'));
    let l = await layouts();
    check('on: Goals’ Layout offers the Map', l.includes('Map'), l.join(', '));
    await page.goto(B + '/goals?scope=all&view=map');
    const drawn = await mapDrawn();
    check('on: /goals?view=map draws the Map from SQLite (126 goals, folded to the top goals and their critical path)', drawn > 0, `${drawn} nodes drawn`);
    await page.locator('.react-flow__node').first().click().catch(() => {});
    await page.keyboard.press('Delete'); await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    const after = (await amara('GET', `/api/workspaces/${WS}`)).json;
    check('on: Delete and Backspace on the Map remove nothing', after?.goals?.filter((g) => !g.removedAt).length === 126, `${after?.goals?.filter((g) => !g.removedAt).length} goals left`);

    await flip(false);
    const s = (await amara('GET', `/api/workspaces/${WS}`)).json;
    const w = (await amara('GET', '/api/workspaces')).json?.find((x) => x.id === WS);
    check('off: an admin switches it off in Workspace → Features; the server keeps it and logs it', (w?.modulesOff ?? []).includes('goal-map') && s?.changes?.some((c) => c.entity === 'workspace' && c.summary === 'Switched off Goal map'), JSON.stringify(w?.modulesOff ?? null));
    l = await layouts();
    check('off: Layout offers List, Table, Board and History only', l.join(',') === 'List,Table,Board,History', l.join(', '));
    const goalsText = await page.locator('main').innerText();
    check('off: nothing on Goals says Map', !/\bMap\b/.test(goalsText));
    let m = await openMap();
    check('off: /goals?view=map opens the List and says so once', m.nodes === 0 && m.says === 1 && !/view=map/.test(m.url), `${m.says}× said, ${m.nodes} nodes, ${m.url}`);
    await page.reload(); await page.waitForTimeout(1500);
    check('off: the address no longer asks for the Map, so a refresh says nothing more', !/view=map/.test(page.url()) && !(await page.locator('main').innerText()).includes(OFF));
    const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await other.goto(B + '/goals'); await other.fill('input[name=email]', 'rhea.kapoor@example.com'); await other.fill('input[name=password]', PASSWORD); await other.click('button[type=submit]');
    await other.waitForURL((u) => !/signin/.test(u.pathname), { timeout: 15000 });
    await other.goto(B + '/goals?scope=all&view=map'); await other.waitForTimeout(1500);
    check('off: for another member on a phone too, from the server’s switch', (await other.locator('.react-flow__node, .map-list').count()) === 0 && (await other.locator('main').innerText()).includes(OFF));
    await other.close();

    await flip(true);
    m = await openMap();
    check('back on: the same address opens the Map', m.nodes > 0 && m.says === 0, `${m.nodes} nodes`);
  } else {
    const l = await layouts();
    check('left out: Layout offers List, Table, Board and History only', l.join(',') === 'List,Table,Board,History', l.join(', '));
    const m = await openMap();
    check('left out: /goals?view=map opens the List, no Map drawn', m.nodes === 0 && !/view=map/.test(m.url), `${m.says}× said, ${m.url}`);
    await page.goto(B + '/workspace/features'); await page.waitForTimeout(1500);
    check('left out: Workspace → Features has no Goal map row', (await page.getByRole('checkbox', { name: 'Goal map', exact: true }).count()) === 0);
    await page.goto(B + '/help'); await page.waitForTimeout(1000);
    check('left out: Help has no Goal map article', !(await page.locator('main').innerText()).includes('The goal map'));
  }
  check('no page errors', errs.length === 0, errs.join(' | ').slice(0, 200));
} catch (e) {
  check('ran to the end', false, String(e).slice(0, 300));
} finally {
  await browser.close();
  server.kill();
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad} of ${results.length} passed (${MODE})`);
  process.exitCode = bad ? 1 : 0;
}
