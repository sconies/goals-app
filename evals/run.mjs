/* Runs the evals and writes the scorecard: evals/report.md and evals/out/results.json.

   npm run evals                  the full suite: builds once, then runs the spec scenarios and EVALS_SHARDS (default 4)
                                  journey shards side by side, and merges them into one scorecard
   npm run evals:smoke            the quick gate: the spec scenarios, journeys U1 U2 U3 U5 U16 U33, and checks P6 and P5
   node evals/run.mjs --shard k/n one shard of the full suite (CI runs each on its own machine; shard 1 also runs the
                                  spec scenarios), leaving evals/out/journeys-k.json
   node evals/run.mjs --merge dir only merges the shards' results found under dir into the scorecard (CI)

   EVALS_PORT=4902 serves on 4902 and the ports after it instead of 4318 on: shard k uses EVALS_PORT + 3k for the app,
   +1 for the copy whose database never answers, and +2 for that dead database (one, shared, at EVALS_PORT + 2).
   So two checkouts, or two runs, can go side by side if their EVALS_PORT is at least 3 × shards + 1 apart.
   ONLY=U1,U2[,PLATFORM] and FINISH=F3,N1 run one process, as before, and print the scorecard of what ran. */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'evals', 'out');
const require = createRequire(import.meta.url);
const { plan: shardPlan, checkIds } = require('./shards.cjs');
const PORT = Number(process.env.EVALS_PORT || 4318);
const HANG_PORT = PORT + 2;
const SMOKE_JOURNEYS = ['U1', 'U2', 'U3', 'U5', 'U16', 'U33'];
const SMOKE_CHECKS = ['P6'];

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] ?? ''; };
const smoke = args.includes('--smoke');
const mergeDir = flag('--merge');
const oneShard = (/^(\d+)\/(\d+)$/.exec(flag('--shard') || '') || []).slice(1).map(Number);
const subset = !!(process.env.ONLY || process.env.FINISH || process.env.CHECKS);
const N = Math.max(1, Number(process.env.EVALS_SHARDS || 4));

const sh = (cmd, a, env = {}) => spawnSync(cmd, a, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = () => { const t = Date.now(); return () => Math.round((Date.now() - t) / 1000); };
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
/** Files under dir (any depth) whose names match re: artifacts download into a folder each. */
const find = (dir, re) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(path.join(dir, e.name), re) : re.test(e.name) ? [path.join(dir, e.name)] : []));
/** The journeys in journeys.cjs, in order: the same ids the shards are planned from. */
const journeyIds = () => [...fs.readFileSync(path.join(root, 'evals', 'journeys.cjs'), 'utf8').matchAll(/^journey\('(U\d+)'/gm)].map((m) => m[1]);

/* ---------------- build, serve, run ---------------- */

function build({ down }) {
  console.log(`\n▸ Building the app${down ? ', and a copy whose database never answers' : ''}`);
  if (sh('npx', ['vite', 'build', '--logLevel', 'warn']).status !== 0) process.exit(2);
  // The copy talks to a local server that accepts connections and never answers: a dead database that
  // behaves the same on every machine (an unroutable address fails fast behind some proxies and hangs on others).
  if (down) sh('npx', ['vite', 'build', '--logLevel', 'error', '--outDir', 'evals/out/dist-down'], { VITE_SUPABASE_URL: `http://127.0.0.1:${HANG_PORT}`, VITE_SUPABASE_KEY: 'unused' });
}

function scenarios() {
  console.log('\n▸ Spec scenarios');
  sh('npx', ['vitest', 'run', '--config', 'evals/vitest.config.ts', '--reporter=default', '--reporter=json', '--outputFile=evals/out/scenarios.json']);
}

const serve = (port, dir) => spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', ...(dir ? ['--outDir', dir] : [])], { cwd: root, stdio: 'ignore' });

/** Starts the app (and, with down, the dead-database copy) on app/app+1; resolves once they answer. */
async function startServers(ports) {
  const servers = ports.map(([port, dir]) => serve(port, dir));
  for (const [port] of ports) {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* not up yet */ }
      await sleep(200);
    }
  }
  return servers;
}

