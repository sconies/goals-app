/* Domain records ⇄ okr_ table rows. Pure, so both directions are tested without a database.
   Every row carries the workspace it belongs to. */
import type { DbRow, ModuleRecords, ModuleRows } from '../domain/records';
import type { ApiToken, Ask, SavedView, Change, CheckIn, Cycle, Decision, Goal, Level, MetricPlan, Person, Review, Stage, Team, Watch, Workspace, Retro, Feedback, RecoveryState, CheckInReading } from '../domain/types';

type W = { workspace_id: string };
/** Removal columns (migration 0025): written only when the record says (a restore says null), so rows for older tables
    and records that were never removed look exactly as before. */
type Removal = { removed_at?: string | null; removed_by?: string | null };
const set = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
/** A removal timestamp read back: only when there is one, so records never removed read exactly as before. */
const when = (k: string, v: string | null | undefined) => (v ? { [k]: new Date(v).toISOString() } : {});
const who = (k: string, v: string | null | undefined) => (v ? { [k]: v } : {});
export interface WorkspaceRow { id: string; name: string; kind: Workspace['kind']; created_at: string; recording?: boolean | null; modules_off?: string[] | null }
export interface TeamRow extends W { id: string; name: string; lead_id: string | null; objective: string }
export interface PersonRow extends W, Removal { id: string; name: string; role: string; initials: string; team_id: string | null; is_admin: boolean; left_at?: string | null; left_by?: string | null; email?: string | null }
export interface CycleRow extends W, Removal { id: string; name: string; start_date: string; weeks: number; review_day: number }
export interface StageRow extends W { id: string; goal_id: string; name: string; due_week: number }
export interface GoalRow extends W, Removal {
  stopped_at?: string | null; stopped_by?: string | null; stop_reason?: string | null;
  /** GE10 (migration 0041): written only when set, as stopped_at is; null clears it. */
  proposed_at?: string | null; proposed_by?: string | null;
  /** GE10 (migration 0045): the review a goal was proposed in, written only when set. */
  proposed_in?: string | null;
  /** MS (migration 0046): held to no number since then, written only when set; null clears it. */
  unmeasured_since?: string | null;
  id: string; key?: string | null; cycle_id: string; team_id: string; owner_id: string; parent_id: string | null; title: string;
  kind: Goal['kind']; io: Goal['io']; headline: boolean; level: Level; guardrail: boolean; effect: number | null; why_helps?: string | null; source: string; definition: string;
  unit: string | null; decimals: number | null; plan_start: number | null; plan_target: number | null; plan_shape: MetricPlan['shape'] | null; plan_from_week?: number | null; plan_end_week?: number | null; plan_points?: MetricPlan['points'] | null;
  original_plan: MetricPlan | null; rebaselined_week: number | null; range_bound: 'atMost' | 'atLeast' | 'between' | null; range_limit: number | null;
  /** A range between two numbers (migration 0042): its lower bound; range_limit is then the upper one. Null otherwise. */
  range_lower?: number | null;
  range_margin: number | null; created_at: string; pending?: Goal['pending']; version?: number; also_helps?: string[] | null;
  plan_history?: { untilWeek: number; plan: MetricPlan }[] | null;
}
export interface CheckInRow extends W, Removal {
  id: string; goal_id: string; author_id: string; week: number; posted_at: string; value: number | null; stages: CheckIn['stages'];
  status: CheckIn['status']; calculated: CheckIn['calculated']; cause: CheckIn['cause']; why: string; greener_why: string;
  propose_target: number | null; ptg_what: string | null; ptg_by_week: number | null; ptg_needs: string; ptg_state?: RecoveryState | null; next: string; data_flagged: boolean; backfilled?: boolean; reading?: CheckInReading | null;
}
export interface DecisionRow extends W, Removal { id: string; goal_id: string; check_in_id: string | null; review_id: string | null; week: number; kind: Decision['kind']; by_id: string; at: string; note: string; assignee_id?: string | null; due_week?: number | null; edited_at?: string | null }
export interface ChangeRow extends W {
  id: string; at: string; actor_id: string; goal_id: string | null; entity: Change['entity']; entity_id: string;
  action: Change['action']; summary: string; diffs: Change['diffs'];
  /** Migration 0025: the import a change was part of, and on an import's summary what it replaced. */
  import_id?: string | null; undo?: Change['undo'];
}

