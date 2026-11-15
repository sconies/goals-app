// The year (spec/core/rules/year-end.md, start-next-year.md, carry.md): where a cycle stands, a goal's result,
// what each goal does at the start of the next year, and the read-back that counts every goal once.

export function cycleDays(core, cycle = core.W.cycle) {
  const start = core.dayNum(cycle.startDate);
  const first = start + 7, last = start + (cycle.weeks + 1) * 7 - 1;
  const opens = start + 7 * (cycle.weeks - 2 + 1), closes = last + 28;
  return { start, first, last, opens, closes };
}
export function cycleState(core, m, cycle = core.W.cycle) {
  const d = cycleDays(core, cycle), t = core.dayNum(m);
  if (t < d.first) return 'before';
  if (t < d.opens) return 'running';
  if (t <= d.last) return 'ending';
  if (t <= d.closes) return 'ended';
  return 'closed';
}
export function resultWeek(core, m) {
  const d = cycleDays(core), t = core.dayNum(m);
  return t > d.last ? core.WEEKS + 1 : core.S1.currentWeek(m);
}
export const RESULT_WORD = { met: 'Met', late: 'Met late', missed: 'Not met' };

// goalResult: { result: met|late|missed, week, due } or null while not due and not complete.
export function goalResult(core, g, posted, m) {
  const S1 = core.S1;
  const rw = resultWeek(core, m);
  const list = S1.sortCk(posted.filter((c) => !c.removedAt));
  const doneCk = list.find((c) => c.status === 'done');
  if (g.kind === 'metric') {
    const due = g.plan?.endWeek ?? core.WEEKS;
    const dir = Math.sign(g.plan.target - g.plan.start) || 1;
    const reached = (v) => v !== null && v !== undefined && (v - g.plan.target) * dir >= 0;
    if (doneCk && doneCk.week <= due) return { result: 'met', week: doneCk.week, due };
    if (rw <= due && !list.some((c) => c.week >= due)) return null;
    const byDue = list.filter((c) => c.week <= due && c.value !== null && c.value !== undefined);
    const latest = byDue[byDue.length - 1];
    if (latest && latest.week >= due - 1 && reached(latest.value)) return { result: 'met', week: latest.week, due };
    const later = list.find((c) => c.week > due && (reached(c.value) || c.status === 'done'));
    if (later) return { result: 'late', week: later.week, due };
    return rw > due ? { result: 'missed', due } : null;
  }
  if (g.kind === 'milestone') {
    const stages = g.stages || [];
    const due = Math.max(...stages.map((s) => s.dueWeek ?? 0), 0);
    let doneWeek = doneCk ? doneCk.week : null;
    if (doneWeek === null) {
      const doneSet = new Set();
      for (const c of list) for (const s of c.stages || []) if (s.done || s.state === 'done') { doneSet.add(s.id); if (doneSet.size === stages.length && doneWeek === null) doneWeek = c.week; }
    }
    if (doneWeek !== null) return { result: doneWeek <= due ? 'met' : 'late', week: doneWeek, due };
    return rw > due ? { result: 'missed', due } : null;
  }
  // a range: judged on its last check-in from its due week on
  const due = core.WEEKS;
  const last = [...list].reverse().find((c) => c.value !== null && c.value !== undefined);
  if (rw < due && !(last && last.week >= due)) return null;
  if (!last) return rw > due ? { result: 'missed', due } : null;
  const r = g.range, v = last.value;
  const out = r.bound === 'atMost' ? v > r.limit : r.bound === 'atLeast' ? v < r.limit : v > r.limit || v < r.lower;
  return { result: out ? 'missed' : 'met', week: last.week, due };
}
export function resultWords(r) {
  if (!r) return '';
  if (r.result === 'met') return `Met in week ${r.week}`;
  if (r.result === 'late') return `Met late: week ${r.week}, due week ${r.due}`;
  return `Not met: due week ${r.due}`;
}

// carryKind: stops (owner said so at the wrap-up, read only while the Wrap-up is on), keeps, finishes, carries.
export function carryKind(core, g, posted, m, { wrapUpOn = false } = {}) {
  const retro = (core.W.retros || []).find((r) => r.goalId === g.id && !r.removedAt);
  const res = goalResult(core, g, posted, m);
  const finished = (res && (res.result === 'met' || res.result === 'late')) || posted.some((c) => c.status === 'done');
  if (wrapUpOn && retro && retro.next === 'stop' && !finished) return 'stops';
  if (g.kind === 'metric' && (g.plan?.endWeek ?? core.WEEKS) > core.WEEKS) return 'keeps';
  if (g.kind !== 'range' && finished) return 'finishes';
  if (g.kind === 'metric') {
    const nums = posted.filter((c) => c.value !== null && c.value !== undefined);
    const last = core.S1.sortCk(nums).pop();
    const dir = Math.sign(g.plan.target - g.plan.start) || 1;
    if (last && (last.value - g.plan.target) * dir >= 0) return 'finishes';
  }
  if (g.kind === 'milestone') {
    const stages = g.stages || [];
    const done = new Set();
    for (const c of posted) for (const s of c.stages || []) if (s.done || s.state === 'done') done.add(s.id);
    if (stages.length && stages.every((s) => done.has(s.id))) return 'finishes';
  }
  return 'carries';
}

// The read-back: every live goal counted once.
export function startReadBack(core, m, opts = {}) {
  const states = core.goalStates(m);
  const nextName = String(Number(core.W.cycle.name) + 1);
  const counts = { carries: 0, keeps: 0, finishes: 0, stops: 0 };
  const kinds = new Map();
  for (const s of states) { const k = carryKind(core, s.g, s.posted, m, opts); counts[k]++; kinds.set(s.g.id, k); }
  const total = states.length;
  const lines = [
    { n: counts.carries + counts.keeps, says: `carry on into ${nextName}`, sub: counts.keeps ? `${counts.keeps} of them keep their plan` : '' },
    { n: counts.finishes, says: `finish in ${core.W.cycle.name}`, sub: '' },
    { n: counts.stops, says: 'stop', sub: '' },
  ];
  return { total, counts, kinds, lines, next: nextName };
}
