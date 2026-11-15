// Fields' actions (spec/core/actions.md: addField, changeField, moveField, retireField, bringBackField, setGoalFields)
// and its two records (records.md): modules.tags.fields and modules.tags.fieldValues. No rule of the core reads them.
import { fieldProblem, valueProblem, isLive, fold, NOT_SET, FIELD_LIMITS } from './rules.mjs';

export const ADMINS_ONLY = 'Only admins can add or change fields.';
export const GONE = 'That field no longer exists. Reload to see the latest.';
export const OWNER_ONLY = 'Only the goal’s owner or an admin can change its fields.';

export function mod(W) {
  W.modules = W.modules || {};
  const m = (W.modules.tags = W.modules.tags || {});
  m.fields = m.fields || [];
  m.fieldValues = m.fieldValues || [];
  return m;
}
export const ordered = (W) => [...mod(W).fields].sort((a, b) => a.position - b.position);
export const liveFields = (W) => ordered(W).filter(isLive);
/** A goal's stored value for a field: '' when none, cleared, or taken away by the core (removedAt). */
export const valueOf = (W, goalId, fieldId) => { const v = mod(W).fieldValues.find((x) => x.id === `${goalId}:${fieldId}`); return v && !v.removedAt ? v.value || '' : ''; };
export const goalsWithValue = (W, f) => new Set(mod(W).fieldValues.filter((v) => v.fieldId === f.id && v.value && !v.removedAt && (W.goals || []).some((g) => g.id === v.goalId && !g.removedAt)).map((v) => v.goalId)).size;
export const kindWords = (f) => (f.kind === 'list' ? `A list: ${f.options.join(', ')}` : 'Free text');

// The database's limits (rules.md, "Limits the records hold"): held at every write, as the tables' checks would.
export function checkRow(kind, r) {
  if (kind === 'field') {
    const n = String(r.name || '').trim().length;
    if (n < 1 || n > FIELD_LIMITS.name) throw new Error('goal_fields_name_check');
    if (!['list', 'text'].includes(r.kind)) throw new Error('goal_fields_kind_check');
    if (r.kind === 'list' && (r.options.length < 1 || r.options.length > FIELD_LIMITS.values)) throw new Error('goal_fields_options_check');
    if (r.kind === 'text' && r.options.length) throw new Error('goal_fields_text_no_options');
  } else {
    if (String(r.value ?? '').length > FIELD_LIMITS.text) throw new Error('goal_field_values_value_check');
    if (r.id !== `${r.goalId}:${r.fieldId}`) throw new Error('goal_field_values_one');
  }
  return r;
}

const isAdmin = (app, actor) => !!app.person(actor)?.admin;
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
const cleanOptions = (o) => (Array.isArray(o) ? o : String(o ?? '').split(/\r?\n/)).map((x) => String(x).trim()).filter(Boolean);
const find = (W, id) => mod(W).fields.find((f) => f.id === id || (id && fold(f.name) === fold(id)));
const at = (app) => app.now || app.W.builtFor;

function logField(app, actor, f, summary, diffs, via, goalId = null) {
  return app.log(actor, { entity: 'field', module: 'tags', entityId: f.id, goalId, action: 'field', summary, diffs }, via);
}

export function addField(app, actor, input, via) {
  if (!isAdmin(app, actor)) return { error: ADMINS_ONLY };
  const W = app.W, m = mod(W);
  const f = { name: String(input.name ?? '').trim(), kind: input.kind === 'text' ? 'text' : input.kind === 'list' ? 'list' : input.kind, options: cleanOptions(input.options ?? input.values) };
  const p = fieldProblem(f, m.fields);
  if (p) return { error: p };
  let id = `fld_${slug(f.name)}`, n = 2;
  while (m.fields.some((x) => x.id === id)) id = `fld_${slug(f.name)}_${n++}`;
  const row = checkRow('field', { id, ...f, position: Math.max(-1, ...m.fields.map((x) => x.position)) + 1, retiredAt: null, retiredBy: null, createdBy: actor, createdAt: at(app) });
  if (input.dryRun) return { ok: true, dry: true, field: row };
  m.fields.push(row);
  logField(app, actor, row, `${row.name} added`, [{ field: row.name, from: '—', to: kindWords(row) }], via);
  return { ok: true, logged: true, field: row, message: `${row.name} added.` };
}

