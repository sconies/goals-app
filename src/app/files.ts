/* Every file the app gives people to keep goes through saveFile: one naming rule, one way of saving, one way of saying
   it worked or didn't. The name is `<workspace>-<what>-<scope>-<date>`, for example
   `platform-engineering-goals-year-2026-2026-11-05.xlsx`; the scope is left out when there isn't one.
   The spreadsheet library loads only when someone saves a workbook, so the app stays small. */

/** A sheet of a workbook: its name and its rows, the first row being the header (set in bold). */
export interface SheetOut { name: string; rows: (string | number | null)[][] }

export type FileContent =
  | { kind: 'csv'; text: string }
  | { kind: 'json'; text: string }
  | { kind: 'md'; text: string }
  | { kind: 'xlsx'; sheets: SheetOut[] }
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
}

const EXT: Record<FileContent['kind'], string> = { csv: 'csv', json: 'json', md: 'md', xlsx: 'xlsx', png: 'png' };
const TYPE: Record<FileContent['kind'], string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  md: 'text/markdown;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
};

/** Lower case, words joined by hyphens, nothing a file system could trip on. */
export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The one naming rule: `<workspace>-<what>-<scope>-<date>.<ext>`, each part made safe, empty parts left out. */
export function fileName(n: FileName, kind: FileContent['kind']): string {
  const parts = [slug(n.workspace) || 'goals', slug(n.what), slug(n.scope ?? ''), n.date.toISOString().slice(0, 10)].filter(Boolean);
  return `${parts.join('-')}.${EXT[kind]}`;
}

async function blobOf(content: FileContent): Promise<Blob> {
  if (content.kind === 'png') return content.blob;
  if (content.kind !== 'xlsx') {
    // A byte-order mark, so Excel reads a CSV's accents and symbols as they are.
    return new Blob([content.kind === 'csv' ? '﻿' + content.text : content.text], { type: TYPE[content.kind] });
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sheets = content.sheets.map((t) => ({
    sheet: t.name.slice(0, 31),
    data: t.rows.map((r, i) => r.map((c) => (c == null || c === '' ? null : { value: c, ...(i === 0 && t.name !== 'README' ? { fontWeight: 'bold' as const } : {}) }))),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (writeXlsxFile as any)(sheets).toBlob() as Promise<Blob>;
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
 * `toast` is the app's (or the set-up screen's) message line.
 */
export async function saveAndSay(toast: (text: string, tone?: 'error') => void, name: FileName, content: FileContent, done: string): Promise<boolean> {
  try {
    await saveFile(name, content);
    toast(done);
    return true;
  } catch (e) {
    toast(saveFailed(e), 'error');
    return false;
  }
}
