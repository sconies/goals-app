/* Creating and editing goals: the form, its checks, and re-baselining. */
import { parseNumber } from './checkin';
import { farOutside, fixed, typedDecimals } from './numbers';
import { planAt, planCheckpoints, planEnd, planHistoryOf } from './plan';
import type { CheckIn, Cycle, Goal, GoalKind, Io, Level, MetricGoal, MetricPlan, PlanShape, Status } from './types';
import { assessMilestone } from './status';
import { defaultTo } from './weeks';
import { baselineOf, startsFromProvisional } from './baseline';

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
  /** The week the plan starts from, when it's being set (a spreadsheet's Plan from week). Left out: as it was, or this
      week for a new goal set up mid-cycle. */
  fromWeek?: string;
  /** The period the baseline covers (BL, domain/baseline rule 1): given, the plan's start is a baseline of its own. */
  baselinePeriod?: string;
  /** Whether that baseline is provisional. */
  baselineProvisional?: boolean;
  source: string;
  definition: string;
  unit: string;
  decimals: string;
  start: string;
  target: string;
  shape: PlanShape;
  bound: 'atMost' | 'atLeast' | 'between';
  limit: string;
  /** A range between two numbers: the lower one (the limit is then the upper one). */
  lower: string;
  margin: string;
  /** `done`: for a stage due before this week, whether it is already done (rule 3): asked, then 'yes' or 'no'. */
  stages: { id: string; name: string; dueWeek: string; done?: '' | 'yes' | 'no' }[];
}

/** The three types, as New goal offers them and a proposed goal's edit page changes them: kind, name, what it is, an example. */
export const GOAL_KINDS: readonly (readonly [GoalKind, string, string, string])[] = [
  ['metric', 'Move a number', 'From where it is to where it should be', 'e.g. Lead time from 4.2 to 2 days'],
  ['range', 'Keep a number in range', 'A guardrail that mustn’t cross a line', 'e.g. Change failure rate at most 12%'],
  ['milestone', 'Hit dated stages', 'Work that is done or not, by a week', 'e.g. Threat model, build, approval'],
];

export function blankGoal(teamId: string, ownerId: string, parentId: string): GoalDraft {
  return {
    kind: 'metric', title: '', teamId, ownerId, io: 'input', level: 'team', guardrail: false, parentId, effect: '', whyHelps: '', alsoHelps: [], endWeek: '', points: {},
    source: '', definition: '', unit: '', decimals: '', start: '', target: '', shape: 'straight',
    bound: 'atMost', limit: '', lower: '', margin: '', stages: [{ id: 's1', name: '', dueWeek: '' }],
  };
}

export function draftOf(g: Goal): GoalDraft {
  const d = blankGoal(g.teamId, g.ownerId, g.parentId ?? '');
  Object.assign(d, {
    kind: g.kind, title: g.title, io: g.io, level: g.level, guardrail: g.guardrail,
    effect: g.effect == null ? '' : String(g.effect), whyHelps: g.whyHelps ?? '', alsoHelps: g.alsoHelps ?? [], source: g.source, definition: g.definition,
  });
  if (g.kind === 'metric') Object.assign(d, { unit: g.unit, decimals: String(g.decimals), start: String(g.plan.start), target: String(g.plan.target), shape: g.plan.shape, endWeek: g.plan.endWeek ? String(g.plan.endWeek) : '', points: Object.fromEntries((g.plan.points ?? []).map((p) => [String(p.week), String(p.value)])), baselinePeriod: g.baseline?.period ?? '', baselineProvisional: !!g.baseline?.provisional });
  if (g.kind === 'range') Object.assign(d, { unit: g.unit, decimals: String(g.decimals), bound: g.range.bound, limit: String(g.range.limit), lower: g.range.lower != null ? String(g.range.lower) : '', margin: String(g.range.margin) });
  if (g.kind === 'milestone') d.stages = g.stages.map((s) => ({ id: s.id, name: s.name, dueWeek: String(s.dueWeek) }));
  return d;
}

/** A draft that builds back exactly this goal, its plan's first week included: what a screen saves when a rule has
    changed the goal itself (the first check-in's re-base, keeping a check-in's decimal places). */
export function draftFor(g: Goal): GoalDraft {
  const d = draftOf(g);
  if (g.kind === 'metric') d.fromWeek = String(g.plan.fromWeek ?? 0);
  return d;
}

/**
 * The decimal places a goal keeps (goal entry, rule 2): the ones chosen in Decimals, or, when none were, the most typed
 * in its numbers (Today, Target, Limit), at most 3. Null when Decimals says something that isn't 0 to 3. A new goal
 * starts with Decimals empty, so what is typed is what is kept.
 */
