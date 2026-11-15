// Stage 7's exit criteria, one test each, run with the metric library on and with it off.
//   node --test modules/metrics/exit.test.mjs      (from rebuild/)
// Two servers are started: one with the module on, one with FARO_MODULES_OFF=metrics. Each test resets its server first.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './rules.mjs';
import * as B from './library.mjs';
import { demoSources, sourceFor } from './sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const kit = path.resolve(root, '..');
const WS = path.join(kit, 'spec/conformance/workspace.json');
const fresh = () => JSON.parse(fs.readFileSync(WS, 'utf8'));
const OFF_SENTENCE = (tool) => `The metric library is switched off in Platform Engineering, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;

function startServer(port, env) {
  const p = spawn(process.execPath, [path.join(root, 'app/server.mjs'), String(port)], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((res) => p.stdout.on('data', (d) => { if (String(d).includes('Faro rebuild')) res(p); }));
}
function client(port) {
  const base = `http://localhost:${port}`;
  const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const get = async (u, as = 'rhea', today = '') => { const r = await fetch(base + u, { headers: { cookie: `as=${as}${today ? `; today=${today}` : ''}` }, redirect: 'manual' }); const h = await r.text(); return { status: r.status, html: h, text: text(h), location: r.headers.get('location') }; };
  const post = async (u, form, as = 'rhea') => { const r = await fetch(base + u, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), redirect: 'manual' }); const h = await r.text(); return { status: r.status, html: h, text: text(h), location: r.headers.get('location') }; };
  const tool = async (tool, args, as = 'rhea') => { const r = await fetch(`${base}/mcp`, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/json' }, body: JSON.stringify({ tool, args }) }); return r.json(); };
  const reset = () => fetch(`${base}/__reset`, { method: 'POST' });
  const ws = async () => (await fetch(`${base}/__workspace`)).json();
  return { get, post, tool, reset, ws };
}
let on, off, without, procs = [];
before(async () => {
  procs = await Promise.all([startServer(4291, {}), startServer(4292, { FARO_MODULES_OFF: 'metrics' }), startServer(4293, { FARO_WITHOUT: 'metrics' })]);
  on = client(4291); off = client(4292); without = client(4293);
});
after(() => procs.forEach((p) => p.kill()));
const ctx = (actor) => ({ actor, now: '2026-11-05T12:00:00.000Z', week: 45 });

for (const mode of ['on', 'off']) describe(`the metric library ${mode}`, () => {
  const c = () => (mode === 'on' ? on : off);
  const isOn = mode === 'on';

  test('criterion 1: its requirements hold', async () => {
    await c().reset();
    const lib = await c().get('/metrics?as=oskar');
    const goal = await c().get('/goals/lead-ci-time');
    if (isOn) {
      assert.match(lib.text, /13 metrics, A to Z\./); // METRICS-LIBRARY
      assert.match(goal.text, /Measured by Pipeline queue wait \(p90\)/); // METRICS-LIBRARY: a goal's summary says it
      const page = await c().get('/metrics/queue-wait', 'oskar');
      assert.match(page.text, /Fully defined/); // METRIC-DEFINED
      assert.match(page.text, /Measured/); // METRIC-MEASUREMENT: the shape and its word
      const ck = await c().get('/check-in/ns-ci', 'daniel');
      assert.match(ck.text, /From CI analytics, read 9:00 today\./); // READING-PREFILL
    } else {
      assert.match(lib.text, /switched off in Platform Engineering/);
      assert.doesNotMatch(goal.text, /Measured by Pipeline queue wait/);
    }
  });

  test('criterion 2: its journeys and checks can be done', () => {
    const res = JSON.parse(fs.readFileSync(path.join(here, 'journeys-results.json'), 'utf8'));
    const ids = ['U81', 'U82', 'U83', 'U145', 'U105', 'U146', 'U106', 'U152', 'U156', 'U157', 'U158', 'U159', 'U160', 'U172', 'N29', 'F15', 'N16', 'U170'];
    for (const id of ids) assert.ok(res[id], `${id} has a tally`);
    if (isOn) assert.ok(ids.filter((id) => res[id].tally === 'DONE').length >= 1);
    else assert.ok(res._off && res._off.menuHasMetrics === false, 'with the module off the journeys have no Metrics to start from');
  });

  test('criterion 3: a name, a unit and a direction save; any missing is refused; the same name is refused', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('save_metric', { name: 'Build time', unit: 'min', direction: 'lower' }, 'oskar'); assert.equal(r.text, OFF_SENTENCE('save_metric')); return; }
    const W = fresh(); W.changes = [];
    assert.equal(B.saveMetric(W, ctx('oskar'), { name: 'Build time' }).refused, 'Say its unit: %, min, hours, USD, deploys… Say which way is better: higher or lower.');
    assert.equal(B.saveMetric(W, ctx('oskar'), { name: 'Build time', unit: 'min' }).refused, 'Say which way is better: higher or lower.');
    assert.equal(B.saveMetric(W, ctx('oskar'), { unit: 'min', direction: 'lower' }).refused, 'Give it a name.');
    assert.equal(B.saveMetric(W, ctx('oskar'), { name: 'Build time', unit: 'min', direction: 'lower' }, { skipChecks: true }).message, 'Added the metric “Build time”');
    assert.equal(B.saveMetric(W, ctx('oskar'), { name: 'flaky TEST rate', unit: '%', direction: 'lower' }).refused, 'There’s already a metric called Flaky test rate. Use it, or give this one a different name.');
    const r = await c().tool('save_metric', { name: 'BUILD TIME (p50)', unit: 'min', direction: 'lower' }, 'oskar');
    assert.equal(r.isError, false);
  });

  test('criterion 4: only the owner or an admin changes a metric; only the goal’s owner or an admin links it', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('link_goal_metric', { goal: 'ns-ci', metric: 'metric_ci-time' }, 'oskar'); assert.equal(r.text, OFF_SENTENCE('link_goal_metric')); return; }
    const W = fresh();
    assert.equal(B.saveMetric(W, ctx('oskar'), { id: 'metric_flaky-rate', caveats: 'x' }).refused, 'Only Rhea Kapoor or an admin can change this metric.');
    assert.ok(B.saveMetric(W, ctx('grace'), { id: 'metric_flaky-rate', caveats: 'x' }).ok);
    assert.equal(B.linkGoal(W, ctx('oskar'), { goalId: 'ns-ci', metricId: 'metric_ci-time' }).refused, 'Only the goal’s owner or an admin can choose what measures it.');
    assert.equal(B.removeMetric(W, ctx('oskar'), 'metric_ci-cost').refused, 'Only Ethan Brooks or an admin can remove this metric.');
    const page = await c().get('/metrics/lead-time', 'tunde');
    assert.match(page.text, /Rhea Kapoor or an admin can change this\./);
    assert.doesNotMatch(page.html, /Change this metric|Retire it|>Delete</);
  });

  test('criterion 5: units must match, dated stages can’t be measured, the other way warns', async () => {
    if (!isOn) { const r = await c().tool('link_goal_metric', { goal: 'ns-ci', metric: 'metric_lead-time' }, 'grace'); assert.equal(r.text, OFF_SENTENCE('link_goal_metric')); return; }
    const W = fresh();
    assert.equal(B.linkGoal(W, ctx('grace'), { goalId: 'ns-ci', metricId: 'metric_lead-time' }).refused, 'The goal is in min and the metric is in hours. Use the same unit for both.');
    assert.equal(B.linkGoal(W, ctx('grace'), { goalId: 'lead-mq', metricId: 'metric_lead-time' }).refused, 'A goal with dated stages has no number, so a metric can’t measure it.');
    const r = B.linkGoal(W, ctx('rhea'), { goalId: 'ci-shard', metricId: 'metric_flaky-rate', teamId: 'cicd' });
    assert.ok(r.ok); assert.deepEqual(r.warnings, ['The goal aims up, but for Flaky test rate lower is better. Check it’s meant.']);
  });

  test('criterion 6: a used metric is retired, not deleted; an unused one is deleted and comes back', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('remove_metric', { metric: 'metric_ci-cost' }, 'ethan'); assert.equal(r.text, OFF_SENTENCE('remove_metric')); return; }
    const W = fresh(); W.changes = [];
    assert.equal(B.removeMetric(W, ctx('rhea'), 'metric_lead-time').refused, 'Lead time for changes has measured goals, so it can’t be deleted. Retire it instead.');
    const r = B.removeMetric(W, ctx('ethan'), 'metric_ci-cost'); assert.ok(r.ok);
    r.undo(); assert.equal(W.modules.metrics.metrics.find((m) => m.id === 'metric_ci-cost').removedAt, undefined);
    B.removeMetric(W, ctx('ethan'), 'metric_ci-cost');
    assert.ok(B.restoreMetric(W, ctx('ethan'), 'metric_ci-cost').ok);
    // through the screens: Delete, then Undo
    const del = await c().post('/metrics/ci-cost/remove', {}, 'ethan'); assert.equal(del.status, 303);
    assert.match((await c().get('/metrics?done=1', 'ethan')).text, /12 metrics/);
    await c().post('/metrics/undo', {}, 'ethan');
    assert.match((await c().get('/metrics', 'ethan')).text, /13 metrics/);
  });

  test('criterion 7: the demo’s 13 metrics and 12 links load, and no goal’s numbers move', () => {
    const W = fresh();
    assert.equal(W.modules.metrics.metrics.length, 13); assert.equal(W.modules.metrics.metricLinks.length, 12);
    assert.deepEqual(W.modules.metrics.metricLinks.filter((l) => l.part).map((l) => `${l.teamId} · ${l.part}`), ['cicd · main branch pipelines', 'cicd · main pipelines']);
    const dir = fs.mkdtempSync(path.join(root, 'local', 'x7-'));
    const run = (env, out) => spawnSync(process.execPath, [path.join(root, 'main.mjs'), WS, out], { env: { ...process.env, ...env }, cwd: root });
    fs.mkdirSync(path.join(dir, 'a')); fs.mkdirSync(path.join(dir, 'b'));
    run(isOn ? {} : { FARO_MODULES_OFF: 'metrics' }, path.join(dir, 'a')); run({ FARO_WITHOUT: 'metrics' }, path.join(dir, 'b'));
    for (const f of ['status', 'flags', 'projection', 'scorecard', 'checkin']) assert.equal(fs.readFileSync(path.join(dir, 'a', `${f}.csv`), 'utf8'), fs.readFileSync(path.join(dir, 'b', `${f}.csv`), 'utf8'), `${f}.csv moved`);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('criterion 8: built without the module, its rows load, save and stay; with it back they are all there', async () => {
    await without.reset();
    assert.equal((await without.get('/metrics')).status, 404);
    await without.post('/check-in/ns-ci', { value: '19', why: 'Runners added.', call: 'on', post: '1' }, 'daniel');
    const W = await without.ws();
    assert.deepEqual(W.modules.metrics, fresh().modules.metrics);
    await c().reset();
    const W2 = await c().ws();
    assert.equal(W2.modules.metrics.metrics.length, 13); assert.equal(W2.modules.metrics.metricLinks.length, 12);
  });

  test('criterion 9: starting the next year carries each goal’s link to its copy', () => {
    const W = fresh();
    if (!isOn) { W.modulesOff = ['metrics']; }
    B.carryLinks(W, ctx('amara'), [['lead-ci-time', 'lead-ci-time-2027'], ['ns-lead', 'ns-lead-2027']]);
    const l = W.modules.metrics.metricLinks.find((x) => x.goalId === 'lead-ci-time-2027');
    assert.equal(l.metricId, 'metric_queue-wait'); assert.equal(l.teamId, 'cicd'); assert.equal(l.part, 'main branch pipelines');
    // The core has no "Start 2027" (its U115 isn't built), so nothing calls this yet: see JOURNEYS.md, U152.
  });

  test('criterion 10: every row of metrics.csv matches', () => {
    const r = spawnSync(process.execPath, [path.join(kit, 'spec/rebuild/drill.mjs'), path.join(here, 'drill'), '--files', 'metrics', '--diffs', '3'], { env: { ...process.env, ...(isOn ? {} : { FARO_MODULES_OFF: 'metrics' }) }, cwd: kit, encoding: 'utf8' });
    if (isOn) { assert.match(r.stdout, /metrics\.csv: 109 of 109 rows match/); assert.equal(r.status, 0); }
    else assert.notEqual(r.status, 0, 'with the module off no metrics.csv is written');
  });

  test('criterion 11: the library is in the menu after People; old addresses land; a row counts what its page lists', async () => {
    await c().reset();
    const home = await c().get('/', 'oskar');
    const menu = home.html.match(/<ul aria-label="Look up">([\s\S]*?)<\/ul>/)[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!isOn) { assert.equal(menu, 'People Activity Data'); return; }
    assert.equal(menu, 'People Metrics Activity Data');
    assert.match((await c().get('/more', 'oskar')).text, /Metrics/);
    for (const [from, to] of [['/data/metrics', '/metrics'], ['/data/metrics?m=metric_lead-time', '/metrics/lead-time'], ['/data/metrics?m=metric_lead-time&edit', '/metrics/lead-time/edit'], ['/data/metrics?new', '/metrics/new']]) assert.equal(new URL((await c().get(from)).location, 'http://x').pathname + new URL((await c().get(from)).location, 'http://x').search, to);
    const lib = await c().get('/metrics?q=flaky', 'oskar');
    assert.match(lib.text, /1 At risk/);
    const page = await c().get('/metrics/flaky-rate', 'oskar');
    assert.equal((page.html.match(/class="metric-goal-row"/g) || []).length, 1);
  });

  test('criterion 12: “Measured by” on the measure step fills in the unit and says so in Check', async () => {
    await c().reset();
    await c().post('/goals/new/what', { title: 'Runner queue wait', kind: 'metric' });
    await c().post('/goals/new/who', { ownerId: 'rhea', teamId: 'cicd', level: 'team' });
    const step = await c().get('/goals/new/measure');
    if (!isOn) { assert.doesNotMatch(step.text, /Measured by/); return; }
    assert.ok(step.text.indexOf('Measured by') < step.text.indexOf('Unit'), 'Measured by comes first');
    const r = await c().post('/goals/new/measure', { unit: '', start: '14', target: '3', metricId: 'metric_queue-wait', metricRefresh: '1' });
    assert.match(r.text, /min, whole numbers, lower is better: from the metric\./);
    assert.match(r.text, /For CI\/CD/);
    await c().post('/goals/new/measure', { unit: 'min', start: '14', target: '3', metricFor: 'cicd', metricPart: '', ans_past: 'keep' });
    const check = await c().get('/goals/new/check');
    assert.match(check.text, /Pipeline queue wait \(p90\), for CI\/CD\./);
    const pub = await c().post('/goals/new/check', { state: 'active' });
    const gid = new URL(pub.location, 'http://x').pathname.split('/')[2];
    assert.match((await c().get(`/goals/${gid}`)).text, /Measured by Pipeline queue wait \(p90\) ?, for CI\/CD/);
    assert.match((await c().get('/metrics/queue-wait')).text, /Runner queue wait/);
    await c().post('/goals/new/what', { title: 'Freeze stages', kind: 'milestone' });
    await c().post('/goals/new/who', { ownerId: 'rhea', teamId: 'cicd', level: 'team' });
    assert.doesNotMatch((await c().get('/goals/new/measure')).text, /Measured by/);
  });

  test('criterion 13: a close name asks and still saves; a unit goals use asks first; About counts metrics with no owner', async () => {
    await c().reset();
    if (!isOn) { assert.doesNotMatch((await c().get('/workspace', 'amara')).text, /have no owner|has no owner/); return; }
    const W = fresh(); W.changes = [];
    const a = B.saveMetric(W, ctx('rhea'), { name: 'CI cost per pipeline run', unit: 'USD', direction: 'lower' });
    assert.match(a.refused, /This looks like “CI compute cost per pipeline run”/);
    assert.ok(B.saveMetric(W, ctx('rhea'), { name: 'CI cost per pipeline run', unit: 'USD', direction: 'lower' }, { answers: { name: 'keep:metric_ci-cost' } }).ok);
    assert.ok(B.saveMetric(W, ctx('rhea'), { id: 'metric_lead-time', unit: 'hrs' }, { answers: { unit: 'keep' } }).refused);
    const W3 = fresh(); W3.people.find((p) => p.id === 'rhea').leftAt = '2026-11-01T00:00:00.000Z';
    assert.equal(L.liveMetrics(W3.modules.metrics.metrics).filter((m) => { const o = W3.people.find((p) => p.id === m.ownerId); return !o || o.leftAt; }).length, 4);
    assert.doesNotMatch((await c().get('/workspace', 'amara')).text, /have no owner/); // none in the demo
  });

  test('criterion 14: a name, a unit and a direction are enough; what is still to say is in words; the three Checks', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('get_metric', { metric: 'metric_lead-time' }); assert.equal(r.text, OFF_SENTENCE('get_metric')); return; }
    const W = fresh();
    assert.equal(L.stillToSay({ name: 'x', unit: 'min', direction: 'lower', ownerId: 'rhea' }, W.people), 'Still to say: what it means, where the number comes from, who owns that source, how often it refreshes.');
    for (const m of W.modules.metrics.metrics) assert.equal(L.stillToSay(m, W.people), 'Fully defined');
    const r = await c().tool('save_metric', { name: 'Flaky tests rate', unit: '%', direction: 'lower', meaning: 'Flakes seen.' }, 'oskar');
    assert.deepEqual(r.data.checks.map((x) => x.about), ['name', 'meaning']);
    const r2 = await c().tool('save_metric', { name: 'Flaky tests rate', unit: '%', direction: 'lower', meaning: 'Flakes seen.', answers: { name: 'keep:metric_flaky-rate', meaning: 'as-written' } }, 'oskar');
    assert.equal(r2.data.saved, true);
    await c().post('/metrics/new', { name: 'Deploy success rate', unit: '%', direction: 'higher', meaning: 'Production deploys with no rollback, out of all production deploys, over 28 days.', save: '1' });
    const form = await c().post('/metrics/new', { name: 'Deploy sucess rate', unit: '%', meaning: 'Deploys that worked.', save: '1' });
    assert.match(form.text, /1 to fix, 2 to check\./);
  });

  test('criterion 15: which part; the Checks about parts and twins; Why on a goal with check-ins', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('link_goal_metric', { goal: 'ci-docker', metric: 'metric_queue-wait' }); assert.equal(r.text, OFF_SENTENCE('link_goal_metric')); return; }
    const W = fresh(); W.changes = [];
    assert.equal(B.linkGoal(W, ctx('rhea'), { goalId: 'ci-docker', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'x'.repeat(61) }).refused, 'Keep the part to 60 characters or fewer.');
    assert.match(B.linkGoal(W, ctx('rhea'), { goalId: 'ci-docker', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'main branch pipelines' }).checks[0].text, /^Another goal already measures this for CI\/CD, main branch pipelines/);
    assert.equal(B.linkGoal(W, ctx('rhea'), { goalId: 'lead-ci-time', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'release builds' }).refused, 'Say why this goal is measured differently now.');
    const ok = B.linkGoal(W, ctx('rhea'), { goalId: 'lead-ci-time', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'release builds', reason: 'Release builds queue apart from main now' });
    assert.equal(ok.message, 'Measured by “Pipeline queue wait (p90)” for CI/CD · release builds: Release builds queue apart from main now');
    const about = await c().get('/goals/lead-ci-time');
    for (const k of ['For', 'What it means', 'From the metric', 'Where the number comes from', 'This goal’s own']) assert.match(about.text, new RegExp(k));
  });

  test('criterion 16: changing a metric goals use reads back first; retire, bring back, merge', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('merge_metrics', { from: 'metric_lead-time', into: 'metric_first-review' }, 'amara'); assert.equal(r.text, OFF_SENTENCE('merge_metrics')); return; }
    const W = fresh(); W.changes = [];
    assert.ok(B.saveMetric(W, ctx('rhea'), { id: 'metric_lead-time', caveats: 'Reworded.' }).ok);
    assert.equal(B.saveMetric(W, ctx('rhea'), { id: 'metric_lead-time', meaning: 'Hours from merge to production, out of all changes.' }).refused, 'Say whether it is still the same number.');
    assert.equal(B.saveMetric(W, ctx('rhea'), { id: 'metric_lead-time', meaning: 'Hours from merge to production, out of all changes.' }, { comparable: false }).refused, 'Say why, in a line. Every goal measured by it will show this.');
    const r = B.saveMetric(W, ctx('rhea'), { id: 'metric_lead-time', meaning: 'Hours from merge to production, out of all changes.' }, { comparable: false, reason: 'We now start the clock at merge.' });
    assert.ok(r.ok); assert.equal(W.modules.metrics.metrics.find((m) => m.id === 'metric_lead-time').marks[0].kind, 'definition');
    r.undo(); assert.equal(W.modules.metrics.metrics.find((m) => m.id === 'metric_lead-time').marks, undefined);
    assert.match(B.saveMetric(W, ctx('rhea'), { id: 'metric_lead-time', unit: 'min' }).refused, /A metric in min is a different number/);
    assert.ok(B.retireMetric(W, ctx('rhea'), 'metric_flaky-rate', 'The test platform reports it now.').ok);
    assert.ok(!L.liveMetrics(W.modules.metrics.metrics).some((m) => m.id === 'metric_flaky-rate'));
    assert.ok(B.unretireMetric(W, ctx('rhea'), 'metric_flaky-rate').ok);
    assert.equal(B.mergeMetrics(W, ctx('rhea'), 'metric_lead-time', 'metric_first-review').refused, 'Only admins can merge metrics: it changes what other people’s goals are measured by.');
    const mg = B.mergeMetrics(W, ctx('amara'), 'metric_lead-time', 'metric_first-review');
    assert.deepEqual(mg.moved, ['ns-lead']); mg.undo();
    assert.equal(W.modules.metrics.metricLinks.find((l) => l.goalId === 'ns-lead').metricId, 'metric_lead-time');
    // the chart's mark, through the screens
    await c().post('/metrics/lead-time/edit', { name: 'Lead time for changes', unit: 'hours', direction: 'lower', meaning: 'Hours from merge to production, out of all changes.', comparable: 'no', reason: 'We now start the clock at merge.', confirm: '1', save: '1' });
    assert.match((await c().get('/goals/ns-lead')).text, /Definition changed, week 45/);
  });

  test('criterion 17: a gap holds its goals to no number in the same save; measured again lets go', async () => {
    await c().reset();
    if (!isOn) { const r = await c().tool('save_metric', { id: 'metric_flaky-rate', measurement: 'gap' }); assert.equal(r.text, OFF_SENTENCE('save_metric')); return; }
    await c().post('/metrics/flaky-rate/edit', { name: 'Flaky test rate', unit: '%', direction: 'lower', measurement: 'gap', measurementNote: 'The new runners send no results yet; Aiko is adding them.', save: '1' });
    const page = await c().get('/metrics/flaky-rate');
    assert.match(page.text, /Not measured yet: 1 goal held to no number/);
    assert.match(page.html, /data-measurement="gap"/);
    assert.match((await c().get('/goals/lead-flaky')).html, /data-status="unmeasured"/);
    assert.match((await c().get('/metrics?sortout=true')).text, /Flaky test rate/);
    await c().post('/metrics/flaky-rate/edit', { name: 'Flaky test rate', unit: '%', direction: 'lower', measurement: 'measured', save: '1' });
    assert.doesNotMatch((await c().get('/goals/lead-flaky')).html, /data-status="unmeasured"/);
  });

  test('criterion 18: a source reads a slice or says it doesn’t; a reading’s state is rule 1’s; what is recorded is rule 2’s', () => {
    const W = fresh(); const S = demoSources(W);
    const company = sourceFor(S, 'metric_ci-time', { teamId: null, part: '' });
    assert.equal(company.readsSlice, true);
    assert.equal(sourceFor(S, 'metric_ci-time', { teamId: 'cicd', part: '' }).readsSlice, false);
    assert.equal(sourceFor(S, 'metric_lead-time', { teamId: null }), null);
    assert.deepEqual(company.source.read('metric_ci-time', W.builtFor, { teamId: null }), { value: 20, at: '2026-11-05T09:00:00.000Z' });
    const now = '2026-11-12T10:00:00.000Z', r = { value: 12, at: '2026-11-12T09:02:00.000Z' };
    assert.equal(L.readingState({ reading: r, lastValue: 13, now }), 'fresh');
    assert.equal(L.readingState({ reading: r, lastValue: 13, now, typed: 14 }), 'changed');
    assert.equal(L.readingState({ reading: { value: 13, at: '2026-11-05T09:00:00.000Z' }, lastReading: { at: '2026-11-05T09:00:00.000Z' }, now }), 'old');
    assert.equal(L.readingState({ reading: { value: 130, at: r.at }, lastValue: 13, now }), 'jump');
    assert.equal(L.readingState({ reading: null, noSlice: true, now }), 'no-slice');
    assert.equal(L.readingProblem({ source: 'CI analytics', value: 12, at: r.at }, 14, { now }), 'CI analytics said 12. Say why your number is different.');
    assert.deepEqual(L.keptReading({ source: 'CI analytics', value: 12, at: '2026-11-12T09:02:00Z', why: { kind: 'behind' } }, 14), { source: 'CI analytics', value: 12, at: '2026-11-12T09:02:00Z', why: { kind: 'behind' } });
    if (!isOn) { W.modulesOff = ['metrics']; assert.ok(W.modulesOff.includes('metrics')); }
  });

  test('criterion 19: the check-in’s number step fills in, asks why, and is as it was with the module off', async () => {
    await c().reset();
    const ck = await c().get('/check-in/ns-ci', 'daniel');
    if (!isOn) { assert.doesNotMatch(ck.text, /CI analytics/); assert.match(ck.html, /id="val" name="value" value=""/); return; }
    assert.match(ck.text, /From CI analytics, read 9:00 today\./); assert.match(ck.html, /id="val" name="value" value="20"/);
    const bad = await c().post('/check-in/ns-ci', { value: '19', why: 'x', call: 'on', post: '1', reading_source: 'CI analytics', reading_value: '20', reading_at: '2026-11-05T09:00:00.000Z' }, 'daniel');
    assert.match(bad.text, /CI analytics said 20\. Say why your number is different\./);
    const good = await c().post('/check-in/ns-ci', { value: '19', why: 'x', call: 'on', post: '1', reading_source: 'CI analytics', reading_value: '20', reading_at: '2026-11-05T09:00:00.000Z', reading_why: 'behind' }, 'daniel');
    assert.equal(good.status, 303);
    assert.match((await c().get(good.location, 'daniel')).text, /19 min, typed\. CI analytics said 20 min: the source is behind: I have a newer number\./);
    const old = await c().get('/check-in/ns-ci?sources=behind', 'daniel');
    assert.match(old.text, /CI analytics last read this on Thu 29 Oct, 7 days ago\. That is too old to fill in\./);
    await c().post('/goals/lead-ci-time/edit', { version: '1', title: 'Pipeline queue wait (p90)', metricId: 'metric_ci-time', metricFor: 'cicd', metricPart: '', metricWhy: 'Main-branch only now' });
    assert.match((await c().get('/check-in/lead-ci-time')).text, /CI analytics measures this for the whole company, not for CI\/CD on its own, so it isn’t filled in\./);
  });

  test('criterion 20: where a number came from shows beyond the check-in', async () => {
    await c().reset();
    await c().post('/check-in/ns-ci', { value: '20', why: 'Steady.', call: 'on', post: '1', reading_source: 'CI analytics', reading_value: '20', reading_at: '2026-11-05T09:00:00.000Z' }, 'daniel');
    const g = await c().get('/goals/ns-ci', 'daniel');
    if (!isOn) { assert.doesNotMatch(g.text, /This week’s number/); return; }
    assert.match(g.text, /This week’s number 20 min, from CI analytics, read 9:00 today\. Confirmed by Daniel Okafor\./);
    assert.match((await c().get('/metrics/ci-time', 'daniel')).text, /In the last 8 weeks, 0 of 1 check-ins filled in from CI analytics used a different number\./);
  });
});
