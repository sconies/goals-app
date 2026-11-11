/* A year ends on its last day (cycle-end spec, CY1: rules 1 and 2). The example year is the demo's: 2026 starts on
   22 Dec 2025 (week 0) and has 53 weeks, so week 53 is 28 Dec 2026–3 Jan 2027. */
import { describe, expect, it } from 'vitest';
import { cycleDates, cycleState, placeLine, wrapUpCycle, wrapUpOpen, wrapUpOpenOn } from './cycle';
import { currentWeek, hasEnded, resultWeek } from './plan';
import { goalStatus } from './status';
import { goalResult } from './story';
import { quarterResults } from './year';
import { weekProgress } from './progress';
import type { CheckIn, Cycle, Goal, Snapshot } from './types';

const y2026: Cycle = { id: 'c26', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
const y2027: Cycle = { id: 'c27', name: '2027', startDate: '2026-12-28', weeks: 52, reviewDay: 3 };
const on = (iso: string) => new Date(iso + 'T12:00:00Z');

describe('a cycle’s dates and state (rule 1)', () => {
  it('gives the real first and last days, and when the wrap-up opens and closes', () => {
    expect(cycleDates(y2026)).toEqual({ firstDay: '2025-12-29', lastDay: '2027-01-03', wrapUpOpens: '2026-12-21', wrapUpCloses: '2027-01-31' });
    expect(cycleDates(y2027)).toEqual({ firstDay: '2027-01-04', lastDay: '2028-01-02', wrapUpOpens: '2027-12-20', wrapUpCloses: '2028-01-30' });
    expect(cycleDates({ startDate: '2026-09-28', weeks: 13 })).toMatchObject({ firstDay: '2026-10-05', lastDay: '2027-01-03', wrapUpOpens: '2026-12-21' });
  });
  it('is before, running, ending, ended and closed by the calendar', () => {
    expect(cycleState(y2026, on('2025-12-23'))).toBe('before');
    expect(cycleState(y2026, on('2026-12-20'))).toBe('running');
    expect(cycleState(y2026, on('2026-12-21'))).toBe('ending');
    expect(cycleState(y2026, on('2027-01-03'))).toBe('ending');
    expect(cycleState(y2026, on('2027-01-04'))).toBe('ended');
    expect(cycleState(y2026, on('2027-01-31'))).toBe('ended');
    expect(cycleState(y2026, on('2027-02-01'))).toBe('closed');
  });
  it('opens the wrap-up for six weeks around the end, and agrees with the week it opens', () => {
    expect(wrapUpOpenOn(y2026, on('2026-12-20'))).toBe(false);
    expect(wrapUpOpenOn(y2026, on('2026-12-21'))).toBe(true);
    expect(wrapUpOpenOn(y2026, on('2027-01-31'))).toBe(true);
    expect(wrapUpOpenOn(y2026, on('2027-02-01'))).toBe(false);
    expect(wrapUpOpen(y2026, 51)).toBe(false);
    expect(wrapUpOpen(y2026, 52)).toBe(true);
    expect(currentWeek(y2026, on('2026-12-21'))).toBe(52);
    expect(wrapUpCycle([y2026, y2027], on('2027-01-11'))?.id).toBe('c26');
    expect(wrapUpCycle([y2026, y2027], on('2026-11-11'))).toBeUndefined();
  });
  it('says where the year stands in the frame', () => {
    expect(placeLine(y2026, on('2026-12-20'))).toBe('2026 · week 51 · Q4');
    expect(placeLine(y2026, on('2026-12-21'))).toBe('2026 · week 52 · Q4');
    expect(placeLine(y2026, on('2026-12-28'))).toBe('2026 · week 53, the last week');
    expect(placeLine(y2026, on('2027-01-04'))).toBe('2026 has ended');
    expect(placeLine(y2027, on('2026-12-21'))).toBe('2027 starts Mon 4 Jan 2027');
    expect(placeLine({ ...y2026, name: 'Platform cycle', startDate: '2026-09-28', weeks: 13 }, on('2026-11-11'))).toBe('Platform cycle · week 6 of 13');
  });
});

describe('the week results are judged at (rule 2)', () => {
  // G-37: 4 → 40 pairs, due week 53; 33 pairs in week 53.
  const g: Goal = { id: 'g37', key: 'G-37', cycleId: 'c26', title: 'Pairs', ownerId: 'tunde', teamId: 't', level: 'team', kind: 'metric', unit: 'pairs', decimals: 0, plan: { start: 4, target: 40, shape: 'straight' }, parentId: null } as unknown as Goal;
  const ci = (week: number, value: number, postedAt: string): CheckIn => ({ id: 'ci' + week, goalId: 'g37', week, value, status: 'risk', calculated: 'risk', postedAt, authorId: 'tunde' } as unknown as CheckIn);
  const checkIns = [ci(46, 30, '2026-11-11T10:00:00Z'), ci(53, 33, '2026-12-29T10:00:00Z')];

  it('is the last week until the last day, then the week after', () => {
    expect([currentWeek(y2026, on('2027-01-03')), resultWeek(y2026, on('2027-01-03'))]).toEqual([53, 53]);
    expect([currentWeek(y2026, on('2027-01-04')), resultWeek(y2026, on('2027-01-04'))]).toEqual([53, 54]);
    expect(resultWeek(y2026, on('2027-06-01'))).toBe(54);
    expect(resultWeek(y2026, on('2025-12-01'))).toBe(0);
    expect(hasEnded(y2026, on('2027-01-03'))).toBe(false);
    expect(hasEnded(y2026, on('2027-01-04'))).toBe(true);
  });
  it('gives a goal due in the last week its result, and closes Q4, on the first day after', () => {
    expect(goalResult(g, y2026, [checkIns[0]!], resultWeek(y2026, on('2027-01-03')))).toBeNull();
    expect(goalResult(g, y2026, checkIns, resultWeek(y2026, on('2027-01-04')))?.kind).toBe('missed');
    const q4 = (d: string) => quarterResults(g, y2026, checkIns, resultWeek(y2026, on(d)))[3]!;
    expect(q4('2027-01-03').kind).toBe('open');
    expect(q4('2027-01-04').kind).toBe('missed');
    expect(q4('2027-01-04').text).toBe('Q4: 33 pairs against a plan of 40 pairs, 7 pairs short');
  });
  it('lets nothing go out of date, or be due, after the end', () => {
    const quiet = [ci(46, 30, '2026-11-11T10:00:00Z')];
    expect(goalStatus(g, y2026, quiet, on('2027-01-03')).status).toBe('stale');
    expect(goalStatus(g, y2026, quiet, on('2027-01-11')).status).toBe('risk');
    const s = { goals: [g], checkIns: quiet } as unknown as Snapshot;
    expect(weekProgress('tunde', s, y2026, 53, on('2027-01-03')).due.map((x) => x.id)).toEqual(['g37']);
    expect(weekProgress('tunde', s, y2026, 53, on('2027-01-11')).due).toEqual([]);
  });
});
