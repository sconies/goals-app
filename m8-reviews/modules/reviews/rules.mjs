// The Reviews module's rules: pure functions over the workspace's records (no screens, no store).
// From spec/modules/reviews/ (RS1, RS2, writesReviews), spec/core/rules/review-decide.md and Help's Reviews article.
export const ID = 'reviews';
export const LABEL = 'Reviews';
export const ACCEPT = 'We accept the risk: ';
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WD_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;
export const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const wd = (d) => ((d % 7) + 7 + 3) % 7;
export const dayShort = (d) => { const x = new Date(d * DAY); return `${WD_SHORT[wd(d)]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
export const weekdayPlural = (n) => `${WD_LONG[n]}s`;
export const cadenceWords = (r) => `${r.everyWeeks === 1 ? 'Every week' : `Every ${r.everyWeeks} weeks`}, ${weekdayPlural(r.weekday)}`;

export const reviewsOn = (W) => !(W.modulesOff || []).includes(ID);
export const live = (r) => r && !r.endedAt && !r.removedAt;
const start = (W) => dayNum(W.cycle.startDate);
export const currentWeek = (W, moment) => Math.max(0, Math.min(W.cycle.weeks, Math.floor((dayNum(moment) - start(W)) / 7)));
export const meetsIn = (r, w) => w >= 1 && w % r.everyWeeks === 0;
export const sessionDay = (W, r, w) => start(W) + 7 * w + r.weekday;
export const dueDayOf = (W, w) => start(W) + 7 * w + W.cycle.reviewDay;

// ---------- RS1: one phrase for the clock ----------
// A review is held on the due day when one not ended or removed has its weekday on that day and a session that week.
export function heldOnDueDay(W, w, who = null) {
  return (W.reviews || []).some((r) => live(r) && r.weekday === W.cycle.reviewDay && meetsIn(r, w) && (!who || r.people.includes(who)));
}
// held for a set of goals (a team's habit panel): one held that day with one of the goals' owners in it.
export function heldForGoals(W, w, goals) {
  const owners = new Set(goals.map((g) => g.ownerId));
  return reviewsOn(W) && (W.reviews || []).some((r) => live(r) && r.weekday === W.cycle.reviewDay && meetsIn(r, w) && r.people.some((p) => owners.has(p)));
}
export function dueWords(on, cycle, week, held) {
  const day = WD_LONG[cycle.reviewDay];
  const d = dayNum(cycle.startDate) + 7 * week + cycle.reviewDay;
  const flag = `Due by ${dayShort(d)}.`;
  if (on && held) return { by: `before ${day}’s review`, after: `after ${day}’s review`, onTime: 'before the review', flag };
  return { by: `by ${day}`, after: `after ${day}`, onTime: 'on time', flag };
}

// ---------- RS2: the read-back before switching off ----------
export const isAccept = (d) => d && d.kind === 'note' && String(d.note || '').startsWith(ACCEPT);
export const acceptedReason = (d) => (isAccept(d) ? d.note.slice(ACCEPT.length) : null);
export function switchOffReadBack(W) {
  const goals = new Map((W.goals || []).map((g) => [g.id, g]));
  const liveReviews = (W.reviews || []).filter(live);
  const ids = new Set(liveReviews.map((r) => r.id));
  const notes = (W.decisions || []).filter((d) => d.kind === 'note' && !d.removedAt && d.reviewId && ids.has(d.reviewId));
  const open = (W.requests || []).filter((a) => a.reviewId && ids.has(a.reviewId) && a.status === 'open' && !a.removedAt);
  const risks = (W.decisions || []).filter((d) => isAccept(d) && !d.removedAt && goals.has(d.goalId) && !goals.get(d.goalId).removedAt).length;
  return { reviews: liveReviews.length, names: liveReviews.map((r) => r.name), notes: notes.length, steps: open.filter((a) => a.kind === 'action').length, questions: open.filter((a) => a.kind === 'question').length, risks, dueDay: WD_LONG[W.cycle.reviewDay] };
}
export function switchOffLines(W, wsName) {
  const c = switchOffReadBack(W);
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const lines = [`Reviews leaves the menu, Home and every goal’s page for everyone in ${wsName}, and an AI assistant’s review tools stop.`];
  if (c.reviews) lines.push(`${n(c.reviews, 'review stays', 'reviews stay')} in the record, with what was said in ${c.reviews === 1 ? 'it' : 'them'}${c.notes ? ` (${n(c.notes, 'note', 'notes')})` : ''}: ${c.names.join(', ')}.`);
  if (c.steps) lines.push(`${n(c.steps, 'open next step', 'open next steps')} agreed in a review ${c.steps === 1 ? 'stays' : 'stay'} open on ${c.steps === 1 ? 'its goal' : 'their goals'} and on Home.`);
  if (c.questions) lines.push(`${n(c.questions, 'open question', 'open questions')} raised in a review ${c.questions === 1 ? 'stays' : 'stay'} open for ${c.questions === 1 ? 'its owner' : 'their owners'} to answer.`);
  if (c.risks) lines.push(`${n(c.risks, 'accepted risk stays', 'accepted risks stay')} on their goals, as they were said. No new one can be accepted while Reviews is off.`);
  lines.push(`Check-ins are still due by ${c.dueDay}. “Before the review” becomes “by ${c.dueDay}” on Home, in the check-in and in the count of goals checked in on time.`);
  lines.push('Nothing is deleted. Switch it back on and every review, its people, its cadence and what was said are as they were.');
  return lines;
}

// ---------- what is refused while off (writesReviews) ----------
// A commit is { kind: [records] }. True when it would save Reviews' own records.
export function writesReviews(W, commit, input = {}) {
  if (input.reviewId || input.review || input.proposedIn) return true;
  if ((commit.reviews || []).length) return true;
  if ((commit.decisions || []).some((d) => d.reviewId || d.kind === 'note')) return true;
  const asks = new Map((W.requests || []).map((a) => [a.id, a]));
  if ((commit.requests || []).some((a) => a.reviewId && !asks.has(a.id))) return true;
  const goals = new Map((W.goals || []).map((g) => [g.id, g]));
  if ((commit.goals || []).some((g) => g.proposedIn && !(goals.get(g.id) || {}).proposedIn)) return true;
  if ((commit.changes || []).some((c) => c.entity === 'review' || c.entity === 'note')) return true;
  return false;
}

// ---------- who may speak for a review ----------
export const canSpeakFor = (W, r, viewer) => r.people.includes(viewer) || !!(W.people || []).find((p) => p.id === viewer)?.admin;
export const speakRefusal = (r) => `Only people in ${r.name}, or an admin, can speak for it.`;
export const scopeRefusal = (r, g) => `${r.name} doesn’t cover ${g.title}, so nothing can be said about it there.`;
export function joinLine(W, r) {
  const ids = [...new Set([...r.people, r.createdBy].filter(Boolean))];
  const names = ids.map((id) => (W.people || []).find((p) => p.id === id)?.name).filter(Boolean);
  const shown = names.slice(0, 6), more = names.length - shown.length;
  const list = more > 0 ? `${shown.join(', ')} and ${more} more` : shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}` : shown.join('');
  return `You’re not in this review. ${list} or an admin can add you.`;
}

