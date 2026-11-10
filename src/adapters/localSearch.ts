/* The Search port over the workspace loaded in this browser (docs/design/architecture.md, 1.1): each kind is answered by
   the pure rules in src/domain/find.ts over the rows src/app/reads.ts makes. The internal app's adapter asks its server
   instead and changes no screen. A module registers a kind of its own with a finder. */
import { search, type GoalRows, type PersonRows, type SearchAnswer, type SearchAsk, type TeamRows, type WorkspaceRows } from '../domain/find';
import { CORE_KINDS, UnknownKind, type Search } from '../ports/search';

/** The rows each core kind is searched over; a kind left out isn't answered. Called on each search, so it may be lazy. */
export interface LocalRows { goal?: () => GoalRows; person?: () => PersonRows; team?: () => TeamRows; workspace?: () => WorkspaceRows }

/** A module's search for its own kind. */
export type Finder = (ask: SearchAsk) => SearchAnswer | Promise<SearchAnswer>;

export function localSearch(rows: LocalRows, finders: Record<string, Finder> = {}): Search {
  const core = CORE_KINDS.filter((k) => rows[k]);
  return {
    kinds: () => [...core, ...Object.keys(finders).filter((k) => !core.includes(k as never))],
    async search(kind, ask) {
      const own = (rows as Record<string, (() => Parameters<typeof search>[0]) | undefined>)[kind];
      if (own) return search(own(), ask);
      const f = finders[kind];
      if (f) return f(ask);
      throw new UnknownKind(kind);
    },
  };
}
