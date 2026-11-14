/* Fields' changes (TG1, docs/design/round-4/tags/spec.md sections 2, 3 and 5): adding, renaming, reordering, retiring
   and bringing back a workspace's fields, and setting a goal's values. Each gives a commit for the change engine, with
   its History entries (entity `field`). Pure, as rules.ts is: it imports only src/domain and this folder. The app's
   actions (actions.ts), the AI tools (tools.ts) and the conformance rows all call these.

   Who may (section 3): admins define the fields; a goal's owner or an admin sets its values; everyone reads them. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { moduleRows, withModuleRows, type ModuleRows } from '../../domain/records';
import type { Change, Goal } from '../../domain/types';
import { fieldProblem, valueProblem } from './rules';
import type { GoalField, GoalFieldValue, SavedField } from './types';

export type { GoalFieldValue, SavedField } from './types';

/** The module's id, and the keys its records are filed under (records.ts). */
export const MODULE = 'tags';
export const FIELDS_KEY = 'fields';
export const VALUES_KEY = 'fieldValues';

type Rows = { modules?: ModuleRows } | null | undefined;
/** Every field in a workspace (or a commit), retired ones included, in their order. */
export const fieldsOf = (s: Rows): SavedField[] => [...moduleRows<SavedField>(s, MODULE, FIELDS_KEY)].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
/** The live fields, in their order: what a goal's page, the tools and the filters show. */
export const liveFields = (s: Rows): SavedField[] => fieldsOf(s).filter((f) => !f.retiredAt);
/** Every goal's value in a workspace (or a commit). */
export const valuesOf = (s: Rows): GoalFieldValue[] => moduleRows<GoalFieldValue>(s, MODULE, VALUES_KEY);
/** A commit's part for fields and values. */
export const fieldRows = (rows: { fields?: SavedField[]; fieldValues?: GoalFieldValue[] }): Pick<Commit, 'modules'> => withModuleRows(MODULE, { [FIELDS_KEY]: rows.fields, [VALUES_KEY]: rows.fieldValues });

export const valueId = (goalId: string, fieldId: string) => `${goalId}:${fieldId}`;
/** A goal's value for a field, or '' when it has none. */
export function valueOf(s: Rows, goalId: string, fieldId: string): string {
  const v = valuesOf(s).find((x) => x.id === valueId(goalId, fieldId));
  return v && !v.removedAt ? v.value : '';
}
/** How many of these goals have a value for a field. */
export function goalsWith(s: Rows, fieldId: string, goalIds: ReadonlySet<string>): number {
  return valuesOf(s).filter((v) => v.fieldId === fieldId && !v.removedAt && v.value && goalIds.has(v.goalId)).length;
}

/** A field's kind in words: “A list: Discover, Build, Run” or “Free text”. */
export const kindWords = (f: Pick<GoalField, 'kind' | 'options'>) => (f.kind === 'list' ? `A list: ${f.options.join(', ')}` : 'Free text');
/** A field by id, or a NotAllowed that says it has gone. */
export function fieldById(s: Rows, id: string): SavedField {
  const f = fieldsOf(s).find((x) => x.id === id);
  if (!f) throw new NotAllowed('That field no longer exists. Reload to see the latest.');
  return f;
}
/** A live field by its name, whatever the case, or null. */
export const fieldByName = (s: Rows, name: string): SavedField | null => liveFields(s).find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;

export const canDefineFields = (actor: ActionContext['actor']) => actor.admin;
export const canSetFields = (actor: ActionContext['actor'], g: Pick<Goal, 'ownerId'>) => actor.admin || g.ownerId === actor.id;

const no = (msg: string): never => { throw new NotAllowed(msg); };
const ADMINS = 'Only an admin can change the workspace’s fields.';
const log = (x: ActionContext, c: Omit<Change, 'id' | 'at' | 'actorId' | 'entity'>): Change => ({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, entity: 'field', ...c });
const tidy = (f: { name: string; kind: GoalField['kind']; options: string[] }) => ({ name: f.name.trim(), kind: f.kind, options: f.kind === 'list' ? f.options.map((o) => o.trim()) : [] });
const all = (x: ActionContext) => fieldsOf(x.full ?? x.snapshot);

/** What an admin types for a field: its name, its kind and a list's values. */
export interface FieldInput { name: string; kind: GoalField['kind']; options: string[] }

/** Add a field, after the others. “Stage added”. */
export function addField(x: ActionContext, input: FieldInput): Commit {
  if (!canDefineFields(x.actor)) no(ADMINS);
  const f = tidy(input);
  const fields = all(x);
  const field: SavedField = { id: x.newId('fld'), ...f, position: Math.max(-1, ...fields.map((v) => v.position)) + 1, createdBy: x.actor.id, createdAt: x.now, retiredAt: null, retiredBy: null };
  const problem = fieldProblem(field, fields);
  if (problem) no(problem);
  return { ...fieldRows({ fields: [field] }), changes: [log(x, { goalId: null, entityId: field.id, action: 'created', summary: `${field.name} added`, diffs: [{ field: 'Field', from: '—', to: field.name }, { field: 'Kind', from: '—', to: kindWords(field) }] })] };
}

