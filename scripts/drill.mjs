/* The drill harness for the rebuild kit (backlog 8k): runs a rebuilt implementation of a stage against the conformance
   data and scores it, file by file and column by column. Stage 1 (the core rules) is scored on its five files; stage 2
   (the change engine) on changes.csv and import.csv; stage 3 (the core screens' words) on navigation.csv, readback.csv,
   find.csv and home.csv. Plain Node (18 or later), no packages, so it
   runs from a copy of spec/ alone: `npm run spec` copies this file to spec/rebuild/drill.mjs.

     npm run drill -- <rebuild folder>            from the Faro repository (this file)
     node spec/rebuild/drill.mjs <rebuild folder> from a copy of the kit (spec/ and llms.txt)

   The contract, the same for any language (spec/rebuild/stage-1-core-rules.md says it in full):
     <rebuild folder>/drill.json  { "stage": 1, "run": "<command>" }   (stage 1, 2 or 3; 1 when left out)
     The harness runs <command> in the rebuild folder, with two arguments added: the path of a copy of workspace.json
     (in a folder of its own) and the path of a folder to write into (<rebuild folder>/drill-out, emptied first). The command writes the
     stage's files there (stage 1: status.csv, flags.csv, projection.csv, scorecard.csv and checkin.csv), with the columns
     spec/conformance/README.md lists, and exits 0.
   A folder with no drill.json but the five CSVs in it is scored as it is, without running anything.
   The port contracts (spec/conformance/contracts, its README says it in full): drill.json's "shim" is a command that
   answers one JSON request per line ({ port, op, args }) with one answer per line ({ ok } or { error }); the harness
   runs every contract there through it (or those listed under "contracts", or named by --contracts), case by case.
   With a "shim" and no "run", only the contracts are scored.
   find.csv (the find rules: what a search for a goal, a person or a team finds), goals.csv (the query port's answers to
   Goals queries: counts and every goal in order), navigation.csv (the menu, the lit
   item and a page's name), import.csv (the change engine's kinds, levels and sentences), changes.csv (what a change set
   would save: its counts, and each item with its fields before and after), readback.csv (New goal's
   read-back, stage 3) and home.csv (Home's lead or quiet line) are not part of stage 1,
   nor is metrics.csv (the metric library's rules 1 to 3, stage 4): beyond a stage's own files, each is scored only when
   drill.json lists it under "also" ({ "stage": 1, "run": "…", "also": ["find", "goals", "metrics"] }) or --files names it.

   Options:
     --files status,flags   score only these files (the others are listed as not scored)
     --diffs 10             how many differences to print (default 10; 0 for none)
     --expected <folder>    the conformance data (default: spec/conformance, found from where this file is)
     --timeout 600          seconds the command may take (default 600)
     --contracts search     run only these contracts through the shim
     --json                 print the scores as JSON instead of words
   Exits 0 only when every scored file matches every row and every column; 1 otherwise; 2 when it can't run. */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = ['status', 'flags', 'projection', 'scorecard', 'checkin'];
/** Files beyond stage 1's, scored only when asked for ("also" in drill.json, or --files). */
const ALSO = ['scorecard-words', 'find', 'goals', 'navigation', 'import', 'changes', 'metrics', 'readback', 'home', 'zone'];
/** What each stage's drill scores by default: stage 1 the core rules, stage 2 the change engine (what it raises and what
    it would save), stage 3 the screens' words (the menu and page names, New goal's read-back, Find, Home's lead). */
const STAGES = { 1: FILES, 2: ['changes', 'import'], 3: ['navigation', 'readback', 'find', 'home'] };
/** The columns that name a row: a row in the rebuild's file is matched to the expected row with the same values in them. */
const KEYS = { status: ['week', 'goal'], flags: ['week', 'goal'], projection: ['week', 'goal'], scorecard: ['week', 'goal', 'cell'], 'scorecard-words': ['week', 'goal', 'cell'], checkin: ['checkin'], find: ['kind', 'q'], goals: ['query'], navigation: ['viewer', 'address'], import: ['case'], changes: ['case', 'row'], readback: ['case'], metrics: ['rule', 'ask', 'row'], home: ['viewer', 'day'], zone: ['moment', 'goal'] };
/** Numbers are written with up to 6 decimal places, so two that differ by rounding in the last place still match. */
const TOLERANCE = 1.5e-6;