/** Postgres numerics can arrive as strings; timestamps in any ISO form. Normalise both. */
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: string) => new Date(v).toISOString();

// A workspace set up with recording off says so from the start (backlog WS: recording is asked at set-up).
export const workspaceToRow = (w: Workspace): WorkspaceRow => ({ id: w.id, name: w.name, kind: w.kind, created_at: w.createdAt, ...(w.recording === false ? { recording: false } : {}) });
// Recording is on unless it has been turned off (null, or no column before migration 0022, is on).
export const workspaceFromRow = (r: WorkspaceRow): Workspace => ({ id: r.id, name: r.name, kind: r.kind, createdAt: iso(r.created_at), ...(r.recording === false ? { recording: false } : {}), ...(r.modules_off?.length ? { modulesOff: r.modules_off } : {}) });
export const teamToRow = (ws: string, t: Team, withLead = true): TeamRow => ({ workspace_id: ws, id: t.id, name: t.name, lead_id: withLead && t.leadId ? t.leadId : null, objective: t.objective });
export const teamFromRow = (r: TeamRow): Team => ({ id: r.id, name: r.name, leadId: r.lead_id ?? '', objective: r.objective });
// The email (migration 0027) is written only when the person has one (an email removed is written as null), so rows for
// people without one look exactly as before, and a database without the column yet takes the row as it is.
export const personToRow = (ws: string, p: Person): PersonRow => ({ workspace_id: ws, id: p.id, name: p.name, role: p.role, initials: p.initials, team_id: p.teamId, is_admin: p.admin, ...set({ email: p.email, left_at: p.leftAt, left_by: p.leftBy, removed_at: p.removedAt, removed_by: p.removedBy }) });
export const personFromRow = (r: PersonRow): Person => ({ id: r.id, name: r.name, role: r.role, initials: r.initials, teamId: r.team_id, admin: !!r.is_admin, ...(r.email ? { email: r.email } : {}), ...when('leftAt', r.left_at), ...who('leftBy', r.left_by), ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by) });
export const cycleToRow = (ws: string, c: Cycle): CycleRow => ({ workspace_id: ws, id: c.id, name: c.name, start_date: c.startDate, weeks: c.weeks, review_day: c.reviewDay, ...set({ removed_at: c.removedAt, removed_by: c.removedBy }) });
export const cycleFromRow = (r: CycleRow): Cycle => ({ id: r.id, name: r.name, startDate: r.start_date.slice(0, 10), weeks: Number(r.weeks), reviewDay: Number(r.review_day ?? 3), ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by) });

