// @vitest-environment node
/* The field table (backlog IM1; import spec section 3, rules 1 and 2): every column a person fills in says whether a
   new row must have it, its format, an example and what an empty cell does, once, in domain/columns. The template, the
   workbook's Start here sheet, docs/export-format.md, Help and the Import page are made from it. */
import readExcelFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { excelSheets } from '../app/files';
import { workbookGrids } from '../app/spreadsheet';
import { buildPlatformOrg } from '../data/platformOrg';
import { planChanges } from './changeset';
import { EXAMPLE_ROWS, fieldHeaders, fieldTable, FILL_SHEETS, isFillIn, requiredLine, requiredText, requiredWord, specOf, WEEK_COLUMN, type FillKind } from './columns';
import { currentCycle, scopeToCycle } from './cycle';
import { startHere, templateWorkbook, workbook, type Table } from './export';
import { currentWeek } from './plan';
import { LOADED_SHEETS, readTables } from './sheets';

const today = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const week = currentWeek(cycle, today);
const s = scopeToCycle(full, cycle);
const x = { ws: { id: 'ws_platform', name: 'Platform Engineering' }, cycle, week, today };
let n = 0;
const load = (tables: ReturnType<typeof readTables>['tables'], actor = 'amara') => planChanges({ tables, snapshot: s, cycle, week, actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId: (p) => `${p}_ft${++n}`, via: 'spreadsheet', full });
async function asXlsx(book: Table[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = await (writeXlsxFile as any)(excelSheets(book)).toBuffer() as Buffer;
  return workbookGrids((await readExcelFile(bytes)) as unknown as { sheet: string; data: unknown[][] }[]);
}

describe('the field table', () => {
  it('[FIELD-TABLE] every column a person fills in says whether a new row needs it, its format, an example and what empty does', () => {
    for (const kind of FILL_SHEETS) {
      const table = fieldTable(kind);
      // Every column of the sheet is in the table, in the sheet's order (the Plan sheet adds its Week N).
      expect(table.slice(0, specOf(kind).columns.length).map((c) => c.header), kind).toEqual(specOf(kind).columns.map((c) => c.header));
      for (const c of table.filter(isFillIn)) {
        expect([c.format, c.example, c.empty].every((v) => v.trim().length > 0), `${kind} ${c.header}`).toBe(true);
      }
      // A worked-out column is never asked for, and says so.
      for (const c of table.filter((v) => v.role === 'worked')) expect(c.required, `${kind} ${c.header}`).toBeNull();
    }
  });

  it('[FIELD-TABLE] every column a person fills in on a sheet that loads back has a field-table entry, and every entry is a real column', () => {
    // Read from the sheets themselves, not the table: a new column with no entry would otherwise pass as worked out.
    const fillRoles = ['match', 'edit', 'action'];
    expect(LOADED_SHEETS.length).toBeGreaterThan(0);
    for (const kind of LOADED_SHEETS) {
      expect(FILL_SHEETS, kind).toContain(kind);
      const k = kind as FillKind;
      const cols = [...specOf(k).columns, ...(k === 'plan' ? [WEEK_COLUMN] : [])];
      const missing = cols.filter((c) => fillRoles.includes(c.role) && !fieldHeaders(k).includes(c.header)).map((c) => c.header);
      expect(missing, `${kind}: fill-in columns with no field-table entry`).toEqual([]);
      for (const c of cols.filter((v) => fillRoles.includes(v.role))) {
        const row = fieldTable(k).find((r) => r.header === c.header)!;
        expect(row.required, `${kind} ${c.header}`).not.toBeNull();
      }
      const unknown = fieldHeaders(k).filter((h) => !cols.some((c) => c.header === h));
      expect(unknown, `${kind}: field-table entries naming no column`).toEqual([]);
    }
  });

  it('[FIELD-TABLE] a new goal needs Goal, and Owner or Owner email; a number goal Start and Target', () => {
    const goals = fieldTable('goals');
    expect(goals.filter((c) => c.required === 'required').map((c) => c.header)).toEqual(['Goal', 'Owner', 'Owner email']);
    expect(goals.filter((c) => c.oneOf === 'owner').map((c) => c.header)).toEqual(['Owner', 'Owner email']);
    expect(requiredText(goals.find((c) => c.header === 'Owner')!, goals)).toBe('Required (or Owner email)');
    expect(requiredText(goals.find((c) => c.header === 'Start')!, goals)).toBe('Required for a number goal');
    expect(requiredText(goals.find((c) => c.header === 'Status')!, goals)).toBe('Worked out');
    expect(requiredWord({ for: ['metric'] })).toBe('Required for a number goal');
    expect(requiredWord({ for: ['metric', 'range'] })).toBe('Required for a number or range goal');
    expect(requiredWord({ optional: 'team' })).toBe('Optional');
    expect(requiredWord('leave-empty')).toBe('Leave empty');
  });

  it('[FIELD-TABLE] says what a new row must have in one line per sheet', () => {
    expect(requiredLine('goals')).toBe('Goal, and Owner or Owner email. A number goal also needs Start and Target; a range goal, Limit; a stages goal, Stages.');
    expect(requiredLine('checkIns')).toBe('Goal key (or Goal), Week, and Value or Stages.');
    expect(requiredLine('people')).toBe('Name and Email.');
  });
});

describe('the Start here sheet and the template', () => {
  it('[FIELD-TABLE] the workbook opens on Start here: the file’s workspace and cycle, then the field table of every sheet that loads back', () => {
    const book = workbook({ ...x, snapshot: s });
    expect(book[0]!.name).toBe('Start here');
    const rows = book[0]!.rows;
    expect(rows[1]).toEqual(['File of', 'ws_platform', cycle.id]);
    const goals = fieldTable('goals');
    for (const c of goals) expect(rows.some((r) => r[0] === c.header && r[1] === requiredText(c, goals)), c.header).toBe(true);
    expect(rows.some((r) => r[0] === 'The Goals sheet' && String(r[1]).includes('A new row needs: Goal, and Owner or Owner email.'))).toBe(true);
    // Loading the workbook back skips it, as it skipped the README.
    expect(readTables([{ name: 'Start here', rows: rows.map((r) => r.map((v) => (v == null ? '' : String(v)))) }]).read).toEqual([]);
  });

  it('[FIELD-TABLE] the template is Start here and the fill-in columns, with example rows that say Example', () => {
    const book = templateWorkbook(x);
    expect(book.map((t) => t.name)).toEqual(['Start here', 'Goals', 'Plan', 'Check-ins', 'People']);
    const goals = book.find((t) => t.name === 'Goals')!;
    expect(goals.rows[0]).toEqual(fieldTable('goals').filter(isFillIn).map((c) => c.header));
    expect(goals.bold).toEqual(['Goal', 'Owner', 'Owner email']);
    expect(goals.rows.slice(1).map((r) => r[goals.rows[0]!.indexOf('Action')])).toEqual(['Example', 'Example']);
    // The template's Start here lists only the columns it has.
    expect(startHere(x, { template: true }).some((r) => r[0] === 'Status')).toBe(false);
    expect(EXAMPLE_ROWS.people).toHaveLength(1);
  });

  it('[FIELD-TABLE] the template loaded back unchanged changes nothing, and counts its 3 example rows', async () => {
    const read = readTables(await asXlsx(templateWorkbook(x)));
    expect(read.read.map((v) => v.kind).sort()).toEqual(['checkIns', 'goals', 'people', 'plan']);
    expect(read.skipped.map((v) => v.name)).toEqual(['Start here']);
    const cs = load(read.tables);
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.items).toEqual([]);
    expect(cs.examples).toBe(3);
  }, 30_000);

  it('a row whose Action says Example is left out wherever it is, even with nothing else right', () => {
    const cs = load({ goals: [{ goal: 'X', action: 'Example', owner: 'Nobody here' }], people: [{ name: 'Y', action: 'example' }] });
    expect([cs.items.length, cs.examples, cs.issues.length]).toEqual([0, 2, 0]);
  });
});
