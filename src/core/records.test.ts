// @vitest-environment node
/* Fix item F5: a module is off in a workspace when it is switched off, or when something it needs is off. recordsOn
   (Recently removed, a carried copy) and sheetsOn (every export) follow resolveModules, not the switches alone. */
vi.mock('virtual:faro-modules', () => ({
  default: [
    { id: 'base', needs: [] },
    { id: 'extra', needs: ['base'] },
  ],
}));
vi.mock('virtual:faro-modules/records', () => ({
  default: [
    { id: 'base', part: { kinds: [], sheets: [{ spec: { name: 'Base' } }] } },
    { id: 'extra', part: { kinds: [], sheets: [{ spec: { name: 'Extra' } }] } },
  ],
}));

import { recordsOn, sheetsOn } from './records';

const ids = (off: string[]) => recordsOn({ modulesOff: off }).map((m) => m.module);
const sheets = (off: string[]) => sheetsOn({ modulesOff: off }).map((s) => s.spec.name);

describe('records follow which modules are on, needs included (F5)', () => {
  it('gives every module’s records while all are on', () => {
    expect(ids([])).toEqual(['base', 'extra']);
    expect(sheets([])).toEqual(['Base', 'Extra']);
  });

  it('leaves out a module switched off itself', () => {
    expect(ids(['extra'])).toEqual(['base']);
  });

  it('leaves out a module off only because what it needs is off', () => {
    expect(ids(['base'])).toEqual([]);
    expect(sheets(['base'])).toEqual([]);
  });
});
