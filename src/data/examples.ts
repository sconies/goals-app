/* The demo's example: one division of about 100 people, Platform Engineering (src/data/platformOrg). It is the only
   example. Its data is built in the browser from its description, the same every time for the same day, and the code
   that builds it loads only when it's needed, so it isn't part of the app's main bundle. */
import type { Snapshot, Workspace } from '../domain/types';

/** The modules an eval build starts the example with switched off (FARO_MODULES_OFF, evals/run.mjs): CI's smoke run with
    every module switched off at runtime. Empty in every other build. */
const MODULES_OFF = ((import.meta.env.VITE_EXAMPLE_MODULES_OFF as string | undefined) ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export const EXAMPLE: Workspace = { id: 'platform-org', name: 'Example: Platform Engineering', kind: 'example', createdAt: '2026-01-01T00:00:00.000Z', ...(MODULES_OFF.length ? { modulesOff: MODULES_OFF } : {}) };

/** Whether a workspace id is the demo's example. */
export const isExample = (id: string) => id === EXAMPLE.id;

/** The example's data as it stands on a day: built from its description, loaded on demand. An eval build carries it
    already built for the moment the evals pin the clock to (VITE_EXAMPLE_SNAPSHOT, made by scripts/example-snapshot.mjs
    with the same code), and loads that instead of building it on every page load. */
export async function buildExample(today: Date): Promise<Snapshot> {
  const saved = import.meta.env.VITE_EXAMPLE_SNAPSHOT as string | undefined;
  if (saved && today.toISOString() === saved) {
    try {
      const r = await fetch(`/example-${saved.slice(0, 10)}.json`);
      if (r.ok) return (await r.json()) as Snapshot;
    } catch { /* built below instead */ }
  }
  const { buildPlatformOrg } = await import('./platformOrg/generate');
  return buildPlatformOrg(today);
}
