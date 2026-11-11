/* Release 3: one spreadsheet format that every import and export uses, proved by a round trip. On the Platform
   Engineering example, Thursday 5 November (week 45), and a workspace set up from the set-up template.
   ONE-FORMAT: every sheet and column is defined once (src/domain/columns.ts); the workbook, the zipped CSVs, one CSV, the
     set-up template, the Data tables, the AI assistant's tools and docs/export-format.md are made from it; sheets are
     known by their headers; worked-out columns use the vocabulary's words and are never read; an unknown word is a
     problem, never a default; set-up reads a whole exported workbook.
   ROUND-TRIP: every demo workspace exported (workbook, zipped CSVs, the AI assistant's export_table, a Data table with
     columns hidden) loads straight back as no change; an edited copy applies exactly its edits; last cycle's file still
     finds its goals, by key.
   IMPORT-ACTIONS: an Action column stops or deletes a goal, or marks someone as left, with the app's rules and preview,
     and the import's Undo puts them back.
   PERSON-EMAIL: people are matched by email; a name only when one person has it, with a note; everyone new needs an
     email; the example's people have one each. */
import fs from 'node:fs';
import path from 'node:path';
import { isModuleOn } from '../src/core/registry';
/** Built without the spreadsheets module (FARO_WITHOUT): its scenarios skip. */
const noSheets = !isModuleOn(null, 'spreadsheets');
import { describe, expect, it } from 'vitest';
import readExcelFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { csvBytes, excelSheets } from '../src/app/files';
import { templateSheets, workbookGrids, zipGrids } from '../src/app/spreadsheet';
import { zipFiles } from '../src/app/zip';
import { buildPlatformOrg } from '../src/data/platformOrg';
import { applyCommit } from '../src/data/store';
import * as A from '../src/domain/actions';
import { asksOf } from '../src/domain/asks';
import { planChanges, type ChangeSet, type Tables } from '../src/domain/changeset';
import { headersOf, isWorkedOut, KEY_COLUMNS, SHEETS, specOf } from '../src/domain/columns';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { csvFiles, sheetNamed, toCsv, workbook, type Table } from '../src/domain/export';
import { exportFormatMarkdown } from '../src/domain/formatDoc';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../src/domain/importer';
import { currentWeek } from '../src/domain/plan';
import * as R from '../src/domain/removal';
import { parseDelimited, readTables, recordsOf, type NamedGrid } from '../src/domain/sheets';
import { checkInsFor } from '../src/domain/status';
import { exportedTable, TABLES, usualLayout } from '../src/domain/tableLayout';
import { LABEL, LEFT, STOPPED } from '../src/domain/vocabulary';
import { callTool, type McpContext } from '../src/mcp/tools';
import type { Goal, MetricGoal, Snapshot } from '../src/domain/types';

