/* The goals domain. Everything the screens show is derived from these records by the
   pure functions in plan.ts, status.ts and checkin.ts. */
import type { ModuleRows } from './records';

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
  /** Their email, lower case: how a spreadsheet, the import and the AI assistant tell people apart (two people can share a
      name). Required when someone is added; people added before emails existed have none until an admin fills it in. */
  email?: string | null;
  /** Marked as left (domain/removal): gone from pickers, counts, reviews and Home; history keeps their name, "Name (left)". */
  leftAt?: string | null;
  leftBy?: Id | null;
  /** Deleted outright (only someone with no history): kept, hidden everywhere, restorable for 30 days. */
  removedAt?: string | null;
  removedBy?: Id | null;
}

/** How important a goal is to the organisation, for reporting at major reviews. Separate from what it feeds. */
/** A goal's level: an id from its cycle's levels (domain/levels.ts). Faro's three are 'north-star', 'svp' and 'team'. */
export type Level = string;

/** A level a workspace has: its id (stored on goals), its name, and the hint the goal form shows (domain/levels.ts). */
export interface LevelDef {
  id: Level;
  name: string;
  hint: string;
  /** Removed: goals moved off it; its name is kept for History. */
  removedAt?: string | null;
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
  /** Day of the weekly review, 0 = Monday. Check-ins are due before it. */
  reviewDay: number;
  /** The levels its goals can have, top first; none means Faro's three (domain/levels.ts DEFAULT_LEVELS). The rules read it, but nothing stores it yet: the database has no column for it and a goal's level must be one of Faro's three (okr_goals_level_check in schema.sql), so every cycle has Faro's three today. Levels set per workspace are R6a's. */
  levels?: LevelDef[] | null;
  /** Deleted (only a cycle with no check-ins): kept, hidden, restorable. */
  removedAt?: string | null;
  removedBy?: Id | null;
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
  /** Which side the number must stay: at most the limit, at least it, or between `lower` and the limit (the upper bound). */
  bound: 'atMost' | 'atLeast' | 'between';
  limit: number;
  /** A range between two numbers: the lower bound, below the limit. Absent for a one-sided range. */
  lower?: number;
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
  /** The goal's short, readable key in its workspace (G-1, G-2 …): given when it's created, never changed or used for
      another goal, and kept when the goal carries into the next cycle. The stores make sure every goal has one. */
  key?: string;
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
  /** Other goals it also helps, beyond the one it feeds: a dotted line on the map, not part of the tree. */
  alsoHelps?: Id[];
  /** The goals that guard it (GR; domain/guards): goals kept in a range, whose number past its limit makes this goal
      at risk or off track. Absent or empty: none. */
  guards?: { goal: Id }[];
  /** Where the number comes from and who owns that source. */
  source: string;
  definition: string;
  createdAt: string;
  /** A proposed plan change. Not used while target changes save directly; kept for governance later. */
  pending?: PendingChange | null;
  /** Bumped on every save, so a save based on an older version is refused rather than overwriting a newer one. */
  version?: number;
  /** Deleted (a goal with no check-ins): kept, hidden everywhere, restorable. */
  removedAt?: string | null;
  removedBy?: Id | null;
  /** Stopped mid-cycle (a goal with history): out of stats, reviews, Home and attention, still in its history. */
  stoppedAt?: string | null;
  stoppedBy?: Id | null;
  stopReason?: string | null;
  /** Proposed, not yet active (goal entry GE10, rule 14; domain/proposed): visible to everyone, never judged, nothing
      due. Set when proposed; cleared (null) when made active. Never set with stoppedAt. */
  proposedAt?: string | null;
  /** Who proposed it: set only with proposedAt. While it is proposed they may change or withdraw it too. */
  proposedBy?: Id | null;
  /** The review (Review.id) it was proposed in, from "Propose a new goal" in the walk (GE10, decision 15); kept once it
      is made active, so the next session's "Last time" can say so. Left out when it was proposed anywhere else. */
  proposedIn?: Id | null;
  /** Held to no number since then (MS; domain/unmeasured): what measures it isn't measured yet, so it has no status
      from its plan, nothing on it is late, and a baseline isn't asked for. Set and cleared by whatever measures it (the
      metric library, when it links the goal to a metric with a gap); absent or null when it is held to its plan. */
  unmeasuredSince?: string | null;
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
  /** The week of the latest re-plan. */
  rebaselinedWeek: number | null;
  /** The baseline as a field of its own (BL, domain/baseline): a figure known for a period, often provisional; its
      value is the plan's start. Shown as the goal's number until its first check-in. Absent or null: none. */
  baseline?: Baseline | null;
  /** A proposed goal with a baseline and nothing else yet (GB, domain/proposed targetNotSet): no target agreed yet, so
      `plan.target` only holds the start and means nothing; read this first. Never set on an active goal: making it
      active asks for the target (rule 2). Absent: the target is set. */
  targetUnset?: true;
  /** Every earlier plan, oldest first: each applied to the weeks before its untilWeek (and after the one before it). */
  planHistory?: PlanVersion[];
}

