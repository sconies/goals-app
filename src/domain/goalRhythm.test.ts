// @vitest-environment node
/* A goal's own check-in rhythm (MQ2 part 3, domain/goalRhythm): monthly or quarterly, due by its period's last due day,
   never "No recent update" in between. The spec's cycle starts Mon 7 Sept 2026, 13 weeks, due by Thursday: September's
   due days are weeks 1–2, October's 3–7 (1, 8, 15, 22, 29 Oct), November's 8–11, December's 12–13. */
import { buildPlatformOrg } from '../data/platformOrg';
import { CYCLE, checkIn, metric } from '../spec/examples';
import { flagsFor } from './attention';
import { checkedInFor, goalRhythmOf, isDueWeek, periodKey, periodWeeks, rhythmChange, staleAfterDaysFor, weeksCounting, withRhythm } from './goalRhythm';
import { onTimeStreak, weekProgress } from './progress';
import { dueIn } from './standing';
import { goalStatus } from './status';
import type { Cycle, MilestoneGoal, Snapshot } from './types';

const NONE: Cycle = { ...CYCLE, checkInWeeks: 0 };
const THU_8_OCT = new Date('2026-10-08T12:00:00Z');
const empty = (() => {
  const s = buildPlatformOrg(THU_8_OCT) as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) ? [] : v])) as unknown as Snapshot;
})();
const snap = (over: Partial<Snapshot>): Snapshot => ({ ...empty, cycles: [CYCLE], ...over });
const weekly = metric(0, 100);
const monthly = metric(0, 100, 'straight', { checkInRhythm: 'monthly' });
const quarterly = metric(0, 100, 'straight', { checkInRhythm: 'quarterly' });
const x = { actor: { id: 'p' }, now: '2026-10-08T12:00:00Z', newId: (p: string) => `${p}_1` };

describe('a goal’s own rhythm', () => {
  it('follows the cycle when empty, and nothing is due with no set rhythm whatever the goal says', () => {
    expect(goalRhythmOf(weekly, CYCLE)).toBe('weekly');
    expect(goalRhythmOf(monthly, CYCLE)).toBe('monthly');
    expect(goalRhythmOf(monthly, NONE)).toBeNull();
    expect(staleAfterDaysFor(weekly, CYCLE)).toBe(14);
    expect(staleAfterDaysFor(monthly, CYCLE)).toBe(62);
    expect(staleAfterDaysFor(quarterly, CYCLE)).toBe(184);
    expect(staleAfterDaysFor(monthly, NONE)).toBeNull();
  });

  it('groups the cycle’s weeks by calendar month or quarter, by each week’s due day', () => {
    expect(periodKey('monthly', '2026-10-29')).toBe('2026-10');
    expect(periodKey('quarterly', '2026-10-01')).toBe('2026-Q4');
    expect(periodKey('quarterly', '2026-09-24')).toBe('2026-Q3');
    expect(periodWeeks('monthly', CYCLE, 5)).toEqual([3, 4, 5, 6, 7]);
    expect(periodWeeks('quarterly', CYCLE, 5)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(isDueWeek(monthly, CYCLE, 5)).toBe(false);
    expect(isDueWeek(monthly, CYCLE, 7)).toBe(true);
    expect(isDueWeek(quarterly, CYCLE, 7)).toBe(false);
    expect(isDueWeek(quarterly, CYCLE, 13)).toBe(true);
    expect(isDueWeek(weekly, CYCLE, 5)).toBe(true);
    expect(weeksCounting(monthly, CYCLE, 5)).toEqual([3, 4, 5]);
    expect(weeksCounting(weekly, CYCLE, 5)).toEqual([5]);
  });

  it('counts a check-in from earlier in the month for the whole month', () => {
    const cs = [checkIn('m', 3, 10)];
    expect(checkedInFor(monthly, CYCLE, cs, 5)).toBe(true);
    expect(checkedInFor(monthly, CYCLE, cs, 8)).toBe(false);
    expect(checkedInFor(weekly, CYCLE, cs, 5)).toBe(false);
    expect(checkedInFor(monthly, CYCLE, [checkIn('m', 3, 10, { removedAt: '2026-10-01T00:00:00Z' })], 5)).toBe(false);
  });

  it('leaves a monthly goal out of the week until its month’s last week, and counts it done once checked in', () => {
    const s = (cs: ReturnType<typeof checkIn>[]) => snap({ goals: [monthly], checkIns: cs });
    const mid = weekProgress('p', s([]), CYCLE, 5, THU_8_OCT);
    expect(mid.later.map((g) => g.id)).toEqual(['m']);
    expect(mid.goals).toEqual([]);
    expect(mid.due).toEqual([]);
    const last = weekProgress('p', s([]), CYCLE, 7, new Date('2026-10-29T08:00:00Z'));
    expect(last.due.map((g) => g.id)).toEqual(['m']);
    const early = weekProgress('p', s([checkIn('m', 3, 10)]), CYCLE, 5, THU_8_OCT);
    expect(early.done.map((g) => g.id)).toEqual(['m']);
    expect(early.later).toEqual([]);
  });

  it('flags a monthly goal as due only in its month’s last week', () => {
    const flags = (_week: number, today: Date) => flagsFor(monthly, snap({ goals: [monthly], checkIns: [] }), { ...CYCLE }, today).flags.map((f) => f.kind).filter((k) => k === 'due').length;
    expect(flags(5, THU_8_OCT)).toBe(0);
    expect(flags(7, new Date('2026-10-29T08:00:00Z'))).toBe(1);
  });

  it('never reads “No recent update” between monthly check-ins', () => {
    const today = new Date('2026-11-06T12:00:00Z');
    const cs = [checkIn('m', 3, 10)];
    expect(goalStatus(weekly, CYCLE, cs, today).status).toBe('stale');
    expect(goalStatus({ ...monthly }, CYCLE, cs, today).status).toBe('on');
    expect(goalStatus({ ...monthly }, CYCLE, cs, new Date('2026-12-01T12:00:00Z')).status).toBe('stale');
  });

  it('counts the habit and the run only in the month’s last week', () => {
    const due = dueIn(CYCLE, []);
    expect(due(monthly, 5)).toBe(false);
    expect(due(monthly, 7)).toBe(true);
    // A run of months: one check-in each in September, October and November, each before its month's last due day.
    const s = snap({ goals: [monthly], checkIns: [checkIn('m', 1, 5), checkIn('m', 4, 10), checkIn('m', 9, 15)] });
    expect(onTimeStreak('p', s, CYCLE, 12)).toBe(3);
  });

  it('is set by whatever measures the goal, with a History line, and never on a milestone', () => {
    const r = rhythmChange(x, weekly, 'monthly', 'as “Cloud cost” refreshes monthly')!;
    expect(r.goal.checkInRhythm).toBe('monthly');
    expect(r.change.summary).toBe('Checks in monthly, as “Cloud cost” refreshes monthly');
    expect(r.change.diffs).toEqual([{ field: 'Check-in rhythm', from: 'The cycle’s', to: 'Monthly' }]);
    expect(rhythmChange(x, monthly, 'monthly', 'again')).toBeNull();
    expect(rhythmChange(x, monthly, null, 'as the library is switched off')!.change.summary).toBe('Checks in on the cycle’s rhythm again, as the library is switched off');
    const ms = { ...weekly, kind: 'milestone', stages: [] } as unknown as MilestoneGoal;
    expect(rhythmChange(x, ms, 'monthly', 'x')).toBeNull();
    expect(withRhythm(monthly, 'monthly')).toBe(monthly);
  });
});
