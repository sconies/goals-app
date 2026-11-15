// The import: a file read into the engine's tables (the header row, which sheet, what was and wasn't read),
// the change engine (stage 2) run over them, its issues grouped for the preview, and leaving rows out.
import { readXlsx, unzip, isZip, readCsv } from './xlsx.mjs';
import { planChanges, SHEETS as ENGINE_SHEETS, fold, near } from '../../engine.mjs';
import { SHEET, LOADS_BACK, READING_ONLY, sheetRows } from './export.mjs';

export const LIMITS = { rows: 30000, perSave: 5000, bytes: 20 * 1024 * 1024, large: 500 };
const KEY_OF = { Goals: 'goals', Plan: 'plan', 'Check-ins': 'checkIns', People: 'people' };
const NAME_OF = { goals: 'Goals', plan: 'Plan', checkIns: 'Check-ins', people: 'People' };

// ---------- a file into sheets of rows ----------
export function readFile(buf, name) {
  if (isZip(buf)) {
    const files = unzip(buf);
    if (files.has('xl/workbook.xml')) return readXlsx(buf);
    const out = [];
    for (const [n, b] of files) if (/\.(csv|tsv|txt)$/i.test(n) && !n.startsWith('__MACOSX')) out.push({ name: n.replace(/^.*\//, '').replace(/\.(csv|tsv|txt)$/i, ''), rows: readCsv(b.toString('utf8')) });
    return out;
  }
  return [{ name: String(name || 'Pasted rows').replace(/\.(csv|tsv|txt)$/i, ''), rows: readCsv(buf.toString('utf8')) }];
}

// every name a column is read by, per sheet: the format's columns, the engine's own and its other names
const NAMES = {};
for (const sk of ['goals', 'plan', 'checkIns', 'people']) {
  const s = new Map();
  for (const c of SHEET[NAME_OF[sk]].cols) if (c.col !== 'Week N') s.set(c.col.toLowerCase(), c.col);
  for (const c of ENGINE_SHEETS[sk].cols) s.set(c.toLowerCase(), c);
  for (const [c, also] of Object.entries(ENGINE_SHEETS[sk].also || {})) for (const a of also) s.set(a.toLowerCase(), c);
  NAMES[sk] = s;
}
const known = (sk, h) => { const l = String(h).trim().toLowerCase(); if (sk === 'plan' && /^week \d+$/.test(l)) return `Week ${l.slice(5)}`; return NAMES[sk].get(l); };
const anyKnown = (h) => ['goals', 'checkIns', 'people', 'plan'].some((sk) => known(sk, h));

function kindOf(headers) {
  const has = (sk, ...cols) => cols.some((c) => headers.some((h) => known(sk, h) === c));
  if (has('goals', 'Goal', 'Key') && has('goals', 'Owner', 'Owner email', 'Type', 'Target', 'Level', 'Action')) return 'goals';
  if (has('checkIns', 'Week') && has('checkIns', 'Value', 'Stages', 'Call')) return 'checkIns';
  if (headers.some((h) => /^week \d+$/i.test(String(h).trim())) && has('plan', 'Key', 'ID')) return 'plan';
  if (has('people', 'Email') || (has('people', 'Name') && has('people', 'Team', 'Job title', 'Admin', 'ID'))) return 'people';
  return null;
}
const readingOnlyOf = (headers, name) => {
  const set = new Set(headers.map((h) => String(h).trim()).filter(Boolean));
  for (const r of READING_ONLY) {
    const cols = SHEET[r].cols.map((c) => c.col);
    if (set.size && [...set].every((h) => cols.includes(h)) && cols.filter((c) => set.has(c)).length >= Math.min(cols.length, set.size) && (set.size === cols.length || name === r)) return r;
  }
  return null;
};

// ---------- what was read ----------
export function readTables(sheets, opt = {}) {
  const res = { tables: {}, rowNo: {}, read: [], notRead: [], unread: [], origin: null, headerNotes: [], examples: 0, headersFound: null, raw: {} };
  sheets.forEach((sh, i) => {
    const rows = sh.rows.map((r) => r.map((c) => (c === undefined || c === null ? '' : String(c))));
    const first = String(rows[0]?.[0] ?? '').trim();
    if (/^(start here|readme)$/i.test(sh.name.trim()) || /^Faro: Start here/.test(first)) {
      const f = rows.find((r) => String(r[0]).trim() === 'File of');
      if (f) res.origin = { workspace: f[1], cycle: f[2], name: f[3] || f[1] };
      return;
    }
    // the header row: of the first ten, the one with the most cells some sheet reads (two at least)
    let hr = 0, best = 0;
    for (let r = 0; r < Math.min(10, rows.length); r++) { const n = rows[r].filter((c) => c.trim() && anyKnown(c)).length; if (n > best) { best = n; hr = r; } }
    if (best < 2) hr = 0;
    const headers = (rows[hr] || []).map((h) => h.trim());
    if (i === 0 || !res.headersFound) res.headersFound ??= headers.filter(Boolean);
    const ro = readingOnlyOf(headers, sh.name);
    const sk = ro ? null : kindOf(headers);
    if (!sk) { res.notRead.push({ name: sh.name, why: ro ? 'reading-only' : 'not-faro', headers }); return; }
    if (res.tables[sk]) { res.notRead.push({ name: sh.name, why: 'second' }); return; }
    if (hr > 0) res.headerNotes.push(`Row ${hr + 1} of ${opt.fileName && sheets.length === 1 ? opt.fileName : sh.name} is the header row; ${hr === 1 ? '1 row' : `${hr} rows`} above it ${hr === 1 ? 'was' : 'were'} skipped.`);
    const objs = [], nums = [];
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row.some((c) => c.trim())) continue;
      const o = {};
      headers.forEach((h, ci) => { if (h) o[h] = row[ci] ?? ''; });
      objs.push(o); nums.push(r + 1);
    }
    // columns nothing reads (a near header is asked by the engine, not listed)
    const cands = [...new Set(NAMES[sk].values())].map((c) => ({ key: c, names: [...NAMES[sk]].filter(([, v]) => v === c).map(([k]) => k) }));
    for (const h of headers) if (h && !known(sk, h) && !near(h.toLowerCase(), cands).near) res.unread.push({ sheet: NAME_OF[sk], col: h });
    res.tables[sk] = objs; res.rowNo[sk] = nums; res.raw[sk] = { headers, sheetName: sh.name };
    res.read.push(NAME_OF[sk]);
  });
  // example rows (Action says Example): left out and counted
  for (const sk of ['goals', 'people']) for (const o of res.tables[sk] || []) { const a = Object.entries(o).find(([h]) => known(sk, h) === 'Action'); if (a && fold(a[1]).trim() === 'example') res.examples++; }
  res.rows = Object.values(res.tables).reduce((n, t) => n + t.length, 0);
  return res;
}

export function readLine(rt) {
  const parts = [];
  if (rt.read.length) parts.push(`Read ${listAnd(rt.read)}.`);
  const nr = [];
  for (const s of rt.notRead) nr.push(`${s.name} (${s.why === 'reading-only' ? 'for reading only' : s.why === 'second' ? 'a second sheet of one kind: only the first is read' : 'not a Faro sheet'})`);
  const bySheet = {};
  for (const u of rt.unread) (bySheet[u.sheet] ||= []).push(u.col);
  for (const [s, cols] of Object.entries(bySheet)) nr.push(`the column${cols.length > 1 ? 's' : ''} ${listAnd(cols)} on ${s}`);
  if (nr.length) parts.push(`Not read: ${nr.join('; ')}.`);
  if (rt.examples) parts.push(`${rt.examples} example row${rt.examples === 1 ? '' : 's'} left out.`);
  return parts.join(' ');
}
export const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// another workspace's file, answered "Add its rows as new goals": keys and IDs dropped, and the Plan sheet
export function asNew(rt) {
  const drop = { goals: ['Key', 'ID', 'Feeds into key', 'Feeds into ID'], checkIns: ['ID', 'Goal key', 'Goal ID'], people: ['ID'] };
  for (const [sk, cols] of Object.entries(drop)) if (rt.tables[sk]) rt.tables[sk] = rt.tables[sk].map((o) => Object.fromEntries(Object.entries(o).filter(([h]) => !cols.includes(known(sk, h)))));
  if (rt.tables.plan) { delete rt.tables.plan; rt.read = rt.read.filter((s) => s !== 'Plan'); rt.notRead.push({ name: 'Plan', why: 'not-faro' }); }
  return rt;
}

// worked-out cells a file edited: counted and said, never read
export function workedOutEdits(ctx, rt) {
  const fresh = sheetRows(ctx);
  const out = {};
  for (const [sk, keyCol] of [['goals', 'Key'], ['checkIns', 'ID']]) {
    const sheet = NAME_OF[sk];
    const hdr = fresh[sheet][0];
    const ki = hdr.indexOf(keyCol);
    const byKey = new Map(fresh[sheet].slice(1).map((r) => [String(r[ki]), r]));
    const worked = SHEET[sheet].cols.filter((c) => /^Worked out/.test(c.need)).map((c) => c.col);
    for (const o of rt.tables[sk] || []) {
      const k = Object.entries(o).find(([h]) => known(sk, h) === keyCol)?.[1];
      const f = byKey.get(String(k)); if (!f) continue;
      for (const [h, v] of Object.entries(o)) {
        const col = known(sk, h); if (!worked.includes(col)) continue;
        const want = f[hdr.indexOf(col)];
        if (String(want ?? '').trim() !== String(v ?? '').trim()) { const key = `${sheet}:${col}`; out[key] = (out[key] || 0) + 1; }
      }
    }
  }
  return Object.entries(out).map(([k, n]) => { const [sheet, col] = k.split(':'); return { sheet, col, n }; });
}
export const workedOutLine = (w) => (w.length ? `On ${w.map((x) => `${x.n} row${x.n === 1 ? '' : 's'}, ${x.col}`).join('; on ')} differ${w.length === 1 && w[0].n === 1 ? 's' : 's'} from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.`.replace(/ differs$/, ' differs') : '');

// ---------- the engine over the tables ----------
// new IDs unique to this workspace's state: the same file checked twice gives the same IDs, and a later import new ones
const idTagOf = (ctx) => `i${(ctx.W.changes || []).filter((c) => c.kind === 'import').length + 1}x`;
export function run(ctx, rt, answers = {}, reason = '') {
  const t = rt.tables;
  const first = ['goals', 'checkIns', 'people', 'plan'].find((k) => t[k]) || 'goals';
  const sheets = {}; for (const k of ['checkIns', 'people', 'plan']) if (t[k] && k !== first) sheets[k] = t[k];
  return planChanges({ S1: ctx.S1, W: ctx.W }, { actor: ctx.viewer, idTag: idTagOf(ctx), sheet: first, rows: t[first] || [], answers, given: { sheets, at: ctx.moment, ...(reason ? { reason } : {}) } });
}

// ---------- the issues, grouped: a title per kind with its count, its rows, its answers ----------
const TITLE = {
  'required-empty': (n, i) => `${n} ${n === 1 ? 'row is' : 'rows are'} missing something a new row must have`,
  'not-a-number': (n) => `${n} ${n === 1 ? 'row has' : 'rows have'} text where a number goes`,
  formula: (n) => `${n} ${n === 1 ? 'cell holds' : 'cells hold'} a formula, not a number`,
  precision: (n) => `${n} ${n === 1 ? 'number has' : 'numbers have'} more decimal places than its goal keeps`,
  'impossible-number': (n) => `${n} ${n === 1 ? 'number' : 'numbers'} can’t be right`,
  'unknown-ref': (n, i) => `${n} ${n === 1 ? 'row names' : 'rows name'} something that isn’t here`,
  'ambiguous-ref': (n) => `${n} ${n === 1 ? 'row names' : 'rows name'} more than one`,
  'conflicting-refs': (n) => `${n} ${n === 1 ? 'row names' : 'rows name'} two different people or goals`,
  'bad-key': (n) => `${n} ${n === 1 ? 'key' : 'keys'} can’t be found`,
  duplicate: (n) => `${n} ${n === 1 ? 'record appears' : 'records appear'} on more than one row`,
  'type-unclear': (n) => `${n} new ${n === 1 ? 'goal doesn’t' : 'goals don’t'} say what type ${n === 1 ? 'it is' : 'they are'}`,
  'plan-order': (n) => `${n} ${n === 1 ? 'plan ends' : 'plans end'} before ${n === 1 ? 'it starts' : 'they start'}`,
  'stage-format': (n) => `${n} ${n === 1 ? 'row has' : 'rows have'} stages that can’t be read`,
  'week-wrong': (n) => `${n} ${n === 1 ? 'row has a week' : 'rows have weeks'} that can’t be right`,
  'checkin-incomplete': (n) => `${n} ${n === 1 ? 'check-in needs' : 'check-ins need'} more said`,
  'cant-change': (n) => `${n} ${n === 1 ? 'row changes' : 'rows change'} something that can’t change`,
  'not-allowed': (n, i) => (i.sheet === 'people' ? `${n} ${n === 1 ? 'row changes' : 'rows change'} people. Only an admin can add or change people` : i.sheet === 'checkIns' ? `${n} ${n === 1 ? 'row checks' : 'rows check'} in on a goal you don’t own` : `${n} ${n === 1 ? 'row changes' : 'rows change'} a goal you don’t own`),
  'removal-refused': (n) => `${n} ${n === 1 ? 'row can’t' : 'rows can’t'} be stopped, deleted or marked as left as ${n === 1 ? 'it stands' : 'they stand'}`,
  loop: (n) => `${n} ${n === 1 ? 'goal' : 'goals'} would feed ${n === 1 ? 'itself' : 'themselves'}`,
};
const ANSWERS = {
  precision: [['keep', 'Keep these decimal places for this goal']],
  'not-allowed': [['leave', 'Leave these rows out']],
  duplicate: [['last', 'Use the last row for each'], ['first', 'Use the first']],
  'near-ref': [['use', (i) => `Use ${i.suggest}`], ['leave', 'Leave these rows out']],
  'near-word': [['use', (i) => `Read it as ${i.suggest}`], ['leave', 'Leave these rows out']],
  'near-header': [['read', (i) => `Read it as ${i.suggest}`], ['no', 'Don’t read it']],
  'same-goal': [['new', 'They’re new goals'], ['same', 'They’re the same'], ['leave', 'Leave them out']],
  'other-goal': [['change', 'Yes, change it'], ['new', 'No, add it as a new goal'], ['leave', 'Leave it out']],
  'same-person': [['same', 'The same person'], ['new', 'Someone new']],
  'past-stage': [['done', 'They’re done'], ['not-done', 'They’re not done'], ['from-now', 'Count them from this week']],
  'past-plan': [['add', 'They’re finished goals: add them'], ['leave', 'Leave them out']],
  'odd-number': [['right', 'They’re right'], ['leave', 'Leave these rows out']],
  'plan-question': [['yes', 'Yes, that’s right'], ['leave', 'Leave these rows out']],
  'no-unit': [['right', 'That’s right'], ['leave', 'Leave them out']],
  'decimal-comma': [['right', 'That’s right'], ['leave', 'Leave these rows out']],
  'replaces-others': [['replace', 'Replace them'], ['leave', 'Leave these rows out']],
  'many-admins': [['right', 'That’s right'], ['leave', 'Leave these rows out']],
  'totals-row': [['leave', 'Leave it out'], ['goal', 'It’s a goal']],
  'big-removal': [['right', 'That’s right'], ['leave', 'Leave these rows out']],
  'feeds-lower': [['yes', 'Yes, it feeds that goal'], ['leave', 'Leave these rows out']],
  'for-someone-else': [['yes', 'Yes, active'], ['proposed', 'No, start them as proposed']],
  'two-columns': [],
};
const suggestOf = (i) => { const m = i.message.match(/(?:Did you mean|Read it as) (.+?)\?/); return m ? m[1] : ''; };
export function rowsWhere(sheet, rows) {
  const r = [...new Set(rows)].sort((a, b) => a - b);
  const runs = [];
  for (const x of r) { const last = runs[runs.length - 1]; if (last && x === last[1] + 1) last[1] = x; else runs.push([x, x]); }
  const words = runs.map(([a, b]) => (a === b ? `${a}` : `${a} to ${b}`));
  const shown = words.length > 3 ? `${words.slice(0, 3).join(', ')} and ${words.length - 3} more` : listAnd(words);
  return `${sheet}, row${r.length === 1 ? '' : 's'} ${shown}`;
}
export function groups(res, rt) {
  const by = new Map();
  for (const i0 of res.issues) {
    // a header is said as the file wrote it (the engine folds it to lower case: GAPS M9-6)
    let i = i0;
    if ((i.kind === 'near-header' || i.kind === 'two-columns') && rt?.raw?.[i.sheet]) i = { ...i, message: i.message.replace(/“([^”]+)”/g, (m, x) => `“${rt.raw[i.sheet].headers.find((h) => h.trim().toLowerCase() === x) ?? x}”`) };
    if (!by.has(i.group)) by.set(i.group, { id: i.group, kind: i.kind, level: i.level, sheet: i.sheet, issues: [] });
    by.get(i.group).issues.push(i);
  }
  const out = [];
  for (const g of by.values()) {
    const n = g.issues.length;
    const i0 = g.issues[0];
    const suggest = suggestOf(i0);
    const rowsOf = g.issues.map((i) => rt?.rowNo?.[i.sheet]?.[i.row - 2] ?? i.row);
    const sheetName = NAME_OF[g.sheet];
    let title;
    if (g.level === 'must') title = (TITLE[g.kind] || ((k) => `${k} ${k === 1 ? 'row needs' : 'rows need'} fixing`))(n, i0);
    else title = n === 1 || ['near-header', 'two-columns', 'other-workspace'].includes(g.kind) ? i0.message : `${n} rows: ${i0.message}`;
    if (g.kind === 'near-ref' && n > 1) { const m = i0.message.match(/^(.*?) isn’t here\. (Did you mean .*)$/); if (m) title = `${n} rows name ${/team/i.test(i0.message) ? 'a team' : 'something'} that isn’t here: ${m[1]}. ${m[2]}`; }
    const answers = (ANSWERS[g.kind] || (g.level === 'must' ? [] : [['right', 'That’s right'], ['leave', 'Leave these rows out']])).map(([code, label]) => ({ code, label: typeof label === 'function' ? label({ suggest }) : label }));
    out.push({ ...g, n, title, where: rowsWhere(sheetName, rowsOf), rows: rowsOf, lines: g.issues.map((i) => ({ row: rt?.rowNo?.[i.sheet]?.[i.row - 2] ?? i.row, line: i.row, message: i.message, sheet: i.sheet })), answers, suggest });
  }
  const rank = { must: 0, check: 1, note: 2 };
  out.sort((a, b) => rank[a.level] - rank[b.level] || b.n - a.n);
  return out;
}

// ---------- leaving rows out: the rows, and the rows that depend on them ----------
export function leaveOut(rt, picks) { // picks: [{ sk, line }] (line as the engine numbers it: index + 2)
  const t = rt.tables;
  const gone = new Map(); // `${sk}:${index}` -> why
  const col = (sk, o, c) => { const e = Object.entries(o).find(([h]) => known(sk, h) === c); return e ? String(e[1] ?? '').trim() : ''; };
  const queue = picks.map((p) => ({ sk: p.sk, i: p.line - 2, why: 'at your choice' }));
  while (queue.length) {
    const { sk, i, why } = queue.shift();
    const k = `${sk}:${i}`; if (gone.has(k) || !t[sk]?.[i]) continue;
    gone.set(k, why);
    const o = t[sk][i];
    const sheetRow = rt.rowNo?.[sk]?.[i] ?? i + 2;
    if (sk === 'goals' && !col('goals', o, 'Key') && !col('goals', o, 'ID')) {
      const name = fold(col('goals', o, 'Goal')); const ref = col('goals', o, 'Ref');
      (t.checkIns || []).forEach((c, ci) => { if ((name && fold(col('checkIns', c, 'Goal')) === name && !col('checkIns', c, 'Goal key')) || (ref && col('checkIns', c, 'Goal ref') === ref)) queue.push({ sk: 'checkIns', i: ci, why: `its goal (Goals row ${sheetRow}) is left out` }); });
      t.goals.forEach((g, gi) => { if (gi !== i && ((name && fold(col('goals', g, 'Feeds into')) === name) || (ref && col('goals', g, 'Feeds into ref') === ref))) queue.push({ sk: 'goals', i: gi, why: `Feeds into names Goals row ${sheetRow}` }); });
    }
    if (sk === 'people' && !col('people', o, 'ID')) {
      const email = col('people', o, 'Email').toLowerCase(), name = fold(col('people', o, 'Name'));
      (t.goals || []).forEach((g, gi) => { if ((email && col('goals', g, 'Owner email').toLowerCase() === email) || (name && fold(col('goals', g, 'Owner')) === name)) queue.push({ sk: 'goals', i: gi, why: `its owner (People row ${sheetRow}) is left out` }); });
    }
  }
  const left = [];
  const tables = {};
  for (const [sk, rows] of Object.entries(t)) {
    tables[sk] = []; const nums = [];
    rows.forEach((o, i) => { const why = gone.get(`${sk}:${i}`); if (why) left.push({ sk, sheet: NAME_OF[sk], row: rt.rowNo?.[sk]?.[i] ?? i + 2, name: col(sk, o, sk === 'people' ? 'Name' : 'Goal'), why, raw: o }); else { tables[sk].push(o); nums.push(rt.rowNo?.[sk]?.[i] ?? i + 2); } });
    rt.rowNo[sk] = nums;
  }
  rt.tables = tables;
  return left;
}

// the rows to fix, as a file whose first column is Problem
export function rowsToFix(rt, gs) {
  const out = {};
  const by = new Map();
  for (const g of gs) if (g.level === 'must' || (g.level === 'check' && !g.answered)) for (const l of g.lines) { const k = `${l.sheet}:${l.line}`; if (!by.has(k)) by.set(k, []); by.get(k).push(l.message); }
  for (const [k, msgs] of by) {
    const [sk, line] = k.split(':'); const o = rt.tables[sk]?.[+line - 2]; if (!o) continue;
    const hs = rt.raw[sk].headers.filter(Boolean);
    (out[NAME_OF[sk]] ||= [['Problem', ...hs]]).push([msgs.join(' '), ...hs.map((h) => o[h] ?? '')]);
  }
  for (const v of Object.values(out)) { const [h, ...r] = v; v.splice(0, v.length, h, ...r); }
  return Object.fromEntries(['Goals', 'Plan', 'Check-ins', 'People'].filter((s) => out[s]).map((s) => [s, out[s]]));
}

export { known, NAME_OF, KEY_OF };
