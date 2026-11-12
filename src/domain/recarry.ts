/* Keeping a carried copy true after the start (cycle-end rule 6): run after every save, by the app (app/state commit)
   and the AI tools (the MCP server's save); domain/copies holds the two tests other rules need. Pure. */
import { carries, carryCopy, carryExtras, carryKind } from './carry';
import type { Commit } from './commit';
import { laterCycle } from './cycle';
import type { Ask, Change, CheckIn, Cycle, Goal, Retro, Review, Watch } from './types';
import { hasModuleRows, rowsLeaving, type ModuleRecords, type ModuleRows } from './records';
import { copyUntouched } from './copies';
import { mergeCommits } from './actions';

/** The rows recarry reads: the cycles, goals, check-ins, change log and wrap-ups, and what comes with a goal. */
export interface CarryRows { cycles: Cycle[]; goals: Goal[]; checkIns: CheckIn[]; changes: Change[]; retros?: Retro[]; watches?: Watch[]; requests?: Ask[]; reviews?: Review[]; modules?: ModuleRows }

/**
 * Keeps a carried copy true after the start (cycle-end rule 6): when a goal of a year that has a later cycle changes
 * (a check-in, a wrap-up, its plan, stopped, removed or back), its kind is worked out again and, **only while its copy
 * is untouched** (no check-in in it, no change to it by a person since the start), the copy's plan or stages are
 * replaced, the copy and what came with it leave (it now finishes or stops; its children's copies lose it as parent),
 * or the copy comes back (the one taken out, same ID and key) or is added, with what comes with it and its children's
 * copies under it again. Nothing when the copy has been used, a person removed it, or there is no later cycle. `extra`
 * is what the change is about to save.
 */
export function recarry(goal: Goal, full: CarryRows, extra: { checkIns?: CheckIn[]; retro?: Retro | null }, x: { now: string; actorId: string; newId: (p: string) => string; records?: readonly ModuleRecords[] }): Commit | null {
  const cycle = full.cycles.find((c) => c.id === goal.cycleId);
  const later = cycle && laterCycle(full.cycles, cycle);
  if (!cycle || !later || !goal.key) return null;
  const copies = full.goals.filter((g) => g.cycleId === later.id && g.key === goal.key);
  const live = copies.find((g) => !g.removedAt);
  // A copy recarry took out comes back as it was; one a person removed stays removed.
  const left = live ? undefined : copies.filter((g) => g.removedAt && leftByRecarry(g, full)).sort((a, b) => (b.removedAt ?? '').localeCompare(a.removedAt ?? ''))[0];
  if (live && !copyUntouched(live, full)) return null;
  if (!live && copies.length && !left) return null;
  const extraIds = new Set((extra.checkIns ?? []).map((c) => c.id));
  const checkIns = [...full.checkIns.filter((c) => !extraIds.has(c.id)), ...(extra.checkIns ?? [])].filter((c) => !c.removedAt);
  const retro = extra.retro !== undefined ? extra.retro : (full.retros ?? []).find((r) => r.goalId === goal.id && r.cycleId === cycle.id) ?? null;
  // A goal stopped or removed in its own year leaves the next with it; brought back, it carries again.
  const kind = goal.stoppedAt || goal.removedAt ? 'stop' : carryKind(goal, { cycle, checkIns, retro }).kind;
  const log = (summary: string, id: string) => ({ id: x.newId('chg'), at: x.now, actorId: x.actorId, goalId: id, entity: 'goal' as const, entityId: id, action: 'edited' as const, summary, diffs: [] });
  const keyOf = (id: string | null | undefined) => (id ? full.goals.find((g) => g.id === id)?.key : undefined);
  const copyOf = (key: string | null | undefined) => (key ? full.goals.find((g) => g.cycleId === later.id && !g.removedAt && g.key === key) : undefined);
  if (carries(kind)) {
    const id = live?.id ?? left?.id ?? x.newId('goal');
    const helps = (goal.alsoHelps ?? []).map((h) => copyOf(keyOf(h))?.id).filter((h): h is string => !!h);
    const made = carryCopy(goal, { old: cycle, next: later, checkIns, id, parentId: live ? live.parentId : copyOf(keyOf(goal.parentId))?.id ?? null, now: live?.createdAt ?? left?.createdAt ?? x.now, alsoHelps: live ? live.alsoHelps ?? [] : helps });
    if (live) {
      if (sameCopy(made, live)) return null;
      return { goals: [{ ...made, version: live.version }], changes: [log(`${goal.title} in ${later.name} now starts from where it ended in ${cycle.name}`, id)] };
    }
    // Its children's copies that lost it as parent are under it again, with their effect.
    const children = full.goals.filter((c) => c.cycleId === later.id && !c.removedAt && !c.parentId && c.key).flatMap((c) => {
      const original = full.goals.find((o) => o.cycleId === cycle.id && o.key === c.key && o.parentId === goal.id);
      return original ? [{ ...c, parentId: id, effect: original.effect ?? null }] : [];
    });
    const extras = carryExtras(new Map([[goal.id, id]]), full, x.newId, x.records);
    return {
      goals: [left ? { ...made, version: left.version, removedAt: null, removedBy: null } : made, ...children],
      ...(hasModuleRows(extras.modules) ? { modules: extras.modules } : {}), watches: extras.watches, requests: extras.requests, reviews: extras.reviews,
      changes: [log(`${goal.title} carries on into ${later.name}${left ? ' again' : ''}`, id)],
    };
  }
  if (!live) return null;
  const gone = { removedAt: x.now, removedBy: x.actorId };
  const leaving = rowsLeaving(full.modules, new Set([live.id]), x.records ?? [], gone);
  // Its children's copies stay, with no parent and so no effect (rule 5's last row).
  const orphans = full.goals.filter((c) => c.cycleId === later.id && !c.removedAt && c.parentId === live.id).map((c) => ({ ...c, parentId: null, effect: null }));
  return {
    goals: [{ ...live, ...gone }, ...orphans],
    watches: (full.watches ?? []).filter((w) => w.ref === live.id && !w.removedAt).map((w) => ({ ...w, ...gone })),
    ...(hasModuleRows(leaving) ? { modules: leaving } : {}),
    requests: (full.requests ?? []).filter((r) => r.goalIds.includes(live.id)).map((r) => ({ ...r, goalIds: r.goalIds.filter((g) => g !== live.id) })),
    reviews: (full.reviews ?? []).filter((r) => r.scope.goals.includes(live.id) || r.scope.trees.includes(live.id)).map((r) => ({ ...r, scope: { ...r.scope, goals: r.scope.goals.filter((g) => g !== live.id), trees: r.scope.trees.filter((g) => g !== live.id) } })),
    changes: [log(`${goal.title} ${kind === 'stop' ? 'stops' : 'finishes'} in ${cycle.name}, so it left ${later.name}`, live.id)],
  };
}

