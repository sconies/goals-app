import { settleKeys, withKeys } from '../domain/goalKey';
import { requestsOf } from '../domain/requests';
import type { ApiToken, HelpRequest, SavedView, Change, CheckIn, Cycle, Decision, Feedback, Goal, Person, Retro, Review, Snapshot, Team, Watch, Workspace } from '../domain/types';
import { EXAMPLE_PLATFORM, EXAMPLES } from './examples';

export const EXAMPLE: Workspace = EXAMPLE_PLATFORM;
const exampleBuild = (id: string) => EXAMPLES.find((e) => e.workspace.id === id)?.build;

/** The demo remembers the example it last opened under this key (app/state.tsx reads it). */
const DEMO_WORKSPACE = 'goals-app-workspace';
/** The hidden examples this browser has opened by their link: from then on they're offered like the others. */
const OPENED = 'goals-app-v2:opened-examples';
const opened = (): string[] => { try { return JSON.parse(localStorage.getItem(OPENED) ?? '[]') as string[]; } catch { return []; } };
/** `/demo?example=<id>` opens that example, as if it had been picked in the app (for testing with a larger example). */
export function pickExampleFromUrl(search: string) {
  const id = new URLSearchParams(search).get('example');
  if (!id || !exampleBuild(id)) return;
  try {
    if (!opened().includes(id)) localStorage.setItem(OPENED, JSON.stringify([...opened(), id]));
    localStorage.setItem(DEMO_WORKSPACE, id);
  } catch { /* storage blocked */ }
}

/** One save: the records that leave draft, and the change-log entries that describe them. */
export interface Commit {
  people?: Person[];
  goals?: Goal[];
  checkIns?: CheckIn[];
  decisions?: Decision[];
  reviews?: Review[];
  retros?: Retro[];
  cycles?: Cycle[];
  feedback?: Feedback[];
  watches?: Watch[];
  /** Ids of watches to remove. */
  unwatch?: string[];
  tokens?: ApiToken[];
  views?: SavedView[];
  requests?: HelpRequest[];
  /** Teams added or changed. */
  teams?: Team[];
  /** Ids of teams to remove: emptied first, by the same save (domain/actions removeTeam). */
  removeTeams?: string[];
  /** The workspace's new name. */
  workspace?: { name: string };
  changes: Change[];
  /** What the save was based on; filled in by withExpectations. A save is refused if any of it has changed since. */
  expect?: Expectations;
}

export interface Expectations {
  goals: { id: string; version: number }[];
  reviews: { id: string; version: number }[];
  /** For each check-in written: the check-in that was there for that goal and week (null: none). */
  checkIns: { goalId: string; week: number; id: string | null }[];
}

/** The versions a save is based on, read from the snapshot the person was looking at. */
export function withExpectations(c: Commit, s: Snapshot): Commit {
  return {
    ...c,
    expect: {
      goals: (c.goals ?? []).flatMap((g) => { const old = s.goals.find((x) => x.id === g.id); return old ? [{ id: g.id, version: old.version ?? 0 }] : []; }),
      reviews: (c.reviews ?? []).flatMap((r) => { const old = s.reviews.find((x) => x.id === r.id); return old ? [{ id: r.id, version: old.version ?? 0 }] : []; }),
      // Check-ins are added, not overwritten, so another person's check-in can't be lost to this one.
      checkIns: [],
    },
  };
}

/** A save refused because someone else changed the same thing first. */
export class StaleError extends Error {
  constructor(what: string) { super('stale: ' + what); this.name = 'StaleError'; }
}
export const isStale = (e: unknown) => e instanceof StaleError || (e instanceof Error && /\bstale: /.test(e.message));

/** Throws StaleError if the stored data has moved on from what the save expected. */
export function checkExpectations(s: Snapshot, e: Expectations | undefined) {
  if (!e) return;
  for (const x of e.goals) { const g = s.goals.find((y) => y.id === x.id); if (g && (g.version ?? 0) !== x.version) throw new StaleError('goal ' + x.id); }
  for (const x of e.reviews) { const r = s.reviews.find((y) => y.id === x.id); if (r && (r.version ?? 0) !== x.version) throw new StaleError('review ' + x.id); }
  for (const x of e.checkIns) { const c = s.checkIns.find((y) => y.goalId === x.goalId && y.week === x.week); if ((c?.id ?? null) !== x.id) throw new StaleError(`check-in ${x.goalId} week ${x.week}`); }
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
  /** Saves records and their change-log entries together. A check-in with a new id is added; one with an existing id is corrected. */
  commit(workspaceId: string, c: Commit): Promise<void>;
  createWorkspace(ws: Workspace, data: Snapshot): Promise<void>;
  /** Starts an example workspace again from its demo data. Only the demo has examples. */
  resetExample(id?: string): Promise<Snapshot>;
  /** Deletes a workspace someone set up, and everything in it. Examples can only be reset. */
  deleteWorkspace(id: string): Promise<void>;
}