export function changeField(app, actor, input, via) {
  if (!isAdmin(app, actor)) return { error: ADMINS_ONLY };
  const f = find(app.W, input.fieldId);
  if (!f) return { error: GONE };
  const next = { ...f, name: input.name !== undefined && input.name !== null ? String(input.name).trim() : f.name, options: f.kind === 'list' && (input.options ?? input.values) !== undefined ? cleanOptions(input.options ?? input.values) : f.options };
  const p = fieldProblem(next, mod(app.W).fields, f.id);
  if (p) return { error: p };
  const diffs = [];
  if (next.name !== f.name) diffs.push({ field: 'Name', from: f.name, to: next.name });
  if (next.options.join('|') !== f.options.join('|')) diffs.push({ field: 'Values', from: f.options.join(', '), to: next.options.join(', ') });
  if (!diffs.length) return { ok: true, unchanged: true, logged: true, message: 'Nothing changed.' };
  const old = f.name;
  Object.assign(f, checkRow('field', next));
  logField(app, actor, f, next.name !== old ? `${old} renamed ${f.name}` : `${f.name}’s values changed`, diffs, via);
  return { ok: true, logged: true, field: f, message: 'Saved.' };
}

export function moveField(app, actor, input, via) {
  if (!isAdmin(app, actor)) return { error: ADMINS_ONLY };
  const f = find(app.W, input.fieldId);
  if (!f || !isLive(f)) return { error: 'That field is retired or no longer exists. Reload to see the latest.' };
  const live = liveFields(app.W);
  const i = live.indexOf(f), j = i + (Number(input.by) < 0 ? -1 : 1);
  if (j < 0 || j >= live.length) return { ok: true, unchanged: true, logged: true };
  const o = live[j];
  [f.position, o.position] = [o.position, f.position];
  logField(app, actor, f, `${f.name} moved ${j < i ? 'up' : 'down'}`, [{ field: 'Order', from: String(i + 1), to: String(j + 1) }], via);
  return { ok: true, logged: true };
}

export function retireField(app, actor, input, via) {
  if (!isAdmin(app, actor)) return { error: ADMINS_ONLY };
  const f = find(app.W, input.fieldId);
  if (!f) return { error: GONE };
  if (!isLive(f)) return { error: `${f.name} is already retired.` };
  Object.assign(f, { retiredAt: at(app), retiredBy: actor });
  logField(app, actor, f, `${f.name} retired`, [{ field: f.name, from: 'Live', to: 'Retired' }], via);
  return { ok: true, logged: true, message: `${f.name} retired. Every goal keeps its value.` };
}

export function bringBackField(app, actor, input, via) {
  if (!isAdmin(app, actor)) return { error: ADMINS_ONLY };
  const f = find(app.W, input.fieldId);
  if (!f) return { error: GONE };
  if (isLive(f)) return { error: `${f.name} isn’t retired.` };
  const p = fieldProblem({ ...f, retiredAt: null }, mod(app.W).fields.filter((x) => x.id !== f.id));
  if (p) return { error: p };
  Object.assign(f, { retiredAt: null, retiredBy: null });
  logField(app, actor, f, `${f.name} brought back`, [{ field: f.name, from: 'Retired', to: 'Live' }], via);
  return { ok: true, logged: true, message: `${f.name} is back, with its values.` };
}

