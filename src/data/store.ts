import type { Change, CheckIn, Decision, Goal, Snapshot, Workspace } from '../domain/types';
import { seed } from './seed';

export const EXAMPLE: Workspace = { id: 'example', name: 'Example: Developer Platform', kind: 'example', createdAt: '2026-01-01T00:00:00.000Z' };

/** One save: the records that leave draft, and the change-log entries that describe them. */
export interface Commit {
  goals?: Goal[];
  checkIns?: CheckIn[];
  decisions?: Decision[];
  changes: Change[];
}

/** Where the app keeps its records. The browser store and the Supabase store implement the same contract. */
export interface Store {
  readonly kind: 'browser' | 'supabase';
  workspaces(): Promise<Workspace[]>;
  load(workspaceId: string): Promise<Snapshot>;
  /** Saves records and their change-log entries together. A check-in replaces any for the same goal and week. */
  commit(workspaceId: string, c: Commit): Promise<void>;
  createWorkspace(ws: Workspace, data: Snapshot): Promise<void>;
  /** Starts the example again from the demo data. Refused for your own workspaces. */
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
    goals,
    checkIns: [...s.checkIns.filter((x) => !replaced(x)), ...(c.checkIns ?? [])],
    decisions: upsert(s.decisions, c.decisions),
    changes: [...s.changes, ...c.changes],
  };
}

const KEY = 'goals-app-v2';

export class BrowserStore implements Store {
  readonly kind = 'browser' as const;
  private memory = new Map<string, Snapshot>();

  constructor(private readonly today: () => Date = () => new Date()) {}

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
    return [EXAMPLE, ...(this.get<Workspace[]>(KEY + ':workspaces') ?? [])];
  }

  private current(id: string): Snapshot {
    const s = this.memory.get(id) ?? this.get<Snapshot>(`${KEY}:${id}`);
    if (s) return s;
    if (id !== EXAMPLE.id) throw new Error('This workspace no longer exists in this browser.');
    return this.write(id, seed(this.today()));
  }

  private write(id: string, s: Snapshot): Snapshot {
    this.memory.set(id, s);
    this.put(`${KEY}:${id}`, s);
    return s;
  }

  async load(id: string) {
    return structuredClone(this.current(id));
  }

  async commit(id: string, c: Commit) {
    this.write(id, applyCommit(this.current(id), c));
  }

  async createWorkspace(ws: Workspace, data: Snapshot) {
    const own = (this.get<Workspace[]>(KEY + ':workspaces') ?? []).filter((w) => w.id !== ws.id);
    this.put(KEY + ':workspaces', [...own, ws]);
    this.write(ws.id, data);
  }

  async resetExample() {
    return structuredClone(this.write(EXAMPLE.id, seed(this.today())));
  }
}

export const newId = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
