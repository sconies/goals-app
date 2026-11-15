// The import (BULK-IMPORT, IMPORT-LEVELS, IMPORT-PREVIEW, IMPORT-LARGE): a file's sheets known by their header rows
// (core rule: the header row), what was read and not, rows left out with what depends on them, the engine's run,
// the save, and Undo (core rule: undoing an import).
import { planChanges, SHEETS, near, fold } from '../../engine.mjs';
import { readWorkbook, readCsv, unzip, isZip, writeWorkbook } from './book.mjs';
import { FORMAT } from './fields.mjs';
import { sheetsFor, fileOf, LOADS_BACK } from './exporter.mjs';
import { W_ } from '../../platform.mjs';

export const LIMITS = { rows: 30000, changes: 5000, bytes: 20 * 1024 * 1024 };
const KEY = { Goals: 'goals', Plan: 'plan', 'Check-ins': 'checkIns', People: 'people' };
const NAME = { goals: 'Goals', plan: 'Plan', checkIns: 'Check-ins', people: 'People' };
const READING_ONLY = ['Results', 'Asks', 'Notes', 'Metrics'];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const Q = (s) => `“${s}”`;

// ---------- the file ----------
export function readFile(name, buf) {
  if (buf.length > LIMITS.bytes) return { error: `${name} is ${(buf.length / 1048576).toFixed(1)} MB. A file can be up to 20 MB: split it into parts.` };
  try {
    if (isZip(buf)) {
      const files = unzip(buf);
      if (files.has('xl/workbook.xml')) return { kind: 'xlsx', sheets: readWorkbook(buf) };
      const sheets = [];
      for (const [n, b] of files) if (/\.(csv|tsv|txt)$/i.test(n) && !n.startsWith('__MACOSX')) sheets.push({ name: n.replace(/^.*\//, '').replace(/\.(csv|tsv|txt)$/i, ''), rows: readCsv(b.toString('utf8')) });
      if (!sheets.length) return { error: `${name} is a zip with no CSV files in it.` };
      return { kind: 'zip', sheets };
    }
    return { kind: 'csv', sheets: [{ name: name.replace(/\.(csv|tsv|txt)$/i, ''), rows: readCsv(buf.toString('utf8')) }] };
  } catch (e) { return { error: `${name} couldn’t be read as a workbook, a zip of CSVs or a CSV.` }; }
}

// header names each sheet reads: its own, its other names, and Plan's Week N
const CANDS = Object.fromEntries(Object.entries(SHEETS).map(([k, d]) => [k, d.cols.map((c) => ({ key: c, names: [c, ...(d.also[c] || [])] }))]));
const OTHER = Object.fromEntries(READING_ONLY.map((s) => [s, FORMAT[s].cols.map((c) => fold(c.col))]));
const isWeekN = (h) => /^week \d+$/i.test(String(h).trim());
function headerKinds(cells) {
  // how many cells each sheet reads
  const score = {};
  for (const k of Object.keys(CANDS)) score[k] = cells.filter((h) => h && (near(String(h).toLowerCase().trim(), CANDS[k]).exact || (k === 'plan' && isWeekN(h)))).length;
  for (const s of READING_ONLY) score[s] = cells.filter((h) => h && OTHER[s].includes(fold(String(h).trim()))).length;
  return score;
}
function sheetKindOf(headers) {
  const got = (k, col) => headers.some((h) => h && near(String(h).toLowerCase().trim(), CANDS[k]).exact?.key === col);
  const score = headerKinds(headers);
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  // a sheet for reading only wins only when it reads more of the headers than any sheet that loads back
  const filled = headers.filter(Boolean);
  for (const s of READING_ONLY) if (filled.length && score[s] === filled.length && score[s] >= Math.max(score.goals, score.checkIns, score.people, score.plan)) return s;
  if (READING_ONLY.includes(best[0]) && best[1] > Math.max(score.goals, score.checkIns, score.people, score.plan)) return best[0];
  if ((got('goals', 'Goal') || got('goals', 'Key')) && ['Owner', 'Owner email', 'Type', 'Target', 'Level', 'Action'].some((c) => got('goals', c)) && score.goals >= score.checkIns && score.goals >= score.people && !headers.some(isWeekN)) return 'goals';
  if (got('checkIns', 'Week') && ['Value', 'Stages', 'Call'].some((c) => got('checkIns', c))) return 'checkIns';
  if (headers.some(isWeekN) && (got('plan', 'Key') || got('plan', 'ID'))) return 'plan';
  if (got('people', 'Email') || (got('people', 'Name') && ['Team', 'Job title', 'Admin', 'ID'].some((c) => got('people', c)))) return 'people';
  if ((got('goals', 'Goal') || got('goals', 'Key')) && score.goals >= 2) return 'goals';
  return null;
}
const blank = (row) => !row || row.every((c) => c === undefined || c === null || String(c).trim() === '');
const withLine = (o, line) => { Object.defineProperty(o, '__line', { value: line, enumerable: false }); return o; };

// -> what was read: tables of rows (each knowing its line), the sheets read and not, unread columns, notes
export function recognise(app, fileName, file, { asNew = false } = {}) {
  const r = { tables: {}, headers: {}, read: [], notRead: [], unknownCols: [], headerNotes: [], origin: null, firstHeaders: null, lines: {} };
  file.sheets.forEach((s, idx) => {
    const nm = String(s.name).trim();
    if (/^(start here|readme)$/i.test(nm)) {
      const fo = s.rows.find((x) => String(x[0] || '').trim() === 'File of');
      if (fo) r.origin = { workspace: String(fo[1] || ''), cycle: String(fo[2] || ''), name: String(fo[3] || fo[1] || '') };
      return;
    }
    // the header row: of the first ten, the one with the most cells some sheet reads (at least two)
    let hr = 0, bestN = -1;
    for (let i = 0; i < Math.min(10, s.rows.length); i++) { const sc = headerKinds(s.rows[i] || []); const n = Math.max(...Object.values(sc)); if (n >= 2 && n > bestN) { bestN = n; hr = i; } }
    const headers = (s.rows[hr] || []).map((h) => String(h ?? '').trim());
    if (idx === 0 || !r.firstHeaders) r.firstHeaders = r.firstHeaders || headers.filter(Boolean);
    const kind = bestN >= 2 ? sheetKindOf(headers) : null;
    const label = file.kind === 'csv' ? fileName : NAME[kind] || nm;
    if (!kind) { r.notRead.push({ name: nm, why: 'not a Faro sheet' }); return; }
    if (READING_ONLY.includes(kind)) {
      const on = kind === 'Notes' ? app.on('reviews') : kind === 'Metrics' ? app.on('metrics') : true;
      if (kind === 'Metrics' && on) { r.read.push('Metrics'); return; }
      if (!on) { r.notRead.push({ name: kind, why: 'module off', module: kind === 'Notes' ? 'Reviews' : 'Metric library' }); return; }
      r.notRead.push({ name: kind, why: 'for reading only' }); return;
    }
    if (r.tables[kind]) { r.notRead.push({ name: nm, why: `a second ${NAME[kind]} sheet` }); return; }
    if (hr > 0) r.headerNotes.push(`Row ${hr + 1} of ${label} is the header row; ${plural(hr, 'row', 'rows')} above it ${hr === 1 ? 'was' : 'were'} skipped.`);
    // columns nothing reads (a near header is asked by the engine, not listed)
    const workedOut = new Set((FORMAT[NAME[kind]]?.cols || []).filter((c) => c.need === 'Worked out' || c.need === 'For reading').map((c) => fold(c.col)));
    for (const h of headers) {
      if (!h || (kind === 'plan' && isWeekN(h))) continue;
      const n = near(h.toLowerCase(), CANDS[kind]);
      if (!n.exact && !n.near && !n.many && !workedOut.has(fold(h))) r.unknownCols.push({ sheet: NAME[kind], col: h });
    }
    let drop = new Set();
    if (asNew) drop = new Set(kind === 'goals' ? ['key', 'id'] : kind === 'checkIns' ? ['id', 'goal key', 'goal id'] : kind === 'people' ? ['id'] : []);
    if (asNew && kind === 'plan') { r.notRead.push({ name: 'Plan', why: 'it needs keys' }); return; }
    const rows = [];
    for (let i = hr + 1; i < s.rows.length; i++) {
      const row = s.rows[i];
      if (blank(row)) continue;
      const o = {};
      headers.forEach((h, c) => { if (h && !drop.has(h.toLowerCase())) o[h] = row[c] === undefined || row[c] === null ? '' : String(row[c]); });
      rows.push(withLine(o, i + 1));
    }
    r.tables[kind] = rows;
    r.headers[kind] = headers;
    r.read.push(NAME[kind]);
  });
  // the order of the format
  const ord = [...LOADS_BACK, 'Metrics'];
  r.read.sort((a, b) => ord.indexOf(a) - ord.indexOf(b));
  r.rowCount = Object.values(r.tables).reduce((n, t) => n + t.length, 0);
  return r;
}

// worked-out cells that differ from what an export would write today (never read; said)
export function workedOutEdits(app, rec) {
  const out = [];
  const now = sheetsFor(app);
  for (const [kind, keyCols] of [['goals', ['Key', 'ID']], ['checkIns', ['ID']]]) {
    const t = rec.tables[kind];
    if (!t) continue;
    const sheet = now.find((s) => s.name === NAME[kind]);
    const wo = FORMAT[NAME[kind]].cols.filter((c) => c.need === 'Worked out').map((c) => c.col);
    const byKey = new Map();
    for (const row of sheet.rows) for (const k of keyCols) if (row[k]) byKey.set(`${k}:${row[k]}`, row);
    const n = {};
    for (const row of t) {
      const k = keyCols.find((c) => row[c]);
      const ex = k && byKey.get(`${k}:${row[k]}`);
      if (!ex) continue;
      for (const col of wo) if (col in row && String(row[col] ?? '').trim() !== String(ex[col] ?? '').trim()) n[col] = (n[col] || 0) + 1;
    }
    for (const [col, k] of Object.entries(n)) out.push({ sheet: NAME[kind], col, n: k });
  }
  return out;
}

// the file line: what was read and not, in one sentence (core rule: the import's preview)
export function fileLine(app, rec, examples = 0) {
  const parts = [];
  if (rec.read.length) parts.push(`Read ${listAnd(rec.read)}.`);
  const not = [];
  const why = rec.notRead.filter((x) => x.why !== 'module off');
  const groups = {};
  for (const x of why) (groups[x.why] = groups[x.why] || []).push(x.name);
  for (const [w, names] of Object.entries(groups)) not.push(`${listAnd(names)} (${w})`);
  if (rec.unknownCols.length) {
    const bySheet = {};
    for (const u of rec.unknownCols) (bySheet[u.sheet] = bySheet[u.sheet] || []).push(u.col);
    for (const [sh, cs] of Object.entries(bySheet)) not.push(`the ${cs.length === 1 ? 'column' : 'columns'} ${listAnd(cs)} on ${sh}`);
  }
  if (not.length) parts.push(`Not read: ${not.join('; ')}.`);
  for (const x of rec.notRead.filter((y) => y.why === 'module off')) parts.push(x.name === 'Notes' ? W_.reviewsOffRead(app.wsName) : W_.moduleOffLine(x.module, app.wsName, x.name));
  if (examples) parts.push(`${plural(examples, 'example row', 'example rows')} left out.`);
  return parts.join(' ');
}

// ---------- leaving rows out, and what depends on them ----------
// leave: Set of 'goals:12' -> { tables, gone: [{ sheet, line, why }] }
export function leaveOut(tables, leave) {
  const gone = [];
  const out = {};
  const left = new Set(leave);
  const goalName = (r) => String(r.Goal ?? r['Goal name'] ?? r.Title ?? '').trim();
  const isNewGoal = (r) => !String(r.Key ?? '').trim() && !String(r.ID ?? '').trim();
  const leftNew = new Map(); // name/ref -> line
  const queue = [...left].filter((k) => k.startsWith('goals:')).map((k) => +k.slice(6));
  const goals = tables.goals || [];
  while (queue.length) {
    const line = queue.shift();
    const g = goals.find((r) => r.__line === line);
    if (!g || !isNewGoal(g)) continue;
    const nm = fold(goalName(g)), ref = String(g.Ref ?? '').trim();
    leftNew.set(line, { nm, ref });
    for (const r of goals) {
      if (left.has(`goals:${r.__line}`)) continue;
      const fi = fold(String(r['Feeds into'] ?? '').trim()), fr = String(r['Feeds into ref'] ?? '').trim();
      if ((fi && fi === nm) || (fr && ref && fr === ref)) { left.add(`goals:${r.__line}`); gone.push({ sheet: 'Goals', line: r.__line, why: `Feeds into names Goals row ${line}` }); queue.push(r.__line); }
    }
  }
  for (const [kind, rows] of Object.entries(tables)) {
    out[kind] = rows.filter((r) => {
      if (left.has(`${kind}:${r.__line}`)) return false;
      if (kind === 'checkIns' && !String(r['Goal key'] ?? '').trim() && !String(r['Goal ID'] ?? '').trim()) {
        const nm = fold(String(r.Goal ?? '').trim()), ref = String(r['Goal ref'] ?? '').trim();
        for (const [line, x] of leftNew) if ((nm && nm === x.nm) || (ref && x.ref && ref === x.ref)) { gone.push({ sheet: 'Check-ins', line: r.__line, why: `its goal, Goals row ${line}, is left out` }); return false; }
      }
      return true;
    });
  }
  return { tables: out, gone };
}

// ---------- one run of the engine over every table ----------
export function check(app, actor, tables, answers = {}, { apply = false, reason = '' } = {}) {
  // example rows (Action says Example) are left out and counted, never read
  let examples = 0;
  const isEx = (r) => Object.entries(r).some(([h, v]) => /^action$/i.test(h.trim()) && fold(String(v).trim()) === 'example');
  tables = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, rows.filter((r) => (isEx(r) ? (examples++, false) : true))]));
  const kinds = Object.keys(tables).filter((k) => k !== 'plan' && tables[k].length);
  if (!kinds.length) return { items: [], issues: [], counts: {}, unchanged: 0, saves: false, examples };
  if (!kinds.length) return { items: [], issues: [], counts: {}, unchanged: 0, saves: false, examples: 0 };
  const [first, ...rest] = kinds;
  const given = { at: app.now || app.W.builtFor, sheets: Object.fromEntries(rest.map((k) => [k, tables[k]])), ...(reason ? { reason } : {}) };
  const res = planChanges({ W: app.W, S1: app.S1 }, { actor, sheet: first, rows: tables[first], answers, idTag: apply ? `s${Date.now().toString(36)}` : 'p', given });
  res.examples = examples;
  return res;
}

