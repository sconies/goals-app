// Fields' two records, declared for the core's store (stage 2: module rows, filed under modules.tags) and held to the
// database's limits (spec/core/schema.sql: goal_fields_*, goal_field_values_*). The tables have no removed_at.
import { FIELD_LIMITS } from './rules.mjs';

export const RECORDS = [
  { record: 'field', table: 'goal_fields', key: 'fields', removable: false },
  { record: 'field value', table: 'goal_field_values', key: 'fieldValues', removable: false },
];

/** The workspace's rows, made if missing. */
export function tablesOf(W) {
  W.modules = W.modules || {};
  const T = (W.modules.tags = W.modules.tags || {});
  T.fields = T.fields || [];
  T.fieldValues = T.fieldValues || [];
  return T;
}

/** What the database refuses (criterion 4): the constraint's name, or null. */
export function constraintOf(key, row) {
  if (key === 'fields') {
    const n = String(row.name ?? '').trim().length;
    if (n < 1 || n > FIELD_LIMITS.name) return 'goal_fields_name_check';
    if (row.kind !== 'list' && row.kind !== 'text') return 'goal_fields_kind_check';
    if (!Array.isArray(row.options) || row.options.length > FIELD_LIMITS.options || (row.kind === 'list' && row.options.length < 1)) return 'goal_fields_options_check';
    if (row.kind === 'text' && row.options.length !== 0) return 'goal_fields_text_no_options';
    return null;
  }
  if (key === 'fieldValues') {
    if (row.id !== `${row.goalId}:${row.fieldId}`) return 'goal_field_values_one';
    if (String(row.value ?? '').length > FIELD_LIMITS.text) return 'goal_field_values_value_check';
    return null;
  }
  return null;
}

/** A row as the table writes it: no removed_at; a value the core marked removed is written cleared. */
export function toRow(key, r) {
  if (key === 'fieldValues') return { id: r.id, goalId: r.goalId, fieldId: r.fieldId, value: r.removedAt ? '' : r.value, setBy: r.setBy, setAt: r.setAt };
  const { id, name, kind, options, position, createdBy, createdAt } = r;
  return { id, name, kind, options, position, createdBy, createdAt, retiredAt: r.retiredAt ?? null, retiredBy: r.retiredBy ?? null };
}

/** Saves rows into the workspace's tables, all or nothing, as a database would: a row the limits refuse saves nothing. */
export function saveRows(W, commit) {
  const T = tablesOf(W);
  for (const key of ['fields', 'fieldValues']) for (const r of commit[key] || []) {
    const c = constraintOf(key, r);
    if (c) throw new Error(`The database refused the row: ${c}. Nothing was saved.`);
  }
  for (const key of ['fields', 'fieldValues']) for (const r of commit[key] || []) {
    const i = T[key].findIndex((x) => x.id === r.id);
    if (i >= 0) T[key][i] = { ...r }; else T[key].push({ ...r });
  }
}

/** A new cycle (the core's start of the next year): every field carries, retired ones too; each copied goal takes its
    values (not cleared). `copies`: [{ from, to }] goal ids. Gives the rows to save. */
export function carry(W, copies, at, by) {
  const T = tablesOf(W);
  const rows = [];
  for (const { from, to } of copies) for (const v of T.fieldValues) {
    if (v.goalId !== from || v.removedAt || !v.value) continue;
    rows.push({ id: `${to}:${v.fieldId}`, goalId: to, fieldId: v.fieldId, value: v.value, setBy: by, setAt: at });
  }
  return { fields: [], fieldValues: rows };
}

/** The core's generic removal (a carried copy that leaves, a start undone): its values read as cleared from then on.
    Gives what Undo needs to put them back. */
export function markRemoved(W, goalIds, at, by) {
  const T = tablesOf(W);
  const undo = [];
  for (const v of T.fieldValues) if (goalIds.includes(v.goalId) && !v.removedAt) { undo.push({ ...v }); v.removedAt = at; v.removedBy = by; }
  return undo;
}
export function restore(W, undo) {
  const T = tablesOf(W);
  for (const u of undo) { const i = T.fieldValues.findIndex((x) => x.id === u.id); if (i >= 0) T.fieldValues[i] = { ...u }; }
}
