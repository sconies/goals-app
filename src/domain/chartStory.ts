/* A number goal's story in plain words: where it stands against plan and how that compares with a few weeks ago, and
   where it's heading. Written for people, not analysts (Lane, 5 Nov: "94 → 93 → 61 £k behind plan: closing the gap,
   weeks 43–45. Heading for 3409–3706 £k by week 53…" was unreadable). One phrasing, used under the goal's chart and
   wherever the app says where a goal is heading (forecastText in tree.ts). */
import type { Cycle, MetricGoal, RangeGoal } from './types';

type Numeric = Pick<MetricGoal | RangeGoal, 'unit' | 'decimals'>;
import { planAt, weekDates } from './plan';

const CURRENCY = /^([£$€]|USD|GBP|EUR)\s?([km]?)$/i;
const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };

/** An amount people read at a glance: "£3.41m", "£61k", "83%", "12 days". Money units ("£k", "$m", "€") get the symbol
    in front and a k or m to suit the size; everything else keeps its unit. */
export function sayAmount(v: number, g: Numeric): string {
  const m = CURRENCY.exec(g.unit ?? '');
  if (m) {
    const sym = SYMBOL[m[1]!.toUpperCase()] ?? m[1]!;
    const scale = m[2]?.toLowerCase() === 'k' ? 1e3 : m[2]?.toLowerCase() === 'm' ? 1e6 : 1;
    const x = Math.abs(v * scale), sign = v < 0 ? '−' : '';
    const trim = (n: number, d: number) => String(Number(n.toFixed(d)));
    if (x >= 1e6) return `${sign}${sym}${trim(x / 1e6, x >= 1e7 ? 1 : 2)}m`;
    if (x >= 1e3) return `${sign}${sym}${trim(x / 1e3, x >= 1e4 ? 0 : 1)}k`;
    return `${sign}${sym}${Math.round(x)}`;
  }
  const n = Number(v.toFixed(g.decimals)).toLocaleString('en-GB', { maximumFractionDigits: g.decimals });
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

/** "£61k behind plan and catching up: it was £94k behind three weeks ago." */
export function standingSentence(goal: MetricGoal, points: { week: number; value: number }[], weeks: number): string | null {
  const valued = points.filter((p) => Number.isFinite(p.value));
  const last = valued[valued.length - 1];
  if (!last) return null;
  const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
  const gapAt = (p: { week: number; value: number }) => (p.value - planAt(goal.plan, p.week, weeks)) * dir;
  const unit = 10 ** -goal.decimals;
  const now = gapAt(last);
  const where = Math.abs(now) < unit / 2 ? 'On plan' : `${sayDiff(now, goal)} ${now < 0 ? 'behind' : 'ahead of'} plan`;
  const earlier = valued.length >= 2 ? valued[Math.max(0, valued.length - 3)]! : null;
  if (!earlier || earlier.week === last.week) return `${where}.`;
  const then = gapAt(earlier);
  const move = now - then;
  const when = ago(last.week - earlier.week);
  const thenWords = Math.abs(then) < unit / 2 ? 'on plan' : `${sayDiff(then, goal)} ${then < 0 ? 'behind' : 'ahead'}`;
  if (Math.abs(move) < unit) return `${where}, about the same as ${when}.`;
  if (now < 0) return move > 0 ? `${where} and catching up: it was ${thenWords} ${when}.` : `${where} and slipping${then < 0 ? ' further' : ''}: it was ${thenWords} ${when}.`;
  if (now > 0) return move > 0 ? `${where} and pulling ${then > 0 ? 'further ' : ''}ahead: it was ${thenWords} ${when}.` : `${where}, though the lead is shrinking: it was ${thenWords} ${when}.`;
  return `${where} again: it was ${thenWords} ${when}.`;
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
  const outcome = misses ? `${close === 'well ' ? 'well short of' : close === 'just ' ? 'just missing' : 'missing'} its target of ${target}` : `${close === 'well ' ? 'comfortably beating' : 'reaching'} its target of ${target}`;
  return `On its recent trend it ends at about ${likely} ${when}${range}, ${outcome}. Projected by the app from the last eight weeks, not the owner’s date.`;
}

/** A dated-stages goal: "3 weeks late and slipping: it was on time two weeks ago." */
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
  return last.late > earlier.late ? `${where} and slipping: it was ${then} ${when}.` : `${where} and recovering: it was ${then} ${when}.`;
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
  const move = inside ? (towards ? 'and moving towards it' : 'and moving away from it') : (towards ? 'and getting further past it' : 'and coming back towards it');
  return `${where}, ${move}: it was ${sayAmount(earlier.value, goal)} ${when}.`;
}

