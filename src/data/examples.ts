/* The demo's example: one division of about 100 people, Platform Engineering (src/data/platformOrg). It is the only
   example. Its data is built in the browser from its description, the same every time for the same day, and the code
   that builds it loads only when it's needed, so it isn't part of the app's main bundle. */
import type { Snapshot, Workspace } from '../domain/types';

export const EXAMPLE: Workspace = { id: 'platform-org', name: 'Example: Platform Engineering', kind: 'example', createdAt: '2026-01-01T00:00:00.000Z' };

/** Whether a workspace id is the demo's example. */
export const isExample = (id: string) => id === EXAMPLE.id;

/** The example's data as it stands on a day: built from its description, loaded on demand. */
export async function buildExample(today: Date): Promise<Snapshot> {
  const { buildPlatformOrg } = await import('./platformOrg/generate');
  return buildPlatformOrg(today);
}