export function decimalsFor(d: Pick<GoalDraft, 'kind' | 'decimals' | 'start' | 'target' | 'limit'> & Partial<Pick<GoalDraft, 'bound' | 'lower'>>): number | null {
  if (d.decimals.trim()) {
    const n = parseNumber(d.decimals);
    return n != null && Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
  }
  const typed = d.kind === 'metric' ? [d.start, d.target] : d.kind === 'range' ? (d.bound === 'between' ? [d.limit, d.lower ?? ''] : [d.limit]) : [];
  return Math.min(3, Math.max(0, ...typed.map((t) => typedDecimals(t))));
}

/**
 * A question a number goal's changed plan must answer before it's saved (backlog N, the same plausibility rule as a
 * check-in's, applied to target and plan edits in the app, the import and the AI tools). Confirmed, never silent, never
 * refused:
 * - `direction`: the new target is on the other side of the start, so which way is better flips;
 * - `far`: a new start, target or hand-set week is far outside the plan it replaces (`farOutside`).
 * Null when the plan is unchanged, or for a new goal. Goal entry's rule 3 (domain/goalEntry goalChecks) asks it.
 */
export interface PlanQuestion { code: 'direction' | 'far'; text: string; confirm: string }

export function planQuestion(before: Goal | null, after: Goal): PlanQuestion | null {
  if (before?.kind !== 'metric' || after.kind !== 'metric' || !planChanged(before, after)) return null;
  const was = before.plan, now = after.plan;
  const d = after.decimals, u = after.unit.trim() === '%' ? '%' : after.unit.trim() ? ' ' + after.unit.trim() : '';
  const n = (x: number) => fixed(x, d) + u;
  const wasUp = was.target > was.start, nowUp = now.target > now.start;
  if (wasUp !== nowUp) {
    const better = nowUp ? 'higher' : 'lower';
    return { code: 'direction', text: `This makes ${better} better: the target (${n(now.target)}) is now ${nowUp ? 'above' : 'below'} the start (${n(now.start)}). It was ${n(was.start)} to ${n(was.target)}, ${wasUp ? 'higher' : 'lower'} is better.`, confirm: `Yes, make ${better} better` };
  }
  const old = new Map((was.points ?? []).map((p) => [p.week, p.value]));
  const moved: [string, number][] = [
    ...(now.target !== was.target ? [['target', now.target] as [string, number]] : []),
    ...(now.start !== was.start ? [['start', now.start] as [string, number]] : []),
    ...(now.points ?? []).filter((p) => old.get(p.week) !== p.value).map((p) => [`week ${p.week}`, p.value] as [string, number]),
  ];
  const far = moved.find(([, v]) => farOutside(v, was.start, was.target));
  if (far) return { code: 'far', text: `The ${far[0]} of ${n(far[1])} is far outside the plan it replaces (${n(was.start)} to ${n(was.target)}). Status, progress and the forecast will all be judged against it.`, confirm: `Yes, ${far[0]} ${n(far[1])} is right` };
  return null;
}

