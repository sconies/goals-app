// New goal's read-back (rule 5) and "After you publish", from spec/core/rules/read-back.md.
// A draft is the fields set over a blank goal (flat, as New goal keeps it): title, kind (metric | range | milestone), ownerId,
// teamId, level, parentId, alsoHelps, guardrail, unit, decimals, start, target, fromWeek, endWeek, shape, limit, bound, lower,
// margin, stages [{id, name, dueWeek, done}], definition, source.
export const READBACK_CASES = [];

const SHAPE = { linear: 'the same amount each week', back: 'slowly at first, faster near the end', stepped: 'in a few jumps', custom: 'with the weeks’ numbers set by hand' };
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export function fmtVal(v, unit, decimals = 0) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  const s = n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (!unit) return s;
  if (unit === '%') return `${s}%`;
  return `${s} ${unit}`;
}

export function startLevel(d, R, W, viewer) {
  if (d.level) return d.level;
  if (d.parentId) { const p = R.goalById.get(d.parentId); if (p) return p.level === 'north-star' ? 'svp' : 'team'; }
  const owner = d.ownerId || viewer;
  const leads = (W.teams || []).filter((t) => t.leadId === owner).map((t) => t.id);
  if ((W.goals || []).some((g) => leads.includes(g.teamId) && (g.level === 'north-star' || g.level === 'svp') && !g.removedAt && !g.stoppedAt)) return null;
  return 'team';
}

export function weekWords(R, x) {
  if (x > R.WEEKS) { const y = Number(String(R.yearName || '2026')) + 1; return `week ${x - R.WEEKS} of ${y} (${R.weekRange(x)})`; }
  return `week ${x} (${R.weekRange(x)})`;
}

// The questions New goal asks (goal entry rule 3) that the read-back repeats as "You said".
export function questionsFor(R, S1, d, moment) {
  const w = S1.currentWeek(moment);
  const out = [];
  const kind = d.kind || 'metric';
  if (kind === 'metric' && d.unit === '%' && num(d.target) > 100) out.push({ kind: 'over-100', field: 'target', text: `The target is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is ${fmtVal(d.target, '%')} right?`, said: `You said ${fmtVal(d.target, '%')} is right.` });
  if (kind === 'metric' && num(d.fromWeek) !== null && num(d.fromWeek) < w) out.push({ kind: 'past-plan', field: 'fromWeek', text: `From is ${weekWords(R, num(d.fromWeek))}, before this week. Has it been running since then?`, said: `You said it has been running since ${weekWords(R, num(d.fromWeek))}.` });
  if ((kind === 'metric' || kind === 'range') && !d.unit) out.push({ kind: 'no-unit', field: 'unit', text: 'This number has no unit. Is it a plain count?', said: 'You said it is a plain count.' });
  return out;
}