const F = (id: 'ONE-FORMAT' | 'ROUND-TRIP' | 'IMPORT-ACTIONS' | 'PERSON-EMAIL', text: string) => `[${id}] ${text}`;
const root = path.join(__dirname, '..');
const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_f${++n}`;
const full0 = buildPlatformOrg(today);
const cycle = currentCycle(full0.cycles, today)!;
const week = currentWeek(cycle, today);
const scoped = (full: Snapshot) => scopeToCycle(full, cycle);
const bookOf = (full: Snapshot) => workbook({ ws: { id: 'w', name: 'Example' }, snapshot: scoped(full), cycle, week, today });
const load = (full: Snapshot, tables: Tables, actor = 'amara', via: 'spreadsheet' | 'mcp' | 'table' = 'spreadsheet'): ChangeSet => {
  const s = scoped(full);
  return planChanges({ tables, snapshot: s, cycle, week, actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId, via, full });
};
const errors = (cs: ChangeSet) => cs.issues.filter((i) => i.severity === 'error').map((i) => `${i.sheet} ${i.row}: ${i.message}`);
async function asXlsx(book: Table[]): Promise<NamedGrid[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = await (writeXlsxFile as any)(excelSheets(book)).toBuffer() as Buffer;
  return workbookGrids((await readExcelFile(bytes)) as unknown as { sheet: string; data: unknown[][] }[]);
}
const asZip = (book: Table[]) => zipGrids(zipFiles(csvFiles(book).map((f) => ({ name: f.name, data: csvBytes(f.text) }))));
const recs = (t: Table) => recordsOf(parseDelimited(toCsv(t.rows)));
const ctxOf = (full: Snapshot, actor: string, save: (c: import('../src/data/store').Commit) => void): McpContext => ({
  ws: { id: 'w', name: 'Example' }, snapshot: scoped(full), cycle, week, today, actor: full.people.find((p) => p.id === actor)!, now: today.toISOString(), newId,
  save: async (c) => save(c), issueToken: async () => 'x', full, allGoals: full.goals,
});

describe('one format', () => {
  it(F('ONE-FORMAT', 'every sheet and column is defined once, and the workbook, the zipped CSVs, the set-up template and the Data tables are made from it'), () => {
    const book = bookOf(full0);
    expect(book.map((t) => t.name)).toEqual(['Start here', ...SHEETS.map((x) => x.name)]);
    for (const sheet of SHEETS) {
      const head = sheetNamed(book, sheet.name).rows[0]!.map(String);
      // The Plan sheet adds a column per week after its own.
      expect(head.slice(0, sheet.columns.length), sheet.name).toEqual(headersOf(sheet.kind));
      // Worked-out and for-reading columns are set apart (grey) in the workbook.
      expect(sheetNamed(book, sheet.name).muted, sheet.name).toEqual(head.filter((h) => isWorkedOut(sheet.kind, h)));
    }
    expect(csvFiles(book).map((f) => f.name)).toEqual(book.map((t) => `${t.name}.csv`));
    // The set-up template is the same format: its columns are the People and Goals sheets' own.
    for (const t of templateSheets()) for (const h of t.rows[0]!) expect(headersOf(t.name === 'People' ? 'people' : 'goals')).toContain(h);
    // The Data tables show the workbook's sheets.
    for (const t of Object.values(TABLES)) expect(book.some((b) => b.name === t.sheet)).toBe(true);
    // Start here explains every column: what it means and, on a sheet that loads back, what a new row needs (the field table).
    const readme = sheetNamed(book, 'Start here').rows;
    for (const sheet of SHEETS) {
      const at = readme.findIndex((r) => r[0] === `The ${sheet.name} sheet`);
      const block = readme.slice(at + 1, readme.findIndex((r, i) => i > at && !r.length));
      for (const c of sheet.columns) expect(block.some((r) => r[0] === c.header && r[5] === c.means), `${sheet.name} ${c.header}`).toBe(true);
    }
    expect(readme.flat().join(' ')).not.toMatch(/\bRequests\b/);
  });

  it(F('ONE-FORMAT', 'docs/export-format.md is made from the same definitions, and is current'), () => {
    const doc = fs.readFileSync(path.join(root, 'docs/export-format.md'), 'utf8');
    expect(doc).toBe(exportFormatMarkdown());
    for (const sheet of SHEETS) for (const c of sheet.columns) expect(doc).toContain(`| ${c.header.replace(/\|/g, '\\|')} |`);
    expect(doc).toMatch(/"ownerEmail"/);
    expect(doc).toMatch(/## Activity/);
  });

  it(F('ONE-FORMAT', 'a sheet is known by its header row, never its name: a People table saved from Data, a CSV called anything'), () => {
    const people = exportedTable(sheetNamed(bookOf(full0), 'People'), { ...usualLayout('people'), cols: ['Job title'] });
    const r = readTables([{ name: 'Sheet1.csv', rows: parseDelimited(toCsv(people.rows)) }, { name: 'Goals.csv', rows: parseDelimited(toCsv(sheetNamed(bookOf(full0), 'Asks').rows)) }]);
    expect(r.read).toEqual([{ name: 'Sheet1.csv', kind: 'people' }]);
    expect(r.skipped).toEqual([{ name: 'Goals.csv', why: 'written for reading; not loaded back' }]);
  });

  it(F('ONE-FORMAT', 'worked-out columns say the vocabulary’s words and are never read: changing them changes nothing'), () => {
    const book = bookOf(full0);
    const goals = recs(sheetNamed(book, 'Goals'));
    const words = new Set([...Object.values(LABEL), STOPPED]);
    expect(goals.every((r) => words.has(r['status']!))).toBe(true);
    const checkIns = recs(sheetNamed(book, 'Check-ins'));
    expect(checkIns.every((r) => words.has(r['calculated']!))).toBe(true);
    for (const r of goals) { r['status'] = 'Whatever'; r['gap'] = 'none'; r['forecast'] = ''; }
    for (const r of checkIns) { r['calculated'] = 'Nonsense'; r['posted by'] = 'Someone else'; r['plan that week'] = '0'; }
    const cs = load(full0, { goals, checkIns });
    expect(errors(cs)).toEqual([]);
    expect(cs.items).toEqual([]);
  });

  it(F('ONE-FORMAT', 'a word a column doesn’t know is a problem to fix, never a quiet default'), () => {
    const g = scoped(full0).goals.find((x) => x.kind === 'range')!;
    const bad = (o: Record<string, string>) => errors(load(full0, { goals: [{ __row: '2', key: g.key!, ...o }] }))[0] ?? '';
    expect(bad({ level: 'vp' })).toMatch(/Level “vp” isn’t one of: north star, svp or team/);
    expect(bad({ 'must stay': 'sometimes' })).toMatch(/Must stay “sometimes” isn’t one of: at most or at least/);
    expect(bad({ type: 'pie' })).toMatch(/Type “pie”/);
    expect(bad({ action: 'Archive' })).toMatch(/Action “Archive” isn’t one of: Stop, Delete or Example/);
    const m = scoped(full0).goals.find((x) => x.kind === 'metric')!;
    expect(errors(load(full0, { goals: [{ __row: '2', key: m.key!, plan: 'zigzag' }] }))[0]).toMatch(/Plan “zigzag”/);
    const ci = checkInsFor(m, scoped(full0).checkIns).at(-1)!;
    expect(errors(load(full0, { checkIns: [{ __row: '2', id: ci.id, 'goal key': m.key!, week: String(ci.week), recovery: 'maybe' }] }))[0]).toMatch(/Recovery “maybe”/);
  });

  it(F('ONE-FORMAT', 'set-up reads a whole exported workbook: people (not its Asks), keys, decimals, due weeks, definitions, why it helps, plans and past check-ins'), async () => {
    const read = readTables(await asXlsx(bookOf(full0)));
    const people = toCsv(sheetNamed(bookOf(full0), 'People').rows);
    const set = buildWorkspace({ name: 'Copy', startDate: cycle.startDate, people, goals: '', tables: read.tables, now: today, idSuffix: 'copy' });
    expect(set.issues).toEqual([]);
    const live = scoped(full0);
    expect(set.snapshot.people.length).toBe(live.people.length);
    expect(set.snapshot.people.every((p) => p.email)).toBe(true);
    expect(set.snapshot.goals.length).toBe(live.goals.length);
    for (const g of live.goals) {
      const c = set.snapshot.goals.find((x) => x.key === g.key)!;
      expect(c, g.key).toBeDefined();
      expect([c.title, c.level, c.kind, c.definition, c.whyHelps ?? '', c.parentId ? set.snapshot.goals.find((x) => x.id === c.parentId)!.key : null])
        .toEqual([g.title, g.level, g.kind, g.definition, g.whyHelps ?? '', g.parentId ? live.goals.find((x) => x.id === g.parentId)!.key : null]);
      if (g.kind === 'metric' && c.kind === 'metric') expect([c.decimals, c.plan.endWeek ?? null, c.plan.fromWeek ?? 0]).toEqual([g.decimals, g.plan.endWeek ?? null, g.plan.fromWeek ?? 0]);
    }
    expect(set.snapshot.checkIns.length).toBe(live.checkIns.length);
  });
});

describe('round trip', () => {
  it(F('ROUND-TRIP', 'the example exported as a workbook and as zipped CSVs loads straight back as no change at all'), async () => {
    for (const grids of [await asXlsx(bookOf(full0)), await asZip(bookOf(full0))]) {
      const cs = load(full0, readTables(grids).tables);
      expect(errors(cs)).toEqual([]);
      expect(cs.items).toEqual([]);
    }
  });

  it(F('ROUND-TRIP', 'an edited copy applies exactly its edits: a value, a cause, an owner by email, a line break in Why, a cell starting with “-”'), async () => {
    const s = scoped(full0);
    const ci = s.checkIns.find((c) => c.cause && c.status === 'off' && c.week === week - 1 && s.goals.find((g) => g.id === c.goalId)?.kind === 'metric')!;
    const g = s.goals.find((x) => x.id === ci.goalId) as MetricGoal;
    const other = s.goals.find((x) => x.ownerId !== 'rhea' && x.id !== g.id)!;
    const book = structuredClone(bookOf(full0));
    const goals = sheetNamed(book, 'Goals').rows, gh = goals[0]!.map(String);
    goals.find((r) => r[gh.indexOf('Key')] === other.key)![gh.indexOf('Owner email')] = 'rhea.kapoor@example.com';
    const cis = sheetNamed(book, 'Check-ins').rows, ch = cis[0]!.map(String);
    const row = cis.find((r) => r[ch.indexOf('ID')] === ci.id)!;
    row[ch.indexOf('Value')] = Number(ci.value) + (g.plan.target < g.plan.start ? 1 : -1) * 10 ** -g.decimals;
    row[ch.indexOf('Cause')] = ci.cause === 'data' ? 'External factor' : 'Data problem';
    row[ch.indexOf('Why')] = 'The export job failed twice.\nWe re-ran it by hand.';
    row[ch.indexOf('Next step')] = '-1 day on the backlog first';
    expect(toCsv(cis)).toContain(`'-1 day on the backlog first`);
    for (const grids of [await asXlsx(book), await asZip(book)]) {
      const cs = load(full0, readTables(grids).tables);
      expect(errors(cs)).toEqual([]);
      expect(cs.items.map((x) => `${x.kind}: ${x.diffs.filter((d) => d.field !== 'Via').map((d) => d.field).sort().join(', ')}`).sort())
        .toEqual(['goal: Owner', 'replaces check-in: Cause, Next step, Note, Value']);
      const after = applyCommit(full0, cs.commit!);
      const saved = after.checkIns.find((c) => c.id === ci.id)!;
      expect([saved.why, saved.next]).toEqual(['The export job failed twice.\nWe re-ran it by hand.', '-1 day on the backlog first']);
      expect(after.goals.find((x) => x.id === other.id)!.ownerId).toBe('rhea');
    }
  });

  it.skipIf(noSheets)(F('ROUND-TRIP', 'the same round trip through the AI assistant: export_table, then bulk_change, changes nothing; an edit changes just that'), async () => {
    let full = full0;
    const ctx = () => ctxOf(full, 'amara', (c) => { full = applyCommit(full, c); });
    for (const [table, key] of [['goals', 'goals'], ['checkIns', 'check_ins'], ['plan', 'plan'], ['people', 'people']] as const) {
      const out = await callTool('export_table', { table, format: 'json' }, ctx());
      const rows = (out.data as { rows: Record<string, unknown>[] }).rows;
      // The table's usual columns leave the goal's ID out; it's added at the end, so the rows load back.
      for (const k of KEY_COLUMNS[table === 'checkIns' ? 'checkIns' : table]) expect(Object.keys(rows[0]!), table).toContain(k);
      const back = await callTool('bulk_change', { [key]: rows }, ctx());
      expect(back.text, table).toBe('Nothing to change: it already says that.');
    }
    const goals = (await callTool('export_table', { table: 'goals', columns: ['Owner', 'Target'], format: 'json' }, ctx())).data as { columns: string[]; rows: Record<string, unknown>[] };
    expect(goals.columns).toEqual(['Goal', 'Key', 'Owner', 'Target', 'ID']);
    const row = goals.rows.find((r) => r['Owner'] !== 'Rhea Kapoor' && r['Target'] != null)!;
    const saved = await callTool('bulk_change', { goals: [{ ...row, Owner: 'Rhea Kapoor' }], apply: true }, ctx());
    expect(saved.text).toMatch(/^Saved as Amara Nwosu: 1 goal changed/);
    expect(saved.text).toMatch(/“Rhea Kapoor” matched by name: Rhea Kapoor \(rhea.kapoor@example.com\)/);
    expect(full.goals.find((g) => g.key === row['Key'])!.ownerId).toBe('rhea');
  });

  it(F('ROUND-TRIP', 'a Data table saved with columns hidden loads back as no change; a value edited where Cause is hidden keeps its cause'), () => {
    const book = bookOf(full0);
    const goals = exportedTable(sheetNamed(book, 'Goals'), { ...usualLayout('goals'), cols: ['Owner', 'Status'] });
    expect(goals.rows[0]).toEqual(['Goal', 'Key', 'Owner', 'Status', 'ID']);
    expect(goals.muted).toEqual(['ID']);
    const ci = exportedTable(sheetNamed(book, 'Check-ins'), { ...usualLayout('checkIns'), cols: ['Value'] });
    expect(ci.rows[0]).toEqual(['Goal', 'ID', 'Value', 'Goal key', 'Goal ID', 'Week']);
    expect(load(full0, { goals: recs(goals), checkIns: recs(ci) }).items).toEqual([]);
    // A behind-plan check-in's value, corrected with Cause and Path to green out of view: they stay as they were.
    const s = scoped(full0);
    const target = s.checkIns.find((c) => c.cause && c.status === 'off' && c.pathToGreen && c.week === week - 1 && s.goals.find((g) => g.id === c.goalId)?.kind === 'metric')!;
    const g = s.goals.find((x) => x.id === target.goalId) as MetricGoal;
    const rows = recs(ci).filter((r) => r['id'] === target.id);
    rows[0]!['value'] = String(Number(target.value) + (g.plan.target < g.plan.start ? 1 : -1) * 10 ** -g.decimals);
    const cs = load(full0, { checkIns: rows });
    expect(errors(cs)).toEqual([]);
    const after = cs.commit!.checkIns![0]!;
    expect([after.cause, after.why, after.pathToGreen?.what]).toEqual([target.cause, target.why, target.pathToGreen?.what]);
  });

  it(F('ROUND-TRIP', 'last cycle’s file still finds its goals: a goal carried into a new cycle keeps its key, not its ID'), () => {
    const s = scoped(full0);
    // The same goals in a new cycle: new IDs, the same keys.
    const moved = (id: string | null) => (id ? id + '-next' : null);
    const next: Snapshot = { ...full0, goals: full0.goals.map((g) => ({ ...g, id: moved(g.id)!, parentId: moved(g.parentId) }) as Goal), checkIns: [], requests: [] };
    const goals = recs(sheetNamed(bookOf(full0), 'Goals'));
    const cs = planChanges({ tables: { goals }, snapshot: { ...scoped(next), checkIns: [] }, cycle, week, actor: s.people.find((p) => p.id === 'amara')!, now: today.toISOString(), newId, via: 'spreadsheet' });
    expect(errors(cs)).toEqual([]);
    expect(cs.items).toEqual([]);
  });
});

