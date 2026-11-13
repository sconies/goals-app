// @vitest-environment node
/* Fix item F5: a module is off in a workspace when it is switched off, or when something it needs is off. recordsOn
   (Recently removed, a carried copy) and sheetsOn (every export) follow resolveModules, not the switches alone. */
import type { ModuleRecords } from '../domain/records';
import { resolveModules } from './module';
import { MODULE_RECORDS, recordsOf, recordsOn, sheetsOn } from './records';

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

  it('in this build, recordsOn and sheetsOn leave out each module switched off', () => {
    expect(recordsOn({ modulesOff: [] })).toEqual(MODULE_RECORDS);
    for (const m of MODULE_RECORDS) {
      expect(recordsOn({ modulesOff: [m.module] }).map((x) => x.module)).not.toContain(m.module);
      for (const sheet of m.sheets ?? []) expect(sheetsOn({ modulesOff: [m.module] })).not.toContain(sheet);
    }
  });
});
