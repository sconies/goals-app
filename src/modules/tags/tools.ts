/* Fields' AI tools (TG1, docs/design/round-4/tags/spec.md 2.5): list the workspace's fields, set a goal's values, and,
   for an admin, define the fields (save_field, so an assistant can do whatever a person can: src/mcp/parity.test.ts).
   Every rule is the module's (rules.ts, fields.ts), so an assistant meets exactly the rules a person does, and every
   change is logged as that person, via the AI tool. While Fields is switched off in the workspace, the core's callTool
   refuses all three with the switched-off module's sentence. find_goals' `fields` filter is TG2's. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal, isKey } from '../../domain/goalKey';
import { VIA_MCP } from '../../domain/via';
import type { McpContext, ToolDef, ToolResult } from '../../mcp/tools';
import { listed } from '../../mcp/listed';
import { addField, bringBackField, canDefineFields, canSetFields, changeField, fieldById, fieldByName, fieldsOf, goalsWith, kindWords, liveFields, moveField, retireField, setGoalFields, valueOf } from './fields';
import { FIELD_LIMITS } from './rules';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const ax = (ctx: McpContext): ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, ...(ctx.allGoals ? { allGoals: ctx.allGoals } : {}), ...(ctx.full ? { full: ctx.full } : {}) });
const save = (ctx: McpContext, c: Commit) => ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA_MCP] })) });
/** A rule that says no is the assistant's to fix, so it reads as an error result, not a crash. */
async function ruled(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try { return await run(); } catch (e) { if (e instanceof NotAllowed) return { isError: true, text: e.message }; throw e; }
}
const goalOf = (ctx: McpContext, id: unknown) => {
  const g = findGoal(ctx.snapshot.goals, String(id ?? ''));
  if (!g) throw new NotAllowed(`There’s no live goal with ${isKey(String(id ?? '')) ? 'key' : 'ID'} ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs and keys.`);
  return g;
};
const names = (ctx: McpContext) => liveFields(ctx.full ?? ctx.snapshot).map((f) => f.name).join(', ') || 'none yet';
/** A field by ID or name (a retired one too, by ID or name, for bringing it back). */
const fieldRef = (ctx: McpContext, ref: unknown) => {
  const s = ctx.full ?? ctx.snapshot;
  const t = String(ref ?? '').trim().toLowerCase();
  const f = fieldsOf(s).find((x) => x.id === ref) ?? fieldByName(s, t) ?? fieldsOf(s).find((x) => x.name.trim().toLowerCase() === t);
  if (!t || !f) throw new NotAllowed(`There’s no field called or with the ID ${String(ref)}. Fields: ${names(ctx)}. Use list_fields.`);
  return f;
};

