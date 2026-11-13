// @vitest-environment node
/* Rule RS1 (docs/design/round-4/reviews-switch/spec.md 4): one phrase for the clock, dueWords. The table's three rows,
   the due flag's sentence, and the receipt that says it. */
import { dueWords, dueWordsOn, weekDoneText, type WeekProgress } from './progress';
import { heldOnDueDay } from './review';
import type { Cycle, Goal, Review } from './types';

// Week 46 of 2026 is 9–15 Nov; check-ins are due on Thursday 12 Nov.
const cycle: Cycle = { id: 'c', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
const review = (o: Partial<Review> = {}): Review => ({ id: 'r', name: 'Weekly', everyWeeks: 1, weekday: 3, scope: { goals: [], trees: [], levels: [] }, people: [], createdBy: 'a', createdAt: '2026-01-01T09:00:00Z', ...o });

describe('dueWords (RS1)', () => {
  it('Reviews on, a review on the due day: “before Thursday’s review”', () => {
    const held = heldOnDueDay([review()], cycle, 46);
    expect(held).toBe(true);
    const w = dueWords(true, cycle, 46, held);
    expect([w.by, w.after, w.onTime]).toEqual(['before Thursday’s review', 'after Thursday’s review', 'before the review']);
  });

  it('Reviews on, no review set up (or none on the due day): “by Thursday”', () => {
    expect(dueWords(true, cycle, 46, heldOnDueDay([], cycle, 46)).by).toBe('by Thursday');
    // A review on Tuesday, one ended, one removed, a four-weekly one not held this week and one set up after the due day are not on the due day.
    const none = [review({ weekday: 1 }), review({ endedAt: '2026-11-01' }), review({ removedAt: '2026-11-01' }), review({ everyWeeks: 4 }), review({ createdAt: '2026-11-13T09:00:00Z' })];
    expect(heldOnDueDay(none, cycle, 46)).toBe(false);
    expect(dueWords(true, cycle, 46, false).by).toBe('by Thursday');
  });

  it('Reviews off: “by Thursday”, whatever is held', () => {
    const w = dueWords(false, cycle, 46, true);
    expect([w.by, w.after, w.onTime, w.day, w.date]).toEqual(['by Thursday', 'after Thursday', 'on time', 'Thursday', 'Thursday 12 Nov']);
  });

  it('the due flag says “Due by Thu 12 Nov.” with Reviews on or off', () => {
    expect(dueWords(true, cycle, 46, true).flag).toBe('Due by Thu 12 Nov.');
    expect(dueWords(false, cycle, 46).flag).toBe('Due by Thu 12 Nov.');
    expect(dueWordsOn(false, '2026-11-12').flag).toBe(dueWords(false, cycle, 46).flag);
  });

  it('the receipt says the deadline in its words: “by Thursday”, or “after Thursday” once it has passed', () => {
    const g = { id: 'g', title: 'G' } as Goal;
    const p: WeekProgress = { goals: [g, g, g], done: [g, g, g], due: [], upcoming: [] };
    expect(weekDoneText(p, 46, { late: false, words: dueWords(false, cycle, 46) })).toBe('All 3 of your goals are checked in for week 46, by Thursday.');
    expect(weekDoneText(p, 46, { late: true, words: dueWords(false, cycle, 46) })).toBe('All 3 of your goals are checked in for week 46, after Thursday.');
    expect(weekDoneText(p, 46, { late: false, words: dueWords(true, cycle, 46, true) })).toBe('All 3 of your goals are checked in for week 46, before Thursday’s review.');
  });
});