/** Applies a commit to a snapshot. Shared by the browser store and the app's optimistic update. */
export function applyCommit(s: Snapshot, c: Commit): Snapshot {
  const upsert = <T extends { id: string }>(list: T[], items: T[] = []) => {
    const ids = new Set(items.map((x) => x.id));
    return [...list.filter((x) => !ids.has(x.id)), ...items];
  };
  // A saved goal or review is one version on from the one it replaced.
  const bump = <T extends { id: string; version?: number }>(list: T[], items: T[] = []) => items.map((x) => { const old = list.find((y) => y.id === x.id); return { ...x, version: old ? (old.version ?? 0) + 1 : 0 }; });
  const byId = new Map(s.goals.map((g, i) => [g.id, i]));
  const goals = [...s.goals];
  // Keys never change, and no two goals in a cycle share one (domain/goalKey).
  for (const g of bump(s.goals, c.goals && settleKeys(s.goals, c.goals))) { const i = byId.get(g.id); if (i == null) { byId.set(g.id, goals.length); goals.push(g); } else goals[i] = g; }
  // Check-ins are kept, any number a week; one is replaced only when it is saved again with its own id.
  const newIds = new Set((c.checkIns ?? []).map((n) => n.id));
  const replaced = (x: CheckIn) => newIds.has(x.id);
  return {
    ...s,
    teams: upsert(s.teams, c.teams).filter((t) => !(c.removeTeams ?? []).includes(t.id)),
    people: upsert(s.people, c.people),
    goals,
    checkIns: [...s.checkIns.filter((x) => !replaced(x)), ...(c.checkIns ?? [])],
    decisions: upsert(s.decisions, c.decisions),
    changes: [...s.changes, ...c.changes],
    watches: upsert((s.watches ?? []).filter((w) => !(c.unwatch ?? []).includes(w.id)), c.watches),
    reviews: upsert(s.reviews ?? [], bump(s.reviews ?? [], c.reviews)),
    retros: upsert(s.retros ?? [], c.retros),
    cycles: upsert(s.cycles, c.cycles),
    feedback: upsert(s.feedback ?? [], c.feedback),
    tokens: upsert(s.tokens ?? [], c.tokens),
    views: upsert(s.views ?? [], c.views),
    // Data from before requests were stored: start from the requests read from check-ins, so a first save keeps them.
    requests: c.requests?.length || s.requests ? upsert(s.requests ?? requestsOf(s), c.requests) : s.requests,
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
    // An example keeps its new name (if an admin renamed it here) until it's reset.
    const names = this.get<Record<string, string>>(this.key + ':names') ?? {};
    const shown = EXAMPLES.filter((e) => !e.hidden || opened().includes(e.workspace.id));
    return this.hasExample ? [...shown.map((e) => (names[e.workspace.id] ? { ...e.workspace, name: names[e.workspace.id]! } : e.workspace)), ...own] : own;
  }

  private rename(id: string, name: string) {
    const own = this.get<Workspace[]>(this.key + ':workspaces') ?? [];
    if (own.some((w) => w.id === id)) this.put(this.key + ':workspaces', own.map((w) => (w.id === id ? { ...w, name } : w)));
    else this.put(this.key + ':names', { ...(this.get<Record<string, string>>(this.key + ':names') ?? {}), [id]: name });
  }

  private current(id: string): Snapshot {
    // What's stored first: another tab may have saved since this one last looked.
    const s = this.get<Snapshot>(`${this.key}:${id}`) ?? this.memory.get(id);
    // Data saved before goals had keys gets them once, oldest first, and keeps them.
    if (s) return s.goals.every((g) => g.key) ? s : this.write(id, { ...s, goals: withKeys(s.goals) });
    const build = this.hasExample ? exampleBuild(id) : undefined;
    if (!build) throw new Error('This workspace no longer exists in this browser.');
    return this.write(id, build(this.today()));
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
    // Read what's stored now, not this tab's copy: another tab may have saved since.
    const stored = this.current(id);
    checkExpectations(stored, c.expect);
    const { expect: _e, ...rest } = c;
    this.write(id, applyCommit(stored, rest));
    if (c.workspace) this.rename(id, c.workspace.name);
  }

  async createWorkspace(ws: Workspace, data: Snapshot) {
    const own = (this.get<Workspace[]>(this.key + ':workspaces') ?? []).filter((w) => w.id !== ws.id);
    this.put(this.key + ':workspaces', [...own, ws]);
    this.write(ws.id, data);
  }

  async resetExample(id: string = EXAMPLE.id) {
    const build = this.hasExample ? exampleBuild(id) : undefined;
    if (!build) throw new Error('Only the demo has examples to reset.');
    const names = this.get<Record<string, string>>(this.key + ':names');
    if (names?.[id]) { delete names[id]; this.put(this.key + ':names', names); }
    return structuredClone(this.write(id, build(this.today())));
  }

  async deleteWorkspace(id: string) {
    if (exampleBuild(id)) throw new Error('Example workspaces can be reset, not deleted.');
    const own = this.get<Workspace[]>(this.key + ':workspaces') ?? [];
    this.put(this.key + ':workspaces', own.filter((w) => w.id !== id));
    this.memory.delete(id);
    try { localStorage.removeItem(`${this.key}:${id}`); } catch { /* storage blocked */ }
  }
}

export const newId = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
