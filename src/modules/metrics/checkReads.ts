/* What rule 1's questions read, from the loaded workspace: apart from reads.ts so saving a metric (rulesSave.ts) loads
   it without the library's reads. Passed on by reads.ts. */
import type { Snapshot } from '../../domain/types';
import { linksOf, metricsOf } from './rules';
import { formerNames, type CheckReads } from './rulesDefine';

/** What rule 1's questions read (rulesDefine.ts `metricChecks`): metrics in use, the people, each metric's goals in force,
    and the names metrics used to have (the change log's renames). */
export function checkReads(s: Snapshot): CheckReads {
  const metrics = metricsOf(s).filter((m) => !m.removedAt);
  const goalIds = new Set(s.goals.filter((g) => !g.removedAt && !g.stoppedAt).map((g) => g.id));
  const links = linksOf(s).filter((l) => !l.removedAt && goalIds.has(l.goalId));
  return { metrics, people: s.people, goalsOf: (id) => links.filter((l) => l.metricId === id).length, former: formerNames(s.changes, metrics) };
}
