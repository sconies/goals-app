/* Every file the app gives people to keep goes through saveFile: one naming rule, one way of saving, one way of saying
   it worked or didn't. The name is `<workspace>-<what>-<scope>-<date>`, for example
   `platform-engineering-goals-year-2026-2026-11-05.xlsx`; the scope is left out when there isn't one.
   The spreadsheet library loads only when someone saves a workbook, so the app stays small. */

/** A sheet of a workbook: its name and its rows, the first row being the header (set in bold), and the columns set apart
    in grey (worked out by the app, or there only so the table can be loaded back). */
export interface SheetOut { name: string; rows: (string | number | null)[][]; muted?: string[]; bold?: string[] }

export type FileContent =
  | { kind: 'csv'; text: string }
  | { kind: 'json'; text: string }
  | { kind: 'md'; text: string }
  | { kind: 'xlsx'; sheets: SheetOut[] }
  /** A zip of CSVs: the workbook's sheets, one file each, with the same headers. */
  | { kind: 'zip'; files: { name: string; text: string }[] }
  | { kind: 'png'; blob: Blob };

export interface FileName {
  /** The workspace's name, or what it will be called. */
  workspace: string;
  /** What the file holds: goals, check-ins, activity, template… */
  what: string;
  /** Which part of it: a cycle, a saved view, a filter. Empty for everything. */
  scope?: string;
  /** The day it was saved for (the app's today). */
  date: Date;
  /** A name made from a file the person chose ("{original}-rows-to-fix"): used as it is, made safe, with no date. */
  as?: string;
}

const EXT: Record<FileContent['kind'], string> = { csv: 'csv', json: 'json', md: 'md', xlsx: 'xlsx', zip: 'zip', png: 'png' };
const TYPE: Record<FileContent['kind'], string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  md: 'text/markdown;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  png: 'image/png',
};

/** Lower case, words joined by hyphens, nothing a file system could trip on. */
export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The one naming rule: `<workspace>-<what>-<scope>-<date>.<ext>`, each part made safe, empty parts left out. */
export function fileName(n: FileName, kind: FileContent['kind']): string {
  if (n.as) return `${n.as.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'rows'}.${EXT[kind]}`;
  const parts = [slug(n.workspace) || 'goals', slug(n.what), slug(n.scope ?? ''), n.date.toISOString().slice(0, 10)].filter(Boolean);
  return `${parts.join('-')}.${EXT[kind]}`;
}

/** Grey, for the columns a workbook sets apart. */
const MUTED = '#6b6f76';
const BOM = String.fromCharCode(0xfeff);

/**
 * Sheets as the workbook library takes them: the header in bold (or only the headers `bold` names), muted columns in grey, and a cell with line breaks
 * wrapped, so they show. Shared by saving and by the round-trip tests.
 */
export function excelSheets(sheets: SheetOut[]) {
  return sheets.map((t) => {
    const head = (t.rows[0] ?? []).map((c) => String(c ?? ''));
    const muted = new Set((t.muted ?? []).map((h) => head.indexOf(h)).filter((i) => i >= 0));
    return {
      sheet: t.name.slice(0, 31),
      data: t.rows.map((r, i) => r.map((c, k) => (c == null || c === '' ? null : {
        value: c,
        // The header row in bold; with `bold`, only those headers (the template's required columns). Start here (and the
        // README it replaced) opens with a line of text, not headers.
        ...(i === 0 && !['README', 'Start here'].includes(t.name) && (!t.bold || t.bold.includes(String(c))) ? { fontWeight: 'bold' as const } : {}),
        ...(muted.has(k) ? { textColor: MUTED } : {}),
        ...(typeof c === 'string' && /\n/.test(c) ? { wrap: true } : {}),
      }))),
    };
  });
}

/** A CSV's bytes, with a byte-order mark so Excel reads its accents and symbols as they are. */
export const csvBytes = (text: string) => new TextEncoder().encode(BOM + text);

async function blobOf(content: FileContent): Promise<Blob> {
  if (content.kind === 'png') return content.blob;
  if (content.kind === 'zip') {
    const { zipFiles } = await import('./zip');
    return new Blob([zipFiles(content.files.map((f) => ({ name: f.name, data: csvBytes(f.text) }))) as BlobPart], { type: TYPE.zip });
  }
  if (content.kind !== 'xlsx') {
    // A byte-order mark, so Excel reads a CSV's accents and symbols as they are.
    return new Blob([content.kind === 'csv' ? '﻿' + content.text : content.text], { type: TYPE[content.kind] });
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (writeXlsxFile as any)(excelSheets(content.sheets)).toBlob() as Promise<Blob>;
}

/** Saves a file to the person's device under the one naming rule, and returns the name it was saved as. Throws if it can't. */
export async function saveFile(name: FileName, content: FileContent): Promise<string> {
  const file = fileName(name, content.kind);
  const blob = await blobOf(content);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return file;
}

/** What a failed save says, the same everywhere. */
export const saveFailed = (e: unknown) => 'Couldn’t save the file: ' + (e instanceof Error ? e.message : String(e));

/**
 * Saves a file and says so: `done` once it's saved, or what went wrong. Returns whether it saved.
 * `toast` is the app's (or the set-up screen's) message line. `done` may be made from the file's name ("Exported {name}").
 */
export async function saveAndSay(toast: (text: string, tone?: 'error') => void, name: FileName, content: FileContent, done: string | ((file: string) => string)): Promise<boolean> {
  try {
    const file = await saveFile(name, content);
    toast(typeof done === 'string' ? done : done(file));
    return true;
  } catch (e) {
    toast(saveFailed(e), 'error');
    return false;
  }
}
