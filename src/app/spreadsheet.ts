/* Spreadsheets in: reading what people upload, on Import and in set-up. Any file the app exports comes back the same way:
   a workbook (.xlsx), a zip of CSVs, or one CSV or tab-separated file. Each becomes named grids of text (line breaks
   kept), and each grid is recognised by its header row (domain/sheets). The libraries load only when someone uploads,
   so the app stays small. Files going out are saved by app/files (saveFile). */
import { GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../domain/importer';
import { gridOf, parseDelimited, readTables, type NamedGrid, type ReadTables } from '../domain/sheets';
import { MODULE_SHEETS } from '../core/records';
import type { SheetOut } from './files';

const isText = (name: string) => /\.(csv|tsv|txt)$/i.test(name);

/** A workbook's sheets, as the library reads them, as named grids. */
export const workbookGrids = (sheets: { sheet: string; data: unknown[][] }[]): NamedGrid[] => sheets.map((s) => ({ name: s.sheet, rows: gridOf(s.data) }));

/** A zip's CSVs as named grids. */
export async function zipGrids(bytes: Uint8Array): Promise<NamedGrid[]> {
  const { unzipFiles } = await import('./zip');
  const dec = new TextDecoder();
  return (await unzipFiles(bytes)).filter((f) => isText(f.name)).map((f) => ({ name: f.name.replace(/^.*\//, ''), rows: parseDelimited(dec.decode(f.data)) }));
}

/** Every sheet in a file, as named grids of text. */
export async function readGrids(file: File): Promise<NamedGrid[]> {
  if (isText(file.name)) return [{ name: file.name, rows: parseDelimited(await file.text()) }];
  if (/\.zip$/i.test(file.name)) return zipGrids(new Uint8Array(await file.arrayBuffer()));
  const { default: readExcelFile } = await import('read-excel-file/browser');
  return workbookGrids((await readExcelFile(file)) as unknown as { sheet: string; data: unknown[][] }[]);
}

/** A file's Goals, Plan, Check-ins and People, each found by its header, and the sheets left out (with why). */
export async function readChanges(file: File): Promise<ReadTables> {
  // The modules' sheets (Metrics) are known by their headers: written for reading, said so, never loaded back.
  return readTables(await readGrids(file), MODULE_SHEETS.map((m) => m.spec));
}

/** The set-up template: a People sheet and a Goals sheet in the one format, with example rows, ready for saveFile. */
export function templateSheets(): SheetOut[] {
  const sheet = (tsv: string, name: string): SheetOut => {
    const [head, ...rows] = parseDelimited(tsv);
    return { name, rows: [head ?? [], ...rows.map((r) => r.map((c) => (c === '' ? null : /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c)))] };
  };
  return [sheet(PEOPLE_TEMPLATE, 'People'), sheet(GOALS_TEMPLATE, 'Goals')];
}
