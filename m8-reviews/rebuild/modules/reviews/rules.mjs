// Reviews' rules (spec/modules/reviews/rules.md and the stage 8 page), pure: no screens, no store, no network.
// Each takes whether Reviews is on as an input, as the core rules do.
import { hasSession, sessionDay, walkOf, reviewedIn, shortDay, weekdayName, DAY } from '../../home.mjs';

export const ACCEPT = 'We accept the risk: ';
const live = (r) => r && !r.endedAt && !r.removedAt;

// heldOnDueDay: a review not ended or removed, whose weekday is the cycle's due day, with a session that week
export function heldOnDueDay(W, S1, week, { people = null } = {}) {
  return (W.reviews || []).some((r) => live(r) && r.weekday === S1.REVIEW_DAY && hasSession(r, week) && (!people || (r.people || []).some((p) => people.includes(p))));
}

// RS1: one phrase for the clock
export function dueWords(reviewsOn, S1, week, held) {
  const dd = S1.START + 7 * week + S1.REVIEW_DAY;
  const day = weekdayName(dd);
  const rv = reviewsOn && held;
  return {
    by: rv ? `before ${day}’s review` : `by ${day}`,
    after: rv ? `after ${day}’s review` : `after ${day}`,
    label: rv ? 'before the review' : 'on time',
    flag: `Due by ${shortDay(dd)}.`,
    day,
  };
}
// The receipt once all of a person's check-ins are in (no review in it, ever)
export function receiptText(n, S1, week, postedDay) {
  const dd = S1.START + 7 * week + S1.REVIEW_DAY;
  const day = weekdayName(dd);
  const all = n === 1 ? 'Your check-in is' : `All ${n} of your check-ins are`;
  if (postedDay <= dd) return `${all} in by ${day}.`;
  return `${n === 1 ? 'Your check-in is' : `All ${n} of your check-ins are`} in. ${n === 1 ? 'It came' : 'All of them came'} after ${day}.`;
}

