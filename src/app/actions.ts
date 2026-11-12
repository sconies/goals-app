/* One way to run an action (backlog RD, AR3; docs/design/architecture.md, 1.4). Every change a person makes goes
   through `run(action, input)`: the action's name and an input that names records by id, never the records themselves,
   an actor, a time or an id. This table turns each into a call of the shared rule in src/domain, unchanged. It is the
   command port's shape inside Faro (spec/rebuild/ports-at-scale.md): the internal app swaps the dispatcher's body
   (app/state.tsx `run`) for a call to its server and changes no screen. No screens, storage or network here. */
import * as A from '../domain/actions';
import * as R from '../domain/removal';
import type { Answers, PostMode, Via } from '../domain/changeset';

/*
 * The change engine (domain/changeset: check-ins, plan and goal edits, bulk edits, spreadsheets) is a large module a
 * first visit doesn't need, so it loads on its own: on the first action that uses it (the dispatcher awaits `ready`),
 * or earlier, when the browser is idle after the first screen (`loadEngine`). A screen that previews changes while it
 * renders (Quick check-in, Data, bulk edit, People, Import) imports src/app/engineReady.ts, which sets it as the screen
 * loads. The actions stay synchronous rules.
 */
type Engine = typeof import('../domain/changeset');
let engine: Engine | null = null;
export async function loadEngine(): Promise<Engine> { return (engine ??= await import('../domain/changeset')); }
/** Sets the engine from a screen that imports it statically (src/app/engineReady.ts), so the screen's previews can run
    during its first render. */
export function setEngine(e: Engine) { engine ??= e; }
/** The actions that need the change engine. */
const NEEDS_ENGINE = new Set(['planChanges', 'postCheckIn']);
/** Loads what an action needs before it runs: the dispatcher calls it first. */
export async function ready(name: string): Promise<void> { if (NEEDS_ENGINE.has(name)) await loadEngine(); }
const eng = (): Engine => { if (!engine) throw new Error('The change engine hasn’t loaded yet: call ready() first.'); return engine; };
import type { Draft } from '../domain/checkin';
import { planGoal, type SaveGoalInput } from '../domain/goalEntry';
import { findGoal } from '../domain/goalKey';
import type { Tables } from '../domain/sheets';
import type { TableLayout } from '../domain/tableLayout';
import type { Goal, Person, Retro, Review, Watch, Workspace } from '../domain/types';
import type { Commit } from '../domain/commit';
import MODULE_PARTS from 'virtual:faro-modules/actions';
import { recordsOn } from '../core/records';
import { isModuleOn, moduleById } from '../core/registry';

/** What the dispatcher hands each action: the rules' context, and the workspace itself for the few that change it. */
export interface RunContext extends A.ActionContext {
  workspace: Pick<Workspace, 'id' | 'name' | 'recording' | 'modulesOff'>;
  /** The feature modules installed, for switching one on or off (domain/actions setModule). */
  modules: readonly { id: string; name: string; needs: string[] }[];
}

const gone = (what: string): never => { throw new A.NotAllowed(`That ${what} no longer exists. Reload to see the latest.`); };

/** A goal by id or key: this cycle's, then any cycle's, then one stopped (its page still opens). */
const goalOf = (x: RunContext, id: string): Goal =>
  findGoal(x.snapshot.goals, id) ?? (x.allGoals && findGoal(x.allGoals, id)) ?? (x.snapshot.archive && findGoal(x.snapshot.archive.goals, id)) ?? gone('goal');
const askOf = (x: RunContext, id: string) => A.findAsk(x, id) ?? gone('ask');
const reviewOf = (x: RunContext, id: string): Review => x.snapshot.reviews.find((r) => r.id === id) ?? gone('review');
const callOf = (x: RunContext, id: string) => A.findAsk(x, id) ?? x.snapshot.decisions.find((d) => d.id === id) ?? gone('note');

type Who = { goalsTo?: string | null; asksTo?: string | null };

/**
 * The actions, by name. Each is (context, input) → what the rule returns: a Commit to save, `{ commit, … }`, or null
 * when nothing changed. A rule that says no throws `NotAllowed` with words to show. The names are the command port's
 * (R1's access table names each one's rule; src/app/actions.test.ts holds the two lists together).
 */