/** A server that accepts connections and never answers. */
function startHang() {
  const sockets = new Set();
  const server = net.createServer((sock) => { sockets.add(sock); sock.on('close', () => sockets.delete(sock)); }).listen(HANG_PORT);
  return () => { sockets.forEach((s) => s.destroy()); server.close(); };
}

/** One journeys.cjs process; resolves with its exit code. log: a file for its output, or inherit the terminal. */
function journeysProc(env, log) {
  const fd = log ? fs.openSync(log, 'w') : null;
  return new Promise((resolve) => {
    const p = spawn('node', ['evals/journeys.cjs'], { cwd: root, stdio: log ? ['ignore', fd, fd] : 'inherit', env: { ...process.env, ...env } });
    p.on('close', (code) => { if (fd !== null) fs.closeSync(fd); resolve(code); });
  });
}

/* ---------------- merging the shards ---------------- */

/** Reads the shard files under dir and joins them into the shape one journeys.cjs run writes. Checks the plan was kept:
    every shard is there, and every journey and platform check ran exactly once. */
function mergeShards(dir) {
  const files = find(dir, /^journeys-\d+\.json$/).sort(natural);
  const shards = files.map(read);
  const problems = [];
  const n = shards[0]?.shard?.n ?? 0;
  for (let k = 1; k <= n; k++) if (!shards.some((s) => s.shard?.k === k)) problems.push(`shard ${k} of ${n} left no results (it crashed, or was cancelled)`);
  if (!shards.length) problems.push(`no shard results under ${dir}`);
  const seen = (pick) => { const c = {}; shards.forEach((s) => (s[pick] || []).forEach((x) => { c[x.id] = (c[x.id] || 0) + 1; })); return c; };
  const ranJ = seen('journeys');
  const ranP = seen('platform');
  for (const id of journeyIds()) if (ranJ[id] !== 1) problems.push(`journey ${id} ran ${ranJ[id] || 0} times, not once`);
  for (const id of checkIds()) if (ranP[id] !== 1) problems.push(`check ${id} ran ${ranP[id] || 0} times, not once`);
  const consoleErrors = shards.flatMap((s) => s.consoleErrors || []);
  const journeys = shards.flatMap((s) => s.journeys).sort((a, b) => natural(a.id, b.id));
  const platform = [...shards.flatMap((s) => s.platform), {
    id: 'P5', reqs: ['NO-ERRORS'], title: 'No console or page errors across every journey',
    pass: consoleErrors.length === 0 && shards.length === n, error: consoleErrors.slice(0, 4).join(' | ') || (shards.length === n ? undefined : 'not every shard reported'),
  }].sort((a, b) => natural(a.id, b.id));
  return { journeys, platform, shards, problems, consoleErrors };
}

/** The shard plan as text, with what each shard did and how long it took. */
function planText(shards) {
  return shards.slice().sort((a, b) => (a.shard?.k ?? 0) - (b.shard?.k ?? 0)).map((s) => {
    const secs = [...s.journeys.map((j) => (j.phone.ms + j.desktop.ms) / 1000), ...s.platform.map((x) => x.seconds || 0)].reduce((a, b) => a + b, 0);
    return `  shard ${s.shard?.k}/${s.shard?.n}: ${s.journeys.length} journeys (${s.journeys.map((j) => j.id).join(' ')}) · ${s.platform.length} checks (${s.platform.map((x) => x.id).sort(natural).join(' ')}) · ${Math.round(secs)}s of checks`;
  }).join('\n');
}

/* ---------------- the scorecard ---------------- */

