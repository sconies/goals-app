// Stage 1 rebuild: the core rules, from spec/ and llms.txt alone.
// Usage: node main.mjs <workspace.json> <out folder>
import fs from 'node:fs';
import path from 'node:path';

const [, , wsPath, outDir] = process.argv;
const W = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
// the modules switched off for this run (CORE-CHANGES 4): FARO_MODULES_OFF=spreadsheets runs the drill with it off
if (process.env.FARO_MODULES_OFF) W.modulesOff = process.env.FARO_MODULES_OFF.split(",").filter(Boolean);
fs.mkdirSync(outDir, { recursive: true });

// ---------- numbers ----------
const EPS = 1e-9;
const r9 = (x) => Number(x.toFixed(9));
const rd = (x, d) => Number(x.toFixed(d));
const fmtNum = (x) => {
  if (x === null || x === undefined || Number.isNaN(x)) return '';
  const v = Number(x.toFixed(6));
  return String(Object.is(v, -0) ? 0 : v);
};

// ---------- days and weeks (UTC) ----------
const DAY = 86400000;
const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const isoOfDay = (n) => new Date(n * DAY).toISOString().slice(0, 10);

const cycle = W.cycle;
const START = dayNum(cycle.startDate);
const WEEKS = cycle.weeks;
const REVIEW_DAY = cycle.reviewDay;
const CHECKIN_WEEKS = cycle.checkInWeeks === undefined || cycle.checkInWeeks === null ? 1 : cycle.checkInWeeks;
const RHYTHM_FROM = cycle.rhythmFrom ? dayNum(cycle.rhythmFrom) : START;
const STALE_DAYS = 2 * 7 * CHECKIN_WEEKS;
const LAST_DAY = START + (WEEKS + 1) * 7 - 1;

const currentWeek = (moment) => Math.max(0, Math.min(WEEKS, Math.floor((dayNum(moment) - START) / 7)));
const weekMoment = (w) => `${isoOfDay(START + 7 * w + REVIEW_DAY)}T12:00:00.000Z`;
const daysSince = (fromIso, todayIso) => dayNum(todayIso) - dayNum(fromIso);
// first week whose review day falls on or after day d (never before week 1)
const firstWeekOnOrAfter = (d) => Math.max(1, Math.ceil((d - START - REVIEW_DAY) / 7));

// ---------- plans ----------
const planFrom = (p) => p.fromWeek ?? 0;
const planEnd = (p) => p.endWeek ?? WEEKS;
function shareAt(shape, w, n) {
  if (n <= 0) return 1;
  const x = Math.max(0, Math.min(n, w));
  if (shape === 'back') return Math.pow(x / n, 1.5);
  if (shape === 'stepped') {
    const steps = [Math.floor(n / 3) + 1, Math.floor((2 * n) / 3) + 1, n];
    return steps.filter((s) => x >= s).length / 3;
  }
  return x / n;
}
function planAt(p, week) {
  const from = planFrom(p), end = planEnd(p);
  if (week <= from) return p.start;
  if (week >= end) return p.target;
  if (p.points && p.points.length) {
    const pts = [{ week: from, value: p.start }, ...p.points.filter((q) => q.week > from && q.week < end).sort((a, b) => a.week - b.week), { week: end, value: p.target }];
    for (let i = 1; i < pts.length; i++) {
      if (week <= pts[i].week) {
        const a = pts[i - 1], b = pts[i];
        return a.value + ((b.value - a.value) * (week - a.week)) / (b.week - a.week);
      }
    }
    return p.target;
  }
  return p.start + (p.target - p.start) * shareAt(p.shape, week - from, end - from);
}
function planHistoryOf(g) {
  if (g.planHistory && g.planHistory.length) return g.planHistory;
  if (g.originalPlan && g.rebaselinedWeek !== null && g.rebaselinedWeek !== undefined) return [{ untilWeek: g.rebaselinedWeek, plan: g.originalPlan }];
  return [];
}
function planAsOf(g, week) {
  for (const h of planHistoryOf(g)) if (h.untilWeek > week) return h.plan;
  return g.plan;
}

