/* Fields' own records (TG1; the records extension point, domain/records): the core keeps, saves, scopes and carries them
   without knowing what they are.

     field        a workspace's field (goal_fields), under modules.tags.fields; never removed: retired with retiredAt
                  (Lane, 5a), and brought back by the module's own action, so it is not `removable`
     field value  a goal's value for one field (goal_field_values), under modules.tags.fieldValues; its id is
                  `{goalId}:{fieldId}`; empty when cleared

   Neither table has removed_at (migration 0052). The core's generic paths that mark a row removed (a carried copy that
   leaves, a start undone: domain/records rowsLeaving and rowsUndone) set removedAt on a value; its row is written as
   cleared (value ''), which is what a value with removedAt means to every reader here (fields.ts valueOf). Undo of such
   a change puts the value back (asBefore clears removedAt). Every column is always written: a batch's keys are the
   union of its rows' keys, and a key left out is written null (okr_upsert). */
import type { ColumnFill } from '../../domain/query';
import { moduleRows, type DbRow, type ModuleRecords, type ModuleRows, type RecordDef } from '../../domain/records';
import type { Snapshot } from '../../domain/types';
import { fieldMatcher, filterParam, FILTER_PREFIX, NOT_SET, pickedOf } from './filter';
import type { GoalFieldValue, SavedField } from './types';

/* The keys fields.ts files them under (FIELDS_KEY, VALUES_KEY), written here so the first download, which carries every
   module's records, doesn't carry the module's rules with them (scripts/check-bundle.mjs). fields.test.ts checks they agree. */
export const FIELDS = 'fields';
export const VALUES = 'fieldValues';

const iso = (v: unknown) => new Date(String(v)).toISOString();

export const fieldToRow = (ws: string, f: SavedField): DbRow => ({
  workspace_id: ws, id: f.id, name: f.name, kind: f.kind, options: f.kind === 'list' ? f.options : [], position: f.position,
  created_by: f.createdBy, created_at: f.createdAt, retired_at: f.retiredAt ?? null, retired_by: f.retiredBy ?? null,
});
export const fieldFromRow = (r: DbRow): SavedField => ({
  id: r.id, name: String(r.name), kind: r.kind === 'text' ? 'text' : 'list', options: Array.isArray(r.options) ? (r.options as unknown[]).map(String) : [],
  position: Number(r.position ?? 0), createdBy: String(r.created_by), createdAt: iso(r.created_at),
  retiredAt: r.retired_at ? iso(r.retired_at) : null, retiredBy: r.retired_by ? String(r.retired_by) : null,
});
export const valueToRow = (ws: string, v: GoalFieldValue): DbRow => ({
  workspace_id: ws, id: v.id, goal_id: v.goalId, field_id: v.fieldId, value: v.removedAt ? '' : v.value,
  set_by: v.removedAt ? (v.removedBy ?? v.setBy) : v.setBy, set_at: v.removedAt ?? v.setAt,
});
export const valueFromRow = (r: DbRow): GoalFieldValue => ({
  id: r.id, goalId: String(r.goal_id), fieldId: String(r.field_id), value: String(r.value ?? ''), setBy: String(r.set_by), setAt: iso(r.set_at),
});

const field: RecordDef<SavedField> = {
  name: 'field',
  key: FIELDS,
  table: 'goal_fields',
  removable: false,
  toRow: fieldToRow,
  fromRow: fieldFromRow,
  order: (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  // A workspace's fields span cycles: every one, retired ones included (they come back with their values).
  carry: (rows) => rows,
};

const value: RecordDef<GoalFieldValue> = {
  name: 'field value',
  key: VALUES,
  table: 'goal_field_values',
  removable: false,
  toRow: valueToRow,
  fromRow: valueFromRow,
  // Every value not cleared by the core's removal paths; a goal outside the cycle simply isn't shown.
  carry: (rows) => rows.filter((v) => !v.removedAt),
  // A goal carried into the next year keeps its values, as it keeps its definition (spec, "What it is").
  follow: (rows, copies) => rows.filter((v) => copies.has(v.goalId) && v.value).map((v) => ({ ...v, id: `${copies.get(v.goalId)!}:${v.fieldId}`, goalId: copies.get(v.goalId)!, removedAt: null, removedBy: null })),
  goalOf: (v) => v.goalId,
};

/* TG2: Goals' filters (`?f.<field id>=Build,Run`) and the Goals sheet's columns, read straight from the rows so the
   first download carries only filter.ts, not the module's rules; reading a file back (sheet.ts) loads with the engine. */
type Rows = { modules?: ModuleRows };
const fieldsIn = (s: Rows) => moduleRows<SavedField>(s, 'tags', FIELDS).filter((f) => !f.retiredAt).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
const valuesIn = (s: Rows) => moduleRows<GoalFieldValue>(s, 'tags', VALUES);
const held = (s: Rows) => { const m = new Map<string, string>(); for (const v of valuesIn(s)) if (!v.removedAt && v.value) m.set(`${v.goalId}:${v.fieldId}`, v.value); return m; };

/** Each live list field's column, by its parameter: the goal's value (or Not set), and rule 3's test for what is picked. */
function filterColumns(s: Snapshot): Record<string, ColumnFill> {
  const out: Record<string, ColumnFill> = {};
  const lists = fieldsIn(s).filter((f) => f.kind === 'list');
  if (!lists.length) return out;
  const by = held(s);
  const values = valuesIn(s);
  for (const f of lists) {
    const fill: ColumnFill = (g) => by.get(`${g.id}:${f.id}`) ?? NOT_SET;
    // A link's text read once per text, not once per goal.
    let last: { text: string; match: (goalId: string) => boolean } | null = null;
    fill.test = (g, text) => {
      if (last?.text !== text) { const picked = pickedOf(f, text); last = { text, match: picked.length ? fieldMatcher(values, { [f.id]: picked }) : () => true }; }
      return last.match(g.id);
    };
    out[filterParam(f.id)] = fill;
  }
  return out;
}

/** The reader for the Goals sheet's columns, loaded with the change engine. */
let reader: typeof import('./sheet') | null = null;

const records: Omit<ModuleRecords, 'module'> = {
  records: [field, value],
  goalColumnFamilies: [{
    prefix: FILTER_PREFIX,
    columns: filterColumns,
    // find_goals' `fields`, read by find.ts, which loads only when it is used.
    arg: { module: 'Fields', name: 'fields', description: `Goals with these values of the workspace’s own list fields, by name: {"Stage": "Build, Run"}; "${NOT_SET}" for none.`, params: async (s, asked) => (await import('./find')).fieldParams(s, asked) },
  }],
  goalSheet: {
    columns: (s) => fieldsIn(s).map((f) => ({ header: f.name, about: `The workspace’s own field: ${f.kind === 'list' ? `one of ${f.options.join(', ')}` : 'free text'}, or empty for none.` })),
    cell: (s, goalId, header) => { const f = fieldsIn(s).find((x) => x.name === header); return (f && held(s).get(`${goalId}:${f.id}`)) || null; },
    load: async () => { reader ??= await import('./sheet'); },
    read: (x) => { if (!reader) throw new Error('Fields’ columns haven’t loaded: call loadGoalSheets() before the change engine runs.'); return reader.readFieldColumns(x); },
  },
};
export default records;
