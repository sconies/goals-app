/* The metric library's actions (AS part 2): registered in the dispatcher's table (app/actions.ts, through the module
   registry), so a screen runs them as it runs any other, `app.run('saveMetric', input)`, and app state carries no method
   for them. Each turns an input that names records by id into a call of the module's rule (rules.ts), unchanged.

   | Action             | Input                                   | Gives back                       |
   |--------------------|-----------------------------------------|----------------------------------|
   | `saveMetric`       | `MetricInput & { id?, confirm?, answers? }` | `{ commit, metric }`; refused while a Check is open; a change with Undo |
   | `removeMetric`     | `{ metricId }`                          | the commit; says so, with Undo; refused once used |
   | `retireMetric`     | `{ metricId, why, replacedBy? }`        | the commit; with Undo (MT3)      |
   | `unretireMetric`   | `{ metricId }`                          | the commit; with Undo            |
   | `mergeMetrics`     | `{ fromId, intoId, why? }`              | the commit; with Undo (admins)   |
   | `linkGoalMetric`   | `{ goalId, metricId, teamId, part?, reason? }` | the commit, or null (no change)  |
   | `unlinkGoalMetric` | `{ goalId }`                            | the commit, or null; with Undo   | */
import type { ModuleAction, ModuleActions, RunContext } from '../../app/actions';
import { NotAllowed } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal } from '../../domain/goalKey';
import type { Goal } from '../../domain/types';
import { removeMetric, unlinkGoalMetric, type Metric } from './rules';
import type { SaveMetricInput } from './rulesSave';
/* Rule 2's checks (rulesLink.ts, rulesParts.ts) load on the first link, not with the first download; rule 1's Checks
   (rulesSave.ts), which rulesLink.ts passes on, come in the same chunk on the first save. */
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
  // A change offers Undo, which takes back its marks and a relabel's goal units with it (MT3); adding one says its own.
  saveMetric: { ready: loadLink, run: (x, i: SaveMetricInput) => link().saveMetricAsked(x, i), said: (o, i) => (i.id && o.commit ? o.commit.changes[0]!.summary : ''), tools: ['save_metric'] } satisfies ModuleAction<SaveMetricInput, { commit: Commit | null; metric: Metric }>,
  removeMetric: { run: (x, i: { metricId: string }) => removeMetric(x, i.metricId), said, tools: ['remove_metric', 'restore_removed'] } satisfies ModuleAction<{ metricId: string }, Commit>,
  linkGoalMetric: { ready: loadLink, run: (x, i: LinkInput) => link().linkGoalMetric(x, goalOf(x, i.goalId), i.metricId, i.teamId, i.part ?? '', i.reason ?? ''), tools: ['link_goal_metric'] } satisfies ModuleAction<LinkInput, Commit | null>,
  unlinkGoalMetric: { run: (x, i: { goalId: string }) => unlinkGoalMetric(x, goalOf(x, i.goalId)), said, tools: ['link_goal_metric'] } satisfies ModuleAction<{ goalId: string }, Commit | null>,
  retireMetric: { ready: loadLink, run: (x, i: { metricId: string; why: string; replacedBy?: string | null }) => link().retireMetric(x, i.metricId, i.why, i.replacedBy ?? null), said, tools: ['retire_metric'] } satisfies ModuleAction<{ metricId: string; why: string; replacedBy?: string | null }, Commit>,
  unretireMetric: { ready: loadLink, run: (x, i: { metricId: string }) => link().unretireMetric(x, i.metricId), said, tools: ['retire_metric'] } satisfies ModuleAction<{ metricId: string }, Commit>,
  mergeMetrics: { ready: loadLink, run: (x, i: { fromId: string; intoId: string; why?: string }) => link().mergeMetrics(x, i.fromId, i.intoId, i.why ?? ''), said, tools: ['merge_metrics'] } satisfies ModuleAction<{ fromId: string; intoId: string; why?: string }, Commit>,
} satisfies ModuleActions;

export default actions;
