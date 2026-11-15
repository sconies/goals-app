// A goal's own summary as the core's scorecard words give it (spec/core/rules/scorecard.md), for rule 2's rows:
// status, now, target with its week, against plan. Read from the core's rules (S1, R); nothing worked out again.
import { fmt, amount, n } from './rules.mjs';

export function goalSummary(g, S1, R, moment) {
  const st = R.standing(moment).st.get(g.id) || { status: 'none' };
  const w = S1.currentWeek(moment);
  const posted = (R.standing(moment).ws.ckByGoal.get(g.id) || []);
  const d = g.decimals ?? 0;
  const byWeek = (due) => (due >= S1.WEEKS ? (S1.WEEKS >= 48 ? 'by year end' : 'by cycle end') : `by week ${due}`);
  const a = S1.assessPosted(g, posted, w, true);
  const actual = a.latest && a.latest.value !== null && a.latest.value !== undefined ? a.latest.value : null;
  let target = '', vsPlan = '';
  if (g.kind === 'metric' && g.plan) {
    const due = g.plan.endWeek ?? S1.WEEKS;
    target = `${fmt(g.plan.target, g.unit, d)} ${byWeek(due)}`;
    if (actual === null) vsPlan = 'No value yet';
    else {
      const better = g.plan.target >= g.plan.start ? 1 : -1;
      const diff = Number(((actual - a.plan) * better).toFixed(d));
      vsPlan = diff === 0 ? 'On plan' : `${amount(diff, g.unit, d)} ${diff > 0 ? 'ahead of plan' : 'behind plan'}`;
    }
  } else if (g.kind === 'range' && g.range) {
    const lim = fmt(g.range.limit, g.unit, d);
    target = `${g.range.bound === 'atLeast' ? '≥' : '≤'} ${lim} ${byWeek(S1.WEEKS)}`;
    if (actual === null) vsPlan = 'No value yet';
    else {
      const better = g.range.bound === 'atLeast' ? 1 : -1;
      const room = Number(((actual - g.range.limit) * better).toFixed(d));
      const margin = g.range.margin ?? 0;
      vsPlan = room < 0 ? `Outside the ${lim} limit` : room <= margin ? `Near the ${lim} limit` : `Within the ${lim} limit`;
    }
  }
  return {
    status: st.status, value: actual, unit: g.unit, decimals: d,
    now: actual === null ? 'No value yet' : fmt(actual, g.unit, d), target, vsPlan,
    owner: R.person.get(g.ownerId)?.name || '', latest: a.latest || null,
  };
}
export { n };
