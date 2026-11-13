/* A number goal's story in plain words: where it stands against plan and how that compares with a few weeks ago, and
   where it's heading. Written for people, not analysts (Lane, 5 Nov: "94 → 93 → 61 £k behind plan: closing the gap,
   weeks 43–45. Heading for 3409–3706 £k by week 53…" was unreadable). One phrasing, used under the goal's chart and
   wherever the app says where a goal is heading (forecastText in tree.ts). */
import type { Cycle, MetricGoal, RangeGoal } from './types';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;
import { planAt, weekDates } from './plan';
import { rangeOut, rangeSide } from './range';
import { planGapTrend } from './trend';
import { GAP, lower, shortWord, TREND } from './vocabulary';

const CURRENCY = /^([£$€]|USD|GBP|EUR)\s?([km]?)$/i;
const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };

// One formatter per number of decimals, made once: making one is slow, and every goal's summary says amounts (AX4).
const NUMBER_FORMATS = new Map<number, Intl.NumberFormat>();
const numberFormat = (decimals: number) => {
  let f = NUMBER_FORMATS.get(decimals);
  if (!f) NUMBER_FORMATS.set(decimals, (f = new Intl.NumberFormat('en-GB', { maximumFractionDigits: decimals })));
  return f;
};

/** An amount people read at a glance: "£3.41m", "£61k", "83%", "12 days". Money units ("£k", "$m", "€") get the symbol
    in front and a k or m to suit the size; everything else keeps its unit. */
export function sayAmount(v: number, g: Numeric): string {
  const m = CURRENCY.exec(g.unit ?? '');
  if (m) {
    const sym = SYMBOL[m[1]!.toUpperCase()] ?? m[1]!;
    const scale = m[2]?.toLowerCase() === 'k' ? 1e3 : m[2]?.toLowerCase() === 'm' ? 1e6 : 1;
    const x = Math.abs(v * scale), sign = v < 0 ? '−' : '';
    const trim = (n: number, d: number) => String(Number(n.toFixed(d)));
    // Never fewer decimals than the goal keeps in its own unit (review F03: 0.62 USD read "about $1").
    const own = (display: number, d: number) => (display === scale ? Math.max(d, g.decimals) : d);
    if (x >= 1e6) return `${sign}${sym}${trim(x / 1e6, own(1e6, x >= 1e7 ? 1 : 2))}m`;
    if (x >= 1e3) return `${sign}${sym}${trim(x / 1e3, own(1e3, x >= 1e4 ? 0 : 1))}k`;
    // Small amounts in the goal's own unit keep its decimals as written: "$0.60", not "$0.6".
    return `${sign}${sym}${scale === 1 && g.decimals > 0 ? x.toFixed(g.decimals) : String(Math.round(x))}`;
  }
  const n = numberFormat(g.decimals).format(Number(v.toFixed(g.decimals)));
  if (!g.unit) return n;
  if (g.unit === '%') return n + '%';
  // "1 day", not "1 days".
  return `${n} ${Math.abs(Number(v.toFixed(g.decimals))) === 1 && /[a-z]s$/i.test(g.unit) ? g.unit.slice(0, -1) : g.unit}`;
}

/** A difference: "3 points" for percentages, otherwise the amount ("£61k", "2 days"). */
export function sayDiff(v: number, g: Numeric): string {
  if (g.unit === '%') { const n = Number(Math.abs(v).toFixed(g.decimals)); return `${n} ${n === 1 ? 'point' : 'points'}`; }
  return sayAmount(Math.abs(v), g);
}

const ago = (weeks: number) => (weeks <= 1 ? 'last week' : `${weeks === 2 ? 'two' : weeks === 3 ? 'three' : weeks === 4 ? 'four' : String(weeks)} weeks ago`);

/** "£61k behind plan and getting better: it was £94k behind two weeks ago." Which way it's heading is the one trend rule (trend.ts). */
export function standingSentence(goal: MetricGoal, points: { week: number; value: number }[], weeks: number): string | null {
  const valued = points.filter((p) => Number.isFinite(p.value));
  const last = valued[valued.length - 1];
  if (!last) return null;
  const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
  const gapAt = (p: { week: number; value: number }) => (p.value - planAt(goal.plan, p.week, weeks)) * dir;
  const unit = 10 ** -goal.decimals;
  const now = gapAt(last);
  const where = Math.abs(now) < unit / 2 ? GAP['on-plan'].label : `${sayDiff(now, goal)} ${now < 0 ? GAP.behind.label : GAP.ahead.label}`;
  const earlier = valued.length >= 2 ? valued[Math.max(0, valued.length - 3)]! : null;
  if (!earlier || earlier.week === last.week) return `${where}.`;
  const then = gapAt(earlier);
  const move = now - then;
  const when = ago(last.week - earlier.week);
  const thenWords = Math.abs(then) < unit / 2 ? 'on plan' : `${sayDiff(then, goal)} ${then < 0 ? 'behind' : 'ahead'}`;
  if (Math.abs(move) < unit) return `${where}, about the same as ${when}.`;
  // The one rule for a number's trend (domain/trend.ts planGapTrend): worse only if it shows at the goal's decimals.
  const word = planGapTrend(valued.slice(-3).map(gapAt).map((raw) => ({ raw, gap: Number(raw.toFixed(goal.decimals)) })));
  if (word !== 'flat') return `${where} and ${lower(TREND[word])}: it was ${thenWords} ${when}.`;
  return `${where}; it was ${thenWords} ${when}.`;
}

