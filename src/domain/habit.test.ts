/* The habit moment (docs/design/round-4/habit/spec.md): the forgiving run (CF4's table, workspace-settings 2.5), the
   receipt's sentences (2.1) and the moment a check-in makes (rule 3). */
import { describe, expect, it } from 'vitest';
import { dueWords, forgivenIn, onTimeStreak, receiptFacts, receiptText, reviewDate, weekProgress, type ReceiptFacts } from './progress';
import { moment, momentText } from './habit';
import { weekDate } from './plan';
import type { CheckIn, Cycle, Goal, Snapshot, Status } from './types';

// Week 46 runs Monday 9 to Sunday 15 November 2026; its review is Thursday 12 November.
const cycle: Cycle = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
const goal = (id: string, createdWeek = 0, extra: Partial<Goal> = {}): Goal => ({
  id, title: id === 'g1' ? 'Deploy lead time' : id, kind: 'metric', ownerId: 'tunde', createdAt: weekDate(cycle, createdWeek) + 'T09:00:00Z',
  unit: 'h', decimals: 0, plan: { start: 40, target: 20, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null, ...extra,
} as unknown as Goal);
let n = 0;
const ci = (goalId: string, week: number, late = false, p: Partial<CheckIn> = {}): CheckIn => ({
  id: `c${++n}`, goalId, authorId: 'tunde', week, postedAt: (late ? new Date(Date.parse(reviewDate(cycle, week)) + 86_400_000).toISOString().slice(0, 10) : reviewDate(cycle, week)) + 'T10:00:00Z',
  value: null, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false, ...p,
});
const snap = (goals: Goal[], checkIns: CheckIn[]): Snapshot => ({ goals, checkIns, people: [], reviews: [], changes: [] } as unknown as Snapshot);
/** Tunde's one goal, checked in each listed week; `late` weeks after the review day. */
const weeks = (from: number, to: number, late: number[] = [], created = 0) => {
  const g = goal('g1', created);
  const cs: CheckIn[] = [];
  for (let w = from; w <= to; w++) cs.push(ci('g1', w, late.includes(w)));
  return snap([g], cs);
};

describe('the forgiving run (CF4, built unconditionally until CF2 adds cycle.streak)', () => {
  it('forgives one late week after four on time, and goes on counting', () => {
    expect(onTimeStreak('tunde', weeks(41, 46, [45], 41), cycle, 46)).toBe(5);
    expect(forgivenIn('tunde', weeks(41, 46, [45], 41).goals, weeks(41, 46, [45], 41).checkIns, cycle, 46)).toBe(45);
  });
  it('ends the run at a late week the four before it don’t cover', () => {
    expect(onTimeStreak('tunde', weeks(41, 46, [44, 45], 41), cycle, 46)).toBe(1);
    // Week 44 on time, 45 late, nothing due before 44: four on-time weeks are needed first.
    expect(onTimeStreak('tunde', weeks(44, 46, [45], 44), cycle, 46)).toBe(1);
    expect(forgivenIn('tunde', weeks(44, 46, [45], 44).goals, weeks(44, 46, [45], 44).checkIns, cycle, 46)).toBe(null);
  });
  it('forgives each late week that has four on-time weeks before it', () => {
    expect(onTimeStreak('tunde', weeks(36, 46, [40, 45], 36), cycle, 46)).toBe(9);
  });
  it('counts every week when all are on time', () => {
    expect(onTimeStreak('tunde', weeks(42, 46, [], 42), cycle, 46)).toBe(5);
    expect(forgivenIn('tunde', weeks(42, 46, [], 42).goals, weeks(42, 46, [], 42).checkIns, cycle, 46)).toBe(null);
  });
  it('treats this week, checked in late, as a late week like any other', () => {
    // Weeks 41–45 on time, 46 late: forgiven, so the run is the five before it.
    expect(onTimeStreak('tunde', weeks(41, 46, [46], 41), cycle, 46)).toBe(5);
  });
});

describe('the receipt (spec 2.1)', () => {
  // The deadline is dueWords' (rule RS1): `review` true for someone in a review held on the due day with Reviews on.
  const r = ({ review = true, ...p }: Partial<ReceiptFacts> & { review?: boolean }): ReceiptFacts => ({ total: 2, after: 0, week: 46, words: dueWords(review, cycle, 46, review), run: 0, forgiven: null, nextDue: 'Thursday 19 Nov', ...p });
  it('says every check-in is in before the review, and the run from two weeks', () => {
    expect(receiptText(r({ total: 1 }))).toEqual({ first: 'Your check-in is in before Thursday’s review.', second: null });
    expect(receiptText(r({ run: 5 }))).toEqual({ first: 'Both of your check-ins are in before Thursday’s review.', second: 'That is 5 weeks in a row.' });
    expect(receiptText(r({ total: 4, run: 1 })).first).toBe('All 4 of your check-ins are in before Thursday’s review.');
  });
  it('says a forgiven week once, on the first receipt after it', () => {
    expect(receiptText(r({ run: 5, forgiven: 45 })).second).toBe('That is 5 weeks in a row. Week 45 came in late; one late week doesn’t break a run.');
    expect(receiptText(r({ week: 47, run: 6, forgiven: 45 })).second).toBe('That is 6 weeks in a row.');
  });
  it('says how many came after, the next due day, and no run', () => {
    expect(receiptText(r({ total: 4, after: 1, run: 5 }))).toEqual({ first: 'All 4 of your check-ins are in. One came after Thursday’s review.', second: 'The next are due by Thursday 19 Nov.' });
    expect(receiptText(r({ total: 1, after: 1 })).first).toBe('Your check-in is in. It came after Thursday’s review.');
    expect(receiptText(r({ total: 3, after: 2 })).first).toBe('All 3 of your check-ins are in. 2 came after Thursday’s review.');
  });
  it('says the deadline, not a review, to someone in no review that day (deep review T4), in dueWords’ words', () => {
    expect(receiptText(r({ review: false })).first).toBe('Both of your check-ins are in by Thursday.');
    expect(receiptText(r({ review: false, total: 1, after: 1 })).first).toBe('Your check-in is in. It came after Thursday.');
  });
  it('with Reviews off, says “by Thursday” and “after Thursday” even where a review is held (Reviews switch spec 2.1)', () => {
    const off = (p: Partial<ReceiptFacts>) => receiptText({ ...r({}), words: dueWords(false, cycle, 46, true), ...p });
    expect(off({ total: 7, run: 3 })).toEqual({ first: 'All 7 of your check-ins are in by Thursday.', second: 'That is 3 weeks in a row.' });
    expect(off({ total: 7, after: 2 })).toEqual({ first: 'All 7 of your check-ins are in. 2 came after Thursday.', second: 'The next are due by Thursday 19 Nov.' });
    for (const p of [{ total: 7 }, { total: 7, after: 2 }, { total: 1, after: 1 }, { run: 5, forgiven: 45 }]) {
      const t = off(p);
      expect(`${t.first} ${t.second ?? ''}`).not.toMatch(/review/i);
    }
  });
  it('with Reviews on, names the review as in spec 2.1', () => {
    expect(receiptText(r({ total: 7 })).first).toBe('All 7 of your check-ins are in before Thursday’s review.');
    expect(receiptText(r({ total: 7, after: 2 })).first).toBe('All 7 of your check-ins are in. 2 came after Thursday’s review.');
  });
  it('never says a run was lost or broken', () => {
    for (const p of [{ after: 1, run: 0 }, { after: 2, run: 9 }, { run: 0 }, { run: 7, forgiven: 45 }]) {
      const t = receiptText(r(p));
      expect(`${t.first} ${t.second ?? ''}`).not.toMatch(/lost|broken|!|\b0\b/);
    }
  });
  it('reads its facts from the week (receiptFacts)', () => {
    const s = weeks(41, 46, [46], 41);
    const f = receiptFacts(weekProgress('tunde', s, cycle, 46, new Date('2026-11-13T12:00:00Z')), 'tunde', s, cycle, 46, dueWords(true, cycle, 46, true));
    expect(f).toMatchObject({ total: 1, after: 1, week: 46, words: { by: 'before Thursday’s review', after: 'after Thursday’s review' }, run: 5, nextDue: '2026-11-19' });
  });
});

describe('the moment (rule 3)', () => {
  const g = goal('g1');
  const at = (week: number, value: number, status: Status = 'on', p: Partial<CheckIn> = {}) => ci('g1', week, false, { value, status, ...p });
  it('is reached when the value meets the target and the week before did not', () => {
    expect(moment([at(44, 25), at(45, 22)], at(46, 20), g)).toEqual({ kind: 'reached', behind: 0 });
    expect(moment([at(45, 20)], at(46, 19), g)).toBeNull();
    // Its first check-in, at target.
    expect(moment([], at(46, 18), g)?.kind).toBe('reached');
  });
  it('is back when on track after two weeks or more behind', () => {
    expect(moment([at(43, 30), at(44, 34, 'risk'), at(45, 35, 'off')], at(46, 28), g)).toEqual({ kind: 'back', behind: 2 });
    expect(moment([at(44, 30), at(45, 35, 'risk')], at(46, 28), g)).toBeNull();
  });
  it('reached wins over back', () => {
    expect(moment([at(44, 34, 'risk'), at(45, 35, 'off')], at(46, 20), g)?.kind).toBe('reached');
  });
  it('never fires on a backfilled week or a correction', () => {
    expect(moment([at(45, 22)], at(46, 20, 'on', { backfilled: true }), g)).toBeNull();
    expect(moment([at(45, 22)], at(46, 20), g, false)).toBeNull();
  });
  it('is said in the receipt’s words', () => {
    expect(momentText({ kind: 'reached', behind: 0 }, g, at(46, 20), 53)).toEqual({ heading: 'Deploy lead time reached its target', line: '20 h, against a target of 20 h, in week 46 of 53. It started the year at 40 h.' });
    expect(momentText({ kind: 'back', behind: 3 }, g, at(46, 28), 53).heading).toBe('Deploy lead time is back on track');
  });
});
