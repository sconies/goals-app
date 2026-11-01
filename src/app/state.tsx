import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { attentionFor, pendingSummary, type GoalAttention } from '../domain/attention';
import { checkInChange, goalChange, type Lookup } from '../domain/changes';
import { toCheckIn, type Draft } from '../domain/checkin';
import { currentWeek } from '../domain/plan';
import { DECISION_LOG, withApprovedChange, withApprovedTarget } from '../domain/review';
import { checkInsFor, goalStatus, type GoalStatus } from '../domain/status';
import type { Change, CheckIn, Cycle, Decision, Goal, Person, Snapshot, Team, Workspace } from '../domain/types';
import { applyCommit, EXAMPLE, newId, type Commit, type Mode, type Store } from '../data/store';
import { fmt } from '../domain/format';

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
  /** Saves a goal and logs what changed. */
  saveGoal(after: Goal, before: Goal | null): Promise<void>;
  /** Proposes a change to the plan; the sponsor approves it in the review. */
  proposeChange(goal: Goal, proposed: Goal, reason: string): Promise<void>;
  withdrawChange(goal: Goal): Promise<void>;
  /** A logged note on a goal between check-ins. It doesn't change the status. */
  addNote(goal: Goal, text: string): Promise<void>;
  /** Records a sponsor's decision, applies it, and logs it. */
  decide(goal: Goal, kind: Decision['kind'], note: string, checkIn: CheckIn | null): Promise<void>;
  toasts: Toast[];
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
const realNow = () => new Date();