export function goalToRows(ws: string, g: Goal): { goal: GoalRow; stages: StageRow[] } {
  const goal: GoalRow = {
    workspace_id: ws,
    // The key arrives with migration 0021; the database gives one to a goal that comes without (okr_goal_key).
    id: g.id, key: g.key ?? null, cycle_id: g.cycleId, team_id: g.teamId, owner_id: g.ownerId, parent_id: g.parentId, title: g.title, kind: g.kind, io: g.io,
    headline: false, level: g.level, guardrail: g.guardrail, effect: g.effect, why_helps: g.whyHelps ?? null, source: g.source, definition: g.definition,
    unit: g.kind === 'milestone' ? null : g.unit, decimals: g.kind === 'milestone' ? null : g.decimals,
    plan_start: g.kind === 'metric' ? g.plan.start : null, plan_target: g.kind === 'metric' ? g.plan.target : null, plan_shape: g.kind === 'metric' ? g.plan.shape : null, plan_from_week: g.kind === 'metric' ? g.plan.fromWeek ?? 0 : 0, plan_end_week: g.kind === 'metric' ? g.plan.endWeek ?? null : null, plan_points: g.kind === 'metric' && g.plan.points?.length ? g.plan.points : null,
    original_plan: g.kind === 'metric' ? g.originalPlan : null, rebaselined_week: g.kind === 'metric' ? g.rebaselinedWeek : null,
    plan_history: g.kind === 'metric' && g.planHistory?.length ? g.planHistory : null,
    range_bound: g.kind === 'range' ? g.range.bound : null, range_limit: g.kind === 'range' ? g.range.limit : null, range_margin: g.kind === 'range' ? g.range.margin : null,
    // Range goals only (migration 0042): the lower bound of a range between two numbers, null for a one-sided range so a
    // range changed from between to one side clears it. Metric and milestone rows look exactly as before.
    ...(g.kind === 'range' ? { range_lower: g.range.bound === 'between' ? g.range.lower ?? null : null } : {}),
    created_at: g.createdAt || new Date().toISOString(),
    pending: g.pending ?? null,
    also_helps: g.alsoHelps?.length ? g.alsoHelps : null,
    ...set({ removed_at: g.removedAt, removed_by: g.removedBy, stopped_at: g.stoppedAt, stopped_by: g.stoppedBy, stop_reason: g.stopReason, proposed_at: g.proposedAt, proposed_by: g.proposedBy, proposed_in: g.proposedIn, unmeasured_since: g.unmeasuredSince }),
  };
  const stages = g.kind === 'milestone' ? g.stages.map((s) => ({ workspace_id: ws, id: s.id, goal_id: g.id, name: s.name, due_week: s.dueWeek })) : [];
  return { goal, stages };
}

const planOf = (op: MetricPlan): MetricPlan => ({
  start: Number(op.start), target: Number(op.target), shape: op.shape,
  ...(op.fromWeek != null ? { fromWeek: Number(op.fromWeek) } : {}), ...(op.endWeek != null ? { endWeek: Number(op.endWeek) } : {}),
  ...(op.points?.length ? { points: op.points.map((p) => ({ week: Number(p.week), value: Number(p.value) })) } : {}),
});

export function goalFromRows(r: GoalRow, stageRows: StageRow[]): Goal {
  const common = {
    id: r.id, ...(r.key ? { key: r.key } : {}), cycleId: r.cycle_id, teamId: r.team_id, ownerId: r.owner_id, parentId: r.parent_id, title: r.title, io: r.io,
    level: r.level ?? (r.headline ? 'north-star' : 'team'), guardrail: r.guardrail, effect: num(r.effect), ...(r.why_helps ? { whyHelps: r.why_helps } : {}), source: r.source, definition: r.definition, createdAt: iso(r.created_at),
    ...(r.pending ? { pending: r.pending } : {}),
    ...(r.version != null ? { version: Number(r.version) } : {}),
    ...(r.also_helps?.length ? { alsoHelps: r.also_helps } : {}),
    ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by), ...when('stoppedAt', r.stopped_at), ...who('stoppedBy', r.stopped_by), ...who('stopReason', r.stop_reason),
    ...when('proposedAt', r.proposed_at), ...who('proposedBy', r.proposed_by), ...who('proposedIn', r.proposed_in), ...when('unmeasuredSince', r.unmeasured_since),
  };
  if (r.kind === 'metric') {
    const op = r.original_plan;
    return {
      ...common, kind: 'metric', unit: r.unit ?? '', decimals: Number(r.decimals ?? 0),
      plan: { start: num(r.plan_start) as number, target: num(r.plan_target) as number, shape: r.plan_shape ?? 'straight', ...(r.plan_from_week ? { fromWeek: Number(r.plan_from_week) } : {}), ...(r.plan_end_week ? { endWeek: Number(r.plan_end_week) } : {}), ...(r.plan_points?.length ? { points: r.plan_points.map((p) => ({ week: Number(p.week), value: Number(p.value) })) } : {}) },
      // Whole earlier plans, so weeks before a re-plan are judged against exactly what applied then.
      originalPlan: op ? planOf(op) : null, rebaselinedWeek: r.rebaselined_week,
      ...(r.plan_history?.length ? { planHistory: r.plan_history.map((v) => ({ untilWeek: Number(v.untilWeek), plan: planOf(v.plan) })) } : {}),
    };
  }
  if (r.kind === 'range') {
    // The lower bound is read only through faro (0035's public redirects are fixed select * views without range_lower,
    // as with proposed_at): a between range read without it shows its upper bound alone. It can't be saved so: every
    // range goal's row carries range_lower, which those views lack, so the Data API refuses the save rather than
    // overwrite "between" with "at most". The fallback goes with the redirects (backlog 0c, step 2).
    const lower = num(r.range_lower);
    const bound = r.range_bound === 'between' && lower == null ? 'atMost' : r.range_bound ?? 'atMost';
    return { ...common, kind: 'range', unit: r.unit ?? '', decimals: Number(r.decimals ?? 0), range: { bound, limit: num(r.range_limit) as number, ...(bound === 'between' ? { lower: lower as number } : {}), margin: num(r.range_margin) as number } };
  }
  const stages: Stage[] = stageRows.filter((s) => s.goal_id === r.id).map((s) => ({ id: s.id, name: s.name, dueWeek: Number(s.due_week) })).sort((a, b) => a.dueWeek - b.dueWeek);
  return { ...common, kind: 'milestone', stages };
}

