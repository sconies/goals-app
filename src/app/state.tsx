import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { viewerPicker } from '../adapters/local';
import type { Identity } from '../ports';
import * as A from '../domain/actions';
import { attentionFor, type GoalAttention } from '../domain/attention';
import { checkInChange, goalChange, type Lookup } from '../domain/changes';
import { toCheckIn, type Draft } from '../domain/checkin';
import { currentWeek } from '../domain/plan';
import { checkInsFor, goalStatus, type GoalStatus } from '../domain/status';
import type { CheckIn, Cycle, Decision, Goal, Ask, Person, Retro, Review, Snapshot, Team, Watch, Workspace } from '../domain/types';
import { makesLoop } from '../domain/tree';
import { currentCycle, scopeToCycle, withArchivedGoal, withoutRemoved } from '../domain/cycle';
import { findGoal, nextKey, withKeys } from '../domain/goalKey';
import { requestsAfterCheckIn } from '../domain/asks';
import type { TableLayout } from '../domain/tableLayout';
import { sendDemoFeedback } from './research';
import { MODULES } from '../core/registry';
import { applyCommit, EXAMPLE, isStale, newId, withExpectations, type Commit, type Mode, type Store } from '../data/store';
import type { ChangeSet, Tables, Via } from '../domain/changeset';
import { ACTIONS } from '../mcp/parity';
import { commitOf, perform, type ActionInput, type ActionName, type RunContext, type RunResult } from './actions';
import { telemetry } from '../telemetry';
import * as R from '../domain/removal';
import * as M from '../domain/metrics';
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
  ws: Workspace;
  workspaces: Workspace[];
  /** The workspace being opened while it loads (switching), else null: the screen says so rather than mixing the two (backlog WS). */
  opening: Workspace | null;
  /** Opens another workspace. Screens switch through ui/WorkspaceSwitch's useSwitchWorkspace, which also makes a history entry. */
  switchWorkspace(id: string): void;
  /** Set up a workspace; `recording` is whether it records how the app is used, as chosen at set-up (off unless chosen). */
  createWorkspace(name: string, data: Snapshot, meId?: string, recording?: boolean): Promise<string>;
  resetExample(): Promise<void>;
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
  snapshot: Snapshot;
  /** Every goal in the workspace, in every cycle (snapshot has this cycle's): for what reaches past it, like a team's goals. */
  allGoals: Goal[];
  cycle: Cycle;
  week: number;
  today: Date;
  viewer: Person;
  setViewer(id: string): void;
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
  /** Posts (or replaces) this week's check-in and logs it. */
  postCheckIn(goal: Goal, draft: Draft, existing: CheckIn | null): Promise<CheckIn>;
  /** Answer an ask (a decision or help, an update, a question): one answer for every goal it applies to. */
  answerRequest(r: Ask, answer: string): Promise<void>;
  /** Mark an action done, with an optional note. */
  markActionDone(r: Ask, note?: string): Promise<void>;
  /** Link a goal to a decision or help raised for another goal: waiting on the same decision. */
  linkRequest(r: Ask, goal: Goal): Promise<void>;
  /** Withdraw an ask; on a goal linked to another goal's request, stop waiting on it. */
  withdrawRequest(r: Ask, goal?: Goal): Promise<void>;
  /** Saves a goal and logs what changed, with the owner's reason when the plan or target moved. A new goal's stages said
      to be already done (`stagesDone`, onboarding rule 3) are recorded done in the same save (actions.recordStagesDone). */
  saveGoal(after: Goal, before: Goal | null, why?: string, opts?: { stagesDone?: string[] }): Promise<void>;
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
  previewChanges(tables: Tables, via: Via, reason?: string, confirm?: boolean): ChangeSet;
  /** Saves a change set worked out by previewChanges: all of it, or none. */
  applyChanges(cs: ChangeSet): Promise<void>;
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
  /* The metric library (domain/metrics, backlog 0b): what its screens call. The rules say no with a message, shown. */
  /** Add a metric (anyone; they own it unless `ownerId` says) or change one (`id`: its owner or an admin). Returns its id; nothing is saved when nothing changed. */
  saveMetric(m: M.MetricInput & { id?: string }): Promise<string>;
  /** Owner or admin: remove a metric, unlinking the goals it measures, with Undo. */
  removeMetric(id: string): Promise<void>;
  /** The goal's owner or an admin: measure a goal by a metric, for a team (`teamId`) or the whole company (null). */
  linkGoalMetric(goal: Goal, metricId: string, teamId: string | null): Promise<void>;
  /** The goal's owner or an admin: stop measuring a goal by its metric, with Undo. */
  unlinkGoalMetric(goal: Goal): Promise<void>;
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
  /** Whoever imported, or an admin: put every row an import or bulk edit wrote back as it was. */
  undoImport(importId: string): Promise<{ restored: number; skipped: string[] }>;
  /** Admins, or whoever removed it: bring back something removed in the last 30 days. */
  restoreRemoved(kind: R.RemovedKind, id: string): Promise<void>;
  /** Everything removed in the last 30 days, newest first (Workspace → Recently removed). */
  recentlyRemoved(): R.Removed[];
  /** A comment as it reads now (edited, or removed), by its id. */
  comment(id: string): import('../domain/types').Comment | undefined;
  /** The whole workspace, every cycle and every removed record (snapshot is this cycle's, live records only). */
  full: Snapshot;
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

