/* A workspace made bigger (backlog AX4): the demo copied n times, every id given a suffix per copy, so the rules can be
   timed at sizes Faro hasn't reached. Copy 0 keeps its ids. Used by the scale budget (src/spec/scale.test.ts). */
import type { Snapshot } from '../domain/types';
import { mergeModuleRows, type ModuleRows } from '../domain/records';

/** The week's turn at company size (KT gap 9, spec/rebuild/scale.md): done within `minutes` of midnight in the home
    zone and never later than `readyBy`; the stage 1 rules' share for 30,000 goals at most `rulesSeconds` of one core,
    projected from the ten-times workspace by src/spec/scale.test.ts. Lower them as the rules get leaner; never raise
    them to make a change pass. 9.6 s of rule time on 12 Nov 2026. */
export const TURN = { minutes: 15, readyBy: '06:00', rulesSeconds: 30, goals: 30_000 } as const;

/** Every string in `v` that is one of `ids`, with `suffix` added. Walks objects and arrays; leaves the rest. */
function rename<T>(v: T, ids: Set<string>, suffix: string): T {
  if (typeof v === 'string') return (ids.has(v) ? v + suffix : v) as T;
  if (Array.isArray(v)) return v.map((x) => rename(x, ids, suffix)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rename(x, ids, suffix)])) as T;
  return v;
}

export function scaleWorkspace(s: Snapshot, n: number): Snapshot {
  if (n <= 1) return s;
  // The ids of every record that others point at; a cycle stays shared, as one workspace has one year at a time.
  const ids = new Set<string>();
  for (const list of [s.people, s.teams, s.goals, s.checkIns, s.decisions, s.changes, s.watches, s.reviews, s.retros ?? [], s.requests ?? [], s.views ?? [],
    // Every feature module's records too (domain/records), whatever they are.
    ...Object.values(s.modules ?? {}).flatMap((k) => Object.values(k))] as { id: string }[][]) {
    for (const r of list) ids.add(r.id);
  }
  const copies = Array.from({ length: n }, (_, i) => (i === 0 ? s : rename(s, ids, `_x${i}`)));
  const all = <K extends keyof Snapshot>(k: K) => copies.flatMap((c) => (c[k] ?? []) as unknown[]) as Snapshot[K];
  return {
    ...s,
    people: all('people'), teams: all('teams'), goals: all('goals'), checkIns: all('checkIns'), decisions: all('decisions'),
    changes: all('changes'), watches: all('watches'), reviews: all('reviews'), retros: all('retros'), requests: all('requests'),
    views: all('views'),
    ...(s.modules ? { modules: copies.reduce<ModuleRows | undefined>((acc, c) => mergeModuleRows(acc, c.modules), undefined) } : {}),
  };
}
