// Fields' journeys and check (U174, U177, U178, N34: spec/modules/tags/README.md), in a browser on a phone and a desktop,
// against the running app. Every check that fails fails the run (exit 1). Run from rebuild/: node modules/tags/journeys.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.env.JOURNEY_PORT || 47341), BASE = `http://localhost:${PORT}`;
const WS = 'Platform Engineering';
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shownIn = async (loc, text, words) => check(await loc.getByText(text, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const state = async () => (await fetch(`${BASE}/api/state`)).json();
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { cookie: 'as=amara', 'content-type': 'application/x-www-form-urlencoded', referer: BASE + '/' }, body: new URLSearchParams(body), redirect: 'manual' });
const inView = async (loc) => { const b = await loc.boundingBox(); const vh = loc.page().viewportSize().height; return !!b && b.y >= 0 && b.y + b.height <= vh - 56; };
// Fields' journeys' seed (seedStage, not in the kit: guessed): Stage, a list of Discover, Build and Run; Flaky test rate in
// Build and Base image build time in Discover
async function seedStage() {
  await post('/act/tags.addField', { name: 'Stage', kind: 'list', options: 'Discover\nBuild\nRun' });
  await post('/act/tags.setGoalFields', { goalId: 'lead-flaky', fieldId: 'fld_stage', value: 'Build' });
  await post('/act/tags.setGoalFields', { goalId: 'ci-docker', fieldId: 'fld_stage', value: 'Discover' });
}
const listed = async (p, text) => { await p.locator('main').getByText(text).first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {}); return (await p.locator('main').innerText()).includes(text); };