/* ---------- CSV ---------- */

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and new lines. CRLF or LF; a last empty line is ignored. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------- scoring ---------- */

const isNum = (s) => s !== '' && /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s.trim());
export const same = (want, got) => want === got || (isNum(want) && isNum(got) && Math.abs(Number(want) - Number(got)) <= TOLERANCE);

/**
 * Scores one file. `want` and `got` are parsed CSV (header first). Rows are matched by their key columns (the second
 * row with the same key matches the second expected one). Every column is scored over the expected rows: a missing row
 * misses in every column.
 */
export function scoreFile(name, want, got) {
  const head = want[0];
  const keyCols = KEYS[name] ?? head.slice(0, 2);
  const res = { file: `${name}.csv`, rows: want.length - 1, matchedRows: 0, missing: 0, extra: 0, columns: head.map((c) => ({ column: c, matched: 0 })), problems: [], diffs: [] };
  if (!got) { res.problems.push('not written'); res.missing = res.rows; return res; }
  const gotHead = (got[0] ?? []).map((c) => c.trim());
  const at = head.map((c) => gotHead.indexOf(c));
  const absent = head.filter((_, i) => at[i] < 0);
  if (absent.length) res.problems.push(`no column ${absent.map((c) => `“${c}”`).join(', ')} in its header row`);
  const extraCols = gotHead.filter((c) => c && !head.includes(c));
  if (extraCols.length) res.problems.push(`columns not in the conformance data (ignored): ${extraCols.join(', ')}`);
  if (absent.some((c) => keyCols.includes(c))) { res.missing = res.rows; res.problems.push(`can’t match rows without ${keyCols.join(', ')}`); return res; }
  const keyOf = (cells, idx) => keyCols.map((c) => cells[idx(c)] ?? '').join('\u0001');
  const wantIdx = (c) => head.indexOf(c);
  const gotIdx = (c) => gotHead.indexOf(c);
  const pool = new Map();
  for (let r = 1; r < got.length; r++) {
    if (got[r].length === 1 && got[r][0] === '') continue;
    const k = keyOf(got[r], gotIdx);
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(r);
  }
  const used = new Set();
  for (let r = 1; r < want.length; r++) {
    const w = want[r];
    const k = keyOf(w, wantIdx);
    const list = pool.get(k);
    const gr = list?.shift();
    const where = keyCols.map((c) => `${c} ${w[wantIdx(c)]}`).join(', ');
    if (gr == null) { res.missing++; res.diffs.push({ row: r + 1, where, column: '(whole row)', want: w.join(','), got: '(missing)' }); continue; }
    used.add(gr);
    const g = got[gr];
    let all = true;
    head.forEach((c, i) => {
      const gv = at[i] < 0 ? undefined : (g[at[i]] ?? '');
      if (gv !== undefined && same(w[i], gv)) res.columns[i].matched++;
      else { all = false; res.diffs.push({ row: r + 1, where, column: c, want: w[i], got: gv === undefined ? '(no column)' : gv }); }
    });
    if (all) res.matchedRows++;
  }
  for (let r = 1; r < got.length; r++) {
    if (used.has(r) || (got[r].length === 1 && got[r][0] === '')) continue;
    res.extra++;
    res.diffs.push({ row: null, gotRow: r + 1, where: keyCols.map((c) => `${c} ${got[r][gotIdx(c)] ?? ''}`).join(', '), column: '(whole row)', want: '(no such row expected)', got: got[r].join(',') });
  }
  return res;
}

/** Scores the rebuild's files against the expected ones: { files, cells, matchedCells, pass }. */
export function scoreAll(expected, actual, only = FILES) {
  const files = only.map((n) => scoreFile(n, expected[n], actual[n]));
  const cells = files.reduce((s, f) => s + f.rows * f.columns.length, 0);
  const matchedCells = files.reduce((s, f) => s + f.columns.reduce((t, c) => t + c.matched, 0), 0);
  const pass = files.every((f) => f.matchedRows === f.rows && f.extra === 0 && f.problems.every((p) => p.startsWith('columns not in')));
  return { files, cells, matchedCells, pass };
}

/* ---------- words ---------- */

const pct = (a, b) => (b === 0 ? '100%' : `${(Math.floor((a / b) * 1000) / 10).toFixed(1)}%`);

