/* Rows downloaded from the preview (backlog IM3; import spec 2.3): the rows to fix, or the rows left out, as a workbook
   with the file's own headers and a first column, Problem, saying what is wrong with each. Corrected and loaded again,
   it is read like any file: the Problem column is one the engine doesn't read, and said so. */
import type { SheetOut } from '../../app/files';
import type { Sheet } from '../../domain/problemLevels';
import type { ReadTables, Tables } from '../../domain/sheets';

const KEY: Record<Sheet, keyof Tables> = { Goals: 'goals', Plan: 'plan', 'Check-ins': 'checkIns', People: 'people' };
const ORDER: Sheet[] = ['Goals', 'Plan', 'Check-ins', 'People'];

export interface RowProblem { sheet: Sheet; row: number; problem: string }

/** The sheets of the download: per sheet with rows, Problem then the file's headers, in the file's order. */
export function rowsSheets(read: ReadTables, tables: Tables, rows: readonly RowProblem[]): SheetOut[] {
  return ORDER.flatMap((sheet) => {
    const key = KEY[sheet];
    const mine = rows.filter((x) => x.sheet === sheet);
    const recs = tables[key] ?? [];
    if (!mine.length || !recs.length) return [];
    const head = read.headers[key] ?? Object.keys(recs[0]!).filter((k) => k !== '__row');
    // A header one letter out keeps its key as written (domain/sheets readTables), so it is looked up both ways.
    const problems = new Map<number, string[]>();
    for (const x of mine) problems.set(x.row, [...new Set([...(problems.get(x.row) ?? []), x.problem])]);
    const body = recs.filter((r, i) => problems.has(Number(r.__row ?? i + 2))).map((r, i) => [problems.get(Number(r.__row ?? i + 2))!.join(' '), ...head.map((h) => r[h.toLowerCase()] ?? r[h] ?? '')]);
    const name = read.read.find((x) => x.kind === key)?.name.replace(/\.(csv|tsv|txt)$/i, '') ?? sheet;
    return [{ name, rows: [['Problem', ...head], ...body], bold: ['Problem'] }];
  });
}

/** The chosen file's name without its extension: "{original}-rows-to-fix". */
export const baseName = (name: string) => name.replace(/\.[a-z0-9]+$/i, '') || 'import';

/** The rows left out, each with why, as the download's Problem column says it. */
export const leftRowsOf = (left: readonly ({ sheet: Sheet; row: number; because?: string })[]): RowProblem[] =>
  left.map((x) => ({ sheet: x.sheet, row: x.row, problem: x.because ? `Left out: ${x.because}.` : 'Left out at your choice.' }));
