/* The feature modules' records in this build (AS part 2; domain/records): what each module's records.ts declares, read
   through the registry the build makes (vite.modules.ts), so the core never imports a module. Plain TypeScript with no
   screens: the app, the MCP server, the stores and the spec all read it. A module left out of the build
   (FARO_WITHOUT) declares nothing here, so its rows are neither read nor written, and none are deleted. */
import PARTS from 'virtual:faro-modules/records';
import type { ModuleRecords, ModuleSheet } from '../domain/records';
import { addColumnParams } from '../domain/query';

/** Every module's records, in module id order. */
export const MODULE_RECORDS: readonly ModuleRecords[] = PARTS.map((p) => ({ ...p.part, module: p.id }));

/** The columns the modules add to Goals' rows (?metric=), read from an address on the server as in the app. */
export const MODULE_GOAL_COLUMNS = MODULE_RECORDS.flatMap((m) => m.goalColumns ?? []);
addColumnParams(MODULE_GOAL_COLUMNS.map((c) => c.param));

/** The workbook's sheets the modules add (domain/export), in module id order. */
export const MODULE_SHEETS: readonly ModuleSheet[] = MODULE_RECORDS.flatMap((m) => m.sheets ?? []);

/** The records of the modules switched on in a workspace: what Recently removed lists and restores. A module that's off
    keeps its rows untouched, and none of them is offered back until it is on again. */
export const recordsOn = (ws: { modulesOff?: readonly string[] } | null | undefined): readonly ModuleRecords[] =>
  MODULE_RECORDS.filter((m) => !(ws?.modulesOff ?? []).includes(m.module));
