/* Home rule 5 at the app layer (round 3, HM4): what each goal did since a day, by the status rule asked on that day.
   Importing this registers it for the Goals filter `moved=` (reads.ts registerMovedRule): Goals, Home's later parts and
   the MCP server import it, so its code is not in Home's first download. */
import { mondayOf, movedPasses, movement, sinceDay, type Move, type StatusNow } from '../domain/changed';
import { goalStatus } from '../domain/status';
import type { CheckIn, Cycle, DisplayStatus, Goal, Snapshot } from '../domain/types';
import { registerMovedRule } from './reads';

/**
 * Rule 5's two statuses for a goal (the Home spec): on `since`, the status rule (goalStatus) with today = since
 * and only the check-ins posted before that day, or null when the goal was created on it or after; and now. `move` is
 * `movement` between them; `since` null counts from this week's Monday. Weekly: every cycle has a set rhythm today (FT1
 * adds the others; then `weekly` is false for them and nothing "went quiet").
 */
export function movesSince(s: Pick<Snapshot, 'checkIns'>, cycle: Cycle, today: Date, weekly = true) {
  const day = today.toISOString().slice(0, 10);
  const before = new Map<string, CheckIn[]>();
  const upTo = (since: string) => { let l = before.get(since); if (!l) { l = s.checkIns.filter((c) => c.postedAt < since); before.set(since, l); } return l; };
  const nowOf = new Map<string, StatusNow>();
  const now = (g: Goal): StatusNow => {
    let n = nowOf.get(g.id);
    if (!n) { const st = goalStatus(g, cycle, s.checkIns, today); n = { status: st.status, call: st.latest?.status ?? null, calculated: st.latest?.calculated ?? null }; nowOf.set(g.id, n); }
    return n;
  };
  const was = (g: Goal, since: string | null): DisplayStatus | null => {
    const from = since ?? mondayOf(day);
    if (g.createdAt && g.createdAt.slice(0, 10) >= from) return null;
    return goalStatus(g, cycle, upTo(from), new Date(from + 'T00:00:00Z')).status;
  };
  return { was, now, move: (g: Goal, since: string | null): Move | null => movement(was(g, since), now(g), weekly) };
}

registerMovedRule((s, cycle, today) => { const m = movesSince(s, cycle, today).move; return (g, kind, since) => movedPasses(kind, m(g, sinceDay(since))); });
