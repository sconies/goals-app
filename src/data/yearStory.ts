/* The demo's goal years. Each example is written as a short story: its last seven weeks of check-ins, with the
   reasons and recovery plans people gave. This places that story at the end of a 52-week goal year, up to today,
   and fills the weeks before it with steady, on-plan check-ins, so every example has a year of history. */
import { evaluate, type Draft } from '../domain/checkin';
import { planAt } from '../domain/plan';
import type { CheckIn, Cycle, Goal, MetricPlan } from '../domain/types';
export { yearName } from '../domain/yearName';

export const YEAR_WEEKS = 52;
/** Today's week in each example's goal year. */
export const SEED_WEEK = 43;
/** The story's seven weeks are the last seven, up to today: story week w is year week w + STORY_OFFSET. */
export const STORY_OFFSET = SEED_WEEK - 7;
export const toYear = (storyWeek: number) => storyWeek + STORY_OFFSET;

/**
 * A story value moved into the year: as far ahead of or behind the year's plan as it was against the
 * story's own 13-week plan, so the reasons people gave still hold.
 */
export function storyValue(plan: MetricPlan, decimals: number, storyWeek: number, value: number): number {
  const planned13 = planAt({ start: plan.start, target: plan.target, shape: plan.shape }, storyWeek, 13) - plan.start;
  const planned52 = planAt(plan, toYear(storyWeek), YEAR_WEEKS) - plan.start;
  // Early in a short plan, tiny planned changes make the ratio swing wildly; keep it to a believable range.
  const raw = Math.abs(planned13) < 1e-9 ? 1 : (value - plan.start) / planned13;
  const ratio = Math.min(1.25, Math.max(0.6, raw));
  return Number((plan.start + ratio * planned52).toFixed(decimals));
}

/** A steady week before the story: on plan, give or take a little, chosen so the rules call it on track. */
export function steadyDraft(g: Goal, cycle: Cycle, week: number, base: Draft, history: CheckIn[], rangeValue?: number): Draft {
  if (g.kind === 'milestone') return base;
  const unit = 10 ** -g.decimals;
  const candidates: number[] = [];
  if (g.kind === 'metric') {
    const plan = planAt(g.plan, week, cycle.weeks);
    const dir = Math.sign(g.plan.target - g.plan.start) || 1;
    const wobble = (Math.sin(week * 1.7) * 0.6 + 0.4) * unit * 3;
    for (const v of [plan + dir * wobble, plan, plan + dir * unit, plan + dir * 2 * unit, plan - dir * unit]) candidates.push(Number(v.toFixed(g.decimals)));
  } else {
    const v = rangeValue ?? g.range.limit;
    candidates.push(Number((v + Math.sin(week * 1.3) * unit * 3).toFixed(g.decimals)), v);
  }
  const tryOne = (v: number) => {
    const d = { ...base, value: String(v) };
    return { d, e: evaluate(g, cycle, week, d, history) };
  };
  const all = candidates.map(tryOne);
  return (all.find((x) => x.e.status === 'on' && !x.e.reason) ?? all.find((x) => x.e.status === 'on') ?? all[0]!).d;
}
