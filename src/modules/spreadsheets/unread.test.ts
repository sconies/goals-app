/* The import's file line (C19, TG2): a module's own Goals columns (Fields') aren't named as columns nothing reads while
   the module is on; switched off, they are, once, with the file's other unread columns. */
import { describe, expect, it } from 'vitest';
import { MODULES } from '../../core/registry';

const MODULE_IDS = MODULES.map((m) => m.id);
import { unreadColumns } from './unread';

describe('columns nothing reads, with a module’s own Goals columns', () => {
  const read = { read: [{ name: 'Goals', kind: 'goals' }, { name: 'People', kind: 'people' }], unknownColumns: [{ sheet: 'Goals', headers: ['Stage', 'Budget'] }, { sheet: 'People', headers: ['Stage'] }] };
  const s = { modules: { tags: { fields: [{ id: 'f1', name: 'Stage', kind: 'list', options: ['Build'], position: 0, createdAt: '2026-11-01T00:00:00.000Z', retiredAt: null }] } } };
  it.runIf(MODULE_IDS.includes('tags'))('leaves out Fields’ columns on Goals while it is on, and names them while it is off', () => {
    expect(unreadColumns(read, {}, s)).toEqual([{ sheet: 'Goals', headers: ['Budget'] }, { sheet: 'People', headers: ['Stage'] }]);
    expect(unreadColumns(read, { modulesOff: ['tags'] }, s)).toEqual(read.unknownColumns);
  });
});
