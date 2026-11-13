import type { Assessment } from './status';
import type { Goal, MetricGoal, RangeGoal } from './types';
import { fixed } from './numbers';
import { rangeSide } from './range';
import { GAP, gapPhrase, LABEL, STAGE } from './vocabulary';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;

/** A plural word unit reads singular after exactly "1": "1 template", "1 hour"; "1.0 hours" and "k$" are left alone. */
export function unitFor(n: string, unit: string): string {
  return n === '1' && /^[a-z][a-z-]+[^s]s$/.test(unit) ? unit.slice(0, -1) : unit;
}

export function fmt(v: number, g: Numeric): string {
  const n = fixed(v, g.decimals);
  if (!g.unit) return n;
  return g.unit === '%' ? n + '%' : n + ' ' + unitFor(n, g.unit);
}

/** The words for a goal with no number yet: the same in every list, card, headline and export. */
export const NO_VALUE = 'No value yet';

/** A goal's number as it's shown: its latest value, how many stages are done, its baseline before the first check-in
    ("41.5 min (baseline)", domain/baseline rule 2), or "No value yet". */
export function nowText(g: Goal, a: Assessment): string {
  if (a.kind === 'milestone') return `${a.doneCount} of ${a.stages.length} stages`;
  if (a.actual == null && g.kind === 'metric' && g.baseline) return `${fmt(g.baseline.value, g)} (baseline)`;
  return a.actual == null || g.kind === 'milestone' ? NO_VALUE : fmt(a.actual, g);
}

/** A difference: "4 pts" for percentages, "1.2 days" otherwise. */
export function fmtDiff(v: number, g: Numeric): string {
  const n = fixed(Math.abs(v), g.decimals);
  if (g.unit === '%') return n + (Number(n) === 1 ? ' pt' : ' pts');
  return g.unit ? n + ' ' + unitFor(n, g.unit) : n;
}

/**
 * A projection's range in the goal's units: "81–85%", or one number when both ends round to it. A share keeps to
 * 0–100% (`share`); the range never says less than nothing or more than everything.
 */
export function rangeText(p: { low: number; high: number }, g: Numeric, share = false): string {
  const clamp = (v: number) => (share ? Math.min(100, Math.max(0, v)) : v);
  const lo = fmt(clamp(p.low), g), hi = fmt(clamp(p.high), g);
  if (lo === hi) return lo;
  // "81–85%" and "12–15 days": the unit once, after the range.
  const bare = (v: number) => fixed(clamp(v), g.decimals);
  return `${bare(p.low)}–${hi}`;
}

export const weekLabel =(w: number, weeks: number) => (w >= weeks ? (weeks >= 48 ? 'year end' : 'cycle end') : 'week ' + w);

/** A goal's kind as words that follow its level ("North star · a number to move"): the print page (goal spec, 2.8). */
export function kindWords(g: Goal): string {
  if (g.kind === 'milestone') return 'dated stages';
  if (g.kind === 'range') return 'a number to keep in range';
  return 'a number to move';
}

export function kindLabel(g: Goal): string {
  if (g.kind === 'milestone') return 'Hit dated stages';
  if (g.kind === 'range') return 'Keep a number in range';
  return 'Move a number';
}

export function directionLabel(g: Goal): string {
  if (g.kind === 'metric') return g.plan.target < g.plan.start ? 'lower is better' : 'higher is better';
  if (g.kind === 'range') return staysText(g);
  return g.stages.length + ' dated stages';
}

/** What a range must stay, in words: "at most 2%", "at least 99%", "between 99.5% and 99.95%". */
export function staysText(g: RangeGoal): string {
  const { bound, limit, lower } = g.range;
  return bound === 'between' ? `between ${fmt(lower!, g)} and ${fmt(limit, g)}` : `${bound === 'atMost' ? 'at most' : 'at least'} ${fmt(limit, g)}`;
}

export function targetText(g: Goal): string {
  if (g.kind === 'metric') return fmt(g.plan.target, g);
  if (g.kind === 'range') return g.range.bound === 'between' ? `${fmt(g.range.lower!, g)}–${fmt(g.range.limit, g)}` : (g.range.bound === 'atMost' ? '≤ ' : '≥ ') + fmt(g.range.limit, g);
  const last = g.stages[g.stages.length - 1];
  return last ? 'All by week ' + last.dueWeek : 'No stages';
}

