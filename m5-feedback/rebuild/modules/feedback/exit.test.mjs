// Stage 5's exit criteria (spec/rebuild/stage-5-module-feedback.md), one test per criterion, each run with the module on,
// switched off (Workspace.modulesOff, by an admin), and, where it says something, left out of the build (FARO_WITHOUT).
// Usage: node --test modules/feedback/exit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const WS = 'Platform Engineering';
const TOOLS = ['list_markups', 'get_markup', 'review_inbox', 'update_markup', 'list_feedback', 'get_feedback', 'update_feedback', 'send_feedback'];
const PAGE_OFF = `Feedback is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const SEND_OFF = `Feedback is off in ${WS}.`;
const toolOff = (t) => `Feedback is switched off in ${WS}, so ${t} can’t be used there. An admin can switch it on in Workspace, under Features.`;
let nextPort = 47200;

async function app(env = {}) {
  const port = nextPort++;
  const s = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, FARO_TEST: '1', ...env } });
  const up = await new Promise((r) => { s.stdout.once('data', () => r(true)); s.once('exit', () => r(false)); setTimeout(() => r(false), 15000); });
  assert.ok(up, 'the app did not start');
  const base = `http://localhost:${port}`;
  const A = {
    base, stop: () => s.kill(),
    get: async (p, as = 'amara') => { const r = await fetch(base + p, { headers: { cookie: `as=${as}` }, redirect: 'manual' }); return { status: r.status, location: r.headers.get('location'), text: await r.text() }; },
    post: async (p, body, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded', referer: base + '/' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, location: r.headers.get('location'), text: await r.text() }; },
    json: async (p, body, as = 'amara') => { const r = await fetch(base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; },
    state: async () => (await fetch(`${base}/api/state`)).json(),
    kept: async () => (await fetch(`${base}/m/feedback/kept`)).json(),
    seed: (items) => fetch(`${base}/m/feedback/seed`, { method: 'POST', body: JSON.stringify({ items }) }),
    off: (on = false) => A.post('/act/setFeature', { id: 'feedback', on: String(on) }),
    rpc: async (method, params, as = 'amara') => { const tokens = (await A.state()).tokens; const r = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[as]}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); return (await r.json()).result; },
    tool: async (name, args = {}, as = 'amara') => A.rpc('tools/call', { name, arguments: args }, as),
  };
  return A;
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const aMarkup = (line = 'The scorecard should say which way is better') => ({ line, mood: 'meh', address: '/goals/ns-lead', origin: 'http://localhost', strokes: [{ kind: 'box', x: 1, y: 1, w: 20, h: 20 }, { kind: 'note', x: 5, y: 5, n: 1, text: 'This one' }], parts: [[['Goal page', 'Summary bar', 'Scorecard']], [['Goal page']]], steps: [{ kind: 'page', path: '/goals/ns-lead' }], errors: [], context: { viewport: { w: 1440, h: 900 }, theme: 'light', accent: '#1f4e5f', version: '1.0.0' }, pics: { 'screen.png': PNG, 'ink.png': PNG, 'marked.jpg': JPG, 'thumb.jpg': JPG } });
const lastGroup = async (p, phone) => {
  if (!phone) return (await p.locator('nav.sidebar ul').last().locator('a').allInnerTexts()).map((x) => x.trim());
  await p.locator('nav.tabbar details.more summary').click();
  const out = (await p.locator('nav.tabbar .more-sheet ul').last().locator('a').allInnerTexts()).map((x) => x.trim());
  await p.locator('nav.tabbar details.more summary').click();
  return out;
};
const run = (args, env = {}) => new Promise((r) => { const c = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } }); let out = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d)); c.on('exit', (code) => r({ code, out })); });

