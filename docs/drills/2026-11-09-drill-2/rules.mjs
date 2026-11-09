// Stage 1: the core rules, as pure functions. No I/O here.

/* ---------- dates and weeks ---------- */
const DAY = 86400000;
export const dateOf = (iso) => iso.slice(0, 10);
const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
export const daysSince = (from, to) => dayNum(dateOf(to)) - dayNum(dateOf(from));
export function currentWeek(cycle, moment) {
  const d = daysSince(cycle.startDate, moment);
  return Math.max(0, Math.min(cycle.weeks, Math.floor(d / 7)));
}
export const weekDate = (cycle, w) => new Date((dayNum(cycle.startDate) + 7 * w) * DAY).toISOString().slice(0, 10);
export const weekMoment = (cycle, w) => new Date((dayNum(cycle.startDate) + 7 * w + cycle.reviewDay) * DAY + 12 * 3600000).toISOString();

/** The first week a goal's check-in is due. */
export function firstDueWeek(cycle, createdAt) {
  if (!createdAt || dateOf(createdAt) < cycle.startDate) return 1;
  for (let w = 1; w <= cycle.weeks; w++) {
    const reviewDate = new Date((dayNum(cycle.startDate) + 7 * w + cycle.reviewDay) * DAY).toISOString().slice(0, 10);
    if (reviewDate >= dateOf(createdAt)) return w;
  }
  return cycle.weeks;
}

/* ---------- plans ---------- */
export function shapeProgress(shape, w, n) {
  w = Math.max(0, Math.min(n, w));
  if (n <= 0) return 1;
  if (shape === 'back') return Math.pow(w / n, 1.5);
  if (shape === 'stepped') {
    const steps = [Math.floor(n / 3) + 1, Math.floor((2 * n) / 3) + 1, n];
    return steps.filter((s) => w >= s).length / 3;
  }
  return w / n;
}
export function planAt(plan, week, cycleWeeks) {
  const end = plan.endWeek ?? cycleWeeks;
  const from = Math.min(plan.fromWeek ?? 0, end - 1);
  if (week <= from) return plan.start;
  if (week >= end) return plan.target;
  if (plan.points && plan.points.length) {
    const knots = [{ week: from, value: plan.start }, ...plan.points.filter((p) => p.week > from && p.week < end).sort((a, b) => a.week - b.week), { week: end, value: plan.target }];
    for (let i = 1; i < knots.length; i++) {
      if (week <= knots[i].week) {
        const a = knots[i - 1], b = knots[i];
        return a.value + ((b.value - a.value) * (week - a.week)) / (b.week - a.week);
      }
    }
    return plan.target;
  }
  return plan.start + (plan.target - plan.start) * shapeProgress(plan.shape, week - from, end - from);
}
export function planHistoryOf(goal) {
  if (goal.planHistory) return goal.planHistory;
  if (goal.originalPlan && goal.rebaselinedWeek != null) return [{ untilWeek: goal.rebaselinedWeek, plan: goal.originalPlan }];
  return [];
}
export function planAsOf(goal, week) {
  for (const h of planHistoryOf(goal)) if (h.untilWeek > week) return h.plan;
  return goal.plan;
}
export const planEnd = (plan, cycle) => plan.endWeek ?? cycle.weeks;

/* ---------- numbers ---------- */
export const roundTo = (x, d) => Number(x.toFixed(d));
const round9 = (x) => Math.round(x * 1e9) / 1e9;
export function groupDigits(s) {
  const neg = s.startsWith('-');
  const [i, f] = (neg ? s.slice(1) : s).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + g + (f !== undefined ? '.' + f : '');
}
export function fixed(v, d) {
  return groupDigits(v.toFixed(d));
}

