/* The Search port over the workspace loaded in this browser (docs/design/architecture.md, 1.1): each kind is answered by
   the pure rules in src/domain/find.ts over the rows src/app/reads.ts makes. The internal app's adapter asks its server
   instead and changes no screen. A module registers a kind of its own with a finder. */
import { rowsByIds, search, suggest, type GoalRows, type PersonRows, type SearchAnswer, type SearchAsk, type TeamRows, type FoundRow, type Recent, type WorkspaceRows } from '../domain/find';
import { CORE_KINDS, UnknownKind, type Search } from '../ports/search';

/** The rows each core kind is searched over; a kind left out isn't answered. Called on each search, so it may be lazy. */
export interface LocalRows { goal?: () => GoalRows; person?: () => PersonRows; team?: () => TeamRows; workspace?: () => WorkspaceRows }

/** A module's search for its own kind (and, if it has any, its suggestions). */
export type Finder = ((ask: SearchAsk) => SearchAnswer | Promise<SearchAnswer>) & {
  suggest?: (viewerId: string, recents: Recent[]) => FoundRow[] | Promise<FoundRow[]>;
  /** Its rows by id (a picker's choice); without it, a chosen one shows by its id. */
  byIds?: (ids: string[]) => FoundRow[] | Promise<FoundRow[]>;
};

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
    async byIds(kind, ids) {
      const own = (rows as Record<string, (() => Parameters<typeof rowsByIds>[0]) | undefined>)[kind];
      if (own) return rowsByIds(own(), ids);
      const f = finders[kind];
      if (f) return f.byIds ? f.byIds(ids) : ids.map((id) => ({ kind, id, name: id, detail: '' }));
      throw new UnknownKind(kind);
    },
    async suggest(kind, viewerId, recents) {
      if (kind === 'goal' && rows.goal) return suggest(rows.goal(), viewerId, recents);
      if (kind === 'person' && rows.person) return suggest(rows.person(), viewerId, recents);
      if (kind === 'team' && rows.team) return suggest(rows.team(), viewerId, recents);
      if (kind === 'workspace' && rows.workspace) return search(rows.workspace(), { q: '', size: 6 }).rows;
      const f = finders[kind];
      if (f) return f.suggest ? f.suggest(viewerId, recents) : [];
      throw new UnknownKind(kind);
    },
  };
}
