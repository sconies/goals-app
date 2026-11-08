/* Small goals and check-ins the spec's worked examples use, the same as src/domain/rules.test.ts's. Pure. */
import type { CheckIn, Cycle, MetricGoal, MilestoneGoal, RangeGoal } from '../domain/types';

/** A 13-week cycle starting Monday 7 September 2026, reviewed on Thursdays. */
export const CYCLE: Cycle = { id: 'c1', name: 'Q4', startDate: '2026-09-07', weeks: 13, reviewDay: 3 };

const base = { cycleId: 'c1', teamId: 't', ownerId: 'p', io: 'input' as const, level: 'team' as const, guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '2026-09-01T00:00:00Z' };

/** A number to move, in %, whole numbers. */
export const metric = (start: number, target: number, shape: 'straight' | 'back' | 'stepped' = 'straight', extra: Partial<MetricGoal> = {}): MetricGoal =>
  ({ ...base, id: 'm', title: 'M', kind: 'metric', unit: '%', decimals: 0, plan: { start, target, shape }, originalPlan: null, rebaselinedWeek: null, ...extra });

/** A change failure rate to keep at most 12.0%, warning within 1 point. */
export const RANGE: RangeGoal = { ...base, id: 'r', title: 'Change failure rate', kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 12, margin: 1 } };

/** Two dated stages: A due in week 3, B in week 7. */
export const MILESTONE: MilestoneGoal = { ...base, id: 'ms', title: 'Launch', kind: 'milestone', stages: [{ id: 'a', name: 'A', dueWeek: 3 }, { id: 'b', name: 'B', dueWeek: 7 }] };

/** A check-in in a week, posted that week's Monday at 10:00 UTC, on track unless said otherwise. */
export const checkIn = (goalId: string, week: number, value: number | null, extra: Partial<CheckIn> = {}): CheckIn => ({
  id: goalId + week, goalId, authorId: 'p', week, postedAt: new Date(Date.parse('2026-09-07T10:00:00Z') + week * 7 * 86_400_000).toISOString(),
  value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false, ...extra,
});

/** A number to a few decimals, without trailing noise: 43.846. */
export const n = (v: number | null | undefined, d = 3) => (v == null ? 'none' : String(Number(v.toFixed(d))));
