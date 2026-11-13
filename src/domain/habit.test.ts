/* The habit moment (docs/design/round-4/habit/spec.md): the forgiving run (CF4's table, workspace-settings 2.5), the
   receipt's sentences (2.1) and the moment a check-in makes (rule 3). */
import { describe, expect, it } from 'vitest';
import { forgivenIn, inByDueDay, onTimeStreak, receiptFacts, receiptText, reviewDate, reviewOnDueDay, weekProgress, type ReceiptFacts } from './progress';
import { beforeReviewText, checkInStanding, habit, type HabitRows, habitShown, habitWeeks, moment, momentText, weekWords } from './habit';
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
  const r = (p: Partial<ReceiptFacts>): ReceiptFacts => ({ total: 2, after: 0, week: 46, dueDay: 'Thursday', review: true, run: 0, forgiven: null, nextDue: 'Thursday 19 Nov', ...p });
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
  it('says the deadline, not a review, to someone in no review that day (deep review T4)', () => {
    expect(receiptText(r({ review: false })).first).toBe('Both of your check-ins are in for week 46, before Thursday’s deadline.');
    expect(receiptText(r({ review: false, total: 1, after: 1 })).first).toBe('Your check-in is in. It came in after Thursday’s deadline.');
  });
  it('never says a run was lost or broken', () => {
    for (const p of [{ after: 1, run: 0 }, { after: 2, run: 9 }, { run: 0 }, { run: 7, forgiven: 45 }]) {
      const t = receiptText(r(p));
      expect(`${t.first} ${t.second ?? ''}`).not.toMatch(/lost|broken|!|\b0\b/);
    }
  });
  it('reads its facts from the week (receiptFacts)', () => {
    const s = weeks(41, 46, [46], 41);
    const f = receiptFacts(weekProgress('tunde', s, cycle, 46, new Date('2026-11-13T12:00:00Z')), 'tunde', s, cycle, 46, true);
    expect(f).toMatchObject({ total: 1, after: 1, week: 46, dueDay: 'Thursday', review: true, run: 5, nextDue: '2026-11-19' });
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

describe('a check-in’s standing (rule 1)', () => {
  const g = goal('g1');
  const ask = (createdAt: string, answeredAt: string | null, kind: 'update' | 'question' = 'update'): HabitRows['asks'][number] => ({ kind, goalIds: ['g1'], createdAt, answeredAt, status: answeredAt ? 'answered' : 'open', updatedAt: answeredAt ?? createdAt });
  const at = (day: string) => ci('g1', 46, false, { postedAt: `${day}T18:00:00Z` });
  const due = '2026-11-12';
  const st = (checkIns: CheckIn[], asks: ReturnType<typeof ask>[] = []) => checkInStanding(g, 46, { checkIns, asks }, due);
  it('reads the spec’s table', () => {
    expect(st([at('2026-11-10')])).toBe('unasked');
    expect(st([at('2026-11-11')], [ask('2026-11-11T09:00:00Z', '2026-11-11T18:00:00Z')])).toBe('asked');
    expect(st([at('2026-11-11')], [ask('2026-11-10T09:00:00Z', '2026-11-12T09:00:00Z', 'question')])).toBe('unasked');
    expect(st([at('2026-11-10')], [ask('2026-11-03T09:00:00Z', '2026-11-04T09:00:00Z')])).toBe('unasked');
    expect(st([at('2026-11-13')])).toBe('after');
    expect(st([])).toBe('none');
    // Checked in Tuesday, corrected Friday: the first check-in's time stands.
    expect(st([at('2026-11-10'), at('2026-11-13')])).toBe('unasked');
  });
});

describe('the measure (rule 2) and never a person (rule 4)', () => {
  const owners = ['a', 'b', 'c', 'd'];
  const set = (n: number) => Array.from({ length: n }, (_, i) => goal(`g${i}`, 0, { ownerId: owners[i % 4] } as Partial<Goal>));
  const rows = (goals: Goal[], standing: ('unasked' | 'asked' | 'after' | 'none')[]) => {
    const checkIns: CheckIn[] = [], asks: { kind: 'update'; goalIds: string[]; createdAt: string; answeredAt: string; status: 'answered'; updatedAt: string }[] = [];
    goals.forEach((g, i) => {
      const s = standing[i]!;
      if (s === 'none') return;
      checkIns.push(ci(g.id, 46, s === 'after', { postedAt: s === 'after' ? '2026-11-13T10:00:00Z' : '2026-11-11T10:00:00Z' }));
      if (s === 'asked') asks.push({ kind: 'update', goalIds: [g.id], createdAt: '2026-11-10T10:00:00Z', answeredAt: '2026-11-11T10:00:00Z', status: 'answered', updatedAt: '2026-11-11T10:00:00Z' });
    });
    return { checkIns, asks };
  };
  const due = () => true;
  it('counts the spec’s 17 goals', () => {
    const goals = set(17);
    const h = habit(goals, 46, rows(goals, [...Array(14).fill('unasked'), 'asked', 'none', 'none']), '2026-11-12', due);
    expect([h.due, h.inTime, h.unasked, h.asked, h.after, h.none]).toEqual([17, 15, 14, 1, 0, 2]);
    expect(beforeReviewText(h, true)).toBe('15 of 17 goals were checked in before it, 14 without being asked.');
    expect(beforeReviewText(h, false)).toBe('15 of 17 goals are checked in so far.');
    const all = habit(goals, 46, rows(goals, Array(17).fill('unasked')), '2026-11-12', due);
    expect(beforeReviewText(all, true)).toBe('All 17 goals were checked in before it, without anyone asking.');
    const some = habit(goals, 46, rows(goals, [...Array(10).fill('unasked'), ...Array(7).fill('none')]), '2026-11-12', due);
    expect(beforeReviewText(some, true)).toBe('10 of 17 goals were checked in before it, all without being asked.');
    // Reviews switched off: the due day is a deadline (RS1's words).
    expect(beforeReviewText(all, true, false)).toBe('All 17 goals were checked in on time, without anyone asking.');
  });
  it('gives the row of weeks with words', () => {
    const goals = set(4);
    const r = rows(goals, ['unasked', 'after', 'none', 'asked']);
    const weeks = habitWeeks(goals, 46, r, () => '2026-11-12', (_g, w) => w === 46, 3);
    expect(weeks.map((w) => `${w.week} ${weekWords(w)}`)).toEqual(['44 Nothing due', '45 Nothing due', '46 2 after']);
    expect(habitWeeks(goals, 46, rows(goals, Array(4).fill('unasked')), () => '2026-11-12', due, 1).map(weekWords)).toEqual(['All in']);
    expect(habitWeeks(goals, 46, rows(goals, Array(4).fill('none')), () => '2026-11-12', due, 1).map(weekWords)).toEqual(['None in']);
  });
  it('is never shown for fewer than three owners, unless the viewer owns them all', () => {
    expect(habitShown(set(4), 'z')).toBe(true);
    expect(habitShown(set(2), 'z')).toBe(false);
    expect(habitShown([goal('g1'), goal('g2')], 'tunde')).toBe(true);
    expect(habitShown([], 'tunde')).toBe(false);
  });
});

describe('the run, after #410’s review', () => {
  it('judges the due day on the reader’s own clock, as Home’s “due today” is (medium 1)', () => {
    const was = process.env.TZ;
    try {
      // Thursday 12 Nov at 18:00 in Los Angeles is Friday 02:00 UTC.
      const c = ci('g1', 46, false, { postedAt: '2026-11-13T02:00:00Z' });
      process.env.TZ = 'America/Los_Angeles';
      expect(inByDueDay(c, cycle, 46)).toBe(true);
      process.env.TZ = 'UTC';
      expect(inByDueDay(c, cycle, 46)).toBe(false);
    } finally { process.env.TZ = was; }
  });
  it('leaves a goal out from the week after it was called Done (medium 2)', () => {
    const s = weeks(41, 46, [], 41);
    // A second goal, done in week 43 and not checked in since: it no longer ends the run.
    s.goals.push(goal('g2', 41));
    for (const w of [41, 42, 43]) s.checkIns.push(ci('g2', w, false, { status: w === 43 ? 'done' : 'on' }));
    expect(onTimeStreak('tunde', s, cycle, 46)).toBe(6);
  });
  it('never counts a backfilled week as on time, and calls a forgiven week with nothing in it missed (medium 3)', () => {
    const s = weeks(40, 46, [], 40);
    s.checkIns = s.checkIns.filter((c) => c.week !== 45).concat(ci('g1', 45, false, { backfilled: true }));
    expect(onTimeStreak('tunde', s, cycle, 46)).toBe(6);
    expect(forgivenIn('tunde', s.goals, s.checkIns, cycle, 46)).toBe(45);
    const f = receiptFacts(weekProgress('tunde', s, cycle, 46, new Date('2026-11-12T12:00:00Z')), 'tunde', s, cycle, 46, false);
    expect(f.forgivenMissed).toBe(true);
    expect(receiptText(f).second).toContain('Week 45 was missed; one missed week doesn’t break a run.');
    const late = weeks(40, 46, [45], 40);
    const fl = receiptFacts(weekProgress('tunde', late, cycle, 46, new Date('2026-11-12T12:00:00Z')), 'tunde', late, cycle, 46, false);
    expect(receiptText(fl).second).toContain('Week 45 came in late; one late week doesn’t break a run.');
  });
  it('counts a goal taken over only from when it was the new owner’s (medium 4)', () => {
    const s = weeks(40, 46, [], 40);
    // Lena checked in g2 every week until 43; Tunde has owned it since 44 and checked it in on time.
    s.goals.push(goal('g2', 40));
    for (let w = 40; w <= 46; w++) s.checkIns.push(ci('g2', w, false, w <= 43 ? { authorId: 'lena' } : {}));
    expect(onTimeStreak('tunde', s, cycle, 46)).toBe(7);
  });
  it('leaves a removed check-in out', () => {
    const s = weeks(41, 46, [], 41);
    s.checkIns.find((c) => c.week === 44)!.removedAt = '2026-11-01T00:00:00Z';
    s.checkIns.find((c) => c.week === 43)!.removedAt = '2026-11-01T00:00:00Z';
    expect(onTimeStreak('tunde', s, cycle, 46)).toBe(2);
  });
});

describe('the due day as a review (T4), after #410’s review', () => {
  it('names it a review only in a week the review is held', () => {
    const r = { people: ['tunde'], weekday: 3, everyWeeks: 2, removedAt: null, endedAt: null };
    expect(reviewOnDueDay([r], 'tunde', cycle, true, 46)).toBe(true);
    expect(reviewOnDueDay([r], 'tunde', cycle, true, 45)).toBe(false);
    expect(reviewOnDueDay([{ ...r, everyWeeks: 1 }], 'tunde', cycle, true, 45)).toBe(true);
  });
});

describe('a moment, after #410’s review', () => {
  it('counts weeks behind, not check-ins, and never fires on a second check-in in the same week', () => {
    const g = goal('g1', 40);
    const behind = [ci('g1', 42, false, { status: 'off' }), ci('g1', 45, false, { status: 'risk' })];
    const now = ci('g1', 46, false, { status: 'on' });
    expect(moment(behind, now, g)).toEqual({ kind: 'back', behind: 4 });
    expect(moment([...behind, ci('g1', 46, false, { status: 'risk' })], now, g)).toBe(null);
  });
});
