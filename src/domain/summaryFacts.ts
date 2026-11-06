/* The four facts behind a goal's summary bar (Lane's notes, 5 Nov; the flagship goal page, 5 Nov): where it stands
   against its plan, which way it's heading over the last check-ins (in the goal's own units, never a share of plan), what
   changed since the last update, and where the app projects it lands by its due date, as a range. For number goals,
   ranges and dated stages alike. Pure: the goal page, its shared image and anything else asks here, never restates it. */
import { isShare } from './checkin';
import { fmt, fmtDiff, NO_VALUE, rangeText } from './format';
import { goalAsOf, planAt, planEnd, projection, type Projection } from './plan';
import { assessMetric, assessMilestone, assessPosted, checkInsFor, LABEL } from './status';
import type { CheckIn, Cycle, Goal, MetricGoal, MilestoneGoal, RangeGoal } from './types';

export type FactKey = 'plan' | 'trend' | 'since' | 'projection';
/** Good news, bad news, or neither. Shown as words and order, not colour. */
export type FactTone = 'good' | 'bad' | 'flat';
/** Which way it's heading against its plan (or limit, or dates): the summary bar's arrow. */
export type Direction = 'worsening' | 'recovering' | 'flat';
export interface SummaryFact {
  key: FactKey;
  label: string;
  /** The fact in a few words: "13 pts behind plan". */
  value: string;
  /** The numbers behind it, in one short line. */
  detail: string | null;
  tone: FactTone;
  /** The trend's direction (the trend fact only). */
  direction?: Direction;
  /** The projection itself (number goals and ranges, when there is one). */
  projection?: Projection;
  /** Since last update (number goals and ranges): the change in the goal's units, and the number it is compared with. */
  delta?: number;
  from?: { value: number; week: number };
}

/** Whose check-in the facts come from: "Week 44 check-in · Kofi Boateng · 8 days ago" in the page's words. */
export interface FactSource { week: number; authorId: string; postedAt: string }

export interface SummaryFacts { facts: SummaryFact[]; source: FactSource | null }

/** How many check-ins the trend looks back over. */
export const TREND_SPAN = 3;

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "two", "three" … for small counts in a sentence; digits from 11. */
export const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const round = (v: number, decimals: number) => Number(v.toFixed(decimals));
/** "weeks 42–44", or "week 44" for one. */
const weekSpan = (cs: CheckIn[]) => (cs.length > 1 && cs[0]!.week !== cs[cs.length - 1]!.week ? `weeks ${cs[0]!.week}–${cs[cs.length - 1]!.week}` : `week ${cs[cs.length - 1]!.week}`);

/** The goal's facts from its check-ins up to `week`. `stale` when its status can't be trusted, so nothing is projected. */
export function summaryFacts(goal: Goal, cycle: Cycle, checkIns: CheckIn[], week: number, stale = false): SummaryFacts {
  const own = checkInsFor(goal, checkIns).filter((c) => c.week <= week);
  const latest = own[own.length - 1];
  if (!latest) return { facts: [], source: null };
  const source = { week: latest.week, authorId: latest.authorId, postedAt: latest.postedAt };
  const facts = goal.kind === 'metric' ? metricFacts(goal, cycle, checkIns, own, week, stale)
    : goal.kind === 'range' ? rangeFacts(goal, cycle, own, stale)
    : milestoneFacts(goal, own, week, stale);
  return { facts, source };
}

/* ---------- a number to move ---------- */

/** Share of the planned progress a check-in had made, against the plan of its own week. */
export function ratioAt(goal: MetricGoal, weeks: number, c: CheckIn): number | null {
  if (c.value == null) return null;
  return assessMetric(goalAsOf(goal, c.week), weeks, c.week, c.value, []).ratio;
}

