/* Reading spreadsheets in (release 3): one reader for every way a table arrives. A CSV, a tab-separated paste, a
   workbook's sheets and a zip of CSVs all become named grids of text, read in one pass (RFC 4180: quoted cells, quotes
   doubled inside them, line breaks inside a cell, a byte-order mark), and each grid is recognised by its header row,
   never its name (domain/columns sheetKindOf). The apostrophe the export puts before a cell that would otherwise run as
   a formula (=, +, -, @) is taken off again here, so a file loaded back says exactly what was exported. */
import { andList, fieldTable, FILL_SHEETS, headersOf, isWeekHeader, sheetKindOf, START_HERE, type FillKind, type SheetKind } from './columns';
import { fold, near } from './problemLevels';

export type Grid = string[][];
/** A sheet as read: its name (for messages) and its rows of text. */
export interface NamedGrid { name: string; rows: Grid }

/** A row as a header → value map (lower-case headers), with its row number in the sheet. */
export type Rec = Record<string, string> & { __row?: string };
export interface Tables { goals?: Rec[]; plan?: Rec[]; checkIns?: Rec[]; people?: Rec[] }

/** The separator a delimited text uses, judged on its first ten lines (a title row above the headers says nothing): the
    one the line with the most separators has most of, a tab first (a paste from a spreadsheet), then a comma, then a
    semicolon (CSV saved where the comma is the decimal mark). A comma when no line has any. */
function separatorOf(t: string): ',' | '\t' | ';' {
  let quoted = false, lines = 0;
  let line = { '\t': 0, ',': 0, ';': 0 }, best = line;
  const most = (x: typeof line) => Math.max(x['\t'], x[','], x[';']);
  const endLine = () => { if (most(line) > most(best)) best = line; line = { '\t': 0, ',': 0, ';': 0 }; };
  for (const ch of t) {
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch === '\t' || ch === ',' || ch === ';') line[ch]++;
    else if (ch === '\n') { endLine(); if (++lines >= 10) break; }
  }
  endLine();
  const m = most(best);
  return !m ? ',' : best['\t'] === m ? '\t' : best[','] === m ? ',' : ';';
}

/** The formula guard an export adds (domain/export toCsv), taken off: "'=SUM" is "=SUM" again. */
export const unguard = (c: string) => (/^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c);

/**
 * CSV or tab-separated text as rows, in one pass. Quoted cells keep their commas, doubled quotes and line breaks; a
 * quote inside an unquoted cell is just a character. Blank lines are dropped, unless `keepBlank`: a file being imported
 * keeps them (as empty rows) so every row keeps its number in the file; blank lines at the end go either way. Cells
 * keep their inner spacing (the engine trims what it compares).
 */
export function parseDelimited(text: string, opts: { sep?: ',' | '\t' | ';'; keepBlank?: boolean } = {}): Grid {
  const t = text.replace(/^\uFEFF/, '');
  if (!t.trim()) return [];
  const s = opts.sep ?? separatorOf(t);
  const rows: Grid = [];
  let row: string[] = [], cell = '', quoted = false, wasQuoted = false;
  const endCell = () => { row.push(unguard(wasQuoted ? cell : cell.trim())); cell = ''; wasQuoted = false; };
  const endRow = () => { endCell(); if (opts.keepBlank || !isBlank(row)) rows.push(row); row = []; };
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
  return dropTrailingBlank(rows);
}

/** A row with nothing in it. */
export const isBlank = (r: readonly string[]) => !r.some((c) => c.trim() !== '');
const dropTrailingBlank = (g: Grid): Grid => { let n = g.length; while (n && isBlank(g[n - 1]!)) n--; return n === g.length ? g : g.slice(0, n); };

/** A workbook cell as text, line breaks kept: a date as yyyy-mm-dd, a number as written. */
export function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).replace(/\r\n?/g, '\n');
}
/** A workbook's sheet as a grid of text. An empty row in the middle stays (as an empty row), so every row keeps its number
    in the sheet; empty rows at the end go. */
export const gridOf = (data: readonly (readonly unknown[])[]): Grid => dropTrailingBlank(data.map((r) => r.map(cellText)));

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
  /** Sheets whose header row isn't row 1 (rule 3): the rows above it were skipped. */
  headerRows: { sheet: string; row: number }[];
  /** The first sheet's first five headers when nothing was read: Import says what it found. */
  firstHeaders: string[];
  /** Rows in the file's loaded sheets, for Import's size limit. */
  rowCount: number;
}

