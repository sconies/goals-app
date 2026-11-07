/* The scorecard at the top of a goal's page (Lane, 5 Nov: "will it hit the target?"): four short cells under the
   status and the number, each a label, a value and one muted line, and the same numbers marked on the chart.
     A number to move:      vs plan · vs last week · to target · will it hit the target?
     A number to keep in:   vs the limit · vs last week · room to the limit · will it stay within?
     Dated stages:          stages done · stages behind · next stage
   Every number comes from the rules that already own it (status for the plan and the projection, summaryFacts for the
   change since the last check-in, plan for the range); this module only says them, and decides one thing of its own:
   how likely the target is, as a word, from where the target sits against the projected range (`likelihood`).
   Pure: the page, the chart and the AI assistant's get_goal read the same words. */
import { fmt, NO_VALUE } from './format';
import { planEnd, projectionFor, valueSeries } from './plan';
import { assessMilestone, assessPosted, checkInsFor } from './status';
import { summaryFacts } from './summaryFacts';
import type { CheckIn, Cycle, Goal, MetricGoal, MilestoneGoal, RangeGoal } from './types';
import { GAP, gapPhrase, LABEL, lower, STAGE, stagesBehind, STATUS } from './vocabulary';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;

/* ---------- will it hit the target? ---------- */

export type Likelihood = 'likely' | 'possible' | 'unlikely' | 'very-unlikely';
export const LIKELIHOOD_WORD: Record<Likelihood, string> = { likely: 'Likely', possible: 'Possible', unlikely: 'Unlikely', 'very-unlikely': 'Very unlikely' };

/**
 * How likely a goal is to end on the right side of its mark (a target to reach, or a limit to stay within), from where
 * the mark sits against the projected range (plan.ts `projection`: the likeliest value and a range around it). Worked in
 * "better" terms, so it reads the same whichever way is good. With h half the range's width (never less than `floor`,
 * so a clean trend with no spread still has a little doubt), and d how far the mark sits beyond the likeliest value
 * towards better, in units of h:
 *   d ≤ −0.5      Likely: the mark sits comfortably on the near side of the likeliest value, or below the whole range;
 *   −0.5 < d ≤ 1  Possible: the mark is close to the likeliest value, or inside the range on its better side;
 *   1 < d ≤ 2     Unlikely: the mark is beyond the range, but within half a range's width of it;
 *   d > 2         Very unlikely.
 * Words, never a percentage: the range is a rough guide, not odds.
 */
export function likelihood(mark: number, p: { value: number; low: number; high: number }, better: 1 | -1, floor = 0): Likelihood {
  const half = Math.max(Math.abs(p.high - p.low) / 2, floor, 1e-9);
  const d = ((mark - p.value) * better) / half;
  if (d <= -0.5) return 'likely';
  if (d <= 1) return 'possible';
  if (d <= 2) return 'unlikely';
  return 'very-unlikely';
}

/** The least half-width the likelihood allows: 2% of the planned change, or half the goal's last decimal place. */
export const likelihoodFloor = (span: number, decimals: number) => Math.max(Math.abs(span) * 0.02, 10 ** -decimals / 2);

/* ---------- the scorecard ---------- */

export type CellTone = 'good' | 'bad' | 'flat';
export interface ScoreCell {
  key: 'plan' | 'since' | 'target' | 'hit' | 'limit' | 'room' | 'done' | 'late' | 'next';
  /** "Vs plan", "Will it hit 24?" */
  label: string;
  /** "9 hours behind plan", "Unlikely". */
  value: string;
  /** One muted line: "plan 28 hours", "was 36 hours in week 44". */
  sub: string;
  tone: CellTone;
  /** Which way the number moved, for a drawn arrow beside it (vs last week only). */
  move?: 'up' | 'down';
  likelihood?: Likelihood;
}

/** The scorecard's numbers as the chart marks them (number goals only). Text is short: the chart has little room. */
export interface ChartMarks {
  /** At now: the gap between the latest number and the plan for its week. */
  now: { week: number; actual: number; plan: number; text: string; tone: CellTone } | null;
  /** At the due week: the likeliest end, and the gap from it to the target. */
  end: { week: number; likely: number; target: number; likelyText: string; gapText: string; tone: CellTone } | null;
}