export const ACTIONS = {
  /* Goals, plans and check-ins. planChanges previews; the dispatcher saves it only with `apply`. */
  planChanges: (x: RunContext, i: { tables: Tables; via: Via; reason?: string; confirm?: boolean; answers?: Answers; apply?: boolean; file?: { name: string; leftOut?: number } }) =>
    eng().planChanges({ tables: i.tables, snapshot: x.snapshot, cycle: x.cycle, week: x.week, actor: x.actor, now: x.now, newId: x.newId, via: i.via, reason: i.reason, confirm: i.confirm, answers: i.answers, full: x.full, records: x.records, file: i.file }),
  /* One check-in from its screen, through the same engine (check-in spec, rule 13). The week defaults to this one. */
  postCheckIn: (x: RunContext, i: { goalId: string; draft: Draft; mode: PostMode; week?: number; reason?: string }) =>
    eng().postCheckIn(x, { goalId: goalOf(x, i.goalId).id, week: i.week ?? x.week, draft: i.draft, mode: i.mode, reason: i.reason }),
  /* A goal from New goal or the edit page (goal entry, rule 7): the same rights and Must fix as every other door. */
  saveGoal: (x: RunContext, i: SaveGoalInput) => planGoal(x, i),
  stopGoal: (x: RunContext, i: { goalId: string; reason: string }) => R.stopGoal(x, goalOf(x, i.goalId).id, i.reason),
  deleteGoal: (x: RunContext, i: { goalId: string }) => R.deleteGoal(x, goalOf(x, i.goalId).id),
  deleteCheckIn: (x: RunContext, i: { checkInId: string }) => R.deleteCheckIn(x, i.checkInId),
  saveRetro: (x: RunContext, i: { goalId: string } & Pick<Retro, 'result' | 'learned' | 'next'>) => A.saveRetro(x, goalOf(x, i.goalId), i),
  recordStagesDone: (x: RunContext, i: { goalId: string; stageIds: string[] }) => A.recordStagesDone(x, goalOf(x, i.goalId), i.stageIds),
  undoImport: (x: RunContext, i: { importId: string }) => R.undoImport(x, i.importId),

  /* Comments, next steps and asks. */
  addNote: (x: RunContext, i: { goalId: string; text: string }) => A.addNote(x, goalOf(x, i.goalId), i.text),
  addAction: (x: RunContext, i: { goalId: string; text: string; assigneeId?: string | null; dueWeek?: number | null }) =>
    A.addAction(x, goalOf(x, i.goalId), i.text, { assigneeId: i.assigneeId, dueWeek: i.dueWeek }),
  editComment: (x: RunContext, i: { commentId: string; text: string }) => R.editComment(x, i.commentId, i.text),
  deleteComment: (x: RunContext, i: { commentId: string }) => R.deleteComment(x, i.commentId),
  askForUpdate: (x: RunContext, i: { goalId: string }) => A.askForUpdate(x, goalOf(x, i.goalId)),
  askQuestion: (x: RunContext, i: { goalId: string; text: string }) => A.askQuestion(x, goalOf(x, i.goalId), i.text),
  undoUpdateAsk: (x: RunContext, i: { goalId: string }) => A.undoUpdateAsk(x, goalOf(x, i.goalId)),
  answerRequest: (x: RunContext, i: { askId: string; answer: string }) => A.answerRequest(x, askOf(x, i.askId), i.answer),
  markActionDone: (x: RunContext, i: { askId: string; note?: string }) => A.markActionDone(x, askOf(x, i.askId), i.note ?? ''),
  linkRequest: (x: RunContext, i: { askId: string; goalId: string }) => A.linkRequest(x, askOf(x, i.askId), goalOf(x, i.goalId)),
  withdrawRequest: (x: RunContext, i: { askId: string; goalId?: string }) => A.withdrawRequest(x, askOf(x, i.askId), i.goalId ? goalOf(x, i.goalId) : undefined),

  /* Reviews. */
  saveReview: (x: RunContext, i: { review: Review }) => A.saveReview(x, i.review, x.snapshot.reviews.find((r) => r.id === i.review.id) ?? null),
  reviewCall: (x: RunContext, i: { goalId: string; reviewId: string; kind: A.CallKind; note: string; week?: number; assigneeId?: string | null; dueWeek?: number | null }) =>
    A.reviewCall(x, goalOf(x, i.goalId), reviewOf(x, i.reviewId), i.kind, i.note, { week: i.week, assigneeId: i.assigneeId, dueWeek: i.dueWeek }),
  acceptRisk: (x: RunContext, i: { goalId: string; reviewId: string; reason: string; week: number }) => A.acceptRisk(x, goalOf(x, i.goalId), reviewOf(x, i.reviewId), i.reason, i.week),
  markReviewed: (x: RunContext, i: { goalIds: string[]; reviewId: string; week: number }) => A.markReviewed(x, i.goalIds.map((id) => goalOf(x, id)), reviewOf(x, i.reviewId), i.week),
  editCall: (x: RunContext, i: { callId: string; note: string; assigneeId?: string | null; dueWeek?: number | null }) =>
    A.editCall(x, callOf(x, i.callId), i.note, i.assigneeId === undefined && i.dueWeek === undefined ? undefined : { assigneeId: i.assigneeId, dueWeek: i.dueWeek }),
  unmarkReviewed: (x: RunContext, i: { decisionIds: string[] }) => R.unmarkReviewed(x, x.snapshot.decisions.filter((d) => i.decisionIds.includes(d.id))),
  deleteNote: (x: RunContext, i: { noteId: string }) => R.deleteNote(x, i.noteId),
  endReview: (x: RunContext, i: { reviewId: string }) => R.endReview(x, i.reviewId),
  deleteReview: (x: RunContext, i: { reviewId: string }) => R.deleteReview(x, i.reviewId),

  /* Watching and views. */
  watch: (x: RunContext, i: { kind: Watch['kind']; ref: string }) => A.watch(x, i.kind, i.ref),
  unwatch: (x: RunContext, i: { watchId: string }) => A.unwatch(x, i.watchId),
  saveView: (x: RunContext, i: { id?: string; name: string; params: string }) => A.saveView(x, i),
  saveTableView: (x: RunContext, i: { id?: string; name: string; layout: TableLayout; head?: readonly string[] }) => A.saveTableView(x, { id: i.id, name: i.name, layout: i.layout }, i.head),
  deleteView: (x: RunContext, i: { viewId: string }) => A.deleteView(x, i.viewId),
  pinView: (x: RunContext, i: { viewId: string; pinned: boolean }) => A.pinView(x, i.viewId, i.pinned),

  /* People, teams, cycles and the workspace. */
  savePerson: (x: RunContext, i: { person: Person }) => A.savePerson(x, i.person, x.snapshot.people.find((p) => p.id === i.person.id) ?? null),
  markPersonLeft: (x: RunContext, i: { personId: string } & Who) => R.markPersonLeft(x, i.personId, { goalsTo: i.goalsTo, asksTo: i.asksTo }),
  deletePerson: (x: RunContext, i: { personId: string }) => R.deletePerson(x, i.personId),
  leaveWorkspace: (x: RunContext, i: Who) => R.leaveWorkspace(x, i),
  saveTeam: (x: RunContext, i: { id?: string; name: string; leadId?: string | null }) => A.saveTeam(x, i),
  removeTeam: (x: RunContext, i: { teamId: string; moveTo?: string | null }) => A.removeTeam(x, i.teamId, i.moveTo),
  startNextCycle: (x: RunContext, _i: Record<string, never>) => A.startNextCycle(x),
  deleteCycle: (x: RunContext, i: { cycleId: string }) => R.deleteCycle(x, i.cycleId),
  undoStart: (x: RunContext, i: { cycleId: string }) => R.undoStart(x, i.cycleId),
  renameWorkspace: (x: RunContext, i: { name: string }) => A.renameWorkspace(x, x.workspace, i.name),
  setRecording: (x: RunContext, i: { on: boolean }) => A.setRecording(x, x.workspace, i.on),
  setModule: (x: RunContext, i: { moduleId: string; on: boolean }) => A.setModule(x, x.workspace, x.modules, i.moduleId, i.on),
  restoreRemoved: (x: RunContext, i: { kind: R.RemovedKind; id: string }) => R.restoreRemoved(x, i.kind, i.id, recordsOn(x.workspace)),
  createToken: (x: RunContext, i: { personId: string; name: string }) => A.createToken(x, i.personId, i.name),
  revokeToken: (x: RunContext, i: { tokenId: string }) => A.revokeToken(x, i.tokenId),
  sendFeedback: (x: RunContext, i: { mood: 'good' | 'meh' | 'bad'; text: string; path: string }) => A.sendFeedback(x, i.mood, i.text, i.path),

} as const;