export function readBack(R, W, S1, viewer, draft, moment, opt = {}) {
  const d = { ...draft };
  const kind = d.kind || 'metric';
  const level = startLevel(d, R, W, viewer);
  const w = S1.currentWeek(moment);
  const today = S1.dayNum(moment);
  const owner = R.person.get(d.ownerId || viewer);
  const team = R.team.get(d.teamId ?? owner?.teamId);
  const dec = num(d.decimals) ?? 0;
  const helps = d.alsoHelps || [];
  const rows = [];
  const from = num(d.fromWeek) ?? w, to = num(d.endWeek) ?? R.WEEKS;
  if (kind === 'metric') {
    const up = num(d.target) > num(d.start);
    rows.push(['What', `A number to move: from ${fmtVal(d.start, d.unit, dec)} in ${weekWords(R, from)} to ${fmtVal(d.target, d.unit, dec)} by ${weekWords(R, to)}, ${SHAPE[d.shape || 'linear'] || SHAPE.linear}. ${up ? 'Higher' : 'Lower'} is better.`]);
  } else if (kind === 'range') {
    const bound = d.bound === 'atLeast' ? `at or over ${fmtVal(d.limit, d.unit, dec)}` : d.bound === 'between' ? `between ${fmtVal(d.lower, d.unit, dec)} and ${fmtVal(d.limit, d.unit, dec)}` : `at or under ${fmtVal(d.limit, d.unit, dec)}`;
    const warn = num(d.margin) ? `It warns within ${fmtVal(d.margin, d.unit, dec)} of the limit.` : 'It warns only once the limit is crossed.';
    rows.push(['What', `A number to keep in range: ${bound}. ${warn}`]);
  } else {
    const st = d.stages || [];
    const last = Math.max(...st.map((s) => num(s.dueWeek)));
    let s = `Dated stages: ${st.length} stage${st.length === 1 ? '' : 's'}, the last due ${weekWords(R, last)}.`;
    const done = st.filter((x) => x.done).length;
    const overdue = st.filter((x) => !x.done && num(x.dueWeek) < w).length;
    if (done) s += ` ${done === 1 ? 'One is' : `${done} are`} already done.`;
    if (overdue) s += ` ${overdue === 1 ? 'One is' : `${overdue} are`} overdue.`;
    rows.push(['What', s]);
  }
  const lvl = level ? { 'north-star': 'a north star', svp: 'an SVP goal', team: 'a Team goal' }[level] : 'a goal with no level yet';
  const parent = d.parentId ? R.goalById.get(d.parentId) : null;
  let who = `${owner?.name ?? 'Nobody'} owns it, in ${team?.name ?? 'no team'}. It’s ${lvl} and ${parent ? `feeds “${parent.title}” (${parent.key}).` : 'feeds nothing: it’s at the top of its own tree.'}`;
  if (helps.length) who += ` It also helps ${helps.map((id) => `“${R.goalById.get(id)?.title}”`).join(' and ')}.`;
  if (d.guardrail) who += ' It’s a guardrail.';
  rows.push(['Who and where', who]);
  if (kind !== 'milestone') rows.push(['Measured by', d.definition ? `No metric: “${d.definition}”.` : 'No metric, and not described yet.']);
  const left = [];
  if (kind !== 'milestone' && !num(d.decimals)) left.push('Whole numbers.');
  if (kind === 'metric' && from === w && to === R.WEEKS) left.push(`From this week to the end of ${W.cycle.name}.`);
  if (kind === 'metric' && (!d.shape || d.shape === 'linear')) left.push('Steady.');
  if (kind === 'range' && !num(d.margin)) left.push('No early warning.');
  if (!d.guardrail) left.push('Not a guardrail.');
  if (!helps.length) left.push('Helps no other goal.');
  if (left.length) rows.push(['Left as usual', left.join(' ')]);
  const said = (opt.answered ?? questionsFor(R, S1, d, moment)).map((q) => q.said);
  if (said.length) rows.push(['You said', said.join(' ')]);

  const after = [];
  const stages = d.stages || [];
  const allDone = kind === 'milestone' && stages.length && stages.every((s) => s.done);
  let firstWeek = R.dueDay(w) < today ? w + 1 : w;
  if (kind === 'metric' && from > firstWeek) firstWeek = from;
  if (allDone) after.push('Every stage is already done, so no check-in is due.');
  else if (opt.rhythm === false) after.push('It shows as “No check-in yet” until you post its first number. Nothing is due.');
  else {
    let s = `Its first check-in is due by ${R.dayLong(R.dueDay(firstWeek))}, then every week.`;
    if (kind === 'metric') {
      const nx = w + 1;
      const plan = { start: num(d.start), target: num(d.target), fromWeek: from, endWeek: to, shape: d.shape || 'linear' };
      s += ` The first number sets where it stands; the plan says ${fmtVal(Number(S1.planAt(plan, nx).toFixed(dec)), d.unit, dec)} for week ${nx}.`;
    } else if (kind === 'range') s += ' It asks for this week’s number.';
    else s += ' It asks which stages are done.';
    after.push(s);
  }
  const mine = (d.ownerId || viewer) === viewer;
  if (mine) after.push(`Everyone in ${opt.workspace || 'Platform Engineering'} can see it.`);
  else after.push(`${R.firstName(d.ownerId)} sees it on their Home the next time they open Faro. Faro doesn’t send email.`);
  if (opt.reviewsOn !== false) {
    const built = { id: '__new', parentId: d.parentId || null, level, teamId: d.teamId };
    const { ws } = R.standing(moment);
    const joins = (W.reviews || []).filter((r) => !r.removedAt && !r.endedAt && R.goalsIn(r, [...ws.goals, built]).some((g) => g.id === '__new'));
    if (!joins.length) after.push('It joins no review yet.');
    else if (joins.length === 1) {
      const r = joins[0];
      const why = r.scope.levels.includes(level) ? `, which walks every ${level === 'north-star' ? 'north star' : level === 'svp' ? 'SVP goal' : 'Team goal'}` : '';
      after.push(`It joins ${r.name}${why}.`);
    } else after.push(`It joins ${joins.slice(0, -1).map((r) => r.name).join(', ')} and ${joins[joins.length - 1].name}.`);
  }
  const doneStages = stages.filter((s) => s.done).length;
  if (doneStages) after.push(`Its stage${doneStages === 1 ? '' : 's'} already done ${doneStages === 1 ? 'is' : 'are'} its first check-in, so it can be stopped, with a reason, but not deleted. A change to the plan needs a reason.`);
  else if (mine) after.push('Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason.');
  else after.push(`Only ${R.firstName(d.ownerId)} or an admin can change it once it is published. Until its first check-in they can change anything, or delete it.`);
  return { rows, after, level };
}

export function readBackRow(R, W, S1, c) {
  const draft = typeof c.draft === 'string' ? JSON.parse(c.draft) : c.draft;
  const rb = readBack(R, W, S1, c.viewer, draft, W.builtFor);
  return { case: c.case, viewer: c.viewer, draft: typeof c.draft === 'string' ? c.draft : JSON.stringify(c.draft), rows: rb.rows.map(([l, s]) => `${l}: ${s}`).join(' | '), after: rb.after.join(' | ') };
}
