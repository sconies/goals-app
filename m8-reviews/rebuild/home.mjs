// Home's lead and quiet line (rules/home.md), the habit's run and receipt (rules/habit.md).
const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY = 86400000;
export const dayDate = (n) => new Date(n * DAY);
export const longDay = (n) => { const d = dayDate(n); return `${WD[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const shortDay = (n) => { const d = dayDate(n); return `${WD[(d.getUTCDay() + 6) % 7].slice(0, 3)} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const dayMonth = (n) => { const d = dayDate(n); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const weekdayName = (n) => WD[(dayDate(n).getUTCDay() + 6) % 7];
const firstName = (p) => (p ? p.name.split(' ')[0] : 'Someone');

// ---------- reviews: sessions and walks ----------
export const sessionDay = (S1, r, w) => S1.START + 7 * w + r.weekday;
export const hasSession = (r, w) => !r.endedAt && !r.removedAt && w >= 1 && w % (r.everyWeeks || 1) === 0;
export function walkOf(W, ws, r) {
  const sc = r.scope || {};
  const ids = new Set(sc.goals || []);
  const kids = new Map();
  for (const g of ws.goals) if (g.parentId) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g.id); }
  const add = (id) => { if (ids.has(id) && !(sc.goals || []).includes(id) && false) return; ids.add(id); for (const k of kids.get(id) || []) add(k); };
  for (const t of sc.trees || []) add(t);
  for (const g of ws.goals) if ((sc.levels || []).includes(g.level)) ids.add(g.id);
  return ws.goals.filter((g) => ids.has(g.id));
}
export function reviewedIn(W, r, w, m) {
  return new Set((W.decisions || []).filter((d) => d.reviewId === r.id && d.week === w && d.at <= m && !d.removedAt).map((d) => d.goalId));
}
export const heldOnDueDay = (W, S1, on, personId, w) => on('reviews') && (W.reviews || []).some((r) => hasSession(r, w) && r.weekday === S1.REVIEW_DAY && (!personId || (r.people || []).includes(personId)));
export function dueWords(held, day) { return held ? { by: `before ${day}’s review`, after: `after ${day}’s review` } : { by: `by ${day}`, after: `after ${day}` }; }

// ---------- the person's week ----------
function ownedLive(ws, personId) { return ws.goals.filter((g) => g.ownerId === personId); }
function doneBefore(S1, posted, w) { return posted.some((c) => c.status === 'done' && c.week < w); }
export function dueGoals(S1, ws, personId, w) {
  return ownedLive(ws, personId).filter((g) => {
    const posted = ws.ckByGoal.get(g.id) || [];
    if (doneBefore(S1, posted, w)) return false;
    let from = S1.firstDueWeek(g);
    for (const c of posted) if (c.authorId && c.authorId !== personId && c.week < w) from = Math.max(from, c.week + 1);
    return w >= from && w >= 1;
  });
}
const ckFor = (ws, g, w) => (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w && !c.removedAt);
function onTimeWeek(S1, ws, personId, w) {
  const due = dueGoals(S1, ws, personId, w);
  if (!due.length) return null;
  const dd = S1.START + 7 * w + S1.REVIEW_DAY;
  return due.every((g) => ckFor(ws, g, w).some((c) => c.authorId === personId && !c.backfilled && S1.dayNum(c.postedAt) <= dd));
}
export function streak(S1, ws, personId, w) {
  const due = dueGoals(S1, ws, personId, w);
  const complete = due.length && due.every((g) => ckFor(ws, g, w).length);
  let v = complete ? w : w - 1;
  let run = 0, forgiven = null;
  const memo = new Map();
  const ot = (x) => { if (!memo.has(x)) memo.set(x, onTimeWeek(S1, ws, personId, x)); return memo.get(x); };
  for (; v >= 1; v--) {
    const o = ot(v);
    if (o === null) break;
    if (o) { run++; continue; }
    let k = 0, ok = true;
    for (let x = v - 1; x >= 1 && k < 4; x--) { const ox = ot(x); if (ox === null) continue; k++; if (!ox) { ok = false; break; } }
    if (ok && k === 4) {
      if (forgiven === null) {
        const end = S1.START + 7 * v + 6;
        const missed = dueGoals(S1, ws, personId, v).some((g) => !ckFor(ws, g, v).some((c) => c.authorId === personId && S1.dayNum(c.postedAt) <= end));
        forgiven = { week: v, how: missed ? 'missed' : 'late' };
      }
      continue;
    }
    break;
  }
  return { run, forgiven };
}