export interface Scorecard {
  cells: ScoreCell[];
  /** The plan gap in a few words, for the one-line bar once the page has scrolled: "9 hours behind plan". */
  gap: string | null;
  marks: ChartMarks | null;
}

const round = (v: number, d: number) => Number(v.toFixed(d));
/** An amount in the goal's units, "1 hour" not "1 hours": "9 hours", "0.4 days", "3 pts". */
export function amount(v: number, g: Numeric): string {
  const n = Math.abs(v).toFixed(g.decimals);
  if (g.unit === '%') return n + (Number(n) === 1 ? ' pt' : ' pts');
  if (!g.unit) return n;
  return `${n} ${Number(n) === 1 && /[a-z]s$/i.test(g.unit) ? g.unit.slice(0, -1) : g.unit}`;
}
/** The same, as short as the chart needs: "9", "0.4", "3 pts". */
const bare = (v: number, g: Numeric) => (g.unit === '%' ? amount(v, g) : Math.abs(v).toFixed(g.decimals));
/** A value as short as the chart needs: "37", "83%". */
const bareValue = (v: number, g: Numeric) => v.toFixed(g.decimals) + (g.unit === '%' ? '%' : '');
/** The target or limit as the question says it: "24", "80%", "0.10%". */
const markWord = (v: number, g: Numeric) => bareValue(v, g);

/** "by year end", "by cycle end", "by week 40". */
export function byWeekWords(cycle: Cycle, due: number): string {
  return due >= cycle.weeks ? (cycle.weeks >= 48 ? 'by year end' : 'by cycle end') : `by week ${due}`;
}

/** Vs last week: the latest check-in against the one before it with a number (summaryFacts' "since"). */
function sinceCell(goal: MetricGoal | RangeGoal, cycle: Cycle, checkIns: CheckIn[], week: number, stale: boolean, better: 1 | -1): ScoreCell {
  const f = summaryFacts(goal, cycle, checkIns, week, stale).facts.find((x) => x.key === 'since');
  const label = stale ? 'Last change' : 'Vs last week';
  if (!f) return { key: 'since', label, value: LABEL.none, sub: 'nothing to compare', tone: 'flat' };
  if (f.delta == null || !f.from) return { key: 'since', label, value: f.value, sub: f.value === 'First check-in' ? 'nothing to compare yet' : 'no number to compare', tone: 'flat' };
  const was = `was ${fmt(f.from.value, goal)} in week ${f.from.week}`;
  if (f.delta === 0) return { key: 'since', label, value: 'No change', sub: was, tone: 'flat' };
  const good = f.delta * better > 0;
  return { key: 'since', label, value: `${amount(f.delta, goal)} ${good ? 'better' : 'worse'}`, sub: was, tone: good ? 'good' : 'bad', move: f.delta > 0 ? 'up' : 'down' };
}