// RS2 and the read-back before switching off: what stays
const isNote = (d) => d.kind === 'note';
export function acceptedRisks(W) {
  const goals = new Map((W.goals || []).map((g) => [g.id, g]));
  return (W.decisions || []).filter((d) => isNote(d) && !d.removedAt && String(d.note || '').startsWith(ACCEPT.trim()) && goals.get(d.goalId) && !goals.get(d.goalId).removedAt).length;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export function switchOffReadBack(W, S1) {
  const reviews = (W.reviews || []).filter(live);
  const ids = new Set((W.reviews || []).map((r) => r.id));
  const said = (W.decisions || []).filter((d) => d.reviewId && ids.has(d.reviewId) && !d.removedAt && (d.kind === 'note' || d.kind === 'acknowledge')).length;
  const open = (W.requests || []).filter((a) => a.reviewId && a.status === 'open');
  const steps = open.filter((a) => a.kind === 'action').length, questions = open.filter((a) => a.kind === 'question').length;
  const risks = acceptedRisks(W);
  const day = weekdayName(S1.START + S1.REVIEW_DAY);
  const lines = [`${plural(reviews.length, 'review stays', 'reviews stay')} as ${reviews.length === 1 ? 'it is' : 'they are'}, with ${reviews.length === 1 ? 'its' : 'their'} people and cadence.`];
  if (said) lines.push(`${plural(said, 'thing said in a review stays', 'things said in reviews stay')} in History.`);
  if (steps) lines.push(`${plural(steps, 'open next step stays', 'open next steps stay')} on ${steps === 1 ? 'its owner’s' : 'their owners’'} Home.`);
  if (questions) lines.push(`${plural(questions, 'open question raised in a review stays', 'open questions raised in a review stay')} open.`);
  if (risks) lines.push(`${plural(risks, 'accepted risk stays', 'accepted risks stay')} on their goals, as they were said. No new one can be accepted while Reviews is off.`);
  lines.push(`Check-ins are still due by ${day}. “Before the review” becomes “by ${day}” on Home, in the check-in and in the count of goals checked in on time.`);
  lines.push('Switching it back on brings every review back as it was.');
  return { reviews: reviews.length, said, steps, questions, risks, dueDay: day, lines };
}

// writesReviews: whatever touches Reviews' records (not a list of actions)
export function writesReviews(action, input = {}, W = {}) {
  if (input.reviewId || input.review || input.proposedIn || input.cadence) return true;
  if (['saveReview', 'endReview', 'deleteReview', 'reviewCall', 'acceptRisk', 'markReviewed', 'unmarkReviewed'].includes(action)) return true;
  if (['editNote', 'deleteNote', 'editCall'].includes(action)) { const d = (W.decisions || []).find((x) => x.id === input.noteId); return !!(d && d.reviewId); }
  if (['undoRemoval', 'restoreRemoved'].includes(action)) return input.entity === 'review' || !!(W.reviews || []).find((r) => r.id === input.id);
  return false;
}

// The agenda: needing attention first, then worst, then stalest
const RANK = { off: 0, risk: 1, stale: 2, on: 3, done: 4 };
export function agenda(W, S1, r, moment) {
  const ws = S1.asOf(moment);
  return walkOf(W, ws, r).map((g) => {
    const fl = S1.flagsFor(g, ws, moment);
    const needs = fl.flags.some((x) => x !== 'due') && !S1.handledFor(g, ws, moment, fl);
    return { g, status: fl.st.status, days: fl.st.days ?? 0, needs };
  }).sort((a, b) => (b.needs - a.needs) || ((RANK[a.status] ?? 9) - (RANK[b.status] ?? 9)) || (b.days - a.days) || (a.g.key < b.g.key ? -1 : 1));
}

// Where this session stands, and the next session's date. A session whose date passed while Reviews was off moves on (offSpell).
export function lastSessionWeek(r, w) { for (let x = w; x >= 1; x--) if (hasSession(r, x)) return x; return null; }
export function sessionState(W, S1, r, moment, offSpell = null) {
  const today = S1.dayNum(moment), w = S1.currentWeek(moment);
  let sw = null;
  for (let x = w; x >= 1; x--) if (hasSession(r, x) && sessionDay(S1, r, x) <= today) { sw = x; break; }
  const nextW = (from) => { for (let x = from; x <= S1.WEEKS + 60; x++) if (hasSession(r, x) && sessionDay(S1, r, x) >= today) return x; return null; };
  if (sw != null && offSpell && sessionDay(S1, r, sw) >= offSpell.from && sessionDay(S1, r, sw) <= offSpell.to && sessionDay(S1, r, sw) < today) {
    const done = reviewedIn(W, r, sw, moment);
    if (!done.size) { const n = nextW(sw + 1); return { state: 'next', week: n, day: n != null ? sessionDay(S1, r, n) : null, words: n != null ? `Next on ${shortDay(sessionDay(S1, r, n))}` : 'No session left' }; }
  }
  if (sw == null) { const n = nextW(1); return { state: 'next', week: n, day: n != null ? sessionDay(S1, r, n) : null, words: n != null ? `Next on ${shortDay(sessionDay(S1, r, n))}` : 'No session left' }; }
  const walk = agenda(W, S1, r, moment).map((x) => x.g.id);
  const done = reviewedIn(W, r, sw, moment);
  const n = walk.filter((id) => done.has(id)).length;
  const held = (W.decisions || []).filter((d) => d.reviewId === r.id && d.week === sw && !d.removedAt).map((d) => d.at).sort().pop();
  if (!n) return { state: 'not-started', week: sw, day: sessionDay(S1, r, sw), words: 'Not held yet' };
  if (n < walk.length) return { state: 'in-progress', week: sw, day: sessionDay(S1, r, sw), words: `In progress · ${n} of ${walk.length} reviewed` };
  return { state: 'held', week: sw, day: sessionDay(S1, r, sw), words: `Held ${shortDay(S1.dayNum(held))}` };
}
export const openActions = (W, r) => (W.requests || []).filter((a) => a.reviewId === r.id && a.kind === 'action' && a.status === 'open').length;
export const cadenceWords = (r) => `Every ${r.everyWeeks === 1 ? 'week' : `${r.everyWeeks} weeks`}, ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][r.weekday]}s`;
export { DAY };

// The workbook's Reviews parts (criterion 11): no Notes sheet and no Review column on Asks while off; a file that has them
// loads as usual, and the preview says once what wasn't read, naming only the parts the file has.
export const ASK_COLUMNS = ['Goal key', 'Kind', 'Asked by', 'Asked of', 'Ask', 'Status', 'Due week', 'Answer'];
export function workbookShape(reviewsOn) {
  return { sheets: ['Start here', 'Goals', 'Plan', 'Check-ins', 'People', 'Asks', ...(reviewsOn ? ['Notes'] : [])], askColumns: reviewsOn ? [...ASK_COLUMNS, 'Review'] : ASK_COLUMNS };
}
export function importNotice(reviewsOn, wsName, file) {
  if (reviewsOn) return { notice: null, read: file.sheets };
  const notes = file.sheets.includes('Notes'), col = (file.askColumns || []).includes('Review');
  const read = file.sheets.filter((s) => s !== 'Notes');
  if (!notes && !col) return { notice: null, read };
  const what = notes && col ? 'the Notes sheet and the Review column were' : notes ? 'the Notes sheet was' : 'the Review column was';
  return { notice: `Reviews is off in ${wsName}, so ${what} not read.`, read };
}
