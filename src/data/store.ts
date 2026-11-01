import type { Change, CheckIn, Cycle, Decision, Goal, Person, Retro, Review, Snapshot, Watch, Workspace } from '../domain/types';
import { seed } from './seed';

export const EXAMPLE: Workspace = { id: 'example', name: 'Example: Developer Platform', kind: 'example', createdAt: '2026-01-01T00:00:00.000Z' };

/** One save: the records that leave draft, and the change-log entries that describe them. */
export interface Commit {
  people?: Person[];
  goals?: Goal[];
  checkIns?: CheckIn[];
  decisions?: Decision[];
  reviews?: Review[];
  retros?: Retro[];
  cycles?: Cycle[];
  watches?: Watch[];
  /** Ids of watches to remove. */
  unwatch?: string[];
  changes: Change[];
}

/** The real app, or the demo: the example data, a role switcher and a reset, kept in each visitor's browser. */
export type Mode = 'live' | 'demo';

/** Where the app keeps its records. The browser store and the Supabase store implement the same contract. */
export interface Store {
  readonly kind: 'browser' | 'supabase';
  /** Whether the example workspace is part of this store (the demo) or not (the real app). */
  readonly hasExample: boolean;
  workspaces(): Promise<Workspace[]>;
  load(workspaceId: string): Promise<Snapshot>;
  /** Saves records and their change-log entries together. A check-in replaces any for the same goal and week. */
  commit(workspaceId: string, c: Commit): Promise<void>;
  createWorkspace(ws: Workspace, data: Snapshot): Promise<void>;
  /** Starts the example again from the demo data. Only the demo has one. */
  resetExample(): Promise<Snapshot>;
}

/** Applies a commit to a snapshot. Shared by the browser store and the app's optimistic update. */
export function applyCommit(s: Snapshot, c: Commit): Snapshot {
  const upsert = <T extends { id: string }>(list: T[], items: T[] = []) => {
    const ids = new Set(items.map((x) => x.id));
    return [...list.filter((x) => !ids.has(x.id)), ...items];
  };
  const goals = (c.goals ?? []).reduce((acc, g) => (acc.some((x) => x.id === g.id) ? acc.map((x) => (x.id === g.id ? g : x)) : [...acc, g]), s.goals);
  const replaced = (x: CheckIn) => (c.checkIns ?? []).some((n) => n.id === x.id || (n.goalId === x.goalId && n.week === x.week));
  return {
    ...s,
    people: upsert(s.people, c.people),
    goals,
    checkIns: [...s.checkIns.filter((x) => !replaced(x)), ...(c.checkIns ?? [])],
    decisions: upsert(s.decisions, c.decisions),
    changes: [...s.changes, ...c.changes],
    watches: upsert((s.watches ?? []).filter((w) => !(c.unwatch ?? []).includes(w.id)), c.watches),
    reviews: upsert(s.reviews ?? [], c.reviews),
    retros: upsert(s.retros ?? [], c.retros),
    cycles: upsert(s.cycles, c.cycles),
  };
}

/** Browser storage for the demo; the real app uses its own key when it runs without Supabase (local development, the evals). */
export const DEMO_KEY = 'goals-app-v2';
export const LIVE_KEY = 'goals-live-v1';

export class BrowserStore implements Store {
  readonly kind = 'browser' as const;
  readonly hasExample: boolean;
  private memory = new Map<string, Snapshot>();
  private readonly key: string;

  constructor(private readonly today: () => Date = () => new Date(), opts: { key?: string; example?: boolean } = {}) {
    this.key = opts.key ?? DEMO_KEY;
    this.hasExample = opts.example ?? true;
  }

  private get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private put(key: string, v: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // Storage blocked (private window): the app still works for this visit.
    }
  }

  async workspaces(): Promise<Workspace[]> {
    const own = this.get<Workspace[]>(this.key + ':workspaces') ?? [];
    return this.hasExample ? [EXAMPLE, ...own] : own;
  }

  private current(id: string): Snapshot {
    const s = this.memory.get(id) ?? this.get<Snapshot>(`${this.key}:${id}`);
    if (s) return s;
    if (id !== EXAMPLE.id || !this.hasExample) throw new Error('This workspace no longer exists in this browser.');
    return this.write(id, seed(this.today()));
  }

  private write(id: string, s: Snapshot): Snapshot {
    this.memory.set(id, s);
    this.put(`${this.key}:${id}`, s);
    return s;
  }

  async load(id: string) {
    return structuredClone(this.current(id));
  }

  async commit(id: string, c: Commit) {
    this.write(id, applyCommit(this.current(id), c));
  }

  async createWorkspace(ws: Workspace, data: Snapshot) {
    const own = (this.get<Workspace[]>(this.key + ':workspaces') ?? []).filter((w) => w.id !== ws.id);
    this.put(this.key + ':workspaces', [...own, ws]);
    this.write(ws.id, data);
  }

  async resetExample() {
    if (!this.hasExample) throw new Error('Only the demo has an example to reset.');
    return structuredClone(this.write(EXAMPLE.id, seed(this.today())));
  }
}

export const newId = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