/**
 * Keeps every carried copy true after any save (cycle-end rule 6), in one place for the app and the AI tools: for each
 * goal of a year that has a later cycle that the save touches (the goal itself, a check-in or a wrap-up), `recarry`
 * with what the save is about to write. A save that adds or removes a cycle (starting a year, its Undo) is left alone.
 */
export function withRecarry(full: CarryRows, c: Commit, x: { now: string; actorId: string; newId: (p: string) => string; records?: readonly ModuleRecords[] }): Commit {
  if (c.cycles?.length || !full.cycles.some((v) => !v.removedAt && laterCycle(full.cycles, v))) return c;
  const ids = new Set([...(c.goals ?? []).map((g) => g.id), ...(c.checkIns ?? []).map((ci) => ci.goalId), ...(c.retros ?? []).map((r) => r.goalId)]);
  let out = c;
  for (const id of ids) {
    const goal = (c.goals ?? []).find((g) => g.id === id) ?? full.goals.find((g) => g.id === id);
    if (!goal) continue;
    const retro = (c.retros ?? []).find((r) => r.goalId === id);
    const re = recarry(goal, full, { checkIns: (c.checkIns ?? []).filter((ci) => ci.goalId === id), ...(retro ? { retro } : {}) }, x);
    if (re) out = mergeCommits(out, re);
  }
  return out;
}

/** Whether a removed copy was taken out by recarry: its latest change says so. */
function leftByRecarry(g: Goal, full: { changes: Pick<Change, 'goalId' | 'at' | 'summary'>[] }): boolean {
  const last = full.changes.filter((c) => c.goalId === g.id).sort((a, b) => b.at.localeCompare(a.at))[0];
  return !!last && /, so it left /.test(last.summary);
}

/** Whether two copies say the same, whatever order their fields are in or how a store wrote an empty one. */
function sameCopy(a: Goal, b: Goal): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().filter((k) => !SKIP.has(k)).map((k) => [k, norm(o[k])]).filter(([, x]) => x != null && !(Array.isArray(x) && !x.length)));
    }
    return v;
  };
  const plain = (g: Goal) => (g.kind === 'metric' ? { ...g, plan: { ...g.plan, fromWeek: g.plan.fromWeek ?? 0 } } : g);
  return JSON.stringify(norm(plain(a))) === JSON.stringify(norm(plain(b)));
}
const SKIP = new Set(['version', 'createdAt', 'updatedAt']);
