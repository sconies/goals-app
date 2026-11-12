/* The contracts for the Search and Prefs ports (docs/design/architecture.md, 2: AR1). Each takes a way to make the part
   and checks what any replacement must do. The cases are data (cases/search.ts and cases/prefs.ts, written to
   spec/conformance/contracts/ by `npm run spec`), so the drill harness runs the same cases on any build through a shim.
   src/adapters/parts.test.ts runs them on Faro's adapters; run them on yours. */
import type { Prefs } from '../prefs';
import type { Search } from '../search';
import { PREFS_CONTRACT } from './cases/prefs';
import { SEARCH_CONTRACT, type SearchSeed } from './cases/search';
import { contractSuite, methods, type Start } from './cases/run';

/** `make` seeds a search with a case's workspace (SEARCH_SEED unless the case gives its own), searched at its builtFor. */
export const searchStart = (make: (seed: SearchSeed) => Search | Promise<Search>): Start => async (given) => methods(await make(given as SearchSeed));

export function searchContract(name: string, make: (seed: SearchSeed) => Search | Promise<Search>) {
  contractSuite(SEARCH_CONTRACT, name, searchStart(make));
}

/** `make` gives a fresh, empty store, as a way to open it: opening it again (`reopen`) reads the same store. */
export const prefsStart = (make: () => () => Prefs): Start => () => {
  const open = make();
  let prefs = open();
  return (op, args) => {
    if (op === 'reopen') { prefs = open(); return null; }
    return methods(prefs)(op, args);
  };
};

export function prefsContract(name: string, make: () => () => Prefs) {
  contractSuite(PREFS_CONTRACT, name, prefsStart(make));
}