describe('a row’s Action', () => {
  function workspace() {
    let full: Snapshot = full0;
    // A goal set up by mistake, with no check-ins: the one Delete is for.
    const owner = 'mateo';
    const blank: Goal = { ...(scoped(full).goals.find((g) => g.ownerId === owner && g.kind === 'metric')!), id: 'g_mistake', key: 'G-990', title: 'Set up by mistake', parentId: null };
    full = applyCommit(full, { goals: [blank], changes: [] });
    return { get full() { return full; }, save(c: import('../src/data/store').Commit) { full = applyCommit(full, c); } };
  }

  it(F('IMPORT-ACTIONS', 'Stop (with a reason), Delete and Left preview and apply with the app’s own rules, and Undo puts every one back'), () => {
    const w = workspace();
    const s = scoped(w.full);
    const stop = s.goals.find((g) => s.goals.some((c) => c.parentId === g.id) && checkInsFor(g, s.checkIns).length && asksOf(s).some((a) => a.status === 'open' && a.goalIds.includes(g.id)))
      ?? s.goals.find((g) => s.goals.some((c) => c.parentId === g.id) && checkInsFor(g, s.checkIns).length)!;
    const leaver = s.people.find((p) => p.id === 'pavel')!;
    const book = bookOf(w.full);
    const goals = recs(sheetNamed(book, 'Goals'));
    goals.find((r) => r['key'] === stop.key)!['action'] = 'Stop';
    goals.find((r) => r['key'] === stop.key)!['reason'] = 'Folded into the reliability goal this quarter.';
    goals.find((r) => r['key'] === 'G-990')!['action'] = 'Delete';
    const people = recs(sheetNamed(book, 'People'));
    people.find((r) => r['email'] === leaver.email)!['action'] = LEFT;
    people.find((r) => r['email'] === leaver.email)!['takes over'] = 'rhea.kapoor@example.com';
    // The whole workbook comes back: the stopped goal's own plan and check-in rows, unchanged, are fine.
    const cs = load(w.full, { goals, people, plan: recs(sheetNamed(book, 'Plan')), checkIns: recs(sheetNamed(book, 'Check-ins')) });
    expect(errors(cs)).toEqual([]);
    expect([cs.counts.stopped, cs.counts.deleted, cs.counts.left]).toEqual([1, 1, 1]);
    // The same commit the app makes for each, with the same consequences: what fed the stopped goal moves up, the
    // leaver's goals go to whoever takes over.
    const x = (who: string): A.ActionContext => ({ snapshot: scoped(w.full), cycle, week, actor: w.full.people.find((p) => p.id === who)!, now: today.toISOString(), newId, full: w.full, allGoals: w.full.goals });
    const app = R.stopGoal(x('amara'), stop.id, 'Folded into the reliability goal this quarter.');
    expect(cs.commit!.goals!.filter((g) => app.goals!.some((v) => v.id === g.id)).length).toBe(app.goals!.length);
    w.save(cs.commit!);
    const after = scoped(w.full);
    expect(after.goals.some((g) => g.id === stop.id)).toBe(false);
    expect(after.archive!.goals.find((g) => g.id === stop.id)!.stopReason).toBe('Folded into the reliability goal this quarter.');
    expect(after.goals.filter((g) => g.parentId === stop.id)).toEqual([]);
    expect(w.full.goals.find((g) => g.id === 'g_mistake')!.removedAt).toBeTruthy();
    expect(w.full.people.find((p) => p.id === 'pavel')!.leftAt).toBeTruthy();
    expect(after.goals.filter((g) => g.ownerId === 'pavel')).toEqual([]);
    // Undo the import: every row as it was.
    const imp = cs.commit!.changes.at(-1)!.entityId;
    const undo = R.undoImport(x('amara'), imp);
    expect(undo.skipped).toEqual([]);
    w.save(undo.commit);
    const back = scoped(w.full);
    expect(back.goals.find((g) => g.id === stop.id)!.stoppedAt ?? null).toBeNull();
    expect(back.goals.find((g) => g.id === 'g_mistake')!.removedAt ?? null).toBeNull();
    expect(back.people.find((p) => p.id === 'pavel')!.leftAt ?? null).toBeNull();
    expect(back.goals.filter((g) => g.ownerId === 'pavel').length).toBe(s.goals.filter((g) => g.ownerId === 'pavel').length);
    expect(back.goals.filter((g) => g.parentId === stop.id).length).toBe(s.goals.filter((g) => g.parentId === stop.id).length);
  });

  it(F('IMPORT-ACTIONS', 'the same refusals as the app: a stop needs a reason, a goal with check-ins is stopped not deleted, someone with goals needs who takes over, only admins mark people as left'), () => {
    const w = workspace();
    const s = scoped(w.full);
    const g = s.goals.find((x) => x.ownerId === 'mateo' && checkInsFor(x, s.checkIns).length)!;
    expect(errors(load(w.full, { goals: [{ __row: '2', key: g.key!, action: 'Stop' }] }))[0]).toMatch(/Say why it’s stopping/);
    expect(errors(load(w.full, { goals: [{ __row: '2', key: g.key!, action: 'Delete' }] }))[0]).toMatch(/stop it instead/);
    expect(errors(load(w.full, { goals: [{ __row: '2', key: g.key!, action: 'Stop', reason: 'No longer needed this year.', goal: 'Renamed' }] }))[0]).toMatch(/can’t also change the goal/);
    expect(errors(load(w.full, { people: [{ __row: '2', email: 'mateo.fernandez@example.com', action: LEFT }] }))[0]).toMatch(/say who takes them over in Takes over/);
    expect(errors(load(w.full, { people: [{ __row: '2', email: 'rhea.kapoor@example.com', action: LEFT, 'takes over': 'tariq.haddad@example.com' }] }, 'mateo'))[0]).toMatch(/Only an admin/);
    // A non-owner's stop is refused as in the app.
    expect(errors(load(w.full, { goals: [{ __row: '2', key: g.key!, action: 'Stop', reason: 'Not mine to stop, though.' }] }, 'rhea'))[0]).toMatch(/Only the goal’s owner or an admin/);
  });
});

