/* Spreadsheets in: reading what people upload. The library loads only when someone uploads, so the app stays small.
   Files going out are saved by app/files (saveFile). */
import { GOALS_TEMPLATE, parseTable, PEOPLE_TEMPLATE } from '../domain/importer';
import type { SheetOut } from './files';

const toTsv = (rows: unknown[][]) =>
  rows
    .map((r) => r.map((c) => (c == null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c)).replace(/[\t\n\r]+/g, ' ').trim()).join('\t'))
    .filter((line) => line.replace(/\t/g, '').trim() !== '')
    .join('\n');

const isGoals = (tsv: string) => /(^|\t)goal(\t|$)/i.test(tsv.split('\n')[0] ?? '');

/** Reads an .xlsx (a People sheet and an optional Goals sheet) or a single .csv, as tab-separated text. */
export async function readSpreadsheet(file: File): Promise<{ people?: string; goals?: string }> {
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const text = await file.text();
    return isGoals(text.replace(/,/g, '\t')) ? { goals: text } : { people: text };
  }
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = (await readExcelFile(file)) as unknown as { sheet: string; data: unknown[][] }[];
  const out: { people?: string; goals?: string } = {};
  for (const s of sheets) {
    const tsv = toTsv(s.data);
    if (!tsv) continue;
    if (/goal/i.test(s.sheet) || isGoals(tsv)) out.goals ??= tsv;
    else out.people ??= tsv;
  }
  return out;
}

/** The set-up template: a People sheet and a Goals sheet, each with example rows, ready for saveFile (app/files). */
export function templateSheets(): SheetOut[] {
  const sheet = (tsv: string, name: string): SheetOut => {
    const [head, ...rows] = parseTable(tsv);
    return { name, rows: [head ?? [], ...rows.map((r) => r.map((c) => (c === '' ? null : /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c)))] };
  };
  return [sheet(PEOPLE_TEMPLATE, 'People'), sheet(GOALS_TEMPLATE, 'Goals')];
}

/** Reads a workbook or CSV of changes: its Goals, Plan and Check-ins sheets, by name or by header. */
export async function readChanges(file: File): Promise<{ tables: import('../domain/changeset').Tables; sheets: string[] }> {
  const { records, sheetKind } = await import('../domain/changeset');
  const tables: import('../domain/changeset').Tables = {};
  const sheets: string[] = [];
  const add = (name: string, tsv: string) => {
    const k = sheetKind(name, tsv);
    if (!k || tables[k]) return;
    tables[k] = records(tsv);
    sheets.push(name);
  };
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const text = await file.text();
    const tsv = parseTable(text.replace(/^﻿/, '')).map((r) => r.join('\t')).join('\n');
    add(file.name, tsv);
    return { tables, sheets };
  }
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const all = (await readExcelFile(file)) as unknown as { sheet: string; data: unknown[][] }[];
  for (const s of all) {
    const tsv = toTsv(s.data);
    if (tsv) add(s.sheet, tsv);
  }
  return { tables, sheets };
}
