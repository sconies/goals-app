/* The metric library's rows in the conformance data (ML1): spec/conformance/metrics.csv, what the library's rules 1 to 3
   (rulesLibrary.ts) give in the demo workspace as it stood at `builtFor`. src/spec/conformance.ts reads this through the
   module registry, writes the file, and its test recomputes it from workspace.json; the drill scores it when asked
   (`"also": ["metrics"]`). */
import { currentWeek } from '../../domain/plan';
import type { Snapshot } from '../../domain/types';
import type { ConformanceWorkspace, ModuleConformance } from '../../spec/conformance';
import { linksOf, metricsOf } from './rules';
import { partsOf } from './rulesParts';
import { findMetrics, metricNeeds, summaryLine, type LibraryAsk } from './rulesLibrary';
import { goalsOfMetric, libraryReads, lineOf } from './reads';

/** Rule 1's searches: the spec's worked examples, and each filter and order once. */
export const LIBRARY_ASKS: LibraryAsk[] = [
  {}, { q: 'min lower' }, { q: 'rhea' }, { q: 'dora' }, { q: 'zzzz' }, { unit: '%' }, { unit: 'MIN' }, { teamId: 'cicd' }, { teamId: 'company' },
  { ownerId: 'rhea' }, { dir: 'higher' }, { unused: true }, { sortout: true }, { sort: 'goals' }, { sort: 'changed' }, { q: 'rate', sort: 'goals' },
];
/** An ask as the address writes it: "q=min lower&unit=%", in a fixed order; empty for nothing asked. */
const askText = (a: LibraryAsk) => (['q', 'unit', 'teamId', 'ownerId', 'dir', 'unused', 'sortout', 'sort'] as const).filter((k) => a[k] !== undefined).map((k) => `${k}=${String(a[k])}`).join('&');

export const HEADER = ['rule', 'ask', 'row', 'total', 'ids', 'goal', 'status', 'slice', 'now', 'target', 'vs_plan', 'owner', 'summary', 'needs', 'still', 'parts'];

/** Every row: rule 1 for each ask, rule 2 for each metric (a head row, then one per goal), rule 3 for each metric. */
export function metricRowsOf(w: ConformanceWorkspace, asOf: (w: ConformanceWorkspace, moment: Date) => Snapshot): string[][] {
  const moment = new Date(w.builtFor);
  const s = asOf(w, moment);
  const cycle = w.cycle;
  const week = currentWeek(cycle, moment);
  const reads = libraryReads(s, w.builtFor);
  const blank = (rule: string, ask: string, row: number, cols: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => (h === 'rule' ? rule : h === 'ask' ? ask : h === 'row' ? String(row) : cols[h] ?? ''));
  const out: string[][] = [];
  for (const a of LIBRARY_ASKS) {
    const f = findMetrics(reads, { ...a, size: 1000 });
    out.push(blank('find', askText(a), 0, { total: String(f.total), ids: f.rows.map((r) => r.metric.id).join(' ') }));
  }
  const live = metricsOf(s).filter((m) => !m.removedAt).sort((x, y) => x.id.localeCompare(y.id));
  for (const m of live) {
    const rows = goalsOfMetric(s, cycle, moment, week, m.id);
    out.push(blank('goals', m.id, 0, { total: String(rows.length), summary: summaryLine(rows) ?? '' }));
    rows.forEach((r, i) => out.push(blank('goals', m.id, i + 1, { goal: r.goal.key ?? r.goal.id, status: r.status, slice: r.slice, now: r.now, target: r.target, vs_plan: r.vsPlan, owner: r.owner })));
  }
  for (const m of live) out.push(blank('needs', m.id, 0, { needs: metricNeeds(m, reads).map((n) => n.id).join(' ') }));
  // Rule 6 (MT1): what each metric still needs to say, in words.
  for (const m of live) out.push(blank('still', m.id, 0, { still: lineOf(s, m).line }));
  // Rule 7 (MT2): the parts a metric's live links use, most used first, separated by " | ".
  const inForce = new Set(goalsOfMetricIds(s, cycle, moment, week, live));
  for (const m of live) out.push(blank('parts', m.id, 0, { parts: partsOf(linksOf(s).filter((l) => l.metricId === m.id && inForce.has(l.goalId))).join(' | ') }));
  return out;
}

/** The goals whose links count at the moment: those rule 2 lists for any metric (a live goal of the cycle). */
const goalsOfMetricIds = (s: Snapshot, cycle: ConformanceWorkspace['cycle'], moment: Date, week: number, live: readonly { id: string }[]) =>
  live.flatMap((m) => goalsOfMetric(s, cycle, moment, week, m.id).map((r) => r.goal.id));

const files: ModuleConformance[] = [{
  file: 'metrics',
  header: HEADER,
  keys: ['rule', 'ask', 'row'],
  about: 'The metric library’s rules ([the library as a place](../modules/metrics/rules.md)), not part of stage 1, scored like find.csv when asked (`"also": ["metrics"]`). Made on the workspace as it stood at `builtFor` (the same `asOf`), with the metric records under `modules.metrics` in workspace.json (`metrics` and `metricLinks`); a link counts while its goal is live then. Four kinds of row, by `rule`: **find** (rule 1), one per search in a fixed list, `ask` the search as `key=value` joined by `&` (`q`, `unit`, `teamId`, `ownerId`, `dir`, `unused`, `sortout`, `sort`; empty for nothing asked), `total` how many match and `ids` every metric id found in order (every page); **goals** (rule 2), for each metric in use by id, a head row (`row` 0: `total` its goals, `summary` the lowest-and-highest line or empty), then one row per goal in order (`row` 1, 2…): `goal` its key, `status` its code, `slice`, `now`, `target`, `vs_plan` and `owner` in words; **needs** (rule 3), for each metric, `needs` the codes in order separated by spaces, empty for none; **still** (rule 6, [defining a metric well](../modules/metrics/rules.md)), for each metric, `still` its line in words (“Fully defined”, or “Still to say: …”); **parts** (rule 7, [for, which part](../modules/metrics/rules.md)), for each metric, `parts` the parts its links in force use, most used first, each in its most used spelling, separated by “ | ”, empty for none. A **goals** row’s `slice` is the team or “The whole company”, then “ · {part}” when the link is for one part. Every other column is empty.',
  rows: (w, kit) => metricRowsOf(w, kit.asOf),
}];

export default files;