// ---------- what a number can be ----------
const TIME_MONEY = /^(days?|hours?|hrs?|mins?|minutes?|weeks?|secs?|seconds?|ms|pts?|points?|score|nps)$|usd|gbp|eur|\$|£|€|°/;
function planNumbers(g, week) {
  if (g.kind === 'metric') {
    const p = planAsOf(g, week);
    return [p.start, p.target, ...(p.points || []).map((q) => q.value)];
  }
  if (g.kind === 'range') return [g.range.limit, ...(g.range.lower !== undefined && g.range.lower !== null ? [g.range.lower] : [])];
  return [];
}
const isShare = (g, week) => (g.unit || '').trim() === '%' && planNumbers(g, week).every((v) => v >= 0 && v <= 100);
const isCount = (g, week) => {
  const u = (g.unit || '').trim().toLowerCase();
  return g.decimals === 0 && planNumbers(g, week).every((v) => Number.isInteger(v) && v >= 0) && u !== '%' && !TIME_MONEY.test(u);
};
const usuallyPositive = (g) => {
  const u = (g.unit || '').trim();
  if (u === '%') return true;
  const l = u.toLowerCase();
  return ['day', 'hour', 'min', 'week', 'usd', 'gbp', 'eur', '$', '£', '€'].some((s) => l.includes(s));
};

// ---------- the projection ----------
function project(series, T) {
  if (!series.length) return null;
  const last = series[series.length - 1];
  let pts = series.filter((p) => p.week > last.week - 8);
  if (last.week - pts[0].week < 3) {
    let idx = -1;
    for (let i = 0; i < series.length; i++) if (series[i].week <= last.week - 3) idx = i;
    if (idx < 0) return null;
    pts = series.slice(idx);
  }
  const n = pts.length;
  const xb = pts.reduce((s, p) => s + p.week, 0) / n;
  const yb = pts.reduce((s, p) => s + p.value, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.week - xb) ** 2; sxy += (p.week - xb) * (p.value - yb); }
  const slope = sxy / sxx;
  let sse = 0;
  for (const p of pts) sse += (p.value - (yb + slope * (p.week - xb))) ** 2;
  const spread = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  const se = spread / Math.sqrt(sxx);
  let lean;
  if (se <= 1e-12) lean = 1;
  else { const t = slope / se; lean = (t * t) / (1 + t * t); }
  const value = yb + lean * slope * (T - xb);
  const half = spread * Math.sqrt(1 / n + (T - xb) ** 2 / sxx);
  return { value: r9(value), low: r9(value - half), high: r9(value + half), slope: r9(lean * slope), from: pts[0].week, to: last.week, week: T };
}
function hold(proj, g, week) {
  if (!proj) return null;
  if (isShare(g, week)) {
    const c = (x) => Math.max(0, Math.min(100, x));
    return { ...proj, value: c(proj.value), low: c(proj.low), high: c(proj.high) };
  }
  if (isCount(g, week)) {
    const c = (x) => Math.max(0, x);
    return { ...proj, value: c(proj.value), low: c(proj.low), high: c(proj.high) };
  }
  return proj;
}

// ---------- check-in lists ----------
const byWeekPosted = (a, b) => a.week - b.week || (a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0);
const sortCk = (list) => [...list].sort(byWeekPosted); // stable: record order kept on ties
// the latest by posting: walk by week then posting, take a new one only on a strictly later postedAt
function latestPosted(sorted) {
  let latest = null;
  for (const c of sorted) if (!latest || c.postedAt > latest.postedAt) latest = c;
  return latest;
}
// newest number among the weeks before `week`
function previousNumber(sorted, week) {
  let prev = null;
  for (const c of sorted) if (c.week < week && c.value !== null && c.value !== undefined) prev = c;
  return prev;
}

// ---------- the calculation ----------
const isUnmeasured = (g) => !!g.unmeasuredSince && !g.removedAt && !g.stoppedAt;

