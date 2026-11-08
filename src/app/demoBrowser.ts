/* Everything the demo keeps in this browser besides its saves, in one list, so Start over (and Workspace's Reset the
   example) can clear all of it (demo review, 8 Nov, item 1). A new key that remembers something about the example, or
   about what someone has seen or half-typed in it, goes here too; src/app/demoBrowser.test.ts fails on a key it
   doesn't know.

   Cleared: drafts (check-ins, new goals, the step a check-in was on), What's new "seen", when each goal was last looked
   at, a walkthrough in progress, a review's goal order, moved map cards, Goals' layout and Data's column layouts, the
   back trail, and the research bar's "skipped" screens.
   Kept, because they are about the viewer rather than the example: who you are viewing as (Start over keeps the
   person; switch in the Demo panel), appearance (theme, accent, motion, sound), consent and ids for research and
   telemetry, the token an older inbox kept, and the markups you raised (the inbox still has them). */

/** localStorage keys (exact, or a prefix ending in ':') that describe the example or someone's progress through it. */
export const DEMO_LOCAL = [
  'goals-app-draft:',
  'goals-seen:',
  'goals-whats-new-seen',
  'goals-map:',
  'goals-app-layout',
  'goals-data-layout:',
  'goals-data-cols:',
] as const;

/** sessionStorage keys, the same way. */
export const DEMO_SESSION = [
  'goals-tour',
  'goals-trail',
  'goals-app-review:',
  'goals-research-skipped',
] as const;

/** Kept on purpose (see above). Listed so the test can tell a forgotten key from a kept one. */
export const KEPT = [
  'goals-app-workspace', 'goals-app-viewer:', 'goals-app-v2', 'goals-live-', 'goals-theme', 'goals-accent', 'goals-sidebar',
  'goals-pace', 'goals-impact', 'goals-motion-off', 'goals-landing', 'goals-sound', 'goals-buzz', 'goals-motion-lab',
  'goals-present', 'goals-research', 'goals-demo-visitor', 'goals-telemetry', 'faro-',
] as const;

const matches = (k: string, list: readonly string[]) => list.some((x) => (x.endsWith(':') ? k.startsWith(x) : k === x));

function clearFrom(s: Storage | null, list: readonly string[]) {
  if (!s) return;
  const doomed: string[] = [];
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && matches(k, list)) doomed.push(k); }
  doomed.forEach((k) => s.removeItem(k));
}

const listeners = new Set<() => void>();
/** Something that holds one of these in memory too (What's new "seen") hears when they are cleared. */
export function onDemoBrowserCleared(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Forgets everything above. Storage that is blocked is skipped: there is nothing kept to forget. */
export function forgetDemoBrowser() {
  try { clearFrom(localStorage, DEMO_LOCAL); } catch { /* storage blocked */ }
  try { clearFrom(sessionStorage, DEMO_SESSION); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
  try { window.dispatchEvent(new Event('goals-tour')); } catch { /* not in a browser */ }
}