function metricCard(goal: MetricGoal, cycle: Cycle, checkIns: CheckIn[], week: number, stale: boolean): Scorecard {
  const a = assessPosted(goal, cycle, checkIns, week);
  if (a.kind !== 'metric') return { cells: [], gap: null, marks: null };
  const better: 1 | -1 = goal.plan.target >= goal.plan.start ? 1 : -1;
  const target = goal.plan.target;
  const due = planEnd(goal.plan, cycle.weeks);
  const cells: ScoreCell[] = [];

  // Vs plan: the latest number against the plan for its own week.
  let gap: string | null = null;
  let now: ChartMarks['now'] = null;
  if (a.actual == null) cells.push({ key: 'plan', label: 'Vs plan', value: NO_VALUE, sub: `plan ${fmt(a.plan, goal)}`, tone: 'flat' });
  else {
    const diff = round((a.actual - a.plan) * better, goal.decimals);
    // The gap as every list, export and the AI say it: "9 hours behind plan", "3 pts ahead of plan", "On plan".
    const value = gapPhrase(diff, amount(diff, goal));
    const tone: CellTone = diff === 0 ? 'flat' : diff > 0 ? 'good' : 'bad';
    cells.push({ key: 'plan', label: 'Vs plan', value, sub: `plan ${fmt(a.plan, goal)}${a.week < week ? ` in week ${a.week}` : ''}`, tone });
    // The one-line bar once the page has scrolled, and the chart's mark at now, say the same words.
    gap = value;
    now = { week: a.week, actual: a.actual, plan: a.plan, text: value, tone };
  }

  cells.push(sinceCell(goal, cycle, checkIns, week, stale, better));

  // To target: what's left to go, in the goal's units.
  const by = due !== cycle.weeks ? ` by week ${due}` : '';
  if (a.actual == null) cells.push({ key: 'target', label: 'To target', value: NO_VALUE, sub: `target ${fmt(target, goal)}${by}`, tone: 'flat' });
  else {
    const left = round((target - a.actual) * better, goal.decimals);
    cells.push({ key: 'target', label: 'To target', value: left <= 0 ? GAP.reached.label : `${amount(left, goal)} to go`, sub: `target ${fmt(target, goal)}${by}`, tone: left <= 0 ? 'good' : 'flat' });
  }

  // Will it hit the target: where the target sits against the projected range.
  const label = `Will it hit ${markWord(target, goal)}?`;
  let end: ChartMarks['end'] = null;
  if (stale) cells.push({ key: 'hit', label, value: 'Can’t say', sub: `${lower(STATUS.stale)} to go on`, tone: 'flat' });
  else if (!a.projection) cells.push({ key: 'hit', label, value: 'Too early to say', sub: 'needs three weeks of numbers', tone: 'flat' });
  else {
    // Already held to what the number can be (a share within 0–100%, a count not below zero): plan.ts projectionFor.
    const p = a.projection;
    const l = likelihood(target, p, better, likelihoodFloor(goal.plan.target - goal.plan.start, goal.decimals));
    const tone: CellTone = l === 'likely' ? 'good' : l === 'possible' ? 'flat' : 'bad';
    cells.push({ key: 'hit', label, value: LIKELIHOOD_WORD[l], sub: `likely ${fmt(p.value, goal)} ${byWeekWords(cycle, due)}`, tone, likelihood: l });
    const short = round((target - p.value) * better, goal.decimals);
    end = { week: a.projection.week, likely: p.value, target, likelyText: `likely ${bareValue(p.value, goal)}`, gapText: short > 0 ? `${bare(short, goal)} short` : 'on course', tone: short > 0 ? 'bad' : 'good' };
  }
  return { cells, gap, marks: { now, end } };
}

function rangeCard(goal: RangeGoal, cycle: Cycle, checkIns: CheckIn[], week: number, stale: boolean): Scorecard {
  const a = assessPosted(goal, cycle, checkIns, week);
  if (a.kind !== 'range') return { cells: [], gap: null, marks: null };
  const { bound, limit, margin } = goal.range;
  const better: 1 | -1 = bound === 'atLeast' ? 1 : -1;
  const lim = `${bound === 'atMost' ? 'at most' : 'at least'} ${fmt(limit, goal)}`;
  const cells: ScoreCell[] = [];
  let gap: string | null = null;
  // Vs the limit, and the room left before it.
  if (a.actual == null) {
    cells.push({ key: 'limit', label: 'Vs the limit', value: NO_VALUE, sub: `must stay ${lim}`, tone: 'flat' });
    cells.push({ key: 'room', label: 'Room to the limit', value: NO_VALUE, sub: `warning within ${amount(margin, goal)}`, tone: 'flat' });
  } else {
    const room = round((limit - a.actual) * -better, goal.decimals);
    cells.push({ key: 'limit', label: 'Vs the limit', value: a.out ? 'Outside it' : a.near ? 'Inside, near it' : 'Inside it', sub: `must stay ${lim}`, tone: a.out ? 'bad' : a.near ? 'flat' : 'good' });
    const over = bound === 'atMost' ? 'over' : 'under';
    cells.push({ key: 'room', label: 'Room to the limit', value: room > 0 ? `${amount(room, goal)} of room` : room === 0 ? 'None: at the limit' : `${amount(room, goal)} ${over}`, sub: `warning within ${amount(margin, goal)}`, tone: room < 0 ? 'bad' : room <= margin ? 'flat' : 'good' });
    gap = room >= 0 ? `${amount(room, goal)} inside the limit` : `${amount(room, goal)} ${over} the limit`;
  }
  cells.splice(1, 0, sinceCell(goal, cycle, checkIns, week, stale, better));
  // Will it stay within (or get back within) the limit by the end of the cycle?
  const label = a.out ? 'Back within by the end?' : 'Will it stay within?';
  const own = checkInsFor(goal, checkIns).filter((c) => c.week <= week);
  const pr = stale ? null : projectionFor(goal, valueSeries(own), cycle.weeks);
  if (stale) cells.push({ key: 'hit', label, value: 'Can’t say', sub: `${lower(STATUS.stale)} to go on`, tone: 'flat' });
  else if (!pr) cells.push({ key: 'hit', label, value: 'Too early to say', sub: 'needs three weeks of numbers', tone: 'flat' });
  else {
    // Staying within is the same question as reaching a target: ending on the limit's safe side.
    const stay = likelihood(limit, { value: pr.value, low: pr.low, high: pr.high }, better, likelihoodFloor(margin || limit * 0.1, goal.decimals));
    cells.push({ key: 'hit', label, value: LIKELIHOOD_WORD[stay], sub: `likely ${fmt(pr.value, goal)} ${byWeekWords(cycle, cycle.weeks)}`, tone: stay === 'likely' ? 'good' : stay === 'possible' ? 'flat' : 'bad', likelihood: stay });
  }
  return { cells, gap, marks: null };
}

