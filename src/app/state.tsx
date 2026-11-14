import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { systemClock, viewerPicker } from '../adapters/local';
import type { Clock, Identity, NoEntry } from '../ports';
import { appWindow } from '../ports/window';
import type { HistoryAsk, HistoryPage } from '../ports/store';
import * as A from '../domain/actions';
import { attentionFor, type GoalAttention } from '../domain/attention';
import type { Lookup } from '../domain/changes';
import type { GoalDraft } from '../domain/goal';
import type { Draft } from '../domain/checkin';
import { currentWeek } from '../domain/plan';
import { invitedTo } from '../domain/dayOne';
import { checkInsFor, goalStatus, type GoalStatus } from '../domain/status';
import type { CheckIn, CheckInReading, Cycle, Decision, Goal, Ask, Person, Retro, Review, Snapshot, Team, Watch, Workspace } from '../domain/types';
import { currentCycle, scopeToCycle, withArchivedGoal, withoutRemoved } from '../domain/cycle';
import { findGoal, withKeys } from '../domain/goalKey';
import type { TableLayout } from '../domain/tableLayout';
import { sendDemoFeedback } from './research';
import { MODULES } from '../core/registry';
import { MODULE_RECORDS, recordsOn } from '../core/records';
import { applyCommit, EXAMPLE, examplesOf, isStale, newId, withExpectations, type Commit, type Mode, type Store } from '../data/store';
import type { Answers, ChangeInput, ChangeSet, CheckInPost, PostMode, Tables, Via } from '../domain/changeset';
import { ACTIONS } from '../mcp/parity';
import { saveRerunning } from './rerun';
import { commitOf, loadEngine, loadGoalEntry, MODULE_ACTIONS, perform, performAny, ready, rerunsWhenStale, type ActionInput, type ActionName, type RunContext, type RunResult, type SaveGoalWith } from './actions';

/** What previewChanges is given, and applyChanges sends again with apply. */
export type ChangePlan = Omit<ActionInput<'planChanges'>, 'apply'>;
/** A preview, with the plan it was made from, so applyChanges re-runs that plan rather than trusting the shown commit. */
export type Preview = ChangeSet & { plan: ChangePlan };
import { telemetry } from '../telemetry';
import { isOffline, recoverFromStaleCode } from '../telemetry/staleCode';
import * as R from '../domain/removal';
import { forgetDemoBrowser, forgetWorkspaceBrowser } from './demoBrowser';
import { avatarHues, duplicateTitles, goalTell, nameWithTell } from '../domain/people';
import { COMMENT_REMOVED, ENDED, leftName, NOTE_REMOVED, RESTORE_DAYS, UNDO_MS } from '../domain/vocabulary';

/** The actions telemetry names, one trace each: every one in AppState (parity.ts lists them), except previewChanges,
    which only works out a change, and createWorkspace, which is timed where it's defined (onboarding uses it too). */
const TRACED = Object.keys(ACTIONS).filter((k) => k !== 'previewChanges' && k !== 'createWorkspace' && k !== 'run');
function traced(v: AppState): AppState {
  const out = { ...v } as unknown as Record<string, unknown>;
  for (const k of TRACED) {
    const fn = out[k];
    if (typeof fn === 'function') out[k] = (...args: unknown[]) => telemetry.action(k, () => (fn as (...a: unknown[]) => unknown)(...args));
  }
  return out as unknown as AppState;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
  /** One thing to do about it, such as Undo after a removal: the message then stays for 10 seconds. */
  action?: ToastAction;
}
export interface ToastAction { label: string; run: () => void }