/** Where a limit goal is heading: "On its recent trend it ends at about 13.2% by the end of the year (somewhere between
    12.3% and 14.2%), over its 12% limit." */
export function rangeHeading(goal: RangeGoal, p: { value: number; low: number; high: number }, when: string): string {
  const likely = sayAmount(p.value, goal), lo = sayAmount(p.low, goal), hi = sayAmount(p.high, goal);
  const { bound, limit } = goal.range;
  const outside = bound === 'atMost' ? p.value > limit : p.value < limit;
  const side = bound === 'atMost' ? (outside ? 'over' : 'under') : (outside ? 'under' : 'over');
  return `On its recent trend it ends at about ${likely} ${when}${lo === hi ? '' : ` (somewhere between ${lo} and ${hi})`}, ${side} its ${sayAmount(limit, goal)} limit${outside ? '' : ' as it should be'}. Projected by the app from the last eight weeks.`;
}

/* ---------- the same story as short facts, for the goal page (Lane, 5 Nov: "rather show it, or point form") ---------- */

export type Tone = 'good' | 'bad' | 'flat';
export interface StoryRow { label: string; value: string; note?: string; tone?: Tone }
/** Where it will likely end, for a small bar: the range, the likeliest value, and the target or limit as a mark. */
export interface EndBar { low: number; high: number; likely: number; mark: number; markLabel: string; tone: Tone }
export interface StoryFacts { rows: StoryRow[]; end?: EndBar; footnote?: string }

const trendWord = (now: number, then: number, unit: number): { word: string; tone: Tone } => {
  const move = now - then;
  if (Math.abs(move) < unit) return { word: 'holding steady', tone: 'flat' };
  if (now < 0) return move > 0 ? { word: 'catching up', tone: 'good' } : { word: 'slipping', tone: 'bad' };
  return move > 0 ? { word: 'pulling ahead', tone: 'good' } : { word: 'lead shrinking', tone: 'bad' };
};

/** A number goal: Now, Likely end, Target. */
export function metricFacts(goal: MetricGoal, points: { week: number; value: number }[], weeks: number, p: { likely: number; low: number; high: number } | null, misses: boolean, when: string, share = false): StoryFacts {
  const rows: StoryRow[] = [];
  const valued = points.filter((x) => Number.isFinite(x.value));
  const last = valued[valued.length - 1];
  const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
  const unit = 10 ** -goal.decimals;
  const gapAt = (x: { week: number; value: number }) => (x.value - planAt(goal.plan, x.week, weeks)) * dir;
  if (last) {
    const now = gapAt(last);
    const value = Math.abs(now) < unit / 2 ? 'On plan' : `${sayDiff(now, goal)} ${now < 0 ? 'behind' : 'ahead'}`;
    const earlier = valued.length >= 2 ? valued[Math.max(0, valued.length - 3)]! : null;
    if (earlier && earlier.week !== last.week) {
      const then = gapAt(earlier);
      const t = trendWord(now, then, unit);
      const thenWords = Math.abs(then) < unit / 2 ? 'on plan' : `${sayDiff(then, goal)} ${then < 0 ? 'behind' : 'ahead'}`;
      rows.push({ label: 'Against plan', value, note: `${t.word} · was ${thenWords} ${ago(last.week - earlier.week)}`, tone: t.tone });
    } else rows.push({ label: 'Against plan', value });
  }
  if (!p) return { rows };
  const clamp = (v: number) => (share ? Math.min(100, Math.max(0, v)) : v);
  const lo = sayAmount(clamp(p.low), goal), hi = sayAmount(clamp(p.high), goal);
  rows.push({ label: 'Likely end', value: `about ${sayAmount(clamp(p.likely), goal)}`, note: `${when.replace(/^by /, 'by ')}${lo === hi ? '' : ` · could be ${lo} to ${hi}`}` });
  const span = Math.abs(goal.plan.target - goal.plan.start) || Math.abs(goal.plan.target) || 1;
  const off = Math.abs(p.likely - goal.plan.target) / span;
  const verdict = misses ? (off < 0.05 ? 'just missing it' : off > 0.25 ? 'well short' : 'missing it') : off > 0.25 ? 'comfortably beating it' : 'on course';
  rows.push({ label: 'Target', value: sayAmount(goal.plan.target, goal), note: verdict, tone: misses ? 'bad' : 'good' });
  return {
    rows,
    end: { low: clamp(p.low), high: clamp(p.high), likely: clamp(p.likely), mark: goal.plan.target, markLabel: `Target ${sayAmount(goal.plan.target, goal)}`, tone: misses ? 'bad' : 'good' },
    footnote: 'Projected by the app from the last eight weeks, not the owner’s date.',
  };
}

