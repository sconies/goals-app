/* What in a save is Watching's own (build review of #444, medium 1): judged by what the save writes, not by which action
   or tool made it, as Reviews' is (reviewWrites.ts), so Undo, Recently removed and the AI tools' restore_removed are
   covered by the same rule as Watch and Stop watching. While Watching is switched off a save that writes any of it is
   refused, once in the app's dispatcher (app/actions.ts performAny) and once in the AI tools' save (mcp/tools.ts). */
import type { Commit } from './commit';

/**
 * Rule (SW1). A save writes Watching's records when it logs a change to a watch, stops a watch by its id, or writes
 * watches and nothing else (starting one, or bringing a stopped one back by Undo or from Recently removed). What a save
 * only carries along is not: the watches that follow goals into the next cycle, or go and come back with a cycle's start
 * and its undoing, ride with the goals or the cycle the save is about.
 */
export function writesWatches(c: Commit): boolean {
  if ((c.changes ?? []).some((x) => x.entity === 'watch')) return true;
  if (c.unwatch?.length) return true;
  if (!c.watches?.length) return false;
  const carries = Object.entries(c).some(([k, v]) => k !== 'changes' && k !== 'watches' && (Array.isArray(v) ? v.length > 0 : v != null && typeof v === 'object' ? Object.keys(v).length > 0 : false));
  return !carries;
}