function metricFacts(goal: MetricGoal, cycle: Cycle, all: CheckIn[], own: CheckIn[], week: number, stale: boolean): SummaryFact[] {
  const a = assessPosted(goal, cycle, all, week);
  if (a.kind !== 'metric') return [];
  const g = goalAsOf(goal, a.week);
  const dir = Math.sign(g.plan.target - g.plan.start) || 1;
  const valued = own.filter((c) => c.value != null);
  const out: SummaryFact[] = [];

  // Against plan: the gap to the plan for the week of the latest number, in the goal's own units.
  if (a.actual == null) out.push({ key: 'plan', label: 'Against plan', value: NO_VALUE, detail: `Plan for week ${a.week}: ${fmt(a.plan, goal)}`, tone: 'flat' });
  else {
    const diff = round(a.actual - a.plan, goal.decimals);
    const ahead = diff * dir > 0;
    out.push({
      key: 'plan', label: 'Against plan',
      value: diff === 0 ? 'On plan' : `${fmtDiff(diff, goal)} ${ahead ? 'ahead of' : 'behind'} plan`,
      detail: `${fmt(a.actual, goal)} against ${fmt(a.plan, goal)} planned for week ${a.week}${a.ratio != null ? ` · ${pct(a.ratio)} of the planned progress` : ''}`,
      tone: a.calc === 'risk' || a.calc === 'off' ? 'bad' : diff === 0 || a.calc !== 'on' ? 'flat' : 'good',
    });
  }

  // Trend: the gap to plan at each of the last three check-ins, in the goal's own units ("1 → 2 → 3 pts behind plan").
  // A share of planned progress made a flat number look like a collapse while the plan rose (Lane, 5 Nov).
  const span = valued.slice(-TREND_SPAN).map((c) => {
    const p = planAt(goalAsOf(goal, c.week).plan, c.week, cycle.weeks);
    return { c, plan: p, gap: round((c.value! - p) * dir, goal.decimals) };
  });
  if (span.length < 2) out.push({ key: 'trend', label: 'Trend', value: 'Not enough check-ins yet', detail: 'Needs two check-ins', tone: 'flat', direction: 'flat' });
  else {
    const unit = 10 ** -goal.decimals;
    const latest = span[span.length - 1]!;
    const move = round(latest.gap - span[0]!.gap, goal.decimals);
    const direction: Direction = move <= -unit ? 'worsening' : move >= unit ? 'recovering' : 'flat';
    const behind = span.every((x) => x.gap <= 0), ahead = span.every((x) => x.gap >= 0);
    const num = (v: number) => Math.abs(v).toFixed(goal.decimals);
    // The unit as a difference is said ("pts", "days"), after the last number only.
    const words = fmtDiff(2, goal).replace(/^[0-9.]+ ?/, '');
    const tail = words ? ' ' + words : '';
    const value = span.every((x) => x.gap === 0) ? 'On plan at each check-in'
      : behind ? `${span.map((x) => num(x.gap)).join(' → ')}${tail} behind plan`
      : ahead ? `${span.map((x) => num(x.gap)).join(' → ')}${tail} ahead of plan`
      // Ahead some weeks and behind others: each says which, in words ("1 ahead → 1 behind → 4 pts behind plan").
      : span.map((x, i) => (x.gap === 0 ? 'on plan' : `${num(x.gap)}${i === span.length - 1 ? tail : ''} ${x.gap > 0 ? 'ahead' : 'behind'}`)).join(' → ') + (latest.gap > 0 ? ' of plan' : latest.gap < 0 ? ' plan' : '');
    // The same number check-in after check-in while the plan moves on: say exactly that, once.
    let held = 1;
    for (let k = valued.length - 2; k >= 0 && valued[k]!.value === latest.c.value; k--) held++;
    const heldFrom = valued[valued.length - held]!;
    const planMoved = (latest.plan - planAt(goalAsOf(goal, heldFrom.week).plan, heldFrom.week, cycle.weeks)) * dir > 0;
    const detail = held >= 2 && planMoved
      ? `Flat at ${fmt(latest.c.value!, goal)} for ${countWord(held)} weeks while the plan ${dir > 0 ? 'rises' : 'falls'}`
      : `${direction === 'worsening' ? (behind ? 'Falling further behind' : 'Losing ground on the plan') : direction === 'recovering' ? (behind ? 'Closing the gap' : 'Gaining ground on the plan') : 'Holding steady against the plan'}, ${weekSpan(span.map((x) => x.c))}`;
    out.push({ key: 'trend', label: 'Trend', value, detail, tone: direction === 'worsening' ? 'bad' : direction === 'recovering' ? 'good' : 'flat', direction });
  }

  out.push(sinceFact(goal, own, dir));

  // Projection: where the recent trend takes it by the due week, as a range, against the target.
  const due = planEnd(goal.plan, cycle.weeks);
  if (stale) out.push({ key: 'projection', label: 'Projection', value: 'Not projected', detail: 'The last check-in is too old to project from', tone: 'flat' });
  else if (a.forecast == null || !a.projection) out.push({ key: 'projection', label: 'Projection', value: 'Not enough check-ins yet', detail: 'Projected by the app once there are three weeks of numbers', tone: 'flat' });
  else {
    const gap = round(a.forecast - goal.plan.target, goal.decimals);
    const misses = a.forecastMisses && gap !== 0;
    // A projection past the target says it reaches the target: "164%" of something that stops at 100% helps nobody.
    out.push({
      key: 'projection', label: 'Projection',
      value: misses ? `Heading for ${rangeText(a.projection, goal, isShare(goal))} by week ${due}` : `Reaches ${fmt(goal.plan.target, goal)} by week ${due}`,
      detail: `${misses ? `Misses the ${fmt(goal.plan.target, goal)} target by about ${fmtDiff(gap, goal)}. ` : ''}Projected by the app from the last ${a.projection.to - a.projection.from + 1} weeks, not the owner’s date`,
      tone: misses ? 'bad' : 'good',
      projection: a.projection,
    });
  }
  return out;
}

