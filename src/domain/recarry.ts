/* Keeping a carried copy true after the start (cycle-end rule 6): the part of starting the next year that runs on every
   check-in and wrap-up, apart from the start page's words (domain/startYear) so it stays small. Pure. */
import { carries, carryCopy, carryExtras, carryKind } from './carry';
import type { Commit } from './commit';
import { laterCycle } from './cycle';
import type { Ask, Change, CheckIn, Cycle, Goal, MetricLink, Retro, Review, Watch } from './types';

/** The rows recarry reads: the cycles, goals, check-ins, change log and wrap-ups, and what comes with a goal. */
export interface CarryRows { cycles: Cycle[]; goals: Goal[]; checkIns: CheckIn[]; changes: Change[]; retros?: Retro[]; watches?: Watch[]; requests?: Ask[]; reviews?: Review[]; metricLinks?: MetricLink[] }

/**
 * Keeps a carried copy true after the start (cycle-end rule 6): when a goal of a year that has a later cycle gets a
 * check-in or a wrap-up, its kind is worked out again and, **only while its copy is untouched** (no check-in in it, no
 * change to it by a person since the start), the copy's plan or stages are replaced, the copy and what came with it are
 * removed (it now finishes or stops), or a copy is added with what comes with it (it now carries on). Nothing when the
 * copy has been used, or there is no later cycle. `extra` is what the change is about to save.
 */
export function recarry(goal: Goal, full: CarryRows, extra: { checkIns?: CheckIn[]; retro?: Retro | null }, x: { now: string; actorId: string; newId: (p: string) => string }): Commit | null {
  const cycle = full.cycles.find((c) => c.id === goal.cycleId);
  const later = cycle && laterCycle(full.cycles, cycle);
  if (!cycle || !later || !goal.key) return null;
  const copy = full.goals.find((g) => g.cycleId === later.id && g.key === goal.key && !g.removedAt);
  if (copy && !copyUntouched(copy, full)) return null;
  const checkIns = [...full.checkIns.filter((c) => !c.removedAt && !(extra.checkIns ?? []).some((e) => e.id === c.id)), ...(extra.checkIns ?? [])];
  const retro = extra.retro !== undefined ? extra.retro : (full.retros ?? []).find((r) => r.goalId === goal.id && r.cycleId === cycle.id) ?? null;
  const kind = carryKind(goal, { cycle, checkIns, retro }).kind;
  const log = (summary: string, id: string) => ({ id: x.newId('chg'), at: x.now, actorId: x.actorId, goalId: id, entity: 'goal' as const, entityId: id, action: 'edited' as const, summary, diffs: [] });
  if (carries(kind)) {
    const parentCopy = goal.parentId ? full.goals.find((g) => g.cycleId === later.id && !g.removedAt && g.key && g.key === full.goals.find((p) => p.id === goal.parentId)?.key) : undefined;
    const id = copy?.id ?? x.newId('goal');
    const made = carryCopy(goal, { old: cycle, next: later, checkIns, id, parentId: copy ? copy.parentId : parentCopy?.id ?? null, now: copy?.createdAt ?? x.now });
    if (copy) {
      if (JSON.stringify(sansVersion(made)) === JSON.stringify(sansVersion(copy))) return null;
      return { goals: [{ ...made, version: copy.version }], changes: [log(`${goal.title} in ${later.name} now starts from ${cycle.name}’s final number`, id)] };
    }
    const extras = carryExtras(new Map([[goal.id, id]]), full, x.newId);
    return { goals: [made], metricLinks: extras.metricLinks, watches: extras.watches, requests: extras.requests, reviews: extras.reviews, changes: [log(`${goal.title} carries on into ${later.name}`, id)] };
  }
  if (!copy) return null;
  const gone = { removedAt: x.now, removedBy: x.actorId };
  return {
    goals: [{ ...copy, ...gone }],
    watches: (full.watches ?? []).filter((w) => w.ref === copy.id && !w.removedAt).map((w) => ({ ...w, ...gone })),
    metricLinks: (full.metricLinks ?? []).filter((l) => l.goalId === copy.id && !l.removedAt).map((l) => ({ ...l, ...gone })),
    requests: (full.requests ?? []).filter((r) => r.goalIds.includes(copy.id)).map((r) => ({ ...r, goalIds: r.goalIds.filter((g) => g !== copy.id) })),
    reviews: (full.reviews ?? []).filter((r) => r.scope.goals.includes(copy.id) || r.scope.trees.includes(copy.id)).map((r) => ({ ...r, scope: { ...r.scope, goals: r.scope.goals.filter((g) => g !== copy.id), trees: r.scope.trees.filter((g) => g !== copy.id) } })),
    changes: [log(`${goal.title} ${kind === 'stop' ? 'stops' : 'finishes'} in ${cycle.name}, so it left ${later.name}`, copy.id)],
  };
}

/** A change recarry made on its own (not a person's), so it doesn't count as using the copy. */
export const byRecarry = (summary: string) => /now starts from .*’s final number$|carries on into /.test(summary);

const sansVersion = (g: Goal) => ({ ...g, version: undefined, createdAt: undefined });

/** Whether a carried copy is as the start made it: no check-in in it and no change to it by a person since. */
export function copyUntouched(copy: Goal, full: { checkIns: Pick<CheckIn, 'goalId' | 'removedAt'>[]; changes: Pick<Change, 'goalId' | 'at' | 'summary'>[] }): boolean {
  if (full.checkIns.some((c) => c.goalId === copy.id && !c.removedAt)) return false;
  return !full.changes.some((c) => c.goalId === copy.id && c.at > copy.createdAt && !byRecarry(c.summary));
}
