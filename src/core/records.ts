/* The feature modules' records in this build (AS part 2; domain/records): what each module's records.ts declares, read
   through the registry the build makes (vite.modules.ts), so the core never imports a module. Plain TypeScript with no
   screens: the app, the MCP server, the stores and the spec all read it. A module left out of the build
   (FARO_WITHOUT) declares nothing here, so its rows are neither read nor written, and none are deleted. */
import PARTS from 'virtual:faro-modules/records';
import type { ModuleRecords, ModuleSheet } from '../domain/records';

/** Every module's records, in module id order. */
export const MODULE_RECORDS: readonly ModuleRecords[] = PARTS.map((p) => ({ ...p.part, module: p.id }));

/** The columns the modules add to Goals' rows (?metric=), each with its module: the app's filters (core/app) and the AI's
    find_goals read them, and both leave out a switched-off module's column. */
export const MODULE_GOAL_COLUMNS = MODULE_RECORDS.flatMap((m) => (m.goalColumns ?? []).map((c) => ({ ...c, module: m.module })));

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
