/* Which phone navigation to show: the current tabs, or the 4-tab version being tried
   (Home, Goals, Reviews, More, with Watching inside Goals). Kept per browser; switched from the demo bar. */
import { useSyncExternalStore } from 'react';

export type NavMode = 'current' | 'four';
const KEY = 'goals-app-nav';
const listeners = new Set<() => void>();

function read(): NavMode {
  try { return localStorage.getItem(KEY) === 'four' ? 'four' : 'current'; } catch { return 'current'; }
}

export function setNavMode(m: NavMode) {
  try { localStorage.setItem(KEY, m); } catch { /* private mode: this visit only */ }
  listeners.forEach((l) => l());
}

export function useNavMode(): NavMode {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read, () => 'current');
}
