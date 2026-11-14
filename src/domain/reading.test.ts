// @vitest-environment node
/* A check-in's reading (NR rule 3 and 2.3): one rule at every door, and its words. */
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed } from './actions';
import { planChanges, postCheckIn, type CheckInPost } from './changeset';
import { emptyDraft } from './checkin';
import { currentWeek, planAt } from './plan';
import { readingFrom, readingProblem } from './reading';
import { readingHistoryLine, readingLine, readingThisWeek, readWhen } from './readingWords';
import type { CheckInReading, MetricGoal, Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = s.goals.find((g) => g.id === 'mttr-pir') as MetricGoal;
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const x = (snapshot: Snapshot = s) => ({ snapshot, cycle, week, actor: person(goal.ownerId), now: '2026-11-05T13:00:00Z', newId: (p: string) => `${p}_r${++n}` });
const onPlan = Math.round(planAt(goal.plan, week, cycle.weeks));
const fresh: Snapshot = { ...s, checkIns: s.checkIns.filter((c) => !(c.goalId === goal.id && c.week === week)) };
const reading = (value: number, why?: CheckInReading['why']): CheckInReading => ({ source: 'Incident tool', value, at: '2026-11-05T09:02:00.000Z', ...(why ? { why } : {}) });
const post = (value: number, r: CheckInPost['reading']): CheckInPost => ({ goalId: goal.id, week, draft: { ...emptyDraft(goal, null), value: String(value) }, mode: 'new', reading: r });

describe('rule 3: a reading is recorded only as the rule allows', () => {
  it('records a confirmed reading with the check-in, and the owner’s number stays the check-in’s', () => {
    const out = postCheckIn(x(fresh), post(onPlan, reading(onPlan)));
    expect(out.checkIn.value).toBe(onPlan);
    expect(out.checkIn.reading).toEqual({ source: 'Incident tool', value: onPlan, at: '2026-11-05T09:02:00.000Z' });
  });

  it('refuses a different number with no reason, and an else with fewer than 10 characters', () => {
    expect(() => postCheckIn(x(fresh), post(onPlan, reading(onPlan + 3)))).toThrow(NotAllowed);
    expect(() => postCheckIn(x(fresh), post(onPlan, reading(onPlan + 3, { kind: 'else', text: 'too short' })))).toThrow(/at least 10 characters/);
  });

  it('records a different number with its reason, and drops a reason the numbers don’t need', () => {
    const out = postCheckIn(x(fresh), post(onPlan, reading(onPlan + 3, { kind: 'behind' })));
    expect(out.checkIn.reading).toMatchObject({ value: onPlan + 3, why: { kind: 'behind' } });
    const same = postCheckIn(x(fresh), post(onPlan, reading(onPlan, { kind: 'wrong' })));
    expect(same.checkIn.reading?.why).toBeUndefined();
  });

  it('applies the same rule to a sheet’s or a tool’s row (the readings beside the rows)', () => {
    const row = { 'goal id': goal.id, week: String(week), value: String(onPlan) };
    const base = { tables: { checkIns: [row] }, snapshot: fresh, cycle, week, actor: person(goal.ownerId), now: '2026-11-05T13:00:00Z', newId: (p: string) => `${p}_t${++n}`, via: 'mcp' as const };
    const refused = planChanges({ ...base, readings: [{ goalId: goal.id, week, reading: reading(onPlan + 3) }] });
    expect(refused.issues.some((i) => i.level === 'must' && /Say why your number is different/.test(i.message))).toBe(true);
    const kept = planChanges({ ...base, readings: [{ goalId: goal.id, week, reading: reading(onPlan + 3, { kind: 'other-count' }) }] });
    expect(kept.commit?.checkIns?.[0]?.reading).toMatchObject({ value: onPlan + 3, why: { kind: 'other-count' } });
    expect(planChanges(base).commit?.checkIns?.[0]?.reading).toBeUndefined();
  });

  it('asks nothing when the numbers are one at the goal’s decimals', () => {
    const at = '2026-11-05T13:00:00Z';
    expect(readingProblem(reading(12), 12, 0, at)).toBe(null);
    expect(readingProblem(reading(12.04), 12, 1, at)).toBe(null);
    expect(readingProblem(reading(12), 14, 0, at)).toMatch(/Say why/);
  });

  it('records only a reading rule 2 allows: a finite number, measured at a real time within 7 days, a known reason with words of 10 to 500 characters', () => {
    const at = '2026-11-05T13:00:00Z';
    const r = (o: Partial<CheckInReading>) => ({ ...reading(12), ...o }) as CheckInReading;
    expect(readingProblem(r({ why: { kind: 'nope' as never } }), 14, 0, at)).toMatch(/Say why/);
    expect(readingProblem(r({ why: { kind: 'else', text: 'abc' } }), 14, 0, at)).toMatch(/at least 10 characters/);
    expect(readingProblem(r({ why: { kind: 'else', text: 'x'.repeat(100_000) } }), 14, 0, at)).toMatch(/at most 500 characters/);
    expect(readingProblem(r({ why: { kind: 'behind', text: 'x'.repeat(501) } }), 14, 0, at)).toMatch(/at most 500/);
    expect(readingProblem(r({ why: { kind: 'else', text: 'Release branch moved.' } }), 14, 0, at)).toBe(null);
    expect(readingProblem(r({ at: '2020-01-01T09:00:00Z' }), 12, 0, at)).toMatch(/more than 7 days old/);
    expect(readingProblem(r({ at: '2027-01-01T09:00:00Z' }), 12, 0, at)).toMatch(/dated after now/);
    // A day's grace: the demo pins today but keeps the clock's time of day, so a post at 01:00 meets a 09:00 reading.
    expect(readingProblem(r({ at: '2026-11-05T09:00:00Z' }), 12, 0, '2026-11-05T01:00:00Z')).toBe(null);
    expect(readingProblem(r({ at: '2026-11-06T09:00:00Z' }), 12, 0, '2026-11-05T01:00:00Z')).toMatch(/dated after now/);
    expect(readingProblem(r({ at: 'Thursday' }), 12, 0, at)).toMatch(/can’t be read/);
    expect(readingProblem(r({ value: Number.NaN }), 12, 0, at)).toMatch(/can’t be read/);
    expect(readingProblem(r({ value: '12' as unknown as number }), 12, 0, at)).toMatch(/can’t be read/);
    expect(() => postCheckIn(x(fresh), post(onPlan, { ...reading(onPlan), at: '2020-01-01T09:00:00Z' }))).toThrow(/more than 7 days old/);
  });
});

describe('a re-saved check-in and its reading (review of NR2, medium 1)', () => {
  const posted = postCheckIn(x(fresh), post(onPlan, reading(onPlan + 3, { kind: 'behind' })));
  const after = { ...fresh, checkIns: [...fresh.checkIns, posted.checkIn] };
  const correct = (value: number, r?: CheckInReading): CheckInPost => ({ ...post(value, r), mode: 'correct', reason: 'Typed the wrong week’s number' });
  it('keeps the reading when the number is unchanged and the correction carries none', () => {
    const c = correct(onPlan);
    expect(postCheckIn(x(after), { ...c, draft: { ...c.draft, next: 'Order more runners' } }).checkIn.reading).toEqual(posted.checkIn.reading);
  });
  it('drops it when the number changes, and takes the correction’s own when it carries one', () => {
    expect(postCheckIn(x(after), correct(onPlan + 1)).checkIn.reading).toBeUndefined();
    expect(postCheckIn(x(after), correct(onPlan + 3, reading(onPlan + 3))).checkIn.reading).toEqual(reading(onPlan + 3));
  });
  it('always writes the row’s reading, null when there is none, so a re-save clears what the database had', async () => {
    const { checkInToRow } = await import('../data/rows');
    expect(checkInToRow('ws', postCheckIn(x(after), correct(onPlan + 1)).checkIn).reading).toBe(null);
    expect(checkInToRow('ws', posted.checkIn).reading).toEqual(posted.checkIn.reading);
  });
});

describe('the read-back (2.3)', () => {
  const g = { unit: 'min', decimals: 0 };
  it('says a confirmed reading, read today in the viewer’s zone', () => {
    expect(readingLine({ value: 12, reading: { source: 'CI analytics', value: 12, at: '2026-11-05T09:02:00.000Z' } }, g, today, 'UTC')).toBe('12 min, from CI analytics, read 9:02 today. Confirmed by you.');
  });
  it('says a typed number beside what the source said, with the reason in lower case', () => {
    expect(readingLine({ value: 14, reading: { source: 'CI analytics', value: 12, at: '2026-11-05T09:02:00.000Z', why: { kind: 'other-count' } } }, g, today, 'UTC')).toBe('14 min, typed. CI analytics said 12 min: the source counts something else.');
    expect(readingLine({ value: 14, reading: { source: 'CI analytics', value: 12, at: '2026-11-05T09:02:00.000Z', why: { kind: 'else', text: 'Release branch moved on Monday' } } }, g, today, 'UTC')).toBe('14 min, typed. CI analytics said 12 min: release branch moved on Monday.');
  });
  it('says nothing when nothing was read', () => {
    expect(readingLine({ value: 14, reading: null }, g, today, 'UTC')).toBe(null);
  });
  it('says when in the viewer’s zone: today, yesterday, or the day', () => {
    expect(readWhen('2026-11-04T16:40:00.000Z', today, 'UTC')).toBe('16:40 yesterday');
    expect(readWhen('2026-10-29T09:00:00.000Z', today, 'UTC')).toBe('9:00 on Thu 29 Oct');
    // 23:30 UTC on the 4th is 10:30 on the 5th in Sydney: today there.
    expect(readWhen('2026-11-04T23:30:00.000Z', today, 'Australia/Sydney')).toBe('10:30 today');
  });
});

describe('where a reading shows elsewhere (2.4)', () => {
  const g = { unit: 'min', decimals: 0 };
  const at = '2026-11-05T09:02:00.000Z';
  const confirmed = { value: 12, reading: { source: 'CI analytics', value: 12, at } };
  const typed = { value: 15, reading: { source: 'CI analytics', value: 13, at, why: { kind: 'other-count' as const, text: 'It leaves out the release branch pipelines we moved on Monday.' } } };
  it('says this week’s number under Measured by, only from what the latest check-in recorded', () => {
    expect(readingThisWeek(confirmed, g, 'Rhea Kapoor', today, 'UTC')).toBe('12 min, from CI analytics, read 9:02 today. Confirmed by Rhea Kapoor.');
    expect(readingThisWeek(typed, g, 'Rhea Kapoor', today, 'UTC')).toBe('15 min, typed by Rhea Kapoor. CI analytics said 13 min.');
    expect(readingThisWeek({ value: 15, reading: null }, g, 'Rhea Kapoor', today, 'UTC')).toBe(null);
    expect(readingThisWeek(undefined, g, 'Rhea Kapoor', today, 'UTC')).toBe(null);
  });
  it('says a History row’s second line, with the reason and the owner’s words', () => {
    expect(readingHistoryLine(confirmed, g, 'Rhea Kapoor', today, { timeZone: 'UTC' })).toBe('From CI analytics, read 9:02 today. Rhea Kapoor checked in.');
    expect(readingHistoryLine(typed, g, 'Rhea Kapoor', today, { timeZone: 'UTC' })).toBe('Typed by Rhea Kapoor. CI analytics said 13 min. The source counts something else: “It leaves out the release branch pipelines we moved on Monday.”');
    expect(readingHistoryLine({ value: 15, reading: { ...typed.reading, why: { kind: 'behind' } } }, g, 'Rhea Kapoor', today, { timeZone: 'UTC' })).toBe('Typed by Rhea Kapoor. CI analytics said 13 min. The source is behind: I have a newer number.');
    expect(readingHistoryLine({ value: 15, reading: null }, g, 'Rhea Kapoor', today, { nearSourced: true })).toBe('Typed by Rhea Kapoor.');
    expect(readingHistoryLine({ value: 15, reading: null }, g, 'Rhea Kapoor', today)).toBe(null);
  });
  it('names the source on a review’s agenda only for a confirmed number', () => {
    expect(readingFrom(confirmed, 0)).toBe('CI analytics');
    expect(readingFrom(typed, 0)).toBe(null);
    expect(readingFrom({ value: 12, reading: null }, 0)).toBe(null);
  });
});