describe('people by email', () => {
  it(F('PERSON-EMAIL', 'every person in the example has an email, firstname.lastname@example.com, and no two share one'), () => {
    expect(full0.people.every((p) => /^[a-z-]+\.[a-z-]+@example\.com$/.test(p.email ?? ''))).toBe(true);
    expect(new Set(full0.people.map((p) => p.email)).size).toBe(full0.people.length);
    expect(full0.people.find((p) => p.id === 'mateo')!.email).toBe('mateo.fernandez@example.com');
  });

  it(F('PERSON-EMAIL', 'someone new needs an email, lower case and no one else’s, in the app, a spreadsheet and set-up'), () => {
    const s = scoped(full0);
    const x: A.ActionContext = { snapshot: s, cycle, week, actor: s.people.find((p) => p.id === 'grace')!, now: today.toISOString(), newId };
    const p = { id: 'p_new', name: 'Ada Lovelace', role: '', initials: 'AL', teamId: 'sre', admin: false };
    expect(() => A.savePerson(x, p, null)).toThrow(/Add their email/);
    expect(() => A.savePerson(x, { ...p, email: 'mateo.fernandez@example.com' }, null)).toThrow(/Mateo Fernández already has the email/);
    expect(A.savePerson(x, { ...p, email: 'ada@example.com' }, null)!.people![0]!.email).toBe('ada@example.com');
    const row = { __row: '2', name: 'Ada Lovelace', team: 'Site Reliability Engineering' };
    expect(errors(load(full0, { people: [row] }, 'grace'))[0]).toMatch(/Add Ada Lovelace’s email/);
    const added = load(full0, { people: [{ ...row, email: 'Ada.Lovelace@Example.com' }] }, 'grace');
    expect(errors(added)).toEqual([]);
    expect(added.commit!.people![0]!.email).toBe('ada.lovelace@example.com');
    const set = buildWorkspace({ name: 'X', startDate: '2026-01-05', people: 'Name\tTeam\nAna\tOps', goals: '', now: today, idSuffix: 'e' });
    expect(set.issues.map((i) => i.message)).toEqual(['Add Ana’s email: everyone new needs one.']);
    expect(buildWorkspace({ name: 'X', startDate: '2026-01-05', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: today, idSuffix: 'e' }).issues).toEqual([]);
  });

  it(F('PERSON-EMAIL', 'a row finds its person by email, then by a name only one person has (said in the preview), and a person by their email in Owner email and Takes over'), () => {
    const s = scoped(full0);
    const goal = s.goals.find((g) => g.ownerId !== 'rhea')!;
    const byName = load(full0, { goals: [{ __row: '2', key: goal.key!, owner: 'Rhea Kapoor' }] });
    expect(byName.issues).toEqual([expect.objectContaining({ severity: 'note', message: '“Rhea Kapoor” matched by name: Rhea Kapoor (rhea.kapoor@example.com). An email column is exact.' })]);
    // Someone added before emails existed is found by name and given the email the row says.
    const old = { ...full0, people: full0.people.map((p) => (p.id === 'wen' ? { ...p, email: undefined } : p)) };
    const fill = load(old, { people: [{ __row: '2', name: 'Wen Zhao', email: 'wen.zhao@example.com' }] }, 'grace');
    expect(errors(fill)).toEqual([]);
    expect(fill.commit!.people![0]).toMatchObject({ id: 'wen', email: 'wen.zhao@example.com' });
    // Two people with one name: the email says which.
    const twin = { ...full0, people: [...full0.people, { ...full0.people.find((p) => p.id === 'rhea')!, id: 'rhea2', email: 'rhea.k@example.com', teamId: 'sre' }] };
    expect(errors(load(twin, { goals: [{ __row: '2', key: goal.key!, owner: 'Rhea Kapoor' }] }))[0]).toMatch(/2 people are called “Rhea Kapoor”. Use their email instead/);
    const exact = load(twin, { goals: [{ __row: '2', key: goal.key!, owner: 'Rhea Kapoor', 'owner email': 'rhea.k@example.com' }] });
    expect(exact.commit!.goals![0]!.ownerId).toBe('rhea2');
    // A dash means none, and an email column left as it was doesn't undo a name changed beside it.
    expect(errors(load(full0, { goals: [{ __row: '2', key: goal.key!, team: '—' }] }))).toEqual([]);
    const renamedBeside = load(full0, { goals: [{ __row: '2', key: goal.key!, owner: 'Rhea Kapoor', 'owner email': s.people.find((p) => p.id === goal.ownerId)!.email! }] });
    expect(renamedBeside.commit!.goals![0]!.ownerId).toBe('rhea');
    void specOf;
  });
});