export const checkInToRow = (ws: string, c: CheckIn): CheckInRow => ({
  workspace_id: ws,
  id: c.id, goal_id: c.goalId, author_id: c.authorId, week: c.week, posted_at: c.postedAt, value: c.value, stages: c.stages,
  status: c.status, calculated: c.calculated, cause: c.cause, why: c.why, greener_why: c.greenerWhy, propose_target: c.proposeTarget,
  ptg_what: c.pathToGreen?.what ?? null, ptg_by_week: c.pathToGreen?.byWeek ?? null, ptg_needs: c.pathToGreen?.needs ?? '', ptg_state: c.pathToGreen?.state ?? null,
  next: c.next, data_flagged: c.dataFlagged, backfilled: !!c.backfilled,
  // Written only when it holds something (NR rule 2): 0035's public views don't have the column, so a row without it saves
  // through either; one with it needs the app to read and write through faro (0047).
  ...(c.reading ? { reading: c.reading } : {}),
  ...set({ removed_at: c.removedAt, removed_by: c.removedBy }),
});

export const checkInFromRow = (r: CheckInRow): CheckIn => ({
  id: r.id, goalId: r.goal_id, authorId: r.author_id, week: Number(r.week), postedAt: iso(r.posted_at), value: num(r.value), stages: r.stages,
  status: r.status, calculated: r.calculated, cause: r.cause, why: r.why, greenerWhy: r.greener_why, proposeTarget: num(r.propose_target),
  pathToGreen: r.ptg_what != null && (r.ptg_by_week != null || r.ptg_state) ? { what: r.ptg_what, byWeek: r.ptg_by_week == null ? null : Number(r.ptg_by_week), ...(r.ptg_state ? { state: r.ptg_state } : {}), needs: r.ptg_needs } : null,
  next: r.next, dataFlagged: r.data_flagged, ...(r.backfilled ? { backfilled: true } : {}), ...(r.reading ? { reading: r.reading } : {}),
  ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by),
});

