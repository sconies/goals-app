/* Which What's new entry this person has last seen, kept in this browser. Opening What's new, or dismissing the line
   on Home, records the newest entry; anything newer is unread (the dot beside Help, the line on Home).
   Storage can be blocked (private windows, previews): then it lives in memory for this tab. */
import { useSyncExternalStore } from 'react';
import { onDemoBrowserCleared } from '../app/demoBrowser';
import { latestNewsId, newsAfter } from './lookup';

export const SEEN_KEY = 'goals-whats-new-seen';
let memory: string | null = null;
const listeners = new Set<() => void>();

function read(): string | null {
  try { return localStorage.getItem(SEEN_KEY) ?? memory; } catch { return memory; }
}

/** Records the newest entry as seen. */
export function markWhatsNewSeen() {
  const id = latestNewsId() ?? null;
  if (!id || read() === id) return;
  memory = id;
  try { localStorage.setItem(SEEN_KEY, id); } catch { /* storage blocked: this tab only */ }
  listeners.forEach((l) => l());
}

// Start over in the demo forgets it, so What's new is unread again.
onDemoBrowserCleared(() => { memory = null; listeners.forEach((l) => l()); });

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === SEEN_KEY) l(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
};

/** The entries this person hasn't seen yet, newest first. */
export function useUnreadNews() {
  const seen = useSyncExternalStore(subscribe, read, () => null);
  return newsAfter(seen);
}
