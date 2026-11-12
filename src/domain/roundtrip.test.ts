// @vitest-environment node
/* One format, proved by a round trip (release 3). Every demo workspace is exported as a workbook (real .xlsx bytes, read
   back with the same library the app reads with) and as zipped CSVs, and loaded straight back: no change at all. An
   edited copy then applies exactly its edits: a value, a cause, an owner by email, a line break in Why, and a cell
   starting with "-" (which the CSV guards with an apostrophe, and the import takes off again). */
import readExcelFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { csvBytes, excelSheets } from '../app/files';
import { workbookGrids, zipGrids } from '../app/spreadsheet';
import { zipFiles } from '../app/zip';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { planChanges, type ChangeSet, type Tables } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { csvFiles, workbook, type Table } from './export';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from './importer';
import { currentWeek } from './plan';
import { sameAsWritten } from './numbers';
import { parseDelimited, readTables, type NamedGrid } from './sheets';
import type { Cycle, MetricGoal, Snapshot } from './types';
import { MODULE_SHEETS } from '../core/records';

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_rt${++n}`;

/** Every demo workspace: the example, and one set up from the set-up template. */
function demos(): { name: string; full: Snapshot; cycle: Cycle; week: number }[] {
  const full = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const set = buildWorkspace({ name: 'Template', startDate: '2026-01-05', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: today, idSuffix: 'rt' });
  expect(set.issues).toEqual([]);
  return [
    { name: 'Platform Engineering example', full, cycle, week: currentWeek(cycle, today) },
    { name: 'Set-up template', full: set.snapshot, cycle: set.snapshot.cycles[0]!, week: currentWeek(set.snapshot.cycles[0]!, today) },
  ];
}

async function asXlsx(book: Table[]): Promise<NamedGrid[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = await (writeXlsxFile as any)(excelSheets(book)).toBuffer() as Buffer;
  return workbookGrids((await readExcelFile(bytes)) as unknown as { sheet: string; data: unknown[][] }[]);
}
const asZip = (book: Table[]) => zipGrids(zipFiles(csvFiles(book).map((f) => ({ name: f.name, data: csvBytes(f.text) }))));

const load = (d: ReturnType<typeof demos>[number], tables: Tables, actor = 'amara'): ChangeSet => {
  const s = scopeToCycle(d.full, d.cycle);
  const who = s.people.find((p) => p.id === actor) ?? s.people.find((p) => p.admin)!;
  return planChanges({ tables, snapshot: s, cycle: d.cycle, week: d.week, actor: who, now: today.toISOString(), newId, via: 'spreadsheet', full: d.full });
};
const errors = (cs: ChangeSet) => cs.issues.filter((i) => i.severity === 'error').map((i) => `${i.sheet} ${i.row}: ${i.message}`);
const bookOf = (d: ReturnType<typeof demos>[number], full = d.full) => workbook({ ws: { id: 'ws', name: d.name }, snapshot: scopeToCycle(full, d.cycle), cycle: d.cycle, week: d.week, today, sheets: MODULE_SHEETS });

describe('one format: export, load back, no change', () => {
  for (const d of demos()) {
    it(`${d.name}: the workbook loads back as no change at all`, async () => {
      const read = readTables(await asXlsx(bookOf(d)));
      expect(read.read.map((x) => x.kind).sort()).toEqual(['checkIns', 'goals', 'people', 'plan']);
      expect(read.skipped.map((x) => x.name)).toEqual(['Start here', 'Results', 'Asks', 'Notes', 'Metrics']);
      const cs = load(d, read.tables);
      expect(errors(cs)).toEqual([]);
      expect(cs.items).toEqual([]);
      expect(cs.unchanged).toBeGreaterThan(0);
    }, 30_000);
    it(`${d.name}: the zipped CSVs load back as no change at all`, async () => {
      const read = readTables(await asZip(bookOf(d)));
      expect(read.read.map((x) => x.name).sort()).toEqual(['Check-ins.csv', 'Goals.csv', 'People.csv', 'Plan.csv']);
      const cs = load(d, read.tables);
      expect(errors(cs)).toEqual([]);
      expect(cs.items).toEqual([]);
    }, 30_000);
  }
});

/* IM0 (import spec rule 9, N18 a): the round trip is exact on any day. The demo is rebuilt for the day it is opened, so
   its plans fall on different numbers each week: on 11 Nov a plan week of 0.405 USD was written 0.41 and read back as a
   change ("1 plan changed"), and in September a stage moved later read back as a new order of stages. */
describe('the round trip is exact, whatever the day and the decimals', () => {
  const at = (day: string) => {
    const t = new Date(`${day}T12:00:00Z`);
    const full = buildPlatformOrg(t);
    const cycle = currentCycle(full.cycles, t)!;
    return { name: day, full, cycle, week: currentWeek(cycle, t), today: t };
  };
  const roundTrip = (d: ReturnType<typeof at>, full = d.full) => {
    const s = scopeToCycle(full, d.cycle);
    const book = workbook({ ws: { id: 'ws', name: d.name }, snapshot: s, cycle: d.cycle, week: d.week, today: d.today });
    const read = readTables(csvFiles(book).map((f) => ({ name: f.name, rows: parseDelimited(f.text) })));
    return planChanges({ tables: read.tables, snapshot: s, cycle: d.cycle, week: d.week, actor: s.people.find((p) => p.admin)!, now: d.today.toISOString(), newId, via: 'spreadsheet', full });
  };

  for (const day of ['2026-09-01', '2026-11-09', '2026-11-11', '2026-12-01']) {
    it(`the demo as opened on ${day} loads back with no change`, () => {
      const cs = roundTrip(at(day));
      expect(errors(cs)).toEqual([]);
      expect(cs.items.map((x) => `${x.goal}: ${x.diffs.map((v) => v.field).join(', ')}`)).toEqual([]);
    }, 30_000);
  }

  it('goals at 0, 1, 2 and 3 decimal places, in every plan shape, load back with no change', () => {
    const d = at('2026-11-11');
    const base = d.full.goals.find((g): g is MetricGoal => g.kind === 'metric' && g.cycleId === d.cycle.id)!;
    // Plans whose weekly numbers fall between decimal places, half-way included (0.125 at 2 places is written 0.13).
    const made: MetricGoal[] = [0, 1, 2, 3].flatMap((decimals) => (['straight', 'back', 'stepped'] as const).map((shape, k) => ({
      ...base, id: `gen-${decimals}-${shape}`, key: `G-${900 + decimals * 10 + k}`, title: `Generated ${decimals} ${shape}`, decimals,
      plan: { start: Number((1 + 1 / 3).toFixed(decimals)), target: Number((5.125 + k / 7).toFixed(decimals)), shape, fromWeek: 3 + k },
      originalPlan: null, rebaselinedWeek: null, planHistory: undefined,
    })));
    const full: Snapshot = { ...d.full, goals: [...d.full.goals, ...made] };
    const cs = roundTrip(d, full);
    expect(errors(cs)).toEqual([]);
    expect(cs.items).toEqual([]);
  }, 30_000);
});

describe('one format: an edited copy applies exactly its edits', () => {
  const d = demos()[0]!;
  const s = scopeToCycle(d.full, d.cycle);
  // A goal behind plan whose latest check-in has a cause, owned by someone other than whoever takes it over.
  const latest = s.checkIns.filter((c) => c.cause && c.value != null && c.status === 'off' && c.week === d.week - 1);
  const ci = latest.find((c) => s.goals.find((g) => g.id === c.goalId)?.kind === 'metric')!;
  const goal = s.goals.find((g) => g.id === ci.goalId)!;
  const other = s.goals.find((g) => g.ownerId !== 'rhea' && g.id !== goal.id && g.kind === 'metric')!;
  const rhea = s.people.find((p) => p.id === 'rhea')!;
  const why = 'The vendor’s fix slipped a week.\nWe pair on the migration until it lands.';
  const next = '- call the vendor on Monday';
  const cause = ci.cause === 'blocked' ? 'Delivery slower' : 'Blocked by a dependency';

  function edit(book: Table[]): Table[] {
    const out = structuredClone(book);
    const goals = out.find((t) => t.name === 'Goals')!.rows;
    const gh = goals[0]!.map(String);
    goals.find((r) => r[gh.indexOf('ID')] === other.id)![gh.indexOf('Owner email')] = rhea.email!;
    const cis = out.find((t) => t.name === 'Check-ins')!.rows;
    const ch = cis[0]!.map(String);
    const row = cis.find((r) => r[ch.indexOf('ID')] === ci.id)!;
    const m = goal as MetricGoal;
    row[ch.indexOf('Value')] = Number(ci.value) + (m.plan.target < m.plan.start ? 1 : -1) * 10 ** -m.decimals;
    row[ch.indexOf('Cause')] = cause;
    row[ch.indexOf('Why')] = why;
    row[ch.indexOf('Next step')] = next;
    return out;
  }
  const expectEdits = (cs: ChangeSet) => {
    expect(errors(cs)).toEqual([]);
    expect(cs.items.map((x) => x.kind).sort()).toEqual(['goal', 'replaces check-in']);
    const g = cs.items.find((x) => x.kind === 'goal')!;
    expect(g.diffs.filter((x) => x.field !== 'Via').map((x) => x.field)).toEqual(['Owner']);
    const c = cs.items.find((x) => x.kind === 'replaces check-in')!;
    expect(c.diffs.filter((x) => x.field !== 'Via').map((x) => x.field).sort()).toEqual(['Cause', 'Next step', 'Note', 'Value']);
    const after = applyCommit(d.full, cs.commit!);
    expect(after.goals.find((x) => x.id === other.id)!.ownerId).toBe('rhea');
    const saved = after.checkIns.find((x) => x.id === ci.id)!;
    expect([saved.why, saved.next, saved.cause]).toEqual([why, next, cause === 'Delivery slower' ? 'slower' : 'blocked']);
    return after;
  };

  it('through the workbook', async () => {
    const after = expectEdits(load(d, readTables(await asXlsx(edit(bookOf(d)))).tables));
    // Exported again, it loads back as no change: the edits are now what the workspace says.
    expect(load({ ...d, full: after }, readTables(await asXlsx(bookOf(d, after))).tables).items).toEqual([]);
  }, 30_000);

  it('through the zipped CSVs, with the formula guard taken off again', async () => {
    const files = csvFiles(edit(bookOf(d)));
    // The cell starting with "-" is written with an apostrophe in front, so a spreadsheet won't run it as a formula.
    expect(files.find((f) => f.name === 'Check-ins.csv')!.text).toContain(`,'${next},`);
    const after = expectEdits(load(d, readTables(await asZip(edit(bookOf(d)))).tables));
    expect(load({ ...d, full: after }, readTables(await asZip(bookOf(d, after))).tables).items).toEqual([]);
  }, 30_000);
});

