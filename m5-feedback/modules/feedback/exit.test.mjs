// Stage 5's exit criteria (spec/rebuild/stage-5-module-feedback.md), one test per criterion, each run with Feedback on and off.
// node --test modules/feedback/exit.test.mjs        (from rebuild/; starts its own app on :4195; criterion 2 also drives the journeys on :4196)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const PORT = 4195, B = `http://localhost:${PORT}`, WS = 'Platform Engineering';
const OFF_PAGE = `Feedback is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const OFF_SEND = `Feedback is off in ${WS}.`;
const offTool = (t) => `Feedback is switched off in ${WS}, so ${t} can’t be used there. An admin can switch it on in Workspace, under Features.`;
const TOOLS = ['list_markups', 'get_markup', 'review_inbox', 'update_markup', 'list_feedback', 'get_feedback', 'update_feedback', 'send_feedback'];
let srv;

const get = (p, as = 'rhea') => fetch(`${B}${p}${p.includes('?') ? '&' : '?'}as=${as}`, { redirect: 'manual' });
const html = async (p, as) => (await get(p, as)).text();
const postForm = (p, o, as = 'rhea') => fetch(`${B}${p}?as=${as}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
const postJson = (p, o, as = 'rhea') => fetch(`${B}${p}?as=${as}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const dump = async () => (await fetch(`${B}/__inbox/dump`, { method: 'POST' })).json();
const tool = async (name, args = {}, as = 'amara') => (await (await fetch(`${B}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${as}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })).json()).result;
const toolText = (r) => r.content.find((c) => c.type === 'text').text;
const setOn = async (on) => { const r = await postForm('/workspace/features', { feature: 'feedback', on: on ? 'on' : 'off' }, 'amara'); assert.equal(r.status, 303); };
const fresh = async () => { await fetch(`${B}/__reset`, { method: 'POST' }); await fetch(`${B}/__inbox/reset`, { method: 'POST' }); };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
const markup = (o = {}) => ({ line: 'The week strip should say the week', mood: 'meh', screen: svg, ink: svg, marked: svg, strokes: [{ kind: 'box', points: [[1, 1], [5, 5]], parts: ['Your goals'] }], pins: [{ n: 1, at: [3, 3], text: 'here', parts: ['Your goals'] }], parts: ['Your goals'], route: '/', viewport: { w: 1440, h: 900 }, theme: 'light', accent: '#1d6f6a', version: 'rebuild', steps: [{ kind: 'page', path: '/' }], errors: [], from: 'http://localhost', ...o });
const lastGroup = (h) => [...(h.match(/aria-label="This workspace and you">([\s\S]*?)<\/ul>/) || ['', ''])[1].matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);

