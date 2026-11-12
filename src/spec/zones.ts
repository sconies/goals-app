/**
 * The home zone (R3; backlog KT, gap 8). Faro counts weeks and days in UTC; the
 * internal app counts them in the workspace's home zone. These are the
 * reference: take the home zone's wall clock at a real moment, dressed up as
 * UTC, and hand it to the same rules (`currentWeek`, `daysSince`). With the
 * home zone UTC they give exactly what Faro gives. `zone.csv` scores a rebuild
 * on a small case in America/New_York: check-ins near midnight and the night
 * the clocks go back.
 */
import { currentWeek, daysSince } from '../domain/plan';
import { RULES } from '../domain/thresholds';
import type { Cycle } from '../domain/types';

/** The wall clock in `zone` at the real moment `at`, as a Date whose UTC fields read that clock. */
export function wallClock(at: Date, zone: string): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at).map((p) => [p.type, p.value]));
  return new Date(Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!, at.getUTCMilliseconds()));
}

/** "yyyy-mm-dd hh:mm" on the wall clock in `zone` at `iso`. */
export const homeTime = (iso: string, zone: string) => wallClock(new Date(iso), zone).toISOString().slice(0, 16).replace('T', ' ');

/** The real moment a wall-clock time (`yyyy-mm-ddThh:mm`) names in `zone`; the earlier one when the clocks go back. */
export function momentOf(local: string, zone: string): Date {
  const want = Date.parse(local + ':00Z');
  let t = want;
  for (let i = 0; i < 3; i++) t += want - wallClock(new Date(t), zone).getTime();
  // Of the two moments an hour apart that read the same, take the earlier.
  const before = new Date(t - 3_600_000);
  return wallClock(before, zone).getTime() === want ? before : new Date(t);
}

/** The cycle's week at a moment, counted in the home zone. */
export const weekIn = (cycle: Cycle, at: Date, zone: string) => currentWeek(cycle, wallClock(at, zone));

/** Calendar days from a posting to a moment, both read in the home zone. */
export const daysSinceIn = (postedAt: string, at: Date, zone: string) => daysSince(wallClock(new Date(postedAt), zone).toISOString(), wallClock(at, zone));

/* ---------- zone.csv ---------- */

export interface ZoneCase {
  /** What it is, in words. */
  about: string;
  /** The workspace's home zone, an IANA name. */
  homeZone: string;
  cycle: Cycle;
  /** Each goal's check-ins: only when they were posted matters here. */
  checkIns: { id: string; goalId: string; postedAt: string }[];
  /** The moments each goal is judged at. */
  moments: string[];
}

const NY = 'America/New_York';
const at = (local: string) => momentOf(local, NY).toISOString();

export const ZONE_CASE: ZoneCase = {
  about: 'R3, the home zone: a workspace in America/New_York, a goal year starting Monday 19 October 2026, and check-ins posted near midnight there, either side of the night its clocks go back (Sunday 1 November, 02:00 to 01:00). Every week and day is counted in the home zone. See spec/conformance/README.md, zone.csv.',
  homeZone: NY,
  cycle: { id: 'zone-year', name: '2026–27', startDate: '2026-10-19', weeks: 53, reviewDay: 3 },
  checkIns: [
    { id: 'z1', goalId: 'g-late', postedAt: at('2026-10-25T23:30') },
    { id: 'z2', goalId: 'g-late', postedAt: at('2026-11-01T23:30') },
    { id: 'z3', goalId: 'g-late', postedAt: at('2026-11-02T00:30') },
    { id: 'z4', goalId: 'g-quiet', postedAt: at('2026-10-19T00:30') },
  ],
  moments: [
    at('2026-10-25T23:30'), at('2026-10-26T00:00'),
    at('2026-11-01T01:30'), new Date(Date.parse(at('2026-11-01T01:30')) + 3_600_000).toISOString(),
    at('2026-11-01T23:30'), at('2026-11-01T23:59'), at('2026-11-02T00:00'), at('2026-11-02T00:30'),
    at('2026-11-02T23:59'), at('2026-11-03T00:00'),
  ],
};

export const ZONE_HEADER = ['moment', 'goal', 'home_time', 'week', 'latest_posted', 'days_without_update', 'stale'];

/** One row per moment and goal: the home zone's clock, the week, and days since the goal's latest check-in posted by then. */
export function zoneRowsOf(z: ZoneCase | undefined): string[][] {
  if (!z) return [];
  const goals = [...new Set(z.checkIns.map((c) => c.goalId))].sort();
  const rows: string[][] = [];
  for (const m of [...z.moments].sort()) for (const g of goals) {
    const latest = z.checkIns.filter((c) => c.goalId === g && c.postedAt <= m).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).pop();
    const days = latest ? daysSinceIn(latest.postedAt, new Date(m), z.homeZone) : null;
    rows.push([m, g, homeTime(m, z.homeZone), String(weekIn(z.cycle, new Date(m), z.homeZone)), latest?.postedAt ?? '', days == null ? '' : String(days), days != null && days >= RULES.staleDays ? 'yes' : 'no']);
  }
  return rows;
}