/* ---------- projection ---------- */
export function isShare(unit, nums) {
  return (unit ?? '').trim() === '%' && nums.every((n) => n >= 0 && n <= 100);
}
const COUNT_UNIT = /^(days?|hours?|hrs?|mins?|minutes?|weeks?|secs?|seconds?|ms|pts?|points?|score|nps)$|usd|gbp|eur|\$|£|€|°/;
export function isCount(unit, decimals, nums) {
  const u = (unit ?? '').trim().toLowerCase();
  return decimals === 0 && nums.every((n) => Number.isInteger(n) && n >= 0) && u !== '%' && !COUNT_UNIT.test(u);
}
/** series: [{week,value}] oldest first. Returns null or {value,low,high,slope,from,to,week}. */
export function projection(series, T) {
  if (!series.length) return null;
  const last = series[series.length - 1];
  let pts = series.filter((p) => p.week > last.week - 8);
  if (last.week - pts[0].week < 3) {
    let idx = -1;
    for (let i = series.length - 1; i >= 0; i--) if (series[i].week <= last.week - 3) { idx = i; break; }
    if (idx < 0) return null;
    pts = series.slice(idx);
  }
  const n = pts.length;
  const xb = pts.reduce((s, p) => s + p.week, 0) / n;
  const yb = pts.reduce((s, p) => s + p.value, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.week - xb) ** 2, 0);
  const slope = pts.reduce((s, p) => s + (p.week - xb) * (p.value - yb), 0) / sxx;
  const icpt = yb - slope * xb;
  const spread = n > 2 ? Math.sqrt(pts.reduce((s, p) => s + (p.value - (icpt + slope * p.week)) ** 2, 0) / (n - 2)) : 0;
  let lean;
  if (spread < 1e-12) lean = 1;
  else { const t = slope / (spread / Math.sqrt(sxx)); lean = (t * t) / (1 + t * t); }
  const value = yb + lean * slope * (T - xb);
  const half = spread * Math.sqrt(1 / n + (T - xb) ** 2 / sxx);
  return { value: round9(value), low: round9(value - half), high: round9(value + half), slope: round9(lean * slope), from: pts[0].week, to: last.week, week: T };
}
/** projectionFor: held to what the number can be. planNums: the plan numbers of the goal as projected. */
export function projectionFor(goal, planNums, series, T) {
  const p = projection(series, T);
  if (!p) return null;
  if (isShare(goal.unit, planNums)) {
    for (const k of ['value', 'low', 'high']) p[k] = Math.max(0, Math.min(100, p[k]));
  } else if (isCount(goal.unit, goal.decimals, planNums)) {
    for (const k of ['value', 'low', 'high']) p[k] = Math.max(0, p[k]);
  }
  return p;
}
const planNumsOf = (plan) => [plan.start, plan.target, ...(plan.points ?? []).map((p) => p.value)];

/** One number per week, the latest posted in each week wins; only check-ins with a number. */
export function valueSeries(cis) {
  const byWeek = new Map();
  for (const c of cis) {
    if (c.value == null) continue;
    const cur = byWeek.get(c.week);
    if (!cur || c.postedAt >= cur.postedAt) byWeek.set(c.week, c);
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week).map((c) => ({ week: c.week, value: c.value }));
}

/* ---------- status ---------- */
export const RULES = { onTrack: 0.95, atRisk: 0.8, wellAhead: 1.2, staleDays: 14, lateWeeksOff: 2 };
export const RANK = { done: 0, planned: 0, none: 0, on: 1, risk: 2, stale: 2, off: 3 };
export const isGreener = (call, calc) => RANK[call] < RANK[calc];
const byWeekThenPosted = (a, b) => a.week - b.week || (a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0);
export const sortCis = (cis) => cis.map((c, i) => [c, i]).sort((x, y) => byWeekThenPosted(x[0], y[0]) || x[1] - y[1]).map((x) => x[0]);

/** A number to move, in `week`, with `actual`. series: [{week,value}] earlier numbers plus this one. */
export function assessMetric(goal, plan, cycle, week, actual, series) {
  const res = { status: 'none', ratio: null, behind: false, wellAhead: false, plan: planAt(plan, week, cycle.weeks), actual, week, projection: null, forecastMisses: false, planObj: plan };
  if (week === 0) { res.status = 'planned'; return res; }
  if (actual == null) return res;
  const { start, target } = plan;
  const dir = Math.sign(target - start) || 1;
  const planned = res.plan - start;
  const toWeek = planEnd(plan, cycle);
  const proj = () => {
    const p = projectionFor(goal, planNumsOf(plan), series, toWeek);
    res.projection = p;
    res.forecastMisses = !!p && (target - p.value) * dir > 0;
  };
  if (Math.abs(planned) < 1e-9) {
    if ((actual - start) * dir < 0) { res.status = 'risk'; res.behind = true; } else res.status = 'on';
    proj();
    return res;
  }
  const ratioOf = (v) => round9((v - start) / planned);
  const ratio = ratioOf(actual);
  res.ratio = ratio;
  // on plan as written
  const d = goal.decimals;
  const step = Math.pow(10, -d);
  const a = start + planned * 0.95, b = start + planned * 1.2;
  let writable = Math.abs(b - a) >= step;
  if (!writable) {
    const k0 = Math.floor(Math.min(a, b) / step) - 1, k1 = Math.ceil(Math.max(a, b) / step) + 1;
    for (let k = k0; k <= k1; k++) {
      const v = roundTo(k * step, d);
      const r = ratioOf(v);
      if (r >= 0.95 && r < 1.2) { writable = true; break; }
    }
  }
  if (Math.abs(actual - roundTo(res.plan, d)) < 1e-9 && !writable) {
    res.status = 'on'; res.ratio = 1;
  } else {
    res.status = ratio >= RULES.onTrack ? 'on' : ratio >= RULES.atRisk ? 'risk' : 'off';
    res.wellAhead = ratio >= RULES.wellAhead;
    res.behind = ratio < RULES.onTrack;
  }
  proj();
  return res;
}

