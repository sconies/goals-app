// metrics.csv (spec/conformance/README.md, "metrics.csv"): the library's rules 1 to 3, 6, 7, 10 and the reading rule,
// on the workspace as it stood at builtFor. The find asks are the drill's inputs; the kit gives them only as rows of the
// expected file, so they are listed here (gap M-1).
import fs from 'node:fs';
import path from 'node:path';
import * as L from './rules.mjs';
import { goalSummary } from './summary.mjs';
import { demoSources, sourceFor } from './sources.mjs';

export const FIND_ASKS = [
  '', 'q=min lower', 'q=rhea', 'q=dora', 'q=zzzz', 'unit=%', 'unit=MIN', 'teamId=cicd', 'teamId=company', 'unused=true',
  'sortout=true', 'sort=goals', 'sort=changed', 'q=rate&sort=goals', 'retired=true', 'dir=higher', 'ownerId=rhea',
];
const parseAsk = (a) => Object.fromEntries(new URLSearchParams(a));

export function metricsRows(W, S1, R) {
  const moment = W.builtFor;
  const M = W.modules?.metrics || {};
  const metrics = M.metrics || [], links = M.metricLinks || [];
  const live = R.standing(moment).ws.goals.filter((g) => !g.stoppedAt && !g.removedAt);
  const liveGoalIds = new Set(live.map((g) => g.id));
  const people = W.people || [], teams = W.teams || [];
  const ctx = { metrics, links, liveGoalIds, people, moment };
  const rows = [];
  const row = (o) => rows.push(o);
  for (const ask of FIND_ASKS) {
    const q = parseAsk(ask);
    const r = L.findMetrics({ ...q, unused: q.unused === 'true', sortout: q.sortout === 'true', retired: q.retired === 'true' }, ctx);
    row({ rule: 'find', ask, row: 0, total: r.total, ids: r.all.map((m) => m.id).join(' ') });
  }
  const inUse = metrics.filter(L.inUse).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const m of inUse) {
    const gs = L.metricGoals(m.id, { links, liveGoalIds, goals: W.goals, teams, summaryOf: (g) => goalSummary(g, S1, R, moment) });
    row({ rule: 'goals', ask: m.id, row: 0, total: gs.length, summary: L.summaryLine(gs) });
    gs.forEach((g, i) => row({ rule: 'goals', ask: m.id, row: i + 1, goal: g.goal.key, status: g.status, slice: g.slice, now: g.now, target: g.target, vs_plan: g.vsPlan, owner: g.owner }));
  }
  for (const m of inUse) row({ rule: 'needs', ask: m.id, row: 0, needs: L.metricNeeds(m, ctx).map((x) => x.code).join(' ') });
  for (const m of inUse) row({ rule: 'still', ask: m.id, row: 0, still: L.stillToSay(m, people) });
  for (const m of inUse) row({ rule: 'parts', ask: m.id, row: 0, parts: L.partsOf(m.id, links, liveGoalIds).join(' | ') });
  for (const m of inUse) row({ rule: 'ends', ask: m.id, row: 0, ends: L.everUsed(m.id, links) ? 'retire' : 'delete' });
  for (const m of inUse) row({ rule: 'measured', ask: m.id, row: 0, measured: L.measurementOf(m) });
  // reading: each goal in force measured by a metric the demo's sources read, in goal id order
  const sources = demoSources(W);
  const inForce = L.liveLinks(links, liveGoalIds).filter((l) => sourceFor(sources, l.metricId, l));
  inForce.sort((a, b) => (a.goalId < b.goalId ? -1 : 1));
  const nth = new Map();
  inForce.forEach((l) => {
    const g = W.goals.find((x) => x.id === l.goalId);
    const s = sourceFor(sources, l.metricId, l);
    const reading = s.readsSlice ? s.source.read(l.metricId, moment, l) : null;
    const posted = (W.checkIns || []).filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= moment).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1));
    const last = posted[posted.length - 1] || null;
    const state = L.readingState({ reading, noSlice: !s.readsSlice, lastReading: last?.reading || null, lastValue: last ? last.value : null, now: moment, decimals: g.decimals || 0 });
    nth.set(l.metricId, (nth.get(l.metricId) || 0) + 1);
    row({ rule: 'reading', ask: l.metricId, row: nth.get(l.metricId), goal: g.key, slice: `${l.teamId ?? 'company'}${l.part ? ` · ${l.part}` : ''}`,
      reading: !s.readsSlice ? 'no-slice' : reading ? `${reading.value} at ${reading.at}` : 'none', state });
  });
  return rows;
}
const COLS = ['rule', 'ask', 'row', 'total', 'ids', 'goal', 'status', 'slice', 'now', 'target', 'vs_plan', 'owner', 'summary', 'needs', 'still', 'parts', 'ends', 'measured', 'reading', 'state'];
const cell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function writeMetricsCsv(W, S1, R, outDir) {
  if (!W.modules?.metrics) return;
  const rows = metricsRows(W, S1, R);
  fs.writeFileSync(path.join(outDir, 'metrics.csv'), [COLS.join(','), ...rows.map((r) => COLS.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
}
