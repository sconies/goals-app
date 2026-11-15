// New goal's last step: the read-back (rules/read-back.md), the level it starts at (rules/new-goal.md rule 1),
// and the questions it answers (rules/goal-entry.md rule 3, the ones a draft here can raise).
import { longDay, dayDate } from './home.mjs';
import { levelsOf } from './screens.mjs';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LEVEL_ARTICLE = { 'north-star': 'a north star', svp: 'an SVP goal', team: 'a Team goal' };
export const levelArticle = (W, id) => LEVEL_ARTICLE[id] || `a ${(levelsOf(W).find((l) => l.id === id) || { name: id }).name} goal`;

export function weekRange(S1, w) {
  const a = dayDate(S1.START + 7 * w), b = dayDate(S1.START + 7 * w + 6);
  const ya = a.getUTCFullYear(), yb = b.getUTCFullYear(), ma = a.getUTCMonth(), mb = b.getUTCMonth();
  if (ya !== yb) return `${a.getUTCDate()} ${MON[ma]} ${ya}–${b.getUTCDate()} ${MON[mb]} ${yb}`;
  if (ma !== mb) return `${a.getUTCDate()} ${MON[ma]}–${b.getUTCDate()} ${MON[mb]} ${yb}`;
  return `${a.getUTCDate()}–${b.getUTCDate()} ${MON[mb]} ${yb}`;
}
export function weekWords(W, S1, w) {
  if (w > S1.WEEKS) return `week ${w - S1.WEEKS} of ${Number(W.cycle.name) + 1} (${weekRange(S1, w)})`;
  return `week ${w} (${weekRange(S1, w)})`;
}
export const withUnit = (v, unit) => (!unit ? String(v) : unit === '%' ? `${v}%` : `${v} ${unit}`);
const num = (s) => (s === '' || s === null || s === undefined ? null : Number(s));
const SHAPE = { straight: 'the same amount each week', back: 'slowly at first, faster near the end', stepped: 'in a few jumps', custom: 'with the weeks’ numbers set by hand' };

// rule 1: the level a new goal starts at, for the person adding it
export function startLevel(W, parentId, viewer) {
  const levels = levelsOf(W);
  const parent = parentId ? (W.goals || []).find((g) => g.id === parentId) : null;
  if (parent) { const i = levels.findIndex((l) => l.id === parent.level); return levels[Math.min(i + 1, levels.length - 1)].id; }
  const leads = (W.teams || []).filter((t) => t.leadId === viewer).map((t) => t.id);
  const top = levels.slice(0, -1).map((l) => l.id);
  if ((W.goals || []).some((g) => !g.removedAt && leads.includes(g.teamId) && top.includes(g.level))) return null;
  return levels[levels.length - 1].id;
}

