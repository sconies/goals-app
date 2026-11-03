/* The name of a goal year. */

/** "2026" for a year starting in January, "Apr 2026–Mar 2027" otherwise. */
export function yearName(startDate: string, weeks: number): string {
  // Week 1's Thursday, which is in the month the year starts.
  const a = new Date(Date.parse(startDate + 'T00:00:00Z') + 10 * 86_400_000);
  const b = new Date(Date.parse(startDate + 'T00:00:00Z') + (weeks * 7 - 4) * 86_400_000);
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  if (a.getUTCMonth() === 0) return String(a.getUTCFullYear());
  return `${m(a)} ${a.getUTCFullYear()}–${m(b)} ${b.getUTCFullYear()}`;
}

