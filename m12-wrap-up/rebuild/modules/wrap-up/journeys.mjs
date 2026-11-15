// The Wrap-up's journeys (spec/modules/wrap-up/journeys/U10.md, U166.md, and N22's Wrap-up part), in a real browser at both widths.
// Each check throws when it fails; the process exits 1 when any journey fails, or when the app does not start.
// Usage: JOURNEY_PORT=47450 node modules/wrap-up/journeys.mjs [U10 U166 N22]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = Number(process.env.JOURNEY_PORT || 47450);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (p, text, words) => check(await p.locator('main, [role=dialog]').getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const state = async () => (await fetch(`${BASE}/api/state`)).json();
const inView = async (loc) => { const b = await loc.boundingBox(); const vh = loc.page().viewportSize().height; return !!b && b.y >= 0 && b.y + b.height <= vh - 56; };

const J = {
  async U10(p) {
    await p.goto(`${BASE}/?as=mateo&today=2026-11-05`);
    check(await p.locator('.hero').isVisible(), 'the page’s lead does not show');
    await p.goto(`${BASE}/goals?scope=all&today=2026-12-22`);
    const entry = p.getByRole('link', { name: 'Wrap up', exact: true });
    check(await inView(entry), 'entry: the “Wrap up” link is not in view without scrolling');
    await entry.click();
    await shown(p, 'goals to wrap up');
    check(await p.locator('main progress, main [role=progressbar]').first().isVisible(), 'progress: no progress indicator');
    await p.locator('.hero .btn.primary').click();
    await shown(p, 'How did it land?');
    await p.getByRole('button', { name: 'Save and continue' }).click();
    check(await p.getByRole('alert').filter({ hasText: 'Write a sentence' }).isVisible(), 'errors: a retro without a lesson is not explained');
    check(await p.locator('.focus-body .chip').isVisible() && (await p.locator('[aria-labelledby=res-l] button[aria-pressed=true]').count()) === 1, 'attention: the retro does not show where the goal ended or suggest a result');
    await p.getByRole('button', { name: 'Partly' }).click();
    await p.getByLabel('What did you learn?').fill('Dependencies on other teams need a date agreed in week 1, not week 5.');
    await p.getByRole('button', { name: 'Save and continue' }).click();
    await shown(p, 'How did it land?');
    await p.getByLabel('What did you learn?').fill('Action reviews only help once every incident has an owner for each action.');
    await p.getByRole('button', { name: 'Stop it here' }).click();
    await p.getByRole('button', { name: 'Save and continue' }).click();
    await shown(p, 'Your goals are wrapped up');
    await shown(p, 'Dependencies on other teams', 'the summary does not show what was learned');
    let s = await state();
    check(s.retros.length === 2 && s.changes.filter((c) => c.entity === 'retro' && c.actorId === 'mateo').length === 2, 'logged: the retros are not saved and logged');
    // Amara, an admin, starts the next cycle
    await p.goto(`${BASE}/workspace/cycles/next?as=amara&today=2026-12-22`);
    await p.getByRole('button', { name: 'Start 2027' }).click();
    await shown(p, '2027 is ready');
    s = await state();
    const c2 = s.cycles.find((c) => c.id !== 'cycle');
    const carried = s.goalsAll.filter((g) => g.cycleId === c2?.id);
    const before = s.goalsAll.filter((g) => g.cycleId === 'cycle' && !g.stoppedAt && !g.removedAt).length;
    check(!!c2 && carried.length > 0 && carried.length < before && !carried.some((g) => g.title === 'Post-incident actions closed within 30 days'), 'finish: the next cycle does not carry the right goals');
    check(s.changes.some((c) => c.entity === 'cycle' && c.actorId === 'amara'), 'logged: starting the cycle is not logged');
    // 4 January 2027: everyone is in 2027, with the goals that carried on (the list shows 50 at a time, so find it)
    await p.goto(`${BASE}/goals?scope=all&today=2027-01-04`);
    await p.getByRole('searchbox', { name: 'Find a goal' }).fill('Lead time');
    await p.getByRole('searchbox', { name: 'Find a goal' }).press('Enter');
    await shown(p, 'Lead time for changes', 'the new cycle does not show the carried goals');
    await p.goto(`${BASE}/goals?scope=all&q=Post-incident`);
    check(!(await p.locator('main .goal-list').getByText('Post-incident actions closed within 30 days').count()), 'a stopped goal came into the new cycle');
  },

  async U166(p) {
    await p.goto(`${BASE}/workspace/features?as=amara`);
    check(await p.locator('main').getByText(/Opens on .+\d{4}\./).first().isVisible().catch(() => false), 'attention: the Wrap-up does not say when it opens');
    await p.getByRole('switch', { name: 'Wrap-up' }).click();
    await shown(p, 'Wrap-up is off in');
    await p.goto(`${BASE}/retro`);
    await shown(p, 'Page not found');
    await shown(p, 'Wrap-up is switched off in', '/retro does not say the Wrap-up is switched off');
    await p.goto(`${BASE}/workspace/cycles`);
    check(await p.locator('.cycles-block').isVisible(), 'the cycles block does not show');
    check(!(await p.locator('main').getByRole('link', { name: /wrap-up/i }).count()), 'Cycles still offers the wrap-up');
    const s = await state();
    check(s.changes.some((c) => c.entity === 'workspace' && c.summary === 'Switched off Wrap-up'), 'logged: switching the Wrap-up off was not logged');
  },

  // N22, the Wrap-up's part: switched off, no button, link or Help article of its own; switched back on, each comes back
  async N22(p) {
    const parts = async () => {
      await p.goto(`${BASE}/goals?scope=all&today=2026-12-22`);
      const goals = await p.getByRole('link', { name: 'Wrap up', exact: true }).count();
      await p.goto(`${BASE}/goals/ns-mttr`);
      const goal = await p.getByRole('link', { name: 'Wrap up this goal' }).count();
      await p.goto(`${BASE}/help`);
      const help = await p.locator('main').getByText('Wrapping up the year, and the next one').count();
      return { goals, goal, help };
    };
    await p.goto(`${BASE}/?as=amara`);
    let on = await parts();
    check(on.goals && on.goal && on.help, `on: Goals ${on.goals}, the goal ${on.goal}, Help ${on.help}`);
    await p.goto(`${BASE}/workspace/features?today=2026-11-05`);
    await p.getByRole('switch', { name: 'Wrap-up' }).click();
    await shown(p, 'Wrap-up is off in');
    const off = await parts();
    check(!off.goals && !off.goal && !off.help, `off: Goals ${off.goals}, the goal ${off.goal}, Help ${off.help}`);
    await p.goto(`${BASE}/workspace/features?today=2026-11-05`);
    await p.getByRole('switch', { name: 'Wrap-up' }).click();
    await shown(p, 'Wrap-up is on in');
    on = await parts();
    check(on.goals && on.goal && on.help, `back on: Goals ${on.goals}, the goal ${on.goal}, Help ${on.help}`);
  },
};

async function main() {
  const only = process.argv.slice(2);
  const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const started = await new Promise((r) => { server.stdout.once('data', () => r(true)); server.once('exit', () => r(false)); });
  if (!started) { console.log('FAIL: the app did not start'); process.exit(1); }
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
