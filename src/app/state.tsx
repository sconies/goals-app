import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { attentionFor, type GoalAttention } from '../domain/attention';
import { checkInChange, goalChange, type Lookup } from '../domain/changes';
import { toCheckIn, type Draft } from '../domain/checkin';
import { currentWeek } from '../domain/plan';
import { checkInsFor, goalStatus, type GoalStatus } from '../domain/status';
import type { CheckIn, Cycle, Decision, Goal, Person, Retro, Review, Snapshot, Team, Watch, Workspace } from '../domain/types';
import { makesLoop } from '../domain/tree';
import { currentCycle, nextCycle, RESULT_LABEL, scopeToCycle } from '../domain/cycle';
import { applyCommit, EXAMPLE, isStale, newId, withExpectations, type Commit, type Mode, type Store } from '../data/store';
import { planChanges, type ChangeSet, type Tables, type Via } from '../domain/changeset';
import { hashToken, newToken } from '../mcp/protocol';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

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
  snapshot: Snapshot;
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
  /** Saves a goal and logs what changed, with the owner's reason when the plan or target moved. */
  saveGoal(after: Goal, before: Goal | null, why?: string): Promise<void>;
  /** A logged comment on a goal. Anyone can comment; it doesn't change the status. */
  addNote(goal: Goal, text: string): Promise<void>;
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
  /** Delete one of your views; an admin can also delete a pinned one. */
  deleteView(id: string): Promise<void>;
  /** Admins: show a view to everyone in the workspace, or stop. */
  pinView(id: string, pinned: boolean): Promise<void>;
  /** Now, as an ISO timestamp on the app's today. Use for anything saved. */
  stamp(): string;
  toast(text: string, kind?: Toast['kind']): void;
  storeKind: Store['kind'];
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
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = ++toastId.current;
    // One success message at a time: a new one replaces the last, so they never pile up over the page. Errors stay until they time out.
    setToasts((t) => [...(kind === 'success' ? t.filter((x) => x.kind === 'error') : t), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3200);
  }, []);

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

  const createWorkspace = useCallback(async (name: string, data: Snapshot, meId?: string) => {
    const at = new Date().toISOString();
    const w: Workspace = { id: newId('ws'), name, kind: 'own', createdAt: at };
    const actor = (meId && data.people.find((p) => p.id === meId)) || data.people.find((p) => p.admin) || data.people[0];
    const logged: Snapshot = {
      ...data,
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
  }, [store]);

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
    const people = new Map(sc.people.map((p) => [p.id, p]));
    const ws = workspaces.find((w) => w.id === wsId) ?? (store.hasExample ? EXAMPLE : { id: wsId ?? '', name: 'Workspace', kind: 'own' as const, createdAt: '' });
    const fallback = sc.people.find((p) => p.id === 'maya') ?? sc.people.find((p) => sc.goals.some((g) => g.ownerId === p.id)) ?? sc.people[0]!;
    const chosen = !!viewerId && people.has(viewerId);
    const viewer = (chosen && people.get(viewerId!)) || fallback;
    const statuses = new Map<string, GoalStatus>();
    const attention = new Map<string, GoalAttention>();
    const lookup: Lookup = {
      person: (id) => people.get(id),
      goal: (id) => sc.goals.find((g) => g.id === id),
      teamName: (id) => sc.teams.find((t) => t.id === id)?.name ?? id,
    };
    // Records are stamped with the real time of day, moved to the app's today (the demo and the evals pin today to a date).
    const skewDays = Math.round((now.getTime() - Date.now()) / 86_400_000);
    const stamp = () => new Date(Date.now() + skewDays * 86_400_000).toISOString();

    return {
      mode, viewerChosen: mode === 'demo' || chosen,
      ws, workspaces, snapshot: sc, cycle, week, today: now, viewer, lookup, stamp, toast, storeKind: store.kind,
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
      setViewer: (id) => { write(K.viewer + wsId, id); setViewerId(id); },
      person: (id) => people.get(id),
      team: (id) => sc.teams.find((t) => t.id === id),
      goal: (id) => sc.goals.find((g) => g.id === id),
      statusOf: (g) => {
        let st = statuses.get(g.id);
        if (!st) statuses.set(g.id, (st = goalStatus(g, cycle, sc.checkIns, now)));
        return st;
      },
      attentionOf: (g) => {
        let a = attention.get(g.id);
        if (!a) attention.set(g.id, (a = attentionFor(g, snapshot, cycle, now)));
        return a;
      },
      checkInsOf: (g) => checkInsFor(g, sc.checkIns),
      postCheckIn: async (goal, draft, existing) => {
        const c = toCheckIn(goal, cycle, week, draft, sc.checkIns, viewer.id, new Date(stamp()), existing?.id ?? newId('ci'));
        const change = checkInChange(existing, c, goal, viewer.id, newId('chg'));
        // Another check-in in the same week is kept alongside the first; the latest is the week's status.
        if (change && !existing && sc.checkIns.some((x) => x.goalId === goal.id && x.week === week)) change.summary = change.summary.replace('Checked in for week', 'Checked in again for week');
        await commit({ checkIns: [c], changes: change ? [change] : [] });
        return c;
      },
      saveGoal: async (after, before, why) => {
        if (makesLoop(after.id, after.parentId, sc.goals)) {
          toast('That would make a loop: the goal it feeds already feeds into it. Pick another.', 'error');
          throw new Error('loop');
        }
        const change = goalChange(before, after, lookup, viewer.id, stamp(), newId('chg'));
        if (change && why?.trim()) change.diffs.push({ field: 'Why', from: '—', to: why.trim() });
        await commit({ goals: [after], changes: change ? [change] : [] });
      },
      addNote: async (goal, text) => {
        const t = text.trim();
        await commit({ changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: goal.id, entity: 'note', entityId: newId('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: t }] }] });
      },
      reviewCall: async (goal, review, sessionWeek, kind, note, extra) => {
        const d: Decision = { id: newId('dec'), goalId: goal.id, checkInId: null, reviewId: review.id, week: sessionWeek, kind, byId: viewer.id, at: stamp(), note: note.trim(), ...(kind === 'action' ? { assigneeId: extra?.assigneeId ?? goal.ownerId, dueWeek: extra?.dueWeek ?? null } : {}) };
        const action = ({ acknowledge: 'acknowledged', note: 'noted', ask: 'asked', action: 'actioned' } as const)[kind];
        const what = ({ acknowledge: 'Looked at it', note: 'Added a note', ask: 'Asked the owner a question', action: 'Agreed an action' } as const)[kind];
        await commit({
          decisions: [d],
          changes: [{ id: newId('chg'), at: d.at, actorId: viewer.id, goalId: goal.id, entity: 'decision', entityId: d.id, action, summary: `${what} in ${review.name}`, diffs: note.trim() ? [{ field: kind === 'ask' ? 'Question' : kind === 'action' ? 'Action' : 'Note', from: '—', to: note.trim() }, ...(kind === 'action' ? [{ field: 'Who', from: '—', to: lookup.person(d.assigneeId ?? '')?.name ?? '—' }, ...(d.dueWeek ? [{ field: 'Due', from: '—', to: `week ${d.dueWeek}` }] : [])] : [])] : [] }],
        });
      },
      editCall: async (d, note, extra) => {
        const after: Decision = { ...d, note: note.trim(), ...(d.kind === 'action' && extra ? { assigneeId: extra.assigneeId ?? d.assigneeId ?? null, dueWeek: extra.dueWeek ?? null } : {}) };
        const diffs = [
          ...(after.note !== d.note ? [{ field: d.kind === 'ask' ? 'Question' : d.kind === 'action' ? 'Action' : 'Note', from: d.note, to: after.note }] : []),
          ...(after.assigneeId !== d.assigneeId ? [{ field: 'Who', from: lookup.person(d.assigneeId ?? '')?.name ?? '—', to: lookup.person(after.assigneeId ?? '')?.name ?? '—' }] : []),
          ...(after.dueWeek !== d.dueWeek ? [{ field: 'Due', from: d.dueWeek ? `week ${d.dueWeek}` : '—', to: after.dueWeek ? `week ${after.dueWeek}` : '—' }] : []),
        ];
        if (!diffs.length) return;
        await commit({ decisions: [after], changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: d.goalId, entity: 'decision', entityId: d.id, action: 'edited', summary: `Corrected ${d.kind === 'ask' ? 'a question' : d.kind === 'action' ? 'an action' : 'a note'}`, diffs }] });
      },
      watch: async (kind, ref) => {
        if (sc.watches.some((w) => w.personId === viewer.id && w.kind === kind && w.ref === ref)) return;
        await commit({ watches: [{ id: newId('w'), personId: viewer.id, kind, ref }], changes: [] });
      },
      unwatch: async (watchId) => { await commit({ unwatch: [watchId], changes: [] }); },
      savePerson: async (p, before) => {
        const diffs = before
          ? [...(before.name !== p.name ? [{ field: 'Name', from: before.name, to: p.name }] : []), ...(before.teamId !== p.teamId ? [{ field: 'Team', from: lookup.teamName(before.teamId ?? '') || '—', to: lookup.teamName(p.teamId ?? '') || '—' }] : []), ...(before.admin !== p.admin ? [{ field: 'Admin', from: before.admin ? 'Yes' : 'No', to: p.admin ? 'Yes' : 'No' }] : [])]
          : [{ field: 'Person', from: '—', to: p.name }];
        await commit({ people: [p], changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: null, entity: 'person', entityId: p.id, action: before ? 'edited' : 'created', summary: before ? `Changed ${p.name}` : `Added ${p.name}`, diffs }] });
      },
      saveReview: async (review, before) => {
        const at = stamp();
        const diffs = before ? [
          ...(before.name !== review.name ? [{ field: 'Name', from: before.name, to: review.name }] : []),
          ...(before.everyWeeks !== review.everyWeeks || before.weekday !== review.weekday ? [{ field: 'When', from: `every ${before.everyWeeks} wk`, to: `every ${review.everyWeeks} wk` }] : []),
          ...(JSON.stringify(before.scope) !== JSON.stringify(review.scope) ? [{ field: 'Goals', from: 'changed', to: 'changed' }] : []),
          ...(JSON.stringify(before.people) !== JSON.stringify(review.people) ? [{ field: 'People', from: String(before.people.length), to: String(review.people.length) }] : []),
        ] : [{ field: 'Review', from: '—', to: review.name }];
        await commit({ reviews: [review], changes: [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'review', entityId: review.id, action: before ? 'edited' : 'created', summary: before ? `Changed the review “${review.name}”` : `Set up a review: “${review.name}”`, diffs }] });
      },
      saveRetro: async (goal, retro, before) => {
        const diffs = [
          ...(!before || before.result !== retro.result ? [{ field: 'Result', from: before ? RESULT_LABEL[before.result] : '—', to: RESULT_LABEL[retro.result] }] : []),
          ...(!before || before.learned !== retro.learned ? [{ field: 'Learned', from: before?.learned ?? '—', to: retro.learned }] : []),
          ...(!before || before.next !== retro.next ? [{ field: 'Next cycle', from: before ? (before.next === 'carry' ? 'Carry on' : 'Stop') : '—', to: retro.next === 'carry' ? 'Carry on' : 'Stop' }] : []),
        ];
        await commit({ retros: [retro], changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: goal.id, entity: 'retro', entityId: retro.id, action: before ? 'edited' : 'posted', summary: `Wrapped up ${goal.title}: ${RESULT_LABEL[retro.result].toLowerCase()}`, diffs }] });
      },
      sendFeedback: async (mood, text, path) => {
        await commit({ feedback: [{ id: newId('fb'), personId: viewer.id, path, mood, text: text.trim(), at: stamp() }], changes: [] });
      },
      previewChanges: (tables, via, reason) => planChanges({ tables, snapshot: sc, cycle, week, actor: viewer, now: stamp(), newId, via, reason }),
      applyChanges: async (cs) => {
        if (!cs.commit) throw new Error('These changes can’t be saved yet.');
        await commit(cs.commit);
      },
      createToken: async (personId, name) => {
        if (!viewer.admin) throw new Error('Only admins can make tokens.');
        const token = newToken();
        const at = stamp();
        const t = { id: newId('tok'), personId, name: name.trim(), tokenHash: await hashToken(token), createdBy: viewer.id, createdAt: at, lastUsedAt: null, revokedAt: null };
        const who = lookup.person(personId)?.name ?? 'someone';
        await commit({ tokens: [t], changes: [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'person', entityId: personId, action: 'created', summary: `Gave ${who} an AI assistant token: “${t.name}”`, diffs: [{ field: 'AI assistant token', from: '—', to: t.name }] }] });
        return token;
      },
      saveView: async ({ id, name, params }) => {
        const clean = name.trim().slice(0, 80);
        if (!clean) throw new Error('Give the view a name.');
        const old = id ? (snapshot.views ?? []).find((x) => x.id === id && !x.deletedAt) : undefined;
        if (old && old.personId !== viewer.id && !viewer.admin) throw new Error('Only its owner or an admin can change this view.');
        const at = stamp();
        const v = old ? { ...old, name: clean, params, updatedAt: at } : { id: newId('view'), personId: viewer.id, name: clean, params, pinned: false, createdAt: at, updatedAt: at, deletedAt: null };
        // A personal view changes no goal, so it isn't logged; a pinned one changes what everyone sees, so it is.
        await commit({ views: [v], changes: old?.pinned ? [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'workspace', entityId: v.id, action: 'edited', summary: `Changed the pinned view “${clean}”`, diffs: [{ field: 'Pinned view', from: old.name, to: clean }] }] : [] });
        return v.id;
      },
      deleteView: async (id) => {
        const v = (snapshot.views ?? []).find((x) => x.id === id && !x.deletedAt);
        if (!v) return;
        if (v.personId !== viewer.id && !(viewer.admin && v.pinned)) throw new Error('Only its owner, or an admin for a pinned view, can delete this view.');
        const at = stamp();
        await commit({ views: [{ ...v, deletedAt: at, updatedAt: at }], changes: v.pinned ? [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'workspace', entityId: v.id, action: 'edited', summary: `Removed the pinned view “${v.name}”`, diffs: [{ field: 'Pinned view', from: v.name, to: '—' }] }] : [] });
      },
      pinView: async (id, pinned) => {
        if (!viewer.admin) throw new Error('Only admins can pin a view for everyone.');
        const v = (snapshot.views ?? []).find((x) => x.id === id && !x.deletedAt);
        if (!v || v.pinned === pinned) return;
        const at = stamp();
        await commit({ views: [{ ...v, pinned, updatedAt: at }], changes: [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'workspace', entityId: v.id, action: 'edited', summary: pinned ? `Pinned the view “${v.name}” for everyone` : `Unpinned the view “${v.name}”`, diffs: [{ field: 'Pinned view', from: pinned ? '—' : v.name, to: pinned ? v.name : '—' }] }] });
      },
      revokeToken: async (id) => {
        const t = (snapshot.tokens ?? []).find((x) => x.id === id);
        if (!t || t.revokedAt) return;
        if (!viewer.admin && t.personId !== viewer.id) throw new Error('Only an admin or the token’s person can revoke it.');
        const at = stamp();
        await commit({ tokens: [{ ...t, revokedAt: at }], changes: [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'person', entityId: t.personId, action: 'edited', summary: `Revoked the AI assistant token “${t.name}”`, diffs: [{ field: 'AI assistant token', from: t.name, to: 'Revoked' }] }] });
      },
      startNextCycle: async () => {
        const at = stamp();
        const next = nextCycle(cycle, sc.goals, sc.checkIns, sc.retros, { cycle: newId('cycle'), goal: () => newId('goal') }, at);
        const stopped = sc.goals.length - next.goals.length;
        await commit({
          cycles: [next.cycle], goals: next.goals,
          changes: [{ id: newId('chg'), at, actorId: viewer.id, goalId: null, entity: 'cycle', entityId: next.cycle.id, action: 'created', summary: `Started ${next.cycle.name}: ${next.goals.length} ${next.goals.length === 1 ? 'goal carries' : 'goals carry'} on${stopped ? `, ${stopped} stopped` : ''}`, diffs: [{ field: 'Cycle', from: cycle.name, to: next.cycle.name }] }],
        });
        return next.cycle.name;
      },
    };
  }, [loaded, viewerId, store, today, workspaces, commit, toast, createWorkspace, mode]);

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
        <div className="skeleton" />
        <span className="muted small">Loading goals…</span>
      </div>
    );
  } else {
    body = <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  return <ToastCtx.Provider value={toasts}><SetupCtx.Provider value={setup}>{body}</SetupCtx.Provider></ToastCtx.Provider>;
}
