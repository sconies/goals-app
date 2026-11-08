/* Set up part way through a week (setup review, 8 Nov): the first check-in and a review's first session are never
   already past. The rule is plan.firstWeekFrom; progress.firstDueWeek and review.sessionWeek use it. */
import { firstWeekFrom } from './plan';
import { firstDueWeek, firstReview, onTimeStreak, weekProgress } from './progress';
import { reviewSession, sessionWeek } from './review';
import { buildWorkspace, DEFAULT_VIEWS, GOALS_TEMPLATE, PEOPLE_TEMPLATE, WEEKLY_REVIEW } from './importer';
import { attentionFor } from './attention';
import type { Cycle } from './types';

// The year Voss Test Workspace joined: week 0 from Monday 22 December 2025, reviews on Thursdays.
const YEAR: Cycle = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };

describe('first week', () => {
  it('is the week it was set up in, up to and including the review day, and the next week after it', () => {
    // Week 45 runs Monday 2 to Sunday 8 November; its review is Thursday 5 November.
    expect(firstWeekFrom(YEAR, '2026-11-02T09:00:00Z', 3)).toBe(45);
    expect(firstWeekFrom(YEAR, '2026-11-05T17:00:00Z', 3)).toBe(45);
    expect(firstWeekFrom(YEAR, '2026-11-06T09:00:00Z', 3)).toBe(46);
    expect(firstWeekFrom(YEAR, '2026-11-08T10:12:00Z', 3)).toBe(46);
  });

  it('is week 1 for anything set up before the year starts, or with no date', () => {
    expect(firstWeekFrom(YEAR, '2025-12-01T00:00:00Z', 3)).toBe(1);
    expect(firstWeekFrom(YEAR, '2025-12-24T00:00:00Z', 3)).toBe(1);
    expect(firstWeekFrom(YEAR, undefined, 3)).toBe(1);
  });

  it('starts a workspace made on a Sunday with nothing due, nothing late and its first review in the future', () => {
    const now = new Date('2026-11-08T10:12:00Z');
    const { snapshot: s, issues } = buildWorkspace({ name: 'Voss Test Workspace', startDate: YEAR.startDate, reviewDay: 3, people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now, idSuffix: 'voss' });
    expect(issues).toEqual([]);
    const cycle = s.cycles[0]!;
    const me = s.people[0]!.id;
    const p = weekProgress(me, s, cycle, 45, now);
    expect(p.due).toEqual([]);
    expect(p.upcoming.length).toBe(p.goals.length);
    expect(s.goals.every((g) => firstDueWeek(g, cycle) === 46)).toBe(true);
    expect(firstReview(cycle, now)).toEqual({ week: 46, date: '2026-11-12' });
    // No goal is flagged as due this week.
    expect(s.goals.some((g) => attentionFor(g, s, cycle, now).flags.some((f) => f.kind === 'due'))).toBe(false);
    // The weekly review it promises: everyone, every level, on the review day, first held next Thursday.
    const review = s.reviews.find((r) => r.name === WEEKLY_REVIEW)!;
    expect(review.people).toEqual(s.people.map((x) => x.id));
    expect(review.scope.levels).toEqual(['north-star', 'svp', 'team']);
    expect(sessionWeek(review, 45, cycle)).toBe(46);
    expect(reviewSession(review, s, cycle, now, 45).date).toBe('2026-11-12');
    expect(reviewSession(review, s, cycle, now, 45).total).toBe(s.goals.length);
    // And the pinned views.
    expect(s.views!.map((v) => [v.name, v.params, v.pinned])).toEqual(DEFAULT_VIEWS.map(([n, q]) => [n, q, true]));
    expect(onTimeStreak(me, s, cycle, 45)).toBe(0);
  });

  it('leaves a review set up before its day this week in this week', () => {
    const r = { id: 'r', name: 'R', everyWeeks: 1, weekday: 3, scope: { goals: [], trees: [], levels: [] }, people: [], createdBy: 'p', createdAt: '2026-11-03T09:00:00Z' };
    expect(sessionWeek(r, 45, YEAR)).toBe(45);
    expect(sessionWeek(r, 47, YEAR)).toBe(47);
  });
});
