// @vitest-environment node
/* One goal row (GOAL-ROW; docs/design/patterns/spec.md 1.5): the hard cases, worked, in the Platform Engineering
   example on Thursday 5 November (week 45). The row only picks parts of the shared rules; these say which part goes in
   which slot, in each place. */
import { buildPlatformOrg } from '../data/platformOrg';
import { attentionFor } from './attention';
import { rowParts, type RowFacts, type RowPlace } from './goalRow';
import { currentWeek } from './plan';
import { LABEL, RESULT_TEXT } from './vocabulary';
import type { Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s0 = buildPlatformOrg(today);
const cycle = s0.cycles[0]!;
const week = currentWeek(cycle, today);
const row = (id: string, place: RowPlace = 'watching-needs', extra: Partial<RowFacts> = {}, s: Snapshot = s0) => {
  const g = s.goals.find((x) => x.id === id)!;
  return rowParts(g, attentionFor(g, s, cycle, today), place, { checkIns: s.checkIns, people: s.people, asks: s.requests ?? [], cycle, today, week, viewerId: 'rhea', ...extra });
};

describe('the goal row: one set of slots in every list', () => {
  it('on track with a forecast miss: status On track, and the reason is "Getting worse: On track today, but…" with the warning mark', () => {
    const p = row('cost-requests');
    expect(p.status).toBe('on');
    expect(p.statusWord).toBe(LABEL.on);
    expect(p.value).toBe('73%');
    expect(p.reason).toBe('Getting worse: On track today, but the recent trend heads for 78–79% by week 53, against a target of 80%.');
    expect(p.reasonIsFlag).toBe(true);
  });

  it('stale with a last known value: the last number and "as of week 40", and no warning mark, because the flag is the status', () => {
    const p = row('cost-storage');
    expect(p.status).toBe('stale');
    expect(p.value).toBe('63%');
    expect(p.gap).toBeNull();
    expect(p.asOf).toBe('as of week 40');
    expect(p.reason).toBe('No check-in for 36 days; the last was week 40 (at risk).');
    expect(p.reasonIsFlag).toBe(false);
  });

  it('off track with an open ask: the owner’s why is the reason, and the ask is the context line, "Waiting on you" for the person asked', () => {
    const p = row('lead-ci-time', 'watching-needs', { viewerId: 'amara' });
    expect(p.status).toBe('off');
    expect(p.gap?.text).toBe('3 min behind plan');
    expect(p.reason).toBe('Blocked on Infrastructure & Compute: we need their change before we can switch the runner pools on.');
    expect(p.reasonIsFlag).toBe(false);
    expect(p.context).toBe('Waiting on you: approve the extra CI runner budget for Q4.');
    expect(p.contextIsFlag).toBe(true);
    expect(row('lead-ci-time').context).toBe('Waiting on Amara Nwosu: approve the extra CI runner budget for Q4.');
  });

  it('a milestone: its stages as the value, and how late beside them', () => {
    const p = row('cfr-halt');
    expect(p.value).toBe('2 of 3 stages');
    expect(p.gap?.text).toBe('Late');
  });

  it('done: the result in words, from the vocabulary', () => {
    const p = row('ai-approval', 'goals-list');
    expect(p.status).toBe('done');
    expect(p.result?.text).toBe(RESULT_TEXT.late);
  });

  it('no check-in yet: "No value yet", and Home has the Check in button while one is due', () => {
    const s = { ...s0, checkIns: s0.checkIns.filter((c) => c.goalId !== 'devsat-toil') };
    const p = row('devsat-toil', 'home-mine', {}, s);
    // In week 45 a goal never checked in has gone quiet; the value still says there is no number.
    expect(p.status).toBe('stale');
    expect(p.value).toBe('No value yet');
    expect(p.action).toBe('Check in');
  });

  it('one reason, never a list of flags: the top flag by the shared weight, and no count of the rest', () => {
    const p = row('ns-devsat');
    expect(p.reason).toBe('Decision or help needed: Waiting on Daniel Okafor: put one-command local dev on every team’s Q4 plan.');
    expect(p.reason).not.toMatch(/more/);
    expect(p.context).toBeNull();
  });

  it('only task lists have an action: the check-in queue says Check in, Carry on with a draft kept, and Correct it once posted', () => {
    expect(row('lead-ci-time', 'goals-list').action).toBeNull();
    expect(row('lead-ci-time', 'checkin-queue').action).toBe('Check in');
    const kept = row('lead-ci-time', 'checkin-queue', { queue: { draft: true } });
    expect(kept.action).toBe('Carry on');
    expect(kept.context).toBe('Draft kept');
    const done = row('lead-ci-time', 'checkin-queue', { queue: { done: true, postedDay: 'Tue' } });
    expect(done.action).toBe('Correct it');
    expect(done.reason).toBe('Checked in Tue.');
  });

  it('the check-in queue’s reason is what last week’s check-in said that the value doesn’t: the owner’s reason, not the number again', () => {
    const p = row('lead-ci-time', 'checkin-queue');
    expect(p.reason ?? '').not.toContain(p.value);
  });

  it('a list with nothing flagged names the owner and how fresh the goal is; a list of your own leaves the owner out', () => {
    const fine = s0.goals.find((g) => attentionFor(g, s0, cycle, today).flags.every((f) => f.kind === 'due') && attentionFor(g, s0, cycle, today).status.status === 'on')!;
    const owner = s0.people.find((x) => x.id === fine.ownerId)!.name;
    expect(row(fine.id, 'goals-list').reason).toMatch(new RegExp(`^${owner}\\. (Checked in|No check-in)`));
    expect(row(fine.id, 'goals-list', { showOwner: false }).reason).not.toContain(owner);
  });
});
