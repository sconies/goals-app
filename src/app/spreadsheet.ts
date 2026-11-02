/* Spreadsheets in and out. The libraries load only when someone uploads or downloads, so the app stays small. */
import { GOALS_TEMPLATE, parseTable, PEOPLE_TEMPLATE } from '../domain/importer';

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

/** Downloads a workbook with a People sheet and a Goals sheet, each with example rows. */
export async function downloadTemplate() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sheet = (tsv: string, name: string) => {
    const [head, ...rows] = parseTable(tsv);
    return {
      sheet: name,
      data: [
        (head ?? []).map((h) => ({ value: h, fontWeight: 'bold' as const })),
        ...rows.map((r) => r.map((c) => (c === '' ? null : { value: /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c }))),
      ],
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (writeXlsxFile as any)([sheet(PEOPLE_TEMPLATE, 'People'), sheet(GOALS_TEMPLATE, 'Goals')]).toFile('goals-template.xlsx');
}

/** Downloads tables as one workbook, a sheet per table, with a bold header row. */
export async function downloadWorkbook(tables: { name: string; rows: (string | number | null)[][] }[], filename: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sheets = tables.map((t) => ({
    sheet: t.name.slice(0, 31),
    data: t.rows.map((r, i) => r.map((c) => (c == null || c === '' ? null : { value: c, ...(i === 0 && t.name !== 'README' ? { fontWeight: 'bold' as const } : {}) }))),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (writeXlsxFile as any)(sheets).toFile(filename);
}

/** Saves text as a file (CSV, JSON, Markdown). */
export function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
