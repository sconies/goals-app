/* The example's goal year. It follows the calendar, so the demo's week number is today's real one, as long as today
   is far enough into the year for a year of history and the story's next steps still fit; otherwise it's the year
   starting in whichever month puts today nearest week 43 (a financial year). */
import { currentWeek } from '../../domain/plan';
import { goalYearFor, type GoalYear } from '../../domain/year';
import type { Cycle } from '../../domain/types';
export { yearName } from '../../domain/yearName';

/** The week the demo would ideally be in: late enough for a year of history, with room for the story's next steps. */
export const DEMO_WEEK = 43;
/** The story's dated steps run up to five weeks past today. */
const AHEAD = 5;
const EARLIEST = 20;

export interface DemoYear extends GoalYear { week: number }

export function demoYear(today: Date): DemoYear {
  const at = (month: number): DemoYear => { const y = goalYearFor(today, month); return { ...y, week: currentWeek(y as Cycle, today) }; };
  const fits = (y: DemoYear) => y.week >= EARLIEST && y.week <= y.weeks - AHEAD;
  const calendar = at(0);
  if (fits(calendar)) return calendar;
  return Array.from({ length: 12 }, (_, m) => at(m)).filter(fits).sort((a, b) => Math.abs(a.week - DEMO_WEEK) - Math.abs(b.week - DEMO_WEEK))[0]!;
}
