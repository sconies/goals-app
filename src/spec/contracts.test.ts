// @vitest-environment node
/* The port contracts as data (gap 1(b)): the harness's checks catch a wrong answer and pass a right one, and the drill
   runs every contract through a shim, naming the case a wrong build fails. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkThen, runContract } from '../../scripts/drill.mjs';
import { contracts } from './contracts';
import { PREFS_CONTRACT } from '../ports/contracts/cases/prefs';
import { SEARCH_CONTRACT, WORST_FIRST } from '../ports/contracts/cases/search';
import { memoryStore, seededSearch } from '../adapters/contractPorts';
import { STORE_CONTRACT } from '../ports/contracts/cases/store';
import { storeStart } from '../ports/contracts/store';
import { BrowserStore } from '../data/store';
import { caller, methods } from '../ports/contracts/cases/run';
import { searchStart } from '../ports/contracts/search';
import type { Search } from '../ports/search';
import { GOALS_CONTRACT, goalsStart } from '../ports/contracts/goals';
import { localGoals } from '../adapters/localGoals';
import { goalRows, scopeFacts } from '../app/reads';
import { currentWeek } from '../domain/plan';
import { asOf, type ConformanceWorkspace } from './conformance';
import conformanceJson from '../../spec/conformance/workspace.json';

const conf = conformanceJson as unknown as ConformanceWorkspace;
const at = new Date(conf.builtFor);

const root = path.resolve(__dirname, '../..');

describe('the port contracts as data (spec/conformance/contracts)', () => {
  it('checks an answer by every kind of then', () => {
    const ok = (v: unknown) => ({ ok: v });
    expect(checkThen({ select: 'rows[].id', equals: ['a', 'b'] }, ok({ rows: [{ id: 'a' }, { id: 'b' }] }))).toEqual([]);
    expect(checkThen({ select: 'rows[].id', equals: ['b', 'a'] }, ok({ rows: [{ id: 'a' }, { id: 'b' }] }))).toHaveLength(1);
    expect(checkThen({ has: { a: 1 } }, ok({ a: 1, b: 2 }))).toEqual([]);
    expect(checkThen({ has: [{ a: 1 }] }, ok([{ a: 1 }, { a: 2 }]))).toHaveLength(1);
    expect(checkThen({ includes: ['x'], excludes: ['y'] }, ok(['x', 'z']))).toEqual([]);
    expect(checkThen({ excludes: ['y'] }, ok(['y']))).toHaveLength(1);
    expect(checkThen({ length: 2, maxLength: 1 }, ok([1, 2]))).toHaveLength(1);
    expect(checkThen({ distinct: true }, ok([1, 1]))).toHaveLength(1);
    expect(checkThen({ ordered: { rank: WORST_FIRST } }, ok(['off', 'stale', 'risk', 'on', 'none']))).toEqual([]);
    expect(checkThen({ ordered: { rank: WORST_FIRST } }, ok(['risk', 'off']))).toHaveLength(1);
    expect(checkThen({ ordered: 'text' }, ok(['Ana', 'Lucía', 'Mei']))).toEqual([]);
    expect(checkThen({ throws: true }, { error: 'no' })).toEqual([]);
    expect(checkThen({ throws: true }, ok(null))).toHaveLength(1);
    expect(checkThen({}, { error: 'no' })).toEqual(['refused: no']);
    expect(checkThen({ select: 'near', absent: true }, ok({ total: 0 }))).toEqual([]);
    expect(checkThen({ anyOf: [{ equals: 1 }, { equals: 2 }] }, ok(2))).toEqual([]);
    expect(checkThen({ anyOf: [{ equals: 1 }, { equals: 2 }] }, ok(3))).toHaveLength(1);
    expect(checkThen({ anyOf: [{}, { throws: true }] }, { error: 'no' })).toEqual([]);
    expect(checkThen({ anyOf: [{ equals: 1 }] }, { error: 'no' })).toEqual(['refused: no']);
    expect(checkThen({ matches: '^\\S{3,}$' }, ok('abcd'))).toEqual([]);
    expect(checkThen({ matches: '^\\S{3,}$' }, ok('a b'))).toHaveLength(1);
    expect(checkThen({ select: 'goals[id=g2].title', equals: 'Two' }, ok({ goals: [{ id: 'g1', title: 'One' }, { id: 'g2', title: 'Two' }] }))).toEqual([]);
    expect(checkThen({ select: 'goals[id=g3].title', absent: true }, ok({ goals: [{ id: 'g1' }] }))).toEqual([]);
  });

  it('fails a store that ignores the window it is asked for, naming the case', async () => {
    const whole = storeStart(async () => { const s = await memoryStore(); return Object.assign(s, { load: (id: string) => BrowserStore.prototype.load.call(s, id) }); });
    const failed = (await runContract(STORE_CONTRACT, caller({ store: whole }))).filter((r) => !r.pass);
    // Both window cases: the one that narrows, and the one that keeps the newest two cycles however far back it starts.
    expect(failed.map((r) => r.name)).toEqual(STORE_CONTRACT.cases.filter((c) => c.name.startsWith('narrows a load') || c.name.startsWith('keeps the newest two')).map((c) => c.name));
  }, 60_000);

  it('pages by another option and list when a step names them (the store’s history: before, changes)', async () => {
    const log = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}` }));
    const seen: unknown[] = [];
    const call = async (r: { op: string; args: unknown[] }) => {
      if (r.op === 'given') return { ok: null };
      const ask = r.args[1] as { before?: number };
      seen.push(ask.before ?? null);
      const from = ask.before ?? 0;
      return { ok: { changes: log.slice(from, from + 2), next: from + 2 < log.length ? from + 2 : null } };
    };
    const contract = { port: 'p', about: '', ops: {}, given: null, cases: [{ name: 'pages', steps: [{ when: { op: 'history', args: ['ws', {}] }, pages: { arg: 1, max: 10, key: 'before', rows: 'changes' }, then: { all: [{ select: 'rows[].id', equals: log.map((c) => c.id) }, { select: 'pages', equals: 3 }] } }] }] };
    const [r] = await runContract(contract, call);
    expect(r!.problems).toEqual([]);
    expect(seen).toEqual([null, 2, 4]);
  });

  it('fails a search that breaks a rule, naming the case', async () => {
    // Best first instead of worst first, and one person too many on the last page.
    const wrong = (seed: Parameters<typeof seededSearch>[0]): Search => {
      const s = seededSearch(seed);
      return { ...s, kinds: s.kinds, async search(kind, ask) { const a = await s.search(kind, ask); return kind === 'goal' && !ask.q ? { ...a, rows: [...a.rows].reverse() } : a; } };
    };
    const results = await runContract(SEARCH_CONTRACT, caller({ search: searchStart(wrong) }));
    expect(results.filter((r) => !r.pass).map((r) => r.name)).toEqual(['takes a Goals link’s filters and sort, and orders goals worst first when unsorted']);
    expect(results.find((r) => !r.pass)!.problems[0]).toMatch(/rows\[\]\.status: out of order/);
  });

  it('fails a goals port that moves the next page when a goal is added between pages, naming the case', async () => {
    // A port that pages by position, not by key: the goal added first pushes the next page one row along.
    const results = await runContract(GOALS_CONTRACT(), caller({ goals: goalsStart(async () => asOf(conf, at), async (s, viewer) => {
      const rows = goalRows(s, conf.cycle, at, currentWeek(conf.cycle, at));
      const real = localGoals(() => rows, () => scopeFacts(s, { id: viewer, teamId: s.people.find((p) => p.id === viewer)?.teamId ?? null }));
      return { ...real, async goals(ask) {
        if (!ask.after) return real.goals(ask);
        const all = (await real.goals({ ...ask, after: null, size: 10_000 })).total;
        const everyRow = [] as Awaited<ReturnType<typeof real.goals>>['rows'];
        let next: string | null = null;
        do { const p = await real.goals({ ...ask, after: next, size: 50 }); everyRow.push(...p.rows); next = p.next; } while (next);
        const from = Number(ask.after);
        const size = ask.size ?? 50;
        return { rows: everyRow.slice(from, from + size), next: from + size < all ? String(from + size) : null, total: all };
      } };
    }) }));
    expect(results.filter((r) => !r.pass).map((r) => r.name)).toContain('pages by key: every goal once and none twice, and a goal added between pages doesn’t move the next page');
  });

  it('writes every contract to the kit as it is in the code', () => {
    const conformance = (f: string) => fs.readFileSync(path.join(root, 'spec/conformance', f), 'utf8');
    for (const c of contracts(conformance)) expect(JSON.parse(fs.readFileSync(path.join(root, `spec/conformance/contracts/${c.port}.json`), 'utf8'))).toEqual(JSON.parse(JSON.stringify(c)));
  });

  it('runs every contract through a build’s shim, and fails one that forgets on reopening', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-shim-'));
    try {
      // A prefs-only shim in plain Node that keeps its values in the page, so reopening loses them.
      fs.writeFileSync(path.join(dir, 'shim.mjs'), [
        "import readline from 'node:readline';",
        'let kept = new Map();',
        "for await (const line of readline.createInterface({ input: process.stdin })) {",
        '  const { op, args } = JSON.parse(line);',
        "  const k = JSON.stringify(args.slice(0, 3));",
        "  let ok = null;",
        "  if (op === 'given' || op === 'reopen') kept = new Map();",
        "  else if (op === 'get') ok = kept.has(k) ? kept.get(k) : null;",
        "  else if (op === 'set') { if (args[3] === null) kept.delete(k); else kept.set(k, args[3]); }",
        "  process.stdout.write(JSON.stringify({ ok }) + '\\n');",
        '}',
      ].join('\n'));
      fs.writeFileSync(path.join(dir, 'drill.json'), JSON.stringify({ shim: 'node shim.mjs', contracts: ['prefs'] }));
      const r = spawnSync(process.execPath, [path.join(root, 'scripts/drill.mjs'), dir], { encoding: 'utf8' });
      expect(r.stdout).toContain(`contracts/prefs.json: ${PREFS_CONTRACT.cases.length - 1} of ${PREFS_CONTRACT.cases.length} cases pass`);
      expect(r.stdout).toContain('✗ keeps a value when the store is opened again');
      expect(r.stdout).not.toContain('Score:');
      expect(r.status).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('opens a port’s methods by name, and refuses an operation it hasn’t', () => {
    const port = methods({ hello: (n: string) => `hi ${n}` });
    expect(port('hello', ['Ada'])).toBe('hi Ada');
    expect(() => port('bye', [])).toThrow();
  });
});
