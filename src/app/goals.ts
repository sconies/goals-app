/* Where the app picks its query port adapter (AX5; src/ports/goals.ts): over the workspace loaded in this browser
   today. The internal app swaps useGoals() for its server's and changes no screen. Home and Goals read goal lists and
   counts through useGoalList() and useGoalCounts(), never applyQuery or summariseAll. */
import { useEffect, useMemo, useState } from 'react';
import { localGoals } from '../adapters/localGoals';
import { allGoals, allGoalsNow, type GoalAsk, type GoalCounts, type GoalPage, type Goals } from '../ports/goals';
import { useGoalColumns } from '../core/app';
import { goalRows, scopeFacts } from './reads';
import type { ScopeFacts } from '../domain/goalsPage';
import { useApp } from './state';

/* One port per workspace as loaded (#193's review): Home's list and its counts, and the Goals screen's three reads,
   share one set of summaries instead of working them out once per hook. The port is remade only when what it reads
   changes: the workspace, the cycle, the day and week, the module columns, or who is asking. */
let last: { deps: readonly unknown[]; port: Goals } | null = null;
function portFor(deps: readonly unknown[], make: () => Goals): Goals {
  if (last && last.deps.length === deps.length && last.deps.every((d, i) => Object.is(d, deps[i]))) return last.port;
  const port = make();
  last = { deps, port };
  return port;
}

export function useGoals(): Goals {
  const app = useApp();
  // A module's filters (Measured by) narrow through the same port; with the module off, its filter narrows nothing.
  const { columns } = useGoalColumns();
  const { snapshot, cycle, today, week } = app;
  const viewerId = app.viewer.id, teamId = app.viewer.teamId;
  return useMemo(() => portFor([snapshot, cycle, today, week, columns, viewerId, teamId], () => {
    let rows: ReturnType<typeof goalRows> | undefined;
    let facts: ScopeFacts | undefined;
    return localGoals(
      () => (rows ??= goalRows(snapshot, cycle, today, week, columns)),
      () => (facts ??= scopeFacts(snapshot, { id: viewerId, teamId })),
    );
  }), [snapshot, cycle, today, week, columns, viewerId, teamId]);
}

/**
 * Asks the port and keeps the last answer. An adapter that answers at once (Faro's) is read during the render, so the
 * screen never draws empty first; a server's answers later, and the screen shows its wait until then (null).
 */
function useAnswer<T>(port: Goals, key: string, now: ((n: NonNullable<Goals['now']>) => T) | null, later: () => Promise<T>): T | null {
  const sync = useMemo(() => (now && port.now ? now(port.now) : undefined), [port, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [answer, setAnswer] = useState<{ port: Goals; key: string; v: T } | null>(null);
  useEffect(() => {
    if (sync !== undefined || !now) return;
    let live = true;
    later().then((v) => { if (live) setAnswer({ port, key, v }); }).catch(() => {});
    return () => { live = false; };
  }, [port, key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!now) return null;
  if (sync !== undefined) return sync;
  return answer && answer.port === port && answer.key === key ? answer.v : null;
}

/** Every goal a query matches, in its order (all pages): null while a server is answering, or when `ask` is null. */
export function useGoalList(ask: Omit<GoalAsk, 'after'> | null): GoalPage | null {
  const port = useGoals();
  return useAnswer(port, JSON.stringify(ask), ask && ((n) => allGoalsNow(n, ask)), () => allGoals(port, ask!));
}

/** The counts for the same filter: null while a server is answering, or when `ask` is null. */
export function useGoalCounts(ask: Pick<GoalAsk, 'query' | 'scope'> | null): GoalCounts | null {
  const port = useGoals();
  return useAnswer(port, JSON.stringify(ask), ask && ((n) => n.counts(ask)), () => port.counts(ask!));
}