export function report(score, { diffs = 10, skipped = [] } = {}) {
  const out = [];
  for (const f of score.files) {
    out.push(`${f.file}: ${f.matchedRows} of ${f.rows} rows match (${pct(f.matchedRows, f.rows)})${f.missing ? `, ${f.missing} missing` : ''}${f.extra ? `, ${f.extra} not expected` : ''}`);
    for (const p of f.problems) out.push(`  ! ${p}`);
    if (!f.problems.includes('not written')) out.push('  ' + f.columns.map((c) => `${c.column} ${pct(c.matched, f.rows)}`).join(' · '));
  }
  for (const s of skipped) out.push(`${s}.csv: not scored (--files)`);
  out.push('');
  out.push(`Score: ${pct(score.matchedCells, score.cells)} of cells (${score.matchedCells} of ${score.cells}); ${score.files.reduce((s, f) => s + f.matchedRows, 0)} of ${score.files.reduce((s, f) => s + f.rows, 0)} rows. ${score.pass ? 'PASS: every row and column matches.' : 'Not yet: see the first differences below.'}`);
  if (!score.pass && diffs > 0 && score.files.some((f) => f.diffs.length)) {
    out.push('', `First differences (up to ${diffs} per file; row numbers are lines in the expected file, header = line 1):`);
    for (const f of score.files) {
      if (!f.diffs.length) continue;
      out.push(`  ${f.file}`);
      for (const d of f.diffs.slice(0, diffs)) {
        out.push(d.row ? `    line ${d.row} (${d.where}) ${d.column}: expected ${JSON.stringify(d.want)}, got ${JSON.stringify(d.got)}`
          : `    your line ${d.gotRow} (${d.where}): ${d.want}`);
      }
      if (f.diffs.length > diffs) out.push(`    … and ${f.diffs.length - diffs} more`);
    }
  }
  return out.join('\n');
}

/* ---------- port contracts (spec/conformance/contracts) ---------- */

/** Equal as JSON: the same keys (a key holding undefined counts as left out), the same values, lists in order. */
export function sameJson(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameJson(a[k], b[k]));
}

/** At least `want`: an object's keys as deep as given, a list's items one for one; anything else equal. */
function hasJson(want, got) {
  if (Array.isArray(want)) return Array.isArray(got) && got.length === want.length && want.every((w, i) => hasJson(w, got[i]));
  if (want && typeof want === 'object') return !!got && typeof got === 'object' && !Array.isArray(got) && Object.keys(want).every((k) => hasJson(want[k], got[k]));
  return sameJson(want, got);
}

/** A path into an answer: `total`, `rows[0].name`, `rows[].id` (each row's id), `[].id` when the answer is a list. */
export function selectPath(path, value) {
  const parts = path.match(/[^.[\]]+|\[\d*\]/g) ?? [];
  const walk = (v, i) => {
    if (i === parts.length) return v;
    const p = parts[i];
    if (p === '[]') return Array.isArray(v) ? v.map((x) => walk(x, i + 1)) : undefined;
    if (p.startsWith('[')) return Array.isArray(v) ? walk(v[Number(p.slice(1, -1))], i + 1) : undefined;
    return v && typeof v === 'object' ? walk(v[p], i + 1) : undefined;
  };
  return walk(value, 0);
}

const show = (v) => (v === undefined ? 'nothing' : JSON.stringify(v));

