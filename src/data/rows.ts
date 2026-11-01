/* Domain records ⇄ okr_ table rows. Pure, so both directions are tested without a database.
   Every row carries the workspace it belongs to. */
import type { Change, CheckIn, Cycle, Decision, Goal, Level, MetricPlan, Person, Review, Stage, Team, Watch, Workspace, Retro, Feedback, RecoveryState } from '../domain/types';

type W = { workspace_id: string };
export interface WorkspaceRow { id: string; name: string; kind: Workspace['kind']; created_at: string }
export interface TeamRow extends W { id: string; name: string; lead_id: string | null; objective: string }
export interface PersonRow extends W { id: string; name: string; role: string; initials: string; team_id: string | null; is_admin: boolean }
export interface CycleRow extends W { id: string; name: string; start_date: string; weeks: number; review_day: number }
export interface StageRow extends W { id: string; goal_id: string; name: string; due_week: number }
export interface GoalRow extends W {
  id: string; cycle_id: string; team_id: string; owner_id: string; parent_id: string | null; title: string;
  kind: Goal['kind']; io: Goal['io']; headline: boolean; level: Level; guardrail: boolean; effect: number | null; why_helps?: string | null; source: string; definition: string;
  unit: string | null; decimals: number | null; plan_start: number | null; plan_target: number | null; plan_shape: MetricPlan['shape'] | null; plan_from_week?: number | null;
  original_plan: MetricPlan | null; rebaselined_week: number | null; range_bound: 'atMost' | 'atLeast' | null; range_limit: number | null;
  range_margin: number | null; created_at: string; pending?: Goal['pending'];
}
export interface CheckInRow extends W {
  id: string; goal_id: string; author_id: string; week: number; posted_at: string; value: number | null; stages: CheckIn['stages'];
  status: CheckIn['status']; calculated: CheckIn['calculated']; cause: CheckIn['cause']; why: string; greener_why: string;
  propose_target: number | null; ptg_what: string | null; ptg_by_week: number | null; ptg_needs: string; ptg_state?: RecoveryState | null; next: string; data_flagged: boolean;
}
export interface DecisionRow extends W { id: string; goal_id: string; check_in_id: string | null; review_id: string | null; week: number; kind: Decision['kind']; by_id: string; at: string; note: string; assignee_id?: string | null; due_week?: number | null }
export interface ChangeRow extends W {
  id: string; at: string; actor_id: string; goal_id: string | null; entity: Change['entity']; entity_id: string;
  action: Change['action']; summary: string; diffs: Change['diffs'];
}

/** Postgres numerics can arrive as strings; timestamps in any ISO form. Normalise both. */
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: string) => new Date(v).toISOString();

export const workspaceToRow = (w: Workspace): WorkspaceRow => ({ id: w.id, name: w.name, kind: w.kind, created_at: w.createdAt });
export const workspaceFromRow = (r: WorkspaceRow): Workspace => ({ id: r.id, name: r.name, kind: r.kind, createdAt: iso(r.created_at) });
export const teamToRow = (ws: string, t: Team, withLead = true): TeamRow => ({ workspace_id: ws, id: t.id, name: t.name, lead_id: withLead && t.leadId ? t.leadId : null, objective: t.objective });
export const teamFromRow = (r: TeamRow): Team => ({ id: r.id, name: r.name, leadId: r.lead_id ?? '', objective: r.objective });
export const personToRow = (ws: string, p: Person): PersonRow => ({ workspace_id: ws, id: p.id, name: p.name, role: p.role, initials: p.initials, team_id: p.teamId, is_admin: p.admin });
export const personFromRow = (r: PersonRow): Person => ({ id: r.id, name: r.name, role: r.role, initials: r.initials, teamId: r.team_id, admin: !!r.is_admin });
export const cycleToRow = (ws: string, c: Cycle): CycleRow => ({ workspace_id: ws, id: c.id, name: c.name, start_date: c.startDate, weeks: c.weeks, review_day: c.reviewDay });
export const cycleFromRow = (r: CycleRow): Cycle => ({ id: r.id, name: r.name, startDate: r.start_date.slice(0, 10), weeks: Number(r.weeks), reviewDay: Number(r.review_day ?? 3) });

