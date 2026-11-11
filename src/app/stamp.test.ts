// @vitest-environment node
/* A record's stamp falls on the app's today: moved by whole days only when the demo or the evals pin today. In the
   real app today is the clock's wall-clock time, a time zone's offset away from it, never a day (build review of #154:
   UTC+13 and UTC+14 stamped every record a day ahead). */
import { stampSkewDays } from './state';

const clock = new Date('2026-11-11T21:41:00Z');

describe('stampSkewDays', () => {
  it('moves nothing when today is not pinned, whatever the time zone', () => {
    expect(stampSkewDays(null, clock)).toBe(0);
  });

  it('would have moved a day in UTC+13 and UTC+14 had the offset been counted, and is now 0 there', () => {
    // Auckland in summer and Kiritimati: the wall clock written as UTC is 13 and 14 hours ahead of the clock.
    for (const hours of [13, 14]) {
      const wall = new Date(clock.getTime() + hours * 3_600_000);
      expect(Math.round((wall.getTime() - clock.getTime()) / 86_400_000)).toBe(1);
      expect(stampSkewDays(null, clock)).toBe(0);
    }
  });

  it('moves to a pinned day, keeping the time of day', () => {
    expect(stampSkewDays(new Date('2026-11-05T00:00:00Z'), clock)).toBe(-7);
    expect(stampSkewDays(new Date('2026-11-11T12:00:00Z'), clock)).toBe(0);
  });
});
