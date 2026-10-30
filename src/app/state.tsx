import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentWeek } from '../domain/plan';
import { checkInsFor, goalStatus, type GoalStatus } from '../domain/status';
import type { CheckIn, Cycle, Goal, Person, Snapshot, Team } from '../domain/types';
import type { Store } from '../data/store';

const VIEWER_KEY = 'goals-app-viewer';

export interface AppState {
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
  checkInsOf(goal: Goal): CheckIn[];
  saveGoal(goal: Goal): Promise<void>;
  saveCheckIn(c: CheckIn): Promise<void>;
  reset(): Promise<void>;
  storeKind: Store['kind'];
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

function readViewer(): string {
  try {
    return localStorage.getItem(VIEWER_KEY) || 'maya';
  } catch {
    return 'maya';
  }
}

const realNow = () => new Date();

export function AppProvider({ store, today = realNow, children }: { store: Store; today?: () => Date; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState(readViewer);

  useEffect(() => {
    store.load().then(setSnapshot, (e: unknown) => setError(String(e)));
  }, [store]);

  const refresh = useCallback(async () => setSnapshot(await store.load()), [store]);

  const value = useMemo<AppState | null>(() => {
    if (!snapshot) return null;
    const cycle = snapshot.cycles[0];
    if (!cycle) return null;
    const now = today();
    const people = new Map(snapshot.people.map((p) => [p.id, p]));
    const viewer = people.get(viewerId) ?? snapshot.people[0]!;
    const statuses = new Map(snapshot.goals.map((g) => [g.id, goalStatus(g, cycle, snapshot.checkIns, now)]));
    return {
      snapshot, cycle, today: now, week: currentWeek(cycle, now), viewer,
      setViewer: (id) => {
        setViewerId(id);
        try { localStorage.setItem(VIEWER_KEY, id); } catch { /* storage blocked */ }
      },
      person: (id) => people.get(id),
      team: (id) => snapshot.teams.find((t) => t.id === id),
      goal: (id) => snapshot.goals.find((g) => g.id === id),
      statusOf: (g) => statuses.get(g.id) ?? goalStatus(g, cycle, snapshot.checkIns, now),
      checkInsOf: (g) => checkInsFor(g, snapshot.checkIns),
      saveGoal: async (g) => { await store.saveGoal(g); await refresh(); },
      saveCheckIn: async (c) => { await store.saveCheckIn(c); await refresh(); },
      reset: async () => { setSnapshot(await store.reset()); },
      storeKind: store.kind,
    };
  }, [snapshot, viewerId, store, refresh, today]);

  if (error) return <p className="boot">Couldn’t load the goals: {error}</p>;
  if (!value) return <p className="boot">Loading goals…</p>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
