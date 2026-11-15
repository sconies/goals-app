// AI access's journeys (spec/modules/ai-access/journeys/U22, U62, U175), on a phone and a desktop, against a running app.
// node modules/ai-access/journeys.cjs [base] [ids…]     (default base http://localhost:4173)
const { chromium } = require('playwright');
const WIDTHS = [['phone', 390, 844], ['desktop', 1440, 900]];

function J(base, b, width) {
  const [name, w, h] = width;
  const j = { width: name, steps: 0, fails: [], parts: [], passes: 0 };
  j.open = async (as) => {
    j.ctx = await b.newContext({ viewport: { width: w, height: h } });
    if (as) await j.ctx.addCookies([{ name: 'as', value: as, url: base }]);
    j.p = await j.ctx.newPage();
    j.p.on('pageerror', (e) => j.fails.push(`page error: ${e.message}`));
  };
  j.go = (path) => j.p.goto(base + path);
  j.step = () => { j.steps++; };
  j.check = (name, ok) => { if (ok) j.passes++; else j.fails.push(name); return ok; };
  j.part = (name, ok) => { if (!ok) j.parts.push(name); return ok; };
  j.text = async () => (await j.p.locator('body').innerText()).replace(/\s+/g, ' ');
  j.shows = async (s, name) => j.check(name || `shows “${s}”`, (await j.text()).includes(s));
  j.inView = async (loc, name) => {
    try { await loc.first().waitFor({ timeout: 3000 }); } catch { return j.check(`${name}: not there`, false); }
    const box = await loc.first().boundingBox();
    const tab = await j.p.locator('nav.tabbar').isVisible().catch(() => false);
    const vh = h - (tab ? 60 : 0);
    return j.check(`${name}: in view without scrolling`, !!box && box.y >= 0 && box.y + box.height <= vh);
  };
  j.checkpoint = async (cp) => {
    const r = await j.p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.top < innerHeight && b.bottom > 0; };
      const scope = document.querySelector('dialog[open]') || document;
      const prim = [...scope.querySelectorAll('.btn.primary')].filter(vis);
      const unnamed = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(vis).filter((e) => {
        if (e.matches('input, select, textarea')) return !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.placeholder;
        return !(e.getAttribute('aria-label') || e.textContent.trim());
      }).length;
      return { prim: prim.length, primH: prim.map((e) => e.getBoundingClientRect().height), sideways: document.documentElement.scrollWidth > innerWidth + 1, unnamed };
    });
    j.check(`${cp}: one-action (at most one main button in view: ${r.prim})`, r.prim <= 1);
    j.check(`${cp}: no sideways scrolling`, !r.sideways);
    j.check(`${cp}: a11y (every control named: ${r.unnamed} unnamed)`, r.unnamed === 0);
    if (name === 'phone') j.check(`${cp}: main button 44px`, r.primH.every((x) => x >= 44));
  };
  j.close = () => j.ctx.close();
  return j;
}

const T = {};
T.U22 = { budget: 10, async run(j, base) {
  await j.open('amara');
  await j.go('/');
  j.check('heading area shows', await j.p.locator('h1').first().isVisible());
  await j.go('/workspace/ai');
  j.check('attention: tokens say what they are', (await j.text()).includes('The MCP tokens that let an AI tool act as someone here.'));
  j.part('attention: a builder token is labelled apart (no builder token in the kit’s workspace to show)', false);
  j.step(); await j.p.getByRole('button', { name: 'Make a token' }).click();
  const dlg = () => j.p.getByRole('dialog');
  await dlg().getByRole('button', { name: /^Who it acts as:.*Change$/ }).click();
  await dlg().getByRole('searchbox').fill('Mateo');
  await dlg().getByRole('option', { name: 'Mateo Fernández' }).click();
  j.check('errors: Make the token is disabled until it says what it is for', await dlg().getByRole('button', { name: 'Make the token' }).isDisabled());
  j.step(); await dlg().getByLabel('What it’s for').fill('Claude on Mateo’s laptop');
  await j.checkpoint('make token');
  j.step(); await dlg().getByRole('button', { name: 'Make the token' }).click();
  await j.shows('it isn’t shown again');
  const t = await j.text();
  j.check('attention: the token and the connection command are there', /gk_[A-Za-z0-9]{40}/.test(t) && t.includes('claude mcp add --transport http'));
  await j.checkpoint('token');
  j.step(); await dlg().getByRole('button', { name: 'Done' }).click();
  const rows = await (await fetch(`${base}/__tokens`)).json();
  j.check('logged: stored as a hash, not in plain text', rows.length === 1 && rows[0].hashed && rows[0].personId === 'mateo');
  await j.shows('not used yet');
  j.step(); await j.p.getByRole('button', { name: 'Revoke Claude on Mateo’s laptop' }).click();
  await j.shows('Revoked');
  j.check('finish: the token was revoked', !!(await (await fetch(`${base}/__tokens`)).json())[0].revokedAt);
} };

