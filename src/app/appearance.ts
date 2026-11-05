/* Personal choices about how the app looks, kept in this browser: light, dark or the system's choice, an accent colour,
   and a full or icons-only sidebar. index.html applies the first two before anything is drawn (no flash of the wrong
   theme), so its keys and values must match these. The colours themselves are in styles/notes/shell-settings.css. */
import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type Accent = 'cobalt' | 'violet' | 'petrol' | 'graphite';
export type Sidebar = 'full' | 'icons';

export const THEMES: [Theme, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
export const ACCENTS: [Accent, string][] = [['cobalt', 'Cobalt'], ['violet', 'Violet'], ['petrol', 'Petrol'], ['graphite', 'Graphite']];
export const SIDEBARS: [Sidebar, string][] = [['full', 'Full'], ['icons', 'Icons only']];

const KEYS = { theme: 'goals-theme', accent: 'goals-accent', sidebar: 'goals-sidebar' } as const;
export interface Appearance { theme: Theme; accent: Accent; sidebar: Sidebar }
const DEFAULT: Appearance = { theme: 'system', accent: 'cobalt', sidebar: 'full' };

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const pick = <T extends string>(v: string | null, list: [T, string][], d: T): T => (list.some(([k]) => k === v) ? (v as T) : d);

let cached: Appearance | null = null;
function read(): Appearance {
  if (!cached) cached = { theme: pick(get(KEYS.theme), THEMES, DEFAULT.theme), accent: pick(get(KEYS.accent), ACCENTS, DEFAULT.accent), sidebar: pick(get(KEYS.sidebar), SIDEBARS, DEFAULT.sidebar) };
  return cached;
}

/** Puts the theme and accent on the page: <html data-theme data-accent>. "System" and cobalt are the defaults, so no attribute. */
export function applyAppearance(a: Appearance = read()) {
  const d = document.documentElement;
  if (a.theme === 'system') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', a.theme);
  if (a.accent === 'cobalt') d.removeAttribute('data-accent'); else d.setAttribute('data-accent', a.accent);
}

const listeners = new Set<() => void>();
export function setAppearance(change: Partial<Appearance>) {
  const next = { ...read(), ...change };
  for (const k of Object.keys(change) as (keyof Appearance)[]) {
    // Private windows can refuse storage: the choice still holds for this visit.
    try { if (next[k] === DEFAULT[k]) localStorage.removeItem(KEYS[k]); else localStorage.setItem(KEYS[k], next[k]); } catch { /* storage blocked */ }
  }
  cached = next;
  applyAppearance(next);
  listeners.forEach((l) => l());
}

// Another tab changed it: follow.
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key && Object.values(KEYS).includes(e.key as never)) { cached = null; applyAppearance(); listeners.forEach((l) => l()); } });

export function useAppearance(): Appearance {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read, () => DEFAULT);
}
