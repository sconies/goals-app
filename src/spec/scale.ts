/* A workspace made bigger (backlog AX4): the demo copied n times, every id given a suffix per copy, so the rules can be
   timed at sizes Faro hasn't reached. Copy 0 keeps its ids. Used by the scale budget (src/spec/scale.test.ts). */
import type { Snapshot } from '../domain/types';

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
  for (const list of [s.people, s.teams, s.goals, s.checkIns, s.decisions, s.changes, s.watches, s.reviews, s.retros ?? [], s.requests ?? [], s.metrics ?? [], s.metricLinks ?? [], s.views ?? []] as { id: string }[][]) {
    for (const r of list) ids.add(r.id);
  }
  const copies = Array.from({ length: n }, (_, i) => (i === 0 ? s : rename(s, ids, `_x${i}`)));
  const all = <K extends keyof Snapshot>(k: K) => copies.flatMap((c) => (c[k] ?? []) as unknown[]) as Snapshot[K];
  return {
    ...s,
    people: all('people'), teams: all('teams'), goals: all('goals'), checkIns: all('checkIns'), decisions: all('decisions'),
    changes: all('changes'), watches: all('watches'), reviews: all('reviews'), retros: all('retros'), requests: all('requests'),
    metrics: all('metrics'), metricLinks: all('metricLinks'), views: all('views'),
  };
}
