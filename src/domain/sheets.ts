/* Reading spreadsheets in (release 3): one reader for every way a table arrives. A CSV, a tab-separated paste, a
   workbook's sheets and a zip of CSVs all become named grids of text, read in one pass (RFC 4180: quoted cells, quotes
   doubled inside them, line breaks inside a cell, a byte-order mark), and each grid is recognised by its header row,
   never its name (domain/columns sheetKindOf). The apostrophe the export puts before a cell that would otherwise run as
   a formula (=, +, -, @) is taken off again here, so a file loaded back says exactly what was exported. */
import { sheetKindOf, type SheetKind } from './columns';

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

export interface ReadTables {
  tables: Tables;
  /** The sheets loaded, by the name they had. */
  read: { name: string; kind: SheetKind }[];
  /** Sheets left out, and why: one this format writes but doesn't load back (Results, Asks, Notes), one it doesn't know. */
  skipped: { name: string; why: string }[];
}

/** Named grids (a workbook's sheets, a zip's files, one CSV) as the tables the engine reads, each by its header. */
export function readTables(grids: NamedGrid[]): ReadTables {
  const out: ReadTables = { tables: {}, read: [], skipped: [] };
  for (const g of grids) {
    if (!g.rows.length) continue;
    const kind = sheetKindOf(g.rows[0]!);
    const key = kind ? LOADED[kind] : undefined;
    if (!kind) out.skipped.push({ name: g.name, why: 'not a sheet this app reads (its header row doesn’t match one)' });
    else if (!key) out.skipped.push({ name: g.name, why: 'written for reading; not loaded back' });
    else if (out.tables[key]) out.skipped.push({ name: g.name, why: `a second ${kind === 'checkIns' ? 'Check-ins' : kind} sheet; only the first is read` });
    else { out.tables[key] = recordsOf(g.rows); out.read.push({ name: g.name, kind }); }
  }
  return out;
}
