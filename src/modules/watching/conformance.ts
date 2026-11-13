/* Watching's rows in the conformance data (SW1): spec/conformance/watching.csv. For each person in the demo who watches
   anything, how many goals their watches cover (watchedGoals); then the read-back before switching Watching off
   (watchingOffReadBack). src/spec/conformance.ts reads this through the module registry and writes the file; its test
   recomputes it from workspace.json; the drill scores it when asked (`"also": ["watching"]`). */
import { watchedGoals } from '../../domain/watch';
import { watchingOffReadBack } from '../../domain/switchOff';
import type { ConformanceWorkspace, ModuleConformance } from '../../spec/conformance';
import type { Snapshot } from '../../domain/types';

export const HEADER = ['rule', 'person', 'watches', 'covers', 'people', 'see_through'];

export function watchingRowsOf(w: ConformanceWorkspace, asOf: (w: ConformanceWorkspace, moment: Date) => Snapshot): string[][] {
  const s = asOf(w, new Date(w.builtFor));
  const blank = (cols: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => cols[h] ?? '');
  const goals = s.goals.filter((g) => !g.removedAt);
  const ids = [...new Set(s.watches.map((x) => x.personId))].sort();
  const out = ids.map((id) => blank({ rule: 'covers', person: id, watches: String(s.watches.filter((x) => x.personId === id).length), covers: String(watchedGoals(id, { watches: s.watches, goals }).length) }));
  const r = watchingOffReadBack({ people: s.people, watches: s.watches, goals: s.goals });
  out.push(blank({ rule: 'readback', watches: String(r.watches), people: String(r.people), see_through: String(r.seeThrough) }));
  return out;
}

const files: ModuleConformance[] = [{
  file: 'watching',
  header: HEADER,
  keys: ['rule', 'person'],
  about: 'Watching’s rules ([Watching](../modules/watching/README.md)), not part of stage 1, scored when asked (`"also": ["watching"]`). Made on the workspace as it stood at `builtFor` (the same `asOf`). Two kinds of row, by `rule`: **covers**, one per person who watches anything: `watches` their watches and `covers` how many goals not removed those watches cover (a goal, a goal and everything feeding it at any depth, or every goal at a level, each goal once); **readback**, one row, what switching Watching off reads back first: `people` the people with a watch, `watches` the watches, and `see_through` of those people the ones who own no goal that is not removed or stopped. Every other column is empty.',
  rows: (w, kit) => watchingRowsOf(w, kit.asOf),
}];

export default files;
