import type { Assessment } from './status';
import type { Goal, MetricGoal, RangeGoal } from './types';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;

export function fmt(v: number, g: Numeric): string {
  const n = v.toFixed(g.decimals);
  if (!g.unit) return n;
  return g.unit === '%' ? n + '%' : n + ' ' + g.unit;
}

/** A difference: "4 pts" for percentages, "1.2 days" otherwise. */
export function fmtDiff(v: number, g: Numeric): string {
  const n = Math.abs(v).toFixed(g.decimals);
  if (g.unit === '%') return n + ' pts';
  return g.unit ? n + ' ' + g.unit : n;
}

export const weekLabel = (w: number, weeks: number) => (w >= weeks ? 'cycle end' : 'week ' + w);

export function kindLabel(g: Goal): string {
  if (g.kind === 'milestone') return 'Milestone';
  if (g.kind === 'range') return 'Keep within a range';
  return g.headline ? 'Headline metric' : 'Move a metric';
}

export function directionLabel(g: Goal): string {
  if (g.kind === 'metric') return g.plan.target < g.plan.start ? 'lower is better' : 'higher is better';
  if (g.kind === 'range') return g.range.bound === 'atMost' ? 'at most ' + fmt(g.range.limit, g) : 'at least ' + fmt(g.range.limit, g);
  return g.stages.length + ' dated stages';
}

export function targetText(g: Goal): string {
  if (g.kind === 'metric') return fmt(g.plan.target, g);
  if (g.kind === 'range') return (g.range.bound === 'atMost' ? '≤ ' : '≥ ') + fmt(g.range.limit, g);
  const last = g.stages[g.stages.length - 1];
  return last ? 'All by week ' + last.dueWeek : 'No stages';
}

/** Short words for the gap against plan, and its tone for colour. */
export function gapText(g: Goal, a: Assessment): { short: string; long: string; tone: 'on' | 'risk' | 'off' | 'ahead' | 'stale' } {
  if (a.calc === 'planned') return { short: 'Not started', long: 'The cycle starts this week', tone: 'stale' };
  if (a.calc === 'none') return { short: 'No value yet', long: 'Waiting for the first check-in', tone: 'stale' };
  if (a.kind === 'metric' && g.kind === 'metric') {
    const actual = a.actual as number;
    if (a.ratio == null) return { short: a.behind ? 'Going backwards' : 'On plan', long: 'No change planned yet', tone: a.behind ? 'risk' : 'on' };
    const ahead = a.ratio >= 1;
    const pct = Math.round(a.ratio * 100);
    return {
      short: Math.abs(pct - 100) + '% ' + (ahead ? 'ahead' : 'behind'),
      long: (ahead ? 'Ahead ' : 'Behind ') + fmtDiff(actual - a.plan, g) + ' · ' + pct + '% of planned progress',
      tone: a.ahead ? 'ahead' : a.calc === 'risk' || a.calc === 'off' ? a.calc : 'on',
    };
  }
  if (a.kind === 'range') {
    if (a.calc === 'off') return { short: 'Breached', long: 'Out of range two weeks running', tone: 'off' };
    if (a.out) return { short: 'Breached', long: 'Out of range this week', tone: 'risk' };
    if (a.previousOut) return { short: 'Back in range', long: 'Out of range last week, back in this week', tone: 'risk' };
    if (a.near) return { short: 'Near the limit', long: 'Inside the warning margin', tone: 'risk' };
    return { short: 'In range', long: 'Inside the range', tone: 'on' };
  }
  if (a.kind === 'milestone') {
    if (a.calc === 'done') return { short: 'Done', long: 'Every stage is done', tone: 'on' };
    const first = a.late[0];
    if (first) return { short: a.calc === 'off' ? 'Late' : 'Slipping', long: first.name + ': expected week ' + first.expectedWeek + ', ' + first.weeksLate + (first.weeksLate === 1 ? ' week' : ' weeks') + ' late', tone: a.calc === 'off' ? 'off' : 'risk' };
    return { short: 'On schedule', long: 'Every stage on schedule', tone: 'on' };
  }
  return { short: '', long: '', tone: 'stale' };
}
