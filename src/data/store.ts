import { asksOf, upgradeAsks } from '../domain/asks';
import { settleKeys, withKeys } from '../domain/goalKey';
import type { ApiToken, Ask, SavedView, Change, CheckIn, Cycle, Decision, Feedback, Goal, Person, Retro, Review, Snapshot, Team, Watch, Workspace } from '../domain/types';
import { buildExample, EXAMPLE, isExample } from './examples';

export { EXAMPLE };

/** The demo remembers the workspace it last opened under this key (app/state.tsx reads it). */
const DEMO_WORKSPACE = 'goals-app-workspace';
/** `/demo?example=platform-org` opens the example, even when this browser last had a workspace of its own open. */
export function pickExampleFromUrl(search: string) {
  const id = new URLSearchParams(search).get('example');
  if (!id || !isExample(id)) return;
  try { localStorage.setItem(DEMO_WORKSPACE, id); } catch { /* storage blocked */ }
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
  requests?: Ask[];
  /** Teams added or changed. */
  teams?: Team[];
  /** Ids of teams to remove: emptied first, by the same save (domain/actions removeTeam). */
  removeTeams?: string[];
  /** The workspace's new name. */
  workspace?: { name: string };
  /** The workspace's recording switch (domain/actions setRecording): whether the app records how it is used there. */
  recording?: boolean;
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
  /**
   * Why saves aren't being kept, if they aren't: the browser refused to store them (full, or blocked in a private
   * window). The changes still apply for this visit; the app says so instead of letting them vanish on reload.
   */
  saveProblem?(): string | null;
  /** Called whenever saveProblem changes. Returns a function that stops listening. */
  onSaveProblem?(listener: () => void): () => void;
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
    requests: c.requests?.length || s.requests ? upsert(s.requests ?? asksOf(s), c.requests) : s.requests,
  };
}

/** Browser storage for the demo; the real app uses its own key when it runs without Supabase (local development, the evals). */
export const DEMO_KEY = 'goals-app-v2';
export const LIVE_KEY = 'goals-live-v1';

/**
 * What the demo keeps of the example: only the person's own saves, on top of the example as it was built. The example is
 * rebuilt from its description (the same every time for the same moment), so a whole copy of it (millions of
 * characters, more than a browser lets a page store) never has to be written.
 */
interface Saved { v: 1; builtAt: string; commits: Commit[] }

export const SAVE_PROBLEM = {
  full: 'This browser has no room left to keep your changes to the demo, so they last only until you reload. Start over (in the Demo panel) to free the space.',
  blocked: 'This browser isn’t letting the demo keep anything (a private window, or site data turned off), so your changes last only until you reload.',
} as const;

/** The browser refused to store something: out of room, or storage turned off. */
const isFull = (e: unknown) => e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);

