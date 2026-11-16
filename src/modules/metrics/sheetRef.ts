/* The metric library's sheet as its records declare it (domain/records ModuleSheetRef): its name and what it holds, in
   the first download for the MCP tools' arguments and formats; the sheet itself (./sheet.ts, its columns and rows)
   loads when a door that reads it asks (core/records loadModuleSheets). */
import type { ModuleSheetRef } from '../../domain/records';

export const METRICS_SHEET_NAME = 'Metrics';
export const METRICS_SHEET_ABOUT = 'The metric library: every number goals are measured by, defined once, and the exported goals each one measures. Load it back to add or change many metrics at once: by ID, or by name for a new one; an empty ID adds it. Action retires one or brings it back.';

export const metricsSheetRef = (): ModuleSheetRef => ({
  name: METRICS_SHEET_NAME, about: METRICS_SHEET_ABOUT, loaded: true,
  load: () => import('./sheet').then((m) => m.METRICS_SHEET),
});
