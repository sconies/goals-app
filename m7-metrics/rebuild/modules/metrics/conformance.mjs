// metrics.csv (spec/conformance/README.md, "metrics.csv"): the library's rules 1 to 3, 6, 7, 10 and the reading rule,
// on the workspace as it stood at builtFor.
import fs from 'node:fs';
import path from 'node:path';
import { csvCell } from '../../rules.mjs';
import * as R from './rules.mjs';
import { planMetricsSheet } from './sheet.mjs';

// The searches (rule 1): the worked examples' asks and each filter and order on its own.
// The list is the harness's (learned from its diffs: the kit names no input file for it).
export const FIND_ASKS = [
  {}, { q: 'min lower' }, { q: 'rhea' }, { q: 'dora' }, { q: 'zzzz' }, { unit: '%' }, { unit: 'MIN' }, { teamId: 'cicd' }, { teamId: 'company' },
  { ownerId: 'rhea' }, { dir: 'higher' }, { unused: 'true' }, { sortout: 'true' }, { sort: 'goals' }, { sort: 'changed' }, { q: 'rate', sort: 'goals' }, { retired: 'true' },
];
// The Metrics sheet's cases (MI): the kit names each case and its result, not its rows, so these rows are made to fit.
export const SHEET_CASES = [
  ['adds', [{ ID: '', Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better' }]],
  ['changes-caveats', [{ ID: 'metric_lead-time', Caveats: 'Read with the release calendar.' }]],
  ['unknown-id', [{ ID: 'metric_nope', Metric: 'Nope' }]],
  ['name-twice', [{ ID: '', Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better' }, { ID: '', Metric: 'Queue depth', Unit: 'jobs', Direction: 'Lower is better' }]],
  ['direction-unread', [{ ID: '', Metric: 'Queue depth', Unit: 'jobs', Direction: 'sideways' }]],
  ['unit-on-used', [{ ID: 'metric_lead-time', Unit: 'min' }]],
  ['meaning-on-used', [{ ID: 'metric_lead-time', Meaning: 'Mean hours from merge to production.' }]],
  ['retire-no-reason', [{ ID: 'metric_flaky-rate', Action: 'Retire' }]],
  ['retire', [{ ID: 'metric_flaky-rate', Action: 'Retire', Reason: 'The test platform reports it now.' }]],
  ['bring-back-in-use', [{ ID: 'metric_ci-cost', Action: 'Bring back' }]],
  ['structure', [{ ID: 'metric_ci-time', 'Part of': 'Lead time for changes', 'How it relates': 'Driver', Confidence: 'High', 'How it could be gamed': 'Skipping slow tests on main.' }]],
  ['structure-loop', [{ ID: 'metric_ci-time', 'Part of': 'Lead time for changes', 'How it relates': 'Driver' }, { ID: 'metric_lead-time', 'Part of': 'metric_ci-time', 'How it relates': 'Component' }]],
  ['level-no-parent', [{ ID: 'metric_ci-time', 'How it relates': 'Component' }]],
  ['relates-unread', [{ ID: 'metric_ci-time', 'Part of': 'Lead time for changes', 'How it relates': 'sibling', Confidence: 'sure' }]],
  ['parent-unknown', [{ ID: 'metric_ci-time', 'Part of': 'No such metric' }]],
];
const askText = (a) => Object.entries(a).map(([k, v]) => `${k}=${v}`).join('&');

export function metricsRows({ W, S1 }) {
  const ctx = { W, S1, now: W.builtFor };
  const live = R.liveGoalIds(ctx);
  const rows = [];
  const row = (o) => rows.push(o);
  for (const a of FIND_ASKS) {
    const r = R.findMetrics(ctx, a);
    row({ rule: 'find', ask: askText(a), row: 0, total: r.total, ids: r.all.map((m) => m.id).join(' ') });
  }
  const metrics = R.inUseMetrics(W).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const m of metrics) {
    const g = R.metricGoals(ctx, m, live);
    row({ rule: 'goals', ask: m.id, row: 0, total: g.length, summary: R.summaryLine(g) });
    g.forEach((x, i) => row({ rule: 'goals', ask: m.id, row: i + 1, goal: x.goal.key, status: x.status, slice: x.slice, now: x.now, target: x.target, vs_plan: x.vsPlan, owner: x.owner }));
  }
  for (const m of metrics) row({ rule: 'needs', ask: m.id, row: 0, needs: R.metricNeeds(ctx, m, live).map((x) => x.code).join(' ') });
  for (const m of metrics) row({ rule: 'still', ask: m.id, row: 0, still: R.stillToSay(W, m) });
  for (const m of metrics) row({ rule: 'parts', ask: m.id, row: 0, parts: R.partsOf(ctx, m, live).join(' | ') });
  for (const m of metrics) row({ rule: 'ends', ask: m.id, row: 0, ends: R.everUsed(W, m) ? 'retire' : 'delete' });
  for (const m of metrics) row({ rule: 'measured', ask: m.id, row: 0, measured: R.measurementOf(m) });
  // the reading rule
  const sources = R.demoSources(W, S1);
  const links = R.liveLinks(ctx, live).filter((l) => R.sourceFor(sources, l.metricId)).sort((a, b) => (a.goalId < b.goalId ? -1 : 1));
  links.forEach((l, i) => {
    const g = W.goals.find((x) => x.id === l.goalId);
    const src = R.sourceFor(sources, l.metricId);
    const asked = R.askSource(src, l.metricId, W.builtFor, { teamId: l.teamId, part: l.part || '' });
    const cks = (W.checkIns || []).filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= W.builtFor).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1));
    const last = cks[cks.length - 1];
    const state = R.readingState(asked, last?.reading || null, last ? last.value : null, W.builtFor, null, g.decimals ?? 0);
    row({ rule: 'reading', ask: l.metricId, row: links.slice(0, i + 1).filter((x) => x.metricId === l.metricId).length, goal: g.key, slice: `${l.teamId || 'company'}${l.part ? ` · ${l.part}` : ''}`, reading: asked.reading ? `${asked.reading.value} at ${asked.reading.at}` : asked.state === 'no-slice' ? 'no-slice' : 'none', state });
  });
  for (const [name, sheetRows] of SHEET_CASES) {
    const p = planMetricsSheet(ctx, 'amara', sheetRows, { now: W.builtFor });
    row({ rule: 'sheet', ask: name, row: 1, total: p.items.length, summary: p.summary, needs: p.issues.map((x) => `${x.level === 'must' ? 'Must fix' : 'Check'}: ${x.message}`).join(' | '), state: p.saves ? 'saves' : 'refused' });
  }
  return rows;
}

export const COLS = ['rule', 'ask', 'row', 'total', 'ids', 'goal', 'status', 'slice', 'now', 'target', 'vs_plan', 'owner', 'summary', 'needs', 'still', 'parts', 'ends', 'measured', 'reading', 'state'];
export function writeMetricsCsv(env, outDir) {
  const rows = metricsRows(env);
  fs.writeFileSync(path.join(outDir, 'metrics.csv'), [COLS, ...rows.map((r) => COLS.map((c) => r[c]))].map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
}