/** What changed since the check-in before the latest: the number, and the call if it moved. */
function sinceFact(goal: MetricGoal | RangeGoal, own: CheckIn[], better: number): SummaryFact {
  const latest = own[own.length - 1]!;
  const prev = [...own.slice(0, -1)].reverse().find((c) => c.value != null);
  const callMoved = (p: CheckIn) => (p.status !== latest.status ? `; was ${LABEL[p.status].toLowerCase()}, now ${LABEL[latest.status].toLowerCase()}` : '');
  if (latest.value == null) return { key: 'since', label: 'Since last update', value: 'No number this time', detail: null, tone: 'flat' };
  if (!prev) return { key: 'since', label: 'Since last update', value: 'First check-in', detail: `${fmt(latest.value, goal)} in week ${latest.week}`, tone: 'flat' };
  const delta = round(latest.value - prev.value!, goal.decimals);
  return {
    key: 'since', label: 'Since last update', delta, from: { value: prev.value!, week: prev.week },
    value: delta === 0 ? 'No change' : `${delta > 0 ? 'Up' : 'Down'} ${fmtDiff(delta, goal)}`,
    detail: `${fmt(prev.value!, goal)} in week ${prev.week} → ${fmt(latest.value, goal)} in week ${latest.week}${callMoved(prev)}`,
    tone: delta === 0 ? 'flat' : delta * better > 0 ? 'good' : 'bad',
  };
}

/* ---------- a number to keep in range ---------- */