/** A goal kept inside a limit: Now, Likely end, Limit. */
export function rangeFacts(goal: RangeGoal, points: { week: number; value: number }[], p: { value: number; low: number; high: number } | null, when: string): StoryFacts {
  const rows: StoryRow[] = [];
  const { bound, limit } = goal.range;
  const outsideAt = (v: number) => (bound === 'atMost' ? v > limit : v < limit);
  const last = points[points.length - 1];
  if (last) {
    const earlier = points.length >= 2 ? points[Math.max(0, points.length - 3)]! : null;
    const worse = earlier ? (bound === 'atMost' ? last.value > earlier.value : last.value < earlier.value) : false;
    const note = [outsideAt(last.value) ? `outside the ${sayAmount(limit, goal)} limit` : `inside the ${sayAmount(limit, goal)} limit`, earlier && earlier.week !== last.week && earlier.value !== last.value ? `was ${sayAmount(earlier.value, goal)} ${ago(last.week - earlier.week)}` : ''].filter(Boolean).join(' · ');
    rows.push({ label: 'Now', value: sayAmount(last.value, goal), note, tone: outsideAt(last.value) || worse ? 'bad' : 'good' });
  }
  if (!p) return { rows };
  const out = outsideAt(p.value);
  const lo = sayAmount(p.low, goal), hi = sayAmount(p.high, goal);
  rows.push({ label: 'Likely end', value: `about ${sayAmount(p.value, goal)}`, note: `${when}${lo === hi ? '' : ` · could be ${lo} to ${hi}`}` });
  rows.push({ label: 'Limit', value: sayAmount(limit, goal), note: out ? (bound === 'atMost' ? 'heading over it' : 'heading under it') : 'staying inside it', tone: out ? 'bad' : 'good' });
  return { rows, end: { low: p.low, high: p.high, likely: p.value, mark: limit, markLabel: `Limit ${sayAmount(limit, goal)}`, tone: out ? 'bad' : 'good' }, footnote: 'Projected by the app from the last eight weeks.' };
}

/** A dated-stages goal: how late it is now, and which way. */
export function stageFacts(late: { week: number; late: number }[]): StoryFacts {
  const last = late[late.length - 1];
  if (!last) return { rows: [] };
  const w = (n: number) => (n === 1 ? '1 week late' : `${n} weeks late`);
  const earlier = late.length >= 2 ? late[0]! : null;
  const note = earlier && earlier.week !== last.week ? `${last.late > earlier.late ? 'slipping' : last.late < earlier.late ? 'recovering' : 'holding steady'} · was ${earlier.late === 0 ? 'on time' : w(earlier.late)} ${ago(last.week - earlier.week)}` : undefined;
  return { rows: [{ label: 'Stages', value: last.late === 0 ? 'On time' : w(last.late), note, tone: last.late === 0 ? 'good' : 'bad' }] };
}