export function assessRange(range, week, actual, previous) {
  const res = { status: 'none', out: false, near: false, actual, week };
  if (week === 0) { res.status = 'planned'; return res; }
  if (actual == null) return res;
  const { bound, limit, margin } = range;
  const isOut = (v) => (bound === 'atMost' ? v > limit : v < limit);
  const isNear = (v) => (bound === 'atMost' ? v > limit - margin : v < limit + margin);
  const out = isOut(actual), near = isNear(actual);
  const prevOut = previous != null && isOut(previous);
  res.out = out; res.near = near;
  if (out && prevOut) res.status = 'off';
  else if (out || prevOut || near) res.status = 'risk';
  else res.status = 'on';
  return res;
}

/** Per-stage assessment in `week` from the stage updates. */
export function stageStates(goal, week, updates) {
  return goal.stages.map((st) => {
    const u = (updates ?? []).find((x) => x.stageId === st.id);
    if (u && u.doneWeek != null) return { stage: st, done: true, doneWeek: u.doneWeek, expected: u.doneWeek, late: Math.max(0, u.doneWeek - st.dueWeek), state: 'done' };
    let exp = u && u.forecastWeek != null ? u.forecastWeek : st.dueWeek;
    exp = Math.max(exp, st.dueWeek);
    if (st.dueWeek < week) exp = Math.max(exp, week);
    const late = exp - st.dueWeek;
    return { stage: st, done: false, doneWeek: null, expected: exp, late, state: late > RULES.lateWeeksOff ? 'off' : late >= 1 ? 'risk' : 'planned' };
  });
}
export function assessMilestone(goal, week, updates) {
  const states = stageStates(goal, week, updates);
  let status;
  if (states.length && states.every((s) => s.done)) status = 'done';
  else if (week === 0) status = 'planned';
  else if (states.some((s) => s.state === 'off')) status = 'off';
  else if (states.some((s) => s.state === 'risk')) status = 'risk';
  else status = 'on';
  return { status, states };
}

/** The calculation from what has been posted, in week w. cis: this goal's check-ins posted by today. */
export function assessPosted(goal, cycle, cis, w) {
  const upto = sortCis(cis.filter((c) => c.week <= w));
  const latest = upto[upto.length - 1];
  if (goal.kind === 'metric') {
    if (!latest) return assessMetric(goal, planAsOf(goal, w), cycle, w, null, []);
    const series = upto.filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value }));
    return assessMetric(goal, planAsOf(goal, latest.week), cycle, latest.week, latest.value, series);
  }
  if (goal.kind === 'range') {
    const vs = valueSeries(upto);
    if (!latest) { const r = assessRange(goal.range, w, null, null); r.series = vs; r.projection = null; return r; }
    let prev = null;
    for (let i = upto.length - 1; i >= 0; i--) if (upto[i].week < latest.week && upto[i].value != null) { prev = upto[i].value; break; }
    const r = assessRange(goal.range, latest.week, latest.value, prev);
    r.projection = vs.length ? projectionFor(goal, [goal.range.limit], vs, cycle.weeks) : null;
    r.series = vs;
    return r;
  }
  const r = assessMilestone(goal, w, latest ? latest.stages : null);
  if (!latest && r.status === 'on') r.status = 'none';
  return r;
}

