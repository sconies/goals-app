/* The feature modules' records in this build (AS part 2; domain/records): what each module's records.ts declares, read
   through the registry the build makes (vite.modules.ts), so the core never imports a module. Plain TypeScript with no
   screens: the app, the MCP server, the stores and the spec all read it. A module left out of the build
   (FARO_WITHOUT) declares nothing here, so its rows are neither read nor written, and none are deleted. */
import PARTS from 'virtual:faro-modules/records';
import type { ModuleRecords, ModuleSheet } from '../domain/records';

/** Every module's records, in module id order. */
export const MODULE_RECORDS: readonly ModuleRecords[] = PARTS.map((p) => ({ ...p.part, module: p.id }));

/** The workbook's sheets the modules add (domain/export), in module id order. */
export const MODULE_SHEETS: readonly ModuleSheet[] = MODULE_RECORDS.flatMap((m) => m.sheets ?? []);