// reviewsJoining: goalsIn applied to the goal as built
export function reviewsJoining(W, goal) {
  const chain = [];
  let p = goal.parentId;
  const seen = new Set();
  while (p && !seen.has(p)) { seen.add(p); chain.push(p); const g = (W.goals || []).find((x) => x.id === p); p = g ? g.parentId : null; }
  return (W.reviews || []).filter((r) => !r.endedAt && !r.removedAt).filter((r) => {
    const sc = r.scope || {};
    return (sc.goals || []).includes(goal.id) || (sc.levels || []).includes(goal.level) || (sc.trees || []).some((t) => t === goal.id || chain.includes(t));
  });
}
const names = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// the questions a draft raises (goalChecks), in rule 3's order; each with its read-back sentence once answered
export function draftChecks(W, S1, d, week) {
  const out = [];
  if (d.kind === 'metric') {
    const start = num(d.start), target = num(d.target);
    if (d.unit === '%' && target !== null && target > 100) out.push({ kind: 'over-100', field: 'target', q: `The target is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is ${withUnit(target, '%')} right?`, said: `You said ${withUnit(target, d.unit)} is right.` });
    else if (start && target !== null && (Math.abs(target / start) >= 100 || Math.abs(target / start) <= 0.01) && target !== 0) out.push({ kind: 'hundredfold', field: 'target', q: `The target is 100 times the start or more. Is ${withUnit(target, d.unit)} right?`, said: `You said ${withUnit(target, d.unit)} is right.` });
    if (!d.unit) out.unshift({ kind: 'no-unit', field: 'unit', q: 'This number has no unit. Is it a plain count?', said: 'You said it is a plain count.' });
    const from = num(d.fromWeek);
    if (from !== null && from < week) out.push({ kind: 'from-past', field: 'fromWeek', q: `Week ${from} was ${week - from} weeks ago. Has this been running since then?`, said: `You said it has been running since ${weekWords(W, S1, from)}.` });
    const end = num(d.endWeek);
    if (end !== null && end - (from ?? week) > 53) out.push({ kind: 'too-long', field: 'endWeek', q: `This plan runs ${end - (from ?? week)} weeks, to ${weekWords(W, S1, end)}. Is that right?`, said: `You said it runs to ${weekWords(W, S1, end)}.` });
  }
  if (d.kind === 'milestone') for (const s of d.stages || []) {
    const due = num(s.dueWeek);
    if (due !== null && due < week) out.push({ kind: 'stage-past', field: `stage:${s.id}`, q: `Week ${due} was ${week - due} weeks ago. Is this stage already done?`, said: `You said ${s.name} is already done.` });
  }
  return out;
}

