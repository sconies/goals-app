/* The metric library's rows in the conformance data (ML1): spec/conformance/metrics.csv, what the library's rules 1 to 3
   (rulesLibrary.ts) give in the demo workspace as it stood at `builtFor`. src/spec/conformance.ts reads this through the
   module registry, writes the file, and its test recomputes it from workspace.json; the drill scores it when asked
   (`"also": ["metrics"]`). */
import { currentWeek } from '../../domain/plan';
import type { Snapshot } from '../../domain/types';
import type { ConformanceWorkspace, ModuleConformance } from '../../spec/conformance';
import { linksOf, metricsOf, everUsed } from './rules';
import { partsOf } from './rulesParts';
import { measurementOf } from './rulesMeasured';
import { isUnmeasured } from '../../domain/unmeasured';
import { findMetrics, metricNeeds, summaryLine, type LibraryAsk } from './rulesLibrary';
import { goalsOfMetric, libraryReads, lineOf } from './reads';
import { demoReadingAt } from './numbers';
import { readingState } from './rulesReading';
import { sliceOf } from './source';

/** Rule 1's searches: the spec's worked examples, and each filter and order once. */
export const LIBRARY_ASKS: LibraryAsk[] = [
  {}, { q: 'min lower' }, { q: 'rhea' }, { q: 'dora' }, { q: 'zzzz' }, { unit: '%' }, { unit: 'MIN' }, { teamId: 'cicd' }, { teamId: 'company' },
  { ownerId: 'rhea' }, { dir: 'higher' }, { unused: true }, { sortout: true }, { sort: 'goals' }, { sort: 'changed' }, { q: 'rate', sort: 'goals' },
  // MT3: the retired ones, listed apart (the library's ?retired=1).
  { retired: true },
];
/** An ask as the address writes it: "q=min lower&unit=%", in a fixed order; empty for nothing asked. */
const askText = (a: LibraryAsk) => (['q', 'unit', 'teamId', 'ownerId', 'dir', 'unused', 'sortout', 'retired', 'sort'] as const).filter((k) => a[k] !== undefined).map((k) => `${k}=${String(a[k])}`).join('&');

export const HEADER = ['rule', 'ask', 'row', 'total', 'ids', 'goal', 'status', 'slice', 'now', 'target', 'vs_plan', 'owner', 'summary', 'needs', 'still', 'parts', 'ends', 'measured', 'reading', 'state'];

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
  // Rule 10 (MT3): how each metric would end: retired, as a goal has been measured by it, or deleted, as none has.
  for (const m of live) out.push(blank('ends', m.id, 0, { ends: everUsed(m.id, linksOf(s)) ? 'retire' : 'delete' }));
  // Rule 11 (MS): whether each metric is measured today, and the goals of this cycle its gap holds to no number.
  for (const m of live) out.push(blank('measured', m.id, 0, { measured: measurementOf(m), ids: goalsOfMetric(s, cycle, moment, week, m.id).filter((r) => isUnmeasured(r.goal)).map((r) => r.goal.key ?? r.goal.id).join(' ') }));
  // NR rule 1: for each goal in force measured by a metric the demo's sources read, what they say for its slice at the
  // moment ("{value} at {time}", "none" or "no-slice") and the number step's state, with nothing typed. The series are
  // the seeded example's (numbers.ts: the goal's numbers by week, continued a week, at 09:00 on the review day).
  for (const m of live) {
    const links = linksOf(s).filter((l) => l.metricId === m.id && inForce.has(l.goalId)).sort((a, b) => a.goalId.localeCompare(b.goalId));
    links.forEach((l, i) => {
      const r = demoReadingAt(w, cycle, m, sliceOf(l), moment);
      if (r === undefined) return;
      const goal = s.goals.find((g) => g.id === l.goalId)!;
      const last = s.checkIns.filter((c) => c.goalId === l.goalId && !c.removedAt).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1) ?? null;
      out.push(blank('reading', m.id, i + 1, { goal: goal.key ?? goal.id, slice: [l.teamId ?? 'company', l.part ?? ''].filter(Boolean).join(' · '), reading: r === 'no-slice' ? 'no-slice' : r ? `${r.value} at ${r.at}` : 'none', state: readingState(r, last?.reading ?? null, last?.value ?? null, moment, null, m.decimals) }));
    });
  }
  return out;
}

/** The goals whose links count at the moment: those rule 2 lists for any metric (a live goal of the cycle). */
const goalsOfMetricIds = (s: Snapshot, cycle: ConformanceWorkspace['cycle'], moment: Date, week: number, live: readonly { id: string }[]) =>
  live.flatMap((m) => goalsOfMetric(s, cycle, moment, week, m.id).map((r) => r.goal.id));

const files: ModuleConformance[] = [{
  file: 'metrics',
  header: HEADER,
  keys: ['rule', 'ask', 'row'],
  about: 'The metric library’s rules ([the library as a place](../modules/metrics/rules.md)), not part of stage 1, scored like find.csv when asked (`"also": ["metrics"]`). Made on the workspace as it stood at `builtFor` (the same `asOf`), with the metric records under `modules.metrics` in workspace.json (`metrics` and `metricLinks`); a link counts while its goal is live then. Four kinds of row, by `rule`: **find** (rule 1), one per search in a fixed list, `ask` the search as `key=value` joined by `&` (`q`, `unit`, `teamId`, `ownerId`, `dir`, `unused`, `sortout`, `sort`; empty for nothing asked), `total` how many match and `ids` every metric id found in order (every page); **goals** (rule 2), for each metric in use by id, a head row (`row` 0: `total` its goals, `summary` the lowest-and-highest line or empty), then one row per goal in order (`row` 1, 2…): `goal` its key, `status` its code, `slice`, `now`, `target`, `vs_plan` and `owner` in words; **needs** (rule 3), for each metric, `needs` the codes in order separated by spaces, empty for none; **still** (rule 6, [defining a metric well](../modules/metrics/rules.md)), for each metric, `still` its line in words (“Fully defined”, or “Still to say: …”); **parts** (rule 7, [for, which part](../modules/metrics/rules.md)), for each metric, `parts` the parts its links in force use, most used first, each in its most used spelling, separated by “ | ”, empty for none. **ends** (rule 10), for each metric, `retire` or `delete`; **reading** ([a reading in a check-in](../modules/metrics/rules.md), NR rule 1), for each goal in force measured by a metric the demo’s number sources read, in goal id order (`row` 1, 2…): `goal` its key, `slice` its team id or `company`, then “ · {part}”, `reading` what the source says for that slice at the moment (“{value} at {ISO time}”, `none`, or `no-slice` when it reads the metric but not that slice) and `state` rule 1’s state with nothing typed, against the goal’s latest check-in by `postedAt`. The demo’s sources are seeded series made from workspace.json’s check-ins (`src/modules/metrics/numbers.ts`, `DEMO_SERIES`): for each slice, the latest check-in value of each week of the goal named, continued one week by the mean step of its last four numbers rounded to whole numbers, plus `add`, less `short` weeks at the end, each measured at 09:00 UTC on its week’s review day. A **goals** row’s `slice` is the team or “The whole company”, then “ · {part}” when the link is for one part. Every other column is empty.',
  rows: (w, kit) => metricRowsOf(w, kit.asOf),
}];

export default files;