export function goalToRows(ws: string, g: Goal): { goal: GoalRow; stages: StageRow[] } {
  const goal: GoalRow = {
    workspace_id: ws,
    id: g.id, cycle_id: g.cycleId, team_id: g.teamId, owner_id: g.ownerId, parent_id: g.parentId, title: g.title, kind: g.kind, io: g.io,
    headline: false, level: g.level, guardrail: g.guardrail, effect: g.effect, why_helps: g.whyHelps ?? null, source: g.source, definition: g.definition,
    unit: g.kind === 'milestone' ? null : g.unit, decimals: g.kind === 'milestone' ? null : g.decimals,
    plan_start: g.kind === 'metric' ? g.plan.start : null, plan_target: g.kind === 'metric' ? g.plan.target : null, plan_shape: g.kind === 'metric' ? g.plan.shape : null, plan_from_week: g.kind === 'metric' ? g.plan.fromWeek ?? 0 : null,
    original_plan: g.kind === 'metric' ? g.originalPlan : null, rebaselined_week: g.kind === 'metric' ? g.rebaselinedWeek : null,
    range_bound: g.kind === 'range' ? g.range.bound : null, range_limit: g.kind === 'range' ? g.range.limit : null, range_margin: g.kind === 'range' ? g.range.margin : null,
    created_at: g.createdAt || new Date().toISOString(),
    pending: g.pending ?? null,
  };
  const stages = g.kind === 'milestone' ? g.stages.map((s) => ({ workspace_id: ws, id: s.id, goal_id: g.id, name: s.name, due_week: s.dueWeek })) : [];
  return { goal, stages };
}

export function goalFromRows(r: GoalRow, stageRows: StageRow[]): Goal {
  const common = {
    id: r.id, cycleId: r.cycle_id, teamId: r.team_id, ownerId: r.owner_id, parentId: r.parent_id, title: r.title, io: r.io,
    level: r.level ?? (r.headline ? 'north-star' : 'team'), guardrail: r.guardrail, effect: num(r.effect), ...(r.why_helps ? { whyHelps: r.why_helps } : {}), source: r.source, definition: r.definition, createdAt: iso(r.created_at),
    ...(r.pending ? { pending: r.pending } : {}),
  };
  if (r.kind === 'metric') {
    const op = r.original_plan;
    return {
      ...common, kind: 'metric', unit: r.unit ?? '', decimals: Number(r.decimals ?? 0),
      plan: { start: num(r.plan_start) as number, target: num(r.plan_target) as number, shape: r.plan_shape ?? 'straight', ...(r.plan_from_week ? { fromWeek: Number(r.plan_from_week) } : {}) },
      originalPlan: op ? { start: Number(op.start), target: Number(op.target), shape: op.shape } : null, rebaselinedWeek: r.rebaselined_week,
    };
  }
  if (r.kind === 'range') {
    return { ...common, kind: 'range', unit: r.unit ?? '', decimals: Number(r.decimals ?? 0), range: { bound: r.range_bound ?? 'atMost', limit: num(r.range_limit) as number, margin: num(r.range_margin) as number } };
  }
  const stages: Stage[] = stageRows.filter((s) => s.goal_id === r.id).map((s) => ({ id: s.id, name: s.name, dueWeek: Number(s.due_week) })).sort((a, b) => a.dueWeek - b.dueWeek);
  return { ...common, kind: 'milestone', stages };
}

export const checkInToRow = (ws: string, c: CheckIn): CheckInRow => ({
  workspace_id: ws,
  id: c.id, goal_id: c.goalId, author_id: c.authorId, week: c.week, posted_at: c.postedAt, value: c.value, stages: c.stages,
  status: c.status, calculated: c.calculated, cause: c.cause, why: c.why, greener_why: c.greenerWhy, propose_target: c.proposeTarget,
  ptg_what: c.pathToGreen?.what ?? null, ptg_by_week: c.pathToGreen?.byWeek ?? null, ptg_needs: c.pathToGreen?.needs ?? '', ptg_state: c.pathToGreen?.state ?? null,
  next: c.next, data_flagged: c.dataFlagged,
});