export function readBack(W, S1, d, viewer, m, { on, wsName, answered = null }) {
  const week = S1.currentWeek(m);
  const people = (W.people || []);
  const person = (id) => people.find((p) => p.id === id);
  const team = (id) => (W.teams || []).find((t) => t.id === id);
  const level = d.level || 'team';
  const rows = [];
  // What
  const unit = d.unit || '';
  if (d.kind === 'metric') {
    const start = num(d.start), target = num(d.target);
    const from = num(d.fromWeek) ?? week, end = num(d.endWeek) ?? S1.WEEKS;
    rows.push({ label: 'What', step: 'what', text: `A number to move: from ${withUnit(start, unit)} in ${weekWords(W, S1, from)} to ${withUnit(target, unit)} by ${weekWords(W, S1, end)}, ${SHAPE[d.shape] || SHAPE.straight}. ${target >= start ? 'Higher' : 'Lower'} is better.` });
  } else if (d.kind === 'range') {
    const lim = num(d.limit), low = num(d.lower), mg = num(d.margin);
    const what = d.bound === 'atMost' ? `at or under ${withUnit(lim, unit)}` : d.bound === 'atLeast' ? `at or over ${withUnit(lim, unit)}` : `between ${withUnit(low, unit)} and ${withUnit(lim, unit)}`;
    rows.push({ label: 'What', step: 'what', text: `A number to keep in range: ${what}. ${mg ? `It warns within ${withUnit(mg, unit)} of the limit.` : 'It warns only once the limit is crossed.'}` });
  } else {
    const st = (d.stages || []).filter((s) => s.name || s.dueWeek !== '');
    const last = Math.max(...st.map((s) => num(s.dueWeek)));
    const doneN = st.filter((s) => num(s.dueWeek) < week && (answered ? answered[`stage:${s.id}`] !== 'no' : true)).length;
    rows.push({ label: 'What', step: 'what', text: `Dated stages: ${st.length} ${st.length === 1 ? 'stage' : 'stages'}, the last due ${weekWords(W, S1, last)}.${doneN ? ` ${doneN} ${doneN === 1 ? 'is' : 'are'} already done.` : ''}` });
  }
  // Who and where
  const owner = person(d.ownerId), t = team(d.teamId);
  const parent = d.parentId ? (W.goals || []).find((g) => g.id === d.parentId) : null;
  let who = `${owner ? owner.name : 'Nobody'} owns it, in ${t ? t.name : 'no team'}. It’s ${levelArticle(W, level)} and feeds ${parent ? `“${parent.title}” (${parent.key}).` : 'nothing: it’s at the top of its own tree.'}`;
  const also = (d.alsoHelps || []).map((id) => (W.goals || []).find((g) => g.id === id)).filter(Boolean);
  if (also.length) who += ` It also helps ${names(also.map((g) => `“${g.title}”`))}.`;
  if (d.guardrail) who += ' It’s a guardrail.';
  rows.push({ label: 'Who and where', step: 'who', text: who });
  // Measured by
  if (d.kind !== 'milestone') rows.push({ label: 'Measured by', step: 'measure', text: d.metric ? `${d.metric.name}, for ${d.metric.slice}.` : d.definition ? `No metric: “${d.definition}”.` : 'No metric, and not described yet.' });
  // Left as usual
  const left = [];
  if (d.kind !== 'milestone' && (d.decimals === '' || Number(d.decimals) === 0)) left.push('Whole numbers.');
  if (d.kind === 'metric' && (d.fromWeek === undefined || d.fromWeek === '') && (d.endWeek === '' || d.endWeek === undefined)) left.push(`From this week to the end of ${W.cycle.name}.`);
  if (d.kind === 'metric' && (d.shape || 'straight') === 'straight') left.push('Steady.');
  if (d.kind === 'range' && !num(d.margin)) left.push('No early warning.');
  if (!d.guardrail) left.push('Not a guardrail.');
  if (!also.length) left.push('Helps no other goal.');
  if (left.length) rows.push({ label: 'Left as usual', step: 'measure', text: left.join(' ') });
  // You said
  const checks = draftChecks(W, S1, d, week);
  if (checks.length) rows.push({ label: 'You said', text: checks.map((c) => c.said).join(' ') });

  // After you publish
  const after = [];
  const ownerFirst = owner ? owner.name.split(' ')[0] : 'They';
  const allDone = d.kind === 'milestone' && (d.stages || []).length && (d.stages || []).every((s) => num(s.dueWeek) < week);
  const someDone = d.kind === 'milestone' && (d.stages || []).some((s) => num(s.dueWeek) < week);
  if (S1.CHECKIN_WEEKS === 0) after.push('It shows as “No check-in yet” until you post its first number. Nothing is due.');
  else if (allDone) after.push('Every stage is already done, so no check-in is due.');
  else {
    const from = num(d.fromWeek);
    let w1 = Math.max(week, d.kind === 'metric' && from !== null && from > week ? from : week);
    let dueDay = S1.START + 7 * w1 + S1.REVIEW_DAY;
    if (dueDay < S1.dayNum(m)) dueDay += 7;
    let s = `Its first check-in is due by ${longDay(dueDay)}, then every week.`;
    if (d.kind === 'metric') {
      const plan = { start: num(d.start), target: num(d.target), shape: d.shape || 'straight', fromWeek: from ?? week, endWeek: num(d.endWeek) ?? S1.WEEKS };
      const dec = num(d.decimals) || 0;
      const v = Number(S1.planAt(plan, week + 1).toFixed(dec));
      s += ` The first number sets where it stands; the plan says ${withUnit(v, unit)} for week ${week + 1}.`;
    } else if (d.kind === 'range') s += ' It asks for this week’s number.';
    else s += ' It asks which stages are done.';
    after.push(s);
  }
  const mine = d.ownerId === viewer;
  after.push(mine ? `Everyone in ${wsName} can see it.` : `${ownerFirst} sees it on their Home the next time they open Faro. Faro doesn’t send email.`);
  if (on('reviews')) {
    const rv = reviewsJoining(W, { ...d, level, id: d.id || '' });
    after.push(rv.length ? `It joins ${names(rv.map((r) => r.name))}.` : 'It joins no review yet.');
  }
  if (someDone) after.push('Its stage already done is its first check-in, so it can be stopped, with a reason, but not deleted. A change to the plan needs a reason.');
  else after.push(mine ? 'Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason.' : `Only ${ownerFirst} or an admin can change it once it is published. Until its first check-in they can change anything, or delete it.`);
  return { rows, after, level, checks };
}
