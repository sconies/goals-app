/* When each person last opened Home in a workspace (round 3, HM4: docs/design/home/spec.md rule 5 and section 6): a
   preference per person and workspace behind the Prefs port, key `home-seen`, `{ last, prev }` as yyyy-mm-dd days. Faro
   keeps it in this browser; the internal app keeps it on its server, so "Changed since" follows a person across devices.
   Blocked or cleared storage reads as never opened: Home then says "Changed this week". Its own instance of the port over
   the same keys as app/search's (as goalSeen.ts keeps its own), so Home's later parts don't download the search's code. */
import { browserPrefs } from '../adapters/local';
import { seenToday, sinceFor, type Seen } from '../domain/changed';
import type { Prefs } from '../ports/prefs';

export const HOME_SEEN = 'home-seen';
const kept: Prefs = browserPrefs('faro-prefs:');

export function readHomeSeen(p: Prefs, ws: string, person: string): Seen | null {
  const s = p.get<Seen>(ws, person, HOME_SEEN);
  return s && (typeof s.last === 'string' || s.last === null) ? { last: s.last ?? null, prev: typeof s.prev === 'string' ? s.prev : null } : null;
}

/** Opening Home on a new day: `prev = last`, `last = today`; the same day again changes nothing. */
export function markHomeSeen(ws: string, person: string, today: string, p: Prefs = kept) {
  const was = readHomeSeen(p, ws, person);
  const next = seenToday(was, today);
  if (next !== was) p.set(ws, person, HOME_SEEN, next);
}

/** The day "Changed since" counts from (rule 5's `sinceFor`): the same before and after today's visit is kept. */
export const homeSince = (ws: string, person: string, today: string, p: Prefs = kept) => sinceFor(readHomeSeen(p, ws, person), today);