export function latestPosted(cis) {
  let best = null;
  cis.forEach((c) => { if (!best || c.postedAt >= best.postedAt) best = c; });
  return best;
}
export function daysWithoutUpdate(goal, cycle, cis, today) {
  const latest = latestPosted(cis);
  if (latest) return daysSince(latest.postedAt, today);
  const began = goal.createdAt && dateOf(goal.createdAt) > cycle.startDate ? goal.createdAt : cycle.startDate;
  return daysSince(began, today);
}
export function goalStatus(goal, cycle, cis, today) {
  const week = currentWeek(cycle, today);
  const latest = latestPosted(cis);
  if (latest && latest.status === 'done') return 'done';
  if (week === 0) return 'planned';
  if (daysWithoutUpdate(goal, cycle, cis, today) < RULES.staleDays) return latest ? latest.status : 'none';
  return 'stale';
}

/* ---------- trend ---------- */
export function gapTrend(gaps, needShort = false) {
  if (gaps.length < 3) return 'flat';
  const [a, b, c] = gaps.slice(-3);
  const d1 = b - a, d2 = c - b;
  if (d1 < -1e-9 && d2 < -1e-9) return needShort && !(c < -1e-9) ? 'flat' : 'worse';
  if (d1 > 1e-9 && d2 > 1e-9) return 'better';
  return 'flat';
}
export function goalTrend(goal, cycle, cis) {
  const sorted = sortCis(cis);
  if (goal.kind === 'metric') {
    const withNum = sorted.filter((c) => c.value != null);
    const dir = goal.plan.target > goal.plan.start ? 1 : -1;
    const gaps = withNum.map((c) => (c.value - planAt(planAsOf(goal, c.week), c.week, cycle.weeks)) * dir);
    const t = gapTrend(gaps, true);
    if (t !== 'worse' && withNum.length >= 3) {
      const latest = withNum[withNum.length - 1];
      const series = withNum.map((c) => ({ week: c.week, value: c.value }));
      const a = assessMetric(goal, goal.plan, cycle, latest.week, latest.value, series);
      if (a.status === 'on' && a.forecastMisses) return 'worse';
    }
    return t;
  }
  if (goal.kind === 'range') {
    const withNum = sorted.filter((c) => c.value != null);
    const sign = goal.range.bound === 'atMost' ? -1 : 1;
    return gapTrend(withNum.map((c) => (c.value - goal.range.limit) * sign));
  }
  const withSt = sorted.filter((c) => c.stages);
  if (withSt.length < 2) return 'flat';
  const prev = withSt[withSt.length - 2], cur = withSt[withSt.length - 1];
  const ps = stageStates(goal, prev.week, prev.stages), cs = stageStates(goal, cur.week, cur.stages);
  let worse = false, better = false;
  for (let i = 0; i < cs.length; i++) {
    const p = ps[i], c = cs[i];
    if (!c.done && c.expected > p.expected) worse = true;
    if (c.done && !p.done && c.doneWeek < p.expected) better = true;
    if (!c.done && c.expected < p.expected) better = true;
  }
  return worse ? 'worse' : better ? 'better' : 'flat';
}

/* ---------- asks, flags, attention ---------- */
export const FLAG_ORDER = ['off', 'missed-path', 'stale', 'decision', 'no-path', 'risk', 'trend', 'greener', 'due'];

/** ctx: { cycle, cis (this goal, posted by the moment), asks (as of), decisions (as of), trend } */
export function flagsFor(goal, ctx, today) {
  const { cycle, cis, asks } = ctx;
  const week = currentWeek(cycle, today);
  const status = goalStatus(goal, cycle, cis, today);
  const latest = latestPosted(cis);
  const behind = status === 'off' || status === 'risk';
  const f = new Set();
  if (status === 'off') f.add('off');
  if (status === 'stale') f.add('stale');
  if (behind && latest && latest.pathToGreen && latest.pathToGreen.byWeek != null && latest.pathToGreen.byWeek < week) f.add('missed-path');
  if (status !== 'done' && asks.some((a) => a.kind === 'decision' && a.status === 'open' && a.goalIds.includes(goal.id))) f.add('decision');
  if (behind && latest && !latest.pathToGreen) f.add('no-path');
  if (status === 'risk') f.add('risk');
  if (status !== 'done' && ctx.trend === 'worse') f.add('trend');
  if (status !== 'done' && latest && isGreener(latest.status, latest.calculated) && status !== 'stale') f.add('greener');
  if (week >= 1 && week >= firstDueWeek(cycle, goal.createdAt) && status !== 'done' && !cis.some((c) => c.week === week)) f.add('due');
  return FLAG_ORDER.filter((x) => f.has(x));
}

