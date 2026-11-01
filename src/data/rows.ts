/* Domain records ⇄ okr_ table rows. Pure, so both directions are tested without a database. */
import type { CheckIn, Cycle, Goal, MetricPlan, Person, Stage, Team } from '../domain/types';

export interface TeamRow { id: string; name: string; lead_id: string | null; objective: string }
export interface PersonRow { id: string; name: string; role: string; initials: string; team_id: string | null }
export interface CycleRow { id: string; name: string; start_date: string; weeks: number }
export interface StageRow { id: string; goal_id: string; name: string; due_week: number }
export interface GoalRow {
  id: string; cycle_id: string; team_id: string; owner_id: string; parent_id: string | null; title: string;
  kind: Goal['kind']; io: Goal['io']; headline: boolean; guardrail: boolean; effect: number | null; source: string; definition: string;
  unit: string | null; decimals: number | null; plan_start: number | null; plan_target: number | null; plan_shape: MetricPlan['shape'] | null;
  original_plan: MetricPlan | null; rebaselined_week: number | null; range_bound: 'atMost' | 'atLeast' | null; range_limit: number | null;
  range_margin: number | null; created_at: string;
}
export interface CheckInRow {
  id: string; goal_id: string; author_id: string; week: number; posted_at: string; value: number | null; stages: CheckIn['stages'];
  status: CheckIn['status']; calculated: CheckIn['calculated']; cause: CheckIn['cause']; why: string; greener_why: string;
  propose_target: number | null; ptg_what: string | null; ptg_by_week: number | null; ptg_needs: string; next: string; data_flagged: boolean;
}

/** Postgres numerics can arrive as strings; timestamps in any ISO form. Normalise both. */
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: string) => new Date(v).toISOString();

export const teamToRow = (t: Team, withLead = true): TeamRow => ({ id: t.id, name: t.name, lead_id: withLead ? t.leadId : null, objective: t.objective });
export const teamFromRow = (r: TeamRow): Team => ({ id: r.id, name: r.name, leadId: r.lead_id ?? '', objective: r.objective });
export const personToRow = (p: Person): PersonRow => ({ id: p.id, name: p.name, role: p.role, initials: p.initials, team_id: p.teamId });
export const personFromRow = (r: PersonRow): Person => ({ id: r.id, name: r.name, role: r.role, initials: r.initials, teamId: r.team_id });
export const cycleToRow = (c: Cycle): CycleRow => ({ id: c.id, name: c.name, start_date: c.startDate, weeks: c.weeks });
export const cycleFromRow = (r: CycleRow): Cycle => ({ id: r.id, name: r.name, startDate: r.start_date.slice(0, 10), weeks: Number(r.weeks) });

export function goalToRows(g: Goal): { goal: GoalRow; stages: StageRow[] } {
  const goal: GoalRow = {
    id: g.id, cycle_id: g.cycleId, team_id: g.teamId, owner_id: g.ownerId, parent_id: g.parentId, title: g.title, kind: g.kind, io: g.io,
    headline: g.headline, guardrail: g.guardrail, effect: g.effect, source: g.source, definition: g.definition,
    unit: g.kind === 'milestone' ? null : g.unit, decimals: g.kind === 'milestone' ? null : g.decimals,
    plan_start: g.kind === 'metric' ? g.plan.start : null, plan_target: g.kind === 'metric' ? g.plan.target : null, plan_shape: g.kind === 'metric' ? g.plan.shape : null,
    original_plan: g.kind === 'metric' ? g.originalPlan : null, rebaselined_week: g.kind === 'metric' ? g.rebaselinedWeek : null,
    range_bound: g.kind === 'range' ? g.range.bound : null, range_limit: g.kind === 'range' ? g.range.limit : null, range_margin: g.kind === 'range' ? g.range.margin : null,
    created_at: g.createdAt || new Date().toISOString(),
  };
  const stages = g.kind === 'milestone' ? g.stages.map((s) => ({ id: s.id, goal_id: g.id, name: s.name, due_week: s.dueWeek })) : [];
  return { goal, stages };
}

export function goalFromRows(r: GoalRow, stageRows: StageRow[]): Goal {
  const common = {
    id: r.id, cycleId: r.cycle_id, teamId: r.team_id, ownerId: r.owner_id, parentId: r.parent_id, title: r.title, io: r.io,
    headline: r.headline, guardrail: r.guardrail, effect: num(r.effect), source: r.source, definition: r.definition, createdAt: iso(r.created_at),
  };
  if (r.kind === 'metric') {
    const op = r.original_plan;
    return {
      ...common, kind: 'metric', unit: r.unit ?? '', decimals: Number(r.decimals ?? 0),
      plan: { start: num(r.plan_start) as number, target: num(r.plan_target) as number, shape: r.plan_shape ?? 'straight' },
      originalPlan: op ? { start: Number(op.start), target: Number(op.target), shape: op.shape } : null, rebaselinedWeek: r.rebaselined_week,
    };
  }
  if (r.kind === 'range') {
    return { ...common, kind: 'range', unit: r.unit ?? '', decimals: Number(r.decimals ?? 0), range: { bound: r.range_bound ?? 'atMost', limit: num(r.range_limit) as number, margin: num(r.range_margin) as number } };
  }
  const stages: Stage[] = stageRows.filter((s) => s.goal_id === r.id).map((s) => ({ id: s.id, name: s.name, dueWeek: Number(s.due_week) })).sort((a, b) => a.dueWeek - b.dueWeek);
  return { ...common, kind: 'milestone', stages };
}

export const checkInToRow = (c: CheckIn): CheckInRow => ({
  id: c.id, goal_id: c.goalId, author_id: c.authorId, week: c.week, posted_at: c.postedAt, value: c.value, stages: c.stages,
  status: c.status, calculated: c.calculated, cause: c.cause, why: c.why, greener_why: c.greenerWhy, propose_target: c.proposeTarget,
  ptg_what: c.pathToGreen?.what ?? null, ptg_by_week: c.pathToGreen?.byWeek ?? null, ptg_needs: c.pathToGreen?.needs ?? '',
  next: c.next, data_flagged: c.dataFlagged,
});

export const checkInFromRow = (r: CheckInRow): CheckIn => ({
  id: r.id, goalId: r.goal_id, authorId: r.author_id, week: Number(r.week), postedAt: iso(r.posted_at), value: num(r.value), stages: r.stages,
  status: r.status, calculated: r.calculated, cause: r.cause, why: r.why, greenerWhy: r.greener_why, proposeTarget: num(r.propose_target),
  pathToGreen: r.ptg_what != null && r.ptg_by_week != null ? { what: r.ptg_what, byWeek: Number(r.ptg_by_week), needs: r.ptg_needs } : null,
  next: r.next, dataFlagged: r.data_flagged,
});
