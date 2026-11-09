/* Creating and editing goals: the form, its checks, and re-baselining. */
import { parseNumber } from './checkin';
import { nameProblem } from './thresholds';
import { farOutside, fixed, notNumberText, precisionProblem, setupProblem } from './numbers';
import { planAt, planCheckpoints, planEnd, planHistoryOf } from './plan';
import type { Cycle, Goal, GoalKind, Io, Level, MetricGoal, MetricPlan, PlanShape } from './types';

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

export function validateGoal(d: GoalDraft, cycle: Cycle, existing?: Goal | null): GoalErrors {
  const e: GoalErrors = {};
  const named = nameProblem(d.title, 'goal');
  if (named) e.title = named;
  if (!d.teamId) e.teamId = 'Choose a team.';
  if (!d.ownerId) e.ownerId = 'Choose an owner.';
  if (d.effect.trim() && parseNumber(d.effect) == null) e.effect = notNumberText(d.effect);
  // A number field's problem: empty (the field's own ask), letters (the one message), or more decimal places than the
  // goal keeps (refused, never rounded: domain/numbers).
  const dp = d.kind === 'milestone' ? null : parseNumber(d.decimals);
  const places = dp != null && dp >= 0 && dp <= 3 && Number.isInteger(dp) ? dp : null;
  const numberProblem = (raw: string, empty: string): string | null => {
    if (!raw.trim()) return empty;
    const n = parseNumber(raw);
    if (n == null) return notNumberText(raw);
    return places == null ? null : precisionProblem(raw, n, places);
  };
  if (d.kind !== 'milestone' && places == null) e.decimals = 'Between 0 and 3.';
  if (d.kind === 'metric') {
    const sp = numberProblem(d.start, 'Enter where it starts.'), tp = numberProblem(d.target, 'Enter the target.');
    if (sp) e.start = sp;
    if (tp) e.target = tp;
    else if (!sp && parseNumber(d.start) === parseNumber(d.target)) e.target = 'The target has to differ from the start.';
    // Plan numbers typed by hand. One already stored (an existing goal's plan) is not re-judged unless it was changed.
    const stored = new Map(existing?.kind === 'metric' ? (existing.plan.points ?? []).map((p) => [String(p.week), p.value]) : []);
    const typed = Object.entries(d.points).filter(([w, v]) => v.trim() !== '' && parseNumber(v) !== stored.get(w));
    const bad = typed.map(([, v]) => (parseNumber(v) == null ? notNumberText(v) : places == null ? null : precisionProblem(v, parseNumber(v), places))).find(Boolean);
    if (bad) e.points = bad;
  }
  if (d.kind === 'range') {
    const lp = numberProblem(d.limit, 'Enter the limit.');
    if (lp) e.limit = lp;
    const m = parseNumber(d.margin);
    if (d.margin.trim() && m == null) e.margin = notNumberText(d.margin);
    else if (m == null || m < 0) e.margin = 'Enter a warning margin of zero or more.';
    else if (places != null) { const mp = precisionProblem(d.margin, m, places); if (mp) e.margin = mp; }
  }
  if (d.kind === 'milestone') {
    const rows = d.stages.filter((s) => s.name.trim() || s.dueWeek.trim());
    if (!rows.length) e.stages = 'Add at least one stage.';
    else if (rows.some((s) => !s.name.trim())) e.stages = 'Every stage needs a name.';
    else if (rows.some((s) => { const w = parseNumber(s.dueWeek); return w == null || !Number.isInteger(w) || w < 1 || w > cycle.weeks; })) e.stages = 'Every stage needs a due week between 1 and ' + cycle.weeks + '.';
  }
  return e;
}

/**
 * Checks worth making on a goal's numbers as typed: asked beside the field, never refused (backlog N). Over 100% first
 * (overHundredHint), then a negative time, money or percentage, a target a hundred times the start, or a billion or more.
 */
export function planHint(d: Pick<GoalDraft, 'kind' | 'unit' | 'start' | 'target' | 'limit'>): string | null {
  if (d.kind === 'metric') return overHundredHint(d.unit, d.start, d.target) ?? setupProblem(d.unit, parseNumber(d.start), parseNumber(d.target));
  if (d.kind === 'range') return setupProblem(d.unit, parseNumber(d.limit), null);
  return null;
}

/**
 * A question a number goal's changed plan must answer before it's saved (backlog N, the same plausibility rule as a
 * check-in's, applied to target and plan edits in the app, the import and the AI tools). Confirmed, never silent, never
 * refused:
 * - `direction`: the new target is on the other side of the start, so which way is better flips;
 * - `far`: a new start, target or hand-set week is far outside the plan it replaces (`farOutside`).
 * Null when the plan is unchanged, or for a new goal (its numbers are asked about by `planHint`).
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
  if (a.kind === 'metric' && b.kind === 'metric') return a.plan.start !== b.plan.start || a.plan.target !== b.plan.target || a.plan.shape !== b.plan.shape || (a.plan.fromWeek ?? 0) !== (b.plan.fromWeek ?? 0) || (a.plan.endWeek ?? 0) !== (b.plan.endWeek ?? 0) || JSON.stringify(a.plan.points ?? []) !== JSON.stringify(b.plan.points ?? []);
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
    id: base.id, ...(existing?.key ? { key: existing.key } : {}), cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title.trim(), io: d.io,
    level: d.level, guardrail: d.guardrail, parentId: d.parentId || null,
    effect: d.parentId ? parseNumber(d.effect) : null, ...(d.parentId && d.whyHelps.trim() ? { whyHelps: d.whyHelps.trim() } : {}), ...((d.alsoHelps ?? []).filter((id) => id !== d.parentId && id !== base.id).length ? { alsoHelps: (d.alsoHelps ?? []).filter((id) => id !== d.parentId && id !== base.id) } : {}), source: d.source.trim(), definition: d.definition.trim(), createdAt: base.createdAt,
  };
  const num = (s: string) => parseNumber(s) as number;
  if (d.kind === 'metric') {
    const end = parseNumber(d.endWeek);
    const shaped: MetricPlan = {
      start: num(d.start), target: num(d.target), shape: d.shape,
      ...(d.fromWeek != null && d.fromWeek.trim() !== '' ? (num(d.fromWeek) ? { fromWeek: num(d.fromWeek) } : {})
        : existing?.kind === 'metric' ? (existing.plan.fromWeek ? { fromWeek: existing.plan.fromWeek } : {}) : week > 0 ? { fromWeek: week } : {}),
      ...(end != null && end !== cycle.weeks ? { endWeek: end } : {}),
    };
    const plan = withPoints(shaped, d.points, cycle.weeks);
    const history = existing?.kind === 'metric' ? replanned(existing, plan, checkInsStarted, week) : { originalPlan: null, rebaselinedWeek: null };
    return { ...common, kind: 'metric', unit: d.unit.trim(), decimals: num(d.decimals), plan, ...history };
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

/**
 * A percentage goal planned past 100% is either growth (fine) or a share like coverage that can't pass 100% (a mistake).
 * Only the person setting it up knows which, so ask, in the same words everywhere a goal is set.
 */
export function overHundredHint(unit: string, start: string, target: string): string | null {
  if (unit.trim() !== '%') return null;
  const s = parseNumber(start), t = parseNumber(target);
  if ((s == null || s <= 100) && (t == null || t <= 100)) return null;
  return 'Over 100%. Fine for growth; but if this is a share of something (coverage, adoption), it can’t pass 100%, so check the target.';
}