function metricCalc(g, plan, week, actual, earlierNums) {
  // earlierNums: [{week,value}] oldest first, not including this one
  const res = { calc: 'none', ratio: null, wellAhead: false, behind: false, projection: null, forecastMisses: false };
  if (week === 0) { res.calc = 'planned'; return res; }
  if (actual === null || actual === undefined) return res;
  const start = plan.start, target = plan.target;
  const p = planAt(plan, week);
  const planned = p - start;
  const dir = Math.sign(target - start);
  const d = g.decimals ?? 0;
  if (Math.abs(planned) < EPS) {
    if ((actual - start) * dir < -EPS) { res.calc = 'risk'; res.behind = true; } else res.calc = 'on';
  } else {
    const ratioOf = (v) => r9((v - start) / planned);
    let ratio = ratioOf(actual);
    const step = Math.pow(10, -d);
    const a = start + planned * 0.95, b = start + planned * 1.2;
    let writable = Math.abs(b - a) >= step;
    if (!writable) {
      for (let k = Math.floor(Math.min(a, b) / step) - 1; k <= Math.ceil(Math.max(a, b) / step) + 1; k++) {
        const v = rd(k * step, d);
        const rv = ratioOf(v);
        if (rv >= 0.95 && rv < 1.2) { writable = true; break; }
      }
    }
    if (Math.abs(actual - rd(p, d)) < EPS && !writable) ratio = 1;
    res.ratio = ratio;
    res.calc = ratio >= 0.95 ? 'on' : ratio >= 0.8 ? 'risk' : 'off';
    res.wellAhead = ratio >= 1.2;
    res.behind = ratio < 0.95;
  }
  const series = [...earlierNums, { week, value: actual }];
  const proj = hold(project(series, planEnd(plan)), g, week);
  res.projection = proj;
  if (proj) res.forecastMisses = (target - proj.value) * dir > EPS;
  return res;
}

function rangeOut(r, v) {
  if (r.bound === 'atMost') return v > r.limit;
  if (r.bound === 'atLeast') return v < r.limit;
  return v > r.limit || v < r.lower;
}
function rangeNear(r, v) {
  if (r.bound === 'atMost') return v > r.limit - r.margin;
  if (r.bound === 'atLeast') return v < r.limit + r.margin;
  return v > r.limit - r.margin || v < r.lower + r.margin;
}
function rangeRoom(r, v) {
  if (r.bound === 'atMost') return r.limit - v;
  if (r.bound === 'atLeast') return v - r.limit;
  return Math.min(v - r.lower, r.limit - v);
}
function rangeCalc(g, week, actual, previous) {
  if (week === 0) return { calc: 'planned' };
  if (actual === null || actual === undefined) return { calc: 'none' };
  const r = g.range;
  const out = rangeOut(r, actual);
  const prevOut = previous !== null && previous !== undefined && rangeOut(r, previous);
  if (out && prevOut) return { calc: 'off', out, near: rangeNear(r, actual) };
  if (out || prevOut || rangeNear(r, actual)) return { calc: 'risk', out, near: rangeNear(r, actual) };
  return { calc: 'on', out, near: false };
}

// stages judged in week w with updates (array or null)
function stageStates(g, w, updates) {
  return g.stages.map((s) => {
    const u = updates ? updates.find((x) => x.stageId === s.id) : null;
    if (u && u.doneWeek !== null && u.doneWeek !== undefined) return { stage: s, done: true, doneWeek: u.doneWeek, expected: u.doneWeek, late: 0, state: 'done' };
    let exp = u && u.forecastWeek !== null && u.forecastWeek !== undefined ? u.forecastWeek : s.dueWeek;
    exp = Math.max(exp, s.dueWeek);
    if (s.dueWeek < w) exp = Math.max(exp, w);
    const late = exp - s.dueWeek;
    return { stage: s, done: false, expected: exp, late, state: late > 2 ? 'off' : late >= 1 ? 'risk' : 'planned' };
  });
}
function milestoneCalc(g, w, latest) {
  const st = stageStates(g, w, latest ? latest.stages : null);
  let calc;
  if (st.length && st.every((s) => s.done)) calc = 'done';
  else if (w === 0) calc = 'planned';
  else if (st.some((s) => s.state === 'off')) calc = 'off';
  else if (st.some((s) => s.state === 'risk')) calc = 'risk';
  else calc = latest ? 'on' : 'none';
  return { calc, stages: st };
}

// assessPosted: check-ins posted by today (already cut), up to week w
function assessPosted(g, posted, w, ignoreHeld = false) {
  const list = sortCk(posted.filter((c) => c.week <= w));
  const latest = list.length ? list[list.length - 1] : null;
  if (!ignoreHeld && isUnmeasured(g)) return { calc: 'none', latest, list, projection: null, unmeasured: true };
  if (g.kind === 'metric') {
    if (!latest) {
      const r = metricCalc(g, planAsOf(g, w), w, null, []);
      return { ...r, latest, list, judgedWeek: w, plan: planAt(planAsOf(g, w), w) };
    }
    const earlier = list.filter((c) => c.week < latest.week && c.value !== null && c.value !== undefined).map((c) => ({ week: c.week, value: c.value }));
    const plan = planAsOf(g, latest.week);
    const r = metricCalc(g, plan, latest.week, latest.value, earlier);
    return { ...r, latest, list, judgedWeek: latest.week, plan: planAt(plan, latest.week), planObj: plan };
  }
  if (g.kind === 'range') {
    if (!latest) return { ...rangeCalc(g, w, null, null), latest, list, judgedWeek: w };
    const prev = previousNumber(list, latest.week);
    return { ...rangeCalc(g, latest.week, latest.value, prev ? prev.value : null), latest, list, judgedWeek: latest.week };
  }
  return { ...milestoneCalc(g, w, latest), latest, list };
}

