// What Reviews puts on the core's rules object while it is on (R.ext): Home's review lead, the check-in lead on a
// review's day, a question's due date, and the deadline's words. Taken out of the core's stage3.mjs, unchanged in what it gives.
import * as RV from './rules.mjs';

export function reviewsExt(R, W) {
  const reviewById = (id) => (W.reviews || []).find((r) => r.id === id && !r.removedAt);
  const walk = (r, moment) => RV.goalsIn(r, R.standing(moment).ws.goals);
  const held = (r, w, moment) => RV.heldIn(W, r, w, walk(r, moment), moment);
  const mine = (viewer) => (W.reviews || []).filter((r) => RV.live(r) && r.people.includes(viewer));
  function sessionsToday(viewer, w, today, moment) {
    return mine(viewer).filter((r) => RV.meetsIn(r, w) && RV.sessionDay(W, r, w) === today && !held(r, w, moment));
  }
  // Home rule 4: a review the viewer is in, this week's, on or past its day, not held; the earliest, then by name.
  // A session whose day passed while Reviews was off is not "Not held yet" (U155).
  function homeLead(viewer, moment) {
    const today = RV.dayNum(moment), w = RV.currentWeek(W, moment);
    const rv = mine(viewer).filter((r) => RV.meetsIn(r, w) && today >= RV.sessionDay(W, r, w) && !held(r, w, moment) && !(today > RV.sessionDay(W, r, w) && RV.skippedWhileOff(W, r, w)))
      .sort((a, b) => RV.sessionDay(W, a, w) - RV.sessionDay(W, b, w) || a.name.localeCompare(b.name));
    if (!rv.length) return null;
    const { st } = R.standing(moment);
    const m = RV.marked(W, rv[0], w, moment);
    const left = walk(rv[0], moment).filter((g) => !m.has(g.id) && st.get(g.id).flags.some((f) => f !== 'due')).length;
    return { kind: 'review', title: `${left} goal${left === 1 ? '' : 's'} to discuss`, head: RV.sessionDay(W, rv[0], w) === today ? `${rv[0].name} is today` : `${rv[0].name} · Not held yet`, review: rv[0], begun: m.size > 0 };
  }
  // A question raised in a review is due before the review's next session after the one it was raised in.
  function askDue(a) {
    if (a.kind !== 'question' || !a.reviewId) return null;
    const r = reviewById(a.reviewId);
    if (!r) return null;
    let x = (a.week ?? RV.currentWeek(W, a.createdAt)) + 1;
    while (!RV.meetsIn(r, x) && x <= W.cycle.weeks + 1) x++;
    return RV.sessionDay(W, r, x);
  }
  const dueWords = (viewer, w) => RV.dueWords(true, W.cycle, w, RV.heldOnDueDay(W, w, viewer));
  return { reviewById, sessionsToday, homeLead, askDue, dueWords, walk, held };
}
