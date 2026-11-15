// Fields' actions (spec/core/actions.md: addField, changeField, moveField, retireField, bringBackField, setGoalFields).
// Each checks who may and the rule, and gives a commit: the rows to save and History's entries. Nothing is saved here.
import { fieldProblem, valueProblem, cleanField, isLive } from './rules.mjs';
import { tablesOf } from './records.mjs';

export class Refused extends Error {}
const refuse = (m) => { throw new Refused(m); };
const NOT_SET = 'Not set';
const ADMIN_ONLY = 'Only an admin can add or change a workspace’s fields.';

const fieldOf = (T, id) => T.fields.find((f) => f.id === id);
const sorted = (T) => T.fields.slice().sort((a, b) => a.position - b.position);
export const liveFields = (W) => sorted(tablesOf(W)).filter(isLive);
export const retiredFields = (W) => sorted(tablesOf(W)).filter((f) => !isLive(f));
/** A goal's value for a field ('' for none). */
export function valueOf(W, goalId, fieldId) {
  const v = tablesOf(W).fieldValues.find((x) => x.goalId === goalId && x.fieldId === fieldId);
  return v && !v.removedAt ? v.value || '' : '';
}

// ctx: { W, actor: { id, admin }, now, via } — via is 'Spreadsheet' or 'MCP' when not the app.
let n = 0;
const newFieldId = (T) => { let id; do { id = `fld_${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`; } while (fieldOf(T, id)); return id; };
const entry = (ctx, what, extra = {}) => ({ at: ctx.now, by: ctx.actor.id, what, via: ctx.via || null, ...extra });

export function addField(ctx, input) {
  const T = tablesOf(ctx.W);
  if (!ctx.actor.admin) refuse(ADMIN_ONLY);
  const f = cleanField({ id: null, name: input.name, kind: input.kind, options: input.options || [] });
  const p = fieldProblem(f, T.fields);
  if (p) refuse(p);
  const pos = Math.max(-1, ...T.fields.map((x) => x.position)) + 1;
  const row = { ...f, id: newFieldId(T), position: pos, createdBy: ctx.actor.id, createdAt: ctx.now, retiredAt: null, retiredBy: null };
  return { fields: [row], fieldValues: [], history: [entry(ctx, `${row.name} added`, { kind: 'field', fieldId: row.id })] };
}

export function changeField(ctx, { fieldId, name, options }) {
  const T = tablesOf(ctx.W);
  if (!ctx.actor.admin) refuse(ADMIN_ONLY);
  const old = fieldOf(T, fieldId);
  if (!old) refuse('That field no longer exists. Reload to see the latest.');
  const f = cleanField({ ...old, name: name ?? old.name, options: options ?? old.options });
  const p = fieldProblem(f, T.fields);
  if (p) refuse(p);
  const history = [];
  if (f.name !== old.name) history.push(entry(ctx, `${old.name} renamed ${f.name}`, { kind: 'field', fieldId }));
  if (f.kind === 'list' && f.options.join('\n') !== old.options.join('\n')) history.push(entry(ctx, `${f.name}’s values: ${old.options.join(', ')} → ${f.options.join(', ')}`, { kind: 'field', fieldId }));
  if (!history.length) return null;
  return { fields: [f], fieldValues: [], history };
}

export function moveField(ctx, { fieldId, by }) {
  const T = tablesOf(ctx.W);
  if (!ctx.actor.admin) refuse(ADMIN_ONLY);
  const live = sorted(T).filter(isLive);
  const i = live.findIndex((f) => f.id === fieldId);
  if (i < 0) refuse('That field is retired or no longer exists. Reload to see the latest.');
  const j = i + by;
  if (j < 0 || j >= live.length) return null;
  const a = live[i], b = live[j];
  return { fields: [{ ...a, position: b.position }, { ...b, position: a.position }], fieldValues: [], history: [entry(ctx, `${a.name} moved ${by < 0 ? 'up' : 'down'}`, { kind: 'field', fieldId })] };
}

export function retireField(ctx, { fieldId }) {
  const T = tablesOf(ctx.W);
  if (!ctx.actor.admin) refuse(ADMIN_ONLY);
  const f = fieldOf(T, fieldId);
  if (!f) refuse('That field no longer exists. Reload to see the latest.');
  if (!isLive(f)) refuse(`${f.name} is already retired.`);
  return { fields: [{ ...f, retiredAt: ctx.now, retiredBy: ctx.actor.id }], fieldValues: [], history: [entry(ctx, `${f.name} retired`, { kind: 'field', fieldId })] };
}

export function bringBackField(ctx, { fieldId }) {
  const T = tablesOf(ctx.W);
  if (!ctx.actor.admin) refuse(ADMIN_ONLY);
  const f = fieldOf(T, fieldId);
  if (!f) refuse('That field no longer exists. Reload to see the latest.');
  if (isLive(f)) refuse(`${f.name} isn’t retired.`);
  const back = { ...f, retiredAt: null, retiredBy: null };
  const p = fieldProblem(back, T.fields);
  if (p) refuse(p);
  return { fields: [back], fieldValues: [], history: [entry(ctx, `${f.name} brought back`, { kind: 'field', fieldId })] };
}

/** values: field id → typed value. Every value is checked before any is saved. */
export function setGoalFields(ctx, { goalId, values }) {
  const T = tablesOf(ctx.W);
  const goal = ctx.W.goals.find((g) => g.id === goalId && !g.removedAt);
  if (!goal) refuse('That goal no longer exists. Reload to see the latest.');
  if (!(ctx.actor.admin || goal.ownerId === ctx.actor.id)) refuse('Only the goal’s owner or an admin can change its fields.');
  const rows = [], history = [];
  for (const [fieldId, typed] of Object.entries(values)) {
    const f = fieldOf(T, fieldId);
    if (!f) refuse('That field no longer exists. Reload to see the latest.');
    if (!isLive(f)) refuse(`${f.name} is retired. An admin can bring it back in Workspace, Fields.`);
    const r = valueProblem(f, typed);
    if (r.problem) refuse(r.problem);
    const before = valueOf(ctx.W, goalId, fieldId);
    if (before === r.kept) continue;
    rows.push({ id: `${goalId}:${fieldId}`, goalId, fieldId, value: r.kept, setBy: ctx.actor.id, setAt: ctx.now });
    history.push(entry(ctx, `${f.name}: ${before || NOT_SET} → ${r.kept || NOT_SET}`, { kind: 'value', goalId, fieldId, diffs: [[f.name, before || NOT_SET, r.kept || NOT_SET]] }));
  }
  if (!rows.length) return null;
  return { fields: [], fieldValues: rows, history };
}