// ---------- the official status ----------
const RANK = { done: 0, planned: 0, none: 0, on: 1, risk: 2, stale: 2, off: 3, unmeasured: 0 };
const greenerThan = (call, calc) => RANK[call] < RANK[calc];

function goalBegins(g) {
  let d = Math.max(START, dayNum(g.createdAt));
  if (g.kind === 'metric' && planFrom(g.plan) > 0) d = Math.max(d, START + 7 * planFrom(g.plan));
  return d;
}
function daysWithoutUpdate(g, latest, today) {
  if (latest) return daysSince(latest.postedAt, today);
  return dayNum(today) - goalBegins(g);
}
function goalStatus(g, posted, today) {
  const latest = latestPosted(sortCk(posted));
  const week = currentWeek(today);
  const days = daysWithoutUpdate(g, latest, today);
  let status;
  if (isUnmeasured(g)) status = latest && latest.status === 'done' ? 'done' : 'unmeasured';
  else if (latest && latest.status === 'done') status = 'done';
  else if (week === 0) status = 'planned';
  else if (dayNum(today) > LAST_DAY) status = latest ? latest.status : 'none';
  else {
    const effDays = Math.min(days, dayNum(today) - RHYTHM_FROM);
    if (CHECKIN_WEEKS === 0 || effDays < STALE_DAYS) status = latest ? latest.status : 'none';
    else status = 'stale';
  }
  return { status, latest, days, week };
}

// ---------- the trend ----------
function gapTrend(gaps, needShort) {
  if (gaps.length < 3) return 'flat';
  const [a, b, c] = gaps.slice(-3);
  if (b - a < -EPS && c - b < -EPS && (!needShort || c < -EPS)) return 'worse';
  if (b - a > EPS && c - b > EPS) return 'better';
  return 'flat';
}
function trendOf(g, posted) {
  const list = sortCk(posted);
  if (g.kind === 'metric') {
    const nums = list.filter((c) => c.value !== null && c.value !== undefined);
    const dir = g.plan.target >= g.plan.start ? 1 : -1;
    const gaps = nums.map((c) => (c.value - planAt(planAsOf(g, c.week), c.week)) * dir);
    let t = gapTrend(gaps, true);
    const d = g.decimals ?? 0;
    if (t === 'worse') {
      const [g1, , g3] = gaps.slice(-3);
      if (!(rd(g3, d) < 0 && rd(g1, d) > rd(g3, d))) t = 'flat';
    }
    if (t !== 'worse' && nums.length >= 3) {
      const last = nums[nums.length - 1];
      const earlier = nums.filter((c) => c.week < last.week).map((c) => ({ week: c.week, value: c.value }));
      const r = metricCalc(g, g.plan, last.week, last.value, earlier);
      if (r.calc === 'on' && r.projection) {
        const pdir = Math.sign(g.plan.target - g.plan.start);
        const tgt = rd(g.plan.target, d);
        const val = rd(r.projection.value, d);
        const bestEnd = rd(pdir > 0 ? r.projection.high : r.projection.low, d);
        if ((tgt - val) * pdir > EPS && (tgt - bestEnd) * pdir > EPS) t = 'worse';
      }
    }
    return t;
  }
  if (g.kind === 'range') {
    const nums = list.filter((c) => c.value !== null && c.value !== undefined);
    return gapTrend(nums.map((c) => rangeRoom(g.range, c.value)), false);
  }
  const withStages = list.filter((c) => c.stages);
  if (withStages.length < 2) return 'flat';
  const prev = withStages[withStages.length - 2], cur = withStages[withStages.length - 1];
  const sp = stageStates(g, prev.week, prev.stages), sc = stageStates(g, cur.week, cur.stages);
  let better = false;
  for (let i = 0; i < sc.length; i++) {
    const a = sp[i], b = sc[i];
    if (!b.done && b.expected > a.expected) return 'worse';
  }
  for (let i = 0; i < sc.length; i++) {
    const a = sp[i], b = sc[i];
    if (b.done && !a.done && b.doneWeek < a.expected) better = true;
    if (!b.done && b.expected < a.expected) better = true;
  }
  return better ? 'better' : 'flat';
}

