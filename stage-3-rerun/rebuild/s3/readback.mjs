// New goal's read-back (spec/core/rules/read-back.md), with the level it starts at (new-goal.md rule 1)
// and the questions it asks (goal-entry.md rule 3), each taken as answered with its first answer.
import { fold } from './finding.mjs';

const LEVEL_A = { 'north-star': 'a north star', svp: 'an SVP goal', team: 'a Team goal' };
const LEVEL_IT = { 'north-star': 'It’s a north star', svp: 'It’s an SVP goal', team: 'It’s a Team goal' };
const SHAPE = { straight: 'the same amount each week', back: 'slowly at first, faster near the end', steps: 'in a few jumps', jumps: 'in a few jumps', points: 'with the weeks’ numbers set by hand' };
const LEVELS = ['north-star', 'svp', 'team'];

const num = (s) => (s === '' || s === null || s === undefined ? null : Number(String(s).replace(/,/g, '')));
const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const withUnit = (v, unit, d = 0) => {
  const [i, f] = Number(v).toFixed(d).split('.');
  const s = group(i) + (f ? '.' + f : '');
  return !unit ? s : unit === '%' ? `${s}%` : `${s} ${unit}`;
};
const placesOf = (s) => { const m = String(s ?? '').match(/\.(\d+)$/); return m ? m[1].length : 0; };

// The year and week, said in a sentence.
export function weekSentence(core, w) {
  const year = Number(core.W.cycle.name) || Number(core.isoOfDay(core.START + 7).slice(0, 4));
  if (w >= 1 && w <= core.WEEKS) return `week ${w} (${core.weekDates(w)})`;
  if (w > core.WEEKS) return `week ${w - core.WEEKS} of ${year + 1} (${core.weekDates(w)})`;
  return `week ${w} (${core.weekDates(w)})`;
}

// Rule 1: the level a new goal starts at.
export function startLevel(core, draft) {
  if (draft.level && draft.levelChosen !== false && draft.level !== '' && draft.levelByHand !== false) return draft.level;
  return null;
}
export function levelFor(core, draft, given) {
  if (given && given.level) return given.level;
  const parent = draft.parentId && core.findGoal(draft.parentId);
  if (parent) { const i = LEVELS.indexOf(parent.level); return LEVELS[Math.min(LEVELS.length - 1, i + 1)]; }
  const leads = core.W.teams.filter((t) => t.leadId === draft.ownerId).map((t) => t.id);
  const top = core.W.goals.some((g) => !g.removedAt && !g.stoppedAt && leads.includes(g.teamId) && (g.level === 'north-star' || g.level === 'svp'));
  return top ? null : 'team';
}

// The reviews a goal as built joins (goalsIn applied to it).
export function reviewsJoining(core, goal) {
  if (!core.isOn('reviews')) return null;
  const goals = core.W.goals.filter((g) => !g.removedAt && !g.stoppedAt);
  const chain = [];
  let p = goal.parentId && core.goalById.get(goal.parentId);
  while (p) { chain.push(p.id); p = p.parentId && core.goalById.get(p.parentId); }
  return (core.W.reviews || []).filter((r) => {
    if (r.removedAt) return false;
    const sc = r.scope || {};
    return (sc.levels || []).includes(goal.level) || (sc.trees || []).some((t) => chain.includes(t)) || (sc.goals || []).includes(goal.id);
  });
}