/** Headers the change engine reads besides each sheet's own columns. */
const ALSO_READ: Partial<Record<SheetKind, string[]>> = { goals: ['reason', 'reason for change', 'owner id'], plan: ['reason', 'reason for change'], checkIns: ['reason'], people: [] };
/** Whether a sheet of a kind reads a header. */
export const readsHeader = (kind: SheetKind, header: string): boolean => {
  const h = header.trim().toLowerCase();
  return !h || headersOf(kind).some((x) => x.toLowerCase() === h) || (ALSO_READ[kind] ?? []).includes(h) || (kind === 'plan' && isWeekHeader(h));
};

/* ---------- rule 3: the header row (backlog IM5, C17) ---------- */

/** How a header cell was read: as written, by another name the field table gives it, one letter out, or not at all. */
export type HeaderHow = 'exact' | 'also' | 'near' | 'unknown';
const ALL_KINDS: SheetKind[] = ['goals', 'plan', 'checkIns', 'people', 'results', 'asks', 'notes'];

/** Every name a sheet of a kind reads a column by, folded: its headers, the engine's extra ones, and the field table's `also`. */
function namesOf(kind: SheetKind): Map<string, string> {
  const out = new Map<string, string>();
  for (const h of headersOf(kind)) out.set(fold(h), h);
  for (const h of ALSO_READ[kind] ?? []) out.set(fold(h), h);
  if ((FILL_SHEETS as SheetKind[]).includes(kind)) for (const row of fieldTable(kind as FillKind)) for (const a of row.also ?? []) if (!out.has(fold(a))) out.set(fold(a), row.header);
  return out;
}
const NAMES = new Map(ALL_KINDS.map((k) => [k, namesOf(k)]));
const alsoOf = (kind: SheetKind, header: string) => (NAMES.get(kind)!.has(fold(header)) && fold(NAMES.get(kind)!.get(fold(header))!) !== fold(header));

/**
 * How a sheet of a kind reads one header: `exact` (its own, any case, or a plan's "Week N"), `also` (another name the
 * field table gives the column: "Goal name" is Goal), `near` (one letter out of exactly one of them: "Targett" is
 * Target, asked about), or `unknown`. `as` is the column it is read as.
 */
export function headerMatch(kind: SheetKind, header: string): { how: HeaderHow; as: string | null } {
  const h = header.trim();
  if (!h) return { how: 'unknown', as: null };
  if (kind === 'plan' && isWeekHeader(h.toLowerCase())) return { how: 'exact', as: h };
  const names = NAMES.get(kind)!;
  const at = names.get(fold(h));
  if (at) return alsoOf(kind, h) ? { how: 'also', as: at } : { how: 'exact', as: at };
  const m = near(h, [...names.keys()]);
  if ('near' in m) return { how: 'near', as: names.get(m.near)! };
  return { how: 'unknown', as: null };
}

/** A header cell any sheet reads, as that sheet's column name ("Goal name" → Goal); null when no sheet reads it. */
const anyName = (cell: string): string | null => {
  const f = fold(cell);
  if (!f) return null;
  if (isWeekHeader(cell.trim().toLowerCase())) return cell.trim();
  for (const k of ALL_KINDS) { const at = NAMES.get(k)!.get(f); if (at) return at; }
  return null;
};

/**
 * The sheet a header row is, judged with each kind's own names (#199 review): a People sheet's "Title" is a job title,
 * not Goals' other name for Goal. The first kind whose names make it that kind; else, as any sheet reads the cells.
 */
function kindByOwnNames(head: readonly string[]): SheetKind | null {
  for (const k of ALL_KINDS) {
    const names = NAMES.get(k)!;
    if (sheetKindOf(head.map((c) => names.get(fold(c)) ?? c)) === k) return k;
  }
  return sheetKindOf(head.map((c) => anyName(c) ?? c));
}

/**
 * Rule 3. A sheet's header row: of its first ten rows, the one with the most cells that some sheet reads (as written,
 * or by another name), at least two. A title row above the headers ("Platform goals FY27") is skipped. Gives the row
 * (from 1), each column as read, and the sheet it is (domain/columns sheetKindOf on the names it was read as). No row
 * with two known headers: row 1, and no kind.
 */
export function readHeader(grid: Grid): { row: number; kind: SheetKind | null; columns: { index: number; header: string; as: string | null; how: HeaderHow }[] } {
  let best = -1, score = 1;
  grid.slice(0, 10).forEach((r, i) => { const n = r.filter((c) => anyName(c) != null).length; if (n > score) { best = i; score = n; } });
  const at = best < 0 ? Math.max(0, grid.findIndex((r) => !isBlank(r))) : best;
  const head = grid[at] ?? [];
  const kind = best < 0 ? sheetKindOf(head) : kindByOwnNames(head);
  return {
    row: at + 1, kind,
    columns: head.map((header, index) => ({ index, header: header.trim(), ...(kind ? headerMatch(kind, header) : { how: 'unknown' as const, as: null }) })),
  };
}

