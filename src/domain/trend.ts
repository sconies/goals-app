/* The one trend rule (consolidation release 2): whether a goal is getting worse, getting better, or neither. The
   attention flag, the goal's story, the summary bar's trend, the scorecard and the words under the chart all ask here,
   so "Getting worse" means one thing wherever it is said (domain/vocabulary.ts, TREND and FLAG.trend). */
import { fixed } from './numbers';
import { isShare } from './checkin';
import { fmt, rangeText, weekLabel } from './format';
import { goalAsOf, planAt } from './plan';
import { assessMetric, assessMilestone, assessRange, checkInsFor } from './status';
import { TREND_SPAN } from './thresholds';
import type { CheckIn, Cycle, Goal, MetricGoal, MilestoneGoal } from './types';
import { LABEL, type TrendWord } from './vocabulary';

/**
 * Which way a series is heading. `gaps` are the last check-ins' distance from where they should be, oldest first,
 * unrounded, positive when better: ahead of plan, room inside a limit. Only the last TREND_SPAN count.
 *   Getting worse: lower at each of the last two steps, and, with `behindOnly`, short now. A number held flat while the
 *     plan moves on is further behind at each check-in, so it is getting worse, even before the gap shows a whole unit;
 *     goalTrend then also asks that it shows: behind now, and further behind than at the start (deep review T5).
 *   Getting better: higher at each of the last two steps.
 *   Anything else, or fewer than TREND_SPAN check-ins: no clear change.
 */
export function gapTrend(gaps: number[], behindOnly = false): TrendWord {
  const g = gaps.slice(-TREND_SPAN);
  if (g.length < TREND_SPAN) return 'flat';
  const steps = g.slice(1).map((v, i) => v - g[i]!);
  if (steps.every((d) => d < -1e-9) && (!behindOnly || g[g.length - 1]! < -1e-9)) return 'worse';
  if (steps.every((d) => d > 1e-9)) return 'better';
  return 'flat';
}

/** A number goal's gap to the plan of each check-in's own week, in its units, positive when ahead (whichever way is
    better): `gap` at the goal's decimals, to say; `raw` unrounded, for the trend. */
export function planGaps(goal: MetricGoal, cycle: Cycle, valued: CheckIn[]): { c: CheckIn; plan: number; gap: number; raw: number }[] {
  const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
  return valued.filter((c) => c.value != null).map((c) => {
    const plan = planAt(goalAsOf(goal, c.week).plan, c.week, cycle.weeks);
    const raw = (c.value! - plan) * dir;
    return { c, plan, raw, gap: Number(raw.toFixed(goal.decimals)) };
  });
}

/**
 * A number goal's trend from its gaps to plan (planGaps): gapTrend on the unrounded gaps, a "worse" kept only if it
 * shows at the goal's decimals (deep review T5, 10 Nov): behind now as shown, and further behind than at the start of
 * the span. A number typed as the plan reads "on plan", so it is never getting worse, and no sentence prints "on plan →
 * on plan → on plan" or three equal gaps as worse. The flag, the story and the summary bar all ask here.
 */
export function planGapTrend(gaps: { gap: number; raw: number }[]): TrendWord {
  const word = gapTrend(gaps.map((x) => x.raw), true);
  const shown = gaps.slice(-TREND_SPAN).map((x) => x.gap);
  const visible = shown.length > 0 && shown[shown.length - 1]! < 0 && shown[0]! > shown[shown.length - 1]!;
  return word === 'worse' && !visible ? 'flat' : word;
}

