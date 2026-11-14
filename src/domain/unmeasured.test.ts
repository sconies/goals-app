/* MS, the core's half: a goal held to no number (domain/unmeasured), read by the status rules alone. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { attentionFor } from './attention';
import { currentCycle, scopeToCycle } from './cycle';
import { goalStatus, projects } from './status';
import { summarise } from './summary';
import { LABEL, MEANING, SHAPE_WORDS } from './vocabulary';
import { heldToNoNumber, isUnmeasured } from './unmeasured';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = currentCycle(s.cycles, today)!;
const scoped = scopeToCycle(s, cycle);

describe('a goal held to no number', () => {
  const g = scoped.goals.find((x) => x.id === 'lead-flaky')!;
  const held = heldToNoNumber(g, true, '2026-11-05T13:00:00.000Z');
  it('is set and cleared on the goal itself, and a stopped or removed goal is never held', () => {
    expect(isUnmeasured(g)).toBe(false);
    expect(isUnmeasured(held)).toBe(true);
    expect(heldToNoNumber(held, true, 'later')).toBe(held);
    expect(heldToNoNumber(held, false, 'later').unmeasuredSince).toBeNull();
    expect(isUnmeasured({ ...held, stoppedAt: '2026-11-05T14:00:00.000Z' })).toBe(false);
  });
  it('has no status from its plan, nothing late, due or projected', () => {
    const was = goalStatus(g, cycle, scoped.checkIns, today);
    const st = goalStatus(held, cycle, scoped.checkIns, today);
    expect(was.unmeasured).toBeUndefined();
    expect(st).toMatchObject({ status: 'unmeasured', calc: 'none', greener: false, unmeasured: true });
    expect(projects(held, st.status)).toBe(false);
    // Months without a check-in still aren't quiet.
    const quiet = goalStatus(held, cycle, [], new Date('2026-12-20T12:00:00Z'));
    expect(quiet.status).not.toBe('stale');
    const flags = attentionFor(held, { ...scoped, goals: scoped.goals.map((x) => (x.id === held.id ? held : x)) }, cycle, today).flags.map((f) => f.kind);
    expect(flags).not.toContain('due');
    expect(flags).not.toContain('stale');
  });
  // Lane, 14 Nov: Not measured yet is a status of its own, said the same wherever the goal is shown, never No check-in yet.
  it('has a status of its own, Not measured yet, in week 0 too, until its owner calls it done', () => {
    expect(LABEL.unmeasured).toBe('Not measured yet');
    expect(MEANING.unmeasured).toMatch(/isn’t measured yet/);
    expect(SHAPE_WORDS.unmeasured).toEqual(['Not measured yet']);
    expect(goalStatus(held, cycle, [], new Date(cycle.startDate + 'T12:00:00Z')).status).toBe('unmeasured');
    const done = { id: 'c-done', goalId: held.id, week: 3, status: 'done', calculated: 'on', postedAt: '2026-11-04T09:00:00.000Z' } as unknown as (typeof scoped.checkIns)[number];
    expect(goalStatus(held, cycle, [...scoped.checkIns, done], today).status).toBe('done');
  });
  it('says Not measured yet on every list row, with no projected year-end number', () => {
    const snap = { ...scoped, goals: scoped.goals.map((x) => (x.id === held.id ? held : x)) };
    const row = summarise(held, snap, cycle, today, goalStatus(held, cycle, scoped.checkIns, today).week);
    expect(row.status).toBe('unmeasured');
    expect(row.statusLabel).toBe('Not measured yet');
    expect(row.forecast).toBeNull();
  });
});
