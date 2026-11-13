/* What Home's proposal rows need to know about one person (goal entry rule 14, `proposalAsks`): the proposed goals
   they have opened, and until when each "has been proposed for n weeks" ask is put off. Kept behind the Prefs port. */
import type { Prefs } from '../ports/prefs';
import { PROPOSED_ASK_WEEKS } from '../domain/proposed';

interface Kept { opened?: string[]; putOff?: Record<string, string> }
const KEY = 'proposals';

/** As `proposalAsks` reads it. */
export function proposalSeen(p: Prefs, ws: string, person: string): { opened: ReadonlySet<string>; putOff: ReadonlyMap<string, string> } {
  const k = p.get<Kept>(ws, person, KEY) ?? {};
  return { opened: new Set(k.opened ?? []), putOff: new Map(Object.entries(k.putOff ?? {})) };
}

/** The owner opened their proposed goal: the "proposed a goal for you" row goes. */
export function markOpened(p: Prefs, ws: string, person: string, goalId: string) {
  const k = p.get<Kept>(ws, person, KEY) ?? {};
  if (k.opened?.includes(goalId)) return;
  p.set(ws, person, KEY, { ...k, opened: [...(k.opened ?? []), goalId] });
}

/** "Not yet": the stale ask comes back PROPOSED_ASK_WEEKS weeks from today (a yyyy-mm-dd day). */
export function putOff(p: Prefs, ws: string, person: string, goalId: string, today: Date) {
  const k = p.get<Kept>(ws, person, KEY) ?? {};
  const until = new Date(today.getTime() + PROPOSED_ASK_WEEKS * 7 * 86_400_000).toISOString().slice(0, 10);
  p.set(ws, person, KEY, { ...k, putOff: { ...(k.putOff ?? {}), [goalId]: until } });
}