function rangeFacts(goal: RangeGoal, cycle: Cycle, own: CheckIn[], stale: boolean): SummaryFact[] {
  const { bound, limit } = goal.range;
  // Positive is towards the limit's safe side: lower for "at most", higher for "at least".
  const safe = bound === 'atMost' ? -1 : 1;
  const valued = own.filter((c) => c.value != null);
  const last = valued[valued.length - 1];
  const out: SummaryFact[] = [];
  const lim = `${bound === 'atMost' ? 'at most' : 'at least'} ${fmt(limit, goal)}`;

  if (!last) out.push({ key: 'plan', label: 'Against the limit', value: NO_VALUE, detail: `Must stay ${lim}`, tone: 'flat' });
  else {
    const room = round((limit - last.value!) * -safe, goal.decimals);
    out.push({
      key: 'plan', label: 'Against the limit',
      value: room === 0 ? 'At the limit' : room > 0 ? `${fmtDiff(room, goal)} inside the limit` : `${fmtDiff(room, goal)} ${bound === 'atMost' ? 'over' : 'under'} the limit`,
      detail: `${fmt(last.value!, goal)} in week ${last.week}; must stay ${lim}`,
      tone: room < 0 ? 'bad' : room <= goal.range.margin ? 'flat' : 'good',
    });
  }

  const span = valued.slice(-TREND_SPAN);
  if (span.length < 2) out.push({ key: 'trend', label: 'Trend', value: 'Not enough check-ins yet', detail: 'Needs two check-ins', tone: 'flat', direction: 'flat' });
  else {
    const move = round((span[span.length - 1]!.value! - span[0]!.value!) * safe, goal.decimals);
    out.push({
      key: 'trend', label: 'Trend',
      value: span.map((c) => fmt(c.value!, goal)).join(' → '),
      detail: `${move === 0 ? 'Holding steady' : move > 0 ? 'Moving away from the limit' : 'Moving towards the limit'}, ${weekSpan(span)}`,
      tone: move === 0 ? 'flat' : move > 0 ? 'good' : 'bad',
      direction: move === 0 ? 'flat' : move > 0 ? 'recovering' : 'worsening',
    });
  }

  out.push(sinceFact(goal, own, safe));

  const due = cycle.weeks;
  const pr = stale ? null : projection(valued.map((c) => ({ week: c.week, value: c.value! })), due);
  if (stale) out.push({ key: 'projection', label: 'Projection', value: 'Not projected', detail: 'The last check-in is too old to project from', tone: 'flat' });
  else if (!pr) out.push({ key: 'projection', label: 'Projection', value: 'Not enough check-ins yet', detail: 'Projected by the app once there are three weeks of numbers', tone: 'flat' });
  else {
    const outside = bound === 'atMost' ? pr.value > limit : pr.value < limit;
    out.push({
      key: 'projection', label: 'Projection', value: `${rangeText(pr, goal, isShare(goal))} by week ${due}`,
      detail: `${outside ? `Outside the ${fmt(limit, goal)} limit` : `Inside the ${fmt(limit, goal)} limit`}. Projected by the app from the last ${pr.to - pr.from + 1} weeks`,
      tone: outside ? 'bad' : 'good',
      projection: pr,
    });
  }
  return out;
}

/* ---------- dated stages ---------- */

/** The most weeks late any unfinished stage was at a check-in (0 when none is late). */
export function weeksLateAt(goal: MilestoneGoal, c: CheckIn): number {
  const m = assessMilestone(goal, c.week, c.stages);
  return Math.max(0, ...m.stages.filter((s) => s.kind !== 'done').map((s) => s.weeksLate));
}