export function handledFor(goal, ctx, today) {
  const { cycle, cis, asks, decisions } = ctx;
  const status = goalStatus(goal, cycle, cis, today);
  const latest = latestPosted(cis);
  if (!latest || (status !== 'off' && status !== 'risk')) return null;
  const week = currentWeek(cycle, today);
  const after = (t) => t > latest.postedAt && dateOf(t) <= dateOf(today);
  const looks = [];
  for (const d of decisions) {
    if (d.goalId !== goal.id || d.byId === goal.ownerId || d.removedAt) continue;
    if (d.kind === 'acknowledge' && after(d.at)) looks.push({ kind: 'reviewed', at: d.at });
    if (d.kind === 'note' && after(d.at)) looks.push({ kind: 'noted', at: d.at });
  }
  for (const a of asks) {
    if (!a.goalIds.includes(goal.id)) continue;
    if (a.kind === 'action' && a.status === 'open' && after(a.createdAt) && !(a.dueWeek != null && a.dueWeek < week)) looks.push({ kind: 'action', at: a.createdAt });
    if (a.kind === 'decision' && a.status === 'answered' && a.answeredAt && after(a.answeredAt)) looks.push({ kind: 'answered', at: a.answeredAt });
  }
  if (!looks.length) return null;
  const earliest = looks.reduce((m, l) => (l.at < m ? l.at : m), looks[0].at);
  const then = new Set(flagsFor(goal, ctx, earliest));
  const now = flagsFor(goal, ctx, today).filter((x) => x !== 'due');
  if (now.some((x) => !then.has(x))) return null;
  for (const k of ['action', 'answered', 'noted', 'reviewed']) if (looks.some((l) => l.kind === k)) return k;
  return null;
}

/* ---------- the scorecard ---------- */
export function byWeekWords(due, cycle) {
  if (due >= cycle.weeks) return cycle.weeks >= 48 ? 'by year end' : 'by cycle end';
  return `by week ${due}`;
}
function nOf(v, d) { return fixed(v, d); }
export function fmtVal(v, goal) {
  const s = nOf(v, goal.decimals);
  const u = goal.unit ?? '';
  if (u === '') return s;
  if (u === '%') return s + '%';
  let unit = u;
  if (s === '1' && /^[a-z][a-z-]+[^s]s$/.test(u)) unit = u.slice(0, -1);
  return `${s} ${unit}`;
}
export function amount(v, goal) {
  const s = nOf(Math.abs(v), goal.decimals);
  const one = parseFloat(s.replace(/,/g, '')) === 1;
  const u = goal.unit ?? '';
  if (u === '') return s;
  if (u === '%') return `${s} ${one ? 'pt' : 'pts'}`;
  let unit = u;
  if (one && /[a-z]s$/i.test(u)) unit = u.slice(0, -1);
  return `${s} ${unit}`;
}
export function likelihood(mark, proj, better, floor) {
  const half = Math.max((proj.high - proj.low) / 2, floor, 1e-9);
  const d = ((mark - proj.value) * better) / half;
  if (d <= -0.5) return 'likely';
  if (d <= 1) return 'possible';
  if (d <= 2) return 'unlikely';
  return 'very-unlikely';
}
const LIKE_WORD = { likely: 'Likely', possible: 'Possible', unlikely: 'Unlikely', 'very-unlikely': 'Very unlikely' };
const LIKE_TONE = { likely: 'good', possible: 'flat', unlikely: 'bad', 'very-unlikely': 'bad' };

