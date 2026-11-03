/* Property filters for a table of records: pick a column, a condition and a value; every filter must match.
   The kind of column (number, a fixed set of values, or free text) decides which conditions make sense.
   Filters and the sort live in the link, so a filtered table can be shared. */

export type ColumnKind = 'number' | 'choice' | 'text';
export type Op = 'is' | 'isNot' | 'contains' | 'notContains' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'notEmpty';
export interface PropFilter { col: string; op: Op; value: string }
export interface TableSort { col: string; dir: 1 | -1 }

export const OP_LABEL: Record<Op, string> = {
  is: 'is any of', isNot: 'is none of', contains: 'contains', notContains: 'doesn’t contain', eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', empty: 'is empty', notEmpty: 'is not empty',
};
export const OPS: Record<ColumnKind, Op[]> = {
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty'],
  choice: ['is', 'isNot', 'empty', 'notEmpty'],
  text: ['contains', 'notContains', 'is', 'empty', 'notEmpty'],
};
/** Conditions that need no value. */
export const NO_VALUE: Op[] = ['empty', 'notEmpty'];
/** "is any of" and "is none of" take several values, kept as one string separated by this. */
export const SEP = '|';

const isNum = (v: string) => v.trim() !== '' && !isNaN(Number(v));

/** What kind of column this is, from its values: all numbers; a handful of distinct values; or free text. */
export function columnKind(values: string[]): ColumnKind {
  const filled = values.filter((v) => v.trim() !== '');
  if (filled.length && filled.every(isNum)) return 'number';
  const distinct = new Set(filled);
  return distinct.size > 0 && distinct.size <= 24 && distinct.size < Math.max(4, filled.length * 0.6) && [...distinct].every((v) => v.length <= 40) ? 'choice' : 'text';
}

/** Does one cell value pass the filter? */
export function passes(cell: string, f: PropFilter): boolean {
  const v = cell.trim();
  const want = f.value.trim();
  switch (f.op) {
    case 'empty': return v === '';
    case 'notEmpty': return v !== '';
    case 'is': return want.split(SEP).some((w) => w.toLowerCase() === v.toLowerCase());
    case 'isNot': return !want.split(SEP).some((w) => w.toLowerCase() === v.toLowerCase());
    case 'contains': return v.toLowerCase().includes(want.toLowerCase());
    case 'notContains': return !v.toLowerCase().includes(want.toLowerCase());
    default: {
      if (!isNum(v) || !isNum(want)) return false;
      const a = Number(v), b = Number(want);
      return f.op === 'eq' ? a === b : f.op === 'ne' ? a !== b : f.op === 'gt' ? a > b : f.op === 'gte' ? a >= b : f.op === 'lt' ? a < b : a <= b;
    }
  }
}

/** Rows (as header → value) that pass every filter and contain every search word, sorted. */
export function applyTable<R extends { cells: string[] }>(rows: R[], head: string[], q: string, filters: PropFilter[], sort: TableSort | null): R[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const idx = (c: string) => head.indexOf(c);
  const live = filters.filter((f) => idx(f.col) >= 0 && (NO_VALUE.includes(f.op) || f.value.trim() !== ''));
  const out = rows.filter((r) => words.every((w) => r.cells.some((c) => c.toLowerCase().includes(w))) && live.every((f) => passes(r.cells[idx(f.col)] ?? '', f)));
  const si = sort ? idx(sort.col) : -1;
  if (sort && si >= 0) {
    out.sort((a, b) => {
      const x = a.cells[si] ?? '', y = b.cells[si] ?? '';
      // Empty cells last, whichever way it's sorted.
      if (!x.trim() || !y.trim()) return (x.trim() ? 0 : 1) - (y.trim() ? 0 : 1);
      return (isNum(x) && isNum(y) ? Number(x) - Number(y) : x.localeCompare(y, undefined, { numeric: true })) * sort.dir;
    });
  }
  return out;
}

/** "Owner is any of Maya Chen or Sam Patel", "Week ≥ 40". */
export function describeFilter(f: PropFilter): string {
  if (NO_VALUE.includes(f.op)) return `${f.col} ${OP_LABEL[f.op]}`;
  if (f.op === 'is' || f.op === 'isNot') {
    const vs = f.value.split(SEP).filter(Boolean);
    return `${f.col} ${vs.length === 1 ? (f.op === 'is' ? 'is' : 'is not') : OP_LABEL[f.op]} ${vs.join(' or ')}`;
  }
  return `${f.col} ${OP_LABEL[f.op]} ${f.op === 'contains' || f.op === 'notContains' ? `“${f.value}”` : f.value}`;
}

/* ---------- in the link: f=Column~op~value (repeated), s=Column~asc|desc ---------- */

export function parseFilters(p: URLSearchParams): PropFilter[] {
  return p.getAll('f').map((x) => {
    const [col = '', op = '', ...rest] = x.split('~');
    return { col, op: op as Op, value: rest.join('~') };
  }).filter((f) => f.col && f.op in OP_LABEL);
}
export function parseSort(p: URLSearchParams): TableSort | null {
  const v = p.get('s');
  if (!v) return null;
  const i = v.lastIndexOf('~');
  return i > 0 ? { col: v.slice(0, i), dir: v.slice(i + 1) === 'desc' ? -1 : 1 } : null;
}
export function filterEntries(filters: PropFilter[], sort: TableSort | null): [string, string][] {
  return [...filters.map((f): [string, string] => ['f', `${f.col}~${f.op}~${f.value}`]), ...(sort ? [['s', `${sort.col}~${sort.dir === 1 ? 'asc' : 'desc'}`] as [string, string]] : [])];
}