// The questions (goal-entry rule 3) a new goal raises, in order, as their read-back sentences.
export function questionsSaid(core, d, level, at, viewer) {
  const out = [];
  const nowW = core.S1.currentWeek(at);
  const kind = d.kind;
  const unit = d.unit || '';
  const ptsD = d.decimalsUsed ?? 0;
  if (kind === 'milestone') {
    for (const s of d.stages || []) { const w = num(s.dueWeek); if (w !== null && w < nowW) out.push(`Done in week ${w}.`); }
  }
  if ((kind === 'metric' || kind === 'range') && !unit) out.push('You said it is a plain count, with no unit.');
  const nums = kind === 'metric' ? [num(d.start), num(d.target)] : kind === 'range' ? [num(d.limit)] : [];
  if (/^(%|percent|min|mins|hours|h|days|\$|£|€)$/i.test(unit) && nums.some((v) => v !== null && v < 0)) out.push(`You said ${withUnit(nums.find((v) => v < 0), unit, ptsD)} is right.`);
  if (unit === '%' && nums.some((v) => v !== null && v > 100)) out.push(`You said ${group(String(nums.find((v) => v > 100)))}% is right.`);
  if (kind === 'metric') {
    const a = num(d.start), b = num(d.target);
    if (a && b && (Math.abs(b / a) >= 100 || Math.abs(b / a) <= 0.01)) out.push(`You said ${withUnit(a, unit, ptsD)} to ${withUnit(b, unit, ptsD)} is right.`);
  }
  if (nums.some((v) => v !== null && Math.abs(v) >= 1e9)) out.push(`You said ${withUnit(nums.find((v) => Math.abs(v) >= 1e9), unit, ptsD)} is right.`);
  const team = core.teamById.get(d.teamId);
  const same = core.W.goals.find((g) => !g.removedAt && !g.stoppedAt && g.teamId === d.teamId && fold(g.title).trim() === fold(d.title).trim());
  if (same) out.push(`${team?.name} already has “${same.title}” (${same.key}); this is a different goal.`);
  const owner = core.personById.get(d.ownerId);
  if (owner && owner.id === viewer && owner.teamId && d.teamId && owner.teamId !== d.teamId) out.push(`${owner.name.split(' ')[0]} is in ${core.teamById.get(owner.teamId)?.name}; the goal stays in ${team?.name}.`);
  const parent = d.parentId && core.findGoal(d.parentId);
  if (parent && level && LEVELS.indexOf(parent.level) > LEVELS.indexOf(level)) out.push(`You said it feeds “${parent.title}”, ${LEVEL_A[parent.level]}.`);
  if (kind === 'range') { const m = num(d.margin), l = num(d.limit); if (m !== null && l !== null && m >= Math.abs(l)) out.push(`You said to warn within ${withUnit(m, unit, ptsD)}.`); }
  if (kind === 'metric') {
    const from = num(d.fromWeek), to = num(d.endWeek);
    if (from !== null && from < nowW) out.push(`You said it has been running since ${weekSentence(core, from)}.`);
    if (to !== null && to < nowW) out.push(`You said the target was due in week ${to}.`);
    const f = from ?? nowW, t = to ?? core.WEEKS;
    if (t - f > 53) out.push(`You said the plan runs ${t - f} weeks.`);
  }
  return out;
}

