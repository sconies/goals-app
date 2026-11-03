import type { Assessment } from './status';
import type { Goal, Level, MetricGoal, RangeGoal } from './types';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;

export function fmt(v: number, g: Numeric): string {
  const n = v.toFixed(g.decimals);
  if (!g.unit) return n;
  return g.unit === '%' ? n + '%' : n + ' ' + g.unit;
}

/** A difference: "4 pts" for percentages, "1.2 days" otherwise. */
export function fmtDiff(v: number, g: Numeric): string {
  const n = Math.abs(v).toFixed(g.decimals);
  if (g.unit === '%') return n + (Number(n) === 1 ? ' pt' : ' pts');
  return g.unit ? n + ' ' + g.unit : n;
}

export const weekLabel = (w: number, weeks: number) => (w >= weeks ? (weeks >= 48 ? 'year end' : 'cycle end') : 'week ' + w);

export function kindLabel(g: Goal): string {
  if (g.kind === 'milestone') return 'Hit dated stages';
  if (g.kind === 'range') return 'Keep a number in range';
  return 'Move a number';
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
  if (a.calc === 'planned') return { short: 'Not started', long: 'It starts this week', tone: 'stale' };
  if (a.calc === 'none') return { short: g.kind === 'milestone' ? 'No check-in yet' : 'No value yet', long: 'Waiting for the first check-in', tone: 'stale' };
  if (a.kind === 'metric' && g.kind === 'metric') {
    const actual = a.actual as number;
    if (a.ratio == null) return { short: a.behind ? 'Going backwards' : 'On plan', long: 'No change planned yet', tone: a.behind ? 'risk' : 'on' };
    // Lead with the raw difference in the goal's own units; the progress score is secondary and labelled as such.
    const pct = Math.round(a.ratio * 100);
    const diff = Number((actual - a.plan).toFixed(g.decimals));
    return {
      // Name the week it's compared with, so views that use different weeks can't silently disagree.
      short: diff === 0 ? `On the week-${a.week} plan` : `${fmtDiff(diff, g)} ${diff > 0 ? 'above' : 'below'} week-${a.week} plan`,
      long: `${pct}% of the planned improvement so far (plan for this week: ${fmt(a.plan, g)})`,
      tone: a.ahead ? 'ahead' : a.calc === 'risk' || a.calc === 'off' ? a.calc : 'on',
    };
  }
  if (a.kind === 'range') {
    // Say what happened and show the limit: "over the limit" is a breach, "near the limit" is a warning.
    const lim = g.kind === 'range' ? fmt(g.range.limit, g) : '';
    const side = g.kind === 'range' && g.range.bound === 'atLeast' ? 'Under' : 'Over';
    if (a.calc === 'off') return { short: `${side} the ${lim} limit, 2 weeks running`, long: 'The guardrail has been breached two weeks running', tone: 'off' };
    if (a.out) return { short: `${side} the ${lim} limit`, long: 'The guardrail was breached this week; two weeks running makes it off track', tone: 'risk' };
    if (a.previousOut) return { short: `Back inside the ${lim} limit`, long: 'Over the limit last week, back inside this week', tone: 'risk' };
    if (a.near) return { short: `Near the ${lim} limit`, long: 'Inside the warning margin, not yet breached', tone: 'risk' };
    return { short: `Inside the ${lim} limit`, long: 'Inside the limit', tone: 'on' };
  }
  if (a.kind === 'milestone') {
    if (a.calc === 'done') return { short: 'Done', long: 'Every stage is done', tone: 'on' };
    const first = a.late[0];
    if (first) return { short: a.calc === 'off' ? 'Late' : 'Slipping', long: first.name + ': expected week ' + first.expectedWeek + ', ' + first.weeksLate + (first.weeksLate === 1 ? ' week' : ' weeks') + ' late', tone: a.calc === 'off' ? 'off' : 'risk' };
    return { short: 'On schedule', long: 'Every stage on schedule', tone: 'on' };
  }
  return { short: '', long: '', tone: 'stale' };
}

export const LEVEL_LABEL: Record<Level, string> = { 'north-star': 'North star', svp: 'SVP', team: 'Team' };
