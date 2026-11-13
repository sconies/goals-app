// @vitest-environment node
/* The records extension point (AS part 2, docs/design/architecture.md 1.3), on its own: how a module's rows are applied,
   merged, carried into a cycle, listed on Recently removed and put back by Undo, with a small module that isn't Faro's
   (a note per goal), so nothing here leans on the metric library. */
import type { ActionContext } from './actions';
import type { Commit } from './commit';
import { applyModuleRows, carryModules, cycleUntil, goalMarksOf, mergeModuleRows, moduleRowsBefore, removedModuleRows, restorableModuleRow, type ModuleRecords, type ModuleRow, type ModuleRows } from './records';

interface Note extends ModuleRow { goalId: string; text: string }
const note = (id: string, goalId: string, more: Partial<Note> = {}): Note => ({ id, goalId, text: id, ...more });
const NOTES: ModuleRecords = {
  module: 'notes',
  records: [{
    name: 'note', key: 'notes', table: 'okr_notes', removable: true,
    toRow: (ws, r) => ({ workspace_id: ws, ...r }), fromRow: (r) => r as unknown as Note,
    carry: (rows: Note[], scope) => rows.filter((r) => !r.removedAt && scope.goalIds.has(r.goalId)),
    removed: { label: 'Note', name: (r: Note) => r.text, restore: (_x: ActionContext, r: Note): Commit => ({ modules: { notes: { notes: [{ ...r, removedAt: null }] } }, changes: [] }) },
  }],
};
const rows = (...n: Note[]): ModuleRows => ({ notes: { notes: n } });

describe('applyModuleRows', () => {
  it('adds and replaces rows by id, keeps the order, and leaves modules the commit doesn’t name alone', () => {
    const s: ModuleRows = { ...rows(note('a', 'g1'), note('b', 'g1')), other: { things: [{ id: 'x' }] } };
    const out = applyModuleRows(s, rows(note('b', 'g1', { text: 'changed' }), note('c', 'g2')))!;
    expect(out.notes!.notes!.map((r) => (r as Note).text)).toEqual(['a', 'changed', 'c']);
    expect(out.other).toBe(s.other);
  });
  it('a commit with no module rows changes nothing', () => {
    const s = rows(note('a', 'g1'));
    expect(applyModuleRows(s, undefined)).toBe(s);
    expect(applyModuleRows(undefined, rows(note('a', 'g1')))).toEqual(rows(note('a', 'g1')));
  });
});

describe('mergeModuleRows', () => {
  it('puts two commits’ rows together in order, each module and key', () => {
    expect(mergeModuleRows(rows(note('a', 'g1')), { ...rows(note('b', 'g1')), other: { things: [{ id: 'x' }] } })).toEqual({ notes: { notes: [note('a', 'g1'), note('b', 'g1')] }, other: { things: [{ id: 'x' }] } });
    expect(mergeModuleRows(undefined, rows(note('a', 'g1')))).toEqual(rows(note('a', 'g1')));
    expect(mergeModuleRows(rows(note('a', 'g1')), undefined)).toEqual(rows(note('a', 'g1')));
  });
});

describe('carryModules', () => {
  it('keeps what a record’s carry says, and a module this build doesn’t have exactly as it was', () => {
    const all: ModuleRows = { ...rows(note('a', 'g1'), note('b', 'g2'), note('c', 'g1', { removedAt: '2026-11-01' })), gone: { things: [{ id: 'x', removedAt: '2026-11-01' }] } };
    const out = carryModules(all, new Set(['g1']), [NOTES]);
    expect(out.notes!.notes!.map((r) => (r as ModuleRow).id)).toEqual(['a']);
    expect(out.gone).toEqual(all.gone);
  });
  it('a record with no carry keeps its rows not removed', () => {
    const plain: ModuleRecords = { ...NOTES, records: [{ ...NOTES.records[0]!, carry: undefined }] };
    expect(carryModules(rows(note('a', 'g9'), note('b', 'g9', { removedAt: 'x' })), new Set(), [plain]).notes!.notes!.map((r) => (r as ModuleRow).id)).toEqual(['a']);
  });
});

describe('removedModuleRows and restorableModuleRow', () => {
  const full = { modules: rows(note('a', 'g1'), note('b', 'g1', { removedAt: '2026-11-02', removedBy: 'p1' })) };
  it('lists only removed rows of a removable record, by its kind, label and name', () => {
    expect(removedModuleRows(full, [NOTES])).toEqual([{ kind: 'note', label: 'Note', id: 'b', name: 'b', by: 'p1', at: '2026-11-02' }]);
    expect(removedModuleRows(full, [{ ...NOTES, records: [{ ...NOTES.records[0]!, removable: false }] }])).toEqual([]);
  });
  it('finds a removed row and how it comes back; nothing for a kind no module that’s on declares', () => {
    const found = restorableModuleRow(full, [NOTES], 'note', 'b')!;
    expect(found.row.id).toBe('b');
    expect(found.restore({} as ActionContext, found.row).modules).toEqual(rows(note('b', 'g1', { removedAt: null, removedBy: 'p1' })));
    expect(restorableModuleRow(full, [], 'note', 'b')).toBeNull();
  });
});

describe('moduleRowsBefore (Undo)', () => {
  it('gives each row a removal changed back as it was, its removal fields null rather than missing', () => {
    const before = { modules: rows(note('a', 'g1'), note('b', 'g1')) };
    const removal = rows(note('a', 'g1', { removedAt: '2026-11-03', removedBy: 'p1' }), note('new', 'g1'));
    const back = moduleRowsBefore(removal, before)!;
    expect(back.notes!.notes).toEqual([{ ...note('a', 'g1'), removedAt: null, removedBy: null }]);
  });
  it('nothing to give back is nothing', () => {
    expect(moduleRowsBefore(undefined, { modules: {} })).toBeUndefined();
    expect(moduleRowsBefore(rows(note('new', 'g1')), { modules: {} })).toBeUndefined();
  });
});

describe('goalMarksOf (MT3, #351 review)', () => {
  const marks = (list: { week: number; label: string }[]): ModuleRecords => ({ module: 'm', records: [], goalMarks: (_s, _id, since, until) => (since === '2026-01-05' && until === '2027-01-11' ? list : []) });
  const cycle = { startDate: '2026-01-05', weeks: 52 };
  it('asks for the goal’s own cycle, merges marks in one week and keeps the latest three', () => {
    expect(goalMarksOf([marks([{ week: 6, label: 'Direction changed, week 6' }, { week: 6, label: 'Definition changed, week 6' }])], {}, 'g', cycle)).toEqual([{ week: 6, label: 'Direction changed, week 6 · Definition changed, week 6' }]);
    expect(goalMarksOf([marks([1, 9, 4, 20, 30].map((w) => ({ week: w, label: `W${w}` })))], {}, 'g', cycle).map((m) => m.week)).toEqual([9, 20, 30]);
    expect(cycleUntil(cycle)).toBe('2027-01-11');
  });
});
