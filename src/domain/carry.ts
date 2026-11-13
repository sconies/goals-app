/* What happens to each goal when the next year starts (cycle-end spec, rules 5 and 7): it carries on, keeps its plan
   across the turn, finishes (it met its target) or stops (its owner said so at the wrap-up). One rule, read by the
   start page's read-back, by `nextCycle` and by the AI tools, so what the read-back says is what the start makes. */
import { assessMilestone, checkInsFor } from './status';
import { goalResult } from './story';
import type { Ask, CheckIn, Cycle, Goal, Retro, Review, Watch } from './types';
import { followCopies, type ModuleRecords, type ModuleRowIds, type ModuleRows } from './records';

/** What happens to one goal at the turn of the year. */
export type CarryKind = 'carry' | 'keep' | 'finish' | 'stop';

export interface CarryCtx {
  cycle: Pick<Cycle, 'weeks' | 'startDate' | 'name' | 'id' | 'reviewDay'>;
  /** This goal's check-ins (others are ignored). */
  checkIns: CheckIn[];
  /** This goal's wrap-up, or null. */
  retro: Retro | null;
}

/** The goal's last number at or before the cycle's last week, or its starting number (`none`) when it has none. */
export function finalNumber(goal: Goal, checkIns: CheckIn[], cycle: Pick<Cycle, 'weeks'>): { value: number | null; week: number | null; none: boolean } {
  const own = checkInsFor(goal, checkIns).filter((c) => c.value != null && c.week <= cycle.weeks);
  const last = own[own.length - 1];
  if (last) return { value: last.value!, week: last.week, none: false };
  return { value: goal.kind === 'metric' ? goal.plan.start : null, week: null, none: true };
}

/** Why a goal finishes, in words, or null when it doesn't. */
function finishes(goal: Goal, ctx: CarryCtx): string | null {
  const own = checkInsFor(goal, ctx.checkIns);
  if (own.some((c) => c.status === 'done')) return 'its owner called it done';
  if (goal.kind === 'range') return null; // A limit is kept every year: it carries on even when met.
  const r = goalResult(goal, ctx.cycle as Cycle, ctx.checkIns, ctx.cycle.weeks + 1);
  if (r && (r.kind === 'completed' || r.kind === 'late')) return r.kind === 'completed' ? 'it met its target' : 'it met its target late';
  if (goal.kind === 'metric') {
    const f = finalNumber(goal, ctx.checkIns, ctx.cycle);
    const up = goal.plan.target >= goal.plan.start;
    if (!f.none && f.value != null && (up ? f.value >= goal.plan.target : f.value <= goal.plan.target)) return 'its last number has reached the target';
  }
  if (goal.kind === 'milestone') {
    const last = own.filter((c) => c.stages).pop();
    const a = assessMilestone(goal, ctx.cycle.weeks, last?.stages ?? null);
    if (goal.stages.length && a.stages.every((s) => s.kind === 'done')) return 'every stage is done';
  }
  return null;
}

/**
 * What happens to one goal (rule 5), in this order: it **stops** when its owner said so at the wrap-up (unless it
 * finished anyway); a number goal whose plan runs past the year **keeps** its plan; it **finishes** when it met its
 * target, its last number reached it, every stage is done, or its owner called it done; otherwise it **carries** on.
 * A goal with a limit never finishes: a limit is kept every year.
 */
export function carryKind(goal: Goal, ctx: CarryCtx): { kind: CarryKind; why: string } {
  const fin = finishes(goal, ctx);
  if (ctx.retro?.next === 'stop' && !fin) return { kind: 'stop', why: 'its owner said to stop it at the wrap-up' };
  if (goal.kind === 'metric' && (goal.plan.endWeek ?? 0) > ctx.cycle.weeks) return { kind: 'keep', why: 'its plan runs past the end of the year' };
  if (fin) return { kind: 'finish', why: fin };
  return { kind: 'carry', why: 'it didn’t meet its target' };
}

/** Whether a goal goes into the next year: it carries on, or keeps its plan. */
export const carries = (k: CarryKind) => k === 'carry' || k === 'keep';

export interface ReadBackCtx {
  cycle: Cycle;
  /** The next year: its name, first day and weeks. */
  next: { name: string; firstDay: string; weeks: number };
  /** This year's live goals. */
  goals: Goal[];
  checkIns: CheckIn[];
  retros: Retro[];
}

