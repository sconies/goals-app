/* The goals store port (moved here from src/data/store.ts with AX5): where the app keeps its records, a whole workspace
   at a time. The browser store (src/data/store.ts), the Supabase store and the plain-Postgres store (src/adapters/)
   implement it, and each passes the same contract (src/ports/contracts/store.ts). It is the demo-scale port: what the
   screens read about goals goes through the query port (src/ports/goals.ts), and spec/rebuild/ports-at-scale.md says
   what replaces `load` at company scale. The demo's example plumbing (`ExampleStore`) is the browser store's alone. */
import type { Commit } from '../domain/commit';
import type { Snapshot, Workspace } from '../domain/types';

export type { Commit, Expectations } from '../domain/commit';

/** A save refused because someone else changed the same thing first. */
export class StaleError extends Error {
  constructor(what: string) { super('stale: ' + what); this.name = 'StaleError'; }
}
export const isStale = (e: unknown) => e instanceof StaleError || (e instanceof Error && /\bstale: /.test(e.message));

/** The real app, or the demo: the example data, a role switcher and a reset, kept in each visitor's browser. */
export type Mode = 'live' | 'demo';

/** Where the app keeps its records. The browser, Supabase and plain-Postgres stores implement it, and each passes the same contract test (src/ports/contracts/store.ts). */
export interface Store {
  readonly kind: 'browser' | 'supabase' | 'postgres';
  workspaces(): Promise<Workspace[]>;
  load(workspaceId: string): Promise<Snapshot>;
  /** Saves records and their change-log entries together. A check-in with a new id is added; one with an existing id is corrected. */
  commit(workspaceId: string, c: Commit): Promise<void>;
  createWorkspace(ws: Workspace, data: Snapshot): Promise<void>;
  /** Deletes a workspace someone set up, and everything in it. Examples can only be reset. */
  deleteWorkspace(id: string): Promise<void>;
  /**
   * Saves a new AI assistant token (domain/actions createToken: the token without its secret, and its change-log
   * entry) and returns the secret, this once. The shared database makes the secret itself and keeps only its hash.
   */
  issueToken(workspaceId: string, c: Commit): Promise<string>;
  /**
   * Why saves aren't being kept, if they aren't: the browser refused to store them (full, or blocked in a private
   * window). The changes still apply for this visit; the app says so instead of letting them vanish on reload.
   */
  saveProblem?(): string | null;
  /** Called whenever saveProblem changes. Returns a function that stops listening. */
  onSaveProblem?(listener: () => void): () => void;
}

