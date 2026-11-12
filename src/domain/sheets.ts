/* Reading spreadsheets in (release 3): one reader for every way a table arrives. A CSV, a tab-separated paste, a
   workbook's sheets and a zip of CSVs all become named grids of text, read in one pass (RFC 4180: quoted cells, quotes
   doubled inside them, line breaks inside a cell, a byte-order mark), and each grid is recognised by its header row,
   never its name (domain/columns sheetKindOf). The apostrophe the export puts before a cell that would otherwise run as
   a formula (=, +, -, @) is taken off again here, so a file loaded back says exactly what was exported. */
import { andList, headersOf, isWeekHeader, sheetKindOf, START_HERE, type SheetKind } from './columns';

export type Grid = string[][];
/** A sheet as read: its name (for messages) and its rows of text. */
export interface NamedGrid { name: string; rows: Grid }

/** A row as a header → value map (lower-case headers), with its row number in the sheet. */
export type Rec = Record<string, string> & { __row?: string };
export interface Tables { goals?: Rec[]; plan?: Rec[]; checkIns?: Rec[]; people?: Rec[] }

/** The separator a delimited text uses: a tab if its first line has one (a paste from a spreadsheet), else a comma,
    else a semicolon (CSV saved where the comma is the decimal mark). */
function separatorOf(t: string): ',' | '\t' | ';' {
  let quoted = false, comma = 0, semi = 0;
  for (const ch of t) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch === '\t') return '\t';
    else if (!quoted && ch === ',') comma++;
    else if (!quoted && ch === ';') semi++;
  }
  return comma || !semi ? ',' : ';';
}

/** The formula guard an export adds (domain/export toCsv), taken off: "'=SUM" is "=SUM" again. */
export const unguard = (c: string) => (/^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c);

/**
 * CSV or tab-separated text as rows, in one pass. Quoted cells keep their commas, doubled quotes and line breaks; a
 * quote inside an unquoted cell is just a character. Blank lines are dropped; cells keep their inner spacing (the
 * engine trims what it compares).
 */
export function parseDelimited(text: string, sep?: ',' | '\t' | ';'): Grid {
  const t = text.replace(/^﻿/, '');
  if (!t.trim()) return [];
  const s = sep ?? separatorOf(t);
  const rows: Grid = [];
  let row: string[] = [], cell = '', quoted = false, wasQuoted = false;
  const endCell = () => { row.push(unguard(wasQuoted ? cell : cell.trim())); cell = ''; wasQuoted = false; };
  const endRow = () => { endCell(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else if (ch === '\r') { cell += '\n'; if (t[i + 1] === '\n') i++; }
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '' && !wasQuoted) { quoted = true; wasQuoted = true; cell = ''; }
    else if (ch === s) endCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; endRow(); }
    else cell += ch;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

/** A workbook cell as text, line breaks kept: a date as yyyy-mm-dd, a number as written. */
export function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).replace(/\r\n?/g, '\n');
}
/** A workbook's sheet as a grid of text. Empty rows go. */
export const gridOf = (data: readonly (readonly unknown[])[]): Grid => data.map((r) => r.map(cellText)).filter((r) => r.some((c) => c.trim() !== ''));

/** A grid as records keyed by lower-case header, each with its row number in the sheet (the header is row 1). */
export function recordsOf(grid: Grid): Rec[] {
  const [head, ...body] = grid;
  const header = (head ?? []).map((h) => h.trim().toLowerCase());
  return body.map((r, i) => {
    const rec: Rec = { __row: String(i + 2) };
    header.forEach((h, k) => { if (h && !(h in rec)) rec[h] = (r[k] ?? '').trim(); });
    return rec;
  });
}
/** Delimited text straight to records. */
export const records = (text: string) => recordsOf(parseDelimited(text));

const LOADED: Partial<Record<SheetKind, keyof Tables>> = { goals: 'goals', plan: 'plan', checkIns: 'checkIns', people: 'people' };
/** The sheets a file loads back (the rest are written for reading): every column a person fills in on them is in the field table. */
export const LOADED_SHEETS = Object.keys(LOADED) as SheetKind[];

/** Why a sheet wasn't read (rule 5): one written for reading only, one that isn't a Faro sheet, a second of a kind, or
    the workbook's own Start here (or README) sheet, which says what the file is and is never a table. */
export type SkipWhy = 'reading-only' | 'not-faro' | 'second' | 'start-here';
/** Where a workbook came from: its Start here sheet's "File of" row (the workspace's and cycle's ids). */
export interface FileOrigin { workspaceId: string; workspaceName: string | null; cycleId: string | null }

