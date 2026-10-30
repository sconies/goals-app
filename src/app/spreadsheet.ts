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
