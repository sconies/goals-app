/* Fields' changes (fields.ts) and its records (records.ts): who may, what History says, and how the core's generic save,
   removal, undo and carry treat two tables that have no removed_at (goal_fields retires; goal_field_values clears). */
import { describe, expect, it } from 'vitest';
import type { ActionContext } from '../../domain/actions';
import { NotAllowed } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { carryModules, followCopies, moduleRowsBefore, rowsLeaving, rowsUndone, type ModuleRecords } from '../../domain/records';
import { buildPlatformOrg } from '../../data/platformOrg';
import { applyCommit } from '../../data/store';
import { moduleTableRows } from '../../data/rows';
import type { Snapshot } from '../../domain/types';
import { addField, bringBackField, changeField, fieldsOf, liveFields, moveField, MODULE, retireField, setGoalFields, valueOf, valuesOf, VALUES_KEY, type GoalFieldValue } from './fields';
import records, { FIELDS, VALUES, fieldFromRow, fieldToRow, valueFromRow, valueToRow } from './records';

const today = new Date('2026-11-02T12:00:00Z');
const base = buildPlatformOrg(today);
const RECORDS: ModuleRecords[] = [{ ...records, module: MODULE }];

let n = 0;
function ctx(s: Snapshot, who: string): ActionContext {
  return { snapshot: s, cycle: s.cycles[0]!, week: 45, actor: s.people.find((p) => p.id === who)!, now: today.toISOString(), newId: (p) => `${p}_${++n}` };
}
const apply = (s: Snapshot, c: Commit | null) => (c ? applyCommit(s, c) : s);
const withStage = () => apply(structuredClone(base), addField(ctx(base, 'amara'), { name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] }));

describe('defining fields (admins)', () => {
  it('adds a field, saying “Stage added”; refuses anyone who isn’t an admin', () => {
    const c = addField(ctx(base, 'amara'), { name: ' Stage ', kind: 'list', options: ['Discover', ' Build', 'Run'] });
    expect(c.changes[0]).toMatchObject({ entity: 'field', action: 'created', summary: 'Stage added', goalId: null });
    expect(fieldsOf(c)[0]).toMatchObject({ name: 'Stage', options: ['Discover', 'Build', 'Run'], position: 0, retiredAt: null });
    expect(() => addField(ctx(base, 'rhea'), { name: 'Stage', kind: 'text', options: [] })).toThrow('Only an admin can change the workspace’s fields.');
    expect(() => addField(ctx(base, 'amara'), { name: 'Notes', kind: 'text', options: [] })).not.toThrow();
  });

  it('renames, reorders, retires and brings back, each in History', () => {
    let s = withStage();
    s = apply(s, addField(ctx(s, 'amara'), { name: 'Programme', kind: 'text', options: [] }));
    const [stage, prog] = liveFields(s);
    expect(changeField(ctx(s, 'amara'), stage!.id, { name: 'Phase', options: stage!.options })!.changes[0]!.summary).toBe('Stage renamed Phase');
    expect(changeField(ctx(s, 'amara'), stage!.id, { name: 'Stage', options: stage!.options })).toBeNull();
    expect(moveField(ctx(s, 'amara'), stage!.id, -1)).toBeNull();
    s = apply(s, moveField(ctx(s, 'amara'), prog!.id, -1));
    expect(liveFields(s).map((f) => f.name)).toEqual(['Programme', 'Stage']);
    const retire = retireField(ctx(s, 'amara'), stage!.id);
    expect(retire.changes[0]!.summary).toBe('Stage retired');
    s = apply(s, retire);
    expect(liveFields(s).map((f) => f.name)).toEqual(['Programme']);
    s = apply(s, bringBackField(ctx(s, 'amara'), stage!.id));
    expect(liveFields(s).map((f) => f.name)).toEqual(['Programme', 'Stage']);
  });
});

describe('a goal’s values', () => {
  it('sets a list value as the list writes it, and History says “Stage: Discover → Build”', () => {
    let s = withStage();
    const f = liveFields(s)[0]!;
    const first = setGoalFields(ctx(s, 'rhea'), s.goals.find((g) => g.id === 'lead-flaky')!, { [f.id]: 'discover' })!;
    expect(first.changes[0]).toMatchObject({ entity: 'field', goalId: 'lead-flaky', summary: 'Stage: Not set → Discover' });
    s = apply(s, first);
    const second = setGoalFields(ctx(s, 'rhea'), s.goals.find((g) => g.id === 'lead-flaky')!, { [f.id]: 'Build' })!;
    expect(second.changes[0]!.summary).toBe('Stage: Discover → Build');
    expect(second.changes[0]!.diffs).toEqual([{ field: 'Stage', from: 'Discover', to: 'Build' }]);
    s = apply(s, second);
    expect(valueOf(s, 'lead-flaky', f.id)).toBe('Build');
    expect(setGoalFields(ctx(s, 'rhea'), s.goals.find((g) => g.id === 'lead-flaky')!, { [f.id]: 'build' })).toBeNull();
  });

  it('refuses someone who isn’t the owner or an admin, a value the list doesn’t hold, and a retired field', () => {
    let s = withStage();
    const f = liveFields(s)[0]!;
    const g = s.goals.find((x) => x.id === 'lead-flaky')!;
    expect(() => setGoalFields(ctx(s, 'tunde'), g, { [f.id]: 'Build' })).toThrow(NotAllowed);
    expect(() => setGoalFields(ctx(s, 'amara'), g, { [f.id]: 'Build' })).not.toThrow();
    expect(() => setGoalFields(ctx(s, 'rhea'), g, { [f.id]: 'Operate' })).toThrow('“Operate” isn’t one of Stage’s values: Discover, Build or Run.');
    s = apply(s, retireField(ctx(s, 'amara'), f.id));
    expect(() => setGoalFields(ctx(s, 'rhea'), g, { [f.id]: 'Build' })).toThrow(/Stage is retired/);
  });
});

