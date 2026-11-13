/* The feature modules' records in this build (AS part 2; domain/records): what each module's records.ts declares, read
   through the registry the build makes (vite.modules.ts), so the core never imports a module. Plain TypeScript with no
   screens: the app, the MCP server, the stores and the spec all read it. A module left out of the build
   (FARO_WITHOUT) declares nothing here, so its rows are neither read nor written, and none are deleted. */
import PARTS from 'virtual:faro-modules/records';
import type { ModuleRecords, ModuleSheet, SheetReader } from '../domain/records';
import type { ReadableSheet } from '../domain/sheets';

/** Every module's records, in module id order. */
export const MODULE_RECORDS: readonly ModuleRecords[] = PARTS.map((p) => ({ ...p.part, module: p.id }));

/** The columns the modules add to Goals' rows (?metric=): the app's filters (core/app) and the AI's find_goals read them. */
export const MODULE_GOAL_COLUMNS = MODULE_RECORDS.flatMap((m) => m.goalColumns ?? []);

/** The workbook's sheets the modules add (domain/export), in module id order: every module in this build. */
export const MODULE_SHEETS: readonly ModuleSheet[] = MODULE_RECORDS.flatMap((m) => m.sheets ?? []);

/** The records of the modules switched on in a workspace: what Recently removed lists and restores. A module that's off
    keeps its rows untouched, and none of them is offered back until it is on again. */
export const recordsOn = (ws: { modulesOff?: readonly string[] } | null | undefined): readonly ModuleRecords[] =>
  MODULE_RECORDS.filter((m) => !(ws?.modulesOff ?? []).includes(m.module));

/** The workbook's sheets of the modules switched on in a workspace (fix item F2): a module that's off adds no sheet to
    any export (the Export sheet, Data's downloads, the MCP export tool), as it adds nothing else. */
export const sheetsOn = (ws: { modulesOff?: readonly string[] } | null | undefined): readonly ModuleSheet[] =>
  recordsOn(ws).flatMap((m) => m.sheets ?? []);

/** Every module sheet as the import reads it (domain/sheets readTables): a sheet whose module is switched off in the
    workspace is known by its header and skipped, with that module's name, so the file line says so once (MI). */
export const sheetsToRead = (ws: { modulesOff?: readonly string[] } | null | undefined, name: (module: string) => string = (m) => m): ReadableSheet[] =>
  MODULE_RECORDS.flatMap((m) => (m.sheets ?? []).map((s) => ({
    name: s.spec.name, columns: s.spec.columns, loaded: !!s.spec.loaded && !!s.reader, ...(s.also ? { also: s.also } : {}), ...(s.is ? { is: s.is } : {}),
    ...((ws?.modulesOff ?? []).includes(m.module) ? { off: name(m.module) } : {}),
  })));

/* Module sheets' readers load with the import, not the first download: the import, bulk_change and the import's worker
   await them before the change engine runs, and the engine reads them, by sheet name, from what has loaded. */
const readers = new Map<string, SheetReader>();
/** The readers loaded so far, by sheet name: what the engine is given (domain/changeset ChangeInput `readers`). */
export const readersNow = (): Record<string, SheetReader> => Object.fromEntries(readers);
/** Loads the readers of these sheets (every module sheet in this build, unless given), once each. */
export async function loadSheetReaders(sheets: readonly ModuleSheet[] = MODULE_SHEETS): Promise<Record<string, SheetReader>> {
  await Promise.all(sheets.filter((s) => s.reader && !readers.has(s.spec.name)).map(async (s) => { readers.set(s.spec.name, await s.reader!()); }));
  return Object.fromEntries(sheets.filter((s) => readers.has(s.spec.name)).map((s) => [s.spec.name, readers.get(s.spec.name)!]));
}
