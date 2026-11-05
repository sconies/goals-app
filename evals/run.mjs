/* Runs every eval and writes the scorecard: evals/report.md and evals/out/results.json.
   npm run evals   (builds the app, serves it, runs the spec scenarios, the user journeys and the platform checks)
   EVALS_PORT=4902 npm run evals   serves on 4902 and the two ports after it instead of 4318–4320, so two checkouts
   can run their evals side by side. */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'evals', 'out');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const PORT = Number(process.env.EVALS_PORT || 4318);
const sh = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

console.log('\n▸ Building the app, and a copy whose database never answers');
if (sh('npx', ['vite', 'build', '--logLevel', 'warn']).status !== 0) process.exit(2);
// The copy talks to a local server that accepts connections and never answers: a dead database that
// behaves the same on every machine (an unroutable address fails fast behind some proxies and hangs on others).
const HANG_PORT = PORT + 2;
sh('npx', ['vite', 'build', '--logLevel', 'error', '--outDir', 'evals/out/dist-down'], { VITE_SUPABASE_URL: `http://127.0.0.1:${HANG_PORT}`, VITE_SUPABASE_KEY: 'unused' });

console.log('\n▸ Spec scenarios');
sh('npx', ['vitest', 'run', '--config', 'evals/vitest.config.ts', '--reporter=default', '--reporter=json', '--outputFile=evals/out/scenarios.json']);

console.log('\n▸ User journeys and platform checks');
const serve = (port, dir) => spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', ...(dir ? ['--outDir', dir] : [])], { cwd: root, stdio: 'ignore' });
const servers = [serve(PORT), serve(PORT + 1, 'evals/out/dist-down')];
const sockets = new Set();
const hang = net.createServer((sock) => { sockets.add(sock); sock.on('close', () => sockets.delete(sock)); }).listen(HANG_PORT);
for (const port of [PORT, PORT + 1]) {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
}
sh('node', ['evals/journeys.cjs'], { BASE: `http://localhost:${PORT}`, DOWN: `http://localhost:${PORT + 1}` });
servers.forEach((s) => s.kill());
sockets.forEach((s) => s.destroy());
hang.close();

// Scorecard
const spec = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'requirements.json'), 'utf8'));
const scen = JSON.parse(fs.readFileSync(path.join(out, 'scenarios.json'), 'utf8'));
const { journeys = [], platform = [] } = fs.existsSync(path.join(out, 'journeys.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'journeys.json'), 'utf8')) : {};
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
md += `\n## Not built yet\n\n${spec.notYetBuilt.map((x) => `- ${x}`).join('\n')}\n`;
fs.writeFileSync(path.join(root, 'evals', 'report.md'), md);

console.log(`\n▸ Journeys: ${journeys.map((j) => `${j.id} ${j.score}`).join(' · ')}`);
console.log(`▸ Requirements: ${totals.pass}/${totals.requirements} pass, ${totals.fail} fail, ${totals.untested} untested · scenarios ${totals.scenarios.passed}/${totals.scenarios.run}`);
console.log('  Report: evals/report.md');
process.exit(totals.fail || totals.untested || totals.topFive.some((s) => s < 10) ? 1 : 0);
