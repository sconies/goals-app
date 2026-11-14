/* The import's file line (C19): a file's columns nothing reads, less a module's own columns on Goals (TG2, Fields'),
   which the change engine reads while the module is on. Here, with the import, so the first download doesn't carry it. */
import { goalSheetsOn } from '../../core/records';
import type { ModuleRows } from '../../domain/records';

/** A file's columns nothing reads, less those a module on here reads on Goals (Fields' columns): what the preview's
    file line names (C19). Called with the open workspace, since the columns are its own. */
export function unreadColumns(read: { read: readonly { name: string; kind: string }[]; unknownColumns: readonly { sheet: string; headers: string[] }[] }, ws: { modulesOff?: readonly string[] } | null | undefined, s: { modules?: ModuleRows }): { sheet: string; headers: string[] }[] {
  const goals = new Set(read.read.filter((x) => x.kind === 'goals').map((x) => x.name));
  const own = new Set(goalSheetsOn(ws).flatMap((m) => m.columns(s).map((c) => c.header.trim().toLowerCase())));
  return read.unknownColumns.map((u) => (goals.has(u.sheet) ? { ...u, headers: u.headers.filter((h) => !own.has(h.trim().toLowerCase())) } : u)).filter((u) => u.headers.length);
}
