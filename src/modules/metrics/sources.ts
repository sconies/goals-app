/* The number sources registered for the open workspace (NR2): what the check-in's number step asks. The demo's example
   has the two demo sources (./numbers.ts), made once from the example as it was built, before any save of this
   browser's, so a check-in posted here never fills in its own number. A workspace of your own, and the real app, has
   none until the internal team registers real ones (each a NumberSource that passes ./source.contract.ts).

   The eval fixture "two weeks behind" (journey READING-OLD): open the check-in with `?sources=behind` in its address and
   every demo series drops its last two weeks, so each reading is too old to fill in. Only the demo's sources read it,
   from the address the step opened at; nothing keeps it. */
import type { Cycle, Snapshot } from '../../domain/types';
import { demoSources } from './numbers';
import type { NumberSource } from './source';

/** How many weeks behind the demo's sources are: 2 when the address says `?sources=behind`, otherwise 0. */
export const demoBehindWeeks = (search = typeof location === 'undefined' ? '' : location.search): number =>
  new URLSearchParams(search).get('sources') === 'behind' ? 2 : 0;

const made = new WeakMap<Snapshot, Map<string, NumberSource[]>>();

/** The sources for a workspace: the demo's, made from its seeded snapshot (`seed`, null when the workspace isn't the
    example: then none). Made once per seed, cycle and lateness. */
export function sourcesFrom(seed: Snapshot | null, cycle: Cycle, behindWeeks = 0): NumberSource[] {
  if (!seed) return [];
  const byKey = made.get(seed) ?? new Map<string, NumberSource[]>();
  made.set(seed, byKey);
  const key = `${cycle.id}:${behindWeeks}`;
  let out = byKey.get(key);
  if (!out) { out = demoSources(seed, cycle, { behindWeeks }); byKey.set(key, out); }
  return out;
}