// the commit: every record, every change with the import's id, one summary entry with File and Rows
export function commit(app, actor, res, { file, via = 'Spreadsheet', leftOut = 0 }) {
  const c = res.commit;
  const imp = c.changes.find((x) => x.action === 'imported');
  const importId = imp.importId;
  for (const kind of ['goals', 'checkIns', 'people']) for (const rec of c[kind]) {
    const list = app.W[kind];
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = { ...rec, version: (list[i].version || 0) + 1 }; else list.push(rec);
  }
  for (const ch of c.changes) {
    const e = { ...ch, action: ch.action === 'check-in' ? 'posted' : ch.action === 'new goal' ? 'created' : ch.action === 'stop goal' ? 'stopped' : ch.action === 'delete goal' ? 'deleted' : ch.action === 'person left' ? 'left' : ch.action, via: via === 'MCP' ? 'mcp' : 'spreadsheet' };
    if (e.action === 'imported') {
      e.file = file;
      e.diffs = [{ field: 'Via', from: '—', to: via }, ...(file ? [{ field: 'File', from: '—', to: file }] : []), { field: 'Rows', from: '—', to: `${res.items.length} changed, ${res.unchanged} unchanged${leftOut ? `, ${leftOut} left out` : ''}` }];
    }
    app.W.changes.push(e);
  }
  app.rebind();
  return importId;
}