/** What onboarding needs before any workspace exists. */
export interface SetupState {
  mode: Mode;
  today: Date;
  hasWorkspaces: boolean;
  createWorkspace(name: string, data: Snapshot, meId?: string, recording?: boolean): Promise<string>;
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

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
/** Now, as the person's own wall-clock time: weeks turn over at their midnight on Sunday, wherever they are. */
const realNow = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()));
};

/** Said when a save is tried with nobody signed in (outside the demo). */
export const NOBODY = 'Nobody is signed in here, so nothing can be saved.';

const ToastCtx = createContext<Toast[]>([]);
/** The messages on screen. Kept apart from the app state so a message coming and going doesn't recompute every screen. */
export const useToasts = () => useContext(ToastCtx);

export function AppProvider({ store, identity: given, mode = 'demo', today = realNow, empty: renderEmpty, children }: { store: Store; identity?: Identity; mode?: Mode; today?: () => Date; empty?: () => ReactNode; children: ReactNode }) {
  // The demo and the real app remember their own workspace and person, so one never opens the other's.
  const K = mode === 'demo' ? { ws: 'goals-app-workspace' } : { ws: 'goals-live-workspace' };
  // Who is viewing (src/ports Identity), passed in beside the store: the "Who are you?" picker unless a sign-in is given.
  const identity = useMemo(() => given ?? viewerPicker(mode), [given, mode]);
  // Outside the demo, a save needs someone signed in (or chosen): set as the snapshot is worked out below.
  const signedIn = useRef(mode === 'demo');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  // The workspaces as they are now, for an action run later from an older render (a toast's Undo): switching a feature
  // off and pressing Undo must see it off, or the switch back reads as nothing to change.
  const workspacesNow = useRef(workspaces);
  workspacesNow.current = workspaces;
  // An invitation names its workspace (/?workspace=…, the link /ready copies: deep review U2), so a colleague opens the
  // workspace they were invited to, not whichever one this browser or the site would open first.
  const [invited] = useState(() => { try { return new URLSearchParams(location.search).get('workspace'); } catch { return null; } });
  const [wsId, setWsId] = useState<string | null>(() => invited || read(K.ws) || (store.hasExample ? EXAMPLE.id : null));
  const [empty, setEmpty] = useState(false);
  // The snapshot and the workspace it belongs to travel together, so a save can never go to a different workspace
  // than the one on screen, even while another one is loading.
  const [loaded, setLoaded] = useState<{ ws: string; snap: Snapshot; at: number } | null>(null);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const saving = useRef(0);
  // A check-in being saved, by goal: pressing Post again (or a second tap) waits for it rather than posting twice.
  const posting = useRef(new Map<string, Promise<CheckIn>>());
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success', action?: ToastAction) => {
    const id = ++toastId.current;
    // One success message at a time: a new one replaces the last, so they never pile up over the page. Errors stay until they time out.
    // A message with something to do about it (Undo) stays 10 seconds; pressing it closes the message.
    const act = action && { label: action.label, run: () => { setToasts((t) => t.filter((x) => x.id !== id)); action.run(); } };
    setToasts((t) => [...(kind === 'success' ? t.filter((x) => x.kind === 'error') : t), { id, kind, text, ...(act ? { action: act } : {}) }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? UNDO_MS : kind === 'error' ? 7000 : 3200);
  }, []);

  // Saves this browser won't keep (full, or blocked): said once as it happens, and shown for as long as it lasts.
  const [saveNote, setSaveNote] = useState<string | null>(() => store.saveProblem?.() ?? null);
  useEffect(() => store.onSaveProblem?.(() => {
    const note = store.saveProblem?.() ?? null;
    setSaveNote(note);
    if (note) toast('Saved for this visit only: ' + note.charAt(0).toLowerCase() + note.slice(1), 'error');
  }), [store, toast]);

  useEffect(() => {
    let live = true;
    setError(null);
    // Keep showing the current workspace until the next one has loaded, so open screens don't reset.
    (async () => {
      const list = await store.workspaces();
      if (!live) return;
      setWorkspaces(list);
      const id = wsId && list.some((w) => w.id === wsId) ? wsId : list[0]?.id ?? null;
      if (!id) { setEmpty(true); setLoaded(null); return; }
      setEmpty(false);
      if (id !== wsId) { write(K.ws, id); setWsId(id); return; }
      // Opened from an invitation: remembered like a switch, and the address no longer names it.
      if (invited && id === invited && read(K.ws) !== id) {
        write(K.ws, id);
        try { const u = new URL(location.href); u.searchParams.delete('workspace'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch { /* no history */ }
      }
      const [snap, me] = await Promise.all([store.load(id), identity.current(id)]);
      if (!live) return;
      setLoaded({ ws: id, snap, at: Date.now() });
      setViewerId(me);
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
    const at = new Date().toISOString();
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
  }), [store]);

  /** Reloads the open workspace from the store, unless a save has happened since the reload started. */
  const reload = useCallback(async (ws: string) => {
    const started = loadedRef.current?.at;
    const snap = await store.load(ws);
    setLoaded((l) => (l && l.ws === ws && l.at === started ? { ws, snap, at: Date.now() } : l));
    return snap;
  }, [store]);

  const commit = useCallback(async (c: Commit) => {
    const cur = loadedRef.current;
    saving.current++;
    try {
      if (!cur) throw new Error('no workspace is open');
      if (!signedIn.current) throw new Error(NOBODY);
      try {
        // Says what the save was based on, so it is refused rather than overwriting a newer change.
        await store.commit(cur.ws, withExpectations(c, cur.snap));
      } catch (e) {
        // A save that timed out may still have landed: look before calling it a failure, so a retry doesn't duplicate it.
        const first = c.changes[0];
        if (!isStale(e) && first && e instanceof Error && /did not answer in time|abort/i.test(e.message)) {
          const fresh = await store.load(cur.ws).catch(() => null);
          if (fresh?.changes.some((x) => x.id === first.id)) { setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap: fresh, at: Date.now() } : l)); return; }
        }
        throw e;
      }
      setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap: applyCommit(l.snap, c), at: Date.now() } : l));
    } catch (e) {
      if (isStale(e) && cur) {
        await store.load(cur.ws).then((snap) => setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap, at: Date.now() } : l))).catch(() => undefined);
        toast('Someone else changed this a moment ago, so yours wasn’t saved. You’re now looking at the latest: check it and try again.', 'error');
      } else {
        toast('Couldn’t save: ' + (e instanceof Error ? e.message : String(e)) + '. Your changes are still here; try again.', 'error');
      }
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
      setLoaded((l) => (l && l.ws === cur.ws ? { ws: cur.ws, snap: applyCommit(l.snap, c), at: Date.now() } : l));
      return secret;
    } finally {
      saving.current--;
    }
  }, [store]);

  // See other people's changes: reload when coming back to the tab, and every two minutes while it's open.
  useEffect(() => {
    const refresh = () => {
      const cur = loadedRef.current;
      if (!cur || saving.current > 0 || document.visibilityState !== 'visible' || Date.now() - cur.at < 30_000) return;
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
    const sc = scopeToCycle(snapshot, cycle);
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
    const ws = workspaces.find((w) => w.id === wsId) ?? (store.hasExample ? EXAMPLE : { id: wsId ?? '', name: 'Workspace', kind: 'own' as const, createdAt: '' });
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
    // Records are stamped with the real time of day, moved to the app's today (the demo and the evals pin today to a date).
    const skewDays = Math.round((now.getTime() - Date.now()) / 86_400_000);
    const stamp = () => new Date(Date.now() + skewDays * 86_400_000).toISOString();

    // The shared actions (domain/actions.ts): who may do what, and what it saves. A rule that says no is shown, not saved.
    const ax = (): A.ActionContext => ({ snapshot: sc, cycle, week, actor: viewer, now: stamp(), newId, allGoals: snapshot.goals, full: snapshot });
    const rx = (): RunContext => ({ ...ax(), workspace: workspacesNow.current.find((w) => w.id === ws.id) ?? ws, modules: MODULES });
    async function act<T extends Commit | { commit: Commit | null } | null>(run: () => T): Promise<T> {
      let out: T;
      try { out = run(); } catch (e) { if (e instanceof A.NotAllowed) toast(e.message, 'error'); throw e; }
      const c = out && 'commit' in out ? out.commit : (out as Commit | null);
      if (c) await commit(c);
      return out;
    }
    const undoBy = (c: Commit, before: Snapshot) => () => { void act(() => R.undoRemoval(ax(), c, before)).then(() => toast('Undone')).catch(() => undefined); };

    // What a removal says, with Undo for 10 seconds (domain/removal). Undo puts back every record the removal changed,
    // as it was just before (what it handed over or moved included).
    const nameOf = (id: string) => people.get(id)?.name;
    const said: { [N in ActionName]?: (out: NonNullable<ReturnType<typeof perform<N>>>, input: ActionInput<N>) => string } = {
      unwatch: (c) => c.changes[0]?.summary ?? 'Stopped watching',
      removeMetric: (c) => c.changes[0]!.summary,
      deleteView: (c) => c.changes[0]!.summary,
      unlinkGoalMetric: (c) => c.changes[0]!.summary,
      markPersonLeft: (_, i) => `${nameOf(i.personId) ?? 'They'} ${nameOf(i.personId) ? 'is' : 'are'} marked as left`,
      deletePerson: (_, i) => `Deleted ${nameOf(i.personId) ?? 'them'}`,
      stopGoal: (_, i) => `Stopped ${lookup.goal(i.goalId)?.title ?? 'the goal'}`,
      deleteGoal: (_, i) => `Deleted ${lookup.goal(i.goalId)?.title ?? 'the goal'}`,
      deleteCheckIn: (_, i) => `Deleted the check-in for week ${snapshot.checkIns.find((c) => c.id === i.checkInId)?.week ?? ''}`,
      endReview: (o, i) => `${o.deleted ? 'Deleted' : ENDED} the review “${sc.reviews.find((r) => r.id === i.reviewId)?.name ?? ''}”`,
      deleteReview: (_, i) => `Deleted the review “${sc.reviews.find((r) => r.id === i.reviewId)?.name ?? ''}”`,
      deleteComment: () => COMMENT_REMOVED,
      deleteNote: () => NOTE_REMOVED,
      deleteCycle: (_, i) => `Deleted the cycle ${snapshot.cycles.find((c) => c.id === i.cycleId)?.name ?? ''}`,
    };

    /** The dispatcher (app/actions.ts): one way to run an action. Who, when and ids are set here. */
    async function run<N extends ActionName>(name: N, input: ActionInput<N>, opts: { said?: string } = {}): Promise<RunResult<N>> {
      const before = snapshot;
      // Outside the demo, nobody signed in can't act: there is no stand-in to act as (AX3).
      if (!signedIn.current) { toast(NOBODY, 'error'); throw new Error(NOBODY); }
      let out: ReturnType<typeof perform<N>>;
      try { out = perform(rx(), name, input); } catch (e) { if (e instanceof A.NotAllowed) toast(e.message, 'error'); throw e; }
      // A token's secret is made where it's kept (the shared database makes its own) and shown once; only its hash is stored.
      if (name === 'createToken') return (await issueToken(out as Commit)) as RunResult<N>;
      if (name === 'planChanges' && (input as ActionInput<'planChanges'>).apply && !(out as ChangeSet).commit) throw new Error('These changes can’t be saved yet.');
      const c = commitOf(name, out, input);
      if (!c) return out as RunResult<N>;
      await commit(c);
      if (name === 'markReviewed') {
        const n = (input as ActionInput<'markReviewed'>).goalIds.length;
        const review = sc.reviews.find((r) => r.id === (input as ActionInput<'markReviewed'>).reviewId);
        toast(opts.said ?? `${n} ${n === 1 ? 'goal' : 'goals'} marked reviewed in ${review?.name ?? 'the review'}`, 'success', { label: 'Undo', run: () => { void act(() => R.unmarkReviewed(ax(), c.decisions ?? [])).then(() => toast('Undone: back on the agenda')).catch(() => undefined); } });
      } else {
        const say = said[name] as ((o: unknown, i: unknown) => string) | undefined;
        if (say) toast(opts.said ?? say(out, input), 'success', { label: 'Undo', run: undoBy(c, before) });
      }
      return out as RunResult<N>;
    }

    return traced({
      run: (name, input, opts) => telemetry.action(name, () => run(name, input, opts)),
      mode, viewerChosen: mode === 'demo' || chosen, canChooseViewer: !!identity.choose,
      ws, workspaces, opening: wanted && wanted !== wsId ? workspaces.find((w) => w.id === wanted) ?? null : null, snapshot: sc, allGoals: snapshot.goals, full: snapshot, cycle, week, today: now, viewer, lookup, stamp, toast, storeKind: store.kind, saveNote,
      switchWorkspace: (id) => { write(K.ws, id); setWsId(id); },
      createWorkspace,
      resetExample: async () => {
        const s = await store.resetExample(ws.kind === 'example' ? ws.id : EXAMPLE.id);
        // Everything else the demo keeps in this browser goes too: drafts, what's been seen, walkthroughs, layouts.
        forgetDemoBrowser();
        if (ws.kind === 'example') setLoaded({ ws: ws.id, snap: s, at: Date.now() });
        toast('The example is back to its starting point, drafts and all');
      },
      deleteWorkspace: async () => {
        if (ws.kind === 'example') throw new Error('Examples can be reset, not deleted.');
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
        setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, recording: on } : w)));
      },
      setModule: async (id, on) => {
        const out = await run('setModule', { moduleId: id, on });
        if (!out?.modulesOff) return;
        const off = out.modulesOff;
        setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, modulesOff: off } : w)));
      },
      setViewer: (id) => { if (!identity.choose || !wsId) return; identity.choose(wsId, id); setViewerId(id); },
      person: (id) => people.get(id),
      personName: (id) => { const p = people.get(id); if (!p) return id; const sh = sharedNames(); return sh.ids.has(id) && sh.twins.has(p.name.trim().toLowerCase()) ? nameWithTell(p, sc.people, lookup.teamName) : p.name; },
      goalTell: (g) => goalTell(g, dupTitles(), lookup.teamName),
      avatarHue: (id) => hues().get(id),
      team: (id) => sc.teams.find((t) => t.id === id),
      // By ID or by key, so /goals/G-12 opens the same goal as its ID does. A stopped goal still opens (its page says so).
      goal: (id) => findGoal(sc.goals, id) ?? archived(id),
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
      postCheckIn: (goal, draft, existing) => {
        const inFlight = posting.current.get(goal.id);
        if (inFlight) return inFlight;
        const run = (async () => {
        const c = toCheckIn(goal, cycle, week, draft, sc.checkIns, viewer.id, new Date(stamp()), existing?.id ?? newId('ci'));
        const change = checkInChange(existing, c, goal, viewer.id, newId('chg'));
        // Another check-in in the same week is kept alongside the first; the latest is the week's status.
        if (change && !existing && sc.checkIns.some((x) => x.goalId === goal.id && x.week === week)) change.summary = change.summary.replace('Checked in for week', 'Checked in again for week');
        // The ask in a check-in raises, continues or withdraws a request (domain/asks).
        const req = requestsAfterCheckIn(goal, c, sc, viewer.id, c.postedAt, newId);
        await commit({ checkIns: [c], requests: req.requests, changes: [...(change ? [change] : []), ...req.changes] });
        return c;
        })();
        posting.current.set(goal.id, run);
        void run.catch(() => undefined).finally(() => posting.current.delete(goal.id));
        return run;
      },
      answerRequest: async (r, answer) => { await run('answerRequest', { askId: r.id, answer }); },
      markActionDone: async (r, note) => { await run('markActionDone', { askId: r.id, note }); },
      askQuestion: async (goal, text) => { await run('askQuestion', { goalId: goal.id, text }); },
      linkRequest: async (r, goal) => { await run('linkRequest', { askId: r.id, goalId: goal.id }); },
      withdrawRequest: async (r, goal) => { await run('withdrawRequest', { askId: r.id, goalId: goal?.id }); },
      saveGoal: async (after, before, why, opts) => {
        if (makesLoop(after.id, after.parentId, sc.goals)) {
          toast('That would make a loop: the goal it feeds already feeds into it. Pick another.', 'error');
          throw new Error('loop');
        }
        // A new goal takes the workspace's next key; a goal being changed keeps its own.
        if (!before && !after.key) after = { ...after, key: nextKey(sc.goals, sc.keysIssued) };
        const change = goalChange(before, after, lookup, viewer.id, stamp(), newId('chg'));
        if (change && why?.trim()) change.diffs.push({ field: 'Why', from: '—', to: why.trim() });
        // Stages already done at set-up go in the same save as the goal, so it is never seen late in between.
        let done: Commit | null = null;
        if (!before && opts?.stagesDone?.length) {
          try { done = A.recordStagesDone({ ...ax(), snapshot: { ...sc, goals: [...sc.goals, after] } }, after, opts.stagesDone); } catch (e) { if (e instanceof A.NotAllowed) toast(e.message, 'error'); throw e; }
        }
        await commit({ goals: [after], changes: [...(change ? [change] : []), ...(done?.changes ?? [])], ...(done?.checkIns ? { checkIns: done.checkIns } : {}) });
      },
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
      // A change set is worked out here and saved by applyChanges, so the screen shows the preview the person agreed to.
      previewChanges: (tables, via, reason, confirm) => perform(rx(), 'planChanges', { tables, via, reason, confirm }),
      applyChanges: async (cs) => {
        if (!cs.commit) throw new Error('These changes can’t be saved yet.');
        await commit(cs.commit);
      },
      createToken: (personId, name) => run('createToken', { personId, name }),
      saveView: async (v) => (await run('saveView', v)).id,
      saveTableView: async (v, head) => (await run('saveTableView', { ...v, head })).id,
      deleteView: async (id) => { await run('deleteView', { viewId: id }); },
      saveMetric: async (m) => (await run('saveMetric', m)).metric.id,
      removeMetric: async (id) => { await run('removeMetric', { metricId: id }); },
      linkGoalMetric: async (goal, metricId, teamId) => { await run('linkGoalMetric', { goalId: goal.id, metricId, teamId }); },
      unlinkGoalMetric: async (goal) => { await run('unlinkGoalMetric', { goalId: goal.id }); },
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
      undoImport: async (importId) => { const out = await run('undoImport', { importId }); return { restored: out.restored, skipped: out.skipped }; },
      restoreRemoved: async (kind, id) => { await run('restoreRemoved', { kind, id }); },
      recentlyRemoved: () => R.recentlyRemoved(snapshot, now),
      comment: (id) => (comments ??= R.commentsOf(sc.changes)).get(id),
      pinView: async (id, pinned) => { await run('pinView', { viewId: id, pinned }); },
      revokeToken: async (id) => { await run('revokeToken', { tokenId: id }); },
      startNextCycle: async () => (await run('startNextCycle', {})).name,
    });
  }, [loaded, wanted, viewerId, store, today, workspaces, commit, issueToken, toast, createWorkspace, mode, saveNote]);

  const setup = useMemo<SetupState>(() => ({ mode, today: today(), hasWorkspaces: workspaces.length > 0, createWorkspace, toasts, toast }), [mode, today, workspaces, createWorkspace, toasts, toast]);

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
