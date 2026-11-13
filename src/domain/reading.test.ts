// @vitest-environment node
/* A check-in's reading (NR rule 3 and 2.3): one rule at every door, and its words. */
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed } from './actions';
import { planChanges, postCheckIn, type CheckInPost } from './changeset';
import { emptyDraft } from './checkin';
import { currentWeek, planAt } from './plan';
import { readingLine, readingProblem, readWhen } from './reading';
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
    expect(readingProblem(reading(12), 12, 0)).toBe(null);
    expect(readingProblem(reading(12.04), 12, 1)).toBe(null);
    expect(readingProblem(reading(12), 14, 0)).toMatch(/Say why/);
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