export function readBack(core, draftIn, viewer, at, { workspaceName, draftGiven = {} }) {
  const d = { ...draftIn };
  const { S1 } = core;
  const nowW = S1.currentWeek(at);
  const kind = d.kind;
  const unit = d.unit || '';
  const level = levelFor(core, d, draftGiven);
  // decimals: chosen, else the most typed
  const typed = kind === 'metric' ? [d.start, d.target] : kind === 'range' ? [d.limit, d.lower, d.margin] : [];
  const byValue = Math.min(3, Math.max(0, ...typed.map(placesOf)));
  const dec = d.decimals === '' || d.decimals === undefined ? byValue : Number(d.decimals);
  d.decimalsUsed = dec;
  const rows = [];

  // What
  if (kind === 'metric') {
    const a = num(d.start), b = num(d.target);
    const from = num(d.fromWeek) ?? nowW, to = num(d.endWeek) ?? core.WEEKS;
    rows.push(['What', `A number to move: from ${withUnit(a, unit, dec)} in ${weekSentence(core, from)} to ${withUnit(b, unit, dec)} by ${weekSentence(core, to)}, ${SHAPE[d.shape] ?? SHAPE.straight}. ${b > a ? 'Higher' : 'Lower'} is better.`]);
  } else if (kind === 'range') {
    const l = num(d.limit), lo = num(d.lower), m = num(d.margin);
    const bound = d.bound || 'atMost';
    const side = bound === 'atMost' ? `at or under ${withUnit(l, unit, dec)}` : bound === 'atLeast' ? `at or over ${withUnit(l, unit, dec)}` : `between ${withUnit(lo, unit, dec)} and ${withUnit(l, unit, dec)}`;
    rows.push(['What', `A number to keep in range: ${side}. ${m ? `It warns within ${withUnit(m, unit, dec)} of the limit.` : 'It warns only once the limit is crossed.'}`]);
  } else {
    const st = (d.stages || []).filter((s) => s.name);
    const last = Math.max(...st.map((s) => num(s.dueWeek)));
    const done = st.filter((s) => num(s.dueWeek) < nowW).length;
    rows.push(['What', `Dated stages: ${st.length} ${st.length === 1 ? 'stage' : 'stages'}, the last due ${weekSentence(core, last)}.${done ? ` ${done} already done.` : ''}`]);
  }
  // Who and where
  const owner = core.personById.get(d.ownerId), team = core.teamById.get(d.teamId);
  const parent = d.parentId && core.findGoal(d.parentId);
  let who = `${owner?.name} owns it, in ${team?.name}. ${level ? LEVEL_IT[level] : 'It has no level yet'} and feeds ${parent ? `“${parent.title}” (${parent.key}).` : 'nothing: it’s at the top of its own tree.'}`;
  const also = (d.alsoHelps || []).map((id) => core.findGoal(id)).filter(Boolean);
  if (also.length) who += ` It also helps ${also.map((g) => `“${g.title}”`).join(' and ')}.`;
  if (d.guardrail) who += ' It’s a guardrail.';
  rows.push(['Who and where', who]);
  // Measured by
  if (kind !== 'milestone') rows.push(['Measured by', d.definition ? `No metric: “${d.definition}”.` : 'No metric, and not described yet.']);
  // Left as usual
  const usual = [];
  if (kind !== 'milestone' && dec === byValue && dec === 0) usual.push('Whole numbers.');
  if (kind === 'metric' && !d.fromWeek && !d.endWeek) usual.push(`From this week to the end of ${core.W.cycle.name}.`);
  if (kind === 'metric' && (d.shape || 'straight') === 'straight') usual.push('Steady.');
  if (kind === 'range' && !num(d.margin)) usual.push('No early warning.');
  if (!d.guardrail) usual.push('Not a guardrail.');
  if (!also.length) usual.push('Helps no other goal.');
  if (usual.length) rows.push(['Left as usual', usual.join(' ')]);
  // You said
  const said = questionsSaid(core, d, level, at, viewer);
  if (said.length) rows.push(['You said', said.join(' ')]);

  // After you publish
  const after = [];
  const rhythm = S1.CHECKIN_WEEKS !== 0;
  const allDone = kind === 'milestone' && (d.stages || []).filter((s) => s.name).every((s) => num(s.dueWeek) < nowW);
  if (!rhythm) after.push('It shows as “No check-in yet” until you post its first number. Nothing is due.');
  else if (allDone) after.push('Every stage is already done, so no check-in is due.');
  else {
    const today = core.dayNum(at);
    let w = nowW;
    if (core.dueDay(w) < today) w++;
    const from = num(d.fromWeek);
    if (kind === 'metric' && from !== null && from > w) w = from;
    let s = `Its first check-in is due by ${core.fmtDay(core.dueDay(w))}, then every week.`;
    if (kind === 'metric') {
      const plan = { start: num(d.start), target: num(d.target), shape: d.shape || 'straight', fromWeek: num(d.fromWeek) ?? nowW, endWeek: num(d.endWeek) ?? core.WEEKS };
      const next = nowW + 1;
      s += ` The first number sets where it stands; the plan says ${withUnit(S1.planAt(plan, next), unit, dec)} for week ${next}.`;
    } else if (kind === 'range') s += ' It asks for this week’s number.';
    else s += ' It asks which stages are done.';
    after.push(s);
  }
  const mine = d.ownerId === viewer;
  const first = owner?.name.split(' ')[0];
  after.push(mine ? `Everyone in ${workspaceName} can see it.` : `${first} sees it on their Home the next time they open Faro. Faro doesn’t send email.`);
  const joins = reviewsJoining(core, { ...d, level, id: null });
  if (joins) {
    if (!joins.length) after.push('It joins no review yet.');
    else after.push(`It joins ${joins.length === 1 ? joins[0].name : joins.slice(0, -1).map((r) => r.name).join(', ') + ' and ' + joins[joins.length - 1].name}.`);
  }
  const someDone = kind === 'milestone' && (d.stages || []).some((s) => s.name && num(s.dueWeek) < nowW);
  if (someDone) after.push('Its stage already done is its first check-in, so it can be stopped, with a reason, but not deleted. A change to the plan needs a reason.');
  else after.push(mine ? 'Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason.'
    : `Only ${first} or an admin can change it once it is published. Until its first check-in they can change anything, or delete it.`);
  return { rows, after, level };
}
