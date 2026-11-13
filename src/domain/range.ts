/* The range rule's sides (the status rule, src/spec/rules.ts): a number kept at most a limit, at least it, or between two
   numbers. Shared by the status, the words and the chart, so a range is judged one way everywhere. */
import type { RangePlan } from './types';

/** One side of a range: the limit and which way it must not be crossed. */
export type RangeSide = { bound: 'atMost' | 'atLeast'; limit: number };
/** The side a value is judged against: a one-sided range's own; for a range between two numbers, the nearer bound (the
    upper as at most, the lower as at least; the upper from the middle up, and with no value). */
export const rangeSide = (r: RangePlan, v?: number | null): RangeSide =>
  r.bound !== 'between' ? (r as RangeSide) : v != null && v < (r.lower! + r.limit) / 2 ? { bound: 'atLeast', limit: r.lower! } : { bound: 'atMost', limit: r.limit };
/** Out: strictly past a bound (at most: above the limit; at least: below it; between: either). */
export const rangeOut = ({ bound, limit, lower }: RangePlan, v: number) => (bound !== 'atLeast' && v > limit) || (bound !== 'atMost' && v < (bound === 'between' ? lower! : limit));
/** Near: strictly within the margin of a bound (between: of either). */
export const rangeNear = ({ bound, limit, lower, margin }: RangePlan, v: number) =>
  (bound !== 'atLeast' && v > limit - margin) || (bound !== 'atMost' && v < (bound === 'between' ? lower! : limit) + margin);
