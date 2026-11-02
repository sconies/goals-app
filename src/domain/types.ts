/* The goals domain. Everything the screens show is derived from these records by the
   pure functions in plan.ts, status.ts and checkin.ts. */

export type Id = string;

/** Everyone can see everything; what a person can change follows from the goals they own.
    Admins (whoever set the workspace up, and anyone they add) also manage people and settings. */
export interface Person {
  id: Id;
  name: string;
  /** Job title, shown under the name. */
  role: string;
  initials: string;
  teamId: Id | null;
  admin: boolean;
}

/** How important a goal is to the organisation, for reporting at major reviews. Separate from what it feeds. */
export type Level = 'north-star' | 'svp' | 'team';

export interface Team {
  id: Id;
  name: string;
  leadId: Id;
  objective: string;
}

export interface Cycle {
  id: Id;
  name: string;
  /** ISO date (yyyy-mm-dd) of week 0, the day the cycle starts. */
  startDate: string;
  /** Weeks in the cycle; checkpoints are weeks 0..weeks. */
  weeks: number;
  /** Day of the weekly review, 0 = Monday. Check-ins are due before it. */
  reviewDay: number;
}

export type PlanShape = 'straight' | 'back' | 'stepped';
export type GoalKind = 'metric' | 'range' | 'milestone';
export type Io = 'input' | 'output';

export interface MetricPlan {
  start: number;
  target: number;
  shape: PlanShape;
  /** The week the plan starts from: 0, or the week a goal was set up mid-cycle. Negative once carried into a later cycle. */
  fromWeek?: number;
  /** The week the target is due, counted from this cycle's start: the cycle's end unless the goal runs longer (e.g. to the end of the year). */
  endWeek?: number;
  /** Plan numbers set by hand at checkpoints between the start and the end. When present, the plan runs straight between them instead of following the shape. */
  points?: { week: number; value: number }[];
}

export interface RangePlan {
  bound: 'atMost' | 'atLeast';
  limit: number;
  /** Values this close to the limit count as at risk. */
  margin: number;
}

export interface Stage {
  id: Id;
  name: string;
  dueWeek: number;
}

interface GoalBase {
  id: Id;
  cycleId: Id;
  teamId: Id;
  ownerId: Id;
  title: string;
  io: Io;
  level: Level;
  guardrail: boolean;
  /** The goal this one feeds. Goals with nothing above them are the tops of their trees. */
  parentId: Id | null;
  /** Estimated effect on the parent's metric, in the parent's unit (e.g. days off). */
  effect: number | null;
  /** Optional: why we expect this goal to help the one it feeds. A hypothesis, not a proven cause. */
  whyHelps?: string;
  /** Where the number comes from and who owns that source. */
  source: string;
  definition: string;
  createdAt: string;
  /** A proposed plan change. Not used while target changes save directly; kept for governance later. */
  pending?: PendingChange | null;
}

export interface PendingChange {
  /** The goal as it would be if the change is approved. */
  proposed: Goal;
  byId: Id;
  at: string;
  week: number;
  reason: string;
}

export interface MetricGoal extends GoalBase {
  kind: 'metric';
  unit: string;
  decimals: number;
  plan: MetricPlan;
  /** The first plan, kept when the plan is re-baselined after check-ins started. */
  originalPlan: MetricPlan | null;
  rebaselinedWeek: number | null;
}

export interface RangeGoal extends GoalBase {
  kind: 'range';
  unit: string;
  decimals: number;
  range: RangePlan;
}

export interface MilestoneGoal extends GoalBase {
  kind: 'milestone';
  stages: Stage[];
}

export type Goal = MetricGoal | RangeGoal | MilestoneGoal;

export type Status = 'on' | 'risk' | 'off' | 'done';
export type DisplayStatus = Status | 'stale' | 'planned' | 'none';

export type CauseBehind = 'aggressive' | 'slower' | 'blocked' | 'external' | 'data';
export type CauseAhead = 'cautious' | 'early' | 'external' | 'oneoff' | 'data';
export type Cause = CauseBehind | CauseAhead;

export interface StageUpdate {
  stageId: Id;
  doneWeek: number | null;
  /** When the owner now expects it, if not done. Null means on its due week. */
  forecastWeek: number | null;
}

