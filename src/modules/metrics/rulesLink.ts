/* Rule 2's action: measuring a goal by a metric, for a slice and a part (MT2), and what it reads. Kept out of rules.ts
   so the first download (which loads rules.ts for the module's records) doesn't carry rule 2's checks and edit distance. */
import { heldByLink } from './rulesMeasured';
import type { ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import type { Goal } from '../../domain/types';
import { canLinkGoal, linkProblems, linksOf, live, log, metricRows, metricsOf, no, sliceName } from './rules';
import { forWords, linkChecks, type LinkReads } from './rulesParts';
import type { MetricLink } from './types';


/** Saving a metric, rule 1's Checks asked first, and rules 3 to 5 (MT3): loaded with linking, in one chunk (actions.ts). */
export { saveMetricAsked } from './rulesSave';
export { mergeMetrics, retireMetric, unretireMetric } from './rulesChange';
import { retiredWords } from './rulesChange';

/**
 * Measure a goal by a metric, for a slice: a team (teamId) or the whole company (null), and optionally one part of that
 * number (`part`, MT2: "tier-1 services"; empty for all of it). The goal's owner or an admin. Rule 2 (rulesParts.ts,
 * linkChecks) says what it asks: a Must fix refuses the link; a Check is said, not refused. On a goal with check-ins, a
 * change of metric, team or part needs `reason`, which the History entry then gives. Linking again with the same
 * metric, slice and part changes nothing (null); with another, it's changed and logged.
 */
export function linkGoalMetric(x: ActionContext, goal: Goal, metricId: string, teamId: string | null = null, part = '', reason = ''): Commit | null {
  // A goal being created in this save (it's in the snapshot the form passes, not yet in the workspace): whoever may
  // create it, for themselves or someone else, chooses what measures it in the same save.
  const creating = !!x.full && !x.full.goals.some((g) => g.id === goal.id) && x.snapshot.goals.some((g) => g.id === goal.id);
  if (!creating && !canLinkGoal(x.actor, goal)) no('Only the goal’s owner or an admin can choose what measures it.');
  const m = live(x, metricId);
  // A retired metric measures no new goal (rule 5); one it already measures keeps it.
  if (m.retiredAt && linksOf(x.full ?? x.snapshot).find((l) => l.id === goal.id && !l.removedAt)?.metricId !== m.id) no(retiredWords(m));
  if (teamId != null && !x.snapshot.teams.some((t) => t.id === teamId)) no('There’s no team with that ID. Leave the slice empty for the whole company.');
  const p = part.trim();
  const checks = linkChecks(goal, m, { teamId, part: p }, linkProblems(goal, m), linkReads(x, goal, m.id), reason);
  const fix = checks.filter((c) => c.kind === 'fix');
  if (fix.length) no(fix.map((c) => c.words).join(' '));
  const all = linksOf(x.full ?? x.snapshot);
  const old = all.find((l) => l.id === goal.id);
  const current = old && !old.removedAt ? old : undefined;
  if (current && current.metricId === m.id && current.teamId === teamId && (current.part ?? '').trim() === p) return null;
  const metricName = (id: string) => metricsOf(x.full ?? x.snapshot).find((v) => v.id === id)?.name ?? '—';
  // A part is written only when there is one, or when one is cleared (records.ts): a link that never had one names no column.
  const hadPart = !!(old?.part ?? '').trim();
  const link: MetricLink = { id: goal.id, goalId: goal.id, metricId: m.id, teamId, ...(p || hadPart ? { part: p } : {}), linkedBy: x.actor.id, linkedAt: x.now, removedAt: null, removedBy: null };
  const slice = sliceName(x.snapshot, teamId);
  const diffs = [
    ...(!current || current.metricId !== m.id ? [{ field: 'Measured by', from: current ? metricName(current.metricId) : '—', to: m.name }] : []),
    ...(!current || current.teamId !== teamId ? [{ field: 'Slice', from: current ? sliceName(x.snapshot, current.teamId) : '—', to: slice }] : []),
    ...((current?.part ?? '').trim() !== p ? [{ field: 'Which part', from: (current?.part ?? '').trim() || 'All of it', to: p || 'All of it' }] : []),
  ];
  const why = reason.trim();
  const summary = `Measured by “${m.name}” for ${forWords(slice, p)}${why ? `: ${why}` : ''}`;
  // MS: measured by a metric with a gap, the goal is held to no number; by one that's measured, to its plan.
  const hold = heldByLink(x, goal, m);
  return { ...metricRows({ metricLinks: [link] }), ...(hold ? { goals: [hold.goal] } : {}), changes: [log(x, { entityId: m.id, goalId: goal.id, action: current ? 'edited' : 'linked', summary, diffs }), ...(hold ? [hold.change] : [])] };
}

/** What rule 2 reads for a goal and a metric: its last link (removed or not), the metric's other live links on goals
    of the same cycle (with each goal's title, key and owner), whether the goal has check-ins, and slices in words. */
export function linkReads(x: Pick<ActionContext, 'snapshot' | 'full'> & Partial<Pick<ActionContext, 'cycle'>>, goal: Pick<Goal, 'id'> & Partial<Pick<Goal, 'cycleId'>>, metricId: string): LinkReads {
  const s = x.full ?? x.snapshot;
  // The goal's last link, removed or not: unlinking and then linking another way is a change too (#308's review).
  const present = linksOf(s).find((l) => l.id === goal.id);
  const goals = new Map(s.goals.map((g) => [g.id, g]));
  // Other goals in the goal's own cycle only, at every door: the tool reads the whole workspace, the form the cycle,
  // and last year's copy of a goal is not another goal on its number.
  const cycle = goal.cycleId ?? goals.get(goal.id)?.cycleId ?? x.cycle?.id;
  const others = linksOf(s).filter((l) => l.metricId === metricId && !l.removedAt && l.goalId !== goal.id).flatMap((l) => {
    const g = goals.get(l.goalId);
    if (!g || g.removedAt || g.stoppedAt || (cycle && g.cycleId !== cycle)) return [];
    return [{ goalId: l.goalId, teamId: l.teamId, part: l.part, title: g.title, key: g.key ?? g.id, ownerName: s.people.find((p) => p.id === g.ownerId)?.name ?? 'no owner' }];
  });
  return { present: present ? { metricId: present.metricId, teamId: present.teamId, part: present.part } : null, others, hasCheckIns: s.checkIns.some((c) => c.goalId === goal.id), sliceName: (t) => sliceName(x.snapshot, t) };
}