/** What is wrong with an outcome ({ ok: answer } or { error: words }) by `then`: an empty list when it holds. */
export function checkThen(t, outcome) {
  const out = [];
  if (t.throws) return 'error' in outcome ? [] : [`expected a refusal, got ${show(outcome.ok)}`];
  if ('error' in outcome) return [`refused: ${outcome.error}`];
  const v = t.select ? selectPath(t.select, outcome.ok) : outcome.ok;
  const at = t.select ? `${t.select}: ` : '';
  if ('equals' in t && !sameJson(t.equals, v)) out.push(`${at}expected ${show(t.equals)}, got ${show(v)}`);
  if ('has' in t && !hasJson(t.has, v)) out.push(`${at}expected at least ${show(t.has)}, got ${show(v)}`);
  const list = Array.isArray(v) ? v : null;
  for (const x of t.includes ?? []) if (!list?.some((y) => sameJson(x, y))) out.push(`${at}expected ${show(x)} in ${show(v)}`);
  for (const x of t.excludes ?? []) if (!list || list.some((y) => sameJson(x, y))) out.push(`${at}expected no ${show(x)} in ${show(v)}`);
  if (t.length != null && (v == null || v.length !== t.length)) out.push(`${at}expected ${t.length} long, got ${v == null ? 'nothing' : v.length}`);
  if (t.maxLength != null && (v == null || v.length > t.maxLength)) out.push(`${at}expected at most ${t.maxLength} long, got ${v == null ? 'nothing' : v.length}`);
  if (t.distinct && (!list || new Set(list.map((x) => JSON.stringify(x))).size !== list.length)) out.push(`${at}expected no item twice in ${show(v)}`);
  if (t.ordered) {
    const bad = !list ? -1 : list.findIndex((x, i) => i > 0 && (t.ordered === 'text' ? String(list[i - 1]).localeCompare(String(x)) > 0 : (t.ordered.rank[list[i - 1]] ?? 0) < (t.ordered.rank[x] ?? 0)));
    if (!list) out.push(`${at}expected a list, got ${show(v)}`);
    else if (bad > 0) out.push(`${at}out of order at ${bad}: ${show(list[bad - 1])} before ${show(list[bad])}`);
  }
  if (t.absent && v != null) out.push(`${at}expected nothing, got ${show(v)}`);
  for (const sub of t.all ?? []) out.push(...checkThen(sub, outcome));
  if (t.anyOf && !t.anyOf.some((sub) => checkThen(sub, outcome).length === 0)) out.push(`none of the allowed answers: ${t.anyOf.map((sub) => checkThen(sub, outcome).join('; ')).join(' | or | ')}`);
  return out;
}

/**
 * Runs a contract's cases (or those named in `only`) through `call(request)`, which answers { ok } or { error }. Each
 * case first sends { port, op: 'given', args: [given] }, so the shim starts it from a fresh port; then each step's
 * { port, op, args }. Returns each case with what went wrong (none when it passes).
 */
export async function runContract(contract, call, only = null) {
  const results = [];
  for (const c of contract.cases) {
    if (only && !only.includes(c.name)) continue;
    const problems = [];
    const given = await call({ port: contract.port, op: 'given', args: [c.given !== undefined ? c.given : contract.given] });
    if ('error' in given) problems.push(`couldn’t start from its given: ${given.error}`);
    else {
      for (const [i, s] of c.steps.entries()) {
        const where = c.steps.length > 1 ? `step ${i + 1} (${s.when.op}): ` : '';
        if (!s.pages) { for (const p of checkThen(s.then, await call({ port: contract.port, op: s.when.op, args: s.when.args ?? [] }))) problems.push(where + p); continue; }
        const args = JSON.parse(JSON.stringify(s.when.args ?? []));
        const rows = [];
        let pages = 0, failed = false;
        while (pages < s.pages.max) {
          const o = await call({ port: contract.port, op: s.when.op, args });
          pages++;
          if ('error' in o) { problems.push(`${where}page ${pages}: refused: ${o.error}`); failed = true; break; }
          if (s.pages.each) for (const p of checkThen(s.pages.each, o)) problems.push(`${where}page ${pages}: ${p}`);
          rows.push(...(o.ok?.rows ?? []));
          if (!o.ok?.next) break;
          args[s.pages.arg] = { ...(args[s.pages.arg] ?? {}), after: o.ok.next };
        }
        if (!failed) for (const p of checkThen(s.then, { ok: { pages, rows } })) problems.push(where + p);
      }
    }
    results.push({ name: c.name, pass: problems.length === 0, problems });
  }
  return results;
}

/** Starts a shim (`command`, run in `cwd`): one JSON request per line on its stdin, one answer per line on its stdout. */
export function openShim(command, cwd, timeoutSeconds = 30) {
  const child = spawn(command, { cwd, shell: true, stdio: ['pipe', 'pipe', 'inherit'] });
  let buffer = '', waiting = null, ended = null;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    buffer += d;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line || !waiting) continue;
      const w = waiting; waiting = null;
      try { const a = JSON.parse(line); w('error' in a ? { error: String(a.error) } : { ok: a.ok }); } catch { w({ error: `not a JSON answer: ${line.slice(0, 200)}` }); }
    }
  });
  const stop = (why) => { ended = why; if (waiting) { const w = waiting; waiting = null; w({ error: why }); } };
  child.on('exit', (code) => stop(`the shim stopped (exit ${code})`));
  child.on('error', (e) => stop(`the shim didn’t start: ${e.message}`));
  return {
    call: (req) => new Promise((resolve) => {
      if (ended) return resolve({ error: ended });
      const timer = setTimeout(() => { if (waiting) { waiting = null; resolve({ error: `no answer in ${timeoutSeconds} s` }); } }, timeoutSeconds * 1000);
      waiting = (a) => { clearTimeout(timer); resolve(a); };
      child.stdin.write(JSON.stringify(req) + '\n');
    }),
    close: () => { child.stdin.end(); if (!ended) child.kill(); },
  };
}

