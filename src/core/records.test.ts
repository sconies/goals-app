// @vitest-environment node
/* Fix item F5: a module is off in a workspace when it is switched off, or when something it needs is off. recordsOn
   (Recently removed, a carried copy) and sheetsOn (every export) follow resolveModules, not the switches alone. */
import type { ModuleRecords } from '../domain/records';
import { resolveModules } from './module';
import { loadModuleSheets, MODULE_RECORDS, MODULE_SHEET_REFS, moduleSheets, recordsOf, recordsOn, sheetHeadsFor, sheetsOn } from './records';

const installed = [{ id: 'base', needs: [] }, { id: 'extra', needs: ['base'] }];
const records = installed.map((m) => ({ module: m.id, records: [] })) as unknown as ModuleRecords[];
const ids = (off: string[]) => recordsOf(records, resolveModules(installed, off).on).map((m) => m.module);

describe('records follow which modules are on, needs included (F5)', () => {
  it('gives every module’s records while all are on', () => {
    expect(ids([])).toEqual(['base', 'extra']);
  });

  it('leaves out a module switched off itself', () => {
    expect(ids(['extra'])).toEqual(['base']);
  });

  it('leaves out a module off only because what it needs is off', () => {
    expect(ids(['base'])).toEqual([]);
  });

  it('in this build, recordsOn and sheetsOn leave out each module switched off', async () => {
    await loadModuleSheets();
    expect(recordsOn({ modulesOff: [] })).toEqual(MODULE_RECORDS);
    for (const m of MODULE_RECORDS) {
      expect(recordsOn({ modulesOff: [m.module] }).map((x) => x.module)).not.toContain(m.module);
      for (const { sheet } of m.sheets ?? []) expect(sheetsOn({ modulesOff: [m.module] })).not.toContain(sheet);
    }
  });
});

/* A module's sheets load on demand (core/records loadModuleSheets), so the first download carries none of their columns:
   only their names, for the MCP tools' arguments and formats. */
describe('module sheets, loaded when a door reads them', () => {
  it('before they load, reading one says so rather than export without it', async () => {
    vi.resetModules();
    const fresh = await import('./records');
    if (!fresh.MODULE_SHEET_REFS.length) return;
    expect(fresh.moduleSheetsLoaded()).toBe(false);
    expect(() => fresh.sheetsOn({})).toThrow(/await loadModuleSheets/);
    expect(() => fresh.sheetHeadsFor({})).toThrow(/await loadModuleSheets/);
    await fresh.loadModuleSheets();
    expect(fresh.moduleSheetsLoaded()).toBe(true);
    expect(fresh.sheetsOn({}).length).toBe(fresh.MODULE_SHEET_REFS.length);
  });

  it('each ref names the sheet it loads, and says truly whether it loads back', async () => {
    await loadModuleSheets();
    for (const r of MODULE_SHEET_REFS) {
      expect(r.sheet?.spec.name).toBe(r.name);
      expect(r.sheet?.spec.about).toBe(r.about);
      expect(r.loaded).toBe(!!r.sheet?.spec.loaded && !!(r.sheet.plan || r.sheet.loadPlan));
    }
    expect(moduleSheets().map((sh) => sh.spec.name)).toEqual(MODULE_SHEET_REFS.map((r) => r.name));
    expect(sheetHeadsFor({}).map((h) => h.name)).toEqual(MODULE_SHEET_REFS.map((r) => r.name));
  });

  it('loads once: a second load keeps the same sheets', async () => {
    await loadModuleSheets();
    const first = moduleSheets();
    await loadModuleSheets();
    expect(moduleSheets()).toEqual(first);
    first.forEach((sh, i) => expect(moduleSheets()[i]).toBe(sh));
  });
});