export function AppProvider({ store, mode = 'demo', today = realNow, empty: renderEmpty, children }: { store: Store; mode?: Mode; today?: () => Date; empty?: () => ReactNode; children: ReactNode }) {
  // The demo and the real app remember their own workspace and person, so one never opens the other's.
  const K = mode === 'demo' ? { ws: 'goals-app-workspace', viewer: 'goals-app-viewer:' } : { ws: 'goals-live-workspace', viewer: 'goals-live-me:' };
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsId, setWsId] = useState<string | null>(() => read(K.ws) || (store.hasExample ? EXAMPLE.id : null));
  const [empty, setEmpty] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
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
      if (!id) { setEmpty(true); setSnapshot(null); return; }
      setEmpty(false);
      if (id !== wsId) { write(K.ws, id); setWsId(id); return; }
      const snap = await store.load(id);
      if (!live) return;
      setSnapshot(snap);
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
    const actor = (meId && data.people.find((p) => p.id === meId)) || data.people.find((p) => p.profile === 'coach') || data.people[0];
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

  const commit = useCallback(async (c: Commit) => {
    try {
      if (!wsId) throw new Error('no workspace is open');
      await store.commit(wsId, c);
      setSnapshot((s) => (s ? applyCommit(s, c) : s));
    } catch (e) {
      toast('Couldn’t save: ' + (e instanceof Error ? e.message : String(e)) + '. Your changes are still here; try again.', 'error');
      throw e;
    }
  }, [store, wsId, toast]);

  const value = useMemo<AppState | null>(() => {
    if (!snapshot) return null;
    const cycle = snapshot.cycles[0];
    if (!cycle) return null;
    const now = today();
    const week = currentWeek(cycle, now);
    const people = new Map(snapshot.people.map((p) => [p.id, p]));
    const ws = workspaces.find((w) => w.id === wsId) ?? (store.hasExample ? EXAMPLE : { id: wsId ?? '', name: 'Workspace', kind: 'own' as const, createdAt: '' });
    const fallback = snapshot.people.find((p) => p.id === 'maya') ?? snapshot.people.find((p) => p.profile === 'lead') ?? snapshot.people[0]!;
    const chosen = !!viewerId && people.has(viewerId);
    const viewer = (chosen && people.get(viewerId!)) || fallback;
    const statuses = new Map<string, GoalStatus>();
    const attention = new Map<string, GoalAttention>();
    const lookup: Lookup = {
      person: (id) => people.get(id),
      goal: (id) => snapshot.goals.find((g) => g.id === id),
      teamName: (id) => snapshot.teams.find((t) => t.id === id)?.name ?? id,
    };
    const stamp = () => new Date().toISOString();

    return {
      mode, viewerChosen: mode === 'demo' || chosen,
      ws, workspaces, snapshot, cycle, week, today: now, viewer, lookup, toasts, toast, storeKind: store.kind,
      switchWorkspace: (id) => { write(K.ws, id); setWsId(id); },
      createWorkspace,
      resetExample: async () => {
        const s = await store.resetExample();
        if (wsId === EXAMPLE.id) setSnapshot(s);
        toast('The example is back to its starting point');
      },
      setViewer: (id) => { write(K.viewer + wsId, id); setViewerId(id); },
      person: (id) => people.get(id),
      team: (id) => snapshot.teams.find((t) => t.id === id),
      goal: (id) => snapshot.goals.find((g) => g.id === id),
      statusOf: (g) => {
        let st = statuses.get(g.id);
        if (!st) statuses.set(g.id, (st = goalStatus(g, cycle, snapshot.checkIns, now)));
        return st;
      },
      attentionOf: (g) => {
        let a = attention.get(g.id);
        if (!a) attention.set(g.id, (a = attentionFor(g, snapshot, cycle, now)));
        return a;
      },
      checkInsOf: (g) => checkInsFor(g, snapshot.checkIns),
      postCheckIn: async (goal, draft, existing) => {
        const c = toCheckIn(goal, cycle, week, draft, snapshot.checkIns, viewer.id, new Date(), existing?.id ?? newId('ci'));
        const change = checkInChange(existing, c, goal, viewer.id, newId('chg'));
        await commit({ checkIns: [c], changes: change ? [change] : [] });
        return c;
      },
      saveGoal: async (after, before) => {
        const change = goalChange(before, after, lookup, viewer.id, stamp(), newId('chg'));
        await commit({ goals: [after], changes: change ? [change] : [] });
      },
      proposeChange: async (goal, proposed, reason) => {
        const at = stamp();
        const diffs = goalChange(goal, proposed, lookup, viewer.id, at, 'x')?.diffs ?? [];
        const pending = { proposed: { ...proposed, pending: null }, byId: viewer.id, at, week, reason: reason.trim() };
        await commit({
          goals: [{ ...goal, pending }],
          changes: [{ id: newId('chg'), at, actorId: viewer.id, goalId: goal.id, entity: 'goal', entityId: goal.id, action: 'proposed', summary: `Proposed a plan change: ${pendingSummary({ ...goal, pending }).toLowerCase()}`, diffs: [...diffs, { field: 'Why', from: '—', to: reason.trim() }] }],
        });
      },
      withdrawChange: async (goal) => {
        if (!goal.pending) return;
        await commit({
          goals: [{ ...goal, pending: null }],
          changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: goal.id, entity: 'goal', entityId: goal.id, action: 'withdrawn', summary: `Withdrew the proposed change: ${pendingSummary(goal).toLowerCase()}`, diffs: [] }],
        });
      },
      addNote: async (goal, text) => {
        const t = text.trim();
        await commit({ changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: goal.id, entity: 'note', entityId: newId('note'), action: 'noted', summary: 'Added a note', diffs: [{ field: 'Note', from: '—', to: t }] }] });
      },
      decide: async (goal, kind, note, checkIn) => {
        const d: Decision = { id: newId('dec'), goalId: goal.id, checkInId: checkIn?.id ?? null, week, kind, byId: viewer.id, at: stamp(), note: note.trim() };
        const changes: Change[] = [];
        const goals: Goal[] = [];
        let summary: string = DECISION_LOG[kind];
        const diffs = note.trim() ? [{ field: 'Note', from: '—', to: note.trim() }] : [];
        if (kind === 'approve-target' && checkIn?.proposeTarget != null && goal.kind === 'metric') {
          goals.push(withApprovedTarget(goal, checkIn.proposeTarget, week));
          summary = `Approved the target change: ${fmt(goal.plan.target, goal)} → ${fmt(checkIn.proposeTarget, goal)}`;
          diffs.unshift({ field: 'Target', from: fmt(goal.plan.target, goal), to: fmt(checkIn.proposeTarget, goal) });
        }
        if ((kind === 'approve-change' || kind === 'decline-change') && goal.pending) {
          const proposedDiffs = goalChange(goal, goal.pending.proposed, lookup, viewer.id, d.at, 'x')?.diffs ?? [];
          const approved = withApprovedChange(goal, week);
          goals.push(kind === 'approve-change' ? approved : { ...goal, pending: null });
          summary = (kind === 'approve-change' ? 'Approved the plan change: ' : 'Kept the current plan, not: ') + pendingSummary(goal).toLowerCase();
          diffs.unshift(...proposedDiffs);
        }
        const action = ({ 'approve-target': 'approved', 'decline-target': 'declined', 'approve-change': 'approved', 'decline-change': 'declined', acknowledge: 'acknowledged', ask: 'asked' } as const)[kind];
        changes.push({ id: newId('chg'), at: d.at, actorId: viewer.id, goalId: goal.id, entity: 'decision', entityId: d.id, action, summary, diffs });
        await commit({ goals, decisions: [d], changes });
      },
    };
  }, [snapshot, viewerId, store, today, workspaces, wsId, commit, toasts, toast, createWorkspace, mode]);

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
  return <SetupCtx.Provider value={setup}>{body}</SetupCtx.Provider>;
}
