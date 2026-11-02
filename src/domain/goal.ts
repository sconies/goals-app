/* Creating and editing goals: the form, its checks, and re-baselining. */
import { parseNumber } from './checkin';
import { planAt, planCheckpoints, planEnd } from './plan';
import type { Cycle, Goal, GoalKind, Io, Level, MetricPlan, PlanShape } from './types';

export interface GoalDraft {
  kind: GoalKind;
  title: string;
  teamId: string;
  ownerId: string;
  io: Io;
  level: Level;
  guardrail: boolean;
  parentId: string;
  effect: string;
  whyHelps: string;
  /** Other goals it also helps (dotted lines on the map). */
  alsoHelps: string[];
  /** When the target is due, as a week from the cycle's start; empty means the end of the cycle. */
  endWeek: string;
  /** Plan numbers typed by hand, by checkpoint week. Empty means the shape decides. */
  points: Record<string, string>;
  source: string;
  definition: string;
  unit: string;
  decimals: string;
  start: string;
  target: string;
  shape: PlanShape;
  bound: 'atMost' | 'atLeast';
  limit: string;
  margin: string;
  stages: { id: string; name: string; dueWeek: string }[];
}

export function blankGoal(teamId: string, ownerId: string, parentId: string): GoalDraft {
  return {
    kind: 'metric', title: '', teamId, ownerId, io: 'input', level: 'team', guardrail: false, parentId, effect: '', whyHelps: '', alsoHelps: [], endWeek: '', points: {},
    source: '', definition: '', unit: '%', decimals: '0', start: '', target: '', shape: 'straight',
    bound: 'atMost', limit: '', margin: '1', stages: [{ id: 's1', name: '', dueWeek: '' }],
  };
}

export function draftOf(g: Goal): GoalDraft {
  const d = blankGoal(g.teamId, g.ownerId, g.parentId ?? '');
  Object.assign(d, {
    kind: g.kind, title: g.title, io: g.io, level: g.level, guardrail: g.guardrail,
    effect: g.effect == null ? '' : String(g.effect), whyHelps: g.whyHelps ?? '', alsoHelps: g.alsoHelps ?? [], source: g.source, definition: g.definition,
  });
  if (g.kind === 'metric') Object.assign(d, { unit: g.unit, decimals: String(g.decimals), start: String(g.plan.start), target: String(g.plan.target), shape: g.plan.shape, endWeek: g.plan.endWeek ? String(g.plan.endWeek) : '', points: Object.fromEntries((g.plan.points ?? []).map((p) => [String(p.week), String(p.value)])) });
  if (g.kind === 'range') Object.assign(d, { unit: g.unit, decimals: String(g.decimals), bound: g.range.bound, limit: String(g.range.limit), margin: String(g.range.margin) });
  if (g.kind === 'milestone') d.stages = g.stages.map((s) => ({ id: s.id, name: s.name, dueWeek: String(s.dueWeek) }));
  return d;
}

export type GoalErrors = Partial<Record<'title' | 'teamId' | 'ownerId' | 'start' | 'target' | 'limit' | 'margin' | 'decimals' | 'effect' | 'stages' | 'points', string>>;

export function validateGoal(d: GoalDraft, cycle: Cycle): GoalErrors {
  const e: GoalErrors = {};
  if (d.title.trim().length < 3) e.title = 'Give the goal a name of at least three characters.';
  if (!d.teamId) e.teamId = 'Choose a team.';
  if (!d.ownerId) e.ownerId = 'Choose an owner.';
  if (d.effect.trim() && parseNumber(d.effect) == null) e.effect = 'Enter a number, or leave it empty.';
  if (d.kind !== 'milestone') {
    const dp = parseNumber(d.decimals);
    if (dp == null || dp < 0 || dp > 3 || !Number.isInteger(dp)) e.decimals = 'Between 0 and 3.';
  }
  if (d.kind === 'metric') {
    const s = parseNumber(d.start), t = parseNumber(d.target);
    if (s == null) e.start = 'Enter where it starts.';
    if (t == null) e.target = 'Enter the target.';
    else if (s != null && s === t) e.target = 'The target has to differ from the start.';
    if (Object.values(d.points).some((v) => v.trim() !== '' && parseNumber(v) == null)) e.points = 'Every plan number has to be a number.';
  }
  if (d.kind === 'range') {
    if (parseNumber(d.limit) == null) e.limit = 'Enter the limit.';
    const m = parseNumber(d.margin);
    if (m == null || m < 0) e.margin = 'Enter a warning margin of zero or more.';
  }
  if (d.kind === 'milestone') {
    const rows = d.stages.filter((s) => s.name.trim() || s.dueWeek.trim());
    if (!rows.length) e.stages = 'Add at least one stage.';
    else if (rows.some((s) => !s.name.trim())) e.stages = 'Every stage needs a name.';
    else if (rows.some((s) => { const w = parseNumber(s.dueWeek); return w == null || !Number.isInteger(w) || w < 1 || w > cycle.weeks; })) e.stages = 'Every stage needs a due week between 1 and ' + cycle.weeks + '.';
  }
  return e;
}