// ---------- flags ----------
const FLAG_ORDER = ['off', 'missed-path', 'stale', 'decision', 'no-path', 'risk', 'trend', 'greener', 'due'];
function firstDueWeek(g) {
  let w = firstWeekOnOrAfter(dayNum(g.createdAt));
  if (g.kind === 'metric') w = Math.max(w, planFrom(g.plan));
  if (cycle.rhythmFrom) w = Math.max(w, firstWeekOnOrAfter(RHYTHM_FROM));
  return Math.max(1, w);
}
function flagsFor(g, ws, today) {
  const posted = ws.ckByGoal.get(g.id) || [];
  const st = goalStatus(g, posted, today);
  const { status, latest, week } = st;
  const behind = status === 'off' || status === 'risk';
  const done = status === 'done';
  const f = new Set();
  if (status === 'off') f.add('off');
  if (status === 'stale') f.add('stale');
  const path = latest ? latest.pathToGreen : null;
  if (behind && path && path.byWeek !== null && path.byWeek !== undefined && path.byWeek < week) f.add('missed-path');
  if (!done && ws.asks.some((a) => a.kind === 'decision' && a.status === 'open' && a.goalIds.includes(g.id))) f.add('decision');
  if (behind && latest && !latest.pathToGreen) f.add('no-path');
  if (status === 'risk') f.add('risk');
  if (!done && !isUnmeasured(g) && trendOf(g, posted) === 'worse') f.add('trend');
  if (!done && latest && greenerThan(latest.status, latest.calculated) && status !== 'stale' && !isUnmeasured(g)) f.add('greener');
  if (CHECKIN_WEEKS !== 0 && week >= firstDueWeek(g) && !done && !isUnmeasured(g) && dayNum(today) <= LAST_DAY && !posted.some((c) => c.week === week)) f.add('due');
  return { flags: FLAG_ORDER.filter((x) => f.has(x)), st };
}
function handledFor(g, ws, today, fl) {
  const { status, latest, week } = fl.st;
  if (!(status === 'off' || status === 'risk') || !latest) return null;
  const todayDay = dayNum(today);
  const events = [];
  for (const a of ws.asks) {
    if (!a.goalIds.includes(g.id)) continue;
    if (a.kind === 'action' && a.status === 'open' && a.dueWeek !== null && a.dueWeek !== undefined && a.createdAt > latest.postedAt && dayNum(a.createdAt) <= todayDay && !(a.dueWeek < week))
      events.push({ kind: 'action', at: a.createdAt });
    if (status === 'risk' && a.kind === 'decision' && a.status === 'answered' && a.answeredAt && a.answeredAt > latest.postedAt && dayNum(a.answeredAt) <= todayDay)
      events.push({ kind: 'answered', at: a.answeredAt });
  }
  if (!events.length) return null;
  const earliest = events.reduce((m, e) => (e.at < m ? e.at : m), events[0].at);
  const then = new Set(flagsFor(g, ws, earliest).flags);
  if (fl.flags.some((x) => x !== 'due' && !then.has(x))) return null;
  return events.some((e) => e.kind === 'action') ? 'action' : 'answered';
}