export const checkInFromRow = (r: CheckInRow): CheckIn => ({
  id: r.id, goalId: r.goal_id, authorId: r.author_id, week: Number(r.week), postedAt: iso(r.posted_at), value: num(r.value), stages: r.stages,
  status: r.status, calculated: r.calculated, cause: r.cause, why: r.why, greenerWhy: r.greener_why, proposeTarget: num(r.propose_target),
  pathToGreen: r.ptg_what != null && (r.ptg_by_week != null || r.ptg_state) ? { what: r.ptg_what, byWeek: r.ptg_by_week == null ? null : Number(r.ptg_by_week), ...(r.ptg_state ? { state: r.ptg_state } : {}), needs: r.ptg_needs } : null,
  next: r.next, dataFlagged: r.data_flagged,
});

export const decisionToRow = (ws: string, d: Decision): DecisionRow => ({ workspace_id: ws, id: d.id, goal_id: d.goalId, check_in_id: d.checkInId, review_id: d.reviewId, week: d.week, kind: d.kind, by_id: d.byId, at: d.at, note: d.note, assignee_id: d.assigneeId ?? null, due_week: d.dueWeek ?? null });
export const decisionFromRow = (r: DecisionRow): Decision => ({ id: r.id, goalId: r.goal_id, checkInId: r.check_in_id, reviewId: r.review_id ?? null, week: Number(r.week), kind: r.kind, byId: r.by_id, at: iso(r.at), note: r.note, ...(r.assignee_id ? { assigneeId: r.assignee_id } : {}), ...(r.due_week != null ? { dueWeek: Number(r.due_week) } : {}) });
export const changeToRow = (ws: string, c: Change): ChangeRow => ({ workspace_id: ws, id: c.id, at: c.at, actor_id: c.actorId, goal_id: c.goalId, entity: c.entity, entity_id: c.entityId, action: c.action, summary: c.summary, diffs: c.diffs });
export const changeFromRow = (r: ChangeRow): Change => ({ id: r.id, at: iso(r.at), actorId: r.actor_id, goalId: r.goal_id, entity: r.entity, entityId: r.entity_id, action: r.action, summary: r.summary, diffs: r.diffs ?? [] });

export interface WatchRow extends W { id: string; person_id: string; kind: Watch['kind']; ref: string }
export const watchToRow = (ws: string, w: Watch): WatchRow => ({ workspace_id: ws, id: w.id, person_id: w.personId, kind: w.kind, ref: w.ref });
export const watchFromRow = (r: WatchRow): Watch => ({ id: r.id, personId: r.person_id, kind: r.kind, ref: r.ref });

export interface ReviewRow extends W {
  id: string; name: string; every_weeks: number; weekday: number; scope: Review['scope']; people: string[]; created_by: string; created_at: string;
}
export const reviewToRow = (ws: string, r: Review): ReviewRow => ({
  workspace_id: ws, id: r.id, name: r.name, every_weeks: r.everyWeeks, weekday: r.weekday, scope: r.scope, people: r.people, created_by: r.createdBy, created_at: r.createdAt,
});
export const reviewFromRow = (r: ReviewRow): Review => ({
  id: r.id, name: r.name, everyWeeks: Number(r.every_weeks), weekday: Number(r.weekday),
  scope: { goals: r.scope?.goals ?? [], trees: r.scope?.trees ?? [], levels: r.scope?.levels ?? [] }, people: r.people ?? [], createdBy: r.created_by, createdAt: iso(r.created_at),
});

export interface RetroRow extends W {
  id: string; goal_id: string; cycle_id: string; result: Retro['result']; learned: string; next: Retro['next']; by_id: string; at: string;
}
export const retroToRow = (ws: string, r: Retro): RetroRow => ({ workspace_id: ws, id: r.id, goal_id: r.goalId, cycle_id: r.cycleId, result: r.result, learned: r.learned, next: r.next, by_id: r.byId, at: r.at });
export const retroFromRow = (r: RetroRow): Retro => ({ id: r.id, goalId: r.goal_id, cycleId: r.cycle_id, result: r.result, learned: r.learned, next: r.next, byId: r.by_id, at: iso(r.at) });

export interface FeedbackRow extends W { id: string; person_id: string; path: string; mood: Feedback['mood']; text: string; at: string }
export const feedbackToRow = (ws: string, f: Feedback): FeedbackRow => ({ workspace_id: ws, id: f.id, person_id: f.personId, path: f.path, mood: f.mood, text: f.text, at: f.at });
export const feedbackFromRow = (r: FeedbackRow): Feedback => ({ id: r.id, personId: r.person_id, path: r.path, mood: r.mood, text: r.text, at: iso(r.at) });