/** Rename a field or change a list's values (its kind stays). Goals keep the values they hold. Null: nothing changed. */
export function changeField(x: ActionContext, id: string, input: Pick<FieldInput, 'name' | 'options'>): Commit | null {
  if (!canDefineFields(x.actor)) no(ADMINS);
  const was = fieldById(x.full ?? x.snapshot, id);
  const f = tidy({ ...input, kind: was.kind });
  const next: SavedField = { ...was, name: f.name, options: f.options };
  const problem = fieldProblem(next, all(x));
  if (problem) no(problem);
  const diffs = [
    ...(next.name !== was.name ? [{ field: 'Name', from: was.name, to: next.name }] : []),
    ...(next.options.join('\n') !== was.options.join('\n') ? [{ field: 'Values', from: was.options.join(', '), to: next.options.join(', ') }] : []),
  ];
  if (!diffs.length) return null;
  const summary = next.name !== was.name ? `${was.name} renamed ${next.name}` : `${next.name}’s values changed`;
  return { ...fieldRows({ fields: [next] }), changes: [log(x, { goalId: null, entityId: id, action: 'edited', summary, diffs })] };
}

/** Move a live field one place up (-1) or down (+1) among the live fields. Null: it is already first or last. */
export function moveField(x: ActionContext, id: string, by: -1 | 1): Commit | null {
  if (!canDefineFields(x.actor)) no(ADMINS);
  const live = liveFields(x.full ?? x.snapshot);
  const at = live.findIndex((f) => f.id === id);
  if (at < 0) no('That field is retired or no longer exists. Reload to see the latest.');
  const other = live[at + by];
  if (!other) return null;
  // Every live field numbered again in its new order, so two at the same position never swap back.
  const order = [...live];
  order.splice(at, 1);
  order.splice(at + by, 0, live[at]!);
  const moved = order.map((f, i) => ({ ...f, position: i })).filter((f, i) => live.find((v) => v.id === f.id)!.position !== i);
  return { ...fieldRows({ fields: moved }), changes: [log(x, { goalId: null, entityId: id, action: 'edited', summary: `${live[at]!.name} moved ${by < 0 ? 'up' : 'down'}`, diffs: [{ field: 'Order', from: live.map((f) => f.name).join(', '), to: order.map((f) => f.name).join(', ') }] })] };
}

/** Retire a field (Lane, 5a): it leaves goals' pages and the tools; every value stays, and it can be brought back. */
export function retireField(x: ActionContext, id: string): Commit {
  if (!canDefineFields(x.actor)) no(ADMINS);
  const f = fieldById(x.full ?? x.snapshot, id);
  if (f.retiredAt) no(`${f.name} is already retired.`);
  return { ...fieldRows({ fields: [{ ...f, retiredAt: x.now, retiredBy: x.actor.id }] }), changes: [log(x, { goalId: null, entityId: id, action: 'removed', summary: `${f.name} retired`, diffs: [{ field: 'Field', from: f.name, to: 'Retired' }] })] };
}

/** Bring a retired field back, with every value goals had, after the live ones. Refused when six are live, or when a
    live field has its name now. */
export function bringBackField(x: ActionContext, id: string): Commit {
  if (!canDefineFields(x.actor)) no(ADMINS);
  const fields = all(x);
  const f = fieldById(x.full ?? x.snapshot, id);
  if (!f.retiredAt) no(`${f.name} isn’t retired.`);
  const back: SavedField = { ...f, retiredAt: null, retiredBy: null, position: Math.max(-1, ...fields.filter((v) => !v.retiredAt).map((v) => v.position)) + 1 };
  const problem = fieldProblem(back, fields);
  if (problem) no(problem);
  return { ...fieldRows({ fields: [back] }), changes: [log(x, { goalId: null, entityId: id, action: 'restored', summary: `${f.name} brought back`, diffs: [{ field: 'Field', from: 'Retired', to: f.name }] })] };
}

/**
 * Set a goal's values (rule 2): `values` by field id, each as typed. A list's value is kept as the list writes it; empty
 * clears it. Every value is checked before anything is saved, so one refused value saves none. History says each
 * change on the goal, “Stage: Discover → Build”; no reason is asked (a field is not the plan). Null: nothing changed.
 */
export function setGoalFields(x: ActionContext, goal: Goal, values: Readonly<Record<string, string>>): Commit | null {
  if (!canSetFields(x.actor, goal)) no('Only the goal’s owner or an admin can change its fields.');
  const s = x.full ?? x.snapshot;
  const rows: GoalFieldValue[] = [];
  const changes: Change[] = [];
  for (const [fieldId, typed] of Object.entries(values)) {
    const f = fieldById(s, fieldId);
    if (f.retiredAt) no(`${f.name} is retired. An admin can bring it back in Workspace, Fields.`);
    const r = valueProblem(f, typed);
    if ('problem' in r) return no(r.problem);
    const from = valueOf(s, goal.id, f.id);
    if (from === r.value) continue;
    rows.push({ id: valueId(goal.id, f.id), goalId: goal.id, fieldId: f.id, value: r.value, setBy: x.actor.id, setAt: x.now, removedAt: null, removedBy: null });
    changes.push(log(x, { goalId: goal.id, entityId: f.id, action: 'edited', summary: `${f.name}: ${from || 'Not set'} → ${r.value || 'Not set'}`, diffs: [{ field: f.name, from: from || '—', to: r.value || '—' }] }));
  }
  return rows.length ? { ...fieldRows({ fieldValues: rows }), changes } : null;
}