// ---------- the scorecard ----------
function likelihood(mark, proj, better, floor) {
  const half = Math.max((proj.high - proj.low) / 2, floor, EPS);
  const d = ((mark - proj.value) * better) / half;
  return d <= -0.5 ? 'likely' : d <= 1 ? 'possible' : d <= 2 ? 'unlikely' : 'very-unlikely';
}
const hitTone = (l) => (l === 'likely' ? 'good' : l === 'possible' ? 'flat' : 'bad');
function sinceCell(g, list, better) {
  if (!list.length) return 'flat';
  const latest = list[list.length - 1];
  if (latest.value === null || latest.value === undefined) return 'flat';
  const before = previousNumber(list, latest.week);
  if (!before) return 'flat';
  const d = g.decimals ?? 0;
  if (g.kind === 'range' && g.range.bound === 'between') {
    const gain = rd(rangeRoom(g.range, latest.value) - rangeRoom(g.range, before.value), d);
    const delta = rd(latest.value - before.value, d);
    if (delta === 0) return 'flat';
    return gain > 0 ? 'good' : gain < 0 ? 'bad' : 'flat';
  }
  const delta = rd(latest.value - before.value, d);
  if (delta === 0) return 'flat';
  return delta * better > 0 ? 'good' : 'bad';
}
function doneCheckIn(posted, w) {
  const list = sortCk(posted.filter((c) => c.week <= w));
  const l = latestPosted(list);
  return l && l.status === 'done' ? l : null;
}
function rangeSeries(posted, w) {
  const byWeek = new Map();
  for (const c of sortCk(posted.filter((c) => c.week <= w && c.value !== null && c.value !== undefined))) {
    const prev = byWeek.get(c.week);
    if (!prev || c.postedAt >= prev.postedAt) byWeek.set(c.week, c);
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week).map((c) => ({ week: c.week, value: c.value }));
}
function rangeProjection(g, posted, w) {
  return hold(project(rangeSeries(posted, w), WEEKS), g, w);
}
function scorecard(g, posted, w, stale) {
  const cells = [];
  const d = g.decimals ?? 0;
  const half10 = 0.5 * Math.pow(10, -d);
  const done = doneCheckIn(posted, w);
  if (g.kind === 'metric') {
    const a = assessPosted(g, posted, w, true);
    const cur = g.plan;
    const better = cur.target >= cur.start ? 1 : -1;
    const actual = a.latest ? a.latest.value : null;
    const hasNum = actual !== null && actual !== undefined;
    let tone = 'flat';
    if (hasNum) { const diff = rd((actual - a.plan) * better, d); tone = diff > 0 ? 'good' : diff < 0 ? 'bad' : 'flat'; }
    cells.push(['plan', tone, '']);
    cells.push(['since', sinceCell(g, a.list, better), '']);
    let tt = 'flat';
    if (hasNum) { const left = rd((cur.target - actual) * better, d); tt = left <= 0 ? 'good' : 'flat'; }
    cells.push(['target', tt, '']);
    if (g.stoppedAt) { /* a stopped goal has no hit cell */ }
    else if (done) cells.push(['result', 'good', '']);
    else if (stale || !a.projection || isUnmeasured(g)) cells.push(['hit', 'flat', '']);
    else {
      const floor = Math.max(0.02 * Math.abs(cur.target - cur.start), half10);
      const l = likelihood(cur.target, a.projection, better, floor);
      cells.push(['hit', hitTone(l), l]);
    }
    return { cells, a };
  }
  if (g.kind === 'range') {
    const r = g.range;
    const a = assessPosted(g, posted, w, true);
    const actual = a.latest ? a.latest.value : null;
    const hasNum = actual !== null && actual !== undefined;
    let better, limit;
    if (r.bound === 'atLeast') { better = 1; limit = r.limit; }
    else if (r.bound === 'atMost') { better = -1; limit = r.limit; }
    else if (hasNum && Math.abs(actual - r.lower) < Math.abs(r.limit - actual)) { better = 1; limit = r.lower; }
    else { better = -1; limit = r.limit; }
    let lt = 'flat';
    if (hasNum) lt = rangeOut(r, actual) ? 'bad' : rangeNear(r, actual) ? 'flat' : 'good';
    cells.push(['limit', lt, '']);
    cells.push(['since', sinceCell(g, a.list, better), '']);
    let rt = 'flat';
    if (hasNum) {
      const room = rd((limit - actual) * -better, d);
      rt = room < 0 ? 'bad' : room === 0 || rangeNear(r, actual) ? 'flat' : 'good';
    }
    cells.push(['room', rt, '']);
    const proj = rangeProjection(g, posted, w);
    if (g.stoppedAt) { /* a stopped goal has no hit cell */ }
    else if (done) cells.push(['result', 'good', '']);
    else if (stale || !proj || isUnmeasured(g)) cells.push(['hit', 'flat', '']);
    else {
      let mark = r.limit, b = r.bound === 'atLeast' ? 1 : -1;
      if (r.bound === 'between' && proj.value < (r.lower + r.limit) / 2) { mark = r.lower; b = 1; }
      const base = r.margin ? Math.abs(r.margin) : Math.abs(0.1 * r.limit);
      const floor = Math.max(0.02 * base, half10);
      const l = likelihood(mark, proj, b, floor);
      cells.push(['hit', hitTone(l), l]);
    }
    return { cells, a, proj };
  }
  const list = sortCk(posted.filter((c) => c.week <= w));
  const latest = list.length ? list[list.length - 1] : null;
  const st = stageStates(g, w, latest ? latest.stages : null);
  const nDone = st.filter((s) => s.done).length;
  const nDue = st.filter((s) => s.stage.dueWeek <= w).length;
  cells.push(['done', nDone >= nDue ? 'good' : 'flat', '']);
  const late = st.filter((s) => !s.done && s.late > 0);
  cells.push(['late', late.length ? 'bad' : 'good', '']);
  const left = st.filter((s) => !s.done);
  if (!left.length) cells.push(['next', 'good', '']);
  else {
    let nx = left[0];
    for (const s of left) if (s.stage.dueWeek < nx.stage.dueWeek) nx = s;
    cells.push(['next', nx.expected > nx.stage.dueWeek ? 'bad' : 'flat', '']);
  }
  return { cells };
}