export const decisionToRow = (ws: string, d: Decision): DecisionRow => ({ workspace_id: ws, id: d.id, goal_id: d.goalId, check_in_id: d.checkInId, review_id: d.reviewId, week: d.week, kind: d.kind, by_id: d.byId, at: d.at, note: d.note, assignee_id: d.assigneeId ?? null, due_week: d.dueWeek ?? null, ...set({ edited_at: d.editedAt, removed_at: d.removedAt, removed_by: d.removedBy }) });
export const decisionFromRow = (r: DecisionRow): Decision => ({ id: r.id, goalId: r.goal_id, checkInId: r.check_in_id, reviewId: r.review_id ?? null, week: Number(r.week), kind: r.kind, byId: r.by_id, at: iso(r.at), note: r.note, ...(r.assignee_id ? { assigneeId: r.assignee_id } : {}), ...(r.due_week != null ? { dueWeek: Number(r.due_week) } : {}), ...when('editedAt', r.edited_at), ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by) });
export const changeToRow = (ws: string, c: Change): ChangeRow => ({ workspace_id: ws, id: c.id, at: c.at, actor_id: c.actorId, goal_id: c.goalId, entity: c.entity, entity_id: c.entityId, action: c.action, summary: c.summary, diffs: c.diffs, ...set({ import_id: c.importId, undo: c.undo }) });
export const changeFromRow = (r: ChangeRow): Change => ({ id: r.id, at: iso(r.at), actorId: r.actor_id, goalId: r.goal_id, entity: r.entity, entityId: r.entity_id, action: r.action, summary: r.summary, diffs: r.diffs ?? [], ...who('importId', r.import_id), ...(r.undo ? { undo: r.undo } : {}) });

export interface WatchRow extends W, Removal { id: string; person_id: string; kind: Watch['kind']; ref: string }
export const watchToRow = (ws: string, w: Watch): WatchRow => ({ workspace_id: ws, id: w.id, person_id: w.personId, kind: w.kind, ref: w.ref, ...set({ removed_at: w.removedAt, removed_by: w.removedBy }) });
export const watchFromRow = (r: WatchRow): Watch => ({ id: r.id, personId: r.person_id, kind: r.kind, ref: r.ref, ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by) });

export interface ReviewRow extends W, Removal {
  id: string; name: string; every_weeks: number; weekday: number; scope: Review['scope']; people: string[]; created_by: string; created_at: string; version?: number;
  ended_at?: string | null; ended_by?: string | null;
}
export const reviewToRow = (ws: string, r: Review): ReviewRow => ({
  workspace_id: ws, id: r.id, name: r.name, every_weeks: r.everyWeeks, weekday: r.weekday, scope: r.scope, people: r.people, created_by: r.createdBy, created_at: r.createdAt,
  ...set({ ended_at: r.endedAt, ended_by: r.endedBy, removed_at: r.removedAt, removed_by: r.removedBy }),
});
export const reviewFromRow = (r: ReviewRow): Review => ({
  id: r.id, name: r.name, everyWeeks: Number(r.every_weeks), weekday: Number(r.weekday),
  scope: { goals: r.scope?.goals ?? [], trees: r.scope?.trees ?? [], levels: r.scope?.levels ?? [] }, people: r.people ?? [], createdBy: r.created_by, createdAt: iso(r.created_at), ...(r.version != null ? { version: Number(r.version) } : {}),
  ...when('endedAt', r.ended_at), ...who('endedBy', r.ended_by), ...when('removedAt', r.removed_at), ...who('removedBy', r.removed_by),
});

export interface RetroRow extends W {
  id: string; goal_id: string; cycle_id: string; result: Retro['result']; learned: string; next: Retro['next']; by_id: string; at: string;
}
export const retroToRow = (ws: string, r: Retro): RetroRow => ({ workspace_id: ws, id: r.id, goal_id: r.goalId, cycle_id: r.cycleId, result: r.result, learned: r.learned, next: r.next, by_id: r.byId, at: r.at });
export const retroFromRow = (r: RetroRow): Retro => ({ id: r.id, goalId: r.goal_id, cycleId: r.cycle_id, result: r.result, learned: r.learned, next: r.next, byId: r.by_id, at: iso(r.at) });

