/* Creating and editing goals: the form, its checks, and re-baselining. */
import { parseNumber } from './checkin';
import type { Cycle, Goal, GoalKind, Io, MetricPlan, PlanShape } from './types';

export interface GoalDraft {
  kind: GoalKind;
  title: string;
  teamId: string;
  ownerId: string;
  io: Io;
  headline: boolean;
  guardrail: boolean;
  parentId: string;
  effect: string;
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
    kind: 'metric', title: '', teamId, ownerId, io: 'input', headline: false, guardrail: false, parentId, effect: '',
    source: '', definition: '', unit: '%', decimals: '0', start: '', target: '', shape: 'straight',
    bound: 'atMost', limit: '', margin: '1', stages: [{ id: 's1', name: '', dueWeek: '' }],
  };
}

export function draftOf(g: Goal): GoalDraft {
  const d = blankGoal(g.teamId, g.ownerId, g.parentId ?? '');
  Object.assign(d, {
    kind: g.kind, title: g.title, io: g.io, headline: g.headline, guardrail: g.guardrail,
    effect: g.effect == null ? '' : String(g.effect), source: g.source, definition: g.definition,
  });
  if (g.kind === 'metric') Object.assign(d, { unit: g.unit, decimals: String(g.decimals), start: String(g.plan.start), target: String(g.plan.target), shape: g.plan.shape });
  if (g.kind === 'range') Object.assign(d, { unit: g.unit, decimals: String(g.decimals), bound: g.range.bound, limit: String(g.range.limit), margin: String(g.range.margin) });
  if (g.kind === 'milestone') d.stages = g.stages.map((s) => ({ id: s.id, name: s.name, dueWeek: String(s.dueWeek) }));
  return d;
}

export type GoalErrors = Partial<Record<'title' | 'teamId' | 'ownerId' | 'start' | 'target' | 'limit' | 'margin' | 'decimals' | 'effect' | 'stages', string>>;

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

/**
 * Build the goal from a valid draft. When an existing metric goal's plan changes after
 * check-ins have started, the first plan is kept as the original and the change is dated.
 */
export function buildGoal(d: GoalDraft, cycle: Cycle, base: { id: string; createdAt: string }, existing: Goal | null, checkInsStarted: boolean, week: number): Goal {
  const common = {
    id: base.id, cycleId: cycle.id, teamId: d.teamId, ownerId: d.ownerId, title: d.title.trim(), io: d.headline ? 'output' as const : d.io,
    headline: d.headline, guardrail: d.guardrail, parentId: d.headline ? null : d.parentId || null,
    effect: d.headline ? null : parseNumber(d.effect), source: d.source.trim(), definition: d.definition.trim(), createdAt: base.createdAt,
  };
  const num = (s: string) => parseNumber(s) as number;
  if (d.kind === 'metric') {
    const plan: MetricPlan = { start: num(d.start), target: num(d.target), shape: d.shape };
    let originalPlan: MetricPlan | null = null, rebaselinedWeek: number | null = null;
    if (existing?.kind === 'metric') {
      originalPlan = existing.originalPlan;
      rebaselinedWeek = existing.rebaselinedWeek;
      const changed = existing.plan.start !== plan.start || existing.plan.target !== plan.target || existing.plan.shape !== plan.shape;
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
