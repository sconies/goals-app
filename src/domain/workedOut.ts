/* Worked-out cells a file edited (backlog IM3; docs/design/import/spec.md rule 9, C19). Status, Now, Gap and the other
   worked-out columns are written by Faro and never read back. A file that changes one changes nothing, and the preview
   says so: "On 2 rows, Status differs from what Faro works out today. Faro never reads those columns: to change where a
   goal stands, post a check-in." Pure: no screen, network or database code. */
import { isWorkedOut, KEY_COLUMNS, type SheetKind } from './columns';
import type { Table } from './export';
import type { Tables } from './sheets';

const KIND: Record<keyof Tables, SheetKind> = { goals: 'goals', plan: 'plan', checkIns: 'checkIns', people: 'people' };
const norm = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
/** The same cell as written: equal text, or equal numbers once grouping commas are taken off. */
const sameCell = (a: unknown, b: unknown) => {
  if (norm(a) === norm(b)) return true;
  const x = Number(norm(a).replace(/,/g, '')), y = Number(norm(b).replace(/,/g, ''));
  return norm(a) !== '' && norm(b) !== '' && Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
};

export interface WorkedOutEdits { sheet: string; columns: string[]; rows: number[] }

/**
 * Rule 9. For each row that matches a record by its key columns, the worked-out columns whose cell differs from what an
 * export would write today (`book`, the workbook as Faro writes it now). Sheets with none are left out.
 */
export function workedOutEdits(tables: Tables, book: readonly Table[], names: Partial<Record<keyof Tables, string>> = {}): WorkedOutEdits[] {
  const out: WorkedOutEdits[] = [];
  for (const key of Object.keys(KIND) as (keyof Tables)[]) {
    const rows = tables[key];
    const kind = KIND[key];
    const sheet = book.find((t) => t.name.toLowerCase() === (names[key] ?? '').toLowerCase()) ?? book.find((t) => norm(t.name) === norm(kind === 'checkIns' ? 'Check-ins' : kind));
    if (!rows?.length || !sheet) continue;
    const head = (sheet.rows[0] ?? []).map((h) => String(h ?? ''));
    const keyCols = KEY_COLUMNS[kind].filter((k) => head.includes(k)).slice(0, kind === 'checkIns' ? 1 : 2);
    const worked = head.filter((h) => isWorkedOut(kind, h));
    if (!keyCols.length || !worked.length) continue;
    const index = new Map<string, (typeof sheet.rows)[number]>();
    for (const r of sheet.rows.slice(1)) for (const k of keyCols) { const v = norm(r[head.indexOf(k)]); if (v) index.set(`${k}:${v}`, r); }
    const columns = new Set<string>();
    const changed = new Set<number>();
    rows.forEach((r, i) => {
      const written = keyCols.map((k) => index.get(`${k}:${norm(r[k.toLowerCase()])}`)).find(Boolean);
      if (!written) return;
      for (const h of worked) {
        const lower = h.toLowerCase();
        if (!(lower in r)) continue;
        if (!sameCell(r[lower], written[head.indexOf(h)])) { columns.add(h); changed.add(Number(r.__row ?? i + 2)); }
      }
    });
    if (changed.size) out.push({ sheet: names[key] ?? sheet.name, columns: [...columns], rows: [...changed].sort((a, b) => a - b) });
  }
  return out;
}
