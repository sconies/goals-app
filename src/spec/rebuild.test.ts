// @vitest-environment node
/* The rebuild kit (backlog 8k): the drill harness scores Faro's own rules at 100% and names a difference when there is
   one; every module has a rebuild stage; stages come in an order each can be built in. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conformanceFiles, type ConformanceWorkspace } from './conformance';
import { moduleOrder, stages, type ModuleWithRebuild } from './rebuild';

const root = path.resolve(__dirname, '../..');
const drill = (...args: string[]) => spawnSync(process.execPath, [path.join(root, 'scripts/drill.mjs'), ...args], { encoding: 'utf8' });

describe('the drill harness (scripts/drill.mjs, copied to spec/rebuild/drill.mjs)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-test-'));
  const w = JSON.parse(fs.readFileSync(path.join(root, 'spec/conformance/workspace.json'), 'utf8')) as ConformanceWorkspace;
  const files = conformanceFiles(w);
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('scores Faro’s own rules, recomputed from workspace.json, at 100%', () => {
    for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), text);
    const r = drill(dir);
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain('Score: 100.0% of cells');
    expect(r.stdout).toContain('PASS');
    expect(r.status).toBe(0);
  }, 30_000);

  it('names the week, goal and column of a difference, counts a missing file, and fails', () => {
    const lines = files['status.csv']!.split('\n');
    const at = lines.findIndex((l) => l.startsWith('12,G-7,'));
    const cells = lines[at]!.split(',');
    cells[3] = cells[3] === 'off' ? 'on' : 'off';
    lines[at] = cells.join(',');
    fs.writeFileSync(path.join(dir, 'status.csv'), lines.join('\n'));
    fs.rmSync(path.join(dir, 'scorecard.csv'));
    const r = drill(dir, '--diffs', '5');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/status\.csv: 5695 of 5696 rows match/);
    expect(r.stdout).toMatch(/\(week 12, goal G-7\) status: expected/);
    expect(r.stdout).toMatch(/scorecard\.csv: 0 of \d+ rows match .*\n {2}! not written/);
  }, 30_000);

  it('matches numbers that differ only by rounding in the sixth decimal place, and rows in any order', () => {
    const [head, ...rows] = files['projection.csv']!.trimEnd().split('\n');
    const bumped = rows.map((l) => l.replace(/^(\d+,G-\d+,metric,\d+,)(-?\d+\.\d{6})(?=,)/, (_, a: string, v: string) => a + (Number(v) + 0.000001).toFixed(6)));
    expect(bumped).not.toEqual(rows);
    fs.writeFileSync(path.join(dir, 'projection.csv'), [head, ...bumped.reverse()].join('\n') + '\n');
    const r = drill(dir, '--files', 'projection');
    expect(r.stdout).toContain('projection.csv: 4822 of 4822 rows match');
    expect(r.status).toBe(0);
  }, 30_000);

  it('runs a rebuild through drill.json, handing it a copy of workspace.json on its own', () => {
    const rb = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-rebuild-'));
    fs.writeFileSync(path.join(rb, 'drill.json'), JSON.stringify({ stage: 1, run: 'node main.mjs' }));
    fs.writeFileSync(path.join(rb, 'main.mjs'), `import fs from 'node:fs'; import path from 'node:path';
const [w, out] = process.argv.slice(2);
const near = fs.readdirSync(path.dirname(w));
fs.writeFileSync(path.join(out, 'status.csv'), 'week,goal\\n');
fs.writeFileSync('seen.json', JSON.stringify({ near, ws: JSON.parse(fs.readFileSync(w, 'utf8')).builtFor }));`);
    const r = drill(rb, '--files', 'status', '--diffs', '0');
    expect(r.status).toBe(1);
    expect(JSON.parse(fs.readFileSync(path.join(rb, 'seen.json'), 'utf8'))).toEqual({ near: ['workspace.json'], ws: w.builtFor });
    expect(r.stdout).toMatch(/no column .*“kind”/);
    fs.rmSync(rb, { recursive: true, force: true });
  }, 30_000);
});

describe('rebuild stages', () => {
  it('has one for every feature module (scripts/check-rebuild.mjs, which CI runs)', () => {
    const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-rebuild.mjs')], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('puts a module after the modules it needs, and gives none to a module without a rebuild field', () => {
    const m = (id: string, needs: string[], rebuild = true) => ({ id, name: id, needs, rebuild: rebuild ? { status: 'outline', builds: 'x', entry: ['x'], exit: ['x'], gaps: [] } : undefined }) as unknown as ModuleWithRebuild;
    expect(moduleOrder([m('b', ['c']), m('a', ['b']), m('c', [])]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    const s = stages([m('maps', []), m('notes', [], false)]);
    expect(s.map((x) => x.file)).toEqual(['stage-1-core-rules.md', 'stage-2-core-data.md', 'stage-3-core-screens.md', 'stage-4-module-maps.md']);
    expect(s.filter((x) => x.status === 'drill').map((x) => x.n)).toEqual([1]);
  });
});
