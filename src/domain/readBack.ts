/* The read-back (goal entry, rule 5; GE3): New goal's last step says the goal back in sentences before it is published:
   what it is, who owns it and where it fits, what measures it, what was left as usual and what you said to its
   questions; then what happens after you publish (when the first check-in is due, who sees it, the reviews it joins and
   how long it can still be taken back). `reviewsJoining` says which reviews walk a goal as built (goalsIn, applied to it).

   Its own file, beside goalEntry, so it loads with New goal and adds nothing to the first download. Pure: it reads the
   draft and what its context names, never the workspace (AR4). Weeks are said by domain/weeks, plans by domain/plan, the
   due day by domain/progress and the levels' words by goal entry's own `aLevel`: nothing here restates a rule. */
import { decimalsFor, planSpanOf, aLevel } from './goalEntry';
import { withPoints, type GoalDraft } from './goal';
import { fmt } from './format';
import { parseNumber } from './numbers';
import { isTop, levelName, type LevelsOf } from './levels';
import { planAt } from './plan';
import { firstReview, reviewDate, WEEKDAY } from './progress';
import { goalsIn, treeOf } from './review';
import { LABEL } from './vocabulary';
import { cycleYear, weekSays } from './weeks';
import { measureEmpty } from './proposed';
import { MEASURE_UNSAID } from './proposedSummary';
import type { Cycle, Goal, Level, MetricPlan, Review } from './types';

/** What the read-back reads besides the draft (rule 5's ctx). Each is named; nothing is looked up. */
export interface ReadBackContext {
  cycle: Cycle;
  /** This week, and today, for when the first check-in is due. */
  week: number;
  today: Date;
  /** The level as New goal has it (rule 1, or chosen); null while none is. */
  level: Level | null;
  owner: { name: string; isViewer: boolean } | null;
  teamName: string;
  parent: { title: string; key?: string } | null;
  /** The titles of the goals it also helps. */
  alsoHelps: string[];
  /** What measures it, from the goal.measure place, in words without “Measured by” (“Lead time for changes, for CI/CD.”); null for none. */
  metric: string | null;
  /** The read-back sentence of each answered question, in section 4's order. */
  answers: string[];
  /** The check-in rhythm and the Reviews switch (FT); until they exist, weekly and on. */
  rhythm: 'weekly' | 'none';
  reviewsOn: boolean;
  reviewsJoined: { name: string; why: string }[];
  wsName: string;
  /** "Is it under way?" (GE10, rule 14): 'proposed' says what proposing does instead of what publishing does. */
  state?: 'active' | 'proposed';
}

export interface ReadBackRow { id: 'what' | 'who' | 'measured' | 'usual' | 'said'; label: string; text: string; step: number | null }
export interface ReadBack { rows: ReadBackRow[]; after: string[]; /** Under "After you propose it": the quieter last line. */ hint?: string }

const SHAPE_WORDS = { straight: 'the same amount each week', back: 'slowly at first, faster near the end', stepped: 'in a few jumps' } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const handSet = (d: Pick<GoalDraft, 'points'>) => Object.values(d.points).some((v) => v.trim() !== '' && parseNumber(v) != null);
const first = (name: string) => name.split(' ')[0] ?? name;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** A number goal's plan as the draft has it, with its weeks (rule 13) and any weeks set by hand. */
function draftPlan(d: GoalDraft, c: ReadBackContext): (MetricPlan & { from: number; to: number }) | null {
  const s = parseNumber(d.start), t = parseNumber(d.target);
  if (d.kind !== 'metric' || s == null || t == null) return null;
  const span = planSpanOf(d, { week: c.week, cycleWeeks: c.cycle.weeks, existing: null, startDate: c.cycle.startDate });
  const plan = withPoints({ start: s, target: t, shape: d.shape, fromWeek: span.from, endWeek: span.to }, d.points, c.cycle.weeks);
  return { ...plan, from: span.from, to: span.to };
}

/**
 * Rule 5's "Left as usual": every default not changed, as short sentences, each with the step it is on. Said by value, so
 * a default chosen again by hand still reads as usual. In the order section 2.5 lists them: the measure step's first.
 */