/** The last day of the week a goal is due, said as a date: "by 3 Jan". */
export function byWhen(cycle: Cycle | undefined, due: number): string {
  if (!cycle) return `by week ${due}`;
  if (due >= cycle.weeks) return cycle.weeks >= 48 ? 'by the end of the year' : 'by the end of the cycle';
  const days = weekDates(cycle, due);
  return 'by ' + days.split('–').pop()!.trim();
}

/**
 * "On its recent trend it ends at about £3.56m by 3 Jan (somewhere between £3.41m and £3.71m), just missing the £3.6m
 * target. Projected by the app from the last eight weeks, not the owner's date."
 */
export function headingSentence(goal: MetricGoal, p: { likely: number; low: number; high: number }, misses: boolean, when: string, share = false): string {
  const clamp = (v: number) => (share ? Math.min(100, Math.max(0, v)) : v);
  const likely = sayAmount(clamp(p.likely), goal), lo = sayAmount(clamp(p.low), goal), hi = sayAmount(clamp(p.high), goal);
  const range = lo === hi ? '' : ` (somewhere between ${lo} and ${hi})`;
  const target = sayAmount(goal.plan.target, goal);
  const span = Math.abs(goal.plan.target - goal.plan.start) || Math.abs(goal.plan.target) || 1;
  const off = Math.abs(p.likely - goal.plan.target) / span;
  const close = off < 0.05 ? 'just ' : off > 0.25 ? 'well ' : '';
  // "Well over" a target where lower is better, as every gap says it (demo review, 8 Nov).
  const wellMiss = `well ${shortWord(goal.plan.target >= goal.plan.start ? 1 : -1)} of`.replace('over of', 'over');
  const outcome = misses ? `${close === 'well ' ? wellMiss : close === 'just ' ? 'just missing' : 'missing'} its target of ${target}` : `${close === 'well ' ? 'comfortably beating' : 'reaching'} its target of ${target}`;
  return `On its recent trend it ends at about ${likely} ${when}${range}, ${outcome}. Projected by the app from the last eight weeks, not the owner’s date.`;
}

/** A dated-stages goal: "3 weeks late and getting worse: it was on time two weeks ago." */
export function stagesSentence(late: { week: number; late: number }[]): string | null {
  const last = late[late.length - 1];
  if (!last) return null;
  const w = (n: number) => (n === 1 ? '1 week' : `${n} weeks`);
  const where = last.late === 0 ? 'On time' : `${w(last.late)} late`;
  const earlier = late.length >= 2 ? late[0]! : null;
  if (!earlier || earlier.week === last.week) return `${where}.`;
  const when = ago(last.week - earlier.week);
  const then = earlier.late === 0 ? 'on time' : `${w(earlier.late)} late`;
  if (earlier.late === last.late) return `${where}, the same as ${when}.`;
  return `${where} and ${lower(TREND[last.late > earlier.late ? 'worse' : 'better'])}: it was ${then} ${when}.`;
}

/** A goal that stays inside a limit: "Inside the limit at 4.2 hours, and moving towards it: it was 3.1 hours two weeks ago." */
export function rangeSentence(goal: RangeGoal, points: { week: number; value: number }[], inside: boolean, towards: boolean | null): string | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const where = `${inside ? 'Inside' : 'Outside'} the limit at ${sayAmount(last.value, goal)}`;
  const earlier = points.length >= 2 ? points[Math.max(0, points.length - 3)]! : null;
  if (!earlier || towards == null || earlier.week === last.week) return `${where}.`;
  const when = ago(last.week - earlier.week);
  if (earlier.value === last.value) return `${where}, the same as ${when}.`;
  const move = `and ${lower(TREND[towards ? 'worse' : 'better'])}`;
  return `${where}, ${move}: it was ${sayAmount(earlier.value, goal)} ${when}.`;
}

/** Where a limit goal is heading: "On its recent trend it ends at about 13.2% by the end of the year (somewhere between
    12.3% and 14.2%), over its 12% limit." */
export function rangeHeading(goal: RangeGoal, p: { value: number; low: number; high: number }, when: string): string {
  const likely = sayAmount(p.value, goal), lo = sayAmount(p.low, goal), hi = sayAmount(p.high, goal);
  const { bound, limit, lower } = goal.range;
  const outside = rangeOut(goal.range, p.value);
  const at = rangeSide(goal.range, p.value);
  const side = at.bound === 'atMost' ? (outside ? 'over' : 'under') : (outside ? 'under' : 'over');
  const where = bound === 'between' && !outside ? `between its ${sayAmount(lower!, goal)} and ${sayAmount(limit, goal)} limits` : `${side} its ${sayAmount(at.limit, goal)} limit`;
  return `On its recent trend it ends at about ${likely} ${when}${lo === hi ? '' : ` (somewhere between ${lo} and ${hi})`}, ${where}${outside ? '' : ' as it should be'}. Projected by the app from the last eight weeks.`;
}
