/**
 * A baseline as a field of its own (backlog BL; core, docs/architecture/module-map.md).
 *
 * A number goal's baseline is a figure already known for a period ("June to September 2026"), often provisional. It is
 * the plan's start, said honestly: where it comes from, and how firm it is.
 *
 * Rule 1. A goal has a baseline of its own when its period is given; its figure is the plan's start.
 * Rule 2. Until the goal's first check-in, the baseline is shown as its number (format.ts nowText: "41.5 min (baseline)"), marked as the baseline, with its period
 *         and "provisional" when it is. It is not a check-in: status, the trend and what is due are worked out as before.
 * Rule 3. Firming up a provisional baseline is not a plan change: while the plan starts from a provisional baseline,
 *         moving that start (and nothing else in the plan) neither asks why nor keeps the old plan.
 */
import type { Baseline, Goal } from './types';

/** The longest period, in characters (the database holds it too: okr_goals_baseline_period_len). */
export const BASELINE_PERIOD_MAX = 60;

/** Rule 1. The baseline a goal's plan start, period and flag make: null when no period is given. */
export function baselineOf(start: number | null, period: string | undefined, provisional: boolean | undefined): Baseline | null {
  const p = (period ?? '').trim();
  if (start == null || !p) return null;
  return { value: start, period: p, provisional: !!provisional };
}

/** "Baseline, June to September 2026, provisional". */
export function baselineWords(b: Baseline): string {
  return ['Baseline', b.period, b.provisional ? 'provisional' : ''].filter(Boolean).join(', ');
}

/** Rule 2. The baseline to show as the goal's number: only a number goal's, and only before its first check-in. */
export function baselineShown(g: Goal, hasNumber: boolean): Baseline | null {
  if (hasNumber || g.kind !== 'metric' || !g.baseline) return null;
  return g.baseline;
}

/** Rule 3, its first half: the plan starts from a provisional baseline (goal.ts planChanged holds the rest). */
export function startsFromProvisional(g: Goal): boolean {
  return g.kind === 'metric' && !!g.baseline?.provisional && g.baseline.value === g.plan.start;
}

/** The period's problem in words, or null: at most 60 characters. */
export function periodProblem(period: string): string | null {
  return period.trim().length > BASELINE_PERIOD_MAX ? `The baseline’s period can be at most ${BASELINE_PERIOD_MAX} characters.` : null;
}
