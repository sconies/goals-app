// Stage 7's exit criteria (spec/rebuild/stage-7-module-metrics.md), one test per criterion, each run with the module
// on, switched off, and (where it says anything) left out of the build. Usage: node --test modules/metrics/exit.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { App } from '../../app/state.mjs';
import * as R from './rules.mjs';
import * as O from './ops.mjs';
import * as RD from './reading.mjs';
import { metricsSheetRows, planMetricsSheet } from './sheet.mjs';
import { carryLinks } from './carry.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const WS = 'Platform Engineering';
const OFF_SENTENCE = `Metric library is switched off in ${WS}. An admin can switch it on in Workspace, Features.`;
const servers = {};
async function start(name, port, env) {
  const s = spawn(process.execPath, [path.join(root, 'app/server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  await new Promise((res, rej) => { s.stdout.once('data', res); s.once('exit', (c) => rej(new Error(`the app didn’t start (${name}, exit ${c})`))); });
  servers[name] = { s, base: `http://localhost:${port}` };
}
const get = async (mode, p, as = 'amara') => { const r = await fetch(servers[mode].base + p, { headers: { cookie: `as=${as}` }, redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };
const post = async (mode, p, body, as = 'amara') => { const r = await fetch(servers[mode].base + p, { method: 'POST', headers: { cookie: `as=${as}`, 'content-type': 'application/x-www-form-urlencoded', referer: servers[mode].base + '/' }, body: new URLSearchParams(body), redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };
const state = async (mode) => (await fetch(`${servers[mode].base}/api/state`)).json();
const reset = (mode) => fetch(`${servers[mode].base}/api/reset`, { method: 'POST' });
const tool = async (mode, name, args, as = 'amara') => { const st = await state(mode); const r = await fetch(`${servers[mode].base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${st.tokens[as]}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }); return (await r.json()).result; };
const fresh = (off = false) => { const app = new App(); app.now = app.W.builtFor; if (off) { app.W.modulesOff = ['metrics']; app.rebind(); } return app; };
const ctxOf = (app) => ({ W: app.W, S1: app.S1, now: app.now });

before(async () => { await start('on', 47311); await start('off', 47312, { FARO_OFF: 'metrics' }); await start('without', 47313, { FARO_WITHOUT: 'metrics' }); });
after(() => { for (const x of Object.values(servers)) x.s.kill(); });

// With the module off, every surface of it is gone and every door says its sentence.
async function offSurfaces(mode) {
  const home = await get(mode, '/');
  assert.ok(!/module:metrics/.test(home.text), 'no menu row');
  const lib = await get(mode, '/metrics');
  assert.equal(lib.status, 404);
  if (mode === 'off') assert.ok(lib.text.includes(OFF_SENTENCE), 'the library says its sentence');
  assert.ok(!/data-module="metrics"/.test((await get(mode, '/goals/ns-lead')).text), 'no Measured by on a goal');
}
async function offTool(name, args = {}) { const r = await tool('off', name, args); assert.ok(r.isError && r.content[0].text === `Metric library is switched off in ${WS}, so ${name} can’t be used there. An admin can switch it on in Workspace, under Features.`, `${name} refuses with the sentence`); }

test('1. its requirements hold (on); off, none of them answers', async () => {
  const lib = await get('on', '/metrics');
  assert.ok(lib.text.includes('13 metrics') && lib.text.indexOf('Change failure rate') < lib.text.indexOf('Time to first review'), 'METRICS-LIBRARY: 13, A to Z');
  assert.ok((await get('on', '/goals/new/measure', 'rhea')).status !== 500, 'METRICS-MEASURED-BY: the step draws');
  assert.ok((await get('on', '/metrics/lead-time')).text.includes('Fully defined'), 'METRIC-DEFINED');
  assert.ok((await get('on', '/metrics/queue-wait')).text.includes('Measured'), 'METRIC-MEASUREMENT: a shape and a word');
  assert.ok((await get('on', '/check-in/ns-ci', 'daniel')).text.includes('From CI analytics, read'), 'READING-PREFILL');
  await offSurfaces('off'); await offSurfaces('without');
});

test('2. its journeys and checks can be done (JOURNEYS.md tallies each); off, their pages are gone', async () => {
  const j = fs.readFileSync(path.join(here, 'JOURNEYS.md'), 'utf8');
  for (const id of ['U81', 'U82', 'U83', 'U145', 'U105', 'U146', 'U106', 'U152', 'U156', 'U157', 'U158', 'U159', 'U160', 'U172', 'N29', 'F15', 'N16', 'U170', 'U179', 'U161', 'U72']) assert.ok(new RegExp(`\\| ${id} \\|`).test(j), `${id} is tallied`);
  await offSurfaces('off');
});

test('3. name, unit and direction; a second name, any case, is refused', async () => {
  const app = fresh();
  assert.equal(O.saveMetric(app, 'oskar', { name: 'Build time' }).error, 'Say its unit: %, min, hours, USD, deploys… Say which way is better: higher or lower.');
  assert.equal(O.saveMetric(app, 'oskar', { name: 'Queue depth', unit: 'jobs', direction: 'lower' }).summary, 'Added the metric “Queue depth”');
  for (const n of ['flaky TEST rate', 'Fláky test rate']) assert.equal(O.saveMetric(app, 'oskar', { name: n, unit: '%', direction: 'lower' }).error, 'There’s already a metric called Flaky test rate. Use it, or give this one a different name.');
  const r = await tool('on', 'save_metric', { name: 'Queue depth two', unit: 'jobs', direction: 'lower' }, 'oskar');
  assert.ok(!r.isError, 'save_metric adds one');
  await offTool('save_metric', { name: 'X', unit: 'jobs', direction: 'lower' });
  assert.ok((await post('off', '/act/metrics.save', { name: 'Off one', unit: 'jobs', direction: 'lower' })).text.includes('Metric library is switched off in'), 'the form’s action refuses');
});

test('4. only the owner or an admin changes or removes; only the goal’s owner or an admin links', async () => {
  const app = fresh();
  assert.equal(O.saveMetric(app, 'oskar', { id: 'metric_flaky-rate', caveats: 'x' }).error, 'Only Rhea Kapoor or an admin can change this metric.');
  assert.equal(O.saveMetric(app, 'rhea', { id: 'metric_flaky-rate', decimals: 2 }).summary, 'Changed the metric “Flaky test rate”');
  assert.ok(/Only .* or an admin can remove this metric\./.test(O.removeMetric(app, 'oskar', 'metric_ci-cost').error));
  assert.equal(O.linkGoal(app, 'oskar', { goalId: 'ns-ci', metricId: 'metric_ci-time' }).error, 'Only the goal’s owner or an admin can choose what measures it.');
  assert.ok(O.linkGoal(app, 'grace', { goalId: 'ci-shard', metricId: 'metric_cache-hit', teamId: 'cicd', answers: { others: 'carry-on' } }).ok, 'an admin links someone else’s goal');
  await offTool('link_goal_metric', { goal_id: 'ns-ci', metric_id: 'metric_ci-time' });
});

test('5. units must match, dated stages can’t be measured, the other direction warns', async () => {
  const app = fresh();
  assert.equal(O.linkGoal(app, 'grace', { goalId: 'ns-ci', metricId: 'metric_lead-time' }).error, 'The goal is in min and the metric is in hours. Use the same unit for both.');
  assert.equal(O.linkGoal(app, 'grace', { goalId: 'lead-mq', metricId: 'metric_lead-time' }).error, 'A goal with dated stages has no number, so a metric can’t measure it.');
  const r = O.linkGoal(app, 'rhea', { goalId: 'ci-shard', metricId: 'metric_flaky-rate', teamId: 'cicd', answers: { others: 'carry-on' } });
  assert.ok(r.ok && r.warnings.includes('The goal aims up, but for Flaky test rate lower is better. Check it’s meant.'));
  await offTool('link_goal_metric', { goal_id: 'ci-shard', metric_id: 'metric_flaky-rate' });
});

test('6. a used metric is retired, never deleted; an unused one is deleted and comes back', async () => {
  const app = fresh();
  assert.equal(O.removeMetric(app, 'rhea', 'metric_lead-time').error, 'Lead time for changes has measured goals, so it can’t be deleted. Retire it instead.');
  assert.ok(O.removeMetric(app, 'ethan', 'metric_ci-cost').ok);
  assert.ok(!R.findMetrics(ctxOf(app)).all.some((m) => m.id === 'metric_ci-cost'), 'gone from the library');
  assert.ok(O.undoLast(app, 'ethan').ok && !R.findMetric(app.W, 'metric_ci-cost').removedAt, 'Undo brings it back');
  O.removeMetric(app, 'ethan', 'metric_ci-cost');
  assert.ok(O.restoreMetric(app, 'ethan', 'metric_ci-cost').ok && !R.findMetric(app.W, 'metric_ci-cost').removedAt, 'Recently removed brings it back');
  await offTool('remove_metric', { metric_id: 'metric_ci-cost' });
});

test('7. the demo’s 13 metrics and 12 links load, and every goal is as without them', async () => {
  for (const mode of ['on', 'off', 'without']) { await reset(mode); const st = await state(mode); assert.equal(st.modules.metrics.metrics.length, 13); assert.equal(st.modules.metrics.metricLinks.length, 12); }
  const app = fresh();
  assert.deepEqual(R.partsOf(ctxOf(app), R.findMetric(app.W, 'metric_queue-wait')), ['main branch pipelines']);
  assert.deepEqual(R.partsOf(ctxOf(app), R.findMetric(app.W, 'metric_flaky-rate')), ['main pipelines']);
  const bare = JSON.parse(fs.readFileSync(app.wsFile, 'utf8')); delete bare.modules;
  const b = new App(); b.W = { ...b.W, ...bare, modules: {} }; b.now = b.W.builtFor; b.rebind();
  for (const g of app.S1.asOf(app.now).goals) assert.equal(app.S1.goalStatus(g, app.S1.asOf(app.now).ckByGoal.get(g.id) || [], app.now).status, b.S1.goalStatus(g, b.S1.asOf(b.now).ckByGoal.get(g.id) || [], b.now).status, g.key);
});

test('8. built without the module, its rows load, save and stay; back, they are all there', async () => {
  await reset('without');
  const before = JSON.stringify((await state('without')).modules.metrics);
  await post('without', '/act/comment', { goalId: 'ns-lead', text: 'A core save while the library is left out' });
  assert.equal(JSON.stringify((await state('without')).modules.metrics), before, 'no row changed or deleted');
  assert.ok(/module:metrics/.test((await get('on', '/')).text), 'with the module, they are there');
});

test('9. the next year carries each goal’s link to its copy: same metric, team and part (PART: the core has no start-next-year screen)', () => {
  const app = fresh();
  const copies = new Map(app.S1.asOf(app.now).goals.map((g) => [g.id, `${g.id}-next`]));
  const out = carryLinks(app.W, copies, 'grace', '2026-12-21T00:00:00.000Z');
  const l = out.find((x) => x.goalId === 'lead-ci-time-next');
  assert.ok(l && l.metricId === 'metric_queue-wait' && l.teamId === 'cicd' && l.part === 'main branch pipelines');
  assert.equal(out.length, 12);
  const off = fresh(true); assert.equal(carryLinks(off.W, copies, 'grace', '2026-12-21T00:00:00.000Z', { on: false }).length, 0, 'off: nothing is carried, nothing is lost');
});

test('10. every row of spec/conformance/metrics.csv matches', () => {
  const r = spawnSync(process.execPath, [path.join(root, '../spec/rebuild/drill.mjs'), root, '--files', 'metrics', '--diffs', '0'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout.split('\n').filter((x) => /metrics\.csv|Score/.test(x)).join('\n'));
});

test('11. in the menu after People; old addresses lead on; a row counts what its page lists', async () => {
  const home = (await get('on', '/')).text;
  assert.ok(home.indexOf('data-item="people"') < home.indexOf('data-item="module:metrics"'), 'after People');
  assert.equal((await get('on', '/data/metrics')).location, '/metrics');
  assert.equal((await get('on', '/data/metrics?m=metric_lead-time&edit')).location, '/metrics/lead-time/edit');
  assert.equal((await get('on', '/data/metrics?new')).location, '/metrics/new');
  const lib = (await get('on', '/metrics')).text, page = (await get('on', '/metrics/lead-time')).text;
  const row = lib.split('data-metric="metric_lead-time"')[1].split('</li>')[0];
  assert.ok(/Off track<\/span><\/span> 1/.test(row) && (page.match(/<tr data-goal=/g) || []).length === 1);
  assert.equal((await get('off', '/data/metrics')).status, 404);
});

test('12. Measured by comes first on the measure step, fills in from the metric, and links on publish', async () => {
  await reset('on');
  await post('on', '/goals/new/what', { title: 'Shorter queues on release builds', kind: 'metric' }, 'rhea');
  await post('on', '/goals/new/who', { ownerId: 'rhea', teamId: 'cicd', level: 'team' }, 'rhea');
  const step = (await get('on', '/goals/new/measure', 'rhea')).text;
  assert.ok(step.indexOf('name="metricId"') > 0 && step.indexOf('name="metricId"') < step.indexOf('name="unit"'), 'first on the step');
  await post('on', '/goals/new/measure', { metricId: 'metric_queue-wait', metricFor: 'cicd', metricPart: 'release builds', unit: 'min', start: '20', target: '10' }, 'rhea');
  const step2 = (await get('on', '/goals/new/measure', 'rhea')).text;
  assert.ok(step2.includes('min, whole numbers, lower is better: from the metric.') && step2.includes('90th percentile of minutes'), 'shows its meaning and what it fills in');
  const pub = await post('on', '/goals/new/check', {}, 'rhea');
  const id = /\/goals\/([^?]+)/.exec(pub.location || '')?.[1];
  assert.ok(id, `published (${pub.status})`);
  const l = (await state('on')).modules.metrics.metricLinks.find((x) => x.goalId === id);
  assert.ok(l && l.metricId === 'metric_queue-wait' && l.teamId === 'cicd' && l.part === 'release builds', 'measured for its team and part');
  assert.ok(!(await get('off', '/goals/new/measure', 'rhea')).text.includes('name="metricId"'), 'off: no Measured by');
});

test('13. a close name asks and still saves; a unit or direction goals use asks first; About counts ownerless metrics', async () => {
  const app = fresh();
  const r = O.saveMetric(app, 'oskar', { name: 'CI cost per pipeline run', unit: 'USD', direction: 'lower' });
  assert.ok(r.checks && /This looks like “CI compute cost per pipeline run”/.test(r.checks[0].question));
  assert.ok(O.saveMetric(app, 'oskar', { name: 'CI cost per pipeline run', unit: 'USD', direction: 'lower' }, { answers: { name: 'keep' } }).ok);
  assert.ok(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', direction: 'higher' }, { reason: 'Flip' }).ask === 'confirm', 'a direction goals use asks first');
  const p = app.W.people.find((x) => x.id === 'rhea'); p.leftAt = '2026-11-01';
  assert.equal(R.liveMetrics(app.W).filter((m) => !R.ownerName(app.W, m)).length, 4);
  assert.ok(!(await get('on', '/workspace')).text.includes('no owner'), 'none in the demo');
  assert.ok(!(await get('off', '/workspace')).text.includes('data-module="metrics"'));
});

test('14. still to say in words; three Checks answered once before saving', async () => {
  const app = fresh();
  for (const m of R.inUseMetrics(app.W)) assert.equal(R.stillToSay(app.W, m), 'Fully defined');
  const r = O.saveMetric(app, 'oskar', { name: 'Flaky tests rate', unit: '%', direction: 'lower', meaning: 'Flakes seen.' });
  assert.equal(r.error, 'Answer these questions first: This is one letter from “Flaky test rate” (%, lower is better, owned by Rhea Kapoor, 1 goal). This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”.');
  assert.deepEqual(R.unitChecks(app.W, 'mins').map((c) => c.use), ['min']);
  const ok = O.saveMetric(app, 'oskar', { name: 'Flaky tests rate', unit: '%', direction: 'lower', meaning: 'Flakes seen.' }, { answers: { name: 'keep', meaning: 'as-written' } });
  assert.equal(ok.still, 'Still to say: where the number comes from, who owns that source, how often it refreshes.');
  const t = await tool('on', 'save_metric', { name: 'Flaky tests rate', unit: '%', direction: 'lower' }, 'oskar');
  assert.ok(t.isError && t.structuredContent?.checks?.length !== 0, 'save_metric returns the checks');
  await offTool('save_metric', { name: 'Flaky tests rate', unit: '%', direction: 'lower' });
});

test('15. parts: 60 characters, the same number asked once, a reason for a goal with check-ins; About lists For', async () => {
  const app = fresh();
  assert.ok(/60 characters/.test(O.linkGoal(app, 'rhea', { goalId: 'lead-ci-time', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'x'.repeat(61), reason: 'r' }).error));
  assert.ok(/Another goal already measures this for CI\/CD, main branch pipelines/.test(O.linkGoal(app, 'rhea', { goalId: 'ci-docker', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'main branch pipelines' }).error));
  assert.equal(O.linkGoal(app, 'rhea', { goalId: 'lead-ci-time', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'release builds' }).error, 'Say why this goal is measured differently now.');
  O.unlinkGoal(app, 'rhea', 'lead-ci-time');
  assert.equal(O.linkGoal(app, 'rhea', { goalId: 'lead-ci-time', metricId: 'metric_ci-time', teamId: 'cicd' }).error, 'Say why this goal is measured differently now.');
  const r = O.linkGoal(app, 'rhea', { goalId: 'lead-ci-time', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'release builds', reason: 'Release builds queue apart from main now' });
  assert.equal(r.summary, 'Measured by “Pipeline queue wait (p90)” for CI/CD · release builds: Release builds queue apart from main now');
  assert.equal(R.closePart('release bilds', ['release builds']), 'release builds');
  const about = (await get('on', '/goals/lead-ci-time')).text;
  for (const w of ['For', 'What it means', 'From the metric', 'Where the number comes from', 'This goal’s own', 'CI/CD · main branch pipelines']) assert.ok(about.includes(w), w);
  assert.ok(!(await get('off', '/goals/lead-ci-time')).text.includes('From the metric'));
});

test('16. changing a used metric reads back first; retire keeps links; merge for admins, one Undo', async () => {
  const app = fresh();
  const lt = R.findMetric(app.W, 'metric_lead-time');
  assert.deepEqual(R.changeKinds(lt, { ...lt, caveats: 'new' }, R.linkedGoals(app.W, lt)), ['words']);
  assert.ok(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', caveats: 'Reworded.' }).ok, 'caveats save at once');
  assert.equal(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', meaning: 'Now from merge.' }).ask, 'comparable');
  assert.equal(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', meaning: 'Now from merge.' }, { comparable: false }).error, 'Say why, in a line. Every goal measured by it will show this.');
  const ch = O.saveMetric(app, 'rhea', { id: 'metric_lead-time', meaning: 'Now from merge.' }, { comparable: false, reason: 'Counted from merge now.' });
  assert.ok(ch.ok && R.markLabel(R.findMetric(app.W, 'metric_lead-time').marks[0]) === `Definition changed, week 45`);
  assert.ok(O.undoLast(app, 'rhea').ok && !R.findMetric(app.W, 'metric_lead-time').marks, 'Undo takes the mark back');
  assert.ok(/new label/.test(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', unit: 'h' }).error), 'a new scale is refused');
  assert.ok(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', unit: 'h' }, { relabel: true, confirm: true, answers: { unit: 'keep' } }).ok && app.goal('ns-lead').unit === 'h', 'a new label changes every goal’s unit');
  const ret = O.retireMetric(app, 'rhea', 'metric_flaky-rate', 'The test platform reports it now.');
  assert.equal(ret.summary, 'Retired the metric “Flaky test rate”: The test platform reports it now.');
  assert.ok(R.linkOf(app.W, 'lead-flaky') && !R.liveMetrics(app.W).some((m) => m.id === 'metric_flaky-rate'));
  assert.ok(/retired/.test(O.linkGoal(app, 'rhea', { goalId: 'ci-shard', metricId: 'metric_flaky-rate', teamId: 'cicd' }).error));
  assert.ok(O.unretireMetric(app, 'rhea', 'metric_flaky-rate').ok);
  assert.equal(O.mergeMetrics(app, 'rhea', 'metric_flaky-rate', 'metric_cache-hit').error, 'Only admins can merge metrics: it changes what other people’s goals are measured by.');
  assert.ok(O.mergeMetrics(app, 'grace', 'metric_cfr', 'metric_cache-hit').ok && R.linkOf(app.W, 'ns-cfr').metricId === 'metric_cache-hit');
  assert.ok(O.undoLast(app, 'grace').ok && R.linkOf(app.W, 'ns-cfr').metricId === 'metric_cfr', 'one Undo puts the merge back');
  await offTool('merge_metrics', { from_id: 'metric_cfr', into_id: 'metric_cache-hit' });
});

test('17. a Gap holds its goals to no number in the same save; measured again, they are let go', async () => {
  const app = fresh();
  O.saveMetric(app, 'rhea', { id: 'metric_flaky-rate', measurement: 'gap', measurementNote: 'The new runners send no results yet.' });
  const g = app.goal('lead-flaky');
  assert.equal(app.S1.goalStatus(g, app.S1.asOf(app.now).ckByGoal.get(g.id) || [], app.now).status, 'unmeasured');
  assert.ok(R.findMetrics(ctxOf(app), { sortout: true }).all.some((m) => m.id === 'metric_flaky-rate'), 'under To sort out');
  O.saveMetric(app, 'rhea', { id: 'metric_flaky-rate', measurement: 'partly' });
  assert.ok(!app.goal('lead-flaky').unmeasuredSince, 'partly: held to its plan');
  O.saveMetric(app, 'rhea', { id: 'metric_flaky-rate', measurement: 'gap' });
  app.run('grace', 'setFeature', { id: 'metrics', on: false });
  assert.ok(!app.goal('lead-flaky').unmeasuredSince, 'the library switched off lets go of every held goal');
  app.run('grace', 'setFeature', { id: 'metrics', on: true });
  assert.ok(app.goal('lead-flaky').unmeasuredSince, 'and on again holds them');
});

test('18. a number source reads a slice or says it doesn’t; a reading’s state is rule 1’s', () => {
  const app = fresh();
  const src = R.demoSources(app.W, app.S1);
  const ci = R.sourceFor(src, 'metric_ci-time');
  assert.equal(R.askSource(ci, 'metric_ci-time', app.now, { teamId: 'cicd', part: '' }).state, 'no-slice', 'company-wide never fills a team');
  const r = { reading: { value: 12, at: '2026-11-12T09:02:00Z' } };
  assert.equal(R.readingState(r, null, 13, '2026-11-12T10:00:00Z', null, 0), 'fresh');
  assert.equal(R.readingState(r, null, 13, '2026-11-12T10:00:00Z', 14, 0), 'changed');
  assert.equal(R.readingState({ reading: { value: 13, at: '2026-11-02T09:00:00Z' } }, null, 13, '2026-11-12T10:00:00Z', null, 0), 'old');
  assert.equal(R.readingState({ reading: { value: 130, at: '2026-11-12T09:02:00Z' } }, null, 13, '2026-11-12T10:00:00Z', null, 0), 'jump');
  assert.equal(R.readingProblem({ source: 'CI analytics', value: 12, at: '2026-11-12T09:02:00Z' }, 14, '2026-11-12T10:00:00Z'), 'CI analytics said 12. Say why your number is different.');
});

test('19. the check-in’s number step: filled in, confirmed, asked why when different; off, as it was', async () => {
  await reset('on');
  const step = (await get('on', '/check-in/ns-ci', 'daniel')).text;
  assert.ok(/data-state="fresh"/.test(step) && step.includes('From CI analytics, read') && /Confirm \d+ min/.test(step));
  const m = /name="reading_value" value="([^"]+)"/.exec(step); const at = /name="reading_at" value="([^"]+)"/.exec(step)[1];
  const refused = await post('on', '/check-in/ns-ci', { value: String(Number(m[1]) + 3), reading_source: 'CI analytics', reading_value: m[1], reading_at: at, call: 'risk', cause: 'Delivery slower', why: 'Slower than planned this week.', path: 'Split the slow suites out.', byWeek: '50' }, 'daniel');
  assert.ok(refused.text.includes(`CI analytics said ${m[1]}. Say why your number is different.`), 'a different number needs a reason');
  const ok = await post('on', '/check-in/ns-ci', { value: m[1], reading_source: 'CI analytics', reading_value: m[1], reading_at: at, call: 'risk', cause: 'Delivery slower', why: 'Slower than planned this week.', path: 'Split the slow suites out.', byWeek: '50' }, 'daniel');
  assert.equal(ok.status, 303, `posted (${ok.text.slice(0, 200)})`);
  assert.ok((await get('on', '/goals/ns-ci')).text.includes('This week’s number'), 'the goal says where its number came from');
  assert.ok(!(await get('off', '/check-in/ns-ci', 'daniel')).text.includes('From CI analytics'), 'off: as it was');
});

test('20. where a number came from shows beyond the check-in (PART: History, agenda, sheet columns and get_goal are the core’s and not drawn)', async () => {
  const app = fresh();
  const c = app.W.checkIns.filter((x) => x.goalId === 'ns-ci').sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
  c.reading = { source: 'CI analytics', value: c.value, at: '2026-11-05T09:00:00.000Z' };
  assert.ok(/from CI analytics, read 9:00/.test(RD.readingThisWeek(app.W, app.goal('ns-ci'), c, app.now)));
  const d = RD.differentWords(app.W, app.S1, R.findMetric(app.W, 'metric_ci-time'), 'CI analytics', app.now);
  assert.equal(d.words, 'In the last 8 weeks, 0 of 1 check-ins filled in from CI analytics used a different number.');
  const t = await tool('on', 'get_metric', { metric_id: 'metric_ci-time' });
  assert.ok(!t.isError && t.structuredContent.differentNumbers, 'get_metric says it');
  await offTool('get_metric', { metric_id: 'metric_ci-time' });
});

test('21. the Metrics sheet loads back: unchanged plans nothing; adds, changes, retires; Must fix in the form’s words; one Undo', async () => {
  const app = fresh(); const ctx = ctxOf(app);
  assert.equal(planMetricsSheet(ctx, 'amara', metricsSheetRows(ctx), { now: app.now }).summary, 'No changes');
  const rows = [{ ID: '', Metric: 'Retried test share', Unit: '%', Direction: 'Lower is better' }, { ID: 'metric_lead-time', Caveats: 'Read with the release calendar.' }, { ID: '', Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better' }, { ID: '', Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better' }, { ID: 'metric_cfr', Action: 'Retire' }];
  const p = planMetricsSheet(ctx, 'amara', rows, { now: app.now });
  assert.equal(p.summary, '2 new metrics, 1 metric changed');
  assert.ok(p.issues.some((x) => x.message === 'Rows 4 and 5 are both called “Queue depth”. A metric’s name is used once.') && p.issues.some((x) => x.message === 'Say why it is retired, in the Reason column. Its goals will show this.'));
  const r = O.loadSheet(app, 'amara', rows, { leaveOut: true });
  assert.ok(r.ok && R.inUseMetrics(app.W).find((m) => m.name === 'Retried test share').ownerId === 'amara');
  assert.ok(O.undoLast(app, 'amara').ok && !R.inUseMetrics(app.W).some((m) => m.name === 'Retried test share'), 'one Undo puts every row back');
  assert.ok(/isn’t a metric in this workspace/.test(planMetricsSheet(ctx, 'amara', [{ ID: 'metric_nope' }], { now: app.now }).issues[0].message));
  assert.ok(/A file can’t change its unit/.test(planMetricsSheet(ctx, 'amara', [{ ID: 'metric_lead-time', Unit: 'min' }], { now: app.now }).issues[0].message));
  const off = await post('off', '/act/metrics.import', { csv: 'ID,Metric,Unit,Direction\n,Cache warm share,%,Higher is better\n' });
  assert.ok(off.text.includes('Metric library is switched off in'), 'off: the sheet is not read');
  assert.ok(!(await state('off')).modules.metrics.metrics.some((m) => m.name === 'Cache warm share'));
});

test('22. a Part of round a loop is a Must fix in the library’s words; structure round-trips', () => {
  const app = fresh(); const ctx = ctxOf(app);
  const p = planMetricsSheet(ctx, 'amara', [{ ID: 'metric_ci-time', 'Part of': 'Lead time for changes', 'How it relates': 'Driver' }, { ID: 'metric_lead-time', 'Part of': 'metric_ci-time' }], { now: app.now });
  assert.ok(p.issues.some((x) => x.message === 'Choose another parent: it’s already under this one.'));
  O.loadSheet(app, 'grace', [{ ID: 'metric_ci-time', 'Part of': 'Lead time for changes', 'How it relates': 'Driver', Confidence: 'High', 'How it could be gamed': 'Skipping slow tests.' }]);
  assert.equal(R.placeWords(app.W, R.findMetric(app.W, 'metric_ci-time')), 'A driver of Lead time for changes.');
  assert.equal(planMetricsSheet(ctx, 'grace', metricsSheetRows(ctx), { now: app.now }).summary, 'No changes', 'an export with structure loads back changing nothing');
});
