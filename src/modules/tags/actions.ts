/* Fields' actions (TG1): registered in the dispatcher's table (app/actions.ts, through the module registry), so a screen
   runs them as any other, `app.run('addField', input)`. Each turns an input that names records by id into a call of
   the module's rule (fields.ts), unchanged. While Fields is switched off, the dispatcher refuses every one.

   | Action           | Input                             | Gives back                          |
   |------------------|-----------------------------------|-------------------------------------|
   | `addField`       | `{ name, kind, options }`         | the commit                          |
   | `changeField`    | `{ fieldId, name, options }`      | the commit, or null (no change)     |
   | `moveField`      | `{ fieldId, by: -1 or 1 }`        | the commit, or null (first or last) |
   | `retireField`    | `{ fieldId }`                     | the commit; with Undo               |
   | `bringBackField` | `{ fieldId }`                     | the commit                          |
   | `setGoalFields`  | `{ goalId, values: { fieldId: value } }` | the commit, or null (no change) | */
import type { ModuleAction, ModuleActions, RunContext } from '../../app/actions';
import { NotAllowed } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal } from '../../domain/goalKey';
import type { Goal } from '../../domain/types';
import type { FieldInput } from './fields';
/* The rules (fields.ts, rules.ts) load on the first change, not with the first download. */
type Fields = typeof import('./fields');
let loaded: Fields | null = null;
const ready = async () => { loaded ??= await import('./fields'); };
const F = (): Fields => { if (!loaded) throw new Error('Fields hasn’t loaded yet: call ready() first.'); return loaded; };

/** A goal by id or key: this cycle's, then any cycle's, then one stopped (as the core's actions find one). */
const goalOf = (x: RunContext, id: string): Goal =>
  findGoal(x.snapshot.goals, id) ?? (x.allGoals && findGoal(x.allGoals, id)) ?? (x.snapshot.archive && findGoal(x.snapshot.archive.goals, id)) ?? (() => { throw new NotAllowed('That goal no longer exists. Reload to see the latest.'); })();

const actions = {
  // The page says what each did in place, so no toast; retiring offers Undo, as the field's row was there before.
  addField: { ready, run: (x, i: FieldInput) => F().addField(x, i), said: () => '', tools: ['save_field'] } satisfies ModuleAction<FieldInput, Commit>,
  changeField: { ready, run: (x, i: { fieldId: string } & Pick<FieldInput, 'name' | 'options'>) => F().changeField(x, i.fieldId, i), said: () => '', wholeRecord: true, tools: ['save_field'] } satisfies ModuleAction<{ fieldId: string } & Pick<FieldInput, 'name' | 'options'>, Commit | null>,
  moveField: { ready, run: (x, i: { fieldId: string; by: -1 | 1 }) => F().moveField(x, i.fieldId, i.by), said: () => '', tools: ['save_field'] } satisfies ModuleAction<{ fieldId: string; by: -1 | 1 }, Commit | null>,
  retireField: { ready, run: (x, i: { fieldId: string }) => F().retireField(x, i.fieldId), said: (c) => c.changes[0]!.summary, confirmed: true, tools: ['save_field'] } satisfies ModuleAction<{ fieldId: string }, Commit>,
  bringBackField: { ready, run: (x, i: { fieldId: string }) => F().bringBackField(x, i.fieldId), said: () => '', tools: ['save_field'] } satisfies ModuleAction<{ fieldId: string }, Commit>,
  setGoalFields: { ready, run: (x, i: { goalId: string; values: Record<string, string> }) => F().setGoalFields(x, goalOf(x, i.goalId), i.values), said: () => '', tools: ['set_goal_fields'] } satisfies ModuleAction<{ goalId: string; values: Record<string, string> }, Commit | null>,
} satisfies ModuleActions;

export default actions;