// ---------- Undo (core rule: undoing an import) ----------
export const pastImports = (app) => app.W.changes.filter((c) => c.action === 'imported').slice().reverse().map((c) => ({ ...c, undone: app.W.changes.find((u) => u.action === 'undid import' && u.entityId === c.entityId) || null }));
const day = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`; };
export function undoPreview(app, importId) {
  const W = app.W;
  const imp = W.changes.find((c) => c.action === 'imported' && c.entityId === importId);
  if (!imp) return { error: 'There’s no import like that.' };
  const undoneIds = new Set(W.changes.filter((c) => c.action === 'undid import').map((c) => c.entityId));
  const later = W.changes.filter((c) => c.at >= imp.at && c.importId !== importId && !(c.importId && undoneIds.has(c.importId)) && c !== imp && W.changes.indexOf(c) > W.changes.indexOf(imp));
  const name = (id) => W.people.find((p) => p.id === id)?.name || 'Someone';
  const restores = [], skipped = [];
  const u = imp.undo || { goals: [], checkIns: [], people: [] };
  for (const kind of ['goals', 'checkIns', 'people']) for (const { id, before } of u[kind] || []) {
    const rec = W[kind].find((x) => x.id === id);
    const title = kind === 'goals' ? rec?.title || before?.title : kind === 'checkIns' ? `${W.goals.find((g) => g.id === (rec || before)?.goalId)?.title || ''}, week ${(rec || before)?.week}` : rec?.name || before?.name;
    let why = null;
    const touch = later.filter((c) => c.entityId === id || (kind === 'goals' && c.goalId === id && c.entity === 'goal')).pop();
    if (touch) why = touch.action === 'posted' ? `${name(touch.actorId)} posted a check-in for week ${touch.week ?? ''} on ${day(touch.at)}` : `Its ${touch.diffs?.[0]?.field || 'record'} was changed on ${day(touch.at)}`;
    if (!why && kind === 'goals' && !before) {
      const ck = W.checkIns.filter((c) => c.goalId === id && !c.removedAt && !(u.checkIns || []).some((x) => x.id === c.id)).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
      if (ck) why = `${name(ck.authorId)} posted a check-in for week ${ck.week} on ${day(ck.postedAt)}`;
    }
    (why ? skipped : restores).push({ kind, id, before, title, why });
  }
  return { imp, restores, skipped };
}
export function undoImport(app, actor, importId) {
  const W = app.W;
  const pv = undoPreview(app, importId);
  if (pv.error) return pv;
  const me = W.people.find((p) => p.id === actor);
  if (pv.imp.actorId !== actor && !me?.admin) return { error: `Only ${name0(W, pv.imp.actorId)} or an admin can undo this import.` };
  if (W.changes.some((c) => c.action === 'undid import' && c.entityId === importId)) return { error: 'This import has been undone already.' };
  if (!pv.restores.length) return { error: pv.imp.undo && Object.values(pv.imp.undo).some((l) => l.length) ? 'Nothing left to undo' : 'Nothing to undo: it changed no rows.' };
  for (const r of pv.restores) {
    const list = W[r.kind];
    const i = list.findIndex((x) => x.id === r.id);
    if (r.before === null) {
      if (i >= 0) list.splice(i, 1);
      if (r.kind === 'goals') for (const g of W.goals) if (g.parentId === r.id) g.parentId = null;
    } else if (i >= 0) list[i] = JSON.parse(JSON.stringify(r.before)); else list.push(JSON.parse(JSON.stringify(r.before)));
  }
  W.changes.push({ id: `chg_undo_${importId}`, at: app.now || W.builtFor, actorId: actor, goalId: null, entity: 'workspace', entityId: importId, action: 'undid import', summary: `Undid an import: ${plural(pv.restores.length, 'row', 'rows')} put back${pv.skipped.length ? `, ${pv.skipped.length} kept` : ''}`, diffs: [{ field: 'Import', from: 'Saved', to: 'Undone' }], via: 'app' });
  app.rebind();
  return { ok: true, restored: pv.restores.length, kept: pv.skipped.length, message: `Undone: ${plural(pv.restores.length, 'row', 'rows')} put back.` };
}
const name0 = (W, id) => W.people.find((p) => p.id === id)?.name.split(' ')[0] || 'whoever made it';

// ---------- the rows to fix, as a file with Problem first ----------
export function rowsToFix(rec, res) {
  const books = [];
  for (const [kind, rows] of Object.entries(rec.tables)) {
    const probs = new Map();
    for (const i of res.issues.filter((x) => x.level === 'must' && x.sheet === kind)) { if (!probs.has(i.row)) probs.set(i.row, []); probs.get(i.row).push(i.message); }
    if (!probs.size) continue;
    const headers = rec.headers[kind].filter(Boolean);
    books.push({ name: NAME[kind], rows: [['Problem', ...headers], ...rows.filter((r) => probs.has(r.__line)).map((r) => [probs.get(r.__line).join(' '), ...headers.map((h) => r[h] ?? '')])] });
  }
  return books;
}
export const rowsAsBook = (rec, keys) => {
  const books = [];
  for (const [kind, rows] of Object.entries(rec.tables)) {
    const take = rows.filter((r) => keys.has(`${kind}:${r.__line}`));
    if (!take.length) continue;
    const headers = rec.headers[kind].filter(Boolean);
    books.push({ name: NAME[kind], rows: [headers, ...take.map((r) => headers.map((h) => r[h] ?? ''))] });
  }
  return writeWorkbook(books);
};

// ---------- a file too big to save at once: parts of 5,000 rows ----------
// each goal with its plan and check-ins, and a goal before the goals that feed into it
export function split(rec, size = LIMITS.changes) {
  const goals = rec.tables.goals || [], cks = rec.tables.checkIns || [], people = rec.tables.people || [];
  const nameOf = (r) => fold(String(r.Goal ?? '').trim());
  const byName = new Map(goals.map((g) => [nameOf(g), g]));
  const depth = (g, seen = new Set()) => { const p = byName.get(fold(String(g['Feeds into'] ?? '').trim())); if (!p || seen.has(p)) return 0; seen.add(p); return 1 + depth(p, seen); };
  const ordered = [...goals].sort((a, b) => depth(a) - depth(b));
  const ckOf = new Map();
  for (const c of cks) { const k = String(c['Goal key'] || c['Goal ID'] || '').trim() || nameOf(c); if (!ckOf.has(k)) ckOf.set(k, []); ckOf.get(k).push(c); }
  const units = [];
  if (people.length) for (let i = 0; i < people.length; i += size) units.push({ people: people.slice(i, i + size) });
  for (const g of ordered) units.push({ goals: [g], checkIns: [...(ckOf.get(String(g.Key || '').trim()) || []), ...(ckOf.get(String(g.ID || '').trim()) || []), ...(!g.Key && !g.ID ? ckOf.get(nameOf(g)) || [] : [])] });
  const parts = [];
  let cur = { goals: [], checkIns: [], people: [] }, n = 0;
  for (const u of units) {
    const k = (u.goals?.length || 0) + (u.checkIns?.length || 0) + (u.people?.length || 0);
    if (n && n + k > size) { parts.push(cur); cur = { goals: [], checkIns: [], people: [] }; n = 0; }
    for (const key of ['goals', 'checkIns', 'people']) if (u[key]) cur[key].push(...u[key]);
    n += k;
  }
  if (n) parts.push(cur);
  return parts.map((p) => {
    const sheets = [];
    for (const [kind, rows] of Object.entries(p)) if (rows.length) { const headers = rec.headers[kind].filter(Boolean); sheets.push({ name: NAME[kind], rows: [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))] }); }
    return writeWorkbook(sheets);
  });
}
export { KEY, NAME };
