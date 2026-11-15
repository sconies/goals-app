// What a new cycle carries of the library (records.md; journey U152): every metric not removed stays as it is, and each
// link in force to a goal that carries on is copied to the goal's copy, with the same metric, team and part.
// The core's start-next-year (not built in this core) would call it with its map of goal → copy.
import * as R from './rules.mjs';
export function carryLinks(W, copies, actor, at, { on = true } = {}) {
  if (!on) return [];
  return R.lib(W).metricLinks.filter((l) => !l.removedAt && copies.has(l.goalId)).map((l) => {
    const m = R.findMetric(W, l.metricId);
    if (!m || m.removedAt) return null;
    return { id: copies.get(l.goalId), goalId: copies.get(l.goalId), metricId: l.metricId, teamId: l.teamId ?? null, ...(l.part !== undefined ? { part: l.part } : {}), linkedBy: actor, linkedAt: at, removedAt: null, removedBy: null };
  }).filter(Boolean);
}