// ---------- what a check-in must say ----------
function typedDecimals(v) {
  const s = String(v);
  if (/e/i.test(s)) return 0;
  const i = s.indexOf('.');
  if (i < 0) return 0;
  return s.slice(i + 1).replace(/0+$/, '').length;
}
function valueCode(g, week, v) {
  if (v === null || v === undefined) return 'value';
  if (typedDecimals(v) > (g.decimals ?? 0)) return 'value-precision';
  if (v < 0 && (usuallyPositive(g) || isCount(g, week))) return 'value-impossible';
  if (v > 100 && isShare(g, week)) return 'value-impossible';
  return null;
}
function evaluate(g, c, all) {
  const earlier = sortCk(all.filter((x) => x.week < c.week));
  const out = { calc: 'on', reason: '', asksTarget: false, missingBare: [], missingCall: [], greener: false };
  let calc, reason = '';
  const valCode = g.kind === 'milestone' ? null : valueCode(g, c.week, c.value);
  if (g.kind === 'metric') {
    const nums = earlier.filter((x) => x.value !== null && x.value !== undefined).map((x) => ({ week: x.week, value: x.value }));
    const r = metricCalc(g, planAsOf(g, c.week), c.week, c.value, nums);
    calc = r.calc;
    if (r.calc !== 'none' && r.calc !== 'planned') {
      if (r.wellAhead) reason = 'ahead';
      else if (r.behind) reason = 'behind';
    }
    out.asksTarget = r.wellAhead;
  } else if (g.kind === 'range') {
    const prev = previousNumber(earlier, c.week);
    calc = rangeCalc(g, c.week, c.value, prev ? prev.value : null).calc;
    if (calc === 'risk' || calc === 'off') reason = 'behind';
  } else {
    calc = milestoneCalc(g, c.week, c).calc;
    if (calc === 'risk' || calc === 'off') reason = 'behind';
  }
  if (calc === 'planned' || calc === 'none') calc = 'on';
  out.calc = calc;
  out.reason = reason;
  const missing = (call) => {
    const m = [];
    if (valCode) m.push(valCode);
    if (greenerThan(call, calc)) m.push('greener-why');
    if (reason) m.push(reason === 'ahead' ? 'reason-ahead' : 'reason-behind');
    if (call === 'risk' || call === 'off') m.push('path');
    return m;
  };
  out.needsPath = calc === 'risk' || calc === 'off';
  out.missingBare = missing(calc);
  out.greener = greenerThan(c.status, calc);
  out.missingCall = missing(c.status);
  return out;
}
function momentOf(g, c, all) {
  if (c.backfilled) return '';
  const earlier = all.filter((x) => x !== c && !x.removedAt && (x.postedAt < c.postedAt || (x.postedAt === c.postedAt && x.week < c.week)));
  if (earlier.some((x) => x.week === c.week)) return '';
  const before = sortCk(earlier.filter((x) => x.week < c.week));
  const lastOfWeek = new Map();
  for (const x of before) lastOfWeek.set(x.week, x);
  const weeks = [...lastOfWeek.keys()].sort((a, b) => a - b);
  const wb = weeks.length ? lastOfWeek.get(weeks[weeks.length - 1]) : null;
  if (g.kind === 'metric' && c.value !== null && c.value !== undefined) {
    const p = planAsOf(g, c.week);
    if (p.start !== p.target) {
      const meets = (v) => (p.target > p.start ? v >= p.target : v <= p.target);
      if (meets(c.value) && (!wb || wb.value === null || wb.value === undefined || !meets(wb.value))) return 'reached';
    }
  }
  if (c.status === 'on' && wb && (wb.status === 'risk' || wb.status === 'off')) {
    let from = wb.week;
    for (let i = weeks.length - 1; i >= 0; i--) {
      const x = lastOfWeek.get(weeks[i]);
      if (x.status === 'risk' || x.status === 'off') from = weeks[i]; else break;
    }
    const k = c.week - from;
    if (k >= 2) return `back ${k}`;
  }
  return '';
}