function milestoneCard(goal: MilestoneGoal, checkIns: CheckIn[], week: number): Scorecard {
  const own = checkInsFor(goal, checkIns).filter((c) => c.week <= week);
  const m = assessMilestone(goal, week, own[own.length - 1]?.stages ?? null);
  const n = m.stages.length;
  const late = m.stages.filter((s) => s.kind !== 'done' && s.weeksLate > 0);
  const most = Math.max(0, ...late.map((s) => s.weeksLate));
  const next = m.stages.filter((s) => s.kind !== 'done').sort((x, y) => x.dueWeek - y.dueWeek)[0];
  const lastDone = Math.max(0, ...m.stages.map((s) => s.doneWeek ?? 0));
  const cells: ScoreCell[] = [
    { key: 'done', label: 'Stages done', value: `${m.doneCount} of ${n}`, sub: `${m.dueCount} due by week ${week}`, tone: m.doneCount >= m.dueCount ? 'good' : 'flat' },
    // Behind their dates, each in its word: up to two weeks behind is slipping, more is late (the vocabulary's STAGE).
    { key: 'late', label: 'Stages behind', value: late.length ? String(late.length) : 'None', sub: late.length ? `${stagesBehind(late.map((s) => s.kind as 'risk' | 'off')).replace(/^\d+ stages?:? ?/, '')}, up to ${most} ${most === 1 ? 'week' : 'weeks'}` : lower(STAGE.planned), tone: late.length ? 'bad' : 'good' },
    next
      // When the next stage now lands; a stage running late names the week it was due.
      ? { key: 'next', label: 'Next stage', value: `Week ${Math.max(next.dueWeek, next.expectedWeek)}`, sub: `${next.name}${next.expectedWeek > next.dueWeek ? `, due week ${next.dueWeek}` : ''}`, tone: next.expectedWeek > next.dueWeek ? 'bad' : 'flat' }
      : { key: 'next', label: 'Next stage', value: 'All done', sub: `last done in week ${lastDone}`, tone: 'good' },
  ];
  const gap = m.calc === 'done' ? GAP.reached.label : stagesBehind(late.map((s) => s.kind as 'risk' | 'off'));
  return { cells, gap, marks: null };
}

/** A goal's scorecard from its check-ins up to `week`. `stale` when its status can't be trusted, so nothing is projected.
    A stopped goal makes no forecast: its card says how it stood (no "will it hit?" cell and no likely end on the
    chart), and the note under it says when and why it stopped. */
export function goalScorecard(goal: Goal, cycle: Cycle, checkIns: CheckIn[], week: number, stale: boolean): Scorecard {
  const card = goal.kind === 'metric' ? metricCard(goal, cycle, checkIns, week, stale)
    : goal.kind === 'range' ? rangeCard(goal, cycle, checkIns, week, stale)
    : milestoneCard(goal, checkIns, week);
  if (!goal.stoppedAt) return card;
  return { ...card, cells: card.cells.filter((c) => c.key !== 'hit'), marks: card.marks && { ...card.marks, end: null } };
}

/** Whether a goal's page projects where it will end: not when its last check-in is too old, nor once it's stopped. */
export const projects = (goal: Goal, stale: boolean) => !stale && !goal.stoppedAt;