/** cis: this goal's check-ins posted by the moment (cut to week <= w here). Returns [{cell,value,tone,likelihood,label,sub}]. */
export function goalScorecard(goal, cycle, cisAll, w, stale) {
  const cis = sortCis(cisAll.filter((c) => c.week <= w));
  const latest = cis[cis.length - 1];
  const cells = [];
  const add = (cell, label, value, sub, tone, like = '') => cells.push({ cell, value, tone, likelihood: like, label, sub });

  if (goal.kind === 'milestone') {
    const r = assessPosted(goal, cycle, cis, w);
    const st = r.states;
    const done = st.filter((s) => s.done).length;
    const due = st.filter((s) => s.stage.dueWeek <= w).length;
    add('done', 'Stages done', `${done} of ${st.length}`, `${due} due by week ${w}`, done >= due ? 'good' : 'flat');
    const late = st.filter((s) => !s.done && s.late > 0);
    const most = late.reduce((m, s) => Math.max(m, s.late), 0);
    let sub = 'on schedule';
    if (late.length) {
      const nl = late.filter((s) => s.state === 'off').length, ns = late.filter((s) => s.state === 'risk').length;
      const kinds = nl && ns ? `${nl} late, ${ns} slipping` : nl ? 'late' : 'slipping';
      sub = `${kinds}, up to ${most} ${most === 1 ? 'week' : 'weeks'}`;
    }
    add('late', 'Stages behind', late.length ? String(late.length) : 'None', sub, late.length ? 'bad' : 'good');
    const left = st.filter((s) => !s.done);
    if (!left.length) {
      const m = st.reduce((mx, s) => Math.max(mx, s.doneWeek ?? 0), 0);
      add('next', 'Next stage', 'All done', `last done in week ${m}`, 'good');
    } else {
      let nx = left[0];
      for (const s of left) if (s.stage.dueWeek < nx.stage.dueWeek) nx = s;
      const after = nx.expected > nx.stage.dueWeek;
      add('next', 'Next stage', `Week ${nx.expected}`, nx.stage.name + (after ? `, due week ${nx.stage.dueWeek}` : ''), after ? 'bad' : 'flat');
    }
    return cells;
  }

  const a = assessPosted(goal, cycle, cis, w);
  const hasNum = a.actual != null;
  const d = goal.decimals;
  const better = goal.kind === 'metric' ? (goal.plan.target >= goal.plan.start ? 1 : -1) : goal.range.bound === 'atLeast' ? 1 : -1;
  const sinceCell = () => {
    let value, sub, tone = 'flat';
    const label = stale ? 'Last change' : 'Vs last week';
    if (!latest) { value = 'No check-in yet'; sub = 'nothing to compare'; }
    else if (latest.value == null) { value = 'No number this time'; sub = 'no number to compare'; }
    else {
      let before = null;
      for (let i = cis.length - 2; i >= 0; i--) if (cis[i].value != null) { before = cis[i]; break; }
      if (!before) { value = 'First check-in'; sub = 'nothing to compare yet'; }
      else {
        const delta = roundTo(latest.value - before.value, d);
        sub = `was ${fmtVal(before.value, goal)} in week ${before.week}`;
        if (delta === 0) value = 'No change';
        else if (delta * better > 0) { value = `${amount(delta, goal)} better`; tone = 'good'; }
        else { value = `${amount(delta, goal)} worse`; tone = 'bad'; }
      }
    }
    add('since', label, value, sub, tone);
  };
  const hitCell = (label, mark, floor, due) => {
    if (stale) return add('hit', label, 'Can’t say', 'no recent update to go on', 'flat');
    if (!a.projection) return add('hit', label, 'Too early to say', 'needs three weeks of numbers', 'flat');
    const lk = likelihood(mark, a.projection, better, floor);
    add('hit', label, LIKE_WORD[lk], `likely ${fmtVal(a.projection.value, goal)} ${byWeekWords(due, cycle)}`, LIKE_TONE[lk], lk);
  };
  const lastDecimalHalf = 0.5 * Math.pow(10, -d);

  if (goal.kind === 'metric') {
    const target = goal.plan.target, start = goal.plan.start, due = planEnd(goal.plan, cycle);
    if (!hasNum) add('plan', 'Vs plan', 'No value yet', `plan ${fmtVal(a.plan, goal)}`, 'flat');
    else {
      const diff = roundTo((a.actual - a.plan) * better, d);
      add('plan', 'Vs plan', diff === 0 ? 'On plan' : diff > 0 ? `${amount(diff, goal)} ahead of plan` : `${amount(diff, goal)} behind plan`,
        `plan ${fmtVal(a.plan, goal)}` + (a.week < w ? ` in week ${a.week}` : ''), diff > 0 ? 'good' : diff < 0 ? 'bad' : 'flat');
    }
    sinceCell();
    const tsub = `target ${fmtVal(target, goal)}` + (due !== cycle.weeks ? ` by week ${due}` : '');
    if (!hasNum) add('target', 'To target', 'No value yet', tsub, 'flat');
    else {
      const left = roundTo((target - a.actual) * better, d);
      if (left <= 0) add('target', 'To target', 'Target reached', tsub, 'good');
      else add('target', 'To target', better > 0 ? `${amount(left, goal)} to go` : `${amount(left, goal)} over`, tsub, 'flat');
    }
    const mark = nOf(target, d) + (goal.unit === '%' ? '%' : '');
    hitCell(`Will it hit ${mark}?`, target, Math.max(0.02 * Math.abs(target - start), lastDecimalHalf), due);
    return cells;
  }

  const { limit, margin, bound } = goal.range;
  const lim = `${bound === 'atMost' ? 'at most' : 'at least'} ${fmtVal(limit, goal)}`;
  if (!hasNum) add('limit', 'Vs the limit', 'No value yet', `must stay ${lim}`, 'flat');
  else add('limit', 'Vs the limit', a.out ? 'Outside it' : a.near ? 'Inside, near it' : 'Inside it', `must stay ${lim}`, a.out ? 'bad' : a.near ? 'flat' : 'good');
  sinceCell();
  const rsub = `warning within ${amount(margin, goal)}`;
  if (!hasNum) add('room', 'Room to the limit', 'No value yet', rsub, 'flat');
  else {
    const room = roundTo((limit - a.actual) * -better, d);
    if (room > 0) add('room', 'Room to the limit', `${amount(room, goal)} of room`, rsub, room <= margin ? 'flat' : 'good');
    else if (room === 0) add('room', 'Room to the limit', 'None: at the limit', rsub, 'flat');
    else add('room', 'Room to the limit', `${amount(room, goal)} ${bound === 'atMost' ? 'over' : 'under'}`, rsub, 'bad');
  }
  const floor = Math.max(0.02 * Math.abs(margin || Math.abs(0.1 * limit)), lastDecimalHalf);
  hitCell(a.out ? 'Back within by the end?' : 'Will it stay within?', limit, floor, cycle.weeks);
  return cells;
}

