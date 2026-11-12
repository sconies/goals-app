/* Faro's own ports as the port contracts open them (src/ports/contracts/cases): the browser's Search over a case's
   workspace, and browser Prefs over a store in memory. parts.test.ts runs the contracts on them, and Faro's shim
   (scripts/drill-faro/shim.mjs) answers the drill harness with them, which proves the harness: it must pass every case. */
import type { Snapshot } from '../domain/types';
import { currentWeek } from '../domain/plan';
import { searchRows } from '../app/reads';
import { caller } from '../ports/contracts/cases/run';
import type { SearchSeed } from '../ports/contracts/cases/search';
import { prefsStart, searchStart } from '../ports/contracts/search';
import { browserPrefs } from './local';
import { localSearch } from './localSearch';

/** A browser's localStorage, in memory. */
export const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

/** The search contract's workspace as Faro's records. */
export function seedSnapshot(seed: SearchSeed): Snapshot {
  return {
    people: seed.people.map((p) => ({ ...p, initials: '' })),
    teams: seed.teams, cycles: [seed.cycle], goals: seed.goals, checkIns: seed.checkIns,
    decisions: [], changes: [], watches: [], reviews: [], retros: [], requests: [],
  };
}

/** The browser's Search over a seed, as it stands at the seed's builtFor. */
export function seededSearch(seed: SearchSeed) {
  const at = new Date(seed.builtFor);
  return localSearch(searchRows(seedSnapshot(seed), seed.cycle, at, currentWeek(seed.cycle, at)));
}

/** Browser Prefs over a fresh store in memory, and a way to open it again. */
export function memoryPrefs() {
  const storage = memoryStorage();
  return () => browserPrefs('faro-prefs:', () => storage);
}

/** What Faro's shim answers: every port that has a contract as data. */
export const faroCaller = () => caller({ search: searchStart(seededSearch), prefs: prefsStart(memoryPrefs) });
