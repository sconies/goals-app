/* What a goal's tree says about the goals under it: the List's and Home's rows use it, and so does the map. Apart from
   map.ts so a first visit's Home rows don't download the map's layout (backlog FD). */
import { worst } from './status';
import type { DisplayStatus, Goal } from './types';

/** Everything under a goal, at any depth. */
export function under(goal: Goal, goals: Goal[]): Goal[] {
  const out: Goal[] = [];
  const walk = (id: string) => { for (const c of goals) if (c.parentId === id && c.id !== goal.id && !out.includes(c)) { out.push(c); walk(c.id); } };
  walk(goal.id);
  return out;
}

/** The statuses the roll-up counts, worst first. A goal with no check-in yet isn't counted: its status is unknown. */
export const ROLLUP_ORDER = ['off', 'risk', 'stale', 'on', 'done', 'planned'] as const satisfies readonly DisplayStatus[];

/**
 * What a goal's tree says about the goals under it, by the one rule for a group's status (`worst` in status.ts): the
 * worst status among everything under it, and how many are in each status, worst first. The List's tree cards use it
 * too ("Everything under it"). Null for a goal nothing feeds.
 */
export function rollup(goal: Goal, goals: Goal[], statusOf: (g: Goal) => DisplayStatus): { worst: DisplayStatus; total: number; counts: [DisplayStatus, number][] } | null {
  const all = under(goal, goals);
  if (!all.length) return null;
  const st = all.map(statusOf);
  const counts = ROLLUP_ORDER.map((k) => [k, st.filter((s) => s === k).length] as [DisplayStatus, number]).filter(([, n]) => n > 0);
  return { worst: worst(st), total: all.length, counts };
}