export interface ReadBack {
  /** Each goal's kind, by id. */
  kinds: Map<string, CarryKind>;
  /** Wrapped up: carry on (keep included), of them keep their plan; finish; stop. */
  carry: number;
  keep: number;
  finish: number;
  stop: number;
  /** Not wrapped up yet: how many, and of them carry on as they are, and finish. */
  open: number;
  openCarry: number;
  openFinish: number;
  /** Every goal that goes into the next year. */
  carried: number;
  /** Goals with stages that carry, and the stages not done they take. */
  stageGoals: number;
  stagesLeft: number;
  /** Goals that carry but lose their “Feeds into” because the goal above finishes or stops. */
  loseParent: number;
  /** Number goals that carry with plan numbers set by hand. */
  handSet: number;
  /** The four counts always add up to this: the year's live goals. */
  total: number;
}

/**
 * The read-back before starting the next year (rule 7): every number from `carryKind` over the year's live goals, so
 * the page and the start agree by construction. The four counts (carry on, finish, stop, not wrapped up yet) always
 * add up to `total`.
 */
export function startReadBack(ctx: ReadBackCtx): ReadBack {
  const kinds = new Map<string, CarryKind>();
  const done = new Set(ctx.retros.filter((r) => r.cycleId === ctx.cycle.id).map((r) => r.goalId));
  for (const g of ctx.goals) {
    const retro = ctx.retros.find((r) => r.goalId === g.id && r.cycleId === ctx.cycle.id) ?? null;
    kinds.set(g.id, carryKind(g, { cycle: ctx.cycle, checkIns: ctx.checkIns, retro }).kind);
  }
  const of = (wrapped: boolean, ...ks: CarryKind[]) => ctx.goals.filter((g) => done.has(g.id) === wrapped && ks.includes(kinds.get(g.id)!)).length;
  const going = ctx.goals.filter((g) => carries(kinds.get(g.id)!));
  const stageGoals = going.filter((g) => g.kind === 'milestone');
  const stagesLeft = stageGoals.reduce((n, g) => {
    if (g.kind !== 'milestone') return n;
    const last = checkInsFor(g, ctx.checkIns).filter((c) => c.stages).pop();
    const a = assessMilestone(g, ctx.cycle.weeks, last?.stages ?? null);
    return n + g.stages.filter((_, i) => a.stages[i]?.kind !== 'done').length;
  }, 0);
  const ids = new Set(ctx.goals.map((g) => g.id));
  return {
    kinds,
    carry: of(true, 'carry', 'keep'),
    keep: of(true, 'keep'),
    finish: of(true, 'finish'),
    stop: of(true, 'stop'),
    open: ctx.goals.filter((g) => !done.has(g.id)).length,
    openCarry: of(false, 'carry', 'keep'),
    openFinish: of(false, 'finish'),
    carried: going.length,
    stageGoals: stageGoals.length,
    stagesLeft,
    loseParent: going.filter((g) => g.parentId && ids.has(g.parentId) && !carries(kinds.get(g.parentId)!)).length,
    handSet: going.filter((g) => g.kind === 'metric' && kinds.get(g.id) === 'carry' && !!g.plan.points?.length).length,
    total: ctx.goals.length,
  };
}

export interface CopyCtx {
  old: Pick<Cycle, 'weeks'>;
  next: Pick<Cycle, 'id' | 'weeks'>;
  checkIns: CheckIn[];
  /** The copy's id. */
  id: string;
  /** The parent's copy, when the parent carries too; otherwise null (and the copy loses its effect). */
  parentId: string | null;
  now: string;
  /** The copies of the goals it also helps, when they carry too (never the old year's). */
  alsoHelps?: string[];
}

/**
 * A goal's copy in the next year (rule 5): a new id, in the new cycle, made now, with its key and everything else as it
 * was. A number goal that **carries** starts from its final number in week 1 (\`fromWeek\` 0), with the same target
 * and shape, due at the end of the new year: no end week, no hand-set numbers, no earlier plans. One that **keeps** its
 * plan keeps its dates, counted from the new year's start. The copy was proposed in no review of the new year, so it
 * keeps no `proposedIn` (build review of #376). Stages not done are spread evenly over the new year
 * (\`round((i + 1) × weeks / n)\`, never after its last week). A limit is unchanged.
 */
