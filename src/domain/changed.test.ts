// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { changedHeading, changedSet, changedSince, mondayOf, movement, movesByTeam, seenToday, sinceFor, type ThenNow } from './changed';
import { longDay } from './home';

/* Rule 5's worked examples (docs/design/home/spec.md). */
describe('Home rule 5: movement', () => {
  it('on track on 6 Nov, at risk now: worse', () => {
    expect(movement('on', { status: 'risk', call: 'risk', calculated: 'risk' })).toEqual({ kind: 'worse', early: false });
  });
  it('at risk on 6 Nov, on track now: better', () => {
    expect(movement('risk', { status: 'on' })).toEqual({ kind: 'better', early: false });
  });
  it('no recent update now, with a weekly rhythm: quiet; the same with no set rhythm: null', () => {
    expect(movement('on', { status: 'stale' })).toEqual({ kind: 'quiet', early: false });
    expect(movement('on', { status: 'stale' }, false)).toBeNull();
  });
  it('on plan by the numbers, the owner called it at risk: worse, called early by its owner', () => {
    expect(movement('on', { status: 'risk', call: 'risk', calculated: 'on' })).toEqual({ kind: 'worse', early: true });
  });
  it('off track on both days, a new check-in between: null (Home is not a feed)', () => {
    expect(movement('off', { status: 'off', call: 'off', calculated: 'off' })).toBeNull();
  });
  it('a goal created after the day: null; done now: done; reopened: null', () => {
    expect(movement(null, { status: 'risk' })).toBeNull();
    expect(movement('risk', { status: 'done' })).toEqual({ kind: 'done', early: false });
    expect(movement('done', { status: 'on' })).toBeNull();
  });
  it('a first status: on track is no change, at risk or off track is worse; quiet and back on track is better', () => {
    expect(movement('none', { status: 'on' })).toBeNull();
    expect(movement('none', { status: 'off' })?.kind).toBe('worse');
    expect(movement('stale', { status: 'on' })?.kind).toBe('better');
    expect(movement('stale', { status: 'risk' })).toBeNull();
    expect(movement('stale', { status: 'off' })?.kind).toBe('worse');
  });
});

describe('Home rule 5: sinceFor and home-seen', () => {
  it('Rhea opened Home Fri 6 Nov and again Tue 10 Nov at 09:00 and 15:00: both visits count from 6 Nov', () => {
    const first = seenToday({ last: '2026-11-06', prev: '2026-11-02' }, '2026-11-10');
    expect(first).toEqual({ last: '2026-11-10', prev: '2026-11-06' });
    expect(sinceFor({ last: '2026-11-06', prev: '2026-11-02' }, '2026-11-10')).toBe('2026-11-06');
    const again = seenToday(first, '2026-11-10');
    expect(again).toBe(first);
    expect(sinceFor(again, '2026-11-10')).toBe('2026-11-06');
    expect(changedHeading('2026-11-06', '2026-11-10', longDay)).toBe('Changed since Friday 6 Nov');
  });
  it('last opened 2 Sep: counts from 28 days back, “Changed in the last 4 weeks”', () => {
    const since = sinceFor({ last: '2026-09-02', prev: null }, '2026-11-10');
    expect(since).toBe('2026-10-13');
    expect(changedHeading(since, '2026-11-10', longDay)).toBe('Changed in the last 4 weeks');
  });
  it('never opened: null, “Changed this week”, counting from the week’s Monday; first visit today: still this week', () => {
    expect(sinceFor(null, '2026-11-11')).toBeNull();
    expect(sinceFor(seenToday(null, '2026-11-11'), '2026-11-11')).toBeNull();
    expect(changedHeading(null, '2026-11-11', longDay)).toBe('Changed this week');
    expect(mondayOf('2026-11-11')).toBe('2026-11-09');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
  });
});

describe('Home rule 5: changedSince', () => {
  const g = (id: string, set: ThenNow['set'], was: ThenNow['was'], now: ThenNow['now']['status'], teamId = 't1'): ThenNow => ({ id, title: id, teamId, set, setName: set, was, now: { status: now } });
  it('counts by kind; rows worse first, then quiet, better and done, each by set then name', () => {
    const c = changedSince([g('b', 'watching', 'on', 'off'), g('a', 'mine', 'on', 'done'), g('c', 'team', 'risk', 'on'), g('d', 'mine', 'on', 'stale'), g('e', 'mine', 'on', 'risk'), g('f', 'team', 'off', 'off'), g('n', 'mine', null, 'off')], '2026-11-06');
    expect(c.counts).toEqual({ worse: 2, better: 1, quiet: 1, done: 1 });
    expect(c.rows.map((r) => r.id)).toEqual(['e', 'b', 'd', 'c', 'a']);
  });
  it('a teams table’s “Since” column: worse, better and quiet by team; done is not in it', () => {
    const by = movesByTeam([{ teamId: 'x', kind: 'worse' }, { teamId: 'x', kind: 'better' }, { teamId: 'y', kind: 'done' }]);
    expect(by.get('x')).toEqual({ worse: 1, better: 1, quiet: 0 });
    expect(by.get('y')).toBeUndefined();
  });
  it('counts the widest set, each goal said with the first set it is in, or its team when drawn as teams', () => {
    const goals = [{ id: 'm', ownerId: 'me', teamId: 't' }, { id: 'o', ownerId: 'x', teamId: 't' }, { id: 'w', ownerId: 'y', teamId: 'u' }];
    const tabs = [{ id: 'mine', ids: ['m'] }, { id: 'team', ids: ['m', 'o'] }, { id: 'watching', ids: ['w'] }, { id: 'all', ids: ['m', 'o', 'w'] }];
    const set = changedSet(tabs, 'me', goals, (id) => id.toUpperCase(), () => false)!;
    expect(set.scope).toBe('team');
    expect(set.goals).toEqual([{ id: 'm', set: 'mine', setName: 'yours' }, { id: 'o', set: 'team', setName: 'your team' }]);
    expect(changedSet(tabs, 'me', goals, (id) => id.toUpperCase(), () => true)!.goals[1]!.setName).toBe('T');
    expect(changedSet([{ id: 'all', ids: ['m'] }], 'me', goals, (id) => id, () => false)).toBeNull();
  });
});
