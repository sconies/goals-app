/* The home zone's reference (R3; kit review, gap 8). */
import { describe, expect, it } from 'vitest';
import { currentWeek, daysSince } from '../domain/plan';
import { daysSinceIn, homeTime, momentOf, wallClock, weekIn, ZONE_CASE, zoneRowsOf } from './zones';

describe('the home zone', () => {
  it('reads a moment on the home zone’s clock, summer and winter time alike', () => {
    expect(homeTime('2026-10-26T03:30:00Z', 'America/New_York')).toBe('2026-10-25 23:30');
    expect(homeTime('2026-11-02T04:30:00Z', 'America/New_York')).toBe('2026-11-01 23:30');
    expect(wallClock(new Date('2026-09-14T03:30:00Z'), 'UTC').toISOString()).toBe('2026-09-14T03:30:00.000Z');
  });

  it('takes the earlier of the two moments a clock reads when it goes back', () => {
    expect(momentOf('2026-11-01T01:30', 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(momentOf('2026-10-22T14:00', 'Europe/London').toISOString()).toBe('2026-10-22T13:00:00.000Z');
    expect(momentOf('2026-10-29T14:00', 'Europe/London').toISOString()).toBe('2026-10-29T14:00:00.000Z');
  });

  it('gives exactly what Faro gives with the home zone UTC', () => {
    for (const c of ZONE_CASE.checkIns) for (const m of ZONE_CASE.moments) {
      expect(weekIn(ZONE_CASE.cycle, new Date(m), 'UTC')).toBe(currentWeek(ZONE_CASE.cycle, new Date(m)));
      expect(daysSinceIn(c.postedAt, new Date(m), 'UTC')).toBe(daysSince(c.postedAt, new Date(m)));
    }
  });

  it('turns the week at midnight on Sunday in the home zone, and goes stale by its days', () => {
    const rows = zoneRowsOf(ZONE_CASE).map(([m, g, , week, , days, stale]) => `${m} ${g} ${week} ${days} ${stale}`);
    expect(rows).toContain('2026-11-02T04:59:00.000Z g-late 1 0 no');
    expect(rows).toContain('2026-11-02T05:00:00.000Z g-late 2 1 no');
    expect(rows).toContain('2026-11-02T04:59:00.000Z g-quiet 1 13 no');
    expect(rows).toContain('2026-11-02T05:00:00.000Z g-quiet 2 14 yes');
  });
});
