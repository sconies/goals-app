/* Faro's own ports as the port contracts open them (src/ports/contracts/cases): the browser's Search over a case's
   workspace, browser Prefs over a store in memory, the browser's goals store in memory, and the query port over the
   conformance workspace. parts.test.ts runs the contracts on them, and Faro's shim
   (scripts/drill-faro/shim.mjs) answers the drill harness with them, which proves the harness: it must pass every case. */
import type { Snapshot } from '../domain/types';
import { currentWeek } from '../domain/plan';
import { searchRows } from '../app/reads';
import { caller } from '../ports/contracts/cases/run';
import type { SearchSeed } from '../ports/contracts/cases/search';
import { prefsStart, searchStart } from '../ports/contracts/search';
import { browserPrefs } from './local';
import { localSearch } from './localSearch';
import { localGoals } from './localGoals';
import { goalRows, scopeFacts } from '../app/reads';
import { goalsStart } from '../ports/contracts/goals';
import { storeStart } from '../ports/contracts/store';
import { BrowserStore } from '../data/store';
import { asOf, type ConformanceWorkspace } from '../spec/conformance';
import conformanceJson from '../../spec/conformance/workspace.json';

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

/** Faro's query port over the conformance workspace (or the same with goals added) at its builtFor, asked by `viewer`. */
const conf = conformanceJson as unknown as ConformanceWorkspace;
export const conformanceGoals = async (s: Snapshot, viewer: string) => {
  const at = new Date(conf.builtFor);
  const rows = goalRows(s, conf.cycle, at, currentWeek(conf.cycle, at));
  return localGoals(() => rows, () => scopeFacts(s, { id: viewer, teamId: s.people.find((p) => p.id === viewer)?.teamId ?? null }));
};
export const conformanceBase = async () => asOf(conf, new Date(conf.builtFor));

/** The browser's goals store over a fresh store in memory, without the example. */
export const memoryStore = async () => new BrowserStore(() => new Date('2026-10-30T12:00:00Z'), { storage: memoryStorage(), example: false, key: 'contract' });

/** What Faro's shim answers: every port that has a contract as data. */
export const faroCaller = () => caller({ search: searchStart(seededSearch), prefs: prefsStart(memoryPrefs), store: storeStart(memoryStore), goals: goalsStart(conformanceBase, conformanceGoals) });