/** Where the owner is with getting a goal back on plan. Only "plan" has a week it's back by. */
export type RecoveryState = 'plan' | 'investigating' | 'help' | 'target';

export interface PathToGreen {
  /** What changes, what's being looked into, what help is needed, or why the target should move. */
  what: string;
  /** The checkpoint week by which it is back on plan; null when that isn't known yet. */
  byWeek: number | null;
  needs: string;
  state?: RecoveryState;
}

export interface CheckIn {
  id: Id;
  goalId: Id;
  authorId: Id;
  week: number;
  postedAt: string;
  /** Metric and range goals: the value this week. */
  value: number | null;
  /** Milestone goals: the state of every stage. */
  stages: StageUpdate[] | null;
  /** The owner's call. Official everywhere. */
  status: Status;
  /** What the rules calculated when it was posted. */
  calculated: Status;
  cause: Cause | null;
  why: string;
  greenerWhy: string;
  proposeTarget: number | null;
  pathToGreen: PathToGreen | null;
  next: string;
  dataFlagged: boolean;
  /** Loaded later from a spreadsheet or another tool, not posted in its week. */
  backfilled?: boolean;
}

/** A field that changed: values are already formatted for reading. */
export interface Diff {
  field: string;
  from: string;
  to: string;
}

/** One saved change. Drafts are never logged; anything that leaves draft is. */
export interface Change {
  id: Id;
  at: string;
  actorId: Id;
  goalId: Id | null;
  entity: 'goal' | 'check-in' | 'decision' | 'workspace' | 'note' | 'review' | 'person' | 'retro' | 'cycle';
  entityId: Id;
  action: 'created' | 'edited' | 'posted' | 'approved' | 'declined' | 'acknowledged' | 'asked' | 'imported' | 'reset' | 'proposed' | 'withdrawn' | 'noted' | 'actioned' | 'removed';
  summary: string;
  diffs: Diff[];
}

/** What someone said about a goal in a review: seen, a note, a question for the owner, or an action.
    (The approve and decline kinds belong to old data, from before approvals were dropped.) */
export interface Decision {
  id: Id;
  goalId: Id;
  checkInId: Id | null;
  /** The review it was said in, if any. */
  reviewId: Id | null;
  week: number;
  kind: 'approve-target' | 'decline-target' | 'approve-change' | 'decline-change' | 'acknowledge' | 'ask' | 'note' | 'action';
  byId: Id;
  at: string;
  note: string;
  /** Actions: who does it, and the week it's due by (optional). */
  assigneeId?: Id | null;
  dueWeek?: number | null;
}

/** Something a person keeps an eye on: one goal, a goal and everything feeding it, or every goal at a level. */
export interface Watch {
  id: Id;
  personId: Id;
  kind: 'goal' | 'tree' | 'level';
  /** A goal id, or a level. */
  ref: string;
}

/** A goal review on a cadence: which goals it walks, and who takes part. Anyone can set one up. */
export interface Review {
  id: Id;
  name: string;
  /** Held every this many weeks of the cycle, on this weekday (0 = Monday). */
  everyWeeks: number;
  weekday: number;
  scope: { goals: Id[]; trees: Id[]; levels: Level[] };
  people: Id[];
  createdBy: Id;
  createdAt: string;
}

export interface Workspace {
  id: Id;
  name: string;
  kind: 'example' | 'own';
  createdAt: string;
}

export interface Snapshot {
  people: Person[];
  teams: Team[];
  cycles: Cycle[];
  goals: Goal[];
  checkIns: CheckIn[];
  decisions: Decision[];
  changes: Change[];
  watches: Watch[];
  reviews: Review[];
  retros: Retro[];
  /** What people said about the app itself, from the feedback button. */
  feedback?: Feedback[];
}

export interface Feedback {
  id: Id;
  personId: Id;
  /** The screen it was sent from. */
  path: string;
  mood: 'good' | 'meh' | 'bad';
  text: string;
  at: string;
}

/** How a goal ended the cycle, in its owner's words, and what happens to it next. */
export interface Retro {
  id: Id;
  goalId: Id;
  cycleId: Id;
  result: 'hit' | 'partly' | 'missed';
  /** One or two sentences: what we learned. */
  learned: string;
  next: 'carry' | 'stop';
  byId: Id;
  at: string;
}
