/* The name of a goal year. */

/** "2026" for a year starting in January, "Apr 2026–Mar 2027" otherwise. */
export function yearName(startDate: string, weeks: number): string {
  const a = new Date(Date.parse(startDate + 'T00:00:00Z') + 3 * 86_400_000);
  const b = new Date(Date.parse(startDate + 'T00:00:00Z') + (weeks * 7 - 4) * 86_400_000);
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  if (a.getUTCMonth() === 0 || (a.getUTCMonth() === 11 && a.getUTCDate() >= 25)) return String(a.getUTCMonth() === 11 ? a.getUTCFullYear() + 1 : a.getUTCFullYear());
  return `${m(a)} ${a.getUTCFullYear()}–${m(b)} ${b.getUTCFullYear()}`;
}