export function carryCopy(g: Goal, ctx: CopyCtx): Goal {
  const base = { ...g, id: ctx.id, cycleId: ctx.next.id, parentId: ctx.parentId, alsoHelps: ctx.alsoHelps ?? [], createdAt: ctx.now, pending: null, ...(g.proposedIn ? { proposedIn: null } : {}) } as Goal;
  if (!base.parentId) base.effect = null;
  if (g.kind === 'metric' && (g.plan.endWeek ?? 0) > ctx.old.weeks) {
    const shift = (w: number) => w - ctx.old.weeks;
    const plan = { ...g.plan, fromWeek: shift(g.plan.fromWeek ?? 0), endWeek: shift(g.plan.endWeek!), ...(g.plan.points ? { points: g.plan.points.map((p) => ({ ...p, week: shift(p.week) })) } : {}) };
    return { ...base, kind: 'metric', plan, originalPlan: null, rebaselinedWeek: null, planHistory: undefined } as Goal;
  }
  if (g.kind === 'metric') {
    const f = finalNumber(g, ctx.checkIns, ctx.old);
    const plan = { start: f.value ?? g.plan.start, target: g.plan.target, shape: g.plan.shape, fromWeek: 0 };
    return { ...base, kind: 'metric', plan, originalPlan: null, rebaselinedWeek: null, planHistory: undefined } as Goal;
  }
  if (g.kind === 'milestone') {
    const last = checkInsFor(g, ctx.checkIns).filter((c) => c.stages).pop();
    const a = assessMilestone(g, ctx.old.weeks, last?.stages ?? null);
    const left = g.stages.filter((_, i) => a.stages[i]?.kind !== 'done');
    const stages = (left.length ? left : g.stages).map((st, i, arr) => ({ ...st, id: st.id + '-' + ctx.next.id, dueWeek: Math.max(1, Math.round(((i + 1) * ctx.next.weeks) / arr.length)) }));
    return { ...base, kind: 'milestone', stages } as Goal;
  }
  return base;
}

/** What a start added and changed beside the goals, so Undo can put it back (removal undoStart). */
export interface CarryUndo {
  /** Watches, and the modules' rows (a metric link), the start added. */
  watches: string[];
  modules: ModuleRowIds[];
  /** Open asks and reviews as they were before the copies were added to them. */
  requests: Ask[];
  reviews: Review[];
}

/**
 * What comes with the goals that carry on (rule 6): whatever a module says follows a goal (`follow` in its records: the
 * metrics module's link, same metric and team, linked by the same person); a watch per watch of a carried goal or tree (same person); each open ask or next
 * step on a carried goal, with the copy added to it (so it shows in both years); and each review that names a carried
 * goal or tree, with the copies added. `map` is old goal id → copy id.
 */
export function carryExtras(map: Map<string, string>, s: { watches?: Watch[]; requests?: Ask[]; reviews?: Review[]; modules?: ModuleRows }, newId: (prefix: string) => string, records: readonly ModuleRecords[] = []): { modules: ModuleRows; watches: Watch[]; requests: Ask[]; reviews: Review[]; undo: CarryUndo } {
  const followed = followCopies(s.modules, map, records, newId);
  const watches = (s.watches ?? []).filter((w) => !w.removedAt && (w.kind === 'goal' || w.kind === 'tree') && map.has(w.ref)).map((w): Watch => ({ ...w, id: newId('watch'), ref: map.get(w.ref)! }));
  const add = (ids: string[]) => [...ids, ...ids.filter((id) => map.has(id)).map((id) => map.get(id)!)];
  const before = { requests: [] as Ask[], reviews: [] as Review[] };
  const requests = (s.requests ?? []).filter((r) => r.status === 'open' && r.goalIds.some((id) => map.has(id))).map((r): Ask => { before.requests.push(r); return { ...r, goalIds: add(r.goalIds) }; });
  const reviews = (s.reviews ?? []).filter((r) => !r.endedAt && !r.removedAt && [...r.scope.goals, ...r.scope.trees].some((id) => map.has(id))).map((r): Review => { before.reviews.push(r); return { ...r, scope: { ...r.scope, goals: add(r.scope.goals), trees: add(r.scope.trees) } }; });
  return { modules: followed.modules, watches, requests, reviews, undo: { watches: watches.map((w) => w.id), modules: followed.ids, ...before } };
}