export type ActionName = keyof typeof ACTIONS;
export type ActionInput<N extends ActionName> = Parameters<(typeof ACTIONS)[N]>[1];
export type ActionResult<N extends ActionName> = ReturnType<(typeof ACTIONS)[N]>;

/**
 * A feature module's action (AS part 2): registered in the same table by the module's actions.ts, read through the
 * registry (virtual:faro-modules/actions), so app/state.tsx carries no method for it. `said` is what a removal says,
 * with Undo, as the core's removals do.
 */
export interface ModuleAction<I = any, O = any> {
  run(x: RunContext, input: I): O;
  /** The AI tools that do the same, so an assistant can do whatever a person can (src/mcp/parity.test.ts). */
  tools: string[];
  said?(out: NonNullable<O>, input: I): string;
}
/** What a module's actions.ts default-exports: its actions, by name. */
export type ModuleActions = Record<string, ModuleAction>;

/** Every module's actions in this build, by name, with the module each belongs to. */
export const MODULE_ACTIONS: Readonly<Record<string, ModuleAction & { module: string }>> = Object.fromEntries(
  MODULE_PARTS.flatMap((p) => Object.entries(p.part).map(([name, a]) => [name, { ...a, module: p.id }] as const)),
);
/** Every action's name: the core's, then the modules'. The command port lists the same (src/app/actions.test.ts). */
export const actionNames = (): string[] => [...Object.keys(ACTIONS), ...Object.keys(MODULE_ACTIONS)];