/* ---------- running a rebuild ---------- */

const here = path.dirname(fileURLToPath(import.meta.url));
/** spec/conformance: next to this file's folder in a copy of spec/ (spec/rebuild/drill.mjs), or under spec/ from scripts/. */
const defaultExpected = () => [path.join(here, '..', 'conformance'), path.join(here, '..', 'spec', 'conformance')].find((d) => fs.existsSync(path.join(d, 'workspace.json')));

const readCsvs = (dir) => Object.fromEntries([...FILES, ...ALSO].map((n) => [n, fs.existsSync(path.join(dir, `${n}.csv`)) ? parseCsv(fs.readFileSync(path.join(dir, `${n}.csv`), 'utf8')) : null]));
const quote = (s) => (process.platform === 'win32' ? `"${s}"` : `'${s.replace(/'/g, `'\\''`)}'`);

async function main(argv) {
  const opt = { diffs: 10, timeout: 600, files: null, json: false, expected: null, target: null, contracts: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diffs') opt.diffs = Number(argv[++i]);
    else if (a === '--timeout') opt.timeout = Number(argv[++i]);
    else if (a === '--files') opt.files = argv[++i].split(',').map((s) => s.trim().replace(/\.csv$/, '')).filter(Boolean);
    else if (a === '--expected') opt.expected = argv[++i];
    else if (a === '--json') opt.json = true;
    else if (a === '--contracts') opt.contracts = argv[++i].split(',').map((s) => s.trim().replace(/\.json$/, '')).filter(Boolean);
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); return 0; }
    else if (!opt.target) opt.target = a;
    else { console.error(`Unknown argument: ${a}`); return 2; }
  }
  if (!opt.target) { console.error('Usage: npm run drill -- <rebuild folder> [--files status,flags] [--diffs 10] (or node spec/rebuild/drill.mjs <rebuild folder>)'); return 2; }
  const bad = (opt.files ?? []).filter((f) => !FILES.includes(f) && !ALSO.includes(f));
  if (bad.length) { console.error(`--files takes ${[...FILES, ...ALSO].join(', ')}; not ${bad.join(', ')}`); return 2; }
  const expectedDir = opt.expected ? path.resolve(opt.expected) : defaultExpected();
  if (!expectedDir || !fs.existsSync(path.join(expectedDir, 'workspace.json'))) { console.error('Can’t find the conformance data (spec/conformance/workspace.json). Pass --expected <folder>.'); return 2; }
  const target = path.resolve(opt.target);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) { console.error(`No folder at ${target}`); return 2; }

  const say = (s) => { if (!opt.json) console.log(s); };
  let outDir = target, ran = null, shim = null;
  const manifest = path.join(target, 'drill.json');
  let m = null;
  if (fs.existsSync(manifest)) {
    try { m = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch (e) { console.error(`drill.json isn’t JSON: ${e.message}`); return 2; }
    if (typeof m.shim === 'string' && m.shim.trim()) shim = m.shim;
    if ((typeof m.run !== 'string' || !m.run.trim()) && !shim) { console.error('drill.json needs "run": the command that writes the five CSV files, e.g. { "stage": 1, "run": "node main.mjs" }, or "shim": the command that answers the port contracts'); return 2; }
  }
  if (m && typeof m.run === 'string' && m.run.trim()) {
    const stage = m.stage ?? 1;
    if (!STAGES[stage]) { console.error(`drill.json says stage ${stage}; this harness scores stages ${Object.keys(STAGES).join(', ')} (spec/rebuild/README.md says which stages have a drill).`); return 2; }
    if (!opt.files) opt.files = [...new Set([...STAGES[stage], ...(Array.isArray(m.also) ? m.also.filter((f) => ALSO.includes(f) || FILES.includes(f)) : [])])];
    outDir = path.join(target, 'drill-out');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    // A copy on its own, so the expected CSV files are not beside the input the rebuild is given.
    const workspace = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'faro-drill-')), 'workspace.json');
    fs.copyFileSync(path.join(expectedDir, 'workspace.json'), workspace);
    const cmd = `${m.run} ${quote(workspace)} ${quote(outDir)}`;
    say(`Running in ${target}:\n  ${cmd}`);
    const t0 = Date.now();
    const r = spawnSync(cmd, { cwd: target, shell: true, stdio: opt.json ? ['ignore', 'ignore', 'inherit'] : 'inherit', timeout: opt.timeout * 1000 });
    ran = { command: cmd, seconds: (Date.now() - t0) / 1000, exit: r.status, error: r.error?.message ?? null };
    fs.rmSync(path.dirname(workspace), { recursive: true, force: true });
    if (r.error || r.status !== 0) {
      console.error(r.error?.code === 'ETIMEDOUT' ? `It took longer than ${opt.timeout} s and was stopped.` : `It exited with ${r.status ?? r.signal}${r.error ? `: ${r.error.message}` : ''}. Scoring whatever it wrote.`);
    } else say(`Finished in ${ran.seconds.toFixed(1)} s.`);
  } else if (!m) say(`No drill.json in ${target}: scoring the CSV files already there.`);

  // The port contracts: through drill.json's "shim", every contract in spec/conformance/contracts (or those it lists
  // under "contracts", or --contracts names).
  let contracts = null;
  if (shim) {
    const dir = path.join(expectedDir, 'contracts');
    const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : [];
    const names = opt.contracts ?? (Array.isArray(m.contracts) ? m.contracts : all);
    const unknown = names.filter((n) => !all.includes(n));
    if (unknown.length) { console.error(`No contract ${unknown.join(', ')} in ${dir}; there are ${all.join(', ') || 'none'}.`); return 2; }
    say(`Running the contracts through the shim, in ${target}:\n  ${shim}`);
    const open = openShim(shim, target);
    contracts = [];
    try {
      for (const n of names) contracts.push({ contract: n, cases: await runContract(JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), 'utf8')), open.call) });
    } finally { open.close(); }
  }

  const scoreCsv = !m || (typeof m.run === 'string' && m.run.trim()) || opt.files;
  let score = null, skipped = [];
  if (scoreCsv) {
    if (!opt.files) opt.files = FILES;
    score = scoreAll(readCsvs(expectedDir), readCsvs(outDir), opt.files);
    skipped = FILES.filter((f) => !opt.files.includes(f) && opt.files.some((g) => FILES.includes(g)));
  }
  const contractsPass = !contracts || contracts.every((c) => c.cases.every((x) => x.pass));
  if (opt.json) console.log(JSON.stringify({ ran, pass: (!score || score.pass) && contractsPass, ...(score ? { cells: score.cells, matchedCells: score.matchedCells, files: score.files.map(({ diffs, ...f }) => ({ ...f, firstDiffs: diffs.slice(0, opt.diffs) })), notScored: skipped } : {}), ...(contracts ? { contracts } : {}) }, null, 2));
  else {
    if (score) say('\n' + report(score, { diffs: opt.diffs, skipped }));
    if (contracts) say('\n' + contractReport(contracts, opt.diffs));
  }
  return (!score || score.pass) && contractsPass && (!ran || ran.exit === 0) ? 0 : 1;
}

/** The contracts' results in words: each contract's count, then each failing case with what went wrong. */
export function contractReport(contracts, diffs = 10) {
  const out = [];
  for (const c of contracts) {
    const passed = c.cases.filter((x) => x.pass).length;
    out.push(`contracts/${c.contract}.json: ${passed} of ${c.cases.length} cases pass`);
    for (const x of c.cases.filter((y) => !y.pass)) {
      out.push(`  ✗ ${x.name}`);
      for (const p of x.problems.slice(0, Math.max(1, diffs))) out.push(`      ${p}`);
    }
  }
  const all = contracts.flatMap((c) => c.cases);
  out.push('', `Contracts: ${all.filter((x) => x.pass).length} of ${all.length} cases pass. ${all.every((x) => x.pass) ? 'PASS: every case holds.' : 'Not yet: see the cases above.'}`);
  return out.join('\n');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