// ---------- the walk's goals ----------
export function goalsIn(r, goals) {
  const sc = r.scope || { goals: [], trees: [], levels: [] };
  const set = new Set(sc.goals || []);
  const kids = new Map();
  for (const g of goals) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g); }
  const walk = (id) => { set.add(id); for (const k of kids.get(id) || []) walk(k.id); };
  for (const t of sc.trees || []) walk(t);
  return goals.filter((g) => set.has(g.id) || (sc.levels || []).includes(g.level));
}
export const needsDecision = (status) => status === 'off' || status === 'risk';

// ---------- sessions ----------
// Off periods are kept on the workspace (W.switches): a session whose day passed while Reviews was off moves to its next date.
export function offPeriods(W) {
  return (W.switches || []).filter((s) => s.module === ID).map((s) => [dayNum(s.offAt), s.onAt ? dayNum(s.onAt) : Infinity]);
}
export const skippedWhileOff = (W, r, w) => { const d = sessionDay(W, r, w); return offPeriods(W).some(([a, b]) => d >= a && d < b); };
export function marked(W, r, w, moment) {
  // Reviewed is a mark, not a note: a note said about a goal doesn't mark it reviewed.
  return new Set((W.decisions || []).filter((d) => d.reviewId === r.id && d.week === w && !d.removedAt && d.kind !== 'note' && (!moment || d.at <= moment)).map((d) => d.goalId));
}
export function heldIn(W, r, w, walkGoals, moment) {
  if (!walkGoals.length) return false;
  const m = marked(W, r, w, moment);
  return walkGoals.every((g) => m.has(g.id));
}
const createdDay = (r) => (r.createdAt ? dayNum(r.createdAt) : -Infinity);
export function sessionWeeks(W, r) {
  const out = [];
  for (let w = 1; w <= W.cycle.weeks; w++) if (meetsIn(r, w) && sessionDay(W, r, w) >= createdDay(r)) out.push(w);
  return out;
}
// Where a review's session stands today: not started, in progress, outstanding (past its date, not held) or held.
export function sessionState(W, r, walkGoals, moment) {
  const today = dayNum(moment), w0 = currentWeek(W, moment);
  const weeks = sessionWeeks(W, r);
  const nextAfter = (w) => weeks.find((x) => x > w) ?? null;
  const past = weeks.filter((x) => x <= w0);
  let s = past.at(-1) ?? null;
  const lastHeld = [...past].reverse().find((x) => heldIn(W, r, x, walkGoals, moment)) ?? null;
  const reviewed = (x) => walkGoals.filter((g) => marked(W, r, x, moment).has(g.id)).length;
  if (s === null) { const n = weeks[0] ?? null; return { state: 'not-started', week: n, day: n === null ? null : sessionDay(W, r, n), reviewed: 0, total: walkGoals.length, lastHeld, next: null }; }
  if (heldIn(W, r, s, walkGoals, moment)) {
    const hd = Math.max(...(W.decisions || []).filter((d) => d.reviewId === r.id && d.week === s && !d.removedAt && d.at <= moment).map((d) => dayNum(d.at)));
    const n = nextAfter(s);
    return { state: 'held', week: s, day: sessionDay(W, r, s), heldDay: hd, reviewed: walkGoals.length, total: walkGoals.length, lastHeld: s, next: n, nextDay: n === null ? null : sessionDay(W, r, n) };
  }
  const k = reviewed(s);
  if (!k && today > sessionDay(W, r, s) && skippedWhileOff(W, r, s)) {
    const n = nextAfter(s);
    return { state: 'not-started', week: n, day: n === null ? null : sessionDay(W, r, n), reviewed: 0, total: walkGoals.length, lastHeld, next: null, skipped: s };
  }
  if (k) return { state: 'in-progress', week: s, day: sessionDay(W, r, s), reviewed: k, total: walkGoals.length, lastHeld };
  if (today > sessionDay(W, r, s)) {
    const n = nextAfter(s);
    if (w0 >= W.cycle.weeks && today > dayNum(W.cycle.startDate) + 7 * (W.cycle.weeks + 1) - 1) return { state: 'held', week: s, day: sessionDay(W, r, s), reviewed: k, total: walkGoals.length, lastHeld, ended: true };
    return { state: 'outstanding', week: s, day: sessionDay(W, r, s), daysPast: today - sessionDay(W, r, s), reviewed: 0, total: walkGoals.length, lastHeld, next: n, nextDay: n === null ? null : sessionDay(W, r, n) };
  }
  return { state: 'not-started', week: s, day: sessionDay(W, r, s), reviewed: 0, total: walkGoals.length, lastHeld };
}
export function stateWords(st) {
  if (st.state === 'held') return `Held ${dayShort(st.heldDay ?? st.day)}`;
  if (st.state === 'in-progress') return `In progress · ${st.reviewed} of ${st.total} reviewed`;
  if (st.state === 'outstanding') return `Outstanding from ${dayShort(st.day)}, ${st.daysPast} day${st.daysPast === 1 ? '' : 's'} past${st.nextDay !== null && st.nextDay !== undefined ? ` · Next session ${dayShort(st.nextDay)}` : ''}`;
  return st.day === null ? 'No session left this year' : `Not started · Session ${dayShort(st.day)}`;
}
// A session is something to do once its day has come or a goal in it has been checked in on this week.
export function sessionToDo(W, r, w, walkGoals, ckByGoal, moment) {
  if (!live(r) || !meetsIn(r, w)) return false;
  if (heldIn(W, r, w, walkGoals, moment)) return false;
  if (skippedWhileOff(W, r, w) && dayNum(moment) > sessionDay(W, r, w)) return false;
  if (dayNum(moment) >= sessionDay(W, r, w)) return true;
  return walkGoals.some((g) => (ckByGoal.get(g.id) || []).some((c) => c.week === w));
}
export const openActions = (W, r) => (W.requests || []).filter((a) => a.reviewId === r.id && a.kind === 'action' && a.status === 'open' && !a.removedAt).length;