/** Plan a goal's values: every value checked before any is saved. values: { fieldId or name: value }. */
export function planGoalFields(app, actor, goalId, values) {
  const g = app.goal(goalId);
  if (!g) return { error: `There’s no live goal with the ID or key ${goalId} in ${app.wsName}. Use find_goals to get IDs and keys.` };
  if (g.ownerId !== actor && !isAdmin(app, actor)) return { error: OWNER_ONLY };
  const plan = [];
  for (const [k, typed] of Object.entries(values || {})) {
    const f = find(app.W, k);
    if (!f) return { error: GONE };
    if (!isLive(f)) return { error: `${f.name} is retired. An admin can bring it back in Workspace, Fields.` };
    const r = valueProblem(f, typed);
    if (r.problem) return { error: r.problem };
    const from = valueOf(app.W, g.id, f.id);
    if (from !== r.kept) plan.push({ goal: g, field: f, from, to: r.kept });
  }
  return { goal: g, plan };
}
export const changeWords = (c) => `${c.field.name}: ${c.from || NOT_SET} → ${c.to || NOT_SET}`;
export function writeValue(app, actor, c, via, extraDiffs = []) {
  const m = mod(app.W), id = `${c.goal.id}:${c.field.id}`;
  const row = checkRow('value', { id, goalId: c.goal.id, fieldId: c.field.id, value: c.to, setBy: actor, setAt: at(app), removedAt: null, removedBy: null });
  const i = m.fieldValues.findIndex((v) => v.id === id);
  if (i >= 0) m.fieldValues[i] = row; else m.fieldValues.push(row);
  return logField(app, actor, c.field, changeWords(c), [{ field: c.field.name, from: c.from || NOT_SET, to: c.to || NOT_SET }, ...extraDiffs], via, c.goal.id);
}
export function setGoalFields(app, actor, input, via) {
  let values = input.values;
  if (typeof values === 'string') values = JSON.parse(values);
  if (!values && input.fieldId) values = { [input.fieldId]: input.value ?? '' };
  const r = planGoalFields(app, actor, input.goalId, values);
  if (r.error) return r;
  if (!input.dryRun) for (const c of r.plan) writeValue(app, actor, c, via);
  return { ok: true, logged: true, plan: r.plan, message: r.plan.length ? r.plan.map(changeWords).join('; ') : 'Nothing changed.' };
}

// ---------- what the core's cycle and removal paths do with its records (records.md) ----------
/** A new cycle: every field carries (retired ones too); each copied goal takes its original's values, not cleared ones. */
export function carryToCycle(W, copies /* Map oldGoalId → newGoalId */, at, by) {
  const m = mod(W), add = [];
  for (const v of m.fieldValues) if (copies.has(v.goalId) && v.value && !v.removedAt) {
    const goalId = copies.get(v.goalId);
    add.push(checkRow('value', { id: `${goalId}:${v.fieldId}`, goalId, fieldId: v.fieldId, value: v.value, setBy: by, setAt: at, removedAt: null, removedBy: null }));
  }
  for (const r of add) { const i = m.fieldValues.findIndex((x) => x.id === r.id); if (i >= 0) m.fieldValues[i] = r; else m.fieldValues.push(r); }
  return add;
}
/** The core marks a goal's records removed (a copy that leaves, a start undone): its values read as cleared. The tables have
    no removed_at, so a row is written cleared; the value is kept beside it so Undo can put it back. */
export function removeForGoals(W, goalIds, at, by) {
  for (const v of mod(W).fieldValues) if (goalIds.includes(v.goalId) && !v.removedAt) Object.assign(v, { removedAt: at, removedBy: by });
}
export function restoreForGoals(W, goalIds) {
  for (const v of mod(W).fieldValues) if (goalIds.includes(v.goalId) && v.removedAt) Object.assign(v, { removedAt: null, removedBy: null });
}
/** A row as the table holds it: no removed_at, so a removed value is written cleared. */
export const asTableRow = (v) => ({ id: v.id, goal_id: v.goalId, field_id: v.fieldId, value: v.removedAt ? '' : v.value, set_by: v.setBy, set_at: v.setAt });