export class BrowserStore implements Store {
  readonly kind = 'browser' as const;
  readonly hasExample: boolean;
  /** Each workspace as it is now, for this visit (and the only copy when the browser won't store it). */
  private memory = new Map<string, Snapshot>();
  /** The example's saves, for this visit: what's stored, or what couldn't be. */
  private saved = new Map<string, Saved>();
  /** The example as built, by the moment it was built for, so applying saves doesn't rebuild it. */
  private built = new Map<string, Snapshot>();
  private readonly key: string;
  private problem: keyof typeof SAVE_PROBLEM | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly today: () => Date = () => new Date(), opts: { key?: string; example?: boolean; storage?: Storage | null } = {}) {
    this.key = opts.key ?? DEMO_KEY;
    this.hasExample = opts.example ?? true;
    this.storage = opts.storage === undefined ? (() => { try { return localStorage; } catch { return null; } })() : opts.storage;
    // A browser that won't store anything at all says so from the start.
    // Whole copies of examples kept by earlier versions of the demo (the old examples, and a 4.8-million-character
    // Platform Engineering) are dropped first: they fill the browser's room, and the saves are what's kept now.
    if (this.hasExample) for (const old of ['example', 'example-support', 'example-sales', 'example-growth', EXAMPLE.id, 'opened-examples']) this.remove(`${this.key}:${old}`);
    try { if (!this.storage) throw new Error('none'); this.storage.setItem(this.key + ':probe', '1'); this.storage.removeItem(this.key + ':probe'); } catch (e) { this.setProblem(isFull(e) ? 'full' : 'blocked'); }
  }
  private readonly storage: Storage | null;

  saveProblem() { return this.problem ? SAVE_PROBLEM[this.problem] : null; }
  onSaveProblem(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private setProblem(p: keyof typeof SAVE_PROBLEM | null) {
    if (p === this.problem) return;
    this.problem = p;
    this.listeners.forEach((l) => l());
  }

  private get<T>(key: string): T | null {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /** Stores a value; false (and the reason, for the app to show) when the browser refuses. */
  private put(key: string, v: unknown): boolean {
    try {
      if (!this.storage) throw new Error('none');
      this.storage.setItem(key, JSON.stringify(v));
      return true;
    } catch (e) {
      this.setProblem(isFull(e) ? 'full' : 'blocked');
      return false;
    }
  }

  private remove(key: string) { try { this.storage?.removeItem(key); } catch { /* storage blocked */ } }

  async workspaces(): Promise<Workspace[]> {
    const own = this.get<Workspace[]>(this.key + ':workspaces') ?? [];
    // The example keeps its new name (if an admin renamed it here) until it's reset.
    const names = this.get<Record<string, string>>(this.key + ':names') ?? {};
    // …and its recording switch, the same way.
    const off = this.notRecording();
    const withSwitch = (w: Workspace): Workspace => (off.includes(w.id) ? { ...w, recording: false } : w);
    return (this.hasExample ? [names[EXAMPLE.id] ? { ...EXAMPLE, name: names[EXAMPLE.id]! } : EXAMPLE, ...own] : own).map(withSwitch);
  }

  /** Workspaces that have turned recording off: kept in this browser, and in memory when storage is blocked. */
  private offMemory: string[] = [];
  private notRecording(): string[] { return this.get<string[]>(this.key + ':not-recording') ?? this.offMemory; }
  private setRecording(id: string, on: boolean) {
    const off = this.notRecording().filter((x) => x !== id);
    this.offMemory = on ? off : [...off, id];
    this.put(this.key + ':not-recording', this.offMemory);
  }

  private rename(id: string, name: string) {
    const own = this.get<Workspace[]>(this.key + ':workspaces') ?? [];
    if (own.some((w) => w.id === id)) this.put(this.key + ':workspaces', own.map((w) => (w.id === id ? { ...w, name } : w)));
    else this.put(this.key + ':names', { ...(this.get<Record<string, string>>(this.key + ':names') ?? {}), [id]: name });
  }

  /* ---------- the example: rebuilt, with this browser's saves on top ---------- */

  private savedKey = (id: string) => `${this.key}:${id}:saved`;

  /** The example's saves: what's stored now (another tab may have saved since), or this visit's when the browser won't keep them. */
  private savedOf(id: string): Saved | null {
    const stored = this.get<Saved>(this.savedKey(id));
    const mine = this.saved.get(id);
    // While storage is refusing, this visit's saves are ahead of what's stored.
    if (mine && (!stored || mine.commits.length > stored.commits.length)) return mine;
    return stored && stored.v === 1 ? stored : null;
  }

  private async example(id: string): Promise<Snapshot> {
    const saved = this.savedOf(id);
    const cached = this.memory.get(id);
    // Nothing new since this tab last looked: the same snapshot.
    if (cached && this.saved.get(id) === saved && saved) return cached;
    // With no saves of its own, the example is today's; with saves, it's the example they were made on.
    const builtAt = saved?.builtAt ?? this.today().toISOString();
    let base = this.built.get(builtAt);
    if (!base) { base = await buildExample(new Date(builtAt)); this.built.set(builtAt, base); }
    const s = (saved?.commits ?? []).reduce((acc, c) => applyCommit(acc, c), base);
    this.memory.set(id, s);
    this.saved.set(id, saved ?? { v: 1, builtAt, commits: [] });
    return s;
  }

  /* ---------- workspaces of the visitor's own: kept whole (they're small) ---------- */

  private own(id: string): Snapshot {
    // What's stored first: another tab may have saved since this one last looked.
    const s = this.get<Snapshot>(`${this.key}:${id}`) ?? this.memory.get(id);
    if (!s) throw new Error('This workspace no longer exists in this browser.');
    // Data saved before goals had keys gets them once, oldest first, and keeps them; asks from before one ask model are converted.
    const keyed = s.goals.every((g) => g.key) ? s : { ...s, goals: withKeys(s.goals) };
    const upgraded = upgradeAsks(keyed);
    if (upgraded !== s) this.writeOwn(id, upgraded);
    else this.memory.set(id, s);
    return upgraded;
  }

  private writeOwn(id: string, s: Snapshot) {
    this.memory.set(id, s);
    this.put(`${this.key}:${id}`, s);
  }

  private current(id: string): Promise<Snapshot> | Snapshot {
    if (this.hasExample && isExample(id)) return this.example(id);
    return this.own(id);
  }

  async load(id: string) {
    return structuredClone(await this.current(id));
  }

  async commit(id: string, c: Commit) {
    // Read what's stored now, not this tab's copy: another tab may have saved since.
    const stored = await this.current(id);
    checkExpectations(stored, c.expect);
    const { expect: _e, recording: _r, ...rest } = c;
    const next = applyCommit(stored, rest);
    if (this.hasExample && isExample(id)) {
      const saved = this.saved.get(id)!;
      const after: Saved = { ...saved, commits: [...saved.commits, rest] };
      this.saved.set(id, after);
      this.memory.set(id, next);
      // Kept for this visit whatever happens; stored when the browser lets it, and said plainly when it doesn't.
      if (this.put(this.savedKey(id), after) && this.problem === 'full') this.setProblem(null);
    } else {
      this.writeOwn(id, next);
    }
    if (c.workspace) this.rename(id, c.workspace.name);
    if (c.recording !== undefined) this.setRecording(id, c.recording);
  }

  async createWorkspace(ws: Workspace, data: Snapshot) {
    const own = (this.get<Workspace[]>(this.key + ':workspaces') ?? []).filter((w) => w.id !== ws.id);
    this.put(this.key + ':workspaces', [...own, ws]);
    this.writeOwn(ws.id, data);
  }

  async resetExample(id: string = EXAMPLE.id) {
    if (!this.hasExample || !isExample(id)) throw new Error('Only the demo has an example to reset.');
    const names = this.get<Record<string, string>>(this.key + ':names');
    if (names?.[id]) { delete names[id]; this.put(this.key + ':names', names); }
    this.remove(this.savedKey(id));
    // A whole copy kept by an earlier version of the demo, freed with the rest.
    this.remove(`${this.key}:${id}`);
    this.saved.delete(id);
    this.memory.delete(id);
    // Starting over frees the room the saves took; a browser that blocks storage still does.
    if (this.problem === 'full') this.setProblem(null);
    return structuredClone(await this.example(id));
  }

  async deleteWorkspace(id: string) {
    if (isExample(id)) throw new Error('Example workspaces can be reset, not deleted.');
    const own = this.get<Workspace[]>(this.key + ':workspaces') ?? [];
    this.put(this.key + ':workspaces', own.filter((w) => w.id !== id));
    this.memory.delete(id);
    this.remove(`${this.key}:${id}`);
  }
}

export const newId = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
