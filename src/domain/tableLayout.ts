/* The data tables' layouts: which columns each table shows, in what order and how wide, with its search, filters and
   sort. A layout can be kept as a named table view (a saved view whose query starts with table=), opened again later,
   and the table exported exactly as it shows. The app's Data screen and the AI assistant's tools both use these. */
import { KEY_COLUMNS, type Cell, type SheetKind } from './columns';
import type { Table } from './export';
import { applyTable, filterEntries, parseFilters, parseSort, type PropFilter, type TableSort } from './tableFilter';

export type DataTable = 'goals' | 'checkIns' | 'plan' | 'requests' | 'people';

export interface TableSpec {
  /** The workbook sheet it shows. */
  sheet: string;
  label: string;
  /** The column that names each row: always first, and stays in view while scrolling across. */
  name: string;
  /** Columns that always show (besides the name). */
  always: string[];
  /** What it shows to start with; null for every column. */
  defaults: string[] | null;
  /** Never shown. */
  hidden: string[];
}

export const TABLES: Record<DataTable, TableSpec> = {
  // A row's Action (stop, delete, mark as left) is done where its consequences are shown in full: on the goal, on
  // Workspace, or from a spreadsheet's preview. The data tables leave those columns out.
  goals: {
    sheet: 'Goals', label: 'Goals', name: 'Goal', always: ['Key'], hidden: ['Action', 'Reason'],
    defaults: ['Key', 'Goal', 'Level', 'Team', 'Owner', 'Type', 'Unit', 'Start', 'Target', 'Status', 'Now', 'Gap', 'Last check-in week', 'Feeds into'],
  },
  checkIns: {
    sheet: 'Check-ins', label: 'Check-ins', name: 'Goal', always: ['ID'], hidden: [],
    defaults: ['ID', 'Goal key', 'Goal', 'Week', 'Value', 'Stages', 'Call', 'Calculated', 'Plan that week', 'Why', 'Recovery', 'Back on plan by week', 'Needs', 'Posted by'],
  },
  plan: { sheet: 'Plan', label: 'Plans', name: 'Goal', always: ['Key'], hidden: [], defaults: null },
  requests: {
    sheet: 'Asks', label: 'Asks', name: 'Ask', always: ['ID'], hidden: [],
    defaults: ['ID', 'Kind', 'Ask', 'Goals', 'Goal keys', 'Asked by', 'Asked of', 'Status', 'Due week', 'Asked at', 'Answer', 'Answered by'],
  },
  people: { sheet: 'People', label: 'People', name: 'Name', always: ['Email'], hidden: ['Action', 'Takes over', 'Team objective'], defaults: null },
};
/** The sheet of the one format each table is (domain/columns). */
export const KIND_OF: Record<DataTable, SheetKind> = { goals: 'goals', checkIns: 'checkIns', plan: 'plan', requests: 'asks', people: 'people' };
/** The tables, in the order the Data screen lists them. */
export const TABLE_ORDER: DataTable[] = ['goals', 'checkIns', 'plan', 'requests', 'people'];
export const isDataTable = (t: unknown): t is DataTable => typeof t === 'string' && t in TABLES;

/** How narrow a column can go, and how wide. The name column keeps room for a name; figures and keys need less. */
export const MAX_WIDTH = 640;
export function minWidth(table: DataTable, col: string): number {
  if (col === TABLES[table].name) return 120;
  if (/^(Week \d+|Week|Key|Goal key|Decimals|Q[1-4])$/.test(col)) return 56;
  return 72;
}
export const clampWidth = (table: DataTable, col: string, w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(minWidth(table, col), w)));

export interface TableLayout {
  table: DataTable;
  /** The columns shown, in order (the name column is always first, whatever this says). Null: the usual columns. */
  cols: string[] | null;
  /** Widths in pixels set by hand; the rest size themselves. */
  widths: Record<string, number>;
  q: string;
  filters: PropFilter[];
  sort: TableSort | null;
}
export const usualLayout = (table: DataTable): TableLayout => ({ table, cols: null, widths: {}, q: '', filters: [], sort: null });

/** The columns a table shows, in order: its name column, then the chosen columns (or the usual ones) that it has. */
export function visibleColumns(table: DataTable, head: readonly string[], cols: readonly string[] | null): string[] {
  const t = TABLES[table];
  const has = (c: string) => head.includes(c) && !t.hidden.includes(c) && c !== t.name;
  const always = t.always.filter(has);
  let rest: string[];
  if (cols) {
    rest = cols.filter(has);
    // A column that must show but isn't in the list goes where it sits in the sheet.
    for (const c of always) if (!rest.includes(c)) rest.splice(Math.min(rest.length, Math.max(0, head.indexOf(c) - 1)), 0, c);
  } else {
    const pick = t.defaults;
    rest = head.filter((c) => has(c) && (!pick || pick.includes(c) || always.includes(c)));
  }
  return [...(head.includes(t.name) ? [t.name] : []), ...new Set(rest)];
}

