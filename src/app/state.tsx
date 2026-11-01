import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { attentionFor, type GoalAttention } from '../domain/attention';
import { checkInChange, goalChange, type Lookup } from '../domain/changes';
import { toCheckIn, type Draft } from '../domain/checkin';
import { currentWeek } from '../domain/plan';
import { checkInsFor, goalStatus, type GoalStatus } from '../domain/status';
import type { CheckIn, Cycle, Decision, Goal, Person, Retro, Review, Snapshot, Team, Watch, Workspace } from '../domain/types';
import { currentCycle, nextCycle, RESULT_LABEL, scopeToCycle } from '../domain/cycle';
import { applyCommit, EXAMPLE, newId, type Commit, type Mode, type Store } from '../data/store';

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
  /** Saves a goal and logs what changed, with the owner's reason when the plan or target moved. */
  saveGoal(after: Goal, before: Goal | null, why?: string): Promise<void>;
  /** A logged comment on a goal. Anyone can comment; it doesn't change the status. */
  addNote(goal: Goal, text: string): Promise<void>;
  /** What someone says about a goal in a review: seen, a note, a question for the owner, or an action. */
  reviewCall(goal: Goal, review: Review, week: number, kind: 'acknowledge' | 'note' | 'ask' | 'action', note: string): Promise<void>;
  /** Watch a goal, a goal and everything feeding it, or a whole level. */
  watch(kind: Watch['kind'], ref: string): Promise<void>;
  unwatch(watchId: string): Promise<void>;
  /** Creates or changes a review. */
  saveReview(review: Review, before: Review | null): Promise<void>;
  /** Admins: add someone, or change their name, team or admin rights. */
  savePerson(person: Person, before: Person | null): Promise<void>;
  /** An owner's retro on one of their goals at the end of the cycle. */
  saveRetro(goal: Goal, retro: Retro, before: Retro | null): Promise<void>;
  /** Admins: start the next cycle with the goals that carry on. Returns the new cycle's name. */
  startNextCycle(): Promise<string>;
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
    const stamp = () => new Date().toISOString();

    return {
      mode, viewerChosen: mode === 'demo' || chosen,
      ws, workspaces, snapshot: sc, cycle, week, today: now, viewer, lookup, toasts, toast, storeKind: store.kind,
      switchWorkspace: (id) => { write(K.ws, id); setWsId(id); },
      createWorkspace,
      resetExample: async () => {
        const s = await store.resetExample();
        if (wsId === EXAMPLE.id) setSnapshot(s);
        toast('The example is back to its starting point');
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
        const c = toCheckIn(goal, cycle, week, draft, sc.checkIns, viewer.id, new Date(), existing?.id ?? newId('ci'));
        const change = checkInChange(existing, c, goal, viewer.id, newId('chg'));
        await commit({ checkIns: [c], changes: change ? [change] : [] });
        return c;
      },
      saveGoal: async (after, before, why) => {
        const change = goalChange(before, after, lookup, viewer.id, stamp(), newId('chg'));
        if (change && why?.trim()) change.diffs.push({ field: 'Why', from: '—', to: why.trim() });
        await commit({ goals: [after], changes: change ? [change] : [] });
      },
      addNote: async (goal, text) => {
        const t = text.trim();
        await commit({ changes: [{ id: newId('chg'), at: stamp(), actorId: viewer.id, goalId: goal.id, entity: 'note', entityId: newId('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: t }] }] });
      },
      reviewCall: async (goal, review, sessionWeek, kind, note) => {
        const d: Decision = { id: newId('dec'), goalId: goal.id, checkInId: null, reviewId: review.id, week: sessionWeek, kind, byId: viewer.id, at: stamp(), note: note.trim() };
        const action = ({ acknowledge: 'acknowledged', note: 'noted', ask: 'asked', action: 'actioned' } as const)[kind];
        const what = ({ acknowledge: 'Looked at it', note: 'Added a note', ask: 'Asked the owner a question', action: 'Agreed an action' } as const)[kind];
        await commit({
          decisions: [d],
          changes: [{ id: newId('chg'), at: d.at, actorId: viewer.id, goalId: goal.id, entity: 'decision', entityId: d.id, action, summary: `${what} in ${review.name}`, diffs: note.trim() ? [{ field: kind === 'ask' ? 'Question' : kind === 'action' ? 'Action' : 'Note', from: '—', to: note.trim() }] : [] }],
        });
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