/* ---------- what a check-in must say ---------- */
export const NOT_NUMBER = (text) => `“${text}” isn't a number. Type digits only, like 29.4.`;

export function parseNumber(text) {
  if (text == null) return null;
  const s = String(text).trim();
  const m = s.match(/^([+-]?)\s*([0-9][0-9,.\s]*|\.[0-9]+)\s*(%|[^\d\s,.+\-][^\d]*)?$/);
  if (!m) return null;
  const body = m[2].replace(/\s+$/, '');
  if (/\s/.test(body)) return null;
  let v;
  if (/^\d+(\.\d*)?$/.test(body) || /^\.\d+$/.test(body)) v = Number(body);
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(body)) v = Number(body.replace(/,/g, ''));
  else if (/^\d+,\d{1,2}$/.test(body)) v = Number(body.replace(',', '.'));
  else return null;
  if (m[1] === '-') v = -v;
  if (!Number.isFinite(v) || Math.abs(v) >= 1e12) return null;
  return v;
}
export function typedDecimals(text) {
  const m = String(text).trim().match(/^[+-]?\s*([0-9][0-9,.\s]*|\.[0-9]+)/);
  if (!m) return 0;
  let body = m[1].trim();
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(body)) body = body.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(body)) body = body.replace(',', '.');
  const i = body.indexOf('.');
  if (i < 0) return 0;
  return body.slice(i + 1).replace(/0+$/, '').length;
}
export function precisionProblem(text, decimals) {
  const n = typedDecimals(text);
  if (n <= decimals) return null;
  const v = parseNumber(text);
  const shows = fixed(v, decimals).replace(/,/g, '');
  const typed = String(text).trim().replace(/[^0-9.,\-+].*$/, '').trim();
  return `${typed} has ${n} decimal place${n === 1 ? '' : 's'}, but this goal keeps ${decimals === 0 ? 'whole numbers' : `${decimals} decimal place${decimals === 1 ? '' : 's'}`}, so it would show as ${shows}. Type ${shows}, or set the goal’s Decimals to ${n}.`;
}
const NEG_REFUSED_UNIT = /^(days?|hours?|hrs?|mins?|minutes?|weeks?|secs?|seconds?|ms)$|usd|gbp|eur|\$|£|€/;
/** farOutside: more than 2 times the plan's width beyond either end. */
export function farOutside(v, plan) {
  const lo = Math.min(plan.start, plan.target), hi = Math.max(plan.start, plan.target);
  const width = hi - lo;
  return v < lo - 2 * width || v > hi + 2 * width;
}
/** Returns { refused } or { questioned } message, or null. */
export function valueProblem(goal, text, lastValue, plan) {
  const v = parseNumber(text);
  if (v == null) return { refused: NOT_NUMBER(String(text).trim()) };
  const p = precisionProblem(text, goal.decimals);
  if (p) return { refused: p };
  const unit = (goal.unit ?? '').trim().toLowerCase();
  if (v < 0 && (unit === '%' || NEG_REFUSED_UNIT.test(unit))) return { refused: `${v} can't be below zero.` };
  const nums = goal.kind === 'metric' ? planNumsOf(plan ?? goal.plan) : [goal.range.limit];
  const share = isShare(goal.unit, nums);
  if (v > 100 && share) return { refused: `${v}% is over 100%.` };
  if (v > 100 && unit === '%') return { questioned: `${v}% is over 100%. Is that right?` };
  if (goal.kind === 'metric') {
    const pl = plan ?? goal.plan;
    if (farOutside(v, pl)) {
      const lo = Math.min(pl.start, pl.target), hi = Math.max(pl.start, pl.target);
      return { questioned: `That's far outside this goal's plan (${lo} to ${hi}${unit === '%' ? '%' : goal.unit ? ' ' + goal.unit : ''}). Is ${v} right?` };
    }
  }
  if (lastValue != null && lastValue !== 0 && (v > 3 * lastValue || v < lastValue / 3)) return { questioned: `Last week was ${lastValue}. Is ${v} right?` };
  return null;
}
export function setupProblem(start, target) {
  if (start != null && target != null && start !== 0 && target !== 0 && Math.sign(start) === Math.sign(target)) {
    const r = Math.abs(target) / Math.abs(start);
    if (r >= 100) return `The target is over 100 times the start (${fixed(start, 0)} to ${fixed(target, 0)}). Is that right?`;
    if (r <= 0.01) return `The target is under a 100th of the start (${fixed(start, 0)} to ${fixed(target, 0)}). Is that right?`;
  }
  return null;
}

