// Home (spec/core/rules/home.md) and the habit (spec/core/rules/habit.md): the lead, the quiet line, the run and the receipt.

const LEAD_DAYS = 1;
const plural = (n, one, many) => (n === 1 ? one : many);
const firstName = (p) => (p?.name || '').split(' ')[0];

// The viewer's goals due in week w as of moment m: owned, not stopped/proposed, first due by then, not done before it.
export function dueGoals(core, viewer, w, m) {
  const { S1 } = core;
  const ws = core.goalStates(m).ws;
  return ws.goals.filter((g) => {
    if (g.ownerId !== viewer) return false;
    if (S1.isUnmeasured(g)) return false;
    let from = S1.firstDueWeek(g);
    const posted = ws.ckByGoal.get(g.id) || [];
    const others = posted.filter((c) => c.authorId && c.authorId !== viewer);
    if (others.length) from = Math.max(from, Math.max(...others.map((c) => c.week)) + 1);
    if (w < from) return false;
    const done = posted.filter((c) => c.status === 'done');
    if (done.length && Math.min(...done.map((c) => c.week)) < w) return false;
    return true;
  });
}

// Was goal g checked in on time by viewer for week w (in its week, by the due day, not backfilled)?
const inByDueDay = (core, c, w) => c.week === w && !c.backfilled && core.dayNum(c.postedAt) <= core.dueDay(w);

function weekState(core, viewer, w, m) {
  const goals = dueGoals(core, viewer, w, m);
  if (!goals.length) return { due: 0 };
  const ws = core.goalStates(m).ws;
  let onTime = true, missed = false;
  for (const g of goals) {
    const mine = (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w && (!c.authorId || c.authorId === viewer));
    if (!mine.some((c) => inByDueDay(core, c, w))) onTime = false;
    if (!mine.some((c) => !c.backfilled && core.dayNum(c.postedAt) < core.START + 7 * (w + 1))) missed = true;
  }
  return { due: goals.length, onTime, missed };
}

// onTimeStreak and forgivenIn, in the week of moment m.
export function runOf(core, viewer, m) {
  const w = core.S1.currentWeek(m);
  const ws = core.goalStates(m).ws;
  const thisDue = dueGoals(core, viewer, w, m);
  const allIn = thisDue.length > 0 && thisDue.every((g) => (ws.ckByGoal.get(g.id) || []).some((c) => c.week === w));
  let k = allIn ? w : w - 1;
  let run = 0, forgiven = null;
  const states = new Map();
  const st = (x) => { if (!states.has(x)) states.set(x, weekState(core, viewer, x, m)); return states.get(x); };
  for (; k >= 1; k--) {
    const s = st(k);
    if (!s.due) break;
    if (s.onTime) { run++; continue; }
    // forgiven when the 4 weeks with something due before it were all on time
    let found = 0, ok = true;
    for (let j = k - 1; j >= 1 && found < 4; j--) { const t = st(j); if (!t.due) continue; found++; if (!t.onTime) { ok = false; break; } }
    if (ok && found === 4) { if (forgiven === null) forgiven = { week: k, how: s.missed ? 'missed' : 'late' }; continue; }
    break;
  }
  return { run, forgiven: run ? forgiven : null };
}

// Is a review the viewer is in held (meets) on day n?
function reviewOnDay(core, viewer, n) {
  if (!core.isOn('reviews')) return null;
  const w = Math.floor((n - core.START) / 7);
  return (core.W.reviews || []).filter((r) => !r.removedAt && (r.people || []).includes(viewer) && core.reviewWeeks(r, w) && core.sessionDay(r, w) === n)
    .sort((a, b) => a.name.localeCompare(b.name))[0] || null;
}

export function receiptText(core, { total, after, byDay, held, run, forgiven, week, lastWeek }) {
  const dayName = byDay;
  const by = held ? `before ${dayName}’s review` : `by ${dayName}`;
  const afterW = held ? `after ${dayName}’s review` : `after ${dayName}`;
  const yours = total === 1 ? 'Your check-in is' : total === 2 ? 'Both of your check-ins are' : `All ${total} of your check-ins are`;
  if (!after) {
    let s = `${yours} in ${by}.`;
    if (run >= 2) {
      s += ` That is ${run} weeks in a row.`;
      if (forgiven && forgiven.week === week - 1) s += forgiven.how === 'missed' ? ` Week ${forgiven.week} was missed; one missed week doesn’t break a run.` : ` Week ${forgiven.week} came in late; one late week doesn’t break a run.`;
    }
    return s;
  }
  const who = total === 1 ? 'It' : after === total ? (total === 2 ? 'Both' : 'All of them') : after === 1 ? 'One' : String(after);
  let s = `${yours} in. ${who} came ${afterW}.`;
  if (!lastWeek) s += ` The next ${total === 1 ? 'is' : 'are'} due by ${core.fmtDay(core.dueDay(week + 1))}.`;
  return s;
}