/** Stages at the latest check-in against the one before: worse when any is expected later, better when only sooner. */
export function stagesTrend(goal: MilestoneGoal, own: CheckIn[]): { word: TrendWord; slipped: { name: string; week: number } | null } {
  const withStages = own.filter((c) => c.stages);
  if (withStages.length < 2) return { word: 'flat', slipped: null };
  const prev = withStages[withStages.length - 2]!, last = withStages[withStages.length - 1]!;
  const before = assessMilestone(goal, prev.week, prev.stages), now = assessMilestone(goal, last.week, last.stages);
  const later = now.stages.find((s, i) => s.kind !== 'done' && s.expectedWeek > (before.stages[i]?.expectedWeek ?? s.expectedWeek));
  if (later) return { word: 'worse', slipped: { name: later.name, week: later.expectedWeek } };
  const sooner = now.stages.some((s, i) => (s.kind === 'done' && before.stages[i]?.kind !== 'done' && (s.doneWeek ?? 0) < (before.stages[i]?.expectedWeek ?? 0)) || (s.kind !== 'done' && s.expectedWeek < (before.stages[i]?.expectedWeek ?? s.expectedWeek)));
  return { word: sooner ? 'better' : 'flat', slipped: null };
}

export interface GoalTrend {
  word: TrendWord;
  /** When it's getting worse: what is, in numbers, in one sentence. */
  detail: string | null;
}

/** Whether a goal is getting worse or better over its last check-ins: the rule behind the "Getting worse" flag. */
export function goalTrend(goal: Goal, cycle: Cycle, checkIns: CheckIn[]): GoalTrend {
  const own = checkInsFor(goal, checkIns);
  if (goal.kind === 'metric') {
    const valued = own.filter((c) => c.value != null);
    const gaps = planGaps(goal, cycle, valued);
    const word = planGapTrend(gaps);
    if (word === 'worse') {
      const last = gaps.slice(-TREND_SPAN);
      const n = (v: number) => fixed(Math.abs(v), goal.decimals);
      return { word, detail: `Further behind plan at each of the last two check-ins: ${last.map((x) => (x.gap < 0 ? n(x.gap) + ' behind' : x.gap > 0 ? n(x.gap) + ' ahead' : 'on plan')).join(' → ')}${goal.unit ? ` (${goal.unit === '%' ? 'pts' : goal.unit})` : ''}.` };
    }
    // On track today, but heading short of the target: getting worse by where it's going, not where it is. Only when
    // the whole range it heads for, as shown, misses the target: "89–91% against a target of 90%" isn't heading short.
    if (valued.length >= TREND_SPAN) {
      const pts = valued.map((c) => ({ week: c.week, value: c.value as number }));
      const at = assessMetric(goal, cycle.weeks, pts[pts.length - 1]!.week, pts[pts.length - 1]!.value, pts.slice(0, -1));
      const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
      const best = at.projection ? Number((dir > 0 ? at.projection.high : at.projection.low).toFixed(goal.decimals)) : null;
      const allShort = best != null && (best - Number(goal.plan.target.toFixed(goal.decimals))) * dir < 0;
      if (at.forecastMisses && allShort && at.projection && at.calc === 'on') return { word: 'worse', detail: `${LABEL.on} today, but the recent trend heads for ${rangeText(at.projection, goal, isShare(goal))} by week ${at.projection.week}, against a target of ${fmt(goal.plan.target, goal)}.` };
    }
    return { word, detail: null };
  }
  if (goal.kind === 'range') {
    const v = own.filter((c) => c.value != null).map((c) => c.value as number).slice(-TREND_SPAN);
    const safe = goal.range.bound === 'atMost' ? -1 : 1;
    const word = gapTrend(v.map((x) => (x - goal.range.limit) * safe));
    if (word !== 'worse') return { word, detail: null };
    const out = assessRange(goal, 1, v[v.length - 1]!, null).out;
    return { word, detail: `${out ? 'Further past' : 'Closer to'} the limit at each of the last two check-ins: ${v.map((x) => fmt(x, goal)).join(' → ')} (limit ${fmt(goal.range.limit, goal)}).` };
  }
  const t = stagesTrend(goal, own);
  return { word: t.word, detail: t.slipped ? `${t.slipped.name} is expected later than at the check-in before: now ${weekLabel(t.slipped.week, cycle.weeks)}.` : null };
}
