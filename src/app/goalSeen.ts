/* When each person last looked at each goal, and what its status was then (the flagship goal page, 5 Nov): a
   preference per person and workspace, through the Prefs port (src/ports/prefs.ts). Faro keeps it in this browser under
   `goals-seen:<workspace>:<person>:<goal>`; the internal app keeps it on its server, so it follows the person between
   devices. Storage can be blocked or cleared; then every visit reads as a first look, and nothing breaks. */
import { useEffect, useState } from 'react';
import { browserPrefs } from '../adapters/local';
import type { Seen } from '../domain/goalPage';
import type { DisplayStatus } from '../domain/types';
import type { Prefs } from '../ports/prefs';

const kept: Prefs = browserPrefs('goals-seen:');

export function readSeen(ws: string, person: string, goal: string, prefs: Prefs = kept): Seen | null {
  const s = prefs.get<Seen>(ws, person, goal);
  return s && typeof s.at === 'string' && typeof s.status === 'string' ? s : null;
}

export function writeSeen(ws: string, person: string, goal: string, seen: Seen, prefs: Prefs = kept) {
  prefs.set(ws, person, goal, seen);
}

/**
 * What this person saw last time (null on a first look), read once when the page opens; this visit is then kept as the
 * new "last looked", so the next visit compares with now.
 */
export function useSeen(ws: string, person: string, goal: string, status: DisplayStatus, now: () => string): Seen | null {
  const [prev] = useState(() => readSeen(ws, person, goal));
  useEffect(() => { writeSeen(ws, person, goal, { at: now(), status }); }, [ws, person, goal, status]); // eslint-disable-line react-hooks/exhaustive-deps
  return prev;
}