const J = {
  async U174(p) {
    await p.goto(`${BASE}/workspace/fields?as=amara`);
    await shownIn(p.locator('main'), 'No fields yet', 'Workspace → Fields with no field does not say “No fields yet”');
    await p.getByRole('button', { name: 'Add a field' }).click();
    const d = p.getByRole('dialog', { name: 'Add a field' });
    check(await d.isVisible(), 'no dialog shows');
    await d.getByLabel('Name', { exact: true }).fill('Stage');
    await d.getByLabel('Values', { exact: true }).fill('Discover\nBuild\nRun');
    await d.getByRole('button', { name: 'Add the field' }).click();
    await shownIn(p.getByRole('list', { name: 'Fields' }), 'A list: Discover, Build, Run', 'the new field is not listed with its values');
    await p.getByRole('button', { name: 'Add a field' }).click();
    await d.getByLabel('Name', { exact: true }).fill('stage');
    await d.getByRole('button', { name: 'Add the field' }).click();
    await shownIn(d, 'There’s already a field called “Stage”.', 'a second “stage” is not refused in the rule’s words');
    await p.keyboard.press('Escape');
    check(await d.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false), 'the dialog does not go away');
    await p.goto(`${BASE}/goals/lead-flaky`);
    const block = p.locator('[data-part="Fields"]');
    check(await block.isVisible(), 'the Fields part does not show');
    await shownIn(block, 'Not set', 'the goal’s Fields block does not say Stage is not set');
    for (const v of ['Discover', 'Build']) {
      await block.getByRole('button', { name: 'Change Stage' }).click();
      await block.getByLabel('Stage', { exact: true }).selectOption(v);
      await p.waitForLoadState('load');
      await shownIn(p.locator('[data-part="Fields"]'), `Stage · ${v}`, `the block does not say Stage · ${v}`);
    }
    const line = (await p.locator('[data-part="Fields"] .fields-line').first().innerText()).replace(/\s+/g, ' ').trim();
    check(/^Stage · Build/.test(line), `the block says “${line}”`);
    await shownIn(p.locator('#history'), 'Stage: Discover → Build', 'History does not say “Stage: Discover → Build”');
    const s = await state();
    check((s.modules.tags?.fieldValues ?? []).some((x) => x.goalId === 'lead-flaky' && x.value === 'Build') && s.changes.some((c) => c.entity === 'field' && c.goalId === 'lead-flaky' && c.summary === 'Stage: Discover → Build'), 'the value or its History entry was not saved');
  },
  async U177(p) {
    await seedStage();
    await p.goto(`${BASE}/goals?scope=all&as=amara`);
    const btn = p.getByRole('button', { name: /^Filter(s| and sort)?$/ });
    check(await inView(btn), 'the Filters button is not in view without scrolling');
    await btn.click();
    const sheet = p.getByRole('dialog', { name: 'Filter goals' });
    const row = sheet.getByRole('group', { name: 'Stage' });
    const words = (await row.innerText()).replace(/\s+/g, ' ').trim();
    check(/Stage.*Discover.*Build.*Run.*Not set/.test(words), `the Stage row says “${words}”`);
    await row.getByLabel('Build').check();
    await sheet.getByRole('button', { name: 'Show the goals' }).click();
    check(await p.getByRole('button', { name: 'Remove the filter Stage is Build' }).isVisible(), 'the filter line does not say “Stage is Build” with Remove');
    await shownIn(p.locator('main'), 'Flaky test rate in the main pipelines', 'the goal in Build is not listed');
    check(!(await listed(p, 'Base image build time')) && /[?&]f\.fld_stage=Build/.test(p.url()), `the goal in Discover is listed, or the address (${p.url()}) does not carry the filter`);
    const save = p.getByText('Save this view…');
    check(await save.count() > 0, 'there is no “Save this view…” in a Views menu (saved views are the core’s, SAVED-VIEWS, and this core has none)');
    await save.first().click();
    // (not reached in this rebuild: the view's name, Save view, the view brought back)
    await p.goto(`${BASE}/data?t=goals`);
    check((await p.locator('main table thead').first().innerText()).includes('Stage'), 'Data’s Goals table has no Stage column');
  },
  async U178(p) {
    await seedStage();
    await p.goto(`${BASE}/data/import?as=amara`);
    const btn = p.getByRole('button', { name: 'Download the workbook' });
    check(await btn.count() > 0 && await inView(btn), 'there is no “Download the workbook” at /data/import (the workbook and the import are the Spreadsheets module’s, stage 9, not in this core)');
  },
  async N34(p) {
    await seedStage();
    await p.goto(`${BASE}/workspace/features?as=amara`);
    await p.getByRole('switch', { name: 'Fields' }).click();
    await shownIn(p.locator('main'), `Fields is off in ${WS}. Nothing it saved is lost.`, 'Features does not say Fields is off');
    await p.goto(`${BASE}/goals/lead-flaky`);
    check(!(await p.locator('[data-part="Fields"]').count()), 'the goal still has a Fields block');
    await p.goto(`${BASE}/workspace`);
    check(!(await p.locator('main nav').getByRole('link', { name: 'Fields' }).count()), 'Workspace’s menu still has Fields');
    await p.goto(`${BASE}/workspace/fields`);
    await shownIn(p.locator('main'), `Fields is switched off in ${WS}. An admin can switch it on in Workspace, Features.`, '/workspace/fields does not say Fields is switched off');
    await p.goto(`${BASE}/goals?scope=all`);
    await p.getByRole('button', { name: 'Filters' }).click();
    check(!(await p.getByRole('dialog', { name: 'Filter goals' }).getByRole('group', { name: 'Stage' }).count()), 'Goals still has a Stage filter');
    await p.goto(`${BASE}/data?t=goals`);
    check(!(await p.locator('main table thead').first().innerText()).includes('Stage'), 'Data still has a Stage column');
    await p.goto(`${BASE}/workspace/features`);
    await p.getByRole('switch', { name: 'Fields' }).click();
    await p.goto(`${BASE}/goals/lead-flaky`);
    await shownIn(p.locator('[data-part="Fields"]'), 'Stage · Build', 'switched back on, the goal’s Stage is not there');
  },
};

async function main() {
  const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const started = await new Promise((r) => { server.stdout.once('data', () => r(true)); server.once('exit', () => r(false)); });
  if (!started) { console.log('FAIL the app did not start'); process.exit(1); }
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const [id, run] of Object.entries(J)) for (const [width, vp] of Object.entries(WIDTHS)) {
      await reset();
      const context = await browser.newContext({ viewport: vp });
      const p = await context.newPage();
      p.setDefaultTimeout(6000);
      try { await run(p); console.log(`PASS ${id} ${width}`); } catch (e) { failed++; console.log(`FAIL ${id} ${width}: ${e instanceof CheckFailed ? e.message : e.message.split('\n')[0]} (at ${p.url()})`); }
      await context.close();
    }
  } finally { await browser.close(); server.kill(); }
  console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
  process.exit(failed ? 1 : 0);
}
main();