before(async () => {
  srv = spawn(process.execPath, [path.join(root, 'app/server.mjs'), String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => srv.stdout.once('data', r));
});
after(() => srv.kill());

for (const on of [true, false]) {
  const state = on ? 'on' : 'off';

  test(`criterion 1 (${state}): its requirements hold`, async () => {
    await fresh();
    // Sent while on: kept in the builders' inbox whichever way it is switched after.
    const mk = await (await postJson('/feedback/markup', markup())).json();
    assert.match(mk.id, /^mk_[0-9a-f]{16}$/, 'MARKUP: an id the server issued');
    assert.equal(mk.said, 'Sent. You’ll hear when it’s fixed.');
    assert.equal((await (await postJson('/feedback/markup', markup({ line: ' ' }))).json()).error, 'Say what should change first', 'MARKUP: the line is required');
    assert.equal((await postForm('/feedback/send', { mood: 'bad', text: 'The causes didn’t fit my week.', path: '/check-in' }, 'chen')).status, 303);
    assert.equal((await postForm('/feedback/send', { mood: 'cross', text: 'x', path: '/' })).headers.get('location').includes(encodeURIComponent('Mood is good, meh or bad.')), true, 'sendFeedback refuses a bad mood');
    const d0 = await dump();
    const fb = d0.items.find((x) => x.kind === 'feedback');
    assert.equal(fb.status, 'new', 'FEEDBACK-INBOX: feedback arrives New');
    if (on) {
      // MARKUP: the client script holds the shortcut and the toolbar; pictures by address only.
      const home = await html('/');
      for (const w of ['e.ctrlKey || e.metaKey) && e.shiftKey', "'Pen'", "'Arrow'", "'Box'", "'Note'", "'Undo'", "'Clear'", "'Cancel'", "'Next'", 'Include my last 20 steps on this visit', "'Escape'"]) assert.ok(home.includes(w), `MARKUP: ${w}`);
      assert.equal((await get(`/feedback/pictures/${mk.id}/screen.svg`)).status, 200);
      assert.equal((await get(`/feedback/pictures/${mk.id}/marked.svg`)).headers.get('content-type'), 'image/svg+xml');
      assert.equal((await get('/feedback/pictures/')).status, 404, 'MARKUP: nobody can list pictures');
      assert.equal((await get(`/feedback/pictures/${mk.id}/`)).status, 404);
      // MARKUP-INBOX / FEEDBACK-INBOX / FEEDBACK-PAGE: open to anyone, shape and word, who and where, never an email.
      const page = await html('/feedback', 'rhea');
      assert.ok(page.includes('From every workspace and the demo'));
      assert.ok(/class="mk-st"><svg[^>]*class="shape"[\s\S]*?<span>New<\/span>/.test(page), 'status is a shape and a word');
      assert.ok(page.includes('Rhea Kapoor') && page.includes('Chen Wei') && page.includes(WS));
      assert.ok(!/@/.test(page.replace(/<script>[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>/g, '').replace(/@media/g, '')), 'names people, never their email');
      assert.ok(page.includes('Only an admin can change the status of feedback.'), 'INBOX-TRIAGE: a member is told who changes a status');
      // INBOX-TRIAGE: only an admin changes a status, through the one rule; Undo puts it back.
      let r = await postForm('/feedback/triage', { id: mk.id, status: 'in-hand', back: '/feedback' }, 'rhea');
      assert.equal((await dump()).items.find((x) => x.id === mk.id).status, 'new', 'a member is refused');
      r = await postForm('/feedback/triage', { id: mk.id, status: 'in-hand', back: '/feedback' }, 'amara');
      assert.equal(r.status, 303);
      let m = (await dump()).items.find((x) => x.id === mk.id);
      assert.equal(m.status, 'in-hand'); assert.equal(m.statusBy, 'amara');
      assert.ok((await html(`/feedback?tab=in-hand&open=${mk.id}`, 'amara')).includes('Marked in hand by Amara Nwosu'));
      await postForm('/feedback/undo', { back: '/feedback' }, 'amara');
      assert.equal((await dump()).items.find((x) => x.id === mk.id).status, 'new', 'Undo puts back the status it replaced');
      await postForm('/feedback/triage', { id: mk.id, status: 'wont-fix', reason: '', back: '/feedback' }, 'amara');
      assert.equal((await dump()).items.find((x) => x.id === mk.id).status, 'new', 'won’t fix needs a reason');
      await postForm('/feedback/triage', { id: mk.id, keep: '1', issueUrl: 'https://github.com/sconies/goals-app/issues/101', back: '/feedback' }, 'amara');
      assert.equal((await dump()).items.find((x) => x.id === mk.id).issueUrl, 'https://github.com/sconies/goals-app/issues/101');
      // MCP-FEEDBACK: list, open and change feedback as the token's person, via the assistant; an unknown token is refused.
      const lf = JSON.parse(toolText(await tool('list_feedback', { status: 'new' })));
      assert.equal(lf.length, 1); assert.equal(lf[0].statusWord, 'New');
      assert.ok(toolText(await tool('get_feedback', { id: fb.id })).includes('The causes didn’t fit my week.'));
      assert.equal(toolText(await tool('update_feedback', { id: fb.id, status: 'fixed' })), 'Say which What’s new entry fixed it.');
      assert.equal(toolText(await tool('update_feedback', { id: fb.id, status: 'in-hand' }, 'rhea')), 'Only an admin can change the status of feedback.');
      assert.ok(toolText(await tool('update_feedback', { id: fb.id, status: 'fixed', fixedIn: 'rebuild-1' })).includes('Marked fixed'));
      const fb2 = (await dump()).items.find((x) => x.id === fb.id);
      assert.equal(fb2.statusBy, 'amara'); assert.equal(fb2.statusVia, 'via the AI assistant');
      const bad = await fetch(`${B}/api/mcp`, { method: 'POST', headers: { authorization: 'Bearer nobody' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_feedback' } }) });
      assert.equal(bad.status, 401);
      // FEEDBACK-RAISED: “You raised this” to the sender only.
      assert.ok((await html('/whats-new', 'chen')).includes('You raised this'));
      assert.ok(!(await html('/whats-new', 'rhea')).includes('You raised this'));
      // MCP-PICTURES: the picture comes back as image content; review_inbox groups by part with the newest's picture.
      const gm = await tool('get_markup', { id: mk.id });
      assert.ok(gm.content.some((c) => c.type === 'image' && c.data.length > 0));
      const ri = await tool('review_inbox');
      assert.equal(JSON.parse(toolText(ri)).markups[0].count, 1);
      assert.ok(ri.content.some((c) => c.type === 'image'));
      assert.equal((await tool('list_markups', { status: 'new' })).content.length, 1);
      assert.ok(toolText(await tool('update_markup', { id: mk.id, status: 'wont-fix', reason: 'Seen it.' })).includes('Marked won’t fix'));
      assert.ok(toolText(await tool('send_feedback', { mood: 'good', text: 'Nice', path: '/' }, 'rhea')).includes('Sent'));
      // CONNECT-CLAUDE: at the top of the inbox, with the set-up and whether pictures can be sent.
      assert.ok(page.indexOf('Connect Claude') < page.indexOf('role="tablist"'));
      assert.ok(page.includes('/api/mcp') && page.includes('claude mcp add') && page.includes('any token from it reads the demo’s markups too'));
      assert.equal((await (await fetch(`${B}/api/mcp?check`)).json()).pictures, true);
      // FEEDBACK-PAGE: old addresses lead there; Feedback follows Help in the menu.
      assert.equal((await get('/workspace/inbox')).headers.get('location').split('?')[0], '/feedback');
      assert.equal((await get('/inbox')).headers.get('location').split('?')[0], '/feedback');
      assert.equal((await get('/workspace?inbox=1&markup=mk_old')).headers.get('location'), '/feedback?markup=mk_old');
      assert.deepEqual(lastGroup(await html('/')), ['Workspace', 'Settings', 'Help', 'Feedback']);
    } else {
      // FEEDBACK-OPTIONAL: off, no menu row, no key, no page, no tools; what was sent stays.
      await setOn(false);
      assert.deepEqual(lastGroup(await html('/')), ['Workspace', 'Settings', 'Help']);
      assert.ok(!(await html('/')).includes('faro-steps'), 'no markup script while off');
      assert.equal((await get('/feedback')).status, 404);
      assert.ok(toolText(await tool('list_feedback')).startsWith('Feedback is switched off'));
      assert.equal((await dump()).items.length, 2, 'what was sent stays in the builders’ inbox');
      assert.equal((await get('/help/feedback')).status, 404, 'its Help leaves while it is off');
      assert.ok(!(await html('/help')).includes('The inbox'));
      await setOn(true);
    }
  });

  test(`criterion 2 (${state}): its journeys and checks can be done`, async () => {
    await fresh();
    if (!on) {
      await setOn(false);
      for (const p of ['/feedback', '/workspace/inbox', '/inbox']) assert.equal((await get(p)).status, 404, `${p}: the journeys can’t be done while off`);
      await setOn(true);
      return;
    }
    const r = await new Promise((ok) => { const c = spawn(process.execPath, [path.join(here, 'journeys.cjs')], { cwd: root, env: { ...process.env, FARO_PORT: '4196' } }); let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; }); c.on('close', (code) => ok({ code, stdout: out })); });
    const res = JSON.parse(fs.readFileSync(path.join(here, 'journeys-results.json'), 'utf8'));
    for (const id of ['U41', 'U42', 'U47', 'U52']) assert.equal(res[id].tally, 'DONE', `${id}: ${JSON.stringify(res[id])}\n${r.stdout}`);
    // U40, U51, U53 and U165 also need core or Goal-map parts that aren't built; their Feedback lines must pass.
    for (const id of ['U40', 'U51', 'U53', 'U165']) assert.deepEqual([...res[id].phone.fails, ...res[id].desktop.fails], [], id);
    // N22's Feedback lines: no menu row or Help article while off, and each back on.
    await setOn(false);
    assert.ok(!lastGroup(await html('/')).includes('Feedback'));
    assert.ok(!(await html('/help')).includes('Send feedback, and marking up a screen'));
    await setOn(true);
    assert.ok(lastGroup(await html('/')).includes('Feedback'));
    assert.ok((await html('/help')).includes('Send feedback, and marking up a screen'));
  });

  test(`criterion 3 (${state}): the menu's last group, and Ctrl+Shift+M`, async () => {
    await fresh();
    if (!on) await setOn(false);
    const want = on ? ['Workspace', 'Settings', 'Help', 'Feedback'] : ['Workspace', 'Settings', 'Help'];
    assert.deepEqual(lastGroup(await html('/')), want, 'desktop');
    const more = await html('/more');
    assert.equal(more.includes('href="/feedback"'), on, 'More on a phone');
    const { chromium } = createRequire(import.meta.url)('playwright');
    const b = await chromium.launch();
    try {
      for (const [w, h] of [[1440, 900], [390, 844]]) {
        const ctx = await b.newContext({ viewport: { width: w, height: h } });
        const p = await ctx.newPage();
        await p.goto(`${B}/?as=rhea`);
        await p.keyboard.press('Control+Shift+M');
        await p.waitForTimeout(500);
        assert.equal(await p.locator('.markup-root').count(), on ? 1 : 0, `Ctrl+Shift+M at ${w}px`);
        await ctx.close();
      }
    } finally { await b.close(); }
    if (!on) await setOn(true);
  });

  test(`criterion 4 (${state}): its addresses and its eight tools`, async () => {
    await fresh();
    if (!on) await setOn(false);
    for (const p of ['/feedback', '/workspace/inbox', '/inbox']) {
      const r = await get(p);
      if (on) { assert.notEqual(r.status, 404, p); continue; }
      assert.equal(r.status, 404, p);
      const t = await r.text();
      assert.ok(t.includes('<h1>Page not found</h1>') && t.includes(OFF_PAGE), p);
      assert.ok(t.includes('<title>Page not found ·'), `${p}: its name is Page not found`);
    }
    for (const t of TOOLS) {
      const r = await tool(t, t === 'send_feedback' ? { mood: 'good', text: 'x' } : t.startsWith('get_') || t.startsWith('update_') ? { id: 'mk_0000000000000000', status: 'in-hand' } : {});
      if (on) assert.ok(!toolText(r).startsWith('Feedback is switched off'), t);
      else { assert.equal(r.isError, true, t); assert.equal(toolText(r), offTool(t)); }
    }
    if (!on) await setOn(true);
  });

  test(`criterion 5 (${state}): sending refuses while off; what was sent stays; back on brings it back`, async () => {
    await fresh();
    await postForm('/feedback/send', { mood: 'good', text: 'Sent before', path: '/' });
    await postJson('/feedback/markup', markup({ line: 'Marked before' }));
    if (on) {
      assert.equal((await postForm('/feedback/send', { mood: 'good', text: 'More', path: '/' })).status, 303);
      assert.equal((await dump()).items.length, 3);
      return;
    }
    await setOn(false);
    const r1 = await postForm('/feedback/send', { mood: 'good', text: 'While off', path: '/' });
    assert.equal(r1.status, 403); assert.ok((await r1.text()).includes(OFF_SEND));
    const r2 = await postJson('/feedback/markup', markup({ line: 'While off' }));
    assert.equal(r2.status, 403); assert.equal((await r2.json()).error, OFF_SEND);
    assert.equal(toolText(await tool('send_feedback', { mood: 'good', text: 'x' })), offTool('send_feedback'));
    const d = await dump();
    assert.equal(d.items.length, 2, 'what was sent before stays in the builders’ inbox');
    assert.ok(!d.items.some((x) => (x.text || x.line) === 'While off'));
    assert.ok((await html('/activity', 'amara')).includes('switched Feedback off'), 'the switch is logged');
    await setOn(true);
    assert.deepEqual(lastGroup(await html('/')), ['Workspace', 'Settings', 'Help', 'Feedback'], 'the row is back');
    const page = await html('/feedback');
    assert.ok(page.includes('Sent before') && page.includes('Marked before'), 'the page is back, with what was sent');
    assert.ok((await html('/')).includes('faro-steps'), 'the key is back');
  });
}
