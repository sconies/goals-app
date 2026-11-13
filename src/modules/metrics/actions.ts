/* The metric library's actions (AS part 2): registered in the dispatcher's table (app/actions.ts, through the module
   registry), so a screen runs them as it runs any other, `app.run('saveMetric', input)`, and app state carries no method
   for them. Each turns an input that names records by id into a call of the module's rule (rules.ts), unchanged.

   | Action             | Input                                   | Gives back                       |
   |--------------------|-----------------------------------------|----------------------------------|
   | `saveMetric`       | `MetricInput & { id? }`                 | `{ commit, metric }` (its id)    |
   | `removeMetric`     | `{ metricId }`                          | the commit; says so, with Undo   |
   | `linkGoalMetric`   | `{ goalId, metricId, teamId, part?, reason? }` | the commit, or null (no change)  |
   | `unlinkGoalMetric` | `{ goalId }`                            | the commit, or null; with Undo   | */
import type { ModuleAction, ModuleActions, RunContext } from '../../app/actions';
import { NotAllowed } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal } from '../../domain/goalKey';
import type { Goal } from '../../domain/types';
import { removeMetric, saveMetric, unlinkGoalMetric, type Metric, type MetricInput } from './rules';
/* Rule 2's checks (rulesLink.ts, rulesParts.ts) load on the first link, not with the first download. */
type Link = typeof import('./rulesLink');
let linking: Link | null = null;
const loadLink = async () => { linking ??= await import('./rulesLink'); };
const link = (): Link => { if (!linking) throw new Error('Linking hasn’t loaded yet: call ready() first.'); return linking; };

/** What linking takes: the goal, the metric, the slice (a team, or null for the company), and MT2's part and reason. */
type LinkInput = { goalId: string; metricId: string; teamId: string | null; part?: string; reason?: string };

const said = (c: Commit) => c.changes[0]!.summary;
/** A goal by id or key: this cycle's, then any cycle's, then one stopped (as the core's actions find one). */
const goalOf = (x: RunContext, id: string): Goal =>
  findGoal(x.snapshot.goals, id) ?? (x.allGoals && findGoal(x.allGoals, id)) ?? (x.snapshot.archive && findGoal(x.snapshot.archive.goals, id)) ?? (() => { throw new NotAllowed('That goal no longer exists. Reload to see the latest.'); })();

const actions = {
  saveMetric: { run: (x, i: MetricInput & { id?: string; confirm?: boolean }) => saveMetric(x, i), tools: ['save_metric'] } satisfies ModuleAction<MetricInput & { id?: string; confirm?: boolean }, { commit: Commit | null; metric: Metric }>,
  removeMetric: { run: (x, i: { metricId: string }) => removeMetric(x, i.metricId), said, tools: ['remove_metric', 'restore_removed'] } satisfies ModuleAction<{ metricId: string }, Commit>,
  linkGoalMetric: { ready: loadLink, run: (x, i: LinkInput) => link().linkGoalMetric(x, goalOf(x, i.goalId), i.metricId, i.teamId, i.part ?? '', i.reason ?? ''), tools: ['link_goal_metric'] } satisfies ModuleAction<LinkInput, Commit | null>,
  unlinkGoalMetric: { run: (x, i: { goalId: string }) => unlinkGoalMetric(x, goalOf(x, i.goalId)), said, tools: ['link_goal_metric'] } satisfies ModuleAction<{ goalId: string }, Commit | null>,
} satisfies ModuleActions;

export default actions;