// The asks waiting on the viewer at moment m, in waitingOrder, with whether each leads.
export function waitingAsks(core, viewer, m) {
  const ws = core.goalStates(m).ws;
  const today = core.dayNum(m);
  const w = core.S1.currentWeek(m);
  const KIND = { decision: 0, question: 1, update: 2, action: 3 };
  const list = [];
  for (const a of ws.asks) {
    if (a.status !== 'open' || a.recipientId !== viewer) continue;
    let due = null;
    if (a.dueWeek !== null && a.dueWeek !== undefined) due = core.START + 7 * a.dueWeek + 6;
    else if (a.kind === 'question' && a.reviewId && core.isOn('reviews')) {
      const r = (core.W.reviews || []).find((x) => x.id === a.reviewId);
      if (r) { let k = (a.week ?? core.S1.currentWeek(a.createdAt)) + 1; while (!core.reviewWeeks(r, k)) k++; due = core.sessionDay(r, k); }
    }
    const waited = today - core.dayNum(a.createdAt);
    const late = due !== null && today > due;
    const thisWeek = due !== null && !late && Math.floor((due - core.START) / 7) === w;
    const group = late ? 0 : thisWeek ? 1 : due === null && waited >= 7 ? 2 : 3;
    list.push({ a, due, waited, late, thisWeek, group, leads: group <= 2 });
  }
  list.sort((x, y) => x.group - y.group || (x.group === 2 ? (x.a.createdAt < y.a.createdAt ? -1 : 1) : x.group === 3 ? (x.a.createdAt > y.a.createdAt ? -1 : 1) : 0) || KIND[x.a.kind] - KIND[y.a.kind]);
  return list;
}

export function askTitle(core, a) {
  const who = firstName(core.personById.get(a.askedBy));
  if (a.kind === 'decision') return `${who} needs a decision`;
  if (a.kind === 'question') return `${who} asked a question`;
  if (a.kind === 'update') return `${who} asked for an update`;
  return 'A next step you agreed is due';
}

// The goals a person's watches cover.
export function watchedGoals(core, viewer, goals) {
  const ws = (core.W.watches || []).filter((x) => x.personId === viewer && !x.removedAt);
  const ids = new Set();
  const kids = new Map();
  for (const g of goals) if (g.parentId) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g.id); }
  for (const x of ws) {
    if (x.kind === 'goal') ids.add(x.ref);
    else if (x.kind === 'level') for (const g of goals) { if (g.level === x.ref) ids.add(g.id); }
    else if (x.kind === 'tree') { const st = [x.ref]; while (st.length) { const id = st.pop(); ids.add(id); for (const k of kids.get(id) || []) st.push(k); } }
  }
  return goals.filter((g) => ids.has(g.id) && g.ownerId !== viewer);
}

