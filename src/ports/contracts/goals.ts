/* The contract for the query port (src/ports/goals.ts; AX5), as data (gap 1(b)): its cases are made from the
   conformance files (cases/goals.ts) and written to spec/conformance/contracts/goals.json by `npm run spec`, so the drill
   harness runs the same cases on any build through a shim. They check every Goals query in goals.csv, and the four
   things spec/rebuild/ports-at-scale.md asks of any query port:
     1. the summaries are the rules: every row's status and flags are those in status.csv and flags.csv;
     2. keyset paging never skips or repeats a row, even when a goal is added between pages;
     3. no read is larger than a page;
     4. only goal() gives a goal's check-ins;
   and that a scope is answered by its name for the person asking, and a list with no sort comes worst first, then by
   title. src/adapters/parts.test.ts runs it on Faro's adapter; run it on yours. */
import fs from 'node:fs';
import path from 'node:path';
import type { Snapshot } from '../../domain/types';
import { parseQuery } from '../../domain/query';
import type { GoalAsk, Goals } from '../goals';
import { goalsContract as cases, type GoalsGiven } from './cases/goals';
import { contractSuite, type Start } from './cases/run';

/** The contract, from the conformance files as committed (read when asked for, in the tests). */
export const GOALS_CONTRACT = () => cases((f) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'spec', 'conformance', f), 'utf8'));

/** An ask as the contract writes it: the Goals link's query as a string. */
type DataAsk = Omit<GoalAsk, 'query'> & { query: string };
const ask = (a: DataAsk): GoalAsk => ({ ...a, query: parseQuery(new URLSearchParams(a.query)) });

/**
 * `base()` gives the conformance workspace at its builtFor; `make(s, viewer)` the port over workspace `s`, asked by
 * `viewer` (for scopes). `add` makes a fresh port over the workspace with the goal added, as the case asks.
 */
export const goalsStart = (base: () => Promise<Snapshot>, make: (s: Snapshot, viewer: string) => Promise<Goals>): Start => async (given) => {
  const { viewer } = given as GoalsGiven;
  let s = await base();
  let port = await make(s, viewer);
  return async (op, args) => {
    if (op === 'add') { s = { ...s, goals: [...s.goals, args[0] as Snapshot['goals'][number]] }; port = await make(s, viewer); return null; }
    if (op === 'goals') return port.goals(ask(args[0] as DataAsk));
    if (op === 'counts') return port.counts(ask(args[0] as DataAsk));
    if (op === 'goal') return port.goal(args[0] as string);
    throw new Error(`No operation “${op}”.`);
  };
};

export function goalsContract(name: string, base: () => Promise<Snapshot>, make: (s: Snapshot, viewer: string) => Promise<Goals>) {
  contractSuite(GOALS_CONTRACT(), name, goalsStart(base, make));
}
