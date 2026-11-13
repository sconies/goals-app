/* MS, the core's half: a goal held to no number (domain/unmeasured), read by the status rules alone. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { attentionFor } from './attention';
import { currentCycle, scopeToCycle } from './cycle';
import { goalStatus, projects } from './status';
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
    expect(st).toMatchObject({ status: 'none', calc: 'none', greener: false, unmeasured: true });
    expect(projects(held, st.status)).toBe(false);
    // Months without a check-in still aren't quiet.
    const quiet = goalStatus(held, cycle, [], new Date('2026-12-20T12:00:00Z'));
    expect(quiet.status).not.toBe('stale');
    const flags = attentionFor(held, { ...scoped, goals: scoped.goals.map((x) => (x.id === held.id ? held : x)) }, cycle, today).flags.map((f) => f.kind);
    expect(flags).not.toContain('due');
    expect(flags).not.toContain('stale');
  });
});