describe('the records, on tables with no removed_at', () => {
  const field = { id: 'fld_1', name: 'Stage', kind: 'list' as const, options: ['Build'], position: 0, createdBy: 'amara', createdAt: today.toISOString(), retiredAt: null, retiredBy: null };
  const value: GoalFieldValue = { id: 'g1:fld_1', goalId: 'g1', fieldId: 'fld_1', value: 'Build', setBy: 'rhea', setAt: today.toISOString() };

  it('are filed under the keys the rules read', () => {
    expect([FIELDS, VALUES]).toEqual(['fields', VALUES_KEY]);
  });

  it('write every column, never removed_at, and read back the same', () => {
    expect(fieldToRow('ws', field)).not.toHaveProperty('removed_at');
    expect(fieldToRow('ws', field)).toMatchObject({ retired_at: null, retired_by: null, options: ['Build'] });
    expect(fieldFromRow(fieldToRow('ws', field))).toEqual(field);
    expect(valueToRow('ws', value)).not.toHaveProperty('removed_at');
    expect(valueFromRow(valueToRow('ws', value))).toEqual(value);
    // A text field writes no values, whatever it holds.
    expect(fieldToRow('ws', { ...field, kind: 'text', options: ['x'] }).options).toEqual([]);
  });

  it('a value the core marks removed (a copy that leaves, a start undone) is written cleared, and Undo puts it back', () => {
    const modules = { [MODULE]: { [VALUES_KEY]: [value] } };
    const gone = { removedAt: '2026-11-03T00:00:00.000Z', removedBy: 'amara' };
    const left = rowsLeaving(modules, new Set(['g1']), RECORDS, gone);
    const row = moduleTableRows('ws', { modules: left }, RECORDS).goal_field_values![0]!;
    expect(row).toMatchObject({ id: 'g1:fld_1', value: '', set_by: 'amara', set_at: gone.removedAt });
    expect(row).not.toHaveProperty('removed_at');
    expect(valueOf({ modules: left }, 'g1', 'fld_1')).toBe('');
    const undone = rowsUndone(modules, [{ module: MODULE, key: VALUES_KEY, ids: ['g1:fld_1'] }], gone);
    expect(moduleTableRows('ws', { modules: undone }, RECORDS).goal_field_values![0]).toMatchObject({ value: '' });
    // Undo of the removal: the row as it was, its removal cleared, so it is written with its value again.
    const back = moduleRowsBefore(left, { modules })!;
    expect(valueToRow('ws', back[MODULE]![VALUES_KEY]![0] as GoalFieldValue)).toMatchObject({ value: 'Build', set_by: 'rhea' });
  });

  it('a new cycle keeps every field, retired ones too, and the values not cleared; a copied goal takes its values', () => {
    const modules = { [MODULE]: { fields: [field, { ...field, id: 'fld_2', retiredAt: today.toISOString() }], [VALUES_KEY]: [value, { ...value, id: 'g2:fld_1', goalId: 'g2', removedAt: today.toISOString() }] } };
    const carried = carryModules(modules, new Set(['g1']), RECORDS);
    expect((carried[MODULE]!.fields as unknown[]).length).toBe(2);
    expect((carried[MODULE]![VALUES_KEY] as GoalFieldValue[]).map((v) => v.id)).toEqual(['g1:fld_1']);
    const copies = followCopies(modules, new Map([['g1', 'g1-2027']]), RECORDS, (p) => p);
    expect(copies.modules[MODULE]![VALUES_KEY]).toEqual([{ ...value, id: 'g1-2027:fld_1', goalId: 'g1-2027', removedAt: null, removedBy: null }]);
  });

  it('keeps a goal’s values in the workspace as saved', () => {
    let s = withStage();
    const f = liveFields(s)[0]!;
    s = apply(s, setGoalFields(ctx(s, 'rhea'), s.goals.find((g) => g.id === 'lead-flaky')!, { [f.id]: 'Run' }));
    expect(valuesOf(s)).toEqual([expect.objectContaining({ id: `lead-flaky:${f.id}`, value: 'Run', setBy: 'rhea' })]);
  });
});