export interface FeedbackRow extends W { id: string; person_id: string; path: string; mood: Feedback['mood']; text: string; at: string }
export const feedbackToRow = (ws: string, f: Feedback): FeedbackRow => ({ workspace_id: ws, id: f.id, person_id: f.personId, path: f.path, mood: f.mood, text: f.text, at: f.at });
export const feedbackFromRow = (r: FeedbackRow): Feedback => ({ id: r.id, personId: r.person_id, path: r.path, mood: r.mood, text: r.text, at: iso(r.at) });

export interface TokenRow extends W { id: string; person_id: string; name: string; token_hash?: string; created_by: string; created_at: string; last_used_at: string | null; revoked_at: string | null; builder?: boolean }
export const tokenToRow = (ws: string, t: ApiToken): TokenRow => ({ workspace_id: ws, id: t.id, person_id: t.personId, name: t.name, token_hash: t.tokenHash ?? '', created_by: t.createdBy, created_at: t.createdAt, last_used_at: t.lastUsedAt, revoked_at: t.revokedAt });
export interface ViewRow extends W { id: string; person_id: string; name: string; params: string; pinned: boolean; created_at: string; updated_at: string; deleted_at: string | null; deleted_by?: string | null }
export const viewToRow = (ws: string, v: SavedView): ViewRow => ({ workspace_id: ws, id: v.id, person_id: v.personId, name: v.name, params: v.params, pinned: v.pinned, created_at: v.createdAt, updated_at: v.updatedAt, deleted_at: v.deletedAt, ...set({ deleted_by: v.deletedBy }) });
export const viewFromRow = (r: ViewRow): SavedView => ({ id: r.id, personId: r.person_id, name: r.name, params: r.params ?? '', pinned: !!r.pinned, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), deletedAt: r.deleted_at ? iso(r.deleted_at) : null, ...who('deletedBy', r.deleted_by) });
/** Every ask (okr_requests; kind, due_week, review_id and week arrive with migration 0023: a row without them is a decision or help). */
export interface RequestRow extends W { id: string; kind?: Ask['kind'] | null; goal_ids: string[]; asked_by: string; recipient_id: string | null; ask: string; status: Ask['status']; due_week?: number | null; review_id?: string | null; week?: number | null; check_in_id: string | null; answer: string | null; answered_by: string | null; answered_at: string | null; created_at: string; updated_at: string }
export const requestToRow = (ws: string, r: Ask): RequestRow => ({ workspace_id: ws, id: r.id, kind: r.kind, goal_ids: r.goalIds, asked_by: r.askedBy, recipient_id: r.recipientId, ask: r.ask, status: r.status, due_week: r.dueWeek, review_id: r.reviewId, week: r.week, check_in_id: r.checkInId, answer: r.answer, answered_by: r.answeredBy, answered_at: r.answeredAt, created_at: r.createdAt, updated_at: r.updatedAt });
export const requestFromRow = (r: RequestRow): Ask => ({ id: r.id, kind: r.kind ?? 'decision', goalIds: r.goal_ids ?? [], askedBy: r.asked_by, recipientId: r.recipient_id, ask: r.ask, status: r.status, dueWeek: r.due_week == null ? null : Number(r.due_week), reviewId: r.review_id ?? null, week: r.week == null ? null : Number(r.week), checkInId: r.check_in_id, answer: r.answer, answeredBy: r.answered_by, answeredAt: r.answered_at ? iso(r.answered_at) : null, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });
export const tokenFromRow = (r: TokenRow): ApiToken => ({ id: r.id, personId: r.person_id, name: r.name, ...(r.token_hash ? { tokenHash: r.token_hash } : {}), createdBy: r.created_by, createdAt: iso(r.created_at), lastUsedAt: r.last_used_at ? iso(r.last_used_at) : null, revokedAt: r.revoked_at ? iso(r.revoked_at) : null, ...(r.builder ? { builder: true } : {}) });

/**
 * Each feature module's rows in a save, by table: what okr_commit's `modules` takes (migration 0039), for the records
 * the modules in this build declare (domain/records). Empty when a save has none.
 */