// ---------- the workspace as it stood ----------
const goalNum = (k) => Number(String(k).replace(/^\D+/, ''));
const liveCk = (W.checkIns || []).filter((c) => !c.removedAt);
const allGoals = (W.goals || []).filter((g) => !g.removedAt);
function asOf(m) {
  const allGoals = (W.goals || []).filter((g) => !g.removedAt);
  const liveCk = (W.checkIns || []).filter((c) => !c.removedAt);
  const goals = allGoals.filter((g) => g.createdAt <= m && !(g.stoppedAt && g.stoppedAt <= m) && !g.proposedAt).sort((a, b) => goalNum(a.key) - goalNum(b.key));
  const ckByGoal = new Map();
  for (const c of liveCk) if (c.postedAt <= m) { if (!ckByGoal.has(c.goalId)) ckByGoal.set(c.goalId, []); ckByGoal.get(c.goalId).push(c); }
  const asks = (W.requests || []).filter((a) => !a.removedAt && a.createdAt <= m).map((a) => {
    if ((a.status === 'answered' || a.status === 'done') && !(a.answeredAt && a.answeredAt <= m)) return { ...a, status: 'open', answer: null, answeredAt: null, answeredBy: null };
    if (a.status === 'withdrawn' && a.updatedAt > m) return { ...a, status: 'open' };
    return a;
  });
  return { goals, ckByGoal, asks };
}

// ---------- write ----------
const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
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
if (globalThis.__captureS1) globalThis.__captureS1({ W, START, WEEKS, LAST_DAY, dayNum, isoOfDay, currentWeek, weekMoment, planAt, planAsOf, metricCalc, rangeCalc, milestoneCalc,
  previousNumber, sortCk, isShare, isCount, usuallyPositive, typedDecimals, greenerThan, csvCell, evaluate, asOf, flagsFor, handledFor, firstDueWeek, goalStatus, assessPosted, scorecard });
else if (fs.existsSync(casesPath)) {
  const { runCases } = await import('./engine.mjs');
  runCases({
    W, cases: JSON.parse(fs.readFileSync(casesPath, 'utf8')), outDir,
    S1: { START, WEEKS, LAST_DAY, dayNum, isoOfDay, currentWeek, weekMoment, planAt, planAsOf, metricCalc, rangeCalc, milestoneCalc,
      previousNumber, sortCk, isShare, isCount, usuallyPositive, typedDecimals, greenerThan, csvCell, evaluate, asOf, flagsFor, handledFor, firstDueWeek, goalStatus, assessPosted, scorecard },
  });
}

// ---------- stage 3: the screens' words that are rules ----------
if (!globalThis.__captureS1) {
  const S1x = { START, WEEKS, LAST_DAY, dayNum, isoOfDay, currentWeek, weekMoment, planAt, planAsOf, metricCalc, rangeCalc, milestoneCalc,
    previousNumber, sortCk, isShare, isCount, usuallyPositive, typedDecimals, greenerThan, csvCell, evaluate, asOf, flagsFor, handledFor, firstDueWeek, goalStatus, assessPosted, scorecard };
  if (W.people && W.reviews && W.builtFor && !/edge/.test(String(W.about))) try {
    const { writeStage3 } = await import('./stage3.mjs');
    const { readBackRow, READBACK_CASES } = await import('./readback.mjs');
    const inputs = JSON.parse(fs.readFileSync(new URL('./drill-inputs.json', import.meta.url), 'utf8'));
    writeStage3(W, S1x, outDir, { ...inputs, readback: inputs.readback || READBACK_CASES, readBackRow });
  } catch (e) { console.error("stage 3:", e.stack); process.exitCode = 1;
  }
}