function scorecard({ journeys, platform, problems = [], scenariosFile }) {
  const spec = read(path.join(root, 'evals', 'requirements.json'));
  const scen = fs.existsSync(scenariosFile) ? read(scenariosFile) : { testResults: [] };
  const cases = scen.testResults.flatMap((f) => f.assertionResults).map((t) => {
    const m = /^\[([A-Z0-9-]+)\] (.*)$/.exec(t.title) || [];
    return { req: m[1], title: m[2] || t.title, pass: t.status === 'passed', error: (t.failureMessages || [])[0]?.split('\n')[0] };
  });
  const checks = [...journeys, ...platform];
  const rows = spec.requirements.map((r) => {
    const sc = cases.filter((c) => c.req === r.id);
    const jr = checks.filter((j) => j.reqs.includes(r.id));
    const n = sc.length + jr.length;
    const failed = sc.filter((c) => !c.pass).length + jr.filter((j) => !j.pass).length;
    return { ...r, scenarios: sc.length, checks: jr.map((j) => j.id), verdict: !n ? 'UNTESTED' : failed ? 'FAIL' : 'PASS' };
  });
  const totals = {
    requirements: rows.length,
    pass: rows.filter((r) => r.verdict === 'PASS').length,
    fail: rows.filter((r) => r.verdict === 'FAIL').length,
    untested: rows.filter((r) => r.verdict === 'UNTESTED').length,
    scenarios: { run: cases.length, passed: cases.filter((c) => c.pass).length },
    topFive: journeys.filter((j) => ['U1', 'U2', 'U3', 'U4', 'U5'].includes(j.id)).map((j) => j.score),
  };
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ranAt: stamp, totals, requirements: rows, scenarios: cases, journeys, platform }, null, 2));

  const icon = { PASS: '✅', FAIL: '❌', UNTESTED: '⚪' };
  const mark = (v) => (v === 'n/a' ? '–' : v ? '✓' : '✗');
  let md = `# Eval scorecard · ${spec.slice}\n\nRun ${stamp}.\n\n`;
  md += `## Journeys: ease of use out of 10, on a phone and a desktop\n\n`;
  md += `Each journey is driven in Chromium at 390px and 1440px and checked against the ten criteria below. A criterion counts only if it holds on both. “–” means it doesn’t apply to that journey, and the score is out of the ones that do.\n\n`;
  md += `| # | Journey | Score | ${spec.easeCriteria.map((c) => c.id).join(' | ')} | Steps (phone · desktop) |\n|---|---|---|${spec.easeCriteria.map(() => '---').join('|')}|---|\n`;
  for (const j of journeys) md += `| ${j.id.slice(1)} | ${j.title} | **${j.score}** | ${spec.easeCriteria.map((c) => mark(j.scores[c.id])).join(' | ')} | ${j.phone.count} · ${j.desktop.count} (budget ${j.budget}) |\n`;
  md += `\n${spec.easeCriteria.map((c) => `- **${c.id}**: ${c.text}`).join('\n')}\n`;
  const misses = journeys.filter((j) => !j.pass || Object.values(j.scores).includes(false));
  if (misses.length) {
    md += `\n### What cost points\n\n`;
    for (const j of misses) {
      const notes = [...(j.phone.error ? [`phone: ${j.phone.error}`] : []), ...(j.desktop.error ? [`desktop: ${j.desktop.error}`] : []), ...j.phone.notes.map((n) => 'phone ' + n), ...j.desktop.notes.map((n) => 'desktop ' + n)];
      md += `- **${j.id}** ${j.title}: ${notes.slice(0, 4).join('; ') || 'over the step budget'}\n`;
    }
  }
  md += `\n## Requirements\n\n**${totals.pass} of ${totals.requirements} pass**${totals.fail ? `, ${totals.fail} fail` : ''}${totals.untested ? `, ${totals.untested} untested` : ''}. Spec scenarios ${totals.scenarios.passed}/${totals.scenarios.run}.\n\n`;
  md += `| | Requirement | Area | Scenarios | Journeys and checks |\n|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${icon[r.verdict]} | **${r.id}** ${r.text} | ${r.area} | ${r.scenarios} | ${r.checks.join(', ') || '—'} |\n`;
  md += `\n## Platform checks\n\n${platform.map((x) => `- ${x.pass ? '✅' : '❌'} **${x.id}** ${x.title}${x.pass ? '' : `: ${x.error}`}`).join('\n')}\n`;
  const failedCases = cases.filter((c) => !c.pass);
  if (failedCases.length) md += `\n## Failing scenarios\n\n${failedCases.map((c) => `- **${c.req}** ${c.title}: ${c.error}`).join('\n')}\n`;
  if (problems.length) md += `\n## The shard plan was not kept\n\n${problems.map((x) => `- ${x}`).join('\n')}\n`;
  md += `\n## Not built yet\n\n${spec.notYetBuilt.map((x) => `- ${x}`).join('\n')}\n`;
  fs.writeFileSync(path.join(root, 'evals', 'report.md'), md);

  const exit = totals.fail || totals.untested || totals.topFive.some((s) => s < 10) || problems.length ? 1 : 0;
  // What went wrong, for the issue CI opens on main.
  const bad = [
    ...journeys.filter((j) => !j.pass || j.score < 10 && ['U1', 'U2', 'U3', 'U4', 'U5'].includes(j.id)).map((j) => `- Journey **${j.id}** ${j.title} (${j.score}/10): ${[j.phone.error && 'phone: ' + j.phone.error, j.desktop.error && 'desktop: ' + j.desktop.error].filter(Boolean).join('; ') || 'below the score it needs'}`),
    ...platform.filter((x) => !x.pass).map((x) => `- Check **${x.id}** ${x.title}: ${x.error || 'failed'}`),
    ...failedCases.map((c) => `- Scenario **${c.req}** ${c.title}: ${c.error}`),
    ...rows.filter((r) => r.verdict !== 'PASS').map((r) => `- Requirement **${r.id}** ${r.text}: ${r.verdict}`),
    ...problems.map((x) => `- Shard plan: ${x}`),
  ];
  fs.writeFileSync(path.join(out, 'failures.md'), exit ? bad.join('\n') + '\n' : '');
  console.log(`\n▸ Journeys: ${journeys.map((j) => `${j.id} ${j.score}`).join(' · ')}`);
  console.log(`▸ Platform checks: ${platform.map((x) => `${x.id} ${x.pass ? 'pass' : 'FAIL'}`).join(' · ')}`);
  console.log(`▸ Requirements: ${totals.pass}/${totals.requirements} pass, ${totals.fail} fail, ${totals.untested} untested · scenarios ${totals.scenarios.passed}/${totals.scenarios.run}`);
  console.log('  Report: evals/report.md');
  return exit;
}