export function moduleTableRows(ws: string, c: Pick<import('./store').Commit, 'modules'>, records: readonly ModuleRecords[]): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const m of records) for (const def of m.records) {
    const rows = c.modules?.[m.module]?.[def.key] ?? [];
    if (rows.length) out[def.table] = [...(out[def.table] ?? []), ...rows.map((r) => def.toRow(ws, r as never))];
  }
  return out;
}

/** One save as the payload okr_commit takes: rows for each table, stages per milestone, and what the save expects. The
    feature modules' rows go under `modules`, by table, for the records `records` declares. */
export function commitPayload(ws: string, c: import('./store').Commit, records: readonly ModuleRecords[] = []) {
  const modules = moduleTableRows(ws, c, records);
  const goals = (c.goals ?? []).map((g) => ({ g, ...goalToRows(ws, g) }));
  return {
    cycles: (c.cycles ?? []).map((x) => cycleToRow(ws, x)),
    people: (c.people ?? []).map((p) => personToRow(ws, p)),
    goals: goals.map((x) => x.goal),
    stages: goals.filter((x) => x.g.kind === 'milestone').map((x) => ({ goal_id: x.g.id, keep: x.stages.map((st) => st.id), rows: x.stages })),
    check_ins: (c.checkIns ?? []).map((x) => checkInToRow(ws, x)),
    reviews: (c.reviews ?? []).map((x) => reviewToRow(ws, x)),
    feedback: (c.feedback ?? []).map((x) => feedbackToRow(ws, x)),
    retros: (c.retros ?? []).map((x) => retroToRow(ws, x)),
    decisions: (c.decisions ?? []).map((x) => decisionToRow(ws, x)),
    watches: (c.watches ?? []).map((x) => watchToRow(ws, x)),
    unwatch: c.unwatch ?? [],
    tokens: (c.tokens ?? []).map((x) => tokenToRow(ws, x)),
    views: (c.views ?? []).map((x) => viewToRow(ws, x)),
    requests: (c.requests ?? []).map((x) => requestToRow(ws, x)),
    // Feature modules' rows by table (migration 0039's okr_write takes any table on its allowed list); only when a
    // save has some, so saves without look as they did.
    ...(Object.keys(modules).length ? { modules } : {}),
    // Teams (migration 0020 adds removing them and renaming the workspace to the same transaction).
    ...(c.teams?.length ? { teams: c.teams.map((x) => teamToRow(ws, x)) } : {}),
    ...(c.removeTeams?.length ? { remove_teams: c.removeTeams } : {}),
    ...(c.workspace ? { workspace_name: c.workspace.name } : {}),
    // The recording switch (migration 0022's okr_write sets okr_workspaces.recording).
    ...(c.recording !== undefined ? { workspace_recording: c.recording } : {}),
    // The feature modules switched off (migration 0030's okr_write sets okr_workspaces.modules_off).
    ...(c.modulesOff !== undefined ? { workspace_modules_off: c.modulesOff } : {}),
    changes: c.changes.map((x) => changeToRow(ws, x)),
    expect: c.expect ? {
      goals: c.expect.goals, reviews: c.expect.reviews,
      check_ins: c.expect.checkIns.map((x) => ({ goal_id: x.goalId, week: x.week, id: x.id })),
    } : null,
  };
}

/** Every declared module record's rows in a workspace, read with `read(table)`, as the workspace holds them (domain/records). */
export async function loadModules(records: readonly ModuleRecords[], read: (table: string) => Promise<DbRow[] | null>): Promise<ModuleRows | undefined> {
  const out: ModuleRows = {};
  await Promise.all(records.flatMap((m) => m.records.map(async (def) => {
    const rows = await read(def.table);
    if (!rows?.length) return;
    const list = rows.map((r) => def.fromRow(r));
    if (def.order) list.sort(def.order);
    (out[m.module] ??= {})[def.key] = list;
  })));
  return Object.keys(out).length ? out : undefined;
}