/** The gap shown beside a goal's number, or null when it would only say "No value yet" a second time. */
export function gapBeside(g: Goal, a: Assessment): ReturnType<typeof gapText> | null {
  const gap = gapText(g, a);
  return gap.short === nowText(g, a) ? null : gap;
}

/** Short words for the gap against plan, and its tone for colour. */
export function gapText(g: Goal, a: Assessment): { short: string; long: string; tone: 'on' | 'risk' | 'off' | 'ahead' | 'stale' } {
  if (a.calc === 'planned') return { short: LABEL.planned, long: 'It starts this week', tone: 'stale' };
  if (a.calc === 'none') return { short: g.kind === 'milestone' ? LABEL.none : NO_VALUE, long: LABEL.none, tone: 'stale' };
  if (a.kind === 'metric' && g.kind === 'metric') {
    const actual = a.actual as number;
    if (a.ratio == null) return { short: a.behind ? 'Going backwards' : GAP['on-plan'].label, long: 'No change planned yet', tone: a.behind ? 'risk' : 'on' };
    // Lead with the raw difference in the goal's own units, said the same whichever way is better ("9 hours behind
    // plan", "3 pts ahead of plan"); the progress score is secondary and labelled as such. The week it's compared
    // with is the latest number's own: the history and the week inspector say which.
    const pct = Math.round(a.ratio * 100);
    const better = Number(((actual - a.plan) * (Math.sign(g.plan.target - g.plan.start) || 1)).toFixed(g.decimals));
    return {
      short: gapPhrase(better, fmtDiff(better, g)),
      long: `${pct}% of the planned improvement so far (plan for week ${a.week}: ${fmt(a.plan, g)})`,
      tone: a.ahead ? 'ahead' : a.calc === 'risk' || a.calc === 'off' ? a.calc : 'on',
    };
  }
  if (a.kind === 'range') {
    // Say what happened and show the limit: "over the limit" is a breach, "near the limit" is a warning.
    // A range between two numbers is judged against the bound nearer its number.
    const r = g.kind === 'range' ? g.range : null, at = r && rangeSide(r, a.actual);
    const lim = at ? fmt(at.limit, g as RangeGoal) : '';
    const side = at?.bound === 'atLeast' ? 'Under' : 'Over';
    const within = r?.bound === 'between' ? staysText(g as RangeGoal) : `inside the ${lim} limit`;
    if (a.calc === 'off') return { short: `${side} the ${lim} limit, 2 weeks running`, long: 'The guardrail has been breached two weeks running', tone: 'off' };
    if (a.out) return { short: `${side} the ${lim} limit`, long: 'The guardrail was breached this week; two weeks running makes it off track', tone: 'risk' };
    if (a.previousOut) return { short: `Back ${within}`, long: 'Over the limit last week, back inside this week', tone: 'risk' };
    if (a.near) return { short: `Near the ${lim} limit`, long: 'Inside the warning margin, not yet breached', tone: 'risk' };
    return { short: within[0]!.toUpperCase() + within.slice(1), long: 'Inside the limit', tone: 'on' };
  }
  if (a.kind === 'milestone') {
    if (a.calc === 'done') return { short: GAP.reached.label, long: 'Every stage is done', tone: 'on' };
    const first = a.late[0];
    if (first) return { short: a.calc === 'off' ? STAGE.off.label : STAGE.risk.label, long: first.name + ': expected week ' + first.expectedWeek + ', ' + first.weeksLate + (first.weeksLate === 1 ? ' week' : ' weeks') + ' late', tone: a.calc === 'off' ? 'off' : 'risk' };
    return { short: STAGE.planned.label, long: 'Every stage ' + STAGE.planned.label.toLowerCase(), tone: 'on' };
  }
  return { short: '', long: '', tone: 'stale' };
}

/* One formatter, and each day's words once: building a formatter per call (toLocaleDateString) made the due flag, said
   for every goal in every attention list, the slowest part of the lists (N29). */
const DAY_TEXT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayTexts = new Map<string, string>();
/** "Thu 5 Nov", from yyyy-mm-dd or a full timestamp. */
export const dayText = (iso: string): string => {
  const day = iso.slice(0, 10);
  let t = dayTexts.get(day);
  if (t === undefined) { t = DAY_TEXT.format(new Date(day + 'T00:00:00Z')); dayTexts.set(day, t); }
  return t;
};