/**
 * evaluate: judge a draft in `week`. goal is already the goal as of that week. earlierAll: this goal's check-ins (all).
 * draft: { text (typed number), stages, call (status code) }.
 */
export function evaluate(goal, cycle, week, draft, earlierAll) {
  const earlier = sortCis(earlierAll.filter((c) => c.week < week));
  const out = { calculated: 'on', reason: '', asksTarget: false, needsPath: false, missing: [], greener: false, call: null };
  let value = null, valueCode = null;
  if (goal.kind !== 'milestone') {
    if (draft.text == null || String(draft.text).trim() === '') valueCode = 'value';
    else {
      value = parseNumber(draft.text);
      if (value == null) valueCode = 'value-not-number';
      else if (precisionProblem(draft.text, goal.decimals)) valueCode = 'value-precision';
      else if (valueProblem(goal, draft.text, null, goal.plan)?.refused) valueCode = 'value-impossible';
      if (valueCode) value = null; // a number that cannot be kept is judged as no number
    }
  }
  let calc, wellAhead = false;
  if (goal.kind === 'metric') {
    const series = earlier.filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value }));
    if (value != null) series.push({ week, value });
    const a = assessMetric(goal, goal.plan, cycle, week, value, series);
    calc = a.status; wellAhead = a.wellAhead;
    out.reason = a.wellAhead ? 'ahead' : a.behind ? 'behind' : '';
  } else if (goal.kind === 'range') {
    let prev = null;
    for (let i = earlier.length - 1; i >= 0; i--) if (earlier[i].value != null) { prev = earlier[i].value; break; }
    calc = assessRange(goal.range, week, value, prev).status;
    out.reason = calc === 'risk' || calc === 'off' ? 'behind' : '';
  } else {
    calc = assessMilestone(goal, week, draft.stages).status;
    out.reason = calc === 'risk' || calc === 'off' ? 'behind' : '';
  }
  out.calculated = calc === 'planned' || calc === 'none' ? 'on' : calc;
  out.asksTarget = wellAhead;
  const call = draft.call ?? out.calculated;
  out.call = call;
  out.greener = RANK[call] < RANK[out.calculated];
  out.needsPath = call === 'risk' || call === 'off';
  const m = [];
  if (valueCode) m.push(valueCode);
  if (out.greener) m.push('greener-why');
  if (out.reason) m.push(out.reason === 'ahead' ? 'reason-ahead' : 'reason-behind');
  if (out.needsPath) m.push('path');
  out.missing = m;
  return out;
}
