/* Personal choices about how the app looks, kept in this browser: light, dark or the system's choice, an accent colour,
   a full or icons-only sidebar, and how a goal's page moves. index.html applies these before anything is drawn (no flash
   of the wrong theme), so its keys and values must match. The colours are in styles/notes/shell-settings.css; the motion
   variables (--pace, --impact and the effect switches) are read by styles/notes/goal-flagship.css. */
import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type Accent = 'faro' | 'cobalt' | 'violet' | 'petrol' | 'graphite';
export type Sidebar = 'full' | 'icons';

export const THEMES: [Theme, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
/** Faro's teal first, the default; the earlier colours stay for anyone who chose one (a saved choice is kept). */
export const ACCENTS: [Accent, string][] = [['faro', 'Faro (teal)'], ['cobalt', 'Cobalt'], ['violet', 'Violet'], ['petrol', 'Petrol'], ['graphite', 'Graphite']];
export const SIDEBARS: [Sidebar, string][] = [['full', 'Full'], ['icons', 'Icons only']];

/* ---------- how a goal's page moves (Lane, 5 Nov: sliders, and more options) ---------- */

/** Pace: how many times slower than the quickest the goal page's story runs (1 = the original timings). */
export const PACE = { min: 1, max: 4, step: 0.25, default: 2 } as const;
/** Impact: how hard it lands, from none (0) through the default (1) to very strong (2). */
export const IMPACT = { min: 0, max: 2, step: 0.1, default: 1 } as const;
/** The separate effects, each on by default. */
export const EFFECTS = [
  ['count', 'Count the number up'],
  ['draw', 'Draw the chart in'],
  ['ring', 'A ring from the latest point'],
  ['jolt', 'A jolt when it lands'],
  ['shake', 'A shake when it’s off track'],
] as const;
export type Effect = (typeof EFFECTS)[number][0];
/** How the number and the latest point land (the Motion lab's fun options). */
export const LANDINGS = [['thump', 'Thump'], ['spring', 'Spring'], ['wobble', 'Wobble'], ['drop', 'Drop']] as const;
export type Landing = (typeof LANDINGS)[number][0];

/** Words for a pace: "Original speed", "2× slower". */
export const paceWords = (p: number) => (p <= 1 ? 'Original speed' : `${Number(p.toFixed(2))}× slower`);
/** Words for an impact. */
export const impactWords = (i: number) => (i <= 0 ? 'None' : i < 0.6 ? 'Gentle' : i < 1.3 ? 'Strong' : i < 1.7 ? 'Big' : 'Very big');

const KEYS = { story: 'goals-story', theme: 'goals-theme', accent: 'goals-accent', sidebar: 'goals-sidebar', pace: 'goals-pace', impact: 'goals-impact', off: 'goals-motion-off', landing: 'goals-landing', sound: 'goals-sound', buzz: 'goals-buzz' } as const;
export interface Appearance { story: boolean; theme: Theme; accent: Accent; sidebar: Sidebar; pace: number; impact: number; off: Effect[]; landing: Landing; sound: boolean; buzz: boolean }
const DEFAULT: Appearance = { story: false, theme: 'system', accent: 'faro', sidebar: 'full', pace: PACE.default, impact: IMPACT.default, off: [], landing: 'thump', sound: false, buzz: false };

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const pick = <T extends string>(v: string | null, list: [T, string][], d: T): T => (list.some(([k]) => k === v) ? (v as T) : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Numbers, or the earlier named choices (Quick/Steady/Slow, Gentle/Strong/Big) carried over. */
const num = (v: string | null, named: Record<string, number>, lo: number, hi: number, d: number) => {
  if (v == null) return d;
  if (v in named) return named[v]!;
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : d;
};
const effectsOff = (v: string | null): Effect[] => (v ? v.split(',').filter((x): x is Effect => EFFECTS.some(([k]) => k === x)) : []);

let cached: Appearance | null = null;
function read(): Appearance {
  if (!cached) cached = {
    theme: pick(get(KEYS.theme), THEMES, DEFAULT.theme), accent: pick(get(KEYS.accent), ACCENTS, DEFAULT.accent), sidebar: pick(get(KEYS.sidebar), SIDEBARS, DEFAULT.sidebar),
    pace: num(get(KEYS.pace), { quick: 1, steady: 2, slow: 3 }, PACE.min, PACE.max, DEFAULT.pace),
    impact: num(get(KEYS.impact), { gentle: 0.5, strong: 1, big: 1.6 }, IMPACT.min, IMPACT.max, DEFAULT.impact),
    off: effectsOff(get(KEYS.off)),
    landing: (LANDINGS.some(([k]) => k === get(KEYS.landing)) ? get(KEYS.landing) : DEFAULT.landing) as Landing,
    sound: get(KEYS.sound) === '1', buzz: get(KEYS.buzz) === '1',
    story: get(KEYS.story) === '1',
  };
  return cached;
}

/** Puts the choices on the page: <html data-theme data-accent data-motion-off style="--pace; --impact">. */
export function applyAppearance(a: Appearance = read()) {
  const d = document.documentElement;
  if (a.theme === 'system') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', a.theme);
  if (a.accent === DEFAULT.accent) d.removeAttribute('data-accent'); else d.setAttribute('data-accent', a.accent);
  d.style.setProperty('--pace', String(a.pace));
  d.style.setProperty('--impact', String(a.impact));
  if (a.off.length) d.setAttribute('data-motion-off', a.off.join(' ')); else d.removeAttribute('data-motion-off');
  if (a.landing === 'thump') d.removeAttribute('data-landing'); else d.setAttribute('data-landing', a.landing);
  if (a.story) d.setAttribute('data-story', ''); else d.removeAttribute('data-story');
}

/** Whether the goal page plays its story (the chart drawing in over seconds, the number counting up and landing). Off
    by default since backlog T (8 Nov): a page is readable the moment it opens, and its motion stays under 250ms like the
    rest of the interface. Switched on in the Motion lab. */
export const storyOn = (): boolean => read().story;
/** The chosen pace as a multiple (2 by default), for motion driven from code (the count-up). */
export const storyPace = (): number => read().pace;
/** The moment it lands: a soft "tock" and a buzz on phones, each only if switched on in the Motion lab, never under
    reduced motion. */
export function landedMoment() {
  const a = read();
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* no matchMedia */ }
  if (a.buzz) { try { navigator.vibrate?.(Math.round(20 + 40 * a.impact)); } catch { /* no vibration */ } }
  if (a.sound) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 + 0.06 * a.impact, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2); o.onended = () => void ctx.close();
    } catch { /* no audio */ }
  }
}

/** Opens the Motion lab (the Easter egg): five quick taps on a goal's status, or the Konami code. */
export const openMotionLab = () => window.dispatchEvent(new Event('goals-motion-lab'));

/** Whether one of the goal page's effects is on. */
export const effectOn = (e: Effect): boolean => !read().off.includes(e);

const listeners = new Set<() => void>();
export function setAppearance(change: Partial<Appearance>) {
  const next = { ...read(), ...change };
  for (const k of Object.keys(change) as (keyof Appearance)[]) {
    const v = next[k];
    const same = Array.isArray(v) ? v.length === 0 : v === DEFAULT[k];
    // Private windows can refuse storage: the choice still holds for this visit.
    try { if (same) localStorage.removeItem(KEYS[k]); else localStorage.setItem(KEYS[k], Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '0') : String(v)); } catch { /* storage blocked */ }
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