/** A baseline (BL): the figure, the period it covers in words, and whether it may still be firmed up. */
export interface Baseline { value: number; period: string; provisional: boolean }

export interface PlanVersion { untilWeek: number; plan: MetricPlan }

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
export type DisplayStatus = Status | 'stale' | 'planned' | 'none' | 'unmeasured';

// 'other' when none of the named causes fits (research, 2 Nov): the words then carry it.
export type CauseBehind = 'aggressive' | 'slower' | 'blocked' | 'external' | 'data' | 'other';
export type CauseAhead = 'cautious' | 'early' | 'external' | 'oneoff' | 'data' | 'other';
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
  /** Where its number came from (NR rule 2): what the metric's source said and when it measured it, and why the owner's
      number differs, when it does. Absent or null when the number was typed with nothing read. `value` above is always
      the owner's number; nothing that judges a goal reads this. */
  reading?: CheckInReading | null;
  /** Deleted (only while no newer check-in exists on the goal): kept, hidden, restorable. */
  removedAt?: string | null;
  removedBy?: Id | null;
}

/** Why an owner's number differs from what the source said (NR 2.2): the source is behind, counts something else, is
    wrong this week, or something else (in their words). */
export type ReadingWhyKind = 'behind' | 'other-count' | 'wrong' | 'else';

/** What a check-in recorded of its metric's source (NR rule 2; migration 0047's `reading`). */
export interface CheckInReading {
  /** The source's name, as the metric names it. */
  source: string;
  value: number;
  /** When the source measured it (an ISO time). */
  at: string;
  /** Set only when the check-in's number differs from `value`. */
  why?: { kind: ReadingWhyKind; text?: string };
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
  entity: 'goal' | 'check-in' | 'decision' | 'workspace' | 'note' | 'review' | 'person' | 'retro' | 'cycle' | 'request' | 'view' | 'watch' | 'metric' | 'field';
  entityId: Id;
  action: 'created' | 'edited' | 'posted' | 'approved' | 'declined' | 'acknowledged' | 'asked' | 'imported' | 'reset' | 'proposed' | 'withdrawn' | 'noted' | 'actioned' | 'removed' | 'answered' | 'linked' | 'done' | 'restored' | 'stopped' | 'ended' | 'left' | 'undone';
  summary: string;
  diffs: Diff[];
  /** The import or bulk edit this change was part of (its summary entry's entityId), so the whole of it can be undone. */
  importId?: Id | null;
  /** On an import's summary entry only: every record it wrote, as it was before (null: the import added it). */
  undo?: ImportUndo | null;
}