/* ---------------- the modes ---------------- */

if (mergeDir !== undefined) {
  fs.mkdirSync(out, { recursive: true });
  const dir = path.resolve(root, mergeDir || 'evals/out');
  const m = mergeShards(dir);
  console.log(`▸ Merging ${m.shards.length} shard(s) from ${dir}\n${planText(m.shards)}`);
  m.problems.forEach((x) => console.log(`  PROBLEM: ${x}`));
  const scen = find(dir, /^scenarios\.json$/)[0] || path.join(out, 'scenarios.json');
  process.exit(scorecard({ ...m, scenariosFile: scen }));
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

if (smoke) {
  const took = clock();
  build({ down: false });
  scenarios();
  console.log(`\n▸ Core journeys (${SMOKE_JOURNEYS.join(' ')}) and checks ${SMOKE_CHECKS.join(' ')}, P5`);
  const servers = await startServers([[PORT]]);
  await journeysProc({ BASE: `http://localhost:${PORT}`, ONLY: SMOKE_JOURNEYS.join(','), CHECKS: SMOKE_CHECKS.join(',') });
  servers.forEach((s) => s.kill());
  const scen = read(path.join(out, 'scenarios.json'));
  const cases = scen.testResults.flatMap((f) => f.assertionResults);
  const j = fs.existsSync(path.join(out, 'journeys.json')) ? read(path.join(out, 'journeys.json')) : { journeys: [], platform: [] };
  const bad = [
    ...(cases.length ? [] : ['the spec scenarios did not run']),
    ...cases.filter((t) => t.status !== 'passed').map((t) => `scenario ${t.title}`),
    ...SMOKE_JOURNEYS.filter((id) => !j.journeys.some((x) => x.id === id)).map((id) => `journey ${id} did not run`),
    ...j.journeys.filter((x) => !x.pass || (['U1', 'U2', 'U3', 'U4', 'U5'].includes(x.id) && x.score < 10)).map((x) => `journey ${x.id} ${x.title} (${x.score}/10): ${x.phone.error || x.desktop.error || 'below 10'}`),
    ...[...SMOKE_CHECKS, 'P5'].filter((id) => !j.platform.some((x) => x.id === id)).map((id) => `check ${id} did not run`),
    ...j.platform.filter((x) => !x.pass).map((x) => `check ${x.id}: ${x.error}`),
  ];
  const md = `# Smoke run\n\nSpec scenarios ${cases.filter((t) => t.status === 'passed').length}/${cases.length}. Journeys ${j.journeys.map((x) => `${x.id} ${x.score}`).join(' · ')}. Checks ${j.platform.map((x) => `${x.id} ${x.pass ? 'pass' : 'FAIL'}`).join(' · ')}.\n${bad.length ? `\n## Failed\n\n${bad.map((x) => `- ${x}`).join('\n')}\n` : ''}`;
  fs.writeFileSync(path.join(out, 'smoke.md'), md);
  console.log(`\n▸ Smoke ${bad.length ? 'FAILED' : 'passed'} in ${took()}s\n${md}`);
  process.exit(bad.length ? 1 : 0);
}

if (oneShard.length) {
  // CI: this machine runs one shard (shard 1 also the spec scenarios), at the ports a local run would give it.
  const [k, n] = oneShard;
  const base = PORT + 3 * (k - 1);
  build({ down: true });
  if (k === 1) scenarios();
  console.log(`\n▸ Shard ${k}/${n}`);
  const servers = await startServers([[base], [base + 1, 'evals/out/dist-down']]);
  const stopHang = startHang();
  const code = await journeysProc({ BASE: `http://localhost:${base}`, DOWN: `http://localhost:${base + 1}`, SHARD: `${k}/${n}` });
  servers.forEach((s) => s.kill());
  stopHang();
  process.exit(code);
}

// The full suite, or (ONLY, FINISH, CHECKS) a part of it in one process.
const total = clock();
build({ down: true });
scenarios();
console.log(subset ? '\n▸ User journeys and platform checks' : `\n▸ User journeys and platform checks, in ${N} shards`);
const stopHang = startHang();
const servers = [];
let journeys; let platform; let problems = []; let consoleErrors = [];
if (subset || N === 1) {
  servers.push(...await startServers([[PORT], [PORT + 1, 'evals/out/dist-down']]));
  await journeysProc({ BASE: `http://localhost:${PORT}`, DOWN: `http://localhost:${PORT + 1}` });
  ({ journeys = [], platform = [] } = fs.existsSync(path.join(out, 'journeys.json')) ? read(path.join(out, 'journeys.json')) : {});
} else {
  const plans = shardPlan(N, journeyIds());
  console.log('Shard plan:\n' + plans.map((p) => `  shard ${p.k}/${N} (ports ${PORT + 3 * (p.k - 1)}–${PORT + 3 * (p.k - 1) + 1}): journeys ${p.journeys.join(' ')} · checks ${p.checks.join(' ')}`).join('\n'));
  const ports = plans.flatMap((p) => { const b = PORT + 3 * (p.k - 1); return [[b], [b + 1, 'evals/out/dist-down']]; });
  servers.push(...await startServers(ports));
  const done = plans.map(async (p) => {
    const b = PORT + 3 * (p.k - 1);
    const t = clock();
    const code = await journeysProc({ BASE: `http://localhost:${b}`, DOWN: `http://localhost:${b + 1}`, SHARD: `${p.k}/${N}` }, path.join(out, `shard-${p.k}.log`));
    console.log(`  shard ${p.k}/${N} finished in ${t()}s (exit ${code}); log: evals/out/shard-${p.k}.log`);
  });
  await Promise.all(done);
  const m = mergeShards(out);
  ({ journeys, platform, problems, consoleErrors } = m);
  console.log('Shards, as run:\n' + planText(m.shards));
  if (!problems.length) console.log(`  every one of ${journeys.length} journeys and ${platform.length} platform checks ran exactly once`);
  problems.forEach((x) => console.log(`  PROBLEM: ${x}`));
  // The shards' output, kept apart while they ran: show what failed.
  for (const p of plans) {
    const lines = fs.readFileSync(path.join(out, `shard-${p.k}.log`), 'utf8').split('\n');
    lines.forEach((l, i) => { if (/^FAIL /.test(l)) console.log(`  [shard ${p.k}] ${[l, ...lines.slice(i + 1).filter((x, j) => j < 3 && /^ {5}/.test(x))].join(' / ')}`); });
  }
  fs.writeFileSync(path.join(out, 'journeys.json'), JSON.stringify({ journeys, platform, consoleErrors }, null, 2));
}
servers.forEach((s) => s.kill());
stopHang();
const exit = scorecard({ journeys, platform, problems, scenariosFile: path.join(out, 'scenarios.json') });
console.log(`▸ Wall time ${total()}s`);
process.exit(exit);