/** A Start here (or README) sheet's "File of" row, as written by the export. */
function originOf(rows: Grid): FileOrigin | null {
  const at = rows.find((r) => (r[0] ?? '').trim().toLowerCase() === 'file of');
  if (!at || !(at[1] ?? '').trim()) return null;
  const name = /^(.+), [^,]+\. (Exported|Template made) /.exec(rows[0]?.[0] ?? '')?.[1] ?? null;
  return { workspaceId: at[1]!.trim(), workspaceName: name, cycleId: (at[2] ?? '').trim() || null };
}

/** Named grids (a workbook's sheets, a zip's files, one CSV) as the tables the engine reads, each by its header. */
export function readTables(grids: NamedGrid[], moduleSheets: readonly { name: string; columns: readonly { header: string }[] }[] = []): ReadTables {
  const out: ReadTables = { tables: {}, read: [], skipped: [], unknownColumns: [], headers: {}, origin: null, headerRows: [], firstHeaders: [], rowCount: 0 };
  // A module's own sheet (Metrics), known by its header: the same columns the export writes, in any order.
  const ownSheet = (head: readonly string[]) => {
    const h = new Set(head.map((x) => x.trim().toLowerCase()).filter(Boolean));
    return moduleSheets.find((m) => m.columns.length && m.columns.every((c) => h.has(c.header.toLowerCase())));
  };
  for (const g of grids) {
    const first = g.rows.find((r) => !isBlank(r));
    if (!first) continue;
    const bare = g.name.replace(/\.(csv|tsv|txt)$/i, '').trim().toLowerCase();
    if (bare === START_HERE.toLowerCase() || bare === 'readme') { out.origin ??= originOf(g.rows); out.skipped.push({ name: g.name, why: 'start-here' }); continue; }
    if (ownSheet(first)) { out.skipped.push({ name: g.name, why: 'reading-only' }); continue; }
    const head = readHeader(g.rows);
    const kind = head.kind;
    const key = kind ? LOADED[kind] : undefined;
    if (!kind) { out.skipped.push({ name: g.name, why: 'not-faro' }); if (!out.firstHeaders.length) out.firstHeaders = first.map((h) => h.trim()).filter(Boolean).slice(0, 5); }
    else if (!key) out.skipped.push({ name: g.name, why: 'reading-only' });
    else if (out.tables[key]) out.skipped.push({ name: g.name, why: 'second' });
    else {
      out.rowCount += g.rows.slice(head.row).filter((r) => !isBlank(r)).length;
      // Rows above the header row (a title) are skipped and said; rows keep their number in the sheet.
      const rows = g.rows.slice(head.row - 1);
      // A header one letter out keeps its own spelling, so the question says it as the file does ("Targett").
      const asWritten = new Map(head.columns.filter((c) => c.how === 'near').map((c) => [c.header.toLowerCase(), c.header]));
      out.tables[key] = recordsOf(rows).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [asWritten.get(k) ?? k, k === '__row' ? String(Number(v) + head.row - 1) : v])) as Rec);
      out.read.push({ name: g.name, kind });
      // Said only when something was skipped: blank rows above the headers are nothing.
      if (g.rows.slice(0, head.row - 1).some((r) => !isBlank(r))) out.headerRows.push({ sheet: g.name, row: head.row });
      out.headers[key] = rows[0]!.map((h) => h.trim());
      // A header one letter out is asked about by the engine (near-header), so it isn't listed as not read.
      const unknown = head.columns.filter((c) => c.header && c.how === 'unknown' && !readsHeader(kind, c.header)).map((c) => c.header);
      if (unknown.length) out.unknownColumns.push({ sheet: g.name, headers: unknown });
    }
  }
  return out;
}

/** Rule 3, said on the preview's file line: "Row 3 of Goals is the header row; 2 rows above it were skipped." */
export const headerRowsLine = (read: Pick<ReadTables, 'headerRows'>): string =>
  read.headerRows.map((h) => `Row ${h.row} of ${h.sheet} is the header row; ${h.row - 1} ${h.row === 2 ? 'row' : 'rows'} above it ${h.row === 2 ? 'was' : 'were'} skipped.`).join(' ');

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
