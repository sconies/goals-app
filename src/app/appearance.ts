/* Personal choices about how the app looks, kept in this browser: light, dark or the system's choice, an accent colour,
   a full or icons-only sidebar, and how a goal's page moves (its pace and how hard it lands). index.html applies the first two before anything is drawn (no flash of the wrong
   theme), so its keys and values must match these. The colours themselves are in styles/notes/shell-settings.css. */
import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type Accent = 'cobalt' | 'violet' | 'petrol' | 'graphite';
export type Sidebar = 'full' | 'icons';
/** How slowly a goal's page tells its story (the chart drawing in, the number counting up): a multiple of the base. */
export type Pace = 'quick' | 'steady' | 'slow';
/** How hard it lands when the chart and the number reach "now". */
export type Impact = 'gentle' | 'strong' | 'big';

export const THEMES: [Theme, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
export const ACCENTS: [Accent, string][] = [['cobalt', 'Cobalt'], ['violet', 'Violet'], ['petrol', 'Petrol'], ['graphite', 'Graphite']];
export const SIDEBARS: [Sidebar, string][] = [['full', 'Full'], ['icons', 'Icons only']];
export const PACES: [Pace, string][] = [['quick', 'Quick'], ['steady', 'Steady'], ['slow', 'Slow']];
export const IMPACTS: [Impact, string][] = [['gentle', 'Gentle'], ['strong', 'Strong'], ['big', 'Big']];
/** Steady (the default) is half the speed of Quick, Slow a third (Lane, 5 Nov). The CSS reads the same numbers. */
export const PACE_FACTOR: Record<Pace, number> = { quick: 1, steady: 2, slow: 3 };

const KEYS = { theme: 'goals-theme', accent: 'goals-accent', sidebar: 'goals-sidebar', pace: 'goals-pace', impact: 'goals-impact' } as const;
export interface Appearance { theme: Theme; accent: Accent; sidebar: Sidebar; pace: Pace; impact: Impact }
const DEFAULT: Appearance = { theme: 'system', accent: 'cobalt', sidebar: 'full', pace: 'steady', impact: 'strong' };

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const pick = <T extends string>(v: string | null, list: [T, string][], d: T): T => (list.some(([k]) => k === v) ? (v as T) : d);

let cached: Appearance | null = null;
function read(): Appearance {
  if (!cached) cached = { theme: pick(get(KEYS.theme), THEMES, DEFAULT.theme), accent: pick(get(KEYS.accent), ACCENTS, DEFAULT.accent), sidebar: pick(get(KEYS.sidebar), SIDEBARS, DEFAULT.sidebar), pace: pick(get(KEYS.pace), PACES, DEFAULT.pace), impact: pick(get(KEYS.impact), IMPACTS, DEFAULT.impact) };
  return cached;
}

/** Puts the choices on the page: <html data-theme data-accent data-pace data-impact>. Defaults have no attribute. */
export function applyAppearance(a: Appearance = read()) {
  const d = document.documentElement;
  if (a.theme === 'system') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', a.theme);
  if (a.accent === 'cobalt') d.removeAttribute('data-accent'); else d.setAttribute('data-accent', a.accent);
  if (a.pace === DEFAULT.pace) d.removeAttribute('data-pace'); else d.setAttribute('data-pace', a.pace);
  if (a.impact === DEFAULT.impact) d.removeAttribute('data-impact'); else d.setAttribute('data-impact', a.impact);
}

/** The chosen pace as a multiple (2 by default), for motion driven from code (the count-up). */
export const storyPace = (): number => PACE_FACTOR[read().pace];

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
