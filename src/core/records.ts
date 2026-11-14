/* The feature modules' records in this build (AS part 2; domain/records): what each module's records.ts declares, read
   through the registry the build makes (vite.modules.ts), so the core never imports a module. Plain TypeScript with no
   screens: the app, the MCP server, the stores and the spec all read it. A module left out of the build
   (FARO_WITHOUT) declares nothing here, so its rows are neither read nor written, and none are deleted. */
import PARTS from 'virtual:faro-modules/records';
import type { GoalExtras, ModuleGoalColumns, ModuleRecords, ModuleRows, ModuleSheet } from '../domain/records';
import { isModuleOn, modulesOn } from './registry';

/** Every module's records, in module id order. */
export const MODULE_RECORDS: readonly ModuleRecords[] = PARTS.map((p) => ({ ...p.part, module: p.id }));

/** The columns the modules add to Goals' rows (?metric=), each with its module: the app's filters (core/app) and the AI's
    find_goals read them, and both leave out a switched-off module's column. */
export const MODULE_GOAL_COLUMNS = MODULE_RECORDS.flatMap((m) => (m.goalColumns ?? []).map((c) => ({ ...c, module: m.module })));

/* What modules add to Goals (TG2, domain/records GoalExtras), each loaded only when a workspace has something for it,
   so a workspace without it downloads nothing for it. Loaded once. */
const extras = new Map<string, GoalExtras>();
const loading = new Map<string, Promise<void>>();
/** Loads what the modules add to Goals: for the workspace `s` has, only what it has something for; with no `s` (the
    change engine, the import's worker, the MCP server), every module's. */
export function loadGoalExtras(s?: { modules?: ModuleRows }): Promise<void> {
  return Promise.all(MODULE_RECORDS.filter((m) => m.goalExtras && !extras.has(m.module) && (!s || m.goalExtras.has(s))).map((m) => {
    if (!loading.has(m.module)) loading.set(m.module, m.goalExtras!.load().then((x) => { extras.set(m.module, x); if (x.sheet) x.sheet.module = m.module; }));
    return loading.get(m.module)!;
  })).then(() => undefined);
}
/** How many modules' extras have loaded: what the app redraws on (core/app useModules). */
export const goalExtrasLoaded = () => extras.size;
/** What has loaded, of the modules in `on` (all, when not given), each with its module. */
export const goalExtrasOf = (on?: ReadonlySet<string>) => [...extras].filter(([id]) => !on || on.has(id)).map(([module, x]) => ({ module, ...x }));
/** The parameters' starts the modules' filters use (Fields' `f.`), known before anything loads. */
export const GOAL_PREFIXES = MODULE_RECORDS.flatMap((m) => (m.goalExtras?.prefix ? [m.goalExtras.prefix] : []));

/** The modules' columns on the Goals sheet (Fields' one per live field), of the modules on in a workspace and loaded. */
export const goalSheetsOn = (ws: { modulesOff?: readonly string[] } | null | undefined): readonly ModuleGoalColumns[] =>
  goalExtrasOf(modulesOn(ws).on).flatMap((x) => (x.sheet ? [x.sheet] : []));

/** The workbook's sheets the modules add (domain/export), in module id order: every module in this build. */
export const MODULE_SHEETS: readonly ModuleSheet[] = MODULE_RECORDS.flatMap((m) => m.sheets ?? []);

/** The records of the modules on in a workspace: what Recently removed lists and restores, and what a carried copy
    carries. A module that's off, switched off itself or off because something it needs is (fix item F5), keeps its rows
    untouched, and none of them is offered back until it is on again. */
export const recordsOn = (ws: { modulesOff?: readonly string[] } | null | undefined): readonly ModuleRecords[] =>
  recordsOf(MODULE_RECORDS, modulesOn(ws).on);

/** Of some modules' records, those of the modules on (resolveModules' `on`). */
export const recordsOf = (records: readonly ModuleRecords[], on: ReadonlySet<string>): readonly ModuleRecords[] =>
  records.filter((m) => on.has(m.module));

/** The workbook's sheets of the modules switched on in a workspace (fix item F2): a module that's off adds no sheet to
    any export (the Export sheet, Data's downloads, the MCP export tool), as it adds nothing else. */
export const sheetsOn = (ws: { modulesOff?: readonly string[] } | null | undefined): readonly ModuleSheet[] =>
  recordsOn(ws).flatMap((m) => m.sheets ?? []);

/** What a workspace's exports hold, for every door that writes one (the Export sheet, Import's "Export everything", the
    preview's worked-out check, the Data tables, the MCP export tool): the sheets of the modules switched on there (F2),
    and whether Reviews is on (RS1, Reviews switch spec 5): with it off the workbook has no Notes sheet and Asks no Review
    column. Spread into workbook()'s input, so the rule lives here once. */
export const exportOn = (ws: { modulesOff?: readonly string[] } | null | undefined): { sheets: readonly ModuleSheet[]; goalColumns: readonly ModuleGoalColumns[]; reviews: boolean } =>
  ({ sheets: sheetsOn(ws), goalColumns: goalSheetsOn(ws), reviews: isModuleOn(ws, 'reviews') });
