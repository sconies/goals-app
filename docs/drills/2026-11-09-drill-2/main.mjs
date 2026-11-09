import fs from 'node:fs';
import path from 'node:path';
import * as R from './rules.mjs';

const [, , wsPath, outDir] = process.argv;
const ws = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const cycle = ws.cycle;
const built = R.currentWeek(cycle, ws.builtFor);

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const num = (x) => (x == null ? '' : String(Number(x.toFixed(6))));
const yn = (b) => (b ? 'yes' : 'no');
const out = {
  status: [['week', 'goal', 'kind', 'status', 'calculated', 'greener', 'latest_week', 'days_without_update']],
  flags: [['week', 'goal', 'flags', 'handled', 'needs_attention']],
  projection: [['week', 'goal', 'kind', 'to_week', 'value', 'low', 'high', 'slope', 'first_week', 'last_week', 'forecast_misses']],
  scorecard: [['week', 'goal', 'cell', 'value', 'tone', 'likelihood', 'label', 'sub']],
  checkin: [['checkin', 'week', 'goal', 'calculated', 'reason', 'asks_target', 'needs_path', 'missing', 'call', 'greener', 'call_missing']],
};

const keyNum = (g) => Number(String(g.key).replace(/\D/g, ''));
const goals = [...ws.goals].sort((a, b) => keyNum(a) - keyNum(b));
const cisByGoal = new Map();
for (const c of ws.checkIns) { if (!cisByGoal.has(c.goalId)) cisByGoal.set(c.goalId, []); cisByGoal.get(c.goalId).push(c); }

for (let w = 0; w <= built; w++) {
  const moment = R.weekMoment(cycle, w);
  const asks = ws.requests.filter((a) => a.createdAt <= moment).map((a) => {
    if ((a.status === 'answered' || a.status === 'done') && a.answeredAt > moment) return { ...a, status: 'open', answer: null, answeredAt: null, answeredBy: null };
    if (a.status === 'withdrawn' && a.updatedAt > moment) return { ...a, status: 'open' };
    return a;
  });
  const decisions = ws.decisions.filter((d) => d.at <= moment);
  for (const g of goals) {
    if (g.createdAt > moment || (g.stoppedAt && g.stoppedAt <= moment)) continue;
    const cis = (cisByGoal.get(g.id) ?? []).filter((c) => c.postedAt <= moment);
    const latest = R.latestPosted(cis);
    const status = R.goalStatus(g, cycle, cis, moment);
    const calc = R.assessPosted(g, cycle, cis, w);
    out.status.push([w, g.key, g.kind, status, calc.status, yn(latest && R.isGreener(latest.status, latest.calculated)), latest ? latest.week : '', R.daysWithoutUpdate(g, cycle, cis, moment)]);
    const ctx = { cycle, cis, asks, decisions, trend: R.goalTrend(g, cycle, cis) };
    const flags = R.flagsFor(g, ctx, moment);
    const handled = R.handledFor(g, ctx, moment);
    const needs = flags.some((f) => f !== 'due') && !handled;
    out.flags.push([w, g.key, flags.join(' '), handled ?? '', yn(needs)]);
    if (g.kind !== 'milestone') {
      const p = calc.projection;
      const toWeek = g.kind === 'metric' ? R.planEnd(calc.planObj, cycle) : cycle.weeks;
      if (!p) out.projection.push([w, g.key, g.kind, '', '', '', '', '', '', '', '']);
      else out.projection.push([w, g.key, g.kind, p.week, num(p.value), num(p.low), num(p.high), num(p.slope), p.from, p.to, g.kind === 'metric' ? yn(calc.forecastMisses) : '']);
    }
    for (const c of R.goalScorecard(g, cycle, cis, w, status === 'stale')) out.scorecard.push([w, g.key, c.cell, c.value, c.tone, c.likelihood, c.label, c.sub]);
  }
}

const goalById = new Map(ws.goals.map((g) => [g.id, g]));
const rows = ws.checkIns.map((c) => ({ c, g: goalById.get(c.goalId) }));
rows.sort((a, b) => a.c.week - b.c.week || keyNum(a.g) - keyNum(b.g) || (a.c.id < b.c.id ? -1 : 1));
for (const { c, g } of rows) {
  const ga = { ...g, plan: g.kind === 'metric' ? R.planAsOf(g, c.week) : g.plan };
  const draft = { text: c.value == null ? '' : String(c.value), stages: c.stages };
  const bare = R.evaluate(ga, cycle, c.week, draft, cisByGoal.get(g.id));
  const withCall = R.evaluate(ga, cycle, c.week, { ...draft, call: c.status }, cisByGoal.get(g.id));
  out.checkin.push([c.id, c.week, g.key, bare.calculated, bare.reason, yn(bare.asksTarget), yn(bare.needsPath), bare.missing.join(' '), c.status, yn(withCall.greener), withCall.missing.join(' ')]);
}

for (const [name, rs] of Object.entries(out)) {
  fs.writeFileSync(path.join(outDir, name + '.csv'), rs.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
}