function milestoneFacts(goal: MilestoneGoal, own: CheckIn[], week: number, stale: boolean): SummaryFact[] {
  const latest = own[own.length - 1]!;
  const m = assessMilestone(goal, week, latest.stages);
  const out: SummaryFact[] = [];

  // Against plan: the stages running late (overdue, or expected after their date), against those due by now.
  out.push({
    key: 'plan', label: 'Against plan',
    value: m.calc === 'done' ? 'Every stage done' : m.late.length ? `${plural(m.late.length, 'stage')} late` : 'On schedule',
    detail: `${m.doneCount} of ${plural(m.stages.length, 'stage')} done; ${m.dueCount} due by week ${week}`,
    tone: m.late.length ? 'bad' : 'good',
  });

  // Trend: how late the latest stage running late was, at each of the last three check-ins.
  const span = own.filter((c) => c.stages).slice(-TREND_SPAN);
  if (span.length < 2) out.push({ key: 'trend', label: 'Trend', value: 'Not enough check-ins yet', detail: 'Needs two check-ins', tone: 'flat', direction: 'flat' });
  else {
    const late = span.map((c) => weeksLateAt(goal, c));
    const move = late[late.length - 1]! - late[0]!;
    out.push({
      key: 'trend', label: 'Trend',
      value: late.every((n) => n === 0) ? 'On time at every check-in' : `${late.join(' → ')} weeks late`,
      detail: `${move > 0 ? 'Slipping' : move < 0 ? 'Recovering' : 'Holding steady'}, ${weekSpan(span)}`,
      tone: move > 0 ? 'bad' : move < 0 ? 'good' : late[late.length - 1] ? 'bad' : 'flat',
      direction: move > 0 ? 'worsening' : move < 0 ? 'recovering' : 'flat',
    });
  }

  // Since last update: stages done, and dates that moved.
  const prev = own.length > 1 ? own[own.length - 2]! : null;
  if (!prev) out.push({ key: 'since', label: 'Since last update', value: 'First check-in', detail: `${m.doneCount} of ${plural(m.stages.length, 'stage')} done in week ${latest.week}`, tone: 'flat' });
  else {
    const before = assessMilestone(goal, prev.week, prev.stages);
    const now = assessMilestone(goal, latest.week, latest.stages);
    const done = now.stages.filter((s) => s.kind === 'done' && before.stages.find((b) => b.id === s.id)?.kind !== 'done');
    const slips = now.stages.map((s) => ({ s, b: before.stages.find((b) => b.id === s.id)! })).filter(({ s, b }) => s.kind !== 'done' && b && s.expectedWeek > b.expectedWeek);
    const first = slips[0];
    const parts = [
      ...done.map((s) => `${s.name} done`),
      ...slips.map(({ s, b }) => `${s.name} moved from week ${b.expectedWeek} to week ${s.expectedWeek}`),
    ];
    out.push({
      key: 'since', label: 'Since last update',
      value: first ? `${first.s.name} slipped ${plural(first.s.expectedWeek - first.b.expectedWeek, 'week')}` : done.length ? `${plural(done.length, 'stage')} done` : 'No change',
      detail: parts.length ? `Since week ${prev.week}: ${parts.join('; ')}` : `Same as week ${prev.week}`,
      tone: slips.length ? 'bad' : done.length ? 'good' : 'flat',
    });
  }

  // Projection: when the last stage lands against its date, and the next stage due.
  const due = Math.max(0, ...m.stages.map((s) => s.dueWeek));
  const finish = Math.max(0, ...m.stages.map((s) => s.expectedWeek));
  const next = m.stages.filter((s) => s.kind !== 'done').sort((x, y) => x.dueWeek - y.dueWeek)[0];
  const nextText = next ? `Next: ${next.name}, due week ${next.dueWeek}${next.expectedWeek > next.dueWeek ? `, expected week ${next.expectedWeek}` : ''}` : null;
  if (m.calc === 'done') out.push({ key: 'projection', label: 'Projection', value: `Finished in week ${finish}`, detail: finish > due ? `${plural(finish - due, 'week')} after its week ${due} date` : `By its week ${due} date`, tone: finish > due ? 'bad' : 'good' });
  else if (stale) out.push({ key: 'projection', label: 'Projection', value: 'Not projected', detail: nextText ?? 'The last check-in is too old to project from', tone: 'flat' });
  else out.push({
    key: 'projection', label: 'Projection',
    value: finish > due ? `Finishes week ${finish}, ${plural(finish - due, 'week')} late` : `Finishes by week ${due}`,
    detail: nextText,
    tone: finish > due ? 'bad' : 'good',
  });
  return out;
}
