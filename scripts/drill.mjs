/* The drill harness for the rebuild kit (backlog 8k): runs a rebuilt implementation of stage 1 (the core rules) against
   the conformance data and scores it, file by file and column by column. Plain Node (18 or later), no packages, so it
   runs from a copy of spec/ alone: `npm run spec` copies this file to spec/rebuild/drill.mjs.

     npm run drill -- <rebuild folder>            from the Faro repository (this file)
     node spec/rebuild/drill.mjs <rebuild folder> from a copy of the kit (spec/ and llms.txt)

   The contract, the same for any language (spec/rebuild/stage-1-core-rules.md says it in full):
     <rebuild folder>/drill.json  { "stage": 1, "run": "<command>" }
     The harness runs <command> in the rebuild folder, with two arguments added: the path of a copy of workspace.json
     (in a folder of its own) and the path of a folder to write into (<rebuild folder>/drill-out, emptied first). The command writes status.csv,
     flags.csv, projection.csv, scorecard.csv and checkin.csv there, with the columns spec/conformance/README.md lists, and exits 0.
   A folder with no drill.json but the five CSVs in it is scored as it is, without running anything.
   find.csv (the find rules: what a search for a goal, a person or a team finds), goals.csv (the query port's answers to
   Goals queries: counts and every goal in order), navigation.csv (the menu, the lit
   item and a page's name), import.csv (the change engine's kinds, levels and sentences) and readback.csv (New goal's
   read-back, stage 3) are not part of stage 1,
   nor is metrics.csv (the metric library's rules 1 to 3, stage 4): each is scored only when drill.json lists it under
   "also" ({ "stage": 1, "run": "…", "also": ["find", "goals", "navigation", "import", "metrics", "readback"] }) or --files names it.

   Options:
     --files status,flags   score only these files (the others are listed as not scored)
     --diffs 10             how many differences to print (default 10; 0 for none)
     --expected <folder>    the conformance data (default: spec/conformance, found from where this file is)
     --timeout 600          seconds the command may take (default 600)
     --json                 print the scores as JSON instead of words
   Exits 0 only when every scored file matches every row and every column; 1 otherwise; 2 when it can't run. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = ['status', 'flags', 'projection', 'scorecard', 'checkin'];
/** Files beyond stage 1's, scored only when asked for ("also" in drill.json, or --files). */
const ALSO = ['scorecard-words', 'find', 'goals', 'navigation', 'import', 'metrics', 'readback'];
/** The columns that name a row: a row in the rebuild's file is matched to the expected row with the same values in them. */
const KEYS = { status: ['week', 'goal'], flags: ['week', 'goal'], projection: ['week', 'goal'], scorecard: ['week', 'goal', 'cell'], 'scorecard-words': ['week', 'goal', 'cell'], checkin: ['checkin'], find: ['kind', 'q'], goals: ['query'], navigation: ['viewer', 'address'], import: ['case'], readback: ['case'], metrics: ['rule', 'ask', 'row'] };
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

/* ---------- running a rebuild ---------- */

const here = path.dirname(fileURLToPath(import.meta.url));
/** spec/conformance: next to this file's folder in a copy of spec/ (spec/rebuild/drill.mjs), or under spec/ from scripts/. */
const defaultExpected = () => [path.join(here, '..', 'conformance'), path.join(here, '..', 'spec', 'conformance')].find((d) => fs.existsSync(path.join(d, 'workspace.json')));

const readCsvs = (dir) => Object.fromEntries([...FILES, ...ALSO].map((n) => [n, fs.existsSync(path.join(dir, `${n}.csv`)) ? parseCsv(fs.readFileSync(path.join(dir, `${n}.csv`), 'utf8')) : null]));
const quote = (s) => (process.platform === 'win32' ? `"${s}"` : `'${s.replace(/'/g, `'\\''`)}'`);

function main(argv) {
  const opt = { diffs: 10, timeout: 600, files: null, json: false, expected: null, target: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diffs') opt.diffs = Number(argv[++i]);
    else if (a === '--timeout') opt.timeout = Number(argv[++i]);
    else if (a === '--files') opt.files = argv[++i].split(',').map((s) => s.trim().replace(/\.csv$/, '')).filter(Boolean);
    else if (a === '--expected') opt.expected = argv[++i];
    else if (a === '--json') opt.json = true;
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
  let outDir = target, ran = null;
  const manifest = path.join(target, 'drill.json');
  if (fs.existsSync(manifest)) {
    let m;
    try { m = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch (e) { console.error(`drill.json isn’t JSON: ${e.message}`); return 2; }
    if (typeof m.run !== 'string' || !m.run.trim()) { console.error('drill.json needs "run": the command that writes the five CSV files, e.g. { "stage": 1, "run": "node main.mjs" }'); return 2; }
    if (m.stage != null && m.stage !== 1) { console.error(`drill.json says stage ${m.stage}; this harness scores stage 1 only (spec/rebuild/README.md says which stages have a drill).`); return 2; }
    if (!opt.files) opt.files = [...FILES, ...(Array.isArray(m.also) ? m.also.filter((f) => ALSO.includes(f)) : [])];
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
  } else say(`No drill.json in ${target}: scoring the CSV files already there.`);

  if (!opt.files) opt.files = FILES;
  const expected = readCsvs(expectedDir);
  const actual = readCsvs(outDir);
  const score = scoreAll(expected, actual, opt.files);
  const skipped = FILES.filter((f) => !opt.files.includes(f));
  if (opt.json) console.log(JSON.stringify({ ran, pass: score.pass, cells: score.cells, matchedCells: score.matchedCells, files: score.files.map(({ diffs, ...f }) => ({ ...f, firstDiffs: diffs.slice(0, opt.diffs) })), notScored: skipped }, null, 2));
  else say('\n' + report(score, { diffs: opt.diffs, skipped }));
  return score.pass && (!ran || ran.exit === 0) ? 0 : 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) process.exitCode = main(process.argv.slice(2));