export function leftAsUsual(d: GoalDraft, c: Pick<ReadBackContext, 'cycle' | 'week'>): { text: string; step: number }[] {
  const out: { text: string; step: number }[] = [];
  if (d.kind !== 'milestone' && (decimalsFor(d) ?? 0) === 0) out.push({ text: 'Whole numbers.', step: 2 });
  if (d.kind === 'metric') {
    const span = planSpanOf(d, { week: c.week, cycleWeeks: c.cycle.weeks, existing: null, startDate: c.cycle.startDate });
    const fromNow = span.from === c.week, toEnd = span.to === c.cycle.weeks, year = cycleYear(c.cycle);
    if (fromNow && toEnd) out.push({ text: `From this week to the end of ${year}.`, step: 2 });
    else if (fromNow) out.push({ text: 'From this week.', step: 2 });
    else if (toEnd) out.push({ text: `To the end of ${year}.`, step: 2 });
    if (d.shape === 'straight' && !handSet(d)) out.push({ text: 'Steady.', step: 2 });
  }
  if (d.kind === 'range' && !d.margin.trim()) out.push({ text: 'No early warning.', step: 2 });
  // "Feeds nothing" is said once, in Who and where ("… and feeds nothing: it's at the top of its own tree.").
  if (!d.guardrail) out.push({ text: 'Not a guardrail.', step: 1 });
  if (!(d.alsoHelps ?? []).length) out.push({ text: 'Helps no other goal.', step: 1 });
  return out;
}

/** "Thursday 12 Nov": the weekday and date a check-in is due by (with the year when it isn't today's). */
function dueWords(c: ReadBackContext, week: number): string {
  const day = new Date(reviewDate(c.cycle, week) + 'T00:00:00Z');
  const year = day.getUTCFullYear() === c.today.getUTCFullYear() ? '' : ` ${day.getUTCFullYear()}`;
  return `${WEEKDAY[c.cycle.reviewDay]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}${year}`;
}

