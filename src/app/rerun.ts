/* A stale save runs again (backlog AX6; architecture review finding 5). When a save is refused because someone else
   changed the same goal or review since it was loaded, the dispatcher (app/state.tsx `run`) doesn't throw the person's
   change away: it reloads, runs the same action with the same input on the fresh workspace, and saves that. An action
   is a pure function of what it reads (src/domain), so no merge is needed: the rule decides again on the latest. If the
   rule now says no, its words are what the person sees; nothing is saved. No React, storage or network here: the
   dispatcher hands in how to run, save and reload. */
import { isStale, STALE_RERUNS, type Commit } from '../ports/store';
import type { Snapshot } from '../domain/types';

/** One run of an action on a snapshot: what it gives back, and what it would save (null: nothing to save). */
export interface Attempt<O> { out: O; commit: Commit | null }

/** What was saved: the last run's result, the snapshot it ran on (what Undo puts back), and how many times it re-ran. */
export interface Saved<O> extends Attempt<O> { before: Snapshot; reran: number }

/**
 * Runs `attempt` on `first` and saves what it gives back. On a stale refusal, reloads and runs it again on the fresh
 * snapshot, at most `STALE_RERUNS` times; then the last stale refusal is thrown. A refusal by the rule (it throws) or
 * any other failure to save is thrown at once. A run that has nothing to save saves nothing.
 */
export async function saveRerunning<O>(
  first: Snapshot,
  attempt: (s: Snapshot) => Attempt<O>,
  save: (c: Commit) => Promise<void>,
  reload: () => Promise<Snapshot>,
  reruns = STALE_RERUNS,
): Promise<Saved<O>> {
  let base = first;
  for (let reran = 0; ; reran++) {
    const a = attempt(base);
    if (!a.commit) return { ...a, before: base, reran };
    try {
      await save(a.commit);
      return { ...a, before: base, reran };
    } catch (e) {
      if (!isStale(e) || reran >= reruns) throw e;
    }
    base = await reload();
  }
}
