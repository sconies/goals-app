// AI access's journeys (spec/modules/ai-access/journeys/U22, U62, U175), driven against this rebuild in a real browser at both widths.
// Each check throws when it fails; the process exits 1 when any journey fails. No results file is written.
// Checks a rebuild can't make here are listed in JOURNEYS.md as not built, never filtered out of a run.
// Usage: node modules/ai-access/journeys.mjs [U22 U62 U175]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = Number(process.env.JOURNEY_PORT || 47413);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (p, text, words, where = 'main, [role=dialog], dialog') => check(await p.locator(where).getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const state = async () => (await fetch(`${BASE}/api/state`)).json();
const inView = async (loc) => { const b = await loc.boundingBox(); const vh = loc.page().viewportSize().height; return !!b && b.y >= 0 && b.y + b.height <= vh - 56; };
const sha256 = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex');

const J = {
  async U22(p) {
    await p.goto(`${BASE}/?as=amara`);
    await p.goto(`${BASE}/workspace/ai`);
    check(/A token lets Claude or another AI tool act as one person here/.test(await p.locator('.access-tokens').innerText()), 'MCP tokens do not say what they are');
    // (the builder token's label is not checked: the demo has no builder token to seed; JOURNEYS.md)
    await p.getByRole('button', { name: 'Make a token' }).click();
    const dlg = p.getByRole('dialog');
    await dlg.getByRole('button', { name: /Who it acts as: .*Change/ }).click();
    await dlg.getByRole('searchbox').fill('Mateo');
    await dlg.getByRole('option', { name: /Mateo Fernández/ }).first().click();
    check(await dlg.getByRole('button', { name: 'Make the token' }).isDisabled(), 'a token can be made without saying what it is for');
    await dlg.getByLabel('What it’s for').fill('Claude on Mateo’s laptop');
    await dlg.getByRole('button', { name: 'Make the token' }).click();
    await shown(p, 'it isn’t shown again');
    const d2 = p.getByRole('dialog');
    const token = await d2.getByLabel('Token', { exact: true }).inputValue();
    check(/^gk_[A-Za-z0-9]{40}$/.test(token) && (await d2.getByLabel('Claude Code command').inputValue()).includes('/api/mcp'), 'the token or the connection command is missing');
    await d2.getByRole('button', { name: 'Done' }).click();
    // stored: one token for Mateo, only its hash (the MCP server finds it by its hash; the app never shows it)
    const r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
    check(/Mateo Fernández/.test((await r.json()).result.instructions), 'the token was not stored, or does not act as Mateo');
    await shown(p, 'not used yet');
    await p.waitForFunction(() => !document.getElementById('new-token'), null, { timeout: 2000 }).catch(() => {});
    check(!(await p.content()).includes(token), 'the token is still on the page after Done');
    await p.getByRole('button', { name: 'Revoke Claude on Mateo’s laptop' }).click();
    await shown(p, 'Revoked');
    const r2 = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
    check(r2.status === 401, 'the token was not revoked');
  },
  async U62(p) {
    await p.goto(`${BASE}/settings?as=rhea`);
    const tokens = await p.locator('.ai-block').innerText();
    check(await p.getByRole('button', { name: /^Make/ }).count() === 0 && /Your MCP tokens/.test(tokens), 'Settings offers to make a token, or has no “Your MCP tokens”');
    // (Your page, the recording line and Leave are the core Settings', not built in this rebuild: JOURNEYS.md)
    await p.goto(`${BASE}/workspace`);
    check(await p.getByRole('button', { name: 'Leave this workspace' }).count() === 0, 'Workspace still has Leave');
  },
  async U175(p, { phone }) {
    await p.goto(`${BASE}/?as=amara`);
    await p.goto(`${BASE}/workspace/ai`);
    await shown(p, 'The MCP tokens that let an AI tool act as someone here.', 'AI access is not its own Workspace section');
    await p.goto(`${BASE}/workspace/features`);
    const sw = p.getByRole('switch', { name: 'AI access' });
    check(await inView(sw), 'the “AI access” switch is not in view without scrolling');
    const beyond = await p.locator('.features-group').filter({ has: p.getByRole('heading', { name: 'Beyond this workspace' }) }).innerText();
    check(/AI access/.test(beyond), 'AI access is not under Beyond this workspace');
    await sw.click();
    await shown(p, 'AI access is off in');
    check(!(await p.locator('.readback').count()), 'with no token, switching AI access off still asked first');
    await p.goto(`${BASE}/workspace/access`);
    await shown(p, 'Who the admins are.');
    check(!/MCP token/.test(await p.locator('main').innerText()), 'Access still lists MCP tokens with AI access off');
    check(!(await p.locator('nav[aria-label=Workspace]').getByText('AI access').count()), 'Workspace’s menu still has AI access');
    await p.goto(`${BASE}/workspace/ai`);
    await shown(p, 'Page not found');
    await shown(p, 'AI access is switched off in', '/workspace/ai does not say AI access is switched off');
    await p.goto(`${BASE}/settings`);
    await shown(p, 'Settings');
    check(!/Your MCP tokens/.test(await p.locator('main').innerText()), 'Settings still has “Your MCP tokens” with AI access off');
    // (the inbox's Connect Claude is the Feedback module's, stage 5, not built here: JOURNEYS.md)
    const s = await state();
    check(s.changes.some((c) => c.entity === 'workspace' && c.actorId === 'amara' && c.summary === 'Switched off AI access'), 'switching AI access off was not logged');
    await p.goto(`${BASE}/workspace/features`);
    await p.getByRole('switch', { name: 'AI access' }).click();
    await shown(p, 'AI access is on in');
    await p.goto(`${BASE}/workspace/ai`);
    await shown(p, 'The MCP tokens that let an AI tool act as someone here.', 'AI access back on, its section is not back');
    const nav = await p.locator('nav[aria-label=Workspace]').innerText();
    check(/Access\s+AI access/.test(nav), 'the section is not back after Access');
    await p.goto(`${BASE}/settings`);
    await shown(p, 'Your MCP tokens', 'AI access back on, Settings has no “Your MCP tokens”');
  },
};

async function main() {
  const only = process.argv.slice(2);
  const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => server.stdout.once('data', r));
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const [id, run] of Object.entries(J)) {
      if (only.length && !only.includes(id)) continue;
      for (const [width, vp] of Object.entries(WIDTHS)) {
        await reset();
        const context = await browser.newContext({ viewport: vp });
        const p = await context.newPage();
        p.setDefaultTimeout(6000);
        try { await run(p, { phone: width === 'phone' }); console.log(`PASS ${id} ${width}`); }
        catch (e) { failed++; console.log(`FAIL ${id} ${width}: ${e instanceof CheckFailed ? e.message : e.message.split('\n')[0]} (at ${p.url()})`); }
        await context.close();
      }
    }
  } finally { await browser.close(); server.kill(); }
  console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
  process.exit(failed ? 1 : 0);
}
main();