/** Whether the plan itself differs: what status is judged against (start, target, shape, limit, stages). */
export function planChanged(a: Goal, b: Goal): boolean {
  if (a.kind !== b.kind) return true;
  // Firming up a provisional baseline moves only the start, and is not a plan change (domain/baseline rule 3).
  if (a.kind === 'metric' && b.kind === 'metric' && a.plan.start !== b.plan.start && startsFromProvisional(a)) return planChanged(a, { ...b, plan: { ...b.plan, start: a.plan.start } });
  if (a.kind === 'metric' && b.kind === 'metric') return a.plan.start !== b.plan.start || a.plan.target !== b.plan.target || a.plan.shape !== b.plan.shape || (a.plan.fromWeek ?? 0) !== (b.plan.fromWeek ?? 0) || (a.plan.endWeek ?? 0) !== (b.plan.endWeek ?? 0) || JSON.stringify(a.plan.points ?? []) !== JSON.stringify(b.plan.points ?? []);
  if (a.kind === 'range' && b.kind === 'range') return a.range.bound !== b.range.bound || a.range.limit !== b.range.limit || a.range.lower !== b.range.lower || a.range.margin !== b.range.margin;
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
    id: base.id, ...(existing?.key ? { key: existing.key } : {}), cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title.trim(), io: d.io,
    level: d.level, guardrail: d.guardrail, parentId: d.parentId || null,
    effect: d.parentId ? parseNumber(d.effect) : null, ...(d.parentId && d.whyHelps.trim() ? { whyHelps: d.whyHelps.trim() } : {}), ...((d.alsoHelps ?? []).filter((id) => id !== d.parentId && id !== base.id).length ? { alsoHelps: (d.alsoHelps ?? []).filter((id) => id !== d.parentId && id !== base.id) } : {}), source: d.source.trim(), definition: d.definition.trim(), createdAt: base.createdAt,
  };
  const num = (s: string) => parseNumber(s) as number;
  if (d.kind === 'metric') {
    const from: Pick<MetricPlan, 'fromWeek'> = d.fromWeek != null && d.fromWeek.trim() !== '' ? (num(d.fromWeek) ? { fromWeek: num(d.fromWeek) } : {})
      : existing?.kind === 'metric' ? (existing.plan.fromWeek ? { fromWeek: existing.plan.fromWeek } : {}) : week > 0 ? { fromWeek: week } : {};
    // No To: the cycle's end, or the end of next year for a From at or past it (weeks.defaultTo).
    const end = parseNumber(d.endWeek) ?? defaultTo(cycle, from.fromWeek ?? 0);
    const shaped: MetricPlan = {
      start: num(d.start), target: num(d.target), shape: d.shape, ...from,
      ...(end !== cycle.weeks ? { endWeek: end } : {}),
    };
    const plan = withPoints(shaped, d.points, cycle.weeks);
    const history = existing?.kind === 'metric' ? replanned(existing, plan, checkInsStarted, week) : { originalPlan: null, rebaselinedWeek: null };
    const baseline = d.baselinePeriod === undefined && existing?.kind === 'metric' && existing.baseline
      ? baselineOf(plan.start, existing.baseline.period, existing.baseline.provisional) : baselineOf(plan.start, d.baselinePeriod, d.baselineProvisional);
    return { ...common, kind: 'metric', unit: d.unit.trim(), decimals: decimalsFor(d) ?? 0, plan, ...history, ...(baseline ? { baseline } : {}) };
  }
  if (d.kind === 'range') {
    return { ...common, kind: 'range', unit: d.unit.trim(), decimals: decimalsFor(d) ?? 0, range: { bound: d.bound, limit: num(d.limit), ...(d.bound === 'between' ? { lower: num(d.lower) } : {}), margin: parseNumber(d.margin) ?? 0 } };
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

/**
 * What a number goal's plan fields become when its plan changes. Once check-ins have started, the plan being replaced is
 * kept with the week it stopped applying, so earlier weeks and closed quarters stay judged against the plan of their day.
 * Two changes in the same week keep the plan from before the first.
 */
export function replanned(existing: MetricGoal, plan: MetricPlan, started: boolean, week: number): Pick<MetricGoal, 'originalPlan' | 'rebaselinedWeek' | 'planHistory'> {
  const history = planHistoryOf(existing);
  const keep = { originalPlan: existing.originalPlan, rebaselinedWeek: existing.rebaselinedWeek, ...(history.length ? { planHistory: history } : {}) };
  if (!started || !planChanged(existing, { ...existing, plan })) return keep;
  const next = history.at(-1)?.untilWeek === week ? history : [...history, { untilWeek: week, plan: existing.plan }];
  return { originalPlan: existing.originalPlan ?? existing.plan, rebaselinedWeek: week, planHistory: next };
}

export { goalAsOf, planAsOf, planHistoryOf } from './plan';

/* ---------- a stage already past at set-up (onboarding spec, rule 3; OB2) ---------- */

/** Rule 3. A stage due before this week is past: setting the goal up asks whether it is already done. */
export const pastStage = (dueWeek: number, week: number) => dueWeek < week;

/** The note on the check-in that records stages already done when a goal was set up. */
export const DONE_AT_SET_UP = 'Recorded as already done when the goal was set up';

/**
 * Rule 3. The stages answered "done" at set-up, as one check-in in the week of the latest of them: each done in its own
 * due week, so none is late. Null when none was. The status is what the stage rule says at that week.
 */
export function stagesDoneAtSetUp(goal: Goal, doneIds: readonly string[], authorId: string, now: string, id: string): CheckIn | null {
  if (goal.kind !== 'milestone') return null;
  const done = goal.stages.filter((s) => doneIds.includes(s.id));
  if (!done.length) return null;
  const week = Math.max(...done.map((s) => s.dueWeek));
  const stages = goal.stages.map((s) => ({ stageId: s.id, doneWeek: doneIds.includes(s.id) ? s.dueWeek : null, forecastWeek: null }));
  const a = assessMilestone(goal, week, stages);
  const status: Status = a.calc === 'planned' || a.calc === 'none' ? 'on' : a.calc;
  return { id, goalId: goal.id, authorId, week, postedAt: now, value: null, stages, status, calculated: status, cause: null, why: DONE_AT_SET_UP, greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false };
}