/** Run one action's rule: what it would save, or NotAllowed. Nothing is saved here (app/state.tsx `run` saves it). */
export function perform<N extends ActionName>(x: RunContext, name: N, input: ActionInput<N>): ActionResult<N> {
  return performAny(x, name, input) as ActionResult<N>;
}

/** Run any action's rule by name, the core's or a module's: what app/state.tsx `run` calls. */
export function performAny(x: RunContext, name: string, input: unknown): unknown {
  const fn = (ACTIONS as Record<string, (x: RunContext, i: unknown) => unknown>)[name];
  if (fn) return fn(x, input);
  const mod = MODULE_ACTIONS[name];
  if (!mod) throw new Error(`There’s no action called ${String(name)}.`);
  // A module switched off in the workspace runs nothing, as its AI tools say it's off.
  if (!isModuleOn(x.workspace, mod.module)) throw new A.NotAllowed(`${moduleById(mod.module)?.name ?? mod.module} is switched off in ${x.workspace.name}. An admin can switch it on in Workspace, under Features.`);
  return mod.run(x, input);
}

/** The commit an action's result carries, if any: a Commit, `{ commit, … }`, or null. A change set's only with `apply`. */
export function commitOf(name: ActionName | string, out: unknown, input: unknown): Commit | null {
  if (!out) return null;
  if (name === 'planChanges') return (input as { apply?: boolean }).apply ? (out as { commit: import('../domain/commit').Commit | null }).commit : null;
  return 'commit' in (out as object) ? (out as { commit: import('../domain/commit').Commit | null }).commit : (out as import('../domain/commit').Commit);
}

/** What `run` gives back: the rule's result, or for a token the secret, shown once. */
export type RunResult<N extends ActionName> = N extends 'createToken' ? string : ActionResult<N>;
