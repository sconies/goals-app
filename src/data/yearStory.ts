/* The demo's goal years. Each example is written as a short story: its last seven weeks of check-ins, with the
   reasons and recovery plans people gave. This places that story at the end of a real goal year, up to today, and
   fills the weeks before it with steady, on-plan check-ins, so every example has a year of history. The year follows
   the calendar, so the demo's week number is today's real one. */
import { evaluate, type Draft } from '../domain/checkin';
import { currentWeek, planAt } from '../domain/plan';
import { goalYearFor, type GoalYear } from '../domain/year';
import type { CheckIn, Cycle, Goal, MetricPlan } from '../domain/types';
export { yearName } from '../domain/yearName';

/** The week the demo would ideally be in: late enough for a year of history, with room for the story's next steps. */
export const DEMO_WEEK = 43;
/** The story's dated steps run up to five weeks past today. */
const AHEAD = 5;
const EARLIEST = 20;

export interface DemoYear extends GoalYear { week: number }
/**
 * The goal year the demo is set in: the calendar year when today is far enough into it and the story's next steps
 * still fit; otherwise the year starting in whichever month puts today nearest week 43 (a financial year).
 */
export function demoYear(today: Date): DemoYear {
  const at = (month: number): DemoYear => { const y = goalYearFor(today, month); return { ...y, week: currentWeek(y as Cycle, today) }; };
  const fits = (y: DemoYear) => y.week >= EARLIEST && y.week <= y.weeks - AHEAD;
  const calendar = at(0);
  if (fits(calendar)) return calendar;
  return Array.from({ length: 12 }, (_, m) => at(m)).filter(fits).sort((a, b) => Math.abs(a.week - DEMO_WEEK) - Math.abs(b.week - DEMO_WEEK))[0]!;
}

/** The story's seven weeks are the last seven, up to today: story week w is year week w + offset. */
export const storyOffset = (week: number) => week - 7;
export const yearWeekOf = (week: number) => (storyWeek: number) => storyWeek + storyOffset(week);

/**
 * A story value moved into the year: as far ahead of or behind the year's plan as it was against the
 * story's own 13-week plan, so the reasons people gave still hold.
 */
export function storyValue(plan: MetricPlan, decimals: number, storyWeek: number, value: number, year: { week: number; weeks: number }): number {
  const planned13 = planAt({ start: plan.start, target: plan.target, shape: plan.shape }, storyWeek, 13) - plan.start;
  const plannedYear = planAt(plan, yearWeekOf(year.week)(storyWeek), year.weeks) - plan.start;
  // Early in a short plan, tiny planned changes make the ratio swing wildly; keep it to a believable range.
  const raw = Math.abs(planned13) < 1e-9 ? 1 : (value - plan.start) / planned13;
  const ratio = Math.min(1.25, Math.max(0.6, raw));
  // A week ahead of plan is rounded further ahead, so rounding never turns "well ahead" into "on plan".
  const f = 10 ** decimals;
  const exact = (plan.start + ratio * plannedYear) * f;
  if (ratio < 1) return Number((exact / f).toFixed(decimals));
  return Number(((plannedYear >= 0 ? Math.ceil(exact - 1e-6) : Math.floor(exact + 1e-6)) / f).toFixed(decimals));
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
