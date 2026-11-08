import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { planChanges, type ChangeSet, type Tables, type Via } from '../domain/changeset';
import { ACTIONS } from '../mcp/parity';
import { telemetry } from '../telemetry';
import * as R from '../domain/removal';
import { COMMENT_REMOVED, ENDED, leftName, NOTE_REMOVED, UNDO_MS } from '../domain/vocabulary';

/** The actions telemetry names, one trace each: every one in AppState (parity.ts lists them), except previewChanges,
    which only works out a change, and createWorkspace, which is timed where it's defined (onboarding uses it too). */
const TRACED = Object.keys(ACTIONS).filter((k) => k !== 'previewChanges' && k !== 'createWorkspace');
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
  /** In the real app, whether this person has said who they are in this workspace (sign-in comes with SSO). */
  viewerChosen: boolean;
  ws: Workspace;
  workspaces: Workspace[];
  switchWorkspace(id: string): void;
  createWorkspace(name: string, data: Snapshot, meId?: string): Promise<string>;
  resetExample(): Promise<void>;
  /** Admins: delete the open workspace (not an example) and everything in it, then open another. */
  deleteWorkspace(): Promise<void>;
  /** Admins: give the open workspace a new name. */
  renameWorkspace(name: string): Promise<void>;
  /** Admins: add a team, or rename one or change its lead. Returns its id. */
  saveTeam(t: { id?: string; name: string; leadId?: string | null }): Promise<string>;
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
  team(id: string): Team | undefined;
  goal(id: string): Goal | undefined;
  statusOf(goal: Goal): GoalStatus;
  attentionOf(goal: Goal): GoalAttention;
  checkInsOf(goal: Goal): CheckIn[];
  lookup: Lookup;
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
  /** Saves a goal and logs what changed, with the owner's reason when the plan or target moved. */
  saveGoal(after: Goal, before: Goal | null, why?: string): Promise<void>;
  /** A logged comment on a goal. Anyone can comment; it doesn't change the status, and it asks nothing of anyone. */
  addNote(goal: Goal, text: string): Promise<void>;
  /** Ask a goal's owner for an update: open on their Home until they check in or answer it, or it's withdrawn. */
  askForUpdate(goal: Goal): Promise<void>;
  undoUpdateAsk(goal: Goal): Promise<void>;
  /** Ask a goal's owner a question: open until they answer it. */
  askQuestion(goal: Goal, text: string): Promise<void>;
  /** What someone says about a goal in a review: seen, a note, a question for the owner, or an action. */
  reviewCall(goal: Goal, review: Review, week: number, kind: 'acknowledge' | 'note' | 'ask' | 'action', note: string, extra?: { assigneeId?: string | null; dueWeek?: number | null }): Promise<void>;
  /** Correct a note, question or action someone said; the change log keeps the before and after. */
  editCall(d: Decision, note: string, extra?: { assigneeId?: string | null; dueWeek?: number | null }): Promise<void>;
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
  previewChanges(tables: Tables, via: Via, reason?: string): ChangeSet;
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
  /* Removing, archiving and undoing (domain/removal): each shows a message with Undo for 10 seconds and is logged. */
  /** Admins: mark someone as left, handing their goals and open asks to the people given. */
  markPersonLeft(id: string, to: { goalsTo?: string | null; asksTo?: string | null }): Promise<void>;
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
  createWorkspace(name: string, data: Snapshot, meId?: string): Promise<string>;
  toasts: Toast[];
  toast(text: string, kind?: Toast['kind']): void;
}
const SetupCtx = createContext<SetupState | null>(null);