// ---------- the agenda: exceptions first, worst and stalest; then the goals with nothing flagged ----------
const RANK = { off: 0, risk: 1, stale: 1, on: 2, done: 3, planned: 3, none: 3, unmeasured: 3 };
export function agenda(walkGoals, st) {
  const ex = [], ok = [];
  for (const g of walkGoals) { const s = st.get(g.id); (s.flags.some((f) => f !== 'due') ? ex : ok).push(g); }
  const posted = (g) => st.get(g.id).latest?.postedAt || '';
  ex.sort((a, b) => RANK[st.get(a.id).status] - RANK[st.get(b.id).status] || (posted(a) < posted(b) ? -1 : posted(a) > posted(b) ? 1 : 0) || a.title.localeCompare(b.title));
  ok.sort((a, b) => a.title.localeCompare(b.title));
  return { exceptions: ex, healthy: ok };
}

// ---------- deciding ----------
export function decisionFor(W, r, w, goal, latestCk, week) {
  const said = (W.requests || []).filter((a) => a.reviewId === r.id && a.week === w && a.kind === 'action' && a.goalIds.includes(goal.id) && a.recipientId && a.dueWeek != null && (a.status === 'open' || a.status === 'done'));
  if (said.length) return { kind: 'step', ask: said.at(-1) };
  const risk = (W.decisions || []).filter((d) => d.reviewId === r.id && d.week === w && d.goalId === goal.id && !d.removedAt && isAccept(d) && acceptedReason(d).trim().length >= 5);
  if (risk.length) return { kind: 'risk', reason: acceptedReason(risk.at(-1)) };
  const since = latestCk?.postedAt || '';
  const agreed = (W.requests || []).filter((a) => a.kind === 'action' && a.status === 'open' && a.goalIds.includes(goal.id) && a.recipientId && a.dueWeek != null && a.createdAt >= since && a.dueWeek >= week);
  if (agreed.length) return { kind: 'step', ask: agreed.at(-1) };
  return null;
}
export function lastTime(W, r, w) {
  const weeks = [...(W.decisions || []).filter((d) => d.reviewId === r.id && d.week < w).map((d) => d.week), ...(W.requests || []).filter((a) => a.reviewId === r.id && a.week < w).map((a) => a.week)];
  if (!weeks.length) return null;
  const pw = Math.max(...weeks);
  const order = { open: 0, overdue: 0, done: 1 };
  const actions = (W.requests || []).filter((a) => a.reviewId === r.id && a.week === pw && a.kind === 'action' && a.status !== 'withdrawn' && !a.removedAt)
    .map((a) => ({ a, state: a.status === 'done' ? 'done' : a.dueWeek != null && a.dueWeek < w ? 'overdue' : 'open' }))
    .sort((x, y) => order[x.state] - order[y.state] || (x.a.dueWeek ?? 99) - (y.a.dueWeek ?? 99));
  return { week: pw, day: sessionDay(W, r, pw), actions };
}
export function sessionDecisions(W, r, w) {
  const asks = (W.requests || []).filter((a) => a.reviewId === r.id && a.week === w && !a.removedAt && a.status !== 'withdrawn');
  const steps = new Map();
  for (const a of asks.filter((x) => x.kind === 'action')) { if (!steps.has(a.recipientId)) steps.set(a.recipientId, []); steps.get(a.recipientId).push(a); }
  const risks = (W.decisions || []).filter((d) => d.reviewId === r.id && d.week === w && isAccept(d) && !d.removedAt);
  const questions = asks.filter((a) => a.kind === 'question' && a.status === 'open');
  return { steps, risks, questions };
}
// What was said in a session: notes, and the questions and next steps raised in it, in order.
export function saidIn(W, r, w) {
  const notes = (W.decisions || []).filter((d) => d.reviewId === r.id && d.week === w && d.kind === 'note').map((d) => ({ kind: d.removedAt ? 'removed' : isAccept(d) ? 'risk' : 'note', at: d.at, goalId: d.goalId, by: d.byId, text: d.removedAt ? 'Note removed' : isAccept(d) ? acceptedReason(d) : d.note, edited: !!d.editedAt, id: d.id }));
  const asks = (W.requests || []).filter((a) => a.reviewId === r.id && a.week === w && !a.removedAt).map((a) => ({ kind: a.kind, at: a.createdAt, goalId: a.goalIds[0], by: a.askedBy, to: a.recipientId, text: a.ask, dueWeek: a.dueWeek, status: a.status, id: a.id }));
  return [...notes, ...asks].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// ---------- the drill's file: reviews.csv ----------
export function reviewsRows(W) {
  const rows = [];
  const w1 = currentWeek(W, W.builtFor);
  for (let w = 1; w <= w1; w++) {
    const held = heldOnDueDay(W, w);
    for (const on of [true, false]) {
      const d = dueWords(on, W.cycle, w, held);
      rows.push({ rule: 'due', week: w, reviews: on ? 'on' : 'off', held: held ? 'yes' : 'no', by: d.by, after: d.after, on_time: d.onTime, flag: d.flag, risks: '', due_day: '' });
    }
  }
  const c = switchOffReadBack(W);
  rows.push({ rule: 'readback', week: '', reviews: '', held: '', by: '', after: '', on_time: '', flag: '', risks: c.risks, due_day: c.dueDay });
  return rows;
}
export const REVIEWS_CSV_HEAD = ['rule', 'week', 'reviews', 'held', 'by', 'after', 'on_time', 'flag', 'risks', 'due_day'];

// ---------- the workbook ----------
export function sheetsWithReviews(on, sheets) {
  if (on) return sheets;
  return sheets.filter((s) => s.name !== 'Notes').map((s) => (s.name === 'Asks' ? { ...s, columns: s.columns.filter((c) => c !== 'Review') } : s));
}
export function importNote(on, wsName, file) {
  if (on) return null;
  const hasNotes = file.sheets.some((s) => s.name === 'Notes');
  const hasCol = file.sheets.some((s) => s.name === 'Asks' && s.columns.includes('Review'));
  if (!hasNotes && !hasCol) return null;
  const what = hasNotes && hasCol ? 'the Notes sheet and the Review column were' : hasNotes ? 'the Notes sheet was' : 'the Review column was';
  return `Reviews is off in ${wsName}, so ${what} not read.`;
}