export interface AppState {
  /** The real app, or the demo (example data, role switcher, reset). */
  mode: Mode;
  /** In the real app, whether we know who this person is in this workspace (signed in, or chosen with the picker).
      Until then nothing can be saved: outside the demo there is no stand-in. */
  viewerChosen: boolean;
  /** Whether the Identity is the picker, so the person may say who they are; a sign-in can't be chosen. */
  canChooseViewer: boolean;
  /** Why the sign-in opens no one in this workspace, when it can tell (Identity.why); null otherwise. */
  noEntry: NoEntry | null;
  ws: Workspace;
  workspaces: Workspace[];
  /** The workspace being opened while it loads (switching), else null: the screen says so rather than mixing the two (backlog WS). */
  opening: Workspace | null;
  /** Opens another workspace. Screens switch through ui/WorkspaceSwitch's useSwitchWorkspace, which also makes a history entry. */
  switchWorkspace(id: string): void;
  /** Set up a workspace; `recording` is whether it records how the app is used, as chosen at set-up (off unless chosen). */
  createWorkspace(name: string, data: Snapshot, meId?: string, recording?: boolean): Promise<string>;
  resetExample(): Promise<void>;
  /** The open workspace as the demo built it, before this browser's saves, when it is the example; null otherwise
      (a workspace of your own, or the real app). The metric module makes the demo's number sources from it (NR). */
  exampleSeed(): Promise<Snapshot | null>;
  /** Admins: delete the open workspace (not an example) and everything in it, then open another. */
  deleteWorkspace(): Promise<void>;
  /** Admins: give the open workspace a new name. */
  renameWorkspace(name: string): Promise<void>;
  /** Admins: add a team, or rename one or change its lead. Returns its id. */
  saveTeam(t: { id?: string; name: string; leadId?: string | null; objective?: string }): Promise<string>;
  /** Admins: remove a team; one with people or goals moves them to `moveTo` in the same save. */
  removeTeam(id: string, moveTo?: string | null): Promise<void>;
  /** Admins: turn on or off recording of how the app is used in the open workspace. Off, nothing is sent. */
  setRecording(on: boolean): Promise<void>;
  /** Admins: switch a feature module on or off in the open workspace (docs/architecture.md). */
  setModule(id: string, on: boolean): Promise<void>;
  /** Admins: the check-in rhythm of the running cycle (FT1): every week (with its due day) or none. `from` is for Undo. */
  setRhythm(to: { weeks: number; dueDay?: number; from?: string | null }): Promise<void>;
  snapshot: Snapshot;
  /** Every goal in the workspace, in every cycle (snapshot has this cycle's): for what reaches past it, like a team's goals. */
  allGoals: Goal[];
  cycle: Cycle;
  week: number;
  today: Date;
  viewer: Person;
  /** Say who you are here (the picker). `arriving`: chosen on the arrival screen, so the log says so once (rule S4). */
  setViewer(id: string, arriving?: boolean): void;
  person(id: string): Person | undefined;
  /** A person's name, with their team or job title beside it when someone else here has the same name (backlog N). */
  personName(id: string): string;
  /** What goes beside a goal's title when another goal this cycle has the same title: its key, or its team. */
  goalTell(g: Goal): string | null;
  /** A person's avatar colour: different for two people with the same initials (domain/people avatarHues). */
  avatarHue(id: string): number | undefined;
  team(id: string): Team | undefined;
  goal(id: string): Goal | undefined;
  statusOf(goal: Goal): GoalStatus;
  attentionOf(goal: Goal): GoalAttention;
  checkInsOf(goal: Goal): CheckIn[];
  lookup: Lookup;
  /**
   * Run an action by name (app/actions.ts): the one way every change goes, in the command port's shape. The input names
   * records by id; who acts, when and new ids are set here, never by the caller. A rule that says no is shown and thrown;
   * a removal shows Undo for 10 seconds. The action methods below are aliases of it; new code calls it directly.
   */
  run<N extends ActionName>(name: N, input: ActionInput<N>, opts?: { said?: string }): Promise<RunResult<N>>;
  /** A feature module's action, by the name its actions.ts registers (app/actions MODULE_ACTIONS): run the same way. */
  run(name: string, input: unknown, opts?: { said?: string }): Promise<unknown>;
  /** Posts (or replaces) this week's check-in and logs it. */
  /** Post a check-in through the engine (rule 13): `new` for this week, or `again` beside this week's own. */
  /** `reason` is a correction's why (mode `correct`, at least MIN_CORRECT_REASON characters). */
  /** One check-in, through the engine. `reading`: what the metric's source said, from the number step's module block
      (the place checkin.number; NR rule 3), recorded with it when the rule allows. */
  postCheckIn(goal: Goal, draft: Draft, mode: PostMode, reason?: string, reading?: CheckInReading | null): Promise<CheckIn>;
  /** Answer an ask (a decision or help, an update, a question): one answer for every goal it applies to. */
  answerRequest(r: Ask, answer: string): Promise<void>;
  /** Mark an action done, with an optional note. */
  markActionDone(r: Ask, note?: string): Promise<void>;
  /** Link a goal to a decision or help raised for another goal: waiting on the same decision. */
  linkRequest(r: Ask, goal: Goal): Promise<void>;
  /** Withdraw an ask; on a goal linked to another goal's request, stop waiting on it. */
  withdrawRequest(r: Ask, goal?: Goal): Promise<void>;
  /** Saves a goal from its draft through the `saveGoal` action (goal entry, rule 7: domain/goalEntry planGoal): the same
      rights and Must fix as a file and the AI tools, and History with the reason when the plan moved. `goal` is the goal
      being changed (null for a new one). A new goal's stages said to be already done (`stagesDone`, onboarding rule 3)
      are recorded done in the same save. `also`: a module's action for the goal as saved (what measures it, from the
      goal.measure place), run on the workspace with the goal in it and saved in the same commit. Gives back the goal as saved. */
  saveGoal(draft: GoalDraft, goal: Goal | null, opts?: Omit<SaveGoalWith, 'draft' | 'goalId'>): Promise<Goal>;
  /** A logged comment on a goal. Anyone can comment; it doesn't change the status, and it asks nothing of anyone. */
  addNote(goal: Goal, text: string): Promise<void>;
  /** Ask a goal's owner for an update: open on their Home until they check in or answer it, or it's withdrawn. */
  askForUpdate(goal: Goal): Promise<void>;
  undoUpdateAsk(goal: Goal): Promise<void>;
  /** Ask a goal's owner a question: open until they answer it. */
  askQuestion(goal: Goal, text: string): Promise<void>;
  /** What someone says about a goal in a review: seen, a note, a question for the owner, or an action. */
  reviewCall(goal: Goal, review: Review, week: number, kind: 'acknowledge' | 'note' | 'ask' | 'action', note: string, extra?: { assigneeId?: string | null; dueWeek?: number | null }): Promise<void>;
  /** Mark several goals reviewed in a session at once (the ones with nothing flagged), with Undo. */
  markReviewed(goals: Goal[], review: Review, week: number, said?: string): Promise<void>;
  /** Correct a note, question or action someone said; the change log keeps the before and after. */
  editCall(d: Decision | Ask, note: string, extra?: { assigneeId?: string | null; dueWeek?: number | null }): Promise<void>;
  /** In a review: no action on a goal behind for now, with a reason (decide.ts). */
  acceptRisk(goal: Goal, review: Review, week: number, reason: string): Promise<void>;
  /** A next step on a goal, outside a review: what, who and by when (the goal page). */
  addAction(goal: Goal, text: string, extra: { assigneeId: string; dueWeek: number | null }): Promise<void>;
  /** Watch a goal, a goal and everything feeding it, or a whole level. */
  watch(kind: Watch['kind'], ref: string): Promise<void>;
  unwatch(watchId: string): Promise<void>;
  /** Creates or changes a review. */
  saveReview(review: Review, before: Review | null): Promise<void>;
  /** Admins: add someone, or change their name, team or admin rights. */
  savePerson(person: Person, before: Person | null): Promise<void>;
  /** An owner's retro on one of their goals at the end of the cycle. */
  saveRetro(goal: Goal, retro: Retro, before: Retro | null): Promise<void>;
  /** Feedback about the app itself, from the screen it was sent from. Not in the change log. */
  sendFeedback(mood: 'good' | 'meh' | 'bad', text: string, path: string): Promise<void>;
  /** Admins: start the next cycle with the goals that carry on. Returns the new cycle's name. */
  startNextCycle(): Promise<string>;
  /** Works out what a set of rows would change (from a spreadsheet, the bulk grid or a table action), without saving. */
  /** `posts`: check-ins from a screen (the table check-in), judged as the form's are, so what they answered is kept. */
  previewChanges(tables: Tables, via: Via, reason?: string, confirm?: boolean, answers?: Answers, file?: { name: string; leftOut?: number }, posts?: CheckInPost[]): Preview;
  /** What previewChanges hands the engine, made now, for a check run off this thread (the import's worker, backlog IM6). */
  changeInput(tables: Tables, via: Via, answers?: Answers, file?: { name: string; leftOut?: number }): ChangeInput;
  /** Saves what previewChanges was given, worked out again now (the planChanges action, with apply, from the plan the
      preview carries): all of it, or none. Gives back the change set saved. */
  applyChanges(cs: Preview): Promise<ChangeSet>;
  /** Admins: a personal token for an AI assistant to act as this person. Returns the token, shown once. */
  createToken(personId: string, name: string): Promise<string>;
  /** Admins, or the token's person: stop a token working. */
  revokeToken(id: string): Promise<void>;
  /** Save a view of the goals (new, or one of yours renamed or changed). Returns its id. */
  saveView(v: { id?: string; name: string; params: string }): Promise<string>;
  /** Save a data table's layout (columns in order, widths, search, filters, sort) as a named table view. Returns its id. */
  saveTableView(v: { id?: string; name: string; layout: TableLayout }, head?: readonly string[]): Promise<string>;
  /** Delete one of your views (an admin: anyone's), with Undo. */
  deleteView(id: string): Promise<void>;
  /* Removing, archiving and undoing (domain/removal): each shows a message with Undo for 10 seconds and is logged. */
  /** Admins: mark someone as left, handing their goals and open asks to the people given. */
  markPersonLeft(id: string, to: { goalsTo?: string | null; asksTo?: string | null }): Promise<void>;
  /** Anyone: leave the open workspace yourself, handing over your goals and open asks; never the only admin. Opens another workspace after, if there is one. */
  leaveWorkspace(to: { goalsTo?: string | null; asksTo?: string | null }): Promise<void>;
  /** Admins: delete someone with no history. */
  deletePerson(id: string): Promise<void>;
  /** Owner or admin: stop a goal with check-ins, with a reason. */
  stopGoal(goal: Goal, reason: string): Promise<void>;
  /** Owner or admin: delete a goal with no check-ins. */
  deleteGoal(goal: Goal): Promise<void>;
  /** Author or admin: delete a goal's latest check-in. */
  deleteCheckIn(c: CheckIn): Promise<void>;
  /** Review owner or admin: end a review (one never held is deleted). */
  endReview(id: string): Promise<void>;
  /** Review owner or admin: delete a review that was never held. */
  deleteReview(id: string): Promise<void>;
  /** The author: correct a comment, which then shows as edited. */
  editComment(id: string, text: string): Promise<void>;
  /** Author or admin: remove a comment, leaving "Comment removed". */
  deleteComment(id: string): Promise<void>;
  /** Whoever said it, or an admin: remove a note said in a review. */
  deleteNote(id: string): Promise<void>;
  /** Admins: delete a cycle no one has checked in to. */
  deleteCycle(id: string): Promise<void>;
  /** Admins: undo starting the next cycle while nobody has used it (domain/removal undoStart). */
  undoStart(cycleId: string): Promise<void>;
  /** Whoever imported, or an admin: put every row an import or bulk edit wrote back as it was. */
  undoImport(importId: string): Promise<{ restored: number; skipped: R.KeptRow[] }>;
  /** What Undo would do to an import, saving nothing (rule 9): rows that go back, and those that stay, with why. */
  undoPreview(importId: string): { restores: number; skipped: R.KeptRow[] };
  /** Admins, or whoever removed it: bring back something removed in the last 30 days. */
  restoreRemoved(kind: R.RemovedKind, id: string): Promise<void>;
  /** Everything removed in the last 30 days, newest first (Workspace → Recently removed). */
  recentlyRemoved(): R.Removed[];
  /** A comment as it reads now (edited, or removed), by its id. */
  comment(id: string): import('../domain/types').Comment | undefined;
  /** The whole workspace, every cycle and every removed record (snapshot is this cycle's, live records only). Loaded with
      a window (AX5 part 2b): `full.history` says what was left out, and `olderChanges` pages it in. */
  full: Snapshot;
  /** Older change-log entries than the load holds, a page at a time, newest first (Store.history). */
  olderChanges(ask: HistoryAsk): Promise<HistoryPage>;
  /** Admins: show a view to everyone in the workspace, or stop. */
  pinView(id: string, pinned: boolean): Promise<void>;
  /** Now, as an ISO timestamp on the app's today. Use for anything saved. */
  stamp(): string;
  toast(text: string, kind?: Toast['kind'], action?: ToastAction): void;
  storeKind: Store['kind'];
  /** When this browser isn't keeping saves (full, or blocked): why, in words to show. Changes still apply for this visit. */
  saveNote: string | null;
}