// ---------- asks ----------
const KIND_ORDER = { decision: 0, question: 1, update: 2, action: 3 };
export function askDue(W, S1, on, a) {
  if (a.dueWeek !== null && a.dueWeek !== undefined) return S1.START + 7 * a.dueWeek + 6;
  if (a.kind === 'question' && a.reviewId && on('reviews')) {
    const r = (W.reviews || []).find((x) => x.id === a.reviewId);
    if (r) { let w = (a.week ?? S1.currentWeek(a.createdAt)) + 1; while (!hasSession(r, w) && w <= S1.WEEKS + 1) w++; return sessionDay(S1, r, w); }
  }
  return null;
}
export function waitingAsks(W, S1, ws, personId, m, on) {
  const today = S1.dayNum(m), w = S1.currentWeek(m);
  const ws0 = S1.START + 7 * w, we = ws0 + 6;
  const out = ws.asks.filter((a) => a.recipientId === personId && a.status === 'open').map((a) => {
    const due = askDue(W, S1, on, a);
    const asked = S1.dayNum(a.createdAt);
    const late = due !== null && today > due;
    const thisWeek = due !== null && !late && due >= ws0 && due <= we;
    const waited = today - asked;
    const band = late ? 0 : thisWeek ? 1 : due === null && waited >= 7 ? 2 : 3;
    return { a, due, late, thisWeek, waited, band, leads: band <= 2 };
  });
  out.sort((x, y) => x.band - y.band || (x.band === 2 ? x.a.createdAt.localeCompare(y.a.createdAt) : x.band === 3 ? y.a.createdAt.localeCompare(x.a.createdAt) : 0) || KIND_ORDER[x.a.kind] - KIND_ORDER[y.a.kind]);
  return out;
}
export function askTitle(W, a) {
  const by = (W.people || []).find((p) => p.id === a.askedBy);
  if (a.kind === 'decision') return `${firstName(by)} needs a decision`;
  if (a.kind === 'question') return `${firstName(by)} asked a question`;
  if (a.kind === 'update') return `${firstName(by)} asked for an update`;
  return 'A next step you agreed is due';
}

// ---------- needs attention ----------
export function attentionGoals(S1, ws, m) {
  return ws.goals.filter((g) => {
    const fl = S1.flagsFor(g, ws, m);
    return fl.flags.some((x) => x !== 'due') && !S1.handledFor(g, ws, m, fl);
  });
}

