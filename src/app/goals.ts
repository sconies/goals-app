/* Where the app picks its query port adapter (AX5; src/ports/goals.ts): over the workspace loaded in this browser
   today. The internal app swaps useGoals() for its server's and changes no screen. Home and Goals read goal lists and
   counts through useGoalList() and useGoalCounts(), never applyQuery or summariseAll. */
import { useEffect, useMemo, useState } from 'react';
import { localGoals } from '../adapters/localGoals';
import { allGoals, allGoalsNow, type GoalAsk, type GoalCounts, type GoalPage, type Goals } from '../ports/goals';
import { useGoalColumns } from '../core/app';
import { goalRows } from './reads';
import { useApp } from './state';

export function useGoals(): Goals {
  const app = useApp();
  // A module's filters (Measured by) narrow through the same port; with the module off, its filter narrows nothing.
  const { columns } = useGoalColumns();
  return useMemo(() => {
    let rows: ReturnType<typeof goalRows> | undefined;
    return localGoals(() => (rows ??= goalRows(app.snapshot, app.cycle, app.today, app.week, columns)));
  }, [app.snapshot, app.cycle, app.today, app.week, columns]);
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
export function useGoalCounts(ask: Pick<GoalAsk, 'query' | 'among'> | null): GoalCounts | null {
  const port = useGoals();
  return useAnswer(port, JSON.stringify(ask), ask && ((n) => n.counts(ask)), () => port.counts(ask!));
}