/** What an import or bulk edit replaced, so "Undo this import" can put every row back (domain/removal undoImport). */
export interface ImportUndo {
  goals: { id: Id; before: Goal | null }[];
  checkIns: { id: Id; before: CheckIn | null }[];
  people: { id: Id; before: Person | null }[];
  requests: { id: Id; before: Ask | null }[];
  /** Reviews and teams a row's Action changed (someone marked as left leaves their reviews and hands over their teams). */
  reviews?: { id: Id; before: Review | null }[];
  teams?: { id: Id; before: Team | null }[];
  /** Starting a year (domain/carry carryExtras): the watches, and the modules' rows (a metric link), it added for the
      carried goals. */
  watches?: Id[];
  modules?: { module: string; key: string; ids: Id[] }[];
}

/**
 * A comment on a goal, as it reads now (domain/removal commentsOf). Comments are stored as change-log entries (entity
 * 'note'): written ('noted'), then edited, removed and restored by later entries, so the log stays append-only and old
 * comments read as they always did.
 */
export interface Comment {
  id: Id;
  goalId: Id;
  authorId: Id;
  text: string;
  at: string;
  editedAt: string | null;
  removedAt: string | null;
  removedBy: Id | null;
}

/** What someone said about a goal in a review: seen, or a note. A question or an action said in a review is an ask
    (Ask, kinds question and action); review.ts's saidIn shows them beside the notes as one record of the session.
    The ask and action kinds here belong to data from before one ask model (asks.ts's upgradeAsks converts them), and
    approve and decline to data from before approvals were dropped. */
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
  /** When the words were last corrected (shown as "edited"). */
  editedAt?: string | null;
  /** Deleted (a note): kept, read as "Note removed", restorable. */
  removedAt?: string | null;
  removedBy?: Id | null;
}

/** Something a person keeps an eye on: one goal, a goal and everything feeding it, or every goal at a level. */
export interface Watch {
  id: Id;
  personId: Id;
  kind: 'goal' | 'tree' | 'level';
  /** A goal id, or a level. */
  ref: string;
  /** Stopped watching: kept, so it can be undone or restored. */
  removedAt?: string | null;
  removedBy?: Id | null;
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
  /** Bumped on every save (see Goal.version). */
  version?: number;
  /** Ended: keeps its notes and actions, no longer due. */
  endedAt?: string | null;
  endedBy?: Id | null;
  /** Deleted (a review never held): kept, hidden, restorable. */
  removedAt?: string | null;
  removedBy?: Id | null;
}

export interface Workspace {
  id: Id;
  name: string;
  kind: 'example' | 'own';
  createdAt: string;
  /** Whether the app records how it is used here (src/telemetry). Stored only when off, so a missing value means on (the demo's example records); a workspace set up in the app starts off unless its set-up box was ticked (requirement TELEMETRY-SWITCH), and only an admin turns it on or off after. */
  recording?: boolean;
  /** Feature modules an admin has switched off here, by id (docs/architecture.md). Everything else is on. */
  modulesOff?: string[];
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
  /** Personal tokens for AI assistants (the MCP server). */
  tokens?: ApiToken[];
  /** Saved views of the goals: each person's own, and any an admin pinned for everyone. */
  views?: SavedView[];
  /** Every ask (a decision or help, an update, a question, an action): open until answered, done or withdrawn. The
      name is the stored table's, from before asks had kinds. */
  requests?: Ask[];
  /** Every feature module's own records (domain/records, AS part 2), by module id and then by the key the module files
      them under: `modules.metrics.metrics`, say. The core never reads inside them; the module that declares them does.
      Rows of a module this build leaves out stay as they are. */
  modules?: ModuleRows;
  /** The highest goal key given in the workspace so far, across every cycle (set when a snapshot is scoped to one
      cycle), so a new goal's key is never one an earlier cycle used. */
  keysIssued?: number;
  /**
   * Set when a snapshot is scoped (domain/cycle scopeToCycle): records kept for history but out of every list, stat,
   * picker, attention list and review. Stopped goals with their check-ins and notes, people who left, ended reviews.
   * Deleted records are in neither; they're read from the whole snapshot (Recently removed).
   */
  archive?: Archive;
  /**
   * Set when a snapshot is scoped (domain/cycle scopeToCycle): this cycle's proposed goals (domain/proposed). Kept out
   * of `goals`, as stopped goals are, so no count, status, check-in, review or wrap-up ever judges one; the places that
   * list them (Goals with its filter, Find, their own page, the sheet and the tools) read them from here.
   */
  proposed?: Goal[];
  /**
   * Set only when the snapshot was loaded with a window (ports/store LoadWindow, AX5 part 2): what was left out. Check-ins
   * of cycles that ended before `from`, and change-log entries before it other than the anchors (ports/window.ts), are
   * not loaded; `checkInCycles` names every cycle with any check-in, in the whole workspace, so a rule asking whether a
   * cycle has one needn't load them. Older entries come a page at a time from Store.history.
   */
  history?: { from: string; checkInCycles: string[] };
}