/** Every column a table can show, besides its name column. */
export const choosableColumns = (table: DataTable, head: readonly string[]) => head.filter((c) => !TABLES[table].hidden.includes(c) && c !== TABLES[table].name);

/** Moves a column to a new place among the shown ones (the name column stays first). */
export function moveColumn(order: readonly string[], col: string, to: number): string[] {
  const from = order.indexOf(col);
  if (from < 0) return [...order];
  const next = order.filter((c) => c !== col);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, col);
  return next;
}

/* ---------- a layout as a query string: table=goals&c=Goal&c=Owner&w=Goal~320&q=…&f=…&s=… ---------- */

export function layoutParams(l: TableLayout): string {
  const p = new URLSearchParams([['table', l.table]]);
  for (const c of l.cols ?? []) p.append('c', c);
  for (const [c, w] of Object.entries(l.widths)) p.append('w', `${c}~${Math.round(w)}`);
  if (l.q.trim()) p.append('q', l.q.trim());
  for (const [k, v] of filterEntries(l.filters, l.sort)) p.append(k, v);
  return p.toString();
}

export function parseLayout(params: string): TableLayout | null {
  const p = new URLSearchParams(params.replace(/^.*\?/, ''));
  const table = p.get('table');
  if (!isDataTable(table)) return null;
  const cols = p.getAll('c').filter(Boolean);
  const widths: Record<string, number> = {};
  for (const w of p.getAll('w')) {
    const i = w.lastIndexOf('~');
    const n = Number(w.slice(i + 1));
    if (i > 0 && Number.isFinite(n)) widths[w.slice(0, i)] = clampWidth(table, w.slice(0, i), n);
  }
  // The address names the sorted column in lower case: given back as the layout's own spelling where it names it.
  const filters = parseFilters(p), linked = parseSort(p);
  const named = linked ? [...cols, ...Object.keys(widths), ...filters.map((f) => f.col)].find((c) => c.toLowerCase() === linked.col.toLowerCase()) : undefined;
  return { table, cols: cols.length ? cols : null, widths, q: p.get('q') ?? '', filters, sort: linked ? { ...linked, col: named ?? linked.col } : null };
}

/** A saved view of a data table, rather than of the Goals screen. */
export const isTableView = (v: { params: string }) => /^table=/.test(v.params);

/** What's wrong with a layout, in words: an unknown table, or (given the table's columns) a column it doesn't have. */
export function layoutProblems(l: TableLayout | null, head?: readonly string[]): string[] {
  if (!l) return [`The table should be one of ${TABLE_ORDER.join(', ')}.`];
  const out: string[] = [];
  if (head) {
    const unknown = [...(l.cols ?? []), ...Object.keys(l.widths), ...l.filters.map((f) => f.col), ...(l.sort ? [l.sort.col] : [])].filter((c) => !head.some((h) => h.toLowerCase() === c.toLowerCase()));
    if (unknown.length) out.push(`The ${TABLES[l.table].label} table has no ${unknown.length === 1 ? 'column' : 'columns'} called ${[...new Set(unknown)].map((c) => `“${c}”`).join(', ')}.`);
  }
  if ((l.cols ?? []).length > 400) out.push('That’s more columns than any table has.');
  return out;
}

/**
 * The table as it shows: the visible columns in order, and the rows that pass the search and filters, sorted. Values
 * stay as they are (numbers as numbers), so a spreadsheet can work with them. Header row first.
 */
export function shownTable(sheet: Table, l: TableLayout, extra: readonly string[] = []): Cell[][] {
  const [head0, ...body] = sheet.rows;
  const head = (head0 ?? []).map((c) => (c == null ? '' : String(c)));
  const cols = [...visibleColumns(l.table, head, l.cols), ...extra].map((c) => head.indexOf(c));
  const rows = body.map((raw) => ({ raw, cells: raw.map((c) => (c == null ? '' : String(c))) }));
  const shown = applyTable(rows, head, l.q, l.filters, l.sort);
  return [cols.map((i) => head[i]!), ...shown.map((r) => cols.map((i) => r.raw[i] ?? null))];
}

/**
 * The table as it shows, for saving: its columns as the layout has them, then any column that says which record a row
 * is (a goal's key and ID, a person's email…) that the layout leaves out, at the end and set in grey, so the file loads
 * back onto the same records whatever was hidden.
 */
export function exportedTable(sheet: Table, l: TableLayout): Table {
  const head = (sheet.rows[0] ?? []).map((c) => String(c ?? ''));
  const shown = visibleColumns(l.table, head, l.cols);
  const keys = KEY_COLUMNS[KIND_OF[l.table]].filter((c) => head.includes(c) && !shown.includes(c));
  return { name: TABLES[l.table].label, rows: shownTable(sheet, l, keys), muted: keys };
}