export interface ReadTables {
  tables: Tables;
  /** The sheets loaded, by the name they had. */
  read: { name: string; kind: SheetKind }[];
  /** Sheets left out, and why. */
  skipped: { name: string; why: SkipWhy }[];
  /** Columns on a sheet that was read that nothing reads (C19): named in the file line, never dropped silently. */
  unknownColumns: { sheet: string; headers: string[] }[];
  /** Each table's headers as the file wrote them, in order: the rows-to-fix file writes them back. */
  headers: Partial<Record<keyof Tables, string[]>>;
  /** The Start here sheet's origin, when the file has one. */
  origin: FileOrigin | null;
}

/** Headers the change engine reads besides each sheet's own columns. */
const ALSO_READ: Partial<Record<SheetKind, string[]>> = { goals: ['reason', 'reason for change', 'owner id'], plan: ['reason', 'reason for change'], checkIns: ['reason'], people: [] };
/** Whether a sheet of a kind reads a header. */
export const readsHeader = (kind: SheetKind, header: string): boolean => {
  const h = header.trim().toLowerCase();
  return !h || headersOf(kind).some((x) => x.toLowerCase() === h) || (ALSO_READ[kind] ?? []).includes(h) || (kind === 'plan' && isWeekHeader(h));
};

/** A Start here (or README) sheet's "File of" row, as written by the export. */
function originOf(rows: Grid): FileOrigin | null {
  const at = rows.find((r) => (r[0] ?? '').trim().toLowerCase() === 'file of');
  if (!at || !(at[1] ?? '').trim()) return null;
  const name = /^(.+), [^,]+\. (Exported|Template made) /.exec(rows[0]?.[0] ?? '')?.[1] ?? null;
  return { workspaceId: at[1]!.trim(), workspaceName: name, cycleId: (at[2] ?? '').trim() || null };
}

/** Named grids (a workbook's sheets, a zip's files, one CSV) as the tables the engine reads, each by its header. */
export function readTables(grids: NamedGrid[], moduleSheets: readonly { name: string; columns: readonly { header: string }[] }[] = []): ReadTables {
  const out: ReadTables = { tables: {}, read: [], skipped: [], unknownColumns: [], headers: {}, origin: null };
  // A module's own sheet (Metrics), known by its header: the same columns the export writes, in any order.
  const ownSheet = (head: readonly string[]) => {
    const h = new Set(head.map((x) => x.trim().toLowerCase()).filter(Boolean));
    return moduleSheets.find((m) => m.columns.length && m.columns.every((c) => h.has(c.header.toLowerCase())));
  };
  for (const g of grids) {
    if (!g.rows.length) continue;
    const bare = g.name.replace(/\.(csv|tsv|txt)$/i, '').trim().toLowerCase();
    if (bare === START_HERE.toLowerCase() || bare === 'readme') { out.origin ??= originOf(g.rows); out.skipped.push({ name: g.name, why: 'start-here' }); continue; }
    if (ownSheet(g.rows[0]!)) { out.skipped.push({ name: g.name, why: 'reading-only' }); continue; }
    const kind = sheetKindOf(g.rows[0]!);
    const key = kind ? LOADED[kind] : undefined;
    if (!kind) out.skipped.push({ name: g.name, why: 'not-faro' });
    else if (!key) out.skipped.push({ name: g.name, why: 'reading-only' });
    else if (out.tables[key]) out.skipped.push({ name: g.name, why: 'second' });
    else {
      out.tables[key] = recordsOf(g.rows);
      out.read.push({ name: g.name, kind });
      out.headers[key] = g.rows[0]!.map((h) => h.trim());
      const unknown = g.rows[0]!.map((h) => h.trim()).filter((h) => h && !readsHeader(kind, h));
      if (unknown.length) out.unknownColumns.push({ sheet: g.name, headers: unknown });
    }
  }
  return out;
}

/**
 * Rule 5. What was read, in one sentence (the preview's file line, 2.3): "Read Goals and Check-ins. Not read: Results
 * (for reading only); Budget (not a Faro sheet); the column Notes on Goals." Parts with nothing are left out; the Start
 * here sheet is never mentioned. Then the example rows left out, when there are any.
 */
export function readLine(read: Pick<ReadTables, 'read' | 'skipped' | 'unknownColumns'>, examples = 0): string {
  const by = (why: SkipWhy) => read.skipped.filter((x) => x.why === why).map((x) => x.name);
  const not = [
    by('reading-only').length ? `${andList(by('reading-only'))} (for reading only)` : '',
    by('not-faro').length ? `${andList(by('not-faro'))} (not a Faro sheet)` : '',
    by('second').length ? `${andList(by('second'))} (a second sheet of the same kind; only the first is read)` : '',
    ...read.unknownColumns.map((u) => `the column${u.headers.length === 1 ? '' : 's'} ${andList(u.headers)} on ${u.sheet}`),
  ].filter(Boolean);
  const parts = [read.read.length ? `Read ${andList(read.read.map((x) => x.name))}.` : 'Nothing was read.', not.length ? `Not read: ${not.join('; ')}.` : '', examples ? `${examples} example row${examples === 1 ? '' : 's'} left out.` : ''];
  return parts.filter(Boolean).join(' ');
}