/** Rule 5. The read-back: section 2.5's rows, each with the step its Change goes to, and the "After you publish" lines. */
export function readBack(d: GoalDraft, c: ReadBackContext): ReadBack {
  const cy = c.cycle;
  const places = decimalsFor(d) ?? 0;
  const num = (n: number) => fmt(n, { unit: d.unit.trim(), decimals: places });
  const plan = draftPlan(d, c);
  const rows: ReadBackRow[] = [];

  // What.
  let what: string;
  if (c.state === 'proposed' && measureEmpty(d)) {
    what = MEASURE_UNSAID;
  } else if (d.kind === 'metric') {
    what = plan
      ? `A number to move: from ${num(plan.start)} in ${weekSays(cy, plan.from, 'sentence')} to ${num(plan.target)} by ${weekSays(cy, plan.to, 'sentence')}, ${handSet(d) ? 'with the weeks’ numbers set by hand' : SHAPE_WORDS[d.shape]}. ${plan.target > plan.start ? 'Higher' : 'Lower'} is better.`
      : 'A number to move.';
  } else if (d.kind === 'range') {
    const limit = parseNumber(d.limit), margin = parseNumber(d.margin);
    what = limit == null ? 'A number to keep in range.'
      : `A number to keep in range: at or ${d.bound === 'atMost' ? 'under' : 'over'} ${num(limit)}. ${margin != null && margin > 0 ? `It warns within ${num(margin)} of the limit.` : 'It warns only once the limit is crossed.'}`;
  } else {
    const named = d.stages.filter((s) => s.name.trim());
    const last = Math.max(0, ...named.map((s) => parseNumber(s.dueWeek) ?? 0));
    const said = (['yes', 'no'] as const).map((k) => { const n = named.filter((s) => s.done === k).length; return n ? ` ${plural(n, 'stage is', 'stages are')} already ${k === 'yes' ? 'done' : 'overdue'}.` : ''; }).join('');
    what = `Dated stages: ${plural(named.length, 'stage')}, the last due ${weekSays(cy, last, 'sentence')}.${said}`;
  }
  rows.push({ id: 'what', label: 'What', text: what, step: 0 });

  // Who and where.
  const lvl = c.level ? aLevel(cy, c.level, isTop(cy, c.level)) : null;
  const who = [
    `${c.owner?.name ?? 'No one'} owns it${c.teamName ? `, in ${c.teamName}` : ''}.`,
    `${lvl ? `It’s ${lvl}` : 'It has no level yet'} and ${c.parent ? `feeds “${c.parent.title}”${c.parent.key ? ` (${c.parent.key})` : ''}.` : 'feeds nothing: it’s at the top of its own tree.'}`,
    ...(c.alsoHelps.length ? [`It also helps ${andList(c.alsoHelps.map((t) => `“${t}”`))}.`] : []),
    ...(d.guardrail ? ['It’s a guardrail.'] : []),
  ];
  rows.push({ id: 'who', label: 'Who and where', text: who.join(' '), step: 1 });

  // Measured by: number goals only.
  if (d.kind !== 'milestone') {
    const text = c.metric ?? (d.definition.trim() ? `No metric: “${d.definition.trim()}”.` : 'No metric, and not described yet.');
    rows.push({ id: 'measured', label: 'Measured by', text, step: 2 });
  }

  // Left as usual; Change goes to the first of them.
  const usual = leftAsUsual(d, c);
  if (usual.length) rows.push({ id: 'usual', label: 'Left as usual', text: usual.map((u) => u.text).join(' '), step: usual[0]!.step });

  // You said: no Change (each question's own line on its step has one).
  if (c.answers.length) rows.push({ id: 'said', label: 'You said', text: c.answers.join(' '), step: null });

  // After you publish (or propose it).
  const after: string[] = [];
  const ownerFirst = c.owner ? first(c.owner.name) : 'Its owner';
  if (c.state === 'proposed') return { rows, ...afterProposing(c) };
  // Stages said to be already done are saved as its first check-in (OB2's rule 3): from then it is stopped, not deleted.
  const named = d.kind === 'milestone' ? d.stages.filter((s) => s.name.trim()) : [];
  const doneNow = named.filter((s) => s.done === 'yes').length;
  if (named.length && doneNow === named.length) {
    after.push('Every stage is already done, so no check-in is due.');
  } else if (c.rhythm === 'weekly') {
    const dueWeek = Math.max(firstReview(cy, c.today).week, plan ? plan.from : 0);
    const asks = d.kind === 'milestone' ? 'It asks which stages are done.'
      : d.kind === 'range' ? 'It asks for this week’s number.'
        : plan ? (() => { const w = Math.min(plan.to, Math.max(c.week, plan.from) + 1); return `The first number sets where it stands; the plan says ${num(planAt(plan, w, cy.weeks))} for ${weekSays(cy, w, 'short')}.`; })()
          : 'The first number sets where it stands.';
    after.push(`Its first check-in is due by ${dueWords(c, dueWeek)}, then every week. ${asks}`);
  } else {
    after.push(`It shows as “${LABEL.none}” until ${c.owner?.isViewer ? 'you post' : `${ownerFirst} posts`} its first number. Nothing is due.`);
  }
  after.push(c.owner?.isViewer ? `Everyone in ${c.wsName} can see it.` : `${ownerFirst} sees it on their Home the next time they open Faro. Faro doesn’t send email.`);
  if (c.reviewsOn) {
    const j = c.reviewsJoined;
    after.push(!j.length ? 'It joins no review yet.' : j.length === 1 ? `It joins ${j[0]!.name}, which walks ${j[0]!.why}.` : `It joins ${andList(j.map((r) => r.name))}.`);
  }
  const stopped = doneNow ? `${doneNow === 1 ? 'Its stage already done is' : 'Its stages already done are'} its first check-in, so it can be stopped, with a reason, but not deleted.` : '';
  after.push(c.owner?.isViewer
    ? (stopped ? `${stopped} A change to the plan needs a reason.` : 'Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason.')
    : `Only ${ownerFirst} or an admin can change it once it is published. ${stopped || 'Until its first check-in they can change anything, or delete it.'}`);
  return { rows, after };
}

/** "After you propose it" (2.15, item 2): what proposing does, and the quieter line under it. */
export function afterProposing(c: Pick<ReadBackContext, 'owner'>): { after: string[]; hint: string } {
  const you = !c.owner || c.owner.isViewer;
  return {
    after: [
      'It is listed as Proposed, apart from the goals that are under way: it is in no count, no review’s agenda and nobody’s check-ins.',
      `Its plan is kept as you typed it. When ${you ? 'you make it' : 'it is made'} active, the plan starts from that week unless ${you ? 'you' : 'they'} say otherwise.`,
    ],
    hint: 'You can change anything without giving a reason, or withdraw it.',
  };
}

