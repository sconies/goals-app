/* The range rule's sides (the status rule, src/spec/rules.ts): a number kept at most a limit, at least it, or between two
   numbers. Shared by the status, the words and the chart, so a range is judged one way everywhere. */
import type { RangePlan } from './types';

/** One side of a range: the limit and which way it must not be crossed. */
export type RangeSide = { bound: 'atMost' | 'atLeast'; limit: number };
/** Two distances equal once floating-point noise is set aside (1.7 − 1.6 against 1.8 − 1.7). */
const same = (a: number, b: number, scale: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(scale));
/** The side a value is judged against: a one-sided range's own; for a range between two numbers, the nearer bound (the
    upper as at most, the lower as at least; the upper when the two are as near, and with no value). Distances, not a
    floating-point midpoint, so 1.7 inside 1.6 to 1.8 is as near the upper as the lower. */
export const rangeSide = (r: RangePlan, v?: number | null): RangeSide => {
  if (r.bound !== 'between') return r as RangeSide;
  const toLower = v == null ? Infinity : v - r.lower!, toUpper = v == null ? Infinity : r.limit - v;
  return toLower < toUpper && !same(toLower, toUpper, r.limit) ? { bound: 'atLeast', limit: r.lower! } : { bound: 'atMost', limit: r.limit };
};
/** Room: how far a number is from crossing the range, negative once past it. Between two numbers, the smaller of its
    distances to the two bounds, so a number moving back towards the middle gains room whichever side it is on. Every
    trend, "since last week" and "will it stay within" reads a range goal's movement through this. */
export const rangeRoom = (r: RangePlan, v: number): number =>
  r.bound === 'atMost' ? r.limit - v : r.bound === 'atLeast' ? v - r.limit : Math.min(v - r.lower!, r.limit - v);
/** The sides a range has: one, or both bounds of a range between two numbers. */
export const rangeSides = (r: RangePlan): RangeSide[] =>
  r.bound === 'between' ? [{ bound: 'atLeast', limit: r.lower! }, { bound: 'atMost', limit: r.limit }] : [r as RangeSide];
/** Out: strictly past a bound (at most: above the limit; at least: below it; between: either). */
export const rangeOut = ({ bound, limit, lower }: RangePlan, v: number) => (bound !== 'atLeast' && v > limit) || (bound !== 'atMost' && v < (bound === 'between' ? lower! : limit));
/** Near: strictly within the margin of a bound (between: of either). */
export const rangeNear = ({ bound, limit, lower, margin }: RangePlan, v: number) =>
  (bound !== 'atLeast' && v > limit - margin) || (bound !== 'atMost' && v < (bound === 'between' ? lower! : limit) + margin);