export function useSetup(): SetupState {
  const v = useContext(SetupCtx);
  if (!v) throw new Error('useSetup outside AppProvider');
  return v;
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

const ToastCtx = createContext<Toast[]>([]);
/** The messages on screen. Kept apart from the app state so a message coming and going doesn't recompute every screen. */
export const useToasts = () => useContext(ToastCtx);

export function AppProvider({ store, mode = 'demo', today = realNow, empty: renderEmpty, children }: { store: Store; mode?: Mode; today?: () => Date; empty?: () => ReactNode; children: ReactNode }) {
  // The demo and the real app remember their own workspace and person, so one never opens the other's.
  const K = mode === 'demo' ? { ws: 'goals-app-workspace', viewer: 'goals-app-viewer:' } : { ws: 'goals-live-workspace', viewer: 'goals-live-me:' };
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsId, setWsId] = useState<string | null>(() => read(K.ws) || (store.hasExample ? EXAMPLE.id : null));
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
      const snap = await store.load(id);
      if (!live) return;
      setLoaded({ ws: id, snap, at: Date.now() });
      setViewerId(read(K.viewer + id));
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

  const createWorkspace = useCallback((name: string, data: Snapshot, meId?: string) => telemetry.action('createWorkspace', async () => {
    const at = new Date().toISOString();
    const w: Workspace = { id: newId('ws'), name, kind: 'own', createdAt: at };
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
    if (actor) write(K.viewer + w.id, actor.id);
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
    const ws = workspaces.find((w) => w.id === wsId) ?? (store.hasExample ? EXAMPLE : { id: wsId ?? '', name: 'Workspace', kind: 'own' as const, createdAt: '' });
    const fallback = sc.people.find((p) => p.id === 'rhea') ?? sc.people.find((p) => sc.goals.some((g) => g.ownerId === p.id)) ?? sc.people[0]!;
    const chosen = !!viewerId && sc.people.some((p) => p.id === viewerId);
    const viewer = (chosen && people.get(viewerId!)) || fallback;
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
    async function act<T extends Commit | { commit: Commit | null } | null>(run: () => T): Promise<T> {
      let out: T;
      try { out = run(); } catch (e) { if (e instanceof A.NotAllowed) toast(e.message, 'error'); throw e; }
      const c = out && 'commit' in out ? out.commit : (out as Commit | null);
      if (c) await commit(c);
      return out;
    }

    /**
     * A removal (domain/removal): saved and logged, then a message with Undo for 10 seconds. Undo puts back every record
     * the removal changed, as it was just before (what it handed over or moved included).
     */
    async function removal<T extends Commit | { commit: Commit }>(run: () => T, said: (out: T) => string): Promise<T> {
      const before = snapshot;
      const out = await act(run);
      const c = ('commit' in out ? out.commit : out) as Commit;
      toast(said(out), 'success', { label: 'Undo', run: () => { void act(() => R.undoRemoval(ax(), c, before)).then(() => toast('Undone')).catch(() => undefined); } });
      return out;
    }

    return traced({
      mode, viewerChosen: mode === 'demo' || chosen,
      ws, workspaces, snapshot: sc, allGoals: snapshot.goals, full: snapshot, cycle, week, today: now, viewer, lookup, stamp, toast, storeKind: store.kind, saveNote,
      switchWorkspace: (id) => { write(K.ws, id); setWsId(id); },
      createWorkspace,
      resetExample: async () => {
        const s = await store.resetExample(ws.kind === 'example' ? ws.id : EXAMPLE.id);
        if (ws.kind === 'example') setLoaded({ ws: ws.id, snap: s, at: Date.now() });
        toast('The example is back to its starting point');
      },
      deleteWorkspace: async () => {
        if (ws.kind === 'example') throw new Error('Examples can be reset, not deleted.');
        await store.deleteWorkspace(ws.id);
        const rest = workspaces.filter((w) => w.id !== ws.id);
        setWorkspaces(rest);
        const next = rest[0]?.id ?? null;
        write(K.ws, next ?? '');
        setLoaded(null);
        setWsId(next);
        toast(`Deleted ${ws.name}`);
      },
      renameWorkspace: async (name) => {
        const out = await act(() => A.renameWorkspace(ax(), ws, name));
        if (out?.workspace) { const next = out.workspace.name; setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, name: next } : w))); }
      },
      saveTeam: async (t) => { const out = await act(() => A.saveTeam(ax(), t)); return out.id; },
      removeTeam: async (id, moveTo) => { await act(() => A.removeTeam(ax(), id, moveTo)); },
      setRecording: async (on) => {
        const out = await act(() => A.setRecording(ax(), ws, on));
        if (!out) return;
        // At once, before anything else is recorded: off means nothing more is sent for this workspace.
        telemetry.setContext({ recording: on });
        setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, recording: on } : w)));
      },
      setModule: async (id, on) => {
        const out = await act(() => A.setModule(ax(), ws, MODULES, id, on));
        if (!out?.modulesOff) return;
        const off = out.modulesOff;
        setWorkspaces((l) => l.map((w) => (w.id === wsId ? { ...w, modulesOff: off } : w)));
      },
      setViewer: (id) => { write(K.viewer + wsId, id); setViewerId(id); },
      person: (id) => people.get(id),
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
      answerRequest: async (r, answer) => { await act(() => A.answerRequest(ax(), r, answer)); },
      markActionDone: async (r, note) => { await act(() => A.markActionDone(ax(), r, note ?? '')); },
      askQuestion: async (goal, text) => { await act(() => A.askQuestion(ax(), goal, text)); },
      linkRequest: async (r, goal) => { await act(() => A.linkRequest(ax(), r, goal)); },
      withdrawRequest: async (r, goal) => { await act(() => A.withdrawRequest(ax(), r, goal)); },
      saveGoal: async (after, before, why) => {
        if (makesLoop(after.id, after.parentId, sc.goals)) {
          toast('That would make a loop: the goal it feeds already feeds into it. Pick another.', 'error');
          throw new Error('loop');
        }
        // A new goal takes the workspace's next key; a goal being changed keeps its own.
        if (!before && !after.key) after = { ...after, key: nextKey(sc.goals, sc.keysIssued) };
        const change = goalChange(before, after, lookup, viewer.id, stamp(), newId('chg'));
        if (change && why?.trim()) change.diffs.push({ field: 'Why', from: '—', to: why.trim() });
        await commit({ goals: [after], changes: change ? [change] : [] });
      },
      addNote: async (goal, text) => { await act(() => A.addNote(ax(), goal, text)); },
      askForUpdate: async (goal) => { await act(() => A.askForUpdate(ax(), goal)); },
      undoUpdateAsk: async (goal) => { await act(() => A.undoUpdateAsk(ax(), goal)); },
      reviewCall: async (goal, review, sessionWeek, kind, note, extra) => { await act(() => A.reviewCall(ax(), goal, review, kind, note, { week: sessionWeek, ...extra })); },
      editCall: async (d, note, extra) => { await act(() => A.editCall(ax(), d, note, extra)); },
      watch: async (kind, ref) => { await act(() => A.watch(ax(), kind, ref)); },
      unwatch: async (watchId) => { await removal(() => A.unwatch(ax(), watchId), (c) => c.changes[0]?.summary ?? 'Stopped watching'); },
      savePerson: async (p, before) => { await act(() => A.savePerson(ax(), p, before)); },
      saveReview: async (review, before) => { await act(() => A.saveReview(ax(), review, before)); },
      saveRetro: async (goal, retro) => { await act(() => A.saveRetro(ax(), goal, retro)); },
      sendFeedback: async (mood, text, path) => {
        await act(() => A.sendFeedback(ax(), mood, text, path));
        // The demo's data lives in this browser only, so its feedback is also sent where the people building the app read it.
        if (mode === 'demo') void sendDemoFeedback({ mood, text, path, persona: `${viewer.name}${viewer.role ? ', ' + viewer.role : ''}` });
      },
      previewChanges: (tables, via, reason) => planChanges({ tables, snapshot: sc, cycle, week, actor: viewer, now: stamp(), newId, via, reason, full: snapshot }),
      applyChanges: async (cs) => {
        if (!cs.commit) throw new Error('These changes can’t be saved yet.');
        await commit(cs.commit);
      },
      createToken: async (personId, name) => {
        let c: Commit;
        try { c = A.createToken(ax(), personId, name); } catch (e) { if (e instanceof A.NotAllowed) toast(e.message, 'error'); throw e; }
        // The secret is made where it's kept (the shared database makes its own) and shown once; only its hash is stored.
        return issueToken(c);
      },
      saveView: async (v) => { const out = await act(() => A.saveView(ax(), v)); return out.id; },
      saveTableView: async (v, head) => { const out = await act(() => A.saveTableView(ax(), v, head)); return out.id; },
      deleteView: async (id) => {
        const before = snapshot;
        const out = await act(() => A.deleteView(ax(), id));
        if (out) toast(out.changes[0]!.summary, 'success', { label: 'Undo', run: () => { void act(() => R.undoRemoval(ax(), out, before)).then(() => toast('Undone')).catch(() => undefined); } });
      },
      markPersonLeft: async (id, to) => { await removal(() => R.markPersonLeft(ax(), id, to), () => `${people.get(id)?.name ?? 'They'} ${people.get(id) ? 'is' : 'are'} marked as left`); },
      deletePerson: async (id) => { await removal(() => R.deletePerson(ax(), id), () => `Deleted ${people.get(id)?.name ?? 'them'}`); },
      stopGoal: async (goal, reason) => { await removal(() => R.stopGoal(ax(), goal.id, reason), () => `Stopped ${goal.title}`); },
      deleteGoal: async (goal) => { await removal(() => R.deleteGoal(ax(), goal.id), () => `Deleted ${goal.title}`); },
      deleteCheckIn: async (c) => { await removal(() => R.deleteCheckIn(ax(), c.id), () => `Deleted the check-in for week ${c.week}`); },
      endReview: async (id) => { await removal(() => R.endReview(ax(), id), (o) => `${o.deleted ? 'Deleted' : ENDED} the review “${sc.reviews.find((r) => r.id === id)?.name ?? ''}”`); },
      deleteReview: async (id) => { await removal(() => R.deleteReview(ax(), id), () => `Deleted the review “${sc.reviews.find((r) => r.id === id)?.name ?? ''}”`); },
      editComment: async (id, text) => { await act(() => R.editComment(ax(), id, text)); },
      deleteComment: async (id) => { await removal(() => R.deleteComment(ax(), id), () => COMMENT_REMOVED); },
      deleteNote: async (id) => { await removal(() => R.deleteNote(ax(), id), () => NOTE_REMOVED); },
      deleteCycle: async (id) => { await removal(() => R.deleteCycle(ax(), id), () => `Deleted the cycle ${snapshot.cycles.find((c) => c.id === id)?.name ?? ''}`); },
      undoImport: async (importId) => { const out = await act(() => R.undoImport(ax(), importId)); return { restored: out.restored, skipped: out.skipped }; },
      restoreRemoved: async (kind, id) => { await act(() => R.restoreRemoved(ax(), kind, id)); },
      recentlyRemoved: () => R.recentlyRemoved(snapshot, now),
      comment: (id) => (comments ??= R.commentsOf(sc.changes)).get(id),
      pinView: async (id, pinned) => { await act(() => A.pinView(ax(), id, pinned)); },
      revokeToken: async (id) => { await act(() => A.revokeToken(ax(), id)); },
      startNextCycle: async () => { const out = await act(() => A.startNextCycle(ax())); return out.name; },
    });
  }, [loaded, viewerId, store, today, workspaces, commit, issueToken, toast, createWorkspace, mode, saveNote]);

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
