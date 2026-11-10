/* The Search port (docs/design/architecture.md, 1.1: AR1). One search per kind of thing, answered a page at a time: the
   one call a list bar, a picker and Find make, and the seam where the internal app's server search plugs in. It is the
   query port's read side (spec/rebuild/ports-at-scale.md) cut down to what a list or a picker asks.

   - Faro's adapter (src/adapters/localSearch.ts) answers by calling the pure rules in src/domain/find.ts over the loaded
     workspace; a server's adapter asks the server. Screens and pickers import this port, never the rules.
   - Kinds are open: 'goal', 'person', 'team' and 'workspace' in the core, and any a module registers ('metric').
   - Paging is by key: `after` is the `next` the last page gave, never a page number.
   - It is asynchronous from day one: a caller shows the answer to the last thing it asked and drops older ones
     (`latestOnly`), though Faro's adapter answers at once.
   Its contract: src/ports/contracts/search.ts. */
import type { FoundRow, SearchAnswer, SearchAsk } from '../domain/find';

export type { FoundRow, SearchAnswer, SearchAsk };

/** The core's kinds; a module adds its own (the metric library: 'metric'). */
export const CORE_KINDS = ['goal', 'person', 'team', 'workspace'] as const;
export type SearchKind = (typeof CORE_KINDS)[number] | (string & {});

export interface Search {
  /** One page of the things of this kind that match, in the kind's order. Refuses a kind nobody registered. */
  search(kind: SearchKind, ask: SearchAsk): Promise<SearchAnswer>;
  /** The kinds it answers, core first. */
  kinds(): SearchKind[];
}

/** A kind nobody registered. */
export class UnknownKind extends Error {
  constructor(kind: string) { super(`Nothing searches “${kind}” here.`); this.name = 'UnknownKind'; }
}

/**
 * Wraps a search so each caller sees only the answer to the last thing it asked: an older answer that arrives late
 * resolves to null and is dropped. One per field (a picker, a list bar).
 */
export function latestOnly(s: Search): (kind: SearchKind, ask: SearchAsk) => Promise<SearchAnswer | null> {
  let asked = 0;
  return async (kind, ask) => {
    const mine = ++asked;
    const answer = await s.search(kind, ask);
    return mine === asked ? answer : null;
  };
}
