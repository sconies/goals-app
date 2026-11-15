// Stage 1 rebuild: the core rules, from spec/ and llms.txt alone.
// Usage: node main.mjs <workspace.json> <out folder>
import fs from 'node:fs';
import path from 'node:path';
import { makeS1, csvCell } from './rules.mjs';

const [, , wsPath, outDir] = process.argv;
const W = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const S1 = makeS1(W);
const { WEEKS, currentWeek, weekMoment, asOf, flagsFor, assessPosted, isUnmeasured, greenerThan, handledFor, rangeProjection, fmtNum, scorecard, liveCk, evaluate, momentOf, goalNum } = S1;

// ---------- write ----------
const rowsOut = { status: [], flags: [], projection: [], scorecard: [], checkin: [] };
const yn = (b) => (b ? 'yes' : 'no');

const lastWeek = currentWeek(W.builtFor);
for (let w = 0; w <= lastWeek; w++) {
  const m = weekMoment(w);
  const ws = asOf(m);
  for (const g of ws.goals) {
    const posted = ws.ckByGoal.get(g.id) || [];
    const fl = flagsFor(g, ws, m);
    const st = fl.st;
    const a = assessPosted(g, posted, w);
    const greener = !!(st.latest && !isUnmeasured(g) && greenerThan(st.latest.status, st.latest.calculated));
    rowsOut.status.push([w, g.key, g.kind, st.status, a.calc, yn(greener), st.latest ? st.latest.week : '', st.days]);
    const handled = handledFor(g, ws, m, fl);
    const others = fl.flags.filter((x) => x !== 'due');
    const needs = others.length > 0 && !handled;
    rowsOut.flags.push([w, g.key, fl.flags.join(' '), handled || '', yn(needs), needs ? 'needs' : handled ? 'handled' : '']);
    if (g.kind === 'metric' || g.kind === 'range') {
      let proj = null, misses = '';
      if (g.kind === 'metric') { proj = a.projection; if (proj) misses = yn(a.forecastMisses); }
      else proj = isUnmeasured(g) ? null : rangeProjection(g, posted, w);
      rowsOut.projection.push(proj
        ? [w, g.key, g.kind, proj.week, fmtNum(proj.value), fmtNum(proj.low), fmtNum(proj.high), fmtNum(proj.slope), proj.from, proj.to, misses]
        : [w, g.key, g.kind, '', '', '', '', '', '', '', '']);
    }
    const sc = scorecard(g, posted, w, st.status === 'stale');
    for (const [cell, tone, lk] of sc.cells) rowsOut.scorecard.push([w, g.key, cell, tone, lk]);
  }
}

// check-ins: every one, judged as a draft in its own week
const goalById = new Map((W.goals || []).map((g) => [g.id, g]));
const ckAllByGoal = new Map();
for (const c of liveCk) { if (!ckAllByGoal.has(c.goalId)) ckAllByGoal.set(c.goalId, []); ckAllByGoal.get(c.goalId).push(c); }
const ckRows = [];
for (const c of liveCk) {
  const g = goalById.get(c.goalId);
  if (!g) continue;
  const all = ckAllByGoal.get(g.id);
  const e = evaluate(g, c, all);
  ckRows.push({ c, g, row: [c.id, c.week, g.key, e.calc, e.reason, yn(e.asksTarget), yn(e.needsPath), e.missingBare.join(' '), c.status, yn(e.greener), e.missingCall.join(' '), momentOf(g, c, all)] });
}
ckRows.sort((x, y) => x.c.week - y.c.week || goalNum(x.g.key) - goalNum(y.g.key) || (x.c.id < y.c.id ? -1 : 1));
rowsOut.checkin = ckRows.map((r) => r.row);

const HEAD = {
  status: ['week', 'goal', 'kind', 'status', 'calculated', 'greener', 'latest_week', 'days_without_update'],
  flags: ['week', 'goal', 'flags', 'handled', 'needs_attention', 'attention_group'],
  projection: ['week', 'goal', 'kind', 'to_week', 'value', 'low', 'high', 'slope', 'first_week', 'last_week', 'forecast_misses'],
  scorecard: ['week', 'goal', 'cell', 'tone', 'likelihood'],
  checkin: ['checkin', 'week', 'goal', 'calculated', 'reason', 'asks_target', 'needs_path', 'missing', 'call', 'greener', 'call_missing', 'moment'],
};
for (const [name, rows] of Object.entries(rowsOut)) {
  const text = [HEAD[name], ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, `${name}.csv`), text);
}

// ---------- stage 2: the change engine, when its cases sit beside the workspace ----------
const casesPath = path.join(path.dirname(wsPath), 'change-cases.json');

if (globalThis.__captureS1) globalThis.__captureS1(S1);
else {
  if (fs.existsSync(casesPath)) {
    const { runCases } = await import('./engine.mjs');
    runCases({ W, cases: JSON.parse(fs.readFileSync(casesPath, 'utf8')), outDir, S1 });
  }
  // ---------- stage 3: the screens' rules, when their cases sit beside the workspace ----------
  const screenPath = path.join(path.dirname(wsPath), 'screen-cases.json');
  if (fs.existsSync(screenPath)) {
    const { runScreenCases } = await import('./stage3.mjs');
    runScreenCases({ W, cases: JSON.parse(fs.readFileSync(screenPath, 'utf8')), outDir, S1 });
  }
}
// ---------- the modules' own drill files (rebuild/modules/<id>/drill.mjs), each writing what its stage scores ----------
if (!globalThis.__captureS1) {
  const modsDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'modules');
  if (fs.existsSync(modsDir)) for (const d of fs.readdirSync(modsDir).sort()) {
    const f = path.join(modsDir, d, 'drill.mjs');
    if (fs.existsSync(f)) (await import(f)).writeDrillFiles({ W, S1, outDir });
  }
}
