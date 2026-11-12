/* What the library's rules read (rulesLibrary.ts), made from the workspace as loaded: the module's own src/app/reads.ts
   (docs/design/architecture.md, 4.4). The screens, the AI tools and the conformance rows all make their rows here, so
   the rules read the same rows wherever they run. */
import { summariseAll } from '../../domain/summary';
import type { Cycle, Snapshot } from '../../domain/types';
import { linksOf, metricsOf } from './rules';
import { metricGoals, type LibraryReads, type MetricGoalRow } from './rulesLibrary';

/** The running cycle's live goals: not removed, not stopped. */
const liveGoals = (s: Pick<Snapshot, 'goals'>) => s.goals.filter((g) => !g.removedAt && !g.stoppedAt);

/** Rule 1's and rule 3's rows: every metric and link, the cycle's live goal ids, the people, and now. */
export function libraryReads(s: Snapshot, now: string): LibraryReads {
  return { metrics: metricsOf(s), links: linksOf(s), goalIds: new Set(liveGoals(s).map((g) => g.id)), people: s.people, now };
}

/** Rule 2 for one metric: its goals' summary rows (domain/summary), side by side. */
export function goalsOfMetric(s: Snapshot, cycle: Cycle, today: Date, week: number, metricId: string): MetricGoalRow[] {
  const links = linksOf(s).filter((l) => l.metricId === metricId && !l.removedAt);
  const ids = new Set(links.map((l) => l.goalId));
  const goals = liveGoals(s).filter((g) => ids.has(g.id));
  return metricGoals(metricId, links, summariseAll(goals, s, cycle, today, week), s.teams, cycle);
}
