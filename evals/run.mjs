/* Runs every eval and writes a scorecard by requirement: evals/report.md and evals/out/results.json.
   npm run evals   (builds the app, serves it, runs the spec scenarios and the browser journeys) */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'evals', 'out');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const PORT = 4318;
const sh = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

console.log('\n▸ Building the app');
if (sh('npx', ['vite', 'build', '--logLevel', 'warn']).status !== 0) process.exit(2);

console.log('\n▸ Spec scenarios');
sh('npx', ['vitest', 'run', '--config', 'evals/vitest.config.ts', '--reporter=default', '--reporter=json', '--outputFile=evals/out/scenarios.json']);

console.log('\n▸ Browser journeys');
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 200));
}
sh('node', ['evals/journeys.cjs'], { BASE: `http://localhost:${PORT}` });
server.kill();

// Scorecard
const spec = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'requirements.json'), 'utf8'));
const scen = JSON.parse(fs.readFileSync(path.join(out, 'scenarios.json'), 'utf8'));
const journeys = fs.existsSync(path.join(out, 'journeys.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'journeys.json'), 'utf8')) : [];
const cases = scen.testResults.flatMap((f) => f.assertionResults).map((t) => {
  const m = /^\[([A-Z0-9-]+)\] (.*)$/.exec(t.title) || [];
  return { req: m[1], title: m[2] || t.title, pass: t.status === 'passed', error: (t.failureMessages || [])[0]?.split('\n')[0] };
});

const rows = spec.requirements.map((r) => {
  const sc = cases.filter((c) => c.req === r.id);
  const jr = journeys.filter((j) => j.reqs.includes(r.id));
  const checks = sc.length + jr.length;
  const failed = sc.filter((c) => !c.pass).length + jr.filter((j) => !j.pass).length;
  return { ...r, scenarios: sc.length, journeys: jr.map((j) => j.id), checks, failed, verdict: !checks ? 'UNTESTED' : failed ? 'FAIL' : 'PASS' };
});
const totals = {
  requirements: rows.length,
  pass: rows.filter((r) => r.verdict === 'PASS').length,
  fail: rows.filter((r) => r.verdict === 'FAIL').length,
  untested: rows.filter((r) => r.verdict === 'UNTESTED').length,
  scenarios: { run: cases.length, passed: cases.filter((c) => c.pass).length },
  journeys: { run: journeys.length, passed: journeys.filter((j) => j.pass).length },
};
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ranAt: stamp, totals, requirements: rows, scenarios: cases, journeys }, null, 2));

const icon = { PASS: '✅', FAIL: '❌', UNTESTED: '⚪' };
let md = `# Eval scorecard · ${spec.slice}\n\nRun ${stamp}. **${totals.pass} of ${totals.requirements} requirements pass**`;
md += `${totals.fail ? `, ${totals.fail} fail` : ''}${totals.untested ? `, ${totals.untested} untested` : ''}. `;
md += `Spec scenarios ${totals.scenarios.passed}/${totals.scenarios.run}; browser journeys ${totals.journeys.passed}/${totals.journeys.run}.\n\n`;
md += `| | Requirement | Area | Scenarios | Journeys |\n|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${icon[r.verdict]} | **${r.id}** ${r.text} | ${r.area} | ${r.scenarios} | ${r.journeys.join(', ') || '—'} |\n`;
md += `\n## Browser journeys\n\n`;
for (const j of journeys) md += `- ${j.pass ? '✅' : '❌'} **${j.id}** ${j.title} _(${j.reqs.join(', ')})_${j.pass ? '' : `\n  - ${j.error}${j.screenshot ? ` (screenshot: \`${j.screenshot}\`)` : ''}`}\n`;
const failedCases = cases.filter((c) => !c.pass);
if (failedCases.length) {
  md += `\n## Failing scenarios\n\n`;
  for (const c of failedCases) md += `- **${c.req}** ${c.title}: ${c.error}\n`;
}
md += `\n## Not in this slice\n\n${spec.notYetBuilt.map((x) => `- ${x}`).join('\n')}\n`;
fs.writeFileSync(path.join(root, 'evals', 'report.md'), md);

console.log(`\n▸ Scorecard: ${totals.pass}/${totals.requirements} requirements pass, ${totals.fail} fail, ${totals.untested} untested · scenarios ${totals.scenarios.passed}/${totals.scenarios.run} · journeys ${totals.journeys.passed}/${totals.journeys.run}`);
console.log('  Report: evals/report.md');
process.exit(totals.fail || totals.untested ? 1 : 0);