const tools: ToolDef[] = [
  {
    name: 'list_fields',
    title: 'The workspace’s fields',
    description: `The workspace’s own fields on goals (up to ${FIELD_LIMITS.fields}, such as a stage or a programme): each a list of values or free text, in order, with how many of this cycle’s goals have a value. With goal_id, that goal’s value for each. Retired fields are listed apart: their values are kept, and an admin can bring them back. No rule reads a field: they are for finding and sorting.`,
    inputSchema: { type: 'object', additionalProperties: false, properties: { goal_id: str('A goal’s ID or key (G-12), to give its values too.') } },
    annotations: READ,
    async run(a, ctx) {
      return ruled(async () => {
        const s = ctx.full ?? ctx.snapshot;
        const goal = a.goal_id != null ? goalOf(ctx, a.goal_id) : null;
        const ids = new Set(ctx.snapshot.goals.filter((g) => !g.removedAt).map((g) => g.id));
        const row = (f: ReturnType<typeof fieldsOf>[number]) => ({ id: f.id, name: f.name, kind: f.kind, kindLabel: kindWords(f), values: f.kind === 'list' ? f.options : [], goalsWithAValue: goalsWith(s, f.id, ids) });
        return listed({
          fields: liveFields(s).map((f) => ({ ...row(f), ...(goal ? { goalValue: valueOf(s, goal.id, f.id) || null } : {}) })),
          retired: fieldsOf(s).filter((f) => f.retiredAt).map(row),
          ...(goal ? { goal: { id: goal.id, title: goal.title, youCanChange: canSetFields(ctx.actor, goal) } } : {}),
          youCanDefine: canDefineFields(ctx.actor),
        });
      });
    },
  },
  {
    name: 'set_goal_fields',
    title: 'Set a goal’s fields',
    description: 'Set a goal’s values for the workspace’s fields, by field name: { "Stage": "Build" }. A list field takes one of its values (any case; kept as the list writes it); free text up to 80 characters; an empty string clears it. The goal’s owner or an admin. A value a list doesn’t hold is refused with the list’s values: ask the person, or an admin can add it with save_field. Every value is checked before any is saved. With dry_run, nothing is saved: it says what would change.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'fields'], properties: {
      goal_id: str('The goal’s ID or key (G-12).'),
      fields: { type: 'object', description: 'Field name to value, e.g. { "Stage": "Build" }; "" clears it.', additionalProperties: { type: 'string' } },
      dry_run: { type: 'boolean', description: 'Say what would change without saving anything.' },
    } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const goal = goalOf(ctx, a.goal_id);
        const given = (a.fields && typeof a.fields === 'object' ? a.fields : {}) as Record<string, unknown>;
        if (!Object.keys(given).length) throw new NotAllowed(`Give at least one field, by name. Fields: ${names(ctx)}.`);
        const values: Record<string, string> = {};
        for (const [name, v] of Object.entries(given)) {
          const f = fieldByName(ctx.full ?? ctx.snapshot, name);
          if (!f) throw new NotAllowed(`There’s no field called ${name}. Fields: ${names(ctx)}.`);
          values[f.id] = v == null ? '' : String(v);
        }
        const c = setGoalFields(ax(ctx), goal, values);
        const changes = (c?.changes ?? []).map((x) => x.summary);
        if (a.dry_run === true) return { text: changes.length ? `Would change on ${goal.title}: ${changes.join('; ')}. Nothing was saved.` : 'Nothing would change.', data: { saved: false, changes } };
        if (!c) return { text: 'Nothing changed: the goal already has those values.', data: { saved: false, changes } };
        await save(ctx, c);
        return { text: `${changes.join('; ')} on ${goal.title} (as ${ctx.actor.name}).`, data: { saved: true, changes } };
      });
    },
  },
  {
    name: 'save_field',
    title: 'Define a field',
    description: `Admins: add a field (name, kind "list" with values, or "text"), rename one or change a list’s values (field and name or values), move it up or down (move), retire it (retire: true; its values are kept and it leaves goals’ pages) or bring a retired one back (bring_back: true). At most ${FIELD_LIMITS.fields} live fields; a name of up to ${FIELD_LIMITS.name} characters; a list holds 1 to ${FIELD_LIMITS.values} values of up to ${FIELD_LIMITS.option} characters, none twice; free text has none.`,
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      field: str('The field to change, by ID or name. Leave out to add one.'),
      name: str('Its name, e.g. Stage.'),
      kind: str('For a new field: a list of values, or free text.', { enum: ['list', 'text'] }),
      values: { type: 'array', items: { type: 'string' }, description: 'A list’s values, in order.' },
      move: str('Move it one place.', { enum: ['up', 'down'] }),
      retire: { type: 'boolean', description: 'Retire it: its values stay on goals and in History.' },
      bring_back: { type: 'boolean', description: 'Bring a retired field back, with its values.' },
    } },
    annotations: { ...WRITE, idempotentHint: false },
    async run(a, ctx) {
      return ruled(async () => {
        const x = ax(ctx);
        const vals = Array.isArray(a.values) ? a.values.map(String) : undefined;
        let c: Commit | null;
        if (a.field == null) {
          c = addField(x, { name: String(a.name ?? ''), kind: a.kind === 'text' ? 'text' : 'list', options: vals ?? [] });
        } else {
          const f = fieldRef(ctx, a.field);
          if (a.retire === true) c = retireField(x, f.id);
          else if (a.bring_back === true) c = bringBackField(x, f.id);
          else if (a.move === 'up' || a.move === 'down') c = moveField(x, f.id, a.move === 'up' ? -1 : 1);
          else c = changeField(x, f.id, { name: a.name != null ? String(a.name) : fieldById(ctx.full ?? ctx.snapshot, f.id).name, options: vals ?? f.options });
        }
        if (!c) return { text: 'Nothing changed.' };
        await save(ctx, c);
        return { text: `${c.changes[0]!.summary} (as ${ctx.actor.name}).` };
      });
    },
  },
];

export default tools;