describe('a typed cell is the same as what was written', () => {
  it('compares numbers at the column’s written precision, never with a tolerance', () => {
    // 0.125 at 2 places is written 0.13: 0.005 away, which a tolerance of half a unit read as a change.
    expect(sameAsWritten('0.13', 0.125, 2)).toBe(true);
    expect(sameAsWritten(0.13, 0.125, 2)).toBe(true);
    expect(sameAsWritten('0.41', 0.405, 2)).toBe(true);
    expect(sameAsWritten(' 6 ', 6, 0)).toBe(true);
    expect(sameAsWritten('0.12', 0.125, 2)).toBe(false);
    expect(sameAsWritten('7', 6, 0)).toBe(false);
    expect(sameAsWritten('6', null, 0)).toBe(false);
  });
});

describe('one reader', () => {
  it('reads RFC 4180 CSV in one pass: quotes, doubled quotes, line breaks in a cell, a byte-order mark, CRLF', () => {
    const text = '﻿Goal,Why,Next step\r\n"Deploys, safely","He said ""ship it""\r\nthen paused",\'-later\r\n"""Quoted"" start",x,\r\n';
    expect(parseDelimited(text)).toEqual([['Goal', 'Why', 'Next step'], ['Deploys, safely', 'He said "ship it"\nthen paused', '-later'], ['"Quoted" start', 'x', '']]);
    expect(parseDelimited('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseDelimited('a;b\n1,5;2')).toEqual([['a', 'b'], ['1,5', '2']]);
  });
  it('knows each sheet by its header, whatever the file is called', () => {
    const r = readTables([
      { name: 'Sheet1.csv', rows: parseDelimited('Name,Email,ID\nAmara Nwosu,amara.nwosu@example.com,amara') },
      { name: 'export (3).csv', rows: parseDelimited('Goal,Key,Owner,Status,ID\nX,G-1,A,On,ns-lead') },
      { name: 'Goals', rows: parseDelimited('ID,Kind,Ask,Asked by\n1,Q,Why?,A') },
    ]);
    expect(r.read).toEqual([{ name: 'Sheet1.csv', kind: 'people' }, { name: 'export (3).csv', kind: 'goals' }]);
    expect(r.skipped.map((x) => x.name)).toEqual(['Goals']);
  });
});