export interface Archive {
  goals: Goal[];
  checkIns: CheckIn[];
  decisions: Decision[];
  people: Person[];
  reviews: Review[];
}

/** Where an ask stands: open until the person asked responds (answered; an action: done) or it's taken back. */
export type AskStatus = 'open' | 'answered' | 'done' | 'withdrawn';

/**
 * What an ask is for: a decision or help the owner needs from someone (often raised in a check-in); an update (someone
 * asks a goal's owner to check in); a question for the owner (in a review or on the goal page); or an action (something
 * someone agreed to do, usually in a review, by a week).
 */
export type AskKind = 'decision' | 'update' | 'question' | 'action';

/**
 * One way to ask (consolidation 4, 5 Nov): every ask that puts an obligation on someone. Who asked, who must respond, by
 * when (optional), the goals it's about, and where it stands: open until it's answered (an action: done) or withdrawn,
 * each said explicitly. Comments carry no obligation and aren't asks. Stored in okr_requests (extended by migration
 * 0023; the table's name predates the other kinds). A decision ask can apply to several goals: an owner links their goal
 * to one already raised for another, and one answer applies to all of them. The first goal is the one it was raised on.
 */
export interface Ask {
  id: Id;
  kind: AskKind;
  goalIds: Id[];
  askedBy: Id;
  /** Who must respond: the person asked, the goal's owner (an update or a question), or whoever does the action. Null: anyone. */
  recipientId: Id | null;
  /** What was asked, in their words. */
  ask: string;
  status: AskStatus;
  /** The week it's due by, if any. */
  dueWeek: number | null;
  /** The review it was raised in, and that session's week, if it was. */
  reviewId: Id | null;
  week: number | null;
  /** The check-in that raised it (a decision or help). */
  checkInId: Id | null;
  createdAt: string;
  updatedAt: string;
  /** The answer; for an action, the note it was marked done with (may be empty). */
  answer: string | null;
  answeredBy: Id | null;
  answeredAt: string | null;
}

/**
 * A saved view of the goals: a name, and the search, filters, sort, grouping and layout as a query string (the same one
 * a shared link carries). It's one person's; an admin can pin one for everyone. Deleting sets deletedAt.
 */
export interface SavedView {
  id: Id;
  personId: Id;
  name: string;
  params: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Who deleted it. */
  deletedBy?: Id | null;
}

/** A personal token an AI assistant uses to act as one person in one workspace. Only its hash is kept. */
export interface ApiToken {
  id: Id;
  personId: Id;
  /** What it's for, e.g. "Claude on my laptop". */
  name: string;
  /** The SHA-256 hash of the token. Kept by the database, which never hands it back: the app and the MCP server's
      context see tokens without it. The demo's browser store keeps it. */
  tokenHash?: string;
  createdBy: Id;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  /** Made as a builder token, before Faro opened its inbox (migration 0031): it now works as an ordinary token, and is
      labelled apart (backlog 10a). Read from the database (okr_token_list, migration 0034); never saved by the app. */
  builder?: boolean;
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