const plural = (n, one, many) => (n === 1 ? one : many);
export function homeFor(W, S1, personId, m, opts) {
  const { on, wsName } = opts;
  const ws = S1.asOf(m);
  const today = S1.dayNum(m);
  const w = S1.currentWeek(m);
  const rhythm = S1.CHECKIN_WEEKS !== 0;
  const dueDay = S1.START + 7 * w + S1.REVIEW_DAY;
  const due = rhythm && today <= S1.LAST_DAY ? dueGoals(S1, ws, personId, w) : [];
  const toDo = due.filter((g) => !ckFor(ws, g, w).length);
  const { run, forgiven } = streak(S1, ws, personId, w);
  const res = { lead: null, quiet: '', run, forgiven: forgiven ? `${forgiven.week} ${forgiven.how}` : '', toDo, due };
  const reviewsToday = on('reviews') ? (W.reviews || []).filter((r) => (r.people || []).includes(personId) && hasSession(r, w) && sessionDay(S1, r, w) === today) : [];
  const notHeld = (r) => { const walk = walkOf(W, ws, r); const done = reviewedIn(W, r, w, m); return walk.some((g) => !done.has(g.id)); };
  // 1, 2: check-ins
  if (toDo.length && today > dueDay) res.lead = { kind: 'check-in-late', title: `${toDo.length} ${plural(toDo.length, 'check-in', 'check-ins')} still to do`, eyebrow: `Check-ins were due on ${longDay(dueDay)}` };
  else if (toDo.length) {
    const rv = reviewsToday.find(notHeld);
    if (rv) res.lead = { kind: 'check-in', title: `${toDo.length} ${plural(toDo.length, 'check-in', 'check-ins')} to do before it`, eyebrow: `${rv.name} is today` };
    else if (dueDay - today <= 1) res.lead = { kind: 'check-in', title: `${toDo.length} ${plural(toDo.length, 'check-in', 'check-ins')} to do`, eyebrow: `Check-ins are due by ${longDay(dueDay)}${dueDay === today ? ', today' : ', tomorrow'}` };
  }
  // 3: the wrap-up
  if (!res.lead && on('wrap-up') && !toDo.length && w >= S1.WEEKS - 1) {
    const mine = ownedLive(ws, personId).filter((g) => !(W.wrapUps || []).some((x) => x.goalId === g.id));
    if (mine.length) res.lead = { kind: 'wrap-up', title: `Wrap up your ${mine.length} ${plural(mine.length, 'goal', 'goals')}`, eyebrow: `${W.cycle.name} ends on ${longDay(S1.LAST_DAY)}` };
  }
  // 4: a review
  if (!res.lead && on('reviews')) {
    const cand = (W.reviews || []).filter((r) => (r.people || []).includes(personId) && hasSession(r, w) && sessionDay(S1, r, w) <= today && notHeld(r) && !(opts.skipSession && opts.skipSession(r, w)))
      .sort((a, b) => sessionDay(S1, a, w) - sessionDay(S1, b, w) || a.name.localeCompare(b.name));
    if (cand.length) {
      const r = cand[0];
      const done = reviewedIn(W, r, w, m);
      const left = walkOf(W, ws, r).filter((g) => !done.has(g.id));
      const flagged = left.filter((g) => { const fl = S1.flagsFor(g, ws, m); return fl.flags.some((x) => x !== 'due') || S1.handledFor(g, ws, m, fl); });
      res.lead = { kind: 'review', review: r, title: flagged.length ? `${flagged.length} ${plural(flagged.length, 'goal', 'goals')} to discuss` : `${left.length} with nothing flagged to mark reviewed`, eyebrow: sessionDay(S1, r, w) === today ? `${r.name} is today` : 'Not held yet' };
    }
  }
  // someone who owns no goal, with Watching off, is led to every goal that needs attention
  const owns = ownedLive(ws, personId).length > 0;
  if (!res.lead && !on('watching') && !owns) {
    const n = attentionGoals(S1, ws, m).length;
    if (n) res.lead = { kind: 'attention', title: `${n} ${plural(n, 'goal needs', 'goals need')} attention`, eyebrow: 'Needs attention' };
  }
  // 5: an ask
  const asks = waitingAsks(W, S1, ws, personId, m, on);
  if (!res.lead && asks.length && asks[0].leads) res.lead = { kind: 'ask', ask: asks[0].a, title: askTitle(W, asks[0].a), eyebrow: 'Needs your response' };
  if (res.lead) return res;

  // the quiet line
  const waitN = asks.length;
  const nothing = waitN === 0 ? 'Nothing is asked of you today.' : waitN === 1 ? 'One ask waits for your response.' : `${waitN} asks wait for your response.`;
  if (today < S1.START) { res.quiet = `${nothing} ${W.cycle.name} starts on ${longDay(S1.START)}.`; return res; }
  if (today > S1.LAST_DAY) { res.quiet = `${W.cycle.name} has ended.`; return res; }
  const nextDue = dueDay + 7;
  const nextWords = (n) => (w >= S1.WEEKS ? '' : ` The next ${n === 1 ? 'is' : 'are'} due by ${longDay(nextDue)}.`);
  if (toDo.length) { res.quiet = `${nothing} Check-ins for week ${w} are due by ${longDay(dueDay)}. You have ${toDo.length} to do.`; return res; }
  if (due.length) {
    const firsts = due.map((g) => ckFor(ws, g, w).map((c) => c.postedAt).sort()[0]);
    const lastIn = firsts.sort().slice(-1)[0];
    if (S1.dayNum(lastIn) === today) { res.quiet = receiptText(W, S1, on, personId, w, due, ws, { run, forgiven }); return res; }
    const n = due.length;
    res.quiet = `${n === 1 ? 'Your check-in is' : n === 2 ? 'Both check-ins are' : `All ${n} check-ins are`} in for week ${w}.${nextWords(n)}`;
    return res;
  }
  const watches = on('watching') && (W.watches || []).some((x) => x.personId === personId);
  if (!owns && !watches && !waitN) { res.quiet = `Nothing is asked of you today. You don’t own or watch a goal in ${wsName} yet.`; return res; }
  res.quiet = nothing;
  return res;
}

export function receiptText(W, S1, on, personId, w, due, ws, { run, forgiven }) {
  const total = due.length;
  const dd = S1.START + 7 * w + S1.REVIEW_DAY;
  const after = due.filter((g) => { const f = ckFor(ws, g, w).map((c) => c.postedAt).sort()[0]; return S1.dayNum(f) > dd; }).length;
  const words = dueWords(heldOnDueDay(W, S1, on, personId, w), weekdayName(dd));
  const yours = total === 1 ? 'Your check-in is' : total === 2 ? 'Both of your check-ins are' : `All ${total} of your check-ins are`;
  if (!after) {
    let s = `${yours} in ${words.by}.`;
    if (run >= 2) {
      s += ` That is ${run} weeks in a row.`;
      if (forgiven && forgiven.week === w - 1) s += forgiven.how === 'late' ? ` Week ${forgiven.week} came in late; one late week doesn’t break a run.` : ` Week ${forgiven.week} was missed; one missed week doesn’t break a run.`;
    }
    if (w < S1.WEEKS) s += ` The next ${total === 1 ? 'is' : 'are'} due by ${longDay(dd + 7)}.`;
    return s;
  }
  const who = total === 1 ? 'It' : after === total ? (total === 2 ? 'Both' : 'All of them') : after === 1 ? 'One' : String(after);
  let s = `${yours} in. ${who} came ${words.after}.`;
  if (w < S1.WEEKS) s += ` The next ${total === 1 ? 'is' : 'are'} due by ${longDay(dd + 7)}.`;
  return s;
}
