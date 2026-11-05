/* When each person last looked at each goal, and what its status was then (the flagship goal page, 5 Nov): kept in this
   browser only, for "Since you looked on Tuesday: …" and for opening "About this goal" on a first visit. Storage can be
   blocked or cleared; then every visit reads as a first look, and nothing breaks. */
import { useEffect, useState } from 'react';
import type { Seen } from '../domain/goalPage';
import type { DisplayStatus } from '../domain/types';

const key = (ws: string, person: string, goal: string) => `goals-seen:${ws}:${person}:${goal}`;

export function readSeen(ws: string, person: string, goal: string): Seen | null {
  try {
    const v = localStorage.getItem(key(ws, person, goal));
    const s = v ? (JSON.parse(v) as Seen) : null;
    return s && typeof s.at === 'string' && typeof s.status === 'string' ? s : null;
  } catch { return null; }
}

export function writeSeen(ws: string, person: string, goal: string, seen: Seen) {
  try { localStorage.setItem(key(ws, person, goal), JSON.stringify(seen)); } catch { /* storage blocked: this visit only */ }
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
