// @vitest-environment node
/* The demo doesn't contradict itself (deep review, 10 Nov, U17 and U26): what it says on one screen holds on the next,
   so a leader reading closely on the day of the talk (11 Nov) finds nothing that looks like the app lost something. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '.';
import { currentWeek } from '../../domain/plan';

const today = new Date('2026-11-11T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const asks = s.requests ?? [];

describe('the demo’s facts agree with each other', () => {
  it('dates every check-in within its own week: a check-in “for week 45” is never posted in week 46 (U26)', () => {
    const late = s.checkIns.filter((c) => currentWeek(cycle, new Date(c.postedAt)) > c.week && !c.backfilled);
    expect(late.map((c) => `${c.goalId} week ${c.week} posted ${c.postedAt.slice(0, 10)}`).slice(0, 5)).toEqual([]);
  });
  it('names the week a goal last checked in when an ask says “No update since week n” (U26)', () => {
    const wrong = asks.flatMap((a) => {
      const m = /No update since week (\d+)/.exec(a.ask);
      if (!m) return [];
      const before = s.checkIns.filter((c) => a.goalIds.includes(c.goalId) && c.postedAt <= a.createdAt).map((c) => c.week);
      const lastWeek = Math.max(...before);
      return lastWeek === Number(m[1]) ? [] : [`${a.goalIds[0]}: “${a.ask.slice(0, 40)}” but its last check-in was week ${lastWeek}`];
    });
    expect(wrong).toEqual([]);
  });
  it('has no note that answers a question still open on the same goal’s tree (U17): the runner budget note leaves the queue-wait answer to Rhea', () => {
    const note = s.decisions.find((d) => d.goalId === 'ns-lead' && d.kind === 'note' && /Runner budget goes to finance/.test(d.note));
    const question = asks.find((a) => a.kind === 'question' && /how soon does queue wait drop/.test(a.ask));
    expect(note).toBeTruthy();
    expect(question?.status).toBe('open');
    expect(note!.note).not.toMatch(/under five minutes by week/);
  });
});
