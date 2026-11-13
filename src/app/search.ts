/* Where the app picks its Search and Prefs adapters (docs/design/architecture.md, 1.1): over the workspace loaded in
   this browser today. The internal app swaps these two lines for its server's and changes no screen. Screens and
   pickers call useSearch() and usePrefs(), never the find rules. */
import { useEffect, useMemo, useState } from 'react';
import { browserPrefs } from '../adapters/local';
import { localSearch } from '../adapters/localSearch';
import { withRecent, type Recent } from '../domain/find';
import type { Prefs } from '../ports/prefs';
import type { Search, SearchAnswer, SearchAsk, SearchKind } from '../ports/search';
import { goalRows, personRows, searchRows, teamRows } from './reads';
import type { Cycle, Snapshot } from '../domain/types';
import { useApp } from './state';
import { useGoalColumns, useModules } from '../core/app';

const prefs = browserPrefs('faro-prefs:');

export function useSearch(): Search {
  const app = useApp();
  // A module's kinds (its finders) answer through the same port; with the module off, the kind is gone.
  // A module's filters (Measured by) narrow Goals' links through the same port.
  const { screens } = useModules();
  const { columns } = useGoalColumns();
  return useMemo(
    () => localSearch(searchRows(app.snapshot, app.cycle, app.today, app.week, columns), Object.fromEntries(screens.flatMap((m) => m.finders ?? []).map((f) => [f.kind, f.search(app.snapshot, app.viewer, app.today)]))),
    [app.snapshot, app.cycle, app.today, app.week, app.viewer, screens, columns],
  );
}

export function usePrefs(): Prefs { return prefs; }

/** The things this person opened or chose lately in this workspace, newest first. */
export function recentsOf(p: Prefs, ws: string, person: string): Recent[] { return p.get<Recent[]>(ws, person, 'recents') ?? []; }

/** Remembers a choice or a visit, for the suggestions in every picker and Find. */
export function remember(p: Prefs, ws: string, person: string, r: Recent) { p.set(ws, person, 'recents', withRecent(recentsOf(p, ws, person), r)); }

/** A search over a workspace that isn't open yet (set-up's draft): its people and teams, and its goals when given the
    draft's year, so a spreadsheet's "Choose a goal" at set-up finds the file's goals (#336 review). */
export function searchOver(s: Snapshot, at?: { cycle: Cycle; today: Date; week: number }): Search {
  return localSearch({ person: () => personRows(s), team: () => teamRows(s), ...(at ? { goal: () => goalRows(s, at.cycle, at.today, at.week) } : {}) });
}

/** A search over names alone (the inbox's senders, from every workspace): each name is its own id. */
export function searchNames(names: string[]): Search {
  const people = names.map((n) => ({ id: n, name: n, role: '', initials: '', teamId: null, admin: false }));
  return localSearch({ person: () => ({ kind: 'person', people, teamName: () => '' }) });
}

/**
 * One page of a kind's search, for a list (People, Teams): the Search port's answer to the last thing asked, kept while
 * the next is on its way so the list doesn't flash empty (marked `stale`). Null until the first answer.
 */
export function useFound(kind: SearchKind, ask: SearchAsk): (SearchAnswer & { stale: boolean }) | null {
  const search = useSearch();
  const key = JSON.stringify(ask);
  const [answer, setAnswer] = useState<{ key: string; a: SearchAnswer } | null>(null);
  useEffect(() => {
    let live = true;
    search.search(kind, ask).then((a) => { if (live) setAnswer({ key, a }); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kind, key]);
  // `stale`: the answer to an earlier ask, shown while this one is on its way; its count isn't this search's.
  return answer ? { ...answer.a, stale: answer.key !== key } : null;
}
