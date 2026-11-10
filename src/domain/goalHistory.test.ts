// @vitest-environment node
/* A goal's history shows its gaps (goal spec, rule 4; GT2): every week, checked in or not, with four filters and counts. */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from './cycle';
import { goalHistory, historyKind, type HistoryEntry } from './goalPage';
import { currentWeek } from './plan';
import { checkInsFor } from './status';
import type { CheckIn, Goal } from './types';

const today = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle);
const week = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;
const input = (g: Goal, checkIns: CheckIn[] = s.checkIns, w = week) => ({ goal: g, checkIns, changes: s.changes.filter((c) => c.goalId === g.id), cycle, week: w, reviews: s.reviews });
const label = (x: HistoryEntry) => (x.kind === 'missed' ? (x.from === x.to ? `Week ${x.from} · ${x.yet ? 'No check-in yet' : 'No check-in'}` : `Weeks ${x.from} to ${x.to} · No check-ins (${x.weeks} weeks)`) : x.kind === 'checkin' ? `Week ${x.checkIn.week}` : x.kind === 'checkins' ? `Weeks ${x.from}–${x.to}` : x.kind);

describe('a goal’s history (rule 4)', () => {
  it('a goal gone quiet lists the weeks it missed, newest first, then its last check-in', () => {
    const g = goal('devsat-onboard');
    const lastWeek = checkInsFor(g, s.checkIns).at(-1)!.week;
    const h = goalHistory(input(g), 'checkins');
    const first = h.entries.slice(0, week - lastWeek + 1).map(label);
    expect(first[0]).toBe(`Week ${week} · No check-in`);
    expect(first.at(-1)).toMatch(new RegExp(`^Weeks? .*${lastWeek}`));
  });

  it('Changes holds only edits; Reviews only what reviews said; the counts add up to All', () => {
    const h = goalHistory(input(goal('ns-lead')));
    expect(goalHistory(input(goal('ns-lead')), 'changes').entries.every((x) => x.kind === 'change' && x.change.entity !== 'decision')).toBe(true);
    expect(goalHistory(input(goal('ns-lead')), 'reviews').entries.length).toBeGreaterThan(0);
    expect(goalHistory(input(goal('ns-lead')), 'reviews').entries.every((x) => historyKind(x, s.reviews) === 'reviews')).toBe(true);
    expect(h.counts.all).toBe(h.counts.checkins + h.counts.comments + h.counts.reviews + h.counts.changes);
  });

  it('a goal checked in every week has a week entry for each, none missed', () => {
    const g = { ...goal('ns-lead'), createdAt: '2026-01-01T00:00:00Z' };
    const ci = (w: number) => ({ ...checkInsFor(g, s.checkIns).at(-1)!, id: 'c' + w, week: w, why: `Week ${w} was fine` });
    const checkIns = Array.from({ length: 7 }, (_, k) => ci(40 + k));
    const h = goalHistory({ ...input(g, checkIns, 46), changes: [] }, 'checkins');
    expect(h.entries.filter((x) => x.kind === 'missed' && x.from >= 40)).toEqual([]);
  });

  it('six quiet weeks are one entry, counted as six; this week stays its own', () => {
    const g = { ...goal('ns-lead'), createdAt: '2026-01-01T00:00:00Z' };
    const base = checkInsFor(g, s.checkIns).at(-1)!;
    const checkIns = [11, 18, 19].map((w) => ({ ...base, id: 'c' + w, week: w, why: `w${w}` }));
    const h = goalHistory({ ...input(g, checkIns, 20), changes: [] }, 'checkins');
    expect(h.entries.map(label)).toContain('Weeks 12 to 17 · No check-ins (6 weeks)');
    expect(h.entries.map(label)[0]).toBe('Week 20 · No check-in');
    expect(h.counts.checkins).toBe(20);
  });

  it('a goal with no check-in yet has one week entry: this week', () => {
    const g = { ...goal('ns-lead'), id: 'fresh', createdAt: new Date(today.getTime() - 86_400_000).toISOString() };
    const h = goalHistory({ ...input(g, []), changes: [] }, 'checkins');
    expect(h.entries.map(label)).toEqual([`Week ${week} · No check-in yet`]);
  });

  it('a search keeps the entries whose words match', () => {
    const h = goalHistory(input(goal('ns-lead')), 'all', 'merge queue');
    expect(h.entries.length).toBeGreaterThan(0);
    expect(goalHistory(input(goal('ns-lead')), 'all', 'zzzz').entries).toEqual([]);
  });
});