/** Whether the plan itself differs: what status is judged against (start, target, shape, limit, stages). */
export function planChanged(a: Goal, b: Goal): boolean {
  if (a.kind !== b.kind) return true;
  if (a.kind === 'metric' && b.kind === 'metric') return a.plan.start !== b.plan.start || a.plan.target !== b.plan.target || a.plan.shape !== b.plan.shape || (a.plan.endWeek ?? 0) !== (b.plan.endWeek ?? 0) || JSON.stringify(a.plan.points ?? []) !== JSON.stringify(b.plan.points ?? []);
  if (a.kind === 'range' && b.kind === 'range') return a.range.bound !== b.range.bound || a.range.limit !== b.range.limit || a.range.margin !== b.range.margin;
  if (a.kind === 'milestone' && b.kind === 'milestone') return JSON.stringify(a.stages.map((s) => [s.name, s.dueWeek])) !== JSON.stringify(b.stages.map((s) => [s.name, s.dueWeek]));
  return false;
}

/** The goal with only its plan taken from another version: names, owner and links stay as they are. */
export function withPlanOf(base: Goal, plan: Goal): Goal {
  if (base.kind === 'metric' && plan.kind === 'metric') return { ...base, plan: plan.plan };
  if (base.kind === 'range' && plan.kind === 'range') return { ...base, range: plan.range };
  if (base.kind === 'milestone' && plan.kind === 'milestone') return { ...base, stages: plan.stages };
  return base;
}

/**
 * Build the goal from a valid draft. When an existing metric goal's plan changes after
 * check-ins have started, the first plan is kept as the original and the change is dated.
 */
export function buildGoal(d: GoalDraft, cycle: Cycle, base: { id: string; createdAt: string }, existing: Goal | null, checkInsStarted: boolean, week: number): Goal {
  const common = {
    id: base.id, cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title.trim(), io: d.io,
    level: d.level, guardrail: d.guardrail, parentId: d.parentId || null,
    effect: d.parentId ? parseNumber(d.effect) : null, ...(d.parentId && d.whyHelps.trim() ? { whyHelps: d.whyHelps.trim() } : {}), ...((d.alsoHelps ?? []).filter((id) => id !== d.parentId && id !== base.id).length ? { alsoHelps: (d.alsoHelps ?? []).filter((id) => id !== d.parentId && id !== base.id) } : {}), source: d.source.trim(), definition: d.definition.trim(), createdAt: base.createdAt,
  };
  const num = (s: string) => parseNumber(s) as number;
  if (d.kind === 'metric') {
    const end = parseNumber(d.endWeek);
    const shaped: MetricPlan = {
      start: num(d.start), target: num(d.target), shape: d.shape,
      ...(existing?.kind === 'metric' ? (existing.plan.fromWeek ? { fromWeek: existing.plan.fromWeek } : {}) : week > 0 ? { fromWeek: week } : {}),
      ...(end != null && end !== cycle.weeks ? { endWeek: end } : {}),
    };
    const plan = withPoints(shaped, d.points, cycle.weeks);
    let originalPlan: MetricPlan | null = null, rebaselinedWeek: number | null = null;
    if (existing?.kind === 'metric') {
      originalPlan = existing.originalPlan;
      rebaselinedWeek = existing.rebaselinedWeek;
      const changed = planChanged(existing, { ...existing, plan });
      if (changed && checkInsStarted) {
        originalPlan = existing.originalPlan ?? existing.plan;
        rebaselinedWeek = week;
      }
    }
    return { ...common, kind: 'metric', unit: d.unit.trim(), decimals: num(d.decimals), plan, originalPlan, rebaselinedWeek };
  }
  if (d.kind === 'range') {
    return { ...common, kind: 'range', unit: d.unit.trim(), decimals: num(d.decimals), range: { bound: d.bound, limit: num(d.limit), margin: num(d.margin) } };
  }
  const stages = d.stages
    .filter((s) => s.name.trim())
    .map((s) => ({ id: s.id, name: s.name.trim(), dueWeek: num(s.dueWeek) }))
    .sort((a, b) => a.dueWeek - b.dueWeek);
  return { ...common, kind: 'milestone', stages };
}

/**
 * The plan with any numbers typed by hand. If one checkpoint is set by hand, every checkpoint is stored
 * (the rest at their shape defaults), so the plan is exactly the table people saw.
 */
export function withPoints(plan: MetricPlan, typed: Record<string, string>, weeks: number): MetricPlan {
  const set = Object.entries(typed).filter(([, v]) => v.trim() !== '' && parseNumber(v) != null);
  const { points: _drop, ...base } = plan;
  if (!set.length) return base;
  const from = plan.fromWeek ?? 0;
  const end = planEnd(plan, weeks);
  const points = planCheckpoints(from, end).filter((w) => w < end).map((w) => {
    const hand = typed[String(w)];
    return { week: w, value: hand != null && hand.trim() !== '' && parseNumber(hand) != null ? (parseNumber(hand) as number) : planAt(base, w, weeks) };
  });
  return { ...base, points };
}
