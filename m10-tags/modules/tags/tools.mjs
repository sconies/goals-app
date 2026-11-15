// Fields' AI tools (spec/core/tools.md: list_fields, set_goal_fields, save_field) and find_goals' fields filter.
// ctx: { W, actor: { id, admin, name }, now, wsName, apply(commit) } — apply saves the commit and logs its History.
import { addField, changeField, moveField, retireField, bringBackField, setGoalFields, liveFields, retiredFields, valueOf, Refused } from './fields.mjs';
import { tablesOf } from './records.mjs';
import { valueProblem, NOT_SET, isLive } from './rules.mjs';
import { pickedOf } from './filter.mjs';

const refuse = (m) => { throw new Refused(m); };
const low = (s) => String(s ?? '').trim().toLowerCase();
const Q = (s) => `“${s}”`;
const names = (W) => liveFields(W).map((f) => f.name).join(', ') || 'none yet';
const goalBy = (W, ref) => W.goals.find((g) => !g.removedAt && (g.id === ref || low(g.key) === low(ref) || low(g.key).replace(/-/g, '') === low(ref).replace(/-/g, '')));
const noGoal = (ctx, ref) => refuse(`There’s no live goal with ID or key ${Q(ref)} in ${ctx.wsName}. Use find_goals to get IDs and keys.`);
const describe = (f) => (f.kind === 'list' ? `a list: ${f.options.join(', ')}` : 'free text');
const usedBy = (W, f) => tablesOf(W).fieldValues.filter((v) => v.fieldId === f.id && !v.removedAt && v.value && W.goals.some((g) => g.id === v.goalId && !g.removedAt && !g.stoppedAt)).length;

export const TOOLS = [
  { name: 'list_fields', title: 'The workspace’s fields', kind: 'reads', inputSchema: { type: 'object', additionalProperties: false, properties: { goal_id: { type: 'string' } } } },
  { name: 'set_goal_fields', title: 'Set a goal’s fields', kind: 'changes', inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'fields'], properties: { goal_id: { type: 'string' }, fields: { type: 'object' }, dry_run: { type: 'boolean' } } } },
  { name: 'save_field', title: 'Define a field', kind: 'changes', inputSchema: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, name: { type: 'string' }, kind: { enum: ['list', 'text'] }, values: { type: 'array', items: { type: 'string' } }, move: { enum: ['up', 'down'] }, retire: { type: 'boolean' }, bring_back: { type: 'boolean' } } } },
];

export function list_fields(ctx, args = {}) {
  const { W } = ctx;
  const goal = args.goal_id ? goalBy(W, args.goal_id) || noGoal(ctx, args.goal_id) : null;
  const row = (f) => ({ id: f.id, name: f.name, kind: f.kind, values: f.options, goals: usedBy(W, f), ...(goal ? { value: valueOf(W, goal.id, f.id) || null } : {}) });
  const live = liveFields(W).map(row), retired = retiredFields(W).map(row);
  const text = live.length ? live.map((f) => `${f.name}: ${f.kind === 'list' ? `a list: ${f.values.join(', ')}` : 'free text'}; ${f.goals} goals have a value${goal ? `; ${goal.key}: ${f.value ?? NOT_SET}` : ''}.`).join('\n') : 'No fields yet.';
  return { text: text + (retired.length ? `\nRetired: ${retired.map((f) => f.name).join(', ')}.` : ''), data: { fields: live, retired } };
}

export function set_goal_fields(ctx, args = {}) {
  const { W } = ctx;
  const goal = goalBy(W, args.goal_id) || noGoal(ctx, args.goal_id);
  const given = Object.entries(args.fields || {});
  if (!given.length) refuse(`Give at least one field, by name. Fields: ${names(W)}.`);
  const values = {};
  for (const [name, v] of given) {
    const f = tablesOf(W).fields.filter((x) => low(x.name) === low(name)).sort((a, b) => (isLive(a) ? -1 : 1))[0];
    if (!f) refuse(`There’s no field called ${Q(name)}. Fields: ${names(W)}.`);
    values[f.id] = String(v ?? '');
  }
  const commit = setGoalFields({ ...ctx, via: 'MCP' }, { goalId: goal.id, values });
  const said = commit ? commit.history.map((h) => h.what).join('; ') : 'Nothing would change.';
  if (args.dry_run) return { text: commit ? `Would change ${goal.key}: ${said}. Nothing was saved.` : `Nothing would change on ${goal.key}.`, data: { dryRun: true, changes: commit ? commit.history.map((h) => h.what) : [] } };
  if (commit) ctx.apply(commit);
  return { text: commit ? `Saved on ${goal.key}: ${said}.` : `Nothing changed on ${goal.key}.`, data: { changes: commit ? commit.history.map((h) => h.what) : [] } };
}

export function save_field(ctx, args = {}) {
  const { W } = ctx;
  const c = { ...ctx, via: 'MCP' };
  let commit;
  if (args.field === undefined) {
    commit = addField(c, { name: args.name, kind: args.kind || (args.values ? 'list' : 'text'), options: args.values || [] });
  } else {
    const T = tablesOf(W);
    const f = T.fields.find((x) => x.id === args.field) || T.fields.filter((x) => low(x.name) === low(args.field)).sort((a) => (isLive(a) ? -1 : 1))[0];
    if (!f) refuse(`There’s no field called or with the ID ${Q(args.field)}. Fields: ${names(W)}. Use list_fields.`);
    if (args.retire) commit = retireField(c, { fieldId: f.id });
    else if (args.bring_back) commit = bringBackField(c, { fieldId: f.id });
    else if (args.move) commit = moveField(c, { fieldId: f.id, by: args.move === 'up' ? -1 : 1 });
    else commit = changeField(c, { fieldId: f.id, name: args.name, options: args.values });
  }
  if (!commit) return { text: 'Nothing changed.', data: { changed: false } };
  ctx.apply(commit);
  const f = commit.fields[0];
  return { text: `${commit.history.map((h) => h.what).join('; ')}. ${f.name} is ${describe(f)}.`, data: { changed: true, field: { id: f.id, name: f.name, kind: f.kind, values: f.options } } };
}

/** find_goals' fields argument → the filters it makes, by field id; refused in words. */
export function fieldsFilter(W, arg) {
  const out = [];
  for (const [name, text] of Object.entries(arg || {})) {
    const f = liveFields(W).find((x) => low(x.name) === low(name));
    if (!f) refuse(`There’s no field called ${Q(name)}. Fields: ${names(W)}.`);
    if (f.kind !== 'list') refuse(`${f.name} is free text, which can’t filter. Filter by a list field: ${liveFields(W).filter((x) => x.kind === 'list').map((x) => x.name).join(', ') || 'none yet'}.`);
    const typed = String(text ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const picked = pickedOf(f, String(text ?? ''));
    for (const t of typed) if (low(t) !== low(NOT_SET) && !picked.some((p) => low(p) === low(t)) && !picked.some((p) => p.includes(','))) { const r = valueProblem(f, t); if (r.problem) refuse(r.problem); }
    out.push({ field: f, picked });
  }
  return out;
}