T.U175 = { budget: 12, async run(j, base) {
  await j.open('amara');
  await j.go('/workspace/ai');
  await j.shows('The MCP tokens that let an AI tool act as someone here.', 'AI access is its own Workspace section');
  await j.go('/workspace/features');
  const box = j.p.getByRole('checkbox', { name: /AI access/ });
  await j.inView(box, 'entry: the AI access tick box');
  j.check('attention: AI access is under Beyond this workspace', (await j.p.getByRole('region', { name: 'Beyond this workspace' }).getByRole('checkbox', { name: /AI access/ }).count()) === 1);
  await j.checkpoint('features');
  j.step(); await box.click(); await j.p.waitForLoadState();
  await j.shows('AI access is off in');
  j.check('with no token, switching off did not ask first', !(await j.text()).includes('stop working at once'));
  await j.checkpoint('switched off');
  await j.go('/workspace/access');
  await j.shows('Who the admins are.');
  j.check('Access lists no MCP tokens with AI access off', !/MCP token/.test(await j.p.locator('main').innerText()));
  j.check('Workspace’s menu has no AI access', (await j.p.getByRole('navigation', { name: 'More in Workspace' }).getByRole('link', { name: 'AI access' }).count()) === 0);
  await j.go('/workspace/ai');
  await j.shows('Page not found');
  await j.shows('AI access is switched off in', '/workspace/ai says AI access is switched off');
  await j.go('/settings');
  j.check('the page shows', await j.p.locator('main').isVisible());
  await j.shows('Settings');
  j.check('Settings has no “Your MCP tokens” with AI access off', !(await j.text()).includes('Your MCP tokens'));
  await j.go('/feedback');
  j.part('the inbox’s Connect Claude says AI access is off, with a link to Features (the inbox is the Feedback module’s, not built)', (await j.p.locator('#inbox').count()) > 0);
  const act = await (await fetch(`${base}/activity`, { headers: { cookie: 'as=amara' } })).text();
  j.check('logged: switching AI access off was logged', act.includes('switched AI access off'));
  await j.go('/workspace/features');
  j.step(); await j.p.getByRole('checkbox', { name: /AI access/ }).click(); await j.p.waitForLoadState();
  await j.shows('AI access is on in');
  await j.go('/workspace/ai');
  await j.shows('The MCP tokens that let an AI tool act as someone here.', 'AI access back on, its section is back');
  j.check('the section is after Access', /Access AI access/.test((await j.p.getByRole('navigation', { name: 'More in Workspace' }).innerText()).replace(/\s+/g, ' ')));
  await j.go('/settings');
  await j.shows('Your MCP tokens', 'AI access back on, Settings has “Your MCP tokens”');
} };

T.U62 = { budget: 6, async run(j) {
  await j.open('rhea');
  await j.go('/settings');
  await j.inView(j.p.getByRole('link', { name: 'Your page' }), 'entry: Your page');
  const main = await j.p.locator('main').innerText();
  j.check('attention: Settings offers no Make for tokens, and its recording line leads to Privacy', !/Make (a|an MCP) token/.test(main) && (await j.p.locator('main a[href="/workspace/privacy"]').count()) === 1);
  await j.checkpoint('settings');
  j.step(); await j.p.getByRole('link', { name: 'Your page' }).click();
  j.check('the Rhea Kapoor heading shows', await j.p.getByRole('heading', { name: 'Rhea Kapoor' }).isVisible());
  j.check('progress: the address is /people/rhea', /\/people\/rhea$/.test(j.p.url()));
  await j.go('/settings');
  j.step(); await j.p.getByRole('button', { name: 'Leave this workspace…' }).click();
  j.check('the Leave …Platform Engineering dialog shows', await j.p.getByRole('dialog', { name: /^Leave .*Platform Engineering/ }).isVisible());
  j.check('finish: leaving asks who takes over', await j.p.getByRole('dialog').getByLabel(/Who takes over/).isVisible());
  await j.p.keyboard.press('Escape');
  await j.go('/workspace');
  j.check('the workspace facts show', await j.p.getByRole('region', { name: 'About' }).isVisible());
  j.check('errors: Workspace has no Leave', (await j.p.getByRole('button', { name: 'Leave this workspace' }).count()) === 0);
  await j.go('/settings');
  const btn = j.p.getByRole('button', { name: 'Leave this workspace…' });
  j.check('logged: the only admin is told why they can’t leave (needs Rhea to be the only admin; the kit’s demo has three admins and Rhea is none)', (await btn.isDisabled()) && (await j.text()).includes('You’re the only admin. Make someone else an admin first'));
} };

async function runJourneys(base, ids = Object.keys(T)) {
  const b = await chromium.launch();
  const out = [];
  try {
    for (const id of ids) for (const width of WIDTHS) {
      await fetch(`${base}/__reset`, { method: 'POST' });
      const j = J(base, b, width);
      try { await T[id].run(j, base); } catch (e) { j.fails.push(`stopped: ${e.message.split('\n')[0]}`); }
      await j.close();
      if (j.steps > T[id].budget) j.fails.push(`over budget: ${j.steps} steps of ${T[id].budget}`);
      out.push({ id, width: j.width, steps: j.steps, budget: T[id].budget, passes: j.passes, fails: j.fails, parts: j.parts });
    }
  } finally { await b.close(); }
  return out;
}
module.exports = { runJourneys };

if (require.main === module) {
  const [base = 'http://localhost:4173', ...ids] = process.argv.slice(2);
  runJourneys(base, ids.length ? ids : undefined).then((r) => { console.log(JSON.stringify(r, null, 1)); });
}