export function homeFor(core, viewer, m, { workspaceName }) {
  const { S1 } = core;
  const today = core.dayNum(m);
  const w = S1.currentWeek(m);
  const states = core.goalStates(m);
  const ws = states.ws;
  const rhythm = S1.CHECKIN_WEEKS !== 0;
  const due = dueGoals(core, viewer, w, m);
  const toDo = due.filter((g) => !(ws.ckByGoal.get(g.id) || []).some((c) => c.week === w));
  const dueDay = core.dueDay(w);
  const { run, forgiven } = runOf(core, viewer, m);
  const res = { lead: null, quiet: '', run, forgiven: forgiven ? `${forgiven.week} ${forgiven.how}` : '' };
  const beforeStart = today < core.START, afterEnd = today > S1.LAST_DAY;
  const asks = waitingAsks(core, viewer, m);
  const owns = states.some((s) => s.g.ownerId === viewer);
  const reviewToday = reviewOnDay(core, viewer, today);

  // 1. late check-ins
  if (rhythm && !beforeStart && !afterEnd && toDo.length && today > dueDay) {
    res.lead = { kind: 'check-in-late', title: `${toDo.length} ${plural(toDo.length, 'check-in', 'check-ins')} still to do` };
    return res;
  }
  // 2. check-ins due soon, or a review today
  if (rhythm && !beforeStart && !afterEnd && toDo.length) {
    const heldToday = reviewToday && sessionHeld(core, reviewToday, w, m);
    if (reviewToday && !heldToday) { res.lead = { kind: 'check-in', title: `${toDo.length} ${plural(toDo.length, 'check-in', 'check-ins')} to do before it` }; return res; }
    if (dueDay - today <= LEAD_DAYS) { res.lead = { kind: 'check-in', title: `${toDo.length} ${plural(toDo.length, 'check-in', 'check-ins')} to do` }; return res; }
  }
  // 3. the wrap-up
  if (core.isOn('wrap-up') && !toDo.length && (w >= core.WEEKS - 1 || afterEnd)) {
    const mine = states.filter((s) => s.g.ownerId === viewer && !(core.W.retros || []).some((r) => r.goalId === s.g.id));
    if (mine.length) { res.lead = { kind: 'wrap-up', title: `Wrap up your ${mine.length} ${plural(mine.length, 'goal', 'goals')}` }; return res; }
  }
  // 4. a review this week, on or past its day, not held
  if (core.isOn('reviews')) {
    const cands = (core.W.reviews || []).filter((r) => !r.removedAt && (r.people || []).includes(viewer) && core.reviewWeeks(r, w) && core.sessionDay(r, w) <= today)
      .sort((a, b) => core.sessionDay(a, w) - core.sessionDay(b, w) || a.name.localeCompare(b.name));
    for (const r of cands) {
      const walk = core.goalsIn(r, ws.goals);
      const reviewed = new Set(reviewedIn(core, r, w, m));
      const open = walk.filter((g) => !reviewed.has(g.id));
      if (!open.length) continue;
      const flagged = open.filter((g) => { const s = states.find((x) => x.g.id === g.id); return s && (s.needs || s.handled); });
      res.lead = { kind: 'review', title: flagged.length ? `${flagged.length} ${plural(flagged.length, 'goal', 'goals')} to discuss` : `${open.length} with nothing flagged to mark reviewed` };
      return res;
    }
  } else if (!owns && core.isOn('watching')) {
    const watched = watchedGoals(core, viewer, ws.goals);
    const n = watched.filter((g) => states.find((s) => s.g.id === g.id)?.needs).length;
    if (n) { res.lead = { kind: 'watching', title: `${n} ${plural(n, 'needs', 'need')} attention` }; return res; }
  }
  if (!owns && !core.isOn('watching')) {
    const n = states.filter((s) => s.needs).length;
    if (n) { res.lead = { kind: 'attention', title: `${n} ${plural(n, 'goal needs', 'goals need')} attention` }; return res; }
  }
  // 5. an ask
  const leading = asks.find((x) => x.leads);
  if (leading) { res.lead = { kind: 'ask', title: askTitle(core, leading.a) }; return res; }

  // the quiet line
  const waitN = asks.length;
  const sentence = waitN === 0 ? 'Nothing is asked of you today.' : waitN === 1 ? 'One ask waits for your response.' : `${waitN} asks wait for your response.`;
  if (beforeStart) { res.quiet = sentence; return res; }
  if (afterEnd) { res.quiet = `${core.W.cycle.name} has ended.`; return res; }
  if (rhythm && toDo.length) {
    res.quiet = `${sentence} Check-ins for week ${w} are due by ${core.fmtDay(dueDay)}. You have ${toDo.length} to do.`;
    return res;
  }
  if (rhythm && due.length) {
    const firsts = due.map((g) => (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1))[0]);
    const lastIn = firsts.reduce((mx, c) => (c.postedAt > mx ? c.postedAt : mx), '');
    const lastWeek = w >= core.WEEKS;
    if (core.dayNum(lastIn) === today) {
      const after = firsts.filter((c) => core.dayNum(c.postedAt) > dueDay).length;
      const held = !!reviewOnDay(core, viewer, dueDay);
      res.quiet = receiptText(core, { total: due.length, after, byDay: core.DAYS_NAME(dueDay), held, run, forgiven, week: w, lastWeek });
      return res;
    }
    const yours = due.length === 1 ? 'Your check-in is' : due.length === 2 ? 'Both check-ins are' : `All ${due.length} check-ins are`;
    res.quiet = `${yours} in for week ${w}.` + (lastWeek ? '' : ` The next ${due.length === 1 ? 'is' : 'are'} due by ${core.fmtDay(core.dueDay(w + 1))}.`);
    return res;
  }
  const watches = core.isOn('watching') && watchedGoals(core, viewer, ws.goals).length;
  if (!owns && !watches && !waitN) { res.quiet = `${sentence} You don’t own or watch a goal in ${workspaceName} yet.`; return res; }
  res.quiet = sentence;
  return res;
}

export function reviewedIn(core, r, w, m) {
  return (core.W.decisions || []).filter((d) => d.kind === 'acknowledge' && d.reviewId === r.id && d.week === w && d.at <= m && !d.removedAt).map((d) => d.goalId);
}
export function sessionHeld(core, r, w, m) {
  const ws = core.goalStates(m).ws;
  const walk = core.goalsIn(r, ws.goals);
  const done = new Set(reviewedIn(core, r, w, m));
  return walk.length > 0 && walk.every((g) => done.has(g.id));
}