const Ctx = createContext<AppState | null>(null);
/** The app's state as a provider, for a page that shows the workspace with one record put back (ProposedGoal). */
export const AppStateProvider = Ctx.Provider;

/** What onboarding needs before any workspace exists. */
export interface SetupState {
  mode: Mode;
  today: Date;
  hasWorkspaces: boolean;
  createWorkspace(name: string, data: Snapshot, meId?: string, recording?: boolean): Promise<string>;
  /** Every workspace the store lists, once `listed`; the one open (or opening), if any. */
  workspaces: Workspace[];
  listed: boolean;
  openId: string | null;
  /** Open a workspace someone chose (Welcome's Open, an invitation), and remember it on this device. */
  open(id: string): void;
  /** What this device remembers (Welcome, set-up spec 2.1): each workspace you've said who you are in, last opened first. */
  remembered(): { ws: Workspace; me: string; week: number | null }[];
  toasts: Toast[];
  toast(text: string, kind?: Toast['kind']): void;
}
const SetupCtx = createContext<SetupState | null>(null);

export function useSetup(): SetupState {
  const v = useContext(SetupCtx);
  if (!v) throw new Error('useSetup outside AppProvider');
  return v;
}

/** The app's state where there is one (inside AppProvider), else null: for small shared pieces like the avatar. */
export function useMaybeApp(): AppState | null {
  return useContext(Ctx);
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/**
 * A stopped goal's own page (and its print view): the app as it is, with that one goal and its check-ins and notes put
 * back, so the page shows it as it stood, marked Stopped. Every list outside this scope still leaves it out.
 * For a goal that isn't stopped it passes the app through unchanged; the page always renders inside it, so stopping,
 * restarting or undoing doesn't mount the page afresh (which replayed the chart's entrance under the Undo message).
 */
export function ArchivedGoalScope({ goalId, children }: { goalId: string; children: ReactNode }) {
  const app = useApp();
  const value = useMemo<AppState>(() => {
    if (!app.snapshot.archive?.goals.some((g) => g.id === goalId)) return app;
    const snapshot = withArchivedGoal(app.snapshot, goalId);
    const mine = (g: Goal) => g.id === goalId;
    return {
      ...app, snapshot,
      statusOf: (g) => (mine(g) ? goalStatus(g, app.cycle, snapshot.checkIns, app.today) : app.statusOf(g)),
      attentionOf: (g) => (mine(g) ? attentionFor(g, snapshot, app.cycle, app.today) : app.attentionOf(g)),
      checkInsOf: (g) => checkInsFor(g, snapshot.checkIns),
    };
  }, [app, goalId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** What a correction says once saved (check-in spec 2.7): "Week 44 corrected: 60% is now 61%.", from the engine's own summary. */
export const correctedLine = (summary: string) => {
  const m = /^Corrected week (\d+): (.*)$/.exec(summary);
  if (m) return `Week ${m[1]} corrected: ${m[2]}.`;
  const a = /^Added week (\d+) later: (.*)$/.exec(summary);
  return a ? `Week ${a[1]} added: ${a[2]}.` : summary;
};
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
type Seen = Record<string, { me: string; at: string; startDate?: string; weeks?: number }>;
const readSeen = (k: string): Seen => { try { return (JSON.parse(read(k) ?? '{}') as Seen) ?? {}; } catch { return {}; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
/** Now, as the person's own wall-clock time: weeks turn over at their midnight on Sunday, wherever they are. */
const wallClock = (clock: Clock) => () => {
  const n = clock();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()));
};

/** Said when an action made in one workspace (an Undo pressed after switching) would save into another: nothing is saved. */
export const ELSEWHERE = 'That was for another workspace, so nothing was changed. Open it to do it there.';

/**
 * Whole days to move a record's stamp so it falls on the app's today: only when today is pinned (the demo and the evals,
 * `?today=`). Unpinned, today is the clock's own wall-clock time, whose gap from the clock is the time zone's offset,
 * not a day: rounded, UTC+13 and UTC+14 would stamp every record a day ahead (build review of #154).
 */
export const stampSkewDays = (pinnedToday: Date | null, now: Date): number =>
  pinnedToday ? Math.round((pinnedToday.getTime() - now.getTime()) / 86_400_000) || 0 : 0;

/**
 * When the open workspace was last loaded or saved, for the reload on coming back to the tab (no sooner than 30 seconds
 * after) and its "saved since the reload started?" check: the page's own running time, rising on every call. Not the
 * Clock, which the demo and the evals stop: with it, the reload on focus never fired and a save looked like no save.
 */
/** Whether two lists of switched-off modules say the same, in any order. */
const sameSwitches = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

let lastMark = 0;
export const loadMark = (): number => (lastMark = Math.max(performance.now(), lastMark + 0.001));

/** Said when a save is tried with nobody signed in (outside the demo). */
export const NOBODY = 'Nobody is signed in here, so nothing can be saved.';
/** When the change engine (app/actions.ts) can't load, the action says so instead of doing nothing (#193's review):
    offline in the words of a page that needs a connection (#183), online with a Reload that fetches it afresh (a
    browser keeps a part that failed to load, so asking again in the same page fails again). Drafts survive a reload. */
export const ENGINE_OFFLINE = 'You’re offline, and saving needs a part of Faro that hasn’t loaded yet. What you typed is kept: try again when you’re back online.';
export const ENGINE_FAILED = 'A part of Faro that saves changes didn’t load. Reload to try again; what you typed is kept.';
/** A save refused as stale that couldn't be run again on the latest (AX6): a whole-record form, or refused every time. */
export const STALE_SAVE = 'Someone else changed this a moment ago, so yours wasn’t saved. You’re now looking at the latest: check it and try again.';
/** A save run again on the latest that then had nothing left to do: someone else had already done it (AX6). */
export const ALREADY_DONE = 'Someone else changed this a moment ago, and it already says what you asked for, so there was nothing to save.';

const ToastCtx = createContext<Toast[]>([]);
/** The messages on screen. Kept apart from the app state so a message coming and going doesn't recompute every screen. */
export const useToasts = () => useContext(ToastCtx);

/** `clock` is the real time (the Clock port): every record's stamp reads it, never the browser's own clock (the reload
    timer reads the page's own running time, loadMark, so a stopped clock doesn't stop it). `today` is the app's day,
    which the demo and the evals pin (`?today=`); by default the clock's, as wall-clock time. */
export function AppProvider({ store, identity: given, mode = 'demo', clock = systemClock, today: pinned, empty: renderEmpty, children }: { store: Store; identity?: Identity; mode?: Mode; clock?: Clock; today?: () => Date; empty?: () => ReactNode; children: ReactNode }) {
  const today = useMemo(() => pinned ?? wallClock(clock), [pinned, clock]);
  // The demo and the real app remember their own workspace and person, so one never opens the other's.
  const K = mode === 'demo' ? { ws: 'goals-app-workspace', seen: 'goals-app-seen' } : { ws: 'goals-live-workspace', seen: 'goals-live-seen' };
  // Who is viewing (src/ports Identity), passed in beside the store: the "Who are you?" picker unless a sign-in is given.
  const identity = useMemo(() => given ?? viewerPicker(mode), [given, mode]);
  // Outside the demo, a save needs someone signed in (or chosen): set as the snapshot is worked out below.
  const signedIn = useRef(mode === 'demo');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  // The workspaces as they are now, for an action run later from an older render (a toast's Undo): switching a feature
  // off and pressing Undo must see it off, or the switch back reads as nothing to change.
  const workspacesNow = useRef(workspaces);
  workspacesNow.current = workspaces;
  /** The feature switch saving now, if any: the next waits for it (setModule). */
  const moduleSwitches = useRef<Promise<void>>(Promise.resolve());
  // An invitation names its workspace (/join/<id>; the link /ready copied before, /?workspace=<id>, leads there), so a
  // colleague opens the workspace they were invited to and nothing else, whatever this browser had open (set-up ST1).
  const [invited] = useState(() => { try { return invitedTo(location.pathname, location.search); } catch { return null; } });
  const [wsId, setWsId] = useState<string | null>(() => invited || read(K.ws) || (examplesOf(store) ? EXAMPLE.id : null));
  // Nothing open: no workspace yet, or none chosen on this device (Welcome), or an invitation to one that isn't there.
  const [empty, setEmpty] = useState(false);
  const [listed, setListed] = useState(false);
  // The snapshot and the workspace it belongs to travel together, so a save can never go to a different workspace
  // than the one on screen, even while another one is loading.
  const [loaded, setLoaded] = useState<{ ws: string; snap: Snapshot; at: number } | null>(null);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const saving = useRef(0);
  // A check-in being saved, by goal: pressing Post again (or a second tap) waits for it rather than posting twice.
  const posting = useRef(new Map<string, Promise<CheckIn>>());
  // A correction's Undo runs against the workspace as it is when pressed (the import it undoes is in it by then).
  const undoNow = useRef<(importId: string) => void>(() => undefined);
  // The dispatcher as the app is now, and its workspace: for an Undo that names what it undoes by id.
  const latest = useRef<{ ws: string; run: AppState['run'] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [noEntry, setNoEntry] = useState<NoEntry | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  // Someone who just chose their name on the arrival screen: their arrival is logged once the app acts as them (rule S4).
  const arriving = useRef<string | null>(null);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success', action?: ToastAction) => {
    const id = ++toastId.current;
    // One success message at a time: a new one replaces the last, so they never pile up over the page. Errors stay until they time out.
    // A message with something to do about it (Undo) stays 10 seconds; pressing it closes the message.
    const act = action && { label: action.label, run: () => { setToasts((t) => t.filter((x) => x.id !== id)); action.run(); } };
    setToasts((t) => [...(kind === 'success' ? t.filter((x) => x.kind === 'error') : t), { id, kind, text, ...(act ? { action: act } : {}) }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? UNDO_MS : kind === 'error' ? 7000 : 3200);
  }, []);
  // An Undo is for the workspace it was made in: once another is open it could only be refused, so it goes.
  useEffect(() => { setToasts((t) => t.filter((x) => !x.action)); }, [wsId]);
  // The change engine loads once the first screen is up and the browser is idle, so a check-in doesn't wait for it.
  useEffect(() => {
    const load = () => { void loadEngine().catch(() => undefined); void loadGoalEntry().catch(() => undefined); };
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    if (w.requestIdleCallback) { const h = w.requestIdleCallback(load, { timeout: 4000 }); return () => w.cancelIdleCallback?.(h); }
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  }, []);

  // Saves this browser won't keep (full, or blocked): said once as it happens, and shown for as long as it lasts.
  const [saveNote, setSaveNote] = useState<string | null>(() => store.saveProblem?.() ?? null);
  useEffect(() => store.onSaveProblem?.(() => {
    const note = store.saveProblem?.() ?? null;
    setSaveNote(note);
    if (note) toast('Saved for this visit only: ' + note.charAt(0).toLowerCase() + note.slice(1), 'error');
  }), [store, toast]);

  // The app loads a window, not the whole workspace (AX5 part 2b): every check-in of the cycles still open, and the change
  // log from about a year back plus the entries rules read at any age (ports/window.ts). Older entries come a page at a
  // time through `olderChanges`. Every load takes the same window, so the snapshot never flips between whole and windowed.
  // Each load brings the workspace's feature switches with it (build review of #371): a tab left open while an admin
  // switched a module off elsewhere sees it off at its next reload, so its screens go and its next action is refused.
  // Only the tab that switched knew before. The first load has just listed the workspaces, so it doesn't ask twice.
  const loadWs = async (ws: string, switches = true) => {
    const [snap, list] = await Promise.all([store.load(ws, appWindow((pinned ?? clock)())), switches ? store.workspaces().catch(() => null) : null]);
    const w = list?.find((x) => x.id === ws);
    if (w) adoptSwitches(ws, w.modulesOff ?? []);
    return snap;
  };
  /** Takes a workspace's switches as just loaded, when they differ from this tab's: at once in the ref, so an action run
      straight after (a stale save run again on the latest) reads them. */
  const adoptSwitches = (ws: string, off: string[]) => {
    const had = workspacesNow.current.find((w) => w.id === ws);
    if (!had || sameSwitches(had.modulesOff ?? [], off)) return;
    const next = (l: Workspace[]) => l.map((w) => (w.id === ws ? { ...w, modulesOff: off } : w));
    workspacesNow.current = next(workspacesNow.current);
    setWorkspaces(next);
  };
  useEffect(() => {
    let live = true;
    setError(null);
    // Keep showing the current workspace until the next one has loaded, so open screens don't reset.
    (async () => {
      const list = await store.workspaces();
      if (!live) return;
      setWorkspaces(list);
      setListed(true);
      // Only a workspace someone chose opens: one this browser remembers, or the one an invitation names. A browser that
      // remembers none goes to Welcome, never to whichever workspace the store lists first (set-up spec W1). A sign-in
      // that can't be chosen (the internal app's shape) opens the first it may (SR1 is the platform's to finish).
      const id = wsId && list.some((w) => w.id === wsId) ? wsId : identity.choose ? null : list[0]?.id ?? null;
      if (!id) { setEmpty(true); setLoaded(null); return; }
      setEmpty(false);
      if (id !== wsId) { write(K.ws, id); setWsId(id); return; }
      // Opened from an invitation: remembered like a switch.
      if (invited && id === invited && read(K.ws) !== id) write(K.ws, id);
      const [snap, me] = await Promise.all([loadWs(id, false), identity.current(id)]);
      const why = !me && identity.why ? await identity.why(id).catch(() => null) : null;
      if (!live) return;
      setLoaded({ ws: id, snap, at: loadMark() });
      setViewerId(me);
      setNoEntry(why);
    })().catch((e: unknown) => {
      if (!live) return;
      setError(e instanceof Error ? e.message : String(e));
    });
    return () => { live = false; };
    // K is derived from mode, which never changes while the app runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, wsId, attempt]);

  // No workspace yet (setting one up): nothing to switch recording off, so it records, without a workspace.
  useEffect(() => { if (empty) telemetry.setContext({ workspaceId: null, userId: null, store: store.kind, recording: true }); }, [empty, store]);

  const createWorkspace = useCallback((name: string, data: Snapshot, meId?: string, recording = false) => telemetry.action('createWorkspace', async () => {
    const at = clock().toISOString();
    const w: Workspace = { id: newId('ws'), name, kind: 'own', createdAt: at, ...(recording ? {} : { recording: false }) };
    const actor = (meId && data.people.find((p) => p.id === meId)) || data.people.find((p) => p.admin) || data.people[0];
    const logged: Snapshot = {
      ...data,
      // Every goal has its key from the start: G-1, G-2 … in the order they were set up.
      goals: withKeys(data.goals),
      changes: [...data.changes, {
        id: newId('chg'), at, actorId: actor?.id ?? 'import', goalId: null, entity: 'workspace', entityId: w.id, action: 'imported',
        summary: `Created “${name}” with ${data.people.length} ${data.people.length === 1 ? 'person' : 'people'}, ${data.teams.length} ${data.teams.length === 1 ? 'team' : 'teams'} and ${data.goals.length} ${data.goals.length === 1 ? 'goal' : 'goals'}`, diffs: [],
      }],
    };
    await store.createWorkspace(w, logged);
    if (actor) identity.choose?.(w.id, actor.id);
    write(K.ws, w.id);
    setWorkspaces((l) => [...l, w]);
    setEmpty(false);
    setWsId(w.id);
    return w.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [store, clock]);

  /** Reloads the open workspace from the store, unless a save has happened since the reload started. */
  const reload = useCallback(async (ws: string) => {
    const started = loadedRef.current?.at;
    const snap = await loadWs(ws);
    setLoaded((l) => (l && l.ws === ws && l.at === started ? { ws, snap, at: loadMark() } : l));
    return snap;
  }, [store]);

  /** Loads the open workspace as it is now and shows it, whatever happened since: after a save refused as stale. */
  const reloadLatest = useCallback(async (ws: string) => {
    const snap = await loadWs(ws);
    const next = { ws, snap, at: loadMark() };
    // At once in the ref too, so a save straight after says it was based on this.
    if (loadedRef.current?.ws === ws) loadedRef.current = next;
    setLoaded((l) => (l && l.ws === ws ? next : l));
    return snap;
  }, [store]);

  const commit = useCallback(async (given: Commit) => {
    const cur = loadedRef.current;
    saving.current++;
    try {
      if (!cur) throw new Error('no workspace is open');
      // Every save keeps a carried copy in the next year true while nobody has used it (cycle-end rule 6), whatever made it.
      // Only a workspace with more than one cycle can have a copy, so the rule loads then, not on a first visit.
      const first = given.changes[0];
      const c = cur.snap.cycles.filter((v) => !v.removedAt).length > 1
        ? (await import('../domain/recarry')).withRecarry(cur.snap, given, { now: first?.at ?? new Date().toISOString(), actorId: first?.actorId ?? '', newId, records: recordsOn(workspacesNow.current.find((w) => w.id === cur.ws)) })
        : given;
      if (!signedIn.current) throw new Error(NOBODY);
      try {
        // Says what the save was based on, so it is refused rather than overwriting a newer change.
        await store.commit(cur.ws, withExpectations(c, cur.snap));
      } catch (e) {
        // A save that timed out may still have landed: look before calling it a failure, so a retry doesn't duplicate it.
        const first = c.changes[0];
        if (!isStale(e) && first && e instanceof Error && /did not answer in time|abort/i.test(e.message)) {
          const fresh = await loadWs(cur.ws).catch(() => null);
          if (fresh?.changes.some((x) => x.id === first.id)) { setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap: fresh, at: loadMark() } : l)); return; }
        }
        throw e;
      }
      setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap: applyCommit(l.snap, c), at: loadMark() } : l));
    } catch (e) {
      // A stale refusal is the dispatcher's to handle: it reloads and runs the action again (AX6, `run` below).
      if (!isStale(e)) toast('Couldn’t save: ' + (e instanceof Error ? e.message : String(e)) + '. Your changes are still here; try again.', 'error');
      throw e;
    } finally {
      saving.current--;
    }
  }, [store, toast]);

  /** A new AI assistant token: the store makes the secret and keeps only its hash; the secret comes back once. */
  const issueToken = useCallback(async (c: Commit) => {
    const cur = loadedRef.current;
    if (!cur) throw new Error('no workspace is open');
    if (!signedIn.current) { toast(NOBODY, 'error'); throw new Error(NOBODY); }
    saving.current++;
    try {
      const secret = await store.issueToken(cur.ws, c);
      setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap: applyCommit(l.snap, c), at: loadMark() } : l));
      return secret;
    } finally {
      saving.current--;
    }
  }, [store]);

  // See other people's changes: reload when coming back to the tab, and every two minutes while it's open.
  useEffect(() => {
    const refresh = () => {
      const cur = loadedRef.current;
      if (!cur || saving.current > 0 || document.visibilityState !== 'visible' || loadMark() - cur.at < 30_000) return;
      void reload(cur.ws).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 120_000);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, [reload]);

  const wanted = wsId;
  const value = useMemo<AppState | null>(() => {
    if (!loaded) return null;
    const snapshot = loaded.snap;
    const wsId = loaded.ws;
    const now = today();
    const cycle = currentCycle(snapshot.cycles, now);
    if (!cycle) return null;
    const sc = scopeToCycle(snapshot, cycle, MODULE_RECORDS);
    const week = currentWeek(cycle, now);
    // Everyone history names: the people here now, and those who left, as "Name (left)". Pickers and counts read
    // snapshot.people, which has only the people here now (domain/cycle scopeToCycle).
    const people = new Map([...(sc.archive?.people ?? []).map((p) => [p.id, { ...p, name: leftName(p.name) }] as const), ...sc.people.map((p) => [p.id, p] as const)]);
    const archived = (id: string) => sc.archive?.goals.find((g) => g.id === id || g.key === id);
    // The whole workspace without deleted check-ins and notes: what attention reads across cycles.
    const live = withoutRemoved(snapshot);
    let comments: Map<string, import('../domain/types').Comment> | null = null;
    // Worked out once per snapshot, when first asked for.
    let dups: Set<string> | null = null, hueMap: Map<string, number> | null = null;
    const dupTitles = () => (dups ??= duplicateTitles(sc.goals));
    // Names someone else here also has, made once (N12): only those people need what tells them apart, so a name is
    // looked up, not found by scanning everyone each time it is drawn.
    let shared: { ids: Set<string>; twins: Set<string> } | undefined;
    const sharedNames = () => {
      if (shared) return shared;
      const count = new Map<string, number>();
      for (const x of sc.people) { const k = x.name.trim().toLowerCase(); count.set(k, (count.get(k) ?? 0) + 1); }
      shared = { ids: new Set(sc.people.map((x) => x.id)), twins: new Set([...count].filter(([, n]) => n > 1).map(([k]) => k)) };
      return shared;
    };
    const hues = () => (hueMap ??= avatarHues([...people.values()]));
    const ws = workspaces.find((w) => w.id === wsId) ?? (examplesOf(store) ? EXAMPLE : { id: wsId ?? '', name: 'Workspace', kind: 'own' as const, createdAt: '' });
    // The demo shows someone until a person is picked; outside it, nobody signed in can see the workspace (the picker
    // asks) but can't save anything: the person below is only for drawing the screen, never an actor (AX3).
    const fallback = sc.people.find((p) => p.id === 'rhea') ?? sc.people.find((p) => sc.goals.some((g) => g.ownerId === p.id)) ?? sc.people[0]!;
    const chosen = !!viewerId && sc.people.some((p) => p.id === viewerId);
    const viewer = (chosen && people.get(viewerId!)) || fallback;
    signedIn.current = mode === 'demo' || chosen;
    const statuses = new Map<string, GoalStatus>();
    const attention = new Map<string, GoalAttention>();
    const lookup: Lookup = {
      person: (id) => people.get(id),
      goal: (id) => sc.goals.find((g) => g.id === id) ?? archived(id),
      teamName: (id) => sc.teams.find((t) => t.id === id)?.name ?? id,
    };
    // Records are stamped with the real time of day, moved to the app's today when the demo or the evals pin it.
    const skewDays = stampSkewDays(pinned ? now : null, clock());
    const stamp = () => new Date(clock().getTime() + skewDays * 86_400_000).toISOString();

    // The shared actions (domain/actions.ts): who may do what, and what it saves. A rule that says no is shown, not saved.
    const ax = (): A.ActionContext => ({ snapshot: sc, cycle, week, actor: viewer, now: stamp(), newId, allGoals: snapshot.goals, full: snapshot, records: MODULE_RECORDS });
    const rx = (): RunContext => ({ ...ax(), workspace: workspacesNow.current.find((w) => w.id === ws.id) ?? ws, modules: MODULES });
    /** The same, on another load of this workspace: the latest, when a stale save runs again (AX6). The viewer acts as
        they are there now. Someone no longer among the people here (marked as left or deleted since) can't act at all:
        refused in the words anyone not signed in gets, as before the re-run (the save was refused, nothing was saved). */
    const rxOn = (full: Snapshot): RunContext => {
      if (full === snapshot) return rx();
      const cyc = currentCycle(full.cycles, now) ?? cycle;
      const s = scopeToCycle(full, cyc, MODULE_RECORDS);
      const actor = s.people.find((p) => p.id === viewer.id);
      if (!actor) throw new A.NotAllowed(NOBODY);
      return { ...rx(), snapshot: s, cycle: cyc, week: currentWeek(cyc, now), actor, allGoals: full.goals, full };
    };
    // An action made in one workspace (a toast's Undo, pressed after switching) never saves into another: this render's
    // workspace must still be the one open, or nothing is saved and the person is told.
    const save = (c: Commit) => {
      if (loadedRef.current && loadedRef.current.ws !== ws.id) { toast(ELSEWHERE, 'error'); throw new Error(ELSEWHERE); }
      return commit(c);
    };
    // A removal's Undo runs from the app it was made in: in another workspace by then, save refuses it (ELSEWHERE).
    const undoBy = (c: Commit, before: Snapshot) => () => { void run('undoRemoval', { removal: c, before }).then(() => toast('Undone')).catch(() => undefined); };
    // Undo for marking reviewed names the marks by id, so it runs on the app as it is now, whose workspace has them; never
    // in another workspace.
    const unmark = (decisionIds: string[]) => () => {
      const now = latest.current;
      if (!now || now.ws !== ws.id) { toast(ELSEWHERE, 'error'); return; }
      void now.run('unmarkReviewed', { decisionIds }).then(() => toast('Undone: back on the agenda')).catch(() => undefined);
    };

    // What a removal says, with Undo for 10 seconds (domain/removal). Undo puts back every record the removal changed,
    // as it was just before (what it handed over or moved included).
    const nameOf = (id: string) => people.get(id)?.name;
    const said: { [N in ActionName]?: (out: NonNullable<ReturnType<typeof perform<N>>>, input: ActionInput<N>) => string } = {
      unwatch: (c) => c.changes[0]?.summary ?? 'Stopped watching',
      deleteView: (c) => c.changes[0]!.summary,
      markPersonLeft: (_, i) => `${nameOf(i.personId) ?? 'They'} ${nameOf(i.personId) ? 'is' : 'are'} marked as left`,
      deletePerson: (_, i) => `Deleted ${nameOf(i.personId) ?? 'them'}`,
      stopGoal: (_, i) => `Stopped ${lookup.goal(i.goalId)?.title ?? 'the goal'}`,
      // Withdrawing a proposal is deleting it, in its own words (domain/proposed withdrawnSummary).
      deleteGoal: (c, i) => c.changes[0]?.summary ?? `Deleted ${lookup.goal(i.goalId)?.title ?? 'the goal'}`,
      activate: (o) => `“${o.goal.title}” is active.`,
      backToProposed: (o) => `“${o.goal.title}” is proposed again.`,
      deleteCheckIn: (_, i) => `Deleted the check-in for week ${snapshot.checkIns.find((c) => c.id === i.checkInId)?.week ?? ''}`,
      endReview: (o, i) => `${o.deleted ? 'Deleted' : ENDED} the review “${sc.reviews.find((r) => r.id === i.reviewId)?.name ?? ''}”`,
      deleteReview: (_, i) => `Deleted the review “${sc.reviews.find((r) => r.id === i.reviewId)?.name ?? ''}”`,
      deleteComment: () => COMMENT_REMOVED,
      deleteNote: () => NOTE_REMOVED,
      deleteCycle: (_, i) => `Deleted the cycle ${snapshot.cycles.find((c) => c.id === i.cycleId)?.name ?? ''}`,
    };

    latest.current = { ws: ws.id, run };
    undoNow.current = (importId) => { void run('undoImport', { importId }).then(() => toast('Undone')).catch(() => undefined); };
    /** The dispatcher (app/actions.ts): one way to run an action. Who, when and ids are set here. */
    async function run<N extends ActionName>(name: N, input: ActionInput<N>, opts: { said?: string } = {}): Promise<RunResult<N>> {
      // Outside the demo, nobody signed in can't act: there is no stand-in to act as (AX3).
      if (!signedIn.current) { toast(NOBODY, 'error'); throw new Error(NOBODY); }
      try { await ready(name, input); } catch (e) {
        if (isOffline()) toast(ENGINE_OFFLINE, 'error');
        // Online, it is stale code or a failed fetch: reload once (staleCode.ts), or offer the reload when it just did.
        else if (!recoverFromStaleCode(e)) toast(ENGINE_FAILED, 'error', { label: 'Reload', run: () => location.reload() });
        throw e;
      }
      // A token's secret is made where it's kept (the shared database makes its own) and shown once; only its hash is stored.
      if (name === 'createToken') {
        let token: Commit;
        try { token = performAny(rx(), name, input) as Commit; } catch (e) { if (e instanceof A.NotAllowed) toast(e.message, 'error'); throw e; }
        return (await issueToken(token)) as RunResult<N>;
      }
      // The rule runs on the workspace as loaded; if the save is refused as stale (someone else changed the same goal or
      // review since), on the latest, with the same input, and that is saved (AX6, app/rerun.ts). The rule decides again,
      // so a refusal then is in its own words. An input holding whole records as last seen isn't run again (actions.ts).
      const attempt = (full: Snapshot) => {
        // Signed in on every run, not only the first: a re-run comes after a reload, and sign-in may have gone since.
        if (!signedIn.current) throw new A.NotAllowed(NOBODY);
        const out = performAny(rxOn(full), name, input) as ReturnType<typeof perform<N>>;
        if (name === 'planChanges' && (input as ActionInput<'planChanges'>).apply && !(out as ChangeSet).commit) throw new Error('These changes can’t be saved yet.');
        return { out, commit: commitOf(name, out, input) };
      };
      let done: Awaited<ReturnType<typeof saveRerunning<ReturnType<typeof perform<N>>>>>;
      try {
        done = await saveRerunning(snapshot, attempt, async (c) => { await save(c); }, () => reloadLatest(ws.id), rerunsWhenStale(name) ? undefined : 0);
      } catch (e) {
        if (e instanceof A.NotAllowed) toast(e.message, 'error');
        else if (isStale(e)) {
          await reloadLatest(ws.id).catch(() => undefined);
          toast(STALE_SAVE, 'error');
        }
        throw e;
      }
      const { out, commit: c, before, reran } = done;
      if (!c) {
        // Run again on the latest, it had nothing left to do: someone else did it first. Said, so it isn't silent.
        if (reran) toast(ALREADY_DONE);
        return out as RunResult<N>;
      }
      if (name === 'markReviewed') {
        const n = (input as ActionInput<'markReviewed'>).goalIds.length;
        const review = sc.reviews.find((r) => r.id === (input as ActionInput<'markReviewed'>).reviewId);
        toast(opts.said ?? `${n} ${n === 1 ? 'goal' : 'goals'} marked reviewed in ${review?.name ?? 'the review'}`, 'success', { label: 'Undo', run: unmark((c.decisions ?? []).map((d) => d.id)) });
      } else {
        // A module's removal or change says what it did, with Undo, as the core's do (its actions.ts `said`); a `said`
        // that gives back nothing leaves the toast to the screen (adding a metric, say).
        const say = (said[name] ?? MODULE_ACTIONS[name]?.said) as ((o: unknown, i: unknown) => string) | undefined;
        // Undo puts back the workspace the saved run was based on: the latest, when it ran again.
        const words = say ? opts.said ?? say(out, input) : '';
        if (words) toast(words, 'success', { label: 'Undo', run: undoBy(c, before) });
      }
      return out as RunResult<N>;
    }

    return traced({
      run: ((name: ActionName, input: ActionInput<ActionName>, opts?: { said?: string }) => telemetry.action(name, () => run(name, input, opts))) as AppState['run'],
      mode, viewerChosen: mode === 'demo' || chosen, canChooseViewer: !!identity.choose, noEntry,
      ws, workspaces, opening: wanted && wanted !== wsId ? workspaces.find((w) => w.id === wanted) ?? null : null, snapshot: sc, allGoals: snapshot.goals, full: snapshot, olderChanges: (ask: HistoryAsk) => store.history(ws.id, ask), cycle, week, today: now, viewer, lookup, stamp, toast, storeKind: store.kind, saveNote,
      switchWorkspace: (id) => { write(K.ws, id); setWsId(id); },
      createWorkspace,
      exampleSeed: async () => {
        const demo = examplesOf(store);
        return demo?.seeded && ws.kind === 'example' ? demo.seeded(ws.id) : null;
      },
      resetExample: async () => {
        const demo = examplesOf(store);
        if (!demo) throw new Error('Only the demo has an example to reset.');
        const s = await demo.resetExample(ws.kind === 'example' ? ws.id : EXAMPLE.id);
        // Everything else the demo keeps in this browser goes too: drafts, what's been seen, walkthroughs, layouts.
        forgetDemoBrowser();
        if (ws.kind === 'example') setLoaded({ ws: ws.id, snap: s, at: loadMark() });
        toast('The example is back to its starting point, drafts and all');
      },
      deleteWorkspace: async () => {
        if (ws.kind === 'example') throw new Error('Examples can be reset, not deleted.');
        // Start over (and Delete this workspace) removes a workspace of your own: admins only (the rule, not just the panel).
        if (!A.mayStartOver(viewer, 'own')) throw new Error(A.START_OVER_ADMINS);
        await store.deleteWorkspace(ws.id);
        forgetWorkspaceBrowser(ws.id);
        const rest = workspaces.filter((w) => w.id !== ws.id);
        setWorkspaces(rest);
        const next = rest[0]?.id ?? null;
        write(K.ws, next ?? '');
        setLoaded(null);
        setWsId(next);
        toast(`Deleted ${ws.name}`);
      },
      renameWorkspace: async (name) => {
        const out = await run('renameWorkspace', { name });
        if (out?.workspace) { const next = out.workspace.name; setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, name: next } : w))); }
      },
      saveTeam: async (t) => (await run('saveTeam', t)).id,
      removeTeam: async (id, moveTo) => { await run('removeTeam', { teamId: id, moveTo }); },
      setRecording: async (on) => {
        const out = await run('setRecording', { on });
        if (!out) return;
        // At once, before anything else is recorded: off means nothing more is sent for this workspace.
        telemetry.setContext({ recording: on });
        // At once in the ref too, so another switch before the next render reads this one.
        workspacesNow.current = workspacesNow.current.map((w) => (w.id === wsId ? { ...w, recording: on } : w));
        setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, recording: on } : w)));
      },
      // A switch saves the workspace's whole list of features switched off, so switches run one at a time, each from the
      // list the one before saved: an Undo pressed while another switch saves can't save a list without it (build
      // review of #141).
      setModule: (id, on) => {
        const step = moduleSwitches.current.then(async () => {
          const out = await run('setModule', { moduleId: id, on });
          if (!out?.modulesOff) return;
          const off = out.modulesOff;
          const next = (l: Workspace[]) => l.map((w) => (w.id === wsId ? { ...w, modulesOff: off } : w));
          workspacesNow.current = next(workspacesNow.current);
          setWorkspaces(next);
        });
        moduleSwitches.current = step.catch(() => undefined);
        return step;
      },
      setRhythm: async (to) => { await run('setRhythm', to); },
      setViewer: (id, arrival) => { if (!identity.choose || !wsId) return; identity.choose(wsId, id); if (arrival) arriving.current = id; setViewerId(id); },
      person: (id) => people.get(id),
      personName: (id) => { const p = people.get(id); if (!p) return id; const sh = sharedNames(); return sh.ids.has(id) && sh.twins.has(p.name.trim().toLowerCase()) ? nameWithTell(p, sc.people, lookup.teamName) : p.name; },
      goalTell: (g) => goalTell(g, dupTitles(), lookup.teamName),
      avatarHue: (id) => hues().get(id),
      team: (id) => sc.teams.find((t) => t.id === id),
      // By ID or by key, so /goals/G-12 opens the same goal as its ID does. A stopped goal still opens (its page says so).
      goal: (id) => findGoal(sc.goals, id) ?? findGoal(sc.proposed ?? [], id) ?? archived(id),
      statusOf: (g) => {
        let st = statuses.get(g.id);
        if (!st) statuses.set(g.id, (st = goalStatus(g, cycle, sc.checkIns, now)));
        return st;
      },
      attentionOf: (g) => {
        let a = attention.get(g.id);
        if (!a) attention.set(g.id, (a = attentionFor(g, live, cycle, now)));
        return a;
      },
      checkInsOf: (g) => checkInsFor(g, g.stoppedAt ? sc.archive?.checkIns ?? [] : sc.checkIns),
      postCheckIn: (goal, draft, mode, reason, reading) => {
        const inFlight = posting.current.get(goal.id);
        if (inFlight) return inFlight;
        // One way to save (check-in spec, rule 13): the engine the table, the import and the AI tools use; its ask too.
        // A correction is an import of one (rule 8): it says what it changed, and Undo takes the import back (2.7).
        const posted = run('postCheckIn', { goalId: goal.id, draft, mode, ...(mode === 'correct' ? { reason } : {}), ...(reading ? { reading } : {}) }).then((out) => {
          const ch = out.commit.changes.find((x) => x.importId);
          if (mode === 'correct' && ch?.importId) {
            const importId = ch.importId;
            toast(correctedLine(ch.summary), 'success', { label: 'Undo', run: () => undoNow.current(importId) });
          }
          return out.checkIn;
        });
        posting.current.set(goal.id, posted);
        void posted.catch(() => undefined).finally(() => posting.current.delete(goal.id));
        return posted;
      },
      answerRequest: async (r, answer) => { await run('answerRequest', { askId: r.id, answer }); },
      markActionDone: async (r, note) => { await run('markActionDone', { askId: r.id, note }); },
      askQuestion: async (goal, text) => { await run('askQuestion', { goalId: goal.id, text }); },
      linkRequest: async (r, goal) => { await run('linkRequest', { askId: r.id, goalId: goal.id }); },
      withdrawRequest: async (r, goal) => { await run('withdrawRequest', { askId: r.id, goalId: goal?.id }); },
      // One way to save a goal (goal entry, rule 7; AX2): the dispatcher runs the rule, so the form saves nothing itself.
      // What the form's module place chose (goal.measure) goes with it, saved in the same commit (actions.ts saveGoal).
      saveGoal: async (draft, goal, opts) => (await run('saveGoal', { draft, ...(goal ? { goalId: goal.id } : {}), ...opts })).goal,
      addNote: async (goal, text) => { await run('addNote', { goalId: goal.id, text }); },
      askForUpdate: async (goal) => { await run('askForUpdate', { goalId: goal.id }); },
      undoUpdateAsk: async (goal) => { await run('undoUpdateAsk', { goalId: goal.id }); },
      reviewCall: async (goal, review, sessionWeek, kind, note, extra) => { await run('reviewCall', { goalId: goal.id, reviewId: review.id, kind, note, week: sessionWeek, ...extra }); },
      markReviewed: async (goals, review, sessionWeek, said) => { await run('markReviewed', { goalIds: goals.map((g) => g.id), reviewId: review.id, week: sessionWeek }, { said }); },
      acceptRisk: async (goal, review, sessionWeek, reason) => { await run('acceptRisk', { goalId: goal.id, reviewId: review.id, reason, week: sessionWeek }); },
      addAction: async (goal, text, extra) => { await run('addAction', { goalId: goal.id, text, ...extra }); },
      editCall: async (d, note, extra) => { await run('editCall', { callId: d.id, note, ...extra }); },
      watch: async (kind, ref) => { await run('watch', { kind, ref }); },
      unwatch: async (watchId) => { await run('unwatch', { watchId }); },
      savePerson: async (p) => { await run('savePerson', { person: p }); },
      saveReview: async (review) => { await run('saveReview', { review }); },
      saveRetro: async (goal, retro) => { await run('saveRetro', { goalId: goal.id, result: retro.result, learned: retro.learned, next: retro.next }); },
      sendFeedback: async (mood, text, path) => {
        await run('sendFeedback', { mood, text, path });
        // The demo's data lives in this browser only, so its feedback is also sent where the people building the app read it.
        if (mode === 'demo') void sendDemoFeedback({ mood, text, path, persona: `${viewer.name}${viewer.role ? ', ' + viewer.role : ''}` });
      },
      // A change set is previewed here; applyChanges sends the same input again with apply, so what is saved is worked
      // out at save time by the rule, not trusted from the preview.
      changeInput: (tables, via, answers, file) => { const x = ax(); return { tables, snapshot: x.snapshot, cycle: x.cycle, week: x.week, actor: x.actor, now: x.now, newId: x.newId, via, answers, full: x.full, records: x.records, ...(file ? { file } : {}) }; },
      previewChanges: (tables, via, reason, confirm, answers, file, posts) => {
        const plan: ChangePlan = { tables, via, reason, confirm, answers, ...(file ? { file } : {}), ...(posts?.length ? { posts } : {}) };
        // The preview carries the plan it was made from, so applyChanges can send it again with apply: what is saved is
        // worked out by the rule at save time, never trusted from the preview on screen.
        return Object.assign(perform(rx(), 'planChanges', plan), { plan });
      },
      applyChanges: (cs) => run('planChanges', { ...cs.plan, apply: true }),
      createToken: (personId, name) => run('createToken', { personId, name }),
      saveView: async (v) => (await run('saveView', v)).id,
      saveTableView: async (v, head) => (await run('saveTableView', { ...v, head })).id,
      deleteView: async (id) => { await run('deleteView', { viewId: id }); },
      markPersonLeft: async (id, to) => { await run('markPersonLeft', { personId: id, ...to }); },
      leaveWorkspace: async (to) => {
        await run('leaveWorkspace', to);
        toast(`You’ve left ${ws.name}. An admin can bring you back from Recently removed for ${RESTORE_DAYS} days.`);
        const other = workspaces.find((w) => w.id !== ws.id);
        if (other) { write(K.ws, other.id); setWsId(other.id); }
      },
      deletePerson: async (id) => { await run('deletePerson', { personId: id }); },
      stopGoal: async (goal, reason) => { await run('stopGoal', { goalId: goal.id, reason }); },
      deleteGoal: async (goal) => { await run('deleteGoal', { goalId: goal.id }); },
      deleteCheckIn: async (c) => { await run('deleteCheckIn', { checkInId: c.id }); },
      endReview: async (id) => { await run('endReview', { reviewId: id }); },
      deleteReview: async (id) => { await run('deleteReview', { reviewId: id }); },
      editComment: async (id, text) => { await run('editComment', { commentId: id, text }); },
      deleteComment: async (id) => { await run('deleteComment', { commentId: id }); },
      deleteNote: async (id) => { await run('deleteNote', { noteId: id }); },
      deleteCycle: async (id) => { await run('deleteCycle', { cycleId: id }); },
      undoStart: async (id) => { await run('undoStart', { cycleId: id }); },
      undoImport: async (importId) => { const out = await run('undoImport', { importId }); return { restored: out.restored, skipped: out.skipped }; },
      undoPreview: (importId) => R.undoPreview(rx(), importId),
      restoreRemoved: async (kind, id) => { await run('restoreRemoved', { kind, id }); },
      recentlyRemoved: () => R.recentlyRemoved(snapshot, now, undefined, recordsOn(ws)),
      comment: (id) => (comments ??= R.commentsOf(sc.changes)).get(id),
      pinView: async (id, pinned) => { await run('pinView', { viewId: id, pinned }); },
      revokeToken: async (id) => { await run('revokeToken', { tokenId: id }); },
      startNextCycle: async () => (await run('startNextCycle', {})).name,
    });
  }, [loaded, wanted, viewerId, noEntry, store, today, pinned, clock, workspaces, commit, issueToken, reloadLatest, toast, createWorkspace, mode, saveNote]);

  // The arrival, logged as the person who arrived, once the app acts as them (rule S4: domain/actions arrive).
  useEffect(() => {
    if (!value || !arriving.current || !value.viewerChosen || value.viewer.id !== arriving.current) return;
    arriving.current = null;
    void value.run('arrive', {}).catch(() => undefined);
  }, [value]);

  // What this device remembers for Welcome: each workspace you are someone in, as whom, and its year, by when last opened.
  const seenKey = value && value.viewerChosen && value.ws.kind !== 'example' ? `${value.ws.id}\t${value.viewer.id}` : null;
  useEffect(() => {
    if (!seenKey || !value) return;
    const all = readSeen(K.seen);
    all[value.ws.id] = { me: value.viewer.name, at: clock().toISOString(), startDate: value.cycle.startDate, weeks: value.cycle.weeks };
    write(K.seen, JSON.stringify(all));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenKey]);

  const setup = useMemo<SetupState>(() => ({
    mode, today: today(), hasWorkspaces: workspaces.length > 0, createWorkspace, toasts, toast, workspaces, listed, openId: wsId,
    open: (id) => { write(K.ws, id); setWsId(id); },
    remembered: () => {
      const seen = readSeen(K.seen);
      return workspaces.filter((w) => seen[w.id] && w.kind !== 'example').sort((a, b) => (seen[a.id]!.at < seen[b.id]!.at ? 1 : -1)).map((w) => {
        const s = seen[w.id]!;
        const week = s.startDate && s.weeks ? currentWeek({ startDate: s.startDate, weeks: s.weeks } as Cycle, today()) : null;
        return { ws: w, me: s.me, week: week != null && week >= 1 && week <= (s.weeks ?? 0) ? week : null };
      });
    },
    // K is derived from mode, which never changes while the app runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [mode, today, workspaces, createWorkspace, toasts, toast, listed, wsId]);

  let body: ReactNode;
  if (error) {
    body = (
      <div className="boot">
        <div className="boot-card">
          <span className="h3">Couldn’t reach the goals data</span>
          <p className="muted">{error}</p>
          <div className="row">
            <button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
            {mode === 'live' && <a className="btn" href="?store=browser">Use a copy in this browser</a>}
          </div>
        </div>
      </div>
    );
  } else if (empty) {
    body = renderEmpty?.() ?? null;
  } else if (!value) {
    body = (
      <div className="boot" aria-busy="true">
        <div className="skeleton" aria-hidden="true"><i /><i /><i /><i /></div>
        <span className="muted small">Loading goals…</span>
      </div>
    );
  } else {
    body = <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  return <ToastCtx.Provider value={toasts}><SetupCtx.Provider value={setup}>{body}</SetupCtx.Provider></ToastCtx.Provider>;
}