/** "Is it under way?" (2.15, item 1): the two choices and their lines. `from` is the week a number goal's plan runs from. */
export function underWay(c: Pick<ReadBackContext, 'owner' | 'rhythm' | 'week'> & { from?: number }): { active: { label: string; line: string }; proposed: { label: string; line: string } } {
  const when = c.from != null && c.from > c.week ? `week ${c.from}` : 'this week';
  const you = !c.owner || c.owner.isViewer;
  return {
    active: { label: 'Yes: publish it as active', line: c.rhythm === 'weekly' ? `It is judged against its plan from ${when}, and check-ins are due.` : `It is judged against its plan from ${when}.` },
    proposed: { label: 'Not yet: propose it', line: `Everyone can see it and comment. Nothing is due and it has no status until ${you ? 'you' : first(c.owner!.name)} or an admin make${you ? '' : 's'} it active.` },
  };
}

/**
 * "Make it active"'s read-back (2.15): the plan as it would run from `fromWeek`, then when the first check-in is due.
 * For a number goal: "From 40% in week 48 (23–29 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027): 5 weeks, not
 * the 7 you proposed. Its first check-in is due by Thursday 26 Nov, then every week."
 */
export function activeReadBack(goal: Goal, c: Pick<ReadBackContext, 'cycle' | 'week' | 'today' | 'rhythm'> & { fromWeek: number; proposer?: string | null; watchers?: number }): string {
  const cy = c.cycle;
  const parts: string[] = [];
  let firstWeek = c.fromWeek;
  if (goal.kind === 'metric') {
    const to = goal.plan.endWeek ?? cy.weeks, was = to - (goal.plan.fromWeek ?? 0), n = to - c.fromWeek;
    const num = (v: number) => fmt(v, goal);
    parts.push(`From ${num(goal.plan.start)} in ${weekSays(cy, c.fromWeek, 'sentence')} to ${num(goal.plan.target)} by ${weekSays(cy, to, 'sentence')}: ${plural(n, 'week')}${n !== was ? `, not the ${was} you proposed` : ''}.`);
  } else if (goal.kind === 'range') {
    parts.push(`At or ${goal.range.bound === 'atMost' ? 'under' : 'over'} ${fmt(goal.range.limit, goal)}, from ${weekSays(cy, c.fromWeek, 'sentence')}.`);
  } else {
    const last = Math.max(0, ...goal.stages.map((s) => s.dueWeek));
    parts.push(`${plural(goal.stages.length, 'stage')}, the last due ${weekSays(cy, last, 'sentence')}.`);
    firstWeek = c.week;
  }
  if (c.rhythm === 'weekly') {
    const due = Math.max(firstReview(cy, c.today).week, firstWeek);
    parts.push(`Its first check-in is due by ${dueWords({ cycle: cy, today: c.today } as ReadBackContext, due)}, then every week.`);
  } else parts.push('Nothing is due.');
  if (c.proposer) parts.push(`${first(c.proposer)}${c.watchers ? ` and its ${plural(c.watchers, 'watcher')}` : ''} see that it is active.`);
  return parts.join(' ');
}

/**
 * The reviews that will walk a goal as built: each live review whose picks (goalsIn) take it in, with why in words:
 * "every north star", "every SVP goal", or "“{tree}” and what feeds it". In the reviews' order.
 */
export function reviewsJoining(goal: Pick<Goal, 'id' | 'level' | 'parentId' | 'title'>, reviews: readonly Review[], goals: readonly Goal[], levels: LevelsOf): { name: string; why: string }[] {
  const all = [...goals.filter((g) => g.id !== goal.id && !g.removedAt), goal as Goal];
  const out: { name: string; why: string }[] = [];
  for (const r of reviews) {
    if (r.endedAt || r.removedAt || !goalsIn(r.scope, all).some((g) => g.id === goal.id)) continue;
    const name = levelName(levels, goal.level);
    const tree = r.scope.trees.find((t) => treeOf(t, all).some((g) => g.id === goal.id));
    const why = r.scope.levels.includes(goal.level) ? `every ${isTop(levels, goal.level) ? name.charAt(0).toLowerCase() + name.slice(1) : `${name} goal`}`
      : tree ? `“${all.find((g) => g.id === tree)?.title ?? ''}” and what feeds it` : `“${goal.title}”`;
    out.push({ name: r.name, why });
  }
  return out;
}
