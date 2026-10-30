/* The goals domain. Everything the screens show is derived from these records by the
   pure functions in plan.ts, status.ts and checkin.ts. */

export type Id = string;

export interface Person {
  id: Id;
  name: string;
  role: string;
  initials: string;
  teamId: Id | null;
}

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
}

export type PlanShape = 'straight' | 'back' | 'stepped';
export type GoalKind = 'metric' | 'range' | 'milestone';
export type Io = 'input' | 'output';

export interface MetricPlan {
  start: number;
  target: number;
  shape: PlanShape;
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
  /** The cycle's headline (output) goal; input goals point at it with parentId. */
  headline: boolean;
  guardrail: boolean;
  parentId: Id | null;
  /** Estimated effect on the parent's metric, in the parent's unit (e.g. days off). */
  effect: number | null;
  /** Where the number comes from and who owns that source. */
  source: string;
  definition: string;
  createdAt: string;
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

export interface PathToGreen {
  what: string;
  /** The checkpoint week by which it is back on plan. */
  byWeek: number;
  needs: string;
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
}

export interface Snapshot {
  people: Person[];
  teams: Team[];
  cycles: Cycle[];
  goals: Goal[];
  checkIns: CheckIn[];
}
