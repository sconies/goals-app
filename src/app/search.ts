/* Where the app picks its Search and Prefs adapters (docs/design/architecture.md, 1.1): over the workspace loaded in
   this browser today. The internal app swaps these two lines for its server's and changes no screen. Screens and
   pickers call useSearch() and usePrefs(), never the find rules. */
import { useMemo } from 'react';
import { browserPrefs } from '../adapters/local';
import { localSearch } from '../adapters/localSearch';
import { withRecent, type Recent } from '../domain/find';
import type { Prefs } from '../ports/prefs';
import type { Search } from '../ports/search';
import { searchRows } from './reads';
import { useApp } from './state';
import { useModules } from '../core/app';

const prefs = browserPrefs('faro-prefs:');

export function useSearch(): Search {
  const app = useApp();
  // A module's kinds (its finders) answer through the same port; with the module off, the kind is gone.
  const { screens } = useModules();
  return useMemo(() => localSearch(searchRows(app.snapshot, app.cycle, app.today, app.week), Object.fromEntries(screens.flatMap((m) => m.finders ?? []).map((f) => [f.kind, f.search]))), [app.snapshot, app.cycle, app.today, app.week, screens]);
}

export function usePrefs(): Prefs { return prefs; }

/** The things this person opened or chose lately in this workspace, newest first. */
export function recentsOf(p: Prefs, ws: string, person: string): Recent[] { return p.get<Recent[]>(ws, person, 'recents') ?? []; }

/** Remembers a choice or a visit, for the suggestions in every picker and Find. */
export function remember(p: Prefs, ws: string, person: string, r: Recent) { p.set(ws, person, 'recents', withRecent(recentsOf(p, ws, person), r)); }
