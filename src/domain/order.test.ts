// @vitest-environment node
/* Groups worst first (U24) and counts by status, shared by Home and By team; and one rule for a decision waiting (U25). */
import { describe, expect, it } from 'vitest';
import { statusCounts, worstGroupsFirst } from './order';
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { summariseAll } from './summary';
import { applyQuery, EMPTY_QUERY } from './query';
import { waitingOnDecision } from './attention';
import { openFor } from './asks';
import type { DisplayStatus } from './types';

describe('counts by status and groups worst first', () => {
  it('counts each status once, worst first, leaving out the ones with none', () => {
    expect(statusCounts(['on', 'off', 'risk', 'on', 'done', 'off'])).toEqual([{ status: 'off', n: 2 }, { status: 'risk', n: 1 }, { status: 'on', n: 2 }, { status: 'done', n: 1 }]);
    expect(statusCounts([])).toEqual([]);
  });
  it('puts the group with the most off track first, then at risk, then no recent update, then no check-in yet; a healthy group’s size never makes it worse', () => {
    const g = (name: string, ...st: DisplayStatus[]) => ({ name, st });
    const groups = [g('Calm', 'on', 'on', 'on', 'on', 'on', 'on'), g('Quiet', 'stale', 'on'), g('Risky', 'risk', 'risk', 'on'), g('Burning', 'off', 'on'), g('Also burning', 'off', 'risk'), g('Fresh', 'none')];
    expect(worstGroupsFirst(groups, (x) => x.st, (x) => x.name).map((x) => x.name)).toEqual(['Also burning', 'Burning', 'Risky', 'Quiet', 'Fresh', 'Calm']);
  });
});

describe('waiting on a decision is one rule (U25)', () => {
  const today = new Date('2026-11-11T12:00:00Z');
  const s = buildPlatformOrg(today);
  const cycle = s.cycles[0]!;
  const week = currentWeek(cycle, today);
  const sums = summariseAll(s.goals, s, cycle, today, week);
  it('picks the same goals for the filter (and the saved view built on it) as for the Table and the Board, and every goal with an open ask that isn’t done', () => {
    const filter = applyQuery(sums, { ...EMPTY_QUERY, needs: ['decision'] }, { goals: s.goals, cycle, week }).map((x) => x.goal.id).sort();
    const rule = sums.filter((x) => waitingOnDecision(x.attention)).map((x) => x.goal.id).sort();
    const open = sums.filter((x) => x.status !== 'done' && openFor(x.goal.id, s).length > 0).map((x) => x.goal.id).sort();
    expect(filter.length).toBeGreaterThan(0);
    expect(filter).toEqual(rule);
    expect(rule).toEqual(open);
  });
  it('includes the goal Home says waits on Amara', () => {
    const ask = (s.requests ?? []).find((r) => r.status === 'open' && r.recipientId === 'amara' && r.kind === 'decision');
    expect(ask).toBeTruthy();
    const waiting = sums.filter((x) => waitingOnDecision(x.attention)).map((x) => x.goal.id);
    expect(waiting).toEqual(expect.arrayContaining(ask!.goalIds));
  });
});