test('1. Its requirements hold: MARKUP, FEEDBACK-RAISED, MARKUP-INBOX, FEEDBACK-INBOX, MCP-FEEDBACK, CONNECT-CLAUDE, MCP-PICTURES, INBOX-TRIAGE, FEEDBACK-PAGE, FEEDBACK-OPTIONAL', async (t) => {
  const A = await app();
  try {
    await t.test('on: MARKUP: a markup is kept with its pictures, vectors, parts, route, steps and context; the id is issued here; pictures are read by address and never listed', async () => {
      assert.equal((await A.json('/m/feedback/markup', { ...aMarkup(), line: ' ' })).body.error, 'Say what should change first.');
      const r = await A.json('/m/feedback/markup', { ...aMarkup(), id: 'mk_mine' }, 'rhea');
      assert.match(r.body.id, /^mk_/); assert.notEqual(r.body.id, 'mk_mine');
      assert.equal(r.body.message, 'Sent. You’ll hear when it’s fixed.');
      const k = (await A.kept()).markups[0];
      assert.equal(k.route, '/goals/:goalId'); assert.equal(k.goalId, 'ns-lead'); assert.equal(k.demo, true); assert.equal(k.personId, 'rhea');
      assert.deepEqual(k.pics.sort(), ['ink.png', 'marked.jpg', 'screen.png', 'thumb.jpg']);
      assert.equal(k.strokes[1].text, 'This one'); assert.ok(k.parts[0][0].includes('Scorecard')); assert.equal(k.context.viewport.w, 1440);
      assert.equal((await A.get(`/m/feedback/pic/${k.id}/screen.png`)).status, 200);
      assert.equal((await A.get('/m/feedback/pic/')).status, 404);
    });
    await t.test('on: MARKUP-INBOX and FEEDBACK-INBOX: both are listed, newest first, status a shape and a word, open to anyone; a change is recorded as the person and undone', async () => {
      await A.json('/m/feedback/send', { mood: 'bad', text: 'The reason box is too small', path: '/check-in' }, 'chen');
      assert.equal((await A.json('/m/feedback/send', { mood: 'cross', text: 'x', path: '/' })).body.error, 'Mood is good, meh or bad.');
      const page = await A.get('/feedback', 'oskar');
      assert.equal(page.status, 200);
      const rows = [...page.text.matchAll(/class="ibx-row"[\s\S]*?<\/li>/g)].map((m) => m[0]);
      assert.equal(rows.length, 2);
      assert.match(rows[0], /fb-item">The reason box is too small/); assert.match(rows[0], /class="shape"[\s\S]*mk-status">New</);
      assert.match(rows[1], /mk-item">The scorecard should say/); assert.match(rows[1], /the demo/);
      const k = await A.kept();
      const r = await A.post('/m/feedback/triage', { ids: k.markups[0].id, status: 'in-hand', back: '/feedback' });
      assert.equal(r.status, 303);
      const after = await A.kept();
      assert.equal(after.markups[0].status, 'in-hand'); assert.equal(after.markups[0].status_by, 'Amara Nwosu');
      assert.match((await A.get(r.location)).text, /Marked in hand: “The scorecard should say/);
      await A.post('/m/feedback/undo', { back: '/feedback' });
      assert.equal((await A.kept()).markups[0].status, 'new');
      await A.post('/m/feedback/triage', { ids: k.feedback[0].id, status: 'wont-fix', reason: '', back: '/feedback' });
      assert.equal((await A.kept()).feedback[0].status, 'new', 'won’t fix needs a reason');
    });
    await t.test('on: INBOX-TRIAGE: tabs with counts, 25 rows a page, folded rows, only an admin changes a status', async () => {
      const items = Array.from({ length: 40 }, (_, i) => ({ kind: 'markup', id: `mk_s${i}`, line: `Line ${i}`, route: i < 6 ? '/' : `/p${i}`, address: '/', pageName: 'Home', parts: [[['Home', i < 6 ? 'Week strip' : `Part ${i}`]]], personName: 'Jun Park', workspaceName: 'Acme', at: new Date(Date.now() - i * 60000).toISOString() }));
      await A.seed(items);
      const page = (await A.get('/feedback')).text;
      assert.match(page, /New <span class="n">42<\/span>/);
      assert.equal([...page.matchAll(/class="ibx-row"/g)].length, 25);
      assert.match(page, /1–25 of 37/); assert.match(page, /6 on this part/);
      const member = await A.post('/m/feedback/triage', { ids: 'mk_s7', status: 'in-hand', back: '/feedback' }, 'rhea');
      assert.equal(new URL(member.location, 'http://x').searchParams.get('error'), 'Only an admin can change the status of feedback.');
      assert.match((await A.get('/feedback?markup=mk_s7', 'rhea')).text, /Only an admin can change the status of feedback\./);
      const key = /data-row="([^"]+)"[^>]*>(?:(?!<\/li>)[\s\S])*?Line 7</.exec(page)[1];
      const bulk = await A.post('/m/feedback/bulk', { sel: key, status: 'fixed', fixedIn: 'next-release', back: '/feedback' });
      assert.equal(bulk.status, 303); assert.equal((await A.kept()).markups.find((m) => m.id === 'mk_s7').status, 'fixed');
    });
    await t.test('on: MCP-FEEDBACK and MCP-PICTURES: the eight tools, pictures as image content, review_inbox as a tool and a prompt', async () => {
      const list = await A.rpc('tools/list', {});
      for (const n of TOOLS) assert.ok(list.tools.some((x) => x.name === n), n);
      const fb = await A.tool('list_feedback', { status: 'new' }, 'rhea');
      assert.equal(fb.isError, false); assert.match(fb.content[0].text, /The reason box is too small/);
      const id = fb.structuredContent.feedback[0].id;
      assert.match((await A.tool('update_feedback', { id, status: 'in-hand' }, 'rhea')).content[0].text, /This token acts as Rhea Kapoor, who isn’t an admin\./);
      assert.equal((await A.tool('update_feedback', { id, status: 'fixed' })).isError, true);
      const up = await A.tool('update_feedback', { id, status: 'fixed', fixed_in: 'wn-42' });
      assert.match(up.content[0].text, /Fixed, marked by Amara Nwosu via the AI assistant/);
      const mk = (await A.kept()).markups.find((m) => m.pics.length);
      const g = await A.tool('get_markup', { id: mk.id });
      assert.equal(g.content[1].type, 'image'); assert.equal(g.content[1].mimeType, 'image/jpeg');
      assert.equal((await A.tool('get_markup', { id: mk.id, picture: 'none' })).content.length, 1);
      assert.equal((await A.tool('update_markup', { id: mk.id })).content[0].text, 'Give a status, an issue_url, or both.');
      const rv = await A.tool('review_inbox', {});
      assert.match(rv.content[0].text, /Week strip \(6\)/); assert.ok(rv.content.some((c) => c.type === 'image'));
      assert.ok((await A.rpc('prompts/list', {})).prompts.some((x) => x.name === 'review_inbox'));
      assert.match((await A.tool('send_feedback', { mood: 'good', text: 'Quick to post' }, 'chen')).content[0].text, /^Sent/);
    });
    await t.test('on: CONNECT-CLAUDE: at the top of the inbox, the set-up and whether pictures can be sent', async () => {
      const page = (await A.get('/feedback')).text;
      assert.ok(page.indexOf('class="connect"') < page.indexOf('class="ibx-list"'));
      assert.match(page, /Claude Code command/); assert.match(page, /\/api\/mcp --header &quot;Authorization: Bearer gk_/);
      assert.match(page, /any token from it reads the demo’s markups too/); assert.match(page, /Pictures for Claude: ready/);
      const chk = await (await fetch(`${A.base}/api/mcp?check`)).json();
      assert.equal(chk.pictures, true); assert.equal(chk.ok, true);
    });
    await t.test('on: FEEDBACK-PAGE: its own page, beside Help, from every workspace and the demo; old addresses lead there; names, never emails', async () => {
      const page = await A.get('/feedback');
      assert.match(page.text, /<h1>Feedback<\/h1><p class="ibx-sub">From every workspace and the demo/);
      assert.doesNotMatch(page.text, /@[a-z]+\.[a-z]/);
      assert.equal((await A.get('/workspace/inbox')).location, '/feedback');
      assert.equal((await A.get('/inbox')).location, '/feedback');
      assert.equal((await A.get('/workspace?inbox=1&markup=mk_old')).location, '/feedback?markup=mk_old');
      const items = [...(await A.get('/')).text.matchAll(/data-item="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(items.indexOf('feedback'), items.indexOf('help') + 1);
      assert.match((await A.get('/help')).text, /The inbox/);
    });
    await t.test('on: FEEDBACK-RAISED (part): a fixed item names its What’s new entry and its sender, so What’s new can say “You raised this”', async () => {
      const f = (await A.kept()).feedback.find((x) => x.status === 'fixed');
      assert.equal(f.fixed_in, 'wn-42'); assert.equal(f.personId, 'chen');
    });
    await t.test('off: FEEDBACK-OPTIONAL: the page, the sheet, the key and the tools go; what was sent stays', async () => {
      const before = await A.kept();
      await A.off();
      assert.equal((await A.get('/feedback')).status, 404);
      assert.doesNotMatch((await A.get('/')).text, /feedback\.js/);
      assert.deepEqual(await A.kept(), before);
      await A.off(true);
    });
  } finally { A.stop(); }
  await t.test('left out: none of it is there, and Features shows no switch for it', async () => {
    const B = await app({ FARO_WITHOUT: 'feedback' });
    try {
      assert.equal((await B.get('/feedback')).status, 404);
      assert.doesNotMatch((await B.get('/feedback')).text, /switched off/);
      assert.doesNotMatch((await B.get('/workspace/features')).text, /aria-label="Feedback"/);
      const list = await B.rpc('tools/list', {});
      assert.ok(!list.tools.some((x) => TOOLS.includes(x.name)));
    } finally { B.stop(); }
  });
});

test('2. Its journeys and checks can be done: U40, U41, U42, U47, U51, U52, U53, U165, N22', { timeout: 900000 }, async (t) => {
  await t.test('on: every journey, at both widths, passes in a real browser', async () => {
    const r = await run([path.join(here, 'journeys.mjs')], { JOURNEY_PORT: '47190' });
    assert.equal(r.code, 0, r.out.split('\n').filter((l) => l.startsWith('FAIL')).join('\n'));
    assert.match(r.out, /Every journey run passed\./);
  });
  await t.test('off: N22: no menu row, button or Help article of its own, and each comes back on', async () => {
    const A = await app();
    try {
      await A.off();
      const home = (await A.get('/')).text;
      assert.doesNotMatch(home, /data-item="feedback"/); assert.doesNotMatch(home, /data-fb-sheet|feedback\.js/);
      const help = (await A.get('/help')).text;
      assert.doesNotMatch(help, /Send feedback, and marking up a screen|>The inbox</);
      assert.match((await A.get('/help/inbox')).text, new RegExp(PAGE_OFF));
      assert.match((await A.tool('get_help', { article: 'feedback' })).content[0].text, /Feedback is switched off in Platform Engineering, so its Help isn’t shown there\./);
      await A.off(true);
      assert.match((await A.get('/')).text, /data-item="feedback"/);
      assert.match((await A.get('/help')).text, /The inbox/);
    } finally { A.stop(); }
  });
});

test('3. Switched off, the menu’s last group is Workspace, Settings, Help (desktop and More on a phone), and Ctrl+Shift+M opens nothing', { timeout: 120000 }, async (t) => {
  const browser = await chromium.launch();
  const A = await app();
  const B = await app({ FARO_WITHOUT: 'feedback' });
  try {
    for (const [mode, X] of [['on', A], ['off', A], ['left out', B]]) {
      if (mode === 'off') await A.off();
      await t.test(mode, async () => {
        for (const phone of [false, true]) {
          const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
          const p = await ctx.newPage();
          await p.goto(`${X.base}/goals/ns-lead?as=rhea`);
          const g = await lastGroup(p, phone);
          assert.deepEqual(g, mode === 'on' ? ['Workspace', 'Settings', 'Help', 'Feedback'] : ['Workspace', 'Settings', 'Help'], `${phone ? 'phone' : 'desktop'}: ${g}`);
          await p.keyboard.press('Control+Shift+M');
          const opened = await p.locator('.markup-root').waitFor({ timeout: mode === 'on' ? 5000 : 1200 }).then(() => true, () => false);
          assert.equal(opened, mode === 'on', `Ctrl+Shift+M ${opened ? 'opened' : 'did not open'} a markup`);
          await ctx.close();
        }
      });
    }
  } finally { await browser.close(); A.stop(); B.stop(); }
});

test('4. Switched off, /feedback, /workspace/inbox and /inbox show Page not found with the sentence, and the eight tools answer the switched-off sentence', async (t) => {
  const A = await app();
  try {
    await t.test('on', async () => {
      assert.equal((await A.get('/feedback')).status, 200);
      for (const n of TOOLS) { const r = await A.tool(n, n === 'send_feedback' ? { mood: 'good', text: 'Fine' } : n.startsWith('get') || n.startsWith('update') ? { id: 'none' } : {}); assert.notEqual(r.content[0].text, toolOff(n), n); }
    });
    await A.off();
    await t.test('off', async () => {
      for (const a of ['/feedback', '/workspace/inbox', '/inbox']) {
        const r = await A.get(a);
        assert.equal(r.status, 404, a); assert.match(r.text, /Page not found/, a); assert.ok(r.text.includes(PAGE_OFF), a);
      }
      const list = await A.rpc('tools/list', {});
      for (const n of TOOLS) {
        assert.ok(list.tools.some((x) => x.name === n), `${n} is still listed`);
        const r = await A.tool(n, {});
        assert.equal(r.isError, true, n); assert.equal(r.content[0].text, toolOff(n), n);
      }
      const st = await A.state();
      assert.ok(st.changes.some((c) => c.entity === 'workspace' && c.summary === 'Switched off Feedback'));
    });
  } finally { A.stop(); }
});

test('5. Switched off, sending feedback refuses with “Feedback is off in {workspace}.”; what was sent stays; switching it back on brings the row, the page and the key back', { timeout: 120000 }, async (t) => {
  const A = await app();
  const browser = await chromium.launch();
  try {
    await t.test('on: sending works', async () => {
      assert.equal((await A.json('/m/feedback/send', { mood: 'good', text: 'Sent while on', path: '/' })).status, 200);
      assert.equal((await A.json('/m/feedback/markup', aMarkup('Marked up while on'))).status, 200);
    });
    const before = await A.kept();
    await A.off();
    await t.test('off: both refuse in the core action’s words; the tool in its own; nothing sent is lost', async () => {
      const f = await A.json('/m/feedback/send', { mood: 'good', text: 'Sent while off', path: '/' });
      assert.equal(f.status, 403); assert.equal(f.body.error, SEND_OFF);
      const m = await A.json('/m/feedback/markup', aMarkup('Marked up while off'));
      assert.equal(m.status, 403); assert.equal(m.body.error, SEND_OFF);
      assert.equal((await A.tool('send_feedback', { mood: 'good', text: 'x' })).content[0].text, toolOff('send_feedback'));
      assert.deepEqual(await A.kept(), before);
    });
    await A.off(true);
    await t.test('back on: the row, the page and the key, and everything sent before', async () => {
      assert.match((await A.get('/')).text, /data-item="feedback"/);
      const page = await A.get('/feedback');
      assert.equal(page.status, 200); assert.match(page.text, /Sent while on/); assert.match(page.text, /Marked up while on/);
      const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      await p.goto(`${A.base}/`);
      await p.keyboard.press('Control+Shift+M');
      assert.ok(await p.locator('.markup-root').waitFor({ timeout: 5000 }).then(() => true, () => false), 'the key did not come back');
    });
  } finally { await browser.close(); A.stop(); }
});
